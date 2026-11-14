// Space Needle frame for space-needle.js (split out by spec 22; space-needle.js re-exports NEEDLE): azimuths, levels and
// radii (NEEDLE, shared with the visit scene) and the triangle-soup geometry helpers (Tris, lathe, sector, hexR).
// Frame: x east, z south, y = 0 at the base; sources and estimates in the space-needle.js header.
import * as THREE from '../../vendor/three.module.min.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const LEG_AZ = [90, 210, 330].map((d) => d * DEG), EL_AZ = [30, 150, 270].map((d) => d * DEG);
const WAIST = 113, RING_Y = 146.7, RING_R = 9.9;
const pol = (r, a, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];
const yawX = (dx, dz) => Math.atan2(-dz, dx); // rotation.y turning a box's local +x towards (dx, dz)
const lerp = (a, b, t) => a + (b - a) * t;

/** levels, radii and the interior layout shared with the visit scene (colliders, walk surfaces, activities) */
export const NEEDLE = {
    legAz: LEG_AZ, elAz: EL_AZ, top: 184.4, skyline: 30.5, cabR: 4.25, cabBaseY: 5.12, shaftR: 5.6,
    loupeY: 152.4, loupeCeil: 155.9, coreR: 6.2, turnR0: 10.2, turnR1: 14.6, loupeWallR: 15.5,
    deckY: 158.5, deckCeil: 161.3, deckInR: 13.7, deckOutR: 16.4, haloR: 21,
    doorAz: [45, 135, 225, 315].map((d) => d * DEG), doorHalf: 1.0,
    stair: { r0: 6.25, r1: 8.05, a0: 292 * DEG, a1: 361 * DEG, steps: 34 },
    bar: { a0: 165 * DEG, a1: 235 * DEG, r0: 7.55, r1: 8.25, stools: 9 },
    cafe: { a0: 62 * DEG, a1: 118 * DEG, r0: 7.5, r1: 8.2 },
    wine: { a0: 190 * DEG, a1: 232 * DEG, r0: 7.5, r1: 8.1, stools: 5 },
    sofa: { a0: 58 * DEG, a1: 122 * DEG, r0: 6.25, r1: 7.05 },
    loupeTables: 12, loupeTableR: 12.4,
    deckTables: [8, 75, 105, 160, 180, 250, 277].map((d) => ({ az: d * DEG, r: 11.7 })),
    benches: 24,
    pavR: 18.9, pavH: 4.6, drumR: 9.4, drumTop: 10.6,
};
const stairY = (az) => NEEDLE.loupeY + (az - NEEDLE.stair.a0) / (NEEDLE.stair.a1 - NEEDLE.stair.a0) * (NEEDLE.deckY - NEEDLE.loupeY);
NEEDLE.stairY = stairY;

// ---------------------------------------------------------------------------- geometry helpers
/** triangle soup with explicit normals: each face is wound to agree with the normal it is given */
class Tris {
    constructor() { this.p = []; this.n = []; this.u = []; }
    tri(a, b, c, n, uv = null) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx; if (Math.hypot(gx, gy, gz) < 1e-9) return this;
        const per = Array.isArray(n[0]), ns = per ? n : [n, n, n];
        const rx = per ? n[0][0] + n[1][0] + n[2][0] : n[0], ry = per ? n[0][1] + n[1][1] + n[2][1] : n[1], rz = per ? n[0][2] + n[1][2] + n[2][2] : n[2];
        const flip = gx * rx + gy * ry + gz * rz < 0, V = flip ? [a, c, b] : [a, b, c], NN = flip ? [ns[0], ns[2], ns[1]] : ns, UU = uv ? (flip ? [uv[0], uv[2], uv[1]] : uv) : null;
        for (let i = 0; i < 3; i++) { this.p.push(V[i][0], V[i][1], V[i][2]); this.n.push(NN[i][0], NN[i][1], NN[i][2]); if (UU) this.u.push(UU[i][0], UU[i][1]); else this.u.push(0, 0); }
        return this;
    }
    /** corners in order around the face; n = one normal or four */
    quad(a, b, c, d, n, uv = null) {
        const per = Array.isArray(n[0]);
        this.tri(a, b, c, per ? [n[0], n[1], n[2]] : n, uv ? [uv[0], uv[1], uv[2]] : null);
        this.tri(a, c, d, per ? [n[0], n[2], n[3]] : n, uv ? [uv[0], uv[2], uv[3]] : null);
        return this;
    }
    get empty() { return !this.p.length; }
    geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
        return g;
    }
    into(b, key, color) { if (!this.empty) { const g = this.geo(); b.add(g, key, null, color); g.dispose(); } this.p.length = this.n.length = this.u.length = 0; return this; }
}
/** revolve a profile [[r, y], ...] about the axis from a0 to a1. Faces look to the RIGHT of the travel direction
 *  (r to the right, y up): up a wall = outward, inward along a floor = up, outward along a ceiling = down. */
function lathe(T, prof, n, a0 = 0, a1 = TAU) {
    for (let i = 0; i + 1 < prof.length; i++) {
        const [r0, y0] = prof[i], [r1, y1] = prof[i + 1], tl = Math.hypot(r1 - r0, y1 - y0); if (tl < 1e-6) continue;
        const nr = (y1 - y0) / tl, ny = -(r1 - r0) / tl;
        for (let k = 0; k < n; k++) {
            const aa = a0 + (a1 - a0) * k / n, ab = a0 + (a1 - a0) * (k + 1) / n, ca = Math.cos(aa), sa = Math.sin(aa), cb = Math.cos(ab), sb = Math.sin(ab);
            const na = [nr * ca, ny, nr * sa], nb = [nr * cb, ny, nr * sb];
            T.quad([r0 * ca, y0, r0 * sa], [r0 * cb, y0, r0 * sb], [r1 * cb, y1, r1 * sb], [r1 * ca, y1, r1 * sa], [na, nb, nb, na], [[k / n, 0], [(k + 1) / n, 0], [(k + 1) / n, 1], [k / n, 1]]);
        }
    }
    return T;
}
/** closed annular sector (curved counter, tread, wall, slab) */
function sector(T, r0, r1, a0, a1, y0, y1, n = 1) {
    lathe(T, [[r0, y0], [r1, y0], [r1, y1], [r0, y1], [r0, y0]], n, a0, a1);
    if (Math.abs(a1 - a0) < TAU - 1e-6) for (const [a, s] of [[a0, -1], [a1, 1]]) { const c = Math.cos(a), si = Math.sin(a); T.quad([r0 * c, y0, r0 * si], [r1 * c, y0, r1 * si], [r1 * c, y1, r1 * si], [r0 * c, y1, r0 * si], [-si * s, 0, c * s]); }
    return T;
}
/** distance from the axis to the edge of a convex polygon given as half-planes [azimuth, distance] */
const hexR = (planes, a) => { let r = 1e9; for (const [pa, d] of planes) { const c = Math.cos(a - pa); if (c > 1e-3) r = Math.min(r, d / c); } return r; };
export { stairY, WAIST, RING_Y, RING_R, DEG, lerp, pol, EL_AZ, LEG_AZ, yawX, TAU, hexR, lathe, Tris, sector };
