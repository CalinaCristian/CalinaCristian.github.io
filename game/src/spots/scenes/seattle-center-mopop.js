// ============================================================================
//  MoPOP's skin (r3-sea-spots-b-4): the seven mapped lobes (OSM building:part w1534908988–94, colours and heights as
//  tagged) as continuous curved metal masses instead of straight prisms with flat or tagged-shape roofs. Source: the
//  dossier's panorama notes ("iridescent purple-bronze and silver, continuous curved lobes"; Wikipedia: 21,000 stainless
//  steel and painted aluminium shingles on 3,000 panels). Each lobe keeps its OSM footprint and height: the footprint's
//  corners are rounded (Chaikin), the walls bulge out a little above the ground and roll over into a rounded crown at the
//  mapped height, each lobe leaning away from the building's middle. Bulge, lean, crown profile, shingle size, the metal's
//  sheen and how far the tagged colours are toned toward polished metal are estimates.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { canvas, canvasTexture, rng } from '../kit.js';

export const MOPOP_LOBES = ['w1534908988', 'w1534908989', 'w1534908990', 'w1534908991', 'w1534908992', 'w1534908993', 'w1534908994'];
// profile up the lobe: [height fraction, scale about the footprint centre]
const PROFILE = [[0, 1], [0.12, 1.035], [0.3, 1.06], [0.5, 1.055], [0.66, 1.02], [0.78, 0.95], [0.87, 0.84], [0.93, 0.7], [0.975, 0.48], [0.995, 0.22]];
const LEAN = 1.6; // m at the top, away from the building's middle

function chaikin(P, it = 2) {
    let r = P;
    for (let k = 0; k < it; k++) { const o = []; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } r = o; }
    return r;
}
const area2 = (P) => P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0);
function centroidA(P) { let A = 0, x = 0, z = 0; for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], c = ax * bz - bx * az; A += c; x += (ax + bx) * c; z += (az + bz) * c; } return Math.abs(A) < 1e-6 ? P[0] : [x / (3 * A), z / (3 * A)]; }

function shingleTexture() {
    const c = canvas(256, 256), g = c.getContext('2d'), r = rng(1999);
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) for (let x = -32; x < 256; x += 64) {
        const xx = x + (y / 32 % 2) * 32, s = 200 + Math.floor(r() * 55); g.fillStyle = `rgb(${s},${s},${s})`; g.fillRect(xx + 1, y + 1, 62, 30);
        g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(xx, y + 30, 64, 2); }
    return canvasTexture(c, { repeat: true });
}

/** draws the lobes; returns stats. Callers add MOPOP_LOBES to ctx.skipBuildings before ctx.osmBackdrop(). */
export function mopopSkin(ctx) {
    const d = ctx.data, g = ctx.ground, lobes = MOPOP_LOBES.map((id) => d.buildings.find((b) => b.id === id)).filter((b) => b?.poly?.length > 2);
    if (!lobes.length) return null;
    let mx = 0, mz = 0; for (const b of lobes) { const c = centroidA(b.poly); mx += c[0] / lobes.length; mz += c[1] / lobes.length; }
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: shingleTexture(), metalness: 0.82, roughness: 0.34, iridescence: 0.55, iridescenceIOR: 1.6, iridescenceThicknessRange: [220, 680], envMapIntensity: 1.25 });
    mat.name = 'mopop-skin'; mat.userData.nightWindows = false;
    const tone = new THREE.Color('#b8b6b0'), col = new THREE.Color(), out = [];
    for (const b of lobes) {
        let P = chaikin(b.poly, 2); if (area2(P) < 0) P = P.slice().reverse();
        const [cx, cz] = centroidA(P), H = b.h || 18, y0 = Math.min(...b.poly.map(([x, z]) => g.heightAt(x, z))) - 0.3;
        let lx = cx - mx, lz = cz - mz; const L = Math.hypot(lx, lz) || 1; lx /= L; lz /= L;
        col.set(b.c || '#a0a0a0').lerp(tone, b.c === 'silver' ? 0 : 0.18);
        const M = P.length, rows = PROFILE.length, pos = [], uv = [], idx = [], cols = [];
        let per = 0; const run = [0]; for (let i = 0; i < M; i++) { per += Math.hypot(P[(i + 1) % M][0] - P[i][0], P[(i + 1) % M][1] - P[i][1]); run.push(per); }
        for (let k = 0; k < rows; k++) { const [t, s] = PROFILE[k], y = y0 + 0.3 + (H - 0.3) * t + (k === 0 ? -0.3 : 0), ox = lx * LEAN * t * t, oz = lz * LEAN * t * t;
            for (let i = 0; i <= M; i++) { const [px, pz] = P[i % M]; pos.push(cx + (px - cx) * s + ox, y, cz + (pz - cz) * s + oz); uv.push(run[i] / 3.5, y / 1.75); cols.push(col.r, col.g, col.b); } }
        const apex = pos.length / 3; pos.push(cx + lx * LEAN, y0 + H, cz + lz * LEAN); uv.push(0, (y0 + H) / 3); cols.push(col.r, col.g, col.b);
        for (let k = 0; k < rows - 1; k++) for (let i = 0; i < M; i++) { const a = k * (M + 1) + i, b2 = a + 1, c = a + M + 1, e = c + 1; idx.push(a, b2, e, a, e, c); }
        for (let i = 0; i < M; i++) { const a = (rows - 1) * (M + 1) + i; idx.push(a, a + 1, apex); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx);
        geo.computeVertexNormals();
        // outward faces: CCW footprint in x/z with +y up winds the quads inward, so flip if the first normal points to the centre
        { const N = geo.attributes.normal, i0 = (M + 1) * 2, px = pos[i0 * 3] - cx, pz = pos[i0 * 3 + 2] - cz; if (N.getX(i0) * px + N.getZ(i0) * pz < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const tt = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tt; } geo.computeVertexNormals(); } }
        // the seam column (i = 0 and i = M share a position): average their normals so the lobe has no shading seam
        { const N = geo.attributes.normal; for (let k = 0; k < rows; k++) { const a = k * (M + 1), e = a + M; const nx = N.getX(a) + N.getX(e), ny = N.getY(a) + N.getY(e), nz = N.getZ(a) + N.getZ(e), l = Math.hypot(nx, ny, nz) || 1; N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(e, nx / l, ny / l, nz / l); } }
        const me = new THREE.Mesh(geo, mat); me.name = 'mopop-lobe:' + b.id; me.castShadow = true; me.receiveShadow = true; ctx.add(me);
        ctx.poly(b.poly, { y0: y0 - 1, y1: y0 + H });
        out.push({ id: b.id, colour: b.c || null, h: H, verts: pos.length / 3 });
    }
    return { lobes: out, basis: 'OSM parts (footprint, height, colour); curved skin from the panorama notes; profile estimated' };
}
