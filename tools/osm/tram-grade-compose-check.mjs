import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildTramGrades } from '../../game/src/tram-grade.js';
import { buildTramTunnelGrades } from '../../game/src/tram-tunnel-grade.js';
import { buildTramNetwork } from '../../game/src/tram-path.js';
import { uncoveredTramTrenchWall, buildTramTrenchCutter } from '../../game/src/tram-trench.js';
const bytes = fs.readFileSync(process.argv[2]), native = JSON.parse(bytes), tunnel = buildTramTunnelGrades(native.data, { coreEdges: native.allEdges });
const model = buildTramGrades(native.data, { coreEdges: native.allEdges, extraGrades: tunnel.grades, extraReport: tunnel.report });
assert.deepEqual(model.report.unresolved, []);
const network = buildTramNetwork(native.data, { resolveGrade: model.resolveGrade }); assert.deepEqual(network.report.unresolved, []);
let maxSerializedErrorM = 0, wallCandidates = 0, outerWallIntervals = 0, roofPieces = 0;
for (const p of model.support.pieces) {
    for (const u of [.137, .379, .793]) {
        const [a, b, c] = p.topProfile.coefficients, x = p.a[0] + (p.b[0] - p.a[0]) * u, z = p.a[1] + (p.b[1] - p.a[1]) * u;
        maxSerializedErrorM = Math.max(maxSerializedErrorM, Math.abs((a * u + b) * u + c - p.band(x, z).top));
    }
    if (p.roof) roofPieces++;
    for (const [a, b, sign] of [[0, 1, 1], [2, 3, -1]]) {
        wallCandidates++; outerWallIntervals += uncoveredTramTrenchWall(p.top[a], p.top[b], [p.nx * sign, p.nz * sign], model.support, p.modelId).length;
    }
}
assert.ok(maxSerializedErrorM < 1e-8);
assert.equal(new Set(model.support.pieces.map(p => p.id)).size, model.support.pieces.length);
console.log(JSON.stringify({ passed: true, scope: 'shared model/source continuity/serialized continuous profiles/union-wall count; actual emitted geometry clearance remains separate',
    nativeFixtureSha256: crypto.createHash('sha256').update(bytes).digest('hex'), admittedSegments: network.report.admittedSegments,
    modeledSourceLegs: tunnel.grades.size, supportPieces: model.support.pieces.length, roofPieces, maxSerializedErrorM, wallCandidates, outerWallIntervals,
    trench: buildTramTrenchCutter(model.support).report }, null, 2));
