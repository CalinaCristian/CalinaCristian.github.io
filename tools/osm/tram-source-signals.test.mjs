import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../game/vendor/three.module.min.js';
import { buildTramNetwork } from '../../game/src/tram-path.js';
import { buildTramSourceSignals, tramSourceSignalState } from '../../game/src/tram-source-signals.js';
import { assignSignalPhases, signalState } from '../../game/src/signals.js';
import { Traffic } from '../../game/src/traffic.js';
import { makeRng } from '../../game/src/util.js';
import { SharedLaneGate } from '../../game/src/shared-lanes.js';
import { readDistrictData } from './district-data.mjs';

const results = [], test = (name, fn) => { const details = fn(); results.push({ name, details }); console.log('PASS ' + name); };
const input = JSON.parse(fs.readFileSync('handoffs/fidelity/source-controlled-crossing/groz-motor98-input.json'));
const fullData = readDistrictData('game/data/bucharest-grozavesti.bin.gz');
const worldSource = fs.readFileSync('game/src/world-api.js', 'utf8'), lightBody = worldSource.match(/lightState\(nodeId, edge, time, cycle\) \{([\s\S]*?)\n        \},/)[1];
function fixture() {
    const nodes = new Map(), edges = structuredClone(input.edges).map(e => {
        for (const end of ['a', 'b']) { if (!nodes.has(e[end].id)) nodes.set(e[end].id, { ...e[end], edges: [] }); e[end] = nodes.get(e[end].id); e[end].edges.push(e); }
        return e;
    });
    const motor = nodes.get(98); motor.signal = !!(motor.flags & (1 | 8)); motor.hasLight = motor.signal; // exact ROOT6a045054 flag8 contract, NOT a recorded native controller
    const approaches = motor.edges.filter(e => !e.oneway || e.b === motor).map(edge => ({ edge, node: motor }));
    motor.lightCluster = { nodes: [motor], offset: 0, phaseCount: assignSignalPhases(approaches) };
    const nodeLight = { 98: { node: motor, approaches } }, world = { data: fullData, graph: { nodes: [...nodes.values()], edges }, nodeLight, lights: [nodeLight[98]], buildings: [], ribbons: [], district: { inside: () => true } };
    world.lightState = new Function('nodeLight', 'signalState', 'return function(nodeId, edge, time, cycle) {' + lightBody + '\n};')(nodeLight, signalState);
    const all = buildTramNetwork(fullData, { motorNodes: [...nodes.values()] }), railNodes = [6234008736, 6234008735].map(n => all.bySourceNode.get(String(n)));
    const network = { ...all, nodes: railNodes, bySourceNode: new Map(railNodes.map(n => [String(n.sourceId), n])) };
    const data = { ...fullData, tramSourceCrossings: fullData.tramSourceCrossings.filter(c => c.sourceId === 'w665913378') };
    return { data, all, network, world, motor, edges, railNodes, approaches };
}
function apply(f) {
    const plan = buildTramSourceSignals(f.data, f.network, f.world);
    for (const { railNode, sourceSignal } of plan.associations) { railNode.sourceSignal = sourceSignal; railNode.hasLight = true; }
    return plan;
}
function nativeTraffic(f) {
    const grid = { items: [], build(items) { this.items = items; }, query(_x, _z, _r, fn) { for (const v of this.items) fn(v); } };
    const T = Object.assign(Object.create(Traffic.prototype), { world: f.world, city: { id: 'bucharest' }, buc: true, chaos: 1, rng: makeRng(99), vehicles: [], pool: [], group: new THREE.Group(), grid, police: [], stats: {}, _idSeq: 0, boxes: new Map(), sharedLanes: new SharedLaneGate([], []), tramNetwork: f.all, tramMotorCrossings: new Set(), _frame: 0, _dt: 1 / 30, time: 0, cycle: 12, peds: { obstacleGap: () => Infinity, crossingAt: () => false, grid: { query() {} } }, player: null, _lightPhase: new Map(), onHonk() {}, onSay() {} });
    const node = f.railNodes[0], edge = node.sourceSignal.railEdges[0], v = T.spawn({ edge, dir: 1, lane: 0, s: edge.len - 35, kind: 'tram-v3a' }); grid.build(T.vehicles); v.nextStopOdo = 1e6;
    T.player = { x: v.x + 50, z: v.z + 50, y: .24, speed: 0, fx: 0, fz: -1, heading: 0, width: 1.8, length: 5.78, front: 3.42, rear: 2.36, stillT: 0 };
    return { T, grid, node, edge, v };
}
const snapshot = f => JSON.stringify({ motors: f.world.graph.nodes.map(n => ({ id: n.id, sourceId: n.sourceId, x: n.x, z: n.z, edges: n.edges.map(e => e.id) })), rails: f.network.nodes.map(n => ({ id: n.id, sourceId: n.sourceId, x: n.x, z: n.z, motorNode: n.motorNode?.id, edges: n.edges.map(e => e.id) })), data: f.data });

test('actual literal Groz crossing binds both opposite rail approaches to exact motor98/incoming78', () => {
    const f = fixture(), before = snapshot(f), plan = apply(f);
    assert.equal(plan.passed, true, JSON.stringify(plan.unresolved)); assert.equal(plan.bindings.length, 2);
    for (const binding of plan.bindings) { assert.equal(binding.motorNodeId, 98); assert.equal(binding.motorEdgeId, 78); assert.equal(binding.roadSourceNodeId, 6234008741); assert.equal(binding.roadSourceId, 'w106797416'); assert.deepEqual(binding.crossingSourceIds, ['w665913378']); }
    assert.equal(snapshot(f), before, 'routing topology/poses/data did not change'); assert(f.railNodes.every(n => !n.motorNode));
    return plan.bindings;
});
test('actual native World/Traffic state agrees for road and both rail directions on green/yellow/red', () => {
    const f = fixture(); apply(f); const T = Object.assign(Object.create(Traffic.prototype), { world: f.world, time: 0, cycle: 12, _lightPhase: new Map() });
    for (const [time, expected] of [[0, 'green'], [7, 'yellow'], [10, 'red'], [12, 'green']]) {
        T.time = time; assert.equal(T.lightState(f.motor, f.edges[0]), expected);
        for (const node of f.railNodes) { const edge = node.sourceSignal.railEdges[0]; assert.equal(T.lightState(node, edge), expected); assert.equal(T.boxController(node), T.boxController(f.motor)); }
    }
    assert.equal(T.time, 12); assert.equal(T.cycle, 12); assert.equal(T._lightPhase.size, 0, 'no new timing/controller fallback');
});
test('missing controller never aliases a nearby light or silently uses green', () => {
    const f = fixture(); delete f.world.nodeLight[98]; f.world.nodeLight[999] = { node: { ...f.motor, id: 999 }, approaches: f.approaches };
    const plan = apply(f); assert.equal(plan.passed, false); assert.equal(plan.associations.length, 0); assert(plan.unresolved.every(e => e.details.includes('exact-source-road-controller-unavailable')));
    const n = f.railNodes[0]; n.sourceSignal = { unresolved: true }; assert.equal(tramSourceSignalState(f.world, n, n.edges[0], 0, 12), 'red');
});
test('wrong literal source node and wrong road source ID are rejected without nearest lookup', () => {
    for (const change of [f => { f.data = structuredClone(f.data); f.data.tramSourceCrossings[0].roadIncidences[0].nodeId = 999; }, f => { f.edges[0].access.sourceId = 'wOTHER'; f.edges[0].sourceId = 'wOTHER'; }]) {
        const f = fixture(); change(f); const plan = apply(f); assert.equal(plan.passed, false); assert.equal(plan.associations.length, 0);
    }
});
test('nonparallel road axis is not an eligible phase even on the same literal crossing', () => {
    const f = fixture(), e = f.edges[0]; [e.dirx, e.dirz] = [-e.dirz, e.dirx]; const plan = apply(f); assert.equal(plan.passed, false); assert.equal(plan.associations.length, 0);
});
test('mismatched source coordinates and unavailable crossing points remain explicit failures', () => {
    for (const change of [f => { f.motor.x += 1; }, f => { f.motor.x = NaN; }, f => { f.railNodes[0].z += 1; }, f => { f.data = structuredClone(f.data); f.data.tramSourceCrossings[0].points = null; f.data.tramSourceCrossings[0].missingNodeIds = [6234008737]; }]) {
        const f = fixture(); change(f); assert.equal(apply(f).passed, false);
    }
});
test('ambiguous exact source nodes or different controller phases are not resolved by order/distance', () => {
    const f = fixture(); f.world.graph.nodes.push({ ...f.motor, id: 999 }); assert.equal(apply(f).passed, false);
    const g = fixture(); g.motor.lightCluster.phaseCount = 2; g.approaches.push({ edge: g.edges[0], node: g.motor, phase: 1 }); assert.equal(apply(g).passed, false);
});
test('same exact shared controller/phase may have multiple verified approaches without proximity choice', () => {
    const f = fixture(); f.approaches.push({ ...f.approaches[0] }); const plan = apply(f); assert.equal(plan.passed, true); assert.equal(plan.bindings[0].verifiedMotorApproaches.length, 2);
});
test('missing source context for a controlled live rail node fails explicitly', () => {
    const f = fixture(); f.data = { ...f.data, tramSourceCrossings: [] }; const plan = apply(f); assert.equal(plan.passed, false); assert.equal(plan.unresolved.length, 2); assert(plan.unresolved.every(e => e.reason === 'missing-controlled-source-crossing-context'));
});
test('uncontrolled literal crossing remains unbound and retains its original behavior', () => {
    const f = fixture(); f.data = structuredClone(f.data); for (const n of f.railNodes) { n.tags = {}; f.data.tramSourceCrossings[0].nodeTags[String(n.sourceId)] = { crossing: 'uncontrolled' }; }
    const plan = apply(f); assert.equal(plan.passed, true); assert.equal(plan.bindings.length, 0); assert.equal(plan.uncontrolled.length, 2); assert.equal(tramSourceSignalState(f.world, f.railNodes[0], f.railNodes[0].edges[0], 0, 12), null);
});
test('outgoing/wrong rail edge and stale controller/phase cannot borrow a valid green', () => {
    const f = fixture(); apply(f); const n = f.railNodes[0], incoming = n.sourceSignal.railEdges[0], outgoing = n.edges.find(e => !n.sourceSignal.railEdges.includes(e));
    assert.equal(tramSourceSignalState(f.world, n, outgoing, 0, 12), 'red');
    f.approaches[0].phase = 1; assert.equal(tramSourceSignalState(f.world, n, incoming, 0, 12), 'red');
});
test('native reservation carries the exact road phase and retains conflicting occupied-phase guard', () => {
    const f = fixture(); apply(f); const T = Object.assign(Object.create(Traffic.prototype), { world: f.world, boxes: new Map(), time: 1 }), node = f.railNodes[0], edge = node.sourceSignal.railEdges[0], next = node.edges.find(e => e !== edge);
    const v = { id: 1, edge, dir: 1, s: edge.len - 20, length: 27, width: 2.4, lane: 0, route: [{ e: next, dir: 1 }], hist: [], odo: 0, speed: 0 };
    const path = T.reservationPath(v, edge, 1, v.route[0], node, 0); assert.equal(path.phase, f.approaches[0].phase); T.boxClaim(v, node, path); assert(T.boxes.has(f.motor.lightCluster));
    f.motor.lightCluster.phaseCount = 2; f.motor.lightCluster.occupiedPhases = [1]; assert.equal(T.lightState(node, edge), 'red'); assert.equal(T.lightState(f.motor, f.edges[0]), 'red');
});
test('actual native tram step stops for mapped source-controller red and resumes on green', () => {
    const f = fixture(); apply(f); const { T, node, edge, v } = nativeTraffic(f);
    const start = v.odo || 0, red = [];
    for (let i = 0; i < 600; i++) { T.time = 10; T._frame++; T.stepVehicle(v, 1 / 30); if (v.stopWhy === 'light') red.push(v.stopD); assert(v.edge === edge && v.s + v.length / 2 < edge.len, 'red keeps whole front outside crossing'); }
    assert(red.length > 0); assert(v.speed < .01); const stoppedOdo = v.odo;
    for (let i = 0; i < 210; i++) { T.time = 0; T._frame++; T.stepVehicle(v, 1 / 30); }
    assert(v.odo > stoppedOdo + 20 && v.edge !== edge, 'green must physically cross the literal source node'); assert.equal(T.vehicles.length, 1); assert.equal(T._idSeq, 1); assert.equal(T.cycle, 12);
    return { sourceNode: node.sourceId, motorNode: 98, motorEdge: 78, startOdo: start, stoppedOdo, resumedOdo: v.odo, redSamples: red.length, conditions: 'Isolated actual native step/source graph and recorded motor98 geometry; empty static/other actors, CPU phase hold only. Not combined native-world acceptance.' };
});
test('a shared source green preserves native physical vehicle and pedestrian yielding', () => {
    for (const kind of ['vehicle-body', 'pedestrian-gap', 'crossing-count']) {
        const f = fixture(); apply(f); const { T, grid, v } = nativeTraffic(f);
        if (kind === 'vehicle-body') {
            const distance = v.length / 2 + 2.2 + 1, body = { id: 999, length: 4.4, width: 1.8, x: v.x + v.fx * distance, z: v.z + v.fz * distance, y: v.y, heading: v.heading, speed: 0, layer: v.layer };
            grid.items = [v, body]; // explicit stationary body control, not a source-legal fleet admission claim
        } else if (kind === 'pedestrian-gap') T.peds.obstacleGap = () => 0;
        else T.peds.crossingAt = () => true;
        for (let i = 0; i < 450; i++) { T.time = 0; T._frame++; T.stepVehicle(v, 1 / 30); }
        assert(v.speed < .01, JSON.stringify({ kind, speed: v.speed, odo: v.odo, leader: v.leader?.id, gap: v.gap })); assert(v.odo < 19, kind); assert.equal(T.time, 0); assert.equal(T.cycle, 12);
        if (kind === 'crossing-count') assert.equal(v.stopWhy, 'zebra');
    }
});
const report = { passed: true, controls: results.length, results, browserOpened: false, networkUsed: false, scope: 'Exact cached literal crossing + recorded native motor geometry with ROOT flag8 controller CPU contract; actual native signal/Traffic methods. Combined publication/render/full-actor gates remain pending.' };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, controls: results.length, browserOpened: false }));
