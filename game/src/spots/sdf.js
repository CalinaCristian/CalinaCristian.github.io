// ============================================================================
//  SDF sculpting for organic public art (Troll, Rachel the pig, boulders, glass):
//  primitives + smooth unions + 3-D noise, meshed with naive surface nets over a
//  sparse grid (blocks far from the surface are skipped). Vertex colours come
//  from a colour callback and a cheap SDF ambient-occlusion term, so cavities
//  (between fingers, under the brow) read without textures (R15.7: no photos).
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

// ---------------------------------------------------------------------------- primitives (all return signed distance)
export const sdSphere = (x, y, z, cx, cy, cz, r) => { const dx = x - cx, dy = y - cy, dz = z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; };
/** ellipsoid (approximate, good near the surface) */
export function sdEllipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
    const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
    const qx = px / rx, qy = py / ry, qz = pz / rz, k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
/** round cone / capsule between a and b with radii ra → rb */
export function sdCapsule(x, y, z, ax, ay, az, bx, by, bz, ra, rb = ra) {
    const bax = bx - ax, bay = by - ay, baz = bz - az, pax = x - ax, pay = y - ay, paz = z - az;
    const L2 = bax * bax + bay * bay + baz * baz;
    let h = L2 > 0 ? (pax * bax + pay * bay + paz * baz) / L2 : 0; h = h < 0 ? 0 : h > 1 ? 1 : h;
    const ex = pax - bax * h, ey = pay - bay * h, ez = paz - baz * h; return Math.sqrt(ex * ex + ey * ey + ez * ez) - (ra + (rb - ra) * h);
}
/** rounded box centred at c with half-extents h, rounding r */
export function sdBox(x, y, z, cx, cy, cz, hx, hy, hz, r = 0) {
    const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
    const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0; return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
/** polynomial smooth min (k = blend radius) */
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

// ---------------------------------------------------------------------------- 3-D value noise
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
export function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let u = x - xi, v = y - yi, w = z - zi; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
    const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
    const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), k = h3(xi + 1, yi + 1, zi + 1);
    const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (k - g) * u;
    const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
}
export function fbm3(x, y, z, oct = 3) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.07; a *= 0.5; } return s; }

// ---------------------------------------------------------------------------- mesher
/**
 * Mesh an SDF with naive surface nets.
 * @param {(x,y,z)=>number} sdf  negative inside
 * @param {{min:[x,y,z], max:[x,y,z], cell:number, color?:(x,y,z,nx,ny,nz,ao)=>THREE.Color, ao?:number, lipschitz?:number}} o
 * @returns {THREE.BufferGeometry} indexed, with normal + color (+ position)
 */
export function meshSDF(sdf, o) {
    const c = o.cell, [x0, y0, z0] = o.min;
    const nx = Math.ceil((o.max[0] - x0) / c) + 1, ny = Math.ceil((o.max[1] - y0) / c) + 1, nz = Math.ceil((o.max[2] - z0) / c) + 1;
    const N = nx * ny * nz, vals = new Float32Array(N);
    const B = 4, lip = o.lipschitz || 1.6;
    // sparse evaluation: 4×4×4 blocks whose centre is far from the surface get a constant value
    const near = new Uint8Array(N);
    for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
        const ci = Math.min(nx - 1, bi + B / 2), cj = Math.min(ny - 1, bj + B / 2), ck = Math.min(nz - 1, bk + B / 2);
        const d = sdf(x0 + ci * c, y0 + cj * c, z0 + ck * c);
        const far = Math.abs(d) > c * B * 0.9 * lip;
        for (let k = bk; k < Math.min(nz, bk + B + 1); k++) for (let j = bj; j < Math.min(ny, bj + B + 1); j++) for (let i = bi; i < Math.min(nx, bi + B + 1); i++) {
            const id = i + nx * (j + ny * k);
            if (!far) near[id] = 1; else if (!near[id]) vals[id] = d;
        }
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const id = i + nx * (j + ny * k);
        if (near[id]) vals[id] = sdf(x0 + i * c, y0 + j * c, z0 + k * c);
    }
    // one vertex per sign-changing cell
    const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
    const pos = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cornerOff = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const cv = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let q = 0; q < 8; q++) { const o2 = cornerOff[q]; const v = vals[(i + o2[0]) + nx * ((j + o2[1]) + ny * (k + o2[2]))]; cv[q] = v; if (v < 0) mask |= 1 << q; }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of E) {
            const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue;
            const t = va / (va - vb), A = cornerOff[a], Bc = cornerOff[b];
            sx += A[0] + (Bc[0] - A[0]) * t; sy += A[1] + (Bc[1] - A[1]) * t; sz += A[2] + (Bc[2] - A[2]) * t; cnt++;
        }
        cellV[i + (nx - 1) * (j + (ny - 1) * k)] = pos.length / 3;
        pos.push(x0 + (i + sx / cnt) * c, y0 + (j + sy / cnt) * c, z0 + (k + sz / cnt) * c);
    }
    // quads across sign-changing grid edges
    const idx = [];
    const CV = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) ? -1 : cellV[i + (nx - 1) * (j + (ny - 1) * k)];
    const quad = (a, b, cc, d, flip) => { if (a < 0 || b < 0 || cc < 0 || d < 0) return; if (flip) idx.push(a, cc, b, a, d, cc); else idx.push(a, b, cc, a, cc, d); };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v0 = vals[i + nx * (j + ny * k)], in0 = v0 < 0;
        if (i < nx - 1 && j > 0 && k > 0) { const v1 = vals[i + 1 + nx * (j + ny * k)]; if ((v1 < 0) !== in0) quad(CV(i, j - 1, k - 1), CV(i, j, k - 1), CV(i, j, k), CV(i, j - 1, k), !in0); }
        if (j < ny - 1 && i > 0 && k > 0) { const v1 = vals[i + nx * (j + 1 + ny * k)]; if ((v1 < 0) !== in0) quad(CV(i - 1, j, k - 1), CV(i - 1, j, k), CV(i, j, k), CV(i, j, k - 1), !in0); }
        if (k < nz - 1 && i > 0 && j > 0) { const v1 = vals[i + nx * (j + ny * (k + 1))]; if ((v1 < 0) !== in0) quad(CV(i - 1, j - 1, k), CV(i, j - 1, k), CV(i, j, k), CV(i - 1, j, k), !in0); }
    }
    // normals from the SDF gradient, colour + AO
    const nV = pos.length / 3, nor = new Float32Array(nV * 3), col = new Float32Array(nV * 3), e = c * 0.5, aoR = o.ao ?? c * 3;
    const tmp = new THREE.Color();
    // gradient from the sampled grid: central differences at the 8 cell corners, trilinearly blended (no extra SDF calls)
    const V = (i, j, k) => vals[Math.min(nx - 1, Math.max(0, i)) + nx * (Math.min(ny - 1, Math.max(0, j)) + ny * Math.min(nz - 1, Math.max(0, k)))];
    const gridGrad = (x, y, z) => {
        const fx = (x - x0) / c, fy = (y - y0) / c, fz = (z - z0) / c;
        const i = Math.min(nx - 2, Math.max(0, Math.floor(fx))), j = Math.min(ny - 2, Math.max(0, Math.floor(fy))), k = Math.min(nz - 2, Math.max(0, Math.floor(fz)));
        const u = fx - i, v = fy - j, w = fz - k; let gx = 0, gy = 0, gz = 0;
        for (let q = 0; q < 8; q++) {
            const a = q & 1, b = (q >> 1) & 1, d = (q >> 2) & 1, wt = (a ? u : 1 - u) * (b ? v : 1 - v) * (d ? w : 1 - w);
            const ii = i + a, jj = j + b, kk = k + d;
            gx += wt * (V(ii + 1, jj, kk) - V(ii - 1, jj, kk)); gy += wt * (V(ii, jj + 1, kk) - V(ii, jj - 1, kk)); gz += wt * (V(ii, jj, kk + 1) - V(ii, jj, kk - 1));
        }
        return [gx, gy, gz];
    };
    for (let v = 0; v < nV; v++) {
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        let gx, gy, gz;
        if (o.exactNormals) { gx = sdf(x + e, y, z) - sdf(x - e, y, z); gy = sdf(x, y + e, z) - sdf(x, y - e, z); gz = sdf(x, y, z + e) - sdf(x, y, z - e); }
        else [gx, gy, gz] = gridGrad(x, y, z);
        const L = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1; gx /= L; gy /= L; gz /= L;
        nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
        let ao = 1;
        if (aoR > 0) { // 2-tap SDF AO: how open is the space along the normal
            const d1 = sdf(x + gx * aoR * 0.5, y + gy * aoR * 0.5, z + gz * aoR * 0.5), d2 = sdf(x + gx * aoR, y + gy * aoR, z + gz * aoR);
            ao = Math.max(0.25, Math.min(1, 0.35 + 0.65 * (d1 / (aoR * 0.5) * 0.5 + d2 / aoR * 0.5)));
        }
        const cc = o.color ? o.color(x, y, z, gx, gy, gz, ao, tmp) : tmp.setRGB(ao, ao, ao);
        col[v * 3] = cc.r; col[v * 3 + 1] = cc.g; col[v * 3 + 2] = cc.b;
    }
    // winding follows the SDF normal (robust against the quad orientation convention)
    for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, d = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[d] - pos[a], vy = pos[d + 1] - pos[a + 1], vz = pos[d + 2] - pos[a + 2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const s = fx * (nor[a] + nor[b] + nor[d]) + fy * (nor[a + 1] + nor[b + 1] + nor[d + 1]) + fz * (nor[a + 2] + nor[b + 2] + nor[d + 2]);
        if (s < 0) { const tmpI = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmpI; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(nV > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    g.userData.stats = { verts: nV, tris: idx.length / 3, grid: [nx, ny, nz] };
    return g;
}

/**
 * Top-surface heightmap of an SDF (for walkable sculptures: climb the Troll's hand / head).
 * Returns { x0, z0, d, nx, nz, h: Float32Array (NaN = no surface) , at(x,z) }.
 */
export function sdfHeightmap(sdf, { min, max, cell = 0.25, step = 0.08 }) {
    const nx = Math.ceil((max[0] - min[0]) / cell) + 1, nz = Math.ceil((max[2] - min[2]) / cell) + 1, h = new Float32Array(nx * nz).fill(NaN);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = min[0] + i * cell, z = min[2] + j * cell;
        let y = max[1];
        // sphere-trace downward
        for (let it = 0; it < 200 && y > min[1]; it++) { const d = sdf(x, y, z); if (d < step * 0.5) break; y -= Math.max(step * 0.5, d * 0.7); }
        if (y > min[1] + 0.02) h[i + j * nx] = y;
    }
    const at = (x, z) => {
        const fx = (x - min[0]) / cell, fz = (z - min[2]) / cell; if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return NaN;
        const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j;
        const a = h[i + j * nx], b = h[i + 1 + j * nx], c2 = h[i + (j + 1) * nx], d = h[i + 1 + (j + 1) * nx];
        if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c2) || Number.isNaN(d)) { // nearest valid sample
            const n = h[Math.round(fx) + Math.round(fz) * nx]; return n;
        }
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c2 * (1 - u) * v + d * u * v;
    };
    return { x0: min[0], z0: min[2], d: cell, nx, nz, h, at };
}
