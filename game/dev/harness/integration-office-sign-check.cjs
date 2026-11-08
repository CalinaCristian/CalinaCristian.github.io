// Actual authored Office scenes/sign textures; standalone to avoid loading unrelated districts.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
const helper = '/game/dev/harness/visual/page/office-sign-frame.js';
const report = { root, scope: 'Actual Office constructor, authored geometry and sign texture; desktop/portrait front-facing QA capture and exact camera restoration, not office walking/dialogue.', source: {}, cases: [], errors: [], consoleErrors: [] };
for (const file of ['game/src/office.js', 'game/src/data.js', 'game/vendor/three.module.min.js']) report.source[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
report.qaHelperSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'visual/page/office-sign-frame.js'))).digest('hex');
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const server = http.createServer((q, r) => {
    const uri = decodeURIComponent(q.url.split('?')[0]);
    if (uri === '/__office.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style><script type="module">import * as THREE from "/game/vendor/three.module.min.js";import {Office} from "/game/src/office.js";import {STOPS} from "/game/src/data.js";import {frameOfficeSign} from "' + helper + '";window.qa={THREE,Office,STOPS,frameOfficeSign};</script>'); return; }
    const file = uri === helper ? path.join(__dirname, 'visual/page/office-sign-frame.js') : path.join(root, uri);
    fs.readFile(file, (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': { '.js': 'text/javascript', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream' }); r.end(e ? 'missing' : b); });
});
let browser;
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); require('./integration-browser-bounds.cjs').boundEvaluations(page);
    page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/__office.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.qa, null, { timeout: 60000 });
    const ids = await page.evaluate(() => qa.STOPS.map(s => s.id));
    for (const [width, height] of [[1280, 720], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (const id of ids) {
            const row = await page.evaluate(({ id, width, height }) => {
                const { THREE, Office, STOPS, frameOfficeSign } = qa, stop = STOPS.find(s => s.id === id);
                const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(width, height); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.append(renderer.domElement);
                const camera = new THREE.PerspectiveCamera(73, width / height, .1, 500);
                const office = new Office(renderer, camera, stop, {}, { releaseLock() {} }, {});
                let oldPose;
                if (id === 'rosetti') {
                    office.camRig.position.set(0, 1.75, -9); office.camRig.rotation.set(0, 0, 0);
                    camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld(true);
                    office.render();
                    const eye = camera.getWorldPosition(new THREE.Vector3()), centre = office.signMesh.getWorldPosition(new THREE.Vector3());
                    oldPose = { signInFront: centre.clone().sub(eye).dot(camera.getWorldDirection(new THREE.Vector3())) > 0, image: renderer.domElement.toDataURL('image/png') };
                }
                office.camRig.position.set(0, 1.75, -9); office.camRig.rotation.y = .17;
                camera.position.set(.1, .2, .3); camera.rotation.set(.03, -.08, .04); camera.fov = 73; camera.zoom = 1.1; camera.updateProjectionMatrix();
                const before = { p: camera.position.toArray(), q: camera.quaternion.toArray(), fov: camera.fov, zoom: camera.zoom, far: camera.far, rig: office.camRig.position.toArray(), rq: office.camRig.quaternion.toArray() };
                const framed = frameOfficeSign(office); office.render();
                const rays = [], ray = new THREE.Raycaster(), eye = camera.getWorldPosition(new THREE.Vector3());
                for (const x of [-.49, 0, .49]) for (const y of [-.49, 0, .49]) {
                    const point = new THREE.Vector3(x * office.signMesh.geometry.parameters.width, y * office.signMesh.geometry.parameters.height, 0).applyMatrix4(office.signMesh.matrixWorld);
                    ray.set(eye, point.clone().sub(eye).normalize()); const first = ray.intersectObject(office.scene, true).find(h => h.object.material?.visible !== false);
                    rays.push({ x, y, signFirst: first?.object === office.signMesh, hit: first?.object.type, distance: first?.distance });
                }
                const image = renderer.domElement.toDataURL('image/png'); framed.restore();
                const after = { p: camera.position.toArray(), q: camera.quaternion.toArray(), fov: camera.fov, zoom: camera.zoom, far: camera.far, rig: office.camRig.position.toArray(), rq: office.camRig.quaternion.toArray() };
                const result = { id, company: stop.company, width, height, proof: framed.proof, rays, restored: JSON.stringify(before) === JSON.stringify(after), image, oldPose };
                office.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); return result;
            }, { id, width, height });
            const file = `${id}-${width}x${height}.png`; fs.writeFileSync(path.join(out, file), Buffer.from(row.image.split(',')[1], 'base64')); delete row.image; row.file = file;
            if (row.oldPose) { row.oldPose.file = `${id}-${width}x${height}-before.png`; fs.writeFileSync(path.join(out, row.oldPose.file), Buffer.from(row.oldPose.image.split(',')[1], 'base64')); delete row.oldPose.image; }
            row.pass = row.proof.fits && row.restored && row.rays.every(r => r.signFirst) && (!row.oldPose || row.oldPose.signInFront === false); report.cases.push(row); save(); console.log(JSON.stringify({ id, width, height, pass: row.pass, fits: row.proof.fits, signRays: row.rays.filter(r => r.signFirst).length, restored: row.restored }));
        }
    }
    report.complete = true;
})().catch(e => { report.fatal = e.stack; process.exitCode = 1; }).finally(async () => { report.complete ??= false; save(); await browser?.close(); await new Promise(r => server.close(r)); if (report.errors.length || report.consoleErrors.length || report.cases.some(c => !c.pass)) process.exitCode = 1; });
