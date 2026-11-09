// Actual current MENU tours: native SpotSession.startTour, no pathfinder mocks.
// Scope is bounded route availability/skip controls, not full tour completion.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), sourceCommit = process.argv[4];
assert.match(sourceCommit || '', /^[a-f0-9]{40}$/); assert.ok(!fs.existsSync(out), 'Preserve prior evidence; use a new OUT'); fs.mkdirSync(out, { recursive: true }); fs.copyFileSync(__filename, path.join(out, 'runner.cjs'));
const report = { sourceCommit, toolCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), root, pid: process.pid, startedAt: new Date().toISOString(), runnerSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), method: 'Actual high-quality scene population, summer/day/clear destination arrivals; SpotSession.startTour() directly, without replacing objectives/pathfinding/guide/physics. Route and chosen stops only; no full activity run. Failed initial starts receive one bounded retry after3 actual native seconds. Actual skipTourStop/endTour exercise the no-award contract.', records: [], errors: [], consoleErrors: [] };
const save = () => { fs.writeFileSync(path.join(out, 'results.next.json'), JSON.stringify(report, null, 2)); fs.renameSync(path.join(out, 'results.next.json'), path.join(out, 'results.json')); };
let browser, stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; report.interrupted = { signal, at: new Date().toISOString(), reason: 'Yield browser lane to the final physical soak' }; save(); browser?.close().catch(() => {}); });
const server = http.createServer((req, res) => {
    let uri = decodeURIComponent(req.url.split('?')[0]); if (uri.endsWith('/')) uri += 'index.html'; const file = path.join(root, uri);
    fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : bytes); });
});
(async () => {
    save(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(90000);
    require(path.resolve(__dirname, '../../../game/dev/harness/integration-browser-bounds.cjs')).boundEvaluations(page, 90000);
    page.on('pageerror', error => { report.errors.push(error.message); save(); }); page.on('console', msg => { if (msg.type() === 'error') { report.consoleErrors.push(msg.text()); save(); } });
    await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } })); await page.addInitScript(() => requestAnimationFrame = () => 0);
    await page.goto(`http://127.0.0.1:${server.address().port}/game/?q=high`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.game?.achievements);
    report.available = await page.evaluate(async () => { game.setRoamTime('day'); game.setRoamSeason('summer'); game.setRoamWeather('clear'); window.tourAuditEvents = []; addEventListener('dmcv:activity', event => tourAuditEvents.push({ ...event.detail })); const mod = await game.loadSpotsModule(); return mod.SPOTS.map(s => ({ id: s.id, city: s.city, name: s.name })); });
    assert.equal(report.available.length, 21); report.targets = Object.fromEntries(['bucharest', 'seattle'].map(city => [city, report.available.filter(s => s.city === city).length])); save();
    for (const entry of report.available) {
        if (stopping) break; const row = { ...entry, attempts: [] }; report.records.push(row); save();
        try {
            await page.evaluate(id => game.enterSpot(id), entry.id);
            row.initial = await page.evaluate(() => { const s = game.spot; game.syncModalControls(); s.update(.05); window.auditTourState = () => ({ tourEvents: tourAuditEvents.filter(e => e.id === 'tour'), firstAward: game.achievements.isUnlocked('tour-first'), buc: game.achievements.count('tours-buc'), sea: game.achievements.count('tours-sea'), completedActivities: [...(game.achievements.state.sets.activities || [])].filter(k => k.endsWith(':tour')), tours: { ...(s.progress.tours || {}) } }); return { entry: s.spot.entry.id, conditions: game.travelConditions(), guide: s.guide ? { x: s.guide.x, y: s.guide.y, z: s.guide.z } : null, people: s.spot.crowd.count, buildings: s.spot.data.buildings.length, colliders: s.spot.colliders.length, cache: s.spot.ctx.extras.buildings.sourceGeometry.cacheHit, before: auditTourState() }; });
            assert.equal(row.initial.entry, entry.id); assert.deepEqual(row.initial.conditions, { tod: 'day', weather: 'clear', season: 'summer' });
            for (let attempt = 0; attempt < 2; attempt++) {
                const result = await page.evaluate(attempt => {
                    const s = game.spot; if (attempt) for (let n = 0; n < 60; n++) { game.syncModalControls(); s.update(.05); }
                    const guide = s.guide ? { x: s.guide.x, y: s.guide.y, z: s.guide.z } : null, t0 = performance.now(), started = s.startTour(), T = s.tour;
                    const label = it => typeof it?.label === 'function' ? it.label(s) : it?.label;
                    const stops = T?.stops.map(m => ({ id: m.id || null, kind: m.kind, label: m.label, x: m.x, z: m.z, tx: m.tx, tz: m.tz, radius: m.radius, path: m.path, interaction: m.interaction ? { kind: m.interaction.kind || null, label: label(m.interaction), x: m.interaction.x, z: m.interaction.z, y: m.interaction.y, r: m.interaction.r, currentlyAvailable: !m.interaction.cond || !!m.interaction.cond(s), tourAvailable: !m.interaction.tourAvailable || !!m.interaction.tourAvailable(s) } : null, postcardCurrentlyAvailable: m.challenge?.cond ? !!m.challenge.cond(s) : null })) || [];
                    const length = points => points?.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0) || 0;
                    return { attempt: attempt + 1, nativeSecondsAdvanced: attempt ? 3 : .05, returned: started === undefined ? 'undefined' : started, started: started === true && !!T, elapsedMs: performance.now() - t0, guideBefore: guide, guideAfter: s.guide ? { x: s.guide.x, y: s.guide.y, z: s.guide.z } : null, stops, walked: T?.walked ?? null, recomputedWalked: stops.reduce((sum, stop) => sum + length(stop.path), 0), activityFirst: !!stops.length && ['activity', 'bike'].includes(stops[0].kind), chosenActivity: stops.find(stop => ['activity', 'bike'].includes(stop.kind)) || null, state: T?.state || null, afterStart: auditTourState() };
                }, attempt); row.attempts.push(result); save(); if (result.started) break;
            }
            const chosen = row.attempts.at(-1); row.started = chosen.started;
            if (row.started) {
                assert.ok(chosen.stops.length > 0 && chosen.stops.length <= 3); assert.ok(chosen.walked <= 180 + 1e-7); assert.ok(Math.abs(chosen.walked - chosen.recomputedWalked) < 1e-6);
                assert.deepEqual(chosen.guideBefore, chosen.guideAfter, 'startTour moved the guide'); assert.deepEqual(chosen.afterStart, row.initial.before, 'Tour start awarded completion');
            }
            row.skip = await page.evaluate(() => {
                const s = game.spot; let skipped = 0;
                while (s.tour && s.tour.state !== 'done' && skipped < 4) { s.skipTourStop(); skipped++; }
                const state = s.tour ? { state: s.tour.state, skipped: s.tour.skipped, stopIndex: s.tour.i } : null, after = auditTourState(); s.endTour();
                return { skipped, state, after, ended: s.tour === null, people: s.spot.crowd.count, buildings: s.spot.data.buildings.length, colliders: s.spot.colliders.length };
            });
            assert.deepEqual(row.skip.after, row.initial.before, 'Skipping a tour awarded completion'); assert.ok(row.skip.ended);
            for (const key of ['people', 'buildings', 'colliders']) assert.equal(row.skip[key], row.initial[key]);
            row.noSkippedAward = true; row.checked = true;
        } catch (error) { row.failure = { message: error.message, stack: error.stack }; if (stopping) row.interrupted = true; }
        save(); console.log(JSON.stringify({ id: row.id, started: row.started, stops: row.attempts.at(-1)?.stops.map(s => ({ kind: s.kind, label: s.label })), walked: row.attempts.at(-1)?.walked, activityFirst: row.attempts.at(-1)?.activityFirst, noSkippedAward: row.noSkippedAward, failure: row.failure?.message }));
    }
    report.complete = !stopping && report.records.length === report.available.length && report.records.every(r => r.checked);
    report.started = report.records.filter(r => r.started).length; report.unavailable = report.records.filter(r => r.checked && !r.started).map(r => r.id); report.failures = report.records.filter(r => r.failure).map(r => ({ id: r.id, failure: r.failure.message })); report.finishedAt = new Date().toISOString(); save();
})().catch(error => { report.fatal = { message: error.message, stack: error.stack }; save(); process.exitCode = 1; }).finally(async () => { report.complete ??= false; save(); await browser?.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); });
