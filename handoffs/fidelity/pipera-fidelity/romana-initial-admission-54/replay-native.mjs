// CPU copies of exact native constructor facts. No browser or live placement.
// node replay-native.mjs EXACT54_ROOT WORLD.json.gz FACTS.json.gz OUTPUT.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { admitInitialTraffic as candidateAdmission } from '../../../../game/src/initial-traffic-admission.js';
import { ordinarySourceSpan } from '../../../../game/src/initial-ordinary-source-span.js';
const [root, worldFile, factsFile, output] = process.argv.slice(2);
if (!output) throw Error('EXACT54_ROOT WORLD.json.gz FACTS.json.gz OUTPUT.json');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
// Taxi roof-sign texture painting needs a canvas in Node; no texture pixels,
// renderer or text measurement affect primary emitted physical model vertices.
globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    return { getContext(type) { assert.equal(type, '2d'); return new Proxy({}, { get(_o, k) { return k === 'measureText' ? text => ({ width: text.length * 10 }) : () => {}; } }); } };
} };
const imp = p => import(pathToFileURL(path.join(root, p)));
const [{ Traffic }, { makeVehicle, VEHICLE_KINDS, vehicleSize }, { SharedLaneGate }, { admitInitialTraffic: legacyAdmission }, { collideBuildings }, { vehicleVerticalInterval }] = await Promise.all([
    imp('game/src/traffic.js'), imp('game/src/vehicles.js'), imp('game/src/shared-lanes.js'), imp('game/src/initial-traffic-admission.js'), imp('game/src/world.js'), imp('game/src/initial-vehicle-admission.js'),
]);
const worldBytes = zlib.gunzipSync(fs.readFileSync(worldFile)), factBytes = zlib.gunzipSync(fs.readFileSync(factsFile));
const raw = JSON.parse(worldBytes), facts = JSON.parse(factBytes), snapshot = facts.snapshots[2], recorded = facts.snapshots[3].initialAdmission;
// Each exported collider property has its own safe() reference root. Never
// evaluate function text or pretend diagnostic closure code is executable.
function revive(rawValue) {
    const paths = new Map();
    function read(value, name = '$') {
        if (!value || typeof value !== 'object') return value;
        if (value.$undefined) return undefined;
        if (value.$number) return Number(value.$number);
        if (value.$ref) { assert(paths.has(value.$ref), 'Unresolved local reference ' + value.$ref); return paths.get(value.$ref); }
        if (value.$function) return () => { throw Error('Unknown captured native collider closure; no CPU clearance claimed'); };
        const result = Array.isArray(value) ? [] : {}; paths.set(name, result);
        for (const [k, v] of Object.entries(value)) result[k] = read(v, name + '.' + k);
        return result;
    }
    return read(rawValue);
}
const capturedEdges = [...raw.allEdges, ...(snapshot.tramNetwork?.edges || [])];
const edgeMap = new Map(capturedEdges.map(e => [e.id, { ...e }])), nodes = new Map();
for (const n of [...raw.graphNodes, ...capturedEdges.flatMap(e => [e.a, e.b])]) if (!nodes.has(n.id)) nodes.set(n.id, { ...n });
for (const e of edgeMap.values()) { e.a = nodes.get(e.a.id); e.b = nodes.get(e.b.id); }
// Native buildTramNetwork defines lanesF/B directly from railDirections. The
// exported scalar lane counts therefore reconstruct that omitted array exactly.
for (const e of edgeMap.values()) if (e.rail) e.railDirections = [...(e.lanesF ? [1] : []), ...(e.lanesB ? [-1] : [])];
// Exported nodeRef.edgeIds records native allEdges when present. World line5817
// forms actual motor .edges by the exact order-preserving drivable filter.
for (const n of nodes.values()) n.edges = n.edgeIds.map(id => edgeMap.get(id)).filter(e => e && (e.rail || e.drivable));
const graph = { nodes: raw.graphNodes.map(n => nodes.get(n.id)), edges: raw.graphEdgeIds.map(id => edgeMap.get(id)) };
const ribbons = raw.ribbons.map(r => ({ ...r, e: r.edge ? edgeMap.get(r.edge.id) : undefined, poly: revive(r.poly), holes: revive(r.holes) }));
const colliders = raw.colliders.map(c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'edge' ? edgeMap.get(v?.id) : k === 'node' ? nodes.get(v?.id) : revive(v)])));
function bounds(c) {
    if (c.poly?.length) return [Math.min(...c.poly.map(p => p[0])), Math.min(...c.poly.map(p => p[1])), Math.max(...c.poly.map(p => p[0])), Math.max(...c.poly.map(p => p[1]))];
    if (c.wall) return [Math.min(c.ax, c.bx), Math.min(c.az, c.bz), Math.max(c.ax, c.bx), Math.max(c.az, c.bz)];
    return [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
}
const boxed = colliders.map(c => ({ c, box: bounds(c) })), cellSize = 24, cells = new Map();
for (const row of boxed) for (let x = Math.floor(row.box[0] / cellSize); x <= Math.floor(row.box[2] / cellSize); x++) for (let z = Math.floor(row.box[1] / cellSize); z <= Math.floor(row.box[3] / cellSize); z++) {
    const key = x + ',' + z; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(row);
}
let queries = 0, rngCalls = 0, unknownClosureShapesProvenHorizontallyDisjoint = 0, modelPositionArraysMatched = 0, recordedWorldIntervalsMatched = 0;
function horizontalContact(c, x, z, radius) {
    // A conservative horizontal superset is sufficient to prove no 3D contact.
    // Retain every outer/band polygon, fill holes and remove only Y filtering.
    // No source geometry or unknown function return value is inferred.
    const base = { ...c, roofHeightAt: null, minHeightAt: null, passageSolids: null, minH: undefined, y0: undefined, y1: undefined, yMax: undefined, holes: [], y0a: -Infinity, y0b: -Infinity, y1a: Infinity, y1b: Infinity };
    const polys = [c.poly, ...(c.passageSolids || []).flatMap(b => b.polys)].filter(p => p?.length);
    return (polys.length ? polys : [null]).some(poly => !!collideBuildings([{ ...base, poly }], x, z, radius, .24, Infinity));
}
const queried = new Set();
const buildings = { query(x, z, r, visit) {
    queries++; const seen = new Set();
    for (let i = Math.floor((x - r) / cellSize); i <= Math.floor((x + r) / cellSize); i++) for (let j = Math.floor((z - r) / cellSize); j <= Math.floor((z + r) / cellSize); j++) for (const { c, box } of cells.get(i + ',' + j) || []) {
        if (seen.has(c) || box[0] > x + r || box[2] < x - r || box[1] > z + r || box[3] < z - r) continue;
        // The pinned admission query radius is exactly coverDisc.radius +2.
        if ((c.roofHeightAt || c.minHeightAt) && !horizontalContact(c, x, z, Math.max(0, r - 2))) { unknownClosureShapesProvenHorizontallyDisjoint++; continue; }
        seen.add(c); queried.add(c.colliderIndex); visit(c);
    }
} };
function input() {
    const T = Object.create(Traffic.prototype); Object.assign(T, { world: { graph, ribbons, buildings }, city: { id: 'bucharest' }, buc: true, time: 0, _frame: 0, pool: [], tramNetwork: snapshot.tramNetwork ? {} : null, grid: { build(items) { this.items = items; } }, rng() { rngCalls++; throw Error('RNG forbidden in CPU replay'); } });
    T.sharedLanes = new SharedLaneGate(graph.edges, (VEHICLE_KINDS || []).map(kind => vehicleSize(kind, 'bucharest')));
    T.vehicles = snapshot.active.map(r => {
        const mesh = makeVehicle(r.kind, undefined, { city: 'bucharest', instanced: true });
        mesh.position.set(...r.meshPose.position); mesh.rotation.set(...r.meshPose.rotation); mesh.scale.set(...r.meshPose.scale);
        const v = { ...revive(r), edge: edgeMap.get(r.edge.id), mesh };
        if (r.model?.primaryGeometryId) {
            const captured = facts.geometryCatalog[r.model.primaryGeometryId].attributes.position.array;
            const actual = mesh.userData._model.geo.attributes.position.array;
            assert(Buffer.from(captured.base64, 'base64').equals(Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength)), 'Primary position bytes differ for actor ' + v.id);
            modelPositionArraysMatched++;
        }
        if (r.actualPrimaryVerticalInterval?.known) {
            const interval = vehicleVerticalInterval(v);
            assert(interval.known && Math.abs(interval.min - r.actualPrimaryVerticalInterval.min) < 1e-10 && Math.abs(interval.max - r.actualPrimaryVerticalInterval.max) < 1e-10, 'Actual world interval differs for actor ' + v.id);
            recordedWorldIntervalsMatched++;
        }
        v.route = r.route.map(l => ({ ...l, e: edgeMap.get(l.edge?.id) }));
        v.hist = r.hist.map(l => ({ ...l, e: edgeMap.get(l.edge?.id) })); return v;
    }); return T;
}
function guardedAdmission(fn, T) {
    const random = Math.random;
    Math.random = () => { rngCalls++; throw Error('Global RNG forbidden during admission'); };
    try { return fn(T); } finally { Math.random = random; }
}
const oldT = input(), baseline = guardedAdmission(legacyAdmission, oldT);
fs.writeFileSync(output + '.baseline.json', JSON.stringify(baseline, null, 2) + '\n');
assert.deepEqual(baseline.unresolved.map(p => [p.a, p.b]), recorded.unresolved.map(p => [p.a, p.b]));
for (const p of baseline.unresolved) assert(Math.abs(p.penetration - recorded.unresolved.find(q => q.a === p.a && q.b === p.b).penetration) < 1e-12);
assert.deepEqual(baseline.updates.map(u => [u.id, u.after.s]), recorded.updates.map(u => [u.id, u.after.s]));
assert.deepEqual(baseline.invalidRailModes, recorded.invalidRailModes);
assert.deepEqual(baseline.search, recorded.search);
const targetIds = [...new Set(recorded.unresolved.flatMap(p => [p.a, p.b]))];
const T = input(), initialObjects = T.vehicles.slice(), initialIds = T.vehicles.map(v => v.id), spans = targetIds.map(id => {
    const v = T.vehicles.find(v => v.id === id), s = ordinarySourceSpan(T, v);
    return { id, sourceId: v.edge.access.sourceId, span: s ? { lo: s.lo, hi: s.hi, behind: s.behind, ahead: s.ahead, edgeIds: s.legs.map(l => l.e.id) } : null };
});
const candidate = guardedAdmission(candidateAdmission, T);
assert.equal(candidate.unresolved.length, 0); assert.equal(candidate.unknownHeights.length, 0); assert.equal(candidate.invalidBodies.length, 0);
assert.deepEqual(candidate.invalidRailModes, recorded.invalidRailModes);
assert(T.vehicles.every((v, i) => v === initialObjects[i])); assert.deepEqual(T.vehicles.map(v => v.id), initialIds); assert.equal(rngCalls, 0);
const result = { sourceCommit: '54c044421640cfe3569bfc3f72159d2169f87581', producer: { worldFile, factsFile, worldRawSha256: hash(worldBytes), factsRawSha256: hash(factBytes) }, nativeTime: snapshot.nativeTime, constructorActors: T.vehicles.length,
    consumedNativeSourceSha256: Object.fromEntries(['game/src/traffic.js', 'game/src/vehicles.js', 'game/src/world.js', 'game/src/nav.js', 'game/src/shared-lanes.js', 'game/src/initial-traffic-admission.js', 'game/src/initial-vehicle-admission.js'].map(p => [p, hash(fs.readFileSync(path.join(root, p)))])),
    candidateSourceSha256: Object.fromEntries(['initial-traffic-admission.js', 'initial-ordinary-source-span.js', 'tram-trench.js'].map(p => [p, hash(fs.readFileSync(new URL('../../../../game/src/' + p, import.meta.url)))])),
    baselineMatchesRecordedUnresolvedAndAppliedStations: true, baseline, spans, candidate, staticQueries: queries, unknownClosureShapesProvenHorizontallyDisjoint, queriedColliderIndices: [...queried].sort((a, b) => a - b),
    objectIdentityPreserved: true, idOrderPreserved: true, rngCalls, modelPositionArraysMatched, recordedWorldIntervalsMatched,
    scope: 'CPU copies of actual native54 constructor poses/models and canonical native graph/asphalt polygons/colliders; original native placement, shared-lane/static callbacks and transactional planner. Captured function closures are never evaluated or inferred: encountering one fails this replay. Polygon AABB broadphase safely excludes disjoint shapes. This is not browser/native publication acceptance; rail binding/static failures stay separate and are not waived.' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ constructorActors: T.vehicles.length, baseline: baseline.unresolved.map(p => [p.a, p.b]), spans, candidatePassed: candidate.passed, candidateUnresolved: candidate.unresolved, invalidRailModes: candidate.invalidRailModes, updates: candidate.updates.map(u => [u.id, u.after.s]), search: candidate.search, rngCalls, queried: queried.size }));
