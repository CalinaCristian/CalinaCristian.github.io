// ============================================================================
//  PASAJUL UNIRII — the street-level look of the open ramps (backlog unirii-pasaj-look, 2026-11-13).
//
//  Evidence: the panorama review recorded in game/research/bucharest-unirii.md, "Pasajul Unirii" (south ramp from
//  Bd. Dimitrie Cantemir, May 2024; north ramp; interior; looked at only, nothing stored or traced): "both carriageways
//  in one walled trench with a row of concrete planters between them; the ramp walls clad in dark grey perforated metal
//  with green leaf, flower and butterfly motifs, rising well above street level as a screen; a "PASAJUL UNIRII" header
//  over the portal". Positions come from the OSM ways (w241368617, w241368618, w1383050305): the walls stand where
//  world.js puts every trench wall, the planters on the line between the two carriageways where both lie in one cut, the
//  header on the portal where an open ramp meets its covered part. Every size and colour below is an estimate (dossier
//  "Estimates and open questions"); the motifs are a drawn pattern of the three shapes, not a copy of the panels.
//  The collision walls are world.js's own and unchanged (the screen is drawn above the 1 m trench rim wall).
// ============================================================================
import { rgb } from './geobuild.js';

export const PASAJ_UNIRII_MODEL = {
    name: 'Pasajul Unirii',
    screenTopM: 2.4,        // screen top above the street where the cut is deep (estimate: "rising well above street level")
    screenRampM: 2.0,       // the screen rises from the 1 m rim to its full height over the first 2 m of cut depth
    postPitchM: 3.0,        // dark steel uprights on the street side
    motifColumnM: 1.5, motifRowM: 1.1, // motif lattice on the cladding (estimate)
    planter: { pitchM: 3.2, lenM: 2.2, widthM: 0.9, heightM: 0.85, shrubM: 0.45, minDepthM: 0.9 },
    header: { text: 'PASAJUL UNIRII', beamM: 1.3, letterM: 0.9, bg: '#2b2f31', fg: '#f2f2ee' },
};
export const isPasajUnirii = (source) => source?.tags?.name === PASAJ_UNIRII_MODEL.name;

const CLAD = rgb('#4d5154'), CLAD_OUT = rgb('#45494c'), STEEL = rgb('#2b2e30'), CAP = rgb('#6c7073');
const LEAF = [rgb('#5f9b3c'), rgb('#86bd4a'), rgb('#3f7d34')], FLOWER = rgb('#b9dc6b'), HEART = rgb('#e3e8a2'), WING = rgb('#9ccf55'), WING_IN = rgb('#6fae3f');
const PLANTER = rgb('#b8b4ab'), PLANTER_RIM = rgb('#cfcbc2'), SHRUB = rgb('#4b7a31');

const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * Motifs on one cladding plane: at(s, y) is the point s metres along the wall at height y (street = 0); s0..s1 the run;
 * lo(s) / hi(s) the clear height band there; n the face's outward normal. Shapes lie on a fixed lattice in (s, y), so the
 * pieces drawn by the wall and by the screen above it continue one pattern. Returns the triangles added.
 */
export function emitPasajMotifs(mb, at, s0, s1, lo, hi, n) {
    const M = PASAJ_UNIRII_MODEL, before = mb.ic;
    const q = (s, y, ds, dy, c, sn) => at(s + ds * c - dy * sn, y + ds * sn + dy * c);
    const diamond = (s, y, L, H, ang, col) => { const c = Math.cos(ang), sn = Math.sin(ang); mb.face4(q(s, y, -L / 2, 0, c, sn), q(s, y, 0, -H / 2, c, sn), q(s, y, L / 2, 0, c, sn), q(s, y, 0, H / 2, c, sn), col, n); };
    for (let i = Math.ceil(s0 / M.motifColumnM); i * M.motifColumnM <= s1; i++) {
        const sc = i * M.motifColumnM;
        for (let j = -8; j <= 3; j++) {
            const r = hash(i, j), s = sc + (hash(j, i) - 0.5) * 0.5, y = j * M.motifRowM + (i % 2) * 0.45;
            if (s - 0.45 < s0 || s + 0.45 > s1 || y - 0.4 < lo(s) || y + 0.4 > hi(s)) continue;
            if (r < 0.5) { // leaf spray: two or three leaves on a short stem
                const a = (r - 0.25) * 2.4, col = LEAF[(i + j + 8) % 3];
                diamond(s, y, 0.62, 0.24, a, col);
                diamond(s + Math.cos(a + 1.1) * 0.24, y + Math.sin(a + 1.1) * 0.24, 0.44, 0.17, a + 0.9, LEAF[(i + j + 9) % 3]);
                if (r < 0.3) diamond(s + Math.cos(a - 1.2) * 0.22, y + Math.sin(a - 1.2) * 0.22, 0.4, 0.16, a - 0.8, LEAF[(i + j + 10) % 3]);
            } else if (r < 0.72) { // flower: two crossed petal pairs and a pale heart
                diamond(s, y, 0.5, 0.17, 0.4, FLOWER); diamond(s, y, 0.5, 0.17, 0.4 + Math.PI / 2, FLOWER);
                diamond(s, y, 0.14, 0.14, 0, HEART);
            } else if (r < 0.86) { // butterfly: fore and hind wings either side of the body
                const t = (r - 0.79) * 3;
                for (const side of [-1, 1]) { diamond(s + side * 0.17, y + 0.07, 0.3, 0.24, t + side * 0.5, WING); diamond(s + side * 0.13, y - 0.12, 0.2, 0.16, t - side * 0.4, WING_IN); }
                diamond(s, y, 0.05, 0.34, t, STEEL);
            }
        }
    }
    return (mb.ic - before) / 3;
}

/**
 * The rim screen that replaces the plain 1 m parapet on Pasajul Unirii: Pt(t, o, y) as in world.js (t: edge fraction),
 * o the rim line, oo 0.25 m outside it, q0..q1 the open run, n the normal toward the trench, lenM the edge length,
 * roadY(t) the road height below (negative in the cut). Cladding in `solid`, posts / cap / motifs in `detail`.
 */
export function emitPasajScreen(solid, detail, Pt, q0, q1, o, oo, n, lenM, roadY) {
    const M = PASAJ_UNIRII_MODEL, run = (q1 - q0) * lenM; if (run < 0.05) return;
    const top = (t) => 1.0 + (M.screenTopM - 1.0) * Math.min(1, Math.max(0, (-roadY(t) - 0.35) / M.screenRampM));
    const k = Math.max(1, Math.ceil(run / 3)), back = [-n[0], 0, -n[2]];
    for (let i = 0; i < k; i++) {
        const a = q0 + (q1 - q0) * i / k, b = q0 + (q1 - q0) * (i + 1) / k;
        solid.face4(Pt(a, o, 0.4), Pt(b, o, 0.4), Pt(b, o, top(b)), Pt(a, o, top(a)), CLAD, n);
        solid.face4(Pt(b, oo, 0), Pt(a, oo, 0), Pt(a, oo, top(a)), Pt(b, oo, top(b)), CLAD_OUT, back);
        solid.face4(Pt(a, oo, top(a)), Pt(b, oo, top(b)), Pt(b, o, top(b)), Pt(a, o, top(a)), CAP, [0, 1, 0]);
    }
    // street-side uprights (thin steel posts proud of the outer face)
    const op = oo + (oo - o) * 0.24, hp = 0.05 / lenM;
    for (let s = Math.ceil(q0 * lenM / M.postPitchM) * M.postPitchM; s <= q1 * lenM; s += M.postPitchM) {
        const t = s / lenM, a = Math.max(q0, t - hp), b = Math.min(q1, t + hp);
        detail.face4(Pt(b, op, 0), Pt(a, op, 0), Pt(a, op, top(t) + 0.04), Pt(b, op, top(t) + 0.04), STEEL, back);
    }
    const sAt = (s) => s / lenM;
    const inner = (s, y) => Pt(sAt(s), o + (oo - o) * -0.08, y), outer = (s, y) => Pt(sAt(s), oo + (oo - o) * 0.08, y);
    emitPasajMotifs(detail, inner, q0 * lenM, q1 * lenM, () => 0.45, (s) => top(sAt(s)) - 0.08, n);
    emitPasajMotifs(detail, outer, q0 * lenM, q1 * lenM, () => 0.3, (s) => top(sAt(s)) - 0.08, back);
}

/**
 * Concrete planters between two carriageways in one cut: mid(s) → [x, z] on the line between them s metres along the
 * first edge, floor(s) its road height (street = 0), dir the edge direction; s0..s1 where both lie in the cut.
 */
export function emitPasajPlanters(solid, detail, mid, floor, dir, s0, s1) {
    const P = PASAJ_UNIRII_MODEL.planter, rot = Math.atan2(dir[0], dir[1]); let count = 0;
    for (let s = Math.ceil(s0 / P.pitchM) * P.pitchM; s + P.lenM / 2 <= s1; s += P.pitchM) {
        const y = floor(s); if (y > -P.minDepthM) continue;
        const [x, z] = mid(s);
        solid.box(x, y, z, P.widthM, P.heightM, P.lenM, rot, PLANTER);
        solid.box(x, y + P.heightM, z, P.widthM + 0.06, 0.06, P.lenM + 0.06, rot, PLANTER_RIM);
        detail.box(x, y + P.heightM + 0.06, z, P.widthM - 0.2, P.shrubM, P.lenM - 0.3, rot, SHRUB);
        count++;
    }
    return count;
}
