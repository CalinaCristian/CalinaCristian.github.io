#!/usr/bin/env node
// Deterministic scoring/physics checks; no browser, network, or saved progress.
import assert from 'node:assert/strict';
import { FootballPhysics, BALL_RADIUS } from '../../src/football.js';
const pitch = { halfLength: 52.06, halfWidth: 32.5, goalHalfWidth: 3.66, goalHeight: 2.34 };
let checks = 0;
const run = (name, fn) => { fn(); checks++; console.log('PASS', name); };
const roll = (ball, seconds) => { for (let i = 0; i < seconds * 120; i++) ball.update(1 / 120); };
const shot = (s = 1) => {
    const ball = new FootballPhysics(pitch);
    ball.update(0.05, { from: { u: -0.8 * s, v: 0, h: 0.32 }, to: { u: 0, v: 0, h: 0.32 } });
    return ball;
};
for (const sign of [-1, 1]) run(`swept drone kick from centre scores in ${sign < 0 ? 'north' : 'south'} goal`, () => {
    const b = shot(sign); assert.equal(b.touched, true); roll(b, 12); assert.equal(b.goals, 1);
});
run('rolling without a drone touch cannot unlock a goal', () => {
    const b = new FootballPhysics(pitch); b.vel.u = 25; roll(b, 8); assert.equal(b.goals, 0);
});
run('a teleported drone cannot impart a scoring kick', () => {
    const b = new FootballPhysics(pitch);
    b.update(1 / 60, { from: { u: -100, v: 0, h: 0.32 }, to: { u: 100, v: 0, h: 0.32 } });
    assert.equal(b.touched, false); assert.equal(b.vel.u, 0);
});
run('a drone well above the football cannot touch it', () => {
    const b = new FootballPhysics(pitch);
    b.update(0.05, { from: { u: -0.8, v: 0, h: 3 }, to: { u: 0, v: 0, h: 3 } });
    assert.equal(b.touched, false);
});
run('wide shots and side entry behind the goal do not score', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51, v: 5, h: BALL_RADIUS }; b.vel.u = 20; b.touched = true;
    roll(b, 0.1); assert.equal(b.goals, 0);
    b.pos = { u: 53, v: 4, h: BALL_RADIUS }; b.vel = { u: 0, v: -20, h: 0 }; roll(b, 0.3); assert.equal(b.goals, 0);
});
run('an overbar shot does not score', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51.7, v: 0, h: 3 }; b.vel = { u: 20, v: 0, h: 0 }; b.touched = true;
    roll(b, 0.1); assert.equal(b.goals, 0);
});
run('the whole football must cross the goal line', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51.8, v: 0, h: BALL_RADIUS }; b.vel.u = 1; b.touched = true;
    roll(b, 0.4); assert.ok(b.pos.u < pitch.halfLength + BALL_RADIUS); assert.equal(b.goals, 0);
    roll(b, 0.3); assert.equal(b.goals, 1);
});
run('a ball stopped partway over the line can be nudged fully in', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51.9, v: 0, h: BALL_RADIUS }; b.vel.u = 1; b.touched = true;
    roll(b, 0.1); b.vel.u = 0; roll(b, 0.1); assert.equal(b.goals, 0);
    b.vel.u = 2; roll(b, 0.2); assert.equal(b.goals, 1);
});
run('a post impact rebounds and is not a goal', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51.5, v: 3.66, h: BALL_RADIUS }; b.vel.u = 8; b.touched = true;
    roll(b, 0.3); assert.equal(b.goals, 0); assert.ok(b.vel.u < 0);
});
run('a crossbar impact rebounds and is not a goal', () => {
    const b = new FootballPhysics(pitch); b.pos = { u: 51.6, v: 0, h: 2.4 }; b.vel = { u: 12, v: 0, h: 0.3 }; b.touched = true;
    roll(b, 0.1); assert.equal(b.goals, 0); assert.ok(b.vel.u < 0);
});
run('scoring calls the unlock hook once, then resets for another attempt', () => {
    let calls = 0; const b = shot(); b.onGoal = () => calls++;
    roll(b, 7); assert.equal(calls, 1); assert.equal(b.goals, 1);
    roll(b, 5); assert.deepEqual(b.pos, { u: 0, v: 0, h: BALL_RADIUS }); assert.equal(b.touched, false); assert.equal(calls, 1);
});
run('reset clears eligibility and unfinished goal entry', () => {
    const b = shot(); b.entry[1] = true; b.reset(); assert.equal(b.touched, false); assert.equal(b.entry[1], false);
    assert.deepEqual(b.pos, { u: 0, v: 0, h: BALL_RADIUS });
});
console.log(`${checks}/${checks} football checks passed`);
