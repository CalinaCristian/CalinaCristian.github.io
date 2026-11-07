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
import { neonSign, signBoard, latticeFrame, clockFace, canopy, stall, fishMesh, greatWheel, totemPole, railing } from '../props.js';
import { addTraffic } from '../cars.js';
import { buildingStyle, wallGeometry, facadeMaterial, facadeStyle } from '../osm.js';

// ---------------------------------------------------------------------------- street profile (OSM centrelines, research elevations)
const PIKE_PLACE = [[-50, 33], [-60, 25], [-76, 10], [-91, -3], [-95, -6], [-103, -14], [-126, -34], [-141, -48], [-148, -53], [-151, -56], [-172, -75], [-179, -81], [-263, -155], [-270, -161]];
const PP_Y = [[0, -6.4], [60, -6.2], [125, -5.2], [185, -4.3], [300, -1.8]];  // height along Pike Place (m from its south end)
const PIKE_ST = [[18, 3], [0, 8], [-10, 14], [-25, 18], [-50, 33]];
const POST_ALLEY_S = [[-50, 40], [-47, 44], [-49, 48], [-36, 69], [-28, 82], [0, 128]];
const SIGN = { x: -59.4, z: 47.8 };
const RACHEL = { x: -55.2, z: 37.4 };
const GUM = { x: -38.3, z: 61.2 };
const STARBUCKS = { x: -203.8, z: -115.6 };
const ppLen = polylineLength(PIKE_PLACE);
function profileY(s) { for (let i = 1; i < PP_Y.length; i++) if (s <= PP_Y[i][0]) return lerp(PP_Y[i - 1][1], PP_Y[i][1], (s - PP_Y[i - 1][0]) / (PP_Y[i][0] - PP_Y[i - 1][0])); return PP_Y[PP_Y.length - 1][1]; }
function ppAt(x, z) { const r = distPolyline(x, z, PIKE_PLACE); let s = 0; for (let i = 0; i < r.i; i++) s += Math.hypot(PIKE_PLACE[i + 1][0] - PIKE_PLACE[i][0], PIKE_PLACE[i + 1][1] - PIKE_PLACE[i][1]); s += r.t * Math.hypot(PIKE_PLACE[r.i + 1][0] - PIKE_PLACE[r.i][0], PIKE_PLACE[r.i + 1][1] - PIKE_PLACE[r.i][1]); return { s, d: r.d, y: profileY(s) }; }

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
    m.position.set(RACHEL.x, y, RACHEL.z); m.rotation.y = 0.9; // snout toward Pike St
    ctx.add(m); ctx.box(RACHEL.x, RACHEL.z, 0.3, 0.75, 0.9, { prop: true, h: 0.9, y });
    ctx.ground.addBox(RACHEL.x, RACHEL.z, 0.25, 0.6, 0.9, y, y + 0.88);
    return m;
}

// ---------------------------------------------------------------------------- the Gum Wall (Post Alley, Market Theater)
function gumTexture(seed, w, h, dense = 2.4 / 4.6) {
    // written straight into ImageData (hundreds of thousands of canvas paths would stall the GPU process)
    const ppm = 110, cw = Math.min(2048, Math.round(w * ppm)), ch = Math.min(640, Math.round(h * ppm)), c = canvas(cw, ch), x = c.getContext('2d'), r = rng(seed);
    const img = x.createImageData(cw, ch), D = img.data;
    const bw = Math.round(0.2 * ppm), bh = Math.max(3, Math.round(0.067 * ppm));
    for (let yy = 0; yy < ch; yy++) {
        const row = Math.floor(yy / bh), my = yy % bh === 0;
        for (let xx = 0; xx < cw; xx++) {
            const o = (yy * cw + xx) * 4, bx = xx + (row % 2) * (bw >> 1), mortar = my || bx % bw === 0;
            const id = Math.floor(bx / bw) * 7919 + row * 104729, t = ((id * 2654435761) >>> 0) / 4294967296;
            const k = mortar ? 0.55 : 0.85 + 0.3 * t;
            D[o] = 128 * k; D[o + 1] = 66 * k; D[o + 2] = 50 * k; D[o + 3] = 255;
        }
    }
    const cols = ['#f06292', '#ec407a', '#f8bbd0', '#ffffff', '#81d4fa', '#4fc3f7', '#aed581', '#fff176', '#ffb74d', '#ba68c8', '#e57373', '#90a4ae', '#f48fb1', '#80cbc4', '#ffcc80', '#ce93d8', '#ef5350'].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const n = Math.round(w * h * 1500);
    for (let i = 0; i < n; i++) {
        const v = Math.pow(r(), 0.85), k = v < dense ? 1 : Math.max(0, 1 - (v - dense) / (1 - dense)) ** 3 * 0.6;
        if (r() > k) continue;
        const cx = Math.floor(r() * cw), cy = Math.floor(ch - v * ch), rad = 1 + Math.floor(r() * 2.2), col = cols[Math.floor(r() * cols.length)], sh = 0.62 + r() * 0.3;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad - 1; dx <= rad + 1; dx++) {
            if ((dx * dx) / ((rad + 1) * (rad + 1)) + (dy * dy) / (rad * rad) > 1) continue;
            const px = cx + dx, py = cy + dy; if (px < 0 || py < 0 || px >= cw || py >= ch) continue;
            const o = (py * cw + px) * 4, lit = dy < 0 ? 1.08 : 0.92;
            D[o] = Math.min(255, col[0] * sh * lit); D[o + 1] = Math.min(255, col[1] * sh * lit); D[o + 2] = Math.min(255, col[2] * sh * lit);
        }
    }
    x.putImageData(img, 0, 0);
    return canvasTexture(c);
}
function buildGumWall(ctx) {
    const g = ctx.ground, grp = new THREE.Group(); grp.name = 'gum-wall';
    // the alley segment past the Market Theater: (-49,48) → (-36,69); walls 2.4 m either side of the centreline
    const a = [-49, 48], b = [-36.5, 68.2], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux;
    const walls = [];
    for (const side of [-1, 1]) {
        const off = 2.35 * side, cx = (a[0] + b[0]) / 2 + nx * off, cz = (a[1] + b[1]) / 2 + nz * off, y0 = g.heightAt(cx, cz) - 0.2, H = 5.2;
        const tex = gumTexture(7 + side, L, H, 2.6 / H);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.0 }));
        m.position.set(cx, y0 + H / 2, cz); m.rotation.y = Math.atan2(-nx * -side, -nz * -side); m.name = 'gum-wall-face';
        // face toward the alley centre
        const fx = -nx * side, fz = -nz * side; m.rotation.y = Math.atan2(fx, fz);
        grp.add(m); walls.push(m);
        const back = new THREE.Mesh(new THREE.BoxGeometry(L, H + 2.5, 0.5), new THREE.MeshStandardMaterial({ color: '#6a4535', roughness: 0.9 }));
        back.position.set(cx - fx * 0.26, y0 + (H + 2.5) / 2, cz - fz * 0.26); back.rotation.y = m.rotation.y; grp.add(back);
        ctx.collider({ wall: true, ax: a[0] + nx * off, az: a[1] + nz * off, bx: b[0] + nx * off, bz: b[1] + nz * off, y0a: y0 - 2, y1a: y0 + 8, y0b: y0 - 2, y1b: y0 + 8, nx: fx, nz: fz });
    }
    // MARKET THEATER neon over the theatre door on the west wall
    const th = neonSign([{ text: 'MARKET THEATER' }], 3.6, 0.55, { color: '#d81f26', glow: '#ff2a2a', day: 0.35, night: 3 });
    const tx = (a[0] + b[0]) / 2 + nx * -2.2 - ux * 3, tz = (a[1] + b[1]) / 2 + nz * -2.2 - uz * 3;
    th.position.set(tx, g.heightAt(tx, tz) + 3.1, tz); th.rotation.y = Math.atan2(nx, nz); grp.add(th);
    // the covered stretch near Pike St (dark timber roof overhead, as in the photos)
    { const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 9), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 })); const cx = a[0] + ux * 4.5, cz = a[1] + uz * 4.5; roof.position.set(cx, g.heightAt(cx, cz) + 5.6, cz); roof.rotation.y = Math.atan2(ux, uz); roof.castShadow = true; grp.add(roof); }
    for (const t of [0.25, 0.6, 0.9]) { const lx = a[0] + ux * L * t, lz = a[1] + uz * L * t; ctx.lampPoints.push({ x: lx, z: lz, h: 4.2, noPost: true }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false })); bulb.position.set(lx, g.heightAt(lx, lz) + 4.4, lz); grp.add(bulb); }
    ctx.add(grp);
    // player gum: instanced blobs stuck where you aim
    const blobs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 300);
    blobs.count = 0; blobs.frustumCulled = false; blobs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3); ctx.add(blobs);
    const ray = new THREE.Raycaster(), cols = ['#ff4f9a', '#4fc3f7', '#aed581', '#fff176', '#ffffff', '#ba68c8'], m4 = new THREE.Matrix4(), col = new THREE.Color();
    let stuck = 0;
    ctx.interactables.push({
        kind: 'gum', aim: true, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, r: 11, label: 'Stick your gum on the wall',
        use: (s) => {
            ray.setFromCamera(new THREE.Vector2(0, 0), s.camera); ray.far = 3.5;
            const hit = ray.intersectObjects(walls, false)[0];
            if (!hit) { s.ui.toast('🫧 Get closer', 'Walk up to the wall and aim at it.'); return; }
            const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            m4.compose(hit.point.clone().addScaledVector(n, 0.015), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1 + Math.random() * 0.6, 0.8 + Math.random() * 0.5, 0.45));
            blobs.setMatrixAt(blobs.count, m4); blobs.setColorAt(blobs.count, col.set(cols[stuck % cols.length])); blobs.count = Math.min(299, blobs.count + 1);
            blobs.instanceMatrix.needsUpdate = true; blobs.instanceColor.needsUpdate = true; stuck++;
            s.sound.play('splat'); s.progress.gum = (s.progress.gum || 0) + 1;
            if (stuck === 1) s.ui.toast('🫧 Stuck!', 'Your gum joins about 180 pieces per brick.');
            if (stuck === 5) s.ui.toast('💗 Five pieces', 'Now you are part of the Gum Wall.');
            const near = s.spot.crowd?.peds.find((p) => Math.hypot(p.x - hit.point.x, p.z - hit.point.z) < 6); if (near) s.spot.crowd._say(near, 'spot', { force: false });
        },
    });
    return walls;
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
    const fm = signBoard('FARMERS MARKET', 11.5, 1.5, { bg: '#2b1c18', fg: '#ff5a2c', font: (s) => `700 ${s}px "Futura", "Century Gothic", sans-serif`, glow: 0.35, night: 2.6, draw: (x, w, h) => { x.strokeStyle = '#3fdc6b'; x.lineWidth = h * 0.05; x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); } });
    const fmP = alongPolyline(PIKE_PLACE, 12), fmY = profileY(12) + 4.6;
    fm.position.set(fmP.x - fmP.tz * -5.2 + 0, fmY, fmP.z + fmP.tx * -5.2); fm.rotation.y = Math.atan2(-fmP.tz * 1, fmP.tx * 1) + Math.PI; grp.add(fm);
    fm.rotation.y = Math.atan2(-fmP.tz, fmP.tx); // face east (out of the arcade toward Pike Place)
    // MEET THE PRODUCER — teal billboard with bulbs on the roof across Pike Place (north-east side of the junction)
    const mp = signBoard('MEET THE PRODUCER', 13, 1.7, { bg: '#2e7f78', fg: '#eef4ee', bulbs: true, glow: 0.12, night: 1.6, font: (s) => `700 ${s}px Georgia, serif` });
    const mpP = alongPolyline(PIKE_PLACE, 26); mp.position.set(mpP.x - mpP.tz * -6.5, profileY(26) + 13.4, mpP.z + mpP.tx * -6.5); mp.rotation.y = Math.atan2(-mpP.tz, mpP.tx); grp.add(mp);
    { const [x, z] = [mp.position.x, mp.position.z]; b.box(x - Math.cos(mp.rotation.y) * 5, profileY(26) + 11.0, z + Math.sin(mp.rotation.y) * 5, 0.15, 1.6, 0.15, '#222', 'metal'); b.box(x + Math.cos(mp.rotation.y) * 5, profileY(26) + 11.0, z - Math.sin(mp.rotation.y) * 5, 0.15, 1.6, 0.15, '#222', 'metal'); }
    // PIKE PLACE FISH board over the fish counter (under the arcade at the corner)
    const pf = signBoard('PIKE PLACE FISH', 5.6, 0.85, { bg: '#efe6cc', fg: '#2b2b2b', font: (s) => `700 ${s}px Georgia, "Times New Roman", serif`, glow: 0.05, night: 0.5 });
    const fp = alongPolyline(PIKE_PLACE, 4.5); pf.position.set(fp.x - fp.tz * -3.4, profileY(4.5) + 3.1, fp.z + fp.tx * -3.4); pf.rotation.y = Math.atan2(-fp.tz, fp.tx); grp.add(pf);
    // LA SALLE HOTEL vertical blade on the building south of the sign
    const ls = signBoard('LA SALLE HOTEL', 4.2, 0.7, { bg: '#1d2a2a', fg: '#f3efe2', font: (s) => `700 ${s}px Georgia, serif`, glow: 0.1, night: 1.4 });
    ls.position.set(SIGN.x - 9.5, roofY - 1.2, SIGN.z + 9.0); ls.rotation.set(0, yaw + Math.PI / 2, Math.PI / 2); grp.add(ls);
    grp.add(b.build('sign-frames'));
    ctx.add(grp);
    return grp;
}

// ---------------------------------------------------------------------------- market arcade (west side of Pike Place) — hero façade over the OSM footprints
function buildArcade(ctx) {
    const g = ctx.ground, b = new GeoBatch(), r = rng(31);
    const front = offsetPolyline(PIKE_PLACE.slice(0, 9), -4.6); // canopy edge line (west side), from the sign corner to Pine St
    const yS = (x, z) => ppAt(x, z).y;
    const lamps = [];
    canopy(b, front, 4.4, yS, { h: 3.5, every: 6, roof: '#3d5a47', col: '#2f4a3b', side: -1, lamps });
    // stalls under the canopy: fish at the corner, then produce / flowers / crafts
    const L = polylineLength(front); let k = 0;
    for (let s = 3; s < L - 3; s += 3.6) {
        const p = alongPolyline(front, s), nx = p.tz, nz = -p.tx; // pointing west into the arcade (−side)
        const x = p.x - p.tz * -1.8, z = p.z + p.tx * -1.8, yaw = Math.atan2(-nx, -nz);
        stall(b, x, yS(p.x, p.z), z, yaw, { w: 3.3, kind: s < 9 ? 'fish' : (k % 4 === 2 ? 'flowers' : 'produce'), seed: k + 3 });
        ctx.box(x, z, 1.7, 0.6, yaw, { prop: true, h: 0.85 });
        k++;
    }
    // hanging lamps under the canopy (warm at night)
    for (const l of lamps) { b.rod([l.x, l.y + 0.6, l.z], [l.x, l.y + 0.15, l.z], 0.012, '#222', 'metal', 4); b.sphere(l.x, l.y, l.z, 0.16, 0.12, 0.16, '#fff2c8', 'glow'); }
    // the arcade building behind: storeys with cream stucco + green trim (Leland Hotel / Main Arcade), market interior dark behind
    ctx.add(b.build('arcade'));
    ctx.lampPoints.push(...lamps.filter((_, i) => i % 2 === 0).map((l) => ({ x: l.x, z: l.z, y: l.y - 3.1, h: 3.0, noPost: true })));
}

// ---------------------------------------------------------------------------- flying fish
function buildFishThrow(ctx) {
    const fishLine = ctx.data.spots['pike-place'].dialogue.lines.filter((l) => l.p === 'fishmonger');
    const fish = fishMesh(); fish.visible = false; ctx.add(fish);
    const p0 = alongPolyline(PIKE_PLACE, 5.5);
    const yS = profileY(5.5);
    const front = { x: p0.x - p0.tz * -1.2, z: p0.z + p0.tx * -1.2 };    // monger in front of the counter (street side)
    const back = { x: p0.x - p0.tz * -5.6, z: p0.z + p0.tx * -5.6 };     // catcher behind the counter
    let t = -1, from = null, to = null, dur = 1.1, next = 4, toPlayer = false, caught = false, catchWindow = 0;
    const throwFish = (a, bb, toP = false) => { from = a; to = bb; t = 0; dur = toP ? 1.25 : 1.05; fish.visible = true; toPlayer = toP; caught = false; };
    ctx.onUpdate((dt, s, pl) => {
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
            if (t >= 0 && toPlayer) {
                if (catchWindow > 0 && !caught) { caught = true; fish.visible = false; t = -1; s.ui.toast('🐟 Caught it!', 'Flying fish since 1986 — up to 10,000 people watch on a summer day.'); s.sound.play('catch'); s.progress.fish = (s.progress.fish || 0) + 1; }
                return;
            }
            const p = s.ctl.position;
            throwFish({ ...front, y: yS + 1.5 }, { x: p.x, z: p.z, y: p.y + 1.3 }, true);
            s.ui.bubbles.say({ x: front.x, z: front.z, y: yS + 2.2 }, 'One salmon flying to our visitor!', '', 'friendly'); s.sound.play('calls');
        },
    });
    return { front, back };
}

// ---------------------------------------------------------------------------- storefront signs from OSM POIs along Pike Place / Post Alley / Pike St
function buildStorefronts(ctx) {
    const grp = new THREE.Group(); grp.name = 'storefronts';
    const seen = new Set(); let n = 0;
    const lines = [[PIKE_PLACE, 'pp'], [PIKE_ST, 'ps']];
    for (const p of ctx.data.pois) {
        if (!p.name || (p.level && !/^0/.test(String(p.level))) || p['addr:floor'] || !(p.shop || p.amenity === 'cafe' || p.amenity === 'restaurant' || p.amenity === 'fast_food' || p.amenity === 'bar' || p.craft)) continue;
        let best = null; for (const [L] of lines) { const d = distPolyline(p.x, p.z, L); if (!best || d.d < best.d) best = { ...d, L }; }
        if (!best || best.d > 14 || best.d < 3 || seen.has(p.name)) continue;
        seen.add(p.name);
        const ux = p.x - best.cx, uz = p.z - best.cz, ul = Math.hypot(ux, uz), fx = -ux / ul, fz = -uz / ul; // face the street
        const x = best.cx + ux / ul * Math.min(best.d, 6.2), z = best.cz + uz / ul * Math.min(best.d, 6.2), y = ctx.ground.heightAt(x, z);
        const isStar = /starbucks/i.test(p.name) && Math.hypot(p.x - STARBUCKS.x, p.z - STARBUCKS.z) < 12;
        if (isStar) continue; // the original store is a hero below
        const pal = [['#1f3d2b', '#f2e9d0'], ['#5a1e1e', '#f6efe0'], ['#14213d', '#fca311'], ['#2b2b2b', '#f5f5f5'], ['#f2e8cf', '#3a2a1a'], ['#0b4f6c', '#f5f5f5']][n % 6];
        const s = signBoard(p.name, Math.min(4.2, 0.9 + p.name.length * 0.19), 0.55, { bg: pal[0], fg: pal[1], font: (q) => `700 ${q}px Georgia, serif`, glow: 0.05, night: 1.1 });
        s.position.set(x, y + 3.2, z); s.rotation.y = Math.atan2(fx, fz); grp.add(s); n++;
        if (n > 40) break;
    }
    ctx.add(grp);
}

// ---------------------------------------------------------------------------- the original Starbucks (1912 Pike Place, Soames-Dunn Building)
function buildStarbucks(ctx) {
    const grp = new THREE.Group(); grp.name = 'original-starbucks';
    const d = distPolyline(STARBUCKS.x, STARBUCKS.z, PIKE_PLACE), ux = STARBUCKS.x - d.cx, uz = STARBUCKS.z - d.cz, ul = Math.hypot(ux, uz) || 1;
    const fx = -ux / ul, fz = -uz / ul, yaw = Math.atan2(fx, fz);
    const x = d.cx + ux / ul * 6.0, z = d.cz + uz / ul * 6.0, y = ctx.ground.heightAt(x, z);
    // storefront: dark brown wood frame, big windows, transom; 2-storey building above it is the OSM extrusion
    const b = new GeoBatch(), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    b.box(x, y, z, 6.2, 3.6, 0.3, '#4a2c1e', 'wood', yaw);
    for (const u of [-1.9, 1.9]) b.box(x + rx * u + fx * 0.16, y + 0.6, z + rz * u + fz * 0.16, 1.9, 2.3, 0.05, '#20313a', 'glass', yaw);
    b.box(x + fx * 0.16, y, z + fz * 0.16, 1.3, 2.4, 0.06, '#2b1a12', 'wood', yaw);
    grp.add(b.build('starbucks-front'));
    // round logo sign (text ring; stylised twin-tailed siren silhouette, not a copy of the artwork)
    const c = canvas(512, 512), cx = c.getContext('2d');
    cx.fillStyle = '#5a3825'; cx.beginPath(); cx.arc(256, 256, 250, 0, 7); cx.fill();
    cx.strokeStyle = '#f3ede0'; cx.lineWidth = 8; cx.beginPath(); cx.arc(256, 256, 236, 0, 7); cx.stroke(); cx.beginPath(); cx.arc(256, 256, 150, 0, 7); cx.stroke();
    cx.fillStyle = '#f3ede0'; cx.font = '700 52px Georgia, serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const ring = (text, a0, a1, rr, flip = false) => { const n = text.length; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / n; cx.save(); cx.translate(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr); cx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2)); cx.fillText(text[i], 0, 0); cx.restore(); } };
    ring('STARBUCKS', -Math.PI * 0.82, -Math.PI * 0.18, 193); ring('SPICES • TEA • COFFEE', Math.PI * 0.12, Math.PI * 0.88, 193, true);
    cx.beginPath(); cx.arc(256, 215, 34, 0, 7); cx.fill(); cx.fillRect(236, 245, 40, 70);
    for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(256, 300); cx.quadraticCurveTo(256 + s * 120, 330, 256 + s * 95, 220); cx.lineWidth = 18; cx.strokeStyle = '#f3ede0'; cx.stroke(); }
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.5 }));
    logo.position.set(x + fx * 0.2, y + 3.0, z + fz * 0.2); logo.rotation.y = yaw; grp.add(logo);
    const word = signBoard('STARBUCKS COFFEE', 4.6, 0.45, { bg: '#4a2c1e', fg: '#f3ede0', font: (s) => `700 ${s}px Georgia, serif`, glow: 0.05, night: 1.0 });
    word.position.set(x + fx * 0.2, y + 3.9, z + fz * 0.2); word.rotation.y = yaw; grp.add(word);
    ctx.add(grp);
    // queue along the sidewalk (front = door), going south-east down Pike Place
    const t = alongPolyline(PIKE_PLACE, 0); void t;
    const along = [-(PIKE_PLACE[12][0] - PIKE_PLACE[11][0]), -(PIKE_PLACE[12][1] - PIKE_PLACE[11][1])]; const al = Math.hypot(...along);
    const qx = along[0] / al, qz = along[1] / al;
    const line = [[x + fx * 0.9, z + fz * 0.9], [x + fx * 0.9 + qx * 9, z + fz * 0.9 + qz * 9]];
    return { x, z, yaw, line };
}

// ---------------------------------------------------------------------------- Victor Steinbrueck Park poles (James Bender) — stylised, no reproduced carving
function buildSteinbrueck(ctx) {
    const b = new GeoBatch(), g = ctx.ground;
    for (const [x, z, h, sd] of [[-286, -133, 15, 3], [-300, -121, 15, 8]]) { totemPole(b, x, g.heightAt(x, z), z, h, 0.5, { seed: sd }); ctx.circle(x, z, 0.5, h); }
    ctx.add(b.build('steinbrueck-poles'));
}

// ============================================================================
export default {
    env: { fogFar: 3200 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('pike-place');
        // ---- ground: Pike Place, Pike St, Post Alley at their real levels; Elliott Bay below the bluff
        g.mod((x, z, h) => { // Pike Place corridor (brick street + both sidewalks) follows the street profile
            const r = distPolyline(x, z, PIKE_PLACE); if (r.d > 16) return h;
            const y = ppAt(x, z).y, k = smooth(9, 16, r.d); return y + (h - y) * k;
        });
        g.corridor([[-60, -95], [-39, -34], [-20, -3], [-10, 14], [10, 46], [54, 118]], 16, 6, (x, z) => g.base(x, z)); // 1st Ave keeps its grade, smooth across
        g.corridor(PIKE_ST.slice(1), 32, 3, (x, z) => { const t = clamp((x + 4) / (-50 + 4), 0, 1); return lerp(0.1, -6.4, t); });
        g.corridor(POST_ALLEY_S, 5.5, 3, (x, z) => { const t = clamp((z - 40) / (82 - 40), 0, 1); return lerp(-6.5, -10.6, smooth(0, 1, t)); });
        g.mod((x, z, h) => (x < -335 ? Math.min(h, -40) : x < -315 ? Math.min(h, lerp(-31, -40, (-315 - x) / 20)) : h));
        ctx.water(-36.6, { x0: -3500, z0: -2600, x1: -318, z1: 2600 });
        // ---- paint
        ctx.terrainOpts = { bg: '#6d6a60', bgMask: 'slab', brickAngle: 0.72, innerPx: 2048 };
        ctx.skipBuildings = new Set(['w231357660', 'w1271653801', 'w1271653800', 'w1275882970', 'w1275882966']); // + the covered stretch of Post Alley (open alley here) // hero arcade replaces these footprints
        ctx.exclude.push([...offsetPolyline(PIKE_ST, -11), ...offsetPolyline(PIKE_ST, 11).reverse()]); // no street trees on lower Pike St (open view to the sign)
        ctx.osmBackdrop({ paint: {}, streetTreeOpts: { spacing: 14, prob: 0.5, kinds: ['primary', 'secondary', 'tertiary'] }, lampOpts: { kinds: ['primary', 'secondary', 'tertiary'] }, style: (b) => (/hotel|apartments/.test(b.k) && (b.h || 0) < 25 ? 'brick' : buildingStyle(b, true)) });
        const P = ctx.painter;
        P.line(PIKE_PLACE, 17, '#a39e93', 'slab'); P.line(PIKE_PLACE, 9.2, '#8c4b39', 'brick');
        P.line(PIKE_ST.slice(1), 10, '#8c4b39', 'brick');
        P.line(POST_ALLEY_S, 4.6, '#7a6152', 'cobble');
        // hero arcade replacing the Main Arcade footprints: storeys drop down the bluff to the west (below street level),
        // an open market floor at street level (stalls under the canopy, dark hall behind), cream stucco + green trim above
        {
            const bb = new GeoBatch();
            const mains = d.buildings.filter((b) => ctx.skipBuildings.has(b.id));
            for (const m of mains) {
                let top = -1e9; for (const [x, z] of m.poly) top = Math.max(top, ppAt(x, z).y);
                const hh = m.id === 'w1271653800' ? 14.5 : 10.8, bottom = Math.min(...m.poly.map(([x, z]) => g.base(x, z))) - 2;
                const up = wallGeometry(m.poly, top + 3.9, top + hh, facadeStyle('apartment'), top + 3.9, m.id === 'w1271653800' ? '#efe6cf' : '#e3d9c0'); bb.add(up, 'f-apartment', null, up.userData.col);
                if (top - 0.15 > bottom) { const low = wallGeometry(m.poly, bottom, top - 0.15, facadeStyle('apartment'), bottom, '#c9bfa6'); bb.add(low, 'f-apartment', null, low.userData.col); }
                bb.flat(m.poly, top + hh, '#77736c', 'roofs');
                bb.prism(m.poly, top + 3.75, top + 3.9, '#3b3631', 'concrete', { bottom: true, noTop: true }); // ceiling of the market floor
                if (m.id === 'w231357660') ctx.extras.signRoof = top + hh;
            }
            // dark market hall wall behind the stalls (and its collider)
            const backLine = offsetPolyline(PIKE_PLACE.slice(0, 10), -11.5);
            for (let i = 1; i < backLine.length; i++) {
                const [ax, az] = backLine[i - 1], [bx, bz] = backLine[i], ya = ppAt(ax, az).y, yb = ppAt(bx, bz).y;
                bb.quad([ax, ya - 0.2, az], [bx, yb - 0.2, bz], [bx, yb + 3.9, bz], [ax, ya + 3.9, az], '#2e2924', 'concrete');
                bb.quad([bx, yb - 0.2, bz], [ax, ya - 0.2, az], [ax, ya + 3.9, az], [bx, yb + 3.9, bz], '#2e2924', 'concrete');
                ctx.collider({ wall: true, ax, az, bx, bz, y0a: ya - 3, y1a: ya + 4, y0b: yb - 3, y1b: yb + 4, nx: 0, nz: 1 });
            }
            // green cornice / trim band above the canopy along the arcade front
            const trim = offsetPolyline(PIKE_PLACE.slice(0, 9), -5.0);
            for (let i = 1; i < trim.length; i++) { const [ax, az] = trim[i - 1], [bx, bz] = trim[i], ya = ppAt(ax, az).y, yb = ppAt(bx, bz).y; bb.quad([ax, ya + 3.9, az], [bx, yb + 3.9, bz], [bx, yb + 4.5, bz], [ax, ya + 4.5, az], '#2f5a44', 'paint'); bb.quad([bx, yb + 3.9, bz], [ax, ya + 3.9, az], [ax, ya + 4.5, az], [bx, yb + 4.5, bz], '#2f5a44', 'paint'); }
            ctx.add(bb.build('main-arcade', { matOverrides: { 'f-brick': facadeMaterial('brick'), 'f-apartment': facadeMaterial('apartment') } }));
        }
        buildArcade(ctx);
        buildSigns(ctx, ctx.extras.signRoof ?? -6.4 + 10.8);
        buildRachel(ctx);
        buildGumWall(ctx);
        const fish = buildFishThrow(ctx);
        buildStorefronts(ctx);
        const sb = buildStarbucks(ctx);
        buildSteinbrueck(ctx);
        // Elliott Bay view: the Great Wheel at Pier 57 (≈ 370 m south of MarketFront)
        { const w = ctx.ll(47.60617, -122.3425), wh = greatWheel(w.x, -33.5, w.z, -0.35, { spin: true }); ctx.add(wh.group); ctx.onUpdate((dt, s) => wh.update(dt, s.nightK)); }
        // MarketFront viewpoint railing
        { const b = new GeoBatch(); railing(b, [[-268, -98], [-262, -72], [-250, -50], [-238, -36]], (x, z) => g.heightAt(x, z)); ctx.add(b.build('marketfront-rail')); }
        // 1st Ave traffic (Pike Place itself is car-free)
        const firstAve = [[59, 126], [54, 118], [10, 46], [-2, 27], [-10, 14], [-20, -3], [-39, -34], [-48, -48], [-72, -89], [-81, -104], [-104, -141], [-137, -174], [-206, -233]];
        addTraffic(ctx, { lanes: [{ pts: offsetPolyline(firstAve, 3.2), n: 4, speed: 8.5 }, { pts: offsetPolyline([...firstAve].reverse(), 3.2), n: 4, speed: 8.5 }] });
        // ---- plaques (6) — Rachel credited to Georgia Gerber
        const PL = sp.plaques;
        const nearPP = (s, side, extra = 0) => { const p = alongPolyline(PIKE_PLACE, s); return [p.x - p.tz * side * (6.6 + extra), p.z + p.tx * side * (6.6 + extra), Math.atan2(p.tz * side, -p.tx * side)]; };
        ctx.plaque(PL[0], ...[-24, 22.5, -2.3]);
        ctx.plaque(PL[1], -45.5, 33.0, -2.1);
        ctx.plaque(PL[2], RACHEL.x + 1.6, RACHEL.z - 1.3, -2.2, { credit: 'Rachel © 1986 Georgia Gerber — bronze, modelled in 3-D from public descriptions.' });
        ctx.plaque(PL[3], ...nearPP(14, 1, 0.5));
        ctx.plaque(PL[4], GUM.x + 1.4, GUM.z - 5.5, -0.6);
        ctx.plaque(PL[5], sb.x + Math.cos(sb.yaw) * 4.5 + Math.sin(sb.yaw) * 1.2, sb.z - Math.sin(sb.yaw) * 4.5 + Math.cos(sb.yaw) * 1.2, sb.yaw);
        // ---- Rachel coin
        ctx.interactables.push({ kind: 'coin', x: RACHEL.x + 0.6, z: RACHEL.z - 0.4, r: 1.8, label: 'Drop a coin in Rachel', use: (s) => { s.sound.play('coin'); s.progress.coins = (s.progress.coins || 0) + 1; s.ui.toast('🪙 Clink', `Coin #${s.progress.coins} — Rachel's donations fund the Market's social services.`); } });
        // ---- postcard challenge (blue hour best: the neon glows)
        (() => { const ic = ctx.spot('pike-place').photo.iconic, a = (ic.heading_deg ?? 229) * Math.PI / 180; return ctx.challenge('pike-place', { x: ic.x + Math.sin(a) * 26, z: ic.z - Math.cos(a) * 26, pitch: 12, r: 12, tol: 30 }); })() // 26 m down Pike St: the sign + clock fill the frame;
        // ---- crowd (dense): fish-throw audience, mongers, Starbucks queue, gum-wall selfies, buskers, vendors, walkers
        const pp = (s, off) => { const p = alongPolyline(PIKE_PLACE, s); return [p.x - p.tz * off, p.z + p.tx * off]; };
        const vendors = []; for (let s = 16; s < 150; s += 11) { const [x, z] = pp(s, -7.8); vendors.push({ x, z, r: 0.2, n: 1, act: 'watch', look: pp(s, 0), personas: ['vendor'] }); }
        const [fwx, fwz] = pp(6, 3.0), [bx1, bz1] = pp(110, 4.5), [bx2, bz2] = pp(240, 4.6);
        ctx.crowdCfg = {
            personas: { tourist_us: 5, local: 3, tech: 1.5, tourist_cn: 2, tourist_kr: 1.2, tourist_jp: 1.2, tourist_de: 1, tourist_es: 1.2, tourist_ca: 1.5, tourist_in: 1.2, kid: 1.2, photographer: 0.6 },
            walkers: 46,
            paths: [PIKE_PLACE, offsetPolyline(PIKE_PLACE, 3.2), offsetPolyline(PIKE_PLACE, -2.6), PIKE_ST, POST_ALLEY_S.slice(0, 4), offsetPolyline(firstAve, 9.2), offsetPolyline(firstAve, -9.2), [[-140, -58], [-122, -69], [-93, -87]], [[-172, -75], [-144, -108], [-120, -136]]],
            groups: [
                { x: fish.front.x, z: fish.front.z, r: 0.3, n: 1, act: 'throw', look: [fish.back.x, fish.back.z], personas: ['fishmonger'] },
                { x: fish.back.x, z: fish.back.z, r: 0.4, n: 2, act: 'watch', look: [fish.front.x, fish.front.z], personas: ['fishmonger'] },
                { x: fwx, z: fwz, r: 3.2, n: 14, act: 'watch', look: [fish.back.x, fish.back.z], personas: ['tourist_us', 'tourist_cn', 'tourist_jp', 'tourist_kr', 'tourist_de', 'tourist_es', 'tourist_in', 'kid', 'local'] },
                { x: fwx - 1.5, z: fwz + 2.5, r: 1.2, n: 3, act: 'photo', look: [fish.back.x, fish.back.z], personas: ['tourist_us', 'tourist_cn', 'photographer'] },
                { x: RACHEL.x + 2.4, z: RACHEL.z + 1.6, r: 1.2, n: 3, act: 'photo', look: [RACHEL.x, RACHEL.z], personas: ['tourist_us', 'tourist_in', 'tourist_es'] },
                { x: RACHEL.x + 0.6, z: RACHEL.z + 0.9, r: 0.3, n: 1, act: 'pose', look: [RACHEL.x + 4, RACHEL.z + 3], personas: ['kid'] },
                { x: -44, z: 57, r: 2.2, n: 6, act: 'photo', look: [-40, 59], personas: ['tourist_us', 'tourist_kr', 'tourist_cn', 'tourist_ca', 'kid'] },
                { x: -41, z: 63, r: 1.0, n: 2, act: 'pose', look: [-44, 61], personas: ['tourist_us', 'tourist_es'] },
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
        ctx.spawns['pike-place'] = { x: -9.5, z: 13.5, heading: headingFromBearing(240) }; // top of Pike St, the sign straight ahead
        ctx.minY = -60;
    },
};
