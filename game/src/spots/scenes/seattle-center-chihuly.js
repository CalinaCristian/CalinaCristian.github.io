// Chihuly Garden and Glass for scenes/seattle-center.js (split out by spec 22): the Glasshouse with its suspended
// sculpture and the garden glass.
import { declareInterior } from '../precip-shelter.js';
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, clamp, lerp, polyBox, compactTriangles } from '../kit.js';
import { signBoard } from '../props.js';

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
    declareInterior(ctx, { box: bb, y0: y0 - 1, y1: y0 + H, name: 'chihuly-glasshouse' }); // glazed roof: no rain or snow inside
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
export { buildChihuly };
