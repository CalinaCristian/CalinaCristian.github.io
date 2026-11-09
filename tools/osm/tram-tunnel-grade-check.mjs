import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildTramTunnelGrades, ROMANA_TRAM_TUNNEL_MODEL, smoothTunnelRamp } from '../../game/src/tram-tunnel-grade.js';
import { buildTramNetwork, flatTramGrade } from '../../game/src/tram-path.js';

const input = process.argv[2] || new URL('../../game/data/bucharest-romana.json', import.meta.url);
const bytes = fs.readFileSync(input), parsed = JSON.parse(bytes), data = parsed.data || parsed, coreEdges = parsed.allEdges || [];
const before = JSON.stringify(data), nativeBefore = JSON.stringify(coreEdges), output = buildTramTunnelGrades(data, { coreEdges });
assert.deepEqual(output.report.unresolved, []); assert.equal(output.report.models.length, 1); assert.equal(output.grades.size, 30);
const resolveGrade = (way, leg) => output.grades.get(way.sourceId + ':' + leg.index) || flatTramGrade(way);
const network = buildTramNetwork(data, { resolveGrade });
assert.deepEqual(network.report.unresolved, []); assert.equal(network.report.modeledSegments, network.report.admittedSegments);
assert.equal(network.edges.filter(e => e.tunnel).length, 7);
assert.equal(network.edges.filter(e => e.sourceId === 'w243476552').length, 2, 'level-only source approach is modeled');
for (const p of output.report.models[0].paths) {
    assert.ok(p.peakGrade < .05 && p.peakGrade <= .08); assert.ok(p.anchors.every(a => a.modelY === 0));
    assert.equal(network.bySourceNode.get(String(p.stationNode)).y, -7.6);
}
const sourceWays = new Map(data.tramSourceWays.map(w => [w.sourceId, w]));
let samples = 0, maxSlope = 0, roofLength = 0;
for (const edge of network.allEdges) {
    const grade = output.grades.get(edge.sourceId + ':' + edge.sourceSegment); if (!grade) continue;
    assert.deepEqual(edge.sourceNodeIds, sourceWays.get(edge.sourceId).nodeIds.slice(edge.sourceSegment, edge.sourceSegment + 2));
    assert.equal(grade.ya, grade.heightAt(0)); assert.equal(grade.yb, grade.heightAt(1));
    for (let i = 0; i <= 1000; i++) {
        const t = i / 1000, h = grade.heightAt(t); assert.ok(h >= -7.6 - 1e-9 && h <= 1e-9);
        if (i) maxSlope = Math.max(maxSlope, Math.abs(h - grade.heightAt((i - 1) / 1000)) * 1000 / edge.len);
        samples++;
    }
    for (const knot of grade.breaks) {
        const dt = Math.min(.00001, knot / 2, (1 - knot) / 2), left = (grade.heightAt(knot) - grade.heightAt(knot - dt)) / (edge.len * dt), right = (grade.heightAt(knot + dt) - grade.heightAt(knot)) / (edge.len * dt);
        assert.ok(Math.abs(left - right) < 1e-5, 'grade is C1 at every model/render knot');
    }
    for (const [t0, t1] of grade.roof.intervals) {
        assert.ok(edge.tunnel); assert.ok(t0 >= 0 && t1 <= 1 && t1 > t0);
        for (const t of [t0, (t0 + t1) / 2, t1]) assert.ok(Math.abs(grade.heightAt(t) + 7.6) < 1e-8);
        // This is a flat-section dimensional control, not actual posed-body QA.
        assert.ok(grade.roof.bottomM - (.24 - 7.6 + 5.789999961853027) > 1.26);
        roofLength += (t1 - t0) * edge.len;
    }
}
assert.ok(maxSlope < .05); assert.ok(Math.abs(roofLength - 120) < 1e-7);
assert.ok(network.edges.filter(e => e.tunnel).some(e => Math.abs(e.ya - e.yb) > .1), 'source tunnel endpoint is not forced onto a flat deck');
assert.equal(network.bySourceNode.get('296077845').y, 0); assert.equal(network.bySourceNode.get('8544117714').y, 0);
assert.equal(smoothTunnelRamp(90, 7.6), null, 'literal short source lengths must fail the cap');
assert.equal(buildTramTunnelGrades({ tramSources: [] }).grades.size, 0);
const reject = (mutate, reason) => {
    const changed = structuredClone(data); mutate(changed);
    const rejected = buildTramTunnelGrades(changed, { coreEdges }); assert.equal(rejected.grades.size, 0); assert.ok(rejected.report.unresolved.some(r => r.reason === reason));
};
reject(d => d.tramSourceWays.find(w => w.sourceId === 'w241374326').nodeIds[0] = 123, 'incomplete-literal-source-node-path');
reject(d => d.tramSourceWays.find(w => w.sourceId === 'w40503646').tags.level = '-1', 'source-ground-join-or-underground-stop-unconfirmed');
reject(d => d.tramSourceWays.find(w => w.sourceId === 'w241374326').tags.ele = '60', 'missing-or-changed-source-tram-path');
reject(d => d.tramSourceNodeTags[8544117694].ele = '60', 'missing-or-changed-source-tram-path');
reject(d => delete d.tramSourceNodeTags[8544117694].public_transport, 'source-ground-join-or-underground-stop-unconfirmed');
reject(d => d.tramSourceWays.push({ ...structuredClone(d.tramSourceWays.find(w => w.sourceId === 'w241374326')), sourceId: 'w-test-new-ground-revenue-branch' }), 'unmodeled-revenue-branch-at-depressed-source-node');
const conflict = buildTramTunnelGrades(data, { coreEdges: [{ a: { sourceId: 8544117695, y: 0 }, b: { sourceId: -1, y: 0 } }] });
assert.equal(conflict.grades.size, 0); assert.ok(conflict.report.unresolved.some(r => r.reason === 'conflicting-identical-source-motor-node-height'));
assert.equal(JSON.stringify(data), before); assert.equal(JSON.stringify(coreEdges), nativeBefore);
console.log(JSON.stringify({ passed: true, scope: 'pure source topology/C1/dimensional controls; actual posed fleet, native geometry, support and road/slab clearance remain separate gates', inputSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    model: ROMANA_TRAM_TUNNEL_MODEL.id, grades: output.grades.size, modeledSegments: network.report.modeledSegments, admittedSegments: network.report.admittedSegments, samples, maxSlope, modeledRoofLengthM: roofLength, report: output.report }, null, 2));
