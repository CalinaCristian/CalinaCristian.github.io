// node --test game/dev/building-overlap.test.mjs
// Overlapping source buildings: the lower one is cut to stop at the taller one's walls (game/src/building-overlap.js).
// Synthetic footprints; the built districts are audited in the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { subtractConvex, triangulate, isConvex, overlapArea, planOverlapCuts } from '../src/building-overlap.js';

const area = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a / 2); };
const inside = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const rec = (i, ring, h, extra = {}) => { const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]); return { i, ring, holes: [], h, minH: 0, skip: false, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), area: area(ring), ...extra }; };

test('difference with a convex polygon: exact area, nothing of it inside the cutter, everything else kept', () => {
    const podium = rect(0, 0, 60, 12), tower = rect(20, 4, 40, 30), pieces = subtractConvex(podium, tower);
    assert.ok(Math.abs(pieces.reduce((n, p) => n + area(p), 0) - (720 - 160)) < 1e-6);
    for (let x = .5; x < 60; x += 1) for (let z = .5; z < 12; z += 1) {
        const inPieces = pieces.some(p => inside(x, z, p)), inTower = inside(x, z, tower);
        assert.equal(inPieces, !inTower, `${x},${z}`);
    }
    // a non-convex subject (an L) is cut correctly too
    const L = [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]], q = subtractConvex(L, rect(5, 5, 20, 20));
    assert.ok(Math.abs(q.reduce((n, p) => n + area(p), 0) - (500 - (15 * 5 + 5 * 10))) < 1e-6);
});

test('a non-convex taller outline is triangulated; the triangles cover it exactly', () => {
    const U = [[0, 0], [30, 0], [30, 30], [20, 30], [20, 10], [10, 10], [10, 30], [0, 30]];
    assert.equal(isConvex(U), false); assert.equal(isConvex(rect(0, 0, 3, 4)), true);
    const tris = triangulate(U); assert.ok(tris);
    assert.ok(Math.abs(tris.reduce((n, t) => n + area(t), 0) - area(U)) < 1e-6);
});

test('plan: the lower building is cut, the taller untouched; a raised part, an assembly and small overlaps are left', () => {
    const podium = rec(0, rect(0, 0, 60, 12), 8.7), tower = rec(1, rect(20, 4, 40, 30), 43.2), shed = rec(2, rect(100, 0, 110, 10), 4);
    const plan = planOverlapCuts([podium, tower, shed]);
    assert.equal(plan.cuts.length, 1); assert.equal(plan.cuts[0].lower, podium); assert.deepEqual(plan.cuts[0].tallers, [tower]);
    assert.ok(Math.abs(plan.cuts[0].removedM2 - 160) < 1e-6);
    const raised = rec(3, rect(20, 4, 40, 30), 43.2, { minH: 10 });
    assert.equal(planOverlapCuts([rec(0, rect(0, 0, 60, 12), 8.7), raised]).cuts.length, 0, 'a part raised above the lower roof is an overhang');
    { const tower = rec(1, rect(20, 4, 40, 30), 43.2), podium = rec(0, rect(0, 0, 60, 12), 8.7); podium.assembly = [podium, tower]; tower.assembly = podium.assembly;
      assert.equal(planOverlapCuts([podium, tower]).cuts.length, 0, 'parts of one prepared assembly stack by design'); }
    assert.equal(planOverlapCuts([rec(0, rect(0, 0, 60, 12), 8.7, { assembly: [] }), rec(1, rect(20, 4, 40, 30), 43.2)]).cuts.length, 1, 'a ground member running into a taller building outside its assembly is cut (L8)');
    assert.equal(planOverlapCuts([rec(0, rect(0, 0, 60, 12), 8.7, { assembly: [], minH: 3 }), rec(1, rect(20, 4, 40, 30), 43.2)]).cuts.length, 0, 'a raised assembly member is left');
    assert.equal(planOverlapCuts([rec(0, rect(0, 0, 60, 12), 8.7), rec(1, rect(20, 4, 40, 30), 43.2, { assembly: [] })]).cuts.length, 1, 'a building beside a taller assembly member is cut');
    assert.equal(planOverlapCuts([rec(0, rect(0, 0, 60, 12), 8.7), rec(1, rect(59, 11, 70, 20), 43.2)]).cuts.length, 0, 'a 1 m² overlap is left');
    // equal heights: the smaller one is cut
    const a = rec(0, rect(0, 0, 40, 20), 20), b = rec(1, rect(30, 5, 45, 15), 20.5), eq = planOverlapCuts([a, b]);
    assert.equal(eq.cuts.length, 1); assert.equal(eq.cuts[0].lower, b);
    // a lower building wholly inside a taller one is removed (no pieces)
    const inner = planOverlapCuts([rec(0, rect(5, 5, 10, 10), 6), rec(1, rect(0, 0, 30, 30), 40)]);
    assert.equal(inner.cuts[0].pieces.length, 0);
    assert.ok(overlapArea(rect(0, 0, 10, 10), rect(5, 5, 20, 20), [0, 0, 10, 10], [5, 5, 20, 20]) === 25);
});

test('a taller courtyard building: what stands in its courtyard is kept, what is in its solid part is cut', () => {
    const block = rec(1, rect(0, 0, 40, 40), 20, { holes: [rect(10, 10, 30, 30)] }), shed = rec(0, rect(5, 15, 15, 25), 3);
    const plan = planOverlapCuts([shed, block]);
    assert.equal(plan.cuts.length, 1);
    const kept = plan.cuts[0].pieces.reduce((n, p) => n + area(p), 0);
    assert.ok(Math.abs(kept - 50) < 1e-6, String(kept)); // the 5 m x 10 m half inside the courtyard
    for (const p of plan.cuts[0].pieces) for (const [x, z] of p) assert.ok(x >= 10 - 1e-9);
});

test('a lower courtyard building is cut at a taller neighbour and its courtyard stays open (L8)', () => {
    const block = rec(0, rect(0, 0, 40, 30), 12, { holes: [rect(10, 10, 30, 20)] }), tower = rec(1, rect(30, 5, 50, 25), 40);
    const plan = planOverlapCuts([block, tower]);
    assert.equal(plan.cuts.length, 1);
    assert.ok(!plan.skipped.some(s => s.reason === 'courtyard-outline'));
    const pieces = plan.cuts[0].pieces, kept = pieces.reduce((n, p) => n + area(p), 0);
    assert.ok(Math.abs(kept - (1200 - 200 - 200)) < 1e-6, String(kept)); // outline minus the courtyard minus the tower's 10 m x 20 m
    for (let x = .5; x < 50; x += 1) for (let z = .5; z < 30; z += 1) {
        const inPieces = pieces.some(p => inside(x, z, p)), want = x < 40 && !(x > 10 && x < 30 && z > 10 && z < 20) && !(x > 30 && z > 5 && z < 25);
        assert.equal(inPieces, want, `${x},${z}`);
    }
});
