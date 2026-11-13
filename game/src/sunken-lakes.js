// Lakes drawn below the street, with a sloped bank, and one documented outline exception (backlog pipera-2).
// Data © OpenStreetMap contributors (ODbL); levels: EU-DEM v1.1 (Copernicus) via OpenTopoData, sampled 2026-11-13.
//
// The district ground is flat: streets, buildings and the crowd stay at 0. A lake listed here keeps its mapped outline
// (OSM decides where the water is) but its surface is drawn below the street with a bank inside the outline, like the
// sunken river channels (world.js CHAN, water-channel-review.js): the ground layers are cut over the water, the bank is
// a grass slope down to a strip of concrete slab revetment at the waterline (the 1930s regularisation of the Colentina
// lakes). No source gives a water level relative to the street; the figures below are estimates:
//  - Lacul Plumbuita r11546654: EU-DEM water surface 63.3–63.8 m, Strada Petricani on the bridge 64.3 m (a smoothed
//    surface model under-reads a deck); the bridge panorama (44.474233, 26.124001 h 95, game/research/bucharest-pipera.md)
//    shows the water "some metres below" the east railing. Estimate: 2.0 m below the street.
//  - Lacul Tei w117140697: EU-DEM water 63.3 m; the park banks round it read about 1.5 m above the water on the Herăstrău
//    chain's own scene review (buc-herastrau.js). Estimate: 1.5 m. The streets on the terraces round the valley stand
//    76–82 m (EU-DEM), far above the lake: the flat district cannot show that valley, only the bank.
// Bank widths (2.4 m slope, 0.9 m revetment, 1.2 m slope on the Colentina band) are estimates.
import { defaultSpecies } from './trees.js';

export const SUNKEN_LAKES = {
    pipera: {
        r11546654: { name: 'Lacul Plumbuita', water: -2.0, slopeW: 2.4, revW: 0.9, source: 'EU-DEM 63.3–63.8 m water vs 64.3 m deck; bridge panorama: water some metres below; level estimate' },
        w117140697: { name: 'Lacul Tei', water: -1.5, slopeW: 2.4, revW: 0.9, source: 'EU-DEM 63.3 m water; bank height as the Colentina chain review (buc-herastrau.js); level estimate' },
        w117140691: { name: 'Colentina through Pajiștea Petricani', water: -1.2, slopeW: 1.2, revW: 0.5, natural: true, source: 'stream band of the outline exception below; level estimate' },
    },
};

// Outline exception: w117140691 "Lacul Tei" is a 2006 CORINE import (CLC:year 2006, 27 nodes in the pack) that covers the
// strip south of the Petricani bridge as open water. Live OSM (2026-11-13) maps that strip as land: the protected meadow
// "Aria naturală protejată Pajiștea Petricani" w1420394521, meadow w1420395543 / w1420388611, grass w1420394519,
// reedbeds w1254087120 / w1254087121 / w1254087122 and dirt paths (Poteca principală) all lie inside it, and the only
// water mapped through it is the Colentina river line w231801791. 46 crowns measured on the aerial survey
// (trees-bucharest-pipera.json) stand inside the coarse outline; the nearest is 6.9 m from the river line. The bridge
// panorama (h 275) shows a gravel / green strip and no water west of the bridge. So inside this outline only a band
// along the mapped river line is water: half-width 4 m (estimate: inside the 4.7 m the nearest measured crown leaves).
// The source outline is kept in the data; the band is built from the pack's own river line at load.
export const WATER_OUTLINE_EXCEPTIONS = {
    pipera: {
        w117140691: { kind: 'river-band', halfW: 4, review: 'OSM meadow / reedbed / nature reserve inside the CORINE outline; 46 measured crowns; bridge panorama h 275: no water west of the bridge' },
    },
};

// The 46 crowns of the aerial survey (game/research/trees-bucharest-pipera.json, [lat, lon, crown radius m]) that stand
// inside the coarse outline w117140691: the pack builder left them out as trees in water. With the outline narrowed they
// stand on the mapped meadow; the world still refuses any whose trunk falls in the river band.
export const OUTLINE_EXCEPTION_CROWNS = {
    pipera: [[44.470691, 26.122897, 3.1], [44.470706, 26.122962, 3.5], [44.471387, 26.122511, 3.9], [44.471433, 26.1225, 3.1], [44.471448, 26.122597, 2.2],
        [44.471502, 26.122554, 4.4], [44.471563, 26.123788, 8.4], [44.47164, 26.122586, 5.3], [44.471686, 26.123863, 6.9], [44.471709, 26.122651, 3.9],
        [44.471793, 26.123884, 3.5], [44.471824, 26.122608, 6.6], [44.471824, 26.124056, 6], [44.471839, 26.122726, 2.8], [44.471877, 26.124131, 4.9],
        [44.471885, 26.122726, 2.2], [44.471885, 26.123938, 2.8], [44.471893, 26.122661, 3.5], [44.471923, 26.122769, 3.1], [44.471923, 26.124088, 4.9],
        [44.471984, 26.122769, 4.4], [44.472015, 26.122651, 7.1], [44.472069, 26.124024, 2.2], [44.472145, 26.122779, 9], [44.472206, 26.124002, 3.1],
        [44.472291, 26.122844, 9], [44.472306, 26.123959, 3.1], [44.472314, 26.12309, 3.1], [44.472474, 26.122693, 9], [44.472589, 26.122704, 5],
        [44.47275, 26.122597, 3.5], [44.472918, 26.122597, 5.5], [44.472995, 26.122586, 2.2], [44.473079, 26.122597, 5.9], [44.473485, 26.122565, 2.8],
        [44.473585, 26.122565, 6], [44.473676, 26.12264, 4], [44.473768, 26.122661, 6.3], [44.473799, 26.122801, 7.1], [44.473883, 26.122779, 6.2],
        [44.473998, 26.122769, 3.5], [44.474128, 26.122779, 4.4], [44.474235, 26.122865, 2.8], [44.474304, 26.12309, 3.1], [44.474312, 26.123219, 2.2],
        [44.474381, 26.123262, 4.9]],
};

/** places the measured crowns of the district's outline exceptions with the world's placeTree; returns { placed, refused } */
export function placeOutlineExceptionCrowns(distId, proj, placeTree) {
    let placed = 0, refused = 0;
    for (const [lat, lon, r] of OUTLINE_EXCEPTION_CROWNS[distId] || []) {
        const p = proj(lat, lon), h = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453) % 1; // (species from the position: the world's random stream is not consumed)
        if (placeTree(p.x, p.z, 1, 'osm', false, 1, { crownRadiusM: r, h: Math.min(20, r * 3), species: defaultSpecies('bucharest', 'park', 0, h) })) placed++; else refused++;
    }
    return { placed, refused };
}

export const sunkenLake = (district, sourceId) => SUNKEN_LAKES[district]?.[sourceId] || null;

/** the narrowed outline for an exception, or null: the river line's run inside `outer`, offset ±halfW (mitred) */
export function waterOutlineException(district, sourceId, outer, riverLines, pointInPolygon) {
    const ex = WATER_OUTLINE_EXCEPTIONS[district]?.[sourceId]; if (!ex || ex.kind !== 'river-band') return null;
    let best = null;
    for (const pts of riverLines) {
        let run = [];
        const flush = () => { if (run.length >= 2 && (!best || run.length > best.length)) best = run; run = []; };
        for (let i = 0; i < pts.length; i++) {
            if (pointInPolygon(pts[i][0], pts[i][1], outer)) {
                if (!run.length && i > 0) run.push(pts[i - 1]); // one vertex beyond the outline at each end: the band meets the next water
                run.push(pts[i]);
            } else if (run.length) { run.push(pts[i]); flush(); }
        }
        flush();
    }
    if (!best) return null;
    const hw = ex.halfW, n = best.length, left = [], right = [];
    for (let i = 0; i < n; i++) {
        const p = best[i], a = best[Math.max(0, i - 1)], b = best[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        let mx = -dz, mz = dx, scale = 1;
        if (i > 0 && i < n - 1) { // mitre: the offset along the bisector, clamped at sharp bends
            const ux = p[0] - a[0], uz = p[1] - a[1], Lu = Math.hypot(ux, uz) || 1, nx = -uz / Lu, nz = ux / Lu;
            scale = Math.min(2, 1 / Math.max(0.5, mx * nx + mz * nz));
        }
        left.push([p[0] + mx * hw * scale, p[1] + mz * hw * scale]); right.push([p[0] - mx * hw * scale, p[1] - mz * hw * scale]);
    }
    return { ring: left.concat(right.reverse()), line: best, halfW: hw, review: ex.review };
}

/** One bank piece (≤ 4 m of shoreline) of a sunken lake, drawn inside the outline. env: { sb (MeshBuilder), P(t, o, y),
 *  t0, t1, nx, nz, prof, grass, earth, slab } */
export function emitLakeBankPiece({ sb, P, t0, t1, nx, nz, prof, grass, slab, earth }) {
    const s = prof.slopeW, r = s + prof.revW, yTop = 0.03, yToe = prof.water + (prof.natural ? 0.15 : 0.45);
    sb.face4(P(t0, -0.6, yTop), P(t1, -0.6, yTop), P(t1, 0, yTop), P(t0, 0, yTop), grass, [0, 1, 0]); // (closes the ground's cut edge)
    sb.face4(P(t0, 0, yTop), P(t1, 0, yTop), P(t1, s, yToe), P(t0, s, yToe), grass, [nx, 1.2, nz]);  // grass bank
    sb.face4(P(t0, s, yToe), P(t1, s, yToe), P(t1, r, prof.water - 0.35), P(t0, r, prof.water - 0.35), prof.natural ? earth : slab, [nx, 1.6, nz]); // revetment / muddy edge
}
