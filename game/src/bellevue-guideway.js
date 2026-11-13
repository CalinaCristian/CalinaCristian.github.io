// Bellevue district: the Link 2 Line aerial guideway between Bellevue Downtown and Wilburton stations.
//
// OSM maps both tracks as `railway=light_rail`, `bridge=yes`, `layer=2` (w669516620, w1154876472), two crossovers on
// the bridge (w762965202 / w762965203) and, west of 112th Ave NE, the station tracks with `layer=1` (w614517901 /
// w669516619). The generic railway pass in world.js leaves bridge / layered ways undrawn because an OSM layer is ordinal,
// not a height, so the game showed open sky where the guideway crosses I-405.
//
// What is sourced
//  - plan geometry, which ways are on a bridge, where the tracks are at grade again (OSM: the ways north of the bridge
//    ways, w669516621 / w328246201, carry no bridge tag);
//  - structure type: an elevated crossing of I-405 ("long-span aerial guideway", an 810 ft bridge; Sound Transit project
//    updates) and an elevated Wilburton station with its platform above NE 8th St (en.wikipedia.org/wiki/Wilburton_station_(Sound_Transit));
//  - ground level under the track: USGS 3DEP bare-earth elevations sampled every 50 m along w669516620 on 2026-11-12
//    (epqs.nationalmap.gov), GROUND_M below, and the streets crossed (OSM): 112th Ave NE, I-405, 116th Ave NE, NE 8th St.
// What is an ESTIMATE (no published rail profile was found; Street View was not compared for this structure)
//  - the rail level: RAIL_M below. 42.1 m at the west end = 112th Ave NE (ground 35.6 m) + 5 m clearance + 1.5 m of
//    structure; 51.3 m over NE 8th St (street 44.3 m) + 5 m + 2 m, held along the Wilburton platform; a straight grade in
//    between (1.3 %) and down to the at-grade track at the north end of the bridge ways. The deck height drawn over the
//    game's flat ground is rail level minus the ground level under it (6 - 18 m; highest over the I-405 valley);
//  - girder depth, deck width, parapet, pier section, pier spacing and positions (OSM maps no supports). Piers stand only
//    clear of carriageways (district roads and scenery streets) and buildings; where none fits the span stays open.
// Wilburton station (platform w922284294, roof w615292866, lifts) is drawn from live OSM coordinates below (emitWilburton) and the
// overhead line by guideway-ocs.js (estimates). Not drawn: Bellevue Downtown station (outside the district), trains.
import { GUIDEWAY_OCS, ocsWires, ocsPole } from './guideway-ocs.js';
export const BELLEVUE_GUIDEWAY = {
    mains: ['w669516620', 'w1154876472'],
    others: ['w762965202', 'w762965203', 'w614517901', 'w669516619'],
    // [metres along w669516620, rail elevation m] — estimate, see above
    RAIL_M: [[-120, 42.1], [0, 42.1], [690, 51.3], [840, 51.3], [1144, 46.95]],
    // [metres along w669516620, USGS 3DEP ground elevation m]; the first two are along the station tracks west of the bridge
    GROUND_M: [[-100, 41.2], [-50, 39.4], [0, 35.6], [50, 33.2], [100, 30.5], [150, 30.2], [200, 30.4], [250, 28.3], [300, 28.4], [350, 29.2], [400, 31.1], [450, 34.1], [500, 36.9], [550, 38.5], [600, 42.6], [650, 44.25],
        [700, 44.3], [750, 44.8], [800, 45.1], [850, 45.0], [900, 43.4], [950, 44.2], [1000, 43.6], [1050, 43.8], [1100, 44.9], [1144, 46.5]],
    endTopM: 0.45, girderM: 2.2, outerHalfM: 2.6, pierEveryM: 34, sharedM: 14, pierMinTopM: 5.0,
    // (r2-world-b-guideway-colour) the span over I-405 has steel girders painted sage green (official panoramas 47.61504, -122.188416
    // h60 and 47.616547, -122.184279 h180, round 2b); the rest of the structure is grey concrete. Metres along w669516620: OSM puts
    // I-405 and its ramps between 141 and 221 m; the span ends are the nearest piers the game places outside them (estimate: the real
    // pier positions are not mapped). The parapets stay concrete.
    steelSpanM: [129, 232], steelCol: '#7f9a83',
};

// (r2-world-guideway) Wilburton station, from live OSM (2026-11-13): the island platform w922284294 (railway=platform, bridge=yes,
// layer=1, shelter=yes), the station roof w615292866 (building=train_station, layer=1, same outline plus the stair heads) and the
// two lifts n11812430045 / n11812430046 (highway=elevator, level 0;1). Estimates: platform 0.36 m above the rail (Link's low-floor
// platform height), roof 4.2 m clear and 0.5 m deep on one row of columns down the platform centre every 12 m, lift shafts 2.4 m
// square; the stairs (w1273554471-73, w1274300267) and the station's look were not compared with a panorama and are not drawn.
export const WILBURTON_STATION = {
    platform: [[47.6174519, -122.1837911], [47.6174581, -122.1839299], [47.6184580, -122.1838298], [47.6184574, -122.1838165], [47.6184518, -122.1836939]],
    roof: [[47.6179844, -122.1839038], [47.6184580, -122.1838298], [47.6184574, -122.1838165], [47.6184532, -122.1837240], [47.6184517, -122.1836934], [47.6181790, -122.1837200], [47.6177655, -122.1837605], [47.6174519, -122.1837911], [47.6174581, -122.1839299]],
    lifts: [[47.6181412, -122.1837575], [47.6178067, -122.1837915]],
    replacesSource: 'w615292866', aboveRailM: 0.36, roofClearM: 4.2, roofDepthM: 0.5, columnEveryM: 12, liftM: 2.4,
};

const lerpTable = (T, s) => { if (s <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (s <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[1] + (b[1] - a[1]) * (s - a[0]) / (b[0] - a[0] || 1); } return T[T.length - 1][1]; };
/** deck (rail) height above the game's flat ground, s metres along the first main track (negative: station tracks) */
export const bellevueRailTop = (s) => Math.max(BELLEVUE_GUIDEWAY.endTopM, lerpTable(BELLEVUE_GUIDEWAY.RAIL_M, s) - lerpTable(BELLEVUE_GUIDEWAY.GROUND_M, s));

function quad(m, P, n, col) {
    const id = P.map(p => m.v(p[0], p[1], p[2], n[0], n[1], n[2], (p[0] + p[2]) * 0.125, p[1] * 0.125, col));
    const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2], bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
    const f = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2];
    if (f >= 0) { m.tri(id[0], id[1], id[2]); m.tri(id[0], id[2], id[3]); } else { m.tri(id[0], id[2], id[1]); m.tri(id[0], id[3], id[2]); }
}
function resample(pts, step) {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
        const n = Math.max(1, Math.ceil(L / step));
        for (let j = out.length ? 1 : 0; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    return out;
}
// nearest point of a polyline: distance, position and metres along it
function nearestOn(pts, cum, x, z) {
    let best = { d: Infinity, x: 0, z: 0, s: 0 };
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < best.d) best = { d, x: px, z: pz, s: cum[i - 1] + (cum[i] - cum[i - 1]) * t };
    }
    return best;
}
const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };

/**
 * env: { railways, scenery, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl, keep(x, z, len) }
 * Returns { ways: Set of handled way ids, metres, piers, piersOmitted, maxTopM } (an audit record for world stats).
 */
export function emitBellevueGuideway(env) {
    const CON = env.rgb('#c4c1ba'), PIER = env.rgb('#bcb9b2'), RAIL = env.rgb('#6d7174'), WALL = env.rgb('#a9a6a0'), OCSW = env.rgb(GUIDEWAY_OCS.wireColour), OCSP = env.rgb(GUIDEWAY_OCS.colour), STEEL = env.rgb(BELLEVUE_GUIDEWAY.steelCol);
    const G = BELLEVUE_GUIDEWAY, byId = new Map((env.railways || []).map(r => [r.id, r]));
    const line = (id) => { const r = byId.get(id); return r ? env.undelta(r.points, 0) : null; };
    const mains = G.mains.map(line), out = { ways: new Set(), metres: 0, piers: 0, piersOmitted: 0, ocsPoles: 0, pierS: [], steelMetres: 0, maxTopM: 0, railLevel: 'estimate (clearances over 112th Ave NE and NE 8th St + USGS 3DEP ground)' };
    if (!mains[0] || !mains[1]) return out;
    const cum0 = cumOf(mains[0]), start = mains[0][0];
    // metres along the first main; west of its start (the station tracks) the distance from the start counts negative
    const along = (x, z) => { const q = nearestOn(mains[0], cum0, x, z); return q.s < 0.01 && q.d > 1 ? -Math.hypot(x - start[0], z - start[1]) : q.s; };
    // scenery streets (no entry in the drivable graph): [ax, az, bx, bz, half width]
    const streets = [];
    for (const row of env.scenery || []) { const half = (row[0] || 60) / 20 + 0.5, pts = env.undelta(row, 4); for (let i = 1; i < pts.length; i++) streets.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], half]); }
    const onStreet = (x, z, r) => {
        if (env.onRibbon(x, z, r)) return true;
        for (const [ax, az, bx, bz, half] of streets) {
            const lim = half + r; if (x < Math.min(ax, bx) - lim || x > Math.max(ax, bx) + lim || z < Math.min(az, bz) - lim || z > Math.max(az, bz) + lim) continue;
            const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
            if (Math.hypot(x - ax - dx * t, z - az - dz * t) < lim) return true;
        }
        return false;
    };
    const emit = (id, pts, other, piers) => {
        const st = resample(pts, 8), N = st.length; if (N < 2) return;
        // (r2-perf-3, visual QA flicker under the SeaTac guideway) the two mains share one deck while they are less than sharedM
        // apart: round the station and the pocket track OSM spreads them 9.4 - 12 m, and with the old 9 m limit they had separate
        // decks with inner parapets whose faces stood a few cm from the decks of the sidings / crossovers between them. Decks that
        // overlap are not coplanar: the second main's inner edge overlaps the first by 4 cm and the sidings / crossovers lie on
        // the mains' deck, so their top sits slightly lower and their soffit slightly higher and the first main's faces win.
        const lift = id === G.mains[0] ? [0, 0] : id === G.mains[1] ? [-0.015, 0.04] : [-0.03, 0.08];
        const otherCum = other ? cumOf(other) : null;
        const S = st.map((p, i) => {
            const a = st[Math.max(0, i - 1)], b = st[Math.min(N - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux;
            let wl = G.outerHalfM, wr = wl, side = 0, half = 0;
            if (other) { const q = nearestOn(other, otherCum, p[0], p[1]); if (q.d < G.sharedM) { side = (q.x - p[0]) * nx + (q.z - p[1]) * nz >= 0 ? 1 : -1; half = q.d / 2; if (side > 0) wl = half + 0.02; else wr = half + 0.02; } }
            const top = bellevueRailTop(along(p[0], p[1]));
            const depth = top < G.pierMinTopM ? top - 0.02 : G.girderM;
            return { x: p[0], z: p[1], ux, uz, nx, nz, wl, wr, side, half, top: top + lift[0], depth: depth + lift[0] - lift[1] };
        });
        let run = 0, nextPier = G.pierEveryM / 2, nextPole = 12;
        for (let i = 1; i < N; i++) {
            const a = S[i - 1], b = S[i], L = Math.hypot(b.x - a.x, b.z - a.z), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            run += L;
            if (!env.keep(mx, mz, L)) continue;
            const m = env.cellOf(mx, mz).solid, P = (s, w, y) => [s.x + s.nx * w, y, s.z + s.nz * w];
            const fill = a.top < G.pierMinTopM, sMid = along(mx, mz), steel = !fill && sMid >= G.steelSpanM[0] && sMid <= G.steelSpanM[1], col = fill ? WALL : steel ? STEEL : CON;
            if (steel) out.steelMetres += L;
            out.maxTopM = Math.max(out.maxTopM, a.top);
            quad(m, [P(a, a.wl, a.top), P(b, b.wl, b.top), P(b, -b.wr, b.top), P(a, -a.wr, a.top)], [0, 1, 0], CON);
            if (!fill) quad(m, [P(a, a.wl, a.top - a.depth), P(b, b.wl, b.top - b.depth), P(b, -b.wr, b.top - b.depth), P(a, -a.wr, a.top - a.depth)], [0, -1, 0], steel ? STEEL : CON);
            for (const sgn of [1, -1]) {
                if (a.side === sgn && b.side === sgn) continue; // the face toward the other track is inside the shared deck
                const wa = sgn > 0 ? a.wl : -a.wr, wb = sgn > 0 ? b.wl : -b.wr, n = [a.nx * sgn, 0, a.nz * sgn];
                if (steel) { quad(m, [P(a, wa, a.top + 0.9), P(b, wb, b.top + 0.9), P(b, wb, b.top), P(a, wa, a.top)], n, CON); quad(m, [P(a, wa, a.top), P(b, wb, b.top), P(b, wb, b.top - b.depth), P(a, wa, a.top - a.depth)], n, col); } // (the parapet above the deck stays concrete)
                else quad(m, [P(a, wa, a.top + 0.9), P(b, wb, b.top + 0.9), P(b, wb, b.top - b.depth), P(a, wa, a.top - a.depth)], n, col);
                const ia = wa - 0.25 * sgn, ib = wb - 0.25 * sgn; // parapet: inner face + cap
                quad(m, [P(a, ia, a.top + 0.9), P(b, ib, b.top + 0.9), P(b, ib, b.top), P(a, ia, a.top)], [-n[0], 0, -n[2]], CON);
                quad(m, [P(a, wa, a.top + 0.9), P(b, wb, b.top + 0.9), P(b, ib, b.top + 0.9), P(a, ia, a.top + 0.9)], [0, 1, 0], CON);
            }
            for (const g of [-0.7175, 0.7175]) quad(m, [P(a, g + 0.05, a.top + 0.16), P(b, g + 0.05, b.top + 0.16), P(b, g - 0.05, b.top + 0.16), P(a, g - 0.05, a.top + 0.16)], [0, 1, 0], RAIL); // 1435 mm gauge
            out.metres += L;
            if (other) { // (seatac-7 / r2-world-guideway) overhead contact line: guideway-ocs.js (estimates)
                ocsWires(quad, P, m, a, b, OCSW);
                if (id === G.mains[0] && run >= nextPole) { nextPole = run + GUIDEWAY_OCS.poleEveryM; out.ocsPoles += ocsPole(env, a, OCSP); }
            }
            if (fill) { if (i % 2 === 0 && !onStreet(mx, mz, 2.6)) env.addPropColl(mx, mz, Math.max(a.wl, a.wr) + 0.3, 'guideway'); continue; }
            if (!piers || run < nextPier) continue;
            nextPier = run + G.pierEveryM;
            // one column between the two tracks, under a hammerhead; shifted along the track off carriageways / buildings, else omitted
            let placed = false;
            for (const k of [0, 1, -1, 2, -2, 3, -3]) {
                const j = Math.max(1, Math.min(N - 1, i + k)), s = S[j], off = s.side * s.half, px = s.x + s.nx * off, pz = s.z + s.nz * off;
                if (s.top < G.pierMinTopM || onStreet(px, pz, 1.9) || env.buildingAt(px, pz)) continue;
                const cell = env.cellOf(px, pz).solid, ang = Math.atan2(s.ux, s.uz), soffit = s.top - G.girderM;
                cell.box(px, 0.1, pz, 2.0, soffit - 1.3, 2.2, ang, PIER);
                cell.box(px, soffit - 1.3, pz, 6.4, 1.3, 2.4, ang, PIER);
                env.addPropColl(px, pz, 1.4, 'guideway'); out.piers++; out.pierS.push(Math.round(along(px, pz))); placed = true; break;
            }
            if (!placed) out.piersOmitted++;
        }
        out.ways.add(id);
    };
    emit(G.mains[0], mains[0], mains[1], true); emit(G.mains[1], mains[1], mains[0], false);
    for (const id of G.others) { const pts = line(id); if (pts) emit(id, pts, null, false); }
    if (env.proj) out.wilburton = emitWilburton(env, along);
    out.metres = Math.round(out.metres); out.maxTopM = +out.maxTopM.toFixed(1);
    return out;
}

// a flat-topped prism over a convex ring [x, z][] from y0(x, z) to y1(x, z) (per-vertex heights), outward side faces
function slab(m, ring, y0, y1, col) {
    let sa = 0; for (let k = 0; k < ring.length; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length]; sa += ax * bz - bx * az; }
    const top = ring.map(([x, z]) => m.v(x, y1(x, z), z, 0, 1, 0, x * 0.125, z * 0.125, col)), bot = ring.map(([x, z]) => m.v(x, y0(x, z), z, 0, -1, 0, x * 0.125, z * 0.125, col));
    for (let k = 1; k + 1 < ring.length; k++) { if (sa > 0) { m.tri(top[0], top[k + 1], top[k]); m.tri(bot[0], bot[k], bot[k + 1]); } else { m.tri(top[0], top[k], top[k + 1]); m.tri(bot[0], bot[k + 1], bot[k]); } }
    for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
        let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; }
        quad(m, [[a[0], y1(...a), a[1]], [b[0], y1(...b), b[1]], [b[0], y0(...b), b[1]], [a[0], y0(...a), a[1]]], [nx, 0, nz], col);
    }
}
function emitWilburton(env, along) {
    const W = WILBURTON_STATION, pr = (q) => { const p = env.proj(q[0], q[1]); return [p.x, p.z]; };
    const plat = W.platform.map(pr), roof = W.roof.map(pr);
    const cx = plat.reduce((s, p) => s + p[0], 0) / plat.length, cz = plat.reduce((s, p) => s + p[1], 0) / plat.length;
    if (!env.keep(cx, cz, 0)) return { drawn: false };
    const deck = (x, z) => bellevueRailTop(along(x, z)), platTop = (x, z) => deck(x, z) + 0.16 + W.aboveRailM;
    const m = env.cellOf(cx, cz).solid, PLAT = env.rgb('#b9b6ae'), ROOF = env.rgb('#d9dcdd'), COL = env.rgb('#8e9396'), LIFT = env.rgb('#5f7482');
    slab(m, plat, (x, z) => deck(x, z) - 0.02, platTop, PLAT);
    const roofY = (x, z) => platTop(x, z) + W.roofClearM;
    slab(m, roof, roofY, (x, z) => roofY(x, z) + W.roofDepthM, ROOF);
    // columns down the platform centre line (south edge mid -> north edge mid)
    const s0 = [(plat[0][0] + plat[1][0]) / 2, (plat[0][1] + plat[1][1]) / 2], s1 = [(plat[2][0] + plat[4][0]) / 2, (plat[2][1] + plat[4][1]) / 2], L = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
    const n = Math.max(1, Math.round(L / W.columnEveryM)), ang = Math.atan2(s1[0] - s0[0], s1[1] - s0[1]);
    let columns = 0;
    for (let k = 0; k <= n; k++) { const t = 0.04 + 0.92 * k / n, x = s0[0] + (s1[0] - s0[0]) * t, z = s0[1] + (s1[1] - s0[1]) * t, y = platTop(x, z); env.cellOf(x, z).solid.box(x, y, z, 0.35, W.roofClearM, 0.35, ang, COL); columns++; }
    // lift shafts from the street (or from the deck where a carriageway passes under) to above the platform
    let lifts = 0;
    for (const q of W.lifts) { const [x, z] = pr(q), y = platTop(x, z), y0 = env.onRibbon(x, z, W.liftM / 2 + 0.3) ? deck(x, z) : 0.1; env.cellOf(x, z).solid.box(x, y0, z, W.liftM, y + 3.1 - y0, W.liftM, ang, LIFT); if (y0 < 1) env.addPropColl(x, z, W.liftM / 2 + 0.1, 'station-lift'); lifts++; }
    return { drawn: true, columns, lifts, platformTopM: +platTop(cx, cz).toFixed(2) };
}
