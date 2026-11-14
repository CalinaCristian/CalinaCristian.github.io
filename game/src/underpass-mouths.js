// ============================================================================
//  UNDERPASS MOUTHS — the street-level ends of pedestrian passages OSM maps underground (`tunnel=yes`, `layer=-1`
//  footways), so a walker sees where a subway goes down (backlog grozavesti-7, 2026-11-13). The terrain is not cut: a
//  mouth is the stair well's dark floor with step nosings, a concrete parapet with a steel handrail along both sides and
//  across the low end, open at the top end where the stair meets the street. Position and direction are OSM's (the
//  tunnel way's end node and its next node); stair run, well width and parapet height are estimates (no steps / width
//  are mapped, and no panorama of these mouths was compared).
//
//  Grozăvești:
//    - Doina Cornea / Splaiul Independenței underpass w277315766 (35 m, no steps mapped): a mouth at each end node.
//    - Metrou Grozăvești east entrance n2479115705 under the OSM roof w905217305 (`building=roof`, which the pack drew as a
//      closed 14 × 8 m block): the roof becomes an open canopy (ENTRANCE_CANOPIES) and the stair well runs under it along
//      its long axis, open at the east end, down towards the passage w737986561 that leaves westwards.
//    - Not drawn: the west entrance n610921621 is the `grozmetro` landmark pavilion (landmarks.js); the Politehnica
//      passages w737868100 / w980510524 / w1071237750 are level -1 concourse ways between station stairs (level -2;-1),
//      with no street-level end; the station's street entrances are subway_entrance POIs.
// ============================================================================
import { rgb } from './geobuild.js';

const MOUTH_MODEL = { widthM: 3, runM: 6.5, parapetM: 0.9, railM: 1.05, estimates: ['widthM', 'runM', 'parapetM', 'railM', 'canopy topM / clearanceM'] };
const UNDERPASS_MOUTHS = {
    'bucharest-grozavesti': [
        { id: 'w277315766 (n2818578048)', top: [44.4374225, 26.0548483], toward: [44.4371686, 26.0551191] },
        { id: 'w277315766 (n2818578046)', top: [44.4371686, 26.0551191], toward: [44.4374225, 26.0548483] },
        { id: 'n2479115705 under w905217305', top: [44.4425882, 26.0611743], toward: [44.44262, 26.06099815], insetM: 1.4, runM: 9, widthM: 2.6, underRoof: true },
    ],
};
// reviewed open roofs (same record as fuel-canopy-review.js; world.js draws them as open canopies on estimated columns)
const ENTRANCE_CANOPIES = {
    'bucharest-grozavesti': {
        w905217305: { topM: 3.9, clearanceM: 3.45, topSource: 'estimate', clearanceSource: 'estimate', supportSource: 'estimate', estimateSupports: true, supportWidthM: 0.3,
            classificationSource: 'OSM building=roof over the metro entrance n2479115705 (underpass-mouths.js)',
            dimensionNote: 'An OSM roof has no walls; top, clearance and columns are estimates (no panorama compared); the clearance clears the 3.4 m metro sign pole the POI pass stands at the entrance node.' },
    },
};

/** world.js building records: the listed roofs become open canopies (as applyFuelCanopyReview). Returns the ids applied. */
export function applyEntranceCanopies(key, bRecs, buildingIds) {
    const rows = ENTRANCE_CANOPIES[key], out = []; if (!rows) return out;
    for (const b of bRecs) {
        const id = buildingIds?.[b.i], row = id && rows[id]; if (!row || b.canopy) continue;
        b.canopy = row; b.h = row.topM; b.minH = row.clearanceM; b.roof = 'flat'; b.roofProfile = null; b.flags &= ~1; out.push(id);
    }
    return out;
}

/** env: { key, project(lat, lon) -> {x, z}, cellOf, blocked(x, z, r) -> reason | null, inBuilding(x, z) -> bool, baseY(x, z), addCollider(x, z, hw, hd, angle, h, rec) } */
export function emitUnderpassMouths(env) {
    const out = { mouths: [], skipped: [], model: MOUTH_MODEL };
    const FLOOR = rgb('#34373a'), NOSE = rgb('#8c8f90'), WALL = rgb('#b9b6ae'), CAP = rgb('#cfccc4'), RAIL = rgb('#6f777d');
    for (const m of UNDERPASS_MOUTHS[env.key] || []) {
        const a = env.project(...m.top), b = env.project(...m.toward), L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1) continue;
        const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, vx = -uz, vz = ux, ang = Math.atan2(ux, uz);
        const W = (m.widthM || MOUTH_MODEL.widthM) / 2, u0 = m.insetM || 0, T = 0.22;
        const P = (u, v) => [a.x + ux * u + vx * v, a.z + uz * u + vz * v];
        // the well and its parapets must stand clear of every carriageway / footway ribbon, the tram sweep and (outside a roof)
        // buildings: the run is cut short where it would reach one (the stair turns or steepens there; a run under 3 m is not drawn)
        const sliceWhy = (u) => [-W - T, -W / 2, 0, W / 2, W + T].map(v => { const [x, z] = P(u, v); return env.blocked(x, z, 0.3) || (!m.underRoof && env.inBuilding(x, z) ? 'building' : null); }).find(Boolean);
        const want = Math.min(m.runM || MOUTH_MODEL.runM, L * 0.4); let u1 = u0, why = null;
        for (let u = u0; u <= u0 + want + T + 1e-6; u += 0.25) { why = sliceWhy(u); if (why) break; u1 = u; }
        u1 = Math.min(u1 - T, u0 + want);
        if (u1 - u0 < 3) { out.skipped.push({ id: m.id, reason: why || 'short' }); continue; }
        const [cx, cz] = P((u0 + u1) / 2, 0), c = env.cellOf(cx, cz), y = env.baseY(cx, cz), run = u1 - u0;
        // dark floor of the well with light step nosings every 0.6 m (the stair seen from the top)
        const q = (ua, va, ub, vb, yy, col) => { const p1 = P(ua, va), p2 = P(ub, va), p3 = P(ub, vb), p4 = P(ua, vb); c.solid.face4([p1[0], yy, p1[1]], [p4[0], yy, p4[1]], [p3[0], yy, p3[1]], [p2[0], yy, p2[1]], col, [0, 1, 0]); };
        q(u0, -W, u1, W, y + 0.03, FLOOR);
        for (let u = u0 + 0.6; u < u1 - 0.2; u += 0.6) q(u, -W, u + 0.07, W, y + 0.035, NOSE);
        // parapets (both sides, and across the low end) with a handrail on posts
        const wall = (ua, va, ub, vb) => {
            const [p, pz] = P((ua + ub) / 2, (va + vb) / 2), alongU = Math.abs(ub - ua) > Math.abs(vb - va), len = alongU ? Math.abs(ub - ua) : Math.abs(vb - va), wang = alongU ? ang : ang + Math.PI / 2;
            c.solid.box(p, y, pz, T, MOUTH_MODEL.parapetM, len, wang, WALL); c.solid.box(p, y + MOUTH_MODEL.parapetM, pz, T + 0.06, 0.06, len + 0.06, wang, CAP);
            c.detail.box(p, y + MOUTH_MODEL.railM, pz, 0.05, 0.05, len, wang, RAIL);
            const n = Math.max(1, Math.round(len / 1.5)); for (let k = 0; k <= n; k++) { const f = k / n, [px, pz2] = P(ua + (ub - ua) * f, va + (vb - va) * f); c.detail.box(px, y + MOUTH_MODEL.parapetM, pz2, 0.04, MOUTH_MODEL.railM - MOUTH_MODEL.parapetM, 0.04, 0, RAIL); }
            env.addCollider(p, pz, T / 2, len / 2, wang, MOUTH_MODEL.railM, { id: m.id });
        };
        wall(u0, -W - T / 2, u1 + T, -W - T / 2); wall(u0, W + T / 2, u1 + T, W + T / 2); wall(u1 + T / 2, -W, u1 + T / 2, W);
        out.mouths.push({ id: m.id, x: +cx.toFixed(1), z: +cz.toFixed(1), runM: +run.toFixed(1), widthM: 2 * W, ...(why ? { shortenedBy: why } : {}) });
    }
    return out;
}
