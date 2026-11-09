// Structural closure below an existing source bridge junction. Original pad
// skins, footprints, heights and source topology are inputs, never rewritten.
const EPS = 1e-8;
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const orientation = p => Math.sign(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0));
export function uncoveredBridgePadBoundary(a, b, mouths) {
    const intervals = [];
    for (const poly of mouths) {
        const sign = orientation(poly); if (!sign) continue;
        let lo = 0, hi = 1;
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], u = sign * cross(p, q, a), v = sign * cross(p, q, b);
            if (u < -EPS && v < -EPS) { hi = -1; break; }
            if ((u < -EPS) !== (v < -EPS)) { const t = u / (u - v); if (u < -EPS) lo = Math.max(lo, t); else hi = Math.min(hi, t); }
        }
        if (hi > lo + EPS) intervals.push([lo, hi]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let t = 0; const result = [];
    for (const [lo, hi] of intervals) { if (lo > t + EPS) result.push([t, lo]); t = Math.max(t, hi); }
    if (t < 1 - EPS) result.push([t, 1]);
    return result;
}
function heightOn(triangles, x, z, maximum) {
    let value = null;
    for (const tri of triangles) {
        const [a, b, c] = tri.map(p => [p[0], p[2]]), den = cross(a, b, c); if (Math.abs(den) < EPS) continue;
        const p = [x, z], u = cross(a, p, c) / den, v = cross(a, b, p) / den;
        // Existing positions are Float32; boundary classification follows their
        // serialized footprint with a numerical tolerance, not a wider slab.
        if (u < -1e-5 || v < -1e-5 || u + v > 1 + 1e-5) continue;
        const y = tri[0][1] + (tri[1][1] - tri[0][1]) * u + (tri[2][1] - tri[0][1]) * v;
        value = value === null ? y : maximum ? Math.max(value, y) : Math.min(value, y);
    }
    return value;
}
const maxSlope = triangles => triangles.reduce((m, [a, b, c]) => {
    const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
    const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    return Math.abs(ny) > EPS ? Math.max(m, Math.hypot(nx, nz) / Math.abs(ny)) : m;
}, 0);
export function bridgeJunctionSlab({ node, poly, topTriangles, edges, mouths, sourceIds, bottomHeightAt }) {
    const fail = reason => ({ known: false, reason, sourceNodeId: node?.sourceId });
    if (!node || !(node.sourceId > 0) || edges.length < 3 || edges.some(e => e.virtual || !e.bridge || e.tunnel || Math.min(e.ya, e.yb) <= .3)) return fail('not-an-elevated-bridge-only-source-fork');
    if (poly.length < 3 || !topTriangles.length || !topTriangles.flat(2).every(Number.isFinite)) return fail('invalid-native-pad-skin');
    const sign = orientation(poly); if (!sign) return fail('degenerate-native-pad-hull');
    // Reuse each existing road/sidewalk skin's exact XY tessellation. A separate
    // fan could cross its graded triangles and create another visible step.
    const underside = topTriangles.map(tri => tri.slice().reverse().map(p => [p[0], bottomHeightAt(p[0], p[2]), p[2]]));
    if (!underside.flat(2).every(Number.isFinite)) return fail('invalid-adjacent-bridge-depth');
    const fascia = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        for (const [lo, hi] of uncoveredBridgePadBoundary(a, b, mouths)) {
            const point = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], A = point(lo), B = point(hi);
            const ya = heightOn(topTriangles, ...A, true), yb = heightOn(topTriangles, ...B, true);
            if (ya === null || yb === null) return fail('native-pad-boundary-not-covered-by-existing-skin');
            fascia.push({ vertices: [[A[0], bottomHeightAt(...A), A[1]], [B[0], bottomHeightAt(...B), B[1]], [B[0], yb, B[1]], [A[0], ya, A[1]]],
                outward: [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])] });
        }
    }
    const x = poly.reduce((s, p) => s + p[0], 0) / poly.length, z = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const lower = underside.flat().map(p => p[1]), upper = topTriangles.flat().map(p => p[1]), topSlope = maxSlope(topTriangles), bottomSlope = maxSlope(underside);
    const deck = { x, z, r: Math.max(...poly.map(p => Math.hypot(p[0] - x, p[1] - z))), poly, holes: [], roadDeck: true, bridgeJunction: true,
        kind: 'source-bridge-junction-slab', sourceNodeId: node.sourceId, sourceIds: [...new Set(sourceIds)], estimated: true, y0: Math.min(...lower), y1: Math.max(...upper), h: Math.max(...upper),
        roofHeightAt: (px, pz, radius = 0) => { const y = heightOn(topTriangles, px, pz, true); return y === null ? null : y + Math.max(0, radius) * topSlope; },
        minHeightAt: (px, pz, radius = 0) => { const y = heightOn(underside, px, pz, false); return y === null ? null : y - Math.max(0, radius) * bottomSlope; },
        topTriangles, bottomTriangles: underside,
        elevationSource: 'Unchanged exact native source-fork pad skins; adjacent bridge fascia depth is an explicit estimate, not surveyed' };
    return { known: true, underside, fascia, deck, sourceNodeId: node.sourceId };
}
