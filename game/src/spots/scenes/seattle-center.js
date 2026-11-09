// ============================================================================
//  Seattle Center — one combined visit (spec 15 R15.7): the Space Needle
//  (1962; walk its base, ride up to the 158 m deck), Chihuly Garden and Glass
//  (Glasshouse with the 30 m red/orange/yellow suspended sculpture; glass in
//  the garden beds — Dale Chihuly credited), actual mapped museum context, the 1962
//  ALWEG monorail with a train looping to the station, the Wright fountain.
//  Artworks are modelled from descriptions (no photo textures).
//  Local frame: x east, z south; origin = Space Needle centre (OSM w12903132).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, canvas, canvasTexture, inPoly, clamp, lerp, smooth, headingFromBearing, polyBox, alongPolyline, polylineLength, centroid, offsetPolyline, compactTriangles, capsuleGeometry } from '../kit.js';
import { signBoard, railing } from '../props.js';
import { seaNeedle, seaBackdrop, seaActivity } from './sea-common.js';
import { addTraffic } from '../cars.js';
import { photoHunt } from '../photo-hunt.js';
import { activityFlow } from '../participation.js';
import { facadeMaterial } from '../osm.js';

const NEEDLE = { x: 0.3, z: 0.7, y: 1.5 };
const MONO = [[-46, -86], [-23, -87], [-8, -87], [10, -88], [37, -89], [49, -88], [56, -87], [64, -86], [71, -83], [78, -80], [96, -62], [102, -54], [105, -50], [109, -43], [115, -39], [124, -30], [129, -10], [129, 60], [126, 160], [126, 300]];
const MONO_Y = 7.6; // guideway top above the plaza (≈ 2nd-floor level at MoPOP)
// Museum parent/parts remain context, without an invented replacement mass.
// Their metal skins are not apartment façades or additional hero replacements.
const MOPOP_PARTS = new Set(['w161587742', 'w1092469435', 'w1534908988', 'w1534908989', 'w1534908990', 'w1534908991', 'w1534908992', 'w1534908993', 'w1534908994']);
const MOPOP_METAL = 'mopop-source-metal';

function mopopMetalMaterial() {
    const mat = facadeMaterial(MOPOP_METAL);
    if (mat.userData.mopopMetal) return mat;
    const c = canvas(256, 256), g = c.getContext('2d'), r = rng(2000);
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let x = -16; x < 256; x += 32) {
        const xx = x + (y / 16 % 2) * 16, shade = 232 + Math.floor(r() * 20);
        g.fillStyle = `rgb(${shade},${shade},${shade})`; g.fillRect(xx, y, 31, 15);
    }
    mat.map.dispose(); mat.emissiveMap.dispose();
    mat.map = canvasTexture(c, { repeat: true }); mat.emissiveMap = null;
    mat.emissive.set('#000000'); mat.emissiveIntensity = 0;
    mat.metalness = 0.65; mat.roughness = 0.4;
    mat.userData.nightWindows = false; mat.userData.mopopMetal = true; mat.needsUpdate = true;
    return mat;
}

// ---------------------------------------------------------------------------- Space Needle + base pavilion + elevator ride to the deck
function buildNeedle(ctx) {
    const g = ctx.ground, y = NEEDLE.y;
    ctx.skipBuildings.add('w12903132');
    // round-5 model (sea-common): one lathe top house, recessed glass bands, radial underside beams, 3 gold elevator
    // cabs running on the core, Loupe glass floor, open-air deck with tilted glass barriers (note 55)
    const n = seaNeedle({ detail: 1, visitorGlass: true }); n.position.set(NEEDLE.x, y, NEEDLE.z); ctx.add(n);
    const N = n.userData, LV = N.levels;
    ctx.onNight((k) => N.night(k)); ctx.onUpdate((dt) => N.update(dt));
    // base pavilion: low curved glass pavilion between the legs + gift shop roof
    const b = new GeoBatch();
    b.add(new THREE.CylinderGeometry(13.5, 13.5, 5.2, 48, 1, true), 'glass', M(NEEDLE.x, y + 2.6, NEEDLE.z), '#9fb6c2');
    b.add(new THREE.CylinderGeometry(14.2, 14.2, 0.6, 48), 'paint', M(NEEDLE.x, y + 5.5, NEEDLE.z), '#e9ebe8');
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.rod([NEEDLE.x + Math.cos(a) * 13.5, y, NEEDLE.z + Math.sin(a) * 13.5], [NEEDLE.x + Math.cos(a) * 13.5, y + 5.2, NEEDLE.z + Math.sin(a) * 13.5], 0.06, '#d4d8da', 'steel', 5); }
    const ramp = []; for (let i = 0; i <= 40; i++) { const a = -0.6 + i / 40 * 2.6, r = 16.2; ramp.push([NEEDLE.x + Math.cos(a) * r, y + 0.3 + i / 40 * 2.6, NEEDLE.z + Math.sin(a) * r]); }
    b.tube(ramp, 0.05, '#c9cdd0', 'steel', 5);
    ctx.add(b.build('needle-base'));
    const sign = signBoard('SPACE NEEDLE', 5.2, 0.8, { bg: '#f2f2ee', fg: '#1f3b57', font: (s) => `700 ${s}px "Futura", "Century Gothic", sans-serif` });
    sign.position.set(NEEDLE.x, y + 4.2, NEEDLE.z + 13.9); ctx.add(sign);
    // colliders: pavilion ring, the six leg feet (pairs at 90° / 210° / 330°, half-gap ≈ 3.2 m at r 17.8)
    const ring = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; ring.push([NEEDLE.x + Math.cos(a) * 13.6, NEEDLE.z + Math.sin(a) * 13.6]); }
    ctx.poly(ring);
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); for (const sd of [-1, 1]) ctx.circle(NEEDLE.x + ca * 17.8 - sa * 3.25 * sd, NEEDLE.z + sa * 17.8 + ca * 3.25 * sd, 1.0, 20); }
    // walkable rings: the Loupe (rotating glass floor, 152.6 m) and the open-air deck (158.5 m)
    const ringPoly = (r) => { const p = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; p.push([NEEDLE.x + Math.cos(a) * r, NEEDLE.z + Math.sin(a) * r]); } return p; };
    const walkRing = (yy, r0, r1, h) => {
        const outer = ringPoly(r1), inner = ringPoly(r0);
        ctx.ground.addPoly(outer, (px, pz) => (Math.hypot(px - NEEDLE.x, pz - NEEDLE.z) > r0 - 0.1 ? yy : NaN), yy - 1);
        for (let i = 0; i < 48; i++) {
            const [ax, az] = outer[i], [bx, bz] = outer[(i + 1) % 48], [cx, cz] = inner[i], [dx, dz] = inner[(i + 1) % 48];
            // Both collision consumers need the height: on-foot uses endpoint heights;
            // the local walker / strict tour planner use the enclosing y0/y1 interval.
            ctx.collider({ wall: true, ax, az, bx, bz, y0: yy - 1, y1: yy + h, y0a: yy - 1, y1a: yy + h, y0b: yy - 1, y1b: yy + h, nx: 0, nz: 1, intended: true }); // glass wall / barrier
            ctx.collider({ wall: true, ax: cx, az: cz, bx: dx, bz: dz, y0: yy - 1, y1: yy + h, y0a: yy - 1, y1a: yy + h, y0b: yy - 1, y1b: yy + h, nx: 0, nz: 1, intended: true });
        }
    };
    const LOUPE_Y = y + LV.loupe, DECK_Y = y + LV.deck;
    walkRing(LOUPE_Y, 14.9, 20.1, 3.2); walkRing(DECK_Y, 17.5, 20.8, 2.6);
    // the Loupe turns once every 45 min: stand on it and it carries you round (real speed)
    const LOUPE_W = Math.PI * 2 / 2700;
    ctx.onUpdate((dt, s) => {
        N.loupe.rotation.z += LOUPE_W * dt;
        const p = s.ctl?.position; if (!p || ride || Math.abs(p.y - LOUPE_Y) > 0.6) return;
        const dx = p.x - NEEDLE.x, dz = p.z - NEEDLE.z, r = Math.hypot(dx, dz); if (r < 14.9 || r > 20.1) return;
        const a = Math.atan2(dz, dx) - LOUPE_W * dt; s.ctl.x = NEEDLE.x + Math.cos(a) * r; s.ctl.z = NEEDLE.z + Math.sin(a) * r;
    });
    // ---- activity (note 57): elevator ride → The Loupe → open-air deck. The cab rises along the core in 41 s; you ride inside it.
    // OSM w1136496123: the public approach ends at (-0.7, 18.9),
    // between the south leg pair, outside the pavilion's actual footprint.
    const door = { x: -0.7, z: 18.9 };
    const cab = N.elevators[0], flow = activityFlow(ctx);
    let ride = null;
    ctx.extras.needleElevator = { debug: () => ride && { t: ride.t, speed: ride.speed, y0: ride.y0, y1: ride.y1 } };
    const done = (s, id, title, text) => seaActivity(s, id, 'space-needle', title, text);
    ctx.onUpdate((dt, s) => {
        if (!ride) return;
        ride.t += dt * ride.speed;
        const k = clamp(ride.t / 41, 0, 1), e = k * k * (3 - 2 * k), yy = lerp(ride.y0, ride.y1, e);
        cab.pinned = true; cab.y = yy - y; cab.cab.position.y = cab.y;
        const ca = Math.cos(cab.a), sa = Math.sin(cab.a), px = NEEDLE.x + ca * 6.6, pz = NEEDLE.z + sa * 6.6;
        const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.heading -= lk.dx * 0.0024; ride.pitch = clamp(ride.pitch - lk.dy * 0.0024, -1.3, 1.2);
        s.ctl.rig?.position.set(px, yy + 1.62, pz); s.ctl.rig?.rotation.set(ride.pitch, ride.heading, 0, 'YXZ');
        if (flow.run) { flow.run.progress.value = k; flow.run.status.textContent = `${Math.round(k * 100)}% · ${ride.speed > 1 ? 'Accelerated game ride' : 'Elevator moving'}`; }
        if (k >= 1) flow.complete();
    });
    const startRide = (s, up) => {
        const origin = { ...s.position, heading: s.ctl.heading, pitch: s.ctl.pitch }, ca = Math.cos(cab.a), sa = Math.sin(cab.a);
        flow.begin(s, { title: up ? 'Ride to The Loupe' : 'Return to the plaza', action: 'Hurry the game ride (×4)', cameraRide: true,
            help: 'Look around while the gold cab moves. Leave returns you to your starting floor without completing the ride.',
            started(s) { ride = { t: 0, speed: 1, y0: up ? y + 1.2 : LOUPE_Y - 1.4, y1: up ? LOUPE_Y - 1.4 : y + 1.2, heading: Math.atan2(Math.cos(cab.a), Math.sin(cab.a)) + Math.PI, pitch: up ? -.05 : .1 }; s.sound.play('whoosh'); },
            actioned(s, r) { if (ride) ride.speed = 4; r.busy = true; r.button.textContent = 'Enjoy the view'; },
            cancel(s) { ride = null; cab.pinned = false; s.ctl.enter(origin.x, origin.z, origin.heading, origin.y); s.ctl.pitch = origin.pitch; s.ctl.place?.(); },
            complete(s) {
                ride = null; cab.pinned = false;
                if (up) { s.ctl.y = LOUPE_Y; s.ctl.teleport(NEEDLE.x + ca * 17.4, NEEDLE.z + sa * 17.4, Math.atan2(-ca, -sa)); s.ctl.place?.(); done(s, 'lm-needle-up', '🛗 The Loupe, 500 ft up', 'You are on The Loupe. Look down through the revolving glass floor.'); }
                else { s.ctl.y = y; s.ctl.teleport(door.x, door.z + 1.6, 0); s.ctl.place?.(); }
            },
        });
    };
    ctx.interactables.push({ kind: 'activity', x: door.x, z: door.z, y, r: 3, label: 'Ride the elevator to The Loupe (41 s)', cond: s => s.spot.entry.id === 'space-needle' && !ride && Math.abs(s.ctl.position.y - y) < 1.2, use: s => startRide(s, true) });
    // On the Loupe, manually frame the downward view through the glass.
    const onLevel = (s, yy) => Math.abs(s.ctl.position.y - yy) < 1.2;
    ctx.extras.loupeLook = photoHunt(ctx, { x: NEEDLE.x, z: NEEDLE.z + 17.6, y: LOUPE_Y, r: 3.2, spot: 'space-needle',
        cond: s => !ride && onLevel(s, LOUPE_Y), title: 'Look down through the glass floor',
        unavailable: 'The floor below you rotates at its real slow speed.',
        targets: [{ label: 'The view beneath the revolving glass', x: NEEDLE.x + 1, z: NEEDLE.z + 18.1, y: LOUPE_Y - .04, radius: .18, minDistance: .6, maxDistance: 5, surfaceTolerance: .15, holdSeconds: .75 }],
        onDone: s => done(s, 'lm-needle-loupe', '👀 Through The Loupe', 'You aimed down through the revolving glass and captured the view. The floor turns once every 45 minutes.') });
    // No stair access is advertised: the retained model has no walkable stairs
    // between these levels. The former instant deck-visit award is retired.
    ctx.interactables.push({ kind: 'ride', x: NEEDLE.x + Math.cos(cab.a) * 16.4, z: NEEDLE.z + Math.sin(cab.a) * 16.4, y: LOUPE_Y, r: 3, label: 'Ride the elevator back down', cond: s => s.spot.entry.id === 'space-needle' && !ride && onLevel(s, LOUPE_Y), use: s => startRide(s, false) });
    return { DECK_Y, LOUPE_Y };
}

// ---------------------------------------------------------------------------- Chihuly Glasshouse + suspended sculpture + garden glass
/** a Chihuly "Persian"-like form: a shallow ruffled bowl / trumpet with a wavy rim (lathe + rim displacement) */
function persianGeometry(seed = 1) {
    const prof = []; for (let i = 0; i <= 5; i++) { const t = i / 5; prof.push(new THREE.Vector2(0.04 + 0.5 * Math.pow(t, 1.4), 0.32 * t * t - 0.05 * t)); }
    const g = new THREE.LatheGeometry(prof, 13), p = g.attributes.position, r = rng(seed);
    const lobes = 5 + Math.floor(r() * 4), ph = r() * 6;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), rr = Math.hypot(x, z), a = Math.atan2(z, x); p.setY(i, y + Math.sin(a * lobes + ph) * 0.07 * rr * 2.2); }
    g.computeVertexNormals(); return g;
}
function glassForms(n, colors, { seed = 1, shape = 'tear' } = {}) {
    const g = shape === 'persian' ? persianGeometry(seed) : shape === 'sphere' ? new THREE.SphereGeometry(0.5, 14, 10) : shape === 'reed' ? new THREE.ConeGeometry(0.06, 1, 6) : (() => { const c = new THREE.ConeGeometry(0.16, 0.9, 7, 4); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = y * 4; const x = p.getX(i), z = p.getZ(i); p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(y * 6) * 0.05, y, x * Math.sin(a) + z * Math.cos(a)); } c.computeVertexNormals(); return c; })();
    const m = new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.8, side: shape === 'persian' ? THREE.DoubleSide : THREE.FrontSide, emissive: '#ffffff', emissiveIntensity: 0.0, envMapIntensity: 1.6 });
    // These open bowls are thin glass surfaces, not enclosed solids. Draw both
    // faces together instead of submitting all 1,300 backfaces, then all fronts.
    // Geometry and opacity stay identical; only transparency blend order changes.
    m.forceSinglePass = shape === 'persian';
    // translucent glass: light through it (view-dependent, glowing face-on) + its own colour lit at night
    const GU = { uNight: { value: 0 } };
    m.onBeforeCompile = (sh) => { sh.uniforms.uNight = GU.uNight; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n { float fr = abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance = diffuseColor.rgb * (0.28 + 0.5 * fr + uNight * 0.9); }'); };
    m.customProgramCacheKey = () => 'spotGlass2';
    m.userData.glassNight = GU.uNight;
    compactTriangles(g);
    const im = new THREE.InstancedMesh(g, m, n); im.castShadow = false; im.receiveShadow = false;
    const r = rng(seed), col = new THREE.Color();
    for (let i = 0; i < n; i++) im.setColorAt(i, col.set(colors[Math.floor(r() * colors.length)]));
    return { im, r };
}
function buildChihuly(ctx) {
    const d = ctx.data, g = ctx.ground;
    const gh = d.buildings.find((b) => b.id === 'w329416207');
    ctx.skipBuildings.add('w329416207');
    const bb = polyBox(gh.poly), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, W = bb.x1 - bb.x0, D = bb.z1 - bb.z0, y0 = g.heightAt(cx, cz);
    // Glasshouse: steel frame, clear glass walls, gambrel roof (ridge along z, the long side), 12.2 m tall
    const H = 12.2, eave = 7.4, kneeH = 10.4, b = new GeoBatch(), steel = '#5a6166';
    const glass = new THREE.MeshStandardMaterial({ color: '#dceff4', transparent: true, opacity: 0.22, roughness: 0.02, metalness: 0.0, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide, emissive: new THREE.Color('#ffe3b8'), emissiveIntensity: 0 }); glass.userData.nightEmissive = 0.08; glass.name = 'spot-glasshouse'; glass.forceSinglePass = true;
    const prof = (u) => { const a = Math.abs(u) / (W / 2); return a > 0.72 ? eave + (1 - a) / 0.28 * (kneeH - eave) : kneeH + (0.72 - a) / 0.72 * (H - kneeH); }; // gambrel section height at offset u
    const gGeo = new THREE.BufferGeometry(), pos = [];
    const us = [-W / 2, -W / 2 * 0.72, 0, W / 2 * 0.72, W / 2];
    for (let i = 0; i < us.length - 1; i++) { const ua = us[i], ub = us[i + 1], ya = prof(ua), yb = prof(ub); pos.push(cx + ua, y0 + ya, bb.z0, cx + ub, y0 + yb, bb.z0, cx + ub, y0 + yb, bb.z1, cx + ua, y0 + ya, bb.z0, cx + ub, y0 + yb, bb.z1, cx + ua, y0 + ya, bb.z1); }
    for (const z of [bb.z0, bb.z1]) for (let i = 0; i < us.length - 1; i++) { const ua = us[i], ub = us[i + 1]; pos.push(cx + ua, y0, z, cx + ub, y0, z, cx + ub, y0 + prof(ub), z, cx + ua, y0, z, cx + ub, y0 + prof(ub), z, cx + ua, y0 + prof(ua), z); }
    for (const x of [bb.x0, bb.x1]) pos.push(x, y0, bb.z0, x, y0, bb.z1, x, y0 + eave, bb.z1, x, y0, bb.z0, x, y0 + eave, bb.z1, x, y0 + eave, bb.z0);
    gGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gGeo.computeVertexNormals();
    const glassMesh = new THREE.Mesh(gGeo, glass); glassMesh.name = 'glasshouse-glass'; glassMesh.renderOrder = 3; ctx.add(glassMesh);
    // frame: portal frames every 3 m along z + mullions
    for (let z = bb.z0; z <= bb.z1 + 0.01; z += D / Math.round(D / 3)) {
        for (let i = 0; i < us.length - 1; i++) b.rod([cx + us[i], y0 + prof(us[i]), z], [cx + us[i + 1], y0 + prof(us[i + 1]), z], 0.09, steel, 'metal', 5);
        for (const x of [bb.x0, bb.x1]) b.rod([x, y0, z], [x, y0 + eave, z], 0.1, steel, 'metal', 5);
    }
    for (const u of us) b.rod([cx + u, y0 + prof(u), bb.z0], [cx + u, y0 + prof(u), bb.z1], 0.08, steel, 'metal', 5);
    for (let y = 2.5; y < eave; y += 2.5) for (const x of [bb.x0, bb.x1]) b.rod([x, y0 + y, bb.z0], [x, y0 + y, bb.z1], 0.05, steel, 'metal', 4);
    for (const z of [bb.z0, bb.z1]) for (let u = -W / 2; u <= W / 2 + 0.01; u += W / 8) b.rod([cx + u, y0, z], [cx + u, y0 + prof(u), z], 0.06, steel, 'metal', 4);
    b.box(cx, y0 - 0.05, cz, W, 0.12, D, '#6f6a62', 'stone'); // dark radiant floor
    ctx.add(b.build('glasshouse-frame'));
    // walls on three sides; the east side (Art Plaza, sliding doors) stays open so you can walk in under the sculpture
    for (const [ax, az, bx2, bz] of [[bb.x0, bb.z0, bb.x1, bb.z0], [bb.x0, bb.z1, bb.x1, bb.z1], [bb.x0, bb.z0, bb.x0, bb.z1]]) ctx.collider({ wall: true, ax, az, bx: bx2, bz, y0a: y0 - 1, y1a: y0 + 8, y0b: y0 - 1, y1b: y0 + 8, nx: 0, nz: 1, intended: true }); // Glasshouse glass
    // the suspended sculpture: ≈ 30 m of red / orange / yellow / amber forms hanging under the ridge
    // ≈ 30 m long mass of ruffled red / orange / amber / yellow "Persian" forms layered under the ridge, opening outward
    const S = glassForms(1300, ['#c8161d', '#d7261e', '#e8541c', '#f07a1a', '#f6a21f', '#f9c63a', '#b8340f', '#e03a24', '#ff8c2a'], { seed: 7, shape: 'persian' });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), r = S.r, up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    const axisY = y0 + H - 3.4, L0 = bb.z0 + 3, L1 = bb.z1 - 3;
    for (let i = 0; i < 1300; i++) {
        const t = r(), z = lerp(L0, L1, t), env = Math.sin(Math.PI * clamp(t * 1.08 - 0.04, 0, 1)) ** 0.5; // tapered ends
        const a = -Math.PI * (0.05 + 0.9 * r()) - Math.PI * 0 , rad = (1.6 + 1.3 * env) * (0.75 + 0.3 * r());          // lower half of the section (hangs)
        const x = cx + Math.cos(a) * rad * 1.25, y = axisY + Math.sin(a) * rad * 0.9 + 0.8;
        dir.set(Math.cos(a) * 1.25, Math.sin(a) * 0.9, (r() - 0.5) * 0.6).normalize(); q.setFromUnitVectors(up, dir);
        q.multiply(new THREE.Quaternion().setFromEuler(e.set(0, r() * 6.28, 0)));
        const sc = (0.9 + r() * 1.5) * (0.7 + 0.5 * env); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc * (0.8 + r() * 0.5), sc)); S.im.setMatrixAt(i, m4);
    }
    // the hanging steel armature + cables to the ridge
    { const ab = new GeoBatch(); ab.rod([cx, axisY + 0.6, L0], [cx, axisY + 0.6, L1], 0.08, '#2c3236', 'metal', 6); for (let z = L0; z <= L1; z += 3) ab.rod([cx, axisY + 0.6, z], [cx, y0 + H - 0.3, z], 0.015, '#9aa0a4', 'steel', 3); ctx.add(ab.build('chihuly-armature')); }
    S.im.name = 'chihuly-suspended'; ctx.add(S.im);
    ctx.onNight((k) => ctx.scene.traverse((o) => { const u = o.material?.userData?.glassNight; if (u) u.value = k; }));
    // interior lighting at night: warm downlights in the Glasshouse (render lamp points, no posts)
    for (let z = bb.z0 + 4; z < bb.z1 - 2; z += 8) ctx.lampPoints.push({ x: cx, z, y: y0 + 0.02, h: H - 1, noPost: true });
    // garden glass (outside, west of the Glasshouse): the yellow "sun", blue floats, red reeds, purple / white forms in the beds
    const sunC = { x: bb.x0 - 16, z: cz - 2 };
    const sun = glassForms(260, ['#f7d21d', '#f9e04a', '#f2b80f', '#ffe066'], { seed: 3 });
    for (let i = 0; i < 260; i++) { const r2 = sun.r, v = new THREE.Vector3(r2() - 0.5, r2() - 0.3, r2() - 0.5).normalize(); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); m4.compose(new THREE.Vector3(sunC.x + v.x * 0.9, g.heightAt(sunC.x, sunC.z) + 1.6 + v.y * 0.9, sunC.z + v.z * 0.9), q, new THREE.Vector3(1.4, 2.2, 1.4)); sun.im.setMatrixAt(i, m4); }
    sun.im.name = 'chihuly-sun'; ctx.add(sun.im);
    const floats = glassForms(70, ['#1c4fd6', '#2e6cf2', '#0e2f9c', '#4c3fb8', '#1a8fb0', '#d9d4ff'], { seed: 11, shape: 'sphere' });
    for (let i = 0; i < 70; i++) { const r2 = floats.r, x = bb.x0 - 30 + r2() * 14, z = cz + 6 + r2() * 12, s = 0.4 + r2() * 0.9; m4.compose(new THREE.Vector3(x, g.heightAt(x, z) + s * 0.4, z), q.identity(), new THREE.Vector3(s, s, s)); floats.im.setMatrixAt(i, m4); }
    ctx.add(floats.im);
    const reeds = glassForms(160, ['#c4161c', '#e0282e', '#7a1fa2', '#2a2a2a', '#1d7a3a'], { seed: 13, shape: 'reed' });
    for (let i = 0; i < 160; i++) { const r2 = reeds.r, x = bb.x0 - 34 + r2() * 26, z = cz - 22 + r2() * 10, h = 1.5 + r2() * 2.8; q.setFromEuler(e.set((r2() - 0.5) * 0.25, 0, (r2() - 0.5) * 0.25)); m4.compose(new THREE.Vector3(x, g.heightAt(x, z) + h / 2, z), q, new THREE.Vector3(1.2, h, 1.2)); reeds.im.setMatrixAt(i, m4); }
    ctx.add(reeds.im);
    // planting beds (dark mulch + dense shrubs) and the curved paths are painted; shrubs as instanced crowns
    const P = ctx.painter;
    P.circle(sunC.x, sunC.z, 6.5, '#2d6a2a', 'grass'); P.circle(sunC.x, sunC.z, 5.6, '#1d1a17', 'dirt');
    P.custom((x, T, k, isMask) => { if (isMask) return; x.strokeStyle = '#b9b5ab'; x.lineWidth = 3.2 * k; x.lineCap = 'round'; x.beginPath(); const [a1, a2] = T(bb.x0 - 4, bb.z0 - 6), [b1, b2] = T(sunC.x - 9, sunC.z - 14), [c1, c2] = T(sunC.x - 14, sunC.z + 8), [d1, d2] = T(bb.x0 - 4, bb.z1 + 4); x.moveTo(a1, a2); x.bezierCurveTo(b1, b2, c1, c2, d1, d2); x.stroke(); });
    const rr = rng(21);
    for (let i = 0; i < 160; i++) { const x = bb.x0 - 40 + rr() * 38, z = bb.z0 - 14 + rr() * (D + 26); if (Math.hypot(x - sunC.x, z - sunC.z) < 7) continue; ctx.trees.push({ x, z, kind: 'broad', s: rr() < 0.18 ? 0.45 + rr() * 0.3 : 0.22 + rr() * 0.15, c: rr() < 0.3 ? '#5a3a4a' : undefined }); }
    // entrance sign on the Needle plaza side
    const sg = signBoard('CHIHULY GARDEN AND GLASS', 6.8, 0.7, { bg: '#1d1d1f', fg: '#f4f1ea', font: (s) => `600 ${s}px "Gill Sans", "Helvetica Neue", sans-serif` });
    sg.position.set(bb.x1 + 3.5, y0 + 1.25, cz + 10); sg.rotation.y = Math.PI / 2; ctx.add(sg);
    { const wb = new GeoBatch(); wb.box(bb.x1 + 3.4, y0, cz + 10, 0.5, 0.85, 7.4, '#3a3a3c', 'stone', Math.PI / 2 * 0); ctx.add(wb.build('chihuly-sign-wall')); ctx.box(bb.x1 + 3.4, cz + 10, 0.3, 3.7, 0, { prop: true, h: 1.6 }); }
    return { cx, cz, bb, sunC, y0, H };
}

// ---------------------------------------------------------------------------- monorail: twin guideways on T-columns + a 4-car train looping through MoPOP
function buildMonorail(ctx) {
    const g = ctx.ground, b = new GeoBatch(), L = polylineLength(MONO);
    const yAt = (x, z) => Math.max(g.heightAt(x, z), -6) + MONO_Y;
    const lines = [offsetPolyline(MONO, -2.0), offsetPolyline(MONO, 2.0)];
    for (const line of lines) {
        const Ll = polylineLength(line);
        for (let s = 0; s < Ll; s += 3) {
            // Adjacent spans share an edge; the old extra 5 cm made every
            // guideway top overlap the next one and visibly depth-fight.
            const a = alongPolyline(line, s), c = alongPolyline(line, Math.min(Ll, s + 3));
            const ya = yAt(a.x, a.z), yc = yAt(c.x, c.z);
            const nx = -a.tz, nz = a.tx, ncx = -c.tz, ncz = c.tx;
            b.quad([a.x + nx * 0.45, ya, a.z + nz * 0.45], [c.x + ncx * 0.45, yc, c.z + ncz * 0.45], [c.x - ncx * 0.45, yc, c.z - ncz * 0.45], [a.x - nx * 0.45, ya, a.z - nz * 0.45], '#b4b0a6', 'concrete');
            b.quad([a.x + nx * 0.45, ya - 1.4, a.z + nz * 0.45], [c.x + ncx * 0.45, yc - 1.4, c.z + ncz * 0.45], [c.x + ncx * 0.45, yc, c.z + ncz * 0.45], [a.x + nx * 0.45, ya, a.z + nz * 0.45], '#a8a49a', 'concrete');
            b.quad([c.x - ncx * 0.45, yc - 1.4, c.z - ncz * 0.45], [a.x - nx * 0.45, ya - 1.4, a.z - nz * 0.45], [a.x - nx * 0.45, ya, a.z - nz * 0.45], [c.x - ncx * 0.45, yc, c.z - ncz * 0.45], '#a8a49a', 'concrete');
        }
    }
    for (let s = 6; s < L; s += 21) { // T-columns between the beams (not inside MoPOP)
        const p = alongPolyline(MONO, s); if (p.x > 44 && p.x < 116 && p.z > -165 && p.z < -56) continue;
        const gy = g.heightAt(p.x, p.z), top = yAt(p.x, p.z) - 1.4;
        b.box(p.x, gy, p.z, 1.3, top - gy, 1.3, '#b9b5ab', 'concrete', Math.atan2(p.tx, p.tz));
        b.box(p.x, top - 0.8, p.z, 5.6, 0.8, 1.4, '#b9b5ab', 'concrete', Math.atan2(-p.tz, p.tx));
        ctx.circle(p.x, p.z, 0.75, top);
    }
    ctx.add(b.build('monorail-guideway'));
    // train: 4 articulated cars (red livery on this line), straddling the north beam
    const train = new THREE.Group(); train.name = 'monorail-train';
    const carG = capsuleGeometry(1.45, 8.6, 6, 14); carG.rotateZ(Math.PI / 2); carG.scale(1, 1.05, 0.98); compactTriangles(carG);
    const red = new THREE.MeshStandardMaterial({ color: '#c8102e', metalness: 0.3, roughness: 0.35 }), win = new THREE.MeshStandardMaterial({ color: '#1a2630', metalness: 0.6, roughness: 0.1 }), white = new THREE.MeshStandardMaterial({ color: '#eef0f0', roughness: 0.5 });
    const cars = [];
    for (let i = 0; i < 4; i++) {
        const c = new THREE.Group(), body = new THREE.Mesh(carG, red), band = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.9, 2.95), win), skirt = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.9, 2.6), white);
        c.name = i === 0 ? 'monorail-leading-car' : `monorail-car-${i + 1}`;
        band.position.y = 0.35; skirt.position.y = -1.25; body.castShadow = true; c.add(body, band, skirt); train.add(c); cars.push(c);
    }
    ctx.add(train);
    const line = lines[0], LL = polylineLength(line);
    let s = 40, dir = 1, wait = 0;
    ctx.onUpdate((dt, session) => {
        if (wait > 0) wait -= dt; else { s += dir * 12 * dt; if (s > LL - 30) { s = LL - 30; dir = -1; wait = 6; } if (s < 26) { s = 26; dir = 1; wait = 12; } }
        cars.forEach((c, i) => { const p = alongPolyline(line, s - i * 11.6 * dir), q = alongPolyline(line, s - i * 11.6 * dir + 0.5); c.position.set(p.x, yAt(p.x, p.z) + 1.55, p.z); c.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x); });
        session.spot.ctx.extras.trainPos = cars[0].position;
    });
    // station (west end) roof
    const st = new GeoBatch(); st.box(-40, yAt(-40, -86) + 3.5, -86, 34, 0.5, 12, '#d8dcdc', 'paint'); for (const x of [-55, -40, -25]) for (const z of [-91, -81]) st.cyl(x, g.heightAt(x, z), z, 0.25, yAt(x, z) + 3.5 - g.heightAt(x, z), '#c9cdd0', 'steel', 8);
    ctx.add(st.build('monorail-station'));
    return { cars };
}

// ============================================================================
export default {
    env: { fogFar: 4200 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data;
        // plaza level around the Needle base (flat), gentle elsewhere
        const plaza = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; plaza.push([NEEDLE.x + Math.cos(a) * 34, NEEDLE.z + Math.sin(a) * 34]); }
        g.flatten(plaza, NEEDLE.y, 10);
        ctx.terrainOpts = { bg: '#8f8b82', bgMask: 'slab', innerPx: 2048, outerPad: 420, skirtY: -42, skirtColor: '#1f333c' };
        { const c = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.push([NEEDLE.x + Math.cos(a) * 26, NEEDLE.z + Math.sin(a) * 26]); } ctx.exclude.push(c); } // the Needle's OSM parts → hero model
        const needle = buildNeedle(ctx);
        const chi = buildChihuly(ctx);
        buildMonorail(ctx);
        mopopMetalMaterial(); // literal source solids remain ordinary museum context
        ctx.osmBackdrop({ paint: {}, style: (b) => MOPOP_PARTS.has(b.id) ? MOPOP_METAL : undefined,
            streetTreeOpts: { spacing: 12, prob: 0.7 }, areaTreeOpts: { conifer: 0.4 } });
        const P = ctx.painter;
        P.circle(NEEDLE.x, NEEDLE.z, 30, '#b4afa6', 'slab'); P.circle(NEEDLE.x, NEEDLE.z, 13.6, '#8d8a84', 'slab');
        // Howard S. Wright Memorial Fountain: shallow pool south of the base
        { const fw = d.areas.find((a) => a.id === 'w241876412'); if (fw) { const c = centroid(fw.poly), w = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshStandardMaterial({ color: '#3d6f80', roughness: 0.05, metalness: 0.3 })); w.rotation.x = -Math.PI / 2; w.position.set(c[0], g.heightAt(c[0], c[1]) + 0.06, c[1]); ctx.add(w); } }
        // the city around the grounds (seen from the deck: 360°) — real towers, blocks, ground, Elliott Bay + ferries, mountains
        { const W = Object.values(d.spots).flatMap((sp) => sp.extent?.polygon || []), xs = W.map((p) => p[0]), zs = W.map((p) => p[1]), m8 = (v) => Math.round(v / 8) * 8, OUT = 420;
          const hole = { x0: m8(Math.min(...xs) - 60) - OUT + 16, z0: m8(Math.min(...zs) - 60) - OUT + 16, x1: m8(Math.max(...xs) + 60) + OUT - 16, z1: m8(Math.max(...zs) + 60) + OUT - 16 };
          ctx.extras.seaBackdrop = seaBackdrop(ctx, { needle: false, clear: 380, eyeY: 1.6, midrise: 1800, midClear: 420, midBox: [47.596, -122.375, 47.645, -122.31],
            ground: { box: { x0: -4000, z0: -3600, x1: 4000, z1: 3600 }, hole, step: 24, simplify: 0.025, omitSubmerged: true }, trees: 2600, treeClear: 420, lake: true }); }
        // 5th Ave / Broad St traffic
        addTraffic(ctx, { lanes: [{ pts: [[129, 160], [129, -20], [129, -174], [130, -219], [124, -305]], n: 3, speed: 10 }, { pts: [[124, -305], [130, -219], [129, -174], [129, -20], [129, 160]].map(([x, z]) => [x - 5, z]), n: 3, speed: 10 }, { pts: [[7, 120], [18, 108], [40, 83], [79, 34], [103, 6], [129, -20]], n: 2, speed: 10 }] });
        // ---- plaques (Needle 5, Chihuly 3) with artist / architect credits
        const S = d.spots, needleY = NEEDLE.y;
        S['space-needle'].plaques.forEach((pl, i) => { const a = Math.PI / 2 + (i - 2) * 0.32, r = 26; ctx.plaque(pl, NEEDLE.x + Math.cos(a) * r, NEEDLE.z + Math.sin(a) * r, a - Math.PI / 2 + Math.PI, { credit: i === 0 ? 'Space Needle (1962): John Graham Jr., Edward E. Carlson, Victor Steinbrueck.' : null }); });
        S['chihuly'].plaques.forEach((pl, i) => ctx.plaque(pl, chi.bb.x0 - 6 - i * 4, chi.bb.z1 + 6, Math.PI, { credit: 'Glass © Dale Chihuly — modelled in 3-D from public descriptions.', style: 'city' }));
        void needleY;
        // ---- challenges
        ctx.challenge('space-needle', { r: 16, tol: 45, pitch: 60, cond: (s) => s.camera.getWorldDirection(new THREE.Vector3()).y > 0.42, condHint: 'Look straight up the legs.' });
        // Visitor exercises use actual looking and shutters. Their guide rings
        // are temporary game aids, not invented museum hardware.
        ctx.extras.chihulyFraming = photoHunt(ctx, { x: chi.cx + 3, z: chi.cz, spot: 'space-needle', title: 'Frame the Chihuly suspended sculpture',
            unavailable: 'Dale Chihuly’s suspended forms are modelled from public descriptions.',
            targets: [.2, .5, .8].map((t, i) => ({ label: ['North hanging forms', 'Central hanging forms', 'South hanging forms'][i], x: chi.cx - 1, y: chi.y0 + chi.H - 4.6, z: lerp(chi.bb.z0 + 3, chi.bb.z1 - 3, t), radius: .65, surfaceTolerance: 1.2, holdSeconds: .35 })),
            onDone: s => seaActivity(s, 'lm-chihuly-glasshouse', 'space-needle', '🌺 Glasshouse details framed', 'You framed three parts of Dale Chihuly’s suspended sculpture using your own camera view.') });
        // ---- spawns (research)
        for (const id of ['space-needle', 'chihuly']) { const sp = S[id]?.spawn; if (sp) ctx.spawns[id] = { x: sp.x, z: sp.z, heading: headingFromBearing(sp.heading_deg) }; }
        // Arrive on the mapped public approach, 8.3 m from the entrance;
        // the fountain/photo arrival remains freely reachable to the south.
        ctx.spawns['space-needle'] = { x: 0.2, z: 27.2, heading: 0 };
        // ---- crowd
        const q = []; for (let i = 0; i < 10; i++) q.push([NEEDLE.x - 4 + i * 0.85, NEEDLE.z + 17 + (i % 2) * 0.4]);
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 2, tech: 1.5, tourist_cn: 2, tourist_kr: 1.5, tourist_jp: 1.5, tourist_de: 1, tourist_es: 1, tourist_ca: 1.5, tourist_in: 1.5, kid: 2, photographer: 1 },
            walkers: 40,
            paths: d.ways.filter((w) => (w.k === 'pedestrian' || w.k === 'footway') && w.pts.length > 1 && !w.layer && w.indoor !== 'yes').map((w) => w.pts),
            groups: [
                { line: [[NEEDLE.x - 6, NEEDLE.z + 16.5], [NEEDLE.x + 6, NEEDLE.z + 16.5], [NEEDLE.x + 9, NEEDLE.z + 20]], n: 12, act: 'queue', personas: ['tourist_us', 'tourist_cn', 'tourist_in', 'tourist_kr', 'kid', 'tourist_es'] },
                { x: NEEDLE.x - 2, z: NEEDLE.z + 34, r: 3, n: 7, act: 'photo', look: [NEEDLE.x, NEEDLE.z], personas: ['tourist_us', 'tourist_cn', 'tourist_jp', 'photographer'] },
                { x: NEEDLE.x + 8, z: NEEDLE.z + 44, r: 4, n: 5, act: 'watch', look: [NEEDLE.x, NEEDLE.z], personas: ['tourist_de', 'tourist_ca', 'local'] },
                { x: NEEDLE.x - 12, z: NEEDLE.z + 40, r: 0.5, n: 1, act: 'perform', look: [NEEDLE.x, NEEDLE.z + 34], personas: ['busker'], prop: 'guitar' },
                { x: chi.cx, z: chi.cz, r: 6, n: 8, act: 'photo', look: [chi.cx, chi.cz], y: chi.y0, personas: ['tourist_us', 'tourist_kr', 'tourist_jp', 'tourist_cn', 'photographer'] },
                { x: chi.sunC.x + 7, z: chi.sunC.z + 2, r: 2, n: 4, act: 'watch', look: [chi.sunC.x, chi.sunC.z], personas: ['tourist_us', 'tourist_de', 'kid'] },
                { x: chi.bb.x1 + 4, z: chi.cz + 12, r: 0.3, n: 1, act: 'watch', look: [chi.bb.x1 + 10, chi.cz + 12], personas: ['staff'] },
                { x: 111.3, z: -73.5, r: 1.2, n: 3, act: 'watch', look: [111.3, -76], personas: ['local', 'tourist_us'] },
                { x: -20, z: -78, r: 3, n: 6, act: 'watch', look: [-40, -86], personas: ['tourist_us', 'local', 'tech', 'kid'] },
            ],
        };
        // ---- sounds
        ctx.sound('crowd', NEEDLE.x, NEEDLE.z + 25, 70, 1.1); ctx.sound('crowd', chi.cx, chi.cz, 40, 0.6); ctx.sound('traffic', 129, -60, 90, 0.8); ctx.sound('birds', chi.sunC.x, chi.sunC.z, 60, 1); ctx.sound('hum', 60, -86, 50, 0.6);
        ctx.extras.deckY = needle.DECK_Y;
    },
};
