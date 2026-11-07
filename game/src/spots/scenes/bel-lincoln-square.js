// ============================================================================
//  Bellevue: Lincoln Square + Bellevue Square + the skybridges (the Bellevue
//  Collection) at NE 8th St × Bellevue Way — rebuilt round 5 (owner note 66).
//  The towers are the district's own landmark models (landmarks.js `lincoln`,
//  `onelincoln`, `lincolnsouth`, `bellevuesq`: curtain walls, podium, Westin /
//  W signage, the Bellevue Way + NE 8th + NE 6th skybridges) with lit office
//  floors at night instead of the generic OSM slabs. Streetscape: Bellevue Way
//  and NE 8th from OSM with street trees in grated pits, Bellevue Collection
//  holiday lights in the trees (late Nov – early Jan), the remaining skybridges
//  (Bellevue Square ↔ garage, Bellevue Place), the Bellevue Square pylon.
//  UiPath (Lincoln Square North, 700 Bellevue Way NE, Suite 2000, since Sept
//  2025 — the game's final CV chapter): street lobby entrance + tenant
//  directory; badge in and ride up to an illustrative open-plan floor at level
//  20 with the view west over Bellevue Square to Lake Washington (the real
//  suite is not public — owner to confirm the look).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, headingFromBearing, polyBox, inPoly, distPolyline } from '../kit.js';
import { signBoard, shopfrontSigns } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';
import { emitActivity, seasonal, placeLitLandmark, skipNearLandmark, fairyLights, treeLightPoints, glowText, nightLit } from './bel-common.js';

const SKY_Y = 6.2; // skybridge floor above the roadway (landmarks.js uses the same)

function skybridge(ctx, b, pts, glassMat) {
    const g = ctx.ground;
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const y = Math.max(g.heightAt(ax, az), g.heightAt(bx, bz)) + SKY_Y;
        b.box(mx, y - 0.6, mz, 4.6, 0.6, L, '#d9dcdd', 'paint', yaw);
        b.box(mx, y + 4.2, mz, 5.0, 0.5, L + 0.2, '#d9dcdd', 'paint', yaw);
        for (const s of [-1, 1]) { const ox = Math.cos(yaw) * 2.3 * s, oz = -Math.sin(yaw) * 2.3 * s; for (let t = 0; t <= L; t += 4) { const px = ax + (bx - ax) * t / L + ox, pz = az + (bz - az) * t / L + oz; b.box(px, y, pz, 0.14, 4.2, 0.14, '#c9cdd0', 'steel', yaw); } }
        const glass = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.1, L), glassMat); glass.position.set(mx, y + 2.05, mz); glass.rotation.y = yaw; ctx.add(glass);
    }
}

export default {
    env: { fogFar: 6000, ambientCity: 0.55 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-lincoln-square'), r = rng(66);
        ctx.terrainOpts = { bg: '#8e8a80', bgMask: 'slab', innerPx: 2048 };
        // ---------------------------------------------------------------- district landmark models replace the OSM slabs
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth']) skipNearLandmark(ctx, id);
        for (const a of d.areas) if ((a.landuse === 'grass' || a.leisure === 'garden') && a.poly.length < 16 && Math.hypot(a.poly[0][0], a.poly[0][1]) < 40) { ctx.skipAreas.add(a.id); ctx.painter.poly(a.poly, '#4a3b2c', 'dirt'); } // corner planters: bark mulch, not a flat lawn slab // no painted grass slab on the corner paving (QA R2 #5)
        for (const id of ['w604028609', 'w604028611', 'w328017119', 'w161929514', 'w1474737770', 'w1364249504', 'w604028603', 'w1326151866', 'w1326151868', 'w1391221517',
            'w29234887', 'w33106348', 'w497738386', 'w497739259']) ctx.skipBuildings.add(id);
        const LMS = {};
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth', 'bellevuesq']) LMS[id] = placeLitLandmark(ctx, id, { seed: id.length * 3, frac: id === 'bellevuesq' ? 0.9 : 0.5, collide: false });
        // collisions from the real OSM footprints the models are built from (the landmark collision boxes are coarse bounds)
        for (const bd of d.buildings) if (ctx.skipBuildings.has(bd.id) && bd.k !== 'bridge' && !bd.minLv && !bd.minH && !(+bd.layer >= 1 && /connector|bridge/.test(bd.k || ''))) ctx.poly(bd.poly);
        // skybridges: the landmark models carry Bellevue Way / NE 8th / NE 6th; the others are built here (not painted on the ground)
        const skyIds = ['w43872832', 'w43872826', 'w1222676052', 'w29234890', 'w497738385', 'w516915099'];
        for (const id of skyIds) ctx.skipWays.add(id);
        ctx.osmBackdrop({ paint: {}, streetTrees: false, lampOpts: { kinds: ['primary', 'secondary', 'tertiary'], spacing: 30 },
            style: (bd) => ((bd.h || 0) > 40 ? 'office' : /Square|Mall|Nordstrom|Macy/.test(bd.name || '') ? 'shop' : undefined) });
        // street shop fascias (shared helper), none inside the landmark blocks (their podium storefronts are part of the models)
        const lmPolys = d.buildings.filter((bd) => ctx.skipBuildings.has(bd.id)).map((bd) => bd.poly);
        ctx.painter.poly([[-22, -22], [4.5, -22], [4.5, -1.5], [-22, -1.5]], '#a8a49a', 'slab'); // NW corner paving (no residential-lawn paint showing through)
        shopfrontSigns(ctx, { skip: (p) => lmPolys.some((q) => inPoly(p.x, p.z, q)) });
        const b = new GeoBatch();
        const glassMat = new THREE.MeshStandardMaterial({ color: '#8fb0c2', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false });
        for (const id of ['w1222676052', 'w29234890', 'w497738385']) { const w = d.ways.find((x) => x.id === id); if (w) skybridge(ctx, b, w.pts, glassMat); }
        // ---------------------------------------------------------------- streetscape: trees in grated pits along Bellevue Way + NE 8th, holiday lights
        const blockers = d.ways.filter((w) => ['service', 'footway', 'residential', 'unclassified'].includes(w.k)).flatMap((w) => [w.pts[0], w.pts[w.pts.length - 1]]);
        const lines = [[[4.5, -92], [4.5, -6]], [[4.5, 30], [4.5, 205]], [[32.6, 30], [32.6, 205]], [[32.6, -92], [32.6, -6]], [[38, 27], [140, 27]], [[-180, 27], [1, 27]], [[38, -2.5], [150, -2.5]], [[-180, -2.5], [0, -2.5]]];
        const holiday = [];
        for (const [[x0, z0], [x1, z1]] of lines) {
            const L = Math.hypot(x1 - x0, z1 - z0);
            for (let t = 4; t < L; t += 9.5) {
                const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L;
                if (blockers.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6)) continue;
                if (d.buildings.some((bd) => !bd.part && !ctx.skipBuildings.has(bd.id) && inPoly(x, z, bd.poly))) continue;
                if (skyIds.some((id) => { const w = d.ways.find((q) => q.id === id); return w && distPolyline(x, z, w.pts).d < 5; })) continue;
                ctx.trees.push({ x, z, kind: 'broad', s: 0.85 + r() * 0.15 });
                const y = g.heightAt(x, z);
                b.box(x, y + 0.01, z, 1.5, 0.03, 1.5, '#2b2d2f', 'metal'); b.box(x, y + 0.02, z, 0.5, 0.03, 0.5, '#4a3b2c', 'dirt');      // cast-iron tree grate
                holiday.push(...treeLightPoints(x, y, z, { seed: (x * 7 + z) | 0, n: 80, crownY: 4.4, crownR: 2.2 }));
            }
        }
        let season = false; seasonal(ctx, [11, 20], [1, 6], (on) => { season = on; });
        fairyLights(ctx, holiday, { on: () => season, name: 'bellevue-collection-holiday-lights' });
        // ---------------------------------------------------------------- UiPath: street lobby (landmark entrance) + tenant directory + badge reader
        const ue = sp.structures.find((s) => s.id === 'uipath-entrance'), ey = g.heightAt(ue.x, ue.z), yawE = -Math.PI / 2;
        const dir = signBoard('700 BELLEVUE WAY NE  ·  Suite 2000  UiPath', 1.0, 1.6, { bg: '#1e2124', fg: '#eef0f2', maxLines: 6, font: (s) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`, glow: 0.05, night: 1.0, ppm: 300,
            draw: (x, w, h) => { x.fillStyle = '#fa4616'; x.fillRect(w * 0.08, h * 0.86, w * 0.84, h * 0.04); } });
        dir.position.set(ue.x - 4.2, ey + 1.05, ue.z + 6.2); dir.rotation.y = yawE; ctx.add(dir); ctx.box(ue.x - 4.2, ue.z + 6.2, 0.5, 0.15, 0, { prop: true, h: 1.9 });
        // illustrative UiPath floor (level 20 ≈ 80 m) inside Lincoln Square North: floor, ceiling, inner glazing, desks, reception wall
        const tower = d.buildings.find((x) => x.id === 'w604028609')?.poly;
        let floor = null;
        if (tower) {
            const ty = LMS.lincoln?.y ?? g.heightAt(55, 58), FY = ty + 9 + 18 * 3.95, tb = polyBox(tower), cx = (tb.x0 + tb.x1) / 2, cz = (tb.z0 + tb.z1) / 2;
            const inner = tower.map(([x, z]) => [cx + (x - cx) * 0.97, cz + (z - cz) * 0.97]);
            const fb = new GeoBatch();
            fb.prism(inner, FY - 0.3, FY, '#5b6168', 'fabric'); fb.prism(inner, FY + 3.1, FY + 3.35, '#e9eaeb', 'paint', { bottom: true });
            for (let i = 0; i < inner.length; i++) { const [ax, az] = inner[i], [qx, qz] = inner[(i + 1) % inner.length], L = Math.hypot(qx - ax, qz - az), ya = Math.atan2(qx - ax, qz - az); for (let t = 0; t < L; t += 3.1) fb.box(ax + (qx - ax) * t / L, FY, az + (qz - az) * t / L, 0.12, 3.1, 0.12, '#3b4148', 'metal', ya); ctx.collider({ wall: true, ax, az, bx: qx, bz: qz, y0a: FY - 1, y1a: FY + 3, y0b: FY - 1, y1b: FY + 3, nx: 0, nz: 1 }); }
            const iglass = new THREE.MeshStandardMaterial({ color: '#c6d6df', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
            { const pos = [], idx = []; inner.forEach(([x, z], i) => { pos.push(x, FY, z, x, FY + 3.1, z); const j = (i + 1) % inner.length; idx.push(i * 2, j * 2, j * 2 + 1, i * 2, j * 2 + 1, i * 2 + 1); }); const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, iglass); m.name = 'suite-glazing'; ctx.add(m); }
            for (let k = 0; k < 10; k++) { const x = cx - 14 + (k % 5) * 6.5, z = cz + (k < 5 ? 8 : 16); fb.box(x, FY, z, 3.2, 0.74, 1.5, '#d9d4cb', 'wood'); fb.box(x - 0.6, FY + 0.74, z - 0.3, 0.6, 0.38, 0.04, '#1b1e22', 'darkglass'); fb.box(x + 0.6, FY + 0.74, z - 0.3, 0.6, 0.38, 0.04, '#1b1e22', 'darkglass'); ctx.box(x, z, 1.6, 0.75, 0, { prop: true, h: 0.75, y: FY }); }
            fb.box(cx + 2, FY, cz - 6, 12, 3.1, 1.2, '#273139', 'paint'); // core / reception wall (elevators behind)
            ctx.box(cx + 2, cz - 6, 6, 0.6, 0, { y0: FY - 1, y1: FY + 3.2 });
            ctx.add(fb.build('uipath-floor'));
            g.addPoly(inner, FY, FY - 2);
            const logo = glowText('UiPath', 3.2, 0.9, { fg: '#fa4616', font: (s) => `700 ${s}px "Helvetica Neue", Arial, sans-serif`, night: 1.4, day: 0.5 }); logo.position.set(cx + 2, FY + 1.9, cz - 5.38); ctx.add(logo);
            const tag = glowText('Suite 2000 · Bellevue product & engineering hub', 4.5, 0.25, { fg: '#e9edf0', night: 1, day: 0.4 }); tag.position.set(cx + 2, FY + 1.2, cz - 5.38); ctx.add(tag);
            const lights = nightLit('#fff6e8', 1.4, { base: '#f4f4f2', day: 0.6, name: 'suite-ceiling' }); for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), lights); m.position.set(cx - 12 + (k % 3) * 12, FY + 3.08, cz + 4 + Math.floor(k / 3) * 12); ctx.add(m); }
            floor = { y: FY, at: { x: cx + 2, z: cz - 3 }, view: { x: tb.x0 + 3, z: cz } };
        }
        ctx.interactables.push({ kind: 'badge', x: ue.x - 2.6, z: ue.z, r: 3, label: 'Badge in at UiPath — elevator to Suite 2000',
            use: (s) => { s.sound.play('chime'); emitActivity(s, 'bel-lincoln-square', 'badge-in', '🪪 Badge accepted', 'UiPath Bellevue — product & engineering hub since Sept 2025. Final chapter: Principal Engineer (2025).'); window.cvTelemetry?.track?.('spot_uipath_badge', {});
                if (floor) { s.ctl.y = floor.y + 0.5; s.ctl.teleport(floor.view.x + 4, floor.at.z + 6, headingFromBearing(270)); s.ui.toast('🛗 Level 20', 'Looking west over Bellevue Square to Lake Washington and Seattle. (Illustrative floor — the real suite is not public.)'); } } });
        if (floor) ctx.interactables.push({ kind: 'elevator', x: floor.at.x, z: floor.at.z, r: 2.5, y: floor.y, label: 'Elevator down to the lobby', use: (s) => { s.ctl.y = ey + 1; s.ctl.teleport(ue.x - 4, ue.z, headingFromBearing(270)); } });
        // ---------------------------------------------------------------- Bellevue Collection wayfinding pylon, Bellevue Square entrance
        const pyl = signBoard('THE BELLEVUE COLLECTION', 0.9, 3.2, { bg: '#1d2b36', fg: '#e8e3d6', maxLines: 4, font: (s) => `600 ${s}px Georgia, serif`, ppm: 220, night: 0.8 }); pyl.position.set(4, g.heightAt(4, 40) + 1.7, 40); pyl.rotation.y = Math.PI / 2; ctx.add(pyl); ctx.box(4, 40, 0.2, 0.5, 0, { prop: true, h: 3.4 });
        ctx.add(b.build('lincoln-streetscape'));
        // Seattle across Lake Washington (≈ 9 km) — towers + Needle on clear days
        seattleBackdrop(ctx, { clear: 2000, hazeK: 0.4, needle: true });
        addTraffic(ctx, { lanes: [{ pts: [[13, -101], [13, -43], [12, 7], [11, 27], [13, 149], [14, 225], [15, 278], [18, 409]], n: 6, speed: 9 }, { pts: [[31, 484], [28, 317], [25, 217], [24, 83], [24, 18], [23, -2], [22, -95]], n: 6, speed: 9 }, { pts: [[219, 8], [150, 8], [93, 8], [24, 8], [-88, 7], [-213, 8]], n: 5, speed: 9 }, { pts: [[-262, 18], [-112, 17], [12, 18], [77, 20], [176, 20]], n: 5, speed: 9 }] });
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], 1.5, 120, Math.PI / 2); ctx.plaque(PL[1], 2, 82, Math.PI / 2); ctx.plaque(PL[2], 31, 110, -Math.PI / 2); ctx.plaque(PL[3], ue.x - 5.5, ue.z - 5, -Math.PI / 2, { credit: 'UiPath office address from UiPath; move reported by GeekWire (2025).' });
        // postcard: from the NE 8th × Bellevue Way corner, looking up at Lincoln Square North + One Lincoln with the skybridge
        ctx.challenge('bel-lincoln-square', { x: -2, z: 2, heading: 145, pitch: 18, r: 12, tol: 35, text: 'Lincoln Square North (UiPath) and One Lincoln Tower over Bellevue Way' });
        const s0 = { x: sp.spawn.x - 3, z: sp.spawn.z - 3 }, gx = s0.x + 2.67 + 3, gz = s0.z - 2.1; // tour guide at the side of the spawn, facing the player
        ctx.crowdCfg = {
            tour: false,
            personas: { tech: 5, local: 4, tourist_us: 2, tourist_cn: 1.5, tourist_in: 1.5, tourist_kr: 1, tourist_jp: 1, kid: 1 },
            walkers: 42, paths: ctx.footLines(),
            groups: [
                { x: 30, z: 30, r: 2.5, n: 6, act: 'watch', look: [0, 0], personas: ['tech', 'local', 'tourist_in'] },
                { x: -8, z: 2, r: 2.5, n: 5, act: 'watch', look: [30, 30], personas: ['tech', 'local', 'kid'] },
                { x: ue.x - 4, z: ue.z + 2, r: 1.5, n: 3, act: 'talk', personas: ['tech'] },
                { x: 3, z: 140, r: 4, n: 5, act: 'talk', personas: ['local', 'tourist_us', 'tourist_cn'] },
                { x: gx, z: gz, r: 0, n: 1, act: 'guide', personas: ['tour_guide'], tour: true, fixedYaw: true, yaw: Math.atan2(s0.x - gx, s0.z - gz) },
            ],
        };
        ctx.sound('traffic', 18, 12, 120, 1); ctx.sound('crowd', 18, 60, 60, 0.6);
        ctx.spawns['bel-lincoln-square'] = { x: sp.spawn.x - 3, z: sp.spawn.z - 3, heading: headingFromBearing(sp.spawn.heading_deg) };
    },
};
