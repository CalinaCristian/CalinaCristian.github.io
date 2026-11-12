// Polygon triangulation shared by world.js and the build workers (one copy, so both triangulate alike).
import * as THREE from '../vendor/three.module.min.js';

/** outer ring and holes ([[x, z]…]) → { pts: outer + holes, tris: [[i, j, k]…] } (no triangles when it fails) */
export function triangulate(outer, holes = []) {
    const contour = outer.map(([x, z]) => new THREE.Vector2(x, z));
    const hs = holes.map(h => h.map(([x, z]) => new THREE.Vector2(x, z)));
    try { return { pts: outer.concat(...holes), tris: THREE.ShapeUtils.triangulateShape(contour, hs) }; } catch (e) { return { pts: outer, tris: [] }; }
}
