#!/usr/bin/env node
// Full high/mirror Arnia population evolution plus complete-frame reflection refreshes.
// Usage: node integration-final-soak.cjs ROOT OUT [physical-sim-minutes=15] (SOAK_WALLCLOCK=1 also holds the scene for that wall duration)
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const out = path.resolve(process.argv[3] || '/tmp/integration-final-soak'), minutes = +(process.argv[4] || 15);
fs.mkdirSync(out, { recursive: true });
const report = { root, minutes, method: {
    physics: 'Unchanged actual Traffic.update at 30 Hz for 15 simulated physical minutes; stationary native Arnia chapter pose.',
    rendering: 'Full game high-quality draws, true mirror, native far plane and populations; no internal-frame statistics reset. A native one-pixel readPixels completes each measured frame to bound software-GL queue buildup; no full-canvas readback or font wait. Cold setup separated.',
    sampling: 'Complete frames at each physical minute; every progressive PMREM slice is a complete high/mirror frame for actual sunset and rain renderer transitions at evolved minute 15; traffic hour stays fixed to retain identities.',
    limits: 'System Chromium/SwiftShader, no physical hardware FPS claim. Simulation and wall duration are recorded separately.',
}, source: {}, frameStages: [], errors: [], consoleErrors: [], failures: [], samples: [], refreshes: [] };
let browser;
const server = http.createServer((req, res) => {
    let uri = decodeURIComponent(req.url.split('?')[0]); if (uri.endsWith('/')) uri += 'index.html';
    const file = path.join(root, uri);
    fs.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : body); });
});
const persist = () => { fs.writeFileSync(path.join(out, 'profile.next.json'), JSON.stringify(report, null, 2)); fs.renameSync(path.join(out, 'profile.next.json'), path.join(out, 'profile.json')); };
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(180000); require('./integration-browser-bounds.cjs').boundEvaluations(page);
    page.on('pageerror', e => report.errors.push(e.message)); page.on('crash', () => report.errors.push('PAGE_CRASH'));
    page.on('console', m => {
        const message = m.text();
        if (message.startsWith('__integration_frame_stage__')) {
            const stage = JSON.parse(message.slice('__integration_frame_stage__'.length));
            report.frameStages.push(stage); fs.writeFileSync(path.join(out, 'frame-stage.json'), JSON.stringify(stage, null, 2));
        } else if (m.type() === 'error') report.consoleErrors.push(message);
    });
    await page.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
    await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.game?.r3d, null, { timeout: 90000 });
    await page.evaluate(() => { game.r3d.setQuality('low'); game.quality = 'high'; game.audio.setMuted(true); });
    await page.addScriptTag({ type: 'module', url: `http://127.0.0.1:${server.address().port}/game/dev/harness/page/index.js` });
    await page.waitForFunction(() => window.harness, null, { timeout: 90000 });
    await page.evaluate(() => {
        const renderer = game.renderer, render = renderer.renderBufferDirect.bind(renderer);
        window.__integrationSoak = { draws: [], stage: 'setup', relocations: [] };
        renderer.info.reset();
        renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
            const before = { ...renderer.info.render }; render(camera, scene, geometry, material, object, group);
            const calls = renderer.info.render.calls - before.calls, triangles = renderer.info.render.triangles - before.triangles;
            if (calls) __integrationSoak.draws.push({ pass: camera === game.camera ? 'main' : camera === game.player?.mirrorCam ? 'mirror' : camera === game.r3d.sun.shadow.camera ? 'shadow' : 'other', object: object.name || object.type, material: material.name || material.type, calls, triangles, instances: object.isInstancedMesh ? object.count : null });
        };
    });
    await page.evaluate(async () => {
        game.clock.override = 'day'; game.started = true;
        document.querySelector('#menu').classList.remove('show'); document.querySelector('#hud').classList.add('show');
        await game.enterChapter(game.chapters.findIndex(c => c.id === 'arnia'), { initial: true });
        game.clock.override = 'day'; game.updateClock(0); game.r3d.setWeather('clear', { instant: true }); game.r3d.setSeason('summer');
        game.r3d.setQuality('high'); game.player.mirrorEnabled = true; game.traffic.setHour(8, true);
        const T = game.traffic, S = __integrationSoak, C = T.peds;
        const snapshot = () => ({ counts: T.counts, base: T.base, target: T.target, profile: T.profile, maxVehicles: T.maxVehicles,
            jamExtra: T.jamExtra, jamBuilt: T._jamBuilt || 0, large: T.large,
            kinds: Object.fromEntries([...new Set([...T.vehicles, ...T.pool].map(v => v.kind))].map(kind => [kind, { active: T.vehicles.filter(v => v.kind === kind).length, pooled: T.pool.filter(v => v.kind === kind).length }])),
            activeIds: T.vehicles.map(v => v.id), pooledIds: T.pool.map(v => v.id) });
        S.populationPreparation = { initial: snapshot(), seconds: [] };
        // Only normal simulation may restore actors that native chapter placement temporarily pooled.
        // Preserve every original actor and record each second; never force a pose or change admission.
        for (let second = 1; second <= 60 && (T.counts.moving < T.target.moving || T.counts.parked < T.target.parked); second++) {
            for (let frame = 0; frame < 30; frame++) T.update(1 / 30);
            S.populationPreparation.seconds.push({ second, ...snapshot() });
        }
        S.populationPreparation.final = snapshot();
        S.start = game.traffic.time; S.identities = new Set(C.list); S.vehicleIdentities = new Set(game.traffic.vehicles);
        S.last = new Map(C.list.map(p => [p, { x: p.x, z: p.z, path: 0, minutePath: 0, stationarySeconds: 0, maxStationarySeconds: 0 }]));
        const relocate = C.relocate;
        C.relocate = function (person, ...args) {
            const from = { x: person.x, z: person.z, visible: this.inView(person) }, result = relocate.call(this, person, ...args);
            const distance = Math.hypot(person.x - from.x, person.z - from.z);
            if (distance > .25) S.relocations.push({ id: person.i, time: game.traffic.time - S.start, from, to: { x: person.x, z: person.z, visible: this.inView(person) }, distance });
            return result;
        };
    });
    report.populationPreparation = await page.evaluate(() => __integrationSoak.populationPreparation);
    persist();
    console.log(JSON.stringify({ populationPreparation: { counts: report.populationPreparation.final.counts, base: report.populationPreparation.final.base, target: report.populationPreparation.final.target, kinds: report.populationPreparation.final.kinds } }));
    if (process.env.SOAK_DIAGNOSTIC === '1') { report.diagnosticOnly = true; return; }
    const native = report.populationPreparation.final;
    report.expectedPopulation = { people: 560, vehicles: native.counts.active, basis: 'Unmodified final-source native maxVehicles/high-quality admission and hour-8 target; no population cuts or forced placements.' };
    if (native.counts.moving !== native.target.moving || native.counts.parked !== native.target.parked) throw new Error('Native population did not reach its configured moving/parked target; see pool/base/target breakdown');
    report.setup = await page.evaluate(() => ({ draws: __integrationSoak.draws, accumulated: { ...game.renderer.info.render } }));
    for (const file of ['game/src/render.js', 'game/src/progressive-pmrem.js', 'game/src/main.js', 'game/src/world.js', 'game/src/traffic.js', 'game/src/vehicles.js', 'game/data/bucharest-romana.json']) report.source[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    async function frame(label, captureName = null) {
        const row = await page.evaluate(label => {
            const S = __integrationSoak, r = game.r3d; S.draws = [];
            const before = { ...game.renderer.info.render };
            const stage = phase => console.info('__integration_frame_stage__' + JSON.stringify({ label, phase, at: performance.now(), programs: game.renderer.info.programs.length, memory: { ...game.renderer.info.memory } }));
            stage('before-draw');
            harness.H._renderNow = true; game.drawFrame({ mirror: true }); harness.H._renderNow = false;
            stage('after-draw-before-readback');
            const gl = game.renderer.getContext(), pixel = S.pixel ||= new Uint8Array(4);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            stage('after-one-pixel-readback');
            return { label, readbackPixel: Array.from(pixel), before, stats: { ...r.stats }, draws: S.draws, pending: !!r._envJob, phase: r._envJob?.phase || null, fade: r._envFade,
                conditions: { override: r.clock?.override, weather: r._wxOverride, cloud: r._wx?.cloud, sunElevation: r.sunElevation, shadow: r.sun.castShadow },
                population: { people: game.traffic.peds.list.length, vehicles: game.traffic.vehicles.length, originalPeople: game.traffic.peds.list.every(p => S.identities.has(p)), originalVehicles: game.traffic.vehicles.every(p => S.vehicleIdentities.has(p)) } };
        }, label);
        row.logical = row.draws.reduce((sum, d) => ({ calls: sum.calls + d.calls, triangles: sum.triangles + d.triangles }), { calls: 0, triangles: 0 });
        if (row.stats.drawCalls !== row.before.calls + row.logical.calls || row.stats.triangles !== row.before.triangles + row.logical.triangles) report.failures.push({ type: 'counter-accounting', label, before: row.before, stats: row.stats, logical: row.logical });
        if (row.logical.calls > 400 || row.logical.triangles > 1500000) report.failures.push({ type: 'active-budget', label, ...row.logical });
        if (!row.draws.some(d => d.pass === 'mirror')) report.failures.push({ type: 'mirror-absent', label });
        if (row.population.people !== 560 || row.population.vehicles !== report.expectedPopulation.vehicles || !row.population.originalPeople || !row.population.originalVehicles) report.failures.push({ type: 'population', label, population: row.population });
        if (captureName) {
            report.pendingCapture = { frame: row, file: captureName }; persist();
            await require('./integration-browser-bounds.cjs').captureViewport(page, path.join(out, captureName));
            report.captures ||= []; report.captures.push({ label, file: captureName, method: 'Bounded Chromium compositor viewport capture, no font wait or canvas readback; same stationary measured physical state.' });
            delete report.pendingCapture;
        }
        return row;
    }
    // The deterministic clear-weather choice can replace the climate map built at scene load.
    // Settle that first in complete high/mirror frames so later sunset/rain controls cannot
    // accidentally measure an inherited job. Keep every raw cold/setup and warm counter.
    report.warmFrames = [];
    for (let i = 0; i < 96; i++) {
        const row = await frame(`initial-condition-${i}`); report.warmFrames.push(row); persist();
        if (!row.pending && row.fade === 1) break;
    }
    if (report.warmFrames.at(-1).pending || report.warmFrames.at(-1).fade !== 1) throw new Error('Initial condition reflection did not settle');
    report.wallStart = Date.now(); persist();
    for (let minute = 0; minute <= minutes; minute++) {
        if (process.env.SOAK_WALLCLOCK === '1') while (Date.now() < report.wallStart + minute * 60000) await new Promise(resolve => setTimeout(resolve, Math.min(10000, report.wallStart + minute * 60000 - Date.now())));
        const sample = await page.evaluate(minute => {
            const S = __integrationSoak, T = game.traffic, C = T.peds, P = game.player, dt = 1 / 30;
            for (const value of S.last.values()) value.minutePath = 0;
            let maxStep = 0, maxVisibleStep = 0; const visibleSnaps = [];
            for (let f = 0; f < (minute ? 1800 : 0); f++) {
                T.update(dt);
                for (const p of C.list) {
                    const previous = S.last.get(p); if (!previous) continue;
                    const distance = Math.hypot(p.x - previous.x, p.z - previous.z);
                    previous.path += distance; previous.minutePath += distance;
                    previous.stationarySeconds = distance < .001 ? previous.stationarySeconds + dt : 0;
                    previous.maxStationarySeconds = Math.max(previous.maxStationarySeconds, previous.stationarySeconds);
                    maxStep = Math.max(maxStep, distance);
                    if (C.inView({ x: previous.x, z: previous.z }) || C.inView(p)) {
                        maxVisibleStep = Math.max(maxVisibleStep, distance);
                        if (distance > .4 && visibleSnaps.length < 30) visibleSnaps.push({ id: p.i, distance, from: { x: previous.x, z: previous.z }, to: { x: p.x, z: p.z }, state: p.state });
                    }
                    previous.x = p.x; previous.z = p.z;
                }
            }
            const people = C.list.map(p => ({ id: p.i, x: p.x, z: p.z, state: p.state, recovery: !!p.recovery, ...S.last.get(p), distance: Math.hypot(p.x - P.x, p.z - P.z) }));
            return { minute, physicalSimSeconds: T.time - S.start, pose: { x: P.x, z: P.z, heading: P.heading }, people, maxStep, maxVisibleStep, visibleSnaps,
                states: Object.fromEntries([...new Set(C.list.map(p => p.state))].map(state => [state, C.list.filter(p => p.state === state).length])),
                recoveries: people.filter(p => p.recovery).length, stalledRecoveries: people.filter(p => p.recovery && p.stationarySeconds > 120),
                pub: Object.fromEntries([10, 20, 40].map(r => [r, C.list.filter(p => Math.hypot(p.x - 579.6, p.z - 884.5) < r).length])), pedStats: { ...C.stats } };
        }, minute);
        sample.frames = [await frame(`minute-${minute}`, [0, 5, 10, 15, minutes].includes(minute) ? `minute-${minute}.png` : null)];
        if (minute === 0) sample.frames.push(await frame('minute-0-warm'));
        if (sample.visibleSnaps.length) report.failures.push({ type: 'visible-pedestrian-step-over-0.4m', minute, samples: sample.visibleSnaps });
        if (sample.stalledRecoveries.length) report.failures.push({ type: 'stationary-recovery-over-120s', minute, samples: sample.stalledRecoveries });
        report.samples.push(sample); persist();
        console.log(JSON.stringify({ minute, physicalSimSeconds: sample.physicalSimSeconds, states: sample.states, recoveries: sample.recoveries, stalledRecoveries: sample.stalledRecoveries.length, maxVisibleStep: sample.maxVisibleStep, pub: sample.pub, frames: sample.frames.map(f => f.logical) }));
    }
    for (const trigger of ['sun', 'cloud']) {
        await page.evaluate(trigger => { const r = game.r3d; if (trigger === 'sun') r.setClock({ override: 'sunset' }); else r.setWeather('rain', { instant: true }); r._envT = 0; }, trigger);
        const refresh = { trigger, frames: [] }; report.refreshes.push(refresh);
        for (let i = 0; i < 60; i++) { const row = await frame(`evolved-${trigger}-${i}`); refresh.frames.push(row); persist(); if (!row.pending && row.fade === 1) break; }
        if (!refresh.frames[0].pending || refresh.frames.at(-1).pending || refresh.frames.at(-1).fade !== 1 || refresh.frames.length < 30) report.failures.push({ type: 'incomplete-progressive-refresh', trigger, frames: refresh.frames.length });
        console.log(JSON.stringify({ trigger, frames: refresh.frames.length, maxCalls: Math.max(...refresh.frames.map(f => f.logical.calls)), maxTriangles: Math.max(...refresh.frames.map(f => f.logical.triangles)) }));
    }
    report.wallEnd = Date.now(); report.wallDurationSeconds = (report.wallEnd - report.wallStart) / 1000;
    report.relocations = await page.evaluate(() => __integrationSoak.relocations);
    for (const row of report.relocations) if (row.distance > .4 && (row.from.visible || row.to.visible)) report.failures.push({ type: 'visible-relocation', ...row });
    report.finalFrame = await frame('evolved-final', 'evolved-final.png');
    report.summary = { maxCalls: Math.max(...[...report.warmFrames, ...report.samples.flatMap(s => s.frames), ...report.refreshes.flatMap(s => s.frames), report.finalFrame].map(f => f.logical.calls)), maxTriangles: Math.max(...[...report.warmFrames, ...report.samples.flatMap(s => s.frames), ...report.refreshes.flatMap(s => s.frames), report.finalFrame].map(f => f.logical.triangles)), physicalSimSeconds: report.samples.at(-1).physicalSimSeconds };
    report.complete = true;
})().catch(e => { report.fatal = e.stack; process.exitCode = 1; }).finally(async () => {
    report.complete ??= false; persist(); await browser?.close(); await new Promise(resolve => server.close(resolve));
    if (report.failures.length || report.errors.length) process.exitCode = 1;
});
