// ============================================================================
//  Meydenbauer Bay Park, Bellevue (reopened March 2019) — rebuilt round 5
//  (owner note 69) from the OSM survey + reference photos (Commons: aerial
//  April 2023, Mark Yasuda Dec 2019): the 420-ft floating crescent pier
//  (concrete deck, galvanised mesh railings, pipe piles, benches, the sundial
//  at the round tip), the grey-sand swimming beach with the buoy line and
//  summer swim float, the wide concrete promenade lined with granite boulders
//  and tall LED poles, terraced lawns behind boulder rockeries, the playground,
//  the pavilion set into the bank under its roof terrace, the historic whaling
//  building and the boathouse (dark brown boards, white trim), the Meydenbauer
//  Bay marina (docks, covered moorage, moored sail/motor boats), Lake
//  Washington on the shared water material, the houses and condos on the hill,
//  the Lake Washington Blvd bridge over the ravine, fir-covered far shores and
//  Seattle on the horizon (≈ 9 km west).
//  Round 2 of the 2026-11-12 fidelity pass compared the scene with Street View
//  from 99th Ave NE, the marina lot and Lake Washington Blvd (see
//  game/research/seattle-spots.md, "Meydenbauer Bay Park", for what was established).
//  Activities (note 57): walk to the end of the crescent; rent a kayak at the
//  boathouse (summer) for a paddle round the bay; skip stones from the beach.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { polyArea, GeoBatch, M, rng, headingFromBearing, lerp, smooth, clamp, inPoly, polyBox, alongPolyline, polylineLength, distPolyline, canvas, canvasTexture } from '../kit.js';
import { seattleBackdrop } from '../backdrop.js';
import { bench, buildLamps } from '../osm.js';
import { boatRide } from '../buc.js';
import { dryLanding, shortWaterRoute, waterLoop } from '../water-route.js';
import { stoneSkipping } from '../stone-skipping.js';
import { loadShoreHouses, shoreHouses } from './bel-shore-houses.js';
import { emitActivity, localMD, inWindow, seasonal, shoreField, waterGrid, boulderWall, nightLit, glowText, gableRoof, tri, fairyLights } from './bel-common.js';

const LAKE_Y = -0.55; // Lake Washington ≈ 5.1–5.7 m NAVD88 (regulated); scene datum 5.7 m
const DECK = LAKE_Y + 0.62; // floating pier deck above the water

// ---------------------------------------------------------------------------- boats
const HULLS = new Map();
/** lofted hull (stern at -L/2, bow at +L/2 along +z), deck sheer rising to the bow; y = waterline */
function hullGeo(L, W, fb = 0.75, draft = 0.45) {
    const k = [L, W, fb, draft].join(':'); if (HULLS.has(k)) return HULLS.get(k);
    const N = 12, st = [];
    for (let i = 0; i <= N; i++) {
        const s = i / N, z = -L / 2 + s * L;
        const w = (W / 2) * (s < 0.62 ? 1 - 0.12 * (1 - s / 0.62) ** 2 : Math.sqrt(Math.max(0, (1 - s) / 0.38))) + (i === N ? 0 : 0);
        const top = fb + 0.25 * s * s, bot = -draft * (1 - 0.6 * s * s);
        st.push([[-w, top, z], [-w * 0.92, 0.05, z], [-w * 0.45, bot * 0.75, z], [0, bot, z], [w * 0.45, bot * 0.75, z], [w * 0.92, 0.05, z], [w, top, z]]);
    }
    const pos = [], push = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let i = 0; i < N; i++) for (let j = 0; j < 6; j++) { const a = st[i][j], b = st[i][j + 1], c = st[i + 1][j + 1], d = st[i + 1][j]; push(a, c, b); push(a, d, c); }
    for (let j = 1; j < 6; j++) push(st[0][0], st[0][j], st[0][j + 1]); // transom
    for (let i = 0; i < N; i++) { const a = st[i][0], b = st[i][6], c = st[i + 1][6], d = st[i + 1][0]; push(a, b, c); if (i + 1 < N) push(a, c, d); } // deck (bow: one triangle)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    HULLS.set(k, g); return g;
}
function boat(b, x, y, z, yaw, kind, r) {
    const C = (lx, ly, lz) => [x + Math.sin(yaw) * lz + Math.cos(yaw) * lx, y + ly, z + Math.cos(yaw) * lz - Math.sin(yaw) * lx];
    if (kind === 'sail') {
        const L = 8 + r() * 3.5, W = L * 0.32, col = ['#f4f4f0', '#eef0f2', '#1f3550', '#f1ece0'][Math.floor(r() * 4)];
        const boot = (px, py) => (py < y + 0.24 ? '#2b2f33' : col); // boot stripe as vertex colour (no overlapping shell)
        b.add(hullGeo(L, W, 0.8, 0.5), 'paint', M(x, y, z, 0, yaw), boot);
        const [cx, cy, cz] = C(0, 0.6, -L * 0.08); b.box(cx, cy, cz, W * 0.62, 0.75, L * 0.32, '#e9e7e1', 'paint', yaw);
        const [wx, wy, wz] = C(0, 1.1, -L * 0.02); b.box(wx, wy, wz, W * 0.72, 0.18, L * 0.2, '#2d3438', 'darkglass', yaw);
        const mh = L * 1.35, [mx, my, mz] = C(0, 0.9, L * 0.12); b.cyl(mx, my, mz, 0.06, mh, '#c9ccce', 'chrome', 6);
        const [bx0, by0, bz0] = C(0, 2.0, L * 0.12), [bx1, by1, bz1] = C(0, 2.0, -L * 0.36); b.rod([bx0, by0, bz0], [bx1, by1, bz1], 0.05, '#c9ccce', 'chrome', 5);
        b.rod([bx0, by0 + 0.12, bz0], [bx1, by1 + 0.12, bz1], 0.16, ['#1d4f8a', '#2b6f8f', '#1f3b5e'][Math.floor(r() * 3)], 'fabric', 6); // sail cover
        const [fx, fy, fz] = C(0, 0.85, L * 0.5); b.rod([mx, my + mh, mz], [fx, fy, fz], 0.012, '#9aa0a4', 'steel', 3); // forestay
        const [sx, sy, sz] = C(0, 0.9, -L * 0.5); b.rod([mx, my + mh, mz], [sx, sy, sz], 0.012, '#9aa0a4', 'steel', 3);
        return { light: [mx, my + mh + 0.1, mz], body:{x,z,angle:yaw,hw:W/2,hd:L/2} };
    }
    const L = 7 + r() * 5, W = L * 0.36;
    const hc = r() < 0.8 ? '#f5f5f2' : '#e9e3d6', sc = ['#1f3b5e', '#7a1f22', '#2b2f33'][Math.floor(r() * 3)];
    b.add(hullGeo(L, W, 0.95, 0.5), 'paint', M(x, y, z, 0, yaw), (px, py) => (py < y + 0.28 ? sc : hc));
    const [cx, cy, cz] = C(0, 0.75, -L * 0.05); b.box(cx, cy, cz, W * 0.7, 1.3, L * 0.38, '#f2f2ef', 'paint', yaw);
    const [gx, gy, gz] = C(0, 1.4, -L * 0.05); b.box(gx, gy, gz, W * 0.8, 0.45, L * 0.24, '#22292e', 'darkglass', yaw);
    if (L > 9.5) { const [fx, fy, fz] = C(0, 2.05, -L * 0.1); b.box(fx, fy, fz, W * 0.6, 0.12, L * 0.24, '#ece9e2', 'paint', yaw); b.rod(C(-W * 0.28, 2.17, -L * 0.2), C(-W * 0.28, 2.9, -L * 0.15), 0.025, '#c9ccce', 'chrome', 4); }
    const [ax, ay, az] = C(0, 2.3, -L * 0.15); b.rod([ax, ay - 0.25, az], [ax, ay + 0.5, az], 0.03, '#c9ccce', 'chrome', 4);
    return { light: [ax, ay + 0.55, az], body:{x,z,angle:yaw,hw:W/2,hd:L/2} };
}
/** wire-mesh railing infill texture (galvanised diamond mesh, alpha) */
let MESH_MAT = null;
function meshMaterial() {
    if (MESH_MAT) return MESH_MAT;
    const c = canvas(64, 64), x = c.getContext('2d'); x.clearRect(0, 0, 64, 64); x.strokeStyle = '#ffffff'; x.lineWidth = 3;
    for (let i = -64; i <= 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
    const t = canvasTexture(c, { repeat: true });
    MESH_MAT = new THREE.MeshStandardMaterial({ map: t, color: '#c3c8cb', alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.45 });
    MESH_MAT.name = 'bel-wiremesh'; MESH_MAT.userData.shared = true;
    return MESH_MAT;
}
/** strip of quads (u = metres) between two parallel 3-D polylines (same length) */
function stripGeo(lo, hi, uScale = 1) {
    const pos = [], uv = [], idx = []; let u = 0;
    for (let i = 0; i < lo.length; i++) {
        if (i) u += Math.hypot(lo[i][0] - lo[i - 1][0], lo[i][2] - lo[i - 1][2]);
        pos.push(...lo[i], ...hi[i]); uv.push(u * uScale, 0, u * uScale, (hi[i][1] - lo[i][1]) * uScale);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export default {
    env: { fogFar: 9000, ambientCity: 0, groundAlbedo: 0.1 }, // no synthetic city walls in the probe: they reflect as pale slabs on the open lake
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-meydenbauer'), r = rng(69);
        const shoreList = await loadShoreHouses(); // live OSM houses at the far shores (bel-shore-houses.js)
        const area = (id) => d.areas.find((a) => a.id === id)?.poly, way = (id) => d.ways.find((w) => w.id === id)?.pts, bld = (id) => d.buildings.find((x) => x.id === id)?.poly;
        // ---------------------------------------------------------------- lake + shoreline (OSM Lake Washington outline, not the 20 m DEM)
        const lakePoly = area('r2793848');
        const T0 = d.terrain, DT = { x0: T0.x0, z0: T0.z0, x1: T0.x0 + (T0.nx - 1) * T0.d, z1: T0.z0 + (T0.nz - 1) * T0.d };
        const SB = { x0: -780, z0: -760, x1: 720, z1: 700 }; // the whole terrain (inner + outer apron): no clamped DEM hills poking out of the lake
        const F = shoreField(lakePoly, SB, 4), sdf = F.sample;
        const beachPoly = area('w688203354') || [];
        const bb = polyBox(beachPoly);
        const inBeach = (x, z) => x > bb.x0 - 6 && x < bb.x1 + 6 && z > bb.z0 - 6 && z < bb.z1 + 6 && inPoly(x, z, beachPoly);
        g.mod((x, z, h) => {
            const s = sdf(x, z);
            if (s > 0) return Math.min(h, LAKE_Y - Math.min(7, 0.28 + s * (inBeach(x, z) ? 0.07 : 0.16) + Math.max(0, s - 25) * 0.1)); // deep enough that far lakebed never depth-fights the water
            const land = -s;
            if (land > 1 && (x < DT.x0 || x > DT.x1 || z < DT.z0 || z > DT.z1)) return Math.max(h, LAKE_Y + 0.35 + Math.min(32, land * 0.32)); // beyond the DEM grid (clamped flat): wooded shore rising from the water
            if (land < 30) {
                const shoreY = LAKE_Y + 0.14 + land * (inBeach(x, z) ? 0.05 : 0.11);
                const k = smooth(30, 8, land);
                return Math.max(lerp(h, shoreY, k * (h < shoreY ? 1 : 0.35)), LAKE_Y + 0.12 + land * 0.02);
            }
            return h;
        });
        g.waterY = LAKE_Y; ctx.waterLevel = LAKE_Y;
        waterGrid(ctx, sdf, LAKE_Y, { x0: -420, z0: -150, x1: 420, z1: 470 }, { cell: 4, keep: 12, deep: '#1c3440', shallow: '#3e5a55', ripple: 0.9, wave: 0.8, far: [[-9000, -6000, -420, 6000], [-420, 470, 420, 1400]], name: 'lake-washington' });
        // ---------------------------------------------------------------- ground paint: rocky shore band, beach, wide promenade
        const P = ctx.painter;
        P.custom((x, T, k, isMask) => { x.strokeStyle = isMask ? 'rgb(0,0,120)' : '#7a7466'; x.lineWidth = 5.5 * k; x.lineJoin = 'round'; x.beginPath(); lakePoly.forEach(([px, pz], i) => { const [a, c] = T(px, pz); if (i) x.lineTo(a, c); else x.moveTo(a, c); }); x.closePath(); x.stroke(); });
        if (beachPoly.length) { P.poly(beachPoly, '#988c78', 'dirt'); P.custom((x, T, k, isMask) => { if (isMask) return; x.strokeStyle = 'rgba(92,84,70,0.55)'; x.lineWidth = 3 * k; x.beginPath(); lakePoly.forEach(([px, pz], i) => { const [a, c] = T(px, pz); if (i) x.lineTo(a, c); else x.moveTo(a, c); }); x.stroke(); }); }
        const prom = [way('w841411877'), way('w840902369'), way('w840902368'), way('w840902371'), way('w841411883'), way('w840902373')].filter(Boolean);
        for (const pts of prom) P.line(pts, 4.6, '#c4c0b6', 'slab');
        // ---------------------------------------------------------------- crescent pier (OSM w688415225 centreline, w687934817 deck outline)
        for (const id of ['w688415225', 'w687934817']) ctx.skipWays.add(id);
        const arc = [...(way('w688415225') || [[-59, 44], [-25, 62], [7, 61], [30, 47], [48, 16]])].reverse(); // root (east, on the beach) → tip (west)
        const arcL = polylineLength(arc), Q = (s) => alongPolyline(arc, clamp(s, 0, arcL));
        const root = Q(0), rootY = Math.max(DECK + 0.05, g.heightAt(root.x, root.z) + 0.02);
        const deckY = (s) => lerp(rootY, DECK, smooth(0, 16, s));
        const b = new GeoBatch(), W = 4.4, step = 1.5, ns = Math.ceil(arcL / step), deckQuads = [];
        const L = [], R = [], Lh = [], Rh = [];
        for (let i = 0; i <= ns; i++) {
            const s = Math.min(arcL, i * step), a = Q(s), a2 = Q(Math.min(arcL, s + 0.5)), a1 = Q(Math.max(0, s - 0.5));
            const tx = a2.x - a1.x, tz = a2.z - a1.z, tl = Math.hypot(tx, tz) || 1, nx = tz / tl, nz = -tx / tl, y = deckY(s);
            L.push([a.x + nx * W / 2, y, a.z + nz * W / 2]); R.push([a.x - nx * W / 2, y, a.z - nz * W / 2]);
            Lh.push([a.x + nx * (W / 2 - 0.05), y + 1.07, a.z + nz * (W / 2 - 0.05)]); Rh.push([a.x - nx * (W / 2 - 0.05), y + 1.07, a.z - nz * (W / 2 - 0.05)]);
        }
        for (let i = 0; i < ns; i++) {
            // walkable deck under every panel, the last ones included (they were skipped with the visuals below, and the box
            // was turned by -yaw: on the curve that left slivers of open water in the deck where the walker was refused)
            { const a0 = L[i], a1 = L[i + 1], c1 = R[i + 1]; g.addBox((a0[0] + c1[0]) / 2, (a0[2] + c1[2]) / 2, W / 2, step / 2 + 0.3, Math.atan2(a1[0] - a0[0], a1[2] - a0[2]), a0[1] - 2, (a0[1] + a1[1]) / 2); }
            if (i * step > arcL - 1.8) continue; // the round tip disc covers the last metres
            const tint = i % 2 ? '#b8b6af' : '#c1bfb8', l0 = L[i], l1 = L[i + 1], r0 = R[i], r1 = R[i + 1];
            b.quad(r0, r1, l1, l0, tint, 'concrete');                                                                       // deck panel
            deckQuads.push([r0, r1, l1, l0]);
            const dn = (p) => [p[0], p[1] - 0.42, p[2]];
            b.quad(dn(l0), l0, l1, dn(l1), '#8e8c86', 'concrete'); b.quad(dn(r1), r1, r0, dn(r0), '#8e8c86', 'concrete');  // fascia
            const fl = (p, q, t) => [lerp(p[0], q[0], t), p[1] - 0.42, lerp(p[2], q[2], t)], wl = (p) => [p[0], LAKE_Y - 0.25, p[2]];
            if (deckY(i * step) < DECK + 0.3) { const a = fl(l0, r0, 0.1), c = fl(l1, r1, 0.1), e = fl(l0, r0, 0.9), f = fl(l1, r1, 0.9); b.quad(wl(a), a, c, wl(c), '#2a2c2d', 'rubber'); b.quad(wl(f), f, e, wl(e), '#2a2c2d', 'rubber'); } // black floats at the waterline
            const mx = (l0[0] + r1[0]) / 2, mz = (l0[2] + r1[2]) / 2, yaw = Math.atan2(l1[0] - l0[0], l1[2] - l0[2]);
            for (const [p, q] of [[L, Lh], [R, Rh]]) ctx.collider({ wall: true, ax: p[i][0], az: p[i][2], bx: p[i + 1][0], bz: p[i + 1][2], y0a: p[i][1] - 3, y1a: q[i][1] + 0.05, y0b: p[i + 1][1] - 3, y1b: q[i + 1][1] + 0.05, nx: 0, nz: 1, y: p[i][1], intended: true }); // pier railing (rendered mesh infill; deck height for the audit)
            if (i % 2 === 0) for (const [p, q] of [[L, Lh], [R, Rh]]) b.rod([p[i][0], p[i][1], p[i][2]], [q[i][0], q[i][1], q[i][2]], 0.035, '#aeb4b8', 'steel', 6);   // posts every 3 m
            // benches along the railing, facing out over the water, alternating sides (after round 6: they stood crosswise
            // in the middle of the walkway)
            if (i % 10 === 6 && i < ns - 3) { const E = (i / 10 | 0) % 2 ? L : R, ex = E[i][0] - mx, ez = E[i][2] - mz, el = Math.hypot(ex, ez) || 1, off = W / 2 - 0.75;
                const bx2 = mx + ex / el * off, bz2 = mz + ez / el * off; bench(b, bx2, l0[1], bz2, Math.atan2(ex, ez) + Math.PI / 2, '#6b5038', '#2b2f33'); ctx.box(bx2, bz2, 0.9, 0.3, Math.atan2(ex, ez) + Math.PI / 2, { prop: true, h: 0.45, y: l0[1] }); }
            if (i % 9 === 4 && deckY(i * step) < DECK + 0.2) { const o = L[i], dx = o[0] - R[i][0], dz = o[2] - R[i][2], dl = Math.hypot(dx, dz) || 1; const px = o[0] + dx / dl * 0.55, pz = o[2] + dz / dl * 0.55; b.cyl(px, LAKE_Y - 2, pz, 0.32, 2 + DECK - LAKE_Y + 1.4, '#9a9c9a', 'steel', 12); b.cyl(px, DECK - 0.2, pz, 0.42, 0.5, '#2b2d2e', 'rubber', 12); } // pipe piles (outer side)
        }
        // top rails + mesh infill + LED strip under the rails (lit at night)
        b.tube(Lh, 0.04, '#b9bfc3', 'steel', 6); b.tube(Rh, 0.04, '#b9bfc3', 'steel', 6);
        const lo = (H) => H.map((p) => [p[0], p[1] - 0.95, p[2]]), meshM = meshMaterial();
        for (const H of [Lh, Rh]) { const m = new THREE.Mesh(stripGeo(lo(H), H.map((p) => [p[0], p[1] - 0.06, p[2]]), 1.6), meshM); m.name = 'pier-mesh-rail'; ctx.add(m); }
        const ledM = nightLit('#ffe6bf', 2.2, { base: '#9ea4a8', name: 'pier-led' });
        for (const H of [Lh, Rh]) { const pts = H.map((p) => new THREE.Vector3(p[0], p[1] - 0.06, p[2])); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.022, 4), ledM); m.name = 'pier-led'; ctx.add(m); }
        // round tip platform (Ø ≈ 9 m) with the clock post, bench ring and railing
        const tip = Q(arcL), tdx = tip.x - Q(arcL - 3).x, tdz = tip.z - Q(arcL - 3).z, tdl = Math.hypot(tdx, tdz) || 1, TC = { x: tip.x + tdx / tdl * 2.6, z: tip.z + tdz / tdl * 2.6 }, TR = 4.6;
        b.cyl(TC.x, DECK - 0.432, TC.z, TR, 0.42, '#bdbbb4', 'concrete', 40); // top 12 mm under the deck panels (no coplanar fight where they meet)
        b.cyl(TC.x, LAKE_Y - 0.25, TC.z, TR - 0.4, DECK - 0.44 - LAKE_Y + 0.25, '#2a2c2d', 'rubber', 28); // float under the tip (this call sat inside the comment above and was never run)
        g.addPoly(Array.from({ length: 24 }, (_, i) => [TC.x + Math.cos(i / 24 * Math.PI * 2) * TR, TC.z + Math.sin(i / 24 * Math.PI * 2) * TR]), DECK, DECK - 2);
        const ang0 = Math.atan2(-tdz, -tdx), ring = [];
        for (let i = 0; i <= 40; i++) { const a = ang0 + 0.55 + (i / 40) * (Math.PI * 2 - 1.1); ring.push([TC.x + Math.cos(a) * (TR - 0.05), DECK + 1.07, TC.z + Math.sin(a) * (TR - 0.05)]); }
        b.tube(ring, 0.04, '#b9bfc3', 'steel', 6);
        { const m = new THREE.Mesh(stripGeo(lo(ring), ring.map((p) => [p[0], p[1] - 0.06, p[2]]), 1.6), meshM); ctx.add(m); }
        for (let i = 0; i < ring.length - 1; i++) { if (i % 4 === 0) b.rod([ring[i][0], DECK, ring[i][2]], ring[i], 0.035, '#aeb4b8', 'steel', 6); const a = ring[i], c = ring[i + 1]; ctx.collider({ wall: true, ax: a[0], az: a[2], bx: c[0], bz: c[2], y0a: DECK - 3, y1a: DECK + 1.1, y0b: DECK - 3, y1b: DECK + 1.1, nx: 0, nz: 1, y: DECK, intended: true }); }
        for (const a of [ang0 + 1.6, ang0 + Math.PI, ang0 + 4.7]) bench(b, TC.x + Math.cos(a) * (TR - 1.3), DECK, TC.z + Math.sin(a) * (TR - 1.3), -a + Math.PI / 2, '#6b5038', '#2b2f33');
        // OSM n6455415841 at the tip: amenity=clock, display=sundial (+ tourism=viewpoint) — a sundial, not a clock tower.
        // (A four-faced clock post with a vane stood here: neither is mapped.) Low plinth, bronze dial, gnomon: form estimated.
        b.cyl(TC.x, DECK, TC.z, 0.8, 0.5, '#b5b3ac', 'concrete', 24); b.cyl(TC.x, DECK + 0.5, TC.z, 0.72, 0.03, '#8a6a3c', 'metal', 24); ctx.circle(TC.x, TC.z, 0.85, 0.9, { y: DECK });
        tri(b, [TC.x, DECK + 0.53, TC.z + 0.55], [TC.x, DECK + 0.53, TC.z - 0.5], [TC.x, DECK + 1.02, TC.z - 0.5], '#6f5530', 'metal'); tri(b, [TC.x, DECK + 0.53, TC.z - 0.5], [TC.x, DECK + 0.53, TC.z + 0.55], [TC.x, DECK + 1.02, TC.z - 0.5], '#6f5530', 'metal'); // gnomon rising to the north
        ctx.add(b.build('crescent-pier'));

        // ---------------------------------------------------------------- pavilion (restrooms / viewing terrace), whaling building, REI boathouse
        const pb = new GeoBatch(), pv = bld('w688203355'); let TERRACE_Y = 4.45;
        for (const id of ['w688203355', 'w819159071', 'w698374975', 'w819159076']) ctx.skipBuildings.add(id);
        if (pv) {
            // The pavilion is set into the bank: its roof is a public terrace level with the upper walk (OSM footway
            // w841411879 layer=1 crosses it; picnic tables n7850600507-510 layer=1 stand on it; Street View from 99th Ave NE,
            // 2026-11-12: a light concrete deck with galvanised mesh railings and picnic tables, no dark overhanging roof).
            // USGS 1 m DEM: beach side 1.0-1.8 m, uphill side 4.2-4.6 m (scene datum) -> deck at 4.45.
            const py = Math.min(...pv.map(([x, z]) => g.heightAt(x, z))), TOPV = Math.max(py + 3.0, 4.45); TERRACE_Y = TOPV; g.flatten(pv, py, 3);
            const pvE = [...pv, pv[0]], pvD = (x, z) => distPolyline(x, z, pvE).d;
            // the bank behind it meets the terrace; under the uphill half of the footprint the ground stays just below the
            // slab (the terrain mesh has 2 m cells: a floor at beach level there dragged the bank down along the wall)
            g.mod((x, z, h) => { if (x < 38 || x > 62 || z < -26 || z > 16 || h >= TOPV) return h; const kx = smooth(42, 46, x) * smooth(12, 6.5, z); /* not round the south end: the pier root there is at beach level (USGS 1.75 m) */ if (inPoly(x, z, pv)) return lerp(h, Math.max(h, TOPV - 0.35), kx); const k = smooth(7, 1.2, pvD(x, z)) * kx; return k > 0 ? lerp(h, TOPV, k) : h; });
            pb.prism(pv, py - 0.5, TOPV - 0.15, '#8b8479', 'stone');                                         // stacked-stone walls
            const pc = polyBox(pv), pcx = (pc.x0 + pc.x1) / 2, pcz = (pc.z0 + pc.z1) / 2, big = pv.map(([x, z]) => [pcx + (x - pcx) * 1.03, pcz + (z - pcz) * 1.02]);
            pb.prism(big, TOPV - 0.3, TOPV, '#c6c3ba', 'concrete', { bottom: true });                          // terrace slab
            g.addPoly(big, TOPV, TOPV - 0.4);
            const E1 = [49.1, 3.9], E2 = [46.3, -13], open = (x, z) => Math.hypot(x - E1[0], z - E1[1]) < 2.2 || Math.hypot(x - E2[0], z - E2[1]) < 2.6 || (x > 47.2 && pvD(x, z) < 0.9 && g.heightAt(x + (x - pcx) * 0.06, z + (z - pcz) * 0.06) > TOPV - 0.5); // entries + the uphill edge (flush with the bank)
            { const runs = []; let run = null; // mesh railing round the open (lake) sides of the terrace
                for (let i = 0; i < big.length; i++) { const [ax, az] = big[i], [qx, qz] = big[(i + 1) % big.length], Le = Math.hypot(qx - ax, qz - az), n = Math.max(1, Math.ceil(Le / 1.1));
                    for (let j = 0; j <= n; j++) { const x = ax + (qx - ax) * j / n, z = az + (qz - az) * j / n; if (open(x, z)) { run = null; continue; } if (!run) runs.push(run = []); const L0 = run[run.length - 1]; if (!L0 || Math.hypot(L0[0] - x, L0[2] - z) > 0.05) run.push([x, TOPV + 1.07, z]); } }
                if (runs.length > 1 && !open(...big[0])) { const last = runs.pop(); runs[0] = [...last, ...runs[0]]; }
                for (const H0 of runs) { const H = H0.filter((p, i) => !i || Math.hypot(p[0] - H0[i - 1][0], p[2] - H0[i - 1][2]) > 0.2); if (H.length < 2) continue; pb.tube(H, 0.04, '#b9bfc3', 'steel', 6);
                    const m = new THREE.Mesh(stripGeo(H.map((p) => [p[0], p[1] - 0.95, p[2]]), H.map((p) => [p[0], p[1] - 0.06, p[2]]), 1.6), meshMaterial()); m.name = 'terrace-mesh-rail'; ctx.add(m);
                    for (let i = 0; i < H.length; i++) { if (i % 2 === 0 || i === H.length - 1) pb.rod([H[i][0], TOPV, H[i][2]], H[i], 0.035, '#aeb4b8', 'steel', 6); if (i) ctx.collider({ wall: true, ax: H[i - 1][0], az: H[i - 1][2], bx: H[i][0], bz: H[i][2], y0a: TOPV - 0.2, y1a: TOPV + 1.1, y0b: TOPV - 0.2, y1b: TOPV + 1.1, nx: 0, nz: 1, y: TOPV, intended: true }); } } }
            for (const [x, z] of [[43.0, 2.1], [42.1, 4.2], [39.4, -9.6], [44.0, -7.7]]) { const a = 0.35; // picnic tables on the terrace (OSM nodes, layer 1)
                pb.box(x, TOPV + 0.72, z, 1.8, 0.06, 0.8, '#7a5a3c', 'wood', a); for (const s of [-0.62, 0.62]) pb.box(x + Math.sin(a) * s, TOPV + 0.42, z + Math.cos(a) * s, 1.8, 0.05, 0.28, '#6d5034', 'wood', a); for (const s of [-0.7, 0.7]) pb.box(x + Math.cos(a) * s, TOPV, z - Math.sin(a) * s, 0.08, 0.72, 1.3, '#8e9498', 'steel', a);
                ctx.box(x, z, 0.9, 0.75, a, { prop: true, h: 0.78, y: TOPV }); }
            for (let i = 0; i < pv.length; i++) { const [ax, az] = pv[i], [qx, qz] = pv[(i + 1) % pv.length], Le = Math.hypot(qx - ax, qz - az); if (Le < 3.5) continue; const ya = Math.atan2(qx - ax, qz - az), ox = -Math.cos(ya) * 0.08, oz = Math.sin(ya) * 0.08; // clerestory glazing + cedar slat panels
                for (let t = 1; t < Le - 0.8; t += 2.2) { const px = ax + (qx - ax) * (t + 0.6) / Le, pz = az + (qz - az) * (t + 0.6) / Le; pb.box(px, py + 2.35, pz, 1.5, 0.7, 0.1, '#2b3236', 'darkglass', ya + Math.PI / 2); } }
            for (let i = 0; i < pv.length; i += 3) { const [x, z] = pv[i]; pb.box(x, py, z, 0.18, TOPV - 0.35 - py, 0.18, '#5b3d2a', 'wood'); }
            ctx.poly(pv, { y0: py - 3, y1: TOPV - 0.35 }); // the walls stop the beach level only: the terrace above is walkable
            // (a "MEYDENBAUER BAY PARK" plate hung on this building: no source for one there. The park's name sign stands at
            // the Lake Washington Blvd × 99th Ave NE entrance, see below.)
        }
        const wh = bld('w819159071');
        if (wh) { // historic whaling building on piles over the water (2 storeys, gabled)
            const bx = polyBox(wh), cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2, base = DECK + 0.4;
            const m0 = [(wh[0][0] + wh[1][0]) / 2, (wh[0][1] + wh[1][1]) / 2], m1 = [(wh[3][0] + wh[4][0]) / 2, (wh[3][1] + wh[4][1]) / 2], yaw = Math.atan2(m1[0] - m0[0], m1[1] - m0[1]);
            const Lw0 = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), Ww0 = Math.hypot(wh[1][0] - wh[0][0], wh[1][1] - wh[0][1]);
            pb.prism(wh, LAKE_Y - 0.5, base, '#4b4038', 'wood');
            for (const [x, z] of wh) pb.cyl(x, LAKE_Y - 1, z, 0.2, base - LAKE_Y + 1, '#3d342d', 'wood', 8);
            const inner = wh.map(([x, z]) => [cx + (x - cx) * 0.92, cz + (z - cz) * 0.92]);
            // Street View (99th Ave NE, 2026-11-12): dark brown boarded walls, white-trimmed windows, a steep grey shingle
            // roof whose ridge is about level with the road above (≈ 7 m on the scene datum) — not a white two-storey box.
            // OSM building:levels=2: the upper level is in the roof (gable windows). Eaves 3.3 m, rise 3.4 m: estimates.
            const WALL = '#4a372c', EAV = 3.3, RISE = 3.4;
            pb.prism(inner, base, base + EAV, WALL, 'wood');
            for (let i = 0; i < inner.length; i++) { const [ax, az] = inner[i], [qx, qz] = inner[(i + 1) % inner.length], Lw = Math.hypot(qx - ax, qz - az); if (Lw < 4) continue; const ya = Math.atan2(qx - ax, qz - az); for (let t = 1.6; t < Lw - 1; t += 2.6) { const px = ax + (qx - ax) * t / Lw, pz = az + (qz - az) * t / Lw; pb.box(px, base + 0.95, pz, 1.24, 1.64, 0.22, '#ece8df', 'paint', ya + Math.PI / 2); pb.box(px, base + 1.07, pz, 1.0, 1.4, 0.3, '#2c3236', 'darkglass', ya + Math.PI / 2); } }
            gableRoof(pb, cx, base + EAV, cz, yaw, Lw0 * 0.92, Ww0 * 0.92, RISE, '#6a6259', { gable: WALL });
            { const s = Math.sin(yaw), c = Math.cos(yaw), gl = Lw0 * 0.92 / 2; // two white-trimmed windows in each gable
                for (const e of [-1, 1]) for (const lx of [-0.85, 0.85]) { const x = cx + c * lx + s * e * gl, z = cz - s * lx + c * e * gl; pb.box(x, base + EAV + 0.25, z, 1.0, 1.3, 0.2, '#ece8df', 'paint', yaw); pb.box(x, base + EAV + 0.35, z, 0.78, 1.1, 0.28, '#2c3236', 'darkglass', yaw); } }
            ctx.poly(wh);
        }
        const rei = bld('w698374975');
        if (rei) { // boathouse on the marina dock. Street View (99th Ave NE, 2026-11-12): the same dark brown boards, white trim
            // and brown-grey shingles as the whaling building beside it — not red — and no name board readable from the street
            // (the "BOATHOUSE · KAYAKS · SUP" plate had no source and is gone).
            const bx = polyBox(rei), cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2, base = LAKE_Y + 0.55;
            const e0 = rei[0], e1 = rei[1], yaw = Math.atan2(e1[0] - e0[0], e1[1] - e0[1]), Lb = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), Wb = Math.hypot(rei[2][0] - e1[0], rei[2][1] - e1[1]);
            pb.prism(rei, LAKE_Y - 0.3, base, '#5a4a3c', 'wood');
            const inner = rei.map(([x, z]) => [cx + (x - cx) * 0.94, cz + (z - cz) * 0.94]);
            pb.prism(inner, base, base + 3.3, '#4a372c', 'wood');
            gableRoof(pb, cx, base + 3.3, cz, yaw, Lb * 0.94, Wb * 0.94, 2.6, '#6a6259', { gable: '#4a372c' });
            { const s = Math.sin(yaw), c = Math.cos(yaw), gl = Lb * 0.94 / 2; for (const e of [-1, 1]) { const x = cx + s * e * gl, z = cz + c * e * gl; pb.box(x, base + 3.5, z, 1.5, 1.3, 0.2, '#ece8df', 'paint', yaw); pb.box(x, base + 3.6, z, 1.26, 1.1, 0.28, '#2c3236', 'darkglass', yaw); } }
            ctx.poly(rei);
        }
        // covered moorage (OSM w819159076 building=roof, layer 1): an open shed roof on posts over the slips. It was skipped
        // and left undrawn. Eaves 4.4 m above the lake and the post spacing are estimates.
        // The same goes for the plain `building=yes` footprints standing wholly over the lake inside the Meydenbauer Bay Yacht
        // Club marina (w627898895 / 896 / 897, outside the playable area): they were extruded as four-storey blocks with
        // windows rising out of the water. Street View from 99th Ave NE (2026-11-12) shows long covered-moorage sheds there:
        // a grey roof with a deep brown timber fascia on posts.
        const moor = bld('w819159076');
        const sheds = d.buildings.filter((bd) => !bd.part && bd.poly?.length > 2 && !['w819159071', 'w698374975', 'w688203355'].includes(bd.id) && (bd.id === 'w819159076' || (sdf(bd.poly.reduce((s, p) => s + p[0], 0) / bd.poly.length, bd.poly.reduce((s, p) => s + p[1], 0) / bd.poly.length) > 4 && bd.poly.filter(([x, z]) => sdf(x, z) > 0).length >= bd.poly.length * 0.6)));
        const underShed = (x, z) => sheds.some((s) => inPoly(x, z, s.poly));
        for (const sh of sheds) { ctx.skipBuildings.add(sh.id); const P = sh.poly, ry = LAKE_Y + 4.4, c = polyBox(P), mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
            pb.prism(P.map(([x, z]) => [mx + (x - mx) * 1.015, mz + (z - mz) * 1.015]), ry, ry + 0.28, '#7d8387', 'metal', { bottom: true });
            for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [qx, qz] = P[(i + 1) % P.length], Le = Math.hypot(qx - ax, qz - az), n = Math.max(1, Math.round(Le / 6)); if (Le < 0.4) continue;
                pb.box((ax + qx) / 2, ry - 0.75, (az + qz) / 2, 0.12, 0.75, Le, '#6b4c36', 'wood', Math.atan2(qx - ax, qz - az));   // timber fascia
                for (let j = 0; j < n; j++) pb.cyl(ax + (qx - ax) * j / n, LAKE_Y - 1.5, az + (qz - az) * j / n, 0.14, ry - LAKE_Y + 1.5, '#5a534b', 'wood', 8); } }
        // marina docks (OSM w819169611) + moored boats in the slips
        const dock = area('w819169611'), boats = new GeoBatch(), anchorLights = [], mooredBodies=[];
        if (dock) {
            ctx.skipAreas.add('w819169611');
            const dy = LAKE_Y + 0.42;
            const shape = new THREE.Shape(dock.map(([x, z]) => new THREE.Vector2(x, -z))); const dg = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false }); dg.rotateX(-Math.PI / 2); dg.translate(0, dy - 0.55, 0);
            pb.add(dg, 'wood', null, '#8a7a66'); dg.dispose();
            g.addPoly(dock, dy, dy - 2);
            const placed = [];
            for (let i = 0; i < dock.length; i++) {
                const [ax, az] = dock[i], [qx, qz] = dock[(i + 1) % dock.length], Le = Math.hypot(qx - ax, qz - az); if (Le < 7) continue;
                const tx = (qx - ax) / Le, tz = (qz - az) / Le;
                for (const side of [1, -1]) for (let t = 3; t < Le - 2; t += 5.2) {
                    const off = 2.6, x = ax + tx * t + tz * off * side, z = az + tz * t - tx * off * side;
                    if (inPoly(x, z, dock) || sdf(x, z) < 3 || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 7.5)) continue;
                    let clear = true; for (let q = -4; q <= 4; q += 2) { const px = x + tx * q, pz = z + tz * q; if (inPoly(px, pz, dock)) { clear = false; break; } } if (!clear) continue;
                    if (r() < 0.18) continue;
                    placed.push([x, z]); const res = boat(boats, x, LAKE_Y, z, Math.atan2(tx, tz) + (r() < 0.5 ? Math.PI : 0), r() < 0.55 && !underShed(x, z) ? 'sail' : 'motor', r); // no masts under the covered moorage
                    anchorLights.push(res.light); mooredBodies.push(res.body); // (was swallowed by the comment above: the kayak course ignored the moored boats and they had no anchor lights)
                    ctx.box(x,z,res.body.hw,res.body.hd,res.body.angle,{prop:true,y:LAKE_Y,h:3});
                }
            }
        }
        // the other mapped piers (live OSM 2026-11-12, man_made=pier ways): the marina's outer fingers and the yacht-club
        // piers south-east of it, and the private docks along the north-west shore. The extract held three of them as
        // degenerate "areas" painted on the lake bed; the rest were outside it. 2.2 m timber walkways on piles (width and
        // deck height are estimates), not walkable (private / access=no).
        const pierLines = [], buoyPts = []; // (kept for the kayak course's clearance)
        { const PIERS = [['w753594671', [[65.8, 143], [76.7, 150.9], [132.4, 75.2]]], ['w753594673', [[76.7, 150.9], [86.8, 158]]], ['w753594670', [[98.8, 193], [94.4, 185.6], [169.5, 150.4]]], ['w753594674', [[94.4, 185.6], [91.2, 180.6]]],
                ['w753594669', [[107.8, 238.3], [108.4, 223.1], [208.7, 175.2]]], ['w753594675', [[108.4, 223.1], [108.2, 213.9], [106.7, 210.1]]], ['w753594668', [[121.1, 252.7], [137.8, 267.6], [228.6, 214.7]]], ['w753594676', [[137.8, 267.6], [149.5, 277.3]]],
                ['w753594677', [[163.2, 290], [177.3, 302.4], [251.3, 251.1]]], ['w753594678', [[177.3, 302.4], [185.1, 309]]], ['w753594680', [[-39.2, 258.8], [-28.1, 235.9], [-17.7, 241]]],
                ['w737163199', [[-131, -63.8], [-119.5, -86.8]]], ['w737163200', [[-146.8, -75.4], [-135.2, -90.4], [-142.7, -95.6]]], ['w737163201', [[-157.5, -85.3], [-153.2, -82.3], [-142.7, -95.6], [-137.7, -102.2]]],
                ['w737163202', [[-183, -107], [-189.7, -111.9], [-178, -127.7], [-184.7, -132.6], [-191.6, -137.4], [-202.2, -121.3], [-205, -123.4]]], ['w737163203', [[-181.7, -136.3], [-184.7, -132.6], [-195.9, -116.2]]],
                ['w737163204', [[-218.4, -166.1], [-228.1, -155], [-225, -152.3]]], ['w737163205', [[-248.9, -166.1], [-236.9, -183.8]]], ['w737163206', [[-275.4, -177.6], [-259, -200.1]]]];
            const dy = LAKE_Y + 0.42;
            PIERS.forEach(([id, pts], n) => { ctx.skipAreas.add(id); pierLines.push(pts);
                for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [qx, qz] = pts[i], Le = Math.hypot(qx - ax, qz - az); if (Le < 0.5) continue; const ya = Math.atan2(qx - ax, qz - az), wet = sdf((ax + qx) / 2, (az + qz) / 2) > -4;
                    const drop = (n % 2) * 0.09 + (i % 3) * 0.03; // lapping segments never share a top plane
                    pb.box((ax + qx) / 2, (wet ? dy - 0.22 : Math.max(dy - 0.22, g.heightAt((ax + qx) / 2, (az + qz) / 2) - 0.05)) - drop, (az + qz) / 2, 2.2 - (i % 2) * 0.06, 0.22, Le + 1.0, i % 2 ? '#84755f' : '#8a7a66', 'wood', ya);
                    for (let t = 1; t < Le; t += 7) { const x = ax + (qx - ax) * t / Le, z = az + (qz - az) * t / Le; if (sdf(x, z) > 0.5) pb.cyl(x + Math.cos(ya) * 1.0, LAKE_Y - 1.2, z - Math.sin(ya) * 1.0, 0.13, 2.6, '#4d443b', 'wood', 6); } } }); }
        // the six buoys off the crescent pier (OSM man_made=buoy, seamark special purpose: n6901346624-629): white can buoys
        // with an orange band (shape estimated)
        for (const [x, z] of [[-75, 42.6], [-41.1, 62.6], [-14.6, 67.9], [10, 66.1], [-90.9, -3.4], [-108.3, -44.3]]) if (sdf(x, z) > 1) { buoyPts.push([x, z]); boats.cyl(x, LAKE_Y - 0.25, z, 0.22, 1.25, '#f1f1ec', 'plastic', 10); boats.cyl(x, LAKE_Y + 0.62, z, 0.232, 0.16, '#e2702a', 'plastic', 10); }
        // a few boats on mooring buoys out in the bay
        for (const [x, z, k] of [[-120, 150, 'sail'], [-170, 95, 'sail'], [-60, 175, 'motor'], [-220, 160, 'sail']]) if (sdf(x, z) > 8) { const res = boat(boats, x, LAKE_Y, z, r() * 6.28, k, r); anchorLights.push(res.light);mooredBodies.push(res.body);ctx.box(x,z,res.body.hw,res.body.hd,res.body.angle,{prop:true,y:LAKE_Y,h:3}); }
        ctx.add(boats.build('marina-boats'));
        ctx.add(pb.build('meydenbauer-buildings'));
        if (anchorLights.length) { const al = new GeoBatch(); for (const [x, y, z] of anchorLights) al.sphere(x, y, z, 0.07, 0.07, 0.07, '#ffffff', 'paint', 6, 4); ctx.add(al.build('anchor-lights', { matOverrides: { paint: nightLit('#fff4dc', 3, { base: '#dddddd', name: 'anchor-lights' }) } }));
            // (2026-11-12 render review) the 7 cm lamp alone vanished beyond ~20 m: an all-round white masthead light reads as
            // a steady point at any range, so each lamp also carries a fixed-size additive glow point (night only)
            fairyLights(ctx, anchorLights.map(([x, y, z]) => [x, y + 0.02, z]), { color: '#fff4dc', screenPx: 7, twinkle: 0, name: 'anchor-light-glow' }); }
        // ---------------------------------------------------------------- beach furniture: buoy line, swim float + lifeguard stand (summer), driftwood logs
        const swim = area('w737163174'), fb = new GeoBatch(), summer = new THREE.Group(); summer.name = 'summer-only';
        if (swim) {
            const swimL = [...swim, swim[0]]; let acc = 0;
            for (let i = 1; i < swimL.length; i++) { const [ax, az] = swimL[i - 1], [qx, qz] = swimL[i], Le = Math.hypot(qx - ax, qz - az); for (let t = acc; t < Le; t += 3) { const x = ax + (qx - ax) * t / Le, z = az + (qz - az) * t / Le; if (sdf(x, z) > 2) fb.sphere(x, LAKE_Y + 0.05, z, 0.22, 0.18, 0.22, Math.floor((t + i * 7) / 3) % 4 === 0 ? '#d43a2a' : '#f2f2ee', 'plastic', 8, 6); } }
        }
        const sb = new GeoBatch(); sb.box(-6, LAKE_Y - 0.2, 38, 5.5, 0.55, 5.5, '#d9d8d2', 'plastic'); sb.box(-6, LAKE_Y + 0.35, 38, 0.6, 0.9, 0.6, '#c2c7ca', 'steel'); // swim float + ladder
        const lg = { x: 5, z: -14 }; const ly = g.heightAt(lg.x, lg.z);
        for (const [dx, dz] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) sb.rod([lg.x + dx, ly, lg.z + dz], [lg.x + dx * 0.7, ly + 2.1, lg.z + dz * 0.7], 0.06, '#f2f2ee', 'paint', 6);
        sb.box(lg.x, ly + 2.1, lg.z, 1.2, 0.1, 1.1, '#f2f2ee', 'paint'); sb.box(lg.x, ly + 2.2, lg.z + 0.45, 0.9, 0.5, 0.1, '#c8102e', 'paint'); sb.cyl(lg.x, ly + 2.2, lg.z, 0.04, 1.6, '#cccccc', 'metal', 4); sb.cyl(lg.x, ly + 3.7, lg.z, 0.9, 0.35, '#c8102e', 'fabric', 10, 0.1);
        summer.add(sb.build('summer-swim'));
        ctx.add(summer); seasonal(ctx, [5, 25], [9, 8], (on) => { summer.visible = on; });
        for (const [x, z, a] of [[-18, -26, 0.3], [8, -14, 1.1], [-26, -33, 2.1]]) { const y = g.heightAt(x, z); fb.rod([x - Math.cos(a) * 2.2, y + 0.25, z - Math.sin(a) * 2.2], [x + Math.cos(a) * 2.2, y + 0.3, z + Math.sin(a) * 2.2], 0.28, '#8d7a64', 'wood', 8, 0.24); ctx.box(x, z, 2.2, 0.3, -a, { prop: true, h: 0.55 }); }
        // ---------------------------------------------------------------- rockeries (OSM retaining walls) + boulders along the promenade
        const rk = new GeoBatch();
        // The layer-1 public pier crosses w1496390046. Its guessed rockery
        // height must stay beneath the actual rendered deck, rather than
        // sealing that source access with an invented full-height wall.
        const hasRaisedPier = d.ways.some(w => w.id === 'w687934817' && String(w.layer) === '1');
        const deckTopAt = (x, z) => {
            for (const q of deckQuads) for (const [a, b, c] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
                const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-9) continue;
                const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
                if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[1] + v * b[1] + (1 - u - v) * c[1];
            }
            return null;
        };
        for (const a of d.areas) if (a.barrier === 'retaining_wall') {
            const support = (x, z) => hasRaisedPier && a.id === 'w1496390046' ? deckTopAt(x, z) : null;
            const cap = (x, z) => { const deck = support(x, z); return deck === null ? g.heightAt(x, z) + .9 : Math.min(g.heightAt(x, z) + .9, deck - .12); };
            boulderWall(rk, a.poly, (x, z) => { const deck = support(x, z), base = g.heightAt(x, z) - .25; return deck === null ? base : Math.min(base, deck - 1.4); }, { h: 1.6, seed: a.poly.length * 13 });
            for (let i = 1; i < a.poly.length; i++) {
                const A = a.poly[i - 1], B = a.poly[i], n = hasRaisedPier && a.id === 'w1496390046' ? Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / .35) : 1;
                for (let j = 0; j < n; j++) {
                    const ax = lerp(A[0], B[0], j / n), az = lerp(A[1], B[1], j / n), qx = lerp(A[0], B[0], (j + 1) / n), qz = lerp(A[1], B[1], (j + 1) / n);
                    ctx.collider({ wall: true, ax, az, bx: qx, bz: qz, y0a: g.heightAt(ax, az) - 3, y1a: cap(ax, az), y0b: g.heightAt(qx, qz) - 3, y1b: cap(qx, qz), nx: 0, nz: 1, intended: true });
                }
            }
        } // mapped boulder rockery, including its portions beneath the pier
        for (const pts of prom.slice(0, 1)) { const Lp = polylineLength(pts); for (let s = 4; s < Lp; s += 7 + r() * 6) { const p = alongPolyline(pts, s), p2 = alongPolyline(pts, Math.min(Lp, s + 1)), tx = p2.x - p.x, tz = p2.z - p.z, tl = Math.hypot(tx, tz) || 1, side = r() < 0.5 ? 1 : -1, x = p.x + tz / tl * 3.1 * side, z = p.z - tx / tl * 3.1 * side; if (sdf(x, z) > -1) continue; boulderWall(rk, [[x - 0.5, z], [x + 0.6, z + 0.2]], (px, pz) => g.heightAt(px, pz) - 0.2, { h: 0.9, seed: s | 0 }); ctx.circle(x, z, 0.7, 0.8); } }
        ctx.add(rk.build('rockeries')); ctx.add(fb.build('beach-furniture'));
        // ---------------------------------------------------------------- playground (OSM w688639344): climbing tower, slide, swings
        const pg = area('w688639344');
        if (pg) {
            const pc = polyBox(pg), x = (pc.x0 + pc.x1) / 2, z = (pc.z0 + pc.z1) / 2, y = g.heightAt(x, z), pl = new GeoBatch();
            for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) pl.cyl(x + dx, y, z + dz, 0.08, 3.2, '#2f6f8f', 'paint', 8);
            pl.box(x, y + 1.6, z, 3.4, 0.12, 3.4, '#c9a64a', 'plastic'); pl.cyl(x, y + 3.2, z, 2.3, 1.0, '#e0743a', 'plastic', 4, 0.05, 0, Math.PI / 4);
            pl.box(x + 3.4, y + 0.8, z, 0.9, 0.08, 3.8, '#e8c33a', 'plastic', 0, 0, -0.43);
            for (const dz of [-1, 1]) pl.rod([x - 4.5, y, z + dz * 2.4 + 2], [x - 4.5, y + 2.4, z + dz * 1.2 + 2], 0.06, '#2f6f8f', 'paint', 6);
            pl.rod([x - 4.5, y + 2.4, z + 0.8], [x - 4.5, y + 2.4, z + 3.2], 0.06, '#2f6f8f', 'paint', 6); pl.box(x - 4.5, y + 0.5, z + 1.6, 0.5, 0.05, 0.25, '#222', 'rubber'); pl.box(x - 4.5, y + 0.5, z + 2.4, 0.5, 0.05, 0.25, '#222', 'rubber');
            ctx.add(pl.build('playground')); ctx.box(x, z, 1.8, 1.8, 0, { prop: true, h: 3.4 });
        }
        // ---------------------------------------------------------------- Lake Washington Blvd arch bridge over the ravine (concrete, balustrade)
        const lwb = way('w753604118');
        if (lwb) {
            ctx.skipWays.add('w753604118');
            const [a0, a1] = [lwb[0], lwb[lwb.length - 1]], Lb = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), yaw = Math.atan2(a1[0] - a0[0], a1[1] - a0[1]), nx = Math.cos(yaw), nz = -Math.sin(yaw);
            const ya = g.heightAt(a0[0], a0[1]) + 0.1, yb = g.heightAt(a1[0], a1[1]) + 0.1, br = new GeoBatch(), cx = a0[0] - nx * 5, cz = a0[1] - nz * 5;
            const yAt = (t) => lerp(ya, yb, t);
            // deck: one sloped slab (it was 24 level boxes: a 13 cm stair every 4 m, and nothing to stand on — walkers on the
            // boulevard dropped to the ravine floor inside it). Street View on the bridge (2026-11-12): a raised concrete
            // sidewalk on each side inside the balustrades, dark lantern posts at the parapet. Sidewalk width, the lamps'
            // number (two mid-span, one at each end) and height are estimates.
            const Pt = (t, off, dy = 0) => [cx + (a1[0] - a0[0]) * t + nx * off, yAt(t) + dy, cz + (a1[1] - a0[1]) * t + nz * off], HWD = 6.75, DTH = 1.4;
            br.quad(Pt(0, -HWD), Pt(1, -HWD), Pt(1, HWD), Pt(0, HWD), '#9d9b95', 'concrete');
            br.quad(Pt(0, HWD, -DTH), Pt(1, HWD, -DTH), Pt(1, -HWD, -DTH), Pt(0, -HWD, -DTH), '#8f8c85', 'concrete');
            br.quad(Pt(0, HWD, -DTH), Pt(0, HWD), Pt(1, HWD), Pt(1, HWD, -DTH), '#a9a59c', 'concrete'); br.quad(Pt(1, -HWD, -DTH), Pt(1, -HWD), Pt(0, -HWD), Pt(0, -HWD, -DTH), '#a9a59c', 'concrete');
            br.quad(Pt(0, 4.9, 0.17), Pt(1, 4.9, 0.17), Pt(1, 6.45, 0.17), Pt(0, 6.45, 0.17), '#bcb9b1', 'concrete'); br.quad(Pt(1, 4.9), Pt(1, 4.9, 0.17), Pt(0, 4.9, 0.17), Pt(0, 4.9), '#aaa79f', 'concrete');
            br.quad(Pt(0, -6.45, 0.17), Pt(1, -6.45, 0.17), Pt(1, -4.9, 0.17), Pt(0, -4.9, 0.17), '#bcb9b1', 'concrete'); br.quad(Pt(0, -4.9), Pt(0, -4.9, 0.17), Pt(1, -4.9, 0.17), Pt(1, -4.9), '#aaa79f', 'concrete');
            for (let i = 0; i < 48; i++) { const t = (i + 0.5) / 48, p = Pt(t, 0); g.addBox(p[0], p[2], HWD, Lb / 96 + 0.03, yaw, p[1] - DTH, p[1]); }
            for (const s of [-1, 1]) ctx.collider({ wall: true, ax: Pt(0, 6.6 * s)[0], az: Pt(0, 6.6 * s)[2], bx: Pt(1, 6.6 * s)[0], bz: Pt(1, 6.6 * s)[2], y0a: ya - 0.5, y1a: ya + 1.05, y0b: yb - 0.5, y1b: yb + 1.05, nx: 0, nz: 1, y: ya, intended: true }); // balustrades
            for (const [t, s] of [[0.03, 1], [0.97, -1], [0.42, -1], [0.58, 1]]) { const p = Pt(t, 6.25 * s, 0.17); br.cyl(p[0], p[1], p[2], 0.07, 4.0, '#232527', 'metal', 8); br.box(p[0], p[1] + 4.0, p[2], 0.26, 0.42, 0.26, '#e9e2c8', 'glass'); br.box(p[0], p[1] + 4.42, p[2], 0.42, 0.08, 0.42, '#2b2d2f', 'metal'); }
            for (const s of [-1, 1]) for (let t = 0; t <= 1.001; t += 1 / 46) { const x = cx + (a1[0] - a0[0]) * t + nx * 6.6 * s, z = cz + (a1[1] - a0[1]) * t + nz * 6.6 * s, y = yAt(t); br.box(x, y, z, 0.18, 0.75, 0.18, '#c9c5bb', 'concrete', yaw); if (t < 0.99) { const x2 = cx + (a1[0] - a0[0]) * (t + 1 / 46) + nx * 6.6 * s, z2 = cz + (a1[1] - a0[1]) * (t + 1 / 46) + nz * 6.6 * s; br.box((x + x2) / 2, y + 0.75, (z + z2) / 2, 0.32, 0.22, Lb / 46 + 0.02, '#cdc9bf', 'concrete', yaw); } }
            // (round 3) the substructure as seen from below in an official panorama on the ravine lane beside the bridge (2026-11-13):
            // a concrete slab deck on single tapered rectangular piers standing upright on the slope under the deck's middle —
            // not the two pairs of canted struts guessed before. Pier count / spacing and section are estimates (three piers).
            for (const t of [0.25, 0.5, 0.75]) { const [x, , z] = Pt(t, 0), y = yAt(t) - DTH, gy = g.heightAt(x, z), h = y - gy + 1.2; if (h < 3) continue;
                const pg = new THREE.CylinderGeometry(1.0, 0.72, h, 4).rotateY(Math.PI / 4); br.add(pg, 'concrete', M(x, gy - 1.2 + h / 2, z, 0, yaw, 0, 1.8, 1, 1), '#a29e95'); pg.dispose(); ctx.circle(x, z, 0.9, h, { y: gy }); }
            ctx.add(br.build('lwb-bridge'));
        }
        // park name sign at the Lake Washington Blvd × 99th Ave NE entrance (Street View 2026-11-12: a low teal panel between
        // two posts in the corner planting, facing the junction; the name is the OSM park name w57883263). Size estimated.
        { const sx = 113.2, sz = -46.6, sy = g.heightAt(sx, sz), th = Math.PI - 68 * Math.PI / 180, es = new GeoBatch();
            for (const s of [-1.55, 1.55]) es.box(sx + Math.cos(th) * s, sy, sz - Math.sin(th) * s, 0.32, 1.35, 0.32, '#8d8a83', 'stone', th);
            es.box(sx, sy + 0.3, sz, 2.8, 0.95, 0.14, '#2e6f73', 'paint', th); ctx.add(es.build('park-entrance-sign'));
            const t1 = glowText('Meydenbauer Bay Park', 2.5, 0.42, { fg: '#f3f1e8', bg: '#2e6f73', font: (q) => `600 ${q}px Georgia, serif`, night: 0.5 }); t1.position.set(sx + Math.sin(th) * 0.08, sy + 0.82, sz + Math.cos(th) * 0.08); t1.rotation.y = th; ctx.add(t1);
            ctx.box(sx, sz, 1.7, 0.2, th, { prop: true, h: 1.35 }); }
        // ---------------------------------------------------------------- OSM backdrop (houses, condos, lawns, paths), trees, lamps
        ctx.terrainOpts = { bg: '#55703a', innerPx: 2048, skirtY: LAKE_Y - 7, skirtColor: '#2a3a3a' };
        if (pv) ctx.exclude.push(pv); // the four layer-1 picnic tables were drawn on the pavilion floor, inside its walls: they stand on the terrace (above)
        { const deck = way('w687934817'); if (deck) ctx.exclude.push(deck); } // mapped pier benches were dropped onto the lake bed under the deck (generic furniture uses terrain height); the pier has its own
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.7, density: 1 / 45 }, style: (bd) => (/detached|house/.test(bd.k || '') || (Math.abs(polyArea(bd.poly)) < 260 && (+bd.lv || +bd.levels || 1) <= 2) ? 'house' : undefined) });
        // (round 3, r2-bel-spots-3) the mapped flights beside the pavilion were a smooth bank: OSM w841411878 (highway=steps,
        // step_count=5, handrail=both, concrete, lit) and w840902386 (step_count=17, handrail=both, concrete). Built as concrete
        // flights with the mapped number of steps between the ground levels at their ends, a steel handrail each side; the
        // flight width (2.0 m) is an estimate. Each tread is a walkable surface. Built after osmBackdrop: its ground settling changes
        // the levels at the flight's ends.
        // (r3-bel-spots-2) the bank round both flights is graded to the USGS 1 m DEM (EPQS, 2026-11-13, scene datum = NAVD88 − 5.7):
        // w840902386 runs 2.49 m at its top (54.9, 18.8) down to 0.30 m at its foot (52.2, 23.6); w841411878 starts at 3.70 m
        // (50.4, 4.3; the pavilion bank modifier above had raised it flush with the terrace, so the 5 steps had no rise) and
        // climbs to the terrace deck. A corridor 2 m either side of each flight follows the line between those levels, with a
        // 1 m landing past each end, and blends back into the scene's bank over the next 3 m.
        for (const [id, yA, yB] of [['w840902386', 2.49, 0.30], ['w841411878', 3.70, TERRACE_Y]]) {
            const pts = way(id); if (!pts || pts.length < 2) continue; const A = pts[0], B = pts[pts.length - 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
            g.mod((x, z, h) => { const dx = x - A[0], dz = z - A[1], u = dx * ux + dz * uz, v = Math.abs(-dx * uz + dz * ux); if (v > 5 || u < -4 || u > L + 4) return h;
                const w = smooth(5, 2, v) * smooth(-4, -1, u) * smooth(L + 4, L + 1, u); return w > 0 ? lerp(h, lerp(yA, yB, clamp(u / L, 0, 1)), w) : h; });
        }
        { const FL = [['w841411878', 5], ['w840902386', 17]], stb = new GeoBatch();
            for (const [id, n] of FL) { const pts = way(id); if (!pts || pts.length < 2) continue; const A = pts[0], B = pts[pts.length - 1], yA0 = g.heightAt(A[0], A[1]), yB0 = g.heightAt(B[0], B[1]);
                const [lo, hi, ylo, yhi] = yA0 <= yB0 ? [A, B, yA0, yB0] : [B, A, yB0, yA0], Ls = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]); if (Ls < 0.5 || yhi - ylo < 0.15) continue;
                const ux = (hi[0] - lo[0]) / Ls, uz = (hi[1] - lo[1]) / Ls, yaw = Math.atan2(ux, uz), run = Ls / n, rise = (yhi - ylo) / n, HWS = 1.0;
                for (let i = 0; i < n; i++) { const t = (i + 0.5) * run, x = lo[0] + ux * t, z = lo[1] + uz * t, top = ylo + rise * (i + 1);
                    stb.box(x, ylo - 0.4, z, 2 * HWS, top - ylo + 0.4, run + 0.004, i % 2 ? '#b4b1aa' : '#bbb8b1', 'concrete', yaw); g.addBox(x, z, HWS, run / 2 + 0.01, yaw, top - 1.5, top); }
                for (const s of [-1, 1]) { const ox = uz * (HWS - 0.06) * s, oz = -ux * (HWS - 0.06) * s, p0 = [lo[0] + ox, ylo + rise + 0.9, lo[1] + oz], p1 = [hi[0] + ox, yhi + 0.9, hi[1] + oz];
                    stb.rod(p0, p1, 0.025, '#9ea4a8', 'steel', 6); for (const q of [0, 0.5, 1]) { const x = lo[0] + ox + (hi[0] - lo[0]) * q, z = lo[1] + oz + (hi[1] - lo[1]) * q, yt = ylo + rise + (yhi - ylo - rise) * q; stb.rod([x, yt - 0.9 + (q === 0 ? -rise : 0), z], [x, yt + 0.9, z], 0.022, '#9ea4a8', 'steel', 6); }
                    ctx.collider({ wall: true, ax: p0[0], az: p0[2], bx: p1[0], bz: p1[2], y0a: ylo - 0.5, y1a: p0[1] + 0.1, y0b: yhi - 0.5, y1b: p1[1] + 0.1, nx: 0, nz: 1, intended: true }); } }
            ctx.add(stb.build('pavilion-steps')); }
        for (const a of d.areas) if (a.landuse === 'shrubs') { const B = polyBox(a.poly); for (let i = 0; i < Math.min(14, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 12); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) ctx.trees.push({ x, z, kind: 'shrub', s: 0.45 + r() * 0.35, c: ['#56703a', '#6b4a3a', '#4c6a3c', '#7a6a3a'][i % 4] }); } }
        // Douglas firs + cedars on the ravine slopes behind the beach (the wooded edge in every photo)
        for (let i = 0; i < 320; i++) { const x = -190 + r() * 330, z = -230 + r() * 210; if (sdf(x, z) > -6 || g.heightAt(x, z) < 1.5 || d.buildings.some((bd) => !bd.part && Math.abs(bd.poly[0][0] - x) < 25 && Math.abs(bd.poly[0][1] - z) < 25 && inPoly(x, z, bd.poly))) continue; if (d.ways.some((w) => w.pts.length > 1 && distPolyline(x, z, w.pts).d < 3.5)) continue; if (d.areas.some((a) => (a.landuse === 'grass' || a.leisure === 'playground' || a.natural === 'beach') && inPoly(x, z, a.poly))) continue; ctx.trees.push({ x, z, kind: r() < 0.72 ? 'con' : 'broad', s: 1.0 + r() * 0.7 }); }
        // far shores (south side of the bay, beyond the DEM): fir woods with houses showing through
        for (let i = 0; i < 520; i++) { const x = -420 + r() * 840, z = -150 + r() * 620; if (x > DT.x0 && x < DT.x1 && z > DT.z0 && z < DT.z1) continue; const s = sdf(x, z); if (s > -4 || s < -90) continue; ctx.trees.push({ x, z, kind: r() < 0.7 ? 'con' : 'broad', s: 1.1 + r() * 0.6 }); }
        // Street View across the bay (99th Ave NE / Lake Washington Blvd, 2026-11-12): the far shores are a continuous belt of
        // tall firs with houses at the waterline — not bare green hills with a scatter of trees. A dense, low-detail belt
        // (tree LOD below: only the nearest crowns are full detail) on every shore beyond the playable area.
        { const r2 = rng(6902); for (let i = 0; i < 9000; i++) { const x = -560 + r2() * 1120, z = -260 + r2() * 860, s = sdf(x, z); if (s > -3 || s < -420) continue; if (x > DT.x0 - 10 && x < DT.x1 + 10 && z > DT.z0 - 10 && z < DT.z1 + 10) continue; if (r2() > (s > -50 ? 0.5 : 0.9)) continue; if (d.buildings.some((bd) => !bd.part && Math.abs(bd.poly[0][0] - x) < 90 && Math.abs(bd.poly[0][1] - z) < 90 && inPoly(x, z, bd.poly)) || d.ways.some((w) => w.pts.length > 1 && Math.abs(w.pts[0][0] - x) < 400 && distPolyline(x, z, w.pts).d < 5)) continue; ctx.trees.push({ x, z, kind: r2() < 0.8 ? 'con' : 'broad', s: 1.5 + r2() * 1.0 }); } }
        ctx.extras.shoreHouses = shoreHouses(ctx, shoreList, { sdf, lakeY: LAKE_Y }).length; // houses at the waterline under the fir belt (r2-bel-spots-1)
        ctx.treeLod = { cap: Infinity, near: 110, max: 420, force: true };
        // (round 3, r2-bel-spots-2) two lamp families, as in Street View: the street lights along Lake Washington Blvd NE are
        // tall grey cobra heads; the park's own lights are the dark 5 m pendant posts below. The scene's lamp set has one
        // style (ctx.lampOpts), so the boulevard's generated lamp points (osmBackdrop, within 12 m of a mapped Lake Washington
        // Blvd way) are built here as a second set with the shared lamp builder, and only their light pools go to the shared
        // set (noPost entries at the post, 1.8 m short of the head). Spacing / side are the generator's (no lamp nodes are mapped here); the 8.5 m
        // height is the shared cobra default.
        { const blvd = d.ways.filter((w) => /^Lake Washington Boulevard/.test(w.name || '') && w.pts.length > 1), near = (p) => blvd.some((w) => distPolyline(p.x, p.z, w.pts).d < 12);
            const cobra = ctx.lampPoints.filter((p) => !p.noPost && near(p) && !ctx.onRoad?.(p.x, p.z, 0.25));
            if (cobra.length) { const keep = new Set(cobra); ctx.lampPoints = ctx.lampPoints.filter((p) => !keep.has(p) && !(near(p) && !p.noPost)); const H = 8.5, L = buildLamps(cobra, g, { style: 'cobra', color: '#8e9396', h: H });
                if (L.headMesh) { const hm = L.headMesh.material; hm.emissive.set('#ffe9c4'); hm.emissiveIntensity = 0; hm.userData.nightEmissive = 1.6; hm.userData.nightGlow = 1.6; hm.userData.dayGlow = 0; }
                ctx.add(L.group); ctx.colliders.push(...L.colliders);
                for (const l of L.lamps) ctx.lampPoints.push({ x: l.x, z: l.z, noPost: true, h: l.h, y: l.y, rot: l.rot }); // light entry with the arm yaw: the pool sits under the head (r3-bel-spots-3)
                ctx.extras.boulevardLamps = cobra.length; } }
        // (r3-bel-spots-3) 99th Ave NE: Street View shows a dark post with a bell pendant, not the park's arm posts. The generated
        // points within 10 m of the mapped 99th Ave NE way get that lamp: 4.6 m post, a short swan-neck arm, a dark bell shade
        // with a lit underside. Post height, arm reach and bell size are estimates (no lamp nodes are mapped here).
        { const ave = d.ways.filter((w) => /^99th Avenue Northeast/.test(w.name || '') && w.pts.length > 1), nearA = (p) => ave.some((w) => distPolyline(p.x, p.z, w.pts).d < 10);
            const bells = ctx.lampPoints.filter((p) => !p.noPost && nearA(p) && !ctx.onRoad?.(p.x, p.z, 0.25));
            if (bells.length) { const keep = new Set(bells); ctx.lampPoints = ctx.lampPoints.filter((p) => !keep.has(p)); const lb = new GeoBatch(), H = 4.6, R = 0.75;
                const shadeMat = new THREE.MeshStandardMaterial({ color: '#f6efd9', emissive: '#ffe4b0', emissiveIntensity: 0, roughness: 0.5 }); shadeMat.userData.nightEmissive = 1.4; shadeMat.userData.nightGlow = 1.2; shadeMat.userData.dayGlow = 0;
                const glow = [];
                for (const p of bells) { const y = g.heightAt(p.x, p.z), rot = p.rot ?? 0, ax = -Math.sin(rot), az = -Math.cos(rot), hx = p.x + ax * R, hz = p.z + az * R; // arm along −z rotated by rot (osm.js convention)
                    lb.cyl(p.x, y, p.z, 0.13, 0.5, '#24272a', 'metal', 10); lb.cyl(p.x, y + 0.5, p.z, 0.065, H - 0.5, '#24272a', 'metal', 8);
                    lb.tube([[p.x, y + H - 0.2, p.z], [p.x + ax * 0.25, y + H + 0.12, p.z + az * 0.25], [p.x + ax * 0.6, y + H + 0.12, p.z + az * 0.6], [hx, y + H - 0.1, hz]], 0.035, '#24272a', 'metal', 6);
                    lb.cyl(hx, y + H - 0.48, hz, 0.3, 0.38, '#1f2326', 'metal', 14, 0.25); // the bell (wide at the bottom)
                    glow.push([hx, y + H - 0.5, hz]);
                    ctx.collider({ x: p.x, z: p.z, r: 0.15, hw: 0.15, prop: true, h: H });
                    ctx.lampPoints.push({ x: hx, z: hz, noPost: true, h: (H - 0.5) * 8 / 7.7, y }); } // render.js puts the light at 7.7·h/8: under the bell
                ctx.add(lb.build('bell-lamps'));
                const dg = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 14), dm = new THREE.InstancedMesh(dg, shadeMat, glow.length), m4 = new THREE.Matrix4();
                glow.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); dm.setMatrixAt(i, m4); }); dm.name = 'bell-lamp-glass'; dm.userData.noAudit = true; ctx.add(dm);
                ctx.extras.bellLamps = bells.length; } }
        // promenade lights (Street View): dark posts about 5 m tall with a short arm and a pendant shade — not 7 m grey cobra heads
        ctx.lampOpts = { style: 'cobra', color: '#2d3033', h: 5.2 };
        for (const pts of prom) { const Lp = polylineLength(pts); for (let s = 6; s < Lp; s += 24) { const p = alongPolyline(pts, s), p2 = alongPolyline(pts, Math.min(Lp, s + 1)), tx = p2.x - p.x, tz = p2.z - p.z, tl = Math.hypot(tx, tz) || 1; ctx.lampPoints.push({ x: p.x + tz / tl * 2.7, z: p.z - tx / tl * 2.7, rot: Math.atan2(-tz, tx) }); } }
        // Seattle on the horizon (≈ 9 km west) + Olympics, Rainier on clear days
        seattleBackdrop(ctx, { baseY: LAKE_Y - 0.4, clear: 3000, hazeK: 0.45, olympics: true, rainier: true, eyeY: 1.6 });
        // ---------------------------------------------------------------- activities (note 57)
        // 1) walk to the end of the crescent
        let pierDone = false;
        ctx.onUpdate((dt, s, pl) => { if (pierDone || !pl) return; if (Math.hypot(pl.x - TC.x, pl.z - TC.z) < TR - 0.5 && pl.y > DECK - 0.5) { pierDone = true; emitActivity(s, 'bel-meydenbauer', 'pier-end', '🌊 End of the crescent', '420 ft out over Meydenbauer Bay — Seattle is 9 km west across Lake Washington.'); } });
        ctx.interactables.push({ kind: 'activity', x: TC.x, z: TC.z, r: TR - 0.6, y: DECK, label: 'Walk to the end of the crescent pier', use: (s) => { if (!pierDone) { pierDone = true; emitActivity(s, 'bel-meydenbauer', 'pier-end', '🌊 End of the crescent', '420 ft out over Meydenbauer Bay — Seattle is 9 km west across Lake Washington.'); } else s.ui.toast('🌊 Meydenbauer Bay', 'Floating crescent pier, opened March 2019.'); } });
        // The city confirms a public hand-carry launch and seasonal rentals.
        // Its current page names Best Kayak Rentals; the OSM boathouse name REI
        // is historical, so this game course never claims an open REI rental.
        const launch = { x: 58, z: 51.3 }, sourcePier = d.areas.find(a=>a.id==='w819169611');
        const pierLine0=way('w688415225'), swimming=area('w737163174');
        const nearPoly=(x,z,p,margin)=>p&&(inPoly(x,z,p)||distPolyline(x,z,[...p,p[0]]).d<margin);
        // (2026-11-12 render review) the course was an 8 × 8 m stair-stepped out-and-back beside the launch. It is now a
        // paddle loop in open water round the mapped marina: out past the boathouse, down the marina's west side, round its
        // south end by the covered moorage and back (waterLoop: safe-grid legs, straight runs, rounded corners). The kayak
        // keeps KAYAK_CLEAR_M from every moored boat, pier, dock, buoy and shed, and 2 m off the swimming area. The waypoints
        // are game-course choices in open water, not mapped features.
        const KAYAK_CLEAR_M=2.7, KAYAK_WAYPOINTS=[[26,78],[6,108],[45,153],[-10,138],[-14,100],[16,70]];
        const nearBoat=(x,z,b)=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.angle),s=Math.sin(b.angle);return Math.abs(dx*c-dz*s)<b.hw+KAYAK_CLEAR_M&&Math.abs(dx*s+dz*c)<b.hd+KAYAK_CLEAR_M;};
        const kayakAvoid=(x,z)=>d.buildings.some(b=>nearPoly(x,z,b.poly,KAYAK_CLEAR_M))||nearPoly(x,z,sourcePier?.poly,KAYAK_CLEAR_M)||nearPoly(x,z,swimming,2)||
            (pierLine0&&distPolyline(x,z,pierLine0).d<6)||pierLines.some(p=>distPolyline(x,z,p).d<1.1+KAYAK_CLEAR_M)||buoyPts.some(([bx,bz])=>Math.hypot(x-bx,z-bz)<.25+KAYAK_CLEAR_M)||
            mooredBodies.some(b=>nearBoat(x,z,b))||ctx.colliders.some(c=>c.prop&&c.hw===c.r&&Math.hypot(x-c.x,z-c.z)<c.r+KAYAK_CLEAR_M);
        const course=(KAYAK_WAYPOINTS.length&&waterLoop(lakePoly,launch,KAYAK_WAYPOINTS,{clearance:1.2,avoid:kayakAvoid}))||shortWaterRoute(lakePoly,launch,{reach:20,clearance:1.2,avoid:kayakAvoid});
        const put=course?{x:course[0][0],z:course[0][1]}:launch;
        if(course&&sourcePier&&inPoly(launch.x,launch.z,sourcePier.poly)){
            const kay=new GeoBatch();kay.add(hullGeo(4.3,.66,.32,.12),'plastic',null,'#f0a21c');kay.box(0,.28,-.3,.42,.06,.9,'#1f1f1f','rubber');
            const kayak=kay.build('kayak');kayak.visible=false;ctx.add(kayak);
            const ride=boatRide(ctx,kayak,course,LAKE_Y,{speed:3,eye:.95,floatHeight:0,initialPitch:-.12,title:'Paddle Meydenbauer Bay',action:'Paddle a stroke',outfit:false,paddle:'kayak',
                help:'Paddle each stroke to follow a loop round the marina moorage, outside the swimming area, and back to the mapped dock. Leave or Esc returns to your starting deck. Real operator dates and hours are not modeled; check the city and current operator before visiting.',
                onDone:s=>emitActivity(s,'bel-meydenbauer','kayak','🛶 Bay paddle completed','You paddled the loop round the marina and returned to the mapped launch dock.')});
            ctx.extras.meydenbauerKayak={ride,path:course,launch,source:'w819169611',operatorHoursVerified:false,sourceUrl:'https://bellevuewa.gov/city-government/departments/parks/parks-and-trails/parks/meydenbauer-beach-park',launchPositionEstimated:true};
            const available=s=>s.r3d?.weather?.season!=='winter';
            ctx.interactables.push({kind:'kayak',x:launch.x,z:launch.z,y:LAKE_Y+.42,r:1.8,source:'w819169611',label:'Paddle a loop round the marina',tourAvailable:available,cond:()=>!ride.active(),use:s=>{if(!available(s)){s.ui.toast('🛶 Warm-season game course','Choose a warm season for the paddle exercise. The real operator publishes its own current opening dates.');return;}ride.start(s);}});
        }
        // Input-driven virtual stone practice, outside the mapped swimming area.
        // The temporary stone and ripples disappear; no real fixture is added.
        const beachC = beachPoly.length ? { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 } : { x: 10, z: -15 };
        const skipFrom=dryLanding(lakePoly,{x:-28,z:-16},2),skipTo={x:-40,z:1};
        ctx.extras.stoneSkipping=stoneSkipping(ctx,{from:skipFrom,target:new THREE.Vector3(skipTo.x,LAKE_Y+.03,skipTo.z),waterY:LAKE_Y,onDone:s=>emitActivity(s,'bel-meydenbauer','skip','🪨 Three stone throws','You released three visible stones across the water outside the swimming area.')});
        ctx.interactables.push({kind:'skip',...skipFrom,r:2.4,label:'Practise three stone skips',use:s=>ctx.extras.stoneSkipping.start(s)});
        // ---------------------------------------------------------------- plaques (research), postcard, crowd, sounds, spawn
        const PL = sp.plaques, py0 = (x, z) => g.heightAt(x, z);
        if (PL[0] && wh) { const c = polyBox(wh); ctx.plaque(PL[0], c.x0 - 6, c.z0 - 5, -2.4); }
        if (PL[1] && pv) { const c = polyBox(pv); ctx.plaque(PL[1], c.x0 - 3, c.z1 + 3.2, Math.PI * 0.85); }
        if (PL[2]) { const p = prom[0] ? alongPolyline(prom[0], 60) : { x: 10, z: -60 }; ctx.plaque(PL[2], p.x + 3, p.z + 2, 2.4); }
        void py0;
        const p0 = Q(arcL * 0.1), p1 = Q(arcL * 0.78), pb2 = (Math.atan2(p1.x - p0.x, -(p1.z - p0.z)) * 180 / Math.PI + 360) % 360;
        ctx.challenge('bel-meydenbauer', { view: [p1.x, p1.z], x: p0.x, z: p0.z, heading: pb2, pitch: 1, r: 14, tol: 35, text: 'The crescent pier curving out over Meydenbauer Bay, Seattle on the horizon' });
        const pierLine = Array.from({ length: 30 }, (_, i) => { const p = Q(i / 29 * arcL); return [p.x, p.z]; });
        ctx.crowdCfg = {
            personas: { local: 5, tech: 2, kid: 2.5, tourist_us: 1.5, tourist_in: 1.5, tourist_cn: 1, photographer: 1, staff: 0.3 },
            walkers: 18, paths: [pierLine, ...prom, ...ctx.footLines()],
            groups: [
                // (the beach is a diagonal strip: the centre of its bounding box, used before, lies in the lake and the group sat
                // in deep water. The mean of the beach outline's dry vertices is on the sand.)
                (() => { const dry = beachPoly.filter(([x, z]) => sdf(x, z) < -2.5), c = dry.length ? { x: dry.reduce((s, p) => s + p[0], 0) / dry.length, z: dry.reduce((s, p) => s + p[1], 0) / dry.length } : beachC, ok = sdf(c.x, c.z) < -3 && inBeach(c.x, c.z) ? c : dryLanding(lakePoly, c, 4); return { x: ok.x, z: ok.z, r: 3.5, n: 7, act: 'sit', look: [-300, 200], personas: ['local', 'kid', 'tech'] }; })(),
                { x: TC.x, z: TC.z, r: 2.2, n: 4, act: 'photo', look: [-2000, 300], y: DECK, personas: ['photographer', 'tourist_us', 'tourist_in'] },
                { x: launch.x + 1.5, z: launch.z + 1, r: 0.4, n: 1, act: 'watch', look: [put.x, put.z], personas: ['staff'] },
            ],
        };
        ctx.sound('water', beachC.x, beachC.z + 10, 120, 1.3); ctx.sound('gulls', -40, 60, 220, 1); ctx.sound('birds', 60, -120, 160, 1);
        { const sx = 22, sz = -21, t = Q(arcL * 0.45); ctx.spawns['bel-meydenbauer'] = { x: sx, z: sz, heading: Math.atan2(-(t.x - sx), -(t.z - sz)) }; } // on the beach promenade: beach, crescent pier and the bay ahead
        void M; void headingFromBearing;
    },
};
