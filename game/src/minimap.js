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
        if (world.district?.id) placesData().then((pd) => {
            const e = pd?.districts?.[`${city?.id}-${world.district.id}`]; if (!e) return;
            this.legend = pd.legend; const LG = Object.fromEntries(pd.legend.map(l => [l.cat, l]));
            for (const [cat, list] of Object.entries(e.places)) for (const p of list) this.places.push({ ...p, cat, icon: LG[cat]?.icon, color: LG[cat]?.color });
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
        // vehicles (full map only)
        if (vehicles && full) { ctx.fillStyle = 'rgba(60,60,70,0.6)'; for (const v of vehicles) { ctx.beginPath(); ctx.arc(v.x, v.z, lw(1.5), 0, 7); ctx.fill(); } }
        // ordinary POIs: small icons
        const cvPois = [];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const p of pois) {
            if (p.cv || p.interactive) { cvPois.push(p); continue; }
            if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
            if (this.places.length && (p.kind === 'fuel' || p.kind === 'metro' || p.kind === 'landmark')) continue; // drawn as places below
            const show = POI_MINI.has(p.kind) || (POI_MINI_BRAND.has(p.kind) && p.brand && !full && scale > 0.14) || (p.kind === 'landmark' && full && p.label && p.sub !== 'place_of_worship');
            if (!show) continue;
            const r = lw(full ? 4 : 5.5);
            ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 7); ctx.fillStyle = p.color || '#666'; ctx.fill();
            ctx.lineWidth = lw(1); ctx.strokeStyle = '#fff'; ctx.stroke();
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.font = `${lw(full ? 5 : 7)}px sans-serif`; ctx.fillStyle = '#fff';
            ctx.fillText(p.kind === 'metro' ? 'M' : p.kind === 'fuel' ? '⛽' : (p.icon || '•'), 0, lw(0.5));
            ctx.restore();
        }
        // reachable places (categorized icons; labels on the full map)
        for (const p of this.places) {
            if (!PLACE_DRAW[p.cat] || p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
            if (!full && (p.cat === 'business' ? scale < 0.14 : p.cat === 'park' ? scale < 0.1 : false)) continue;
            const big = p.cat === 'landmark' || p.cat === 'spot', r = lw(full ? (big ? 7 : 5) : (big ? 7 : 5.5));
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.beginPath(); if (big) { ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 1.2, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 1.2, 0); ctx.closePath(); } else ctx.arc(0, 0, r, 0, 7);
            ctx.fillStyle = p.color || '#666'; ctx.fill(); ctx.lineWidth = lw(1.2); ctx.strokeStyle = '#fff'; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = `bold ${lw(full ? (big ? 8 : 6) : 7)}px sans-serif`; ctx.fillText(p.cat === 'transit' ? (p.mode === 'tram' ? 'T' : p.mode === 'train' ? 'R' : 'M') : p.icon || '•', 0, lw(0.5));
            if (full && (p.cat !== 'business' || scale > 0.5)) {
                const label = (p.name || '').length > 28 ? p.name.slice(0, 26) + '…' : (p.name || '');
                ctx.font = `${big ? 'bold ' : ''}${lw(big ? 11 : 9)}px sans-serif`; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = lw(3);
                ctx.strokeText(label, 0, r + lw(9)); ctx.fillStyle = big ? '#3b0764' : '#222'; ctx.fillText(label, 0, r + lw(9));
            }
            ctx.restore();
        }
        // CV stops + airports
        for (const p of cvPois) {
            const isObj = objective && objective.id === p.id;
            const r = lw(isObj ? 9 : 7);
            ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 7);
            ctx.fillStyle = p.visited ? '#6b7280' : (p.color || (p.kind === 'airport' ? '#111827' : '#f97316')); ctx.fill();
            ctx.lineWidth = lw(2); ctx.strokeStyle = '#fff'; ctx.stroke();
            if (isObj) { ctx.beginPath(); ctx.arc(p.x, p.z, r + lw(4 + 3 * Math.sin(performance.now() / 200)), 0, 7); ctx.strokeStyle = p.color || '#f97316'; ctx.lineWidth = lw(2); ctx.stroke(); }
            ctx.save(); ctx.translate(p.x, p.z); if (heading !== null) ctx.rotate(-heading);
            ctx.fillStyle = '#fff'; ctx.font = `bold ${lw(9)}px sans-serif`;
            ctx.fillText(p.kind === 'airport' ? '✈' : p.visited ? '✓' : (p.icon || '•'), 0, lw(0.5));
            if (full) { ctx.fillStyle = '#111'; ctx.font = `bold ${lw(11)}px sans-serif`; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = lw(3); ctx.strokeText(p.label, 0, -lw(14)); ctx.fillText(p.label, 0, -lw(14)); }
            ctx.restore();
        }
        // player
        if (player) {
            ctx.save(); ctx.translate(player.x, player.z); ctx.rotate(-player.heading);
            ctx.beginPath(); ctx.moveTo(0, -lw(10)); ctx.lineTo(lw(7), lw(8)); ctx.lineTo(0, lw(4)); ctx.lineTo(-lw(7), lw(8)); ctx.closePath();
            ctx.fillStyle = '#e11d48'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = lw(1.5); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        // compass
        ctx.save(); ctx.translate(w - 18, 18); if (heading !== null) ctx.rotate(heading);
        ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 14);
        ctx.restore();
        if (full) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('© OpenStreetMap contributors', w - 8, h - 8); ctx.restore(); }
        if (full && this.legend) this.drawLegend(ctx, w, h);
    }
    /** map legend (full map): one row per place category + the hatched outside-the-story area */
    drawLegend(ctx, w, h) {
        const rows = this.legend.filter(l => l.cat === 'cv' || this.places.some(p => p.cat === l.cat));
        const lh = 18, pad = 8, bw = 178, bh = pad * 2 + 16 + (rows.length + 1) * lh;
        ctx.save(); ctx.translate(10, h - bh - 24);
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, bw, bh, 8) : ctx.rect(0, 0, bw, bh); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('Legend', pad, pad + 7);
        rows.forEach((l, i) => {
            const y = pad + 16 + lh * (i + 0.5) + 4;
            ctx.beginPath(); ctx.arc(pad + 8, y, 7, 0, 7); ctx.fillStyle = l.color; ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(l.icon, pad + 8, y + 0.5);
            ctx.textAlign = 'left'; ctx.fillStyle = '#222'; ctx.font = '12px sans-serif'; ctx.fillText(l.label, pad + 22, y);
        });
        const y = pad + 16 + lh * (rows.length + 0.5) + 4;
        ctx.save(); ctx.beginPath(); ctx.rect(pad + 1, y - 7, 14, 14); ctx.fillStyle = 'rgba(15,23,42,0.45)'; ctx.fill(); ctx.clip();
        ctx.strokeStyle = 'rgba(148,163,184,0.9)'; ctx.lineWidth = 2; for (let k = -14; k < 28; k += 5) { ctx.beginPath(); ctx.moveTo(pad + 1 + k, y + 7); ctx.lineTo(pad + 15 + k, y - 7); ctx.stroke(); }
        ctx.restore(); ctx.fillStyle = '#222'; ctx.font = '12px sans-serif'; ctx.fillText('Outside the story area', pad + 22, y);
        ctx.restore();
    }
}
