// ============================================================================
//  Gas Works Park (Richard Haag, 1975): the rusted generator towers of the last
//  US coal-gasification plant (fenced — no climbing, R15.7), the Play Barn with
//  its painted exhauster-compressors, Kite Hill with the mosaic sundial, and
//  the skyline + Space Needle across Lake Union. Fun: fly a kite (real wind).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, smooth, lerp, headingFromBearing, centroid, polyBox, inPoly } from '../kit.js';
import { seaBackdrop, seaWater, mirrorAbout } from './sea-common.js';
import { seaActivity } from './sea-common.js';
import { bench } from '../osm.js';
import { activityFlow } from '../participation.js';
import { applyFineDem } from './fine-dem.js';
import GAS_DEM from './fine-dem-gas-works.js';
import PROW_DEM from './fine-dem-gas-works-prow.js';

const KITE = { x: -58, z: 31, h: 9.5, r: 34 }; // summit (OSM n9331087056 / w191328703, ele 20 m; USGS 1 m DEM 20.4 m NAVD88 = +9.5 here)
const LAKE_Y = -5.92;                           // Lake Union in the USGS DEM: 4.98 m NAVD88

function rust(r) { return ['#5b3a26', '#6e4228', '#4a3428', '#7a4a2c', '#3c2f2a', '#8a5532', '#2e2a28'][Math.floor(r() * 7)]; }
function buildTowers(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), r = rng(19);
    // everything inside the fence (OSM w4835090): six round generator tanks of 6–7 m Ø and a rectangular block in
    // one north–south row, two slender chimneys (man_made=chimney, 1.5 m Ø) beside the southern pair and nine small
    // vessels of 2.4–3.5 m Ø to the west. Diameters are the mapped footprints'; heights are estimates (dossier:
    // ≈ 15–25 m; refs: Commons "Gas works from the hill 01", "Gas works at Gas Works Park").
    const inside = d.buildings.filter((x) => { const [cx, cz] = centroid(x.poly); return cx > 22 && cx < 84 && cz > 10 && cz < 94; });
    const hubs = [];
    for (const bd of inside) {
        ctx.skipBuildings.add(bd.id);
        const [cx, cz] = centroid(bd.poly), bb = polyBox(bd.poly), w = bb.x1 - bb.x0, dd = bb.z1 - bb.z0, R = (w + dd) / 4, y0 = g.heightAt(cx, cz);
        if (bd.poly.length < 9) { // the rectangular block between the tanks
            b.box(cx, y0, cz, w, 6.5, dd, rust(r), 'metal'); b.box(cx, y0 + 6.5, cz, w * 0.5, 2.2, dd * 0.6, rust(r), 'metal');
            ctx.box(cx, cz, w / 2, dd / 2, 0, { prop: true, h: 8.7 });
        } else if (R < 1.0) { // chimney
            const H = 22 + r() * 4;
            b.cyl(cx, y0, cz, R, H, rust(r), 'metal', 14);
            for (let k = 1; k < H / 3; k++) b.cyl(cx, y0 + k * 3, cz, R + 0.05, 0.14, '#2b2420', 'metal', 14);
            b.cyl(cx, y0 + H, cz, R * 0.85, 0.8, '#3a2f29', 'metal', 12, 0.7);
            b.box(cx + R + 0.2, y0, cz, 0.08, H, 0.45, '#2a2622', 'metal');
            ctx.circle(cx, cz, R + 0.2, H);
        } else if (R < 2.2) { // small vessel
            const H = 6 + r() * 4;
            b.cyl(cx, y0, cz, R, H, rust(r), 'metal', 14); b.sphere(cx, y0 + H, cz, R, R * 0.4, R, rust(r), 'metal', 14, 6);
            for (let k = 1; k < H / 2; k++) b.cyl(cx, y0 + k * 2, cz, R + 0.04, 0.1, '#2b2420', 'metal', 14);
            ctx.circle(cx, cz, R + 0.2, H);
        } else { // generator tank
            const H = 11 + r() * 3.5;
            b.cyl(cx, y0, cz, R, H, rust(r), 'metal', 24);
            for (let k = 1; k < H / 1.8; k++) b.cyl(cx, y0 + k * 1.8, cz, R + 0.05, 0.12, '#2b2420', 'metal', 24); // riveted seams
            b.sphere(cx, y0 + H, cz, R, R * 0.42, R, rust(r), 'metal', 24, 8); // domed top
            b.cyl(cx, y0 + H + R * 0.36, cz, 0.7, 1.4, '#3a2f29', 'metal', 10); b.cyl(cx, y0 + H + R * 0.36 + 1.4, cz, 0.9, 0.3, '#3a2f29', 'metal', 10);
            // braced frame: 6 posts around the tank to above the dome, ring beams, diagonal braces
            const fr = R + 1.0;
            for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2, t2 = (a + 1) / 6 * Math.PI * 2, px = cx + Math.cos(t) * fr, pz = cz + Math.sin(t) * fr, qx = cx + Math.cos(t2) * fr, qz = cz + Math.sin(t2) * fr;
                b.box(px, y0, pz, 0.35, H + 1.2, 0.35, '#2e2620', 'metal', -t);
                for (const yy of [H * 0.35, H * 0.7, H + 1.0]) b.rod([px, y0 + yy, pz], [qx, y0 + yy, qz], 0.12, '#2e2620', 'metal', 5);
                b.rod([px, y0 + H * 0.35, pz], [qx, y0 + H * 0.7, qz], 0.07, '#2e2620', 'metal', 4); }
            b.cyl(cx, y0 + H * 0.7, cz, fr + 0.4, 0.1, '#33291f', 'metal', 24); // catwalk
            ctx.circle(cx, cz, fr + 0.3, H + 2);
            hubs.push([cx, y0, cz]);
        }
    }
    hubs.sort((p, q) => p[2] - q[2]);
    // horizontal pipe runs on trestles between neighbouring structures (≈ 4.5 m up), with drops into the tanks
    for (let i = 1; i < hubs.length; i++) {
        const a = hubs[i - 1], c = hubs[i], yy = Math.max(a[1], c[1]) + 4.2 + (i % 2) * 1.1, rr = 0.42 + (i % 3) * 0.08;
        b.rod([a[0], yy, a[2]], [c[0], yy, c[2]], rr, rust(r), 'metal', 10);
        b.rod([a[0], a[1] + 1.5, a[2]], [a[0], yy, a[2]], rr, rust(r), 'metal', 10);
        const L = Math.hypot(c[0] - a[0], c[2] - a[2]); for (let t = 4; t < L - 2; t += 6) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[2] + (c[2] - a[2]) * t / L; b.box(x, g.heightAt(x, z), z, 0.25, yy - g.heightAt(x, z), 0.25, '#2e2620', 'metal'); }
    }
    { const a = hubs[0], c = hubs[hubs.length - 1]; if (a && c) { const yy = a[1] + 2.6; b.rod([a[0] - 6, yy, a[2] + 4], [c[0] + 6, yy, c[2] + 4], 0.5, rust(r), 'metal', 10); } }
    // pipelines (OSM man_made=pipeline) as rusty pipes on supports
    for (const a of d.areas.filter((x) => x.man_made === 'pipeline' && x.poly.every(([px]) => px < 90))) { const pts = a.poly.map(([x, z]) => [x, g.heightAt(x, z) + (a.layer ? 6 : 1.2), z]); for (let i = 1; i < pts.length; i++) b.rod(pts[i - 1], pts[i], 0.35, rust(r), 'metal', 8); for (const p of pts) b.rod([p[0], g.heightAt(p[0], p[2]), p[2]], p, 0.12, '#2e2a26', 'metal', 5); }
    ctx.add(b.build('gas-towers'));
    // the chain-link fence around the structure (OSM w4835090, 2 m) — no climbing
    const fenceA = d.areas.find((a) => a.id === 'w4835090');
    if (fenceA) {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = 'rgba(150,154,158,0.95)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.moveTo(32, 64); x.lineTo(64, 32); x.moveTo(0, 32); x.lineTo(32, 64); x.moveTo(32, 0); x.lineTo(64, 32); x.stroke();
        const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
        const p = fenceA.poly, fb = new GeoBatch();
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ya = g.heightAt(ax, az), yb = g.heightAt(bx, bz);
            fb.quad([ax, ya, az], [bx, yb, bz], [bx, yb + 2.4, bz], [ax, ya + 2.4, az], '#ffffff', 'fence', [0, 0, L / 0.12, 0, L / 0.12, 2.4 / 0.12, 0, 2.4 / 0.12]);
            for (let s = 0; s <= L; s += 3) { const t = s / L; fb.rod([ax + (bx - ax) * t, ya, az + (bz - az) * t], [ax + (bx - ax) * t, ya + 2.5, az + (bz - az) * t], 0.035, '#8f9498', 'steel', 5); }
            ctx.collider({ wall: true, ax, az, bx, bz, y0a: ya - 2, y1a: ya + 2.5, y0b: yb - 2, y1b: yb + 2.5, nx: 0, nz: 1 });
        }
        ctx.add(fb.build('tower-fence', { matOverrides: { fence: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }) } }));
        // DANGER signs
        import('../props.js').then(({ signBoard }) => { const s = signBoard('DANGER — KEEP OUT', 1.2, 0.4, { bg: '#c81e1e', fg: '#ffffff', font: (q) => `800 ${q}px Arial, sans-serif` }); const [cx, cz] = [p[0][0], p[0][1]]; s.position.set(cx - 0.3, g.heightAt(cx, cz) + 1.5, cz); s.rotation.y = -Math.PI / 2; ctx.add(s); });
    }
}
function buildPlayBarn(ctx) {
    const g = ctx.ground, d = ctx.data, b = new GeoBatch(), r = rng(8);
    // The two long sheds east of the lawn are the mapped buildings w52137309 (south: the Play Barn, the former
    // exhauster-compressor house) and w52137316 (north: the picnic shelter, the former boiler house). Street View
    // (2012 pano on the path at their west end) shows the south one open at the sides, white timber posts braced by
    // white wedge-shaped panels, a low grey corrugated roof, a concrete floor three steps above the path and the
    // machinery inside painted red, orange and pink, with tall blue and white vessels at its corner; the north one is
    // a taller grey shed. Built on the mapped footprints; eaves, ridges, post spacing and the machinery layout are
    // estimates.
    const pal = ['#d6262b', '#e8611c', '#d6262b', '#c9538f', '#e8611c', '#f2b51d'], white = '#dcdad3', roofC = '#74787b';
    for (const [id, kind] of [['w52137309', 'barn'], ['w52137316', 'shelter']]) {
        const bd = d.buildings.find((x) => x.id === id); if (!bd) continue;
        ctx.skipBuildings.add(id);
        const bb = polyBox(bd.poly), x0 = bb.x0, x1 = bb.x1, z0 = bb.z0, z1 = bb.z1, zm = (z0 + z1) / 2, y = Math.max(g.heightAt(x0, z0), g.heightAt(x0, z1), g.heightAt(x1, z0), g.heightAt(x1, z1), g.heightAt((x0 + x1) / 2, zm)) + 0.4, barn = kind === 'barn', eave = barn ? 4.2 : 6.5, ridge = barn ? 7.2 : 10.5;
        b.box((x0 + x1) / 2, y - 2.6, zm, x1 - x0, 2.6, z1 - z0 - (barn ? 0 : 0.04), '#a9a69d', 'concrete'); g.addBox((x0 + x1) / 2, zm, (x1 - x0) / 2, (z1 - z0) / 2, 0, y - 2.6, y);
        for (let k = 1; k <= 2; k++) { b.box(x0 - 0.35 * k, y - 1.4, zm, 0.36, 1.4 - 0.133 * k, z1 - z0, '#b3b0a7', 'concrete'); g.addBox(x0 - 0.35 * k, zm, 0.18, (z1 - z0) / 2, 0, y - 1.4, y - 0.133 * k); } // steps at the west end
        const nb = Math.round((x1 - x0) / 6.5), nz = Math.round((z1 - z0) / 3.3);
        for (let i = 0; i <= nb; i++) { const x = x0 + 0.3 + (x1 - x0 - 0.6) * i / nb; for (const z of [z0 + 0.3, z1 - 0.3]) { b.box(x, y, z, 0.3, eave, 0.3, white, 'wood'); ctx.circle(x, z, 0.24, eave); } b.box(x, y, zm, 0.3, ridge, 0.3, white, 'wood'); ctx.circle(x, zm, 0.24, eave);
            b.rod([x, y + eave, z0 + 0.3], [x, y + ridge, zm], 0.12, white, 'wood', 5); b.rod([x, y + eave, z1 - 0.3], [x, y + ridge, zm], 0.12, white, 'wood', 5); }
        // west end: posts with the white wedge braces between them
        for (let j = 0; j <= nz; j++) { const z = z0 + 0.3 + (z1 - z0 - 0.6) * j / nz, h = eave + (ridge - eave) * (1 - Math.abs(z - zm) / ((z1 - z0) / 2)); if (j > 0 && j < nz && Math.abs(z - zm) > 0.4) { b.box(x0 + 0.3, y, z, 0.26, h, 0.26, white, 'wood'); ctx.circle(x0 + 0.3, z, 0.2, eave); }
            if (j < nz && j % 2 === 0) { const zb = z0 + 0.3 + (z1 - z0 - 0.6) * (j + 1) / nz, zc = (z + zb) / 2; b.quad([x0 + 0.3, y + eave - 0.1, z + 0.3], [x0 + 0.3, y + eave - 0.1, zb - 0.3], [x0 + 0.3, y + 0.6, zc + 0.25], [x0 + 0.3, y + 0.6, zc - 0.25], white, 'wood'); b.quad([x0 + 0.3, y + eave - 0.1, zb - 0.3], [x0 + 0.3, y + eave - 0.1, z + 0.3], [x0 + 0.3, y + 0.6, zc - 0.25], [x0 + 0.3, y + 0.6, zc + 0.25], white, 'wood'); } }
        if (!barn) for (const z of [z0 + 0.15, z1 - 0.15]) b.box((x0 + x1) / 2, y + 3.2, z, x1 - x0, eave - 3.2, 0.12, '#8d9194', 'metal'); // grey siding above the open sides
        for (const [za, zb] of [[z0 - 0.8, zm], [z1 + 0.8, zm]]) { const ya = y + eave - 0.2; b.quad([x0 - 0.8, ya, za], [x1 + 0.8, ya, za], [x1 + 0.8, y + ridge + 0.1, zb], [x0 - 0.8, y + ridge + 0.1, zb], roofC, 'roofs'); b.quad([x1 + 0.8, ya, za], [x0 - 0.8, ya, za], [x0 - 0.8, y + ridge + 0.1, zb], [x1 + 0.8, y + ridge + 0.1, zb], '#5d6164', 'roofs'); }
        if (barn) { // the painted exhauster-compressors: flywheel, cylinder block and pipe on a bed, in a row
            for (let i = 0; i < 6; i++) {
                const x = x0 + 8 + i * (x1 - x0 - 14) / 5, z = zm + (i % 2 ? 2.8 : -2.8), c = r.pick(pal), c2 = r.pick(pal);
                b.box(x, y, z, 4.6, 0.5, 2.2, '#8a8780', 'concrete'); b.box(x - 0.8, y + 0.5, z, 2.4, 1.5, 1.5, c, 'paint');
                b.cyl(x + 1.5, y + 1.7, z, 1.25, 0.32, c2, 'paint', 20, 1, Math.PI / 2); b.cyl(x + 1.5, y + 1.7, z, 0.25, 1.0, '#3b3b3b', 'paint', 10, 1, Math.PI / 2);
                b.rod([x - 0.8, y + 2.0, z], [x - 0.8, y + 3.3, z], 0.2, r.pick(pal), 'paint', 8); b.rod([x - 0.8, y + 3.3, z], [x + 2.6, y + 3.3, z + (i % 2 ? -2.8 : 2.8)], 0.2, r.pick(pal), 'paint', 8);
                ctx.box(x, z, 2.3, 1.1, 0, { prop: true, h: 2.9 });
            }
            // the tall painted vessels at the barn's south-west corner
            for (const [dx, dz, R, H, c] of [[3.2, 3.0, 1.5, 8.5, '#2f6db5'], [6.6, 2.6, 1.3, 4.6, '#e9e9e4']]) { const x = x0 + dx, z = z1 - dz; b.cyl(x, y, z, R, H, c, 'paint', 18); b.sphere(x, y + H, z, R, R * 0.35, R, c, 'paint', 18, 6); b.rod([x - R, y + H * 0.8, z], [x - R - 0.4, y + 1.5, z], 0.12, '#d6262b', 'paint', 6); ctx.circle(x, z, R + 0.1, H); }
        } else { // picnic tables
            for (let i = 0; i < 7; i++) { const x = x0 + 5 + i * (x1 - x0 - 10) / 6, z = zm + (i % 2 ? 3.4 : -3.4); b.box(x, y + 0.72, z, 1.9, 0.07, 0.8, '#8a6a48', 'wood'); for (const sz of [-0.75, 0.75]) b.box(x, y + 0.42, z + sz, 1.9, 0.06, 0.28, '#8a6a48', 'wood'); for (const sx of [-0.7, 0.7]) b.box(x + sx, y, z, 0.08, 0.72, 1.5, '#5d6266', 'metal'); ctx.box(x, z, 0.95, 0.9, 0, { prop: true, h: 0.8 }); }
        }
    }
    // the relics on the lawn west of the barn (OSM building=industrial w406480498–w406480503 and w406480507, tied by
    // man_made=pipeline ways). Street View (same pano, looking south-west): slender rust-brown towers some 15–20 m
    // tall with platforms and ladders, fat pipes sweeping down from their heads, a row of three low vessels by the
    // path (the 2.8 × 8.2 m footprint w406480503) and a small grey shed. Plan sizes are the mapped footprints'.
    const heads = [];
    for (const bd of d.buildings.filter((x) => x.k === 'industrial' || x.id === 'w406480507')) {
        ctx.skipBuildings.add(bd.id); const [cx, cz] = centroid(bd.poly), bb = polyBox(bd.poly), w = bb.x1 - bb.x0, dd = bb.z1 - bb.z0, yy = g.heightAt(cx, cz);
        if (bd.poly.length > 8) {
            const R = (w + dd) / 4, H = 15 + r() * 5, c = ['#6e4228', '#7a4a2c', '#5b3a26', '#8a5532'][Math.floor(r() * 4)];
            b.cyl(cx, yy, cz, R, H, c, 'metal', 16); b.cyl(cx, yy + H, cz, R * 0.6, 1.2, rust(r), 'metal', 12, 0.6);
            for (let k = 1; k < H / 3; k++) b.cyl(cx, yy + k * 3, cz, R + 0.05, 0.14, '#2b2420', 'metal', 16);
            b.cyl(cx, yy + H * 0.72, cz, R + 0.9, 0.1, '#33291f', 'metal', 16); for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; b.rod([cx + Math.cos(t) * (R + 0.9), yy + H * 0.72, cz + Math.sin(t) * (R + 0.9)], [cx + Math.cos(t) * (R + 0.9), yy + H * 0.72 + 1, cz + Math.sin(t) * (R + 0.9)], 0.03, '#33291f', 'metal', 4); }
            b.box(cx + R + 0.2, yy, cz, 0.08, H, 0.45, '#2a2622', 'metal');
            ctx.circle(cx, cz, R + 0.15, H); heads.push([cx, yy, cz, R, H]);
        } else if (dd > 2 * w) { // three low vessels in a row
            for (let k = 0; k < 3; k++) { const z = bb.z0 + dd * (k + 0.5) / 3, R = Math.min(w, dd / 3) / 2 - 0.05, H = 4.2; b.cyl(cx, yy, z, R, H, rust(r), 'metal', 14); b.sphere(cx, yy + H, z, R, R * 0.5, R, rust(r), 'metal', 14, 6); b.cyl(cx, yy + H + R * 0.4, z, R * 0.4, 0.8, rust(r), 'metal', 10); }
            ctx.box(cx, cz, w / 2, dd / 2, 0, { prop: true, h: 5 });
        } else { const H = 2.8; b.box(cx, yy, cz, w, H, dd, '#9a9d9f', 'metal'); b.box(cx, yy + H, cz, w + 0.4, 0.15, dd + 0.4, '#6f7377', 'roofs'); ctx.box(cx, cz, w / 2, dd / 2, 0, { prop: true, h: H }); }
    }
    // the sweeping pipes: from each tower's head down to 3.5 m, then across to its neighbour
    heads.sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < heads.length; i++) { const a = heads[i - 1], c = heads[i], col = rust(r), ya = a[1] + a[4] * 0.9, ym = Math.max(a[1], c[1]) + 3.5, mx = a[0] + (c[0] - a[0]) * 0.25, mz = a[2] + (c[2] - a[2]) * 0.25;
        b.tube([[a[0], ya, a[2]], [a[0] + (mx - a[0]) * 0.5, ya + 0.6, a[2] + (mz - a[2]) * 0.5], [mx, ya - 2, mz], [mx, ym + 1, mz], [mx + (c[0] - mx) * 0.15, ym, mz + (c[2] - mz) * 0.15], [c[0], ym, c[2]]], 0.4, col, 'metal', 8); }
    // Concrete Train Trestles (OSM tourism=artwork w405794428): the row of concrete bents left from the coal trestle
    { const a = d.areas.find((x) => x.id === 'w405794428'); if (a) { const bb = polyBox(a.poly), zc = (bb.z0 + bb.z1) / 2, n = Math.round((bb.x1 - bb.x0) / 5.5);
        for (let i = 0; i <= n; i++) { const x = bb.x0 + (bb.x1 - bb.x0) * i / n, y = g.heightAt(x, zc); for (const sz of [-1.4, 1.4]) b.box(x, y, zc + sz, 0.6, 2.6, 0.6, '#aaa69c', 'concrete', 0, 0, 0); b.box(x, y + 2.6, zc, 0.7, 0.6, 3.8, '#aaa69c', 'concrete'); ctx.box(x, zc, 0.4, 1.9, 0, { prop: true, h: 3.2 }); } } }
    ctx.add(b.build('play-barn'));
}
function buildKiteHill(ctx) {
    const g = ctx.ground;
    // Kite Hill is the USGS 1 m DEM's mound now (fine-dem-gas-works.js): summit +9.5 m at the mapped peak. The synthetic
    // mound that replaced the 20 m grid's bumps is gone with them.
    // the mosaic sundial on top (stylised pattern, not a copy of the artwork): concentric rings + radial hour marks
    ctx.painter.custom((x, T, k, isMask) => {
        if (isMask) return;
        const [cx, cy] = T(KITE.x, KITE.z), R = 4.23 * k; // 27'9" across (OSM n31096103 "measurements")
        const cols = ['#c9b37a', '#3a6a8c', '#b5513a', '#e8dfc7', '#4d7a4a', '#8a5a9a', '#d79b2b'];
        for (let i = 6; i >= 1; i--) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(cx, cy, R * i / 6, 0, 7); x.fill(); }
        x.strokeStyle = '#2b2b2b'; x.lineWidth = Math.max(1, 0.08 * k);
        for (let h = 0; h < 24; h++) { const a = h / 24 * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.35, cy + Math.sin(a) * R * 0.35); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); }
        const r = rng(4); for (let i = 0; i < 600; i++) { const a = r() * 6.28, rr = r() * R; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(1, 0.12 * k), Math.max(1, 0.12 * k)); }
    });
}

/**
 * The high bridges west and east of the park, at their mapped positions (they are what closes the view along the
 * Ship Canal from Kite Hill): the Aurora Bridge (OSM man_made=bridge w370645739, bridge=cantilever;truss, steel;
 * 47.65120 → 47.64315 N along 122.3473 W, deck 51 m above the water) and the I-5 Ship Canal Bridge (OSM motorway
 * bridge ways w4644173 / w474077561 along 122.3225 W; a double-deck steel truss, 55 m above the water, 1,350 m long).
 * Silhouettes only: pier spacing, truss depth and member sizes are estimates.
 */
function buildCanalBridges(ctx) {
    const b = new GeoBatch(), E = ctx.data.origin.elev, P = (la, lo) => { const p = ctx.ll(la, lo); return [p.x, p.z]; };
    const steel = '#5e6b6e', conc = '#a9a69d', bedY = LAKE_Y - 6;
    const span = (a, c, n, f) => { for (let i = 0; i < n; i++) f(i / n, (i + 1) / n, [lerp(a[0], c[0], i / n), lerp(a[1], c[1], i / n)], [lerp(a[0], c[0], (i + 1) / n), lerp(a[1], c[1], (i + 1) / n)]); };
    { // Aurora Bridge: deck 43.5 m NAVD88 at the north abutment, 56 m over the canal; the cantilever truss hangs below
      // the deck, deepest over the two main piers
        const n0 = P(47.65120, -122.34733), s0 = P(47.64315, -122.34721), L = Math.hypot(s0[0] - n0[0], s0[1] - n0[1]);
        const deckY = (t) => lerp(43.5, 56, smooth(0, 0.55, t)) - lerp(0, 4, smooth(0.6, 1, t)) - E, yaw = Math.atan2(s0[0] - n0[0], s0[1] - n0[1]);
        const tA = 0.44, tB = 0.60; // main piers either side of the canal (main span 145 m of 898 m)
        const depth = (t) => 5 + 17 * Math.max(0, 1 - Math.min(Math.abs(t - tA), Math.abs(t - tB)) / 0.085) * (t > tA - 0.085 && t < tB + 0.085 ? 1 : 0);
        span(n0, s0, 60, (ta, tb, p, q) => {
            const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, ya = deckY(ta), yb = deckY(tb), len = L / 60;
            b.box(mx, (ya + yb) / 2 - 1.6, mz, 21.3, 1.6, len + 0.2, conc, 'concrete', yaw);
            if (ta > tA - 0.09 && tb < tB + 0.09) for (const sd of [-8, 8]) {
                const ox = Math.cos(yaw) * sd, oz = -Math.sin(yaw) * sd, da = depth(ta), db = depth(tb);
                b.rod([p[0] + ox, ya - 1.6 - da, p[1] + oz], [q[0] + ox, yb - 1.6 - db, q[1] + oz], 0.45, steel, 'steel', 5);
                b.rod([p[0] + ox, ya - 1.6, p[1] + oz], [p[0] + ox, ya - 1.6 - da, p[1] + oz], 0.3, steel, 'steel', 4);
                b.rod([p[0] + ox, ya - 1.6, p[1] + oz], [q[0] + ox, yb - 1.6 - db, q[1] + oz], 0.3, steel, 'steel', 4);
            }
        });
        for (const t of [0.1, 0.18, 0.26, 0.34, tA, tB, 0.7, 0.8, 0.9]) {
            const x = lerp(n0[0], s0[0], t), z = lerp(n0[1], s0[1], t), main = t === tA || t === tB, top = deckY(t) - 1.6 - (main ? depth(t) : 0), gy = main ? bedY : Math.min(top - 4, lerp(22, -4, smooth(0, 0.4, t)) + (t > 0.6 ? lerp(-4, 20, smooth(0.62, 1, t)) : 0));
            for (const sd of [-7, 7]) b.box(x + Math.cos(yaw) * sd, gy, z - Math.sin(yaw) * sd, main ? 4 : 2, top - gy, main ? 5 : 2, conc, 'concrete', yaw);
        }
    }
    { // I-5 Ship Canal Bridge: two decks 8 m apart joined by a steel truss on concrete towers
        const n0 = P(47.6585, -122.32245), s0 = P(47.6467, -122.32265), L = Math.hypot(s0[0] - n0[0], s0[1] - n0[1]), yaw = Math.atan2(s0[0] - n0[0], s0[1] - n0[1]);
        const topY = 5 + 55 - E, lowY = topY - 8.5;
        span(n0, s0, 54, (ta, tb, p, q) => {
            const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, len = L / 54;
            b.box(mx, topY - 1.4, mz, 36, 1.4, len + 0.2, conc, 'concrete', yaw); b.box(mx, lowY - 1.2, mz, 20, 1.2, len + 0.2, conc, 'concrete', yaw);
            for (const sd of [-9.5, 9.5]) { const ox = Math.cos(yaw) * sd, oz = -Math.sin(yaw) * sd; b.rod([p[0] + ox, lowY - 1.2, p[1] + oz], [q[0] + ox, topY - 1.4, q[1] + oz], 0.4, steel, 'steel', 4); b.rod([q[0] + ox, lowY - 1.2, q[1] + oz], [q[0] + ox, topY - 1.4, q[1] + oz], 0.3, steel, 'steel', 4); }
        });
        for (let i = 0; i <= 12; i++) { const t = i / 12, x = lerp(n0[0], s0[0], t), z = lerp(n0[1], s0[1], t), gy = (t > 0.38 && t < 0.72) ? bedY : lerp(30, bedY, smooth(0, 0.38, t)) + (t >= 0.72 ? lerp(0, 28, smooth(0.72, 1, t)) : 0), g2 = Math.min(gy, lowY - 6); for (const sd of [-9.5, 9.5]) b.box(x + Math.cos(yaw) * sd, g2, z - Math.sin(yaw) * sd, 3, lowY - 1.2 - g2, 4, conc, 'concrete', yaw); }
    }
    const grp = b.build('canal-bridges', { castShadow: false }); ctx.add(grp);
}

export default {
    env: { fogFar: 7000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('gas-works');
        const lake = d.areas.filter((a) => (a.natural === 'water' || a.waterway === 'canal') && a.poly.length > 3).map((a) => a.poly);
        // real levels: the USGS 1 m DEM on a 5 m grid over the whole promontory (Kite Hill, the Prow 5.9 m above the
        // lake, the shore path 1 m above it); the lake is its flat 4.98 m NAVD88 surface. The OSM lake multipolygon
        // lost its inner rings (the park) in the extract, so the shoreline is the DEM's.
        applyFineDem(g, GAS_DEM, { fade: 10 });
        applyFineDem(g, PROW_DEM, { fade: 5 }); // round 3 (sea-spots-b-5): the Prow and the south shore on a 5 m grid of the same DEM (EPQS answered again)
        const WY = LAKE_Y, BED = WY - 2.5;
        g.mod((x, z, h) => (h < WY + 0.3 ? BED : h));
        g.mod((x, z, h) => (z > 150 ? Math.min(h, lerp(h, BED, smooth(150, 200, z))) : h)); // open lake south of the park
        const wPlane = ctx.water(WY, { x0: -3000, z0: -3000, x1: 3000, z1: 3000 }, [], { depth: 2.5 }); wPlane.visible = false;
        ctx.skipWays.add('w191328703'); // the "Kite Hill" pedestrian disc is the sundial itself, painted below
        buildTowers(ctx);
        buildPlayBarn(ctx);
        ctx.terrainOpts = { bg: '#5f7d3d', innerPx: 2048, outerPad: 420, skirtY: -9, skirtColor: '#1e3238' };
        ctx.osmBackdrop({ paint: {}, urban: false, streetTreeOpts: { spacing: 12, prob: 0.6 }, areaTreeOpts: { conifer: 0.1 } });
        buildKiteHill(ctx); // (after the OSM ground paint: the park's grass used to cover the sundial)
        // lakeside lawns get a few big trees; picnic benches near the shelter
        const rr = rng(12); for (let i = 0; i < 40; i++) { const x = -150 + rr() * 300, z = -110 + rr() * 220; if (Math.hypot(x - KITE.x, z - KITE.z) < KITE.r + 14 || (x > 20 && x < 135 && z > -35 && z < 128) || (x > 135 && z > -65 && z < 5) || g.heightAt(x, z) < WY + 0.8) continue; ctx.trees.push({ x, z, kind: rr() < 0.1 ? 'con' : 'broad', s: 0.8 + rr() * 0.5 }); }
        { const b = new GeoBatch(); for (const [x, z, a] of [[10, 110, Math.PI], [20, 112, Math.PI], [-20, 95, 2.6], [150, 60, -2]]) { bench(b, x, g.heightAt(x, z), z, a); ctx.box(x, z, 0.9, 0.3, a, { prop: true, h: 0.45 }); } ctx.add(b.build('benches')); }
        // skyline + Needle across Lake Union (SSW): real towers at true distance, SLU / Eastlake / Westlake blocks, the city
        // ground with the lake carved deep, the lake surface
        const W = sp.extent.polygon, xs = W.map((p) => p[0]), zs = W.map((p) => p[1]), m8 = (v) => Math.round(v / 8) * 8, OUT = 420;
        const hole = { x0: m8(Math.min(...xs) - 60) - OUT + 16, z0: m8(Math.min(...zs) - 60) - OUT + 16, x1: m8(Math.max(...xs) + 60) + OUT - 16, z1: m8(Math.max(...zs) + 60) + OUT - 16 };
        const bd = seaBackdrop(ctx, { clear: 420, eyeY: 1.6, needleDetail: 1, bay: false, cranes: false,
            midrise: 2200, midClear: 520, midBox: [47.598, -122.372, 47.6445, -122.312],
            ground: { box: { x0: -3600, z0: -2600, x1: 3200, z1: 5400 }, hole, step: 24, lakeY: -12 },
            trees: 2200, treeClear: 500 });
        const lakeW = seaWater(ctx, WY, { box: { x0: -4000, z0: -3000, x1: 4000, z1: 6000 }, name: 'lake-union', color: '#1e3238', opacity: 1 });
        ctx.add(lakeW); // (a mirrored-skyline reflection needs render's planar reflection: spec 18 Request)
        buildCanalBridges(ctx);
        // floatplanes moored / taxiing off Kenmore Air's dock (south-west) and a couple of houseboats along the east shore
        { const fb = new GeoBatch(); const plane = (x, z, yaw) => { const c = Math.cos(yaw), s2 = Math.sin(yaw), P = (u, v, y) => [x + c * u + s2 * v, WY + y, z - s2 * u + c * v];
            fb.rod(P(0, -5, 1.7), P(0, 4.5, 1.7), 0.6, '#f2f2ee', 'paint', 10); fb.rod(P(-7, 0, 2.6), P(7, 0, 2.6), 0.12, '#f2f2ee', 'paint', 4);
            for (const u of [-1.3, 1.3]) fb.rod(P(u, -3, 0.25), P(u, 3, 0.25), 0.25, '#d9dcdf', 'paint', 6); fb.box(...P(0, -5.2, 2.1), 0.15, 1.6, 1.2, '#c62828', 'paint', yaw); };
          plane(-260, 420, 0.4); plane(-310, 500, 1.2); plane(120, 640, -0.6);
          for (let i = 0; i < 6; i++) { const x = 330 + i * 9, z = 300 + i * 26; fb.box(x, WY - 0.4, z, 7, 1.2, 12, '#7a6a55', 'wood'); fb.box(x, WY + 0.8, z, 6, 3.4, 9, ['#d9cdb2', '#7da0b5', '#c8695a', '#e8e4da', '#8aa37a', '#d7b05a'][i], 'paint'); }
          ctx.add(fb.build('lake-craft')); }
        // path lamps (night): every ~32 m along the park paths
        { let n = 0; for (const pts of ctx.footLines()) { let acc = 0; for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc += L; if (acc > 32 && n < 70) { acc = 0; n++; ctx.lampPoints.push({ x: pts[i][0] + 1.2, z: pts[i][1], rot: 0 }); } } } }
        // plaques: Richard Haag credited; the fence is a safety message too
        const PL = sp.plaques;
        ctx.plaque(PL[0], 36, 2, Math.PI * 0.5, { credit: 'The structures are fenced: three fatal falls (2012, 2022, 2025) — please admire from outside.' });
        ctx.plaque(PL[1], -40, 56, 0.6, { credit: 'Landscape architect: Richard Haag (park opened 1975).' });
        ctx.plaque(PL[2], 92, 100, Math.PI);
        ctx.challenge('gas-works', { r: 14, tol: 35 });
        ctx.extras.seaBackdrop = bd;
        // fun: fly a kite on Kite Hill (height from the real wind)
        const kite = new THREE.Group(); kite.name = 'kite'; kite.visible = false;
        const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0.45, 0, 0), new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(-0.45, 0, 0)]).setIndex([0, 1, 2, 0, 2, 3]), new THREE.MeshStandardMaterial({ color: '#e53935', side: THREE.DoubleSide })); sail.geometry.computeVertexNormals(); kite.add(sail);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f5f5f5' }));
        ctx.add(kite, line); line.visible = false;
        const flow = activityFlow(ctx);
        const labels = ['Let out the line', 'Steady the kite', 'Reel it in'];
        const hideKite = () => { kite.visible = line.visible = false; };
        ctx.extras.kite = { object:kite, line };
        ctx.interactables.push({ kind:'kite',x:KITE.x,z:KITE.z,r:9,label:'Fly a kite on Kite Hill',use:s => {
            if ((s.r3d.weather?.windKmh ?? 10) < 4) { s.ui.toast('🪁 Waiting for a breeze','The kite needs a little wind. Try again when the breeze picks up.'); return; }
            const p=s.position,dir=((s.r3d.weather?.windDir??200)+180)*Math.PI/180,L=Math.min(20,8+(s.r3d.weather?.windKmh??10)*.45);
            flow.begin(s,{
                title:'Kite Hill',focus:{x:p.x+Math.sin(dir)*L*.7,y:p.y+1.4+L*.7,z:p.z-Math.cos(dir)*L*.7},action:labels[0],help:'Let out the line, hold the kite in the breeze, then bring it back. Each action moves the kite; Leave or Esc packs it away.',
                started(s,r) { r.stage=0;r.length=.7;r.top=Math.min(20,8+(s.r3d.weather?.windKmh??10)*.45);kite.visible=line.visible=true;r.status.textContent='Ready to launch'; },
                actioned(s,r) { r.busy=true;r.t=0;r.from=r.length;r.to=r.stage===2?.7:r.top; },
                update(dt,s,r) {
                    if(r.busy){r.t+=dt;const t=Math.min(1,r.t/2.2);r.length=lerp(r.from,r.to,smooth(0,1,t));r.progress.value=(r.stage+t)/3;
                        if(t===1){if(r.stage===2){flow.complete();return;}r.stage++;r.busy=false;r.button.textContent=labels[r.stage];r.status.textContent=r.stage===1?'Airborne · steady the line':'Steady · bring the kite home';}}
                    const pl=s.position,w=s.r3d.weather,dir=((w?.windDir??200)+180)*Math.PI/180,L=r.length,t=s.t;
                    const sway=Math.min(1,L/8),kx=pl.x+Math.sin(dir)*L*.7+Math.sin(t*.9)*sway,kz=pl.z-Math.cos(dir)*L*.7+Math.cos(t*.7)*sway,ky=pl.y+1.4+L*.7+Math.sin(t*1.3)*sway*.5;
                    kite.position.set(kx,ky,kz);kite.lookAt(pl.x,pl.y+1.4,pl.z);kite.rotateZ(Math.sin(t*2)*.3*sway);
                    const pa=line.geometry.attributes.position;pa.setXYZ(0,pl.x,pl.y+1.3,pl.z);pa.setXYZ(1,kx,ky,kz);pa.needsUpdate=true;line.geometry.computeBoundingSphere();
                },cancel:hideKite,complete(s){hideKite();seaActivity(s,'lm-gasworks-kite','gas-works');s.ui.toast('🪁 Back in hand','Launched, steadied and reeled in on Kite Hill.');},
            });
        }});
        // crowd: kite flyers + picnics on the hill, joggers, photographers at the Prow facing the skyline
        ctx.crowdCfg = {
            personas: { local: 4, tech: 2, tourist_us: 3, photographer: 1.5, kid: 2, tourist_cn: 1, tourist_kr: 1, tourist_jp: 1, tourist_de: 1, tourist_es: 1, tourist_in: 1, tourist_ca: 1 },
            walkers: 18, paths: ctx.footLines(),
            groups: [
                { x: KITE.x, z: KITE.z, r: 6, n: 7, act: 'watch', look: [KITE.x + 40, KITE.z + 60], y: (x, z) => g.heightAt(x, z), personas: ['local', 'kid', 'tourist_us', 'tech'] },
                { x: KITE.x + 14, z: KITE.z + 10, r: 4, n: 5, act: 'sit', look: [100, 400], y: (x, z) => g.heightAt(x, z), personas: ['local', 'tech', 'tourist_us'] },
                { x: 81, z: 112, r: 3.5, n: 6, act: 'photo', look: [-600, 2200], personas: ['photographer', 'tourist_us', 'tourist_jp', 'tourist_kr'] },
                { x: 30, z: 60, r: 3, n: 4, act: 'watch', look: [60, 50], personas: ['tourist_de', 'tourist_es', 'kid', 'guide'] },
                { x: 150, z: -12, r: 5, n: 6, act: 'talk', personas: ['kid', 'local', 'tourist_us'] },
            ],
        };
        ctx.sound('wind', KITE.x, KITE.z, 120, 1.2); ctx.sound('water', 60, 140, 80, 0.8); ctx.sound('gulls', 60, 160, 200, 1); ctx.sound('traffic', 0, -200, 160, 0.5);
        ctx.spawns['gas-works'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
        void inPoly;
    },
};
