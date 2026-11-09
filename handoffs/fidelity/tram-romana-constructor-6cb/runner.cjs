// ONE historical high/full constructor observation. No source binding, pose repair or drive steps.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), manifest = JSON.parse(fs.readFileSync(path.join(root, 'qa-source-manifest.json')));
const report = { sourceCommit: manifest.commit, sourceGitTree: manifest.gitTree, startedUtc: new Date().toISOString(), complete: false,
    scope: 'Historical6cb/world8cc High/full Romana constructor facts only; not current merged source binding, rail placement/movement or all8 acceptance.', errors: [], consoleErrors: [], httpErrors: [], servedFiles: {}, stages: [] };
fs.mkdirSync(out, { recursive: true });
const hash = data => ({ sha256: crypto.createHash('sha256').update(data).digest('hex'), gitBlobSha1: crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + data.length + '\0'), data])).digest('hex') });
const persist = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let server, browser;
(async () => {
    for (const [name, expected] of Object.entries(manifest.files)) { const got = hash(fs.readFileSync(path.join(root, name))); assert.deepEqual(got, { sha256: expected.sha256, gitBlobSha1: expected.gitBlobSha1 }, name); }
    report.copiedFilesVerified = Object.keys(manifest.files).length; report.stages.push({ stage: 'existing-archive-reverified', utc: new Date().toISOString() }); persist();
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
    const facts = await page.evaluate(async () => {
        const g = game, { Traffic } = await import('./src/traffic.js');
        const snapshots = [], observerErrors = [], scalar = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)));
        const node = n => ({ ...scalar(n), edgeIds: (n.allEdges || n.edges || []).map(e => e.id) });
        const edge = (e, w) => e ? { ...scalar(e), a: node(e.a), b: node(e.b), access: e.access || null, sourceId: w.data.roadSourceGeometry?.[e.road]?.sourceId || null,
            sourceNodeIds: [e.a.sourceId ?? null, e.b.sourceId ?? null], rawRoadInfo: w.data.roadInfo?.slice(e.road * 6, e.road * 6 + 6) || null } : null;
        const actor = (v, w) => {
            const tram = !!v.tram || /tram/i.test(v.kind || ''), mesh = v.mesh, geo = mesh.userData?._model?.geo, p = geo?.attributes?.position;
            let geometry = null;
            if (tram && p) {
                mesh.updateWorldMatrix(true, false); const m = mesh.matrixWorld.elements, localMin = [Infinity, Infinity, Infinity], localMax = [-Infinity, -Infinity, -Infinity], worldMin = [...localMin], worldMax = [...localMax];
                for (let i = 0; i < p.count; i++) { const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [m[0] * a[0] + m[4] * a[1] + m[8] * a[2] + m[12], m[1] * a[0] + m[5] * a[1] + m[9] * a[2] + m[13], m[2] * a[0] + m[6] * a[1] + m[10] * a[2] + m[14]];
                    for (let j = 0; j < 3; j++) { localMin[j] = Math.min(localMin[j], a[j]); localMax[j] = Math.max(localMax[j], a[j]); worldMin[j] = Math.min(worldMin[j], b[j]); worldMax[j] = Math.max(worldMax[j], b[j]); } }
                geometry = { source: 'Actual native mesh.userData._model.geo primary emitted position vertices; not declared height fallback', vertices: p.count, localMin, localMax, worldMin, worldMax, declaredHeight: mesh.userData.height ?? null };
            }
            const links = list => (list || []).map(r => ({ ...scalar(r), edge: edge(r.e || r.edge, w) }));
            return { ...scalar(v), tramDetectedByFlagOrVariant: tram, edge: edge(v.edge, w), route: links(v.route), hist: links(v.hist),
                mesh: { position: mesh.position.toArray(), rotation: mesh.rotation.toArray(), quaternion: mesh.quaternion.toArray(), scale: mesh.scale.toArray(), visible: mesh.visible, matrixWorld: tram ? mesh.matrixWorld.toArray() : null }, geometry };
        };
        const snapshot = (t, phase) => ({ phase, capturedAtPerformanceMs: performance.now(), district: t.world.district.id, time: t.time, maxVehicles: t.maxVehicles,
            profile: t.profile, base: t.base || null, target: t.target || null, counts: t.counts || null, large: t.large, initialAdmission: t.initialAdmission || null,
            optionsContext: { quality: g.quality, touch: g.touch, viewport: [innerWidth, innerHeight], configuredPublicMaxVehicles: 480, configuredPublicMaxPeds: 560 },
            active: t.vehicles.map(v => actor(v, t.world)), pool: t.pool.map(v => actor(v, t.world)),
            pedestrians: t.peds ? t.peds.list.map(p => scalar(p)) : null, pedestrianConstructorNotYetRun: !t.peds });
        const originalSpawnAll = Traffic.prototype.spawnAll, originalAttach = g.attachWorldRender;
        Traffic.prototype.spawnAll = function (...args) { const result = originalSpawnAll.apply(this, args); try { snapshots.push(snapshot(this, 'immediate-after-original-spawnAll-before-initialAdmission-and-Pedestrians')); } catch (e) { observerErrors.push(String(e.stack || e)); } return result; };
        g.attachWorldRender = function (...args) { try { snapshots.push(snapshot(this.traffic, 'before-original-attachWorldRender-after-normal-profile-hot-player-admission')); } catch (e) { observerErrors.push(String(e.stack || e)); } return originalAttach.apply(this, args); };
        g.loop = () => {}; g.nowDate = () => new Date('2026-06-21T09:00:00Z'); g.r3d.setQuality('high'); g.quality = 'high'; g.opts.quality = 'high';
        try {
            const result = await g.startFreeRoam('romana', { tod: 'noon', weather: 'clear', season: 'summer' });
            if (!result || g.district !== 'romana') throw Error('Native Romana load failed');
            snapshots.push(snapshot(g.traffic, 'after-native-public-load-and-enterRoam-before-any-drive-step'));
            const w = g.world; g.r3d.frame(1 / 60);
            return { scope: 'Actual historical6cb pre-sourcebinding constructor and native first-publication facts; zero traffic update steps. Observation wrappers preserve original receivers/arguments/return values; no pose, ID, source, geometry, population, admission or RNG override.',
                fixedNowDate: g.nowDate().toISOString(), clock: { override: g.clock.override, offsetMs: g.clock.offsetMs, timeZone: g.clock.timeZone }, state: g.state, snapshots, observerErrors,
                data: w.data, allEdges: w.allEdges.map(e => edge(e, w)), ribbons: w.ribbons.map((r, i) => ({ i, ...scalar(r), poly: r.poly, holes: r.holes || [], hs: r.hs || null, edge: edge(r.e, w), node: r.node ? node(r.node) : null })),
                roadDecks: w.buildings.filter(c => c.roadDeck).map(c => ({ ...scalar(c), poly: c.poly, holes: c.holes || [], sourceTags: c.sourceTags, elevationSource: c.elevationSource,
                    vertexBands: c.poly.map(([x, z]) => ({ x, z, top: c.roofHeightAt(x, z, 0), bottom: c.minHeightAt(x, z, 0) })) })), nativeStats: w.stats };
        } finally { Traffic.prototype.spawnAll = originalSpawnAll; g.attachWorldRender = originalAttach; }
    });
    const sourceData = JSON.parse(fs.readFileSync(path.join(root, 'game/data/bucharest-romana.json'))); assert.equal(JSON.stringify(facts.data), JSON.stringify(sourceData));
    fs.writeFileSync(path.join(out, 'constructor-facts.json'), JSON.stringify(facts));
    report.export = { file: 'constructor-facts.json', bytes: fs.statSync(path.join(out, 'constructor-facts.json')).size, sha256: hash(fs.readFileSync(path.join(out, 'constructor-facts.json'))).sha256,
        nativeDataCanonicalEqualsArchivedGitData: true, allEdges: facts.allEdges.length, ribbons: facts.ribbons.length, observerErrors: facts.observerErrors,
        snapshots: facts.snapshots.map(s => ({ phase: s.phase, time: s.time, maxVehicles: s.maxVehicles, active: s.active.length, pool: s.pool.length, pedestrians: s.pedestrians?.length ?? null,
            profile: s.profile, base: s.base, target: s.target, counts: s.counts, activeTrams: s.active.filter(v => v.tramDetectedByFlagOrVariant).map(v => ({ id: v.id, kind: v.kind, sourceId: v.edge.sourceId, x: v.x, y: v.y, z: v.z, heading: v.heading })), pooledTrams: s.pool.filter(v => v.tramDetectedByFlagOrVariant).map(v => ({ id: v.id, kind: v.kind, sourceId: v.edge.sourceId })) })) };
    console.log(JSON.stringify(report.export));
    await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, 'native-romana.png')); report.capture = 'native-romana.png';
    for (const [name, expected] of Object.entries(manifest.files)) { const got = hash(fs.readFileSync(path.join(root, name))); assert.equal(got.sha256, expected.sha256); assert.equal(got.gitBlobSha1, expected.gitBlobSha1); }
    report.postRunCopiedFilesVerified = Object.keys(manifest.files).length; assert.deepEqual(facts.observerErrors, []); assert.equal(facts.snapshots.length, 3);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.httpErrors, []); report.complete = true;
})().catch(e => { report.fatal = String(e.stack || e); console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); report.browserClosedUtc = new Date().toISOString(); if (server?.listening) await new Promise(r => server.close(r)); report.endedUtc = new Date().toISOString(); persist(); fs.writeFileSync(path.join(out, 'served-files.json'), JSON.stringify(report.servedFiles, null, 2)); });
