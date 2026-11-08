#!/usr/bin/env node
// Real Traffic movement/meshes on a controlled one-lane graph, without an expensive unrelated world build.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const arg = (name, fallback) => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback;
const root = path.resolve(arg('root', path.join(__dirname, '../../..'))), out = path.resolve(arg('out', '/tmp/shared-lanes-check'));
async function fixture() {
    const THREE = await import('/game/vendor/three.module.min.js');
    const { Traffic, playerPen } = await import('/game/src/traffic.js');
    const params = new URL(location.href).searchParams, mode = params.get('case') || params.get('branch') || 'straight';
    const longBodies = params.has('long');
    const nodes = [-1000, 0, 40, 80, 1080].map((x, id) => ({ x, z: 0, y: 0, id, edges: [], radius: 3 }));
    const node = (x, z) => { nodes.push({ x, z, y: 0, id: nodes.length, edges: [], radius: 3 }); return nodes.length - 1; };
    const edges = [];
    const edge = (a, b, sharedLane = false) => {
        const len = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].z - nodes[a].z), dirx = (nodes[b].x - nodes[a].x) / len, dirz = (nodes[b].z - nodes[a].z) / len;
        const e = { id: edges.length, a: nodes[a], b: nodes[b], sharedLane, sharedLaneWidthM: 3.2, dirx, dirz, nx: -dirz, nz: dirx, len, lanes: 2, lanesF: 1, lanesB: 1, laneW: sharedLane ? 1.6 : 3.2, median: 0, wR: sharedLane ? 1.6 : 3.2, wL: sharedLane ? 1.6 : 3.2, halfW: sharedLane ? 1.6 : 3.2, sidewalk: 0, oneway: false, type: 'residential', name: 'Controlled shared-lane fixture', speed: 8, maxspeed: 8, layer: 0, main: true, drivable: true, ya: 0, yb: 0 };
        e.a.edges.push(e); e.b.edges.push(e); edges.push(e); return e;
    };
    edge(0, 1); edge(1, 2, true); edge(3, 2, true); edge(3, 4);
    if (['private', 'public', 'light'].includes(mode)) {
        const e = edge(mode === 'light' ? 1 : 2, node(mode === 'light' ? 0 : 40, 1000));
        if (mode === 'private') e.publicDrive = false;
        if (mode === 'light') nodes[1].hasLight = true;
    }
    if (mode === 'narrow') { edge(2, node(40, 40), true); edge(5, node(40, 1040)); }
    if (mode === 'cycle') { edge(1, node(0, 40), true); edge(5, node(80, 40), true); edge(6, 3, true); }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b9c9d4');
    scene.add(new THREE.HemisphereLight('#ffffff', '#879180', 2));
    const sun = new THREE.DirectionalLight('#fff2d7', 2); sun.position.set(10, 30, 5); scene.add(sun);
    for (const e of edges) {
        const shown = Math.min(e.len, 130), s = e.len <= 130 ? e.len / 2 : e.id === 0 ? e.len - shown / 2 : shown / 2;
        const road = new THREE.Mesh(new THREE.BoxGeometry(shown, .1, e.wR + e.wL), new THREE.MeshStandardMaterial({ color: e.sharedLane ? '#263743' : '#46535b' }));
        road.position.set(e.a.x + e.dirx * s, 0, e.a.z + e.dirz * s); road.rotation.y = -Math.atan2(e.dirz, e.dirx); scene.add(road);
    }
    const world = { graph: { nodes, edges }, bounds: { minX: -1100, maxX: 1180, minZ: -20, maxZ: 1080 }, pois: [], lights: [], areas: [], data: {}, buildings: [], walkTop: () => 0, isWater: () => false, district: { inside: () => true } };
    const city = { id: 'bucharest', traffic: { density: 0, parkedChance: 0, chaos: 0, trams: false } };
    const traffic = new Traffic(world, city, scene, { maxVehicles: 4, maxPeds: 0 });
    if (traffic.vehicles.length) throw new Error('Fixture unexpectedly spawned ambient vehicles');
    const vehicles = [];
    const spawn = (label, edge, dir, route, s = 970) => {
        const v = traffic.spawn({ edge, dir, lane: 0, s, kind: longBodies ? 'bus' : label === 'east' ? 'hatch' : 'sedan' });
        v.route = route.map(([id, dir]) => ({ e: edges[id], dir })); v.speed = 4; v.desiredMul = 1; traffic.placeOnLane(v, true, 0);
        vehicles.push({ label, v, exit: v.route.at(-1).e }); return v;
    };
    spawn('west', edges[0], 1, [[1, 1], [2, -1], [3, 1]]);
    spawn('east', edges[3], -1, [[2, 1], [1, -1], [0, -1]]);
    if (mode === 'narrow') spawn('third', edges[5], -1, [[4, -1], [2, -1], [3, 1]]);
    if (mode === 'platoon') spawn('follower', edges[0], 1, [[1, 1], [2, -1], [3, 1]], 945);
    if (mode === 'cycle') vehicles[0].v.route = [[4, 1], [5, 1], [6, 1], [3, 1]].map(([id, dir]) => ({ e: edges[id], dir }));
    const player = mode === 'player' ? { x: 40, z: 0, fx: -1, fz: 0, y: .24, front: 3.42, rear: 2.36, length: 5.78, width: 1.8, speed: 0 } : null;
    traffic.player = player;
    const playerMesh = player && new THREE.Mesh(new THREE.BoxGeometry(player.length, 1.4, player.width), new THREE.MeshStandardMaterial({ color: '#e5c251' }));
    if (playerMesh) scene.add(playerMesh);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(960, 360); document.body.append(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(40, 960 / 360, .1, 500); camera.position.set(40, 95, 140); camera.lookAt(40, 0, 15);
    const report = { mode, longBodies, bodyLengths: vehicles.map(({ v }) => v.length), samples: [], contacts: [], playerContacts: [], offRoad: [], conflicts: [], teleports: [], ghosts: [], redCrossings: [], stoppedSlides: [], traversed: Object.fromEntries(vehicles.map(({ label }) => [label, false])), clearFrames: {}, lightWaitFrames: 0, waitFrames: Object.fromEntries(vehicles.map(({ label }) => [label, 0])), population: vehicles.length, updateMs: [], fixture: 'Native Traffic controller on controlled shared-lane topology; no source-world fidelity claim', frame: 0 };
    const support = (v, x, z) => Math.abs(-Math.sin(v.heading) * x - Math.cos(v.heading) * z) * v.length / 2 + Math.abs(Math.cos(v.heading) * x - Math.sin(v.heading) * z) * v.width / 2;
    window.stepShared = count => {
        for (let i = 0; i < count; i++) {
            if (player && report.frame >= 600) { player.speed = 3; player.x -= 3 / 30; player.z = -1.6 * Math.max(0, Math.min(1, (3 - player.x) / 6)); }
            const old = new Map(vehicles.map(({ v }) => [v, { x: v.x, z: v.z, speed: v.speed, edge: v.edge, s: v.s, state: traffic.lightState(v.dir > 0 ? v.edge.b : v.edge.a, v.edge) }]));
            traffic.update(1 / 30); report.frame++; report.updateMs.push(traffic.stats.lastMs);
            for (let a = 0; a < vehicles.length; a++) for (let b = a + 1; b < vehicles.length; b++) {
                const v = vehicles[a].v, o = vehicles[b].v;
                const axes = [v, o].flatMap(c => [[-Math.sin(c.heading), -Math.cos(c.heading)], [Math.cos(c.heading), -Math.sin(c.heading)]]);
                const overlap = Math.min(...axes.map(([x,z]) => support(v,x,z) + support(o,x,z) - Math.abs((v.x-o.x)*x+(v.z-o.z)*z)));
                if (overlap > .001) report.contacts.push({ frame: report.frame, overlap, a, b });
                const current = traffic.sharedLanes.entry(v.edge, v.dir), other = traffic.sharedLanes.entry(o.edge, o.dir);
                if (current && other?.group === current.group && (current.group.exclusive || current.sign !== other.sign)) report.conflicts.push({ frame: report.frame, a, b });
            }
            for (const { label, v, exit } of vehicles) {
                const before = old.get(v), moved = Math.hypot(v.x - before.x, v.z - before.z);
                if (moved > Math.max(before.speed, v.speed) / 30 * 1.11 + .03) report.teleports.push({ frame: report.frame, label, moved });
                if (before.speed === 0 && v.speed === 0 && moved > 1e-6) report.stoppedSlides.push({ frame: report.frame, label, moved });
                if (v.ghost > 0) report.ghosts.push({ frame: report.frame, label, ghost: v.ghost });
                if (player && playerPen(v, player) > .001) report.playerContacts.push({ frame: report.frame, label });
                const e = v.edge, lat = (v.x - e.a.x) * e.nx + (v.z - e.a.z) * e.nz;
                if (e.sharedLane && v.s > v.length / 2 + 3 && v.s < e.len - v.length / 2 - 3 && Math.abs(lat) + support(v, e.nx, e.nz) > 1.61) report.offRoad.push({ frame: report.frame, label, lat });
                if (v.stopWhy === 'light' && v.speed < .1) report.lightWaitFrames++;
                if (v.stopWhy === 'shared-lane' && v.speed < .1) report.waitFrames[label]++;
                if (!report.traversed[label] && v.edge === exit && v.s > v.length / 2 + 4) { report.traversed[label] = true; report.clearFrames[label] = report.frame; }
                const end = v.dir > 0 ? before.edge.b : before.edge.a, line = before.edge.len - v.length / 2 - (end.radius || 3) - 1.6;
                if (end.hasLight && before.state === 'red' && before.s < line && traffic.lightState(end, before.edge) === 'red' && (v.edge !== before.edge || v.s >= line)) report.redCrossings.push({ frame: report.frame, label });
            }
            if (traffic.vehicles.length !== report.population) throw new Error('Shared-lane fixture lost a vehicle');
            if (report.frame % 30 === 0) report.samples.push({ seconds: report.frame / 30, player: player && { x: player.x, speed: player.speed }, vehicles: Object.fromEntries(vehicles.map(({ label, v }) => [label, { x: v.x, z: v.z, speed: v.speed, edge: v.edge.id, why: v.stopWhy }])) });
        }
        if (playerMesh) playerMesh.position.set(player.x, .9, player.z);
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
    const errors = [], browser = await chromium.launch({ executablePath: arg('browser', undefined), headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 960, height: 360 } }); page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/fixture?' + new URLSearchParams({ ...(process.argv.includes('--long') ? { long: '1' } : {}), ...(arg('branch', '') ? { branch: arg('branch', '') } : {}), ...(arg('case', '') ? { case: arg('case', '') } : {}) }));
        await page.waitForFunction(() => window.fixtureReady || window.fixtureError, null, { timeout: 120000 });
        assert.equal(await page.evaluate(() => window.fixtureError), undefined);
        const first = await page.evaluate(() => window.stepShared(300));
        await page.screenshot({ path: path.join(out, 'yielding.png') });
        const final = await page.evaluate(() => window.stepShared(2100));
        await page.screenshot({ path: path.join(out, 'cleared.png') });
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ root, first, final, errors }, null, 2));
        assert.deepEqual(errors, []); assert.equal(final.contacts.length, 0); assert.equal(final.offRoad.length, 0); assert.equal(final.conflicts.length, 0); assert.equal(final.teleports.length, 0); assert.equal(final.stoppedSlides.length, 0);
        for (const traversed of Object.values(final.traversed)) assert.equal(traversed, true);
        assert.equal(final.playerContacts.length, 0); assert.equal(final.ghosts.length, 0); assert.equal(final.redCrossings.length, 0);
        if (final.mode === 'light') assert.ok(final.lightWaitFrames > 30, 'native timed lights actually stop a vehicle');
        if (final.mode === 'platoon') assert.ok(final.clearFrames.east < final.clearFrames.follower, 'opposite waiter clears before the next same-direction batch');
        assert.ok(Object.values(final.waitFrames).reduce((a, b) => a + b, 0) > 30);
        console.log('PASS ' + final.mode + ': ' + final.population + ' native Traffic vehicles traverse; no contacts/conflicts/ghosts/teleports/stationary slides/red entries.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
