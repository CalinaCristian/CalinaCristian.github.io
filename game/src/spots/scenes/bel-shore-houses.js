// ============================================================================
//  Houses at the far shores of Meydenbauer Bay (round 3 of the 2026-11 fidelity
//  pass, r2-bel-spots-1): Street View from 99th Ave NE shows houses, condos and
//  boathouses at the waterline under the fir belt; the spot extract stops at the
//  scene's DEM grid, so the far shores had trees only. The footprints are live
//  OSM (game/data/spots/bel-meydenbauer-shore.json, Overpass 2026-11-13); tags
//  win (building:levels, roof:shape). Without tags: two storeys (a carport one)
//  and a gable over the footprint's long axis — rules of thumb, not
//  measurements; wall / roof colours are a deterministic per-id pick from a
//  plain palette (no colour is mapped). Over-water footprints (boathouses,
//  covered moorage) get the bay's moorage-shed treatment. Not a scene module.
// ============================================================================
import { GeoBatch, inPoly, polyBox, hash2 } from '../kit.js';
import { gableRoof } from './bel-common.js';

const WALLS = ['#e8e4da', '#d7cfbf', '#c9c3b6', '#b9a68c', '#9aa3a6', '#8f6f58', '#efeeea', '#c4b8a0'];
const ROOFS = ['#4b4d4f', '#5a524a', '#3f4447', '#6a6258', '#55585a'];

/** load the shore footprints (null when the file is missing) */
export async function loadShoreHouses() {
    try { const r = await fetch(new URL('../../../data/spots/bel-meydenbauer-shore.json', import.meta.url)); return r.ok ? (await r.json()).buildings || [] : null; } catch { return null; }
}

/** long axis of a footprint: centre, yaw (atan2 along the long side), length L, width W */
function frame(poly) {
    let best = 0, ux = 1, uz = 0;
    for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ux = (bx - ax) / L; uz = (bz - az) / L; } }
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const [x, z] of poly) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    return { cx: uc * ux - vc * uz, cz: uc * uz + vc * ux, yaw: Math.atan2(ux, uz), L: u1 - u0, W: v1 - v0 };
}

/**
 * Build the shore houses into the scene. sdf(x, z) > 0 is the lake; lakeY its level. Returns the footprints placed
 * (for tree clearing).
 */
export function shoreHouses(ctx, list, { sdf, lakeY }) {
    const g = ctx.ground, b = new GeoBatch(), placed = [];
    for (const h of list || []) {
        const P = h.poly; if (!P || P.length < 3) continue;
        const bb = polyBox(P), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, k = hash2(cx * 0.37, cz * 0.61);
        const wet = h.overWater || sdf(cx, cz) > 0.5;
        if (wet) { // boathouse / covered moorage on piles: grey roof, brown fascia (as the bay's own moorage sheds)
            const ry = lakeY + 4.2; b.prism(P, lakeY - 0.3, lakeY + 0.45, '#6b5a48', 'wood'); b.prism(P, ry, ry + 0.3, '#7d8387', 'metal');
            for (const [x, z] of P) b.cyl(x, lakeY - 1, z, 0.13, ry - lakeY + 1, '#5a534b', 'wood', 6);
            placed.push(P); continue; }
        const ys = P.map(([x, z]) => g.heightAt(x, z)), y0 = Math.min(...ys) - 0.4, yb = Math.max(...ys);
        const lv = +h['building:levels'] || (/carport|garage|shed/.test(h.k || '') ? 1 : 2), wallH = +h.height || lv * 3.0 + 0.4;
        const top = Math.max(yb + 2.4, Math.min(...ys) + wallH), wall = WALLS[Math.floor(k * WALLS.length)], roof = ROOFS[Math.floor(hash2(cz * 0.29, cx * 0.83) * ROOFS.length)];
        b.prism(P, y0, top, wall, 'concrete');
        const shape = h['roof:shape'] || (h.k === 'apartments' ? 'flat' : 'gabled'), f = frame(P);
        if (shape === 'flat' || f.W > 22 || f.L < 3) b.prism(P.map(([x, z]) => [cx + (x - cx) * 1.02, cz + (z - cz) * 1.02]), top, top + 0.35, roof, 'roofs');
        else gableRoof(b, f.cx, top, f.cz, f.yaw, f.L, f.W, Math.min(3.2, f.W * (shape === 'hipped' ? 0.28 : 0.36)), roof, { over: 0.4, gable: wall });
        ctx.poly(P, { y0: y0 - 1, y1: top + 3 });
        placed.push(P);
    }
    if (placed.length) ctx.add(b.build('shore-houses'));
    // no belt tree inside a house
    const boxes = placed.map((p) => ({ p, b: polyBox(p) }));
    ctx.trees = ctx.trees.filter((t) => !boxes.some(({ p, b: q }) => t.x > q.x0 - 1.5 && t.x < q.x1 + 1.5 && t.z > q.z0 - 1.5 && t.z < q.z1 + 1.5 && (inPoly(t.x, t.z, p) || Math.hypot(t.x - (q.x0 + q.x1) / 2, t.z - (q.z0 + q.z1) / 2) < Math.max(q.x1 - q.x0, q.z1 - q.z0) / 2 + 1.5)));
    return placed;
}
