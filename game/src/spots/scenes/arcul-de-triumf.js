// ============================================================================
//  Arcul de Triumf (Bucharest): Petre Antonescu's 27 m granite arch (1935–36)
//  in the middle of the Piața Arcul de Triumf roundabout on Șoseaua Kiseleff.
//  Arch: landmarks.js model (bArcul, read-only import: inscriptions, medallions
//  of Ferdinand and Maria, Victories) floodlit at night. Around it: the lawn
//  island with granite paving, bollards and chains, zebra crossings with
//  signals, constant roundabout traffic, Kiseleff lined with tall trees, the
//  King Michael I park edge. Artists credited on the plaques (R15.7).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, inPoly, polyBox } from '../kit.js';
import { bucBackdrop, placeLandmark, cityFiller, floodlight, flagpole } from '../buc.js';
import { addTraffic } from '../cars.js';

const INSCRIPTIONS = [
    { face: 'south', ro: 'FERDINAND I · DOMN ȘI REGE AL ROMÂNILOR', en: 'Ferdinand I, Prince and King of the Romanians — the 1918 union completed under his reign.' },
    { face: 'north', ro: 'SE ÎNDEPLINI DREPTATEA ȘI PENTRU POPORUL ROMÂN', en: 'Justice was done for the Romanian people too.' },
    { face: 'east', ro: 'GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR AU ÎNTREGIT UNITATEA NAȚIONALĂ', en: 'Glory to those who, by their bravery and sacrifice, completed the national unity.' },
    { face: 'west', ro: 'GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR AU ÎNTREGIT UNITATEA NAȚIONALĂ', en: 'Glory to those who, by their bravery and sacrifice, completed the national unity.' },
];

export default {
    env: { fogFar: 3000, ambientCity: 0.25, groundAlbedo: 0.12 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('arcul-de-triumf');
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.4);
        const arch = d.buildings.find((x) => x.id === 'w217851530');
        if (arch) { ctx.skipBuildings.add(arch.id); for (const x of d.buildings) { const [cx, cz] = centroid(x.poly); if (x.part && inPoly(cx, cz, arch.poly)) ctx.skipBuildings.add(x.id); } }
        // the island: centre of the circular carriageway
        const ring = d.ways.filter((w) => w.junction === 'circular' || /^w11100510/.test(w.id) || w.id === 'w227396567').flatMap((w) => w.pts);
        let cx = -31, cz = -96, R = 30; if (ring.length > 6) { cx = ring.reduce((s, p) => s + p[0], 0) / ring.length; cz = ring.reduce((s, p) => s + p[1], 0) / ring.length; R = ring.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / ring.length; }
        const IR = R - 7.5; // island radius (carriageway ~ 3 lanes)
        const island = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; island.push([cx + Math.cos(a) * IR, cz + Math.sin(a) * IR]); }
        const yI = g.heightAt(cx, cz); g.flatten(island, yI, 8);
        const AR = placeLandmark(ctx, 'arcul', { y: yI + 0.15, colliderH: 30 });
        const b = new GeoBatch();
        // kerb ring, bollards with chains along the island edge (gaps at the crossings)
        b.add(new THREE.TorusGeometry(IR, 0.18, 4, 64).rotateX(Math.PI / 2), 'stone', M(cx, yI + 0.08, cz), '#bdb6a8');
        const nb = 56; for (let i = 0; i < nb; i++) { const a = i / nb * Math.PI * 2, a2 = (i + 1) / nb * Math.PI * 2, x = cx + Math.cos(a) * (IR - 0.6), z = cz + Math.sin(a) * (IR - 0.6); if (i % 7 === 3) continue; b.cyl(x, yI, z, 0.12, 0.9, '#e6e1d6', 'stone', 8); b.sphere(x, yI + 0.95, z, 0.13, 0.1, 0.13, '#e6e1d6', 'stone', 6, 4); if (i % 7 !== 2) b.rod([x, yI + 0.75, z], [cx + Math.cos(a2) * (IR - 0.6), yI + 0.75, cz + Math.sin(a2) * (IR - 0.6)], 0.025, '#2b2b2b', 'metal', 4); ctx.circle(x, z, 0.13, 0.9); }
        // signals at the crossings
        for (const w of d.ways) if (w.k === 'footway' && w.footway === 'crossing') for (const [x, z] of [w.pts[0], w.pts[w.pts.length - 1]]) { const y = g.heightAt(x, z); b.cyl(x, y, z, 0.07, 3.2, '#2d3135', 'metal', 6); b.box(x, y + 2.4, z, 0.32, 0.9, 0.28, '#1d2023', 'metal'); b.sphere(x, y + 2.95, z + 0.16, 0.08, 0.08, 0.04, '#d92b2b', 'glow', 6, 4); ctx.circle(x, z, 0.1, 3); }
        // flagpole by the park entrance (OSM flagpole), Romanian flag
        const fp = d.furniture.flagpole?.[0]; let flag = null; if (fp) { flag = flagpole(fp[0], g.heightAt(fp[0], fp[1]), fp[1], 14, 'ro', { yaw: Math.PI * 0.8 }); ctx.add(flag.group); ctx.circle(fp[0], fp[1], 0.2, 14); }
        ctx.add(b.build('arch-island'));
        // ground: granite slabs round the arch, lawn beds, the roundabout + Kiseleff
        ctx.terrainOpts = { bg: '#6f8545', bgMask: 'grass', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        bucBackdrop(ctx, { species: { plane: 0.55, linden: 0.3, chestnut: 0.15 }, doubleCentre: true, lampStyle: 'cobra', lampColor: '#5c6066', lampH: 10, lampPad: 30, treeLod: { cap: 1500, max: 420 }, lampOpts: { spacing: 34, kinds: ['primary', 'secondary'] }, streetTreeOpts: { spacing: 8.5, prob: 0.92, kinds: ['primary', 'secondary', 'tertiary'] } });
        ctx.painter.poly(island, '#6c8a44', 'grass');
        ctx.painter.custom((x, T, k) => { const [px, py] = T(cx, cz); x.fillStyle = '#b5b0a6'; x.beginPath(); x.ellipse(px, py, 19 * k, 19 * k, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(90,85,78,0.35)'; x.lineWidth = Math.max(1, 0.1 * k); for (let r2 = 3; r2 < 19; r2 += 2.4) { x.beginPath(); x.arc(px, py, r2 * k, 0, 7); x.stroke(); } });
        // no trees on the island apart from a few by the lawn edge
        ctx.trees = ctx.trees.filter((t) => Math.hypot(t.x - cx, t.z - cz) > R + 4);
        // rows along the outer kerbs only: nothing on the carriageways or in the Kiseleff median (the view to the arch stays open)
        const roads = d.ways.filter((w) => ['primary', 'secondary', 'tertiary'].includes(w.k)).map((w) => ({ pts: w.pts, hw: (parseInt(w.lanes, 10) || 2) * 3.3 / 2 + 1.6 }));
        const onRoad = (x, z) => roads.some((w) => { for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); if (Math.hypot(x - ax - dx * u, z - az - dz * u) < w.hw) return true; } return false; });
        const kis = d.ways.find((w) => w.id === 'w281701377')?.pts || [];
        ctx.trees = ctx.trees.filter((t) => !onRoad(t.x, t.z) && !(kis.length && (() => { for (let i = 1; i < kis.length; i++) { const [ax, az] = kis[i - 1], [bx, bz] = kis[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / L2)); if (Math.hypot(t.x - ax - dx * u, t.z - az - dz * u) < 13) return true; } return false; })()));
        cityFiller(ctx, { ring: 650 });
        // traffic: the roundabout loop (counter-clockwise seen from above) + Kiseleff both ways + Prezan
        const loop = []; for (let i = 0; i <= 48; i++) { const a = -i / 48 * Math.PI * 2; loop.push([cx + Math.cos(a) * (R - 2.5), cz + Math.sin(a) * (R - 2.5)]); }
        const way = (id) => d.ways.find((w) => w.id === id)?.pts || [];
        addTraffic(ctx, { lanes: [{ pts: loop, n: 7, speed: 8 }, { pts: loop.map(([x, z]) => [cx + (x - cx) * 0.88, cz + (z - cz) * 0.88]), n: 5, speed: 7 }, { pts: way('w281701377').slice().reverse(), n: 6, speed: 12 }, { pts: [...way('w281701377')].map(([x, z]) => [x + 9, z]), n: 6, speed: 12 }, { pts: way('w229373804'), n: 4, speed: 12 }] });
        // plaques round the island + "read the arch" at the four faces
        const PL = sp.plaques;
        const credits = [null, null, 'Architect Petre Antonescu; sculptors Ion Jalea, Constantin Baraschi, Mac Constantinescu, Dimitrie Paciurea (1935–36).', 'Medallions of King Ferdinand and Queen Maria restored after 1989.', null];
        PL.forEach((pl, i) => { const a = Math.PI * 0.35 + i * 0.32, x = cx + Math.cos(a) * (IR - 2.2), z = cz + Math.sin(a) * (IR - 2.2); ctx.plaque(pl, x, z, Math.atan2(cx - x, cz - z) + Math.PI, { style: 'bronze', credit: credits[i], y: yI }); });
        if (AR) {
            const rot = AR.lm.rotation, c = Math.cos(rot), s = Math.sin(rot), L = (u, v) => ({ x: AR.x + u * c + v * s, z: AR.z - u * s + v * c });
            const faces = { south: L(0, -9), north: L(0, 9), east: L(17, 0), west: L(-17, 0) };
            let read = new Set();
            for (const ins of INSCRIPTIONS) { const p = faces[ins.face]; ctx.interactables.push({ x: p.x, z: p.z, r: 3.2, label: `Read the inscription (${ins.face} face)`, use: (sess) => { read.add(ins.face); sess.ui.toast(ins.ro, `${ins.en} (${read.size}/4 faces read)`); if (read.size === 4) sess.ui.toast('🏛 All four faces read', 'The roof terrace opens to visitors in the warm season: a view down Kiseleff.'); } }); }
        }
        // postcard: on the Kiseleff axis south of the roundabout, looking NNW through the opening (≈ 52 m from the arch)
        const pa = 160 * Math.PI / 180, px = cx + Math.sin(pa) * 35, pz = cz - Math.cos(pa) * 35;
        ctx.challenge('arcul-de-triumf', { view: [cx, cz], x: px, z: pz, heading: 340, pitch: 19, r: 12, tol: 24 });
        ctx.spawns['arcul-de-triumf'] = { x: cx + Math.sin(pa) * 70, z: cz - Math.cos(pa) * 70, heading: headingFromBearing(340) };
        ctx.crowdCfg = {
            personas: { local_young: 3, local_elder: 1.5, tourist_de: 1.5, tourist_it: 1.5, kid: 0.6, local_parent: 1 },
            walkers: 26, paths: ctx.footLines(),
            groups: [
                { x: cx + 4, z: cz + IR - 5, r: 3, n: 5, act: 'photo', look: [cx, cz], personas: ['tourist_de', 'tourist_it', 'local_young'], y: yI },
                { x: cx - 8, z: cz - IR + 6, r: 2, n: 3, act: 'photo', look: [cx, cz], personas: ['tourist_it', 'tourist_de'], y: yI },
                { x: cx + 12, z: cz - 6, r: 0.3, n: 1, act: 'watch', look: [cx, cz], personas: ['guard'], y: yI },
            ],
        };
        ctx.sound('traffic', cx, cz, 120, 1.2); ctx.sound('traffic', 30, 120, 160, 0.8); ctx.sound('wind', cx, cz, 60, 0.4); ctx.sound('birds', 60, -160, 90, 0.5);
        if (flag) ctx.onUpdate((dt, s) => flag.update(s.t, s.r3d.weather?.windKmh ?? 12));

        void rng; void polyBox;
    },
};
