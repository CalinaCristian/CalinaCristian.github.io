#!/usr/bin/env node
// Compare literal district water geometry in a stable isolated scene. Populated
// main/mirror budget evidence is a separate same-scene test.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const root = path.resolve(args.root || path.join(__dirname, '../..'));
const helper = path.resolve(__dirname, '../../game/src/water-batch.js');
const district = args.district || 'bucharest-grozavesti', out = path.resolve(args.out || '/tmp/water-source-check');
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]);
        const f = rel === '/game/src/water-batch.js' ? helper : path.join(root, rel);
        fs.readFile(f, (e, b) => { res.writeHead(e ? 404 : 200, { 'content-type': { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html' }[path.extname(f)] || 'application/octet-stream' }); res.end(e ? 'missing' : b); });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage({ viewport: { width: 512, height: 512 } }), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(base + '/game/index.html?weather=clear&notrack', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(() => window.game);
        await page.addScriptTag({ url: base + '/game/dev/harness/visual/page/visual.js', type: 'module' });
        await page.waitForFunction(() => window.vqa);
        await page.evaluate(() => vqa.setOpts({ quality: 'high', weather: 'clear', time: 'day', traffic: false, pr: 1 }));
        const loaded = await page.evaluate(k => vqa.loadGroup(k), district);
        const result = await page.evaluate(async () => {
            const T = await import('/game/vendor/three.module.min.js'), { batchWaterChunks } = await import('/game/src/water-batch.js');
            const { disposeDistrictScene } = await import('/game/src/sceneResources.js');
            const g = game, R = g.renderer, group = g.world.waterMesh, originalParent = group.parent;
            if (!group.isGroup) throw new Error('source district has no partitioned water');
            const originals = group.children.slice(), camera = new T.PerspectiveCamera(60, 1, .2, 6000), scene = new T.Scene();
            const now = performance.now(); Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
            scene.background = new T.Color('#10252f'); scene.environment = g.scene.environment;
            scene.add(new T.HemisphereLight('#ffffff', '#304838', 1.2)); scene.add(group); R.setSize(256, 256);
            const material = originals[0].material; let sourceDisposals = 0, materialDisposals = 0, mergedDisposals = 0;
            for (const m of originals) m.geometry.addEventListener('dispose', () => sourceDisposals++);
            material.addEventListener('dispose', () => materialDisposals++);
            const largest = originals.slice().sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
            const p = largest.geometry.attributes.position, water = new T.Vector3();
            for (let i = 0; i < 3; i++) water.add(new T.Vector3().fromBufferAttribute(p, i)); water.multiplyScalar(1 / 3);
            const edge = originals.slice().sort((a, b) => a.geometry.boundingSphere.radius - b.geometry.boundingSphere.radius).find(m => m.geometry.boundingSphere.radius > 1);
            const s = edge.geometry.boundingSphere, distance = Math.max(1000, s.radius * 4), pos = s.center.clone().add(new T.Vector3(0, distance, distance)), d = pos.distanceTo(s.center);
            const views = [
                { id: 'actual-water-positive', position: water.clone().add(new T.Vector3(0, 12, 16)), target: water, far: 6000 },
                { id: 'component-far-positive', position: pos, target: s.center, far: d - s.radius + .01, expected: edge.name },
                { id: 'component-far-negative', position: pos, target: s.center, far: d - s.radius - .01, excluded: edge.name },
                { id: 'no-source-water', position: new T.Vector3(1e6, 100, 1e6), target: new T.Vector3(1e6, 100, 1e6 + 100), far: 1000 },
            ];
            const gl = R.getContext(), getExtension = gl.getExtension.bind(gl); gl.getExtension = n => n === 'WEBGL_multi_draw' ? null : getExtension(n);
            let commands = 0; const commandKinds = {};
            for (const key of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const fn = gl[key].bind(gl); gl[key] = (...a) => { commands++; commandKinds[key] = (commandKinds[key] || 0) + 1; return fn(...a); }; }
            const render = view => {
                camera.position.copy(view.position); camera.lookAt(view.target); camera.far = view.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
                R.info.reset(); commands = 0; for (const k of Object.keys(commandKinds)) delete commandKinds[k];
                const selected = [], original = R.renderBufferDirect;
                R.renderBufferDirect = function (cam, sc, geo, mat, object, range) { selected.push(object.name); return original.apply(this, arguments); };
                R.render(scene, camera); R.renderBufferDirect = original;
                const pixels = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                return { pixels, calls: R.info.render.calls, triangles: R.info.render.triangles, commands, commandKinds: { ...commandKinds }, selected: group.userData.waterBatch?.selected.slice() || selected,depths:originals.map(m=>({name:m.name,id:m.id,z:m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(camera).z,renderOrder:m.renderOrder,parentOrder:m.parent?.renderOrder})).filter(m=>selected.includes(m.name)) };
            };
            const before = views.map(render), oldMemory = { ...R.info.memory }, batch = batchWaterChunks(group);
            if (!batch) throw new Error('actual source chunks were rejected');
            batch.geometry.addEventListener('dispose', () => mergedDisposals++);
            const rows = views.map((view, i) => {
                const after = render(view), reference = before[i]; let changedBytes = 0;
                for (let j = 0; j < after.pixels.length; j++) changedBytes += after.pixels[j] !== reference.pixels[j];
                if (changedBytes || reference.triangles !== after.triangles || JSON.stringify(reference.selected) !== JSON.stringify(after.selected) || after.commands !== 1 ||
                    view.expected && !after.selected.includes(view.expected) || view.excluded && after.selected.includes(view.excluded)) throw new Error(JSON.stringify({ id: view.id, changedBytes, before: { ...reference, pixels: undefined }, after: { ...after, pixels: undefined } }));
                return { id: view.id, changedBytes, triangles: after.triangles, beforeCalls: reference.calls, afterCalls: after.calls, actualGLCommands: after.commands, commandKinds: after.commandKinds, selected: after.selected, camera: { position: view.position.toArray(), target: view.target.toArray(), far: view.far }, expected: view.expected, excluded: view.excluded };
            });
            const newMemory = { ...R.info.memory }, aliveDuringBatch = materialDisposals === 0;
            group.removeFromParent(); originalParent.add(group); disposeDistrictScene(g.scene, { retained: [g.player.rig], landmarks: g.world.landmarks });
            return { passed: true, originalChunks: originals.length, sourceDisposals, mergedDisposals, materialDisposals, sharedMaterialAliveDuringBatch: aliveDuringBatch, oldMemory, newMemory, rows, forcedMultiDrawUnavailable: true, method: 'Literal source water group, unchanged material, isolated stable lighting. Native reference sphere culling/order versus compacted index, actual GL commands and exact RGBA bytes. Not a populated-world budget measurement.' };
        });
        result.loaded = loaded; result.errors = errors; result.helperSha256 = crypto.createHash('sha256').update(fs.readFileSync(helper)).digest('hex');
        fs.writeFileSync(path.join(out, 'source-water.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ passed: result.passed, rows: result.rows.map(r => ({ id: r.id, before: r.beforeCalls, after: r.afterCalls, triangles: r.triangles, pixels: r.changedBytes })), disposals: [result.sourceDisposals, result.mergedDisposals, result.materialDisposals], errors }));
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exit(1); });
