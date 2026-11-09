import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildCoveredRoadModels } from '../../game/src/covered-road-models.js';
import { passageSolids, clipPassageWall } from '../../game/src/building-passages.js';

const dataFile = process.argv[2], profileFile = process.argv[3], captureFile = process.argv[4];
const bytes = fs.readFileSync(dataFile), data = JSON.parse(bytes), original = JSON.stringify(data), output = buildCoveredRoadModels(data);
assert.deepEqual(output.report.unresolved, []); assert.equal(output.report.models.length, 1);
const model = output.accepted[0], bodyIndices = model.bodies.map(b => b.index);
assert.equal(model.road.sourceId, 'w1222672054'); assert.ok(output.isCovered({ road: 287 })); assert.equal(output.isCovered({ road: 234 }), false); assert.equal(output.isCovered({ road: 287, virtual: true }), false);
assert.ok(Math.abs(output.report.models[0].lengthM - 78.04958272062733) < 1e-8);
assert.equal(output.report.models[0].coveredM, output.report.models[0].lengthM);
assert.equal(model.widthM, 6); assert.equal(model.clearanceM, 3.2);
const inside = (x, z, ring) => {
    let yes = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; }
    return yes;
};
let samples = 0, retainedLowCells = 0, clippedWallFaces = 0;
for (const index of bodyIndices) {
    const ring = data.buildingFootprints[index], minH = data.buildings[index][2] / 10, h = data.buildings[index][1] / 10;
    const passages = output.passages.get(index).map(p => ({ ...p, ceilingM: .24 + p.clearanceM })), solids = passageSolids(ring, [], minH, h, passages);
    for (let i = 1; i < model.road.projected.length; i++) for (const t of [.01, .2, .5, .8, .99]) {
        const a = model.road.projected[i - 1], b = model.road.projected[i], x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        assert.equal(solids.some(band => band.y0 < 3.44 - 1e-8 && band.polys.some(p => inside(x, z, p))), false, 'covered centreline has the same complete parent+part low void');
        assert.ok(solids.some(band => band.y0 >= 3.44 - 1e-8 && band.polys.some(p => inside(x, z, p))), 'source upper building volume remains'); samples++;
    }
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], faces = clipPassageWall(a, b, [{ t0: 0, t1: 1, y0: minH, y1: h }], passages);
        clippedWallFaces += faces.filter(f => f.y0 >= 3.44 - 1e-8).length;
    }
    for (let x = Math.min(...ring.map(p => p[0])) + .25; x < Math.max(...ring.map(p => p[0])); x += 1) for (let z = Math.min(...ring.map(p => p[1])) + .25; z < Math.max(...ring.map(p => p[1])); z += 1) {
        if (inside(x, z, ring) && !passages.some(p => inside(x, z, p.ring))) {
            assert.ok(solids.some(band => Math.abs(band.y0 - minH) < 1e-8 && band.polys.some(p => inside(x, z, p))), 'original low body outside source corridor remains'); retainedLowCells++;
        }
    }
}
assert.ok(retainedLowCells > 100 && clippedWallFaces > 0);
const reject = mutate => { const changed = structuredClone(data); mutate(changed, changed.reviewedCoveredRoads[0]); const r = buildCoveredRoadModels(changed); assert.equal(r.accepted.length, 0); assert.ok(r.report.unresolved.length); };
reject((d, r) => { r.sourceWays.find(w => w.sourceId === r.sourceRoadId).tags.layer = '-1'; });
reject((d, r) => { r.sourceWays.find(w => w.sourceId === r.sourceRoadId).nodeTags[11340656341] = { ele: '52' }; });
reject((d, r) => { r.sourceBodies[0].tags.layer = '0'; });
reject((d, r) => { r.sourceBodies[0].tags['building:levels:underground'] = '1'; });
reject((d, r) => { r.sourcePartIds[0] = 'w999'; });
reject((d, r) => { r.groundJoins[0].anchorNodeId = 999; });
reject((d, r) => { const index = d.buildingIds.indexOf(r.sourceBuildingId); d.buildingFootprints[index][0][0] += 1; });
reject((d, r) => { delete d.roadSourceGeometry['133']; });
reject((d, r) => { r.evidence = []; });
const metric = structuredClone(data), reviewed = metric.reviewedCoveredRoads[0], roadTags = reviewed.sourceWays.find(w => w.sourceId === reviewed.sourceRoadId).tags;
roadTags['maxheight:physical'] = metric.roadSourceGeometry['287'].tags['maxheight:physical'] = '3.6';
roadTags.width = metric.roadSourceGeometry['287'].tags.width = '7.2';
assert.equal(buildCoveredRoadModels(metric).accepted[0].clearanceM, 3.6); assert.equal(buildCoveredRoadModels(metric).accepted[0].widthM, 7.2);
assert.equal(buildCoveredRoadModels({}).accepted.length, 0);
assert.equal(JSON.stringify(data), original, 'all original source rows remain unchanged');
let causalCone = null;
if (profileFile && captureFile) {
    const native = JSON.parse(fs.readFileSync(profileFile)), capture = JSON.parse(fs.readFileSync(captureFile)), fresh = capture.items[0].sourceEdge;
    const wrongFloor = buildCoveredRoadModels(data);
    assert.equal(wrongFloor.validateProfile(native.roadProfiles.map(e => ({ ...e, a: { ...e.a, y: e.ya }, b: { ...e.b, y: e.yb } }))), false);
    assert.ok([...wrongFloor.passages.values()].every(p => p.length === 0), 'an incompatible actual profile cannot carve a false opening');
    const nodes = new Map(), edges = native.roadProfiles.map(e => {
        const endpoint = raw => { const key = raw.sourceId != null ? 'n:' + raw.sourceId : 'p:' + e.road + ':' + raw.x + ',' + raw.z; if (!nodes.has(key)) nodes.set(key, { ...raw, key, edges: [], y: 0 }); return nodes.get(key); };
        const a = endpoint(e.a), b = endpoint(e.b), edge = { ...e, a, b, len: Math.hypot(b.x - a.x, b.z - a.z) }; a.edges.push(edge); b.edges.push(edge); return edge;
    });
    const worldText = fs.readFileSync(new URL('../../game/src/world.js', import.meta.url), 'utf8'), start = worldText.indexOf('const envelope = (val) =>'), end = worldText.indexOf('\n        const resid', start);
    const literal = worldText.slice(start + 'const envelope = '.length, end).trim().replace(/;$/, ''), envelope = Function('nodeArr', 'MAXG', 'return (' + literal + ')')([...nodes.values()], .08);
    const run = corrected => {
        for (const n of nodes.values()) n.y = 0;
        for (const e of edges) if (e.tunnel && !(corrected && output.isCovered(e))) for (const n of [e.a, e.b]) if (!n.edges.some(f => !f.tunnel)) n.y = -6;
        const cone = envelope(n => Math.max(0, -n.y));
        if (corrected) {
            for (const n of nodes.values()) n.y = -(cone.get(n) || 0);
            const modeled = edges.map(e => ({ ...e, ya: e.a.y, yb: e.b.y }));
            assert.equal(output.validateProfile(modeled), true, 'actual-source ground joins and covered legs agree in the corrected cone stage');
        }
        return [fresh.a.sourceId, fresh.b.sourceId].map(id => -(cone.get(nodes.get('n:' + id)) || 0));
    };
    const before = run(false), after = run(true); assert.ok(Math.abs(before[0] - fresh.a.y) < 1e-8); assert.ok(Math.abs(before[1] - fresh.b.y) < 1e-8); assert.deepEqual(after, [-0, -0]);
    causalCone = { historicalGraphCommit: native.sourceCommit, freshTargetCommit: capture.sourceCommit, before, freshNative: [fresh.a.y, fresh.b.y], after,
        scope: 'literal production negative-envelope stage on retained source graph; not a complete native World/render acceptance' };
}
console.log(JSON.stringify({ passed: true, scope: 'source association/context guards, physical passage bands/walls, numeric priority and causal cone controls; fresh native geometry remains required',
    dataSha256: crypto.createHash('sha256').update(bytes).digest('hex'), report: output.report, passageSamples: samples, retainedLowCells, clippedWallFaces, causalCone }, null, 2));
