// GAME-only visitor illustrations. Run against an immutable aabd17ad runtime archive.
// No free camera, scene edits, reference imagery, crops or synthetic composition.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const sourceCommit = 'aabd17adfc8853c1ea23d3846782c5d1cc9be50f';
const repo = process.env.OVERVIEW_ROOT, archive = process.env.SOURCE_ROOT;
if (!repo || !archive) throw Error('OVERVIEW_ROOT and SOURCE_ROOT are required');
const out = path.join(repo, 'handoffs/fidelity/tourist-context-activities/proof/visit-gallery-aabd');
const manifest = JSON.parse(fs.readFileSync(path.join(archive, '../raw/source-manifest.json')));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const verify = () => { for (const [file, hash] of Object.entries(manifest.files)) if (sha(fs.readFileSync(path.join(archive, file))) !== hash) throw Error('Source changed: ' + file); return Object.keys(manifest.files).length; };
const report = { sourceCommit, overviewBase: 'e354a500e95a5f741564becf528af1f9445bd265', startedAt: new Date().toISOString(), sourceFilesVerifiedBefore: verify(), purpose: 'Visitor scene illustrations from staging, not released gameplay, public-route proof or a matched reference comparison.', setup: 'Native destination entry followed by explicit placement of the production on-foot controller at the scene-authored postcard viewpoint. All final look direction is acquired through actual CDP touch drags; no free camera. Phone JPEGs are the entire actual 390×844 page, including its native HUD.', records: [], errors: [] };
report.setup = 'Native destination entry, then explicit production-controller setup. Ballard retains its authored north-bank position and turns toward the chamber. Cathedral uses the exact mapped footway w1364230357 point [-641.2,287.9] south of the building. Original authored postcard views remain recorded. Both desktop and portrait framing use native CDP touch look; no free camera, scene edits or route claim.';
const save = () => fs.writeFileSync(path.join(out, process.env.REPORT || 'results.json'), JSON.stringify(report, null, 2) + '\n');
(async () => {
 const browser = await chromium.launch({headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
 try {
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, hasTouch: true, isMobile: true, deviceScaleFactor: 1});
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  page.setDefaultTimeout(180000); page.on('pageerror', e => { report.errors.push(e.message); save(); });
  await page.route(/api\.open-meteo\.com/, r => r.fulfill({json: {error: true}}));
  await page.addInitScript(() => requestAnimationFrame = () => 0);
  await page.goto(`http://127.0.0.1:${process.env.PORT || 8456}/game/?q=high`, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.game?.achievements);
  await page.evaluate(() => { window.stepVisit = (n = 1) => { for (let i = 0; i < n; i++) {game.syncModalControls(); game.spot.update(.05);} }; game.setRoamTime('day'); game.setRoamSeason('summer'); game.setRoamWeather('clear'); });
  const aim = async (bearing, pitch = 0) => {
   let drags = 0;
   for (; drags < 60; drags++) {
    const q = await page.evaluate(({bearing, pitch}) => { const s = game.spot, heading = -bearing * Math.PI / 180; return {dx: (((s.ctl.heading - heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / .0024, dy: (s.ctl.pitch - pitch * Math.PI / 180) / .0024, x: innerWidth * .74, y: innerHeight * .6}; }, {bearing, pitch});
    if (Math.abs(q.dx) < 24 && Math.abs(q.dy) < 24) return {drags, residualInputPixels: {x: q.dx, y: q.dy}};
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: q.x, y: q.y, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: q.x + Math.max(-70, Math.min(70, q.dx / 1.6)), y: q.y + Math.max(-130, Math.min(130, q.dy / 1.6)), id: 2}]});
    await page.evaluate(() => stepVisit());
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
   }
   throw Error('Native touch did not acquire scene direction');
  };
  const capture = async (id, kind, fullPage) => {
   const frame = await page.evaluate(() => { game.drawFrame(); const s = game.spot, p = game.camera.getWorldPosition(game.camera.position.clone()), d = game.camera.getWorldDirection(p.clone()); return {capturedAt: new Date().toISOString(), viewport: {width: innerWidth, height: innerHeight}, position: {...s.position}, pose: {position: p.toArray(), bearing: (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360, pitch: Math.asin(d.y) * 180 / Math.PI}, conditions: game.travelConditions(), simulationDate: game.r3d.simDate.toISOString(), triangles: game.r3d.stats.triangles, drawCalls: game.r3d.stats.drawCalls, cameraParent: game.camera.parent.name, ui: {touch: document.body.classList.contains('touch'), spotHUD: !!document.querySelector('#spot-ui .sp-card'), touchAction: !!document.querySelector('[data-btn=act]')}, canvas: document.querySelector('#gl').toDataURL('image/webp', .88)}; });
   const file = `assets/spots/${id}/visit-aabd/${kind}.${fullPage ? 'jpg' : 'webp'}`, target = path.join(repo, 'game/overview', file); fs.mkdirSync(path.dirname(target), {recursive: true});
   if (fullPage) await page.screenshot({path: target, type: 'jpeg', quality: 90, fullPage: true}); else fs.writeFileSync(target, Buffer.from(frame.canvas.split(',')[1], 'base64'));
   delete frame.canvas; const bytes = fs.readFileSync(target); return {kind, image: file, sourceCommit, ...frame, sha256: sha(bytes), bytes: bytes.length, fullPageHUD: fullPage};
  };
  const ids = fs.readdirSync(path.join(repo, 'game/overview/evidence/spots')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(id => !process.env.ONLY_SPOTS || process.env.ONLY_SPOTS.split(',').includes(id));
  for (const id of ids) {
   const record = {id, captures: []}; report.records.push(record); save();
   try {
    await page.setViewportSize({width: 1280, height: 720}); await page.evaluate(() => game.resize());
    await page.evaluate(id => game.enterSpot(id), id);
    record.setup = await page.evaluate(id => { const s = game.spot, authored = s.spot.challenges.find(c => c.id === id); if (!authored) throw Error('No authored postcard view'); const c = id === 'peoples-salvation-cathedral' ? {...authored, x: -641.2, z: 287.9, bearing: 355, pitch: 25, text: 'South facade from exact mapped footway w1364230357 point [-641.2,287.9]. Explicit native on-foot setup, not a walked route.'} : {...authored, bearing: 250, pitch: -20, text: 'At the authored north-bank viewpoint, turn toward the large lock chamber.'}; const arrival = {...s.position}; s.ctl.teleport(c.x, c.z, 0); s.input.flush(); stepVisit(); return {arrival, originalViewpoint: {...authored}, viewpoint: {...c}, position: {...s.position}, walker: s.walkerKind, sceneId: s.spot.sceneId, origin: s.spot.data.origin, projection: s.spot.data.projection}; }, id);
    record.look = await aim(record.setup.viewpoint.bearing, record.setup.viewpoint.pitch);
    await page.evaluate(() => {stepVisit(40); game.drawFrame();});
    record.captures.push(await capture(id, 'scene-east-footway', false)); save();
    await page.setViewportSize({width: 390, height: 844}); await page.evaluate(() => {game.resize(); stepVisit();});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 285, y: 506, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 330, y: 506, id: 2}]});
    await page.evaluate(() => stepVisit());
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    record.phoneLook = await aim(record.setup.viewpoint.bearing, record.setup.viewpoint.pitch);
    record.captures.push(await capture(id, 'phone-east-footway', true));
    record.passed = true; console.log(id, 'captured', record.captures.map(c => c.bytes).join('/'));
   } catch (error) { record.failure = error.stack; console.log(id, 'FAILED', error.message); }
   save();
  }
  await context.close(); report.complete = report.records.every(r => r.passed); report.endedAt = new Date().toISOString(); report.sourceFilesVerifiedAfter = verify(); save();
 } finally { await browser.close(); }
})().catch(error => {report.fatal = error.stack; save(); process.exitCode = 1;});
