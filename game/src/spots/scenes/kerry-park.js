// ============================================================================
//  Kerry Park viewpoint (Queen Anne Hill): the narrow terrace on W Highland Dr
//  with the railing, Changing Form (Doris Totten Chase, 1971; black steel with
//  a circular opening — modelled from description, credited) and Seattle's
//  postcard view: the Space Needle in front of downtown, Elliott Bay to the
//  right, Mount Rainier on clear days (weather-dependent, spec 18).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, smooth, lerp, headingFromBearing } from '../kit.js';
import { railing } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { bench } from '../osm.js';
import { addTraffic } from '../cars.js';

function changingForm(x, y, z, yaw) {
    // two curved black steel halves around a circular opening, ≈ 4.6 m tall (15 ft)
    const grp = new THREE.Group(); grp.name = 'changing-form';
    const mat = new THREE.MeshStandardMaterial({ color: '#141516', metalness: 0.55, roughness: 0.45 });
    for (const s of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(s * 0.55, 0); sh.quadraticCurveTo(s * 1.9, 1.6, s * 1.75, 3.0); sh.quadraticCurveTo(s * 1.5, 4.5, 0, 4.6); sh.lineTo(0, 0);
        const hole = new THREE.Path(); const c = 2.65, r = 0.95;
        if (s > 0) { hole.moveTo(0, c - r); hole.absarc(0, c, r, -Math.PI / 2, Math.PI / 2, false); hole.lineTo(0, c - r); } else { hole.moveTo(0, c + r); hole.absarc(0, c, r, Math.PI / 2, Math.PI * 1.5, false); hole.lineTo(0, c + r); }
        sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, curveSegments: 18 });
        g.translate(0, 0, -0.16);
        const m = new THREE.Mesh(g, mat); m.rotation.y = s * 0.24; m.position.x = s * 0.06; m.castShadow = true; grp.add(m);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.1), new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.9 })); base.position.y = 0.12; grp.add(base);
    grp.position.set(x, y, z); grp.rotation.y = yaw;
    return grp;
}

export default {
    env: { fogFar: 9000 },
    async build(ctx) {
        const g = ctx.ground, sp = ctx.spot('kerry-park');
        // terrace level; the hill drops ~20 m below the railing; the city lies ~70 m below the park
        g.flatten([[-30, -3], [61, -3], [61, 10.4], [-30, 10.4]], 0.15, 2);
        g.mod((x, z, h) => (z > 85 ? lerp(h, -66, smooth(85, 520, z)) : h));
        g.mod((x, z, h) => (x > 160 ? lerp(h, -45, smooth(160, 600, x)) : x < -160 ? lerp(h, -60, smooth(-160, -700, x)) : h));
        ctx.terrainOpts = { bg: '#66705c', innerPx: 2048, skirtY: -70, skirtColor: '#77766c', outerPad: 520 };
        ctx.osmBackdrop({ paint: {}, style: (b) => (b.k === 'apartments' ? 'apartment' : 'house'), streetTreeOpts: { spacing: 10, prob: 0.8 }, urban: false });
        // railing on the terrace edge (OSM w240890465/66) + the low wall in the middle (w240890467)
        const b = new GeoBatch(), y0 = (x, z) => g.heightAt(x, z);
        railing(b, [[-27, 8.4], [-25, 10], [-23, 10], [4, 11]], y0, { h: 1.2, color: '#2a2e31' });
        railing(b, [[22, 11], [54, 11], [58, 10], [59, 7]], y0, { h: 1.2, color: '#2a2e31' });
        b.box(13, -0.2, 11.6, 18, 0.7, 0.4, '#9c968a', 'stone');
        for (const [x0, z0, x1, z1] of [[-27, 8.4, 4, 11], [4, 11, 22, 11], [22, 11, 59, 7]]) ctx.collider({ wall: true, ax: x0, az: z0, bx: x1, bz: z1, y0a: -5, y1a: 1.4, y0b: -5, y1b: 1.4, nx: 0, nz: -1 });
        for (const [x, z] of ctx.data.furniture.bench || []) { bench(b, x, y0(x, z), z, Math.PI); ctx.box(x, z, 0.9, 0.3, Math.PI, { prop: true, h: 0.45 }); }
        ctx.add(b.build('terrace'));
        // Changing Form, facing the Needle (bearing 141°)
        const cf = sp.structures.find((s) => s.id === 'changing-form');
        const yawView = Math.atan2(Math.sin(141 * Math.PI / 180), -Math.cos(141 * Math.PI / 180));
        ctx.add(changingForm(cf.x, 0.15, cf.z, yawView)); ctx.box(cf.x, cf.z, 1.4, 0.55, yawView, { prop: true, h: 4.6 });
        ctx.interactables.push({ kind: 'frame', x: cf.x - 2.6, z: cf.z - 2.2, r: 2, label: 'Frame the skyline through Changing Form', use: (s) => { s.ctl.teleport(cf.x - Math.sin(141 * Math.PI / 180) * 3.2, cf.z + Math.cos(141 * Math.PI / 180) * 3.2, headingFromBearing(141)); s.ctl.pitch = 0.12; } });
        // the view
        const bd = seattleBackdrop(ctx, { filler: 2600, coreTowers: 70, bay: true, rainier: true, olympics: true, clear: 300, eyeY: 1.6 });
        // street sign
        { const { signBoard } = await import('../props.js'); const s = signBoard('KERRY PARK', 2.4, 0.5, { bg: '#4a3a24', fg: '#efe6cf', font: (q) => `700 ${q}px Georgia, serif` }); s.position.set(-24, 0.9, -1.2); s.rotation.y = Math.PI; ctx.add(s); }
        addTraffic(ctx, { lanes: [{ pts: [[260, -9.8], [-122, -12.8]], n: 2, speed: 7 }, { pts: [[-122, -9.2], [260, -6.2]], n: 1, speed: 7 }], parked: [[-60, -12.5, Math.PI / 2], [-48, -12.5, Math.PI / 2], [80, -11.8, -Math.PI / 2], [95, -4.2, -Math.PI / 2], [110, -4.2, -Math.PI / 2]].map(([x, z, yaw]) => ({ x, z, yaw })) });
        // plaques + challenge (Needle + Rainier: only with the Mountain out)
        const PL = sp.plaques;
        ctx.plaque(PL[0], -14, 9.0, Math.PI); ctx.plaque(PL[1], cf.x + 2.6, cf.z + 1.0, Math.PI, { credit: 'Changing Form © 1971 Doris Totten Chase — modelled in 3-D from public descriptions.' }); ctx.plaque(PL[2], 40, 9.2, Math.PI);
        ctx.challenge('kerry-park', { r: 10, tol: 20, cond: (s) => !!bd.mountainVisible, condHint: 'The Mountain isn\'t out today — Rainier is hidden by clouds. Try another day (real weather).' });
        // crowd: photographers along the railing, people on the lawn and benches, kids on the sculpture
        ctx.crowdCfg = {
            personas: { tourist_us: 4, local: 3, photographer: 2, tourist_cn: 1.5, tourist_kr: 1, tourist_jp: 1, tourist_de: 1, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 1 },
            walkers: 10, paths: [[[-122, -3], [-25, -2]], [[-25, -2], [-25, 7], [-23, 9], [54, 9], [56, 7], [56, -2]], [[-25, -18], [57, -17]], [[57, -17], [58, -98]], [[-25, -18], [-25, -99]]],
            groups: [
                { x: 6, z: 9.6, r: 3.5, n: 7, act: 'photo', look: [600, 900], personas: ['photographer', 'tourist_us', 'tourist_cn', 'tourist_kr', 'tourist_jp'] },
                { x: 33, z: 9.5, r: 5, n: 6, act: 'watch', look: [700, 900], personas: ['tourist_us', 'tourist_de', 'tourist_es', 'local'] },
                { x: -12, z: 9.2, r: 3, n: 3, act: 'watch', look: [500, 900], personas: ['local', 'tourist_ca'] },
                { x: cf.x - 1.3, z: cf.z - 0.5, r: 0.4, n: 2, act: 'pose', look: [cf.x - 6, cf.z - 4], personas: ['kid', 'tourist_us'] },
                { x: cf.x - 5.5, z: cf.z - 4.5, r: 0.5, n: 1, act: 'photo', look: [cf.x, cf.z], personas: ['tourist_us'] },
                { x: 24, z: 7.3, r: 0.2, n: 1, act: 'sit', look: [24, 20], personas: ['local'] },
            ],
        };
        ctx.sound('wind', 10, 5, 80, 1); ctx.sound('crows', -40, 40, 120, 1); ctx.sound('traffic', 0, 200, 400, 0.4);
        ctx.spawns['kerry-park'] = { x: 2, z: 4.5, heading: headingFromBearing(141) };
        void rng; void M;
    },
};
