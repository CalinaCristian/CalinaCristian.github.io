#!/usr/bin/env node
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import { BasketballPhysics, RosettiBasketball, BASKETBALL_RADIUS as R, BASKETBALL_STEP as STEP } from '../../src/basketball.js';
import { ACHIEVEMENTS } from '../../src/data.js';

const hoop = { rim: [0, 3.045, 0], radius: 0.23, wire: 0.015, board: [0.25, 3.125, 0], normal: [-1, 0], width: 1.8, height: 1.05, thickness: 0.05 };
const court = { center: [-4, 0.07, 0], hoops: [hoop] };
const pos = { x: -4, y: 1.4, z: 0 };
let checks = 0;
const run = (name, fn) => { fn(); checks++; console.log('PASS', name); };
const roll = (b, seconds, dt = STEP) => { for (let i = 0; i < Math.round(seconds / dt); i++) b.update(dt); };
const fall = (p, v = { x: 0, y: -2, z: 0 }) => { const b = new BasketballPhysics(court); b.launch(p, v, Math.hypot(v.x, v.y, v.z)); return b; };
let direction;
for (let angle = 25; angle < 80; angle += 0.02) {
    const r = angle * Math.PI / 180, d = { x: Math.cos(r), y: Math.sin(r), z: 0 }, b = new BasketballPhysics(court);
    if (b.predict(pos, d).baskets) { direction = d; break; }
}
run('fixed-speed physical throw can make the existing-size rim', () => {
    assert.ok(direction, 'a human-aimed fixed-power shot must be possible');
    const b = new BasketballPhysics(court); b.launch(pos, direction); roll(b, 2.4); assert.equal(b.baskets, 1);
});
run('preview and throw use exactly the same integration and contacts', () => {
    const b = new BasketballPhysics(court), preview = b.predict(pos, direction); b.launch(pos, direction);
    for (let i = 1; i < preview.points.length; i++) { roll(b, STEP * 8); assert.deepEqual(b.pos, preview.points[i]); }
    assert.equal(b.baskets, preview.baskets);
});
run('the whole ball must cross downward before the basket counts', () => {
    const b = fall({ x: 0, y: 3.045 + R + 0.01, z: 0 });
    roll(b, 0.05); assert.equal(b.baskets, 0); assert.ok(b.pos.y > 3.045 - R);
    roll(b, 0.1); assert.equal(b.baskets, 1);
});
run('a physically clear angled descent passes the spherical opening', () => {
    const b = fall({ x: -0.2, y: 3.35, z: 0 }, { x: 2, y: -2.5, z: 0 }); roll(b, 0.3); assert.equal(b.baskets, 1);
});
run('the visible aimed pose is the real fixed-speed release', () => {
    const control = Object.create(RosettiBasketball.prototype), camera = new THREE.PerspectiveCamera();
    camera.position.set(-4, 1.65, 0); camera.rotation.set(0.5, -Math.PI / 2, 0, 'YXZ');
    Object.assign(control, { game: { camera }, source: new THREE.Group(), physics: new BasketballPhysics(court), held: true, arc: { visible: true }, available: () => true, syncMesh: () => {} });
    const aimed = control.pose(), predicted = control.physics.predict(aimed.pos, aimed.dir);
    assert.ok(aimed.dir.y > Math.sin(0.5), 'the lob lifts the release while leaving the hoop in view');
    assert.equal(control.interact(), true); assert.deepEqual(control.physics.pos, { x: aimed.pos.x, y: aimed.pos.y, z: aimed.pos.z });
    for (let i = 1; i < predicted.points.length; i++) { roll(control.physics, STEP * 8); assert.deepEqual(control.physics.pos, predicted.points[i]); }
    assert.equal(control.held, false); assert.equal(control.arc.visible, false);
});
run('a side entry below the top plane cannot score', () => {
    const b = fall({ x: -0.05, y: 3.04, z: 0 }); roll(b, 0.4); assert.equal(b.baskets, 0);
});
run('an upward pass cannot score', () => {
    const b = fall({ x: 0, y: 2.8, z: 0 }, { x: 0, y: 3, z: 0 }); roll(b, 0.2); assert.equal(b.baskets, 0);
});
run('wide throws and rim impacts are misses', () => {
    const b = fall({ x: 0, y: 3.3, z: 0.5 }); roll(b, 0.4); assert.equal(b.baskets, 0);
    const rim = fall({ x: -0.23, y: 3.25, z: 0 }); roll(rim, 0.05); assert.ok(rim.vel.y > 0, 'rim rebounds upward'); assert.equal(rim.baskets, 0);
});
run('the actual backboard face rebounds the ball', () => {
    const b = fall({ x: -0.1, y: 3.4, z: 0 }, { x: 8, y: 0, z: 0 }); roll(b, 0.05); assert.ok(b.vel.x < 0); assert.equal(b.baskets, 0);
});
run('floor bounce loses energy and remains above the court', () => {
    const b = fall({ x: -4, y: 0.4, z: 0 }); roll(b, 0.1); assert.ok(b.pos.y >= court.center[1] + R); assert.ok(b.vel.y > 0 && b.vel.y < 3);
});
run('dropped or placed balls do not award the secret', () => {
    const b = new BasketballPhysics(court); b.launch({ x: 0, y: 3.5, z: 0 }, { x: 0, y: -1, z: 0 }, 1, false); roll(b, 0.5); assert.equal(b.baskets, 0);
});
run('Drop releases the held ball into gravity without scoring eligibility', () => {
    const control = Object.create(RosettiBasketball.prototype), release = { x: -4, y: 1.4, z: 0 };
    Object.assign(control, { physics: new BasketballPhysics(court), held: true, arc: { visible: true }, hands: { visible: true },
        available: () => true, pose: () => ({ pos: release }), syncMesh: () => {} });
    assert.equal(control.drop(), true); assert.equal(control.held, false); assert.equal(control.physics.eligible, false);
    assert.deepEqual(control.physics.pos, release); roll(control.physics, 0.1); assert.ok(control.physics.pos.y < release.y); assert.equal(control.physics.baskets, 0);
});
run('fast frames retain swept full-ball scoring and match fine frames', () => {
    const fast = new BasketballPhysics(court), fine = new BasketballPhysics(court); fast.launch(pos, direction); fine.launch(pos, direction);
    roll(fast, 2.5, 0.25); roll(fine, 2.5); assert.deepEqual(fast.pos, fine.pos); assert.equal(fast.baskets, 1);
});
run('each throw calls the award once, reset removes pending eligibility', () => {
    let calls = 0; const b = new BasketballPhysics(court, () => calls++); b.launch(pos, direction); roll(b, 4); assert.equal(calls, 1);
    b.launch(pos, direction); roll(b, 2.4); assert.equal(calls, 2); b.reset(); assert.equal(b.eligible, false); assert.equal(b.entries.size, 0);
});
run('invalid dt cannot corrupt a resting ball', () => {
    const b = new BasketballPhysics(court), p = { ...b.pos }; for (const dt of [0, -1, NaN, Infinity]) b.update(dt); assert.deepEqual(b.pos, p);
});
run('the eighth secret has one live catalogue row and a stable id', () => {
    assert.equal(ACHIEVEMENTS.filter(a => a.cat === 'secret').length, 8);
    const rows = ACHIEVEMENTS.filter(a => a.id === 'rosetti-basket'); assert.equal(rows.length, 1); assert.equal(rows[0].hidden, true); assert.notEqual(rows[0].live, false);
});
console.log(`${checks}/${checks} basketball checks passed`);
