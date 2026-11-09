// Reproduce source choice using an immutable native constructor extraction.
// Empty static world is intentional: this is not static/world acceptance.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildTramNetwork, nearestTramSource, projectTramStations, decodeTramPoints } from '../../../../../game/src/tram-path.js';
import { Traffic } from '../../../../../game/src/traffic.js';
import { makeVehicle } from '../../../../../game/src/vehicles.js';

const [file, out] = process.argv.slice(2), bytes = fs.readFileSync(file), native = JSON.parse(bytes), data = native.data;
const graph = buildTramNetwork(data), affected = graph.allEdges.filter(e => e.modeled && ['w241374326', 'w920117619', 'w243476552'].includes(e.sourceId));
assert.equal(affected.length, 9);
assert(affected.every(e => !e.usable && !e.grade.known));
const describe = n => n ? { sourceId: n.e.sourceId, sourceNodeIds: n.e.sourceNodeIds, sourceSegment: n.e.sourceSegment, dir: n.dir, distanceM: n.distance, grade: n.e.grade, sourceTags: n.e.sourceTags, usable: n.e.usable } : null;
const snapshots = native.snapshots.map(snapshot => ({ phase: snapshot.phase, counts: snapshot.counts, actors: [...snapshot.active, ...snapshot.pool].filter(v => v.tram || /tram/i.test(v.kind)).map(v => ({ native: v, nearestSource: describe(nearestTramSource(graph, v.x, v.z, v.heading)), admittedOnlyCandidates: projectTramStations(graph, v.x, v.z, v.heading, v.length).slice(0, 2).map(p => ({ sourceId: p.e.sourceId, sourceSegment: p.e.sourceSegment, sourceNodeIds: p.e.sourceNodeIds, distanceM: p.distance })) })) }));
assert.deepEqual(snapshots[0].actors.map(a => a.native.id), [489, 490]);
assert.equal(snapshots[0].actors[1].nearestSource.sourceId, 'w243476552');
assert.equal(snapshots[0].actors[1].nearestSource.usable, false);
const rawNodes = new Map();
for (const edge of native.allEdges) for (const n of [edge.a, edge.b]) if (!rawNodes.has(n.id)) rawNodes.set(n.id, { ...n, edges: [] });
const edges = native.allEdges.map(e => ({ ...e, a: rawNodes.get(e.a.id), b: rawNodes.get(e.b.id) }));
for (const edge of edges) { edge.a.edges.push(edge); edge.b.edges.push(edge); }
const byEdge = new Map(edges.map(e => [e.id, e]));
const actors = native.snapshots[0].active.map(v => ({ ...v, edge: byEdge.get(v.edge.id), mesh: v.tram ? makeVehicle(v.kind, undefined, { city: 'bucharest', instanced: true }) : null, route: [], hist: [] }));
const traffic = Object.create(Traffic.prototype);
Object.assign(traffic, { world: { data, graph: { nodes: [...rawNodes.values()], edges }, buildings: [] }, vehicles: actors, pool: [], grid: { build() {} }, rng() { throw Error('Source binding consumed RNG'); } });
const references = actors.slice(), binding = traffic.bindSourceTrams();
assert.equal(binding.passed, false);
assert(binding.unresolved.some(v => v.id === 490 && v.sourceChoice.sourceId === 'w243476552'));
assert(actors.every((v, i) => v === references[i]));
const result = {
    passed: true,
    scope: 'Historical native6cb High/full constructor input; current source-choice CPU evaluation only. Not current merged native acceptance. Static world empty; no world collision claim.',
    input: { path: file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), nativeScope: native.scope },
    modeledSegments: graph.report.modeledSegments,
    admittedGroundSegments: graph.report.admittedSegments,
    affectedSegments: affected.map(e => ({ sourceId: e.sourceId, renderRunIndex: data.tramSources.findIndex(s => s.sourceId === e.sourceId), sourceSegment: e.sourceSegment, sourceNodeIds: e.sourceNodeIds, xy: [[e.a.x, e.a.z], [e.b.x, e.b.z]], sourceTags: e.sourceTags, grade: e.grade })),
    snapshots,
    sourceBindingCpu: binding,
    all491ActorIdentitiesPreserved: true,
    rngDraws: 0,
    remainingApproachContext: { sourceId: 'w920117620', connectsToTunnelSource: 'w920117619', sharedNodeId: 8544117712, note: 'Untagged source exit approach currently falls back flat. A future shared tunnel profile must cover the connected approach and render as well as the seven tagged tunnel plus two level-only approach segments; this CPU binding is not a grade acceptance.' },
    rawSourceWays: data.tramSourceWays.filter(w => ['w241374326', 'w920117619', 'w243476552', 'w920117620'].includes(w.sourceId)).map(w => ({ ...w, decodedPoints: decodeTramPoints(w.points, data.q) }))
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, output: out, affectedSegments: affected.length, constructorTramIds: snapshots[0].actors.map(a => a.native.id), unresolvedBindings: binding.unresolved.map(v => ({ id: v.id, source: v.sourceChoice?.sourceId })), bindings: binding.bindings.map(v => ({ id: v.id, source: v.after.sourceId })), nativeAcceptance: false }));
