// Old Town day activities: opening hours across midnight, the karaoke tune, and the registry entries that go with them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACHIEVEMENTS } from '../../src/data.js';
import { activityAvailable } from '../../src/spot-availability.js';

const source = fs.readFileSync(new URL('../../src/spots/scenes/old-town-daylife.js', import.meta.url), 'utf8');
// the pure helpers, lifted from the module (the module itself needs a browser: three.js scene, DOM panels)
const pick = (name) => { const m = new RegExp(`export (const ${name} = .*|function ${name}\\(.*)`).exec(source); assert(m, name); return m[1]; };
const lifted = ['DAYLIFE_HOURS', 'openAt', 'KARAOKE_BEAT', 'KARAOKE_TUNE', 'karaokeNote'].map(pick).join('\n');
const { DAYLIFE_HOURS, openAt, KARAOKE_BEAT, KARAOKE_TUNE, karaokeNote } = await import('data:text/javascript;base64,' + Buffer.from(`${lifted}\nexport { DAYLIFE_HOURS, openAt, KARAOKE_BEAT, KARAOKE_TUNE, karaokeNote };`).toString('base64'));

// hours: a daytime range, and ranges that run past midnight
assert(openAt(8, DAYLIFE_HOURS.coffee) && openAt(15, DAYLIFE_HOURS.coffee) && !openAt(16, DAYLIFE_HOURS.coffee) && !openAt(7, DAYLIFE_HOURS.coffee));
assert(openAt(10, DAYLIFE_HOURS.papanasi) && openAt(23, DAYLIFE_HOURS.papanasi) && openAt(1, DAYLIFE_HOURS.papanasi) && !openAt(2, DAYLIFE_HOURS.papanasi) && !openAt(9, DAYLIFE_HOURS.papanasi));
assert(openAt(21, DAYLIFE_HOURS.karaoke) && openAt(0, DAYLIFE_HOURS.karaoke) && openAt(2, DAYLIFE_HOURS.karaoke) && !openAt(3, DAYLIFE_HOURS.karaoke) && !openAt(20, DAYLIFE_HOURS.karaoke));
assert(openAt(10, DAYLIFE_HOURS.busker) && openAt(23, DAYLIFE_HOURS.busker) && !openAt(0, DAYLIFE_HOURS.busker) && !openAt(9, DAYLIFE_HOURS.busker));
// by day (13:00) at least three places are open, and at night (22:00) karaoke is
assert(['coffee', 'papanasi', 'busker'].every((k) => openAt(13, DAYLIFE_HOURS[k])) && !openAt(13, DAYLIFE_HOURS.karaoke));
assert(openAt(22, DAYLIFE_HOURS.karaoke) && !openAt(22, DAYLIFE_HOURS.coffee));

// the tune: eight bars of four, every note inside the lane, breaths between phrases
const beats = KARAOKE_TUNE.reduce((n, [, b]) => n + b, 0);
assert.equal(beats, 32); assert(KARAOKE_BEAT > .5 && KARAOKE_BEAT < .8);
assert(KARAOKE_TUNE.every(([n]) => n === null || (n >= -2 && n <= 14)));
assert.equal(karaokeNote(-1), undefined); assert.equal(karaokeNote(0), 0); assert.equal(karaokeNote(7.5), null); assert.equal(karaokeNote(20.5), 12); assert.equal(karaokeNote(32), undefined);

// every activity the module completes is listed for the spot and has a live achievement that counts
const emitted = [...source.matchAll(/bucActivity\(s2?, SPOT, '([a-z-]+)'/g)].map((m) => m[1]);
assert.deepEqual([...new Set(emitted)].sort(), ['jacks-papanasi', 'lipscani-busker', 'lipscani-coffee', 'lipscani-photo-walk', 'mojo-karaoke']);
const registry = fs.readFileSync(new URL('../../src/spots/index.js', import.meta.url), 'utf8');
for (const id of emitted) {
    assert(registry.includes(`['old-town-lipscani', '${id}',`), `ACTIVITIES lists ${id}`);
    const a = ACHIEVEMENTS.find((x) => x.activity === `old-town-lipscani:${id}`);
    assert(a && a.live && a.cat === 'landmarks' && activityAvailable(a), `achievement for ${id}`);
}
console.log('Old Town day activities: hours across midnight, the 32-beat tune and five registered, counted achievements passed.');
