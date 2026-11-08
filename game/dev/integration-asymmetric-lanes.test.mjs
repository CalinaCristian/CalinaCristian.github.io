import test from 'node:test';
import assert from 'node:assert/strict';
import { Traffic, laneOffset } from '../src/traffic.js';
import { roadSideWidth, roadWidthAt } from '../src/nav.js';
import { SharedLaneGate } from '../src/shared-lanes.js';
import * as THREE from '../vendor/three.module.min.js';

const close = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function edge(a, b, extra = {}) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), dirx = (b.x - a.x) / len, dirz = (b.z - a.z) / len;
    const e = { a, b, len, dirx, dirz, nx: -dirz, nz: dirx, laneW: 3, lanesF: 1, lanesB: 3, median: 0,
        wR: 10, wL: 2, laneCenterShiftM: 7, ya: 0, yb: 0, ...extra };
    a.edges.push(e); b.edges.push(e); return e;
}
const node = x => ({ x, z: 0, edges: [], radius: 3 });
const traffic = () => Object.create(Traffic.prototype);
function vehicle(e, dir, lane = 0, long = false) {
    return { edge: e, dir, s: 50, lane, laneCur: lane, latExtraCur: 0, lateralExtra: 0, speed: 0,
        length: long ? 18 : 4.4, width: 1.8, long, hist: [], route: [], mesh: new THREE.Object3D() };
}
test('unequal direction counts place every lane inside measured extents, including reverse lanes on the canonical right', () => {
    const e = edge(node(0), node(100)), T = traffic();
    for (const [dir, count, expected] of [[1, 1, [8.5]], [-1, 3, [5.5, 2.5, -.5]]]) for (let lane = 0; lane < count; lane++) {
        const pose = T.laneTarget(vehicle(e, dir, lane), {});
        close(pose.z, expected[lane]);
        assert(pose.z - .9 >= -e.wL && pose.z + .9 <= e.wR);
    }
    const symmetric = { laneW: 3, median: 0 };
    close(laneOffset(symmetric, 0, 1), 1.5); close(laneOffset(symmetric, 0, -1), 1.5);
    close(roadWidthAt(e, 50, 5.5), 10); close(roadWidthAt(e, 50, -1), 2);
    close(roadSideWidth({ halfW: 4 }, -1), 4);
    const one = edge(node(0), node(100), { oneway: true, median: -6, lanesF: 2, lanesB: 0, laneCenterShiftM: 1.5, wR: 4.5, wL: 1.5 });
    close(T.laneTarget(vehicle(one, 1, 0), {}).z, 0); close(T.laneTarget(vehicle(one, 1, 1), {}).z, 3);
});
test('long-body path and junction reservation preserve physical centres across reversed prepared edge ordering', () => {
    const a = node(0), b = node(100), c = node(200), e = edge(a, b), f = edge(c, b, { laneCenterShiftM: -7, wR: 2, wL: 10, lanesF: 3, lanesB: 1 });
    const T = traffic(), v = vehicle(e, 1, 0, true); v.s = 98; v.route = [{ e: f, dir: -1 }];
    for (const off of [-15, -4, 0, 4, 15]) close(T.pathPoint(v, off, {}).z, 8.5);
    const path = T.boxPath(v, e, 1, { e: f, dir: -1 }, 3);
    close(path.p0z, 8.5); close(path.p1z, 8.5);
    T.placeOnLane(v, true, 0); const held = { x: v.x, z: v.z, heading: v.heading };
    v.lane = 1; v.lateralExtra = .5;
    for (let i = 0; i < 120; i++) { T.steerLane(v, 1 / 30); T.placeOnLane(v, false, 1 / 30); }
    assert.deepEqual({ x: v.x, z: v.z, heading: v.heading }, held);
});
test('asymmetric shared lane has one physical path for both graph directions and shifted player occupancy blocks entry', () => {
    const a = node(0), b = node(100), e = edge(a, b, { sharedLane: true, sharedLaneWidthM: 3.2, laneCenterShiftM: 1, wR: 2.6, wL: .6, lanesB: 1 });
    const T = traffic(), gate = new SharedLaneGate([e]), one = vehicle(e, 1), two = vehicle(e, -1);
    close(T.laneTarget(one, {}).z, 1); close(T.laneTarget(two, {}).z, 1);
    const player = { x: 50, z: 1, fx: -1, fz: 0, y: .24, length: 4.4, width: 1.8 };
    gate.update([], player, 0); assert.equal(gate.canPlace(e, 1, []), false);
    player.z = -4; gate.update([], player, 1); assert.equal(gate.canPlace(e, 1, []), true);
});
test('tram median paths shift in both travel directions without moving the source centreline', () => {
    const e = edge(node(0), node(100), { median: 4.4, laneCenterShiftM: 2 }), T = traffic();
    const forward = vehicle(e, 1), reverse = vehicle(e, -1); forward.tram = reverse.tram = true;
    close(T.laneTarget(forward, {}).z, 3.45); close(T.laneTarget(reverse, {}).z, .55);
    close(e.a.z, 0); close(e.b.z, 0);
});
