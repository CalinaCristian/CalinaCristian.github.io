// Weeping willows (Salix babylonica / the golden S. × sepulcralis, the lake banks of Cișmigiu and other Bucharest parks):
// a short, stout, slightly leaning trunk that forks low into arching limbs, a lumpy rounded top at 8-9 m and curtains of
// thin hanging shoots all round, falling plumb to a ragged edge about a metre above the ground. Built here, not in
// osm.js: osm.js is hashed into the Seattle source-context cache, so any change to it must rebuild that cache.
// Instanced (a crown + a trunk mesh, a colour per tree, a light variant for far trees); the crown material is named
// 'treeCrowns' and listed in ctx.crownMeshes, so the seasonal crown shader applies as for every other broadleaf tree. Its
// WILLOW_CROWN define selects the willow's own seasons there (render.js patchCrowns): gold in autumn, never red, and a
// curtain of yellow twigs when bare. Shapes and sizes are estimates.
import * as THREE from '../../vendor/three.module.min.js';

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** vertex + triangle lists → BufferGeometry: position, normal, sway (0 = fixed … 1 = a free shoot tip), optionally color */
class Mesh {
    constructor(colored) { this.pos = []; this.nor = []; this.sway = []; this.col = colored ? [] : null; this.idx = []; }
    vert(p, n, sway = 0, c = null) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.sway.push(sway); if (this.col) this.col.push(...(c || [1, 1, 1])); return this.pos.length / 3 - 1; }
    /** triangle wound so that it faces away from the point `inside` */
    tri(a, b, c, inside) {
        const P = this.pos, A = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], n = cross3([P[b * 3] - A[0], P[b * 3 + 1] - A[1], P[b * 3 + 2] - A[2]], [P[c * 3] - A[0], P[c * 3 + 1] - A[1], P[c * 3 + 2] - A[2]]);
        if (n[0] * (A[0] - inside[0]) + n[1] * (A[1] - inside[1]) + n[2] * (A[2] - inside[2]) < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
    }
    /**
     * a tube along pts that ends in a point. side: a direction across the tube (the rings are built on it and on its
     * normal in the plane of the path); at(k) → { u, v, sway, c } half-widths along / across `side`, sway and colour of
     * ring k; soften: 0-1, how far the normals turn from the tube's own to the crown's (outward from the stem and up).
     */
    tube(pts, side, sides, at, soften = 0) {
        const n = pts.length, rings = [];
        for (let k = 0; k < n; k++) {
            const p = pts[k], q0 = pts[Math.max(0, k - 1)], q1 = pts[Math.min(n - 1, k + 1)], T = norm3([q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]]);
            const d = side[0] * T[0] + side[1] * T[1] + side[2] * T[2], U = norm3([side[0] - T[0] * d, side[1] - T[1] * d, side[2] - T[2] * d]), V = cross3(U, T), a = at(k);
            const soft = soften ? norm3([p[0], Math.hypot(p[0], p[2]) * (0.15 + 1.1 * sstep(3, 8.6, p[1])), p[2]]) : null;
            const N = (m) => soft ? norm3([m[0] * (1 - soften) + soft[0] * soften, m[1] * (1 - soften) + soft[1] * soften, m[2] * (1 - soften) + soft[2] * soften]) : m;
            if (k === n - 1) { rings.push([this.vert(p, N(T), a.sway, a.c)]); break; }
            const ring = [];
            for (let j = 0; j < sides; j++) { const an = j / sides * Math.PI * 2, cu = Math.cos(an), sv = Math.sin(an), m = norm3([U[0] * cu + V[0] * sv, U[1] * cu + V[1] * sv, U[2] * cu + V[2] * sv]); ring.push(this.vert([p[0] + U[0] * cu * a.u + V[0] * sv * a.v, p[1] + U[1] * cu * a.u + V[1] * sv * a.v, p[2] + U[2] * cu * a.u + V[2] * sv * a.v], N(m), a.sway, a.c)); }
            rings.push(ring);
        }
        for (let k = 0; k < n - 1; k++) {
            const A = rings[k], B = rings[k + 1], mid = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2, (pts[k][2] + pts[k + 1][2]) / 2];
            for (let j = 0; j < sides; j++) { const j1 = (j + 1) % sides; if (B.length === 1) this.tri(A[j], A[j1], B[0], mid); else { this.tri(A[j], A[j1], B[j1], mid); this.tri(A[j], B[j1], B[j], mid); } }
        }
    }
    /** crown lobes [x, y, z, rx, ry, rz]: noise-displaced spheres, normals bent toward the crown centre (soft foliage light) */
    lobes(list, { seg = [8, 6], amp = 0.16, freq = 2.1, bend = 0.3, seed = 6 } = {}) {
        let cx = 0, cy = 0, cz = 0, W = 0;
        for (const [x, y, z, rx, ry, rz] of list) { const w = rx * ry * rz; cx += x * w; cy += y * w; cz += z * w; W += w; } cx /= W; cy /= W; cz /= W;
        for (const [x, y, z, rx, ry, rz] of list) {
            const g = new THREE.SphereGeometry(1, seg[0], seg[1]), P = g.attributes.position;
            for (let i = 0; i < P.count; i++) { const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i), px = x + ux * rx, py = y + uy * ry, pz = z + uz * rz, k = 1 + amp * (noise(px * freq + seed * 7.1, pz * freq + py * 0.7) - 0.5) * 2; P.setXYZ(i, x + ux * rx * k, y + uy * ry * k, z + uz * rz * k); }
            g.computeVertexNormals(); const N = g.attributes.normal, base = this.pos.length / 3;
            for (let i = 0; i < P.count; i++) {
                const p = [P.getX(i), P.getY(i), P.getZ(i)], r = norm3([p[0] - cx, p[1] - cy, p[2] - cz]), sh = 0.8 + 0.24 * sstep(y - ry, y + ry * 0.6, p[1]) + (noise(p[0] * 3.1 + 5, p[2] * 3.1 + p[1]) - 0.5) * 0.1;
                this.vert(p, norm3([N.getX(i) * (1 - bend) + r[0] * bend, N.getY(i) * (1 - bend) + r[1] * bend, N.getZ(i) * (1 - bend) + r[2] * bend]), 0, [sh, sh, sh * 0.96]);
            }
            const I = g.index.array;
            for (let i = 0; i < I.length; i += 3) { const a = [0, 1, 2].map((k) => [P.getX(I[i + k]), P.getY(I[i + k]), P.getZ(I[i + k])]); if (Math.hypot(...cross3([a[1][0] - a[0][0], a[1][1] - a[0][1], a[1][2] - a[0][2]], [a[2][0] - a[0][0], a[2][1] - a[0][1], a[2][2] - a[0][2]])) > 1e-6) this.idx.push(base + I[i], base + I[i + 1], base + I[i + 2]); } // (the sphere's pole triangles are degenerate)
            g.dispose();
        }
    }
    build() {
        const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); o.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 1));
        if (this.col) o.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        o.setIndex(this.idx); o.computeBoundingSphere(); o.computeBoundingBox(); return o;
    }
}

/** a hanging shoot from (angle a, radius r0, height y0): leaves near-level, arches `out` metres further and falls L metres plumb */
const hang = (a, r0, y0, out, L, lean, wav, ph) => (t) => { const ro = r0 + out * (1 - Math.pow(1 - t, 2.6)) - 0.3 * t * t, s = (lean + wav * Math.sin(t * 5.2 + ph)) * t; return [Math.cos(a) * ro - Math.sin(a) * s, y0 - L * Math.pow(t, 1.5), Math.sin(a) * ro + Math.cos(a) * s]; };

let GEO = null;
function geos() {
    if (GEO) return GEO;
    const r = rng(20261111), R = (a, b) => a + (b - a) * r();
    // ---- tresses: tiers of leafy hanging shoots, from the drape over the top down to the outer curtain; the inner tier is in shade
    const tresses = [];
    const domeY = (rr) => 9.05 - 0.29 * rr * rr; // (the top of the crown: the shoots of the upper tiers start on it)
    const tier = (n, f) => { const off = r() * 6.28; for (let k = 0; k < n; k++) tresses.push({ a: off + (k + R(-0.42, 0.42)) / n * Math.PI * 2, lean: R(-0.12, 0.12), wav: R(0.03, 0.1), ph: R(0, 6.28), tone: R(0.82, 1.1), flip: r() < 0.5 ? -1 : 1, ...f(k) }); };
    tier(40, () => { const r0 = R(0.1, 1.2); return { r0, y0: domeY(r0) + R(0.1, 0.3), out: R(1.7, 2.7), L: R(2.6, 4.8), w: R(0.13, 0.2), shade: 1.04, segs: 5 }; });
    tier(56, () => { const r0 = R(1.3, 2.35); return { r0, y0: domeY(r0) + R(-0.1, 0.15), out: R(1.1, 1.75), L: R(4.2, 6.6), w: R(0.12, 0.2), shade: 0.98, segs: 6 }; });
    tier(70, () => { const y0 = R(6.7, 7.45); return { r0: R(2.35, 2.9), y0, out: R(0.75, 1.3), L: y0 - R(0.35, 2.3), w: R(0.12, 0.2), shade: 0.92, segs: 6 }; });
    tier(30, () => ({ r0: R(1.0, 1.9), y0: R(6.2, 6.9), out: R(0.5, 1.0), L: R(3.4, 5.6), w: R(0.14, 0.22), shade: 0.56, segs: 4 }));
    const crownOf = (lite) => {
        const M = new Mesh(true);
        M.lobes([[0.1, 7.85, 0, 1.7, 1.05, 1.7], ...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2 + 0.3 + hash(k, 3) * 0.5, rr = 1.25 + hash(k, 5) * 0.35; return [Math.cos(a) * rr, 7.25 + hash(k, 7) * 0.3, Math.sin(a) * rr, 1.05 + hash(k, 9) * 0.2, 0.8 + hash(k, 11) * 0.2, 1.05 + hash(k, 13) * 0.2]; })], { seg: lite ? [6, 4] : [8, 6] });
        tresses.forEach((t, i) => {
            if (lite && i % 2) return;
            const P = hang(t.a, t.r0, t.y0, t.out, t.L, t.lean, t.wav, t.ph), segs = lite ? 3 : t.segs, w = t.w * (lite ? 1.75 : 1), pts = Array.from({ length: segs + 1 }, (_, k) => P(k / segs));
            M.tube(pts, [-Math.sin(t.a) * t.flip, 0, Math.cos(t.a) * t.flip], 3, (k) => {
                const u = k / segs, prof = u < 0.55 ? 0.4 + 0.6 * Math.sin(u / 0.55 * Math.PI / 2) : Math.pow((1 - u) / 0.45, 0.75), tooth = lite ? 1 : 1 + (k % 2 ? 0.22 : -0.14);
                const s = t.shade * t.tone * (0.8 + 0.3 * u);
                return { u: Math.max(0.03, w * prof * tooth), v: Math.max(0.02, w * prof * 0.6), sway: u * u, c: [s * (1 + 0.07 * u), s, s * (1 - 0.3 * u)] };
            }, 0.62);
        });
        return M.build();
    };
    // ---- trunk: a stout leaning stem, a leader, five limbs that climb and arch over, side branches and thin hanging twigs
    const lx = 0.2, lz = 0.12, stem = (y) => { const u = Math.max(0, y) / 2.6; return [lx * u * u, y, lz * u * u]; }, limbs = [], sideBr = [], whips = [];
    const off = r() * 6.28;
    for (let k = 0; k < 5; k++) {
        const a = off + (k + R(-0.25, 0.25)) / 5 * Math.PI * 2, S = stem(R(2.1, 3.0)), er = [Math.cos(a), 0, Math.sin(a)], reach = R(1.9, 2.4), top = R(6.5, 7.0);
        const C = [S[0] + er[0] * R(0.7, 1.1), S[1] + R(2.4, 3.0), S[2] + er[2] * R(0.7, 1.1)], E = [er[0] * reach, top, er[2] * reach];
        const bez = (t) => [0, 1, 2].map((i) => (1 - t) * (1 - t) * S[i] + 2 * t * (1 - t) * C[i] + t * t * E[i]);
        limbs.push({ a, pts: [0, 0.25, 0.5, 0.75, 1].map(bez).concat([[er[0] * (reach + 0.75), top - 0.45, er[2] * (reach + 0.75)]]) });
        for (const [t0, da] of [[0.55, R(0.5, 0.8)], [0.8, -R(0.45, 0.8)]]) {
            const b = a + da, B0 = bez(t0), eb = [Math.cos(b), 0, Math.sin(b)], rr = R(2.2, 2.7), yy = R(6.4, 6.9);
            sideBr.push({ a: b, pts: [B0, [(B0[0] + eb[0] * rr) / 2, (B0[1] + yy) / 2 + 0.5, (B0[2] + eb[2] * rr) / 2], [eb[0] * rr, yy, eb[2] * rr], [eb[0] * (rr + 0.5), yy - 0.5, eb[2] * (rr + 0.5)]] });
        }
    }
    for (const br of [...limbs, ...sideBr]) { // twigs hang from the outer half of every limb and side branch
        const n = br.pts.length, cnt = br.pts.length > 4 ? 6 : 3;
        for (let k = 0; k < cnt; k++) { const f = R(0.45, 1) * (n - 2), i = Math.min(n - 2, Math.floor(f)), u = f - i, p = [0, 1, 2].map((j) => br.pts[i][j] + (br.pts[i + 1][j] - br.pts[i][j]) * u), a = Math.atan2(p[2], p[0]), r0 = Math.hypot(p[0], p[2]); whips.push({ a, P: hang(a, r0, p[1], R(0.5, 1.2), p[1] - R(0.9, 2.4), R(-0.7, 0.7), R(0.03, 0.1), R(0, 6.28)) }); }
    }
    const trunkOf = (lite) => {
        const M = new Mesh(false), ys = lite ? [-0.3, 1.2, 2.6, 5.0, 7.0] : [-0.3, 0.35, 1.3, 2.6, 3.8, 5.2, 7.0], rad = (y) => y < 0.35 ? 0.58 - (y + 0.3) * 0.2 : y < 2.6 ? 0.45 - (y - 0.35) * 0.04 : Math.max(0.04, 0.2 - (y - 3.8) * 0.055) + 0.16 * Math.max(0, 1 - (y - 2.6) / 1.2);
        M.tube(ys.map((y) => { const p = stem(Math.min(y, 2.6)); return [p[0] + Math.max(0, y - 2.6) * 0.16, y, p[2] - Math.max(0, y - 2.6) * 0.1]; }), [1, 0, 0], lite ? 5 : 8, (k) => ({ u: rad(ys[k]), v: rad(ys[k]) * 0.92, sway: 0 }));
        for (const b of limbs) { const pts = lite ? [b.pts[0], b.pts[2], b.pts[4], b.pts[5]] : b.pts, n = pts.length; M.tube(pts, [-Math.sin(b.a), 0, Math.cos(b.a)], lite ? 3 : 6, (k) => { const rr = 0.19 - 0.15 * k / (n - 1); return { u: rr, v: rr, sway: 0 }; }); }
        if (lite) return M.build();
        for (const b of sideBr) M.tube(b.pts, [-Math.sin(b.a), 0, Math.cos(b.a)], 4, (k) => { const rr = 0.065 - 0.045 * k / 3; return { u: rr, v: rr, sway: 0 }; });
        for (const w of whips) M.tube([0, 0.3, 0.62, 1].map(w.P), [-Math.sin(w.a), 0, Math.cos(w.a)], 3, (k) => ({ u: 0.024 - 0.004 * k, v: 0.024 - 0.004 * k, sway: (k / 3) ** 2 }));
        return M.build();
    };
    return (GEO = { crown: crownOf(false), crownLow: crownOf(true), trunk: trunkOf(false), trunkLow: trunkOf(true) });
}

/** the hanging shoots drift in the breeze: vertices move by their `sway` weight (0 on the stem and the top, 1 at a shoot tip) */
function swayPatch(mat, U) {
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWillowT = U.t; sh.uniforms.uWillowAmp = U.amp;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sway; uniform float uWillowT, uWillowAmp; varying float vWillowU;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                {
                    vWillowU = sway; // (render.js patchCrowns, WILLOW_CROWN: the bare season draws only the hanging shoots)
                    float wPh = position.x * 0.9 + position.z * 0.7;
                    #ifdef USE_INSTANCING
                        wPh += instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
                    #endif
                    transformed.xz += sway * uWillowAmp * vec2(sin(uWillowT * 0.9 + wPh) + 0.45 * sin(uWillowT * 2.3 + wPh * 1.7), cos(uWillowT * 0.7 + wPh * 1.2) + 0.45 * sin(uWillowT * 1.9 + wPh * 2.1));
                }`);
    };
    mat.customProgramCacheKey = () => 'willow-sway';
}

/** instanced willows: list [{ x, z, y?, s?, c? }] → { group, crowns[], colliders[], update(dt, x, z, windKmh?) } */
export function buildWillows(list, ground, { seed = 11, near = 70 } = {}) {
    const G = geos(), grp = new THREE.Group(), N = Math.max(1, list.length); grp.name = 'willows';
    const U = { t: { value: 0 }, amp: { value: 0.09 } };
    const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }); crownMat.name = 'treeCrowns'; crownMat.defines = { WILLOW_CROWN: 1 };
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#75634f' });
    swayPatch(crownMat, U); swayPatch(trunkMat, U);
    const crown = new THREE.InstancedMesh(G.crown, crownMat, N), trunk = new THREE.InstancedMesh(G.trunk, trunkMat, N), crownLow = new THREE.InstancedMesh(G.crownLow, crownMat, N), trunkLow = new THREE.InstancedMesh(G.trunkLow, trunkMat, N);
    crown.name = 'treeCrowns willow'; crownLow.name = 'treeCrowns willow low'; trunk.name = 'treeTrunks'; trunkLow.name = 'treeTrunks low';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), colliders = [], mats = [], cols = [];
    list.forEach((t) => {
        const s = t.s || 1, y = t.y ?? ground.heightAt(t.x, t.z) - 0.05, a = hash(t.x * .37 + seed, t.z * .53) * Math.PI * 2;
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(t.x, y, t.z), q.setFromAxisAngle(up, a), new THREE.Vector3(s, s * (0.94 + hash(t.z, t.x) * 0.12), s)));
        cols.push(new THREE.Color(t.c || '#9cb457'));
        colliders.push({ x: t.x, z: t.z, r: 0.48 * s, hw: 0.48 * s, prop: true, h: 6 });
    });
    for (const m of [crown, crownLow, trunk, trunkLow]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; grp.add(m); }
    crown.renderOrder = 1;
    // full trees within `near` metres of the viewer, light ones beyond; both far → near (bare crowns blend in that order)
    let lx = 1e9, lz = 1e9;
    const place = (x, z) => {
        if (Math.hypot(x - lx, z - lz) < 6) return; lx = x; lz = z;
        const order = list.map((t, i) => [i, Math.hypot(t.x - x, t.z - z)]).sort((a, b) => b[1] - a[1]); let h = 0, l = 0;
        for (const [i, d] of order) { if (d < near) { crown.setMatrixAt(h, mats[i]); trunk.setMatrixAt(h, mats[i]); crown.setColorAt(h, cols[i]); h++; } else { crownLow.setMatrixAt(l, mats[i]); trunkLow.setMatrixAt(l, mats[i]); crownLow.setColorAt(l, cols[i]); l++; } }
        crown.count = trunk.count = h; crownLow.count = trunkLow.count = l;
        for (const m of [crown, crownLow, trunk, trunkLow]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    };
    for (const m of [crown, crownLow]) { for (let i = 0; i < N; i++) { m.setMatrixAt(i, m4.identity()); m.setColorAt(i, cols[i] || new THREE.Color('#9cb457')); } }
    for (const m of [trunk, trunkLow]) for (let i = 0; i < N; i++) m.setMatrixAt(i, m4.identity());
    if (list.length) place(list[0].x, list[0].z); else crown.count = trunk.count = crownLow.count = trunkLow.count = 0;
    const update = (dt, x, z, windKmh) => { U.t.value += dt; if (Number.isFinite(windKmh)) U.amp.value += (Math.min(0.2, 0.05 + windKmh * 0.005) - U.amp.value) * Math.min(1, dt); if (Number.isFinite(x)) place(x, z); };
    return { group: grp, crowns: [crown, crownLow], colliders, update };
}
