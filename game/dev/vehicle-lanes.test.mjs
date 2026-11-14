import assert from 'node:assert/strict';
import { Traffic } from '../src/traffic.js';
import { SharedLaneGate } from '../src/shared-lanes.js';
import * as THREE from '../vendor/three.module.min.js';

const a = { x: 0, z: 0, y: 0, edges: [] }, b = { x: 500, z: 0, y: 0, edges: [] };
const e = { a, b, len: 500, dirx: 1, dirz: 0, nx: 0, nz: 1, laneW: 3.5, lanesF: 3, lanesB: 0, oneway: true };
a.edges = b.edges = [e];
const t = Object.create(Traffic.prototype);
t.sharedLanes = new SharedLaneGate([e]);
function car(long = false) {
    const v = { edge: e, dir: 1, s: 100, lane: 0, laneCur: 0, lateralExtra: 0, latExtraCur: 0, speed: 0, long, length: long ? 18 : 4.4, hist: [], route: [], mesh: new THREE.Object3D(), transition: 0 };
    t.placeOnLane(v, true, 0); return v;
}
const dt = 1 / 30;
for (const long of [false, true]) {
    const v = car(long), start = { x: v.x, z: v.z, h: v.heading };
    v.lane = 1; v.lateralExtra = 0.8;
    for (let f = 0; f < 300; f++) { t.steerLane(v, dt); t.placeOnLane(v, false, dt); }
    assert.equal(v.laneCur, 0, 'stopped lane planning cannot translate the physical lane');
    assert.equal(v.latExtraCur, 0, 'stopped bypass planning cannot translate the physical lane');
    assert.deepEqual({ x: v.x, z: v.z, h: v.heading }, start, 'a stopped car holds its physical pose');
    // Actual forward movement can steer, with one shared distance budget.
    v.speed = 3;
    for (let f = 0; f < 100; f++) {
        const lane = v.laneCur, extra = v.latExtraCur, z = v.z;
        t.steerLane(v, dt); v.s += v.speed * dt; t.placeOnLane(v, false, dt);
        assert.ok(Math.abs(v.laneCur - lane) * e.laneW + Math.abs(v.latExtraCur - extra) <= 0.45 * v.speed * dt + 1e-9);
        assert.ok(Math.abs(v.z - z) <= 0.45 * v.speed * dt + 1e-9, 'actual lateral steering is bounded by forward travel');
    }
    assert.ok(v.z - start.z > 2, 'a moving car actually makes progress into its planned lane');
    // Stop midway, while the drawn body still has a residual target error.
    v.speed = 0; const stopped = { x: v.x, z: v.z, h: v.heading };
    for (let f = 0; f < 300; f++) { t.steerLane(v, dt); t.placeOnLane(v, false, dt); }
    assert.deepEqual({ x: v.x, z: v.z, h: v.heading }, stopped, 'residual damping cannot keep drifting after braking');
}
// Hidden population work may not move a visible source or snap an unsuccessful
// candidate back onto a different interpolated lane.
const visible = car(); visible.laneCur = 0.4; visible.x += 0.1; visible.z += 0.2;
t.player = { x: visible.x - 10, z: visible.z, fx: 1, fz: 0 };
const held = t.savePose(visible);
assert.equal(t.respawn(visible), false, 'automatic respawn cannot remove a visible stopped source');
assert.equal(t.relocate(visible, 250, 650, true), false, 'automatic relocation cannot remove a visible stopped source');
assert.deepEqual(t.savePose(visible), held);
t.player = { x: 1000, z: 1000, fx: 1, fz: 0 };
t.world = { graph: { edges: [e] } }; t.rng = () => 0.5; t.rng.range = (a, b) => (a + b) / 2;
t.carLaneMax = () => 2; t.spawnClear = () => false; t.nearEdges = () => [e];
visible.mesh.rotation.x = 0.08; visible.desiredMul = 1; visible.odo = 200; visible.route = [{ e, dir: 1 }]; visible.hist = [{ e, dir: 1 }];
const original = t.savePose(visible);
assert.equal(t.respawn(visible), false);
assert.deepEqual(t.savePose(visible), original, 'failed respawn restores the exact physical pose and route');
assert.equal(t.relocate(visible, 0, 2000, true), false);
assert.deepEqual(t.savePose(visible), original, 'failed relocation restores the exact physical pose and route');
t.hot = [{ L: 1, edges: [e], laneM: e.len }]; t.rng.int = () => 0;
assert.equal(t.placeInHot(visible), false);
assert.deepEqual(t.savePose(visible), original, 'failed rush placement restores the full physical pose');
t.player = { x: visible.x + 10, z: visible.z, fx: 1, fz: 0, length: 5.78, width: 1.8, front: 3.42, rear: 2.36 };
t.nudge(visible);
assert.deepEqual(t.savePose(visible), original, 'a visible blocked queue without contact never snaps backward or respawns');
t.player.x = visible.x + 4; t.grid = { query() {} }; t._dt = dt;
const contact = { x: visible.x, z: visible.z };
t.nudge(visible);
assert.ok(Math.hypot(visible.x - contact.x, visible.z - contact.z) <= 0.8 * dt + 1e-9, 'visible contact nudges have a physical correction budget');
const terminal = car(true); terminal.s = e.len + 0.1; terminal.speed = 4;
t.player = { x: terminal.x - 10, z: terminal.z, fx: 1, fz: 0 };
t.advance(terminal);
assert.equal(terminal.speed, 0, 'a visible route-ending vehicle waits instead of driving off the graph');
assert.ok(terminal.s < e.len);
// Exact road directions/lengths of the reported short Victoriei transition.
const junction = { x: 1.1, z: 6.4, y: 0, radius: 11, edges: [] };
const before = { x: 0, z: 0, y: 0, radius: 11, edges: [] }, after = { x: 1.1 - 0.76975796 * 21.3054, z: 6.4 + 0.63833587 * 21.3054, y: 0, radius: 5.75, edges: [] };
function link(a, b, lanes) { const len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len; const e = { a, b, len, dirx, dirz, nx: -dirz, nz: dirx, laneW: 3.5, lanesF: lanes, lanesB: 0, oneway: true }; a.edges.push(e); b.edges.push(e); return e; }
const short = link(before, junction, 3), exit = link(junction, after, 1);
const turning = car(); turning.edge = short; turning.s = short.len - 0.002; turning.laneCur = turning.lane = 2; turning.route = [{ e: exit, dir: 1 }]; turning.speed = 0.1;
t.placeOnLane(turning, true, 0); const entry = { x: turning.x, z: turning.z };
turning.s += turning.speed * dt; t.advance(turning); t.placeOnLane(turning, false, dt);
assert.ok(Math.hypot(turning.x - entry.x, turning.z - entry.z) <= 1.1 * turning.speed * dt + 1e-9, 'a short skew road/lane drop cannot project the body metres sideways on restart');
const yielding = car(); yielding.width = 1.8; yielding._f = 7; yielding._x0 = yielding.x; yielding._z0 = yielding.z; yielding._h0 = yielding.heading;
const cornerWalker = { x: yielding.x + 3.3, z: yielding.z, onRoad: false };
yielding.x += 1;
const safety = Object.create(Traffic.prototype); safety._frame = 7; safety.vehicles = [yielding]; safety.stats = {};
safety.sharedLanes = new SharedLaneGate([e]);
safety.peds = { grid: { query(x, z, r, fn) { fn(cornerWalker); } } };
safety.revert = v => { v.x = v._x0; v.z = v._z0; v.heading = v._h0; return true; };
safety.pedestrianGuard();
assert.equal(yielding.x, yielding._x0, 'a moving body yields before sweeping over a sidewalk/corner pedestrian');
assert.equal(yielding.speed, 0);
safety.player = null; safety.grid = { items: false }; cornerWalker.x = yielding.x;
assert.equal(Traffic.prototype.spawnClear.call(safety, yielding), false, 'a hidden vehicle placement cannot overlap an existing pedestrian');
console.log('PASS: stopped lane/bypass holds, moving steering distance budget, long-body clearance, residual stop and visible/failed recovery holds');
