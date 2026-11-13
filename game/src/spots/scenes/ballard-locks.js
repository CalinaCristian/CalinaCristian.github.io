// ============================================================================
//  Hiram M. Chittenden (Ballard) Locks: the large lock (251.5 × 24.4 m) and
//  the small lock (45.7 × 9.1 m) side by side between Salmon Bay (lake level)
//  and Shilshole Bay (tidal), miter gates you walk across, boats rising and
//  falling, the spillway dam with tainter gates, the fish
//  ladder on the south bank, the 1915 buildings with red tile roofs and the
//  Carl S. English Jr. Botanical Garden on the north bank.
//
//  Layout (fidelity pass 2026-11-12): everything between the banks comes from
//  the OSM objects, not from the 20 m terrain grid — the lock and guide walls
//  are the man_made=breakwater / pier polygons, the five miter gates are the
//  waterway=lock_gate ways (west, intermediate and east gate of the large lock,
//  both gates of the small lock), the spillway is the waterway=dam polygon
//  w32823954 running from the small lock to the south bank, and the public
//  crossing follows the mapped footways over the gates and the dam. Levels are
//  the USGS 1 m DEM's: coping and north bank 7.0 m NAVD88 (−1.5 here), lake
//  4.98 m (−3.52), tidewater −0.36 m (−8.86, the DEM's low-tide surface).
//  Estimates (no source): wall and gate depth below water, pier / gate /
//  hoist dimensions of the spillway beyond "six tainter gates, 71.6 m", deck
//  thicknesses, colours.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, clamp, lerp, smooth, headingFromBearing, polyBox, inPoly, capsuleGeometry, distSeg } from '../kit.js';
import { signBoard, railing } from '../props.js';
import { addTraffic } from '../cars.js';
import { waterMaterial, worldUV } from './sea-common.js';
import { seaActivity } from './sea-common.js';
import { activityFlow } from '../participation.js';
import { applyFineDem } from './fine-dem.js';
import LOCKS_DEM from './fine-dem-ballard-locks.js';
import SOUTH_DEM from './fine-dem-ballard-locks-south.js';
import { salmonWaves, southPlaza } from './ballard-locks-art.js';

// lock axis from the west (sea) gate to the east (lake) gate — OSM lock_gate ways
const A = [-105, 42], B = [131, 130];
const LEN = Math.hypot(B[0] - A[0], B[1] - A[1]), U = [(B[0] - A[0]) / LEN, (B[1] - A[1]) / LEN], N = [-U[1], U[0]]; // N points south-east
const SEA = -8.86, LAKE = -3.52, WALL_TOP = -1.5, FLOOR = -17;
const toAx = (x, z) => { const dx = x - A[0], dz = z - A[1]; return [dx * U[0] + dz * U[1], dx * N[0] + dz * N[1]]; };
const fromAx = (s, t) => [A[0] + U[0] * s + N[0] * t, A[1] + U[1] * s + N[1] * t];
const YAW = Math.atan2(U[0], U[1]); // yaw that maps local +z onto the lock axis
const LARGE = { s0: 0, s1: LEN, t: 0, w: 24.4 }, SMALL = { s0: 59.8, s1: 105.7, t: 27.3, w: 9.1 };
// OSM objects the structure is built from
const WALL_IDS = ['w159935907', 'w51818718', 'w51818719', 'w1305542077', 'w1304049322', 'w1304049326']; // lock + guide walls (breakwater / pier polygons)
const GATE_IDS = ['w293079629', 'w293079656', 'w1305545916', 'w1305545915', 'w293079859'];               // waterway=lock_gate (V, vertex upstream)
const DAM_ID = 'w32823954';
// spillway dam: centre line from the small lock's south wall to the south bank (dam polygon edges), 7 m wide
const DAM = { a: [-18, 117], b: [-42, 181.5], hw: 3.5 };
DAM.len = Math.hypot(DAM.b[0] - DAM.a[0], DAM.b[1] - DAM.a[1]); DAM.u = [(DAM.b[0] - DAM.a[0]) / DAM.len, (DAM.b[1] - DAM.a[1]) / DAM.len];
DAM.v = [DAM.u[1], -DAM.u[0]]; // across the dam, pointing east = upstream (lake side)
DAM.yaw = Math.atan2(DAM.u[0], DAM.u[1]);
const damPt = (u, v) => [DAM.a[0] + DAM.u[0] * u + DAM.v[0] * v, DAM.a[1] + DAM.u[1] * u + DAM.v[1] * v];
const inChamber = (x, z, L, pad = 0) => { const [s, t] = toAx(x, z); return s > L.s0 - pad && s < L.s1 + pad && Math.abs(t - L.t) < L.w / 2 + pad; };

function boat(color, len = 12) {
    const g = new THREE.Group(); g.name = 'boat';
    const hull = new THREE.Mesh(capsuleGeometry(len * 0.13, len * 0.72, 4, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.55); hull.position.y = 0.2; g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.2, len * 0.11, len * 0.3), new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.5 })); cabin.position.set(0, len * 0.1, -len * 0.05); g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, len * 0.9, 6), cabin.material); mast.position.set(0, len * 0.45, len * 0.1); if (len < 13) g.add(mast);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
}
/** a lock chamber: carved to the floor, with its own (animated) water sheet. The walls are built by the caller. */
function buildChamber(ctx, L, water) {
    ctx.ground.mod((x, z, h) => (inChamber(x, z, L, 3) ? FLOOR : h));
    const [cx, cz] = fromAx((L.s0 + L.s1) / 2, L.t);
    const wg = new THREE.PlaneGeometry(L.w + 0.4, L.s1 - L.s0); worldUV(wg, 25); const wm = new THREE.Mesh(wg, water.material); wm.rotation.set(-Math.PI / 2, 0, YAW); wm.position.set(cx, SEA, cz); wm.name = 'lock-water'; ctx.add(wm);
    return { water: wm, cx, cz };
}

/**
 * Salmon Bay Bridge (BNSF bridge 6.3, 1914; OSM man_made=bridge w859885667, movable bascule span on the rail ways
 * w34680546 / w53826213 from 47.66751 to 47.66668 N along 122.4021 W, fixed approaches w12877740 north and w34680548
 * south): the rust-brown steel truss that closes the view down the canal west of the locks. Street View (pano on
 * W Commodore Way): a camelback through truss, seen lowered, with the taller counterweight tower at its north end.
 * A silhouette at the mapped position; deck height (13 m above the water), truss depth, tower and member sizes are
 * estimates. Outside the walkable area: no colliders.
 */
function buildSalmonBayBridge(ctx) {
    const b = new GeoBatch(), col = '#5a4034', x = -383.3, zN = -123.2, zS = -31, deck = SEA + 1.6 + 13, w = 9, n = 8, L = zS - zN;
    const top = (i) => deck + 8.5 + 6.5 * Math.sin(Math.PI * i / n);
    for (const sx of [-w / 2, w / 2]) for (let i = 0; i <= n; i++) {
        const z = zN + L * i / n;
        b.rod([x + sx, deck, z], [x + sx, top(i), z], 0.3, col, 'steel', 4);
        if (!i) continue; const zp = zN + L * (i - 1) / n;
        b.rod([x + sx, top(i - 1), zp], [x + sx, top(i), z], 0.42, col, 'steel', 4); b.rod([x + sx, deck, zp], [x + sx, deck, z], 0.45, col, 'steel', 4);
        b.rod([x + sx, i <= n / 2 ? deck : top(i - 1), zp], [x + sx, i <= n / 2 ? top(i) : deck, z], 0.25, col, 'steel', 4);
    }
    for (let i = 0; i <= n; i++) { const z = zN + L * i / n; b.rod([x - w / 2, top(i), z], [x + w / 2, top(i), z], 0.2, col, 'steel', 4); }
    b.box(x, deck - 0.9, (zN + zS) / 2, w, 0.9, L, '#3c332e', 'steel');
    // counterweight tower at the north end, the concrete counterweight carried high between its legs
    const tH = deck + 24;
    for (const sx of [-w / 2 - 0.6, w / 2 + 0.6]) { for (const z of [zN - 1, zN - 15]) b.rod([x + sx, deck - 6, z], [x + sx, tH, z], 0.5, col, 'steel', 4); b.rod([x + sx, tH, zN - 1], [x + sx, tH, zN - 15], 0.4, col, 'steel', 4); b.rod([x + sx, deck, zN - 15], [x + sx, tH, zN - 1], 0.3, col, 'steel', 4); b.rod([x + sx, tH, zN - 1], [x + sx, top(2), zN + L * 2 / n], 0.3, col, 'steel', 4); }
    b.box(x, deck + 12, zN - 9, w + 1.6, 7, 8, '#8b877f', 'concrete');
    for (const z of [zN, zS]) b.box(x, FLOOR, z, w + 3, deck - 0.9 - FLOOR, 5, '#a29e94', 'concrete');
    // fixed approaches: plate girders on concrete piers
    for (const pts of [[[-383.3, zS], [-383, 13.7], [-382.2, 31.2], [-380.6, 49.5], [-377.7, 67.6], [-374, 85.7]], [[-383.3, zN - 15], [-389.7, -181.8], [-393.1, -209.8], [-398.1, -233.2]]]) {
        for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
            b.box((ax + bx) / 2, deck - 2.2, (az + bz) / 2, w, 2.2, len + 0.3, col, 'steel', yaw);
            const gy = Math.min(ctx.ground.heightAt(bx, bz), deck - 4) - 3; b.box(bx, gy, bz, w + 1, deck - 2.2 - gy, 2.2, '#a29e94', 'concrete', yaw); }
    }
    ctx.add(b.build('salmon-bay-bridge', { castShadow: false }));
}

export default {
    env: { fogFar: 4500 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('ballard-locks');
        const area = (id) => d.areas.find((a) => a.id === id);
        // ---- real levels between the banks (USGS 1 m DEM on a 5 m grid; its water surfaces are flat: lake −3.52, sea −8.86)
        // (two grids: the lock complex, and the south bank with the fish ladder and the dam's south end)
        const fineN = applyFineDem(g, LOCKS_DEM, { fade: 10 }), fineS = applyFineDem(g, SOUTH_DEM, { fade: 10 });
        const inS = (x, z) => { const b = fineS.box; return x > b.x0 + 5 && x < b.x1 - 5 && z > b.z0 + 5 && z < b.z1; };
        const fine = (x, z) => (inS(x, z) ? fineS(x, z) : fineN(x, z) ?? fineS(x, z));
        fine.nearest = (x, z) => (inS(x, z) ? fineS.nearest(x, z) : fineN.nearest(x, z) ?? fineS.nearest(x, z));
        const inFine = (x, z) => fine(x, z) !== null;
        // which water stands at (x, z): the lake east of the gates and the dam, tidewater west of them. Inside the fine
        // grid its flattened water value decides, with the dam line itself deciding next to the dam; outside it the
        // coarse terrain's water value does
        const nearDam = (x, z) => { const dx = x - DAM.a[0], dz = z - DAM.a[1], u = dx * DAM.u[0] + dz * DAM.u[1], v = dx * DAM.v[0] + dz * DAM.v[1]; return u > -6 && u < DAM.len + 4 && Math.abs(v) < 12 ? v : null; };
        // away from any water sample: upstream of the barrier (north bank – lock – dam – south bank) is the lake side
        const upstream = (x, z) => { const [sAx, tAx] = toAx(x, z); return tAx < LARGE.w / 2 ? sAx > LEN : (x - DAM.a[0]) * DAM.v[0] + (z - DAM.a[1]) * DAM.v[1] > 0; };
        const flat = (f) => Math.abs(f - LAKE) < 0.12 || Math.abs(f - SEA) < 0.12; // the DEM's two water surfaces
        const lakeAt = (x, z) => {
            const v = nearDam(x, z); if (v !== null) return v > 0;
            let f = fine.nearest(x, z);
            if (f !== null && !flat(f)) { // a bank sample: take the nearest water sample round it
                let best = null, bd = 1e9;
                for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const w = fine.nearest(x + i * 5, z + j * 5); if (w !== null && flat(w) && i * i + j * j < bd) { bd = i * i + j * j; best = w; } }
                if (best === null) return upstream(x, z);
                f = best;
            }
            if (f !== null) return f > -6;
            return upstream(x, z);
        };
        // water bodies: lake level east of the locks / dam, tidal sea level west; the bed lies well below both
        g.mod((x, z, h) => {
            if (h > -2.6) return h;
            const lvl = lakeAt(x, z) ? LAKE : SEA;
            // inside the fine grid a shore keeps its measured slope down to the water's edge; the bed starts there
            return inFine(x, z) && h > lvl + 0.1 ? h : Math.min(h, lvl - 2.6);
        });
        // round 5 (note 64): rippled water that reflects the sky (sea-common), the lock chambers and Salmon Bay share it
        const waterMat = waterMaterial(ctx, { color: '#24413f', rough: 0.12, name: 'spot-water' });
        const seaG = new THREE.PlaneGeometry(9000, 9000); seaG.rotateX(-Math.PI / 2); worldUV(seaG, 60);
        const sea = new THREE.Mesh(seaG, waterMat); sea.position.y = SEA; sea.name = 'water-puget-sound'; ctx.add(sea);
        { // lake surface = grid cells standing in lake water (2 m cells inside the fine grid, 4 m outside)
            const pos = [], bb = { x0: -500, x1: 900, z0: -400, z1: 700 };
            const cell = (x, z, step) => {
                const cx = x + step / 2, cz = z + step / 2;
                if (inChamber(cx, cz, LARGE, 1) || inChamber(cx, cz, SMALL, 1)) return; // the chambers carry their own sheet
                const f = fine(cx, cz); if (f !== null ? f > LAKE + 0.1 : g.base(cx, cz) > -2.6) return; // dry land
                if (!lakeAt(cx, cz)) return;
                pos.push(x, LAKE, z, x, LAKE, z + step, x + step, LAKE, z + step, x, LAKE, z, x + step, LAKE, z + step, x + step, LAKE, z);
            };
            for (let x = bb.x0; x < bb.x1; x += 4) for (let z = bb.z0; z < bb.z1; z += 4) {
                if (inFine(x, z) && inFine(x + 4, z + 4)) { for (const [ox, oz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) cell(x + ox, z + oz, 2); } else cell(x, z, 4);
            }
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); worldUV(geo, 60);
            const lake = new THREE.Mesh(geo, waterMat); lake.name = 'water-salmon-bay'; ctx.add(lake);
        }
        // nobody wades: the walker's deep-water rule needs the level that stands at each place (two levels here)
        g.waterHeightAt = (x, z) => (lakeAt(x, z) ? LAKE : SEA);
        g.waterY = LAKE; // (people look for a deck up to 3 m above this before settling for the bed)
        const big = buildChamber(ctx, LARGE, sea), small = buildChamber(ctx, SMALL, sea);

        // ---- lock walls, guide walls, gates
        const b = new GeoBatch(), conc = '#b9b5ab';
        for (const id of [...WALL_IDS, DAM_ID, ...GATE_IDS]) ctx.skipAreas.add(id);
        const walls = WALL_IDS.map(area).filter(Boolean);
        for (const w of walls) { b.prism(w.poly, FLOOR, WALL_TOP, conc, 'concrete'); g.addPoly(w.poly, WALL_TOP, FLOOR); }
        // the timber guide piers leading in from the west (OSM man_made=pier, surface=wood): a deck at the coping level
        for (const id of ['w159457457', 'w1305394176']) { const p = area(id); if (!p) continue; ctx.skipAreas.add(id); b.prism(p.poly, WALL_TOP - 0.7, WALL_TOP, '#7a6a55', 'wood'); b.prism(p.poly.map(([x, z]) => [x, z]), SEA - 3, WALL_TOP - 0.7, '#4b4138', 'wood'); g.addPoly(p.poly, WALL_TOP, SEA - 3); }
        { // the north wall of the large lock is the bank's edge (no OSM polygon): a wall strip along the chamber, tied into the bank
            const t = LARGE.t - LARGE.w / 2 - 2.9, [cx, cz] = fromAx((LARGE.s0 + LARGE.s1) / 2, t);
            b.box(cx, FLOOR + 0.2, cz, 5.8, WALL_TOP - FLOOR - 0.23, LARGE.s1 - LARGE.s0 + 14, conc, 'concrete', YAW);
            g.addBox(cx, cz, 2.9, (LARGE.s1 - LARGE.s0) / 2 + 7, YAW, FLOOR, WALL_TOP);
        }
        // miter gates: two steel leaves meeting in a V that points upstream, a walkway on top (the public crossings
        // are the west and intermediate gates of the large lock and both gates of the small lock — OSM bridge footways)
        const gates = GATE_IDS.map(area).filter(Boolean);
        for (const gt of gates) {
            const P = gt.poly;
            for (let i = 1; i < P.length; i++) {
                const [p0x, p0z] = P[i - 1], [p1x, p1z] = P[i], mx = (p0x + p1x) / 2, mz = (p0z + p1z) / 2, len = Math.hypot(p1x - p0x, p1z - p0z), yaw = Math.atan2(p1x - p0x, p1z - p0z);
                b.box(mx, FLOOR, mz, 1.0, WALL_TOP - FLOOR + 0.05, len + 0.4, '#4f5a5f', 'steel', yaw);
                b.box(mx, WALL_TOP + 0.05, mz, 2.1, 0.12, len + 0.9, '#6f757a', 'steel', yaw);
                g.addBox(mx, mz, 1.05, len / 2 + 0.45, yaw, FLOOR, WALL_TOP + 0.17);
                const nx = Math.cos(yaw), nz = -Math.sin(yaw);
                for (const sd of [-1, 1]) railing(b, [[p0x + nx * sd * 1.0, p0z + nz * sd * 1.0], [p1x + nx * sd * 1.0, p1z + nz * sd * 1.0]], () => WALL_TOP + 0.17, { h: 1.07, color: '#b9bec2' });
            }
        }
        // railings as mapped (barrier=fence, fence_type=railing): they keep visitors back from the working lock walls
        for (const a of d.areas) {
            if (a.barrier !== 'fence' || a.fence_type !== 'railing' || !/^w13055420|^w13053904/.test(a.id)) continue;
            const P = a.poly, top = (x, z) => { const t = g.groundAt(x, z, WALL_TOP + 1); return t < 40 && t > SEA + 1.5 ? t : WALL_TOP; };
            const onDam = P.some(([x, z]) => { const v = nearDam(x, z); return v !== null && Math.abs(v) < 5; }) && a.id === 'w1305542108';
            const Q = onDam ? P.slice(0, 3) : P; // (the dam's own railing is built with the dam)
            if (Q.length < 2) continue;
            railing(b, Q, top, { h: 1.07, color: '#2f3a40' });
            for (let i = 1; i < Q.length; i++) { const [ax, az] = Q[i - 1], [bx, bz] = Q[i]; if (Math.hypot(bx - ax, bz - az) < 0.4) continue; ctx.collider({ wall: true, ax, az, bx, bz, y0a: WALL_TOP - 1, y1a: WALL_TOP + 1.2, y0b: WALL_TOP - 1, y1b: WALL_TOP + 1.2, nx: 0, nz: 1 }); }
        }
        ctx.add(b.build('lock'));

        // ---- spillway dam (OSM waterway=dam w32823954): six tainter gates between seven piers, lake above, tidewater
        // below. Street View (Sep 2022 pano on the walkway): massive stained concrete piers carrying an arched concrete
        // service bridge with pipe railings; the dark ribbed gate leaves stand under the arches; the public walkway
        // (OSM bridge footway w1475183520) is a narrow footbridge along the downstream face, about 3 m below the
        // service bridge, with galvanised railings and twin-head lamp posts. From that pano the gate tops stand a
        // little above the footbridge deck and the lake is seen over them, so the deck is put at lake level (+0.1 m)
        // (it is on the tailwater side) and the service bridge 2.4 m above it; both are read off the pano, not surveyed.
        {
            const sb = new GeoBatch(), n = 6, pier = 1.9, bay = (DAM.len - pier) / n, walkY = LAKE + 0.1, topY = walkY + 2.4, clear = bay - pier;
            const stain = (x, y, z) => new THREE.Color('#aaa59a').multiplyScalar(0.86 + 0.12 * Math.sin(x * 2.3 + z * 1.7) * Math.sin(y * 0.9)).lerp(new THREE.Color('#8a6a4a'), y < LAKE + 1.5 ? 0.18 : 0.04);
            const box = (u, v, y, wu, h, wv, col, key = 'concrete') => { const [x, z] = damPt(u, v); sb.box(x, y, z, wv, h, wu, col, key, DAM.yaw); };
            box(DAM.len / 2, 1.2, FLOOR - 0.3, DAM.len - 0.2, LAKE - 3.4 - FLOOR + 0.3, 5.4, '#b3afa5');                        // sill under the gates
            box(DAM.len / 2, -DAM.hw - 2, FLOOR - 0.5, DAM.len - 0.4, SEA - 0.6 - FLOOR + 0.5, 8, '#a9a59b');                    // apron under the tailwater
            for (let i = 0; i <= n; i++) box(pier / 2 + i * bay, 1.3, FLOOR - 0.1, pier, topY - 0.52 - FLOOR + 0.1, 5.6, stain); // piers
            const th = Math.atan2(DAM.u[1], -DAM.u[0]); // extrusion frame: shape x along −u, depth along v
            for (let i = 0; i < n; i++) {
                const u0 = pier + i * bay, uc = u0 + clear / 2;
                // arched service bridge between the piers
                const sh = new THREE.Shape(), ys = topY - 1.9, crown = topY - 0.7; sh.moveTo(0, ys);
                for (let k = 1; k <= 14; k++) { const t = k / 14, a = 2 * t - 1; sh.lineTo(clear * t, ys + (crown - ys) * Math.sqrt(Math.max(0, 1 - a * a))); }
                sh.lineTo(clear, topY); sh.lineTo(0, topY); sh.closePath();
                const geo = new THREE.ExtrudeGeometry(sh, { depth: 3.4, bevelEnabled: false, curveSegments: 4 });
                const [ox, oz] = damPt(u0 + clear, 0.2); sb.add(geo, 'concrete', M(ox, 0, oz, 0, th, 0), stain); geo.dispose();
                // gate leaf: dark ribbed steel from the sill to just above the lake
                box(uc, -0.25, LAKE - 3.4, clear, 3.9, 0.25, '#2f3437', 'steel');
                for (let k = 0; k < 4; k++) box(uc, -0.45, LAKE - 3.2 + k * 0.95, clear, 0.16, 0.2, '#3d4347', 'steel');
            }
            box(DAM.len / 2, 1.9, topY - 0.46, DAM.len + 0.6, 0.5, 3.6, stain);                                  // service deck over the piers
            for (const v of [0.2, 3.6]) railing(sb, [damPt(0, v), damPt(DAM.len, v)], () => topY, { h: 1.07, color: '#8f969b' });
            { const [dx, dz] = damPt(DAM.len / 2, 1.9); g.addBox(dx, dz, 1.9, DAM.len / 2 + 0.3, DAM.yaw, FLOOR, topY); }
            // the public footbridge on the downstream face, ramped up to the lock coping at its north end
            // and, past the dam's south end, on over the fish ladder's entrance to the south-bank plaza (OSM footway w342815094;
            // the plaza stands at the coping level in the DEM)
            const w0 = -3.7, w1 = -1.25, uN = -1.5, uS = DAM.len + 17.5, rampN = (u) => (u < DAM.len / 2 ? lerp(WALL_TOP, walkY, smooth(0.2, 8.5, u)) : lerp(walkY, WALL_TOP, smooth(DAM.len + 5, DAM.len + 13.5, u)));
            for (let u = uN; u < uS; u += 1.25) { const u1 = Math.min(uS, u + 1.25), ya = rampN(u), yb = rampN(u1), p = [damPt(u, w0), damPt(u1, w0), damPt(u1, w1), damPt(u, w1)];
                sb.quad([p[0][0], ya + 0.02, p[0][1]], [p[3][0], ya + 0.02, p[3][1]], [p[2][0], yb + 0.02, p[2][1]], [p[1][0], yb + 0.02, p[1][1]], '#b4b0a6', 'concrete');
                box((u + u1) / 2, (w0 + w1) / 2, Math.min(ya, yb) - 0.4, u1 - u + 0.02, 0.38, w1 - w0, '#a29e94'); }
            for (let i = 0; i <= n + 1; i++) box(pier / 2 + i * bay, (w0 + w1) / 2 - 0.2, FLOOR - 0.2, 0.9, walkY - 0.42 - FLOOR + 0.2, w1 - w0 - 0.6, '#a9a59b'); // footbridge bents
            const walkPoly = [damPt(uN, w0), damPt(uS, w0), damPt(uS, w1), damPt(uN, w1)];
            g.addPoly(walkPoly, (x, z) => rampN((x - DAM.a[0]) * DAM.u[0] + (z - DAM.a[1]) * DAM.u[1]), FLOOR);
            for (const v of [w0 + 0.08, w1 - 0.08]) {
                const p0 = damPt(uN, v), p1 = damPt(uS - 1, v);
                railing(sb, [p0, damPt(0.2, v), damPt(4.4, v), damPt(8.5, v), damPt(DAM.len + 5, v), damPt(DAM.len + 9.3, v), p1], (x, z) => rampN((x - DAM.a[0]) * DAM.u[0] + (z - DAM.a[1]) * DAM.u[1]), { h: 1.07, post: 1.8, color: '#b9bec2' });
                ctx.collider({ wall: true, ax: p0[0], az: p0[1], bx: p1[0], bz: p1[1], y0a: walkY - 1, y1a: WALL_TOP + 1.2, y0b: walkY - 1, y1b: WALL_TOP + 1.2, nx: 0, nz: 1 });
            }
            for (let i = 1; i < n; i += 2) { const [lx, lz] = damPt(pier / 2 + i * bay, w1 - 0.3); ctx.lampPoints.push({ x: lx, z: lz, rot: DAM.yaw, y: walkY }); }
            // the junction block between the small lock's south wall and the dam (the dam polygon's head)
            const dam = area(DAM_ID); if (dam) { const head = dam.poly.filter(([x, z]) => z < 121); if (head.length >= 3) { sb.prism(head, FLOOR + 0.15, WALL_TOP - 0.02, '#b3afa5', 'concrete'); g.addPoly(head, WALL_TOP, FLOOR); } }
            ctx.add(sb.build('spillway'));
            // white water under the gates (two bays spilling)
            const foam = new THREE.Mesh(new THREE.PlaneGeometry(bay * 2 - pier, 7), new THREE.MeshStandardMaterial({ color: '#dfe9e6', roughness: 0.9, transparent: true, opacity: 0.5, depthWrite: false }));
            foam.rotation.set(-Math.PI / 2, 0, DAM.yaw + Math.PI / 2); const [fx, fz] = damPt(pier / 2 + 3 * bay, -8); foam.position.set(fx, SEA + 0.05, fz); foam.name = 'spill-foam'; ctx.add(foam);
            ctx.extras.spillway = { walkY, topY, bays: n };
        }
        buildSalmonBayBridge(ctx);
        salmonWaves(ctx, southPlaza(ctx)); // "Salmon Waves" on the south-bank plaza (OSM n3211770269; ballard-locks-art.js)
        // ---- fish ladder on the south bank (OSM waterway=fish_pass w764035003 + w285286401): 21 weirs of 0.3 m
        // climbing from tidewater at its west end to lake level beside the dam
        {
            const fb = new GeoBatch(), fl = [[-64, 178], [-21, 196]], L = Math.hypot(fl[1][0] - fl[0][0], fl[1][1] - fl[0][1]), ux = (fl[1][0] - fl[0][0]) / L, uz = (fl[1][1] - fl[0][1]) / L, yaw = Math.atan2(ux, uz);
            for (let i = 0; i < 21; i++) { const x = fl[0][0] + ux * L * (i + 0.5) / 21, z = fl[0][1] + uz * L * (i + 0.5) / 21, y = lerp(SEA, LAKE, i / 20); fb.box(x, y - 1.2, z, 5, 1.2, L / 21, '#a8a49a', 'concrete', yaw); fb.box(x, y, z, 4.6, 0.04, L / 21 - 0.3, '#3a5a57', 'water', yaw); fb.box(x - uz * 2.7, y - 1.2, z + ux * 2.7, 0.4, 2.6, L / 21, '#a8a49a', 'concrete', yaw); fb.box(x + uz * 2.7, y - 1.2, z - ux * 2.7, 0.4, 2.6, L / 21, '#a8a49a', 'concrete', yaw); }
            ctx.add(fb.build('fishladder'));
        }
        // The mapped north-bank public path and its western access keep the coping level (the terrain there is the
        // bank's own, −1.6 … −1.0 m in the DEM); the steps climb from it to the garden.
        const northWalks = ['w60973303', 'w472179831'].map(id => d.ways.find(w => w.id === id)).filter(Boolean);
        const publicBankPoint = (x, z) => {
            let nearest = null;
            for (const way of northWalks) for (let i = 1; i < way.pts.length; i++) {
                const a = way.pts[i - 1], c = way.pts[i], p = distSeg(x, z, ...a, ...c);
                if (!nearest || p.d < nearest.d) nearest = p;
            }
            return nearest ? [nearest.cx, nearest.cz] : [x, z];
        };
        const westSteps = d.ways.find(w => w.id === 'w60973302');
        const westLink = d.ways.find(w => w.id === 'w1305390459');
        for (const walk of northWalks) g.corridor(walk.pts, 3.2, 2.5, () => WALL_TOP);
        if (westLink) g.corridor(westLink.pts, 3.2, 1.5, () => WALL_TOP);
        if (westSteps) {
            const [a, c] = westSteps.pts, dx = c[0] - a[0], dz = c[1] - a[1], ll = dx * dx + dz * dz;
            const top = g.heightAt(...c);
            g.corridor(westSteps.pts, 2.6, 1.5, (x, z) => lerp(WALL_TOP, top, clamp(((x - a[0]) * dx + (z - a[1]) * dz) / ll, 0, 1)));
        }
        ctx.extras.publicNorthWalk = { sourceIds: [...northWalks, westLink, westSteps].filter(Boolean).map(w => w.id), topM: WALL_TOP, widthM: 3.2, stepsWidthM: 2.6, provenance: 'Coping level from the USGS 1 m DEM (7.0 m NAVD88); widths are estimates; exact mapped source centre lines retained.' };
        ctx.extras.locks = { wallTop: WALL_TOP, lake: LAKE, sea: SEA, lakeAt, dam: DAM, walls: walls.map((w) => w.id), gates: gates.map((w) => w.id) };
        // 1915 buildings: grey concrete walls (Street View: the Administration Building front), red tile hipped roofs
        for (const bd of d.buildings) if (/Administration|Operating House|Control Tower|Visitor Center|Machine Shop|Office and Shop|Mechanics|Warehouse No|Steel Shop|Gatehouse/.test(bd.name || '')) { bd.estimatedRoof = 'hipped'; bd.rc = '#a2452d'; bd.c = '#b4b1a7'; bd.estimatedHeight = /Administration/.test(bd.name) ? 11 : 7; }
        ctx.terrainOpts = { bg: '#5f7a3c', innerPx: 2048, skirtY: SEA - 0.2, skirtColor: '#36525a' };
        ctx.osmBackdrop({ paint: {}, urban: false, style: (bd) => (bd.rc === '#a2452d' ? 'apartment' : undefined), areaTreeOpts: { conifer: 0.5, density: 1 / 70 } });
        // Carl S. English Jr. Botanical Garden: specimen trees + beds
        // (r3-sea-spots-4) the Administration Building's garden (OSM w60973304, leisure=garden) is wooded with tall conifers in
        // Street View (seattle-spots.md "Ballard Locks"), not open lawn: conifers on a 5 m staggered grid inside the mapped garden; the grid and the
        // tree sizes are estimates (no tree nodes are mapped there)
        { const ag = d.areas.find((a) => a.id === 'w60973304'); if (ag) { const bb = polyBox(ag.poly), r = rng(60973304); let n = 0;
            for (let x = bb.x0 + 2.5, row = 0; x < bb.x1; x += 4.4, row++) for (let z = bb.z0 + 2.5 + (row % 2) * 2.5; z < bb.z1; z += 5) { const jx = x + (r() - 0.5) * 1.6, jz = z + (r() - 0.5) * 1.6; if (!inPoly(jx, jz, ag.poly)) continue; ctx.trees.push({ x: jx, z: jz, kind: 'con', s: 1.7 + r() * 0.5 }); n++; }
            ctx.extras.adminGardenConifers = n; } }
        { const gd = d.areas.find((a) => a.id === 'w51475864'); if (gd) { const bb = polyBox(gd.poly), r = rng(14); for (let i = 0; i < 260; i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); if (!inPoly(x, z, gd.poly) || g.heightAt(x, z) < WALL_TOP - 0.4) continue; ctx.trees.push({ x, z, kind: r() < 0.25 ? 'con' : r() < 0.6 ? 'broad' : 'shrub', s: 0.6 + r() * 0.7 }); } } }
        // night: lamps along the lock walls (every 24 m, both sides) and the garden / promenade paths
        for (const side of [-1, 1]) for (let s0 = 8; s0 < LEN - 4; s0 += 24) { const [x, z] = fromAx(s0, LARGE.t + side * (LARGE.w / 2 + 2.6)); ctx.lampPoints.push({ x, z, rot: 0, y: WALL_TOP }); }
        { let n = 0; for (const pts of ctx.footLines()) { let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc > 28 && n < 60) { acc = 0; n++; const lx = pts[i][0] + 1.1, lz = pts[i][1]; if (g.heightAt(lx, lz) > WALL_TOP - 0.6) ctx.lampPoints.push({ x: lx, z: lz, rot: 0 }); } } } }
        ctx.lampOpts = { style: 'acorn', color: '#1f2a26', h: 4.2 };
        // boats in the large lock, rising and falling with the water (west of the intermediate gate and east of it)
        const boats = [['#1f3b57', 11], ['#e8e4d8', 14], ['#7a2c2c', 9], ['#f2f2ee', 18], ['#2d5a3a', 10]].map(([c, l], i) => { const bt = boat(c, l); const [x, z] = fromAx([28, 66, 150, 190, 226][i], (i % 2 ? 6 : -6)); bt.position.set(x, SEA, z); bt.rotation.y = YAW; ctx.add(bt); return bt; });
        // An ambient, shortened lock cycle. Visitors observe from the public
        // walkway; the activity never gives them control of operating equipment.
        let level = SEA, phase = 'low', timer = 20;
        const runLockage = () => { phase = 'fill'; timer = 0; };
        ctx.onUpdate((dt, s) => {
            timer += dt;
            if (phase === 'low' && timer > 40) runLockage();
            else if (phase === 'fill') { level = lerp(SEA, LAKE, smooth(0, 1, timer / 25)); if (timer > 25) { phase = 'high'; timer = 0; } }
            else if (phase === 'high' && timer > 25) { phase = 'drain'; timer = 0; }
            else if (phase === 'drain') { level = lerp(LAKE, SEA, smooth(0, 1, timer / 25)); if (timer > 25) { phase = 'low'; timer = 0; } }
            big.water.position.y = level; small.water.position.y = level;
            boats.forEach((bt, i) => { bt.position.y = level + 0.05 + Math.sin(s.t * 0.8 + i) * 0.04; bt.rotation.z = Math.sin(s.t * 0.6 + i * 2) * 0.02; });
        });
        // Observe from the actual mapped public bank path, outside the coping.
        const [tx, tz] = publicBankPoint(...fromAx(108, -16));
        const flow=activityFlow(ctx),stages=[['fill','The boats are rising'],['high','They reached lake level'],['drain','The boats are descending'],['low','Back at sea level']];
        ctx.extras.lockage={debug:()=>({phase,timer,level})};
        ctx.interactables.push({kind:'lockage',x:tx,z:tz,r:4,label:'Watch a lock cycle from the public walkway',use:s=>flow.begin(s,{
            title:'Watch the Ballard Locks',focus:{x:fromAx(108,0)[0],z:fromAx(108,0)[1],y:level+1.5},action:stages[0][1],lockWalker:false,
            help:'Watch the boats and water through a shortened cycle. Identify each stage when you see it; Leave or Esc ends the visit.',
            started(s,r){r.stage=0;r.busy=true;},
            actioned(s,r){r.stage++;if(r.stage===stages.length){flow.complete();return;}r.busy=true;r.button.textContent=stages[r.stage][1];},
            update(dt,s,r){r.busy=phase!==stages[r.stage][0]||timer<3;r.status.textContent=`${phase==='fill'?'Filling':phase==='drain'?'Draining':phase==='high'?'At lake level':'At sea level'} · ${Math.round((level-SEA)/(LAKE-SEA)*100)}% of the rise`;r.progress.value=r.stage/4;if(Math.hypot(s.position.x-tx,s.position.z-tz)>14)flow.cancel('distance');},
            complete(s){seaActivity(s,'lm-locks-lockage','ballard-locks');s.ui.toast('🚢 Lock cycle observed','You watched the boats rise to lake level and return to sea level.');s.sound.play('bell');},
        })});
        // signage
        const sg = signBoard('HIRAM M. CHITTENDEN LOCKS', 6.5, 0.9, { bg: '#1e3a2b', fg: '#f1ead4', font: (q) => `700 ${q}px Georgia, serif` }); sg.position.set(55, g.heightAt(55, -140) + 2.2, -140); sg.rotation.y = Math.PI; ctx.add(sg);
        addTraffic(ctx, { lanes: [{ pts: [[-142, -119], [-99, -126], [-63, -131], [32, -148], [56, -157], [69, -167]], n: 2, speed: 9 }] });
        // plaques on the north lock wall walkway + visitor centre
        const PL = sp.plaques;
        PL.forEach((pl, i) => {
            // The original reader positions align with the mapped public bank
            // path, outside the operating wall. Attach boards to that grade.
            let [x, z] = fromAx(40 + i * 30, -LARGE.w / 2 - 4.5);
            if (i === 3) {
                // The mapped path bends around the operating house here. Keep
                // this authored board's reader on that bend, not its low verge.
                const yaw = YAW + Math.PI / 2;
                const p = publicBankPoint(x + Math.sin(yaw) * 1.2, z + Math.cos(yaw) * 1.2);
                x = p[0] - Math.sin(yaw) * 1.2; z = p[1] - Math.cos(yaw) * 1.2;
            }
            ctx.plaque(pl, x, z, YAW + Math.PI / 2, { y: WALL_TOP, credit: i === 0 ? 'U.S. Army Corps of Engineers; opened 1917.' : null });
        });
        { const [cx, cz] = fromAx(205, -LARGE.w / 2 - 4.4); ctx.challenge('ballard-locks', { x: cx, z: cz, heading: 290, pitch: -10, r: 16, tol: 35 }); } // on the north lock wall, looking down the chamber full of boats
        // crowd: people along the lock walls watching boats, the crossing over the gates and the dam, the garden, the fish ladder
        const wallLine = (t) => [fromAx(10, t), fromAx(LEN - 10, t)];
        const crossing = ['w472179838', 'w285286403', 'w472179843', 'w1305542103', 'w1475183519', 'w472179852', 'w1475183520', 'w472179834', 'w472179848'].map((id) => d.ways.find((w) => w.id === id)?.pts).filter((p) => p && p.length > 1);
        ctx.crowdCfg = {
            personas: { local: 3, tourist_us: 4, tourist_cn: 1.2, tourist_kr: 1, tourist_jp: 1, tourist_de: 1.2, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 1.5, photographer: 1, staff: 0.4 },
            walkers: 22, paths: [...ctx.footLines().filter((pts) => pts.every(([x, z]) => g.groundAt(x, z, WALL_TOP) < WALL_TOP + 40)), ...crossing, wallLine(-LARGE.w / 2 - 4)],
            groups: [
                { x: fromAx(70, -16.5)[0], z: fromAx(70, -16.5)[1], r: 4, n: 10, act: 'watch', look: fromAx(70, 0), y: WALL_TOP, personas: ['tourist_us', 'local', 'kid', 'tourist_de', 'tourist_cn'] },
                { x: fromAx(150, -16.5)[0], z: fromAx(150, -16.5)[1], r: 3.5, n: 6, act: 'photo', look: fromAx(150, 0), y: WALL_TOP, personas: ['photographer', 'tourist_jp', 'tourist_kr', 'tourist_us'] },
                { x: tx, z: tz, r: 0.3, n: 1, act: 'watch', look: fromAx(108, 0), y: WALL_TOP, personas: ['staff'] },
                { x: -40, z: 186, r: 3, n: 6, act: 'watch', look: [-44, 183], personas: ['tourist_us', 'kid', 'local', 'tourist_es'] },
                { x: -30, z: -9, r: 8, n: 6, act: 'talk', personas: ['local', 'tourist_us', 'tourist_ca'] },
            ],
        };
        ctx.sound('water', damPt(DAM.len / 2, -8)[0], damPt(DAM.len / 2, -8)[1], 120, 1.2); ctx.sound('gulls', 0, 120, 220, 1); ctx.sound('crowd', fromAx(70, -15)[0], fromAx(70, -15)[1], 50, 0.8); ctx.sound('bell', fromAx(108, -16)[0], fromAx(108, -16)[1], 200, 0.6);
        ctx.spawns['ballard-locks'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
    },
};
