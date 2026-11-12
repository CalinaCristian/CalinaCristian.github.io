// ============================================================================
//  Pike Place Market — the lower level: the cobbled Pike St ramp, the turn under the market and Post Alley with the
//  Gum Wall (Market Theater), as OpenStreetMap maps it and Street View shows it (Google panoramas of Jun 2019 at
//  1498 / 1435 / 1428 Post Alley, viewed for reference only):
//   • the ramp runs along the Economy Market, 8 m south of Pike St and below it, behind a retaining wall covered in
//     murals with a railing and the covered sidewalk on top; a concrete stair climbs the wall near the bottom;
//   • at the bottom the road turns left under the market (Ghost Alley Espresso in the corner, the theatre marquee on
//     the deck edge) into Post Alley, which runs under a building here (OSM tunnel=building_passage): brick walls
//     crusted with gum to about 3 m, barred windows and posters above, a concrete soffit with pipes and lamps,
//     yellow bollards; south of the building the alley is open to the sky and keeps falling toward Union St.
//  Levels: pike-place-streets.js (USGS 1 m DEM). The 2 m terrain grid cannot draw a 4 m retaining wall, so this
//  level is an exact floor (Ground.addFloor) cut out of the terrain, with its own paving and walls.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, canvas, canvasTexture, clamp, lerp, smooth, inPoly } from '../kit.js';
import { triangulate } from '../../building-overlap.js';
import { neonSign, signBoard, railing } from '../props.js';
import { wallGeometry, facadeMaterial, facadeStyle } from '../osm.js';
import { SURVEY, profile } from './pike-place-streets.js';

// ---------------------------------------------------------------------------- plan (OSM building corners)
const E0 = [-16.1, 30.7], DIR = [-0.8512, 0.5248], NOR = [0.5248, 0.8512]; // Economy Market north wall: 1st Ave corner, direction down the ramp, normal into the building
const along = (u, off = 0) => [E0[0] + DIR[0] * u + NOR[0] * off, E0[1] + DIR[1] * u + NOR[1] * off];
const WALL = -7.8;                         // the retaining wall under the Pike St sidewalk canopy (OSM w363400648 south edge)
const U_TOP = 2.5, U_DECK = 36.9, U_TURN = 38.3; // the market-level deck starts past the foot of the stair
const P = {
    r0: along(U_TOP, WALL), rDeck: along(U_DECK, WALL), rTurn: along(U_TURN, WALL),
    nookN: [-54.4, 46.0], nookS: [-54.9, 51.8], west0: [-53.6, 53.8], west1: [-50.3, 51.7], west2: [-39.3, 69.1], west3: [-38.7, 70.2], west4: [-30.4, 83.4],
    east4: [-25.6, 81.0], east3: [-33.9, 67.5], east2: [-34.5, 66.5], east1: [-43.8, 51.6], east0: [-45.5, 48.8], econ: [-44.0, 47.9], e0: along(U_TOP, 0),
};
// ring edges: [from, to, kind]
const EDGES = [
    ['r0', 'rDeck', 'retain'], ['rDeck', 'rTurn', 'under'], ['rTurn', 'nookN', 'under'], ['nookN', 'nookS', 'espresso'], ['nookS', 'west0', 'door'], ['west0', 'west1', 'under'],
    ['west1', 'west2', 'gum'], ['west2', 'west3', 'gum'], ['west3', 'west4', 'alley'], ['west4', 'east4', 'open'], ['east4', 'east3', 'alleyGum'],
    ['east3', 'east2', 'gum'], ['east2', 'east1', 'gum'], ['east1', 'east0', 'gum'], ['east0', 'econ', 'under'], ['econ', 'e0', 'econ'], ['e0', 'r0', 'open'],
];
export const TRENCH = EDGES.map(([a]) => P[a]);
const COVER = [P.rDeck, P.rTurn, P.nookN, P.nookS, P.west0, P.west1, P.west2, P.west3, P.east3, P.east2, P.east1, P.east0, P.econ]; // under the market (OSM roof w1275882967 + passage building w1275882966)
const DECK = [P.rDeck, P.rTurn, P.nookN, P.nookS, P.west0, P.west1, P.east0, P.econ];                                              // … of which the market-level walkway
const BRIDGE = [[-38.7, 70.2], [-36.2, 68.9], [-33.9, 67.5], [-34.5, 66.5], [-43.8, 51.6], [-45.5, 48.8], [-48.4, 50.6], [-50.3, 51.7], [-39.3, 69.1]]; // OSM w1275882966, the building over the alley
const STAIR = { uTop: 30.6, uBot: 36.6, uLand: 29.4, w: 1.5 }; // Street View: the foot is beside the espresso corner, the head in the open by the canopy
export const GUM = { x: -41.4, z: 60.2 };  // the middle of the covered stretch (Street View pano at 1435 Post Alley)

// ---------------------------------------------------------------------------- textures (procedural; no photo, no copied artwork)
const GUM_COLS = ['#f06292', '#f48fb1', '#f8bbd0', '#f8bbd0', '#ffffff', '#f3efe6', '#e8e4da', '#b3e5fc', '#81d4fa', '#c5e1a5', '#aed581', '#fff59d', '#ffcc80', '#ce93d8', '#e57373', '#f48fb1', '#80cbc4', '#d7ccc8', '#ef9a9a', '#9fa8da'] // mostly pinks, whites and pastels
    .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
/** one 4.2 × 4.2 m tile of brick wall (tiles along the wall); gum = how much of it is crusted (0 = bare brick) */
function wallTile(seed, { gum = 1, posters = false, tone = [112, 58, 46] } = {}) {
    const S = 1024, ppm = S / 4.2, c = canvas(S, S), x = c.getContext('2d'), r = rng(seed), img = x.createImageData(S, S), D = img.data;
    const bw = Math.round(0.215 * ppm), bh = Math.round(0.072 * ppm);
    for (let yy = 0; yy < S; yy++) {
        const row = Math.floor(yy / bh), my = yy % bh < 2;
        for (let xx = 0; xx < S; xx++) {
            const o = (yy * S + xx) * 4, bx = xx + (row % 2) * (bw >> 1), mortar = my || bx % bw < 2;
            const id = Math.floor(bx / bw) * 7919 + row * 104729, t = ((id * 2654435761) >>> 0) / 4294967296, g = (((xx * 12.9898 + yy * 78.233) * 43758.5453) % 1 + 1) % 1;
            const k = (mortar ? 0.62 : 0.74 + 0.36 * t) * (0.94 + 0.12 * g) * (1 - 0.18 * (yy / S > 0.86 ? (yy / S - 0.86) / 0.14 : 0)); // grime toward the pavement
            D[o] = tone[0] * k; D[o + 1] = tone[1] * k * (mortar ? 1.25 : 1); D[o + 2] = tone[2] * k * (mortar ? 1.3 : 1); D[o + 3] = 255;
        }
    }
    const put = (px, py, col, a = 1) => { if (py < 0 || py >= S) return; const o = (py * S + ((px % S) + S) % S) * 4; D[o] = D[o] + (col[0] - D[o]) * a; D[o + 1] = D[o + 1] + (col[1] - D[o + 1]) * a; D[o + 2] = D[o + 2] + (col[2] - D[o + 2]) * a; };
    if (posters) { // paste-ups above the gum: paper rectangles with ink blocks (abstract)
        for (let i = 0; i < 7; i++) {
            const w = Math.round((0.3 + r() * 0.55) * ppm), h = Math.round((0.35 + r() * 0.6) * ppm), px = Math.floor(r() * S), py = Math.floor((1 - (2.55 + r() * 1.3) / 4.2) * S) - (h >> 1);
            const paper = [[238, 232, 214], [250, 248, 240], [246, 220, 96], [230, 120, 150], [40, 40, 44], [120, 190, 210]][Math.floor(r() * 6)], ink = paper[0] < 100 ? [240, 236, 220] : [28, 26, 28];
            for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(px + xx, py + yy, paper, 0.94);
            for (let k = 0; k < 3; k++) { const bx = Math.floor(w * 0.12), by = Math.floor(h * (0.12 + k * 0.28)), bw2 = Math.floor(w * (0.35 + r() * 0.4)), bh2 = Math.floor(h * (0.06 + r() * 0.1)); for (let yy = 0; yy < bh2 && by + yy < h; yy++) for (let xx = 0; xx < bw2 && bx + xx < w; xx++) put(px + bx + xx, py + by + yy, ink, 0.9); }
        }
    }
    const n = Math.round(30000 * gum), aged = [150, 128, 118];
    for (let i = 0; i < n; i++) {
        const q = r(), hM = q < 0.74 ? r() * 2.15 : q < 0.93 ? 2.15 + r() * r() * 0.95 : 2.4 + r() * 1.5;       // dense to 2.2 m, thinning to ~3.9 m
        const cx = Math.floor(r() * S), cy = Math.floor((1 - hM / 4.2) * S), rad = 2.4 + r() * r() * 5.2, ax = 0.8 + r() * 0.7, raw = GUM_COLS[Math.floor(r() * GUM_COLS.length)], age = r() < 0.22 ? 0.05 : 0.3 + r() * 0.45; // 1–3 cm wads, most of them faded
        const col = [lerp(raw[0], aged[0], age), lerp(raw[1], aged[1], age), lerp(raw[2], aged[2], age)], R = Math.ceil(rad * Math.max(1, ax));
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const e = (dx * dx) / (rad * ax * rad * ax) + (dy * dy) / (rad * rad); if (e > 1) continue;
            const lit = 0.84 + 0.3 * clamp((-dx - dy) / (2 * rad) + 0.35, 0, 1) - (e > 0.72 ? 0.2 : 0);
            put(cx + dx, cy + dy, [Math.min(255, col[0] * lit), Math.min(255, col[1] * lit), Math.min(255, col[2] * lit)]);
        }
        if (r() < 0.07 && hM < 2.6) { const len = 6 + Math.floor(r() * 46); for (let k = 0; k < len; k++) { put(cx, cy + k, col, 0.85 - 0.5 * k / len); if (k < len * 0.4) put(cx + 1, cy + k, col, 0.6); } } // a pulled string
    }
    x.putImageData(img, 0, 0);
    return canvasTexture(c, { repeat: true });
}
function settTile() {
    const S = 512, c = canvas(S, S), x = c.getContext('2d'), r = rng(77); x.fillStyle = '#3d3a37'; x.fillRect(0, 0, S, S);
    const cols = ['#8e8b86', '#7d7a76', '#9a968f', '#86817a', '#737170', '#a09b93', '#8a8480'], sh = S / 16, sw = S / 10; // 10 × 16 cm setts on a 1.6 m tile
    for (let j = 0; j < 16; j++) for (let i = -1; i < 10; i++) { const px = i * sw + (j % 2) * sw / 2, py = j * sh; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.beginPath(); x.roundRect(px + 2.5, py + 2.5, sw - 5 + (r() - 0.5) * 2, sh - 5, 5); x.fill(); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(px + 5, py + 4, sw - 12, 3); }
    return canvasTexture(c, { repeat: true });
}
/** a painted retaining wall: bold abstract shapes, drips and paste-ups over concrete (invented; no real mural reproduced) */
function muralTexture(w, h) {
    const ppm = 64, cw = Math.min(2048, Math.round(w * ppm)), ch = Math.round(h * ppm), c = canvas(cw, ch), x = c.getContext('2d'), r = rng(404);
    x.fillStyle = '#8d8982'; x.fillRect(0, 0, cw, ch);
    const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#264653', '#ff70a6', '#70d6ff', '#ffffff', '#111111', '#8338ec', '#06d6a0', '#ef476f', '#ffd166', '#118ab2'];
    for (let i = 0; i < 230; i++) {
        const px = r() * cw, py = ch * (0.08 + r() * 0.9), s = (0.25 + r() * 0.9) * ppm; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.strokeStyle = '#111'; x.lineWidth = 3 + r() * 4; x.globalAlpha = 0.86 + r() * 0.14;
        const kind = r();
        if (kind < 0.3) { x.beginPath(); x.ellipse(px, py, s * (0.5 + r()), s * (0.4 + r() * 0.5), r() * 3, 0, 7); x.fill(); if (r() < 0.6) x.stroke(); }
        else if (kind < 0.55) { x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.5); x.fillRect(-s * 0.6, -s * 0.5, s * 1.2, s); if (r() < 0.5) x.strokeRect(-s * 0.6, -s * 0.5, s * 1.2, s); x.restore(); }
        else if (kind < 0.85) { x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) x.bezierCurveTo(px + (r() - 0.5) * s * 3, py + (r() - 0.5) * s * 2, px + (r() - 0.5) * s * 3, py + (r() - 0.5) * s * 2, px + (r() - 0.5) * s * 2.4, py + (r() - 0.5) * s * 1.6); x.lineWidth = 8 + r() * 16; x.strokeStyle = x.fillStyle; x.lineCap = 'round'; x.stroke(); }
        else { x.fillRect(px, py, 5 + r() * 7, s * (0.6 + r())); } // drip
    }
    x.globalAlpha = 1; { const g = x.createLinearGradient(0, ch * 0.8, 0, ch); g.addColorStop(0, 'rgba(40,36,32,0)'); g.addColorStop(1, 'rgba(40,36,32,0.55)'); x.fillStyle = g; x.fillRect(0, 0, cw, ch); }
    return canvasTexture(c);
}
/** a growing mesh of textured quads */
class Quads {
    constructor() { this.pos = []; this.uv = []; this.idx = []; }
    quad(a, b, c, d, uv) { const k = this.pos.length / 3; this.pos.push(...a, ...b, ...c, ...d); this.uv.push(...uv); this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3); }
    mesh(material, name) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, material); m.name = name; m.receiveShadow = true; m.castShadow = true; return m; }
}
const clipHalf = (pts, axis, v, sign) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], da = (a[axis] - v) * sign, db = (b[axis] - v) * sign; if (da >= 0) out.push(a); if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };

// ---------------------------------------------------------------------------- before ctx.osmBackdrop()
export function prepareLower(ctx) {
    ctx.exclude.push(TRENCH);                 // no street trees / benches dropped onto the lower level from the level above
    ctx.skipBuildings.add('w1275882966');     // the building over the alley is rebuilt here, open underneath
}

// ---------------------------------------------------------------------------- after ctx.osmBackdrop()
export function buildLower(ctx, { seaActivity }) {
    const g = ctx.ground, LOW = profile(SURVEY.lower), grp = new THREE.Group(); grp.name = 'lower-post-alley';
    const floorY = (x, z) => { const r = LOW.at(x, z); return r.s < 5 ? lerp(g.heightAt(x, z), r.y, smooth(0, 5, r.s)) : r.y; };
    const plazaY = g.heightAt(-52.5, 41), CEIL = plazaY - 0.5;
    g.addFloor(TRENCH, floorY);
    (ctx.terrainOpts.cutouts ??= []).push(TRENCH);
    const inside = (x, z) => inPoly(x, z, TRENCH);

    // ---- paving: setts, tessellated to 1 m so it follows the grade
    {
        const pos = [], uv = [], col = [], idx = [], T = settTile(), cell = 1;
        for (const tri of triangulate(TRENCH) || []) {
            const xs = tri.map((p) => p[0]), zs = tri.map((p) => p[1]);
            for (let cx = Math.floor(Math.min(...xs) / cell) * cell; cx < Math.max(...xs); cx += cell) for (let cz = Math.floor(Math.min(...zs) / cell) * cell; cz < Math.max(...zs); cz += cell) {
                let p = clipHalf(clipHalf(clipHalf(clipHalf(tri, 0, cx, 1), 0, cx + cell, -1), 1, cz, 1), 1, cz + cell, -1); if (p.length < 3) continue;
                let a2 = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a2 += p[i][0] * q[1] - q[0] * p[i][1]; } if (Math.abs(a2) < 1e-6) continue; if (a2 > 0) p = p.reverse();
                const k = pos.length / 3;
                for (const [x, z] of p) { const s = LOW.at(x, z).s, t = 0.62 + 0.38 * (1 - smooth(27, 36, s)); pos.push(x, floorY(x, z), z); uv.push(x / 1.6, z / 1.6); col.push(t, t, t * 0.98); } // the ramp setts are sun-bleached, the alley's are dark
                for (let i = 1; i < p.length - 1; i++) idx.push(k, k + i, k + i + 1);
            }
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T, vertexColors: true, roughness: 0.93 })); m.name = 'lower-paving'; m.receiveShadow = true; grp.add(m);
    }

    // ---- walls along the ring
    const b = new GeoBatch(), gumQ = new Quads(), brickQ = new Quads(), muralQ = new Quads();
    const TOPY = 3.4, MURAL_H = 4.2; let muralLen = 0; for (const [a, bb, kind] of EDGES) if (kind === 'retain') muralLen += Math.hypot(P[bb][0] - P[a][0], P[bb][1] - P[a][1]);
    let muralS = 0, gumS = 0; const gumWalls = [], windows = [];
    for (const [ka, kb, kind] of EDGES) {
        if (kind === 'open') continue;
        const A = P[ka], B = P[kb], L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
        let nx = -uz, nz = ux; if (!inside((A[0] + B[0]) / 2 + nx * 0.3, (A[1] + B[1]) / 2 + nz * 0.3)) { nx = -nx; nz = -nz; } // into the trench
        const n = Math.max(1, Math.ceil(L / 1.25)), covered = (x, z) => inPoly(x + nx * 0.3, z + nz * 0.3, COVER);
        for (let i = 0; i < n; i++) {
            const t0 = i / n, t1 = (i + 1) / n, x0 = A[0] + (B[0] - A[0]) * t0, z0 = A[1] + (B[1] - A[1]) * t0, x1 = A[0] + (B[0] - A[0]) * t1, z1 = A[1] + (B[1] - A[1]) * t1;
            const f0 = floorY(x0 + nx * 0.05, z0 + nz * 0.05), f1 = floorY(x1 + nx * 0.05, z1 + nz * 0.05), o0 = g.heightAt(x0 - nx * 0.4, z0 - nz * 0.4), o1 = g.heightAt(x1 - nx * 0.4, z1 - nz * 0.4);
            const q0 = [x0 + nx * 0.04, 0, z0 + nz * 0.04], q1 = [x1 + nx * 0.04, 0, z1 + nz * 0.04], at = (q, y) => [q[0], y, q[2]], s0 = t0 * L, s1 = t1 * L, cov = covered((x0 + x1) / 2, (z0 + z1) / 2);
            // a face from (y a0 … y b0) at the first end to (a1 … b1) at the second, seen from inside the trench
            const face = (Q, a0, b0, a1, b1, uv) => Q.quad(at(q1, a1), at(q0, a0), at(q0, b0), at(q1, b1), uv);
            const flat = (a0, b0, a1, b1, colr, key = 'concrete') => b.quad(at(q1, a1), at(q0, a0), at(q0, b0), at(q1, b1), colr, key);
            let top0, top1, collide = true;
            if (kind === 'retain') {
                top0 = Math.max(o0, f0); top1 = Math.max(o1, f1);
                if (top0 > f0 + 0.03 && top1 > f1 + 0.03) face(muralQ, f0, top0, f1, top1, [(muralS + s1) / muralLen, 1 - (top1 - f1) / MURAL_H, (muralS + s0) / muralLen, 1 - (top0 - f0) / MURAL_H, (muralS + s0) / muralLen, 1, (muralS + s1) / muralLen, 1]);
                b.box((x0 + x1) / 2 - nx * 0.14, Math.min(top0, top1) - 0.02, (z0 + z1) / 2 - nz * 0.14, L / n + 0.02, Math.abs(top1 - top0) + 0.14, 0.34, '#9a968e', 'concrete', Math.atan2(ux, uz) + Math.PI / 2); // coping
                const u = (x0 - E0[0]) * DIR[0] + (z0 - E0[1]) * DIR[1]; if (u > STAIR.uLand - 0.3 && u < STAIR.uTop + 0.3) collide = false;                       // the stair lands here
                if (Math.max(top0 - f0, top1 - f1) < 0.45) collide = false;
            } else if (kind === 'gum' || kind === 'alleyGum' || kind === 'alley') {
                top0 = top1 = cov ? CEIL : TOPY;
                const gum = kind !== 'alley' || s0 < 7, gh = 4.2;
                if (gum) { face(gumQ, f0, Math.min(f0 + gh, top0), f1, Math.min(f1 + gh, top1), [(gumS + s1) / 4.2, 0, (gumS + s0) / 4.2, 0, (gumS + s0) / 4.2, Math.min(1, (top0 - f0) / gh), (gumS + s1) / 4.2, Math.min(1, (top1 - f1) / gh)]); }
                const lo0 = gum ? Math.min(f0 + gh, top0) : f0, lo1 = gum ? Math.min(f1 + gh, top1) : f1;
                if (top0 > lo0 + 0.01) face(brickQ, lo0, top0, lo1, top1, [(gumS + s1) / 4.2, (lo1 - f1) / 4.2, (gumS + s0) / 4.2, (lo0 - f0) / 4.2, (gumS + s0) / 4.2, (top0 - f0) / 4.2, (gumS + s1) / 4.2, (top1 - f1) / 4.2]);
                windows.push({ kind, ka, s: (s0 + s1) / 2, x: (x0 + x1) / 2, z: (z0 + z1) / 2, f: (f0 + f1) / 2, nx, nz, ux, uz, cov, top: top0 });
            } else { // under the market deck, the espresso corner, the Economy Market's basement wall
                top0 = top1 = kind === 'econ' ? Math.max(o0, o1, f0, f1) + 0.3 : cov ? CEIL : Math.max(o0, o1) + 0.3;
                if (top0 > Math.min(f0, f1)) flat(f0, top0, f1, top1, kind === 'econ' ? '#3b332d' : '#4a4540', kind === 'econ' ? 'wood' : 'concrete');
            }
            // nobody walks through a wall of the lower level, or off the level above
            if (collide) { const under = kind === 'under' || kind === 'espresso' || kind === 'door'; ctx.collider({ wall: true, ax: x0, az: z0, bx: x1, bz: z1, y0a: f0 - 0.5, y1a: under ? CEIL : Math.max(top0, o0) + 1.1, y0b: f1 - 0.5, y1b: under ? CEIL : Math.max(top1, o1) + 1.1, nx, nz }); }
        }
        if (kind === 'retain') muralS += L; else gumS += L;
    }
    const gumMat = new THREE.MeshStandardMaterial({ map: wallTile(11, { posters: true }), roughness: 0.7 }), brickMat = new THREE.MeshStandardMaterial({ map: wallTile(5, { gum: 0.015 }), roughness: 0.9 });
    const gumMesh = gumQ.mesh(gumMat, 'gum-wall-face'); gumWalls.push(gumMesh);
    const muralMat = new THREE.MeshStandardMaterial({ map: muralTexture(muralLen, MURAL_H), roughness: 0.85 });
    grp.add(gumMesh, brickQ.mesh(brickMat, 'alley-brick'), muralQ.mesh(muralMat, 'ramp-mural'));

    // ---- the market above: deck slab (the walkway from the sign to the Economy Market), the building over the alley
    b.prism(COVER, CEIL, plazaY, '#4b4743', 'concrete', { bottom: true });
    g.addPoly(DECK, plazaY, CEIL);
    {
        const top = plazaY + 7.4, up = wallGeometry(BRIDGE, plazaY, top, facadeStyle('brick'), plazaY, '#9a5a48'); b.add(up, 'f-brick', null, up.userData.col); b.flat(BRIDGE, top, '#6f6b66', 'roofs');
        ctx.poly(BRIDGE, { y0: CEIL, y1: top });
        for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4, x = lerp(-48, -36.6, t), z = lerp(50.3, 68.6, t); b.box(x, CEIL - 0.34, z, 6.2, 0.34, 0.4, '#3d3a37', 'concrete', Math.atan2(0.846, -0.534)); } // soffit beams
    }
    // deck edge over the ramp + the top of the retaining wall: railings (the stair landing stays open)
    { const yUp = (x, z) => Math.max(plazaY - 2, g.heightAt(x + NOR[0] * -0.6, z + NOR[1] * -0.6));
        railing(b, [along(U_TOP + 5, WALL - 0.14), along(STAIR.uLand - 0.25, WALL - 0.14)], yUp, { h: 1.07 }); railing(b, [along(STAIR.uTop + 0.25, WALL - 0.14), along(U_DECK, WALL - 0.14)], yUp, { h: 1.07 });
        const edge = [P.rDeck, P.econ]; railing(b, edge, () => plazaY, { h: 1.07 });
        for (let i = 1; i < edge.length; i++) ctx.collider({ wall: true, ax: edge[i - 1][0], az: edge[i - 1][1], bx: edge[i][0], bz: edge[i][1], y0a: plazaY - 0.1, y1a: plazaY + 1.2, y0b: plazaY - 0.1, y1b: plazaY + 1.2, nx: -DIR[0], nz: -DIR[1] }); }

    // ---- the concrete stair up the retaining wall (bottom at the turn, landing at the covered sidewalk)
    {
        const th = Math.atan2(DIR[0], DIR[1]), off = WALL + STAIR.w / 2 + 0.02, [tx, tz] = along(STAIR.uTop, WALL - 0.5), topY = g.heightAt(tx, tz), [bx, bz] = along(STAIR.uBot, off), botY = floorY(bx, bz);
        const n = Math.ceil((topY - botY) / 0.178), rise = (topY - botY) / n, tread = (STAIR.uBot - STAIR.uTop) / n;
        for (let i = 0; i < n; i++) { const u = STAIR.uBot - (i + 0.5) * tread, [x, z] = along(u, off), y0 = floorY(x, z) - 0.15, y1 = botY + (i + 1) * rise;
            b.box(x, y0, z, STAIR.w, y1 - y0, tread + 0.01, '#8f8b84', 'concrete', th); g.addBox(x, z, STAIR.w / 2, tread / 2, th, y0, y1);
            const [px, pz] = along(u, off + STAIR.w / 2 + 0.08); b.box(px, y0, pz, 0.16, y1 + 0.95 - y0, tread + 0.01, '#8a867f', 'concrete', th); }
        { const u = (STAIR.uTop + STAIR.uLand) / 2, len = STAIR.uTop - STAIR.uLand, [x, z] = along(u, off), y0 = floorY(x, z) - 0.15; b.box(x, y0, z, STAIR.w, topY - y0, len, '#8f8b84', 'concrete', th); g.addBox(x, z, STAIR.w / 2, len / 2, th, y0, topY);
            const [px, pz] = along(u, off + STAIR.w / 2 + 0.08); b.box(px, y0, pz, 0.16, topY + 0.95 - y0, len, '#8a867f', 'concrete', th);
            const [ex, ez] = along(STAIR.uLand - 0.08, off); b.box(ex, y0, ez, STAIR.w + 0.16, topY + 0.95 - y0, 0.16, '#8a867f', 'concrete', th); }
        const a = along(STAIR.uLand, off + STAIR.w / 2 + 0.08), c = along(STAIR.uBot, off + STAIR.w / 2 + 0.08), e = along(STAIR.uLand, WALL);
        { // the stair's side wall toward the ramp is painted like the retaining wall
            const o2 = off + STAIR.w / 2 + 0.17, q = new Quads(), N2 = 8;
            for (let i = 0; i < N2; i++) { const u0 = lerp(STAIR.uLand, STAIR.uBot, i / N2), u1 = lerp(STAIR.uLand, STAIR.uBot, (i + 1) / N2), [x0, z0] = along(u0, o2), [x1, z1] = along(u1, o2), f0 = floorY(x0, z0), f1 = floorY(x1, z1);
                const t0 = (u) => (u <= STAIR.uTop ? topY : lerp(topY, botY, (u - STAIR.uTop) / (STAIR.uBot - STAIR.uTop))) + 0.95;
                q.quad([x0, f0, z0], [x1, f1, z1], [x1, t0(u1), z1], [x0, t0(u0), z0], [0.62 + 0.3 * i / N2, 1 - (t0(u0) - f0) / MURAL_H, 0.62 + 0.3 * (i + 1) / N2, 1 - (t0(u1) - f1) / MURAL_H, 0.62 + 0.3 * (i + 1) / N2, 1, 0.62 + 0.3 * i / N2, 1]); }
            const mm = q.mesh(muralMat, 'stair-mural'); mm.material.side = THREE.DoubleSide; grp.add(mm); }
        ctx.collider({ wall: true, ax: a[0], az: a[1], bx: c[0], bz: c[1], y0a: floorY(a[0], a[1]) - 0.5, y1a: topY + 1, y0b: botY - 0.5, y1b: botY + 1, nx: NOR[0], nz: NOR[1] });
        ctx.collider({ wall: true, ax: e[0], az: e[1], bx: a[0], bz: a[1], y0a: floorY(a[0], a[1]) - 0.5, y1a: topY + 1, y0b: floorY(a[0], a[1]) - 0.5, y1b: topY + 1, nx: -DIR[0], nz: -DIR[1] });
    }

    // ---- alley fittings: barred windows over the gum (east, Market Theater side), arched doors, pipes, bollards, lamps
    {
        const frame = '#2a211c', glass = '#1b2226';
        const windowAt = (w, wd, ht, sill) => { const yaw = Math.atan2(w.nx, w.nz), y = w.f + sill, x = w.x + w.nx * 0.07, z = w.z + w.nz * 0.07;
            b.box(x, y, z, wd, ht, 0.06, glass, 'darkglass', yaw); b.box(x, y - 0.1, z + 0, wd + 0.2, 0.1, 0.16, '#6f665e', 'concrete', yaw);
            for (let k = 0; k <= 4; k++) b.box(x + w.ux * (k / 4 - 0.5) * wd + w.nx * 0.03, y, z + w.uz * (k / 4 - 0.5) * wd + w.nz * 0.03, 0.045, ht, 0.05, frame, 'paint', yaw);
            for (let k = 0; k <= 3; k++) b.box(x + w.nx * 0.03, y + ht * k / 3 - 0.02, z + w.nz * 0.03, wd, 0.045, 0.05, frame, 'paint', yaw); };
        const doorAt = (w, lit) => { const yaw = Math.atan2(w.nx, w.nz), x = w.x + w.nx * 0.06, z = w.z + w.nz * 0.06;
            b.box(x, w.f, z, 1.25, 2.2, 0.08, lit ? '#e2b56b' : '#17120f', lit ? 'glow' : 'paint', yaw); b.cyl(x, w.f + 2.2, z, 0.625, 0.08, lit ? '#e2b56b' : '#17120f', lit ? 'glow' : 'paint', 16, 1, Math.PI / 2, yaw, 0); };
        let east = 0, west = 0;
        for (const w of windows) {
            const eastSide = w.ka.startsWith('east');
            if (eastSide && w.cov && (east++ % 4) === 1) windowAt(w, 2.5, 1.5, 2.55);
            if (eastSide && !w.cov && (east++ % 5) === 2) windowAt(w, 1.2, 1.7, 2.9);
            if (!eastSide && w.cov && (west++ % 6) === 3) windowAt(w, 1.9, 1.3, 2.75);
            if (!eastSide && !w.cov && w.kind === 'alley') { const k = west++ % 6; if (k === 1) doorAt(w, w.s < 4); else if (k === 4) windowAt(w, 1.1, 1.6, 3.0); }
            if (eastSide && w.kind === 'alleyGum' && Math.abs(w.s - 13.2) < 0.7) doorAt(w, true);                 // the theatre's red doors, just past the building
        }
        // pipes under the soffit along the west wall, lamps on the centreline, yellow bollards along the east wall
        const C = [[-48.3, 50.4], [-36.9, 68.6]], cl = (t) => [lerp(C[0][0], C[1][0], t), lerp(C[0][1], C[1][1], t)];
        for (const [o, r] of [[-2.35, 0.075], [-2.12, 0.05], [-1.93, 0.035]]) b.rod([C[0][0] + 0.846 * o, CEIL - 0.3, C[0][1] - 0.534 * o], [C[1][0] + 0.846 * o, CEIL - 0.3, C[1][1] - 0.534 * o], r, '#8c8f90', 'metal', 8);
        for (const t of [0.1, 0.37, 0.63, 0.9]) { const [x, z] = cl(t); b.rod([x, CEIL, z], [x, CEIL - 0.28, z], 0.015, '#222', 'metal', 4); b.sphere(x, CEIL - 0.36, z, 0.14, 0.1, 0.14, '#ffe6b0', 'glow'); ctx.lampPoints.push({ x, z, y: floorY(x, z), h: CEIL - 0.4 - floorY(x, z), noPost: true }); }
        for (const [x, z] of [[-50.6, 46.2], [-47, 46.6]]) { b.sphere(x, CEIL - 0.3, z, 0.14, 0.1, 0.14, '#ffe6b0', 'glow'); ctx.lampPoints.push({ x, z, y: floorY(x, z), h: 3.2, noPost: true }); }
        for (let i = 0; i < 6; i++) { const t = 0.12 + i * 0.15, [cx, cz] = cl(t), x = cx + 0.846 * 2.25, z = cz - 0.534 * 2.25, y = floorY(x, z); b.cyl(x, y, z, 0.07, 0.95, '#e8c21c', 'paint', 10); ctx.circle(x, z, 0.1, 0.95, { y }); }
    }

    // ---- signs: theatre marquee on the deck edge, Ghost Alley Espresso in the corner, the theatre door neon, the alley's name
    {
        const mq = signBoard('MARKET THEATER · LIVE IMPROV COMEDY', 4.6, 1.15, { bg: '#f4f1e6', fg: '#1b1b1d', maxLines: 2, glow: 0.3, night: 1.8, font: (s) => `800 ${s}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif` });
        mq.position.set((P.rDeck[0] + P.econ[0]) / 2 - 1.2 - DIR[0] * 0.2, plazaY - 0.1, (P.rDeck[1] + P.econ[1]) / 2 - 0.7 - DIR[1] * 0.2); mq.rotation.y = Math.atan2(-DIR[0], -DIR[1]); grp.add(mq);
        const es = signBoard('GHOST ALLEY ESPRESSO', 3.4, 0.5, { bg: '#1a1714', fg: '#f1e7cf', glow: 0.2, night: 1.6 }), ex = (P.nookN[0] + P.nookS[0]) / 2 + 0.12, ez = (P.nookN[1] + P.nookS[1]) / 2, ey = floorY(ex + 0.5, ez);
        es.position.set(ex, ey + 2.75, ez); es.rotation.y = Math.PI / 2; grp.add(es);
        b.box(ex, ey + 0.95, ez + 0.9, 0.05, 1.35, 1.7, '#f0c98a', 'glow', 0); b.box(ex, ey, ez - 1.4, 0.06, 2.1, 0.95, '#3a2a1e', 'wood', 0); b.box(ex + 0.25, ey, ez + 0.9, 0.5, 0.95, 1.9, '#2a221c', 'wood', 0); // lit serving window, door, counter
        const th = neonSign([{ text: 'MARKET THEATER' }], 3.4, 0.5, { color: '#d81f26', glow: '#ff2a2a', day: 0.35, night: 3 }); const d0 = windows.find((w) => w.kind === 'alleyGum' && Math.abs(w.s - 13.2) < 0.7);
        if (d0) { th.position.set(d0.x + d0.nx * 0.12, d0.f + 3.05, d0.z + d0.nz * 0.12); th.rotation.y = Math.atan2(d0.nx, d0.nz); grp.add(th); }
        const [sx, sz] = [-44.6, 46.6], sy = floorY(sx, sz); b.cyl(sx, sy, sz, 0.04, 3.1, '#5c6066', 'metal', 8); ctx.circle(sx, sz, 0.08, 3, { y: sy });
        const pa = signBoard('Post Alley', 0.95, 0.24, { bg: '#1f6b3a', fg: '#ffffff', depth: 0.02, font: (s) => `700 ${s}px Helvetica, Arial, sans-serif` }); pa.position.set(sx, sy + 2.95, sz); pa.rotation.y = Math.atan2(-DIR[0], -DIR[1]); grp.add(pa);
        const ow = signBoard('ONE WAY', 0.75, 0.26, { bg: '#111111', fg: '#ffffff', depth: 0.02, font: (s) => `800 ${s}px Helvetica, Arial, sans-serif` }); ow.position.set(sx, sy + 2.35, sz); ow.rotation.y = Math.atan2(-DIR[0], -DIR[1]); grp.add(ow);
    }
    grp.add(b.build('lower-level', { matOverrides: { 'f-brick': facadeMaterial('brick') } }));
    ctx.add(grp);

    // ---- stick your own gum: blobs where you aim
    const blobs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 300);
    blobs.count = 0; blobs.frustumCulled = false; blobs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3); ctx.add(blobs);
    const ray = new THREE.Raycaster(), cols = ['#ff4f9a', '#4fc3f7', '#aed581', '#fff176', '#ffffff', '#ba68c8'], m4 = new THREE.Matrix4(), col = new THREE.Color();
    let stuck = 0;
    ctx.interactables.push({
        kind: 'gum', aim: true, x: GUM.x, z: GUM.z, r: 13, label: 'Stick your gum on the wall',
        use: (s) => {
            ray.setFromCamera(new THREE.Vector2(0, 0), s.camera); ray.far = 3.5;
            const hit = ray.intersectObjects(gumWalls, false)[0];
            if (!hit) { s.ui.toast('🫧 Get closer', 'Walk up to the wall and aim at it.'); return; }
            const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            m4.compose(hit.point.clone().addScaledVector(n, 0.006), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1 + Math.random() * 0.6, 0.8 + Math.random() * 0.5, 0.45));
            blobs.setMatrixAt(blobs.count, m4); blobs.setColorAt(blobs.count, col.set(cols[stuck % cols.length])); blobs.count = Math.min(299, blobs.count + 1);
            blobs.instanceMatrix.needsUpdate = true; blobs.instanceColor.needsUpdate = true; stuck++;
            s.sound.play('splat'); s.progress.gum = (s.progress.gum || 0) + 1; seaActivity(s, 'lm-gum-wall', 'pike-place');
            if (stuck === 1) s.ui.toast('🫧 Stuck!', 'Your gum joins about 180 pieces per brick.');
            if (stuck === 5) s.ui.toast('💗 Five pieces', 'Now you are part of the Gum Wall.');
            const near = s.spot.crowd?.peds.find((p) => Math.hypot(p.x - hit.point.x, p.z - hit.point.z) < 6); if (near) s.spot.crowd._say(near, 'spot', { force: false });
        },
    });
    return { floorY, plazaY, CEIL, gumWalls, alleyLine: [[-48.6, 49.6], [-36.6, 68.6]], rampLine: [along(6, -4.6), along(30, -4.6), [-48.4, 46.6]] };
}
