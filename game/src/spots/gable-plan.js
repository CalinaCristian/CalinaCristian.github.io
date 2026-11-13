// ============================================================================
//  A gabled roof over an irregular mapped plan, clipped to that plan: the ridge runs along a chosen axis through the plan,
//  the two roof planes fall from it to the eave at the plan's widest point, and every footprint edge gets a wall whose top
//  follows the roof (gable ends rise to the ridge, eave sides stay level where the plan is straight). Used where OSM maps
//  a shed outline with no roof shape and a rectangle-over-the-bounding-box gable would overhang water or a street
//  (Waterfront Pier 57's parts and Pier 60). New module: kit.js is hash-locked (seattle-context-render.bin.gz).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { obb } from './kit.js';

const BOTH = { side: THREE.DoubleSide };

/**
 * frame of a gable over poly: { ux, uz, cx, cz, vMid, hw, top(x, z) }. Axis = the plan's long OBB axis unless { ux, uz }
 * is given; the ridge sits mid-way across the plan unless { vMid, hw } are given (both in metres across the axis).
 */
export function gableFrame(poly, { ux = null, uz = null, eave, ridge, vMid = null, hw = null, minTop = null } = {}) {
    const o = obb(poly); if (!o) return null;
    let ax = o.ux, az = o.uz; if (o.wid > o.len) [ax, az] = [-az, ax];
    if (ux != null) { const L = Math.hypot(ux, uz); ax = ux / L; az = uz / L; }
    const cx = o.cx, cz = o.cz, V = (x, z) => -(x - cx) * az + (z - cz) * ax;
    let v0 = Infinity, v1 = -Infinity; for (const [x, z] of poly) { const v = V(x, z); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const mid = vMid ?? (v0 + v1) / 2, half = hw ?? (v1 - v0) / 2, k = (ridge - eave) / Math.max(0.5, half), lo = minTop ?? -Infinity;
    const top = (x, z) => Math.max(lo, ridge - k * Math.abs(V(x, z) - mid));
    return { ux: ax, uz: az, cx, cz, vMid: mid, hw: half, V, top, eave, ridge };
}

// Sutherland–Hodgman clip of a ring against the half-plane s * (V - mid) >= 0
function clipHalf(poly, V, mid, s) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n], da = s * (V(a[0], a[1]) - mid), db = s * (V(b[0], b[1]) - mid);
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
}
// the ring with a vertex inserted wherever an edge crosses the ridge line (wall tops are straight between vertices then)
function withRidgeCrossings(poly, V, mid) {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], da = V(a[0], a[1]) - mid, db = V(b[0], b[1]) - mid; out.push(a);
        if (da * db < 0) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    return out;
}
/** ring pushed outward by d metres (mitred; for an eave overhang) */
export function offsetRing(P, d) {
    const n = P.length, A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1, out = [];
    const nrm = (x, z) => { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; };
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], c = P[i], e = P[(i + 1) % n], n1 = nrm(c[1] - a[1], -(c[0] - a[0])), n2 = nrm(e[1] - c[1], -(e[0] - c[0]));
        let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const L = Math.hypot(mx, mz) || 1; mx /= L; mz /= L; const k = d / Math.max(0.35, mx * n1[0] + mz * n1[1]); out.push([c[0] + A * mx * k, c[1] + A * mz * k]); }
    return out;
}

function sheet(b, ring, yAt, color, key) {
    if (ring.length < 3) return 0;
    const pts = ring.map(([x, z]) => new THREE.Vector2(x, z)), tris = THREE.ShapeUtils.triangulateShape(pts, []); if (!tris.length) return 0;
    const pos = []; for (const [x, z] of ring) pos.push(x, yAt(x, z), z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(tris.flat());
    g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
    b.add(g, key, null, color, BOTH); g.dispose(); return tris.length;
}

/**
 * the two roof planes over poly (optionally overhanging by `overhang` m, the slope continuing down) as one two-sided sheet
 * each, `thick` m deep with a fascia band round the edge; returns the frame
 */
export function gableRoof(b, poly, F, { color, key = 'roofs', overhang = 0, lift = 0, thick = 0, fascia = null } = {}) {
    const ring = overhang ? offsetRing(poly, overhang) : poly, yAt = (x, z) => F.top(x, z) + lift;
    for (const s of [1, -1]) sheet(b, clipHalf(ring, F.V, F.vMid, s), yAt, color, key);
    if (thick > 0) { const R = withRidgeCrossings(ring, F.V, F.vMid), n = R.length, pos = [], idx = [];
        for (let i = 0; i < n; i++) { const [ax, az] = R[i], [bx, bz] = R[(i + 1) % n], ya = yAt(ax, az), yb = yAt(bx, bz), k = pos.length / 3;
            pos.push(ax, ya - thick, az, bx, yb - thick, bz, bx, yb, bz, ax, ya, az); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        b.add(g, 'paint', null, fascia || color, BOTH); g.dispose(); }
    return F;
}

/**
 * walls on every footprint edge from y0 up to the roof (minus `below`); skip(mx, mz, nx, nz) drops an edge (e.g. a party
 * wall shared with a taller neighbour part). Returns the number of wall quads.
 */
export function gableWalls(b, poly, F, y0, { color, key = 'wood', below = 0, skip = null } = {}) {
    const R = withRidgeCrossings(poly, F.V, F.vMid), n = R.length, A = R.reduce((s, p, i) => s + p[0] * R[(i + 1) % n][1] - R[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1, pos = [], idx = [];
    for (let i = 0; i < n; i++) { const [ax, az] = R[i], [bx, bz] = R[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const nx = A * (bz - az) / L, nz = -A * (bx - ax) / L; // outward for either winding
        if (skip && skip((ax + bx) / 2, (az + bz) / 2, nx, nz)) continue;
        const k = pos.length / 3; pos.push(ax, y0, az, bx, y0, bz, bx, F.top(bx, bz) - below, bz, ax, F.top(ax, az) - below, az); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); }
    if (!idx.length) return 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // outward-facing quads: flip the whole set if the winding made them face in
    { const N = g.attributes.normal, ax = pos[0], az = pos[2], bx = pos[3], bz = pos[5], L = Math.hypot(bx - ax, bz - az) || 1;
      if (N.getX(0) * A * (bz - az) / L - N.getZ(0) * A * (bx - ax) / L < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); } }
    b.add(g, key, null, color); g.dispose(); return idx.length / 6;
}
