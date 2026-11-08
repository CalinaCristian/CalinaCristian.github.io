// ============================================================================
//  Harness geometry / edge helpers. Deliberately self-contained (no imports
//  from game/src) so the harness keeps working while the game modules change.
// ============================================================================
export const lanesDir = (e, dir) => dir > 0 ? (e.lanesF ?? e.lanes ?? 1) : (e.oneway ? 0 : (e.lanesB ?? e.lanes ?? 1));
export const canTravel = (e, dir) => lanesDir(e, dir) > 0;
export const edgeSpeed = (e) => e.maxspeed ?? e.speed ?? 13;
export const medianOf = (e) => e.median != null ? e.median : (e.tram ? 4.4 : 0);
// Travel-relative offset: callers multiply by dir to obtain the canonical +n coordinate.
export const laneOff = (e, lane = 0, dir = 1) => (e.sharedLane ? 0 : medianOf(e) / 2 + (e.laneW ?? 3.3) * (lane + 0.5)) + dir * (e.laneCenterShiftM || 0);
export const isMotorway = (e) => /^(highway|motorway|motorway_link|trunk|trunk_link|ramp)$/.test(e.type || '');
export const roadName = (e) => !e ? '' : (e.name || e.ref || (e.type ? `(${e.type})` : 'Unnamed road'));
/** carriageway half-width on side (+1 = right of a→b = +n, -1 = left) */
export const sideW = (e, side) => side > 0 ? (e.wR ?? e.halfW ?? 6) : (e.wL ?? e.halfW ?? 6);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const r1 = (v) => Math.round(v * 10) / 10;
export const r2 = (v) => Math.round(v * 100) / 100;

export function distPointSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}
export function pip(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
}
/** point (x,z) in the edge's frame: s = metres along a→b, lat = metres to the right (+n) */
export function edgeLocal(e, x, z) {
    const dx = x - e.a.x, dz = z - e.a.z;
    return { s: dx * e.dirx + dz * e.dirz, lat: dx * e.nx + dz * e.nz };
}
/** road surface height offset along edge (null when the world has no vertical profile) */
export function yAlong(e, x, z) {
    if (e.ya === undefined || e.yb === undefined) return null;
    const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1);
    return e.ya + (e.yb - e.ya) * t;
}
/** penetration test of a point against one collider (same shapes as world.js collideOne). true = inside */
export function pointInCollider(c, x, z, margin = 0) {
    if (c.wall || c.ax !== undefined) return false;
    if (c.poly) return pip(x, z, c.poly);
    if (c.prop && c.hw === c.r) return Math.hypot(x - c.x, z - c.z) < c.r - margin;
    const dx = x - c.x, dz = z - c.z, co = Math.cos(c.angle || 0), si = Math.sin(c.angle || 0);
    const lx = dx * co - dz * si, lz = dx * si + dz * co;
    return Math.abs(lx) < c.hw - margin && Math.abs(lz) < c.hd - margin;
}
/** distance from point to the collider's outline (negative inside), approximate for polygons */
export function colliderDist(c, x, z) {
    if (c.wall || c.ax !== undefined) return distPointSeg(x, z, c.ax, c.az, c.bx, c.bz).d - 0.2;
    if (c.prop && c.hw === c.r) return Math.hypot(x - c.x, z - c.z) - c.r;
    if (c.poly) {
        let bd = Infinity; const P = c.poly;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const r = distPointSeg(x, z, P[j][0], P[j][1], P[i][0], P[i][1]); if (r.d < bd) bd = r.d; }
        return pip(x, z, P) ? -bd : bd;
    }
    const dx = x - c.x, dz = z - c.z, co = Math.cos(c.angle || 0), si = Math.sin(c.angle || 0);
    const lx = dx * co - dz * si, lz = dx * si + dz * co;
    const ox = Math.abs(lx) - c.hw, oz = Math.abs(lz) - c.hd;
    if (ox <= 0 && oz <= 0) return Math.max(ox, oz);
    return Math.hypot(Math.max(0, ox), Math.max(0, oz));
}
const lampKey = (x, z) => Math.round(x * 4) + ',' + Math.round(z * 4);
export function lampSet(world) { const s = new Set(); for (const l of world.lamps || []) if (l && l.x !== undefined) s.add(lampKey(l.x, l.z)); return s; }
/** best-effort label for a collision entry (world.js does not tag them) */
export function colliderKind(c, lamps) {
    if (c.kind && typeof c.kind === 'string') return c.kind;
    if (c.wall) return 'wall';
    if (c.poly) return c.poi ? 'cv-building' : 'building';
    if (!c.prop) return 'landmark-box';
    if (c.hw !== c.r) return 'sign-pylon';
    if (lamps && lamps.has(lampKey(c.x, c.z))) return 'lamp';
    const r = c.r;
    if (r <= 0.16) return 'pole';
    if (r <= 0.22) return 'post/sign';
    if (r < 0.26) return 'post';
    if (r <= 0.52) return Math.abs(r - 0.35) < 0.001 ? 'canopy-pillar' : 'tree';
    if (r <= 0.6) return 'fuel-pump';
    if (r <= 0.8) return 'bus-shelter';
    return 'prop';
}
/** SAT overlap depth of two oriented rectangles {x,z,fx,fz,length,width} (>0 = overlap) */
export function obbPen(a, b) {
    const arx = -a.fz, arz = a.fx, brx = -b.fz, brz = b.fx;
    const dx = b.x - a.x, dz = b.z - a.z;
    let min = Infinity;
    for (const [ux, uz] of [[a.fx, a.fz], [arx, arz], [b.fx, b.fz], [brx, brz]]) {
        const ra = Math.abs(a.fx * ux + a.fz * uz) * a.length / 2 + Math.abs(arx * ux + arz * uz) * a.width / 2;
        const rb = Math.abs(b.fx * ux + b.fz * uz) * b.length / 2 + Math.abs(brx * ux + brz * uz) * b.width / 2;
        const pen = ra + rb - Math.abs(dx * ux + dz * uz);
        if (pen < min) min = pen;
    }
    return min;
}
export function pointInObb(o, x, z, shrink = 0) {
    const dx = x - o.x, dz = z - o.z; const f = dx * o.fx + dz * o.fz, l = dx * -o.fz + dz * o.fx;
    return Math.abs(f) < o.length / 2 - shrink && Math.abs(l) < o.width / 2 - shrink;
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** is collider c at the player's level (bridge decks / tunnels)? true when the game has no notion of levels */
export function atLevel(P, c) { try { return typeof P?.atLevel === 'function' ? P.atLevel(c) : true; } catch { return true; } }
/** the surface height the car would get at (x,z) driving on edge e at height yRef (player's own resolver when present) */
export function surfaceFor(P, W, x, z, yRef, e) {
    if (typeof P?.surfaceAt === 'function') {
        const se = P.supportEdge; P.supportEdge = e;
        try { const s = P.surfaceAt(x, z, yRef); return { h: s.h, edge: s.edge, how: 'player.surfaceAt' }; }
        catch { /* fall through */ } finally { P.supportEdge = se; }
    }
    return { h: W.roadHeight(x, z), edge: null, how: 'world.roadHeight' };
}
/** oriented box of a traffic vehicle as drawn (mesh rotation = v.heading, which lags the lane direction in turns) */
export function vObb(v) {
    if (!Number.isFinite(v.heading)) return v;
    return { x: v.x, z: v.z, fx: -Math.sin(v.heading), fz: -Math.cos(v.heading), length: v.length, width: v.width };
}
/** would the game's collision treat collider c as solid for the player at (x,z)? (wall height bands, pier yMax, levels) */
export function solidFor(P, c, x, z) {
    const y = P?.surfY ?? 0.24;
    if (c.wall || c.ax !== undefined) {
        if (c.y0a === undefined) return true;
        const r = distPointSeg(x, z, c.ax, c.az, c.bx, c.bz);
        const y0 = c.y0a + (c.y0b - c.y0a) * r.t, y1 = c.y1a + (c.y1b - c.y1a) * r.t;
        return !(y < y0 - 0.3 || y > y1);
    }
    if (c.yMax !== undefined && y > c.yMax) return false;
    return atLevel(P, c);
}
