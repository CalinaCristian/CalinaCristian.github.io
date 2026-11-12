// ============================================================================
//  Shared context helpers for the north-Bucharest tourist scenes (Arcul de
//  Triumf, Herăstrău, Spring Palace), from the 2026-11-12 OSM / Street View
//  fidelity review (game/research/bucharest-spots.md, "Fidelity review"):
//   - parkWoods: the mature canopy of mapped parks / gardens. OSM maps the park
//     polygons but almost none of their trees; the count and the positions are
//     an estimate (deterministic scatter), kept clear of every mapped building,
//     way, pitch, playground, fountain and water body.
//   - dropMedianTrees: generated street trees that land between the two
//     carriageways of a mapped dual road or on a mapped traffic island.
//   - businessSigns: a plain name board for every mapped, named business /
//     embassy / museum (no invented names; colours are procedural).
// ============================================================================
import { rng, inPoly, polyBox, centroid, hash2 } from '../kit.js';
import { roadWidth, isMotorRoad } from '../osm.js';
import { signAtlas } from '../buc.js';

const FOOT_W = { footway: 2.2, path: 1.6, cycleway: 2.6, steps: 2.4, bridleway: 2, track: 3, pedestrian: 5 };
const HARD_AREA = (a) => a.leisure === 'pitch' || a.leisure === 'stadium' || a.leisure === 'playground' || a.leisure === 'swimming_pool' || a.leisure === 'track' || a.leisure === 'dog_park'
    || a.amenity === 'fountain' || a.amenity === 'parking' || a.amenity === 'theatre' || a.natural === 'water' || a.natural === 'scree' || a.highway === 'pedestrian' || a.area_highway
    || a.leisure === 'outdoor_seating' || a.landuse === 'construction';

function segDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; return [Math.hypot(x - ax - dx * t, z - az - dz * t), ax + dx * t, az + dz * t]; }

/** (x, z, margin) → true when the point is clear of every mapped way (its own width), building and hard-surfaced area */
export function greenClearance(d, { roadPad = 3.2, footPad = 1.1, buildingPad = 2.2, extraHard = [] } = {}) {
    const cell = 32, grid = new Map(), key = (i, j) => i * 92821 + j;
    for (const w of d.ways || []) {
        if (!w.pts || w.pts.length < 2 || w.tunnel || w.k === 'fence' || w.k === 'wall') continue;
        const motor = isMotorRoad(w.k); if (!motor && !(w.k in FOOT_W)) continue;
        const hw = motor ? roadWidth(w) / 2 + (w.k === 'service' ? 0.6 : roadPad) : FOOT_W[w.k] / 2 + footPad;
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], seg = [ax, az, bx, bz, hw];
            for (let gi = Math.floor((Math.min(ax, bx) - hw - 4) / cell); gi <= Math.floor((Math.max(ax, bx) + hw + 4) / cell); gi++)
                for (let gj = Math.floor((Math.min(az, bz) - hw - 4) / cell); gj <= Math.floor((Math.max(az, bz) + hw + 4) / cell); gj++) { const k = key(gi, gj); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(seg); }
        }
    }
    const solids = [];
    const solid = (poly, pad) => { const q = polyBox(poly); solids.push({ poly, x0: q.x0 - pad, z0: q.z0 - pad, x1: q.x1 + pad, z1: q.z1 + pad, pad }); };
    for (const b of d.buildings || []) if (b.poly?.length > 2) solid(b.poly, buildingPad);
    for (const a of d.areas || []) if (a.poly?.length > 2 && HARD_AREA(a)) solid(a.poly, 1);
    for (const poly of extraHard) solid(poly, 1);
    const nearEdge = (x, z, poly, pad) => { for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (segDist(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1])[0] < pad) return true; return false; };
    return (x, z, margin = 0) => {
        const b = grid.get(key(Math.floor(x / cell), Math.floor(z / cell)));
        if (b) for (const [ax, az, bx, bz, hw] of b) if (segDist(x, z, ax, az, bx, bz)[0] < hw + margin) return false;
        for (const s of solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && (inPoly(x, z, s.poly) || nearEdge(x, z, s.poly, s.pad))) return false;
        return true;
    };
}

/**
 * mature trees inside mapped green polygons. polys: [[x, z], …][]; density(x, z) → trees per m² (0 = none);
 * `min` keeps the trunks apart. Returns the tree records (not yet pushed to ctx.trees).
 */
export function parkWoods(ctx, polys, { density = () => 1 / 120, seed = 41, conifer = 0.08, scale = [1.15, 1.85], min = 5.5, clear = null, inside = null, bounds = null, max = 6000 } = {}) {
    const r = rng(seed), out = [], cell = min, occ = new Map(), key = (i, j) => i * 92821 + j, free = clear || greenClearance(ctx.data);
    const peak = 1 / (min * min * 1.1);
    for (const poly of polys) {
        if (!poly || poly.length < 3) continue;
        let q = polyBox(poly); if (bounds) q = { x0: Math.max(q.x0, bounds.x0), z0: Math.max(q.z0, bounds.z0), x1: Math.min(q.x1, bounds.x1), z1: Math.min(q.z1, bounds.z1) };
        if (q.x1 <= q.x0 || q.z1 <= q.z0) continue;
        const n = Math.round((q.x1 - q.x0) * (q.z1 - q.z0) * peak);
        for (let i = 0; i < n && out.length < max; i++) {
            const x = q.x0 + r() * (q.x1 - q.x0), z = q.z0 + r() * (q.z1 - q.z0), keep = r(), kind = r(), s = r();
            if (keep > density(x, z) / peak || !inPoly(x, z, poly) || (inside && !inside(x, z)) || !free(x, z)) continue;
            const gi = Math.floor(x / cell), gj = Math.floor(z / cell); let hit = false;
            for (let a = -1; a <= 1 && !hit; a++) for (let b = -1; b <= 1 && !hit; b++) { const o = occ.get(key(gi + a, gj + b)); if (o && Math.hypot(o[0] - x, o[1] - z) < min) hit = true; }
            if (hit) continue; occ.set(key(gi, gj), [x, z]);
            out.push({ x, z, kind: kind < conifer ? 'con' : 'broad', s: scale[0] + s * (scale[1] - scale[0]), woods: true });
        }
    }
    return out;
}

/**
 * remove generated trees that stand between two carriageways of a mapped dual road (within `reach` of both kerbs, on
 * opposite sides of the trunk), on a mapped traffic island, or on an unmapped junction island ringed by carriageways. `keep(t)` protects source trees. Returns the count removed.
 */
export function dropMedianTrees(ctx, { reach = 7.5, island = 34, keep = () => false } = {}) {
    const d = ctx.data, roads = d.ways.filter((w) => isMotorRoad(w.k) && w.k !== 'service' && w.oneway === 'yes' && !w.tunnel && w.pts?.length > 1).map((w) => ({ w, hw: roadWidth(w) / 2, q: polyBox(w.pts) }));
    const islands = d.areas.filter((a) => a.area_highway === 'traffic_island' && a.poly?.length > 2).map((a) => a.poly);
    const before = ctx.trees.length;
    ctx.trees = ctx.trees.filter((t) => {
        if (keep(t)) return true;
        if (islands.some((p) => inPoly(t.x, t.z, p))) return false;
        // an unmapped junction island: carriageway in (nearly) every direction within the island radius
        if (island > 0) { let hit = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); for (let q = 2; q <= island; q += 1.5) if (ctx.onRoad(t.x + c * q, t.z + sn * q, 0)) { hit++; break; } } if (hit >= 14) return false; }
        const near = [];
        for (const { w, hw, q } of roads) {
            const R = hw + reach; if (t.x < q.x0 - R || t.x > q.x1 + R || t.z < q.z0 - R || t.z > q.z1 + R) continue;
            let best = null; for (let i = 1; i < w.pts.length; i++) { const s = segDist(t.x, t.z, w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1]); if (!best || s[0] < best[0]) best = s; }
            if (best && best[0] < R && best[0] > 1e-3) near.push([(best[1] - t.x) / best[0], (best[2] - t.z) / best[0]]);
        }
        for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) if (near[i][0] * near[j][0] + near[i][1] * near[j][1] < -0.5) return false;
        return true;
    });
    return before - ctx.trees.length;
}

/**
 * thin ctx.trees to `budget` evenly over the whole scene instead of letting the loader's cap drop everything beyond a
 * hard rectangle round the spot extents: deterministic per-tree hash; trees outside `core(x, z)` keep `far` × the core share;
 * `keep(t)` trees always stay. Returns { before, after }.
 */
export function thinTrees(ctx, { budget = 3200, core = () => true, far = 0.55, keep = () => false } = {}) {
    const before = ctx.trees.length; if (before <= budget) return { before, after: before };
    let fixed = 0, nc = 0, nf = 0; for (const t of ctx.trees) { if (keep(t)) fixed++; else if (core(t.x, t.z)) nc++; else nf++; }
    const pc = Math.min(1, (budget - fixed) / (nc + far * nf || 1)), pf = pc * far;
    ctx.trees = ctx.trees.filter((t) => keep(t) || hash2(t.x * 0.37 + 11.3, t.z * 0.41 - 7.9) < (core(t.x, t.z) ? pc : pf));
    return { before, after: ctx.trees.length };
}

const SIGN_KIND = (p) => (p.diplomatic || p.office === 'diplomatic' || /^(Ambasada|Consulatul|Embassy)/i.test(p.name || '') ? 'embassy' : /^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten)$/.test(p.amenity || '') ? 'food'
    : p.tourism === 'museum' || p.tourism === 'gallery' || p.amenity === 'theatre' ? 'culture' : p.tourism === 'hotel' || p.shop || p.office ? 'trade' : null);
/** façade point of the building that contains (px, pz) on the ray toward the street point (qx, qz); buildings outside the
 *  walkable extent (`backdrop`) count too: an embassy across the street still carries its name */
function facadeOf(d, px, pz, qx, qz) {
    for (const b of d.buildings) {
        if (b.part || !b.poly || b.poly.length < 3) continue; const q = b._bb || (b._bb = polyBox(b.poly));
        if (px < q.x0 || px > q.x1 || pz < q.z0 || pz > q.z1 || !inPoly(px, pz, b.poly)) continue;
        let best = null; const p = b.poly, dx = qx - px, dz = qz - pz;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], ex = p[i][0] - ax, ez = p[i][1] - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t >= 0 && t <= 60 && u >= 0 && u <= 1 && (!best || t < best.t)) { const L = Math.hypot(ex, ez); best = { t, x: px + dx * t, z: pz + dz * t, ex: ex / L, ez: ez / L }; }
        }
        if (!best) return null;
        let nx = best.ez, nz = -best.ex; if ((qx - best.x) * nx + (qz - best.z) * nz < 0) { nx = -nx; nz = -nz; }
        return { x: best.x, z: best.z, nx, nz, b };
    }
    return null;
}
const SIGN_LOOK = { embassy: { bg: '#8a6f3a', fg: '#fbf3dc', h: 0.5, y: 2.1 }, food: { bg: '#27352d', fg: '#f3e9cf', h: 0.62, y: 3.05 }, culture: { bg: '#e9e4d6', fg: '#2a2622', h: 0.62, y: 3.05 }, trade: { bg: '#2a2f38', fg: '#eef0f2', h: 0.56, y: 3.05 } };

/**
 * name boards for the mapped, named businesses / embassies / museums: on the façade of their building that faces the
 * nearest mapped road or path. Unnamed and façade-less (open-air) entries get nothing. Returns the placed records.
 */
export function businessSigns(ctx, { inside = null, skip = new Set(), name = 'business-signs' } = {}) {
    const d = ctx.data, g = ctx.ground, signs = [], placed = [], seen = new Set();
    const streets = d.ways.filter((w) => (isMotorRoad(w.k) || w.k === 'pedestrian' || w.k === 'footway') && !w.tunnel && w.pts?.length > 1);
    const nearestStreet = (x, z) => { let best = null; for (const w of streets) for (let i = 1; i < w.pts.length; i++) { const s = segDist(x, z, w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1]); if (!best || s[0] < best[0]) best = s; } return best; };
    const put = (id, text, kind, x, z) => {
        const label = String(text || '').trim(); if (!label || seen.has(label) || skip.has(id) || ctx.skipBuildings.has(id) || (inside && !inside(x, z))) return;
        const st = nearestStreet(x, z); if (!st || st[0] > 90) return;
        const f = facadeOf(d, x, z, st[1], st[2]); if (!f || ctx.skipBuildings.has(f.b.id)) return;
        const L = SIGN_LOOK[kind], w = Math.min(7, Math.max(1.6, label.length * 0.26 + 0.8));
        signs.push({ x: f.x + f.nx * 0.09, y: g.heightAt(f.x + f.nx * 0.5, f.z + f.nz * 0.5) + L.y, z: f.z + f.nz * 0.09, yaw: Math.atan2(f.nx, f.nz), w, h: L.h, text: label, bg: L.bg, fg: L.fg, border: kind === 'embassy' ? 'rgba(255,240,200,0.7)' : false });
        seen.add(label); placed.push({ id, name: label, kind, x: f.x, z: f.z });
    };
    for (const b of d.buildings) {
        const kind = b.name && !b.part && SIGN_KIND(b); if (!kind) continue;
        let [x, z] = centroid(b.poly); if (!inPoly(x, z, b.poly)) { x = (b.poly[0][0] + b.poly[1][0]) / 2 * 0.97 + x * 0.03; z = (b.poly[0][1] + b.poly[1][1]) / 2 * 0.97 + z * 0.03; }
        put(b.id, b.name, kind, x, z);
    }
    for (const p of d.pois) { const kind = p.name && SIGN_KIND(p); if (kind) put(p.id, p.name, kind, p.x, p.z); }
    const mesh = signAtlas(signs, { name, night: 0.5 }); if (mesh) ctx.add(mesh);
    return placed;
}
