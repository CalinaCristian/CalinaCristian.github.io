// Fuel stations of the chapter districts: pump islands under the mapped canopy and a brand pylon at the street.
//
// Only where OSM maps `amenity=fuel` (the district pack's fuel POIs); never an invented station. The canopy itself is the
// mapped roof footprint, drawn by world.js. OSM maps no pumps and no pylon in any of the eight districts (checked in the
// live extract of 2026-11-12: no man_made=fuel_pump, no advertising=totem at a station), so both are a generic model:
//  - pump islands only under a mapped canopy, parallel to the forecourt's own mapped service lane, in the strips of the
//    canopy that no carriageway uses; two dispensers per island; none where no clear strip exists;
//  - one pylon on the station's side of the nearest public street, with the brand from the OSM tags (brand, else name)
//    and blank price panels (no prices, no fuel grades are invented); only on the station's own frontage (FUEL_MODEL
//    .frontageM of the canopy) and clear of the canopy, else none.
// Every dimension and the exact island / pylon positions are estimates (FUEL_MODEL). Nothing stands on a carriageway, in
// a building or in a tram's swept body; a part that finds no free place is left out and reported.
// (round 3, 2026-11-13) Every station was compared with official panoramas (fuel-look.js FUEL_STATION_REVIEW): a reviewed
// station gets a pylon only where one was seen (`review.pylon`: none, or the rough place, which st.pylonAt carries in
// world metres: the pylon goes on the nearest free ground within FUEL_MODEL.pylonSearchM of it), the brand's pump /
// pylon colours (st.look), and, where the panorama shows islands either side of the forecourt's own drive lane
// (`islandsBesideLane`), islands may stand on that service lane's paved band but never within laneClearM of its centre line.
export const FUEL_MODEL = { islandM: [1.1, 0.16, 4.4], dispenserM: [0.5, 1.9, 1.0], islandGapM: 6.4, pylonM: [0.4, 6.2, 1.7],
    frontageM: 12, frontageNoCanopyM: 20, canopyClearM: 1.2, pylonSearchM: 9, laneClearM: 2.7,
    estimates: 'all dimensions; island and pylon positions; the frontage reach; the reviewed pylon place (±10 m) and its search radius' };
const segDist = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)); return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t); };

const ringDist = (x, z, ring) => { let d = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)); d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t)); } return d; };
const inPoly =(x, z, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

/**
 * st: { name, at: [x, z] mapped station point, ring: canopy footprint | null, laneDir: [ux, uz] | null, street / streets: [{ x, z, nx, nz, dirx, dirz }] (kerb
 *       point on the station's side, outward normal, street direction), colours: [bg, fg, accent], sign, panel }
 * env: { cellOf, rgb, blocked(x, z, r) -> reason | null, addCollider(x, z, r, kind), addSign(c, x, z, ang, side, w, h, y, s, thick), baseY(x, z) }
 */
export function emitFuelForecourt(env, st) {
    const M = FUEL_MODEL, out = { name: st.name, review: st.review?.id || null, islands: 0, dispensers: 0, pylon: false, notes: [] };
    const bg = env.rgb(st.look?.pylon?.body || st.colours[0]), accent = env.rgb(st.look?.pylon?.cap || st.colours[2] || st.colours[1]);
    const pumpCol = env.rgb(st.look ? st.look.fascia : st.colours[0]);
    const besideLane = !!(st.review?.islandsBesideLane && st.lanes?.length);
    const offLane = (x, z) => !besideLane || st.lanes.every(([a, b]) => segDist(x, z, a, b) >= M.laneClearM);
    if (st.ring?.length >= 3) {
        // canopy frame: d = along the forecourt lane (else across the canopy's short side), p = across
        let best = null; for (let i = 0; i < st.ring.length; i++) { const a = st.ring[i], b = st.ring[(i + 1) % st.ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || L > best.L) best = { L, ux: (b[0] - a[0]) / (L || 1), uz: (b[1] - a[1]) / (L || 1) }; }
        const d = st.laneDir || [-best.uz, best.ux], p = [d[1], -d[0]];
        const cx = st.ring.reduce((s, q) => s + q[0], 0) / st.ring.length, cz = st.ring.reduce((s, q) => s + q[1], 0) / st.ring.length;
        const proj = st.ring.map(q => [(q[0] - cx) * p[0] + (q[1] - cz) * p[1], (q[0] - cx) * d[0] + (q[1] - cz) * d[1]]);
        const p0 = Math.min(...proj.map(q => q[0])), p1 = Math.max(...proj.map(q => q[0])), half = M.islandM[2] / 2;
        // an island fits at offset (a, b) when its whole kerb is under the canopy and off every carriageway / building
        const fits = (a, b) => { for (const t of [-half, -half / 2, 0, half / 2, half]) for (const w of [-0.55, 0.55]) { const x = cx + p[0] * (a + w) + d[0] * (b + t), z = cz + p[1] * (a + w) + d[1] * (b + t); if (!inPoly(x, z, st.ring) || !offLane(x, z) || env.blocked(x, z, 0.35, besideLane ? { serviceOk: true } : null)) return false; } return true; };
        // (r3) beside a reviewed drive lane the islands may sit anywhere along the canopy, not only round its centre
        const along = besideLane ? Array.from({ length: 21 }, (_, k) => (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.2) : [0, 1.2, -1.2, 2.4, -2.4];
        const free = []; for (let a = p0 + 1.2; a <= p1 - 1.2; a += 0.4) for (const b of along) if (fits(a, b)) { free.push([a, b]); break; }
        // one island in the middle of each run of free offsets, further ones every islandGapM
        const picks = []; let run = [];
        const flush = () => { if (!run.length) return; const lo = run[0][0], hi = run[run.length - 1][0], n = Math.max(1, Math.floor((hi - lo) / M.islandGapM) + 1); for (let k = 0; k < n; k++) { const a = n === 1 ? (lo + hi) / 2 : lo + (hi - lo) * k / (n - 1); picks.push(run.reduce((m, q) => Math.abs(q[0] - a) < Math.abs(m[0] - a) ? q : m)); } run = []; };
        for (const q of free) { if (run.length && q[0] - run[run.length - 1][0] > 0.45) flush(); run.push(q); } flush();
        const ang = Math.atan2(d[0], d[1]);
        const taken = [];
        for (const [a, b] of picks) {
            if (taken.some(v => Math.abs(v - a) < 3)) continue; taken.push(a);
            const ix = cx + p[0] * a + d[0] * b, iz = cz + p[1] * a + d[1] * b, c = env.cellOf(ix, iz).solid, y = env.baseY(ix, iz);
            c.box(ix, y, iz, M.islandM[0], M.islandM[1], M.islandM[2], ang, env.rgb('#c9c6bd'));
            for (const t of [-1.05, 1.05]) {
                const x = ix + d[0] * t, z = iz + d[1] * t;
                c.box(x, y + M.islandM[1], z, M.dispenserM[0], M.dispenserM[1] - 0.36, M.dispenserM[2], ang, env.rgb('#e6e7e9'));
                c.box(x, y + M.islandM[1] + 0.95, z, M.dispenserM[0] + 0.03, 0.34, M.dispenserM[2] - 0.2, ang, env.rgb('#22262b'));
                c.box(x, y + M.islandM[1] + M.dispenserM[1] - 0.36, z, M.dispenserM[0] + 0.04, 0.36, M.dispenserM[2] + 0.04, ang, pumpCol);
                env.addCollider(x, z, 0.6, 'fuel-pump'); out.dispensers++;
            }
            out.islands++;
        }
        if (besideLane) out.besideLane = { lanes: st.lanes.length, freeOffsets: free.length };
        if (!out.islands) out.notes.push('no clear strip under the canopy for a pump island');
    } else out.notes.push('no mapped canopy: no pumps');
    const streets = (st.streets?.length ? st.streets : st.street ? [st.street] : []);
    if (st.review && (st.review.pylon === 'none' || !st.review.pylon)) { out.notes.push('reviewed: no pylon seen in the panoramas'); return out; }
    if (st.review && st.pylonAt && st.sign) { // reviewed: the pylon stands near the place seen in the panorama
        const ring = st.ring?.length >= 3 ? st.ring : null, [hx, hz] = st.pylonAt, s0 = streets[0];
        const ang = s0 ? Math.atan2(s0.dirx, s0.dirz) : 0, ux = Math.sin(ang), uz = Math.cos(ang), H = M.pylonM[1];
        const clearOfCanopy = (x, z) => !ring || [-1, 0, 1].every(k => { const qx = x + ux * k * M.pylonM[2] / 2, qz = z + uz * k * M.pylonM[2] / 2; return !inPoly(qx, qz, ring) && ringDist(qx, qz, ring) >= M.canopyClearM; });
        let at = null;
        for (let r = 0; r <= M.pylonSearchM && !at; r += 1.5) for (let k = 0, n = r ? Math.round(r * 4) : 1; k < n && !at; k++) {
            const a = 2 * Math.PI * k / n, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
            if (!clearOfCanopy(x, z) || env.blocked(x, z, 1.0) || env.blocked(x + uz * 0.8, z - ux * 0.8, 0.5) || env.blocked(x - uz * 0.8, z + ux * 0.8, 0.5)) continue;
            at = [x, z];
        }
        if (!at) { out.notes.push('reviewed pylon place not free within ' + M.pylonSearchM + ' m: no pylon'); return out; }
        const [x, z] = at, c = env.cellOf(x, z), y = env.baseY(x, z);
        c.solid.box(x, y, z, M.pylonM[0], H, M.pylonM[2], ang + Math.PI / 2, bg);
        c.solid.box(x, y + H - 0.12, z, M.pylonM[0] + 0.04, 0.12, M.pylonM[2] + 0.04, ang + Math.PI / 2, accent);
        const w = M.pylonM[2] - 0.2, h = Math.min(1.5, w / st.sign.aspect);
        for (const sd of [1, -1]) {
            env.addSign(c, x, z, ang, sd, w, h, y + H - 0.35 - h / 2, st.sign, M.pylonM[0] / 2 + 0.02);
            if (st.panel) for (const k of [0, 1, 2]) env.addSign(c, x, z, ang, sd, w, 0.62, y + H - 0.75 - h - 0.72 * k - 0.31, st.panel, M.pylonM[0] / 2 + 0.02);
        }
        env.addCollider(x, z, 0.95, 'fuel-pylon'); out.pylon = true; out.pylonAt = [+x.toFixed(1), +z.toFixed(1)]; out.pylonFromReview = +Math.hypot(x - hx, z - hz).toFixed(1);
        return out;
    }
    if (streets.length && st.sign) {
        const ring = st.ring?.length >= 3 ? st.ring : null;
        // (2026-11-12 render review) the pylon belongs to the station's own frontage: within M.frontageM of the mapped canopy
        // (else M.frontageNoCanopyM of the mapped station point), never a street 90 m away; and its whole body stays clear
        // of the canopy (a 6.2 m pylon reached into a ~5 m canopy fascia at Pipera)
        const station = (x, z) => ring ? (inPoly(x, z, ring) ? 0 : ringDist(x, z, ring)) : Math.hypot(x - st.at[0], z - st.at[1]);
        const limit = ring ? M.frontageM : M.frontageNoCanopyM;
        let tooFar = 0;
        const spots = [[7, 1.0], [-7, 1.0], [11, 1.0], [-11, 1.0], [3, 1.0], [-3, 1.0], [7, 2.2], [-7, 2.2], [0, 1.4], [15, 1.0], [-15, 1.0], [11, 2.2], [-11, 2.2]];
        // the nearest public streets in turn (a corner station's frontage street need not be the one nearest its centre)
        streets: for (const s of streets) { const ang = Math.atan2(s.dirx, s.dirz);
        for (const [along, off] of spots) {
            const x = s.x + s.dirx * along + s.nx * off, z = s.z + s.dirz * along + s.nz * off;
            if (st.at && station(x, z) > limit) { tooFar++; continue; }
            if (ring && [-1, 0, 1].some(k => { const qx = x + s.dirx * k * M.pylonM[2] / 2, qz = z + s.dirz * k * M.pylonM[2] / 2; return inPoly(qx, qz, ring) || ringDist(qx, qz, ring) < M.canopyClearM; })) continue;
            if (env.blocked(x, z, 1.0) || env.blocked(x + s.nx * 0.8, z + s.nz * 0.8, 0.5) || env.blocked(x - s.nx * 0.8, z - s.nz * 0.8, 0.5)) continue;
            const c = env.cellOf(x, z), y = env.baseY(x, z), H = M.pylonM[1];
            c.solid.box(x, y, z, M.pylonM[0], H, M.pylonM[2], ang + Math.PI / 2, bg);
            c.solid.box(x, y + H - 0.12, z, M.pylonM[0] + 0.04, 0.12, M.pylonM[2] + 0.04, ang + Math.PI / 2, accent);
            const w = M.pylonM[2] - 0.2, h = Math.min(1.5, w / st.sign.aspect);
            for (const sd of [1, -1]) {
                env.addSign(c, x, z, ang, sd, w, h, y + H - 0.35 - h / 2, st.sign, M.pylonM[0] / 2 + 0.02);
                if (st.panel) for (const k of [0, 1, 2]) env.addSign(c, x, z, ang, sd, w, 0.62, y + H - 0.75 - h - 0.72 * k - 0.31, st.panel, M.pylonM[0] / 2 + 0.02);
            }
            env.addCollider(x, z, 0.95, 'fuel-pylon'); out.pylon = true; out.pylonAt = [+x.toFixed(1), +z.toFixed(1)]; break streets;
        } }
        if (!out.pylon) out.notes.push(tooFar === spots.length * streets.length ? 'no public street on the station frontage: no pylon' : 'no free place for the pylon beside the street');
    } else out.notes.push('no public street within reach: no pylon');
    return out;
}
