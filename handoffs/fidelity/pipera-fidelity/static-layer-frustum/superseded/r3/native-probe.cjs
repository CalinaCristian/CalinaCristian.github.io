// Native c78 Unirii first150m A/B. Metadata-only source annotation precedes the
// comparison; only complete original static cell spans are culled afterward.
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const [rootArg, outArg, productionArg, helperArg] = process.argv.slice(2), root = path.resolve(rootArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const layers = ['area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad', 'marks'];
const baseline = fs.readFileSync(path.join(root, 'game/src/world.js'), 'utf8');
const site = "if (layer === 'solid' || layer === 'roof') {";
if (!baseline.includes(site)) throw Error('Requires unchanged c78 solid/roof span hook');
const productionPath = path.resolve(productionArg || path.join(__dirname, '../../../../game/src/world.js'));
const production = fs.readFileSync(productionPath, 'utf8');
const helperPath = path.resolve(helperArg || path.join(__dirname, '../../../../game/src/cell-frustum.js')), helper = fs.readFileSync(helperPath);
const condition = "if (['solid', 'roof', 'area', 'grass', 'pave', 'sport', 'ground', 'road', 'pad', 'marks'].includes(layer)) {";
const originalInstall = 'if (o.parts) cullMergedCells(m, o.parts);';
const install = "if (o.parts) cullMergedCells(m, o.parts, { blockTriangles: o.layer === 'ground' || o.layer === 'grass' ? 64 : 0 });";
if (production !== baseline.replace(site, condition).replace(originalInstall, install)) throw Error('Unexpected production delta beyond the static-layer condition and block option');
let annotated = production;
const add = 'const m = addMesh(o.mb, mat, cast, `${name} ${o.I},${o.J}`); if (!m) return null;';
if (!annotated.includes(add)) throw Error('Requires unchanged c78 merged construction');
annotated = annotated.replace(add, add + ` if(${JSON.stringify(layers)}.includes(o.layer)) {
 m.userData.proofCellParts=o.parts;
 m.userData.proofBefore={sourceIndex:m.geometry.index,range:{...m.geometry.drawRange},attrs:{...m.geometry.attributes},helperStart:performance.now()};
 }`);
if (!annotated.includes(install)) throw Error('Requires unchanged merged-cell helper installation');
annotated = annotated.replace(install, install + ` if(m.userData.proofBefore) {
 const p=m.userData.proofBefore;
 if(m.userData.cellFrustum){const c={...p,preprocessingMs:performance.now()-p.helperStart,mesh:m,geometry:m.geometry,output:m.geometry.index,render:m.onBeforeRender,shadow:m.onBeforeShadow};m.userData.proofControl=c;
 m.onBeforeRender=()=>{m.geometry.setIndex(c.sourceIndex);m.geometry.setDrawRange(c.range.start,c.range.count)};m.onBeforeShadow=m.onBeforeRender;
 }else delete m.userData.proofCellParts;
 }`);
const report = { sourceCommit: 'c78a5f4c522723fb2f4e640999e3ac5d164fc724', root, complete: false, startedAt: new Date().toISOString(),
    method: 'Native public Unirii rush/summer/clear first150m drive at30Hz, full high/native far/1280x720/mirror/true sun shadow. The actual production helper is installed during construction. QA metadata records its original index and callbacks, selecting the canonical index for before frames, then restoring the production callbacks for after frames. Same scene and actors throughout.',
    source: {}, sourceOverrides: { 'game/src/world.js': hash(annotated), 'game/src/cell-frustum.js': hash(helper) }, errors: [], consoleErrors: [], frames: [], reflectionControls: [], failures: [] };
for (const name of ['game/src/world.js', 'game/src/cell-frustum.js', 'game/src/render.js', 'game/src/traffic.js', 'game/src/trees.js', 'game/src/player.js', 'game/src/progressive-pmrem.js', 'game/data/bucharest-unirii.json']) report.source[name] = hash(fs.readFileSync(path.join(root, name)));
report.runnerSha256 = hash(fs.readFileSync(__filename));
report.productionWorldSha256 = hash(production);
report.productionHelperSha256 = hash(helper);
report.runtime = { node: process.version, chromium: '/usr/bin/chromium', gpu: 'SwiftShader software GL; no hardware FPS claim', externalPreloads: process.execArgv.flatMap((arg,i) => arg === '--require' ? [{path:process.execArgv[i+1],sha256:hash(fs.readFileSync(process.execArgv[i+1]))}] : []) };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();
const server = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]), file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep)) { r.writeHead(403).end(); return; }
    const send = (e, bytes) => { r.writeHead(e ? 404 : 200, { 'content-type': ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(e ? '' : bytes); };
    if (rel === '/game/src/world.js') send(null, Buffer.from(annotated)); else if (rel === '/game/src/cell-frustum.js') send(null, helper); else fs.readFile(file, send);
});
let browser;
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { report.errors.push(e.stack || e.message); save(); });
    page.on('console', m => { if (m.type() === 'error') { report.consoleErrors.push(m.text()); save(); } });
    await page.route(/api\.open-meteo\.com/, route => route.fulfill({ json: { error: true } }));
    await page.goto(base + 'game/index.html?notrack'); await page.waitForFunction(() => window.game);
    await page.addScriptTag({ type: 'module', url: base + 'game/dev/harness/page/index.js' }); await page.waitForFunction(() => window.harness);
    await page.evaluate(() => {
        const H = harness.H; H.noShots = true; H.renderEvery = 0;
        H.renderFrame = () => { H._renderNow = true; try { game.drawFrame({ mirror: true }); const gl = game.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } finally { H._renderNow = false; } };
        game.quality = 'high'; game.r3d.setQuality('high'); game.audio.setMuted(true);
    });
    await page.evaluate(() => game.startFreeRoam('unirii', { tod: 'rush', weather: 'clear', season: 'summer' }));
    report.initial = await page.evaluate(async () => {
        const g = game, H = harness.H, P = g.player, T = g.traffic, THREE = await import('/game/vendor/three.module.min.js');
        H.begin('native-final'); P.mirrorEnabled = true; g.input.setLookMode('hold'); g.input.rmb = false;
        const start = { x: P.x, z: P.z, heading: P.heading }, poi = g.world.pois.find(p => p.id === 'gts');
        const route = g.nav.compute(P.x, P.z, poi.doorX ?? poi.x, poi.doorZ ?? poi.z, P.heading); let k = 0;
        while (k < route.cum.length - 2 && route.cum[k + 1] < 150) k++;
        const a = route.points[k], b = route.points[k + 1], t = (150 - route.cum[k]) / (route.cum[k + 1] - route.cum[k]);
        const target = { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
        g.setRoamTime('rush'); g.setRoamWeather('clear'); g.setRoamSeason('summer'); g.input.keys.clear(); g.input.touch.throttle = 0; g.input.touch.steer = 0; g.input.touch.brake = false;
        const pose = g.lanePose(start.x, start.z, start.heading); P.place(pose.x, pose.z, pose.heading, pose.edge); T.setPlayer(P); T.clearForPlayer(P); g.clamp = null; H.begin('native-final-day'); H.refuelInstant();
        window.CULL = { THREE, start, target, draws: [], count: false, sourcePeople: [...T.peds.list], sourceVehicles: [...T.vehicles], controls: [] };
        g.scene.traverse(mesh => { if (mesh.userData.proofControl) CULL.controls.push(mesh.userData.proofControl); });
        CULL.physical = () => {
            const W = g.world, bodyKeys = ['x','z','r','poly','holes','hw','hd','angle','h','minH','yMin','yMax','sourceId','wall','kind','ax','az','bx','bz','y0a','y1a','y0b','y1b','nx','nz'];
            const bodies = W.buildings.map(o => Object.fromEntries(bodyKeys.filter(k => o[k] !== undefined).map(k => [k, o[k]])));
            const roads = W.allEdges.map(e => ({ id: e.id, a: [e.a.x,e.a.z], b: [e.b.x,e.b.z], ya: e.ya, yb: e.yb, wL: e.wL, wR: e.wR, lanesF: e.lanesF, lanesB: e.lanesB, oneway: e.oneway, drivable: e.drivable }));
            const surfaces = W.allEdges.map(e => { const x = (e.a.x+e.b.x)/2, z = (e.a.z+e.b.z)/2; return [e.id,W.surfacesAt(x,z),W.roadHeight(x,z,{y:.24,edge:e}),W.walkTop(x,z)]; });
            return JSON.stringify({ bodies, roads, surfaces, trees: W.vegetation.trees });
        };
        CULL.actors = () => JSON.stringify({ vehicles: T.vehicles.map(v => [v.id,v.x,v.z,v.y,v.heading,v.speed,v.live]), pool: T.pool.map(v => v.id), pedestrians: T.peds.list.map(p => [p.i,p.x,p.z,p.y,p.state,p.onRoad,p.live]) });
        return { start, target, counts: { ...T.counts }, vehicles: T.vehicles.map(v => v.id), people: T.peds.list.map(p => p.i), quality: g.quality };
    }); save(); console.log('LOADED', report.initial.vehicles.length, report.initial.people.length);
    await page.evaluate(() => harness.H.run(.5)); await page.evaluate(() => { harness.H.renderFrame(); harness.H.renderFrame(); });
    report.drive = await page.evaluate(() => harness.H.driveTo(CULL.target.x, CULL.target.z, { label: 'first150m', arriveR: 9, timeout: 120, speedMul: .7, stop: false })); save(); console.log('DRIVE', JSON.stringify(report.drive));
    report.baselineNative = await page.evaluate(() => ({ pose: { x: game.player.x, z: game.player.z, y: game.player.surfY, heading: game.player.heading,speed:game.player.speed }, camera:{fov:game.camera.fov,far:game.camera.far,position:game.camera.getWorldPosition(new CULL.THREE.Vector3()).toArray(),quaternion:game.camera.getWorldQuaternion(new CULL.THREE.Quaternion()).toArray()}, population: { vehicles: game.traffic.vehicles.length, people: game.traffic.peds.list.length } }));
    if (Math.hypot(report.baselineNative.pose.x + 580.1437011509073, report.baselineNative.pose.z - 417.816191281258) > 1e-7) throw Error('Native first150m pose changed');
    await page.evaluate(() => {
        const g = game, S = CULL, THREE = S.THREE, renderer = g.renderer, draw = renderer.renderBufferDirect.bind(renderer);
        S.heading = g.player.heading; S.physicalBefore = S.physical(); S.actorsBefore = S.actors();
        S.rigRotation=g.player.rig.rotation.toArray();S.fov=g.camera.fov;
        renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
            const before = { ...renderer.info.render }; draw(camera, scene, geometry, material, object, group); if (!S.count) return;
            const calls = renderer.info.render.calls-before.calls, triangles = renderer.info.render.triangles-before.triangles; if (!calls) return;
            const pass = camera === g.camera ? 'main' : camera === g.player.mirrorCam ? 'mirror' : camera === g.r3d.sun.shadow.camera ? 'true-shadow' : 'other';
            let potential = 0;
            if (object.userData.proofCellParts) {
                const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),renderer.coordinateSystem);
                for (const part of object.userData.proofCellParts) { const b = part.bounds, box = new THREE.Box3(new THREE.Vector3(...b.slice(0,3)),new THREE.Vector3(...b.slice(3))).expandByScalar(.01).applyMatrix4(object.matrixWorld); if (!frustum.intersectsBox(box)) potential += part.count/3; }
            }
            S.draws.push({ pass, calls, triangles, object: object.name || object.type, material: material.name || material.type, staticLayer: object.userData.proofCellParts?.[0]?.layer, potentialOffCameraTriangles: potential });
        };
        S.realNow = performance.now.bind(performance); const now = performance.now(); Object.defineProperty(performance,'now',{value:()=>now,configurable:true}); g.r3d._lastNow = now;
        S.stepEnv = g.r3d._stepEnvJob; S.fadeEnv = g.r3d._stepEnvFade; g.r3d._stepEnvJob = () => {}; g.r3d._stepEnvFade = () => {};
    });
    report.comparisonFreeze = 'Only performance.now and in-flight reflection publication are held constant for A/B. Actual mirror and true shadow cameras still draw. Real time and reflection stepping are restored for the final native frame.';
    async function frame(label) {
        const row = await page.evaluate(label => { const g = game, S = CULL; S.draws = []; S.selectionTimes=[];S.count = true; harness.H.renderFrame(); S.count = false; return { label, draws: S.draws, stats: { ...g.r3d.stats }, people: g.traffic.peds.list.length, vehicles: g.traffic.vehicles.length, originalPeople: g.traffic.peds.list.every(p => S.sourcePeople.includes(p)), originalVehicles: g.traffic.vehicles.every(v => S.sourceVehicles.includes(v)), envJob: !!g.r3d._envJob, envFade: g.r3d._envFade,camera:{fov:g.camera.fov,far:g.camera.far,position:g.camera.getWorldPosition(new S.THREE.Vector3()).toArray(),quaternion:g.camera.getWorldQuaternion(new S.THREE.Quaternion()).toArray()},selectionCpu:{calls:S.selectionTimes.length,totalMs:S.selectionTimes.reduce((a,b)=>a+b,0),maxMs:S.selectionTimes.length?Math.max(...S.selectionTimes):0} }; }, label);
        row.logical = row.draws.reduce((a,r) => ({ calls: a.calls+r.calls, triangles: a.triangles+r.triangles }), { calls: 0, triangles: 0 });
        row.potential = row.draws.reduce((a,r) => a+r.potentialOffCameraTriangles,0); report.frames.push(row);
        if (row.people !== 560 || row.vehicles !== 624 || !row.originalPeople || !row.originalVehicles) report.failures.push({ label, kind: 'population-changed' });
        if (!row.draws.some(r => r.pass === 'mirror') || !row.draws.some(r => r.pass === 'true-shadow')) report.failures.push({ label, kind: 'missing-native-pass' });
        if (row.logical.calls > 400 || row.logical.triangles > 1500000) report.failures.push({ label, kind: 'budget', ...row.logical });
        save(); console.log('FRAME', label, row.logical.calls, row.logical.triangles, 'potential', row.potential); return row;
    }
    async function selectMode(enabled) { await page.evaluate(enabled => { const S=CULL,timed=fn=>(...args)=>{const t=S.realNow();fn(...args);S.selectionTimes.push(S.realNow()-t);};for (const c of S.controls) { c.geometry.setIndex(enabled ? c.output : c.sourceIndex); c.mesh.onBeforeRender = enabled ? timed(c.render) : () => { c.geometry.setIndex(c.sourceIndex); c.geometry.setDrawRange(c.range.start,c.range.count); }; c.mesh.onBeforeShadow = enabled ? timed(c.shadow) : c.mesh.onBeforeRender; } }, enabled); }
    async function direction(turn) {await page.evaluate(turn=>{const S=CULL,P=game.player;P.heading=S.heading+turn;P.rig.rotation.set(S.rigRotation[0],P.heading,S.rigRotation[2],S.rigRotation[3]);game.camera.fov=S.fov;game.camera.updateProjectionMatrix();game.camera.updateMatrixWorld(true);},turn);}
    await frame('native-before-target');
    report.optimization = await page.evaluate(() => {
        let meshes=0,sourceComponents=0,components=0,childBoxes=0,worldBoxes=0,canonicalIndices=0,extraIndexBytes=0,attributes=0,preprocessingMs=0;
        for (const c of CULL.controls) {const parts=c.mesh.userData.proofCellParts,d=c.mesh.userData.cellFrustum;let cursor=0;for(const part of parts){if(part.start!==cursor)throw Error('Noncanonical source span');cursor+=part.count;}if(cursor!==c.sourceIndex.count)throw Error('Incomplete source spans');
            for(const [k,v] of Object.entries(c.attrs)){if(c.geometry.attributes[k]!==v)throw Error('Attribute changed');attributes++;}
            meshes++;sourceComponents+=parts.length;components+=d.components;childBoxes+=d.childBoxes;worldBoxes+=d.worldBoxes;canonicalIndices+=c.sourceIndex.count;extraIndexBytes+=c.output.array.byteLength;preprocessingMs+=c.preprocessingMs;
        }return{meshes,sourceComponents,components,childBoxes,worldBoxes,canonicalIndices,extraIndexBytes,childBoundsNumericPayloadBytes:childBoxes*6*8,worldBoundsNumericPayloadBytes:worldBoxes*6*8,preprocessingMs,unchangedAttributeObjects:attributes,extraDrawCalls:0,sourceOrder:'Complete original component spans and contiguous64-triangle ground/grass blocks; surviving index order unchanged',memoryScope:'Exact added typed-index storage and numeric bounding-box payload. JavaScript object headers/allocator and driver storage are not inferred.'};
    });save();
    for (const season of ['summer','winter']) {
        await page.evaluate(season => game.setRoamSeason(season), season);
        for (const [name,turn] of [['forward',0],['left',Math.PI/2],['back',Math.PI],['right',-Math.PI/2]]) {
            await direction(turn);
            for (const phase of ['before','after']) {
                await selectMode(phase === 'after');
                await frame(`${season}-${phase}-${name}-warm`); await frame(`${season}-${phase}-${name}`);
                await page.screenshot({path:path.join(out,`${season}-${phase}-${name}.png`),type:'png'});
            }
        }
        await direction(0);
        const reflection = await page.evaluate(() => { const g=game,S=CULL;g.r3d._stepEnvJob=S.stepEnv;g.r3d._stepEnvFade=S.fadeEnv;Object.defineProperty(performance,'now',{value:S.realNow,configurable:true});g.r3d._lastNow=performance.now();const requested=!g.r3d._envJob;if(requested)g.r3d._buildEnvMap();if(!g.r3d._envJob)throw Error('Native progressive reflection job unavailable');return{requested,pendingBefore:true,method:requested?'Explicit QA request through the unchanged native progressive reflection builder; actual native stepping and all draws are counted.':'Existing native progressive reflection job; actual stepping and all draws are counted.'}; });
        report.reflectionControls.push({season,...reflection});
        await frame(`${season}-after-native-reflection-step-warm`);
        await frame(`${season}-after-native-reflection-step`);
        await page.evaluate(() => { const g=game,S=CULL,now=S.realNow();Object.defineProperty(performance,'now',{value:()=>now,configurable:true});g.r3d._lastNow=now;g.r3d._stepEnvJob=()=>{};g.r3d._stepEnvFade=()=>{}; });
    }
    report.offCameraGround = await page.evaluate(() => {
        const S=CULL,T=S.THREE,g=game,frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(g.camera.projectionMatrix,g.camera.matrixWorldInverse),g.renderer.coordinateSystem);
        for(const c of S.controls.filter(c=>c.mesh.name.startsWith('ground '))){const geom=c.geometry,P=geom.attributes.position,I=c.sourceIndex;
            for(const [component,part] of c.mesh.userData.proofCellParts.entries()){const b=part.bounds,box=new T.Box3(new T.Vector3(...b.slice(0,3)),new T.Vector3(...b.slice(3))).expandByScalar(.01).applyMatrix4(c.mesh.matrixWorld);if(!frustum.intersectsBox(box))continue;
                for(let k=part.start;k<part.start+part.count;k+=3){const a=new T.Vector3().fromBufferAttribute(P,I.getX(k)).applyMatrix4(c.mesh.matrixWorld),b=new T.Vector3().fromBufferAttribute(P,I.getX(k+1)).applyMatrix4(c.mesh.matrixWorld),d=new T.Vector3().fromBufferAttribute(P,I.getX(k+2)).applyMatrix4(c.mesh.matrixWorld);if(new T.Vector3().crossVectors(b.clone().sub(a),d.clone().sub(a)).y<1e-5)continue;
                    const target=a.add(b).add(d).multiplyScalar(1/3);if(frustum.containsPoint(target))continue;const ray=new T.Raycaster(target.clone().add(new T.Vector3(0,500,0)),new T.Vector3(0,-1,0)),selected=geom.index,range={...geom.drawRange},subset=[];T.Mesh.prototype.raycast.call(c.mesh,ray,subset);if(subset.some(h=>h.point.distanceTo(target)<1e-4))continue;
                    const hit=ray.intersectObject(c.mesh).find(h=>h.faceIndex===k/3&&h.point.distanceTo(target)<1e-4);if(!hit)throw Error('Canonical off-camera ground query missed');if(geom.index!==selected||geom.drawRange.start!==range.start||geom.drawRange.count!==range.count)throw Error('Physical query changed render selection');return{passed:true,mesh:c.mesh.name,component,originalCellVisible:true,fineBlockCulled:true,canonicalFaceIndex:k/3,target:target.toArray(),hit:hit.point.toArray(),subsetMissed:true,renderSelectionRestored:true};
                }
            }
        }throw Error('No actual off-camera ground control');
    });
    report.invariants = await page.evaluate(() => ({ physicalOutputsEqual:CULL.physicalBefore===CULL.physical(),actorStateEqual:CULL.actorsBefore===CULL.actors(),attributesUnchanged:CULL.controls.every(c=>Object.entries(c.attrs).every(([k,v])=>c.geometry.attributes[k]===v)),controlMeshes:CULL.controls.length,quality:game.r3d.stats.quality,far:game.camera.far,pixelRatio:game.renderer.getPixelRatio(),mirrorFar:game.player.mirrorCam.far }));
    if (!report.invariants.physicalOutputsEqual || !report.invariants.actorStateEqual || !report.invariants.attributesUnchanged) throw Error('Canonical/physical/actor invariants changed');
    await direction(0);
    await page.evaluate(() => { const g=game,S=CULL;g.r3d._stepEnvJob=S.stepEnv;g.r3d._stepEnvFade=S.fadeEnv;Object.defineProperty(performance,'now',{value:S.realNow,configurable:true});g.r3d._lastNow=performance.now(); });
    report.baselineBudgetFailures=report.failures.filter(f=>f.label.includes('-before-'));report.failures=report.failures.filter(f=>!f.label.includes('-before-'));report.complete=true;report.endedAt=new Date().toISOString();
})().catch(e=>{report.fatal=e.stack;process.exitCode=1;}).finally(async()=>{save();await browser?.close();await new Promise(resolve=>server.close(resolve));if(report.errors.length||report.consoleErrors.length||report.failures.length)process.exitCode=1;});
