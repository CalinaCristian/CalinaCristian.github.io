#!/usr/bin/env node
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': path.extname(f) === '.js' ? 'text/javascript' : 'text/html' }); r.end(e ? 'missing' : b); }); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/game/index.html`, { waitUntil: 'domcontentloaded' });
        const result = await page.evaluate(async () => {
            const T = await import('/game/vendor/three.module.min.js'), W = await import('/game/src/water.js');
            const canvas = document.createElement('canvas'), renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true }); renderer.setSize(128, 128);
            const gl = renderer.getContext(), scene = new T.Scene(); scene.background = new T.Color('#10252f'); scene.add(new T.HemisphereLight('#ffffff', '#46564a', 2));
            const material = W.makeWaterMaterial(), camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100); camera.position.set(0, 15, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
            const missing = new T.PlaneGeometry(8, 8).rotateX(-Math.PI / 2); missing.setAttribute('aShore', new T.BufferAttribute(new Float32Array(missing.attributes.position.count), 1));
            material.userData.hasShore = true; material.needsUpdate = true;
            const ones = missing.clone(), zeros = missing.clone(); ones.setAttribute('aFoamReliable', new T.BufferAttribute(new Float32Array(ones.attributes.position.count).fill(1), 1)); zeros.setAttribute('aFoamReliable', new T.BufferAttribute(new Float32Array(zeros.attributes.position.count), 1));
            const mesh = new T.Mesh(missing, material); scene.add(mesh);
            const render = geometry => { mesh.geometry = geometry; renderer.info.reset(); renderer.render(scene, camera); const p = new Uint8Array(128 * 128 * 4); gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, p); return { pixels: p, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; };
            const changed = (a, b) => a.pixels.reduce((n, v, i) => n + (v !== b.pixels[i]), 0);
            const ordinary = render(ones), ordinaryMissing = render(missing), suppressed = render(zeros), restoredMissing = render(missing);
            if (changed(ordinary, ordinaryMissing) || changed(ordinary, restoredMissing) || !changed(ordinary, suppressed)) throw new Error('optional mask default did not preserve ordinary foam');
            material.userData.waterU.uWFoam.value = 0;
            const tintOne = render(ones), tintMissing = render(missing), tintZero = render(zeros);
            if (changed(tintOne, tintMissing) || !changed(tintOne, tintZero)) throw new Error('ordinary source shallow tint default or unsupported-face suppression failed');
            const deep = ones.clone(); deep.attributes.aShore.array.fill(99); const deepZero = deep.clone(); deepZero.attributes.aFoamReliable.array.fill(0);
            const deepOnePixels = render(deep), deepZeroPixels = render(deepZero);
            if (changed(deepOnePixels, deepZeroPixels)) throw new Error('true deep-water tint changed');
            material.userData.waterU.uWFoam.value = 1;
            const source = W.makeSourceShoreSampler([{ sourceId: 'source-water-with-island', outer: [[0, 0], [100, 0], [100, 100], [0, 100]], holes: [[[40, 40], [60, 40], [60, 60], [40, 60]]] }]);
            const hole = new T.BufferGeometry(); hole.setAttribute('position', new T.Float32BufferAttribute([40, 0, 45, 36, 0, 45, 40, 0, 49], 3)); hole.computeVertexNormals();
            const originalPosition = hole.attributes.position.array.slice(); W.computeShoreDistance(hole, { material, sourceSampler: source });
            const noHoleFoam = hole.clone(); noHoleFoam.setAttribute('aFoamReliable', new T.BufferAttribute(new Float32Array(3), 1));
            camera.left = 34; camera.right = 42; camera.top = -42; camera.bottom = -50; camera.position.set(0, 15, 0); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
            const holePositive = render(hole), holeSuppressed = render(noHoleFoam);
            if (!changed(holePositive, holeSuppressed) || !originalPosition.every((v, i) => Object.is(v, hole.attributes.position.array[i])) || !hole.attributes.aFoamReliable.array.every(v => v === 1)) throw new Error('reliable source-hole shoreline lost foam or geometry');
            const islandIndex = (64 * 128 + 112) * 4, islandRGB = [...holePositive.pixels.slice(islandIndex, islandIndex + 3)];
            if (islandRGB.some((v, i) => v !== holeSuppressed.pixels[islandIndex + i])) throw new Error('dry source-hole control changed');
            for (const g of [missing, ones, zeros, hole, noHoleFoam, deep, deepZero]) g.dispose(); W.disposeWater(material); renderer.dispose();
            return { passed: true, ordinaryTintMissingVsOneChangedBytes: changed(tintOne, tintMissing), ordinaryShallowTintPositiveChangedBytes: changed(tintOne, tintZero), trueDeepWaterMaskChangedBytes: changed(deepOnePixels, deepZeroPixels), missingAttributeDefault: material.defaultAttributeValues.aFoamReliable, ordinaryMissingVsOneChangedBytes: changed(ordinary, ordinaryMissing), ordinaryRestoredMissingChangedBytes: changed(ordinary, restoredMissing), ordinaryFoamPositiveChangedBytes: changed(ordinary, suppressed), sourceHoleFoamPositiveChangedBytes: changed(holePositive, holeSuppressed), trueHoleShoreDistances: [...hole.attributes.aShore.array], reliableHoleMask: [...hole.attributes.aFoamReliable.array], sourcePositionsUnchanged: true, dryIslandRGB: islandRGB, callsPerControl: ordinary.calls, trianglesPerOrdinaryControl: ordinary.triangles };
        }); console.log(JSON.stringify(result, null, 2));
    } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exit(1); });
