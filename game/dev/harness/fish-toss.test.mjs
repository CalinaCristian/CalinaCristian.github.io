import assert from 'node:assert/strict';
import { createFishToss, fishOpen, FISH_TOSS } from '../../src/spots/fish-toss.js';
import { ACHIEVEMENTS } from '../../src/data.js';
import { activityAvailable } from '../../src/spot-availability.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const run = (g, s) => { let ev = null; for (let t = 0; t < s; t += 0.05) ev = g.tick(0.05) || ev; return ev; };
const toWindow = (g) => { while (g.snapshot().state === 'call') g.tick(0.05); while (!g.snapshot().catchNow) g.tick(0.05); };

// opening hours: Pike Place Fish, daily 7 am - 5 pm
assert(!fishOpen(6.99) && fishOpen(7) && fishOpen(16.9) && !fishOpen(17) && !fishOpen(23) && !fishOpen(NaN));

// a perfect run: three catches win, the two mongers take turns
{ const g = createFishToss({ rng: seq([0.5]) }), throwers = [];
    for (let i = 0; i < 3; i++) { toWindow(g); throwers.push(g.snapshot().thrower); assert.equal(g.action(true), 'catch'); run(g, FISH_TOSS.caught + 0.1); }
    assert.equal(g.snapshot().state, 'won'); assert.equal(g.snapshot().catches, 3); assert.deepEqual(throwers, [0, 1, 0]); }

// pressing during the call does nothing; too early drops it; looking away drops it; idling lets it fall
{ const g = createFishToss({ rng: seq([0.5]) });
    assert.equal(g.action(true), null);
    run(g, FISH_TOSS.call + 0.05); assert.equal(g.snapshot().state, 'flight'); assert.equal(g.action(true), 'early');
    run(g, FISH_TOSS.dropped + 0.1); toWindow(g); assert.equal(g.action(false), 'look');
    run(g, FISH_TOSS.dropped + 0.1); assert.equal(run(g, 4.5), 'lost'); // the third fish hits the floor: 0 of 3 with 2 left can't reach 3
    assert.equal(g.snapshot().misses, 3); assert.equal(g.snapshot().catches, 0); }

// two misses still leave the win open; cancelling never wins
{ const g = createFishToss({ rng: seq([0.2, 0.7, 0.4]) });
    for (let i = 0; i < 2; i++) { run(g, FISH_TOSS.call + 0.05); g.action(true); run(g, FISH_TOSS.dropped + 0.1); }
    for (let i = 0; i < 3; i++) { toWindow(g); assert.equal(g.action(true), 'catch'); run(g, FISH_TOSS.caught + 0.1); }
    assert.equal(g.snapshot().state, 'won'); assert.equal(g.snapshot().thrown, 5);
    const h = createFishToss(); toWindow(h); h.cancel(); assert.equal(h.snapshot().state, 'cancelled'); assert.equal(h.action(true), null); }
assert.throws(() => createFishToss().tick(0.5));

// the achievements: a catch, and the crew's challenge, both live Pike Place activities
for (const [id, act] of [['lm-pike-fish', 'pike-place:fish'], ['lm-pike-fish-crew', 'pike-place:fish-crew']]) {
    const a = ACHIEVEMENTS.find((q) => q.id === id); assert(a, id); assert.equal(a.activity, act); assert(a.live); assert(activityAvailable(a)); }
console.log('Fish toss: hours, alternating throwers, timing + aim catches, misses, loss, cancel and achievements passed.');
