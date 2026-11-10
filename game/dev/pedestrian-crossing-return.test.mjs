import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import { Traffic, Pedestrians } from '../src/traffic.js';
import { EdgeIndex } from '../src/nav.js';

class EmptyTraffic extends Traffic { setupTransit() {} buildBusStops() {} spawnAll() {} }
function scene() {
    const empty = new EmptyTraffic({ graph: { edges: [], nodes: [] }, buildings: [], walkTop: () => .13 }, { id: 'seattle' }, new THREE.Scene(), { maxPeds: 0 });
    const a = { id: 0, x: 0, z: -100, radius: 2, edges: [] }, b = { id: 1, x: 0, z: 100, radius: 2, edges: [] };
    const e = { id: 1, a, b, len: 200, dirx: 0, dirz: 1, nx: -1, nz: 0, wR: 3, wL: 3, halfW: 3, sidewalk: 3, type: 'residential', ya: 0, yb: 0 };
    a.edges = b.edges = [e];
    const v = { x: 0, z: 0, y: .24, heading: 0, length: 4.36, width: 1.73, speed: 0 };
    const C = Object.create(Pedestrians.prototype), t = { world: { district: true, buildings: [], walkTop: () => .13 }, index: new EdgeIndex([e]), stats: {}, vehicles: [v], grid: { items: [v], query(x, z, r, fn) { fn(v); } } };
    Object.assign(C, { t, list: [], crowd: { reach: () => .3, set() {} }, grid: empty.peds.grid, obsGrid: empty.peds.obsGrid, obs: [], stats: {}, _fr: 0, _walkSpace: new Map(), _side: new Map(), crossCount: new Map(), rng: () => { throw Error('No recovery RNG'); } });
    const p = { i: 454, x: 1.175, z: 0, e, s: 100, side: -1, dir: 1, state: 'legs', legs: [{ x: 4.6, z: 0, cross: true, started: true, back: true, sx: 4.6, sz: 0, len: 5 }], next: { e, s: 100, side: -1, dir: 1 }, onRoad: true, heading: -Math.PI / 2, speed: 1.44, phase: 0, scale: 1, live: true, waitT: 0, walkOff: 0, progressX: 1.175, progressZ: 0, progressT: 6.01 };
    C.list = [p]; C.buildGrid();
    return { C, p, v };
}
const f = scene();
const automatic = scene();
for (let i = 0; i < 300; i++) { automatic.C.buildGrid(); automatic.C.update(1 / 30); }
assert.ok(automatic.C.stats.replans > 0 && automatic.p.x > 4, 'the actual stalled-progress watchdog plans and completes the return');
const recovery = scene();
recovery.p.recovery = { x: 4.6, z: 0, state: 'walk', onRoad: false, legs: [] };
recovery.p.legs = [{ x: 4.6, z: 0, cross: true, started: true, recovery: true }];
for (let i = 0; i < 300; i++) { recovery.C.buildGrid(); recovery.C.update(1 / 30); }
assert.ok(recovery.C.stats.replans > 0 && recovery.p.x > 4 && !recovery.p.recovery, 'a stalled visible alignment recovery also reaches a source sidewalk');
const outbound = scene(); outbound.p.legs[0].back = false;
assert.equal(outbound.C.replanWalk(outbound.p, { blockedReturn: true }), false, 'the watchdog does not cancel a normal outbound crossing');
assert.equal(f.C.replanWalk(f.p), false, 'ordinary active crossing retains its existing plan');
const original = [f.p.x, f.p.z], bodies = JSON.stringify(f.C.t.vehicles);
assert.ok(f.C.replanWalk(f.p, { blockedReturn: true }), 'a stalled return can plan to a real available sidewalk');
assert.deepEqual([f.p.x, f.p.z], original, 'planning never moves the person');
assert.ok(f.p.legs[0].vehicleEscape && f.p.legs[0].escape, 'only the returned escape carries the motion context');
let maxStep = 0, minimum = Infinity;
for (let i = 0; i < 300; i++) {
    const x = f.p.x, z = f.p.z;
    f.C.buildGrid(); f.C.update(1 / 30);
    maxStep = Math.max(maxStep, Math.hypot(f.p.x - x, f.p.z - z));
    minimum = Math.min(minimum, Math.max(Math.abs(f.p.x) - f.v.width / 2, Math.abs(f.p.z) - f.v.length / 2));
}
assert.ok(f.p.x > 4, 'the physical pedestrian leaves the car and reaches the sidewalk');
assert.ok(maxStep < .13 && minimum >= .3, 'every actual step retains body clearance and normal walking pace');
assert.equal(JSON.stringify(f.C.t.vehicles), bodies, 'no vehicle moves, hides or changes dimensions to clear the return');

const detour = scene();
assert.equal(detour.C.clearWalkSegment(detour.p, { x: -4.6, z: 0 }, true, { reach: 3 }), false, 'direct route through the stopped body is refused');
assert.equal(detour.C.escapeRoute(detour.p, [{ x: -4.6, z: 0 }], true), null, 'legacy comfort margin traps this starting point');
detour.C._fr++;
const route = detour.C.escapeRoute(detour.p, [{ x: -4.6, z: 0 }], true, { reach: 3 });
assert.ok(route?.legs.length >= 2, 'a bounded physical detour goes around the complete stopped rectangle');
let from = detour.p;
for (const to of route.legs) { assert.ok(detour.C.clearWalkSegment(from, to, true, { reach: 3 })); from = to; }
const crowd = scene(), q = { ...crowd.p, i: 455, x: 2.1, z: 0, state: 'stand', onRoad: false, legs: [] };
crowd.C.list.push(q); crowd.C.buildGrid();
const peerPoses = JSON.stringify(crowd.C.list.map(p => [p.i, p.x, p.z]));
assert.equal(crowd.C.clearWalkSegment(crowd.p, { x: 4.6, z: 0 }, true, { reach: 3 }, crowd.p), false, 'a vehicle-clear shortcut through a peer is blocked');
const peerRoute = crowd.C.escapeRoute(crowd.p, [{ x: 4.6, z: 0 }], true, { reach: 3 });
assert.ok(peerRoute?.legs.length >= 2, 'the local planner finds a physical route around the peer');
from = crowd.p;
for (const to of peerRoute.legs) { assert.ok(crowd.C.clearWalkSegment(from, to, true, { reach: 3 }, crowd.p)); from = to; }
assert.equal(JSON.stringify(crowd.C.list.map(p => [p.i, p.x, p.z])), peerPoses, 'peer planning never pushes or moves the crowd');
const ring = scene(); ring.p.x = 0; ring.p.z = 10;
ring.C.list = [ring.p, ...Array.from({ length: 6 }, (_, i) => ({ ...q, i: 460 + i, x: .6 * Math.cos(i * Math.PI / 3), z: 10 + .6 * Math.sin(i * Math.PI / 3) }))]; ring.C.buildGrid();
assert.equal(ring.C.escapeRoute(ring.p, [{ x: 4.6, z: 10 }], true, { reach: 3 }), null, 'a completely occupied first step remains blocked instead of crossing people');
assert.equal(detour.C.vehicleEscapePointClear(detour.p, 1.1, 0), false, 'a deeper step is still blocked');
const second = { ...detour.v, x: 2.4 };
detour.C.t.vehicles.push(second); detour.C.t.grid.query = (x, z, r, fn) => detour.C.t.vehicles.forEach(fn);
assert.equal(detour.C.vehicleEscapePointClear(detour.p, 1.205, 0), false, 'escaping one body cannot move toward another body');
detour.C.t.vehicles.pop(); detour.C.t.grid.query = (x, z, r, fn) => fn(detour.v);
assert.equal(detour.C.clearWalkStep(1.2, 0, true), false, 'ordinary walking keeps the unchanged comfort margin');
assert.equal(detour.C.clearWalkStep(1.2, 0, true, detour.p), true, 'only a separating return step can leave an existing margin');
const carried = scene(); carried.p.x = 1.5; carried.p.legs[0].vehicleEscape = true; carried.C._stepDt = 1 / 30;
carried.C.crowd.reach = () => .6;
assert.equal(carried.C.avoidVehicles(carried.p, 1.6, 0, true), true, 'a marked escape still protects the actual carried-item radius');
assert.equal(carried.p.x, 1.6);
assert.equal(carried.C.vehicleEscapePointClear({x:1.6,z:0,radius:NaN},1.7,0), false, 'an unresolved carried radius cannot authorize an escape');
carried.C.crowd.reach = () => .3; carried.p.x = 1.5;
assert.equal(carried.C.avoidVehicles(carried.p, 1.6, 0, true), false, 'a body-clear tight escape corridor can be used');
carried.p.legs = []; carried.p.x = 1.5;
assert.equal(carried.C.avoidVehicles(carried.p, 1.6, 0, true), true, 'ordinary walking retains the full comfort margin');
detour.C.inWater = () => true;
assert.equal(detour.C.clearWalkStep(1.2, 0, true, detour.p), false, 'water cannot be used for an escape');

const native = JSON.parse(fs.readFileSync(new URL('./fixtures/basarab-pedestrian-return.json', import.meta.url)));
const v = { ...native.vehicle, heading: native.vehicle.h, length: native.vehicle.L, width: native.vehicle.W }, p = native.person, C = scene().C;
C.t.vehicles = C.t.grid.items = [v]; C.t.grid.query = (x, z, r, fn) => fn(v);
const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), dx = p.x - v.x, dz = p.z - v.z, side = Math.sign(-dx * fz + dz * fx);
const away = { x: p.x - fz * side * .03, z: p.z + fx * side * .03 };
assert.equal(C.freeVehiclePoint(p.x, p.z), false, 'actual454 starts inside the native stopped-body comfort margin');
assert.equal(C.vehicleEscapePointClear(p, away.x, away.z), true, 'actual454 has a physically separating first step');
assert.equal(C.vehicleEscapePointClear(p, 2 * p.x - away.x, 2 * p.z - away.z), false, 'the actual toward-body step stays blocked');
console.log('PASS: bounded physical crossing/recovery escape, unchanged ordinary comfort, complete vehicle/peer detours and blocked ring, carried body, source/actor/water/native454 controls');
