// SeaTac district: the Link 1 Line aerial guideway.
//
// OSM maps both main tracks, the pocket-track sidings and the crossovers through the district as `railway=light_rail`,
// `bridge=yes`, `layer=3` (ways below). The generic railway pass in world.js leaves bridge / layered ways unresolved
// because an OSM layer is ordinal, not a height. Here the height has a source: the SeaTac/Airport platform is elevated
// 60 ft (18 m) (Sound Transit, via en.wikipedia.org/wiki/SeaTac/Airport_station; game/research/seattle-seatac.md §3), the
// level the station landmark `sealink` already uses for its deck top. The guideway keeps that rail level through the
// district and comes down to the at-grade tracks (OSM w165240080 / w165240081, no bridge tag) over the last stretch north
// of S 170th St, where the bridge tag ends.
//
// Estimates, stated as such (not surveyed): girder depth, deck width, parapet, pier section and the pier spacing / pier
// positions (OSM maps no supports); piers are only placed clear of carriageways and buildings, never moved onto them.
// Street-level imagery was used to confirm the structure type only (concrete box girder on single columns).
export const SEATAC_GUIDEWAY = {
    mains: ['w34746781', 'w260383054'],
    others: ['w164665648', 'w260383057', 'w911020383', 'w911020385', 'w911020386', 'w911020387', 'w916372227'],
    station: 'w54139654',      // deck inside the station is drawn by the landmark
    railTopM: 18.0,
    endTopM: 0.45, rampM: 358, // down to the at-grade tracks at the north end of the bridge ways (about 4.9 %)
    girderM: 1.8, outerHalfM: 2.6, pierEveryM: 34, sharedM: 14, pierMinTopM: 6.5,
};


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

function nearestOn(pts, x, z) {
    let best = { d: Infinity, x: 0, z: 0 };
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < best.d) best = { d, x: px, z: pz };
    }
    return best;
}

/**
 * env: { railways, undelta, cellOf, rgb, onRibbon, buildingAt, addPropColl, keep(x, z, len), stationCentre: [x, z] | null }
 * Returns { ways: Set of handled way ids, metres, piers, piersOmitted } (an audit record for world stats).
 */
export function emitSeatacGuideway(env) {
    const CON = env.rgb('#c4c1ba'), PIER = env.rgb('#bcb9b2'), RAIL = env.rgb('#6d7174'), WALL = env.rgb('#a9a6a0');
    const G = SEATAC_GUIDEWAY, byId = new Map((env.railways || []).map(r => [r.id, r]));
    const line = (id) => { const r = byId.get(id); return r ? env.undelta(r.points, 0) : null; };
    const mains = G.mains.map(line), out = { ways: new Set(), metres: 0, piers: 0, piersOmitted: 0 };
    if (!mains[0] || !mains[1]) return out;
    const end = mains[0][mains[0].length - 1], sc = env.stationCentre;
    const topAt = (x, z, main) => { if (!main) return G.railTopM; const d = Math.hypot(x - end[0], z - end[1]); return d >= G.rampM ? G.railTopM : G.endTopM + (G.railTopM - G.endTopM) * d / G.rampM; };
    const inStation = (x, z) => !!sc && Math.abs(z - sc[1]) < 71 && Math.abs(x - sc[0]) < 16;
    const emit = (id, pts, other) => {
        const st = resample(pts, 8), N = st.length; if (N < 2) return;
        // (r2-perf-3, visual QA flicker under the SeaTac guideway) the two mains share one deck while they are less than sharedM
        // apart: round the station and the pocket track OSM spreads them 9.4 - 12 m, and with the old 9 m limit they had separate
        // decks with inner parapets whose faces stood a few cm from the decks of the sidings / crossovers between them. Decks that
        // overlap are not coplanar: the second main's inner edge overlaps the first by 4 cm and the sidings / crossovers lie on
        // the mains' deck, so their top sits slightly lower and their soffit slightly higher and the first main's faces win.
        const lift = id === G.mains[0] ? [0, 0] : id === G.mains[1] ? [-0.015, 0.04] : [-0.03, 0.08];
        const S = st.map((p, i) => {
            const a = st[Math.max(0, i - 1)], b = st[Math.min(N - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = uz, nz = -ux;
            let wl = other ? G.outerHalfM : 2.2, wr = wl, side = 0, half = 0;
            if (other) { const q = nearestOn(other, p[0], p[1]); if (q.d < G.sharedM) { side = (q.x - p[0]) * nx + (q.z - p[1]) * nz >= 0 ? 1 : -1; half = q.d / 2; if (side > 0) wl = half + 0.02; else wr = half + 0.02; } }
            const top = topAt(p[0], p[1], !!other);
            const depth = top < G.pierMinTopM ? top - 0.02 : G.girderM;
            return { x: p[0], z: p[1], ux, uz, nx, nz, wl, wr, side, half, top: top + lift[0], depth: depth + lift[0] - lift[1] };
        });
        let run = 0, nextPier = G.pierEveryM / 2;
        for (let i = 1; i < N; i++) {
            const a = S[i - 1], b = S[i], L = Math.hypot(b.x - a.x, b.z - a.z), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            run += L;
            if (inStation(mx, mz) || !env.keep(mx, mz, L)) continue;
            const m = env.cellOf(mx, mz).solid, P = (s, w, y) => [s.x + s.nx * w, y, s.z + s.nz * w];
            const fill = a.top < G.pierMinTopM, col = fill ? WALL : CON;
            quad(m, [P(a, a.wl, a.top), P(b, b.wl, b.top), P(b, -b.wr, b.top), P(a, -a.wr, a.top)], [0, 1, 0], CON);
            if (!fill) quad(m, [P(a, a.wl, a.top - a.depth), P(b, b.wl, b.top - b.depth), P(b, -b.wr, b.top - b.depth), P(a, -a.wr, a.top - a.depth)], [0, -1, 0], CON);
            for (const sgn of [1, -1]) {
                if (a.side === sgn && b.side === sgn) continue; // the face toward the other track is inside the shared deck
                const wa = sgn > 0 ? a.wl : -a.wr, wb = sgn > 0 ? b.wl : -b.wr, n = [a.nx * sgn, 0, a.nz * sgn];
                quad(m, [P(a, wa, a.top + (other ? 0.9 : 0)), P(b, wb, b.top + (other ? 0.9 : 0)), P(b, wb, b.top - b.depth), P(a, wa, a.top - a.depth)], n, col);
                if (other) { // parapet: inner face + cap
                    const ia = wa - 0.25 * sgn, ib = wb - 0.25 * sgn;
                    quad(m, [P(a, ia, a.top + 0.9), P(b, ib, b.top + 0.9), P(b, ib, b.top), P(a, ia, a.top)], [-n[0], 0, -n[2]], CON);
                    quad(m, [P(a, wa, a.top + 0.9), P(b, wb, b.top + 0.9), P(b, ib, b.top + 0.9), P(a, ia, a.top + 0.9)], [0, 1, 0], CON);
                }
            }
            for (const g of [-0.7175, 0.7175]) quad(m, [P(a, g + 0.05, a.top + 0.16), P(b, g + 0.05, b.top + 0.16), P(b, g - 0.05, b.top + 0.16), P(a, g - 0.05, a.top + 0.16)], [0, 1, 0], RAIL); // 1435 mm gauge
            out.metres += L;
            if (fill) { if (i % 2 === 0) env.addPropColl(mx, mz, Math.max(a.wl, a.wr) + 0.3, 'guideway'); continue; }
            if (id !== G.mains[0] || run < nextPier) continue;
            nextPier = run + G.pierEveryM;
            // one column between the two tracks, under a hammerhead; shifted along the track off carriageways / buildings, else omitted
            let placed = false;
            for (const k of [0, 1, -1, 2, -2, 3, -3]) {
                const j = Math.max(1, Math.min(N - 1, i + k)), s = S[j], off = s.side * s.half, px = s.x + s.nx * off, pz = s.z + s.nz * off;
                if (inStation(px, pz) || s.top < G.pierMinTopM || env.onRibbon(px, pz, 1.9) || env.buildingAt(px, pz)) continue;
                const cell = env.cellOf(px, pz).solid, ang = Math.atan2(s.ux, s.uz), soffit = s.top - G.girderM;
                cell.box(px, 0.1, pz, 2.0, soffit - 1.3, 2.2, ang, PIER);
                cell.box(px, soffit - 1.3, pz, 6.4, 1.3, 2.4, ang, PIER);
                env.addPropColl(px, pz, 1.4, 'guideway'); out.piers++; placed = true; break;
            }
            if (!placed) out.piersOmitted++;
        }
        out.ways.add(id);
    };
    emit(G.mains[0], mains[0], mains[1]); emit(G.mains[1], mains[1], mains[0]);
    for (const id of G.others) { const pts = line(id); if (pts) emit(id, pts, null); }
    out.metres = Math.round(out.metres);
    return out;
}
