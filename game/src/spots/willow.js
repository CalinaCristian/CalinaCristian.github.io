// Weeping willows (Salix babylonica, the lake banks of Cișmigiu and other Bucharest parks): a short, thick, forked trunk,
// a rounded top at 6-9 m and long curtains of hanging shoots all round, down to about 1.5 m above the ground. Built here,
// not in osm.js: osm.js is hashed into the Seattle source-context cache, so any change to it must rebuild that cache.
// Instanced like osm.js buildTrees (one crown + one trunk mesh, a colour per tree); the crown material is named
// 'treeCrowns' and listed in ctx.crownMeshes, so the seasonal crown shader (autumn colour, bare twigs) applies as for
// every other broadleaf tree. Shapes and sizes are estimates.
import * as THREE from '../../vendor/three.module.min.js';

/** indexed geometries (position + normal) merged into one */
function mergeGeometries(list) {
    const pos = [], nor = [], idx = []; let base = 0;
    for (const g of list) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); } if (g.index) for (const i of g.index.array) idx.push(base + i); else for (let i = 0; i < P.count; i++) idx.push(base + i); base += P.count; }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setIndex(idx); return o;
}
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };

/** crown lobes [x, y, z, rx, ry, rz]: noise-displaced spheres, normals bent toward the crown centre (soft foliage light) */
function lobes(list, { seg = [7, 6], amp = 0.1, freq = 2.6, bend = 0.25, seed = 6 } = {}) {
    const parts = []; let cx = 0, cy = 0, cz = 0, W = 0;
    for (const [x, y, z, rx, ry, rz] of list) { const w = rx * ry * rz; cx += x * w; cy += y * w; cz += z * w; W += w; } cx /= W; cy /= W; cz /= W;
    for (const [x, y, z, rx, ry, rz] of list) {
        const g = new THREE.SphereGeometry(1, seg[0], seg[1]), P = g.attributes.position;
        for (let i = 0; i < P.count; i++) { const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i), px = x + ux * rx, py = y + uy * ry, pz = z + uz * rz, n = 1 + amp * (noise(px * freq + seed * 7.1, pz * freq + py * 0.7) - 0.5) * 2; P.setXYZ(i, x + ux * rx * n, y + uy * ry * n, z + uz * rz * n); }
        g.computeVertexNormals(); const N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) { let rx2 = P.getX(i) - cx, ry2 = P.getY(i) - cy, rz2 = P.getZ(i) - cz; const L = Math.hypot(rx2, ry2, rz2) || 1; const nx = N.getX(i) * (1 - bend) + rx2 / L * bend, ny = N.getY(i) * (1 - bend) + ry2 / L * bend, nz = N.getZ(i) * (1 - bend) + rz2 / L * bend, l2 = Math.hypot(nx, ny, nz) || 1; N.setXYZ(i, nx / l2, ny / l2, nz / l2); }
        g.deleteAttribute('uv'); parts.push(g);
    }
    const o = mergeGeometries(parts); parts.forEach(p => p.dispose()); return o;
}
let GEO = null;
function geos() {
    if (GEO) return GEO;
    const crown = lobes([[0, 6.9, 0, 3.0, 1.5, 3.0], [0, 5.6, 0, 2.2, 1.8, 2.2],
        ...Array.from({ length: 16 }, (_, k) => { const a = k / 16 * Math.PI * 2 + (k % 2) * .12, rr = 2.5 + (k * 7 % 5) * .22, hang = 2.7 + (k * 5 % 4) * .22; return [Math.cos(a) * rr, 6.3 - hang * .78, Math.sin(a) * rr, .62, hang, .62]; }),
        ...Array.from({ length: 7 }, (_, k) => { const a = k / 7 * Math.PI * 2 + .2; return [Math.cos(a) * 1.5, 4.4, Math.sin(a) * 1.5, .7, 2.3, .7]; })]);
    // trunk: a short thick stem forking into four leaning limbs under the top
    const parts = [], t = new THREE.CylinderGeometry(0.24, 0.36, 3.2, 8); t.translate(0, 1.6, 0); parts.push(t);
    for (const [ax, az, len, tilt] of [[1, 0.2, 3.0, 0.8], [-0.8, -0.5, 2.9, 0.75], [0.2, 1, 2.7, 0.7], [-0.3, -1, 2.5, 0.7]]) { const b = new THREE.CylinderGeometry(0.09, 0.16, len, 6), a = Math.atan2(az, ax); b.translate(0, len / 2, 0); b.rotateZ(-tilt * Math.cos(a)); b.rotateX(tilt * Math.sin(a)); b.translate(0, 2.95, 0); parts.push(b); }
    parts.forEach(p => p.deleteAttribute('uv'));
    const trunk = mergeGeometries(parts); parts.forEach(p => p.dispose());
    return (GEO = { crown, trunk });
}

/** instanced willows: list [{ x, z, y?, s?, c? }] → { group, crowns[], colliders[] } */
export function buildWillows(list, ground, { seed = 11 } = {}) {
    const G = geos(), grp = new THREE.Group(); grp.name = 'willows';
    const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff' }); crownMat.name = 'treeCrowns';
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#5a4636' });
    const crown = new THREE.InstancedMesh(G.crown, crownMat, Math.max(1, list.length)), trunk = new THREE.InstancedMesh(G.trunk, trunkMat, Math.max(1, list.length));
    crown.name = 'treeCrowns willow'; trunk.name = 'treeTrunks';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), colliders = [];
    list.forEach((t, i) => {
        const s = t.s || 1, y = t.y ?? ground.heightAt(t.x, t.z) - 0.05, a = hash(t.x * .37 + seed, t.z * .53) * Math.PI * 2;
        m4.compose(new THREE.Vector3(t.x, y, t.z), q.setFromAxisAngle(up, a), new THREE.Vector3(s, s * (0.92 + hash(t.z, t.x) * 0.16), s));
        crown.setMatrixAt(i, m4); trunk.setMatrixAt(i, m4); crown.setColorAt(i, col.set(t.c || '#9cb457'));
        colliders.push({ x: t.x, z: t.z, r: 0.4 * s, hw: 0.4 * s, prop: true, h: 6 });
    });
    crown.count = trunk.count = list.length;
    for (const m of [crown, trunk]) { m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    crown.renderOrder = 1;
    return { group: grp, crowns: [crown], colliders };
}
