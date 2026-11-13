// Sports grounds whose own OSM `sport` tag decides how they are dressed. The district packs keep only the area class
// (pitch / track / ...), so world.js dressed every grass pitch as football and every track as a flat band. The tags below
// were read from live OSM (api.openstreetmap.org, 2026-11-13) for the areas the pack carries (data.areaSourceIds).
// Data © OpenStreetMap contributors (ODbL).
//
//   w37899329  Velodrom Dinamo (Floreasca): leisure=track, sport=cycling, surface=concrete
//   w362465818 the pitch inside it: leisure=pitch, sport=rugby_league, surface=grass
//
// No street panorama reaches either (the grounds are behind Stadionul Dinamo and the Calea Floreasca 85 block,
// game/research/bucharest-floreasca.md): position and outline are OSM, every dimension below is an estimate from the
// standards (UCI outdoor velodromes; Rugby League International Federation pitch) and is listed in SPORT_ESTIMATES.
export const AREA_SPORT = { w37899329: 'cycling', w362465818: 'rugby_league' };

export const SPORT_ESTIMATES = {
    bankDeg: { straight: 12, curve: 32 },  // banking of a 400 m outdoor concrete track: 10–15° straights, 25–35° bends
    apronM: 1.2,                           // flat inside band (côte d'azur) before the bank rises
    bankMaxM: 3.6,                         // cap of the outer edge above the infield
    railM: 1.0,                            // safety rail along the top of the bank
    rugby: { tryToTryM: 100, inGoalM: [6, 11], widthM: 68, postGapM: 5.5, crossbarM: 3, uprightM: 10 },
};

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function nearestOnRing(x, z, ring) {
    let best = null;
    for (let k = 0; k < ring.length; k++) {
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) best = { x: px, z: pz, d };
    }
    return best;
}
function resample(ring, step) {
    const out = [];
    for (let k = 0; k < ring.length; k++) {
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
        for (let i = 0; i < n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]);
    }
    return out;
}

/**
 * A banked concrete velodrome track between its mapped outer outline and the infield pitch's outline: a flat apron, the
 * bank rising to the outer edge (steeper in the bends), the outer wall down to the ground and a rail along the top.
 * env: { track: area, infield: area, rect: { cx, cz, ux, uz, hl, hw } (smallest rectangle of the outer outline, u long),
 *        cell: { solid, detail }, base, rgb, addFence(ax, az, bx, bz, h), ground(polygon) }
 * returns { stations, topM: [min, max] }
 */
export function emitBankedTrack(env) {
    const { track, infield, rect, cell, base, rgb } = env, E = SPORT_ESTIMATES;
    const ring = resample(track.outer, 3), n = ring.length, CON = rgb('#b1aca1'), CON2 = rgb('#9d988d'), RAIL = rgb('#2f4a3a');
    const straightHalf = Math.max(0, rect.hl - rect.hw), st = [];
    for (const [ox, oz] of ring) {
        const q = nearestOnRing(ox, oz, infield.outer); let ix = q.x, iz = q.z, W = q.d;
        if (!(W > 2 && W < 16)) { const u = (ox - rect.cx) * rect.ux + (oz - rect.cz) * rect.uz, cu = Math.max(-straightHalf, Math.min(straightHalf, u)); const sx = rect.cx + rect.ux * cu, sz = rect.cz + rect.uz * cu, L = Math.hypot(ox - sx, oz - sz) || 1; W = 7; ix = ox + (sx - ox) / L * W; iz = oz + (sz - oz) / L * W; }
        const u = Math.abs((ox - rect.cx) * rect.ux + (oz - rect.cz) * rect.uz), s = smooth((u - straightHalf + 12) / 24);
        const deg = E.bankDeg.straight + (E.bankDeg.curve - E.bankDeg.straight) * s, slopeW = Math.max(0.5, W - E.apronM);
        const h = Math.min(E.bankMaxM, slopeW * Math.tan(deg * Math.PI / 180)), f = E.apronM / W;
        st.push({ ix, iz, ax: ix + (ox - ix) * f, az: iz + (oz - iz) * f, ox, oz, h });
    }
    const y0 = base + 0.02;
    for (let k = 0; k < n; k++) {
        const a = st[k], b = st[(k + 1) % n];
        cell.solid.face4([a.ix, y0, a.iz], [b.ix, y0, b.iz], [b.ax, y0, b.az], [a.ax, y0, a.az], CON2, [0, 1, 0]);                       // apron
        cell.solid.face4([a.ax, y0, a.az], [b.ax, y0, b.az], [b.ox, y0 + b.h, b.oz], [a.ox, y0 + a.h, a.oz], CON, [0, 1, 0]);             // bank
        const dx = b.ox - a.ox, dz = b.oz - a.oz, L = Math.hypot(dx, dz) || 1, mx = (a.ox + b.ox) / 2 - (a.ix + b.ix) / 2, mz = (a.oz + b.oz) / 2 - (a.iz + b.iz) / 2;
        let nx = dz / L, nz = -dx / L; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } // outward
        cell.solid.face4([a.ox, base - 0.05, a.oz], [b.ox, base - 0.05, b.oz], [b.ox, y0 + b.h, b.oz], [a.ox, y0 + a.h, a.oz], CON2, [nx, 0, nz]); // outer wall
        cell.detail.face4([a.ox, y0 + a.h + E.railM, a.oz], [b.ox, y0 + b.h + E.railM, b.oz], [b.ox, y0 + b.h + E.railM - 0.06, b.oz], [a.ox, y0 + a.h + E.railM - 0.06, a.oz], RAIL, [nx, 0.2, nz]);
        cell.detail.face4([a.ox, y0 + a.h + E.railM, a.oz], [a.ox, y0 + a.h + E.railM - 0.06, a.oz], [b.ox, y0 + b.h + E.railM - 0.06, b.oz], [b.ox, y0 + b.h + E.railM, b.oz], RAIL, [-nx, 0.2, -nz]);
        cell.detail.box(a.ox, y0 + a.h, a.oz, 0.06, E.railM, 0.06, 0, RAIL);
        env.addFence(a.ox, a.oz, b.ox, b.oz, Math.max(1.2, Math.min(a.h, b.h) + E.railM));
    }
    env.ground?.(track.outer);
    const hs = st.map(s => s.h);
    return { stations: n, topM: [+Math.min(...hs).toFixed(2), +Math.max(...hs).toFixed(2)] };
}

/**
 * Rugby league markings and H posts on a grass pitch (rect: smallest rectangle of the outline, u long; the outline of a
 * velodrome infield is a capsule, so the field is fitted inside it). env: { area, rect, base, line(u0, v0, u1, v1, w),
 * P(u, v) -> [x, z], stripe(u0, u1, hw, k), post(x, z, h, r), crossbar(x, z, y, len, angle, r), addPost(x, z), ground(quad), ang }
 */
export function emitRugbyLeague(env) {
    const { area, rect, line, P } = env, R = SPORT_ESTIMATES.rugby, inside = (u, v) => pointIn(P(u, v), area.outer);
    const fits = (hu, hv) => inside(hu, hv) && inside(hu, -hv) && inside(-hu, hv) && inside(-hu, -hv);
    let hw = Math.min(R.widthM / 2, rect.hw * 0.96); while (hw > 15 && !fits(Math.min(R.tryToTryM / 2, rect.hl - 3), hw)) hw -= 0.5;
    let tl = R.tryToTryM / 2; while (tl > 20 && !fits(tl, hw)) tl -= 1;
    let dead = tl + R.inGoalM[1]; while (dead > tl + R.inGoalM[0] && !fits(dead, hw)) dead -= 0.5;
    if (!fits(dead, hw)) dead = tl + 1;
    for (let k = 0, ns = Math.round(dead * 2 / 5); k < ns; k++) env.stripe(-dead + dead * 2 * k / ns, -dead + dead * 2 * (k + 1) / ns, hw, k);
    line(-dead, -hw, dead, -hw); line(-dead, hw, dead, hw); // touch / touch-in-goal lines
    for (const s of [-1, 1]) { line(s * dead, -hw, s * dead, hw); line(s * tl, -hw, s * tl, hw, 0.12); }
    for (let u = -tl + 10; u < tl - 1; u += 10) { if (Math.abs(u) < 0.5) line(0, -hw, 0, hw, 0.12); else line(u, -hw, u, hw, 0.08); }
    for (let u = -tl + 10; u < tl - 1; u += 10) for (const v of [-hw + 10, hw - 10]) line(u - 0.5, v, u + 0.5, v, 0.08); // 10 m dashes across each line
    const g = R.postGapM / 2, rr = 0.09;
    for (const s of [-1, 1]) {
        for (const v of [-g, g]) { const [x, z] = P(s * tl, v); env.post(x, z, R.uprightM, rr); env.addPost(x, z); }
        const [cx, cz] = P(s * tl, 0); env.crossbar(cx, cz, R.crossbarM, R.postGapM, env.ang + Math.PI / 2, rr * 0.8);
    }
    env.ground?.([P(-dead, -hw), P(dead, -hw), P(dead, hw), P(-dead, hw)]);
    return { tryLineM: tl, deadBallM: +dead.toFixed(1), halfWidthM: +hw.toFixed(1) };
}
function pointIn([x, z], ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; }
    return c;
}
