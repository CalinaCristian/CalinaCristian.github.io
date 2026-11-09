import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { MeshBuilder } from '../src/geobuild.js';
import { buildRailRoadsideClearance } from '../src/rail-roadside.js';
import { buildTramGrades } from '../src/tram-grade.js';
import { buildTramTunnelGrades } from '../src/tram-tunnel-grade.js';
import { triangleContact } from '../../handoffs/fidelity/independent-rail-body-observer/body-checks.js';
const proof = new URL('../../handoffs/fidelity/rail-roadside-clearance/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('native-contacts.json.gz', proof))));
const inputs = JSON.parse(gunzipSync(readFileSync(new URL('grade-inputs.json.gz', proof))));
const envelope = { halfWidthM: 1.2230000495910645, minY: .008273792453110218, maxY: 5.789999961853027 };
const triangulate = fs => fs.flatMap(p => p.slice(1, -1).map((v, i) => [p[0].slice(0, 3), v.slice(0, 3), p[i + 2].slice(0, 3)]));
const lane = (e, wL = e.wL, wR = e.wR) => [[e.a.x + e.nx * wR, e.a.z + e.nz * wR], [e.b.x + e.nx * wR, e.b.z + e.nz * wR], [e.b.x - e.nx * wL, e.b.z - e.nz * wL], [e.a.x - e.nx * wL, e.a.z - e.nz * wL]];
const summary = [];
const nativeTriangles = m => { const ts = []; for (let i = 0; i < m.ic; i += 3) ts.push([0, 1, 2].map(k => Array.from(m.p.subarray(m.i[i + k] * 3, m.i[i + k] * 3 + 3)))); return ts; };
const addTriangle = (m, tri) => { const ids = tri.map(p => m.v(...p, 0, 1, 0, p[0], p[2], [120, 130, 140])); m.tri(...ids); };
for (const row of fixture.rows) {
    const { data, edges } = inputs[row.district], tunnel = buildTramTunnelGrades(data, { coreEdges: edges });
    const grades = buildTramGrades(data, { coreEdges: edges, extraGrades: tunnel.grades, extraReport: tunnel.report });
    const C = buildRailRoadsideClearance(grades, envelope);
    const owners = row.actorId === 259 ? edges.filter(e => e.id >= 1255 && e.id <= 1259) : edges.filter(e => e.road === 203);
    for (const e of owners) C.register(e, lane(e), lane(e, e.wL + 5, e.wR + 5));
    let before = 0, after = 0; const byWorld = new Map(), changes = [];
    for (const w of row.worldTriangles) {
        const candidates = owners.map(e => ({ e, ts: w.vertices.map(p => ((p[0] - e.a.x) * e.dirx + (p[2] - e.a.z) * e.dirz) / e.len) }));
        candidates.sort((a, b) => Math.max(0, -Math.min(...a.ts), Math.max(...a.ts) - 1) - Math.max(0, -Math.min(...b.ts), Math.max(...b.ts) - 1));
        const e = candidates[0].e, fs = C.fragments(w.vertices, e), triangles = triangulate(fs);
        const mb = new MeshBuilder(); addTriangle(mb, w.vertices); C.apply(mb, 0, e); const serialized = nativeTriangles(mb);
        assert.ok(Math.min(...candidates[0].ts) > -1e-4 && Math.max(...candidates[0].ts) < 1 + 1e-4, 'native primitive lies inside its attributed source edge');
        byWorld.set(w.meshUuid + ':' + w.nativeTriangle, serialized);
        changes.push({ mesh: w.meshName, triangle: w.nativeTriangle, edge: e.id, output: triangles.length });
    }
    for (const c of row.contacts) {
        const w = row.worldTriangles.find(w => w.meshUuid === c.meshUuid && w.nativeTriangle === c.nativeTriangle), b = row.bodyTriangles.find(b => b.triangle === c.bodyTriangle).vertices;
        if (triangleContact(b, w.vertices)) before++;
        for (const f of byWorld.get(c.meshUuid + ':' + c.nativeTriangle)) if (triangleContact(b, f)) { after++; if (process.env.DEBUG_ROADSIDE) console.error(JSON.stringify({ actor: row.actorId, c, output: f, hit: triangleContact(b, f) })); }
    }
    assert.equal(before, row.expectedNativePairs); assert.equal(after, 0, row.actorId + ' remaining native-derived contacts');
    const p = row.contacts[0].point, e = owners.find(e => e.id === (row.actorId === 259 ? 1255 : 677));
    assert.equal(C.surface(e, p[0], p[2], p[1]), row.actorId === 259 ? null : .24);
    let caps = 0;
    if (row.actorId === 259) for (const edge of owners) {
        const mb = new MeshBuilder(), at = (x, z) => edge.ya + (edge.yb - edge.ya) * Math.max(0, Math.min(1, ((x - edge.a.x) * edge.dirx + (z - edge.a.z) * edge.dirz) / edge.len));
        const walls = C.caps(mb, edge, lane(edge, 4.45, 4.45), (x, z) => { const y = at(x, z); return y + .24 - Math.min(1.1, Math.max(.05, y)); }, (x, z) => at(x, z) + .24, [120, 130, 140]);
        const ts = nativeTriangles(mb); caps += ts.length; assert.equal(ts.length, walls.length * 2);
        for (const t of ts) for (const b of row.bodyTriangles) assert.equal(triangleContact(b.vertices, t), null, 'new Float32 fascia cap is clear of actual body');
    }
    summary.push({ capTriangles: caps, actorId: row.actorId, nativeBefore: before, compiledAfter: after, primitives: changes, sourceCorridors: C.report.sourceCorridors });
}
// Generic guards: exact protected lanes, literal dimensions, vertical separation,
// unknown rail grade, absence of arbitrary padding, and retained flush paving.
const e = { id: 1, a: { x: 0, z: 0 }, b: { x: 0, z: 10 }, dirx: 0, dirz: 1, nx: -1, nz: 0, len: 10, wL: 3.5, wR: 3.5, ya: 1, yb: 1, bridge: true, access: { sourceId: 'w-test' } };
const corridor = { a: [4, 0], b: [4, 10], heightAt: () => 0, maxGrade: 0, gaugeM: 1.435, groundLevel: true, sourceId: 'rail-test' };
const create = (edge = e, cs = [corridor]) => { const C = buildRailRoadsideClearance({ corridors: cs }, envelope); C.register(edge, lane(edge), lane(edge, 5, 5)); return C; };
const tri = [[-3.4, 1.24, 2], [-3.4, 1.24, 8], [-3.49, 1.24, 5]], C = create();
assert.deepEqual(C.fragments(tri, e), [tri], 'all lane pavement retained');
assert.deepEqual(create({ ...e, roadWidthSource: { source: 'OSM width' } }).fragments(tri, e), [tri]);
const mapped = { ...e, roadWidthSource: { source: 'OSM width' } }, M = create(mapped);
const outside = [[3.7, 1.24, 2], [4.2, 1.24, 8], [4.8, 1.24, 5]];
assert.deepEqual(M.fragments(outside, mapped), [outside]);
const high = outside.map(p => [p[0], 11.24, p[2]]); assert.deepEqual(C.fragments(high, e), [high]);
assert.deepEqual(create(e, []).fragments(outside, e), [outside]);
const nearMiss = [[5.224, 1, 2], [5.3, 1, 8], [5.5, 1, 5]]; assert.deepEqual(C.fragments(nearMiss, e), [nearMiss]);
const flat = { ...e, bridge: false, ya: 0, yb: 0 }, F = create(flat);
const paving = outside.map(p => [p[0], .37, p[2]]), lowered = F.fragments(paving, flat);
assert.ok(lowered.length && triangulate(lowered).flat(1).every(p => p[1] <= .24), 'paving retained at flush level');
assert.equal(F.surface(flat, 4, 4, .37), .24); assert.equal(F.surface(flat, 5.3, 4, .37), .37);
const mitered = [[-3.5, 0], [-3.5, 10], [4.5, 10], [3.5, 0]], guarded = create();
guarded.register(e, mitered, lane(e, 5, 5));
const miterFace = [[3.8, 1.24, 8], [4.1, 1.24, 8], [4, 1.24, 9]];
assert.deepEqual(guarded.fragments(miterFace, e), [miterFace], 'exact mitred lane extent retained');
const mb = new MeshBuilder(); addTriangle(mb, tri); const prefix = Array.from(mb.i.subarray(0, mb.ic)), positions = Array.from(mb.p.subarray(0, mb.vc * 3));
const start = mb.ic; addTriangle(mb, outside); C.apply(mb, start, e);
assert.deepEqual(Array.from(mb.i.subarray(0, start)), prefix); assert.deepEqual(Array.from(mb.p.subarray(0, positions.length)), positions);
assert.ok(C.report.maxSerializationOutsetM > 0 && C.report.maxSerializationOutsetM < .00001, 'format rounding bound, no physical padding');
console.log(JSON.stringify({ passed: true, nativeReplays: summary, controls: ['lane-pavement','literal-dimensions','vertical-separation','unknown-grade','near-miss','flush-paving-and-query','mitred-lane-pavement','primitive-range-prefix','calculated-float32-outward-rounding'] }, null, 2));
