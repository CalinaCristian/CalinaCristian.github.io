// One browser, actual public app, exact immutable before/after sources.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const base = process.env.OUT || '/workspace/reality-pass/seattle-visit-ground-d91aadd8';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { toolSHA256: hash(fs.readFileSync(__filename)), started: new Date().toISOString(), scopes: [], errors: [], failures: [] };
const save = () => fs.writeFileSync(path.join(base, 'native-report.json'), JSON.stringify(report, null, 2));
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
        for (const label of ['before', 'after']) {
            const page = await ctx.newPage(), requests = [], errors = [];
            page.on('pageerror', e => { errors.push(e.message); save(); });
            page.on('response', r => { if (r.url().startsWith('http://127.0.0.1:8494/')) requests.push({ url: r.url(), status: r.status() }); });
            await page.addInitScript(() => { window.requestAnimationFrame = () => 0; window.cancelAnimationFrame = () => {}; });
            await page.goto(`http://127.0.0.1:8494/${label}/game/?weather=clear`, { waitUntil: 'domcontentloaded', timeout: 120000 });
            await page.waitForFunction(() => window.game, { timeout: 120000 });
            const entered = await page.evaluate(async () => {
                const g = game; g._menuTod = 'day'; g.weatherOverride = 'clear'; g.r3d.setSeason('summer'); g.r3d.setQuality('high'); g.quality = 'high';
                return g.enterSpot('pike-place');
            });
            if (!entered) throw Error(`${label}: actual enterSpot failed`);
            const scope = { label, sourceCommit: JSON.parse(fs.readFileSync(path.join(base, label + '-source-manifest.json'))).sourceCommit,
                started: new Date().toISOString(), photos: [], errors, requests, routes: [] };
            report.scopes.push(scope); save();
            async function photo(id, pose = null, kind = 'fixture') {
                const captured = await page.evaluate(({ pose, kind }) => {
                    const g = game, s = g.spot, ctl = s.ctl, ground = s.spot.ground;
                    if (pose) { ctl.teleport(pose[0], pose[1], -pose[2] * Math.PI / 180); ctl.pitch = (pose[3] || 0) * Math.PI / 180; ctl.place(); }
                    s.update(0); g.r3d.frame(0); g.r3d.frame(0);
                    const camera = new (g.camera.position.constructor)(); g.camera.getWorldPosition(camera);
                    return { pixels: g.canvas.toDataURL('image/jpeg', .94).split(',')[1], kind, pose: { ...ctl.position }, camera: { x: camera.x, y: camera.y, z: camera.z, fov: g.camera.fov, near: g.camera.near, far: g.camera.far, pitch: ctl.pitch },
                        analyticGroundY: ground.heightAt(ctl.x, ctl.z), terrainGroundY: ground.terrainHeightAt?.(ctl.x, ctl.z) ?? null,
                        physicalFloorY: ground.groundAt(ctl.x, ctl.z, ctl.y), stats: { ...g.r3d.stats }, sceneTriangles: s.spot.tris };
                }, { pose, kind });
                const pixels = Buffer.from(captured.pixels, 'base64'); delete captured.pixels;
                const file = `${label}-${id}.jpg`; fs.writeFileSync(path.join(base, file), pixels);
                scope.photos.push({ id, file, captureDate: new Date().toISOString(), sha256: hash(pixels), bytes: pixels.length, ...captured }); save();
            }
            await photo('spawn', null, 'actual-native-spawn');
            // Literal keydown/keyup events feed the normal Input handler. No
            // harness auto, position changes, jump/reset or movement overrides.
            scope.routes.push(await page.evaluate(() => {
                const s = game.spot, ctl = s.ctl, ground = s.spot.ground;
                const keys = new Set(), samples = [], goals = [[-20, 14], [-43, 35], [-47, 44], [-49, 48], [-40, 62]];
                const key = (code, down) => { if (keys.has(code) === down) return; down ? keys.add(code) : keys.delete(code); window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })); };
                const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
                let index = 0, seconds = 0, moved = 0, maxFloorErrorM = 0, maxVerticalStepM = 0, maxStill = 0, still = 0;
                for (let step = 0; step < 2700 && index < goals.length; step++) {
                    const [tx, tz] = goals[index], dx = tx - ctl.x, dz = tz - ctl.z;
                    if (Math.hypot(dx, dz) < .8) { index++; continue; }
                    const err = norm(Math.atan2(-dx, -dz) - ctl.heading);
                    key('ArrowLeft', err > .05); key('ArrowRight', err < -.05); key('KeyW', Math.abs(err) < .28);
                    const before = { ...ctl.position }; s.update(1 / 30); seconds += 1 / 30;
                    const distance = Math.hypot(ctl.x - before.x, ctl.z - before.z); moved += distance;
                    still = distance < .002 ? still + 1 / 30 : 0; maxStill = Math.max(maxStill, still);
                    maxVerticalStepM = Math.max(maxVerticalStepM, Math.abs(ctl.y - before.y));
                    const floor = ground.groundAt(ctl.x, ctl.z, ctl.y), error = Math.abs(ctl.y - floor); maxFloorErrorM = Math.max(maxFloorErrorM, error);
                    if (step % 10 === 0) samples.push({ step, goal: index, before, after: { ...ctl.position }, floor, error, bumped: ctl.bumped, cameraY: ctl.rig.position.y });
                    if (still > 8) break;
                }
                for (const code of [...keys]) key(code, false);
                return { kind: 'normal-input-walking-from-native-spawn', controls: 'DOM keyboard Input handler, W and ArrowLeft/Right only; no auto/reset/jump/teleport', goals, reached: index, passed: index === goals.length,
                    seconds, movedM: moved, maxFloorErrorM, maxVerticalStepM, maxStillSec: maxStill, end: { ...ctl.position }, samples };
            })); save();
            await photo('walk-end', null, 'actual-normal-input-route-end');
            for (const [id, pose] of [
                ['market-sign', [-35, 25, 244, 4]], ['stalls', [-80, 3, 235, 0]],
                ['gum-wall', [-44, 57, 120, -4]], ['gum-approach', [-44, 48, 145, -10]],
                ['old-sinkhole', [-11.5, 119.5, 250, -15]], ['market-paving', [-33.5, 83.5, 305, -20]],
            ]) await photo(id, pose);
            scope.finished = new Date().toISOString(); scope.badRequests = requests.filter(r => r.status >= 400);
            if (errors.length) report.failures.push({ label, reason: 'native-page-errors', errors });
            save(); await page.close();
        }
        await ctx.close();
    } finally { await browser.close(); report.browserClosed = new Date().toISOString(); save(); }
})().catch(e => { report.errors.push(e.stack || e.message); save(); console.error(e); process.exitCode = 1; });
