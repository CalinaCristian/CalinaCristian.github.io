// ============================================================================
//  Meydenbauer Bay Park, Bellevue (reopened March 2019) — rebuilt round 5
//  (owner note 69) from the OSM survey + reference photos (Commons: aerial
//  April 2023, Mark Yasuda Dec 2019): the 420-ft floating crescent pier
//  (concrete deck, galvanised mesh railings, pipe piles, benches, the clock
//  post at the round tip), the grey-sand swimming beach with the buoy line and
//  summer swim float, the wide concrete promenade lined with granite boulders
//  and tall LED poles, terraced lawns behind boulder rockeries, the playground,
//  the dark-roofed pavilion, the historic whaling building on piles, the red
//  REI boathouse and the Meydenbauer Bay marina (docks + moored sail/motor
//  boats), Lake Washington on the shared water material, the houses and condos
//  on the hill, the arched Lake Washington Blvd bridge over the ravine and
//  Seattle on the horizon (≈ 9 km west).
//  Activities (note 57): walk to the end of the crescent; rent a kayak at the
//  boathouse (summer) for a paddle round the bay; skip stones from the beach.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, lerp, smooth, clamp, inPoly, polyBox, alongPolyline, polylineLength, distPolyline, canvas, canvasTexture } from '../kit.js';
import { seattleBackdrop } from '../backdrop.js';
import { bench } from '../osm.js';
import { emitActivity, localMD, inWindow, seasonal, shoreField, waterGrid, boulderWall, nightLit, glowText, gableRoof } from './bel-common.js';

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
        b.add(hullGeo(L, W, 0.8, 0.5), 'paint', M(x, y, z, 0, yaw), col);
        b.add(hullGeo(L * 0.995, W * 1.01, 0.18, 0.02), 'paint', M(x, y + 0.08, z, 0, yaw), '#2b2f33'); // boot stripe
        const [cx, cy, cz] = C(0, 0.8, -L * 0.08); b.box(cx, cy, cz, W * 0.62, 0.55, L * 0.32, '#e9e7e1', 'paint', yaw);
        const [wx, wy, wz] = C(0, 1.1, -L * 0.02); b.box(wx, wy, wz, W * 0.64, 0.18, L * 0.26, '#2d3438', 'darkglass', yaw);
        const mh = L * 1.35, [mx, my, mz] = C(0, 0.9, L * 0.12); b.cyl(mx, my, mz, 0.06, mh, '#c9ccce', 'chrome', 6);
        const [bx0, by0, bz0] = C(0, 2.0, L * 0.12), [bx1, by1, bz1] = C(0, 2.0, -L * 0.36); b.rod([bx0, by0, bz0], [bx1, by1, bz1], 0.05, '#c9ccce', 'chrome', 5);
        b.rod([bx0, by0 + 0.12, bz0], [bx1, by1 + 0.12, bz1], 0.16, ['#1d4f8a', '#2b6f8f', '#1f3b5e'][Math.floor(r() * 3)], 'fabric', 6); // sail cover
        const [fx, fy, fz] = C(0, 0.85, L * 0.5); b.rod([mx, my + mh, mz], [fx, fy, fz], 0.012, '#9aa0a4', 'steel', 3); // forestay
        const [sx, sy, sz] = C(0, 0.9, -L * 0.5); b.rod([mx, my + mh, mz], [sx, sy, sz], 0.012, '#9aa0a4', 'steel', 3);
        return { light: [mx, my + mh + 0.1, mz] };
    }
    const L = 7 + r() * 5, W = L * 0.36;
    b.add(hullGeo(L, W, 0.95, 0.5), 'paint', M(x, y, z, 0, yaw), r() < 0.8 ? '#f5f5f2' : '#e9e3d6');
    b.add(hullGeo(L * 0.995, W * 1.01, 0.16, 0.02), 'paint', M(x, y + 0.12, z, 0, yaw), ['#1f3b5e', '#7a1f22', '#2b2f33'][Math.floor(r() * 3)]);
    const [cx, cy, cz] = C(0, 0.95, -L * 0.05); b.box(cx, cy, cz, W * 0.7, 1.1, L * 0.38, '#f2f2ef', 'paint', yaw);
    const [gx, gy, gz] = C(0, 1.4, L * 0.02); b.box(gx, gy, gz, W * 0.72, 0.45, L * 0.3, '#22292e', 'darkglass', yaw);
    if (L > 9.5) { const [fx, fy, fz] = C(0, 2.05, -L * 0.1); b.box(fx, fy, fz, W * 0.6, 0.12, L * 0.24, '#ece9e2', 'paint', yaw); b.rod(C(-W * 0.28, 2.17, -L * 0.2), C(-W * 0.28, 2.9, -L * 0.15), 0.025, '#c9ccce', 'chrome', 4); }
    const [ax, ay, az] = C(0, 2.3, -L * 0.15); b.rod([ax, ay - 0.25, az], [ax, ay + 0.5, az], 0.03, '#c9ccce', 'chrome', 4);
    return { light: [ax, ay + 0.55, az] };
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
    env: { fogFar: 9000, ambientCity: 0.15, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-meydenbauer'), r = rng(69);
        const area = (id) => d.areas.find((a) => a.id === id)?.poly, way = (id) => d.ways.find((w) => w.id === id)?.pts, bld = (id) => d.buildings.find((x) => x.id === id)?.poly;
        // ---------------------------------------------------------------- lake + shoreline (OSM Lake Washington outline, not the 20 m DEM)
        const lakePoly = area('r2793848');
        const SB = { x0: -780, z0: -760, x1: 720, z1: 700 }; // the whole terrain (inner + outer apron): no clamped DEM hills poking out of the lake
        const F = shoreField(lakePoly, SB, 4), sdf = F.sample;
        const beachPoly = area('w688203354') || [];
        const bb = polyBox(beachPoly);
        const inBeach = (x, z) => x > bb.x0 - 6 && x < bb.x1 + 6 && z > bb.z0 - 6 && z < bb.z1 + 6 && inPoly(x, z, beachPoly);
        g.mod((x, z, h) => {
            const s = sdf(x, z);
            if (s > 0) return Math.min(h, LAKE_Y - Math.min(4.2, 0.28 + s * (inBeach(x, z) || s < 25 ? 0.07 : 0.12)));
            const land = -s;
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
        if (beachPoly.length) { P.poly(beachPoly, '#ad9f86', 'dirt'); P.custom((x, T, k, isMask) => { if (isMask) return; x.strokeStyle = 'rgba(92,84,70,0.55)'; x.lineWidth = 3 * k; x.beginPath(); lakePoly.forEach(([px, pz], i) => { const [a, c] = T(px, pz); if (i) x.lineTo(a, c); else x.moveTo(a, c); }); x.stroke(); }); }
        const prom = [way('w841411877'), way('w840902369'), way('w840902368'), way('w840902371'), way('w841411883'), way('w840902373')].filter(Boolean);
        for (const pts of prom) P.line(pts, 4.6, '#c4c0b6', 'slab');
        // ---------------------------------------------------------------- crescent pier (OSM w688415225 centreline, w687934817 deck outline)
        for (const id of ['w688415225', 'w687934817']) ctx.skipWays.add(id);
        const arc = [...(way('w688415225') || [[-59, 44], [-25, 62], [7, 61], [30, 47], [48, 16]])].reverse(); // root (east, on the beach) → tip (west)
        const arcL = polylineLength(arc), Q = (s) => alongPolyline(arc, clamp(s, 0, arcL));
        const root = Q(0), rootY = Math.max(DECK + 0.05, g.heightAt(root.x, root.z) + 0.02);
        const deckY = (s) => lerp(rootY, DECK, smooth(0, 16, s));
        const b = new GeoBatch(), W = 4.4, step = 1.5, ns = Math.ceil(arcL / step);
        const L = [], R = [], Lh = [], Rh = [];
        for (let i = 0; i <= ns; i++) {
            const s = Math.min(arcL, i * step), a = Q(s), a2 = Q(Math.min(arcL, s + 0.5)), a1 = Q(Math.max(0, s - 0.5));
            const tx = a2.x - a1.x, tz = a2.z - a1.z, tl = Math.hypot(tx, tz) || 1, nx = tz / tl, nz = -tx / tl, y = deckY(s);
            L.push([a.x + nx * W / 2, y, a.z + nz * W / 2]); R.push([a.x - nx * W / 2, y, a.z - nz * W / 2]);
            Lh.push([a.x + nx * (W / 2 - 0.05), y + 1.07, a.z + nz * (W / 2 - 0.05)]); Rh.push([a.x - nx * (W / 2 - 0.05), y + 1.07, a.z - nz * (W / 2 - 0.05)]);
        }
        for (let i = 0; i < ns; i++) {
            const tint = i % 2 ? '#b8b6af' : '#c1bfb8', l0 = L[i], l1 = L[i + 1], r0 = R[i], r1 = R[i + 1];
            b.quad(r0, r1, l1, l0, tint, 'concrete');                                                                       // deck panel
            const dn = (p) => [p[0], p[1] - 0.42, p[2]];
            b.quad(dn(l0), l0, l1, dn(l1), '#8e8c86', 'concrete'); b.quad(dn(r1), r1, r0, dn(r0), '#8e8c86', 'concrete');  // fascia
            const fl = (p, q, t) => [lerp(p[0], q[0], t), p[1] - 0.42, lerp(p[2], q[2], t)], wl = (p) => [p[0], LAKE_Y - 0.25, p[2]];
            if (deckY(i * step) < DECK + 0.3) { const a = fl(l0, r0, 0.1), c = fl(l1, r1, 0.1), e = fl(l0, r0, 0.9), f = fl(l1, r1, 0.9); b.quad(wl(a), a, c, wl(c), '#2a2c2d', 'rubber'); b.quad(wl(f), f, e, wl(e), '#2a2c2d', 'rubber'); } // black floats at the waterline
            const mx = (l0[0] + r1[0]) / 2, mz = (l0[2] + r1[2]) / 2, yaw = Math.atan2(l1[0] - l0[0], l1[2] - l0[2]);
            g.addBox(mx, mz, W / 2, step / 2 + 0.06, -yaw, l0[1] - 2, (l0[1] + l1[1]) / 2);
            for (const [p, q] of [[L, Lh], [R, Rh]]) ctx.collider({ wall: true, ax: p[i][0], az: p[i][2], bx: p[i + 1][0], bz: p[i + 1][2], y0a: p[i][1] - 3, y1a: q[i][1] + 0.05, y0b: p[i + 1][1] - 3, y1b: q[i + 1][1] + 0.05, nx: 0, nz: 1 });
            if (i % 2 === 0) for (const [p, q] of [[L, Lh], [R, Rh]]) b.rod([p[i][0], p[i][1], p[i][2]], [q[i][0], q[i][1], q[i][2]], 0.035, '#aeb4b8', 'steel', 6);   // posts every 3 m
            if (i % 10 === 6 && i < ns - 3) bench(b, mx, l0[1], mz, yaw + Math.PI / 2, '#6b5038', '#2b2f33');
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
        b.cyl(TC.x, DECK - 0.42, TC.z, TR, 0.42, '#bdbbb4', 'concrete', 40); b.cyl(TC.x, LAKE_Y - 0.25, TC.z, TR - 0.4, DECK - 0.42 - LAKE_Y + 0.25, '#2a2c2d', 'rubber', 28);
        g.addPoly(Array.from({ length: 24 }, (_, i) => [TC.x + Math.cos(i / 24 * Math.PI * 2) * TR, TC.z + Math.sin(i / 24 * Math.PI * 2) * TR]), DECK, DECK - 2);
        const ang0 = Math.atan2(-tdz, -tdx), ring = [];
        for (let i = 0; i <= 40; i++) { const a = ang0 + 0.55 + (i / 40) * (Math.PI * 2 - 1.1); ring.push([TC.x + Math.cos(a) * (TR - 0.05), DECK + 1.07, TC.z + Math.sin(a) * (TR - 0.05)]); }
        b.tube(ring, 0.04, '#b9bfc3', 'steel', 6);
        { const m = new THREE.Mesh(stripGeo(lo(ring), ring.map((p) => [p[0], p[1] - 0.06, p[2]]), 1.6), meshM); ctx.add(m); }
        for (let i = 0; i < ring.length - 1; i++) { if (i % 4 === 0) b.rod([ring[i][0], DECK, ring[i][2]], ring[i], 0.035, '#aeb4b8', 'steel', 6); const a = ring[i], c = ring[i + 1]; ctx.collider({ wall: true, ax: a[0], az: a[2], bx: c[0], bz: c[2], y0a: DECK - 3, y1a: DECK + 1.1, y0b: DECK - 3, y1b: DECK + 1.1, nx: 0, nz: 1 }); }
        for (const a of [ang0 + 1.6, ang0 + Math.PI, ang0 + 4.7]) bench(b, TC.x + Math.cos(a) * (TR - 1.3), DECK, TC.z + Math.sin(a) * (TR - 1.3), -a + Math.PI / 2, '#6b5038', '#2b2f33');
        b.cyl(TC.x, DECK, TC.z, 0.28, 4.2, '#e6e8e8', 'paint', 16); b.box(TC.x, DECK + 4.2, TC.z, 0.75, 0.75, 0.75, '#e6e8e8', 'paint'); ctx.circle(TC.x, TC.z, 0.4, 4.6, { y: DECK });
        b.box(TC.x - 0.05, DECK + 4.95, TC.z, 0.08, 0.9, 1.6, '#cfd3d4', 'steel', 0.4, 0, 0.5);    // heron-like wind vane / sculpture fin (stylised)
        ctx.add(b.build('crescent-pier'));
        // the clock faces on the tip post
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, f = glowText('·', 0.62, 0.62, { bg: '#f7f5ee', fg: '#222', night: 0.8 }); f.position.set(TC.x + Math.sin(a) * 0.38, DECK + 4.575, TC.z + Math.cos(a) * 0.38); f.rotation.y = a; ctx.add(f); const hands = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.24), new THREE.MeshBasicMaterial({ color: '#1b1b1b' })); hands.position.set(TC.x + Math.sin(a) * 0.39, DECK + 4.63, TC.z + Math.cos(a) * 0.39); hands.rotation.set(0, a, 0.9); ctx.add(hands); }
        // ---------------------------------------------------------------- pavilion (restrooms / viewing terrace), whaling building, REI boathouse
        const pb = new GeoBatch(), pv = bld('w688203355');
        for (const id of ['w688203355', 'w819159071', 'w698374975', 'w819159076']) ctx.skipBuildings.add(id);
        if (pv) {
            const py = Math.min(...pv.map(([x, z]) => g.heightAt(x, z))); g.flatten(pv, py, 3);
            pb.prism(pv, py - 0.5, py + 3.3, '#8b8479', 'stone');                                              // stacked-stone walls
            const pc = polyBox(pv), pcx = (pc.x0 + pc.x1) / 2, pcz = (pc.z0 + pc.z1) / 2, big = pv.map(([x, z]) => [pcx + (x - pcx) * 1.3, pcz + (z - pcz) * 1.22]);
            pb.prism(big, py + 3.3, py + 3.38, '#a0754e', 'wood', { bottom: true });                        // cedar soffit
            pb.prism(big, py + 3.38, py + 3.85, '#2f3336', 'metal');                                         // dark standing-seam roof, deep overhang
            for (let i = 0; i < pv.length; i++) { const [ax, az] = pv[i], [qx, qz] = pv[(i + 1) % pv.length], Le = Math.hypot(qx - ax, qz - az); if (Le < 3.5) continue; const ya = Math.atan2(qx - ax, qz - az), ox = -Math.cos(ya) * 0.08, oz = Math.sin(ya) * 0.08; // clerestory glazing + cedar slat panels
                for (let t = 1; t < Le - 0.8; t += 2.2) { const px = ax + (qx - ax) * (t + 0.6) / Le, pz = az + (qz - az) * (t + 0.6) / Le; pb.box(px, py + 2.35, pz, 1.5, 0.7, 0.1, '#2b3236', 'darkglass', ya + Math.PI / 2); } }
            for (let i = 0; i < pv.length; i += 3) { const [x, z] = pv[i]; pb.box(x, py, z, 0.18, 3.3, 0.18, '#5b3d2a', 'wood'); }
            ctx.poly(pv);
            const bx = polyBox(pv), sx = (bx.x0 + bx.x1) / 2, sz = bx.z0 - 0.3;
            const sg = glowText('MEYDENBAUER BAY PARK', 4.2, 0.42, { fg: '#f0ece2', bg: '#2a3a40', font: (q) => `600 ${q}px Georgia, serif`, night: 0.9 }); sg.position.set(sx, py + 2.75, sz); sg.rotation.y = Math.PI; ctx.add(sg);
        }
        const wh = bld('w819159071');
        if (wh) { // historic whaling building on piles over the water (2 storeys, gabled)
            const bx = polyBox(wh), cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2, base = DECK + 0.4;
            const m0 = [(wh[0][0] + wh[1][0]) / 2, (wh[0][1] + wh[1][1]) / 2], m1 = [(wh[3][0] + wh[4][0]) / 2, (wh[3][1] + wh[4][1]) / 2], yaw = Math.atan2(m1[0] - m0[0], m1[1] - m0[1]);
            const Lw0 = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), Ww0 = Math.hypot(wh[1][0] - wh[0][0], wh[1][1] - wh[0][1]);
            pb.prism(wh, LAKE_Y - 0.5, base, '#4b4038', 'wood');
            for (const [x, z] of wh) pb.cyl(x, LAKE_Y - 1, z, 0.2, base - LAKE_Y + 1, '#3d342d', 'wood', 8);
            const inner = wh.map(([x, z]) => [cx + (x - cx) * 0.92, cz + (z - cz) * 0.92]);
            pb.prism(inner, base, base + 6.2, '#e9e6de', 'paint');
            for (let fl = 0; fl < 2; fl++) for (let i = 0; i < inner.length; i++) { const [ax, az] = inner[i], [qx, qz] = inner[(i + 1) % inner.length], Lw = Math.hypot(qx - ax, qz - az); if (Lw < 4) continue; const ya = Math.atan2(qx - ax, qz - az), ox = Math.cos(ya) * 0.06, oz = -Math.sin(ya) * 0.06; for (let t = 1.6; t < Lw - 1; t += 2.6) { const px = ax + (qx - ax) * t / Lw, pz = az + (qz - az) * t / Lw; pb.box(px - ox, base + 1.1 + fl * 3, pz - oz, 1.0, 1.4, 0.12, '#2c3236', 'darkglass', ya + Math.PI / 2); } }
            gableRoof(pb, cx, base + 6.2, cz, yaw, Lw0 * 0.92, Ww0 * 0.92, 2.6, '#4a4e52', { gable: '#e9e6de' });
            ctx.poly(wh);
        }
        const rei = bld('w698374975');
        if (rei) { // red boathouse on the marina dock
            const bx = polyBox(rei), cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2, base = LAKE_Y + 0.55;
            const e0 = rei[0], e1 = rei[1], yaw = Math.atan2(e1[0] - e0[0], e1[1] - e0[1]), Lb = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), Wb = Math.hypot(rei[2][0] - e1[0], rei[2][1] - e1[1]);
            pb.prism(rei, LAKE_Y - 0.3, base, '#5a4a3c', 'wood');
            const inner = rei.map(([x, z]) => [cx + (x - cx) * 0.94, cz + (z - cz) * 0.94]);
            pb.prism(inner, base, base + 3.6, '#a8322b', 'paint');
            gableRoof(pb, cx, base + 3.6, cz, yaw, Lb * 0.94, Wb * 0.94, 2.0, '#5c6064', { gable: '#a8322b' });
            const s = glowText('BOATHOUSE · KAYAKS · SUP', 4.4, 0.45, { fg: '#ffffff', bg: '#2f2f2f', night: 1 }); s.position.set(e0[0] + (e1[0] - e0[0]) * 0.5 - Math.cos(yaw) * (Wb / 2 + 0.05) * 0, base + 2.9, e0[1] + (e1[1] - e0[1]) * 0.5); s.rotation.y = yaw - Math.PI / 2; ctx.add(s);
            ctx.poly(rei);
        }
        // marina docks (OSM w819169611) + moored boats in the slips
        const dock = area('w819169611'), boats = new GeoBatch(), anchorLights = [];
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
                    if (inPoly(x, z, dock) || sdf(x, z) < 3 || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 4.6)) continue;
                    let clear = true; for (let q = -4; q <= 4; q += 2) { const px = x + tx * q, pz = z + tz * q; if (inPoly(px, pz, dock)) { clear = false; break; } } if (!clear) continue;
                    if (r() < 0.18) continue;
                    placed.push([x, z]); const res = boat(boats, x, LAKE_Y, z, Math.atan2(tx, tz) + (r() < 0.5 ? Math.PI : 0), r() < 0.55 ? 'sail' : 'motor', r); anchorLights.push(res.light);
                    ctx.circle(x, z, 1.6, 3);
                }
            }
        }
        // a few boats on mooring buoys out in the bay
        for (const [x, z, k] of [[-120, 150, 'sail'], [-170, 95, 'sail'], [-60, 175, 'motor'], [-220, 160, 'sail']]) if (sdf(x, z) > 8) { const res = boat(boats, x, LAKE_Y, z, r() * 6.28, k, r); anchorLights.push(res.light); }
        ctx.add(boats.build('marina-boats'));
        ctx.add(pb.build('meydenbauer-buildings'));
        if (anchorLights.length) { const al = new GeoBatch(); for (const [x, y, z] of anchorLights) al.sphere(x, y, z, 0.07, 0.07, 0.07, '#ffffff', 'paint', 6, 4); ctx.add(al.build('anchor-lights', { matOverrides: { paint: nightLit('#fff4dc', 3, { base: '#dddddd', name: 'anchor-lights' }) } })); }
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
        for (const [x, z, a] of [[-18, -26, 0.3], [24, -18, 1.1], [-26, -33, 2.1]]) { const y = g.heightAt(x, z); fb.rod([x - Math.cos(a) * 2.2, y + 0.25, z - Math.sin(a) * 2.2], [x + Math.cos(a) * 2.2, y + 0.3, z + Math.sin(a) * 2.2], 0.28, '#8d7a64', 'wood', 8, 0.24); ctx.box(x, z, 2.2, 0.3, -a, { prop: true, h: 0.55 }); }
        // ---------------------------------------------------------------- rockeries (OSM retaining walls) + boulders along the promenade
        const rk = new GeoBatch();
        for (const a of d.areas) if (a.barrier === 'retaining_wall') { boulderWall(rk, a.poly, (x, z) => g.heightAt(x, z) - 0.25, { h: 1.6, seed: a.poly.length * 13 }); for (let i = 1; i < a.poly.length; i++) { const [ax, az] = a.poly[i - 1], [qx, qz] = a.poly[i]; ctx.collider({ wall: true, ax, az, bx: qx, bz: qz, y0a: g.heightAt(ax, az) - 3, y1a: g.heightAt(ax, az) + 0.9, y0b: g.heightAt(qx, qz) - 3, y1b: g.heightAt(qx, qz) + 0.9, nx: 0, nz: 1 }); } }
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
            for (let i = 0; i < 24; i++) { const t0 = i / 24, t1 = (i + 1) / 24, p0 = [cx + (a1[0] - a0[0]) * t0, cz + (a1[1] - a0[1]) * t0], p1 = [cx + (a1[0] - a0[0]) * t1, cz + (a1[1] - a0[1]) * t1]; br.box((p0[0] + p1[0]) / 2, (yAt(t0) + yAt(t1)) / 2 - 1.4, (p0[1] + p1[1]) / 2, 13.5, 1.4, Lb / 24 + 0.05, '#a9a59c', 'concrete', yaw); }
            for (const s of [-1, 1]) for (let t = 0; t <= 1.001; t += 1 / 46) { const x = cx + (a1[0] - a0[0]) * t + nx * 6.6 * s, z = cz + (a1[1] - a0[1]) * t + nz * 6.6 * s, y = yAt(t); br.box(x, y, z, 0.18, 0.75, 0.18, '#c9c5bb', 'concrete', yaw); if (t < 0.99) { const x2 = cx + (a1[0] - a0[0]) * (t + 1 / 46) + nx * 6.6 * s, z2 = cz + (a1[1] - a0[1]) * (t + 1 / 46) + nz * 6.6 * s; br.box((x + x2) / 2, y + 0.75, (z + z2) / 2, 0.32, 0.22, Lb / 46 + 0.02, '#cdc9bf', 'concrete', yaw); } }
            for (const t of [0.3, 0.7]) { const x = cx + (a1[0] - a0[0]) * t, z = cz + (a1[1] - a0[1]) * t, y = yAt(t), gy = g.heightAt(x, z); if (y - gy > 3) for (const s of [-1, 1]) br.rod([x + nx * 4 * s, gy - 1, z + nz * 4 * s], [x + nx * 4 * s + Math.sin(yaw) * (t < 0.5 ? 3 : -3), y - 1.4, z + nz * 4 * s + Math.cos(yaw) * (t < 0.5 ? 3 : -3)], 0.7, '#9e9a91', 'concrete', 8); }
            ctx.add(br.build('lwb-bridge'));
        }
        // ---------------------------------------------------------------- OSM backdrop (houses, condos, lawns, paths), trees, lamps
        ctx.terrainOpts = { bg: '#55703a', innerPx: 2048, skirtY: LAKE_Y - 0.4, skirtColor: '#3a4f39' };
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.7, density: 1 / 45 }, style: (bd) => (/detached|house/.test(bd.k || '') ? 'house' : undefined) });
        for (const a of d.areas) if (a.landuse === 'shrubs') { const B = polyBox(a.poly); for (let i = 0; i < Math.min(14, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 12); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) ctx.trees.push({ x, z, kind: 'shrub', s: 0.45 + r() * 0.35, c: ['#56703a', '#6b4a3a', '#4c6a3c', '#7a6a3a'][i % 4] }); } }
        // Douglas firs + cedars on the ravine slopes behind the beach (the wooded edge in every photo)
        for (let i = 0; i < 320; i++) { const x = -190 + r() * 330, z = -230 + r() * 210; if (sdf(x, z) > -6 || g.heightAt(x, z) < 1.5 || d.buildings.some((bd) => !bd.part && Math.abs(bd.poly[0][0] - x) < 25 && Math.abs(bd.poly[0][1] - z) < 25 && inPoly(x, z, bd.poly))) continue; if (d.ways.some((w) => w.pts.length > 1 && distPolyline(x, z, w.pts).d < 3.5)) continue; if (d.areas.some((a) => (a.landuse === 'grass' || a.leisure === 'playground' || a.natural === 'beach') && inPoly(x, z, a.poly))) continue; ctx.trees.push({ x, z, kind: r() < 0.72 ? 'con' : 'broad', s: 1.0 + r() * 0.7 }); }
        ctx.lampOpts = { style: 'cobra', color: '#b9bec1', h: 7.2 };
        for (const pts of prom) { const Lp = polylineLength(pts); for (let s = 6; s < Lp; s += 24) { const p = alongPolyline(pts, s), p2 = alongPolyline(pts, Math.min(Lp, s + 1)), tx = p2.x - p.x, tz = p2.z - p.z, tl = Math.hypot(tx, tz) || 1; ctx.lampPoints.push({ x: p.x + tz / tl * 2.7, z: p.z - tx / tl * 2.7, rot: Math.atan2(-tz, tx) }); } }
        // Seattle on the horizon (≈ 9 km west) + Olympics, Rainier on clear days
        seattleBackdrop(ctx, { baseY: LAKE_Y - 0.4, clear: 3000, hazeK: 0.45, olympics: true, rainier: true, eyeY: 1.6 });
        // ---------------------------------------------------------------- activities (note 57)
        // 1) walk to the end of the crescent
        let pierDone = false;
        ctx.onUpdate((dt, s, pl) => { if (pierDone || !pl) return; if (Math.hypot(pl.x - TC.x, pl.z - TC.z) < TR - 0.5 && pl.y > DECK - 0.5) { pierDone = true; emitActivity(s, 'bel-meydenbauer', 'pier-end', '🌊 End of the crescent', '420 ft out over Meydenbauer Bay — Seattle is 9 km west across Lake Washington.'); } });
        // 2) kayak round the bay (summer rental at the boathouse dock)
        const kay = new GeoBatch(); kay.add(hullGeo(4.3, 0.66, 0.32, 0.12), 'plastic', null, '#f0a21c'); kay.box(0, 0.28, -0.3, 0.42, 0.06, 0.9, '#1f1f1f', 'rubber'); kay.rod([-1.1, 0.55, 0.2], [1.1, 0.75, 0.2], 0.02, '#333', 'metal', 4); kay.box(-1.1, 0.5, 0.2, 0.05, 0.2, 0.32, '#f2c230', 'plastic', 0, 0, 0.35); kay.box(1.1, 0.72, 0.2, 0.05, 0.2, 0.32, '#f2c230', 'plastic', 0, 0, -0.35);
        const kayak = kay.build('kayak'); kayak.visible = false; ctx.add(kayak);
        const put = { x: 46, z: 72 }, launch = { x: 66, z: 53 };
        const loop = [[46, 72], [22, 80], [-25, 81], [-70, 70], [-92, 42], [-84, 80], [-30, 91], [20, 88], [46, 72]];
        const loopL = polylineLength(loop); let ride = null;
        ctx.onUpdate((dt, s) => {
            if (!ride) return;
            ride.t += dt; const sp2 = Math.min(loopL, ride.t * 2.1), p = alongPolyline(loop, sp2), p2 = alongPolyline(loop, Math.min(loopL, sp2 + 1.5));
            const yaw = Math.atan2(p2.x - p.x, p2.z - p.z), bob = Math.sin(ride.t * 1.7) * 0.04;
            kayak.position.set(p.x, LAKE_Y + bob, p.z); kayak.rotation.set(Math.sin(ride.t * 2.4) * 0.03, yaw, Math.sin(ride.t * 1.3) * 0.04);
            const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.look -= lk.dx * 0.0024; ride.pitch = clamp(ride.pitch - lk.dy * 0.0024, -0.9, 0.9);
            s.ctl.rig.position.set(p.x, LAKE_Y + 0.95 + bob, p.z); s.ctl.rig.rotation.set(ride.pitch, yaw + Math.PI + ride.look, 0, 'YXZ');
            if (sp2 >= loopL - 0.1) { kayak.visible = false; s.ctl.active = true; s.ctl.teleport(ride.back.x, ride.back.z, ride.back.heading); ride = null; emitActivity(s, 'bel-meydenbauer', 'kayak', '🛶 Round the bay by kayak', 'Past the crescent pier and the marina — Meydenbauer Bay is a non-motorised launch site; rentals run in summer.'); }
        });
        ctx.interactables.push({ kind: 'kayak', x: launch.x, z: launch.z, r: 4.5, label: 'Rent a kayak (paddle round the bay)', cond: () => !ride,
            use: (s) => { if (!inWindow(localMD(s), [5, 15], [9, 30])) { s.ui.toast('🛶 Kayak rentals are seasonal', 'The boathouse rents kayaks and paddleboards from late spring to September — come back in summer.'); return; } const p = s.ctl.position; ride = { t: 0, look: 0, pitch: -0.05, back: { x: p.x, z: p.z, heading: s.ctl.heading } }; kayak.visible = true; s.ctl.active = false; s.sound.play('splat', 0.3); } });
        // 3) skip stones from the beach (wind-dependent)
        const beachC = beachPoly.length ? { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 } : { x: 10, z: -15 };
        ctx.interactables.push({ kind: 'skip', x: beachC.x - 4, z: beachC.z + 2, r: 14, label: 'Skip a stone', use: (s) => { const w = s.r3d.weather?.windKmh ?? 8, n = Math.max(1, Math.round(3 + Math.random() * 6 - w / 10)); s.sound.play('splat', 0.4); s.ui.toast('🪨 ' + '•'.repeat(n), `${n} skip${n > 1 ? 's' : ''}${n >= 7 ? ' — impressive!' : ''}`); } });
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
                { x: beachC.x - 6, z: beachC.z - 2, r: 9, n: 7, act: 'sit', look: [-300, 200], personas: ['local', 'kid', 'tech'] },
                { x: TC.x, z: TC.z, r: 2.2, n: 4, act: 'photo', look: [-2000, 300], y: DECK, personas: ['photographer', 'tourist_us', 'tourist_in'] },
                { x: launch.x + 1.5, z: launch.z + 1, r: 0.4, n: 1, act: 'watch', look: [put.x, put.z], personas: ['staff'] },
            ],
        };
        ctx.sound('water', beachC.x, beachC.z + 10, 120, 1.3); ctx.sound('gulls', -40, 60, 220, 1); ctx.sound('birds', 60, -120, 160, 1);
        { const sx = 22, sz = -21, t = Q(arcL * 0.45); ctx.spawns['bel-meydenbauer'] = { x: sx, z: sz, heading: Math.atan2(-(t.x - sx), -(t.z - sz)) }; } // on the beach promenade: beach, crescent pier and the bay ahead
        void M; void headingFromBearing;
    },
};
