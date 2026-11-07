// ============================================================================
//  Spots kit — geometry batching, shared materials, canvas textures, small math.
//  Every hero builder uses `GeoBatch`: add primitives (with a colour) under a
//  material key; `build()` merges them into one mesh per material (few draw
//  calls, vertex colours). Nothing here knows about a particular spot.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;
/** compass bearing (° clockwise from north) → yaw for the walker/camera (0 = facing −z = north) */
export const headingFromBearing = (deg) => -deg * DEG;
export const bearingFromHeading = (h) => ((-h / DEG) % 360 + 360) % 360;

/** deterministic PRNG (mulberry32) */
export function rng(seed = 1) {
    let a = seed >>> 0;
    const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.range = (a0, a1) => a0 + (a1 - a0) * f();
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    f.int = (a0, a1) => Math.floor(a0 + (a1 - a0 + 1) * f());
    return f;
}
export function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
/** 2-D value noise + fbm (cheap, deterministic) */
export function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
export function fbm2(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }

// ---------------------------------------------------------------------------- polygons
export function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; }
export function inPoly(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
export function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
export function polyBox(p) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return { x0, z0, x1, z1 }; }
export function distSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L > 0 ? ((px - ax) * dx + (pz - az) * dz) / L : 0; t = clamp(t, 0, 1);
    const cx = ax + dx * t, cz = az + dz * t; return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}
export function distPolyline(px, pz, pts) { let best = { d: 1e9 }; for (let i = 1; i < pts.length; i++) { const r = distSeg(px, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); if (r.d < best.d) { best = r; best.i = i - 1; } } return best; }
export function polylineLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
/** point + tangent at distance s along a polyline */
export function alongPolyline(pts, s) {
    for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dz);
        if (s <= L || i === pts.length - 1) { const t = L > 0 ? clamp(s / L, 0, 1) : 0; return { x: pts[i - 1][0] + dx * t, z: pts[i - 1][1] + dz * t, tx: dx / (L || 1), tz: dz / (L || 1) }; }
        s -= L;
    }
    return { x: pts[0][0], z: pts[0][1], tx: 1, tz: 0 };
}
/** oriented bounding box of a polygon (min-area over edge directions) */
export function obb(p) {
    let best = null;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (const q of p) { const u = q[0] * ux + q[1] * uz, v = -q[0] * uz + q[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const A = (u1 - u0) * (v1 - v0);
        if (!best || A < best.A) best = { A, ux, uz, u0, u1, v0, v1 };
    }
    if (!best) return null;
    const cu = (best.u0 + best.u1) / 2, cv = (best.v0 + best.v1) / 2;
    return { cx: cu * best.ux - cv * best.uz, cz: cu * best.uz + cv * best.ux, len: best.u1 - best.u0, wid: best.v1 - best.v0, ux: best.ux, uz: best.uz, angle: Math.atan2(-best.uz, best.ux) };
}
/** offset a polyline sideways by d (positive = right of travel when looking along +t in x/z with z south) */
export function offsetPolyline(pts, d) {
    const o = [];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
        o.push([pts[i][0] - tz * d, pts[i][1] + tx * d]);
    }
    return o;
}

// ---------------------------------------------------------------------------- materials
const MATS = new Map();
/**
 * Shared vertex-coloured materials by key. Keys used by the weather/season patches keep their names
 * ('roofs', 'grass', 'groundPlane', 'paved-areas').
 */
export function mat(key, o = {}) {
    const k = key + JSON.stringify(o);
    if (MATS.has(k)) return MATS.get(k);
    const base = {
        concrete: { roughness: 0.92, metalness: 0 }, stone: { roughness: 0.85 }, brick: { roughness: 0.9 }, wood: { roughness: 0.8 },
        metal: { roughness: 0.42, metalness: 0.75 }, steel: { roughness: 0.35, metalness: 0.85 }, chrome: { roughness: 0.12, metalness: 1 },
        paint: { roughness: 0.55, metalness: 0.1 }, glass: { roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 },
        darkglass: { roughness: 0.1, metalness: 0.7 }, plastic: { roughness: 0.5 }, fabric: { roughness: 0.95 }, rubber: { roughness: 0.75 },
        roofs: { roughness: 0.9 }, plant: { roughness: 0.95 }, water: { roughness: 0.06, metalness: 0.2 }, dirt: { roughness: 1 },
        asphalt: { roughness: 0.95 }, bronze: { roughness: 0.38, metalness: 0.85 }, glow: {}, ground: { roughness: 0.95 },
    }[key] || { roughness: 0.8 };
    let m;
    if (key === 'glow') m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, ...o });
    else m = new THREE.MeshStandardMaterial({ vertexColors: true, ...base, ...o });
    m.name = key === 'roofs' ? 'roofs' : 'spot-' + key;
    m.userData.shared = true; // shared across spot scenes (disposeTree skips it)
    MATS.set(k, m);
    return m;
}
export function disposeSharedMaterials() { for (const m of MATS.values()) { m.map?.dispose?.(); m.dispose(); } MATS.clear(); }

// ---------------------------------------------------------------------------- geometry batching
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _c = new THREE.Color();
const UNIT = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: (n) => new THREE.CylinderGeometry(0.5, 0.5, 1, n),
    sphere: (w, h) => new THREE.SphereGeometry(0.5, w, h),
};
const CYL = new Map(); const SPH = new Map();
const cylGeo = (n, top = 1, open = false) => { const k = n + ':' + top + ':' + open; if (!CYL.has(k)) CYL.set(k, new THREE.CylinderGeometry(0.5 * top, 0.5, 1, n, 1, open)); return CYL.get(k); };
const sphGeo = (w, h) => { const k = w + ':' + h; if (!SPH.has(k)) SPH.set(k, new THREE.SphereGeometry(0.5, w, h)); return SPH.get(k); };

/** matrix from position / euler (radians) / scale */
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}

export class GeoBatch {
    constructor() { this.parts = new Map(); this.tris = 0; }
    _bucket(key, opts) { const k = key + (opts ? JSON.stringify(opts) : ''); let b = this.parts.get(k); if (!b) { b = { key, opts, pos: [], nor: [], col: [], uv: [], idx: [], n: 0, hasUv: false }; this.parts.set(k, b); } return b; }
    /**
     * add a geometry (any BufferGeometry, indexed or not) transformed by matrix with a flat colour (or per-vertex colour fn)
     * @param {THREE.BufferGeometry} g
     * @param {string} key material key (see mat())
     * @param {THREE.Matrix4} m
     * @param {string|number|THREE.Color|function} color  fn(x,y,z,nx,ny,nz) → THREE.Color|hex  (world-space)
     */
    add(g, key, m = null, color = '#ffffff', matOpts = null) {
        const b = this._bucket(key, matOpts);
        const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, C = g.attributes.color;
        if (m) _n3.getNormalMatrix(m);
        const base = b.n, fn = typeof color === 'function' ? color : null;
        if (!fn) _c.set(color);
        for (let i = 0; i < P.count; i++) {
            _p.set(P.getX(i), P.getY(i), P.getZ(i)); if (m) _p.applyMatrix4(m);
            b.pos.push(_p.x, _p.y, _p.z);
            let nx = 0, ny = 1, nz = 0;
            if (N) { _s.set(N.getX(i), N.getY(i), N.getZ(i)); if (m) _s.applyMatrix3(_n3).normalize(); nx = _s.x; ny = _s.y; nz = _s.z; }
            b.nor.push(nx, ny, nz);
            if (fn) { const r = fn(_p.x, _p.y, _p.z, nx, ny, nz); if (r?.isColor) b.col.push(r.r, r.g, r.b); else { _c.set(r); b.col.push(_c.r, _c.g, _c.b); _c.set(0); } }
            else if (C) b.col.push(C.getX(i) * _c.r, C.getY(i) * _c.g, C.getZ(i) * _c.b);
            else b.col.push(_c.r, _c.g, _c.b);
            if (UV) { b.uv.push(UV.getX(i), UV.getY(i)); b.hasUv = true; } else b.uv.push(0, 0);
        }
        if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) b.idx.push(base + I[i]); this.tris += I.length / 3; }
        else { for (let i = 0; i < P.count; i++) b.idx.push(base + i); this.tris += P.count / 3; }
        b.n += P.count;
        return this;
    }
    /** axis box centred at (x, y0 + h/2, z): y is the BOTTOM */
    box(x, y, z, w, h, d, color, key = 'concrete', ry = 0, rx = 0, rz = 0) { return this.add(UNIT.box, key, M(x, y + h / 2, z, rx, ry, rz, w, h, d), color); }
    /** box centred at (x,y,z) */
    boxC(x, y, z, w, h, d, color, key = 'concrete', ry = 0, rx = 0, rz = 0) { return this.add(UNIT.box, key, M(x, y, z, rx, ry, rz, w, h, d), color); }
    /** vertical cylinder, y = bottom */
    cyl(x, y, z, r, h, color, key = 'concrete', n = 12, top = 1, rx = 0, ry = 0, rz = 0) { return this.add(cylGeo(n, top), key, M(x, y + h / 2, z, rx, ry, rz, r * 2, h, r * 2), color); }
    /** cylinder between two points */
    rod(a, b, r, color, key = 'metal', n = 8, r2 = null) {
        const d = _p.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if (L < 1e-4) return this;
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(r * 2, L, r * 2));
        return this.add(cylGeo(n, r2 === null ? 1 : r2 / r), key, m, color);
    }
    sphere(x, y, z, rx, ry, rz, color, key = 'concrete', w = 12, h = 8) { return this.add(sphGeo(w, h), key, M(x, y, z, 0, 0, 0, rx * 2, ry * 2, rz * 2), color); }
    /** extruded polygon [[x,z]...] from y0 to y1 (walls + top cap [+ bottom]) */
    prism(poly, y0, y1, color, key = 'concrete', o = {}) {
        const g = prismGeometry(poly, y0, y1, o); this.add(g, key, null, color); g.dispose(); return this;
    }
    /** flat polygon at height y (up-facing) */
    flat(poly, y, color, key = 'concrete') { const g = flatGeometry(poly, y); this.add(g, key, null, color); g.dispose(); return this; }
    /** a quad from 4 corners (counter-clockwise seen from the front) */
    quad(a, b, c, d, color, key = 'concrete', uv = null) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv || [0, 0, 1, 0, 1, 1, 0, 1], 2));
        g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
        this.add(g, key, null, color); g.dispose(); return this;
    }
    /** tube along a 3-D polyline */
    tube(pts, r, color, key = 'metal', radial = 8, closed = false) {
        if (pts.length < 2) return this;
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.2);
        const g = new THREE.TubeGeometry(curve, Math.max(4, pts.length * 4), r, radial, closed);
        this.add(g, key, null, color); g.dispose(); return this;
    }
    /** build meshes (one per material bucket) into a Group */
    build(name = 'batch', { castShadow = true, receiveShadow = true, matOverrides = {} } = {}) {
        const grp = new THREE.Group(); grp.name = name;
        for (const b of this.parts.values()) {
            if (!b.n) continue;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
            g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
            if (b.hasUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
            g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
            g.computeBoundingSphere();
            const m = matOverrides[b.key] || mat(b.key, b.opts || undefined);
            const mesh = new THREE.Mesh(g, m); mesh.name = name + ':' + b.key;
            mesh.castShadow = castShadow && b.key !== 'glow' && b.key !== 'water'; mesh.receiveShadow = receiveShadow;
            grp.add(mesh);
        }
        this.parts.clear();
        return grp;
    }
}

/** prism geometry: walls (u = metres along the perimeter, v = metres up) + top cap; o.bottom adds a bottom cap; o.noTop */
export function prismGeometry(poly, y0, y1, o = {}) {
    const p = polyArea(poly) > 0 ? poly : [...poly].reverse(); // orientation with outward-facing walls (see winding below)
    const pos = [], uv = [], idx = [];
    let u = 0;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) continue;
        const k = pos.length / 3;
        pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]);
        uv.push(u, y0, u + L, y0, u + L, y1, u, y1);
        idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
        u += L;
    }
    const g = new THREE.BufferGeometry();
    const walls = { pos, uv, idx };
    if (!o.noTop) addCap(walls, p, y1, true);
    if (o.bottom) addCap(walls, p, y0, false);
    g.setAttribute('position', new THREE.Float32BufferAttribute(walls.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(walls.uv, 2));
    g.setIndex(walls.idx);
    g.computeVertexNormals();
    // flat-shade: walls share no vertices with caps already; recompute is fine
    return g;
}
function addCap(t, p, y, up) {
    const tri = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
    const k = t.pos.length / 3;
    for (const [x, z] of p) { t.pos.push(x, y, z); t.uv.push(x, z); }
    for (const [a, b, c] of tri) {
        // normal.y of (a,b,c) = (c-a)x(b-a)... sign test: up-facing needs (b-a)×(c-a) with y > 0
        const ax = p[a][0], az = p[a][1], bx = p[b][0], bz = p[b][1], cx = p[c][0], cz = p[c][1];
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        if ((ny > 0) === up) t.idx.push(k + a, k + b, k + c); else t.idx.push(k + a, k + c, k + b);
    }
}
export function flatGeometry(poly, y) {
    const t = { pos: [], uv: [], idx: [] };
    addCap(t, poly, y, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2)); g.setIndex(t.idx); g.computeVertexNormals();
    return g;
}
/** ribbon along a polyline [[x,z]] of width w; yFn(x,z) gives the height; returns a geometry with uv (u across, v metres along) */
export function ribbonGeometry(pts, w, yFn, { step = 2, yOff = 0.03 } = {}) {
    const dense = [];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    const L = offsetPolyline(dense, -w / 2), R = offsetPolyline(dense, w / 2);
    const pos = [], uv = [], idx = []; let s = 0;
    for (let i = 0; i < dense.length; i++) {
        if (i) s += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
        pos.push(L[i][0], yFn(L[i][0], L[i][1]) + yOff, L[i][1], R[i][0], yFn(R[i][0], R[i][1]) + yOff, R[i][1]);
        uv.push(0, s, 1, s);
        if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
}

// ---------------------------------------------------------------------------- canvas textures
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTexture(c, { repeat = false, srgb = true, aniso = 8, mips = true } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = aniso; t.generateMipmaps = mips; if (!mips) t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
}
/** fit + draw text into a box on a 2-D context (no overflow: shrinks, then wraps to ≤ maxLines) */
export function fitDraw(ctx, text, x, y, w, h, { font = (s) => `700 ${s}px Helvetica, Arial, sans-serif`, max = 200, min = 6, align = 'center', maxLines = 1, color = null, lineH = 1.15 } = {}) {
    if (color) ctx.fillStyle = color;
    const words = String(text).split(/\s+/);
    for (let s = Math.min(max, h); s >= min; s = Math.floor(s * 0.92)) {
        ctx.font = font(s);
        const lines = []; let cur = '';
        for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width <= w || !cur) cur = t; else { lines.push(cur); cur = wd; } }
        if (cur) lines.push(cur);
        const tooWide = lines.some((l) => ctx.measureText(l).width > w);
        if (lines.length <= maxLines && lines.length * s * lineH <= h && !tooWide) {
            ctx.textAlign = align; ctx.textBaseline = 'middle';
            const x0 = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
            const top = y + h / 2 - (lines.length - 1) * s * lineH / 2;
            lines.forEach((l, i) => ctx.fillText(l, x0, top + i * s * lineH));
            return s;
        }
    }
    ctx.font = font(min); ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(String(text), align === 'center' ? x + w / 2 : x, y + h / 2, w);
    return min;
}
/** a flat sign (plane) with text, double-sided optional; returns a Mesh. o: {bg, fg, font, pad, border, emissive} */
export function textPlane(text, w, h, o = {}) {
    const ppm = o.ppm || 128, cw = Math.max(16, Math.min(2048, Math.round(w * ppm))), ch = Math.max(16, Math.min(1024, Math.round(h * ppm)));
    const c = canvas(cw, ch), x = c.getContext('2d');
    x.fillStyle = o.bg || '#1f5f3a'; x.fillRect(0, 0, cw, ch);
    if (o.border) { x.strokeStyle = o.border; x.lineWidth = Math.max(2, ch * 0.06); x.strokeRect(x.lineWidth / 2 + ch * 0.04, x.lineWidth / 2 + ch * 0.04, cw - x.lineWidth - ch * 0.08, ch - x.lineWidth - ch * 0.08); }
    const pad = (o.pad ?? 0.12) * ch;
    fitDraw(x, text, pad, pad * 0.6, cw - pad * 2, ch - pad * 1.2, { font: o.font || ((s) => `700 ${s}px Helvetica, Arial, sans-serif`), color: o.fg || '#ffffff', maxLines: o.maxLines || 1, align: o.align || 'center' });
    o.draw?.(x, cw, ch);
    const t = canvasTexture(c);
    const m = o.glow ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: !!o.transparent, side: o.double ? THREE.DoubleSide : THREE.FrontSide })
        : new THREE.MeshStandardMaterial({ map: t, roughness: o.roughness ?? 0.6, metalness: o.metalness ?? 0.1, side: o.double ? THREE.DoubleSide : THREE.FrontSide, transparent: !!o.transparent, emissive: o.emissive ? new THREE.Color('#ffffff') : new THREE.Color(0), emissiveMap: o.emissive ? t : null, emissiveIntensity: o.emissive ? (o.emissiveIntensity ?? 0.3) : 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.name = 'sign:' + String(text).slice(0, 30);
    if (o.double) { // two single-sided faces so the text never reads mirrored from behind
        m.side = THREE.FrontSide;
        const g = new THREE.Group(); g.name = mesh.name; const back = new THREE.Mesh(mesh.geometry, m); back.rotation.y = Math.PI; g.add(mesh, back); return g;
    }
    return mesh;
}
/** count triangles under an object */
export function countTris(root) {
    let n = 0;
    root.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.visible === false) return;
        const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
        n += o.isInstancedMesh ? t * o.count : t;
    });
    return Math.round(n);
}
/** dispose every geometry/material/texture under root (skips userData.shared) */
export function disposeTree(root) {
    root.traverse((o) => {
        if (o.userData?.shared) return;
        o.geometry?.dispose?.();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of ms) { if (m.userData?.shared) continue; for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'aoMap']) m[k]?.dispose?.(); m.dispose?.(); }
    });
}
