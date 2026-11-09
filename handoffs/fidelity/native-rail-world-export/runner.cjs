// Preparation deliverable only. Run ONLY after root GO for the exact prepared combined SHA.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const args = {}; for (let i = 2; i < process.argv.length; i++) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
if (!args.go || !args.archive || !args.out || !/^[a-f0-9]{40}$/.test(args.source || '')) throw Error('HOLD: requires root GO, --go --source FULLSHA --archive PATH --out PATH');
const root = path.resolve(args.archive), out = path.resolve(args.out), manifest = JSON.parse(fs.readFileSync(path.join(root, 'qa-source-manifest.json'))), prep = JSON.parse(fs.readFileSync(path.join(out, 'preparation.json')));
assert.equal(args.source, manifest.commit); assert.equal(prep.sourceCommit, manifest.commit); if (fs.existsSync(path.join(out, 'report.json'))) throw Error('Refuse to overwrite a completed/incomplete native run');
const hash = data => ({ sha256: crypto.createHash('sha256').update(data).digest('hex'), gitBlobSha1: crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + data.length + '\0'), data])).digest('hex') });
const report = { sourceCommit: manifest.commit, sourceGitTree: manifest.gitTree, districts: manifest.districts, startedUtc: new Date().toISOString(), pid: process.pid, complete: false,
    scope: 'Fresh combined native Groz/Rom rail-world/constructor geometry extraction; independent RO observer owns physical acceptance. No all8/moving/15load/budget acceptance.', errors: [], consoleErrors: [], httpErrors: [], servedFiles: {}, stages: [], artifacts: [] };
const persist = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
function save(name, value) { const bytes = Buffer.from(JSON.stringify(value)), zipped = zlib.gzipSync(bytes, { level: 6 }); fs.writeFileSync(path.join(out, name + '.json.gz'), zipped);
    const row = { file: name + '.json.gz', rawBytes: bytes.length, rawSha256: hash(bytes).sha256, gzipBytes: zipped.length, gzipSha256: hash(zipped).sha256 }; report.artifacts.push(row); persist(); return row; }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let server, browser;
(async () => {
    for (const [f, expected] of Object.entries(manifest.files)) assert.deepEqual(hash(fs.readFileSync(path.join(root, f))), { sha256: expected.sha256, gitBlobSha1: expected.gitBlobSha1 }, f);
    for (const [f, expected] of Object.entries(prep.toolHashes)) assert.equal(hash(fs.readFileSync(path.join(out, f))).sha256, expected, f);
    report.copiedFilesVerified = Object.keys(manifest.files).length; persist();
    server = http.createServer((req, res) => { let uri = decodeURIComponent(req.url.split('?')[0]); if (uri.endsWith('/')) uri += 'index.html'; const name = uri.replace(/^\//, '');
        fs.readFile(path.join(root, name), (error, data) => { try { if (error) throw error; const expected = manifest.files[name], got = hash(data); assert.ok(expected, 'unmanifested served file ' + name); assert.equal(got.sha256, expected.sha256); assert.equal(got.gitBlobSha1, expected.gitBlobSha1);
            const record = report.servedFiles[name] ||= { ...got, bytes: data.length, requests: 0 }; record.requests++; res.writeHead(200, { 'content-type': mime[path.extname(name)] || 'application/octet-stream' }); res.end(data);
        } catch (e) { report.httpErrors.push({ url: req.url, error: String(e) }); persist(); res.writeHead(error ? 404 : 500); res.end('missing or unverified'); } }); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = await require('playwright').chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--mute-audio', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }), page = await context.newPage(); require('./integration-browser-bounds.cjs').boundEvaluations(page);
    page.on('pageerror', e => report.errors.push(e.message)); page.on('crash', () => report.errors.push('PAGE_CRASH')); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); for (const a of m.args()) a.dispose().catch(() => {}); });
    await page.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 20, weather_code: 0, is_day: 1, wind_speed_10m: 0, wind_direction_10m: 0, relative_humidity_2m: 50, cloud_cover: 0, precipitation: 0 }, hourly: { time: [] } }) }));
    await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForFunction(() => window.game?.r3d, null, { timeout: 90000 });
    await page.addScriptTag({ content: 'window.__railKernelFactory = (' + require('./geometry-kernel.cjs').toString() + ');' });
    await page.evaluate(require('./install-observer.cjs'));
    await page.evaluate(() => { const g = game; g.loop = () => {}; g.nowDate = () => new Date('2026-06-21T09:00:00Z'); g.r3d.setQuality('high'); g.quality = 'high'; g.opts.quality = 'high'; });
    for (const district of manifest.districts) {
        const stage = { district, startedUtc: new Date().toISOString(), complete: false }; report.stages.push(stage); persist();
        const lifecycle = await page.evaluate(async district => { __railObserver.reset(); const result = await game.startFreeRoam(district, { tod: 'noon', weather: 'clear', season: 'summer' });
            __railObserver.snapshot('after-native-public-entry-before-first-explicit-world-draw'); if (result) { game.r3d.frame(1 / 60); __railObserver.snapshot('after-first-explicit-native-world-draw'); }
            return { result, district: game.district, state: game.state, nativeTime: game.traffic?.time ?? null, frozenNowDate: game.nowDate().toISOString(), quality: game.quality, touch: game.touch }; }, district);
        stage.lifecycle = lifecycle; persist();
        if (!lifecycle.result) { save(district + '-partial-facts', await page.evaluate(() => __railObserver.facts())); throw Error('Native load failed; retained partial constructor facts for ' + district); }
        const world = await page.evaluate(() => __railObserver.world());
        const sourceData = JSON.parse(fs.readFileSync(path.join(root, 'game/data/bucharest-' + district + '.json'))); assert.equal(JSON.stringify(world.data), JSON.stringify(sourceData), 'native world.data mismatch');
        stage.world = save(district + '-world', world);
        const scene = await page.evaluate(() => __railObserver.scene()); stage.scene = save(district + '-scene', scene);
        const facts = await page.evaluate(() => __railObserver.facts()); delete facts.geometryCatalog; stage.facts = save(district + '-facts', facts);
        const inventory = require('./decode-geometry.cjs').integrity(scene); stage.bufferIntegrity = save(district + '-buffer-integrity', inventory);
        stage.snapshots = facts.snapshots.map(s => ({ phase: s.phase, nativeTime: s.nativeTime, active: s.active.length, pool: s.pool.length, pedestrians: s.pedestrians?.length ?? null,
            tramIds: [...s.active, ...s.pool].filter(v => v.tramDetected).map(v => v.id), bindingPassedProducerOnly: s.initialTramBinding?.passed ?? null }));
        stage.observerErrors = facts.observerErrors; stage.meshes = scene.objects.length; stage.geometries = Object.keys(scene.geometries).length; stage.sourceDataCanonicalVerified = true;
        stage.capture = district + '-native.png'; await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, stage.capture)); stage.complete = true; stage.endedUtc = new Date().toISOString(); persist();
        console.log(JSON.stringify({ district, meshes: stage.meshes, geometries: stage.geometries, snapshots: stage.snapshots, observerErrors: stage.observerErrors }));
    }
    await page.evaluate(() => __railObserver.restore());
    for (const [f, expected] of Object.entries(manifest.files)) assert.deepEqual(hash(fs.readFileSync(path.join(root, f))), { sha256: expected.sha256, gitBlobSha1: expected.gitBlobSha1 }, f);
    report.postRunCopiedFilesVerified = Object.keys(manifest.files).length;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.httpErrors, []); assert.ok(report.stages.every(s => !s.observerErrors?.length)); report.complete = true;
})().catch(e => { report.fatal = String(e.stack || e); console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); report.browserClosedUtc = new Date().toISOString(); if (server?.listening) await new Promise(r => server.close(r)); report.endedUtc = new Date().toISOString(); persist(); fs.writeFileSync(path.join(out, 'served-files.json'), JSON.stringify(report.servedFiles, null, 2)); });
