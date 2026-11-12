// The guard of a group of elevated carriageways is the outline of their union: a guard line follows each carriageway
// side, and a point of it stands only where no other surface of the group continues there at its level. One rule
// decides every opening (a merge, a gore, a junction mouth), so runs meet at a point instead of ending side by side.
// Pure geometry: no source record, surface or lane is changed here.

/** The parts [t0, t1] of segment a -> b where covered(x, z, t) is false. Sampled every stepM; each run end is then
 *  placed by bisection to refineM, so two guard lines that converge end at the same point. */
export function openRuns(a, b, covered, { stepM = .5, refineM = .02 } = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(L > 1e-6)) return [];
    const n = Math.max(1, Math.ceil(L / stepM)), open = t => !covered(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, t);
    const edge = (inside, outside) => { for (let i = 0; i < 30 && Math.abs(inside - outside) * L > refineM; i++) { const m = (inside + outside) / 2; if (open(m)) inside = m; else outside = m; } return inside; };
    const runs = []; let prevT = 0, prev = open(0), start = prev ? 0 : null;
    for (let i = 1; i <= n; i++) {
        const t = i / n, cur = open(t);
        if (cur && !prev) start = edge(t, prevT); else if (!cur && prev) { runs.push([start, edge(prevT, t)]); start = null; }
        prev = cur; prevT = t;
    }
    if (start !== null) runs.push([start, 1]);
    return runs.filter(r => (r[1] - r[0]) * L > refineM);
}

/** Welds piece ends that nearly meet. pieces: [{ a: [x, z], b: [x, z], ya, yb }] (changed in place). Two ends of
 *  different pieces within reachM of each other, at one height, become one point: where their lines cross when they
 *  turn (a corner), the middle of the gap when they run on from each other. Returns the number of welds. */
export function weldEnds(pieces, { reachM = .6, levelM = .35 } = {}) {
    const ends = [];
    pieces.forEach((p, i) => { ends.push({ p, i, k: 'a' }, { p, i, k: 'b' }); });
    const cell = Math.max(reachM, .25), grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
    for (const e of ends) { const q = e.p[e.k], id = key(q[0], q[1]); if (!grid.has(id)) grid.set(id, []); grid.get(id).push(e); }
    let welds = 0;
    for (const e of ends) {
        if (e.done) continue;
        const q = e.p[e.k], y = e.k === 'a' ? e.p.ya : e.p.yb; let best = null;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const f of grid.get(key(q[0] + dx * cell, q[1] + dz * cell)) || []) {
            if (f === e || f.done || f.i === e.i) continue;
            const r = f.p[f.k], d = Math.hypot(r[0] - q[0], r[1] - q[1]), fy = f.k === 'a' ? f.p.ya : f.p.yb;
            if (d > reachM || Math.abs(fy - y) > levelM || (best && d >= best.d)) continue;
            best = { f, d };
        }
        if (!best) continue;
        const f = best.f, r = f.p[f.k], o1 = e.p[e.k === 'a' ? 'b' : 'a'], o2 = f.p[f.k === 'a' ? 'b' : 'a'];
        const d1 = [q[0] - o1[0], q[1] - o1[1]], d2 = [r[0] - o2[0], r[1] - o2[1]], l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const cross = (d1[0] * d2[1] - d1[1] * d2[0]) / (l1 * l2);
        let m = [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2];
        if (Math.abs(cross) > .05) { // the two lines turn: their crossing point, when it lies at the gap
            const t = ((o2[0] - o1[0]) * d2[1] - (o2[1] - o1[1]) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]), x = [o1[0] + d1[0] * t, o1[1] + d1[1] * t];
            if (Math.hypot(x[0] - q[0], x[1] - q[1]) <= reachM * 1.5 && Math.hypot(x[0] - r[0], x[1] - r[1]) <= reachM * 1.5 && t > .05) m = x;
        }
        e.p[e.k] = m.slice(); f.p[f.k] = m.slice(); e.done = f.done = true; welds++;
    }
    return welds;
}

/** Pieces of stray groups: pieces joined end to end (ends within touchM) form a group, and a group whose pieces add up
 *  to less than minM guards nothing (a two-piece cage at a gore nose, a lone stub). */
export function strayPieces(pieces, { minM = 4, touchM = .05 } = {}) {
    const parent = pieces.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const cell = Math.max(touchM, .25), grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
    pieces.forEach((p, i) => { for (const q of [p.a, p.b]) { const id = key(q[0], q[1]); if (!grid.has(id)) grid.set(id, []); grid.get(id).push([q, i]); } });
    pieces.forEach((p, i) => { for (const q of [p.a, p.b]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const [r, j] of grid.get(key(q[0] + dx * cell, q[1] + dz * cell)) || []) if (j !== i && Math.hypot(r[0] - q[0], r[1] - q[1]) <= touchM) parent[find(i)] = find(j); });
    const total = new Map();
    pieces.forEach((p, i) => { const r = find(i); total.set(r, (total.get(r) || 0) + Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])); });
    return pieces.filter((p, i) => total.get(find(i)) < minM);
}
