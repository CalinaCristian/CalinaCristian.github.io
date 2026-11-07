// ============================================================================
//  Spring Palace / Palatul Primăverii (Bucharest), 1964–65: the Ceaușescus'
//  residence on Bd. Primăverii, open to visitors since 2016. Cream stucco villa
//  with arched ground-floor windows, brown frames, red tile hipped roofs and a
//  balustraded terrace, the pool wing (OSM ways 549676146 / 549676153, museum
//  grounds 38236017), granite plinth + black wrought-iron fence on the
//  boulevard, rose beds, and the peacocks in the garden (they fan their tails
//  now and then — photograph one for the bonus). Quiet villa / embassy street.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, obb, polyArea, offsetPolyline } from '../kit.js';
import { bucBackdrop, classicFacade, classicWalls, balustrade, balustradeMaterial, palisade, osmPoly, cityFiller, flagpole } from '../buc.js';
import { addTraffic } from '../cars.js';

function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
function hipRoof(b, poly, y, h, col, over = 1.0) { const o = obb(poly); if (!o) return; const g = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.3, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); b.add(g, 'roofs', M(o.cx, y + h / 2, o.cz, 0, -o.angle, 0, o.len + over * 2, h, o.wid + over * 2), col); g.dispose(); }

/** peacocks: walk in the garden, sometimes fan their tails (instanced-free: a few small meshes) */
function peacocks(ctx, area, n = 4) {
    const r = rng(23), birds = [], grp = new THREE.Group(); grp.name = 'peacocks';
    const blue = new THREE.MeshStandardMaterial({ color: '#1f4f8a', roughness: 0.4, metalness: 0.3 }), green = new THREE.MeshStandardMaterial({ color: '#2f6b4a', roughness: 0.5, metalness: 0.2 });
    const fanTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#2f6b4a'; x.beginPath(); x.arc(128, 128, 126, Math.PI, 0); x.fill(); for (let i = 0; i < 70; i++) { const a = Math.PI + r() * Math.PI, rr = 40 + r() * 80; const px = 128 + Math.cos(a) * rr, py = 128 + Math.sin(a) * rr; x.fillStyle = '#c9a24e'; x.beginPath(); x.ellipse(px, py, 7, 9, a, 0, 7); x.fill(); x.fillStyle = '#1f4f8a'; x.beginPath(); x.ellipse(px, py, 4, 5, a, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(px, py, 1.8, 0, 7); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const fanMat = new THREE.MeshStandardMaterial({ map: fanTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5 });
    const bb = polyBox(area);
    for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), blue); body.scale.set(1, 0.85, 1.5); body.position.y = 0.55; g.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.45, 6), blue); neck.position.set(0, 0.85, 0.22); neck.rotation.x = 0.35; g.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), blue); head.position.set(0, 1.08, 0.3); g.add(head);
        const train = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 6), green); train.rotation.x = -Math.PI / 2 - 0.12; train.position.set(0, 0.45, -0.85); g.add(train);
        for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), new THREE.MeshStandardMaterial({ color: '#8a7a6a' })); leg.position.set(s * 0.07, 0.2, 0); g.add(leg); }
        const fan = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), fanMat); fan.position.set(0, 1.15, -0.35); fan.visible = false; g.add(fan);
        let x = 0, z = 0; for (let k = 0; k < 30; k++) { x = bb.x0 + r() * (bb.x1 - bb.x0); z = bb.z0 + r() * (bb.z1 - bb.z0); if (inPoly(x, z, area)) break; }
        g.position.set(x, ctx.ground.heightAt(x, z), z); grp.add(g);
        birds.push({ g, fan, x, z, tx: x, tz: z, wait: r() * 4, show: 0, yaw: r() * 6.28 });
    }
    ctx.add(grp);
    ctx.onUpdate((dt) => {
        for (const b of birds) {
            if (b.show > 0) { b.show -= dt; b.fan.visible = b.show > 0; continue; }
            b.wait -= dt;
            if (b.wait <= 0) { b.wait = 3 + r() * 6; if (r() < 0.25) { b.show = 6 + r() * 6; b.fan.visible = true; continue; } for (let k = 0; k < 10; k++) { const nx = b.x + (r() - 0.5) * 10, nz = b.z + (r() - 0.5) * 10; if (inPoly(nx, nz, area)) { b.tx = nx; b.tz = nz; break; } } }
            const dx = b.tx - b.x, dz = b.tz - b.z, L = Math.hypot(dx, dz);
            if (L > 0.1) { const v = Math.min(L, dt * 0.6); b.x += dx / L * v; b.z += dz / L * v; b.yaw = Math.atan2(dx, dz); }
            b.g.position.set(b.x, ctx.ground.heightAt(b.x, b.z), b.z); b.g.rotation.y = b.yaw;
        }
    });
    return birds;
}

export default {
    env: { fogFar: 2600, ambientCity: 0.25, groundAlbedo: 0.12 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('spring-palace');
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.4);
        const grounds = osmPoly(d, 'w38236017') || [[-55, -34], [-23, 7], [51, -49], [19, -90]];
        const yG = g.heightAt(...centroid(grounds)); g.flatten(grounds, yG, 6);
        const b = new GeoBatch(), WALL = '#dad5c8', TRIM = '#ece8de', ROOF = '#8c4a35';
        const fMain = classicFacade('primaverii', [{ t: 'arch', w: 0.44, top: 0.16, bottom: 0.1, pil: true }, { t: 'rect', w: 0.36, top: 0.22, pil: true }, { t: 'blank' }, { t: 'blank' }], { bay: 3.8, floor: 4.3, glass: '#3a2e26', lit: 0.55 });
        const main = d.buildings.find((x) => x.id === 'w549676146'), pool = d.buildings.find((x) => x.id === 'w549676153');
        let M0 = null;
        for (const bd of [main, pool]) {
            if (!bd) continue; ctx.skipBuildings.add(bd.id);
            const y = yG - 0.1, isPool = bd === pool, H = isPool ? 5.6 : 8.6;
            b.prism(grow(bd.poly, 0.5), y - 0.3, y + 0.6, '#b9b2a4', 'stone');
            classicWalls(b, fMain, bd.poly, y + 0.6, y + H, WALL, y + 0.6);
            b.prism(grow(bd.poly, 0.7), y + H - 0.5, y + H, TRIM, 'stone', { noTop: true });
            if (isPool) { b.flat(bd.poly, y + H, '#8f8a82', 'roofs'); balustrade(b, grow(bd.poly, 0.3), y + H, 1.0, { closed: true }); }
            else { b.prism(grow(bd.poly, 1.0), y + H, y + H + 0.35, '#5a3a2a', 'wood', { noTop: true, bottom: true }); hipRoof(b, bd.poly, y + H + 0.35, 3.6, ROOF, 1.0); M0 = { o: obb(bd.poly), y }; }
            ctx.poly(bd.poly, { y0: y - 1, y1: y + H + 5 });
        }
        // garden terrace with balustrade along the main building's garden side (toward the pool wing)
        if (M0) { const o = M0.o, side = 1; const ty = M0.y + 0.6; const pts = [[-o.len * 0.4, o.wid / 2 + 5], [o.len * 0.4, o.wid / 2 + 5]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v * side, o.cz + o.uz * u + o.ux * v * side]); const terr = [[-o.len * 0.42, o.wid / 2], [o.len * 0.42, o.wid / 2], [o.len * 0.42, o.wid / 2 + 5.3], [-o.len * 0.42, o.wid / 2 + 5.3]].map(([u, v]) => [o.cx + o.ux * u - o.uz * v, o.cz + o.uz * u + o.ux * v]); b.prism(terr, M0.y - 0.3, ty, '#cfc8ba', 'stone'); g.addPoly(terr, ty, M0.y - 2); balustrade(b, pts, ty, 1.0); }
        // granite plinth + black wrought-iron fence round the grounds (gate on the boulevard side)
        const ring = [...grounds, grounds[0]];
        let gateI = 0, gd = 1e9; for (let i = 0; i < grounds.length; i++) { const [ax, az] = grounds[i], [bx, bz] = grounds[(i + 1) % grounds.length], mx = (ax + bx) / 2, mz = (az + bz) / 2, dd = Math.hypot(mx - -60, mz - -60); if (dd < gd) { gd = dd; gateI = i; } }
        const [gax, gaz] = grounds[gateI], [gbx, gbz] = grounds[(gateI + 1) % grounds.length], gmx = (gax + gbx) / 2, gmz = (gaz + gbz) / 2, gL = Math.hypot(gbx - gax, gbz - gaz), gux = (gbx - gax) / gL, guz = (gbz - gaz) / gL;
        const runA = [...ring.slice(gateI + 1), ...ring.slice(1, gateI + 1)], gateA = [gmx - gux * 3, gmz - guz * 3], gateB = [gmx + gux * 3, gmz + guz * 3];
        const mats = palisade(ctx, b, [gateB, ...runA, gateA], { h: 1.9, plinth: 0.8, post: 3, plinthCol: '#8a8580', postCol: '#14171a' });
        for (const [x, z] of [gateA, gateB]) { b.box(x, yG - 0.3, z, 0.8, 3.0, 0.8, '#8a8580', 'stone'); b.sphere(x, yG + 2.9, z, 0.3, 0.3, 0.3, '#14171a', 'metal', 8, 6); }
        // garden: lawn, gravel paths, rose beds, conifers + lindens
        ctx.add(b.build('spring-palace', { matOverrides: { [fMain.key]: fMain.mat, balustrade: balustradeMaterial(), ...mats } }));
        ctx.terrainOpts = { bg: '#6b8545', bgMask: 'grass', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 600 };
        bucBackdrop(ctx, { lampStyle: 'lantern', lampColor: '#1c1f22', lampH: 4.4, lampPad: 30, treeLod: { cap: 1400, max: 380 }, treeScale: 1.3, lampOpts: { spacing: 28, kinds: ['tertiary', 'residential'] }, streetTreeOpts: { spacing: 9, prob: 0.85, kinds: ['tertiary', 'residential'] } });
        ctx.painter.poly(grounds, '#5f8040', 'grass');
        const r = rng(5), gb = polyBox(grounds);
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (let i = 0; i < 14; i++) { const px = gb.x0 + r() * (gb.x1 - gb.x0), pz = gb.z0 + r() * (gb.z1 - gb.z0); if (!inPoly(px, pz, grounds) || [main, pool].some((q) => q && inPoly(px, pz, grow(q.poly, 3)))) continue; const [a, c] = T(px, pz); x.fillStyle = '#6b3a2a'; x.beginPath(); x.ellipse(a, c, 2.2 * k, 1.2 * k, 0.6, 0, 7); x.fill(); for (let q = 0; q < 30; q++) { x.fillStyle = r.pick(['#c8323a', '#e86a8a', '#f2e6e0', '#d94a5a']); x.fillRect(a + (r() - 0.5) * 3.6 * k, c + (r() - 0.5) * 2 * k, Math.max(1, 0.25 * k), Math.max(1, 0.25 * k)); } } });
        for (let i = 0; i < 24; i++) { const x = gb.x0 + r() * (gb.x1 - gb.x0), z = gb.z0 + r() * (gb.z1 - gb.z0); if (!inPoly(x, z, grow(grounds, -3)) || [main, pool].some((q) => q && inPoly(x, z, grow(q.poly, 7)))) continue; ctx.trees.push({ x, z, kind: r() < 0.45 ? 'con' : 'broad', s: 1.0 + r() * 0.6 }); }
        cityFiller(ctx, { ring: 600 });
        // peacocks on the lawn
        const lawn = grow(grounds, -4);
        const birds = peacocks(ctx, lawn, 4);
        // plaques by the gate (inside), traffic on the boulevard
        const PL = sp.plaques; const ix = gmx + (centroid(grounds)[0] - gmx) * 0.18, iz = gmz + (centroid(grounds)[1] - gmz) * 0.18;
        PL.forEach((pl, i) => ctx.plaque(pl, ix + gux * (i - 1.5) * 2.2, iz + guz * (i - 1.5) * 2.2, Math.atan2(gmx - ix, gmz - iz), { style: 'city' }));
        const way = (id) => d.ways.find((w) => w.id === id)?.pts || [];
        addTraffic(ctx, { lanes: [{ pts: way('w429253035'), n: 2, speed: 8 }, { pts: way('w429253035').slice().reverse().map(([x, z]) => [x + 3, z + 2]), n: 2, speed: 8 }], parked: [] });
        // flags on the embassies nearby (Lithuania, Korea) — Romanian flag at the museum gate
        { const f = flagpole(gateA[0] - gux * 1.2, yG, gateA[1] - guz * 1.2, 7, 'ro', { yaw: 2.4 }); ctx.add(f.group); ctx.onUpdate((dt, s) => f.update(s.t, s.r3d.weather?.windKmh ?? 10)); }
        // the peacock portrait: a second postcard (needs a fanned tail near you); the garden façade (research pose moved into the garden)
        const gp = M0 ? { x: M0.o.cx + M0.o.uz * -24, z: M0.o.cz - M0.o.ux * -24 } : { x: 30, z: -35 };
        const inG = inPoly(gp.x, gp.z, grounds) ? gp : { x: 30, z: -35 };
        ctx.challenge('spring-palace', { x: inG.x, z: inG.z, heading: M0 ? (Math.atan2(M0.o.cx - inG.x, -(M0.o.cz - inG.z)) * 180 / Math.PI + 360) % 360 : 290, r: 12, tol: 34, text: 'The Spring Palace from its garden' });
        ctx.challenge('spring-palace', { x: centroid(lawn)[0], z: centroid(lawn)[1], heading: 0, r: 40, tol: 180, text: 'A peacock with its tail fanned', cond: (s) => birds.some((q) => q.show > 0 && Math.hypot(q.x - s.position.x, q.z - s.position.z) < 18) }).condHint = 'Wait quietly near a peacock until it fans its tail.';
        ctx.crowdCfg = {
            personas: { tourist_uk: 2, tourist_de: 2, tourist_us: 2, local_elder: 1.5, local_young: 1 },
            walkers: 14, paths: ctx.footLines(),
            groups: [
                { x: inG.x - 12, z: inG.z + 9, r: 3, n: 8, act: 'watch', look: M0 ? [M0.o.cx, M0.o.cz] : [0, -30], personas: ['tourist_uk', 'tourist_de', 'tourist_us'], y: yG },
                { x: inG.x - 15, z: inG.z + 5, r: 0.3, n: 1, act: 'guide', look: [inG.x - 12, inG.z + 9], personas: ['tour_guide'], y: yG },
                { x: gmx - (centroid(grounds)[0] - gmx) * 0.08, z: gmz - (centroid(grounds)[1] - gmz) * 0.08, r: 0.3, n: 1, act: 'watch', personas: ['guard'] },
                { x: -20, z: -130, r: 0.3, n: 1, act: 'watch', personas: ['guard'] },
            ],
        };
        ctx.sound('birds', 0, -40, 90, 0.9); ctx.sound('traffic', -60, -50, 120, 0.35); ctx.sound('wind', 0, -40, 80, 0.3);
        ctx.onUpdate((dt, s) => { s._peacockT = (s._peacockT ?? 8) - dt; if (s._peacockT < 0) { s._peacockT = 12 + Math.random() * 14; const q = birds[Math.floor(Math.random() * birds.length)]; if (q && Math.hypot(q.x - s.position.x, q.z - s.position.z) < 60) s.sound.play('calls', 0.35); } });
        // spawn: on the boulevard outside the gate, looking in
        ctx.spawns['spring-palace'] = { x: gmx - (centroid(grounds)[0] - gmx) * 0.35, z: gmz - (centroid(grounds)[1] - gmz) * 0.35, heading: headingFromBearing((Math.atan2(centroid(grounds)[0] - gmx, -(centroid(grounds)[1] - gmz)) * 180 / Math.PI + 360) % 360) };
    },
};
