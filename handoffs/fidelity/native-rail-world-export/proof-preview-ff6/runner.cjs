// Preparation deliverable only. Run ONLY after root GO for the exact prepared combined SHA.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const args = {}; for (let i = 2; i < process.argv.length; i++) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true;
if (!args.go || !args.archive || !args.out || !/^[a-f0-9]{40}$/.test(args.source || '')) throw Error('HOLD: requires root GO, --go --source FULLSHA --archive PATH --out PATH');
const root = path.resolve(args.archive), out = path.resolve(args.out), manifest = JSON.parse(fs.readFileSync(path.join(out, 'source-manifest.json'))), prep = JSON.parse(fs.readFileSync(path.join(out, 'preparation.json')));
assert.equal(args.source, manifest.commit); assert.equal(prep.sourceCommit, manifest.commit); if (fs.existsSync(path.join(out, 'report.json'))) throw Error('Refuse to overwrite a completed/incomplete native run');
const hash = data => ({ sha256: crypto.createHash('sha256').update(data).digest('hex'), gitBlobSha1: crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + data.length + '\0'), data])).digest('hex') });
const report = { sourceCommit: manifest.commit, sourceGitTree: manifest.gitTree, districts: manifest.districts, startedUtc: new Date().toISOString(), pid: process.pid, complete: false,
    scope: 'Native selected-district world/constructor geometry extraction; independent observers own physical acceptance. No all8/moving/15load/budget acceptance.', errors: [], consoleErrors: [], httpErrors: [], servedFiles: {}, stages: [], artifacts: [] };
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
    await page.evaluate(require('./install-observer.cjs'), { allActorGeometry: !!args['all-actor-geometry'] });
    await page.selectOption('#quality', 'high');
    await page.evaluate(nativeClock => { const g = game; g.loop = () => {}; if (!nativeClock) g.nowDate = () => new Date('2026-06-21T09:00:00Z'); }, !!args['native-clock']);
    await page.evaluate(() => { window.__railDeferred = {}; });
    for (const district of manifest.districts) {
        const stage = { district, startedUtc: new Date().toISOString(), complete: false }; report.stages.push(stage); persist();
        const lifecycle = await page.evaluate(async ({ district, tod, nativeClock }) => { __railObserver.reset(); const result = await game.startFreeRoam(district, { tod, weather: 'clear', season: 'summer' });
            __railObserver.snapshot('after-native-public-entry-before-first-explicit-world-draw'); if (result) { game.r3d.frame(1 / 60); __railObserver.snapshot('after-first-explicit-native-world-draw'); }
            const text = result ? JSON.stringify(game.world.data) : '', digest = result ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)) : null;
            return { result, district: game.district, state: game.state, nativeTime: game.traffic?.time ?? null, nativeDataCanonicalSha256: digest ? [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('') : null,
                observedNowDate: game.nowDate().toISOString(), clockFrozen: !nativeClock, conditions: { tod, weather: 'clear', season: 'summer' }, quality: game.quality, touch: game.touch }; }, { district, tod: args.tod || 'noon', nativeClock: !!args['native-clock'] });
        stage.lifecycle = lifecycle; persist();
        const sourceDataBeforeHeavy = JSON.parse(fs.readFileSync(path.join(root, 'game/data/bucharest-' + district + '.json')));
        assert.equal(lifecycle.nativeDataCanonicalSha256, hash(Buffer.from(JSON.stringify(sourceDataBeforeHeavy))).sha256, 'native data before-heavy mismatch'); stage.sourceDataCanonicalVerified = true;
        const early = JSON.parse(await page.evaluate(() => JSON.stringify(__railObserver.facts({ includeGeometryCatalog: true }))));
        stage.earlyFacts = save(district + '-constructor-facts', early);
        stage.earlySummary = early.snapshots.map(s => ({ phase: s.phase, activeIds: s.active.map(v => v.id), poolIds: s.pool.map(v => v.id), tramIds: [...s.active, ...s.pool].filter(v => v.tramDetected).map(v => v.id),
            initialTramBinding: s.initialTramBinding, initialAdmission: s.initialAdmission })); persist(); console.log(JSON.stringify({ district, phase: 'early-constructor-facts-stable', earlyFacts: stage.earlyFacts, summary: stage.earlySummary.map(s => ({ phase: s.phase, trams: s.tramIds, binding: s.initialTramBinding, admissionPassed: s.initialAdmission?.passed })) }));
        const last = early.snapshots.at(-1), all = [...last.active, ...last.pool], ids = new Set(all.map(v => v.id));
        stage.preflight = { initialTramBinding: last.initialTramBinding?.passed === true, bindingUnresolved: last.initialTramBinding?.unresolved || [], initialAdmission: last.initialAdmission?.passed === true,
            admissionUnresolved: last.initialAdmission?.unresolved || [], invalidRailModes: last.initialAdmission?.invalidRailModes || [], primaryGeometryUnknownIds: all.filter(v => v.actualPrimaryVerticalInterval?.known !== true).map(v => v.id),
            hiddenActiveIds: last.active.filter(v => v.mesh?.visible === false).map(v => v.id), lostConstructorIds: early.snapshots[0].active.filter(v => !ids.has(v.id)).map(v => v.id), duplicateIds: all.length !== ids.size,
            maxVehicles: last.maxVehicles, pedestrians: last.pedestrians?.length ?? null, nativeTime: last.nativeTime, active: last.active.length, pool: last.pool.length, tramIds: all.filter(v => v.tramDetected).map(v => v.id), observerErrors: early.observerErrors };
        const check = stage.preflight; check.passed = check.initialTramBinding && check.initialAdmission && !check.bindingUnresolved.length && !check.admissionUnresolved.length && !check.invalidRailModes.length && !check.primaryGeometryUnknownIds.length && !check.hiddenActiveIds.length && !check.lostConstructorIds.length && !check.duplicateIds && !check.observerErrors.length && check.maxVehicles === 480 && check.pedestrians === 560 && early.snapshots.every(s => s.nativeTime === 0);
        const widths = await page.evaluate(() => game.world.allEdges.map(e => ({ edgeId: e.id, sourceId: e.access?.sourceId || game.world.data.roadSourceGeometry?.[e.road]?.sourceId || null, sidewalkLeftM: e.sidewalkLeftM, sidewalkRightM: e.sidewalkRightM, sidewalkSource: e.sidewalkSource,
            nativeLeftM: game.world.sidewalkWidth(e, -1), nativeRightM: game.world.sidewalkWidth(e, 1) })));
        stage.sidewalkPolicy = save(district + '-sidewalk-policy', widths); stage.preflightSavedUtc = new Date().toISOString(); persist(); console.log(JSON.stringify({ district, phase: 'PREVIEW-PREFLIGHT', preflight: stage.preflight }));
        if (!lifecycle.result) throw Error('Native load failed; retained partial constructor facts for ' + district);
        if (args['defer-heavy']) {
            await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, district + '-native.png')); stage.capture = district + '-native.png';
            const heavyScene = district !== 'unirii';
            stage.deferredCapture = await page.evaluate(({ district, heavyScene }) => { const began = new Date().toISOString(), world = JSON.stringify(__railObserver.world()), scene = heavyScene ? JSON.stringify(__railObserver.scene()) : null,
                facts = JSON.stringify(__railObserver.facts({ includeGeometryCatalog: !heavyScene })); window.__railDeferred[district] = { world, scene, facts };
                return { beganUtc: began, capturedUtc: new Date().toISOString(), worldCharacters: world.length, sceneCharacters: scene?.length || 0, factsCharacters: facts.length, heavyScene }; }, { district, heavyScene });
            persist(); continue;
        }
        const world = JSON.parse(await page.evaluate(() => JSON.stringify(__railObserver.world())));
        const sourceData = JSON.parse(fs.readFileSync(path.join(root, 'game/data/bucharest-' + district + '.json'))); assert.equal(JSON.stringify(world.data), JSON.stringify(sourceData), 'native world.data mismatch');
        stage.world = save(district + '-world', world);
        let scene = null;
        if (!args['skip-scene']) { scene = JSON.parse(await page.evaluate(() => JSON.stringify(__railObserver.scene()))); stage.scene = save(district + '-scene', scene); }
        const facts = JSON.parse(await page.evaluate(includeGeometryCatalog => JSON.stringify(__railObserver.facts({ includeGeometryCatalog })), !!args['skip-scene'])); stage.facts = save(district + '-facts', facts);
        const geometrySource = scene || { geometries: facts.geometryCatalog }; const inventory = require('./decode-geometry.cjs').integrity(geometrySource); stage.bufferIntegrity = save(district + '-buffer-integrity', inventory);
        stage.snapshots = facts.snapshots.map(s => ({ phase: s.phase, nativeTime: s.nativeTime, active: s.active.length, pool: s.pool.length, pedestrians: s.pedestrians?.length ?? null,
            tramIds: [...s.active, ...s.pool].filter(v => v.tramDetected).map(v => v.id), bindingPassedProducerOnly: s.initialTramBinding?.passed ?? null }));
        stage.observerErrors = facts.observerErrors; stage.meshes = scene ? scene.objects.length : null; stage.wholeSceneOmitted = !!args['skip-scene']; stage.geometries = Object.keys(geometrySource.geometries).length; stage.sourceDataCanonicalVerified = true;
        stage.capture = district + '-native.png'; await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, stage.capture)); stage.complete = true; stage.endedUtc = new Date().toISOString(); persist();
        console.log(JSON.stringify({ district, meshes: stage.meshes, geometries: stage.geometries, snapshots: stage.snapshots, observerErrors: stage.observerErrors }));
    }
    if (args['defer-heavy']) {
        report.previewPreflightPassed = report.stages.every(s => s.preflight?.passed); report.allPreflightFactsSavedUtc = new Date().toISOString(); persist(); console.log(JSON.stringify({ phase: 'ALL-PREVIEW-PREFLIGHT-FACTS-STABLE', passed: report.previewPreflightPassed }));
        for (const stage of report.stages) {
            const district = stage.district, world = JSON.parse(await page.evaluate(id => __railDeferred[id].world, district)); stage.world = save(district + '-world', world);
            const sceneText = await page.evaluate(id => __railDeferred[id].scene, district), scene = sceneText ? JSON.parse(sceneText) : null;
            if (scene) stage.scene = save(district + '-scene', scene);
            const facts = JSON.parse(await page.evaluate(id => __railDeferred[id].facts, district)); stage.facts = save(district + '-facts', facts);
            const geometries = scene?.geometries || facts.geometryCatalog; stage.bufferIntegrity = save(district + '-buffer-integrity', require('./decode-geometry.cjs').integrity({ geometries }));
            stage.observerErrors = facts.observerErrors; stage.meshes = scene?.objects.length ?? null; stage.geometries = Object.keys(geometries).length; stage.wholeSceneOmitted = !scene; stage.complete = true; stage.endedUtc = new Date().toISOString();
            await page.evaluate(id => { delete __railDeferred[id]; }, district); persist();
        }
    }
    await page.evaluate(() => __railObserver.restore());
    for (const [f, expected] of Object.entries(manifest.files)) assert.deepEqual(hash(fs.readFileSync(path.join(root, f))), { sha256: expected.sha256, gitBlobSha1: expected.gitBlobSha1 }, f);
    report.postRunCopiedFilesVerified = Object.keys(manifest.files).length;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.httpErrors, []); assert.ok(report.stages.every(s => !s.observerErrors?.length)); report.complete = true;
})().catch(e => { report.fatal = String(e.stack || e); console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); report.browserClosedUtc = new Date().toISOString(); if (server?.listening) await new Promise(r => server.close(r)); report.endedUtc = new Date().toISOString(); persist(); fs.writeFileSync(path.join(out, 'served-files.json'), JSON.stringify(report.servedFiles, null, 2)); });
