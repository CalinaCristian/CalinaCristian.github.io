import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import * as THREE from '../../../../game/vendor/three.module.min.js';
import { makeVehicle } from '../../../../game/src/vehicles.js';
import { Traffic, laneOffset } from '../../../../game/src/traffic.js';
import { sourceTransitStopPlacement, transitShelterModel } from '../../../../game/src/source-transit-stop.js';
const folder = path.resolve(process.argv[2] || new URL('./native-fixture/', import.meta.url).pathname);
const raw = fs.existsSync(folder + '/native-blocker-fixture.json') ? fs.readFileSync(folder + '/native-blocker-fixture.json') : zlib.gunzipSync(fs.readFileSync(folder + '/native-blocker-fixture.json.gz'));
const f = JSON.parse(raw), ctor = JSON.parse(zlib.gunzipSync(fs.readFileSync(folder + '/constructor-facts.json.gz'))).snapshots[0].active;
const data = JSON.parse(fs.readFileSync(new URL('../../../../game/data/bucharest-grozavesti.json', import.meta.url)));
const placements = [2, 17].map(i => sourceTransitStopPlacement(data, i)), rows = [];
for (const kind of [...new Set(ctor.filter(v => !v.tram).map(v => v.kind))].sort()) {
    if (kind === 'taxi') continue;
    const mesh = makeVehicle(kind, '#ffffff', { city: 'bucharest', instanced: true }), geometry = mesh.userData._model.geo, pos = geometry.attributes.position, idx = geometry.index;
    const local = Array.from({ length: idx.count / 3 }, (_, i) => [0, 1, 2].map(j => { const k = idx.getX(i * 3 + j); return [pos.getX(k), pos.getY(k), pos.getZ(k)]; }));
    const native = ctor.find(v => v.kind === kind), radius = Math.max(...local.flat().map(p => Math.hypot(p[0], p[2])));
    for (const placement of placements) {
        const center = placement.platformPoint, hits = [], paths = [];
        for (const e of f.allEdges.filter(e => e.drivable)) {
            const s0 = (center[0] - e.a.x) * e.dirx + (center[1] - e.a.z) * e.dirz, t = Math.max(0, Math.min(e.len, s0)), distance = Math.hypot(center[0] - e.a.x - e.dirx * t, center[1] - e.a.z - e.dirz * t);
            if (distance > Math.max(e.wL, e.wR) + radius + 3) continue;
            for (const dir of e.oneway ? [1] : [1, -1]) for (let lane = 0; lane < (dir > 0 ? e.lanesF : e.lanesB); lane++) {
                const fx = e.dirx * dir, fz = e.dirz * dir, heading = Math.atan2(-fx, -fz), c = Math.cos(heading), sn = Math.sin(heading), start = dir > 0 ? e.a : e.b, projection = (center[0] - start.x) * fx + (center[1] - start.z) * fz;
                let tested = 0;
                for (let s = Math.max(native.length / 2, projection - radius - 3); s <= Math.min(e.len - native.length / 2, projection + radius + 3); s += .25) {
                    const target = Traffic.prototype.laneTarget({ edge: e, dir, laneCur: lane, latExtraCur: 0, s }, {}), C = [target.x, target.z]; tested++;
                    for (const liftM of [0, .22]) for (const [boxIndex, b] of transitShelterModel(placement, liftM).boxes.entries()) {
                        const cb = Math.cos(b.angle), sb = Math.sin(b.angle), box = new THREE.Box3(new THREE.Vector3(-b.w / 2, 0, -b.d / 2), new THREE.Vector3(b.w / 2, b.h, b.d / 2));
                        for (const [triangleIndex, tri] of local.entries()) {
                            const vertices = tri.map(([x, y, z]) => { const dx = C[0] + c * x + sn * z - b.x, dz = C[1] - sn * x + c * z - b.z; return new THREE.Vector3(cb * dx - sb * dz, .24 + y - b.y, sb * dx + cb * dz); });
                            if (box.intersectsTriangle(new THREE.Triangle(...vertices))) { hits.push({ edgeId: e.id, road: e.road, sourceId: e.access?.sourceId, dir, lane, s, x: C[0], z: C[1], heading, triangleIndex, boxIndex, liftM, material: b.material }); break; }
                        }
                    }
                }
                if (tested) paths.push({ edgeId: e.id, sourceId: e.access?.sourceId, dir, lane, tested });
            }
        }
        rows.push({ kind, platformSourceId: placement.platformSourceId, paths, contactCount: hits.length, contacts: hits.slice(0, 20) });
    }
}
const report = { nativeSourceCommit: f.sourceCommit, scope: 'Native laneTarget with unchanged full-primary model builders; straight interior lanes only (whole body kept within actual native edge); .25m sampled stations; support offsets0/.22m; no actors moved. Not a continuous all-turn/native admission certificate. Taxi canvas extra is not synthesized; its actual primary remains in native blocker fixture.', rows, positiveCount: rows.reduce((sum, r) => sum + r.contactCount, 0) };
fs.writeFileSync(process.argv[3] || '/tmp/drivecv-motor-shelter-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ positiveCount: report.positiveCount, positive: rows.filter(r => r.contactCount).map(r => ({ kind: r.kind, platformSourceId: r.platformSourceId, count: r.contactCount, first: r.contacts[0] })), testedPoses: rows.reduce((sum, r) => sum + r.paths.reduce((sum, p) => sum + p.tested, 0), 0) }, null, 2));
