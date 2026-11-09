import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinarySourceSpan, ordinarySourceBodyPlacement } from '../../../../game/src/initial-ordinary-source-span.js';

function fixture() {
    const nodes = [-10, 0, 4, 14].map((x, id) => ({ id, x, z: 0, y: 0, edges: [] }));
    const edges = nodes.slice(1).map((b, id) => {
        const a = nodes[id], e = { id, a, b, len: b.x - a.x, dirx: 1, dirz: 0, nx: 0, nz: 1, lanesF: 1, lanesB: 0, oneway: true, laneW: 4, median: -4, wL: 2, wR: 2, laneCenterShiftM: 0, access: { sourceId: 'w1', publicDrive: true, throughAccess: true } };
        a.edges.push(e); b.edges.push(e); return e;
    });
    const ribbons = edges.map(e => ({ e, poly: [[e.a.x, -2], [e.b.x, -2], [e.b.x, 2], [e.a.x, 2]] }));
    const T = { world: { graph: { edges }, ribbons }, rng() { throw Error('RNG'); } };
    const v = { id: 1, edge: edges[1], dir: 1, lane: 0, laneCur: 0, length: 4.28, width: 1.79, x: 1, z: 0, heading: -Math.PI / 2, s: 1 };
    return { T, v, nodes, edges, ribbons };
}
test('literal shape support preserves original assignment and admits full body over a join', () => {
    const { T, v } = fixture(), before = { ...v }, span = ordinarySourceSpan(T, v);
    assert.equal(span.lo, .05); assert.equal(span.hi, 3.95);
    assert.equal(ordinarySourceBodyPlacement(span, v).valid, true);
    assert.deepEqual(v, before); assert.equal(span.edge, v.edge);
    assert.deepEqual(ordinarySourceSpan(T, v), span);
});
test('missing graph/polygon context retains legacy fallback', () => {
    const { T, v } = fixture(); T.world.ribbons = [];
    assert.equal(ordinarySourceSpan(T, v), null);
});
for (const field of ['pad', 'hasLight', 'crossing', 'zebra', 'stop', 'giveWay', 'sourceSignal']) test(`${field} is an actual boundary`, () => {
    const { T, v, nodes } = fixture(); nodes[1][field] = true;
    assert.equal(ordinarySourceSpan(T, v).behind, 0);
    assert.equal(ordinarySourceSpan(T, v).lo, v.length / 2 + .05);
});
test('foreign source, changed width, changed grade and illegal direction do not grant support', () => {
    for (const change of [e => e.access.sourceId = 'w2', e => e.laneW = 3.5, e => e.a.y = 1, e => { e.oneway = true; e.a.mapEnd = true; }, e => e.lanesF = 2]) {
        const { T, v, edges } = fixture(); change(edges[0]);
        const span = ordinarySourceSpan(T, v);
        assert(span === null || span.behind === 0);
    }
});
test('a fork or geometrically disconnected edge is not a unique literal continuation', () => {
    const { T, v, nodes, edges } = fixture(); nodes[1].edges.push({ id: 9 });
    assert.equal(ordinarySourceSpan(T, v).behind, 0);
    nodes[1].edges.pop(); edges[0].b = { ...nodes[1] };
    assert.equal(ordinarySourceSpan(T, v).behind, 0);
});
test('opposing one-way or rail-only legs cannot support an ordinary motor body', () => {
    const { T, v, edges } = fixture(), e = edges[0];
    [e.a, e.b] = [e.b, e.a]; e.dirx = -1; e.nz = -1;
    assert.equal(ordinarySourceSpan(T, v).behind, 0);
    [e.a, e.b] = [e.b, e.a]; e.dirx = 1; e.nz = 1; e.rail = true;
    assert.equal(ordinarySourceSpan(T, v).behind, 0);
});
test('whole rectangle rejects a corner protrusion', () => {
    const { T, v } = fixture(); v.z = 1.5;
    assert.equal(ordinarySourceBodyPlacement(ordinarySourceSpan(T, v), v).valid, false);
});
test('whole rectangle rejects a narrow interior uncovered strip despite covered outer corners', () => {
    const { T, v, ribbons } = fixture();
    ribbons[0].poly = [[-10, -2], [-.0001, -2], [-.0001, 2], [-10, 2]];
    assert.equal(ordinarySourceBodyPlacement(ordinarySourceSpan(T, v), v).valid, false);
});
test('large source coordinates retain clear seams and detect the same interior strip', () => {
    const { T, v, nodes, ribbons } = fixture(), shift = 100000;
    for (const n of nodes) { n.x += shift; n.z -= shift; }
    for (const r of ribbons) for (const p of r.poly) { p[0] += shift; p[1] -= shift; }
    v.x += shift; v.z -= shift;
    assert.equal(ordinarySourceBodyPlacement(ordinarySourceSpan(T, v), v).valid, true);
    ribbons[0].poly[1][0] -= .0001; ribbons[0].poly[2][0] -= .0001;
    assert.equal(ordinarySourceBodyPlacement(ordinarySourceSpan(T, v), v).valid, false);
});
test('a sharp literal bend grants no coverage outside its actual polygons', () => {
    const { T, v, edges, ribbons } = fixture();
    const e = edges[2]; e.b.x = 4; e.b.z = 10; e.dirx = 0; e.dirz = 1; e.nx = -1; e.nz = 0;
    ribbons[2].poly = [[2, 0], [6, 0], [6, 10], [2, 10]];
    v.s = 3.95; v.x = 3.95;
    assert.equal(ordinarySourceBodyPlacement(ordinarySourceSpan(T, v), v).valid, false);
});
test('centre stays on original leg and source identity cannot be replaced', () => {
    const { T, v } = fixture(), span = ordinarySourceSpan(T, v);
    assert.equal(ordinarySourceBodyPlacement(span, { ...v, s: -.001 }).valid, false);
    assert.equal(ordinarySourceBodyPlacement(span, { ...v, edge: { ...v.edge } }).valid, false);
    assert.equal(ordinarySourceBodyPlacement(span, { ...v, laneCur: .1 }).valid, false);
});
