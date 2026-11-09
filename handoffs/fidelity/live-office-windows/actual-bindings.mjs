import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from '../../../game/vendor/three.module.min.js';
import { Office } from '../../../game/src/office.js';
import { STOPS } from '../../../game/src/data.js';
import assert from 'node:assert/strict';
import { LANDMARKS, buildLandmark } from '../../../game/src/landmarks.js';
import {
  OFFICE_WINDOW_SOURCES,
  createOfficeWindowBinding,
  officePaneFrame
} from '../../../game/src/office-window-binding.js';
const require = createRequire(import.meta.url),
  { createCanvas } = require('@napi-rs/canvas');
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') throw Error(tag);
    return createCanvas(1, 1);
  }
};
const ledger = JSON.parse(
    readFileSync(new URL('../../../game/research/cv-window-bindings.json', import.meta.url))
  ),
  results = [];
for (const room of ledger.rooms) {
  const data = JSON.parse(
      execFileSync('git', ['show', 'HEAD:' + room.districtSource.path], { maxBuffer: 128 * 1024 * 1024 })
    ),
    p = data.proj,
    proj = (lat, lon) => ({ x: (lon - p.lon0) * p.mPerLon, z: (p.lat0 - lat) * p.mPerLat }),
    policy = OFFICE_WINDOW_SOURCES[room.id],
    lm = LANDMARKS.find((l) => l.id === policy.landmark),
    anchor = proj(lm.lat, lm.lon),
    c = Math.cos(lm.rotation),
    s = Math.sin(lm.rotation),
    local = ([x, z]) => {
      const dx = x - anchor.x,
        dz = z - anchor.z;
      return [dx * c - dz * s, dx * s + dz * c];
    },
    sourceBuildings = Object.fromEntries(
      lm.sourceIds.map((id) => {
        const i = data.buildingIds.indexOf(id);
        return [
          id,
          i < 0
            ? []
            : [
                {
                  sourceId: id,
                  ring: data.buildingFootprints[i].map(local),
                  holes: (data.buildingHoleFootprints?.[i] || []).map((h) => h.map(local)),
                  h: data.buildingDimensions?.[i]?.[0] ?? data.buildings[i][1] / 10,
                  minH: data.buildingDimensions?.[i]?.[1] ?? data.buildings[i][2] / 10
                }
              ]
        ];
      })
    );
  const res = buildLandmark(lm, { THREE, realScale: true, scale: 1, proj, sourceBuildings, rng: () => 0.5 });
  res.mesh.position.set(anchor.x, 0.12, anchor.z);
  res.mesh.updateMatrixWorld(true);
  const office = new Office(
    null,
    new THREE.PerspectiveCamera(),
    STOPS.find((s) => s.id === room.id),
    {},
    { releaseLock() {} },
    {}
  );
  const world = {
    data,
    landmarks: [{ id: lm.id, mesh: res.mesh }],
    stats: { landmarkSourceReplacements: [{ landmark: lm.id, replaced: lm.sourceIds }] },
    nearestEdge: () => ({ d: 10 })
  };
  let sourceFaceWitnesses;
  if (room.id === 'gts') {
    const id = policy.ids[0],
      ring = data.buildingFootprints[data.buildingIds.indexOf(id)],
      f = officePaneFrame(office);
    sourceFaceWitnesses = [];
    const signed = ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
    for (let e = 0; e < ring.length; e++) {
      const a = ring[e],
        b = ring[(e + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < f.width) continue;
      const N = new THREE.Vector3(
          ((b[1] - a[1]) / len) * (signed > 0 ? 1 : -1),
          0,
          (-(b[0] - a[0]) / len) * (signed > 0 ? 1 : -1)
        ),
        R = new THREE.Vector3(-N.z, 0, N.x),
        C = new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2),
        planes = [];
      res.mesh.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position,
          I = o.geometry.index,
          n = I ? I.count : p.count;
        for (let t = 0; t < n; t += 3) {
          const vs = [0, 1, 2].map((k) =>
              new THREE.Vector3()
                .fromBufferAttribute(p, I ? I.getX(t + k) : t + k)
                .applyMatrix4(o.matrixWorld)
            ),
            normal = vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).normalize(),
            q = vs.map((v) => {
              const d = v.clone().sub(C);
              return [d.dot(R), v.y, d.dot(N)];
            });
          if (
            Math.abs(normal.y) > 0.01 ||
            Math.abs(normal.dot(N)) < 0.98 ||
            Math.min(...q.map((v) => v[0])) > f.width / 2 ||
            Math.max(...q.map((v) => v[0])) < -f.width / 2 ||
            Math.min(...q.map((v) => v[1])) > f.ul.y + 0.12 ||
            Math.max(...q.map((v) => v[1])) < f.ll.y + 0.12 ||
            Math.min(...q.map((v) => v[2])) > 1 ||
            Math.max(...q.map((v) => v[2])) < -1
          )
            continue;
          planes.push({
            triangle: t / 3,
            material: o.material?.name,
            normalAgreement: Math.abs(normal.dot(N)),
            coordinates: q
          });
        }
      });
      sourceFaceWitnesses.push({
        edgeIndex: e,
        sourceId: id,
        sourceA: a,
        sourceB: b,
        lengthM: len,
        projectedAperture: { halfWidth: f.width / 2, y0: f.ll.y + 0.12, y1: f.ul.y + 0.12 },
        nearEmittedVerticalTriangles: planes
      });
    }
  }
  const binding = createOfficeWindowBinding(world, office);
  if (['rosetti', 'arnia', 'db'].includes(room.id))
    assert.equal(binding.known, true, room.id + ' complete unchanged source/room candidate');
  if (room.id === 'uipath-buc') assert.equal(binding.known, false);
  results.push({
    id: room.id,
    known: binding.known,
    reason: binding.reason,
    sourceId: binding.sourceId,
    edgeIndex: binding.edgeIndex,
    skinOffsetM: binding.skinOffsetM,
    facadeEvidence: binding.facadeEvidence,
    floorModelY: binding.floorModelY,
    diagnostics: binding.diagnostics,
    sourceFaceWitnesses
  });
  office.dispose();
}
console.log(
  JSON.stringify(
    {
      scope:
        'Actual unchanged Office constructor + landmark builders + current retained source rings; fixed public street distance control is not native street selection',
      results
    },
    null,
    2
  )
);
