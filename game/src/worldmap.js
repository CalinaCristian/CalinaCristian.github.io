// ============================================================================
//  WORLD MAP HUB (note 75, explore lane) — one full-screen map, go anywhere (one mode since 2026-11-08):
//  tabs Here · București · Seattle · Bellevue · World; every district (footprint from cities.js) and tourist
//  spot (spots/index.js SPOTS) as a pin; a searchable list with thumbnails + "recent"; click a pin → destination mark → explicit Fast travel.
//  "Here": the current district (the game's MiniMap of the loaded world) or tourist spot (its OSM data) —
//  click a point to mark it and set navigation (everyone). Pan: drag · zoom: wheel / pinch / + −. Mobile: map over list.
//
//  new WorldMap(opts) · open({ tab, startMode }) · close() · isOpen · refresh()
//  opts: items() → [item], here() → here | null, current() → { key, region }, mode() → 'roam' | 'story' (roam = off the story),
//        thumb(key) → dataURL | null, recent() → [key], onGo(item), onSelect(item), onHere(x, z), destination(), onClear(), onTravel(), canTravel?(), onClose(), onConditions?(), canConditions?()
//  item: { key, kind: 'district'|'spot', id, city, region: 'bucharest'|'seattle'|'bellevue', name, sub, blurb, lat, lon, bbox?, poly?, icon, done? }
// ============================================================================
import { MiniMap, filterOn } from './minimap.js';

const REGIONS = [
    { id: 'bucharest', name: 'București', flag: '🇷🇴', tz: 'Europe/Bucharest' },
    { id: 'seattle', name: 'Seattle', flag: '🇺🇸', tz: 'America/Los_Angeles' },
    { id: 'bellevue', name: 'Bellevue', flag: '🇺🇸', tz: 'America/Los_Angeles' },
];
const OTP = { lat: 44.5711, lon: 26.0850 }, SEA = { lat: 47.4502, lon: -122.3088 };
/** schematic water (coarse outlines, real positions): enough to read the city, not a survey */
const WATER = {
    bucharest: [
        { line: [[44.4482, 26.0200], [44.4440, 26.0420], [44.4398, 26.0570], [44.4356, 26.0705], [44.4318, 26.0840], [44.4296, 26.0950], [44.4282, 26.1015], [44.4262, 26.1120], [44.4225, 26.1250], [44.4180, 26.1400]], w: 5, label: 'Dâmbovița' },
        { ell: [44.4775, 26.0870, 0.0055, 0.0130], rot: -0.35, label: 'Lacul Herăstrău' },
        { ell: [44.4369, 26.0899, 0.0010, 0.0016] },
    ],
    seattle: [
        { poly: [[47.78, -122.60], [47.78, -122.40], [47.700, -122.395], [47.672, -122.405], [47.667, -122.399], [47.657, -122.413], [47.640, -122.430], [47.626, -122.408], [47.623, -122.380], [47.618, -122.362], [47.611, -122.350], [47.604, -122.342], [47.597, -122.339], [47.590, -122.346], [47.583, -122.358], [47.580, -122.376], [47.583, -122.392], [47.578, -122.418], [47.555, -122.405], [47.520, -122.395], [47.470, -122.360], [47.40, -122.340], [47.40, -122.60]], label: 'Puget Sound', lab: [47.615, -122.43] },
        { poly: [[47.646, -122.338], [47.647, -122.330], [47.641, -122.326], [47.630, -122.330], [47.626, -122.338], [47.632, -122.344], [47.640, -122.344]], label: 'Lake Union' },
        { line: [[47.6665, -122.3990], [47.6620, -122.3800], [47.6555, -122.3600], [47.6505, -122.3470], [47.6475, -122.3390]], w: 3 },
        { line: [[47.6410, -122.3260], [47.6460, -122.3150], [47.6475, -122.3020], [47.6450, -122.2900]], w: 3 },
        { poly: [[47.76, -122.280], [47.70, -122.275], [47.66, -122.272], [47.645, -122.280], [47.625, -122.283], [47.600, -122.280], [47.585, -122.270], [47.560, -122.260], [47.520, -122.250], [47.500, -122.230], [47.505, -122.210], [47.540, -122.206], [47.585, -122.215], [47.605, -122.212], [47.612, -122.208], [47.625, -122.222], [47.650, -122.232], [47.700, -122.240], [47.76, -122.250]], label: 'Lake Washington', lab: [47.655, -122.257] },
        { poly: [[47.596, -122.243], [47.592, -122.222], [47.570, -122.212], [47.540, -122.218], [47.528, -122.230], [47.545, -122.245], [47.575, -122.248]], land: true, label: 'Mercer Island' },
    ],
};
WATER.bellevue = WATER.seattle;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hav = (a, b) => { const R = 6371, d = Math.PI / 180, dl = (b.lat - a.lat) * d, dn = (b.lon - a.lon) * d; const s = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

export class WorldMap {
    constructor(opts) {
        this.o = opts; this.tab = 'bucharest'; this.views = {}; this.sel = null; this.query = '';
        this._build();
    }
    get isOpen() { return this.el.classList.contains('show'); }
    _build() {
        const el = this.el = document.createElement('div'); el.id = 'world-map'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'World map');
        el.innerHTML = `
<div class="wm-head">
  <div class="wm-title"><span class="wm-mode"></span><b>World map</b></div>
  <nav class="wm-tabs" role="tablist"></nav>
  <div class="wm-tools"><button class="wm-cond" title="Time, weather &amp; season">☀️</button><button class="wm-x" aria-label="Close (Esc)">✕</button></div>
</div>
<div class="wm-body">
  <div class="wm-mapwrap"><canvas class="wm-canvas"></canvas>
    <div class="wm-zoom"><button data-z="1.4" aria-label="Zoom in">+</button><button data-z="0.714" aria-label="Zoom out">−</button><button data-z="fit" aria-label="Fit">⤢</button></div>
    <div class="wm-hint"></div>
    <div class="wm-card" hidden></div>
  </div>
  <aside class="wm-side">
    <input class="wm-search" type="search" placeholder="Search districts and tourist spots…" aria-label="Search" autocomplete="off">
    <div class="wm-recent"></div>
    <div class="wm-list"></div>
  </aside>
</div>`;
        document.body.appendChild(el);
        const q = (s) => el.querySelector(s);
        this.cv = q('.wm-canvas'); this.ctx = this.cv.getContext('2d'); this.card = q('.wm-card'); this.hint = q('.wm-hint');
        this.listEl = q('.wm-list'); this.recentEl = q('.wm-recent'); this.tabsEl = q('.wm-tabs'); this.searchEl = q('.wm-search'); this.modeEl = q('.wm-mode'); this.condBtn = q('.wm-cond');
        q('.wm-x').addEventListener('click', () => this.close());
        this.condBtn.addEventListener('click', () => { this.close(); this.o.onConditions?.(); });
        this.tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b && !b.disabled) this.setTab(b.dataset.tab); });
        this.searchEl.addEventListener('input', () => { this.query = this.searchEl.value.trim().toLowerCase(); this.renderList(); });
        this.searchEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = this._filtered()[0]; if (f) this.select(f, true); } e.stopPropagation(); });
        const pick = (e) => {
            if (e.target.closest('[data-clear]')) { this.o.onClear?.(); this.sel = null; this.card.hidden = true; this.renderList(); this.draw(); return; }
            if (e.target.closest('[data-travel]')) { this.o.onTravel?.(); return; }
            const g = e.target.closest('[data-go]'); if (g) { const it = this._byKey(g.dataset.go); if (it) this.go(it); return; }
            const s = e.target.closest('[data-sel]'); if (s) { const it = this._byKey(s.dataset.sel); if (it) this.select(it, true); }
        };
        this.listEl.addEventListener('click', pick); this.recentEl.addEventListener('click', pick); this.card.addEventListener('click', pick);
        q('.wm-zoom').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (!b) return; const v = this._view(); if (!v) return; if (b.dataset.z === 'fit') { delete this.views[this.tab]; } else this._zoomAt(+b.dataset.z, this.cv.clientWidth / 2, this.cv.clientHeight / 2); this.draw(); });
        // pan / pinch / click on the canvas (pointer events: mouse + touch)
        const pts = new Map(); let drag = null, pinch = null, moved = false;
        this.cv.addEventListener('pointerdown', (e) => { this.cv.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = false; const v = this._view(); if (!v) return;
            if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, v: { ...v } };
            else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; } });
        this.cv.addEventListener('pointermove', (e) => {
            if (!pts.has(e.pointerId)) { this._hover(e.offsetX, e.offsetY); return; }
            pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); const v = this._view(); if (!v) return;
            if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this._zoomAt((pinch.s * d / Math.max(10, pinch.d)) / v.s, pinch.mx, pinch.my); moved = true; this._raf(); }
            else if (drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (!moved && Math.hypot(dx, dy) < 6) return; moved = true; v.cx = drag.v.cx - dx / v.s; v.cy = drag.v.cy - dy / v.s; this._raf(); }
        });
        const up = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { if (!moved && drag) this._click(e.offsetX, e.offsetY); drag = null; } };
        this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); drag = pinch = null; });
        this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this._zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.offsetX, e.offsetY); this._raf(); }, { passive: false });
        window.addEventListener('resize', () => { if (this.isOpen) { this._size(); this.draw(); } });
    }
    _raf() { if (!this._r) this._r = requestAnimationFrame(() => { this._r = 0; this.draw(); }); }

    // ------------------------------------------------------------------ open / close / tabs
    open({ tab = null, startMode = false } = {}) {
        this.startMode = startMode;
        this.items = this.o.items() || [];
        this.hereInfo = this.o.here?.() || null;
        const cur = this.o.current?.() || {};
        this.curKey = cur.key || null;
        this.tab = tab || (this.hereInfo ? 'here' : cur.region || this.tab || 'bucharest');
        if (this.tab === 'here' && !this.hereInfo) this.tab = cur.region || 'bucharest';
        this.sel = this._byKey(this.o.destination?.()?.key) || null; this.card.hidden = true;
        this.el.classList.add('show'); document.body.classList.add('wm-open');
        this.modeEl.textContent = startMode ? '🌍 Pick a start · the story waits' : this.o.mode?.() === 'roam' ? '🗺️ Free roam' : '📖 Story';
        this.condBtn.hidden = !this.o.canConditions?.();
        this.renderTabs(); this.renderRecent(); this.renderList();
        this._size(); this.draw(); this._scrollList(); this.renderDestination();
        if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => { try { this.searchEl.focus({ preventScroll: true }); } catch { /* ignore */ } }, 30);
    }
    close() { if (!this.isOpen) return; this.el.classList.remove('show'); document.body.classList.remove('wm-open'); this.searchEl.blur(); this.o.onClose?.(); }
    refresh() { if (this.isOpen) this.open({ tab: this.tab, startMode: this.startMode }); }
    setTab(t) { this.tab = t; this.renderTabs(); this._size(); this.draw(); this._scrollList(); this.renderDestination(); }
    _scrollList() { const h = this.listEl.querySelector(`[data-region="${this.tab}"]`); if (h) this.listEl.scrollTop = h.offsetTop - this.listEl.offsetTop; else if (this.tab !== 'here') this.listEl.scrollTop = 0; }
    renderTabs() {
        const here = this.hereInfo, list = [['here', here ? `📍 Here <small>${esc(here.name || '')}</small>` : '📍 Here', !here], ...REGIONS.map((r) => [r.id, `${r.flag} ${r.name}`, false]), ['world', '🌍 World', false]];
        this.tabsEl.innerHTML = list.map(([id, lab, dis]) => `<button role="tab" data-tab="${id}"${id === this.tab ? ' class="on" aria-selected="true"' : ''}${dis ? ' disabled' : ''}>${lab}</button>`).join('');
        const touch = document.body.classList.contains('touch');
        const h = touch ? (this.tab === 'world' ? 'Tap a city' : 'Tap to mark · choose Fast travel to move · drag / pinch to explore') : { here: 'Click a place or street to mark it · hold F to fast travel · drag to pan · wheel / pinch to zoom', world: 'Pick a city' }[this.tab] || 'Click a pin to mark it · hold F to fast travel · drag to pan · wheel / pinch to zoom';
        this.hint.textContent = h;
    }
    _byKey(k) { return this.items.find((i) => i.key === k); }
    _filtered() {
        const q = this.query; if (!q) return this.items;
        const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const nq = norm(q); return this.items.filter((i) => norm(`${i.name} ${i.sub || ''} ${i.region} ${i.kind === 'district' ? 'district drive' : 'tourist spot walk'}`).includes(nq));
    }
    _thumb(it, cls = 'wm-th') {
        const u = this.o.thumb?.(it.key);
        return u ? `<span class="${cls}" style="background-image:url('${u}')"></span>` : `<span class="${cls} ph ${it.region}"><b>${esc(it.icon)}</b></span>`;
    }
    renderRecent() {
        const keys = (this.o.recent?.() || []).filter((k) => this._byKey(k)).slice(0, 6);
        this.recentEl.innerHTML = keys.length ? `<div class="wm-h">Recent</div><div class="wm-rrow">${keys.map((k) => { const it = this._byKey(k); return `<button data-sel="${esc(k)}" title="${esc(it.name)}">${this._thumb(it, 'wm-rth')}<span>${esc(it.name.split(/[:&(,]/)[0].trim())}</span></button>`; }).join('')}</div>` : '';
    }
    renderList() {
        const list = this._filtered();
        let html = '';
        for (const r of REGIONS) {
            const its = list.filter((i) => i.region === r.id); if (!its.length) continue;
            html += `<div class="wm-h" data-region="${r.id}">${r.flag} ${esc(r.name)} <small>${its.filter((i) => i.kind === 'district').length} districts · ${its.filter((i) => i.kind === 'spot').length} spots</small></div>`;
            for (const it of its) {
                const here = it.key === this.curKey;
                html += `<div class="wm-row${here ? ' here' : ''}${this.sel?.key === it.key ? ' sel' : ''}" data-sel="${esc(it.key)}">${this._thumb(it)}<span class="wm-txt"><b>${esc(it.name)}</b><small>${it.kind === 'district' ? '🚗 District · drive &amp; walk' : '🚶 Tourist spot · walk'}${it.done ? ' · ✓ postcard' : ''}${here ? ' · you are here' : ''}</small></span><button class="wm-go" data-sel="${esc(it.key)}">${here ? 'Here' : 'Mark'}</button></div>`;
            }
        }
        if (!this.query && !this.items.some((i) => i.kind === 'spot')) html += '<p class="wm-empty">Tourist spots appear here as each one passes its review.</p>';
        this.listEl.innerHTML = html || '<p class="wm-empty">Nothing matches.</p>';
    }
    select(it, center = false) {
        this.searchEl.blur(); this.sel = it;
        if (center) { if (this.tab !== it.region) { this.tab = it.region; this.renderTabs(); this._size(); } const v = this._view(); if (v) { const p = this._ll(it.lat, it.lon); v.cx = p.x; v.cy = p.y; } }
        this.o.onSelect?.(it);
        this.renderDestination(); this.renderList(); this.draw();
    }
    renderDestination() {
        const d = this.o.destination?.(), it = this.sel;
        if (!d && !it) { this.card.hidden = true; return; }
        const local = d?.kind === 'point', name = local ? d.label : it?.name || d?.label;
        const item = local ? null : it || d?.item, here = item?.key === this.curKey;
        const touch = document.body.classList.contains('touch'), travel = touch ? 'choose Fast travel' : 'hold F to fast travel';
        const note = local ? (this.hereInfo?.kind === 'spot' ? `Marked on the map. Walk there, or ${travel}.` : (this.hereInfo?.route ? `Follow the route, or ${travel}.` : 'Destination marked. No route is available from here.')) : here ? 'You are here. Pick a place on the Here tab.' : this.startMode ? 'Choose this place to start free roam.' : `Destination marked in another area. ${touch ? 'Choose Fast travel' : 'Hold F to travel'}; there is no local road route. The story waits when you travel.`;
        this.card.innerHTML = `<div class="wm-ctx"><div class="wm-ck">📍 ${here ? 'Current area' : 'Destination marked'}</div><b>${esc(name)}</b><p>${esc(note)}</p><button class="wm-go" data-clear>Clear mark</button></div>${here ? '' : this.startMode && item ? `<button class="wm-go" data-go="${esc(item.key)}">Start here</button>` : `<button class="wm-go big" data-travel${this.o.canTravel?.() === false ? ' disabled' : ''}>Fast travel${touch ? '' : '<br>F'}</button>`}`;
        this.card.hidden = false;
    }
    go(it) { if (it.key === this.curKey) return; this.close(); this.o.onGo?.(it); }

    // ------------------------------------------------------------------ views + projection
    _size() {
        const dpr = Math.min(2, devicePixelRatio || 1), w = this.cv.clientWidth || 600, h = this.cv.clientHeight || 400;
        this.dpr = dpr; this.W = w; this.H = h;
        if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) { this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); }
    }
    /** lat/lon → map units (x east, y south; km) */
    _ll(lat, lon) { const k = Math.cos((this._lat0 ?? lat) * Math.PI / 180); return { x: lon * 111.32 * k, y: -lat * 111.32 }; }
    _view() {
        const t = this.tab; if (t === 'world' || t === 'here') return this.views[t] || null;
        if (this.views[t]) { this._lat0 = this.views[t].lat0; return this.views[t]; }
        let its = this.items.filter((i) => i.region === t); if (!its.length) return null;
        // fit the core: places within 7 km of the median (an outlier such as the airport gets an edge chip instead)
        const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], mc = { lat: med(its.map((i) => i.lat)), lon: med(its.map((i) => i.lon)) };
        const core = its.filter((i) => hav(i, mc) < 7); if (core.length >= 2) its = core;
        let a0 = 90, a1 = -90, o0 = 180, o1 = -180;
        for (const i of its) { const b = i.bbox || [i.lat, i.lon, i.lat, i.lon]; a0 = Math.min(a0, b[0]); o0 = Math.min(o0, b[1]); a1 = Math.max(a1, b[2]); o1 = Math.max(o1, b[3]); }
        this._lat0 = (a0 + a1) / 2;
        const p0 = this._ll(a1, o0), p1 = this._ll(a0, o1), pad = 0.12;
        const s = Math.min(this.W / ((p1.x - p0.x) * (1 + pad * 2) || 1), this.H / ((p1.y - p0.y) * (1 + pad * 2) || 1));
        return (this.views[t] = { cx: (p0.x + p1.x) / 2, cy: (p0.y + p1.y) / 2, s: clamp(s, 20, 4000), lat0: this._lat0, fit: s });
    }
    _zoomAt(k, sx, sy) {
        const v = this._view(); if (!v) return;
        const ns = clamp(v.s * k, (v.fit || v.s) * 0.5, (v.fit || v.s) * 40); const wx = v.cx + (sx - this.W / 2) / v.s, wy = v.cy + (sy - this.H / 2) / v.s;
        v.s = ns; v.cx = wx - (sx - this.W / 2) / ns; v.cy = wy - (sy - this.H / 2) / ns;
    }
    _toScreen(v, p) { return { x: this.W / 2 + (p.x - v.cx) * v.s, y: this.H / 2 + (p.y - v.cy) * v.s }; }

    // ------------------------------------------------------------------ drawing
    draw() {
        if (!this.isOpen) return;
        const g = this.ctx; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        if (this.tab === 'here') return this._drawHere();
        if (this.tab === 'world') return this._drawWorld();
        const v = this._view(); g.fillStyle = '#0b1424'; g.fillRect(0, 0, this.W, this.H);
        if (!v) return;
        const S = (lat, lon) => this._toScreen(v, this._ll(lat, lon));
        // graticule (every 0.01°)
        g.strokeStyle = 'rgba(148,163,184,.08)'; g.lineWidth = 1;
        const tl = { lat: -(v.cy - this.H / 2 / v.s) / 111.32, lon: (v.cx - this.W / 2 / v.s) / (111.32 * Math.cos(this._lat0 * Math.PI / 180)) };
        const br = { lat: -(v.cy + this.H / 2 / v.s) / 111.32, lon: (v.cx + this.W / 2 / v.s) / (111.32 * Math.cos(this._lat0 * Math.PI / 180)) };
        const st = v.s > 900 ? 0.005 : v.s > 250 ? 0.01 : 0.05;
        for (let a = Math.ceil(br.lat / st) * st; a < tl.lat; a += st) { const p = S(a, tl.lon); g.beginPath(); g.moveTo(0, p.y); g.lineTo(this.W, p.y); g.stroke(); }
        for (let o = Math.ceil(tl.lon / st) * st; o < br.lon; o += st) { const p = S(tl.lat, o); g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, this.H); g.stroke(); }
        // water
        const labels = [];
        for (const w of WATER[this.tab] || []) {
            g.fillStyle = w.land ? '#0b1424' : '#12355a'; g.strokeStyle = '#1f5f96';
            if (w.poly) { g.beginPath(); w.poly.forEach(([a, o], i) => { const p = S(a, o); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); g.fill(); g.lineWidth = 1; g.stroke(); }
            else if (w.ell) { const [a, o, ra, ro] = w.ell, c = S(a, o), e = S(a + ra, o + ro); g.beginPath(); g.ellipse(c.x, c.y, Math.abs(e.x - c.x), Math.abs(e.y - c.y), w.rot || 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 1; g.stroke(); }
            else if (w.line) { g.beginPath(); w.line.forEach(([a, o], i) => { const p = S(a, o); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.strokeStyle = '#1f5f96'; g.lineWidth = Math.max(2, w.w * v.s / 400); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
            if (w.label) { const at = w.lab || (w.ell ? [w.ell[0], w.ell[1]] : w.line ? w.line[Math.floor(w.line.length / 2)] : w.poly[0]); labels.push([w.label, S(at[0], at[1]), w.land]); }
        }
        g.font = 'italic 12px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const [t, p, land] of labels) { g.fillStyle = land ? 'rgba(148,163,184,.55)' : 'rgba(125,180,230,.75)'; g.fillText(t, p.x, p.y); }
        // districts: footprints
        const its = this.items.filter((i) => i.region === this.tab);
        for (const it of its) if (it.kind === 'district') {
            const sel = this.sel?.key === it.key, here = it.key === this.curKey;
            g.beginPath();
            const ring = it.poly || (it.bbox ? [[it.bbox[0], it.bbox[1]], [it.bbox[0], it.bbox[3]], [it.bbox[2], it.bbox[3]], [it.bbox[2], it.bbox[1]]] : null);
            if (ring) { ring.forEach(([a, o], i) => { const p = S(a, o); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); }
            g.fillStyle = sel ? 'rgba(251,191,36,.22)' : here ? 'rgba(52,211,153,.18)' : 'rgba(96,165,250,.13)'; g.fill();
            g.setLineDash([5, 4]); g.lineWidth = sel ? 2 : 1.3; g.strokeStyle = sel ? '#fbbf24' : here ? '#34d399' : 'rgba(147,197,253,.7)'; g.stroke(); g.setLineDash([]);
        }
        // pins (spots) + district labels
        this._hits = [];
        g.textBaseline = 'middle';
        for (const it of its) {
            const p = S(it.lat, it.lon), sel = this.sel?.key === it.key, here = it.key === this.curKey;
            if (it.kind === 'district') {
                g.font = '600 13px system-ui,sans-serif'; const w = g.measureText(it.name).width + 34;
                g.fillStyle = sel ? '#fbbf24' : here ? '#059669' : 'rgba(15,23,42,.9)'; this._pill(g, p.x - w / 2, p.y - 13, w, 26, 13); g.fill();
                g.strokeStyle = sel ? '#fde68a' : 'rgba(147,197,253,.8)'; g.lineWidth = 1.2; g.stroke();
                g.fillStyle = sel ? '#111827' : '#f8fafc'; g.textAlign = 'left'; g.fillText(`${it.icon} ${it.name}`, p.x - w / 2 + 9, p.y + 1);
                this._hits.push({ it, x0: p.x - w / 2, y0: p.y - 13, x1: p.x + w / 2, y1: p.y + 13 });
            }
        }
        for (const it of its) if (it.kind === 'spot') {
            const p = S(it.lat, it.lon), sel = this.sel?.key === it.key, here = it.key === this.curKey, r = sel ? 15 : 12;
            g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fillStyle = sel ? '#fbbf24' : here ? '#059669' : '#e11d48'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
            g.font = `${sel ? 15 : 13}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(it.icon, p.x, p.y + 1);
            if (it.done) { g.beginPath(); g.arc(p.x + r * 0.75, p.y - r * 0.75, 5, 0, 7); g.fillStyle = '#22c55e'; g.fill(); }
            if (v.s > (this.views[this.tab].fit || 0) * 1.6 || sel) { g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'left'; const t = it.name.split(/[:(]/)[0].trim(); g.lineWidth = 3; g.strokeStyle = 'rgba(11,20,36,.95)'; g.strokeText(t, p.x + r + 4, p.y); g.fillStyle = '#f1f5f9'; g.fillText(t, p.x + r + 4, p.y); }
            this._hits.push({ it, x0: p.x - r - 4, y0: p.y - r - 4, x1: p.x + r + 4, y1: p.y + r + 4, spot: true });
        }
        // you are here
        const cur = this._byKey(this.curKey); if (cur && cur.region === this.tab) { const p = S(cur.lat, cur.lon), t = performance.now() / 600; g.beginPath(); g.arc(p.x, p.y, 20 + (t % 1) * 8, 0, 7); g.strokeStyle = `rgba(52,211,153,${0.8 - (t % 1) * 0.7})`; g.lineWidth = 2; g.stroke(); }
        // off-screen places: a chip on the edge pointing at them (click → centre there)
        const chips = [];
        for (const it of its) {
            const p = S(it.lat, it.lon); if (p.x > -10 && p.y > -10 && p.x < this.W + 10 && p.y < this.H + 10) continue;
            const cx0 = this.W / 2, cy0 = this.H / 2, k0 = Math.min((this.W / 2 - 70) / Math.abs(p.x - cx0 || 1e-6), (this.H / 2 - 40) / Math.abs(p.y - cy0 || 1e-6));
            const ex0 = cx0 + (p.x - cx0) * k0, ey0 = cy0 + (p.y - cy0) * k0, near = chips.find((c) => Math.abs(c.x - ex0) < 150 && Math.abs(c.y - ey0) < 30);
            if (near) { near.more++; continue; }
            chips.push({ it, p, x: ex0, y: ey0, more: 0 });
        }
        for (const ch of chips) {
            const it = ch.it, p = ch.p;
            const cx = this.W / 2, cy = this.H / 2, dx = p.x - cx, dy = p.y - cy, k = Math.min((this.W / 2 - 70) / Math.abs(dx || 1e-6), (this.H / 2 - 40) / Math.abs(dy || 1e-6));
            const ex = cx + dx * k, ey = cy + dy * k, km = hav(it, { lat: -(v.cy) / 111.32, lon: v.cx / (111.32 * Math.cos(this._lat0 * Math.PI / 180)) });
            const t = `${it.icon} ${it.name.split(/[:(&]/)[0].trim()}${ch.more ? ` +${ch.more}` : ''} · ${km.toFixed(0)} km ${Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? '↑' : '↓') : (dx < 0 ? '←' : '→')}`;
            g.font = '600 12px system-ui,sans-serif'; const w = g.measureText(t).width + 18;
            g.fillStyle = 'rgba(30,58,138,.92)'; this._pill(g, ex - w / 2, ey - 13, w, 26, 13); g.fill(); g.strokeStyle = '#93c5fd'; g.lineWidth = 1; g.stroke();
            g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(t, ex, ey + 1);
            this._hits.push({ it, x0: ex - w / 2, y0: ey - 13, x1: ex + w / 2, y1: ey + 13, edge: true });
        }
        // scale bar
        this._scaleBar(g, v.s);
        g.font = '11px system-ui,sans-serif'; g.textAlign = 'right'; g.fillStyle = 'rgba(148,163,184,.6)'; g.fillText('Schematic water · real positions (OSM / cities.js / spots)', this.W - 10, this.H - 10);
    }
    _pill(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    _scaleBar(g, s) {
        const kmPx = s; let km = 1; for (const c of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]) if (c * kmPx > 60) { km = c; break; }
        const x = 14, y = this.H - 18, w = km * kmPx;
        g.strokeStyle = '#cbd5e1'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y - 5); g.stroke();
        g.font = '11px system-ui,sans-serif'; g.textAlign = 'left'; g.fillStyle = '#cbd5e1'; g.fillText(km < 1 ? `${km * 1000} m` : `${km} km`, x + w + 6, y - 2);
    }
    _drawWorld() {
        // the shared high-fidelity globe (globe.js, round 5 — lazy: loads with the first World tab): 1:50m Natural Earth, live
        // day / night with NASA Black Marble city lights, the OTP → SEA great circle. Drag turns it, wheel / pinch / + − zoom,
        // tapping a city flies there and opens its tab. The stylised strip below shows only while it loads (or if it cannot).
        if (this._globe) {
            let v = this.views.world; if (!v || v.stub) v = this.views.world = this._globe.initialView(this.W, this.H);
            const counts = {}; for (const i of this.items) counts[i.region] = (counts[i.region] || 0) + 1;
            const here = this._byKey(this.curKey)?.region || null;
            this._hits = this._globe.draw(this.ctx, { W: this.W, H: this.H, dpr: this.dpr, view: v, counts, here, pick: (tab) => { if (this.isOpen && this.tab === 'world') this.setTab(tab); } });
            this._raf(); // animated (route flow, plane, intro / focus); stops when another tab draws or the hub closes
            return;
        }
        if (!this._globeP) this._globeP = import('./globe.js').then((m) => { this._globe = new m.WorldGlobe(); this.draw(); }).catch((e) => console.warn('[worldmap] globe', e));
        this.views.world = this.views.world || { cx: 0, cy: 0, s: 1, fit: 1, stub: true }; // lets the pin taps through until the globe is in
        const g = this.ctx, W = this.W, H = this.H; g.fillStyle = '#0b1424'; g.fillRect(0, 0, W, H);
        // a stylised strip: Seattle on the left, Bucharest on the right, the great-circle arc over Greenland between
        const A = { x: W * 0.2, y: H * 0.62 }, B = { x: W * 0.8, y: H * 0.6 }, C = { x: W * 0.5, y: H * 0.12 };
        g.strokeStyle = 'rgba(148,163,184,.1)'; g.lineWidth = 1; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, H * i / 8); g.lineTo(W, H * i / 8); g.stroke(); }
        g.setLineDash([8, 6]); g.strokeStyle = '#fbbf24'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(C.x, C.y, B.x, B.y); g.stroke(); g.setLineDash([]);
        const km = Math.round(hav(OTP, SEA) / 10) * 10;
        g.font = '600 14px system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fde68a'; g.fillText(`✈️ OTP ⇄ SEA · ${km.toLocaleString('en-US')} km great circle`, W / 2, H * 0.36 - 4);
        g.font = '12px system-ui,sans-serif'; g.fillStyle = 'rgba(226,232,240,.7)'; g.fillText('over Greenland · one layover · ~14 h door to door', W / 2, H * 0.36 + 16);
        this._hits = [];
        for (const [p, r, sub] of [[A, REGIONS[1], 'Seattle · Bellevue'], [B, REGIONS[0], 'București']]) {
            const n = this.items.filter((i) => (r.id === 'seattle' ? i.region !== 'bucharest' : i.region === 'bucharest')).length;
            g.beginPath(); g.arc(p.x, p.y, 34, 0, 7); g.fillStyle = '#1e3a8a'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#93c5fd'; g.stroke();
            g.font = '28px system-ui,sans-serif'; g.fillStyle = '#fff'; g.fillText(r.flag, p.x, p.y + 2);
            g.font = '600 15px system-ui,sans-serif'; g.fillText(sub, p.x, p.y + 56); g.font = '12px system-ui,sans-serif'; g.fillStyle = 'rgba(226,232,240,.7)'; g.fillText(`${n} place${n === 1 ? '' : 's'} · tap to open`, p.x, p.y + 75);
            this._hits.push({ tab: r.id, x0: p.x - 70, y0: p.y - 40, x1: p.x + 70, y1: p.y + 82 });
        }
    }

    // ------------------------------------------------------------------ "Here": the loaded district / spot
    _drawHere() {
        const g = this.ctx, h = this.hereInfo, W = this.W, H = this.H;
        if (!h) { g.fillStyle = '#0b1424'; g.fillRect(0, 0, W, H); return; }
        if (!this.views.here || this.views.here.key !== h.key) {
            const b = h.bounds; const fit = Math.min(W / (b.x1 - b.x0), H / (b.z1 - b.z0)) * 0.95;
            const s = Math.max(fit, h.kind === 'district' ? 0.55 : 1.2);
            this.views.here = { key: h.key, cx: s > fit * 1.01 ? h.player.x : (b.x0 + b.x1) / 2, cy: s > fit * 1.01 ? h.player.z : (b.z0 + b.z1) / 2, s, fit: fit };
        }
        const v = this.views.here;
        if (h.kind === 'district') {
            // the game's own MiniMap renderer on this canvas (device pixels)
            if (!this.mini || this.mini.world !== h.world) this.mini = new MiniMap(this.cv, h.world, h.city);
            g.setTransform(1, 0, 0, 1, 0, 0);
            this.mini.draw({ cx: v.cx, cz: v.cy, scale: v.s * this.dpr, heading: null, player: h.player, pois: h.pois, objective: null, full: true });
            g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            // the parked car
            if (h.car) { const p = this._toScreen(v, { x: h.car.x, y: h.car.z }); g.font = '18px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.beginPath(); g.arc(p.x, p.y, 13, 0, 7); g.fillStyle = '#1e3a8a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.fillText('🚗', p.x, p.y + 1); }
        } else {
            g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, W, H);
            const T = (x, z) => this._toScreen(v, { x, y: z }), d = h.data;
            const poly = (pts, fill, stroke) => { if (!pts?.length) return; g.beginPath(); pts.forEach(([x, z], i) => { const p = T(x, z); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
            for (const a of d.areas || []) {
                const water = a.natural === 'water' || a.natural === 'bay' || a.water || a.waterway, green = /park|garden|grass|meadow|forest|wood|scrub|flowerbed|pitch|playground|cemetery/.test(`${a.leisure} ${a.landuse} ${a.natural}`);
                const plaza = a.highway === 'pedestrian' || a.place === 'square' || a.area_highway;
                if (water || green || plaza) poly(a.poly, water ? '#9ec6e6' : green ? '#bcd9a2' : '#efe9dc');
            }
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (const w of d.ways || []) {
                if (!w.pts?.length || /hedge|wall|fence|tram|rail/.test(w.k)) continue;
                const foot = /footway|path|pedestrian|steps|cycleway|living_street/.test(w.k);
                g.beginPath(); w.pts.forEach(([x, z], i) => { const p = T(x, z); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
                g.strokeStyle = foot ? '#fffaf0' : '#ffffff'; g.lineWidth = Math.max(1, (foot ? 2.5 : 7) * v.s); g.stroke();
            }
            for (const b of d.buildings || []) if (!b.part) poly(b.poly, '#b9b2a6', 'rgba(90,80,70,.35)');
            for (const s of Object.values(d.spots || {})) { const e = s.extent?.polygon; if (e) { g.setLineDash([6, 4]); g.lineWidth = 1.5; poly(e, null, 'rgba(30,58,138,.6)'); g.setLineDash([]); } }
        }
        const destination = this.o.destination?.();
        if (destination?.kind === 'point' && destination.sceneKey === h.key && h.route?.points?.length) {
            g.beginPath(); h.route.points.forEach(([x, z], i) => { const p = this._toScreen(v, { x, y: z }); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
            g.strokeStyle = '#60a5fa'; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
        }
        // pins (spot entrances / district landmarks + offices handed in by explore.js)
        this._hits = [];
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const pn of h.pins || []) {
            if (pn.base && pn.cat && !filterOn(pn.cat)) continue;
            const p = this._toScreen(v, { x: pn.x, y: pn.z }); if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
            if (!pn.base) {
            g.beginPath(); g.arc(p.x, p.y, 11, 0, 7); g.fillStyle = pn.color || '#e11d48'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
            g.font = '12px system-ui,sans-serif'; g.fillStyle = '#fff'; g.fillText(pn.icon || '📍', p.x, p.y + 1);
            g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(pn.label, p.x + 15, p.y); g.fillStyle = '#0f172a'; g.fillText(pn.label, p.x + 15, p.y); g.textAlign = 'center';
            }
            this._hits.push({ pin: pn, x0: p.x - 14, y0: p.y - 14, x1: p.x + 14, y1: p.y + 14 });
        }
        // you
        { const pl = h.player, p = this._toScreen(v, { x: pl.x, y: pl.z }); g.save(); g.translate(p.x, p.y); g.rotate(-(pl.heading || 0)); g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fillStyle = '#2563eb'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.restore(); }
        this._scaleBar(g, v.s * 1000);
        if (destination?.kind === 'point' && destination.sceneKey === h.key) { const p = this._toScreen(v, { x: destination.x, y: destination.z }); g.beginPath(); g.arc(p.x, p.y, 9, 0, 7); g.strokeStyle = '#f59e0b'; g.lineWidth = 3; g.stroke(); }
    }

    // ------------------------------------------------------------------ hit testing
    _hit(x, y) { for (let i = (this._hits || []).length - 1; i >= 0; i--) { const h = this._hits[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h; } return null; }
    _hover(x, y) { this.cv.style.cursor = this._hit(x, y) || this.tab === 'here' ? 'pointer' : 'grab'; }
    _click(x, y) {
        this.searchEl.blur();
        const h = this._hit(x, y);
        if (this.tab === 'world') { if (h?.tab) { if (h.go) h.go(); else this.setTab(h.tab); } return; } // globe: fly to the city, then its tab
        if (this.tab === 'here') {
            const v = this.views.here; let wx, wz;
            if (h?.pin) { wx = h.pin.x; wz = h.pin.z; } else { wx = v.cx + (x - this.W / 2) / v.s; wz = v.cy + (y - this.H / 2) / v.s; }
            this.o.onHere?.(wx, wz, h?.pin || null);
            this.hereInfo = this.o.here?.() || this.hereInfo;
            this.sel = null; this.renderDestination(); this.renderList(); this.draw();
            return;
        }
        if (h?.it) this.select(h.it, !!h.edge); else { this.sel = null; this.renderDestination(); this.renderList(); this.draw(); }
    }
}
export { REGIONS };
