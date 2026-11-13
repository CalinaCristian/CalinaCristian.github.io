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
import { photoHunt } from '../photo-hunt.js';

/**
 * Changing Form (Doris Totten Chase; OSM n693337510, Seattle Office of Arts & Culture GCK74.048): "a square frame with
 * a circle cut out of the middle stacked on a triangular frame with circles cut out of each side", Cor-ten steel that
 * reads dark brown-black, 4.6 m tall (Wikipedia) × 6'3" (1.91 m). Modelled from that description and the Street View
 * look from W Highland Dr (2025 pano; no photo textures): a three-sided upright frame, a round opening in each face,
 * carrying a square frame of the same width whose round opening faces the street and the bay, on a round stepped
 * plinth in the brick plaza. Plate thicknesses, opening radius and the plinth's size are estimates.
 */
const CF = { H: 4.6, W: 1.91, lowH: 2.25, topH: 2.1, plinth: 0.45 };
function changingForm(x, y, z, yaw) {
    const grp = new THREE.Group(); grp.name = 'changing-form';
    const mat = new THREE.MeshStandardMaterial({ color: '#2b2420', metalness: 0.35, roughness: 0.62 });
    const plate = (w, h, r, t) => {
        const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.closePath();
        const hole = new THREE.Path(), n = 40; // (an open polygon: a closed absarc repeats its first point and leaves degenerate triangles)
        for (let i = 0; i < n; i++) { const a = -i / n * Math.PI * 2, px = Math.cos(a) * r, py = h / 2 + Math.sin(a) * r; if (i) hole.lineTo(px, py); else hole.moveTo(px, py); }
        sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 32 });
        g.translate(0, 0, -t / 2); return g;
    };
    // round stepped plinth (three steps)
    const stone = new THREE.MeshStandardMaterial({ color: '#9b8f84', roughness: 0.9 });
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(3.6 - i * 0.55, 3.6 - i * 0.55, CF.plinth / 3, 40), stone); st.position.y = (i + 0.5) * CF.plinth / 3; st.receiveShadow = true; grp.add(st); }
    // lower: three upright faces round a triangle, one opening each
    const inR = CF.W / (2 * Math.sqrt(3));
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + Math.PI; const m = new THREE.Mesh(plate(CF.W, CF.lowH, 0.7, 0.1), mat); m.position.set(Math.sin(a) * inR, CF.plinth, Math.cos(a) * inR); m.rotation.y = a; m.castShadow = true; grp.add(m); }
    // upper: the square frame, its opening along local z
    const top = new THREE.Mesh(plate(CF.W, CF.topH, 0.72, 0.5), mat); top.position.y = CF.plinth + CF.lowH; top.castShadow = true; grp.add(top);
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
        g.flatten([[-30, -3], [61, -3], [62, 7], [60, 11], [54, 12.4], [22, 12.4], [17, 12.4], [15, 13.6], [11, 13.6], [9, 12.4], [4, 12.4], [-23, 11.4], [-25.5, 11.4], [-28.4, 9.6], [-30, 9.6]], 0.15, 1.2); // (the terrace runs level right up to the parapet)
        // W Highland Dr is level with the terrace (round 6 note 30: on the raw DEM the street stood ~2 m above the
        // sidewalk like a wall): the street corridor (sidewalks included) is graded to the terrace in front of the park
        // and eases back to the DEM over ~45 m along the street and ~10 m into the gardens north of it
        g.mod((x, z, h) => {
            if (z > -2.9 || z < -28) return h;
            const kx = 1 - smooth(0, 45, Math.max(-35 - x, x - 66, 0)), kz = 1 - smooth(-17, -28, z);
            return lerp(h, 0.15, kx * kz);
        });
        const OUTER = 360;
        ctx.terrainOpts = { bg: '#5f6a52', innerPx: 2048, outerPad: OUTER, skirtY: -112, skirtColor: '#1f333c' };
        // no generated street trees on the park's own frontage (OSM park way 49734702, x −30 … 61): OSM maps none there and the
        // 2025 panoramas on W Highland Dr (ids y4VIyX3fc6pkQsYrTG-A1w, D19wLVvtz886pOofJWALBA) show an open kerb — the row
        // the generator planted stood between the street and the postcard view
        ctx.exclude.push([[-34, -9.2], [65, -8], [65, 0.5], [-34, 0.5]]);
        ctx.osmBackdrop({ paint: {}, style: (b) => (b.k === 'apartments' ? 'apartment' : 'house'), streetTreeOpts: { spacing: 10, prob: 0.8 }, urban: false });
        // the brick plaza round the sculpture, from the sidewalk to the wall (Street View; OSM maps its two edges as the
        // paving_stones footways w1125970640 / w1125970641)
        ctx.painter.poly([[9.2, -2.4], [15.8, -2.4], [19.5, 3], [19.5, 9.3], [5.5, 9.3], [5.5, 3]], '#a8705a', 'brick');
        // ---- terrace: railing on the edge (OSM w240890465/66), the low wall (w240890467), benches
        const b = new GeoBatch(), y0 = (x, z) => g.heightAt(x, z);
        // the edge (after round 6: "still broken"): a concrete parapet right under the railing line, 0.45 m above the
        // terrace and running down the hillside below it, with the iron railing on top (the old wall stood beside the
        // railing and the terrain sloped away between them)
        // OSM: railing w240890465 (west, height 1.2), wall w240890467 (middle, height 1, with a small bay), railing
        // w240890466 (east, height 1.2). Under all three the retaining wall runs down the hillside.
        const RAIL_W = [[-27, 8.4], [-25, 10], [-23, 10], [4, 11]], WALL = [[4, 11], [10, 11], [12, 12], [14, 12], [16, 11], [22, 11]], RAIL_E = [[22, 11], [54, 11], [58, 10], [59, 7]];
        const T0 = 0.15, KERB = 0.25;
        for (const [L, top] of [[RAIL_W, T0 + KERB], [WALL, T0 + 1.0], [RAIL_E, T0 + KERB]]) {
            for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], len = Math.hypot(bx - ax, bz - az);
                b.box((ax + bx) / 2, -9, (az + bz) / 2, len + 0.36, 9 + top, 0.36, '#bdb8ad', 'stone', Math.atan2(-(bz - az), bx - ax));
                ctx.collider({ wall: true, ax, az, bx, bz, y0a: -5, y1a: 1.5, y0b: -5, y1b: 1.5, nx: 0, nz: -1 }); }
            if (L !== WALL) railing(b, L, () => top, { h: 1.2 - KERB, color: '#2a2e31' });
        }
        // coin-operated binoculars at the railing (OSM n2485862631, amenity=binoculars)
        { const [bx, bz] = [5.2, 9.7]; b.cyl(bx, T0, bz, 0.07, 1.25, '#8f969b', 'metal', 10); b.box(bx, T0 + 1.25, bz, 0.26, 0.3, 0.42, '#aeb4b8', 'metal'); b.cyl(bx - 0.07, T0 + 1.4, bz + 0.27, 0.035, 0.12, '#30363a', 'metal', 8, 1, Math.PI / 2); b.cyl(bx + 0.07, T0 + 1.4, bz + 0.27, 0.035, 0.12, '#30363a', 'metal', 8, 1, Math.PI / 2); ctx.circle(bx, bz, 0.2, 1.6); }
        for (const [x, z] of d.furniture.bench || []) { bench(b, x, y0(x, z), z, Math.PI); ctx.box(x, z, 0.9, 0.3, Math.PI, { prop: true, h: 0.45 }); }
        ctx.add(b.build('terrace'));
        // Changing Form on its round plinth
        const cf = sp.structures.find((s) => s.id === 'changing-form');
        // the square frame faces the street and the bay (Street View from W Highland Dr: the opening reads as a full circle looking ≈ 180°)
        const yawView = 0;
        ctx.add(changingForm(cf.x, 0.15, cf.z, yawView)); ctx.circle(cf.x, cf.z, 1.0, CF.H + CF.plinth); g.addBox(cf.x, cf.z, 2.6, 2.6, 0, -1, 0.15 + CF.plinth * 2 / 3);
        ctx.interactables.push({ kind: 'frame', x: cf.x - 0.4, z: cf.z - 4.4, r: 2, label: 'Frame the skyline through Changing Form', use: s => s.ui.toast('📷 Find your own frame', 'Stand on the street side of Changing Form, look through its round opening towards the bay, then use your camera.') });
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
        const s = signBoard('KERRY PARK', 2.4, 0.5, { bg: '#4a3a24', fg: '#efe6cf', font: (q) => `700 ${q}px Georgia, serif` }); s.position.set(-28.2, 0.9, 0.1); s.rotation.y = Math.PI; ctx.add(s);
        addTraffic(ctx, { lanes: [{ pts: [[260, -9.8], [-122, -12.8]], n: 2, speed: 7 }, { pts: [[-122, -9.2], [260, -6.2]], n: 1, speed: 7 }], parked: [[-60, -12.5, Math.PI / 2], [-48, -12.5, Math.PI / 2], [80, -11.8, -Math.PI / 2], [95, -4.2, -Math.PI / 2], [110, -4.2, -Math.PI / 2]].map(([x, z, yaw]) => ({ x, z, yaw })) });
        // ---- plaques + challenge (Needle + Rainier: the toast says whether the Mountain is out)
        const PL = sp.plaques;
        ctx.plaque(PL[0], -14, 8.6, Math.PI); ctx.plaque(PL[1], cf.x + 4.3, cf.z + 1.0, Math.PI, { credit: 'Changing Form © 1971 Doris Totten Chase — modelled in 3-D from public descriptions.' }); ctx.plaque(PL[2], 40, 8.8, Math.PI);
        const kc = ctx.challenge('kerry-park', { r: 12, tol: 28, view: [800, 1000] }); if (kc) { const base = kc.text; Object.defineProperty(kc, 'text', { get: () => (bd.mountainVisible ? base + ' — with the Mountain out!' : base + ' (Rainier hidden by clouds today)') }); }
        // Actual dusk framing, rather than a button award for the clock.
        if (bd.needle) {
            bd.needle.name = 'kerry-framed-needle';
            ctx.extras.kerryNightFraming = photoHunt(ctx, { x: 12.8, z: 6.2, spot: 'kerry-park', title: 'Frame the city lights at dusk',
                unavailable: 'Look towards the illuminated Needle from the public terrace.',
                targets: [{ label: 'The Needle’s illuminated top house', x: bd.needle.position.x, z: bd.needle.position.z, y: bd.needle.position.y + 153, radius: 14, maxDistance: 2500, featureName: 'kerry-framed-needle', surfaceTolerance: .8, holdSeconds: .8,
                    available: s => (s.nightK ?? 0) > .2, waitHint: 'Choose dusk or night for the city lights' }],
                onDone: s => seaActivity(s, 'lm-kerry-blue-hour', 'kerry-park', '🌃 City lights framed', 'You aimed at the illuminated Needle and captured the dusk or night view.') });
        }
        // ---- crowd: photographers along the railing, people on the lawn and benches, kids on the sculpture
        ctx.crowdCfg = {
            personas: { tourist_us: 4, local: 3, photographer: 2, tourist_cn: 1.5, tourist_kr: 1, tourist_jp: 1, tourist_de: 1, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 1 },
            walkers: 10, paths: [[[-122, -3], [-25, -2]], [[-25, -2], [-25, 7], [-23, 9], [54, 9], [56, 7], [56, -2]], [[-25, -18], [57, -17]], [[57, -17], [58, -98]], [[-25, -18], [-25, -99]]],
            groups: [
                // (lines along the railing, on the terrace side: round 6 note 31 had visitors spawned outside it)
                { line: [[-10, 9.3], [-1, 9.6]], spacing: 2.4, n: 4, act: 'photo', look: [800, 1000], personas: ['photographer', 'tourist_us', 'tourist_cn', 'tourist_kr', 'tourist_jp'] },
                { line: [[25, 9.8], [50, 9.8]], spacing: 4.6, n: 6, act: 'watch', look: [800, 1000], personas: ['tourist_us', 'tourist_de', 'tourist_es', 'local'] },
                { line: [[-19, 8.9], [-13, 9.2]], spacing: 2.6, n: 3, act: 'watch', look: [700, 1000], personas: ['local', 'tourist_ca'] },
                { x: cf.x - 4.2, z: cf.z - 0.8, r: 0.4, n: 2, act: 'pose', look: [cf.x - 8, cf.z - 4], personas: ['kid', 'tourist_us'] },
                { x: cf.x - 5.5, z: cf.z - 4.5, r: 0.5, n: 1, act: 'photo', look: [cf.x, cf.z], personas: ['tourist_us'] },
                { x: 24, z: 7.3, r: 0.2, n: 1, act: 'sit', look: [24, 20], personas: ['local'] },
            ],
        };
        ctx.sound('wind', 10, 5, 80, 1); ctx.sound('crows', -40, 40, 120, 1); ctx.sound('traffic', 0, 200, 400, 0.4);
        ctx.spawns['kerry-park'] = { x: 2, z: 4.5, heading: headingFromBearing(141) };
        ctx.extras.seaBackdrop = bd;
    },
};
