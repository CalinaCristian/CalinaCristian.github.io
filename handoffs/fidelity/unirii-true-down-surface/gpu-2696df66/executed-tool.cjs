// Isolated actual-Three GPU control. This is not a native World visual pass.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const [root, out, source] = process.argv.slice(2);
if (!root || !out || !/^[a-f0-9]{40}$/.test(source || '')) throw Error('ROOT OUT SOURCE40 required');
fs.mkdirSync(out, { recursive: false });
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json')));
if (manifest.source !== source) throw Error('source mismatch');
const report = { source, toolSHA256: sha(fs.readFileSync(__filename)), scope: 'Isolated32px actual Three GPU/material/order/model controls; NOT a full native World/passage/phone/High/Ultra/frame-budget acceptance', startedAt: new Date().toISOString(), requests: [], errors: [], consoleErrors: [], complete: false };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); save();
const server = http.createServer((q, r) => {
    if (q.url === '/control.html') { r.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Isolated underpass depth control</title>'); return; }
    const name = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, ''), file = path.resolve(root, name), record = manifest.files[name];
    if (!file.startsWith(root + path.sep) || !record) { r.writeHead(404).end(); return; }
    const b = fs.readFileSync(file); if (sha(b) !== record.sha256) throw Error('changed source ' + name);
    report.requests.push({ name, sha256: record.sha256 });
    r.writeHead(200, { 'content-type': name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'cache-control': 'no-store' }).end(b);
});
(async () => {
    let browser;
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}/`;
    try {
        browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
        page.on('pageerror', e => report.errors.push(e.stack || e.message)); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
        await page.goto(base + 'control.html');
        const result = await page.evaluate(async base => {
            const THREE = await import(base + 'game/vendor/three.module.min.js'), { MeshBuilder } = await import(base + 'game/src/geobuild.js'),
                { underpassRoofModel, underpassRoofFaces, UNDERPASS_COVER_POLICY } = await import(base + 'game/src/underpass-roof.js'),
                { buildUnderpassOwnerIndex } = await import(base + 'game/src/underpass-ground-owner.js');
            const worldSource = await (await fetch(base + 'game/src/world.js')).text();
            const declaration = worldSource.match(/const material = new THREE\.MeshBasicMaterial\(\{ colorWrite: UNDERPASS_COVER_POLICY\.colorWrite[^;]+;/)?.[0];
            if (!declaration) throw Error('actual World cover-material constructor missing');
            const coverMaterial = () => new Function('THREE', 'UNDERPASS_COVER_POLICY', declaration + '\nreturn material;')(THREE, UNDERPASS_COVER_POLICY);
            const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
            renderer.setSize(32, 32); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
            renderer.setClearColor(0x000000); document.body.append(renderer.domElement);
            const model = underpassRoofModel({ id: 1, tunnel: true, lidded: true, ya: -6, yb: -6 }, { topM: Math.fround(.049), sourceTags: { maxheight: '3.5' } });
            const faces = underpassRoofFaces(model, { pointAt: (t, o, y) => [o, y, t * 20], rightM: 4, leftM: 4 });
            const cover = new MeshBuilder(), solid = new MeshBuilder();
            for (const q of faces.top) cover.face4(...q, [100, 100, 100], [0, 1, 0]);
            for (const q of faces.bottom) solid.face4(...q, [100, 100, 100], [0, -1, 0]);
            for (const q of faces.fascia) solid.face4(...q.vertices, [100, 100, 100], q.out);
            const coverGeo = cover.build(), solidGeo = solid.build(), results = [];
            const camera = () => { const c = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 30); c.position.set(0, 10, 10); c.up.set(0, 0, -1); c.lookAt(0, 0, 10); return c; };
            const skin = (color, y, depthWrite, transparent = false) => {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, depthWrite, transparent, opacity: 1 }));
                m.position.set(0, y, 10); return m;
            };
            const assert = (condition, text) => { if (!condition) throw Error(text); };
            function run(name, { sourceColor, y = .049, sourceDepth = false, mask = false, water = false, bodyY = -5.25, view = 'above', roofSolid = false }) {
                const scene = new THREE.Scene(), order = [], materials = [], c = camera();
                if (sourceColor !== null) { const m = skin(sourceColor, y, sourceDepth, water); m.name = water ? 'actual-transparent-water-control' : 'actual-source-ground-control'; m.renderOrder = water ? -18 : sourceDepth ? 2 : -19.2; scene.add(m); }
                const actor = new THREE.Mesh(new THREE.BoxGeometry(2, .5, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 })); actor.position.set(0, bodyY, 10); actor.name = 'actor-control'; scene.add(actor);
                if (mask) { const m = new THREE.Mesh(coverGeo, coverMaterial()); m.name = 'actual-World-depth-only-cover'; m.renderOrder = UNDERPASS_COVER_POLICY.renderOrder; scene.add(m); }
                if (roofSolid) { const m = new THREE.Mesh(solidGeo, new THREE.MeshBasicMaterial({ color: 0x606060 })); m.name = 'actual-model-slab-faces'; scene.add(m); }
                if (view === 'below') { c.position.set(0, -4.4, 10); c.up.set(0, 0, 1); c.lookAt(0, 4, 10); actor.position.y = 1; }
                if (view === 'side') { c.position.set(9, -.2, 10); c.up.set(0, 1, 0); c.lookAt(0, -.2, 10); }
                scene.traverse(o => { if (!o.isMesh) return; materials.push({ name: o.name, transparent: o.material.transparent, colorWrite: o.material.colorWrite, depthWrite: o.material.depthWrite, renderOrder: o.renderOrder }); o.onBeforeRender = () => order.push(o.name); });
                renderer.render(scene, c); const gl = renderer.getContext(), pixel = new Uint8Array(4); gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                const row = { name, centerRGBA: [...pixel], actualDrawOrder: order, actualMaterials: materials, glError: gl.getError(), png: renderer.domElement.toDataURL('image/png') }; results.push(row);
                for (const o of scene.children) { if (o.geometry !== coverGeo && o.geometry !== solidGeo) o.geometry.dispose(); o.material.dispose(); }
                return row;
            }
            const green = run('ground-no-mask-positive-control', { sourceColor: 0x00ff00 }); assert(green.centerRGBA[0] > 240 && green.centerRGBA[1] < 10, 'baseline no-depth ground must expose red body');
            const fixed = run('source-grass-with-physical-roof', { sourceColor: 0x00ff00, mask: true }); assert(fixed.centerRGBA[1] > 240 && fixed.centerRGBA[0] < 10, 'source grass color lost or body visible');
            const pave = run('source-paving-with-physical-roof', { sourceColor: 0x0000ff, mask: true }); assert(pave.centerRGBA[2] > 240 && pave.centerRGBA[0] < 10, 'source paving color lost');
            const road = run('source-overlying-road-with-physical-roof', { sourceColor: 0x00ffff, y: .24, sourceDepth: true, mask: true }); assert(road.centerRGBA[1] > 240 && road.centerRGBA[2] > 240 && road.centerRGBA[0] < 10, 'actual overlying road hidden');
            const waterMasked = run('opaque-mask-transparent-water-failure-control', { sourceColor: 0x0000ff, y: -4.4, water: true, mask: true });
            assert(waterMasked.centerRGBA[2] < 10, 'expected real opaque-mask/transparent-water failure not reproduced');
            assert(waterMasked.actualDrawOrder.indexOf('actual-transparent-water-control') > waterMasked.actualDrawOrder.indexOf('actual-World-depth-only-cover'), 'actual Three transparent draw-list ordering not recorded');
            const waterSkin = new MeshBuilder(); waterSkin.flatQuad(-5, -5, 5, -5, 5, 25, -5, 25, -4.4, [0, 0, 255]);
            const owner = buildUnderpassOwnerIndex([{ mesh: waterSkin, id: 'raw-water', water: true }], { fallbackM: -.3 }).forPolygon([[-4, 0], [-4, 20], [4, 20], [4, 0]]);
            assert(!owner.known && owner.reason === 'retained-water-topology-unresolved', 'unknown water must refuse a new mask');
            const water = run('refused-new-mask-water-policy-only', { sourceColor: 0x0000ff, y: -4.4, water: true, mask: owner.known }); assert(water.centerRGBA[2] > 240, 'unmasked transparent water control lost');
            const below = run('actual-model-ceiling-from-below', { sourceColor: null, mask: true, roofSolid: true, view: 'below' }); assert(below.centerRGBA[0] > 80 && below.centerRGBA[0] < 120 && below.centerRGBA[1] === below.centerRGBA[0], 'actual emitted underside missing');
            const side = run('actual-model-thickness-from-side', { sourceColor: null, roofSolid: true, view: 'side' }); assert(side.centerRGBA[0] > 80 && side.centerRGBA[0] < 120 && side.centerRGBA[1] === side.centerRGBA[0], 'actual emitted slab side missing');
            assert(results.every(r => r.glError === 0), 'actual GPU GL error');
            coverGeo.dispose(); solidGeo.dispose(); renderer.dispose();
            return { controls: results, model: { estimated: model.estimated, minClearanceM: model.minClearanceM, legalMaxheightM: model.legalMaxheightM }, unknownWater: owner, worldCoverMaterialDeclaration: declaration,
                limits: 'Water control proves refusal of a NEW opaque mask only; the full World legacy fallback remains unresolved.32px controls do not replace fresh full-size native pictures/passages or renderer budgets.' };
        }, base);
        for (const row of result.controls) { const b = Buffer.from(row.png.split(',')[1], 'base64'), name = row.name + '.png'; fs.writeFileSync(path.join(out, name), b); row.png = { file: name, bytes: b.length, sha256: sha(b) }; }
        report.result = result; if (report.errors.length || report.consoleErrors.length) throw Error('browser/shader errors recorded'); report.complete = true; report.endedAt = new Date().toISOString(); save();
    } catch (e) { report.errors.push(e.stack || e.message); save(); throw e; }
    finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); console.log('BROWSER-CLOSED'); }
})().catch(e => { console.error(e); process.exitCode = 1; });
