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
import { activityFlow } from '../participation.js';
import { buildShore } from './waterfront-shore.js';
import { preparePiers, buildPiers, pierStyle, waterfrontBusinesses } from './waterfront-piers.js';
import { PIER_RINGS } from './waterfront-pier-rings.js';
import { buildShopSigns } from './pike-place-shops.js';
import { playgroundKit } from '../playground-kit.js';

const DECK_Y = 3.4;

export default {
    env: { fogFar: 8000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('waterfront');
        // the shoreline is the mapped coastline (seawall + piers, waterfront-shore.js): land is at least promenade level, the
        // bay is water (rippled, reflects the sky); the terrain is cut exactly along that line
        const INNER = { x0: -336, z0: -304, x1: 136, z1: 344 }, shore = buildShore(d, INNER);
        const isWater = shore ? shore.isWater : (x, z) => g.base(x, z) < 0.2;
        g.mod((x, z, h) => (isWater(x, z) ? -5 : Math.max(h, DECK_Y)));
        const WY = 0.6; ctx.water(WY, { x0: -6000, z0: -6000, x1: 6000, z1: 6000 }).visible = false;
        const bayW = seaWater(ctx, WY, { name: 'elliott-bay', color: '#1d3640', opacity: 1, repeat: 60 }); ctx.add(bayW);
        ctx.terrainOpts = { bg: '#9a968c', bgMask: 'slab', innerPx: 2048, outerPad: 420, skirtY: -6, skirtColor: '#1d3640', ...(shore ? { inner: INNER, cutouts: shore.cutouts } : {}) };
        // piers: decks on piles, walkable
        // (the pier relations as closed rings joined from their live OSM member ways: waterfront-pier-rings.js)
        const piers = d.areas.flatMap((a) => (PIER_RINGS[a.id] ? PIER_RINGS[a.id].outer.map((poly) => ({ ...a, poly, ringsFrom: 'osm-live' })) : [a])).filter((a) => a.man_made === 'pier' && Math.abs(polyArea(a.poly)) > 40);
        ctx.extras.pierRings = { relations: Object.keys(PIER_RINGS).length, innerRingsNotOpened: Object.values(PIER_RINGS).reduce((n, r) => n + r.inner.length, 0) };
        const b = new GeoBatch(), r = rng(9);
        for (const p of piers) {
            const concrete = p.surface === 'concrete' || /62|58/.test(p.name || ''); // Pier 58 was rebuilt in concrete (opened 2025)
            b.prism(p.poly, DECK_Y - 0.6, DECK_Y + 0.08, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'concrete' : 'wood');
            const bb = polyBox(p.poly);
            if (!shore) for (let x = bb.x0 + 2; x < bb.x1; x += 4.5) for (let z = bb.z0 + 2; z < bb.z1; z += 4.5) if (inPoly(x, z, p.poly)) b.cyl(x, -3, z, 0.25, DECK_Y - 0.6 + 3, '#4a3b2e', 'wood', 6);
            g.addPoly(p.poly, DECK_Y + 0.08, -6);
            ctx.painter.poly(p.poly, concrete ? '#a7a39a' : '#7d6a55', concrete ? 'slab' : 'wood');
            // edge railing
            for (let i = 0; i < p.poly.length; i++) { const [ax, az] = p.poly[i], [bx, bz] = p.poly[(i + 1) % p.poly.length]; const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = (bz - az) / L, nz = -(bx - ax) / L; if (!isWater(mx + nx, mz + nz) && !isWater(mx - nx, mz - nz)) continue; b.rod([ax, DECK_Y + 1.05, az], [bx, DECK_Y + 1.05, bz], 0.04, '#2d3236', 'metal', 5); }
        }
        // the water's edge: concrete seawall, dark timber skirt and fender piles under the pier decks
        if (shore) { const inPier = (x, z) => piers.some((p) => inPoly(x, z, p.poly)); shore.walls(b, DECK_Y, -4, inPier);
            for (const p of piers) { let run = 0; for (let i = 0; i < p.poly.length; i++) { const [ax, az] = p.poly[i], [bx, bz] = p.poly[(i + 1) % p.poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const nx = (bz - az) / L, nz = -(bx - ax) / L;
                for (let t = (3.2 - run % 3.2) % 3.2; t < L; t += 3.2) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, sd = isWater(x + nx, z + nz) ? 1 : isWater(x - nx, z - nz) ? -1 : 0; if (sd) b.cyl(x + nx * sd * 0.3, -3, z + nz * sd * 0.3, 0.17, DECK_Y + 3.35, '#4a3b2e', 'wood', 6); } run += L; } } }
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
        (ctx.extras.sceneCleanups ||= []).push(() => riders.dispose());
        let ride = null; const v3 = new THREE.Vector3();
        ctx.onUpdate((dt, s) => wheel.update(dt, s.nightK, s.t));
        const flow = activityFlow(ctx);
        const end = s => {
            if (!ride) return;
            wheel.speed = 1; wheel.hide = -1; cabin.visible = false; riders.object.visible = false;
            s.ctl.y = ride.back.y; s.ctl.teleport(ride.back.x, ride.back.z, ride.back.heading); ride = null;
        };
        const booth = d.buildings.find((x) => x.id === 'w429553385'); const [bx, bz] = booth ? centroid(booth.poly) : [-47, 64];
        ctx.extras.wheelRide = { active: () => !!ride, turns: () => ride ? (wheel.angle() - ride.angle) / (Math.PI * 2) : 0 };
        ctx.interactables.push({ kind: 'ride', x: bx + 3, z: bz - 2, r: 3.5, label: 'Ride the Seattle Great Wheel (3 turns, ≈ 4½ min)', cond: () => !ride,
            use: s => flow.begin(s, {
                title: 'Seattle Great Wheel', cameraRide: true,
                help: 'Three turns over Elliott Bay, with free look. Leave or Esc returns to the pier early; a completed ride earns the postcard badge.',
                started(s,r) {
                    const p = s.position; let best = 0, by = Infinity;
                    for (let i = 0; i < 42; i++) { wheel.cabLocal(i,v3); if (v3.y < by) { by = v3.y; best = i; } }
                    wheel.hide = best; wheel.speed = 4;
                    ride = { i: best, angle: wheel.angle(), heading: 2.27 + Math.PI / 2 + .6, pitch: .05, back: { x:p.x,z:p.z,y:p.y,heading:s.ctl.heading } };
                    cabin.visible = true; riders.object.visible = true; r.button.hidden = true; s.sound.play('chime');
                },
                update(dt,s,r) {
                    if (!ride) return;
                    wheel.cabLocal(ride.i,v3); wheel.group.localToWorld(v3); cabin.position.copy(v3); cabin.rotation.y = 2.27;
                    for (let k=0;k<2;k++) riders.set(k,{x:v3.x+Math.cos(2.27)*.75,y:v3.y-1.62,z:v3.z-Math.sin(2.27)*.75+(k?.45:-.45)*Math.cos(2.27),yaw:2.27-Math.PI/2,pose:k?'photo':'sit',prop:k?'phone':null});
                    const lk=s.input?.takeLook?.()||{dx:0,dy:0}; ride.heading-=lk.dx*.0024; ride.pitch=clamp(ride.pitch-lk.dy*.0024,-1.2,1);
                    s.ctl.rig.position.set(v3.x-Math.cos(2.27)*.6,v3.y-.55,v3.z+Math.sin(2.27)*.6); s.ctl.rig.rotation.set(ride.pitch,ride.heading,0,'YXZ');
                    const turns=(wheel.angle()-ride.angle)/(Math.PI*2); r.progress.value=turns/3; r.status.textContent=`${Math.min(3,turns).toFixed(1)} / 3 turns`;
                    if(turns>=3)flow.complete();
                },
                cancel:end,
                complete(s) { end(s); seaActivity(s,'lm-great-wheel','waterfront','🎡 Three turns over Elliott Bay','175 ft up — the West Coast\'s tallest Ferris wheel when it opened in 2012.'); },
            }) });
        // Miners Landing / Pier 57 sign, ticket booth sign, Aquarium sign
        const tk = signBoard('SEATTLE GREAT WHEEL', 4.2, 0.6, { bg: '#0c3c78', fg: '#ffffff', font: (s) => `700 ${s}px Arial, sans-serif`, glow: 0.1, night: 1.4 }); tk.position.set(bx + 1, DECK_Y + 3.2, bz - 3.6); tk.rotation.y = Math.PI * 0.85; ctx.add(tk);
        // waterfront fountain (FitzGerald & Tomkins): bronze block cluster with jets
        { const f = sp.structures.find((s) => s.id === 'waterfront-fountain'), fb = new GeoBatch(); for (let i = 0; i < 9; i++) fb.box(f.x + (i % 3 - 1) * 0.9, DECK_Y, f.z + (Math.floor(i / 3) - 1) * 0.9, 0.8, 1.2 + (i * 0.37) % 1.6, 0.8, '#6b4a2a', 'bronze'); fb.cyl(f.x, DECK_Y - 0.2, f.z, 4.5, 0.45, '#8d8a82', 'stone', 32); ctx.add(fb.build('fountain')); ctx.circle(f.x, f.z, 4.4, 0.5); }
        // pier sheds, Overlook Walk and business signs: waterfront-piers.js
        preparePiers(ctx);
        ctx.osmBackdrop({ paint: {}, streetTreeOpts: { spacing: 9, prob: 0.85, kinds: ['primary', 'secondary'] }, style: pierStyle });
        buildPiers(ctx, { deckY: DECK_Y, isWater });
        buildShopSigns(ctx, { list: waterfrontBusinesses(d) });
        // the real city behind + the bay: towers at true heights (lit floors), ferries on the Bainbridge / Bremerton runs, cranes,
        // the Olympics; the lit wheel's mirrored copy is above
        const bd = seaBackdrop(ctx, { clear: 330, eyeY: DECK_Y + 1.6, bay: false, midrise: 900, midClear: 420, midBox: [47.596, -122.345, 47.625, -122.312] });
        // promenade lamps on the water side of Alaskan Way (every 22 m), and warm lights along the pier edges (bay lights at night)
        { const road = [[113, 96], [89, 59], [69, 27], [41, -19], [14, -59], [-25, -112], [-62, -159], [-80, -178]];
          // (r3-sea-spots-b-6) the rebuilt promenade's poles are tall dark square-section posts with a slim arm and a flat head
          // (Street View along Alaskan Way, seattle-spots.md "Waterfront"), not the shared round grey cobra: built here; their light entries go to
          // the shared set with the arm yaw. Post 9 m, arm 2 m and head size are estimates.
          const lb = new GeoBatch(), H = 9;
          for (let i = 1; i < road.length; i++) { const [ax, az] = road[i - 1], [bx, bz] = road[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
            for (let t = 0; t < L; t += 22) for (const sd of [-1, 1]) { const x = ax + ux * t - uz * sd * 13, z = az + uz * t + ux * sd * 13; if (!(x < ax + ux * t && !isWater(x, z))) continue;
                const rot = Math.atan2(-uz * sd, ux * sd), dx = -Math.sin(rot), dz = -Math.cos(rot), y = g.heightAt(x, z), yaw = Math.atan2(dx, dz);
                lb.box(x, y, z, 0.42, 0.5, 0.42, '#3a3d40', 'concrete', yaw); lb.box(x, y + 0.5, z, 0.2, H - 0.5, 0.2, '#25282b', 'metal', yaw);
                lb.boxC(x + dx * 1.0, y + H - 0.18, z + dz * 1.0, 0.09, 0.09, 2.0, '#25282b', 'metal', yaw);
                lb.boxC(x + dx * 1.95, y + H - 0.32, z + dz * 1.95, 0.34, 0.12, 0.62, '#25282b', 'metal', yaw);
                ctx.circle(x, z, 0.25, 9);
                ctx.lampPoints.push({ x, z, noPost: true, h: (H - 0.4) * 8 / 7.7, y, rot: rot + Math.PI / 2 }); } }
          ctx.add(lb.build('promenade-lamps')); }
        // (r3-sea-spots-b-6) Pier 58 playground (OSM w1417461575, equipment not mapped): generic climbing tower and swings on
        // the rebuilt pier's deck; the promenade's planted beds (OSM natural=scrub / flowerbed / man_made=bioswale, Street View
        // seattle-spots.md "Waterfront": planted beds between road and promenade) carry low shrubs instead of reading as grass
        { const pg = d.areas.find((a) => a.id === 'w1417461575'); if (pg) ctx.extras.pier58Playground = playgroundKit(ctx, pg.poly, { y: DECK_Y + 0.08, name: 'pier58-playground' }).pieces; }
        { const rb = rng(1417); let n = 0; for (const a of d.areas) { if (!(a.natural === 'scrub' || a.landuse === 'flowerbed' || a.man_made === 'bioswale')) continue; const B = polyBox(a.poly), A = Math.abs(polyArea(a.poly));
            for (let i = 0, k = 0; i < 400 && k < Math.min(60, A / 6); i++) { const x = B.x0 + rb() * (B.x1 - B.x0), z = B.z0 + rb() * (B.z1 - B.z0); if (!inPoly(x, z, a.poly) || isWater(x, z)) continue; k++; n++; ctx.trees.push({ x, z, kind: 'shrub', s: 0.35 + rb() * 0.35, c: ['#4f6a38', '#5d7340', '#6b5a3a', '#46603a', '#7a6a4a'][k % 5] }); } }
          ctx.extras.plantedBedShrubs = n; }
        // traffic follows the mapped carriageways: one two-way road south of Union St (ways 519441949, 1166041039), two one-way
        // roadways north of it (southbound way 1020457467; northbound ways 1167554010 + 1321962100). The old hand-drawn line ran
        // straight on and put cars on the promenade near Pine St.
        { const way = (id) => d.ways.find((w) => w.id === id)?.pts || [], off = (pts, k) => pts.map(([x, z]) => [x + 2.6 * k, z - 1.6 * k]);
          const main = [...way('w519441949'), ...way('w1166041039').slice(1)], nb = [...way('w1167554010'), ...way('w1321962100').slice(1)], sb = way('w1020457467');
          if (main.length > 3 && nb.length > 3 && sb.length > 3) addTraffic(ctx, { lanes: [{ pts: [...off(main, 1), ...nb.slice(1)], n: 4, speed: 10 }, { pts: [...sb, ...off([...main].reverse(), -1).slice(1)], n: 4, speed: 10 }] }); }
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], bx + 2, bz + 5, Math.PI * 0.8, { credit: 'Seattle Great Wheel (2012): 53.3 m, 42 gondolas.' });
        ctx.plaque(PL[1], 18, 66, Math.PI * 0.8); ctx.plaque(PL[2], -27, -50, Math.PI * 0.5); ctx.plaque(PL[3], -60, -140, Math.PI * 0.8);
        ctx.challenge('waterfront', { x: 3.5, z: -7.5, r: 6, tol: 30 }); // the research point (0, 0) lies in the mapped cove between Pier 58 and the seawall (water way 1417461574): the stand is the promenade paving 8 m north-east of it, the wheel on the same bearing
        // crowd
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 2.5, tech: 1, tourist_cn: 2, tourist_kr: 1.2, tourist_jp: 1.2, tourist_de: 1, tourist_es: 1, tourist_ca: 1.5, tourist_in: 1.2, kid: 1.5, photographer: 0.8 },
            walkers: 40, paths: [...ctx.footLines(), [[19, 6], [31, 25], [43, 43], [58, 68], [81, 105], [102, 139]], [[-45, -60], [-28, -42], [3, -15], [19, 6]]],
            groups: [
                { line: [[bx + 2.5, bz + 3.5], [bx + 8, bz + 5], [bx + 14, bz + 6.5]], n: 12, act: 'queue', personas: ['tourist_us', 'kid', 'tourist_cn', 'tourist_in', 'tourist_es', 'tourist_ca'] },
                { x: gw.x + 12, z: gw.z - 6, r: 4, n: 6, act: 'photo', look: [gw.x, gw.z], personas: ['tourist_us', 'tourist_kr', 'tourist_jp', 'photographer'] },
                { x: -20, z: 60, r: 5, n: 7, act: 'watch', look: [-400, 300], personas: ['tourist_us', 'local', 'tourist_de', 'tourist_ca'] },
                { x: 30, z: 50, r: 0.5, n: 1, act: 'perform', look: [20, 40], personas: ['busker'], prop: 'guitar' },
                { x: -26, z: -57, r: 3, n: 5, act: 'watch', look: [-40, -57], personas: ['kid', 'tourist_us', 'tourist_cn'] },
                { x: bx + 1, z: bz + 3.6, r: 0.3, n: 1, act: 'watch', look: [bx + 6, bz + 6], personas: ['staff'] },
            ],
        };
        ctx.sound('water', -40, 60, 120, 1); ctx.sound('gulls', -60, 60, 200, 1.2); ctx.sound('crowd', 0, 60, 70, 1); ctx.sound('traffic', 40, -20, 80, 0.7); ctx.sound('bell', -300, 300, 900, 0.6);
        ctx.spawns['waterfront'] = { x: sp.spawn.x + 6, z: sp.spawn.z - 6, heading: headingFromBearing(sp.spawn.heading_deg) };
        void smooth; void lerp; void M;
    },
};
