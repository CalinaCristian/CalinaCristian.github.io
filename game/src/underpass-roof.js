// Estimated structural closure of an already covered, literal tunnel road.
// Source road profiles, legal restrictions and XY are inputs, never rewritten.
const EPS = 1e-9;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = t => Math.max(0, Math.min(1, t));
const number = value => typeof value === 'string' && /^\d+(?:\.\d+)?(?:\s*m)?$/.test(value.trim()) ? parseFloat(value) : Number.isFinite(value) ? value : null;

export const UNDERPASS_COVER_POLICY = Object.freeze({
    colorWrite: false, depthWrite: true, depthTest: true, transparent: false,
    // Land/water color is already drawn. The physical roof blocks subsequent
    // actors without replacing an existing lawn/paving with inferred concrete.
    renderOrder: -17.9, castShadow: false,
});

export function underpassRoofModel(edge, { sourceTags = {}, surfaceM = .24, topM = .06,
    minThicknessM = .25, clearanceM = 5.2, coveredThresholdM = -4.2 } = {}) {
    const fail = reason => ({ known: false, reason, edgeId: edge?.id, sourceTags });
    if (!edge?.tunnel || edge.virtual || edge.bridge || edge.coveredRoadModel) return fail('not-an-unmodeled-source-tunnel');
    if (![edge.ya, edge.yb, surfaceM, topM, minThicknessM, clearanceM, coveredThresholdM].every(Number.isFinite) || minThicknessM <= 0 || clearanceM <= 0) return fail('invalid-structural-input');
    let lo = 0, hi = 1;
    if (!edge.lidded) {
        if (Math.min(edge.ya, edge.yb) >= coveredThresholdM) return fail('open-ramp');
        const crossing = clamp((coveredThresholdM - edge.ya) / (edge.yb - edge.ya));
        if (edge.ya < edge.yb) hi = crossing; else lo = crossing;
    }
    const legalMaxheightM = number(sourceTags.maxheight), physicalMaxheightM = number(sourceTags['maxheight:physical']);
    if (sourceTags['maxheight:physical'] !== undefined && physicalMaxheightM === null) return fail('unresolved-literal-physical-opening');
    const openingM = physicalMaxheightM > 0 ? physicalMaxheightM : clearanceM;
    const floorAt = t => surfaceM + mix(edge.ya, edge.yb, t);
    const ceilingAt = t => Math.min(floorAt(t) + openingM, topM - minThicknessM);
    const stations = [lo, hi];
    if (edge.ya !== edge.yb) {
        const crossing = (topM - minThicknessM - surfaceM - openingM - edge.ya) / (edge.yb - edge.ya);
        if (crossing > lo + EPS && crossing < hi - EPS) stations.splice(1, 0, crossing);
    }
    const minClearanceM = Math.min(...stations.map(t => ceilingAt(t) - floorAt(t)));
    // A legal restriction is not a measured ceiling. It constrains this
    // estimated structure; it never becomes an instruction to lift the roof.
    const requiredM = Math.max(legalMaxheightM || 0, physicalMaxheightM || 0);
    if (minClearanceM < requiredM - EPS) return fail('modeled-opening-below-literal-height');
    if (minClearanceM <= 0 || hi - lo <= EPS) return fail('no-positive-covered-opening');
    return { known: true, edgeId: edge.id, sourceTags, estimated: true,
        basis: physicalMaxheightM > 0 ? 'literal maxheight:physical opening; positive estimated .25m minimum roof slab below native retained overhead skins' : 'MODEL existing covered-road span; 5.2m maximum opening and positive .25m minimum roof slab below native retained overhead skins, not surveyed',
        topM, minThicknessM, clearanceM, legalMaxheightM, physicalMaxheightM,
        legalHeightMapped: legalMaxheightM !== null, minClearanceM, span: [lo, hi], stations, floorAt, ceilingAt };
}

// pointAt receives the exact native mitred section, including at a portal.
// The portal beam and ceiling therefore share identical Float32 boundaries.
export function underpassRoofFaces(model, { pointAt, rightM, leftM, outerM = .3,
    portals = [true, true] }) {
    if (!model?.known || typeof pointAt !== 'function' || ![rightM, leftM, outerM].every(Number.isFinite) || rightM <= 0 || leftM <= 0 || outerM < 0) return { known: false, reason: 'invalid-native-roof-section' };
    const bottom = [], top = [], fascia = [], sections = [];
    const R = rightM + outerM, L = -leftM - outerM;
    for (const t of model.stations) sections.push({ t, right: pointAt(t, R, model.ceilingAt(t)), left: pointAt(t, L, model.ceilingAt(t)) });
    if (!sections.flatMap(s => [...s.right, ...s.left]).every(Number.isFinite)) return { known: false, reason: 'invalid-native-roof-points' };
    for (let i = 1; i < model.stations.length; i++) {
        const a = model.stations[i - 1], b = model.stations[i], ca = model.ceilingAt(a), cb = model.ceilingAt(b), p = (t, o, y) => pointAt(t, o, y);
        bottom.push([p(a, R, ca), p(b, R, cb), p(b, L, cb), p(a, L, ca)]);
        top.push([p(a, R, model.topM), p(b, R, model.topM), p(b, L, model.topM), p(a, L, model.topM)]);
        for (const o of [R, L]) {
            const opposite = o === R ? L : R, mid = (a + b) / 2, q = p(mid, o, 0), r = p(mid, opposite, 0);
            fascia.push({ vertices: [p(a, o, ca), p(b, o, cb), p(b, o, model.topM), p(a, o, model.topM)], out: [q[0] - r[0], 0, q[2] - r[2]] });
        }
    }
    for (let end = 0; end < 2; end++) {
        if (!portals[end]) continue;
        const t = model.span[end], y = model.ceilingAt(t);
        const q = pointAt(t, 0, 0), r = pointAt(model.span[1 - end], 0, 0);
        fascia.push({ vertices: [pointAt(t, R, y), pointAt(t, L, y), pointAt(t, L, model.topM), pointAt(t, R, model.topM)], out: [q[0] - r[0], 0, q[2] - r[2]] });
    }
    const outline = [top[0][0], top.at(-1)[1], top.at(-1)[2], top[0][3]], signs = [];
    for (let k = 0; k < 4; k++) {
        const a = outline[k], b = outline[(k + 1) % 4], c = outline[(k + 2) % 4];
        const cross = (b[0] - a[0]) * (c[2] - b[2]) - (b[2] - a[2]) * (c[0] - b[0]);
        if (Math.abs(cross) > EPS) signs.push(Math.sign(cross));
    }
    if (!signs.length || signs.some(s => s !== signs[0])) return { known: false, reason: 'invalid-native-roof-footprint' };
    if (![...bottom.flat(2), ...top.flat(2), ...fascia.flatMap(f => [...f.vertices.flat(), ...f.out])].every(Number.isFinite)) return { known: false, reason: 'invalid-native-roof-points' };
    return { known: true, bottom, top, fascia, sections, outerRightM: R, outerLeftM: -L };
}

// Independently useful vertical band for an actual roof collider, not a tall
// full-height building box. Querying beyond the source span returns unknown.
function underpassRoofBand(model, edge, x, z, radiusM = 0) {
    if (!model?.known || ![x, z, radiusM, edge?.len].every(Number.isFinite) || edge.len <= 0) return null;
    const s = (x - edge.a.x) * edge.dirx + (z - edge.a.z) * edge.dirz;
    const t = s / edge.len;
    if (t < model.span[0] - EPS || t > model.span[1] + EPS) return null;
    const lo = Math.max(model.span[0], t - Math.max(0, radiusM) / edge.len), hi = Math.min(model.span[1], t + Math.max(0, radiusM) / edge.len);
    return { bottom: Math.min(model.ceilingAt(lo), model.ceilingAt(hi)), top: model.topM };
}

export function underpassRoofCollider(model, faces, sourceId) {
    if (!model?.known || !faces?.known || !sourceId) return null;
    // MeshBuilder emits these same positions as Float32 and face4 uses this
    // diagonal. Collision follows those actual planes, including cap kinks.
    const triangles = quads => quads.flatMap(q => [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]).map(t => t.map(p => p.map(Math.fround)));
    const bottomTriangles = triangles(faces.bottom), topTriangles = triangles(faces.top);
    const first = faces.top[0], last = faces.top.at(-1), poly = [first[0], last[1], last[2], first[3]].map(p => [Math.fround(p[0]), Math.fround(p[2])]);
    const cx = poly.reduce((s, p) => s + p[0], 0) / 4, cz = poly.reduce((s, p) => s + p[1], 0) / 4;
    const plane = (tri, x, z) => {
        const [a, b, c] = tri, bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2], d = bx * cz - bz * cx;
        if (Math.abs(d) < EPS) return null;
        const u = ((x - a[0]) * cz - (z - a[2]) * cx) / d, v = (bx * (z - a[2]) - bz * (x - a[0])) / d;
        if (u < -EPS || v < -EPS || u + v > 1 + EPS) return null;
        return a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v;
    };
    const maxSlope = bottomTriangles.reduce((s, [a, b, c]) => {
        const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
        const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
        return Math.abs(ny) > EPS ? Math.max(s, Math.hypot(nx, nz) / Math.abs(ny)) : s;
    }, 0);
    const height = (ts, x, z, maximum) => {
        const ys = ts.map(t => plane(t, x, z)).filter(y => y !== null);
        return ys.length ? (maximum ? Math.max(...ys) : Math.min(...ys)) : null;
    };
    return { x: cx, z: cz, r: Math.max(...poly.map(p => Math.hypot(p[0] - cx, p[1] - cz))), poly, holes: [], roadDeck: true,
        kind: 'source-underpass-roof', sourceId, sourceEdgeId: model.edgeId, estimated: true,
        legalMaxheightM: model.legalMaxheightM, minClearanceM: model.minClearanceM,
        y0: Math.min(...bottomTriangles.flat().map(p => p[1])), y1: Math.fround(model.topM), h: Math.fround(model.topM),
        roofHeightAt: (x, z) => height(topTriangles, x, z, true),
        minHeightAt: (x, z, radiusM = 0) => { const y = height(bottomTriangles, x, z, false); return y === null ? null : y - Math.max(0, radiusM) * maxSlope; },
        topTriangles, bottomTriangles, elevationSource: model.basis };
}
