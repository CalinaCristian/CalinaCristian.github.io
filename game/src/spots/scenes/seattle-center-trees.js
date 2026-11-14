// ============================================================================
//  Seattle Center planting the spot extract (2026-11-06) under-draws (r3-sea-spots-b-4): the Armory's surroundings read
//  wooded in Street View and the Needle pavilion sits in planted beds, while the scene showed open lawn.
//  - LIVE_TREES: natural=tree nodes in the live OSM database (API 0.6 map call, 2026-11-13, bbox −122.3525, 47.6195,
//    −122.3480, 47.6228) that are not within 1.5 m of an extract tree and lie on the scene's ground (x ≥ −188): the rows
//    along the Armory's west side and Thomas St, the double row west of the Chihuly garden. [OSM node id, x, z, needleleaved]
//  - The mapped natural=wood polygons round the Armory and east of the Needle (w394259997) are filled at one tree per
//    30 m² (the generic scatter is one per 90 m²), at least 3.5 m apart.
//  - The mapped landuse=shrubs beds round the Needle pavilion (inside the 26 m circle the hero model clears of generated
//    trees) get shrubs and a few small trees between the pavilion glass + 1.5 m and 30 m.
//  Densities, spacing and tree sizes are estimates; positions are the OSM nodes and areas.
// ============================================================================
import { rng, inPoly, polyBox, polyArea, centroid } from '../kit.js';

const LIVE_TREES = [[3404789270, -177, -37.9, 0], [3972970418, -162.3, 42.9, 0], [3972970419, -172.1, 42.9, 0], [3972970432, -162.3, 36.6, 0], [3972970433, -172.1, 36.6, 0], [3972970438, -162, 30.8, 0], [3972970439, -171.9, 30.8, 0], [3972970441, -162, 24.5, 0], [3972970442, -171.9, 24.5, 0], [3972970451, -171.9, 18.4, 0], [3972975062, -162.2, 12.8, 0], [3972975063, -172, 12.8, 0], [3972975067, -162.1, 6.6, 0], [3972975068, -171.9, 6.6, 0], [3972975073, -162, 0.9, 0], [3972975074, -171.9, 0.9, 0], [3972975080, -162.1, -5.1, 0], [3972975081, -171.9, -5.1, 0], [3972975086, -171.6, -10.7, 0], [3972975103, -171.8, -17, 0], [3972975104, -175.3, -17.3, 0], [3972975107, -162.8, -21.9, 0], [3972975108, -171.5, -23, 0], [3972975115, -171.6, -29, 0], [3972975116, -175, -29.5, 0], [3978403353, -128.3, -167.1, 0], [3978403475, -167.4, -233.7, 1], [11308343404, -169.8, -140.5, 0], [11308343405, -169.7, -147.4, 0], [11308343406, -169.9, -154.4, 0], [11308343407, -170.2, -160.6, 0], [11308343408, -170.2, -167.3, 0], [11308343409, -187.8, -169.2, 0], [11308343410, -180.2, -169.5, 0], [11308343411, -168.8, -132.6, 0], [11308343415, -181.5, -181.5, 0], [11308343416, -171.1, -181.3, 0], [11308343417, -163.2, -181.7, 0], [14069312952, -162.4, -160.4, 0], [14069324637, -0.7, 108.6, 0], [14069361028, -161.8, -134.9, 0], [14069370094, -162.6, -150.8, 0], [14069372392, -70.8, 106.7, 0], [14069381545, -41.9, 102.3, 0], [14069381605, -162, -102.3, 0], [14069391028, -162, -109.2, 0], [14069405386, -161.7, -94.3, 0], [14069405599, -162.2, -88.1, 0], [14069406656, -161.8, -115.4, 0], [14069406657, -161.9, -141.4, 0], [14069407249, -173.3, -80.2, 0], [14069407976, -172.4, -65.5, 0], [14069409731, -146.2, -167.5, 0], [14071516081, -181, -56, 0], [14071516087, -170.7, -50.1, 0], [14071516088, -161.7, -124.7, 0]];
const ARMORY_BOX = { x0: -200, x1: -40, z0: -205, z1: -20 }, NEEDLE_WOODS = ['w394259997'];

/** pushes trees into ctx.trees; call before ctx.osmBackdrop() builds them. needle = { x, z, pavR } */
export function seattleCenterPlanting(ctx, { needle }) {
    const d = ctx.data, r = rng(1962), out = { live: 0, wood: 0, beds: 0 }, have = ctx.trees;
    const blocked = (x, z) => d.buildings.some((b) => !b.part && b.poly && inPoly(x, z, b.poly)) || ctx.exclude.some((p) => inPoly(x, z, p));
    const near = (x, z, m) => have.some((t) => Math.abs(t.x - x) < m && Math.abs(t.z - z) < m && Math.hypot(t.x - x, t.z - z) < m) || d.trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < m);
    const onPath = (x, z) => d.ways.some((w) => /^(footway|pedestrian|path|cycleway|service|steps)$/.test(w.k) && !w.layer && w.pts.some((p, i) => { if (!i) return false; const [ax, az] = w.pts[i - 1], [bx, bz] = p, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(ax + dx * t - x, az + dz * t - z) < 2; }));
    for (const [, x, z, con] of LIVE_TREES) { if (blocked(x, z)) continue; have.push({ x, z, kind: con ? 'con' : 'broad', s: 0.95 + r() * 0.3 }); out.live++; }
    const woods = d.areas.filter((a) => a.natural === 'wood' && a.poly?.length > 2 && (NEEDLE_WOODS.includes(a.id) || (([cx, cz]) => cx > ARMORY_BOX.x0 && cx < ARMORY_BOX.x1 && cz > ARMORY_BOX.z0 && cz < ARMORY_BOX.z1)(centroid(a.poly))));
    for (const a of woods) { const bb = polyBox(a.poly), n = Math.round(Math.abs(polyArea(a.poly)) / 30);
        for (let i = 0, k = 0; i < n * 4 && k < n; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0);
            if (!inPoly(x, z, a.poly) || blocked(x, z) || onPath(x, z) || near(x, z, 3.5)) continue;
            have.push({ x, z, kind: r() < (a.leaf_type === 'broadleaved' ? 0.1 : 0.4) ? 'con' : 'broad', s: 0.75 + r() * 0.5 }); k++; out.wood++; } }
    // the pavilion's beds: OSM landuse=shrubs areas whose centroid is within 40 m of the Needle
    const beds = d.areas.filter((a) => a.landuse === 'shrubs' && a.poly?.length > 2 && (([cx, cz]) => Math.hypot(cx - needle.x, cz - needle.z) < 40)(centroid(a.poly)));
    for (const a of beds) { const bb = polyBox(a.poly), n = Math.round(Math.abs(polyArea(a.poly)) / 7);
        for (let i = 0, k = 0; i < n * 4 && k < n; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0), rr = Math.hypot(x - needle.x, z - needle.z);
            if (!inPoly(x, z, a.poly) || rr < needle.pavR + 1.5 || rr > 30 || onPath(x, z) || near(x, z, 1.6)) continue;
            const tree = rr > needle.pavR + 4 && r() < 0.18;
            have.push({ x, z, kind: tree ? 'broad' : 'shrub', s: tree ? 0.55 + r() * 0.25 : 0.4 + r() * 0.35, c: tree ? undefined : ['#4f6a38', '#5d7340', '#46603a', '#58703f'][k % 4] }); k++; out.beds++; } }
    ctx.extras.seattleCenterPlanting = { ...out, woods: woods.map((a) => a.id), bedAreas: beds.map((a) => a.id) };
    return out;
}
