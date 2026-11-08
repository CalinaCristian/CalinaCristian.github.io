#!/usr/bin/env node
// Targeted actual-game checks; writes private screenshots/evidence outside git.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3);
const root = path.resolve(arg('root') || '.'), out = path.resolve(arg('out') || '/tmp/building-geometry-browser');
fs.mkdirSync(out, { recursive: true });
(async () => {
    const srv = http.createServer((req, res) => {
        let rel = decodeURIComponent(req.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
        const file = path.join(root, rel);
        fs.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(error ? 'missing' : body); });
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + srv.address().port + '/';
    const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 960, height: 720 } }), errors = [];
        page.on('pageerror', e => errors.push(e.stack));
        await page.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        await page.exposeFunction('geometrySave', (name, uri) => { const p = path.join(out, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(uri.split(',')[1], 'base64')); });
        await page.goto(base + 'game/index.html?weather=clear&season=summer');
        await page.waitForFunction(() => window.game, null, { timeout: 90000 });
        await page.addScriptTag({ url: base + 'game/dev/harness/visual/page/visual.js', type: 'module' });
        await page.waitForFunction(() => window.vqa);
        await page.evaluate(() => vqa.loadGroup('bucharest-romana', { quality: 'high', time: 'day', weather: 'clear', pr: 0.5, traffic: true, aerial: false, looks: false, sweep: 3, every: 80, zEvery: 1 }));
        const result = await page.evaluate(async ({ quick, selected, angles, checksOnly }) => {
            const THREE = await import('./src/../vendor/three.module.min.js');
            const { zfightDiff } = await import('./dev/harness/visual/page/pixels.js');
            const data = await (await fetch('./data/bucharest-romana.json')).json(), g = game, renderer = g.renderer;
            const read = () => { const c = document.createElement('canvas'); c.width = renderer.domElement.width; c.height = renderer.domElement.height; c.getContext('2d').drawImage(renderer.domElement, 0, 0); return c; };
            const save = (name, canvas) => checksOnly ? Promise.resolve() : geometrySave(name, (canvas || read()).toDataURL('image/png'));
            const ring = i => { let x = 0, z = 0; const r = []; const b = data.buildings[i]; for (let j = 9; j < b.length; j += 2) { x += b[j]; z += b[j + 1]; r.push([x / 10, z / 10]); } return r; };
            const scenerySegments = (data.scenery || []).flatMap(s => { let x = 0, z = 0; const p = []; for (let i = 4; i < s.length; i += 2) { x += s[i]; z += s[i + 1]; p.push([x / 10, z / 10]); } return p.slice(1).map((b, i) => [p[i], b]); });
            const sceneryNear = (x, z) => { let best = null; for (const [a, b] of scenerySegments) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))), cx = a[0] + dx * t, cz = a[1] + dz * t, d = Math.hypot(x - cx, z - cz); if (!best || d < best.d) best = { cx, cz, d }; } return best; };
            const targets = selected?.[0] === 'assemblies' ? [...Object.keys(data.buildingAssemblies).map(i => data.buildingIds[i]), 'w182932596', 'w129316964', 'w186600911', 'w414116153', 'w163622220', 'w174989492', 'w180559151'] : selected || ['w180556785', 'w236091148', 'w156797704', 'w967066303', 'w34910669', 'w45514712', 'w405520008', 'w969839627', 'w182932596', 'w129316964', 'w186600911', 'w414116153', 'w163622220', 'w174989492', 'w180559151'];
            const result = { stats: g.world.stats, dev: g.world.devCheck(), targets: [], trafficFrames: [], roofFrames: [] };
            // Near-camera jitter uses fixed unlit materials, matching the visual
            // harness detector and removing temporal shader animation as a cause.
            const old = [], clones = new Map(), hidden = [];
            for (const group of [g.traffic?.group, g.player?.rig]) if (group) { hidden.push([group, group.visible]); group.visible = false; }
            g.scene.traverse(o => { if (!o.isMesh || !o.material || Array.isArray(o.material)) return; const m = o.material; let clone = clones.get(m); if (!clone) { clone = new THREE.MeshBasicMaterial({ vertexColors: !!m.vertexColors, color: m.color?.clone() || 0xffffff, map: m.map || null, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, depthWrite: m.depthWrite, depthTest: m.depthTest, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, fog: false }); clones.set(m, clone); } old.push([o, m]); o.material = clone; });
            for (const id of targets) {
                const i = data.buildingIds.indexOf(id), r = ring(i), x = r.reduce((s, p) => s + p[0], 0) / r.length, z = r.reduce((s, p) => s + p[1], 0) / r.length, h = data.buildings[i][1] / 10;
                const graphNear = g.world.nearestEdge(x, z, e => !e.virtual && !e.tunnel && e.type !== 'service', 300);
                const near = graphNear?.d <= 300 ? graphNear : sceneryNear(x, z) || { cx: x - 50, cz: z + 60 };
                const cam = new THREE.PerspectiveCamera(65, renderer.domElement.width / renderer.domElement.height, 0.1, 1200);
                const dx = near.cx - x, dz = near.cz - z, distance = Math.hypot(dx, dz) || 1, scale = Math.max(1, (['w156797704', 'w967066303'].includes(id) ? 80 : 35) / distance);
                const targetY = id === 'w156797704' ? 42 : id === 'w967066303' ? 29 : Math.min(18, h * 0.45);
                cam.position.set(x + dx * scale, 2.2, z + dz * scale); cam.lookAt(x, targetY, z); cam.updateMatrixWorld(true);
                renderer.render(g.scene, cam); const a = read(), pixels = a.getContext('2d').getImageData(0, 0, a.width, a.height);
                const jitters = [];
                for (const mm of [1, 2, 3]) {
                    cam.position.x += mm / 1000; cam.position.y += mm / 1000; cam.updateMatrixWorld(true); renderer.render(g.scene, cam);
                    const b = read(), diff = zfightDiff(pixels, b.getContext('2d').getImageData(0, 0, b.width, b.height), new Uint8Array(b.width * b.height));
                    jitters.push({ mm, blocks: diff.blocks, fraction: diff.frac }); await save(id + '-jitter-' + mm + '.png', b);
                    cam.position.x -= mm / 1000; cam.position.y -= mm / 1000;
                }
                await save(id + '-near.png', a);
                result.targets.push({ id, camera: cam.position.toArray(), lookAt: [x, targetY, z], jitters });
                if (checksOnly) continue;
                const size = Math.max(45, ...r.map(p => Math.hypot(p[0] - x, p[1] - z) * 2.6)), aerial = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0.1, 600);
                const top = ['w156797704', 'w967066303'].includes(id) ? 108 : h;
                aerial.position.set(x, top + 100, z); aerial.up.set(0, 0, -1); aerial.lookAt(x, 0, z); aerial.updateMatrixWorld(true); renderer.render(g.scene, aerial); await save(id + '-topdown.png');
                for (const [o, material] of old) o.material = material;
                renderer.render(g.scene, cam); await save(id + '-beauty-near.png');
                renderer.render(g.scene, aerial); await save(id + '-beauty-topdown.png');
                const oblique = cam.clone(); oblique.position.set(x - size * 0.65, top + size * 0.5, z + size * 0.65); oblique.lookAt(x, top * 0.6, z); oblique.updateMatrixWorld(true); renderer.render(g.scene, oblique); await save(id + '-beauty-oblique.png');
                for (const [o, material] of old) o.material = clones.get(material);
                if (angles) for (let angle = 0; angle < 8; angle++) {
                    const view = cam.clone(), az = angle * Math.PI / 4, distance = Math.max(80, size * 0.8);
                    view.position.set(x + Math.sin(az) * distance, 1.8, z + Math.cos(az) * distance); view.lookAt(x, targetY, z); view.updateMatrixWorld(true);
                    renderer.render(g.scene, view); const a = read(), pixels = a.getContext('2d').getImageData(0, 0, a.width, a.height), jitters = [];
                    for (const mm of [1, 2, 3]) { view.position.x += mm / 1000; view.position.y += mm / 1000; view.updateMatrixWorld(true); renderer.render(g.scene, view); const b = read(), diff = zfightDiff(pixels, b.getContext('2d').getImageData(0, 0, b.width, b.height), new Uint8Array(b.width * b.height)); jitters.push({ mm, blocks: diff.blocks, fraction: diff.frac }); view.position.x -= mm / 1000; view.position.y -= mm / 1000; }
                    result.targets.push({ id, angle, camera: view.position.toArray(), lookAt: [x, targetY, z], jitters });
                    for (const [o, material] of old) o.material = material;
                    renderer.render(g.scene, view); await save(id + '-ground-up-angle-' + angle + '.png');
                    for (const [o, material] of old) o.material = clones.get(material);
                }
            }
            for (const [o, m] of old) o.material = m; for (const [o, visible] of hidden) o.visible = visible; for (const m of clones.values()) m.dispose();
            // High quality, active traffic, pedestrians and mirror use the real
            // gameplay frame path. Test the ends/middles of each chapter/sweep.
            const spawn = vqa.S.spawn;
            for (const [name, turn, pitch] of [['forward', 0, 0], ['up', 0, 0.65], ['right-up', -Math.PI / 3, 0.65]]) {
                const cam = new THREE.PerspectiveCamera(65, renderer.domElement.width / renderer.domElement.height, 0.1, 1200), heading = spawn.heading + turn;
                cam.position.set(spawn.x, 1.8, spawn.z); cam.lookAt(spawn.x - Math.sin(heading), 1.8 + Math.tan(pitch), spawn.z - Math.cos(heading)); cam.updateMatrixWorld(true); renderer.render(g.scene, cam); await save('romana-spawn-' + name + '.png');
                result.roofFrames.push({ name: 'romana-spawn-' + name, position: cam.position.toArray(), heading, pitch });
            }
            const plans = quick ? [] : await vqa.plans();
            for (const plan of plans) {
                vqa.sampleRoute(plan); const route = vqa.S.routes.get(plan.id); if (!route?.samples?.length) continue;
                for (const i of [...new Set([0, Math.floor(route.samples.length / 2), route.samples.length - 1])]) {
                    const capture = await vqa.capture(plan.id, i); result.trafficFrames.push({ route: plan.id, sample: i, ...capture });
                }
            }
            return result;
        }, { quick: process.argv.includes('--quick'), selected: arg('targets')?.split(','), angles: process.argv.includes('--angles'), checksOnly: process.argv.includes('--checks-only') });
        result.errors = errors;
        fs.writeFileSync(path.join(out, 'runtime.json'), JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify({ errors, assemblies: result.stats.buildingAssemblies?.length, clearance: result.stats.buildingClearance, jitter: result.targets.map(t => [t.id, t.jitters.map(j => j.blocks.length)]), frames: result.trafficFrames.length, maxTriangles: Math.max(0, ...result.trafficFrames.map(f => f.perf?.tris || 0)), maxCalls: Math.max(0, ...result.trafficFrames.map(f => f.perf?.calls || 0)) }));
        if (errors.length || result.trafficFrames.some(f => f.perf?.tris > 1500000 || f.perf?.calls > 400)) throw new Error('browser errors or high-quality frame budget failure');
    } finally { await browser.close(); await new Promise(r => srv.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
