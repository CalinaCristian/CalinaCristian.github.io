// All destination loads, actual-controller public approaches, high-quality
// views and native phone condition selections. Failed paths remain failures.
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = process.env.OUT || '/tmp/tourist-final-sweep'; fs.mkdirSync(out, { recursive: true }); fs.copyFileSync(__filename, `${out}/runner.cjs`);
const targets = [
    ['fremont-troll', 'climb'], ['peoples-salvation-cathedral', 'candle'], ['old-town-lipscani', 'stairs'], ['stavropoleos-cec', 'candle'],
    ['pike-place', 'coin'], ['chihuly', 'photo-hunt'], ['space-needle', 'Ride the elevator to the observation level'], ['mopop', 'photo-hunt'],
    ['kerry-park', 'photo-hunt'], ['waterfront', 'ride'], ['pioneer-square', 'Frame the seven pole figures'], ['ballard-locks', 'lockage'], ['gas-works', 'kite'],
    ['bel-lincoln-square', 'photo-hunt'], ['athenaeum-revolution', 'photo-hunt'], ['arcul-de-triumf', 'photo-hunt'], ['spring-palace', 'photo-hunt'], ['palace-parliament', 'photo-hunt'],
    ['cismigiu', 'Row a boat from Debarcader'], ['herastrau-park', 'rowboat'], ['village-museum', 'Record a virtual passport visit:'],
    ['bel-meydenbauer', 'Walk to the end of the crescent pier'], ['bel-downtown-park', 'coin'], ['bel-botanical-garden', 'Cross the ravine suspension bridge'],
];
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { sourceCommit: cp.execFileSync('git', ['rev-parse', process.env.SOURCE_COMMIT || 'HEAD'], { encoding: 'utf8' }).trim(), setup: 'Each route starts at its actual destination arrival. Production OnFootController.auto provides running/heading input; no pose writes. Phone uses an actual touch-enabled browser context and CDP gestures.', records: [], errors: [] };
    const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, isMobile: true }), page = await context.newPage(), cdp = await context.newCDPSession(page);
        page.setDefaultTimeout(180000); page.on('pageerror', e => { report.errors.push(e.message); save(); });
        await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } })); await page.addInitScript(() => requestAnimationFrame = () => 0);
        await page.goto(`http://127.0.0.1:${process.env.PORT || 8435}/game/?q=high`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
        await page.evaluate(() => { window.step = (n = 1) => { for (let i = 0; i < n; i++) { game.syncModalControls(); game.spot.update(.05); } }; game.setRoamHour(14.25); game.setRoamWeather('clear'); game.setRoamSeason('summer'); });
        const capture = async name => {
            const f = await page.evaluate(() => {
                game.drawFrame(); const p = game.camera.position.clone(), d = p.clone(); game.camera.getWorldPosition(p); game.camera.getWorldDirection(d);
                return { image: document.querySelector('canvas').toDataURL('image/webp', .78), capturedAt: new Date().toISOString(), viewport: { width: innerWidth, height: innerHeight }, simulationDate: game.r3d.simDate?.toISOString(), selectedConditions: game.travelConditions(), quality: 'high', position: { ...game.spot.position }, pose: { position: p.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI }, triangles: game.r3d.stats.triangles, calls: game.r3d.stats.drawCalls };
            });
            fs.writeFileSync(`${out}/${name}.webp`, Buffer.from(f.image.split(',')[1], 'base64')); delete f.image; return { file: `${name}.webp`, ...f };
        };
        const tap = async selector => {
            const q = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (!el.contains(document.elementFromPoint(x, y))) throw Error('Obstructed actual touch target'); return { x, y, width: r.width, height: r.height }; });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return q;
        };
        for (const [id, defaultPreferred] of targets.filter(([id]) => !process.env.ONLY_SPOTS || process.env.ONLY_SPOTS.split(',').includes(id))) {
            const preferred = process.env.PREFERRED || defaultPreferred;
            const record = { id }; report.records.push(record); save();
            try {
                await page.setViewportSize({ width: 1280, height: 720 }); await page.evaluate(() => game.resize());
                record.expectedConditions = await page.evaluate(() => game.travelConditions()); record.expectedAt = Date.now();
                await page.evaluate(id => game.enterSpot(id), id);
                record.initial = await page.evaluate(() => { const s = game.spot, S = s.spot; step(); return { entry: S.entry.id, city: S.city, walker: s.walkerKind, arrival: { ...s.position }, conditions: game.travelConditions(), timeZone: s.r3d.clock.timeZone, sourceGeometry: S.ctx.extras.buildings.sourceGeometry, people: S.crowd.count, buildings: S.data.buildings.length, colliders: S.colliders.length }; });
                assert.equal(record.initial.entry, id); assert.equal(record.initial.walker, 'OnFootController'); assert.equal(record.initial.conditions.weather, 'clear'); assert.equal(record.initial.conditions.season, 'summer');
                if (/^h/.test(record.initial.conditions.tod) && /^h/.test(record.expectedConditions.tod)) {
                    const delta = Math.abs(((+record.initial.conditions.tod.slice(1) - +record.expectedConditions.tod.slice(1) + 12) % 24 + 24) % 24 - 12);
                    assert.ok(delta < .04 + (Date.now() - record.expectedAt) / 3600000, 'Selected local hour drifted beyond real elapsed time');
                } else assert.equal(record.initial.conditions.tod, record.expectedConditions.tod);
                assert.equal(record.initial.timeZone, record.initial.city === 'bucharest' ? 'Europe/Bucharest' : 'America/Los_Angeles');
                record.arrivalView = await capture(`${id}-arrival`); save();
                record.plan = await page.evaluate(preferred => {
                    const s = game.spot, label = it => typeof it.label === 'function' ? it.label(s) : it.label;
                    const matches = it => it.kind === preferred || String(label(it)).startsWith(preferred);
                    const it = s.spot.interactables.find(it => matches(it) && (!it.cond || it.cond(s)) && Math.abs((it.y ?? s.position.y) - s.position.y) < 3);
                    if (!it) return { found: false, error: `No current ground-level ${preferred}` };
                    // The production A* uses a 1.5 m grid. A .25 m goal circle
                    // can exclude every grid centre even at a reachable stair.
                    // Stay within the actual interaction radius for every kind.
                    const radius = Math.min(it.r || 2, 1.2);
                    const path = s._navPath(s.position.x, s.position.z, it.x, it.z, { radius, maxLength: 1400 });
                    return { found: true, label: label(it), kind: it.kind || 'activity', target: { x: it.x, z: it.z, y: it.y, r: it.r }, pathRadius: radius, source: it.source || null, path, arrival: { ...s.position } };
                }, preferred); save();
                if (record.plan.path) {
                    await page.evaluate(path => { window.routeRun = { path, i: 1, frames: 0, walked: 0, previous: { ...game.spot.position }, best: Infinity, noProgress: 0, maxStep: 0, maxRise: 0, trace: [] }; }, record.plan.path);
                    for (let batch = 0; batch < 400; batch++) {
                        record.walk = await page.evaluate(() => {
                            const s = game.spot, r = routeRun;
                            for (let n = 0; n < 20 && r.i < r.path.length && r.noProgress < 100; n++) {
                                const [x, z] = r.path[r.i], dx = x - s.position.x, dz = z - s.position.z, distance = Math.hypot(dx, dz);
                                if (distance < .55) { r.i++; r.best = Infinity; r.noProgress = 0; continue; }
                                if (distance < r.best - .03) { r.best = distance; r.noProgress = 0; } else r.noProgress++;
                                s.ctl.auto = { fwd: 1, run: true, heading: Math.atan2(-dx, -dz) }; step(); r.frames++;
                                const p = { ...s.position }, delta = Math.hypot(p.x - r.previous.x, p.z - r.previous.z); r.walked += delta; r.maxStep = Math.max(r.maxStep, delta); r.maxRise = Math.max(r.maxRise, Math.abs(p.y - r.previous.y)); r.previous = p;
                                if (r.maxStep > .8 || r.maxRise > .8) { r.noProgress = 100; break; }
                            }
                            r.trace.push({ frames: r.frames, i: r.i, position: { ...s.position } });
                            const finished = r.i === r.path.length || r.noProgress >= 100;
                            if (finished) { s.ctl.auto = null; s.input.flush(); step(); }
                            return { finished, reached: r.i === r.path.length, frames: r.frames, walked: r.walked, maxStep: r.maxStep, maxRise: r.maxRise, noProgress: r.noProgress, position: { ...s.position }, trace: r.trace };
                        }); save(); if (record.walk.finished) break;
                    }
                }
                await page.evaluate(() => { game.spot.ctl.auto = null; game.spot.input.flush(); });
                record.approachView = await capture(`${id}-approach`);
                await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { game.resize(); game.buildConditions(); game.toggleConditions(true); });
                record.phoneTargets = [];
                for (const selector of ['#cond-panel [data-wx=rain]', '#cond-panel [data-season=winter]', '#cond-panel [data-tod=golden]']) record.phoneTargets.push(await tap(selector));
                // Record the existing condition-dialog target dimensions.
                // Its native selection contract uses 40 px chips; scene-owned
                // participation actions have a separate 44 px acceptance gate.
                record.phoneTargetsPassed = record.phoneTargets.every(q => q.width >= 40 && q.height >= 40);
                record.phoneConditions = await page.evaluate(() => game.travelConditions());
                assert.equal(record.phoneConditions.weather, 'rain'); assert.equal(record.phoneConditions.season, 'winter'); assert.equal(record.phoneConditions.tod, 'golden');
                await tap('#cond-panel [data-wx=clear]'); await tap('#cond-panel [data-season=summer]'); await tap('#cond-panel [data-tod=day]'); await tap('#cond-panel [data-close]'); await page.evaluate(() => step(3));
                record.phoneView = await capture(`${id}-phone`);
                record.final = await page.evaluate(() => ({ people: game.spot.spot.crowd.count, buildings: game.spot.spot.data.buildings.length, colliders: game.spot.spot.colliders.length, conditions: game.travelConditions() }));
                for (const key of ['people', 'buildings', 'colliders']) assert.equal(record.initial[key], record.final[key]);
                record.budgetPassed = [record.arrivalView, record.approachView, record.phoneView].every(f => f.triangles <= 1.5e6 && f.calls <= 400);
                record.cachePassed = record.initial.sourceGeometry.cacheHit;
                record.checked = true;
            } catch (error) { record.failure = { message: error.message, stack: error.stack }; await page.evaluate(() => { if (game.spot) game.spot.ctl.auto = null; game.togglePause(false); if (game.condOpen) game.toggleConditions(false); game.spot?.ui.closePanel(); game.setRoamWeather('clear'); game.setRoamSeason('summer'); game.setRoamTime('day'); }).catch(() => {}); }
            save();
        }
        report.complete = report.records.length === targets.length; report.checked = report.records.filter(r => r.checked).length; report.publicPathsPassed = report.records.filter(r => r.walk?.reached).length;
        report.failures = report.records.filter(r => r.failure || !r.budgetPassed || !r.cachePassed || !r.walk?.reached || !r.phoneTargetsPassed).map(r => ({ id: r.id, failure: r.failure?.message, path: r.walk?.reached ?? false, cache: r.cachePassed, budget: r.budgetPassed, phoneTargets: r.phoneTargetsPassed }));
        save(); await context.close();
    } catch (error) { report.fatal = { message: error.message, stack: error.stack }; save(); throw error; }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
