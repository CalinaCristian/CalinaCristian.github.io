#!/usr/bin/env node
// Focused GPU regression for the actual world facade shader and balcony shell. No production debug exports.
// node game/dev/harness/facades.js --out=/tmp/facades [--root=/path/to/baseline]
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const opts = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const root = path.resolve(opts.root || path.join(__dirname, '../../..'));
const out = path.resolve(opts.out || '/tmp/dmcv-facades');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (url === '/facade-test.html') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><style>body{margin:0}</style><canvas></canvas>'); return; }
    const file = path.join(root, url);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
        if (url === '/game/src/world.js') data = Buffer.concat([data, Buffer.from('\nexport { solidMaterial, makeAtlas };\n')]);
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/facade-test.html`);
        const results = await page.evaluate(async () => {
            const THREE = await import('/game/vendor/three.module.min.js');
            const { MeshBuilder } = await import('/game/src/geobuild.js');
            const B = await import('/game/src/buildings.js');
            const { solidMaterial, makeAtlas } = await import('/game/src/world.js');
            const checks = [], check = (name, pass, data) => checks.push({ name, pass, ...data });
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
            const x = canvas.getContext('2d'); x.fillStyle = 'white'; x.fillRect(0, 0, 1024, 1024);
            x.fillStyle = 'rgb(35,55,85)'; x.fillRect(16, 768 + 16, 224, 224);
            const atlas = new THREE.CanvasTexture(canvas), mat = solidMaterial(atlas), mode = { value: 0 };
            const hook = mat.onBeforeCompile;
            mat.onBeforeCompile = (sh, r) => {
                hook(sh, r); sh.uniforms.facadeProbeMode = mode;
                sh.fragmentShader = 'uniform float facadeProbeMode;\nvec4 facadeProbe;\n' + sh.fragmentShader
                    .replace('void main() {', 'void main() { facadeProbe = vec4(0.0);')
                    .replace('vec3 hp = p0 + dd * t;', 'vec3 hp = p0 + dd * t; facadeProbe = facadeProbeMode < 0.5 ? vec4(RW, RH, RD, 1.0) : vec4(hp, 1.0);')
                    .replace('#include <opaque_fragment>', 'gl_FragColor = facadeProbe; return;');
            };
            const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: false, preserveDrawingBuffer: true });
            renderer.setSize(960, 720); renderer.setPixelRatio(1);
            const target = new THREE.WebGLRenderTarget(960, 720, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
            const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(48, 960 / 720, .1, 100), secondCam = cam.clone();
            const pixel = new Float32Array(4);
            const read = (px, py) => { renderer.readRenderTargetPixels(target, px, py, 1, 1, pixel); return Array.from(pixel); };
            const render = camera => { renderer.setRenderTarget(target); renderer.render(scene, camera); };
            let maxAnchorError = 0;
            const records = [];
            // Both source windings, translated/rotated cell coordinates, and alternating main/secondary cameras.
            for (const sign of [1, -1]) for (const cell of [0, 1]) {
                const mb = new MeshBuilder(true); mb.wall(-2, 0, 2, 0, 0, 3, 0, sign, [255, 255, 255], 0, 1, 0, 1, 0);
                const mesh = new THREE.Mesh(mb.build(), mat); mesh.rotation.y = cell ? .61 : 0; mesh.position.set(cell * 650, 0, cell * -550); scene.add(mesh); mesh.updateMatrixWorld(true);
                const transform = (p) => new THREE.Vector3(...p).applyMatrix4(mesh.matrixWorld);
                const aim = transform([0, 1.5, 0]);
                cam.position.copy(transform([0, 1.5, sign * 5])); cam.lookAt(aim); cam.updateMatrixWorld(true); mode.value = 0; render(cam);
                const centre = read(480, 360), dims = centre.slice(0, 3);
                const depths = [read(400, 360)[2], centre[2], read(560, 360)[2]];
                check(`one-room-winding${sign}-cell${cell}`, Math.max(...depths) - Math.min(...depths) < 1e-5, { depths });
                const origin = [-2 + (16 / 256 - .006) / .988 * 4, (16 / 256 - .006) / .988 * 3];
                const span = [224 / 256 / .988 * 4, 224 / 256 / .988 * 3];
                check(`metre-scale-winding${sign}-cell${cell}`, Math.abs(dims[0] - span[0]) < .002 && Math.abs(dims[1] - span[1]) < .002, { dims, expected: span });
                const feature = transform([origin[0] + span[0] * .6, origin[1] + span[1] * .55, -sign * dims[2]]);
                for (const [id, dx, yaw] of [['base', 0, 0], ['slide01', .1, 0], ['slide1', 1, 0], ['rotate', 0, .2], ['secondary', -.6, -.15], ['main-after-secondary', 0, 0]]) {
                    const camera = id === 'secondary' ? secondCam : cam;
                    camera.position.copy(transform([dx, 1.5, sign * 5])); camera.lookAt(transform([dx + yaw, 1.5 + yaw * .3, 0])); camera.updateMatrixWorld(true);
                    const projected = feature.clone().project(camera), px = Math.floor((projected.x + 1) * 480), py = Math.floor((projected.y + 1) * 360);
                    mode.value = 1; render(camera); const hit = read(px, py);
                    // Compare the exact ray at the pixel centre with a fixed back-wall feature, including pixel rounding.
                    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((px + .5) / 480 - 1, (py + .5) / 360 - 1), camera);
                    const inv = mesh.matrixWorld.clone().invert(), local = ray.ray.clone().applyMatrix4(inv);
                    const t = (-sign * dims[2] - local.origin.z) / local.direction.z;
                    const expected = local.at(t, new THREE.Vector3());
                    const err = Math.max(Math.abs(hit[0] - (expected.x - origin[0])), Math.abs(hit[1] - (expected.y - origin[1])), Math.abs(hit[2] - dims[2]));
                    maxAnchorError = Math.max(maxAnchorError, err);
                    records.push({ sign, cell, id, hit, expected: [expected.x - origin[0], expected.y - origin[1], dims[2]], errorM: err });
                    check(`anchoring-${sign}-${cell}-${id}`, hit[3] > .9 && err < .003, { errorM: err });
                }
                scene.remove(mesh); mesh.geometry.dispose();
            }
            let balcony = null;
            if (B.emitFacadeSlab) {
                const mb = new MeshBuilder(true), frame = { ax: 0, az: 0, ux: 1, uz: 0, nx: 0, nz: 1 };
                B.emitFacadeSlab(mb, frame, 0, 2.9, 2.8, .12, 1.1, [80, 100, 120]);
                const floor = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); scene.add(floor);
                for (const [name, eye, direction, normal] of [
                    ['below', [0, 2, .6], [0, 1, 0], [0, -1, 0]], ['above', [0, 4, .6], [0, -1, 0], [0, 1, 0]],
                    ['left', [-2, 2.95, .6], [1, 0, 0], [-1, 0, 0]], ['right', [2, 2.95, .6], [-1, 0, 0], [1, 0, 0]],
                    ['front', [0, 2.95, 2], [0, 0, -1], [0, 0, 1]]
                ]) {
                    const ray = new THREE.Raycaster(new THREE.Vector3(...eye), new THREE.Vector3(...direction));
                    const hit = ray.intersectObject(floor)[0];
                    check(`balcony-${name}-frontside`, !!hit && hit.face.normal.dot(new THREE.Vector3(...normal)) > .99, { hit: hit?.point.toArray(), normal: hit?.face.normal.toArray() });
                }
                B.emitFacadeSlab(mb, frame, 0, 3.02, 2.8, .95, 1.1, [40, 90, 150], { back: 1.02, soffit: false });
                floor.geometry.dispose(); floor.geometry = mb.build();
                balcony = { triangles: mb.ic / 3 };
                check('balcony-shell-budget', mb.ic / 3 === 20, balcony);
                scene.remove(floor); window.facadeBalcony = floor;
            } else check('balcony-shell-helper', false, {});
            // Human review frames use the unmodified production material with an actual city atlas.
            const displayMat = solidMaterial(makeAtlas()); displayMat.emissiveIntensity = 1;
            const mb = new MeshBuilder(true); mb.wall(-3, 0, 3, 0, 0, 3.4, 0, 1, [255, 255, 255], 0, 1, 0, .5, 0);
            scene.add(new THREE.Mesh(mb.build(), displayMat)); scene.add(new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 2)); scene.background = new THREE.Color('#6c899b');
            renderer.setRenderTarget(null);
            window.facadeTest = { THREE, renderer, scene, cam };
            return { checks, maxAnchorErrorM: maxAnchorError, records, balcony };
        });
        for (const [id, pos, aim] of [['front', [0, 1.7, 4], [0, 1.7, 0]], ['slide01', [.1, 1.7, 4], [.1, 1.7, 0]], ['slide1', [1, 1.7, 4], [1, 1.7, 0]], ['rotate', [0, 1.7, 4], [.2, 1.8, 0]], ['side', [-2, 1.7, 4], [0, 1.7, 0]]]) {
            await page.evaluate(({ pos, aim }) => { const q = window.facadeTest; q.cam.position.fromArray(pos); q.cam.lookAt(...aim); q.renderer.render(q.scene, q.cam); }, { pos, aim });
            await page.locator('canvas').screenshot({ path: path.join(out, `${id}.png`) });
        }
        if (results.balcony) for (const [id, pos, aim] of [['below', [-2, 1.5, 3], [0, 3, .5]], ['above', [2, 5, 3], [0, 3, .5]], ['side', [3, 3.4, 2], [0, 3, .5]]]) {
            await page.evaluate(({ pos, aim }) => { const q = window.facadeTest; q.scene.clear(); q.scene.add(window.facadeBalcony); q.cam.position.fromArray(pos); q.cam.lookAt(...aim); q.renderer.render(q.scene, q.cam); }, { pos, aim });
            await page.locator('canvas').screenshot({ path: path.join(out, `balcony-${id}.png`) });
        }
        const report = { root, ...results, errors, passed: results.checks.filter(c => c.pass).length, failed: results.checks.filter(c => !c.pass).length };
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ out, passed: report.passed, failed: report.failed, maxAnchorErrorM: results.maxAnchorErrorM, errors }));
        process.exitCode = report.failed || errors.length ? 1 : 0;
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
