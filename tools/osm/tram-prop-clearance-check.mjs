import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { buildTramGrades } from '../../game/src/tram-grade.js';
import { emittedTramClearance } from '../../game/src/tram-clearance.js';
import { sourceSidewalkSides } from '../../game/src/sidewalk-source.js';
import { buildTramTunnelGrades } from '../../game/src/tram-tunnel-grade.js';
const root = process.argv[2], nativePath = process.argv[3];
const { makeVehicle } = await import(pathToFileURL(root + '/game/src/vehicles.js'));
const envelope = emittedTramClearance(makeVehicle);
assert.ok(Math.abs(envelope.halfWidthM - 1.2230000495910645) < 1e-10);
assert.ok(Math.abs(envelope.minY - .008273792453110218) < 1e-10);
assert.ok(Math.abs(envelope.maxY - 5.789999961853027) < 1e-10);
const tiny = { q: 10, trams: [[0, 0, 1000, 0]], tramSources: [{ sourceId: 'w1', nodeIds: [1, 2] }], tramSourceWays: [{ sourceId: 'w1', nodeIds: [1, 2], points: [0, 0, 1000, 0], tags: { railway: 'tram', gauge: '1435' } }] };
const g = buildTramGrades(tiny, { models: [] }), opts = { inferred: true, bodyEnvelope: envelope, radiusM: .15, y0a: 0, y1a: 3 };
assert.equal(g.excludesInferredObstacle([20, envelope.halfWidthM + .149], [30, envelope.halfWidthM + .149], opts), true);
assert.equal(g.excludesInferredObstacle([20, envelope.halfWidthM + .151], [30, envelope.halfWidthM + .151], opts), false, 'literal visual near-miss remains; no .5m clearance padding');
assert.equal(g.excludesInferredObstacle([20, 0], [30, 0], { ...opts, inferred: false }), false, 'mapped source objects are never excluded');
assert.equal(g.excludesInferredObstacle([20, 0], [30, 0], { ...opts, y0a: 9, y1a: 12 }), false, 'upper physical object remains above ground rail');
const raw = fs.readFileSync(nativePath), native = JSON.parse(nativePath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw), before = JSON.stringify(native.data), grades = buildTramGrades(native.data, { coreEdges: native.allEdges });
const lamp = native.colliders[20190]; assert.equal(lamp.kind, 'lamp'); assert.equal(native.data.lamps.length, 0);
assert.equal(grades.excludesInferredObstacle([lamp.x, lamp.z], [lamp.x, lamp.z], { ...opts, radiusM: .18, y0a: .15, y1a: 8.15 }), true);
for (const i of [27611, 27612]) {
    const w = native.colliders[i]; assert.equal(w.kind, 'barrier');
    assert.equal(grades.excludesInferredObstacle([w.ax, w.az], [w.bx, w.bz], { ...opts, y0a: w.y0a, y0b: w.y0b, y1a: w.y1a + .45, y1b: w.y1b + .45 }), true);
}
const sidewalks = [74, 133].map(id => { const edge = native.allEdges.find(e => e.id === id), p = sourceSidewalkSides(native.data, edge); assert.equal(p.leftM, 0); assert.equal(p.rightM, 3.5); return { edge: id, ...p }; });
assert.equal(JSON.stringify(native.data), before, 'source arrays remain unchanged');
let romana = null;
if (process.argv[4]) {
    const n = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))), tunnel = buildTramTunnelGrades(n.data, { coreEdges: n.allEdges }), m = buildTramGrades(n.data, { coreEdges: n.allEdges, extraGrades: tunnel.grades, extraReport: tunnel.report });
    const lamp = n.colliders[25695]; assert.equal(lamp.kind, 'lamp'); assert.equal(n.data.lamps.length, 0);
    assert.equal(m.excludesInferredObstacle([lamp.x, lamp.z], [lamp.x, lamp.z], { ...opts, radiusM: .18, y0a: .15, y1a: 8.15 }), true);
    romana = { lamp, exclusions: m.report.inferredObstacleExclusions };
}
console.log(JSON.stringify({ passed: true, scope: 'literal emitted fleet bounds and native54 causal source/prop controls; regenerated native geometry and admission remain separate', envelope, sidewalks,
    exclusions: grades.report.inferredObstacleExclusions, romana }, null, 2));
