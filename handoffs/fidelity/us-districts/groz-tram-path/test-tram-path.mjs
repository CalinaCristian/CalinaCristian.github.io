import assert from 'node:assert/strict';
import { buildTramNetwork, canTravelTram, sampleTramPath, tramSpan, tramPathPolyline, projectTramStations, nativeTramGradeResolver } from '../../../../game/src/tram-path.js';
import { canTravel } from '../../../../game/src/nav.js';
const encode = points => { let x = 0, z = 0; return points.flatMap(p => { const nx = Math.round(p[0] * 10), nz = Math.round(p[1] * 10), result = [nx - x, nz - z]; x = nx; z = nz; return result; }); };
const way = (id, nodes, points, tags = {}) => ({ sourceId: 'w' + id, nodeIds: nodes, points: encode(points), tags: { railway: 'tram', oneway: 'yes', ...tags } });
const data = ways => ({ q: 10, trams: ways.map(w => w.points), tramSources: ways.map(w => ({ sourceId: w.sourceId, nodeIds: w.nodeIds, tags: w.tags })), tramSourceWays: ways, tramRoutes: [], tramSourceNodeTags: {} });
const results = [];
function test(name, fn) { fn(); results.push({ name, passed: true }); }
const originalRandom = Math.random; Math.random = () => { throw Error('Source path operation consumed RNG'); };
try {
    test('explicit rail one-way differs from an unrelated motor direction', () => {
        const g = buildTramNetwork(data([way(1, [101, 102], [[0, 0], [100, 0]])]));
        assert.equal(canTravelTram(g.edges[0], 1), true); assert.equal(canTravelTram(g.edges[0], -1), false);
        assert.equal(canTravel(g.edges[0], 1), false, 'a legal tram edge remains unavailable to generic motor navigation');
        const p = sampleTramPath({ edge: g.edges[0], dir: 1, s: 42 }); assert.equal(p.x, 42); assert.equal(p.z, 0);
    });
    test('nearby geometry cannot create a rail node join', () => {
        const g = buildTramNetwork(data([way(1, [101, 102], [[0, 0], [4, 0]]), way(2, [201, 202], [[4, 0], [80, 0]])]));
        assert.equal(sampleTramPath({ edge: g.edges[0], dir: 1, s: 3 }, 3), null); assert.equal(g.nodes.length, 4);
    });
    test('long-body samples traverse literal short connected legs and bends', () => {
        const g = buildTramNetwork(data([way(1, [101, 102, 103, 104], [[0, 0], [20, 0], [20, 20], [80, 20]])]));
        const v = { edge: g.edges[1], dir: 1, s: 10, route: [], hist: [] };
        assert.deepEqual([sampleTramPath(v, -20).x, sampleTramPath(v, -20).z], [10, 0]);
        assert.deepEqual([sampleTramPath(v, 20).x, sampleTramPath(v, 20).z], [30, 20]);
        const p = sampleTramPath(v); assert.equal(p.x, 20); assert.equal(p.z, 10); assert(tramSpan(v.edge, 1, 36));
    });
    test('reverse-only source direction remains reverse-only', () => {
        const g = buildTramNetwork(data([way(1, [101, 102], [[0, 0], [100, 0]], { oneway: '-1' })]));
        assert.equal(canTravelTram(g.edges[0], 1), false); assert.equal(canTravelTram(g.edges[0], -1), true);
    });
    test('unknown source direction and incomplete whole-way geometry remain unresolved', () => {
        const w = way(1, [101, 102], [[0, 0], [100, 0]]); delete w.tags.oneway;
        const g = buildTramNetwork(data([w])); assert.equal(g.edges.length, 0); assert(g.report.unresolved.some(r => r.reason === 'unresolved-source-rail-direction'));
        const d = data([way(2, [201, 202], [[0, 0], [50, 0]])]); d.tramSourceWays[0].points = null; d.tramSourceWays[0].missingNodeIds = [202]; assert.equal(buildTramNetwork(d).edges.length, 0);
    });
    test('layer is not a height; an explicit resolver supplies the same path grade', () => {
        const d = data([way(1, [101, 102], [[0, 0], [100, 0]], { bridge: 'yes', layer: '2' })]);
        assert.equal(buildTramNetwork(d).edges.length, 0);
        const g = buildTramNetwork(d, { resolveGrade: () => ({ known: true, ya: 3, yb: 5, basis: 'fixture-native-source-deck-control' }) });
        assert.equal(sampleTramPath({ edge: g.edges[0], dir: 1, s: 25 }).y, 3.5);
    });
    test('equal source node creates a physical binding without mutating motor topology', () => {
        const motor = { id: 7, sourceId: 102, x: 20, z: 0, y: 0, radius: 5, edges: [{ id: 8 }, { id: 9 }] }, before = JSON.stringify(motor);
        const g = buildTramNetwork(data([way(1, [101, 102, 103], [[0, 0], [20, 0], [80, 0]])]), { motorNodes: [motor] });
        assert.equal(g.bySourceNode.get('102').motorNode, motor); assert.equal(JSON.stringify(motor), before); assert.equal(g.report.sourceNodeCrossings.length, 1);
    });
    test('projection never uses road median or cross-track reverse legality', () => {
        const g = buildTramNetwork(data([way(1, [101, 102], [[0, 0], [100, 0]]), way(2, [201, 202], [[100, 3], [0, 3]])]));
        const east = projectTramStations(g, 50, 2.8, -Math.PI / 2, 27), west = projectTramStations(g, 50, .2, Math.PI / 2, 27);
        assert.equal(east[0].e.sourceId, 'w1'); assert.equal(west[0].e.sourceId, 'w2'); assert.equal(sampleTramPath({ edge: east[0].e, dir: east[0].dir, s: east[0].s }).z, 0);
    });
    test('unmodeled full source continuation stays retained without adding an invisible route', () => {
        const d = data([way(1, [101, 102, 103], [[0, 0], [30, 0], [60, 0]])]); d.trams[0] = encode([[0, 0], [30, 0]]); d.tramSources[0].nodeIds = [101, 102];
        const g = buildTramNetwork(d); assert.equal(g.allEdges.length, 2); assert.equal(g.edges.length, 1); assert.equal(sampleTramPath({ edge: g.edges[0], dir: 1, s: 25 }, 10), null);
    });
    test('source reservations retain a mapped bend instead of crossing its chord', () => {
        const g = buildTramNetwork(data([way(1, [101, 102, 103], [[0, 0], [50, 0], [50, 50]])]));
        const parts = tramPathPolyline({ edge: g.edges[0], dir: 1, s: 40, route: [{ e: g.edges[1], dir: 1 }] }, -5, 20);
        assert.equal(parts.length, 2); assert.deepEqual(parts.map(p => [p.p0x, p.p0z, p.p1x, p.p1z]), [[35, 0, 50, 0], [50, 0, 50, 10]]);
    });
    test('native bridge grade needs whole support, compatible layer, and consistent height', () => {
        const e = { id: 7, sourceId: 'w7', bridge: true, layer: 1, a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, dirx: 1, dirz: 0, len: 100, ya: 4, yb: 6 }, poly = [[0, -2], [100, -2], [100, 2], [0, 2]], leg = { a: { x: 10, z: 0 }, b: { x: 90, z: 0 }, len: 80 }, w = way(1, [101, 102], [[10, 0], [90, 0]], { bridge: 'yes', layer: '1' });
        const r = nativeTramGradeResolver({ ribbons: [{ e, poly }] })(w, leg); assert.equal(r.known, true); assert.equal(r.ya, 4.2); assert.equal(r.yb, 5.8);
        assert.equal(nativeTramGradeResolver({ ribbons: [{ e: { ...e, layer: 2 }, poly }] })(w, leg).known, false);
        assert.equal(nativeTramGradeResolver({ ribbons: [{ e, poly: [[0, -.5], [100, -.5], [100, .5], [0, .5]] }] })(w, leg).known, false);
    });
    test('source-connected height conflicts and coordinate conflicts cannot become usable joins', () => {
        const d = data([way(1, [101, 102], [[0, 0], [50, 0]]), way(2, [102, 103], [[50, 0], [100, 0]])]);
        const g = buildTramNetwork(d, { resolveGrade: w => ({ known: true, ya: w.sourceId === 'w1' ? 0 : 3, yb: w.sourceId === 'w1' ? 0 : 3 }) }); assert.equal(g.edges.length, 0); assert(g.report.unresolved.some(r => r.reason === 'inconsistent-connected-rail-grade'));
        d.tramSourceWays[1].points = encode([[51, 0], [100, 0]]); const conflict = buildTramNetwork(d); assert.equal(conflict.edges.length, 0); assert(conflict.report.unresolved.some(r => r.reason === 'inconsistent-source-node-coordinates'));
    });
    test('numeric source speed limits survive rail graph construction', () => {
        const d = data([way(1, [101, 102], [[0, 0], [100, 0]], { maxspeed: '18' })]); const g = buildTramNetwork(d); assert.equal(g.edges[0].maxspeed, 5);
    });
} finally { Math.random = originalRandom; }
console.log(JSON.stringify({ passed: true, controls: results, rngDraws: 0, browserOpened: false }, null, 2));
