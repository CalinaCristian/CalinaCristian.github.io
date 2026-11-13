// (spec 10 load budget) heightAtWorld is a pure function of its arguments; neighbouring triangles ask it again at the same
// points (shared corners, the samples of a shared edge), mostly moments apart: close to half the questions on a deck.
// Recent answers are kept in a small direct-mapped table (a slot holds the last key that hashed to it), keyed by the
// exact bits of (x, z, y); a generation per call marks the slots of the current function. Only numbers are kept.
const KEY = new Float64Array(3), KEYW = new Uint32Array(KEY.buffer), MEMO_BITS = 14, MEMO_MASK = (1 << MEMO_BITS) - 1;
const memoW = new Uint32Array(6 << MEMO_BITS), memoV = new Float64Array(1 << MEMO_BITS), memoG = new Uint32Array(1 << MEMO_BITS);
let memoGen = 0;
function memoHeights(fn) {
    if (++memoGen > 0xfffffff0) { memoG.fill(0); memoGen = 1; }
    const gen = memoGen;
    return (x, z, y) => {
        KEY[0] = x; KEY[1] = z; KEY[2] = y;
        const w0 = KEYW[0], w1 = KEYW[1], w2 = KEYW[2], w3 = KEYW[3], w4 = KEYW[4], w5 = KEYW[5];
        let h = Math.imul(w0 ^ w1, 0x9e3779b1) ^ Math.imul(w2 ^ w3, 0x85ebca6b) ^ Math.imul(w4 ^ w5, 0xc2b2ae35);
        h ^= h >>> 16; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 15; h &= MEMO_MASK;
        const o = h * 6;
        if (memoG[h] === gen && memoW[o] === w0 && memoW[o + 1] === w1 && memoW[o + 2] === w2 && memoW[o + 3] === w3 && memoW[o + 4] === w4 && memoW[o + 5] === w5) return memoV[h];
        const v = fn(x, z, y);
        if (typeof v === 'number') { memoW[o] = w0; memoW[o + 1] = w1; memoW[o + 2] = w2; memoW[o + 3] = w3; memoW[o + 4] = w4; memoW[o + 5] = w5; memoV[h] = v; memoG[h] = gen; }
        return v;
    };
}
/** Mesh-only adaptive displacement. Keeps source graph vertices/edges and
 * material attributes; records sampled chord error instead of changing grade.
 * (spec 10 load budget) Vertices live in one flat pool (12 numbers: position, normal, uv, colour, tile); the arithmetic is
 * that of the object form it replaced: mix = a + (b − a) · t per number, snap = fround of x and z. */
export function displaceBridgeSurface(mesh, fromVertex, fromIndex, heightAtWorldFn, { maxErrorM=.002, maxDepth=18 }={}) {
    const heightAtWorld = memoHeights(heightAtWorldFn);
    const S = 12, inputs = Math.max(0, Math.floor((mesh.ic - fromIndex + 2) / 3)), V = new Float64Array((inputs * 3 + maxDepth + 2) * S);
    let top = 0;
    // the input corners, snapped (as the root of each triangle snapped them)
    for (let k = fromIndex; k < mesh.ic; k += 3) for (let j = 0; j < 3; j++) {
        const i = mesh.i[k + j], o = top; top += S;
        V[o] = Math.fround(mesh.p[i * 3]); V[o + 1] = mesh.p[i * 3 + 1]; V[o + 2] = Math.fround(mesh.p[i * 3 + 2]);
        V[o + 3] = mesh.n[i * 3]; V[o + 4] = mesh.n[i * 3 + 1]; V[o + 5] = mesh.n[i * 3 + 2]; V[o + 6] = mesh.u[i * 2]; V[o + 7] = mesh.u[i * 2 + 1];
        V[o + 8] = mesh.c[i * 3]; V[o + 9] = mesh.c[i * 3 + 1]; V[o + 10] = mesh.c[i * 3 + 2]; V[o + 11] = mesh.t?.[i] ?? -1;
    }
    mesh.vc=fromVertex;mesh.ic=fromIndex;
    const stats={inputTriangles:inputs,outputTriangles:0,maxLeafControlErrorM:0,depthLimit:0,limitSamples:[],worstControl:null};
    const at = o => heightAtWorld(V[o], V[o + 2], V[o + 1]);
    // height at mix(a, b, t).p, with mix's own arithmetic, without building the whole vertex
    const atMix = (a, b, t) => heightAtWorld(V[a] + (V[b] - V[a]) * t, V[a + 2] + (V[b + 2] - V[a + 2]) * t, V[a + 1] + (V[b + 1] - V[a + 1]) * t);
    const edgeError = (a, b, ha, hb) => { let e = 0; for (const t of [.25, .5, .75]) e = Math.max(e, Math.abs(atMix(a, b, t) - (ha + (hb - ha) * t))); return e; };
    const col = [0, 0, 0];
    const emit = (o, y, n0, n1, n2) => { col[0] = V[o + 8]; col[1] = V[o + 9]; col[2] = V[o + 10]; return mesh.v(V[o], y, V[o + 2], n0, n1, n2, V[o + 6], V[o + 7], col, V[o + 11]); };
    const witness = (depth, error, vs, hs) => ({ depth, errorM: error, vertices: vs.map((o, i) => ({ position: [V[o], V[o + 1], V[o + 2]], heightDisplacement: hs[i], color: [V[o + 8], V[o + 9], V[o + 10]], materialTag: V[o + 11] })) });
    // heightAtWorld is a pure function of its arguments, so values already known for the same arguments are reused: a
    // child keeps two of its parent's (already snapped) corners and the error of the parent edge it shares (same
    // vertices, same direction), and a leaf's displacement is its corner control height (the same snapped x, z, y).
    // Corners q0…q2 are pool offsets, h0…h2 their heights, k0…k2 the known errors of edges q0q1, q1q2, q2q0 (NaN: unknown;
    // an error that is NaN itself is just computed again, the same).
    const recurse = (q0, q1, q2, depth, h0, h1, h2, k0, k1, k2) => {
        // Controls and subsequent child nodes use the actual serialized XY.
        // Longest-edge bisection bounds both horizontal dimensions, including
        // long thin fascia faces; the deeper finite budget is numerical only.
        const Q = [q0, q1, q2], H = [h0, h1, h2], E = [k0, k1, k2];
        let error = 0, longest = -1, split = 0;
        for (let i = 0; i < 3; i++) { const a = Q[i], b = Q[(i + 1) % 3], d = Math.hypot(V[b] - V[a], V[b + 2] - V[a + 2]); if (d > longest) { longest = d; split = i; } }
        const edge = i => { let e = E[i]; if (e !== e) e = E[i] = edgeError(Q[i], Q[(i + 1) % 3], H[i], H[(i + 1) % 3]); return e; };
        const j = (split + 1) % 3, k = (split + 2) % 3, canSplit = depth < maxDepth && longest > 1e-5;
        // The node splits when the largest control error exceeds the tolerance. When it can split, the controls are tested
        // in an order (the edges its children keep first) and the test stops at the first one over the tolerance: the
        // decision is the same, and a split node records nothing; a child recomputes a kept edge's error identically
        // (same vertices, same direction, same heights). A leaf always evaluates every control.
        if (canSplit) { for (const i of [k, j, split]) { error = Math.max(error, edge(i)); if (error > maxErrorM) break; } }
        else for (let i = 0; i < 3; i++) error = Math.max(error, edge(i));
        if (!(canSplit && error > maxErrorM)) error = Math.max(error, Math.abs(heightAtWorld((V[q0] + V[q1] + V[q2]) / 3, (V[q0 + 2] + V[q1 + 2] + V[q2 + 2]) / 3, (V[q0 + 1] + V[q1 + 1] + V[q2 + 1]) / 3) - (h0 + h1 + h2) / 3));
        if (error > maxErrorM && canSplit) {
            const a = Q[split], b = Q[j], m = top; top += S;
            for (let r = 0; r < 11; r++) V[m + r] = V[a + r] + (V[b + r] - V[a + r]) * .5;
            V[m] = Math.fround(V[m]); V[m + 2] = Math.fround(V[m + 2]); V[m + 11] = V[a + 11];
            const hm = at(m);
            // children: [split, m, k] keeps edge k→split (its third edge); [m, j, k] keeps edge j→k (its second edge)
            recurse(a, m, Q[k], depth + 1, H[split], hm, H[k], NaN, NaN, E[k]);
            recurse(m, b, Q[k], depth + 1, hm, H[j], H[k], NaN, E[j], NaN);
            top -= S; return;
        }
        if (error > maxErrorM) { stats.depthLimit++; if (stats.limitSamples.length < 16) stats.limitSamples.push(witness(depth, error, Q, H)); }
        if (error > stats.maxLeafControlErrorM) stats.worstControl = witness(depth, error, Q, H);
        stats.maxLeafControlErrorM = Math.max(stats.maxLeafControlErrorM, error);
        // (the same arithmetic as before, on scalars: P = corner + its displacement, normal = (P1 − P0) × (P2 − P0) / |…|)
        const x0 = V[q0], y0 = V[q0 + 1] + h0, z0 = V[q0 + 2], x1 = V[q1], y1 = V[q1 + 1] + h1, z1 = V[q1 + 2], x2 = V[q2], y2 = V[q2 + 1] + h2, z2 = V[q2 + 2];
        const a0 = x1 - x0, a1 = y1 - y0, a2 = z1 - z0, b0 = x2 - x0, b1 = y2 - y0, b2 = z2 - z0, c0 = a1 * b2 - a2 * b1, c1 = a2 * b0 - a0 * b2, c2 = a0 * b1 - a1 * b0, L = Math.hypot(c0, c1, c2) || 1, n0 = c0 / L, n1 = c1 / L, n2 = c2 / L;
        mesh.tri(emit(q0, y0, n0, n1, n2), emit(q1, y1, n0, n1, n2), emit(q2, y2, n0, n1, n2)); stats.outputTriangles++;
    };
    for (let r = 0; r < inputs; r++) { const q0 = r * 3 * S, q1 = q0 + S, q2 = q1 + S; recurse(q0, q1, q2, 0, at(q0), at(q1), at(q2), NaN, NaN, NaN); }
    return stats;
}
