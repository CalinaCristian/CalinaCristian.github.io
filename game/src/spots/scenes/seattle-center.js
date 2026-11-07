// ============================================================================
//  Seattle Center — one scene, three spawns (spec 15 R15.7): the Space Needle
//  (1962; walk its base, ride up to the 158 m deck), Chihuly Garden and Glass
//  (Glasshouse with the 30 m red/orange/yellow suspended sculpture; glass in
//  the garden beds — Dale Chihuly credited), MoPOP (Frank O. Gehry, 2000: the
//  coloured shingled masses with the Monorail running through), the 1962
//  ALWEG monorail with a train looping to the station, the Wright fountain.
//  Artworks are modelled from descriptions (no photo textures).
//  Local frame: x east, z south; origin = Space Needle centre (OSM w12903132).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, canvas, canvasTexture, inPoly, clamp, lerp, smooth, headingFromBearing, polyBox, alongPolyline, polylineLength, centroid, offsetPolyline } from '../kit.js';
import { meshSDF, sdEllipsoid, sdCapsule, sdBox, sdSphere, smin, smax, noise3, fbm3 } from '../sdf.js';
import { spaceNeedle, signBoard, skyline, SEATTLE_TOWERS, railing } from '../props.js';
import { addTraffic } from '../cars.js';
import { polyCollider } from '../osm.js';

const NEEDLE = { x: 0.3, z: 0.7, y: 1.5 };
const MONO = [[-46, -86], [-23, -87], [-8, -87], [10, -88], [37, -89], [49, -88], [56, -87], [64, -86], [71, -83], [78, -80], [96, -62], [102, -54], [105, -50], [109, -43], [115, -39], [124, -30], [129, -10], [129, 60], [126, 160], [126, 300]];
const MONO_Y = 7.6; // guideway top above the plaza (≈ 2nd-floor level at MoPOP)

// ---------------------------------------------------------------------------- Space Needle + base pavilion + elevator ride to the deck
function buildNeedle(ctx) {
    const g = ctx.ground, y = NEEDLE.y;
    const n = spaceNeedle(NEEDLE.x, y, NEEDLE.z); ctx.add(n);
    ctx.onNight((k) => n.userData.night?.(k));
    // base pavilion: low curved glass pavilion between the legs + gift shop roof
    const b = new GeoBatch();
    b.add(new THREE.CylinderGeometry(13.5, 13.5, 5.2, 48, 1, true), 'glass', M(NEEDLE.x, y + 2.6, NEEDLE.z), '#9fb6c2');
    b.add(new THREE.CylinderGeometry(14.2, 14.2, 0.6, 48), 'paint', M(NEEDLE.x, y + 5.4, NEEDLE.z), '#e9ebe8');
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.rod([NEEDLE.x + Math.cos(a) * 13.5, y, NEEDLE.z + Math.sin(a) * 13.5], [NEEDLE.x + Math.cos(a) * 13.5, y + 5.2, NEEDLE.z + Math.sin(a) * 13.5], 0.06, '#d4d8da', 'steel', 5); }
    // spiral ramp around the core outside the pavilion (exit ramp)
    const ramp = []; for (let i = 0; i <= 40; i++) { const a = -0.6 + i / 40 * 2.6, r = 16.2; ramp.push([NEEDLE.x + Math.cos(a) * r, y + 0.3 + i / 40 * 2.6, NEEDLE.z + Math.sin(a) * r]); }
    b.tube(ramp, 0.05, '#c9cdd0', 'steel', 5);
    ctx.add(b.build('needle-base'));
    const sign = signBoard('SPACE NEEDLE', 5.2, 0.8, { bg: '#f2f2ee', fg: '#1f3b57', font: (s) => `700 ${s}px "Futura", "Century Gothic", sans-serif` });
    sign.position.set(NEEDLE.x, y + 4.2, NEEDLE.z + 13.9); ctx.add(sign);
    // colliders: pavilion ring (open at the south door), the six legs at the base, the core
    const ring = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; ring.push([NEEDLE.x + Math.cos(a) * 13.6, NEEDLE.z + Math.sin(a) * 13.6]); }
    ctx.poly(ring);
    for (let k = 0; k < 3; k++) for (const off of [-0.17, 0.17]) { const a = k * Math.PI * 2 / 3 + off + Math.PI / 6; ctx.circle(NEEDLE.x + Math.cos(a) * 18.4, NEEDLE.z + Math.sin(a) * 18.4, 1.0, 20); }
    // the 520 ft deck: walkable ring between the top house glass (r 17.6) and the barrier (r 21.4)
    const DECK_Y = y + 158.6, ringPoly = (r) => { const p = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; p.push([NEEDLE.x + Math.cos(a) * r, NEEDLE.z + Math.sin(a) * r]); } return p; };
    const outer = ringPoly(21.3), inner = ringPoly(17.4);
    ctx.ground.addPoly(outer, (px, pz) => (Math.hypot(px - NEEDLE.x, pz - NEEDLE.z) > 17.3 ? DECK_Y : NaN), DECK_Y - 1);
    for (let i = 0; i < 48; i++) { const [ax, az] = outer[i], [bx, bz] = outer[(i + 1) % 48]; ctx.collider({ wall: true, ax, az, bx, bz, y0a: DECK_Y - 1, y1a: DECK_Y + 3, y0b: DECK_Y - 1, y1b: DECK_Y + 3, nx: 0, nz: 1 }); const [cx, cz] = inner[i], [dx, dz] = inner[(i + 1) % 48]; ctx.collider({ wall: true, ax: cx, az: cz, bx: dx, bz: dz, y0a: DECK_Y - 1, y1a: DECK_Y + 3, y0b: DECK_Y - 1, y1b: DECK_Y + 3, nx: 0, nz: 1 }); }
    const deckFloor = new THREE.Mesh(new THREE.RingGeometry(17.3, 21.3, 64), new THREE.MeshStandardMaterial({ color: '#8e9396', roughness: 0.7 })); deckFloor.rotation.x = -Math.PI / 2; deckFloor.position.set(NEEDLE.x, DECK_Y + 0.01, NEEDLE.z); ctx.add(deckFloor);
    const door = { x: NEEDLE.x, z: NEEDLE.z + 15.2 };
    ctx.interactables.push({ kind: 'ride', x: door.x, z: door.z, r: 3, label: 'Ride the elevator to the 520 ft deck (41 s)', cond: (s) => s.ctl.position.y < y + 20,
        use: (s) => { s.sound.play('whoosh'); s.ui.toast('🛗 41 seconds later…', 'The Loupe level and the open-air deck at 158 m.'); s.ctl.teleport(NEEDLE.x, NEEDLE.z + 19.3, 0); } });
    ctx.interactables.push({ kind: 'ride', x: NEEDLE.x, z: NEEDLE.z + 18.6, y: DECK_Y, r: 2.6, label: 'Ride the elevator back down', cond: (s) => s.ctl.position.y > y + 100,
        use: (s) => { s.sound.play('whoosh'); s.ctl.teleport(door.x, door.z + 1.5, 0); } });
    return { DECK_Y };
}

// ---------------------------------------------------------------------------- Chihuly Glasshouse + suspended sculpture + garden glass
function glassForms(n, colors, { seed = 1, shape = 'tear' } = {}) {
    const g = shape === 'sphere' ? new THREE.SphereGeometry(0.5, 14, 10) : shape === 'reed' ? new THREE.ConeGeometry(0.06, 1, 6) : (() => { const c = new THREE.ConeGeometry(0.16, 0.9, 7, 4); const p = c.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = y * 4; const x = p.getX(i), z = p.getZ(i); p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(y * 6) * 0.05, y, x * Math.sin(a) + z * Math.cos(a)); } c.computeVertexNormals(); return c; })();
    const m = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.88, emissive: '#ffffff', emissiveIntensity: 0.0 });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = diffuseColor.rgb * 0.35;'); }; // glass glows with its own colour
    m.customProgramCacheKey = () => 'spotGlass1';
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
    const H = 12.2, eave = 7.4, kneeH = 10.4, b = new GeoBatch(), steel = '#3b4247';
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }); glass.name = 'spot-glasshouse';
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
    for (const [ax, az, bx2, bz] of [[bb.x0, bb.z0, bb.x1, bb.z0], [bb.x0, bb.z1, bb.x1, bb.z1], [bb.x0, bb.z0, bb.x0, bb.z1]]) ctx.collider({ wall: true, ax, az, bx: bx2, bz, y0a: y0 - 1, y1a: y0 + 8, y0b: y0 - 1, y1b: y0 + 8, nx: 0, nz: 1 });
    // the suspended sculpture: ≈ 30 m of red / orange / yellow / amber forms hanging under the ridge
    const S = glassForms(1400, ['#d7261e', '#e8541c', '#f28a1b', '#f6b81f', '#f9d648', '#b8340f', '#ffa040', '#e03a24'], { seed: 7 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), r = S.r;
    for (let i = 0; i < 1400; i++) {
        const t = r(), z = bb.z0 + 2 + t * (D - 4), rad = 2.6 * Math.sqrt(r()) * (0.8 + 0.4 * Math.sin(t * 9)), a = r() * 6.28;
        const x = cx + Math.cos(a) * rad, y = y0 + H - 1.6 - Math.abs(Math.sin(a)) * rad * 0.8 - r() * 1.2;
        e.set((r() - 0.5) * 1.2 + Math.PI, r() * 6.28, (r() - 0.5) * 1.2); q.setFromEuler(e);
        const s = 0.7 + r() * 0.9; m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.8 + r() * 0.8), s)); S.im.setMatrixAt(i, m4);
    }
    S.im.name = 'chihuly-suspended'; ctx.add(S.im);
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
    for (let i = 0; i < 160; i++) { const x = bb.x0 - 40 + rr() * 38, z = bb.z0 - 14 + rr() * (D + 26); if (Math.hypot(x - sunC.x, z - sunC.z) < 7) continue; ctx.trees.push({ x, z, kind: rr() < 0.18 ? 'broad' : 'shrub', s: rr() < 0.18 ? 0.45 + rr() * 0.3 : 0.6 + rr() * 0.9, c: rr() < 0.3 ? '#5a3a4a' : undefined }); }
    // entrance sign on the Needle plaza side
    const sg = signBoard('CHIHULY GARDEN AND GLASS', 6.8, 0.7, { bg: '#1d1d1f', fg: '#f4f1ea', font: (s) => `600 ${s}px "Gill Sans", "Helvetica Neue", sans-serif` });
    sg.position.set(bb.x1 + 3.5, y0 + 3.4, cz + 10); sg.rotation.y = Math.PI / 2; ctx.add(sg);
    return { cx, cz, bb, sunC, y0, H };
}

// ---------------------------------------------------------------------------- MoPOP (Frank O. Gehry, 2000): shingled coloured masses, monorail slot, steel ribbon
function buildMoPOP(ctx) {
    const d = ctx.data, g = ctx.ground;
    const fp = d.buildings.find((b) => b.id === 'w161587742'); ctx.skipBuildings.add('w161587742'); ctx.skipBuildings.add('w1092469435'); ctx.exclude.push(fp.poly); // every OSM part inside the footprint
    const bb = polyBox(fp.poly), y0 = g.heightAt((bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2) - 0.5;
    // masses (local metres from the footprint SW corner): colour id, centre, radii
    const ox = bb.x0, oz = bb.z0, W = bb.x1 - bb.x0, D = bb.z1 - bb.z0;
    const masses = [
        { c: 0, x: 0.8, z: 0.3, rx: 13, ry: 21, rz: 15, tilt: 0.25 },   // iridescent gold → magenta → purple (east lobes)
        { c: 0, x: 0.66, z: 0.12, rx: 9, ry: 15, rz: 10, tilt: -0.3 },
        { c: 1, x: 0.45, z: 0.52, rx: 13, ry: 26, rz: 14, tilt: 0.15 }, // matte silver (centre, tallest)
        { c: 2, x: 0.27, z: 0.2, rx: 12, ry: 18, rz: 13, tilt: -0.2 },  // sky blue (north-west, around the monorail)
        { c: 3, x: 0.62, z: 0.8, rx: 14, ry: 15, rz: 13, tilt: 0.3 },   // deep red (south)
        { c: 4, x: 0.2, z: 0.74, rx: 10, ry: 13, rz: 12, tilt: -0.25 }, // gold (south-west)
        { c: 1, x: 0.86, z: 0.66, rx: 9, ry: 11, rz: 11, tilt: 0.2 },   // silver (south-east)
        { c: 2, x: 0.42, z: 0.86, rx: 8, ry: 10, rz: 9, tilt: 0 },
    ].map((m) => ({ ...m, x: ox + m.x * W, z: oz + m.z * D }));
    const slotZ = -86.5, slotY = y0 + MONO_Y - 0.6;
    const one = (x, y, z, m) => { const yy = y - y0, lx = x - m.x, ly = yy * Math.cos(m.tilt) - lx * Math.sin(m.tilt), lxx = lx * Math.cos(m.tilt) + yy * Math.sin(m.tilt); let dd = sdEllipsoid(lxx, ly, z, 0, 0, m.z, m.rx, m.ry, m.rz); dd += 1.4 * (noise3(x * 0.06 + m.c * 3, yy * 0.06, z * 0.06) - 0.5); return dd; };
    const sdf = (x, y, z) => {
        let dd = 1e9; for (const m of masses) dd = smin(dd, one(x, y, z, m), 1.1);
        dd = smax(dd, -(y - y0), 0.5);                           // cut at the ground
        dd = smax(dd, -sdBox(x, y, z, (bb.x0 + bb.x1) / 2, slotY + 3.2, slotZ, W, 3.6, 5.2, 0.8), 1.2); // monorail slot through the building
        return dd;
    };
    const IRI = ['#d4a53a', '#c2477a', '#6a3a8f'], COLS = [null, '#b9bec3', '#7fb7e0', '#a3262a', '#d6a640'];
    const tmp = new THREE.Color(), tmp2 = new THREE.Color();
    const t0 = performance.now();
    const geo = meshSDF(sdf, {
        min: [bb.x0 - 8, y0 - 0.5, bb.z0 - 8], max: [bb.x1 + 8, y0 + 30, bb.z1 + 8], cell: 0.75, ao: 2.2, lipschitz: 2.4,
        color: (x, y, z, nx, ny, nz, ao, out) => {
            let best = 0, bd = 1e9; masses.forEach((m, i) => { const v = one(x, y, z, m); if (v < bd) { bd = v; best = i; } });
            const m = masses[best];
            if (m.c === 0) { const t = clamp(0.5 + 0.45 * ny + 0.35 * nx + 0.2 * Math.sin(y * 0.4), 0, 1); out.set(IRI[2]).lerp(tmp.set(IRI[1]), smooth(0.25, 0.55, t)).lerp(tmp2.set(IRI[0]), smooth(0.6, 0.9, t)); }
            else out.set(COLS[m.c]);
            // shingle seams: thin darker lines on a 1 m grid following the surface
            const sx = Math.abs(((x * 2.2 + z * 0.7) % 1 + 1) % 1 - 0.5), sy = Math.abs(((y * 3.1 + x * 0.2) % 1 + 1) % 1 - 0.5);
            if (sx > 0.47 || sy > 0.47) out.multiplyScalar(0.9);
            out.multiplyScalar(0.94 + 0.12 * noise3(x * 0.6, y * 0.6, z * 0.6));
            return out.multiplyScalar(0.7 + 0.3 * ao);
        },
    });
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.3 }));
    mesh.name = 'mopop'; mesh.castShadow = true; mesh.receiveShadow = true; ctx.add(mesh);
    // the crumpled stainless "guitar neck" ribbon on top
    const b = new GeoBatch(), r = rng(5), pts = [];
    let px = ox + W * 0.45, py = y0 + 24, pz = oz + D * 0.4;
    for (let i = 0; i < 14; i++) { pts.push([px, py, pz]); px += (r() - 0.3) * 6; py += (r() - 0.5) * 3 + 0.6; pz += (r() - 0.5) * 6; }
    b.tube(pts, 0.9, '#dfe3e6', 'chrome', 6);
    // glass entrance on the Needle side
    b.box(ox + W * 0.12, y0, oz + D * 0.62, 0.4, 7, 14, '#2c3a44', 'glass');
    ctx.add(b.build('mopop-ribbon'));
    ctx.collider({ ...polyCollider(fp.poly) });
    const sign = signBoard('MoPOP', 4.2, 1.1, { bg: '#111', fg: '#ffffff', font: (s) => `800 ${s}px "Helvetica Neue", Arial, sans-serif` });
    sign.position.set(ox + W * 0.1, y0 + 8.2, oz + D * 0.62 + 7.5); sign.rotation.y = -Math.PI / 2; ctx.add(sign);
    ctx.extras.mopopMs = Math.round(performance.now() - t0);
    return { bb, y0, cx: (bb.x0 + bb.x1) / 2, cz: (bb.z0 + bb.z1) / 2 };
}

// ---------------------------------------------------------------------------- monorail: twin guideways on T-columns + a 4-car train looping through MoPOP
function buildMonorail(ctx) {
    const g = ctx.ground, b = new GeoBatch(), L = polylineLength(MONO);
    const yAt = (x, z) => Math.max(g.heightAt(x, z), -6) + MONO_Y;
    const lines = [offsetPolyline(MONO, -2.0), offsetPolyline(MONO, 2.0)];
    for (const line of lines) {
        const Ll = polylineLength(line);
        for (let s = 0; s < Ll; s += 3) {
            const a = alongPolyline(line, s), c = alongPolyline(line, Math.min(Ll, s + 3.05));
            const ya = yAt(a.x, a.z), yc = yAt(c.x, c.z);
            const nx = -a.tz, nz = a.tx;
            b.quad([a.x + nx * 0.45, ya, a.z + nz * 0.45], [c.x + nx * 0.45, yc, c.z + nz * 0.45], [c.x - nx * 0.45, yc, c.z - nz * 0.45], [a.x - nx * 0.45, ya, a.z - nz * 0.45], '#b4b0a6', 'concrete');
            b.quad([a.x + nx * 0.45, ya - 1.4, a.z + nz * 0.45], [c.x + nx * 0.45, yc - 1.4, c.z + nz * 0.45], [c.x + nx * 0.45, yc, c.z + nz * 0.45], [a.x + nx * 0.45, ya, a.z + nz * 0.45], '#a8a49a', 'concrete');
            b.quad([c.x - nx * 0.45, yc - 1.4, c.z - nz * 0.45], [a.x - nx * 0.45, ya - 1.4, a.z - nz * 0.45], [a.x - nx * 0.45, ya, a.z - nz * 0.45], [c.x - nx * 0.45, yc, c.z - nz * 0.45], '#a8a49a', 'concrete');
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
    const carG = new THREE.CapsuleGeometry(1.45, 8.6, 6, 14); carG.rotateZ(Math.PI / 2); carG.scale(1, 1.05, 0.98);
    const red = new THREE.MeshStandardMaterial({ color: '#c8102e', metalness: 0.3, roughness: 0.35 }), win = new THREE.MeshStandardMaterial({ color: '#1a2630', metalness: 0.6, roughness: 0.1 }), white = new THREE.MeshStandardMaterial({ color: '#eef0f0', roughness: 0.5 });
    const cars = [];
    for (let i = 0; i < 4; i++) {
        const c = new THREE.Group(), body = new THREE.Mesh(carG, red), band = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.9, 2.95), win), skirt = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.9, 2.6), white);
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
        ctx.terrainOpts = { bg: '#8f8b82', bgMask: 'slab', innerPx: 2048 };
        { const c = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.push([NEEDLE.x + Math.cos(a) * 26, NEEDLE.z + Math.sin(a) * 26]); } ctx.exclude.push(c); } // the Needle's OSM parts → hero model
        const needle = buildNeedle(ctx);
        const chi = buildChihuly(ctx);
        const mop = buildMoPOP(ctx);
        buildMonorail(ctx);
        ctx.osmBackdrop({ paint: {}, streetTreeOpts: { spacing: 12, prob: 0.7 }, areaTreeOpts: { conifer: 0.4 } });
        const P = ctx.painter;
        P.circle(NEEDLE.x, NEEDLE.z, 30, '#b4afa6', 'slab'); P.circle(NEEDLE.x, NEEDLE.z, 13.6, '#8d8a84', 'slab');
        // Howard S. Wright Memorial Fountain: shallow pool south of the base
        { const fw = d.areas.find((a) => a.id === 'w241876412'); if (fw) { const c = centroid(fw.poly), w = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshStandardMaterial({ color: '#3d6f80', roughness: 0.05, metalness: 0.3 })); w.rotation.x = -Math.PI / 2; w.position.set(c[0], g.heightAt(c[0], c[1]) + 0.06, c[1]); ctx.add(w); } }
        // downtown skyline 1.5–2 km south
        ctx.add(skyline(SEATTLE_TOWERS.map(([la, lo, h, w, dd, c, crown]) => { const p = ctx.ll(la, lo); return { x: p.x, z: p.z, w, d: dd, h, c, crown, y: -30 }; }), { hazeK: 0.18 }));
        ctx.onNight((k) => ctx.scene.getObjectByName('skyline')?.userData.night?.(k));
        // 5th Ave / Broad St traffic
        addTraffic(ctx, { lanes: [{ pts: [[129, 160], [129, -20], [129, -174], [130, -219], [124, -305]], n: 3, speed: 10 }, { pts: [[124, -305], [130, -219], [129, -174], [129, -20], [129, 160]].map(([x, z]) => [x - 5, z]), n: 3, speed: 10 }, { pts: [[7, 120], [18, 108], [40, 83], [79, 34], [103, 6], [129, -20]], n: 2, speed: 10 }] });
        // ---- plaques (Needle 5, Chihuly 3, MoPOP 4) with artist / architect credits
        const S = d.spots, needleY = NEEDLE.y;
        S['space-needle'].plaques.forEach((pl, i) => { const a = Math.PI / 2 + (i - 2) * 0.32, r = 26; ctx.plaque(pl, NEEDLE.x + Math.cos(a) * r, NEEDLE.z + Math.sin(a) * r, a - Math.PI / 2 + Math.PI, { credit: i === 0 ? 'Space Needle (1962): John Graham Jr., Edward E. Carlson, Victor Steinbrueck.' : null }); });
        S['chihuly'].plaques.forEach((pl, i) => ctx.plaque(pl, chi.bb.x0 - 6 - i * 4, chi.bb.z1 + 6, Math.PI, { credit: 'Glass © Dale Chihuly — modelled in 3-D from public descriptions.', style: 'city' }));
        S['mopop'].plaques.forEach((pl, i) => ctx.plaque(pl, mop.bb.x0 - 6, mop.bb.z0 + 30 + i * 4, -Math.PI / 2, { credit: 'Building: Frank O. Gehry (2000). Artworks nearby © their artists.', style: 'city' }));
        void needleY;
        // ---- challenges
        ctx.challenge('space-needle', { r: 16, tol: 45, pitch: 60, cond: (s) => s.camera.getWorldDirection(new THREE.Vector3()).y > 0.42, condHint: 'Look straight up the legs.' });
        ctx.challenge('chihuly', { x: chi.cx - 2.5, z: chi.cz + 7, heading: 60, r: 12, tol: 80, pitch: 38, cond: (s) => s.camera.getWorldDirection(new THREE.Vector3()).y > 0.3, condHint: 'Stand inside the Glasshouse and look up through the sculpture.' });
        ctx.challenge('mopop', { view: [mop.cx, mop.cz], r: 30, tol: 40, cond: (s) => { const t = s.spot.ctx.extras.trainPos; return t && Math.hypot(t.x - mop.cx, t.z - mop.cz) < 70; }, condHint: 'Wait for the Monorail to pass through the building.' });
        // ---- spawns (research)
        for (const id of ['space-needle', 'chihuly', 'mopop']) { const sp = S[id].spawn; ctx.spawns[id] = { x: sp.x, z: sp.z, heading: headingFromBearing(sp.heading_deg) }; }
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
                { x: mop.bb.x0 - 8, z: mop.cz + 6, r: 3, n: 6, act: 'photo', look: [mop.cx, mop.cz], personas: ['tourist_us', 'tourist_es', 'tech', 'local'] },
                { x: 111.3, z: -73.5, r: 1.2, n: 3, act: 'watch', look: [111.3, -76], personas: ['local', 'tourist_us'] },
                { x: -20, z: -78, r: 3, n: 6, act: 'watch', look: [-40, -86], personas: ['tourist_us', 'local', 'tech', 'kid'] },
            ],
        };
        // ---- sounds
        ctx.sound('crowd', NEEDLE.x, NEEDLE.z + 25, 70, 1.1); ctx.sound('crowd', chi.cx, chi.cz, 40, 0.6); ctx.sound('traffic', 129, -60, 90, 0.8); ctx.sound('birds', chi.sunC.x, chi.sunC.z, 60, 1); ctx.sound('hum', 60, -86, 50, 0.6);
        ctx.extras.deckY = needle.DECK_Y;
    },
};
