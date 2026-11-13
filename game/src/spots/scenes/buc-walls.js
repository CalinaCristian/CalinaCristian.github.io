// ============================================================================
//  Property walls of Bucharest institutions (fidelity pass 2026-11-12, round 2).
//  `stoneWall`: a solid masonry wall along a mapped `barrier=wall` way: bays
//  between square piers with pyramid caps, a recessed panel per bay, closed
//  wrought-iron gates between taller piers at the mapped `barrier=gate` nodes.
//  OSM gives the line and the gate nodes; height, bay, pier and gate sizes are
//  estimates from looking at the place (Street View, reference only) and are
//  passed in by the scene. Every bay and gate collides.
// ============================================================================
import { palisade } from '../buc.js';

/**
 * @param ctx   scene context (ground, collider)
 * @param b     GeoBatch ('stone' material)
 * @param pts   wall polyline [[x, z], …] (the mapped way)
 * @param o     { h, thick, bay, pierW, pierRise, col, pierCol, capCol, panelCol, panel, gates: [{ x, z, w?, id? }],
 *                gateW, gateTol, gatePier, leaf: { h, colour }, collide, grille (m of iron grille over a base course of
 *                height h, instead of a solid bay), endPier (false when the next run starts with its own pier there) }
 * @returns { mats, gates: [{ id, x, z, yaw, w }], bays, lengthM }
 */
export function stoneWall(ctx, b, pts, o = {}) {
    const { h = 2.3, thick = 0.5, bay = 4.4, pierW = 0.72, pierRise = 0.36, col = '#d6cdba', pierCol = '#dcd4c2', capCol = '#e7e0d1', panelCol = '#c9bfab', panel = true,
        gates = [], gateW = 5, gateTol = 3.5, gatePier = 1.0, leaf = {}, collide = true, grille = 0, endPier = true } = o;
    const top = h + grille; // pier heads and gates follow the full height
    const g = ctx.ground, seg = []; let total = 0, mats = {}, bays = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue; seg.push({ ax, az, ux: (bx - ax) / L, uz: (bz - az) / L, L, s0: total }); total += L; }
    if (!seg.length) return { mats, gates: [], bays, lengthM: 0 };
    const at = (s) => { let q = seg[0]; for (const k of seg) { if (s >= k.s0) q = k; else break; } const t = Math.max(0, Math.min(q.L, s - q.s0)); return { x: q.ax + q.ux * t, z: q.az + q.uz * t, ux: q.ux, uz: q.uz }; };
    const open = [];
    for (const q of gates) {
        let best = null;
        for (const k of seg) { const t = Math.max(0, Math.min(k.L, (q.x - k.ax) * k.ux + (q.z - k.az) * k.uz)), d = Math.hypot(q.x - k.ax - k.ux * t, q.z - k.az - k.uz * t); if (!best || d < best.d) best = { d, s: k.s0 + t }; }
        if (!best || best.d > gateTol) continue;
        const w = q.w || gateW, a = Math.max(0.6, best.s - w / 2), e = Math.min(total - 0.6, best.s + w / 2); if (e - a < 2 || open.some((p) => a < p.b + 1.5 && e > p.a - 1.5)) continue;
        open.push({ a, b: e, id: q.id || null });
    }
    open.sort((p, q) => p.a - q.a);
    const atGate = (s0) => open.some((p) => Math.abs(p.a - s0) < 0.01 || Math.abs(p.b - s0) < 0.01); // a gate pier stands there
    // (pier feet go to different depths than the bays and than each other's kind: no coplanar faces underground)
    const pier = (x, z, yaw, y, w, hh, foot = 0.34) => {
        b.box(x, y - foot, z, w, hh + foot, w, pierCol, 'stone', yaw); b.box(x, y + hh, z, w + 0.16, 0.13, w + 0.16, capCol, 'stone', yaw);
        b.cyl(x, y + hh + 0.13, z, w * 0.66, w * 0.42, capCol, 'stone', 4, 0, 0, yaw + Math.PI / 4, 0);
    };
    for (const k of seg) {
        // the solid stretches of this edge: [s0, s0 + L] minus the gate openings
        let cur = k.s0; const end = k.s0 + k.L, runs = [];
        for (const p of open) { if (p.b <= cur || p.a >= end) continue; if (p.a > cur) runs.push([cur, p.a]); cur = Math.max(cur, p.b); }
        if (cur < end) runs.push([cur, end]);
        const yaw = Math.atan2(k.ux, k.uz), nx = k.uz, nz = -k.ux;
        for (const [sa, sb] of runs) {
            const l = sb - sa; if (l < 0.3) continue; const n = Math.max(1, Math.round(l / bay)), bl = l / n;
            for (let i = 0; i < n; i++) {
                const t0 = sa - k.s0 + i * bl, t1 = t0 + bl, x0 = k.ax + k.ux * t0, z0 = k.az + k.uz * t0, x1 = k.ax + k.ux * t1, z1 = k.az + k.uz * t1;
                const y0 = g.heightAt(x0, z0), y1 = g.heightAt(x1, z1), yb = Math.min(y0, y1), yt = Math.max(y0, y1) + h, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
                bays++;
                if (grille) { // a low base course with an iron grille up to the pier heads (palisade draws base, bars and collider)
                    mats = { ...mats, ...palisade(ctx, b, [[x0, z0], [x1, z1]], { h: grille, plinth: h, post: 1e6, plinthCol: col, postCol: leaf.colour || '#1c211f', collide }) };
                    if (!(i === 0 && atGate(sa))) pier(x0, z0, yaw, y0, pierW, h + grille + pierRise); continue;
                }
                b.box(cx, yb - 0.4, cz, thick, yt - yb + 0.4, bl - 0.24, col, 'stone', yaw); // (ends 12 cm short, inside the piers: bays never touch at a bend)
                if (panel && bl > pierW + 1.2) { const m = pierW / 2 + 0.32, pa = yb + 0.62, pb = yt - 0.34;
                    for (const sd of [-1, 1]) { const off = sd * (thick / 2 + 0.07) /* 7 cm proud: 1 km from the origin, float32 planes closer than about 3 cm read as coplanar */, A = [x0 + k.ux * m + nx * off, z0 + k.uz * m + nz * off], B = [x1 - k.ux * m + nx * off, z1 - k.uz * m + nz * off];
                        const q = [[A[0], pa, A[1]], [B[0], pa, B[1]], [B[0], pb, B[1]], [A[0], pb, A[1]]]; if (sd > 0) b.quad(q[1], q[0], q[3], q[2], panelCol, 'stone'); else b.quad(q[0], q[1], q[2], q[3], panelCol, 'stone'); } }
                if (!(i === 0 && atGate(sa))) pier(x0, z0, yaw, y0, pierW, h + pierRise);
                if (collide) ctx.collider({ wall: true, ax: x0, az: z0, bx: x1, bz: z1, y0a: y0 - 1, y1a: y0 + h, y0b: y1 - 1, y1b: y1 + h, x: cx, z: cz, r: bl / 2 + 0.5 });
            }
        }
    }
    if (endPier && !atGate(total)) { const e = at(total), last = seg[seg.length - 1]; pier(e.x, e.z, Math.atan2(last.ux, last.uz), g.heightAt(e.x, e.z), pierW, top + pierRise); }
    const made = [];
    for (const p of open) {
        const A = at(p.a), B = at(p.b), yaw = Math.atan2(B.x - A.x, B.z - A.z), ya = g.heightAt(A.x, A.z), yb = g.heightAt(B.x, B.z), gh = top + 1.05;
        pier(A.x, A.z, yaw, ya, gatePier, gh, 1.7); pier(B.x, B.z, yaw, yb, gatePier, gh, 1.7);
        const w = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / w, uz = (B.z - A.z) / w, in0 = gatePier / 2 + 0.05;
        mats = { ...mats, ...palisade(ctx, b, [[A.x + ux * in0, A.z + uz * in0], [B.x - ux * in0, B.z - uz * in0]], { h: leaf.h ?? top + 0.35, post: (w - 2 * in0) / 2, plinth: 0, postCol: leaf.colour || '#1c211f', collide }) };
        made.push({ id: p.id, x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, yaw, w });
    }
    return { mats, gates: made, bays, lengthM: total };
}
