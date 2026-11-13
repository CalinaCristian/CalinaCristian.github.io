// Boundary walls and fences seen on a street panorama but not mapped as barrier=wall in OpenStreetMap. Each is a documented
// exception: the line is an OSM outline (the edge of the mapped area the wall encloses), the openings are its mapped
// gates, and only the look (material, height, cap) comes from the panorama — viewed, never stored or traced.
// Data © OpenStreetMap contributors (ODbL).
//
// Pipera, Soviet Soldier park (backlog r3-landmarks-9): panorama 44.479208, 26.097410 h 185 shows a ≈ 1.1 m red-brick
// wall with a cap along the Șos. Pipera pavement. OSM maps no barrier there; the wall follows the north edge of the park
// w23731459 (leisure=park, around n1174026151 Monumentul Soldatului Sovietic and the cemetery w28379658), from its
// north-west corner n257012533 to its north-east corner n11871379035, open at the two swing gates n311736694 /
// n311737019 where the park's footway w28379731 enters. Opening width, thickness and the cap are estimates.
export const PARK_WALLS = [
    {
        id: 'w23731459-north', district: 'pipera', name: 'Soviet Soldier park, Șos. Pipera wall',
        line: [[44.4791078, 26.0965095], [44.4791264, 26.0969735], [44.4791570, 26.0976758], [44.4792043, 26.0985534]],
        gates: [[44.4791264, 26.0969735], [44.4791570, 26.0976758]],
        heightM: 1.1, review: 'panorama 44.479208, 26.097410 h 185 (round 3): red brick, a cap; OSM edge of w23731459',
    },
    // (backlog r2-districts-view-12) Muzeul Național al Aviației Române (w392466489, tourism=museum): from Bd. Dimitrie Pompeiu
    // (panorama 44.479143, 26.110517) a concrete panel fence with graffiti closes the museum grounds; OSM maps no barrier. The
    // line is the grounds' edge along the boulevard, n696844080 → n4161774631 → n4161774633 (no mapped gate on it; the museum
    // gates n12973466077 / lift gates n6264315150-51 stand on the service road north of it). Height and post pitch are
    // estimates (the usual 2 m precast panel fence); the graffiti is not drawn.
    {
        id: 'w392466489-north', district: 'pipera', name: 'Aviation museum fence, Bd. Dimitrie Pompeiu',
        line: [[44.4793743, 26.1116741], [44.4791287, 26.1108079], [44.4787391, 26.1088174]], gates: [],
        heightM: 2.0, look: { body: '#a29e95', cap: null, thickM: 0.14, postEveryM: 2.5, post: '#8f8b83' },
        review: 'panorama 44.479143, 26.110517 (round 2): concrete panel fence with graffiti and a tree belt; OSM edge of w392466489',
    },
];
export const PARK_WALL_MODEL = { estimates: 'opening, thickness and cap', gateM: 3.2, thickM: 0.3, capM: 0.08, capOverM: 0.05, brick: '#7c4536', cap: '#b8b2a6' };

/** env: { district, project(lat, lon) -> {x, z}, cellOf, rgb, blocked(x, z, r) -> reason | null, baseY(x, z), addWall(ax, az, bx, bz, h, rec) } */
export function emitParkWalls(env) {
    const out = [], M = PARK_WALL_MODEL;
    for (const w of PARK_WALLS) {
        if (w.district !== env.district) continue;
        const pts = w.line.map(([la, lo]) => env.project(la, lo)), gates = w.gates.map(([la, lo]) => env.project(la, lo));
        const brick = env.rgb(M.brick), cap = env.rgb(M.cap), rec = { id: w.id, metres: 0, skipped: [] }, L0 = w.look || null, body = L0 && env.rgb(L0.body), post = L0 && env.rgb(L0.post);
        for (let k = 0; k + 1 < pts.length; k++) {
            const a = pts[k], b = pts[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 0.2) continue;
            const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
            // cut the openings: a gate within half the opening of this segment removes that stretch
            let spans = [[0, L]];
            for (const g of gates) { const t = (g.x - a.x) * ux + (g.z - a.z) * uz, d = Math.abs(-(g.x - a.x) * uz + (g.z - a.z) * ux); if (d > 1) continue;
                spans = spans.flatMap(([s, e]) => { const g0 = t - M.gateM / 2, g1 = t + M.gateM / 2; if (g1 <= s || g0 >= e) return [[s, e]]; return [[s, g0], [g1, e]].filter(([p, q]) => q - p > 0.3); }); }
            for (const [s, e] of spans) for (let t = s; t < e - 0.05; t += 4) { // pieces of at most 4 m: a blocked piece drops alone
                const t1 = Math.min(e, t + 4), x0 = a.x + ux * t, z0 = a.z + uz * t, x1 = a.x + ux * t1, z1 = a.z + uz * t1, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
                const why = env.blocked(mx, mz, M.thickM); if (why) { rec.skipped.push({ x: +mx.toFixed(1), z: +mz.toFixed(1), why }); continue; }
                const y = env.baseY(mx, mz) - 0.05, len = t1 - t, rot = Math.atan2(ux, uz), c = env.cellOf(mx, mz).solid;
                if (L0) { // panel fence: thin panels between posts
                    c.box(mx, y, mz, L0.thickM, w.heightM + 0.05, len, rot, body);
                    for (let q = Math.ceil(t / L0.postEveryM) * L0.postEveryM; q <= t1; q += L0.postEveryM) c.box(a.x + ux * q, y, a.z + uz * q, L0.thickM + 0.12, w.heightM + 0.15, 0.18, rot, post);
                } else {
                    c.box(mx, y, mz, M.thickM, w.heightM - M.capM + 0.05, len, rot, brick);
                    c.box(mx, y + w.heightM - M.capM + 0.05, mz, M.thickM + M.capOverM * 2, M.capM, len + 0.02, rot, cap);
                }
                env.addWall(x0, z0, x1, z1, w.heightM, w); rec.metres += len;
            }
        }
        rec.metres = +rec.metres.toFixed(1); out.push(rec);
    }
    return out;
}
