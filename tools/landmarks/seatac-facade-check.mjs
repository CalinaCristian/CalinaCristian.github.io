import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../../game/vendor/three.module.min.js';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { US_FOOTPRINTS } from '../../game/src/landmark-us-source.js';

const lm = LANDMARKS.find(q => q.id === 'seatac');
const model = buildLandmark(lm, { realScale: true });
model.mesh.updateMatrixWorld(true);
const p = US_FOOTPRINTS.w23772634;
const winding = Math.sign(p.reduce((a, q, i) => {
    const r = p[(i + 1) % p.length];
    return a + q[0] * r[1] - r[0] * q[1];
}, 0));

function facadeHit(edge, y) {
    const q = p[edge], r = p[(edge + 1) % p.length];
    const length = Math.hypot(r[0] - q[0], r[1] - q[1]);
    const nx = winding * (r[1] - q[1]) / length;
    const nz = -winding * (r[0] - q[0]) / length;
    const origin = model.mesh.localToWorld(new THREE.Vector3((q[0] + r[0]) / 2 + nx * 2, y, (q[1] + r[1]) / 2 + nz * 2));
    const direction = new THREE.Vector3(-nx, 0, -nz).transformDirection(model.mesh.matrixWorld);
    const hit = new THREE.Raycaster(origin, direction, 0, 3).intersectObject(model.mesh, true)[0];
    assert(hit, `Actual source edge ${edge} at ${y} m must remain visible`);
    const color = hit.object.geometry.attributes.color;
    return { edge, lengthM: length, y, distanceM: hit.distance,
        glass: !!hit.object.material.isMeshStandardMaterial,
        color: [color.getX(hit.face.a), color.getY(hit.face.a), color.getZ(hit.face.a)] };
}

// The actual curved source frontage that previously failed the 14 m detail gate.
const short = facadeHit(49, 13);
assert(short.lengthM > 7.6 && short.lengthM < 7.7);
assert(short.glass, 'Existing second-storey glass band must reach the actual short facade');
const intended = new THREE.Color('#5b7d92');
assert(short.color.every((c, i) => Math.abs(c - [intended.r, intended.g, intended.b][i]) < 1e-6));
assert(Math.abs(short.distanceM - 1.93) < .001, 'Glass retains its existing 7 cm facade offset');

// Actual tiny return, opaque inter-storey band and upper wall are deliberate negatives.
const negatives = [facadeHit(16, 13), facadeHit(49, 8.5), facadeHit(49, 16)];
assert(negatives[0].lengthM < 1);
for (const q of negatives) assert(!q.glass, `Non-glazing source control edge ${q.edge} / y ${q.y}`);

// Terminal collision remains byte-identical to frozen4198996. Independently sourced airside aircraft
// now legitimately extend the scene's horizontal bounds; their plan is checked separately.
const collisionSha256 = createHash('sha256').update(JSON.stringify(model.collision)).digest('hex');
assert.equal(collisionSha256, '00aa1e2fff8a64cc4007252d014b835d66ffb9a6e46d7f134b45f2f6621a4720');
const bounds = new THREE.Box3().setFromObject(model.mesh);
assert.equal(bounds.min.y, 0);
assert.equal(bounds.max.y, 36.5, 'Terminal/IAF source vertical envelope stays unchanged');
assert.deepEqual(lm.sourceIds, ['w23772634', 'w23772637', 'w734002404', 'w869951038']);
assert.equal(model.triangles, 14547); // Four aircraft retained; unsupported branded stripe faces removed.
console.log(JSON.stringify({ passed: true, short, negatives, collisionSha256,
    triangles: model.triangles, addedTriangles: model.triangles - 13531,
    note: 'Facade bands and 2 m detail cutoff remain procedural estimates. Source geometry and collision are unchanged.' }, null, 2));
