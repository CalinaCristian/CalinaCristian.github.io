// Native passive scenery-deck proof. One browser, immutable served source, no source edits.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const arg = k => process.argv.find(s => s.startsWith('--' + k + '='))?.slice(k.length + 3);
const root = path.resolve(arg('root')), out = path.resolve(arg('out')), commit = arg('commit');
const districts = (arg('districts') || 'bucharest-unirii,bucharest-otopeni,bucharest-floreasca,bucharest-grozavesti,bucharest-romana,bucharest-pipera,seattle-bellevue,seattle-seatac').split(',');
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Provide complete immutable source commit');
fs.mkdirSync(out, { recursive: true });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, object) => fs.writeFileSync(path.join(out, name), JSON.stringify(object, null, 2) + '\n');
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
(async () => {
    const server = http.createServer((req, res) => {
        let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
        const file = path.resolve(root, '.' + rel); if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : bytes); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const base = 'http://127.0.0.1:' + server.address().port + '/', summaries = [];
    try {
        for (const district of districts) {
            const page = await browser.newPage({ viewport: { width: 960, height: 640 } }), errors = [], consoleErrors = [];
            page.setDefaultTimeout(300000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
            await page.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
            await page.goto(base + 'game/index.html?notrack&weather=clear&season=summer', { waitUntil: 'domcontentloaded', timeout: 180000 });
            await page.waitForFunction(() => window.game, null, { timeout: 180000 });
            await page.addScriptTag({ url: base + 'game/dev/harness/visual/page/visual.js', type: 'module' });
            await page.waitForFunction(() => window.vqa, null, { timeout: 180000 });
            const loaded = await page.evaluate(d => vqa.loadGroup(d, { quality: 'high', pr: 1, traffic: false, time: 'day', weather: 'clear' }), district);
            console.log('loaded', district, loaded.ms, 'ms');
            const proof = await page.evaluate(async () => {
                const w = game.world, data = w.data, { collideBuildings, buildingBlocksRoad } = await import('./src/world.js');
                const { Drone } = await import('./src/drone.js'), THREE = await import('./vendor/three.module.min.js');
                const { colliderDist } = await import('./dev/harness/page/util.js');
                const decks = w.buildings.filter(c => c.roadDeck), cases = [], errors = [];
                let checks = 0;
                for (const [index, deck] of decks.entries()) {
                    const p = deck.poly.reduce((p, q) => [p[0] + q[0] / 4, p[1] + q[1] / 4], [0, 0]), bottom = deck.minHeightAt(...p), top = deck.roofHeightAt(...p);
                    const result = { index, sourceId: deck.sourceId, x: p[0], z: p[1], bottom, top, elevationSource: deck.elevationSource, checks: [] };
                    for (const [type, y, expected] of [['under', bottom - 2.1, false], ['through', bottom + .1, true], ['above', top + .2, false], ['standing-on-top', top, false]]) {
                        const actual = !!collideBuildings([deck], ...p, .2, y, 2), qa = Number.isFinite(colliderDist(deck, ...p, y, 2, .2));
                        result.checks.push({ type, y, expected, actual, qa }); checks += 2;
                        if (actual !== expected || qa !== expected) errors.push({ index, sourceId: deck.sourceId, type, expected, actual, qa });
                    }
                    // Actual drone collision method, with only this slab supplied; no travel/deploy claim.
                    for (const [type, y, expected] of [['drone-under', bottom - .8, false], ['drone-through', (bottom + top) / 2, true], ['drone-above', top + .8, false]]) {
                        const body = { pos: new THREE.Vector3(...[p[0], y, p[1]]), vel: new THREE.Vector3(1, 0, 0) };
                        Drone.prototype._collide.call(body, { colliders: [deck] });
                        const actual = Math.hypot(body.pos.x - p[0], body.pos.z - p[1]) > 1e-7;
                        result.checks.push({ type, y, expected, actual }); checks++;
                        if (actual !== expected) errors.push({ index, sourceId: deck.sourceId, type, expected, actual });
                    }
                    const heights = w.surfacesAt(...p), surfaceMatches = heights.some(h => Math.abs(h - top) < 1e-6); checks++;
                    if (!surfaceMatches) errors.push({ index, sourceId: deck.sourceId, type: 'rendered deck top absent from physical surface lookup', top, heights });
                    cases.push(result);
                }
                const actualBuildings = w.buildings.filter(c => c.sourceId && c.poly && !c.roadDeck && !c.passageSolids && c.h > (c.minH || 0) + 3), buildingControls = [];
                for (const c of actualBuildings) {
                    const centroid = c.poly.reduce((p, q) => [p[0] + q[0] / c.poly.length, p[1] + q[1] / c.poly.length], [0, 0]), y = (c.minH || 0) + .1;
                    if (buildingBlocksRoad(c, ...centroid, y) && collideBuildings([c], ...centroid, .2, y, 2)) buildingControls.push({ sourceId: c.sourceId, x: centroid[0], z: centroid[1], y, physical: true, buildingOnlyDiagnostic: true });
                    if (buildingControls.length >= 3) break;
                }
                if (buildingControls.length < 1) errors.push({ type: 'missing actual source-building positive control' });
                const expectedBridgePieces = data.scenery?.filter(row => row[3] & 1).length || 0, stats = w.stats.scenerySource?.bridges;
                if (!stats || stats.bridgePieces !== expectedBridgePieces) errors.push({ type: 'source bridge piece coverage', expectedBridgePieces, actualBridgePieces: stats?.bridgePieces });
                return { expectedBridgePieces, stats, passiveDecks: decks.length, checks, errors, cases, buildingControls, core: w.allEdges.filter(e => !e.virtual).map(e => ({ road: e.road, sourceId: data.roadSourceGeometry?.[e.road]?.sourceId, a: [e.a.x, e.a.z, e.ya], b: [e.b.x, e.b.z, e.yb], wL: e.wL, wR: e.wR, access: e.access })), frameScope: 'Native current world; production collideBuildings/shared QA/actual Drone._collide method on isolated passive slabs, not claimed flight or navigation travel' };
            });
            const coreSha256 = hash(Buffer.from(JSON.stringify(proof.core))); delete proof.core;
            const record = { gameSourceCommit: commit, district, capturedAt: new Date().toISOString(), coreSha256, dataSha256: hash(fs.readFileSync(path.join(root, 'game/data/' + district + '.json'))), loaded, ...proof, pageErrors: errors, consoleErrors };
            write(district + '.json', record); summaries.push({ district, bridges: proof.expectedBridgePieces, passiveDecks: proof.passiveDecks, checks: proof.checks, errors: proof.errors.length + errors.length + consoleErrors.length, unresolvedEstimatedClearanceTargets: proof.stats?.unresolved.length, coreSha256 });
            console.log(JSON.stringify(summaries.at(-1)));
            await page.close();
        }
        write('summary.json', { gameSourceCommit: commit, scope: 'Native passive bridge collision/source retention; unresolved modelling targets are retained explicitly and do not establish all-scene clearance parity', districts: summaries });
        if (summaries.some(row => row.errors)) process.exitCode = 1;
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
