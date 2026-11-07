// ============================================================================
//  Kerry Park viewpoint (Queen Anne Hill, ≈ 103 m NAVD88): the narrow terrace
//  on W Highland Dr with its railing and Changing Form (Doris Totten Chase,
//  1971; weathered-steel rings — modelled from descriptions, credited), and
//  THE postcard: the hillside falling ~60 m to Mercer St, the Space Needle
//  1.27 km away in the foreground (top ≈ 5.3° above the eye), downtown's
//  towers 2.6–3.6 km behind it at their real heights (Columbia Center,
//  Rainier Square, 1201 Third…, lit floors at night), Elliott Bay with the
//  Bainbridge / Bremerton ferries and the Harbor Island cranes to the right,
//  Mount Rainier when the Mountain is out (weather-dependent, spec 18).
//  Round 5 rebuild (note 58): real terrain beyond the DEM (sea-common
//  seaHeight), no box backdrop in the sightline, 3-D towers with the façade
//  shader, the city ground + Queen Anne / Uptown blocks + trees, the bay.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, smooth, lerp, headingFromBearing } from '../kit.js';
import { railing, signBoard } from '../props.js';
import { bench } from '../osm.js';
import { addTraffic } from '../cars.js';
import { seaBackdrop, seaHeight, seaActivity } from './sea-common.js';

/** Changing Form (1971): two interlocking curved slabs of dark weathered steel, each pierced by a round opening, ≈ 4.6 m */
function changingForm(x, y, z, yaw) {
    const grp = new THREE.Group(); grp.name = 'changing-form';
    const mat = new THREE.MeshStandardMaterial({ color: '#2a201a', metalness: 0.35, roughness: 0.62 });
    for (const s of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(s * 0.55, 0); sh.quadraticCurveTo(s * 1.9, 1.6, s * 1.75, 3.0); sh.quadraticCurveTo(s * 1.5, 4.5, 0, 4.6); sh.lineTo(0, 0);
        const hole = new THREE.Path(); const c = 2.65, r = 0.95;
        if (s > 0) { hole.moveTo(0, c - r); hole.absarc(0, c, r, -Math.PI / 2, Math.PI / 2, false); hole.lineTo(0, c - r); } else { hole.moveTo(0, c + r); hole.absarc(0, c, r, Math.PI / 2, Math.PI * 1.5, false); hole.lineTo(0, c + r); }
        sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, curveSegments: 18 });
        g.translate(0, 0, -0.16);
        const m = new THREE.Mesh(g, mat); m.rotation.y = s * 0.24; m.position.x = s * 0.06; m.position.y = 0.25; m.castShadow = true; grp.add(m);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.1), new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.9 })); base.position.y = 0.125; grp.add(base);
    grp.position.set(x, y, z); grp.rotation.y = yaw;
    return grp;
}

export default {
    env: { fogFar: 9000, ambientCity: 0.2, groundAlbedo: 0.18 },
    async build(ctx) {
        const g = ctx.ground, sp = ctx.spot('kerry-park'), d = ctx.data, E = d.origin.elev, T = d.terrain;
        const pr = d.projection, o = d.origin, llOf = (x, z) => [o.lat - z / pr.mLat, o.lon + x / pr.mLon];
        // ---- terrain: the USGS grid covers 280 × 200 m; beyond it the real slope of Queen Anne (sea-common seaHeight)
        const gx0 = T.x0, gx1 = T.x0 + (T.nx - 1) * T.d, gz0 = T.z0, gz1 = T.z0 + (T.nz - 1) * T.d;
        g.mod((x, z, h) => {
            const out = Math.max(gx0 - x, x - gx1, gz0 - z, z - gz1); if (out < -30) return h;
            const [la, lo] = llOf(x, z); return lerp(h, seaHeight(la, lo) - E, smooth(-30, 25, out));
        });
        g.flatten([[-30, -3], [61, -3], [61, 10.4], [-30, 10.4]], 0.15, 2);
        const OUTER = 360;
        ctx.terrainOpts = { bg: '#5f6a52', innerPx: 2048, outerPad: OUTER, skirtY: -112, skirtColor: '#1f333c' };
        ctx.osmBackdrop({ paint: {}, style: (b) => (b.k === 'apartments' ? 'apartment' : 'house'), streetTreeOpts: { spacing: 10, prob: 0.8 }, urban: false });
        // ---- terrace: railing on the edge (OSM w240890465/66), the low wall (w240890467), benches
        const b = new GeoBatch(), y0 = (x, z) => g.heightAt(x, z);
        railing(b, [[-27, 8.4], [-25, 10], [-23, 10], [4, 11]], y0, { h: 1.2, color: '#2a2e31' });
        railing(b, [[22, 11], [54, 11], [58, 10], [59, 7]], y0, { h: 1.2, color: '#2a2e31' });
        b.box(13, -0.2, 11.6, 18, 0.7, 0.4, '#9c968a', 'stone');
        for (const [x0, z0, x1, z1] of [[-27, 8.4, 4, 11], [4, 11, 22, 11], [22, 11, 59, 7]]) ctx.collider({ wall: true, ax: x0, az: z0, bx: x1, bz: z1, y0a: -5, y1a: 1.4, y0b: -5, y1b: 1.4, nx: 0, nz: -1 });
        for (const [x, z] of d.furniture.bench || []) { bench(b, x, y0(x, z), z, Math.PI); ctx.box(x, z, 0.9, 0.3, Math.PI, { prop: true, h: 0.45 }); }
        ctx.add(b.build('terrace'));
        // Changing Form, framing the Needle (bearing 141°)
        const cf = sp.structures.find((s) => s.id === 'changing-form');
        const yawView = Math.atan2(Math.sin(141 * Math.PI / 180), -Math.cos(141 * Math.PI / 180));
        ctx.add(changingForm(cf.x, 0.15, cf.z, yawView)); ctx.box(cf.x, cf.z, 1.4, 0.55, yawView, { prop: true, h: 4.6 });
        ctx.interactables.push({ kind: 'frame', x: cf.x - 2.6, z: cf.z - 2.2, r: 2, label: 'Frame the skyline through Changing Form', use: (s) => { s.ctl.teleport(cf.x - Math.sin(141 * Math.PI / 180) * 3.2, cf.z + Math.cos(141 * Math.PI / 180) * 3.2, headingFromBearing(141)); s.ctl.pitch = 0.05; } });
        // ---- the view: real city around the scene (the scene's own terrain box is a hole in the city ground)
        const W = d.spots['kerry-park'].extent.polygon, xs = W.map((p) => p[0]), zs = W.map((p) => p[1]), m8 = (v) => Math.round(v / 8) * 8;
        const inner = { x0: m8(Math.min(...xs) - 60), z0: m8(Math.min(...zs) - 60), x1: m8(Math.max(...xs) + 60), z1: m8(Math.max(...zs) + 60) };
        const hole = { x0: inner.x0 - OUTER + 16, z0: inner.z0 - OUTER + 16, x1: inner.x1 + OUTER - 16, z1: inner.z1 + OUTER - 16 };
        const bd = seaBackdrop(ctx, {
            clear: 300, eyeY: 1.6, needleDetail: 1,
            midrise: 2600, midClear: 330, midBox: [47.596, -122.375, 47.6285, -122.315],
            ground: { box: { x0: -4200, z0: -2600, x1: 4200, z1: 5200 }, hole, step: 32 },
            trees: 2600, treeClear: 330,
        });
        // ---- street sign, Highland Dr traffic + parked cars
        const s = signBoard('KERRY PARK', 2.4, 0.5, { bg: '#4a3a24', fg: '#efe6cf', font: (q) => `700 ${q}px Georgia, serif` }); s.position.set(-24, 0.9, -1.2); s.rotation.y = Math.PI; ctx.add(s);
        addTraffic(ctx, { lanes: [{ pts: [[260, -9.8], [-122, -12.8]], n: 2, speed: 7 }, { pts: [[-122, -9.2], [260, -6.2]], n: 1, speed: 7 }], parked: [[-60, -12.5, Math.PI / 2], [-48, -12.5, Math.PI / 2], [80, -11.8, -Math.PI / 2], [95, -4.2, -Math.PI / 2], [110, -4.2, -Math.PI / 2]].map(([x, z, yaw]) => ({ x, z, yaw })) });
        // ---- plaques + challenge (Needle + Rainier: the toast says whether the Mountain is out)
        const PL = sp.plaques;
        ctx.plaque(PL[0], -14, 8.6, Math.PI); ctx.plaque(PL[1], cf.x + 2.6, cf.z + 1.0, Math.PI, { credit: 'Changing Form © 1971 Doris Totten Chase — modelled in 3-D from public descriptions.' }); ctx.plaque(PL[2], 40, 8.8, Math.PI);
        const kc = ctx.challenge('kerry-park', { r: 12, tol: 28, view: [800, 1000] }); if (kc) { const base = kc.text; Object.defineProperty(kc, 'text', { get: () => (bd.mountainVisible ? base + ' — with the Mountain out!' : base + ' (Rainier hidden by clouds today)') }); }
        // ---- activity (note 57): the sunset photo — at golden / blue hour the postcard counts double
        ctx.interactables.push({ kind: 'activity', id: 'kerry-sunset', x: 12.8, z: 6.2, r: 2.2, label: 'Wait for the city lights (blue hour)',
            use: (sess) => { const k = sess.nightK ?? 0; sess.ui.toast(k > 0.2 ? '🌃 Blue hour over Seattle' : '⏳ Come back at dusk', k > 0.2 ? 'The Needle\'s halo and downtown\'s offices light up — take the postcard now.' : 'Kerry Park is busiest at sunset; the skyline lights up about 30 min after.'); if (k > 0.2) seaActivity(sess, 'lm-kerry-blue-hour', 'kerry-park'); } });
        // ---- crowd: photographers along the railing, people on the lawn and benches, kids on the sculpture
        ctx.crowdCfg = {
            personas: { tourist_us: 4, local: 3, photographer: 2, tourist_cn: 1.5, tourist_kr: 1, tourist_jp: 1, tourist_de: 1, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 1 },
            walkers: 10, paths: [[[-122, -3], [-25, -2]], [[-25, -2], [-25, 7], [-23, 9], [54, 9], [56, 7], [56, -2]], [[-25, -18], [57, -17]], [[57, -17], [58, -98]], [[-25, -18], [-25, -99]]],
            groups: [
                { x: -6, z: 9.2, r: 2.5, n: 4, act: 'photo', look: [800, 1000], personas: ['photographer', 'tourist_us', 'tourist_cn', 'tourist_kr', 'tourist_jp'] },
                { x: 30, z: 9.6, r: 4, n: 6, act: 'watch', look: [800, 1000], personas: ['tourist_us', 'tourist_de', 'tourist_es', 'local'] },
                { x: -14, z: 8.9, r: 2.5, n: 3, act: 'watch', look: [700, 1000], personas: ['local', 'tourist_ca'] },
                { x: cf.x - 1.3, z: cf.z - 0.5, r: 0.4, n: 2, act: 'pose', look: [cf.x - 6, cf.z - 4], personas: ['kid', 'tourist_us'] },
                { x: cf.x - 5.5, z: cf.z - 4.5, r: 0.5, n: 1, act: 'photo', look: [cf.x, cf.z], personas: ['tourist_us'] },
                { x: 24, z: 7.3, r: 0.2, n: 1, act: 'sit', look: [24, 20], personas: ['local'] },
            ],
        };
        ctx.sound('wind', 10, 5, 80, 1); ctx.sound('crows', -40, 40, 120, 1); ctx.sound('traffic', 0, 200, 400, 0.4);
        ctx.spawns['kerry-park'] = { x: 2, z: 4.5, heading: headingFromBearing(141) };
        ctx.extras.seaBackdrop = bd;
    },
};
