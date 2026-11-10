// node --test game/dev/bridge-bents.test.mjs
// Planner controls on synthetic decks. They establish the placement rules only; the rendered Basarab bents are
// checked in the browser (game/dev/harness/bridge-bents-check.cjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planBridgeBents, deckChains, BENT_MODEL } from '../src/bridge-bents.js';

const node = (x, z) => ({ x, z });
function line(points, extra = {}) {
    const nodes = points.map(p => node(...p)), edges = [];
    for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i], len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len;
        edges.push({ a, b, len, dirx, dirz, nx: -dirz, nz: dirx, ...extra });
    }
    return edges;
}
const straight = (z, x0, x1, step = 10, extra) => line(Array.from({ length: Math.round(Math.abs(x1 - x0) / step) + 1 }, (_, i) => [x0 + Math.sign(x1 - x0) * i * step, z]), extra);
const plan = (edges, { top = 10, half = 4, blocked = () => false, lower = () => null, heights, carried } = {}) => planBridgeBents({
    edges, halfWidth: e => e.half ?? half, topAt: (e, x, z) => heights ? heights(e, x, z) : e.top ?? top, soffitAt: (e, x, z) => (heights ? heights(e, x, z) : e.top ?? top) - 1.1,
    columnFree: (x, z, r, belowY) => !blocked(x, z, r, belowY), lowerSurface: lower, carried,
});

test('short source edges form one chain with bents about every 30 m', () => {
    const edges = straight(0, 0, 300, 9.375);
    assert.equal(deckChains(edges).length, 1);
    const { bents, report } = plan(edges);
    assert.equal(bents.length, 10); assert.equal(report.bents, 10);
    const xs = bents.map(b => b.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - 30) < 1e-6);
    for (const b of bents) { assert.equal(b.kind, 'crosshead'); assert.ok(Math.abs(b.seat - 8.9) < 1e-9); assert.ok(Math.abs(b.soffit - (8.9 - BENT_MODEL.beamDepthM)) < 1e-9); assert.equal(b.columns.length, 1); }
});

test('parallel carriageways and the rail slab between them share one crosshead', () => {
    const edges = [...straight(-9, 0, 120), ...straight(9, 120, 0), ...straight(-2, 0, 120, 6, { half: 1.7, top: 10.3 }), ...straight(2, 0, 120, 6, { half: 1.7, top: 10.3 })];
    const { bents, report } = plan(edges);
    assert.equal(bents.length, 4, JSON.stringify(report));
    for (const b of bents) {
        assert.equal(b.members.length, 4); assert.ok(Math.abs(b.width - 26) < 1e-6);
        assert.ok(b.columns.length >= 3); assert.equal(b.pedestals.length, 2); // the rail slabs sit higher: bearing pedestals
        for (let i = 1; i < b.columns.length; i++) assert.ok(b.columns[i].o - b.columns[i - 1].o <= BENT_MODEL.maxSpanM);
    }
    assert.ok(report.coveredBySibling >= 12);
});

test('decks at different levels or far apart are separate structures', () => {
    const { bents } = plan([...straight(0, 0, 60), ...straight(12, 0, 60, 10, { top: 4.5 }), ...straight(40, 0, 60)]);
    assert.ok(bents.every(b => b.members.length === 1)); assert.equal(bents.length, 6);
});

test('no column on blocked ground: a frame straddles a road under the deck, a wide obstacle leaves the span open', () => {
    const edges = straight(0, 0, 120);
    const road = plan(edges, { blocked: (x, z) => Math.abs(z) < 7, lower: (x, z) => Math.abs(z) < 5.5 ? { y: 0 } : null });
    assert.equal(road.bents.length, 4); assert.equal(road.report.straddles, 4);
    for (const b of road.bents) { assert.equal(b.columns.length, 2); assert.ok(b.columns.every(c => Math.abs(c.z) >= 7)); assert.ok(b.columns[1].o - b.columns[0].o <= BENT_MODEL.maxSpanM); }
    const water = plan(edges, { blocked: (x) => x > 20 && x < 100 });
    assert.deepEqual(water.bents.map(b => Math.round(b.x)), [15, 105]); assert.equal(water.report.noColumn, 2);
});

test('a crosshead never fouls what passes below; a low deck gets a wall pier only on free ground', () => {
    const edges = straight(0, 0, 120);
    const lowRoad = plan(edges, { top: 6.5, lower: (x) => x > 40 && x < 50 ? { y: 0 } : null });
    assert.ok(lowRoad.bents.every(b => b.x < 40 || b.x > 50)); assert.equal(lowRoad.report.lowClearance, 1);
    const rail = plan(edges, { top: 7.4, lower: () => ({ y: 0, rail: true }) }); // soffit 5.0 < 5.2 m over rails
    assert.equal(rail.bents.length, 0);
    const ramp = plan(edges, { heights: (e, x) => x * .08 });
    assert.ok(ramp.bents.length >= 2);
    for (const b of ramp.bents) { if (b.seat - BENT_MODEL.beamDepthM < BENT_MODEL.minBeamSoffitM) assert.equal(b.kind, 'wall'); else assert.equal(b.kind, 'crosshead'); assert.ok(b.seat >= BENT_MODEL.minWallTopM); }
    assert.ok(ramp.report.tooLow >= 1);
});

test('a stretch carried by stays or an arch gets no pier, the deck on both sides keeps its bents', () => {
    const { bents, report } = plan(straight(0, 0, 300), { carried: (x) => x > 90 && x < 210 });
    assert.deepEqual(bents.map(b => Math.round(b.x)), [15, 45, 75, 225, 255, 285]);
    assert.equal(report.carriedBySuperstructure, 4);
});
