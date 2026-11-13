// Traffic helpers shared by the Traffic / Pedestrians classes and their method modules (split from traffic.js, spec 22):
// edge geometry (lane / tram offsets, medians, sidewalk widths), hour profiles, body overlap tests and the spatial grid.
import { canTravel } from './nav.js';
import { ambientTrafficAccess } from './road-access.js';
import { canTravelTram } from './tram-path.js';

const TYPE_MUL = {
    motorway: 0.6, trunk: 0.9, primary: 1.6, secondary: 1.2, tertiary: 0.9, unclassified: 0.4, residential: 0.35,
    living_street: 0.08, service: 0.08, motorway_link: 0.3, trunk_link: 0.35, primary_link: 0.4, secondary_link: 0.3, tertiary_link: 0.25,
};
export const trafficMulOf = (e) => e.trafficMul ?? TYPE_MUL[e.type] ?? 0.5;
// Source sides are relative to edge a→b, independently of travel direction.
// Keep scalar-only fixture/legacy fallbacks byte-for-byte compatible.
export const sidewalkWidthOf = (world, e, side, fallback = 3) => {
    const native = world?.sidewalkWidth?.(e, side);
    if (Number.isFinite(native)) return Math.max(0, native);
    const explicit = side > 0 ? e.sidewalkRightM : e.sidewalkLeftM;
    return Number.isFinite(explicit) ? Math.max(0, explicit) : e.sidewalk ?? fallback;
};
export const sourceSideWidth = (world, e, side) => Number.isFinite(world?.sidewalkWidth?.(e, side)) || Number.isFinite(side > 0 ? e.sidewalkRightM : e.sidewalkLeftM);
// ---- traffic volume by local hour (relative to midday = 1). Used when the world has no trafficProfile(hour).
//      Bucharest: TomTom-style peaks 07–10 and 16–19 (×1.6), quiet nights 22–05 (×0.25). Seattle: flatter.
export const HOUR_PROFILE = {
    ro: [[0, 0.25], [5, 0.25], [6, 0.7], [7, 1.6], [10, 1.6], [11, 1.0], [15.5, 1.0], [16, 1.6], [19, 1.6], [20, 1.0], [22, 0.25], [24, 0.25]],
    us: [[0, 0.2], [5, 0.2], [6, 0.6], [7, 1.35], [9.5, 1.35], [10.5, 0.85], [15, 0.85], [16, 1.35], [18.5, 1.35], [19.5, 0.8], [22, 0.2], [24, 0.2]],
};
export function hourDensity(table, h) {
    h = ((h % 24) + 24) % 24;
    for (let i = 1; i < table.length; i++) {
        const [h1, v1] = table[i]; if (h > h1) continue;
        const [h0, v0] = table[i - 1]; const k = (h - h0) / Math.max(1e-6, h1 - h0);
        return v0 + (v1 - v0) * k;
    }
    return table[table.length - 1][1];
}
export function bandOf(density) { return density >= 1.3 ? 'rush' : density <= 0.45 ? 'night' : 'normal'; }
/** vehicles at (x,z) on the street level (not on a deck above / in a tunnel below) */
export const streetLevel = (v) => Math.abs((v.y ?? 0.24) - 0.24) < 2;
/** width of the median (tram tracks / divider) */
export function medianOf(e) {
    if (e.median != null) return e.median;
    return e.tram ? 4.4 : (e.type === 'highway' ? 1.2 : 0);
}
/** lateral offset (to the right of travel) of lane `lane` (0 = innermost) */
export function laneOffset(edge, lane, dir = 1) { return (edge.sharedLane ? 0 : medianOf(edge) / 2 + (edge.laneW ?? 3.3) * (lane + 0.5)) + dir * (edge.laneCenterShiftM || 0); }
export const tramBaseOffset = e => Math.max(1.45, medianOf(e) / 4);
export const tramOffset = (e, dir = 1) => e.rail ? 0 : tramBaseOffset(e) + dir * (e.laneCenterShiftM || 0);
export const layerOf = (e) => e.modelLayer ?? ((e.bridge ? 1 : 0) + (e.tunnel ? -1 : 0) + (e.layer | 0));
export const isJunction = (n) => n.edges.length >= 3 || n.hasLight;
/** a road cut at the district boundary (closure at its map-end node, spec R10.9): never routed into, never spawned on */
export const closedEdge = (e) => e.rail ? !e.usable : !!(e.a.mapEnd || e.b.mapEnd || !ambientTrafficAccess(e));
export const actorCanTravel = (e, dir, v) => e.rail ? !!v.tram && canTravelTram(e, dir) : canTravel(e, dir);
// long vehicles (buses, trams, trucks ≥ 8.5 m): the body follows the lane path — front and rear axle points on the
// path, the junction pad crossed as the chord entry lane → exit lane — instead of pivoting on its centre (note 4:
// an 18 m bus turning on its centre swept broadside across the junction mouth, and froze like that when stopped)
export const LONG_LEN = 8.5;
// (switch for the body placement below; false = placed like a car. Round-5 QA: the Bellevue finale stalls the same with
//  it off and with the round-4 traffic.js — not the cause)
export const LONG_BODY = true;
/** pad half-length used to blend lane paths across node n (junction pad, or a few metres at a bend) */
export const padOf = (n, e) => Math.min(Math.max(n.radius ?? 0, 3), e.len * 0.45);
export const PED_R = 0.3; // pedestrian body radius (vehicles and static obstacles keep this clear)
// (h-sim) a signal head of the controller a car left less than this far back is part of the same movement (no new red)
export const SAME_CONTROLLER_M = 40;
export function pedestrianPen(v, p, x = v.x, z = v.z, heading = v.heading) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading), dx = p.x - x, dz = p.z - z;
    return PED_R - Math.max(Math.abs(dx * fx + dz * fz) - v.length / 2, Math.abs(-dx * fz + dz * fx) - v.width / 2);
}
export function pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}
/** distance (m) from position s (a→b frame) on edge e to the nearest junction along the road, both ways (capped at `cap`) */
export function junctionDist(e, s, cap = 60) {
    const walk = (edge, node, d) => {
        let cur = edge, n = node, acc = d, guard = 0;
        while (acc < cap && guard++ < 12) {
            if (isJunction(n)) return acc;
            if (n.edges.length < 2) return Infinity; // dead end
            const nx = n.edges.find(x => x !== cur); if (!nx) return Infinity;
            acc += nx.len; n = nx.a === n ? nx.b : nx.a; cur = nx;
        }
        return acc;
    };
    return Math.min(walk(e, e.b, e.len - s), walk(e, e.a, s));
}
/** extents of the player's rectangle projected on an axis (ux,uz) */
export function playerExtent(P, ux, uz) {
    const pl = (P.length || 4.4) / 2, pw = (P.width || 1.8) / 2;
    return Math.abs(P.fx * ux + P.fz * uz) * pl + Math.abs(-P.fz * ux + P.fx * uz) * pw;
}
/** SAT penetration depth between a vehicle and the player (>0 = overlapping, <0 = separation) */
export function playerPen(v, P, x = v.x, z = v.z, fx = v.fx, fz = v.fz) {
    const rx = -fz, rz = fx, prx = -P.fz, prz = P.fx;
    const vl = v.length / 2, vw = v.width / 2;
    const co = ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2; // (the player's body centre sits ahead of the eye: player.js)
    const dx = P.x + P.fx * co - x, dz = P.z + P.fz * co - z;
    let min = Infinity;
    for (const [ux, uz] of [[fx, fz], [rx, rz], [P.fx, P.fz], [prx, prz]]) {
        const ra = Math.abs(fx * ux + fz * uz) * vl + Math.abs(rx * ux + rz * uz) * vw;
        const pen = ra + playerExtent(P, ux, uz) - Math.abs(dx * ux + dz * uz);
        if (pen < min) min = pen;
    }
    return min;
}

/** SAT penetration of two oriented boxes (centre, unit forward, half length, half width); > 0 = overlapping */
function boxPen(ax, az, afx, afz, al, aw, bx, bz, bfx, bfz, bl, bw) {
    let m = Infinity;
    const dx = bx - ax, dz = bz - az;
    for (let k = 0; k < 4; k++) {
        const ux = k === 0 ? afx : k === 1 ? -afz : k === 2 ? bfx : -bfz, uz = k === 0 ? afz : k === 1 ? afx : k === 2 ? bfz : bfx;
        const ra = Math.abs(afx * ux + afz * uz) * al + Math.abs(-afz * ux + afx * uz) * aw;
        const rb = Math.abs(bfx * ux + bfz * uz) * bl + Math.abs(-bfz * ux + bfx * uz) * bw;
        const p = ra + rb - Math.abs(dx * ux + dz * uz); if (p < m) { m = p; if (m <= 0) return m; }
    }
    return m;
}
/** Signed SAT separation of two drawn vehicle bodies: > 0 penetration, < 0 the widest separating gap (no early exit,
 * so a negative value is a real clearance, unlike boxPen's first separating axis). */
export function vvClearance(a, b) {
    const afx = -Math.sin(a.heading), afz = -Math.cos(a.heading), bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading), dx = b.x - a.x, dz = b.z - a.z;
    let m = Infinity;
    for (let k = 0; k < 4; k++) {
        const ux = k === 0 ? afx : k === 1 ? -afz : k === 2 ? bfx : -bfz, uz = k === 0 ? afz : k === 1 ? afx : k === 2 ? bfz : bfx;
        const ra = Math.abs(afx * ux + afz * uz) * a.length / 2 + Math.abs(-afz * ux + afx * uz) * a.width / 2;
        const rb = Math.abs(bfx * ux + bfz * uz) * b.length / 2 + Math.abs(-bfz * ux + bfx * uz) * b.width / 2;
        m = Math.min(m, ra + rb - Math.abs(dx * ux + dz * uz));
    }
    return m;
}
/** Is a's nose pointing into b's body (b ahead of a and across a's own width band)? In a T-bone exactly one car is. */
export function noseInto(a, b) {
    const fx = -Math.sin(a.heading), fz = -Math.cos(a.heading), dx = b.x - a.x, dz = b.z - a.z;
    if (dx * fx + dz * fz <= 0) return false;
    const bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading), rx = -fz, rz = fx; // a's lateral axis
    const extent = Math.abs(bfx * rx + bfz * rz) * b.length / 2 + Math.abs(-bfz * rx + bfx * rz) * b.width / 2;
    return Math.abs(dx * rx + dz * rz) - extent < a.width / 2;
}
/** A knot that has been opened keeps being opened to this real gap, so the struck car's next step is not refused again. */
export const KNOT_OPEN_GAP = 0.3, KNOT_HOLD_S = 1.5;
/** A vehicle farther than this from every active camera is not "in view" for recovery: a 4.4 m car at 700 m subtends
 *  what a 1.8 m person does at the pedestrian recovery limit of 300 m (about 6 mrad, under 10 px at 1080p / 72 degrees). */
export const RECOVERY_VIEW_FAR_M = 700;
/** Converging noses (a merge corner): one car keeps yielding at this gap until the other has pulled clear. */
export const KNOT_YIELD_GAP = 1.2, KNOT_YIELD_S = 4;
/** penetration between two vehicles as drawn (mesh heading) */
export const vvPen = (a, b, ax = a.x, az = a.z, ah = a.heading) => boxPen(ax, az, -Math.sin(ah), -Math.cos(ah), a.length / 2, a.width / 2, b.x, b.z, -Math.sin(b.heading), -Math.cos(b.heading), b.length / 2, b.width / 2);
/** penetration between a vehicle (as drawn) and the player */
export const vpPen = (v, P) => { const co = ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2; return boxPen(v.x, v.z, -Math.sin(v.heading), -Math.cos(v.heading), v.length / 2, v.width / 2, P.x + P.fx * co, P.z + P.fz * co, P.fx, P.fz, (P.length || 4.4) / 2, (P.width || 1.8) / 2); };
/** minimum distance between segments p0p1 and q0q1 */
export function segDist(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
    const d = (ax, az, bx, bz, px, pz) => { const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9; const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2)); return Math.hypot(ax + vx * t - px, az + vz * t - pz); };
    const o = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d1 = o(p0x, p0z, p1x, p1z, q0x, q0z), d2 = o(p0x, p0z, p1x, p1z, q1x, q1z), d3 = o(q0x, q0z, q1x, q1z, p0x, p0z), d4 = o(q0x, q0z, q1x, q1z, p1x, p1z);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
    return Math.min(d(p0x, p0z, p1x, p1z, q0x, q0z), d(p0x, p0z, p1x, p1z, q1x, q1z), d(q0x, q0z, q1x, q1z, p0x, p0z), d(q0x, q0z, q1x, q1z, p1x, p1z));
}

// ---------- fixed-size spatial hash (no per-frame allocation) ----------
export class Grid {
    constructor(cell, bits = 12, fixed = false) { this.fixed=fixed;this.cell = cell; this.mask = (1 << bits) - 1; this.head = new Int32Array(1 << bits); this.next = new Int32Array(64); this.items = null; }
    hash(ix, iz) { return ((ix * 92837111) ^ (iz * 689287499)) & this.mask; }
    build(items) {
        this.items = items; this.head.fill(-1);
        if (this.next.length < items.length) this.next = new Int32Array(items.length * 2);
        const c = this.cell;
        if(this.fixed&&(!this.ix||this.ix.length<items.length)){this.ix=new Int32Array(items.length);this.iz=new Int32Array(items.length);}
        for (let i = 0; i < items.length; i++) {const x=Math.floor(items[i].x/c),z=Math.floor(items[i].z/c);if(this.fixed){this.ix[i]=x;this.iz[i]=z;} const h = this.hash(x,z); this.next[i] = this.head[h]; this.head[h] = i; }
    }
    /** calls fn(item) for items in cells overlapping the square (x±r, z±r); may include a few extras (hash collisions) */
    query(x, z, r, fn) {
        const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
        const it = this.items;
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { for (const o of it) fn(o); return; }
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
            for (let i = this.head[this.hash(ix, iz)]; i !== -1; i = this.next[i]) {
                const o = it[i]; const ox = this.fixed?this.ix[i]:Math.floor(o.x / c), oz = this.fixed?this.iz[i]:Math.floor(o.z / c);
                if (ox === ix && oz === iz) fn(o);
            }
        }
    }
}

/** District level of detail. A district world (about 1 km²) simulated every vehicle and walker at full rate wherever the
 * player was: at the morning peak 485 of 581 vehicles were more than 300 m away. An actor farther than this from the
 * player, the walker and the active camera steps every other frame with twice the time step, as far vehicles on the
 * large legacy maps always have; beyond the second distance every fourth frame. The stride never makes a step longer
 * than 0.08 s, so at 30 fps both tiers step every other frame and below 25 fps nothing is thinned. Nothing is removed and
 * nothing nearer than the first distance changes. */
export const DISTRICT_LOD_VEHICLE_M = 160, DISTRICT_LOD_VEHICLE_FAR_M = 380, DISTRICT_LOD_WALKER_M = 160, DISTRICT_LOD_WALKER_FAR_M = 320;
export const lodStride = (tier, dt) => tier ? Math.max(1, Math.min(tier === 2 ? 4 : 2, Math.floor(0.08 / dt + 1e-6))) : 1;

/** Adds methods to a class prototype exactly as if they were written in the class body (non-enumerable). The Traffic and
 * Pedestrians classes keep their methods in several modules (traffic-*.js, pedestrians-*.js) to stay under 60 KB each. */
export function mixin(Cls, ...parts) {
    for (const part of parts) for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(part))) Object.defineProperty(Cls.prototype, k, { ...d, enumerable: false });
}
