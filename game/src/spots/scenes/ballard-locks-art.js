// ============================================================================
//  Ballard Locks — "Salmon Waves" (OSM n3211770269, Paul Sorey, 2001; Seattle Public Utilities art SPU04.087 as quoted
//  in the node's tags): "Seven stainless steel waves varying from 6 to 9 ft. high", covering about 350 sq ft, with blue
//  LED lights. Street View (panorama AVeeBVnYYgdepI_VExHVWQ, 6 m west of the node, looking 60°): seven brushed-steel
//  bands that rise from the plaza and curl over into a spiral, standing in a loose line that runs east across the plaza, towards
//  the water. Count, heights and material are literal; the spacing, facing and curl of each wave are estimates read
//  from that view (deterministic).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { rng, GeoBatch } from '../kit.js';

export const SALMON_WAVES = { ll: [47.664702, -122.3975399], n: 7, hMin: 6 * 0.3048, hMax: 9 * 0.3048 };

/** one wave: a band (width w, thickness t) rising H − R, then curling over the top into a tightening spiral */
export function waveGeometry(H, { w = 0.65, t = 0.14, turns = 0.85, steps = 40 } = {}) {
    const R = H * 0.3, path = [[0, 0]];
    for (let i = 1; i <= 6; i++) path.push([0, (H - R) * i / 6]);
    for (let i = 1; i <= steps; i++) { const k = i / steps, th = Math.PI - k * turns * 2 * Math.PI, rho = R * (1 - 0.62 * k); path.push([R + rho * Math.cos(th), H - R + rho * Math.sin(th)]); }
    const outer = [], inner = [];
    for (let i = 0; i < path.length; i++) {
        const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        outer.push(new THREE.Vector2(path[i][0] + nx * t / 2, path[i][1] + ny * t / 2)); inner.push(new THREE.Vector2(path[i][0] - nx * t / 2, path[i][1] - ny * t / 2));
    }
    const shape = new THREE.Shape([...outer, ...inner.reverse()]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -w / 2);
    return g;
}

/** The south-bank plaza over the fish ladder (OSM w1475183524, highway=footway area; the ladder w285286401 runs under it at
 *  layer −1). The DEM is hydro-flattened to the lake there (4.98 m NAVD88), so the scene drew open water; its dry
 *  samples on the plaza give 6.72 and 6.94 m NAVD88 (−1.78 / −1.56 relative, EPQS 2026-11-13): a deck at their mean. */
export const SOUTH_PLAZA = { id: 'w1475183524', top: -1.67 };
export function southPlaza(ctx, { floor = -9 } = {}) {
    const w = ctx.data.ways.find((x) => x.id === SOUTH_PLAZA.id); if (!w || w.pts.length < 4) return null;
    const ring = w.pts.slice(0, -1), top = SOUTH_PLAZA.top, b = new GeoBatch();
    b.prism(ring, floor, top, '#b4b0a6', 'concrete'); ctx.add(b.build('south-plaza'));
    ctx.ground.addPoly(ring, top, floor);
    // round 3: the terrain under the (solid) deck takes its level too, so walkers that follow the terrain stand on the deck
    // (the audit had one 1.2 m under it: pedBelow at −28.6, 201.9)
    { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const inside = (x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
      ctx.ground.mod((x, z, h) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 && inside(x, z) ? Math.max(h, top - 0.03) : h)); }
    return { ring, top };
}

export function salmonWaves(ctx, plaza = null) {
    const S = SALMON_WAVES, p = ctx.ll(...S.ll), r = rng(2001), G = ctx.ground, g = { heightAt: (x, z) => (plaza ? plaza.top : G.heightAt(x, z)) };
    const m = new THREE.MeshStandardMaterial({ color: '#aeb2b4', metalness: 0.6, roughness: 0.38, emissive: new THREE.Color('#2b6cff'), emissiveIntensity: 0 });
    m.name = 'salmon-waves'; m.userData.nightEmissive = 0.18; // (the blue LEDs)
    const grp = new THREE.Group(); grp.name = 'salmon-waves';
    const dir = 105 * Math.PI / 180, ux = Math.sin(dir), uz = -Math.cos(dir); // the line runs east-south-east across the view (bearing ≈ 105°)
    for (let i = 0; i < S.n; i++) {
        const H = S.hMin + (S.hMax - S.hMin) * r(), s = -1 + i * 1.75, o = (r() - 0.5) * 1.6; // (from the node on: the panorama sees the nearest wave ≈ 5 m away at 40°, the last ≈ 13 m away at 85°)
        const x = p.x + ux * s - uz * o, z = p.z + uz * s + ux * o, y = g.heightAt(x, z);
        const geo = waveGeometry(H, { turns: 0.75 + 0.2 * r() }), mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z); mesh.rotation.y = 2 * Math.PI / 3 + (r() - 0.5) * 0.8; // (the curls face south-west, towards the promenade: the panorama sees their spirals) mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'salmon-wave';
        grp.add(mesh); ctx.circle(x, z, 0.45, y + H);
    }
    ctx.add(grp);
    // (round 3 review: people stood between the waves) a crowd blocker over the row (the waves span s = −1 … −1 + 1.75 (n − 1)
    // along the line, ±0.8 m across, 0.45 m each); the player still walks between them
    { const s0 = -1 - 0.6, s1 = -1 + 1.75 * (S.n - 1) + 0.6, sc = (s0 + s1) / 2, cx = p.x + ux * sc, cz = p.z + uz * sc, hw = (s1 - s0) / 2, hd = 0.8 + 0.6;
      ctx.box(cx, cz, hw, hd, Math.atan2(-uz, ux), { crowdOnly: true, intended: true }); }
    ctx.extras.salmonWaves = { sourceId: 'n3211770269', waves: S.n, heightsM: [+S.hMin.toFixed(2), +S.hMax.toFixed(2)], basis: 'count, heights, material: OSM tags; layout and curl: Street View (estimates)' };
    return { x: p.x, z: p.z };
}
