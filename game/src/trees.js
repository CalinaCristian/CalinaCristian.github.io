import * as THREE from '../vendor/three.module.min.js';

// ============================================================================
//  Species trees (world-visual, 2026-11-07). Smooth lobed crowns after the
//  spots look (plane / linden / chestnut lobes, clear stems with scaffold limbs),
//  a smooth one-lobe far crown, instanced, with a dynamic near/far LOD.
//  Shared: world.js (district vegetation) and, optionally, spots.
//
//  Crown geometries are authored with their volume centre at local (0, 5, 0):
//  render.js's season patch shrinks bare crowns toward uCrownC = (0, 5, 0) and
//  reads the local position (vCrownL) for its twig pattern.
// ============================================================================

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.15;

/** noise-displaced smooth lobes; normals bent toward the crown centre (soft foliage light). Returns {geo, cy} */
function lobeCrown(lobes, { seg = [8, 5], amp = 0.2, freq = 1.7, bend = 0.55, seed = 1 } = {}) {
    const pos = [], nor = [], idx = []; let base = 0;
    let cx = 0, cy = 0, cz = 0, W = 0; for (const [x, y, z, rx, ry, rz] of lobes) { const w = rx * ry * rz; cx += x * w; cy += y * w; cz += z * w; W += w; } cx /= W; cy /= W; cz /= W;
    for (const [x, y, z, rx, ry, rz] of lobes) {
        const g = new THREE.SphereGeometry(1, seg[0], seg[1]), P = g.attributes.position;
        for (let i = 0; i < P.count; i++) {
            const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i), px = x + ux * rx, py = y + uy * ry, pz = z + uz * rz;
            const n = 1 + amp * (fbm(px * freq + seed * 7.1, pz * freq + py * 0.7) - 0.5) * 2;
            P.setXYZ(i, x + ux * rx * n, y + uy * ry * n, z + uz * rz * n);
        }
        g.computeVertexNormals();
        const N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
            const px = P.getX(i), py = P.getY(i), pz = P.getZ(i); let rx2 = px - cx, ry2 = py - cy, rz2 = pz - cz; const L = Math.hypot(rx2, ry2, rz2) || 1; rx2 /= L; ry2 /= L; rz2 /= L;
            let nx = N.getX(i) * (1 - bend) + rx2 * bend, ny = N.getY(i) * (1 - bend) + ry2 * bend, nz = N.getZ(i) * (1 - bend) + rz2 * bend; const l2 = Math.hypot(nx, ny, nz) || 1;
            pos.push(px - cx, py - cy + 5, pz - cz); nor.push(nx / l2, ny / l2, nz / l2);
        }
        for (const i of g.index.array) idx.push(base + i); base += P.count; g.dispose();
    }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setIndex(idx); o.computeBoundingSphere();
    return { geo: o, cy };
}
function mergeGeos(list) {
    const pos = [], nor = [], idx = []; let base = 0;
    for (let g of list) { if (!g.index) g = g.toNonIndexed ? g : g; const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); } if (g.index) for (const i of g.index.array) idx.push(base + i); else for (let i = 0; i < P.count; i++) idx.push(base + i); base += P.count; }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setIndex(idx); o.computeBoundingSphere(); return o;
}
/** a tapered rod from p0 to p1 (radius r0 → r1), open ends */
function rod(p0, p1, r0, r1, sides = 5) {
    const d = new THREE.Vector3().subVectors(p1, p0), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, sides, 1, true);
    g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(p0.x, p0.y, p0.z);
    return g;
}
/** branch skeleton for a broadleaf crown (round 6 note 21: bare winter crowns read as branches + twig haze, not as
 *  see-through scribbles): a leader from the stem top `y0` to the crown `top`, five limbs out to ≈ 0.4 R around the
 *  crown centre height `yc`, each forking into three branches reaching ≈ 0.6–0.95 R and up toward the top.
 *  Radii from the stem radius r0. Returns geometries to merge with the stem. */
export function branchSkeleton(y0, yc, R, top, r0, lite = false) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), parts = [], N = lite ? 3 : 5;
    parts.push(rod(V(0, y0 - 0.3, 0), V(0.1 * R / 3, top - (top - yc) * 0.4, -0.05 * R / 3), r0 * 0.5, r0 * 0.12, lite ? 3 : 5));
    for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2 + 0.4 * Math.sin(i * 2.3), ys = y0 - 0.25 * (i % 3) - 0.2, r1 = R * (0.38 + 0.08 * (i % 2)), y1 = yc - (yc - y0) * 0.25 + (top - yc) * 0.12 * (i % 3);
        const p1 = V(Math.cos(a) * r1, y1, Math.sin(a) * r1);
        parts.push(rod(V(0, ys, 0), p1, r0 * 0.36, r0 * 0.16, lite ? 3 : 5));
        if (lite) { parts.push(rod(p1, V(Math.cos(a) * R * 0.7, y1 + (top - y1) * 0.45, Math.sin(a) * R * 0.7), r0 * 0.16, r0 * 0.06, 3)); continue; }
        for (const [da, rr, yy] of [[-0.5, 0.72, 0.3], [0.45, 0.66, 0.5], [0.05, 0.45, 0.7]]) {
            const b = a + da; parts.push(rod(p1, V(Math.cos(b) * R * rr, y1 + (top - y1) * yy * (0.85 + 0.07 * (i % 3)), Math.sin(b) * R * rr), r0 * 0.15, r0 * 0.05, 4));
        }
    }
    return parts;
}
/** stem (height h, base radius r0) with scaffold limbs and the branch skeleton (authored for the 5 m stem: near crowns
 *  sit at local y ≈ 6.3 with ≈ 3.3–4.8 m horizontal radius once instanced) */
function trunkWithLimbs(h, r0, limbs, sides = 7) {
    const parts = [], t = new THREE.CylinderGeometry(r0 * 0.6, r0, h, sides); t.translate(0, h / 2, 0); parts.push(t);
    for (const [ax, az, len, tilt] of limbs) { const a = Math.atan2(az, ax), b = new THREE.CylinderGeometry(r0 * 0.25, r0 * 0.45, len, 5); b.translate(0, len / 2, 0); b.rotateZ(-tilt * Math.cos(a)); b.rotateX(tilt * Math.sin(a)); b.translate(0, h * 0.92, 0); parts.push(b); }
    parts.push(...branchSkeleton(h * 0.95, 6.3, 3.0, 8.0, r0));
    return mergeGeos(parts);
}

/**
 * Crown shapes (near) and their nominal geometry: crown centre height `cy` (m), clear stem `stem`, nominal top `top`.
 * Species map onto shapes; colour palettes are summer greens (render tints the seasons per instance).
 */
let GEO = null;
export function treeGeometries() {
    if (GEO) return GEO;
    const plane = lobeCrown([[0, 10.5, 0, 3.8, 3.0, 3.8], [2.4, 9.2, 1.0, 2.6, 2.3, 2.6], [-2.2, 9.6, -1.2, 2.7, 2.4, 2.6], [0.6, 12.6, -0.6, 2.4, 2.0, 2.4], [-1.0, 8.4, 2.0, 2.2, 1.8, 2.2]], { seed: 1 });
    const linden = lobeCrown([[0, 8.6, 0, 3.0, 4.2, 3.0], [1.3, 7.2, 0.6, 2.2, 2.6, 2.2], [-1.2, 7.5, -0.7, 2.2, 2.6, 2.2], [0, 11.4, 0.2, 2.0, 2.0, 2.0]], { seed: 2, amp: 0.16 });
    const round = lobeCrown([[0, 7.4, 0, 3.6, 3.0, 3.6], [2.0, 6.4, 0.8, 2.4, 2.0, 2.4], [-1.9, 6.6, -0.9, 2.4, 2.0, 2.4], [0.3, 9.4, 0, 2.6, 1.8, 2.6]], { seed: 3, amp: 0.2 });
    const small = lobeCrown([[0, 4.9, 0, 2.8, 1.8, 2.8], [1.5, 4.4, 0.6, 1.7, 1.3, 1.7], [-1.4, 4.6, -0.7, 1.8, 1.3, 1.8], [0.2, 6.0, 0, 1.8, 1.2, 1.8]], { seed: 5, amp: 0.22 });
    // conifer: stacked smooth tiers (spruce / fir); centre normalised like the others
    const conifer = (() => {
        const tiers = [], P = [];
        for (const [y, r, h] of [[2.4, 2.4, 3.6], [4.6, 1.9, 3.4], [6.7, 1.4, 3.0], [8.5, 0.85, 2.6]]) { const c = new THREE.ConeGeometry(r, h, 9, 1, true); c.translate(0, y + h / 2, 0); tiers.push(c); }
        const g = mergeGeos(tiers), p = g.attributes.position; let cy = 0; for (let i = 0; i < p.count; i++) cy += p.getY(i); cy /= p.count;
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - cy + 5); g.computeBoundingSphere(); P.push(cy);
        return { geo: g, cy };
    })();
    const low = lobeCrown([[0, 5, 0, 1, 1, 1]], { seg: [6, 4], seed: 4, amp: 0.12, bend: 0.4 }); // (≈ 40 tris: thousands of these) // unit far lobe, centre (0,5,0)
    const conLow = (() => { const c = new THREE.ConeGeometry(1, 2.4, 6); c.translate(0, 5, 0); c.computeBoundingSphere(); return { geo: c, cy: 5 }; })();
    // one shared stem with limbs (authored 5 m tall; instances scale it to the species' clear stem)
    const trunk = trunkWithLimbs(5, 0.25, [[1, 0.3, 2.6, 0.5], [-0.8, -0.6, 2.4, 0.45], [0.1, 1, 2.2, 0.4]]);
    const trunkLow = (() => { const t = new THREE.CylinderGeometry(0.15, 0.25, 5, 3, 1, true); t.translate(0, 2.5, 0); return mergeGeos([t, ...branchSkeleton(4.75, 6.3, 3.0, 8.0, 0.25, true)]); })(); // open, ≈ 50 tris (stem + 3 limbs)
    GEO = {
        shapes: {
            plane: { ...plane, stem: 7.0, top: 15, rx: 4.3, ry: 3.6, cols: ['#6a9a45', '#5f9140', '#74a14c'] },
            linden: { ...linden, stem: 4.8, top: 13.4, rx: 3.3, ry: 4.4, cols: ['#4f8436', '#5a8c3b', '#4a7c33'] },
            round: { ...round, stem: 4.2, top: 11.2, rx: 3.8, ry: 3.1, cols: ['#4a7d32', '#55893a', '#5e8e3c'] },
            small: { ...small, stem: 2.8, top: 7.2, rx: 3.0, ry: 2.0, cols: ['#62963f', '#6b9a46', '#5b8c3c'] },
            conifer: { ...conifer, stem: 2.2, top: 11.1, rx: 2.4, ry: 4.6, cols: ['#2f5d3a', '#356640', '#2b5434', '#3a6b45'], conifer: true },
        },
        low, conLow, trunk, trunkLow,
    };
    return GEO;
}

/** species → crown shape (and palette override) */
export const SPECIES = {
    plane: { shape: 'plane' }, linden: { shape: 'linden' }, chestnut: { shape: 'round', cols: ['#456f2c', '#4c7a31', '#3f6a29'] },
    maple: { shape: 'round', cols: ['#5b8f3b', '#679a44', '#527f35'] }, cherry: { shape: 'small', cols: ['#5f8f3e', '#6b9846', '#5a8a3a'] },
    oak: { shape: 'round', cols: ['#4d7c33', '#567f36'] }, generic: { shape: 'round' }, small: { shape: 'small' }, conifer: { shape: 'conifer' },
};
/** OSM species / genus / leaf_type text → SPECIES key (null: unknown) */
export function speciesFromOSM(txt = '') {
    const t = String(txt).toLowerCase();
    if (/platan|plane/.test(t)) return 'plane';
    if (/tilia|linden|tei\b|lime/.test(t)) return 'linden';
    if (/aesculus|chestnut|castan/.test(t)) return 'chestnut';
    if (/acer|maple|arțar|artar/.test(t)) return 'maple';
    if (/prunus|cherry|cireș|cires|malus|apple/.test(t)) return 'cherry';
    if (/quercus|oak|stejar/.test(t)) return 'oak';
    if (/pinus|picea|abies|pseudotsuga|thuja|cedrus|needle|conifer|fir|pine|spruce|cedar|brad|molid/.test(t)) return 'conifer';
    return null;
}
/** street-type defaults per city: one species per street row (key = road id), conifers never on streets */
const STREET_MIX = { bucharest: [['linden', 0.42], ['plane', 0.3], ['chestnut', 0.28]], seattle: [['maple', 0.36], ['cherry', 0.28], ['plane', 0.36]] };
const PARK_MIX = { bucharest: [['linden', 0.3], ['chestnut', 0.25], ['oak', 0.2], ['plane', 0.15], ['generic', 0.1]], seattle: [['maple', 0.4], ['oak', 0.2], ['generic', 0.25], ['cherry', 0.15]] };
const pickMix = (mix, h) => { let a = 0; for (const [k, p] of mix) { a += p; if (h < a) return k; } return mix[mix.length - 1][0]; };
export function defaultSpecies(cityId, kind, key, h) {
    const c = cityId === 'seattle' ? 'seattle' : 'bucharest';
    if (kind === 'street') return pickMix(STREET_MIX[c], hash(key * 0.37 + 1.3, 7.7));
    if (kind === 'garden') return h < 0.55 ? 'small' : pickMix(PARK_MIX[c], h);
    return pickMix(PARK_MIX[c], h);
}

/**
 * Instanced species trees with a dynamic near/far LOD.
 *   trees: [{x, z, y?, s (scale vs the species' nominal size), species, sh? (narrow toward a road), rot?, col?}]
 *   opts: { near = 110, maxNear = 520, chunk = 750, cull, castShadow = true, rng }
 * Near: one InstancedMesh per crown shape + one trunk mesh (global, refilled when the viewer moves 20 m).
 * Far: per chunk one deciduous low-lobe crown mesh, one conifer low crown mesh, one low trunk mesh; trees that are near
 *      are hidden in the far meshes (zero scale). All crowns are named 'treeCrowns …' (render season hooks), conifers flagged.
 * @returns {{ group, crownMeshes[], trunkMeshes[], update(x, z), count }}
 */
export function buildSpeciesTrees(trees, opts = {}) {
    const G = treeGeometries(), R = opts.rng || Math.random, near = opts.near ?? 110, maxNear = opts.maxNear ?? 520, CH = opts.chunk ?? 750;
    const group = new THREE.Group(); group.name = 'trees';
    const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff' }); crownMat.name = 'treeCrowns';
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#5f4632' }); trunkMat.name = 'treeTrunks';
    const conMat = crownMat.clone(); conMat.name = 'treeCrowns'; // (render swaps conifers to its own clone; keep them separate)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pV = new THREE.Vector3(), sV = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    // per tree: near crown matrix, far crown matrix, near trunk matrix, far trunk matrix, colour
    const T = trees.map((t) => {
        const sp = SPECIES[t.species] || SPECIES.generic, sh = G.shapes[sp.shape], s = t.s || 1, rot = t.rot ?? R() * 6.28, y = t.y ?? 0.12;
        const w = t.sh || 1;
        q.setFromAxisAngle(up, rot);
        const cyW = y + sh.cy * s; // world height of the crown centre
        const nc = new THREE.Matrix4().compose(pV.set(t.x, cyW - 5 * s, t.z), q, sV.set(s * w, s, s * w));
        const fc = new THREE.Matrix4().compose(pV.set(t.x, cyW - 5 * sh.ry * s, t.z), q, sV.set(sh.rx * s * w, sh.ry * s, sh.rx * s * w));
        if (sh.conifer) fc.compose(pV.set(t.x, cyW - 5 * s * 2.0, t.z), q, sV.set(sh.rx * s * w, s * 2.0, sh.rx * s * w));
        const ts = s * (sh.stem + 1.2) / 5; // stem (limbs reach into the crown)
        const nt = new THREE.Matrix4().compose(pV.set(t.x, y, t.z), q, sV.set(s * 0.9, ts, s * 0.9));
        const ft = new THREE.Matrix4().compose(pV.set(t.x, y, t.z), q, sV.set(s * 0.9, ts, s * 0.9));
        const pal = sp.cols || sh.cols; col.set(t.col || pal[Math.floor(R() * pal.length)]).multiplyScalar(0.9 + R() * 0.16);
        return { t, shape: sp.shape, con: !!sh.conifer, nc, fc, nt, ft, c: col.clone(), chunk: Math.floor(t.x / CH) + ',' + Math.floor(t.z / CH), fi: -1, near: false };
    });
    // far chunk meshes
    const chunks = new Map();
    for (const r of T) { let c = chunks.get(r.chunk); if (!c) chunks.set(r.chunk, c = { dec: [], con: [] }); (r.con ? c.con : c.dec).push(r); }
    const crownMeshes = [], trunkMeshes = [], farOf = [];
    const cull = opts.cull ?? 1600;
    for (const [k, c] of chunks) {
        const [ci, cj] = k.split(',').map(Number);
        const all = c.dec.concat(c.con);
        const trunks = new THREE.InstancedMesh(G.trunkLow, trunkMat, all.length); trunks.name = `treeTrunks ${k} far`;
        const mine = [trunks];
        all.forEach((r, i) => trunks.setMatrixAt(i, r.ft));
        for (const [list, con] of [[c.dec, false], [c.con, true]]) {
            if (!list.length) continue;
            const m = new THREE.InstancedMesh(con ? G.conLow.geo : G.low.geo, con ? conMat : crownMat, list.length);
            m.name = `treeCrowns ${k} ${con ? 'conifer' : 'broadleaf'} far`; m.userData.conifer = con; m.renderOrder = 0;
            list.forEach((r, i) => { m.setMatrixAt(i, r.fc); m.setColorAt(i, r.c); r.far = { m, i }; });
            m.userData.deciduousMask = new Float32Array(list.length).fill(con ? 0 : 1);
            crownMeshes.push(m); mine.push(m);
        }
        all.forEach((r, i) => { r.farT = { m: trunks, i }; });
        trunkMeshes.push(trunks);
        for (const m of mine) {
            m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
            m.computeBoundingSphere(); m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; if (opts.farLayer != null) m.layers.set(opts.farLayer); // (far LOD: no shadow pass — the near crowns cast; optionally on a main-camera-only layer)
            m.userData.cx = (ci + 0.5) * CH; m.userData.cz = (cj + 0.5) * CH; m.userData.cull = cull + CH * 0.71;
            group.add(m); farOf.push(m);
        }
    }
    // near meshes (global, refilled on update)
    const nearM = {};
    for (const [name, sh] of Object.entries(G.shapes)) {
        const n = Math.min(maxNear, T.filter(r => r.shape === name).length); if (!n) continue;
        const m = new THREE.InstancedMesh(sh.geo, sh.conifer ? conMat : crownMat, n); m.count = 0;
        m.name = `treeCrowns near ${name}${sh.conifer ? ' conifer' : ''}`; m.userData.conifer = !!sh.conifer; m.userData.always = true; m.renderOrder = 1; // (after the far LOD)
        m.frustumCulled = false; m.castShadow = opts.castShadow !== false; m.receiveShadow = true; m.matrixAutoUpdate = false;
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        group.add(m); crownMeshes.push(m); nearM[name] = m;
    }
    const nearT = new THREE.InstancedMesh(G.trunk, trunkMat, Math.max(1, Math.min(maxNear * 2, T.length))); nearT.count = 0;
    nearT.name = 'treeTrunks near'; nearT.userData.always = true; nearT.frustumCulled = false; nearT.castShadow = opts.castShadow !== false; nearT.matrixAutoUpdate = false;
    group.add(nearT); trunkMeshes.push(nearT);
    // spatial grid for near queries
    const GS = 50, grid = new Map();
    T.forEach((r) => { const k = Math.floor(r.t.x / GS) + ',' + Math.floor(r.t.z / GS); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(r); });
    let lx = 1e9, lz = 1e9, cur = [];
    const update = (x, z) => {
        if (Math.hypot(x - lx, z - lz) < 20) return; lx = x; lz = z;
        const cand = []; const K = Math.ceil(near / GS);
        const ix = Math.floor(x / GS), iz = Math.floor(z / GS);
        for (let i = ix - K; i <= ix + K; i++) for (let j = iz - K; j <= iz + K; j++) { const a = grid.get(i + ',' + j); if (a) for (const r of a) { const d = (r.t.x - x) ** 2 + (r.t.z - z) ** 2; if (d < near * near) cand.push([d, r]); } }
        cand.sort((a, b) => a[0] - b[0]);
        const per = {}; const sel = [];
        for (const [, r] of cand) { const m = nearM[r.shape]; if (!m) continue; per[r.shape] = per[r.shape] || 0; if (per[r.shape] >= m.instanceMatrix.count) continue; per[r.shape]++; sel.push(r); if (sel.length >= nearT.instanceMatrix.count) break; }
        const touched = new Set();
        for (const r of cur) { r.near = false; }
        for (const r of sel) r.near = true;
        for (const r of cur) if (!r.near) { r.far.m.setMatrixAt(r.far.i, r.fc); r.farT.m.setMatrixAt(r.farT.i, r.ft); touched.add(r.far.m); touched.add(r.farT.m); }
        for (const r of sel) if (!cur.includes(r)) { r.far.m.setMatrixAt(r.far.i, ZERO); r.farT.m.setMatrixAt(r.farT.i, ZERO); touched.add(r.far.m); touched.add(r.farT.m); }
        for (const m of touched) m.instanceMatrix.needsUpdate = true;
        const k = {}; for (const name in nearM) k[name] = 0; let kt = 0;
        // far → near: bare crowns blend in order
        for (let q = sel.length - 1; q >= 0; q--) { const r = sel[q], m = nearM[r.shape], i = k[r.shape]++; m.setMatrixAt(i, r.nc); m.setColorAt(i, r.c); nearT.setMatrixAt(kt++, r.nt); }
        for (const name in nearM) { const m = nearM[name]; m.count = k[name]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
        nearT.count = kt; nearT.instanceMatrix.needsUpdate = true;
        cur = sel;
    };
    return { group, crownMeshes, trunkMeshes, update, count: T.length };
}
