import * as THREE from '../vendor/three.module.min.js';

// ---------- deterministic random ----------
export function makeRng(seed = 1) {
    let s = seed >>> 0 || 1;
    const rng = () => {
        // mulberry32
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (a, b) => a + (b - a) * rng();
    rng.int = (a, b) => Math.floor(rng.range(a, b + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    return rng;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export function angleLerp(a, b, t) {
    let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
}
export function angleDiff(a, b) {
    return ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

// ---------- 2D geometry ----------
export function distPointSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2;
    t = clamp(t, 0, 1);
    const cx = ax + dx * t, cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}

export function pointInPolygon(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        const intersect = ((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ---------- geometry merging (one draw call per material) ----------
export class GeoBatch {
    constructor() {
        this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = [];
        this.vcount = 0;
    }
    /** add a BufferGeometry transformed by matrix, with a flat color */
    add(geo, matrix, color) {
        const g = geo.index ? geo : geo;
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
        const v = new THREE.Vector3();
        const nm = new THREE.Matrix3().getNormalMatrix(matrix);
        const c = color instanceof THREE.Color ? color : new THREE.Color(color);
        for (let i = 0; i < p.count; i++) {
            v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(matrix);
            this.pos.push(v.x, v.y, v.z);
            v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize();
            this.nor.push(v.x, v.y, v.z);
            if (u) this.uv.push(u.getX(i), u.getY(i)); else this.uv.push(0, 0);
            this.col.push(c.r, c.g, c.b);
        }
        if (g.index) {
            for (let i = 0; i < g.index.count; i++) this.idx.push(g.index.getX(i) + this.vcount);
        } else {
            for (let i = 0; i < p.count; i++) this.idx.push(i + this.vcount);
        }
        this.vcount += p.count;
    }
    /** add an arbitrary quad (4 points, counter-clockwise seen from +normal) */
    quad(a, b, c, d, color, normal = [0, 1, 0], uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const col = color instanceof THREE.Color ? color : new THREE.Color(color);
        const pts = [a, b, c, d];
        for (let i = 0; i < 4; i++) {
            this.pos.push(pts[i][0], pts[i][1], pts[i][2]);
            this.nor.push(normal[0], normal[1], normal[2]);
            this.uv.push(uvs[i][0], uvs[i][1]);
            this.col.push(col.r, col.g, col.b);
        }
        const o = this.vcount;
        this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
        this.vcount += 4;
    }
    /** convex polygon fan on the ground plane at height y */
    polygon(points, y, color) {
        const col = color instanceof THREE.Color ? color : new THREE.Color(color);
        const o = this.vcount;
        for (const [x, z] of points) {
            this.pos.push(x, y, z); this.nor.push(0, 1, 0); this.uv.push(x * 0.05, z * 0.05);
            this.col.push(col.r, col.g, col.b);
        }
        for (let i = 1; i < points.length - 1; i++) this.idx.push(o, o + i + 1, o + i);
        this.vcount += points.length;
    }
    build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        geo.setIndex(this.idx);
        return geo;
    }
    get empty() { return this.vcount === 0; }
}

/** Ear-clipping triangulation for simple (possibly concave) polygons -> adds to batch */
export function triangulate(points) {
    const n = points.length;
    if (n < 3) return [];
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    // ensure CCW (in x,z with y up, we want consistent winding)
    let area = 0;
    for (let i = 0; i < n; i++) { const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % n]; area += x1 * z2 - x2 * z1; }
    if (area < 0) idx.reverse();
    const tris = [];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inTri = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 5000) {
        let found = false;
        for (let i = 0; i < idx.length; i++) {
            const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
            const a = points[i0], b = points[i1], c = points[i2];
            if (cross(a, b, c) <= 0) continue;
            let ok = true;
            for (const j of idx) {
                if (j === i0 || j === i1 || j === i2) continue;
                if (inTri(points[j], a, b, c)) { ok = false; break; }
            }
            if (!ok) continue;
            tris.push([i0, i1, i2]);
            idx.splice(i, 1);
            found = true;
            break;
        }
        if (!found) break;
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
}

function addPolygonToBatch(batch, points, y, color) {
    const col = color instanceof THREE.Color ? color : new THREE.Color(color);
    const tris = triangulate(points);
    const o = batch.vcount;
    for (const [x, z] of points) {
        batch.pos.push(x, y, z); batch.nor.push(0, 1, 0); batch.uv.push(x * 0.02, z * 0.02);
        batch.col.push(col.r, col.g, col.b);
    }
    for (const [a, b, c] of tris) batch.idx.push(o + a, o + c, o + b);
    batch.vcount += points.length;
}

// ---------- canvas textures ----------
export function makeCanvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

function signTexture(text, { bg = '#111827', fg = '#ffffff', sub = '', accent = '#f97316', w = 1024, h = 256 } = {}) {
    return makeCanvasTexture(w, h, (ctx) => {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = accent; ctx.fillRect(0, h - 14, w, 14);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let size = sub ? 110 : 130;
        ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        while (ctx.measureText(text).width > w - 80 && size > 30) { size -= 6; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; }
        ctx.fillText(text, w / 2, sub ? h / 2 - 30 : h / 2);
        if (sub) {
            ctx.font = `48px "Helvetica Neue", Arial, sans-serif`;
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(sub, w / 2, h / 2 + 70);
        }
    });
}

function windowTexture({ day = true, tint = '#ffffff' } = {}) {
    return makeCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
        const cols = 4, rows = 4;
        const cw = w / cols, ch = h / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const lit = !day && Math.random() < 0.5;
            ctx.fillStyle = day ? 'rgba(40,60,90,0.75)' : (lit ? 'rgba(255,220,150,0.95)' : 'rgba(20,25,40,0.9)');
            ctx.fillRect(i * cw + cw * 0.22, j * ch + ch * 0.18, cw * 0.56, ch * 0.5);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(i * cw + cw * 0.22, j * ch + ch * 0.18, cw * 0.56, ch * 0.08);
        }
    });
}

function formatKmh(ms) { return Math.round(Math.abs(ms) * 3.6); }
function formatMph(ms) { return Math.round(Math.abs(ms) * 2.237); }

export const isTouch = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---------- simple mesh helpers handed to landmark builders (ctx.helpers) ----------
// All meshes are placed with their BASE at y (not their centre), local frame: +x east, +z south.
const _HBOX = new THREE.BoxGeometry(1, 1, 1);
const _hmat = new Map();
function _lam(color) {
    const k = typeof color === 'string' ? color : '#' + new THREE.Color(color).getHexString();
    let m = _hmat.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: k }); _hmat.set(k, m); }
    return m;
}
const _shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
export const landmarkHelpers = {
    /** box(w, h, d, color, x=0, y=0, z=0, rotY=0) → Mesh (base at y) */
    box(w, h, d, color, x = 0, y = 0, z = 0, rotY = 0) {
        const m = _shadow(new THREE.Mesh(_HBOX, _lam(color)));
        m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.rotation.y = rotY; return m;
    },
    /** cyl(rTop, rBottom, h, color, x=0, y=0, z=0, segments=16) → Mesh (base at y) */
    cyl(rTop, rBottom, h, color, x = 0, y = 0, z = 0, segments = 16) {
        const m = _shadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), _lam(color)));
        m.position.set(x, y + h / 2, z); return m;
    },
    /** cone(r, h, color, x=0, y=0, z=0, segments=16) → Mesh (base at y) */
    cone(r, h, color, x = 0, y = 0, z = 0, segments = 16) {
        const m = _shadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), _lam(color)));
        m.position.set(x, y + h / 2, z); return m;
    },
    /** sign(text, w, h, {bg, fg, accent, sub}) → double-sided plane Mesh facing +z, centred at origin */
    sign(text, w = 8, h = 2, opts = {}) {
        const tex = signTexture(text, { bg: opts.bg || '#111827', fg: opts.fg || '#ffffff', accent: opts.accent || '#f97316', sub: opts.sub || '', w: 1024, h: Math.round(1024 * h / w) || 256 });
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    },
};
