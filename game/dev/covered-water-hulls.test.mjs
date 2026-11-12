import assert from 'node:assert/strict';
import { coveredWaterAt, coveredWaterHulls } from '../src/final-water-topology.js';
import { subtractConvex, isConvex } from '../src/building-overlap.js';
// The ground over a sunken channel is cut open except where the river is covered: the hulls must contain every point
// the water test calls covered (plus the pad), and stay close to that reach so open water beside it is still cut open.
const covered = [{ r: 34, pts: [[0, 0], [120, 30], [150, 160]] }], pad = 4, hulls = coveredWaterHulls(covered, pad);
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; } return c; };
const distance = (x, z) => { let d = Infinity; const pts = covered[0].pts; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; };
assert.equal(hulls.length, 5, 'one hull per vertex and per span');
assert(hulls.every(isConvex), 'every hull is convex (subtractConvex needs it)');
let coveredPoints = 0, openPoints = 0;
for (let x = -60; x <= 210; x += 1.5) for (let z = -60; z <= 220; z += 1.5) {
    const d = distance(x, z), held = hulls.some(h => inside([x, z], h));
    if (coveredWaterAt(x, z, covered)) { coveredPoints++; assert(held, `covered point ${x},${z} lies in a hull`); }
    if (d < 34 + pad - 1e-6) assert(held, `point ${x},${z} within the pad lies in a hull`);
    if (d > (34 + pad) / Math.cos(Math.PI / 16) + 1e-6) { openPoints++; assert(!held, `open point ${x},${z} lies outside every hull`); }
}
assert(coveredPoints > 1000 && openPoints > 1000);
// A channel triangle crossing the covered line keeps only its open ends as ground cuts.
let open = [[[-200, -10], [-200, 10], [300, 0]]];
for (const h of hulls) open = open.flatMap(q => subtractConvex(q, h));
assert(open.length >= 2);
for (const q of open) for (const [x, z] of q) assert(distance(x, z) >= 34 + pad - 1e-6, 'no ground cut reaches into the covered river');
assert.deepEqual(coveredWaterHulls([], 4), []);
