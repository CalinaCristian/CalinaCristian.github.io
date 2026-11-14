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
import { GeoBatch, M, rng, canvas, canvasTexture, clamp, lerp, headingFromBearing, alongPolyline, polylineLength, centroid, offsetPolyline, compactTriangles, capsuleGeometry } from '../kit.js';
import { railing } from '../props.js';
import { seaNeedle, seaBackdrop, seaActivity } from './sea-common.js';
import { NEEDLE as NL, needlePavilion } from '../space-needle.js';
import { addTraffic } from '../cars.js';
import { photoHunt } from '../photo-hunt.js';
import { activityFlow } from '../participation.js';
import { facadeMaterial } from '../osm.js';
import {prepareSourceContext,addSourceContext} from '../source-context.js';
import { batchSourceContext, horizonCuller, solidShells, onRenderCamera, distanceHide } from '../frame-budget.js';
import { sourceRecord } from '../source-buildings.js';
import { internationalFountain } from './seattle-center-fountain.js';
import { seattleCenterHeroes, ARENA, arenaParts } from './seattle-center-heroes.js';
import { mopopSkin, MOPOP_LOBES } from './seattle-center-mopop.js';
import { seattleCenterPlanting } from './seattle-center-trees.js';
import { buildChihuly } from './seattle-center-chihuly.js';

const NEEDLE = { x: 0.3, z: 0.7, y: 1.5 };
const MONO = [[-46, -86], [-23, -87], [-8, -87], [10, -88], [37, -89], [49, -88], [56, -87], [64, -86], [71, -83], [78, -80], [96, -62], [102, -54], [105, -50], [109, -43], [115, -39], [124, -30], [129, -10], [129, 60], [126, 160], [126, 300]];
const MONO_Y = 7.6; // guideway top above the plaza (≈ 2nd-floor level at MoPOP)
// Seattle Center station (OSM w161609433, building=train_station, layer 3): an elevated deck, not a building. The two station
// tracks are OSM w394955906 + w4755065 (north) and w394955955 + w161609432 (south), which diverge round the island platform;
// west of MoPOP the guideways follow them (east of x = 56 they keep the MONO offsets, the splice is inside MoPOP).
// Platforms w333355315 (south), w333355314 (island), w333355317 (north); concourse w637649471 (highway=pedestrian, at grade
// with the Center grounds south of it). Deck level: USGS 3DEP 1 m DEM at the concourse (47.62111, −122.34999) = 42.56 m,
// spot origin 40.5 m → +2.05; official panorama 1_C7cgJZv-E44e8HIqd5tg (on the concourse) @170 shows the plaza level with
// it and a ramp down to the east, @330 the platforms level with the concourse, a drop to trees behind the railings.
const TRK_N = [[-45.9, -86.4], [-23.4, -86.9], [-7.6, -87.3], [9.5, -87.8], [37, -88.8], [43.2, -88.8], [49.1, -88.4]];
const TRK_S = [[-45.2, -76.5], [-22.5, -78.8], [-7.3, -80.3], [10.1, -82], [30.6, -84.3], [36.1, -84.7], [43.1, -85], [49.4, -84.6]];
const STATION_DECK = 2.05, STATION_RAIL = STATION_DECK - 0.5; // platform at the car floor, ≈ 0.5 m over the beam top (estimate)
function monoS(x, z) { // arc length of the nearest point on the MONO centre line
    let best = 1e9, bs = 0, acc = 0;
    for (let i = 1; i < MONO.length; i++) { const [ax, az] = MONO[i - 1], [bx, bz] = MONO[i], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), t = clamp(((x - ax) * dx + (z - az) * dz) / (L * L), 0, 1), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (d < best) { best = d; bs = acc + t * L; } acc += L; }
    return bs;
}
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
    // ceiling light for the people upstairs at night (staff, guests): over the opaque floors only, clear of the glass floor
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; for (const [r, yy, h] of [[8.2, LOUPE_Y, 3.2], [9.6, DECK_Y, 2.7]]) { const [px, pz] = at(r, a); ctx.lampPoints.push({ x: px, z: pz, y: yy, h, noPost: true }); } }
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
    ctx.interactables.push({ kind: 'activity', x: door.x, z: door.z, y, r: 3, label: 'Ride the elevator to the observation level (41 s)', cond: s => !ride && Math.abs(s.ctl.position.y - y) < 1.2, use: s => startRide(s, true) });
    for (const yy of [DECK_Y, LOUPE_Y]) { const p = lobby(yy); ctx.interactables.push({ kind: 'ride', x: p.x, z: p.z, y: yy, r: 2.4, label: 'Ride the elevator back down', cond: s => !ride && onLevel(s, yy), use: s => startRide(s, false) }); }
    // On the Loupe, manually frame the downward view through the glass.
    { const [hx, hz] = at(L.loupeTableR, Math.PI / 2 + 0.26), [tx, tz] = at(L.loupeTableR + 0.5, Math.PI / 2 + 0.34);
        ctx.extras.loupeLook = photoHunt(ctx, { x: hx, z: hz, y: LOUPE_Y, r: 3.2,
            cond: s => !ride && onLevel(s, LOUPE_Y), title: 'Look down through the glass floor',
            unavailable: 'The floor below you rotates at its real slow speed.',
            targets: [{ label: 'The view beneath the revolving glass', x: tx, z: tz, y: LOUPE_Y - .04, radius: .18, minDistance: .6, maxDistance: 5, surfaceTolerance: .15, holdSeconds: .75 }],
            onDone: s => done(s, 'lm-needle-loupe', '👀 Through The Loupe', 'You aimed down through the revolving glass and captured the view. The floor turns once every 45 minutes.') }); }
    // ---- eat and drink at the three counters (owner, 2026-11-12). Each order is a short held-item sequence: order, then
    // sips / bites that only advance when their animation has played. The $35-39 ticket is the mapped price (OSM way
    // 12903132, `charge`); the menu prices are the game's own guess, not a sourced menu.
    {
        const TICKET = 37, MENU = {
            cocktail: { lm: 'lm-needle-cocktail', level: LOUPE_Y, c: L.bar, out: 1.2, da: 0, price: 24, title: 'The Loupe Lounge', label: 'Order a cocktail at The Loupe Lounge',
                steps: ['Order an Old Fashioned ($24)', 'Take a sip', 'Another sip', 'Finish the glass'], say: ['The bartender stirs it over one large ice cube…', 'Smoky. The city turns slowly under your feet.', 'Each sip is about six dollars.', 'Gone. So are $24.'],
                toast: ['🍸 $24, view included', 'One cocktail at The Loupe Lounge, 500 ft up.'] },
            coffee: { lm: 'lm-needle-coffee', level: DECK_Y, c: L.cafe, out: 1.0, da: 0.32, price: 14, title: 'Atmos Cafe', label: 'Buy a coffee and a croissant at Atmos Cafe',
                steps: ['Order a latte and a croissant ($14)', 'Sip the latte', 'Bite the croissant', 'Finish both'], say: ['One latte, one croissant, warmed up…', 'Hot. And 520 ft closer to the clouds.', 'Flaky, buttery, $6.50.', 'Crumbs only. That was $14.'],
                toast: ['☕ $14 for coffee and a croissant', 'Atmos Cafe: breakfast with an altitude surcharge.'] },
            wine: { lm: 'lm-needle-wine', level: DECK_Y, c: L.wine, out: 1.25, da: 0, price: 19, title: 'Atmos Wine Bar', label: 'Taste a Washington red at Atmos Wine Bar',
                steps: ['Order a glass of Washington red ($19)', 'Swirl and sip', 'Another sip', 'Finish the glass'], say: ['A Columbia Valley red, poured to the line…', 'Dark fruit, and the Olympics on the horizon.', 'Under four cents per foot of altitude.', 'Empty. $19 well spent?'],
                toast: ['🍷 $19 a glass', 'Atmos Wine Bar: priced by the foot.'] },
        };
        // what you hold: a glass or a cup with its drink, a croissant in the other hand
        const hold = new THREE.Group(); hold.name = 'needle-held-order'; hold.visible = false;
        const HM = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(color), emissiveIntensity: 0.22, ...o });
        const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; m.castShadow = false; return m; };
        const clear = HM('#dcecf0', { transparent: true, opacity: 0.32, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
        const vessel = new THREE.Group(), drink = new THREE.Group(), pastry = new THREE.Group(); hold.add(vessel, pastry); vessel.add(drink);
        const shapes = {
            cocktail: () => { vessel.add(part(new THREE.CylinderGeometry(0.038, 0.034, 0.085, 16, 1, true), clear, 0, 0.043, 0), part(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 16), clear, 0, 0.004, 0)); drink.add(part(new THREE.CylinderGeometry(0.034, 0.031, 0.05, 16), HM('#b9651f'), 0, 0.03, 0), part(new THREE.BoxGeometry(0.03, 0.03, 0.03), HM('#eaf4f6', { transparent: true, opacity: 0.7 }), 0.004, 0.05, 0)); },
            wine: () => { vessel.add(part(new THREE.SphereGeometry(0.04, 16, 10, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), clear, 0, 0.14, 0), part(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), clear, 0, 0.055, 0), part(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 14), clear, 0, 0.008, 0)); drink.position.y = 0.104; drink.add(part(new THREE.SphereGeometry(0.036, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), HM('#5c1220', { side: THREE.DoubleSide }), 0, 0.036, 0), part(new THREE.CircleGeometry(0.0355, 16).rotateX(-Math.PI / 2), HM('#6d1626'), 0, 0.0305, 0)); },
            coffee: () => { vessel.add(part(new THREE.CylinderGeometry(0.04, 0.03, 0.095, 16), HM('#f4f2ec'), 0, 0.048, 0), part(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 16), HM('#2b2b2b'), 0, 0.1, 0)); pastry.add(part(new THREE.TorusGeometry(0.045, 0.022, 8, 14, Math.PI * 1.25), HM('#c98d4b'), 0, 0, 0)); },
        };
        let kind = null, step = 0, anim = 0;
        const dress = (k) => { for (const g of [vessel, drink, pastry]) for (const m of [...g.children]) if (m !== drink) { g.remove(m); m.geometry.dispose(); } kind = k; drink.position.y = 0; shapes[k](); };
        const pose = (s) => {
            const u = anim, lift = Math.sin(Math.min(1, u) * Math.PI), side = s.camera.aspect < 0.75 ? 0.07 : 0.17, eat = kind === 'coffee' && step === 2, sip = step > 0 && !eat;
            // (the walker's camera clips nearer than 0.25 m: the hands stay beyond 0.45 m and the items are drawn a third larger)
            vessel.scale.setScalar(1.35); pastry.scale.setScalar(1.35);
            vessel.position.set(side * 1.35 - (sip ? 0.14 * lift : 0), -0.3 + (sip ? 0.2 * lift : 0), -0.64 + (sip ? 0.17 * lift : 0)); vessel.rotation.set(sip ? 0.8 * lift : 0, 0, kind === 'wine' && step === 1 ? Math.sin(u * 14) * 0.12 * (1 - lift) : 0);
            pastry.position.set(-side * 1.35 + (eat ? 0.14 * lift : 0), -0.25 + (eat ? 0.17 * lift : 0), -0.62 + (eat ? 0.15 * lift : 0)); pastry.rotation.set(1.2, 0.4, 0);
            const n = MENU[kind].steps.length, left = step === 0 ? 1 : kind === 'coffee' ? (step === 1 ? 1 - 0.5 * u : step === 2 ? 0.5 : 0.5 - 0.5 * u) : Math.max(0, 1 - (step - 1 + u) / (n - 1));
            drink.visible = left > 0.02; drink.scale.set(1, Math.max(0.05, left), 1); pastry.visible = kind === 'coffee' && step > 0 && !(step === 3 && u > 0.5); vessel.visible = step > 0;
        };
        const put = () => { hold.visible = false; hold.parent?.remove(hold); };
        const spent = (s) => TICKET + Object.values(MENU).reduce((t, m) => t + (s.progress.activities?.['space-needle:' + m.lm.slice(10)] ? m.price : 0), 0);
        const order = (s, k) => {
            const m = MENU[k];
            flow.begin(s, { title: m.title, action: m.steps[0], focus: m.focus,
                help: `Your visit so far: $${spent(s)} with the ticket. Menu prices are the game's guess; the $35-39 ticket is the mapped one.`,
                started(s) { dress(k); step = 0; anim = 0; s.camera.add(hold); hold.visible = true; pose(s); },
                actioned(s, r) { if (anim > 0) return; anim = 1e-4; r.busy = true; r.status.textContent = m.say[step]; if (step === 0) s.sound?.play?.('coin'); },
                update(dt, s, r) {
                    if (anim > 0) { anim += dt / (step === 0 ? 2.2 : 1.7); if (anim >= 1) { anim = 0; step++; r.busy = false; if (step >= m.steps.length) { flow.complete(); return; } r.button.textContent = m.steps[step]; } }
                    pose(s); r.progress.value = (step + Math.min(1, anim)) / m.steps.length;
                },
                cancel() { put(); },
                complete(s) {
                    put(); done(s, m.lm, m.toast[0], m.toast[1]);
                    if (Object.values(MENU).every((q) => s.progress.activities?.['space-needle:' + q.lm.slice(10)]) && !s.progress.activities['space-needle:bill']) done(s, 'lm-needle-bill', '💸 The view is not free', `Ticket, cocktail, coffee, croissant and wine: about $${spent(s)} for one visit, before tax and tip.`);
                },
            });
        };
        ctx.extras.needleMenu = { order, debug: () => ({ kind, step, anim, held: hold.visible && !!hold.parent }) };
        (ctx.extras.sceneCleanups ||= []).push(() => { put(); hold.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); });
        for (const [k, m] of Object.entries(MENU)) {
            const mid = (m.c.a0 + m.c.a1) / 2 + m.da, [ix, iz] = at(m.c.r1 + m.out, mid), [fx, fz] = at(m.c.r0 - 0.4, mid);
            m.focus = { x: fx, z: fz, y: m.level + 1.35 };
            ctx.interactables.push({ kind: 'activity', x: ix, z: iz, y: m.level, r: 1.9, label: m.label, cond: s => !ride && onLevel(s, m.level), use: s => order(s, k) });
        }
    }
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

// ---------------------------------------------------------------------------- monorail: twin guideways on T-columns + a 4-car train looping through MoPOP
function buildMonorail(ctx) {
    const g = ctx.ground, b = new GeoBatch(), L = polylineLength(MONO);
    // beam top: the station level (STATION_RAIL) up to the platforms' east end, then an even grade to the 5th Ave N corner,
    // where the old rule (MONO_Y above the ground) takes over. The USGS DEM gives the concourse at 42.6 m and 5th Ave at
    // 34.2 m: a near-level beam, not one that follows the ground 7.6 m up through the station.
    const S_A = monoS(2, -87.6), S_B = monoS(124, -30), Y_B = Math.max(g.heightAt(124, -30), -6) + MONO_Y;
    const yAt = (x, z) => { const s = monoS(x, z); if (s <= S_A) return STATION_RAIL; if (s >= S_B) return Math.max(g.heightAt(x, z), -6) + MONO_Y; return STATION_RAIL + (Y_B - STATION_RAIL) * (s - S_A) / (S_B - S_A); };
    const splice = (trk, off) => [...trk, ...offsetPolyline(MONO, off).filter(([x]) => x > 56)];
    const lines = [splice(TRK_N, -2.0), splice(TRK_S, 2.0)];
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
    for (const line of lines) { // west of MoPOP the two beams run apart (round the island platform): one column under each
        const Ll = polylineLength(line);
        for (let s = 4; s < Ll; s += 10.5) { const p = alongPolyline(line, s); if (p.x > 44) break;
            const gy = g.heightAt(p.x, p.z), top = yAt(p.x, p.z) - 1.4; if (top - gy < 0.3) continue;
            b.box(p.x, gy, p.z, 0.9, top - gy, 1.1, '#b9b5ab', 'concrete', Math.atan2(p.tx, p.tz)); ctx.circle(p.x, p.z, 0.6, top); }
    }
    for (let s = 6; s < L; s += 21) { // T-columns between the beams (not inside MoPOP, not west of it: see above)
        const p = alongPolyline(MONO, s); if (p.x <= 44 || (p.x > 44 && p.x < 116 && p.z > -165 && p.z < -56)) continue;
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
    // s = the train's west end; the cars keep their order when it reverses (it used to jump a train length at each end) and it
    // stops alongside the platforms (west end 3 m from the track end) instead of 26 m out, beside the empty concourse
    const SPAN = 3 * 11.6, S0 = 3, S1 = LL - 30 - SPAN;
    let s = 40, dir = 1, wait = 0;
    ctx.onUpdate((dt, session) => {
        if (wait > 0) wait -= dt; else { s += dir * 12 * dt; if (s > S1) { s = S1; dir = -1; wait = 6; } if (s < S0) { s = S0; dir = 1; wait = 12; } }
        cars.forEach((c, i) => { const p = alongPolyline(line, s + i * 11.6), q = alongPolyline(line, s + i * 11.6 + 0.5); c.position.set(p.x, yAt(p.x, p.z) + 1.55, p.z); c.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x); });
        session.spot.ctx.extras.trainPos = (dir > 0 ? cars[3] : cars[0]).position;
    });
    // station (west end). Round 3 (r2-sea-spots-b-2): official panorama 1_C7cgJZv-E44e8HIqd5tg (47.62111,-122.34999, the
    // concourse) looking 330° shows a curved translucent canopy (frosted panels on arched ribs) over the platforms on dark
    // steel columns, a black fascia over the entrance (drawn plain: see below). Extent: the three mapped platforms
    // (w333355314/5/7, x −47…+2) and the concourse (w637649471, x −59…−46) it also covers. Rise, rib spacing and column rows are estimates.
    // Round 3 review: the station outline w161609433 (building=train_station, layer 3) was drawn as a 3-storey windowed block
    // under the canopy. It is the elevated station: the platforms are decks at STATION_DECK on columns (OSM outlines, slab
    // depth and column spacing estimated), white railings on the outer and east edges (the panorama), walkable (floor) with
    // edge walls; the concourse is the ground raised to the deck (it is at grade with the plaza south of it).
    ctx.skipBuildings.add('w161609433');
    { const dk = new GeoBatch(), way = (id) => ctx.data.ways.find((w) => w.id === id)?.pts, DY = STATION_DECK, SLAB = 0.45;
      const rails = [['w333355315', [[1.5, -79.2], [1.7, -77.7], [1.9, -75.5], [0.1, -75.4], [-7.1, -74.7], [-45.8, -70.9]]],
                     ['w333355314', [[0.6, -83.1], [0.5, -84.6], [0.3, -86.2]]],
                     ['w333355317', [[-47.4, -91.9], [0.6, -93.3], [0.7, -91.4], [0.7, -89.6]]]];
      for (const [id, edge] of rails) {
          const poly = way(id); if (!poly) continue; const ring = poly.slice(0, poly.length - 1);
          dk.prism(ring, DY - SLAB, DY, '#b3afa5', 'concrete'); g.addPoly(ring, DY, DY - SLAB, { name: 'monorail-platform-' + id });
          for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], Le = Math.hypot(bx - ax, bz - az);
              for (let t = 1.5; t < Le - 1; t += 7.5) { const x = ax + (bx - ax) * t / Le, z = az + (bz - az) * t / Le, gy = g.heightAt(x, z); if (DY - SLAB - gy < 0.4) continue; dk.cyl(x, gy, z, 0.22, DY - SLAB - gy, '#9d998f', 'concrete', 8); ctx.circle(x, z, 0.3, DY - SLAB - gy); } }
          railing(dk, edge, () => DY, { color: '#e9e9e4', post: 1.8 });
          for (let i = 1; i < edge.length; i++) { const [ax, az] = edge[i - 1], [bx, bz] = edge[i]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: DY - 0.3, y1a: DY + 1.2, y0b: DY - 0.3, y1b: DY + 1.2, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 }); }
      }
      ctx.add(dk.build('monorail-platforms')); }
    { const st = new GeoBatch(), z0 = -94, z1 = -69.5, x0 = -60, x1 = 3, yb = STATION_DECK + 3.0, rise = 2.4, N = 10, ribs = [];
      const arcY = (t) => yb + rise * Math.sin(Math.PI * t), arcZ = (t) => z0 + (z1 - z0) * t;
      const pos = []; for (let i = 0; i < N; i++) { const ta = i / N, tb = (i + 1) / N; pos.push(x0, arcY(ta), arcZ(ta), x1, arcY(ta), arcZ(ta), x1, arcY(tb), arcZ(tb), x0, arcY(ta), arcZ(ta), x1, arcY(tb), arcZ(tb), x0, arcY(tb), arcZ(tb)); }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.computeVertexNormals();
      const cm = new THREE.MeshStandardMaterial({ color: '#eef1ef', roughness: 0.55, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }); cm.name = 'monorail-canopy';
      const canopy = new THREE.Mesh(cg, cm); canopy.name = 'monorail-station-canopy'; canopy.renderOrder = 2; ctx.add(canopy);
      for (let x = x0; x <= x1 + 0.01; x += 5.5) { for (let i = 0; i < N; i++) st.rod([x, arcY(i / N), arcZ(i / N)], [x, arcY((i + 1) / N), arcZ((i + 1) / N)], 0.09, '#2a2d30', 'steel', 6); ribs.push(x); }
      for (let x = x0 + 2; x <= x1; x += 11) for (const z of [z0 + 0.4, z1 - 0.4]) { const gy = g.heightAt(x, z); st.cyl(x, gy, z, 0.22, yb - gy, '#2a2d30', 'steel', 8); ctx.circle(x, z, 0.25, yb - gy); }
      st.box(-50, yb - 0.15, z1 + 0.3, 20, 2.0, 0.4, '#151617', 'paint'); // the black fascia over the concourse entrance (south side, west end)
      ctx.add(st.build('monorail-station'));
      // (no lettering on the fascia: its text was read off the panorama, which is comparison-only; OSM names the station
      // only "Seattle Center" and no other source for the sign's wording was found)
      ctx.extras.monorailStation = { canopy: [x0, z0, x1, z1], ribs: ribs.length, source: 'panorama 1_C7cgJZv-E44e8HIqd5tg @330' }; }
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
        { const cc = d.ways.find((w) => w.id === 'w637649471'); if (cc) g.flatten(cc.pts.slice(0, -1), STATION_DECK, 6); } // the monorail concourse, at the deck level (see STATION_DECK)
        ctx.terrainOpts = { bg: '#8f8b82', bgMask: 'slab', innerPx: 2048, outerPad: 0, skirt: 0 };
        ctx.treeLod = { cap: Infinity, near: 90, max: 700, force: true };
        { const c = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.push([NEEDLE.x + Math.cos(a) * 26, NEEDLE.z + Math.sin(a) * 26]); } ctx.exclude.push(c); } // the Needle's OSM parts → hero model
        { const fw = d.areas.find((a) => a.id === 'w241876412'); if (fw) { const c = centroid(fw.poly); ctx.exclude.push(Array.from({ length: 16 }, (_, i) => [c[0] + Math.cos(i / 16 * Math.PI * 2) * 6.2, c[1] + Math.sin(i / 16 * Math.PI * 2) * 6.2])); } } // no generated tree in the fountain
        const needle = buildNeedle(ctx);
        for (const id of ['w241876407', 'w394260006', 'w394260012']) glassCanopy(ctx, id); // the entrance canopies (all three mapped as glass roofs)
        const chi = buildChihuly(ctx);
        buildMonorail(ctx);
        mopopMetalMaterial(); // literal source solids remain ordinary museum context
        // MoPOP: the outline (way 161587742, 14.2 m, no colour) was drawn as a volume of its own and wrapped the seven coloured lobes
        // (ways 1534908988–94, 18–22 m) in a plain wall up to 14 m; the Sky Church room (way 1092469435) has the same footprint as
        // the maroon lobe. Street View (5th Ave N, 47.62138,-122.34768 looking 240°) shows the coloured metal down to the ground.
        ctx.skipBuildings.add('w161587742'); ctx.skipBuildings.add('w1092469435');
        for (const id of MOPOP_LOBES) ctx.skipBuildings.add(id); // (r3-sea-spots-b-4) the lobes as curved metal masses: seattle-center-mopop.js
        ctx.skipBuildings.add('w394955907'); // the International Fountain's dome (roof:shape=dome): drawn by seattle-center-fountain.js
        ctx.skipBuildings.add(ARENA); // Climate Pledge Arena: its parts + the glass wall and fascia by seattle-center-heroes.js (round 3)
        const arenaP = arenaParts(d); // drawn by seattle-center-heroes.js with the arena (round 3)
        ctx.osmBackdrop({ paint: {}, filter: (b) => !arenaP.has(b.id), style: (b) => MOPOP_PARTS.has(b.id) ? MOPOP_METAL : undefined,
            streetTreeOpts: { spacing: 12, prob: 0.7 }, areaTreeOpts: { conifer: 0.4 } });
        ctx.extras.mopopSkin = mopopSkin(ctx);
        seattleCenterPlanting(ctx, { needle: { x: NEEDLE.x, z: NEEDLE.z, pavR: NL.pavR } }); // live OSM trees, the Armory's woods, the pavilion's beds
        const P = ctx.painter;
        P.circle(NEEDLE.x, NEEDLE.z, 30, '#b4afa6', 'slab'); P.circle(NEEDLE.x, NEEDLE.z, NL.pavR + 0.4, '#8d8a84', 'slab');
        buildFountain(ctx);
        // the International Fountain (OSM w35352476), west of the spot extract: the native ground grows to take it
        const intl = internationalFountain(ctx);
        const heroes = seattleCenterHeroes(ctx);
        // the city around the grounds (seen from the deck: 360°) — real towers, blocks, ground, Elliott Bay + ferries, mountains
        addSourceContext(ctx);
        // frame budget (frame-budget.js): the city as one multi-draw per material, culled per 120 m cell by the frustum and by
        // the skyline of the mapped solid blocks around the walker (nothing is hidden from the deck or the drone)
        { const cityBatch = batchSourceContext(ctx);
          (ctx.extras.finishers ||= []).push(() => { if (!cityBatch) return;
            const cull = horizonCuller({ occluders: solidShells(ctx), items: cityBatch.items });
            const trunks = []; ctx.scene.traverse((o) => { if (o.isInstancedMesh && /^treeTrunks .* far$/.test(o.name)) trunks.push(o); }); const far = distanceHide(trunks, 500);
            ctx.extras.horizonCull = cull.stats; ctx.extras.trunkLod = far.stats; onRenderCamera(ctx.scene, (cam) => { cull.update(cam); far.update(cam); }); }); }
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
        ctx.extras.chihulyFraming = photoHunt(ctx, { x: chi.cx + 3, z: chi.cz, title: 'Frame the Chihuly suspended sculpture',
            unavailable: 'Dale Chihuly’s suspended forms are modelled from public descriptions.',
            targets: [.2, .5, .8].map((t, i) => ({ label: ['North hanging forms', 'Central hanging forms', 'South hanging forms'][i], x: chi.cx - 1, y: chi.y0 + chi.H - 4.6, z: lerp(chi.bb.z0 + 3, chi.bb.z1 - 3, t), radius: .65, surfaceTolerance: 1.2, holdSeconds: .35 })),
            onDone: s => seaActivity(s, 'lm-chihuly-glasshouse', 'space-needle', '🌺 Glasshouse details framed', 'You framed three parts of Dale Chihuly’s suspended sculpture using your own camera view.') });
        // (r2-sea-spots-3) MoPOP had no activity near its arrival, so its guided tour had no stop: a camera challenge from the
        // 5th Ave N arrival frames three of the mapped metal lobes (OSM building:part w1534908994 gold, w1534908992 red,
        // w1534908990 silver) at two thirds of their mapped height; the same shutter-and-look exercise as the Chihuly one
        { const lobes = [['w1534908994', 'The gold lobe'], ['w1534908992', 'The red lobe'], ['w1534908990', 'The silver lobe']].map(([id, label]) => { const b = d.buildings.find((q) => q.id === id); if (!b) return null; const [cx, cz] = centroid(b.poly); return { label, x: cx, z: cz, y: g.heightAt(cx, cz) + (b.h || 18) * 0.66, radius: 2.2, surfaceTolerance: 6, holdSeconds: .35 }; }).filter(Boolean);
            const ms = S.mopop?.spawn; if (lobes.length === 3 && ms) ctx.extras.mopopFraming = photoHunt(ctx, { x: ms.x, z: ms.z, spot: 'mopop', title: 'Frame MoPOP\'s metal lobes',
                unavailable: 'Frank Gehry\'s building is modelled from its OSM parts; the interior is not modelled.', targets: lobes,
                onDone: (s) => seaActivity(s, 'mopop-lobes', 'mopop', '🎸 MoPOP framed', 'You framed the gold, red and silver lobes of Frank Gehry\'s Museum of Pop Culture.') }); }
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
                // people down in the fountain's bowl and on its rim (as on any dry day)
                { x: intl.cx + 9, z: intl.cz + 4, r: 6, n: 6, act: 'watch', look: [intl.cx, intl.cz], personas: ['kid', 'tourist_us', 'local', 'kid'] },
                { x: intl.cx - 14, z: intl.cz - 15, r: 4, n: 4, act: 'photo', look: [intl.cx, intl.cz], personas: ['tourist_jp', 'tourist_us', 'photographer'] },
                ...(heroes.groups || []),
            ],
        };
        // ---- sounds
        ctx.sound('crowd', NEEDLE.x, NEEDLE.z + 25, 70, 1.1); ctx.sound('crowd', chi.cx, chi.cz, 40, 0.6); ctx.sound('traffic', 129, -60, 90, 0.8); ctx.sound('birds', chi.sunC.x, chi.sunC.z, 60, 1); ctx.sound('hum', 60, -86, 50, 0.6);
        ctx.extras.deckY = needle.DECK_Y;
    },
};
