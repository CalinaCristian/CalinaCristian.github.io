#!/usr/bin/env node
// Native keyboard/mouse/touch events through Input and the real Drone controller.
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const root = path.resolve(option('root', path.join(__dirname, '../../..'))), out = path.resolve(option('out', '/tmp/drone-input-check'));
fs.mkdirSync(out, { recursive: true });
(async () => {
    const server = http.createServer((req, res) => {
        let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
        fs.readFile(f, (error, data) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream' }[path.extname(f)] || 'application/octet-stream' }); res.end(error ? 'missing' : data); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, checks: [], errors: [], consoleErrors: [] };
    const check = (name, details, pass) => { report.checks.push({ name, pass: !!pass, details }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); };
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
        await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`); await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        const initial = await page.evaluate(async () => {
            const g = game; await g.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' }); g.audio.setMuted(true); g.exitCar();
            const d = g.explore.drone;
            if (!d.deploy()) throw new Error(d.canDeploy().reason); d.t = 3; d._lift(0.05);
            window.droneReset = (pitch = 0, mode = 1) => {
                d.rth = false; d.rthPath = null; d.phase = 'fly'; d.mode = mode; d.battery = 1; d.pos.set(d.home.x, d.home.y + 80, d.home.z); d.vel.set(0, 0, 0); d.yaw = 0; d.gimbal = pitch;
                g.input.keys.clear(); g.input.flush(); g.input.takeLook(); g.input.lookAllowed = true; g.input.setLookMode('hold'); d.stick.x = d.stick.y = 0;
                return { x: d.pos.x, y: d.pos.y, z: d.pos.z };
            };
            window.droneStep = (frames = 40) => {
                const p = d.pos.clone(), yaw = d.yaw; for (let i = 0; i < frames; i++) d._fly(0.05);
                return { delta: d.pos.clone().sub(p).toArray(), yawDelta: d.yaw - yaw, yaw: d.yaw, pitch: d.gimbal, speed: d.vel.length(), verticalSpeed: d.vel.y, battery: d.battery, altitude: d.pos.y - d.c.groundAt(d.pos.x, d.pos.z, d.pos.y) };
            };
            return { pitch: d.gimbal, verticalPads: document.querySelectorAll('#drone-hud [data-hold]').length, cancelBeforeFreeze: true };
        });
        check('free flight starts level and vertical pads are removed', initial, initial.pitch === 0 && initial.verticalPads === 0);
        // Keep the mouse over the canvas and exercise the real hold-to-look path.
        const mouseLook = async (dx, dy) => {
            await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); await page.mouse.move(640 + dx, 360 + dy, { steps: 5 });
            const look = await page.evaluate(() => { const d = game.explore.drone; d._fly(0.05); return { yaw: d.yaw, pitch: d.gimbal }; });
            await page.mouse.up({ button: 'right' }); return look;
        };
        const held = async (keys, frames = 40) => { for (const k of keys) await page.keyboard.down(k); const r = await page.evaluate(frames => droneStep(frames), frames); for (const k of [...keys].reverse()) await page.keyboard.up(k); return r; };
        for (const direction of ['up', 'down', 'back']) {
            await page.evaluate(() => droneReset()); const look = await mouseLook(80, direction === 'down' ? 280 : -280);
            const r = await held([direction === 'back' ? 's' : 'w']);
            const sign = direction === 'back' ? -1 : 1;
            const expected = [-Math.sin(look.yaw) * Math.cos(look.pitch) * sign, Math.sin(look.pitch) * sign, -Math.cos(look.yaw) * Math.cos(look.pitch) * sign];
            const length = Math.hypot(...r.delta), dot = r.delta.reduce((sum, v, i) => sum + v * expected[i], 0) / length;
            check(`native mouse + ${direction === 'back' ? 'S reverses the full view' : `W flies ${direction} along the view`}`, { ...r, expected, alignment: dot }, dot > 0.99999 && Math.abs(r.delta[1]) > 5 && Math.abs(r.yawDelta) < 1e-10);
        }
        for (const [key, sign] of [['a', -1], ['d', 1]]) {
            await page.evaluate(() => droneReset()); const look = await mouseLook(80, -280), r = await held([key]);
            const right = [Math.cos(look.yaw) * sign, 0, -Math.sin(look.yaw) * sign], length = Math.hypot(...r.delta), dot = r.delta.reduce((sum, v, i) => sum + v * right[i], 0) / length;
            check(`native ${key.toUpperCase()} strafes without an active mouse gesture`, { ...r, alignment: dot }, dot > 0.99999 && Math.abs(r.delta[1]) < 1e-9 && Math.abs(r.yawDelta) < 1e-10);
        }
        for (const key of ['ControlLeft', 'Space', 'e', 'q', 'c', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowLeft']) {
            await page.evaluate(() => droneReset()); const r = await held([key]);
            check(`native ${key} does not climb, descend or turn`, r, Math.hypot(...r.delta) < 1e-9 && Math.abs(r.yawDelta) < 1e-10);
        }
        for (const [key, speed] of [['1', 4], ['2', 12], ['3', 26]]) {
            await page.evaluate(() => droneReset()); await page.keyboard.press(key); const r = await held(['w'], 60);
            check(`native speed mode ${key}`, r, Math.abs(r.speed - speed) < 0.05);
        }
        await page.evaluate(() => droneReset()); await page.keyboard.press('3'); const boost = await held(['w', 'ShiftLeft'], 60);
        check('native Shift boost keeps Sport speed', boost, Math.abs(boost.speed - 46.8) < 0.1);
        await page.mouse.wheel(0, -100); const wheelMode = await page.evaluate(() => game.explore.drone.mode);
        check('native mouse wheel cycles speed', { mode: wheelMode }, wheelMode === 0);
        const rangeFixture = await page.evaluate(() => {
            droneReset(); const d = game.explore.drone, b = d.c.boundary;
            for (let i = 0; i < 360; i++) {
                const a = i * Math.PI / 180, x = Math.sin(a), z = Math.cos(a), far = { x: d.home.x + x * 820, z: d.home.z + z * 820 };
                if (!b.segmentAllowed(d.home, far)) continue;
                d.pos.x = d.home.x + x * 795; d.pos.z = d.home.z + z * 795; d.yaw = Math.atan2(-x, -z); return { angle: a, legalBeyondRange: true };
            }
            return { legalBeyondRange: false };
        });
        const rangeFlight = await held(['w', 'ShiftLeft']);
        const rangeEnd = await page.evaluate(() => { const d = game.explore.drone; return { distance: Math.hypot(d.pos.x - d.home.x, d.pos.z - d.home.z), allowed: d.c.boundary.allowed(d.pos) }; });
        check('native boosted forward flight stops at the 800m range', { ...rangeFixture, ...rangeFlight, ...rangeEnd }, rangeFixture.legalBeyondRange && rangeEnd.distance <= 800.00001 && rangeEnd.distance > 799.9 && rangeEnd.allowed);
        await page.evaluate(() => droneReset(Math.PI / 2)); const ceiling = await held(['w'], 120);
        check('looking up + W respects the 120m ceiling', ceiling, ceiling.altitude <= 120 && ceiling.altitude > 119.9 && Math.abs(ceiling.verticalSpeed) < 1e-8);
        // The app's RAF is frozen for deterministic controller steps. PhotoMode's
        // supported render hook supplies its same-task render before reading pixels.
        await page.evaluate(() => { droneReset(); game.photo.o.render = () => game.drawFrame(); window.photoBefore = { gallery: game.photo.gallery.length, drone: game.explore.drone.stats.photos }; }); await page.keyboard.press('p'); const photo = await held(['w']);
        const opened = await page.evaluate(() => game.photo.active);
        await page.keyboard.press('Space'); await page.waitForFunction(() => game.photo.gallery.length > photoBefore.gallery);
        const captured = await page.evaluate(() => ({ gallery: game.photo.gallery.length, dronePhotos: game.explore.drone.stats.photos - photoBefore.drone, tagged: game.lastPhoto.drone }));
        check('native photo shutter captures and tags the aerial photo', captured, captured.gallery > 0 && captured.dronePhotos === 1 && captured.tagged);
        await page.keyboard.press('p');
        check('native P photo opens, suppresses flight input and closes', { ...photo, opened, closed: await page.evaluate(() => !game.photo.active) }, opened && Math.hypot(...photo.delta) < 1e-9 && await page.evaluate(() => !game.photo.active));
        await page.evaluate(() => droneReset()); await page.keyboard.down('h'); await page.evaluate(() => game.explore.drone.frame(0.05)); await page.keyboard.up('h');
        const home = await page.evaluate(() => { const d = game.explore.drone; d.frame(0.05); return { rth: d.rth, legs: d.rthPath?.length, inside: d.rthPath?.every(p => d.c.boundary.allowed(p)) }; });
        check('native H requests a legal return-home route', home, home.rth && home.legs && home.inside);
        const battery = await page.evaluate(() => { droneReset(); const d = game.explore.drone; d.battery = 0.149; d._fly(0.05); return { battery: d.battery, rth: d.rth, automatic: d.autoRth, legs: d.rthPath?.length }; });
        check('battery drain and automatic low-battery return remain active', battery, battery.battery < 0.149 && battery.rth && battery.automatic && battery.legs);
        // A real touchscreen drag on the existing stick and right-side look surface.
        await page.evaluate(() => { droneReset(); document.body.classList.add('touch'); });
        const cdp = await context.newCDPSession(page), stick = await page.locator('.dr-stick').boundingBox();
        const sx = stick.x + stick.width / 2, sy = stick.y + stick.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 1050, y: 360, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 1050, y: 160, id: 1 }] });
        await page.evaluate(() => game.explore.drone._fly(0.05));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 1050, y: 160, id: 1 }, { x: sx, y: sy, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 1050, y: 160, id: 1 }, { x: sx, y: sy - stick.height * 0.35, id: 2 }] });
        const touch = await page.evaluate(() => ({ ...droneStep(), stick: { ...game.explore.drone.stick } }));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const release = await page.evaluate(() => ({ ...game.explore.drone.stick }));
        check('native touch look + stick climbs and releases cleanly', { ...touch, release }, touch.pitch > 0.5 && touch.delta[1] > 3 && touch.stick.y < -0.5 && release.x === 0 && release.y === 0);
        await page.evaluate(() => droneReset());
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 500, id: 3 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 365, y: 500, id: 3 }] });
        const floating = await page.evaluate(() => ({ ...droneStep(), stick: { ...game.input.touch.stick } }));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        check('native floating touch stick strafes without turning', floating, floating.delta[0] > 3 && Math.abs(floating.delta[1]) < 1e-9 && Math.abs(floating.yawDelta) < 1e-9 && floating.stick.active);
        check('zero browser errors', { page: report.errors, console: report.consoleErrors }, report.errors.length === 0 && report.consoleErrors.length === 0);
        console.log(`${report.checks.filter(c => c.pass).length}/${report.checks.length} native-input checks passed; ${out}`);
        assert(report.checks.every(c => c.pass), 'Native drone input acceptance failed');
    } finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
