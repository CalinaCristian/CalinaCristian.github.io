#!/usr/bin/env node
/*
 * Achievements & completion harness (spec 23, progression role). Standalone Playwright script:
 *   node game/dev/harness/achievements-check.js [--port=8123] [--out=<dir>] [--game]
 * Checks: sample unlocks through the real hooks (hud.achievement, onPhoto, closureText, playerHonk), one toast at a
 * time, completion math (weights table), persistence across reload, exactly 100 % with everything done, the 100 %
 * milestone (telemetry `completion_milestone`, thank-you card, gold flag), reset with confirmation, the panel at
 * 1280×720 and 390×844 (+ 844×390), 0 page errors. `--game` also starts chapter 1 and checks the ring in the map panel
 * (slow in software GL). Needs a static server on the port (python3 -m http.server 8123).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const PORT = +arg('port', 8123);
const OUT = arg('out', path.join(__dirname, 'report', 'achievements'));
const GAME = process.argv.includes('--game');
const SAVE = process.argv.includes('--save');
const URL = `http://127.0.0.1:${PORT}/game/index.html`;
fs.mkdirSync(OUT, { recursive: true });

const results = []; const errors = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function newPage(ctx) {
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000); page.setDefaultTimeout(60000); // reloading a running game in software GL is slow
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
    return page;
}
async function load(page) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.game?.achievements && window.game.spotsMod?.SPOTS, null, { timeout: 180000 });
    await page.evaluate(() => { window.__tm = []; const t = window.cvTelemetry; if (t) { const o = t.track; t.track = function (e, p, x) { window.__tm.push([e, p]); return o?.call(this, e, p, x); }; } else window.cvTelemetry = { track: (e, p) => window.__tm.push([e, p]) }; });
}
const comp = (page) => page.evaluate(() => { const c = window.game.achievements.completion(); return { pct: c.pct, exact: c.exact, all: c.all, unlocked: c.unlocked, total: c.total, parts: c.parts.map(p => [p.key, p.n, p.total, p.weight]) }; });

(async () => {
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await ctx.route(/api\.open-meteo\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 12, weather_code: 3, cloud_cover: 80, precipitation: 0, visibility: 20000, wind_speed_10m: 10, is_day: 1, snowfall: 0 } }) }));
    const page = await newPage(ctx);
    try {
        // ---- 1. fresh start
        await load(page);
        let c = await comp(page);
        check('fresh: 0 % and 0 unlocked', c.pct === 0 && c.unlocked === 0, JSON.stringify(c.parts));
        const info = await page.evaluate(async () => {
            const { ACHIEVEMENTS } = await import('./src/data.js');
            const { activeAchievements } = await import('./src/achievements.js');
            const ids = ACHIEVEMENTS.map(a => a.id), act = activeAchievements();
            return { n: ids.length, active: act.length, dup: ids.length - new Set(ids).size, cats: [...new Set(ACHIEVEMENTS.map(a => a.cat))], activeCats: [...new Set(act.map(a => a.cat))].length, landmarks: ACHIEVEMENTS.filter(a => a.cat === 'landmarks').length };
        });
        check('catalogue: unique ids, 8 categories, live set 40–65 (landmarks wait for their activity)', info.active >= 40 && info.active <= 65 && info.dup === 0 && info.cats.length === 8, JSON.stringify(info));
        check('IndexedDB store open (versioned schema)', await page.evaluate(async () => { const s = window.game.save; await s.ready; return s.mode === 'idb' && (await s.get('meta:schema')) === 1; }));
        await page.screenshot({ path: path.join(OUT, 'menu-1280.png') });
        check('menu ring present', await page.$('#achv-menu .achv-ring') !== null);

        // ---- 2. sample unlocks through the real hooks
        await page.evaluate(() => {
            const g = window.game;
            g.hud.achievement('first-honk');                    // main.js path (hud delegate)
            g.onPhoto({ filter: 'bw', place: 'Test' });          // wrapped onPhoto → photo-first + photo-bw
            g.state = 'drive'; try { g.closureText({ kind: 'small', leadsTo: null }); } catch { /* the world is not loaded */ } g.state = 'menu';
        });
        c = await comp(page);
        const got = await page.evaluate(() => Object.keys(window.game.achievements.state.unlocked));
        check('sample unlocks (first-honk, photo-first, photo-bw, roadworks)', ['first-honk', 'photo-first', 'photo-bw', 'roadworks'].every(id => got.includes(id)), got.join(','));
        check('hud.achievement returns false on repeat', await page.evaluate(() => window.game.hud.achievement('first-honk') === false));
        check('session set for telemetry (hud.unlocked)', await page.evaluate(() => window.game.hud.unlocked.has('photo-bw')));
        // one toast at a time
        let maxT = 0; for (let i = 0; i < 12; i++) { maxT = Math.max(maxT, await page.$$eval('#achv-toasts .achv-toast', l => l.length)); await sleep(150); }
        check('toast queue: never more than one toast', maxT === 1, `max ${maxT}`);
        await page.screenshot({ path: path.join(OUT, 'toast-1280.png') });
        const expect = 25 * got.length / c.total;
        check('completion math: achievements share = 25 × n/total', Math.abs(c.exact - expect) < 1e-9 && c.pct === Math.floor(expect), `exact ${c.exact.toFixed(3)} pct ${c.pct}`);

        // ---- 2b. note 44: a chapter achievement unlocks at the goal, not on a later poll; note 57 activity events
        const t44 = await page.evaluate(async () => { const g = window.game, t0 = performance.now(); g.progress.done.add('rosetti'); while (!g.achievements.isUnlocked('ch-rosetti') && performance.now() - t0 < 3000) await new Promise(r => setTimeout(r, 20)); const ok = g.achievements.isUnlocked('ch-rosetti'); g.progress.done.delete('rosetti'); delete g.achievements.state.unlocked['ch-rosetti']; g.achievements.save(true); return { ok, ms: Math.round(performance.now() - t0) }; });
        check('note 44: chapter achievement within 0.5 s of progress.done', t44.ok && t44.ms < 500, JSON.stringify(t44));
        const act = await page.evaluate(async () => {
            const g = window.game, A = g.achievements, before = A.completion().total;
            g.emit('activity', { spot: 'gas-works', id: 'kite' });
            await new Promise(r => setTimeout(r, 100));
            const r = { kite: A.isUnlocked('lm-kite'), all: A.isUnlocked('landmarks-all'), before, after: A.completion().total };
            // undo (keeps the later sections' numbers): forget the activity
            for (const id of ['lm-kite', 'landmarks-all']) delete A.state.unlocked[id]; A.state.sets.activities = []; A.save(true);
            return r;
        });
        check('note 57: game.emit("activity") unlocks its Landmarks achievement and makes it count', act.kite && act.all && act.after === act.before + 2, JSON.stringify(act));
        await load(page); // (the live-activity set is per page: start clean)
        // ---- 3. persistence across reload
        const before = await page.evaluate(() => ({ ...window.game.achievements.state.unlocked }));
        await load(page);
        const after = await page.evaluate(() => window.game.achievements.state.unlocked);
        check('persistence across reload (ids + timestamps)', Object.keys(before).length > 0 && Object.keys(before).every(k => after[k] === before[k]), Object.keys(after).join(','));
        check('no telemetry achievement spam on reload', await page.evaluate(() => window.game.hud.unlocked.size === 0));

        // ---- 4. panel screenshots
        await page.click('#achv-menu [data-achv-open]');
        await sleep(400);
        await page.click('#achv-panel .achv-break summary');
        await page.screenshot({ path: path.join(OUT, 'panel-1280.png') });
        await page.click('#achv-panel [data-achv-filter="secret"]');
        await page.screenshot({ path: path.join(OUT, 'panel-1280-secrets.png') });
        check('secrets shown as ??? while locked', await page.$$eval('#achv-panel .achv-card.secret b', l => l.length > 0 && l.every(b => b.textContent === '???')));
        await page.keyboard.press('Escape'); await sleep(300);
        check('Esc closes the panel', !(await page.evaluate(() => window.game.achievements.isOpen)));
        for (const [w, h, name] of [[390, 844, 'panel-390x844'], [844, 390, 'panel-844x390']]) {
            await page.setViewportSize({ width: w, height: h });
            await page.evaluate(() => window.game.achievements.open('all'));
            await sleep(400);
            await page.screenshot({ path: path.join(OUT, name + '.png') });
            const sc = await page.$eval('#achv-panel .achv-inner', (el) => { const r = el.getBoundingClientRect(); el.scrollTop = 600; return { sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop, w: r.width, vw: innerWidth, overflowX: document.documentElement.scrollWidth > innerWidth }; });
            await sleep(150);
            await page.screenshot({ path: path.join(OUT, name + '-scrolled.png') });
            const tgt = await page.$$eval('#achv-panel .achv-chip, #achv-panel .achv-x', l => Math.min(...l.map(b => b.getBoundingClientRect().height)));
            check(`panel ${w}×${h}: fits width, scrolls, targets ≥ 40 px`, sc.w <= sc.vw && sc.sh > sc.ch && sc.top > 0 && !sc.overflowX && tgt >= 40, JSON.stringify({ ...sc, minTarget: tgt }));
            await page.evaluate(() => window.game.achievements.close());
        }
        await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
        await page.screenshot({ path: path.join(OUT, 'menu-390x844.png') });
        await page.setViewportSize({ width: 1280, height: 720 });

        // ---- 5. exactly 100 % with everything done (merged from chapters.js + spots progress)
        const seed = (dropLast) => page.evaluate(async (dropLast) => {
            const { ACHIEVEMENTS, STOPS } = await import('./src/data.js');
            const { CHAPTERS } = await import('./src/cities.js');
            const SPOTS = window.game.spotsMod.SPOTS;
            const now = Date.now(), unlocked = {};
            ACHIEVEMENTS.forEach((a, i) => { if (!(dropLast && a.id === 'vlad')) unlocked[a.id] = now - i * 1000; });
            const screens = STOPS.flatMap(s => s.stations.map((_, i) => `${s.id}:${i}`));
            localStorage.setItem('dmcv:chapters', JSON.stringify({ reached: CHAPTERS.map(c => c.id), done: CHAPTERS.map(c => c.id) }));
            localStorage.setItem('dmcv.spots.v1', JSON.stringify({ postcards: Object.fromEntries(SPOTS.map(s => [s.id, now])) }));
            const st = { v: 1, created: now, unlocked, counters: { walk: 1200, photos: 30 }, dist: { rain: 0, snow: 0, fog: 0 },
                sets: { screens, roam: ['floreasca', 'grozavesti', 'unirii', 'pipera', 'romana', 'otopeni', 'seatac', 'bellevue'], spots: SPOTS.map(s => s.id), plaques: [], rush: ['victoriei', 'unirii', 'pompeiu', 'i405'] }, milestones: dropLast ? [25, 50, 75] : [], gold: false };
            localStorage.setItem('dmcv.progression.v1', JSON.stringify(st));
            window.game.achievements.state = JSON.parse(JSON.stringify(st)); window.game.achievements.dirty = false; // (an unload save must not overwrite the seed)
        }, dropLast);
        await seed(false); await load(page);
        c = await comp(page);
        check('everything done → exactly 100 %', c.pct === 100 && c.all && Math.abs(c.exact - 100) < 1e-9, JSON.stringify(c.parts));
        check('100 % merged silently: milestones + gold flag set', await page.evaluate(() => { const s = window.game.achievements.state; return s.milestones.join() === '25,50,75,100' && s.gold === true; }));

        // ---- 6. the last unlock: 100 % milestone moment, telemetry, thank-you card
        await seed(true); await load(page);
        c = await comp(page);
        check('all but one achievement → 99 % (never rounds up to 100)', c.pct === 99 && !c.all, `exact ${c.exact.toFixed(3)}`);
        await page.evaluate(() => window.game.achievements.unlock('vlad'));
        await sleep(600);
        await page.screenshot({ path: path.join(OUT, 'milestone-100-1280.png') });
        const tm = await page.evaluate(() => window.__tm.filter(([e]) => e === 'completion_milestone'));
        check('telemetry completion_milestone {pct: 100} (coarse)', tm.length === 1 && tm[0][1].pct === 100 && Object.keys(tm[0][1]).length === 1, JSON.stringify(tm));
        await page.waitForFunction(() => document.querySelector('#achv-panel.show .achv-thanks'), null, { timeout: 15000 }).catch(() => { });
        const thanks = await page.evaluate(() => { const el = document.querySelector('#achv-panel.show .achv-thanks'); const r = el?.getBoundingClientRect(); const top = r && document.elementFromPoint(r.left + r.width / 2, r.top + 20); return { shown: !!el, onTop: !!(el && top && el.contains(top)), links: document.querySelectorAll('#achv-panel .achv-thanks a').length }; });
        check('thank-you card (on top) with the CV contact links', thanks.shown && thanks.onTop && thanks.links >= 5, JSON.stringify(thanks));
        await page.screenshot({ path: path.join(OUT, 'thanks-1280.png') });
        await page.setViewportSize({ width: 390, height: 844 }); await sleep(200);
        await page.screenshot({ path: path.join(OUT, 'thanks-390x844.png') });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.click('#achv-panel [data-achv-act="list"]'); await sleep(300);
        await page.screenshot({ path: path.join(OUT, 'panel-100-1280.png') });
        await page.evaluate(() => window.game.achievements.close());

        // ---- 7. reset with confirmation
        await page.evaluate(() => window.game.achievements.open()); await sleep(200);
        await page.click('#achv-panel [data-achv-act="reset"]');
        await page.screenshot({ path: path.join(OUT, 'reset-confirm-1280.png') });
        const still = await page.evaluate(() => !!localStorage.getItem('dmcv.progression.v1'));
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#achv-panel [data-achv-act="reset-yes"]')]);
        await page.waitForFunction(() => window.game?.achievements, null, { timeout: 60000 });
        c = await comp(page);
        check('reset needs a confirmation, then clears everything', still && c.pct === 0 && c.unlocked === 0 && c.parts.every(p => p[1] === 0), JSON.stringify(c.parts));

        // ---- 8. (optional) in game: chapter 1 (map ring, a real honk, on foot: walk + jump), a tourist spot (plaques, pause panel)
        if (GAME) {
            await page.click('#start');
            await page.waitForFunction(() => window.game.state === 'drive', null, { timeout: 240000 });
            await page.evaluate(() => { window.game.playerHonk(); window.game.toggleMap(true); });
            await sleep(800);
            check('map panel (chapters / pause) shows the ring', await page.$('#navlist .achv-nav .achv-ring') !== null);
            await page.screenshot({ path: path.join(OUT, 'map-1280.png'), timeout: 180000 }).catch(e => console.log('(map screenshot skipped: ' + e.message.split('\n')[0] + ')'));
            await page.evaluate(() => window.game.toggleMap(false));
            check('in game: first honk unlocked via main.js', await page.evaluate(() => window.game.achievements.isUnlocked('first-honk')));
            await page.evaluate(() => { const g = window.game; g.player.speed = 0; g.exitCar(); g.foot.auto = { fwd: 1, run: true, jump: true }; });
            await sleep(6000);
            await page.evaluate(() => { const g = window.game; if (g.foot) g.foot.auto = { fwd: 1, run: true, jump: true }; });
            await sleep(4000);
            const foot = await page.evaluate(() => ({ st: window.game.state, walk: window.game.achievements.state.counters.walk, first: window.game.achievements.isUnlocked('foot-first'), jump: window.game.achievements.isUnlocked('foot-jump') }));
            check('on foot: foot-first, foot-jump, distance counted', foot.first && foot.jump && foot.walk > 0, JSON.stringify(foot) + ' (software GL: few frames per second, distance small)');
            await page.evaluate(() => { const g = window.game; if (g.foot) g.foot.auto = null; g.enterCar(); });
            const ok = await page.evaluate(() => window.game.enterSpot('kerry-park'));
            await page.waitForFunction(() => window.game.state === 'spot', null, { timeout: 240000 });
            await sleep(1000);
            const pl = await page.evaluate(async () => {
                const g = window.game, s = g.spot, list = s.spot.plaques;
                for (const p of list) { s.readPlaque(p); await new Promise(r => setTimeout(r, 300)); s.ui.closePanel?.(); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); await new Promise(r => setTimeout(r, 300)); }
                return { n: list.length, read: g.achievements.state.sets.plaques.length, spot: g.achievements.isUnlocked('spot-first'), all: g.achievements.isUnlocked('plaques-spot'), visited: g.achievements.state.sets.spots };
            });
            check('spot: visit counted, every plaque of the spot → plaques-spot', ok && pl.spot && pl.all && pl.read === pl.n, JSON.stringify(pl));
            await page.evaluate(() => { const g = window.game; if (g.spot?.ui?.panelOpen) g.spot.ui.closePanel?.(); g.spotPause(); });
            await sleep(500);
            check('spot pause panel shows the ring', await page.$('#panel .achv-pause .achv-ring') !== null);
            await page.screenshot({ path: path.join(OUT, 'spot-pause-1280.png'), timeout: 180000 }).catch(e => console.log('(spot screenshot skipped: ' + e.message.split('\n')[0] + ')'));
            await page.evaluate(() => { window.game.hud.closePanel(); window.game.leaveSpot(); });
            await sleep(500);
        }
        // ---- 9. (optional, --save) note 73: autosave → reload → Continue at the same pose, gallery persists, reset clears all
        if (SAVE) {
            await load(page);
            await page.click('#start');
            await page.waitForFunction(() => window.game.state === 'drive', null, { timeout: 240000 });
            const want = await page.evaluate(async () => {
                const g = window.game, P = g.player;
                // move the car 60 m along its lane, then get out and step 4 m away
                const p = g.lanePose(P.x + P.fx * 60, P.z + P.fz * 60, P.heading) || { x: P.x, z: P.z, heading: P.heading, edge: null };
                P.place(p.x, p.z, p.heading, p.edge); P.speed = 0;
                g.fuel = 17.25; g.stats.fineCount = 2; g.stats.dist = 1234; g.honks = 7;
                g.exitCar(); g.foot.teleport(g.foot.x + 3, g.foot.z + 2, 1.0);
                // a photo as PhotoMode would keep it
                const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#d97706'; x.fillRect(0, 0, 300, 200); x.fillStyle = '#fff'; x.font = '40px sans-serif'; x.fillText('test shot', 40, 110);
                const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
                g.photo.gallery.unshift({ blob, url: URL.createObjectURL(blob), name: 'drive-my-cv-test.jpg', meta: { place: 'Harness shot', filter: 'none' } });
                g.save.observePhotos(); await new Promise(r => setTimeout(r, 300));
                await g.save.saveSession('harness');
                return { car: { x: P.x, z: P.z, h: P.heading }, foot: { x: g.foot.x, z: g.foot.z }, fuel: g.fuel, state: g.state, photos: (await g.save.listPhotos()).length };
            });
            check('save: session + photo written', want.state === 'foot' && want.photos >= 1, JSON.stringify(want));
            await load(page);
            const cont = await page.evaluate(async () => { await window.game.save.ready; return { has: window.game.save.hasSession(), btn: !!document.querySelector('#save-continue, #continue, [data-continue]'), label: window.game.save.session?.label }; });
            check('reload: Continue offered', cont.has && cont.btn, JSON.stringify(cont));
            await page.screenshot({ path: path.join(OUT, 'continue-menu-1280.png') });
            await page.click('[data-continue]');
            await page.waitForFunction(() => window.game.state === 'foot', null, { timeout: 240000 });
            await sleep(500);
            const got = await page.evaluate(() => { const g = window.game, P = g.player; return { car: { x: P.x, z: P.z, h: P.heading }, foot: { x: g.foot.x, z: g.foot.z }, fuel: g.fuel, fines: g.stats.fineCount, dist: g.stats.dist, honks: g.honks, state: g.state }; });
            const dCar = Math.hypot(got.car.x - want.car.x, got.car.z - want.car.z), dFoot = Math.hypot(got.foot.x - want.foot.x, got.foot.z - want.foot.z);
            check('Continue: car and walker within 1 m, on foot, fuel / fines / trip restored', dCar <= 1 && dFoot <= 1 && Math.abs(got.car.h - want.car.h) < 0.05 && got.state === 'foot' && Math.abs(got.fuel - 17.25) < 0.01 && got.fines === 2 && got.dist >= 1234 && got.honks === 7, JSON.stringify({ dCar: +dCar.toFixed(3), dFoot: +dFoot.toFixed(3), ...got }));
            await page.screenshot({ path: path.join(OUT, 'continue-restored-1280.png'), timeout: 180000 }).catch(() => { });
            await page.evaluate(() => window.game.save.openGallery()); await sleep(600);
            const gal = await page.$$eval('#save-gallery .gal-grid img', l => l.length);
            check('gallery persists across reload', gal >= 1, `${gal} photo(s)`);
            await page.screenshot({ path: path.join(OUT, 'gallery-1280.png'), timeout: 180000 }).catch(() => { });
            await page.setViewportSize({ width: 390, height: 844 }); await sleep(300);
            await page.screenshot({ path: path.join(OUT, 'gallery-390x844.png'), timeout: 180000 }).catch(() => { });
            await page.setViewportSize({ width: 1280, height: 720 });
            await page.evaluate(() => window.game.save.closeGallery());
            await page.evaluate(() => { window.game.achievements.open(); window.game.achievements.confirmReset = true; window.game.achievements.renderPanel(); });
            await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }), page.click('#achv-panel [data-achv-act="reset-yes"]')]);
            await page.waitForFunction(() => window.game?.save, null, { timeout: 60000 });
            const cleared = await page.evaluate(async () => { const s = window.game.save; await s.ready; const ls = Object.keys(localStorage).filter(k => k.startsWith('dmcv') && !/lookHintShown/.test(k)); return { has: s.hasSession(), photos: (await s.listPhotos()).length, kv: (await s.keys()).filter(k => k !== 'meta:schema'), ls }; });
            check('reset clears IndexedDB (session, mirror, photos) and localStorage', !cleared.has && cleared.photos === 0 && !cleared.kv.some(k => /^(session|ls:dmcv\.progression|ls:dmcv:chapters|ls:dmcv\.spots)/.test(String(k))), JSON.stringify(cleared));
        }
    } catch (e) { errors.push('harness: ' + (e.stack || e.message)); }
    check('0 page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
    await browser.close();
    const fail = results.filter(r => !r.ok).length;
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(`\n${results.length - fail}/${results.length} passed · screenshots in ${OUT}`);
    process.exit(fail ? 1 : 0);
})();
