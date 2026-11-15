// Activities for the spots that had nothing to do (2026-11-15): the game engines (table tennis, bowling, the concert's
// applause, the peacock stalk), and the achievements that are listed, live and counted once the spot is available.
import assert from 'node:assert/strict';
import { createRally, TT } from '../../src/spots/table-tennis.js';
import { createRoll, scoreGame, nextRoll, powerAt, speedOf, BOWL } from '../../src/spots/bowling.js';
import { createConcert, PROGRAMME, ENCORE_CLAPS } from '../../src/spots/concert-etiquette.js';
import { createStalk, PEACOCK } from '../../src/spots/peacock-stalk.js';
import { openNow, hoursText } from '../../src/spots/park-hours.js';
import { ACHIEVEMENTS } from '../../src/data.js';
import { activityAvailable } from '../../src/spot-availability.js';
import { ACTIVITIES } from '../../src/spots/index.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const run = (g, secs, ...a) => { let ev = null; for (let t = 0; t < secs; t += 0.05) ev = g.tick(0.05, ...a) || ev; return ev; };

// ---- table tennis: his serve comes in; swing on time and in reach returns it; early, late, out of reach and no swing lose the point
{ const g = createRally({ rng: seq([0.5]) });
    assert.equal(g.snapshot().state, 'oppServe'); run(g, 1.2); assert.equal(g.snapshot().state, 'in');
    const T = g.snapshot().flight.T; while (g.snapshot().time < T - 0.02) g.tick(0.02);
    assert.equal(g.swing(0.9), 'hit'); assert.equal(g.snapshot().state, 'out');
    const h = createRally({ rng: seq([0.5]) }); run(h, 1.2); assert.equal(h.swing(), 'early'); assert.equal(h.snapshot().opp, 1);
    const k = createRally({ rng: seq([0.5]) }); run(k, 1.2); const T2 = k.snapshot().flight.T; while (k.snapshot().state === 'in' && k.snapshot().time < T2 + 0.4) k.tick(0.05); assert.equal(k.snapshot().opp, 1); assert.equal(k.snapshot().last.why, 'missed');
    const far = createRally({ rng: seq([0.95]) }); run(far, 1.2); const f = far.snapshot().flight; while (far.snapshot().time < f.T - 0.02) far.tick(0.02, Math.sign(-f.vEnd)); assert.equal(far.swing(), 'reach'); }
// a winner: he plays from one side, you put it in the far corner — he cannot reach it; first to five wins the game
{ const g = createRally({ rng: seq([0.99, 0.99, 0.2, 0.5]) }); let guard = 0;
    while (!['won', 'lost'].includes(g.snapshot().state) && guard++ < 20000) {
        const s = g.snapshot();
        if (s.state === 'serve') g.swing(-Math.sign(s.ov || 1));
        else if (s.state === 'in') { const side = Math.sign(s.flight.vEnd - s.pv) * (Math.abs(s.flight.vEnd - s.pv) > 0.05 ? 1 : 0); if (s.time >= s.flight.T - 0.03) g.swing(-Math.sign(s.ov || 1)); g.tick(0.02, side); continue; }
        g.tick(0.02);
    }
    assert.equal(g.snapshot().state, 'won', JSON.stringify(g.snapshot())); assert.equal(g.snapshot().me, TT.toWin); }
assert.throws(() => createRally().tick(0.5));

// ---- bowling: scoring (strikes, spares, the last frame's bonus balls), the roll order, and the pin physics
assert.deepEqual(scoreGame([10, 7, 3, 9, 1, 10]).frames.map((f) => f.total), [20, 39, 59]);
assert.equal(scoreGame([10, 10, 10, 10, 10]).total, 90);
assert.deepEqual(scoreGame([3, 4, 10, 5]).frames.map((f) => f.total), [7, null, null]);
assert.deepEqual(nextRoll([3, 4, 10, 5]), { frame: 2, ball: 1, over: false, fresh: false });
assert.equal(nextRoll([3, 4, 2, 2, 1, 1]).over, true); assert.equal(nextRoll([3, 4, 2, 2, 9, 1]).over, false); assert.equal(nextRoll([3, 4, 2, 2, 9, 1, 5]).over, true);
assert.equal(powerAt(0), 0); assert.equal(powerAt(BOWL.period / 2), 1); assert(speedOf(0) === BOWL.minSpeed && speedOf(1) === BOWL.maxSpeed);
{ const pocket = createRoll({ x: 0.06, angle: 0, speed: 8 }).run(); assert.equal(pocket.down.length, 10, 'a pocket ball strikes');
    const gutter = createRoll({ x: 0.4, angle: 0.05, speed: 8 }).run(); assert(gutter.gutter); assert.equal(gutter.down.length, 0);
    const spare = createRoll({ x: 0.46, angle: -0.004, speed: 8, standing: [6] }).run(); assert(spare.down.length <= 1);
    let total = 0, strikes = 0, n = 0; for (let x = -0.4; x <= 0.401; x += 0.05) for (let a = -0.03; a <= 0.0301; a += 0.01) { const r = createRoll({ x, angle: a, speed: 8 }).run(); total += r.down.length; strikes += r.down.length === 10; n++; }
    assert(strikes / n > 0.1 && strikes / n < 0.5, `strike rate ${strikes / n}`); assert(total / n > 3 && total / n < 9, `mean pins ${total / n}`); }

// ---- the concert: applause between movements is a faux pas; a clean concert with an ovation is perfect and earns an encore
{ const total = PROGRAMME.reduce((a, [, d]) => a + d, 0); assert(total > 50 && total < 80, 'a short concert');
    const to = (c, state) => { let guard = 0; while (c.snapshot().state !== state && guard++ < 4000) c.tick(0.05); };
    const bad = createConcert(); to(bad, 'pause1'); assert.equal(bad.clap(), 'between'); to(bad, 'hold'); assert.equal(bad.clap(), 'too-soon'); to(bad, 'ovation'); bad.clap(); to(bad, 'end');
    assert.equal(bad.snapshot().perfect, false); assert.deepEqual(bad.snapshot().faux, ['between', 'too-soon']);
    const good = createConcert(); to(good, 'entrance'); assert.equal(good.clap(), 'welcome'); to(good, 'ovation'); for (let i = 0; i < ENCORE_CLAPS; i++) assert.equal(good.clap(), 'bravo');
    to(good, 'encore'); assert.equal(good.snapshot().state, 'encore'); to(good, 'end'); assert(good.snapshot().perfect && good.snapshot().encore);
    const quiet = createConcert(); to(quiet, 'end'); assert.equal(quiet.snapshot().perfect, false, 'no applause at all is not perfect'); assert.equal(quiet.snapshot().encore, false);
    const mid = createConcert(); to(mid, 'm2'); assert.equal(mid.clap(), 'during'); }

// ---- the peacock: moving while it looks, or running near it, scares it (three times and it is gone); standing still close by fans it
{ const g = createStalk({ rng: seq([0.5]) }); let ev = null;
    while (g.snapshot().state !== 'look') g.tick(0.05, 10, 1.2); // walking while it feeds is fine
    ev = g.tick(0.05, 10, 1.2); assert.equal(ev, 'spooked'); assert.equal(g.snapshot().spooks, 1);
    run(g, PEACOCK.flee + 0.1, 20, 0); assert.equal(g.snapshot().state, 'feed');
    assert.equal(g.tick(0.05, 5, 4), 'spooked', 'running close by');
    const h = createStalk({ rng: seq([0.5]) }); for (let i = 0; i < 3; i++) { while (!['look'].includes(h.snapshot().state)) h.tick(0.05, 30, 0); ev = h.tick(0.05, 8, 1); if (i < 2) run(h, PEACOCK.flee + 0.1, 30, 0); } assert.equal(ev, 'gone');
    const w = createStalk({ rng: seq([0.5]) }); ev = null; for (let t = 0; t < 6 && ev !== 'fanned'; t += 0.05) ev = w.tick(0.05, 2, 0) || ev; assert.equal(ev, 'fanned'); }

// ---- hours as the scenes set them (spots' own time zones): concert 18–21, peacock 10–17, d'Lights 16:30–21:30, Lucky Strike 11–24
const at = (h, tz) => ({ r3d: { clock: { override: null }, simDate: new Date(Date.UTC(2026, 11, 10, 12)) }, spot: { clock: { timeZone: tz } }, _h: h });
const hourAt = (h, tz) => { const s = at(h, tz); const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(s.r3d.simDate).find((p) => p.type === 'hour').value; s.r3d.simDate = new Date(s.r3d.simDate.getTime() + (h - +off) * 3600e3); return s; };
assert(openNow({ open: 18, close: 21 }, hourAt(19, 'Europe/Bucharest')) && !openNow({ open: 18, close: 21 }, hourAt(13, 'Europe/Bucharest')));
assert(openNow({ open: 11, close: 24 }, hourAt(23, 'America/Los_Angeles')) && !openNow({ open: 11, close: 24 }, hourAt(6, 'America/Los_Angeles')));
assert.equal(hoursText({ open: 16.5, close: 21.5 }), '16:30–21:30');

// ---- achievements: each new activity is listed, live, and counted once its spot is in the menu (all six are not yet)
const NEW = ['kerry-park:hoops', 'athenaeum-revolution:concert', 'spring-palace:peacock', 'bel-botanical-garden:dlights-hunt', 'bel-lincoln-square:bowling', 'pioneer-square:ping-pong'];
for (const key of NEW) {
    const a = ACHIEVEMENTS.filter((x) => x.activity === key); assert.equal(a.length, 1, key); assert(a[0].live && a[0].cat === 'landmarks', key);
    assert(ACTIVITIES.some((x) => `${x.spot}:${x.id}` === key), 'listed ' + key);
    assert(activityAvailable(a[0], new Set([key.split(':')[0]])), 'counted when the spot is available: ' + key);
}
assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'achievement ids are unique');
console.log('New spot activities: table tennis, bowling, concert applause, peacock stalk, hours and achievements passed.');
