// ============================================================================
//  Ground for a spot scene: terrain from the research elevation grid (bicubic),
//  height modifiers (flatten a plaza, carve water, raise a terrace), walkable
//  surfaces (stairs, decks, a sculpture's top surface) and the painted ground:
//  a colour "splat" + a pattern mask (brick / slabs / grass / asphalt) drawn
//  from OSM areas and ways, detailed procedurally in the shader up close.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, canvas, canvasTexture, inPoly, polyBox, distSeg } from './kit.js';
import { subtractConvex, triangulate } from '../building-overlap.js';

/** three box-blur passes per axis (≈ Gaussian with σ ≈ r cells), clamped edges */
function boxBlur3(src, nx, nz, r) {
    let a = Float32Array.from(src), b = new Float32Array(src.length);
    const pass = (from, to, n, m, stride, step) => { // n lines of m samples
        for (let l = 0; l < n; l++) {
            const o = l * stride; let acc = 0;
            for (let q = -r; q <= r; q++) acc += from[o + clamp(q, 0, m - 1) * step];
            for (let q = 0; q < m; q++) { to[o + q * step] = acc / (2 * r + 1); acc += from[o + Math.min(m - 1, q + r + 1) * step] - from[o + Math.max(0, q - r) * step]; }
        }
    };
    for (let it = 0; it < 3; it++) { pass(a, b, nz, nx, nx, 1); [a, b] = [b, a]; pass(a, b, nx, nz, 1, nx); [a, b] = [b, a]; }
    return a;
}
const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

export class Ground {
    /** @param {{x0,z0,d,nx,nz,h:number[]}|null} terrain */
    constructor(terrain) {
        this.t = terrain || { x0: -100, z0: -100, d: 200, nx: 2, nz: 2, h: [0, 0, 0, 0] };
        this.mods = [];      // (x, z, h) => h
        this.waterY = null;  // set by scenes with open water: the walker can't wade in
        this.surfaces = [];  // walkable solids: { box?, poly?, hm?, top(x,z), bottom, wallAbove? }
        this.floors = [];    // exact floors: { poly, bb, y(x,z) } (see addFloor)
        this._cache = new Map();
    }
    /**
     * terrain under the modifiers: the street-conformed grid (see conform) where it exists, else the raw DEM.
     * A pending conform (SceneContext sets `pendingConform`) runs on the first height query unless the scene
     * opted out first with `ground.pendingConform = null`.
     */
    base(x, z) {
        if (this.pendingConform) { const p = this.pendingConform; this.pendingConform = null; this.conform(p, p.opts); }
        const c = this.c;
        if (c) {
            const fx = (x - c.x0) / c.d, fz = (z - c.z0) / c.d;
            if (fx >= 0 && fz >= 0 && fx <= c.nx - 1 && fz <= c.nz - 1) {
                const i = Math.min(c.nx - 2, Math.floor(fx)), j = Math.min(c.nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = j * c.nx + i, h = c.h;
                return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + c.nx] * (1 - u) + h[k + c.nx + 1] * u) * v;
            }
        }
        return this.raw(x, z);
    }
    /** raw terrain (Catmull-Rom over the research elevation grid, clamped outside) */
    raw(x, z) {
        const t = this.t;
        // Optional measured surround for a small close-up DEM. Keep every
        // original query inside that DEM unchanged; blend only outside its
        // edge over one original sample interval, then use the actual surround.
        const surround=this.sourceTerrain;
        if(surround){
            const cx=clamp(x,t.x0,t.x0+(t.nx-1)*t.d),cz=clamp(z,t.z0,t.z0+(t.nz-1)*t.d);
            if(cx!==x||cz!==z){const far=surround.heightAt(x,z);if(Number.isFinite(far)){
                const u=clamp(Math.hypot(x-cx,z-cz)/(surround.transitionM||t.d),0,1),blend=u*u*(3-2*u);
                return this.raw(cx,cz)*(1-blend)+far*blend;
            }}
        }
        const fx = clamp((x - t.x0) / t.d, 0, t.nx - 1.0001), fz = clamp((z - t.z0) / t.d, 0, t.nz - 1.0001);
        const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
        const H = (ii, jj) => t.h[clamp(jj, 0, t.nz - 1) * t.nx + clamp(ii, 0, t.nx - 1)];
        const row = (jj) => cr(H(i - 1, jj), H(i, jj), H(i + 1, jj), H(i + 2, jj), u);
        return cr(row(j - 1), row(j), row(j + 1), row(j + 2), v);
    }
    /**
     * Street-conformed ground (owner notes 48/56/68): streets, sidewalks, footways and plazas are flat across and follow
     * a smoothed profile along; the ground between streets (building lots, small yards) is the smoothed DEM shifted to
     * meet the street levels (no bicubic overshoot "blobs"); the raw DEM is kept only away from the street network
     * (parks, hills, banks: real terrain). Result: a `cell`-m grid sampled bilinearly by base().
     * @param {{lines:{pts:number[][],w:number}[], polys:number[][][], buildings?:number[][][]}} net from osm.streetBands
     */
    conform(net, { cell = 2, smooth = 14, reach = 10, maxCells = 180000, bounds = net.bounds || null } = {}) {
        const t = this.t, t0 = performance.now();
        // the grid covers the DEM ∩ bounds (the spot extents + a margin); outside it base() is the raw DEM
        const X0 = Math.max(t.x0, bounds?.x0 ?? -1e9), Z0 = Math.max(t.z0, bounds?.z0 ?? -1e9), X1 = Math.min(t.x0 + (t.nx - 1) * t.d, bounds?.x1 ?? 1e9), Z1 = Math.min(t.z0 + (t.nz - 1) * t.d, bounds?.z1 ?? 1e9);
        const W = X1 - X0, H = Z1 - Z0; if (!(W > 10 && H > 10)) return null;
        let d = cell; while ((W / d + 1) * (H / d + 1) > maxCells) d *= 1.15;
        const nx = Math.floor(W / d) + 1, nz = Math.floor(H / d) + 1, N = nx * nz, x0 = X0, z0 = Z0;
        const D = new Float32Array(N);
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) D[j * nx + i] = this.raw(x0 + i * d, z0 + j * d);
        const blur = (src, sigma) => boxBlur3(src, nx, nz, Math.max(1, Math.round(sigma / d)));
        const Ds = blur(D, smooth);
        const sDs = (x, z) => { const fx = clamp((x - x0) / d, 0, nx - 1.001), fz = clamp((z - z0) / d, 0, nz - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nx + i;
            return (Ds[k] * (1 - u) + Ds[k + 1] * u) * (1 - v) + (Ds[k + nx] * (1 - u) + Ds[k + nx + 1] * u) * v; };
        const S = new Float32Array(N), M = new Uint8Array(N), best = new Float32Array(N).fill(1e9);
        const cells = (bx0, bz0, bx1, bz1, fn) => {
            const i0 = Math.max(0, Math.floor((bx0 - x0) / d)), i1 = Math.min(nx - 1, Math.ceil((bx1 - x0) / d));
            const j0 = Math.max(0, Math.floor((bz0 - z0) / d)), j1 = Math.min(nz - 1, Math.ceil((bz1 - z0) / d));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * nx + i, x0 + i * d, z0 + j * d);
        };
        // plazas / pedestrian areas: smoothed terrain, flat-ish
        for (const poly of net.polys || []) { if (!poly || poly.length < 3) continue; const b = polyBox(poly);
            cells(b.x0, b.z0, b.x1, b.z1, (k, x, z) => { if (inPoly(x, z, poly)) { S[k] = Ds[k]; M[k] = 1; best[k] = 1e6; } }); }
        // street bands: centreline profile = smoothed DEM averaged ±12 m along the way, flat across the band
        for (const L of net.lines || []) {
            const pts = L.pts, hw = L.w / 2; if (!(hw > 0.3)) continue;
            const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
            const len = cum[cum.length - 1]; if (!(len > 0.5)) continue;
            const ns = Math.max(2, Math.ceil(len / 4) + 1), prof = new Float32Array(ns), at = (s) => { let i = 1; while (i < pts.length - 1 && cum[i] < s) i++; const u = clamp((s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), 0, 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]; };
            const raw = []; for (let q = 0; q < ns; q++) { const [x, z] = at(len * q / (ns - 1)); raw.push(sDs(x, z)); }
            for (let q = 0; q < ns; q++) { let a = 0, n = 0; for (let r = -3; r <= 3; r++) { const qq = q + r; if (qq >= 0 && qq < ns) { a += raw[qq]; n++; } } prof[q] = a / n; }
            const yAt = (s) => { const f = clamp(s / len, 0, 1) * (ns - 1), q = Math.min(ns - 2, Math.floor(f)); return prof[q] + (prof[q + 1] - prof[q]) * (f - q); };
            for (let si = 1; si < pts.length; si++) {
                const [ax, az] = pts[si - 1], [bx, bz] = pts[si];
                const sx = bx - ax, sz = bz - az, sl = sx * sx + sz * sz || 1e-9, lim = hw + d * 0.5, s0 = cum[si - 1], s1 = cum[si];
                const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - lim - x0) / d)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + lim - x0) / d));
                const j0 = Math.max(0, Math.floor((Math.min(az, bz) - lim - z0) / d)), j1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz) + lim - z0) / d));
                for (let j = j0; j <= j1; j++) { const z = z0 + j * d; for (let i = i0; i <= i1; i++) {
                    const x = x0 + i * d; let u = ((x - ax) * sx + (z - az) * sz) / sl; u = u < 0 ? 0 : u > 1 ? 1 : u;
                    const ex = x - ax - sx * u, ez = z - az - sz * u, dd = Math.sqrt(ex * ex + ez * ez); if (dd > lim) continue;
                    const k = j * nx + i, key = dd / hw; if (key >= best[k]) continue;
                    best[k] = key; S[k] = yAt(s0 + (s1 - s0) * u); M[k] = 1;
                } }
            }
        }
        // building footprints are never "real terrain" (the lot follows its streets)
        const B = new Uint8Array(N);
        for (const poly of net.buildings || []) { if (!poly || poly.length < 3) continue; const b = polyBox(poly); cells(b.x0, b.z0, b.x1, b.z1, (k, x, z) => { if (inPoly(x, z, poly)) B[k] = 1; }); }
        // residual street level − smoothed terrain (smoothed within the network: no steps between bands / at junctions),
        // spread off-street by normalised convolution
        const RM = new Float32Array(N), Mf = new Float32Array(N);
        for (let k = 0; k < N; k++) if (M[k]) { RM[k] = S[k] - Ds[k]; Mf[k] = 1; }
        { const a = blur(RM, 4), w = blur(Mf, 4); for (let k = 0; k < N; k++) if (M[k]) { RM[k] = a[k] / w[k]; S[k] = Ds[k] + RM[k]; } }
        const Nr = blur(RM, reach), Wm = blur(Mf, reach), Wf = blur(Mf, reach * 2.5);
        const out = new Float32Array(N);
        for (let k = 0; k < N; k++) {
            if (M[k]) { out[k] = S[k]; continue; }
            const nat = B[k] ? 0 : clamp(1 - Wf[k] / 0.06, 0, 1); // far from every street: the real (raw) terrain
            const a = clamp(Wm[k] / 0.04, 0, 1), rf = Wm[k] > 1e-4 ? Nr[k] / Wm[k] : 0;
            out[k] = Ds[k] + (D[k] - Ds[k]) * nat + rf * a * (1 - nat);
        }
        if (bounds) { const m = Math.max(2, Math.round(30 / d)); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const e = Math.min(i, j, nx - 1 - i, nz - 1 - j); if (e >= m) continue; const k = j * nx + i, w = e / m; out[k] = D[k] + (out[k] - D[k]) * w * w * (3 - 2 * w); } }
        this.c = { x0, z0, d, nx, nz, h: out, streets: M };
        this.timing = { ...this.timing, conform: Math.round(performance.now() - t0) };
        this._cache?.clear?.();
        return this.c;
    }
    /**
     * Settle the lots onto the scene's own street levels: where scene modifiers registered so far re-graded the
     * street network (a curated street profile, a cut, a plaza), the untouched ground next to it follows that
     * change, fading over ~`reach` m — no mound or trench where a curated street meets the raw lots.
     * Called once by SceneContext.osmBackdrop() (before buildings are placed); idempotent.
     */
    settle({ reach = 14, min = 0.08 } = {}) {
        if (this._settled) return; this._settled = true;
        this.base(0, 0); const c = this.c; if (!c || !this.mods.length) return; const t0 = performance.now();
        const { nx, nz, d, x0, z0 } = c, N = nx * nz, R = new Float32Array(N), Wt = new Float32Array(N); let any = false;
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!c.streets[k]) continue; const x = x0 + i * d, z = z0 + j * d, dh = this.heightAt(x, z) - c.h[k]; if (Math.abs(dh) < min) continue; R[k] = dh; Wt[k] = 1; any = true; }
        if (!any) return;
        const r = Math.max(1, Math.round(reach / d)), Nr = boxBlur3(R, nx, nz, r), Wm = boxBlur3(Wt, nx, nz, r), F = new Float32Array(N);
        for (let k = 0; k < N; k++) if (Wm[k] > 1e-4) F[k] = (Nr[k] / Wm[k]) * clamp(Wm[k] / 0.12, 0, 1); // untouched streets + lots
        this.settleField = F; this.timing = { ...this.timing, settle: Math.round(performance.now() - t0) };
        // Adjust the underlying lots, then replay the authored street/plaza
        // modifiers. Their full-strength interiors keep their exact grades and
        // their existing blend weights continuously attenuate this residual.
        // A height-difference cutoff here creates a cliff where a blend crosses
        // that cutoff, even when the original terrain and modifier are smooth.
        this.mods.unshift((x, z, h) => {
            const fx = (x - x0) / d, fz = (z - z0) / d; if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return h;
            const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = j * nx + i;
            return h + (F[k] * (1 - u) + F[k + 1] * u) * (1 - v) + (F[k + nx] * (1 - u) + F[k + nx + 1] * u) * v;
        });
    }
    /** is (x, z) on the conformed street network (carriageway, sidewalk, footway, plaza)? */
    onStreet(x, z) { const c = this.c; if (!c) return false; const i = Math.round((x - c.x0) / c.d), j = Math.round((z - c.z0) / c.d); return i >= 0 && j >= 0 && i < c.nx && j < c.nz && c.streets[j * c.nx + i] === 1; }
    /**
     * An exact floor: inside `poly` the walking surface is y(x, z) with a sharp edge (a sunken ramp below a retaining
     * wall, an alley under a building), which the 2 m terrain grid cannot draw. heightAt() keeps the ground around it
     * (the top of its walls); the scene cuts the same ring out of the terrain (terrainOpts.cutouts) and draws the floor.
     */
    addFloor(poly, y) { this.floors.push({ poly, bb: polyBox(poly), y: typeof y === 'function' ? y : () => y }); }
    floorAt(x, z) { for (const f of this.floors) { const b = f.bb; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(x, z, f.poly)) return f.y(x, z); } return null; }
    /** terrain + modifiers (the visible ground) */
    heightAt(x, z) { let h = this.base(x, z); for (const m of this.mods) h = m(x, z, h); return h; }
    /** Physical floor: use the emitted terrain triangles once buildTerrain exists. */
    terrainHeightAt(x, z) { if (this.floors.length) { const f = this.floorAt(x, z); if (f !== null) return f; } return this.renderedHeightAt?.(x, z) ?? this.sourceTerrain?.renderedHeightAt?.(x,z) ?? this.heightAt(x, z); }
    waterHeightAt(x,z) { return this.sourceTerrain?.waterAt ? this.sourceTerrain.waterAt(x,z) : this.waterY; }
    /** add a modifier (x,z,h)=>h */
    mod(fn) { this.mods.push(fn); return this; }
    /** flatten inside a polygon to y (number) or to the polygon's mean height; `edge` m blend outside */
    flatten(poly, y = null, edge = 6) {
        const bb = polyBox(poly);
        if (y === null) { let s = 0; for (const [x, z] of poly) s += this.heightAt(x, z); y = s / poly.length; }
        const yy = y;
        this.mod((x, z, h) => {
            if (x < bb.x0 - edge || x > bb.x1 + edge || z < bb.z0 - edge || z > bb.z1 + edge) return h;
            if (inPoly(x, z, poly)) return yy;
            if (edge <= 0) return h;
            let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d);
            if (d >= edge) return h;
            const k = d / edge, s = k * k * (3 - 2 * k);
            return yy + (h - yy) * s;
        });
        return yy;
    }
    /** a corridor along a polyline [[x,z]] flattened across (keeps its slope along); w = width, edge = blend */
    corridor(pts, w, edge = 5, yFn = null) {
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
        const bb = { x0: Math.min(...xs) - w - edge, x1: Math.max(...xs) + w + edge, z0: Math.min(...zs) - w - edge, z1: Math.max(...zs) + w + edge };
        const ys = pts.map(([x, z]) => (yFn ? yFn(x, z) : this.heightAt(x, z)));
        this.mod((x, z, h) => {
            if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) return h;
            let best = null, sum = 0, weight = 0, centreY = null;
            const reach = w / 2 + edge;
            for (let i = 1; i < pts.length; i++) {
                const r = distSeg(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
                if (!best || r.d < best.d) best = r;
                const y = ys[i - 1] + (ys[i] - ys[i - 1]) * r.t;
                if (r.d < 1e-9) { centreY = y; continue; }
                // Compact inverse-distance interpolation joins the profiles at
                // bends. A nearest-leg switch can otherwise jump between two
                // different stations on the inside of the same wide corridor.
                if (r.d < reach) { const q = (reach - r.d) / (reach * r.d), a = q * q; sum += y * a; weight += a; }
            }
            if (best.d > w / 2 + edge) return h;
            const yc = centreY ?? (weight > 0 ? sum / weight : h);
            if (best.d <= w / 2) return yc;
            const k = (best.d - w / 2) / edge, s = k * k * (3 - 2 * k);
            return yc + (h - yc) * s;
        });
    }
    // ---------------------------------------------------------------- walkable solids
    /** oriented box solid from y0 to y1 (stairs, planters, decks, benches you can jump on); angle = the mesh rotation.y (local z = long axis hd) */
    addBox(x, z, hw, hd, angle, y0, y1, o = {}) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const s2 = { kind: 'box', x, z, hw, hd, angle, bottom: y0, r: Math.hypot(hw, hd), ...o,
            contains: (px, pz) => { const dx = px - x, dz = pz - z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= hw && Math.abs(lz) <= hd; },
            top: () => y1 };
        this.surfaces.push(s2); return s2;
    }
    /** polygon solid with a top height function (or number) */
    addPoly(poly, top, bottom = -1e3, o = {}) {
        const bb = polyBox(poly), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
        const s2 = { kind: 'poly', x: cx, z: cz, r: Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2, bottom, poly, ...o,
            contains: (px, pz) => px >= bb.x0 && px <= bb.x1 && pz >= bb.z0 && pz <= bb.z1 && inPoly(px, pz, poly),
            top: typeof top === 'function' ? top : () => top };
        this.surfaces.push(s2); return s2;
    }
    /** a sculpture's top-surface heightmap (sdfHeightmap result) placed with offset (ox, oy, oz) and yaw ry. Steep cells act as walls. */
    addHeightmap(hm, ox = 0, oy = 0, oz = 0, ry = 0, { maxSlope = 1.25, bottom = null } = {}) {
        const c = Math.cos(ry), s = Math.sin(ry);
        // slope per cell (max rise to a neighbour / cell)
        const steep = new Uint8Array(hm.nx * hm.nz);
        for (let j = 0; j < hm.nz; j++) for (let i = 0; i < hm.nx; i++) {
            const a = hm.h[i + j * hm.nx]; if (Number.isNaN(a)) continue;
            let m = 0;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= hm.nx || jj >= hm.nz) continue;
                const b = hm.h[ii + jj * hm.nx]; m = Math.max(m, Number.isNaN(b) ? a / hm.d : Math.abs(a - b) / hm.d);
            }
            if (m > maxSlope) steep[i + j * hm.nx] = 1;
        }
        const toLocal = (px, pz) => { const dx = px - ox, dz = pz - oz; return [dx * c - dz * s, dx * s + dz * c]; };
        const x1 = hm.x0 + (hm.nx - 1) * hm.d, z1 = hm.z0 + (hm.nz - 1) * hm.d;
        const s2 = {
            kind: 'hm', x: ox, z: oz, r: Math.hypot(Math.max(-hm.x0, x1), Math.max(-hm.z0, z1)) + 1, bottom: bottom ?? oy, hm,
            contains: (px, pz) => { const [lx, lz] = toLocal(px, pz); return lx >= hm.x0 && lz >= hm.z0 && lx <= x1 && lz <= z1 && !Number.isNaN(hm.at(lx, lz)); },
            top: (px, pz) => { const [lx, lz] = toLocal(px, pz); return hm.at(lx, lz) + oy; },
            steepAt: (px, pz) => { const [lx, lz] = toLocal(px, pz); const i = Math.round((lx - hm.x0) / hm.d), j = Math.round((lz - hm.z0) / hm.d); return i >= 0 && j >= 0 && i < hm.nx && j < hm.nz && steep[i + j * hm.nx] === 1; },
        };
        this.surfaces.push(s2); return s2;
    }
    /** nearest walkable (not deep-water) point to (x, z), searching outward in rings (for spawns / challenge poses) */
    nearestDry(x, z, maxR = 80) {
        const ok = (px, pz) => { const g = this.groundAt(px, pz, this.heightAt(px, pz) + 1); return g < this.heightAt(px, pz) + 40; };
        if (ok(x, z)) return { x, z };
        for (let r = 2; r <= maxR; r += 2) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return { x: px, z: pz }; }
        return { x, z };
    }
    /**
     * what the walker stands on at (x, z) with feet at y: terrain or the highest walkable solid whose bottom is
     * at most ~head height above the feet (so a bridge deck overhead is ignored); steep sculpture cells above the
     * feet act as walls (a huge value → the controller refuses the move).
     */
    /** Physical support for aircraft. Walker water/steep barriers use y + 50;
     * that movement sentinel must never become an aircraft's ground altitude. */
    flightHeightAt(x, z, y = 0) {
        let g = this.terrainHeightAt(x, z);
        for (const s of this.surfaces) {
            if (Math.abs(x - s.x) > s.r || Math.abs(z - s.z) > s.r || s.bottom > y + 1.6 || !s.contains(x, z)) continue;
            const t = s.top(x, z); if (Number.isFinite(t) && t > g) g = t;
        }
        const water=this.waterHeightAt(x,z);if (Number.isFinite(water)) g = Math.max(g, water);
        return g;
    }
    groundAt(x, z, y = 0) {
        let g = this.terrainHeightAt(x, z);
        for (const s of this.surfaces) {
            if (Math.abs(x - s.x) > s.r || Math.abs(z - s.z) > s.r) continue;
            if (s.bottom > y + 1.6) continue;
            if (!s.contains(x, z)) continue;
            const t = s.top(x, z); if (!Number.isFinite(t)) continue;
            if (s.steepAt && s.steepAt(x, z) && t > y + 0.35) return y + 50;
            if (t > g) g = t;
        }
        // deep water is not walkable (piers / decks above it are, through the surfaces)
        const water=this.waterHeightAt(x,z);if (water !== null && water !== undefined && g < water - 0.5) return y + 50;
        return g;
    }
}

// ============================================================================
//  Splat painter: records draw ops in world metres, replays them onto canvases
// ============================================================================
// mask weights live in RGB only (canvas alpha is premultiplied): R brick (cobble at half), G slab joints (wood at half), B grass (dirt at half); black = asphalt grain
const MASK = { brick: [255, 0, 0], cobble: [120, 0, 0], slab: [0, 255, 0], wood: [0, 120, 0], grass: [0, 0, 255], dirt: [0, 0, 120], asphalt: [0, 0, 0], none: [0, 0, 0] };

export class Painter {
    constructor() { this.ops = []; }
    poly(poly, color, mask = 'none', holes = null) { if (poly?.length > 2) this.ops.push({ t: 'poly', poly, color, mask, holes }); return this; }
    line(pts, w, color, mask = 'none', o = {}) { if (pts?.length > 1) this.ops.push({ t: 'line', pts, w, color, mask, dash: o.dash || null, cap: o.cap || 'round', join: o.join || 'round' }); return this; }
    circle(x, z, r, color, mask = 'none') { this.ops.push({ t: 'circle', x, z, r, color, mask }); return this; }
    /** custom: fn(ctx, toPx(x,z)→[px,py], scale px/m, isMask) */
    custom(fn) { this.ops.push({ t: 'fn', fn }); return this; }
    /** replay onto a colour canvas and a mask canvas covering [x0,z0]–[x0+W, z0+H] */
    render(x0, z0, W, H, colorPx, maskPx, bg = '#6b7a4f', bgMask = 'grass') {
        const out = [];
        for (const [px, isMask] of [[colorPx, false], [maskPx, true]]) {
            if (!px) { out.push(null); continue; }
            const ph = Math.round(px * H / W), c = canvas(px, ph), g = c.getContext('2d');
            const k = px / W, T = (x, z) => [(x - x0) * k, (z - z0) * k];
            g.fillStyle = isMask ? rgba(MASK[bgMask]) : bg; g.fillRect(0, 0, px, ph);
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (const o of this.ops) {
                if (o.t === 'fn') { g.save(); o.fn(g, T, k, isMask); g.restore(); continue; }
                const col = isMask ? rgba(MASK[o.mask] || MASK.none) : o.color;
                if (!col) continue;
                if (o.t === 'poly') {
                    g.beginPath();
                    for (const ring of [o.poly, ...(o.holes || [])]) ring.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
                    g.fillStyle = col; g.fill('evenodd');
                } else if (o.t === 'line') {
                    g.beginPath(); o.pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
                    g.strokeStyle = col; g.lineWidth = Math.max(isMask ? 0.6 : 0.8, o.w * k); g.lineCap = o.cap; g.lineJoin = o.join;
                    if (o.dash) g.setLineDash(o.dash.map((v) => v * k)); else g.setLineDash([]);
                    g.stroke();
                } else if (o.t === 'circle') {
                    const [a, b] = T(o.x, o.z); g.beginPath(); g.arc(a, b, Math.max(0.5, o.r * k), 0, Math.PI * 2); g.fillStyle = col; g.fill();
                }
            }
            out.push(c);
        }
        return out;
    }
}
function rgba(m) { return `rgb(${m[0]},${m[1]},${m[2]})`; }

// ============================================================================
//  Ground material: splat colour × procedural detail by mask (brick, slabs, grass, asphalt)
// ============================================================================
export function groundMaterial(colorTex, maskTex, { brickAngle = 0, name = 'groundPlane' } = {}) {
    const m = new THREE.MeshStandardMaterial({ map: colorTex, roughness: 0.93, metalness: 0 });
    m.name = name;
    const U = { uMask: { value: maskTex }, uBrickRot: { value: new THREE.Vector2(Math.cos(brickAngle), Math.sin(brickAngle)) } };
    m.userData.spotU = U;
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSpotW;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvSpotW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            varying vec3 vSpotW; uniform sampler2D uMask; uniform vec2 uBrickRot;
            float sH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float sN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
                return mix(mix(sH(i), sH(i+vec2(1,0)), f.x), mix(sH(i+vec2(0,1)), sH(i+vec2(1,1)), f.x), f.y); }`)
            .replace('#include <map_fragment>', `#include <map_fragment>
            {
                vec4 mk = texture2D(uMask, vMapUv);
                vec2 w = vSpotW.xz;
                float dist = length(vSpotW - cameraPosition);
                float near = 1.0 - smoothstep(18.0, 45.0, dist), mid = 1.0 - smoothstep(35.0, 110.0, dist);
                float k = 1.0;
                // everywhere: low-frequency mottling so big flat areas are never uniform
                k *= 0.93 + 0.14 * sN(w * 0.35) + 0.05 * (sN(w * 2.3) - 0.5);
                // brick / pavers (running bond 0.20 × 0.10 m)
                if (mk.r > 0.02) {
                    float cob = 1.0 - smoothstep(0.55, 0.75, mk.r); // half-weight red = cobbles / setts
                    vec2 q = vec2(dot(w, uBrickRot), dot(w, vec2(-uBrickRot.y, uBrickRot.x)));
                    vec2 b = q / mix(vec2(0.205, 0.102), vec2(0.16, 0.13), cob); b.x += 0.5 * mod(floor(b.y), 2.0);
                    vec2 f = fract(b), id = floor(b);
                    float mortar = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.12, f.y) * smoothstep(1.0, 0.88, f.y);
                    float tint = 0.82 + 0.3 * sH(id) - 0.08 * step(0.8, sH(id + 7.0));
                    float br = mix(0.62, tint, mortar);
                    k *= mix(1.0, br, clamp(mk.r * 1.6, 0.0, 1.0) * mix(0.35, 1.0, near));
                }
                // concrete slabs with joints (≈1.5 m)
                if (mk.g > 0.02) {
                    float wood = 1.0 - smoothstep(0.55, 0.75, mk.g);
                    vec2 f = fract(w / mix(vec2(1.52), vec2(0.14, 6.0), wood)), id = floor(w / 1.52);
                    float j = smoothstep(0.0, 0.012, f.x) * smoothstep(1.0, 0.988, f.x) * smoothstep(0.0, 0.012, f.y) * smoothstep(1.0, 0.988, f.y);
                    float sl = (0.95 + 0.1 * sH(id)) * mix(0.78, 1.0, j);
                    sl *= 0.97 + 0.06 * sN(w * 6.0);
                    k *= mix(1.0, sl, mk.g * mix(0.3, 1.0, mid));
                }
                // grass: clumps + blades shimmer
                if (mk.b > 0.02) {
                    float gN = 0.78 + 0.3 * sN(w * 1.7) + 0.16 * (sN(w * 11.0) - 0.5) * near + 0.12 * (sH(floor(w * 24.0)) - 0.5) * near;
                    k *= mix(1.0, gN, mk.b);
                }
                // asphalt grain + patches
                float asph = 1.0 - clamp((mk.r + mk.g + mk.b) * 3.0, 0.0, 1.0);
                if (asph > 0.02) {
                    float aN = 0.9 + 0.12 * sN(w * 0.8) + 0.1 * (sH(floor(w * 30.0)) - 0.5) * near;
                    k *= mix(1.0, aN, asph);
                }
                diffuseColor.rgb *= k;
            }`);
    };
    m.customProgramCacheKey = () => 'spotGround1';
    return m;
}

/**
 * Terrain meshes: an inner patch (fine grid, high-res splat) and an outer apron (coarse grid, low-res splat)
 * with the inner rectangle cut out. Returns { group, inner, outer, materials[] }.
 */
export function buildTerrain(ground, painter, { inner, outer, innerPx = 2048, outerPx = 1024, innerStep = 2, outerStep = 8, bg = '#6b7a4f', bgMask = 'grass', brickAngle = 0, skirt = 0, skirtY = null, skirtColor = null, cutouts = [] }) {
    // Cutouts (rings of [x, z] inside the inner box, e.g. a lake): the inner grid is cut exactly along them, so a scene can
    // build its own edge (a stone kerb, a basin) without the grid's 2-3 m cells drawing a jagged, stepped bank across it.
    const cutTris = [];
    for (const poly of cutouts || []) for (const t of triangulate(poly) || []) { const xs = t.map(p => p[0]), zs = t.map(p => p[1]); cutTris.push({ t, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }); }
    const grp = new THREE.Group(); grp.name = 'terrain';
    const mats = [];
    const mk = (box, px, step, hole) => {
        const W = box.x1 - box.x0, H = box.z1 - box.z0;
        const [cc, mc] = painter.render(box.x0, box.z0, W, H, px, Math.round(px / 2), bg, bgMask);
        const ct = canvasTexture(cc, { aniso: 8 }), mt = canvasTexture(mc, { srgb: false, aniso: 4 });
        const m = groundMaterial(ct, mt, { brickAngle }); mats.push(m);
        const nx = Math.round(W / step), nz = Math.round(H / step);
        const pos = [], uv = [], idx = [], vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
        const insideHole = (x, z) => hole && x > hole.x0 + 0.01 && x < hole.x1 - 0.01 && z > hole.z0 + 0.01 && z < hole.z1 - 0.01;
        const vert = (i, j) => {
            const id = i + j * (nx + 1); if (vid[id] >= 0) return vid[id];
            const x = box.x0 + i * W / nx, z = box.z0 + j * H / nz;
            vid[id] = pos.length / 3; pos.push(x, ground.heightAt(x, z), z); uv.push(i / nx, 1 - j / nz); return vid[id];
        };
        const cuts = hole ? [] : cutTris, free = new Map();
        const freeVert = (x, z) => { const key = Math.round(x * 1000) + ',' + Math.round(z * 1000); let v = free.get(key); if (v === undefined) { v = pos.length / 3; pos.push(x, ground.heightAt(x, z), z); uv.push((x - box.x0) / W, 1 - (z - box.z0) / H); free.set(key, v); } return v; };
        const sArea = p => { let s = 0; for (let k = 0; k < p.length; k++) { const [x1, z1] = p[k], [x2, z2] = p[(k + 1) % p.length]; s += x1 * z2 - x2 * z1; } return s; };
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const xa = box.x0 + i * W / nx, za = box.z0 + j * H / nz, xb = xa + W / nx, zb = za + H / nz;
            if (insideHole((xa + xb) / 2, (za + zb) / 2)) continue;
            const hits = cuts.length ? cuts.filter(q => q.x1 > xa && q.x0 < xb && q.z1 > za && q.z0 < zb) : null;
            if (!hits?.length) { const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1); idx.push(a, d, b, b, d, c); continue; }
            // the cell's two triangles minus every cutout triangle over it; corners keep their grid vertex, made only when a
            // kept piece uses them (a corner inside the cut would be an unused vertex with a zero normal: sea-spots-a-9)
            const cv = { [`${xa},${za}`]: [i, j], [`${xb},${za}`]: [i + 1, j], [`${xb},${zb}`]: [i + 1, j + 1], [`${xa},${zb}`]: [i, j + 1] };
            const corner = { get: (k) => cv[k] ? vert(...cv[k]) : undefined };
            for (const tri of [[[xa, za], [xa, zb], [xb, za]], [[xb, za], [xa, zb], [xb, zb]]]) {
                let pieces = [tri]; const want = Math.sign(sArea(tri));
                for (const h of hits) { pieces = pieces.flatMap(p => subtractConvex(p, h.t)); if (!pieces.length) break; }
                for (const p of pieces) {
                    const id = ([x, z]) => corner.get(`${x},${z}`) ?? freeVert(x, z), flip = Math.sign(sArea(p)) !== want;
                    for (let k = 1; k < p.length - 1; k++) {
                        // a sliver of the cut (zero-area fan triangle, collinear points) is dropped before its vertices are made,
                        // so no unused vertex is left with a zero normal (sea-spots-a-9, waterfront coastline cut)
                        if (Math.abs(sArea([p[0], p[k], p[k + 1]])) < 1e-6) continue;
                        const t = [id(p[0]), id(p[k]), id(p[k + 1])]; if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue; idx.push(...(flip ? [t[0], t[2], t[1]] : t)); }
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const pos32 = g.attributes.position.array;
        g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'groundPlane';
        // The walking floor must use these same Float32 triangles, rather than
        // evaluating a curved modifier between their vertices. That analytic
        // surface can sit above or below the pavement actually drawn here.
        mesh.userData.heightAt = (x, z) => {
            if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) return null;
            const ci = Math.min(nx - 1, Math.floor((x - box.x0) * nx / W));
            const cj = Math.min(nz - 1, Math.floor((z - box.z0) * nz / H));
            if (insideHole(box.x0 + (ci + .5) * W / nx, box.z0 + (cj + .5) * H / nz)) return null;
            // corner heights as the Float32 grid vertices hold them (a corner inside a cutout has no vertex: same value)
            const Y = (i, j) => { const id = vid[i + j * (nx + 1)]; return id >= 0 ? pos32[id * 3 + 1] : Math.fround(ground.heightAt(box.x0 + i * W / nx, box.z0 + j * H / nz)); };
            const xa = box.x0 + ci * W / nx, za = box.z0 + cj * H / nz, u = (x - xa) / (W / nx), v = (z - za) / (H / nz);
            const ya = Y(ci, cj), yb = Y(ci + 1, cj), yd = Y(ci, cj + 1), yc = Y(ci + 1, cj + 1);
            return u + v <= 1 ? ya * (1 - u - v) + yb * u + yd * v
                : yc * (u + v - 1) + yd * (1 - u) + yb * (1 - v);
        };
        return mesh;
    };
    const i = mk(inner, innerPx, innerStep, null), o = mk(outer, outerPx, outerStep, inner); // (cutouts: inner grid only)
    i.name = 'terrain-inner'; o.name = 'terrain-outer';
    ground.renderedHeightAt = (x, z) => i.userData.heightAt(x, z) ?? o.userData.heightAt(x, z);
    grp.add(i, o);
    if (skirt > 0) { // a far apron disc so the horizon never shows a gap
        const g = new THREE.RingGeometry(Math.max(outer.x1 - outer.x0, outer.z1 - outer.z0) * 0.7, skirt, 48, 1); g.rotateX(-Math.PI / 2);
        const cx = (outer.x0 + outer.x1) / 2, cz = (outer.z0 + outer.z1) / 2;
        const m = new THREE.MeshStandardMaterial({ color: skirtColor || bg, roughness: 1 }); m.name = 'groundPlane'; mats.push(m);
        const ring = new THREE.Mesh(g, m); ring.position.set(cx, skirtY ?? ground.heightAt(cx, cz) - 2, cz); ring.name = 'terrain-apron'; grp.add(ring);
    }
    return { group: grp, inner: i, outer: o, materials: mats };
}
