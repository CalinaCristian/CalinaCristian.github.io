// ============================================================================
//  Visual QA (runs inside the game page, injected by ../run.js after boot).
//  window.vqa: route survey (forward / looks / aerial captures), contact sheets,
//  pixel + geometry + cockpit/UI + canvas-text detectors. Never edits the game:
//  it takes over the render loop and renders only on request.
// ============================================================================
import * as THREE from '../../../../vendor/three.module.min.js';
import { geometryDetectors, makeCorridor, ribbonModel } from './geometry.js';
import { polyMask, analyseRoad, skyColour, zfightDiff } from './pixels.js';
import { uiChecks } from './ui.js';

const g = window.game;
const SEV = { high: 0, medium: 1, low: 2 };
const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nameOf = (e) => !e ? '' : (e.name || e.ref || (e.type ? `(${e.type})` : 'unnamed road'));
const canTravel = (e, d) => d > 0 ? (e.lanesF ?? e.lanes ?? 1) > 0 : !e.oneway && (e.lanesB ?? e.lanes ?? 1) > 0;
const laneOff = (e, lane = 0) => (e.median ?? (e.tram ? 4.4 : 0)) / 2 + (e.laneW ?? 3.3) * (lane + 0.5);

const S = {
    opts: { quality: 'medium', far: 0, time: 'day', weather: 'clear', traffic: false, trafficSteps: 12, every: 40, lookEvery: 200, aerialEvery: 200, zEvery: 3, aerial: true, looks: true, size: 120, pr: 0.5 },
    issues: [], byKey: new Map(), routes: new Map(), sheets: new Map(), masks: new Map(), log: [], counts: {}, renderNow: false,
    model: null, corridorPts: [], cityKey: null, focus: 0,
};
const note = (m) => { S.log.push(m); if (S.log.length > 4000) S.log.shift(); };

// ------------------------------------------------------------------ issues
function where(x, z) {
    const o = { x: r1(x), z: r1(z) };
    try { const ll = g.city?.proj?.inverse?.(x, z); if (ll) { o.lat = +ll.lat.toFixed(6); o.lon = +ll.lon.toFixed(6); } } catch { /* ignore */ }
    try { const ne = g.nav?.index?.nearest(x, z, 150); o.street = ne ? nameOf(ne.edge) : '(off road)'; } catch { o.street = '?'; }
    return o;
}
function issue(type, severity, msg, data = {}, opt = {}) {
    S.counts[type] = (S.counts[type] || 0) + 1;
    const hasXZ = data.x !== undefined && data.z !== undefined;
    const key = `${S.cityKey}|${type}|${opt.key ?? (hasXZ ? Math.round(data.x / 25) + ',' + Math.round(data.z / 25) : msg.slice(0, 80))}`;
    const old = S.byKey.get(key);
    if (old) { old.count++; if (SEV[severity] < SEV[old.severity]) { old.severity = severity; old.msg = msg; } return old; }
    const d = { ...data }; delete d.x; delete d.z;
    const it = { id: (S.idBase || 0) + S.issues.length + 1, type, severity, city: g.city?.id, group: S.cityKey, msg, ...(hasXZ ? where(data.x, data.z) : {}), count: 1, data: d, ...opt.extra };
    S.issues.push(it); S.byKey.set(key, it);
    return it;
}

// ------------------------------------------------------------------ files / canvases
async function save(rel, canvas, type = 'image/jpeg', q = 0.86) {
    const url = canvas.convertToBlob ? await blobUrl(await canvas.convertToBlob({ type, quality: q })) : canvas.toDataURL(type, q);
    try { return await window.vqaSave(rel, url); } catch (e) { note('save failed ' + rel + ': ' + e.message); return null; }
}
const blobUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
function grab(w, h, sx = 0, sy = 0, sw, sh) {
    const src = g.renderer.domElement;
    const c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, sx, sy, sw ?? src.width, sh ?? src.height, 0, 0, w, h);
    return c;
}
const imgData = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);

// ------------------------------------------------------------------ contact sheets (≤ 6 tiles, ≥ 640 px wide each)
class Sheet {
    constructor(name, { cols = 2, tw = 640, th = 360, per = 6, title = '' } = {}) { Object.assign(this, { name, cols, tw, th, per, title, n: 0, page: 0, c: null, files: [], labels: [] }); }
    async add(img, label, sub = '', flags = [], marks = null) {
        const LH = 40;
        if (!this.c) {
            const rows = Math.ceil(this.per / this.cols);
            this.c = new OffscreenCanvas(this.cols * this.tw + (this.cols - 1) * 6, rows * (this.th + LH + 6) + 30);
            const x = this.c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, this.c.width, this.c.height);
            x.fillStyle = '#ddd'; x.font = 'bold 16px Arial'; x.fillText(`${this.title || this.name} — sheet ${this.page + 1}`, 8, 20);
            this.labels = [];
        }
        const x = this.c.getContext('2d');
        const col = this.n % this.cols, row = Math.floor(this.n / this.cols);
        const ox = col * (this.tw + 6), oy = 30 + row * (this.th + LH + 6);
        x.drawImage(img, 0, 0, img.width, img.height, ox, oy + LH, this.tw, this.th);
        if (marks) marks(x, ox, oy + LH, this.tw / img.width, this.th / img.height);
        x.fillStyle = flags.length ? '#5a1d1d' : '#222'; x.fillRect(ox, oy, this.tw, LH);
        // line 1: title (full width); line 2: position (left) + detector flags (right, never over the title)
        x.fillStyle = '#fff'; x.font = 'bold 14px Arial'; x.fillText(label.slice(0, 90), ox + 6, oy + 16, this.tw - 12);
        let fw = 0;
        if (flags.length) { x.fillStyle = '#ff8080'; x.font = 'bold 12px Arial'; const t = flags.join(' · ').slice(0, 70); fw = Math.min(x.measureText(t).width, this.tw * 0.5); x.fillText(t, ox + this.tw - 6 - fw, oy + 33, this.tw * 0.5); }
        x.font = '12px Arial'; x.fillStyle = '#ccc'; x.fillText(sub.slice(0, 110), ox + 6, oy + 33, this.tw - 24 - fw);
        this.labels.push(label + (flags.length ? ' [' + flags.join(', ') + ']' : ''));
        this.n++;
        if (this.n >= this.per) await this.flush();
    }
    async flush() {
        if (!this.c || !this.n) return;
        const file = `sheets/${this.name}-${String(this.page + 1).padStart(3, '0')}.jpg`;
        const p = await save(file, this.c, 'image/jpeg', 0.84);
        if (p) this.files.push({ file: p, labels: this.labels.slice() });
        this.c = null; this.n = 0; this.page++;
    }
}
const sheet = (name, o) => { let s = S.sheets.get(name); if (!s) S.sheets.set(name, s = new Sheet(name, o)); return s; };

// ------------------------------------------------------------------ boot / city
function takeOver() {
    if (S.installed) return; S.installed = true;
    g.loop = function loop() { requestAnimationFrame(g.loop); g.frameClock?.getDelta?.(); };
    const df = g.drawFrame.bind(g);
    g.drawFrame = (o) => { if (S.renderNow) df(o); };
}
/** internal render resolution: CSS viewport × S.opts.pr (software GL is fragment-bound; sheets are 640 px wide anyway) */
function setPR() {
    try { const R = g.renderer, pr = S.opts.pr || 1; if (Math.abs(R.getPixelRatio() - pr) > 1e-3) { R.setPixelRatio(pr); g.r3d.composer?.setPixelRatio?.(pr); g.r3d.resize?.(innerWidth, innerHeight); } } catch (e) { note('pr: ' + e.message); }
}
/** swap every mesh material for an unlit vertex-colour clone (keeps polygonOffset / side / depth state): cheap renders for the flicker test */
const _basic = new Map();
function basicSwap(root) {
    const swapped = [];
    root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.material || Array.isArray(o.material)) return;
        const m = o.material; let b = _basic.get(m);
        if (!b) {
            b = new THREE.MeshBasicMaterial({ vertexColors: !!m.vertexColors, color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, depthWrite: m.depthWrite, depthTest: m.depthTest, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, fog: false });
            _basic.set(m, b);
        }
        swapped.push([o, m]); o.material = b;
    });
    return () => { for (const [o, m] of swapped) o.material = m; };
}
function hideTraffic(force = false) {
    if (S.opts.traffic && !force) return;
    try { if (g.traffic?.group) g.traffic.group.visible = false; const p = g.traffic?.peds; if (p) { if (p.bodyMesh) p.bodyMesh.visible = false; if (p.headMesh) p.headMesh.visible = false; if (p.group) p.group.visible = false; } } catch { /* ignore */ }
}
function applyLook() {
    const tod = S.opts.time || 'day', wx = S.opts.weather || 'clear';
    try { g.clock.override = tod; g.r3d.setClock({ override: tod }); } catch (e) { note('clock: ' + e.message); }
    try { if (g.setWeatherOverride) g.setWeatherOverride(wx); else g.r3d.setWeather?.(wx, { instant: true }); g.r3d.setWeather?.(wx, { instant: true }); } catch (e) { note('weather: ' + e.message); }
    try { g.r3d.setQuality(S.opts.quality); const sel = document.querySelector('#quality'); if (sel) sel.value = S.opts.quality; g.quality = S.opts.quality; } catch (e) { note('quality: ' + e.message); }
    try { const night = /night|dusk/.test(S.opts.time || ''); g.headlights = night ? 'auto' : false; g.r3d.setHeadlights?.(night ? null : false); } catch { /* ignore */ }
    setPR();
    hideTraffic();
}
async function chaptersList() {
    try { const m = await import('../../../../src/cities.js'); return Array.isArray(m.CHAPTERS) && m.CHAPTERS.length ? m.CHAPTERS : null; } catch { return null; }
}
/** groups to survey: one per loaded world (legacy city or chapter district) */
async function groups(cityFilter) {
    const ch = await chaptersList();
    const out = [];
    if (ch) {
        for (const c of ch) {
            if (cityFilter && c.city !== cityFilter) continue;
            const key = `${c.city}-${c.district}`;
            let gr = out.find(o => o.key === key);
            if (!gr) out.push(gr = { key, city: c.city, district: c.district, chapters: [] });
            gr.chapters.push({ id: c.id, stop: c.stop, title: c.title, year: c.year });
        }
        return { mode: 'chapters', groups: out };
    }
    for (const c of ['bucharest', 'seattle']) if (!cityFilter || c === cityFilter) out.push({ key: c, city: c, district: null, chapters: [] });
    return { mode: 'legacy', groups: out };
}
async function loadGroup(key, opts = {}) {
    Object.assign(S.opts, opts);
    takeOver();
    const { groups: gs } = await groups(null);
    const gr = gs.find(x => x.key === key); if (!gr) throw new Error('unknown group ' + key);
    S.cityKey = key; S.model = null; S.corridorPts = []; S.routes.clear(); S.masks.clear();
    g.state = 'loading';
    if (!g.started) { g.started = true; document.querySelector('#menu')?.classList.remove('show'); document.querySelector('#hud')?.classList.add('show'); g.startTime = performance.now(); }
    g.clock.override = S.opts.time || 'day'; g.weatherOverride = S.opts.weather || 'clear';
    try { g.quality = S.opts.quality; } catch { /* ignore */ } // (traffic pool sizes follow the quality at load time)
    const t0 = performance.now();
    if (gr.district) {
        const ch = (await chaptersList()).find(c => c.city === gr.city && c.district === gr.district);
        await g.loadCity(gr.city, { district: gr.district, start: ch.start });
        if (distId() !== gr.district) note(`asked for district ${gr.district}, world says ${distId()}`);
    } else await g.loadCity(gr.city);
    try { g.player.camHolder.add(g.camera); g.camera.position.set(0, 0, 0); g.camera.rotation.set(0, 0, 0); } catch { /* ignore */ }
    if (S.gameFar == null) S.gameFar = g.camera.far;
    g.fuel = 45; g.state = 'drive';
    applyLook();
    document.body.classList.add('no-minimap');
    S.spawn = { x: g.player.x, z: g.player.z, heading: g.player.heading };
    return { key, city: g.city.id, district: distId(), ms: Math.round(performance.now() - t0), edges: g.world.graph.edges.length, ribbons: g.world.ribbons?.length ?? null };
}

// ------------------------------------------------------------------ route plans
function distId() { const d = g.world?.district; return d == null ? null : typeof d === 'string' ? d : (d.id ?? null); }
function doorOf(p) { return p ? { x: p.doorX ?? p.x, z: p.doorZ ?? p.z } : null; }
async function plans() {
    const W = g.world, out = [];
    const chs = await chaptersList();
    if (chs && distId()) {
        for (const c of chs.filter(c => c.city === g.city.id && c.district === distId())) {
            // the game's own chapter start pose (legal lane of start.road) when it exposes it
            let st = null; try { st = g.chapterPose ? g.chapterPose(c) : null; } catch { /* ignore */ }
            if (st) st = { x: st.x, z: st.z, heading: st.heading };
            else { const q = c.start ? g.city.proj(c.start.lat, c.start.lon) : S.spawn; st = { x: q.x, z: q.z, heading: c.start?.heading != null ? -c.start.heading * Math.PI / 180 : null }; }
            let to = null;
            if (c.stop) { const poi = W.pois.find(p => p.id === c.stop); if (poi) to = { ...doorOf(poi), label: c.stop }; }
            else if (c.waypoint) { const q = g.city.proj(c.waypoint.lat, c.waypoint.lon); to = { x: q.x, z: q.z, label: c.waypoint.label || 'waypoint' }; }
            if (!to) { issue('route-missing', 'high', `chapter ${c.id}: ${c.stop ? `stop POI "${c.stop}" not in the district world` : 'no stop / waypoint'}`, {}); continue; }
            out.push({ id: c.id, label: `${c.year ?? ''} ${c.title ?? c.id}`.trim(), kind: 'chapter', from: st, to });
        }
        // free-roam sweep of the district's main streets (longest named primary/secondary/tertiary/trunk roads)
        const byName = new Map();
        for (const e of W.graph.edges) { if (!e.name || !/^(trunk|primary|secondary|tertiary)/.test(e.type || '')) continue; let a = byName.get(e.name); if (!a) byName.set(e.name, a = { len: 0, edges: [] }); a.len += e.len; a.edges.push(e); }
        // skip streets the chapter routes already drive along (≥ 60 % of their length within 25 m of a chapter route)
        const chPts = [];
        for (const sp of out) { try { const r = g.nav.compute(sp.from.x, sp.from.z, sp.to.x, sp.to.z, sp.from.heading); for (const p of r?.points || []) chPts.push(p); } catch { /* ignore */ } }
        const covered = (e) => chPts.some(p => Math.hypot(p[0] - (e.a.x + e.b.x) / 2, p[1] - (e.a.z + e.b.z) / 2) < 25 + e.len / 2);
        const top = [...byName.entries()].filter(([, o]) => o.edges.filter(covered).reduce((t, e) => t + e.len, 0) < 0.6 * o.len).sort((a, b) => b[1].len - a[1].len).slice(0, S.opts.sweep ?? 2);
        for (const [name, o] of top) {
            const ns = o.edges.flatMap(e => [e.a, e.b]); let best = null, bd = 0;
            for (const p of ns) for (const q of ns) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d > bd) { bd = d; best = [p, q]; } }
            if (!best || bd < 150) continue;
            // drive the street in the direction the router actually follows it (one-way streets: the other way detours)
            const share = (p, q) => { try { const r = g.nav.compute(p.x, p.z, q.x, q.z, null); if (!r?.legs?.length) return 0; let on = 0, all = 0; for (const L of r.legs) { all += L.e.len; if (L.e.name === name) on += L.e.len; } return all ? on / all : 0; } catch { return 0; } };
            if (share(best[1], best[0]) > share(best[0], best[1]) + 0.05) best = [best[1], best[0]];
            out.push({ id: 'sweep-' + name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, ''), label: 'main street: ' + name, kind: 'sweep', from: { x: best[0].x, z: best[0].z, heading: null }, to: { x: best[1].x, z: best[1].z, label: name } });
        }
        return out;
    }
    // legacy corridor worlds: spawn → stops in story order (→ airport)
    const stops = (g.stops || []).filter(s => s.poiRef);
    let from = { x: S.spawn.x, z: S.spawn.z, heading: S.spawn.heading }, fromId = g.city.id === 'seattle' ? 'seatac' : 'spawn';
    const legs = stops.map(s => ({ id: s.id, ...doorOf(s.poiRef) }));
    if (g.city.id === 'bucharest' && g.airport) legs.push({ id: 'otopeni', ...doorOf(g.airport) });
    for (const L of legs) {
        out.push({ id: `${fromId}-${L.id}`, label: `${fromId} → ${L.id}`, kind: 'story', from, to: { x: L.x, z: L.z, label: L.id } });
        from = { x: L.x, z: L.z, heading: null }; fromId = L.id;
    }
    return out;
}
/** compute + sample a route; returns a summary (samples stay in the page) */
function sampleRoute(spec) {
    const every = S.opts.every;
    let route = null;
    try { route = g.nav.compute(spec.from.x, spec.from.z, spec.to.x, spec.to.z, spec.from.heading); } catch (e) { note('compute ' + spec.id + ': ' + e.message); }
    if (!route || !route.points || route.points.length < 2) { issue('route-missing', 'high', `no route for ${spec.id} (${spec.label})`, { x: spec.from.x, z: spec.from.z }); return { id: spec.id, ok: false }; }
    const P = route.points, L = route.legs || [];
    // lane-centre polyline (right-hand lane 0), mid-points between legs
    const segs = [];
    for (let i = 0; i < P.length - 1; i++) {
        const leg = L[i]; let ox = 0, oz = 0;
        if (leg?.e) { const off = laneOff(leg.e, 0); ox = leg.e.nx * leg.dir * off; oz = leg.e.nz * leg.dir * off; }
        segs.push([P[i][0] + ox, P[i][1] + oz, P[i + 1][0] + ox, P[i + 1][1] + oz, leg]);
    }
    const pts = [[segs[0][0], segs[0][1]]], legOf = [];
    for (let i = 0; i < segs.length; i++) { const s = segs[i], n = segs[i + 1]; pts.push(n ? [(s[2] + n[0]) / 2, (s[3] + n[1]) / 2] : [s[2], s[3]]); legOf.push(s[4]); }
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (s) => {
        let i = 0; while (i < pts.length - 2 && cum[i + 1] < s) i++;
        const Ls = cum[i + 1] - cum[i] || 1, t = clamp((s - cum[i]) / Ls, 0, 1);
        const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
        const leg = legOf[Math.min(i, legOf.length - 1)];
        let y = 0.24; if (leg?.e && leg.e.ya !== undefined) { const e = leg.e; y = 0.24 + e.ya + (e.yb - e.ya) * clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); }
        return { x, z, y, i, leg };
    };
    const dirAt = (s) => { const a = at(Math.max(0, s - 3)), b = at(Math.min(total, s + 3)); const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    const samples = [];
    const lo = S.opts.from ?? 0, hi = Math.min(S.opts.to ?? Infinity, spec.kind === 'sweep' ? (S.opts.sweepMax ?? 2000) : Infinity);
    for (let s = 2; s < total - 4; s += every) {
        if (s < lo || s > hi) continue;
        const p = at(s), [fx, fz] = dirAt(s);
        samples.push({ s, x: p.x, z: p.z, y: p.y, fx, fz, heading: Math.atan2(-fx, -fz), edge: p.leg?.e || null, dir: p.leg?.dir || 1 });
    }
    // dense lane path for hole detection + corridor
    const dense = []; for (let s = Math.max(0, lo - 60); s <= Math.min(total, hi + 60); s += 2) { const p = at(s); dense.push([p.x, p.z, p.y]); }
    for (let k = 0; k < dense.length; k += 5) S.corridorPts.push([dense[k][0], dense[k][1]]);
    const r = { spec, route, total, at, dirAt, samples, dense, base: S.routeBase || 0 };
    S.routes.set(spec.id, r);
    return { id: spec.id, ok: true, label: spec.label, kind: spec.kind, total: Math.round(total), n: samples.length, from: where(spec.from.x, spec.from.z), to: where(spec.to.x, spec.to.z) };
}

// ------------------------------------------------------------------ geometry (corridor of all sampled routes)
function runGeometry(all = false) {
    const corridor = all ? makeCorridor([], 0) : makeCorridor(S.corridorPts, S.opts.corridor ?? 70);
    if (all) corridor.all = true;
    const paths = [...S.routes.values()].map(r => r.dense);
    S.geoIssues = [];
    const res = geometryDetectors(g, {
        THREE, world: g.world, corridor, paths, extraGroups: [g.props].filter(Boolean),
        issue: (type, sev, msg, data) => { const it = issue(type, sev, msg, data); if (it.count === 1) S.geoIssues.push(it); },
    });
    S.model = ribbonModel(g.world, corridor);
    return res;
}

// ------------------------------------------------------------------ rendering helpers
/** --far > 0 clips the survey frames (old behaviour); default 0 = the game's own far plane (round 2: weather-driven visibility, 15–20 km on clear days) */
function setFar() { const c = g.camera, f = S.opts.far > 0 ? S.opts.far : (S.gameFar || c.far); if (c.far !== f) { c.far = f; c.updateProjectionMatrix(); } }
function place(sm) {
    const P = g.player;
    P.place(sm.x, sm.z, sm.heading, sm.edge || null);
    P.speed = 0; P.steer = 0; P.steerVisual = 0; P.shake = 0; P.lookBack = false;
    try { P.resetLook?.(); } catch { /* ignore */ }
    P.updateRig?.(0);
    P.camHolder.rotation.set(0, 0, 0);
    try { g.traffic?.setPlayer?.(P); } catch { /* ignore */ }
}
function stepGame() {
    // one game step with no input: nav, HUD, car screen, gauges (rendering is blocked)
    try { const i = g.input; if (i?.touch) { i.touch.throttle = 0; i.touch.steer = 0; i.touch.brake = true; } g.fuel = 45; g.updateDrive(1 / 60); } catch (e) { note('updateDrive: ' + e.message); }
}
function renderMain(mirror = true, { shadows = true } = {}) {
    setFar(); S.renderNow = true;
    const SM = g.renderer.shadowMap, au = SM.autoUpdate; if (!shadows) SM.autoUpdate = false;
    try {
        if (g.drawCarScreen && g.carScreen) { try { g.drawCarScreen(g.hud?.el?.street?.textContent || '', ''); } catch { /* ignore */ } }
        g.drawFrame({ mirror });
    } finally { S.renderNow = false; SM.autoUpdate = au; }
}
/** cockpit-only mask for the current canvas size (1 = cockpit pixel) */
function cockpitMask(w, h) {
    const k = w + 'x' + h; if (S.masks.has(k)) return S.masks.get(k);
    const sc = g.scene, R = g.renderer, vis = sc.children.map(c => c.visible), bg = sc.background, fog = sc.fog;
    sc.children.forEach(c => { c.visible = c === g.player.rig; });
    sc.background = new THREE.Color(1, 0, 1); sc.fog = null;
    R.setRenderTarget(null); R.render(sc, g.camera);
    const c = grab(w, h), d = imgData(c).data, m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = (d[i * 4] > 200 && d[i * 4 + 1] < 60 && d[i * 4 + 2] > 200) ? 0 : 1;
    sc.children.forEach((c, i) => { c.visible = vis[i]; }); sc.background = bg; sc.fog = fog;
    S.masks.set(k, m); return m;
}
function project(x, y, z, w, h) {
    const v = new THREE.Vector3(x, y, z).project(g.camera);
    return v.z > 1 || v.z < -1 ? null : [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
}
/** lane strip ahead (s+7 … s+40 m along the route, ±1.6 m) as a screen polygon */
function lanePoly(r, s, w, h) {
    const left = [], right = [];
    for (let d = 7; d <= 40; d += 3) {
        const ss = s + d; if (ss > r.total) break;
        const p = r.at(ss), [fx, fz] = r.dirAt(ss), nx = -fz, nz = fx;
        const a = project(p.x - nx * 1.6, p.y + 0.02, p.z - nz * 1.6, w, h), b = project(p.x + nx * 1.6, p.y + 0.02, p.z + nz * 1.6, w, h);
        if (a && b) { left.push(a); right.push(b); }
    }
    return left.length >= 2 ? left.concat(right.reverse()) : null;
}
function raycastWorld(px, py, w, h) {
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(px / w * 2 - 1, 1 - py / h * 2), g.camera); rc.far = S.opts.far;
    const cells = g.world.group.getObjectByName('cells');
    const objs = cells ? cells.children.filter(m => m.visible && /^(ground|marks|solid|pave|area|grass)/.test(m.name)) : [g.world.group];
    const hit = rc.intersectObjects(objs, false)[0];
    return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z, mesh: hit.object.name } : null;
}
function surfacesHere(x, z) {
    const out = []; if (!S.model) S.model = ribbonModel(g.world, makeCorridor(S.corridorPts, S.opts.corridor ?? 70));
    S.model.at(x, z, (it) => out.push(`${it.e ? nameOf(it.e) + ' #' + it.e.id : 'pad n' + it.n.id} y=${it.h(x, z).toFixed(2)}`));
    return out;
}
async function cropSave(canvas, box, file, pad = 40) {
    const W = canvas.width, H = canvas.height;
    let [x0, y0, x1, y1] = box; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W, x1 + pad); y1 = Math.min(H, y1 + pad);
    const cw = Math.max(240, x1 - x0), ch = Math.max(160, y1 - y0);
    x0 = clamp(x0 - (cw - (x1 - x0)) / 2, 0, W - cw); y0 = clamp(y0 - (ch - (y1 - y0)) / 2, 0, H - ch);
    const c = new OffscreenCanvas(cw, ch), x = c.getContext('2d');
    x.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
    x.strokeStyle = '#ff2d2d'; x.lineWidth = 2; x.strokeRect(box[0] - x0, box[1] - y0, box[2] - box[0], box[3] - box[1]);
    return save(file, c, 'image/jpeg', 0.9);
}
function label(r, sm, idx) {
    const w = where(sm.x, sm.z);
    return { title: `#${idx} ${r.spec.id} ${Math.round(sm.s)} m · ${w.street}`, sub: `x ${w.x}, z ${w.z} · ${w.lat ?? ''}, ${w.lon ?? ''} · y ${sm.y.toFixed(2)}`, w };
}

// ------------------------------------------------------------------ aerial (top-down orthographic)
function renderAerial(x, y, z, fx, fz, size, px) {
    const R = g.renderer, sc = g.scene, cw = R.domElement.width, ch = R.domElement.height;
    const sq = Math.min(px, cw, ch);
    const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 1, 1500);
    cam.position.set(x, y + 600, z); cam.up.set(fx, 0, fz); cam.lookAt(x, y, z); cam.updateMatrixWorld(true);
    const fog = sc.fog; sc.fog = null;
    const SM = R.shadowMap, au = SM.autoUpdate; SM.autoUpdate = false;
    const pr = R.getPixelRatio();
    R.setRenderTarget(null); R.setScissorTest(true);
    R.setViewport(0, 0, sq / pr, sq / pr); R.setScissor(0, 0, sq / pr, sq / pr);
    try { R.render(sc, cam); } finally { sc.fog = fog; SM.autoUpdate = au; }
    const c = grab(sq, sq, 0, ch - sq, sq, sq);
    R.setScissorTest(false); R.setViewport(0, 0, cw / pr, ch / pr);
    return { c, cam, sq };
}
function aerialMarks(cam, sq, list, upText = 'driving direction') {
    return (x, ox, oy, kx, ky) => {
        for (const it of list) {
            const v = new THREE.Vector3(it.x, 0.3, it.z).project(cam);
            if (v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) continue;
            const px = ox + (v.x + 1) / 2 * sq * kx, py = oy + (1 - v.y) / 2 * sq * ky;
            x.strokeStyle = it.severity === 'high' ? '#ff2020' : it.severity === 'medium' ? '#ffb020' : '#40c0ff'; x.lineWidth = 2;
            x.beginPath(); x.arc(px, py, 9, 0, Math.PI * 2); x.stroke();
            x.fillStyle = '#fff'; x.font = 'bold 11px Arial'; x.fillText(String(it.id || it.type).slice(0, 10), px + 10, py - 6);
        }
        // scale bar (20 m) + forward arrow
        x.fillStyle = '#fff'; x.fillRect(ox + 10, oy + sq * ky - 14, 20 / (cam.right - cam.left) * sq * kx, 4); x.font = '11px Arial'; x.fillText('20 m · ↑ = ' + upText, ox + 10, oy + sq * ky - 18);
    };
}

// ------------------------------------------------------------------ the per-sample capture
async function capture(routeId, i) {
    const r = S.routes.get(routeId); const sm = r?.samples[i]; if (!sm) return null;
    const t0 = performance.now(); const tm = {}; let tl = t0; const lap = (k) => { const n = performance.now(); tm[k] = (tm[k] || 0) + Math.round(n - tl); tl = n; };
    const idx = (r.base || 0) + i;
    if (S.navFor !== routeId) { // the in-car nav screen shows this route (as when the player drives it)
        S.navFor = routeId; place(sm);
        try { if (g.setNavDest) g.setNavDest({ x: r.spec.to.x, z: r.spec.to.z, label: r.spec.to.label || r.spec.label }, true); else g.nav?.setDestination?.({ x: r.spec.to.x, z: r.spec.to.z, label: r.spec.to.label }, g.player); } catch (e) { note('nav: ' + e.message); }
    }
    place(sm); stepGame(); place(sm);
    if (S.opts.traffic && g.traffic) { // let the relocated fleet / crowd settle (instanced matrices, lanes, brake lights)
        try { for (let k = 0; k < (S.opts.trafficSteps ?? 12); k++) g.traffic.update(1 / 30); g.traffic.peds?.writeMatrices?.(); } catch (e) { note('traffic: ' + e.message); }
    }
    lap('step');
    const R = g.renderer, W = R.domElement.width, H = R.domElement.height;
    if (i === 0 || S.lastPlaced === undefined || Math.hypot(sm.x - S.lastPlaced.x, sm.z - S.lastPlaced.z) > 250) renderMain(false); // warm-up: culling / shadows / lamp pool
    S.lastPlaced = { x: sm.x, z: sm.z };
    const cm = cockpitMask(W, H); // cached per canvas size (renders the cockpit alone once)
    lap('warm');
    try { g.renderer.info.reset(); } catch { /* ignore */ }
    renderMain(true);
    const st = g.r3d?.stats || {}, perf = { calls: st.drawCalls ?? null, tris: st.triangles ?? null, quality: st.quality || S.opts.quality };
    const frame = grab(W, H); lap('render');
    const flags = [], found = [];
    const lb = label(r, sm, idx);
    // ---- pixels: lane ahead
    const img = imgData(frame);
    const lp = lanePoly(r, sm.s, W, H);
    if (lp) {
        const lane = polyMask(W, H, [lp]);
        const hz = project(sm.x + sm.fx * 2000, sm.y + 1.36, sm.z + sm.fz * 2000, W, H);
        const sky = skyColour(img, cm, hz ? hz[1] : H * 0.45);
        const a = analyseRoad(img, lane, cm, sky);
        if (S.opts.debugMasks) {
            const c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.drawImage(frame, 0, 0);
            const ov = x.getImageData(0, 0, W, H), d = ov.data;
            for (let k = 0; k < W * H; k++) { if (cm[k]) { d[k * 4] = d[k * 4] * 0.5 + 100; } else if (lane[k]) { d[k * 4 + 1] = d[k * 4 + 1] * 0.5 + 110; } }
            x.putImageData(ov, 0, 0); x.strokeStyle = '#0f0'; x.beginPath(); lp.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke();
            x.fillStyle = '#fff'; x.font = '16px Arial'; x.fillText(`n=${a.n} dark=${a.dark.toFixed(2)} sky=${a.sky.toFixed(2)} grey=${a.grey.toFixed(2)} col=${a.colourful.toFixed(2)} skyRef=${sky}`, 10, 20);
            await save(`debug/${S.cityKey}-${routeId}-${idx}-mask.jpg`, c);
        }
        if (a.n > 400) {
            if (a.dark > 0.08 && !/night|dusk/.test(S.opts.time || '')) { flags.push('dark ' + Math.round(a.dark * 100) + '%'); found.push(issue('road-dark-patch', a.dark > 0.2 ? 'high' : 'medium', `${Math.round(a.dark * 100)} % of the lane ahead renders near-black (luminance < 6 %) — black patch on the road surface`, { x: sm.x + sm.fx * 20, z: sm.z + sm.fz * 20, frac: +a.dark.toFixed(3), route: routeId, sample: idx, surfaces: surfacesHere(sm.x + sm.fx * 20, sm.z + sm.fz * 20) }, { extra: { box: a.darkBox } })); }
            if (a.sky > 0.03) { flags.push('sky ' + Math.round(a.sky * 100) + '%'); found.push(issue('road-sky-hole', a.sky > 0.1 ? 'high' : 'medium', `${Math.round(a.sky * 100)} % of the lane ahead is sky-coloured — a hole in the road surface`, { x: sm.x + sm.fx * 20, z: sm.z + sm.fz * 20, frac: +a.sky.toFixed(3), route: routeId, sample: idx }, { extra: { box: a.skyBox } })); }
            if (a.grey < 0.55 && a.colourful > 0.3) { flags.push('not-asphalt'); found.push(issue('road-not-asphalt', 'medium', `only ${Math.round(a.grey * 100)} % of the lane ahead looks like asphalt (${Math.round(a.colourful * 100)} % saturated colour: grass / wall / building / slab over the road?)`, { x: sm.x + sm.fx * 20, z: sm.z + sm.fz * 20, route: routeId, sample: idx }, { extra: { box: [Math.min(...lp.map(p => p[0])), Math.min(...lp.map(p => p[1])), Math.max(...lp.map(p => p[0])), Math.max(...lp.map(p => p[1]))].map(Math.round) } })); }
        }
    }
    lap('pixels');
    // ---- z-fight: two raw renders with a 1 mm jitter, half resolution
    let zf = null;
    if (S.opts.zEvery && i % S.opts.zEvery === 0) {
        // unlit material clones (same depth / polygonOffset state), no shadow pass, no post: ~5x cheaper than a game frame
        const SM = R.shadowMap, au = SM.autoUpdate, fog = g.scene.fog, restore = basicSwap(g.scene);
        try {
            SM.autoUpdate = false; g.scene.fog = null; R.setRenderTarget(null);
            const ch = g.player.camHolder;
            ch.updateMatrixWorld(true); R.render(g.scene, g.camera); const A = imgData(grab(W, H));
            ch.position.x += 0.001; ch.position.y += 0.001; ch.updateMatrixWorld(true); R.render(g.scene, g.camera); const B = imgData(grab(W, H));
            ch.position.x -= 0.001; ch.position.y -= 0.001; ch.updateMatrixWorld(true);
            zf = zfightDiff(A, B, cm);
        } finally { restore(); SM.autoUpdate = au; g.scene.fog = fog; }
        if (zf && zf.blocks.length >= 2) {
            const big = zf.blocks.reduce((a, b) => b.changed > a.changed ? b : a);
            const hit = raycastWorld(big.x + big.w / 2, big.y + big.h / 2, W, H);
            const at = hit || { x: sm.x + sm.fx * 20, z: sm.z + sm.fz * 20 };
            flags.push('zfight');
            found.push(issue('zfight', zf.blocks.length > 6 ? 'high' : 'medium', `flicker: ${zf.blocks.length} screen blocks change between two renders 1 mm apart (coplanar surfaces fighting${hit ? ' on ' + hit.mesh + ' at y=' + hit.y.toFixed(2) : ''})`, { x: at.x, z: at.z, route: routeId, sample: idx, blocks: zf.blocks.length, frac: +zf.frac.toFixed(4), surfaces: hit ? surfacesHere(hit.x, hit.z) : [] }, { extra: { box: zf.box } }));
        }
    }
    lap('zfight');
    // ---- crops for the issues found here
    for (const it of found) if (it.count === 1 && it.box && !it.crop) it.crop = await cropSave(frame, it.box, `issues/${S.cityKey}-${routeId}-${idx}-${it.type}.jpg`);
    if (found.length) { const p = await save(`frames/${S.cityKey}-${routeId}-${String(idx).padStart(4, '0')}.jpg`, frame, 'image/jpeg', 0.85); for (const it of found) if (!it.frame) it.frame = p; }
    // ---- sheets
    const geoNear = (S.geoIssues || []).filter(it => Math.hypot(it.x - sm.x, it.z - sm.z) < 45 && (it.x - sm.x) * sm.fx + (it.z - sm.z) * sm.fz > -5);
    const gflags = [...new Set(geoNear.filter(it => it.severity !== 'low').map(it => it.type))].slice(0, 3);
    const look = `${S.opts.time || 'day'}${S.opts.weather && S.opts.weather !== 'clear' ? ' ' + S.opts.weather : ''}${S.opts.traffic ? ', traffic' : ''}`;
    await sheet(`${S.cityKey}-${routeId}-forward`, { title: `${S.cityKey} · ${r.spec.label} · forward view every ${S.opts.every} m · ${look}` }).add(frame, lb.title, `${lb.sub} · ${perf.calls ?? '?'} calls ${perf.tris != null ? (perf.tris / 1e6).toFixed(2) + ' M tris' : ''}`, flags.concat(gflags));
    // ---- looks + aerial every ~200 m
    const lookHere = S.opts.looks && Math.floor(sm.s / S.opts.lookEvery) !== Math.floor((sm.s - S.opts.every) / S.opts.lookEvery);
    const aerialHere = S.opts.aerial && Math.floor(sm.s / S.opts.aerialEvery) !== Math.floor((sm.s - S.opts.every) / S.opts.aerialEvery);
    lap('sheet');
    if (lookHere) {
        const P = g.player, sh = sheet(`${S.cityKey}-${routeId}-looks`, { title: `${S.cityKey} · ${r.spec.label} · left / right / back every ${S.opts.lookEvery} m` });
        for (const [nm, yaw, back] of [['left', Math.PI / 2, false], ['right', -Math.PI / 2, false], ['back', Math.PI, true]]) {
            P.lookBack = back; P.camHolder.rotation.set(0, yaw, 0); P.camHolder.updateMatrixWorld(true);
            renderMain(false, { shadows: false });
            await sh.add(grab(W, H), `${lb.title} · ${nm}`, lb.sub);
        }
        P.lookBack = false; P.camHolder.rotation.set(0, 0, 0); P.camHolder.updateMatrixWorld(true);
    }
    lap('looks');
    if (aerialHere) {
        const a = renderAerial(sm.x, sm.y, sm.z, sm.fx, sm.fz, S.opts.size, H);
        const near = (S.geoIssues || []).filter(it => Math.abs(it.x - sm.x) < S.opts.size * 0.75 && Math.abs(it.z - sm.z) < S.opts.size * 0.75);
        const af = [...new Set(near.filter(it => it.severity === 'high').map(it => it.type))].slice(0, 3);
        await sheet(`${S.cityKey}-${routeId}-aerial`, { title: `${S.cityKey} · ${r.spec.label} · top-down ${S.opts.size} m tiles every ${S.opts.aerialEvery} m (car at centre, driving up; circles = geometry findings)`, tw: 640, th: 640 }).add(a.c, `${lb.title} · aerial`, lb.sub, af, aerialMarks(a.cam, a.sq, near));
    }
    lap('aerial');
    // ---- traffic shot every --traffic-every m: the same view with the fleet, transit and the instanced crowd (look + perf)
    let perfT = null;
    const trafHere = S.opts.trafficEvery > 0 && !S.opts.traffic && g.traffic && Math.floor(sm.s / S.opts.trafficEvery) !== Math.floor((sm.s - S.opts.every) / S.opts.trafficEvery);
    if (trafHere) {
        const tg = g.traffic, p = tg.peds;
        try {
            if (tg.group) tg.group.visible = true; if (p) { if (p.group) p.group.visible = true; if (p.bodyMesh) p.bodyMesh.visible = true; if (p.headMesh) p.headMesh.visible = true; }
            place(sm); for (let k = 0; k < (S.opts.trafficSteps ?? 12); k++) tg.update(1 / 30); try { p?.writeMatrices?.(); } catch { /* ignore */ }
            try { g.renderer.info.reset(); } catch { /* ignore */ }
            renderMain(true);
            const st2 = g.r3d?.stats || {}; perfT = { calls: st2.drawCalls ?? null, tris: st2.triangles ?? null, veh: tg.vehicles?.length ?? null, peds: p?.list?.length ?? p?.peds?.length ?? null };
            await sheet(`${S.cityKey}-${routeId}-traffic`, { title: `${S.cityKey} · ${r.spec.label} · with traffic + pedestrians every ${S.opts.trafficEvery} m · ${look}` }).add(grab(W, H), `${lb.title} · traffic`, `${lb.sub} · ${perfT.calls} calls ${(perfT.tris / 1e6).toFixed(2)} M tris · ${perfT.veh ?? '?'} vehicles`);
        } catch (e) { note('traffic shot: ' + e.message); }
        finally { hideTraffic(true); place(sm); }
    }
    lap('traffic');
    return { i, idx, s: Math.round(sm.s), x: Math.round(sm.x * 10) / 10, z: Math.round(sm.z * 10) / 10, street: lb.w.street, flags, ms: Math.round(performance.now() - t0), tm, zfight: zf ? +zf.frac.toFixed(4) : null, perf, perfT };
}

// ------------------------------------------------------------------ focused aerial crops for geometry findings
async function focusShots(max = 40) {
    // round-robin over detector types (worst first inside each type) so every kind of finding gets close-ups
    const byT = new Map();
    for (const it of (S.geoIssues || []).filter(it => it.severity !== 'low' && !it.crop).sort((a, b) => SEV[a.severity] - SEV[b.severity] || (b.data.area || 0) - (a.data.area || 0))) { if (!byT.has(it.type)) byT.set(it.type, []); byT.get(it.type).push(it); }
    const list = []; for (let k = 0; list.length < max && [...byT.values()].some(a => a.length > k); k++) for (const a of byT.values()) if (a[k] && list.length < max) list.push(a[k]);
    const sh = sheet(`${S.cityKey}-geometry`, { title: `${S.cityKey} · geometry findings (40 m top-down, north up)`, tw: 640, th: 640 });
    for (const it of list) {
        // move the car close so culling / shadows / lamp pools are right
        try { const pose = g.roadPose ? g.roadPose(it.x, it.z) : null; if (pose) place({ x: pose.x, z: pose.z, heading: pose.heading, edge: pose.edge, y: 0.24 }); } catch { /* ignore */ }
        const y = it.data.y ?? it.data.surf ?? 0.24;
        const a = renderAerial(it.x, typeof y === 'number' ? y : 0.24, it.z, 0, -1, 40, g.renderer.domElement.height);
        const c = a.c; const marks = aerialMarks(a.cam, a.sq, [it], 'north');
        const x = c.getContext('2d'); marks(x, 0, 0, 1, 1);
        it.crop = await save(`issues/${S.cityKey}-geo-${it.type}-${Math.round(it.x)}_${Math.round(it.z)}.jpg`, c, 'image/jpeg', 0.88);
        await sh.add(c, `${it.type} (${it.severity}) · ${it.street}`, `x ${it.x}, z ${it.z} · ${it.lat ?? ''}, ${it.lon ?? ''}`, [], null);
    }
    return list.length;
}

// ------------------------------------------------------------------ cockpit / UI at the current viewport
async function cockpitPrep(lbl, { touch = false, at = null } = {}) {
    takeOver();
    const r = [...S.routes.values()][0];
    const sm = at || (r ? r.samples[Math.min(3, r.samples.length - 1)] : { x: g.player.x, z: g.player.z, heading: g.player.heading, edge: null, y: 0.24 });
    document.body.classList.toggle('touch', !!touch);
    S.opts.pr = S.opts.cockpitPr ?? 1; setPR();
    const hud = document.querySelector('#hud'); if (hud) { hud.style.visibility = 'visible'; hud.classList.add('show'); }
    try { g.resize?.(); } catch { /* ignore */ }
    if (r && !g.nav?.dest) try { g.setNavDest?.({ x: r.spec.to.x, z: r.spec.to.z, label: r.spec.to.label }, true); } catch { /* ignore */ }
    place(sm); stepGame(); stepGame(); place(sm);
    renderMain(true); renderMain(true);
    const res = uiChecks(THREE, g);
    for (const [type, sev, msg, data] of res.issues) issue(type, sev, msg, { ...data, viewport: lbl }, { key: type + '|' + lbl + '|' + (data.el || data.a || data.part || '') + (data.b || '') });
    return { parts: res.parts, blocks: res.blocks, n: res.issues.length };
}
async function addCockpitTile(dataUrl, lbl, sub) {
    const im = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const tw = 960, th = Math.round(960 * im.height / im.width);
    // one tile per sheet, sized to the viewport's aspect
    const sh = sheet(`cockpit-${S.cityKey}-${lbl.replace(/[^\w]+/g, '-')}`, { title: `${S.cityKey} · cockpit + HUD`, cols: 1, tw, th, per: 1 });
    await sh.add(im, lbl, sub || '');
}

// ------------------------------------------------------------------ offices (lobby sign etc.)
async function offices() {
    const out = [];
    // every stop of this city (the lobby does not need the stop's building in the current district world)
    let stops = (g.stops || []).slice();
    try { const d = await import('../../../../src/data.js'); if (Array.isArray(d.STOPS)) stops = d.STOPS.filter(s => s.city === g.city.id); } catch { /* ignore */ }
    for (const stop of stops) {
        try {
            g.enterOffice(stop);
            const o = g.office; S.renderNow = true; try { o.update?.(0); o.render(); } finally { S.renderNow = false; }
            const c = grab(g.renderer.domElement.width, g.renderer.domElement.height);
            const sh = sheet(`offices-${g.city.id}`, { title: `${g.city.id} · office lobbies (entrance view + lobby sign close-up)` });
            await sh.add(c, `${stop.id} · ${stop.company || ''}`, `${stop.role || ''} · ${stop.period || ''}`);
            // close-up of the lobby sign (back wall, ~8 m away): text cut / overflowing the sign shows here
            try {
                if (o.camRig) { o.camRig.position.set(0, 1.75, -9); o.camRig.rotation.set(0.12, 0, 0); o.camRig.updateMatrixWorld(true); S.renderNow = true; try { o.render(); } finally { S.renderNow = false; } }
                await sh.add(grab(g.renderer.domElement.width, g.renderer.domElement.height), `${stop.id} · lobby sign close-up`, `${stop.company || ''}`);
            } catch (e) { note('office sign ' + stop.id + ': ' + e.message); }
            g.leaveOffice();
            out.push(stop.id);
        } catch (e) { note('office ' + stop.id + ': ' + e.message); try { if (g.state === 'office') g.leaveOffice(); } catch { /* ignore */ } }
    }
    g.state = 'drive';
    return out;
}

// ------------------------------------------------------------------ canvas text overflow (from textprobe.js)
function textIssues() {
    const T = window.__vqaText; if (!T) { issue('vqa-api', 'low', 'canvas text probe not installed', {}); return 0; }
    let n = 0;
    for (const h of T.hits.values()) {
        const squeezedOnly = h.problems.every(p => /^squeezed/.test(p));
        const sev = squeezedOnly ? 'low' : (/past the|overflows/.test(h.problems.join(' ')) && (h.onScreen || h.canvas[0] >= 128)) ? 'medium' : 'low';
        issue('canvas-text-overflow', sev, `"${h.text}" ${h.problems.join('; ')} (font ${h.font}, ${h.canvasId ? '#' + h.canvasId : h.canvas.join('×') + ' canvas'}, drawn by ${h.src})`, { text: h.text, problems: h.problems, src: h.src, canvas: h.canvas, box: h.box, n: h.count }, { key: 'txt|' + h.text + '|' + h.canvas.join('x') });
        n++;
    }
    return n;
}

async function flushSheets() {
    for (const s of S.sheets.values()) await s.flush();
    return [...S.sheets.values()].map(s => ({ name: s.name, title: s.title, files: s.files }));
}

window.vqa = {
    S, groups, loadGroup, plans, sampleRoute, runGeometry, capture, focusShots, cockpitPrep, addCockpitTile, offices, textIssues, flushSheets,
    setOpts: (o) => { Object.assign(S.opts, o); if (g.renderer) setPR(); },
    setRouteBase: (b) => { S.routeBase = b; },
    setIdBase: (b) => { S.idBase = b; },
    hideHud: (h = true) => { const el = document.querySelector('#hud'); if (el) el.style.visibility = h ? 'hidden' : 'visible'; for (const id of ['#toasts', '#bubbles']) { const t = document.querySelector(id); if (t) t.style.visibility = h ? 'hidden' : ''; } },
    issues: () => S.issues,
    counts: () => S.counts, log: () => S.log,
    info: () => ({ city: g.city?.id, district: distId(), quality: g.r3d?.stats?.quality, w: innerWidth, h: innerHeight, pr: g.renderer.getPixelRatio() }),
};
window.dispatchEvent(new Event('vqa-ready'));
