// ============================================================================
//  Mapped places without a name in the Bucharest tourist scenes (round 4, row r3-builder-spots-1).
//  The round-3 data append brought unnamed OSM nodes that no scene showed: waterfalls (waterway / natural=waterfall),
//  viewpoints (tourism=viewpoint) and playgrounds (leisure=playground). `osmPlaces(ctx)` shows each one at its OSM node:
//    - waterfall: a small stone cascade with a falling water sheet and a basin, plus its sound (height 1.6 m and width
//      2.4 m are estimates; an `artificial=yes` fall is drawn the same);
//    - viewpoint: an E point "look out" (a viewpoint is a place to stand, not an object; nothing is built);
//    - playground: a slide, a swing frame and a sand box round the node, clear of mapped ways and buildings (the
//      equipment, its size and its layout are estimates: OSM maps only the point);
//    - gate (`furniture.gate`): piers and an open iron double gate at the node (row r3-buc-spots-nth-4).
//  Kept apart from osm.js / kit.js (hash-locked for the Seattle context pack).
// ============================================================================
import { GeoBatch, inPoly, distPolyline, polyBox } from './kit.js';

export function osmPlaces(ctx, o = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), out = { waterfalls: [], viewpoints: [], playgrounds: [] };
    const skip = new Set(o.skip || []);
    const ways = d.ways.filter((w) => w.pts?.length > 1 && !w.tunnel && w.k !== 'line');
    const blds = d.buildings.filter((q) => q.poly?.length > 2).map((q) => ({ p: q.poly, bb: polyBox(q.poly) }));
    const clear = (x, z, r) => !ways.some((w) => distPolyline(x, z, w.pts).d < r + (/footway|path|pedestrian|steps|cycleway/.test(w.k) ? 0.9 : 3)) && !blds.some((q) => x > q.bb.x0 - r && x < q.bb.x1 + r && z > q.bb.z0 - r && z < q.bb.z1 + r && inPoly(x, z, q.p)) && !ctx.exclude.some((p) => inPoly(x, z, p));
    for (const p of d.pois) {
        if (skip.has(p.id) || p.name) continue;
        const y = g.heightAt(p.x, p.z);
        if (p.waterway === 'waterfall' || p.natural === 'waterfall') {
            // stones stepping down to a basin; the sheet falls from the top stone's lip
            const H = 1.6, W = 2.4, yaw = o.yaw?.[p.id] ?? 0, s = Math.sin(yaw), c = Math.cos(yaw), P = (u, v) => [p.x + u * c + v * s, p.z - u * s + v * c];
            for (const [u, v, w, h, dd, f, col] of [[0, -0.9, W + 0.8, H + 0.25, 0.9, 0.3, '#7d776c'], [-1.3, -0.3, 0.9, H * 0.7, 0.86, 0.34, '#8a8377'], [1.35, -0.4, 0.8, H * 0.6, 0.82, 0.38, '#77716a']]) { const [x, z] = P(u, v); b.box(x, y - f, z, w, h + f, dd, col, 'stone', yaw); } // (feet and depths differ: no coplanar faces where the stones overlap)
            const [qx, qz] = P(0, 0.75); b.cyl(qx, y - 0.25, qz, 1.5, 0.28, '#6f6a62', 'stone', 14); b.cyl(qx, y + 0.06, qz, 1.32, 0.02, '#4f6f78', 'glass', 14);
            const [ax, az] = P(-W / 2 + 0.2, -0.43), [bx, bz] = P(W / 2 - 0.2, -0.43), [cx, cz] = P(W / 2 - 0.2, 0.25), [ex, ez] = P(-W / 2 + 0.2, 0.25);
            b.quad([ax, y + H, az], [bx, y + H, bz], [cx, y + 0.08, cz], [ex, y + 0.08, ez], '#cfe3ea', 'glass'); b.quad([ex, y + 0.08, ez], [cx, y + 0.08, cz], [bx, y + H, bz], [ax, y + H, az], '#cfe3ea', 'glass'); // both faces
            ctx.box(p.x, p.z, W / 2 + 0.4, 0.9, yaw, { h: H + 0.25 }); ctx.sound('water', p.x, p.z, 30, 0.45);
            out.waterfalls.push(p.id);
        } else if (p.tourism === 'viewpoint') {
            ctx.interactables.push({ x: p.x, z: p.z, r: 2.6, source: p.id, label: 'Look out from the viewpoint', use: (s) => s.ui?.toast?.('👀 Viewpoint', 'A mapped viewpoint (OpenStreetMap). Take a photo from here.') });
            out.viewpoints.push(p.id);
        } else if (p.leisure === 'playground') {
            // find a clear spot for each piece within 7 m of the node (rings of candidates)
            const placed = [], spot = (r) => { for (const R of [0, 2.5, 4, 5.5, 7]) for (let k = 0; k < (R ? 10 : 1); k++) { const a = k / 10 * Math.PI * 2, x = p.x + Math.cos(a) * R, z = p.z + Math.sin(a) * R; if (clear(x, z, r) && placed.every((q) => Math.hypot(q[0] - x, q[1] - z) > q[2] + r + 0.8)) { placed.push([x, z, r]); return [x, z]; } } return null; };
            const sw = spot(2.2); if (sw) { const [x, z] = sw, yy = g.heightAt(x, z); for (const s of [-1, 1]) { b.rod([x - 1.6, yy, z + s * 0.9], [x - 1.6, yy + 2.3, z], 0.05, '#c8462f', 'metal', 6); b.rod([x + 1.6, yy, z + s * 0.9], [x + 1.6, yy + 2.3, z], 0.05, '#c8462f', 'metal', 6); } b.rod([x - 1.6, yy + 2.3, z], [x + 1.6, yy + 2.3, z], 0.05, '#c8462f', 'metal', 6); for (const u of [-0.7, 0.7]) { b.rod([x + u, yy + 2.3, z], [x + u, yy + 0.45, z], 0.008, '#2b2b2b', 'metal', 3); b.box(x + u, yy + 0.4, z, 0.45, 0.04, 0.2, '#2f6db3', 'plastic'); } ctx.box(x, z, 1.7, 1.0, 0, { prop: true, h: 2.3 }); }
            const sl = spot(1.8); if (sl) { const [x, z] = sl, yy = g.heightAt(x, z); b.box(x - 1.0, yy, z, 0.8, 1.4, 0.8, '#e2b23a', 'plastic'); b.quad([x - 0.6, yy + 1.4, z - 0.3], [x - 0.6, yy + 1.4, z + 0.3], [x + 1.5, yy + 0.25, z + 0.3], [x + 1.5, yy + 0.25, z - 0.3], '#d8432f', 'plastic'); ctx.box(x, z, 1.4, 0.5, 0, { prop: true, h: 1.4 }); }
            const sb = spot(1.4); if (sb) { const [x, z] = sb, yy = g.heightAt(x, z); for (const [u, v, w, dd] of [[0, -1.1, 2.4, 0.15], [0, 1.1, 2.4, 0.15], [-1.1, 0, 0.15, 2.4], [1.1, 0, 0.15, 2.4]]) b.box(x + u, yy - 0.05, z + v, w, 0.3, dd, '#8a6a46', 'wood'); b.box(x, yy - 0.05, z, 2.1, 0.12, 2.1, '#d9c79a', 'concrete'); }
            if (placed.length) out.playgrounds.push(p.id);
        }
    }
    // mapped gates (`furniture.gate`, barrier=gate nodes): two stone piers and an iron double gate standing open, turned
    // along the nearest drawn wall (its collider within 4 m) or else across the nearest mapped way; width 3.6 m, pier and
    // leaf height 2.4 / 2.0 m are estimates. Open leaves: a mapped way through the gate stays walkable.
    out.gates = [];
    const walls = ctx.colliders.filter((c) => c.wall), boxes = Object.values(d.spots).map((q) => q.extent?.polygon?.length ? polyBox(q.extent.polygon) : null).filter(Boolean);
    const nearWalk = (x, z) => boxes.some((q) => x > q.x0 - 150 && x < q.x1 + 150 && z > q.z0 - 150 && z < q.z1 + 150);
    for (const [gx, gz] of d.furniture?.gate || []) {
        if (!nearWalk(gx, gz) || blds.some((q) => gx > q.bb.x0 && gx < q.bb.x1 && gz > q.bb.z0 && gz < q.bb.z1 && inPoly(gx, gz, q.p))) continue;
        let ux = null, uz = null, bestD = 4;
        for (const c of walls) { if (Math.abs(c.x - gx) > (c.r || 0) + 4 || Math.abs(c.z - gz) > (c.r || 0) + 4) continue; const dx = c.bx - c.ax, dz = c.bz - c.az, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((gx - c.ax) * dx + (gz - c.az) * dz) / (L * L))), dd = Math.hypot(gx - c.ax - dx * t, gz - c.az - dz * t); if (dd < bestD) { bestD = dd; ux = dx / L; uz = dz / L; } }
        if (ux === null) { let bw = null; for (const w of ways) for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((gx - ax) * dx + (gz - az) * dz) / (L * L))), dd = Math.hypot(gx - ax - dx * t, gz - az - dz * t); if (!bw || dd < bw.d) bw = { d: dd, ux: -dz / L, uz: dx / L }; } if (!bw) continue; ux = bw.ux; uz = bw.uz; } // across the way
        const y = g.heightAt(gx, gz), half = 1.8, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
        for (const sgn of [-1, 1]) {
            const px = gx + ux * (half + 0.3) * sgn, pz = gz + uz * (half + 0.3) * sgn;
            b.box(px, y - 0.3, pz, 0.6, 2.7, 0.6, '#b9b2a4', 'stone', yaw); b.box(px, y + 2.4, pz, 0.72, 0.14, 0.72, '#a9a193', 'stone', yaw); ctx.box(px, pz, 0.3, 0.3, yaw, { h: 2.4 });
            // a leaf hinged at the pier, swung 70° inward (toward +n)
            const hx = gx + ux * half * sgn, hz = gz + uz * half * sgn, a = 70 * Math.PI / 180, lx = -ux * sgn * Math.cos(a) + nx * Math.sin(a), lz = -uz * sgn * Math.cos(a) + nz * Math.sin(a), ex = hx + lx * half, ez = hz + lz * half;
            for (const yy of [0.15, 1.0, 1.95]) b.rod([hx, y + yy, hz], [ex, y + yy, ez], 0.03, '#15181a', 'metal', 4);
            for (let k = 0; k <= 9; k++) { const t = k / 9, bx2 = hx + lx * half * t, bz2 = hz + lz * half * t; b.rod([bx2, y + 0.1, bz2], [bx2, y + 2.0, bz2], 0.015, '#15181a', 'metal', 3); }
        }
        out.gates.push([+gx.toFixed(1), +gz.toFixed(1)]);
    }
    ctx.add(b.build(o.name || 'osm-places'));
    ctx.extras.osmPlaces = out;
    return out;
}
