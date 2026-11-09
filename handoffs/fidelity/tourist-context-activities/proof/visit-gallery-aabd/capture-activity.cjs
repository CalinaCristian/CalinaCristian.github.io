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
report.setup = 'Native Pike Place entry, then an explicit nearby production-controller setup beside Rachel. Actual portrait touch look, Use tap, and Drop the coin tap. Capture after eight native 50ms updates; this illustrates the in-flight coin and native activity UI, not a public arrival route or complete activity regression.';
const save = () => fs.writeFileSync(path.join(out, process.env.REPORT || 'results.json'), JSON.stringify(report, null, 2) + '\n');
(async () => {
 const browser = await chromium.launch({headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
 try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 1});
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
    await page.setViewportSize({width: 390, height: 844}); await page.evaluate(() => game.resize());
    await page.evaluate(id => game.enterSpot(id), id);
    record.setup = await page.evaluate(() => { const s = game.spot, it = s.spot.interactables.find(it => it.kind === 'coin'); if (!it) throw Error('No Rachel coin activity'); const arrival = {...s.position}; s.ctl.teleport(it.x + 1, it.z, 0); s.input.flush(); stepVisit(); const target = {x: it.x - .6, z: it.z + .4, y: s.spot.ground.heightAt(it.x - .6, it.z + .4) + .91}, p = s.camera.getWorldPosition(s.camera.position.clone()), dx = target.x - p.x, dz = target.z - p.z; return {arrival, viewpoint: {x: s.position.x, z: s.position.z, bearing: (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, pitch: Math.atan2(target.y - p.y, Math.hypot(dx, dz)) * 180 / Math.PI}, target, position: {...s.position}, walker: s.walkerKind, sceneId: s.spot.sceneId, origin: s.spot.data.origin, projection: s.spot.data.projection}; });
    // Every frame is acquired using actual touch look at the final portrait
    // dimensions. Start a little away even if the authored bearing is north.
    record.lookBefore = await page.evaluate(() => ({heading: game.spot.ctl.heading, pitch: game.spot.ctl.pitch}));
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 285, y: 506, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 330, y: 506, id: 2}]});
    await page.evaluate(() => stepVisit());
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    record.lookAfterInitialTouch = await page.evaluate(() => ({heading: game.spot.ctl.heading, pitch: game.spot.ctl.pitch}));
    if (Math.abs(record.lookBefore.heading - record.lookAfterInitialTouch.heading) < .05) throw Error('Actual portrait touch did not turn the native camera');
    record.phoneLook = await aim(record.setup.viewpoint.bearing, record.setup.viewpoint.pitch);
    const tap = async selector => {const q = await page.locator(selector).evaluate(el => {const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (!el.contains(document.elementFromPoint(x, y))) throw Error('Obstructed actual action target'); return {x, y, width: r.width, height: r.height};}); await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: q.x, y: q.y, id: 1}]}); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); return q;};
    record.useTap = await tap('[data-btn=act]'); await page.evaluate(() => stepVisit());
    record.dropTap = await tap('.sp-participation [data-action]'); await page.evaluate(() => stepVisit(8));
    record.activity = await page.evaluate(() => {const s = game.spot, r = s.spot.ctx.extras.participation.run, coin = s.spot.scene.getObjectByName('activity-coin'); return {active: !!r, busy: r?.busy, t: r?.t, title: r?.ui.querySelector('h2').textContent, coinVisible: coin?.visible, coinPosition: coin?.position.toArray()};});
    if (!record.activity.active || !record.activity.busy || !record.activity.coinVisible) throw Error('Native coin is not in flight');
    record.captures.push(await capture(id, 'activity-phone', true));
    record.passed = true; console.log(id, 'captured', record.captures.map(c => c.bytes).join('/'));
   } catch (error) { record.failure = error.stack; console.log(id, 'FAILED', error.message); }
   save();
  }
  await context.close(); report.complete = report.records.every(r => r.passed); report.endedAt = new Date().toISOString(); report.sourceFilesVerifiedAfter = verify(); save();
 } finally { await browser.close(); }
})().catch(error => {report.fatal = error.stack; save(); process.exitCode = 1;});
