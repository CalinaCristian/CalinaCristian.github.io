// Overhead contact line of the Link aerial guideways (seatac-7, r2-world-guideway; 2026-11-13).
//
// Sourced: the lines are electrified (OSM `electrified=contact_line` on the Bellevue tracks w669516620 / w1154876472; Link
// runs on 1500 V DC overhead catenary, en.wikipedia.org/wiki/Link_light_rail). Where the poles stand is not mapped, so
// everything below is an ESTIMATE of a typical aerial-guideway catenary: a contact wire and a messenger wire over each
// main track, one pole every `poleEveryM` with a cross arm over both tracks (on the deck centre between them where the
// mains share a deck, else at the outer edge with an arm over the track). Heights are above the deck top.
export const GUIDEWAY_OCS = { wireM: 5.7, messengerM: 6.6, poleM: 7.6, poleEveryM: 55, colour: '#7c8184', wireColour: '#2a2c2e', estimates: ['wireM', 'messengerM', 'poleM', 'poleEveryM', 'pole positions'] };

/** wires over one main-track segment a -> b; quad / P are the guideway's own helpers, m its cell mesh */
export function ocsWires(quad, P, m, a, b, wireCol) {
    const O = GUIDEWAY_OCS;
    for (const [y, w] of [[O.wireM, 0.03], [O.messengerM, 0.025]]) quad(m, [P(a, w, a.top + y), P(b, w, b.top + y), P(b, -w, b.top + y), P(a, -w, a.top + y)], [0, -1, 0], wireCol);
}

/** one pole with its cross arm at guideway sample s (see the guideway modules for its fields); returns 1 */
export function ocsPole(env, s, poleCol) {
    const O = GUIDEWAY_OCS, ang = Math.atan2(s.ux, s.uz), shared = !!s.side;
    const off = shared ? s.side * s.half : s.wl - 0.35, px = s.x + s.nx * off, pz = s.z + s.nz * off;
    env.cellOf(px, pz).solid.box(px, s.top, pz, 0.32, O.poleM, 0.32, ang, poleCol);
    // arm: across both tracks from the centre pole, or from the edge pole to just past the track centre
    const span = shared ? 2 * s.half + 1.6 : s.wl + 0.9, mid = shared ? off : off - span / 2 + 0.16;
    const ax = s.x + s.nx * mid, az = s.z + s.nz * mid;
    env.cellOf(ax, az).solid.box(ax, s.top + O.messengerM - 0.1, az, span, 0.22, 0.22, ang, poleCol);
    return 1;
}
