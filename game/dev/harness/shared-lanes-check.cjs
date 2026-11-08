#!/usr/bin/env node
// Real Traffic movement/meshes on a controlled one-lane graph, without an expensive unrelated world build.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const arg = (name, fallback) => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback;
const root = path.resolve(arg('root', path.join(__dirname, '../../..'))), out = path.resolve(arg('out', '/tmp/shared-lanes-check'));
async function fixture() {
    const THREE = await import('/game/vendor/three.module.min.js');
    const { Traffic } = await import('/game/src/traffic.js');
    const nodes = [-1000, 0, 40, 80, 1080].map((x, id) => ({ x, z: 0, y: 0, id, edges: [], radius: 3 }));
    const edges = [];
    const edge = (a, b, sharedLane = false) => {
        const e = { id: edges.length, a: nodes[a], b: nodes[b], sharedLane, sharedLaneWidthM: 3.2, dirx: Math.sign(b - a), dirz: 0, nx: 0, nz: Math.sign(b - a), len: Math.abs(nodes[b].x - nodes[a].x), lanes: 2, lanesF: 1, lanesB: 1, laneW: sharedLane ? 1.6 : 3.2, median: 0, wR: sharedLane ? 1.6 : 3.2, wL: sharedLane ? 1.6 : 3.2, halfW: sharedLane ? 1.6 : 3.2, sidewalk: 0, oneway: false, type: 'residential', name: 'Controlled shared-lane fixture', speed: 8, maxspeed: 8, layer: 0, main: true, drivable: true, ya: 0, yb: 0 };
        e.a.edges.push(e); e.b.edges.push(e); edges.push(e); return e;
    };
    edge(0, 1); edge(1, 2, true); edge(3, 2, true); edge(3, 4);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b9c9d4');
    scene.add(new THREE.HemisphereLight('#ffffff', '#879180', 2));
    const sun = new THREE.DirectionalLight('#fff2d7', 2); sun.position.set(10, 30, 5); scene.add(sun);
    for (const e of edges) { const road = new THREE.Mesh(new THREE.BoxGeometry(Math.min(e.len, 130), .1, e.wR + e.wL), new THREE.MeshStandardMaterial({ color: e.sharedLane ? '#263743' : '#46535b' })); road.position.set(e.sharedLane ? (e.a.x + e.b.x) / 2 : e.id === 0 ? -65 : 145, 0, 0); scene.add(road); }
    const world = { graph: { nodes, edges }, bounds: { minX: -1100, maxX: 1180, minZ: -20, maxZ: 20 }, pois: [], lights: [], areas: [], data: {}, buildings: [], walkTop: () => 0, isWater: () => false, district: { inside: () => true } };
    const city = { id: 'bucharest', traffic: { density: 0, parkedChance: 0, chaos: 0, trams: false } };
    const traffic = new Traffic(world, city, scene, { maxVehicles: 2, maxPeds: 0 });
    if (traffic.vehicles.length) throw new Error('Fixture unexpectedly spawned ambient vehicles');
    const longBodies = new URL(location.href).searchParams.has('long');
    const west = traffic.spawn({ edge: edges[0], dir: 1, lane: 0, s: 970, kind: longBodies ? 'bus' : 'sedan' });
    const east = traffic.spawn({ edge: edges[3], dir: -1, lane: 0, s: 970, kind: longBodies ? 'bus' : 'hatch' });
    west.route = [{ e: edges[1], dir: 1 }, { e: edges[2], dir: -1 }, { e: edges[3], dir: 1 }];
    east.route = [{ e: edges[2], dir: 1 }, { e: edges[1], dir: -1 }, { e: edges[0], dir: -1 }];
    for (const v of [west, east]) { v.speed = 4; v.desiredMul = 1; traffic.placeOnLane(v, true, 0); }
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(960, 360); document.body.append(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(40, 960 / 360, .1, 500); camera.position.set(40, 65, 90); camera.lookAt(40, 0, 0);
    const report = { longBodies, bodyLengths: [west.length, east.length], samples: [], contacts: [], offRoad: [], conflicts: [], teleports: [], stoppedSlides: [], traversed: { west: false, east: false }, waitFrames: { west: 0, east: 0 }, fixture: 'two opposing Traffic vehicles; two continuous shared edges, one source-order reversed; ordinary two-way feeders', frame: 0 };
    window.stepShared = count => {
        for (let i = 0; i < count; i++) {
            const old = new Map([west, east].map(v => [v, { x: v.x, z: v.z, speed: v.speed }]));
            traffic.update(1 / 30); report.frame++;
            const axes = [west, east].flatMap(v => [[-Math.sin(v.heading), -Math.cos(v.heading)], [Math.cos(v.heading), -Math.sin(v.heading)]]);
            const support = (v, x, z) => Math.abs(-Math.sin(v.heading) * x - Math.cos(v.heading) * z) * v.length / 2 + Math.abs(Math.cos(v.heading) * x - Math.sin(v.heading) * z) * v.width / 2;
            const overlap = Math.min(...axes.map(([x,z])=>support(west,x,z)+support(east,x,z)-Math.abs((west.x-east.x)*x+(west.z-east.z)*z)));
            if (overlap > .001) report.contacts.push({ frame: report.frame, overlap });
            if (west.edge.sharedLane && east.edge.sharedLane) report.conflicts.push(report.frame);
            for (const [label, v] of [['west', west], ['east', east]]) {
                const before = old.get(v), moved = Math.hypot(v.x - before.x, v.z - before.z);
                if (moved > Math.max(before.speed, v.speed) / 30 * 1.11 + .03) report.teleports.push({ frame: report.frame, label, moved });
                if (before.speed === 0 && v.speed === 0 && moved > 1e-6) report.stoppedSlides.push({ frame: report.frame, label, moved });
                if (v.edge.sharedLane && v.s > v.length / 2 + 3 && v.s < v.edge.len - v.length / 2 - 3 && Math.abs(v.z) + support(v, 0, 1) > 1.61) report.offRoad.push({ frame: report.frame, label, z: v.z });
                if (v.stopWhy === 'shared-lane' && v.speed < .1) report.waitFrames[label]++;
                if (label === 'west' && v.edge === edges[3] && v.s > 12 || label === 'east' && v.edge === edges[0] && v.s > 12) report.traversed[label] = true;
            }
            if (report.frame % 30 === 0) report.samples.push({ seconds: report.frame / 30, west: { x: west.x, z: west.z, speed: west.speed, edge: west.edge.id, why: west.stopWhy }, east: { x: east.x, z: east.z, speed: east.speed, edge: east.edge.id, why: east.stopWhy } });
        }
        renderer.render(scene, camera); return structuredClone(report);
    };
    window.fixtureReady = true;
}
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const html = '<!doctype html><meta charset="utf-8"><title>Traffic shared-lane regression</title><style>body{margin:0;background:#b9c9d4}canvas{display:block;width:100%;height:auto}</style><script type="module">(' + fixture.toString() + ')().catch(error=>{window.fixtureError=String(error.stack||error)});</script>';
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
        if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
        const file = path.resolve(root, '.' + pathname);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        try { res.setHeader('Content-Type', path.extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const errors = [], browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 960, height: 360 } }); page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/fixture' + (process.argv.includes('--long') ? '?long=1' : ''));
        await page.waitForFunction(() => window.fixtureReady || window.fixtureError, null, { timeout: 120000 });
        assert.equal(await page.evaluate(() => window.fixtureError), undefined);
        const first = await page.evaluate(() => window.stepShared(300));
        await page.screenshot({ path: path.join(out, 'yielding.png') });
        const final = await page.evaluate(() => window.stepShared(2100));
        await page.screenshot({ path: path.join(out, 'cleared.png') });
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ root, first, final, errors }, null, 2));
        assert.deepEqual(errors, []); assert.equal(final.contacts.length, 0); assert.equal(final.offRoad.length, 0); assert.equal(final.conflicts.length, 0); assert.equal(final.teleports.length, 0); assert.equal(final.stoppedSlides.length, 0);
        assert.equal(final.traversed.west, true); assert.equal(final.traversed.east, true);
        assert.ok(final.waitFrames.west + final.waitFrames.east > 30);
        console.log('PASS: both native Traffic vehicles traverse, opposing entry yields, no conflict/teleport/stationary slide.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
