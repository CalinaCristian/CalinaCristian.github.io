// Source rails constrain inferred roadside additions, never lane pavement or
// mapped dimensions. The same footprint/height policy serves meshes and queries.
const EPS = 1e-9;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const valid = p => {
    if (p.length < 3) return false;
    let x = 0, y = 0, z = 0;
    for (let i = 1; i + 1 < p.length; i++) {
        const a = p[i].map((v, k) => v - p[0][k]), b = p[i + 1].map((v, k) => v - p[0][k]);
        x += a[1] * b[2] - a[2] * b[1]; y += a[2] * b[0] - a[0] * b[2]; z += a[0] * b[1] - a[1] * b[0];
    }
    return Math.hypot(x, y, z) > EPS;
};
function split(poly, plane) {
    const inside = [], outside = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = plane(a), db = plane(b), ia = da >= -EPS, ib = db >= -EPS;
        (ia ? inside : outside).push(a);
        if (ia !== ib) { const p = mix(a, b, da / (da - db)); inside.push(p); outside.push(p); }
    }
    return { inside: valid(inside) ? inside : [], outside: valid(outside) ? outside : [] };
}
function planes(poly) {
    const sign = Math.sign(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - p[1] * q[0]; }, 0));
    return poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; return p => sign * ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])); });
}
function partition(poly, ps) {
    let inside = poly; const outside = [];
    for (const p of ps) { if (!inside.length) break; const s = split(inside, p); if (s.outside.length) outside.push(s.outside); inside = s.inside; }
    return { inside, outside };
}
const contains = (poly, x, z) => planes(poly).every(p => p([x, 0, z]) >= -EPS);
const box = poly => ({ x0: Math.min(...poly.map(p => p[0])), x1: Math.max(...poly.map(p => p[0])), z0: Math.min(...poly.map(p => p[1])), z1: Math.max(...poly.map(p => p[1])) });
const overlaps = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;
const profile = (e, x, z) => { const t = Math.max(0, Math.min(1, ((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len)); return e.ya + (e.yb - e.ya) * t; };

export function buildRailRoadsideClearance(grades, envelope) {
    const cuts = [], cells = new Map(), size = 24, states = new WeakMap();
    const report = { estimated: true, sourceCorridors: 0, changedTriangles: 0, loweredTriangles: 0, trimmedTriangles: 0, capTriangles: 0, edges: [], retainedMappedCandidates: [], unresolved: [], maxSerializationOutsetM: 0,
        basis: 'Literal rendered ground rail and actual emitted fleet envelope; inferred additions outside unchanged mitred lane pavement only; no width/profile/source edits' };
    if (envelope) for (const c of grades.corridors) {
        if (c.groundLevel !== true) continue;
        const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], len = Math.hypot(dx, dz); if (!(len > 0)) continue;
        const literalWidth = Math.max(c.gaugeM / 2, envelope.halfWidthM);
        // Mesh positions are serialized as Float32. Round the inferred cut
        // outward by its calculable XZ rounding bound, never a physical margin.
        const magnitude = Math.max(1, ...c.a.map(Math.abs), ...c.b.map(Math.abs)) + literalWidth;
        const ulp = 2 ** (Math.floor(Math.log2(magnitude)) - 23), serializationOutsetM = Math.SQRT2 * ulp / 2 + 2 ** (Math.floor(Math.log2(literalWidth)) - 23);
        const w = literalWidth + serializationOutsetM, nx = -dz / len * w, nz = dx / len * w;
        const poly = [[c.a[0] + nx, c.a[1] + nz], [c.b[0] + nx, c.b[1] + nz], [c.b[0] - nx, c.b[1] - nz], [c.a[0] - nx, c.a[1] - nz]];
        const cut = { poly, planes: planes(poly), ...box(poly), sourceId: c.sourceId, sourceNodeIds: c.sourceNodeIds, literalHalfWidthM: literalWidth, serializationOutsetM, lower: .24 + envelope.minY, upper: .24 + envelope.maxY };
        cuts.push(cut); report.maxSerializationOutsetM = Math.max(report.maxSerializationOutsetM, serializationOutsetM);
        for (let x = Math.floor(cut.x0 / size); x <= Math.floor(cut.x1 / size); x++) for (let z = Math.floor(cut.z0 / size); z <= Math.floor(cut.z1 / size); z++) {
            const k = x + ',' + z; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(cut);
        }
    }
    report.sourceCorridors = cuts.length;
    const nearby = b => { const found = new Set(); for (let x = Math.floor(b.x0 / size); x <= Math.floor(b.x1 / size); x++) for (let z = Math.floor(b.z0 / size); z <= Math.floor(b.z1 / size); z++) for (const c of cells.get(x + ',' + z) || []) if (overlaps(c, b)) found.add(c); return [...found]; };
    const register = (e, lanePoly, outerPoly) => {
        const nearbyCuts = nearby(box(outerPoly));
        const protectedDimension = !!e.roadWidthSource || !!e.sidewalkSource?.explicit;
        const crossSigns = lanePoly.map((p, i) => { const q = lanePoly[(i + 1) % lanePoly.length], r = lanePoly[(i + 2) % lanePoly.length]; return Math.sign((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])); }).filter(Boolean);
        const convex = crossSigns.length >= 3 && crossSigns.every(s => s === crossSigns[0]);
        const mode = convex && !protectedDimension && !e.tunnel && (e.bridge && Math.max(e.ya, e.yb) > .01 ? 'trim' : !e.bridge && Math.max(Math.abs(e.ya), Math.abs(e.yb)) < 1e-8 ? 'flush' : null);
        const s = { e, lanePoly, lanePlanes: planes(lanePoly), cuts: nearbyCuts, mode, changed: false };
        states.set(e, s);
        if (protectedDimension && nearbyCuts.length) report.retainedMappedCandidates.push({ edgeId: e.id, sourceId: e.access?.sourceId, reason: 'nearby mapped/reviewed roadside dimension retained; automatic adjustment forbidden', screen: 'source corridor bounding box only; no physical conflict conclusion' });
        if (!convex && nearbyCuts.length) report.unresolved.push({ edgeId: e.id, reason: 'non-convex protected lane footprint retained unchanged' });
        return s;
    };
    const fragments = (triangle, e, forceMode = null, record = false) => {
        const s = states.get(e), mode = forceMode || s?.mode;
        if (!s || !mode || !s.cuts.length) return [triangle];
        const p = partition(triangle, s.lanePlanes); let outside = p.outside, changed = false;
        for (const c of s.cuts) {
            const next = [];
            for (const f of outside) {
                if (Math.max(...f.map(p => p[1])) < c.lower || Math.min(...f.map(p => p[1])) > c.upper) { next.push(f); continue; }
                const q = partition(f, mode === 'flush' ? c.planes : [...c.planes, p => p[1] - c.lower, p => c.upper - p[1]]);
                next.push(...q.outside);
                if (q.inside.length) {
                    changed = true;
                    if (mode === 'flush') next.push(q.inside.map(p => { const q = p.slice(); q[1] = Math.min(q[1], .24); return q; }));
                }
            }
            outside = next;
        }
        if (!changed) return [triangle];
        if (record) { s.changed = true; report.changedTriangles++; report[mode === 'flush' ? 'loweredTriangles' : 'trimmedTriangles']++; }
        return [...(p.inside.length ? [p.inside] : []), ...outside];
    };
    const apply = (mesh, start, e) => {
        const s = states.get(e); if (!s?.mode || !s.cuts.length || start === mesh.ic) return;
        const indices = Array.from(mesh.i.subarray(start, mesh.ic)), result = [];
        const vertex = i => { const p = mesh.p, n = mesh.n, u = mesh.u, c = mesh.c, i3 = i * 3, i2 = i * 2; return [p[i3], p[i3 + 1], p[i3 + 2], n[i3], n[i3 + 1], n[i3 + 2], u[i2], u[i2 + 1], c[i3], c[i3 + 1], c[i3 + 2], mesh.t?.[i] ?? -1]; };
        // (spec 10 load budget) a triangle whose plan bounds stay 1 mm clear of every cut's bounds has no part inside a cut
        // (each cut is a convex polygon: fragments returns the triangle unchanged), so it is kept without building it
        const P = mesh.p, clear = (a, b, c) => {
            const x0 = Math.min(P[a * 3], P[b * 3], P[c * 3]), x1 = Math.max(P[a * 3], P[b * 3], P[c * 3]), z0 = Math.min(P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]), z1 = Math.max(P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]);
            for (const cut of s.cuts) if (!(x0 > cut.x1 + 1e-3 || x1 < cut.x0 - 1e-3 || z0 > cut.z1 + 1e-3 || z1 < cut.z0 - 1e-3)) return false;
            return true;
        };
        let changed = false;
        for (let i = 0; i < indices.length; i += 3) {
            const ids = indices.slice(i, i + 3);
            if (clear(ids[0], ids[1], ids[2])) { result.push({ ids }); continue; }
            const tri = ids.map(vertex), fs = fragments(tri, e, null, true);
            if (fs.length === 1 && fs[0] === tri) result.push({ ids });
            else { changed = true; result.push(...fs.map(poly => ({ poly }))); }
        }
        if (!changed) return;
        mesh.ic = start;
        for (const r of result) {
            if (r.ids) { mesh.tri(...r.ids); continue; }
            const ids = r.poly.map(v => mesh.v(...v.slice(0, 8), v.slice(8, 11), v[11]));
            for (let i = 1; i + 1 < ids.length; i++) mesh.tri(ids[0], ids[i], ids[i + 1]);
        }
        if (!report.edges.some(q => q.edgeId === e.id)) report.edges.push({ edgeId: e.id, sourceId: e.access?.sourceId, mode: s.mode, railSourceIds: [...new Set(s.cuts.map(c => c.sourceId))] });
    };
    // Render a closed fascia at each new cut edge. Internal subdivision edges
    // and original outer edges are excluded; source lane boundaries stay put.
    const caps = (mesh, e, outerPoly, bottomAt, topAt, color) => {
        const walls = [];
        const s = states.get(e); if (!s?.changed || s.mode !== 'trim') return walls;
        const source = outerPoly.map(p => [p[0], topAt(...p), p[1]]), fs = fragments(source, e), edges = new Map();
        const key = p => p[0].toFixed(7) + ',' + p[2].toFixed(7);
        for (const f of fs) for (let i = 0; i < f.length; i++) {
            const a = f[i], b = f[(i + 1) % f.length], ka = key(a), kb = key(b), k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
            if (edges.has(k)) edges.delete(k); else edges.set(k, [a, b]);
        }
        for (const [a, b] of edges.values()) {
            const x = (a[0] + b[0]) / 2, z = (a[2] + b[2]) / 2;
            if (!s.cuts.some(c => c.planes.some(p => Math.abs(p([x, 0, z])) < 1e-5) && c.planes.every(p => p([x, 0, z]) >= -1e-5))) continue;
            const A = [a[0], bottomAt(a[0], a[2]), a[2]], B = [b[0], bottomAt(b[0], b[2]), b[2]], C = [b[0], topAt(b[0], b[2]), b[2]], D = [a[0], topAt(a[0], a[2]), a[2]];
            const len = Math.hypot(b[0] - a[0], b[2] - a[2]); if (len < 1e-8) continue;
            mesh.face4(A, B, C, D, color, [b[2] - a[2], 0, a[0] - b[0]]); report.capTriangles += 2;
            walls.push({ wall: true, inferred: true, kind: 'rail-roadside-cap', edge: e, ax: A[0], az: A[2], bx: B[0], bz: B[2], y0a: A[1], y0b: B[1], y1a: D[1], y1b: C[1], nx: (b[2] - a[2]) / len, nz: (a[0] - b[0]) / len, x: (a[0] + b[0]) / 2, z: (a[2] + b[2]) / 2, r: len / 2, hw: 0, hd: 0, angle: 0, poly: null, h: 0 });
        }
        return walls;
    };
    const surface = (e, x, z, height) => {
        const s = states.get(e); if (!s?.mode || contains(s.lanePoly, x, z)) return height;
        for (const c of s.cuts) if (contains(c.poly, x, z) && height >= c.lower && height <= c.upper) return s.mode === 'flush' ? Math.min(height, .24) : null;
        return height;
    };
    const footprint = (e, poly, offset = .24) => {
        const s = states.get(e); if (!s?.mode || s.mode !== 'trim') return [poly];
        return fragments(poly.map(p => [p[0], profile(e, ...p) + offset, p[1]]), e).map(f => f.map(p => [p[0], p[2]]));
    };
    /** true when apply(mesh, start, e) can change e's triangles (it reads them only then) */
    const active = e => { const s = states.get(e); return !!(s?.mode && s.cuts.length); };
    return { register, fragments, apply, caps, surface, footprint, report, active };
}
