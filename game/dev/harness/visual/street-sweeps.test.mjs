import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Navigator } from '../../../src/nav.js';
import { planStreetSweeps, sweepSampleDistances } from './page/street-sweeps.js';

function build(nodes, roads) {
    const map = new Map(nodes.map(n => [n.id, { ...n, edges: [] }])), edges = [];
    for (const road of roads) for (let i = 0; i < road.nodes.length - 1; i++) {
        const a = map.get(road.nodes[i]), b = map.get(road.nodes[i + 1]), len = Math.hypot(b.x - a.x, b.z - a.z);
        const e = { id: edges.length, ...road, ...road.access, a, b, len, dirx: (b.x - a.x) / len, dirz: (b.z - a.z) / len, maxspeed: (road.maxspeedKmh || 50) / 3.6, virtual: false };
        edges.push(e); a.edges.push(e); b.edges.push(e);
    }
    const nav = new Navigator({ graph: { nodes: [...map.values()], edges }, data: { roadGeometryPolicy: 'source' } });
    return { edges, nav };
}
const plan = (graph, route = (a, b) => graph.nav.compute(a.x, a.z, b.x, b.z, null)) => planStreetSweeps({ name: graph.edges[0].name, edges: graph.edges, route, sourceId: e => e.sourceId });
const road = (nodes, options = {}) => ({ sourceId: 'w-control', name: 'Control Street', type: 'secondary', lanesF: 1, lanesB: 1, oneway: false, nodes, ...options });
const nodes = coordinates => coordinates.map(([x, z], id) => ({ id, sourceId: id, x, z, mapEnd: true }));
let checks = 0;

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/grozavesti-splai-source.json', import.meta.url)));
const real = plan(build(fixture.nodes, fixture.roads));
assert.equal(real.diagnostics.originalFarthestPair.forward.reachable, false);
assert.equal(real.diagnostics.originalFarthestPair.reverse.reachable, false);
assert.equal(real.diagnostics.components.length, 2);
assert.equal(real.runs.length, 2);
assert.equal(real.diagnostics.status, 'complete');
assert.equal(real.diagnostics.requiredDirectedEdges, 26);
assert.equal(real.diagnostics.coveredDirectedEdges, 26);
assert(real.runs.every(r => r.routeMetres > 260 && r.routeMetres < 261 && Math.abs(r.requestedStreetMetres - r.routeMetres) < .001));
assert.equal(real.runs.reduce((n, r) => n + sweepSampleDistances(r.routeMetres, 40).length, 0), 12);
checks += 9;

const twoWay = plan(build(nodes([[0, 0], [100, 0], [200, 0]]), [road([0, 1, 2])]));
assert.equal(twoWay.runs.length, 2); assert.equal(twoWay.diagnostics.coveredDirectedEdges, 4); assert.equal(twoWay.diagnostics.status, 'complete'); checks += 3;

const oneWay = plan(build(nodes([[0, 0], [100, 0], [200, 0]]), [road([0, 1, 2], { oneway: true, lanesB: 0 })]));
assert.equal(oneWay.runs.length, 1); assert.equal(oneWay.diagnostics.coveredDirectedEdges, 2); assert.equal(oneWay.diagnostics.originalFarthestPair.reverse.reachable, false); checks += 3;

const branch = plan(build(nodes([[0, 0], [100, 0], [200, 0], [100, 100]]), [road([0, 1, 2]), road([1, 3], { sourceId: 'w-branch' })]));
assert.equal(branch.diagnostics.status, 'complete'); assert.equal(branch.diagnostics.coveredDirectedEdges, 6); assert(branch.runs.length >= 3); checks += 3;

const missing = plan(build(nodes([[0, 0], [200, 0]]), [road([0, 1])]), () => null);
assert.equal(missing.runs.length, 0); assert.equal(missing.diagnostics.status, 'incomplete'); assert.equal(missing.diagnostics.uncovered.length, 2); checks += 3;

const short = plan(build(nodes([[0, 0], [8, 0]]), [road([0, 1], { oneway: true, lanesB: 0 })]));
assert.equal(short.runs.length, 1); assert.deepEqual(sweepSampleDistances(short.runs[0].routeMetres, 40), [4]); checks += 2;

const blocked = build(nodes([[0, 0], [200, 0]]), [road([0, 1], { oneway: true, lanesB: 0 })]);
const fake = plan(blocked, () => ({ points: [[0, 0], [200, 0]], legs: [{ e: { ...blocked.edges[0], virtual: true }, dir: 1 }] }));
assert.equal(fake.diagnostics.status, 'incomplete'); assert.equal(fake.runs.length, 0); assert.equal(fake.diagnostics.uncovered.length, 1); checks += 3;

const illegalReverse = plan(blocked, () => ({ points: [[200, 0], [0, 0]], legs: [{ e: blocked.edges[0], dir: -1 }] }));
assert.equal(illegalReverse.diagnostics.status, 'incomplete'); assert.equal(illegalReverse.runs.length, 0); checks += 2;

const privateOnly = plan(build(nodes([[0, 0], [200, 0]]), [road([0, 1], { access: { publicDrive: false } })]));
assert.equal(privateOnly.diagnostics.status, 'no-legal-public-edges'); assert.equal(privateOnly.runs.length, 0); assert.equal(privateOnly.diagnostics.excluded.length, 1); checks += 3;
console.log(JSON.stringify({ passed: true, checks, realSplai: { physicalComponents: real.diagnostics.components.length, directedSourceEdges: real.diagnostics.coveredDirectedEdges, verifiedRuns: real.runs.length, captureSamples: 12, originalFarthestPairStillUnreachable: true } }, null, 2));
