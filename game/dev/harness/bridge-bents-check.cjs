#!/usr/bin/env node
// node game/dev/harness/bridge-bents-check.cjs <repo root> <out dir> [city] [district]
// Actual generated district world: every bridge column stands on free ground, every crosshead clears what passes
// below it, and the slot between the parallel slabs of one structure is closed. Constructor facts from the built
// world (RAF disabled, nothing rendered): not a visual, driving or performance acceptance.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || 'game/dev/harness/report/bridge-bents');
const city = process.argv[4] || 'bucharest', district = process.argv[5] || 'grozavesti';
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
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        const report = await page.evaluate(async ({ city, district }) => {
            const g = window.game; g.state = 'loading'; g.started = true;
            const { CHAPTERS } = await import('/game/src/cities.js'), { BENT_MODEL } = await import('/game/src/bridge-bents.js');
            await g.loadCity(city, { district, start: CHAPTERS.find(c => c.city === city && c.district === district)?.start });
            const W = g.world, M = BENT_MODEL, bents = W.bridgeBents, failures = [];
            const lowerAt = (x, z, below) => W.surfacesAt(x, z).filter(h => h < below);
            let columns = 0, minClearance = Infinity, maxSpan = 0;
            for (const [i, b] of bents.entries()) {
                const at = o => { const d = o - (b.lo + b.hi) / 2; return [b.x + b.nx * d, b.z + b.nz * d]; };
                if (b.kind === 'crosshead') {
                    if (!b.columns.length) failures.push({ i, type: 'crosshead-without-column' });
                    if (b.soffit < M.minBeamSoffitM - 1e-6) failures.push({ i, type: 'crosshead-too-low', soffit: b.soffit });
                    for (const [k, c] of b.columns.entries()) {
                        columns++;
                        if (W.isWater(c.x, c.z)) failures.push({ i, type: 'column-in-water', x: c.x, z: c.z });
                        const lower = lowerAt(c.x, c.z, b.seat - 1.5); if (lower.length) failures.push({ i, type: 'column-on-lower-surface', x: c.x, z: c.z, lower });
                        if (k) maxSpan = Math.max(maxSpan, c.o - b.columns[k - 1].o);
                    }
                    if (b.columns.length && (b.columns[0].o - b.deckLo > M.maxCantileverM + 1e-6 || b.deckHi - b.columns[b.columns.length - 1].o > M.maxCantileverM + 1e-6)) failures.push({ i, type: 'cantilever' });
                    for (let o = b.lo + .4; o <= b.hi - .4; o += 1) { const [x, z] = at(o); for (const h of lowerAt(x, z, b.seat - 1.5)) { minClearance = Math.min(minClearance, b.soffit - h); if (b.soffit - h < M.roadClearanceM - .3) failures.push({ i, type: 'crosshead-clearance', x, z, clearance: b.soffit - h }); } }
                } else {
                    for (let o = b.lo + .5; o <= b.hi - .5; o += 1) { const [x, z] = at(o); if (W.isWater(x, z) || lowerAt(x, z, b.seat - 1.5).length) failures.push({ i, type: 'wall-on-surface', x, z }); }
                }
                if (!(b.seat >= M.minWallTopM)) failures.push({ i, type: 'seat', seat: b.seat });
            }
            // Pasajul Basarab: nothing stands under a stretch its stays or arch carry; every stay is anchored
            const B = W.basarabStructure, S = B?.superstructure || null, spans = S?.carriedSpans || [];
            const inSpan = (x, z) => spans.find(sp => { const dx = sp.b[0] - sp.a[0], dz = sp.b[1] - sp.a[1], L = Math.hypot(dx, dz) || 1, t = ((x - sp.a[0]) * dx + (z - sp.a[1]) * dz) / L; return t > 12 && t < L - 12 && Math.abs((x - sp.a[0]) * -dz + (z - sp.a[1]) * dx) / L < 12; });
            for (const [i, b] of bents.entries()) { const sp = inSpan(b.x, b.z); if (sp) failures.push({ i, type: 'bent-under-carried-span', span: sp.kind, x: b.x, z: b.z }); }
            const basarab = B?.active ? { platforms: B.sourcePlatforms, centrePieces: B.gapPieces, stays: S.emittedStays, plannedStays: S.stays, anchorUnresolved: S.anchorUnresolved.length, unresolved: B.unresolved.length, pylonHeightM: S.pylonHeightM, archSpanM: S.archSpanM, roofLengthM: S.roofLengthM, physicalMembers: S.physicalMembers, carriedSpans: spans.map(sp => sp.kind), treeConflicts: { excludedMeasured: B.treeSourceConflicts?.excludedMeasured.length, retainedMapped: B.treeSourceConflicts?.retainedMapped.length } } : null;
            const piers = W.stats.piers, expectedPiers = bents.reduce((n, b) => n + (b.kind === 'wall' ? 1 : b.vee ? 3 : b.columns.length), 0), vees = bents.filter(b => b.vee);
            // a V pier: two legs from one footing, each leg clear of what passes under it and inside the crosshead
            for (const [i, b] of bents.entries()) if (b.vee) { for (const top of b.vee.tops) { const reach = Math.hypot(top[0] - b.vee.foot[0], top[2] - b.vee.foot[2]); if (!(reach >= 1.2 && reach <= b.width / 2) || Math.abs(top[1] - b.soffit - .15) > 1e-6) failures.push({ i, type: 'vee-leg-geometry', reach }); for (const t of [.25, .5, .75, 1]) { const x = b.vee.foot[0] + (top[0] - b.vee.foot[0]) * t, y = b.vee.foot[1] + (top[1] - b.vee.foot[1]) * t, z = b.vee.foot[2] + (top[2] - b.vee.foot[2]) * t; for (const h of lowerAt(x, z, y - .2)) if (y - .7 - h < M.roadClearanceM - .05 && Math.hypot(x - b.vee.foot[0], z - b.vee.foot[2]) > 1.3) failures.push({ i, type: 'vee-leg-clearance', x, z, y, lower: h }); } } }
            return { city, district, model: M.basis, veePiers: vees.length, basarab, planner: W.stats.bridgeBents, guardCompletion: W.stats.bridgeGuardCompletion, tramRailings: W.stats.tramRailings, trees: W.stats.treeDeckClearance, bents: bents.length, columns, piers, expectedPiers,
                maxColumnSpanM: maxSpan, minCrossheadClearanceM: Number.isFinite(minClearance) ? minClearance : null, failures };
        }, { city, district });
        fs.writeFileSync(path.join(out, `${city}-${district}.json`), JSON.stringify({ root, method: 'Built district world facts; RAF disabled; no visual, journey or performance claim.', ...report, errors }, null, 2));
        assert.deepEqual(errors, []); assert.deepEqual(report.failures, []);
        assert.equal(report.piers, report.expectedPiers); assert.ok(report.maxColumnSpanM <= 26 + 1e-6);
        if (district === 'grozavesti') {
            assert.ok(report.bents >= 60, 'bents ' + report.bents); assert.ok(report.planner.slotInfill.quads >= 300);
            assert.ok(report.planner.carriedBySuperstructure >= 30, 'stations left to the stays and the arch');
            assert.ok(report.basarab, 'Basarab superstructure active'); assert.equal(report.basarab.stays, 60); assert.equal(report.basarab.anchorUnresolved, 0); assert.equal(report.basarab.unresolved, 0);
            assert.deepEqual(report.basarab.platforms, ['w620826242', 'w620826243']); assert.deepEqual(report.basarab.carriedSpans, ['cable-stayed', 'river-arch']);
        } else assert.equal(report.basarab, null);
        if (report.basarab) console.log(`     Basarab: ${report.basarab.stays}/${report.basarab.plannedStays} stays anchored, ${report.basarab.centrePieces} centre pieces, ${report.basarab.platforms.length} platforms, ${report.basarab.physicalMembers} physical members, ${report.planner.carriedBySuperstructure} bent stations left to the stays and arch.`);
        console.log(`PASS ${city}/${district}: ${report.bents} bents (${report.veePiers} V piers), ${report.columns} columns, ${report.planner.straddles || 0} straddle frames, slot infill ${report.planner.slotInfill.areaM2} m², trees narrowed ${report.trees.narrowed} / lowered ${report.trees.lowered} / excluded ${report.trees.excluded.length}; min crosshead clearance ${report.minCrossheadClearanceM?.toFixed(2)} m; guards added on ${report.guardCompletion?.addedM ?? 0} m of open elevated edge; tram railings ${report.tramRailings?.lengthM ?? 0} m.`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
