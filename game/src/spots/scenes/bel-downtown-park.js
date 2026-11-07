// ============================================================================
//  Bellevue Downtown Park (Beckley-Myers, 1987; canal ring completed 2017) —
//  rebuilt round 5 (owner note 68) on the OSM survey: the canal ring (Ø ≈ 198 m,
//  4.6 m wide) stepping down over ~45 weirs from the north gateway both ways to
//  the south-west, where a 73 m (240 ft) waterfall spills from the upper pool
//  into the quarter-circle reflecting pool; pink-granite coping, obelisks with
//  globe lamps, teak benches, the crushed-gravel promenade with its double row
//  of shade trees, the 10-acre meadow with the 1926 WWI memorial elms, the NE
//  gateway plaza with Piloti (Marc Fornes / THEVERYMANY, 2023, modelled from
//  descriptions, credited), Inspiration Playground, the lower plaza with the
//  seasonal ice-rink tent (late Nov – early Jan), and the edge streets
//  (Bellevue Way, NE 4th, 100th Ave, NE 1st) from OSM with Lincoln Square and
//  the downtown towers rising behind.
//  Activities (note 57): walk the half-mile loop (timer + steps); toss a coin.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, headingFromBearing, smooth, lerp, clamp, inPoly, polyBox, canvas, canvasTexture } from '../kit.js';
import { meshSDF, sdCapsule, sdEllipsoid, smin, smax, noise3 } from '../sdf.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';
import { makeWaterMaterial } from '../../water.js';
import { emitActivity, seasonal, waterPoly, nightLit, glowText, placeLitLandmark, skipNearLandmark, fairyLights, treeLightPoints, gableRoof } from './bel-common.js';

const C = { x: -61.3, z: 89.2 }, R = 99.15, HW = 2.3; // canal centre circle (fitted to the 45 OSM weirs), half-width
const TOP = 0.55, STEP = 0.105;                       // canal water level at the north gateway, drop per weir
const POOL_Y = -4.35, UPPER_Y = -1.95;                 // reflecting pool, upper pool above the waterfall
const TAU = Math.PI * 2;
const ang = (x, z) => Math.atan2(z - C.z, x - C.x);
const A_N = ang(-63, -10), A_W_END = ang(-158, 112), A_E_END = ang(-82, 186); // north high point, west + east branch ends

function piloti(ctx, x, y, z) {
    const sdf = (px, py, pz) => {
        let d = sdEllipsoid(px, py, pz, 0, 6.0, 0, 3.6, 1.3, 3.2);
        d = smax(d, -sdEllipsoid(px, py, pz, 0, 5.3, 0, 3.3, 1.1, 2.9), 0.15);
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; d = smin(d, sdCapsule(px, py, pz, Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2, Math.cos(a) * 1.2, 5.4, Math.sin(a) * 1.0, 0.35, 0.9), 0.8); }
        return d + 0.04 * noise3(px * 3, py * 3, pz * 3);
    };
    const geo = meshSDF(sdf, { min: [-4.4, -0.2, -4], max: [4.4, 7.6, 4], cell: 0.1, ao: 0.4,
        color: (px, py, pz, nx, ny, nz, ao, o) => { const hex = Math.abs(Math.sin(px * 6.0) * Math.sin(pz * 6.0 + py * 4.0)); o.set(hex > 0.92 ? '#c9ced2' : '#f4f5f6'); return o.multiplyScalar(0.75 + 0.25 * ao); } });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.castShadow = true; m.name = 'piloti'; ctx.add(m);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; ctx.circle(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, 0.6, 5); }
}
/** arc distance (rad) from the north high point along a branch: dir +1 east branch, −1 west */
const along = (a, dir) => { let d = (a - A_N) * dir; d = ((d % TAU) + TAU) % TAU; return d; };

export default {
    env: { fogFar: 5000, ambientCity: 0.3, groundAlbedo: 0.12 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-downtown-park'), r = rng(68);
        const area = (id) => d.areas.find((a) => a.id === id)?.poly, way = (id) => d.ways.find((w) => w.id === id)?.pts;
        // ---------------------------------------------------------------- canal levels from the OSM weirs
        const weirs = d.areas.filter((a) => a.waterway === 'weir' && a.poly.length === 3).map((a) => ({ x: a.poly[1][0], z: a.poly[1][1], a: ang(a.poly[1][0], a.poly[1][1]) }));
        const westL = along(A_W_END, -1), eastL = along(A_E_END, 1);
        const branch = (a) => { const w = along(a, -1), e = along(a, 1); return w <= westL && (w < e || e > eastL) ? { dir: -1, s: w } : e <= eastL ? { dir: 1, s: e } : null; };
        const W = { '-1': weirs.map((w) => along(w.a, -1)).filter((s) => s <= westL + 0.01).sort((p, q) => p - q), '1': weirs.map((w) => along(w.a, 1)).filter((s) => s <= eastL + 0.01).sort((p, q) => p - q) };
        const level = (a) => { const b = branch(a); if (!b) return null; let n = 0; for (const s of W[b.dir]) if (s < b.s) n++; return TOP - n * STEP; };
        const bankY = (a) => (level(a) ?? POOL_Y + 0.05) + 0.45; // the SW sector (reflecting pool) promenade sits just above the pool
        // ---------------------------------------------------------------- terrain: meadow graded to the banks, canal bed, lower basin
        const pool = area('w1326469177') || [], upper = area('w1326469168') || [], lowerPlaza = way('w1326475313') || [];
        const pb = polyBox(pool.length ? pool : [[0, 0], [1, 1]]);
        g.mod((x, z, h) => {
            const dx = x - C.x, dz = z - C.z, rr = Math.hypot(dx, dz); if (rr > R + 40) return h;
            const a = Math.atan2(dz, dx), lv = level(a), by = bankY(a);
            if (x > pb.x0 - 2 && x < pb.x1 + 2 && z > pb.z0 - 2 && z < pb.z1 + 2 && inPoly(x, z, pool)) return POOL_Y - 0.55;
            if (upper.length && inPoly(x, z, upper)) return UPPER_Y - 0.5;
            if (lv !== null && Math.abs(rr - R) < HW) return lv - 0.55;                                    // canal bed
            if (Math.abs(rr - R) < HW + 1.0) return by;                                                    // coping
            const k = rr < R ? smooth(R - 30, R - HW - 1, rr) : smooth(R + 26, R + HW + 1, rr);              // meadow / promenade graded to the bank level
            const inner = rr < R ? lerp(-1.2 - (dz / R) * 0.9, by, k) : lerp(h, by, k);
            return lv === null && rr < R && z > 110 ? h : inner;                                           // the SW sector keeps the terrain (pool / lower plaza)
        });
        if (lowerPlaza.length) g.flatten(lowerPlaza, POOL_Y + 0.45, 4);
        g.flatten([[-98, 125.5], [-86, 125.5], [-86, 138], [-98, 138]], POOL_Y + 0.45, 3); // viewing apron at the waterfall's east end (postcard)
        // ---------------------------------------------------------------- water: canal pieces between weirs, upper pool, reflecting pool
        const canalMat = makeWaterMaterial({ deep: '#2a4744', shallow: '#4d6a62', ripple: 0.5, wave: 0.25, flow: [0.15, 0.05], envIntensity: 1.2 });
        canalMat.userData.hasShore = true;
        const cpos = [], csh = [], cidx = [], wb = new GeoBatch();
        const cuts = [...new Set([...W['-1'].map((s) => A_N - s), ...W['1'].map((s) => A_N + s)])];
        const segs = []; // [a0, a1] arcs in angle order on each branch
        for (const dir of [-1, 1]) { const list = [0, ...W[dir], dir < 0 ? westL : eastL]; for (let i = 0; i + 1 < list.length; i++) { if (list[i + 1] - list[i] < 1e-3) continue; segs.push({ a0: A_N + dir * list[i], a1: A_N + dir * list[i + 1], y: TOP - i * STEP }); } }
        for (const sgm of segs) {
            const n = Math.max(2, Math.ceil(Math.abs(sgm.a1 - sgm.a0) * R / 2)), base = cpos.length / 3;
            for (let i = 0; i <= n; i++) { const a = lerp(sgm.a0, sgm.a1, i / n); for (const [rr, sh] of [[R - HW, 0], [R, HW], [R + HW, 0]]) { cpos.push(C.x + Math.cos(a) * rr, sgm.y, C.z + Math.sin(a) * rr); csh.push(sh); } }
            const flip = sgm.a1 < sgm.a0;
            for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const p = base + i * 3 + j, q = p + 3; if (flip) cidx.push(p, p + 1, q + 1, p, q + 1, q); else cidx.push(p, q, q + 1, p, q + 1, p + 1); }
        }
        { const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3)); const nrm = new Float32Array(cpos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; cg.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); cg.setAttribute('aShore', new THREE.Float32BufferAttribute(csh, 1)); cg.setIndex(cidx); cg.computeBoundingSphere(); const m = new THREE.Mesh(cg, canalMat); m.name = 'canal'; m.receiveShadow = true; ctx.add(m); }
        // weir lips (granite sills + white spill)
        const spillM = nightLit('#d8ecf0', 0.05, { base: '#eaf4f6', name: 'weir-spill', roughness: 0.2 });
        for (const c of cuts) { const lv = level(c + 0.002) ?? TOP, lv2 = level(c - 0.002) ?? TOP, hi = Math.max(lv, lv2), x = C.x + Math.cos(c) * R, z = C.z + Math.sin(c) * R; wb.box(x, hi - 0.25, z, 2 * HW + 0.2, 0.3, 0.35, '#8f7d76', 'stone', -c); const sp2 = new THREE.Mesh(new THREE.BoxGeometry(2 * HW, Math.max(0.06, Math.abs(lv - lv2)) + 0.04, 0.08), spillM); sp2.position.set(x, (lv + lv2) / 2, z); sp2.rotation.y = -c; ctx.add(sp2); }
        if (upper.length) waterPoly(ctx, upper, UPPER_Y, { deep: '#2a4744', shallow: '#4d6a62', cell: 1.5, name: 'upper-pool' });
        if (pool.length) waterPoly(ctx, pool, POOL_Y, { deep: '#1f3a3b', shallow: '#3f5c55', cell: 2, ripple: 0.4, wave: 0.2, envIntensity: 1.4, name: 'reflecting-pool' });
        // granite coping both sides of the canal + around the pools
        const COP = '#b8a197';
        for (let i = 0; i < 360; i++) { const a = i / 360 * TAU, lv = level(a); if (lv === null) continue; const y = bankY(a); for (const rr of [R - HW - 0.35, R + HW + 0.35]) wb.box(C.x + Math.cos(a) * rr, y - 0.35, C.z + Math.sin(a) * rr, 0.7, 0.38, rr * TAU / 360 + 0.04, COP, 'stone', -a); }
        for (const poly of [pool, upper]) for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [qx, qz] = poly[(i + 1) % poly.length], Lq = Math.hypot(qx - ax, qz - az); if (Lq < 0.5) continue; const yy = poly === pool ? POOL_Y + 0.35 : UPPER_Y + 0.35; wb.box((ax + qx) / 2, yy - 0.3, (az + qz) / 2, 0.6, 0.38, Lq + 0.3, COP, 'stone', Math.atan2(qx - ax, qz - az)); }
        // walls: no walking into the water (canal edges, pools)
        for (let i = 0; i < 180; i++) { const a0 = i / 180 * TAU, a1 = (i + 1) / 180 * TAU; if (level((a0 + a1) / 2) === null) continue; for (const rr of [R - HW, R + HW]) ctx.collider({ wall: true, ax: C.x + Math.cos(a0) * rr, az: C.z + Math.sin(a0) * rr, bx: C.x + Math.cos(a1) * rr, bz: C.z + Math.sin(a1) * rr, y0a: -9, y1a: bankY(a0) + 0.3, y0b: -9, y1b: bankY(a1) + 0.3, nx: 0, nz: 1, intended: true }); } // canal edge (granite coping, water below)
        g.waterY = null;
        for (const poly of [pool, upper]) if (poly.length) ctx.poly(poly, { h: 0.6, intended: true });
        // canal footbridges (OSM bridge=yes footways across the ring): flat granite slabs at bank level
        for (const w of d.ways) { if (w.bridge !== 'yes' || w.k !== 'footway' || w.pts.length < 2) continue; const [p0, p1] = [w.pts[0], w.pts[w.pts.length - 1]], mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2; if (Math.abs(Math.hypot(mx - C.x, mz - C.z) - R) > 8) continue; const a = ang(mx, mz), y = bankY(a) + 0.02, L2 = Math.max(7, Math.hypot(p1[0] - p0[0], p1[1] - p0[1])); wb.box(mx, y - 0.35, mz, 3.2, 0.35, L2, '#c8b8ae', 'stone', Math.atan2(p1[0] - p0[0], p1[1] - p0[1])); g.addBox(mx, mz, 1.6, L2 / 2, -Math.atan2(p1[0] - p0[0], p1[1] - p0[1]), y - 2, y); }
        // ---------------------------------------------------------------- the 240-ft waterfall (upper pool → reflecting pool)
        const wfLine = [[-156, 121.2], [-146, 121.2], [-128, 121.2], [-98, 120.6], [-87, 120.4]];
        const fallTex = (() => { const c = canvas(512, 128), x = c.getContext('2d'); x.fillStyle = '#7f9ea3'; x.fillRect(0, 0, 512, 128); for (let i = 0; i < 700; i++) { const w = 1 + Math.random() * 3, y0 = Math.random() * 40; x.fillStyle = Math.random() < 0.6 ? `rgba(255,255,255,${0.35 + Math.random() * 0.55})` : 'rgba(40,70,78,0.45)'; x.fillRect(Math.random() * 512, y0, w, 128 - y0); } const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)'); x.fillStyle = gr; x.fillRect(0, 0, 512, 128); return canvasTexture(c, { repeat: true }); })();
        const fallMat = new THREE.MeshStandardMaterial({ map: fallTex, color: '#ffffff', transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.1, emissive: '#dbe9ec', emissiveMap: fallTex, emissiveIntensity: 0.12, side: THREE.DoubleSide, depthWrite: false });
        fallMat.userData.nightEmissive = 0.22; fallMat.userData.nightGlow = 0.22; fallMat.userData.dayGlow = 0.12; fallTex.repeat.set(18, 1);
        { const pos = [], uv = [], idx = []; let u = 0; for (let i = 0; i < wfLine.length; i++) { const [x, z] = wfLine[i]; if (i) u += Math.hypot(x - wfLine[i - 1][0], z - wfLine[i - 1][1]) / 73; pos.push(x, UPPER_Y + 0.02, z, x, POOL_Y + 0.6, z + 0.9, x, POOL_Y + 0.02, z + 1.6); uv.push(u, 1, u, 0.25, u, 0); if (i) { const a = (i - 1) * 3; idx.push(a, a + 3, a + 4, a, a + 4, a + 1, a + 1, a + 4, a + 5, a + 1, a + 5, a + 2); } }
            const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals(); const fall = new THREE.Mesh(fg, fallMat); fall.name = 'waterfall'; fall.renderOrder = 2; ctx.add(fall); }
        for (let i = 1; i < wfLine.length; i++) { const [ax, az] = wfLine[i - 1], [qx, qz] = wfLine[i], Lq = Math.hypot(qx - ax, qz - az); wb.box((ax + qx) / 2, POOL_Y - 0.5, (az + qz) / 2 - 0.3, Lq + 0.1, UPPER_Y - POOL_Y + 0.4, 0.6, '#6f6a66', 'stone', Math.atan2(qx - ax, qz - az) + Math.PI / 2); wb.box((ax + qx) / 2, POOL_Y + 0.01, (az + qz) / 2 + 2.6, Lq, 0.03, 3.2, '#eef5f6', 'paint', Math.atan2(qx - ax, qz - az) + Math.PI / 2); } // dark wall + foam band
        { const mist = new THREE.MeshBasicMaterial({ color: '#f4f9fa', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: true }); const pos = [], idx = []; wfLine.forEach(([x, z], i) => { pos.push(x, POOL_Y + 0.05, z + 2.4, x, POOL_Y + 1.5, z + 1.6); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); } }); const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setIndex(idx); const m = new THREE.Mesh(mg, mist); m.name = 'waterfall-spray'; m.renderOrder = 3; ctx.add(m); ctx.onUpdate((dt, s) => { mist.opacity = 0.26 + 0.08 * Math.sin(s.t * 2.7); }); }
        ctx.onUpdate((dt) => { fallTex.offset.y = (fallTex.offset.y + dt * 1.1) % 1; });
        // ---------------------------------------------------------------- promenade ring (crushed gravel), obelisk lamps, benches, double tree row
        const P = ctx.painter;
        P.custom((x, T, k, isMask) => { x.strokeStyle = isMask ? 'rgb(0,0,120)' : '#c4b49a'; x.lineWidth = 9 * k; x.beginPath(); for (let i = 0; i <= 200; i++) { const a = A_N - westL + (i / 200) * (westL + eastL); const [px, py] = T(C.x + Math.cos(a) * (R + 8.2), C.z + Math.sin(a) * (R + 8.2)); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); });
        P.custom((x, T, k, isMask) => { x.strokeStyle = isMask ? 'rgb(0,255,0)' : COP; x.lineWidth = 1.6 * k; for (const rr of [R - HW - 0.4, R + HW + 0.4]) { x.beginPath(); for (let i = 0; i <= 200; i++) { const a = A_N - westL + (i / 200) * (westL + eastL); const [px, py] = T(C.x + Math.cos(a) * rr, C.z + Math.sin(a) * rr); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); } });
        ctx.lampOpts = { style: 'acorn', color: '#b59a8e', h: 3.6 };
        const ob = new GeoBatch(), globes = [];
        for (let a = A_N - westL + 0.08; a < A_N + eastL - 0.04; a += 0.22) {
            const rr = R + HW + 1.6, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr, y = bankY(a);
            if (d.ways.some((w) => w.bridge === 'yes' && w.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 5))) continue;
            ob.cyl(x, y - 0.1, z, 0.42, 0.5, '#a78d84', 'stone', 4, 1, 0, -a + Math.PI / 4);
            ob.cyl(x, y + 0.4, z, 0.34, 3.0, '#b8a097', 'stone', 4, 0.55, 0, -a + Math.PI / 4);                   // tapered pink-granite obelisk
            ctx.lampPoints.push({ x, z, rot: 0 }); globes.push([x, y + 3.6, z]); ctx.circle(x, z, 0.45, 3.5);
            const ba = a + 0.11, bx = C.x + Math.cos(ba) * rr, bz = C.z + Math.sin(ba) * rr;                         // teak bench facing the canal
            ob.box(bx, y + 0.42, bz, 1.8, 0.07, 0.5, '#9a7a56', 'wood', -ba + Math.PI / 2); ob.box(bx + Math.cos(ba) * 0.25, y + 0.5, bz + Math.sin(ba) * 0.25, 1.8, 0.45, 0.06, '#9a7a56', 'wood', -ba + Math.PI / 2);
            for (const s of [-0.8, 0.8]) ob.box(bx - Math.sin(ba) * s, y, bz + Math.cos(ba) * s, 0.06, 0.45, 0.5, '#7d6246', 'wood', -ba + Math.PI / 2);
            ctx.box(bx, bz, 0.9, 0.3, ba + Math.PI / 2, { prop: true, h: 0.5 });
            if ((a * 100 | 0) % 3 === 0) { const gx = C.x + Math.cos(a - 0.06) * (R + 12.6), gz = C.z + Math.sin(a - 0.06) * (R + 12.6); ob.sphere(gx, bankY(a) + 0.3, gz, 0.32, 0.32, 0.32, '#b49b91', 'stone', 10, 8); ctx.circle(gx, gz, 0.33, 0.6); } // granite ball bollards
        }
        ctx.add(ob.build('promenade-furniture'));
        // double row of shade trees outside the promenade (lindens / planes), skipping gateways and streets
        const gaps = d.ways.filter((w) => ['footway', 'pedestrian', 'steps'].includes(w.k)).flatMap((w) => w.pts);
        for (const rr of [R + 14.5, R + 19.5]) for (let a = A_N - westL - 0.02; a < A_N + eastL + 0.02; a += 9.5 / rr) {
            const x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr;
            if (gaps.some(([px, pz]) => Math.abs(px - x) < 3.2 && Math.abs(pz - z) < 3.2)) continue;
            if (d.buildings.some((b) => !b.part && inPoly(x, z, b.poly)) || d.ways.some((w) => ['primary', 'secondary', 'service', 'residential'].includes(w.k) && w.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 7))) continue;
            ctx.trees.push({ x, z, kind: 'broad', s: 1.05 + r() * 0.15, species: 'linden' });
        }
        // WWI memorial elms (1926) + "Lest We Forget" marker in the meadow
        const mem = sp.structures.find((s) => s.id === 'memorial') || { x: -47, z: 61 };
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; ctx.trees.push({ x: mem.x + Math.cos(a) * 9, z: mem.z + Math.sin(a) * 9, kind: 'broad', s: 1.5 + r() * 0.2, species: 'elm' }); }
        { const mb = new GeoBatch(), y = g.heightAt(mem.x, mem.z); mb.box(mem.x, y, mem.z, 1.4, 0.9, 0.6, '#8d8a84', 'stone', 0.2); ctx.add(mb.build('memorial-stone')); ctx.box(mem.x, mem.z, 0.7, 0.3, -0.2, { prop: true, h: 0.9 }); const t = glowText('LEST WE FORGET · 1926', 1.2, 0.22, { fg: '#2a2a28', bg: '#9a968e', font: (s) => `700 ${s}px Georgia, serif`, night: 0 }); t.position.set(mem.x - Math.sin(0.2) * 0.31, y + 0.62, mem.z - Math.cos(0.2) * 0.31); t.rotation.y = Math.PI + 0.2; ctx.add(t); }
        // ---------------------------------------------------------------- NE gateway: Piloti + DOWNTOWN PARK sign
        const pl = sp.structures.find((s) => s.id === 'piloti') || { x: 70, z: -31 };
        piloti(ctx, pl.x, g.heightAt(pl.x, pl.z), pl.z);
        { const s = glowText('DOWNTOWN PARK', 3.4, 0.5, { fg: '#f1ece0', bg: '#2f4a36', font: (q) => `700 ${q}px Georgia, serif`, night: 0.9 }); const sx = pl.x - 12, sz = pl.z + 10, y = g.heightAt(sx, sz); s.position.set(sx, y + 1.1, sz); s.rotation.y = Math.PI * 0.75; ctx.add(s); const sb = new GeoBatch(); sb.box(sx, y, sz, 3.8, 0.85, 0.35, '#a78d84', 'stone', Math.PI * 0.75); ctx.add(sb.build('gateway-sign')); ctx.box(sx, sz, 1.9, 0.2, -Math.PI * 0.75, { prop: true, h: 1.4 }); }
        // ---------------------------------------------------------------- Inspiration Playground (SW): towers, nets, slides (simplified)
        const pgp = area('w503657594');
        if (pgp) { const pc = polyBox(pgp), x = (pc.x0 + pc.x1) / 2, z = (pc.z0 + pc.z1) / 2, y = g.heightAt(x, z), q = new GeoBatch();
            for (const [dx, dz, h, c] of [[-8, -4, 4.2, '#3b7bb5'], [6, 3, 3.4, '#e2a23a'], [-2, 9, 2.6, '#6aa84f']]) { for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) q.cyl(x + dx + ox, y, z + dz + oz, 0.09, h, '#f1f1ec', 'paint', 8); q.box(x + dx, y + h * 0.55, z + dz, 2.3, 0.12, 2.3, c, 'plastic'); q.cyl(x + dx, y + h, z + dz, 1.7, 0.9, c, 'fabric', 4, 0.05, 0, Math.PI / 4); ctx.box(x + dx, z + dz, 1.2, 1.2, 0, { prop: true, h }); }
            q.box(x - 4, y + 1.2, z - 4, 0.9, 0.08, 4.5, '#d9d9d4', 'chrome', 0, 0.45); q.rod([x + 6, y + 3.4, z + 3], [x - 2, y + 2.6, z + 9], 0.3, '#3a6e9e', 'plastic', 8);
            ctx.add(q.build('inspiration-playground')); }
        // ---------------------------------------------------------------- lower plaza: seasonal ice rink tent (Bellevue Downtown Ice Rink, OSM w1451219368)
        const tent = d.buildings.find((b) => b.id === 'w1451219368'); if (tent) ctx.skipBuildings.add(tent.id);
        const rink = new THREE.Group(); rink.name = 'ice-rink-season';
        if (tent) {
            const tb = polyBox(tent.poly), cx = (tb.x0 + tb.x1) / 2, cz = (tb.z0 + tb.z1) / 2, y = g.heightAt(cx, cz), [e0, e1] = tent.poly, yaw = Math.atan2(e1[0] - e0[0], e1[1] - e0[1]);
            const Lt = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), Wt = Math.hypot(tent.poly[2][0] - e1[0], tent.poly[2][1] - e1[1]), q = new GeoBatch();
            q.prism(tent.poly, y, y + 0.12, '#eef4f8', 'plastic');                                                     // ice
            const inner = tent.poly.map(([x, z]) => [cx + (x - cx) * 0.92, cz + (z - cz) * 0.92]); q.prism(inner, y + 0.12, y + 0.14, '#f6fbff', 'glass');
            for (const [x, z] of tent.poly) q.cyl(x, y, z, 0.12, 4.2, '#d8dadc', 'metal', 8);
            for (let i = 0; i < 4; i++) { const [ax, az] = tent.poly[i], [qx, qz] = tent.poly[(i + 1) % 4], Ls = Math.hypot(qx - ax, qz - az); for (let t = 3; t < Ls; t += 3) q.cyl(ax + (qx - ax) * t / Ls, y, az + (qz - az) * t / Ls, 0.08, 4.2, '#d8dadc', 'metal', 6); q.box((ax + qx) / 2, y, (az + qz) / 2, Ls, 1.1, 0.08, '#ffffff', 'plastic', Math.atan2(qx - ax, qz - az) + Math.PI / 2); }
            gableRoof(q, cx, y + 4.2, cz, yaw, Lt, Wt, 3.2, '#f4f4f2', { key: 'fabric', over: 0.3 });
            rink.add(q.build('ice-rink'));
            const lightsPts = []; for (let i = 0; i < 4; i++) { const [ax, az] = tent.poly[i], [qx, qz] = tent.poly[(i + 1) % 4]; for (let t = 0; t < 1; t += 0.025) lightsPts.push([ax + (qx - ax) * t, y + 4.1 - Math.sin(t * Math.PI * 6) * 0.15, az + (qz - az) * t]); }
            const sgn = glowText('MAGIC SEASON ICE ARENA', 5, 0.6, { fg: '#ffffff', bg: '#1f3c66', night: 1.2 }); sgn.position.set(e0[0] + (e1[0] - e0[0]) / 2 - Math.cos(yaw) * 0.2, y + 5.2, e0[1] + (e1[1] - e0[1]) / 2 + Math.sin(yaw) * 0.2); sgn.rotation.y = yaw - Math.PI / 2; rink.add(sgn);
            ctx.add(rink); fairyLights(ctx, lightsPts, { color: '#fff1cf', size: 0.3, on: () => rink.visible, name: 'rink-lights' });
            seasonal(ctx, [11, 21], [1, 4], (on) => { rink.visible = on; });
        }
        // holiday lights wrapped round the gateway trees in season (Bellevue Magic Season)
        { const pts = []; for (let i = 0; i < 6; i++) { const a = A_N + 0.6 + i * 0.05, x = C.x + Math.cos(a) * (R + 14.5), z = C.z + Math.sin(a) * (R + 14.5); pts.push(...treeLightPoints(x, g.heightAt(x, z), z, { seed: i, n: 70 })); } let on = false; seasonal(ctx, [11, 21], [1, 6], (v) => { on = v; }); fairyLights(ctx, pts, { on: () => on, name: 'holiday-tree-lights' }); }
        // ---------------------------------------------------------------- backdrop: OSM streets / blocks, Lincoln Square + Bellevue skyline behind
        for (const id of ['w1326469169', 'w1326469177', 'w1326469168', 'w842753013']) ctx.skipAreas.add(id);
        ctx.terrainOpts = { bg: '#5d8a3e', innerPx: 2048 };
        ctx.exclude.push(Array.from({ length: 48 }, (_, i) => [C.x + Math.cos(i / 48 * TAU) * (R + 8), C.z + Math.sin(i / 48 * TAU) * (R + 8)]));
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth']) skipNearLandmark(ctx, id);
        ctx.osmBackdrop({ paint: {}, trees: true, areaTreeOpts: { conifer: 0.25 }, streetTreeOpts: { spacing: 10, prob: 0.8 }, style: (bd) => ((bd.h || 0) > 40 ? 'office' : undefined) });
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth']) placeLitLandmark(ctx, id, { collide: false, seed: id.length });
        seattleBackdrop(ctx, { clear: 2000, hazeK: 0.4 });
        addTraffic(ctx, { lanes: [{ pts: [[134, 300], [138, 120], [140, 20], [142, -150]], n: 4, speed: 9 }, { pts: [[-300, -60], [-140, -60], [-30, -58], [120, -58]], n: 3, speed: 8 }] });
        // ---------------------------------------------------------------- activities (note 57)
        // 1) the half-mile loop: walk the full promenade ring (timer + steps), any direction
        const loop = { acc: 0, last: null, t0: 0, marks: 0, done: false };
        ctx.onUpdate((dt, s, pl2) => {
            if (!pl2 || loop.done) return; const rr = Math.hypot(pl2.x - C.x, pl2.z - C.z);
            if (rr < R - 12 || rr > R + 26) { loop.last = null; return; }
            const a = ang(pl2.x, pl2.z);
            if (loop.last === null) { loop.last = a; if (!loop.t0) loop.t0 = s.t; return; }
            let da = a - loop.last; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; loop.last = a; loop.acc += da;
            const q = Math.floor(Math.abs(loop.acc) / (Math.PI / 2));
            if (q > loop.marks && q < 4) { loop.marks = q; s.ui.toast(`🚶 Loop ${q}/4`, `${Math.round(Math.abs(loop.acc) * (R + 8))} m of the half-mile promenade`); }
            if (Math.abs(loop.acc) >= TAU) { loop.done = true; const secs = Math.round(s.t - loop.t0), m = Math.round(TAU * (R + 8)); emitActivity(s, 'bel-downtown-park', 'loop', '🏁 Half a mile round', `${m} m in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} — about ${Math.round(m / 0.75)} steps.`); }
        });
        { const st = { x: C.x + Math.cos(A_N + 0.35) * (R + 8), z: C.z + Math.sin(A_N + 0.35) * (R + 8) }; ctx.interactables.push({ kind: 'activity', x: st.x, z: st.z, r: 3, label: 'Walk the half-mile loop (promenade ring)', use: (s) => { loop.acc = 0; loop.marks = 0; loop.last = null; loop.t0 = s.t; s.ui.toast('🚶 Half-mile loop', 'Follow the promenade all the way round the canal — the timer runs from here.'); } }); }
        // 2) toss a coin into the reflecting pool
        const pc = pool.length ? { x: (pb.x0 + pb.x1) / 2, z: (pb.z0 + pb.z1) / 2 } : { x: -120, z: 150 };
        const coinAt = { x: C.x + Math.cos(2.15) * (R + 7), z: C.z + Math.sin(2.15) * (R + 7) };
        ctx.interactables.push({ kind: 'coin', x: coinAt.x, z: coinAt.z, r: 8, label: 'Toss a coin into the reflecting pool', use: (s) => { s.sound.play('coin'); s.ui.toast('🪙 Plink', 'Make a wish — the waterfall behind is 240 ft wide.'); } });
        // ---------------------------------------------------------------- plaques, postcard, crowd, sound, spawn
        const PL = sp.plaques, onRing = (a, off) => ({ x: C.x + Math.cos(a) * (R + off), z: C.z + Math.sin(a) * (R + off) });
        const face = (p) => Math.atan2(C.x - p.x, C.z - p.z) + Math.PI;
        { const p = onRing(A_N + 0.25, 11); ctx.plaque(PL[0], p.x, p.z, face(p)); }
        { const p = onRing(2.3, 11.5); ctx.plaque(PL[1], p.x, p.z, face(p)); }
        ctx.plaque(PL[2], mem.x + 2.5, mem.z + 3, Math.PI / 4);
        ctx.plaque(PL[3], pl.x - 5, pl.z + 2, -Math.PI / 2, { credit: 'Piloti © 2023 Marc Fornes / THEVERYMANY — modelled in 3-D from public descriptions.' });
        { const vx = -93, vz = 131, tx = -150, tz = 121.5, b = ((Math.atan2(tx - vx, -(tz - vz)) * 180 / Math.PI) + 360) % 360; ctx.challenge('bel-downtown-park', { view: [tx, tz], x: vx, z: vz, heading: b, pitch: 1, r: 14, tol: 35, text: 'Along the 240-ft waterfall spilling into the reflecting pool' }); }
        const ringLine = Array.from({ length: 81 }, (_, i) => { const a = A_N - westL + (i / 80) * (westL + eastL); return [C.x + Math.cos(a) * (R + 8), C.z + Math.sin(a) * (R + 8)]; });
        ctx.crowdCfg = {
            personas: { local: 5, tech: 3, kid: 2.5, tourist_us: 2, tourist_in: 1.5, tourist_cn: 1.5, tourist_kr: 1, tourist_jp: 1, photographer: 0.6 },
            walkers: 30, paths: [ringLine, ...ctx.footLines()],
            groups: [
                { x: C.x + 25, z: C.z - 10, r: 14, n: 9, act: 'sit', look: [C.x, C.z], personas: ['local', 'tech', 'kid'] },
                { x: coinAt.x + 9, z: coinAt.z + 4, r: 3, n: 4, act: 'photo', look: [-121, 121], personas: ['tourist_us', 'tourist_in', 'photographer', 'tourist_kr'] },
                { x: pl.x - 4, z: pl.z + 4, r: 2, n: 3, act: 'watch', look: [pl.x, pl.z], personas: ['tech', 'local', 'kid'] },
                ...(pgp ? [{ x: polyBox(pgp).x0 + 20, z: polyBox(pgp).z0 + 15, r: 8, n: 7, act: 'talk', personas: ['kid', 'local'] }] : []),
            ],
        };
        ctx.sound('waterfall', -121, 125, 110, 1.3); ctx.sound('water', C.x, C.z - R, 60, 0.6); ctx.sound('birds', C.x, C.z, 200, 1); ctx.sound('traffic', 135, 40, 90, 0.6);
        ctx.spawns['bel-downtown-park'] = { x: sp.spawn.x + 6, z: sp.spawn.z - 6, heading: headingFromBearing(sp.spawn.heading_deg) };
        void pc; void clamp; void globes;
    },
};
