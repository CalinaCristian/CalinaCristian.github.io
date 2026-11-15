// Spot activities after the 2026-11-15 owner pass: what the map offers, the island race rules, pétanque's meter, the
// free boat's water and buoys, and the achievements that stay consistent with what is offered.
import assert from 'node:assert/strict';
import { offered, availability, offerName } from '../../src/spots/activity-offer.js';
import { compileRaceCourse, createRace } from '../../src/spots/race-course.js';
import { meter, reach } from '../../src/spots/petanque.js';
import { waterTest, placeBuoys } from '../../src/spots/free-boat.js';
import { ACHIEVEMENTS } from '../../src/data.js';
import { activityAvailable } from '../../src/spot-availability.js';
import { ACTIVITIES } from '../../src/spots/index.js';

// ---- the offer: interactive things only, at this hour
const s = {};
assert(offered({ kind: 'activity', x: 1, z: 1, label: 'Toss a coin to the busker' }, s));
for (const kind of ['plaque', 'photo-hunt', 'inscription', 'viewpoint', 'walk-goal', 'stairs', 'frame', 'talk', 'guide']) assert(!offered({ kind, x: 1, z: 1, label: 'x' }, s), kind);
assert(!offered({ x: 1, z: 1, label: 'Exit · return to the bookshop' }, s));
assert(!offered({ x: 1, z: 1, label: 'Ride the elevator back down' }, s));
assert(!offered({ x: 8000, z: 8001, label: 'Pour a shot · Freddo' }, s), 'interiors are not listed');
assert(!offered({ hidden: true, x: 1, z: 1, label: 'x' }, s));
assert.equal(availability({ tourAvailable: () => false }, s), 'later');
assert.equal(availability({ cond: () => false }, s), null);
assert.equal(availability({}, s), 'now');
assert.equal(offerName({ label: 'Freddo · closed · opens at 22:00' }, s), 'Freddo · opens at 22:00');

// ---- the island race: a lap a little off the centreline, past a runner, at running pace, wins
const ring = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; ring.push([Math.cos(a) * 20, Math.sin(a) * 20]); } ring[48] = [...ring[0]];
const course = compileRaceCourse(ring), race = createRace(course);
assert(race.start({ x: 22.5, z: 0 }), 'a start 2.5 m from the line is accepted');
let s0 = 0, p = { x: 22.5, z: 0 };
for (let t = 0; t < 120 && !['won', 'lost'].includes(race.snapshot().state); t += .05) {
    if (race.snapshot().state === 'running') s0 = Math.min(course.length, s0 + 4.4 * .05);
    const q = course.at(s0), off = 1.8 + Math.sin(t) * .6; // 1.2–2.4 m wide of the centreline
    p = { x: q.x * (1 + off / 20), z: q.z * (1 + off / 20) }; race.tick(.05, p);
}
assert.equal(race.snapshot().state, 'won', JSON.stringify({ ...race.snapshot(), rivals: undefined }));
// a teleport still loses
const r2 = createRace(course); r2.start({ x: 20, z: 0 }); for (let t = 0; t < 3.2; t += .05) r2.tick(.05, { x: 20, z: 0 }); r2.tick(.05, { x: -20, z: 0 });
assert.equal(r2.snapshot().state, 'lost');

// ---- pétanque: the meter swings 0 → 1 → 0, a throw reaches 2.5–11 m
assert.equal(meter(0), 0); assert(Math.abs(meter(.85) - 1) < 1e-9); assert(meter(1.7) < 1e-9); assert.equal(reach(0), 2.5); assert.equal(reach(1), 11);

// ---- the free boat: a square lake with an island, a bridge no-go strip; buoys are on reachable open water, spread out
const lake = [[0, 0], [120, 0], [120, 80], [0, 80]], island = [[50, 30], [70, 30], [70, 50], [50, 50]];
const water = waterTest(lake, { holes: [island], avoid: (x, z) => Math.abs(x - 100) < 3 && z > 20, clearance: 1.6 });
assert(water(10, 10) && !water(60, 40) && !water(0.5, 10) && !water(100, 60) && !water(-5, 10));
const buoys = placeBuoys(water, { x: 10, z: 10 }, { reach: 200 });
assert.equal(buoys.length, 3); for (const b of buoys) assert(water(b.x, b.z));
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert(Math.hypot(buoys[i].x - buoys[j].x, buoys[i].z - buoys[j].z) > 25);

// ---- achievements follow the offer: retired ones do not count, the new ones do and are listed
for (const key of ['old-town-lipscani:lipscani-photo-walk', 'arcul-de-triumf:arcul-baguette', 'space-needle:loupe', 'bel-meydenbauer:pier-end', 'bel-downtown-park:loop', 'cismigiu:rotunda'])
    assert(!activityAvailable(ACHIEVEMENTS.find((a) => a.activity === key)), key);
for (const key of ['arcul-de-triumf:arcul-petanque', 'pike-place:starbucks-coffee', 'old-town-lipscani:wcp-halba', 'cismigiu:rowboat', 'bel-meydenbauer:kayak']) {
    const a = ACHIEVEMENTS.find((x) => x.activity === key); assert(a && a.live && activityAvailable(a), key);
    assert(ACTIVITIES.some((x) => `${x.spot}:${x.id}` === key), 'listed ' + key);
}
console.log('Spot activity offer, island race, pétanque, free boat and achievement consistency passed.');
