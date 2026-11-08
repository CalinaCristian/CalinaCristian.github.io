// Production OnFootController physics with its documented harness auto input.
// Setup writes are labelled per case. No movement bypasses floor, collider or
// crowd handling; this runner does not claim mouse/touch input coverage.
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = process.env.OUT || '/tmp/tourist-continuous-walks'; fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(__filename, `${out}/runner.cjs`);
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const result = { sourceCommit: cp.execFileSync('git', ['rev-parse', process.env.SOURCE_COMMIT || 'HEAD'], { encoding: 'utf8' }).trim(), input: 'Production OnFootController.auto harness input; physics, floors, colliders and crowd retained.', cases: [], errors: [] };
    const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage();
        page.setDefaultTimeout(180000); page.on('pageerror', error => result.errors.push(error.message));
        await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
        await page.addInitScript(() => requestAnimationFrame = () => 0);
        await page.goto(`http://127.0.0.1:${process.env.PORT || 8432}/game/?q=high`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.game?.achievements);
        await page.evaluate(() => {
            game.setRoamHour(12); game.setRoamSeason('summer'); game.setRoamWeather('clear');
            window.step = (n = 1) => { for (let i = 0; i < n; i++) { game.syncModalControls(); game.spot.update(.05); } };
        });
        const enter = async id => { await page.evaluate(id => game.enterSpot(id), id); assert.equal(await page.evaluate(() => game.spot.walkerKind), 'OnFootController'); };
        const frame = async label => {
            const f = await page.evaluate(() => {
                game.drawFrame(); const q = game.camera.position.clone(), d = q.clone(); game.camera.getWorldPosition(q); game.camera.getWorldDirection(d);
                return { image: document.querySelector('canvas').toDataURL('image/webp', .85), player: { ...game.spot.position }, pose: { position: q.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI }, triangles: game.r3d.stats.triangles, calls: game.r3d.stats.drawCalls };
            });
            fs.writeFileSync(`${out}/${label}.webp`, Buffer.from(f.image.split(',')[1], 'base64')); delete f.image;
            assert.ok(f.triangles <= 1.5e6 && f.calls <= 400); return { file: `${label}.webp`, ...f };
        };
        await page.exposeFunction('saveWalkProgress', progress => { result.walkProgress = progress; save(); });
        const walk = async (points, tolerance = .45) => page.evaluate(async ({ points, tolerance }) => {
            const s = game.spot, samples = []; let i = 0, frames = 0, walked = 0, maxStep = 0, maxRise = 0, stuck = 0, noProgress = 0, best = Infinity, previous = { ...s.position };
            while (i < points.length && frames++ < 12000) {
                const [x, z] = points[i], dx = x - s.position.x, dz = z - s.position.z;
                const distance = Math.hypot(dx, dz);
                if (distance < tolerance) { i++; best = Infinity; noProgress = 0; continue; }
                if (distance < best - .03) { best = distance; noProgress = 0; } else noProgress++;
                s.ctl.auto = { fwd: 1, run: true, heading: Math.atan2(-dx, -dz) }; step();
                const p = { ...s.position }, delta = Math.hypot(p.x - previous.x, p.z - previous.z), rise = Math.abs(p.y - previous.y);
                walked += delta; maxStep = Math.max(maxStep, delta); maxRise = Math.max(maxRise, rise); stuck = delta < .005 ? stuck + 1 : 0;
                if (frames % 20 === 0) { samples.push({ frames, waypoint: i, ...p }); await saveWalkProgress({ spot: s.spot.id, frames, waypoint: i, distance, walked, position: p }); }
                previous = p; if (stuck > 100 || noProgress > 100 || delta > .8 || rise > .8) break;
            }
            s.ctl.auto = null; s.input.flush(); step(4);
            return { reached: i === points.length, waypointsReached: i, waypoints: points.length, frames, walked, maxStep, maxRise, stuck, noProgress, samples, position: { ...s.position } };
        }, { points, tolerance });
        const selected = id => !process.env.ONLY_SPOTS || process.env.ONLY_SPOTS.split(',').includes(id);

        if (selected('bel-meydenbauer')) {
            await enter('bel-meydenbauer');
            const rec = { id: 'bel-meydenbauer', setup: 'Actual destination arrival; planned public approach then the complete source pier centreline. No setup pose write.' }; result.cases.push(rec); save();
            rec.plan = await page.evaluate(async () => {
                const s = game.spot, arc = [...s.spot.data.ways.find(w => w.id === 'w688415225').pts].reverse(), [x, z] = arc[0];
                const path = s._navPath(s.position.x, s.position.z, x, z, { radius: .5, maxLength: 250 });
                const tip = s.spot.interactables.find(i => i.label === 'Walk to the end of the crescent pier');
                return { approach: path, arc, terminal: { x: tip.x, z: tip.z, r: tip.r, y: tip.y }, sourceWay: 'w688415225', sourceDeck: 'w687934817', arrival: { ...s.position }, award: game.achievements.isUnlocked('lm-meyd-pier') };
            });
            assert.ok(rec.plan.approach && !rec.plan.award, JSON.stringify(rec.plan));
            rec.approach = await walk(rec.plan.approach); assert.ok(rec.approach.reached, JSON.stringify(rec.approach));
            assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-meyd-pier')));
            rec.pier = await walk(rec.plan.arc); rec.frame = await frame('meydenbauer-terminal');
            rec.award = await page.evaluate(() => game.achievements.isUnlocked('lm-meyd-pier'));
            assert.ok(rec.pier.reached && rec.award, JSON.stringify(rec));
            assert.ok(Math.hypot(rec.pier.position.x - rec.plan.terminal.x, rec.pier.position.z - rec.plan.terminal.z) < rec.plan.terminal.r); save();
        }
        if (selected('bel-botanical-garden')) {
            await enter('bel-botanical-garden');
            const rec = { id: 'bel-botanical-garden', setup: 'Initial pose at the actual modelled bridge endpoint to isolate continuous crossing; public arrival is a separate route gate.' }; result.cases.push(rec); save();
            rec.bridge = await page.evaluate(() => {
                const s = game.spot, b = s.spot.ctx.extras.botanicalBridge; s.ctl.enter(b.A.x, b.A.z, 0); s.input.flush(); step();
                return { A: b.A, B: b.B, span: Math.hypot(b.B.x - b.A.x, b.B.z - b.A.z), initial: { ...s.position }, started: b.debug() };
            });
            save();
            assert.ok(!await page.evaluate(() => game.achievements.isUnlocked('lm-bbg-bridge')));
            rec.pauseCancel = await page.evaluate(() => {
                const s = game.spot, b = s.spot.ctx.extras.botanicalBridge, before = b.debug(); game.togglePause(true);
                const after = b.debug(); game.togglePause(false); s.input.flush(); step(); return { before, after };
            });
            assert.ok(rec.pauseCancel.before && !rec.pauseCancel.after, JSON.stringify(rec.pauseCancel));
            rec.walk = await walk([[rec.bridge.B.x, rec.bridge.B.z]]); rec.frame = await frame('botanical-bridge-crossed');
            rec.award = await page.evaluate(() => game.achievements.isUnlocked('lm-bbg-bridge'));
            assert.ok(rec.walk.reached && rec.walk.walked >= rec.bridge.span - 6 && rec.award, JSON.stringify(rec)); save();
        }
        if (selected('palace-parliament')) {
            await enter('palace-parliament');
            const rec = { id: 'palace-parliament', setup: 'Initial pose at the declared north public-course waypoint; continuous controller walking after setup.' }; result.cases.push(rec); save();
            rec.course = await page.evaluate(() => {
                const s = game.spot, p = s.spot.ctx.extras.palacePace; s.ctl.enter(p.start.x, p.start.z, Math.PI); s.input.flush(); step();
                return { start: p.start, end: p.end, source: p.source, metres: Math.hypot(p.end.x - p.start.x, p.end.z - p.start.z) };
            });
            await page.keyboard.press('e'); await page.evaluate(() => step());
            assert.ok(await page.evaluate(() => game.spot.spot.ctx.extras.palacePace.debug()));
            rec.modeCancels = [];
            for (const mode of ['conditions', 'pause', 'map']) {
                const state = await page.evaluate(mode => {
                    const s = game.spot, p = s.spot.ctx.extras.palacePace, before = p.debug();
                    if (mode === 'conditions') { game.buildConditions(); game.toggleConditions(true); }
                    if (mode === 'pause') game.togglePause(true);
                    if (mode === 'map') s.openMap();
                    return { before, after: p.debug(), award: game.achievements.isUnlocked('lm-palace-pace') };
                }, mode);
                assert.ok(state.before && !state.after && !state.award, JSON.stringify({ mode, state })); rec.modeCancels.push({ mode, ...state }); save();
                await page.evaluate(() => { if (game.condOpen) game.toggleConditions(false); game.togglePause(false); game.spot.ui.closePanel(); game.spot.input.flush(); step(); });
                await page.keyboard.press('e'); await page.evaluate(() => step());
            }
            rec.walk = await walk([[rec.course.end.x, rec.course.end.z]], .4);
            rec.counter = await page.evaluate(() => game.spot.spot.ctx.extras.palacePace.debug());
            assert.ok(rec.walk.reached && rec.counter?.walked >= rec.course.metres - 5, JSON.stringify(rec));
            await page.keyboard.press('e'); await page.evaluate(() => step());
            rec.award = await page.evaluate(() => game.achievements.isUnlocked('lm-palace-pace')); rec.frame = await frame('palace-continuous-frontage');
            assert.ok(rec.award); save();
        }
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
        result.persisted = await page.evaluate(() => ['lm-meyd-pier', 'lm-bbg-bridge', 'lm-palace-pace'].map(id => ({ id, unlocked: game.achievements.isUnlocked(id) })));
        assert.deepEqual(result.errors, []); result.passed = true; save(); await context.close();
    } catch (error) { result.failure = { message: error.message, stack: error.stack }; save(); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
