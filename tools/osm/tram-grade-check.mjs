// Pure/native-fixture controls; no browser, scene construction or actor updates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildTramGrades, smoothTramRamp, tramDeckBand } from '../../game/src/tram-grade.js';
import { buildTramNetwork } from '../../game/src/tram-path.js';

const input = process.argv[2];
if (!input) throw new Error('Pass the immutable QA native-support.json fixture');
const bytes = fs.readFileSync(input), native = JSON.parse(bytes), dataBefore = JSON.stringify(native.data), edgesBefore = JSON.stringify(native.allEdges);
const models = buildTramGrades(native.data, { coreEdges: native.allEdges });
assert.equal(models.report.models.length, 2); assert.deepEqual(models.report.unresolved, []);
const nodes = [...new Map(native.allEdges.flatMap(e => [e.a, e.b]).map(n => [n.id, n])).values()];
const network = buildTramNetwork(native.data, { motorNodes: nodes, resolveGrade: models.resolveGrade });
assert.equal(network.report.modeledSegments, 211); assert.equal(network.report.admittedSegments, 211); assert.deepEqual(network.report.unresolved, []);
assert.equal(network.edges.filter(e => e.bridge).length, 54);
let samples = 0, maxSlope = 0, maxChordErrorM = 0;
for (const edge of network.edges) {
    if (!edge.grade.modelId) continue;
    for (let i = 0; i <= 1000; i++) {
        const t = i / 1000, h = edge.grade.heightAt(t); assert.ok(Number.isFinite(h));
        if (i) maxSlope = Math.max(maxSlope, Math.abs(h - edge.grade.heightAt((i - 1) / 1000)) * 1000 / edge.len);
        if (edge.sourceId === 'w128304859' || edge.sourceId === 'w660918286') assert.equal(h, 0);
        samples++;
    }
    const a = [edge.a.x, edge.a.z], b = [edge.b.x, edge.b.z], band = tramDeckBand(a, b, edge.grade);
    for (const t of [0, .25, .5, .75, 1]) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = .2 + edge.grade.heightAt(t);
        assert.ok(Math.abs(band(x, z).top - y) < 1e-8); assert.ok(Math.abs(band(x, z).bottom - y + .4) < 1e-8);
        assert.ok(band(x, z, 1.2).top >= y - 1e-9); assert.ok(band(x, z, 1.2).bottom <= y - .4 + 1e-9);
    }
    const fractions = new Set([0, 1, ...edge.grade.breaks]);
    const step = Math.abs(edge.ya - edge.yb) > 1e-8 || edge.grade.breaks.length ? 1.5 : 10, count = Math.ceil(edge.len / step);
    for (let i = 1; i < count; i++) fractions.add(i / count);
    const ts = [...fractions].sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
        const a = ts[i - 1], b = ts[i], m = (a + b) / 2;
        maxChordErrorM = Math.max(maxChordErrorM, Math.abs(edge.grade.heightAt(m) - (edge.grade.heightAt(a) + edge.grade.heightAt(b)) / 2));
    }
}
assert.ok(maxSlope <= .08 + 1e-7); assert.ok(maxChordErrorM < .002);
assert.equal(network.nodes.find(n => n.sourceId === 981543139).y, 0);
assert.equal(network.nodes.find(n => n.sourceId === 6187776680).y, 0);
assert.equal(smoothTramRamp(95, 11), null, 'infeasible C1 source ramp must be refused');
for (const length of [95.4637320786839, 96.72973671746844]) {
    const r = smoothTramRamp(length, 6); assert.ok(r); assert.equal(r.at(0), 0); assert.equal(r.at(length), 6);
    assert.ok(r.at(.0001) / .0001 < 1e-6); assert.ok((6 - r.at(length - .0001)) / .0001 < 1e-6);
    for (const knot of [r.easeM, length - r.easeM]) {
        const a = (r.at(knot) - r.at(knot - .0001)) / .0001, b = (r.at(knot + .0001) - r.at(knot)) / .0001;
        assert.ok(Math.abs(a - b) < 1e-6);
    }
}
const badStation = structuredClone(native.allEdges); for (const e of badStation) if (e.sourceId === 'w668700429') e.ya = e.yb = 4;
const rejected = buildTramGrades(native.data, { coreEdges: badStation });
assert.ok(rejected.report.unresolved.some(r => r.reason === 'common-source-cable-station-profile-unconfirmed'));
assert.equal(rejected.resolveGrade({ sourceId: 'w118416425' }, { index: 0 }), null);
const badGround = structuredClone(native.data); for (const s of Object.values(badGround.scenerySourceGeometry)) if (s.sourceId === 'w23554680') s.tags.layer = '1';
assert.ok(buildTramGrades(badGround, { coreEdges: native.allEdges }).report.unresolved.some(r => r.reason === 'source-ground-anchor-or-smooth-grade-cap-unresolved'));
const sourceMetric = structuredClone(native.data); sourceMetric.tramSourceWays.find(w => w.sourceId === 'w118416425').tags.ele = '90';
assert.ok(buildTramGrades(sourceMetric, { coreEdges: native.allEdges }).report.unresolved.some(r => r.reason === 'missing-or-changed-source-bridge'));
assert.equal(JSON.stringify(native.data), dataBefore); assert.equal(JSON.stringify(native.allEdges), edgesBefore);
console.log(JSON.stringify({ passed: true, scope: 'CPU source continuity/model controls only; actual-body geometry clearance is a separate retained failing proof',
    nativeSourceCommit: native.sourceCommit, nativeExportSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    modeledSegments: 211, bridgeSegments: 54, samples, maxSlope, maxChordErrorM, models: models.report.models }, null, 2));
