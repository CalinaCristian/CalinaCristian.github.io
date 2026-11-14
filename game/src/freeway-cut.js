// A freeway that runs in a cut under a cross-street bridge: the concrete median barrier and the abutment walls under the
// bridge ends (backlog bellevue-2). Data © OpenStreetMap contributors (ODbL).
//
// Bellevue, I-405 at the NE 8th St bridge (game/research/seattle-bellevue.md §3): the panorama reference shows I-405 in a
// cut with grass slopes, a concrete median barrier and NE 8th crossing at street level. OSM maps no median barrier on
// I-405 in the district (its only jersey barrier, w1188380108, is on a ramp east of the freeway), so the barrier is the
// dossier's panorama evidence. In the game I-405 lies at the district's level and the NE 8th deck stands about 5 m above
// it on piers; the cut is shown where it can be without moving a road: under each end of the deck a concrete abutment
// wall rises from the outermost carriageway's shoulder to the deck soffit, filled back to where the approach meets the
// ground, so the freeway and its ramps pass under the bridge between concrete walls. Not drawn: the grass cut slopes
// beside the freeway (the loops and the ground round them are at the freeway's level), the gantry over the deck's east
// end (w1188380109: its text is not legible on any source), the north sidewalk (see the dossier).
// Estimates: barrier 0.86 m single-slope section (WSDOT Type F size), abutment soffit clearance 0.9 m, wall colour.
const FREEWAY_CUTS = {
    bellevue: [{
        id: 'i405-ne8th', name: 'I-405 at NE 8th St',
        // the median line is found between the two carriageways at load; these bound it (I-405 inside the district)
        median: { from: [47.61625, -122.18875], to: [47.61855, -122.18875], heightM: 0.86, maxGapM: 30 },
        // the bridge whose ends get abutment walls: its carriageways (OSM ways), searched outward from the median
        bridgeWays: ['w428073537', 'w513238699', 'w1058885032', 'w30615115', 'w55481043'], bridgeAt: [47.61733, -122.18875],
        review: 'seattle-bellevue.md §3: panorama — freeway in a cut, concrete median barrier; OSM: no barrier on the I-405 median',
    }],
};
const FREEWAY_CUT_MODEL = { step: 1.5, baseW: 0.6, topW: 0.2, soffitGap: 0.9, minClear: 1.2, concrete: '#a7a59f', wall: '#9f9c95', cap: '#b4b1aa' };

/** env: { district, proj, onRibbon(x, z, r, filter), deckAbove(x, z) -> deck surface height | null, cellOf, rgb, solidAt(x, z, r) -> bool,
 *  addCollider(x, z, hw, hd, angle, h, kind, rec) }  Returns an audit list. */
export function emitFreewayCuts(env) {
    const out = [], M = FREEWAY_CUT_MODEL;
    const atGrade = (x, z) => !!env.onRibbon(x, z, 0, rb => rb.y < 1.0); // (a carriageway at the freeway's level, not a deck above)
    const deckAbove = env.deckAbove;
    for (const cut of FREEWAY_CUTS[env.district] || []) {
        const rec = { id: cut.id, barrierM: 0, barrierSkipped: {}, abutments: [] };
        // ---- median barrier: midway between the inner edges of the two carriageways, sampled every step
        {
            const m = cut.median, a = env.proj(m.from[0], m.from[1]), b = env.proj(m.to[0], m.to[1]), L = Math.hypot(b.x - a.x, b.z - a.z);
            const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, nx = -uz, nz = ux, n = Math.floor(L / M.step), conc = env.rgb(M.concrete), pts = [];
            for (let i = 0; i <= n; i++) {
                const cx = a.x + ux * i * M.step, cz = a.z + uz * i * M.step;
                if (atGrade(cx, cz)) { pts.push(null); rec.barrierSkipped.carriageway = (rec.barrierSkipped.carriageway || 0) + 1; continue; }
                let s0 = 0, s1 = 0; while (!atGrade(cx - nx * s0, cz - nz * s0) && s0 < m.maxGapM) s0 += 0.2; while (!atGrade(cx + nx * s1, cz + nz * s1) && s1 < m.maxGapM) s1 += 0.2;
                if (s0 >= m.maxGapM || s1 >= m.maxGapM || s0 + s1 < 1.2) { pts.push(null); rec.barrierSkipped.gap = (rec.barrierSkipped.gap || 0) + 1; continue; }
                const off = (s1 - s0) / 2, x = cx + nx * off, z = cz + nz * off;
                if (env.solidAt(x, z, M.baseW / 2 + 0.2)) { pts.push(null); rec.barrierSkipped.pier = (rec.barrierSkipped.pier || 0) + 1; continue; }
                pts.push([x, z]);
            }
            for (let i = 1; i < pts.length; i++) {
                const p = pts[i - 1], q = pts[i]; if (!p || !q) continue;
                const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); if (l < 0.1) continue;
                const px = -dz / l, pz = dx / l, c = env.cellOf((p[0] + q[0]) / 2, (p[1] + q[1]) / 2).solid, H = m.heightM, bw = M.baseW / 2, tw = M.topW / 2;
                for (const s of [-1, 1]) c.face4([p[0] + px * bw * s, 0.2, p[1] + pz * bw * s], [q[0] + px * bw * s, 0.2, q[1] + pz * bw * s], [q[0] + px * tw * s, 0.2 + H, q[1] + pz * tw * s], [p[0] + px * tw * s, 0.2 + H, p[1] + pz * tw * s], conc, [px * s, 0.15, pz * s]);
                c.face4([p[0] - px * tw, 0.2 + H, p[1] - pz * tw], [q[0] - px * tw, 0.2 + H, q[1] - pz * tw], [q[0] + px * tw, 0.2 + H, q[1] + pz * tw], [p[0] + px * tw, 0.2 + H, p[1] + pz * tw], conc, [0, 1, 0]);
                // (ends of a run: closed)
                for (const [e, f, k] of [[p, pts[i - 2], -1], [q, pts[i + 1], 1]]) if (!f) c.face4([e[0] - px * bw, 0.2, e[1] - pz * bw], [e[0] + px * bw, 0.2, e[1] + pz * bw], [e[0] + px * tw, 0.2 + H, e[1] + pz * tw], [e[0] - px * tw, 0.2 + H, e[1] - pz * tw], conc, [dx / l * k, 0, dz / l * k]);
                env.addCollider((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, bw, l / 2, Math.atan2(dx, dz), 0.2 + H, 'median-barrier', cut);
                rec.barrierM += l;
            }
            rec.barrierM = Math.round(rec.barrierM);
        }
        // ---- abutment walls under the bridge ends: outward from the median along each side, across the deck's width
        {
            const c0 = env.proj(cut.bridgeAt[0], cut.bridgeAt[1]), m = cut.median, a = env.proj(m.from[0], m.from[1]), b = env.proj(m.to[0], m.to[1]);
            const L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, nx = -uz, nz = ux;
            const wallC = env.rgb(M.wall), capC = env.rgb(M.cap);
            for (const side of [-1, 1]) {
                const rows = [];
                for (let t = -30; t <= 30; t += 1) { // along the freeway, across the deck
                    const ox = c0.x + ux * t, oz = c0.z + uz * t;
                    if (deckAbove(ox, oz) === null) { rows.push(null); continue; }
                    // outward past the median and every carriageway under the deck to the first open ground
                    let s = 0, lastRoad = null;
                    while (s < 80) { // (the last carriageway at the freeway's level that the deck still covers)
                        const x = ox + nx * s * side, z = oz + nz * s * side;
                        if (deckAbove(x, z) === null) break;
                        if (atGrade(x, z)) lastRoad = s;
                        s += 0.2;
                    }
                    if (lastRoad === null) { rows.push(null); continue; }
                    const face = lastRoad + 0.6;
                    const fx = ox + nx * face * side, fz = oz + nz * face * side, top = deckAbove(fx, fz);
                    if (top === null || top - M.soffitGap < M.minClear) { rows.push(null); continue; } // (the deck is too low there: no wall under it)
                    // back: outward while the deck stays above (sampled every metre), stopping at a carriageway or where the soffit meets the ground
                    const prof = [[face, top - M.soffitGap]]; let e = face;
                    while (e < face + 60) {
                        const s2 = e + 1, x = ox + nx * s2 * side, z = oz + nz * s2 * side, h = deckAbove(x, z);
                        if (h === null || atGrade(x, z) || h - M.soffitGap < 0.4) break;
                        prof.push([s2, h - M.soffitGap]); e = s2;
                    }
                    rows.push({ t, ox, oz, prof });
                }
                // join consecutive rows into a solid: the wall face, the top under the soffit, and the end (wing) faces
                const pieces = []; let run = [];
                for (const r of rows.concat([null])) { if (r) run.push(r); else { if (run.length >= 2) pieces.push(run); run = []; } }
                let metres = 0;
                for (const run2 of pieces) {
                    for (let i = 1; i < run2.length; i++) {
                        const p = run2[i - 1], q = run2[i], P = (r, s, y) => [r.ox + nx * s * side, y, r.oz + nz * s * side];
                        const c = env.cellOf(p.ox + nx * p.prof[0][0] * side, p.oz + nz * p.prof[0][0] * side).solid;
                        const pf = p.prof[0], qf = q.prof[0];
                        c.face4(P(p, pf[0], 0), P(q, qf[0], 0), P(q, qf[0], qf[1]), P(p, pf[0], pf[1]), wallC, [-nx * side, 0, -nz * side]); // wall face
                        const kmax = Math.min(p.prof.length, q.prof.length);
                        for (let k = 1; k < kmax; k++) c.face4(P(p, p.prof[k - 1][0], p.prof[k - 1][1]), P(q, q.prof[k - 1][0], q.prof[k - 1][1]), P(q, q.prof[k][0], q.prof[k][1]), P(p, p.prof[k][0], p.prof[k][1]), capC, [0, 1, 0]);
                        const pe = p.prof[kmax - 1], qe = q.prof[kmax - 1]; // back face, where the fill stops
                        c.face4(P(p, pe[0], pe[1]), P(q, qe[0], qe[1]), P(q, qe[0], 0), P(p, pe[0], 0), wallC, [nx * side, 0, nz * side]);
                        // (owner, Bellevue NE 8th St at (404, -317), 2026-11-13: an invisible wall on the westbound approach) the fill
                        // under a descending approach is lower than at the wall face: its collision follows the top under the soffit,
                        // one box per run of steps that stay within 0.3 m, at the lowest top of the run and of both rows
                        const tops = []; for (let k = 0; k < kmax; k++) tops.push([p.prof[k][0], Math.min(p.prof[k][1], q.prof[k][1])]);
                        const box = (s0, s1, h) => { const hw = (s1 - s0) / 2, mid = (s0 + s1) / 2; env.addCollider((p.ox + q.ox) / 2 + nx * mid * side, (p.oz + q.oz) / 2 + nz * mid * side, Math.max(0.2, hw), 0.5, Math.atan2(nx, nz), h, 'abutment', cut); };
                        if (kmax === 1) box(tops[0][0], tops[0][0] + 0.4, tops[0][1]);
                        else for (let k0 = 0; k0 < kmax - 1;) {
                            let k1 = k0 + 1, lo = Math.min(tops[k0][1], tops[k1][1]), hi = Math.max(tops[k0][1], tops[k1][1]);
                            while (k1 + 1 < kmax && Math.max(hi, tops[k1 + 1][1]) - Math.min(lo, tops[k1 + 1][1]) <= 0.3) { k1++; lo = Math.min(lo, tops[k1][1]); hi = Math.max(hi, tops[k1][1]); }
                            box(tops[k0][0], tops[k1][0], lo); k0 = k1;
                        }
                        metres += Math.hypot(q.ox - p.ox, q.oz - p.oz);
                    }
                    for (const [r, k] of [[run2[0], -1], [run2[run2.length - 1], 1]]) { // wing faces at the deck's edges
                        const c = env.cellOf(r.ox, r.oz).solid, P = (s, y) => [r.ox + nx * s * side, y, r.oz + nz * s * side];
                        for (let j = 1; j < r.prof.length; j++) c.face4(P(r.prof[j - 1][0], 0), P(r.prof[j][0], 0), P(r.prof[j][0], r.prof[j][1]), P(r.prof[j - 1][0], r.prof[j - 1][1]), wallC, [ux * k, 0, uz * k]);
                        if (r.prof.length === 1) c.face4(P(r.prof[0][0], 0), P(r.prof[0][0] + 0.4, 0), P(r.prof[0][0] + 0.4, r.prof[0][1]), P(r.prof[0][0], r.prof[0][1]), wallC, [ux * k, 0, uz * k]);
                    }
                }
                rec.abutments.push({ side: side < 0 ? 'west' : 'east', metres: Math.round(metres), pieces: pieces.length });
            }
        }
        out.push(rec);
    }
    return out;
}
