// ============================================================================
//  TRENCH PARAPETS — the rim of an open underpass approach, by class, per OSM way (fidelity pass round 3, 2026-11-13).
//
//  world.js draws the rim of every open trench (an underpass ramp below street level) as a plain 1 m concrete parapet.
//  A row here replaces only that drawing with the class seen on an official street-level panorama (looked at only,
//  nothing stored); the collision wall, its openings and its position are never changed.
//    'stone-iron'  square light stone piers with dark iron balustrade panels between them on a low stone kerb
//                  (Pasajul Victoria, both approaches: east ramp on Bd. Iancu de Hunedoara, 44.452073, 26.088653 h91;
//                  west ramp, 44.452076, 26.082576, round 2 review: "balustraded retaining walls")
//  Pier spacing / section and panel heights are estimates from the panorama, not measurements; the panels' cast
//  ornament is drawn as plain vertical bars.
// ============================================================================
import { rgb } from './geobuild.js';

export const TRENCH_PARAPET_REVIEW = {
    'bucharest-romana': { names: ['Pasajul Victoria'], style: 'stone-iron', note: 'every open approach of Pasajul Victoria (name match on the source way): stone piers and iron panels' },
};

export const trenchParapetRow = (dataset, name) => { const r = TRENCH_PARAPET_REVIEW[dataset]; return r && r.names.includes(name) ? r : null; };

const STONE = rgb('#cfc7b5'), STONE_D = rgb('#b9b19f'), IRON = rgb('#2c3033');
// Pt(t, o, y): a point at fraction t of the edge, offset o from its centre line, y above the street; o: the rim line; oo: 0.25 m outside it;
// q0..q1: the run of the edge to draw; n: the normal toward the trench. Piers in `solid`, iron in `detail` (near only).
export function emitTrenchBalustrade(solid, detail, Pt, q0, q1, o, oo, n, lenM) {
    const run = (q1 - q0) * lenM; if (run < 0.05) return;
    const mid = (oa, ob) => (oa + ob) / 2, om = mid(o, oo);
    // low stone kerb along the rim (both faces + top)
    solid.face4(Pt(q0, o, 0.4), Pt(q1, o, 0.4), Pt(q1, o, 0.62), Pt(q0, o, 0.62), STONE_D, n);
    solid.face4(Pt(q1, oo, 0), Pt(q0, oo, 0), Pt(q0, oo, 0.62), Pt(q1, oo, 0.62), STONE_D, [-n[0], 0, -n[2]]);
    solid.face4(Pt(q0, oo, 0.62), Pt(q1, oo, 0.62), Pt(q1, o, 0.62), Pt(q0, o, 0.62), STONE, [0, 1, 0]);
    const A0 = Pt(q0, o, 0), B0 = Pt(q1, o, 0), uL = Math.hypot(B0[0] - A0[0], B0[2] - A0[2]) || 1, u = [(B0[0] - A0[0]) / uL, 0, (B0[2] - A0[2]) / uL];
    const bays = Math.max(1, Math.round(run / 2.6)), hp = 0.22 / lenM;
    for (let i = 0; i <= bays; i++) { // piers: 0.44 m square, to 1.15 m
        const t = Math.min(q1 - hp, Math.max(q0 + hp, q0 + (q1 - q0) * i / bays)), a = t - hp, b = t + hp;
        solid.face4(Pt(a, o, 0.62), Pt(b, o, 0.62), Pt(b, o, 1.15), Pt(a, o, 1.15), STONE, n);
        solid.face4(Pt(b, oo, 0.62), Pt(a, oo, 0.62), Pt(a, oo, 1.15), Pt(b, oo, 1.15), STONE, [-n[0], 0, -n[2]]);
        solid.face4(Pt(a, oo, 1.15), Pt(b, oo, 1.15), Pt(b, o, 1.15), Pt(a, o, 1.15), STONE_D, [0, 1, 0]);
        solid.face4(Pt(a, oo, 0.62), Pt(a, o, 0.62), Pt(a, o, 1.15), Pt(a, oo, 1.15), STONE_D, [-u[0], 0, -u[2]]);
        solid.face4(Pt(b, o, 0.62), Pt(b, oo, 0.62), Pt(b, oo, 1.15), Pt(b, o, 1.15), STONE_D, u);
    }
    for (let i = 0; i < bays; i++) { // iron panel between two piers: top / bottom rail and bars
        const a = q0 + (q1 - q0) * i / bays + hp, b = q0 + (q1 - q0) * (i + 1) / bays - hp; if (b <= a) continue;
        const two = (f0, f1, y0, y1) => { detail.face4(Pt(f0, om, y0), Pt(f1, om, y0), Pt(f1, om, y1), Pt(f0, om, y1), IRON, n); detail.face4(Pt(f1, om, y0), Pt(f0, om, y0), Pt(f0, om, y1), Pt(f1, om, y1), IRON, [-n[0], 0, -n[2]]); };
        two(a, b, 0.95, 1.02); two(a, b, 0.62, 0.68);
        const k = Math.max(3, Math.round((b - a) * lenM / 0.22)), hw = 0.012 / lenM;
        for (let j = 1; j < k; j++) { const f = a + (b - a) * j / k; two(f - hw, f + hw, 0.68, 0.95); }
    }
}
