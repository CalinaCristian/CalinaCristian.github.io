#!/usr/bin/env node
// ============================================================================
//  Drive My CV — automated play-test harness (Node + Playwright).
//  npm run harness [-- --scenario=b --city=bucharest --audit --headed ...]
//  See README.md in this folder.
// ============================================================================
'use strict';
// --visual: the visual QA survey (game/dev/harness/visual/run.js) takes over with the same argv
if (process.argv.includes('--visual')) { require('./visual/run.js'); return; }
const fs = require('fs');
const path = require('path');
const http = require('http');
const { writeReport } = require('./report.js');

const ROOT = path.resolve(__dirname, '../../..');
let OUT = path.join(__dirname, 'report');
let SHOTS = path.join(OUT, 'shots');

// ---------------------------------------------------------------- args
const args = { scenario: null, city: null, audit: false, headed: false, verbose: false, port: 8123, width: 640, height: 360, traffic: 'full', dt: 1 / 30, shots: 30, timeout: 240 };
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/); if (!m) { console.error('unknown arg', a); process.exit(2); }
    const k = m[1], v = m[2];
    if (k === 'scenario' || k === 's') args.scenario = v;
    else if (k === 'city') args.city = v;
    else if (k === 'audit') args.audit = true;
    else if (k === 'no-audit') args.noAudit = true;
    else if (k === 'headed') args.headed = true;
    else if (k === 'verbose' || k === 'v') args.verbose = true;
    else if (k === 'port') args.port = +v;
    else if (k === 'size') { const [w, h] = v.split('x').map(Number); args.width = w; args.height = h; }
    else if (k === 'traffic') args.traffic = v; // full (owner's desktop density) | low (mobile density)
    else if (k === 'dt') args.dt = 1 / +v;      // --dt=30 → 30 Hz physics
    else if (k === 'shots') args.shots = +v;
    else if (k === 'shot-all') args.shotAll = true;  // screenshots also for overlap / pedestrian issue types
    else if (k === 'trace') args.trace = v ? +v : 2;  // autopilot state every N sim seconds into the log
    else if (k === 'timeout') args.timeout = +v;
    else if (k === 'out') { OUT = path.resolve(v); SHOTS = path.join(OUT, 'shots'); }
    else if (k === 'help' || k === 'h') { console.log(fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8').split('\n').slice(0, 60).join('\n')); process.exit(0); }
    else { console.error('unknown option --' + k); process.exit(2); }
}

// ---------------------------------------------------------------- plan
// default cities for scenarios that can run in either city (when --city is not given)
const DEFAULT_CITIES = { a: ['bucharest', 'seattle'], c: ['bucharest'], d: ['bucharest', 'seattle'], e: ['bucharest', 'seattle'], h: ['bucharest', 'seattle'] };
const FULL = {
    bucharest: ['audit', 'a', 'h', 'i', 'b', 'd', 'g', 'e', 'c', 'f'],
    seattle: ['audit', 'a', 'h', 'd', 'e'],
};
function buildPlan(list) {
    // list: [{id, group, city}] from the page
    const ids = (sel) => list.filter(s => s.id === sel || s.group === sel).map(s => s.id);
    const cityOf = (s) => s.city === 'any' ? null : s.city;
    const plan = { bucharest: [], seattle: [] };
    const cities = args.city ? [args.city] : ['bucharest', 'seattle'];
    if (args.audit) { for (const c of cities) plan[c].push('audit'); return plan; }
    if (!args.scenario) {
        for (const c of cities) for (const sel of FULL[c]) {
            if (sel === 'audit') { if (!args.noAudit) plan[c].push('audit'); continue; }
            for (const id of ids(sel)) { const s = list.find(x => x.id === id); if (cityOf(s) && cityOf(s) !== c) continue; plan[c].push(id); }
        }
        return plan;
    }
    for (const sel of args.scenario.split(',')) {
        const found = ids(sel); if (!found.length) { console.error(`unknown scenario "${sel}". Known: ${list.map(s => s.id).join(', ')}`); process.exit(2); }
        for (const id of found) {
            const s = list.find(x => x.id === id);
            const want = args.city ? [args.city] : cityOf(s) ? [cityOf(s)] : (DEFAULT_CITIES[s.group || s.id] || ['bucharest']);
            for (const c of want) { if (cityOf(s) && cityOf(s) !== c && !(s.id === 'f')) { console.error(`scenario ${id} only runs in ${cityOf(s)}`); continue; } plan[c].push(id); }
        }
    }
    return plan;
}

// ---------------------------------------------------------------- static server
function probe(port) {
    return new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: '/game/index.html', timeout: 1500 }, (rs) => { rs.resume(); res(rs.statusCode === 200); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, rs) => {
            let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
            const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
            if (!f.startsWith(ROOT)) { rs.writeHead(403); rs.end(); return; }
            fs.readFile(f, (err, buf) => { if (err) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); rs.end(buf); });
        });
        srv.listen(0, '127.0.0.1', () => res(srv));
    });
}

// ---------------------------------------------------------------- main
const nodeIssues = [];
const scenarioResults = [];
const audits = {};
let page, browser, base;
const t0 = Date.now();
const RUN_ID = new Date(t0).toISOString().slice(11, 19).replace(/:/g, ''); // shots are prefixed so parallel runs never overwrite each other
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

const INIT = () => {
    window.__harnessErrors = [];
    const push = (e) => { if (window.__harnessErrors.length < 500) window.__harnessErrors.push(e); };
    window.addEventListener('error', (e) => push({ kind: 'error', msg: e.message, stack: e.error?.stack || `${e.filename}:${e.lineno}` }));
    window.addEventListener('unhandledrejection', (e) => push({ kind: 'rejection', msg: 'unhandled rejection: ' + (e.reason?.message || e.reason), stack: e.reason?.stack || '' }));
    const ce = console.error.bind(console);
    console.error = (...a) => { push({ kind: 'console', msg: a.map(x => x instanceof Error ? x.message : typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch { return String(x); } })() : String(x)).join(' '), stack: new Error().stack }); ce(...a); };
    try { localStorage.setItem('dmcv:minimap', '0'); } catch { /* ignore */ }
};

async function openGame() {
    const { chromium } = require('playwright');
    if (!browser) browser = await chromium.launch({ headless: !args.headed, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
    if (page) await page.close().catch(() => { });
    const ctx = await browser.newContext({ viewport: { width: args.width, height: args.height }, deviceScaleFactor: 1 });
    // never hit the live weather API from automated runs (quota + determinism): answer with an error so the game uses climate data
    await ctx.route(/api\.open-meteo\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"error":true,"reason":"harness: live weather disabled"}' }));
    page = await ctx.newPage();
    await page.addInitScript(INIT);
    page.on('console', (m) => {
        const tx = m.text();
        if (m.type() === 'error' && /Failed to load resource/.test(tx)) {
            const url = m.location()?.url || '', local = !url || url.startsWith(base);
            const type = local ? 'resource-failed' : 'external-request-failed', key = type + (local ? url : url.replace(/\?.*$/, ''));
            const old = nodeIssues.find(i => i.key === key);
            if (old) old.count++;
            else nodeIssues.push({ key, type, severity: local ? 'high' : 'low', msg: `${tx} ${url}${local ? '' : ' (external service; the game must cope without it)'}`, scenario: current.id, city: current.city, count: 1 });
        }
        if (args.verbose && (m.type() === 'error' || m.type() === 'warning')) log('[page]', m.type(), tx.slice(0, 200));
    });
    page.on('crash', () => nodeIssues.push({ type: 'page-crash', severity: 'high', msg: 'the page crashed', scenario: current.id, city: current.city, count: 1 }));
    await page.exposeFunction('harnessShot', async (name) => {
        const file = RUN_ID + '-' + name.replace(/[^\w.-]+/g, '_').slice(0, 90) + '.jpg';
        try { await page.screenshot({ path: path.join(SHOTS, file), type: 'jpeg', quality: 70, timeout: 15000 }); return 'shots/' + file; } catch (e) { return null; }
    });
    await page.exposeFunction('harnessLog', (line) => { if (args.verbose || / ISSUE high /.test(line)) log('  ' + line); });
    await page.goto(base + 'game/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForFunction(() => window.game, null, { timeout: 30000 }); }
    catch (e) {
        const errs = await page.evaluate(() => window.__harnessErrors || []).catch(() => []);
        const err = new Error('the game did not boot (window.game missing after 30 s): ' + (errs.map(x => x.msg).join(' | ') || 'no error captured'));
        err.boot = errs; throw err;
    }
    // renderer low, but keep the owner's (desktop) traffic density unless --traffic=low
    await page.evaluate((traffic) => { const g = window.game; g.r3d.setQuality('low'); const sel = document.querySelector('#quality'); if (sel) sel.value = 'low'; g.quality = traffic === 'low' ? 'low' : 'auto'; g.audio?.setMuted?.(true); }, args.traffic);
    await page.addScriptTag({ url: base + 'game/dev/harness/page/index.js?v=' + Date.now(), type: 'module' });
    await page.waitForFunction(() => window.harness, null, { timeout: 30000 });
    await page.evaluate(({ dt, shots, idBase, trace, shotAll }) => { window.harness.H.dt = dt; window.harness.H.maxShots = shots; window.harness.H.idBase = idBase; window.harness.H.trace = trace; window.harness.H.shotAll = shotAll; }, { dt: args.dt, shots: args.shots, idBase: pageIssues.length, trace: args.trace || 0, shotAll: !!args.shotAll });
    loadedCity = null;
}
let loadedCity = null;
const current = { id: 'boot', city: null };

async function ensureCity(city) {
    if (loadedCity === city) return;
    const actual = await page.evaluate(() => window.game.started ? window.game.city?.id : null);
    if (actual === city) { loadedCity = city; return; }
    log(`loading ${city}…`);
    const t = Date.now();
    const ok = await page.evaluate((c) => window.harness.loadCity(c), city);
    if (!ok) throw new Error('could not load ' + city);
    loadedCity = city;
    const s = await page.evaluate(() => { const w = window.game.world; return { edges: w.graph.edges.length, colliders: w.buildings.length, vehicles: window.game.traffic.vehicles.length, peds: window.game.traffic.peds?.list?.length, buildMs: w.stats?.buildMs }; });
    log(`${city} ready in ${((Date.now() - t) / 1000).toFixed(1)} s`, JSON.stringify(s));
}

function withTimeout(p, ms, what) {
    let to; const timer = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000} s`)), ms); });
    return Promise.race([p, timer]).finally(() => clearTimeout(to));
}

async function main() {
    fs.mkdirSync(SHOTS, { recursive: true });
    // screenshots of earlier runs are stale; files younger than 20 min may belong to a run going on in parallel
    for (const f of fs.readdirSync(SHOTS)) { const p = path.join(SHOTS, f); try { if (/\.(jpg|png)$/.test(f) && Date.now() - fs.statSync(p).mtimeMs > 20 * 60e3) fs.unlinkSync(p); } catch { /* ignore */ } }
    let srv = null;
    if (await probe(args.port)) base = `http://127.0.0.1:${args.port}/`;
    else { srv = await serve(); base = `http://127.0.0.1:${srv.address().port}/`; log('started a static server on', base); }
    await openGame();
    const list = await page.evaluate(() => window.harness.list());
    const plan = buildPlan(list);
    const total = plan.bucharest.length + plan.seattle.length;
    log(`plan: bucharest [${plan.bucharest.join(' ')}] seattle [${plan.seattle.join(' ')}] (${total} items)`);
    for (const city of ['bucharest', 'seattle']) {
        for (const id of plan[city]) {
            current.id = id; current.city = city;
            try {
                await ensureCity(city);
                if (id === 'audit') {
                    const t = Date.now();
                    const a = await withTimeout(page.evaluate(() => window.harness.audit()), args.timeout * 1000, 'audit');
                    audits[city] = a;
                    log(`audit ${city}: ${Object.entries(a.counts).map(([k, v]) => `${k}=${v}`).join(' ') || 'clean'} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
                    continue;
                }
                const r = await withTimeout(page.evaluate((sid) => window.harness.runScenario(sid), id), args.timeout * 1000, 'scenario ' + id);
                scenarioResults.push(r);
                loadedCity = r.city;
                log(`${id.padEnd(12)} ${r.city.padEnd(9)} sim ${String(r.simSec).padStart(5)} s  wall ${(r.wallMs / 1000).toFixed(1).padStart(5)} s  +${r.newIssues} issues${r.error ? '  CRASH ' + r.error.split('\n')[0] : ''}`);
            } catch (e) {
                log(`!! ${id} (${city}): ${e.message}`);
                nodeIssues.push({ type: 'harness-timeout', severity: 'medium', msg: `${id} in ${city}: ${e.message}`, scenario: id, city, count: 1 });
                scenarioResults.push({ id, city, error: e.message, wallMs: 0, simSec: 0, newIssues: 0 });
                // recover: fresh page, the next item reloads its city
                const saved = await page.evaluate(() => window.harness ? window.harness.issues : []).catch(() => []);
                pageIssues.push(...saved);
                pageLog.push(...await page.evaluate(() => window.harness ? window.harness.log() : []).catch(() => []));
                await openGame();
            }
        }
    }
    const issues = pageIssues.concat(await page.evaluate(() => window.harness.issues).catch(() => []));
    const perf = await page.evaluate(() => window.harness.perfProbe(4)).catch(() => null);
    const harnessLog = pageLog.concat(await page.evaluate(() => window.harness.log()).catch(() => []));
    if (perf && perf.quality === 'low' && perf.w <= 640 && perf.h <= 360 && perf.fps < 10) {
        nodeIssues.push({ type: 'perf-fps', severity: 'low', msg: `${perf.fps} fps (${perf.msPerFrame} ms/frame, ${perf.drawCalls} draw calls, ${perf.triangles} tris) at quality low ${perf.w}×${perf.h} in software GL — not representative of real GPUs`, scenario: 'end', city: loadedCity, count: 1 });
    }
    await browser.close().catch(() => { });
    if (srv) srv.close();
    const rep = writeReport({ outDir: OUT, args, issues, nodeIssues, audits, scenarioResults, perf, durationSec: (Date.now() - t0) / 1000, harnessLog });
    console.log('\n' + rep.summaryText);
    process.exit(rep.high > 0 ? 1 : 0);
}
const pageIssues = [];
const pageLog = [];
main().catch(async (e) => {
    try { await browser?.close(); } catch { /* ignore */ }
    if (e.boot) {
        // the game itself is broken: that is a finding, not a harness failure
        nodeIssues.push({ type: 'boot-failure', severity: 'high', msg: e.message, scenario: 'boot', city: null, count: 1, data: { errors: e.boot } });
        const rep = writeReport({ outDir: OUT, args, issues: pageIssues, nodeIssues, audits, scenarioResults, perf: null, durationSec: (Date.now() - t0) / 1000, harnessLog: pageLog });
        console.log('\n' + rep.summaryText); process.exit(1);
    }
    console.error('harness failed:', e); process.exit(3);
});
