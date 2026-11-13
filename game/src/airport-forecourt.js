// ============================================================================
//  AIRPORT FORECOURT — Otopeni (fidelity pass round 2, 2026-11-12; game/research/bucharest-otopeni.md).
//
//  (1) Lighting masts: OSM nodes `man_made=tower` + `tower:type=lighting` round the apron and the forecourt. Position
//      and height are OSM's (where `height` is tagged); a mast without a tagged height uses MAST_MODEL.defaultM and says
//      so. Form is a class model (a slim steel mast with a floodlight ring). One node is described by the street-level
//      review as banded orange / white: `banded` (appearance only).
//  (2) CFR station canopy: the station footprint (OSM way 813193384, an elevated building part in the district data)
//      carries a barrel vault over the platforms: green ribs and edge bands with glazed panels. The footprint, base and
//      top are the district data's; the vault's rise is an estimate (STATION_VAULT.riseM). When a landmark model replaced
//      that footprint (landmarks.js bOtpGara, compared with the panorama) the landmark draws the only vault: none here.
//  Not drawn here (no OSM object): the two flag masts on the forecourt roundabout island.
// ============================================================================
import { rgb } from './geobuild.js';

export const MAST_MODEL = { defaultM: 25, estimates: ['defaultM', 'shaft width', 'head'] };
export const LIGHTING_MASTS = {
    'bucharest-otopeni': [
        { id: 'n4086021663', lat: 44.57093, lon: 26.07994, heightM: 40 }, { id: 'n4086021669', lat: 44.57039, lon: 26.08006, heightM: 40 },
        { id: 'n4086021666', lat: 44.56875, lon: 26.08155, heightM: 30 }, { id: 'n4086021667', lat: 44.57245, lon: 26.07957, heightM: 30 },
        { id: 'n4086021670', lat: 44.57255, lon: 26.08107, heightM: 30 }, { id: 'n4087540192', lat: 44.56806, lon: 26.07868, heightM: 20 },
        { id: 'n4088322448', lat: 44.57162, lon: 26.07817 }, { id: 'n4088322449', lat: 44.56962, lon: 26.07845 }, { id: 'n4088322450', lat: 44.57014, lon: 26.07838 },
        { id: 'n4088322451', lat: 44.56855, lon: 26.07858 }, { id: 'n4088322452', lat: 44.57106, lon: 26.07825 },
        { id: 'n4089486527', lat: 44.56988, lon: 26.07689, banded: true },
    ],
};
export const STATION_VAULT = { 'bucharest-otopeni': { sourceId: 'w813193384', riseM: 4.6, ribEveryM: 6, estimates: ['riseM', 'ribEveryM'] } };

/** env: { key, project(lat, lon), cellOf, blocked(x, z, r) -> reason | null, baseY(x, z), addCollider(x, z, r, h, rec), building(sourceId) -> { ring, h } | null } */
export function emitAirportForecourt(env) {
    const out = { masts: [], skipped: [], vault: null };
    const steel = rgb('#9aa0a6'), dark = rgb('#5f656b'), lamp = rgb('#e9ecef'), orange = rgb('#e2622b'), white = rgb('#f1f1ee');
    for (const m of LIGHTING_MASTS[env.key] || []) {
        const q = env.project(m.lat, m.lon), x = q.x, z = q.z, H = m.heightM || MAST_MODEL.defaultM, why = env.blocked(x, z, .6);
        if (why) { out.skipped.push({ id: m.id, reason: why }); continue; }
        const c = env.cellOf(x, z).solid, y = env.baseY(x, z);
        c.box(x, y, z, 1.1, .5, 1.1, 0, dark);
        if (m.banded) { const n = 7; for (let i = 0; i < n; i++) c.box(x, y + .5 + (H - .5) * i / n, z, .55, (H - .5) / n, .55, 0, i % 2 ? white : orange); }
        else { c.box(x, y + .5, z, .62, H * .5, .62, 0, steel); c.box(x, y + .5 + H * .5, z, .42, H * .5 - .5, .42, 0, steel); }
        if (!m.banded) { c.box(x, y + H - .25, z, 2.6, .18, 2.6, Math.PI / 4, dark); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; c.box(x + Math.sin(a) * 1.25, y + H - .75, z + Math.cos(a) * 1.25, 1.5, .5, .35, a, lamp); } }
        env.addCollider(x, z, .6, Math.min(H, 4), { id: m.id });
        out.masts.push({ id: m.id, x: +x.toFixed(1), z: +z.toFixed(1), heightM: H, heightSource: m.heightM ? 'OSM height' : 'estimate' });
    }
    const sv = STATION_VAULT[env.key], b = sv && env.building(sv.sourceId);
    // a landmark model that replaced the station footprint carries its own (panorama-compared) vault: never draw a second one
    if (b?.replacedBy) out.vault = { sourceId: sv.sourceId, skipped: 'replaced-by-landmark', landmark: b.replacedBy };
    else if (b?.ring?.length >= 4) {
        // long axis: the longest edge of the footprint; the vault spans the footprint's width on it
        let best = null; for (let i = 0; i < b.ring.length; i++) { const p = b.ring[i], n = b.ring[(i + 1) % b.ring.length], L = Math.hypot(n[0] - p[0], n[1] - p[1]); if (!best || L > best.L) best = { L, ux: (n[0] - p[0]) / L, uz: (n[1] - p[1]) / L }; }
        const { ux, uz } = best, vx = uz, vz = -ux; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const [x, z] of b.ring) { const u = x * ux + z * uz, v = x * vx + z * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const W = (v1 - v0) / 2, vc = (v0 + v1) / 2, R = sv.riseM, top = b.h, S = 8, green = rgb('#3c9a6c'), greenD = rgb('#2f7d57'), glass = rgb('#bcd6d2');
        const P = (u, a, lift = 0) => { const v = vc - Math.cos(a) * (W + lift), y = top + Math.sin(a) * (R + lift); return [u * ux + v * vx, y, u * uz + v * vz]; };
        const cell = (u) => env.cellOf(((u * ux + vc * vx)), ((u * uz + vc * vz)));
        const n = Math.max(1, Math.round((u1 - u0) / sv.ribEveryM)), du = (u1 - u0) / n;
        for (let i = 0; i < n; i++) {
            const a0u = u0 + du * i, a1u = a0u + du, cs = cell((a0u + a1u) / 2).solid;
            for (let s = 0; s < S; s++) {
                const a0 = Math.PI * s / S, a1 = Math.PI * (s + 1) / S, am = (a0 + a1) / 2, out3 = [-Math.cos(am) * vx, Math.sin(am), -Math.cos(am) * vz], in3 = out3.map(k => -k);
                cs.face4(P(a0u, a0), P(a1u, a0), P(a1u, a1), P(a0u, a1), glass, out3); cs.face4(P(a1u, a0), P(a0u, a0), P(a0u, a1), P(a1u, a1), glass, in3);
                // rib at the start of the bay (and one at the far end), slightly proud of the panels
                for (const ur of i === n - 1 ? [a0u, a1u - .22] : [a0u]) cs.face4(P(ur, a0, .06), P(ur + .22, a0, .06), P(ur + .22, a1, .06), P(ur, a1, .06), green, out3);
            }
            // green edge band along both springing lines, and a ridge purlin
            for (const a of [0, Math.PI]) { const sgn = a ? -1 : 1, o = [-sgn * vx, 0, -sgn * vz]; cs.face4(P(a0u, a, .1), P(a1u, a, .1), [P(a1u, a, .1)[0], top + .9, P(a1u, a, .1)[2]], [P(a0u, a, .1)[0], top + .9, P(a0u, a, .1)[2]], greenD, o); }
            cs.face4(P(a0u, Math.PI / 2 - .05, .08), P(a1u, Math.PI / 2 - .05, .08), P(a1u, Math.PI / 2 + .05, .08), P(a0u, Math.PI / 2 + .05, .08), green, [0, 1, 0]);
        }
        out.vault = { sourceId: sv.sourceId, lengthM: +(u1 - u0).toFixed(1), widthM: +(2 * W).toFixed(1), baseM: top, riseM: R, bays: n, riseSource: 'estimate' };
    }
    return out;
}
