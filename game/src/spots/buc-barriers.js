// ============================================================================
//  OSM barriers in the Bucharest tourist scenes (round 4, row r3-buc-spots-ot-2).
//  The scene data keeps every mapped barrier way (wall, fence, hedge, retaining /
//  city wall) and barrier areas (`area=yes` walls: plinths, piers, kerbs of a
//  railing), but no scene drew them as a class: only a few heroes had their own
//  walls. `osmBarriers(ctx)` draws them where a walker can see them:
//    - position and class from OSM; `height` / `min_height` from OSM where tagged
//      (a fence with `min_height` stands on a plinth of that height);
//    - untagged heights are labelled estimates (DEFAULT_H);
//    - openings where a mapped footway / path / street crosses the line and at mapped
//      gates (`furniture.gate` nodes, `barrier=gate` ways), so mapped ways stay walkable;
//    - nothing inside hero exclusions (`ctx.exclude`), on skipped ids, or farther than
//      `pad` m from the walk extents; areas whose outline the scene already draws are
//      skipped through their id (the builder's `<id>_b` line of an area barrier is the
//      same object as the area).
//  Kept apart from osm.js / kit.js (hash-locked for the Seattle context pack).
// ============================================================================
import { GeoBatch, polyBox, inPoly, centroid } from './kit.js';
import { palisade } from './buc.js';

/** untagged heights (m above ground), estimates: wall 1.8, fence 1.5, hedge 1.1, retaining wall 1.0 above the low side,
 *  city wall 3.0 */
const DEFAULT_H = { wall: 1.8, fence: 1.5, hedge: 1.1, retaining_wall: 1.0, city_wall: 3.0 };
const THICK = { wall: 0.3, retaining_wall: 0.45, city_wall: 1.2 };
const KINDS = new Set(Object.keys(DEFAULT_H));
const WALKABLE = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'bridleway', 'living_street', 'residential', 'service', 'track', 'unclassified', 'tertiary', 'secondary', 'primary', 'trunk']);
const base = (id) => String(id).replace(/_(b|\d+)$/, '');
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const kindOf = (w) => { const k = w.barrier || w.k; return KINDS.has(k) ? k : null; };

/** crossing parameters (t on a-b, u on c-d) of two segments, or null */
function cross(ax, az, bx, bz, cx, cz, dx, dz) {
    const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * @param ctx scene context
 * @param o { skip: ids the scene draws itself, pad: m beyond the walk extents (default 120), inside(x, z): extra filter,
 *            wallCol, fenceCol, name }
 * @returns stats (also in ctx.extras.osmBarriers)
 */
export function osmBarriers(ctx, o = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), pad = o.pad ?? 120;
    const skip = new Set([...(o.skip || [])].map(base));
    const boxes = Object.values(d.spots).map((s) => s.extent?.polygon?.length ? polyBox(s.extent.polygon) : null).filter(Boolean);
    const near = (x, z) => boxes.some((q) => x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad);
    const hero = (x, z) => ctx.exclude.some((p) => inPoly(x, z, p));
    // a barrier inside a building outline is a roof parapet or an inner wall: the building draws it
    const bgrid = new Map();
    for (const q of d.buildings) { if (!q.poly || q.poly.length < 3 || q.part) continue; const bb = polyBox(q.poly); for (let i = Math.floor(bb.x0 / 32); i <= Math.floor(bb.x1 / 32); i++) for (let j = Math.floor(bb.z0 / 32); j <= Math.floor(bb.z1 / 32); j++) { const k = i * 100003 + j; let a = bgrid.get(k); if (!a) bgrid.set(k, a = []); a.push(q.poly); } }
    const inBuilding = (x, z) => (bgrid.get(Math.floor(x / 32) * 100003 + Math.floor(z / 32)) || []).some((p) => inPoly(x, z, p));
    const ok = (x, z) => near(x, z) && !hero(x, z) && (!o.inside || o.inside(x, z));
    // walkable segments in a 16 m grid (a barrier segment only tests the cells it passes)
    const CELL = 16, grid = new Map(), cellsOf = (ax, az, bx, bz) => { const out = []; for (let i = Math.floor(Math.min(ax, bx) / CELL); i <= Math.floor(Math.max(ax, bx) / CELL); i++) for (let j = Math.floor(Math.min(az, bz) / CELL); j <= Math.floor(Math.max(az, bz) / CELL); j++) out.push(i * 100003 + j); return out; };
    for (const w of d.ways) {
        if (!WALKABLE.has(w.k) || w.tunnel || +w.layer || !(w.pts?.length > 1)) continue;
        const half = w.k === 'footway' || w.k === 'path' || w.k === 'steps' || w.k === 'cycleway' ? 1.1 : 2.2;
        for (let j = 1; j < w.pts.length; j++) { const sg = [w.pts[j - 1][0], w.pts[j - 1][1], w.pts[j][0], w.pts[j][1], half]; for (const c of cellsOf(...sg)) { let a = grid.get(c); if (!a) grid.set(c, a = []); a.push(sg); } }
    }
    const gates = [...(d.furniture?.gate || []), ...d.ways.filter((w) => (w.barrier || w.k) === 'gate' && w.pts?.length).flatMap((w) => w.pts)];
    const stats = { walls: 0, fences: 0, hedges: 0, areas: 0, lengthM: 0, openings: 0, skipped: 0, tagged: 0, alreadyDrawnM: 0 };
    // what the scene already built along the same line (its own railings, walls, hedges, balustrades with colliders):
    // a piece whose middle lies within 1.2 m of an existing wall / box collider is not drawn twice
    const own = new Map();
    const index = (c) => { const R = (c.r || 1) + 2; for (let i = Math.floor((c.x - R) / CELL); i <= Math.floor((c.x + R) / CELL); i++) for (let j = Math.floor((c.z - R) / CELL); j <= Math.floor((c.z + R) / CELL); j++) { const k = i * 100003 + j; let q = own.get(k); if (!q) own.set(k, q = []); q.push(c); } };
    for (const c of ctx.colliders) {
        if (c.poly || !(c.wall || (c.hw !== undefined && c.hd !== undefined && c.hw !== c.r))) continue;
        index(c);
    }
    const drawn = (x, z, m = 1.2) => (own.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || []).some((c) => {
        if (c.wall) { const dx = c.bx - c.ax, dz = c.bz - c.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / L2)); return Math.hypot(x - c.ax - dx * t, z - c.az - dz * t) < m; }
        const a = c.angle || 0, rx = x - c.x, rz = z - c.z, u = rx * Math.cos(a) - rz * Math.sin(a), v = rx * Math.sin(a) + rz * Math.cos(a);
        return Math.abs(u) < c.hw + m * 0.5 && Math.abs(v) < c.hd + m * 0.5;
    });
    let mats = {}, hedgeN = 0;
    const wallCol = o.wallCol || '#d3cab6', fenceCol = o.fenceCol || '#ffffff';
    // ---- area barriers (area=yes walls: plinths, piers, kerbs): a solid prism between min_height and height
    const areaIds = new Set();
    for (const a of d.areas) {
        const k = a.barrier; if (!KINDS.has(k) || !a.poly || a.poly.length < 3) continue;
        areaIds.add(base(a.id));
        if (skip.has(base(a.id))) { stats.skipped++; continue; }
        const [cx, cz] = centroid(a.poly); if (!ok(cx, cz)) continue;
        if (drawn(cx, cz, 0.8) || inBuilding(cx, cz)) { stats.alreadyDrawnM += 1; continue; }
        if (k === 'fence' || k === 'hedge') continue; // a closed fence / hedge is drawn from its line (`<id>_b`) below
        const h = num(a.height) ?? DEFAULT_H[k], h0 = num(a.min_height) ?? 0; if (h - h0 < 0.05) continue;
        let y = Infinity; for (const [x, z] of a.poly) y = Math.min(y, g.heightAt(x, z));
        b.prism(a.poly, y + h0 - (h0 > 0 ? 0 : 0.05), y + h, wallCol, 'stone');
        if (h > 0.35) ctx.poly(a.poly, { y0: y + h0 - 0.5, y1: y + h });
        stats.areas++; if (a.height) stats.tagged++;
    }
    // ---- barrier lines
    for (const w of d.ways) {
        const k = kindOf(w); if (!k || !w.pts || w.pts.length < 2) continue;
        const id = base(w.id);
        if (skip.has(id)) { stats.skipped++; continue; }
        if (areaIds.has(id) && k !== 'fence' && k !== 'hedge') continue; // the area prism above is the same object
        if (!w.pts.some(([x, z]) => ok(x, z))) continue;
        const h = num(w.height) ?? DEFAULT_H[k], h0 = num(w.min_height) ?? 0; if (w.height) stats.tagged++;
        // openings: mapped walkable ways crossing the line, mapped gates on it
        const segs = [];
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            const cut = [];
            const tested = new Set();
            for (const c of cellsOf(ax, az, bx, bz)) for (const sg of grid.get(c) || []) { if (tested.has(sg)) continue; tested.add(sg); const t = cross(ax, az, bx, bz, sg[0], sg[1], sg[2], sg[3]); if (t !== null) cut.push([t * L, sg[4]]); }
            for (const [gx, gz] of gates) { const ux = (bx - ax) / L, uz = (bz - az) / L, s = (gx - ax) * ux + (gz - az) * uz; if (s < -0.5 || s > L + 0.5) continue; if (Math.abs((gx - ax) * uz - (gz - az) * ux) < 1.0) cut.push([s, 1.4]); }
            cut.sort((p, q) => p[0] - q[0]);
            let s0 = 0;
            for (const [s, half] of cut) { if (s - half > s0 + 0.3) segs.push([ax, az, bx, bz, L, s0, s - half]); s0 = Math.max(s0, s + half); stats.openings++; }
            if (L > s0 + 0.3) segs.push([ax, az, bx, bz, L, s0, L]);
        }
        // drop the pieces the scene already drew (tested every 2 m along the piece)
        for (let i = segs.length - 1; i >= 0; i--) {
            const [ax, az, bx, bz, L, s0, s1] = segs[i], keep = [];
            let run = null;
            for (let s = s0; s < s1 - 1e-6; s += 2) { const e = Math.min(s1, s + 2), m = (s + e) / 2, mx = ax + (bx - ax) * m / L, mz = az + (bz - az) * m / L, dup = drawn(mx, mz) || inBuilding(mx, mz); if (dup) { stats.alreadyDrawnM += e - s; run = null; continue; } if (run) run[1] = e; else keep.push(run = [s, e]); }
            segs.splice(i, 1, ...keep.filter(([p, q]) => q - p > 0.3).map(([p, q]) => [ax, az, bx, bz, L, p, q]));
        }
        // consecutive pieces → polylines (palisade / hedge take polylines)
        const runs = []; let cur = null;
        for (const [ax, az, bx, bz, L, s0, s1] of segs) {
            const p0 = [ax + (bx - ax) * s0 / L, az + (bz - az) * s0 / L], p1 = [ax + (bx - ax) * s1 / L, az + (bz - az) * s1 / L];
            if (cur && Math.hypot(cur.at(-1)[0] - p0[0], cur.at(-1)[1] - p0[1]) < 0.01) cur.push(p1); else runs.push(cur = [p0, p1]);
            stats.lengthM += s1 - s0;
        }
        if (!runs.length) continue;
        const c0 = ctx.colliders.length;
        if (k === 'fence') {
            stats.fences++;
            const plinth = Math.min(1.2, h0);
            for (const r of runs) mats = { ...mats, ...palisade(ctx, b, r, { h: Math.max(0.6, h - plinth), plinth, post: 2.6, colour: fenceCol, postCol: '#1f2422', plinthCol: wallCol }) };
        } else if (k === 'hedge') {
            stats.hedges++;
            // (buc.js hedge() boxes share their bottom / top / side planes where neighbours overlap: alternate them by 2–5 cm)
            for (const r of runs) for (let i = 1; i < r.length; i++) {
                const [ax, az] = r[i - 1], [bx, bz] = r[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
                const cx = (ax + bx) / 2, cz = (az + bz) / 2, yaw = Math.atan2(bx - ax, bz - az), k = (hedgeN++ % 3) * 0.05;
                b.box(cx, g.heightAt(cx, cz) - 0.05 - k, cz, 0.8 + k, h + 2 * k, L + 0.2, '#3c5c2e', 'plant', yaw);
                ctx.box(cx, cz, 0.4, L / 2 + 0.1, yaw, { prop: true, h });
            }
        } else {
            stats.walls++;
            const t = THICK[k];
            for (const r of runs) for (let i = 1; i < r.length; i++) {
                const [ax, az] = r[i - 1], [bx, bz] = r[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
                const cx = (ax + bx) / 2, cz = (az + bz) / 2, ya = g.heightAt(ax, az), yb = g.heightAt(bx, bz), y0 = Math.min(ya, yb), yaw = Math.atan2(bx - ax, bz - az);
                // neighbouring segments differ by 2–5 cm in foot, top and thickness: no coplanar faces where they overlap at a joint
                const k = i % 2, foot = (h0 > 0 ? 0 : 0.3) + k * 0.02;
                b.box(cx, y0 + h0 - foot, cz, t + k * 0.05, h - h0 + foot + Math.abs(ya - yb) + k * 0.04, L + k * 0.02, wallCol, 'stone', yaw);
                if (h > 0.6) ctx.collider({ wall: true, ax, az, bx, bz, y0a: ya + h0 - 1, y1a: ya + h, y0b: yb + h0 - 1, y1b: yb + h, x: cx, z: cz, r: L / 2 + 0.5 });
            }
        }
        for (let i = c0; i < ctx.colliders.length; i++) index(ctx.colliders[i]);
    }
    ctx.add(b.build(o.name || 'osm-barriers', { matOverrides: mats }));
    stats.lengthM = Math.round(stats.lengthM); stats.alreadyDrawnM = Math.round(stats.alreadyDrawnM);
    ctx.extras.osmBarriers = stats;
    return stats;
}
