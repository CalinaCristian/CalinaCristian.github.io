// Vehicle geometry builders (split from vehicles.js, spec 22): extruded side profiles of every kind (cars, vans,
// trucks, police, taxi, buses, trolleybuses, trams) with per-vertex aMat = (emissive code, roughness, metalness, painted),
// plus the far / parked LOD boxes. forward = -z, ground at y = 0. vehicles.js keeps the public API.
import * as THREE from '../vendor/three.module.min.js';

export const CAR_COLORS = ['#c9ccd1', '#f5f5f5', '#1f2937', '#9ca3af', '#7f1d1d', '#1e3a8a', '#374151', '#b91c1c', '#e5e7eb', '#0f172a', '#4b5563', '#065f46', '#d1d5db', '#78350f'];

export const BOX = new THREE.BoxGeometry(1, 1, 1);
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
export const IDENT = new THREE.Matrix4();

// ---------------------------------------------------------------------------
//  Batch builder with per-vertex material params
// ---------------------------------------------------------------------------
export class Batch {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.mat = []; this.idx = []; this.n = 0; }
    /** opts: e = emissive, r = roughness, m = metalness, p = painted (takes the vehicle's body colour) */
    add(geo, matrix = IDENT, color = '#ffffff', { e = 0, r = 0.6, m = 0, p = 0 } = {}) {
        const pa = geo.attributes.position, nr = geo.attributes.normal;
        const nm = new THREE.Matrix3().getNormalMatrix(matrix);
        const c = color instanceof THREE.Color ? color : new THREE.Color(color);
        for (let i = 0; i < pa.count; i++) {
            _v.fromBufferAttribute(pa, i).applyMatrix4(matrix); this.pos.push(_v.x, _v.y, _v.z);
            _n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); this.nor.push(_n.x, _n.y, _n.z);
            this.col.push(c.r, c.g, c.b); this.mat.push(e, r, m, p);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(geo.index.getX(i) + this.n);
        else for (let i = 0; i < pa.count; i++) this.idx.push(i + this.n);
        this.n += pa.count;
        return this;
    }
    build(withMat = true) {
        // repair degenerate normals (zero-area slivers from clipped / extruded profiles give 0-length normals → NaN after
        // normalize() in the shader → NaN pixels that the bloom pass smears into a full-screen grey veil)
        for (let i = 0; i < this.nor.length; i += 3) {
            const l = Math.hypot(this.nor[i], this.nor[i + 1], this.nor[i + 2]);
            if (!(l > 1e-6)) { this.nor[i] = 0; this.nor[i + 1] = 1; this.nor[i + 2] = 0; }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        if (withMat) g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 4));
        g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere(); g.computeBoundingBox();
        return g;
    }
}

/** Extrude a side profile [[z,y],...] across x from x0 to x1. taper(x,y,z) => x scale (optional). Flat-shaded. */
export function extrude(points, x0, x1, taper = null) {
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
    if (!Number.isFinite(best)) best = side < 0 ? Math.min(...points.map(p => p[0])) : Math.max(...points.map(p => p[0])); // y outside the profile
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
export function beamM(a, b, w, h) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(w, h, len));
}

// ---------------------------------------------------------------------------
//  Shared geometries + palette
// ---------------------------------------------------------------------------
const TYRE = new THREE.CylinderGeometry(1, 1, 1, 14, 1); TYRE.rotateZ(Math.PI / 2);
const RIM = new THREE.CylinderGeometry(1, 1, 1, 10, 1); RIM.rotateZ(Math.PI / 2);
const HUB = new THREE.CylinderGeometry(1, 1, 1, 6, 1); HUB.rotateZ(Math.PI / 2);
const ARCH = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true, -Math.PI / 2, Math.PI); ARCH.rotateZ(Math.PI / 2);
const POLE = new THREE.CylinderGeometry(1, 1, 1, 5, 1);

const C = {
    glass: '#1b242c', glassDark: '#11171c', tyre: '#141517', rim: '#a3a8ae', rimDark: '#3a3d42', trim: '#18191c', plastic: '#232529', head: '#f4f1e6',
    drl: '#fffaf0', tail: '#b0121a', tailDark: '#5a0a0e', amber: '#ff8a1c', reverse: '#e8e8e8', chrome: '#c9ced4', grille: '#0d0e10',
    plate: '#f2f2f2', euBlue: '#1f3d99', plateText: '#2a2d33', waText: '#26407a', seal: '#0b0c0e',
};
// aMat = (emissive, roughness, metalness, paint). Emissive codes: < 10 = plain (headlights/markers, ×light),
// 10..19 = tail lamp (base e − 10; brighter when braking), 20..29 = always-lit sign (base e − 20, not affected by lights)
const GLASS = { r: 0.04, m: 0.6 }, HEAD = { e: 0.5, r: 0.12 }, DRL = { e: 0.8, r: 0.2 }, TAIL = { e: 10.42, r: 0.18 }, TYREM = { r: 0.92 }, RIMM = { r: 0.32, m: 0.85 };
const PAINT = { r: 0.32, m: 0.3, p: 1 }, PAINT_MATTE = { r: 0.5, m: 0.15, p: 1 };
const SIGN = (e = 0.9) => ({ e: 20 + e, r: 0.3 });

function wheels(b, { W, wr, wz, tw = 0.22, inset = 0.04, arch = true, rim = C.rim, archPaint = false, archLip = 0.07 }) {
    for (const z of wz) for (const s of [-1, 1]) {
        const x = s * (W / 2 - tw / 2 - inset);
        b.add(TYRE, M(x, wr, z, tw, wr, wr), C.tyre, TYREM);
        b.add(RIM, M(x + s * 0.014, wr, z, tw * 0.9, wr * 0.64, wr * 0.64), rim, RIMM);
        b.add(HUB, M(x + s * 0.03, wr, z, tw * 0.9, wr * 0.2, wr * 0.2), C.rimDark, { r: 0.5, m: 0.6 });
        if (arch) {
            b.add(ARCH, M(s * (W / 2 - 0.12), wr, z, 0.22, wr + 0.065, wr + 0.065), C.seal, { r: 0.95 }); // dark wheel-well liner
            if (archLip > 0.08) b.add(ARCH, M(s * (W / 2 + 0.005), wr, z, 0.03, wr + archLip, wr + archLip), archPaint ? '#ffffff' : C.plastic, archPaint ? PAINT : { r: 0.75 }); // cladding lip (SUVs)
        }
    }
}
function lightPair(b, z, y, x, w, h, color, opts, dz = 0.08) {
    for (const s of [-1, 1]) b.add(BOX, M(s * x, y, z, w, h, dz), color, opts);
}
/** number plate: 'eu' = 520×110 mm, blue strip; 'us' = 305×152 mm (Washington: white, dark-blue characters) */
function plate(b, z, y, dir, style = 'eu', yellow = false) {
    if (style === 'us') {
        b.add(BOX, M(0, y, z, 0.31, 0.155, 0.02), C.plate, { r: 0.45 });
        b.add(BOX, M(0, y - 0.01, z + dir * 0.006, 0.24, 0.06, 0.012), C.waText, { r: 0.5 });
        b.add(BOX, M(0, y + 0.058, z + dir * 0.006, 0.2, 0.012, 0.012), '#8aa0c8', { r: 0.5 });
        return;
    }
    b.add(BOX, M(0, y, z, 0.52, 0.115, 0.02), yellow ? '#f4e9b8' : C.plate, { r: 0.45 });
    b.add(BOX, M(-0.235 * dir, y, z + dir * 0.004, 0.05, 0.115, 0.02), C.euBlue, { r: 0.45 }); // blue strip on the viewer's left
    b.add(BOX, M(0.025 * dir, y, z + dir * 0.006, 0.4, 0.065, 0.012), C.plateText, { r: 0.5 }); // characters (unreadable at game distance)
}

const CH_Z = 0.6;
/** clip a side profile [[z,y]] into the parts z ≤ zA, zA..zB, z ≥ zB (Sutherland–Hodgman on half-planes) */
function clipZ(poly, z0, keepBelow) {
    const out = [], inside = (p) => (keepBelow ? p[0] <= z0 : p[0] >= z0);
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length], ia = inside(a), ic = inside(c);
        if (ia) out.push(a);
        if (ia !== ic) { const t = (z0 - a[0]) / (c[0] - a[0]); out.push([z0, a[1] + (c[1] - a[1]) * t]); }
    }
    return out;
}
function planPieces(poly, zA, zB) {
    const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; s += a[0] * c[1] - c[0] * a[1]; } return Math.abs(s / 2); };
    return [clipZ(poly, zA, true), clipZ(clipZ(poly, zA, false), zB, true), clipZ(poly, zB, false)].filter(p => p.length >= 3 && area(p) > 1e-4);
}
// ---------------------------------------------------------------------------
//  Passenger-car builder from side profiles (near LOD, ≤ ~1.8k triangles)
// ---------------------------------------------------------------------------
/**
 * o: { L, W, H, wr, wz, low (lower-body side profile [[z,y]]), gh (greenhouse profile) or null, belt, top, taper (greenhouse
 *      tumblehome), chamfer (plan-view corner rounding, m), ws/rw windshield / rear window segments, side: side windows,
 *      pillars: [z, ...] dark pillar z (B/C) between side windows, headY, tailY, headW, tailW, lightH, handles, seams, mirror,
 *      plate: 'eu'|'us', bumperY, extra(b), roofRails, wheel/rim options }
 */
function buildCar(o) {
    const b = new Batch();
    const { L, W, belt, top } = o;
    const gW = o.gW || W - 0.08;
    const ch = o.chamfer ?? 0.09;
    const zf = profileZ(o.low, belt - 0.05, -1), zr = profileZ(o.low, belt - 0.05, 1);
    // plan-view rounding: the body narrows linearly over the last CH_Z m toward both bumpers. The side profile is cut at
    // the two zone boundaries and each piece extruded on its own, so every side panel stays planar (no creases)
    const zA = -L / 2 + CH_Z, zB = L / 2 - CH_Z, k = ch / (W / 2);
    const plan = (x, y, z) => 1 - k * THREE.MathUtils.clamp(Math.max((zA - z) / CH_Z, (z - zB) / CH_Z), 0, 1);
    const taper = (x, y, z) => (1 - o.taper * THREE.MathUtils.clamp((y - belt) / (top - belt), 0, 1)) * plan(x, y, z);
    // wheel-arch cut-outs along the bottom edge of the side profile (closing edge = rear bottom → front bottom)
    const low = o.low.slice(), yb = Math.min(low[0][1], low[low.length - 1][1]), ra = o.wr + 0.075;
    for (const wz of [...o.wz].sort((p, q) => q - p)) {
        const t0 = Math.asin(THREE.MathUtils.clamp((yb - o.wr) / ra, -1, 1));
        for (let i = 0; i <= 8; i++) { const t = t0 + (Math.PI - 2 * t0) * i / 8; low.push([wz + ra * Math.cos(t), o.wr + ra * Math.sin(t)]); }
    }
    for (const piece of planPieces(low, zA, zB)) b.add(extrude(piece, -W / 2, W / 2, plan), IDENT, '#ffffff', PAINT);
    if (o.gh) { // greenhouse sunk into the lower body (no coplanar faces at the belt line)
        const g = o.gh, f = g[0], r = g[g.length - 1];
        for (const piece of planPieces([...g, [r[0], r[1] - 0.08], [f[0], f[1] - 0.08]], zA, zB)) b.add(extrude(piece, -gW / 2, gW / 2, taper), IDENT, '#ffffff', PAINT);
    }
    // glass (tinted, glossy)
    const gx = gW / 2 - 0.055;
    if (o.ws) b.add(extrude(glassStrip(o.ws[0], o.ws[1]), -gx, gx, taper), IDENT, C.glass, GLASS);
    if (o.rw) b.add(extrude(glassStrip(o.rw[0], o.rw[1]), -gx, gx, taper), IDENT, o.rearTint || C.glassDark, GLASS);
    for (const poly of o.side || []) {
        b.add(extrude(poly, gW / 2 - 0.008, gW / 2 + 0.012, taper), IDENT, poly.tint || C.glass, GLASS);
        b.add(extrude(poly, -gW / 2 - 0.012, -gW / 2 + 0.008, taper), IDENT, poly.tint || C.glass, GLASS);
    }
    // black B/C pillar appliqués between the side windows
    for (const pz of o.pillars || []) for (const s of [-1, 1]) {
        const yb = belt + 0.04, yt = top - 0.1;
        const t = (y) => (1 - o.taper * THREE.MathUtils.clamp((y - belt) / (top - belt), 0, 1));
        b.add(BOX, beamM(new THREE.Vector3(s * (gW / 2 * t(yb) + 0.012), yb, pz), new THREE.Vector3(s * (gW / 2 * t(yt) + 0.012), yt, pz + (o.pillarLean || 0)), 0.012, 0.09), C.seal, { r: 0.25, m: 0.2 });
    }
    wheels(b, { ...o, W: W * plan(0, 0, o.wz[0]) });
    // lights: headlamp cluster (lens + DRL strip + indicator), wrap-around tail lamps
    const hy = o.headY, ty = o.tailY;
    const fz = profileZ(o.low, hy, -1), rz = profileZ(o.low, ty, 1);
    const lh = o.lightH || 0.13, hw = o.headW || 0.36, tw = o.tailW || 0.32;
    const xF = W / 2 * plan(0, 0, fz + 0.05) - hw / 2 - 0.05, xR = W / 2 * plan(0, 0, rz - 0.05) - tw / 2 - 0.04;
    lightPair(b, fz + 0.035, hy, xF, hw, lh, C.head, HEAD, 0.1);
    lightPair(b, fz + 0.02, hy - lh / 2 + 0.012, xF, hw * 0.8, 0.022, C.drl, DRL, 0.1);
    lightPair(b, fz + 0.04, hy + lh / 2 - 0.02, xF + hw / 2 - 0.05, 0.08, 0.035, C.amber, { e: 0.08, r: 0.3 }, 0.1);
    lightPair(b, rz - 0.035, ty, xR, tw, lh + 0.03, C.tail, TAIL, 0.1);
    lightPair(b, rz - 0.03, ty - 0.035, xR - tw * 0.2, tw * 0.35, 0.04, C.reverse, { e: 0.05, r: 0.2 }, 0.1);
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 * plan(0, 0, rz - 0.14) - 0.01), ty, rz - 0.14, 0.03, lh + 0.02, 0.2), C.tail, TAIL); // side wrap
    if (o.lightBar) b.add(BOX, M(0, ty + 0.02, rz - 0.03, W - 2 * tw - 0.1, 0.03, 0.08), C.tail, TAIL);         // full-width rear light bar
    if (o.cHMSL !== false && o.rw) { const p = o.rw[0]; b.add(BOX, M(0, p[1] - 0.04, p[0] + 0.04, 0.28, 0.025, 0.03), C.tail, TAIL); } // high brake light
    // grille, bumpers (body colour with dark lower intake), plates
    const gz = profileZ(o.low, hy - 0.02, -1);
    if (o.grille !== false) b.add(BOX, M(0, hy - 0.03, gz + 0.025, W - 2 * hw - 0.32, lh * (o.grilleH || 0.85), 0.05), C.grille, { r: 0.45, m: 0.2 });
    if (o.chromeGrille) b.add(BOX, M(0, hy - 0.03, gz + 0.01, W - 2 * hw - 0.25, lh * 1.4, 0.04), C.chrome, { r: 0.15, m: 1 });
    const by = o.bumperY || 0.38;
    const fbz = profileZ(o.low, by, -1), rbz = profileZ(o.low, by, 1);
    b.add(BOX, M(0, by - 0.1, fbz + 0.03, (W - 0.1) * plan(0, 0, fbz), 0.12, 0.1), C.plastic, { r: 0.7 });  // front lower intake / splitter
    b.add(BOX, M(0, by - 0.1, rbz - 0.03, (W - 0.1) * plan(0, 0, rbz), 0.1, 0.1), C.plastic, { r: 0.7 });  // rear diffuser
    const pS = o.plate || 'eu';
    plate(b, profileZ(o.low, by + 0.08, -1) - 0.012, by + 0.08, -1, pS);
    plate(b, profileZ(o.low, (by + ty) / 2, 1) + 0.012, (by + ty) / 2 - (pS === 'us' ? 0.02 : 0), 1, pS);
    // sills, door seams, handles
    const z0 = o.wz[0] + o.wr * 1.15, z1 = o.wz[1] - o.wr * 1.15;
    // (2026-11-08, owner: "some cars are broken") the sill sits on the body's lower edge: at 0.78 × wheel radius it hung
    // below a high body (SUV: 0.42 m) as a loose bar across the wheels
    const sillY = Math.max(o.wr * 0.78, Math.min(...o.low.map(q => q[1])) + 0.04);
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.004), sillY, (z0 + z1) / 2, 0.03, 0.1, z1 - z0), C.plastic, { r: 0.75 });
    for (const z of o.seams || []) for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.003), (o.wr * 0.9 + belt) / 2, z, 0.008, belt - o.wr * 0.9, 0.008), C.seal, { r: 0.6 });
    if (o.handles) for (const z of o.handles) for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.012), belt - 0.07, z, 0.03, 0.03, 0.15), o.handleColor || '#ffffff', o.handleColor ? { r: 0.3, m: 0.6 } : PAINT);
    // side mirrors: body-coloured housing + dark arm + glass
    if (o.mirror) for (const s of [-1, 1]) {
        b.add(BOX, M(s * (gW / 2 + 0.13), o.mirror[1] + 0.05, o.mirror[0], 0.2, 0.12, 0.1), '#ffffff', PAINT);
        b.add(BOX, M(s * (gW / 2 + 0.03), o.mirror[1], o.mirror[0] - 0.02, 0.08, 0.06, 0.16), C.seal, { r: 0.5 });
        b.add(BOX, M(s * (gW / 2 + 0.13), o.mirror[1] + 0.05, o.mirror[0] + 0.051, 0.17, 0.09, 0.005), C.chrome, { r: 0.05, m: 1 });
    }
    if (o.roofRails) for (const s of [-1, 1]) b.add(BOX, M(s * (gW / 2 * (1 - o.taper) - 0.06), top + 0.03, (o.roofRails[0] + o.roofRails[1]) / 2, 0.04, 0.05, o.roofRails[1] - o.roofRails[0]), C.trim, { r: 0.35, m: 0.5 });
    if (o.antenna) b.add(BOX, M(0, top + 0.03, o.antenna, 0.05, 0.06, 0.14), C.trim, { r: 0.4 }); // shark fin
    if (o.extra) o.extra(b, o);
    const g = b.build();
    return { geo: g, length: L, width: W, height: o.H || top, far: farCar(o, plan), parked: parkedCar(o) };
}

const TYRE8 = new THREE.CylinderGeometry(1, 1, 1, 8, 1); TYRE8.rotateZ(Math.PI / 2);
/** parked-car model (~250–300 triangles): real side profile + greenhouse, glass, 4 tyres, lamps; no interior, no underside
 *  detail, no seams / handles / plates — for static lots seen from the street (world `makeParkedCars`) */
function parkedCar(o) {
    const b = new Batch();
    const { W, belt, top } = o, gW = o.gW || W - 0.08;
    b.add(extrude(o.low, -W / 2, W / 2), IDENT, '#ffffff', PAINT);
    const taper = (x, y) => 1 - o.taper * THREE.MathUtils.clamp((y - belt) / (top - belt), 0, 1);
    if (o.gh) {
        const g = o.gh, f = g[0], r = g[g.length - 1];
        b.add(extrude([...g, [r[0], r[1] - 0.08], [f[0], f[1] - 0.08]], -gW / 2, gW / 2, taper), IDENT, '#ffffff', PAINT);
        // one dark glass band per side (greenhouse inset) + windshield / rear window
        const inset = g.map(([z, y], i) => [z + (i === 0 ? 0.12 : i === g.length - 1 ? -0.1 : 0), Math.min(y, top - 0.05)]).filter(([, y]) => y > belt);
        const band = [[g[0][0] + 0.16, belt + 0.05], ...inset.map(([z, y]) => [z, y - 0.04]), [r[0] - 0.14, belt + 0.05]];
        b.add(extrude(band, gW / 2 - 0.01, gW / 2 + 0.012, taper), IDENT, C.glass, GLASS);
        b.add(extrude(band, -gW / 2 - 0.012, -gW / 2 + 0.01, taper), IDENT, C.glass, GLASS);
        const gx = gW / 2 - 0.06;
        if (o.ws) b.add(extrude(glassStrip(o.ws[0], o.ws[1]), -gx, gx, taper), IDENT, C.glass, GLASS);
        if (o.rw) b.add(extrude(glassStrip(o.rw[0], o.rw[1]), -gx, gx, taper), IDENT, C.glassDark, GLASS);
    } else if (o.ws) b.add(extrude(glassStrip(o.ws[0], o.ws[1]), -(gW / 2 - 0.06), gW / 2 - 0.06), IDENT, C.glass, GLASS);
    const tw = o.tw || 0.22;
    for (const z of o.wz) for (const s of [-1, 1]) b.add(TYRE8, M(s * (W / 2 - tw / 2 + 0.012), o.wr, z, tw, o.wr, o.wr), C.tyre, TYREM);
    const hw = o.headW || 0.36, tlw = o.tailW || 0.32, fz = profileZ(o.low, o.headY, -1), rz = profileZ(o.low, o.tailY, 1);
    lightPair(b, fz + 0.03, o.headY, W / 2 - hw / 2 - 0.07, hw, o.lightH || 0.13, C.head, { r: 0.15 }, 0.08);
    lightPair(b, rz - 0.03, o.tailY, W / 2 - tlw / 2 - 0.05, tlw, (o.lightH || 0.13) + 0.03, C.tail, { r: 0.2 }, 0.08);
    return b.build();
}
/** far LOD (~150 triangles): painted lower box + tinted greenhouse + roof, wheels, light blocks */
function farCar(o, plan = () => 1) {
    const b = new Batch();
    const { L, W, belt, top } = o, gW = (o.gW || W - 0.08) * (1 - o.taper * 0.5);
    const zf = profileZ(o.low, belt - 0.05, -1), zr = profileZ(o.low, belt - 0.05, 1);
    const lowTop = belt, lowBot = o.wr * 0.55;
    b.add(BOX, M(0, (lowTop + lowBot) / 2, (zf + zr) / 2, W - 0.04, lowTop - lowBot, zr - zf), '#ffffff', PAINT);
    const nose = profileZ(o.low, o.headY, -1), tail = profileZ(o.low, o.tailY, 1);
    b.add(BOX, M(0, (o.headY + lowBot) / 2 + 0.02, (nose + zf) / 2, W - 0.14, o.headY - lowBot + 0.1, Math.max(0.05, zf - nose)), '#ffffff', PAINT);
    b.add(BOX, M(0, (o.tailY + lowBot) / 2 + 0.02, (tail + zr) / 2, W - 0.14, o.tailY - lowBot + 0.1, Math.max(0.05, tail - zr)), '#ffffff', PAINT);
    if (o.gh || o.farCabin) {
        const g = o.farCabin || [o.gh[0][0], o.gh[o.gh.length - 1][0]];
        const zs = (o.gh || []).map(p => p[0]); const rz0 = o.gh ? Math.min(...o.gh.filter(p => p[1] > top - 0.05).map(p => p[0])) : g[0] + 0.5;
        const rz1 = o.gh ? Math.max(...o.gh.filter(p => p[1] > top - 0.05).map(p => p[0])) : g[1] - 0.3;
        b.add(BOX, M(0, (belt + top) / 2 - 0.02, (rz0 + rz1) / 2, gW, top - belt - 0.04, rz1 - rz0), C.glass, GLASS);
        b.add(BOX, M(0, (belt + top) / 2 - 0.03, (g[0] + rz0) / 2 + 0.05, gW - 0.1, (top - belt) * 0.8, rz0 - g[0] - 0.1), C.glass, GLASS);
        if (g[1] - rz1 > 0.15) b.add(BOX, M(0, (belt + top) / 2 - 0.03, (rz1 + g[1]) / 2 - 0.05, gW - 0.1, (top - belt) * 0.8, g[1] - rz1 - 0.1), C.glassDark, GLASS);
        b.add(BOX, M(0, top - 0.01, (rz0 + rz1) / 2, gW - 0.06, 0.04, rz1 - rz0 + 0.04), '#ffffff', PAINT);
        void zs;
    }
    for (const z of o.wz) b.add(BOX, M(0, o.wr, z, W - 0.02, o.wr * 1.8, o.wr * 1.8), C.tyre, TYREM);
    const hw = o.headW || 0.36, tw = o.tailW || 0.32;
    lightPair(b, nose + 0.03, o.headY, W / 2 - hw / 2 - 0.08, hw, o.lightH || 0.13, C.head, HEAD, 0.08);
    lightPair(b, tail - 0.03, o.tailY, W / 2 - tw / 2 - 0.06, tw, (o.lightH || 0.13) + 0.03, C.tail, TAIL, 0.08);
    return b.build();
}

/** far LOD for a box-shaped vehicle (bus, tram section, truck) */
function farBox(L, W, H, { z0 = -L / 2, wz = [], wr = 0.5, winY = [1.2, 2.6], ends = true, segs = null } = {}) {
    const b = new Batch();
    for (const [a, c] of segs || [[z0, z0 + L]]) {
        b.add(BOX, M(0, (H + 0.35) / 2, (a + c) / 2, W, H - 0.35, c - a), '#ffffff', PAINT);
        b.add(BOX, M(0, (winY[0] + winY[1]) / 2, (a + c) / 2, W + 0.02, winY[1] - winY[0], c - a - 0.6), C.glass, GLASS);
    }
    for (const z of wz) b.add(BOX, M(0, wr, z, W - 0.1, wr * 1.8, wr * 1.8), C.tyre, TYREM);
    if (ends) {
        lightPair(b, z0 - 0.02, 0.85, W / 2 - 0.3, 0.35, 0.18, C.head, HEAD, 0.06);
        lightPair(b, z0 + L + 0.02, 0.95, W / 2 - 0.25, 0.25, 0.4, C.tail, TAIL, 0.06);
    }
    return b.build();
}

// ---------------------------------------------------------------------------
//  Car kinds (real dimensions, unbranded silhouettes). L × W × H in metres.
// ---------------------------------------------------------------------------
export const CARS = {
    // compact three-box saloon (Logan-like proportions): 4.36 × 1.73 × 1.52
    'compact-sedan': (pl) => buildCar({
        L: 4.36, W: 1.73, H: 1.52, wr: 0.31, wz: [-1.31, 1.29], belt: 0.98, top: 1.51, taper: 0.17, plate: pl,
        low: [[-2.15, 0.28], [-2.18, 0.58], [-2.1, 0.76], [-1.75, 0.86], [-0.95, 0.97], [1.42, 0.99], [2.08, 0.97], [2.17, 0.78], [2.15, 0.28]],
        gh: [[-0.95, 0.96], [-0.14, 1.49], [0.88, 1.51], [1.5, 0.98]],
        ws: [[-0.95, 0.96], [-0.14, 1.49]], rw: [[0.88, 1.51], [1.5, 0.98]],
        side: [[[-0.8, 1.02], [-0.18, 1.44], [0.32, 1.45], [0.32, 1.02]], [[0.42, 1.02], [0.42, 1.45], [0.86, 1.45], [1.36, 1.02]]],
        pillars: [0.37], seams: [-1.02, 0.36, 1.33], handles: [0.12, 1.02], headY: 0.72, tailY: 0.84, headW: 0.38, mirror: [-0.8, 1.0], antenna: 0.85,
    }),
    // mid-size saloon (Passat / Camry-like): 4.85 × 1.84 × 1.45
    sedan: (pl) => buildCar({
        L: 4.85, W: 1.84, H: 1.45, wr: 0.33, wz: [-1.43, 1.4], belt: 0.97, top: 1.45, taper: 0.2, chamfer: 0.1, plate: pl,
        low: [[-2.4, 0.27], [-2.43, 0.56], [-2.32, 0.74], [-1.9, 0.85], [-1.05, 0.96], [1.55, 0.99], [2.33, 0.95], [2.43, 0.74], [2.4, 0.27]],
        gh: [[-1.05, 0.95], [-0.08, 1.44], [0.95, 1.45], [1.75, 0.98]],
        ws: [[-1.05, 0.95], [-0.08, 1.44]], rw: [[0.95, 1.45], [1.75, 0.98]],
        side: [[[-0.9, 1.01], [-0.13, 1.39], [0.42, 1.4], [0.42, 1.01]], [[0.52, 1.01], [0.52, 1.4], [0.93, 1.4], [1.5, 1.01]]],
        pillars: [0.47], seams: [-1.1, 0.46, 1.5], handles: [0.22, 1.18], headY: 0.72, tailY: 0.86, headW: 0.42, tailW: 0.38, lightH: 0.11, mirror: [-0.88, 0.99], antenna: 0.9,
    }),
    // compact hatchback (Golf-like): 4.28 × 1.79 × 1.46
    hatch: (pl) => buildCar({
        L: 4.28, W: 1.79, H: 1.46, wr: 0.32, wz: [-1.33, 1.3], belt: 0.98, top: 1.46, taper: 0.18, plate: pl,
        low: [[-2.11, 0.28], [-2.14, 0.58], [-2.04, 0.76], [-1.7, 0.86], [-0.88, 0.98], [1.88, 1.0], [2.12, 0.96], [2.14, 0.58], [2.1, 0.28]],
        gh: [[-0.88, 0.97], [-0.06, 1.45], [1.55, 1.44], [2.02, 0.99]],
        ws: [[-0.88, 0.97], [-0.06, 1.45]], rw: [[1.62, 1.41], [2.02, 1.0]],
        side: [[[-0.74, 1.02], [-0.11, 1.4], [0.42, 1.4], [0.42, 1.02]], [[0.52, 1.02], [0.52, 1.4], [1.22, 1.4], [1.4, 1.02]]],
        pillars: [0.47], seams: [-0.98, 0.46, 1.42], handles: [0.18, 1.05], headY: 0.74, tailY: 0.88, tailW: 0.3, lightH: 0.12, mirror: [-0.74, 1.01], antenna: 1.3,
        cpillar: true,
    }),
    // estate / wagon (Octavia-combi-like): 4.69 × 1.83 × 1.47, roof rails
    estate: (pl) => buildCar({
        L: 4.69, W: 1.83, H: 1.47, wr: 0.32, wz: [-1.47, 1.22], belt: 0.98, top: 1.47, taper: 0.17, plate: pl,
        low: [[-2.31, 0.28], [-2.34, 0.57], [-2.24, 0.75], [-1.85, 0.86], [-0.98, 0.97], [2.1, 1.0], [2.33, 0.96], [2.35, 0.56], [2.31, 0.28]],
        gh: [[-0.98, 0.96], [-0.1, 1.46], [1.95, 1.43], [2.26, 0.99]],
        ws: [[-0.98, 0.96], [-0.1, 1.46]], rw: [[1.98, 1.4], [2.26, 1.0]],
        side: [[[-0.84, 1.02], [-0.15, 1.41], [0.38, 1.41], [0.38, 1.02]], [[0.48, 1.02], [0.48, 1.41], [1.22, 1.41], [1.22, 1.02]], [[1.32, 1.04], [1.32, 1.39], [1.88, 1.37], [2.08, 1.04]]],
        pillars: [0.43, 1.27], seams: [-1.06, 0.42, 1.3], handles: [0.15, 1.08], headY: 0.73, tailY: 0.9, tailW: 0.3, mirror: [-0.83, 1.0], roofRails: [-0.05, 1.85],
    }),
    // small SUV (Duster-like): 4.34 × 1.80 × 1.69, plastic cladding
    'small-suv': (pl) => buildCar({
        L: 4.34, W: 1.8, H: 1.69, wr: 0.36, wz: [-1.33, 1.34], belt: 1.08, top: 1.66, taper: 0.13, plate: pl, archPaint: false, archLip: 0.1,
        low: [[-2.13, 0.4], [-2.17, 0.78], [-2.05, 0.95], [-1.62, 1.02], [-0.95, 1.07], [1.86, 1.1], [2.15, 1.06], [2.17, 0.42]],
        gh: [[-0.95, 1.06], [-0.2, 1.64], [1.72, 1.65], [2.05, 1.08]],
        ws: [[-0.95, 1.06], [-0.2, 1.64]], rw: [[1.74, 1.6], [2.05, 1.1]],
        side: [[[-0.81, 1.12], [-0.24, 1.58], [0.4, 1.58], [0.4, 1.12]], [[0.5, 1.12], [0.5, 1.58], [1.32, 1.59], [1.32, 1.12]], [[1.42, 1.14], [1.42, 1.56], [1.7, 1.57], [1.88, 1.14]]],
        pillars: [0.45, 1.37], seams: [-0.96, 0.45, 1.36], handles: [0.15, 1.1], headY: 0.88, tailY: 1.0, headW: 0.4, bumperY: 0.5, mirror: [-0.85, 1.12], roofRails: [-0.15, 1.75],
        extra: (b) => { for (const s of [-1, 1]) b.add(BOX, M(s * 0.905, 0.5, 0, 0.02, 0.2, 2.7), C.plastic, { r: 0.8 }); b.add(BOX, M(0, 0.45, -2.17, 1.1, 0.06, 0.05), '#9aa0a6', { r: 0.4, m: 0.5 }); },
    }),
    // compact crossover (RAV4 / CR-V-like): 4.60 × 1.86 × 1.69
    crossover: (pl) => buildCar({
        L: 4.6, W: 1.86, H: 1.69, wr: 0.37, wz: [-1.41, 1.28], belt: 1.08, top: 1.68, taper: 0.15, chamfer: 0.11, plate: pl, archLip: 0.1,
        low: [[-2.27, 0.38], [-2.3, 0.72], [-2.18, 0.92], [-1.7, 1.02], [-1.0, 1.07], [1.98, 1.1], [2.28, 1.04], [2.3, 0.4]],
        gh: [[-1.0, 1.06], [-0.18, 1.66], [1.8, 1.65], [2.2, 1.09]],
        ws: [[-1.0, 1.06], [-0.18, 1.66]], rw: [[1.85, 1.6], [2.2, 1.1]],
        side: [[[-0.86, 1.12], [-0.23, 1.6], [0.42, 1.6], [0.42, 1.12]], [[0.52, 1.12], [0.52, 1.6], [1.3, 1.6], [1.3, 1.12]], [[1.4, 1.14], [1.4, 1.57], [1.72, 1.58], [2.0, 1.14]]],
        pillars: [0.47, 1.35], seams: [-1.02, 0.47, 1.35], handles: [0.18, 1.1], headY: 0.92, tailY: 1.04, headW: 0.42, lightH: 0.11, bumperY: 0.48, mirror: [-0.88, 1.12], roofRails: [-0.1, 1.8], antenna: 1.55,
        extra: (b) => { for (const s of [-1, 1]) b.add(BOX, M(s * 0.935, 0.52, 0, 0.02, 0.18, 2.6), C.plastic, { r: 0.8 }); },
    }),
    // mid-size 3-row SUV (Explorer-like): 5.05 × 2.00 × 1.78
    suv: (pl) => buildCar({
        L: 5.05, W: 2.0, H: 1.78, wr: 0.39, wz: [-1.6, 1.42], belt: 1.15, top: 1.78, taper: 0.12, chamfer: 0.1, plate: pl, archLip: 0.1, tw: 0.25,
        low: [[-2.49, 0.42], [-2.53, 0.85], [-2.4, 1.04], [-1.85, 1.11], [-1.1, 1.14], [2.2, 1.17], [2.5, 1.12], [2.53, 0.44]],
        gh: [[-1.1, 1.13], [-0.25, 1.76], [2.15, 1.76], [2.42, 1.16]],
        ws: [[-1.1, 1.13], [-0.25, 1.76]], rw: [[2.18, 1.72], [2.42, 1.17]],
        side: [[[-0.95, 1.19], [-0.3, 1.7], [0.42, 1.71], [0.42, 1.19]], [[0.52, 1.19], [0.52, 1.71], [1.4, 1.71], [1.4, 1.19]], [[1.5, 1.2], [1.5, 1.7], [2.12, 1.7], [2.25, 1.2]]],
        pillars: [0.47, 1.45], seams: [-1.12, 0.47, 1.44], handles: [0.18, 1.2], headY: 0.98, tailY: 1.12, headW: 0.42, tailW: 0.24, lightH: 0.12, bumperY: 0.52, mirror: [-0.95, 1.2], roofRails: [-0.2, 2.0],
    }),
    // EV fastback saloon (smooth nose, no grille, glass roof, light bar): 4.72 × 1.85 × 1.44
    'ev-sedan': (pl) => buildCar({
        L: 4.72, W: 1.85, H: 1.44, wr: 0.34, wz: [-1.44, 1.43], belt: 0.95, top: 1.44, taper: 0.22, chamfer: 0.13, plate: pl, grille: false, rim: '#3d4147',
        low: [[-2.33, 0.26], [-2.36, 0.5], [-2.28, 0.66], [-2.0, 0.78], [-1.0, 0.93], [1.75, 0.98], [2.3, 0.96], [2.36, 0.74], [2.34, 0.27]],
        gh: [[-1.0, 0.92], [0.0, 1.43], [0.72, 1.44], [2.05, 0.98]],
        ws: [[-1.0, 0.92], [0.0, 1.43]], rw: [[0.72, 1.44], [2.05, 0.99]],
        side: [[[-0.86, 0.99], [-0.05, 1.38], [0.42, 1.39], [0.42, 0.99]], [[0.52, 0.99], [0.52, 1.39], [0.75, 1.39], [1.6, 0.99]]],
        pillars: [0.47], seams: [-1.08, 0.47, 1.45], handles: [0.15, 1.05], handleColor: '#1a1b1e', headY: 0.7, tailY: 0.85, headW: 0.4, tailW: 0.36, lightH: 0.07, mirror: [-0.85, 0.98],
        extra: (b) => b.add(extrude(glassStrip([0.0, 1.43], [0.72, 1.44], 0.02), -0.62, 0.62), IDENT, C.glassDark, GLASS), // glass roof
    }),
    // minivan (Sienna / Odyssey-like): 5.17 × 2.00 × 1.78, sliding-door rail
    minivan: (pl) => buildCar({
        L: 5.17, W: 1.99, H: 1.78, wr: 0.36, wz: [-1.62, 1.4], belt: 1.07, top: 1.77, taper: 0.11, chamfer: 0.12, plate: pl,
        low: [[-2.55, 0.34], [-2.58, 0.66], [-2.45, 0.86], [-1.95, 0.98], [-1.25, 1.06], [2.3, 1.1], [2.55, 1.04], [2.58, 0.36]],
        gh: [[-1.25, 1.05], [-0.25, 1.75], [2.2, 1.74], [2.5, 1.09]],
        ws: [[-1.25, 1.05], [-0.25, 1.75]], rw: [[2.25, 1.7], [2.5, 1.1]],
        side: [[[-1.1, 1.12], [-0.3, 1.69], [0.28, 1.69], [0.28, 1.12]], [[0.38, 1.12], [0.38, 1.69], [1.42, 1.69], [1.42, 1.12]], [[1.52, 1.13], [1.52, 1.68], [2.2, 1.68], [2.36, 1.13]]],
        pillars: [0.33, 1.47], seams: [-1.2, 0.33, 1.47], handles: [0.05, 0.55], headY: 0.9, tailY: 0.98, headW: 0.42, tailW: 0.22, lightH: 0.12, bumperY: 0.46, mirror: [-1.1, 1.12], roofRails: [-0.2, 2.0],
        extra: (b) => { for (const s of [-1, 1]) b.add(BOX, M(s * 0.997, 1.06, 1.25, 0.008, 0.02, 1.4), C.seal, { r: 0.4 }); },
    }),
    // full-size crew-cab pickup (F-150-like): 5.89 × 2.03 × 1.96, open bed
    pickup: (pl) => buildCar({
        L: 5.89, W: 2.03, H: 1.96, wr: 0.42, wz: [-1.95, 1.72], belt: 1.3, top: 1.95, taper: 0.09, chamfer: 0.06, plate: pl, tw: 0.27, archLip: 0.12, chromeGrille: true,
        low: [[-2.92, 0.46], [-2.95, 1.0], [-2.85, 1.22], [-1.6, 1.3], [2.92, 1.3], [2.95, 0.46]],
        gh: [[-1.6, 1.29], [-0.85, 1.94], [0.72, 1.95], [0.8, 1.3]],
        ws: [[-1.6, 1.29], [-0.85, 1.94]], rw: [[0.72, 1.95], [0.8, 1.31]],
        side: [[[-1.44, 1.35], [-0.88, 1.88], [-0.25, 1.89], [-0.25, 1.35]], [[-0.15, 1.35], [-0.15, 1.89], [0.66, 1.9], [0.7, 1.35]]],
        pillars: [-0.2], seams: [-1.5, -0.2, 0.84], handles: [-0.55, 0.3], handleColor: '#c9ced4', headY: 1.08, tailY: 1.05, headW: 0.4, tailW: 0.14, lightH: 0.2, bumperY: 0.6, mirror: [-1.42, 1.38], grilleH: 1.6, cHMSL: false,
        extra: (b) => {
            b.add(BOX, M(0, 1.0, 1.9, 1.72, 0.03, 2.0), '#18191b', { r: 0.95 });                         // bed floor
            for (const s of [-1, 1]) b.add(BOX, M(s * 0.88, 1.15, 1.9, 0.03, 0.32, 2.0), '#1d1e21', { r: 0.9 }); // bed inner walls
            b.add(BOX, M(0, 1.15, 2.92, 1.8, 0.3, 0.02), '#1d1e21', { r: 0.9 });                         // tailgate inner
            b.add(BOX, M(0, 0.55, -2.97, 2.0, 0.18, 0.1), C.chrome, { r: 0.2, m: 1 });                   // chrome bumpers
            b.add(BOX, M(0, 0.6, 2.97, 2.0, 0.16, 0.1), C.chrome, { r: 0.2, m: 1 });
        },
    }),
    // small van (Dokker / Kangoo-like): 4.36 × 1.75 × 1.81
    van: (pl) => buildCar({
        L: 4.36, W: 1.75, H: 1.81, wr: 0.32, wz: [-1.36, 1.4], belt: 1.05, top: 1.81, taper: 0.05, chamfer: 0.08, plate: pl,
        low: [[-2.15, 0.3], [-2.18, 0.62], [-2.02, 0.86], [-1.3, 1.02], [-0.65, 1.79], [2.1, 1.81], [2.18, 1.72], [2.18, 0.3]],
        gh: null, ws: [[-1.3, 1.02], [-0.65, 1.79]],
        side: [[[-1.15, 1.1], [-0.68, 1.68], [-0.08, 1.69], [-0.08, 1.1]]],
        seams: [-1.2, -0.02, 1.0], handles: [-0.25, 0.55], headY: 0.78, tailY: 0.98, headW: 0.34, tailW: 0.14, lightH: 0.3, mirror: [-1.12, 1.12], cHMSL: false,
        extra: (b) => {
            b.add(BOX, M(0, 1.45, 2.185, 1.3, 0.4, 0.02), C.glassDark, GLASS);
            b.add(BOX, M(0, 1.45, 2.19, 0.04, 0.4, 0.02), C.trim);
            for (const s of [-1, 1]) b.add(BOX, M(s * 0.88, 1.0, 0.75, 0.01, 0.02, 0.9), C.trim);
        },
    }),
};

// tall panel van (Sprinter-like, high roof): 5.93 × 2.02 × 2.6 — white delivery fleet
export function deliveryVan(pl) {
    const o = {
        L: 5.93, W: 2.02, H: 2.6, wr: 0.36, wz: [-1.95, 1.72], belt: 1.25, top: 2.6, taper: 0.03, chamfer: 0.1, plate: pl, tw: 0.24,
        low: [[-2.94, 0.34], [-2.97, 0.72], [-2.82, 1.02], [-2.3, 1.18], [-1.62, 1.3], [-1.05, 2.45], [-0.85, 2.6], [2.9, 2.6], [2.97, 2.5], [2.97, 0.34]],
        gh: null, ws: [[-1.62, 1.3], [-1.05, 2.42]],
        side: [[[-1.45, 1.36], [-1.08, 2.18], [-0.62, 2.2], [-0.62, 1.36]]],
        seams: [-1.55, -0.55, 0.85, 2.92], handles: [-0.75, 0.2], headY: 0.95, tailY: 0.95, headW: 0.38, tailW: 0.14, lightH: 0.32, bumperY: 0.46, mirror: [-1.45, 1.45], cHMSL: false,
        farCabin: [-1.6, -0.6],
        extra: (b) => {
            for (const s of [-1, 1]) b.add(BOX, M(s * 1.016, 1.3, 1.05, 0.01, 0.02, 1.0), C.trim); // sliding-door rail
            b.add(BOX, M(0, 1.35, 2.975, 0.01, 1.9, 0.01), C.seal);                                 // barn doors split
            b.add(BOX, M(0, 2.62, -0.2, 0.25, 0.03, 0.08), C.tail, TAIL);                            // high brake lamp
            for (const s of [-1, 1]) b.add(BOX, M(s * 0.98, 1.25, -2.0, 0.08, 0.04, 1.6), '#2a2c30', { r: 0.8 });
        },
    };
    const r = buildCar(o);
    r.far = farCar({ ...o, gh: null }, () => 1);
    { // far: add the windshield as dark glass
        const b = new Batch(); b.add(BOX, M(0, 1.85, -1.4, 1.84, 0.95, 0.5, -0.5), C.glass, GLASS);
        r.far = mergeGeos(r.far, b.build());
    }
    return r;
}

// box truck (cab-over + box body): 8.9 × 2.45 × 3.4
export function boxTruck(pl) {
    const L = 8.9, W = 2.45, b = new Batch();
    b.add(extrude([[-4.45, 0.55], [-4.5, 1.2], [-4.4, 2.85], [-4.15, 2.95], [-2.9, 2.95], [-2.9, 0.55]], -W / 2, W / 2), IDENT, '#ffffff', PAINT);
    b.add(BOX, M(0, 2.0, 1.35, W + 0.04, 2.85, 6.05), '#e9eaeb', { r: 0.55 });                  // box body
    b.add(BOX, M(0, 0.48, 1.35, W + 0.06, 0.06, 6.0), '#6b6e72', { r: 0.6, m: 0.4 });           // box floor rail
    for (const s of [-1, 1]) b.add(BOX, M(s * 1.0, 0.6, 1.4, 0.03, 0.2, 4.6), '#d6d8da', { r: 0.6, m: 0.5 }); // side guard
    b.add(BOX, M(0, 0.6, 0.3, 1.0, 0.25, 8.3), C.trim, { r: 0.8 });
    b.add(BOX, M(0, 2.1, -4.47, W - 0.2, 0.9, 0.05), C.glass, GLASS);
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.006), 2.1, -3.7, 0.012, 0.75, 0.9), C.glass, GLASS);
    b.add(BOX, M(0, 1.15, -4.53, 1.5, 0.45, 0.04), C.grille, { r: 0.5 });
    wheels(b, { W, wr: 0.5, wz: [-3.3, 2.0, 3.2], tw: 0.32, arch: false });
    lightPair(b, -4.54, 0.85, 0.95, 0.35, 0.2, C.head, HEAD);
    lightPair(b, 4.4, 0.85, 1.0, 0.22, 0.18, C.tail, TAIL);
    b.add(BOX, M(0, 0.6, -4.58, W, 0.25, 0.1), C.plastic, { r: 0.7 });
    b.add(BOX, M(0, 0.5, 4.38, W, 0.12, 0.12), '#c0322b', { r: 0.6 }); // under-run bar
    plate(b, -4.64, 0.6, -1, pl); plate(b, 4.46, 0.75, 1, pl, pl !== 'us');
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.15), 2.3, -4.2, 0.06, 0.4, 0.1), C.seal);
    return { geo: b.build(), length: L, width: W, height: 3.45, far: farBox(L, W, 3.4, { wz: [-3.3, 2.0, 3.2], winY: [1.7, 2.5] }) };
}

// police: city-specific base car + livery
export function policeCar(pl, city) {
    if (city === 'seattle') { // US interceptor SUV: black with white front doors, lightbar
        const r = CARS.suv('us'); const b = new Batch();
        for (const s of [-1, 1]) b.add(BOX, M(s * 1.003, 0.8, -0.35, 0.008, 0.62, 1.45), '#f4f5f7', { r: 0.35, m: 0.2 });
        b.add(BOX, M(0, 0.62, -2.6, 1.6, 0.16, 0.12), '#111214', { r: 0.6 }); // push bar
        b.add(BOX, M(0, 1.83, 0.1, 1.25, 0.1, 0.3), '#1a1b1e', { r: 0.4 });  // lightbar base
        r.geo = mergeGeos(r.geo, b.build()); r.bar = { y: 1.93, z: 0.1, w: 1.2 }; r.paint = '#121316';
        return r;
    }
    // Romanian police: white saloon, blue side band with a thin yellow line
    const r = CARS['compact-sedan']('eu'); const b = new Batch();
    for (const s of [-1, 1]) {
        b.add(BOX, M(s * 0.871, 0.76, -0.05, 0.008, 0.17, 3.7), '#1d3f9a', { r: 0.35 });
        b.add(BOX, M(s * 0.872, 0.66, -0.05, 0.008, 0.03, 3.7), '#e8d215', { e: 0.05, r: 0.4 });
    }
    b.add(BOX, M(0, 1.555, 0.35, 1.1, 0.08, 0.26), '#222', { r: 0.5 });
    r.geo = mergeGeos(r.geo, b.build()); r.bar = { y: 1.62, z: 0.35, w: 1.1 }; r.paint = '#f4f5f7';
    return r;
}

// Bucharest taxi: yellow Logan-like with the roof sign (own textured mesh near) + checker band
export function taxiCar(pl) {
    const r = CARS['compact-sedan'](pl); const b = new Batch();
    for (const s of [-1, 1]) for (let i = 0; i < 14; i++) b.add(BOX, M(s * 0.869, 0.8 + (i % 2) * 0.045, -1.05 + i * 0.16, 0.008, 0.045, 0.16), i % 2 ? '#111' : '#f4f4f4', { r: 0.5 });
    b.add(BOX, M(0, 1.53, 0.35, 0.82, 0.04, 0.28), '#111', { r: 0.5 });                       // sign base
    r.geo = mergeGeos(r.geo, b.build());
    const f = new Batch(); f.add(BOX, M(0, 1.63, 0.35, 0.8, 0.22, 0.24), '#ffd400', SIGN(0.6)); r.far = mergeGeos(r.far, f.build());
    r.taxiSign = true; r.paint = '#f2c200';
    return r;
}

// ---------------------------------------------------------------------------
//  Transit (R13.3): STB bus / trolleybus / trams, King County Metro buses
// ---------------------------------------------------------------------------
/** one low-floor bus body section. z0 = front end (−z), len, opts: front/rear shaping, livery painter */
function busBody(b, { W, H, z0, z1, front = true, rear = true }) {
    const fz = z0, rz = z1;
    const p = [[fz + (front ? 0.08 : 0), 0.3], [fz, 0.9], [fz + (front ? 0.05 : 0), H - 0.15], [fz + (front ? 0.2 : 0), H], [rz - (rear ? 0.15 : 0), H], [rz, H - 0.12], [rz, 0.3]];
    b.add(extrude(p, -W / 2, W / 2), IDENT, '#ffffff', PAINT);
}
/** side windows (dark tinted band with thin pillars), doors on the right (+x) side */
function busWindows(b, { W, z0, z1, y0 = 1.15, y1 = 2.55, doors = [], pillar = '#15171a', step = 1.45, left = true }) {
    for (const s of left ? [-1, 1] : [1]) {
        b.add(BOX, M(s * (W / 2 + 0.005), (y0 + y1) / 2, (z0 + z1) / 2, 0.012, y1 - y0, z1 - z0), C.glass, GLASS);
        for (let z = z0 + step; z < z1 - 0.3; z += step) b.add(BOX, M(s * (W / 2 + 0.011), (y0 + y1) / 2, z, 0.008, y1 - y0, 0.08), pillar, { r: 0.4 });
    }
    for (const [zc, w] of doors) {
        b.add(BOX, M(W / 2 + 0.014, 1.38, zc, 0.012, 2.3, w), '#1d2329', GLASS);
        b.add(BOX, M(W / 2 + 0.018, 1.38, zc, 0.01, 2.3, 0.04), '#9aa0a6', { r: 0.3, m: 0.7 });
        b.add(BOX, M(W / 2 + 0.018, 0.33, zc, 0.01, 0.06, w), C.plastic, { r: 0.7 });
    }
}
function destSign(b, z, y, w, dir = -1, h = 0.26) {
    b.add(BOX, M(0, y, z, w + 0.06, h + 0.06, 0.05), '#0b0c0d', { r: 0.5 });
    b.add(BOX, M(0, y, z + dir * 0.03, w, h * 0.45, 0.01), '#ffb21a', SIGN(1.0)); // LED text line (amber)
}
function busEnds(b, { W, z0, z1, H, pl, kcm = false, rackFront = false }) {
    // front: big windscreen, wipers, lamps, bumper; rear: engine grille, lamps, plate
    b.add(BOX, M(0, 1.75, z0 - 0.012, W - 0.16, 1.55, 0.04), C.glass, GLASS);
    destSign(b, z0 - 0.02, H - 0.32, W - 0.5);
    for (const x of [-0.5, 0.4]) b.add(BOX, M(x, 1.05, z0 - 0.045, 0.03, 0.03, 0.02), C.seal);
    lightPair(b, z0 - 0.02, 0.72, W / 2 - 0.3, 0.38, 0.16, C.head, HEAD);
    lightPair(b, z0 - 0.025, 0.58, W / 2 - 0.3, 0.3, 0.035, C.drl, DRL);
    b.add(BOX, M(0, 0.42, z0 - 0.04, W, 0.26, 0.1), C.plastic, { r: 0.7 });
    plate(b, z0 - 0.1, 0.42, -1, pl);
    if (rackFront) { // KCM front bike rack (folded)
        b.add(BOX, M(0, 0.62, z0 - 0.18, 1.5, 0.05, 0.05), '#2b2d31', { r: 0.4, m: 0.6 });
        for (const x of [-0.6, 0, 0.6]) b.add(BOX, M(x, 0.95, z0 - 0.2, 0.05, 0.7, 0.04), '#2b2d31', { r: 0.4, m: 0.6 });
    }
    b.add(BOX, M(0, 1.55, z1 + 0.015, W - 0.4, 0.75, 0.03), kcm ? '#16191c' : C.glassDark, GLASS);
    b.add(BOX, M(0, 0.85, z1 + 0.02, W - 0.6, 0.5, 0.03), '#1a1c1f', { r: 0.6 });   // engine grille
    lightPair(b, z1 + 0.02, 0.95, W / 2 - 0.2, 0.22, 0.5, C.tail, TAIL);
    b.add(BOX, M(0, 0.42, z1 + 0.04, W, 0.24, 0.08), C.plastic, { r: 0.7 });
    plate(b, z1 + 0.09, 0.62, 1, pl);
    for (const s of [-1, 1]) b.add(BOX, beamM(new THREE.Vector3(s * (W / 2 - 0.05), H - 0.35, z0 + 0.25), new THREE.Vector3(s * (W / 2 + 0.25), H - 0.55, z0 - 0.2), 0.04, 0.04), C.seal);
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.25), H - 0.85, z0 - 0.2, 0.06, 0.45, 0.14), C.seal, { r: 0.3 });
}

/** STB 12 m city bus (Citaro-like) — yellow, dark window band, red accent stripe; or the trolleybus variant (poles) */
export function stbBus(pl, trolley = false) {
    const L = 12.0, W = 2.55, H = trolley ? 3.0 : 3.1, b = new Batch(), z0 = -L / 2, z1 = L / 2;
    busBody(b, { W, H, z0, z1 });
    busWindows(b, { W, z0: z0 + 0.6, z1: z1 - 0.6, doors: [[z0 + 1.1, 1.2], [-0.6, 1.2], trolley ? [3.6, 1.2] : [3.9, 1.2]] });
    for (const s of [-1, 1]) {
        b.add(BOX, M(s * (W / 2 + 0.008), 0.62, 0, 0.01, 0.07, L - 0.3), '#c8102e', { r: 0.4 });   // red accent line
        b.add(BOX, M(s * (W / 2 + 0.006), 0.4, 0, 0.01, 0.12, L - 0.2), '#2b2d31', { r: 0.7 });    // dark skirt
    }
    b.add(BOX, M(0, 0.95, z0 - 0.02, W - 0.4, 0.18, 0.02), '#c8102e', { r: 0.4 });
    if (!trolley) b.add(BOX, M(0, H + 0.14, 1.5, 1.8, 0.28, 2.8), '#e2e4e6', { r: 0.55 }); // AC + hybrid roof pack
    busEnds(b, { W, z0, z1, H, pl });
    wheels(b, { W, wr: 0.5, wz: [-3.55, 2.4], tw: 0.3, rim: '#bfc3c7' });
    if (trolley) trolleyGear(b, { W, H, zBase: -1.0 });
    return { geo: b.build(), length: L, width: W, height: H, paint: '#f4c300', far: farBox(L, W, H, { wz: [-3.55, 2.4], winY: [1.15, 2.55] }), transit: trolley ? 'trolleybus' : 'bus' };
}
/** trolley poles (raised to the wires ≈ 5.6 m), roof fairing with the traction gear */
function trolleyGear(b, { W, H, zBase }) {
    b.add(BOX, M(0, H + 0.2, 0.6, 2.1, 0.4, 4.6), '#e2e4e6', { r: 0.55 });          // traction equipment fairing
    b.add(BOX, M(0, H + 0.42, zBase, 1.0, 0.14, 0.5), '#2b2d31', { r: 0.6 });         // pole base
    for (const x of [-0.3, 0.3]) {
        const a = new THREE.Vector3(x, H + 0.5, zBase), c = new THREE.Vector3(x * 1.0, 5.6, zBase + 5.4); // trailing poles
        b.add(POLE, beamPole(a, c, 0.035), '#141517', { r: 0.6 });
        b.add(BOX, M(c.x, c.y, c.z, 0.08, 0.06, 0.2), '#3a3d42', { r: 0.5, m: 0.4 });  // shoe
        b.add(BOX, M(x, H + 0.43, zBase + 4.2, 0.05, 0.05, 0.35), '#141517');          // pole hook (rear roof)
    }
}
function beamPole(a, c, r) {
    const d = new THREE.Vector3().subVectors(c, a); const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
}

/** King County Metro low-floor bus, 40 ft (12.2 m) or articulated 60 ft (18.3 m): white, dark-green skirt, teal band, purple tail accent */
export function kcmBus(pl, artic = false) {
    const W = 2.59, H = 3.2, b = new Batch();
    const L = artic ? 18.3 : 12.2, z0 = -L / 2, z1 = L / 2;
    const secs = artic ? [[z0, z0 + 10.9], [z0 + 11.4, z1]] : [[z0, z1]];
    secs.forEach(([a, c], i) => {
        busBody(b, { W, H, z0: a, z1: c, front: i === 0, rear: i === secs.length - 1 });
        const doors = artic ? (i === 0 ? [[a + 1.1, 1.15], [a + 6.4, 1.15]] : [[a + 2.6, 1.15]]) : [[z0 + 1.1, 1.15], [0.9, 1.15]];
        busWindows(b, { W, z0: a + (i === 0 ? 0.65 : 0.3), z1: c - (i === secs.length - 1 ? 0.7 : 0.3), y0: 1.2, y1: 2.5, doors, pillar: '#1c1f22' });
        for (const s of [-1, 1]) {
            b.add(BOX, M(s * (W / 2 + 0.006), 0.62, (a + c) / 2, 0.01, 0.62, c - a - 0.1), '#174b3f', { r: 0.4 });  // dark green skirt
            b.add(BOX, M(s * (W / 2 + 0.008), 1.0, (a + c) / 2, 0.01, 0.14, c - a - 0.1), '#2aa198', { r: 0.4 }); // teal band
        }
        b.add(BOX, M(0, H + 0.16, (a + c) / 2 + 0.5, 1.9, 0.32, Math.min(4.5, c - a - 2)), '#e8e9ea', { r: 0.5 }); // roof pack (hybrid batteries / AC)
    });
    const zt = z1 - 1.6; for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.01), 1.5, zt, 0.01, 1.6, 1.6), '#5b3a8c', { r: 0.4 }); // purple tail accent
    b.add(BOX, M(0, 0.62, z0 - 0.02, W - 0.1, 0.5, 0.02), '#174b3f', { r: 0.4 });
    if (artic) { // bellows + turntable
        b.add(BOX, M(0, 1.7, z0 + 11.15, W - 0.2, 2.8, 0.7), '#1b1c1f', { r: 0.95 });
        for (let k = -2; k <= 2; k++) b.add(BOX, M(0, 1.7, z0 + 11.15 + k * 0.12, W - 0.15, 2.82, 0.03), '#2a2b2f', { r: 0.9 });
    }
    busEnds(b, { W, z0, z1, H, pl, kcm: true, rackFront: true });
    const wz = artic ? [z0 + 2.6, z0 + 8.6, z1 - 1.9] : [z0 + 2.6, z1 - 3.6];
    wheels(b, { W, wr: 0.5, wz, tw: 0.3, rim: '#c4c8cc' });
    return { geo: b.build(), length: L, width: W, height: H, paint: '#f3f4f2', far: farBox(L, W, H, { wz, winY: [1.2, 2.5], segs: secs }), transit: 'bus' };
}

/** STB trams. imperio: 4-section low-floor, 36 m (Imperio Metropolitan proportions); v3a: 3-section, 27 m (V3A-like) */
export function stbTram(kind = 'v3a') {
    const imperio = kind === 'imperio';
    const W = 2.4, H = imperio ? 3.5 : 3.3, b = new Batch();
    const L = imperio ? 36 : 27, z0 = -L / 2;
    const n = imperio ? 4 : 3, gap = 0.45, sl = (L - gap * (n - 1)) / n;
    const secs = []; for (let i = 0; i < n; i++) secs.push([z0 + i * (sl + gap), z0 + i * (sl + gap) + sl]);
    const floor = imperio ? 0.35 : 0.85;
    secs.forEach(([a, c], i) => {
        const first = i === 0, last = i === n - 1;
        const nose = imperio ? 0.9 : 0.4;
        const p = [[a + (first ? nose : 0), 0.3], [a + (first ? nose * 0.4 : 0), 0.9], [a, 1.4], [a + (first ? 0.25 : 0), H - 0.2], [a + (first ? 0.55 : 0), H], [c - (last ? 0.55 : 0), H], [c - (last ? 0.25 : 0), H - 0.2], [c, 1.4], [c - (last ? nose * 0.4 : 0), 0.9], [c - (last ? nose : 0), 0.3]];
        b.add(extrude(p, -W / 2, W / 2), IDENT, '#ffffff', PAINT);
        const wz0 = a + (first ? 2.2 : 0.4), wz1 = c - (last ? 2.2 : 0.4);
        const doorsAt = imperio ? (first ? [a + 3.2] : last ? [c - 3.2] : [(a + c) / 2 - 1.8, (a + c) / 2 + 1.8].slice(0, i === 1 ? 2 : 1)) : [(a + c) / 2 - 1.6, (a + c) / 2 + 1.6];
        busWindows(b, { W, z0: wz0, z1: wz1, y0: imperio ? 1.05 : 1.45, y1: H - 0.45, doors: doorsAt.map(z => [z, 1.3]), pillar: '#141516', step: imperio ? 1.6 : 1.25 });
        for (const s of [-1, 1]) {
            if (imperio) b.add(BOX, M(s * (W / 2 + 0.008), H - 0.32, (a + c) / 2, 0.01, 0.12, c - a - 0.2), '#1a1a1a', { r: 0.4 }); // dark roofline
            else b.add(BOX, M(s * (W / 2 + 0.008), 1.15, (a + c) / 2, 0.01, 0.12, c - a - 0.2), '#b5121b', { r: 0.4 });           // red stripe (V3A)
            b.add(BOX, M(s * (W / 2 + 0.006), 0.42, (a + c) / 2, 0.01, 0.24, c - a - 0.1), imperio ? '#c8102e' : '#2b2b2b', { r: 0.6 });
        }
        b.add(BOX, M(0, H + 0.17, (a + c) / 2, 1.7, 0.34, (c - a) * 0.6), '#9da2a8', { r: 0.6 }); // roof equipment
        if (!imperio || i === 0 || last) for (const z of (imperio ? [first ? a + 2.5 : c - 2.5] : [a + 1.6, c - 1.6])) { // bogies
            b.add(BOX, M(0, 0.4, z, W - 0.35, 0.45, 2.2), '#202124', { r: 0.8 });
            for (const dz of [-0.9, 0.9]) for (const s of [-1, 1]) b.add(TYRE, M(s * 0.72, 0.33, z + dz, 0.12, 0.33, 0.33), '#2b2b2b', TYREM);
        }
        void floor;
    });
    for (let i = 1; i < n; i++) { const z = secs[i][0] - gap / 2; b.add(BOX, M(0, 1.9, z, W - 0.2, H - 0.7, gap + 0.1), '#1b1c1f', { r: 0.95 }); }
    for (const [zEnd, dir] of [[z0, -1], [z0 + L, 1]]) { // both cabs (bidirectional) — windscreen, dark mask, lamps, dest sign
        const nz = zEnd - dir * (imperio ? 0.35 : 0.15);
        b.add(BOX, M(0, 2.05, nz + dir * 0.02, W - 0.35, 1.25, 0.05), C.glass, GLASS);
        if (imperio) b.add(BOX, M(0, 1.1, zEnd - dir * (imperio ? 0.6 : 0.1), W - 0.25, 0.55, 0.05), '#121315', { r: 0.4 }); // black front mask
        destSign(b, nz + dir * 0.03, H - 0.3, 1.5, dir);
        lightPair(b, zEnd - dir * (imperio ? 0.75 : 0.25), 0.95, 0.85, 0.3, 0.13, dir < 0 ? C.head : C.tail, dir < 0 ? HEAD : TAIL);
        lightPair(b, zEnd - dir * (imperio ? 0.75 : 0.25), 0.82, 0.85, 0.3, 0.035, dir < 0 ? C.drl : C.tailDark, dir < 0 ? DRL : { r: 0.3 });
    }
    // pantograph (raised to the contact wire ≈ 5.6–5.9 m) on the 2nd section
    const pz = (secs[1][0] + secs[1][1]) / 2;
    const pa = new THREE.Vector3(0, H + 0.35, pz + 0.6), pb = new THREE.Vector3(0, H + 1.2, pz - 0.3), pc = new THREE.Vector3(0, 5.75, pz + 0.3);
    b.add(BOX, beamM(pa, pb, 0.05, 0.05), '#2a2b2e'); b.add(BOX, beamM(pb, pc, 0.04, 0.04), '#2a2b2e');
    b.add(BOX, M(0, 5.77, pz + 0.3, 1.5, 0.04, 0.08), '#3a3b3e', { r: 0.4, m: 0.5 });
    const farSegs = secs.map(([a, c]) => [a, c]);
    const far = farBox(L, W, H, { winY: [imperio ? 1.05 : 1.45, H - 0.45], segs: farSegs });
    // (owner, 2026-11-12, Grozavesti Basarab: "fences are not continuous on the bridge") the body is articulated: each section
    // rides the rail on its own (traffic.js poses them, tram-sweep.js and the rail guard cover them), so on a bend it follows
    // the track instead of one rigid 27 / 36 m box swinging its ends 1.3 m out over the deck's railing line
    return { geo: b.build(), length: L, width: W, height: H, paint: imperio ? '#f4c300' : '#f2c230', far, transit: 'tram', sections: secs.map(([z0, z1]) => ({ z0, z1 })) };
}

function mergeGeos(a, b) {
    const out = new Batch();
    for (const g of [a, b]) {
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, m = g.attributes.aMat;
        for (let i = 0; i < p.count; i++) {
            out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.nor.push(n.getX(i), n.getY(i), n.getZ(i));
            out.col.push(c.getX(i), c.getY(i), c.getZ(i)); out.mat.push(m.getX(i), m.getY(i), m.getZ(i), m.getW(i));
        }
        for (let i = 0; i < g.index.count; i++) out.idx.push(g.index.getX(i) + out.n);
        out.n += p.count;
    }
    return out.build();
}
