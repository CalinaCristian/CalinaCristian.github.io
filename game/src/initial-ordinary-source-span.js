// Before-publication support over literal internal road shape points only.
// The original centre edge/lane/direction and every native physical guard stay.
import { canTravel, lanesDir } from './nav.js';
import { ambientTrafficAccess } from './road-access.js';
import { subtractTramTrench as subtractConvexPolygon } from './tram-trench.js';

const finite = Number.isFinite;
const source = e => e.access?.sourceId;
const ordinary = v => !(v.long || v.bus || v.tram || v.service || v.parked);
const controls = n => n.mapEnd || n.pad || n.hasLight || n.crossing || n.zebra || n.stop || n.giveWay || n.sourceSignal;
function flatHeight(e) {
    return finite(e.a.y) && finite(e.b.y) && Math.abs(e.a.y - e.b.y) < 1e-7 ? e.a.y : null;
}
function legal(e, dir) {
    return !e.rail && !e.virtual && !e.a.mapEnd && !e.b.mapEnd && e.drivable !== false && canTravel(e, dir) && ambientTrafficAccess(e);
}
function compatible(a, ad, b, bd) {
    if (!source(a) || source(a) !== source(b) || !legal(b, bd) || lanesDir(a, ad) !== lanesDir(b, bd)) return false;
    if (!!a.bridge !== !!b.bridge || !!a.tunnel !== !!b.tunnel || (a.layer || 0) !== (b.layer || 0)) return false;
    const ay = flatHeight(a), by = flatHeight(b);
    if (ay === null || by === null || Math.abs(ay - by) > 1e-7) return false;
    for (const k of ['laneW', 'median', 'wL', 'wR']) if (!finite(a[k]) || !finite(b[k]) || Math.abs(a[k] - b[k]) > 1e-7) return false;
    return Math.abs(ad * (a.laneCenterShiftM || 0) - bd * (b.laneCenterShiftM || 0)) < 1e-7;
}
function convex(poly) {
    if (!Array.isArray(poly) || poly.length < 3 || poly.some(p => !Array.isArray(p) || !finite(p[0]) || !finite(p[1]))) return false;
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length];
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(cross) < 1e-10) continue;
        const next = Math.sign(cross); if (sign && sign !== next) return false; sign = next;
    }
    return sign !== 0;
}

/** Null retains the legacy one-edge admission rule. Unsupported or controlled
 * joins never grant support. At most eight literal shape legs per end are used.
 */
export function ordinarySourceSpan(T, v, { endMarginM = .05, maxHops = 8 } = {}) {
    const e = v.edge, world = T.world, edges = world?.graph?.edges, ribbons = world?.ribbons;
    if (!ordinary(v) || !e || !(e.len > 0) || !finite(e.len) || !Array.isArray(edges) || !edges.includes(e) || !Array.isArray(ribbons) || !source(e) || !legal(e, v.dir) || flatHeight(e) === null) return null;
    if (!(endMarginM >= 0) || !Number.isInteger(maxHops) || maxHops < 1 || maxHops > 8 || !finite(v.length) || !finite(v.width) || !(v.length > 0) || !(v.width > 0) || !finite(v.laneCur) || v.laneCur < 0 || v.laneCur >= lanesDir(e, v.dir)) return null;
    const legs = [{ e, dir: v.dir }], boundaries = [], seen = new Set([e]), need = v.length / 2 + endMarginM;
    const walk = forward => {
        let current = e, dir = v.dir, distance = 0;
        for (let i = 0; i < maxHops && distance < need; i++) {
            const node = forward === (dir > 0) ? current.b : current.a;
            if (controls(node) || !Array.isArray(node.edges) || node.edges.length !== 2 || !node.edges.includes(current)) break;
            const next = node.edges.find(g => g !== current);
            if (!next || seen.has(next) || !edges.includes(next)) break;
            const nd = forward ? (next.a === node ? 1 : next.b === node ? -1 : 0) : (next.b === node ? 1 : next.a === node ? -1 : 0);
            if (!nd || !compatible(e, v.dir, next, nd) || !(next.len > 0)) break;
            seen.add(next); legs.push({ e: next, dir: nd }); distance += next.len; current = next; dir = nd;
        }
        const node = forward === (dir > 0) ? current.b : current.a, inward = forward ? -dir : dir;
        boundaries.push({ x: node.x, z: node.z, fx: current.dirx * inward, fz: current.dirz * inward });
        return distance;
    };
    const behind = walk(false), ahead = walk(true);
    if (!(behind > 0 || ahead > 0)) return null;
    const polygons = [];
    for (const leg of legs) {
        const matches = ribbons.filter(r => r.e === leg.e);
        if (matches.length !== 1 || !convex(matches[0].poly) || matches[0].holes?.length) return null;
        polygons.push(matches[0].poly);
    }
    const half = v.length / 2 + endMarginM;
    return { lo: Math.max(endMarginM, half - behind), hi: Math.min(e.len - endMarginM, e.len - half + ahead), edge: e, dir: v.dir, lane: v.lane, laneCur: v.laneCur, sourceId: source(e), legs, polygons, boundaries, endMarginM, behind, ahead };
}

/** Exact polygon difference checks the entire rectangle, including edges and
 * interior strips. Native subtraction uses its existing 1e-9 numeric clipping
 * precision; it does not alter collision or clearance tolerances.
 */
export function ordinarySourceBodyPlacement(span, body) {
    if (!span || body.edge !== span.edge || body.dir !== span.dir || body.lane !== span.lane || body.laneCur !== span.laneCur || !finite(body.s) || body.s < span.lo - 1e-7 || body.s > span.hi + 1e-7) return { valid: false, reason: 'ordinary-source-shape-span' };
    if (!['x', 'z', 'heading', 'length', 'width'].every(k => finite(body[k])) || !(body.length > 0) || !(body.width > 0)) return { valid: false, reason: 'unknown-ordinary-source-body' };
    const fx = -Math.sin(body.heading), fz = -Math.cos(body.heading), rx = -fz, rz = fx;
    // Translate only the calculation to the body origin, avoiding area
    // cancellation at large map coordinates; source polygons remain untouched.
    const rectangle = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [fx * body.length / 2 * a + rx * body.width / 2 * b, 0, fz * body.length / 2 * a + rz * body.width / 2 * b]);
    if (span.boundaries.some(boundary => rectangle.some(p => (body.x + p[0] - boundary.x) * boundary.fx + (body.z + p[2] - boundary.z) * boundary.fz < span.endMarginM - 1e-7))) return { valid: false, reason: 'ordinary-source-shape-boundary-overhang' };
    let fragments = [rectangle];
    for (const polygon of span.polygons) {
        const local = polygon.map(p => [p[0] - body.x, p[1] - body.z]);
        fragments = fragments.flatMap(fragment => subtractConvexPolygon(fragment, local));
        if (fragments.length > 128) return { valid: false, reason: 'ordinary-source-coverage-work-bound' };
        if (!fragments.length) return { valid: true, sourceId: span.sourceId, edgeIds: span.legs.map(l => l.e.id), support: 'complete-body-native-asphalt-union' };
    }
    return { valid: false, reason: 'whole-ordinary-body-outside-source-shape-corridor', uncoveredFragments: fragments.length };
}
