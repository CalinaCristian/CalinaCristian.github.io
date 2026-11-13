// ============================================================================
//  Pike Place Market (1907) — the PUBLIC MARKET CENTER neon sign + clock on its
//  X-braced frame, FARMERS MARKET and MEET THE PRODUCER signs, the arcade with
//  produce / flower / fish stalls, Pike Place Fish (flying fish: catch one!),
//  Rachel the bronze pig (Georgia Gerber, 1986; drop a coin), the Gum Wall in
//  Post Alley (stick your gum), the original Starbucks queue, Victor Steinbrueck
//  Park poles and the view over Elliott Bay to the Great Wheel. Car-free
//  (trial since Apr 2025): no traffic on the brick street.
//  Local frame: x east, z south; origin = research spawn (Pike St at 1st Ave).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, canvas, canvasTexture, inPoly, clamp, smooth, headingFromBearing, offsetPolyline, alongPolyline, polylineLength, distPolyline, lerp, polyBox } from '../kit.js';
import { meshSDF, sdEllipsoid, sdCapsule, sdSphere, smin, smax, noise3 } from '../sdf.js';
import { neonSign, signBoard, latticeFrame, clockFace, canopy, stall, fishMesh, totemPole, railing } from '../props.js';
import { addTraffic } from '../cars.js';
import { buildingStyle, wallGeometry, facadeMaterial, facadeStyle } from '../osm.js';
import { seaActivity, seaWheel, seaBackdrop, signAtlas } from './sea-common.js';
import { coinDrop } from '../coin-drop.js';
import { activityBlocked, onActivityCancel } from '../participation.js';
import {prepareSourceContext,addSourceContext} from '../source-context.js';
import { SURVEY, profile, gradeStreets, gradeWesternEastBank } from './pike-place-streets.js';
import { marketWestMaterial } from './pike-place-westface.js';
import { skyBridge, SKYBRIDGE_ID } from './pike-place-skybridge.js';
import { prepareLower, buildLower, GUM } from './pike-place-lower.js';
import { prepareHalls, buildHalls, HALLS } from './pike-place-market.js';
import { buildShopSigns } from './pike-place-shops.js';
import { prepareFacades, buildFacades, FACADE_IDS } from './pike-place-facades.js';
import { batchSourceContext, horizonCuller, solidShells, onRenderCamera, distanceHide, boxDistanceHide } from '../frame-budget.js';

// ---------------------------------------------------------------------------- street profile (OSM centrelines; levels surveyed: pike-place-streets.js)
const PIKE_PLACE = [[-50, 33], [-60, 25], [-76, 10], [-91, -3], [-95, -6], [-103, -14], [-126, -34], [-141, -48], [-148, -53], [-151, -56], [-172, -75], [-179, -81], [-263, -155], [-270, -161]];
const PIKE_ST = [[18, 3], [0, 8], [-10, 14], [-25, 18], [-50, 33]];
const POST_ALLEY_S = [[-33.5, 73.3], [-25, 87.2], [0, 127.6], [11.1, 145.6]];   // the open alley south of the market (the stretch under it: pike-place-lower.js)
const SIGN = { x: -59.4, z: 47.8 };
const RACHEL_AT = { s: 1.6, off: -5.6 };            // on the arcade floor at the entrance under the sign (free-standing; the fish counter starts 4 m further north)
const RACHEL = (() => { const p = alongPolyline(PIKE_PLACE, RACHEL_AT.s); return { x: p.x - p.tz * RACHEL_AT.off, z: p.z + p.tx * RACHEL_AT.off, yaw: Math.atan2(p.tx, p.tz) + Math.PI * 0.75 }; })();
const STARBUCKS = { x: -203.8, z: -115.6 };
const ppLen = polylineLength(PIKE_PLACE);
// the open market front under the FARMERS MARKET fascia: the first 26 m of Pike Place (the sign corner + the Leland Hotel)
const OPEN_FRONT = [0, 6.5, 13, 19.5, 26].map((s) => { const p = alongPolyline(PIKE_PLACE, s); return [p.x, p.z]; });
const HALL_IDS = new Set([...Object.keys(HALLS), 'w231357660', 'w1271653800']);
const PP = profile(SURVEY.pikePlace), profileY = PP.yAt, ppAt = (x, z) => PP.at(x, z);   // level along Pike Place (−1.2 m at Pike St, −5.3 m at Virginia St)

// ---------------------------------------------------------------------------- Rachel the Piggy Bank (Georgia Gerber, 1986) — bronze, ≈ 168 cm long, 91 cm tall
function buildRachel(ctx) {
    const sdf = (x, y, z) => { // pig-local: snout toward +z
        let d = sdEllipsoid(x, y, z, 0, 0.56, 0, 0.36, 0.33, 0.68);
        d = smin(d, sdEllipsoid(x, y, z, 0, 0.62, 0.62, 0.25, 0.25, 0.26), 0.12); // head
        d = smin(d, sdCapsule(x, y, z, 0, 0.6, 0.78, 0, 0.58, 0.95, 0.12, 0.1), 0.06); // snout
        d = smax(d, -sdSphere(x, y, z, -0.04, 0.6, 0.99, 0.025), 0.01); d = smax(d, -sdSphere(x, y, z, 0.04, 0.6, 0.99, 0.025), 0.01); // nostrils
        for (const s of [-1, 1]) {
            d = smin(d, sdEllipsoid(x, y, z, s * 0.14, 0.86, 0.55, 0.08, 0.11, 0.03), 0.04); // ears
            for (const zz of [-0.42, 0.38]) d = smin(d, sdCapsule(x, y, z, s * 0.18, 0.45, zz, s * 0.19, 0.03, zz + 0.02, 0.075, 0.06), 0.06); // legs
        }
        d = smin(d, sdCapsule(x, y, z, 0, 0.62, -0.66, 0.03, 0.72, -0.76, 0.03), 0.03); // tail
        d = smax(d, -sdCapsule(x, y, z, 0, 0.9, -0.12, 0, 0.9, 0.06, 0.012), 0.005); // coin slot
        return d;
    };
    const geo = meshSDF(sdf, { min: [-0.5, 0, -0.85], max: [0.5, 1.0, 1.1], cell: 0.022, ao: 0.08,
        color: (x, y, z, nx, ny, nz, ao, o) => { o.set('#5b4128'); if (ny > 0.55 || z > 0.85) o.lerp(new THREE.Color('#c9a25d'), 0.75); return o.multiplyScalar(0.7 + 0.3 * ao); } });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.35 })); m.name = 'rachel'; m.castShadow = true;
    const y = ctx.ground.heightAt(RACHEL.x, RACHEL.z);
    m.position.set(RACHEL.x, y, RACHEL.z); m.rotation.y = RACHEL.yaw; // snout out toward the Pike St / Pike Place corner
    ctx.add(m); ctx.box(RACHEL.x, RACHEL.z, 0.3, 0.75, RACHEL.yaw, { prop: true, h: 0.9, y });
    ctx.ground.addBox(RACHEL.x, RACHEL.z, 0.25, 0.6, RACHEL.yaw, y, y + 0.88);
    return m;
}

// ---------------------------------------------------------------------------- the PUBLIC MARKET CENTER sign + clock, FARMERS MARKET, MEET THE PRODUCER
function buildSigns(ctx, roofY) {
    const grp = new THREE.Group(); grp.name = 'market-signs';
    const b = new GeoBatch();
    const yaw = 2.36; // faces up Pike St toward 1st Ave (bearing ≈ 45°)
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const base = { x: SIGN.x, z: SIGN.z, y: roofY };
    // black X-braced frame, three rows of red letters, clock to the right of MARKET
    latticeFrame(b, base.x - fx * 0.3, base.y, base.z - fz * 0.3, 15.5, 9.6, yaw, { cols: 5, r: 0.08 });
    const rows = [['PUBLIC', 7.15, 8.6, -1.2], ['MARKET', 4.25, 10.8, -2.1], ['CENTER', 1.35, 10.8, -2.1]];
    for (const [t, yy, w, du] of rows) {
        const s = neonSign([{ text: t }], w, 2.75, { color: '#d7262b', glow: '#ff2d24', day: 0.3, night: 3.5, font: (q) => `900 ${q}px "Arial Black", "Helvetica Neue", Arial, sans-serif`, stroke: 3 });
        s.position.set(base.x + rx * du + fx * 0.15, base.y + yy + 1.25, base.z + rz * du + fz * 0.15); s.rotation.y = yaw; grp.add(s);
    }
    const clock = clockFace(2.8); clock.position.set(base.x + rx * 4.6 + fx * 0.2, base.y + 5.6 + 1.25, base.z + rz * 4.6 + fz * 0.2); clock.rotation.y = yaw; grp.add(clock);
    const back = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshStandardMaterial({ color: '#1c1d1f', side: THREE.DoubleSide })); back.position.copy(clock.position).addScaledVector(new THREE.Vector3(fx, 0, fz), -0.05); back.rotation.y = yaw; grp.add(back);
    // FARMERS MARKET neon over the arcade entrance just north of the sign (orange-red letters, green border)
    const fm = signBoard('FARMERS MARKET', 12.5, 1.35, { bg: '#1f3a2c', fg: '#ff5a2c', font: (s) => `700 ${s}px "Futura", "Century Gothic", sans-serif`, glow: 0.35, night: 2.6, draw: (x, w, h) => { x.strokeStyle = '#f4efe2'; x.lineWidth = h * 0.045; x.strokeRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14); } }); // Street View: red letters on a dark green band, pale border
    const fmP = alongPolyline(PIKE_PLACE, 13.5), fmY = profileY(13.5) + 4.5;
    fm.position.set(fmP.x - fmP.tz * -4.72 + 0, fmY, fmP.z + fmP.tx * -4.72); fm.rotation.y = Math.atan2(-fmP.tz * 1, fmP.tx * 1) + Math.PI; grp.add(fm);
    fm.rotation.y = Math.atan2(-fmP.tz, fmP.tx); // face east (out of the arcade toward Pike Place)
    // MEET THE PRODUCER — pale letters on a dark board along the roof edge of the Leland Hotel, facing Pike Place (Street View)
    { const nx = 0.66, nz = -0.751, yaw2 = Math.atan2(nx, nz), x = -73.1, z = 28.5, y = ctx.extras.lelandRoof ?? profileY(20) + 13.4;
        const mp = signBoard('MEET THE PRODUCER', 10.2, 1.45, { bg: '#2c3a33', fg: '#eef0e4', bulbs: true, glow: 0.12, night: 1.6, font: (s) => `700 ${s}px Georgia, serif` });
        mp.position.set(x, y + 1.25, z); mp.rotation.y = yaw2; grp.add(mp);
        for (const u of [-4.4, 0, 4.4]) b.box(x + Math.cos(yaw2) * u - nx * 0.12, y, z - Math.sin(yaw2) * u - nz * 0.12, 0.12, 0.6, 0.12, '#222', 'metal'); }
    // PIKE PLACE FISH board over the fish counter (under the arcade at the corner)
    const pf = signBoard('PIKE PLACE FISH', 5.6, 0.85, { bg: '#efe6cc', fg: '#2b2b2b', font: (s) => `700 ${s}px Georgia, "Times New Roman", serif`, glow: 0.05, night: 0.5 });
    const fp = alongPolyline(PIKE_PLACE, 9.6); pf.position.set(fp.x - fp.tz * -3.4, profileY(9.6) + 3.1, fp.z + fp.tx * -3.4); pf.rotation.y = Math.atan2(-fp.tz, fp.tx); grp.add(pf);
    // LA SALLE HOTEL vertical blade on the building south of the sign
    const ls = signBoard('LA SALLE HOTEL', 4.2, 0.7, { bg: '#1d2a2a', fg: '#f3efe2', font: (s) => `700 ${s}px Georgia, serif`, glow: 0.1, night: 1.4 });
    ls.position.set(SIGN.x - 9.5, roofY - 1.2, SIGN.z + 9.0); ls.rotation.set(0, yaw + Math.PI / 2, Math.PI / 2); grp.add(ls);
    grp.add(b.build('sign-frames'));
    ctx.add(grp);
    return grp;
}

// ---------------------------------------------------------------------------- market arcade (west side of Pike Place) — hero façade over the OSM footprints
function buildArcade(ctx, names = []) {
    const g = ctx.ground, b = new GeoBatch(), r = rng(31);
    const front = offsetPolyline(OPEN_FRONT, -4.6); // canopy edge line (west side): the open front at the sign corner (north of it the halls are closed: pike-place-market.js)
    const yS = (x, z) => ppAt(x, z).y;
    const lamps = [];
    canopy(b, front, 4.4, yS, { h: 3.5, every: 6, roof: '#3d5a47', col: '#2f4a3b', side: -1, lamps });
    // stalls under the canopy: fish at the corner, then produce / flowers / crafts
    const L = polylineLength(front); let k = 0;
    const boardItems = [];
    for (let s = 6.2; s < L - 3; s += 3.6) {
        const p = alongPolyline(front, s), nx = p.tz, nz = -p.tx; // pointing west into the arcade (−side)
        const x = p.x - p.tz * -1.8, z = p.z + p.tx * -1.8, yaw = Math.atan2(-nx, -nz);
        const kind = s < 13 ? 'fish' : (k % 4 === 2 ? 'flowers' : 'produce');
        stall(b, x, yS(p.x, p.z), z, yaw, { w: 3.3, kind, seed: k + 3 });
        // the vendor's board hangs from the canopy beam over the stall, facing the street (real OSM vendor names, note 51)
        if (kind !== 'fish') { const nm = names[k] || (kind === 'flowers' ? 'Fresh Flowers' : ['Fresh Produce', 'Local Fruit', 'Washington Apples', 'Farm Vegetables'][k % 4]);
            const pal = [['#1f3d2b', '#f2e9d0'], ['#f2e8cf', '#3a2a1a'], ['#5a1e1e', '#f6efe0'], ['#0b4f6c', '#f5f5f5'], ['#2b2b2b', '#f5e6b0']][k % 5];
            boardItems.push({ text: nm, w: 3.0, h: 0.42, x: x - nx * 0.45, y: yS(p.x, p.z) + 2.75, z: z - nz * 0.45, yaw: Math.atan2(-nx, -nz), bg: pal[0], fg: pal[1], depth: 0.04 });
            b.rod([x - nx * 0.45 - p.tx * 1.2, yS(p.x, p.z) + 2.97, z - nz * 0.45 - p.tz * 1.2], [x - nx * 0.45 - p.tx * 1.2, yS(p.x, p.z) + 3.5, z - nz * 0.45 - p.tz * 1.2], 0.01, '#222', 'metal', 3);
            b.rod([x - nx * 0.45 + p.tx * 1.2, yS(p.x, p.z) + 2.97, z - nz * 0.45 + p.tz * 1.2], [x - nx * 0.45 + p.tx * 1.2, yS(p.x, p.z) + 3.5, z - nz * 0.45 + p.tz * 1.2], 0.01, '#222', 'metal', 3); }
        ctx.box(x, z, 1.7, 0.6, yaw, { prop: true, h: 0.85 });
        k++;
    }
    // hanging lamps under the canopy (warm at night)
    for (const l of lamps) { b.rod([l.x, l.y + 0.6, l.z], [l.x, l.y + 0.15, l.z], 0.012, '#222', 'metal', 4); b.sphere(l.x, l.y, l.z, 0.16, 0.12, 0.16, '#fff2c8', 'glow'); }
    // the arcade building behind: storeys with cream stucco + green trim (Leland Hotel / Main Arcade), market interior dark behind
    ctx.add(b.build('arcade'), signAtlas(boardItems, { name: 'stall-boards' }));
    // a few warm light pools under the canopy (not one per lamp: note 50, blown-out floor)
    ctx.lampPoints.push(...lamps.filter((_, i) => i % 5 === 2).map((l) => ({ x: l.x, z: l.z, y: l.y - 3.1, h: 3.0, noPost: true })));
}

// ---------------------------------------------------------------------------- flying fish
function buildFishThrow(ctx) {
    const fishLine = ctx.data.spots['pike-place'].dialogue.lines.filter((l) => l.p === 'fishmonger');
    const fish = fishMesh(); fish.visible = false; ctx.add(fish);
    const p0 = alongPolyline(PIKE_PLACE, 9.6);
    const yS = profileY(9.6);
    const front = { x: p0.x - p0.tz * -1.2, z: p0.z + p0.tx * -1.2 };    // monger in front of the counter (street side)
    const back = { x: p0.x - p0.tz * -5.6, z: p0.z + p0.tx * -5.6 };     // catcher behind the counter
    let t = -1, from = null, to = null, dur = 1.1, next = 4, toPlayer = false, caught = false, catchWindow = 0;
    const cancelPlayerThrow = () => {
        if (!toPlayer) return;
        t = -1; catchWindow = 0; toPlayer = false; fish.visible = false; next = 5;
    };
    // Pause/conditions stop scene updates. Clear the unfinished player throw
    // before the host freezes the scene, just as the shared activity flows do.
    onActivityCancel(ctx, cancelPlayerThrow);
    const throwFish = (a, bb, toP = false) => { from = a; to = bb; t = 0; dur = toP ? 1.25 : 1.05; fish.visible = true; toPlayer = toP; caught = false; };
    ctx.onUpdate((dt, s, pl) => {
        if (toPlayer && activityBlocked(s)) { cancelPlayerThrow(); return; }
        next -= dt;
        if (t < 0 && next <= 0) {
            next = 5 + Math.random() * 6;
            throwFish({ ...front, y: yS + 1.5 }, { ...back, y: yS + 1.6 });
            const c = s.spot.crowd, m = c?.peds.find((p) => p.persona === 'fishmonger' && Math.hypot(p.x - front.x, p.z - front.z) < 2.5);
            if (m && fishLine.length) { const l = fishLine[Math.floor(Math.random() * fishLine.length)]; s.ui.bubbles.say(c._headRef(m), l.text, '', ''); }
            s.sound.play('calls', 1);
        }
        if (t >= 0) {
            t += dt / dur;
            const k = Math.min(1, t), x = lerp(from.x, to.x, k), z = lerp(from.z, to.z, k), y = lerp(from.y, to.y, k) + Math.sin(Math.PI * k) * 2.4;
            fish.position.set(x, y, z); fish.lookAt(to.x, y + (k < 0.5 ? 0.6 : -0.6), to.z); fish.rotateZ(t * 9);
            if (toPlayer) { catchWindow = k > 0.72 ? 0.45 : 0; if (pl && k > 0.72) { to.x = pl.x; to.z = pl.z; to.y = pl.y + 1.3; } }
            if (t >= 1) {
                if (toPlayer && !caught) { s.ui.toast('🐟 Butterfingers!', 'Press E as the fish arrives to catch it.'); s.sound.play('splat'); }
                fish.visible = false; t = -1;
            }
        }
    });
    ctx.interactables.push({
        kind: 'fish', x: front.x + (front.x - back.x) * 0.5, z: front.z + (front.z - back.z) * 0.5, r: 4.5,
        label: (s) => (t >= 0 && toPlayer ? 'Catch!' : 'Ask the fishmongers to throw you a salmon'),
        use: (s) => {
            if (activityBlocked(s)) return;
            if (t >= 0 && toPlayer) {
                if (catchWindow > 0 && !caught) { caught = true; fish.visible = false; t = -1; s.ui.toast('🐟 Caught it!', 'Flying fish since 1986 — up to 10,000 people watch on a summer day.'); s.sound.play('catch'); s.progress.fish = (s.progress.fish || 0) + 1; seaActivity(s, 'lm-pike-fish', 'pike-place'); }
                return;
            }
            const p = s.ctl.position;
            throwFish({ ...front, y: yS + 1.5 }, { x: p.x, z: p.z, y: p.y + 1.3 }, true);
            s.ui.bubbles.say({ x: front.x, z: front.z, y: yS + 2.2 }, 'One salmon flying to our visitor!', '', 'friendly'); s.sound.play('calls');
        },
    });
    return { front, back };
}

// ---------------------------------------------------------------------------- the original Starbucks (1912 Pike Place, Soames-Dunn Building)
function buildStarbucks(ctx) {
    const grp = new THREE.Group(); grp.name = 'original-starbucks';
    const d = distPolyline(STARBUCKS.x, STARBUCKS.z, PIKE_PLACE), ux = STARBUCKS.x - d.cx, uz = STARBUCKS.z - d.cz, ul = Math.hypot(ux, uz) || 1;
    const fx = -ux / ul, fz = -uz / ul, yaw = Math.atan2(fx, fz);
    // on its building line: where the line from the street to the mapped shop meets the footprint that holds it
    let face = 6.0; { const host = ctx.data.buildings.find((bd) => bd.k !== 'roof' && !bd.part && inPoly(STARBUCKS.x, STARBUCKS.z, bd.poly)), dx = ux / ul, dz = uz / ul;
        if (host) { let best = 1e9; for (let i = 0; i < host.poly.length; i++) { const [ax, az] = host.poly[i], [bx, bz] = host.poly[(i + 1) % host.poly.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - d.cx) * ez - (az - d.cz) * ex) / den, q = ((ax - d.cx) * dz - (az - d.cz) * dx) / den; if (t > 0 && q >= 0 && q <= 1 && t < best) best = t; } if (best < 30) face = best; } }
    const x = d.cx + ux / ul * face, z = d.cz + uz / ul * face, y = ctx.ground.heightAt(x - ux / ul * 1.2, z - uz / ul * 1.2);
    // storefront: dark brown wood frame, big windows, transom; 2-storey building above it is the OSM extrusion
    const b = new GeoBatch(), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    b.box(x, y, z, 6.2, 3.25, 0.3, '#4a2c1e', 'wood', yaw);
    for (const u of [-1.9, 1.9]) b.box(x + rx * u + fx * 0.16, y + 0.6, z + rz * u + fz * 0.16, 1.9, 2.3, 0.05, '#20313a', 'darkglass', yaw);
    b.box(x + fx * 0.16, y, z + fz * 0.16, 1.3, 2.4, 0.06, '#2b1a12', 'wood', yaw);
    grp.add(b.build('starbucks-front'));
    // Street View: a pale band along the canopy's edge over the front with the name in plain dark capitals
    const word = signBoard('S T A R B U C K S', 5.6, 0.6, { bg: '#f1ede2', fg: '#2a2a2a', depth: 0.06, font: (s) => `800 ${s}px "Helvetica Neue", Arial, sans-serif`, glow: 0.05, night: 0.9 });
    word.position.set(x + fx * 2.45, y + 3.42, z + fz * 2.45); word.rotation.y = yaw; grp.add(word);
    ctx.add(grp);
    // queue along the sidewalk (front = door), going south-east down Pike Place
    const t = alongPolyline(PIKE_PLACE, 0); void t;
    const along = [-(PIKE_PLACE[12][0] - PIKE_PLACE[11][0]), -(PIKE_PLACE[12][1] - PIKE_PLACE[11][1])]; const al = Math.hypot(...along);
    const qx = along[0] / al, qz = along[1] / al;
    const line = [[x + fx * 0.9, z + fz * 0.9], [x + fx * 0.9 + qx * 9, z + fz * 0.9 + qz * 9]];
    return { x, z, yaw, line };
}

// ---------------------------------------------------------------------------- Victor Steinbrueck Park
// The bay carve in build() (everything west of x = −315 pushed down to the shore) cut through the park and the block north
// of it: the top of the bluff ends at the park's west wall, a line through (−277, −83) and (−343, −146) — the OSM park
// edge, where the 1 m DEM drops from −6 to −14 … −18. East of that line the ground keeps its own level.
const STEINBRUECK_Y = -5.7;
function benchFoot(x, z) { return 1 - smooth(-4, 0, (x + 277) * 0.692 - (z + 83) * 0.721); }
// The two poles (James Bender, 1984) at their OSM nodes: "Farmer's Pole" n3211770167 (50 ft) and the untitled Haida-style
// pole n3211770169 (no height mapped: the same height is an estimate) — stylised, no reproduced carving
function buildSteinbrueck(ctx) {
    const b = new GeoBatch(), g = ctx.ground;
    for (const [x, z, h, sd] of [[-297.6, -110.4, 15.2, 3], [-320.3, -130.7, 15.2, 8]]) { totemPole(b, x, g.heightAt(x, z), z, h, 0.5, { seed: sd }); ctx.circle(x, z, 0.5, h); }
    ctx.add(b.build('steinbrueck-poles'));
}

// ---------------------------------------------------------------------------- 1st Ave: three-globe lamp posts
// The official panorama at 1st Ave x Pike St (id tT8x8F7kggeRi_KoY1vLng) shows the avenue lit by low posts carrying three
// white globes (one on top, two on a cross arm) at both Pike St corners and up the avenue; the tall cobra heads stand on
// Pike Place itself. The lamp points the street generator put along 1st Ave keep their places and their light and get
// this post instead of the cobra mast (post height and globe size are estimates from that view).
const FIRST_AVE = [[59, 126], [54, 118], [10, 46], [-2, 27], [-10, 14], [-20, -3], [-39, -34], [-48, -48], [-72, -89], [-81, -104], [-104, -141], [-137, -174], [-206, -233]];
function buildGlobeLamps(ctx) {
    const b = new GeoBatch(), H = 4.3, dark = '#1f2a25'; let n = 0;
    for (const p of ctx.lampPoints) {
        if (p.noPost || p.keepOnRoad || ctx.onRoad?.(p.x, p.z, 0.25)) continue; // (points in a carriageway are dropped by the finisher: leave them to it)
        const q = distPolyline(p.x, p.z, FIRST_AVE); if (q.d > 16) continue;
        const y = p.y ?? ctx.ground.heightAt(p.x, p.z), ax = (p.x - q.cx) / (q.d || 1), az = (p.z - q.cz) / (q.d || 1), tx = -az, tz = ax; // cross arm along the kerb
        b.cyl(p.x, y, p.z, 0.17, 0.9, dark, 'metal', 8); b.cyl(p.x, y + 0.9, p.z, 0.075, H - 0.9, dark, 'metal', 8);
        b.rod([p.x - tx * 0.55, y + H - 0.55, p.z - tz * 0.55], [p.x + tx * 0.55, y + H - 0.55, p.z + tz * 0.55], 0.035, dark, 'metal', 5);
        for (const [u, up] of [[-0.55, -0.3], [0.55, -0.3], [0, 0.22]]) b.sphere(p.x + tx * u, y + H + up, p.z + tz * u, 0.21, 0.21, 0.21, '#f4f1e6', 'glow', 8, 6);
        ctx.circle(p.x, p.z, 0.17, H, { y }); p.noPost = true; p.h = H; p.y = y; n++;
    }
    if (n) ctx.add(b.build('first-ave-globe-lamps'));
    ctx.extras.globeLamps = n;
}

// ============================================================================
export default {
    env: { fogFar: 3200 },
    async build(ctx) {
        await prepareSourceContext(ctx,{heroSourceIds:['w12903132']}); // The existing source-named Needle model is already visible across the city.
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('pike-place');
        // ---- ground: Pike Place, Pike St, Post Alley at their real levels; Elliott Bay below the bluff
        gradeStreets(g); gradeWesternEastBank(g, d.buildings.filter((b) => !b.part).map((b) => b.poly)); // every street at its surveyed level (Pike St is nearly flat; the steep cobbles are the ramp into Post Alley)
        g.flatten([[-58.4, 39.9], [-61.3, 41.6], [-54.9, 51.8], [-53.6, 53.8], [-50.3, 51.7], [-44, 47.9], [-46.6, 40.3], [-51, 39.5]], SURVEY.pikeSt[3][2], 2); // the market-level floor under the sign, out to the deck over Post Alley
        g.mod((x,z,h)=>{const t=d.terrain,dx=Math.max(t.x0-x,0,x-(t.x0+(t.nx-1)*t.d)),dz=Math.max(t.z0-z,0,z-(t.z0+(t.nz-1)*t.d)),weight=1-smooth(0,t.d,Math.hypot(dx,dz));
            const local=x < -335 ? Math.min(h,-40) : x < -315 ? Math.min(h,lerp(-31,-40,(-315-x)/20)) : h;return lerp(h,local,weight*benchFoot(x,z));});
        // Victor Steinbrueck Park is a level lid on top of the bluff: USGS 3DEP 1 m DEM (EPQS, 2026-11-12) 30.7–31.5 m NAVD88
        // (−5.3 … −6.1 here) at 24 points over the whole OSM park (way 14026690) and under Market Place Two, and 8–10 m less
        // just beyond its west wall. The 20 m grid smears that edge into a slope; the park takes the surveyed level.
        { const park = d.areas.find((a) => a.id === 'w14026690'); if (park) g.flatten(park.poly, STEINBRUECK_Y, 2.5); }
        ctx.waterLevel=g.waterY=1-d.origin.elev; // Literal coast mask supplies the actual water mesh.
        // ---- paint
        ctx.terrainOpts = { bg: '#6d6a60', bgMask: 'slab', brickAngle: 0.72, innerPx: 2048, outerPad: 0, skirt: 0 };
        ctx.treeLod = { cap: Infinity, near: 90, max: 700, force: true };
        ctx.skipBuildings = new Set(['w231357660', 'w1271653801', 'w1271653800', 'w1275882970', 'w1275882966', SKYBRIDGE_ID]); // (SKYBRIDGE_ID: the Western Ave SkyBridge, pike-place-skybridge.js)
        // + the covered stretch of Post Alley (open alley here) // hero arcade replaces these footprints
        ctx.exclude.push([...offsetPolyline(PIKE_ST, -11), ...offsetPolyline(PIKE_ST, 11).reverse()]); // no street trees on lower Pike St (open view to the sign)
        // … nor on the 1st Ave sidewalk in front of the Corner Market (Pike St to 13 m north): OSM maps no tree there and the
        // panoramas at 1st Ave x Pike St (tT8x8F7kggeRi_KoY1vLng, looking 235° / 265°) show the corner open
        ctx.exclude.push([[-42, -10], [-14, -10], [-8, 14], [-42, 14]]);
        prepareLower(ctx); prepareHalls(ctx); prepareFacades(ctx);
        // (r3-sea-spots-b-5) the Pike Place Market Parking garage (w184870422, building=parking amenity=parking) took the
        // generic shop ground floor (amenity on a tall urban volume), so its long Western Ave wall read as shopfront glazing;
        // panorama iFZRr4o9WP2yFdlbuLUkeQ shows a garage wall there. The parking style stays (building=parking).
        { const gp = ctx.data.buildings.find((b) => b.id === 'w184870422'); if (gp && gp.k === 'parking') delete gp.amenity; }
        ctx.osmBackdrop({ paint: {}, shopStyle: 'bucshop', streetTreeOpts: { spacing: 14, prob: 0.5, kinds: ['primary', 'secondary', 'tertiary'] }, lampOpts: { kinds: ['primary', 'secondary', 'tertiary'] }, style: (b) => (/hotel|apartments/.test(b.k) && (b.h || 0) < 25 ? 'brick' : buildingStyle(b, true)) });
        buildGlobeLamps(ctx);
        { const W = profile(SURVEY.western); skyBridge(ctx, { roadYAt: (x, z) => W.at(x, z).y }); } // the green truss over Western Ave (sea-spots-a-13)
        const P = ctx.painter;
        P.line(PIKE_PLACE, 17, '#a39e93', 'slab'); P.line(PIKE_PLACE, 9.2, '#8c4b39', 'brick');
        P.line(PIKE_ST.slice(1), 10, '#8c4b39', 'brick');
        P.line(POST_ALLEY_S, 5.4, '#6f6a66', 'cobble');
        const lower = buildLower(ctx, { seaActivity });
        // hero arcade replacing the Main Arcade footprints: storeys drop down the bluff to the west (below street level),
        // an open market floor at street level (stalls under the canopy, dark hall behind), cream stucco + green trim above
        {
            const bb = new GeoBatch();
            const mains = d.buildings.filter((b) => b.id === 'w231357660' || b.id === 'w1271653800'); // the sign corner + the Leland Hotel
            for (const m of mains) {
                let top = -1e9; for (const [x, z] of m.poly) top = Math.max(top, ppAt(x, z).y);
                const hotel = m.id === 'w1271653800', hh = hotel ? 13.4 : 5.6, bottom = Math.min(...m.poly.map(([x, z]) => g.base(x, z))) - 2;
                if (hotel) ctx.extras.lelandRoof = top + hh; // (its upper storeys: pike-place-facades.js)
                else bb.prism(m.poly, top + 3.9, top + hh, '#e9dfc6', 'paint', { noTop: true }); // the corner is one storey: the sign stands on its roof
                if (top - 0.15 > bottom) { const low = wallGeometry(m.poly, bottom, top - 0.15, facadeStyle('apartment'), bottom, '#f6f4ee'); // round 3: white walls, red steel sash (pike-place-westface.js)
                 bb.add(low, 'f-apartment', null, low.userData.col); }
                // the market-floor storey is enclosed except on the Pike Place / Pike St fronts (no see-through to the bay, note 49)
                for (let i = 0; i < m.poly.length; i++) { const [ax, az] = m.poly[i], [bx, bz] = m.poly[(i + 1) % m.poly.length], mx = (ax + bx) / 2, mz = (az + bz) / 2;
                    if (Math.hypot(bx - ax, bz - az) < 0.5 || distPolyline(mx, mz, PIKE_PLACE).d < 7 || distPolyline(mx, mz, PIKE_ST).d < 8) continue;
                    bb.quad([ax, top - 0.2, az], [bx, top - 0.2, bz], [bx, top + 3.95, bz], [ax, top + 3.95, az], '#d9cfb6', 'concrete'); const L = Math.hypot(bx - ax, bz - az), ox = (bz - az) / L * 0.08, oz = -(bx - ax) / L * 0.08; bb.quad([bx + ox, top - 0.2, bz + oz], [ax + ox, top - 0.2, az + oz], [ax + ox, top + 3.95, az + oz], [bx + ox, top + 3.95, bz + oz], '#3a332c', 'concrete'); }
                bb.flat(m.poly, top + hh, '#77736c', 'roofs');
                bb.prism(m.poly, top + 3.75, top + 3.9, '#3b3631', 'concrete', { bottom: true, noTop: true }); // ceiling of the market floor
                if (m.id === 'w231357660') ctx.extras.signRoof = top + hh;
            }
            // green cornice / trim band above the canopy along the arcade front
            const trim = offsetPolyline(OPEN_FRONT, -5.0);
            for (let i = 1; i < trim.length; i++) { const [ax, az] = trim[i - 1], [bx, bz] = trim[i], ya = ppAt(ax, az).y, yb = ppAt(bx, bz).y; bb.quad([ax, ya + 3.9, az], [bx, yb + 3.9, bz], [bx, yb + 4.5, bz], [ax, ya + 4.5, az], '#2f5a44', 'paint'); { const L = Math.hypot(bx - ax, bz - az) || 1, ox = (bz - az) / L * 0.06, oz = -(bx - ax) / L * 0.06; bb.quad([bx + ox, yb + 3.9, bz + oz], [ax + ox, ya + 3.9, az + oz], [ax + ox, ya + 4.5, az + oz], [bx + ox, yb + 4.5, bz + oz], '#2f5a44', 'paint'); } }
            ctx.add(bb.build('main-arcade', { matOverrides: { 'f-brick': facadeMaterial('brick'), 'f-apartment': marketWestMaterial() } }));
        }
        buildHalls(ctx, { line: PIKE_PLACE, at: ppAt });
        buildFacades(ctx, { at: ppAt }, { low: HALL_IDS }); // each market building's own front
        buildArcade(ctx);
        // every mapped business at its own frontage; the hero storefronts below carry their own signs
        buildShopSigns(ctx, { skip: (p) => (/starbucks/i.test(p.name) && Math.hypot(p.x - STARBUCKS.x, p.z - STARBUCKS.z) < 12) || /^(Pike Place Fish Market|Market Theater|Ghost Alley Espresso)$/.test(p.name),
            // awnings along Pike Place and Pike St (Street View: green-and-white stripes on the Corner Market and the Sanitary Market)
            awning: (W) => { const mx = (W.ax + W.bx) / 2, mz = (W.az + W.bz) / 2; if (HALL_IDS.has(W.host.id) || (FACADE_IDS.has(W.host.id) && !/^(w206858876|w206858888)$/.test(W.host.id)) || /^(w1190291980|w231360587)$/.test(W.host.id) || Math.min(distPolyline(mx, mz, PIKE_PLACE).d, distPolyline(mx, mz, PIKE_ST).d) > 17) return null;
                return /^(w206858876|w206858888)$/.test(W.host.id) ? 'stripe' : ['#2f5a44', '#7a2e1d', '#1f3a52', '#3b3b3b'][Math.abs(Math.round(mx * 7 + mz * 3)) % 4]; } });
        buildSigns(ctx, ctx.extras.signRoof ?? profileY(0) + 10.8);
        buildRachel(ctx);
        const fish = buildFishThrow(ctx);
        const sb = buildStarbucks(ctx);
        buildSteinbrueck(ctx);
        // Elliott Bay view: the Great Wheel at Pier 57 (≈ 370 m south of MarketFront)
        { const w = ctx.ll(47.60617, -122.3425), wh = seaWheel(w.x, -33.5, w.z, -0.35, { spin: true }); ctx.add(wh.group); ctx.onUpdate((dt, s) => wh.update(dt, s.nightK, s.t)); }
        // the city + bay context: downtown towers beyond the OSM extract, ferries on the Bainbridge run, port cranes, the Olympics
        addSourceContext(ctx);
        const cityBatch = batchSourceContext(ctx); // one multi-draw per material, culled per 120 m cell (frame-budget.js)
        // … and not submitted at all while a cell is wholly behind the nearer blocks' skyline (in the market's streets most of
        // the city is): recomputed from the rendering camera, so the camera, the drone and captures get their own answer
        (ctx.extras.finishers ||= []).push(() => { if (!cityBatch) return;
            const cull = horizonCuller({ occluders: solidShells(ctx), items: [...cityBatch.items, ...(ctx.extras.facadeItems || [])] });
            // far-LOD trunks of the mapped city trees: under a pixel wide beyond 500 m, their crowns stay
            const trunks = []; ctx.scene.traverse((o) => { if (o.isInstancedMesh && /^treeTrunks .* far$/.test(o.name)) trunks.push(o); }); const far = distanceHide(trunks, 500);
            // round 3 (r2-sea-spots-b-5): the market's flower baskets and planters (market halls, facades, arcade: 98 k
            // triangles of sub-metre pieces) are not submitted while the camera is more than 70 m from every one of them —
            // the drone; at street level they are always drawn
            const plants = []; ctx.scene.traverse((o) => { if ((o.isMesh || o.isBatchedMesh) && /^(market-halls|market-facades|arcade):plant$/.test(o.name)) plants.push(o); }); const flora = boxDistanceHide(plants, 70);
            ctx.extras.horizonCull = cull.stats; ctx.extras.trunkLod = far.stats; ctx.extras.plantLod = flora.stats; onRenderCamera(ctx.scene, (cam) => { cull.update(cam); far.update(cam); flora.update(cam); }); });
        ctx.extras.seaBackdrop = seaBackdrop(ctx, { clear: 330, needle: true, towers: false, bay: false, eyeY: 1.6 });
        // MarketFront viewpoint railing
        { const b = new GeoBatch(); railing(b, [[-268, -98], [-262, -72], [-250, -50], [-238, -36]], (x, z) => g.heightAt(x, z)); ctx.add(b.build('marketfront-rail')); }
        // 1st Ave traffic (Pike Place itself is car-free)
        const firstAve = FIRST_AVE;
        addTraffic(ctx, { lanes: [{ pts: offsetPolyline(firstAve, 3.2), n: 4, speed: 8.5 }, { pts: offsetPolyline([...firstAve].reverse(), 3.2), n: 4, speed: 8.5 }] });
        // ---- plaques (6) — Rachel credited to Georgia Gerber
        const PL = sp.plaques;
        const nearPP = (s, side, extra = 0) => { const p = alongPolyline(PIKE_PLACE, s); return [p.x - p.tz * side * (6.6 + extra), p.z + p.tx * side * (6.6 + extra), Math.atan2(p.tz * side, -p.tx * side)]; };
        ctx.plaque(PL[0], ...[-24, 22.5, -2.3]);
        ctx.plaque(PL[1], -45.5, 33.0, -2.1);
        ctx.plaque(PL[2], RACHEL.x + 1.6, RACHEL.z - 1.3, -2.2, { credit: 'Rachel © 1986 Georgia Gerber — bronze, modelled in 3-D from public descriptions.' });
        ctx.plaque(PL[3], ...nearPP(14, 1, 0.5));
        ctx.plaque(PL[4], GUM.x + 1.7, GUM.z - 3.4, -1.0, { y: lower.floorY(GUM.x + 1.7, GUM.z - 3.4) });
        ctx.plaque(PL[5], sb.x + Math.cos(sb.yaw) * 4.5 + Math.sin(sb.yaw) * 1.2, sb.z - Math.sin(sb.yaw) * 4.5 + Math.cos(sb.yaw) * 1.2, sb.yaw);
        // ---- Rachel coin
        const rachelCoin = coinDrop(ctx, new THREE.Vector3(RACHEL.x, ctx.ground.heightAt(RACHEL.x, RACHEL.z) + .91, RACHEL.z), { title: 'Rachel the Piggy Bank', onDone(s) { seaActivity(s, 'lm-pike-rachel', 'pike-place'); s.progress.coins = (s.progress.coins || 0) + 1; s.ui.toast('🪙 Clink', `Coin #${s.progress.coins} — Rachel's donations fund the Market's social services.`); } });
        ctx.extras.rachelCoin = rachelCoin;
        ctx.interactables.push({ kind: 'coin', x: RACHEL.x + 0.6, z: RACHEL.z - 0.4, r: 1.8, label: 'Drop a coin in Rachel', use: s => rachelCoin.start(s) });
        // ---- postcard challenge (blue hour best: the neon glows)
        (() => { const ic = ctx.spot('pike-place').photo.iconic, a = (ic.heading_deg ?? 229) * Math.PI / 180; return ctx.challenge('pike-place', { x: ic.x + Math.sin(a) * 26, z: ic.z - Math.cos(a) * 26, pitch: 12, r: 12, tol: 30 }); })() // 26 m down Pike St: the sign + clock fill the frame;
        // ---- crowd (dense): fish-throw audience, mongers, Starbucks queue, gum-wall selfies, buskers, vendors, walkers
        const pp = (s, off) => { const p = alongPolyline(PIKE_PLACE, s); return [p.x - p.tz * off, p.z + p.tx * off]; };
        const vendors = []; for (let s = 15; s < 25; s += 4.5) { const [x, z] = pp(s, -7.05); vendors.push({ x, z, r: 0.2, n: 1, act: 'watch', look: pp(s, 0), personas: ['vendor'] }); }
        const [fwx, fwz] = pp(6, 3.0), [bx1, bz1] = pp(110, 4.5), [bx2, bz2] = pp(240, 4.6);
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 3, tech: 1.5, tourist_cn: 2, tourist_kr: 1.2, tourist_jp: 1.2, tourist_de: 1, tourist_es: 1.2, tourist_ca: 1.5, tourist_in: 1.2, kid: 1.2, photographer: 0.6 },
            walkers: 46,
            paths: [PIKE_PLACE, offsetPolyline(PIKE_PLACE, 3.2), offsetPolyline(PIKE_PLACE, -2.6), PIKE_ST, lower.rampLine, [lower.rampLine[2], ...lower.alleyLine, ...POST_ALLEY_S], offsetPolyline(firstAve, 9.2), offsetPolyline(firstAve, -9.2), [[-140, -58], [-122, -69], [-93, -87]], [[-172, -75], [-144, -108], [-120, -136]]],
            groups: [
                { x: fish.front.x, z: fish.front.z, r: 0.3, n: 1, act: 'throw', look: [fish.back.x, fish.back.z], personas: ['fishmonger'] },
                { x: fish.back.x, z: fish.back.z, r: 0.4, n: 2, act: 'watch', look: [fish.front.x, fish.front.z], personas: ['fishmonger'] },
                { x: fwx, z: fwz, r: 3.2, n: 14, act: 'watch', look: [fish.back.x, fish.back.z], personas: ['tourist_us', 'tourist_cn', 'tourist_jp', 'tourist_kr', 'tourist_de', 'tourist_es', 'tourist_in', 'kid', 'local'] },
                { x: fwx - 1.5, z: fwz + 2.5, r: 1.2, n: 3, act: 'photo', look: [fish.back.x, fish.back.z], personas: ['tourist_us', 'tourist_cn', 'photographer'] },
                { x: RACHEL.x + 2.4, z: RACHEL.z + 1.6, r: 1.2, n: 3, act: 'photo', look: [RACHEL.x, RACHEL.z], personas: ['tourist_us', 'tourist_in', 'tourist_es'] },
                { x: RACHEL.x + 0.6, z: RACHEL.z + 0.9, r: 0.3, n: 1, act: 'pose', look: [RACHEL.x + 4, RACHEL.z + 3], personas: ['kid'] },
                { x: GUM.x - 0.4, z: GUM.z - 1.5, r: 1.6, n: 6, act: 'photo', look: [GUM.x + 2.6, GUM.z - 1.2], y: lower.floorY, personas: ['tourist_us', 'tourist_kr', 'tourist_cn', 'tourist_ca', 'kid'] },
                { x: GUM.x + 1.5, z: GUM.z + 4, r: 0.7, n: 2, act: 'pose', look: [GUM.x - 1.5, GUM.z + 3], y: lower.floorY, personas: ['tourist_us', 'tourist_es'] },
                { line: sb.line, n: 11, act: 'queue', personas: ['tourist_us', 'tourist_cn', 'tourist_jp', 'tourist_kr', 'tourist_in', 'tourist_ca', 'tech'], spacing: 0.85 },
                { x: bx2, z: bz2, r: 0.2, n: 1, act: 'perform', look: pp(240, -2), personas: ['busker'], prop: 'guitar' },
                { x: bx1, z: bz1, r: 0.2, n: 1, act: 'perform', look: pp(110, -2), personas: ['busker'], prop: 'guitar' },
                { x: -24, z: 21, r: 1.5, n: 4, act: 'watch', look: [SIGN.x, SIGN.z], personas: ['tourist_us', 'tourist_cn', 'tourist_de'] },
                { x: -30, z: 24, r: 0.3, n: 1, act: 'guide', look: [-24, 21], personas: ['guide'], prop: 'flag' },
                { x: -240, z: -50, r: 4, n: 6, act: 'watch', look: [-400, 0], personas: ['tourist_us', 'local', 'tourist_jp', 'tourist_es'] },
                ...vendors,
            ],
        };
        // ---- sounds: crowd murmur, fish calls, gulls over the bay, 1st Ave traffic
        ctx.sound('crowd', -60, 30, 60, 1.2); ctx.sound('crowd', -150, -60, 70, 1); ctx.sound('calls', fish.front.x, fish.front.z, 40, 1);
        ctx.sound('gulls', -240, -40, 160, 1); ctx.sound('traffic', -10, 10, 50, 0.6); ctx.sound('bell', -150, -60, 200, 0.5);
        // top of Pike St, the sign straight ahead — 9 m down from the 1st Avenue centreline (L34: the old spawn stood in the
        // 1st Ave carriageway, a car brushing past the player)
        ctx.spawns['pike-place'] = { x: -17.3, z: 18.0, heading: headingFromBearing(240) };
        ctx.minY = -60;
    },
};
