// Native phone look and walking around retained visitors. Only initial setup
// writes the pose; the ray gate and the source/crowd population stay intact.
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = process.env.OUT || '/tmp/tourist-lincoln-crowd';
fs.mkdirSync(out, { recursive: true });

(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    let page;
    const result = { sourceCommit: cp.execFileSync('git', ['rev-parse', process.env.SOURCE_COMMIT || 'HEAD'], { encoding: 'utf8' }).trim(), setup: 'Initial public camera-exercise pose; actual CDP touch look and walking around visitors afterward.', looks: [], walks: [], frames: [], errors: [] };
    const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        page.setDefaultTimeout(120000);
        page.on('pageerror', error => result.errors.push(error.message));
        await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
        await page.addInitScript(() => requestAnimationFrame = () => 0);
        await page.goto(`http://127.0.0.1:${process.env.PORT || 8431}/game/?q=high`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.game?.achievements);
        await page.evaluate(async () => {
            game.setRoamHour(12); game.setRoamSeason('summer'); game.setRoamWeather('clear');
            await game.enterSpot('bel-lincoln-square');
            window.step = (n = 1) => { for (let i = 0; i < n; i++) { game.syncModalControls(); game.spot.update(.05); } };
            window.hunt = () => game.spot.spot.ctx.extras.photoHunt;
            window.flow = () => game.spot.spot.ctx.extras.participation;
            const s = game.spot, it = s.spot.interactables.find(i => i.kind === 'photo-hunt');
            s.ctl.enter(it.x, it.z, Math.PI); s.input.flush(); step(); game.drawFrame();
        });
        const population = () => page.evaluate(() => ({ people: game.spot.spot.crowd.count, buildings: game.spot.spot.data.buildings.length, colliders: game.spot.spot.colliders.length }));
        result.beforePopulation = await population();
        await page.locator('[data-btn=act]').tap(); await page.evaluate(() => step());
        assert.ok(await page.evaluate(() => flow().active));
        result.controls = await page.locator('.sp-participation').evaluate(el => ({ panel: el.getBoundingClientRect().toJSON(), buttons: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()) }));
        assert.ok(result.controls.buttons.every(b => b.width >= 44 && b.height >= 44));
        assert.ok(result.controls.panel.left >= 0 && result.controls.panel.right <= 390 && result.controls.panel.bottom <= 844);
        const look = async target => {
            for (let n = 0; n < 60; n++) {
                const a = await page.evaluate(target => {
                    const s = game.spot, t = target || hunt().targets[flow().run.step], v = s.camera.position.clone(); s.camera.getWorldPosition(v);
                    const desired = Math.atan2(-(t.x - v.x), -(t.z - v.z)), pitch = Math.atan2(t.y - v.y, Math.hypot(t.x - v.x, t.z - v.z));
                    return { dx: (((s.ctl.heading - desired + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) / .0024, dy: (s.ctl.pitch - pitch) / .0024 };
                }, target);
                if (Math.abs(a.dx) < 12 && Math.abs(a.dy) < 12) { await page.evaluate(() => step(5)); return n; }
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y: 580, id: 1 }] });
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 285 + Math.max(-100, Math.min(65, a.dx / 1.6)), y: 580 + Math.max(-160, Math.min(160, a.dy / 1.6)), id: 1 }] });
                await page.evaluate(() => step());
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            }
            throw Error('Native touch aiming did not align');
        };
        const walkWest = async () => {
            const before = await page.evaluate(() => ({ ...game.spot.position }));
            await look({ x: before.x - 10, y: before.y + 1.65, z: before.z });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 620, id: 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 580, id: 2 }] });
            const samples = await page.evaluate(() => { const samples = []; for (let i = 0; i < 35; i++) { step(); samples.push({ ...game.spot.position }); } return samples; });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            let previous = before, walked = 0;
            for (const p of samples) { const d = Math.hypot(p.x - previous.x, p.z - previous.z); assert.ok(d < .5 && Math.abs(p.y - previous.y) < .4, 'Nonphysical relocation'); walked += d; previous = p; }
            assert.ok(walked > 1, 'Native thumbstick did not walk');
            result.walks.push({ before, after: previous, walked, samples }); save();
        };
        for (let i = 0; i < 3; i++) {
            result.looks.push(await look());
            let sight = await page.evaluate(() => ({ visibility: hunt().visibility, busy: flow().run.busy, position: { ...game.spot.position } }));
            result.frames.push({ stage: i, initialSight: sight }); save();
            for (let attempt = 0; sight.busy && attempt < 4; attempt++) {
                assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-bel-badge')));
                await walkWest(); await look();
                sight = await page.evaluate(() => ({ visibility: hunt().visibility, busy: flow().run.busy, position: { ...game.spot.position } }));
                result.frames.at(-1).afterWalk = sight; save();
            }
            assert.ok(!sight.busy && sight.visibility.clear, JSON.stringify(sight));
            const frame = await page.evaluate(() => {
                game.drawFrame(); const q = game.camera.position.clone(), d = q.clone(); game.camera.getWorldPosition(q); game.camera.getWorldDirection(d);
                return { image: document.querySelector('canvas').toDataURL('image/webp', .85), camera: { position: q.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI }, triangles: game.r3d.stats.triangles, calls: game.r3d.stats.drawCalls };
            });
            fs.writeFileSync(`${out}/lincoln-${i + 1}.webp`, Buffer.from(frame.image.split(',')[1], 'base64')); delete frame.image;
            result.frames.at(-1).capture = frame; assert.ok(frame.triangles <= 1.5e6 && frame.calls <= 400);
            await page.locator('.sp-participation [data-action]').tap(); await page.evaluate(() => step(9));
            if (i < 2) assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-bel-badge')));
            save();
        }
        assert.ok(await page.evaluate(() => game.achievements.isUnlocked('lm-bel-badge')));
        result.afterPopulation = await population(); assert.deepEqual(result.beforePopulation, result.afterPopulation);
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
        result.persisted = await page.evaluate(() => game.achievements.isUnlocked('lm-bel-badge')); assert.ok(result.persisted);
        assert.deepEqual(result.errors, []); result.passed = true; save(); await context.close();
    } catch (error) { result.failure = { message: error.message, stack: error.stack }; save(); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
