import * as THREE from '../vendor/three.module.min.js';

// ============================================================================
//  Fast growable mesh builder (typed arrays) used to merge the static city into
//  a few meshes per 250 m cell. Attributes: position, normal, uv, color (u8),
//  and optionally `tile` (facade atlas tile index, -1 = untextured).
// ============================================================================

const colCache = new Map();
/** '#rrggbb' | THREE.Color | [r,g,b] (0..255) → [r,g,b] 0..255 */
export function rgb(c) {
    if (Array.isArray(c)) return c;
    if (c instanceof THREE.Color) return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
    let v = colCache.get(c);
    if (!v) { const t = new THREE.Color(c); /* linear components, as vertex colours expect */ v = [Math.round(t.r * 255), Math.round(t.g * 255), Math.round(t.b * 255)]; colCache.set(c, v); }
    return v;
}
/** multiply an rgb colour by k (clamped) */
export const shadeRgb = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];

export class MeshBuilder {
    constructor(withTile = false, cap = 64) { // (spec 10 load budget: most cell builders stay small; they grow by doubling)
        this.withTile = withTile;
        this.p = new Float32Array(cap * 3); this.n = new Float32Array(cap * 3); this.u = new Float32Array(cap * 2);
        this.c = new Uint8Array(cap * 3); this.t = withTile ? new Float32Array(cap) : null;
        this.i = new Uint32Array(cap * 2); this.vc = 0; this.ic = 0;
    }
    get empty() { return this.ic === 0; }
    _growV(need) {
        let cap = this.p.length / 3; if (this.vc + need <= cap) return;
        while (cap < this.vc + need) cap *= cap >= 1 << 15 ? 4 : 2; // (large builders grow ×4: fewer copies; build() keeps exact sizes)
        const g = (a, k, T) => { const b = new T(cap * k); b.set(a.subarray(0, this.vc * k)); return b; };
        this.p = g(this.p, 3, Float32Array); this.n = g(this.n, 3, Float32Array); this.u = g(this.u, 2, Float32Array); this.c = g(this.c, 3, Uint8Array);
        if (this.t) this.t = g(this.t, 1, Float32Array);
    }
    _growI(need) {
        let cap = this.i.length; if (this.ic + need <= cap) return;
        while (cap < this.ic + need) cap *= cap >= 1 << 16 ? 4 : 2;
        const b = new Uint32Array(cap); b.set(this.i.subarray(0, this.ic)); this.i = b;
    }
    /** add a vertex, returns its index */
    v(x, y, z, nx, ny, nz, u, v, col, tile = -1) {
        this._growV(1);
        const k = this.vc, k3 = k * 3, k2 = k * 2;
        this.p[k3] = x; this.p[k3 + 1] = y; this.p[k3 + 2] = z;
        this.n[k3] = nx; this.n[k3 + 1] = ny; this.n[k3 + 2] = nz;
        this.u[k2] = u; this.u[k2 + 1] = v;
        this.c[k3] = col[0]; this.c[k3 + 1] = col[1]; this.c[k3 + 2] = col[2];
        if (this.t) this.t[k] = tile;
        return this.vc++;
    }
    tri(a, b, c) { this._growI(3); this.i[this.ic++] = a; this.i[this.ic++] = b; this.i[this.ic++] = c; }
    /** horizontal polygon given as flat list of indices of already-added vertices; orients triangles to face +y */
    triUp(a, b, c) {
        const P = this.p;
        const abx = P[b * 3] - P[a * 3], abz = P[b * 3 + 2] - P[a * 3 + 2], acx = P[c * 3] - P[a * 3], acz = P[c * 3 + 2] - P[a * 3 + 2];
        // y component of (b-a)x(c-a) = abz*acx - abx*acz ; must be > 0 for +y normal
        if (abz * acx - abx * acz >= 0) this.tri(a, b, c); else this.tri(a, c, b);
    }
    /** flat horizontal quad (any winding) at height y, world-space uv (scale uvS) */
    flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS = 0.125, tile = -1) {
        const a = this.v(x0, y, z0, 0, 1, 0, x0 * uvS, z0 * uvS, col, tile), b = this.v(x1, y, z1, 0, 1, 0, x1 * uvS, z1 * uvS, col, tile);
        const c = this.v(x2, y, z2, 0, 1, 0, x2 * uvS, z2 * uvS, col, tile), d = this.v(x3, y, z3, 0, 1, 0, x3 * uvS, z3 * uvS, col, tile);
        this.triUp(a, b, c); this.triUp(a, c, d);
    }
    /** flat polygon from triangle list (pts: [[x,z]...], tris: [[i,j,k]...]) */
    flatPoly(pts, tris, y, col, uvS = 0.125, tile = -1) {
        const o = this.vc;
        for (const [x, z] of pts) this.v(x, y, z, 0, 1, 0, x * uvS, z * uvS, col, tile);
        for (const t of tris) this.triUp(o + t[0], o + t[1], o + t[2]);
    }
    /** convex fan (pts in any consistent order) */
    flatFan(pts, y, col, uvS = 0.125, tile = -1) {
        const o = this.vc;
        for (const [x, z] of pts) this.v(x, y, z, 0, 1, 0, x * uvS, z * uvS, col, tile);
        for (let i = 1; i < pts.length - 1; i++) this.triUp(o, o + i, o + i + 1);
    }
    /** vertical wall quad from (x0,z0) to (x1,z1), y0..y1; normal = side the caller asks (nx,nz) */
    wall(x0, z0, x1, z1, y0, y1, nx, nz, col, u0 = 0, u1 = 1, v0 = 0, v1 = 1, tile = -1) {
        const a = this.v(x0, y0, z0, nx, 0, nz, u0, v0, col, tile), b = this.v(x1, y0, z1, nx, 0, nz, u1, v0, col, tile);
        const c = this.v(x1, y1, z1, nx, 0, nz, u1, v1, col, tile), d = this.v(x0, y1, z0, nx, 0, nz, u0, v1, col, tile);
        // triangle (a,b,c) has normal (-dz, 0, dx) for d = (x1-x0, z1-z0)
        const dx = x1 - x0, dz = z1 - z0;
        if (-dz * nx + dx * nz >= 0) { this.tri(a, b, c); this.tri(a, c, d); } else { this.tri(a, c, b); this.tri(a, d, c); }
    }
    /** generic triangle with computed normal, flipped so it faces `out` (ox,oy,oz) */
    face3(p0, p1, p2, col, out, tile = -1, uvs = null) {
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
        let flip = false;
        if (out && nx * out[0] + ny * out[1] + nz * out[2] < 0) { nx = -nx; ny = -ny; nz = -nz; flip = true; }
        const uv = uvs || [[0, 0], [1, 0], [0.5, 1]];
        const a = this.v(p0[0], p0[1], p0[2], nx, ny, nz, uv[0][0], uv[0][1], col, tile);
        const b = this.v(p1[0], p1[1], p1[2], nx, ny, nz, uv[1][0], uv[1][1], col, tile);
        const c = this.v(p2[0], p2[1], p2[2], nx, ny, nz, uv[2][0], uv[2][1], col, tile);
        if (flip) this.tri(a, c, b); else this.tri(a, b, c);
    }
    /** quad as two face3 calls sharing a normal (p0..p3 in order around) */
    face4(p0, p1, p2, p3, col, out, tile = -1, uvs = null) {
        const uv = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
        this.face3(p0, p1, p2, col, out, tile, [uv[0], uv[1], uv[2]]);
        this.face3(p0, p2, p3, col, out, tile, [uv[0], uv[2], uv[3]]);
    }
    /** axis-aligned (rotated about Y) box with base at y */
    box(cx, y, cz, w, h, d, rot, col, tile = -1) { this.geo(UNIT_BOX, cx, y + h / 2, cz, rot, w, h, d, col, tile); }
    /**
     * Append a prepared prop geometry (see `prep`) transformed by translate + rotY + scale.
     * Vertex colours of the prop (if any) are multiplied by `col`.
     */
    geo(g, tx, ty, tz, rot, sx, sy, sz, col, tile = -1) {
        const n = g.count; this._growV(n); this._growI(g.index.length);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        const o = this.vc;
        const P = g.pos, N = g.nor, U = g.uv, C = g.col;
        for (let i = 0; i < n; i++) {
            const x = P[i * 3] * sx, y = P[i * 3 + 1] * sy, z = P[i * 3 + 2] * sz;
            const k = (o + i) * 3;
            this.p[k] = tx + x * cs + z * sn; this.p[k + 1] = ty + y; this.p[k + 2] = tz - x * sn + z * cs;
            const nx = N[i * 3], nz = N[i * 3 + 2];
            this.n[k] = nx * cs + nz * sn; this.n[k + 1] = N[i * 3 + 1]; this.n[k + 2] = -nx * sn + nz * cs;
            this.u[(o + i) * 2] = U[i * 2]; this.u[(o + i) * 2 + 1] = U[i * 2 + 1];
            if (C) { this.c[k] = C[i * 3] * col[0] / 255; this.c[k + 1] = C[i * 3 + 1] * col[1] / 255; this.c[k + 2] = C[i * 3 + 2] * col[2] / 255; }
            else { this.c[k] = col[0]; this.c[k + 1] = col[1]; this.c[k + 2] = col[2]; }
            if (this.t) this.t[o + i] = tile;
        }
        const I = g.index;
        for (let i = 0; i < I.length; i++) this.i[this.ic++] = I[i] + o;
        this.vc += n;
    }
    /** append all of another builder's vertices / triangles (same attribute layout) */
    append(o) {
        if (!o || o.empty) return this;
        this._growV(o.vc); this._growI(o.ic);
        const k = this.vc;
        this.p.set(o.p.subarray(0, o.vc * 3), k * 3); this.n.set(o.n.subarray(0, o.vc * 3), k * 3);
        this.u.set(o.u.subarray(0, o.vc * 2), k * 2); this.c.set(o.c.subarray(0, o.vc * 3), k * 3);
        if (this.t) { if (o.t) this.t.set(o.t.subarray(0, o.vc), k); else this.t.fill(-1, k, k + o.vc); }
        for (let i = 0; i < o.ic; i++) this.i[this.ic + i] = o.i[i] + k;
        this.vc += o.vc; this.ic += o.ic;
        return this;
    }
    build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, this.vc * 3), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(0, this.vc * 3), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(this.u.slice(0, this.vc * 2), 2));
        geo.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, this.vc * 3), 3, true));
        if (this.t) geo.setAttribute('tile', new THREE.BufferAttribute(this.t.slice(0, this.vc), 1));
        geo.setIndex(new THREE.BufferAttribute(this.vc > 65535 ? this.i.slice(0, this.ic) : new Uint16Array(this.i.subarray(0, this.ic)), 1));
        // (spec 10 load budget) the box once: BufferGeometry.computeBoundingSphere builds the same box from the positions
        // again before its radius pass; this is that radius pass, on the box computeBoundingBox made
        geo.computeBoundingBox();
        const sphere = geo.boundingSphere = new THREE.Sphere(), P = geo.attributes.position.array;
        geo.boundingBox.getCenter(sphere.center);
        const cx = sphere.center.x, cy = sphere.center.y, cz = sphere.center.z; let r2 = 0;
        for (let k = 0; k < this.vc * 3; k += 3) { const dx = cx - P[k], dy = cy - P[k + 1], dz = cz - P[k + 2]; r2 = Math.max(r2, dx * dx + dy * dy + dz * dz); }
        sphere.radius = Math.sqrt(r2);
        if (isNaN(sphere.radius)) geo.computeBoundingSphere(); // (three's own pass, which also reports it)
        return geo;
    }
    /** append every builder of `list` to this one, as append() one by one would, with arrays of the exact final size */
    appendAll(list) {
        let vc = this.vc, ic = this.ic;
        for (const o of list) if (o && !o.empty) { vc += o.vc; ic += o.ic; }
        const grow = (a, k, T) => { const b = new T(Math.max(1, vc) * k); b.set(a.subarray(0, this.vc * k)); return b; };
        this.p = grow(this.p, 3, Float32Array); this.n = grow(this.n, 3, Float32Array); this.u = grow(this.u, 2, Float32Array); this.c = grow(this.c, 3, Uint8Array);
        if (this.t) this.t = grow(this.t, 1, Float32Array);
        const ix = new Uint32Array(Math.max(1, ic)); ix.set(this.i.subarray(0, this.ic)); this.i = ix;
        for (const o of list) {
            if (!o || o.empty) continue;
            const k = this.vc;
            this.p.set(o.p.subarray(0, o.vc * 3), k * 3); this.n.set(o.n.subarray(0, o.vc * 3), k * 3);
            this.u.set(o.u.subarray(0, o.vc * 2), k * 2); this.c.set(o.c.subarray(0, o.vc * 3), k * 3);
            if (this.t) { if (o.t) this.t.set(o.t.subarray(0, o.vc), k); else this.t.fill(-1, k, k + o.vc); }
            for (let i = 0; i < o.ic; i++) this.i[this.ic + i] = o.i[i] + k;
            this.vc += o.vc; this.ic += o.ic;
        }
        return this;
    }
}

/** Convert a THREE.BufferGeometry into a compact prop record for MeshBuilder.geo(). Vertex colours (0..1) optional. */
export function prep(geo, color = null) {
    const g = geo.index ? geo : geo;
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : new Float32Array(pos.length / 3 * 2);
    let col = null;
    if (g.attributes.color) { const a = g.attributes.color; col = new Uint8Array(a.count * 3); for (let i = 0; i < a.count; i++) { col[i * 3] = a.getX(i) * 255; col[i * 3 + 1] = a.getY(i) * 255; col[i * 3 + 2] = a.getZ(i) * 255; } }
    else if (color) { const c = rgb(color); col = new Uint8Array(pos.length); for (let i = 0; i < pos.length; i += 3) { col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2]; } }
    let index;
    if (g.index) index = Uint32Array.from(g.index.array); else { index = new Uint32Array(pos.length / 3); for (let i = 0; i < index.length; i++) index[i] = i; }
    return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), col, index, count: pos.length / 3 };
}

/** merge several prepared props (each with own colour already baked) into one */
export function mergeProps(list) {
    let count = 0, ic = 0; for (const p of list) { count += p.count; ic += p.index.length; }
    const out = { pos: new Float32Array(count * 3), nor: new Float32Array(count * 3), uv: new Float32Array(count * 2), col: new Uint8Array(count * 3), index: new Uint32Array(ic), count };
    let o = 0, io = 0;
    for (const p of list) {
        out.pos.set(p.pos, o * 3); out.nor.set(p.nor, o * 3); out.uv.set(p.uv, o * 2);
        if (p.col) out.col.set(p.col, o * 3); else out.col.fill(255, o * 3, (o + p.count) * 3);
        for (let i = 0; i < p.index.length; i++) out.index[io + i] = p.index[i] + o;
        o += p.count; io += p.index.length;
    }
    return out;
}

/** prepared prop translated/scaled (bake) */
export function bakeProp(geo, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, color = '#ffffff' } = {}) {
    const g = geo.clone();
    if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz);
    g.scale(sx, sy, sz); g.translate(x, y, z);
    return prep(g, color);
}

export const UNIT_BOX = prep(new THREE.BoxGeometry(1, 1, 1));
