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

const KITE = { x: -58, z: 31, h: 9.5, r: 34 };

function rust(r) { return ['#5b3a26', '#6e4228', '#4a3428', '#7a4a2c', '#3c2f2a', '#8a5532', '#2e2a28'][Math.floor(r() * 7)]; }
function buildTowers(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), r = rng(19);
    const big = ['w191328736', 'w191328732', 'w191328724', 'w191328731', 'w191328734', 'w191328729', 'w986412515'].map((id) => d.buildings.find((x) => x.id === id)).filter(Boolean);
    const small = d.buildings.filter((x) => /^w4496263/.test(x.id));
    for (const id of [...big, ...small]) ctx.skipBuildings.add(id.id);
    // round 5 (note 65, refs: Commons "Gas works from the hill 01", "Gas works at Gas Works Park"): two clusters of fat
    // riveted generator tanks (≈ 7 m Ø, 11–14 m, domed tops with a small cupola, braced steel frames and catwalks around
    // them) between tall slender stacks (≈ 2.6 m Ø, 22–26 m), tied by horizontal pipes on trestles ≈ 3–5 m up
    const hubs = [];
    big.forEach((bd, i) => {
        const [cx, cz] = centroid(bd.poly), y0 = g.heightAt(cx, cz), stack = i % 3 === 1;
        if (stack) {
            const H = 22 + r() * 4, R = 1.3;
            b.cyl(cx, y0, cz, R, H, rust(r), 'metal', 16);
            for (let k = 1; k < H / 3; k++) b.cyl(cx, y0 + k * 3, cz, R + 0.06, 0.14, '#2b2420', 'metal', 16);
            b.cyl(cx, y0 + H * 0.7, cz, R + 0.9, 0.12, '#33291f', 'metal', 16); // platform
            for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; b.rod([cx + Math.cos(t) * (R + 0.9), y0 + H * 0.7, cz + Math.sin(t) * (R + 0.9)], [cx + Math.cos(t) * (R + 0.9), y0 + H * 0.7 + 1, cz + Math.sin(t) * (R + 0.9)], 0.03, '#33291f', 'metal', 4); }
            b.cyl(cx, y0 + H, cz, R * 0.8, 0.8, '#3a2f29', 'metal', 12, 0.7);
            b.box(cx + R + 0.25, y0, cz, 0.08, H, 0.5, '#2a2622', 'metal');
            ctx.circle(cx, cz, R + 0.2, H);
        } else {
            const H = 11 + r() * 3.5, R = 3.3 + r() * 0.6;
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
        }
        hubs.push([cx, y0, cz]);
    });
    // horizontal pipe runs on trestles between neighbouring structures (≈ 4.5 m up), with drops into the tanks
    for (let i = 1; i < hubs.length; i++) {
        const a = hubs[i - 1], c = hubs[i], yy = Math.max(a[1], c[1]) + 4.2 + (i % 2) * 1.1, rr = 0.42 + (i % 3) * 0.08;
        b.rod([a[0], yy, a[2]], [c[0], yy, c[2]], rr, rust(r), 'metal', 10);
        b.rod([a[0], a[1] + 1.5, a[2]], [a[0], yy, a[2]], rr, rust(r), 'metal', 10);
        const L = Math.hypot(c[0] - a[0], c[2] - a[2]); for (let t = 4; t < L - 2; t += 6) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[2] + (c[2] - a[2]) * t / L; b.box(x, g.heightAt(x, z), z, 0.25, yy - g.heightAt(x, z), 0.25, '#2e2620', 'metal'); }
    }
    { const a = hubs[0], c = hubs[hubs.length - 1]; if (a && c) { const yy = a[1] + 2.6; b.rod([a[0] - 6, yy, a[2] + 4], [c[0] + 6, yy, c[2] + 4], 0.5, rust(r), 'metal', 10); } }
    for (const sd of small) { const [cx, cz] = centroid(sd.poly), y0 = g.heightAt(cx, cz); b.cyl(cx, y0, cz, 1.3, 6 + r() * 4, rust(r), 'metal', 12); }
    // pipelines (OSM man_made=pipeline) as rusty pipes on supports
    for (const a of d.areas.filter((x) => x.man_made === 'pipeline')) { const pts = a.poly.map(([x, z]) => [x, g.heightAt(x, z) + (a.layer ? 6 : 1.2), z]); for (let i = 1; i < pts.length; i++) b.rod(pts[i - 1], pts[i], 0.35, rust(r), 'metal', 8); for (const p of pts) b.rod([p[0], g.heightAt(p[0], p[2]), p[2]], p, 0.12, '#2e2a26', 'metal', 5); }
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
        ctx.add(fb.build('tower-fence', { matOverrides: { fence: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }) } }));
        // DANGER signs
        import('../props.js').then(({ signBoard }) => { const s = signBoard('DANGER — KEEP OUT', 1.2, 0.4, { bg: '#c81e1e', fg: '#ffffff', font: (q) => `800 ${q}px Arial, sans-serif` }); const [cx, cz] = [p[0][0], p[0][1]]; s.position.set(cx - 0.3, g.heightAt(cx, cz) + 1.5, cz); s.rotation.y = -Math.PI / 2; ctx.add(s); });
    }
}
function buildPlayBarn(ctx) {
    const g = ctx.ground, b = new GeoBatch(), r = rng(8);
    const x0 = 94, x1 = 128, z0 = -32, z1 = 12, y = g.heightAt(111, -10);
    for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 6) for (const z of [z0, z1]) { b.box(x, y, z, 0.5, 7.2, 0.5, '#5a3f2a', 'wood'); ctx.circle(x, z, 0.3, 7); }
    b.box((x0 + x1) / 2, y + 7.2, (z0 + z1) / 2, x1 - x0 + 2, 0.3, z1 - z0 + 2, '#5b4a3c', 'roofs');
    b.add(new THREE.CylinderGeometry(0.01, (z1 - z0) / 2 + 1, 2.6, 4, 1), 'roofs', M((x0 + x1) / 2, y + 8.65, (z0 + z1) / 2, 0, Math.PI / 4, 0, (x1 - x0 + 2) / (z1 - z0 + 2) * 1.414, 1, 1.414), '#5b4a3c');
    // painted exhauster-compressors (OSM industrial footprints) + pipes in bright colours
    const pal = ['#e8611c', '#7b3fa0', '#2f6db5', '#d6262b', '#f2b51d', '#2c9a5b'];
    for (const bd of ctx.data.buildings.filter((x) => x.k === 'industrial' || x.id === 'w406480507')) {
        ctx.skipBuildings.add(bd.id); const [cx, cz] = centroid(bd.poly), bb = polyBox(bd.poly), yy = g.heightAt(cx, cz), c = r.pick(pal);
        b.box(cx, yy, cz, bb.x1 - bb.x0, 2.2 + r() * 1.5, bb.z1 - bb.z0, c, 'paint');
        b.cyl(cx, yy + 2.6, cz, 0.9, 1.2, r.pick(pal), 'paint', 14); b.rod([cx, yy + 3.2, cz], [cx + 4, yy + 4.5, cz + 2], 0.25, r.pick(pal), 'paint', 8);
        ctx.box(cx, cz, (bb.x1 - bb.x0) / 2, (bb.z1 - bb.z0) / 2, 0, { prop: true, h: 2.8 });
    }
    ctx.add(b.build('play-barn'));
}
function buildKiteHill(ctx) {
    const g = ctx.ground;
    // Kite Hill (after round 6: the mound rode on the 20 m DEM's bumps and creased like crumpled paper): the base under the
    // hill is levelled to the mean DEM height round the rim, then one smooth mound rises from it
    { let B = 0, n = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; B += g.heightAt(KITE.x + Math.cos(a) * KITE.r, KITE.z + Math.sin(a) * KITE.r); n++; } B /= n;
      g.mod((x, z, h) => { const d = Math.hypot(x - KITE.x, z - KITE.z); if (d > KITE.r * 1.15) return h;
          const flat = smooth(KITE.r * 1.15, KITE.r * 0.7, d), base = h + (B - h) * flat;
          return base + (d < KITE.r ? KITE.h * Math.pow(Math.cos(d / KITE.r * Math.PI / 2), 1.6) * smooth(KITE.r, KITE.r * 0.2, d) : 0); }); }
    // the mosaic sundial on top (stylised pattern, not a copy of the artwork): concentric rings + radial hour marks
    ctx.painter.custom((x, T, k, isMask) => {
        if (isMask) return;
        const [cx, cy] = T(KITE.x, KITE.z), R = 4.6 * k;
        const cols = ['#c9b37a', '#3a6a8c', '#b5513a', '#e8dfc7', '#4d7a4a', '#8a5a9a', '#d79b2b'];
        for (let i = 6; i >= 1; i--) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(cx, cy, R * i / 6, 0, 7); x.fill(); }
        x.strokeStyle = '#2b2b2b'; x.lineWidth = Math.max(1, 0.08 * k);
        for (let h = 0; h < 24; h++) { const a = h / 24 * Math.PI * 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.35, cy + Math.sin(a) * R * 0.35); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); }
        const r = rng(4); for (let i = 0; i < 600; i++) { const a = r() * 6.28, rr = r() * R; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(1, 0.12 * k), Math.max(1, 0.12 * k)); }
    });
}

export default {
    env: { fogFar: 7000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('gas-works');
        const lake = d.areas.filter((a) => (a.natural === 'water' || a.waterway === 'canal') && a.poly.length > 3).map((a) => a.poly);
        // shoreline from the DEM (Lake Union reads ≈ −5.9 here); the OSM lake multipolygon lost its inner rings (the park) in the extract.
        // (the lake bed sits just under the surface; the surface reflects the sky — skyline reflections await render planar reflections)
        const WY = -4.6, BED = -7.1;
        g.mod((x, z, h) => (h < -3.2 ? BED : h));
        g.mod((x, z, h) => (z > 150 ? Math.min(h, lerp(h, BED, smooth(150, 200, z))) : h)); // open lake south of the park
        const wPlane = ctx.water(WY, { x0: -3000, z0: -3000, x1: 3000, z1: 3000 }, [], { depth: 2.5 }); wPlane.visible = false;
        buildKiteHill(ctx);
        buildTowers(ctx);
        buildPlayBarn(ctx);
        ctx.terrainOpts = { bg: '#5f7d3d', innerPx: 2048, outerPad: 420, skirtY: -9, skirtColor: '#1e3238' };
        ctx.osmBackdrop({ paint: {}, urban: false, streetTreeOpts: { spacing: 12, prob: 0.6 }, areaTreeOpts: { conifer: 0.1 } });
        // lakeside lawns get a few big trees; picnic benches near the shelter
        const rr = rng(12); for (let i = 0; i < 40; i++) { const x = -150 + rr() * 300, z = -110 + rr() * 220; if (Math.hypot(x - KITE.x, z - KITE.z) < KITE.r + 4 || (x > 35 && x < 135 && z > -35 && z < 95) || g.heightAt(x, z) < -3.5) continue; ctx.trees.push({ x, z, kind: rr() < 0.1 ? 'con' : 'broad', s: 0.8 + rr() * 0.5 }); }
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
        let flying = false;
        ctx.interactables.push({ kind: 'kite', x: KITE.x, z: KITE.z, r: 9, label: () => (flying ? 'Reel the kite in' : 'Fly a kite'), use: (s) => { flying = !flying; kite.visible = line.visible = flying; if (flying) { seaActivity(s, 'lm-gasworks-kite', 'gas-works'); const w = s.r3d.weather; s.ui.toast('🪁 Up it goes', w ? `Wind ${Math.round(w.windKmh ?? 10)} km/h — ${(w.windKmh ?? 10) > 12 ? 'great kite weather' : 'a gentle breeze'}.` : 'Catch the breeze.'); } } });
        ctx.onUpdate((dt, s, pl) => {
            if (!flying || !pl) return;
            const w = s.r3d.weather, wind = Math.max(4, w?.windKmh ?? 10), dir = ((w?.windDir ?? 200) + 180) * Math.PI / 180, L = 8 + wind * 1.4, t = s.t;
            const kx = pl.x + Math.sin(dir) * L * 0.7 + Math.sin(t * 0.9) * 2, kz = pl.z - Math.cos(dir) * L * 0.7 + Math.cos(t * 0.7) * 1.5, ky = pl.y + 1.4 + L * 0.7 + Math.sin(t * 1.3) * 1.2;
            kite.position.set(kx, ky, kz); kite.lookAt(pl.x, pl.y + 1.4, pl.z); kite.rotateZ(Math.sin(t * 2) * 0.3);
            const pa = line.geometry.attributes.position; pa.setXYZ(0, pl.x, pl.y + 1.3, pl.z); pa.setXYZ(1, kx, ky, kz); pa.needsUpdate = true; line.geometry.computeBoundingSphere();
        });
        // crowd: kite flyers + picnics on the hill, joggers, photographers at the Prow facing the skyline
        ctx.crowdCfg = {
            personas: { local: 4, tech: 2, tourist_us: 3, photographer: 1.5, kid: 2, tourist_cn: 1, tourist_kr: 1, tourist_jp: 1, tourist_de: 1, tourist_es: 1, tourist_in: 1, tourist_ca: 1 },
            walkers: 18, paths: ctx.footLines(),
            groups: [
                { x: KITE.x, z: KITE.z, r: 6, n: 7, act: 'watch', look: [KITE.x + 40, KITE.z + 60], y: (x, z) => g.heightAt(x, z), personas: ['local', 'kid', 'tourist_us', 'tech'] },
                { x: KITE.x + 14, z: KITE.z + 10, r: 4, n: 5, act: 'sit', look: [100, 400], y: (x, z) => g.heightAt(x, z), personas: ['local', 'tech', 'tourist_us'] },
                { x: 82, z: 106, r: 4, n: 6, act: 'photo', look: [-600, 2200], personas: ['photographer', 'tourist_us', 'tourist_jp', 'tourist_kr'] },
                { x: 30, z: 60, r: 3, n: 4, act: 'watch', look: [60, 50], personas: ['tourist_de', 'tourist_es', 'kid', 'guide'] },
                { x: 110, z: -10, r: 6, n: 6, act: 'talk', personas: ['kid', 'local', 'tourist_us'] },
            ],
        };
        ctx.sound('wind', KITE.x, KITE.z, 120, 1.2); ctx.sound('water', 60, 140, 80, 0.8); ctx.sound('gulls', 60, 160, 200, 1); ctx.sound('traffic', 0, -200, 160, 0.5);
        ctx.spawns['gas-works'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
        void inPoly;
    },
};
