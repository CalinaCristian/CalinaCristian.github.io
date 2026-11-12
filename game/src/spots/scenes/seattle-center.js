// ============================================================================
//  Seattle Center — one combined visit (spec 15 R15.7): the Space Needle
//  (1962; walk its base, ride up to the 520 ft observation level, the open-air
//  deck and The Loupe's turning glass floor), Chihuly Garden and Glass
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
import { NEEDLE as NL, needlePavilion } from '../space-needle.js';
import { addTraffic } from '../cars.js';
import { photoHunt } from '../photo-hunt.js';
import { activityFlow } from '../participation.js';
import { facadeMaterial } from '../osm.js';
import {prepareSourceContext,addSourceContext} from '../source-context.js';
import { sourceRecord } from '../source-buildings.js';

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

// ---------------------------------------------------------------------------- Space Needle: tower, base pavilion, both public levels, elevator
/**
 * The tower and its rooms come from ../space-needle.js (OSM parts + Street View). This function places them, makes the
 * two public levels walkable (500 ft: The Loupe with its turning glass floor and the lounge; 520 ft: the observation
 * room with the cafe, the wine bar and the open-air deck; the stair between them) and runs the elevator ride.
 */
function buildNeedle(ctx) {
    const y = NEEDLE.y, X = NEEDLE.x, Z = NEEDLE.z, L = NL, TAU = Math.PI * 2;
    ctx.skipBuildings.add('w12903132');
    const n = seaNeedle({ detail: 1, visitorGlass: true }); n.position.set(X, y, Z); ctx.add(n);
    const pav = needlePavilion(); pav.position.set(X, y, Z); ctx.add(pav);
    const N = n.userData;
    ctx.onNight((k) => { N.night(k); pav.userData.night(k); }); ctx.onUpdate((dt) => N.update(dt));
    const at = (r, a) => [X + Math.cos(a) * r, Z + Math.sin(a) * r];
    const ringPoly = (r, k = 48) => Array.from({ length: k }, (_, i) => at(r, i / k * TAU));
    const azOf = (px, pz) => Math.atan2(pz - Z, px - X), radOf = (px, pz) => Math.hypot(px - X, pz - Z);
    const past = (a, a0) => ((a - a0) % TAU + TAU) % TAU; // angle travelled from a0 to a, 0..2π
    // the pavilion's footprint (OSM way 12903132); the legs stand inside it
    ctx.poly(ringPoly(L.pavR + 0.15), { y0: y - 3, y1: y + L.drumTop + 1, roofHeightAt: () => y + L.drumTop + 1 }); // ground level only: the rooms 150 m above stand over it
    // ---- walls with a height band (both collision consumers read the band: on foot the end heights, the local walker y0 / y1)
    const wall = (a, b, y0, y1) => ctx.collider({ wall: true, ax: a[0], az: a[1], bx: b[0], bz: b[1], y0, y1, y0a: y0, y1a: y1, y0b: y0, y1b: y1, nx: 0, nz: 1, intended: true });
    const arcWall = (r, a0, a1, y0, y1) => { const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) * r / 1.1)); for (let i = 0; i < k; i++) wall(at(r, a0 + (a1 - a0) * i / k), at(r, a0 + (a1 - a0) * (i + 1) / k), y0, y1); };
    const radWall = (a, r0, r1, y0, y1) => wall(at(r0, a), at(r1, a), y0, y1);
    const block = (r0, r1, a0, a1, y0, y1) => { arcWall(r0, a0, a1, y0, y1); arcWall(r1, a0, a1, y0, y1); radWall(a0, r0, r1, y0, y1); radWall(a1, r0, r1, y0, y1); };
    const LOUPE_Y = y + L.loupeY, DECK_Y = y + L.deckY, St = L.stair, lo = [LOUPE_Y - 0.5, LOUPE_Y + 2.6], hi = [DECK_Y - 0.5, DECK_Y + 2.6];
    // ---- walkable floors. A floor is only seen from within 1.6 m below its underside, so the levels do not lift each other.
    ctx.ground.addPoly(ringPoly(L.loupeWallR - 0.08), (px, pz) => { const r = radOf(px, pz); return r < L.coreR - 0.05 ? NaN : r >= L.turnR0 && r <= L.turnR1 ? LOUPE_Y + 0.02 : LOUPE_Y; }, LOUPE_Y - 1);
    const inStairWell = (px, pz) => { const r = radOf(px, pz); return r < St.r1 + 0.05 && past(azOf(px, pz), St.a0) <= St.a1 - St.a0; };
    ctx.ground.addPoly(ringPoly(L.deckOutR + 0.1), (px, pz) => (radOf(px, pz) < L.coreR - 0.05 || inStairWell(px, pz) ? NaN : DECK_Y), DECK_Y - 1);
    // the stair: 34 risers on an arc against the core; cut in pieces so that the upper flight is not seen from the floor below it
    { const rise = (L.deckY - L.loupeY) / St.steps, da = (St.a1 - St.a0) / St.steps, PIECES = 12;
        const treadY = (px, pz) => LOUPE_Y + rise * (clamp(Math.floor(past(azOf(px, pz), St.a0) / da), 0, St.steps - 1) + 1);
        for (let k = 0; k < PIECES; k++) {
            const b0 = St.a0 + (St.a1 - St.a0) * k / PIECES, b1 = St.a0 + (St.a1 - St.a0) * (k + 1) / PIECES, poly = [];
            for (let i = 0; i <= 3; i++) poly.push(at(St.r0 - 0.04, b0 + (b1 - b0) * i / 3)); for (let i = 3; i >= 0; i--) poly.push(at(St.r1 + 0.04, b0 + (b1 - b0) * i / 3));
            ctx.ground.addPoly(poly, treadY, LOUPE_Y + rise * (Math.round((b0 - St.a0) / da) + 1) - 0.9);
        }
        arcWall(St.r1 + 0.12, St.a0, St.a1, lo[0], DECK_Y + 1.1);            // stringer / balustrade on the open side, floor to rail
        radWall(St.a1, L.coreR, St.r1 + 0.12, lo[0], DECK_Y - 0.5);          // closed under the head of the flight
        radWall(St.a0, L.coreR, St.r1 + 0.12, DECK_Y - 0.5, DECK_Y + 1.1);   // balustrade over the foot, upstairs
    }
    // ---- 500 ft: core, glazing, the lounge counter with its stools, the banquette
    arcWall(L.coreR + 0.05, 0, TAU, ...lo); arcWall(L.loupeWallR - 0.14, 0, TAU, ...lo);
    { const B = L.bar; block(B.r0 - 0.05, B.r1 + 0.78, B.a0 - 0.02, B.a1 + 0.02, ...lo); for (const a of [B.a0 - 0.02, B.a1 + 0.02]) radWall(a, L.coreR, B.r0, ...lo); }
    { const S = L.sofa; arcWall(S.r1 + 0.06, S.a0, S.a1, ...lo); for (const a of [S.a0, S.a1]) radWall(a, L.coreR, S.r1 + 0.06, ...lo); for (let i = 0; i < 4; i++) { const a = S.a0 + 0.1 + (S.a1 - S.a0 - 0.2) * i / 3; block(S.r1 + 0.45, S.r1 + 1.05, a - 0.04, a + 0.04, ...lo); } }
    // ---- 520 ft: core, glazed wall with its four doorways, the barrier, cafe, wine bar, tables, the glass benches
    arcWall(L.coreR + 0.05, 0, TAU, ...hi); arcWall(L.deckOutR - 0.08, 0, TAU, ...hi);
    { const gap = (L.doorHalf - 0.12) / L.deckInR, D = [...L.doorAz].sort((a, b) => a - b); D.forEach((d, i) => { const next = D[(i + 1) % D.length] + (i + 1 === D.length ? TAU : 0); arcWall(L.deckInR, d + gap, next - gap, ...hi); }); }
    { const C = L.cafe; block(C.r0 - 0.05, C.r1 + 0.12, C.a0 - 0.02, C.a1 + 0.02, ...hi); for (const a of [C.a0 - 0.02, C.a1 + 0.02]) radWall(a, L.coreR, C.r0, ...hi); }
    { const W = L.wine; block(W.r0 - 0.05, W.r1 + 0.76, W.a0 - 0.02, W.a1 + 0.02, ...hi); for (const a of [W.a0 - 0.02, W.a1 + 0.02]) radWall(a, L.coreR, W.r0, ...hi); }
    for (const t of L.deckTables) block(t.r - 0.45, t.r + 0.45, t.az - 0.09, t.az + 0.09, ...hi);
    for (let i = 0; i < L.benches; i++) { const a = (i + 0.5) / L.benches * TAU, hw = 0.9 / 15.9; arcWall(15.42, a - hw, a + hw, ...hi); for (const e of [a - hw, a + hw]) radWall(e, 15.42, L.deckOutR - 0.08, ...hi); }
    // the Loupe turns once every 45 min and carries whoever stands on it (real speed)
    const LOUPE_W = TAU / 2700;
    ctx.onUpdate((dt, s) => {
        N.loupe.rotation.y += LOUPE_W * dt;
        const p = s.ctl?.position; if (!p || ride || Math.abs(p.y - LOUPE_Y) > 0.6) return;
        const r = radOf(p.x, p.z); if (r < L.turnR0 || r > L.turnR1) return;
        const a = azOf(p.x, p.z) - LOUPE_W * dt; s.ctl.x = X + Math.cos(a) * r; s.ctl.z = Z + Math.sin(a) * r;
    });
    // soft pools of light under the entrance canopy (the rooms upstairs are lit by their own fittings)
    for (const [dx, dz] of [[-4, 22.5], [4, 22.5], [0, 26]]) ctx.lampPoints.push({ x: X + dx, z: Z + dz, h: 4, noPost: true });
    // ---- the ride (note 57): the gold car climbs the core to the observation level in 41 s; you stand in it and can look round.
    // OSM way 1136496123: the public approach meets the pavilion at (-0.7, 18.9), its south doorway.
    const door = { x: X - 0.7, z: Z + L.pavR + 0.9 };
    const cab = N.elevators[0], flow = activityFlow(ctx), ca = Math.cos(cab.a), sa = Math.sin(cab.a);
    const lobby = (yy) => ({ x: X + ca * (L.coreR + 1.4), z: Z + sa * (L.coreR + 1.4), yy });
    let ride = null;
    ctx.extras.needleElevator = { debug: () => ride && { t: ride.t, speed: ride.speed, y0: ride.y0, y1: ride.y1 } };
    const done = (s, id, title, text) => seaActivity(s, id, 'space-needle', title, text);
    ctx.onUpdate((dt, s) => {
        if (!ride) return;
        ride.t += dt * ride.speed;
        const k = clamp(ride.t / 41, 0, 1), e = k * k * (3 - 2 * k), yy = lerp(ride.y0, ride.y1, e);
        cab.pinned = true; cab.y = yy - y; cab.cab.position.y = cab.y;
        const px = X + ca * (L.cabR + 0.1), pz = Z + sa * (L.cabR + 0.1);
        const lk = s.input?.takeLook?.() || { dx: 0, dy: 0 }; ride.heading -= lk.dx * 0.0024; ride.pitch = clamp(ride.pitch - lk.dy * 0.0024, -1.3, 1.2);
        s.ctl.rig?.position.set(px, yy + 1.66, pz); s.ctl.rig?.rotation.set(ride.pitch, ride.heading, 0, 'YXZ');
        if (flow.run) { flow.run.progress.value = k; flow.run.status.textContent = `${Math.round(k * 100)}% · ${ride.speed > 1 ? 'Accelerated game ride' : 'Elevator moving'}`; }
        if (k >= 1) flow.complete();
    });
    const startRide = (s, up) => {
        const origin = { ...s.position, heading: s.ctl.heading, pitch: s.ctl.pitch }, from = up ? y + L.cabBaseY : Math.abs(s.ctl.position.y - LOUPE_Y) < 1.2 ? LOUPE_Y : DECK_Y;
        flow.begin(s, { title: up ? 'Ride to the observation level' : 'Return to the plaza', action: 'Hurry the game ride (×4)', cameraRide: true,
            help: 'Look around while the gold car moves: the doors are behind you. Leave returns you to your starting floor without completing the ride.',
            started(s) { ride = { t: 0, speed: 1, y0: from, y1: up ? DECK_Y : y + L.cabBaseY, heading: Math.atan2(ca, sa) + Math.PI, pitch: up ? -.05 : .1 }; s.sound.play('whoosh'); },
            actioned(s, r) { if (ride) ride.speed = 4; r.busy = true; r.button.textContent = 'Enjoy the view'; },
            cancel(s) { ride = null; cab.pinned = false; s.ctl.enter(origin.x, origin.z, origin.heading, origin.y); s.ctl.pitch = origin.pitch; s.ctl.place?.(); },
            complete(s) {
                ride = null; cab.pinned = false;
                if (up) { const p = lobby(DECK_Y); s.ctl.y = DECK_Y; s.ctl.teleport(p.x, p.z, Math.atan2(ca, sa) + Math.PI); s.ctl.place?.(); done(s, 'lm-needle-up', '🛗 520 ft up', 'You are on the observation level. Walk out to the open-air deck, or take the stairs down to The Loupe and its glass floor.'); }
                else { s.ctl.y = y; s.ctl.teleport(door.x, door.z + 1.2, 0); s.ctl.place?.(); }
            },
        });
    };
    const onLevel = (s, yy) => Math.abs(s.ctl.position.y - yy) < 1.2;
    ctx.interactables.push({ kind: 'activity', x: door.x, z: door.z, y, r: 3, label: 'Ride the elevator to the observation level (41 s)', cond: s => s.spot.entry.id === 'space-needle' && !ride && Math.abs(s.ctl.position.y - y) < 1.2, use: s => startRide(s, true) });
    for (const yy of [DECK_Y, LOUPE_Y]) { const p = lobby(yy); ctx.interactables.push({ kind: 'ride', x: p.x, z: p.z, y: yy, r: 2.4, label: 'Ride the elevator back down', cond: s => s.spot.entry.id === 'space-needle' && !ride && onLevel(s, yy), use: s => startRide(s, false) }); }
    // On the Loupe, manually frame the downward view through the glass.
    { const [hx, hz] = at(L.loupeTableR, Math.PI / 2 + 0.26), [tx, tz] = at(L.loupeTableR + 0.5, Math.PI / 2 + 0.34);
        ctx.extras.loupeLook = photoHunt(ctx, { x: hx, z: hz, y: LOUPE_Y, r: 3.2, spot: 'space-needle',
            cond: s => !ride && onLevel(s, LOUPE_Y), title: 'Look down through the glass floor',
            unavailable: 'The floor below you rotates at its real slow speed.',
            targets: [{ label: 'The view beneath the revolving glass', x: tx, z: tz, y: LOUPE_Y - .04, radius: .18, minDistance: .6, maxDistance: 5, surfaceTolerance: .15, holdSeconds: .75 }],
            onDone: s => done(s, 'lm-needle-loupe', '👀 Through The Loupe', 'You aimed down through the revolving glass and captured the view. The floor turns once every 45 minutes.') }); }
    // ---- people upstairs (fixed heights: the crowd's floor search is for the ground)
    const face = (a, inward) => Math.atan2((inward ? -1 : 1) * Math.cos(a), (inward ? -1 : 1) * Math.sin(a));
    const G = [], one = (r, a, yy, act, personas, o = {}) => { const [px, pz] = at(r, a), [lx, lz] = at(o.lookR ?? 60, a); G.push({ x: px, z: pz, r: 0.01, n: 1, act, look: [lx, lz], y: yy, personas, ...o }); };
    { const B = L.bar; one((L.coreR + B.r0) / 2 + 0.15, (B.a0 + B.a1) / 2, LOUPE_Y, 'watch', ['staff']);
        for (const i of [1, 2, 5, 7]) { const a = B.a0 + 0.06 + (B.a1 - B.a0 - 0.12) * i / (B.stools - 1); one(B.r1 + 0.52, a, LOUPE_Y + 0.76 - 0.45, 'sit', ['tourist_us', 'local', 'tech', 'tourist_de'], { yaw: face(a, true), fixedYaw: true, lookR: 0 }); } }
    for (const [a, p] of [[0.5, ['tourist_jp', 'photographer']], [2.3, ['tourist_us', 'kid']], [4.3, ['tourist_kr', 'tourist_cn']], [5.2, ['local', 'tourist_in']]]) one(L.loupeWallR - 0.62, a, LOUPE_Y + 0.012, 'watch', p);
    one(9.3, 1.25, LOUPE_Y, 'photo', ['tourist_es', 'tourist_ca'], { lookR: 12.4 });
    { const C = L.cafe, W = L.wine; one((L.coreR + C.r0) / 2 + 0.25, (C.a0 + C.a1) / 2 + 0.2, DECK_Y, 'watch', ['staff']); one((L.coreR + W.r0) / 2 + 0.2, (W.a0 + W.a1) / 2, DECK_Y, 'watch', ['staff']);
        for (const [i, a] of [C.a0 + 0.5, C.a0 + 0.62, C.a0 + 0.74].entries()) one(C.r1 + 0.75 + i * 0.05, a, DECK_Y, 'watch', ['tourist_us', 'tourist_cn', 'kid', 'tourist_in'], { lookR: 0 });
        for (const i of [1, 3]) { const a = W.a0 + 0.07 + (W.a1 - W.a0 - 0.14) * i / (W.stools - 1); one(W.r1 + 0.5, a, DECK_Y + 0.76 - 0.45, 'sit', ['tourist_de', 'local', 'tourist_ca'], { yaw: face(a, true), fixedYaw: true, lookR: 0 }); } }
    for (const [a, p] of [[0.38, ['tourist_us', 'photographer']], [1.75, ['tourist_cn', 'tourist_kr']], [3.3, ['tourist_jp', 'kid']], [4.75, ['tourist_es', 'tourist_us']], [5.85, ['tech', 'local']]]) one(L.deckInR + 1.0, a, DECK_Y, a > 3 ? 'photo' : 'watch', p);
    for (const [a, p] of [[1.05, ['tourist_in', 'tourist_ca']], [2.9, ['tourist_us', 'tourist_de']], [4.1, ['kid', 'local']]]) one(L.deckInR - 0.75, a, DECK_Y, 'watch', p);
    return { DECK_Y, LOUPE_Y, groups: G, door };
}

/** Howard S. Wright Memorial Fountain (OSM way 241876412, kerb 394259983): a ring kerb, shallow water and a cluster of
 *  upright jets, as on Street View. Jet heights and their rhythm are estimates. */
function buildFountain(ctx) {
    const d = ctx.data, g = ctx.ground, fw = d.areas.find((a) => a.id === 'w241876412'); if (!fw) return;
    const c = centroid(fw.poly), y0 = g.heightAt(c[0], c[1]), b = new GeoBatch(), R = 5.1;
    b.add(new THREE.CylinderGeometry(R, R, 0.42, 48, 1, true), 'stone', M(c[0], y0 + 0.21, c[1]), '#9b9891');
    b.add(new THREE.RingGeometry(R - 0.38, R, 48).rotateX(-Math.PI / 2), 'stone', M(c[0], y0 + 0.42, c[1]), '#aaa7a0');
    b.add(new THREE.CylinderGeometry(R - 0.38, R - 0.38, 0.2, 48, 1, true).scale(-1, 1, 1), 'stone', M(c[0], y0 + 0.32, c[1]), '#8d8a84');
    ctx.add(b.build('wright-fountain'));
    const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.38, 48), new THREE.MeshStandardMaterial({ color: '#3d6f80', roughness: 0.05, metalness: 0.3, emissive: new THREE.Color('#7fd0ff'), emissiveIntensity: 0 }));
    water.material.userData.nightEmissive = 0.25; water.rotation.x = -Math.PI / 2; water.position.set(c[0], y0 + 0.24, c[1]); water.name = 'wright-fountain-water'; ctx.add(water);
    const jm = new THREE.MeshStandardMaterial({ color: '#eef6fa', roughness: 0.3, transparent: true, opacity: 0.72, depthWrite: false, emissive: new THREE.Color('#dff3ff'), emissiveIntensity: 0.15 }); jm.userData.nightEmissive = 0.9; jm.name = 'wright-fountain-jets';
    const jg = new THREE.CylinderGeometry(0.035, 0.085, 1, 7, 1, true); jg.translate(0, 0.5, 0);
    const jets = []; for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI * 2, r = i === 8 ? 0 : 2.2, j = new THREE.Mesh(jg, jm); j.position.set(c[0] + Math.cos(a) * r, y0 + 0.24, c[1] + Math.sin(a) * r); j.castShadow = false; j.name = 'wright-fountain-jet'; ctx.add(j); jets.push(j); }
    let t = 0; ctx.onUpdate((dt) => { t += dt; jets.forEach((j, i) => { j.scale.y = (i === 8 ? 3.1 : 2.1) + Math.sin(t * 1.3 + i * 0.8) * 0.45 + Math.sin(t * 7 + i) * 0.06; }); });
    ctx.poly(Array.from({ length: 20 }, (_, i) => [c[0] + Math.cos(i / 20 * Math.PI * 2) * R, c[1] + Math.sin(i / 20 * Math.PI * 2) * R]), { y0: y0 - 3, y1: y0 + 1, roofHeightAt: () => y0 + 1 });
    ctx.lampPoints.push({ x: c[0], z: c[1], h: 3, noPost: true });
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

// A mapped glass canopy (building=roof, building:material=glass): the native renderer draws every roof as an opaque slab,
// which over the Space Needle spawn read as a dark ceiling 5.6 m up. Drawn instead as clear glass on a thin steel edge with
// posts, at its mapped height. (OSM way 241876407, height 4.3 m; frame and post sizes are estimates.)
function glassCanopy(ctx, id) {
    const bd = ctx.data.buildings.find(b => b.id === id); if (!bd?.poly || bd.k !== 'roof' || !/glass/.test(bd.mat || '')) return null;
    ctx.skipBuildings.add(id);
    const r = sourceRecord(bd, 0, ctx.ground), y = r.datum + r.height, ring = bd.poly, b = new GeoBatch();
    const glass = new THREE.MeshStandardMaterial({ color: '#d7e7ec', transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    b.flat(ring, y, '#ffffff', 'canopyGlass');
    for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); b.rod([ax, y, az], [bx, y, bz], 0.07, '#c9ccc9', 'metal', 6);
        for (let t = 0; t < L; t += 7) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, g0 = ctx.ground.heightAt(x, z); if (y - g0 > 1.8) { b.cyl(x, g0, z, 0.09, y - g0, '#c9ccc9', 'metal', 8); ctx.circle?.(x, z, 0.15, y - g0); } } }
    const mesh = b.build('glass-canopy-' + id, { castShadow: false, matOverrides: { canopyGlass: glass } }); ctx.add(mesh); return mesh;
}

// ============================================================================
export default {
    env: { fogFar: 4200 },
    async build(ctx) {
        await prepareSourceContext(ctx,{replaceNativeSourceIds:['r20085315']});
        const g = ctx.ground, d = ctx.data;
        // plaza level around the Needle base (flat), gentle elsewhere
        const plaza = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; plaza.push([NEEDLE.x + Math.cos(a) * 34, NEEDLE.z + Math.sin(a) * 34]); }
        g.flatten(plaza, NEEDLE.y, 10);
        ctx.terrainOpts = { bg: '#8f8b82', bgMask: 'slab', innerPx: 2048, outerPad: 0, skirt: 0 };
        ctx.treeLod = { cap: Infinity, near: 90, max: 700, force: true };
        { const c = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.push([NEEDLE.x + Math.cos(a) * 26, NEEDLE.z + Math.sin(a) * 26]); } ctx.exclude.push(c); } // the Needle's OSM parts → hero model
        { const fw = d.areas.find((a) => a.id === 'w241876412'); if (fw) { const c = centroid(fw.poly); ctx.exclude.push(Array.from({ length: 16 }, (_, i) => [c[0] + Math.cos(i / 16 * Math.PI * 2) * 6.2, c[1] + Math.sin(i / 16 * Math.PI * 2) * 6.2])); } } // no generated tree in the fountain
        const needle = buildNeedle(ctx);
        for (const id of ['w241876407', 'w394260006', 'w394260012']) glassCanopy(ctx, id); // the entrance canopies (all three mapped as glass roofs)
        const chi = buildChihuly(ctx);
        buildMonorail(ctx);
        mopopMetalMaterial(); // literal source solids remain ordinary museum context
        ctx.osmBackdrop({ paint: {}, style: (b) => MOPOP_PARTS.has(b.id) ? MOPOP_METAL : undefined,
            streetTreeOpts: { spacing: 12, prob: 0.7 }, areaTreeOpts: { conifer: 0.4 } });
        const P = ctx.painter;
        P.circle(NEEDLE.x, NEEDLE.z, 30, '#b4afa6', 'slab'); P.circle(NEEDLE.x, NEEDLE.z, NL.pavR + 0.4, '#8d8a84', 'slab');
        buildFountain(ctx);
        // the city around the grounds (seen from the deck: 360°) — real towers, blocks, ground, Elliott Bay + ferries, mountains
        addSourceContext(ctx);
        ctx.extras.seaBackdrop = seaBackdrop(ctx, { needle: false, towers: false, bay: false, clear: 380, eyeY: 1.6 });
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
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 2, tech: 1.5, tourist_cn: 2, tourist_kr: 1.5, tourist_jp: 1.5, tourist_de: 1, tourist_es: 1, tourist_ca: 1.5, tourist_in: 1.5, kid: 2, photographer: 1 },
            walkers: 40,
            paths: d.ways.filter((w) => (w.k === 'pedestrian' || w.k === 'footway') && w.pts.length > 1 && !w.layer && w.indoor !== 'yes').map((w) => w.pts),
            groups: [
                { line: [[NEEDLE.x + 1.6, NEEDLE.z + 20.6], [NEEDLE.x + 6.5, NEEDLE.z + 21.6], [NEEDLE.x + 10.5, NEEDLE.z + 24.6]], n: 10, act: 'queue', personas: ['tourist_us', 'tourist_cn', 'tourist_in', 'tourist_kr', 'kid', 'tourist_es'] },
                { x: NEEDLE.x - 2, z: NEEDLE.z + 34, r: 3, n: 7, act: 'photo', look: [NEEDLE.x, NEEDLE.z], personas: ['tourist_us', 'tourist_cn', 'tourist_jp', 'photographer'] },
                { x: NEEDLE.x + 8, z: NEEDLE.z + 44, r: 4, n: 5, act: 'watch', look: [NEEDLE.x, NEEDLE.z], personas: ['tourist_de', 'tourist_ca', 'local'] },
                { x: NEEDLE.x - 12, z: NEEDLE.z + 40, r: 0.5, n: 1, act: 'perform', look: [NEEDLE.x, NEEDLE.z + 34], personas: ['busker'], prop: 'guitar' },
                { x: chi.cx, z: chi.cz, r: 6, n: 8, act: 'photo', look: [chi.cx, chi.cz], y: chi.y0, personas: ['tourist_us', 'tourist_kr', 'tourist_jp', 'tourist_cn', 'photographer'] },
                { x: chi.sunC.x + 7, z: chi.sunC.z + 2, r: 2, n: 4, act: 'watch', look: [chi.sunC.x, chi.sunC.z], personas: ['tourist_us', 'tourist_de', 'kid'] },
                { x: chi.bb.x1 + 4, z: chi.cz + 12, r: 0.3, n: 1, act: 'watch', look: [chi.bb.x1 + 10, chi.cz + 12], personas: ['staff'] },
                { x: 111.3, z: -73.5, r: 1.2, n: 3, act: 'watch', look: [111.3, -76], personas: ['local', 'tourist_us'] },
                { x: -20, z: -78, r: 3, n: 6, act: 'watch', look: [-40, -86], personas: ['tourist_us', 'local', 'tech', 'kid'] },
                ...needle.groups,
            ],
        };
        // ---- sounds
        ctx.sound('crowd', NEEDLE.x, NEEDLE.z + 25, 70, 1.1); ctx.sound('crowd', chi.cx, chi.cz, 40, 0.6); ctx.sound('traffic', 129, -60, 90, 0.8); ctx.sound('birds', chi.sunC.x, chi.sunC.z, 60, 1); ctx.sound('hum', 60, -86, 50, 0.6);
        ctx.extras.deckY = needle.DECK_Y;
    },
};
