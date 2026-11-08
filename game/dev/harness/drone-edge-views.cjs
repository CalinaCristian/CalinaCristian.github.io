#!/usr/bin/env node
// Inspect the rendered 150m flight edge and the complete Dinamo model without
// changing fog, culling, source geometry or the production flight constraints.
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const root = path.resolve(option('root', path.join(__dirname, '../../..'))), out = path.resolve(option('out', '/tmp/drone-edge-views'));
fs.mkdirSync(out, { recursive: true });
(async () => {
    const server = http.createServer((req, res) => {
        let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
        fs.readFile(f, (error, data) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream' }[path.extname(f)] || 'application/octet-stream' }); res.end(error ? 'missing' : data); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, districts: [], stadium: null, views: [], errors: [], consoleErrors: [] };
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`); await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        for (const id of option('districts', 'floreasca,grozavesti,unirii,romana,pipera,otopeni,seatac,bellevue').split(',')) {
            const fixture = await page.evaluate(async id => {
                const g = game; await g.startFreeRoam(id, { tod: 'noon', weather: 'clear', season: 'summer' }); g.audio.setMuted(true); g.exitCar(); g.r3d.setQuality('high');
                const d = g.explore.drone, b = d.ctx().boundary;
                const edges = g.world.walls.filter(e => e.kind === 'boundary').sort((a, b) => Math.hypot(b.bx - b.ax, b.bz - b.az) - Math.hypot(a.bx - a.ax, a.bz - a.az));
                for (const e of edges) {
                    const mx = (e.ax + e.bx) / 2, mz = (e.az + e.bz) / 2, p = { x: mx + e.nx * 60, z: mz + e.nz * 60 };
                    if (!g.world.district.inside(p.x, p.z)) continue;
                    Object.assign(g.foot, { ...p, y: 0, heading: Math.atan2(e.nx, e.nz) });
                    if (!d.canDeploy().ok || b.sample(mx - e.nx * 149.999, mz - e.nz * 149.999).distance < 149.9) continue;
                    d.deploy(); d.t = 3; d._lift(0.05);
                    window.edgeFixture = { x: mx - e.nx * 149.999, z: mz - e.nz * 149.999, yaw: Math.atan2(e.nx, e.nz) };
                    break;
                }
                if (!d.active) throw new Error(`${id}: no edge fixture`);
                window.droneRenderView = ({ x, y, z, yaw, pitch, target }) => {
                    d.pos.set(x, y, z); d.vel.set(0, 0, 0); d.yaw = yaw || 0; d.gimbal = pitch || 0; d.rth = false; d.battery = 1;
                    d._collide(d.c, true); d.c.boundary.constrain(d.pos, d.vel);
                    g.camera.position.copy(d.pos); g.camera.quaternion.copy(d._droneQuat(false)); if (target) g.camera.lookAt(...target); g.camera.updateMatrixWorld(true);
                    d.proxy.x = d.pos.x; d.proxy.z = d.pos.z; d._hudUpdate(0.1); g.updateClock(0);
                    for (let i = 0; i < 3; i++) { g.renderer.info.reset(); g.drawFrame({ mirror: true }); }
                    return { position: d.pos.toArray(), outside: d.c.boundary.sample(d.pos.x, d.pos.z).distance, allowed: d.c.boundary.allowed(d.pos), range: Math.hypot(d.pos.x - d.home.x, d.pos.z - d.home.z), stats: { ...g.r3d.stats } };
                };
                return { id, ...edgeFixture };
            }, id);
            await page.waitForFunction(() => !document.querySelector('#loading').classList.contains('show') && Number(getComputedStyle(document.querySelector('#loading')).opacity) === 0, null, { polling: 50 });
            for (const view of ['outward110m', 'inward110m', 'outward12m']) {
                const pose = { ...fixture, y: view === 'outward12m' ? 12 : 110, yaw: fixture.yaw + (view === 'inward110m' ? Math.PI : 0), pitch: view === 'outward12m' ? -0.15 : -0.25 };
                const evidence = await page.evaluate(pose => droneRenderView(pose), pose);
                report.views.push({ id, view, ...evidence }); await page.screenshot({ path: path.join(out, `${id}-${view}.png`) });
            }
            report.districts.push(fixture); await page.evaluate(() => game.explore.drone.abort());
            fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); console.log(`Captured ${id}: three edge views`);
        }
        report.stadium = await page.evaluate(async () => {
            const g = game; await g.startFreeRoam('floreasca', { tod: 'noon', weather: 'clear', season: 'summer' }); g.audio.setMuted(true); g.exitCar(); g.r3d.setQuality('high');
            const THREE = await import('./vendor/three.module.min.js'), d = g.explore.drone, f = g.football, mesh = f.source;
            mesh.updateWorldMatrix(true, true);
            // Independent per-vertex transform, rather than reusing world.js's Box3.
            const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], p = new THREE.Vector3(); let vertices = 0, rejected = 0;
            mesh.traverse(o => { const position = o.geometry?.attributes?.position; if (!position) return; for (let i = 0; i < position.count; i++) { p.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld); vertices++; for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p.getComponent(j)); hi[j] = Math.max(hi[j], p.getComponent(j)); } if (!d.ctx().boundary.allowed(p)) rejected++; } });
            const center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
            const pitch = f.source.localToWorld(new THREE.Vector3(...f.pitch.center)); Object.assign(g.foot, { x: pitch.x, z: pitch.z, y: pitch.y, heading: 0 });
            if (!d.deploy()) throw new Error(d.canDeploy().reason); d.t = 3; d._lift(0.05);
            // Reinstall the view helper for the newly deployed controller context.
            window.stadiumBounds = { lo, hi, center };
            const area = g.world.district.flightBoundary.landmarkAreas?.find(a => a.id === 'dinamo');
            const corners = [];
            for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) corners.push({ x, z, distance: d.c.boundary.sample(x, z).distance });
            return { vertices, rejected, lo, hi, center, area, corners };
        });
        await page.waitForFunction(() => !document.querySelector('#loading').classList.contains('show') && Number(getComputedStyle(document.querySelector('#loading')).opacity) === 0, null, { polling: 50 });
        for (const side of ['north', 'east', 'south', 'west']) {
            const evidence = await page.evaluate(side => {
                const { lo, hi, center } = stadiumBounds, d = game.explore.drone;
                const x = side === 'east' ? hi[0] + 149.999 : side === 'west' ? lo[0] - 149.999 : center[0], z = side === 'south' ? hi[2] + 149.999 : side === 'north' ? lo[2] - 149.999 : center[2];
                // The helper resolves the current drone after the district replacement.
                const g = game; d.pos.set(x, 110, z); d.vel.set(0, 0, 0); g.camera.position.copy(d.pos); g.camera.lookAt(...center); g.camera.updateMatrixWorld(true); d.proxy.x = x; d.proxy.z = z; d._hudUpdate(0.1); g.updateClock(0);
                for (let i = 0; i < 3; i++) { g.renderer.info.reset(); g.drawFrame({ mirror: true }); }
                const projected = []; for (const px of [lo[0], hi[0]]) for (const py of [lo[1], hi[1]]) for (const pz of [lo[2], hi[2]]) { const p = d.pos.clone().set(px, py, pz).project(g.camera); projected.push({ x: p.x, y: p.y, z: p.z }); }
                return { position: d.pos.toArray(), outside: d.c.boundary.sample(x, z).distance, allowed: d.c.boundary.allowed(d.pos), range: Math.hypot(x - d.home.x, z - d.home.z), wholeModelInFrame: projected.every(p => Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1), projected, stats: { ...g.r3d.stats } };
            }, side);
            report.views.push({ id: 'dinamo', view: side, ...evidence }); await page.screenshot({ path: path.join(out, `dinamo-${side}-whole.png`) });
        }
        const viewsPass = report.views.every(v => v.allowed && v.range <= 800.00001 && v.stats.triangles <= 1500000 && v.stats.drawCalls <= 400);
        assert(report.stadium.vertices > 0 && report.stadium.rejected === 0 && report.stadium.area && report.stadium.corners.every(c => c.distance < 0.001), 'Full stadium footprint not contained');
        assert(report.views.filter(v => v.id === 'dinamo').every(v => v.wholeModelInFrame), 'Full stadium not visible from one of the legal edge views');
        assert(viewsPass, 'Edge frame exceeded flight or performance constraints'); assert.equal(report.errors.length, 0); assert.equal(report.consoleErrors.length, 0);
        console.log(`${report.views.length} views captured; all stadium geometry, flight and render budgets pass; ${out}`);
    } finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
