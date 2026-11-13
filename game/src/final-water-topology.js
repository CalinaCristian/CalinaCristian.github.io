// Exact existing World water topology, shared by final assembly and its owner
// index. This module changes neither subdivision/cap policy nor source water.
import * as THREE from '../vendor/three.module.min.js';
import { MeshBuilder } from './geobuild.js';

export function projectCoveredWater(city, { us = false } = {}) {
    // (r2-world-river / unirii-bd-unirii-square, round 4) square ends: the cover stops at the slab's ends (east end at the
    // railing where open water begins, 44.42609, 26.10433 in the street-level review); a round 34 m cap laid bare ground
    // over the first ≈ 34 m of the open basin east of the square (and the same past the west end)
    return (us ? [] : [{ r: 34, square: true, pts: [[44.4288061, 26.1010674], [44.4285939, 26.1013182], [44.4262866, 26.1035491], [44.4261682, 26.1037764], [44.4261085, 26.1040376], [44.4260752, 26.1043771]] }])
          .map(c => ({ r: c.r, square: !!c.square, pts: c.pts.map(([la, lo]) => { const q = city.proj(la, lo); return [q.x, q.z]; }) }));
}
export function coveredWaterAt(x, z, covered) {
    return covered.some(c => { const last = c.pts.length - 1; for (let i = 1; i < c.pts.length; i++) { const [ax, az] = c.pts[i - 1], [bx, bz] = c.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t0 = ((x - ax) * dx + (z - az) * dz) / L2;
        if (c.square && ((i === 1 && t0 < 0) || (i === last && t0 > 1))) continue; // (square ends: nothing beyond the first / last point)
        const t = Math.max(0, Math.min(1, t0)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < c.r) return true; } return false; });
}
/** Convex pieces (a rectangle per span, a 16-gon per vertex) containing every point within r + pad of a covered line. */
export function coveredWaterHulls(covered, pad = 0) {
    const hulls = [];
    for (const c of covered) {
        const r = c.r + pad, R = r / Math.cos(Math.PI / 16);
        for (const [k, [x, z]] of c.pts.entries()) if (!c.square || (k > 0 && k < c.pts.length - 1)) hulls.push(Array.from({ length: 16 }, (_, k) => [x + R * Math.cos(k * Math.PI / 8), z + R * Math.sin(k * Math.PI / 8)]));
        for (let i = 1; i < c.pts.length; i++) {
            const [ax, az] = c.pts[i - 1], [bx, bz] = c.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-6) continue;
            const nx = -(bz - az) / L * r, nz = (bx - ax) / L * r;
            hulls.push([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]]);
        }
    }
    return hulls;
}
export function dropCoveredWater(g, covered) {
    if (!covered.length) return g; const P = g.attributes.position; if (g.index || P.count % 3) return g;
    const keep = []; for (let i = 0; i < P.count; i += 3) { const x = (P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, z = (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3; if (!coveredWaterAt(x, z, covered)) keep.push(i); }
    if (keep.length * 3 === P.count) return g;
    const out = new THREE.BufferGeometry();
    for (const k of Object.keys(g.attributes)) { const A = g.attributes[k], n = A.itemSize, arr = new A.array.constructor(keep.length * 3 * n); keep.forEach((i, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) arr[(j * 3 + v) * n + c] = A.array[(i + v) * n + c]; }); out.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
    g.dispose(); return out;
}
export function prepareFinalWaterGeometry(geometry, { subdivide, covered }) {
    return dropCoveredWater(subdivide(geometry, 6, 60000), covered);
}
export function waterGroupKey(i, j) { return Math.floor(i / 4) + ',' + Math.floor(j / 4); }

/** Copy only; never append into the actual first cell builder before World does. */
export function prepareSmallWaterGroups(cells, options) {
    const groups = new Map();
    for (const c of cells.values()) {
        if (c.water.empty) continue;
        const key = waterGroupKey(c.i, c.j);
        let mb = groups.get(key); if (!mb) groups.set(key, mb = new MeshBuilder());
        mb.append(c.water);
    }
    const prepared = new Map();
    try {
        for (const [key, mb] of groups) {
            const source = mb.build(), entry = { key, source, geometry: null, consumed: false };
            prepared.set(key, entry); entry.geometry = prepareFinalWaterGeometry(source, options);
        }
    } catch (error) {
        for (const entry of prepared.values()) { entry.source.dispose(); entry.geometry?.dispose(); }
        throw error;
    }
    return prepared;
}
export function sameWaterGeometry(a, b) {
    if (!!a.index !== !!b.index) return false;
    const same = (x, y) => {
        if (x.itemSize !== y.itemSize || x.normalized !== y.normalized || x.array.constructor !== y.array.constructor || x.array.length !== y.array.length) return false;
        const left = new Uint8Array(x.array.buffer, x.array.byteOffset, x.array.byteLength), right = new Uint8Array(y.array.buffer, y.array.byteOffset, y.array.byteLength);
        return left.every((v, i) => v === right[i]);
    };
    if (a.index && !same(a.index, b.index)) return false;
    const keys = Object.keys(a.attributes); if (keys.length !== Object.keys(b.attributes).length) return false;
    return keys.every(k => b.attributes[k] && same(a.attributes[k], b.attributes[k]));
}
export function consumePreparedSmallWater(entry, source) {
    if (entry.consumed || !sameWaterGeometry(entry.source, source)) throw Error('Final small-water source differs from the roof owner certificate: ' + entry.key);
    entry.consumed = true; entry.source.dispose(); return entry.geometry;
}
/** Adapter preserves complete triangles, without handing the owner a stale camera index. */
export function waterOwnerSurface(geometry, id, matrix = null) {
    const P = geometry.attributes.position, positions = new Float64Array(P.count * 3), v = new THREE.Vector3();
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k); if (matrix) v.applyMatrix4(matrix); positions.set(v.toArray(), k * 3); }
    const index = geometry.index ? geometry.index.array : Uint32Array.from({ length: P.count }, (_, i) => i);
    return { id, water: true, mesh: { p: positions, i: index, ic: index.length } };
}
/** Explicit material membership only; unrelated transparency is not water evidence. */
export function landmarkWaterSurfaces(landmarks) {
    const surfaces = [];
    for (const landmark of landmarks) {
        if (!landmark.mesh) continue;
        landmark.mesh.updateWorldMatrix(true, true);
        landmark.mesh.traverse(object => {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            if (!object.isMesh || !object.geometry?.attributes.position || !materials.some(m => m && (m.name === 'water' || m.name === 'landmark-fountain-water' || m.userData?.waterU))) return;
            surfaces.push(waterOwnerSurface(object.geometry, 'landmark-water:' + landmark.id + ':' + object.id, object.matrixWorld));
        });
    }
    return surfaces;
}
/** Ground bands are queried from their original snapshot; water can only refuse. */
export function combineUnderpassWaterOwners(ground, water) {
    return {
        forPolygon(poly) {
            const owner = ground.forPolygon(poly); if (!owner.known) return owner;
            const wet = water.forPolygon(poly); if (wet.known) return owner;
            return { ...owner, known: false, reason: wet.reason, waters: wet.waters, waterMalformed: wet.malformed };
        },
        report: { ...ground.report, retainedWaterIndex: water.report, waterTopology: 'original ground/raw-big snapshot plus complete final4x4 small-water and explicitly identified transformed landmark water; any retained intersection remains unresolved' },
    };
}
