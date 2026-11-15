// Bellevue park activities (2026-11-15): opening hours by the in-game clock, the season windows, and the achievements
// that are listed, live and counted (the retired park walks are not).
import assert from 'node:assert/strict';
import { spotTime, openNow, hoursText, hoursLabel, seasonWindow } from '../../src/spots/park-hours.js';
import { availability } from '../../src/spots/activity-offer.js';
import { ACHIEVEMENTS } from '../../src/data.js';
import { activityAvailable } from '../../src/spot-availability.js';
import { ACTIVITIES } from '../../src/spots/index.js';

// a session at a given Pacific time (or a fixed time-of-day look), with an optional picked season
const at = (iso, { override = null, season = null } = {}) => ({ r3d: { simDate: new Date(iso), clock: { override }, _seasonOverride: season, weather: { season: season || 'autumn' } }, spot: { clock: { timeZone: 'America/Los_Angeles' } } });
const PARK = { open: 6, close: 23 }, SUP = { open: 10, close: 21, season: (s) => (s.r3d._seasonOverride || s.r3d.weather.season) !== 'winter' };

assert.equal(Math.round(spotTime(at('2026-07-04T20:30:00Z')).h * 10) / 10, 13.5); // 13:30 PDT
assert.equal(spotTime(at('2026-07-04T20:30:00Z', { override: 'night' })).h, 23.2);
assert(openNow(PARK, at('2026-07-04T20:30:00Z')));
assert(!openNow(PARK, at('2026-07-04T20:30:00Z', { override: 'night' })), 'the park shuts at 23:00');
assert(!openNow(SUP, at('2026-07-04T15:00:00Z')), 'board rentals open at 10:00 (08:00 here)');
assert(!openNow(SUP, at('2026-07-04T20:30:00Z', { season: 'winter' })), 'no boards in winter');
assert.equal(hoursText(SUP), '10:00–21:00');
assert.equal(hoursLabel(SUP, 'Rent a board')(at('2026-07-04T15:00:00Z')), 'Rent a board (open 10:00–21:00)');
assert.equal(hoursLabel(SUP, 'Rent a board')(at('2026-07-04T20:30:00Z')), 'Rent a board');
// a closed activity is listed under "Opens later" (activity-offer.js reads tourAvailable)
assert.equal(availability({ tourAvailable: (s) => openNow(SUP, s) }, at('2026-07-04T15:00:00Z')), 'later');
assert.equal(availability({ tourAvailable: (s) => openNow(SUP, s) }, at('2026-07-04T20:30:00Z')), 'now');

// the rink window: Nov 21 – Jan 19 by the date, or whenever Winter is picked (and never when another season is picked)
const ctx = { onUpdate() {} }, rink = seasonWindow(ctx, [11, 21], [1, 19], 'winter');
assert(rink(at('2026-12-10T20:00:00Z')) && rink(at('2027-01-10T20:00:00Z')));
assert(!rink(at('2026-11-15T20:00:00Z')) && !rink(at('2027-02-01T20:00:00Z')));
assert(rink(at('2026-07-04T20:00:00Z', { season: 'winter' })) && !rink(at('2026-12-10T20:00:00Z', { season: 'summer' })));

// achievements: the six new ones are live, listed and counted; the retired walks are not
for (const key of ['bel-downtown-park:frisbee', 'bel-downtown-park:swing', 'bel-downtown-park:skate', 'bel-meydenbauer:sup', 'bel-meydenbauer:swim', 'bel-meydenbauer:skip']) {
    const a = ACHIEVEMENTS.find((x) => x.activity === key); assert(a && a.live && activityAvailable(a), key);
    assert(ACTIVITIES.some((x) => `${x.spot}:${x.id}` === key), 'listed ' + key);
}
for (const key of ['bel-downtown-park:loop', 'bel-meydenbauer:pier-end']) assert(!activityAvailable(ACHIEVEMENTS.find((a) => a.activity === key)), key);
assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'achievement ids are unique');
console.log('Bellevue park activities: hours, seasons and achievements passed.');
