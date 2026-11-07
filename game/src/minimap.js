/**
 * 2D map renderer used for the mini-map (bottom-left) and the full map overlay (M).
 * Draws the OSM road graph (only the part in view), water / park / landuse polygons,
 * place names, landmarks, POI icons and the CV stops.
 */
const ROAD_STYLE = {
    motorway: ['#e8913a', '#f3b55a'], motorway_link: ['#e8913a', '#f3c27a'], trunk: ['#d9a046', '#f6cf7c'], trunk_link: ['#d9a046', '#f6d48f'],
    primary: ['#c9a85c', '#fde6a4'], primary_link: ['#c9a85c', '#fde6a4'], secondary: ['#b9ad84', '#fff4c7'], secondary_link: ['#b9ad84', '#fff4c7'],
    tertiary: ['#a8a294', '#ffffff'], tertiary_link: ['#a8a294', '#ffffff'],
};
const MINOR = ['#b9b3a6', '#ffffff'];
const AREA_FILL = {
    water: '#9ec6e6', park: '#bcd9a2', grass: '#cfe3b5', forest: '#a8cc8c', scrub: '#c8d6a6', pitch: '#aedb9a', cemetery: '#c4d4b4',
    industrial: '#e0dad6', commercial: '#ecdcd8', retail: '#efd8d8', railway: '#e2ddd8', parking: '#e4e2de', apron: '#dadada', runway: '#c4c4c8',
};
const POI_MINI = new Set(['fuel', 'metro', 'airport', 'hospital']);
const POI_MINI_BRAND = new Set(['food', 'shop', 'bank', 'pharmacy']);
// reachable places per district (tools/osm/places.mjs → game/data/places.json, round 5 notes 9/18): fetched once
let PLACES = null;
const placesData = () => PLACES || (PLACES = fetch(new URL('../data/places.json', import.meta.url).href).then(r => (r.ok ? r.json() : null)).catch(() => null));
const PLACE_DRAW = { landmark: 1, spot: 1, fuel: 1, transit: 1, park: 1, business: 1 }; // cv stops are drawn from world.pois (doors)
// full-map category filter (the legend rows toggle it; kept for the session): shops / transit / parks off by default (owner note 81)
// shared map filter (big map pins, its legend and the M-map nav list): `game.mapFilter` = this object, saved as localStorage `dmcv.map.filter`;
// keys cv / landmark / spot / fuel / shop / park / transit (places.json's `business` category is the `shop` key); a toggle fires window `dmcv:mapfilter`
export const MAP_FILTER_DEFAULT = { cv: true, landmark: true, spot: true, fuel: true, shop: false, park: false, transit: false };
export const MAP_FILTER = (() => { const f = { ...MAP_FILTER_DEFAULT }; try { const v = JSON.parse(localStorage.getItem('dmcv.map.filter') || 'null'); if (v && typeof v === 'object') for (const k in f) if (typeof v[k] === 'boolean') f[k] = v[k]; } catch { /* no storage */ } return f; })();
const fkey = (cat) => (cat === 'business' ? 'shop' : cat);
const mapFilter = () => { const g = globalThis.game; if (g && !g.mapFilter) g.mapFilter = MAP_FILTER; return g?.mapFilter || MAP_FILTER; };
export const filterOn = (cat) => mapFilter()[fkey(cat)] !== false;
export function setMapFilter(cat, on) {
    const f = mapFilter(); f[fkey(cat)] = !!on;
    try { localStorage.setItem('dmcv.map.filter', JSON.stringify(f)); } catch { /* no storage */ }
    try { globalThis.dispatchEvent?.(new CustomEvent('dmcv:mapfilter', { detail: { ...f } })); } catch { /* old browsers */ }
}
let LEGEND_OPEN = true;
const SHOP_ZOOM = 0.6; // css px per metre: shops (when toggled on) appear as small dots only from this zoom; icons + names from 2×
// one size hierarchy for icons (radius) and labels (font px, weight, colour); label priority = order of PRI
const PRI = ['cv', 'landmark', 'spot', 'fuel', 'transit', 'park', 'business'];
const MARK = {
    cv: { r: 8, f: 13, w: 700, c: '#111827' }, landmark: { r: 7, f: 12, w: 600, c: '#3b0764' }, spot: { r: 6, f: 11, w: 600, c: '#134e4a' },
    fuel: { r: 6, f: 10.5, w: 500, c: '#78350f' }, transit: { r: 6, f: 10, w: 500, c: '#1e3a8a' }, park: { r: 4.5, f: 10, w: 400, c: '#14532d' },
    business: { r: 2.6, f: 9.5, w: 400, c: '#4a044e' },
};
// transit: one marker per station (entrances / platforms / "Piața Unirii 1" + "2" merged)
const stationKey = (n) => String(n || '').toLowerCase().replace(/\b(metro|station|statia|stația|stop|halt|light rail)\b/g, '').replace(/\s+\d+$/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const rank = (t) => ({ motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, motorway_link: 4, trunk_link: 4, primary_link: 3, secondary_link: 2, tertiary_link: 1 }[t] || 0);

export class MiniMap {
    constructor(canvas, world, city) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d');
        this.world = world; this.city = city;
        // polygons worth drawing on the map (residential landuse would just add noise)
        this.polys = (world.areas || []).filter(a => AREA_FILL[a.kind]).sort((a, b) => (a.kind === 'water') - (b.kind === 'water'));
        this.districts = (world.districts || []).map(d => ({ name: d.name, x: d.x, z: d.z, rank: d.rank }));
        // landmarks listed for the map: reachable ones only; `scenery` landmarks are background (no marker / label / route)
        const dcfg = city?.districts?.[world.district?.id] || null;
        this.scenery = new Set(dcfg?.scenery || []);
        this.landmarks = (world.landmarks || []).filter(l => !this.scenery.has(l.id)).map(l => ({ id: l.id, label: l.label, x: l.x, z: l.z }));
        this.places = []; this.legend = null; // [{cat, name, x, z, …}] once places.json is in
        // this map draws the outside-the-story-area dim itself (under its icons / legend), so a host overlay should be skipped
        this.drawsOutside = true; this.onChange = null; // onChange(): the host redraws after a legend click (filters / collapse)
        if (!canvas.__mmLegend) { // legend clicks never reach the host's map-click handler (waypoint)
            canvas.__mmLegend = true;
            canvas.addEventListener('click', (ev) => {
                const mm = canvas.__mm; if (!mm?._legendL) return;
                const r = canvas.getBoundingClientRect(); if (!r.width) return;
                if (mm.legendHit((ev.clientX - r.left) * (canvas.width / r.width), (ev.clientY - r.top) * (canvas.height / r.height))) {
                    ev.stopImmediatePropagation(); ev.preventDefault();
                    if (mm.onChange) mm.onChange(); else globalThis.game?.redrawMap?.();
                }
            }, { capture: true });
        }
        canvas.__mm = this;
        if (world.district?.id) placesData().then((pd) => {
            const e = pd?.districts?.[`${city?.id}-${world.district.id}`]; if (!e) return;
            this.legend = pd.legend; const LG = Object.fromEntries(pd.legend.map(l => [l.cat, l]));
            const mine = []; this.modes = new Map();
            for (const [cat, list] of Object.entries(e.places)) for (const p of list) { mine.push({ ...p, cat, icon: LG[cat]?.icon, color: LG[cat]?.color }); if (p.mode) this.modes.set(p.name, p.mode); }
            if (!this.places.length) this.places = mine; // (main.js may already have handed over its own copy of the same list)
            // landmarks: the reachable list comes from the data (same filter as the build)
            const ok = new Set((e.places.landmark || []).map(p => p.id));
            this.landmarks = (world.landmarks || []).filter(l => ok.has(l.id)).map(l => ({ id: l.id, label: l.label, x: l.x, z: l.z }));
        });
        // one label per named major street, at its longest segment
        const best = new Map();
        for (const e of (world.allEdges || world.graph.edges)) {
            if (!e.name || rank(e.type) < 3 || /_link/.test(e.type)) continue;
            const key = e.name.split(' — ')[0];
            const cur = best.get(key);
            if (!cur || e.len > cur.len) best.set(key, e);
        }
        this.labels = [...best.values()].filter(e => e.len > 60);
        // edges sorted so bigger roads draw on top
        this.edgesSorted = (world.allEdges || world.graph.edges).slice().sort((a, b) => rank(a.type) - rank(b.type));
    }
    _edgesInView(x0, z0, x1, z1, full) {
        if (full || !this.world.edgesInBox) return this.edgesSorted;
        const out = [];
        this.world.edgesInBox(x0, z0, x1, z1, (e) => out.push(e));
        out.sort((a, b) => rank(a.type) - rank(b.type));
        return out;
    }
    /** draw centered on (cx,cz) with `scale` px per metre. heading rotates the map if provided (null = north up). */
    draw({ cx, cz, scale, heading = null, player, pois, objective, full = false, vehicles = null }) {
        const c = this.canvas, ctx = this.ctx, w = c.width, h = c.height;
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = full ? '#ece8de' : 'rgba(236,232,222,0.94)';
        ctx.fillRect(0, 0, w, h);
        ctx.translate(w / 2, h / 2);
        if (heading !== null) ctx.rotate(heading);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cz);
        const lw = (px) => px / scale;
        const R = Math.hypot(w, h) / 2 / scale;
        const x0 = cx - R, x1 = cx + R, z0 = cz - R, z1 = cz + R;
        // areas
        for (const p of this.polys) {
            if (p.x1 < x0 || p.x0 > x1 || p.z1 < z0 || p.z0 > z1) continue;
            if (!full && p.kind !== 'water' && (p.x1 - p.x0) * scale < 2) continue;
            ctx.beginPath();
            for (const ring of p.rings) { ring.forEach(([x, z], i) => i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)); ctx.closePath(); }
            ctx.fillStyle = AREA_FILL[p.kind]; ctx.fill('evenodd');
        }
        // roads (casing pass then fill pass, batched per style)
        const edges = this._edgesInView(x0, z0, x1, z1, full);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const minW = lw(full ? 0.8 : 1.4);
        for (const pass of [0, 1]) {
            let curStyle = null, curW = -1;
            const flush = () => { if (curStyle) ctx.stroke(); };
            for (const e of edges) {
                const st = ROAD_STYLE[e.type] || MINOR;
                const width = Math.max(minW, (e.wR + e.wL)) + (pass === 0 ? lw(1.6) : 0);
                const col = st[pass];
                if (col !== curStyle || Math.abs(width - curW) > lw(0.3)) { flush(); ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = width; curStyle = col; curW = width; }
                ctx.moveTo(e.a.x, e.a.z); ctx.lineTo(e.b.x, e.b.z);
            }
            flush();
        }
        // tram lines
        if (this.world.trams && (full || scale > 0.1)) {
            ctx.beginPath();
            for (const pl of this.world.trams) {
                let inView = false; for (const [x, z] of pl) if (x > x0 && x < x1 && z > z0 && z < z1) { inView = true; break; }
                if (!inView && !full) continue;
                pl.forEach(([x, z], i) => i ? ctx.lineTo(x, z) : ctx.moveTo(x, z));
            }
            ctx.strokeStyle = 'rgba(192,57,43,0.75)'; ctx.lineWidth = lw(1.1); ctx.setLineDash([lw(5), lw(3)]); ctx.stroke(); ctx.setLineDash([]);
        }
        // street names + districts + landmarks (full map only)
        if (full) {
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `${lw(10)}px sans-serif`; ctx.fillStyle = '#4b4639';
            for (const e of this.labels) {
                const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
                let ang = Math.atan2(e.dirz, e.dirx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
                const label = e.name.length > 34 ? e.name.slice(0, 32) + '…' : e.name;
                if (ctx.measureText(label).width > e.len * 2.2) continue;
                ctx.save(); ctx.translate(mx, mz); ctx.rotate(ang);
                ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw(3); ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
                ctx.restore();
            }
            for (const d of this.districts) {
                if (d.rank > 2) continue;
                ctx.font = `bold ${lw(d.rank <= 1 ? 13 : 11)}px sans-serif`; ctx.fillStyle = 'rgba(43,42,38,0.75)';
                ctx.fillText(d.name.toUpperCase(), d.x, d.z);
            }
            ctx.font = `${lw(10)}px sans-serif`;
            if (!this.places.length) for (const l of this.landmarks) { ctx.beginPath(); ctx.arc(l.x, l.z, lw(3), 0, 7); ctx.fillStyle = '#6b655a'; ctx.fill(); ctx.fillText(l.label, l.x, l.z + lw(12)); }
        } else if (scale > 0.12) {
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (const d of this.districts) {
                if (d.x < x0 || d.x > x1 || d.z < z0 || d.z > z1 || d.rank > 2) continue;
                ctx.save(); ctx.translate(d.x, d.z); if (heading !== null) ctx.rotate(-heading);
                ctx.font = `bold ${lw(9)}px sans-serif`; ctx.fillStyle = 'rgba(60,56,48,0.6)'; ctx.fillText(d.name, 0, 0); ctx.restore();
            }
        }
        // outside the story area: one calm flat dim + desaturate (owner note 81; replaces the diagonal hatch), under every marker
        this._drawOutside(ctx, x0, z0, x1, z1);
        // vehicles (full map only)
        if (vehicles && full) { ctx.fillStyle = 'rgba(60,60,70,0.6)'; for (const v of vehicles) { ctx.beginPath(); ctx.arc(v.x, v.z, lw(1.5), 0, 7); ctx.fill(); } }
        // sizes below are css px (the big map's canvas is devicePixelRatio-scaled); zoom = css px per metre
        const u = full ? ((c.clientWidth && c.width / c.clientWidth) || globalThis.devicePixelRatio || 1) : 1;
        const px = (v) => lw(v * u), zoom = scale / u; if (full) this._zoom = zoom;
        const haveP = this.places.length > 0, labels = [];
        const want = (cat) => (full ? filterOn(cat) : cat === 'fuel'); // the minimap: CV stops + the objective + fuel only
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // world POIs: CV stops / airport (story) always; the plain icon set only while places.json is missing
        const cvPois = [];
        for (const p of pois) {
            if (p.cv || p.interactive) { cvPois.push(p); continue; }
            if (haveP || p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
            const cat = p.kind === 'fuel' ? 'fuel' : p.kind === 'metro' ? 'transit' : null;
            if (!cat || !want(cat)) continue;
            const r = px(MARK[cat].r);
            ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 7); ctx.fillStyle = p.color || '#666'; ctx.fill();
            ctx.lineWidth = px(1.2); ctx.strokeStyle = '#fff'; ctx.stroke();
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.font = `bold ${px(6.5)}px sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(cat === 'transit' ? 'M' : '⛽', 0, px(0.5));
            ctx.restore();
        }
        // reachable places (categorized), filtered by the legend toggles on the big map
        for (const p of this._drawList()) {
            if (!PLACE_DRAW[p.cat] || !want(p.cat) || p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
            if (p.cat === 'landmark' && cvPois.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 90)) continue; // the CV stop's own building: one marker
            const m = MARK[p.cat] || MARK.business;
            if (p.cat === 'business') { // shops: small dots when zoomed in, a name only when close
                if (zoom < SHOP_ZOOM) continue;
                const near = zoom >= SHOP_ZOOM * 2, r = px(near ? 4 : m.r);
                ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 7); ctx.fillStyle = p.color || '#db2777'; ctx.fill();
                ctx.lineWidth = px(0.8); ctx.strokeStyle = '#fff'; ctx.stroke();
                if (near && p.name) labels.push({ cat: p.cat, x: p.x, z: p.z, r, text: p.name });
                continue;
            }
            const dia = p.cat === 'landmark' || p.cat === 'spot', r = px(m.r);
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.beginPath(); if (dia) { ctx.moveTo(0, -r * 1.25); ctx.lineTo(r * 1.25, 0); ctx.lineTo(0, r * 1.25); ctx.lineTo(-r * 1.25, 0); ctx.closePath(); } else ctx.arc(0, 0, r, 0, 7);
            ctx.fillStyle = p.color || '#666'; ctx.fill(); ctx.lineWidth = px(1.3); ctx.strokeStyle = '#fff'; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = `bold ${px(dia ? 7.5 : 6.5)}px sans-serif`; ctx.fillText(p.glyph || p.icon || '•', 0, px(0.5));
            ctx.restore();
            if (full && p.name) labels.push({ cat: p.cat, x: p.x, z: p.z, r: r * (dia ? 1.25 : 1), text: p.name });
        }
        // CV stops + airports (the objective is always shown, even with the CV row toggled off)
        for (const p of cvPois) {
            const isObj = objective && objective.id === p.id;
            if (full && !filterOn('cv') && !isObj && p.kind !== 'airport') continue;
            const r = px(isObj ? 10 : MARK.cv.r);
            ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 7);
            ctx.fillStyle = p.visited ? '#6b7280' : (p.color || (p.kind === 'airport' ? '#111827' : '#f97316')); ctx.fill();
            ctx.lineWidth = px(2); ctx.strokeStyle = '#fff'; ctx.stroke();
            if (isObj) { ctx.beginPath(); ctx.arc(p.x, p.z, r + px(4 + 3 * Math.sin(performance.now() / 200)), 0, 7); ctx.strokeStyle = p.color || '#f97316'; ctx.lineWidth = px(2); ctx.stroke(); }
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.fillStyle = '#fff'; ctx.font = `bold ${px(9)}px sans-serif`;
            ctx.fillText(p.kind === 'airport' ? '✈' : p.visited ? '✓' : (p.icon || '•'), 0, px(0.5));
            ctx.restore();
            if (full && p.label) labels.push({ cat: 'cv', x: p.x, z: p.z, r, text: p.label });
        }
        // labels (big map): priority CV stop > landmark > spot > fuel > transit > park > shops; one size per rank, white halo;
        // first free slot of below / above / right / left / diagonals, never over an icon, another label or the legend
        if (full && labels.length) {
            const boxes = []; const hit = (b) => boxes.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.z0 < o.z1 && b.z1 > o.z0);
            for (const l of labels) boxes.push({ x0: l.x - l.r, x1: l.x + l.r, z0: l.z - l.r, z1: l.z + l.r });
            const L = this.legend && this._legendLayout(w, h, u);
            if (L && heading === null) boxes.push({ x0: cx + (L.x - w / 2) / scale, x1: cx + (L.x + L.bw - w / 2) / scale, z0: cz + (L.y - h / 2) / scale, z1: cz + (L.y + L.bh - h / 2) / scale });
            labels.sort((a, b) => PRI.indexOf(a.cat) - PRI.indexOf(b.cat));
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = px(3.2); ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            for (const l of labels) {
                const m = MARK[l.cat] || MARK.business, max = l.cat === 'cv' ? 40 : 26, text = l.text.length > max ? l.text.slice(0, max - 2) + '…' : l.text;
                ctx.font = `${m.w} ${px(m.f)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
                const tw = ctx.measureText(text).width, th = px(m.f + 2), gap = l.r + px(2.5);
                const slots = [[0, gap + th / 2], [0, -gap - th / 2], [gap + tw / 2, 0], [-gap - tw / 2, 0], [gap + tw / 2, gap + th / 2], [-gap - tw / 2, gap + th / 2], [gap + tw / 2, -gap - th / 2], [-gap - tw / 2, -gap - th / 2]];
                for (const [dx, dz] of slots) {
                    const b = { x0: l.x + dx - tw / 2, x1: l.x + dx + tw / 2, z0: l.z + dz - th / 2, z1: l.z + dz + th / 2 };
                    if (hit(b)) continue;
                    boxes.push(b); ctx.strokeText(text, l.x + dx, l.z + dz); ctx.fillStyle = m.c; ctx.fillText(text, l.x + dx, l.z + dz);
                    break;
                }
            }
        }
        // player
        if (player) {
            ctx.save(); ctx.translate(player.x, player.z); ctx.rotate(-player.heading);
            ctx.beginPath(); ctx.moveTo(0, -px(10)); ctx.lineTo(px(7), px(8)); ctx.lineTo(0, px(4)); ctx.lineTo(-px(7), px(8)); ctx.closePath();
            ctx.fillStyle = '#e11d48'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = px(1.5); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        // compass
        ctx.save(); ctx.translate(w - 18 * u, 18 * u); ctx.scale(u, u); if (heading !== null) ctx.rotate(heading);
        ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 14);
        ctx.restore();
        if (full) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${11 * u}px sans-serif`; ctx.textAlign = 'right'; ctx.fillText('© OpenStreetMap contributors', w - 8 * u, h - 8 * u); ctx.restore(); }
        this._legendL = null;
        if (full && this.legend) this.drawLegend(ctx, w, h, u);
    }
    /** places to draw: transit stops merged to one marker per station (same name ±250 m), with a mode glyph */
    _drawList() {
        if (this._dl && this._dlSrc === this.places && this._dlN === this.places.length) return this._dl;
        const out = [], st = [];
        for (const p of this.places) {
            if (p.cat !== 'transit') { out.push(p); continue; }
            const k = stationKey(p.name), mode = p.mode || this.modes?.get(p.name) || 'metro';
            const g = st.find(s => s.k === k && Math.hypot(s.x - p.x, s.z - p.z) < 250);
            if (g) { g.n++; g.x += (p.x - g.x) / g.n; g.z += (p.z - g.z) / g.n; g.modes.add(mode); continue; }
            st.push({ ...p, k, n: 1, modes: new Set([mode]), name: String(p.name || '').replace(/\s+\d+$/, '') });
        }
        for (const s of st) { s.glyph = s.modes.has('metro') ? 'M' : s.modes.has('train') ? 'R' : 'T'; out.push(s); }
        this._dlSrc = this.places; this._dlN = this.places.length;
        return (this._dl = out);
    }
    /** flat dim (≈50 % slate) + desaturation outside world.district.inside(), from a 10 m mask sampled once per world */
    _drawOutside(ctx, x0, z0, x1, z1) {
        const W = this.world, inside = W?.district?.inside, b = W?.bounds; if (!inside || !b) return;
        if (!this._out) {
            const cell = 10, pad = 200, ox = b.minX - pad, oz = b.minZ - pad, w = Math.ceil((b.maxX - b.minX + 2 * pad) / cell), h = Math.ceil((b.maxZ - b.minZ + 2 * pad) / cell);
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), img = g.createImageData(w, h);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
                if (inside(ox + (i + 0.5) * cell, oz + (j + 0.5) * cell)) continue;
                const k = (j * w + i) * 4; img.data[k] = 30; img.data[k + 1] = 36; img.data[k + 2] = 48; img.data[k + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            const soft = document.createElement('canvas'); soft.width = w; soft.height = h; // soften the 20 m mask steps once (≈15 m feather)
            const g2 = soft.getContext('2d'); g2.filter = 'blur(1.5px)'; g2.drawImage(cv, 0, 0);
            this._out = { cv: g2.filter === 'blur(1.5px)' ? soft : cv, ox, oz, w: w * cell, h: h * cell };
        }
        const o = this._out;
        const rest = () => { ctx.beginPath(); ctx.rect(x0, z0, x1 - x0, z1 - z0); ctx.rect(o.ox, o.oz, o.w, o.h); ctx.fill('evenodd'); }; // beyond the mask
        ctx.save(); ctx.imageSmoothingEnabled = true; ctx.fillStyle = 'rgb(30,36,48)';
        ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.8; ctx.drawImage(o.cv, o.ox, o.oz, o.w, o.h); rest();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5; ctx.drawImage(o.cv, o.ox, o.oz, o.w, o.h); rest();
        ctx.restore();
    }
    /** legend geometry (canvas px): bottom-left, compact; collapsed it is a single "Map key" pill */
    _legendLayout(w, h, u) {
        const have = new Set(this._drawList().map(p => p.cat)); have.add('cv');
        const rows = PRI.map(cat => this.legend.find(l => l.cat === cat)).filter(l => l && have.has(l.cat));
        const lh = 17 * u, pad = 7 * u, head = 20 * u, open = LEGEND_OPEN;
        const bw = (open ? 168 : 86) * u, bh = open ? head + (rows.length + 1) * lh + pad : head + 2 * u;
        return { x: 10 * u, y: h - bh - 10 * u, bw, bh, rows, lh, pad, head, open, u };
    }
    /** map legend (full map): opaque panel; each row toggles its category (shops / transit / parks off by default); the header collapses it */
    drawLegend(ctx, w, h, u = 1) {
        const L = this._legendL = this._legendLayout(w, h, u), { pad, lh } = L;
        ctx.save(); ctx.translate(L.x, L.y);
        ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 6 * u; ctx.shadowOffsetY = 1 * u;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, L.bw, L.bh, 8 * u) : ctx.rect(0, 0, L.bw, L.bh); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(15,23,42,0.18)'; ctx.lineWidth = u; ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#111827'; ctx.font = `600 ${12 * u}px system-ui, sans-serif`;
        ctx.fillText(`Map key ${L.open ? '▾' : '▸'}`, pad + 2 * u, L.head / 2 + 1 * u);
        if (L.open) {
            L.rows.forEach((l, i) => {
                const y = L.head + lh * (i + 0.5), on = filterOn(l.cat), x = pad + 8 * u;
                ctx.beginPath(); ctx.arc(x, y, 6.5 * u, 0, 7);
                if (on) { ctx.fillStyle = l.color; ctx.fill(); } else { ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
                if (on) { ctx.fillStyle = '#fff'; ctx.font = `bold ${7 * u}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(l.cat === 'transit' ? 'M' : l.icon, x, y + 0.5 * u); }
                ctx.textAlign = 'left'; ctx.fillStyle = on ? '#1f2937' : '#9ca3af'; ctx.font = `${11.5 * u}px system-ui, sans-serif`;
                const hint = on && l.cat === 'business' && this._zoom != null && this._zoom < SHOP_ZOOM ? ' (zoom in)' : '';
                ctx.fillText(l.label + hint, pad + 20 * u, y);
                // checkbox at the right: the row is a toggle
                const bx = L.bw - pad - 11 * u; ctx.strokeStyle = on ? '#2563eb' : '#9ca3af'; ctx.lineWidth = 1.3 * u;
                ctx.strokeRect(bx, y - 5 * u, 10 * u, 10 * u);
                if (on) { ctx.fillStyle = '#2563eb'; ctx.fillRect(bx, y - 5 * u, 10 * u, 10 * u); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(bx + 2 * u, y); ctx.lineTo(bx + 4.3 * u, y + 2.5 * u); ctx.lineTo(bx + 8 * u, y - 2.6 * u); ctx.stroke(); }
            });
            const y = L.head + lh * (L.rows.length + 0.5);
            ctx.fillStyle = 'rgb(30,36,48)'; ctx.globalAlpha = 0.5; ctx.fillRect(pad + 1.5 * u, y - 6 * u, 13 * u, 12 * u); ctx.globalAlpha = 1;
            ctx.fillStyle = '#4b5563'; ctx.font = `${11.5 * u}px system-ui, sans-serif`; ctx.fillText('Outside the story area', pad + 20 * u, y);
        }
        ctx.restore();
    }
    /** a click at canvas px (px, py): true when it hit the legend (header → collapse / expand, row → toggle that category) */
    legendHit(px, py) {
        const L = this._legendL; if (!L) return false;
        if (px < L.x || px > L.x + L.bw || py < L.y || py > L.y + L.bh) return false;
        const y = py - L.y;
        if (y < L.head) { LEGEND_OPEN = !LEGEND_OPEN; return true; }
        const i = Math.floor((y - L.head) / L.lh), row = L.rows[i];
        if (row) setMapFilter(row.cat, !filterOn(row.cat));
        return true;
    }
}
