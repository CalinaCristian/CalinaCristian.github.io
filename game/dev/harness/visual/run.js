#!/usr/bin/env node
// ============================================================================
//  Drive My CV — VISUAL QA (Node + Playwright, software GL).
//  npm run harness:visual [-- --city=seattle --route=seatac-uipath-bel --every=40 ...]
//  See README.md in this folder. Report: report/visual.md (+ sheets/, issues/, frames/, cockpit/).
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

let ROOT = path.resolve(__dirname, '../../../..');
const HERE = __dirname;

// ---------------------------------------------------------------- args
const A = {
    city: null, route: null, every: 40, from: null, to: null, aerial: true, looks: true, zEvery: 3, pr: 0.5, viewports: '1280x720,1920x1080,2560x1080,844x390',
    quality: 'medium', far: 450, traffic: false, offices: true, geometry: true, geoAll: false, jobs: 2, headed: false, port: 8123, timeout: 120,
    focus: 40, corridor: 70, sweep: 2, lookEvery: 200, aerialEvery: 200, size: 120, out: path.join(HERE, 'report'), keep: false, verbose: false,
};
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/); if (!m) { console.error('unknown arg', a); process.exit(2); }
    const k = m[1], v = m[2];
    const num = () => { const n = +v; if (!Number.isFinite(n)) { console.error(`--${k} needs a number`); process.exit(2); } return n; };
    switch (k) {
        case 'visual': break; // passed through by ../run.js
        case 'city': A.city = v; break;
        case 'route': case 'chapter': A.route = v; break;
        case 'every': A.every = num(); break;
        case 'from': A.from = num(); break;
        case 'to': A.to = num(); break;
        case 'no-aerial': A.aerial = false; break;
        case 'no-looks': A.looks = false; break;
        case 'no-zfight': A.zEvery = 0; break;
        case 'zevery': A.zEvery = num(); break;
        case 'viewports': A.viewports = v || 'none'; break;
        case 'no-cockpit': A.viewports = 'none'; break;
        case 'quality': A.quality = v; break;
        case 'far': A.far = num(); break;
        case 'pr': A.pr = num(); break;
        case 'traffic': A.traffic = true; break;
        case 'no-offices': A.offices = false; break;
        case 'no-geometry': A.geometry = false; break;
        case 'geo': A.geoAll = v === 'all'; break;
        case 'jobs': A.jobs = num(); break;
        case 'headed': A.headed = true; break;
        case 'port': A.port = num(); break;
        case 'timeout': A.timeout = num(); break;
        case 'focus': A.focus = num(); break;
        case 'corridor': A.corridor = num(); break;
        case 'sweep': A.sweep = num(); break;
        case 'sweep-max': A.sweepMax = num(); break;
        case 'look-every': A.lookEvery = num(); break;
        case 'aerial-every': A.aerialEvery = num(); break;
        case 'tile': A.size = num(); break;
        case 'out': A.out = path.resolve(v); break;
        case 'root': ROOT = path.resolve(v); A.root = ROOT; break; // serve the game from another checkout (e.g. a snapshot while the tree is mid-edit)
        case 'keep': A.keep = true; break;
        case 'report-only': A.reportOnly = true; break; // rewrite visual.md from visual.json (no browser)
        case 'debug-masks': A.debugMasks = true; break;
        case 'verbose': case 'v': A.verbose = true; break;
        case 'help': case 'h': console.log(fs.readFileSync(path.join(HERE, 'README.md'), 'utf8')); process.exit(0); break;
        default: console.error('unknown option --' + k); process.exit(2);
    }
}
const OUT = A.out;
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

// ---------------------------------------------------------------- static server (same as the logic harness)
function probe(port) { return new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: '/game/index.html', timeout: 1500 }, (rs) => { rs.resume(); res(rs.statusCode === 200); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); }); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, rs) => {
            let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
            const rel = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
            // the visual QA page code always comes from this checkout (so --root can point at an older snapshot of the game)
            const vis = rel.replace(/\\/g, '/').match(/^\/?game\/dev\/harness\/visual\/(.*)$/);
            const f = vis ? path.join(HERE, vis[1]) : path.join(ROOT, rel);
            if (!f.startsWith(ROOT) && !f.startsWith(HERE)) { rs.writeHead(403); rs.end(); return; }
            fs.readFile(f, (err, buf) => { if (err) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); rs.end(buf); });
        });
        srv.listen(0, '127.0.0.1', () => res(srv));
    });
}
function withTimeout(p, ms, what) { let to; const timer = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms); }); return Promise.race([p, timer]).finally(() => clearTimeout(to)); }

const INIT = () => {
    window.__harnessErrors = [];
    const push = (e) => { if (window.__harnessErrors.length < 300) window.__harnessErrors.push(e); };
    window.addEventListener('error', (e) => push({ kind: 'error', msg: e.message, stack: e.error?.stack || `${e.filename}:${e.lineno}` }));
    window.addEventListener('unhandledrejection', (e) => push({ kind: 'rejection', msg: 'unhandled rejection: ' + (e.reason?.message || e.reason) }));
    try { localStorage.setItem('dmcv:minimap', '0'); localStorage.setItem('dmcv:lookHintShown', '1'); } catch { /* ignore */ }
};

// ---------------------------------------------------------------- one city in one page
async function runCity(browser, base, city, ctxOut) {
    const res = { city, groups: [], routes: [], sheets: [], issues: [], counts: {}, cockpit: [], offices: [], errors: [], log: [], timing: {} };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await ctx.route(/api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"error":true,"reason":"visual QA: live weather disabled"}' }));
    const page = await ctx.newPage();
    await page.addInitScript(INIT);
    await page.addInitScript({ path: path.join(HERE, 'page/textprobe.js') });
    page.on('pageerror', (e) => res.errors.push(String(e.message || e).slice(0, 300)));
    page.on('console', (m) => { if (A.verbose && (m.type() === 'error' || m.type() === 'warning')) log(`[${city}]`, m.type(), m.text().slice(0, 200)); });
    await page.exposeFunction('vqaSave', async (rel, dataUrl) => {
        const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, Buffer.from(String(dataUrl).replace(/^data:[^,]+,/, ''), 'base64'));
        return rel;
    });
    const T = (k, t) => { res.timing[k] = (res.timing[k] || 0) + Math.round((Date.now() - t) / 1000); };
    let t = Date.now();
    await page.goto(base + 'game/index.html?weather=clear', { waitUntil: 'load' });
    await page.waitForFunction(() => window.game, null, { timeout: 60000 });
    await page.addScriptTag({ url: base + 'game/dev/harness/visual/page/visual.js?v=' + Date.now(), type: 'module' });
    await page.waitForFunction(() => window.vqa, null, { timeout: 30000 });
    await page.evaluate((b) => window.vqa.setIdBase(b), ctxOut.idBase);
    const opts = { quality: A.quality, far: A.far, traffic: A.traffic, every: A.every, lookEvery: A.lookEvery, aerialEvery: A.aerialEvery, zEvery: A.zEvery, aerial: A.aerial, looks: A.looks, size: A.size, from: A.from, to: A.to, corridor: A.corridor, sweep: A.sweep, sweepMax: A.sweepMax ?? 2000, debugMasks: !!A.debugMasks, pr: A.pr };
    await page.evaluate((o) => window.vqa.setOpts(o), opts);
    const { mode, groups } = await page.evaluate((c) => window.vqa.groups(c), city);
    res.mode = mode;
    let cockpitDone = false, officesDone = false, routeBase = 0;
    for (const gr of groups) {
        t = Date.now();
        log(`[${city}] loading ${gr.key}…`);
        const info = await withTimeout(page.evaluate(([k, o]) => window.vqa.loadGroup(k, o), [gr.key, opts]), 240000, 'load ' + gr.key);
        T('load', t);
        log(`[${city}] ${gr.key} ready in ${(info.ms / 1000).toFixed(1)} s (${info.edges} edges, ${info.ribbons} ribbons)`);
        res.groups.push(info);
        const plans = await page.evaluate(() => window.vqa.plans());
        const sel = A.route ? A.route.split(',') : null;
        const chosen = plans.filter(p => !sel || sel.some(s => s === 'all' || p.id === s || (s !== 'none' && p.id.includes(s))));
        if (!chosen.length && A.route !== 'none') { log(`[${city}] no route matches --route=${A.route}. Available: ${plans.map(p => p.id).join(', ')}`); continue; }
        const routes = [];
        for (const p of chosen) {
            await page.evaluate((b) => window.vqa.setRouteBase(b), routeBase);
            const r = await page.evaluate((sp) => window.vqa.sampleRoute(sp), p);
            if (!r.ok) { log(`[${city}] ${p.id}: no route`); continue; }
            r.base = routeBase; routeBase += r.n; routes.push(r);
            log(`[${city}] route ${p.id}: ${r.total} m, ${r.n} samples (${r.from.street} → ${r.to.street})`);
        }
        if (A.geometry) {
            t = Date.now();
            const g = await withTimeout(page.evaluate((all) => window.vqa.runGeometry(all), A.geoAll), 300000, 'geometry');
            T('geometry', t);
            log(`[${city}] geometry: ${g.ribbons} ribbons, ${g.triangles} triangles, ${g.objects} objects, ${g.buildings} buildings in ${(g.ms / 1000).toFixed(1)} s → ${Object.entries(g.counts).map(([k, v]) => `${k}=${v}`).join(' ') || 'clean'}`);
            res.geometry = g;
        }
        // ---- survey
        await page.evaluate(() => window.vqa.hideHud(true));
        t = Date.now();
        for (const r of routes) {
            const tr = Date.now(); let flagged = 0;
            for (let i = 0; i < r.n; i++) {
                let c = null;
                try { c = await withTimeout(page.evaluate(([id, k]) => window.vqa.capture(id, k), [r.id, i]), A.timeout * 1000, `capture ${r.id}#${i}`); }
                catch (e) { log(`[${city}] !! ${e.message}`); res.errors.push(e.message); if (/has been closed|crash/i.test(e.message)) throw e; if (/timed out/.test(e.message)) break; }
                if (c && c.flags.length) flagged++;
                if (c) (r.shots ||= []).push({ idx: c.idx, s: c.s, x: c.x, z: c.z, street: c.street, flags: c.flags, sheet: Math.floor(i / 6) + 1 });
                if (A.verbose && c) log(`[${city}] ${r.id} #${c.idx} ${c.s} m ${c.ms} ms [${Object.entries(c.tm || {}).map(([k, v]) => k + ' ' + v).join(', ')}] ${c.flags.join(' ')}`);
                if (!A.verbose && i % 10 === 9) log(`[${city}] ${r.id}: ${i + 1}/${r.n} (${((Date.now() - tr) / (i + 1) / 1000).toFixed(1)} s/sample)`);
            }
            r.wallSec = Math.round((Date.now() - tr) / 1000); r.flagged = flagged;
            res.routes.push({ group: gr.key, ...r });
            log(`[${city}] ${r.id} done: ${r.n} samples in ${r.wallSec} s, ${flagged} with pixel flags`);
        }
        T('survey', t);
        if (A.geometry && A.focus > 0) { t = Date.now(); const n = await withTimeout(page.evaluate((m) => window.vqa.focusShots(m), A.focus), 600000, 'focus shots').catch(e => { res.errors.push(e.message); return 0; }); T('focus', t); log(`[${city}] ${n} geometry close-ups`); }
        if (A.offices && !officesDone) { officesDone = true; t = Date.now(); res.offices.push(...await page.evaluate(() => window.vqa.offices()).catch(e => { res.errors.push(e.message); return []; })); T('offices', t); log(`[${city}] office lobbies: ${res.offices.join(', ') || 'none'}`); }
        // ---- cockpit / HUD at every viewport (once per city)
        if (!cockpitDone && A.viewports !== 'none') {
            cockpitDone = true; t = Date.now();
            const vps = A.viewports.split(',').map(s => s.trim()).filter(Boolean);
            const list = [];
            for (const v of vps) { const [w, h] = v.split('x').map(Number); list.push({ w, h, touch: false }); if (w < 1000) list.push({ w, h, touch: true }); }
            for (const vp of list) {
                const lbl = `${vp.w}x${vp.h}${vp.touch ? '-touch' : ''}`;
                try {
                    await page.setViewportSize({ width: vp.w, height: vp.h });
                    await page.waitForTimeout(250);
                    const ui = await withTimeout(page.evaluate(([l, touch]) => window.vqa.cockpitPrep(l, { touch }), [lbl, vp.touch]), 120000, 'cockpit ' + lbl);
                    const file = `cockpit/${city}-${lbl}.png`; fs.mkdirSync(path.join(OUT, 'cockpit'), { recursive: true });
                    const buf = await page.screenshot({ path: path.join(OUT, file), timeout: 60000 });
                    await page.evaluate(([d, l, s]) => window.vqa.addCockpitTile(d, l, s), ['data:image/png;base64,' + buf.toString('base64'), `${city} ${lbl}`, `nav screen: ${ui.parts.screen ? `${Math.round(ui.parts.screen.outside * 100)} % off-view, ${Math.round(ui.parts.screen.occluded * 100)} % occluded, ${ui.parts.screen.hPx} px tall` : 'n/a'} · ${ui.n} UI findings`]);
                    res.cockpit.push({ viewport: lbl, file, ...ui });
                    log(`[${city}] cockpit ${lbl}: ${ui.n} findings`);
                } catch (e) { log(`[${city}] !! cockpit ${lbl}: ${e.message}`); res.errors.push(e.message); }
            }
            await page.evaluate(() => document.body.classList.remove('touch'));
            await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(200);
            await page.evaluate((pr) => { window.vqa.setOpts({ pr }); window.vqa.hideHud(true); }, A.pr);
            T('cockpit', t);
        }
    }
    await page.evaluate(() => window.vqa.textIssues()).catch(e => res.errors.push(e.message));
    res.sheets = await page.evaluate(() => window.vqa.flushSheets()).catch(e => { res.errors.push(e.message); return []; });
    res.issues = await page.evaluate(() => window.vqa.issues()).catch(() => []);
    res.counts = await page.evaluate(() => window.vqa.counts()).catch(() => ({}));
    res.log = await page.evaluate(() => window.vqa.log()).catch(() => []);
    const errs = await page.evaluate(() => window.__harnessErrors || []).catch(() => []);
    for (const e of errs) res.errors.push(`${e.kind}: ${e.msg}`.slice(0, 300));
    await ctx.close().catch(() => { });
    return res;
}

// ---------------------------------------------------------------- report
const SEV = { high: 0, medium: 1, low: 2 };
function writeReport(results) {
    const issues = results.flatMap(r => r.issues);
    const json = { generated: new Date().toISOString(), durationSec: Math.round((Date.now() - t0) / 1000), args: A, results: results.map(r => ({ ...r, log: undefined })), issues };
    fs.writeFileSync(path.join(OUT, 'visual.log'), results.flatMap(r => r.log.map(l => `[${r.city}] ${l}`)).join('\n'));
    const byType = {}; for (const it of issues) { (byType[it.type] ||= []).push(it); }
    const L = [];
    L.push(`# Visual QA — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
    L.push(`Run: \`${process.argv.slice(2).join(' ') || '(defaults)'}\` · ${Math.round((Date.now() - t0) / 60)} min · quality ${A.quality}, day, clear, far ${A.far} m, forward every ${A.every} m, looks/aerial every ${A.lookEvery}/${A.aerialEvery} m, z-fight test every ${A.zEvery || '–'} sample(s).`, '');
    L.push('Human review: [review.md](review.md).', '');
    L.push('## Findings by detector', '', '| detector | high | medium | low | total |', '|---|---|---|---|---|');
    for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
        const c = { high: 0, medium: 0, low: 0 }; for (const it of v) c[it.severity]++;
        L.push(`| \`${k}\` | ${c.high} | ${c.medium} | ${c.low} | ${v.length} |`);
    }
    L.push('');
    for (const r of results) {
        L.push(`## ${r.city} (${r.mode})`, '');
        for (const g of r.groups) L.push(`- world \`${g.key}\`${g.district ? ` district ${g.district}` : ''}: ${g.edges} edges, ${g.ribbons} ribbons, loaded in ${(g.ms / 1000).toFixed(1)} s`);
        L.push(`- time: ${Object.entries(r.timing).map(([k, v]) => `${k} ${v} s`).join(', ')}`);
        if (r.errors.length) L.push(`- page errors (${r.errors.length}): ${r.errors.slice(0, 5).map(e => '`' + e.replace(/`/g, "'").slice(0, 160) + '`').join('; ')}`);
        L.push('', '| route | length | samples | flagged | wall |', '|---|---|---|---|---|');
        for (const rt of r.routes) L.push(`| \`${rt.id}\` ${rt.label} | ${rt.total} m | ${rt.n} | ${rt.flagged} | ${rt.wallSec} s |`);
        L.push('', '### Contact sheets', '');
        for (const s of r.sheets) { if (!s.files.length) continue; L.push(`- **${s.title}**: ${s.files.map((f, i) => `[${i + 1}](${f.file})`).join(' ')}`); }
        if (r.cockpit.length) { L.push('', '### Cockpit / HUD screenshots', ''); for (const c of r.cockpit) L.push(`- [${c.viewport}](${c.file}) — nav screen ${c.parts.screen ? `${Math.round(c.parts.screen.outside * 100)} % off-view, ${Math.round(c.parts.screen.occluded * 100)} % occluded (${(c.parts.screen.occluders || []).join(', ') || '—'}), ${c.parts.screen.hPx} px tall` : 'n/a'}`); }
        L.push('');
    }
    // hotspots: findings clustered in 60 m cells, with the nearest surveyed shot (route #index → forward sheet page)
    const shots = results.flatMap(r => r.routes.flatMap(rt => (rt.shots || []).map(s => ({ ...s, route: rt.id, group: rt.group }))));
    const nearShot = (it) => { let b = null, bd = 80; for (const s of shots) { if (s.group !== it.group) continue; const d = Math.hypot(s.x - it.x, s.z - it.z); if (d < bd) { bd = d; b = s; } } return b; };
    for (const it of issues) if (it.x !== undefined) { const s = nearShot(it); if (s) it.seen = `${s.route} #${s.idx} (${s.s} m, forward sheet ${s.sheet})`; }
    const cells = new Map();
    for (const it of issues) { if (it.x === undefined || it.severity === 'low') continue; const k = it.group + '|' + Math.round(it.x / 60) + ',' + Math.round(it.z / 60); let c = cells.get(k); if (!c) cells.set(k, c = { group: it.group, list: [], score: 0 }); c.list.push(it); c.score += it.severity === 'high' ? 3 : 1; }
    const hot = [...cells.values()].sort((a, b) => b.score - a.score).slice(0, 40);
    L.push('## Hotspots (medium+ findings per 60 m cell)', '', '| # | world | where | score | findings | seen in |', '|---|---|---|---|---|---|');
    hot.forEach((c, k) => { const it = c.list[0]; const types = {}; for (const x of c.list) types[x.type] = (types[x.type] || 0) + 1; L.push(`| ${k + 1} | ${c.group} | ${it.street} (${it.x}, ${it.z}; ${it.lat}, ${it.lon}) | ${c.score} | ${Object.entries(types).map(([t, n]) => `${t}×${n}`).join(', ')} | ${it.seen || c.list.find(x => x.seen)?.seen || '—'} |`); });
    L.push('');
    L.push('## Findings', '');
    for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
        L.push(`### \`${k}\` (${v.length})`, '');
        v.sort((a, b) => SEV[a.severity] - SEV[b.severity] || (b.data?.area || 0) - (a.data?.area || 0));
        for (const it of v.slice(0, 60)) {
            const loc = it.x !== undefined ? ` @ **${it.street || '?'}** (${it.x}, ${it.z}${it.lat ? `; ${it.lat}, ${it.lon}` : ''})` : '';
            const links = [it.crop && `[crop](${it.crop})`, it.frame && `[frame](${it.frame})`].filter(Boolean).join(' ');
            L.push(`- #${it.id} **${it.severity}** ${it.msg}${loc}${it.count > 1 ? ` ×${it.count}` : ''}${it.data?.viewport ? ` [${it.data.viewport}]` : ''}${it.data?.route ? ` [${it.data.route} #${it.data.sample}]` : it.seen ? ` [near ${it.seen}]` : ''} ${links}`);
        }
        if (v.length > 60) L.push(`- … ${v.length - 60} more in visual.json`);
        L.push('');
    }
    fs.writeFileSync(path.join(OUT, 'visual.md'), L.join('\n'));
    fs.writeFileSync(path.join(OUT, 'visual.json'), JSON.stringify(json, null, 1));
    const c = { high: 0, medium: 0, low: 0 }; for (const it of issues) c[it.severity]++;
    return { issues, c, byType };
}

// ---------------------------------------------------------------- main
async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    if (A.reportOnly) {
        const j = JSON.parse(fs.readFileSync(path.join(OUT, 'visual.json'), 'utf8'));
        const res = j.results.map(r => ({ log: [], ...r }));
        Object.assign(A, j.args, { reportOnly: true });
        const rep = writeReport(res); console.log(`rewrote ${path.join(OUT, 'visual.md')} (${rep.issues.length} findings)`); return;
    }
    if (!A.keep) for (const d of ['sheets', 'issues', 'frames', 'cockpit', 'debug']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
    let srv = null, base;
    if (!A.root && await probe(A.port)) base = `http://127.0.0.1:${A.port}/`;
    else { srv = await serve(); base = `http://127.0.0.1:${srv.address().port}/`; log('static server on', base); }
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: !A.headed, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
    const cities = A.city ? A.city.split(',') : ['bucharest', 'seattle'];
    const results = [];
    const run = async (c, k) => { try { results.push(await runCity(browser, base, c, { idBase: k * 100000 })); } catch (e) { log(`!! ${c}: ${e.stack || e.message}`); results.push({ city: c, mode: '?', groups: [], routes: [], sheets: [], issues: [{ id: k * 100000 + 1, type: 'vqa-failure', severity: 'high', city: c, msg: e.message, count: 1, data: {} }], counts: {}, cockpit: [], offices: [], errors: [e.message], log: [], timing: {} }); } };
    if (A.jobs > 1) await Promise.all(cities.map((c, k) => run(c, k)));
    else for (const [k, c] of cities.entries()) await run(c, k);
    await browser.close().catch(() => { });
    if (srv) srv.close();
    results.sort((a, b) => cities.indexOf(a.city) - cities.indexOf(b.city));
    const rep = writeReport(results);
    console.log(`\nVisual QA: ${rep.issues.length} findings (${rep.c.high} high, ${rep.c.medium} medium, ${rep.c.low} low) in ${Math.round((Date.now() - t0) / 1000)} s`);
    for (const [k, v] of Object.entries(rep.byType).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${k.padEnd(28)} ${v.length}`);
    console.log(`Report: ${path.join(OUT, 'visual.md')}`);
    process.exit(rep.c.high > 0 ? 1 : 0);
}
main().catch((e) => { console.error('visual QA failed:', e); process.exit(3); });
