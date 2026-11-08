import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SharedLaneGate } from '../src/shared-lanes.js';
import { laneOffset } from '../src/traffic.js';
const graph = () => {
    const nodes = [-30, 0, 40, 80, 110].map(x => ({ x, z: 0, edges: [], radius: 3 }));
    const edge = (a, b, sharedLane = false) => {
        const e = { a: nodes[a], b: nodes[b], sharedLane, sharedLaneWidthM: 3.2, dirx: Math.sign(b - a), dirz: 0, nx: 0, nz: Math.sign(b - a), len: Math.abs(nodes[a].x - nodes[b].x), lanesF: 1, lanesB: 1, laneW: sharedLane ? 1.6 : 3.2, median: 0 };
        e.a.edges.push(e); e.b.edges.push(e); return e;
    };
    const edges = [edge(0, 1), edge(1, 2, true), edge(3, 2, true), edge(3, 4)];
    const gate = new SharedLaneGate(edges);
    const west = { edge: edges[0], dir: 1, s: 0, length: 4, odo: 0, speed: 0, route: [{ e: edges[1], dir: 1 }] };
    const east = { edge: edges[3], dir: -1, s: 0, length: 4, odo: 0, speed: 0, route: [{ e: edges[2], dir: 1 }] };
    return { nodes, edges, gate, west, east };
};
test('one physical centre is shared by both legal graph directions; ordinary lane offsets stay unchanged', () => {
    const { edges } = graph();
    assert.equal(laneOffset(edges[1], 0, 1), 0); assert.equal(laneOffset(edges[1], 0, -1), 0);
    assert.equal(laneOffset(edges[0], 0), 1.6);
});
test('continuous sections preserve direction across reversed OSM edge ordering', () => {
    const { gate, edges } = graph(); assert.equal(gate.groups.length, 1);
    assert.equal(gate.entry(edges[1], 1).group, gate.entry(edges[2], -1).group);
    assert.equal(gate.entry(edges[1], 1).sign, gate.entry(edges[2], -1).sign);
    assert.notEqual(gate.entry(edges[1], 1).sign, gate.entry(edges[2], 1).sign);
});
test('opposite arrivals cannot both reserve an empty section', () => {
    const { gate, edges, west, east } = graph(); gate.update([west, east], null, 0);
    assert.equal(gate.canEnter(west, edges[1], 1), true);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
    gate.update([west, east], null, .05);
    assert.equal(gate.canEnter(west, edges[1], 1), true);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
});
test('opposite waiting blocks new followers, then receives priority only after the rear clears', () => {
    const { gate, edges, nodes, west, east } = graph(); const follower = { ...west, route: [...west.route] };
    west.edge = edges[1]; west.s = 20; west.odo = 20;
    gate.update([west, east, follower], null, 0);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
    assert.equal(gate.canEnter(follower, edges[1], 1), false);
    gate.advance(west, edges[2], -1, edges[3], 1, nodes[3]); west.edge = edges[3]; west.s = 1;
    gate.update([west, east, follower], null, .1);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
    west.odo = 26.01; west.s = 7;
    gate.update([west, east, follower], null, .2);
    assert.equal(gate.canEnter(east, edges[2], 1), true);
    assert.equal(gate.canEnter(follower, edges[1], 1), false);
});
test('occupied sections do not expire after a long wait or admit an opposite spawn', () => {
    const { gate, edges, west, east } = graph(); west.edge = edges[1]; west.s = 20;
    gate.update([west, east], null, 1000);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
    assert.equal(gate.canPlace(edges[2], 1, [west]), false);
    assert.equal(gate.canPlace(edges[2], -1, [west]), true);
});
test('player body occupancy blocks the opposite entry; a deck above does not', () => {
    const { gate, edges, west } = graph();
    const player = { x: 25, z: 0, fx: -1, fz: 0, y: .24, length: 4.4, width: 1.8 };
    gate.update([west], player, 0);
    assert.equal(gate.canEnter(west, edges[1], 1), false);
    assert.equal(gate.canPlace(edges[1], 1, [], null), false);
    player.y = 10; gate.update([west], player, .1);
    assert.equal(gate.canEnter(west, edges[1], 1), true);
});
test('cancelled or stationary uncommitted requests release without expiring real occupancy', () => {
    const { gate, edges, west, east } = graph(); gate.update([west, east], null, 0);
    assert.equal(gate.canEnter(west, edges[1], 1), true);
    assert.equal(gate.canEnter(east, edges[2], 1), false);
    gate.update([west, east], null, 5);
    assert.equal(gate.canEnter(east, edges[2], 1), true);
});
test('legacy graphs create no controls or placement restrictions', () => {
    const { edges, west } = graph(); for (const e of edges) e.sharedLane = false;
    const gate = new SharedLaneGate(edges); assert.equal(gate.groups.length, 0);
    assert.equal(gate.canEnter(west, edges[1], 1), true); assert.equal(gate.canPlace(edges[1], 1, []), true);
});
