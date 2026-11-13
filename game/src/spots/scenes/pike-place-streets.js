// ============================================================================
//  Pike Place Market — surveyed street levels.
//  Source: USGS 3DEP 1 m bare-earth DEM (EPQS point queries, 2026-11-11) sampled every ~6 m along the OpenStreetMap
//  centrelines, reduced to the points where the grade changes. [x east, z south, y] in metres; y is relative to the
//  scene origin (1st Ave at Pike St, 36.8 m NAVD88).
//
//  What the survey says (and Street View shows): Pike St drops only 0.8 m from 1st Ave to Pike Place; Pike Place
//  itself falls gently north (−1.2 m at Pike St, −5.3 m at Virginia St) while 1st Ave climbs, so Pine, Stewart and
//  Virginia are the steep blocks; the steep cobbled piece at Pike St is the separate ramp along the Economy Market
//  that dives under the market into Post Alley (the Gum Wall), which keeps falling to Union St.
// ============================================================================
import { distPolyline, lerp } from '../kit.js';

export const SURVEY = {
    pikeSt: [[-9.9, 13.9, -0.42], [-22.5, 15.9, -0.53], [-25.4, 17.8, -0.67], [-50.3, 33, -1.22]],
    pikePlace: [[-50.3, 33, -1.22], [-59.7, 24.6, -1.24], [-63.9, 21, -1.24], [-68, 17.3, -1.34], [-72.2, 13.7, -1.42], [-94.7, -6.3, -1.89], [-136.1, -43, -2.92], [-172, -75, -3.51], [-227.6, -123.8, -4.68], [-270, -161, -5.27]],
    firstAve: [[58.8, 126.4, -8.44], [50.8, 113.1, -7.79], [44.5, 102.7, -7.03], [28.6, 76.8, -4.89], [1, 31.6, -1.38], [-4.6, 22.6, -0.83], [-7.2, 18.2, -0.6], [-13.3, 8.3, -0.18], [-16.8, 2.8, 0.07], [-20.2, -2.8, 0.37], [-23.4, -7.9, 0.7], [-26.5, -13.1, 1.03], [-32.9, -23.3, 1.65], [-36, -28.5, 1.97], [-42.1, -38.4, 2.54], [-44.9, -43.3, 2.86], [-50.8, -53.2, 3.45], [-74.3, -92.9, 5.69], [-89.6, -117.9, 6.36], [-105.6, -143.9, 7.32], [-108.8, -149.1, 7.42], [-118.2, -157.4, 7.59], [-137, -174, 8.1], [-196.8, -225.1, 9.62], [-206, -233, 9.71]],
    postAlleyN: [[-94.7, -6.3, -1.89], [-89.4, -12, -1.82], [-88.6, -12.9, -1.78], [-89.8, -17.7, -1.72], [-98.1, -30.6, -1.14], [-104.2, -40, -0.92], [-113.2, -54.1, -0.27], [-116, -58.5, -0.27], [-118.8, -62.8, -0.19], [-121.9, -68.4, -0.05], [-125, -74, 0.21], [-131.8, -84.8, 0.8], [-138.7, -95.6, 1.08], [-142.1, -101, 1.1], [-143.5, -106, 1.54], [-146.3, -116, 2.12], [-164.2, -131.5, 2.06], [-182.2, -146.9, 2.19], [-204.6, -166.2, 2.13], [-213.6, -173.9, 2.19], [-218, -177.8, 2.21], [-231.5, -189.4, 2.41]],
    pine: [[-76.8, -97.1, 5.83], [-87.7, -90.4, 5.67], [-93.2, -87, 5.28], [-98.4, -83.8, 4.32], [-108.9, -77.3, 2.59], [-114.2, -74.1, 1.39], [-119.4, -70.8, 0.41], [-124.7, -67.6, -0.5], [-129.9, -64.4, -1.3], [-135.2, -61.1, -2.31], [-140.4, -57.9, -3], [-147.9, -53.3, -3.12]],
    stewart: [[-108.8, -149.1, 7.42], [-116.4, -140.2, 7.28], [-120.2, -135.7, 7.06], [-132.2, -121.6, 4.43], [-152.1, -98.1, -0.28], [-164.1, -84, -2.96], [-168.1, -79.3, -3.51], [-172.1, -74.6, -3.51]],
    virginia: [[-214.5, -222.4, 9.13], [-218.4, -218, 7.93], [-222.4, -213.7, 6.84], [-226.3, -209.3, 5.74], [-230.2, -205, 4.49], [-234.2, -200.6, 3.39], [-238.1, -196.3, 2.44], [-246, -187.5, 0.15], [-249.9, -183.2, -1.13], [-257.8, -174.5, -3.38], [-261.7, -170.1, -4.64], [-265.7, -165.8, -5.2], [-269.6, -161.4, -5.27], [-274.9, -158.5, -5.35], [-280.3, -155.7, -5.39], [-285.6, -152.8, -5.52]],
    western: [[-25.6, 177, -25.24], [-41.4, 151.5, -23.71], [-54, 131.1, -22.63], [-57.2, 126.1, -22.27], [-63.5, 115.9, -21.82], [-88.9, 75, -19.23], [-123.8, 20.1, -15.95], [-136.1, 0.7, -14.88], [-139.3, -4.1, -14.62], [-142.4, -9, -14.28], [-148.6, -18.8, -13.79], [-152.3, -24.1, -13.49], [-156.1, -29.3, -13.24], [-159.8, -34.6, -12.87], [-169.2, -42.7, -12.35], [-173.9, -46.8, -12.01], [-178.7, -50.8, -11.69], [-192.8, -63, -10.77]],
    // the lower level: the cobbled Pike St ramp (OSM w52563652) from the 1st Ave kerb down along the Economy Market,
    // the turn under the market (w1027523814) and Post Alley south past the Gum Wall (w52563651 …) to Union St.
    // The DEM is noisy under the buildings (−5.05 / −6.02 three metres apart): the bottom of the ramp is eased.
    lower: [[-21.1, 27.5, -1.22], [-45.2, 42.8, -4.89], [-47.4, 44.2, -5.2], [-50.2, 46.4, -5.65], [-48.9, 48.5, -6.0], [-36.2, 68.9, -8.06], [-33.5, 73.3, -8.58], [-25, 87.2, -10.71], [-21.9, 92.2, -11.35], [0, 127.6, -16.28], [8.3, 141.1, -18.46], [11.1, 145.6, -19.1]],
};

/** a surveyed line as a profile: at(x, z) → { s, d, y } (station along it, distance from it, level there) */
export function profile(line) {
    const pts = line.map(([x, z]) => [x, z]), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const yAt = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = Math.min(1, Math.max(0, (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1))); return lerp(line[i - 1][2], line[i][2], u); };
    const at = (x, z) => { const r = distPolyline(x, z, pts), s = cum[r.i] + r.t * (cum[r.i + 1] - cum[r.i]); return { s, d: r.d, y: yAt(s), cx: r.cx, cz: r.cz }; };
    return { pts, cum, len: cum[cum.length - 1], yAt, at };
}

// flat width across (carriageway + both sidewalks up to the building lines) and the blend beyond it, in metres
const BANDS = [
    ['firstAve', 26, 6], ['western', 14, 5], ['pine', 16, 5], ['stewart', 14, 5], ['virginia', 14, 5],
    ['pikeSt', 26, 3],    // from the Corner Market wall (12.5 m north of the OSM line) to the retaining wall of the ramp
    ['pikePlace', 22, 5], ['postAlleyN', 12, 3], // (the alley is 5 m wide; the band reaches under its buildings)
];

/**
 * Grade every street of the market to its surveyed profile (flat across, linear between the survey points).
 * Call before ctx.osmBackdrop(): the lots between the streets then settle onto these levels.
 */
export function gradeStreets(ground) {
    for (const [name, w, edge] of BANDS) {
        const line = SURVEY[name], ys = new Map(line.map(([x, z, y]) => [x + ',' + z, y]));
        ground.corridor(line.map(([x, z]) => [x, z]), w, edge, (x, z) => ys.get(x + ',' + z));
    }
    // Post Alley south of the market (beyond the exact floor built by pike-place-lower.js): between buildings, so the
    // band is wider than the alley and its banks stay inside them
    { const line = SURVEY.lower.slice(6), ys = new Map(line.map(([x, z, y]) => [x + ',' + z, y])); ground.corridor(line.map(([x, z]) => [x, z]), 13, 4, (x, z) => ys.get(x + ',' + z)); }
}

/**
 * Western Ave's east (market) bank: between the 14 m street band and the market's lower walls the terrain rose 2–4 m
 * as pale mounds on the sidewalk (sea-spots-a-13, 47.60878,-122.34155). The ground there is the street's own surveyed
 * level out to 13 m from the centre line (also just inside the walls), easing back to the DEM by 17 m outside the
 * footprints; deeper inside the footprints (hidden by their walls) nothing changes. Call after gradeStreets().
 */
export function gradeWesternEastBank(ground, footprints) {
    const P = profile(SURVEY.western), bb = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
    for (const [x, z] of P.pts) { bb.x0 = Math.min(bb.x0, x - 18); bb.x1 = Math.max(bb.x1, x + 18); bb.z0 = Math.min(bb.z0, z - 18); bb.z1 = Math.max(bb.z1, z + 18); }
    const boxes = footprints.filter((p) => p?.length > 2).map((p) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { p, x0, z0, x1, z1 }; });
    const inside = (x, z) => boxes.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPolyLocal(x, z, b.p));
    ground.mod((x, z, h) => {
        if (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1) return h;
        const r = P.at(x, z); if (r.d < 7 || r.d > 17) return h;
        // east of the line only: the line runs north-west, so the market lies on its left (cross product > 0)
        const i = Math.min(P.pts.length - 2, Math.max(0, P.cum.findIndex((c) => c >= r.s) - 1)), [ax, az] = P.pts[i], [bx, bz] = P.pts[i + 1];
        if ((bx - ax) * (z - az) - (bz - az) * (x - ax) <= 0 || h <= r.y) return h;
        // (the flat reaches 13 m also under the footprints' edges: the 2 m terrain grid otherwise ramps up in front of a wall)
        if (r.d > 13 && inside(x, z)) return h;
        const k = Math.min(1, Math.max(0, (r.d - 13) / 4)), s = k * k * (3 - 2 * k);
        return r.y + (h - r.y) * s;
    });
}
function inPolyLocal(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
