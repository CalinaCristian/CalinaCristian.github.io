#!/usr/bin/env node
// node game/dev/harness/tram-progress-check.cjs <repo root> <out dir> [city] [district] [seconds]
// Actual generated district world, fixed 1/30 s simulation steps, stationary player, nothing rendered (RAF disabled).
// Every step in which a tram is refused by the rail guard ("rail-source-domain-or-static") is diagnosed at the refused
// pose: which static body the full-body cover met, or that the body left its source rail domain. A tram that is
// refused for more than HOLD_S seconds in a row is held by geometry, not by traffic: that fails the check.
// Simulation facts only: not a visual, ride-comfort or frame-rate acceptance.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || 'game/dev/harness/report/tram-progress');
const city = process.argv[4] || 'bucharest', district = process.argv[5] || 'grozavesti', seconds = +process.argv[6] || 120, HOLD_S = 10;
fs.mkdirSync(out, { recursive: true });
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : bytes); });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(900000);
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        const report = await page.evaluate(async ({ city, district, seconds }) => {
            const g = window.game; g.state = 'loading'; g.started = true;
            const { CHAPTERS } = await import('/game/src/cities.js'), { initialTrafficStaticClearance } = await import('/game/src/initial-traffic-admission.js');
            await g.loadCity(city, { district, start: CHAPTERS.find(c => c.city === city && c.district === district)?.start });
            const T = g.traffic, W = g.world, r = v => Math.round(v * 100) / 100, dt = 1 / 30, steps = Math.round(seconds / dt);
            const trams = new Map(), record = v => { let t = trams.get(v.id); if (!t) trams.set(v.id, t = { id: v.id, start: [r(v.x), r(v.y), r(v.z)], odo: 0, refusedSteps: 0, run: 0, longestRefusedS: 0, firstRefusedS: null, causes: {}, firstByCause: {}, last: null, px: v.x, pz: v.z }); return t; };
            const revert = T.revert.bind(T); let step = 0;
            T.revert = v => {
                if (v.edge?.rail) {
                    const t = record(v), inside = T.railBodyInside(v), c = inside ? initialTrafficStaticClearance(W, v) : null, h = c?.hit;
                    const cause = !inside ? 'outside-source-rail-domain' : c.valid ? 'other-revert' : `${h?.kind || c.reason}|${h?.sourceId ?? ''}`;
                    if (cause !== 'other-revert') {
                        t.refusedNow = true; t.causes[cause] = (t.causes[cause] || 0) + 1; t.firstRefusedS ??= r(step * dt);
                        const first = !t.firstByCause[cause];
                        t.last = { cause, atS: r(step * dt), refusedPose: [r(v.x), r(v.y), r(v.z)], edge: v.edge.id, s: r(v.s), heading: r(v.heading), sample: h?.sample ? [r(h.sample.x), r(h.sample.z), r(h.sample.along), r(h.sample.across), r(h.sample.radius)] : null, colliderBand: h?.colliderBand ? [r(h.colliderBand.min), r(h.colliderBand.max)] : null, body: h?.interval ? [r(h.interval.min), r(h.interval.max)] : null, railDeck: h?.exactRailDeck ? { valid: h.exactRailDeck.valid, reason: h.exactRailDeck.reason, requiredLiftM: h.exactRailDeck.requiredLiftM } : null };
                        if (first) t.firstByCause[cause] = t.last;
                    }
                }
                return revert(v);
            };
            g.drawFrame = () => {}; // updateDrive ends in a full render: the simulation alone is stepped here
            g.state = 'drive'; const began = performance.now();
            for (step = 0; step < steps; step++) {
                g.updateDrive(dt);
                for (const v of T.vehicles) if (v.edge?.rail && !v.parked && !v.inactive) {
                    const t = record(v), d = Math.hypot(v.x - t.px, v.z - t.pz); if (d < 5) t.odo += d; t.px = v.x; t.pz = v.z;
                    if (t.refusedNow) { t.refusedSteps++; t.run++; t.longestRefusedS = Math.max(t.longestRefusedS, t.run * dt); } else t.run = 0;
                    t.refusedNow = false;
                }
            }
            T.revert = revert;
            const list = [...trams.values()].map(({ px, pz, run, refusedNow, ...t }) => ({ ...t, odo: r(t.odo), longestRefusedS: r(t.longestRefusedS), heldAtEnd: run * dt > 1 }));
            return { city, district, seconds, steps, wallMsPerStep: r((performance.now() - began) / steps), vehicles: T.vehicles.length, railSourceBlocked: T.stats.railSourceBlocked || 0, trams: list };
        }, { city, district, seconds });
        fs.writeFileSync(path.join(out, `${city}-${district}.json`), JSON.stringify({ root, method: 'Built district world, fixed 1/30 s steps, stationary player, RAF disabled; no visual or frame-rate claim.', holdLimitS: HOLD_S, ...report, errors }, null, 2));
        for (const t of report.trams) console.log(`     tram ${t.id}: ${t.odo} m travelled, refused ${t.refusedSteps}/${report.steps} steps, longest ${t.longestRefusedS} s${t.last ? `, last cause ${t.last.cause} at refused pose (${t.last.refusedPose.join(', ')})` : ''}`);
        assert.deepEqual(errors, []);
        const held = report.trams.filter(t => t.longestRefusedS > HOLD_S);
        assert.equal(held.length, 0, `${held.length} of ${report.trams.length} trams held by static geometry for more than ${HOLD_S} s: ` + held.map(t => `${t.id} (${t.last.cause})`).join(', '));
        console.log(`PASS ${city}/${district}: ${report.trams.length} trams, none held by static geometry for more than ${HOLD_S} s in ${seconds} simulated seconds.`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(String(error.message || error).slice(0, 1500)); process.exitCode = 1; });
