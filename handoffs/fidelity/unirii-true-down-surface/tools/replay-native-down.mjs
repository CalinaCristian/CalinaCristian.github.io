import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { MeshBuilder, rgb } from '../../../../game/src/geobuild.js';
import { underpassRoofModel, underpassRoofFaces, underpassRoofCollider } from '../../../../game/src/underpass-roof.js';
import { buildUnderpassOwnerIndex } from '../../../../game/src/underpass-ground-owner.js';
import { fixture, edges, nativeWidth, nativePoint } from '../../../../game/dev/underpass-roof-native.mjs';
const root = new URL('../', import.meta.url), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const overheadBytes = fs.readFileSync(new URL('native-overhead-fixture.json.gz', root)), overhead = JSON.parse(zlib.gunzipSync(overheadBytes));
const surfaces = overhead.meshes.map(row => {
    const mesh = new MeshBuilder();
    for (const t of row.triangles) mesh.face3(...t.vertices, [120, 120, 120], [0, 1, 0]);
    return { mesh, id: `${row.name} nativeObject${row.objectId}`, water: row.water };
});
const owners = buildUnderpassOwnerIndex(surfaces, { fallbackM: -.3 });
const data = JSON.parse(fs.readFileSync(new URL('../../../../game/data/bucharest-unirii.json', import.meta.url)));
const oldBlock = fs.readFileSync(new URL('baseline-down-block.js.txt', root), 'utf8');
const worldBytes = fs.readFileSync(new URL('../../../../game/src/world.js', import.meta.url)), source = worldBytes.toString();
const start = source.indexOf('        if (down) {'), end = source.indexOf('    // raised junction corners', start);
let block = source.slice(start, end).trimEnd(); block = block.slice(0, block.lastIndexOf('\n    }'));
const args = ['down', 'c', 'sb', 'e', 'wr', 'wl', 'P', 'Pm', 'yA', 'yB', 'conc', 'dark', 'Y', 'sideCol', 'rgb', 'clamp', 'data', 'underpassOwners',
    'underpassRoofModel', 'underpassRoofFaces', 'underpassRoofCollider', 'underpassRoofAudit', 'underpassColl', 'underpassCover'];
const before = new Function(...args, oldBlock), after = new Function(...args, block);
const audit = [], colliders = [], cover = new MeshBuilder(), counts = { beforeSolid: 0, beforeLid: 0, afterSolid: 0 };
const originalEdges = JSON.stringify(fixture.edges);
for (const e of edges.filter(e => [12, 13, 213].includes(e.road))) {
    const pointAt = nativePoint(e), Pm = (end, o, y) => pointAt(end, o, y), P = (s, o, y) => [e.a.x + e.dirx * s + e.nx * o, y, e.a.z + e.dirz * s + e.nz * o];
    for (const [run, next] of [[before, false], [after, true]]) {
        const c = { solid: new MeshBuilder(true), ground: new MeshBuilder() }, sb = c.solid;
        run(true, c, sb, e, nativeWidth(e, 1), nativeWidth(e, -1), P, Pm, e.ya + .24, e.yb + .24, rgb('#a9a69e'), rgb('#55524d'), { road: .24 }, rgb('#b6b1aa'), rgb,
            (v, a, b) => Math.max(a, Math.min(b, v)), data, owners, underpassRoofModel, underpassRoofFaces, underpassRoofCollider, audit, colliders, cover);
        if (next) counts.afterSolid += sb.ic / 3;
        else { counts.beforeSolid += sb.ic / 3; counts.beforeLid += c.ground.ic / 3; }
    }
}
assert.equal(audit.length, 112); assert.equal(JSON.stringify(fixture.edges), originalEdges);
const negativeControls = [];
for (const [label, changes, owner] of [
    ['ordinary-sunken-road', { tunnel: false, lidded: false }, owners],
    ['open-tunnel-ramp', { lidded: false, ya: -1, yb: -3 }, owners],
    ['reviewed-source-canopy', { coveredRoadModel: {}, lidded: false }, owners],
    ['unresolved-raw-water', {}, { forPolygon: () => ({ known: false, reason: 'retained-water-topology-unresolved' }) }],
]) {
    const e = { ...edges.find(e => e.id === 39), ...changes }, pointAt = nativePoint(e), Pm = (end, o, y) => pointAt(end, o, y),
        P = (s, o, y) => [e.a.x + e.dirx * s + e.nx * o, y, e.a.z + e.dirz * s + e.nz * o];
    const results = [];
    for (const run of [before, after]) {
        const c = { solid: new MeshBuilder(true), ground: new MeshBuilder() }, localAudit = [], localColliders = [], localCover = new MeshBuilder();
        run(true, c, c.solid, e, nativeWidth(e, 1), nativeWidth(e, -1), P, Pm, e.ya + .24, e.yb + .24, rgb('#a9a69e'), rgb('#55524d'), { road: .24 }, rgb('#b6b1aa'), rgb,
            (v, a, b) => Math.max(a, Math.min(b, v)), data, owner, underpassRoofModel, underpassRoofFaces, underpassRoofCollider, localAudit, localColliders, localCover);
        const serialize = mb => JSON.stringify(Object.fromEntries(['p', 'n', 'u', 'c', 't', 'i'].map(key => [key, Array.from(mb[key]?.subarray(0, key === 'i' ? mb.ic : mb.vc * (key === 'u' ? 2 : key === 't' ? 1 : 3)) || [])])));
        results.push({ solid: serialize(c.solid), ground: serialize(c.ground), masks: localCover.ic, colliders: localColliders.length, known: localAudit.some(r => r.known) });
    }
    assert.deepEqual(results[1], results[0]); negativeControls.push({ name: label, exactFloat32SolidAndGroundParity: true, newMasks: 0, newColliders: 0 });
}
const records = audit.map(({ edge, ...row }) => ({ edgeId: edge.id, ...row }));
const corrected = [], unresolvedWitnesses = [];
for (const witness of fixture.inversionWitnesses) {
    const record = records.find(r => r.edgeId === witness.edgeId), edge = edges.find(e => e.id === witness.edgeId);
    if (!record.known) { unresolvedWitnesses.push({ edgeId: edge.id, u: witness.u, reason: record.reason }); continue; }
    const model = underpassRoofModel(edge, { sourceTags: edge.sourceTags, topM: record.topM });
    const ceiling = model.ceilingAt(witness.u), floor = model.floorAt(witness.u);
    assert.ok(record.topM - ceiling >= .25 - 1e-12); assert.ok(ceiling - floor >= 3.5);
    corrected.push({ edgeId: edge.id, u: witness.u, lateralM: witness.lateralM, oldCeiling: witness.ceiling[0].y, oldLid: witness.lids[0].y,
        newCeiling: ceiling, newRoofTop: record.topM, slabM: record.topM - ceiling, modeledOpeningM: ceiling - floor, legalMaxheightM: 3.5 });
}
const result = { source: 'CPU candidate using actual historical native395 geometry; not a fresh native world', runtimeWorldSHA256: sha(worldBytes),
    literalProductionDownBlockSHA256: sha(block), baselineBlockSHA256: sha(oldBlock), historicalNativeSource: fixture.source, actualOverheadGzipSHA256: sha(overheadBytes),
    scope: 'Literal current production DOWN branch evaluated against native endpoint geometry/retained overhead skins. No source road profiles/IDs/tags are mutated. Private water-big retained topology remains a named gap, so this is not all-world ground/water acceptance.',
    ownerIndex: owners.report, counts: { ...counts, afterDepthOnlyRoof: cover.ic / 3, colliders: colliders.length },
    nativeEdgeCount: records.length, knownModels: records.filter(r => r.known).length, unresolved: records.filter(r => !r.known), negativeControls, correctedActualInversionWitnesses: corrected,
    unresolvedActualWitnesses: unresolvedWitnesses, models: records, currentNativeAcceptance: false };
const out = process.argv[2]; if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, models: undefined, correctedActualInversionWitnesses: corrected.length, unresolved: result.unresolved.map(r => ({ edgeId: r.edgeId, reason: r.reason })) }, null, 2));
