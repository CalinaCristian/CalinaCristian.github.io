#!/usr/bin/env node
// Real loaded-world/controller acceptance; static server + muted Chromium, no animation loop.
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const root = path.resolve(option('root', path.join(__dirname, '../../..'))), out = path.resolve(option('out', '/tmp/drone-flight-check'));
fs.mkdirSync(out, { recursive: true });
(async () => {
    const server = http.createServer((req, res) => {
        let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
        fs.readFile(f, (error, data) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream' }[path.extname(f)] || 'application/octet-stream' }); res.end(error ? 'missing' : data); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const report = { root, districts: [], spots: [], errors: [], consoleErrors: [] };
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        await context.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`); await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        for (const id of option('districts', 'floreasca,grozavesti,unirii,romana,pipera,otopeni,seatac,bellevue').split(',').filter(id => id !== 'none')) {
            const result = await page.evaluate(async id => {
                const g = game; await g.startFreeRoam(id, { tod: 'noon', weather: 'clear', season: 'summer' }); g.audio.setMuted(true); g.exitCar();
                const d = g.explore.drone, w = g.world, b = d.ctx().boundary;
                if (!b) throw new Error(`${id}: missing exact playable flight boundary`);
                const candidates = w.walls.filter(e => e.kind === 'boundary').sort((a, b) => Math.hypot(b.bx - b.ax, b.bz - b.az) - Math.hypot(a.bx - a.ax, a.bz - a.az));
                let edge = null, home = null;
                for (const e of candidates) {
                    const p = { x: (e.ax + e.bx) / 2 + e.nx * 60, z: (e.az + e.bz) / 2 + e.nz * 60 };
                    if (!w.district.inside(p.x, p.z)) continue;
                    Object.assign(g.foot, { ...p, y: 0, heading: Math.atan2(e.nx, e.nz) });
                    if (!d.canDeploy().ok) continue; edge = e; home = p; break;
                }
                if (!edge) throw new Error(`${id}: no open-sky boundary fixture`);
                const beyond = { x: (edge.ax + edge.bx) / 2 - edge.nx * 25, z: (edge.az + edge.bz) / 2 - edge.nz * 25 };
                Object.assign(g.foot, beyond); const outsideDistance = b.sample(beyond.x, beyond.z).distance, refused = !d.canDeploy().ok;
                Object.assign(g.foot, home); if (!d.deploy()) throw new Error('Deploy failed'); d.t = 3; d._lift(0.05);
                const cases = [];
                for (const altitude of [60, 110]) for (const mode of [1, 2]) {
                    d.phase = 'fly'; d.rth = false; d.battery = 1; d.mode = mode; d.pos.set(home.x, altitude, home.z); d.vel.set(0, 0, 0); d.yaw = Math.atan2(edge.nx, edge.nz);
                    g.input.keys.clear(); g.input.keys.add('KeyW'); if (mode === 2) g.input.keys.add('ShiftLeft');
                    let maxOutside = 0, maxRange = 0, maxY = 0;
                    for (let i = 0; i < 350; i++) { d._fly(0.05); maxOutside = Math.max(maxOutside, b.sample(d.pos.x, d.pos.z).distance); maxRange = Math.max(maxRange, Math.hypot(d.pos.x - home.x, d.pos.z - home.z)); maxY = Math.max(maxY, d.pos.y); }
                    g.input.keys.clear(); const stoppedSpeed = Math.abs(d.vel.x * edge.nx + d.vel.z * edge.nz), endOutside = b.sample(d.pos.x, d.pos.z).distance;
                    d.battery = mode === 1 && altitude === 60 ? 0.01 : 1; d.returnHome(); const routed = !!d.rth; let frames = 0;
                    for (; frames < 5000 && d.phase === 'fly'; frames++) { d._fly(0.05); maxOutside = Math.max(maxOutside, b.sample(d.pos.x, d.pos.z).distance); maxRange = Math.max(maxRange, Math.hypot(d.pos.x - home.x, d.pos.z - home.z)); }
                    cases.push({ altitude, mode, maxOutside, endOutside, maxRange, maxY, stoppedSpeed, routed, returnFrames: frames, phase: d.phase, pass: maxOutside <= 20.00001 && endOutside > 19 && stoppedSpeed < 0.01 && maxRange <= 800.00001 && routed && d.phase === 'dock' });
                }
                // A real concavity is exercised with the actual RTH controller, not position-only assertions.
                d.phase = 'fly'; d.rth = false; d.battery = 1; d.pos.set(home.x, 110, home.z); d.vel.set(0, 0, 0);
                const nodes = Object.values(w.graph.nodes).filter(n => Math.hypot(n.x - home.x, n.z - home.z) > 150 && Math.hypot(n.x - home.x, n.z - home.z) < 750 && w.district.inside(n.x, n.z));
                let concavity = { present: false };
                for (const n of nodes) {
                    if (b.segmentAllowed(n, home)) continue;
                    const route = b.route(n, home, { home, range: 800 }); if (!route) continue;
                    d.pos.set(n.x, 110, n.z); d.vel.set(0, 0, 0); d.returnHome(); let frames = 0, maxOutside = 0;
                    for (; frames < 8000 && d.phase === 'fly'; frames++) { d._fly(0.05); maxOutside = Math.max(maxOutside, b.sample(d.pos.x, d.pos.z).distance); }
                    concavity = { present: true, legs: route.length, frames, phase: d.phase, maxOutside, start: { x: n.x, z: n.z }, pass: d.phase === 'dock' && maxOutside <= 20.00001 }; break;
                }
                const result = { id, segments: w.district.flightBoundary.segments.length, outsideDistance, refused, home, edge: { ax: edge.ax, az: edge.az, bx: edge.bx, bz: edge.bz, nx: edge.nx, nz: edge.nz }, cases, concavity };
                d.abort(); return result;
            }, id);
            report.districts.push(result); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
            console.log(`${result.cases.every(c => c.pass) && (!result.concavity.present || result.concavity.pass) && result.refused ? 'PASS' : 'FAIL'} ${id}: ${result.cases.filter(c => c.pass).length}/4 mode/height flights; concavity ${result.concavity.present ? result.concavity.phase : 'none at fixture'}`);
        }
        for (const id of option('spots', '').split(',').filter(Boolean)) {
            const result = await page.evaluate(async id => {
                const g = game; if (!await g.enterSpot(id)) throw new Error(`Cannot load ${id}`); g.audio.setMuted(true);
                const d = g.explore.drone, sp = g.spot.spot, walker = g.spot.ctl, b = d.ctx().boundary;
                const polygons = sp.data.members.map(id => sp.data.spots[id].extent.polygon), edges = polygons.flatMap(poly => poly.map((a, i) => [a, poly[(i + 1) % poly.length]]));
                edges.sort(([a, b], [c, d]) => Math.hypot(d[0] - c[0], d[1] - c[1]) - Math.hypot(b[0] - a[0], b[1] - a[1]));
                let home, outside, direction;
                for (const [a, z] of edges) {
                    const dx = z[0] - a[0], dz = z[1] - a[1], length = Math.hypot(dx, dz), mx = (a[0] + z[0]) / 2, mz = (a[1] + z[1]) / 2;
                    for (const sign of [-1, 1]) {
                        const nx = -dz / length * sign, nz = dx / length * sign, p = { x: mx + nx * 25, z: mz + nz * 25 };
                        if (b.sample(p.x, p.z).distance < 24.9) continue;
                        for (const inset of [10, 25, 60]) {
                            const q = { x: mx - nx * inset, z: mz - nz * inset }; if (b.sample(q.x, q.z).distance > 0) continue;
                            const y = sp.groundAt(q.x, q.z, sp.ground.heightAt(q.x, q.z) + 1);
                            Object.assign(walker, { ...q, y, heading: Math.atan2(-nx, -nz) });
                            if (d.canDeploy().ok) { home = { ...q, y }; outside = p; direction = { x: nx, z: nz }; break; }
                        }
                        if (home) break;
                    }
                    if (home) break;
                }
                if (!home) throw new Error(`${id}: no open-sky edge fixture`);
                Object.assign(walker, outside); const refused = !d.canDeploy().ok; Object.assign(walker, home);
                if (!d.deploy()) throw new Error(`${id}: deploy failed`); d.t = 3; d._lift(0.05); d.pos.set(home.x, home.y + 110, home.z); d.vel.set(0, 0, 0); d.mode = 2; d.yaw = Math.atan2(-direction.x, -direction.z);
                g.input.keys.clear(); g.input.keys.add('KeyW'); g.input.keys.add('ShiftLeft'); let maxOutside = 0, maxRange = 0;
                for (let i = 0; i < 350; i++) { d._fly(0.05); maxOutside = Math.max(maxOutside, b.sample(d.pos.x, d.pos.z).distance); maxRange = Math.max(maxRange, Math.hypot(d.pos.x - home.x, d.pos.z - home.z)); }
                g.input.keys.clear(); const endOutside = b.sample(d.pos.x, d.pos.z).distance; d.battery = 0.01; d.returnHome(); const routed = d.rth; let frames = 0;
                for (; frames < 5000 && d.phase === 'fly'; frames++) { d._fly(0.05); maxOutside = Math.max(maxOutside, b.sample(d.pos.x, d.pos.z).distance); }
                const result = { id, members: sp.data.members, refused, maxOutside, maxRange, endOutside, routed, frames, phase: d.phase, pass: refused && maxOutside <= 20.00001 && maxRange <= 450.00001 && endOutside > 19 && routed && d.phase === 'dock' };
                d.abort(); g.leaveSpot(); return result;
            }, id);
            report.spots.push(result); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); console.log(`${result.pass ? 'PASS' : 'FAIL'} spot ${id}: ${result.members.length} declared member extents, boosted Sport110m, reserve-battery return ${result.phase}`);
        }
        assert(report.spots.every(r => r.pass), 'Spot boundary acceptance failed');
        assert(report.districts.every(r => r.refused && r.cases.every(c => c.pass) && (!r.concavity.present || r.concavity.pass)), 'Controller boundary acceptance failed');
        assert.equal(report.errors.length, 0); assert.equal(report.consoleErrors.length, 0);
        console.log(`${report.districts.length} districts passed, zero browser errors; ${out}`);
    } finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
