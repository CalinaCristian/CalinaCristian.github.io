// ============================================================================
//  BRIDGE GUARDS — the edge of a bridge / flyover deck by class, per OSM way, from the street-level review
//  (fidelity pass round 2, 2026-11-12; observations in game/research/bridge-guards.json).
//
//  The world builder guards every elevated deck edge with a collision rail and, by default, draws it as a plain grey
//  1.1 m concrete box. A reviewed row replaces only that drawing with the class seen at the real bridge:
//    'parapet'        solid concrete parapet, 1.1 m (the default, never needs a row)
//    'barrier'        low concrete traffic barrier (about 0.85 m), light concrete
//    'kerb-railing'   low concrete kerb block with a steel post-and-tube railing on it
//    'kerb-mesh'      low concrete kerb block with steel posts and mesh panels
//    'parapet-fence'  concrete parapet with a steel picket fence on top
//  Rules: keyed by OSM way id; the collision rail, its openings and its position are never changed here (the drawing
//  follows the final collision intervals exactly, like the default box, and stays in the same 0.3 m strip behind the
//  rail line); ways without a row keep the generic box; colours are tone classes, not sampled pixels.
//  Decks of the Basarab group (Pasajul Basarab and the ramps joined to it) have their own guard code in world.js.
// ============================================================================
import { rgb } from './geobuild.js';

export const BRIDGE_GUARD_REVIEW = {
    // Pipera
    w119926495: { style: 'kerb-mesh', colour: '#8f979e', note: 'Podul Barbu Văcărescu: low concrete kerb, galvanised posts with mesh panels' },
    // Otopeni
    w180054678: { style: 'kerb-railing', colour: '#9aa1a8', note: 'airport departures flyover: steel post-and-rail railing along the deck edge (seen from the forecourt only)' },
    // SeaTac
    w37017723: { style: 'barrier', note: 'Departures Drive: low concrete barrier on the open side' },
    w963677010: { style: 'barrier', note: 'Departures Drive (same deck as w37017723)' },
    w428095059: { style: 'barrier', note: 'Departures Drive north ramp: concrete barrier' },
    w427909577: { style: 'barrier', note: 'Airport Departures: concrete barrier' },
    w428003817: { style: 'barrier', note: 'Airport Departures (same deck as w427909577)' },
    w31928842: { style: 'barrier', note: 'ramp: concrete barrier' },
    w103929484: { style: 'barrier', note: 'Exit to Parking: concrete barriers on both sides' },
    w6429448: { style: 'barrier', note: 'Airport Expressway: concrete barriers' },
    w291552722: { style: 'barrier', note: 'ramp beside the expressway (same view as w6429448)' },
    w428094930: { style: 'barrier', note: 'ramp beside the expressway (same view as w6429448)' },
    w23609851: { style: 'barrier', note: 'Airport Expressway: concrete barrier (chain-link fence behind it not drawn)' },
    w1165458667: { style: 'barrier', note: 'Airport Expressway (same deck as w23609851)' },
    // Bellevue
    w30615115: { style: 'parapet-fence', colour: '#3b3f44', note: 'NE 8th St over I-405: concrete parapet with a dark steel picket fence' },
    w55481043: { style: 'parapet-fence', colour: '#3b3f44', note: 'NE 8th St over I-405' },
    w428073537: { style: 'parapet-fence', colour: '#3b3f44', note: 'NE 8th St over I-405' },
    w513238699: { style: 'parapet-fence', colour: '#3b3f44', note: 'NE 8th St over I-405' },
    w1058885032: { style: 'parapet-fence', colour: '#3b3f44', note: 'NE 8th St over I-405' },
};

export const bridgeGuardRow = sourceId => (sourceId && BRIDGE_GUARD_REVIEW[sourceId]) || null;

const CONC = rgb('#b4b2ab'), CONC_D = rgb('#a3a199'), CONC_T = rgb('#c9c7c0');
export const GUARD_CONCRETE = CONC;
const BLOCK_H = { barrier: .86, 'kerb-railing': .4, 'kerb-mesh': .35, 'parapet-fence': .85 };
// height of the concrete part above the deck (null: the default box)
export const guardBlockH = row => BLOCK_H[row?.style] ?? null;

// The steel part of a reviewed guard on the line a - b (deck levels deckA / deckB at the ends): thin two-sided strips.
export function emitGuardSteel(detail, ax, az, bx, bz, deckA, deckB, row) {
    const style = row?.style, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L <= .05 || !BLOCK_H[style] || style === 'barrier') return;
    const nx = -dz / L, nz = dx / L, col = rgb(row.colour || '#8f979e'), P = (f, h) => [ax + dx * f, deckA + (deckB - deckA) * f + h, az + dz * f];
    const quad = (f0, f1, h0, h1) => { const a = P(f0, h0), b = P(f1, h0), c = P(f1, h1), d = P(f0, h1); detail.face4(a, b, c, d, col, [nx, 0, nz]); detail.face4(b, a, d, c, col, [-nx, 0, -nz]); };
    const rail = (h0, h1) => quad(0, 1, h0, h1);
    const posts = (step, h0, h1, half) => { const n = Math.max(1, Math.round(L / step)), hf = half / L; for (let i = 0; i <= n; i++) { const f = Math.min(1 - hf, Math.max(hf, i / n)); quad(f - hf, f + hf, h0, h1); } };
    if (style === 'kerb-railing') { posts(2, .4, 1.12, .035); rail(1.06, 1.12); rail(.82, .86); rail(.6, .64); }
    else if (style === 'kerb-mesh') { posts(2.5, .35, 1.5, .03); rail(1.46, 1.5); rail(.4, .44); for (let h = .58; h < 1.4; h += .14) rail(h, h + .018); posts(.5, .44, 1.46, .008); }
    else if (style === 'parapet-fence') { posts(2.4, .85, 1.85, .04); rail(1.8, 1.85); rail(.9, .94); posts(.3, .94, 1.8, .012); }
}

// w: a final rail wall { ax, az, bx, bz, y1a, y1b (deck + 1.1), nx, nz }. solid / detail: the cell's mesh builders.
// Returns false when the row asks for the default box.
export function emitBridgeGuard(solid, detail, w, row) {
    const style = row?.style; if (!style || style === 'parapet') return false;
    const dx = w.bx - w.ax, dz = w.bz - w.az, L = Math.hypot(dx, dz); if (L <= .05) return true;
    const ux = dx / L, uz = dz / L, da = w.y1a - 1.1, db = w.y1b - 1.1, ox = -w.nx * .3, oz = -w.nz * .3;
    const yAt = f => da + (db - da) * f, P = (f, o, h) => [w.ax + dx * f + ox * o, yAt(f) + h, w.az + dz * f + oz * o];
    // concrete block of height h over the whole 0.3 m strip
    const block = (h, side = CONC, back = CONC_D, top = CONC_T) => {
        solid.face4(P(0, 0, 0), P(1, 0, 0), P(1, 0, h), P(0, 0, h), side, [w.nx, 0, w.nz]);
        solid.face4(P(1, 1, 0), P(0, 1, 0), P(0, 1, h), P(1, 1, h), back, [-w.nx, 0, -w.nz]);
        solid.face4(P(0, 0, h), P(1, 0, h), P(1, 1, h), P(0, 1, h), top, [0, 1, 0]);
        solid.face4(P(0, 1, 0), P(0, 0, 0), P(0, 0, h), P(0, 1, h), back, [-ux, 0, -uz]);
        solid.face4(P(1, 0, 0), P(1, 1, 0), P(1, 1, h), P(1, 0, h), back, [ux, 0, uz]);
    };
    const bh = guardBlockH(row); if (bh == null) return false;
    block(bh); emitGuardSteel(detail, w.ax + ox * .5, w.az + oz * .5, w.bx + ox * .5, w.bz + oz * .5, da, db, row);
    return true;
}
