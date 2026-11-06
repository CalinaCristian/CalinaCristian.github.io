import * as THREE from '../vendor/three.module.min.js';
import { signTexture } from './util.js';

// ============================================================================
//  VEHICLES — low-poly but shaped cars built from extruded side profiles.
//  Every vehicle = 2 draw calls: a painted body (per-colour shared material)
//  and a "parts" mesh (glass, tyres, lights, trim) using one shared material
//  whose per-vertex attribute aMat = (emissive, roughness, metalness).
//  forward = -z, ground at y = 0.
// ============================================================================

export const CAR_COLORS = ['#c9ccd1', '#f5f5f5', '#1f2937', '#9ca3af', '#7f1d1d', '#1e3a8a', '#374151', '#b91c1c', '#e5e7eb', '#0f172a', '#4b5563', '#065f46', '#d1d5db', '#78350f'];

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const IDENT = new THREE.Matrix4();

// ---------------------------------------------------------------------------
//  Batch builder with per-vertex material params
// ---------------------------------------------------------------------------
class Batch {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.idx = []; this.n = 0; }
    /** opts: e = emissive, r = roughness, m = metalness */
    add(geo, matrix = IDENT, color = '#ffffff', { e = 0, r = 0.6, m = 0 } = {}) {
        const p = geo.attributes.position, nr = geo.attributes.normal;
        const nm = new THREE.Matrix3().getNormalMatrix(matrix);
        const c = color instanceof THREE.Color ? color : new THREE.Color(color);
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(_v.x, _v.y, _v.z);
            _n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); this.nor.push(_n.x, _n.y, _n.z);
            this.col.push(c.r, c.g, c.b); this.mat.push(e, r, m);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(geo.index.getX(i) + this.n);
        else for (let i = 0; i < p.count; i++) this.idx.push(i + this.n);
        this.n += p.count;
        return this;
    }
    build(withMat = true) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        if (withMat) g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 3));
        g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere(); g.computeBoundingBox();
        return g;
    }
}

/** Extrude a side profile [[z,y],...] across x from x0 to x1. taper(x,y,z) => x scale (optional). Flat-shaded. */
function extrude(points, x0, x1, taper = null) {
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
        let x = x1 - sz; const y = sy, z = sx;
        if (taper) x *= taper(x, y, z);
        p.setXYZ(i, x, y, z);
    }
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
}
/** front-most (side=-1) or rear-most (side=1) z of a profile polygon at height y */
function profileZ(points, y, side) {
    let best = side < 0 ? Infinity : -Infinity;
    for (let i = 0; i < points.length; i++) {
        const [z0, y0] = points[i], [z1, y1] = points[(i + 1) % points.length];
        if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue;
        const z = z0 + (z1 - z0) * (y - y0) / (y1 - y0);
        best = side < 0 ? Math.min(best, z) : Math.max(best, z);
    }
    return best;
}
/** a thin strip glued on a profile segment (windshield / rear window), offset outward */
function glassStrip(p0, p1, inset = 0.05, off = 0.006, thick = 0.018) {
    const dz = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dz, dy);
    const d = [dz / l, dy / l], n = [-d[1], d[0]];
    const a = [p0[0] + d[0] * inset, p0[1] + d[1] * inset], b = [p1[0] - d[0] * inset, p1[1] - d[1] * inset];
    const P = (q, o) => [q[0] + n[0] * o, q[1] + n[1] * o];
    return [P(a, off), P(b, off), P(b, off + thick), P(a, off + thick)];
}
/** box between two points (beam) */
function beamM(a, b, w, h) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(w, h, len));
}

// ---------------------------------------------------------------------------
//  Shared geometries
// ---------------------------------------------------------------------------
const TYRE = new THREE.CylinderGeometry(1, 1, 1, 12, 1); TYRE.rotateZ(Math.PI / 2);
const RIM = new THREE.CylinderGeometry(1, 1, 1, 8, 1); RIM.rotateZ(Math.PI / 2);
const ARCH = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true, -Math.PI / 2, Math.PI); ARCH.rotateZ(Math.PI / 2);

const C = {
    glass: '#26343f', tyre: '#151618', rim: '#9aa0a6', trim: '#1c1d20', plastic: '#2a2c30', head: '#fff7dc', tail: '#c4141b', amber: '#ff8a1c',
    plate: '#f2f2f2', euBlue: '#1f3d99', chrome: '#c9ced4', grille: '#0f1012',
};
const GLASS = { r: 0.05, m: 0.5 }, HEAD = { e: 0.55, r: 0.15 }, TAIL = { e: 0.45, r: 0.2 }, TYREM = { r: 0.9 }, RIMM = { r: 0.35, m: 0.8 };

function wheels(b, { W, wr, wz, tw = 0.22, inset = 0.04, arch = true }) {
    for (const z of wz) for (const s of [-1, 1]) {
        const x = s * (W / 2 - tw / 2 - inset);
        b.add(TYRE, M(x, wr, z, tw, wr, wr), C.tyre, TYREM);
        b.add(RIM, M(x + s * 0.012, wr, z, tw, wr * 0.6, wr * 0.6), C.rim, RIMM);
        if (arch) b.add(ARCH, M(s * (W / 2 - 0.02), wr, z, 0.1, wr + 0.08, wr + 0.08), C.trim, { r: 0.8 });
    }
}
function lightPair(b, z, y, x, w, h, color, opts, dz = 0.08) {
    for (const s of [-1, 1]) b.add(BOX, M(s * x, y, z, w, h, dz), color, opts);
}
function plate(b, z, y, dir, yellowish = false) {
    b.add(BOX, M(0, y, z, 0.52, 0.12, 0.02), yellowish ? '#f4e9b8' : C.plate, { r: 0.5 });
    b.add(BOX, M(-0.235, y, z + dir * 0.004, 0.05, 0.12, 0.02), C.euBlue, { r: 0.5 });
}

// ---------------------------------------------------------------------------
//  Passenger-car builder from profiles
// ---------------------------------------------------------------------------
/**
 * o: { L, W, wr, wz, low (lower-body profile), gh (greenhouse profile) or null, belt, top, taper,
 *      ws:[p0,p1] windshield segment, rw:[p0,p1] rear window segment, side: [[z,y]...][] side windows,
 *      headY, tailY, headW, tailW, lightH, extra(body, parts) }
 */
function buildCar(o) {
    const body = new Batch(), parts = new Batch();
    const { L, W, belt, top } = o;
    const gW = o.gW || W - 0.06;
    const taper = (x, y) => 1 - o.taper * THREE.MathUtils.clamp((y - belt) / (top - belt), 0, 1);
    body.add(extrude(o.low, -W / 2, W / 2));
    if (o.gh) { // sink the greenhouse bottom into the lower body (no coplanar faces → no z-fighting at the belt line)
        const g = o.gh, f = g[0], r = g[g.length - 1];
        body.add(extrude([...g, [r[0], r[1] - 0.08], [f[0], f[1] - 0.08]], -gW / 2, gW / 2, taper));
    }
    // glass
    const gx = gW / 2 - 0.065;
    if (o.ws) parts.add(extrude(glassStrip(o.ws[0], o.ws[1]), -gx, gx, taper), IDENT, C.glass, GLASS);
    if (o.rw) parts.add(extrude(glassStrip(o.rw[0], o.rw[1]), -gx, gx, taper), IDENT, C.glass, GLASS);
    for (const poly of o.side || []) {
        parts.add(extrude(poly, gW / 2 - 0.01, gW / 2 + 0.012, taper), IDENT, C.glass, GLASS);
        parts.add(extrude(poly, -gW / 2 - 0.012, -gW / 2 + 0.01, taper), IDENT, C.glass, GLASS);
    }
    wheels(parts, o);
    // lights
    const hy = o.headY, ty = o.tailY;
    const fz = profileZ(o.low, hy, -1), rz = profileZ(o.low, ty, 1);
    const lh = o.lightH || 0.13;
    lightPair(parts, fz + 0.025, hy, W / 2 - (o.headW || 0.36) / 2 - 0.08, o.headW || 0.36, lh, C.head, HEAD);
    lightPair(parts, fz + 0.03, hy - lh / 2 - 0.035, W / 2 - 0.16, 0.12, 0.05, C.amber, { e: 0.1, r: 0.3 });
    lightPair(parts, rz - 0.025, ty, W / 2 - (o.tailW || 0.32) / 2 - 0.06, o.tailW || 0.32, lh + 0.03, C.tail, TAIL);
    // grille + bumpers + plates
    const gz = profileZ(o.low, hy - 0.02, -1);
    parts.add(BOX, M(0, hy - 0.02, gz + 0.02, W - 2 * (o.headW || 0.36) - 0.25, lh * 0.8, 0.05), C.grille, { r: 0.5 });
    const by = o.bumperY || 0.38;
    parts.add(BOX, M(0, by, profileZ(o.low, by, -1) + 0.02, W + 0.02, 0.14, 0.12), C.plastic, { r: 0.7 });
    parts.add(BOX, M(0, by, profileZ(o.low, by, 1) - 0.02, W + 0.02, 0.14, 0.12), C.plastic, { r: 0.7 });
    plate(parts, profileZ(o.low, by + 0.11, -1) - 0.015, by + 0.11, -1);
    plate(parts, profileZ(o.low, (by + ty) / 2, 1) + 0.015, (by + ty) / 2, 1);
    // side skirts
    for (const s of [-1, 1]) parts.add(BOX, M(s * (W / 2 + 0.005), o.wr * 0.95, (o.wz[0] + o.wz[1]) / 2, 0.03, 0.12, Math.abs(o.wz[1] - o.wz[0]) - o.wr * 2.4), C.plastic, { r: 0.7 });
    // door handles
    if (o.handles) for (const z of o.handles) for (const s of [-1, 1]) parts.add(BOX, M(s * (W / 2 + 0.01), belt - 0.08, z, 0.03, 0.035, 0.16), C.trim, { r: 0.4, m: 0.4 });
    // side mirrors (painted housings on the body)
    if (o.mirror) for (const s of [-1, 1]) {
        body.add(BOX, M(s * (W / 2 + 0.1), o.mirror[1], o.mirror[0], 0.18, 0.12, 0.1));
        parts.add(BOX, M(s * (W / 2 + 0.1), o.mirror[1], o.mirror[0] + 0.051, 0.15, 0.09, 0.005), C.chrome, { r: 0.05, m: 1 });
    }
    if (o.extra) o.extra(body, parts);
    return { body: body.build(false), parts: parts.build(), length: L, width: W };
}

// ---------------------------------------------------------------------------
//  Kind definitions
// ---------------------------------------------------------------------------
const KINDS = {
    sedan: () => buildCar({ // Dacia Logan-ish three box
        L: 4.4, W: 1.76, wr: 0.31, wz: [-1.33, 1.28], belt: 0.98, top: 1.46, taper: 0.2,
        low: [[-2.2, 0.3], [-2.23, 0.6], [-2.1, 0.8], [-0.95, 0.97], [1.45, 0.99], [2.12, 0.95], [2.23, 0.74], [2.2, 0.3]],
        gh: [[-0.95, 0.96], [-0.12, 1.45], [0.95, 1.46], [1.55, 0.98]],
        ws: [[-0.95, 0.96], [-0.12, 1.45]], rw: [[0.95, 1.46], [1.55, 0.98]],
        side: [[[-0.82, 1.01], [-0.17, 1.39], [0.36, 1.4], [0.36, 1.01]], [[0.46, 1.01], [0.46, 1.4], [0.92, 1.4], [1.4, 1.01]]],
        headY: 0.7, tailY: 0.8, mirror: [-0.8, 1.03], handles: [0.15, 1.0],
    }),
    hatch: () => buildCar({ // Dacia Sandero-ish
        L: 4.06, W: 1.74, wr: 0.31, wz: [-1.27, 1.3], belt: 1.0, top: 1.52, taper: 0.2,
        low: [[-2.02, 0.3], [-2.05, 0.62], [-1.92, 0.83], [-0.85, 0.99], [1.86, 1.01], [2.03, 0.98], [2.05, 0.6], [2.0, 0.3]],
        gh: [[-0.85, 0.98], [-0.05, 1.51], [1.62, 1.51], [1.96, 1.0]],
        ws: [[-0.85, 0.98], [-0.05, 1.51]], rw: [[1.62, 1.51], [1.96, 1.0]],
        side: [[[-0.72, 1.03], [-0.1, 1.45], [0.45, 1.45], [0.45, 1.03]], [[0.55, 1.03], [0.55, 1.45], [1.25, 1.45], [1.45, 1.03]], [[1.55, 1.08], [1.55, 1.42], [1.68, 1.42], [1.82, 1.08]]],
        headY: 0.74, tailY: 0.86, tailW: 0.22, lightH: 0.15, mirror: [-0.72, 1.06], handles: [0.2, 1.05],
    }),
    suv: () => buildCar({ // Duster / RAV4-ish
        L: 4.6, W: 1.88, wr: 0.38, wz: [-1.42, 1.38], belt: 1.13, top: 1.72, taper: 0.14,
        low: [[-2.28, 0.42], [-2.31, 0.82], [-2.14, 1.0], [-1.0, 1.12], [2.1, 1.14], [2.3, 1.1], [2.31, 0.42]],
        gh: [[-1.0, 1.11], [-0.22, 1.7], [1.95, 1.72], [2.24, 1.13]],
        ws: [[-1.0, 1.11], [-0.22, 1.7]], rw: [[1.95, 1.72], [2.24, 1.13]],
        side: [[[-0.86, 1.16], [-0.26, 1.64], [0.5, 1.65], [0.5, 1.16]], [[0.6, 1.16], [0.6, 1.65], [1.45, 1.66], [1.45, 1.16]], [[1.55, 1.18], [1.55, 1.64], [1.92, 1.65], [2.12, 1.18]]],
        headY: 0.88, tailY: 1.0, headW: 0.4, mirror: [-0.92, 1.2], handles: [0.3, 1.25], bumperY: 0.48,
        extra: (body, parts) => { // roof rails + cladding
            for (const s of [-1, 1]) parts.add(BOX, M(s * 0.68, 1.75, 0.85, 0.05, 0.05, 2.0), C.trim, { r: 0.4, m: 0.5 });
        },
    }),
    pickup: () => buildCar({ // F-150-ish (Seattle)
        L: 5.4, W: 1.98, wr: 0.41, wz: [-1.7, 1.62], belt: 1.25, top: 1.9, taper: 0.1,
        low: [[-2.7, 0.45], [-2.72, 0.95], [-2.55, 1.18], [-1.35, 1.25], [2.68, 1.25], [2.7, 0.45]],
        gh: [[-1.35, 1.24], [-0.7, 1.88], [0.52, 1.9], [0.6, 1.25]],
        ws: [[-1.35, 1.24], [-0.7, 1.88]], rw: [[0.52, 1.9], [0.6, 1.25]],
        side: [[[-1.2, 1.3], [-0.73, 1.82], [-0.12, 1.83], [-0.12, 1.3]], [[-0.02, 1.3], [-0.02, 1.83], [0.47, 1.84], [0.5, 1.3]]],
        headY: 1.0, tailY: 1.0, headW: 0.42, tailW: 0.14, lightH: 0.2, mirror: [-1.2, 1.35], handles: [-0.5, 0.25], bumperY: 0.52,
        extra: (body, parts) => {
            parts.add(BOX, M(0, 1.255, 1.68, 1.78, 0.012, 1.84), '#1a1b1e', { r: 0.9 }); // open bed floor (dark)
            parts.add(BOX, M(0, 1.0, -2.72, 1.2, 0.3, 0.04), C.chrome, { r: 0.2, m: 1 }); // chrome grille
        },
    }),
    van: () => buildCar({ // Dacia Dokker-ish
        L: 4.4, W: 1.8, wr: 0.32, wz: [-1.38, 1.38], belt: 1.08, top: 1.86, taper: 0.06,
        low: [[-2.2, 0.3], [-2.23, 0.64], [-2.04, 0.9], [-1.28, 1.05], [-0.62, 1.84], [2.12, 1.86], [2.2, 1.75], [2.21, 0.3]],
        gh: null,
        ws: [[-1.28, 1.05], [-0.62, 1.84]],
        side: [[[-1.12, 1.12], [-0.64, 1.72], [-0.1, 1.73], [-0.1, 1.12]]],
        headY: 0.76, tailY: 0.95, headW: 0.34, tailW: 0.16, lightH: 0.3, mirror: [-1.12, 1.15], handles: [-0.3, 0.6],
        extra: (body, parts) => {
            parts.add(BOX, M(0, 1.45, 2.215, 1.3, 0.42, 0.02), C.glass, GLASS); // rear windows
            parts.add(BOX, M(0, 1.45, 2.22, 0.04, 0.42, 0.02), C.trim);
            for (const s of [-1, 1]) parts.add(BOX, M(s * 0.905, 1.0, 0.75, 0.01, 0.02, 0.9), C.trim); // sliding door rail
        },
    }),
    taxi: () => {
        const g = KINDS.sedan();
        // checker band along both sides
        const band = new Batch();
        for (const s of [-1, 1]) for (let i = 0; i < 12; i++) band.add(BOX, M(s * 0.885, 0.82 + (i % 2) * 0.05, -1.0 + i * 0.17, 0.012, 0.05, 0.17), i % 2 ? '#111' : '#f4f4f4', { r: 0.5 });
        g.parts = mergeBatches(g.parts, band.build());
        return g;
    },
    police: () => {
        const g = KINDS.sedan();
        const band = new Batch();
        for (const s of [-1, 1]) {
            band.add(BOX, M(s * 0.885, 0.78, 0.0, 0.012, 0.16, 3.6), '#1d4ed8', { r: 0.4 });
            band.add(BOX, M(s * 0.886, 0.72, 0.0, 0.012, 0.03, 3.6), '#facc15', { e: 0.1, r: 0.4 });
        }
        g.parts = mergeBatches(g.parts, band.build());
        return g;
    },
    bus: () => { // Mercedes Citaro-ish, STB blue/white
        const L = 12, W = 2.55, H = 3.1, body = new Batch(), parts = new Batch();
        const low = [[-6.0, 0.32], [-6.06, 1.0], [-5.98, 2.95], [-5.85, H], [5.9, H], [6.0, 2.9], [6.02, 0.32]];
        body.add(extrude(low, -W / 2, W / 2));
        // white upper band + roof
        parts.add(BOX, M(0, 2.82, 0.05, W + 0.02, 0.5, L - 0.25), '#f1f3f5', { r: 0.45 });
        parts.add(BOX, M(0, H + 0.12, 1.5, 1.7, 0.24, 2.6), '#d5d8dc', { r: 0.6 }); // AC unit
        // window band with white pillars
        for (const s of [-1, 1]) {
            parts.add(BOX, M(s * (W / 2 + 0.006), 1.95, 0.2, 0.015, 1.1, L - 1.6), C.glass, GLASS);
            for (let z = -4.8; z <= 5.2; z += 1.55) parts.add(BOX, M(s * (W / 2 + 0.014), 1.95, z, 0.012, 1.12, 0.12), '#eef0f2', { r: 0.4 });
        }
        // doors (right side), dark glass
        for (const z of [-5.0, -0.9, 3.4]) parts.add(BOX, M(W / 2 + 0.016, 1.45, z, 0.012, 2.1, 1.15), '#20262c', { r: 0.1 });
        // windscreen + destination sign
        parts.add(BOX, M(0, 1.85, -6.045, W - 0.15, 1.65, 0.04), C.glass, GLASS);
        parts.add(BOX, M(0, 2.85, -6.0, 1.9, 0.26, 0.05), '#ff9a1a', { e: 0.9, r: 0.3 });
        parts.add(BOX, M(0, 1.6, 6.03, W - 0.4, 1.0, 0.03), C.glass, GLASS);
        wheels(parts, { W, wr: 0.5, wz: [-3.6, 2.4], tw: 0.3 });
        lightPair(parts, -6.06, 0.75, 0.95, 0.4, 0.18, C.head, HEAD);
        lightPair(parts, 6.05, 0.9, 1.05, 0.25, 0.45, C.tail, TAIL);
        parts.add(BOX, M(0, 0.45, -6.07, W, 0.3, 0.1), C.plastic, { r: 0.7 });
        parts.add(BOX, M(0, 0.45, 6.06, W, 0.3, 0.1), C.plastic, { r: 0.7 });
        plate(parts, -6.13, 0.45, -1); plate(parts, 6.12, 0.62, 1);
        for (const s of [-1, 1]) body.add(BOX, M(s * (W / 2 + 0.12), 2.3, -5.9, 0.08, 0.35, 0.12));
        return { body: body.build(false), parts: parts.build(), length: L, width: W };
    },
    tram: () => { // articulated Astra Imperio / V3A-ish (3 sections)
        const L = 28, W = 2.4, H = 3.3, body = new Batch(), parts = new Batch();
        const secs = [[-14, -4], [-3.5, 3.5], [4, 14]];
        secs.forEach(([z0, z1], i) => {
            const nose = (z) => [[z0 + (i === 0 ? 0.35 : 0), 0.45], [z0, 1.1], [z0 + (i === 0 ? 0.35 : 0), H - 0.15], [z0 + (i === 0 ? 0.6 : 0), H], [z1 - (i === 2 ? 0.6 : 0), H], [z1 - (i === 2 ? 0.35 : 0), H - 0.15], [z1, 1.1], [z1 - (i === 2 ? 0.35 : 0), 0.45]];
            body.add(extrude(nose(), -W / 2, W / 2));
            const len = z1 - z0, zc = (z0 + z1) / 2;
            for (const s of [-1, 1]) {
                parts.add(BOX, M(s * (W / 2 + 0.006), 2.05, zc, 0.012, 1.15, len - 1.0), C.glass, GLASS);
                parts.add(BOX, M(s * (W / 2 + 0.008), 0.75, zc, 0.012, 0.18, len - 0.2), '#f2f2f2', { r: 0.5 });
                for (let z = z0 + 1.6; z < z1 - 0.8; z += 1.8) parts.add(BOX, M(s * (W / 2 + 0.014), 2.05, z, 0.012, 1.17, 0.14), '#2a2c30', { r: 0.4 });
            }
            parts.add(BOX, M(0, H + 0.15, zc, 1.6, 0.3, len * 0.55), '#8a8f96', { r: 0.6 }); // roof equipment
            parts.add(BOX, M(0, 0.32, zc, W - 0.3, 0.4, len - 1.4), C.trim, { r: 0.8 }); // bogie skirt
            for (const z of [z0 + 1.5, z1 - 1.5]) for (const s of [-1, 1]) parts.add(TYRE, M(s * 0.8, 0.36, z, 0.15, 0.36, 0.36), '#2b2b2b', TYREM);
        });
        for (const z of [-3.75, 3.75]) parts.add(BOX, M(0, 1.9, z, W - 0.2, 2.7, 0.55), '#1f2023', { r: 0.9 }); // bellows
        // windscreens, sign
        parts.add(BOX, M(0, 2.15, -14.02, W - 0.3, 1.2, 0.04), C.glass, GLASS);
        parts.add(BOX, M(0, 2.15, 14.02, W - 0.3, 1.2, 0.04), C.glass, GLASS);
        parts.add(BOX, M(0, 3.0, -13.95, 1.3, 0.22, 0.05), '#ff9a1a', { e: 0.9, r: 0.3 });
        lightPair(parts, -14.0, 1.0, 0.85, 0.3, 0.15, C.head, HEAD);
        lightPair(parts, 14.0, 1.0, 0.85, 0.3, 0.15, C.tail, TAIL);
        // pantograph on the middle section
        const a = new THREE.Vector3(0, H + 0.3, -0.7), b = new THREE.Vector3(0, H + 1.1, 0.2), c = new THREE.Vector3(0, H + 1.9, -0.5);
        parts.add(BOX, beamM(a, b, 0.05, 0.05), '#333');
        parts.add(BOX, beamM(b, c, 0.05, 0.05), '#333');
        parts.add(BOX, M(0, H + 1.92, -0.5, 1.6, 0.05, 0.08), '#333');
        return { body: body.build(false), parts: parts.build(), length: L, width: W };
    },
    truck: () => { // cab-over + box
        const L = 9, W = 2.45, body = new Batch(), parts = new Batch();
        body.add(extrude([[-4.5, 0.55], [-4.55, 1.2], [-4.45, 2.9], [-4.2, 3.0], [-2.9, 3.0], [-2.9, 0.55]], -W / 2, W / 2));
        parts.add(BOX, M(0, 2.05, 1.4, W + 0.05, 2.9, 6.1), '#e8e9ea', { r: 0.6 }); // box
        parts.add(BOX, M(0, 0.62, 0.3, 1.0, 0.25, 8.4), C.trim, { r: 0.8 }); // chassis
        parts.add(BOX, M(0, 2.15, -4.51, W - 0.2, 0.9, 0.05), C.glass, GLASS);
        for (const s of [-1, 1]) parts.add(BOX, M(s * (W / 2 + 0.006), 2.15, -3.75, 0.012, 0.75, 0.9), C.glass, GLASS);
        parts.add(BOX, M(0, 1.15, -4.56, 1.5, 0.45, 0.04), C.grille, { r: 0.5 });
        wheels(parts, { W, wr: 0.5, wz: [-3.3, 2.0, 3.25], tw: 0.32, arch: false });
        lightPair(parts, -4.57, 0.85, 0.95, 0.35, 0.2, C.head, HEAD);
        lightPair(parts, 4.47, 0.9, 1.0, 0.22, 0.18, C.tail, TAIL);
        parts.add(BOX, M(0, 0.6, -4.6, W, 0.25, 0.1), C.plastic, { r: 0.7 });
        plate(parts, -4.66, 0.6, -1); plate(parts, 4.47, 0.75, 1, true);
        for (const s of [-1, 1]) body.add(BOX, M(s * (W / 2 + 0.15), 2.3, -4.2, 0.06, 0.4, 0.1));
        return { body: body.build(false), parts: parts.build(), length: L, width: W };
    },
};

function mergeBatches(a, b) {
    const out = new Batch();
    for (const g of [a, b]) {
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, m = g.attributes.aMat;
        for (let i = 0; i < p.count; i++) {
            out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.nor.push(n.getX(i), n.getY(i), n.getZ(i));
            out.col.push(c.getX(i), c.getY(i), c.getZ(i)); out.mat.push(m.getX(i), m.getY(i), m.getZ(i));
        }
        for (let i = 0; i < g.index.count; i++) out.idx.push(g.index.getX(i) + out.n);
        out.n += p.count;
    }
    return out.build();
}

const cache = {};
function vehicleGeometry(kind) {
    if (!KINDS[kind]) kind = 'sedan';
    return cache[kind] || (cache[kind] = KINDS[kind]());
}

// ---------------------------------------------------------------------------
//  Materials
// ---------------------------------------------------------------------------
let ENV_MAP = null;
const allMats = new Set();
function track(m) { allMats.add(m); if (ENV_MAP) { m.envMap = ENV_MAP; m.needsUpdate = true; } return m; }

function partsMaterial(emis) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 });
    m.userData.uEmis = { value: emis };
    m.userData.uDirect = { value: 1 }; // scales direct light (cockpit interior: lamps shining through the roof at night)
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uEmis = m.userData.uEmis;
        sh.uniforms.uDirect = m.userData.uDirect;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMat;\nvarying vec3 vMat;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMat;\nuniform float uEmis;\nuniform float uDirect;')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vMat.x * uEmis;');
    };
    m.customProgramCacheKey = () => 'vehicleParts';
    return track(m);
}
/**
 * Cockpit interior material: like partsMaterial, plus a night "cabin glow" (uGlow 0..1): instrument/screen backlight
 * falling off with distance from the dash, a dim cool cabin fill so the interior never goes pitch black, and
 * aMat.x emitters (ambient strips) that only light up with the glow. uOff = mesh origin in cockpit space.
 */
function cockpitMaterial(off = new THREE.Vector3()) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 });
    m.userData.uDirect = { value: 1 };
    m.userData.uGlow = { value: 0 };
    m.userData.uOff = { value: off.clone() };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uDirect = m.userData.uDirect; sh.uniforms.uGlow = m.userData.uGlow; sh.uniforms.uOff = m.userData.uOff;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aMat;\nvarying vec3 vMat;\nvarying vec3 vCab;\nuniform vec3 uOff;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vCab = position + uOff;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMat;\nvarying vec3 vCab;\nuniform float uDirect;\nuniform float uGlow;')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                if (uGlow > 0.0) {
                    vec3 base = max(diffuseColor.rgb, vec3(0.035));
                    float gc = exp(-length((vCab - vec3(-0.3, 1.0, -1.1)) * vec3(1.0, 1.4, 1.0)) * 3.2);  // gauge cluster
                    float gs = exp(-length(vCab - vec3(0.25, 1.0, -1.12)) * 3.6);                        // centre screen
                    float fill = 0.55 + 0.45 * smoothstep(0.5, 1.8, vCab.y);                              // city glow through the glass
                    vec3 glow = vec3(1.0, 0.72, 0.5) * gc * 0.7 + vec3(0.45, 0.65, 1.0) * gs * 0.5 + vec3(0.30, 0.36, 0.5) * 0.12 * fill;
                    totalEmissiveRadiance += (base * glow + diffuseColor.rgb * vMat.x * 2.5) * uGlow;
                }`);
    };
    m.customProgramCacheKey = () => 'cockpitInterior';
    return track(m);
}
const partsMatOff = partsMaterial(1.0);
const partsMatOn = partsMaterial(4.5);
const bodyMats = {};
function bodyMat(color) {
    return bodyMats[color] || (bodyMats[color] = track(new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.3, envMapIntensity: 1.1 })));
}

/** Give every vehicle material (existing and future) an environment map for reflections (call after PMREM). */
export function setVehicleEnvMap(tex, intensity = 1) {
    ENV_MAP = tex;
    for (const m of allMats) { m.envMap = tex; m.envMapIntensity = (m.userData.envScale || 1) * intensity; m.needsUpdate = true; }
}

// taxi sign + police bar (shared)
let taxiSign = null;
function getTaxiSign() {
    if (taxiSign) return taxiSign;
    const tex = signTexture('TAXI', { bg: '#111', fg: '#ffd400', accent: '#ffd400', w: 256, h: 96 });
    const dark = new THREE.MeshBasicMaterial({ color: '#111' });
    const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) });
    taxiSign = { geo: new THREE.BoxGeometry(0.8, 0.24, 0.26), mats: [dark, dark, dark, dark, face, face] };
    return taxiSign;
}
const POLICE_BAR = new Batch().add(BOX, M(0, 0, 0, 1.1, 0.08, 0.26), '#222', { r: 0.5 }).build();
const POLICE_LAMP = new THREE.BoxGeometry(0.4, 0.1, 0.22);

/** Create a vehicle mesh group. forward = -z in local space. */
export function makeVehicle(kind, color) {
    if (kind === 'police') color = '#f4f5f7';
    const g = vehicleGeometry(kind);
    const grp = new THREE.Group();
    const body = new THREE.Mesh(g.body, bodyMat(color));
    body.castShadow = true;
    const parts = new THREE.Mesh(g.parts, partsMatOff);
    body.userData.shared = parts.userData.shared = true;
    grp.add(body, parts);
    if (kind === 'taxi') {
        const s = getTaxiSign();
        const sign = new THREE.Mesh(s.geo, s.mats); sign.userData.shared = true;
        sign.position.set(0, 1.58, 0.35); grp.add(sign);
    }
    if (kind === 'police') {
        const bar = new THREE.Mesh(POLICE_BAR, partsMatOff); bar.position.set(0, 1.5, 0.35); bar.userData.shared = true;
        const mL = new THREE.MeshBasicMaterial({ color: '#1e3a8a' }), mR = new THREE.MeshBasicMaterial({ color: '#1e3a8a' });
        const l = new THREE.Mesh(POLICE_LAMP, mL), r = new THREE.Mesh(POLICE_LAMP, mR);
        l.position.set(-0.3, 0.07, 0); r.position.set(0.3, 0.07, 0); l.userData.shared = r.userData.shared = true;
        bar.add(l, r); grp.add(bar);
        grp.userData.flash = (t) => {
            const ph = (t * 2.2) % 1, a = ph < 0.25 && (ph * 16 | 0) % 2 === 0, b = ph > 0.5 && ph < 0.75 && (ph * 16 | 0) % 2 === 0;
            mL.color.setRGB(a ? 0.4 : 0.03, a ? 0.8 : 0.06, a ? 6 : 0.25);
            mR.color.setRGB(b ? 0.4 : 0.03, b ? 0.8 : 0.06, b ? 6 : 0.25);
        };
    }
    grp.userData.length = g.length; grp.userData.width = g.width; grp.userData.kind = kind;
    grp.userData.setLights = (on) => { parts.material = on ? partsMatOn : partsMatOff; };
    return grp;
}
export const VEHICLE_KINDS = ['sedan', 'hatch', 'suv', 'van', 'taxi', 'bus', 'tram', 'truck', 'police', 'pickup'];
/** triangle count of a kind (for diagnostics) */
export function vehicleTriangles(kind) { const g = vehicleGeometry(kind); return (g.body.index.count + g.parts.index.count) / 3; }

// ============================================================================
//  COCKPIT
// ============================================================================
function gaugeCanvas() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 200;
    return c;
}
function drawGauges(ctx, speedMs, rpm01, fuel01, mph) {
    const W = 512, H = 200;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07090c'); bg.addColorStop(1, '#101419');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const dial = (cx, cy, r, max, step, label, value, redFrom) => {
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        ctx.lineWidth = 3; ctx.strokeStyle = '#2b3440'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
        if (redFrom != null) { ctx.strokeStyle = '#c0262d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r - 3, a0 + (a1 - a0) * redFrom / max, a1); ctx.stroke(); }
        ctx.fillStyle = '#cfd8e3'; ctx.font = '600 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let v = 0; v <= max + 1e-6; v += step / 2) {
            const a = a0 + (a1 - a0) * v / max, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
            ctx.strokeStyle = major ? '#e6edf5' : '#6b7787'; ctx.lineWidth = major ? 2.5 : 1.5;
            const r0 = r - (major ? 14 : 8);
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.stroke();
            if (major) ctx.fillText(String(Math.round(v)), cx + Math.cos(a) * (r - 28), cy + Math.sin(a) * (r - 28));
        }
        ctx.fillStyle = '#7d8a99'; ctx.font = '500 12px system-ui,sans-serif'; ctx.fillText(label, cx, cy + r * 0.45);
        const a = a0 + (a1 - a0) * Math.min(value, max * 1.02) / max;
        ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 4; ctx.shadowColor = '#ff5a2a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1b2129'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    };
    const spd = Math.abs(speedMs) * (mph ? 2.23694 : 3.6);
    dial(110, 104, 88, mph ? 140 : 220, mph ? 20 : 40, mph ? 'MPH' : 'km/h', spd, null);
    dial(402, 104, 88, 8, 1, '×1000 rpm', rpm01 * 8, 6.5);
    // centre: digital speed + fuel
    ctx.textAlign = 'center'; ctx.fillStyle = '#f2f6fa'; ctx.font = '700 44px system-ui,sans-serif'; ctx.fillText(String(Math.round(spd)), 256, 84);
    ctx.fillStyle = '#7d8a99'; ctx.font = '500 13px system-ui,sans-serif'; ctx.fillText(mph ? 'mph' : 'km/h', 256, 116);
    ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(216, 160); ctx.lineTo(296, 160); ctx.stroke();
    ctx.strokeStyle = fuel01 < 0.15 ? '#ff8a1c' : '#5fd38d'; ctx.beginPath(); ctx.moveTo(216, 160); ctx.lineTo(216 + 80 * Math.max(0, Math.min(1, fuel01)), 160); ctx.stroke();
    ctx.fillStyle = '#7d8a99'; ctx.font = '500 11px system-ui,sans-serif'; ctx.fillText('FUEL', 256, 178);
}

/** The cockpit the player sits in. Coordinates in the car rig space (driver eye at (-0.3, 1.36, -0.45), forward -z). */
export function makeCockpit() {
    const g = new THREE.Group();
    g.userData.shared = true;
    const interior = new Batch();
    const DASH = '#16181b', DASH2 = '#1e2024', TRIM = '#303338', SOFT = '#202226', HEAD = '#2f2e2c';
    const DR = { r: 0.85 }, DR2 = { r: 0.7 };
    // ---- windshield frame geometry (shared with wipers + rain shader) ----
    const cowl = new THREE.Vector3(0, 1.05, -1.78), header = new THREE.Vector3(0, 1.76, -1.06);
    const sAxis = new THREE.Vector3().subVectors(header, cowl); const wsLen = sAxis.length(); sAxis.normalize();
    const halfW0 = 0.76, halfW1 = 0.69;
    // ---- dashboard (extruded profile) ----
    interior.add(extrude([[-1.8, 1.0], [-1.8, 1.045], [-1.45, 1.06], [-1.27, 1.04], [-1.22, 0.98], [-1.24, 0.62], [-1.5, 0.5], [-1.8, 0.5]], -0.8, 0.8), IDENT, DASH, DR);
    interior.add(BOX, M(0, 1.063, -1.5, 1.56, 0.01, 0.5), '#15171a', { r: 0.95 }); // matte dash top pad
    interior.add(BOX, M(0, 0.9, -1.215, 1.58, 0.06, 0.03), TRIM, { r: 0.4, m: 0.3 }); // trim strip across dash
    // cluster binnacle (hood over gauges) + air vents
    interior.add(extrude([[-1.25, 0.88], [-1.25, 1.1], [-1.12, 1.1], [-1.12, 0.88]], -0.53, -0.07), IDENT, DASH2, DR);
    interior.add(extrude([[-1.22, 1.095], [-1.22, 1.135], [-1.04, 1.125], [-1.04, 1.105]], -0.55, -0.05), IDENT, DASH2, DR); // binnacle hood
    for (const x of [-0.68, 0.07, 0.43, 0.68]) interior.add(BOX, M(x, 0.97, -1.225, 0.13, 0.06, 0.02), '#0d0e10', { r: 0.6 });
    // centre stack + console
    interior.add(BOX, M(0.25, 0.72, -1.17, 0.34, 0.4, 0.16), DASH2, DR2);
    for (let i = 0; i < 3; i++) interior.add(BOX, M(0.17 + i * 0.08, 0.66, -1.085, 0.05, 0.05, 0.02), '#4a4e55', { r: 0.4, m: 0.4 }); // knobs
    interior.add(BOX, M(0.25, 0.48, -0.5, 0.26, 0.22, 1.2), DASH2, DR2);
    // A-pillars, header, headliner, visors
    for (const s of [-1, 1]) {
        const a = new THREE.Vector3(s * (halfW0 + 0.03), 1.04, -1.79), b = new THREE.Vector3(s * (halfW1 + 0.03), 1.77, -1.05);
        interior.add(BOX, beamM(a, b, 0.06, 0.045), HEAD, { r: 0.9 });
    }
    interior.add(BOX, M(0, 1.79, -0.94, 1.56, 0.06, 0.24), HEAD, { r: 0.95 }); // header
    interior.add(BOX, M(0, 1.83, -0.1, 1.6, 0.04, 1.5), HEAD, { r: 0.95 }); // headliner
    interior.add(BOX, M(-0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 }); // driver visor (stowed)
    interior.add(BOX, M(0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 });
    interior.add(BOX, beamM(new THREE.Vector3(0.04, 1.8, -1.44), new THREE.Vector3(0.04, 1.72, -1.5), 0.025, 0.025), '#1a1b1e'); // stalk to the rear-view mirror (mirror plane lives in player.js)
    // doors (left = driver, right = passenger): panel, belt line trim, armrest, handle, window frame
    for (const s of [-1, 1]) {
        const x = s * 0.8;
        interior.add(extrude([[-1.75, 0.45], [-1.75, 1.0], [-1.6, 1.07], [0.4, 1.07], [0.4, 0.45]], x - 0.03, x + 0.03), IDENT, SOFT, DR);
        interior.add(BOX, M(x - s * 0.035, 1.075, -0.65, 0.05, 0.03, 2.1), TRIM, { r: 0.5, m: 0.2 });
        interior.add(BOX, M(x - s * 0.08, 0.82, -0.35, 0.1, 0.06, 0.6), DASH2, DR2);
        interior.add(BOX, M(x - s * 0.04, 0.95, -0.95, 0.02, 0.04, 0.12), '#8d939a', { r: 0.3, m: 0.8 });
        // window frame top rail (follows roof line)
        interior.add(BOX, beamM(new THREE.Vector3(s * 0.73, 1.78, -1.05), new THREE.Vector3(s * 0.76, 1.8, 0.4), 0.05, 0.05), HEAD, { r: 0.95 });
        // exterior side mirror (painted housing, mirror glass facing back)
        interior.add(BOX, M(s * 1.0, 1.12, -1.6, 0.17, 0.1, 0.09), '#8f1f24', { r: 0.3, m: 0.3 });
        interior.add(BOX, M(s * 1.0, 1.12, -1.553, 0.145, 0.078, 0.006), '#5d6f80', { r: 0.02, m: 1 });
        interior.add(BOX, M(s * 0.88, 1.09, -1.62, 0.1, 0.035, 0.05), '#1a1b1e');
    }
    // cowl panel (between windshield and hood)
    interior.add(BOX, M(0, 1.0, -1.88, 1.7, 0.03, 0.2), '#121315', { r: 0.8 });
    // night ambient strips (emit only with the cabin glow): along the dash trim + door belt lines
    interior.add(BOX, M(0, 0.872, -1.232, 1.5, 0.006, 0.006), '#6fa8ff', { e: 1, r: 0.5 });
    for (const s of [-1, 1]) interior.add(BOX, M(s * 0.762, 1.052, -0.75, 0.004, 0.006, 1.7), '#6fa8ff', { e: 0.7, r: 0.5 });
    // floor, front seats (passenger complete; driver cushion + lower back; the driver's upper back + headrest is a
    // separate mesh hidden while looking back, as if the head turned past it)
    const SEAT = '#26272b', SEAT2 = '#1c1d20', CARPET = '#141518', FAB = { r: 0.95 };
    interior.add(BOX, M(0, 0.43, -0.35, 1.56, 0.03, 2.6), CARPET, FAB);
    const driverBack = new Batch();
    for (const x of [-0.3, 0.36]) {
        interior.add(BOX, M(x, 0.56, -0.3, 0.5, 0.13, 0.52), SEAT, FAB);                       // cushion
        interior.add(BOX, M(x, 0.47, -0.3, 0.42, 0.08, 0.46), SEAT2, FAB);                     // cushion base
        const tgt = x < 0 ? driverBack : interior;
        interior.add(BOX, beamM(new THREE.Vector3(x, 0.6, 0.0), new THREE.Vector3(x, 0.92, 0.06), 0.5, 0.11), SEAT, FAB);  // lower back
        tgt.add(BOX, beamM(new THREE.Vector3(x, 0.92, 0.06), new THREE.Vector3(x, 1.24, 0.13), 0.48, 0.11), SEAT, FAB);    // upper back
        tgt.add(BOX, M(x, 1.37, 0.15, 0.26, 0.18, 0.09, -0.12), SEAT2, FAB);                   // headrest
        for (const dx of [-0.07, 0.07]) tgt.add(BOX, M(x + dx, 1.27, 0.14, 0.012, 0.08, 0.012), '#8d939a', { r: 0.3, m: 0.8 });
    }
    interior.add(BOX, M(0.25, 0.62, 0.14, 0.2, 0.08, 0.26), DASH2, DR2); // console armrest
    const interiorMat = cockpitMaterial();
    const interiorMesh = new THREE.Mesh(interior.build(), interiorMat);
    interiorMesh.receiveShadow = true; g.add(interiorMesh);
    const driverBackMesh = new THREE.Mesh(driverBack.build(), interiorMat);
    driverBackMesh.receiveShadow = true; g.add(driverBackMesh);
    g.userData.driverSeatBack = driverBackMesh;

    // ---- rear cabin (seen when looking back / around). Layer 1 only: the main camera renders it, the rear-view
    //      mirror camera (layer 0) does not, so it never blocks the mirror's view through the rear window. ----
    const rear = new Batch();
    // rear bench: cushion, back, outer headrests, centre armrest seam
    rear.add(BOX, M(0, 0.57, 0.92, 1.42, 0.14, 0.52), SEAT, FAB);
    rear.add(BOX, M(0, 0.47, 0.92, 1.38, 0.08, 0.48), SEAT2, FAB);
    rear.add(BOX, beamM(new THREE.Vector3(0, 0.62, 1.22), new THREE.Vector3(0, 1.16, 1.38), 1.44, 0.13), SEAT, FAB);
    for (const x of [-0.24, 0.24]) rear.add(BOX, beamM(new THREE.Vector3(x, 0.66, 1.17), new THREE.Vector3(x, 1.12, 1.31), 0.012, 0.02), SEAT2, FAB);
    for (const x of [-0.45, 0.45]) {
        rear.add(BOX, M(x, 1.27, 1.41, 0.26, 0.15, 0.08, -0.2), SEAT2, FAB);
        for (const dx of [-0.07, 0.07]) rear.add(BOX, M(x + dx, 1.18, 1.38, 0.012, 0.07, 0.012), '#8d939a', { r: 0.3, m: 0.8 });
    }
    // parcel shelf + rear window frame (no glass: the mirror and the player look straight through)
    const rwTop = [1.17, 1.80], rwBot = [1.76, 1.15];
    rear.add(BOX, M(0, 1.135, 1.58, 1.46, 0.03, 0.4), '#18191c', FAB);
    rear.add(BOX, M(0, rwTop[1], rwTop[0], 1.4, 0.06, 0.07), HEAD, { r: 0.95 });
    rear.add(BOX, M(0, rwBot[1] + 0.02, rwBot[0], 1.42, 0.05, 0.06), '#141518', FAB);
    for (const s of [-1, 1]) {
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.66, rwTop[1], rwTop[0]), new THREE.Vector3(s * 0.7, rwBot[1], rwBot[0]), 0.05, 0.05), '#141518', FAB);
        // B-pillar (trim, beltline → roof)
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.77, 1.06, 0.47), new THREE.Vector3(s * 0.74, 1.81, 0.43), 0.06, 0.15), HEAD, { r: 0.9 });
        rear.add(BOX, M(s * 0.735, 1.62, 0.44, 0.012, 0.05, 0.04), '#3a3b3e', { r: 0.6 }); // belt anchor
        // C-pillar trim panel between the rear door window and the rear glass
        rear.add(extrude([[0.98, 1.79], [rwTop[0], rwTop[1]], [rwBot[0], rwBot[1]], [1.74, 1.07], [1.22, 1.07]], s > 0 ? 0.70 : -0.78, s > 0 ? 0.78 : -0.70), IDENT, HEAD, { r: 0.92 });
        // rear door: panel, belt trim, armrest, handle, window frame (open, like the front windows)
        rear.add(extrude([[0.42, 0.45], [0.42, 1.07], [1.3, 1.07], [1.3, 0.45]], s * 0.8 - 0.03, s * 0.8 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.765, 1.075, 0.86, 0.05, 0.03, 0.86), TRIM, { r: 0.5, m: 0.2 });
        rear.add(BOX, M(s * 0.72, 0.8, 0.95, 0.1, 0.06, 0.5), DASH2, DR2);
        rear.add(BOX, M(s * 0.76, 0.95, 0.6, 0.02, 0.04, 0.1), '#8d939a', { r: 0.3, m: 0.8 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.76, 1.8, 0.4), new THREE.Vector3(s * 0.74, 1.79, 1.0), 0.05, 0.05), HEAD, { r: 0.95 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.775, 1.07, 1.22), new THREE.Vector3(s * 0.755, 1.79, 0.98), 0.045, 0.04), HEAD, { r: 0.95 });
        // rear quarter panel beside the bench, wheel-arch hump
        rear.add(extrude([[1.3, 0.45], [1.3, 1.07], [1.74, 1.07], [1.86, 0.9], [1.86, 0.45]], s * 0.79 - 0.03, s * 0.79 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.7, 0.62, 1.3, 0.14, 0.2, 0.5), SOFT, DR);
    }
    // roof headliner over the rear cabin + dome light
    rear.add(BOX, M(0, 1.83, 0.93, 1.5, 0.04, 0.58), HEAD, { r: 0.95 });
    rear.add(BOX, M(0, 1.806, 0.55, 0.18, 0.012, 0.08), '#d9d6cf', { e: 0.25, r: 0.6 });
    rear.add(BOX, M(0, 0.43, 0.95, 1.56, 0.03, 1.1), CARPET, FAB); // rear floor
    rear.add(BOX, M(0, 0.5, 0.35, 0.3, 0.12, 0.5), DASH2, DR2);       // tunnel / rear console end
    const rearMesh = new THREE.Mesh(rear.build(), interiorMat);
    rearMesh.layers.set(1); rearMesh.receiveShadow = true; g.add(rearMesh);
    g.userData.rearCabin = rearMesh;

    // ---- hood (painted, tapered toward the nose) ----
    const hoodGeo = extrude([[-1.86, 1.0], [-3.3, 0.88], [-3.42, 0.8], [-3.4, 0.6], [-1.86, 0.6]], -0.87, 0.87, (x, y, z) => 1 - 0.12 * THREE.MathUtils.clamp((-z - 1.86) / 1.5, 0, 1));
    const hood = new THREE.Mesh(hoodGeo, track(new THREE.MeshStandardMaterial({ color: '#b3262b', roughness: 0.34, metalness: 0.3 })));
    hood.material.userData.envScale = 0.55; hood.receiveShadow = true; g.add(hood);
    g.userData.hood = hood;
    // trunk lid behind the rear window (main camera only, like the rear cabin)
    const trunk = new THREE.Mesh(extrude([[1.74, 1.12], [2.25, 1.04], [2.36, 0.92], [2.36, 0.6], [1.74, 0.6]], -0.82, 0.82), hood.material);
    trunk.layers.set(1); trunk.receiveShadow = true; g.add(trunk);

    // ---- shadow proxy (lower body + roof + pillars): casts the car's shadow, never drawn ----
    const proxyB = new Batch();
    proxyB.add(BOX, M(0, 0.62, -0.2, 1.78, 0.66, 4.4));
    proxyB.add(BOX, M(0, 1.8, 0.05, 1.5, 0.06, 2.4)); // roof incl. the rear cabin
    for (const s of [-1, 1]) proxyB.add(BOX, beamM(new THREE.Vector3(s * 0.79, 1.05, -1.79), new THREE.Vector3(s * 0.72, 1.76, -1.14), 0.08, 0.08));
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.78, 1.4, 0.45, 0.06, 0.75, 0.15));  // B-pillars
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.76, 1.4, 1.35, 0.06, 0.72, 0.5));   // C-pillars
    const proxy = new THREE.Mesh(proxyB.build(false), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.castShadow = true; proxy.renderOrder = -10; g.add(proxy);

    // ---- steering wheel ----
    const wb = new Batch();
    wb.add(new THREE.TorusGeometry(0.185, 0.019, 7, 26), IDENT, '#151619', { r: 0.65 });
    wb.add(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), M(0, 0, 0.012, 1, 1, 1, Math.PI / 2), '#1d1f22', { r: 0.7 });
    wb.add(BOX, M(0, -0.005, 0.04, 0.09, 0.07, 0.012), '#25282c', { r: 0.6 }); // airbag pad (logo-less)
    for (const a of [0, Math.PI, -Math.PI / 2]) {
        const r = 0.12, l = 0.13;
        wb.add(BOX, M(Math.cos(a) * r, Math.sin(a) * r * (a === -Math.PI / 2 ? 0.95 : 1) - (a === -Math.PI / 2 ? 0 : 0.02), 0.01, a === -Math.PI / 2 ? 0.05 : l, a === -Math.PI / 2 ? l : 0.05, 0.02), '#1d1f22', { r: 0.6 });
    }
    wb.add(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8), M(0, 0, -0.17, 1, 1, 1, Math.PI / 2), '#141517', { r: 0.8 }); // column
    const wheel = new THREE.Group();
    const wheelMat = cockpitMaterial(new THREE.Vector3(-0.3, 0.99, -0.9));
    const wheelMesh = new THREE.Mesh(wb.build(), wheelMat);
    wheel.add(wheelMesh);
    wheel.position.set(-0.3, 0.99, -0.9); wheel.rotation.x = -0.42;
    g.add(wheel);
    g.userData.wheel = wheel;

    // ---- instrument cluster (canvas texture) ----
    const gc = gaugeCanvas(), gctx = gc.getContext('2d');
    const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 4;
    drawGauges(gctx, 0, 0.1, 0.72, false);
    const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.172), new THREE.MeshBasicMaterial({ map: gtex, toneMapped: false }));
    cluster.position.set(-0.3, 0.995, -1.113);
    g.add(cluster);
    let last = { s: -1, r: -1, f: -1, u: null }, lastT = 0;
    g.userData.updateGauges = (speedMs, rpm01 = 0.1, fuel01 = 0.7, mph = false) => {
        const now = performance.now();
        const s = Math.round(Math.abs(speedMs) * 3.6), r = Math.round(rpm01 * 80), f = Math.round(fuel01 * 50);
        if (s === last.s && r === last.r && f === last.f && mph === last.u) return;
        if (now - lastT < 66) return; // ≤ 15 Hz uploads
        lastT = now; last = { s, r, f, u: mph };
        drawGauges(gctx, speedMs, rpm01, fuel01, mph); gtex.needsUpdate = true;
    };

    // ---- centre console screen (navigation map is assigned by another module) ----
    const sc = document.createElement('canvas'); sc.width = 64; sc.height = 40;
    const sctx = sc.getContext('2d'); const sg = sctx.createLinearGradient(0, 0, 0, 40); sg.addColorStop(0, '#0d1520'); sg.addColorStop(1, '#05080c');
    sctx.fillStyle = sg; sctx.fillRect(0, 0, 64, 40);
    const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: stex, color: '#ffffff', toneMapped: false }));
    screen.position.set(0.25, 1.0, -1.15); screen.rotation.set(-0.24, -0.32, 0, 'YXZ');
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.29, 0.02), new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.25, metalness: 0.2 }));
    bezel.position.z = -0.012; screen.add(bezel);
    g.add(screen);
    g.userData.screen = screen;

    // ---- wipers (in the windshield plane) ----
    // plane basis: u = +x, s = up the glass, n = cross(u, s) (points into the cabin)
    const nIn = new THREE.Vector3(1, 0, 0).cross(sAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), sAxis, nIn);
    const wiperDefs = [{ px: -0.55, ps: 0.03, len: 0.72 }, { px: 0.12, ps: 0.03, len: 0.66 }];
    const wiperMat = new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.6, metalness: 0.3 });
    const wipers = wiperDefs.map((d) => {
        const base = new THREE.Group();
        base.position.copy(cowl).addScaledVector(new THREE.Vector3(1, 0, 0), d.px).addScaledVector(sAxis, d.ps).addScaledVector(nIn, -0.025);
        base.quaternion.setFromRotationMatrix(basis);
        const arm = new THREE.Group(); base.add(arm);
        const ab = new Batch();
        ab.add(BOX, M(d.len * 0.5, 0, 0, d.len, 0.014, 0.012));
        ab.add(BOX, M(d.len * 0.55, 0.012, -0.008, d.len * 0.86, 0.02, 0.014));
        ab.add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), M(0, 0, 0, 1, 1, 1, Math.PI / 2));
        const mesh = new THREE.Mesh(ab.build(false), wiperMat);
        arm.add(mesh); g.add(base);
        return { ...d, base, arm };
    });
    // wiper timing (shared with the windshield rain shader): linear sweep up, linear back, pause
    const W_A0 = 0.04, W_A1 = 1.72, W_SWEEP = 0.42, W_PERIOD = 1.7;
    const ws = { on: false, t: 0, rainT: 0, a0: W_A0, a1: W_A1, sweep: W_SWEEP, period: W_PERIOD };
    const angleAt = (ct) => {
        if (ct < W_SWEEP) return W_A0 + (W_A1 - W_A0) * (ct / W_SWEEP);
        if (ct < 2 * W_SWEEP) return W_A1 - (W_A1 - W_A0) * ((ct - W_SWEEP) / W_SWEEP);
        return W_A0;
    };
    let parking = false;
    g.userData.setRain = (on) => { if (on && !ws.on) { ws.t = 0; ws.rainT = 0; } ws.on = !!on; parking = !on; };
    g.userData.tick = (dt) => {
        if (ws.on) { ws.t = (ws.t + dt) % W_PERIOD; ws.rainT += dt; }
        else if (parking) { // finish the current sweep, then park
            if (ws.t > 0 && ws.t < 2 * W_SWEEP) ws.t = Math.min(2 * W_SWEEP, ws.t + dt); else parking = false;
        }
        const a = angleAt(ws.t);
        for (const w of wipers) w.arm.rotation.z = a;
    };
    g.userData.tick(0);
    g.userData.wiperState = ws;
    /** scale direct lighting on the interior (1 = day; ~0.3 at night so street lamps don't light the cabin through the roof) */
    g.userData.setInteriorLight = (k) => { interiorMat.userData.uDirect.value = wheelMat.userData.uDirect.value = k; };
    /** night cabin glow 0..1 (instrument + screen backlight, dim cabin fill, ambient strips) */
    g.userData.setNightGlow = (k) => { interiorMat.userData.uGlow.value = wheelMat.userData.uGlow.value = k; };

    // ---- headlights: two warm spot lights + emissive lamp boxes. Hidden (zero cost) until switched on. ----
    const lampMat = new THREE.MeshStandardMaterial({ color: '#cfd5db', emissive: '#fff0d2', emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 });
    const spots = [];
    for (const s of [-1, 1]) {
        const lamp = new THREE.Mesh(BOX, lampMat); lamp.scale.set(0.34, 0.11, 0.06); lamp.position.set(s * 0.6, 0.73, -3.4); g.add(lamp);
        const sp = new THREE.SpotLight('#ffe6bf', 0, 60, 0.42, 0.55, 1.5);
        sp.position.set(s * 0.6, 0.75, -3.45); sp.target.position.set(s * 0.9, 0, -26);
        sp.visible = false; sp.castShadow = false; sp.userData.shared = true; // no spot shadow (cost + shimmer)
        g.add(sp, sp.target); spots.push(sp);
    }
    g.userData.headlights = {
        spots, on: false,
        /** on/off; intensity in candela (physically based lights) */
        setOn(on, intensity = 140) {
            this.on = !!on;
            for (const sp of spots) { sp.visible = this.on; sp.intensity = this.on ? intensity : 0; }
            lampMat.emissiveIntensity = this.on ? 5 : 0;
        },
    };
    g.userData.windshield = { origin: cowl.clone(), u: new THREE.Vector3(1, 0, 0), s: sAxis.clone(), len: wsLen, halfW0, halfW1, wipers: wiperDefs };
    return g;
}
