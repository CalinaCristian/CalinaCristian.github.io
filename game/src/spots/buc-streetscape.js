// ============================================================================
//  Bucharest spot streetscape helpers (fidelity pass 2026-11-12): what OSM maps
//  but the scenes did not show. Mapped tree heights, name signs for mapped
//  venues on their own facade, busts / statues at their mapped nodes, clipped
//  hedges along promenade alleys. Positions and names come from the scene data
//  (OSM); sizes, colours and lettering are estimates and say so where used.
// ============================================================================
import { rng, polyBox, inPoly, distPolyline } from './kit.js';

const key = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);

/**
 * Mapped trees (OSM natural=tree) carry their surveyed height as the 5th tuple entry: size each crown by it instead of one
 * nominal size. Generated street / park trees within `near` m of a mapped tree are dropped: where the survey covers a
 * street, it is the tree list. Returns { sized, dropped }.
 */
export function mappedTreeSizes(ctx, { base = 8.5, near = 16, min = 0.45, max = 2.6, minMapped = 60 } = {}) {
    const H = new Map(); for (const t of ctx.data.trees) H.set(key(t[0], t[1]), parseFloat(t[4]) || 0);
    if (H.size < minMapped) return { sized: 0, dropped: 0 };
    const cell = near, grid = new Set(); for (const t of ctx.data.trees) grid.add(Math.floor(t[0] / cell) + ',' + Math.floor(t[1] / cell));
    const nearMapped = (x, z) => { const i = Math.floor(x / cell), j = Math.floor(z / cell); for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (grid.has((i + a) + ',' + (j + c))) return true; return false; };
    let sized = 0, dropped = 0;
    ctx.trees = ctx.trees.filter((t) => {
        if (t.willow || t.keep) return true;
        const k = key(t.x, t.z);
        if (H.has(k)) { const h = H.get(k); if (h > 0 && !t.sy) { t.s = Math.max(min, Math.min(max, h / base)); sized++; } return true; }
        if (nearMapped(t.x, t.z)) { dropped++; return false; }
        return true;
    });
    return { sized, dropped };
}

// well-known brands on Bucharest fronts: [background, lettering] (the brands' own public colours; everything else is a neutral estimate)
const BRAND = [[/starbucks/i, '#00704a', '#ffffff'], [/raiffeisen/i, '#ffe600', '#1a1a1a'], [/unicredit/i, '#e2001a', '#ffffff'], [/cec bank/i, '#0a6b3a', '#ffffff'], [/\bbcr\b/i, '#0b3d91', '#ffffff'],
    [/mega image/i, '#c8102e', '#ffffff'], [/libra/i, '#1d4f91', '#ffffff'], [/intesa/i, '#0b6b3a', '#ffffff'], [/first bank/i, '#0c2c56', '#ffffff'], [/vodafone/i, '#e60000', '#ffffff'], [/digi\b/i, '#0057b8', '#ffffff'],
    [/humanitas/i, '#7a1f1f', '#f4ecd8'], [/cărturești/i, '#f7f6f2', '#2f6b3a'], [/sephora/i, '#111111', '#ffffff'], [/hugo boss/i, '#111111', '#ffffff'], [/samsonite/i, '#12284c', '#ffffff'], [/subway/i, '#00833e', '#ffc20d'],
    [/superbet/i, '#d5001c', '#ffffff'], [/radisson/i, '#3a3f44', '#ffffff'], [/intercontinental|athénée/i, '#2b2622', '#e8d9a8'], [/froo/i, '#e4002b', '#ffffff'], [/help net/i, '#00824a', '#ffffff'], [/shop&go/i, '#c8102e', '#ffffff']];
const NEUTRAL = [['#1d2a24', '#f1e6c8'], ['#2a1d1a', '#e8c870'], ['#1a2230', '#ffffff'], ['#3b2a1e', '#f1e6c8'], ['#0f0f10', '#ffffff'], ['#5a1e22', '#f1e6c8'], ['#efe9dc', '#2a2a2a'], ['#23303a', '#e8e0cc']];

/**
 * Name signs for mapped venues (POI nodes, or named buildings passed in `extra`) on the facade of the building that holds
 * them, on the side facing the nearest street. One sign per venue; a sign never overlaps another on the same front (it
 * slides along the wall, then takes a second row, else it is left out and listed in `skipped`).
 * o: { accept(p), inside(x,z), taken: [{x,z,w}], y, max, seed, streets, extra: [{id,name,x,z,big}] }
 * → { signs: [...for signAtlas], skipped: [ids] }
 */
export function poiSigns(ctx, o = {}) {
    const d = ctx.data, r = rng(o.seed || 17), g = ctx.ground, signs = [], skipped = [];
    const streets = o.streets || d.ways.filter((w) => ['pedestrian', 'living_street', 'residential', 'tertiary', 'secondary', 'primary', 'unclassified'].includes(w.k) && !w.tunnel && w.pts.length > 1);
    const blds = d.buildings.filter((b) => !b.part && b.poly?.length > 2).map((b) => ({ b, bb: polyBox(b.poly) }));
    const taken = [...(o.taken || [])].map((t) => ({ x: t.x, z: t.z, w: t.w || 3, y: t.y ?? null }));
    const list = [...(o.extra || []), ...ctx.data.pois.filter((p) => p.name && (!o.accept || o.accept(p)))];
    for (const p of list) {
        if (o.inside && !o.inside(p.x, p.z)) continue;
        if (signs.length >= (o.max || 90)) { skipped.push(p.id); continue; }
        let host = null, hd = 7;
        for (const { b, bb } of blds) {
            if (p.x < bb.x0 - 7 || p.x > bb.x1 + 7 || p.z < bb.z0 - 7 || p.z > bb.z1 + 7) continue;
            if (inPoly(p.x, p.z, b.poly)) { host = b; hd = 0; break; }
            const q = distPolyline(p.x, p.z, [...b.poly, b.poly[0]]); if (q.d < hd) { hd = q.d; host = b; }
        }
        if (!host) { skipped.push(p.id); continue; }
        let st = null; for (const w of streets) { const q = distPolyline(p.x, p.z, w.pts); if (!st || q.d < st.d) st = q; }
        if (!st || st.d > 60) { skipped.push(p.id); continue; }
        const text = String(p.name).replace(/\s+/g, ' ').trim(), big = !!p.big;
        const W0 = Math.min(big ? 9 : 5.5, (big ? 1.6 : 1.2) + text.length * (big ? 0.36 : 0.28)), Hs = big ? 0.9 : 0.62;
        // the wall: among the host's edges that face the street point, the one nearest the venue node
        const poly = host.poly, n = poly.length; let best = null;
        for (let i = 0; i < n; i++) {
            const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez); if (L < 2.2) continue;
            let nx = ez / L, nz = -ex / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
            if (inPoly(mx + nx * 0.6, mz + nz * 0.6, poly)) { nx = -nx; nz = -nz; } // (outward normal)
            const face = ((st.cx - mx) * nx + (st.cz - mz) * nz) / (Math.hypot(st.cx - mx, st.cz - mz) || 1); if (face < 0.35) continue;
            const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (L * L))), dd = Math.hypot(p.x - ax - ex * t, p.z - az - ez * t);
            const score = dd + (1 - face) * 6; if (!best || score < best.score) best = { score, ax, az, ex: ex / L, ez: ez / L, L, t: t * L, nx, nz };
        }
        if (!best) { skipped.push(p.id); continue; }
        const w = Math.min(W0, best.L - 0.3), half = w / 2, y0 = g.heightAt(best.ax + best.ex * best.t, best.az + best.ez * best.t) + (o.y ?? 3.9) + (big ? 1.5 : 0);
        const clampU = (u) => Math.max(half + 0.15, Math.min(best.L - half - 0.15, u));
        const free = (x, z, y) => !taken.some((q) => Math.hypot(q.x - x, q.z - z) < (q.w + w) / 2 + 0.25 && (q.y == null || Math.abs(q.y - y) < 0.7));
        let place = null;
        for (const row of [0, 0.8]) { for (const k of [0, 1, -1, 2, -2, 3, -3]) { const u = clampU(best.t + k * (w + 0.4)), x = best.ax + best.ex * u, z = best.az + best.ez * u; if (free(x, z, y0 + row)) { place = { x, z, y: y0 + row }; break; } } if (place) break; }
        if (!place) { skipped.push(p.id); continue; }
        const brand = BRAND.find(([re]) => re.test(text)), [bg, fg] = brand ? [brand[1], brand[2]] : r.pick(NEUTRAL);
        signs.push({ source: p.id, x: place.x + best.nx * 0.14, y: place.y, z: place.z + best.nz * 0.14, yaw: Math.atan2(best.nx, best.nz), w, h: Hs, text, bg, fg });
        taken.push({ x: place.x, z: place.z, w, y: place.y });
    }
    return { signs, skipped };
}

/** a bronze or stone bust on a plinth (stylised volumes); yaw: the way it faces. Collides. */
export function bust(b, ctx, x, z, yaw = 0, { plinth = 1.7, stone = '#cfc8ba', metal = '#3f4a3c', mat = 'bronze', s = 1 } = {}) {
    const y = ctx.ground.heightAt(x, z), fx = Math.sin(yaw), fz = Math.cos(yaw);
    b.box(x, y, z, 0.86 * s, 0.14, 0.86 * s, stone, 'stone', yaw); b.box(x, y + 0.14, z, 0.62 * s, plinth - 0.26, 0.62 * s, stone, 'stone', yaw); b.box(x, y + plinth - 0.12, z, 0.74 * s, 0.12, 0.74 * s, stone, 'stone', yaw);
    b.sphere(x, y + plinth + 0.2 * s, z, 0.34 * s, 0.22 * s, 0.2 * s, metal, mat, 10, 6);            // shoulders
    b.cyl(x, y + plinth + 0.3 * s, z, 0.09 * s, 0.2 * s, metal, mat, 8);                               // neck
    b.sphere(x + fx * 0.02, y + plinth + 0.62 * s, z + fz * 0.02, 0.15 * s, 0.19 * s, 0.17 * s, metal, mat, 10, 8); // head
    ctx.circle(x, z, 0.5 * s, plinth + 0.8);
}

/** a standing figure (bronze / stone) on a low plinth; h: figure height. Collides. */
export function standingFigure(b, ctx, x, z, yaw = 0, { h = 3.2, plinth = 1.2, pw = 1.5, stone = '#bdb6a8', metal = '#3a4438', mat = 'bronze' } = {}) {
    const y = ctx.ground.heightAt(x, z), Y = y + plinth, k = h / 3.2, fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    b.box(x, y, z, pw + 0.3, 0.2, pw + 0.3, stone, 'stone', yaw); b.box(x, y + 0.2, z, pw, plinth - 0.2, pw, stone, 'stone', yaw);
    for (const s of [-1, 1]) b.cyl(x + sx * s * 0.16 * k, Y, z + sz * s * 0.16 * k, 0.13 * k, 1.45 * k, metal, mat, 8, 0.85);   // legs
    b.cyl(x, Y + 1.4 * k, z, 0.3 * k, 1.05 * k, metal, mat, 10, 1.15);                                                            // coat / torso
    b.sphere(x, Y + 2.5 * k, z, 0.36 * k, 0.2 * k, 0.24 * k, metal, mat, 10, 6);                                                  // shoulders
    for (const s of [-1, 1]) b.rod([x + sx * s * 0.36 * k, Y + 2.48 * k, z + sz * s * 0.36 * k], [x + sx * s * 0.3 * k + fx * 0.16 * k, Y + 1.6 * k, z + sz * s * 0.3 * k + fz * 0.16 * k], 0.085 * k, metal, mat, 6); // arms
    b.cyl(x, Y + 2.58 * k, z, 0.08 * k, 0.18 * k, metal, mat, 8); b.sphere(x, Y + 2.95 * k, z, 0.16 * k, 0.2 * k, 0.18 * k, metal, mat, 10, 8); // neck, head
    ctx.circle(x, z, pw * 0.6, plinth + h);
}

/** clipped hedge rows (boxes with colliders) on both sides of an alley polyline, broken where `open(x, z)` says so */
export function alleyHedges(ctx, b, pts, { off = 2.3, h = 1.25, w = 0.9, colour = '#3f6a31', open = null, step = 2, sides = [-1, 1] } = {}) {
    const g = ctx.ground; let total = 0;
    for (const sd of sides) {
        let run = null;
        const flush = () => { if (run && run.len > 1.5) { const cx = (run.ax + run.bx) / 2, cz = (run.az + run.bz) / 2, a = Math.atan2(run.bx - run.ax, run.bz - run.az); b.box(cx, g.heightAt(cx, cz) - 0.05, cz, w, h, run.len, colour, 'plant', a); ctx.box(cx, cz, w / 2, run.len / 2, a, { prop: true, h }); total += run.len; } run = null; };
        for (let i = 1; i < pts.length; i++) {
            const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * sd, nz = ux * sd, n = Math.max(1, Math.round(L / step));
            for (let q = 0; q < n; q++) {
                const u0 = q / n * L, u1 = (q + 1) / n * L, x0 = ax + ux * u0 + nx * off, z0 = az + uz * u0 + nz * off, x1 = ax + ux * u1 + nx * off, z1 = az + uz * u1 + nz * off;
                if (open && open((x0 + x1) / 2, (z0 + z1) / 2)) { flush(); continue; }
                if (run && run.len < 24) { run.bx = x1; run.bz = z1; run.len = Math.hypot(run.bx - run.ax, run.bz - run.az); }
                else { flush(); run = { ax: x0, az: z0, bx: x1, bz: z1, len: Math.hypot(x1 - x0, z1 - z0) }; }
            }
            flush();
        }
    }
    return total;
}
