#!/usr/bin/env node
// Drive My CV — viewpoint capture and the Street View street walk (reality comparison, any city / district).
//
// Renders the game from real-world camera poses (lat, lon, compass heading, pitch, eye height, fov) in a district world,
// next to Google Street View from the same spot, heading and camera height, or (top-down poses) next to an aerial
// mosaic crop. Uses the visual harness page (visual/page/visual.js) to load the district and take over the render loop.
//
//   # hand-picked poses
//   node game/dev/harness/viewpoints.js --district=floreasca --views=game/dev/harness/views/floreasca.json --streetview
//   node game/dev/harness/viewpoints.js --district=floreasca --at=44.4580,26.1010,90 --pitch=-20 --h=60
//   # walk every drivable street of a district (any --city / --district): a pose every --every m along both
//   # sidewalks, looking at the facades on both sides and along the street, snapped to the nearest Street View pano
//   node game/dev/harness/viewpoints.js --city=bucharest --district=floreasca --walk --streetview --out=/tmp/walk
//   node game/dev/harness/viewpoints.js --district=romana --walk --streets='Lascăr|Romană' --every=40 --streetview
//   # top-down game vs aerial mosaic (tools/aerial/mosaic.py output, local only): a grid of tiles over the district
//   node game/dev/harness/viewpoints.js --district=floreasca --topdown=250 --mosaic=/tmp/flo18 --out=/tmp/td
//
// Options
//   --city=bucharest --district=<id>       which world (cities.js CITIES[city].districts)
//   --views=file.json | --at=lat,lon,hd    explicit poses: [{ id, lat, lon, heading (deg, 0 = N, 90 = E), pitch (deg, − =
//                                          down), h (m above ground), fov (deg, horizontal), note }]
//   --walk                                 auto poses along every drivable street (no service / motorway / tunnels)
//     --every=25                           spacing along the street (m)
//     --streets=<regex>                    only streets whose name matches
//     --headings=left,right,fwd            which views per stop: left / right facade, fwd / back along the street
//     --eye=pano|sidewalk                  pano (default): the game camera stands where the Street View camera stood
//                                          (its pano position, 2.5 m up) — an exact comparison; sidewalk: on the
//                                          sidewalk at 1.7 m (pedestrian eye), Street View from the nearest pano
//     --max=400                            cap on poses (Street View images cost money; metadata lookups are free)
//     --dry                                list the poses / pano matches, render nothing, fetch no images
//   --streetview                           fetch Street View (key: $GOOGLE_MAPS_KEY, or injected by the network proxy);
//                                          images are cached in --cache (default <out>/sv-cache) and never committed
//     --radius=20                          pano snap radius (m)
//     --pano-provider=google|any            street walks use Google imagery by default; public uploads can differ in eye height / lighting
//   --topdown=<tile m> --mosaic=<path>     top-down tiles over the district (straight down, north up) + the same ground
//                                          cropped from the mosaic (<path>.jpg + <path>.json)
//   --weather=clear|cloudy|rain|snow|fog|storm   (default clear)
//   --season=summer|autumn|winter|spring|auto   (default summer with --streetview / --walk: most panos are summer shots)
//   --stats                                print the world's build stats (always written to <out>/world-stats.json)
//   --time=day|dusk|night --quality=high --w=1280 --hgt=720 --traffic --out=<dir> --only=<id substring>
//
// Street View is used for visual side-by-side comparison only (Google's terms): nothing from it goes into the game data.
// Output: <out>/<id>.jpg (+ <id>-sv.jpg / <id>-sat.jpg), <out>/index.html grouped by street, <out>/poses.json.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../..');
const A = { district: 'floreasca', city: 'bucharest', views: null, at: null, pitch: 0, h: 2.6, fov: 75, out: path.join(__dirname, 'report/views'), w: 1280, hgt: 720, time: 'day', streetview: false, quality: 'high',
    walk: false, every: 25, streets: null, headings: 'left,right,fwd', eye: 'pano', max: 400, radius: 20, dry: false, topdown: 0, mosaic: null, cache: null };
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/); if (!m) continue;
    const [, k, v] = m; A[k] = v === undefined ? true : (/^-?[\d.]+$/.test(v) ? +v : v);
}
A.out = path.resolve(String(A.out));
A.cache = path.resolve(String(A.cache || path.join(A.out, 'sv-cache')));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
function serve() {
    return new Promise((res) => {
        const srv = http.createServer((rq, rs) => {
            const rel = decodeURIComponent(rq.url.split('?')[0]);
            if (rel === '/__blank.html') { rs.writeHead(200, { 'content-type': 'text/html' }); rs.end('<!doctype html><canvas id=c></canvas><img id=m src="/__mosaic.jpg">'); return; } // (same origin: the mosaic canvas is not tainted)
            const f = rel === '/__mosaic.jpg' && A.mosaic ? path.resolve(String(A.mosaic)) + '.jpg' : path.join(ROOT, rel);
            if (rel !== '/__mosaic.jpg' && !f.startsWith(ROOT)) { rs.writeHead(403); rs.end(); return; }
            fs.readFile(f, (err, buf) => { if (err) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); rs.end(buf); });
        });
        srv.listen(0, '127.0.0.1', () => res(srv));
    });
}
function fetchBuf(url) {
    return new Promise((res, rej) => {
        // Native network errors can include the request URL (and its API key). Keep diagnostics code-only.
        const fail = (e) => { clearTimeout(timer); rej(new Error(`Street View request failed (${String(e.code || 'NETWORK').replace(/[^A-Z0-9_]/g, '')})`)); };
        const req = https.get(url, (r) => {
            const b = []; r.on('data', (d) => b.push(d)); r.on('error', fail);
            r.on('end', () => { clearTimeout(timer); res({ status: r.statusCode, type: r.headers['content-type'] || '', buf: Buffer.concat(b) }); });
        });
        const timer = setTimeout(() => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 30000);
        req.on('error', fail);
    });
}
const KEY = process.env.GOOGLE_MAPS_KEY || ''; // (no env key: the network proxy may inject X-Goog-Api-Key)
const svq = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') + (KEY ? '&key=' + KEY : '');
async function svMeta(lat, lon, radius) { // free (no quota charge)
    const f = path.join(A.cache, `meta_${lat.toFixed(6)}_${lon.toFixed(6)}_${radius}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    const r = await fetchBuf(`https://maps.googleapis.com/maps/api/streetview/metadata?${svq({ location: `${lat},${lon}`, radius, source: 'outdoor' })}`);
    let j = null; try { j = JSON.parse(r.buf.toString()); } catch { j = { status: 'HTTP ' + r.status }; }
    if (j.status === 'OK' || j.status === 'ZERO_RESULTS') fs.writeFileSync(f, JSON.stringify(j));
    return j;
}
async function svImage(v, file) {
    const loc = v.pano ? { pano: v.pano } : { location: `${v.lat},${v.lon}`, source: 'outdoor' };
    const q = { size: '640x400', ...loc, heading: Math.round(v.heading ?? 0), pitch: Math.round(v.pitch ?? 0), fov: Math.round(Math.min(120, v.fov ?? 75)) };
    const ck = path.join(A.cache, 'img_' + Object.values(q).join('_').replace(/[^\w.-]/g, '_') + '.jpg');
    if (fs.existsSync(ck)) { fs.copyFileSync(ck, file); return { cached: true }; }
    const res = await fetchBuf(`https://maps.googleapis.com/maps/api/streetview?${svq(q)}`);
    if (res.status === 200 && /image/.test(res.type)) { fs.writeFileSync(ck, res.buf); fs.copyFileSync(ck, file); return { cached: false }; }
    return { error: `HTTP ${res.status}` };
}

/** in the page: poses every `every` m along both sidewalks of every drivable street */
function walkPoses(o) {
    const g = window.game, W = g.world, inv = g.city.proj.inverse;
    const re = o.streets ? new RegExp(o.streets, 'i') : null;
    const want = o.headings.split(',');
    const ok = (e) => e.drivable && !e.virtual && !e.tunnel && !/^(service|motorway|motorway_link|trunk_link)$/.test(e.type) && e.len > 4 && (!re || re.test(e.name || ''));
    const byStreet = new Map();
    for (const e of W.graph.edges) if (ok(e)) { const k = e.name || `(${e.type})`; if (!byStreet.has(k)) byStreet.set(k, []); byStreet.get(k).push(e); }
    const comp = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360; // game x east, z south → compass
    const out = [], taken = [];
    const near = (x, z, side, r) => taken.some(t => t.side === side && Math.hypot(t.x - x, t.z - z) < r);
    for (const [street, es] of [...byStreet].sort((a, b) => a[0].localeCompare(b[0]))) {
        let k = 0;
        for (const e of es) {
            for (let s = Math.min(e.len / 2, o.every / 2); s < e.len; s += o.every) {
                for (const sd of [1, -1]) {
                    const w = (sd > 0 ? e.wR : e.wL) + Math.max(0.6, Math.min(e.sidewalk || 2, 4)) / 2 + 0.3;
                    const x = e.a.x + e.dirx * s + e.nx * w * sd, z = e.a.z + e.dirz * s + e.nz * w * sd;
                    if (near(x, z, street + sd, o.every * 0.6)) continue;
                    taken.push({ x, z, side: street + sd });
                    const ll = inv(x, z), c = inv(e.a.x + e.dirx * s, e.a.z + e.dirz * s);
                    const fwd = comp(e.dirx, e.dirz), out_ = comp(e.nx * sd, e.nz * sd);
                    const hd = { left: (out_ + 0) % 360, right: (out_ + 0) % 360, fwd, back: (fwd + 180) % 360 };
                    // on the right-hand sidewalk (sd = +1 → the right of the travel direction) the facade is "right"
                    const facade = sd > 0 ? 'right' : 'left';
                    for (const h of want) {
                        if ((h === 'left' || h === 'right') && h !== facade) continue;
                        out.push({ id: `${street.replace(/[^\p{L}\d]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40)}-${k}-${sd > 0 ? 'R' : 'L'}-${h}`, street, side: sd > 0 ? 'R' : 'L', kind: h,
                            lat: +ll.lat.toFixed(7), lon: +ll.lon.toFixed(7), clat: +c.lat.toFixed(7), clon: +c.lon.toFixed(7), heading: Math.round(hd[h]), pitch: h === 'fwd' || h === 'back' ? 0 : 6, fov: h === 'fwd' || h === 'back' ? 80 : 90, h: 1.7 });
                    }
                }
                k++;
            }
        }
    }
    return out;
}

/** in the page: top-down tiles over the district bbox */
function topdownPoses(o) {
    const g = window.game, d = g.city.districts?.[o.district] || null;
    const bb = d?.bbox; if (!bb) return [];
    const out = []; const mLat = 111132, mLon = 111320 * Math.cos(bb[0] * Math.PI / 180);
    const dLa = o.size / mLat, dLo = o.size / mLon;
    let k = 0;
    for (let la = bb[2] - dLa / 2; la > bb[0]; la -= dLa) for (let lo = bb[1] + dLo / 2; lo < bb[3]; lo += dLo) {
        const fov = 60, h = o.size / 2 / Math.tan(fov / 2 * Math.PI / 180); // (low enough that trees / parked cars are within their draw distance)
        out.push({ id: `td-${String(k++).padStart(3, '0')}`, street: 'top-down', lat: +la.toFixed(6), lon: +lo.toFixed(6), heading: 0, pitch: -90, h, fov, size: o.size, square: true });
    }
    return out;
}

(async () => {
    fs.mkdirSync(A.out, { recursive: true }); fs.mkdirSync(A.cache, { recursive: true });
    let views = [];
    if (A.views) views = JSON.parse(fs.readFileSync(path.resolve(A.views), 'utf8'));
    if (A.at) { const [lat, lon, hd] = String(A.at).split(',').map(Number); views.push({ id: 'at', lat, lon, heading: hd || 0, pitch: A.pitch, h: A.h, fov: A.fov }); }
    if (!views.length && !A.walk && !A.topdown) { console.error('no views (--views=file.json, --at=lat,lon,heading, --walk or --topdown=<m>)'); process.exit(2); }
    const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
    const ctx = await browser.newContext({ viewport: { width: A.w, height: A.hgt }, deviceScaleFactor: 1 });
    await ctx.route(/api\.open-meteo\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"error":true}' }));
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e.message || e)));
    await page.addInitScript(() => { try { localStorage.setItem('dmcv:minimap', '0'); localStorage.setItem('dmcv:lookHintShown', '1'); } catch { /* */ } });
    // season: Street View in Bucharest is mostly shot in summer — compare like with like (--season=auto keeps the date's)
    const season = A.season && A.season !== 'auto' ? String(A.season) : (A.season === 'auto' ? '' : (A.streetview || A.walk ? 'summer' : ''));
    await page.goto(base + 'game/index.html?weather=' + encodeURIComponent(A.weather || 'clear') + (season ? '&season=' + encodeURIComponent(season) : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.game, null, { timeout: 90000 }).catch(() => { throw new Error('the game did not boot: ' + errors.slice(0, 3).join(' | ')); });
    await page.addScriptTag({ url: base + 'game/dev/harness/visual/page/visual.js?v=' + Date.now(), type: 'module' });
    await page.waitForFunction(() => window.vqa, null, { timeout: 30000 });
    await page.evaluate((o) => window.vqa.setOpts(o), { quality: A.quality, time: A.time, weather: A.weather || 'clear', pr: 1, far: 0, traffic: !!A.traffic });
    const t0 = Date.now();
    const info = await page.evaluate((k) => window.vqa.loadGroup(k), `${A.city}-${A.district}`);
    console.log('loaded', JSON.stringify(info), Math.round((Date.now() - t0) / 1000) + ' s');
    await page.evaluate(() => { window.vqa.hideHud(true); document.querySelectorAll('#hud, #touch, .cockpit').forEach(e => { e.style.visibility = 'hidden'; }); });
    { // the world's build stats (buildings, trees, parked cars, fuel forecourts …) next to the frames
        const st = await page.evaluate(() => { const s = { ...(window.game.world.stats || {}) }; for (const k of Object.keys(s)) if (Array.isArray(s[k]) && s[k].length > 60) s[k] = s[k].slice(0, 60); return s; });
        fs.writeFileSync(path.join(A.out, 'world-stats.json'), JSON.stringify(st, null, 1));
        if (A.stats) console.log('world stats:', JSON.stringify(st).slice(0, 3000));
    }
    if (A.walk) {
        const wp = await page.evaluate(walkPoses, { every: A.every, streets: A.streets, headings: String(A.headings) });
        console.log(`walk: ${wp.length} poses on ${new Set(wp.map(p => p.street)).size} streets`);
        // snap to Street View panos (metadata is free); one view per (pano, side, kind)
        const seen = new Set(); let nPano = 0, nNone = 0, nPublic = 0;
        for (const v of wp) {
            if (A.streetview || A.eye === 'pano') {
                let m = null; try { m = await svMeta(v.clat, v.clon, A.radius); } catch (e) { m = { status: 'ERR ' + e.message }; }
                if (m.status === 'OK' && A['pano-provider'] !== 'any' && !/\bGoogle\b/.test(m.copyright || '')) { nPublic++; m = { status: 'PUBLIC_UPLOAD' }; }
                if (m.status !== 'OK') { nNone++; if (A.eye === 'pano') continue; }
                else {
                    const key = m.pano_id + v.side + v.kind; if (seen.has(key)) continue; seen.add(key); nPano++;
                    v.pano = m.pano_id; v.date = m.date; v.copyright = m.copyright; v.plat = m.location.lat; v.plon = m.location.lng;
                    if (A.eye === 'pano') { v.lat = +v.plat.toFixed(7); v.lon = +v.plon.toFixed(7); v.h = 2.5; }
                }
            }
            views.push(v);
            if (views.length >= A.max) { console.log(`walk: capped at --max=${A.max} poses`); break; }
        }
        if (A.streetview || A.eye === 'pano') console.log(`walk: ${nPano} pano matches, ${nNone} poses without a usable pano within ${A.radius} m (${nPublic} public-upload matches excluded)`);
    }
    if (A.topdown) views.push(...await page.evaluate(topdownPoses, { district: A.district, size: A.topdown }));
    if (A.only) views = views.filter(v => String(A.only).split(',').some(s => v.id.includes(s)));
    fs.writeFileSync(path.join(A.out, 'poses.json'), JSON.stringify(views, null, 1));
    if (A.dry) { console.log(`dry run: ${views.length} poses → ${path.join(A.out, 'poses.json')}`); await browser.close(); srv.close(); return; }
    let mosaic = null;
    if (A.mosaic && views.some(v => v.pitch <= -80)) mosaic = JSON.parse(fs.readFileSync(path.resolve(String(A.mosaic)) + '.json', 'utf8'));
    let sat = null; // a second page that crops the mosaic (canvas)
    if (mosaic) { sat = await ctx.newPage(); await sat.goto(base + '__blank.html'); await sat.waitForFunction(() => document.querySelector('#m').complete && document.querySelector('#m').naturalWidth > 0, null, { timeout: 120000 }); }
    const rows = [];
    let svFetched = 0, svCached = 0;
    for (const v of views) {
        const square = !!v.square || (v.pitch ?? 0) <= -80; // (top-down frames are square, like the mosaic crop)
        const want = square ? { width: A.hgt, height: A.hgt } : { width: A.w, height: A.hgt }, cur = page.viewportSize();
        if (cur.width !== want.width || cur.height !== want.height) { // (the game resizes its renderer on window resize)
            await page.setViewportSize(want);
            await page.evaluate(() => { window.dispatchEvent(new Event('resize')); const g = window.game; try { g.renderer.setSize(innerWidth, innerHeight); } catch { /* */ } });
            await page.waitForTimeout(150);
        }
        const r = await page.evaluate((v) => {
            const g = window.game, S = window.vqa.S, p = g.city.proj(v.lat, v.lon), cam = g.camera;
            if (g.player?.rig) g.player.rig.visible = false;
            g.scene.add(cam);
            if (g.world) g.world.camera = cam; // (distance culling follows this camera: with a narrow fov the world picked a wider one elsewhere)
            let gy = (g.world.groundAt?.(p.x, p.z)) ?? 0;
            // A panorama on a named underpass ramp stands above that road, below the flat ground plane.
            if ((v.pitch ?? 0) > -80 && v.street) {
                const ne = g.world.nearestEdge?.(p.x, p.z, e => !e.virtual && e.name === v.street, 50), e = ne?.edge;
                if (e && ne.d <= Math.max(e.wR, e.wL) + 2 && (e.tunnel || e.bridge || Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01)) {
                    const y = e.ya + (e.yb - e.ya) * ne.t, surface = g.world.roadHeight(p.x, p.z, { edge: e, y });
                    if (Number.isFinite(surface)) gy = surface;
                }
            }
            cam.position.set(p.x, (Number.isFinite(gy) ? gy : 0) + (v.h ?? 2.6), p.z);
            const yaw = -(v.heading ?? 0) * Math.PI / 180; // game: x east, z south, camera looks −z (north) at yaw 0
            cam.rotation.set((v.pitch ?? 0) * Math.PI / 180, yaw, 0, 'YXZ');
            const asp = innerWidth / innerHeight, hf = (v.fov ?? 75) * Math.PI / 180;
            cam.fov = 2 * Math.atan(Math.tan(hf / 2) / asp) * 180 / Math.PI; cam.aspect = asp;
            const far0 = cam.far; if (v.pitch <= -80) cam.far = Math.max(far0, (v.h || 0) + 200);
            cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
            const fog = g.scene.fog; if (v.pitch <= -80) g.scene.fog = null;
            S.renderNow = true; try { g.drawFrame({ mirror: false }); } finally { S.renderNow = false; g.scene.fog = fog; cam.far = far0; cam.updateProjectionMatrix(); }
            return { x: Math.round(p.x), z: Math.round(p.z) };
        }, v);
        const file = path.join(A.out, v.id + '.jpg');
        await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
        let sv = null, satF = null;
        if (A.streetview && v.pitch > -80) {
            try { const res = await svImage(v, path.join(A.out, v.id + '-sv.jpg')); if (res.error) console.log(`street view ${v.id}: ${res.error}`); else { sv = v.id + '-sv.jpg'; if (res.cached) svCached++; else svFetched++; } } catch (e) { console.log('street view: ' + e.message); }
        }
        if (sat && v.pitch <= -80) { // the same ground from the mosaic: Web Mercator pixels around the pose, rotated by the heading
            const n = 2 ** mosaic.z * 256, lat = v.lat * Math.PI / 180;
            const gx = (v.lon + 180) / 360 * n - mosaic.px0, gy = (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * n - mosaic.py0;
            const ground = 2 * (v.h || 0) * Math.tan((v.fov || 30) / 2 * Math.PI / 180); // metres across
            const mpp = 156543.03392 * Math.cos(lat) / 2 ** mosaic.z;
            const url = await sat.evaluate(({ gx, gy, span, out, hd }) => {
                const c = document.querySelector('#c'), m = document.querySelector('#m'); c.width = c.height = out;
                const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, out, out);
                x.translate(out / 2, out / 2); x.rotate(-hd * Math.PI / 180); x.scale(out / span, out / span); x.drawImage(m, -gx, -gy);
                return c.toDataURL('image/jpeg', 0.85);
            }, { gx, gy, span: ground / mpp, out: A.hgt, hd: v.heading || 0 });
            satF = v.id + '-sat.jpg'; fs.writeFileSync(path.join(A.out, satF), Buffer.from(url.split(',')[1], 'base64'));
        }
        rows.push({ ...v, game: v.id + '.jpg', sv, sat: satF, ...r });
        if (rows.length % 25 === 0 || views.length < 30) console.log('view', rows.length, '/', views.length, v.id, JSON.stringify(r));
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const groups = new Map(); for (const r of rows) { const k = r.street || 'views'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const html = `<!doctype html><meta charset=utf-8><title>Viewpoints · ${esc(A.district)}</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:16px}h2{margin:28px 0 8px;font-size:18px}nav a{color:#9cf;margin-right:10px}figure{margin:0 0 22px}img{width:640px;max-width:48vw;margin-right:8px;vertical-align:top}figcaption{margin:4px 0 6px;color:#aaa}</style>
<h1>${esc(A.city)} · ${esc(A.district)} · game (left) vs ${A.topdown ? 'aerial mosaic / ' : ''}Street View (right)</h1><nav>${[...groups.keys()].map((k, i) => `<a href="#g${i}">${esc(k)} (${groups.get(k).length})</a>`).join(' ')}</nav>
${[...groups].map(([k, rs], i) => `<h2 id="g${i}">${esc(k)}</h2>` + rs.map(r => `<figure><figcaption><b>${esc(r.id)}</b> · ${r.lat}, ${r.lon} · heading ${r.heading}° · pitch ${r.pitch ?? 0}° · h ${(+r.h || 0).toFixed(1)} m · fov ${r.fov ?? 75}°${r.pano ? ' · pano ' + esc(r.pano) + ' (' + esc(r.date || '') + ')' : ''}${r.note ? ' · ' + esc(r.note) : ''} · game x ${r.x}, z ${r.z}</figcaption><img src="${esc(r.game)}">${r.sv ? `<img src="${esc(r.sv)}">` : ''}${r.sat ? `<img src="${esc(r.sat)}">` : ''}</figure>`).join('\n')).join('\n')}`;
    fs.writeFileSync(path.join(A.out, 'index.html'), html);
    if (A.streetview) console.log(`street view images: ${svFetched} fetched, ${svCached} from the cache (${A.cache})`);
    if (errors.length) console.log('page errors:', errors.slice(0, 5));
    await browser.close(); srv.close();
    console.log('wrote', path.join(A.out, 'index.html'), `(${rows.length} views)`);
})().catch((e) => { console.error(e); process.exit(3); });
