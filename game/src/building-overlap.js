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

/** clipHalf(subject, p => -keep(p)) and clipHalf(subject, keep) in one pass, from f[i] = keep(subject[i]). Exact: the
 *  negated values give the same tests and t = (−fp) / ((−fp) − (−fq)) = fp / (fp − fq) bit for bit. */
function clipSides(subject, f) {
    const n = subject.length, neg = [], pos = [];
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
let sides = new Float64Array(64); // (scratch: the side of each point of the part being clipped)
export function subtractConvex(subject, convex, s = Math.sign(area(convex)) || 1) {
    const pieces = [];
    let rest = subject;
    for (let i = 0; i < convex.length && rest.length >= 3; i++) {
        const a = convex[i], b = convex[(i + 1) % convex.length], n = rest.length;
        // the side of every point; a rest wholly on one side is clipSides' answer without its copies (spec 10 load time):
        // all outside → the whole rest is the outside piece (the same points, in order); all inside → the rest goes on
        if (sides.length < n) sides = new Float64Array(2 * n);
        const f = sides; let below = 0, above = 0;
        for (let k = 0; k < n; k++) { const p = rest[k], v = s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])); f[k] = v; if (v < 0) below++; else if (v > 0) above++; }
        if (below === n) { const outsidePart = rest.slice(); if (Math.abs(area(outsidePart)) > 1e-6) pieces.push(outsidePart); rest = []; break; }
        if (above === n) continue;
        const [outsidePart, insidePart] = clipSides(rest, f);
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
export function planOverlapCuts(recs, opts = {}) {
    const live = recs.filter(b => !b.skip && b.ring?.length >= 3);
    const { cutters, skipped } = overlapCandidates(live, 0, live.length, opts);
    return { cuts: overlapPieces(cutters, opts), skipped };
}
/** the lower buildings live[from…to) with the taller ones they run into (any of live), in order; sets lower.holeParts.
 *  Each lower is independent of the others, so ranges can be planned apart and joined in order (build workers). */
export function overlapGrid(live) {
    const cell = 32, grid = new Map();
    for (const b of live) for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) for (let j = Math.floor(b.z0 / cell); j <= Math.floor(b.z1 / cell); j++) { const k = i + ',' + j; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(b); }
    return grid;
}
export function overlapCandidates(live, from, to, { minOverlapM2 = 2, heightMarginM = 1 } = {}, grid = overlapGrid(live)) {
    const cell = 32, cutters = new Map(), skipped = [], seen = new Set();
    for (let n = from; n < to; n++) {
        const lower = live[n];
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
    return { cutters, skipped };
}
/** pieces.flatMap(p => subtractConvex(p, convex)), the convex's orientation found once */
function subtractAll(pieces, convex) {
    const sign = Math.sign(area(convex)) || 1, out = [];
    for (const p of pieces) for (const q of subtractConvex(p, convex, sign)) out.push(q);
    return out;
}
export function overlapPieces(cutters, { minPieceM2 = 4 } = {}) {
    const cuts = [];
    for (const [lower, list] of cutters) {
        let pieces = [lower.ring];
        for (const { parts, courtyards } of list) {
            // what lies in the taller building's courtyards is not inside it: kept, cut out of the solid part only
            const kept = courtyards ? pieces.flatMap(p => courtyards.map(c => intersectConvex(p, c)).filter(Boolean)) : [];
            for (const part of parts) pieces = subtractAll(pieces, part);
            pieces.push(...kept);
        }
        if (lower.holeParts) for (const hole of lower.holeParts) pieces = subtractAll(pieces, hole);
        pieces = pieces.filter(p => Math.abs(area(p)) >= minPieceM2);
        cuts.push({ lower, tallers: list.map(q => q.taller), overlapM2: list.reduce((n, q) => n + q.ov, 0), pieces, removedM2: Math.abs(area(lower.ring)) - (lower.holes || []).reduce((n, h) => n + Math.abs(area(h)), 0) - pieces.reduce((n, p) => n + Math.abs(area(p)), 0) });
    }
    return cuts;
}

// ---------------------------------------------------------------- build workers (spec 10 load budget)
const ringOk = r => Array.isArray(r) && r.every(p => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number');
const numOrNone = v => v === undefined || typeof v === 'number';
/** live records as transferable arrays, or null when a record has a shape the flat form does not keep exactly */
export function packOverlapRecords(live) {
    const ids = new Set(), index = new Map(live.map((b, k) => [b, k]));
    let points = 0, holes = 0;
    for (const b of live) {
        if (!Number.isInteger(b.i) || ids.has(b.i) || b.holeParts || typeof b.area !== 'number' || !['h', 'minH', 'x0', 'z0', 'x1', 'z1'].every(k => numOrNone(b[k])) || !ringOk(b.ring) || !(b.holes === undefined || (Array.isArray(b.holes) && b.holes.every(ringOk))) || (b.assembly && !Array.isArray(b.assembly))) return null;
        ids.add(b.i); points += b.ring.length; for (const h of b.holes || []) { points += h.length; holes++; }
    }
    const nums = new Float64Array(live.length * 8), coords = new Float64Array(points * 2), meta = [];
    let c = 0;
    const put = r => { meta.push(r.length); for (const p of r) { coords[c++] = p[0]; coords[c++] = p[1]; } };
    live.forEach((b, k) => {
        nums.set([b.i, b.h ?? NaN, b.minH ?? NaN, b.area, b.x0 ?? NaN, b.z0 ?? NaN, b.x1 ?? NaN, b.z1 ?? NaN], k * 8);
        // per record: ring, hole count (−1: holes undefined), holes, assembly member count (−1: none), members (−1: not live)
        put(b.ring); meta.push(b.holes === undefined ? -1 : b.holes.length); for (const h of b.holes || []) put(h);
        meta.push(b.assembly ? b.assembly.length : -1); for (const m of b.assembly || []) meta.push(index.has(m) ? index.get(m) : -1);
    });
    return { nums, coords, meta: Int32Array.from(meta) };
}
export function unpackOverlapRecords({ nums, coords, meta }) {
    const live = []; let c = 0, m = 0;
    const take = () => { const n = meta[m++], r = []; for (let q = 0; q < n; q++) { r.push([coords[c], coords[c + 1]]); c += 2; } return r; };
    const members = [];
    for (let k = 0; k < nums.length / 8; k++) {
        const o = k * 8, b = { i: nums[o], ring: null, holes: undefined, h: nums[o + 1], minH: nums[o + 2], area: nums[o + 3], x0: nums[o + 4], z0: nums[o + 5], x1: nums[o + 6], z1: nums[o + 7] };
        b.ring = take(); const nh = meta[m++]; if (nh >= 0) { b.holes = []; for (let q = 0; q < nh; q++) b.holes.push(take()); }
        const na = meta[m++]; members.push(na < 0 ? null : Array.from(meta.subarray(m, m + na))); if (na > 0) m += na;
        live.push(b);
    }
    // a member outside the live list only has to differ from every live record
    live.forEach((b, k) => { if (members[k]) b.assembly = members[k].map(j => (j >= 0 ? live[j] : {})); });
    return live;
}

/** planOverlapCuts with ranges of lower buildings planned in the build workers and joined in order. Pieces keep their
 *  references to the lower building's own ring points, as the subtraction leaves them. Without the pool, for a record
 *  shape the flat form does not keep, or on a worker failure: planOverlapCuts here. */
export async function planOverlapCutsParallel(recs, pool, opts = {}) {
    const live = recs.filter(b => !b.skip && b.ring?.length >= 3), packed = pool && live.length > 1 ? packOverlapRecords(live) : null;
    if (!packed) return planOverlapCuts(recs, opts);
    pool.overlapRecords(packed);
    // the workers plan the first ranges; the last share is planned here meanwhile (on the records themselves, as
    // planOverlapCuts does), and joined last, so the order is the same
    const mainFrom = live.length - Math.floor(live.length / 2); // (the workers first unpack every record: this thread takes half)
    const step = Math.ceil(mainFrom / (pool.size * 4)), jobs = [];
    for (let a = 0; a < mainFrom; a += step) jobs.push(pool.overlap(a, Math.min(mainFrom, a + step), opts));
    let here = null;
    if (mainFrom < live.length) { const { cutters, skipped } = overlapCandidates(live, mainFrom, live.length, opts); here = { cuts: overlapPieces(cutters, opts), skipped }; }
    let results;
    try { results = await Promise.all(jobs); } catch (e) { console.warn('[overlap cuts] worker failed, planning here', e); for (let k = mainFrom; k < live.length; k++) delete live[k].holeParts; return planOverlapCuts(recs, opts); }
    const cuts = [], skipped = [];
    for (const r of results) {
        for (const [k, hp] of r.holeParts) live[k].holeParts = hp;
        skipped.push(...r.skipped);
        for (const c of r.cuts) {
            // points that are the lower ring's own become its original point objects; computed points become fresh arrays
            // (one per cloned object, so shared points stay shared): arrays made by structured clone are read through
            // slower paths by everything that later tests these rings (collision, the crowd)
            const L = live[c.lower], same = new Map(c.lowerRing.map((p, q) => [p, L.ring[q]]));
            const point = p => { let q = same.get(p); if (!q) same.set(p, q = [p[0], p[1]]); return q; };
            const pieces = c.pieces.map(piece => (piece === c.lowerRing ? L.ring : piece.map(point)));
            cuts.push({ lower: L, tallers: c.tallers.map(t => live[t]), overlapM2: c.overlapM2, pieces, removedM2: c.removedM2 });
        }
    }
    if (here) { skipped.push(...here.skipped); cuts.push(...here.cuts); }
    return { cuts, skipped };
}
