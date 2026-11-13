// ============================================================================
//  QUAY BALUSTRADES — the railing on a channel quay, by OSM water polygon (backlog r3-look-5, 2026-11-13).
//
//  world-furniture.js draws the Unirii quays as a low stone kerb with a dark-green three-rail iron balustrade (the west
//  channel, plain green railing). The street-level review recorded in game/research/bucharest-unirii.md ("Water,
//  bridges and structures", 2026-11-12, looked at only) saw "dark ornamental panels east": on the east basin w174991904
//  the iron is drawn as cast panels between square posts: top and bottom rails, a frame rail, a lozenge in the middle
//  and a baluster either side. Post pitch, panel heights and the ornament are estimates (dossier "Estimates and
//  open questions"), not a copy of the panel design. Kerb, position and openings are world-furniture.js's own.
// ============================================================================
import { rgb } from './geobuild.js';

export const QUAY_BALUSTRADE_REVIEW = {
    unirii: {
        w174991904: { style: 'ornamental-panels', note: 'Dâmbovița east basin quays (Splaiul Unirii): dark cast-iron panels between square posts on the low stone kerb' },
    },
};
export const quayBalustradeRow = (districtId, sourceId) => QUAY_BALUSTRADE_REVIEW[districtId]?.[sourceId] || null;
export const QUAY_PANEL_MODEL = { postPitchM: 2.0, postM: 0.1, topM: 1.05, railLowM: 0.36, frameTopM: 0.94, frameLowM: 0.46, iron: '#262b29' };

/**
 * One quay segment: P(t, o, y) a point t metres along the quay edge, o metres off it (negative: landward), y above the
 * street; t0..t1 the segment of a quay edge edgeLen long; kerbH the kerb top; n the normal toward the water; ang the edge's
 * yaw. A panel's ornament is drawn by the segment holding its centre. Posts and the top rail in `solid`, the panel ornament (double-sided quads in the railing plane) in `detail` (near only).
 */
export function emitOrnamentalQuayPanels(solid, detail, P, t0, t1, kerbH, n, ang, edgeLen) {
    const M = QUAY_PANEL_MODEL, iron = rgb(M.iron), o = -0.15, back = [-n[0], 0, -n[2]];
    const [rx, , rz] = P((t0 + t1) / 2, o, 0);
    solid.box(rx, M.topM - 0.06, rz, 0.06, 0.07, t1 - t0, ang, iron); // handrail
    const two = (a, b, y0a, y1a, y0b = y0a, y1b = y1a) => { // a quad in the railing plane from t = a to b, both faces
        const q = [P(a, o, y0a), P(b, o, y0b), P(b, o, y1b), P(a, o, y1a)];
        detail.face4(...q, iron, n); detail.face4(q[1], q[0], q[3], q[2], iron, back);
    };
    const bar = (s0, y0, s1, y1, w) => { // a slanted bar of width w from (s0, y0) to (s1, y1) in the railing plane
        const L = Math.hypot(s1 - s0, y1 - y0) || 1, ps = -(y1 - y0) / L * w / 2, py = (s1 - s0) / L * w / 2;
        const q = [P(s0 - ps, o, y0 - py), P(s1 - ps, o, y1 - py), P(s1 + ps, o, y1 + py), P(s0 + ps, o, y0 + py)];
        detail.face4(...q, iron, n); detail.face4(q[1], q[0], q[3], q[2], iron, back);
    };
    const first = Math.ceil(t0 / M.postPitchM) * M.postPitchM;
    for (let t = first; t < t1; t += M.postPitchM) { // square posts standing just proud of the handrail
        const [px, , pz] = P(t, o, 0);
        solid.box(px, kerbH, pz, M.postM, M.topM + 0.08 - kerbH, M.postM, ang, iron);
    }
    for (let s = first - M.postPitchM; s < t1; s += M.postPitchM) { // panels between the posts (clipped to the segment)
        const a = Math.max(t0, s + M.postM / 2), b = Math.min(t1, s + M.postPitchM - M.postM / 2); if (b - a < 0.05) continue;
        two(a, b, M.railLowM, M.railLowM + 0.05); two(a, b, M.frameTopM, M.frameTopM + 0.03);
        const pc = s + M.postPitchM / 2; if (pc < t0 || pc >= t1 || s + M.postM / 2 < 0 || s + M.postPitchM - M.postM / 2 > edgeLen) continue; // ornament on whole panels only
        const c = pc, yc = (M.frameTopM + M.frameLowM) / 2, hw = 0.32, hh = (M.frameTopM - M.frameLowM) / 2 - 0.02;
        bar(c - hw, yc, c, yc + hh, 0.025); bar(c, yc + hh, c + hw, yc, 0.025); bar(c + hw, yc, c, yc - hh, 0.025); bar(c, yc - hh, c - hw, yc, 0.025); // lozenge
        two(c - 0.03, c + 0.03, yc - 0.06, yc + 0.06); // its boss
        for (const d of [-0.55, 0.55]) two(c + d - 0.014, c + d + 0.014, M.railLowM + 0.05, M.frameTopM); // balusters either side
    }
}
