// Split one long indexed mesh into square tiles of the ground plane, so frustum culling (and the rear-view mirror's
// 150 m far plane) can skip what is out of view. Same triangles, same vertex data, same shared material: the picture is
// unchanged. Made for the Pasajul Basarab night light band (45,852 triangles along about 1 km of deck, drawn whole in
// the main and the mirror pass: 92,000 triangles of a 1.53 M frame, Grozăvești, 2026-11-12).
import * as THREE from '../vendor/three.module.min.js';

/**
 * @param mesh  THREE.Mesh with an indexed BufferGeometry (world coordinates, identity transform)
 * @param tile  tile edge in metres (by triangle centroid x / z)
 * @returns a THREE.Group named like the mesh, one child mesh per non-empty tile (or the mesh itself when one tile holds all)
 */
export function splitMeshByTiles(mesh, tile = 125) {
    const geo = mesh.geometry, I = geo.index, P = geo.attributes.position;
    if (!I || !P) return mesh;
    const buckets = new Map();
    for (let k = 0; k < I.count; k += 3) {
        const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2);
        const cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
        const key = Math.floor(cx / tile) + ',' + Math.floor(cz / tile);
        let L = buckets.get(key); if (!L) buckets.set(key, L = []); L.push(a, b, c);
    }
    if (buckets.size < 2) return mesh;
    const group = new THREE.Group(); group.name = mesh.name; Object.assign(group.userData, mesh.userData);
    const names = Object.keys(geo.attributes);
    for (const [key, idx] of buckets) {
        const remap = new Map(), order = [];
        const local = idx.map(v => { let n = remap.get(v); if (n === undefined) { n = order.length; remap.set(v, n); order.push(v); } return n; });
        const g = new THREE.BufferGeometry();
        for (const name of names) {
            const A = geo.attributes[name], s = A.itemSize, out = new A.array.constructor(order.length * s);
            for (let i = 0; i < order.length; i++) for (let j = 0; j < s; j++) out[i * s + j] = A.array[order[i] * s + j];
            g.setAttribute(name, new THREE.BufferAttribute(out, s, A.normalized));
        }
        g.setIndex(new THREE.BufferAttribute(order.length > 65535 ? new Uint32Array(local) : new Uint16Array(local), 1));
        g.computeBoundingSphere(); g.computeBoundingBox();
        const m = new THREE.Mesh(g, mesh.material);
        m.name = `${mesh.name} tile ${key}`; Object.assign(m.userData, mesh.userData);
        m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow; m.renderOrder = mesh.renderOrder; m.layers.mask = mesh.layers.mask;
        group.add(m);
    }
    geo.dispose();
    return group;
}
