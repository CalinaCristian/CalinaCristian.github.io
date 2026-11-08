#!/usr/bin/env node
// Exercise actual Game pose/reset methods on controlled asymmetric edge contracts.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname, file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'missing' : bytes); });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
        await page.goto(`http://127.0.0.1:${server.address().port}/game/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        const rows = await page.evaluate(async () => {
            const { laneOffset } = await import('/game/src/traffic.js'), rows = [], fake = Object.create(Object.getPrototypeOf(game));
            const a = { id: 0, x: 0, z: 0, edges: [] }, b = { id: 1, x: 100, z: 0, edges: [] };
            const e = { a, b, len: 100, dirx: 1, dirz: 0, nx: 0, nz: 1, lanesF: 1, lanesB: 3, laneW: 3, median: 0,
                laneCenterShiftM: 7, wR: 10, wL: 2, type: 'primary', main: true, ya: 0, yb: 0 };
            a.edges = b.edges = [e];
            fake.nav = { index: { nearest: () => ({ edge: e, cx: 50, cz: 0, t: .5, d: 0 }), near: () => [e] } };
            fake.traffic = { laneOffset }; fake.spotFree = () => true; fake.hud = { toast() {} };
            const check = (name, pose, expected) => rows.push({ name, actual: pose.z, expected, pass: Math.abs(pose.z - expected) < 1e-8 });
            check('roadPose forward', fake.roadPose(50, 0, 1), 8.5);
            check('roadPose reverse on canonical right', fake.roadPose(50, 0, -1), 5.5);
            check('lanePose forward', fake.lanePose(50, 0, -Math.PI / 2), 8.5);
            check('lanePose reverse outer lane', fake.lanePose(50, 0, Math.PI / 2), -.5);
            check('route reverse outer lane', fake.poseAlongRoute({ points: [[100, 0], [0, 0]], cum: [0, 100], legs: [{ e, dir: -1 }] }, 50), -.5);
            fake.player = { place(x, z) { this.z = z; } };
            fake.placeSpawn({ spawn: { edge: [0, 1], t: .5, dir: -1 } }, { graph: { edges: [e] } });
            check('city spawn reverse', fake.player, 5.5);
            for (const [z, expected] of [[-1, -3.5], [1, 11.5]]) {
                fake.state = 'foot'; fake.foot = { x: 50, z, teleport(x, z) { this.z = z; } };
                fake.resetPosition(); check('foot reset source side ' + Math.sign(z), fake.foot, expected);
            }
            Object.assign(e, { sharedLane: true, sharedLaneWidthM: 3.2, laneCenterShiftM: 1, wR: 2.6, wL: .6, lanesB: 1, type: 'service' });
            for (const dir of [1, -1]) {
                check('shared roadPose ' + dir, fake.roadPose(50, 0, dir), 1);
                check('shared fallback lanePose ' + dir, fake.lanePose(50, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2), 1);
            }
            return rows;
        });
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ root, method: 'Actual Game prototype methods, controlled edge contracts; RAF disabled, no world/geometry fidelity claim.', rows, errors }, null, 2));
        assert.deepEqual(errors, []); assert.equal(rows.length, 12); assert(rows.every(r => r.pass));
        console.log('PASS: 12 native Game lane pose, spawn, route and foot reset cases.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
