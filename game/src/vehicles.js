import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture } from './util.js';
import { drawFitText } from './canvasText.js';

// ============================================================================
//  VEHICLES — country-specific fleet of unbranded silhouettes with real L/W/H,
//  built from extruded side profiles. One geometry per kind (+ a ~150-tri far
//  LOD) with per-vertex aMat = (emissive code, roughness, metalness, painted).
//  Traffic uses the instanced path (one draw call per kind × LOD for all cars);
//  the classic path = painted body mesh (per-colour material) + parts mesh.
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
function beamM(a, b, w, h) {
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
    for (const s of [-1, 1]) b.add(BOX, M(s * (W / 2 + 0.004), o.wr * 0.78, (z0 + z1) / 2, 0.03, 0.1, z1 - z0), C.plastic, { r: 0.75 });
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
const CARS = {
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
function deliveryVan(pl) {
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
function boxTruck(pl) {
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
function policeCar(pl, city) {
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
function taxiCar(pl) {
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
function stbBus(pl, trolley = false) {
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
function kcmBus(pl, artic = false) {
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
function stbTram(kind = 'v3a') {
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
    return { geo: b.build(), length: L, width: W, height: H, paint: imperio ? '#f4c300' : '#f2c230', far, transit: 'tram' };
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

// ---------------------------------------------------------------------------
//  Kind registry, fleet mix, paint statistics
// ---------------------------------------------------------------------------
/** city used for plates / police livery / 'bus' alias when makeVehicle gets no `city` option (call per city load) */
let FLEET_CITY = 'bucharest';
export function setFleetCity(cityId) { FLEET_CITY = cityId === 'seattle' ? 'seattle' : 'bucharest'; }
const US = (city) => city === 'seattle';
const BUILDERS = {
    sedan: (c) => CARS.sedan(US(c) ? 'us' : 'eu'), 'compact-sedan': (c) => CARS['compact-sedan'](US(c) ? 'us' : 'eu'),
    hatch: (c) => CARS.hatch(US(c) ? 'us' : 'eu'), estate: (c) => CARS.estate(US(c) ? 'us' : 'eu'), 'small-suv': (c) => CARS['small-suv'](US(c) ? 'us' : 'eu'),
    crossover: (c) => CARS.crossover(US(c) ? 'us' : 'eu'), suv: (c) => CARS.suv(US(c) ? 'us' : 'eu'), 'ev-sedan': (c) => CARS['ev-sedan'](US(c) ? 'us' : 'eu'),
    minivan: (c) => CARS.minivan(US(c) ? 'us' : 'eu'), pickup: (c) => CARS.pickup(US(c) ? 'us' : 'eu'), van: (c) => CARS.van(US(c) ? 'us' : 'eu'),
    'delivery-van': (c) => deliveryVan(US(c) ? 'us' : 'eu'), truck: (c) => boxTruck(US(c) ? 'us' : 'eu'),
    taxi: (c) => taxiCar(US(c) ? 'us' : 'eu'), police: (c) => policeCar(US(c) ? 'us' : 'eu', c),
    'stb-bus': () => stbBus('eu'), trolleybus: () => stbBus('eu', true), 'kcm-bus': () => kcmBus('us'), 'kcm-artic': () => kcmBus('us', true),
    tram: () => stbTram('v3a'), 'tram-v3a': () => stbTram('v3a'), 'tram-imperio': () => stbTram('imperio'),
    bus: (c) => (US(c) ? kcmBus('us') : stbBus('eu')),
};
export const VEHICLE_KINDS = Object.keys(BUILDERS);
/** kinds that only make sense in one city (their plates follow it) */
const HOME = { 'stb-bus': 'bucharest', trolleybus: 'bucharest', tram: 'bucharest', 'tram-v3a': 'bucharest', 'tram-imperio': 'bucharest', 'kcm-bus': 'seattle', 'kcm-artic': 'seattle' };

// share of the moving car fleet per city (passenger cars + vans/trucks; transit, police and taxis on top are the
// caller's choice — Bucharest taxis are in the mix since they are ~5–10 % of central traffic)
const MIX = {
    bucharest: [['hatch', 0.2], ['compact-sedan', 0.19], ['estate', 0.11], ['small-suv', 0.13], ['sedan', 0.08], ['crossover', 0.05], ['taxi', 0.09], ['van', 0.05], ['delivery-van', 0.06], ['ev-sedan', 0.01], ['truck', 0.03]],
    seattle: [['crossover', 0.24], ['sedan', 0.15], ['pickup', 0.16], ['suv', 0.13], ['ev-sedan', 0.07], ['minivan', 0.06], ['hatch', 0.06], ['delivery-van', 0.05], ['van', 0.02], ['truck', 0.03], ['compact-sedan', 0.03]],
};
// body colour shares (European / US fleet surveys: white, grey, black and silver ≈ 70–80 % of cars)
const PAINT_EU = [[['#eef0f1', '#f6f6f3', '#e4e6e7'], 0.24], [['#6d7177', '#55595f', '#868a8f', '#3f4348'], 0.21], [['#111214', '#1b1d21'], 0.15], [['#b9bdc2', '#a5aab0'], 0.11],
    [['#1f3f7a', '#2a5291', '#17284a', '#3b6ea8'], 0.12], [['#9a1b1f', '#b3262b', '#6e1418'], 0.07], [['#5a4636', '#b8a78a', '#7a6a55'], 0.05], [['#2f4a3a', '#43573f'], 0.02], [['#c8641e', '#d6a81c'], 0.02], [['#5b2a3a'], 0.01]];
const PAINT_US = [[['#eef0f1', '#f6f6f3', '#e2e4e5'], 0.25], [['#111214', '#1b1d21', '#0c0d0f'], 0.22], [['#6d7177', '#55595f', '#868a8f', '#43474c'], 0.19], [['#b9bdc2', '#a5aab0'], 0.11],
    [['#1f3f7a', '#2a5291', '#17284a', '#3e6f99'], 0.09], [['#9a1b1f', '#b3262b', '#7a1418'], 0.09], [['#2f4a3a', '#56603f'], 0.02], [['#5a4636', '#8c7a5e'], 0.02], [['#c8641e', '#e0b324'], 0.01]];
const pickW = (list, r) => { let t = 0; for (const [, w] of list) t += w; let x = r() * t; for (const [k, w] of list) { if ((x -= w) <= 0) return k; } return list[list.length - 1][0]; };
const R01 = (rng) => (typeof rng === 'function' ? rng : Math.random);
/** the city's car mix as [[kind, weight], …] (weights sum to 1) — what traffic.js feature-detects */
export function fleetMix(cityId) { return MIX[cityId === 'seattle' ? 'seattle' : 'bucharest'].map(([k, w]) => [k, w]); }
/** a car kind for this city's moving traffic (weights = real fleet mix). rng: () → [0,1) (or an object with .random / the traffic RNG function) */
export function pickFleetKind(cityId, rng = Math.random) { return pickW(MIX[cityId === 'seattle' ? 'seattle' : 'bucharest'], R01(rng)); }
/** transit kind for a mode: 'bus' | 'trolleybus' | 'tram' (Bucharest trams: ~1/3 Imperio, rest V3A family; Seattle: ~30 % articulated) */
export function pickTransitKind(cityId, mode = 'bus', rng = Math.random) {
    const r = R01(rng)();
    if (cityId === 'seattle') return mode === 'bus' ? (r < 0.3 ? 'kcm-artic' : 'kcm-bus') : 'kcm-bus';
    if (mode === 'tram') return r < 0.35 ? 'tram-imperio' : 'tram-v3a';
    if (mode === 'trolleybus') return 'trolleybus';
    return 'stb-bus';
}
/** body colour for a kind in this city (fleet statistics; fixed liveries for taxis, police, transit, delivery vans mostly white) */
export function fleetColor(kind, cityId, rng = Math.random) {
    const r = R01(rng); const sea = cityId === 'seattle';
    if (kind === 'taxi') return sea ? '#f6f6f3' : '#f2c200';
    if (kind === 'police') return sea ? '#121316' : '#f4f5f7';
    if (HOME[kind] || kind === 'bus') return null; // livery
    if (kind === 'delivery-van' && r() < 0.75) return '#f3f4f2';
    if (kind === 'van' && r() < 0.45) return '#eef0f1';
    if (kind === 'truck') return pickW([['#eef0f1', 0.6], ['#c0322b', 0.1], ['#1f3f7a', 0.15], ['#55595f', 0.15]], r);
    const shades = pickW(sea ? PAINT_US : PAINT_EU, r);
    return shades[Math.floor(r() * shades.length) % shades.length];
}

const cache = {};
function vehicleModel(kind, city) {
    if (!BUILDERS[kind]) kind = 'sedan';
    const c = HOME[kind] || city || FLEET_CITY;
    const key = kind + '|' + (US(c) ? 'us' : 'eu');
    let m = cache[key];
    if (!m) {
        m = cache[key] = BUILDERS[kind](c);
        m.key = key; m.kind = kind;
        m.geo.computeBoundingSphere(); m.radius = Math.hypot(m.length / 2, m.width / 2, (m.height || 2) / 2);
        // split into painted body + parts for the classic (non-instanced) meshes
        m.split = null;
    }
    return m;
}
function splitModel(m, lod = 'near') {
    if (lod === 'parked') return m.splitParked || (m.splitParked = splitGeo(m.parked || m.far));
    return m.split || (m.split = splitGeo(m.geo));
}
function splitGeo(g) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, a = g.attributes.aMat, idx = g.index;
    const body = new Batch(), parts = new Batch(), map = [new Map(), new Map()];
    for (let i = 0; i < idx.count; i += 3) {
        const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        const painted = a.getW(tri[0]) > 0.5, tgt = painted ? body : parts, mp = map[painted ? 0 : 1];
        for (const v of tri) {
            let j = mp.get(v);
            if (j === undefined) {
                j = tgt.n++; mp.set(v, j);
                tgt.pos.push(p.getX(v), p.getY(v), p.getZ(v)); tgt.nor.push(n.getX(v), n.getY(v), n.getZ(v));
                tgt.col.push(c.getX(v), c.getY(v), c.getZ(v)); tgt.mat.push(a.getX(v), a.getY(v), a.getZ(v), 0);
            }
            tgt.idx.push(j);
        }
    }
    return { body: body.build(false), parts: parts.build() };
}

// ---------------------------------------------------------------------------
//  Materials
// ---------------------------------------------------------------------------
let ENV_MAP = null;
const allMats = new Set();
function track(m) { allMats.add(m); if (ENV_MAP) { m.envMap = ENV_MAP; m.needsUpdate = true; } return m; }

/** shared emissive decoding (see aMat): k = light factor (1 day / 4.5 night), br = brake 0..1 */
const EMIS_GLSL = `
    float eRaw = vMat.x; float isTail = step(9.5, eRaw) * (1.0 - step(19.5, eRaw)); float isSign = step(19.5, eRaw);
    float eBase = eRaw - 10.0 * isTail - 20.0 * isSign;
    float eK = mix(mix(1.0, 4.5, vLB.x), 2.2, isSign) + isTail * vLB.y * 2.6;
    totalEmissiveRadiance += diffuseColor.rgb * eBase * eK;`;
/** classic (per-mesh) parts material: uLB = (lights, brake) uniform */
function partsMaterial(lights) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 });
    m.userData.uLB = { value: new THREE.Vector2(lights, 0) };
    m.userData.uDirect = { value: 1 };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uLB = m.userData.uLB; sh.uniforms.uDirect = m.userData.uDirect;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nuniform vec2 uLB;\nuniform float uDirect;\n#define vLB uLB')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIS_GLSL);
    };
    m.customProgramCacheKey = () => 'vehicleParts2';
    return track(m);
}
/** instanced fleet material: one draw call per kind × LOD; per instance aPaint (linear rgb) + aLB (lights, brake) */
let FLEET_MAT = null, PARKED_MAT = null;
/** parked lots: same shader, half the sky reflection (dusty, seen from above they otherwise read washed-out next to the matte world) */
function parkedMaterial() { if (!PARKED_MAT) { PARKED_MAT = addSnow(newFleetMaterial(0.5), SNOW_PARKED); PARKED_MAT.userData.envScale = 0.5; PARKED_MAT.roughness = 1.6; PARKED_MAT.metalness = 0.4; } return PARKED_MAT; } // (roughness / metalness scale the per-vertex aMat values: paint 0.32 → 0.51, metal 0.3 → 0.12)
function fleetMaterial() { return FLEET_MAT || (FLEET_MAT = addSnow(newFleetMaterial(1.05))); }
function newFleetMaterial(envI) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: envI });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute vec3 aPaint;\nattribute vec2 aLB;\nvarying vec4 vMat;\nvarying vec2 vLB;')
            .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(color.rgb, aPaint, aMat.w);')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vLB = aLB;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nvarying vec2 vLB;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIS_GLSL);
    };
    m.customProgramCacheKey = () => 'vehicleFleet';
    m.userData.envScale = envI;
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
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vCab;\nuniform vec3 uOff;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vCab = position + uOff;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nvarying vec3 vCab;\nuniform float uDirect;\nuniform float uGlow;')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                // soft-touch grain on matte trim (8 mm cells, ±3 %): reads as leather-grain plastic, not flat paint
                float gn = fract(sin(dot(floor(vCab * 125.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
                float softT = step(0.62, vMat.y);
                diffuseColor.rgb *= 1.0 + softT * (gn - 0.5) * 0.07;`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y * (1.0 + softT * (gn - 0.5) * 0.12);')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                if (uGlow > 0.0) {
                    vec3 base = max(diffuseColor.rgb, vec3(0.035));
                    float gc = exp(-length((vCab - vec3(-0.3, 1.09, -1.15)) * vec3(1.0, 1.4, 1.0)) * 3.2); // gauge cluster
                    float gs = exp(-length(vCab - vec3(0.07, 1.04, -1.15)) * 3.6);                       // centre screen
                    float fill = 0.55 + 0.45 * smoothstep(0.5, 1.8, vCab.y);                              // city glow through the glass
                    vec3 glow = vec3(1.0, 0.72, 0.5) * gc * 0.7 + vec3(0.45, 0.65, 1.0) * gs * 0.5 + vec3(0.30, 0.36, 0.5) * 0.12 * fill;
                    totalEmissiveRadiance += (base * glow + diffuseColor.rgb * vMat.x * 2.5) * uGlow;
                }`);
    };
    m.customProgramCacheKey = () => 'cockpitInterior2';
    return track(m);
}
const partsMats = [[partsMaterial(0), partsMaterial(1)], [null, null]]; // [lights][brake]
function partsMat(light, brake) {
    const L = light ? 1 : 0, B = brake ? 1 : 0;
    if (!partsMats[B]) partsMats[B] = [null, null];
    if (!partsMats[B][L]) { partsMats[B][L] = partsMaterial(L); partsMats[B][L].userData.uLB.value.y = B; }
    return partsMats[B][L];
}
const bodyMats = {};
function bodyMat(color) {
    return bodyMats[color] || (bodyMats[color] = track(addSnow(new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.3, envMapIntensity: 1.1 }))));
}

// ---------------------------------------------------------------------------
//  Snow on cars (render Request): roofs / bonnets / boots (up-facing surfaces) turn white with the snow cover.
//  Two shared uniforms (parked cars full, moving fleet lighter); injected into every vehicle material, no extra draws.
// ---------------------------------------------------------------------------
const SNOW_PARKED = { value: 0 }, SNOW_MOVING = { value: 0 };
/** snow cover 0..1 (render.js: the weather's snowCover); moving cars get ~55 % of it */
export function setVehicleSnow(k = 0) { k = Math.max(0, Math.min(1, +k || 0)); SNOW_PARKED.value = k; SNOW_MOVING.value = k * 0.55; }
function addSnow(m, uni = SNOW_MOVING) {
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
        prev?.call(m, sh, r);
        sh.uniforms.uSnow = uni;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSnowY;')
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
                { vec3 snN = objectNormal;
                #ifdef USE_INSTANCING
                  snN = mat3(instanceMatrix) * snN;
                #endif
                  vec3 snW = mat3(modelMatrix) * snN; vSnowY = dot(snW, snW) > 1e-10 ? normalize(snW).y : 0.0; }`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSnowY;\nuniform float uSnow;')
            .replace('#include <normal_fragment_begin>', `float snK = uSnow * smoothstep(0.45, 0.85, vSnowY);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), snK); roughnessFactor = mix(roughnessFactor, 0.8, snK); metalnessFactor *= 1.0 - snK;
                #include <normal_fragment_begin>`);
    };
    const base = prevKey ? prevKey.call(m) : '';
    m.customProgramCacheKey = () => base + '|snow' + (uni === SNOW_PARKED ? 'P' : 'M');
    return m;
}

/** Give every vehicle material (existing and future) an environment map for reflections (call after PMREM). */
export function setVehicleEnvMap(tex, intensity = 1) {
    ENV_MAP = tex;
    for (const m of allMats) { m.envMap = tex; m.envMapIntensity = (m.userData.envScale || 1) * intensity; m.needsUpdate = true; }
}

// taxi sign + police lamps (shared)
let taxiSign = null;
function getTaxiSign() {
    if (taxiSign) return taxiSign;
    const tex = makeCanvasTexture(256, 96, (ctx, w, h) => {
        ctx.fillStyle = '#ffd400'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#111'; ctx.fillRect(0, h - 10, w, 10);
        ctx.textAlign = 'center'; ctx.fillStyle = '#111';
        drawFitText(ctx, 'TAXI', w / 2, (h - 10) / 2, w - 24, { maxSize: 72, minSize: 20, maxHeight: h - 18, lineHeight: 1, font: (s) => `bold ${s}px "Helvetica Neue", Arial, sans-serif`, label: 'taxi sign' });
    });
    const dark = new THREE.MeshBasicMaterial({ color: '#c9a800' });
    const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) });
    taxiSign = { geo: new THREE.BoxGeometry(0.8, 0.22, 0.24), mats: [dark, dark, dark, dark, face, face] };
    return taxiSign;
}
const POLICE_LAMP = new THREE.BoxGeometry(0.42, 0.1, 0.22);
function policeLamps(grp, bar) {
    const mL = new THREE.MeshBasicMaterial({ color: '#1e3a8a' }), mR = new THREE.MeshBasicMaterial({ color: FLEET_CITY === 'seattle' && bar.w > 1.15 ? '#7f1d1d' : '#1e3a8a' });
    const l = new THREE.Mesh(POLICE_LAMP, mL), r = new THREE.Mesh(POLICE_LAMP, mR);
    l.position.set(-bar.w / 4, bar.y, bar.z); r.position.set(bar.w / 4, bar.y, bar.z); l.userData.shared = r.userData.shared = true;
    grp.add(l, r);
    const redR = grp.userData.city === 'seattle';
    grp.userData.flash = (t) => {
        const ph = (t * 2.2) % 1, a = ph < 0.25 && (ph * 16 | 0) % 2 === 0, b = ph > 0.5 && ph < 0.75 && (ph * 16 | 0) % 2 === 0;
        mL.color.setRGB(a ? 0.4 : 0.03, a ? 0.8 : 0.06, a ? 6 : 0.25);
        if (redR) mR.color.setRGB(b ? 6 : 0.25, b ? 0.3 : 0.03, b ? 0.3 : 0.03); else mR.color.setRGB(b ? 0.4 : 0.03, b ? 0.8 : 0.06, b ? 6 : 0.25);
    };
    return [l, r];
}

// ---------------------------------------------------------------------------
//  Instanced fleet: every instanced vehicle of a kind (+ LOD) in a scene = 1 draw call.
//  Hooked into Scene.prototype.onBeforeRender (runs after the scene's matrixWorld update, before culling), so the
//  vehicle groups stay ordinary Object3Ds that callers move / hide / add / remove as before.
// ---------------------------------------------------------------------------
const LIVE = new Set();            // WeakRef<Group> of instanced vehicles
const SCENE_POOLS = new WeakMap(); // Scene → Map<key, Pool>
const FLEET_OPTS = { near: 70, nearBig: 140, far: 1200, margin: 8 };
export const fleetStats = { instances: 0, near: 0, far: 0, culled: 0, pools: 0, ms: 0 };
class Pool {
    constructor(geo, cast) { this.base = geo; this.cast = cast; this.cap = 0; this.n = 0; this.mesh = null; this.grow(32); }
    grow(cap) {
        const old = this.mesh;
        const g = new THREE.BufferGeometry();
        for (const k in this.base.attributes) g.setAttribute(k, this.base.attributes[k]);
        g.setIndex(this.base.index); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
        this.paint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.paint.setUsage(THREE.DynamicDrawUsage);
        this.lb = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); this.lb.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('aPaint', this.paint); g.setAttribute('aLB', this.lb);
        const mesh = new THREE.InstancedMesh(g, fleetMaterial(), cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; mesh.castShadow = this.cast; mesh.receiveShadow = true; mesh.count = 0;
        mesh.name = 'fleet'; mesh.userData.shared = true; mesh.userData.fleet = true;
        if (old) { // keep what this render already wrote
            mesh.instanceMatrix.array.set(old.instanceMatrix.array); this.paint.array.set(old.geometry.attributes.aPaint.array); this.lb.array.set(old.geometry.attributes.aLB.array);
            old.parent?.add(mesh); old.parent?.remove(old); old.geometry.dispose(); old.dispose?.();
        }
        this.mesh = mesh; this.cap = cap;
    }
}
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(), _cp = new THREE.Vector3(), _col = new THREE.Color();
function fleetBeforeRender(renderer, scene, camera) {
    if (!LIVE.size || !camera) return;
    const t0 = performance.now();
    let pools = SCENE_POOLS.get(scene);
    if (!pools) SCENE_POOLS.set(scene, pools = new Map());
    for (const p of pools.values()) p.n = 0;
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    _cp.setFromMatrixPosition(camera.matrixWorld);
    const now = t0 / 1000;
    let nNear = 0, nFar = 0, nCull = 0;
    for (const ref of LIVE) {
        const g = ref.deref();
        if (!g) { LIVE.delete(ref); continue; }
        let o = g, vis = true;
        while (o.parent) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (o !== scene || !vis || !scene.visible || !camera.layers.test(g.layers)) continue;
        const u = g.userData, e = g.matrixWorld.elements, m = u._model;
        // brake lights from the motion (decelerating or stopped in traffic), unless set explicitly / parked
        if (u._autoBrake && now - (u._tPrev || 0) > 0.04) {
            const dt = now - (u._tPrev || now - 1), dx = e[12] - (u._xPrev ?? e[12]), dz = e[14] - (u._zPrev ?? e[14]);
            const v = Math.hypot(dx, dz) / Math.max(dt, 1e-3), dv = v - (u._vPrev ?? v);
            const want = !u.parked && dt < 0.5 && (v < 0.4 ? (u._moved || false) : dv / dt < -0.9);
            if (v > 1) u._moved = true;
            u._brakeK += ((want ? 1 : 0) - u._brakeK) * Math.min(1, dt * 10);
            u._tPrev = now; u._xPrev = e[12]; u._zPrev = e[14]; u._vPrev = v;
        }
        _sp.center.set(e[12], e[13] + 1, e[14]); _sp.radius = m.radius + FLEET_OPTS.margin;
        const d = _sp.center.distanceTo(_cp);
        if (d > FLEET_OPTS.far || !_fr.intersectsSphere(_sp)) { nCull++; if (u._extras) for (const x of u._extras) x.visible = false; continue; }
        const near = d < (m.length > 7 ? FLEET_OPTS.nearBig : FLEET_OPTS.near);
        if (u._extras) for (const x of u._extras) x.visible = near;
        const key = m.key + (near ? '' : '|far');
        let p = pools.get(key);
        if (!p) { p = new Pool(near ? m.geo : m.far, near || m.length > 7); pools.set(key, p); }
        if (p.n >= p.cap) p.grow(p.cap * 2);
        const i = p.n++;
        p.mesh.instanceMatrix.array.set(e, i * 16);
        p.paint.array[i * 3] = u._paint.r; p.paint.array[i * 3 + 1] = u._paint.g; p.paint.array[i * 3 + 2] = u._paint.b;
        p.lb.array[i * 2] = u._lights ? 1 : 0; p.lb.array[i * 2 + 1] = u._brake ?? u._brakeK;
        if (near) nNear++; else nFar++;
    }
    for (const p of pools.values()) {
        const mesh = p.mesh;
        if (p.n && mesh.parent !== scene) scene.add(mesh);
        mesh.count = p.n; mesh.visible = p.n > 0;
        if (p.n) { mesh.instanceMatrix.needsUpdate = true; p.paint.needsUpdate = true; p.lb.needsUpdate = true; }
    }
    Object.assign(fleetStats, { instances: nNear + nFar, near: nNear, far: nFar, culled: nCull, pools: pools.size, ms: Math.round((performance.now() - t0) * 100) / 100 });
}
// other instanced renderers (crowd.js) that cull / fill per render call: fn(renderer, scene, camera)
const PRE_HOOKS = new Set();
/** register fn(renderer, scene, camera) to run in the shared Scene pre-render hook (before culling); returns the remover */
export function addPreRenderHook(fn) { PRE_HOOKS.add(fn); return () => PRE_HOOKS.delete(fn); }
export function getVehicleEnvMap() { return ENV_MAP; }
// install once (chained with any prototype hook present)
if (!THREE.Scene.prototype.__fleetHook) {
    const prev = THREE.Scene.prototype.onBeforeRender;
    THREE.Scene.prototype.onBeforeRender = function (renderer, scene, camera, rt) {
        prev?.call(this, renderer, scene, camera, rt);
        if (!camera) return;
        fleetBeforeRender(renderer, this, camera);
        for (const fn of PRE_HOOKS) fn(renderer, this, camera);
    };
    THREE.Scene.prototype.__fleetHook = true;
}
/** LOD / culling tuning: { near (m), nearBig (m, vehicles > 7 m), far (m), margin (m, frustum sphere padding for shadows) } */
export function setFleetOptions(o = {}) { Object.assign(FLEET_OPTS, o); }

/**
 * Create a vehicle. forward = −z, ground at y = 0. userData: length, width, height, kind, setLights(on), setBrake(on|null),
 * flash(t) (police). opts: { city: 'bucharest'|'seattle' (plates / police / 'bus' alias; default setFleetCity()),
 * instanced: true → no per-car meshes: drawn by the shared per-kind InstancedMeshes (≈ 1 draw call per kind and LOD),
 * near/far LOD + culling automatic; brake lights automatic from the motion (userData.parked = true disables) }.
 * Without `instanced` the group holds classic meshes (painted body + parts) — e.g. for baking into merged props.
 */
export function makeVehicle(kind, color, opts = {}) {
    const city = opts.city || FLEET_CITY;
    const m = vehicleModel(kind, city);
    if (m.paint && (m.transit || kind === 'police' || kind === 'taxi')) color = m.paint;
    else if (m.paint && !color) color = m.paint;
    if (!color) color = fleetColor(m.kind, city) || '#c9ccd1';
    const grp = new THREE.Group();
    const u = grp.userData;
    u.length = m.length; u.width = m.width; u.height = m.height; u.kind = m.kind; u.city = HOME[m.kind] || city; u.transit = m.transit || null;
    const extras = [];
    if (m.taxiSign) {
        const s = getTaxiSign();
        const sign = new THREE.Mesh(s.geo, s.mats); sign.userData.shared = true;
        sign.position.set(0, 1.66, 0.35); grp.add(sign); extras.push(sign);
    }
    if (m.bar) extras.push(...policeLamps(grp, m.bar));
    if (opts.instanced) {
        u._model = m; u._paint = new THREE.Color(color); u._lights = false; u._brake = null; u._brakeK = 0; u._autoBrake = true; u._extras = extras.length ? extras : null;
        u.instanced = true;
        u.setLights = (on) => { u._lights = !!on; };
        u.setBrake = (on) => { u._brake = on == null ? null : (on ? 1 : 0); };
        u.setColor = (c) => { u._paint.set(c); };
        LIVE.add(new WeakRef(grp));
        return grp;
    }
    const parkedLod = opts.lod === 'parked';
    if (parkedLod) { for (const x of extras) grp.remove(x); extras.length = 0; u.lod = 'parked'; }
    const sp = splitModel(m, parkedLod ? 'parked' : 'near');
    const body = new THREE.Mesh(sp.body, bodyMat(color));
    body.castShadow = true;
    const parts = new THREE.Mesh(sp.parts, partsMat(false, false));
    body.userData.shared = parts.userData.shared = true;
    if (extras.length) grp.remove(...extras);
    grp.add(body, parts); // children[0] = body, [1] = parts (spots/cars.js merges them), extras after
    if (extras.length) grp.add(...extras);
    let L = false, B = false;
    u.setLights = (on) => { L = !!on; parts.material = partsMat(L, B); };
    u.setBrake = (on) => { B = !!on; parts.material = partsMat(L, B); };
    return grp;
}
/**
 * Static parked cars as instanced meshes: one InstancedMesh per kind (the ~100–170-tri low model: closed tinted glass,
 * no interior / underside, lights off), per-instance body colour. cars: [{ kind, color?, x, y?, z, yaw }] (yaw = rotation.y,
 * forward −z; colour default = fleetColor). Returns a Group to add to the scene (call it per world cell to keep frustum
 * culling useful); group.userData = { count, triangles, drawCalls }. Not part of the per-frame fleet hook (zero CPU per frame).
 * group.userData.dispose() frees the per-group instance buffers (the shared model geometry stays).
 */
export function makeParkedCars(cars, { city, castShadow = true, receiveShadow = true, paintSpace = 'linear' } = {}) {
    const c0 = city || FLEET_CITY, grp = new THREE.Group(), byKey = new Map();
    for (const car of cars) {
        const m = vehicleModel(car.kind, c0); let e = byKey.get(m.key);
        if (!e) byKey.set(m.key, e = { m, list: [] });
        e.list.push(car);
    }
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    let tris = 0, n = 0; const owned = [];
    for (const { m, list } of byKey.values()) {
        const g = new THREE.BufferGeometry();
        const pg = m.parked || m.far;
        for (const k in pg.attributes) g.setAttribute(k, pg.attributes[k]);
        g.setIndex(pg.index);
        const paint = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3), lb = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2);
        g.setAttribute('aPaint', paint); g.setAttribute('aLB', lb);
        const mesh = new THREE.InstancedMesh(g, parkedMaterial(), list.length);
        list.forEach((c, i) => {
            mesh.setMatrixAt(i, _m.compose(_p.set(c.x, c.y || 0, c.z), _q.setFromAxisAngle(_y, c.yaw || 0), _s));
            col.set(m.transit || m.paint ? (m.paint || '#cccccc') : (c.color || fleetColor(m.kind, c0) || '#c9ccd1'));
            if (paintSpace === 'world') col.convertLinearToSRGB(); // world convention: hex bytes / 255 used as linear (as the old merged lots)
            paint.setXYZ(i, col.r, col.g, col.b);
        });
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
        mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow; mesh.name = 'parked-cars ' + m.kind; mesh.userData.parkedFleet = true;
        grp.add(mesh); owned.push(g);
        tris += list.length * pg.index.count / 3; n += list.length;
    }
    grp.userData = { count: n, triangles: tris, drawCalls: byKey.size, dispose: () => { for (const g of owned) { g.deleteAttribute('aPaint'); g.deleteAttribute('aLB'); g.dispose(); } } };
    return grp;
}
/** triangle count of a kind's near / far model (diagnostics) */
export function vehicleTriangles(kind, lod = 'near', city) { const m = vehicleModel(kind, city); const g = lod === 'far' ? m.far : lod === 'parked' ? (m.parked || m.far) : m.geo; return g.index.count / 3; }
/** model dimensions without building a mesh: { length, width, height, transit } */
export function vehicleSize(kind, city) { const m = vehicleModel(kind, city); return { length: m.length, width: m.width, height: m.height, transit: m.transit || null }; }

// ============================================================================
//  COCKPIT
// ============================================================================
const GAUGE_W = 512, GAUGE_H = 200;
function gaugeCanvas() {
    const c = document.createElement('canvas'); c.width = GAUGE_W; c.height = GAUGE_H;
    return c;
}
const gFont = (w) => (s) => `${w} ${s}px system-ui, "Helvetica Neue", Arial, sans-serif`;
const GF6 = gFont('600'), GF5 = gFont('500'), GF7 = gFont('700');
function drawGauges(ctx, speedMs, rpm01, fuel01, mph) {
    const W = GAUGE_W, H = GAUGE_H;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07090c'); bg.addColorStop(1, '#101419');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const dial = (cx, cy, r, max, step, label, value, redFrom) => {
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        ctx.lineWidth = 3; ctx.strokeStyle = '#2b3440'; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
        if (redFrom != null) { ctx.strokeStyle = '#c0262d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r - 3, a0 + (a1 - a0) * redFrom / max, a1); ctx.stroke(); }
        ctx.fillStyle = '#cfd8e3';
        for (let v = 0; v <= max + 1e-6; v += step / 2) {
            const a = a0 + (a1 - a0) * v / max, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
            ctx.strokeStyle = major ? '#e6edf5' : '#6b7787'; ctx.lineWidth = major ? 2.5 : 1.5;
            const r0 = r - (major ? 14 : 8);
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.stroke();
            if (major) drawFitText(ctx, String(Math.round(v)), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30), 30, { maxSize: 16, minSize: 9, font: GF6, label: 'gauge tick' });
        }
        ctx.fillStyle = '#7d8a99'; drawFitText(ctx, label, cx, cy + r * 0.47, r * 0.95, { maxSize: 13, minSize: 8, font: GF5, label: 'gauge label' });
        const a = a0 + (a1 - a0) * Math.min(value, max * 1.02) / max;
        ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 4; ctx.shadowColor = '#ff5a2a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.stroke();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1b2129'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    };
    const spd = Math.abs(speedMs) * (mph ? 2.23694 : 3.6);
    dial(110, 104, 88, mph ? 140 : 220, mph ? 20 : 40, mph ? 'MPH' : 'km/h', spd, null);
    dial(402, 104, 88, 8, 1, '×1000 rpm', rpm01 * 8, 6.5);
    // centre: digital speed + unit + fuel bar (each text fitted to the 112 px column between the dials)
    ctx.fillStyle = '#f2f6fa'; drawFitText(ctx, String(Math.round(spd)), 256, 82, 104, { maxSize: 46, minSize: 20, font: GF7, label: 'gauge speed' });
    ctx.fillStyle = '#7d8a99'; drawFitText(ctx, mph ? 'mph' : 'km/h', 256, 116, 90, { maxSize: 14, minSize: 9, font: GF5, label: 'gauge unit' });
    ctx.strokeStyle = '#2b3440'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(216, 158); ctx.lineTo(296, 158); ctx.stroke();
    ctx.strokeStyle = fuel01 < 0.15 ? '#ff8a1c' : '#5fd38d'; ctx.beginPath(); ctx.moveTo(216, 158); ctx.lineTo(216 + 80 * Math.max(0, Math.min(1, fuel01)), 158); ctx.stroke();
    ctx.fillStyle = '#7d8a99'; drawFitText(ctx, 'FUEL', 256, 178, 80, { maxSize: 12, minSize: 8, font: GF5, label: 'gauge fuel' });
}

// Driver eye in cockpit space (= player.js camHolder rest position). The dashboard parts are laid out by viewing
// angle from here so the cluster, the nav screen and the wheel never overlap at any FOV (72–86°) or aspect.
const EYE = new THREE.Vector3(-0.3, 1.36, -0.45);
const D2R = Math.PI / 180;
/** point at azimuth az (° right of straight ahead), elevation el (° below the horizon), distance dist from the eye */
const fromEye = (az, el, dist) => new THREE.Vector3(
    EYE.x + dist * Math.cos(el * D2R) * Math.sin(az * D2R), EYE.y - dist * Math.sin(el * D2R), EYE.z - dist * Math.cos(el * D2R) * Math.cos(az * D2R));
/** Euler (YXZ) that turns a +z-facing plane at p to face the eye */
const faceEyeEuler = (p) => { const n = EYE.clone().sub(p).normalize(); return new THREE.Euler(-Math.asin(n.y), Math.atan2(n.x, n.z), 0, 'YXZ'); };
// layout (degrees from the eye). FOV 72 puts the bottom of the view 36° below the horizon; the HUD's speedometer
// block starts ~41° right of centre at 16:9. Wheel rim top 27.5° (hub 44°, below the view), cluster above the
// rim, screen right of the rim and left of the HUD, everything below the windshield's bottom edge (rain overlay).
const CLUSTER = { az: 0, el: 20.6, dist: 0.75, w: 0.33, h: 0.33 * GAUGE_H / GAUGE_W, tilt: 18 };
const SCREEN = { az: 22, el: 20.5, dist: 0.86, w: 0.34, h: 0.2125, yaw: 0, tilt: 16 }; // integrated in the centre stack on the car's centreline, square to the dash (not turned toward the driver: after round 6), 16° back-tilt
const WHEEL = { pos: new THREE.Vector3(-0.3, 0.89, -0.945), tilt: -0.42, r: 0.178, tube: 0.02 };
const B_Z = 0.1; // front door rear edge / B-pillar (z, cockpit space): beside the front seat back, in view when looking 90° to the side
const MIRROR = { pos: new THREE.Vector3(0.0, 1.655, -1.125), w: 0.27, h: 0.09 };

/** centre-screen home page (512×320): clock, date, media card, nav hint — what the screen shows until the map is drawn */
function homeScreenCanvas() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d'), F = (w) => (sz) => `${w} ${sz}px system-ui, "Helvetica Neue", Arial, sans-serif`;
    let lastKey = '';
    const draw = (date = new Date()) => {
        const hh = String(date.getHours()).padStart(2, '0'), mm = String(date.getMinutes()).padStart(2, '0'), key = hh + mm;
        if (key === lastKey) return false; lastKey = key;
        const g = ctx.createLinearGradient(0, 0, 512, 320); g.addColorStop(0, '#0e1a2b'); g.addColorStop(0.6, '#0a1220'); g.addColorStop(1, '#16213a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
        ctx.fillStyle = 'rgba(80,140,220,0.10)'; ctx.beginPath(); ctx.arc(430, 40, 160, 0, 7); ctx.fill();
        // status bar
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, 512, 34);
        ctx.fillStyle = '#c7d2e0'; ctx.textAlign = 'left'; drawFitText(ctx, 'Home', 18, 17, 150, { maxSize: 15, minSize: 10, font: F('600'), label: 'screen home' });
        ctx.textAlign = 'right'; drawFitText(ctx, `${hh}:${mm}`, 494, 17, 90, { maxSize: 15, minSize: 10, font: F('600'), label: 'screen clock small' });
        // clock + date
        ctx.textAlign = 'left'; ctx.fillStyle = '#f4f7fb';
        drawFitText(ctx, `${hh}:${mm}`, 28, 112, 250, { maxSize: 84, minSize: 30, font: F('300'), label: 'screen clock' });
        ctx.fillStyle = '#8fa3bb';
        drawFitText(ctx, date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 30, 168, 250, { maxSize: 18, minSize: 11, font: F('500'), label: 'screen date' });
        // media card
        const card = (x, y, w, h) => { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 14) : ctx.rect(x, y, w, h); ctx.fill(); };
        card(300, 60, 186, 118);
        ctx.fillStyle = '#2b6cb0'; ctx.fillRect(316, 76, 44, 44); ctx.fillStyle = '#e6eef8'; ctx.textAlign = 'center';
        drawFitText(ctx, 'FM', 338, 98, 40, { maxSize: 16, minSize: 9, font: F('700'), label: 'screen fm' });
        ctx.textAlign = 'left'; ctx.fillStyle = '#f4f7fb'; drawFitText(ctx, 'Radio', 372, 88, 104, { maxSize: 16, minSize: 10, font: F('600'), label: 'screen radio' });
        ctx.fillStyle = '#8fa3bb'; drawFitText(ctx, '98.3 FM', 372, 110, 104, { maxSize: 14, minSize: 9, font: F('500'), label: 'screen station' });
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(316, 146, 154, 4); ctx.fillStyle = '#5fa8ff'; ctx.fillRect(316, 146, 62, 4);
        // tiles row
        const tiles = [['Navigation', '#3b82f6'], ['Phone', '#22c55e'], ['Media', '#f59e0b'], ['Settings', '#94a3b8']];
        tiles.forEach(([t, c], i) => {
            const x = 28 + i * 118; card(x, 206, 106, 78);
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 53, 236, 13, 0, 7); ctx.fill();
            ctx.fillStyle = '#c7d2e0'; ctx.textAlign = 'center'; drawFitText(ctx, t, x + 53, 268, 96, { maxSize: 13, minSize: 8, font: F('500'), label: 'screen tile' });
        });
        return true;
    };
    draw();
    return { canvas, draw };
}

/** The cockpit the player sits in. Coordinates in the car rig space (driver eye at (-0.3, 1.36, -0.45), forward -z). */
export function makeCockpit() {
    const g = new THREE.Group();
    g.userData.shared = true;
    const interior = new Batch();
    const DASH = '#16181b', DASH2 = '#1e2024', TRIM = '#303338', SOFT = '#202226', HEAD = '#2f2e2c', GLOSS = '#0b0c0e';
    const DR = { r: 0.85 }, DR2 = { r: 0.7 };
    // ---- windshield frame geometry (shared with wipers + rain shader) ----
    const cowl = new THREE.Vector3(0, 1.05, -1.78), header = new THREE.Vector3(0, 1.76, -1.06);
    const sAxis = new THREE.Vector3().subVectors(header, cowl); const wsLen = sAxis.length(); sAxis.normalize();
    const halfW0 = 0.76, halfW1 = 0.69;
    // ---- dashboard (extruded profile): top just under the glass, rounded lip, driver-facing front ----
    const dashProfile = [[-1.86, 0.5], [-1.86, 1.0], [-1.8, 1.036], [-1.6, 1.04], [-1.38, 1.03], [-1.27, 1.012], [-1.215, 0.985], [-1.2, 0.95],
        [-1.2, 0.86], [-1.215, 0.66], [-1.32, 0.56], [-1.5, 0.5]];
    interior.add(extrude(dashProfile, -0.8, 0.8), IDENT, DASH, DR);
    interior.add(BOX, M(0, 0.905, -1.197, 1.58, 0.05, 0.012), TRIM, { r: 0.4, m: 0.3 }); // trim strip across the dash face
    interior.add(BOX, M(0.5, 0.79, -1.207, 0.5, 0.004, 0.012), '#0d0e10', { r: 0.6 });   // glovebox seam
    interior.add(BOX, M(0.5, 0.74, -1.205, 0.08, 0.018, 0.016), '#3a3d42', { r: 0.4, m: 0.4 }); // glovebox latch
    // outboard air vents (dark grille + two slats)
    for (const x of [-0.66, 0.66]) {
        interior.add(BOX, M(x, 0.958, -1.2, 0.15, 0.06, 0.014), '#0d0e10', { r: 0.6 });
        for (const dy of [-0.012, 0.012]) interior.add(BOX, M(x, 0.958 + dy, -1.192, 0.14, 0.006, 0.006), '#3a3d42', { r: 0.4, m: 0.4 });
    }
    interior.add(BOX, M(-0.68, 0.8, -1.205, 0.1, 0.05, 0.016), '#24272b', DR2); // light switch panel
    // stitching hints: dashed seam along the dash lip (passenger half) and over the door armrests
    for (let x = 0.2; x < 0.76; x += 0.026) interior.add(BOX, M(x, 0.972, -1.21, 0.013, 0.003, 0.004), '#4d4a44', { r: 0.8 });
    for (const sx of [-1, 1]) for (let z = -0.6; z < -0.1; z += 0.026) interior.add(BOX, M(sx * 0.72, 0.851, z, 0.004, 0.003, 0.013), '#4a4741', { r: 0.8 });
    // firewall / footwell front (closes the gap under the dash) + floor
    interior.add(BOX, M(0, 0.56, -1.79, 1.56, 0.26, 0.1), '#141518', { r: 0.95 });

    // ---- instrument cluster pod: a binnacle on the dash top, seen over the steering-wheel rim ----
    const cPos = fromEye(CLUSTER.az, CLUSTER.el, CLUSTER.dist), cRot = new THREE.Euler(-CLUSTER.tilt * D2R, 0, 0, 'YXZ'); // square to the car axis, leaned back like a real binnacle
    {
        // profile along the cluster face (tilted toward the eye), 8 mm behind it, with a short visor on top
        const up = new THREE.Vector3(0, 1, 0).applyEuler(cRot), nrm = new THREE.Vector3(0, 0, 1).applyEuler(cRot);
        const top = cPos.clone().addScaledVector(up, CLUSTER.h / 2).addScaledVector(nrm, -0.008);
        const bot = cPos.clone().addScaledVector(up, -CLUSTER.h / 2).addScaledVector(nrm, -0.008);
        const tip = top.clone().addScaledVector(up, 0.012).addScaledVector(nrm, 0.02);
        const pod = [[bot.z + 0.004, 0.94], [bot.z + 0.004, bot.y - 0.004], [bot.z, bot.y], [top.z, top.y], [tip.z, tip.y], [tip.z - 0.02, tip.y + 0.012],
            [-1.3, tip.y + 0.01], [-1.44, 1.06], [-1.44, 0.94]];
        const hw = CLUSTER.w / 2 + 0.012;
        interior.add(extrude(pod, cPos.x - hw, cPos.x + hw), IDENT, DASH2, DR);
    }
    const gc = gaugeCanvas(), gctx = gc.getContext('2d');
    const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 4;
    drawGauges(gctx, 0, 0.1, 0.72, false);
    const cluster = new THREE.Mesh(new THREE.PlaneGeometry(CLUSTER.w, CLUSTER.h), new THREE.MeshBasicMaterial({ map: gtex, toneMapped: false }));
    cluster.name = 'cluster';
    cluster.position.copy(cPos); cluster.rotation.copy(cRot);
    g.add(cluster);
    g.userData.cluster = cluster;

    // ---- centre screen integrated at the top of the centre stack: square to the dash, mild driver yaw + back-tilt ----
    const sPos = fromEye(SCREEN.az, SCREEN.el, SCREEN.dist), sRot = new THREE.Euler(-SCREEN.tilt * D2R, -SCREEN.yaw * D2R, 0, 'YXZ');
    {
        // centre stack under the screen, aligned with the screen's yaw (front face just behind the bezel's bottom edge)
        const yawM = new THREE.Matrix4().makeRotationY(sRot.y), at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(yawM).add(sPos);
        const down = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(sRot.x, 0, 0)); // screen "down" in the yaw frame
        const bz = down.z * (SCREEN.h / 2 + 0.014), by = down.y * (SCREEN.h / 2 + 0.014);  // bezel bottom edge (yaw frame)
        const stackTop = by - 0.004, stackFront = bz - 0.03, stackBottom = 0.6 - sPos.y;
        const sc = at(0, (stackTop + stackBottom) / 2, stackFront - 0.07);
        const SM = (x, y, z, sx, sy, sz) => M(at(x, y, z).x, at(x, y, z).y, at(x, y, z).z, sx, sy, sz, 0, sRot.y, 0);
        interior.add(BOX, M(sc.x, sc.y, sc.z, 0.3, stackTop - stackBottom, 0.14, 0, sRot.y, 0), DASH2, DR2);
        // stack face: two centre vents, climate strip with knobs, hazard button
        for (const x of [-0.075, 0.075]) {
            interior.add(BOX, SM(x, stackTop - 0.045, stackFront + 0.002, 0.11, 0.05, 0.01), '#0d0e10', { r: 0.6 });
            for (const dy of [-0.01, 0.01]) interior.add(BOX, SM(x, stackTop - 0.045 + dy, stackFront + 0.008, 0.1, 0.005, 0.006), '#3a3d42', { r: 0.4, m: 0.4 });
        }
        interior.add(BOX, SM(0, stackTop - 0.1, stackFront + 0.004, 0.06, 0.03, 0.012), '#7a1d1f', { r: 0.4 }); // hazard
        interior.add(BOX, SM(0, stackTop - 0.165, stackFront + 0.002, 0.26, 0.07, 0.01), '#111214', { r: 0.25, m: 0.2 }); // climate panel
        for (const x of [-0.09, 0.09]) interior.add(new THREE.CylinderGeometry(0.022, 0.024, 0.024, 12), M(at(x, stackTop - 0.165, stackFront + 0.014).x, at(x, stackTop - 0.165, stackFront + 0.014).y, at(x, stackTop - 0.165, stackFront + 0.014).z, 1, 1, 1, Math.PI / 2, sRot.y, 0), '#4a4e55', { r: 0.35, m: 0.6 });
        for (let i = -1; i <= 1; i++) interior.add(BOX, SM(i * 0.035, stackTop - 0.165, stackFront + 0.008, 0.024, 0.014, 0.004), '#5d6670', { e: 0.6, r: 0.4 });
    }
    // home screen (clock, media, hint) shown wherever the assigned map texture is still empty (alpha 0: e.g. before the
    // navigation's first draw), plus an anti-glare glass finish (soft sheen, faint daylight veil, dimmer at night)
    const home = homeScreenCanvas(), htex = new THREE.CanvasTexture(home.canvas); htex.colorSpace = THREE.SRGBColorSpace; htex.anisotropy = 4;
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
    const screenMat = new THREE.MeshBasicMaterial({ map: blank, color: '#ffffff', toneMapped: false });
    screenMat.userData.uHome = { value: htex }; screenMat.userData.uScreen = { value: new THREE.Vector2(1, 0.035) }; // (brightness, veil)
    screenMat.onBeforeCompile = (sh) => {
        sh.uniforms.uHome = screenMat.userData.uHome; sh.uniforms.uScreen = screenMat.userData.uScreen;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uHome;\nuniform vec2 uScreen;')
            .replace('#include <map_fragment>', `#include <map_fragment>
            #ifdef USE_MAP
                vec4 homeC = texture2D(uHome, vMapUv);
                diffuseColor.rgb = mix(homeC.rgb, diffuseColor.rgb / max(sampledDiffuseColor.a, 1e-3) * sampledDiffuseColor.a, step(0.02, sampledDiffuseColor.a));
                float sheen = smoothstep(0.35, 1.0, vMapUv.y * 0.8 + (1.0 - vMapUv.x) * 0.5) * 0.05;
                diffuseColor.rgb = diffuseColor.rgb * uScreen.x * 0.92 + vec3(uScreen.y + sheen) * (0.6 + 0.4 * uScreen.x);
                diffuseColor.a = 1.0;
            #endif`);
    };
    screenMat.customProgramCacheKey = () => 'carScreen1';
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
    screen.name = 'screen';
    screen.position.copy(sPos); screen.rotation.copy(sRot);
    // housing: glossy bezel just behind the glass + a deeper back shell (children: they follow the screen)
    const housingMat = track(new THREE.MeshStandardMaterial({ color: GLOSS, roughness: 0.12, metalness: 0.35 })); // piano black
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w + 0.028, SCREEN.h + 0.028, 0.026), housingMat);
    bezel.position.z = -0.0135; bezel.name = 'screen-bezel'; screen.add(bezel);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w - 0.03, SCREEN.h - 0.03, 0.05), new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.8 }));
    shell.position.z = -0.045; shell.name = 'screen-shell'; screen.add(shell);
    g.add(screen);
    g.userData.screen = screen;

    // ---- centre console between the seats ----
    interior.add(BOX, M(0.03, 0.5, -0.62, 0.26, 0.2, 1.1), DASH2, DR2);
    interior.add(BOX, M(0.03, 0.605, -0.86, 0.2, 0.012, 0.3), '#111214', { r: 0.3, m: 0.2 }); // gear selector bezel
    interior.add(BOX, M(0.03, 0.66, -0.84, 0.035, 0.1, 0.05), '#26292d', { r: 0.5 });       // selector
    interior.add(BOX, M(0.03, 0.62, 0.1, 0.22, 0.08, 0.36), DASH2, DR2);                     // armrest
    // ---- A-pillars (slim), header, headliner, visors ----
    for (const s of [-1, 1]) {
        const a = new THREE.Vector3(s * (halfW0 + 0.03), 1.04, -1.79), b = new THREE.Vector3(s * (halfW1 + 0.03), 1.77, -1.05);
        interior.add(BOX, beamM(a, b, 0.05, 0.034), HEAD, { r: 0.9 });
    }
    interior.add(BOX, M(0, 1.79, -0.94, 1.56, 0.06, 0.24), HEAD, { r: 0.95 }); // header
    interior.add(BOX, M(0, 1.83, -0.1, 1.6, 0.04, 1.5), HEAD, { r: 0.95 }); // headliner
    interior.add(BOX, M(-0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 }); // driver visor (stowed)
    interior.add(BOX, M(0.33, 1.752, -0.93, 0.4, 0.018, 0.17), '#3f3d39', { r: 0.95 });
    // rear-view mirror mount: foot glued to the glass, stalk, housing behind the mirror glass (glass = player.js)
    {
        const tWs = (1.738 - cowl.y) / (header.y - cowl.y), foot = cowl.clone().addScaledVector(sAxis, tWs * wsLen).add(new THREE.Vector3(MIRROR.pos.x, 0, 0.012));
        interior.add(BOX, M(foot.x, foot.y, foot.z, 0.04, 0.024, 0.02, -0.75), '#1a1b1e', { r: 0.6 });
        const back = MIRROR.pos.clone().add(new THREE.Vector3(0, 0.03, -0.03));
        interior.add(BOX, beamM(foot, back, 0.016, 0.016), '#1a1b1e', { r: 0.6 });
    }
    // ---- doors (left = driver, right = passenger): panel, belt line trim, armrest, handle, window frame ----
    for (const s of [-1, 1]) {
        const x = s * 0.8;
        interior.add(extrude([[-1.75, 0.43], [-1.75, 1.0], [-1.6, 1.07], [B_Z, 1.07], [B_Z, 0.43]], x - 0.03, x + 0.03), IDENT, SOFT, DR);
        interior.add(BOX, M(x - s * 0.035, 1.075, (-1.6 + B_Z) / 2, 0.05, 0.03, B_Z + 1.6), TRIM, { r: 0.5, m: 0.2 });
        interior.add(BOX, M(x - s * 0.012, 1.098, (-1.15 + B_Z) / 2, 0.03, 0.02, B_Z + 1.15), '#0c0d0f', { r: 0.6 }); // window channel seal at the sill
        // door window frame (#25): front edge up the A-pillar, top rail ~0.3 m above the eye (real greenhouse height),
        // sloping roof-side panel up to the headliner — what frames the side window when the driver looks left/right
        interior.add(BOX, beamM(new THREE.Vector3(s * 0.8, 1.09, -1.18), new THREE.Vector3(s * 0.795, 1.64, -1.02), 0.04, 0.05), HEAD, { r: 0.92 });
        interior.add(BOX, beamM(new THREE.Vector3(s * 0.795, 1.655, -1.03), new THREE.Vector3(s * 0.795, 1.655, B_Z), 0.05, 0.045), HEAD, { r: 0.92 });
        interior.add(BOX, M(s * 0.705, 1.745, (-1.02 + 1.3) / 2, 0.27, 0.02, 2.32, 0, 0, s < 0 ? 0.76 : Math.PI - 0.76), HEAD, { r: 0.95 });
        interior.add(BOX, M(s * 0.74, 1.70, -0.25, 0.03, 0.03, 0.22), '#3a3936', { r: 0.8 }); // grab handle
        // mirror sail (triangle trim at the front lower corner of the window)
        interior.add(extrude([[-1.6, 1.07], [-1.15, 1.07], [-1.15, 1.2], [-1.3, 1.07]], x - 0.025, x + 0.025), IDENT, SOFT, DR);
        interior.add(BOX, M(x - s * 0.08, 0.82, -0.35, 0.1, 0.06, 0.6), DASH2, DR2);
        interior.add(BOX, M(x - s * 0.04, 0.95, -0.95, 0.02, 0.04, 0.12), '#8d939a', { r: 0.3, m: 0.8 });
        interior.add(BOX, M(x - s * 0.035, 0.6, -0.9, 0.012, 0.16, 0.5), '#1a1b1e', { r: 0.9 }); // door pocket
        // door skin behind the trim: what you see when the camera's near plane (0.4 m) cuts the driver's door
        // panel at the edge of a very wide view (21:9) — keeps the outside from showing through below the belt line
        // (driver side further out: the eye is only 0.47 m from that panel)
        if (s < 0) interior.add(BOX, M(-0.985, 0.71, -0.2, 0.03, 0.58, 3.4), '#141518', { r: 0.95 });
        else interior.add(BOX, M(0.93, 0.75, -0.2, 0.03, 0.66, 3.4), '#141518', { r: 0.95 });
        // exterior side mirror (painted housing, mirror glass facing back, arm to the door)
        interior.add(BOX, M(s * 1.0, 1.12, -1.6, 0.18, 0.11, 0.1), '#a3242a', { r: 0.3, m: 0.3 });
        interior.add(BOX, M(s * 1.0, 1.12, -1.548, 0.155, 0.085, 0.006), '#5d6f80', { r: 0.02, m: 1 });
        interior.add(BOX, M(s * 0.88, 1.09, -1.62, 0.1, 0.035, 0.05), '#1a1b1e');
    }
    // roof skin above the headliner + roof rails above the side windows (same reason as the door skin, when
    // looking up: the headliner/rails can be cut by the near plane, and nothing may show sky above the windows)
    interior.add(BOX, M(0, 2.12, 0.1, 1.72, 0.03, 2.1), '#141518', { r: 0.95 });
    interior.add(BOX, M(0, 1.845, -0.99, 1.66, 0.03, 0.2), HEAD, { r: 0.95 });   // over the windshield header
    for (const s of [-1, 1]) {
        interior.add(BOX, M(s * 0.81, 1.85, 0.08, 0.06, 0.1, 2.36), HEAD, { r: 0.95 });
        interior.add(BOX, M(s * 0.86, 1.99, 0.0, 0.03, 0.3, 2.1), '#141518', { r: 0.95 }); // roof edge skin
    }
    // cowl panel (between windshield and hood)
    interior.add(BOX, M(0, 1.0, -1.88, 1.7, 0.03, 0.2), '#121315', { r: 0.8 });
    // night ambient strips (emit only with the cabin glow): along the dash trim + door belt lines
    interior.add(BOX, M(0, 0.877, -1.196, 1.5, 0.006, 0.006), '#2c4766', { e: 2.6, r: 0.5 });
    for (const s of [-1, 1]) interior.add(BOX, M(s * 0.762, 1.052, -0.75, 0.004, 0.006, 1.7), '#2c4766', { e: 1.8, r: 0.5 });
    // floor, front seats (passenger complete; driver cushion + lower back; the driver's upper back + headrest is a
    // separate mesh hidden while looking back, as if the head turned past it)
    const SEAT = '#26272b', SEAT2 = '#1c1d20', CARPET = '#141518', FAB = { r: 0.95 };
    interior.add(BOX, M(0, 0.43, -0.4, 1.56, 0.03, 2.7), CARPET, FAB);
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
    const interiorMat = cockpitMaterial();
    const interiorMesh = new THREE.Mesh(interior.build(), interiorMat);
    interiorMesh.name = 'interior'; interiorMesh.receiveShadow = true; g.add(interiorMesh);
    const driverBackMesh = new THREE.Mesh(driverBack.build(), interiorMat);
    driverBackMesh.name = 'driver-seat-back'; driverBackMesh.receiveShadow = true; g.add(driverBackMesh);
    g.userData.driverSeatBack = driverBackMesh;

    // ---- rear cabin (seen when looking back / around) ----
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
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.78, 1.06, B_Z + 0.1), new THREE.Vector3(s * 0.76, 1.8, B_Z + 0.08), 0.07, 0.19), HEAD, { r: 0.9 });
        rear.add(BOX, M(s * 0.74, 1.56, B_Z + 0.06, 0.012, 0.05, 0.04), '#3a3b3e', { r: 0.6 }); // belt anchor
        // C-pillar trim panel between the rear door window and the rear glass
        rear.add(extrude([[0.98, 1.79], [rwTop[0], rwTop[1]], [rwBot[0], rwBot[1]], [1.74, 1.07], [1.22, 1.07]], s > 0 ? 0.70 : -0.85, s > 0 ? 0.85 : -0.70), IDENT, HEAD, { r: 0.92 });
        // rear door: panel, belt trim, armrest, handle, window frame (open, like the front windows)
        rear.add(extrude([[B_Z + 0.02, 0.43], [B_Z + 0.02, 1.07], [1.3, 1.07], [1.3, 0.43]], s * 0.8 - 0.03, s * 0.8 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.765, 1.075, (B_Z + 1.3) / 2, 0.05, 0.03, 1.3 - B_Z), TRIM, { r: 0.5, m: 0.2 });
        rear.add(BOX, M(s * 0.72, 0.8, 0.95, 0.1, 0.06, 0.5), DASH2, DR2);
        rear.add(BOX, M(s * 0.76, 0.95, 0.6, 0.02, 0.04, 0.1), '#8d939a', { r: 0.3, m: 0.8 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.795, 1.655, B_Z), new THREE.Vector3(s * 0.79, 1.655, 1.05), 0.05, 0.045), HEAD, { r: 0.95 });
        rear.add(BOX, beamM(new THREE.Vector3(s * 0.775, 1.07, 1.22), new THREE.Vector3(s * 0.755, 1.79, 0.98), 0.045, 0.04), HEAD, { r: 0.95 });
        // rear quarter panel beside the bench, wheel-arch hump
        rear.add(extrude([[1.3, 0.43], [1.3, 1.07], [1.74, 1.07], [1.86, 0.9], [1.86, 0.43]], s * 0.79 - 0.03, s * 0.79 + 0.03), IDENT, SOFT, DR);
        rear.add(BOX, M(s * 0.7, 0.62, 1.3, 0.14, 0.2, 0.5), SOFT, DR);
    }
    // roof headliner over the rear cabin + dome light
    rear.add(BOX, M(0, 1.83, 0.93, 1.5, 0.04, 0.58), HEAD, { r: 0.95 });
    rear.add(BOX, M(0, 1.806, 0.55, 0.18, 0.012, 0.08), '#d9d6cf', { e: 0.25, r: 0.6 });
    rear.add(BOX, M(0, 0.43, 0.95, 1.56, 0.03, 1.1), CARPET, FAB); // rear floor
    rear.add(BOX, M(0, 0.5, 0.35, 0.3, 0.12, 0.5), DASH2, DR2);       // tunnel / rear console end
    const rearMesh = new THREE.Mesh(rear.build(), interiorMat);
    rearMesh.name = 'rear-cabin'; rearMesh.receiveShadow = true; g.add(rearMesh);
    g.userData.rearCabin = rearMesh;

    // ---- hood (painted, tapered toward the nose) ----
    const hoodGeo = extrude([[-1.86, 1.0], [-3.3, 0.88], [-3.42, 0.8], [-3.4, 0.6], [-1.86, 0.6]], -0.87, 0.87, (x, y, z) => 1 - 0.12 * THREE.MathUtils.clamp((-z - 1.86) / 1.5, 0, 1));
    const hood = new THREE.Mesh(hoodGeo, track(new THREE.MeshStandardMaterial({ color: '#b3262b', roughness: 0.34, metalness: 0.3 })));
    hood.material.userData.envScale = 0.55; hood.receiveShadow = true; hood.name = 'hood'; g.add(hood);
    g.userData.hood = hood;
    // trunk lid behind the rear window
    const trunk = new THREE.Mesh(extrude([[1.74, 1.12], [2.25, 1.04], [2.36, 0.92], [2.36, 0.6], [1.74, 0.6]], -0.82, 0.82), hood.material);
    trunk.receiveShadow = true; trunk.name = 'trunk'; g.add(trunk);

    // ---- shadow proxy (lower body + roof + pillars): casts the car's shadow, never drawn (stays on layer 0) ----
    const proxyB = new Batch();
    proxyB.add(BOX, M(0, 0.62, -0.2, 1.78, 0.66, 4.4));
    proxyB.add(BOX, M(0, 1.8, 0.05, 1.5, 0.06, 2.4)); // roof incl. the rear cabin
    for (const s of [-1, 1]) proxyB.add(BOX, beamM(new THREE.Vector3(s * 0.79, 1.05, -1.79), new THREE.Vector3(s * 0.72, 1.76, -1.14), 0.08, 0.08));
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.78, 1.4, B_Z + 0.09, 0.06, 0.75, 0.19));  // B-pillars
    for (const s of [-1, 1]) proxyB.add(BOX, M(s * 0.76, 1.4, 1.35, 0.06, 0.72, 0.5));   // C-pillars
    const proxy = new THREE.Mesh(proxyB.build(false), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.castShadow = true; proxy.renderOrder = -10; proxy.name = 'shadow-proxy'; g.add(proxy);

    // ---- steering wheel (low enough that the cluster reads over the rim) ----
    const wb = new Batch(), WR = WHEEL.r;
    wb.add(new THREE.TorusGeometry(WR, WHEEL.tube, 7, 28), IDENT, '#151619', { r: 0.65 });
    wb.add(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), M(0, 0, 0.012, 1, 1, 1, Math.PI / 2), '#1d1f22', { r: 0.7 });
    wb.add(BOX, M(0, -0.005, 0.04, 0.09, 0.07, 0.012), '#25282c', { r: 0.6 }); // airbag pad (logo-less)
    for (const a of [0, Math.PI, -Math.PI / 2]) {
        const r = WR * 0.65, l = WR * 0.7, vert = a === -Math.PI / 2;
        wb.add(BOX, M(Math.cos(a) * r, Math.sin(a) * r * (vert ? 0.95 : 1) - (vert ? 0 : 0.02), 0.01, vert ? 0.05 : l, vert ? l : 0.05, 0.02), '#1d1f22', { r: 0.6 });
    }
    wb.add(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 8), M(0, 0, -0.18, 1, 1, 1, Math.PI / 2), '#141517', { r: 0.8 }); // column
    const wheel = new THREE.Group();
    const wheelMat = cockpitMaterial(WHEEL.pos);
    const wheelMesh = new THREE.Mesh(wb.build(), wheelMat);
    wheelMesh.name = 'steering-wheel';
    wheel.add(wheelMesh);
    wheel.position.copy(WHEEL.pos); wheel.rotation.x = WHEEL.tilt;
    g.add(wheel);
    g.userData.wheel = wheel;

    let last = { s: -1, r: -1, f: -1, u: null }, lastT = 0;
    g.userData.updateGauges = (speedMs, rpm01 = 0.1, fuel01 = 0.7, mph = false) => {
        const now = performance.now();
        const s = Math.round(Math.abs(speedMs) * 3.6), r = Math.round(rpm01 * 80), f = Math.round(fuel01 * 50);
        if (s === last.s && r === last.r && f === last.f && mph === last.u) return;
        if (now - lastT < 66) return; // ≤ 15 Hz uploads
        lastT = now; last = { s, r, f, u: mph };
        drawGauges(gctx, speedMs, rpm01, fuel01, mph); gtex.needsUpdate = true;
    };

    // ---- rear-view mirror placement (the mirror glass + its camera live in player.js) ----
    {
        const q = new THREE.Quaternion().setFromEuler(faceEyeEuler(MIRROR.pos));
        // housing: black plastic shell around / behind the glass (player.js draws the glass + its thin frame), rounded ends
        const hb = new Batch(), nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const hm = (off, sx, sy, sz) => new THREE.Matrix4().compose(MIRROR.pos.clone().addScaledVector(nrm, off), q, new THREE.Vector3(sx, sy, sz));
        hb.add(BOX, hm(-0.02, MIRROR.w + 0.026, MIRROR.h + 0.026, 0.026), '#121315', { r: 0.45, m: 0.1 });
        hb.add(BOX, hm(-0.042, MIRROR.w - 0.02, MIRROR.h - 0.01, 0.03), '#141517', { r: 0.6 });
        for (const sx of [-1, 1]) {
            const c = new THREE.CylinderGeometry((MIRROR.h + 0.026) / 2, (MIRROR.h + 0.026) / 2, 0.026, 10);
            const end = MIRROR.pos.clone().addScaledVector(nrm, -0.02).add(new THREE.Vector3(sx * (MIRROR.w / 2 + 0.013), 0, 0).applyQuaternion(q));
            hb.add(c, new THREE.Matrix4().compose(end, q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))), new THREE.Vector3(1, 1, 1)), '#121315', { r: 0.45, m: 0.1 });
        }
        const housing = new THREE.Mesh(hb.build(), interiorMat); housing.name = 'mirror-housing'; g.add(housing);
        g.userData.mirrorMount = {
            position: MIRROR.pos.clone(), quaternion: q, width: MIRROR.w, height: MIRROR.h,
            // camera: centred, under the roof, looking straight back through the rear window; nothing of the car is
            // drawn for it (every cockpit mesh is on layer 1, the mirror camera renders layer 0 only)
            camPosition: new THREE.Vector3(0, 1.52, 0.9), camRotation: new THREE.Euler(-0.04, Math.PI, 0, 'YXZ'), camFov: 30,
        };
    }

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
    let homeT = 0;
    g.userData.tick = (dt) => {
        if ((homeT -= dt) <= 0) { homeT = 5; if (home.draw()) htex.needsUpdate = true; }
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
    g.userData.setNightGlow = (k) => { interiorMat.userData.uGlow.value = wheelMat.userData.uGlow.value = k; screenMat.userData.uScreen.value.set(1 - 0.3 * k, 0.035 * (1 - k)); }; // screen: dimmed at night, faint daylight veil by day

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
    /**
     * Driving view per viewport aspect (camera = player.js camHolder child). Landscape: the layout above (eye at EYE, FOV 72).
     * Portrait phones (aspect < 1): the eye moves back / up / toward the centre, the view turns 9° right and the vertical FOV
     * opens to ~92° so the cluster AND the nav screen sit in the lower third, between the top HUD cards and the touch pad.
     * → { fov (vertical, °, at rest; add the speed zoom on top), yaw (rad, + = left), pitch (rad), eye: Vector3 offset }
     */
    const _pv = { fov: 72, yaw: 0, pitch: 0, eye: new THREE.Vector3() };
    g.userData.viewFor = (aspect = 16 / 9) => {
        const a = THREE.MathUtils.clamp((1 - aspect) / (1 - 390 / 844), 0, 1);
        _pv.fov = 72 + 20 * a; _pv.yaw = -9 * D2R * a; _pv.pitch = 0; _pv.eye.set(0.07 * a, 0.05 * a, 0.2 * a);
        return _pv;
    };
    g.userData.windshield = { origin: cowl.clone(), u: new THREE.Vector3(1, 0, 0), s: sAxis.clone(), len: wsLen, halfW0, halfW1, wipers: wiperDefs };
    // Every visible cockpit mesh lives on layer 1: the main camera renders layers 0 + 1 (render.js), the rear-view
    // mirror camera only layer 0, so no part of the car can ever show up in the mirror. The invisible shadow proxy
    // stays on layer 0 (shadow casting). Raycasts against the cockpit need raycaster.layers.enable(1).
    g.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && o !== proxy) o.layers.set(1); });
    return g;
}
