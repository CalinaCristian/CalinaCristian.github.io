// Elevated source structures that the road builder does not own:
//  - heavy-rail viaducts: `data.railways` ways tagged bridge (the at-grade rail pass leaves them unresolved),
//  - pedestrian footbridges over roads: footbridge-sources.js (tools/osm/add-footbridges.mjs; OSM footway + bridge, with
//    the steps ways at their ends).
// Position, length and the rail soffit come from OSM (way geometry, `min_height`). What OSM does not carry is an explicit
// estimate, named below and repeated in the report: girder depth, deck width, pier spacing, footbridge clearance.
// Appearance follows a street-level review of the Otopeni structures (2026-11-12, game/research/bucharest-otopeni.md):
// steel trough girders on concrete piers; steel truss footbridges with stair flights at both ends and their sides
// closed by panels (the panels stay blank: no advertising text is invented).
// Piers and columns never stand on a carriageway (drivable edges and scenery streets) or in a tram sweep.
import { rgb, shadeRgb } from './geobuild.js';
import { pointInPolygon } from './util.js';
import { FOOTBRIDGE_SOURCES } from './footbridge-sources.js';

const RAIL_VIADUCT_MODEL = { deckWidthM: 6.5, girderDepthM: 2.2, girderWidthM: 0.35, floorM: 0.45, pierSpacingM: 24, pierSlideM: 10, portalReachM: 9,
    estimates: ['deckWidthM', 'girderDepthM', 'pierSpacingM'], soffit: 'OSM min_height' };
const FOOTBRIDGE_MODEL = { clearanceM: 5.5, deckWidthM: 2.6, trussM: 2.4, stairWidthM: 1.5, riserM: 0.18, estimates: ['clearanceM', 'deckWidthM', 'trussM', 'riserM'] };

const polyline = (pts) => {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (s) => {
        s = Math.max(0, Math.min(total, s)); let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
        const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1] || 1, f = (s - cum[i - 1]) / L, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, ux, uz, nx: uz, nz: -ux, angle: Math.atan2(ux, uz) };
    };
    return { pts, cum, total, at };
};

/** Plan footprints, known before any street furniture is placed: `under(x, z, margin)` = a rail viaduct or footbridge deck is overhead. */
export function planElevatedSources(data, undelta, dataset) {
    const decks = [];
    for (const r of data.railways || []) { const t = r.tags || {}; if (t.railway === 'rail' && t.bridge && t.bridge !== 'no' && Number(t.min_height) > 2) decks.push({ pts: undelta(r.points, 0), half: RAIL_VIADUCT_MODEL.deckWidthM / 2 }); }
    for (const fb of FOOTBRIDGE_SOURCES[dataset] || []) if (fb.points?.length >= 2) decks.push({ pts: fb.points, half: FOOTBRIDGE_MODEL.deckWidthM / 2 });
    for (const d of decks) { d.x0 = Math.min(...d.pts.map(p => p[0])); d.x1 = Math.max(...d.pts.map(p => p[0])); d.z0 = Math.min(...d.pts.map(p => p[1])); d.z1 = Math.max(...d.pts.map(p => p[1])); }
    const plan = { decks: decks.length, skipped: { lamps: 0, trees: 0 },
        under(x, z, margin = 0) {
            for (const d of decks) {
                const lim = d.half + margin; if (x < d.x0 - lim || x > d.x1 + lim || z < d.z0 - lim || z > d.z1 + lim) continue;
                for (let i = 1; i < d.pts.length; i++) {
                    const a = d.pts[i - 1], b = d.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
                    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < lim) return true;
                }
            }
            return false;
        } };
    return plan;
}

export function buildElevatedSources(data, env) {
    const { cellOf, undelta, surfacesAt, addPropColl, visible = () => true, roadY = 0.24, tramSweep = null, overTrunk = () => false } = env;
    const report = { railViaducts: [], footbridges: [], unresolved: [], models: { rail: RAIL_VIADUCT_MODEL, footbridge: FOOTBRIDGE_MODEL } };
    const CON = rgb('#bdb9b0'), CON2 = rgb('#a9a59c'), STEEL = rgb('#8f979c'), GIRDER = rgb('#b4b9b6'), GIRDER_GREEN = rgb('#3f8a5c'), BALLAST = rgb('#787269'), RAIL = rgb('#777b7d');

    // ---- where a support may not stand
    const scenery = [];
    for (const row of data.scenery || []) {
        if (row[3] & 1) continue; // (a scenery bridge: its deck is overhead, the ground below is free)
        const half = (row[0] || 60) / 20 + 0.5, pts = undelta(row, 4);
        for (let i = 1; i < pts.length; i++) scenery.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], half]);
    }
    const onScenery = (x, z, r) => {
        for (const [ax, az, bx, bz, half] of scenery) {
            const lim = half + r; if (x < Math.min(ax, bx) - lim || x > Math.max(ax, bx) + lim || z < Math.min(az, bz) - lim || z > Math.max(az, bz) + lim) continue;
            const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
            if (Math.hypot(x - ax - dx * t, z - az - dz * t) < lim) return true;
        }
        return false;
    };
    const onRoad = (x, z, r) => {
        let hit = false; const low = (h) => { if (h < 3) hit = true; };
        surfacesAt(x, z, low);
        for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!hit) surfacesAt(x + ox, z + oz, low, null, true);
        return hit || onScenery(x, z, r) || !!tramSweep?.segment?.([x - r, z], [x + r, z], r, 0, 4);
    };
    const groundUnder = (x, z) => { let g = -Infinity; surfacesAt(x, z, (h) => { if (h < 3) g = Math.max(g, h); }); return g; };
    // both faces of a thin vertical strip (c.detail has no shadow pass)
    const strip = (mb, ax, az, bx, bz, ya0, ya1, yb0, yb1, col, nx, nz) => {
        for (const s of [1, -1]) mb.face4([ax, ya0, az], [bx, yb0, bz], [bx, yb1, bz], [ax, ya1, az], col, [nx * s, 0, nz * s]);
    };

    // ---- heavy-rail viaducts
    const covers = []; // elevated building volumes (a station hall on its own deck) own the track inside their footprint
    (data.buildings || []).forEach((b, i) => {
        if (!(b[2] > 0)) return; const ring = data.buildingFootprints?.[i] || undelta(b, 9); if (ring.length < 3) return;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        covers.push({ ring, x0, z0, x1, z1, y0: b[2] / 10, y1: b[1] / 10 });
    });
    const covered = (x, z, y) => covers.some(c => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && y >= c.y0 - 0.5 && y <= c.y1 && pointInPolygon(x, z, c.ring));
    const M = RAIL_VIADUCT_MODEL, W = M.deckWidthM, D = M.girderDepthM, GW = M.girderWidthM, FL = M.floorM;
    for (const r of data.railways || []) {
        const t = r.tags || {};
        if (t.railway !== 'rail' || !t.bridge || t.bridge === 'no') continue;
        const soffit = Number(t.min_height);
        if (!(soffit > 2)) { report.unresolved.push({ source: r.id, reason: 'rail bridge without a numeric min_height: no deck level' }); continue; }
        const gauge = Number(t.gauge) > 0 ? Number(t.gauge) / 1000 : 1.435, line = polyline(undelta(r.points, 0)), rec = { source: r.id, soffitM: soffit, deckMetres: 0, piers: 0, portals: 0, longSpans: 0 };
        for (let i = 1; i < line.pts.length; i++) {
            const a = line.pts[i - 1], b = line.pts[i], L = line.cum[i] - line.cum[i - 1]; if (L < 0.01) continue;
            const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux, angle = Math.atan2(ux, uz), steps = Math.ceil(L / 10);
            for (let j = 0; j < steps; j++) {
                const lo = j * L / steps, hi = (j + 1) * L / steps, mid = (lo + hi) / 2, x = a[0] + ux * mid, z = a[1] + uz * mid, len = hi - lo;
                if (!visible(x, z, len) || covered(x, z, soffit + 1)) continue;
                const c = cellOf(x, z), col = overTrunk(x, z) ? GIRDER_GREEN : GIRDER, e = W / 2 - GW / 2;
                const bl = j === steps - 1 ? len + 0.04 : len; // (r2-perf-3: only a segment's last piece overlaps the next segment; colinear 4 cm overlaps were coplanar)
                c.solid.box(x, soffit + 0.05, z, W - 2 * GW + 0.04, FL - 0.05, bl, angle, CON2); // (r2-perf-3: the floor spans between the girders, its soffit 5 cm up: no face coplanar with a girder's)
                for (const s of [1, -1]) {
                    c.solid.box(x + nx * e * s, soffit, z + nz * e * s, GW, D, bl, angle, col);
                    for (const f of [0.25, 0.75]) { const m = lo + len * f, px = a[0] + ux * m + nx * (W / 2 + 0.04) * s, pz = a[1] + uz * m + nz * (W / 2 + 0.04) * s; c.solid.box(px, soffit + 0.12, pz, 0.1, D - 0.24, 0.16, angle, shadeRgb(col, 0.86)); }
                    // railing on the girder's top flange: two rails and posts, thin strips
                    const ax = a[0] + ux * lo + nx * e * s, az = a[1] + uz * lo + nz * e * s, bx = a[0] + ux * hi + nx * e * s, bz = a[1] + uz * hi + nz * e * s, y = soffit + D;
                    for (const h of [0.5, 1.0]) strip(c.detail, ax, az, bx, bz, y + h, y + h + 0.06, y + h, y + h + 0.06, STEEL, nx, nz);
                    for (let p = 0; p < len; p += 2.5) { const qx = ax + ux * p, qz = az + uz * p; strip(c.detail, qx, qz, qx + ux * 0.06, qz + uz * 0.06, y, y + 1.0, y, y + 1.0, STEEL, nx, nz); }
                }
                c.detail.box(x, soffit + FL, z, gauge + 1.7, 0.22, bl, angle, BALLAST);
                for (const s of [1, -1]) c.detail.box(x + nx * gauge / 2 * s, soffit + FL + 0.22, z + nz * gauge / 2 * s, 0.07, 0.1, bl, angle, RAIL);
                rec.deckMetres += len;
            }
        }
        // piers: a wall pier under the deck where the ground is free; where a road runs under the deck a portal (one
        // column on each free side) or a single offset column carries a crosshead; otherwise the span stays open
        const free = (s) => { const p = line.at(s); for (const o of [-(W / 2 - 1.2), 0, W / 2 - 1.2]) if (onRoad(p.x + p.nx * o, p.z + p.nz * o, 0.9)) return false; return true; };
        for (let s0 = M.pierSpacingM / 2; s0 < line.total; s0 += M.pierSpacingM) {
            const here = line.at(s0); if (!visible(here.x, here.z, M.pierSpacingM) || covered(here.x, here.z, soffit + 1)) continue;
            let s = null; for (let k = 0; k <= M.pierSlideM && s === null; k += 2) for (const sg of k ? [1, -1] : [1]) { const q = s0 + k * sg; if (s === null && q > 1 && q < line.total - 1 && free(q)) s = q; }
            if (s !== null) {
                const p = line.at(s), c = cellOf(p.x, p.z), w = W - 1.6;
                c.solid.box(p.x, 0, p.z, w, soffit - 0.6, 1.1, p.angle, CON); c.solid.box(p.x, soffit - 0.6, p.z, W - 0.5, 0.6, 1.5, p.angle, CON2);
                for (const o of [-w / 2 + 0.55, 0, w / 2 - 0.55]) addPropColl(p.x + p.nx * o, p.z + p.nz * o, 0.8, 'viaduct-pier');
                rec.piers++; continue;
            }
            const p = here, c = cellOf(p.x, p.z), sides = [];
            for (const sg of [1, -1]) for (let off = W / 2 - 0.6; off <= M.portalReachM; off += 0.5) if (!onRoad(p.x + p.nx * off * sg, p.z + p.nz * off * sg, 0.9)) { sides.push(off * sg); break; }
            if (!sides.length) { rec.longSpans++; continue; }
            for (const off of sides) { const qx = p.x + p.nx * off, qz = p.z + p.nz * off; c.solid.box(qx, 0, qz, 1.3, soffit - 0.7, 1.3, p.angle, CON); addPropColl(qx, qz, 0.9, 'viaduct-pier'); }
            const lo = sides.length === 2 ? Math.min(...sides) - 0.65 : Math.min(sides[0] - 0.65 * Math.sign(sides[0]), -Math.sign(sides[0]) * W / 2), hi = sides.length === 2 ? Math.max(...sides) + 0.65 : Math.max(sides[0] + 0.65 * Math.sign(sides[0]), -Math.sign(sides[0]) * W / 2);
            c.solid.box(p.x + p.nx * (lo + hi) / 2, soffit - 0.7, p.z + p.nz * (lo + hi) / 2, Math.abs(hi - lo), 0.7, 1.3, p.angle, CON2);
            rec.portals++;
        }
        rec.deckMetres = Math.round(rec.deckMetres);
        if (rec.deckMetres) report.railViaducts.push(rec);
    }

    // ---- footbridges
    const F = FOOTBRIDGE_MODEL, PANEL = rgb('#c9cdd2'), TRUSS = rgb('#5d6f80'), TREAD = rgb('#7d858b');
    for (const fb of FOOTBRIDGE_SOURCES[env.dataset] || []) {
        if (!fb.points || fb.points.length < 2) { report.unresolved.push({ source: fb.id, reason: 'footbridge without geometry' }); continue; }
        const line = polyline(fb.points), mid = line.at(line.total / 2); if (!visible(mid.x, mid.z, line.total)) continue;
        let ground = -Infinity; for (let s = 0; s <= line.total; s += 1) { const p = line.at(s); ground = Math.max(ground, groundUnder(p.x, p.z)); }
        if (!Number.isFinite(ground)) ground = roadY;
        const deckY = ground + F.clearanceM + 0.3, T = F.trussM, Wd = F.deckWidthM, rec = { source: fb.id, lengthM: +line.total.toFixed(1), deckTopM: +deckY.toFixed(2), clearanceM: F.clearanceM, stairs: [], columnsOnRoad: 0 };
        for (let i = 1; i < line.pts.length; i++) {
            const a = line.pts[i - 1], b = line.pts[i], L = line.cum[i] - line.cum[i - 1]; if (L < 0.01) continue;
            const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux, angle = Math.atan2(ux, uz), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, c = cellOf(x, z);
            c.solid.box(x, deckY - 0.3, z, Wd, 0.3, L, angle, STEEL);
            for (const s of [1, -1]) {
                const e = (Wd / 2 - 0.09) * s, ex = x + nx * e, ez = z + nz * e;
                c.solid.box(ex, deckY, ez, 0.18, 0.2, L, angle, TRUSS); c.solid.box(ex, deckY + T - 0.18, ez, 0.18, 0.18, L, angle, TRUSS);
                const bays = Math.max(1, Math.round(L / 3));
                for (let k = 0; k <= bays; k++) { const m = L * k / bays - L / 2; c.solid.box(ex + ux * m, deckY, ez + uz * m, 0.12, T, 0.12, angle, TRUSS); }
                const o = (Wd / 2 + 0.03) * s; c.solid.box(x + nx * o, deckY + 0.15, z + nz * o, 0.05, T - 0.45, L * 0.9, angle, PANEL);
            }
            for (const k of [-0.5, 0, 0.5]) c.detail.box(x + ux * L * k, deckY + T - 0.12, z + uz * L * k, Wd, 0.1, 0.12, angle, TRUSS); // top cross members
        }
        for (const s of [0, line.total]) { // end frames down to the ground
            const p = line.at(s), c = cellOf(p.x, p.z);
            for (const sg of [1, -1]) { const qx = p.x + p.nx * (Wd / 2 - 0.15) * sg, qz = p.z + p.nz * (Wd / 2 - 0.15) * sg; if (onRoad(qx, qz, 0.2)) rec.columnsOnRoad++; c.solid.box(qx, 0, qz, 0.32, deckY + T, 0.32, p.angle, TRUSS); addPropColl(qx, qz, 0.35, 'footbridge-column'); }
        }
        const ends = [line.pts[0], line.pts[line.pts.length - 1]], near = (q) => Math.min(...ends.map(e => Math.hypot(q[0] - e[0], q[1] - e[1])));
        for (const st of fb.steps || []) {
            if (!st.points || st.points.length < 2) continue;
            const pts = near(st.points[0]) <= near(st.points[st.points.length - 1]) ? st.points.slice().reverse() : st.points; // bottom → top (the top joins the deck)
            const sl = polyline(pts), base = Math.max(0, groundUnder(pts[0][0], pts[0][1]), 0.15), rise = deckY - base, N = Math.max(2, Math.ceil(rise / F.riserM)), SW = F.stairWidthM;
            for (let k = 0; k < N; k++) { const p = sl.at((k + 0.5) / N * sl.total), y = base + rise * (k + 1) / N; cellOf(p.x, p.z).detail.box(p.x, y - 0.05, p.z, SW, 0.05, sl.total / N + 0.03, p.angle, TREAD); }
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i], ya = base + rise * sl.cum[i - 1] / sl.total, yb = base + rise * sl.cum[i] / sl.total, L = sl.cum[i] - sl.cum[i - 1]; if (L < 0.01) continue;
                const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux, c = cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                for (const sg of [1, -1]) {
                    const ox = nx * SW / 2 * sg, oz = nz * SW / 2 * sg, ax = a[0] + ox, az = a[1] + oz, bx = b[0] + ox, bz = b[1] + oz;
                    strip(c.detail, ax, az, bx, bz, Math.max(0, ya - 0.3), ya + 0.08, yb - 0.3, yb + 0.08, TRUSS, nx, nz);          // stringer
                    strip(c.detail, ax, az, bx, bz, ya + 1.0, ya + 1.06, yb + 1.0, yb + 1.06, STEEL, nx, nz);                       // handrail
                    for (let m = 0; m <= L; m += 1.5) { const f = m / L, qx = ax + ux * m, qz = az + uz * m, y = ya + (yb - ya) * f; strip(c.detail, qx, qz, qx + ux * 0.05, qz + uz * 0.05, y, y + 1.0, y, y + 1.0, STEEL, nx, nz); }
                }
                for (let m = 0.6; m < L; m += 1.5) { const y = ya + (yb - ya) * m / L; if (y - base < 2.4) addPropColl(a[0] + ux * m, a[1] + uz * m, SW / 2 + 0.05, 'footbridge-stair'); }
            }
            rec.stairs.push({ source: st.id, steps: N, taggedSteps: st.tags?.step_count ? Number(st.tags.step_count) : null, runM: +sl.total.toFixed(1) });
        }
        report.footbridges.push(rec);
    }
    if (env.plan) report.clearedUnderDecks = env.plan.skipped;
    return { report };
}
