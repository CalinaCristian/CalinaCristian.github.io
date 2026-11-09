// Usage: ROOT OUTPUT FULL40SHA [GIT_REPO]. Serves exact production files.
// Native drive and stationary orientation QA are separate scopes. No A/B modes.
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const crypto = require('node:crypto'), cp = require('node:child_process');
const { chromium } = require('playwright');
const { summarizeDraws, accountFrame } = require('./counter-accounting.cjs');
const { accountNativeCohort } = require('./cohort-accounting.cjs');
const [rootArg, outArg, sourceCommit, repoArg] = process.argv.slice(2);
if (!rootArg || !outArg || !/^[a-f0-9]{40}$/.test(sourceCommit || '')) throw Error('ROOT OUTPUT FULL40SHA [GIT_REPO]');
const root = fs.realpathSync(rootArg), out = path.resolve(outArg), repo = path.resolve(repoArg || process.cwd());
if (out === root || out.startsWith(root + path.sep)) throw Error('Output must be outside the immutable source');
if (fs.existsSync(out) && fs.readdirSync(out).length) throw Error('Use a new empty output directory; preserve incomplete runs');
fs.mkdirSync(out, { recursive: true });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const blob = b => crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const tree = new Map(cp.execFileSync('git', ['ls-tree', '-rz', '--full-tree', sourceCommit], { cwd: repo, maxBuffer: 64 * 1024 * 1024 }).toString().split('\0').filter(Boolean).map(s => {
    const [meta, name] = s.split('\t'); return [name, meta.split(' ')[2]];
}));
const files = [];
function inventory(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const name = path.posix.join(rel, entry.name), file = path.join(dir, entry.name);
        if (entry.isDirectory()) inventory(file, name);
        else {
            if (!entry.isFile()) throw Error('Unexpected non-file in source archive: ' + name);
            const bytes = fs.readFileSync(file), gitBlobSha1 = blob(bytes);
            if (tree.get(name) !== gitBlobSha1) throw Error('Source differs from frozen git tree: ' + name);
            files.push({ path: name, bytes: bytes.length, sha256: hash(bytes), gitBlobSha1 });
        }
    }
}
inventory(root);
const byPath = new Map(files.map(f => [f.path, f]));
const provenance = { sourceCommit, sourceRoot: root, archiveFiles: files.length, files, allFilesMatchGitTree: true };
fs.writeFileSync(path.join(out, 'source-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
const report = {
    schemaVersion: 1, sourceCommit, sourceRoot: root, startedAt: new Date().toISOString(), complete: false,
    method: 'Exact production archive. Native public Unirii rush/clear/summer start, native first150m route driven with fixed30Hz input/navigation. Subsequent vehicle-rig yaw changes are stationary orientation QA at the evolved endpoint, not movement proof. NPC state and identities must remain unchanged during draw-only QA. Public high-quality UI selection; native FOV/far/mirror/populations. No source, geometry, shader, index, clock or reflection-function replacement.',
    sourceOverrides: [], cameraOverrides: [], qualitySelection: 'Normal #quality select change to high before native public start',
    runnerSha256: hash(fs.readFileSync(__filename)), sourceProvenanceSha256: hash(fs.readFileSync(path.join(out, 'source-provenance.json'))),
    runtime: { node: process.version, chromium: '/usr/bin/chromium', graphics: 'SwiftShader software GL; no hardware FPS claim', preloads: process.execArgv.flatMap((s, i) => s === '--require' ? [{ path: process.execArgv[i + 1], sha256: hash(fs.readFileSync(process.execArgv[i + 1])) }] : []) },
    frames: [], reflectionControls: [], rawCounterAlerts: [], errors: [], consoleErrors: [], failedRequests: [], failures: [], servedFiles: {},
    counterAccountingHelperSha256: hash(fs.readFileSync(path.join(__dirname, 'counter-accounting.cjs'))),
    cohortAccountingHelperSha256: hash(fs.readFileSync(path.join(__dirname, 'cohort-accounting.cjs'))),
};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
    let relative;
    try { relative = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); }
    catch { res.writeHead(400).end(); return; }
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
        if (error) { res.writeHead(404).end(); return; }
        const expected = byPath.get(relative), sha256 = hash(bytes);
        if (!expected || expected.sha256 !== sha256) { report.failures.push({ kind: 'served-source-mismatch', path: relative }); save(); res.writeHead(500).end(); return; }
        report.servedFiles[relative] = { sha256, gitBlobSha1: expected.gitBlobSha1, requests: (report.servedFiles[relative]?.requests || 0) + 1 };
        res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(bytes);
    });
});
let browser;
(async () => {
    save(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => { report.errors.push(e.stack || e.message); save(); });
    page.on('console', m => { if (m.type() === 'error') { report.consoleErrors.push(m.text()); save(); } });
    page.on('requestfailed', req => { report.failedRequests.push({ url: req.url().split('?')[0], failure: req.failure()?.errorText }); save(); });
    // The requested clear weather uses the normal native condition control.
    // Avoid an unrelated live-weather network failure during the menu boot.
    await context.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
    await page.goto(base + 'game/index.html?notrack'); await page.waitForFunction(() => window.game);
    await page.addScriptTag({ type: 'module', url: base + 'game/dev/harness/page/index.js' });
    await page.waitForFunction(() => window.harness);
    await page.evaluate(async () => {
        const H = harness.H; H.noShots = true; H.renderEvery = 0;
        // Replace only the harness's reduced-far/half-resolution screenshot
        // scheduler. The production draw path and all native settings survive.
        H.renderFrame = () => {
            H._renderNow = true;
            try { game.drawFrame({ mirror: true }); const gl = game.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }
            finally { H._renderNow = false; }
        };
        // Observe loading/PMREM setup as well as complete frames. Never reset
        // counters: native stats include any real prior setup carry until the
        // production reset at the end of a complete frame.
        const g = game, renderer = g.renderer, draw = renderer.renderBufferDirect;
        const S = window.BUDGET = { THREE: await import('/game/vendor/three.module.min.js'), draws: [], unframedDraws: [], count: false, stage: 'native-load-setup', drawSequence: 0 };
        S.counters = () => ({ ...renderer.info.render });
        S.setupPreCounters = S.counters();
        // Observe original constructor/rush cohort production without changing
        // options, RNG, returned actors, placement, admission or native pooling.
        const { Traffic } = await import('/game/src/traffic.js');
        S.cohort = { registrations: [], constructors: [], phases: [], wrapperCalls: { spawn: 0, spawnAll: 0, setHour: 0, rebalance: 0 } };
        const cohortState = T => ({ maxVehicles: T.maxVehicles, large: T.large, base: T.base ? { ...T.base } : null, target: T.target ? { ...T.target } : null, counts: { ...T.counts }, profile: { ...T.profile }, jamExtra: T.jamExtra || 0, jamBuilt: T._jamBuilt || 0, active: T.vehicles.length, pool: T.pool.length });
        for (const method of ['spawn', 'spawnAll', 'setHour', 'rebalance']) {
            const original = Traffic.prototype[method];
            Traffic.prototype[method] = function (...args) {
                S.cohort.wrapperCalls[method]++;
                const before = method === 'setHour' || method === 'rebalance' ? cohortState(this) : null;
                const value = original.apply(this, args);
                if (method === 'spawn') S.cohort.registrations.push({ traffic: this, vehicle: value, birthId: value.id, method, input: { edgeId: args[0].edge?.id, sourceId: args[0].edge?.access?.sourceId, dir: args[0].dir, lane: args[0].lane, s: args[0].s, kind: args[0].kind } });
                else if (method === 'spawnAll') S.cohort.constructors.push({ traffic: this, vehicles: this.vehicles.slice(), pool: this.pool.slice(), state: cohortState(this), actors: this.vehicles.map(v => ({ id: v.id, kind: v.kind, cls: this.cls(v), parked: !!v.parked, tram: !!v.tram, police: !!v.isPolice, edgeId: v.edge.id, sourceId: v.edge.access?.sourceId || null, dir: v.dir, lane: v.lane, s: v.s })) });
                else S.cohort.phases.push({ traffic: this, method, args, before, after: cohortState(this) });
                return value;
            };
        }
        S.inspectCohort = T => {
            const all = [...T.vehicles, ...T.pool], records = S.cohort.registrations.filter(r => r.traffic === T), ctor = S.cohort.constructors.find(r => r.traffic === T);
            return { state: cohortState(T), constructor: ctor ? { state: ctor.state, actors: ctor.actors, originalIds: ctor.vehicles.map(v => v.id), originalPoolIds: ctor.pool.map(v => v.id) } : null, originalSpawnCalls: records.map(r => ({ id: r.birthId, currentId: r.vehicle.id, input: r.input })), phases: S.cohort.phases.filter(r => r.traffic === T).map(({ traffic, ...r }) => r), registrationCount: records.length, registeredObjectCount: new Set(records.map(r => r.vehicle)).size, registeredIdCount: new Set(records.map(r => r.vehicle.id)).size, allOriginalSpawnObjectsPresent: records.every(r => all.includes(r.vehicle)), allCurrentObjectsOriginallySpawned: all.every(v => records.some(r => r.vehicle === v)), constructorObjectsPresent: !!ctor && [...ctor.vehicles, ...ctor.pool].every(v => all.includes(v)), allIdsUnique: new Set(all.map(v => v.id)).size === all.length, originalBirthIdsUnchanged: records.every(r => r.birthId === r.vehicle.id), hiddenActiveIds: T.vehicles.filter(v => v.mesh.visible === false).map(v => v.id), inactiveActiveIds: T.vehicles.filter(v => v.inactive === true).map(v => v.id), pedestrianCount: T.peds.list.length, pedestrianCrowdCount: T.peds.crowd.count, initialAdmission: T.initialAdmission, initialTramBinding: T.initialTramBinding, scope: 'Read-only wrappers call original methods once with original this/arguments and return original values; all original constructed objects and native rush spawns are tracked across active/pool. No population option, RNG, actor, visibility or placement writes.' };
        };
        renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
            const before = S.counters();
            const value = draw.call(this, camera, scene, geometry, material, object, group);
            const after = S.counters(), calls = after.calls - before.calls, triangles = after.triangles - before.triangles;
            if (calls) {
                const envScene = S.envScene || g.r3d._envJob?.scene;
                const pass = camera === g.camera ? 'main' : camera === g.player?.mirrorCam ? 'mirror' : camera === g.r3d.sun?.shadow.camera ? 'true-shadow' : material.name === 'SphericalGaussianBlur' ? 'reflection-blur' : (envScene && scene === envScene) || material.name === 'PMREM.Background' ? 'reflection' : 'other';
                const row = { sequence: S.drawSequence++, stage: S.stage, pass, calls, triangles, countersBefore: before, countersAfter: after, camera: { id: camera.id, type: camera.type, name: camera.name, near: camera.near, far: camera.far, fov: camera.fov }, object: { id: object.id, name: object.name, type: object.type, instances: object.isInstancedMesh ? object.count : null, castShadow: object.castShadow, cellFrustum: object.userData.cellFrustum ? { ...object.userData.cellFrustum } : null }, material: { id: material.id, name: material.name, type: material.type, side: material.side, transparent: material.transparent }, geometry: { id: geometry.id, vertices: geometry.attributes.position?.count, indices: geometry.index?.count, drawRange: { ...geometry.drawRange }, group: group ? { ...group } : null } };
                (S.count ? S.draws : S.unframedDraws).push(row);
            }
            return value;
        };
    });
    await page.selectOption('#quality', 'high');
    await page.evaluate(() => game.startFreeRoam('unirii', { tod: 'rush', weather: 'clear', season: 'summer' }));
    report.nativeLoadSetup = await page.evaluate(() => ({ preObservationCounters: BUDGET.setupPreCounters, postLoadCounters: BUDGET.counters(), nativeStatsAfterLoad: { ...game.r3d.stats }, draws: BUDGET.unframedDraws.slice(), scope: 'Observed native high-quality selection and public-start loading, including synchronous PMREM setup. Pre-observation counters are retained as observed and are not attributed to specific draws.' }));
    Object.assign(report.nativeLoadSetup, summarizeDraws(report.nativeLoadSetup.draws));
    report.nativeLoadSetup.expectedPostLoadCounters = { calls: report.nativeLoadSetup.preObservationCounters.calls + report.nativeLoadSetup.measured.calls, triangles: report.nativeLoadSetup.preObservationCounters.triangles + report.nativeLoadSetup.measured.triangles };
    report.nativeLoadSetup.counterAgreement = report.nativeLoadSetup.postLoadCounters.calls === report.nativeLoadSetup.expectedPostLoadCounters.calls && report.nativeLoadSetup.postLoadCounters.triangles === report.nativeLoadSetup.expectedPostLoadCounters.triangles;
    if (!report.nativeLoadSetup.counterAgreement) report.failures.push({ kind: 'native-load-setup-counter-reconciliation' });
    save();
    report.initial = await page.evaluate(async () => {
        const g = game, H = harness.H, P = g.player, T = g.traffic, THREE = await import('/game/vendor/three.module.min.js');
        H.begin('combined-native-first150m');
        const poi = g.world.pois.find(p => p.id === 'gts');
        if (!poi) throw Error('Native Unirii destination missing');
        const route = g.nav.compute(P.x, P.z, poi.doorX ?? poi.x, poi.doorZ ?? poi.z, P.heading);
        if (!route?.points?.length || route.total < 150) throw Error('Native first150m route unavailable');
        let k = 0; while (k < route.cum.length - 2 && route.cum[k + 1] < 150) k++;
        const a = route.points[k], b = route.points[k + 1], t = (150 - route.cum[k]) / (route.cum[k + 1] - route.cum[k]);
        const S = window.BUDGET;
        Object.assign(S, { trace: [], contacts: [], vehicles: [...T.vehicles, ...T.pool], pedestrians: [...T.peds.list], target: { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t }, stage: 'between-frames' });
        S.actors = () => JSON.stringify({ vehicles: [...T.vehicles, ...T.pool].map(v => [v.id, v.x, v.z, v.y, v.heading, v.speed, v.live, v.inactive, v.parked, v.dir, v.s]), activeIds: T.vehicles.map(v => v.id), poolIds: T.pool.map(v => v.id), people: T.peds.list.map(p => [p.i, p.x, p.z, p.y, p.heading, p.speed, p.state, p.onRoad, p.live, p.dir, p.side, p.s, p.waitT, p.downT, p.legs?.map(l => [l.x, l.z, l.cross, l.started, l.len])]) });
        S.population = () => ({ activeVehicleIds: T.vehicles.map(v => v.id), poolVehicleIds: T.pool.map(v => v.id), combinedVehicleIds: [...T.vehicles, ...T.pool].map(v => v.id).sort((a, b) => a - b), pedestrianIds: T.peds.list.map(p => p.i), activeVehicles: T.vehicles.length, poolVehicles: T.pool.length, people: T.peds.list.length, originalVehicleObjects: [...T.vehicles, ...T.pool].every(v => S.vehicles.includes(v)), originalPedestrianObjects: T.peds.list.every(p => S.pedestrians.includes(p)), originalBirthIdsUnchanged: S.cohort.registrations.filter(r => r.traffic === T).every(r => r.birthId === r.vehicle.id), hiddenActiveIds: T.vehicles.filter(v => v.mesh.visible === false).map(v => v.id), inactiveActiveIds: T.vehicles.filter(v => v.inactive === true).map(v => v.id) });
        S.pose = () => ({ x: P.x, z: P.z, y: P.surfY, heading: P.heading, speed: P.speed });
        S.camera = camera => ({ id: camera.id, type: camera.type, fov: camera.fov, near: camera.near, far: camera.far, position: camera.getWorldPosition(new THREE.Vector3()).toArray(), quaternion: camera.getWorldQuaternion(new THREE.Quaternion()).toArray() });
        S.environment = () => ({ pending: !!g.r3d._envJob, scene: g.r3d._envJob?.scene.id ?? null, fade: g.r3d._envFade, rendererTime: g.r3d.time, sunElevation: g.r3d.sunElevation, season: g.r3d._seasonOverride, clock: { date: g.clock.date?.toISOString?.(), hours: g.clock.hours } });
        const step = H.stepOnce.bind(H);
        H.stepOnce = function (dt) { step(dt); if (H.mon.steps % 15 === 0) S.trace.push({ t: H.scT, ...S.pose(), touching: P.touching, contactAge: P.contactAge }); if (P.contactAge === 0 && P.touching) S.contacts.push({ t: H.scT, ...S.pose() }); };
        return { start: S.pose(), target: S.target, routeTotal: route.total, population: S.population(), nativeCohort: S.inspectCohort(T), quality: g.quality, camera: S.camera(g.camera), mirrorCamera: S.camera(P.mirrorCam), publicStartOnly: true, extraPlacementOrPopulationWrites: false };
    }); save(); console.log('LOADED', report.initial.population.activeVehicles, report.initial.population.people);
    async function frame(label, scope, screenshot = false) {
        const row = await page.evaluate(({ label, scope }) => {
            const g = game, S = BUDGET, before = S.actors(), environmentBefore = S.environment();
            S.draws = []; S.envScene = g.r3d._envJob?.scene; S.stage = label;
            const preDrawCounters = S.counters(), preDrawNativeStats = { ...g.r3d.stats }; S.count = true;
            try { harness.H.renderFrame(); } finally { S.count = false; S.stage = 'between-frames'; }
            const postDrawCounters = S.counters(), nativeRawStats = { calls: g.r3d.stats.drawCalls, triangles: g.r3d.stats.triangles };
            return { label, scope, preDrawCounters, preDrawNativeStats, postDrawCounters, nativeRawStats, counterAutoReset: g.renderer.info.autoReset, draws: S.draws, pose: S.pose(), camera: S.camera(g.camera), mirrorCamera: S.camera(g.player.mirrorCam), population: S.population(), npcStateBefore: before, npcStateAfter: S.actors(), npcStateUnchanged: before === S.actors(), environmentBefore, environmentAfter: S.environment(), quality: g.quality, stats: { ...g.r3d.stats }, renderer: { width: g.renderer.domElement.width, height: g.renderer.domElement.height, pixelRatio: g.renderer.getPixelRatio() }, mirrorEnabled: g.player.mirrorEnabled, lookBack: g.player.lookBack };
        }, { label, scope });
        row.counterAccounting = accountFrame(row.preDrawCounters, row.postDrawCounters, row.nativeRawStats, row.draws);
        row.logical = row.counterAccounting.measuredCompleteFrame; row.passes = row.counterAccounting.passes;
        if (!row.counterAccounting.rawStatsAgreement || !row.counterAccounting.productionEndResetObserved) report.failures.push({ label, kind: 'raw-counter-reconciliation', accounting: row.counterAccounting });
        if (row.counterAccounting.rawStatsOverBudget) report.rawCounterAlerts.push({ label, nativeRawStats: row.nativeRawStats, preDrawCounters: row.preDrawCounters, measuredCompleteFrame: row.logical, rawStatsAgreement: row.counterAccounting.rawStatsAgreement, note: 'Retain for explicit classification. Actual frame work is independently measured per draw; no historical setup amount is assumed or subtracted.' });
        row.npcStateBeforeSha256 = hash(Buffer.from(row.npcStateBefore)); row.npcStateAfterSha256 = hash(Buffer.from(row.npcStateAfter));
        delete row.npcStateBefore; delete row.npcStateAfter;
        const sameIds = JSON.stringify(row.population.combinedVehicleIds) === JSON.stringify(report.initial.population.combinedVehicleIds) && JSON.stringify(row.population.pedestrianIds) === JSON.stringify(report.initial.population.pedestrianIds);
        if (!sameIds || !row.population.originalVehicleObjects || !row.population.originalPedestrianObjects || !row.population.originalBirthIdsUnchanged || row.population.activeVehicles !== report.initial.population.activeVehicles || row.population.poolVehicles !== 0 || row.population.hiddenActiveIds.length || row.population.inactiveActiveIds.length || !row.npcStateUnchanged) report.failures.push({ label, kind: 'native-actor-invariant' });
        if (row.quality !== 'high' || row.renderer.pixelRatio !== 1 || row.renderer.width !== 1280 || row.renderer.height !== 720 || row.camera.far !== 5000 || row.camera.near !== .2 || row.mirrorCamera.far !== 150 || !row.mirrorEnabled || row.lookBack) report.failures.push({ label, kind: 'native-settings', quality: row.quality, renderer: row.renderer, camera: row.camera, mirror: row.mirrorCamera });
        if (!row.passes.main || !row.passes.mirror || !row.passes['true-shadow']) report.failures.push({ label, kind: 'missing-native-pass' });
        if (row.logical.calls > 400 || row.logical.triangles > 1500000) report.failures.push({ label, kind: 'budget', ...row.logical });
        if (screenshot) { const file = label + '.png'; await page.screenshot({ path: path.join(out, file), type: 'png' }); row.image = { file, sha256: hash(fs.readFileSync(path.join(out, file))) }; }
        report.frames.push(row); save(); console.log('FRAME', label, row.logical.calls, row.logical.triangles); return row;
    }
    const population = report.initial.population;
    const cohort = report.initial.nativeCohort;
    report.nativeCohortGate = accountNativeCohort(population, cohort);
    if (!report.nativeCohortGate.passed) report.failures.push({ kind: 'required-native-full-cohort', gate: report.nativeCohortGate });
    report.initialPhysicalAdmission = { passed: cohort.initialAdmission?.passed === true && cohort.initialTramBinding?.passed === true, initialAdmission: cohort.initialAdmission, initialTramBinding: cohort.initialTramBinding, scope: 'Separate actual before-publication native physical admission; cohort conservation and render counts cannot excuse an unresolved body/source failure.' };
    if (!report.initialPhysicalAdmission.passed) report.failures.push({ kind: 'native-initial-physical-admission', unresolved: cohort.initialAdmission?.unresolved, invalidRailModes: cohort.initialAdmission?.invalidRailModes, initialTramBinding: cohort.initialTramBinding });
    report.startupSimulation = { requestedSeconds: .5, actualSeconds: report.nativeCohortGate.passed && report.initialPhysicalAdmission.passed ? .5 : 0, scope: 'No physical warming steps on a failed constructor/cohort gate; complete native draw-only warm/sample frames remain observable before stopping.' };
    if (report.startupSimulation.actualSeconds) await page.evaluate(() => harness.H.run(.5));
    await frame('chapter-start-warm', 'native-public-start'); await frame('chapter-start', 'native-public-start', true);
    report.preDriveGate = { frames: report.frames.length, passed: report.failures.length === 0 && report.errors.length === 0 && report.consoleErrors.length === 0 && report.failedRequests.length === 0, actualFrameMaxima: { calls: Math.max(...report.frames.map(f => f.logical.calls)), triangles: Math.max(...report.frames.map(f => f.logical.triangles)) }, rawCounterAlertsRetained: report.rawCounterAlerts.length, scope: 'Actual public-start complete warm/sample frames; abort before driving on a measured budget, native-setting, actor or counter-reconciliation failure. This is not the later23-frame evolved-endpoint acceptance.' }; save();
    if (!report.preDriveGate.passed) {
        report.stoppedBeforeDrive = true;
        report.unframedNativeWork = await page.evaluate(() => ({ draws: BUDGET.unframedDraws, finalCounters: BUDGET.counters(), scope: 'Observed native setup and other work outside counted frames, retained on pre-drive rejection.' }));
        Object.assign(report.unframedNativeWork, summarizeDraws(report.unframedNativeWork.draws));
        for (const f of files) if (hash(fs.readFileSync(path.join(root, f.path))) !== f.sha256) report.failures.push({ kind: 'source-mutated-after-run', path: f.path });
        report.sourceFilesVerifiedAfterRun = files.length; report.endedAt = new Date().toISOString(); save(); return;
    }
    report.drive = await page.evaluate(async () => {
        const S = BUDGET, H = harness.H, start = S.pose(), simStart = H.simT;
        const result = await H.driveTo(S.target.x, S.target.z, { label: 'first150m', arriveR: 9, timeout: 120, speedMul: .7, stop: false });
        return { start, target: S.target, result, final: S.pose(), simSeconds: H.simT - simStart, trace: S.trace, contacts: S.contacts, issues: H.issues, resetFree: result.resets === 0, scope: result.resets ? 'Native public-start route with harness recovery resets through the production reset API (or its documented fallback). This is not reset-free movement proof; any reset-induced placement or traffic clearing must remain part of this failed drive scope.' : 'Native driving from public start with ordinary navigation/input. No extra placement, traffic clearing, camera or population edits.' };
    }); save(); console.log('DRIVE', JSON.stringify(report.drive.result));
    if (!report.drive.result.ok || report.drive.result.resets) report.failures.push({ kind: 'native-drive', result: report.drive.result });
    const native = await frame('native-first150m', 'native-driven-endpoint', true);
    report.hotspot = { historical: { x: -580.1437011509073, z: 417.816191281258, heading: 4.536395961418271 }, actual: native.pose, distanceFromHistorical: Math.hypot(native.pose.x + 580.1437011509073, native.pose.z - 417.816191281258), note: 'Actual native endpoint is authoritative; it is not teleported to the historical pose.' };
    if (report.hotspot.distanceFromHistorical > 30) report.failures.push({ kind: 'historical-hotspot-coverage', distance: report.hotspot.distanceFromHistorical });
    await page.evaluate(() => { const S = BUDGET, P = game.player; S.qaHeading = P.heading; S.qaRigRotation = P.rig.rotation.toArray(); S.qaNpcState = S.actors(); S.qaCamera = { fov: game.camera.fov, near: game.camera.near, far: game.camera.far }; });
    report.orientationScope = 'Stationary vehicle-rig yaw QA at the evolved native endpoint. No camera property, position, projection, FOV, near/far, LOD or quality assignment. No simulation steps occur, so NPC states remain exactly as evolved by the drive. Deliberate player heading/rig-yaw changes are restored afterward.';
    for (const season of ['summer', 'winter']) {
        await page.evaluate(season => game.setRoamSeason(season), season);
        const reflection = await page.evaluate(() => {
            const requested = !game.r3d._envJob;
            if (requested) game.r3d._buildEnvMap();
            return { requested, pending: !!game.r3d._envJob, method: requested ? 'One explicit render-only QA request through the unchanged native progressive reflection builder.' : 'Existing native progressive reflection job; no explicit request.', environment: BUDGET.environment() };
        });
        report.reflectionControls.push({ season, ...reflection });
        if (!reflection.pending) report.failures.push({ kind: 'pending-reflection-unavailable', season });
        for (const [direction, turn] of [['forward', 0], ['left', Math.PI / 2], ['back', Math.PI], ['right', -Math.PI / 2]]) {
            await page.evaluate(turn => { const P = game.player, S = BUDGET; P.heading = S.qaHeading + turn; P.rig.rotation.set(S.qaRigRotation[0], P.heading, S.qaRigRotation[2], S.qaRigRotation[3]); }, turn);
            await frame(`${season}-${direction}-warm`, 'stationary-orientation-qa');
            await frame(`${season}-${direction}`, 'stationary-orientation-qa', true);
        }
        await page.evaluate(() => { const P = game.player, S = BUDGET; P.heading = S.qaHeading; P.rig.rotation.fromArray(S.qaRigRotation); });
        await frame(`${season}-reflection-warm`, 'native-progressive-reflection');
        await frame(`${season}-reflection-sample`, 'native-progressive-reflection', true);
    }
    report.finalInvariants = await page.evaluate(() => ({ npcStateUnchangedThroughOrientationQa: BUDGET.qaNpcState === BUDGET.actors(), population: BUDGET.population(), nativeCohort: BUDGET.inspectCohort(game.traffic), headingRestored: game.player.heading === BUDGET.qaHeading, rigRestored: JSON.stringify(game.player.rig.rotation.toArray()) === JSON.stringify(BUDGET.qaRigRotation), cameraFovNearFarUnchanged: game.camera.fov === BUDGET.qaCamera.fov && game.camera.near === BUDGET.qaCamera.near && game.camera.far === BUDGET.qaCamera.far }));
    if (!report.finalInvariants.nativeCohort.originalBirthIdsUnchanged || !report.finalInvariants.nativeCohort.allOriginalSpawnObjectsPresent || !report.finalInvariants.nativeCohort.allCurrentObjectsOriginallySpawned || !report.finalInvariants.npcStateUnchangedThroughOrientationQa || !report.finalInvariants.headingRestored || !report.finalInvariants.rigRestored || !report.finalInvariants.cameraFovNearFarUnchanged) report.failures.push({ kind: 'stationary-qa-invariants', ...report.finalInvariants });
    report.unframedNativeWork = await page.evaluate(() => ({ draws: BUDGET.unframedDraws, finalCounters: BUDGET.counters(), scope: 'All observed native draws outside explicitly counted complete frames, including initial setup and any synchronous reflection-builder work. Never discarded or inferred from historical runs.' }));
    Object.assign(report.unframedNativeWork, summarizeDraws(report.unframedNativeWork.draws));
    report.maxima = { calls: Math.max(...report.frames.map(f => f.logical.calls)), triangles: Math.max(...report.frames.map(f => f.logical.triangles)), rawNativeStats: { calls: Math.max(...report.frames.map(f => f.nativeRawStats.calls)), triangles: Math.max(...report.frames.map(f => f.nativeRawStats.triangles)) }, scope: 'All recorded complete frames including warm frames, main, mirror, actual true shadows, native reflection work and post processing. Raw native stats, observed prior carry and unframed setup are retained separately; separate maxima may occur in different frames.' };
    await context.close(); await browser.close(); browser = null;
    for (const f of files) if (hash(fs.readFileSync(path.join(root, f.path))) !== f.sha256) report.failures.push({ kind: 'source-mutated-after-run', path: f.path });
    report.sourceFilesVerifiedAfterRun = files.length;
    report.complete = true; report.endedAt = new Date().toISOString(); save();
    console.log('COMPLETE', JSON.stringify({ sourceCommit, maxima: report.maxima, rawCounterAlerts: report.rawCounterAlerts.length, failures: report.failures.length, errors: report.errors.length, consoleErrors: report.consoleErrors.length, failedRequests: report.failedRequests.length }));
})().catch(error => { report.fatal = error.stack || String(error); process.exitCode = 1; }).finally(async () => {
    save(); await browser?.close(); report.browserClosed = true; save(); await new Promise(resolve => server.close(resolve));
    if (report.errors.length || report.consoleErrors.length || report.failedRequests.length || report.failures.length) process.exitCode = 1;
});
