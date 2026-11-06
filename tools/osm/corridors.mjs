// ============================================================================
//  corridors.mjs — restricts a city to the corridors the story actually drives:
//  shortest (travel-time) routes on the drivable graph between the CV stops in
//  story order + a few scenic loops, buffered by a radius (bigger around stops,
//  landmarks and the historic centre). The result is a signed "margin" field on
//  a 10 m raster: margin(x, z) = min over corridor pieces of (distance − radius)
//  (negative = inside). Used by build-data.mjs to keep only what is near the
//  corridors and to push everything else into a low-poly backdrop.
// ============================================================================
import { Grid, distPointSeg } from './geom.mjs';

const CLASS_SPEED_K = { motorway: 1.0, motorway_link: 0.75, trunk: 0.95, trunk_link: 0.7, primary: 0.9, primary_link: 0.7, secondary: 0.8, secondary_link: 0.65, tertiary: 0.7, tertiary_link: 0.6, residential: 0.42, unclassified: 0.45, living_street: 0.2, service: 0.25 };

class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
        const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
        while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
        k[i] = key; v[i] = val;
    }
    pop() {
        const k = this.k, v = this.v; const top = v[0], lk = k.pop(), lv = v.pop();
        if (k.length) {
            let i = 0; const n = k.length;
            for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
            k[i] = lk; v[i] = lv;
        }
        return top;
    }
}

/**
 * @param roads  [{nodes:[osmId], cls, oneway, maxspeed, name}]
 * @param pos    Map osmId -> [x, z] (game metres)
 * @param P      projector (lat, lon) -> [x, z]
 * @param cfg    { route: [wp], loops: [[wp]], circles: [{lat, lon, r}], spurs: [{lat, lon, r}], rRoute, rStop, maxSpur }
 *               wp = { lat, lon, road?: RegExp, r?: number (buffer of the leg ending here), name? }
 */
export function buildCorridor(roads, pos, P, cfg, log = () => { }) {
    // ---------------- graph
    const adj = new Map(); // id -> [[to, cost, len]]
    const addE = (a, b, c, l) => { let x = adj.get(a); if (!x) adj.set(a, x = []); x.push([b, c, l]); };
    const und = new Map();
    const addU = (a, b, l) => { let x = und.get(a); if (!x) und.set(a, x = []); x.push([b, l]); };
    const nodeGrid = new Grid(60);
    const nodeRoads = new Map();
    for (const r of roads) {
        const v = Math.max(5, r.maxspeed / 3.6) * (CLASS_SPEED_K[r.cls] ?? 0.4);
        for (let i = 0; i < r.nodes.length - 1; i++) {
            const a = r.nodes[i], b = r.nodes[i + 1]; const pa = pos.get(a), pb = pos.get(b);
            const l = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); if (l < 0.01) continue;
            addE(a, b, l / v, l); if (!r.oneway) addE(b, a, l / v, l);
            addU(a, b, l); addU(b, a, l);
        }
        for (const n of r.nodes) {
            let s = nodeRoads.get(n); if (!s) { nodeRoads.set(n, s = []); const p = pos.get(n); nodeGrid.insertBox(p[0], p[1], p[0], p[1], n); }
            s.push(r);
        }
    }
    const snap = (wp, maxR = 900) => {
        const [x, z] = P(wp.lat, wp.lon);
        let best = null, bd = maxR;
        const want = wp.bearing != null ? [Math.sin(wp.bearing * Math.PI / 180), -Math.cos(wp.bearing * Math.PI / 180)] : null;
        const dirOk = (r, n) => { // one-way roads must run along the wanted bearing
            if (!want || !r.oneway) return true;
            const i = r.nodes.indexOf(n); const a = pos.get(r.nodes[Math.max(0, i - 1)]), b = pos.get(r.nodes[Math.min(r.nodes.length - 1, i + 1)]);
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            return (dx * want[0] + dz * want[1]) / L > 0.5;
        };
        nodeGrid.query(x, z, maxR, (n) => {
            const rs = nodeRoads.get(n);
            if (wp.road && !rs.some(r => wp.road.test(r.name) && dirOk(r, n))) return;
            if (!wp.road && want && !rs.some(r => dirOk(r, n) && r.cls !== 'service')) return;
            if (!wp.road && rs.every(r => r.cls === 'service' || (/motorway/.test(r.cls) && !wp.motorway))) return;
            if (!adj.get(n)?.length) return;
            const p = pos.get(n); const d = Math.hypot(p[0] - x, p[1] - z);
            if (d < bd) { bd = d; best = n; }
        });
        if (best == null) log('  corridor: could not snap waypoint', wp.name || '', wp.lat, wp.lon);
        return best;
    };
    const dijkstra = (src, dst, directed) => {
        const dist = new Map([[src, 0]]), prev = new Map(); const h = new Heap(); h.push(0, src);
        while (h.size) {
            const u = h.pop(); const du = dist.get(u);
            if (u === dst) break;
            const out = directed ? adj.get(u) : (und.get(u) || []).map(([b, l]) => [b, l, l]);
            if (!out) continue;
            for (const [b, c] of out) { const nd = du + c; if (nd < (dist.get(b) ?? Infinity)) { dist.set(b, nd); prev.set(b, u); h.push(nd, b); } }
        }
        if (!dist.has(dst)) return null;
        const path = [dst]; let c = dst; while (c !== src) { c = prev.get(c); path.push(c); } return path.reverse();
    };
    // ---------------- pieces: polylines with radius, circles
    const pieces = []; // {pts:[[x,z]], r}
    const routeNodes = new Set();
    const legs = [];
    const routeLeg = (A, B, r, label) => {
        const a = snap(A), b = snap(B); if (a == null || b == null) return null;
        let path = dijkstra(a, b, true); let directed = true;
        if (!path) { path = dijkstra(a, b, false); directed = false; }
        if (!path) { log('  corridor: no route', label); return null; }
        let L = 0; for (let i = 1; i < path.length; i++) { const p = pos.get(path[i - 1]), q = pos.get(path[i]); L += Math.hypot(q[0] - p[0], q[1] - p[1]); }
        const names = [];
        for (let i = 1; i < path.length; i++) { const r = nodeRoads.get(path[i]).find(q => q.name && nodeRoads.get(path[i - 1]).includes(q)); if (r && names[names.length - 1] !== r.name) names.push(r.name); }
        legs.push({ label, km: +(L / 1000).toFixed(2), directed, via: names.filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).join(' › ') });
        for (const n of path) routeNodes.add(n);
        pieces.push({ pts: path.map(n => pos.get(n)), r });
        return path;
    };
    const rRoute = cfg.rRoute ?? 300, rStop = cfg.rStop ?? 450;
    const chain = (wps, closed, tag) => {
        const list = closed ? wps.concat([wps[0]]) : wps;
        for (let i = 0; i < list.length - 1; i++) routeLeg(list[i], list[i + 1], list[i + 1].r ?? list[i].legR ?? rRoute, `${tag}: ${list[i].name || i} → ${list[i + 1].name || i + 1}`);
    };
    chain(cfg.route, false, 'route');
    for (const [k, lp] of (cfg.loops || []).entries()) chain(lp.points, !!lp.closed, lp.name || 'loop' + k);
    const circles = [];
    for (const c of cfg.circles || []) { const [x, z] = P(c.lat, c.lon); circles.push({ x, z, r: c.r ?? rStop, name: c.name }); }
    // ---------------- spurs: landmarks / stops off the corridor get a road link to it (if short)
    {
        const srcs = [...routeNodes];
        const dist = new Map(), prev = new Map(); const h = new Heap();
        for (const s of srcs) { dist.set(s, 0); h.push(0, s); }
        const maxSpur = cfg.maxSpur ?? 2500;
        while (h.size) {
            const u = h.pop(); const du = dist.get(u); if (du > maxSpur) break;
            for (const [b, l] of und.get(u) || []) { const nd = du + l; if (nd < (dist.get(b) ?? Infinity)) { dist.set(b, nd); prev.set(b, u); h.push(nd, b); } }
        }
        for (const s of cfg.spurs || []) {
            const [x, z] = P(s.lat, s.lon);
            const m = margin0(x, z);
            if (m <= -(s.r ?? rStop) * 0.5) { circles.push({ x, z, r: s.r ?? rStop, name: s.name }); continue; }
            const n = snap({ lat: s.lat, lon: s.lon, motorway: false }, 700);
            if (n == null || !dist.has(n)) { log('  corridor: spur too long / unreachable', s.name); continue; }
            const path = [n]; let c = n; while (prev.has(c)) { c = prev.get(c); path.push(c); }
            pieces.push({ pts: path.map(q => pos.get(q)), r: s.legR ?? Math.min(rRoute, 220) });
            for (const q of path) routeNodes.add(q);
            circles.push({ x, z, r: s.r ?? rStop, name: s.name });
            legs.push({ label: 'spur: ' + s.name, km: +(dist.get(n) / 1000).toFixed(2) });
        }
        function margin0(x, z) {
            let m = Infinity;
            for (const p of pieces) for (let i = 0; i < p.pts.length - 1; i++) { const a = p.pts[i], b = p.pts[i + 1]; const d = distPointSeg(x, z, a[0], a[1], b[0], b[1]).d - p.r; if (d < m) m = d; }
            for (const c of circles) m = Math.min(m, Math.hypot(x - c.x, z - c.z) - c.r);
            return m;
        }
    }
    // ---------------- raster margin field (chamfer distance transform with additive initial values)
    const CELL = 10, PAD = cfg.fieldPad ?? 2600;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pieces) for (const [x, z] of p.pts) { x0 = Math.min(x0, x - p.r); x1 = Math.max(x1, x + p.r); z0 = Math.min(z0, z - p.r); z1 = Math.max(z1, z + p.r); }
    for (const c of circles) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); z0 = Math.min(z0, c.z - c.r); z1 = Math.max(z1, c.z + c.r); }
    x0 -= PAD; z0 -= PAD; x1 += PAD; z1 += PAD;
    const W = Math.ceil((x1 - x0) / CELL) + 1, H = Math.ceil((z1 - z0) / CELL) + 1;
    const F = new Float32Array(W * H).fill(1e6);
    const seed = (x, z, v) => {
        const i = Math.round((x - x0) / CELL), j = Math.round((z - z0) / CELL);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
            const cx = x0 + ii * CELL, cz = z0 + jj * CELL; const val = v + Math.hypot(cx - x, cz - z);
            const k = jj * W + ii; if (val < F[k]) F[k] = val;
        }
    };
    for (const p of pieces) for (let i = 0; i < p.pts.length - 1; i++) {
        const a = p.pts[i], b = p.pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 5));
        for (let s = 0; s <= n; s++) seed(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n, -p.r);
    }
    for (const c of circles) seed(c.x, c.z, -c.r);
    const D1 = CELL, D2 = CELL * Math.SQRT2;
    for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const k = j * W + i; let v = F[k];
            if (i > 0) v = Math.min(v, F[k - 1] + D1);
            if (j > 0) { v = Math.min(v, F[k - W] + D1); if (i > 0) v = Math.min(v, F[k - W - 1] + D2); if (i < W - 1) v = Math.min(v, F[k - W + 1] + D2); }
            F[k] = v;
        }
        for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
            const k = j * W + i; let v = F[k];
            if (i < W - 1) v = Math.min(v, F[k + 1] + D1);
            if (j < H - 1) { v = Math.min(v, F[k + W] + D1); if (i < W - 1) v = Math.min(v, F[k + W + 1] + D2); if (i > 0) v = Math.min(v, F[k + W - 1] + D2); }
            F[k] = v;
        }
    }
    /** signed margin (m): < 0 inside the corridor */
    const margin = (x, z) => {
        const fi = (x - x0) / CELL, fj = (z - z0) / CELL;
        const i = Math.floor(fi), j = Math.floor(fj);
        if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) return 1e6;
        const tx = fi - i, tz = fj - j, k = j * W + i;
        return (F[k] * (1 - tx) + F[k + 1] * tx) * (1 - tz) + (F[k + W] * (1 - tx) + F[k + W + 1] * tx) * tz;
    };
    let inside = 0; for (let k = 0; k < F.length; k++) if (F[k] <= 0) inside++;
    const areaKm2 = inside * CELL * CELL / 1e6;
    log(`corridor: ${legs.length} legs, ${pieces.length} pieces, ${circles.length} circles, area ${areaKm2.toFixed(1)} km² (game)`);
    for (const l of legs) log(`   ${l.label}  ${l.km} km${l.directed === false ? ' (undirected!)' : ''}  ${l.via || ''}`);
    return { margin, pieces, circles, legs, routeNodes, areaKm2, field: { x0, z0, W, H, CELL } };
}
