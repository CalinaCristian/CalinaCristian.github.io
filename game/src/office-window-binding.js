import * as THREE from '../vendor/three.module.min.js';
import { OFFICE_FLOORS, officeFloorElevation } from './office-floors.js';
import { structuralOwnerPlanes } from './office-window-structural-plane.js';

// Reviewed identities and owner floor assignments; exact metre heights/bearings remain estimates.
export const OFFICE_WINDOW_SOURCES = Object.freeze({
  rosetti: { landmark: 'rosetti', ids: ['w28240279'], skin: 0.15 },
  upb: {
    landmark: 'politehnica',
    ids: ['w28240552'],
    skin: 0.15,
    floorViewSkinM: 1.2
  },
  gts: {
    landmark: 'gts',
    ids: ['w245117704'],
    structuralBand: {
      baseM: 0,
      topM: 5.6,
      basis: 'Unchanged bGTS main source-owner prism, modeled0–5.6m; owner specifies floor2, higher aperture must fit actual emitted geometry'
    }
  },
  luxoft: {
    landmark: 'hermes',
    ids: ['w533147567', 'w231123137', 'r6774709'],
    hold: 'Full aperture crosses recessed ground facade and floor transition'
  },
  db: { landmark: 'bob', ids: ['w55450549'], skin: 0.08 },
  arnia: { landmark: 'europehouse', ids: ['w246115249'], skin: 0.26 },
  'uipath-buc': {
    landmark: 'thelandmark',
    ids: ['w546500235'],
    hold: 'Current office Building A differs from retained Building B'
  },
  'uipath-bel': { landmark: 'lincoln', ids: ['w604028609'], skin: 0.26 }
});
const EPS = 1e-7,
  cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function on(a, b, p) {
  return (
    Math.abs(cross(a, b, p)) < EPS &&
    p[0] >= Math.min(a[0], b[0]) - EPS &&
    p[0] <= Math.max(a[0], b[0]) + EPS &&
    p[1] >= Math.min(a[1], b[1]) - EPS &&
    p[1] <= Math.max(a[1], b[1]) + EPS
  );
}
export function inRing(p, ring, boundary = true) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i];
    if (on(a, b, p)) return boundary;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
}
function segmentInside(a, b, outer, holes) {
  const ts = [0, 1];
  for (const ring of [outer, ...holes])
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i],
        d = ring[(i + 1) % ring.length],
        rx = b[0] - a[0],
        rz = b[1] - a[1],
        sx = d[0] - c[0],
        sz = d[1] - c[1],
        den = rx * sz - rz * sx;
      if (Math.abs(den) < EPS) continue;
      const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den,
        u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
  ts.sort((a, b) => a - b);
  for (let i = 1; i < ts.length; i++) {
    const t = (ts[i] + ts[i - 1]) / 2,
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (!inRing(p, outer) || holes.some((h) => inRing(p, h, true))) return false;
  }
  return true;
}
/** Boundary allowed only on the outer ring; complete edges/interiors, including enclosed holes. */
export function polygonFits(poly, outer, holes = []) {
  return (
    poly.every((p) => inRing(p, outer) && !holes.some((h) => inRing(p, h, true))) &&
    poly.every((p, i) => segmentInside(p, poly[(i + 1) % poly.length], outer, holes)) &&
    !holes.some((h) => h.some((p) => inRing(p, poly, true)))
  );
}
export function officePaneFrame(office) {
  const pane = office.windowPane;
  if (!pane?.geometry) return null;
  pane.updateWorldMatrix(true, false);
  pane.geometry.computeBoundingBox();
  const b = pane.geometry.boundingBox,
    point = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(pane.matrixWorld),
    ll = point(b.min.x, b.min.y),
    lr = point(b.max.x, b.min.y),
    ul = point(b.min.x, b.max.y),
    right = lr.clone().sub(ll).normalize(),
    up = ul.clone().sub(ll).normalize(),
    normal = right.clone().cross(up);
  return {
    ll,
    lr,
    ul,
    right,
    up,
    normal,
    center: ll.clone().add(lr).add(ul).add(lr.clone().add(ul).sub(ll)).multiplyScalar(0.25),
    width: ll.distanceTo(lr),
    height: ll.distanceTo(ul)
  };
}
function clip(poly, axis, value, keepGreater) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = (a[axis] - value) * (keepGreater ? 1 : -1),
      fb = (b[axis] - value) * (keepGreater ? 1 : -1);
    if (fa >= -EPS) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
function area(poly) {
  return Math.abs(
    poly.reduce((s, a, i) => {
      const b = poly[(i + 1) % poly.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2
  );
}
// Subtract a convex triangle from convex pieces; prevents centre/corner-only wall coverage claims.
function subtract(poly, tri) {
  let pending = poly,
    rest = [];
  const sign = cross(tri[0], tri[1], tri[2]) >= 0 ? 1 : -1;
  for (let i = 0; i < 3 && pending.length; i++) {
    const a = tri[i],
      b = tri[(i + 1) % 3],
      split = (keep) => {
        const o = [];
        for (let j = 0; j < pending.length; j++) {
          const p = pending[j],
            q = pending[(j + 1) % pending.length],
            fp = sign * cross(a, b, p) * keep,
            fq = sign * cross(a, b, q) * keep;
          if (fp >= -EPS) o.push(p);
          if (fp >= 0 !== fq >= 0) {
            const t = fp / (fp - fq);
            o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
          }
        }
        return o;
      };
    const outside = split(-1),
      inside = split(1);
    if (outside.length >= 3 && area(outside) > EPS) rest.push(outside);
    pending = inside;
  }
  return rest;
}
/** Only this known source owner's actual emitted triangles may certify a thin skin. */
export function emittedFacade(owner, { center, right, outward, width, y0, y1, maxSkin }) {
  let remaining = [
      [
        [-width / 2, y0],
        [width / 2, y0],
        [width / 2, y1],
        [-width / 2, y1]
      ]
    ],
    offset = 0,
    faces = 0,
    blocked = false,
    limitingProjection = null;
  owner.updateWorldMatrix(true, true);
  owner.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position,
      idx = o.geometry.index,
      n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const v = [0, 1, 2].map((k) =>
          new THREE.Vector3()
            .fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k)
            .applyMatrix4(o.matrixWorld)
        ),
        q = v.map((a) => {
          const d = a.clone().sub(center);
          return [d.dot(right), a.y, d.dot(outward)];
        });
      let cut = q;
      for (const [axis, val, greater] of [
        [0, -width / 2, true],
        [0, width / 2, false],
        [1, y0, true],
        [1, y1, false],
        [2, -0.002, true]
      ])
        cut = clip(cut, axis, val, greater);
      if (cut.length < 3 || area(cut) < EPS) continue;
      const max = Math.max(...cut.map((a) => a[2]));
      if (max > maxSkin + EPS) {
        blocked = true;
        if (!limitingProjection || max > limitingProjection.offsetM) {
          limitingProjection = {
            mesh: o.name,
            material: o.material?.name,
            triangleIndex: i / 3,
            offsetM: max,
            worldVertices: v.map((p) => p.toArray()),
            clippedApertureCoordinates: cut
          };
        }
        continue;
      }
      offset = Math.max(offset, max);
      const normal = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
      if (Math.abs(normal.dot(outward)) < 0.99999) continue;
      if (Math.max(...q.map((a) => a[2])) - Math.min(...q.map((a) => a[2])) > 0.002) continue;
      faces++;
      const tri = q.map((a) => a.slice(0, 2));
      remaining = remaining.flatMap((piece) => subtract(piece, tri));
    }
  });
  return {
    known: !blocked && faces > 0 && remaining.reduce((s, p) => s + area(p), 0) < 1e-5,
    offsetM: offset,
    faces,
    uncoveredM2: remaining.reduce((s, p) => s + area(p), 0),
    blocked,
    limitingProjection
  };
}
export function createOfficeWindowBinding(world, office) {
  const policy = OFFICE_WINDOW_SOURCES[office.stop.id],
    hold = (reason) => ({ known: false, reason, floorAssignment: OFFICE_FLOORS[office.stop.id] || null });
  if (!policy) return hold('No reviewed source identity');
  if (policy.hold) return hold(policy.hold);
  if (world.data?.proj?.scale !== 1 || world.data?.proj?.compress)
    return hold('Source mapping is not unit scale');
  const frame = officePaneFrame(office);
  if (!frame) return hold('Missing complete room aperture');
  const scale = new THREE.Vector3();
  office.windowPane.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  if ([scale.x, scale.y, scale.z].some((n) => Math.abs(n - 1) > 1e-8) || Math.abs(frame.up.y - 1) > 1e-8)
    return hold('Room aperture must retain unit scale and vertical up');
  const owner = world.landmarks?.find((l) => l.id === policy.landmark)?.mesh,
    audit = world.stats?.landmarkSourceReplacements?.find((l) => l.landmark === policy.landmark);
  if (!owner || !audit) return hold('Source replacement ownership unavailable');
  owner.updateWorldMatrix(true, true);
  const ownerEnvelope = new THREE.Box3().setFromObject(owner);
  const modelFloor = new THREE.Vector3().setFromMatrixPosition(owner.matrixWorld).y,
    candidates = [],
    diagnostics = [];
  for (const sourceId of policy.ids) {
    if (!audit.replaced.includes(sourceId)) continue;
    const index = world.data.buildingIds.indexOf(sourceId),
      ring = world.data.buildingFootprints?.[index],
      holes = world.data.buildingHoleFootprints?.[index] || [];
    if (!ring?.length) continue;
    const floorAssignment=officeFloorElevation(office.stop.id,world.data,index);
    if(OFFICE_FLOORS[office.stop.id]&&!floorAssignment){diagnostics.push({sourceId,reason:'numbered-floor-metre-conversion-unavailable'});continue;}
    const floor=modelFloor+(floorAssignment?.offsetM||0);
    const signed = ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < frame.width + 0.02) {
        diagnostics.push({ sourceId, edgeIndex: i, reason: 'edge-shorter-than-full-aperture' });
        continue;
      }
      let outward = new THREE.Vector3(
          ((b[1] - a[1]) / len) * (signed > 0 ? 1 : -1),
          0,
          (-(b[0] - a[0]) / len) * (signed > 0 ? 1 : -1)
        ),
        right = new THREE.Vector3(-outward.z, 0, outward.x),
        structural = new THREE.Vector3((a[0] + b[0]) / 2, floor + frame.center.y, (a[1] + b[1]) / 2),
        inward = outward.clone().negate();
      const sourceCenter = structural.clone(),
        sourceOutward = outward.clone();
      let structuralPlane = null;
      if (policy.structuralBand) {
        const result = structuralOwnerPlanes(owner, {
          floor: modelFloor,
          band: policy.structuralBand,
          width: frame.width,
          height: frame.height,
          sourceCenter,
          sourceOutward,
          allowVerticalProjection: !!floorAssignment
        });
        if (!result.known || !result.planes.length) {
          diagnostics.push({
            sourceId,
            edgeIndex: i,
            reason: result.reason || 'known-structural-plane-unavailable'
          });
          continue;
        }
        result.planes.sort((a, b) => b.outward.dot(sourceOutward) - a.outward.dot(sourceOutward));
        if (
          result.planes[1] &&
          Math.abs(
            result.planes[0].outward.dot(sourceOutward) - result.planes[1].outward.dot(sourceOutward)
          ) < 1e-8
        ) {
          diagnostics.push({ sourceId, edgeIndex: i, reason: 'ambiguous-structural-face-correspondence' });
          continue;
        }
        structuralPlane = result.planes[0];
        structural = structuralPlane.center;
        outward = structuralPlane.outward;
        right = structuralPlane.right;
        inward = outward.clone().negate();
      }
      const mapAt = (p, skin = 0) => {
        const d = p.clone().sub(frame.center);
        return structural
          .clone()
          .addScaledVector(right, d.dot(frame.right))
          .addScaledVector(frame.up, d.dot(frame.up))
          .addScaledVector(inward, d.dot(frame.normal))
          .addScaledVector(outward, skin);
      };
      const aperture = [mapAt(frame.ll), mapAt(frame.lr), mapAt(frame.ul)];
      const sourceProjection = aperture.map((p) =>
        p.clone().addScaledVector(sourceOutward, -p.clone().sub(sourceCenter).dot(sourceOutward))
      );
      if (
        !segmentInside(
          [sourceProjection[0].x, sourceProjection[0].z],
          [sourceProjection[1].x, sourceProjection[1].z],
          ring,
          holes
        )
      ) {
        diagnostics.push({
          sourceId,
          edgeIndex: i,
          reason: 'complete-structural-aperture-source-projection-does-not-fit'
        });
        continue;
      }
      const bounds = office.bounds,
        eyes = [
          [bounds.minX, bounds.minZ],
          [bounds.maxX, bounds.minZ],
          [bounds.maxX, bounds.maxZ],
          [bounds.minX, bounds.maxZ]
        ].map(([x, z]) => mapAt(new THREE.Vector3(x, 1.62, z)));
      if (
        !polygonFits(
          eyes.map((p) => [p.x, p.z]),
          ring,
          holes
        )
      ) {
        diagnostics.push({ sourceId, edgeIndex: i, reason: 'complete-room-eye-envelope-does-not-fit' });
        continue;
      }
      if (
        structuralPlane &&
        !polygonFits(
          eyes.map((p) => [p.x, p.z]),
          structuralPlane.bodyRing
        )
      ) {
        diagnostics.push({
          sourceId,
          edgeIndex: i,
          reason: 'complete-eye-envelope-hits-emitted-structural-body'
        });
        continue;
      }
      let facade;
      if (structuralPlane) {
        let remaining = [
          [
            [-frame.width / 2, floor + frame.ll.y],
            [frame.width / 2, floor + frame.ll.y],
            [frame.width / 2, floor + frame.ul.y],
            [-frame.width / 2, floor + frame.ul.y]
          ]
        ];
        for (const t of structuralPlane.triangles) {
          const tri = t.worldVertices.map((p) => {
            const v = new THREE.Vector3(...p);
            return [v.clone().sub(structural).dot(right), v.y];
          });
          remaining = remaining.flatMap((p) => subtract(p, tri));
        }
        const uncoveredM2 = remaining.reduce((s, p) => s + area(p), 0);
        facade = {
          known: uncoveredM2 < 1e-5,
          offsetM: 0,
          faces: structuralPlane.triangles.length,
          uncoveredM2,
          blocked: false,
          basis: structuralPlane.basis,
          planeCenter: structural.toArray(),
          planeNormal: outward.toArray(),
          sourcePlaneDeltaM: structuralPlane.sourcePlaneDeltaM,
          sourceProjection: sourceProjection.map((p) => p.toArray()),
          sourceEyeEnvelopeXZ: eyes.map((p) => [p.x, p.z]),
          actualStructuralBodyRing: structuralPlane.bodyRing,
          actualStructuralTriangles: structuralPlane.triangles,
          exteriorGeometryRetained: true
        };
      } else
        facade = emittedFacade(owner, {
          center: structural,
          right,
          outward,
          width: frame.width,
          y0: floor + frame.ll.y,
          y1: floor + frame.ul.y,
          maxSkin: policy.skin
        });
      const sourceFacadeCoverage = facade.known;
      if (!sourceFacadeCoverage && floorAssignment) {
        // A virtual room's complete wide pane need not match one real wall opening.
        // Anchor the outlook to the same source footprint and the owner-assigned
        // floor. Sample only this owner's emitted exterior skin; retain its raw
        // coverage gaps and never certify an actual architectural aperture.
        const maxSkin = policy.floorViewSkinM ?? 1.2;
        const sampled = emittedFacade(owner, {center:structural,right,outward,width:frame.width,
          y0:floor+frame.ll.y,y1:floor+frame.ul.y,maxSkin});
        const skin = Math.max(sampled.offsetM, sampled.limitingProjection?.offsetM || 0);
        if (floor + frame.ll.y >= ownerEnvelope.min.y - EPS && floor + frame.ul.y <= ownerEnvelope.max.y + EPS && skin <= maxSkin + EPS) {
          facade = {...sampled, originalCoverage:facade, offsetM:skin,
            viewBasis:'Source-bound outlook at owner-assigned floor; aperture position, bearing and metre conversion estimated'};
        } else {
          diagnostics.push({sourceId,edgeIndex:i,reason:'owner-floor-outlook-outside-retained-envelope-or-skin',facade:sampled});
          continue;
        }
      } else if (!sourceFacadeCoverage) {
        diagnostics.push({ sourceId, edgeIndex: i, reason: 'emitted-facade-incompatible', facade });
        continue;
      }
      // Never clip an unrelated literal building volume or an overlapping source part.
      const skinCenter = structural.clone().addScaledVector(outward, facade.offsetM),
        strip = [-0.01, facade.offsetM + 0.025]
          .flatMap((n, j) =>
            (j ? [-1, 1] : [1, -1]).map((s) =>
              structural
                .clone()
                .addScaledVector(right, (s * frame.width) / 2)
                .addScaledVector(outward, n)
            )
          )
          .map((p) => [p.x, p.z]);
      let foreign = false;
      for (let j = 0; j < world.data.buildingIds.length; j++) {
        if (j === index) continue;
        const p = world.data.buildingFootprints?.[j];
        if (!p?.length) continue;
        const dims = world.data.buildingDimensions?.[j];
        if (dims && (dims[0] < floor + frame.ll.y || dims[1] > floor + frame.ul.y)) continue;
        if (
          strip.some((q) => inRing(q, p, true)) ||
          p.some((q) => inRing(q, strip, true)) ||
          strip.some((q, k) =>
            p.some((a, l) => {
              const b = p[(l + 1) % p.length],
                r = strip[(k + 1) % strip.length];
              return cross(q, r, a) * cross(q, r, b) < -EPS && cross(a, b, q) * cross(a, b, r) < -EPS;
            })
          )
        ) {
          foreign = true;
          break;
        }
      }
      if (foreign) {
        diagnostics.push({ sourceId, edgeIndex: i, reason: 'another-source-volume-overlaps-clip-strip' });
        continue;
      }
      const street = world.nearestEdge?.(
          skinCenter.x + outward.x * 4,
          skinCenter.z + outward.z * 4,
          (e) =>
            e.drivable &&
            e.publicDrive !== false &&
            !e.virtual &&
            !e.tunnel &&
            !e.bridge &&
            Math.abs(e.layer || 0) === 0,
          120
        ),
        distance = street?.d;
      if (!Number.isFinite(distance) || distance > 120) {
        diagnostics.push({ sourceId, edgeIndex: i, reason: 'no-ground-public-street' });
        continue;
      }
      candidates.push({
        known: true,
        sourceId,
        edgeIndex: i,
        structuralCenter: structural.toArray(),
        skinOffsetM: facade.offsetM,
        facadeEvidence: facade,
        sourceFacadeCoverage,
        architecturalApertureVerified: false,
        viewKind: sourceFacadeCoverage ? 'source-facade-outlook' : 'owner-floor-outlook',
        floorModelY: floor,
        actualOfficeFloor: floorAssignment?.floor ?? null,
        floorAssignment,
        modelBaseY: modelFloor,
        bearingKnown: false,
        ring,
        holes,
        frame,
        outward,
        right,
        mapPoint: (p) => mapAt(p),
        lowerLeft: mapAt(frame.ll, facade.offsetM),
        lowerRight: mapAt(frame.lr, facade.offsetM),
        upperLeft: mapAt(frame.ul, facade.offsetM),
        score: distance
      });
    }
  }
  candidates.sort(
    (a, b) => a.score - b.score || a.sourceId.localeCompare(b.sourceId) || a.edgeIndex - b.edgeIndex
  );
  return (
    candidates[0] || {
      ...hold(
        'Whole unit-scale room, source aperture and emitted facade have no compatible street-facing candidate'
      ),
      diagnostics
    }
  );
}
