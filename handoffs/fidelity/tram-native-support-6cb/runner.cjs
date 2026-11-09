const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), manifest = JSON.parse(fs.readFileSync(path.join(root, 'qa-source-manifest.json')));
fs.mkdirSync(out, { recursive: true });
const report = { sourceCommit: manifest.commit, sourceGitTree: manifest.gitTree, startedUtc: new Date().toISOString(), complete: false,
    scope: 'ONE bounded native Groz support/profile export only; no all8/movement/contact/budget acceptance.', errors: [], consoleErrors: [], httpErrors: [], servedFiles: {}, stages: [], captures: [] };
const hash = data => ({ sha256: crypto.createHash('sha256').update(data).digest('hex'), gitBlobSha1: crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + data.length + '\0'), data])).digest('hex') });
const persist = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let server, browser;
(async () => {
    for (const [name, expected] of Object.entries(manifest.files)) { const got = hash(fs.readFileSync(path.join(root, name))); assert.deepEqual(got, { sha256: expected.sha256, gitBlobSha1: expected.gitBlobSha1 }, name); }
    report.copiedFilesVerified = Object.keys(manifest.files).length; report.stages.push({ stage: 'source-verified', utc: new Date().toISOString() }); persist();
    server = http.createServer((req, res) => { let uri = decodeURIComponent(req.url.split('?')[0]); if (uri.endsWith('/')) uri += 'index.html'; const name = uri.replace(/^\//, '');
        fs.readFile(path.join(root, name), (error, data) => { try { if (error) throw error; const expected = manifest.files[name], got = hash(data); assert.ok(expected, 'unmanifested served file ' + name); assert.equal(got.sha256, expected.sha256); assert.equal(got.gitBlobSha1, expected.gitBlobSha1);
            const record = report.servedFiles[name] ||= { ...got, bytes: data.length, requests: 0 }; record.requests++; res.writeHead(200, { 'content-type': mime[path.extname(name)] || 'application/octet-stream' }); res.end(data);
        } catch (e) { report.httpErrors.push({ url: req.url, error: String(e) }); persist(); res.writeHead(error ? 404 : 500); res.end('missing or unverified'); } }); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = await require('playwright').chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--mute-audio', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }), page = await context.newPage();
    require('./integration-browser-bounds.cjs').boundEvaluations(page);
    page.on('pageerror', e => report.errors.push(e.message)); page.on('crash', () => report.errors.push('PAGE_CRASH'));
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); for (const a of m.args()) a.dispose().catch(() => {}); });
    await page.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 20, weather_code: 0, is_day: 1, wind_speed_10m: 0, wind_direction_10m: 0, relative_humidity_2m: 50, cloud_cover: 0, precipitation: 0 }, hourly: { time: [] } }) }));
    await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForFunction(() => window.game?.r3d, null, { timeout: 90000 });
    report.lifecycle = await page.evaluate(async () => {
        const g = game; g.loop = () => {}; g.nowDate = () => new Date('2026-06-21T09:00:00Z'); g.r3d.setQuality('high'); g.quality = 'high'; g.opts.quality = 'high';
        const started = performance.now(), result = await g.startFreeRoam('grozavesti', { tod: 'noon', weather: 'clear', season: 'summer' });
        if (!result || g.district !== 'grozavesti') throw Error('Native Groz load failed');
        g.r3d.frame(1 / 60); return { nativeEntry: 'startFreeRoam -> native loadCity -> attachWorldRender -> enterRoam', result, state: g.state, district: g.district, buildAndLoadMs: performance.now() - started,
            frozenNowDate: g.nowDate().toISOString(), clock: { override: g.clock.override, offsetMs: g.clock.offsetMs, timeZone: g.clock.timeZone }, quality: g.quality,
            controlScope: 'Harness freezes the main update loop and nowDate before normal native construction, selects native high/noon/clear/summer. No source patch or world/actor geometry, pose, admission, count or rendering visibility override. No traffic update steps. One explicit native render before read-only export.' };
    });
    report.stages.push({ stage: 'native-Groz-loaded', utc: new Date().toISOString() }); persist(); console.log('Native Groz loaded; beginning read-only support export');
    const raw = JSON.parse(fs.readFileSync(path.join(out, 'raw-bridge-polygon.json')));
    const dump = await page.evaluate(require('./native-support-dump.cjs'), { sourceCommit: manifest.commit, spacingM: .5, rawBridgePolygon: raw,
        sourceWayIds: ['w128304859', 'w660918286', 'w118416425', 'w205971103', 'w314447163', 'w118583391', 'w660918284', 'w660931074'] });
    const expectedData = JSON.parse(fs.readFileSync(path.join(root, 'game/data/bucharest-grozavesti.json')));
    assert.equal(JSON.stringify(dump.data), JSON.stringify(expectedData), 'Native world.data differs from exact archived data');
    fs.writeFileSync(path.join(out, 'native-support.json'), JSON.stringify(dump));
    report.export = { file: 'native-support.json', sha256: hash(fs.readFileSync(path.join(out, 'native-support.json'))).sha256, dataCanonicalSha256: hash(Buffer.from(JSON.stringify(dump.data))).sha256,
        sourceDataGitHashVerified: true, allEdges: dump.allEdges.length, ribbons: dump.ribbons.length, passiveDecks: dump.roadDecks.length, polygonColliders: dump.allPolygonColliders.length,
        sourcePolygonPresence: dump.sourcePolygonPresence, renderedContextTriangles: dump.renderedContext.reduce((n, m) => n + m.vertices.length, 0), railSources: dump.railSamples.map(r => ({ sourceId: r.sourceId, segments: r.segments.length, stationQueries: r.segments.reduce((n, s) => n + s.samples.length * 3, 0) })), recomputedSceneryStatsMatchNative: dump.recomputedSceneryStatsMatchNative };
    report.stages.push({ stage: 'support-exported', utc: new Date().toISOString() }); persist(); console.log(JSON.stringify(report.export));
    for (const view of [{ id: 'podul-grozavesti', sources: ['w128304859', 'w660918286'], cameraOffset: [60, 80, 60] }, { id: 'basarab', sources: ['w118416425', 'w205971103'], cameraOffset: [-250, 300, 220] }]) {
        const pose = await page.evaluate(view => { const g = game, d = g.world.data, pts = view.sources.flatMap(id => { let x = 0, z = 0; const p = []; for (let i = 0, a = d.tramSourceWays.find(w => w.sourceId === id).points; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; p.push([x / d.q, z / d.q]); } return p; });
            const x = (Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2, z = (Math.min(...pts.map(p => p[1])) + Math.max(...pts.map(p => p[1]))) / 2;
            g.scene.add(g.camera); g.camera.position.set(x + view.cameraOffset[0], view.cameraOffset[1], z + view.cameraOffset[2]); g.camera.lookAt(x, 8, z); g.camera.updateMatrixWorld(true); g.r3d.frame(1 / 60);
            return { sourceIds: view.sources, cameraPosition: g.camera.position.toArray(), cameraQuaternion: g.camera.quaternion.toArray(), lookAt: [x, 8, z], scope: 'Survey camera only after export; no actor/geometry/material/visibility changes. Actual native high scene.' };
        }, view);
        const file = view.id + '.png'; await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, file)); report.captures.push({ file, ...pose }); persist();
    }
    for (const [name, expected] of Object.entries(manifest.files)) { const got = hash(fs.readFileSync(path.join(root, name))); assert.equal(got.sha256, expected.sha256); assert.equal(got.gitBlobSha1, expected.gitBlobSha1); }
    report.postRunCopiedFilesVerified = Object.keys(manifest.files).length;
    assert.ok(report.export.recomputedSceneryStatsMatchNative); assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.httpErrors, []);
    report.complete = true;
})().catch(e => { report.fatal = String(e.stack || e); console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); report.browserClosedUtc = new Date().toISOString(); if (server?.listening) await new Promise(r => server.close(r)); report.endedUtc = new Date().toISOString(); persist(); fs.writeFileSync(path.join(out, 'served-files.json'), JSON.stringify(report.servedFiles, null, 2)); });
