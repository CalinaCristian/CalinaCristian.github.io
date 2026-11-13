#!/usr/bin/env node
// Actual-world Dinamo acceptance: pitch-wide controller paths, solid stands,
// both goals, weather visibility and scene/save lifecycle. No network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const root = path.resolve(option('root', path.join(__dirname, '../../..')));
const out = path.resolve(option('out', '/tmp/dinamo-playability'));
fs.mkdirSync(out, { recursive: true });

(async () => {
    const server = http.createServer((req, res) => {
        let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
        fs.readFile(f, (error, data) => {
            res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream' }[path.extname(f)] || 'application/octet-stream' });
            res.end(error ? 'missing' : data);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, checks: [], errors: [], consoleErrors: [] };
    const check = (name, good, details) => { report.checks.push({ name, pass: !!good, details }); };
    try {
        const context = await browser.newContext({ viewport: { width: 1536, height: 864 } });
        await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        const page = await context.newPage();
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'commit', timeout: 90000 });
        await page.waitForFunction(() => window.game, null, { polling: 50, timeout: 120000 });
        report.play = await page.evaluate(async () => {
            const g = game; await g.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' }); g.audio.setMuted(true); g.exitCar();
            const f = g.football; if (!f) throw new Error('Dinamo football missing');
            const THREE = await import('./vendor/three.module.min.js');
            const { collideBuildings } = await import('./src/world.js');
            const c = f.pitch.center, a = f.pitch.axis;
            const point = window.dinamoPoint = (u, v, h = 0.32) => f.source.localToWorld(new THREE.Vector3(c[0] + a[0] * u + a[1] * v, c[1] + h, c[2] + a[1] * u - a[0] * v));
            const home = point(0, 0); g.foot.x = home.x; g.foot.z = home.z - 160; g.foot.y = 0; g.foot.heading = 0;
            const d = g.explore.drone; if (!d.canDeploy().ok) throw new Error(d.canDeploy().reason); d.deploy(); d.t = 3; d._lift(0.05);
            g.scene.updateMatrixWorld(true);
            const result = { pitch: f.pitch, ballRadius: f.mesh.geometry.parameters.radius, ballTriangles: f.mesh.geometry.attributes.position.count / 3, contactTriangles: f.contact.geometry.index.count / 3, collisionSamples: 0, blocked: [], paths: [], stands: [], roofs: [], boundary: null };
            for (let u = -56; u <= 56; u += 4) for (let v = -32; v <= 32; v += 4) {
                const p = point(u, v, 1); d.pos.copy(p); d.vel.set(0, 0, 0); d._collide(d.c); result.collisionSamples++;
                const car = collideBuildings(g.world.buildings, p.x, p.z, 1.05, c[1] + f.source.position.y);
                if (d.pos.distanceTo(p) > 0.01 || car) result.blocked.push({ u, v, dronePush: d.pos.distanceTo(p), groundHit: car?.hit?.kind });
            }
            const fly = (from, to, h = 0.32) => {
                const p0 = point(...from, h), p1 = point(...to, h), direction = p1.clone().sub(p0).normalize(), distance = p1.distanceTo(p0);
                d.pos.copy(p0); d.vel.set(0, 0, 0); d.mode = 1; d.phase = 'fly'; d.battery = 1; d.rth = false; d.yaw = Math.atan2(-direction.x, -direction.z); d.gimbal = 0; g.input.keys.clear(); g.input.keys.add('KeyW');
                let frames = 0, crossTrack = 0;
                for (; frames < 600; frames++) {
                    d._fly(0.05); const delta = d.pos.clone().sub(p0), along = delta.x * direction.x + delta.z * direction.z;
                    crossTrack = Math.max(crossTrack, Math.abs(delta.x * direction.z - delta.z * direction.x));
                    if (along >= distance) break;
                }
                g.input.keys.clear(); return { from, to, h, frames, crossTrack, end: f.local(d.pos), pass: frames < 600 && crossTrack < 0.15 };
            };
            for (const v of [-31, -24, -12, 0, 12, 24, 31]) for (const sign of [-1, 1]) result.paths.push(fly([-56 * sign, v], [56 * sign, v]));
            for (const u of [-48, -36, -24, -12, 0, 12, 24, 36, 48]) for (const sign of [-1, 1]) result.paths.push(fly([u, -32 * sign], [u, 32 * sign]));
            for (const sign of [-1, 1]) result.paths.push(fly([-52, -31 * sign], [52, 31 * sign], 1));
            for (const sign of [-1, 1]) {
                const path = fly([-125 * sign, 0], [-4 * sign, 0], 30); result.paths.push(path);
                d.pos.copy(point(-4 * sign, 0, 30)); d.vel.set(0, 0, 0); d.gimbal = -Math.PI / 2; g.input.keys.add('KeyW'); for (let i = 0; i < 70; i++) d._fly(0.05); g.input.keys.clear(); d.gimbal = 0;
                result.paths.push({ name: `descent ${sign}`, end: f.local(d.pos), pass: Math.abs(f.local(d.pos).u + 4 * sign) < 0.15 && f.local(d.pos).h < 0.5 });
            }
            const stands = g.world.buildings.filter(b => b.landmark === 'dinamo' && b.y0 === undefined && b.h > 1 && b.h < 22); // (round 2: the bowl is sunk, the stands' tops are 1.2-2.7 m above the street)
            for (let i = 0; i < stands.length; i += Math.max(1, Math.floor(stands.length / 12))) {
                const b = stands[i], p = new THREE.Vector3(b.x, 1, b.z); d.pos.copy(p); d.vel.set(0, 0, 0); d._collide(d.c);
                result.stands.push({ push: d.pos.distanceTo(p), groundSolid: !!collideBuildings([b], b.x, b.z, 0.4), h: b.h });
            }
            for (const b of g.world.buildings.filter(b => b.landmark === 'dinamo' && b.y0 !== undefined)) {
                const push = y => { const p = new THREE.Vector3(b.x, y, b.z); d.pos.copy(p); d.vel.set(0, 0, 0); d._collide({ colliders: [b] }); return d.pos.distanceTo(p); };
                result.roofs.push({ groundClear: !collideBuildings([b], b.x, b.z, 0.4, 0.24), below: push(b.y0 - 1), at: push((b.y0 + b.y1) / 2), above: push(b.y1 + 1) });
            }
            const boundary = g.world.buildings.find(b => b.kind === 'boundary' && Math.hypot(b.x - home.x, b.z - home.z) > 250);
            if (boundary) { const p = new THREE.Vector3(boundary.x, 1, boundary.z); d.pos.copy(p); d.vel.set(0, 0, 0); d._collide(d.c); result.boundary = { push: d.pos.distanceTo(p), kind: boundary.kind }; }
            result.goals = [];
            for (const sign of [-1, 1]) {
                f.reset(); const goals = f.physics.goals; d.pos.copy(point(-4 * sign, 0)); d.vel.set(0, 0, 0); d.yaw = Math.atan2(-a[0] * sign, -a[1] * sign); d.mode = 1; d.gimbal = 0; f.update(0.05, d); g.input.keys.add('KeyW');
                let frames = 0; for (; frames < 400 && f.physics.goals === goals; frames++) { d._fly(0.05); f.update(0.05, d); } g.input.keys.clear();
                result.goals.push({ sign, frames, scored: f.physics.goals === goals + 1, ball: { pos: { ...f.physics.pos }, vel: { ...f.physics.vel }, touched: f.physics.touched }, drone: { active: d.active, flying: d.flying, local: f.local(d.pos) }, photo: !!g.photo?.active });
            }
            result.unlocked = g.achievements.isUnlocked('dinamo-drone-goal'); result.saved = !!JSON.parse(localStorage.getItem('dmcv.progression.v1')).unlocked['dinamo-drone-goal'];
            window.dinamoRender = (view) => {
                f.reset(); const camera = view === 'close' ? point(-2.4, 0, 1.1) : view === 'overhead' ? point(-0.2, 0, 18) : point(-30, 33, 25);
                d.pos.copy(camera); d.vel.set(0, 0, 0); d.gimbal = view === 'close' ? -0.3 : -1.4; g.camera.position.copy(camera); g.camera.lookAt(f.mesh.position); g.camera.updateMatrixWorld(true); d._hudUpdate(0.1); g.updateClock(0);
                for (let i = 0; i < 3; i++) g.drawFrame();
                const ray = new THREE.Raycaster(camera, f.mesh.position.clone().sub(camera).normalize());
                const hits = ray.intersectObjects(g.scene.children, true);
                const center = f.mesh.position.clone().project(g.camera), edge = f.mesh.position.clone().add(new THREE.Vector3(0.115, 0, 0)).project(g.camera);
                return { view, camera: camera.toArray(), firstHit: hits[0]?.object.name, ballColor: f.mesh.material.color.getHexString(), winter: f.winter, pixelsRadius: Math.hypot((center.x - edge.x) * 768, (center.y - edge.y) * 432), stats: { ...g.r3d.stats } };
            };
            return result;
        });
        check('whole pitch and goal approaches clear for drone/car/walker bodies', report.play.blocked.length === 0, { samples: report.play.collisionSamples, blocked: report.play.blocked });
        check('continuous Normal-mode controller paths and descents', report.play.paths.every(p => p.pass), report.play.paths);
        check('physical stands remain solid', report.play.stands.length >= 10 && report.play.stands.every(s => s.push > 0.01 && s.groundSolid), report.play.stands);
        check('roof collision is confined to its actual height band', report.play.roofs.length > 0 && report.play.roofs.every(r => r.groundClear && r.below === 0 && r.at > 0.01 && r.above === 0), report.play.roofs);
        check('unrelated district boundary still blocks', report.play.boundary?.push > 0.01, report.play.boundary);
        check('actual Normal-mode drone scores in both goals', report.play.goals.every(g => g.scored) && report.play.unlocked && report.play.saved, report.play.goals);
        check('regulation ball and small rendering cost', report.play.ballRadius === 0.115 && report.play.ballTriangles + report.play.contactTriangles <= 220, { radius: report.play.ballRadius, triangles: report.play.ballTriangles + report.play.contactTriangles });
        await page.waitForFunction(() => !document.querySelector('#loading').classList.contains('show') && Number(getComputedStyle(document.querySelector('#loading')).opacity) === 0, null, { polling: 50 });
        report.views = [];
        for (const weather of ['clear', 'snow']) {
            await page.evaluate(weather => { const g = game; g.setRoamWeather(weather); g.setRoamSeason(weather === 'snow' ? 'winter' : 'summer'); for (let i = 0; i < 100; i++) g.r3d._updateWeather(0.1, g.camera.position, g.camera.position.clone().set(0, 0, 0)); }, weather);
            for (const view of ['close', 'overhead', 'wide']) {
                const evidence = await page.evaluate(view => dinamoRender(view), view); evidence.weather = weather; report.views.push(evidence);
                if (option('screenshots', 'all') !== 'none') await page.screenshot({ path: path.join(out, `${weather}-${view}.png`), timeout: 120000 });
            }
        }
        check('ball unobstructed at close, overhead and wide weather views', report.views.every(v => v.firstHit === 'dinamo-football'), report.views.map(({ weather, view, firstHit, ballColor, pixelsRadius }) => ({ weather, view, firstHit, ballColor, pixelsRadius })));
        check('snow uses high-visibility winter panels', report.views.filter(v => v.weather === 'snow').every(v => v.winter && v.ballColor === 'ff982b'), report.views.filter(v => v.weather === 'snow').map(v => v.ballColor));
        check('drone weather views within frame budget', report.views.every(v => v.stats.triangles <= 1500000 && v.stats.drawCalls <= 400), report.views.map(v => ({ weather: v.weather, view: v.view, stats: v.stats })));
        await page.reload({ waitUntil: 'commit', timeout: 90000 }); await page.waitForFunction(() => window.game?.achievements, null, { polling: 50, timeout: 120000 });
        report.persisted = await page.evaluate(() => game.achievements.isUnlocked('dinamo-drone-goal')); check('goal achievement survives reload', report.persisted);
        report.lifecycle = await page.evaluate(async () => { const g = game; await g.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear' }); const old = g.football; await g.loadCity('bucharest', { district: 'romana' }); return { disposed: old.disposed, detached: !old.mesh.parent && !old.contact.parent, noBall: g.football === null }; });
        check('district replacement disposes ball and contact resources', Object.values(report.lifecycle).every(Boolean), report.lifecycle);
        check('zero browser errors', report.errors.length === 0 && report.consoleErrors.length === 0, { errors: report.errors, consoleErrors: report.consoleErrors });
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
        for (const c of report.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
        console.log(`${report.checks.filter(c => c.pass).length}/${report.checks.length} Dinamo checks passed; ${out}`);
        assert.ok(report.checks.every(c => c.pass), 'Dinamo acceptance failed; inspect results.json');
    } finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
