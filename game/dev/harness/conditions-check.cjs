#!/usr/bin/env node
// Focused real-page regression. Native RAF runs cutscenes; main game frames are
// stepped after real keyboard events. Render the real scene for each capture.
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const repo = path.resolve(__dirname, '../../..');
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || '/tmp/dmcv-conditions-check');
const onlyControls = process.argv.includes('--only-controls');
const controls = onlyControls || process.argv.includes('--controls');
const report = { checks: [], errors: [], captures: [], notes: [
    'Fresh browser context per fixture; reload uses its existing browser storage.',
    'Fixed wall clock 2026-11-08T10:00Z; native performance clock and cutscene RAF.',
    'Main game RAF is manually stepped after actual keyboard events; normal draws suppressed between captures.',
    'Open-Meteo deterministically fails so live weather exercises climate fallback.',
] };
fs.mkdirSync(out, { recursive: true });
function check(name, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    report.checks.push({ name, pass, actual, expected });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ': ' + JSON.stringify({ actual, expected })}`);
}
async function read(page) {
    return page.evaluate(() => ({
        state: game.state, district: game.district, city: game.city?.id, chapter: game.chapterIdx,
        conditions: game.travelConditions(), override: game.clock.override,
        hour: game.cityHours(), zone: game.clock.timeZone,
        renderOverride: game.r3d.override, weather: game.r3d._wxOverride, season: game.r3d._seasonOverride,
        freeRoam: !!game.freeRoam, condOpen: !!game.condOpen, pauseOpen: game.pauseOpen,
        selected: Object.fromEntries(['tod', 'wx', 'season'].map(k => [k, [...document.querySelectorAll(`#cond-panel [data-${k}].on`)].map(b => b.dataset[k])])),
        fuel: game.fuel,
    }));
}
async function setup(page, base) {
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.addInitScript(() => {
        const NativeDate = Date, fixed = NativeDate.parse('2026-11-08T10:00:00Z');
        window.Date = class extends NativeDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
        const nativeRAF = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => callback.name === 'bound loop' ? 0 : nativeRAF(callback);
    });
    await page.goto(base + '/game/', { waitUntil: 'load' });
    await ready(page);
    await page.selectOption('#quality', 'low');
    await page.selectOption('#lookmode', 'off');
}
async function ready(page) {
    await page.waitForFunction(() => window.game?.explore && game.save);
    await page.evaluate(async () => {
        await game.save.ready;
        game.audio.setMuted(true);
        game.__conditionsDraw = game.drawFrame.bind(game);
        game.drawFrame = () => {};
    });
}
async function key(page, value) {
    await page.keyboard.press(value);
    await page.evaluate(() => game.loop());
}
async function settings(page) {
    await key(page, 'Escape');
    check(`${(await read(page)).state}: Esc opens pause`, (await read(page)).pauseOpen, true);
    await page.click('#pause-menu [data-pa="settings"]');
    await page.click('#pause-menu [data-pa="conditions"]');
    check(`${(await read(page)).state}: Settings opens conditions`, [(await read(page)).condOpen, (await read(page)).pauseOpen], [true, false]);
    check('hidden title menu is excluded from interaction', await page.locator('#menu').evaluate(menu => !menu.classList.contains('show') && getComputedStyle(menu).visibility === 'hidden'), true);
    check('Golden hour receives pointer events', await page.locator('#cond-panel [data-tod="golden"]').evaluate(button => {
        const r = button.getBoundingClientRect(); return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true);
}
async function hour(page, h) {
    await page.locator('#cond-hour').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, h);
}
async function capture(page, name) {
    await page.evaluate(() => { game.updateClock(0); game.__conditionsDraw(); });
    const file = path.join(out, name + '.jpg');
    await page.screenshot({ path: file, animations: 'disabled' });
    report.captures.push({ file, state: await read(page) });
}
async function jump(page, fn, arg) {
    // Let the game's real montage finish; skip a real flight through its UI.
    const pending = page.evaluate(async ({ fn, arg }) => fn === 'resume' ? game.explore.resumeStory() : game.explore.jump(arg), { fn, arg });
    const flight = page.locator('#flight.show [data-skip]');
    const skip = flight.waitFor({ state: 'visible', timeout: 1500 }).then(() => flight.click()).catch(e => {
        if (e.name !== 'TimeoutError') throw e;
    });
    const result = await pending;
    await skip;
    check(`${fn} ${arg || ''} completes`, result, true);
}
async function controlsCheck(page) {
    // Root's optional cockpit regression: observe actual methods; no injected behavior.
    await page.evaluate(() => game.enterCar());
    await key(page, 'Escape'); await page.click('[data-pa="settings"]');
    await page.selectOption('[data-set="quality"]', 'medium'); await page.click('[data-pa="resume"]');
    await page.evaluate(() => game.loop());
    await page.evaluate(() => {
        const original = game.audio.blip;
        game.__conditionsAudio = { original, calls: 0 };
        game.audio.blip = function (...args) { game.__conditionsAudio.calls++; return original.apply(this, args); };
    });
    let s = await page.evaluate(() => {
        const p = game.player;
        p.place(p.x, p.z, p.heading, p.supportEdge); p.updateRig(0);
        return { mounted: p.mirror.parent === p.rig, visible: p.mirror.visible, enabled: p.driveRigShown };
    });
    check('drive mirror remains mounted and visible after place/updateRig', s, { mounted: true, visible: true, enabled: true });
    const before = await page.evaluate(() => game.headlightsOn);
    await key(page, 'l');
    check('L toggles driving headlights', await page.evaluate(() => game.headlights), !before);
    check('driving L produces its feedback blip', await page.evaluate(() => game.__conditionsAudio.calls > 0), true);
    await key(page, 'Enter');
    check('Enter exits car', (await read(page)).state, 'foot');
    const footBefore = await page.evaluate(() => ({ headlights: game.headlights, honks: game.honks, bodyLights: game.carBody?.userData?.lightsOn }));
    await page.evaluate(() => {
        game.__conditionsAudio.calls = 0;
        const original = game.carBody.userData.setLights;
        game.__conditionsCarLights = { original, calls: [] };
        game.carBody.userData.setLights = function (...args) { game.__conditionsCarLights.calls.push(args); return original?.apply(this, args); };
    });
    const footIdle = await page.evaluate(() => {
        game.loop();
        const idle = [game.__conditionsAudio.calls, game.__conditionsCarLights.calls];
        game.__conditionsAudio.calls = 0; game.__conditionsCarLights.calls = [];
        return idle;
    });
    await key(page, 'l');
    check('L on foot leaves headlights and honks unchanged', await page.evaluate(() => ({ headlights: game.headlights, honks: game.honks, bodyLights: game.carBody?.userData?.lightsOn })), footBefore);
    check('L on foot adds no sound or flash beyond parked hazards', await page.evaluate(() => [game.__conditionsAudio.calls, game.__conditionsCarLights.calls]), footIdle);
    await page.evaluate(() => { game.audio.blip = game.__conditionsAudio.original; game.carBody.userData.setLights = game.__conditionsCarLights.original; });
    s = await page.evaluate(() => {
        const p = game.player; p.place(p.x, p.z, p.heading, p.supportEdge); p.updateRig(0);
        const original = game.renderer.render; let renders = 0, mirrors = 0;
        game.renderer.render = function (...args) { renders++; if (args[1] === p.mirrorCam) mirrors++; return original.apply(this, args); };
        try { game.__conditionsDraw({ mirror: true }); } finally { game.renderer.render = original; }
        return { enabled: p.driveRigShown, visible: p.mirror.visible, renders, mirrors };
    });
    check('foot place/updateRig leaves mirror disabled and hidden', [s.enabled, s.visible], [false, false]);
    check('foot drawFrame mirror option still renders the street view', s.renders > 0, true);
    check('foot drawFrame mirror option does not run mirror pass', s.mirrors, 0);
    await page.evaluate(() => game.enterCar());
    await key(page, 'Escape'); await page.click('[data-pa="settings"]');
    await page.selectOption('[data-set="quality"]', 'low'); await page.click('[data-pa="resume"]');
}
async function mainFixture(page) {
    await page.selectOption('#timeofday', 'night'); await page.selectOption('#weather', 'rain');
    check('direct title start succeeds', await page.evaluate(() => game.startFreeRoam('floreasca')), true);
    let s = await read(page);
    check('title Night/rain follows direct startFreeRoam', [s.conditions, s.override], [{ tod: 'night', weather: 'rain', season: 'auto' }, 'night']);
    await settings(page);
    await page.click('[data-tod="golden"]'); await page.click('[data-season="winter"]');
    s = await read(page);
    check('drive Settings applies Golden hour and Winter', [s.conditions, s.selected], [{ tod: 'golden', weather: 'rain', season: 'winter' }, { tod: ['golden'], wx: ['rain'], season: ['winter'] }]);
    await capture(page, 'drive-settings-golden-winter');
    await key(page, 'k'); check('K closes drive panel', (await read(page)).condOpen, false);
    await key(page, 'k'); check('K opens drive panel', (await read(page)).condOpen, true);
    await page.click('[data-tod="night"]'); check('Night preset remains explicit', (await read(page)).override, 'night');
    await key(page, 'Escape'); await key(page, 'Enter'); check('drive Enter reaches foot', (await read(page)).state, 'foot');
    await settings(page); await page.click('[data-tod="noon"]'); await page.click('[data-season="summer"]');
    check('foot Settings applies Noon and Summer', [(await read(page)).hour, (await read(page)).selected], [12.5, { tod: ['noon'], wx: ['rain'], season: ['summer'] }]);
    await key(page, 'k'); await key(page, 'k'); check('K opens foot panel', (await read(page)).condOpen, true);
    await key(page, 'Escape');
    await page.evaluate(() => game.enterChapter(0));
    s = await read(page);
    check('same district chapter preserves conditions', [s.freeRoam, s.conditions], [false, { tod: 'h12.5', weather: 'rain', season: 'summer' }]);
    await settings(page);
    for (const [preset, h] of [['dawn', 6.5], ['rush', 8.5], ['noon', 12.5]]) {
        await page.click(`[data-tod="${preset}"]`);
        s = await read(page); check(`story ${preset} active chip matches time`, [s.hour, s.selected.tod], [h, [preset]]);
    }
    await page.click('[data-season="winter"]');
    check('story Winter chip reflects active season', (await read(page)).selected.season, ['winter']);
    await capture(page, 'story-settings-noon-winter');
    await hour(page, 21.25); await key(page, 'Escape');
    await jump(page, 'jump', 'floreasca'); await jump(page, 'resume');
    s = await read(page);
    check('resume story in same district preserves numeric hour/weather/season', [s.freeRoam, s.hour, s.conditions], [false, 21.25, { tod: 'h21.25', weather: 'rain', season: 'winter' }]);
    await page.evaluate(() => game.startFreeRoam('bellevue'));
    s = await read(page);
    check('direct travel preserves 21:15 in America/Los_Angeles', [s.zone, s.hour, s.conditions], ['America/Los_Angeles', 21.25, { tod: 'h21.25', weather: 'rain', season: 'winter' }]);
    await jump(page, 'jump', 'seatac'); s = await read(page);
    check('explore jump preserves numeric hour/weather/season', [s.district, s.hour, s.conditions], ['seatac', 21.25, { tod: 'h21.25', weather: 'rain', season: 'winter' }]);
    await key(page, 'k'); await page.click('[data-tod="golden"]'); await key(page, 'Escape');
    await jump(page, 'resume'); s = await read(page);
    check('resume story in another city preserves Golden/weather/season', [s.district, s.freeRoam, s.conditions, s.override], ['floreasca', false, { tod: 'golden', weather: 'rain', season: 'winter' }, 'sunset']);
    await page.evaluate(() => game.enterChapter(1)); s = await read(page);
    check('other district chapter preserves conditions', [s.district, s.conditions], ['grozavesti', { tod: 'golden', weather: 'rain', season: 'winter' }]);
    await page.evaluate(() => game.enterChapter(1));
    check('same district chapter reentry preserves Golden override', (await read(page)).override, 'sunset');
    if (controls) await controlsCheck(page);
    // Exercise options through Settings, then Continue through the visible title button.
    await key(page, 'Escape'); await page.click('[data-pa="settings"]');
    await page.locator('[data-set="minimap"]').check();
    await page.locator('[data-set="invert"]').check();
    await page.selectOption('[data-set="look"]', 'hold');
    await page.click('[data-pa="resume"]');
    await page.evaluate(async () => { game.fuel = 11.25; await game.save.saveSession('conditions-story-reload'); });
    await page.reload({ waitUntil: 'load' }); await ready(page);
    check('reload exposes Continue', await page.locator('#continue').isVisible(), true);
    await page.click('#continue'); await page.waitForFunction(() => game.state === 'drive' && !game.save._restoring);
    s = await read(page);
    check('story Continue restores conditions and positive fuel', [s.district, s.conditions, s.fuel], ['grozavesti', { tod: 'golden', weather: 'rain', season: 'winter' }, 11.25]);
    check('Continue keeps saved Settings options', await page.evaluate(() => [game.opts.minimap, game.input.invertY, game.input.lookMode]), [true, true, 'hold']);
    await key(page, 'k'); check('story Continue panel reflects Winter/Golden', (await read(page)).selected, { tod: ['golden'], wx: ['rain'], season: ['winter'] });
    await capture(page, 'story-continue-settings'); await key(page, 'Escape');
    for (const invalid of [-1, NaN, Infinity]) {
        const fuel = await page.evaluate(async value => { const s = game.save.capture(); game.save.session = { ...s, fuel: value }; await game.save.restore(game); return game.fuel; }, invalid);
        check(`invalid saved fuel ${String(invalid)} is ignored`, fuel, 27);
    }
}
async function titleAndRoamSave(page) {
    await page.selectOption('#timeofday', 'sunset'); await page.selectOption('#weather', 'snow');
    await jump(page, 'jump', 'floreasca');
    check('title Sunset/snow follows explore jump', [(await read(page)).conditions, (await read(page)).override], [{ tod: 'golden', weather: 'snow', season: 'auto' }, 'sunset']);
    await key(page, 'k'); await page.click('[data-season="winter"]'); await hour(page, 21.25); await key(page, 'Escape');
    await page.evaluate(async () => { game.fuel = 0; await game.save.saveSession('conditions-empty-tank-reload'); });
    await page.reload({ waitUntil: 'load' }); await ready(page);
    await page.click('#continue'); await page.waitForFunction(() => game.state === 'drive' && !game.save._restoring);
    let s = await read(page);
    check('free roam Continue restores local 21:15/snow/Winter', [s.freeRoam, s.hour, s.conditions], [true, 21.25, { tod: 'h21.25', weather: 'snow', season: 'winter' }]);
    check('free roam Continue preserves empty tank', s.fuel, 0);
    await key(page, 'k'); await page.click('[data-wx="live"]'); await page.click('[data-season="auto"]'); await key(page, 'Escape');
    await page.evaluate(() => game.startFreeRoam('bellevue', { tod: 'now' })); s = await read(page);
    check('live/auto stay distinct and local after city travel', [s.zone, s.hour, s.conditions, s.override], ['America/Los_Angeles', 2, { tod: 'now', weather: 'live', season: 'auto' }, null]);
    await key(page, 'k'); await page.click('[data-tod="night"]'); await key(page, 'Escape');
    await jump(page, 'jump', 'seatac'); s = await read(page);
    check('Night preset survives explore district travel', [s.conditions, s.override], [{ tod: 'night', weather: 'live', season: 'auto' }, 'night']);
    await key(page, 'k'); await capture(page, 'roam-night-live-auto');
}
(async () => {
    const server = http.createServer((request, response) => {
        let file = path.resolve(repo, '.' + decodeURIComponent(request.url.split('?')[0]));
        if (!file.startsWith(repo + path.sep)) { response.writeHead(403); response.end(); return; }
        if (request.url.split('?')[0].endsWith('/')) file = path.join(file, 'index.html');
        fs.readFile(file, (error, data) => {
            response.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
            response.end(error ? 'missing' : data);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const fixtures = onlyControls ? [['controls', async page => { await page.evaluate(() => game.startFreeRoam('grozavesti')); await controlsCheck(page); }]] : [['main', mainFixture], ['title-roam-save', titleAndRoamSave]];
        for (const [name, run] of fixtures) {
            const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
            await context.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
            const page = await context.newPage();
            try { await setup(page, `http://127.0.0.1:${server.address().port}`); await run(page); }
            catch (error) {
                report.checks.push({ name: `${name} fixture completes`, pass: false, actual: error.stack, expected: 'complete' }); console.error(error);
                try { await capture(page, name + '-failure'); } catch (captureError) { report.notes.push(`Failure capture unavailable: ${captureError.message}`); }
            }
            finally { await context.close(); }
        }
        check('no browser page errors', report.errors, []);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
    report.passed = report.checks.filter(c => c.pass).length; report.failed = report.checks.filter(c => !c.pass).length;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, failed: report.failed, out }));
    process.exitCode = report.failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 2; });
