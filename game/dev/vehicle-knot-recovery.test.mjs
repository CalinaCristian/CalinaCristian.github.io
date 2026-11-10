// node game/dev/vehicle-knot-recovery.test.mjs
// A visible knot must open by itself. Recorded in Grozăvești (Splaiul Independenței / Șoseaua Orhideelor, node 210)
// after 15 simulated minutes at source c82b1fa5: two southbound cars with their noses at the side of a crossing car
// (4.7 cm contact and a 7 cm gap: under the guard's 5 cm overlap threshold). Every car's small step was refused by
// the overlap guard each frame and nothing ever backed off, so the three stood for 158 s with a twelve-car queue
// behind them; where a contact was resolved, the path-order rule named the struck car as the "follower" and slid
// it along the noses instead of reversing a nose car.
// Production Grid and guard on recorded poses. Not a full junction, signal or journey acceptance.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { Traffic } from '../src/traffic.js';
import { obbPen, vObb } from './harness/page/util.js';

const RECORDED = [
    { id: 0, kind: 'compact-sedan', edgeLen: 10.5, s: 8.9849, x: 105.4906, z: -244.3223, heading: 1.31765, length: 4.36, width: 1.73 },   // crossing, struck
    { id: 23, kind: 'taxi', edgeLen: 11.8, s: 7.2706, x: 102.9395, z: -247.7474, heading: 3.04512, length: 4.36, width: 1.73 },           // nose in its side
    { id: 11, kind: 'small-suv', edgeLen: 11.8, s: 8.6132, x: 106.38, z: -247.4085, heading: 3.03239, length: 4.34, width: 1.8 },         // nose in its side
];
class EmptyTraffic extends Traffic { setupTransit() { } buildBusStops() { } spawnAll() { } }
const DT = 1 / 30;
function scene(creep = 0.003) {
    const t = new EmptyTraffic({ graph: { edges: [], nodes: [] }, buildings: [], walkTop: () => .13 }, { id: 'bucharest' }, new THREE.Scene(), { maxPeds: 0 });
    Object.assign(t, { _frame: 0, _dt: DT, world: {}, stats: {} });
    t.vehicles = RECORDED.map(q => ({ ...q, y: .24, odo: 0, speed: 0, layer: 0, dir: 1, lane: 0, laneCur: 0, latBlend: 0, latExtraCur: 0, hist: [], route: [], edge: { len: q.edgeLen },
        fx: -Math.sin(q.heading), fz: -Math.cos(q.heading), mesh: { position: new THREE.Vector3(q.x, .24, q.z), rotation: new THREE.Euler(0, q.heading, 0) } }));
    t.grid.build(t.vehicles);
    // one frame: every car proposes the small forward creep the recorded cars kept proposing, then the real guard runs
    t.frame = (movers = t.vehicles) => {
        t._frame++;
        for (const v of t.vehicles) {
            Object.assign(v, { _f: t._frame, _resp: false, _x0: v.x, _z0: v.z, _h0: v.heading, _s0: v.s, _odo0: v.odo, _e0: v.edge, _d0: v.dir, _ln0: v.lane, _ly0: v.layer, _y0: v.y, _lb0: 0, _lc0: 0, _le0: 0, _hl0: 0, _fx0: v.fx, _fz0: v.fz, _rx0: -v.fz, _rz0: v.fx, _tr0: null });
            if (movers.includes(v) && !(v.yieldT > 0)) { v.x += v.fx * creep; v.z += v.fz * creep; v.s += creep; v.odo += creep; v.mesh.position.set(v.x, v.y, v.z); }
            if (v.yieldT > 0) v.yieldT -= DT;
        }
        t.overlapGuard();
    };
    return t;
}
const pen = (a, b) => obbPen(vObb(a), vObb(b));

const t = scene(), [struck, noseA, noseB] = t.vehicles, start = t.vehicles.map(v => ({ x: v.x, z: v.z, s: v.s }));
assert.ok(pen(struck, noseA) > .04 && pen(struck, noseA) < .05 && pen(struck, noseB) > -.08, 'the recorded contact: one nose touching just under the 5 cm overlap threshold, the other 7 cm away');
for (let i = 0; i < 90; i++) t.frame();
assert.ok(pen(struck, noseA) <= -.2 && pen(struck, noseB) <= -.2, `the knot opens to a real gap within 3 s (${pen(struck, noseA).toFixed(3)}, ${pen(struck, noseB).toFixed(3)})`);
assert.ok(noseA.s < start[1].s - .2 && noseB.s < start[2].s - .2, 'the cars whose noses were in the other car reversed');
assert.ok(Math.hypot(noseA.x - start[1].x, noseA.z - start[1].z) < 2.2 && Math.hypot(noseB.x - start[2].x, noseB.z - start[2].z) < 2.2, 'the back-off is bounded');
assert.ok(struck.s > start[0].s - .05, 'the struck car is not slid backwards along the noses');
assert.ok(struck.s > start[0].s + .05, 'the struck car is moving on again');
assert.equal(noseA.yieldTo, struck); assert.equal(noseB.yieldTo, struck);
// no step during the recovery exceeds a slow reversing speed (0.8 m/s), and nothing is teleported
{
    const u = scene(); let worst = 0;
    for (let i = 0; i < 60; i++) { const before = u.vehicles.map(v => [v.x, v.z]); u.frame(); u.vehicles.forEach((v, k) => { worst = Math.max(worst, Math.hypot(v.x - before[k][0], v.z - before[k][1])); }); }
    assert.ok(worst <= .8 * DT + .003 + 1e-9, 'each frame moves a body at most the bounded recovery step: ' + worst);
}
// ordinary queueing is unchanged: a follower behind a stopped leader keeps the standing gap, nobody reverses or yields
{
    const q = scene(0);
    q.vehicles = [0, 1].map(i => ({ id: i, kind: 'sedan', x: 0, z: -i * 6, y: .24, s: 50 - i * 6, odo: 0, speed: 0, heading: Math.PI, fx: 0, fz: 1, length: 4.4, width: 1.8, layer: 0, dir: 1, lane: 0, laneCur: 0, latBlend: 0, latExtraCur: 0, hist: [], route: [], edge: { len: 100 },
        mesh: { position: new THREE.Vector3(0, .24, -i * 6), rotation: new THREE.Euler(0, Math.PI, 0) } }));
    q.grid.build(q.vehicles); const before = q.vehicles.map(v => v.z);
    for (let i = 0; i < 60; i++) q.frame([]);
    assert.deepEqual(q.vehicles.map(v => v.z), before); assert.ok(q.vehicles.every(v => !v.yieldTo && !(v.knotHold > 0)));
}
console.log('PASS: recorded Grozavesti node-210 knot opens by bounded reversing of the nose cars; struck car proceeds; ordinary queue unchanged');
