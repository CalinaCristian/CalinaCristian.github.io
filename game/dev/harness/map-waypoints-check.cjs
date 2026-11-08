#!/usr/bin/env node
// Real map controls: a pick marks/routes; only explicit fast travel moves the player.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(process.argv.find(a => a.startsWith('--root='))?.slice(7) || path.join(__dirname, '../../..'));
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || '/tmp/map-waypoints-check');
fs.mkdirSync(out, { recursive: true });
const report = { checks: [], errors: [] };
const check = (name, value, detail) => { console.log((value ? 'PASS ' : 'FAIL ') + name); report.checks.push({ name, pass: !!value, detail }); assert.ok(value, name + ': ' + JSON.stringify(detail)); };
const server = http.createServer((req, res) => {
    let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    fs.readFile(f, (error, data) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); res.end(error ? 'missing' : data); });
});
let browser;
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
    const page = await context.newPage(); page.setDefaultTimeout(180000); require('./integration-browser-bounds.cjs').boundEvaluations(page); page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && m.text().includes('[explore]')) report.errors.push(m.text()); });
    // Fixed steps exercise the real Input/Game handlers without variable wall-clock physics.
    await page.addInitScript(() => { window.__testRAF = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
    await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.game, null, { polling: 50, timeout: 90000 });
    await page.evaluate(() => { window.requestAnimationFrame = window.__testRAF; });
    const shot = async (name) => {
        if (process.env.NO_SHOTS) return;
        await page.evaluate(() => { game.canvas.style.visibility = 'hidden'; });
        try { await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, name)); }
        finally { await page.evaluate(() => { game.canvas.style.visibility = ''; }); }
    };
    const snap = () => page.evaluate(() => ({ x: game.player.x, z: game.player.z, state: game.state, district: game.district, chapter: game.chapter, done: [...game.progress.done], reached: [...game.progress.reached], objective: game.objective?.id, selected: game.explore.destination?.label, nav: game.nav.dest, route: game.nav.route?.total, fuel: game.fuel, stations: game.stations.length, fastTravels: game.stats.fastTravels }));
    const samePose = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.001 && a.state === b.state && a.district === b.district;
    const openM = async (native = false) => { await page.keyboard.press('m'); if (native) await page.evaluate(() => game.updateDrive(0)); await page.waitForSelector(native ? '#bigmap-wrap.show' : '#world-map.show'); };
    const holdF = async (foot = false) => { await page.keyboard.down('f'); await page.evaluate(({ foot }) => { for (let i = 0; i < 4; i++) { if (game.state === 'montage') break; if (foot) game.updateFoot(0.4); else game.updateDrive(0.4); } }, { foot }); await page.keyboard.up('f'); await page.waitForFunction(() => game.state !== 'montage'); };
    const cdp = await context.newCDPSession(page);
    const clickHerePin = async (touch = false) => {
        const point = await page.evaluate(() => {
            const m = game.explore.map, v = m.views.here, h = m.hereInfo;
            const pins = h.pins.filter(p => Math.hypot(p.x - game.player.x, p.z - game.player.z) > 180);
            const pin = pins.find(p => p.office) || pins[0]; if (!pin) throw new Error('no test destination');
            // Centre on the real POI so the click remains visible on narrow screens.
            v.cx = pin.x; v.cy = pin.z; m.draw();
            const r = m.cv.getBoundingClientRect(); return { x: r.left + m.W / 2, y: r.top + m.H / 2, pin };
        });
        if (touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 0 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        else await page.mouse.click(point.x, point.y); return point.pin;
    };
    await page.evaluate(async () => { await game.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' }); game.playMontage = async () => {}; game.audio.setMuted(true); });
    let before = await snap(); await openM(); const pin = await clickHerePin(); let after = await snap();
    check('Free-roam M and map pick do not move the car', samePose(before, after), { before, after });
    check('Map pick sets manual navigation and a persistent labeled mark', !!after.nav && !!after.route && after.selected === pin.label && await page.locator('.wm-card').isVisible(), after);
    await shot('desktop-local-mark.png');
    await page.keyboard.press('m'); await page.evaluate(() => game.updateDrive(0));
    // A brief F press cancels, while a full hold intentionally moves via the existing fuel/travel path.
    await page.keyboard.down('f'); await page.evaluate(() => game.updateDrive(0.3)); await page.keyboard.up('f'); await page.evaluate(() => game.updateDrive(0));
    after = await snap(); check('Releasing F early cancels travel', samePose(before, after) && after.fastTravels === before.fastTravels, after);
    await holdF(); after = await snap();
    check('Holding F travels to the marked local destination', Math.hypot(before.x - after.x, before.z - after.z) > 100 && after.fastTravels === before.fastTravels + 1, after);
    check('Local fast travel preserves fuel accounting', before.stations ? after.fuel < before.fuel : after.fuel === before.fuel, { before: before.fuel, after: after.fuel, mappedStations: before.stations });
    // Remote picks never create a route across an unbuilt area or change story progress.
    await openM(); before = await snap(); await page.locator('[data-sel="district:bellevue"]').first().click(); after = await snap();
    check('Remote row selects without travel or a local road route', samePose(before, after) && !after.route && !after.nav && !!after.selected, after);
    check('Remote pick preserves chapter progress', JSON.stringify(before.done) === JSON.stringify(after.done) && JSON.stringify(before.reached) === JSON.stringify(after.reached), { before, after });
    check('Remote destination explains explicit travel', /Hold F to travel/.test(await page.locator('.wm-card').innerText()), await page.locator('.wm-card').innerText());
    await shot('desktop-remote-mark.png');
    await page.locator('[data-clear]').click(); after = await snap(); check('Clear removes the selected destination', !after.selected && !after.nav, after);
    await page.locator('[data-sel="district:bellevue"]').first().click();
    await page.evaluate(() => { game.clamp = { paid: false }; }); await page.locator('[data-travel]').click(); after = await snap();
    check('Explicit remote travel respects the wheel clamp', samePose(before, after), after);
    await page.evaluate(() => { game.clamp = null; });
    // Exercise remote F dispatch through the real jump and district loader; only shorten the travel film.
    await page.evaluate(() => { game.flightCutscene = async () => {}; });
    await page.keyboard.down('f'); await page.evaluate(() => { for (let i = 0; i < 4 && game.state === 'drive'; i++) game.updateDrive(0.4); }); await page.keyboard.up('f');
    await page.waitForFunction(() => game.district === 'bellevue' && game.state === 'drive', null, { polling: 50, timeout: 240000 }); after = await snap();
    check('F explicitly travels to the marked remote district', after.district === 'bellevue' && !after.selected, after);
    await page.evaluate(async () => { await game.startFreeRoam('pipera', { tod: 'noon', weather: 'clear' }); game.fuel = 0.21; game.playMontage = async () => {}; });
    await openM(); await clickHerePin(); await page.keyboard.press('m'); before = await snap(); await holdF(); after = await snap();
    check('Insufficient fuel refuses the marked trip in a station district', before.stations > 0 && samePose(before, after) && after.fastTravels === before.fastTravels, { before, after });
    await page.evaluate(() => { game.fuel = 0; }); before = await snap(); await holdF(); after = await snap();
    check('Zero fuel refuses the marked local trip without moving or charging', samePose(before, after) && after.fuel === 0 && after.fastTravels === before.fastTravels, { before, after });
    await page.evaluate(() => { game.fuel = 27; }); before = await snap(); await holdF(); after = await snap();
    check('A fueled marked trip charges fuel through normal travel', after.fastTravels === before.fastTravels + 1 && after.fuel < before.fuel, { before, after });
    // Story native map already selected routes; keep that behavior and restore the objective when cleared.
    await page.evaluate(async () => { await game.enterChapter(0); game.playMontage = async () => {}; }); before = await snap(); await openM(true);
    const nativePoint = await page.evaluate(() => { const c = document.querySelector('#bigmap'), r = c.getBoundingClientRect(), point = game.nav.route.points[Math.floor(game.nav.route.points.length / 2)], v = game.mapView; v.cx = point[0]; v.cz = point[1]; game.redrawMap(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(nativePoint.x, nativePoint.y); after = await snap();
    check('Story map marks a local point without moving or changing the chapter', samePose(before, after) && after.chapter === before.chapter && after.objective === before.objective && !!after.nav && after.nav.label !== before.nav.label && Math.hypot(after.nav.x - before.nav.x, after.nav.z - before.nav.z) > 50, { before, after });
    await page.locator('#navlist [data-nav="-1"]').click(); after = await snap(); check('Clear restores story navigation and removes the manual mark', !after.selected && after.objective === before.objective && !!after.route, after);
    await page.keyboard.press('m'); await page.evaluate(() => game.updateDrive(0));
    // On-foot routes must start at the walker, even when the parked car is elsewhere.
    await page.evaluate(() => { game.exitCar(); game.foot.teleport(game.foot.x + 30, game.foot.z); });
    await page.keyboard.press('m'); await page.evaluate(() => game.updateFoot(0)); await page.waitForSelector('#bigmap-wrap.show');
    await page.mouse.click(nativePoint.x, nativePoint.y);
    const walking = await page.evaluate(() => ({ walking: game.nav.walking, from: game.nav.player?.x, foot: game.foot.x, car: game.player.x }));
    check('On-foot map navigation starts at the walker', walking.walking && walking.from === walking.foot && walking.from !== walking.car, walking);
    // This arbitrary road point may be walking-only. Use the office's verified car access for F.
    await page.locator('#navlist [data-nav="0"]').click();
    await page.keyboard.press('m'); await page.evaluate(() => game.updateFoot(0));
    before = await snap(); await holdF(true); after = await snap();
    check('F on foot explicitly travels through the existing car travel path', after.state === 'drive' && after.fastTravels === before.fastTravels + 1 && Math.hypot(before.x - after.x, before.z - after.z) > 100, { before, after });
    await page.evaluate(() => game.explore.openWorldMap('bellevue')); before = await snap();
    await page.locator('[data-sel="district:bellevue"]').first().click(); after = await snap();
    check('A remote mark preserves the active story objective and progress', samePose(before, after) && before.chapter === after.chapter && before.objective === after.objective && JSON.stringify(before.done) === JSON.stringify(after.done) && JSON.stringify(before.reached) === JSON.stringify(after.reached) && !after.route, { before, after });
    await page.locator('[data-clear]').click(); after = await snap(); check('Clearing a remote mark resumes the existing story route', !after.selected && !!after.route && before.objective === after.objective, after);
    await page.locator('.wm-search').fill('pipera'); before = await snap(); await page.keyboard.press('Enter'); after = await snap();
    check('Search Enter marks a destination without travel', samePose(before, after) && !!after.selected && !after.route, after);
    await page.locator('[data-clear]').click(); await page.keyboard.press('m');
    // Mobile tap uses the same map selection path and leaves the travel control reachable.
    await page.evaluate(async () => { await game.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear' }); });
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); before = await snap(); await openM(); await clickHerePin(true); after = await snap();
        check(`Mobile ${viewport.width} map pick retains position and mark`, samePose(before, after) && !!after.selected, after);
        const box = await page.locator('.wm-card [data-travel]').boundingBox(); check(`Mobile ${viewport.width} explicit travel fits`, box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, box);
        await shot(`mobile-${viewport.width}-mark.png`);
        await page.locator('[data-clear]').click(); await page.keyboard.press('m');
    }
    check('No browser exceptions', report.errors.length === 0, report.errors);
    report.complete = true;
})().catch(e => { report.failure = e.stack; process.exitCode = 1; }).finally(async () => {
    report.complete ??= false;
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); await browser?.close(); server.close();
});
