import assert from 'node:assert/strict';
import { assignSignalPhases, signalState } from '../src/signals.js';
import { Traffic, playerPen } from '../src/traffic.js';
import { makeCrowd, dressFor, CROWD_FLAGS } from '../src/crowd.js';
import * as THREE from '../vendor/three.module.min.js';

function node(x, z) { return { x, z, id: `${x},${z}`, y: 0, radius: 5, edges: [] }; }
function edge(a, b, name = 'road') {
    const len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len;
    const e = { a, b, len, dirx, dirz, nx: -dirz, nz: dirx, laneW: 3.3, lanesF: 1, lanesB: 0, oneway: true, name };
    a.edges.push(e); b.edges.push(e); return e;
}
// The actual Romană approach angles: the old 45-degree binary bucketing gave
// Grigore Alexandrescu and Lascăr Catargiu green together despite crossing.
const crossing = node(0, 0);
const approaches = [-9.566, 34.816, 170.372, -144.612].map((a, i) => {
    const r = a * Math.PI / 180;
    return { edge: edge(node(-40 * Math.cos(r), -40 * Math.sin(r)), crossing, i % 2 ? 'Catargiu' : 'Alexandrescu'), node: crossing };
});
const controller = { offset: 0, phaseCount: assignSignalPhases(approaches) };
assert.equal(controller.phaseCount, 2, 'the skew crossing needs a separate phase');
const slot = 11;
for (let t = -100; t < 4 * slot * 3; t += 0.05) {
    const active = approaches.filter(ap => signalState(controller, ap.phase, t, 11) !== 'red');
    assert.ok(new Set(active.map(ap => ap.phase)).size <= 1, `conflicting axes active at ${t}`);
}
for (const ap of approaches) {
    const t = ap.phase * slot;
    assert.equal(signalState(controller, ap.phase, t + 1, 11), 'green');
    assert.equal(signalState(controller, ap.phase, t + 7, 11), 'yellow');
    assert.equal(signalState(controller, ap.phase, t + 9, 11), 'red');
}
assert.equal(signalState(controller, undefined, 0, 11), 'red', 'unknown approaches fail closed');

// Two split pads with an intervening lane, crossed by a third pad. Reservations
// must compare the whole movement across the controller rather than node identity.
const west = node(-50, 0), left = node(-10, 0), right = node(10, 0), east = node(70, 0);
const north = node(0, -50), middle = node(0, 0), south = node(0, 70);
const incoming = edge(west, left), internal = edge(left, right), outgoing = edge(right, east);
const crossIn = edge(north, middle, 'crossing'), crossOut = edge(middle, south, 'crossing');
const cl = { nodes: [left, right, middle], offset: 0, phaseCount: 2 };
for (const n of cl.nodes) n.lightCluster = cl;
const t = Object.create(Traffic.prototype);
t.time = 0; t.boxes = new Map();
t.world = { lights: cl.nodes.map(node => ({ node })), nodeLight: { [left.id]: { approaches: [{ edge: incoming, phase: 0 }] }, [middle.id]: { approaches: [{ edge: crossIn, phase: 1 }] } } };
const car = { edge: incoming, dir: 1, lane: 0, laneCur: 0, length: 4.4, width: 1.8, speed: 2, s: incoming.len - 10, route: [{ e: internal, dir: 1 }, { e: outgoing, dir: 1 }] };
const other = { ...car, edge: crossIn, route: [{ e: crossOut, dir: 1 }] };
let path = t.boxCheck(car, incoming, 1, car.route[0], left, 5);
t.boxClaim(car, left, path);
assert.equal(t.boxCheck(other, crossIn, 1, other.route[0], middle, 5), 'wait', 'crossing split-node paths conflict');
car.edge = internal; car.s = 5;
t.syncSignalOccupancy();
assert.deepEqual(cl.occupiedPhases, [0]);
assert.equal(signalState(cl, 1, slot + 1, 11), 'red', 'occupied split box holds conflicting green');
t.time = 45;
t.pruneBoxes();
assert.equal(t.boxes.get(cl).length, 1, 'slow committed cars never lose their clearance reservation on a timeout');
car.edge = outgoing; car.s = 5;
t.syncSignalOccupancy();
assert.equal(signalState(cl, 1, slot + 1, 11), 'red', 'rear still inside the last pad');
car.s = 10;
t.syncSignalOccupancy(); t.pruneBoxes();
assert.deepEqual(cl.occupiedPhases, []);
assert.notEqual(t.boxCheck(other, crossIn, 1, other.route[0], middle, 5), 'wait');
assert.equal(signalState(cl, 1, slot + 1, 11), 'green', 'waiting queue is released once the rear clears');

// Opposing circular greens are permissive: a left turn yields to the reserved
// oncoming straight path rather than meeting it in the junction.
const center = node(0, 0), w = node(-50, 0), e = node(50, 0), n = node(0, -50);
const westIn = edge(w, center), eastIn = edge(e, center), westOut = edge(center, w), northOut = edge(center, n);
const turning = { ...car, edge: westIn, s: 30, route: [{ e: northOut, dir: 1 }] };
const straight = { ...car, edge: eastIn, s: 30, route: [{ e: westOut, dir: 1 }] };
t.boxes.clear();
t.boxClaim(straight, center, t.boxCheck(straight, eastIn, 1, straight.route[0], center, 5));
assert.equal(t.boxCheck(turning, westIn, 1, turning.route[0], center, 5), 'wait', 'left turn yields to oncoming straight reservation');

const shortEnd = node(3, -1), farEnd = node(3, -60);
const shortOut = edge(center, shortEnd), following = edge(shortEnd, farEnd);
const bus = { ...turning, length: 18, odo: 100, route: [{ e: shortOut, dir: 1 }, { e: following, dir: 1 }] };
const busPath = t.reservationPath(bus, westIn, 1, bus.route[0], center, 5);
t.boxes.clear(); t.boxClaim(bus, center, busPath);
bus.edge = shortOut; bus.s = 1; bus.odo = 121;
assert.ok(t.inBox(busPath, center));
bus.edge = following; bus.s = 1; bus.odo = 124;
assert.ok(t.inBox(busPath, center), 'a bus on a short exit still holds the box for its rear');
bus.odo = 136;
assert.equal(t.inBox(busPath, center), false, 'a bus releases after its rear clears along subsequent segments');
bus.odo = 124; bus._moveGeneration = 1;
assert.equal(t.inBox(busPath, center), false, 'relocated vehicles leave no stale occupied reservation');

// Keep the cockpit's asymmetric body and carried-item clearance in the gates.
const player = { x: 0, z: 0, fx: 1, fz: 0, front: 3.42, rear: 2.36, length: 5.78, width: 1.8 };
const bumper = { x: 3.5, z: 0, fx: 1, fz: 0, length: 0.4, width: 1.8 };
assert.ok(playerPen(bumper, player) > 0, 'the visible nose ahead of the eye collides');
assert.ok(playerPen({ ...bumper, x: -2.7 }, player) < 0, 'empty space behind the visible boot stays clear');
const crowd = makeCrowd({ max: 2, season: 'summer', rng: () => 0.9 });
const outfit = dressFor('bucharest', 'summer', null, () => 0.9);
crowd.dress(0, { ...outfit, flags: 0 });
crowd.dress(1, { ...outfit, flags: CROWD_FLAGS.umbrella });
assert.ok(crowd.reach(1) > crowd.reach(0), 'an open umbrella needs more clearance than the body');
crowd.set(0, { prop: 'guitar' });
assert.ok(crowd.reach(0) >= 0.5, 'a carried guitar participates in clearance');
crowd.dispose();

const empty = new Traffic({ graph: { nodes: {}, edges: [] }, pois: [], buildings: [] }, { id: 'test', traffic: { density: 0 } }, new THREE.Scene(), { maxPeds: 0 });
const peds = empty.peds;
const person = { i: 0, live: true, x: 10, z: 0, phase: 0, speed: 1.4, scale: 1, state: 'walk', legs: [], onRoad: false };
empty.player = { x: 0, z: 0, fx: 1, fz: 0 };
peds.list = [person]; peds.buildGrid();
peds.relocate(person, 30, 200, true);
assert.equal(person.x, 10, 'a hidden recycle never moves a visible source');
peds.recoverPose(person, 0, 0);
assert.equal(person.x, 0, 'recovery preserves the current physical pose');
for (let i = 0; i < 60; i++) {
    const x = person.x, z = person.z; peds.update(1 / 30);
    assert.ok(Math.hypot(person.x - x, person.z - z) <= 1.45 / 30 + 1e-6, 'recovery takes walking steps');
}
assert.ok(person.x > 2 && person.x < 3, 'recovery makes sustained progress');
const neighbor = { ...person, i: 1, x: person.x + 0.01, state: 'legs', recovery: null, legs: [] };
person.state = 'legs'; person.recovery = null; peds.list = [person, neighbor]; peds.buildGrid();
const separationStart = person.x;
peds.separate(1 / 30);
assert.ok(Math.abs(person.x - separationStart) <= 1.3 / 30 + 1e-6, 'crowd un-piling shares one walking-step budget per frame');
const walkEdge = edge(node(0, 0), node(100, 0)); walkEdge.halfW = 6;
const walker = { ...person, x: 50, z: 7.5, e: walkEdge, side: 1, s: 50, dir: 1, walkOff: -0.04 };
peds.sideObs = () => [{ s: 50, u: 7.5, hs: 0.5, hu: 0.6, okIn: true, okOut: true }];
const before = peds.dodgeAt(walker); walker.walkOff = 0.04;
assert.equal(Math.sign(peds.dodgeAt(walker)), Math.sign(before), 'a passing offset cannot flip the obstacle detour across the person');
walker.walkOff = 0; walker.dodge = 0; walker.dodgeEdge = walkEdge; walker.dodgeFrame = -1;
peds._fr++; peds.dodgeAt = () => 1.5;
peds.placeWalk(walker);
assert.ok(Math.abs(walker.z - 7.5) <= 2 / 30 + 1e-6, 'a changed detour moves laterally at walking speed');
walker.x = 50.2; walker.z = 9.1;
peds.syncWalkPose(walker); peds.placeWalk(walker);
assert.ok(Math.hypot(walker.x - 50.2, walker.z - 9.1) < 1e-6, 'an obstacle push retains its full physical pose and active detour');
const bridge = edge(walkEdge.b, node(150, 0)); bridge.bridge = true; bridge.sidewalk = 0;
peds.planNode(walker, walkEdge.b);
assert.notEqual(walker.next?.e, bridge, 'a corner plan never sends a sidewalk walker onto an excluded bridge/carriageway');
empty.dispose();
console.log('PASS: signal cycles/conflicts/clearance, queue release, cockpit/props, visible recycling, walking recoveries and stable detours');
