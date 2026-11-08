import assert from 'node:assert/strict';
import { Pedestrians, Traffic } from '../src/traffic.js';
import * as THREE from '../vendor/three.module.min.js';

const node = (x, z) => ({ x, z, radius: 2, edges: [] });
function edge(a, b, sidewalk = 2.5) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len;
    const e = { a, b, len, dirx, dirz, nx: -dirz, nz: dirx, wR: 3, wL: 3, halfW: 3, sidewalk, type: 'residential' };
    a.edges.push(e); b.edges.push(e); return e;
}
function walkers(edges) {
    const c = Object.create(Pedestrians.prototype);
    c.t = { world: { district: true, buildings: [], walkTop: () => 0.13 }, index: { near: () => edges }, stats: {}, grid: { items: null } };
    c.list = []; c.crowd = { reach: p => p === 99 ? 0.55 : 0.3, set() {}, markDirty() {} };
    c._walkSpace = new Map(); c._side = new Map(); c.obsGrid = { query() {} };
    c.grid = { query() {} }; c.crossCount = new Map(); c.stats = {}; c.rng = () => 0.1;
    return c;
}
const e = edge(node(0, 0), node(36, 0)), short = edge(node(0, 30), node(9, 30));
const C = walkers([e, short]);
e.wL = e.halfW = 7;
assert.equal(C.roadAt(12, 4), null, 'the narrow-side sidewalk uses wR rather than the opposite halfW');
assert.ok(C.roadAt(12, -4), 'the actual wider left carriageway remains a road');
e.wL = e.halfW = 3;
const capacity = C.walkSpace(e, 1).cells.length;
assert.ok(capacity > 0);
assert.equal(capacity, 4 * C.walkSpace(short, 1).cells.length, 'free walking length, rather than record count, controls admission weight');
// A real facade consumes sidewalk area, not just its centreline point.
C.t.world.buildings = [{ x: 18, z: 4.25, r: 21, poly: [[0,3],[36,3],[36,5.5],[0,5.5]] }];
C._walkSpace.clear();
assert.equal(C.walkSpace(e, 1).cells.length, 0, 'no admission slots inside a footprint');
C.t.world.buildings = []; C._walkSpace.clear();
const p = { i: 1, x: 10, z: 4.25, e, side: 1, dir: 1, s: 10, state: 'walk', legs: [], heading: 0, speed: 1.2, phase: 0, scale: 1 };
C.list = [p, { i: 99, x: 11.1, z: 4.25, state: 'walk' }];
assert.equal(C.freePersonalSpace(p), false, 'an umbrella keeps its actual carried reach plus walking clearance');
C.list[1].i = 2;
assert.equal(C.freePersonalSpace(p), true, 'the same open spot fits ordinary bodies');
// Include an inbound reservation from an adjacent graph record before its body arrives.
C.list.push({ i: 3, x: 0, z: 0, state: 'legs', next: { e, side: 1 } });
assert.equal(C.spaceLoad(e, 1, p), 2);
// A wholly full destination makes a new placement fail without altering the old pose/route.
C.t.player = { x: 200, z: 0, fx: 1, fz: 0 }; C.t.nearEdges = () => [e]; C.stops = [];
const full = C.walkSpace(e, 1).cells.length;
C.list = [p, ...Array.from({ length: full }, (_, i) => ({ i: i + 10, x: 18, z: 4, state: 'stand' })), ...Array.from({ length: full }, (_, i) => ({ i: i + 100, x: 18, z: -4, state: 'stand' }))];
p.next = { e, side: -1, dir: -1 }; p.walkOff = .2; p.dodge = .1; p.dodgeEdge = e;
const before = { x: p.x, z: p.z, s: p.s, side: p.side, dir: p.dir, next: p.next, walkOff: p.walkOff, dodge: p.dodge, heading: p.heading };
C.relocate(p, 0, 300, true);
assert.deepEqual(Object.fromEntries(Object.keys(before).map(k => [k, p[k]])), before);
// A busy street fork sends a walker to an available existing sidewalk.
const j = node(0, 0), incoming = edge(node(-30, 0), j), north = edge(j, node(0, -30)), south = edge(j, node(0, 30));
const D = walkers([incoming, north, south]); D.roadAt = () => null;
const q = { ...p, x: -3.2, z: 4.25, e: incoming, s: 26.8, dir: 1, side: 1, legs: [], recovery: null, next: null };
const ncap = D.walkSpace(north, 1).cells.length;
D.list = [q, ...Array.from({ length: ncap * 2 }, (_, i) => ({ i: i + 10, x: i % 2 ? 4 : -4, z: -15, state: 'stand' }))];
D.planNode(q, j);
assert.equal(q.next?.e, south, 'congestion selects the open source-graph outlet');
// An unreachably blocked recovery can turn back without changing physical position.
C.list = [p]; p.x = 10; p.z = 4.25; p.onRoad = false; p.state = 'legs'; p.recovery = { x: 15, z: 4.25, state: 'walk' };
const pose = { x: p.x, z: p.z };
assert.equal(C.replanWalk(p), true);
assert.deepEqual({ x: p.x, z: p.z }, pose);
assert.equal(p.recovery, null); assert.equal(p.state, 'walk'); assert.equal(p.dir, -1);
C.placeWalk(p);
assert.ok(Math.hypot(p.x - pose.x, p.z - pose.z) < 1e-9, 'adopting the new route preserves actual position');
// An already committed road recovery finds a clear kerb and walks every metre.
p.x = 10; p.z = 2.9; p.onRoad = true; p.state = 'legs'; p.recovery = { x: 15, z: 4.25, state: 'walk' }; p.dir = 1;
const roadPose = { x: p.x, z: p.z };
assert.equal(C.replanWalk(p), true);
assert.deepEqual({ x: p.x, z: p.z }, roadPose);
for (let f = 0; f < 60; f++) {
    const o = { x: p.x, z: p.z }; C.update(1 / 30);
    assert.ok(Math.hypot(p.x - o.x, p.z - o.z) <= 0.11, 'a road recovery exits at walking pace');
}
assert.ok(p.z > 3.8, 'a blocked recovery actually leaves the carriageway');
assert.equal(p.recovery, null);
// A blocked crossing can abandon its destination after a full minute, keeping its pose.
p.x = 10; p.z = 4.375; p.e = e; p.side = 1; p.dir = 1; p.s = 10; p.state = 'wait'; p.onRoad = false; p.waitT = 60.1;
p.legs = [{ cross: true, x: 10, z: -4.375 }];
const waitPose = { x: p.x, z: p.z }; C.update(1 / 30);
assert.deepEqual({ x: p.x, z: p.z }, waitPose);
assert.equal(p.state, 'walk'); assert.equal(p.dir, -1, 'a blocked queue takes a source sidewalk return route');
let amp;
C.crowd.set = (_, v) => { amp = v.amp; };
for (let i = 0; i < 90; i++) C.writeMatrices(1 / 30);
assert.equal(amp, 0, 'state=walk does not animate legs in place');
for (let i = 0; i < 90; i++) { p.x += p.speed / 30; C.writeMatrices(1 / 30); }
assert.ok(amp > 0.95, 'actual walking drives a natural full gait');
for (let i = 0; i < 90; i++) C.writeMatrices(1 / 30);
assert.equal(amp, 0, 'gait settles when physically stopped');
// The actual camera protects a person behind the travel heading during look-back.
C.t.player = { x: 0, z: 0, fx: 0, fz: -1 }; C._fr = 1;
const camera = new THREE.PerspectiveCamera(70, 1, .1, 500); camera.position.set(0, 1.6, 0); camera.lookAt(0, 1.1, 180);
globalThis.game = { traffic: C.t, camera };
assert.equal(C.inView({ x: 0, z: 180 }), true, 'look-back protects a visible source or destination behind the car');
delete globalThis.game;
// A parked car across the nearest kerb needs a real corner detour; a new
// straight recovery target alone cannot get there with the walking clearance.
const E = walkers([e]), parked = { x: 13, z: 4.25, heading: -Math.PI / 2, length: 4, width: 1.4 };
E.t.grid = { items: [parked], query(x, z, r, fn) { fn(parked); } };
const source = { x: 13, z: 2.5 }, goal = { x: 5, z: 4.375 };
assert.equal(E.clearWalkSegment(source, goal, true), false, 'straight recovery is physically blocked');
const detour = E.escapeRoute(source, [goal], true);
assert.ok(detour?.legs.length >= 2, 'a clear route walks round the parked-car corner');
let from = source;
for (const leg of detour.legs) { assert.equal(E.clearWalkSegment(from, leg, true), true); from = leg; }
assert.deepEqual(from, goal);
assert.equal(E.freeVehiclePoint(13, 3.0), false, 'recovery planning uses the normal 0.7 m body clearance');
// Large-map setup must rebuild the vehicle grid after pooling/splicing cars,
// before the new pedestrian admission queries it (qa16 threw at Grid.query).
const setup = Object.create(Traffic.prototype); let rebuilt = false;
setup._large = true; setup.vehicles = [{ mesh: { visible: true } }]; setup.pool = [];
setup.relocate = () => false; setup.grid = { build(list) { rebuilt = list.length === 0; } };
setup.peds = { relocateAll() { assert.equal(rebuilt, true, 'admission sees the final vehicle grid'); } };
setup.setPlayer({ x: 0, z: 0 });
assert.equal(setup.pool.length, 1);
console.log('PASS: physical walking capacity, carried clearance, preserved failed placement, congestion routing, continuous recovery and measured-motion gait/camera visibility');
