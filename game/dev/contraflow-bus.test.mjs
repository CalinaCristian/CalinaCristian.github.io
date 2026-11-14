import assert from 'node:assert/strict';
import { contraflowBusLanes, contraflowEdge, laneLettering, layContraflowLanes, motorOneway } from '../src/contraflow-bus.js';
import { canTravel, canTravelBus, lanesDir } from '../src/nav.js';
import { actorCanTravel, laneOffset } from '../src/traffic-shared.js';
import { buildTurnLaneRules } from '../src/turn-lanes.js';

// Calea Floreasca w669019902 (source tags kept in the district pack)
const floreasca = { busway: 'opposite_lane', highway: 'tertiary', lanes: '3', 'lanes:bus:backward': '1', 'lanes:forward': '2', oneway: 'yes', 'oneway:bus': 'no' };
assert.deepEqual(contraflowBusLanes(floreasca, 3), { lanes: 1, general: 2, total: 3, withFlow: false });
assert.deepEqual(contraflowBusLanes({ ...floreasca, lanes: '4', 'lanes:forward': '3' }, 4), { lanes: 1, general: 3, total: 4, withFlow: false });
// Calea Moșilor w1004394633: `lanes` counts the bus lane, no lanes:forward
assert.deepEqual(contraflowBusLanes({ busway: 'opposite_lane', lanes: '2', oneway: 'yes', 'oneway:bus': 'no' }, 2), { lanes: 1, general: 1, total: 2, withFlow: false });
// no lane count at all: the class default stays and the bus lane widens the carriageway
assert.deepEqual(contraflowBusLanes({ busway: 'opposite_lane', oneway: 'yes' }, 1), { lanes: 1, general: 1, total: 2, withFlow: false });
// oneway:bus=no with a mapped lane, and a with-flow bus lane as well
assert.deepEqual(contraflowBusLanes({ oneway: 'yes', 'oneway:bus': 'no', 'lanes:bus:backward': '1', lanes: '4', 'busway:right': 'lane' }, 4), { lanes: 1, general: 3, total: 4, withFlow: true });
// oneway=-1: the way runs against the traffic, so the traffic's left is the way's right
assert.equal(contraflowBusLanes({ oneway: '-1', 'busway:right': 'opposite_lane', lanes: '3', 'lanes:backward': '2' }, 3).general, 2);
assert.equal(contraflowBusLanes({ oneway: '-1', 'busway:left': 'opposite_lane' }, 2), null, 'a lane on the traffic\'s right is not built');
// not a contraflow bus lane
for (const t of [{ busway: 'lane', oneway: 'yes' }, { busway: 'opposite_lane' }, { oneway: 'yes', 'oneway:bus': 'no' }, { oneway: 'yes' }, null])
    assert.equal(contraflowBusLanes(t, 2), null, JSON.stringify(t));

// the edge: same carriageway, bus-only lane on the left of a→b, general lanes beside it
const a = { x: 0, z: 0, edges: [] }, b = { x: 0, z: -100, edges: [] };
const e = { a, b, len: 100, dirx: 0, dirz: -1, nx: 1, nz: 0, oneway: true, lanesF: 3, lanesB: 0, lanes: 3, laneW: 3.5, median: -10.5, wL: 5.25, wR: 5.25, halfW: 5.25, busLane: true, publicDrive: true };
contraflowEdge(e, contraflowBusLanes(floreasca, 3));
assert.equal(e.oneway, false); assert.equal(e.lanesF, 2); assert.equal(e.lanesB, 1); assert.equal(e.busLane, false);
assert.equal(e.wL + e.wR, 10.5, 'the carriageway keeps its width');
assert.equal(motorOneway(e), true);
assert.equal(lanesDir(e, -1), 1);
assert.equal(canTravel(e, 1), true); assert.equal(canTravel(e, -1), false, 'no private car against the one-way');
assert.equal(canTravelBus(e, -1), true);
assert.equal(actorCanTravel(e, -1, { bus: true }), true); assert.equal(actorCanTravel(e, -1, { bus: false }), false);
// lane centres (a→b frame): the bus lane fills the left 3.5 m, the general lanes the rest
const ab = (lane, dir) => laneOffset(e, lane, dir) * dir;
assert.equal(ab(0, -1), -3.5); assert.equal(ab(0, 1), 0); assert.equal(ab(1, 1), 3.5);
// a width pass moving the left kerb moves the divider with it
e.wL = 4.5; e.laneW = 3.25; layContraflowLanes(e);
assert.equal(e.laneCenterShiftM, -1.25);

// BUS lettering: inside the lane, along 3 m ahead of the near end, and mirrored for the other direction
const rects = laneLettering('BUS', 50, -3.5, -1, 3.5);
assert.ok(rects.length >= 10);
for (const [s0, s1, o0, o1] of rects) { assert.ok(s0 >= 47 - 1e-9 && s1 <= 50 + 1e-9); assert.ok(o0 >= -5.25 && o1 <= -1.75); }
const firstB = laneLettering('B', 0, 0, 1, 3.5), firstBRev = laneLettering('B', 0, 0, -1, 3.5);
assert.deepEqual(firstB.map(([s0, s1, o0, o1]) => [-s1, -s0, -o1, -o0].map(v => v + 0)), firstBRev.map(r => r.map(v => v + 0)));
// turn:lanes on a contraflow way: a role with no road for it at the way's end (the left turn is one node further on) keeps
// the lane going straight; elsewhere the role stays as mapped
const turnRules = (contraflowBus) => {
    const nodes = [[0, 0], [0, -100], [0, -200], [100, -100]].map(([x, z], id) => ({ id, x, z, edges: [] }));
    const link = (a, b, road, extra = {}) => { const A = nodes[a], B = nodes[b], len = Math.hypot(B.x - A.x, B.z - A.z), dirx = (B.x - A.x) / len, dirz = (B.z - A.z) / len; const f = { id: road, a: A, b: B, len, dirx, dirz, nx: -dirz, nz: dirx, road, oneway: true, lanesF: 1, lanesB: 0, ...extra }; A.edges.push(f); B.edges.push(f); return f; };
    const e = link(0, 1, 0, contraflowBus ? { oneway: false, lanesF: 2, lanesB: 1, contraflowBus: 1 } : { lanesF: 2 });
    link(1, 2, 1); link(1, 3, 2); // straight on, right turn; no left
    const rules = buildTurnLaneRules({ roads: [[0, 0, 2, 0, 0, 35, 0, 50, 1, 0, 0, 1]], turnLanes: [0, 0, -1], strings: ['left|through;right'] }, [e]);
    return rules.get(e)[1].map(s => s && [...s].sort());
};
assert.deepEqual(turnRules(true), [['left', 'through'], ['right', 'through']]);
assert.deepEqual(turnRules(false), [['left'], ['right', 'through']]);
console.log('PASS: contraflow bus lane tags, edge lanes, legality, lettering and unserved turn roles');
