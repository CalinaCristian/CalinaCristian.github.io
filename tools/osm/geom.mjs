// Small 2D geometry helpers shared by the OSM build script.

export function distPointSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}

export function pointInPolygon(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
}

export function polyArea(poly) { // signed (x right, z down => positive = clockwise on screen)
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return a / 2;
}

export function polyCentroid(poly) {
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
        a += f; cx += (poly[j][0] + poly[i][0]) * f; cz += (poly[j][1] + poly[i][1]) * f;
    }
    if (Math.abs(a) < 1e-9) { // degenerate: vertex average
        let sx = 0, sz = 0; for (const p of poly) { sx += p[0]; sz += p[1]; }
        return [sx / poly.length, sz / poly.length];
    }
    return [cx / (3 * a), cz / (3 * a)];
}

/** Douglas–Peucker; `keep[i]` forces a vertex to be kept. Returns indices kept. */
export function simplifyIdx(pts, tol, keep = null) {
    const n = pts.length;
    if (n <= 2) return pts.map((_, i) => i);
    const mark = new Uint8Array(n); mark[0] = mark[n - 1] = 1;
    if (keep) for (let i = 0; i < n; i++) if (keep[i]) mark[i] = 1;
    // run DP between consecutive forced vertices
    const forced = []; for (let i = 0; i < n; i++) if (mark[i]) forced.push(i);
    const stack = [];
    for (let k = 0; k < forced.length - 1; k++) stack.push([forced[k], forced[k + 1]]);
    while (stack.length) {
        const [a, b] = stack.pop();
        let md = -1, mi = -1;
        for (let i = a + 1; i < b; i++) {
            const d = distPointSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d;
            if (d > md) { md = d; mi = i; }
        }
        if (md > tol) { mark[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    const out = []; for (let i = 0; i < n; i++) if (mark[i]) out.push(i);
    return out;
}

/** Simplify a closed ring: drop near-duplicates, DP, cap vertex count. */
export function simplifyRing(ring, minDist = 1, tol = 0.3, maxVerts = 1e9) {
    let r = [];
    for (const p of ring) { const q = r[r.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist) r.push(p); }
    while (r.length > 3 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < minDist) r.pop();
    if (r.length < 3) return null;
    // DP on the open chain r[0..n-1, 0]
    let t = tol;
    let out = r;
    for (let iter = 0; iter < 12; iter++) {
        const chain = r.concat([r[0]]);
        const idx = simplifyIdx(chain, t);
        out = idx.slice(0, -1).map(i => chain[i]);
        if (out.length <= maxVerts) break;
        t *= 1.6;
    }
    return out.length >= 3 ? out : null;
}

/** Uniform grid spatial hash for segments / points. */
export class Grid {
    constructor(cell = 50) { this.cell = cell; this.map = new Map(); }
    key(i, j) { return i * 100003 + j; }
    insertBox(minx, minz, maxx, maxz, item) {
        const c = this.cell;
        const i0 = Math.floor(minx / c), i1 = Math.floor(maxx / c), j0 = Math.floor(minz / c), j1 = Math.floor(maxz / c);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(item);
        }
    }
    query(x, z, r, cb) {
        const c = this.cell;
        const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
        const seen = new Set();
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const a = this.map.get(this.key(i, j)); if (!a) continue;
            for (const it of a) { if (seen.has(it)) continue; seen.add(it); cb(it); }
        }
    }
}

/** Join open ways (arrays of node ids) into closed rings. Returns { rings: id[][], open: id[][] } */
export function assembleRings(wayNodeLists) {
    const segs = wayNodeLists.filter(w => w && w.length >= 2).map(w => w.slice());
    const rings = [], open = [];
    const pending = [];
    for (const s of segs) { if (s[0] === s[s.length - 1] && s.length >= 4) rings.push(s); else pending.push(s); }
    while (pending.length) {
        let cur = pending.pop();
        let progress = true;
        while (cur[0] !== cur[cur.length - 1] && progress) {
            progress = false;
            for (let i = 0; i < pending.length; i++) {
                const s = pending[i], end = cur[cur.length - 1];
                if (s[0] === end) cur = cur.concat(s.slice(1));
                else if (s[s.length - 1] === end) cur = cur.concat(s.slice(0, -1).reverse());
                else if (s[s.length - 1] === cur[0]) cur = s.concat(cur.slice(1));
                else if (s[0] === cur[0]) cur = s.slice().reverse().concat(cur.slice(1));
                else continue;
                pending.splice(i, 1); progress = true; break;
            }
        }
        if (cur[0] === cur[cur.length - 1] && cur.length >= 4) rings.push(cur); else open.push(cur);
    }
    return { rings, open };
}


/** Exact minimum edge distance. Intersections, including collinear contact, have distance zero. */
export function distSegmentSegment(a, b, c, d) {
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const overlap = Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + 1e-9 && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + 1e-9;
    if (overlap && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return 0;
    return Math.min(distPointSeg(...a, ...c, ...d).d, distPointSeg(...b, ...c, ...d).d, distPointSeg(...c, ...a, ...b).d, distPointSeg(...d, ...a, ...b).d);
}

/** Minimum footprint distance to the district union (buffered lines, circles and polygons).
 * A nonpositive value means contact/overlap; negative penetration depth is not an interior distance field.
 * The actual source edges and holes are tested, never a centroid or bounding-radius admission proxy. */
export function footprintMargin(outer, geometry, holes = []) {
    const rings = [outer, ...holes], edges = rings.flatMap(r => r.map((a, i) => [a, r[(i + 1) % r.length]]));
    const solid = p => pointInPolygon(...p, outer) && !holes.some(h => pointInPolygon(...p, h));
    const lineDistance = (a, b) => solid(a) || solid(b) ? 0 : Math.min(...edges.map(([c, d]) => distSegmentSegment(a, b, c, d)));
    let margin = Infinity;
    for (const p of geometry.pieces || []) for (let i = 1; i < p.pts.length; i++) margin = Math.min(margin, lineDistance(p.pts[i - 1], p.pts[i]) - p.r);
    for (const c of geometry.circles || []) {
        const p = [c.x, c.z], distance = solid(p) ? 0 : Math.min(...edges.map(([a, b]) => distPointSeg(...p, ...a, ...b).d));
        margin = Math.min(margin, distance - c.r);
    }
    for (const polygon of geometry.polys || []) {
        if (polygon.some(solid) || rings.some(r => r.some(p => pointInPolygon(...p, polygon)))) { margin = Math.min(margin, 0); continue; }
        for (let i = 0; i < polygon.length; i++) margin = Math.min(margin, lineDistance(polygon[i], polygon[(i + 1) % polygon.length]));
    }
    return margin;
}
