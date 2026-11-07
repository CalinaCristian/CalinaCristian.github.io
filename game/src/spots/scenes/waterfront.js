// ============================================================================
//  Seattle Waterfront (post-viaduct, 2024–25): the Alaskan Way promenade, Pier
//  57 / Miners Landing with the Seattle Great Wheel overhanging Elliott Bay
//  (ride it!), Piers 55–62 decks, the Aquarium + Ocean Pavilion, the Overlook
//  Walk climbing to Pike Place, ferries crossing, the Olympics across the bay.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, smooth, lerp, clamp, headingFromBearing, centroid, polyBox, inPoly, polyArea } from '../kit.js';
import { greatWheel, signBoard } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';

const DECK_Y = 3.4;

function ferry(color = '#1f6b3a') {
    const g = new THREE.Group(); g.name = 'wsf-ferry';
    const white = new THREE.MeshStandardMaterial({ color: '#f1f2ef', roughness: 0.6 }), green = new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: '#2a3138', roughness: 0.3, metalness: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 140), white); hull.position.y = 2; g.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(26.2, 1.4, 140.2), green); stripe.position.y = 0.4; g.add(stripe);
    for (const [y, w, l] of [[6.5, 22, 110], [10, 18, 80], [13, 12, 40]]) { const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, l), white); deck.position.y = y; g.add(deck); const win = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1.1, l - 4), dark); win.position.y = y + 0.3; g.add(win); }
    const stack = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 6), white); stack.position.set(0, 17, 0); g.add(stack);
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.2, 6.1), green); top.position.set(0, 19.6, 0); g.add(top);
    return g;
}

export default {
    env: { fogFar: 8000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('waterfront');
        // seawall: land ≥ 0.2 m (DEM) becomes the promenade level, the bay is deep water
        g.mod((x, z, h) => (h >= 0.2 ? Math.max(h, DECK_Y) : -5));
        ctx.water(0, { x0: -6000, z0: -6000, x1: 6000, z1: 6000 });
        ctx.terrainOpts = { bg: '#9a968c', bgMask: 'slab', innerPx: 2048, skirtY: -6, skirtColor: '#33515e' };
        // piers: decks on piles, walkable
        const piers = d.areas.filter((a) => a.man_made === 'pier' && Math.abs(polyArea(a.poly)) > 40);
        const b = new GeoBatch(), r = rng(9);
        for (const p of piers) {
            const concrete = p.surface === 'concrete' || /62/.test(p.name || '');
            b.prism(p.poly, DECK_Y - 0.6, DECK_Y + 0.08, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'concrete' : 'wood');
            const bb = polyBox(p.poly);
            for (let x = bb.x0 + 2; x < bb.x1; x += 4.5) for (let z = bb.z0 + 2; z < bb.z1; z += 4.5) if (inPoly(x, z, p.poly)) b.cyl(x, -6, z, 0.25, DECK_Y - 0.6 + 6, '#4a3b2e', 'wood', 6);
            g.addPoly(p.poly, DECK_Y + 0.08, -6);
            ctx.painter.poly(p.poly, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'slab' : 'wood');
            // edge railing
            for (let i = 0; i < p.poly.length; i++) { const [ax, az] = p.poly[i], [bx, bz] = p.poly[(i + 1) % p.poly.length]; if (Math.hypot(bx - ax, bz - az) < 1 || g.base((ax + bx) / 2, (az + bz) / 2) >= 0.2) continue; b.rod([ax, DECK_Y + 1.05, az], [bx, DECK_Y + 1.05, bz], 0.04, '#2d3236', 'metal', 5); }
        }
        ctx.add(b.build('piers'));
        // Great Wheel at the end of Pier 57, overhanging the bay; axle along the pier (≈ NE–SW)
        const gw = sp.structures.find((s) => s.id === 'great-wheel');
        const wheel = greatWheel(gw.x, DECK_Y, gw.z, 2.27, { spin: true }); ctx.add(wheel.group);
        ctx.circle(gw.x, gw.z, 9, 50);
        let ride = null;
        ctx.onUpdate((dt, s) => {
            wheel.update(dt * (ride ? 7 : 1), s.nightK);
            if (ride) {
                ride.t += dt;
                const a = wheel.rotor.rotation.z + ride.slot, R = wheel.radius + 1.3, hub = wheel.hub;
                const local = new THREE.Vector3(Math.cos(a) * R, hub + Math.sin(a) * R - 1.4, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 2.27);
                const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.heading -= lk.dx * 0.0024; ride.pitch = clamp(ride.pitch - lk.dy * 0.0024, -1.2, 1.2);
                s.ctl.rig.position.set(gw.x + local.x, DECK_Y + local.y + 0.4, gw.z + local.z); s.ctl.rig.rotation.set(ride.pitch, ride.heading, 0, 'YXZ');
                if (ride.t > 36) { s.ctl.active = true; s.ctl.teleport(ride.back.x, ride.back.z, ride.back.heading); ride = null; s.ui.toast('🎡 Three turns over Elliott Bay', '175 ft up — the West Coast\'s tallest Ferris wheel when it opened in 2012.'); }
            }
        });
        const booth = d.buildings.find((x) => x.id === 'w429553385'); const [bx, bz] = booth ? centroid(booth.poly) : [-47, 64];
        ctx.interactables.push({ kind: 'ride', x: bx + 3, z: bz - 2, r: 3.5, label: 'Ride the Seattle Great Wheel (3 turns)', cond: () => !ride,
            use: (s) => { const p = s.ctl.position; ride = { t: 0, slot: -Math.PI / 2 - 0.05, heading: headingFromBearing(70), pitch: 0, back: { x: p.x, z: p.z, heading: s.ctl.heading } }; s.ctl.active = false; s.sound.play('chime'); } });
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
        // ferries crossing to Bainbridge, the Olympics, downtown towers behind
        const f1 = ferry(), f2 = ferry('#1d5e33'); ctx.add(f1, f2);
        ctx.onUpdate((dt, s) => { const t = s.t; f1.position.set(-900 + ((t * 6) % 1800) * 0.55, 0, 500 - ((t * 6) % 1800) * 0.25); f1.rotation.y = 1.15; f2.position.set(-300 - ((t * 5 + 600) % 1600) * 0.6, 0, -900 + ((t * 5 + 600) % 1600) * 0.2); f2.rotation.y = 1.25 + Math.PI; });
        seattleBackdrop(ctx, { olympics: true, rainier: true, coreTowers: 40, clear: 300, eyeY: DECK_Y + 1.6 });
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
