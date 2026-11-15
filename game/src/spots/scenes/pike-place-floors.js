// ============================================================================
//  Pike Place Market — the market floors at street level.
//  The market buildings on the west side of Pike Place stand on the bluff: their street floor is at Pike Place's level
//  and their lower storeys go down to Western Ave, 10–12 m below. The terrain under their footprints is the bluff
//  (USGS DEM), so without a floor of their own the open fronts (the sign corner under the clock, the North Arcade's day
//  stalls) showed the ground falling away inside them, and the walker could walk in under the clock and down the slope
//  inside the building to Western Ave level among the lower storeys' walls (F8 2026-11-15, "extremely broken").
//  Here each such footprint is cut out of the terrain grid and gets an exact floor (Ground.addFloor) at its street
//  level, drawn as a paved slab; the walls of a walkable market floor get colliders.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { triangulate } from '../../building-overlap.js';

const clipHalf = (pts, axis, v, sign) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], da = (a[axis] - v) * sign, db = (b[axis] - v) * sign; if (da >= 0) out.push(a); if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };

/** a polygon's floor at y(x, z), tessellated to `cell` m so it follows a sloping street: positions + indices */
export function floorGeometry(poly, y, cell = 2) {
    const pos = [], idx = [];
    for (const tri of triangulate(poly) || []) {
        const xs = tri.map((p) => p[0]), zs = tri.map((p) => p[1]);
        for (let cx = Math.floor(Math.min(...xs) / cell) * cell; cx < Math.max(...xs); cx += cell) for (let cz = Math.floor(Math.min(...zs) / cell) * cell; cz < Math.max(...zs); cz += cell) {
            let p = clipHalf(clipHalf(clipHalf(clipHalf(tri, 0, cx, 1), 0, cx + cell, -1), 1, cz, 1), 1, cz + cell, -1); if (p.length < 3) continue;
            let a2 = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a2 += p[i][0] * q[1] - q[0] * p[i][1]; } if (Math.abs(a2) < 1e-6) continue; if (a2 > 0) p = p.reverse(); // facing up
            const k = pos.length / 3; for (const [x, z] of p) pos.push(x, y(x, z), z);
            for (let i = 1; i < p.length - 1; i++) idx.push(k, k + i, k + i + 1);
        }
    }
    return { pos, idx };
}

/**
 * Give market footprints a floor at street level.
 * @param ctx scene context (before the terrain is built: the footprints join terrainOpts.cutouts)
 * @param {{ poly:number[][], y:(x,z)=>number }[]} floors  each footprint and its floor level
 * @returns {THREE.Mesh} the paved floor (already added to the scene)
 */
export function marketFloors(ctx, floors) {
    const g = ctx.ground, pos = [], idx = [];
    for (const { poly, y } of floors) {
        g.addFloor(poly, y);
        (ctx.terrainOpts.cutouts ??= []).push(poly);
        const f = floorGeometry(poly, y), k = pos.length / 3; pos.push(...f.pos); idx.push(...f.idx.map((i) => i + k));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.9 })); m.name = 'market-floors'; m.receiveShadow = true;
    ctx.add(m);
    ctx.extras.marketFloors = { n: floors.length, tris: idx.length / 3 };
    return m;
}

/** the walls of a walkable market floor stop the walker: segment colliders from the floor to the ceiling */
export function floorWalls(ctx, segs) {
    for (const { a, b, y0, y1 } of segs) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        ctx.collider({ wall: true, ax: a[0], az: a[1], bx: b[0], bz: b[1], y0a: y0, y1a: y1, y0b: y0, y1b: y1, nx: (b[1] - a[1]) / L, nz: -(b[0] - a[0]) / L });
    }
}
