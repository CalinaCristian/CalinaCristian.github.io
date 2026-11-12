// Source buildings whose footprints overlap. Mapped outlines often draw a podium and the tower standing on it as two
// separate buildings, each with its whole outline from the ground up; drawn as given, the podium's walls and roof run
// through the tower (owner reports 19, 40, "colliding buildings", 2026-11-11). Where a lower building overlaps a taller
// one, the lower one is cut to stop at the taller one's walls: the overlapped part is inside the taller building anyway.
// Footprints are never moved or enlarged, the taller building is untouched, and nothing is invented.

const area = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; a += x1 * z2 - x2 * z1; } return a / 2; };

/** Convex polygon (ring of [x, z]) with consistent orientation, or false. */
export function isConvex(poly) {
    if (poly.length < 3) return false;
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length];
        const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(cr) < 1e-9) continue;
        if (!sign) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
    }
    return sign !== 0;
}

/** Sutherland-Hodgman: subject clipped to the half-plane keep(p) >= 0 (keep affine). */
function clipHalf(subject, keep) {
    const out = [];
    for (let i = 0; i < subject.length; i++) {
        const p = subject[i], q = subject[(i + 1) % subject.length], fp = keep(p), fq = keep(q);
        if (fp >= 0) out.push(p);
        if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
}

/** clipHalf(subject, p => -keep(p)) and clipHalf(subject, keep) in one pass, keep evaluated once per point. Exact: the
 *  negated values give the same tests and t = (−fp) / ((−fp) − (−fq)) = fp / (fp − fq) bit for bit. */
function clipBoth(subject, keep) {
    const n = subject.length, f = new Array(n), neg = [], pos = [];
    for (let i = 0; i < n; i++) f[i] = keep(subject[i]);
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, p = subject[i], q = subject[j], fp = f[i], fq = f[j];
        // outside part: −fp ≥ 0
        const op = -fp, oq = -fq;
        if (op >= 0) neg.push(p);
        if ((op >= 0) !== (oq >= 0)) { const t = op / (op - oq); neg.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
        if (fp >= 0) pos.push(p);
        if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); pos.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return [neg, pos];
}

/** subject minus a convex polygon, as a list of polygons (one per edge of the convex one that the subject crosses).
 *  Piece k is the subject inside the first k-1 edge half-planes and outside the k-th: the pieces do not overlap and
 *  their union is exactly the difference. A non-convex subject is clipped correctly by convex regions (Sutherland-
 *  Hodgman can leave zero-width bridges along a clip edge; they have no area and draw nothing). */
export function subtractConvex(subject, convex) {
    const s = Math.sign(area(convex)) || 1, pieces = [];
    let rest = subject;
    for (let i = 0; i < convex.length && rest.length >= 3; i++) {
        const a = convex[i], b = convex[(i + 1) % convex.length];
        const inside = p => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
        const [outsidePart, insidePart] = clipBoth(rest, inside);
        if (outsidePart.length >= 3 && Math.abs(area(outsidePart)) > 1e-6) pieces.push(outsidePart);
        rest = insidePart;
    }
    return pieces;
}

/** Ear-clipping triangulation of a simple polygon (ring of [x, z]): convex pieces to subtract one by one. */
export function triangulate(poly) {
    const pts = Math.sign(area(poly)) > 0 ? poly.slice() : poly.slice().reverse(), tris = [], idx = pts.map((_, i) => i);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inTri = (p, a, b, c) => cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9;
    let guard = 0;
    while (idx.length > 3 && guard++ < 10000) {
        let clipped = false;
        for (let k = 0; k < idx.length; k++) {
            const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = pts[i0], b = pts[i1], c = pts[i2];
            if (cross(a, b, c) <= 1e-12) continue;
            if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inTri(pts[j], a, b, c))) continue;
            tris.push([a, b, c]); idx.splice(k, 1); clipped = true; break;
        }
        if (!clipped) return null; // degenerate or self-intersecting outline
    }
    if (idx.length === 3) tris.push(idx.map(i => pts[i]));
    return tris;
}

/** subject inside a convex polygon (all its half-planes). */
export function intersectConvex(subject, convex) {
    const s = Math.sign(area(convex)) || 1; let rest = subject;
    for (let i = 0; i < convex.length && rest.length >= 3; i++) { const a = convex[i], b = convex[(i + 1) % convex.length]; rest = clipHalf(rest, p => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))); }
    return rest.length >= 3 && Math.abs(area(rest)) > 1e-6 ? rest : null;
}

const pointIn = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

/** Sampled overlap area of two simple polygons whose bounding boxes are given (m², 0.5 m grid). */
export function overlapArea(a, b, boxA, boxB) {
    const x0 = Math.max(boxA[0], boxB[0]), z0 = Math.max(boxA[1], boxB[1]), x1 = Math.min(boxA[2], boxB[2]), z1 = Math.min(boxA[3], boxB[3]);
    if (x1 - x0 < .5 || z1 - z0 < .5) return 0;
    // Scanline form of counting the samples with pointIn(x, z, a) && pointIn(x, z, b): per sample row z, the crossings are
    // computed with pointIn's own expression and a sample is inside when an odd number of them lie beyond it (x < c),
    // which is pointIn's parity. Same samples (same accumulated coordinates), same count, without testing every edge
    // for every sample.
    const xs = []; for (let x = x0 + .25; x < x1; x += .5) xs.push(x);
    let n = 0;
    for (let z = z0 + .25; z < z1; z += .5) {
        const ca = crossings(a, z), cb = crossings(b, z);
        if (!ca.length || !cb.length) continue;
        let ia = 0, ib = 0;
        for (const x of xs) {
            while (ia < ca.length && !(x < ca[ia])) ia++;
            while (ib < cb.length && !(x < cb[ib])) ib++;
            if ((ca.length - ia) & (cb.length - ib) & 1) n++;
        }
    }
    return n * .25;
}
// x of every edge of poly crossing the row z, as pointIn computes them, ascending
function crossings(poly, z) {
    const out = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z)) out.push((xj - xi) * (z - zi) / (zj - zi) + xi); }
    return out.sort((p, q) => p - q);
}

/**
 * @param recs building records ({ i, ring, holes, h, minH, skip, x0, z0, x1, z1, assembly?, ... })
 * @returns { cuts: [{ lower, taller, overlapM2, pieces }], skipped: [{ lower, taller, reason }] } and, for each cut,
 *          `replace(lower) -> rings` to apply. The caller turns the rings into records.
 */
export function planOverlapCuts(recs, { minOverlapM2 = 2, minPieceM2 = 4, heightMarginM = 1 } = {}) {
    const cell = 32, grid = new Map(), live = recs.filter(b => !b.skip && b.ring?.length >= 3);
    for (const b of live) for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) for (let j = Math.floor(b.z0 / cell); j <= Math.floor(b.z1 / cell); j++) { const k = i + ',' + j; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(b); }
    const cutters = new Map(), skipped = [], seen = new Set();
    for (const lower of live) {
        for (let i = Math.floor(lower.x0 / cell); i <= Math.floor(lower.x1 / cell); i++) for (let j = Math.floor(lower.z0 / cell); j <= Math.floor(lower.z1 / cell); j++) for (const taller of grid.get(i + ',' + j) || []) {
            if (taller === lower) continue;
            const key = lower.i + '|' + taller.i; if (seen.has(key)) continue; seen.add(key);
            // only the lower one is cut; of two of one height (within the margin), the smaller one
            if (!(taller.h > lower.h + heightMarginM) && !(Math.abs(taller.h - lower.h) <= heightMarginM && (taller.area > lower.area || (taller.area === lower.area && taller.i < lower.i)))) continue;
            if (taller.x1 < lower.x0 || taller.x0 > lower.x1 || taller.z1 < lower.z0 || taller.z0 > lower.z1) continue;
            if ((taller.minH || 0) > (lower.minH || 0) + .5) continue;                    // a raised part over a lower one: an overhang, not a collision
            const ov = overlapArea(lower.ring, taller.ring, [lower.x0, lower.z0, lower.x1, lower.z1], [taller.x0, taller.z0, taller.x1, taller.z1]);
            if (ov < minOverlapM2) continue;
            // a member of a prepared assembly keeps its prepared geometry; a building beside one is cut as usual
            // parts of one prepared assembly stack by design (a tower part on its podium): not a collision. A ground-level member
            // running into a taller building outside its assembly (owner L8) is cut like any other building
            if (lower.assembly && (lower.assembly.includes(taller) || (lower.minH || 0) > .5)) { skipped.push({ lower: lower.i, taller: taller.i, reason: lower.assembly.includes(taller) ? 'same-assembly' : 'raised-assembly-member' }); continue; }
            // (owner L8: courtyard buildings were left running through a taller neighbour) a lower courtyard building is cut like
            // any other; its courtyard is then taken out of the pieces again (below), so the courtyard stays open
            if (lower.holes?.length && !lower.holeParts) { const hp = lower.holes.map(h => isConvex(h) ? [h] : triangulate(h)); if (hp.some(c => !c)) { skipped.push({ lower: lower.i, taller: taller.i, reason: 'untriangulable-courtyard-outline' }); continue; } lower.holeParts = hp.flat(); }
            let courtyards = null;
            if (taller.holes?.length) { courtyards = taller.holes.map(h => isConvex(h) ? [h] : triangulate(h)); if (courtyards.some(c => !c)) { skipped.push({ lower: lower.i, taller: taller.i, reason: 'untriangulable-courtyard' }); continue; } courtyards = courtyards.flat(); }
            const parts = isConvex(taller.ring) ? [taller.ring] : triangulate(taller.ring);
            if (!parts) { skipped.push({ lower: lower.i, taller: taller.i, reason: 'untriangulable-taller-outline', overlapM2: ov }); continue; }
            let list = cutters.get(lower); if (!list) cutters.set(lower, list = []); list.push({ taller, ov, parts, courtyards });
        }
    }
    const cuts = [];
    for (const [lower, list] of cutters) {
        let pieces = [lower.ring];
        for (const { parts, courtyards } of list) {
            // what lies in the taller building's courtyards is not inside it: kept, cut out of the solid part only
            const kept = courtyards ? pieces.flatMap(p => courtyards.map(c => intersectConvex(p, c)).filter(Boolean)) : [];
            for (const part of parts) pieces = pieces.flatMap(p => subtractConvex(p, part));
            pieces.push(...kept);
        }
        if (lower.holeParts) for (const hole of lower.holeParts) pieces = pieces.flatMap(p => subtractConvex(p, hole));
        pieces = pieces.filter(p => Math.abs(area(p)) >= minPieceM2);
        cuts.push({ lower, tallers: list.map(q => q.taller), overlapM2: list.reduce((n, q) => n + q.ov, 0), pieces, removedM2: Math.abs(area(lower.ring)) - (lower.holes || []).reduce((n, h) => n + Math.abs(area(h)), 0) - pieces.reduce((n, p) => n + Math.abs(area(p)), 0) });
    }
    return { cuts, skipped };
}
