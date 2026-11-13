// ============================================================================
//  UN House, Bd. Primăverii (Spring Palace scene), fidelity pass round 3
//  (2026-11-13). OSM: building w216674220 (building=yes, no height / levels)
//  holds the office=diplomatic node n12857652820 "UN House". The official
//  Street View panorama on Bd. Primăverii (44.46882, 26.09142, reference only)
//  shows a white modernist block: ground floor + three storeys + a set-back top
//  floor with a railing, stacked rounded balconies on the corner toward the
//  palace, horizontal window bands, gold "UN HOUSE" letters with an emblem on
//  the fascia above the ground floor, and on the pavement a grey stone base
//  wall with dark green bar panels and green gates (also on the neighbouring
//  lot). OSM gives the footprint, the name (the letters' text) and the street;
//  storey heights, balcony radius, the wall's line (kerb + estimated pavement)
//  and the gate positions are estimates from that look.
// ============================================================================
import { GeoBatch, centroid, inPoly, polyArea, offsetPolyline } from '../kit.js';
import { signAtlas } from '../buc.js';
import { roadWidth } from '../osm.js';
import { stoneWall } from './buc-walls.js';

const WHITE = '#f1f0ea', BAND = '#e2e1db', GLASS = '#56636c', GOLD = '#b8913a';

function segNear(x, z, pts) { let best = null; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), cx = ax + dx * t, cz = az + dz * t, d = Math.hypot(x - cx, z - cz); if (!best || d < best.d) best = { d, cx, cz, ux: dx / Math.sqrt(L2), uz: dz / Math.sqrt(L2) }; } return best; }

/** returns { id, h, wall } or null when the source building / name node is missing */
export function unHouse(ctx, { building = 'w216674220', node = 'n12857652820', street = 'w429253035' } = {}) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((q) => q.id === building), poi = d.pois.find((p) => p.id === node), road = d.ways.find((w) => w.id === street);
    if (!bd || !poi || !road || bd.poly.length < 4 || !inPoly(poi.x, poi.z, bd.poly) || !/UN House/i.test(poi.name || '')) return null;
    ctx.skipBuildings.add(bd.id);
    const P = bd.poly, n = P.length, y = Math.min(...P.map(([x, z]) => g.heightAt(x, z))) - 0.05, b = new GeoBatch(), signs = [];
    // storeys (estimates from the panorama): ground 3.8 m, three upper 3.1 m, a set-back top floor 3.0 m
    const GF = 3.8, ST = 3.1, levels = [y, y + GF, y + GF + ST, y + GF + 2 * ST], top = y + GF + 3 * ST, pent = top + 3.0;
    b.prism(P, y - 0.4, top, WHITE, 'concrete');
    const inner = offsetPolyline([...P, P[0], P[1]], polyArea(P) > 0 ? -2.4 : 2.4).slice(1, n + 1);
    b.prism(inner, top, pent, WHITE, 'concrete');
    b.prism(offsetPolyline([...inner, inner[0], inner[1]], polyArea(P) > 0 ? 0.15 : -0.15).slice(1, n + 1), pent, pent + 0.35, BAND, 'concrete');
    // the street face: the edge whose midpoint is nearest the boulevard
    let fi = 0, fd = 1e9; for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], q = segNear((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, road.pts); if (q.d < fd) { fd = q.d; fi = i; } }
    const [cx0, cz0] = centroid(P);
    // window bands and slab edges on every face, 7 cm proud of the wall (no coplanar faces)
    for (let i = 0; i < n; i++) {
        const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if ((ax + bx) / 2 * nx + (az + bz) / 2 * nz < cx0 * nx + cz0 * nz) { nx = -nx; nz = -nz; }
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, yaw = Math.atan2(bx - ax, bz - az);
        for (let k = 0; k < 4; k++) { const y0 = levels[k], hh = k ? ST : GF, w = k ? 1.3 : 2.3, gy = k ? y0 + 0.95 : y0 + 0.35;
            b.boxC(mx + nx * 0.07, gy + w / 2, mz + nz * 0.07, 0.06, w, L * (k ? 0.6 : 0.62), GLASS, 'glass', yaw);
            if (k) b.boxC(mx + nx * 0.12, y0 + 0.12, mz + nz * 0.12, 0.2, 0.24, L, BAND, 'concrete', yaw); void hh; }
        b.boxC(mx + nx * 0.12, top + 0.12, mz + nz * 0.12, 0.2, 0.24, L, BAND, 'concrete', yaw);
        if (i === fi) { // fascia letters + emblem beside them over the ground floor, on the western part of the street face (as seen)
            const t = 0.62, lx = ax + (bx - ax) * t, lz = az + (bz - az) * t, ly = y + GF - 0.55;
            signs.push({ x: lx + nx * 0.13, y: ly, z: lz + nz * 0.13, yaw: Math.atan2(nx, nz), w: 4.2, h: 0.75, text: poi.name.toUpperCase(), bg: WHITE, fg: GOLD, border: false, font: (q) => `700 ${q}px Helvetica, Arial, sans-serif` });
            const ex = lx - (bx - ax) / L * 2.7, ez = lz - (bz - az) / L * 2.7; b.cyl(ex + nx * 0.12, ly - 0.03, ez + nz * 0.12, 0.3, 0.06, GOLD, 'bronze', 16, 1, Math.PI / 2, Math.atan2(nx, nz), 0);
        }
    }
    // stacked rounded balconies on the street face's corner toward the palace (east): solid white fronts, three storeys + top
    { const a = P[fi], c = P[(fi + 1) % n], k = a[0] > c[0] ? a : c, R = 2.5;
        for (const lv of [levels[1], levels[2], levels[3], top]) b.cyl(k[0], lv - 0.25, k[1], R, 1.35, WHITE, 'concrete', 20); }
    ctx.poly(P, { y0: y - 1, y1: pent + 1 });
    // pavement wall: the boulevard kerb (source centreline + the painter's road half width) + 3.0 m of pavement (estimate),
    // along the lot frontage (building ends + 4 m), grey stone base 1.15 m with dark bar panels to 2.05 m, thin posts, square piers at the gates,
    // a car gate at the balcony corner and a pedestrian gate on the west part (positions as seen, estimated)
    const a = P[fi], c = P[(fi + 1) % n], qa = segNear(a[0], a[1], road.pts), qc = segNear(c[0], c[1], road.pts), off = roadWidth(road) / 2 + 3.0;
    const toward = (q, p) => { const dx = p[0] - q.cx, dz = p[1] - q.cz, L = Math.hypot(dx, dz) || 1; return [q.cx + dx / L * off, q.cz + dz / L * off]; };
    let A = toward(qa, a), C = toward(qc, c); const ux = (C[0] - A[0]), uz = (C[1] - A[1]), L = Math.hypot(ux, uz);
    A = [A[0] - ux / L * 4, A[1] - uz / L * 4]; C = [C[0] + ux / L * 4, C[1] + uz / L * 4];
    const east = a[0] > c[0] ? 0 : 1, E = east ? C : A, W = east ? A : C, along = (from, to, s) => ({ x: from[0] + (to[0] - from[0]) * s, z: from[1] + (to[1] - from[1]) * s });
    const Lw = L + 8, carG = along(E, W, 5.2 / Lw), footG = along(E, W, (5.2 + 0.62 * L) / Lw);
    const onRoad = [A, C].some(([x, z]) => ctx.onRoad?.(x, z, 0));
    let wall = null;
    if (!onRoad) wall = stoneWall(ctx, b, [A, C], { h: 1.15, thick: 0.35, bay: 2.5, pierW: 0.12, pierRise: 0, grille: 0.9, panel: false, col: '#9d9b95', pierCol: '#a3a19b', capCol: '#a9a7a1',
        gates: [{ x: carG.x, z: carG.z, w: 4.2, id: 'car-gate (estimated)' }, { x: footG.x, z: footG.z, w: 2.1, id: 'pedestrian gate (estimated)' }], gatePier: 0.55, leaf: { colour: '#26402f' } });
    ctx.add(b.build('un-house', { matOverrides: { ...(wall?.mats || {}) } }));
    const SA = signAtlas(signs, { name: 'un-house-letters', night: 0.4 }); if (SA) ctx.add(SA);
    return { id: bd.id, node: poi.id, heightM: +(pent - y).toFixed(1), estimatedStoreys: true, wall: wall ? { lengthM: +wall.lengthM.toFixed(1), gates: wall.gates.length, estimatedLine: true } : null, wallSkipped: onRoad };
}
