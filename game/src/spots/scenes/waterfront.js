// ============================================================================
//  Seattle Waterfront (post-viaduct, 2024–25): the Alaskan Way promenade, Pier
//  57 / Miners Landing with the Seattle Great Wheel overhanging Elliott Bay
//  (ride it!), Piers 55–62 decks, the Aquarium + Ocean Pavilion, the Overlook
//  Walk climbing to Pike Place, ferries crossing, the Olympics across the bay.
//  Round 5 (notes 60 / 62): sea-common Great Wheel (LED shows, 42 enclosed gondolas; ride INSIDE
//  one with fellow riders), rippled bay, real 3-D skyline + ferries.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, smooth, lerp, clamp, headingFromBearing, centroid, polyBox, inPoly, polyArea } from '../kit.js';
import { signBoard } from '../props.js';
import { seaWheel, seaWater, seaBackdrop, mirrorAbout, seaActivity } from './sea-common.js';
import { makeCrowd } from '../../crowd.js';
import { addTraffic } from '../cars.js';

const DECK_Y = 3.4;

export default {
    env: { fogFar: 8000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('waterfront');
        // seawall: land ≥ 0.2 m (DEM) becomes the promenade level, the bay is deep water
        // seawall: land ≥ 0.2 m (DEM) becomes the promenade level, the bay is water (rippled, reflects the sky)
        g.mod((x, z, h) => (h >= 0.2 ? Math.max(h, DECK_Y) : -5));
        const WY = 0.6; ctx.water(WY, { x0: -6000, z0: -6000, x1: 6000, z1: 6000 }).visible = false;
        const bayW = seaWater(ctx, WY, { name: 'elliott-bay', color: '#1d3640', opacity: 1, repeat: 60 }); ctx.add(bayW);
        ctx.terrainOpts = { bg: '#9a968c', bgMask: 'slab', innerPx: 2048, outerPad: 420, skirtY: -6, skirtColor: '#1d3640' };
        // piers: decks on piles, walkable
        const piers = d.areas.filter((a) => a.man_made === 'pier' && Math.abs(polyArea(a.poly)) > 40);
        const b = new GeoBatch(), r = rng(9);
        for (const p of piers) {
            const concrete = p.surface === 'concrete' || /62/.test(p.name || '');
            b.prism(p.poly, DECK_Y - 0.6, DECK_Y + 0.08, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'concrete' : 'wood');
            const bb = polyBox(p.poly);
            for (let x = bb.x0 + 2; x < bb.x1; x += 4.5) for (let z = bb.z0 + 2; z < bb.z1; z += 4.5) if (inPoly(x, z, p.poly)) b.cyl(x, -3, z, 0.25, DECK_Y - 0.6 + 3, '#4a3b2e', 'wood', 6);
            g.addPoly(p.poly, DECK_Y + 0.08, -6);
            ctx.painter.poly(p.poly, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'slab' : 'wood');
            // edge railing
            for (let i = 0; i < p.poly.length; i++) { const [ax, az] = p.poly[i], [bx, bz] = p.poly[(i + 1) % p.poly.length]; if (Math.hypot(bx - ax, bz - az) < 1 || g.base((ax + bx) / 2, (az + bz) / 2) >= 0.2) continue; b.rod([ax, DECK_Y + 1.05, az], [bx, DECK_Y + 1.05, bz], 0.04, '#2d3236', 'metal', 5); }
        }
        ctx.add(b.build('piers'));
        // Great Wheel at the end of Pier 57, overhanging the bay; axle along the pier (≈ NE–SW)
        const gw = sp.structures.find((s) => s.id === 'great-wheel');
        const wheel = seaWheel(gw.x, DECK_Y, gw.z, 2.27, { spin: true }); ctx.add(wheel.group);
        ctx.circle(gw.x, gw.z, 9, 50);
        // its reflection: a mirrored clone sharing the gondola instance buffers; the rotor angle is synced each frame
        // the enclosed gondola you ride in (note 62): white frame, glass panes, two benches, a couple of fellow riders
        const cabin = new THREE.Group(); cabin.name = 'wheel-gondola-interior'; cabin.visible = false;
        { const cb = new GeoBatch(), F = '#eef1f2';
          cb.box(0, -1.25, 0, 2.3, 0.12, 2.0, '#9aa1a6', 'metal'); cb.box(0, 1.1, 0, 2.3, 0.18, 2.0, F, 'paint');
          for (const [x, z] of [[-1.12, -0.97], [1.12, -0.97], [-1.12, 0.97], [1.12, 0.97]]) cb.box(x, -1.2, z, 0.1, 2.35, 0.1, F, 'paint');
          for (const z of [-0.97, 0.97]) { cb.box(0, -0.25, z, 2.3, 0.06, 0.06, F, 'paint'); cb.box(0, 0.75, z, 2.3, 0.05, 0.05, F, 'paint'); }
          for (const x of [-0.75, 0.75]) { cb.box(x, -1.19, 0, 0.55, 0.42, 1.8, '#3a4a5a', 'plastic'); cb.box(x + Math.sign(x) * 0.25, -0.8, 0, 0.08, 0.5, 1.8, '#3a4a5a', 'plastic'); }
          cb.box(0, 0.95, 0, 0.6, 0.06, 0.6, '#fff4dd', 'glow');
          cabin.add(cb.build('gondola-frame'));
          const gm = new THREE.MeshStandardMaterial({ color: '#a9c4d0', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.16, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false }); gm.name = 'gondola-glass';
          for (const [w, h, x, y, z, ry] of [[2.2, 2.2, 0, 0, -0.96, 0], [2.2, 2.2, 0, 0, 0.96, 0], [1.9, 2.2, -1.11, 0, 0, Math.PI / 2], [1.9, 2.2, 1.11, 0, 0, Math.PI / 2]]) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); pane.position.set(x, y - 0.1, z); pane.rotation.y = ry; pane.renderOrder = 5; cabin.add(pane); } }
        ctx.add(cabin);
        const riders = makeCrowd({ max: 2, city: 'seattle', castShadow: false }); riders.object.visible = false; ctx.add(riders.object);
        let ride = null; const v3 = new THREE.Vector3();
        ctx.onUpdate((dt, s) => {
            wheel.update(dt, s.nightK, s.t);
            if (!ride) return;
            ride.t += dt; wheel.speed = 4; // a 12-minute ride (3 turns) compressed ×4
            wheel.cabLocal(ride.i, v3); wheel.group.localToWorld(v3);
            cabin.position.copy(v3); cabin.rotation.y = 2.27;
            for (let k = 0; k < 2; k++) riders.set(k, { x: v3.x + Math.sin(2.27) * 0.0 + Math.cos(2.27) * 0.75 * (k ? 1 : 1), y: v3.y - 1.62, z: v3.z - Math.sin(2.27) * 0.75 + (k ? 0.45 : -0.45) * Math.cos(2.27), yaw: 2.27 - Math.PI / 2, pose: k ? 'photo' : 'sit', prop: k ? 'phone' : null });
            const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.heading -= lk.dx * 0.0024; ride.pitch = clamp(ride.pitch - lk.dy * 0.0024, -1.2, 1.0);
            s.ctl.rig.position.set(v3.x - Math.cos(2.27) * 0.6, v3.y - 0.55, v3.z + Math.sin(2.27) * 0.6); s.ctl.rig.rotation.set(ride.pitch, ride.heading, 0, 'YXZ');
            if (ride.t > 3 * 90) end(s, true);
        });
        const end = (s, full) => { wheel.speed = 1; wheel.hide = -1; cabin.visible = false; riders.object.visible = false; s.ctl.active = true; s.ctl.teleport(ride.back.x, ride.back.z, ride.back.heading); ride = null;
            if (full) seaActivity(s, 'lm-great-wheel', 'waterfront', '🎡 Three turns over Elliott Bay', '175 ft up — the West Coast\'s tallest Ferris wheel when it opened in 2012.'); };
        const booth = d.buildings.find((x) => x.id === 'w429553385'); const [bx, bz] = booth ? centroid(booth.poly) : [-47, 64];
        ctx.interactables.push({ kind: 'ride', x: bx + 3, z: bz - 2, r: 3.5, label: 'Ride the Seattle Great Wheel (3 turns, ≈ 4 min)', cond: () => !ride,
            use: (s) => { const p = s.ctl.position; let best = 0, by = 1e9; for (let i = 0; i < 42; i++) { wheel.cabLocal(i, v3); if (v3.y < by) { by = v3.y; best = i; } } wheel.hide = best; ride = { i: best, t: 0, heading: 2.27 + Math.PI / 2 + 0.6, pitch: 0.05, back: { x: p.x, z: p.z, heading: s.ctl.heading } }; cabin.visible = true; riders.object.visible = true; s.ctl.active = false; s.sound.play('chime'); s.ui.toast('🎡 Doors closed', 'Enclosed, heated gondolas; 42 of them. Look around (E: get off early).'); } });
        ctx.interactables.push({ kind: 'ride', x: gw.x, z: gw.z, r: 120, label: 'Get off the wheel', cond: () => !!ride, use: (s) => end(s, ride.t > 60) });
        // Miners Landing / Pier 57 sign, ticket booth sign, Aquarium sign
        const sg = signBoard('MINERS LANDING  •  PIER 57', 9, 1.1, { bg: '#7a3b22', fg: '#f6e7c8', font: (s) => `700 ${s}px Georgia, serif` });
        { const p57 = d.buildings.find((x) => x.id === 'w166910699'); if (p57) { const bb = polyBox(p57.poly); sg.position.set(bb.x1 - 2, DECK_Y + 7.5, (bb.z0 + bb.z1) / 2); sg.rotation.y = Math.PI / 2 + 0.55; ctx.add(sg); } }
        const tk = signBoard('SEATTLE GREAT WHEEL', 4.2, 0.6, { bg: '#0c3c78', fg: '#ffffff', font: (s) => `700 ${s}px Arial, sans-serif`, glow: 0.1, night: 1.4 }); tk.position.set(bx + 1, DECK_Y + 3.2, bz - 3.6); tk.rotation.y = Math.PI * 0.85; ctx.add(tk);
        const aq = signBoard('SEATTLE AQUARIUM', 6.2, 0.9, { bg: '#0e5a7a', fg: '#ffffff', font: (s) => `700 ${s}px Arial, sans-serif` }); aq.position.set(-95, DECK_Y + 6.5, -60); aq.rotation.y = Math.PI * 0.75; ctx.add(aq);
        // waterfront fountain (FitzGerald & Tomkins): bronze block cluster with jets
        { const f = sp.structures.find((s) => s.id === 'waterfront-fountain'), fb = new GeoBatch(); for (let i = 0; i < 9; i++) fb.box(f.x + (i % 3 - 1) * 0.9, DECK_Y, f.z + (Math.floor(i / 3) - 1) * 0.9, 0.8, 1.2 + (i * 0.37) % 1.6, 0.8, '#6b4a2a', 'bronze'); fb.cyl(f.x, DECK_Y - 0.2, f.z, 4.5, 0.45, '#8d8a82', 'stone', 32); ctx.add(fb.build('fountain')); ctx.circle(f.x, f.z, 4.4, 0.5); }
        // Overlook Walk: the 2024 bridge deck climbing from the promenade toward MarketFront
        { const ow = d.areas.find((a) => a.id === 'w1256939020'); if (ow) { const bb = polyBox(ow.poly), ob = new GeoBatch(), top = (x, z) => DECK_Y + 2 + clamp((bb.z1 - z) / (bb.z1 - bb.z0), 0, 1) * 18; const geo = new THREE.ShapeGeometry(new THREE.Shape(ow.poly.map(([x, z]) => new THREE.Vector2(x, z)))); geo.rotateX(Math.PI / 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, top(p.getX(i), p.getZ(i))); geo.computeVertexNormals(); ob.add(geo, 'concrete', null, '#c9c5bc'); for (let i = 0; i < ow.poly.length; i += 4) { const [x, z] = ow.poly[i]; ob.cyl(x, g.heightAt(x, z), z, 0.5, top(x, z) - g.heightAt(x, z), '#bcb8ae', 'concrete', 10); } ctx.add(ob.build('overlook-walk')); } }
        ctx.osmBackdrop({ paint: {}, streetTreeOpts: { spacing: 9, prob: 0.85, kinds: ['primary', 'secondary'] }, style: (bd) => (/Pier|Miner/.test(bd.name || '') ? 'brick' : undefined) });
        // the real city behind + the bay: towers at true heights (lit floors), ferries on the Bainbridge / Bremerton runs, cranes,
        // the Olympics; the lit wheel's mirrored copy is above
        const bd = seaBackdrop(ctx, { clear: 330, eyeY: DECK_Y + 1.6, bay: false, midrise: 900, midClear: 420, midBox: [47.596, -122.345, 47.625, -122.312] });
        // promenade lamps on the water side of Alaskan Way (every 22 m), and warm lights along the pier edges (bay lights at night)
        { const road = [[113, 96], [89, 59], [69, 27], [41, -19], [14, -59], [-25, -112], [-62, -159], [-80, -178]];
          for (let i = 1; i < road.length; i++) { const [ax, az] = road[i - 1], [bx, bz] = road[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
            for (let t = 0; t < L; t += 22) for (const sd of [-1, 1]) { const x = ax + ux * t - uz * sd * 13, z = az + uz * t + ux * sd * 13; if (x < ax + ux * t && g.base(x, z) >= 0.2) ctx.lampPoints.push({ x, z, rot: Math.atan2(-uz * sd, ux * sd) }); } } }
        addTraffic(ctx, { lanes: [{ pts: [[113, 96], [89, 59], [69, 27], [41, -19], [14, -59], [-25, -112], [-62, -159], [-80, -178]], n: 4, speed: 10 }, { pts: [[-80, -178], [-62, -159], [-25, -112], [14, -59], [41, -19], [69, 27], [89, 59], [113, 96]].map(([x, z]) => [x + 6, z - 3]), n: 4, speed: 10 }] });
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], bx + 6, bz - 6, Math.PI * 0.8, { credit: 'Seattle Great Wheel (2012): 53.3 m, 42 gondolas.' });
        ctx.plaque(PL[1], 18, 66, Math.PI * 0.8); ctx.plaque(PL[2], -84, -52, Math.PI * 0.8); ctx.plaque(PL[3], -60, -140, Math.PI * 0.8);
        ctx.challenge('waterfront', { r: 14, tol: 30 });
        // crowd
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 2.5, tech: 1, tourist_cn: 2, tourist_kr: 1.2, tourist_jp: 1.2, tourist_de: 1, tourist_es: 1, tourist_ca: 1.5, tourist_in: 1.2, kid: 1.5, photographer: 0.8 },
            walkers: 40, paths: [...ctx.footLines(), [[14, 9], [26, 28], [38, 46], [53, 71], [76, 108], [97, 142]], [[-45, -60], [-28, -42], [-2, -12], [14, 9]]],
            groups: [
                { line: [[bx + 2, bz - 3], [bx + 8, bz - 6], [bx + 14, bz - 2]], n: 12, act: 'queue', personas: ['tourist_us', 'kid', 'tourist_cn', 'tourist_in', 'tourist_es', 'tourist_ca'], y: DECK_Y },
                { x: gw.x + 12, z: gw.z - 6, r: 4, n: 6, act: 'photo', look: [gw.x, gw.z], personas: ['tourist_us', 'tourist_kr', 'tourist_jp', 'photographer'], y: DECK_Y },
                { x: -20, z: 60, r: 5, n: 7, act: 'watch', look: [-400, 300], personas: ['tourist_us', 'local', 'tourist_de', 'tourist_ca'] },
                { x: 30, z: 50, r: 0.5, n: 1, act: 'perform', look: [20, 40], personas: ['busker'], prop: 'guitar' },
                { x: -95, z: -62, r: 3, n: 5, act: 'watch', look: [-95, -70], personas: ['kid', 'tourist_us', 'tourist_cn'] },
                { x: bx - 2, z: bz + 1, r: 0.3, n: 1, act: 'watch', look: [bx + 6, bz - 4], personas: ['staff'], y: DECK_Y },
            ],
        };
        ctx.sound('water', -40, 60, 120, 1); ctx.sound('gulls', -60, 60, 200, 1.2); ctx.sound('crowd', 0, 60, 70, 1); ctx.sound('traffic', 40, -20, 80, 0.7); ctx.sound('bell', -300, 300, 900, 0.6);
        ctx.spawns['waterfront'] = { x: sp.spawn.x + 6, z: sp.spawn.z - 6, heading: headingFromBearing(sp.spawn.heading_deg) };
        void smooth; void lerp; void M;
    },
};
