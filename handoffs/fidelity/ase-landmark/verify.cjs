// Focused ASE source/courtyard/transform checks plus actual game captures. Never downloads reference imagery.
// NODE_PATH=<playwright install> node handoffs/fidelity/ase-landmark/verify.cjs [source checkout] <scratch output>
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || '/tmp/ase-verification');
assert(!out.startsWith(root + path.sep), 'Screenshots and comparison output must stay outside the checkout');
fs.mkdirSync(out, { recursive: true });
const research = JSON.parse(fs.readFileSync(path.join(root, 'game/research/ase-landmark.json')));
(async () => {
    const server = http.createServer((rq, rs) => {
        const f = path.join(root, decodeURIComponent(rq.url.split('?')[0]));
        fs.readFile(f, (e, b) => { rs.writeHead(e ? 404 : 200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); rs.end(e ? 'missing' : b); });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port + '/', errors = [];
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const p = await browser.newPage({ viewport: { width: 960, height: 960 } });
        p.on('pageerror', e => errors.push(e.message));
        await p.goto(base + 'game/dev/landmarks.html?id=ase&view=top&clean=1&az=0&d=160&sun=225');
        await p.waitForFunction(() => window.__ready);
        const focused = await p.evaluate(async research => {
            const THREE = await import('/game/vendor/three.module.min.js'), { LANDMARKS, buildLandmark } = await import('/game/src/landmarks.js'), { collideBuildings } = await import('/game/src/world.js');
            const lm = LANDMARKS.find(l => l.id === 'ase'), model = buildLandmark(lm, { realScale: true }), exact = model.collision.find(c => c.poly), expected = research.osm.rings;
            if (!exact || exact.holes.length !== 4) throw new Error('Missing exact four-courtyard collider');
            if (JSON.stringify(exact.poly) !== JSON.stringify(expected[research.osm.outer_way])) throw new Error('Source outer differs');
            if (JSON.stringify(exact.holes) !== JSON.stringify(research.osm.inner_ways.map(id => expected[id]))) throw new Error('Source inner differs');
            const pin = (x, z, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
            const dist = (x, z, poly) => Math.min(...poly.map((a, i) => { const c = poly[(i + 1) % poly.length], dx = c[0] - a[0], dz = c[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }));
            const ray = new THREE.Raycaster(), courts = [], wingControls = [];
            model.mesh.updateMatrixWorld(true);
            for (const h of exact.holes) {
                let count = 0, best = null;
                for (let x = Math.min(...h.map(p => p[0])); x < Math.max(...h.map(p => p[0])); x += 0.5) for (let z = Math.min(...h.map(p => p[1])); z < Math.max(...h.map(p => p[1])); z += 0.5) {
                    if (!pin(x, z, h) || dist(x, z, h) < 1) continue;
                    ray.set(new THREE.Vector3(x, 80, z), new THREE.Vector3(0, -1, 0));
                    const hit = ray.intersectObject(model.mesh, true);
                    if (hit.length) throw new Error('Geometry over courtyard ' + JSON.stringify({ x, z, y: hit[0].point.y }));
                    if (collideBuildings(model.collision.map(c => ({ ...c, r: Math.hypot(c.hw, c.hd) })), x, z, 0.2, 0.3)) throw new Error('Courtyard collision');
                    count++; if (!best || dist(x, z, h) > best.clearance) best = { x, z, clearance: dist(x, z, h) };
                }
                if (!count) throw new Error('No independent courtyard interior samples'); courts.push({ samples: count, best });
            }
            for (const [x, z] of [[-32, -30], [-38, 15], [30, 20], [-15, 43]]) {
                if (!collideBuildings(model.collision.map(c => ({ ...c, r: Math.hypot(c.hw, c.hd) })), x, z, 0.2, 0.3)) throw new Error('Solid wing missed'); wingControls.push([x, z]);
            }
            // Exercise the shared relative-polygon contract under Seattle legacy scale plus a nonzero yaw.
            const fixture = { ...lm, city: 'seattle', rotation: 0.43 }; Object.defineProperty(fixture, '_fn', { value: lm._fn });
            const transformed = buildLandmark(fixture).collision.find(c => c.poly), cs = Math.cos(0.43), sn = Math.sin(0.43);
            for (let r = 0; r < 5; r++) { const a = r ? exact.holes[r - 1] : exact.poly, b = r ? transformed.holes[r - 1] : transformed.poly; for (let i = 0; i < a.length; i++) if (Math.hypot(b[i][0] - (a[i][0] * cs + a[i][1] * sn) * 0.5, b[i][1] - (-a[i][0] * sn + a[i][1] * cs) * 0.5) > 1e-8) throw new Error('Polygon transform mismatch'); }
            return { triangles: model.triangles, meshes: model.mesh.children.length, courts, wingControls, transformFixture: 'pass', outerVertices: exact.poly.length, innerVertices: exact.holes.map(h => h.length) };
        }, research);
        assert(focused.triangles < 25000, 'ASE model triangle budget'); assert(focused.meshes <= 3, 'ASE material budget');
        await p.screenshot({ path: path.join(out, 'model-top.png') });
        await p.goto(base + 'game/dev/landmarks.html?id=ase&view=street&ex=-72&ez=84&ey=1.7&tx=-28&tz=27&ty=15&fov=70&sun=225&clean=1');
        await p.waitForFunction(() => window.__ready); await p.screenshot({ path: path.join(out, 'model-street.png') });
        await p.route(/api\.open-meteo\.com/, r => r.fulfill({ json: { error: true } }));
        await p.goto(base + 'game/index.html?weather=clear'); await p.waitForFunction(() => window.game);
        await p.addScriptTag({ url: base + 'game/dev/harness/visual/page/visual.js', type: 'module' }); await p.waitForFunction(() => window.vqa);
        await p.evaluate(() => vqa.loadGroup('bucharest-romana', { quality: 'high', pr: 0.75, time: 'day', weather: 'clear', traffic: false, season: 'summer' }));
        const integrated = await p.evaluate(async ({ research }) => {
            const { collideBuildings } = await import('/game/src/world.js'), g = game, anchor = g.city.proj(research.anchor.lat, research.anchor.lon), lm = g.world.landmarks.find(l => l.id === 'ase');
            if (!lm) throw new Error('ASE missing from actual game');
            const actual = g.world.buildings.filter(b => b.landmark === 'ase' && b.poly);
            if (actual.length !== 1 || actual[0].holes.length !== 4) throw new Error('World dropped exact courtyard collider');
            const courts = [];
            for (const h of actual[0].holes) {
                let best = null;
                const pin = (x, z) => { let k = false; for (let i = 0, j = h.length - 1; i < h.length; j = i++) if ((h[i][1] > z) !== (h[j][1] > z) && x < (h[j][0] - h[i][0]) * (z - h[i][1]) / (h[j][1] - h[i][1]) + h[i][0]) k = !k; return k; };
                for (let x = Math.min(...h.map(p => p[0])); x < Math.max(...h.map(p => p[0])); x += 0.5) for (let z = Math.min(...h.map(p => p[1])); z < Math.max(...h.map(p => p[1])); z += 0.5) if (pin(x, z) && !collideBuildings(actual, x, z, 0.35, 0.3)) { best = { x, z }; break; }
                if (!best) throw new Error('World courtyard blocked'); courts.push(best);
            }
            return { anchor, courts, worldStats: g.world.stats, collider: { x: actual[0].x, z: actual[0].z, r: actual[0].r }, neighbouringBuildings: g.world.buildings.filter(b => !b.landmark && Math.hypot(b.x - anchor.x, b.z - anchor.z) < 100).length };
        }, { research });
        for (const view of ['top', 'street']) {
            const draw = await p.evaluate(({ view, integrated }) => {
                const g = game, a = integrated.anchor;
                g.r3d.setSeason('spring');
                document.querySelectorAll('body > *:not(canvas)').forEach(e => { e.style.visibility = 'hidden'; });
                g.player.rig.visible = false; g.scene.add(g.camera); g.camera.layers.set(0); g.camera.aspect = 1; g.camera.fov = view === 'top' ? 45 : 80; g.camera.near = 0.3; g.camera.far = 2200;
                if (view === 'top') { g.camera.position.set(a.x, 200, a.z + 0.001); g.camera.lookAt(a.x, 0, a.z); }
                else { const q = g.city.proj(44.44721433429083, 26.09622661843387), heading = 35 * Math.PI / 180, pitch = 12 * Math.PI / 180; g.camera.position.set(q.x, 1.7, q.z); g.camera.lookAt(q.x + Math.sin(heading) * Math.cos(pitch) * 100, 1.7 + Math.sin(pitch) * 100, q.z - Math.cos(heading) * Math.cos(pitch) * 100); }
                g.camera.updateProjectionMatrix(); vqa.S.renderNow = true; g.renderer.info.reset(); g.drawFrame({ mirror: false }); vqa.S.renderNow = false;
                return { ...g.r3d.stats };
            }, { view, integrated });
            integrated[view] = draw; await p.screenshot({ path: path.join(out, 'game-' + view + '.png') });
        }
        assert.deepEqual(errors, [], 'Browser page errors');
        const report = { source: root, generated: new Date().toISOString(), focused, integrated, errors };
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ source: root, focused, integrated: { courts: integrated.courts, top: integrated.top, street: integrated.street }, errors }, null, 2));
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
