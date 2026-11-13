// Real-scene guided-tour regression. Run with muted system Chromium:
// NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs node tools/tourist-tour-check.mjs --out=/tmp/tour-check
// --spots=all (or a comma list of spot ids) additionally plans the guided tour of each of those spots and reports
// every failing stop with its reason; --spots-only=1 skips the fixed regression cases. Works on Windows and POSIX.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).map((v) => v.replace(/^--/, '').split('=')));
const out = path.resolve(args.out || '/tmp/tourist-tour-check'); await mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
    try { const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); const rel = path.relative(root, p); if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('path'); const data = await readFile(p); res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(data); }
    catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = args.base || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--no-sandbox'] });
const results = { sourceCommit: process.env.SOURCE_COMMIT || null, setup: 'Actual source scene; controller auto input retains physics and crowd. Synthetic state fixtures are labelled separately.', checks: [], routes: [], errors: [] };
let page;
const check = (name, ok, detail) => { results.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`); };
const load = async (id) => {
    await page?.close(); page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => results.errors.push({ id, message: String(e) }));
    page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[spots] map')) results.errors.push({ id, message: m.text() }); });
    await page.goto(`${base}/game/dev/spots.html?id=${id}&manual=1&hour=12&weather=clear&season=summer&dev=0&audit=0`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.spotDev?.ready, { timeout: 60000 });
};
const route = async (id) => {
    const r = await page.evaluate(async () => {
        const { pathLength, walkSegment, TOUR_WALK_LIMIT_M } = await import('/game/src/spots/tour.js'); const s = spotDev.session;
        s.endTour(); const ms = performance.now(); s.startTour();
        // Without a tour, say why for every activity of the scene: the planner needs one reachable, available activity first.
        const G = s.guide, sp0 = s.spot.spawns[s.spot.id] || s.spot.spawn, round = (v) => Math.round(v * 10) / 10;
        const noTour = s.tour ? null : s.objectives().filter((m) => ['activity', 'bike'].includes(m.kind)).map((m) => { const it = m.interaction, why = [];
            if (m.noTour) why.push('excluded from tours (noTour)');
            if (m.id && m.id !== s.spot.id) why.push(`belongs to the entry ${m.id}`);
            if (Math.hypot(m.x - sp0.x, m.z - sp0.z) > 230) why.push(`${round(Math.hypot(m.x - sp0.x, m.z - sp0.z))} m from the entry spawn (limit 230 m)`);
            if (it?.cond && !it.cond(s)) why.push('its condition is false now (time, season or state)');
            if (it?.tourAvailable && !it.tourAvailable(s)) why.push('tourAvailable() is false');
            if (it && Math.abs((it.y ?? s.ctl.y) - s.ctl.y) >= 3) why.push(`on another level (${round((it.y ?? s.ctl.y) - s.ctl.y)} m from the walker)`);
            if (G && !s._navPath(G.x, G.z, m.x, m.z, { radius: it ? Math.min(1.5, Math.max(0.4, (it.r || 2) - 0.4)) : 1.5, maxLength: TOUR_WALK_LIMIT_M, startY: G.y, targetY: m.floorY })) why.push(`no walkable route of at most ${TOUR_WALK_LIMIT_M} m from the guide at ${round(G.x)}, ${round(G.z)}`);
            return { label: m.label, at: [round(m.x), round(m.z)], why: why.length ? why : ['passes every test checked here (entry extent / nearer-entry rule not reproduced)'] }; });
        return { id: s.spot.id, name: s.spot.name, sceneTris: s.spot.tris, ms: performance.now() - ms, meters: s.tour?.walked, limit: TOUR_WALK_LIMIT_M, guide: !!G, noTour,
            stops: s.tour?.stops.map((m) => ({ kind: m.kind, id: m.id, label: m.label, target: [m.x, m.z], endpoint: [m.tx, m.tz], radius: m.radius, length: pathLength(m.path), clear: m.path.slice(1).every((p, i) => walkSegment(s.spot.ground, s.spot.colliders, m.path[i], p)), available: !m.interaction || ((!m.interaction.cond || m.interaction.cond(s)) && Math.abs((m.interaction.y ?? s.ctl.y) - s.ctl.y) < 3) })) };
    });
    results.routes.push(r);
    check(`${id}: <=3 stops within the ${r.limit} m walk budget`, r.stops?.length > 0 && r.stops.length <= 3 && r.meters <= r.limit, r.stops?.length ? { metres: r.meters, stops: r.stops.map((m) => m.label) } : { noTour: !r.guide ? 'the scene has no guide' : r.noTour?.length ? r.noTour : 'the scene offers no activity objective' });
    const bad = (r.stops || []).map((m, i) => { const gap = Math.hypot(m.endpoint[0] - m.target[0], m.endpoint[1] - m.target[1]), why = [];
        if (!m.clear) why.push('route segment blocked by a collider or ground step');
        if (!m.available) why.push('interaction unavailable from the route level or its condition is false');
        if (!(gap <= m.radius + 1e-6)) why.push(`route ends ${gap.toFixed(2)} m from the stop, outside its ${m.radius} m reach`);
        return why.length ? { stop: i + 1, kind: m.kind, label: m.label, target: m.target, endpoint: m.endpoint, why } : null; }).filter(Boolean);
    r.failingStops = bad;
    check(`${id}: clear routes within interaction reach`, r.stops?.length > 0 && !bad.length, bad.length ? bad : r.stops?.length ? undefined : 'no tour could be planned (startTour produced no stops)');
    check(`${id}: hero/photo belong to active entry`, r.id === id && r.stops?.every((m) => !m.id || m.id === id));
    return r;
};
try {
    if (process.env.ONLY_QUEUE !== '1' && args['spots-only'] !== '1') {
    await load('pike-place');
    const fixtures = await page.evaluate(async () => {
        const { findWalkPath, walkSegment, pathLength } = await import('/game/src/spots/tour.js');
        const { colliderIndex } = await import('/game/src/spots/walker.js');
        const flat = { heightAt: () => 0, groundAt: () => 0 }, wall = colliderIndex([{ x: 5, z: 0, hw: 1, hd: 8, r: 9 }]);
        const detour = findWalkPath(flat, wall, 0, 0, 10, 0);
        const boxed = colliderIndex([{ x: 10, z: 0, hw: 4, hd: 4, r: 6 }]);
        const small = colliderIndex([{ x: 10, z: 0, prop: true, r: 0.5, hw: 0.5 }]);
        const close = findWalkPath(flat, small, 0, 0, 10, 0, { radius: 1.5 });
        const cliff = { heightAt: (x) => x < 5 ? 0 : 2, groundAt: (x) => x < 5 ? 0 : 2 };
        const water = { heightAt: () => 0, groundAt: (x) => x > 4 && x < 7 ? 50 : 0 };
        return { detour: !!detour && pathLength(detour) > 20 && detour.slice(1).every((p, i) => walkSegment(flat, wall, detour[i], p)),
            budget: findWalkPath(flat, wall, 0, 0, 10, 0, { maxLength: 12 }) === null,
            unreachable: findWalkPath(flat, boxed, 0, 0, 10, 0, { radius: 1.5 }) === null,
            blockedEndpoint: !!close && close.at(-1)[0] !== 10 && close.slice(1).every((p, i) => walkSegment(flat, small, close[i], p)),
            cliff: findWalkPath(cliff, [], 0, 0, 10, 0, { maxLength: 25 }) === null,
            water: findWalkPath(water, [], 0, 0, 10, 0, { maxLength: 25 }) === null,
            oversize: findWalkPath(flat, [], 0, 0, 10000, 0) === null };
    });
    for (const [name, ok] of Object.entries(fixtures)) check(`path fixture: ${name}`, ok);
    const pike = await route('pike-place'); check('Pike starts with an activity', pike.stops?.[0].kind === 'activity');
    const dynamics = await page.evaluate(() => {
        const s = spotDev.session, st = s.tour.stops[0], G = s.guide, events = []; window.addEventListener('dmcv:activity', (e) => events.push(e.detail));
        const p = { x: st.tx, z: st.tz, y: s.ctl.y, speed: 4.6 }, before = [G.x, G.z];
        s._updateTour(0.1, p); const firstStep = Math.hypot(G.x - before[0], G.z - before[1]);
        let n = 0, maxStep = firstStep; while (s.tour.state === 'walk' && n++ < 1500) { const a = [G.x, G.z]; s._updateTour(0.1, p); maxStep = Math.max(maxStep, Math.hypot(G.x - a[0], G.z - a[1])); }
        for (let i = 0; i < 100; i++) s._updateTour(0.1, p);
        const noAutoActivity = s.tour.i === 0 && !st.participated && !s._seen.has('act:' + st.label) && !events.some((e) => e.id === 'tour');
        const state = () => JSON.stringify({ i: s.tour.i, t: s.tour.t, x: G.x, z: G.z });
        s.ui.$('.sp-panel').classList.add('show'); const a = state(); s.update(0.1); const panel = state() === a; s.ui.$('.sp-panel').classList.remove('show');
        s.host.photo = { active: true }; const b = state(); s.update(0.1); const photo = state() === b; s.host.photo = null;
        s.host.explore = { drone: { active: true } }; const c = state(); s.update(0.1); const drone = state() === c; s.host.explore = null;
        // Real interaction dispatch; requesting a fish starts its activity but does not counterfeit a catch achievement.
        s.ctl.teleport(st.x, st.z); s.input.actions.add('KeyE'); s.update(0.1);
        // A modal activity (the coin drop) reports its own completion: opening it never completes the stop, its action does.
        const flow = s.spot.ctx.extras.participation, modal = !!flow?.active, openDoesNotComplete = !modal || (!st.participated && s.tour.i === 0);
        if (modal) { flow.run.button.click(); for (let i = 0; i < 60 && flow.active; i++) s.update(0.1); }
        const participation = !!st.participated;
        const noFakeCatch = !s.progress.fish && !events.some((e) => e.id === 'fish' || e.id === 'lm-pike-fish');
        s.update(0.1); const advanced = s.tour.i === 1;
        return { firstStep, maxStep, frames: n, arrival: s.tour.state, noAutoActivity, panel, photo, drone, modal, openDoesNotComplete, participation, noFakeCatch, advanced };
    });
    check('Guide arrives by walking, without in-view snaps', dynamics.frames < 1500 && dynamics.firstStep <= 0.451 && dynamics.maxStep <= 0.451, dynamics);
    for (const name of ['noAutoActivity', 'panel', 'photo', 'drone', 'openDoesNotComplete', 'participation', 'noFakeCatch', 'advanced']) check(`tour state: ${name}`, dynamics[name]);
    // Synthetic destination poses isolate tour state and postcard dispatch.
    // Physical player movement is independently exercised by the queue case.
    const fullVisit = await page.evaluate(() => {
        const s = spotDev.session, events = []; let callbacks = 0, postcardWaited = false, photoResult = null, reached = true;
        s.host.onTour = () => callbacks++; window.addEventListener('dmcv:activity', (e) => events.push(e.detail));
        let passes = 0;
        while (s.tour.state !== 'done') {
            if (passes++ > s.tour.stops.length + 2) { reached = false; break; }
            const st = s.tour.stops[s.tour.i]; s.ctl.teleport(st.tx, st.tz);
            let n = 0; while (s.tour.state === 'walk' && n++ < 1500) s._updateTour(0.1, { ...s.ctl.position, speed: 4.6 });
            if (s.tour.state !== 'arrive') { reached = false; break; }
            if (st.kind === 'postcard') {
                const i = s.tour.i; for (let j = 0; j < 100; j++) s._updateTour(0.1, s.ctl.position); postcardWaited = s.tour.i === i;
                const c = st.challenge; s.ctl.heading = -c.bearing * Math.PI / 180; s.ctl.pitch = 0; s.ctl.place(); s.spot.scene.updateMatrixWorld(true);
                photoResult = s.onPhoto(); s._updateTour(0.1, s.ctl.position); break;
            }
            for (let j = 0; j < 65 && s.tour.stops[s.tour.i] === st; j++) s._updateTour(0.1, s.ctl.position);
        }
        s._updateTour(0.1, s.ctl.position); spotDev.step(1, 0);
        return { reached, postcardWaited, photoResult, state: s.tour.state, callbacks, tourEvents: events.filter((e) => e.id === 'tour').length, persisted: !!s.progress.tours?.[s.spot.sceneId] };
    });
    check('Tour state and postcard fixture complete exactly once', fullVisit.reached && fullVisit.postcardWaited && fullVisit.photoResult?.postcard === 'pike-place' && fullVisit.state === 'done' && fullVisit.callbacks === 1 && fullVisit.tourEvents === 1 && fullVisit.persisted, fullVisit);
    await page.evaluate(() => { const c = spotDev.session.spot.challenges[0]; spotDev.walkTo(c.x + 2, c.z, c.bearing); spotDev.step(2, 1 / 30); });
    await page.screenshot({ path: path.join(out, 'pike-tour-desktop.png') });
    await page.evaluate(() => { const s = spotDev.session; s.endTour(); s.startTour(); });
    await page.locator('[data-tour-skip]').click();
    check('Skip stop control advances itinerary', await page.evaluate(() => spotDev.session.tour.i === 1));
    const skips = await page.evaluate(() => { const s = spotDev.session, before = s.progress.tours?.[s.spot.sceneId]; for (let n = 0; s.tour.state !== 'done' && n < 12; n++) s.skipTourStop(); return { awarded: s.progress.tours?.[s.spot.sceneId] !== before, text: s.ui.$('.sp-tour').textContent }; });
    check('Skipping does not award tour completion', !skips.awarded && skips.text.includes('Tour ended'), skips);
    await page.locator('[data-tour-end]').click(); check('End/Close control clears tour', await page.evaluate(() => !spotDev.session.tour && !spotDev.session._route));
    const empty = await page.evaluate(() => { const s = spotDev.session, nav = s._navPath; s._navPath = () => null; const result = s.startTour(); s._navPath = nav; return result === false && !s.tour; }); check('Unreachable empty itinerary never crashes/awards', empty);
    const eligible = await page.evaluate(() => { const s = spotDev.session, orig = s.objectives, g = s.guide; s.objectives = () => [
        { kind: 'activity', x: g.x, z: g.z, label: 'Unavailable season', interaction: { cond: () => false } },
        { kind: 'activity', x: g.x, z: g.z, label: 'Upper floor', interaction: { y: 200 } },
        { kind: 'activity', x: g.x, z: g.z, label: 'Season hook', interaction: { tourAvailable: () => false } }];
        const result = s.startTour(); s.objectives = orig; return result === false && !s.tour; }); check('Unavailable/y-conditioned activities excluded', eligible);
    await page.evaluate(() => { const s = spotDev.session; s.startTour(); void s.openMap(); });
    await page.locator('[data-tour]').click();
    check('Map End tour control returns to free exploration', await page.evaluate(() => !spotDev.session.tour && !spotDev.session.ui.panelOpen && spotDev.session.input.lookAllowed));
    for (const id of ['fremont-troll', 'gas-works', 'space-needle', 'herastrau-park', 'old-town-lipscani']) {
        await load(id); await route(id);
        if (id === 'space-needle' || id === 'herastrau-park') for (const target of id === 'space-needle' ? ['chihuly', 'mopop'] : ['village-museum']) {
            const sync = await page.evaluate((target) => { const s = spotDev.session; s.teleport(target); return { id: s.spot.id, name: s.spot.name, photo: s.photoInfo().place, title: s.ui.$('.sp-card b').textContent, entry: s.spot.entry.id, sameSpawn: s.spot.spawn === s.spot.spawns[target], tour: !!s.tour, route: !!s._route }; }, target);
            check(`${target}: shared-scene entry metadata and cancelled tour`, sync.id === target && sync.entry === target && sync.name === sync.photo && sync.name === sync.title && sync.sameSpawn && !sync.tour && !sync.route, sync);
            // Teleporting the player does not teleport the guide across the scene. A fresh entry creates its local guide.
            const remote = await page.evaluate(async () => { const s = spotDev.session; s.startTour(); return { safe: !s.tour || s.tour.walked <= (await import('/game/src/spots/tour.js')).TOUR_WALK_LIMIT_M, guideDistance: Math.hypot(s.guide.x - s.ctl.x, s.guide.z - s.ctl.z), hasTour: !!s.tour }; });
            check(`${target}: remote guide remains safe after teleport`, remote.safe, remote);
            await load(target); await route(target);
        }
        if (id === 'herastrau-park') { await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(async () => { await new Promise(requestAnimationFrame); spotDev.step(2, 1 / 30); }); const fits = await page.evaluate(() => { const card = document.querySelector('.sp-card').getBoundingClientRect(), controls = document.querySelector('.sp-tour-controls').getBoundingClientRect(); return card.right <= innerWidth && controls.bottom < innerHeight; }); check('Phone tour card and controls fit viewport', fits); await page.screenshot({ path: path.join(out, 'village-tour-phone.png') }); }
    }
    }
    const spotList = !args.spots ? [] : args.spots === 'all' ? await (async () => { await load('pike-place'); return page.evaluate(async () => (await import('/game/src/spots/index.js')).SPOTS_ALL.map((s) => s.id)); })() : args.spots.split(',');
    for (const id of spotList) { try { await load(id); await route(id); await page.screenshot({ path: path.join(out, `tour-${id}.png`) }); } catch (error) { check(`${id}: scene loads and plans a tour`, false, String(error)); } }
    if (args['spots-only'] !== '1') {
    await load('waterfront');
    const queue = await page.evaluate(async () => {
        const { pathLength, findWalkPath, withMovingBodies, walkSegment, TOUR_WALK_LIMIT_M } = await import('/game/src/spots/tour.js');
        const s=spotDev.session,S=s.spot,G=s.guide,source=JSON.stringify(S.data.buildings),population=S.crowd.peds.length,colliders=S.colliders.length;
        const plaque=S.plaques.find(p=>/Pier 57/i.test(p.title));
        if(!plaque)return{passed:false,error:'Missing real Pier57 plaque'};
        const target={kind:'plaque',x:plaque.x+Math.sin(plaque.mesh.rotation.y)*1.2,z:plaque.z+Math.cos(plaque.mesh.rotation.y)*1.2,radius:1,label:plaque.title,text:plaque.text};
        const staticPath=findWalkPath(S.ground,S.colliders,G.x,G.z,target.x,target.z,{radius:1}),path=s._navPath(G.x,G.z,target.x,target.z,{radius:1});
        const initialBodies=S.crowd.obstacles(G.x,G.z,200),overlay=withMovingBodies(S.colliders,initialBodies,G);
        const staticCrowdCrossing=!!staticPath&&staticPath.slice(1).some((p,i)=>!walkSegment(S.ground,overlay,staticPath[i],p));
        if(!path)return{passed:false,error:'No short crowd-aware source route',staticCrowdCrossing};
        target.path=path;target.wi=1;[target.tx,target.tz]=path.at(-1);s.tour={stops:[target],i:0,state:'walk',wait:0,said:false,t:0,walked:pathLength(path),travelled:0,skipped:0};G.act='guide';G.sayCd=1e9;
        const breadcrumbs=[[G.x,G.z]],trace=[];let frames=0,maxGuideStep=0,maxPlayerStep=0,playerStuck=0,playerReplans=0;
        while(s.tour.state==='walk'&&frames++<5000){
            const gp=[G.x,G.z],pp={...s.position};if(Math.hypot(G.x-breadcrumbs.at(-1)[0],G.z-breadcrumbs.at(-1)[1])>.45)breadcrumbs.push([G.x,G.z]);
            while(breadcrumbs.length>1&&Math.hypot(s.position.x-breadcrumbs[0][0],s.position.z-breadcrumbs[0][1])<.35)breadcrumbs.shift();
            const d=Math.hypot(G.x-s.position.x,G.z-s.position.z),p=breadcrumbs[0];s.ctl.auto=d>2?{heading:Math.atan2(-(p[0]-s.position.x),-(p[1]-s.position.z)),fwd:1,run:true}:null;s.input.keys?.clear?.();
            s.update(.05);playerStuck=d>3&&Math.hypot(s.position.x-pp.x,s.position.z-pp.z)<.01?playerStuck+.05:0;if(playerStuck>1){const detour=s._navPath(s.position.x,s.position.z,G.x,G.z,{radius:2,maxLength:60});if(detour){breadcrumbs.splice(0,breadcrumbs.length,...detour.slice(1));playerReplans++;}playerStuck=0;}maxGuideStep=Math.max(maxGuideStep,Math.hypot(G.x-gp[0],G.z-gp[1]));maxPlayerStep=Math.max(maxPlayerStep,Math.hypot(s.position.x-pp.x,s.position.z-pp.z));
            if(frames%40===0)trace.push({frame:frames,guide:[G.x,G.z],player:[s.position.x,s.position.z],state:s.tour.state});
        }
        s.ctl.auto=null;s.input.keys?.clear?.();spotDev.step(.1,0);
        return{passed:s.tour.state==='arrive',limit:TOUR_WALK_LIMIT_M,walker:s.walkerKind,state:s.tour.state,narrative:s.tour.narr,frames,routeMetres:pathLength(path),guideTravelled:s.tour.travelled,staticCrowdCrossing,initialBodies:initialBodies.length,playerReplans,maxGuideStep,maxPlayerStep,populationBefore:population,populationAfter:S.crowd.peds.length,colliderCountBefore:colliders,colliderCountAfter:S.colliders.length,sourceUnchanged:source===JSON.stringify(S.data.buildings),player:{...s.position},guide:[G.x,G.z],trace};
    });
    results.queue=queue;
    check('Waterfront actual guide and native player traverse the retained queue',queue.passed&&queue.walker==='OnFootController'&&queue.maxGuideStep<=.226&&queue.maxPlayerStep<.8&&queue.guideTravelled<=queue.limit&&queue.sourceUnchanged&&queue.populationBefore===queue.populationAfter&&queue.colliderCountBefore===queue.colliderCountAfter,queue);
    await page.screenshot({path:path.join(out,'waterfront-native-queue.png')});
    }
    check('No runtime map/tour errors', results.errors.length === 0, results.errors);
} catch (error) { results.errors.push({ fatal: String(error), stack: error.stack }); check('Runtime completed', false, String(error)); }
finally { await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); await browser.close(); await new Promise((r) => server.close(r)); }
const failures = results.checks.filter((c) => !c.ok); console.log(`${results.checks.length - failures.length}/${results.checks.length} passed; raw findings: ${out}/results.json`); if (failures.length || results.errors.length) process.exitCode = 1;
