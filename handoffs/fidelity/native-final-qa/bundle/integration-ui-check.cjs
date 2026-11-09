#!/usr/bin/env node
const sourceGuard=require('./source-guard.cjs').fromEnvironment();
// Combined phone hit-target, recovery, modal and cockpit regression.
// Usage: node integration-ui-check.cjs ROOT OUT
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const out = path.resolve(process.argv[3] || '/tmp/integration-ui');
fs.mkdirSync(out, { recursive: true });
const report = { root, checks: [], errors: [], consoleErrors: [], layouts: [], notes: [
    'System Chromium/SwiftShader; phone viewport and native touch emulation, not physical iPhone testing.',
    'Real game loop and native controls; world draws suppressed between explicit captures after the first district load.',
] };
let browser;
const server = http.createServer((req, res) => {
    let uri = decodeURIComponent(req.url.split('?')[0]); if (uri.endsWith('/')) uri += 'index.html';
    const file = path.join(root, uri);
    sourceGuard.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'missing' : body); });
});
const persist = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
function check(name, pass, details) { report.checks.push({ name, pass: !!pass, details }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); persist(); }
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    await context.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
    const page = await context.newPage(); page.setDefaultTimeout(90000); require('./integration-browser-bounds.cjs').boundEvaluations(page);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('crash', () => report.errors.push('PAGE_CRASH'));
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.game?.explore && game.save && game.achievements, null, { timeout: 90000 });
    await page.evaluate(async () => {
        game.audio.setMuted(true); game.quality = 'low'; game.r3d.setQuality('low');
        await game.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' });
        game.__qaDraw = game.drawFrame.bind(game); game.drawFrame = () => {};
    });
    await page.waitForFunction(() => game.state === 'drive' && !document.body.classList.contains('ui-modal'));
    const target = async selector => page.locator(selector).evaluate(el => {
        const r = el.getBoundingClientRect(), style = getComputedStyle(el), x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { visible: style.visibility !== 'hidden' && style.display !== 'none' && r.width > 0 && r.height > 0,
            reachable: !!hit && el.contains(hit), fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            rect: [r.x, r.y, r.width, r.height], hit: hit?.id || hit?.tagName, inert: el.inert };
    });
    const controlsHidden = async label => {
        const data = await page.evaluate(() => [...document.querySelectorAll('#touch,#pause-btn,#explore-bar,.photo-open,#cond-btn,#minimap-toggle')].map(el => {
            const s = getComputedStyle(el); return { id: el.id || el.className, hidden: s.visibility === 'hidden' || s.display === 'none' || !el.getBoundingClientRect().width, inert: el.inert };
        }));
        check(label + ': underlying gameplay controls are hidden and inert', data.every(e => e.hidden && e.inert), data);
    };
    const shot = async label => { await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, label + '.png')); };
    for (const [width, height] of [[390, 844], [844, 390]]) {
        const label = `${width}x${height}`;
        await page.setViewportSize({ width, height });
        await page.evaluate(() => { game.resize(); game.player.speed = 0; game.player.updateRig(0); });
        const map = await target('#minimap'), collapse = await target('#minimap-toggle');
        check(label + ': fresh mobile mini-map is visible with reachable collapse', map.visible && collapse.reachable && collapse.fits && await page.evaluate(() => game.opts.minimap && !game._minimapCollapsed), { map, collapse });
        await page.locator('#minimap-toggle').tap();
        check(label + ': native mini-map collapse keeps the user option enabled', !((await target('#minimap')).visible) && await page.evaluate(() => game.opts.minimap && game._minimapCollapsed), await target('#minimap-toggle'));
        await page.locator('#minimap-toggle').tap();
        const layout = await page.evaluate(async () => {
            const THREE = await import('/game/vendor/three.module.min.js'), { uiChecks } = await import('/game/dev/harness/visual/page/ui.js');
            game.player.updateRig(0); game.scene.updateMatrixWorld(true); return uiChecks(THREE, game);
        });
        report.layouts.push({ width, height, ...layout });
        check(label + ': cockpit screen and cluster remain on-screen and unoccluded', Object.values(layout.parts).every(p => p.outside === 0 && p.occluded === 0), layout.parts);
        check(label + ': HUD leaves cockpit instruments clear', !layout.issues.some(i => i[0] === 'hud-covers-cockpit'), layout.issues);
        await page.evaluate(() => game.__qaDraw({ mirror: true })); await shot('drive-' + label);
        await page.locator('#pause-btn').tap(); await page.waitForFunction(() => document.body.classList.contains('ui-modal'));
        await controlsHidden(label + ' pause');
        check(label + ': pause exposes native Reset position and Fast travel', await page.locator('[data-pa="reset-position"]').count() === 1 && await page.locator('[data-pa="fast-travel"]').count() === 1);
        await page.locator('[data-pa="reset-position"]').scrollIntoViewIfNeeded();
        const reset = await target('[data-pa="reset-position"]'); check(label + ': scrolled recovery button receives native touch', reset.reachable && reset.fits, reset);
        await page.locator('#pause-menu .pm-x').tap(); await page.waitForFunction(() => !document.body.classList.contains('ui-modal'));
        await page.locator('#cond-btn').tap(); await page.waitForFunction(() => game.condOpen && document.body.classList.contains('ui-modal'));
        await controlsHidden(label + ' conditions'); await shot('conditions-' + label);
        await page.locator('#cond-panel [data-close]').scrollIntoViewIfNeeded(); await page.locator('#cond-panel [data-close]').tap();
        await page.waitForFunction(() => !game.condOpen && !document.body.classList.contains('ui-modal'));
        await page.locator('[data-btn="map"]').tap(); await page.waitForFunction(() => game.explore.map.isOpen && document.body.classList.contains('ui-modal'));
        await controlsHidden(label + ' world map');
        await page.locator('[data-sel="district:romana"]').first().tap();
        const travel = await target('#world-map [data-travel]'); check(label + ': marked-map Fast travel receives touch inside viewport', travel.reachable && travel.fits, travel);
        await shot('marked-map-' + label); await page.locator('#world-map [data-clear]').tap(); await page.locator('#world-map .wm-x').tap();
        await page.waitForFunction(() => !game.explore.map.isOpen && !document.body.classList.contains('ui-modal'));
    }
    await page.locator('#pause-btn').tap();
    const movingGuard = await page.evaluate(() => {
        // Freeze normal physics in the real pause menu, then inspect the same speed guard
        // exposed by the UI and by the production recovery entry point.
        game.player.speed = 7; game.renderPause('main');
        const before = { x: game.player.x, z: game.player.z, fuel: game.fuel, done: [...game.progress.done] };
        const disabled = document.querySelector('[data-pa="reset-position"]').disabled, result = game.resetPosition();
        return { disabled, result, before, after: { x: game.player.x, z: game.player.z, fuel: game.fuel, done: [...game.progress.done] } };
    });
    check('moving-car recovery is disabled and its position guard refuses without fuel or progress changes', movingGuard.disabled && movingGuard.result === false && JSON.stringify(movingGuard.before) === JSON.stringify(movingGuard.after), movingGuard);
    await page.evaluate(() => { game.player.speed = 0; });
    await page.locator('#pause-menu .pm-x').tap(); await page.waitForFunction(() => !document.body.classList.contains('ui-modal'));
    await page.evaluate(() => { game.player.speed = 0; game.__qaRecovery = { fuel: game.fuel, done: [...game.progress.done], stats: { ...game.stats } }; });
    await page.locator('#pause-btn').tap(); await page.locator('[data-pa="reset-position"]').scrollIntoViewIfNeeded(); await page.locator('[data-pa="reset-position"]').tap();
    let recovery = await page.evaluate(() => ({ before: game.__qaRecovery, after: { fuel: game.fuel, done: [...game.progress.done], stats: { ...game.stats } }, state: game.state }));
    check('native car recovery changes no fuel or progress', recovery.before.fuel === recovery.after.fuel && JSON.stringify(recovery.before.done) === JSON.stringify(recovery.after.done) && recovery.state === 'drive', recovery);
    await page.waitForFunction(() => !document.body.classList.contains('ui-modal'));
    const getOut = await target('[data-btn="foot"]'); check('native Get out button remains reachable', getOut.reachable && getOut.fits, getOut);
    await page.locator('[data-btn="foot"]').tap(); await page.waitForFunction(() => game.state === 'foot');
    const hiddenRig = await page.evaluate(() => {
        const visible = []; game.player.rig.traverseVisible(o => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) visible.push(o.name || o.type); });
        return { visible, mirror: game.player.mirror.visible, enabled: game.player.driveRigShown };
    });
    check('native Get out leaves all cockpit/mirror meshes hidden', hiddenRig.visible.length === 0 && !hiddenRig.mirror && !hiddenRig.enabled, hiddenRig);
    await page.locator('#pause-btn').tap(); await page.locator('[data-pa="reset-position"]').scrollIntoViewIfNeeded(); await page.locator('[data-pa="reset-position"]').tap();
    recovery = await page.evaluate(() => ({ before: game.__qaRecovery, after: { fuel: game.fuel, done: [...game.progress.done] }, state: game.state }));
    check('native foot recovery changes no fuel or progress', recovery.before.fuel === recovery.after.fuel && JSON.stringify(recovery.before.done) === JSON.stringify(recovery.after.done) && recovery.state === 'foot', recovery);
    await page.waitForFunction(() => !document.body.classList.contains('ui-modal'));
    await page.evaluate(() => { game.hud.panel('<h2>Integration QA modal</h2>'); });
    await page.waitForFunction(() => document.body.classList.contains('ui-modal')); await controlsHidden('HUD panel');
    await page.locator('#panel [data-close]').tap(); await page.waitForFunction(() => !document.body.classList.contains('ui-modal'));
    // Keep the actual spot controller/UI running while avoiding continuous software draws.
    await page.evaluate(async () => { game.r3d.frame = () => {}; await game.enterSpot('fremont-troll'); });
    await page.waitForFunction(() => game.state === 'spot' && game.spot?.guide && !document.body.classList.contains('ui-modal'));
    for (const [width, height] of [[390, 844], [844, 390]]) {
        const label = `tour-${width}x${height}`; await page.setViewportSize({ width, height });
        await page.locator('#spot-ui .sp-mini').tap();
        await page.waitForFunction(() => game.spot.ui.panelOpen && document.body.classList.contains('ui-modal'));
        await controlsHidden(label + ' map');
        const tourStart = page.locator('#spot-ui .sp-panel [data-tour]'); await tourStart.scrollIntoViewIfNeeded();
        const start = await target('#spot-ui .sp-panel [data-tour]'); check(label + ': map tour action receives native touch', start.reachable && start.fits, start);
        await tourStart.tap(); await page.waitForFunction(() => game.spot.tour && !document.body.classList.contains('ui-modal'));
        await page.locator('#spot-ui [data-tour-skip]').waitFor({ state: 'visible' });
        // The phone title card is explicitly scrollable. Retain its unscrolled hit targets,
        // then use the same scroll a native user needs before measuring both buttons.
        report.tourUnscrolled ||= [];
        report.tourUnscrolled.push({ label, skip: await target('#spot-ui [data-tour-skip]'), end: await target('#spot-ui [data-tour-end]') });
        await page.locator('#spot-ui [data-tour-skip]').scrollIntoViewIfNeeded();
        const skip = await target('#spot-ui [data-tour-skip]'), end = await target('#spot-ui [data-tour-end]');
        check(label + ': native Skip and End buttons fit and receive touches after scrolling the title card', skip.reachable && skip.fits && end.reachable && end.fits, { skip, end });
        const before = await page.evaluate(() => ({ i: game.spot.tour.i, skipped: game.spot.tour.skipped }));
        await page.locator('#spot-ui [data-tour-skip]').tap();
        check(label + ': Skip advances the actual active tour', await page.evaluate(before => !game.spot.tour || game.spot.tour.i > before.i || game.spot.tour.skipped > before.skipped || game.spot.tour.state === 'done', before), before);
        await shot(label);
        await page.locator('#spot-ui [data-tour-end]').tap(); await page.waitForFunction(() => !game.spot.tour);
        check(label + ': End returns to free walking', await page.evaluate(() => game.state === 'spot' && !game.spot.tour && !game.spot.ui.panelOpen));
    }
    check('no unexpected browser JavaScript exceptions or console errors', report.errors.length === 0 && report.consoleErrors.length === 0, { exceptions: report.errors, consoleErrors: report.consoleErrors });
    report.complete = true;
})().catch(e => { report.failure = e.stack; process.exitCode = 1; }).finally(async () => {
    report.complete ??= false; persist(); await browser?.close(); await new Promise(resolve => server.close(resolve));
    if (report.checks.some(c => !c.pass) || report.errors.length || report.consoleErrors.length) process.exitCode = 1;
});
