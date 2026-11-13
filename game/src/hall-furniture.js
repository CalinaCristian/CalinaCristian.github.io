// Shared underpass hall furniture (romana-1, Pasajul Victoria): the hall code in world.js draws, beside a deep covered
// carriageway, the tram station's raised platform strip and one pier per road edge. The street-level review of the hall
// (fidelity pass 2026-11-12) also saw: a steel fence between the piers along the road edge of the platform, the tram
// stop's benches and stop poles on the platform, and sodium (orange) lamps under the soffit. OSM maps none of these, so they
// are a class: positions follow the hall geometry, sizes and spacings are estimates (HALL_FURNITURE_MODEL.estimates).
export const HALL_FURNITURE_MODEL = {
    fenceOffsetM: 0.85, fenceHeightM: 1.1, postEveryM: 2.0, benchEveryM: 6, benchMinGapM: 1.5, poleMinGapM: 1.2, stopReachM: 35, lampEveryM: 9,
    colours: { fence: '#3d4247', bench: '#6b4a2f', benchFrame: '#4b5056', pole: '#4b5563', plate: '#c2410c', housing: '#2f3133', sodium: '#ffb14e' },
    estimates: ['fenceOffsetM', 'fenceHeightM', 'postEveryM', 'benchEveryM', 'benchMinGapM', 'poleMinGapM', 'stopReachM', 'lampEveryM', 'colours'],
};

// a box between stations t0..t1 (fractions of the edge) and offsets o0..o1 across it, from y0(t) to y1(t)
function box(face4, q, t0, t1, o0, o1, y0, y1, col, n) {
    const P = (t, o, y) => q(t, o, y(t));
    face4(P(t0, o0, y0), P(t1, o0, y0), P(t1, o0, y1), P(t0, o0, y1), col, n.across);
    face4(P(t1, o1, y0), P(t0, o1, y0), P(t0, o1, y1), P(t1, o1, y1), col, n.back);
    face4(P(t0, o1, y0), P(t0, o0, y0), P(t0, o0, y1), P(t0, o1, y1), col, n.rev);
    face4(P(t1, o0, y0), P(t1, o1, y0), P(t1, o1, y1), P(t1, o0, y1), col, n.along);
    face4(P(t0, o0, y1), P(t1, o0, y1), P(t1, o1, y1), P(t0, o1, y1), col, [0, 1, 0]);
}

/**
 * One side run of the hall on one road edge. q(t, off, y) -> [x, y, z] on the edge; floor(t): platform top; ceil(t): soffit;
 * a2..b2: the run (edge fractions); o: the road-side face offset, so: its sign towards the tram; gap: platform width;
 * len: edge length; pier: [t0, t1] of the pier on this run or null; inn / along: unit normals; face4(a, b, c, d, rgb, n); rgb(hex).
 * lampOffset: the carriageway centre offset for the lamps (null: no lamps on this call); nearStop(x, z): a mapped tram stop
 * (OSM tram_stop node) of the hall is within reach, so its platform furniture belongs here. Returns { posts, benches, lamps }.
 */
export function emitHallFurniture({ q, floor, ceil, a2, b2, o, so, gap, len, pier, inn, along, face4, rgb, lampOffset = null, nearStop = () => false }) {
    const M = HALL_FURNITURE_MODEL, C = Object.fromEntries(Object.entries(M.colours).map(([k, v]) => [k, rgb(v)]));
    const back = [-inn[0], 0, -inn[2]], rev = [-along[0], 0, -along[2]];
    const nIn = { across: inn, back, rev, along }, out = { posts: 0, benches: 0, lamps: 0 };
    const dt = m => m / len, freeOfPier = (t, w) => !pier || t + w < pier[0] - dt(0.05) || t - w > pier[1] + dt(0.05);
    // fence: posts, a top rail and a mid rail along the pier line, broken at the pier
    if (gap > 1.1) {
        const of = o + so * Math.min(M.fenceOffsetM, gap - 0.3), w = dt(0.04);
        const lo0 = so > 0 ? of - 0.03 : of + 0.03, lo1 = so > 0 ? of + 0.03 : of - 0.03;
        for (let s = Math.ceil(a2 * len / M.postEveryM) * M.postEveryM; s <= b2 * len; s += M.postEveryM) {
            const t = s / len; if (!freeOfPier(t, w)) continue;
            box(face4, q, t - w, t + w, lo0, lo1, floor, t2 => floor(t2) + M.fenceHeightM, C.fence, nIn); out.posts++;
        }
        const runs = pier ? [[a2, Math.min(b2, pier[0])], [Math.max(a2, pier[1]), b2]] : [[a2, b2]];
        for (const [r0, r1] of runs) if (r1 - r0 > dt(0.3)) for (const [h0, h1] of [[M.fenceHeightM - 0.06, M.fenceHeightM], [0.5, 0.55], [0.08, 0.13]])
            box(face4, q, r0, r1, lo0, lo1, t => floor(t) + h0, t => floor(t) + h1, C.fence, nIn);
    }
    // tram-stop benches and stop pole on the platform behind the fence, only where the hall has a mapped tram stop; the bench
    // stays inside the hall platform strip (fence + 0.15 .. + 0.59 m < gap), clear of the tram deck
    const fenceAt = Math.min(M.fenceOffsetM, gap - 0.3), at = (t, off) => { const p = q(t, off, 0); return nearStop(p[0], p[2]); };
    if (gap > M.benchMinGapM) {
        const ob = o + so * (fenceAt + 0.37), half = dt(0.9);
        let last = -Infinity; // (candidates every 0.5 m, first free of the pier, then one per benchEveryM)
        for (let s = a2 * len + 1.1; s <= b2 * len - 1.1; s += 0.5) {
            const t = s / len; if (s - last < M.benchEveryM || !freeOfPier(t, half) || !at(t, ob)) continue; last = s;
            box(face4, q, t - half, t + half, ob - so * 0.22, ob + so * 0.22, t2 => floor(t2) + 0.4, t2 => floor(t2) + 0.47, C.bench, nIn);
            for (const tt of [t - half * 0.8, t + half * 0.8]) box(face4, q, tt - dt(0.04), tt + dt(0.04), ob - so * 0.18, ob + so * 0.18, floor, t2 => floor(t2) + 0.4, C.benchFrame, nIn);
            out.benches++;
        }
    }
    if (gap > M.poleMinGapM) {
        const tp = (a2 + b2) / 2, op = o + so * (gap - 0.35);
        if (b2 - a2 > dt(4) && freeOfPier(tp, dt(0.3)) && at(tp, op)) {
            box(face4, q, tp - dt(0.05), tp + dt(0.05), op - 0.05, op + 0.05, floor, t => floor(t) + 2.5, C.pole, nIn);
            box(face4, q, tp - dt(0.3), tp + dt(0.3), op - 0.03, op + 0.03, t => floor(t) + 2.05, t => floor(t) + 2.5, C.plate, nIn);
        }
    }
    // sodium lamps: a dark housing with an orange lens under the soffit, along the carriageway centre
    if (lampOffset != null) for (let s = Math.ceil(a2 * len / M.lampEveryM) * M.lampEveryM; s <= b2 * len; s += M.lampEveryM) {
        const t = s / len, w = dt(0.6);
        box(face4, q, t - w, t + w, lampOffset - 0.2, lampOffset + 0.2, tt => ceil(tt) - 0.18, tt => ceil(tt) - 0.02, C.housing, nIn);
        face4(q(t + w, lampOffset - 0.16, ceil(t) - 0.19), q(t - w, lampOffset - 0.16, ceil(t) - 0.19), q(t - w, lampOffset + 0.16, ceil(t) - 0.19), q(t + w, lampOffset + 0.16, ceil(t) - 0.19), C.sodium, [0, -1, 0]);
        out.lamps++;
    }
    return out;
}
