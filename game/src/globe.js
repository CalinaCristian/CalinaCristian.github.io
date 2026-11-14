// ============================================================================
//  GLOBE (round 5, globe lane — owner note 83): one shared, high-fidelity world view for the world-map hub's
//  World tab (worldmap.js `_drawWorld`) and the OTP → SEA flight cut-scene (flight.js `playFlight`).
//
//  Canvas 2D, orthographic, drawn in device pixels:
//    · Natural Earth 1:50m land (Caspian as a hole), big lakes, glaciers / ice caps and land borders
//      (game/data/geo/ne50m.bin, 157 KB, lazy) — the 1:110m set in game/data/geo/ne110.js draws until it arrives;
//    · proper horizon clipping (rings cut at the limb and closed along it), screen-space decimation (≈1 px);
//    · ocean depth gradient + coastal shelf glow + sun glint, graticule, soft atmosphere rim;
//    · day / night from the real sun position (low-precision solar ephemeris) with twilight, and NASA Black Marble
//      2016 city lights (game/data/geo/lights.jpg, 113 KB, lazy) on the night side — a per-pixel shading layer;
//    · the great-circle route as a glowing animated line with a plane, city markers + labels.
//  Imported dynamically (only when the World tab or the flight opens): no cost for district loads.
//
//  API
//    loadGlobeData() → Promise (idempotent; 1:50m vectors + lights; failures fall back to 1:110m / no lights)
//    new Globe().render(ctx, { lon0, lat0, R, cx, cy, dpr, date, W, H, cache?, step? }) → proj
//      proj: { P(lon, lat) → [x, y, z] (device px; z > 0 = facing the viewer), lon0, lat0, R, cx, cy, e1, e2, e3, sun }
//    drawSpace(ctx, W, H, cx, cy, R, dpr) · drawRoute(ctx, proj, route, opts) · drawCity(ctx, proj, city, opts)
//    drawPlane(ctx, x, y, ang, s) · routePoints(a, b, n) · sunLL(date) · slerpLL(a, b, t) · gcKm(a, b)
//    flightScene(ctx, o) — the flight's globe frame (space, globe, route flown so far, airports, plane)
//    new WorldGlobe() — the World-tab controller: draw(g, { W, H, dpr, view, counts, here, pick }) → hits
// ============================================================================
import { NE_LAND, NE_BORDERS } from '../data/geo/ne110.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FONT = (w, s) => `${w} ${Math.round(s)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
export const toV = (lon, lat) => { const p = lat * D2R, l = lon * D2R, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; };
export const toLL = (v) => [Math.atan2(v[1], v[0]) / D2R, Math.asin(clamp(v[2], -1, 1)) / D2R];
const lonOf = (a) => a.lon ?? a[0], latOf = (a) => a.lat ?? a[1];
/** point at fraction t of the great circle a → b ([lon, lat]) */
export function slerpLL(a, b, t) {
    const A = toV(lonOf(a), latOf(a)), B = toV(lonOf(b), latOf(b));
    const d = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)); if (d < 1e-9) return toLL(A);
    const s = Math.sin(d), ka = Math.sin((1 - t) * d) / s, kb = Math.sin(t * d) / s;
    return toLL([A[0] * ka + B[0] * kb, A[1] * ka + B[1] * kb, A[2] * ka + B[2] * kb]);
}
/** great-circle distance in km */
function gcKm(a, b) { const A = toV(lonOf(a), latOf(a)), B = toV(lonOf(b), latOf(b)); return 6371 * Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)); }
/** subsolar point [lon, lat] for a Date (low-precision ephemeris, ~0.01° — plenty for a terminator) */
function sunLL(date) {
    const d = date.getTime() / 864e5 - 10957.5; // days since J2000.0
    const g = (357.529 + 0.98560028 * d) * D2R, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R, e = (23.439 - 0.00000036 * d) * D2R;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = 18.697374558 + 24.06570982441908 * d;
    let lon = (ra / D2R - gmst * 15) % 360; if (lon < -180) lon += 360; if (lon >= 180) lon -= 360;
    return [lon, dec / D2R];
}

// ---------------------------------------------------------------------------------------------------- data
/** rings / lines packed as unit vectors + per-ring bounding caps (for culling) and seam flags (data cuts on ±180° / −90°) */
class Layer {
    constructor(rings, unit, closed) {
        let n = 0; for (const r of rings) n += r.length >> 1;
        this.n = rings.length; this.closed = closed; this.pts = n;
        this.xyz = new Float32Array(n * 3); this.seam = new Uint8Array(n); this.off = new Int32Array(rings.length + 1);
        this.cap = new Float32Array(rings.length * 6); // centre xyz, hide-below, visible-above, screen bound radius (×R)
        let k = 0;
        rings.forEach((r, ri) => {
            const m = r.length >> 1; this.off[ri] = k; let sx = 0, sy = 0, sz = 0;
            for (let i = 0; i < m; i++) {
                const lon = r[2 * i] * unit, lat = r[2 * i + 1] * unit, v = toV(lon, lat), o = 3 * (k + i);
                this.xyz[o] = v[0]; this.xyz[o + 1] = v[1]; this.xyz[o + 2] = v[2]; sx += v[0]; sy += v[1]; sz += v[2];
                const j = i + 1 < m ? i + 1 : closed ? 0 : -1;
                if (j >= 0) { const lon2 = r[2 * j] * unit, lat2 = r[2 * j + 1] * unit; if ((Math.abs(lon) > 179.99 && Math.abs(lon2) > 179.99) || (lat < -89.99 && lat2 < -89.99)) this.seam[k + i] = 1; }
            }
            let l = Math.hypot(sx, sy, sz); if (l < 1e-9) { sx = 0; sy = 0; sz = 1; l = 1; }
            sx /= l; sy /= l; sz /= l;
            let md = 1; for (let i = 0; i < m; i++) { const o = 3 * (k + i); md = Math.min(md, this.xyz[o] * sx + this.xyz[o + 1] * sy + this.xyz[o + 2] * sz); }
            const rho = Math.acos(clamp(md, -1, 1)) + 1e-4, q = 6 * ri;
            this.cap[q] = sx; this.cap[q + 1] = sy; this.cap[q + 2] = sz;
            this.cap[q + 3] = rho >= Math.PI / 2 ? -2 : -Math.sin(rho);
            this.cap[q + 4] = rho >= Math.PI / 2 ? 2 : Math.sin(rho);
            this.cap[q + 5] = rho >= Math.PI / 2 ? 2 : 1 - Math.cos(rho) + Math.sin(rho);
            k += m;
        });
        this.off[rings.length] = k;
    }
}
/** 1:110m fallback rings (lon/lat × 10, unknown winding) → counter-clockwise, long edges densified */
function prep110(rings, closed) {
    return rings.map((r) => {
        let a = Array.from(r);
        if (closed && a.length > 4 && a[0] === a[a.length - 2] && a[1] === a[a.length - 1]) a = a.slice(0, -2);
        if (closed) { let s = 0; for (let i = 0; i < a.length; i += 2) { const j = (i + 2) % a.length; s += a[i] * a[j + 1] - a[j] * a[i + 1]; } if (s < 0) { const b = []; for (let i = a.length - 2; i >= 0; i -= 2) b.push(a[i], a[i + 1]); a = b; } }
        const o = [], n = a.length >> 1;
        for (let i = 0; i < (closed ? n : n - 1); i++) {
            const j = (i + 1) % n, x0 = a[2 * i], y0 = a[2 * i + 1], x1 = a[2 * j], y1 = a[2 * j + 1]; o.push(x0, y0);
            const L = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); if (L > 10) { const k = Math.ceil(L / 10); for (let q = 1; q < k; q++) o.push(x0 + (x1 - x0) * q / k, y0 + (y1 - y0) * q / k); }
        }
        if (!closed) o.push(a[2 * n - 2], a[2 * n - 1]);
        return o;
    }).filter((r) => r.length >= (closed ? 6 : 4));
}
function graticule() {
    const rings = [];
    for (let lo = -180; lo < 180; lo += 15) { const r = []; for (let la = -80; la <= 80; la += 2) r.push(lo, la); rings.push(r); }
    for (let la = -75; la <= 75; la += 15) { const r = []; for (let lo = -180; lo <= 180; lo += 2) r.push(lo, la); rings.push(r); }
    return new Layer(rings, 1, false);
}
const GEO = { version: 0, src: '1:110m', land: null, lakes: null, borders: null, ice: null, grat: null };
function ensure110() {
    if (GEO.land) return;
    GEO.land = new Layer(prep110(NE_LAND, true), 0.1, true); GEO.borders = new Layer(prep110(NE_BORDERS, false), 0.1, false);
    GEO.lakes = null; GEO.ice = null; GEO.grat = graticule(); GEO.version = 1;
}
function decode50(buf) {
    const b = new Uint8Array(buf); if (b[0] !== 78 || b[1] !== 69 || b[2] !== 71 || b[3] !== 49) throw new Error('bad magic');
    let p = 4;
    const uv = () => { let v = 0, s = 0, x; do { x = b[p++]; v |= (x & 0x7f) << s; s += 7; } while (x & 0x80); return v >>> 0; };
    const zz = (v) => (v & 1 ? -((v + 1) >>> 1) : v >>> 1);
    const out = {}, nl = b[p++];
    for (let l = 0; l < nl; l++) {
        const kind = b[p++], nr = uv(), rings = [];
        for (let r = 0; r < nr; r++) { const n = uv(), a = new Int32Array(n * 2); let x = 0, y = 0; for (let i = 0; i < n; i++) { x += zz(uv()); y += zz(uv()); a[2 * i] = x; a[2 * i + 1] = y; } rings.push(a); }
        out[{ 1: 'land', 2: 'lakes', 3: 'borders', 4: 'ice' }[kind]] = new Layer(rings, 0.01, kind !== 3);
    }
    return out;
}
const LIGHTS = { tex: null, w: 0, h: 0, at: 0 };
const url = (f) => new URL(`../data/geo/${f}`, import.meta.url).href;
const frame = () => new Promise((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 60 }) : setTimeout(r, 16)));
async function loadLights() {
    const img = new Image(); img.decoding = 'async'; img.src = url('lights.jpg'); await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = 90;
    const c = cv.getContext('2d', { willReadFrequently: true }), tex = new Uint8Array(w * h);
    // read the luminance in strips across idle slices (a single 4 Mpx getImageData is a visible hitch mid-flight)
    for (let y0 = 0; y0 < h; y0 += 90) {
        const sh = Math.min(90, h - y0); c.clearRect(0, 0, w, 90); c.drawImage(img, 0, y0, w, sh, 0, 0, w, sh);
        const d = c.getImageData(0, 0, w, sh).data; for (let i = 0, o = y0 * w, n = w * sh; i < n; i++) tex[o + i] = d[i * 4];
        await frame();
    }
    Object.assign(LIGHTS, { tex, w, h, at: performance.now() });
}
let loading = null;
/** lazy-load the 1:50m vectors + Black Marble lights (idempotent); the globe draws 1:110m without lights meanwhile */
function loadGlobeData() {
    ensure110();
    return loading || (loading = Promise.all([
        fetch(url('ne50m.bin')).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((buf) => {
            const d = decode50(buf); Object.assign(GEO, d, { src: '1:50m', version: GEO.version + 1 });
        }).catch((e) => console.warn('[globe] 1:50m data unavailable, keeping 1:110m', e)),
        loadLights().catch((e) => console.warn('[globe] city lights unavailable', e)),
    ]));
}
const geoInfo = () => ({ src: GEO.src, land: GEO.land?.pts || 0, lakes: GEO.lakes?.pts || 0, borders: GEO.borders?.pts || 0, ice: GEO.ice?.pts || 0, lights: LIGHTS.tex ? `${LIGHTS.w}×${LIGHTS.h}` : null });

// ---------------------------------------------------------------------------------------------------- projection
export function makeProj(lon0, lat0, R, cx, cy) {
    const l = lon0 * D2R, p = lat0 * D2R, cl = Math.cos(l), sl = Math.sin(l), cp = Math.cos(p), sp = Math.sin(p);
    const e1 = [-sl, cl, 0], e2 = [-sp * cl, -sp * sl, cp], e3 = [cp * cl, cp * sl, sp];
    const Pv = (v) => [cx + R * (v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]), cy - R * (v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2]), v[0] * e3[0] + v[1] * e3[1] + v[2] * e3[2]];
    return { lon0, lat0, R, cx, cy, e1, e2, e3, Pv, P: (lon, lat) => Pv(toV(lon, lat)) };
}
// scratch buffers for clipped rings
let SX = new Float64Array(8192), SY = new Float64Array(8192);
const SEG = { a: new Int32Array(512), b: new Int32Array(512), tin: new Float64Array(512), tout: new Float64Array(512), used: new Uint8Array(512) };
function growPts(n) { if (n < SX.length) return; const nx = new Float64Array(n * 2), ny = new Float64Array(n * 2); nx.set(SX); ny.set(SY); SX = nx; SY = ny; }
function growSeg(n) { if (n < SEG.a.length) return; for (const k of ['a', 'b', 'tin', 'tout', 'used']) { const o = SEG[k], q = new o.constructor(n * 2); q.set(o); SEG[k] = q; } }
/**
 * Polygon rings → fill path (visible part, closed along the limb; even-odd) + stroke path (visible coast only, no limb,
 * no data seams). Rings are counter-clockwise, so the limb is followed counter-clockwise from each exit to the next entry.
 */
function ringPaths(L, pr, vp, minD, wantStroke) {
    const fill = new Path2D(), stroke = wantStroke ? new Path2D() : null;
    if (!L) return { fill, stroke };
    const { xyz, off, cap, seam } = L, { R, cx, cy } = pr;
    const [a1, b1, c1] = pr.e1, [a2, b2, c2] = pr.e2, [a3, b3, c3] = pr.e3, md2 = minD * minD;
    for (let r = 0; r < L.n; r++) {
        const q = 6 * r, kx = cap[q], ky = cap[q + 1], kz = cap[q + 2], cz = kx * a3 + ky * b3 + kz * c3;
        if (cz < cap[q + 3]) continue;
        if (vp) { const px = cx + R * (kx * a1 + ky * b1 + kz * c1), py = cy - R * (kx * a2 + ky * b2 + kz * c2), br = R * cap[q + 5]; if (px + br < vp[0] || px - br > vp[2] || py + br < vp[1] || py - br > vp[3]) continue; }
        const s = off[r], e = off[r + 1], n = e - s;
        let k0 = -1;
        if (cz <= cap[q + 4]) for (let i = s; i < e; i++) { const o = 3 * i; if (xyz[o] * a3 + xyz[o + 1] * b3 + xyz[o + 2] * c3 <= 0) { k0 = i; break; } }
        if (k0 < 0) { // fully visible
            let o = 3 * s; const x0 = cx + R * (xyz[o] * a1 + xyz[o + 1] * b1 + xyz[o + 2] * c1), y0 = cy - R * (xyz[o] * a2 + xyz[o + 1] * b2 + xyz[o + 2] * c2);
            fill.moveTo(x0, y0); if (stroke) stroke.moveTo(x0, y0);
            let lx = x0, ly = y0;
            for (let i = s + 1; i < e; i++) {
                o = 3 * i; const x = cx + R * (xyz[o] * a1 + xyz[o + 1] * b1 + xyz[o + 2] * c1), y = cy - R * (xyz[o] * a2 + xyz[o + 1] * b2 + xyz[o + 2] * c2);
                const sm = seam[i - 1], keep = sm || seam[i] || (x - lx) * (x - lx) + (y - ly) * (y - ly) >= md2;
                if (!keep) continue;
                fill.lineTo(x, y); if (stroke) { if (sm) stroke.moveTo(x, y); else stroke.lineTo(x, y); }
                lx = x; ly = y;
            }
            fill.closePath(); if (stroke && !seam[e - 1]) stroke.lineTo(x0, y0);
            continue;
        }
        // partially visible: walk from a hidden vertex once around, collecting visible runs (entry … exit on the limb)
        growPts(n * 2 + 8);
        let m = 0, ns = 0, pz = 0, px = 0, py = 0, lx = 0, ly = 0, open = false;
        { const o = 3 * k0; px = xyz[o] * a1 + xyz[o + 1] * b1 + xyz[o + 2] * c1; py = xyz[o] * a2 + xyz[o + 1] * b2 + xyz[o + 2] * c2; pz = xyz[o] * a3 + xyz[o + 1] * b3 + xyz[o + 2] * c3; }
        for (let j = 1; j <= n; j++) {
            const ia = s + ((k0 - s + j - 1) % n), ib = s + ((k0 - s + j) % n), o = 3 * ib;
            const ux = xyz[o] * a1 + xyz[o + 1] * b1 + xyz[o + 2] * c1, uy = xyz[o] * a2 + xyz[o + 1] * b2 + xyz[o + 2] * c2, uz = xyz[o] * a3 + xyz[o + 1] * b3 + xyz[o + 2] * c3;
            const sm = seam[ia];
            if (pz > 0 || uz > 0) {
                if (pz <= 0) { // entry
                    const t = pz / (pz - uz), qx = px + (ux - px) * t, qy = py + (uy - py) * t, h = Math.hypot(qx, qy) || 1;
                    growSeg(ns + 1); SEG.a[ns] = m; SEG.tin[ns] = Math.atan2(qy, qx);
                    SX[m] = cx + R * qx / h; SY[m] = cy - R * qy / h; lx = SX[m]; ly = SY[m]; m++; open = true;
                    if (stroke) stroke.moveTo(lx, ly);
                    const x = cx + R * ux, y = cy - R * uy; SX[m] = x; SY[m] = y; m++; lx = x; ly = y;
                    if (stroke) { if (sm) stroke.moveTo(x, y); else stroke.lineTo(x, y); }
                } else if (uz > 0) { // visible run
                    const x = cx + R * ux, y = cy - R * uy;
                    if (sm || seam[ib] || (x - lx) * (x - lx) + (y - ly) * (y - ly) >= md2) { SX[m] = x; SY[m] = y; m++; lx = x; ly = y; if (stroke) { if (sm) stroke.moveTo(x, y); else stroke.lineTo(x, y); } }
                } else { // exit
                    const t = pz / (pz - uz), qx = px + (ux - px) * t, qy = py + (uy - py) * t, h = Math.hypot(qx, qy) || 1;
                    const x = cx + R * qx / h, y = cy - R * qy / h; SX[m] = x; SY[m] = y;
                    if (stroke && !sm) stroke.lineTo(x, y);
                    SEG.b[ns] = m; SEG.tout[ns] = Math.atan2(qy, qx); m++; ns++; open = false;
                }
            }
            px = ux; py = uy; pz = uz;
        }
        if (open || !ns) continue;
        for (let i = 0; i < ns; i++) SEG.used[i] = 0;
        for (let i0 = 0; i0 < ns; i0++) {
            if (SEG.used[i0]) continue;
            let k = i0; fill.moveTo(SX[SEG.a[k]], SY[SEG.a[k]]);
            for (let guard = 0; guard <= ns; guard++) {
                SEG.used[k] = 1;
                for (let i = SEG.a[k] + 1; i <= SEG.b[k]; i++) fill.lineTo(SX[i], SY[i]);
                const to = SEG.tout[k]; let best = i0, bd = 1e9;
                for (let j = 0; j < ns; j++) { if (SEG.used[j] && j !== i0) continue; let d = SEG.tin[j] - to; d -= Math.floor(d / TAU) * TAU; if (d < bd) { bd = d; best = j; } }
                fill.arc(cx, cy, R, -to, -(to + bd), true);
                if (best === i0) break;
                k = best;
            }
            fill.closePath();
        }
    }
    return { fill, stroke };
}
/** open polylines (borders, graticule): visible runs, cut exactly at the limb */
function linePath(L, pr, vp, minD) {
    const path = new Path2D(); if (!L) return path;
    const { xyz, off, cap } = L, { R, cx, cy } = pr;
    const [a1, b1, c1] = pr.e1, [a2, b2, c2] = pr.e2, [a3, b3, c3] = pr.e3, md2 = minD * minD;
    for (let r = 0; r < L.n; r++) {
        const q = 6 * r, kx = cap[q], ky = cap[q + 1], kz = cap[q + 2], cz = kx * a3 + ky * b3 + kz * c3;
        if (cz < cap[q + 3]) continue;
        if (vp) { const px = cx + R * (kx * a1 + ky * b1 + kz * c1), py = cy - R * (kx * a2 + ky * b2 + kz * c2), br = R * cap[q + 5]; if (px + br < vp[0] || px - br > vp[2] || py + br < vp[1] || py - br > vp[3]) continue; }
        let pz = -1, px = 0, py = 0, lx = 0, ly = 0;
        for (let i = off[r], e = off[r + 1]; i < e; i++) {
            const o = 3 * i, ux = xyz[o] * a1 + xyz[o + 1] * b1 + xyz[o + 2] * c1, uy = xyz[o] * a2 + xyz[o + 1] * b2 + xyz[o + 2] * c2, uz = xyz[o] * a3 + xyz[o + 1] * b3 + xyz[o + 2] * c3;
            if (uz > 0) {
                const x = cx + R * ux, y = cy - R * uy;
                if (i === off[r]) { path.moveTo(x, y); lx = x; ly = y; }
                else if (pz <= 0) { const t = pz / (pz - uz), qx = px + (ux - px) * t, qy = py + (uy - py) * t, h = Math.hypot(qx, qy) || 1; path.moveTo(cx + R * qx / h, cy - R * qy / h); path.lineTo(x, y); lx = x; ly = y; }
                else if ((x - lx) * (x - lx) + (y - ly) * (y - ly) >= md2 || i === e - 1) { path.lineTo(x, y); lx = x; ly = y; }
            } else if (pz > 0) { const t = pz / (pz - uz), qx = px + (ux - px) * t, qy = py + (uy - py) * t, h = Math.hypot(qx, qy) || 1; path.lineTo(cx + R * qx / h, cy - R * qy / h); }
            px = ux; py = uy; pz = uz;
        }
    }
    return path;
}

// ---------------------------------------------------------------------------------------------------- shading layer
/** per-pixel day / twilight / night + city lights + day-side limb haze, at 1–2 device px per sample */
class Shade {
    constructor() { this.cv = document.createElement('canvas'); this.ctx = this.cv.getContext('2d'); this.img = null; this.key = ''; }
    render(pr, sun, lightsA, step) {
        const N = Math.max(16, Math.min(1400, Math.ceil(2 * pr.R / step)));
        const key = `${pr.lon0.toFixed(4)}|${pr.lat0.toFixed(4)}|${N}|${sun[0].toFixed(4)}|${sun[1].toFixed(4)}|${sun[2].toFixed(4)}|${lightsA.toFixed(2)}|${LIGHTS.tex ? 1 : 0}`;
        if (key === this.key) return this.cv;
        this.key = key;
        if (this.cv.width !== N) { this.cv.width = N; this.cv.height = N; this.img = this.ctx.createImageData(N, N); }
        const out = this.img.data, inv = 2 / N;
        const [a1, b1, c1] = pr.e1, [a2, b2, c2] = pr.e2, [a3, b3, c3] = pr.e3, [s0, s1, s2] = sun;
        const tex = LIGHTS.tex, TW = LIGHTS.w, TH = LIGHTS.h, kU = TW / TAU, kV = TH / Math.PI, la = tex ? lightsA : 0;
        let o = 0;
        for (let py = 0; py < N; py++) {
            const y = 1 - (py + 0.5) * inv;
            for (let px = 0; px < N; px++, o += 4) {
                const x = (px + 0.5) * inv - 1; let r2 = x * x + y * y;
                if (r2 > 1.06) { out[o + 3] = 0; continue; }
                let xx = x, yy = y; if (r2 > 1) { const k = 1 / Math.sqrt(r2); xx *= k; yy *= k; r2 = 1; }
                const z = Math.sqrt(1 - r2);
                const vx = xx * a1 + yy * a2 + z * a3, vy = xx * b1 + yy * b2 + z * b3, vz = xx * c1 + yy * c2 + z * c3;
                const d = vx * s0 + vy * s1 + vz * s2; // cos(solar zenith)
                // premultiplied accumulation: darkness → twilight → lights → haze
                const night = d > 0.06 ? 0 : d < -0.14 ? 1 : smooth(0.06, -0.14, d), dayDim = d > 0.75 ? 0 : 1 - smooth(-0.1, 0.75, d);
                let A = 1 - (1 - 0.84 * night) * (1 - 0.3 * dayDim), Rr = 3 * A, Gg = 8 * A, Bb = 22 * A;
                const tw = d > 0.25 || d < -0.3 ? 0 : 0.2 * Math.exp(-((d + 0.02) * (d + 0.02)) / 0.004);
                if (tw > 0.003) { Rr = 255 * tw + Rr * (1 - tw); Gg = 135 * tw + Gg * (1 - tw); Bb = 70 * tw + Bb * (1 - tw); A = tw + A * (1 - tw); }
                if (la > 0 && d < 0.02) {
                    // bilinear (zoomed-in views would show the 0.125° texels as blocks)
                    const fu = (Math.atan2(vy, vx) + Math.PI) * kU - 0.5, fv = (Math.PI / 2 - Math.asin(vz)) * kV - 0.5;
                    let u0 = Math.floor(fu), v0 = Math.floor(fv); const du = fu - u0, dv = fv - v0;
                    const u1 = u0 + 1 >= TW ? 0 : u0 + 1; if (u0 < 0) u0 = TW - 1; v0 = v0 < 0 ? 0 : v0; const v1 = v0 + 1 < TH ? v0 + 1 : TH - 1;
                    const r0 = v0 * TW, r1 = v1 * TW;
                    const Lr = (tex[r0 + u0] * (1 - du) + tex[r0 + u1] * du) * (1 - dv) + (tex[r1 + u0] * (1 - du) + tex[r1 + u1] * du) * dv;
                    if (Lr > 6) {
                        const li = Math.min(1, (Lr / 255) * 1.25) * (d < -0.12 ? 1 : smooth(0.02, -0.12, d)) * la;
                        Rr = 255 * li + Rr * (1 - li); Gg = 214 * li + Gg * (1 - li); Bb = 140 * li + Bb * (1 - li); A = li + A * (1 - li);
                    }
                }
                const f = 1 - z, haze = f * f * f * (0.62 * (d < -0.2 ? 0 : smooth(-0.2, 0.3, d)) + 0.12);
                if (haze > 0.003) { Rr = 140 * haze + Rr * (1 - haze); Gg = 196 * haze + Gg * (1 - haze); Bb = 255 * haze + Bb * (1 - haze); A = haze + A * (1 - haze); }
                if (A < 0.002) { out[o + 3] = 0; continue; }
                out[o] = Rr / A; out[o + 1] = Gg / A; out[o + 2] = Bb / A; out[o + 3] = A * 255;
            }
        }
        this.ctx.putImageData(this.img, 0, 0);
        return this.cv;
    }
}

// ---------------------------------------------------------------------------------------------------- the globe
const COL = {
    oceanLit: '#2f7fb3', oceanMid: '#17507e', oceanDeep: '#0a2440', shelf: 'rgba(110,205,235,', land: ['#7d9a63', '#5c7c4c', '#3f5a39'],
    lake: '#2a6a99', ice: 'rgba(236,243,250,0.92)', coast: 'rgba(225,240,255,0.42)', border: 'rgba(255,255,255,0.32)', grat: 'rgba(170,205,255,0.11)',
};
export class Globe {
    constructor() { this.shade = new Shade(); this.cache = null; this.key = ''; this.stats = { ms: 0, shadeMs: 0, n: 0 }; }
    /** sun as a unit vector + lights fade (Black Marble fades in when it arrives) */
    _sun(date) { const s = sunLL(date || new Date()); return { ll: s, v: toV(s[0], s[1]) }; }
    /**
     * Draw the globe into ctx (device px, identity transform). o: { lon0, lat0, R, cx, cy, dpr, date, W, H, cache, step }.
     * cache: keep the rendered globe in an offscreen canvas and blit it while view / sun / data are unchanged.
     */
    render(ctx, o) {
        const { lon0, lat0, R, cx, cy, dpr = 1 } = o;
        ensure110();
        const sun = this._sun(o.date), pr = makeProj(lon0, lat0, R, cx, cy); pr.sun = sun.v; pr.sunLL = sun.ll;
        const lightsA = LIGHTS.tex ? clamp((performance.now() - LIGHTS.at) / 900, 0, 1) : 0;
        if (o.cache) {
            const W = o.W, H = o.H;
            const key = `${lon0.toFixed(4)}|${lat0.toFixed(4)}|${R.toFixed(2)}|${cx}|${cy}|${W}|${H}|${sun.v.map((v) => v.toFixed(4))}|${GEO.version}|${lightsA.toFixed(2)}|${o.step}`;
            if (!this.cache) this.cache = document.createElement('canvas');
            if (this.cache.width !== W || this.cache.height !== H) { this.cache.width = W; this.cache.height = H; this.key = ''; }
            if (key !== this.key) { const c = this.cache.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); this._draw(c, pr, sun, lightsA, o); this.key = key; }
            ctx.drawImage(this.cache, 0, 0);
            return pr;
        }
        this._draw(ctx, pr, sun, lightsA, o);
        return pr;
    }
    _draw(c, pr, sun, lightsA, o) {
        const t0 = performance.now(), { R, cx, cy } = pr, dpr = o.dpr || 1, W = o.W || c.canvas.width, H = o.H || c.canvas.height;
        const vp = [-4, -4, W + 4, H + 4], minD = 0.75 * dpr, ppd = R * D2R; // device px per degree at the centre
        const sx = sun.v[0] * pr.e1[0] + sun.v[1] * pr.e1[1] + sun.v[2] * pr.e1[2], sy = sun.v[0] * pr.e2[0] + sun.v[1] * pr.e2[1] + sun.v[2] * pr.e2[2], sz = sun.v[0] * pr.e3[0] + sun.v[1] * pr.e3[1] + sun.v[2] * pr.e3[2];
        // outer atmosphere (brighter towards the sun)
        const glow = c.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16);
        glow.addColorStop(0, 'rgba(110,175,255,0.42)'); glow.addColorStop(0.35, 'rgba(80,140,255,0.16)'); glow.addColorStop(1, 'rgba(60,120,255,0)');
        c.fillStyle = glow; c.beginPath(); c.arc(cx, cy, R * 1.16, 0, TAU); c.fill();
        const sl = Math.hypot(sx, sy);
        c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
        // ocean: depth gradient lit from the sun side + glint at the reflection point
        const lx = cx + sx * R * 0.4, ly = cy - sy * R * 0.4, oc = c.createRadialGradient(lx, ly, R * 0.05, cx, cy, R * 1.02);
        oc.addColorStop(0, COL.oceanLit); oc.addColorStop(0.55, COL.oceanMid); oc.addColorStop(1, COL.oceanDeep);
        c.fillStyle = oc; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
        { const hx = sx, hy = sy, hz = sz + 1, hl = Math.hypot(hx, hy, hz); if (hl > 1e-3 && hz / hl > 0.05) { const gx = cx + R * hx / hl, gy = cy - R * hy / hl, gr = c.createRadialGradient(gx, gy, 0, gx, gy, R * 0.32); gr.addColorStop(0, 'rgba(255,250,235,0.22)'); gr.addColorStop(0.4, 'rgba(200,230,255,0.07)'); gr.addColorStop(1, 'rgba(200,230,255,0)'); c.fillStyle = gr; c.fillRect(gx - R * 0.32, gy - R * 0.32, R * 0.64, R * 0.64); } }
        // graticule
        c.strokeStyle = COL.grat; c.lineWidth = Math.max(0.6, 0.8 * dpr); c.stroke(linePath(GEO.grat, pr, vp, minD * 2));
        // land: coastal shelf glow under it, fill (even-odd: the Caspian), lakes, ice, coast + borders
        const land = ringPaths(GEO.land, pr, vp, minD, true);
        c.lineJoin = 'round'; c.lineCap = 'round';
        const shelf = clamp(ppd * 0.55, 2.5 * dpr, 16 * dpr);
        c.strokeStyle = `${COL.shelf}0.10)`; c.lineWidth = shelf * 2; c.stroke(land.stroke);
        c.strokeStyle = `${COL.shelf}0.14)`; c.lineWidth = shelf; c.stroke(land.stroke);
        const lg = c.createRadialGradient(lx, ly, R * 0.05, cx, cy, R * 1.05); lg.addColorStop(0, COL.land[0]); lg.addColorStop(0.6, COL.land[1]); lg.addColorStop(1, COL.land[2]);
        c.fillStyle = lg; c.fill(land.fill, 'evenodd');
        if (GEO.ice) { const ice = ringPaths(GEO.ice, pr, vp, minD, false); c.fillStyle = COL.ice; c.fill(ice.fill, 'evenodd'); }
        if (GEO.lakes) { const lk = ringPaths(GEO.lakes, pr, vp, minD, true); c.fillStyle = COL.lake; c.fill(lk.fill, 'evenodd'); c.strokeStyle = 'rgba(190,225,255,0.35)'; c.lineWidth = 0.6 * dpr; c.stroke(lk.stroke); }
        c.strokeStyle = COL.coast; c.lineWidth = clamp(ppd * 0.012, 0.7, 1.3) * dpr; c.stroke(land.stroke);
        c.strokeStyle = COL.border; c.lineWidth = clamp(ppd * 0.01, 0.6, 1.1) * dpr; c.stroke(linePath(GEO.borders, pr, vp, minD));
        // day / night / lights / haze
        const ts = performance.now();
        const step = o.step || (R > 900 ? 2 : R > 500 ? 1.5 : 1.2);
        const sh = this.shade.render(pr, sun.v, lightsA, step);
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        c.drawImage(sh, cx - R, cy - R, 2 * R, 2 * R);
        this.stats.shadeMs = performance.now() - ts;
        // limb: soft inner shadow + crisp rim lit on the sun side
        const lim = c.createRadialGradient(cx, cy, R * 0.82, cx, cy, R); lim.addColorStop(0, 'rgba(0,8,20,0)'); lim.addColorStop(1, 'rgba(0,8,20,0.28)');
        c.fillStyle = lim; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
        c.restore();
        const rim = sl > 0.02 ? c.createLinearGradient(cx - (sx / sl) * R, cy + (sy / sl) * R, cx + (sx / sl) * R, cy - (sy / sl) * R) : null;
        if (rim) { rim.addColorStop(0, 'rgba(120,170,255,0.18)'); rim.addColorStop(1, 'rgba(190,225,255,0.75)'); }
        c.strokeStyle = rim || 'rgba(160,200,255,0.45)'; c.lineWidth = 1.3 * dpr; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
        this.stats.ms = performance.now() - t0; this.stats.n++;
    }
}

// ---------------------------------------------------------------------------------------------------- overlays
/** deep-space backdrop with a faint nebula and fixed stars (device px) */
function drawSpace(ctx, W, H, cx, cy, R, dpr = 1) {
    const bg = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(W, H) * 0.9);
    bg.addColorStop(0, '#0d1b33'); bg.addColorStop(0.5, '#060d1c'); bg.addColorStop(1, '#02050c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W * 0.82, H * 0.18, 0, W * 0.82, H * 0.18, Math.max(W, H) * 0.45);
    neb.addColorStop(0, 'rgba(90,70,160,0.10)'); neb.addColorStop(1, 'rgba(90,70,160,0)'); ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
        const x = ((i * 977 + 13) % 1000) / 1000 * W, y = ((i * 571 + 7) % 1000) / 1000 * H, d = Math.hypot(x - cx, y - cy);
        if (d < R * 1.12) continue;
        const b = ((i * 37) % 10) / 10; ctx.fillStyle = `rgba(${b > 0.7 ? '255,236,210' : '220,232,255'},${0.25 + 0.55 * b})`;
        const s = (b > 0.85 ? 1.6 : 1) * dpr; ctx.fillRect(x, y, s, s);
    }
}
/** great-circle samples from a to b: [{ lon, lat, v }] */
function routePoints(a, b, n = 160) {
    const out = []; for (let i = 0; i <= n; i++) { const [lon, lat] = slerpLL(a, b, i / n); out.push({ lon, lat, v: toV(lon, lat) }); } return out;
}
function routePath(pr, pts, f0, f1) {
    const path = new Path2D(), n = pts.length - 1, i0 = Math.floor(f0 * n), i1 = Math.min(n, Math.ceil(f1 * n));
    let pen = false, first = null, last = null;
    for (let i = i0; i <= i1; i++) {
        const t = i === i0 ? f0 : i === i1 ? f1 : i / n, p = Math.abs(t * n - i) < 1e-6 ? pts[i] : null;
        const v = p ? p.v : toV(...slerpLL(pts[0], pts[n], t));
        const [x, y, z] = pr.Pv(v);
        if (z > 0) { if (pen) path.lineTo(x, y); else path.moveTo(x, y); pen = true; if (!first) first = [x, y]; last = [x, y]; } else pen = false;
    }
    return { path, first, last };
}
/**
 * the route as a glowing line: done part (0..upto) glows gold with flowing light, the rest is a faint dashed line.
 * opts: { upto = 1, dpr, t (s, animates the flow), rest = true, glow = 1 }
 */
function drawRoute(ctx, pr, pts, { upto = 1, dpr = 1, t = 0, rest = true, glow = 1 } = {}) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (rest && upto < 1) { const r = routePath(pr, pts, upto, 1).path; ctx.setLineDash([5 * dpr, 7 * dpr]); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke(r); ctx.setLineDash([]); }
    if (upto > 0.001) {
        const d = routePath(pr, pts, 0, upto).path;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(251,176,36,${0.10 * glow})`; ctx.lineWidth = 14 * dpr; ctx.stroke(d);
        ctx.strokeStyle = `rgba(251,191,36,${0.22 * glow})`; ctx.lineWidth = 6.5 * dpr; ctx.stroke(d);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 2.2 * dpr; ctx.stroke(d);
        ctx.setLineDash([3 * dpr, 17 * dpr]); ctx.lineDashOffset = -t * 46 * dpr; ctx.strokeStyle = 'rgba(255,253,240,0.95)'; ctx.lineWidth = 2.4 * dpr; ctx.stroke(d); ctx.setLineDash([]);
    }
    ctx.restore();
}
/** plane silhouette at (x, y) heading ang (radians, canvas), scale s — with a soft halo so it reads on any background */
export function drawPlane(ctx, x, y, ang, s = 1) {
    ctx.save(); ctx.translate(x, y);
    const h = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * s); h.addColorStop(0, 'rgba(255,236,170,0.45)'); h.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(0, 0, 26 * s, 0, TAU); ctx.fill();
    ctx.rotate(ang); ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6 * s; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -3.5); ctx.lineTo(-14, -15); ctx.lineTo(-8, -15); ctx.lineTo(-1, -3.5); ctx.lineTo(-11, -2); ctx.lineTo(-16, -8); ctx.lineTo(-18, 0); ctx.lineTo(-16, 8); ctx.lineTo(-11, 2); ctx.lineTo(-1, 3.5); ctx.lineTo(-8, 15); ctx.lineTo(-14, 15); ctx.lineTo(-10, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
}
function pill(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); } }
/** a glowing city dot (device px); returns [x, y, z] or null when behind the globe */
function drawDot(ctx, pr, ll, { dpr = 1, color = '#fbbf24', size = 1, pulse = 0, t = 0 } = {}) {
    const [x, y, z] = pr.P(lonOf(ll), latOf(ll)); if (z <= 0) return null;
    const a = smooth(0, 0.12, z); ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14 * dpr * size); g.addColorStop(0, `${color}aa`); g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14 * dpr * size, 0, TAU); ctx.fill();
    if (pulse) { const k = (t * 0.8) % 1; ctx.strokeStyle = `rgba(52,211,153,${(1 - k) * 0.9})`; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(x, y, (8 + 16 * k) * dpr, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 4.6 * dpr * size, 0, TAU); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 2.8 * dpr * size, 0, TAU); ctx.fill();
    ctx.restore(); return [x, y, z];
}
/**
 * label pill next to an anchor (device px): title (+ optional sub line); side 'left' | 'right'; returns the box [x0, y0, x1, y1].
 * Kept inside [0, W] × [0, H].
 */
function drawLabel(ctx, ax, ay, { title, sub = '', side = 'right', dpr = 1, W = 1e9, H = 1e9, alpha = 1, accent = '#fbbf24', dy = 0, size = 14 } = {}) {
    ctx.save(); ctx.globalAlpha = alpha;
    const fs = size * dpr, fs2 = (size - 3) * dpr, padX = 10 * dpr, gap = 14 * dpr;
    ctx.font = FONT(600, fs); const w1 = ctx.measureText(title).width; ctx.font = FONT(500, fs2); const w2 = sub ? ctx.measureText(sub).width : 0;
    const w = Math.max(w1, w2) + padX * 2, h = (sub ? fs + fs2 + 13 * dpr : fs + 12 * dpr);
    let x0 = side === 'left' ? ax - gap - w : ax + gap, y0 = ay - h / 2 + dy;
    x0 = clamp(x0, 6 * dpr, W - w - 6 * dpr); y0 = clamp(y0, 6 * dpr, H - h - 6 * dpr);
    // leader
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1 * dpr; ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.lineTo(side === 'left' ? x0 + w : x0, clamp(ay, y0 + 6 * dpr, y0 + h - 6 * dpr)); ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10 * dpr; ctx.fillStyle = 'rgba(8,13,26,0.84)'; pill(ctx, x0, y0, w, h, 9 * dpr); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1 * dpr; ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(x0 + (side === 'left' ? w - 3 * dpr : 0), y0 + 7 * dpr, 3 * dpr, h - 14 * dpr);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = FONT(600, fs); ctx.fillStyle = '#f8fafc'; ctx.fillText(title, x0 + padX, y0 + 6 * dpr + fs * 0.92);
    if (sub) { ctx.font = FONT(500, fs2); ctx.fillStyle = 'rgba(203,213,225,0.9)'; ctx.fillText(sub, x0 + padX, y0 + 6 * dpr + fs + 4 * dpr + fs2 * 0.92); }
    ctx.restore();
    return [x0, y0, x0 + w, y0 + h];
}
const fmtTime = (date, tz) => { try { return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return date.toISOString().slice(11, 16); } };
const tzOffsetH = (date, tz) => { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date).reduce((o, x) => ((o[x.type] = x.value), o), {}); return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - date.getTime()) / 36e5 * 4) / 4; } catch { return 0; } };
const isDay = (ll, sunV) => { const v = toV(lonOf(ll), latOf(ll)); return v[0] * sunV[0] + v[1] * sunV[1] + v[2] * sunV[2] > -0.0145; }; // sun above −0.83°

// ---------------------------------------------------------------------------------------------------- flight
let FLIGHT = null;
/**
 * One frame of the flight cut-scene globe (device px): space, globe (lit for `date`), the route — flown part glowing,
 * the rest dashed — both airports and the plane. o: { W, H, cx, cy, R, dpr, lon0, lat0, A, B, e (0..1), date, portrait, t }.
 * Returns the projection.
 */
export function flightScene(ctx, o) {
    if (!FLIGHT) { FLIGHT = { globe: new Globe(), key: '', route: null }; loadGlobeData(); }
    const { W, H, cx, cy, R, dpr, A, B, e } = o, key = `${A.code}${B.code}`;
    if (FLIGHT.key !== key) { FLIGHT.key = key; FLIGHT.route = routePoints(A, B, 180); }
    drawSpace(ctx, W, H, cx, cy, R, dpr);
    const pr = FLIGHT.globe.render(ctx, { lon0: o.lon0, lat0: o.lat0, R, cx, cy, dpr, date: o.date, W, H, step: Math.max(2, R / 200) });
    drawRoute(ctx, pr, FLIGHT.route, { upto: e, dpr, t: o.t || 0 });
    for (const ap of [A, B]) {
        const p = drawDot(ctx, pr, ap, { dpr, color: '#fbbf24', size: 1.1 }); if (!p) continue;
        const day = isDay(ap, pr.sun);
        drawLabel(ctx, p[0], p[1], { title: ap.name, sub: day ? '☀ daylight' : '☾ night', side: p[0] < cx ? 'right' : 'left', dpr, W, H, alpha: smooth(0, 0.15, p[2]), size: o.portrait ? 13 : 15 });
    }
    const [plon, plat] = slerpLL(A, B, e), [qlon, qlat] = slerpLL(A, B, Math.min(1, e + 0.01));
    const [px, py, pz] = pr.P(plon, plat), [qx, qy] = pr.P(qlon, qlat);
    if (pz > 0) drawPlane(ctx, px, py, Math.atan2(qy - py, qx - px), dpr * (o.portrait ? 0.9 : 1.1));
    return pr;
}

// ---------------------------------------------------------------------------------------------------- World tab
export const PLACES = {
    OTP: { lon: 26.0850, lat: 44.5711, code: 'OTP' }, SEA: { lon: -122.3088, lat: 47.4502, code: 'SEA' },
    bucharest: { lon: 26.1025, lat: 44.4268, name: 'București', flag: '🇷🇴', tz: 'Europe/Bucharest' },
    seattle: { lon: -122.3321, lat: 47.6062, name: 'Seattle', flag: '🇺🇸', tz: 'America/Los_Angeles' },
    bellevue: { lon: -122.2015, lat: 47.6101, name: 'Bellevue', flag: '🇺🇸', tz: 'America/Los_Angeles' },
};
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const wrapLon = (l) => ((((l + 180) % 360) + 360) % 360) - 180;
/**
 * The world-map hub's World tab. The hub owns pan / zoom (its `views.world` = { cx, cy, s, fit }: pan in degrees, s = CSS px
 * per degree at the centre); this turns them into a rotation (east–west drags scaled by 1 / cos(lat) so the surface follows
 * the finger), animates intro / focus, draws, and returns hit boxes (CSS px) with `go()` = fly to the city, then pick(tab).
 */
export class WorldGlobe {
    constructor() {
        this.globe = new Globe(); this.route = routePoints(PLACES.OTP, PLACES.SEA, 180);
        this.km = Math.round(gcKm(PLACES.OTP, PLACES.SEA) / 10) * 10;
        const mid = slerpLL(PLACES.OTP, PLACES.SEA, 0.5); this.home = { lon: mid[0], lat: mid[1] - 8 };
        this.vRef = null; this.anim = null; this.lastDraw = 0; this.t0 = performance.now(); this.lon0 = this.home.lon; this.lat0 = this.home.lat;
        this.ready = loadGlobeData();
    }
    /** a fresh view for a W × H (CSS px) map */
    initialView(W, H) { const R = Math.min(W * 0.45, H * (W < 560 ? 0.4 : 0.42)); const s = R * D2R; return { cx: 0, cy: 0, s, fit: s, w: W, h: H }; }
    _animTo(to, dur, done = null) { this.anim = { from: { lon: this.lon0, lat: this.lat0, s: this.v.s }, to, t0: performance.now(), dur, done }; }
    /** rotate / zoom to (lon, lat) at `zoom` × fit (animated) */
    lookAt(lon, lat, zoom = 1, dur = 900) { if (this.v) this._animTo({ lon, lat, s: this.v.fit * zoom }, dur); }
    get stats() { return { ...this.globe.stats, ...geoInfo() }; }
    /** the antisolar point (centre of the night side) — for a night view */
    nightPoint(date = new Date()) { const s = sunLL(date); return { lon: wrapLon(s[0] + 180), lat: -s[1] }; }
    draw(g, { W, H, dpr, view: v, counts = {}, here = null, pick = null, now = new Date() }) {
        const tnow = performance.now(), t = (tnow - this.t0) / 1000;
        if (v.w !== W || v.h !== H) { const f = this.initialView(W, H).fit; v.s *= f / v.fit; v.fit = f; v.w = W; v.h = H; } // resized: keep the zoom factor
        if (v !== this.vRef) { // new view (first open / Fit): settle in from a slightly turned globe
            this.vRef = v; this.v = v; this.lastCx = v.cx; this.lastCy = v.cy; this.anim = null;
            this.lon0 = this.home.lon + 38; this.lat0 = this.home.lat - 10; const s1 = v.s; v.s = v.fit * 0.82;
            this._animTo({ lon: this.home.lon, lat: this.home.lat, s: s1 }, 1300);
        }
        if (this.anim?.done && tnow - this.anim.t0 > this.anim.dur + 3000) this.anim = null; // a focus left unfinished (tab switched) never fires later
        if (tnow - this.lastDraw > 500 && this.zoomedOut) { this.zoomedOut = false; this._animTo({ lon: this.home.lon, lat: this.home.lat, s: v.fit }, 1000); }
        this.lastDraw = tnow;
        // user pan (degrees of arc at the centre) → rotation
        const dcx = v.cx - this.lastCx, dcy = v.cy - this.lastCy; this.lastCx = v.cx; this.lastCy = v.cy;
        if (dcx || dcy) {
            if (this.anim) { this.anim = null; }
            this.lat0 = clamp(this.lat0 - dcy, -85, 85); this.lon0 = wrapLon(this.lon0 + dcx / Math.max(0.2, Math.cos(this.lat0 * D2R)));
        }
        if (this.anim) {
            const a = this.anim, k = clamp((tnow - a.t0) / a.dur, 0, 1), e = ease(k);
            let dl = wrapLon(a.to.lon - a.from.lon);
            this.lon0 = wrapLon(a.from.lon + dl * e); this.lat0 = a.from.lat + (a.to.lat - a.from.lat) * e;
            v.s = a.from.s * Math.pow(a.to.s / a.from.s, e);
            if (k >= 1) { this.anim = null; a.done?.(); }
        }
        v.s = clamp(v.s, v.fit * 0.6, v.fit * 14);
        const DW = Math.round(W * dpr), DH = Math.round(H * dpr), R = (v.s / D2R) * dpr, cx = DW / 2, cy = DH * (W < 560 ? 0.47 : 0.5);
        g.setTransform(1, 0, 0, 1, 0, 0);
        drawSpace(g, DW, DH, cx, cy, R, dpr);
        const moving = !!this.anim || dcx || dcy || this._lastS !== v.s; this._lastS = v.s;
        if (moving) this.settleAt = tnow + 220;
        const sunDate = new Date(Math.floor(now.getTime() / 30000) * 30000); // the terminator steps every 30 s (0.125°): the cached globe is not re-shaded every frame
        const pr = this.globe.render(g, { lon0: this.lon0, lat0: this.lat0, R, cx, cy, dpr, date: sunDate, W: DW, H: DH, cache: true, step: moving || tnow < this.settleAt ? Math.max(2, R / 240) : 1 });
        // route + plane looping OTP → SEA (9 s) with a short glowing trail
        drawRoute(g, pr, this.route, { upto: 1, dpr, t, glow: 0.9 });
        const ph = (t / 9) % 1, trail = 0.07;
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (let i = 0; i < 8; i++) { const f0 = Math.max(0, ph - trail * (i + 1) / 8), f1 = Math.max(0, ph - trail * i / 8); if (f1 <= f0) continue; const rp = routePath(pr, this.route, f0, f1).path; g.strokeStyle = `rgba(255,240,200,${0.5 * (1 - i / 8)})`; g.lineWidth = (4.5 - i * 0.4) * dpr; g.stroke(rp); }
        g.restore();
        { const [plon, plat] = slerpLL(PLACES.OTP, PLACES.SEA, ph), [qlon, qlat] = slerpLL(PLACES.OTP, PLACES.SEA, Math.min(1, ph + 0.01)); const [px, py, pz] = pr.P(plon, plat), [qx, qy] = pr.P(qlon, qlat); if (pz > 0.02) drawPlane(g, px, py, Math.atan2(qy - py, qx - px), dpr * (W < 560 ? 0.6 : 0.8)); }
        // airports (zoomed in: they separate from the city dots)
        if (v.s / v.fit > 3.2) for (const ap of [PLACES.OTP, PLACES.SEA]) { const [x, y, z] = pr.P(ap.lon, ap.lat); if (z <= 0) continue; g.fillStyle = '#fde68a'; g.beginPath(); g.arc(x, y, 3 * dpr, 0, TAU); g.fill(); g.font = FONT(700, 11 * dpr); g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(2,6,16,0.85)'; g.strokeText(`✈ ${ap.code}`, x + 6 * dpr, y); g.fillStyle = '#fde68a'; g.fillText(`✈ ${ap.code}`, x + 6 * dpr, y); }
        // cities
        const hits = [], small = W < 560, cities = ['bucharest', 'seattle', 'bellevue'];
        const scr = {}; for (const id of cities) scr[id] = pr.P(PLACES[id].lon, PLACES[id].lat);
        const close = Math.hypot(scr.seattle[0] - scr.bellevue[0], scr.seattle[1] - scr.bellevue[1]) < 46 * dpr;
        for (const id of cities) {
            const c = PLACES[id], p = drawDot(g, pr, c, { dpr, color: id === 'bucharest' ? '#fbbf24' : '#60a5fa', size: small ? 0.85 : 1, pulse: here === id, t });
            if (!p) continue;
            const day = isDay(c, pr.sun), n = counts[id] ?? 0;
            const sub = `${fmtTime(now, c.tz)} ${day ? '☀' : '☾'}${n ? ` · ${n} place${n === 1 ? '' : 's'}` : ''}`;
            let side = p[0] < cx ? 'left' : 'right', dy = 0;
            if (close && id !== 'bucharest') { side = scr.seattle[0] < cx ? 'left' : 'right'; dy = (id === 'seattle' ? -1 : 1) * 24 * dpr; } // stacked, away from the route
            const box = drawLabel(g, p[0], p[1], { title: `${c.flag} ${c.name}`, sub, side, dpr, W: DW, H: DH - (small ? 40 : 0) * dpr, alpha: smooth(0, 0.15, p[2]), accent: id === 'bucharest' ? '#fbbf24' : '#60a5fa', dy, size: small ? 12.5 : 14 });
            const go = () => this.focus(id, pick);
            hits.push({ tab: id, go, x0: box[0] / dpr, y0: box[1] / dpr, x1: box[2] / dpr, y1: box[3] / dpr });
            hits.push({ tab: id, go, x0: p[0] / dpr - 14, y0: p[1] / dpr - 14, x1: p[0] / dpr + 14, y1: p[1] / dpr + 14 });
        }
        // route facts (bottom-left card; one line on phones) + credit
        const diff = tzOffsetH(now, PLACES.bucharest.tz) - tzOffsetH(now, PLACES.seattle.tz);
        g.textBaseline = 'alphabetic';
        if (!small) {
            const lines = [[`✈️ OTP ⇄ SEA · ${this.km.toLocaleString('en-US')} km great circle`, FONT(600, 13.5 * dpr), '#fde68a'], ['over Greenland · one layover · ~14 h door to door', FONT(500, 12 * dpr), 'rgba(226,232,240,0.85)'],
                [`București is ${diff} h ahead of Seattle · live day / night`, FONT(500, 12 * dpr), 'rgba(148,163,184,0.95)']];
            let w = 0; for (const [s, f] of lines) { g.font = f; w = Math.max(w, g.measureText(s).width); }
            const bw = w + 28 * dpr, bh = 74 * dpr, bx = 14 * dpr, by = DH - bh - 14 * dpr;
            g.fillStyle = 'rgba(8,13,26,0.78)'; pill(g, bx, by, bw, bh, 12 * dpr); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = dpr; g.stroke();
            lines.forEach(([s, f, col], i) => { g.font = f; g.fillStyle = col; g.textAlign = 'left'; g.fillText(s, bx + 14 * dpr, by + (22 + i * 20) * dpr); });
            g.font = FONT(500, 10.5 * dpr); g.textAlign = 'right'; g.fillStyle = 'rgba(148,163,184,0.6)'; g.fillText('Natural Earth 1:50m · NASA Black Marble 2016', DW - 12 * dpr, DH - 10 * dpr);
        } else {
            g.textAlign = 'center'; g.font = FONT(600, 11.5 * dpr); g.fillStyle = '#fde68a';
            g.fillText(`✈️ ${this.km.toLocaleString('en-US')} km · over Greenland · 1 layover · ~14 h`, DW / 2, DH - 22 * dpr);
            g.font = FONT(500, 9.5 * dpr); g.fillStyle = 'rgba(148,163,184,0.65)'; g.fillText(`București +${diff} h · Natural Earth · NASA Black Marble`, DW / 2, DH - 8 * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return hits;
    }
    /** fly to a city, then hand over (the hub's city tab) */
    focus(id, pick) {
        const c = PLACES[id]; if (!c || !this.v) { pick?.(id); return; }
        if (this.anim?.done) { this.anim = null; pick?.(id); return; } // second tap while flying: go now
        this._animTo({ lon: c.lon, lat: c.lat, s: this.v.fit * 5 }, 750, () => { this.zoomedOut = true; pick?.(id); });
    }
}
