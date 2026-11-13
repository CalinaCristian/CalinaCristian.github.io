// Surface displacement for an embankment ramp whose height rule changes at a lateral line: inside the road band
// (|lateral| <= limit) the surface rides with the ramp, outside it stays on the ground.
//
// displaceBridgeSurface() subdivides a triangle until a 2 mm chord error is met. With a rule that jumps at the band's
// edge it can never meet it on a triangle that straddles the line, so every such triangle was bisected to the depth
// limit: a 56 m ramp near Podul Grant put 237,000 millimetre-sized triangles in one ground cell, the Basarab ramp at
// Orhideelor 135,000 in another (measured 2026-11-12, Grozăvești, 1.93 M triangle frames).
//
// Here each triangle is first cut exactly on the two band lines, each side is displaced with its own continuous rule
// (same tolerance), and the jump itself is one vertical face per cut. Same surface, same cliff position, same colours.
import { displaceBridgeSurface } from './bridge-surface-mesh.js';

/**
 * @param mesh        MeshBuilder (p, n, u, c, t, i, vc, ic, v(), tri())
 * @param fromVertex  first vertex of the range to displace
 * @param fromIndex   first index of the range to displace
 * @param band        { ax, az, nx, nz, limit: (side: 1 | -1) => metres, inside: (x, z) => dy, outside: (x, z) => dy }
 *                    lateral = (x - ax) * nx + (z - az) * nz; a point is inside when |lateral| <= limit(sign of lateral)
 * @param audit       optional accumulator with the fields of displaceBridgeSurface's result (world.js keeps one)
 * @returns stats of the two displacement runs + { cutTriangles, stepFaces }
 */
export function displaceBandedSurface(mesh, fromVertex, fromIndex, band, audit = null, context = null, opts = {}) {
    const { ax, az, nx, nz, inside, outside } = band, limR = band.limit(1), limL = band.limit(-1), stepPiece = opts.stepPieceM ?? 1;
    const read = (i) => ({ p: [mesh.p[i * 3], mesh.p[i * 3 + 1], mesh.p[i * 3 + 2]], n: [mesh.n[i * 3], mesh.n[i * 3 + 1], mesh.n[i * 3 + 2]], u: [mesh.u[i * 2], mesh.u[i * 2 + 1]], c: [mesh.c[i * 3], mesh.c[i * 3 + 1], mesh.c[i * 3 + 2]], t: mesh.t?.[i] ?? -1 });
    const rows = []; for (let k = fromIndex; k < mesh.ic; k += 3) rows.push([read(mesh.i[k]), read(mesh.i[k + 1]), read(mesh.i[k + 2])]);
    mesh.vc = fromVertex; mesh.ic = fromIndex;
    const mix = (a, b, t) => ({ p: a.p.map((v, k) => v + (b.p[k] - v) * t), n: a.n.map((v, k) => v + (b.n[k] - v) * t), u: a.u.map((v, k) => v + (b.u[k] - v) * t), c: a.c.map((v, k) => v + (b.c[k] - v) * t), t: a.t });
    const lat = (v) => (v.p[0] - ax) * nx + (v.p[2] - az) * nz;
    // cut a convex polygon on dist = 0: [part with dist <= 0, part with dist > 0, the two points on the line (or null)]
    const cut = (poly, dist) => {
        const d = poly.map(dist); if (d.every(x => x <= 0)) return [poly, null, null]; if (d.every(x => x > 0)) return [null, poly, null];
        const neg = [], pos = [], on = [];
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], da = d[i], db = d[(i + 1) % poly.length];
            (da <= 0 ? neg : pos).push(a);
            if ((da <= 0) !== (db <= 0)) { const m = mix(a, b, da / (da - db)); neg.push(m); pos.push(m); on.push(m); }
        }
        return [neg.length >= 3 ? neg : null, pos.length >= 3 ? pos : null, on.length === 2 ? on : null];
    };
    const inner = [], outer = [], steps = []; let cutTriangles = 0;
    for (const tri of rows) {
        const [restR, outR, onR] = cut(tri, v => lat(v) - limR);
        if (outR) outer.push(outR); if (onR) steps.push([onR, 1]);
        if (!restR) { if (onR) cutTriangles++; continue; }
        const [in2, outL, onL] = cut(restR, v => -lat(v) - limL);
        if (outL) outer.push(outL); if (onL) steps.push([onL, -1]);
        if (in2) inner.push(in2);
        if (onR || onL) cutTriangles++;
    }
    const area2 = (a, b, c) => Math.hypot((b.p[1] - a.p[1]) * (c.p[2] - a.p[2]) - (b.p[2] - a.p[2]) * (c.p[1] - a.p[1]), (b.p[2] - a.p[2]) * (c.p[0] - a.p[0]) - (b.p[0] - a.p[0]) * (c.p[2] - a.p[2]), (b.p[0] - a.p[0]) * (c.p[1] - a.p[1]) - (b.p[1] - a.p[1]) * (c.p[0] - a.p[0]));
    const put = (v) => mesh.v(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], v.u[0], v.u[1], v.c, v.t);
    const emit = (polys, fn) => {
        const v0 = mesh.vc, i0 = mesh.ic;
        for (const poly of polys) for (let k = 1; k + 1 < poly.length; k++) { if (area2(poly[0], poly[k], poly[k + 1]) < 1e-9) continue; mesh.tri(put(poly[0]), put(poly[k]), put(poly[k + 1])); }
        return displaceBridgeSurface(mesh, v0, i0, fn, opts);
    };
    const total = { inputTriangles: rows.length, outputTriangles: 0, maxLeafControlErrorM: 0, depthLimit: 0, limitSamples: [], worstControl: null, cutTriangles, stepFaces: 0 };
    for (const a of [emit(inner, (x, z) => inside(x, z)), emit(outer, (x, z) => outside(x, z))]) {
        total.outputTriangles += a.outputTriangles; total.depthLimit += a.depthLimit;
        if (a.maxLeafControlErrorM > total.maxLeafControlErrorM) { total.maxLeafControlErrorM = a.maxLeafControlErrorM; total.worstControl = a.worstControl; }
        for (const s of a.limitSamples) if (total.limitSamples.length < 16) total.limitSamples.push(s);
    }
    // the jump on each cut: a vertical face from the inside height down to the outside height, facing away from the road
    for (const [[P, Q], side] of steps) {
        const L = Math.hypot(Q.p[0] - P.p[0], Q.p[2] - P.p[2]); if (L < 1e-6) continue;
        const n = Math.max(1, Math.ceil(L / stepPiece)), ox = nx * side, oz = nz * side;
        let a = P, ta = P.p[1] + inside(P.p[0], P.p[2]), ba = P.p[1] + outside(P.p[0], P.p[2]);
        for (let j = 1; j <= n; j++) {
            const b = j === n ? Q : mix(P, Q, j / n), tb = b.p[1] + inside(b.p[0], b.p[2]), bb = b.p[1] + outside(b.p[0], b.p[2]);
            if (ta - ba > 1e-3 || tb - bb > 1e-3) {
                // (b − a) × down points to one side of the cut: wind the face so that it looks away from the road
                const front = -(b.p[2] - a.p[2]) * ox + (b.p[0] - a.p[0]) * oz > 0;
                const w = (v, y) => mesh.v(v.p[0], y, v.p[2], ox, 0, oz, v.u[0], v.u[1], v.c, v.t);
                const A = w(a, ta), B = w(b, tb), C = w(b, bb), D = w(a, ba);
                if (front) { mesh.tri(A, C, B); mesh.tri(A, D, C); } else { mesh.tri(A, B, C); mesh.tri(A, C, D); }
                total.outputTriangles += 2; total.stepFaces += 2;
            }
            a = b; ta = tb; ba = bb;
        }
    }
    if (audit) {
        audit.inputTriangles += total.inputTriangles; audit.outputTriangles += total.outputTriangles; audit.depthLimit += total.depthLimit;
        if (total.maxLeafControlErrorM > audit.maxLeafControlErrorM) { audit.worstControl = { ...total.worstControl, ...context }; audit.maxLeafControlErrorM = total.maxLeafControlErrorM; }
        for (const s of total.limitSamples) if (audit.limitSamples.length < 32) audit.limitSamples.push({ ...s, ...context });
    }
    return total;
}
