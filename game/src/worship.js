// ============================================================================
//  PLACES OF WORSHIP — facade class (fidelity pass round 2, 2026-11-12).
//
//  The district `church` style used the eclectic window tile, so every church and synagogue read as a four-storey
//  house. A place of worship is drawn with a plain wall and a row of tall round-arched openings instead: one tall
//  storey, no window grid. This is a class appearance (what a nave wall looks like), not a likeness of any one church:
//  positions, footprints, heights and roof shapes stay the district data's. A tower / dome is only drawn where the
//  data has one (a building part, a roof shape, a tower tag): see `worshipHasTowerTag`.
//
//  Orthodox tower convention (backlog r3-look-11, 2026-11-13). The packs carry no church's religion; the live OSM tags of
//  every place-of-worship way are in worship-source.js (tools/osm/worship-source.mjs). A Romanian Orthodox church has a
//  tower (turla) over the naos, and a long one a second over the pronaos: an octagonal drum with a metal helmet and a
//  cross. An Armenian church has one drum with a cone. `worshipTowerPlan` adds them to an Orthodox / Armenian church
//  (OSM `denomination`) only where the data's own shape cannot already hold them:
//    - its height is the build's style estimate (an OSM `height` on the outline is read as the top of the church, its
//      tower included: nothing is added above it), no building parts (an assembly draws its own), no courtyard;
//    - its roof is the estimated pyramid / hip / gable (a mapped dome or flat roof is kept as it is);
//    - a chapel (`building=chapel`) or a footprint under 120 m2 gets one small tower, nothing under 60 m2.
//  Naos tower at the middle of the footprint's long axis, a smaller pronaos tower 30 % of the length towards its west end when the
//  footprint is at least 20 m long and 1.6 times as long as wide. Radius, drum and helmet heights follow the footprint
//  width (WORSHIP_TOWER_MODEL); the helmet takes `roof:colour` / `roof:material`, else the roof's own colour, else dark
//  tin. Western-rite, free-church and Jewish buildings get no inferred tower (no single convention). All sizes are
//  estimates (dossiers, "Estimates and open questions").
// ============================================================================
import { WORSHIP_SOURCE } from './worship-source.js';

const GLASS = [38, 46, 58], FRAME_K = .8;

// tags that say the mapped object itself has a tower or dome (the generic centroid cupola is kept only then)
export const worshipHasTowerTag = t => !!t && (/dome|onion|round|cone|spire/.test(t['roof:shape'] || '') || t['tower:type'] !== undefined || t.man_made === 'tower' || t['building:part'] === 'tower' || t.tower !== undefined);

// Tall round-arched openings on every wall of the ring long and high enough to carry one.
// mb: mesh builder; ring: [[x, z], ...]; ccw: signedArea(ring) > 0; y0 / top: wall base / eaves; wallCol: [r, g, b].
export function emitWorshipOpenings(mb, ring, ccw, y0, top, wallCol, skip = null) {
    const H = top - y0; if (!(H >= 4.2)) return 0;
    const frame = wallCol.map(v => Math.round(v * FRAME_K)); let n = 0;
    for (let k = 0; k < ring.length; k++) {
        if (skip && skip(k)) continue;
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3.2) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
        const ux = (bx - ax) / L, uz = (bz - az) / L, count = Math.max(1, Math.round(L / 4.4)), pitch = L / count;
        const w = Math.min(1.25, pitch * .34, H * .16), sill = y0 + Math.max(1.5, H * .3), spring = Math.min(top - w / 2 - .7, sill + Math.max(1.6, H * .42)); if (spring - sill < 1.2) continue;
        for (let i = 0; i < count; i++) {
            const t = (i + .5) * pitch, cx = ax + ux * t, cz = az + uz * t;
            const arch = (hw, off, col, drop) => {
                const P = (du, y) => [cx + ux * du + nx * off, y, cz + uz * du + nz * off], out = [nx, 0, nz];
                mb.face4(P(-hw, sill - drop), P(hw, sill - drop), P(hw, spring), P(-hw, spring), col, out);
                const S = 6; for (let s = 0; s < S; s++) { const a0 = Math.PI * s / S, a1 = Math.PI * (s + 1) / S; mb.face3(P(0, spring), P(Math.cos(a0) * hw, spring + Math.sin(a0) * hw), P(Math.cos(a1) * hw, spring + Math.sin(a1) * hw), col, out); }
            };
            arch(w / 2 + .14, .04, frame, .12); arch(w / 2, .07, GLASS, 0); n++;
        }
    }
    return n;
}

export const WORSHIP_TOWER_MODEL = {
    radiusOfWidth: 0.2, radiusM: [1.4, 3.0], smallRadiusM: [0.9, 1.5], drumOfRadius: 1.4, drumAddM: 0.8, drumM: [2.4, 5.5],
    helmetOfRadius: 1.3, coneOfRadius: 1.7, eaveOverhang: 1.12, crossM: 1.3, pronaosAt: 0.3, pronaosRadius: 0.7, pronaosDrum: 0.4,
    pronaosMinLengthM: 20, pronaosMinRatio: 1.6, smallAreaM2: 120, minAreaM2: 60, defaultCap: '#5e6668', copperCap: '#6f8f86',
};
const ORTHODOX = /^(romanian_orthodox|orthodox|russian_orthodox|serbian_orthodox|greek_orthodox|bulgarian_orthodox)$/;
/** rite class of a place-of-worship way from its live OSM tags (worship-source.js) */
export function worshipClass(sourceId) {
    const t = WORSHIP_SOURCE[sourceId]; if (!t) return { rite: 'unknown', tags: null };
    const d = t.denomination || '', r = t.religion || '';
    const rite = ORTHODOX.test(d) ? 'orthodox' : d === 'armenian_apostolic' ? 'armenian' : r === 'jewish' || d === 'jewish' ? 'jewish'
        : /catholic|lutheran|protestant|anglican|reformed/.test(d) ? 'western' : /baptist|evangelical|adventist|pentecostal/.test(d) ? 'free' : 'unknown';
    return { rite, tags: t };
}
/**
 * Towers for one church record b (b.ring, b.area, b.roofProfile, b.holes, b.assembly) with roofAt(x, z) its roof height.
 * Returns { towers: [{x, z, r, base, top, cap: 'helmet' | 'cone'}], reason, rite }.
 */
export function worshipTowerPlan(b, sourceId, roofAt) {
    const M = WORSHIP_TOWER_MODEL, cls = worshipClass(sourceId), p = b.roofProfile, none = (reason) => ({ towers: [], reason, rite: cls.rite });
    if (cls.rite !== 'orthodox' && cls.rite !== 'armenian') return none('rite:' + cls.rite);
    if (!p || !['pyramidal', 'hipped', 'gabled'].includes(p.shape)) return none('roof:' + (p?.shape || 'none'));
    if (cls.tags?.height !== undefined || /^OSM height/.test(p.heightSource || '')) return none('osm-height');
    if (b.assembly || b.holes?.length) return none('parts');
    if (!(b.area >= M.minAreaM2)) return none('small');
    const ring = b.ring; let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of ring) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz); let ux = Math.cos(ang), uz = Math.sin(ang); if (ux > 0) { ux = -ux; uz = -uz; } // u points west (−x)
    const vx = -uz, vz = ux; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of ring) { const u = (x - cx) * ux + (z - cz) * uz, v = (x - cx) * vx + (z - cz) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const L = u1 - u0, W = v1 - v0, mu = (u0 + u1) / 2, mv = (v0 + v1) / 2, at = (u) => [cx + ux * u + vx * mv, cz + uz * u + vz * mv];
    const small = cls.tags?.building === 'chapel' || b.area < M.smallAreaM2, cap = cls.rite === 'armenian' ? 'cone' : 'helmet';
    const r = Math.min(small ? M.smallRadiusM[1] : M.radiusM[1], Math.max(small ? M.smallRadiusM[0] : M.radiusM[0], W * M.radiusOfWidth));
    const hd = Math.min(M.drumM[1], Math.max(M.drumM[0], r * M.drumOfRadius + M.drumAddM)) * (small ? 0.7 : 1);
    const [nx, nz] = at(mu), apex = Math.max(p.totalM, roofAt(nx, nz) ?? p.totalM);
    const towers = [{ x: nx, z: nz, r, base: p.eavesM, top: apex + hd, cap }];
    if (!small && cap === 'helmet' && L >= M.pronaosMinLengthM && L >= W * M.pronaosMinRatio) {
        const [wx, wz] = at(mu + L * M.pronaosAt), rw = r * M.pronaosRadius, roofW = roofAt(wx, wz) ?? p.eavesM;
        towers.push({ x: wx, z: wz, r: rw, base: p.eavesM, top: Math.max(roofW + rw * 1.2, apex + hd * M.pronaosDrum), cap });
    }
    return { towers, reason: 'ok', rite: cls.rite, L, W };
}
const capColour = (tags, roofColour) => tags?.['roof:colour'] || (/copper/.test(tags?.['roof:material'] || '') ? WORSHIP_TOWER_MODEL.copperCap : roofColour || WORSHIP_TOWER_MODEL.defaultCap);
/** draw a plan: drums in `wall` (wall colour / tile, a narrow window slot on every other face), helmets / cones and crosses in `roof` */
export function emitWorshipTowers(wall, roof, plan, wallCol, tile, rgb, sourceId, roofColour) {
    const M = WORSHIP_TOWER_MODEL, capCol = rgb(capColour(WORSHIP_SOURCE[sourceId], roofColour)), dark = [34, 38, 44], cross = [196, 170, 92];
    for (const t of plan.towers) {
        const P = (k, rr, y) => { const a = k * Math.PI / 4; return [t.x + Math.cos(a) * rr, y, t.z + Math.sin(a) * rr]; };
        for (let k = 0; k < 8; k++) {
            const am = (k + 0.5) * Math.PI / 4, out = [Math.cos(am), 0, Math.sin(am)];
            wall.face4(P(k, t.r, t.base), P(k + 1, t.r, t.base), P(k + 1, t.r, t.top), P(k, t.r, t.top), wallCol, out, tile);
            if (k % 2 === 0) { // a narrow window slot in the middle of every other face
                const m0 = P(k, t.r * 1.015, 0), m1 = P(k + 1, t.r * 1.015, 0), f = (s) => [m0[0] + (m1[0] - m0[0]) * s, m0[2] + (m1[2] - m0[2]) * s];
                const hh = Math.min(1.7, (t.top - t.base) * 0.32), y1 = t.top - 0.5, [ax, az] = f(0.38), [bx, bz] = f(0.62);
                wall.face4([ax, y1 - hh, az], [bx, y1 - hh, bz], [bx, y1, bz], [ax, y1, az], dark, out);
            }
        }
        const rr = t.cap === 'cone' ? t.r * 1.02 : t.r * M.eaveOverhang, ch = t.r * (t.cap === 'cone' ? M.coneOfRadius : M.helmetOfRadius), tip = [t.x, t.top + ch, t.z];
        for (let k = 0; k < 8; k++) {
            const a = P(k, rr, t.top), b = P(k + 1, rr, t.top), am = (k + 0.5) * Math.PI / 4;
            roof.face3(a, b, tip, capCol, [Math.cos(am), rr / ch, Math.sin(am)]);
            roof.face4(a, b, P(k + 1, t.r, t.top), P(k, t.r, t.top), capCol, [0, -1, 0]);
        }
        roof.box(t.x, t.top + ch - 0.05, t.z, 0.08, M.crossM, 0.08, 0, cross); roof.box(t.x, t.top + ch + M.crossM * 0.62, t.z, 0.6, 0.08, 0.08, 0, cross);
    }
    return plan.towers.length;
}
