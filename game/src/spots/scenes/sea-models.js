// Seattle models for scenes/sea-common.js (split out by spec 22; sea-common.js re-exports them): the WSF ferry, port
// cranes, the Space Needle (seaNeedle) and the Seattle Great Wheel (seaWheel).
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M } from '../kit.js';
import { spaceNeedleModel } from '../space-needle.js';

// ============================================================================ ships, cranes, bay lights
/** Washington State Ferries Jumbo Mark II (≈ 140 m × 27 m): white superstructure, green trim, two wheelhouses */
export function ferry() {
    const b = new GeoBatch(), W = '#f2f3f0', G = '#1f6a3c', D = '#26313a';
    b.box(0, -2, 0, 26, 5.5, 140, W, 'paint'); b.box(0, -2.2, 0, 26.3, 1.4, 140.3, G, 'paint');
    b.box(0, 3.5, 0, 23, 3.2, 112, W, 'paint'); b.box(0, 4.3, 0, 23.15, 1.3, 106, D, 'darkglass');
    b.box(0, 6.7, 0, 20, 3.2, 80, W, 'paint'); b.box(0, 7.5, 0, 20.15, 1.3, 76, D, 'darkglass');
    for (const s of [-1, 1]) { b.box(0, 9.9, s * 30, 10, 2.8, 6, W, 'paint'); b.box(0, 10.6, s * 30, 10.15, 1.1, 6.15, D, 'darkglass'); }
    b.box(0, 9.9, 0, 4, 7, 7, W, 'paint'); b.box(0, 16.9, 0, 4.1, 1.2, 7.1, G, 'paint');
    const g = b.build('wsf-ferry', { castShadow: false });
    // night: deck lights
    const lb = new GeoBatch(); for (let i = -6; i <= 6; i++) for (const s of [-1, 1]) lb.box(s * 11.7, 4.0, i * 8.2, 0.3, 0.6, 3.5, '#ffe2a8', 'glow');
    const lights = lb.build('ferry-lights', { castShadow: false }); lights.visible = false; g.add(lights); g.userData.lights = lights;
    return g;
}
/** container crane (≈ 75 m to the A-frame top, boom up or down) in Port of Seattle orange-red */
export function crane(boomUp = false) {
    const b = new GeoBatch(), C = '#c4472c', K = '#2b2b2b';
    for (const sx of [-9, 9]) for (const sz of [-8, 8]) b.box(sx, 0, sz, 1.6, 46, 1.6, C, 'paint');
    for (const sz of [-8, 8]) { b.box(0, 44, sz, 20, 2.2, 1.6, C, 'paint'); b.box(0, 22, sz, 20, 1.2, 1.2, C, 'paint'); }
    b.box(0, 46, -6, 4, 2.4, 64, C, 'paint');             // girder + boom (landward part)
    if (boomUp) { b.add(new THREE.BoxGeometry(3, 2.2, 52), 'paint', M(0, 66, 28, -1.05, 0, 0), C); } else b.box(0, 46, 50, 3.4, 2.2, 52, C, 'paint');
    b.box(0, 48.4, -2, 9, 6, 10, '#d9d6cf', 'paint');      // machinery house
    for (const sx of [-1, 1]) b.rod([sx * 2, 48, -10], [0, 74, 0], 0.5, C, 'paint', 6);
    b.rod([0, 74, 0], [0, 48, boomUp ? 26 : 70], 0.25, K, 'steel', 4); b.rod([0, 74, 0], [0, 48, -36], 0.25, K, 'steel', 4);
    const g = b.build('crane', { castShadow: false });
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3020', toneMapped: false })); red.position.y = 75; g.add(red);
    return g;
}

// ============================================================================ Space Needle (1962)
/**
 * The Space Needle at 1:1 (y = base), built by ../space-needle.js from the OSM parts and Street View: 184.4 m; 100 ft
 * level 30.5-36.6 m; The Loupe (revolving glass floor) 152.4 m; observation level and open-air deck 158.5 m; halo;
 * roof, spire and beacon. `visitorGlass` fits out the two public levels behind clear glazing (the visit scene); the
 * distant backdrops keep closed, lit glazing. Returns a Group with userData { night(k), elevators[], update(dt),
 * levels, layout, loupe }.
 */
export function seaNeedle({ detail = 1, cabs = true, visitorGlass = false } = {}) {
    return spaceNeedleModel({ detail, cabs, interior: visitorGlass });
}

// ============================================================================ Seattle Great Wheel (2012)
/**
 * 53.3 m to the top (175 ft), 42 fully enclosed gondolas (8 riders each), white trussed rim + cable spokes on a white
 * A-frame at the end of Pier 57, overhanging the bay ~12 m; LED light shows at night (≈ 500,000 LEDs).
 * yaw: the wheel plane's normal direction (rotation.y of the group). Returns { group, update(dt, nightK, t), hub,
 * radius, gondolaAt(i) → world-space pose, rotor }.
 */
export function seaWheel(x, y, z, yaw, { spin = true } = {}) {
    const grp = new THREE.Group(); grp.name = 'great-wheel'; grp.position.set(x, y, z); grp.rotation.y = yaw;
    const H = 53.3, R = 23.8, hub = H - R - 2.6, W = '#f3f5f6';
    const paint = new THREE.MeshStandardMaterial({ color: '#f3f5f6', roughness: 0.45, metalness: 0.15, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true }); paint.userData.nightEmissive = 0.05;
    const b = new GeoBatch();
    // A-frame: two legs per side (z = ±) splayed along the plane, a back strut
    for (const sz of [-1, 1]) { for (const sx of [-1, 1]) b.rod([sx * 15, 0, sz * 6.5], [0, hub, sz * 2.6], 0.75, W, 'paint', 12, 0.55); b.rod([0, 0, sz * 14], [0, hub - 1, sz * 2.8], 0.55, W, 'paint', 10, 0.45); b.rod([-15, 0.5, sz * 6.5], [15, 0.5, sz * 6.5], 0.4, W, 'paint', 8); }
    b.rod([0, hub, -3.2], [0, hub, 3.2], 1.25, '#dfe3e6', 'steel', 16);
    b.box(0, -0.4, 0, 36, 0.8, 26, '#8f8b82', 'concrete');
    const fixed = b.build('wheel-frame', { matOverrides: { paint } });
    const rot = new THREE.Group(); rot.name = 'wheel-rotor'; rot.position.y = hub;
    const w = new GeoBatch();
    // trussed rim: two rings ± 1.3 m + an inner chord, zig-zag diagonals between them
    for (const sz of [-1.3, 1.3]) { const ring = new THREE.TorusGeometry(R, 0.32, 8, 168); w.add(ring, 'paint', M(0, 0, sz), W); ring.dispose(); const r2 = new THREE.TorusGeometry(R - 1.9, 0.22, 6, 168); w.add(r2, 'paint', M(0, 0, sz), W); r2.dispose(); }
    for (let i = 0; i < 84; i++) {
        const a0 = i / 84 * Math.PI * 2, a1 = (i + 0.5) / 84 * Math.PI * 2;
        for (const sz of [-1.3, 1.3]) w.rod([Math.cos(a0) * R, Math.sin(a0) * R, sz], [Math.cos(a1) * (R - 1.9), Math.sin(a1) * (R - 1.9), sz], 0.1, W, 'paint', 4);
        if (i % 2 === 0) w.rod([Math.cos(a0) * R, Math.sin(a0) * R, -1.3], [Math.cos(a0) * R, Math.sin(a0) * R, 1.3], 0.12, W, 'paint', 4);
    }
    for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); for (const sz of [-1, 1]) w.rod([0, 0, sz * 2.6], [c * (R - 1.9), s * (R - 1.9), sz * 1.3], 0.045, '#d8dcdf', 'steel', 4); }
    const rotor = w.build('wheel-rotor-geo', { matOverrides: { paint } }); rot.add(rotor);
    // LED strips on the rim (night shows) — per-vertex hue animated in the shader
    const led = new THREE.Group(); led.visible = false;
    const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, vertexColors: true });
    const ledU = { uT: { value: 0 }, uMode: { value: 0 } };
    ledMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, ledU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uMode; varying vec3 vLp;\nvec3 hsv(float h){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return k; }')
            .replace('#include <color_fragment>', `#include <color_fragment>
            { float ang = atan(vLp.y, vLp.x); float rr = length(vLp.xy);
              vec3 c1 = hsv(fract(ang / 6.2832 + uT * 0.05));
              vec3 c2 = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.25, 0.6), 0.5 + 0.5 * sin(rr * 0.6 - uT * 3.0));
              vec3 c3 = vec3(1.0, 0.92, 0.75) * (0.6 + 0.4 * step(0.5, fract(ang * 6.684 + uT * 0.8)));
              diffuseColor.rgb = uMode < 0.5 ? c1 : (uMode < 1.5 ? c2 : c3); diffuseColor.rgb *= 1.6; }`);
    };
    ledMat.customProgramCacheKey = () => 'sea-wheel-led-v1';
    { const lb = new GeoBatch(); for (const sz of [-1.45, 1.45]) { const t1 = new THREE.TorusGeometry(R + 0.34, 0.09, 4, 336); lb.add(t1, 'glow', M(0, 0, sz), '#ffffff'); t1.dispose(); }
      for (let i = 0; i < 42; i += 1) { const a = i / 42 * Math.PI * 2; for (const sz of [-1, 1]) lb.rod([Math.cos(a) * 2.2, Math.sin(a) * 2.2, sz * 2.3], [Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), sz * 1.35], 0.06, '#ffffff', 'glow', 3); }
      const lg = lb.build('wheel-led', { castShadow: false, matOverrides: { glow: ledMat } }); led.add(lg); }
    rot.add(led);
    // gondolas: enclosed cabins (white frame + glass) hanging below the rim, instanced, always upright
    const cab = new GeoBatch();
    cab.box(0, -1.25, 0, 2.3, 0.22, 2.0, '#e9ecee', 'paint'); cab.box(0, 1.15, 0, 2.3, 0.25, 2.0, '#e9ecee', 'paint');
    for (const [cx, cz] of [[-1.1, -0.95], [1.1, -0.95], [-1.1, 0.95], [1.1, 0.95]]) cab.box(cx, -1.2, cz, 0.12, 2.45, 0.12, '#e9ecee', 'paint');
    cab.rod([0, 1.3, 0], [0, 1.95, 0], 0.12, '#cfd4d8', 'steel', 6);
    const cabGeo = (() => { const gg = cab.build('g'); const geo = gg.children[0].geometry; return geo; })();
    const gondolas = new THREE.InstancedMesh(cabGeo, paint, 42); gondolas.frustumCulled = false; gondolas.castShadow = true;
    const glassM = new THREE.MeshStandardMaterial({ color: '#5d7c8c', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55, emissive: new THREE.Color('#ffe7c0'), emissiveIntensity: 0 }); glassM.userData.nightEmissive = 0.35;
    const gGlass = new THREE.InstancedMesh(new THREE.BoxGeometry(2.18, 2.3, 1.88), glassM, 42); gGlass.frustumCulled = false;
    grp.add(fixed, rot, gondolas, gGlass);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(1e-4, 1e-4, 1e-4);
    let ang = 0, mode = 0, modeT = 0;
    const out = { group: grp, hub, radius: R, rotor: rot, angle: () => ang, speed: 1, hide: -1 }; // hide: the gondola you ride in (its interior is drawn by the scene)
    const cabCentre = (i, target = new THREE.Vector3()) => { const a = ang + i / 42 * Math.PI * 2; return target.set(Math.cos(a) * (R + 0.2), hub + Math.sin(a) * (R + 0.2) - 2.05, 0); };
    out.cabLocal = cabCentre;
    out.update = (dt, night = 0, t = 0) => {
        if (spin) ang += dt * out.speed * (Math.PI * 2 / 360); // one revolution ≈ 6 min when boarding (rides: 3 turns)
        rot.rotation.z = ang;
        for (let i = 0; i < 42; i++) { cabCentre(i, v); m4.compose(v, q, i === out.hide ? zero : one); gondolas.setMatrixAt(i, m4); gGlass.setMatrixAt(i, m4); }
        gondolas.instanceMatrix.needsUpdate = true; gGlass.instanceMatrix.needsUpdate = true;
        led.visible = night > 0.25; modeT += dt; if (modeT > 40) { modeT = 0; mode = (mode + 1) % 3; }
        ledU.uT.value = t; ledU.uMode.value = mode;
    };
    out.update(0);
    return out;
}
