// ============================================================================
//  Bellevue: Lincoln Square + Bellevue Square + the skybridges (the Bellevue
//  Collection) at NE 8th St × Bellevue Way. UiPath's product & engineering hub
//  (Lincoln Square North, 700 Bellevue Way NE, Suite 2000 since Sept 2025) —
//  the game's final CV chapter; the lobby / suite look is not public (owner to
//  confirm), so only the street entrance + a tenant directory are modelled.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, polyBox, centroid } from '../kit.js';
import { signBoard } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';

const SKY_Y = 6.2; // skybridge floor above the roadway (≈ 5.5–6.5 m clearance, research estimate)

function skybridge(ctx, b, pts, glassMat) {
    const g = ctx.ground;
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const y = Math.max(g.heightAt(ax, az), g.heightAt(bx, bz)) + SKY_Y;
        b.box(mx, y - 0.6, mz, 4.6, 0.6, L, '#c9cdd0', 'paint', yaw);           // deck
        b.box(mx, y + 3.4, mz, 4.8, 0.45, L + 0.2, '#d3d6d8', 'paint', yaw);    // roof
        for (const s of [-1, 1]) { const ox = Math.cos(yaw) * 2.3 * s, oz = -Math.sin(yaw) * 2.3 * s; b.box(mx + ox, y, mz + oz, 0.12, 3.4, L, '#8fa1ad', 'steel', yaw); for (let t = 0; t <= L; t += 2.5) { const px = ax + (bx - ax) * t / L + ox, pz = az + (bz - az) * t / L + oz; b.box(px, y, pz, 0.12, 3.4, 0.12, '#5e6b74', 'steel', yaw); } }
        const glass = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.3, L), glassMat); glass.position.set(mx, y + 1.65, mz); glass.rotation.y = yaw; ctx.add(glass);
    }
}

export default {
    env: { fogFar: 6000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-lincoln-square');
        ctx.terrainOpts = { bg: '#8e8a80', bgMask: 'slab', innerPx: 2048 };
        // skybridges: OSM skybridge footways (not painted on the ground: drawn as glass bridges)
        const skyIds = ['w43872832', 'w43872826', 'w1222676052', 'w29234890', 'w497738385', 'w516915099'];
        for (const id of skyIds) ctx.skipWays.add(id);
        ctx.osmBackdrop({ paint: {}, streetTreeOpts: { spacing: 15, prob: 0.5, kinds: ['primary', 'secondary', 'tertiary'] }, lampOpts: { kinds: ['primary', 'secondary', 'tertiary'] },
            style: (bd) => ((bd.h || 0) > 40 ? 'office' : /Square|Mall|Nordstrom|Macy/.test(bd.name || '') ? 'shop' : undefined) });
        const b = new GeoBatch();
        const glassMat = new THREE.MeshStandardMaterial({ color: '#9fb8c8', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.5, depthWrite: false });
        for (const id of skyIds) { const w = d.ways.find((x) => x.id === id); if (w) skybridge(ctx, b, w.pts, glassMat); }
        // UiPath entrance on the Bellevue Way frontage of Lincoln Square North (OSM entrance n7945526075)
        const ue = sp.structures.find((s) => s.id === 'uipath-entrance'), ey = g.heightAt(ue.x, ue.z);
        const yawE = -Math.PI / 2; // faces Bellevue Way (west)
        b.box(ue.x - 1.2, ey + 3.6, ue.z, 3.0, 0.3, 8, '#d6d9db', 'steel', 0);                          // canopy
        for (const dz of [-3.8, 3.8]) b.cyl(ue.x - 2.5, ey, ue.z + dz, 0.12, 3.6, '#9aa4ab', 'steel', 10);
        b.box(ue.x + 0.2, ey, ue.z, 0.15, 3.4, 6, '#2c3e4c', 'glass', 0);                               // glass doors
        ctx.add(b.build('lincoln-heroes'));
        const ls = signBoard('LINCOLN SQUARE', 5.6, 0.6, { bg: '#2a2d30', fg: '#d9dcde', font: (s) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`, glow: 0.05, night: 1.2 });
        ls.position.set(ue.x - 2.75, ey + 4.2, ue.z); ls.rotation.y = yawE; ctx.add(ls);
        const dir = signBoard('700 BELLEVUE WAY NE  ·  Suite 2000  UiPath', 1.0, 1.6, { bg: '#1e2124', fg: '#eef0f2', maxLines: 6, font: (s) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`, glow: 0.05, night: 1.0, ppm: 300,
            draw: (x, w, h) => { x.fillStyle = '#fa4616'; x.fillRect(w * 0.08, h * 0.86, w * 0.84, h * 0.04); } });
        dir.position.set(ue.x - 3.2, ey + 1.05, ue.z + 4.6); dir.rotation.y = yawE; ctx.add(dir); ctx.box(ue.x - 3.2, ue.z + 4.6, 0.5, 0.15, 0, { prop: true, h: 1.9 });
        ctx.interactables.push({ kind: 'badge', x: ue.x - 2.6, z: ue.z, r: 3, label: 'Badge in at UiPath (Lincoln Square North, Suite 2000)',
            use: (s) => { s.sound.play('chime'); s.ui.toast('🪪 Badge accepted', 'UiPath Bellevue — product & engineering hub since Sept 2025. Final chapter: Principal Engineer (2025).'); window.cvTelemetry?.track?.('spot_uipath_badge', {}); } });
        // Bellevue Square east entrance canopy + THE BELLEVUE COLLECTION pylon
        const bs = signBoard('BELLEVUE SQUARE', 6.2, 0.8, { bg: '#f2efe8', fg: '#2a2a2a', font: (s) => `600 ${s}px Georgia, serif` }); bs.position.set(6.2, g.heightAt(6, 140) + 5.6, 140); bs.rotation.y = Math.PI / 2; ctx.add(bs);
        const pyl = signBoard('THE BELLEVUE COLLECTION', 0.9, 3.2, { bg: '#1d2b36', fg: '#e8e3d6', maxLines: 4, font: (s) => `600 ${s}px Georgia, serif`, ppm: 220 }); pyl.position.set(4, g.heightAt(4, 30) + 1.7, 30); pyl.rotation.y = Math.PI / 2; ctx.add(pyl); ctx.box(4, 30, 0.2, 0.5, 0, { prop: true, h: 3.4 });
        // Seattle across Lake Washington (≈ 9 km) — towers + Needle on clear days
        seattleBackdrop(ctx, { clear: 2000, hazeK: 0.4, needle: true });
        addTraffic(ctx, { lanes: [{ pts: [[13, -101], [13, -43], [12, 7], [11, 27], [13, 149], [14, 225], [15, 278], [18, 409]], n: 5, speed: 9 }, { pts: [[31, 484], [28, 317], [25, 217], [24, 83], [24, 18], [23, -2], [22, -95]], n: 5, speed: 9 }, { pts: [[219, 8], [150, 8], [93, 8], [24, 8], [-88, 7], [-213, 8]], n: 4, speed: 9 }, { pts: [[-262, 18], [-112, 17], [12, 18], [77, 20], [176, 20]], n: 4, speed: 9 }] });
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], -2, 120, Math.PI / 2); ctx.plaque(PL[1], 2, 80, Math.PI / 2); ctx.plaque(PL[2], 30, 100, -Math.PI / 2); ctx.plaque(PL[3], ue.x - 4.8, ue.z - 5, -Math.PI / 2, { credit: 'UiPath office address from UiPath; move reported by GeekWire (2025).' });
        ctx.challenge('bel-lincoln-square', { r: 16, tol: 35 });
        // crowd: shoppers, tech workers with badges, people waiting for the walk signal
        ctx.crowdCfg = {
            personas: { tech: 5, local: 4, tourist_us: 2, tourist_cn: 1.5, tourist_in: 1.5, tourist_kr: 1, tourist_jp: 1, kid: 1 },
            walkers: 38, paths: ctx.footLines(),
            groups: [
                { x: 30, z: 30, r: 2.5, n: 6, act: 'watch', look: [0, 0], personas: ['tech', 'local', 'tourist_in'] },
                { x: -8, z: 2, r: 2.5, n: 5, act: 'watch', look: [30, 30], personas: ['tech', 'local', 'kid'] },
                { x: ue.x - 4, z: ue.z + 1, r: 1.5, n: 3, act: 'talk', personas: ['tech'] },
                { x: 3, z: 140, r: 4, n: 5, act: 'talk', personas: ['local', 'tourist_us', 'tourist_cn'] },
            ],
        };
        ctx.sound('traffic', 18, 12, 120, 1); ctx.sound('crowd', 18, 60, 60, 0.6);
        ctx.spawns['bel-lincoln-square'] = { x: sp.spawn.x - 3, z: sp.spawn.z - 3, heading: headingFromBearing(sp.spawn.heading_deg) };
        void rng; void polyBox; void centroid; void M;
    },
};
