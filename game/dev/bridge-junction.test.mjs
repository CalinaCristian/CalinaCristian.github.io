import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bridgeJunctionSlab, uncoveredBridgePadBoundary } from '../src/bridge-junction.js';
import { MeshBuilder } from '../src/geobuild.js';
const F = JSON.parse(readFileSync(new URL('../../handoffs/fidelity/bridge-junction-slabs/native-pad-fixture.json', import.meta.url)));
const area = tri => Math.abs((tri[1][0] - tri[0][0]) * (tri[2][2] - tri[0][2]) - (tri[1][2] - tri[0][2]) * (tri[2][0] - tri[0][0])) / 2;
const summary = [];
for (const row of F.nodes) {
    const top = structuredClone(row.topTriangles), original = JSON.stringify(top);
    const bottomAt = (x, z) => {
        // Native fixture corners are checked exactly; interior interpolation is
        // checked against the unchanged existing top triangle mesh below.
        const p = top.flat().find(p => Math.hypot(p[0] - x, p[2] - z) < 1e-6);
        return p ? p[1] - 1.1 : row.node.y + .24 - 1.1;
    };
    const s = bridgeJunctionSlab({ ...row, topTriangles: top, bottomHeightAt: bottomAt }); assert.equal(s.known, true);
    assert.equal(JSON.stringify(top), original, 'source/top skin immutable');
    const topArea = top.reduce((sum, t) => sum + area(t), 0), bottomArea = s.underside.reduce((sum, t) => sum + area(t), 0);
    assert.ok(Math.abs(topArea - bottomArea) < 1e-8, 'complete previously missing underside coverage');
    for (const tri of s.underside) for (const p of tri) assert.ok(Math.abs(s.deck.roofHeightAt(p[0], p[2]) - p[1] - 1.1) < 1e-7, 'physical underside/top match exact triangles');
    for (const face of s.fascia) {
        const a = face.vertices[0], b = face.vertices[1], intervals = uncoveredBridgePadBoundary([a[0], a[2]], [b[0], b[2]], row.mouths);
        assert.ok(intervals.length === 1 && intervals[0][0] < 1e-6 && intervals[0][1] > 1 - 1e-6, 'no fascia crosses connected road mouth');
    }
    const m = new MeshBuilder(); for (const t of s.underside) m.face3(...t, [80, 80, 80], [0, -1, 0]); for (const f of s.fascia) m.face4(...f.vertices, [90, 90, 90], f.outward);
    assert.equal(m.ic / 3, s.underside.length + s.fascia.length * 2); assert.ok([...m.p.subarray(0, m.vc * 3)].every(Number.isFinite));
    const bad = structuredClone(row); bad.edges[0].bridge = false; assert.equal(bridgeJunctionSlab({ ...bad, bottomHeightAt: bottomAt }).known, false);
    const ground = structuredClone(row); ground.edges[0].ya = 0; assert.equal(bridgeJunctionSlab({ ...ground, bottomHeightAt: bottomAt }).known, false);
    assert.equal(bridgeJunctionSlab({ ...row, node: { ...row.node, sourceId: null }, bottomHeightAt: bottomAt }).known, false);
    summary.push({ sourceNodeId: row.node.sourceId, sourceIds: row.sourceIds, closedAreaM2: bottomArea, undersideTriangles: s.underside.length, fasciaTriangles: s.fascia.length * 2 });
}
const box = [[0, 0], [10, 0], [10, 2], [0, 2]];
assert.deepEqual(uncoveredBridgePadBoundary([0, 0], [10, 0], [box]), [], 'shared mouth boundary excluded');
assert.deepEqual(uncoveredBridgePadBoundary([0, -1], [10, -1], [box]), [[0, 1]], 'exterior retained');
console.log(JSON.stringify({ passed: true, source: F.source, nativeProfileEqualityEdges: F.fullProfileEqualityEdges, nodes: summary, scope: 'CPU exact native hull/skin/depth/mouth/Float32 replay only; fresh native render and driven seam checks pending' }, null, 2));
