// Carve an explicitly estimated source tram trench into flat render surfaces.
// Raw source polygons and motor-road surfaces remain unchanged. Convex polygon
// subtraction keeps every exterior fragment and interpolates all attributes.
const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[2] - b[0] * a[2]; }, 0) / 2;

export function subtractTramTrench(polygon, cut) {
    const orientation = Math.sign(cut.reduce((s, a, i) => { const b = cut[(i + 1) % cut.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0));
    if (!orientation) return [polygon];
    const outside = []; let inside = polygon;
    for (let k = 0; k < cut.length && inside.length >= 3; k++) {
        const a = cut[k], b = cut[(k + 1) % cut.length], side = p => orientation * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
        const keep = [], reject = [];
        for (let i = 0; i < inside.length; i++) {
            const p = inside[i], q = inside[(i + 1) % inside.length], dp = side(p), dq = side(q), pin = dp >= -1e-9, qin = dq >= -1e-9;
            (pin ? keep : reject).push(p);
            if (pin !== qin) { const t = dp / (dp - dq), r = p.map((v, j) => v + (q[j] - v) * t); keep.push(r); reject.push(r); }
        }
        if (reject.length >= 3 && Math.abs(area(reject)) > 1e-9) outside.push(reject);
        inside = keep;
    }
    return outside;
}

/** Interior sides between paired source tracks are not compartment walls.
 * Clip only portions covered by another compatible same-model floor. */
export function uncoveredTramTrenchWall(a, b, outward, support, modelId) {
    const A = [a[0] + outward[0] * .015, a[2] + outward[1] * .015], B = [b[0] + outward[0] * .015, b[2] + outward[1] * .015], covered = [];
    for (const p of support.inBox(Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[0], B[0]), Math.max(A[1], B[1]), { modelId })) {
        const orientation = Math.sign(p.poly.reduce((s, q, i) => { const r = p.poly[(i + 1) % p.poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0));
        let lo = 0, hi = 1;
        for (let i = 0; i < p.poly.length; i++) {
            const q = p.poly[i], r = p.poly[(i + 1) % p.poly.length], side = v => orientation * ((r[0] - q[0]) * (v[1] - q[1]) - (r[1] - q[1]) * (v[0] - q[0])), u = side(A), v = side(B);
            if (u < 0 && v < 0) { hi = -1; break; }
            if ((u < 0) !== (v < 0)) { const t = u / (u - v); if (u < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); }
        }
        if (hi <= lo + 1e-8) continue;
        const t = (lo + hi) / 2, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, own = a[1] + (b[1] - a[1]) * t;
        if (Math.abs(p.band(x, z, 0).top - own) < .3) covered.push([lo, hi]);
    }
    covered.sort((a, b) => a[0] - b[0]);
    const result = []; let t = 0;
    for (const [lo, hi] of covered) { if (lo > t + 1e-8) result.push([t, lo]); t = Math.max(t, hi); }
    if (t < 1 - 1e-8) result.push([t, 1]);
    return result;
}

export function buildTramTrenchCutter(support) {
    const cuts = support.pieces.filter(p => !p.roof && Math.min(p.y0, p.y1) < -1e-6).map(p => ({ poly: p.poly, id: p.id,
        x0: Math.min(...p.poly.map(v => v[0])), x1: Math.max(...p.poly.map(v => v[0])), z0: Math.min(...p.poly.map(v => v[1])), z1: Math.max(...p.poly.map(v => v[1])) }));
    const cells = new Map(), size = 16, report = { estimated: true, sourcePieces: cuts.length, inputTriangles: 0, affectedTriangles: 0, outputTriangles: 0,
        basis: 'estimated open source-tram trench; exact convex subtraction from flat render layers only; no source polygon or motor-road edits' };
    for (const cut of cuts) for (let x = Math.floor(cut.x0 / size); x <= Math.floor(cut.x1 / size); x++) for (let z = Math.floor(cut.z0 / size); z <= Math.floor(cut.z1 / size); z++) {
        const key = x + ',' + z; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(cut);
    }
    const cut = mesh => {
        if (!cuts.length || mesh.empty) return mesh;
        let mx0 = Infinity, mx1 = -Infinity, mz0 = Infinity, mz1 = -Infinity;
        for (let i = 0; i < mesh.vc; i++) { mx0 = Math.min(mx0, mesh.p[i * 3]); mx1 = Math.max(mx1, mesh.p[i * 3]); mz0 = Math.min(mz0, mesh.p[i * 3 + 2]); mz1 = Math.max(mz1, mesh.p[i * 3 + 2]); }
        if (!cuts.some(c => c.x1 >= mx0 && c.x0 <= mx1 && c.z1 >= mz0 && c.z0 <= mz1)) return mesh;
        const out = new mesh.constructor(mesh.withTile), original = i => [...mesh.p.subarray(i * 3, i * 3 + 3), ...mesh.n.subarray(i * 3, i * 3 + 3), ...mesh.u.subarray(i * 2, i * 2 + 2), ...mesh.c.subarray(i * 3, i * 3 + 3), mesh.t?.[i] ?? -1];
        const append = poly => { const ids = poly.map(v => out.v(...v.slice(0, 8), v.slice(8, 11), v[11])); for (let i = 1; i < ids.length - 1; i++) out.tri(ids[0], ids[i], ids[i + 1]); };
        for (let i = 0; i < mesh.ic; i += 3) {
            const triangle = [original(mesh.i[i]), original(mesh.i[i + 1]), original(mesh.i[i + 2])]; report.inputTriangles++;
            if (triangle.some(v => v[1] < -.01 || v[1] > .5 || v[4] < .8)) { append(triangle); continue; }
            const x0 = Math.min(...triangle.map(v => v[0])), x1 = Math.max(...triangle.map(v => v[0])), z0 = Math.min(...triangle.map(v => v[2])), z1 = Math.max(...triangle.map(v => v[2])), nearby = new Set();
            for (let x = Math.floor(x0 / size); x <= Math.floor(x1 / size); x++) for (let z = Math.floor(z0 / size); z <= Math.floor(z1 / size); z++) for (const c of cells.get(x + ',' + z) || []) if (c.x1 >= x0 && c.x0 <= x1 && c.z1 >= z0 && c.z0 <= z1) nearby.add(c);
            let fragments = [triangle];
            for (const c of nearby) fragments = fragments.flatMap(p => subtractTramTrench(p, c.poly));
            if (nearby.size && (fragments.length !== 1 || Math.abs(Math.abs(area(fragments[0])) - Math.abs(area(triangle))) > 1e-7)) report.affectedTriangles++;
            for (const p of fragments) append(p);
        }
        report.outputTriangles += out.ic / 3; return out;
    };
    return { cut, report };
}
