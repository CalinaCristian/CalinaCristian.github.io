// Native mouse / CDP touch proof. Setup poses isolate feature controls; they do
// not establish walking access from the destination's public arrival.
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const port = process.env.PORT || 8431;
const touch = process.env.TOUCH === '1';
const out = process.env.OUT || '/tmp/tourist-seattle-participation';
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(__filename, `${out}/runner.cjs`);

(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const result = { sourceCommit: cp.execFileSync('git', ['rev-parse', process.env.SOURCE_COMMIT || 'HEAD'], { encoding: 'utf8' }).trim(), touch, setup: 'Initial feature-adjacent poses isolate controls; public arrival routes require separate verification.', cases: [], errors: [] };
    let page;
    const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
    try {
        const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: touch, isMobile: touch });
        page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        page.setDefaultTimeout(120000);
        page.on('pageerror', error => result.errors.push(error.message));
        await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
        await page.addInitScript(() => requestAnimationFrame = () => 0);
        await page.goto(`http://127.0.0.1:${port}/game/?q=high`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.game?.achievements);
        await page.evaluate(() => {
            window.step = (n = 1) => { for (let i = 0; i < n; i++) { game.syncModalControls(); game.spot.update(.05); } };
            window.flow = () => game.spot.spot.ctx.extras.participation;
            game.setRoamHour(12); game.setRoamSeason('summer'); game.setRoamWeather('clear');
        });
        const tap = async selector => {
            if (!touch) return page.locator(selector).click();
            // Verify the actual current DOM hit, then send a real touchscreen
            // gesture at the same point, independently of locator hit checks.
            const point = await page.locator(selector).evaluate(el => {
                const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
                if (!el.contains(document.elementFromPoint(x, y))) throw Error('Native tap point is actually obstructed');
                return { x, y };
            });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
        const enter = async (id, key, title) => {
            await page.evaluate(async ({ id, key, title }) => {
                await game.enterSpot(id);
                window.hunt = () => game.spot.spot.ctx.extras[key];
                const s = game.spot, it = s.spot.interactables.find(it => it.label === title);
                if (!it) throw Error(`Missing interaction: ${title}`);
                s.ctl.enter(it.x, it.z, Math.PI, it.y); s.input.flush(); step(); game.drawFrame();
            }, { id, key, title });
        };
        const start = async () => {
            if (touch) await tap('[data-btn=act]'); else await page.keyboard.press('e');
            await page.evaluate(() => step());
            assert.ok(await page.evaluate(() => flow().active));
            const controls = await page.locator('.sp-participation').evaluate(el => ({ panel: el.getBoundingClientRect().toJSON(), buttons: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()) }));
            assert.ok(controls.buttons.every(b => b.width >= 44 && b.height >= 44));
            assert.ok(controls.panel.left >= 0 && controls.panel.right <= (touch ? 390 : 1280) && controls.panel.bottom <= (touch ? 844 : 720));
            return controls;
        };
        const frame = async label => {
            const f = await page.evaluate(() => {
                game.drawFrame();
                const q = game.camera.position.clone(), d = q.clone(); game.camera.getWorldPosition(q); game.camera.getWorldDirection(d);
                return { image: document.querySelector('canvas').toDataURL('image/webp', .85), visibility: hunt()?.visibility, position: { ...game.spot.position }, camera: { position: q.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI }, triangles: game.r3d.stats.triangles, calls: game.r3d.stats.drawCalls };
            });
            fs.writeFileSync(`${out}/${label}.webp`, Buffer.from(f.image.split(',')[1], 'base64')); delete f.image;
            assert.ok(f.triangles <= 1.5e6 && f.calls <= 400, JSON.stringify(f));
            return { file: `${label}.webp`, ...f };
        };
        const aim = async moving => {
            const waits = [];
            for (let n = 0; n < 120; n++) {
                const a = await page.evaluate(() => {
                    const s = game.spot, t = hunt().targets[flow().run.step], v = s.camera.position.clone(); s.camera.getWorldPosition(v);
                    const desired = Math.atan2(-(t.x - v.x), -(t.z - v.z)), pitch = Math.atan2(t.y - v.y, Math.hypot(t.x - v.x, t.z - v.z));
                    return { dx: (((s.ctl.heading - desired + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) / .0024, dy: (s.ctl.pitch - pitch) / .0024, busy: flow().run.busy, permitted: !t.available || t.available(s), visibility: hunt().visibility };
                });
                if (!a.busy) return { looks: n, waits };
                // A moving train can leave during the native drags. Keep the
                // failed sight, wait for the next actual scene pass, then track
                // again. Never freeze the train or bypass its sight gate.
                if (moving && !a.permitted) {
                    const wait = await page.evaluate(() => {
                        const t = hunt().targets[flow().run.step]; let frames = 0;
                        while (!(t.available(game.spot) && t.x < 68) && frames++ < 6000) step();
                        return { frames, visibility: hunt().visibility };
                    });
                    waits.push({ before: a.visibility, ...wait });
                    assert.ok(wait.frames < 6000); continue;
                }
                if (touch) {
                    const dx = Math.max(-100, Math.min(65, a.dx / 1.6)), dy = Math.max(-160, Math.min(160, a.dy / 1.6));
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y: 580, id: 1 }] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 285 + dx, y: 580 + dy, id: 1 }] });
                    await page.evaluate(() => step());
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                } else {
                    await page.evaluate(() => game.input.setLookMode('hold'));
                    await page.mouse.move(800, 520); await page.mouse.down({ button: 'right' });
                    await page.mouse.move(800 + Math.max(-600, Math.min(400, a.dx)), 520 + Math.max(-450, Math.min(150, a.dy)));
                    await page.evaluate(() => step()); await page.mouse.up({ button: 'right' });
                }
                await page.evaluate(() => step(2));
            }
            throw Error('Native aiming did not obtain a clear, steady feature view');
        };

        if (process.env.ELEVATOR === '1') {
            await enter('space-needle', 'needleElevator', 'Ride the elevator to the observation level (41 s)');
            const elevator = result.elevator = { cancels: [] }, origin = await page.evaluate(() => ({ ...game.spot.position }));
            for (const mode of ['leave', 'escape', 'pause', 'conditions', 'photo', 'map', 'hidden']) {
                elevator.controls = await start(); await page.evaluate(() => step(40));
                assert.ok(await page.evaluate(() => hunt().debug()?.t > 1));
                assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-needle-up')));
                if (mode === 'leave') await tap('.sp-participation [data-leave]');
                else if (mode === 'escape') await page.keyboard.press('Escape');
                else await page.evaluate(mode => {
                    if (mode === 'pause') game.togglePause(true);
                    if (mode === 'conditions') { game.buildConditions(); game.toggleConditions(true); }
                    if (mode === 'photo') game.photo.open();
                    if (mode === 'map') game.spot.openMap();
                    if (mode === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; }
                    step();
                }, mode);
                const state = await page.evaluate(() => ({ active: flow().active, ride: hunt().debug(), position: { ...game.spot.position }, walker: game.spot.ctl.active, award: game.achievements.isUnlocked('lm-needle-up') }));
                assert.ok(!state.active && !state.ride && state.walker && !state.award, JSON.stringify({ mode, state }));
                for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(state.position[key] - origin[key]) < .01);
                elevator.cancels.push({ mode, ...state }); save();
                await page.evaluate(() => { game.togglePause(false); if (game.condOpen) game.toggleConditions(false); if (game.photo.active) game.photo.close(); game.spot.ui.closePanel(); game.spot.input.flush(); step(); });
            }
            await start(); await tap('.sp-participation [data-action]'); await page.evaluate(() => step(100));
            elevator.midpoint = await frame('elevator-moving');
            assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-needle-up')));
            await page.evaluate(() => step(110));
            elevator.complete = await page.evaluate(() => ({ active: flow().active, ride: hunt().debug(), position: { ...game.spot.position }, walker: game.spot.ctl.active, award: game.achievements.isUnlocked('lm-needle-up'), retiredDeckAward: game.achievements.isUnlocked('lm-needle-360') }));
            assert.ok(elevator.complete.award && !elevator.complete.active && elevator.complete.walker && !elevator.complete.retiredDeckAward);
            elevator.arrival = await frame('elevator-loupe-arrival'); save();
        }

        for (const [id, key, title, award] of [
            ['chihuly', 'chihulyFraming', 'Frame the suspended sculpture', 'lm-chihuly-glasshouse'],
            ['space-needle', 'loupeLook', 'Look down through the glass floor', 'lm-needle-loupe'],
            ['mopop', 'monorailFraming', 'Frame the Monorail passing MoPOP', 'lm-mopop-monorail'],
            ['kerry-park', 'kerryNightFraming', 'Frame the city lights at dusk', 'lm-kerry-blue-hour'],
        ].filter(([id]) => !process.env.ONLY_SPOTS || process.env.ONLY_SPOTS.split(',').includes(id))) {
            await enter(id, key, title);
            const rec = { id, key, title, controls: await start(), frames: [], nativeLooks: [] }; result.cases.push(rec); save();
            const before = await page.evaluate(() => ({ ...game.spot.position }));
            await page.evaluate(() => step(100));
            assert.ok(!await page.evaluate(id => game.achievements.isUnlocked(id), award));
            await tap('.sp-participation [data-leave]');
            assert.ok(!await page.evaluate(() => flow().active));
            rec.idleAward = false; rec.cancelAward = false;
            assert.ok(Math.hypot((await page.evaluate(() => game.spot.position.x)) - before.x, (await page.evaluate(() => game.spot.position.z)) - before.z) < .5);
            if (id === 'kerry-park') await page.evaluate(() => { game.setRoamHour(22); step(40); });
            await start();
            const count = await page.evaluate(() => hunt().targets.length);
            for (let i = 0; i < count; i++) {
                if (id === 'mopop') {
                    rec.waitFrames = await page.evaluate(() => { let n = 0; while (!(hunt().targets[0].available(game.spot) && hunt().targets[0].x < 68) && n++ < 6000) step(); return n; });
                    assert.ok(rec.waitFrames < 6000);
                }
                rec.nativeLooks.push(await aim(id === 'mopop')); rec.frames.push(await frame(`${id}-${i + 1}`));
                await tap('.sp-participation [data-action]'); await page.evaluate(() => step(9));
                if (i < count - 1) assert.ok(!await page.evaluate(id => game.achievements.isUnlocked(id), award));
                save();
            }
            assert.ok(await page.evaluate(id => game.achievements.isUnlocked(id), award));
            assert.ok(!await page.evaluate(() => flow().active));
            rec.complete = true; rec.captures = await page.evaluate(() => hunt().captures); save();
        }
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
        result.persisted = await page.evaluate(() => ['lm-chihuly-glasshouse', 'lm-needle-loupe', 'lm-mopop-monorail', 'lm-kerry-blue-hour'].map(id => ({ id, unlocked: game.achievements.isUnlocked(id) })));
        assert.deepEqual(result.errors, []); result.passed = true; save(); await context.close();
    } catch (error) {
        result.failure = { message: error.message, stack: error.stack };
        if (page) {
            result.failure.state = await page.evaluate(() => {
                const button = document.querySelector('.sp-participation [data-action]'), box = button?.getBoundingClientRect(), parents = [];
                for (let p = button; p; p = p.parentElement) { const s = getComputedStyle(p); parents.push({ tag: p.tagName, id: p.id, className: p.className, pointer: s.pointerEvents, display: s.display, visibility: s.visibility, opacity: s.opacity, transform: s.transform, zIndex: s.zIndex }); }
                return { position: { ...game.spot?.position }, visibility: typeof hunt === 'function' ? hunt()?.visibility : null, active: typeof flow === 'function' ? flow()?.active : null, bodyClass: document.body.className, button: box?.toJSON(), hit: box ? document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.outerHTML?.slice(0, 300) : null, parents };
            }).catch(() => null);
            await page.screenshot({ path: `${out}/failed-ui.webp`, type: 'webp' }).catch(() => {});
        }
        save(); throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
