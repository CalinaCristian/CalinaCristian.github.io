// ============================================================================
//  Space Needle (1962; John Graham & Co., Victor Steinbrueck, Edward Carlson;
//  2018 "Century Project" renovation by Olson Kundig) at 1:1, y = 0 at the base.
//
//  Sources. Positions and radii: OSM way 12903132 and its building parts
//  (core 6.5 m to 152.4 m; fin ring r 16.7 m at 150.0-152.4 m; glazed ring
//  r 15.5 m at 152.4-156.1 m; glazed ring r 13.7 m at 158.1-161.2 m; roof
//  parts to 170.3 m; 100 ft level = a truncated triangle with three
//  16.4 x 7.8 m wings at 30.5-36.6 m; 200 ft ring at 61-64 m; base footprint
//  r 18.9 m with a glazed drum r 9.4 m). Appearance: Street View from Space
//  Needle Loop (Aug 2025) and the CC-licensed photographs listed in
//  game/research/refs/sea-spots/space-needle/LICENSES.md: twin-beam legs with
//  plate rungs that merge at the waist and fork under the top house, an open
//  lattice core, 48 radial fins under the revolving glass floor, the halo of
//  perforated panels, the outward-leaning glass barrier of the open deck.
//  Official figures: 184.4 m; 500 ft level "The Loupe" (revolving glass floor,
//  one turn in 45 min, The Loupe Lounge); 520 ft observation level (Atmos
//  Cafe, Atmos Wine Bar, open-air deck, 48 glass panels 7 ft wide and 11 ft
//  tall, 24 glass benches); the stair between the two levels.
//  ESTIMATES (no surveyed source): beam sections, rung and brace spacing, the
//  interior layout (counter, stair and table positions), furniture, colours
//  and every lighting strength.
//
//  Frame: x east, z south. Legs at azimuth 90 / 210 / 330 deg (x = cos, z = sin),
//  elevators and the 100 ft wings between them at 30 / 150 / 270 deg.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, canvas, canvasTexture, textPlane } from './kit.js';
import { NEEDLE, stairY, WAIST, RING_Y, RING_R, DEG, lerp, pol, EL_AZ, LEG_AZ, yawX, TAU, hexR, lathe, Tris, sector } from './space-needle-frame.js';
export { NEEDLE } from './space-needle-frame.js';

// ---------------------------------------------------------------------------- the legs' path
/** one beam of a leg at height y: distance from the axis, half angle between the two beams, section depth and width */
function legPose(y) {
    if (y <= WAIST) { const u = 1 - y / WAIST, R = 4.4 + 9.8 * u ** 1.45, d = 0.6 + 1.15 * u ** 1.2; return { r: Math.hypot(R, d), phi: Math.atan2(d, R), R, d, depth: 1.15 + 0.75 * u, width: 0.75 + 0.2 * u }; }
    const t = Math.min(1, (y - WAIST) / (RING_Y - WAIST)), r0 = Math.hypot(4.4, 0.6), p0 = Math.atan2(0.6, 4.4), r = r0 + (RING_R - r0) * t ** 1.55, phi = p0 + (30 * DEG - p0) * t ** 1.3;
    return { r, phi, R: r * Math.cos(phi), d: r * Math.sin(phi), depth: 1.15 - 0.25 * t, width: 0.75 - 0.1 * t };
}
function legBeam(T, a, side, steps) {
    const ring = (y) => { const p = legPose(y), az = a + side * p.phi, c = Math.cos(az), s = Math.sin(az); return { c: [c * p.r, y, s * p.r], er: [c, s], et: [-s, c], d: p.depth, w: p.width }; };
    const S = []; for (let i = 0; i <= steps; i++) S.push(ring(WAIST * i / steps)); for (let i = 1; i <= steps / 2; i++) S.push(ring(WAIST + (RING_Y - WAIST) * i / (steps / 2)));
    const corner = (s, i, j) => [s.c[0] + s.er[0] * s.d / 2 * i + s.et[0] * s.w / 2 * j, s.c[1], s.c[2] + s.er[1] * s.d / 2 * i + s.et[1] * s.w / 2 * j];
    for (let k = 0; k + 1 < S.length; k++) {
        const A = S[k], B = S[k + 1];
        for (const [i0, j0, i1, j1, ax, sg] of [[1, -1, 1, 1, 'er', 1], [-1, 1, -1, -1, 'er', -1], [1, 1, -1, 1, 'et', 1], [-1, -1, 1, -1, 'et', -1]]) {
            const nA = [A[ax][0] * sg, 0, A[ax][1] * sg], nB = [B[ax][0] * sg, 0, B[ax][1] * sg];
            T.quad(corner(A, i0, j0), corner(A, i1, j1), corner(B, i1, j1), corner(B, i0, j0), [nA, nA, nB, nB]);
        }
    }
}
/** the plate that joins a leg's two beams through the waist: a pointed arch below, the fork's crotch above */
function legWeb(T, a, cols, rows) {
    const yb = (u) => 99.5 + 8.5 * (1 - Math.abs(u) ** 1.6), yt = (u) => 120.5 + 8 * Math.abs(u) ** 1.6;
    const at = (u, y, off) => { const p = legPose(y), az = a + u * p.phi, r = p.r + off; return [Math.cos(az) * r, y, Math.sin(az) * r]; };
    for (const [off, sg] of [[0.16, 1], [-0.16, -1]]) for (let i = 0; i < cols; i++) {
        const u0 = -1 + 2 * i / cols, u1 = -1 + 2 * (i + 1) / cols;
        for (let k = 0; k < rows; k++) {
            const y00 = lerp(yb(u0), yt(u0), k / rows), y01 = lerp(yb(u0), yt(u0), (k + 1) / rows), y10 = lerp(yb(u1), yt(u1), k / rows), y11 = lerp(yb(u1), yt(u1), (k + 1) / rows);
            T.quad(at(u0, y00, off), at(u1, y10, off), at(u1, y11, off), at(u0, y01, off), [Math.cos(a) * sg, 0, Math.sin(a) * sg]);
        }
    }
}

// ---------------------------------------------------------------------------- materials
function coreWindowTexture() {
    // The stair enclosure seen through the lattice: small panes in a steel grid (drawn, not photographed).
    const W = 128, H = 128, c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), ge = e.getContext('2d');
    g.fillStyle = '#d9dbd6'; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = i * 32 + 3, y = j * 32 + 3, v = 34 + ((i * 7 + j * 13) % 5) * 7;
        g.fillStyle = `rgb(${v},${v + 12},${v + 16})`; g.fillRect(x, y, 26, 26);
        ge.fillStyle = (i + j * 3) % 4 === 1 ? '#8a7350' : '#2a2318'; ge.fillRect(x, y, 26, 26);
    }
    const map = canvasTexture(c, { repeat: true }), emissiveMap = canvasTexture(e, { repeat: true });
    return { map, emissiveMap };
}
/** night floodlighting baked per vertex: emissive = albedo x flood x night */
function floodPatch(m) {
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 flood;\nvarying vec3 vFlood;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlood = flood;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFlood;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vFlood * diffuseColor.rgb;');
    };
    m.customProgramCacheKey = () => 'needleFlood1'; m.userData.needleFlood = true; return m;
}
/** rooms lit by their own fittings: emissive = albedo x level */
function litPatch(m) {
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;'); };
    m.customProgramCacheKey = () => 'needleLit1'; return m;
}
/** glass: clear when looked through, mirror-like at a glancing angle */
function glassPatch(m, edge) {
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{ float fr = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0); diffuseColor.a = mix(diffuseColor.a, ${edge.toFixed(2)}, fr); }`); };
    m.customProgramCacheKey = () => 'needleGlass' + edge; return m;
}
function makeMaterials(interior) {
    const S = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), white = new THREE.Color('#ffffff');
    const clear = (color, opacity, edge, o = {}) => glassPatch(S({ color, roughness: 0.03, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.7, ...o }), edge);
    const M = {
        struct: floodPatch(S({ roughness: 0.52, metalness: 0.06, emissive: white.clone(), emissiveIntensity: 0 })),
        steel: S({ roughness: 0.34, metalness: 0.8 }),
        dark: S({ roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
        gold: S({ roughness: 0.28, metalness: 0.85, emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0 }),
        halo: S({ roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, emissive: white.clone(), emissiveIntensity: 0 }),
        // without rooms behind it the glazing is a dark mirror by day and a lit band by night
        band: S({ color: '#ffffff', roughness: 0.07, metalness: 0.72, emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 0, envMapIntensity: 1.5 }),
        sky: S({ color: '#ffffff', roughness: 0.07, metalness: 0.72, emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 0, envMapIntensity: 1.5 }),
        int: litPatch(S({ roughness: 0.72, metalness: 0.02, emissive: white.clone(), emissiveIntensity: 0.1 })),
        gloss: litPatch(S({ roughness: 0.22, metalness: 0.05, emissive: white.clone(), emissiveIntensity: 0.1 })),
        gWall: clear('#cfe3e6', 0.1, 0.5), gFloor: clear('#b9d3da', 0.2, 0.5, { roughness: 0.06 }), gBar: clear('#d4e6e8', 0.1, 0.62), gBal: clear('#d8e8ea', 0.12, 0.45),
        cabGlass: clear('#e2d6b8', 0.14, 0.5),
    };
    const cw = coreWindowTexture();
    M.core = new THREE.MeshStandardMaterial({ map: cw.map, emissiveMap: cw.emissiveMap, emissive: white.clone(), emissiveIntensity: 0, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
    for (const [k, v] of [['struct', 0.3], ['gold', 0.3], ['halo', 0.16], ['band', interior ? 0 : 0.42], ['sky', 0.36], ['core', 0.5]]) if (v) M[k].userData.nightEmissive = v;
    for (const k in M) M[k].name = 'needle-' + k;
    for (const k of ['gWall', 'gFloor', 'gBar', 'gBal', 'cabGlass', 'halo']) M[k].forceSinglePass = true;
    return M;
}
/** virtual floodlights (model metres): the ring round the base, the 100 ft roof, the waist, the eave and the spire */
function floodLights() {
    const L = [];
    for (let k = 0; k < 6; k++) L.push({ p: pol(27, k * 60 * DEG + 30 * DEG, 0.6), I: 1.05, range: 95 });
    for (const a of EL_AZ) L.push({ p: pol(11, a, 37.4), I: 0.75, range: 60 });
    for (let k = 0; k < 6; k++) L.push({ p: pol(7.2, k * 60 * DEG, 117), I: 1.2, range: 34 });
    for (let k = 0; k < 6; k++) L.push({ p: pol(13, k * 60 * DEG, 176), I: 0.42, range: 22 }); // a soft wash on the roof
    for (let k = 0; k < 4; k++) L.push({ p: pol(3.1, k * 90 * DEG, 169.4), I: 0.85, range: 13 });
    return L;
}
function bakeFlood(root, lights, ambient = 0.05) {
    root.traverse((o) => {
        if (!o.isMesh || !o.material?.userData?.needleFlood) return;
        const P = o.geometry.attributes.position, N = o.geometry.attributes.normal, F = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) {
            const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i); let s = ambient;
            const inSaucer = y > 152.3 && y < 161.5 && x * x + z * z < 16.6 * 16.6;
            for (const l of lights) { if (inSaucer || (l.p[1] > 170 && y < 161.6) || (l.p[1] < 150 && y > 161.6)) continue; const dx = l.p[0] - x, dy = l.p[1] - y, dz = l.p[2] - z, d = Math.hypot(dx, dy, dz) || 1, w = (nx * dx + ny * dy + nz * dz) / d * 0.9 + 0.1; if (w > 0) s += l.I * w / (1 + (d / l.range) ** 2); }
            s = Math.min(1.45, s); F[i * 3] = s; F[i * 3 + 1] = s * 0.975; F[i * 3 + 2] = s * 0.93;
        }
        o.geometry.setAttribute('flood', new THREE.BufferAttribute(F, 3));
    });
}

// ---------------------------------------------------------------------------- structure: legs, core, 100 ft and 200 ft levels
const WHITE = '#eef0ec', WHITE2 = '#e3e6e1', CREAM = '#e7dfc8', STEEL = '#b9bec2';
function buildStructure(b, T, hi) {
    const steps = hi ? 28 : 14;
    for (const a of LEG_AZ) {
        for (const s of [-1, 1]) legBeam(T, a, s, steps);
        legWeb(T, a, hi ? 10 : 6, hi ? 6 : 3);
        const ca = Math.cos(a), sa = Math.sin(a), ry = yawX(-sa, ca);
        // plate rungs between the two beams, each tied back to the core (spacing estimated from Street View)
        for (const y of [8.5, 17, 25.5, 44, 52.5, 70.5, 79, 87.5, 95]) {
            const p = legPose(y), L = 2 * p.d - p.width + 0.12; if (L < 0.3) continue;
            b.box(ca * p.R, y - 0.75, sa * p.R, L, 1.5, p.depth * 0.6, WHITE, 'struct', ry);
            if (hi || y % 17 === 0) b.rod([ca * 3.2, y, sa * 3.2], [ca * (p.R - p.depth / 2), y, sa * (p.R - p.depth / 2)], 0.2, WHITE2, 'struct', 4);
        }
        // concrete pedestals under the beams
        for (const s of [-1, 1]) { const p = legPose(0), az = a + s * p.phi; b.box(Math.cos(az) * p.r, -0.6, Math.sin(az) * p.r, p.depth + 1.1, 1.5, p.width + 0.9, '#c4c1b8', 'concrete', yawX(Math.cos(az), Math.sin(az))); }
    }
    T.into(b, 'struct', WHITE);
    // ---- core: an open hexagonal steel frame (ring beams every 10 ft, cross-braced towards the legs) round the stair
    const CR = 3.3, V = (k) => pol(CR, k * 60 * DEG), top = 148.6;
    for (let k = 0; k < 6; k++) { const [x, , z] = V(k); b.box(x, 0, z, 0.36, top, 0.36, WHITE2, 'struct', -k * 60 * DEG); }
    const pitch = hi ? 3.05 : 6.1;
    for (let y = pitch; y < top; y += pitch) for (let k = 0; k < 6; k++) {
        const A = V(k), B = V(k + 1), mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
        b.box(mx, y - 0.14, mz, CR, 0.28, 0.2, WHITE2, 'struct', yawX(B[0] - A[0], B[2] - A[2]));
        if (hi && k % 2 === 1) { b.rod([A[0], y - pitch + 0.2, A[2]], [B[0], y - 0.2, B[2]], 0.07, WHITE2, 'struct', 4); b.rod([B[0], y - pitch + 0.2, B[2]], [A[0], y - 0.2, A[2]], 0.07, WHITE2, 'struct', 4); }
    }
    // elevator guide rails and hoist cables on the three open faces
    for (const e of EL_AZ) { const c = Math.cos(e), s = Math.sin(e); for (const u of [-0.8, 0.8]) b.box(c * 3.02 - s * u, 0, s * 3.02 + c * u, 0.16, top, 0.14, STEEL, 'steel', yawX(c, s)); if (hi) for (const u of [-0.25, 0.25]) b.rod([c * 3.2 - s * u, 2, s * 3.2 + c * u], [c * 3.2 - s * u, 160, s * 3.2 + c * u], 0.018, '#3a3d40', 'steel', 3); }
    // the glazed stair enclosure inside the frame
    { const R = 2.5; for (let k = 0; k < 6; k++) { const A = pol(R, k * 60 * DEG), B = pol(R, (k + 1) * 60 * DEG), n = pol(1, k * 60 * DEG + 30 * DEG), v = top / 3.05; T.quad([A[0], 0, A[2]], [B[0], 0, B[2]], [B[0], top, B[2]], [A[0], top, A[2]], n, [[0, 0], [1, 0], [1, v], [0, v]]); } T.into(b, 'core', '#ffffff'); }

    // ---- 100 ft level: a truncated triangle round the core with a wing over each elevator side (OSM parts)
    const Y0 = 30.5, YF = 31.3, YS = 32.6, YG = 33.9, YR = 36.1, Y1 = 36.6, DL = 6.6, DH = 8.2, VO = 14.4, HOLE = NEEDLE.shaftR;
    const planes = [...EL_AZ.map((a) => [a, DL]), ...LEG_AZ.map((a) => [a, 10.4])];
    const nA = hi ? 72 : 36;
    for (const [y, ny, over, col] of [[Y0, -1, 0, CREAM], [YF, 1, 0, '#8a8c8a'], [YR, -1, 0.3, WHITE], [Y1, 1, 0.3, '#d9dbd6']]) for (let k = 0; k < nA; k++) {
        const a0 = k / nA * TAU, a1 = (k + 1) / nA * TAU, r0 = hexR(planes, a0) + over, r1 = hexR(planes, a1) + over;
        T.quad(pol(HOLE, a0, y), pol(HOLE, a1, y), pol(r1, a1, y), pol(r0, a0, y), [0, ny, 0]);
    }
    lathe(T, [[HOLE, Y1], [HOLE, Y0]], nA); // hoistway lining
    T.into(b, 'struct', WHITE);
    for (const l of LEG_AZ) { // the three short faces behind the legs: white spandrel, window band, roof edge
        const c = Math.cos(l), s = Math.sin(l), hw = DL / Math.cos(30 * DEG) - Math.tan(30 * DEG) * 10.4 + 0.02, P = (u, y) => [c * 10.4 - s * u, y, s * 10.4 + c * u], n = [c, 0, s];
        T.quad(P(-hw, Y0), P(hw, Y0), P(hw, YG), P(-hw, YG), n).into(b, 'struct', WHITE);
        T.quad(P(-hw, YG), P(hw, YG), P(hw, YR), P(-hw, YR), n).into(b, 'sky', '#24364a');
        const Q = (u, y) => [c * 10.7 - s * u, y, s * 10.7 + c * u]; T.quad(Q(-hw - 0.2, YR), Q(hw + 0.2, YR), Q(hw + 0.2, Y1), Q(-hw - 0.2, Y1), n).into(b, 'struct', WHITE);
    }
    for (const e of EL_AZ) {
        const c = Math.cos(e), s = Math.sin(e), P = (u, v, y) => [c * v - s * u, y, s * v + c * u], out = [c, 0, s], sideN = (sg) => [-s * sg, 0, c * sg], ry = yawX(-s, c);
        b.box(c * (DL + 0.32 + VO + 0.35) / 2, YR, s * (DL + 0.32 + VO + 0.35) / 2, DH * 2 + 0.7, Y1 - YR, VO + 0.03 - DL, WHITE, 'struct', ry); // roof slab with a small overhang
        // window band and spandrel on the three free sides
        const faces = [[P(-DH, VO, 0), P(DH, VO, 0), out], [P(DH, VO, 0), P(DH, DL, 0), sideN(1)], [P(-DH, DL, 0), P(-DH, VO, 0), sideN(-1)]];
        for (const [A, B, n] of faces) {
            const at = (p, y) => [p[0], y, p[2]];
            T.quad(at(A, YG), at(B, YG), at(B, YR), at(A, YR), n).into(b, 'sky', '#24364a');
            T.quad(at(A, YS), at(B, YS), at(B, YG), at(A, YG), n).into(b, 'struct', WHITE);
            const L = Math.hypot(B[0] - A[0], B[2] - A[2]), m = Math.round(L / 1.37);
            if (hi) for (let i = 0; i <= m; i++) { const x = lerp(A[0], B[0], i / m) + n[0] * 0.03, z = lerp(A[2], B[2], i / m) + n[2] * 0.03; b.box(x, YG, z, 0.07, YR - YG, 0.07, WHITE, 'struct', ry); }
        }
        // the hull: a soffit sloping in towards the core, closed at both ends, with nine deep ribs
        const sl = Math.hypot(VO - DL, YS - Y0 - 0.2), dn = [c * (YS - Y0 - 0.2) / sl, -(VO - DL) / sl, s * (YS - Y0 - 0.2) / sl];
        T.quad(P(-DH, VO, YS), P(DH, VO, YS), P(DH, DL, Y0 + 0.2), P(-DH, DL, Y0 + 0.2), dn);
        for (const sg of [-1, 1]) T.tri(P(DH * sg, VO, YS), P(DH * sg, DL, YS), P(DH * sg, DL, Y0 + 0.2), sideN(sg));
        T.into(b, 'struct', CREAM);
        const yS = (v) => lerp(Y0 + 0.2, YS, (v - DL) / (VO - DL));
        if (hi) for (let i = 0; i < 9; i++) {
            const u = -7.2 + i * 1.8, w = 0.16, vo = VO - 0.15, d0 = 1.15, d1 = 0.22;
            T.quad(P(u - w, DL, yS(DL)), P(u - w, vo, yS(vo)), P(u - w, vo, yS(vo) - d1), P(u - w, DL, yS(DL) - d0), sideN(-1));
            T.quad(P(u + w, DL, yS(DL)), P(u + w, vo, yS(vo)), P(u + w, vo, yS(vo) - d1), P(u + w, DL, yS(DL) - d0), sideN(1));
            T.quad(P(u - w, DL, yS(DL) - d0), P(u + w, DL, yS(DL) - d0), P(u + w, vo, yS(vo) - d1), P(u - w, vo, yS(vo) - d1), [0, -1, 0]);
            T.quad(P(u - w, vo, yS(vo)), P(u + w, vo, yS(vo)), P(u + w, vo, yS(vo) - d1), P(u - w, vo, yS(vo) - d1), out);
        }
        T.into(b, 'struct', WHITE);
    }
    // haunches from the legs under the wings (Street View: deep tapered brackets either side of each leg)
    for (const l of LEG_AZ) for (const sg of [-1, 1]) {
        const p = legPose(27.5), az = l + sg * p.phi, A = pol(p.r, az, 27.5), e = l + sg * 60 * DEG, c = Math.cos(e), s = Math.sin(e), u = -sg * 6.2, B = [c * 10.6 - s * u, 31.2, s * 10.6 + c * u];
        b.rod(A, B, 0.55, WHITE, 'struct', 4, 0.3);
    }
    // ---- 200 ft level: a box platform from the core to each leg (OSM part 61-64 m)
    for (const l of LEG_AZ) {
        const c = Math.cos(l), s = Math.sin(l), ry = yawX(c, s), r0 = 3.1, r1 = legPose(62).R + 0.5, rm = (r0 + r1) / 2;
        b.box(c * rm, 61, s * rm, r1 - r0, 0.5, 4.6, CREAM, 'struct', ry);
        for (const u of [-2.3, 2.3]) b.box(c * rm - s * u, 61.5, s * rm + c * u, r1 - r0, 1.5, 0.22, WHITE, 'struct', ry);
        b.box(c * rm, 63.4, s * rm, r1 - r0, 0.5, 4.6, WHITE, 'struct', ry);
    }
}

// ---------------------------------------------------------------------------- top house: shell, halo, roof
function buildTopHouse(b, T, hi, interior) {
    const N = hi ? 96 : 48, FINS = hi ? 48 : 24, L = NEEDLE;
    // ring beam on the six beam heads, the dark throat round the shaft, the white drum the fins spring from
    lathe(T, [[9.35, 146.0], [10.45, 146.0], [10.45, 147.4], [10.0, 147.4], [10.0, 152.25]], N).into(b, 'struct', WHITE);
    lathe(T, [[L.shaftR, 149.5], [9.35, 147.4], [9.35, 146.0]], N).into(b, 'dark', '#23282c');
    lathe(T, [[L.shaftR, 161.0], [L.shaftR, 149.5]], N / 2); lathe(T, [[0, 161.0], [L.shaftR, 161.0]], N / 2); T.into(b, 'dark', '#2b2f33');
    // 48 radial fins (Wikimedia photographs of the underside): deep at the drum, pointed at the tip
    for (let i = 0; i < FINS; i++) {
        const a = i / FINS * TAU, c = Math.cos(a), s = Math.sin(a), w = 0.085, P = (r, y, u) => [c * r - s * u, y, s * r + c * u];
        const r0 = 10.0, r1 = 16.7, yt = 152.08, yb = 147.3, ye = 151.8;
        for (const sg of [-1, 1]) T.quad(P(r0, yb, w * sg), P(r1, ye, w * sg), P(r1, yt, w * sg), P(r0, yt, w * sg), [-s * sg, 0, c * sg]);
        const sl = Math.hypot(r1 - r0, ye - yb); T.quad(P(r0, yb, -w), P(r0, yb, w), P(r1, ye, w), P(r1, ye, -w), [c * (ye - yb) / sl, -(r1 - r0) / sl, s * (ye - yb) / sl]);
    }
    T.into(b, 'struct', WHITE);
    // sill out to the fin tips, the slab edge between the two levels
    lathe(T, [[L.turnR1, 152.15], [16.7, 152.15], [16.7, 152.4], [L.loupeWallR - 0.05, 152.4]], N);
    lathe(T, [[15.95, L.loupeCeil], [16.7, 156.3], [16.7, L.deckY], [L.deckOutR + 0.12, L.deckY]], N);
    T.into(b, 'struct', WHITE);
    // glazing of the 500 ft level: 48 panels leaning out (r 15.5 at the floor, OSM)
    const wallKey = interior ? 'gWall' : 'band', wallCol = interior ? '#ffffff' : '#2b3d4c';
    lathe(T, [[L.loupeWallR, 152.4], [15.95, L.loupeCeil]], N).into(b, wallKey, wallCol);
    for (let i = 0; i < 48; i += hi ? 1 : 2) { const a = (i + 0.5) / 48 * TAU; b.rod(pol(L.loupeWallR + 0.03, a, 152.4), pol(15.98, a, L.loupeCeil), 0.055, WHITE, 'struct', 4); }
    if (!interior) { // closed model: the underside of the glass floor and the deck are plain surfaces
        lathe(T, [[10.0, 152.2], [L.turnR1, 152.2]], N).into(b, 'band', '#1f2c36');
        lathe(T, [[L.deckOutR + 0.12, L.deckY], [L.deckInR, L.deckY]], N).into(b, 'struct', '#cfd1cc');
        lathe(T, [[L.deckInR, L.deckY], [L.deckInR, L.deckCeil]], N).into(b, 'band', '#2b3d4c');
    }
    // ---- halo: radial arms, three rings, perforated panels (seen from below as a grid with the sky behind)
    const HY = 157.35;
    for (let i = 0; i < 48; i += hi ? 1 : 2) { const a = i / 48 * TAU, c = Math.cos(a), s = Math.sin(a); b.box(c * 18.85, HY - 0.11, s * 18.85, 4.3, 0.22, 0.12, WHITE, 'struct', yawX(c, s)); }
    for (const [r, w, h, col] of [[17.6, 0.12, 0.22, WHITE], [19.3, 0.12, 0.22, WHITE], [21.0, 0.2, 0.42, '#e0dccb']]) lathe(T, [[r - w, HY - h / 2], [r + w, HY - h / 2], [r + w, HY + h / 2], [r - w, HY + h / 2], [r - w, HY - h / 2]], N).into(b, 'struct', col);
    lathe(T, [[20.85, HY + 0.06], [17.7, HY + 0.06]], N).into(b, 'halo', '#f4f5f1');
    // ---- open-air deck: 48 glass panels 3.35 m tall leaning out, slim steel fins between them
    lathe(T, [[L.deckOutR + 0.05, L.deckY], [17.15, 161.85]], N).into(b, 'gBar', '#ffffff');
    for (let i = 0; i < 48; i += hi ? 1 : 2) { const a = i / 48 * TAU; b.rod(pol(L.deckOutR + 0.1, a, L.deckY - 0.3), pol(17.2, a, 161.85), 0.04, STEEL, 'steel', 4); }
    // ---- roof: soffit over the open deck, shallow cone, clerestory band, cap, platform and spire
    lathe(T, [[L.deckInR, L.deckCeil], [15.3, L.deckCeil]], N).into(b, interior ? 'int' : 'struct', '#f1f0ea'); // soffit over the open deck, lit by its own downlights
    lathe(T, [[15.3, L.deckCeil], [15.36, 161.72], [10.2, 164.2], [7.75, 166.5]], N);
    lathe(T, [[7.95, 167.4], [7.95, 167.58], [5.4, 168.45], [2.7, 168.95], [1.9, 169.0], [1.9, 170.3], [2.45, 170.3], [2.45, 170.42], [0.95, 170.42], [0.2, 181.0], [0.09, 181.0], [0.09, 184.4], [0, 184.4]], N / 2);
    lathe(T, [[7.75, 167.4], [7.95, 167.4]], N / 2);
    T.into(b, 'struct', '#ecebe5');
    lathe(T, [[7.75, 166.5], [7.75, 167.4]], N / 2).into(b, 'sky', '#2f4050');
    if (hi) { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; b.rod(pol(2.35, a, 170.42), pol(2.35, a, 171.5), 0.025, STEEL, 'steel', 4); } for (const y of [171.0, 171.5]) lathe(T, [[2.33, y], [2.37, y], [2.37, y + 0.04], [2.33, y + 0.04], [2.33, y]], 24); T.into(b, 'steel', STEEL); }
}

// ---------------------------------------------------------------------------- interiors of the two public levels
function chair(b, x, y, z, yaw, col = '#f1f0eb') {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (u, v) => [x + c * u + s * v, z - s * u + c * v]; // +v = the way the sitter faces
    b.box(x, y + 0.44, z, 0.44, 0.04, 0.44, col, 'int', yaw);
    { const [bx, bz] = P(0, -0.21); b.box(bx, y + 0.48, bz, 0.42, 0.4, 0.035, col, 'int', yaw); }
    for (const [u, v] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) { const [lx, lz] = P(u, v); b.box(lx, y, lz, 0.03, 0.44, 0.03, '#c9ccce', 'steel', yaw); }
}
function table(b, x, y, z, r = 0.4, col = '#f4f3ee', h = 0.74) {
    b.cyl(x, y, z, 0.24, 0.025, '#c9ccce', 'steel', 12); b.cyl(x, y + 0.025, z, 0.035, h - 0.06, '#c9ccce', 'steel', 8); b.cyl(x, y + h - 0.035, z, r, 0.035, col, 'gloss', 20);
}
function stool(b, x, y, z, seat = '#3b2a20', h = 0.76) {
    b.cyl(x, y, z, 0.2, 0.02, '#b9bec2', 'steel', 12); b.cyl(x, y + 0.02, z, 0.028, h - 0.07, '#b9bec2', 'steel', 6); b.cyl(x, y + h - 0.05, z, 0.19, 0.05, seat, 'int', 14);
    b.cyl(x, y + 0.26, z, 0.15, 0.015, '#b9bec2', 'steel', 10);
}
/** returns the turntable Group (glass floor + what stands on it) */
function buildInterior(grp, Mt) {
    const L = NEEDLE, b = new GeoBatch(), T = new Tris(), N = 96;
    const WOOD = '#a97a48', WOOD_D = '#5b3d26', TERR = '#dcd9d1', PLASTER = '#f3f2ed', STONE = '#f1efe9';
    const YL = L.loupeY, YD = L.deckY;
    // ================= 500 ft: The Loupe
    lathe(T, [[L.turnR0 - 0.02, YL], [L.coreR, YL]], N).into(b, 'gloss', '#b9b5ac');                                   // fixed inner floor
    lathe(T, [[L.loupeWallR - 0.05, YL + 0.012], [L.turnR1 + 0.02, YL + 0.012]], N).into(b, 'gloss', '#c4c2bb'); // fixed outer margin
    lathe(T, [[L.coreR, YL - 0.25], [L.turnR0 - 0.02, YL - 0.25]], N).into(b, 'dark', '#55595c');                  // its underside, behind the drum
    lathe(T, [[L.coreR, L.loupeCeil], [15.95, L.loupeCeil]], N).into(b, 'int', '#6b6862');                         // dark ceiling: little to mirror in the glass
    lathe(T, [[L.coreR, YL], [L.coreR, L.loupeCeil]], N).into(b, 'int', WOOD);                                     // core wall, timber lining
    for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; if (L.elAz.some((e) => Math.abs(Math.atan2(Math.sin(a - e), Math.cos(a - e))) < 0.22)) continue; sector(T, L.coreR, L.coreR + 0.035, a - 0.012, a + 0.012, YL + 0.1, L.loupeCeil - 0.1); }
    T.into(b, 'int', '#8f6238');
    // the fixed second layer of glass and the drive under the turntable: two rails, twelve motor housings
    lathe(T, [[L.turnR0 - 0.05, YL - 0.22], [L.turnR1 + 0.05, YL - 0.22]], N).into(b, 'gFloor', '#ffffff');
    for (const r of [L.turnR0 + 0.45, L.turnR1 - 0.45]) sector(T, r - 0.07, r + 0.07, 0, TAU, YL - 0.2, YL - 0.1, N); T.into(b, 'steel', '#d7dadb');
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU, [x, , z] = pol(L.turnR0 + 0.45, a); b.box(x, YL - 0.21, z, 0.5, 0.16, 0.26, '#8d9296', 'steel', yawX(-Math.sin(a), Math.cos(a))); }
    // ceiling fittings: a cove at the core and two rings of downlights
    sector(T, L.coreR + 0.02, L.coreR + 0.12, 0, TAU, L.loupeCeil - 0.07, L.loupeCeil - 0.02, N).into(b, 'glow', '#ffe6bf');
    for (const [r, n] of [[9.0, 24], [12.4, 36], [14.9, 48]]) for (let i = 0; i < n; i++) { const [x, , z] = pol(r, (i + 0.5) / n * TAU); b.cyl(x, L.loupeCeil - 0.03, z, 0.075, 0.025, '#fff0d2', 'glow', 8); }
    // lift lobbies on both levels: stainless doors in a dark reveal, call panel, lit floor indicator
    for (const y of [YL, YD]) for (const e of L.elAz) {
        sector(T, L.coreR + 0.005, L.coreR + 0.06, e - 0.2, e + 0.2, y, y + 2.45).into(b, 'int', '#3c3f42');
        sector(T, L.coreR + 0.03, L.coreR + 0.09, e - 0.17, e - 0.004, y + 0.02, y + 2.3); sector(T, L.coreR + 0.03, L.coreR + 0.09, e + 0.004, e + 0.17, y + 0.02, y + 2.3); T.into(b, 'steel', '#c3c7ca');
        sector(T, L.coreR + 0.05, L.coreR + 0.075, e - 0.07, e + 0.07, y + 2.5, y + 2.62).into(b, 'glow', '#ffd48a');
        sector(T, L.coreR + 0.05, L.coreR + 0.075, e + 0.225, e + 0.24, y + 1.05, y + 1.3).into(b, 'glow', '#bfe3ff');
    }
    // ---- The Loupe Lounge (OSM node 3359850618, west side): fluted timber counter, stone top, back bar, stools, pendants
    { const B = L.bar, n = 28;
        sector(T, B.r0, B.r1, B.a0, B.a1, YL, YL + 1.03, n).into(b, 'int', WOOD_D);
        for (let i = 0; i <= 70; i++) { const a = lerp(B.a0, B.a1, i / 70); sector(T, B.r1, B.r1 + 0.025, a - 0.004, a + 0.004, YL + 0.08, YL + 1.0); } T.into(b, 'int', WOOD);
        sector(T, B.r0 - 0.06, B.r1 + 0.1, B.a0 - 0.01, B.a1 + 0.01, YL + 1.03, YL + 1.09, n).into(b, 'gloss', STONE);
        sector(T, B.r1 + 0.03, B.r1 + 0.06, B.a0, B.a1, YL + 0.05, YL + 0.09, n).into(b, 'glow', '#ffb66b'); // toe-kick light
        sector(T, B.r1 + 0.02, B.r1 + 0.16, B.a0 + 0.02, B.a1 - 0.02, YL + 0.2, YL + 0.24, n).into(b, 'steel', '#b89a66'); // foot rail
        // back bar on the core wall: lit niche, three shelves of bottles
        sector(T, L.coreR + 0.02, L.coreR + 0.05, B.a0 + 0.04, B.a1 - 0.04, YL + 1.0, YL + 2.75, n).into(b, 'glow', '#ffd9a0');
        sector(T, L.coreR + 0.02, L.coreR + 0.5, B.a0 + 0.04, B.a1 - 0.04, YL, YL + 0.95, n).into(b, 'int', WOOD_D);
        const BOT = ['#2e5a2e', '#6b3a1a', '#d8d0b0', '#3a2a5a', '#8a1a1a', '#c9a24a', '#1f4a5c'];
        for (const [k, h] of [[0, 1.45], [1, 1.95], [2, 2.45]]) { sector(T, L.coreR + 0.05, L.coreR + 0.34, B.a0 + 0.04, B.a1 - 0.04, YL + h - 0.03, YL + h, n).into(b, 'gloss', '#2a221c'); for (let i = 0; i < 44; i++) { const a = lerp(B.a0 + 0.07, B.a1 - 0.07, i / 43), [x, , z] = pol(L.coreR + 0.2, a), hh = 0.24 + ((i * 7 + k * 3) % 5) * 0.025; b.cyl(x, YL + h, z, 0.036, hh, BOT[(i + k * 2) % BOT.length], 'gloss', 6); b.cyl(x, YL + h + hh, z, 0.014, 0.07, BOT[(i + k * 2) % BOT.length], 'gloss', 5); } }
        for (let i = 0; i < 4; i++) { const a = lerp(B.a0 + 0.12, B.a1 - 0.12, i / 3), [x, , z] = pol((B.r0 + B.r1) / 2 - 0.05, a); b.cyl(x, YL + 1.09, z, 0.03, 0.3, '#c9ccce', 'steel', 6); b.box(x, YL + 1.36, z, 0.05, 0.05, 0.2, '#c9ccce', 'steel', yawX(Math.cos(a), Math.sin(a))); } // taps
        for (let i = 0; i < B.stools; i++) { const a = lerp(B.a0 + 0.06, B.a1 - 0.06, i / (B.stools - 1)), [x, , z] = pol(B.r1 + 0.52, a); stool(b, x, YL, z); }
        for (let i = 0; i < 7; i++) { const a = lerp(B.a0 + 0.08, B.a1 - 0.08, i / 6), [x, , z] = pol((B.r0 + B.r1) / 2 + 0.1, a); b.rod([x, L.loupeCeil, z], [x, YL + 2.25, z], 0.006, '#222', 'steel', 3); b.cyl(x, YL + 2.05, z, 0.09, 0.2, '#b98a4a', 'gold', 10, 0.45); b.sphere(x, YL + 2.05, z, 0.05, 0.05, 0.05, '#ffe2b0', 'glow', 8, 6); }
    }
    // curved banquette on the south side of the core, low tables in front of it
    { const S = L.sofa, n = 20;
        sector(T, S.r0, S.r1, S.a0, S.a1, YL, YL + 0.42, n).into(b, 'int', '#3f4a52');
        sector(T, S.r0, S.r0 + 0.2, S.a0, S.a1, YL + 0.42, YL + 0.95, n).into(b, 'int', '#48545d');
        for (let i = 0; i < 4; i++) { const [x, , z] = pol(S.r1 + 0.75, lerp(S.a0 + 0.1, S.a1 - 0.1, i / 3)); table(b, x, YL, z, 0.3, '#f1efe9', 0.5); }
    }
    // ---- the stair to the observation level: timber treads on steel, glass balustrade with a timber rail, closed soffit
    { const St = L.stair, da = (St.a1 - St.a0) / St.steps, rise = (YD - YL) / St.steps;
        for (let i = 0; i < St.steps; i++) { const a = St.a0 + i * da, y = YL + (i + 1) * rise; sector(T, St.r0, St.r1, a, a + da * 1.02, y - 0.06, y).into(b, 'int', '#b98d5c'); sector(T, St.r0, St.r1, a, a + 0.006, y - rise, y - 0.06).into(b, 'int', PLASTER); }
        const SN = 24;
        for (let i = 0; i < SN; i++) { // soffit and the two stringers
            const a0 = lerp(St.a0, St.a1, i / SN), a1 = lerp(St.a0, St.a1, (i + 1) / SN), y0 = stairY(a0) - 0.12, y1 = stairY(a1) - 0.12, dn = [0, -1, 0];
            T.quad(pol(St.r0, a0, y0), pol(St.r1, a0, y0), pol(St.r1, a1, y1), pol(St.r0, a1, y1), dn);
            for (const [r, sg] of [[St.r1 + 0.05, 1], [St.r1, -1]]) { const n0 = [Math.cos(a0) * sg, 0, Math.sin(a0) * sg], n1 = [Math.cos(a1) * sg, 0, Math.sin(a1) * sg]; T.quad(pol(r, a0, y0 - 0.1), pol(r, a1, y1 - 0.1), pol(r, a1, y1 + 0.4), pol(r, a0, y0 + 0.4), [n0, n1, n1, n0]); }
        }
        T.into(b, 'int', PLASTER);
        for (let i = 0; i < SN; i++) { // balustrade glass and the rail on the open side
            const a0 = lerp(St.a0, St.a1, i / SN), a1 = lerp(St.a0, St.a1, (i + 1) / SN), y0 = stairY(a0) + 0.28, y1 = stairY(a1) + 0.28, r = St.r1 + 0.025, n0 = pol(1, a0), n1 = pol(1, a1);
            T.quad(pol(r, a0, y0), pol(r, a1, y1), pol(r, a1, y1 + 0.85), pol(r, a0, y0 + 0.85), [n0, n1, n1, n0]).into(b, 'gBal', '#ffffff');
            b.rod(pol(r, a0, y0 + 0.87), pol(r, a1, y1 + 0.87), 0.028, '#a8763f', 'int', 6); b.rod(pol(St.r0 + 0.07, a0, y0 + 0.62), pol(St.r0 + 0.07, a1, y1 + 0.62), 0.024, '#a8763f', 'int', 6);
        }
        // the wall under the flight on the lower level
        for (let i = 0; i < SN; i++) { const a0 = lerp(St.a0, St.a1, i / SN), a1 = lerp(St.a0, St.a1, (i + 1) / SN), n0 = pol(1, a0), n1 = pol(1, a1), r = St.r1 + 0.05; T.quad(pol(r, a0, YL), pol(r, a1, YL), pol(r, a1, stairY(a1) - 0.22), pol(r, a0, stairY(a0) - 0.22), [n0, n1, n1, n0]); }
        { const c = Math.cos(St.a1), s = Math.sin(St.a1); T.quad([c * St.r0, YL, s * St.r0], [c * (St.r1 + 0.05), YL, s * (St.r1 + 0.05)], [c * (St.r1 + 0.05), YD - 0.3, s * (St.r1 + 0.05)], [c * St.r0, YD - 0.3, s * St.r0], [-s, 0, c]); }
        T.into(b, 'int', WOOD);
    }
    // name of the bar on the core wall beside it (painted letters; typeface estimated)
    { const a = L.bar.a0 - 0.13, s = textPlane('THE LOUPE LOUNGE', 1.9, 0.3, { bg: '#5b3d26', fg: '#f3e6cf', glow: true, font: (q) => `600 ${q}px "Helvetica Neue", Helvetica, Arial, sans-serif` }), [x, , z] = pol(L.coreR + 0.07, a); s.position.set(x, YL + 2.6, z); s.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); s.name = 'needle-sign-loupe'; grp.add(s); }

    // ================= 520 ft: observation level
    const St = L.stair, inVoid = (a) => { const d = ((a - St.a0) % TAU + TAU) % TAU; return d < St.a1 - St.a0; };
    for (let k = 0; k < N; k++) { // indoor floor with the stair opening left out
        const a0 = k / N * TAU, a1 = (k + 1) / N * TAU, mid = (a0 + a1) / 2;
        if (inVoid(mid)) { T.quad(pol(L.coreR, a0, YD), pol(L.coreR, a1, YD), pol(St.r0, a1, YD), pol(St.r0, a0, YD), [0, 1, 0]); T.quad(pol(St.r1 + 0.05, a0, YD), pol(St.r1 + 0.05, a1, YD), pol(L.deckInR, a1, YD), pol(L.deckInR, a0, YD), [0, 1, 0]); }
        else T.quad(pol(L.coreR, a0, YD), pol(L.coreR, a1, YD), pol(L.deckInR, a1, YD), pol(L.deckInR, a0, YD), [0, 1, 0]);
    }
    T.into(b, 'gloss', '#c9c6be');
    lathe(T, [[L.deckOutR + 0.12, YD - 0.012], [L.deckInR, YD - 0.012]], N).into(b, 'int', '#a9aaa6');          // open-air deck paving
    lathe(T, [[L.coreR, L.deckCeil], [L.deckInR, L.deckCeil]], N).into(b, 'int', PLASTER);                        // ceiling
    lathe(T, [[L.coreR, YD], [L.coreR, L.deckCeil]], N).into(b, 'int', PLASTER);                                  // core wall
    sector(T, L.coreR, L.coreR + 0.03, 0, TAU, YD, YD + 0.12, N).into(b, 'int', WOOD);
    { const busy = [[L.cafe.a0, L.cafe.a1], [L.wine.a0, L.wine.a1], ...L.elAz.map((e) => [e - 0.26, e + 0.26])], free = (a) => !busy.some(([a0, a1]) => { const d = ((a - a0) % TAU + TAU) % TAU; return d <= a1 - a0; });
        for (let i = 0; i < 180; i++) { const a = i / 180 * TAU; if (free(a) && free(a + 0.02) && free(a - 0.02)) sector(T, L.coreR, L.coreR + 0.04, a - 0.011, a + 0.011, YD + 0.12, L.deckCeil - 0.15); } T.into(b, 'int', '#b4854f');
        for (const mid of [53, 127, 177, 243].map((d) => d * DEG)) { sector(T, L.coreR + 0.04, L.coreR + 0.5, mid - 0.13, mid + 0.13, YD + 0.38, YD + 0.46, 6).into(b, 'int', '#a97a48'); for (const k of [-1, 1]) sector(T, L.coreR + 0.08, L.coreR + 0.44, mid + k * 0.11 - 0.006, mid + k * 0.11 + 0.006, YD, YD + 0.38).into(b, 'steel', '#c9ccce'); } }
    { // balustrade round the stair opening (open at the head of the flight)
        const r = St.r1 + 0.05, n = 18;
        for (let i = 0; i < n; i++) { const a0 = lerp(St.a0, St.a1 - 0.02, i / n), a1 = lerp(St.a0, St.a1 - 0.02, (i + 1) / n), n0 = pol(1, a0), n1 = pol(1, a1); T.quad(pol(r, a0, YD), pol(r, a1, YD), pol(r, a1, YD + 1.07), pol(r, a0, YD + 1.07), [n0, n1, n1, n0]); b.rod(pol(r, a0, YD + 1.09), pol(r, a1, YD + 1.09), 0.028, '#a8763f', 'int', 6); }
        const c = Math.cos(St.a0), s = Math.sin(St.a0); T.quad([c * St.r0, YD, s * St.r0], [c * r, YD, s * r], [c * r, YD + 1.07, s * r], [c * St.r0, YD + 1.07, s * St.r0], [s, 0, -c]);
        T.into(b, 'gBal', '#ffffff');
    }
    // glazed wall of the room: 48 panels with four timber door portals to the open deck
    const dHalf = L.doorHalf / L.deckInR;
    for (let i = 0; i < 48; i++) {
        const a0 = i / 48 * TAU, a1 = (i + 1) / 48 * TAU, mid = (a0 + a1) / 2, inDoor = L.doorAz.some((d) => Math.abs(Math.atan2(Math.sin(mid - d), Math.cos(mid - d))) < dHalf + 0.02);
        if (inDoor) continue;
        lathe(T, [[L.deckInR, YD], [L.deckInR, L.deckCeil]], 2, a0, a1).into(b, 'gWall', '#ffffff');
        b.rod(pol(L.deckInR, a0, YD), pol(L.deckInR, a0, L.deckCeil), 0.035, '#d9dbd8', 'steel', 4);
    }
    for (const d of L.doorAz) {
        for (const sg of [-1, 1]) sector(T, L.deckInR - 0.11, L.deckInR + 0.11, d + sg * dHalf - 0.008, d + sg * dHalf + 0.008, YD, YD + 2.45);
        sector(T, L.deckInR - 0.11, L.deckInR + 0.11, d - dHalf - 0.008, d + dHalf + 0.008, YD + 2.45, YD + 2.62, 4); T.into(b, 'int', '#9a6d3c');
        lathe(T, [[L.deckInR, YD + 2.62], [L.deckInR, L.deckCeil]], 4, d - dHalf, d + dHalf);
        for (const sg of [-1, 1]) lathe(T, [[L.deckInR, YD], [L.deckInR, L.deckCeil]], 2, d + sg * dHalf, d + sg * TAU / 48); // sidelights out to the next mullion
        T.into(b, 'gWall', '#ffffff');
    }
    sector(T, L.coreR + 0.02, L.coreR + 0.12, 0, TAU, L.deckCeil - 0.07, L.deckCeil - 0.02, N).into(b, 'glow', '#fff0d8');
    for (const [r, n] of [[8.6, 24], [11.4, 36]]) for (let i = 0; i < n; i++) { const [x, , z] = pol(r, (i + 0.5) / n * TAU); b.cyl(x, L.deckCeil - 0.03, z, 0.075, 0.025, '#fff4e0', 'glow', 8); }
    for (let i = 0; i < 48; i++) { const [x, , z] = pol(14.6, (i + 0.5) / 48 * TAU); b.cyl(x, L.deckCeil - 0.03, z, 0.06, 0.025, '#fff4e0', 'glow', 6); } // soffit lights over the open deck
    // ---- Atmos Cafe (south): counter, glass pastry case, coffee machine, till, menu boards
    { const C = L.cafe, n = 22;
        sector(T, C.r0, C.r1, C.a0, C.a1, YD, YD + 0.92, n).into(b, 'int', PLASTER);
        sector(T, C.r1, C.r1 + 0.02, C.a0 + 0.02, C.a1 - 0.02, YD + 0.1, YD + 0.86, n).into(b, 'int', WOOD);
        sector(T, C.r0 - 0.05, C.r1 + 0.08, C.a0 - 0.01, C.a1 + 0.01, YD + 0.92, YD + 0.97, n).into(b, 'gloss', STONE);
        const mid = (C.a0 + C.a1) / 2;
        sector(T, C.r0 + 0.1, C.r1 - 0.05, mid - 0.2, mid + 0.02, YD + 0.97, YD + 1.02, 6).into(b, 'steel', '#c9ccce');
        lathe(T, [[C.r1 - 0.05, YD + 1.02], [C.r1 - 0.12, YD + 1.42], [C.r0 + 0.1, YD + 1.42]], 6, mid - 0.2, mid + 0.02).into(b, 'gBal', '#ffffff');
        for (let i = 0; i < 9; i++) { const [x, , z] = pol((C.r0 + C.r1) / 2 + 0.05, mid - 0.185 + i * 0.024); b.cyl(x, YD + 1.02, z, 0.07, 0.05, ['#c98d4b', '#e7c58a', '#7a4a2a'][i % 3], 'int', 8); }
        { const [x, , z] = pol((C.r0 + C.r1) / 2, mid + 0.14); b.box(x, YD + 0.97, z, 0.7, 0.46, 0.5, '#c9ccce', 'steel', yawX(-Math.sin(mid + 0.14), Math.cos(mid + 0.14))); b.box(x, YD + 1.43, z, 0.72, 0.05, 0.52, '#2a2c2e', 'int', yawX(-Math.sin(mid + 0.14), Math.cos(mid + 0.14))); }
        { const [x, , z] = pol((C.r0 + C.r1) / 2, mid + 0.3); b.box(x, YD + 0.97, z, 0.32, 0.3, 0.3, '#2a2c2e', 'int', yawX(-Math.sin(mid + 0.3), Math.cos(mid + 0.3))); }
        sector(T, L.coreR + 0.02, L.coreR + 0.55, C.a0 + 0.03, C.a1 - 0.03, YD, YD + 0.9, n).into(b, 'int', PLASTER);
        sector(T, L.coreR + 0.02, L.coreR + 0.58, C.a0 + 0.03, C.a1 - 0.03, YD + 0.9, YD + 0.94, n).into(b, 'gloss', STONE);
        const menu = (text, a, w) => { const s = textPlane(text, w, 0.62, { bg: '#20262b', fg: '#f4efe4', glow: true, maxLines: 4, font: (q) => `500 ${q}px "Helvetica Neue", Helvetica, Arial, sans-serif` }), [x, , z] = pol(L.coreR + 0.05, a); s.position.set(x, YD + 2.05, z); s.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); s.name = 'needle-sign-menu'; grp.add(s); };
        menu('ATMOS CAFE', mid, 1.5); menu('COFFEE · ESPRESSO · TEA · HOT CHOCOLATE', mid - 0.3, 1.5); menu('SANDWICHES · SALADS · PASTRIES · ICE CREAM', mid + 0.3, 1.5);
    }
    // ---- Atmos Wine Bar (west): timber counter, wine wall, stools
    { const W = L.wine, n = 16;
        sector(T, W.r0, W.r1, W.a0, W.a1, YD, YD + 1.03, n).into(b, 'int', WOOD);
        sector(T, W.r0 - 0.05, W.r1 + 0.08, W.a0 - 0.01, W.a1 + 0.01, YD + 1.03, YD + 1.08, n).into(b, 'gloss', '#2c2a28');
        sector(T, L.coreR + 0.02, L.coreR + 0.07, W.a0 + 0.03, W.a1 - 0.03, YD + 0.3, YD + 2.6, n).into(b, 'int', WOOD_D);
        for (let j = 0; j < 7; j++) for (let i = 0; i < 26; i++) { const a = lerp(W.a0 + 0.06, W.a1 - 0.06, i / 25), [x, , z] = pol(L.coreR + 0.14, a); b.cyl(x, YD + 0.5 + j * 0.3, z, 0.04, 0.16, ['#3a1a22', '#243a26', '#40301c'][(i + j) % 3], 'gloss', 6, 1, Math.PI / 2, -a + Math.PI / 2, 0); }
        sector(T, L.coreR + 0.07, L.coreR + 0.09, W.a0 + 0.03, W.a1 - 0.03, YD + 2.6, YD + 2.66, n).into(b, 'glow', '#ffcf94');
        for (let i = 0; i < W.stools; i++) { const [x, , z] = pol(W.r1 + 0.5, lerp(W.a0 + 0.07, W.a1 - 0.07, i / (W.stools - 1))); stool(b, x, YD, z, '#f1f0eb'); }
        const a = (W.a0 + W.a1) / 2, s = textPlane('ATMOS WINE BAR', 1.7, 0.28, { bg: '#5b3d26', fg: '#f3e6cf', glow: true, font: (q) => `600 ${q}px "Helvetica Neue", Helvetica, Arial, sans-serif` }), [x, , z] = pol(L.coreR + 0.1, a); s.position.set(x, YD + 2.85, z); s.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); s.name = 'needle-sign-wine'; grp.add(s);
    }
    // white tables and chairs by the glass
    for (const t of L.deckTables) { const [x, , z] = pol(t.r, t.az); table(b, x, YD, z); for (const k of [-1, 1]) { const a = t.az + k * 0.062, [cx, , cz] = pol(t.r, a); chair(b, cx, YD, cz, -t.az + (k > 0 ? Math.PI : 0)); } }
    // ---- open deck: 24 inclined glass benches against the barrier
    for (let i = 0; i < L.benches; i++) {
        const a = (i + 0.5) / L.benches * TAU, hw = 0.85 / 15.9;
        T.quad(pol(15.5, a - hw, YD + 0.5), pol(15.5, a + hw, YD + 0.5), pol(16.35, a + hw, YD + 0.4), pol(16.35, a - hw, YD + 0.4), [0, 1, 0]);
        T.quad(pol(15.5, a - hw, YD + 0.46), pol(15.5, a + hw, YD + 0.46), pol(16.35, a + hw, YD + 0.36), pol(16.35, a - hw, YD + 0.36), [0, -1, 0]);
        T.into(b, 'gBal', '#ffffff');
        for (const k of [-1, 1]) { const [x, , z] = pol(15.6, a + k * hw * 0.8); b.box(x, YD, z, 0.05, 0.47, 0.05, '#c9ccce', 'steel', -a); }
        b.rod(pol(15.5, a - hw, YD + 0.48), pol(15.5, a + hw, YD + 0.48), 0.022, '#d7dadb', 'steel', 5);
    }
    const built = b.build('needle-interior', { castShadow: false, matOverrides: Mt });
    grp.add(built);

    // ================= the turntable: the revolving glass floor and the lounge seating that rides on it
    const turn = new THREE.Group(); turn.name = 'needle-turntable';
    const tb = new GeoBatch();
    lathe(T, [[L.turnR1, YL + 0.02], [L.turnR0, YL + 0.02]], N).into(tb, 'gFloor', '#ffffff');
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; sector(T, L.turnR0, L.turnR1, a - 0.0016, a + 0.0016, YL - 0.06, YL + 0.026); } T.into(tb, 'gloss', '#e4e6e4');
    for (const r of [L.turnR0 + 0.03, L.turnR1 - 0.03]) sector(T, r - 0.03, r + 0.03, 0, TAU, YL - 0.06, YL + 0.027, N); T.into(tb, 'gloss', '#e4e6e4');
    for (let i = 0; i < L.loupeTables; i++) { const a = (i + 0.5) / L.loupeTables * TAU, [x, , z] = pol(L.loupeTableR, a); table(tb, x, YL + 0.02, z, 0.36); for (const k of [-1, 1]) { const ca = a + k * 0.066, [cx, , cz] = pol(L.loupeTableR, ca); chair(tb, cx, YL + 0.02, cz, -a + (k > 0 ? Math.PI : 0), '#ece8df'); } }
    turn.add(tb.build('needle-turntable-parts', { castShadow: false, matOverrides: Mt }));
    grp.add(turn);
    return turn;
}

// ---------------------------------------------------------------------------- elevator cab
function buildCab(Mt, hi) {
    const cab = new THREE.Group(), b = new GeoBatch(), T = new Tris(), W = 1.05, GOLD = '#d6ad52';
    if (!hi) { b.box(0, -0.4, 0, 2.05, 3.7, 2.1, GOLD, 'gold'); cab.add(b.build('needle-cab', { matOverrides: Mt })); return cab; }
    // plan: flat back with the doors at x = -1 (core side), straight flanks, half-round glazed front (+x = outward)
    const body = (y0, y1, k, key, col) => { b.box(-0.5 * k, y0, 0, 1.0 * k, y1 - y0, 2 * W * k, col, key); sector(T, 0, W * k, -Math.PI / 2, Math.PI / 2, y0, y1, 12).into(b, key, col); };
    body(-0.5, 0.06, 1, 'gold', GOLD); body(-0.78, -0.5, 0.8, 'gold', '#b8923f'); body(2.72, 3.2, 1, 'gold', GOLD); body(3.2, 3.48, 0.8, 'gold', '#b8923f');
    b.sphere(0, -0.78, 0, 0.55, 0.3, 0.55, '#a8853a', 'gold', 12, 6); b.sphere(0, 3.48, 0, 0.55, 0.3, 0.55, '#a8853a', 'gold', 12, 6);
    lathe(T, [[W - 0.02, 0.06], [W - 0.02, 2.72]], 14, -Math.PI / 2, Math.PI / 2);
    for (const sg of [-1, 1]) T.quad([-1, 0.06, (W - 0.02) * sg], [0, 0.06, (W - 0.02) * sg], [0, 2.72, (W - 0.02) * sg], [-1, 2.72, (W - 0.02) * sg], [0, 0, sg]);
    T.into(b, 'cabGlass', '#ffffff');
    for (const [x, z] of [[0, W - 0.03], [0, -W + 0.03], [-0.97, W - 0.03], [-0.97, -W + 0.03]]) b.box(x, 0.06, z, 0.07, 2.66, 0.07, GOLD, 'gold');
    for (const i of [-1, 1]) { const a = i * 0.62, [x, , z] = pol(W - 0.02, a); b.box(x, 0.06, z, 0.03, 2.66, 0.03, GOLD, 'gold', -a); }
    // the back of the car: brushed doors in a frame, the control panel, the floor indicator
    b.box(-1.0, 0.06, 0, 0.07, 2.66, 2 * W - 0.06, '#8f9498', 'steel');
    for (const sg of [-1, 1]) b.box(-0.955, 0.08, 0.46 * sg, 0.03, 2.1, 0.9, '#c9cdd0', 'steel');
    b.box(-0.95, 0.08, 0, 0.035, 2.1, 0.015, '#2a2c2e', 'dark'); b.box(-0.95, 2.18, 0, 0.04, 0.1, 1.9, '#2a2c2e', 'dark');
    b.box(-0.945, 2.32, 0, 0.02, 0.12, 0.34, '#ffd48a', 'glow'); b.box(-0.945, 1.0, 0.96, 0.03, 0.42, 0.14, '#2a2c2e', 'dark');
    for (let i = 0; i < 3; i++) b.box(-0.925, 1.08 + i * 0.11, 0.96, 0.012, 0.045, 0.045, '#bfe3ff', 'glow');
    b.box(-0.5, 0.06, 0, 1.0, 0.05, 2 * W - 0.1, '#33363a', 'dark'); sector(T, 0, W - 0.05, -Math.PI / 2, Math.PI / 2, 0.06, 0.11, 12).into(b, 'dark', '#33363a');
    b.cyl(-0.1, 2.68, 0, 0.62, 0.035, '#fff3da', 'glow', 20); // ceiling light
    { const pts = []; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; pts.push(pol(W - 0.12, a, 1.0)); } b.tube(pts, 0.022, '#d7dadb', 'steel', 6); }
    const m = b.build('needle-cab', { matOverrides: Mt }); cab.add(m);
    return cab;
}

// ---------------------------------------------------------------------------- the tower
/**
 * @param {{detail?: number, cabs?: boolean, interior?: boolean}} o  detail >= 1: every member; < 1: the distant model.
 *        interior: clear glazing with the two public levels fitted out (the visit scene).
 * @returns {THREE.Group} userData { levels, layout, elevators[], loupe (turntable), night(k), update(dt) }
 */
export function spaceNeedleModel({ detail = 1, cabs = true, interior = false } = {}) {
    const hi = detail >= 1, grp = new THREE.Group(); grp.name = 'space-needle';
    const Mt = makeMaterials(interior), b = new GeoBatch(), T = new Tris();
    buildStructure(b, T, hi);
    buildTopHouse(b, T, hi, interior);
    const shell = b.build('needle-structure', { matOverrides: Mt });
    shell.traverse((o) => { if (!o.isMesh) return; const k = o.name.split(':')[1]; o.castShadow = hi && !['gWall', 'gBar', 'halo', 'band', 'sky', 'dark', 'core'].includes(k); o.receiveShadow = hi; if (k === 'gWall') o.renderOrder = 4; if (k === 'gBar') o.renderOrder = 6; if (k === 'halo') o.renderOrder = 5; });
    grp.add(shell);
    let turn = null;
    if (interior) {
        turn = buildInterior(grp, Mt);
        grp.traverse((o) => { if (!o.isMesh) return; const k = o.name.split(':')[1]; if (k === 'gFloor') o.renderOrder = 2; if (k === 'gBal') o.renderOrder = 3; if (k === 'gWall') o.renderOrder = 4; });
    }
    bakeFlood(grp, floodLights());
    // ---- elevators: three cars between the leg pairs, 520 ft in 41 s
    const elevators = [], TOP = NEEDLE.deckY, BOT = NEEDLE.cabBaseY;
    if (cabs) EL_AZ.forEach((a, k) => {
        const cab = buildCab(Mt, hi); cab.name = 'needle-elevator-' + k;
        const y = [BOT, TOP, 80][k]; cab.position.set(Math.cos(a) * NEEDLE.cabR, y, Math.sin(a) * NEEDLE.cabR); cab.rotation.y = -a;
        cab.traverse((o) => { if (o.isMesh) { o.castShadow = false; if (o.material === Mt.cabGlass) o.renderOrder = 7; } });
        grp.add(cab); elevators.push({ cab, a, y, dir: k === 1 ? -1 : 1, hold: k === 2 ? 0 : 6 + k * 9 });
    });
    // ---- night: the halo's ring of lights and the aircraft beacon
    const ringM = new THREE.MeshBasicMaterial({ color: '#fff3dc', toneMapped: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(21.05, 0.09, 5, hi ? 144 : 48), ringM); halo.rotation.x = Math.PI / 2; halo.position.y = 157.1; halo.visible = false; halo.name = 'needle-halo-lights'; grp.add(halo);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false })); beacon.position.y = 184.7; beacon.name = 'needle-beacon'; grp.add(beacon);
    let nightK = 0, t = 0;
    grp.userData = {
        levels: { skyline: NEEDLE.skyline, loupe: NEEDLE.loupeY, deck: NEEDLE.deckY, top: NEEDLE.top },
        layout: NEEDLE, elevators, loupe: turn, materials: Mt,
        night: (k) => { nightK = k; halo.visible = k > 0.3; Mt.int.emissiveIntensity = Mt.gloss.emissiveIntensity = 0.1 + 0.42 * k; },
        /** the cars run base to observation level in about 41 s (3.7 m/s) and wait at each end; a pinned car is driven by the ride */
        update(dt) {
            t += dt; beacon.visible = nightK < 0.2 || Math.floor(t * 0.7) % 2 === 0;
            for (const e of elevators) {
                if (e.pinned) { e.cab.position.y = e.y; continue; }
                if (e.hold > 0) { e.hold -= dt; continue; }
                e.y += e.dir * 3.73 * dt; if (e.y > TOP) { e.y = TOP; e.dir = -1; e.hold = 20; } else if (e.y < BOT) { e.y = BOT; e.dir = 1; e.hold = 20; }
                e.cab.position.y = e.y;
            }
        },
    };
    return grp;
}

// ---------------------------------------------------------------------------- base pavilion (visit scene only)
/**
 * The glazed pavilion round the foot of the tower (2000): a storefront ring out to the OSM footprint (r 18.9 m) under a
 * flat roof, and a taller glazed drum (OSM r 9.4 m) round the core where the elevators board. Heights are read from
 * Street View (ESTIMATE). Returns a Group at y = 0 = plaza level; userData.night(k).
 */
export function needlePavilion() {
    const L = NEEDLE, grp = new THREE.Group(); grp.name = 'needle-pavilion';
    const S = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    const Mt = {
        pGlass: glassPatch(S({ roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.84, depthWrite: false, envMapIntensity: 1.6, emissive: new THREE.Color('#ffd9a6'), emissiveIntensity: 0 }), 0.9),
        dGlass: glassPatch(S({ roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.7, emissive: new THREE.Color('#ffe2b8'), emissiveIntensity: 0 }), 0.75),
        pInt: litPatch(S({ roughness: 0.8, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 })),
    };
    Mt.pGlass.userData.nightEmissive = 0.07; Mt.dGlass.userData.nightEmissive = 0.06; Mt.pGlass.forceSinglePass = Mt.dGlass.forceSinglePass = true;
    for (const k in Mt) Mt[k].name = 'needle-' + k;
    const b = new GeoBatch(), T = new Tris(), N = 96, H = L.pavH, FR = '#d9dcda', door = 90 * DEG, dHalf = TAU / 48;
    // storefront: 48 panels of green-tinted glass on a low kerb, a transom, grey fascia with a small overhang
    for (let i = 0; i < 48; i++) {
        const a0 = i / 48 * TAU, a1 = (i + 1) / 48 * TAU, mid = (a0 + a1) / 2, isDoor = Math.abs(Math.atan2(Math.sin(mid - door), Math.cos(mid - door))) < dHalf;
        lathe(T, [[L.pavR, isDoor ? 2.5 : 0.25], [L.pavR, H]], 2, a0, a1).into(b, 'pGlass', isDoor ? '#31504c' : '#1c322f');
        const y0 = Math.abs(a0 - door) < 0.01 ? 2.5 : 0.25; b.box(...pol(L.pavR + 0.02, a0, y0), 0.09, H - y0, 0.14, FR, 'metal', -a0);
    }
    sector(T, L.pavR - 0.12, L.pavR + 0.08, 0, TAU, 0, 0.25, N).into(b, 'concrete', '#9c9a94');
    sector(T, L.pavR - 0.02, L.pavR + 0.07, 0, TAU, 2.5, 2.62, N).into(b, 'metal', FR);
    sector(T, L.drumR - 0.2, L.pavR + 0.55, 0, TAU, H, H + 0.5, N).into(b, 'paint', '#cfd2d0');
    lathe(T, [[L.pavR + 0.5, H + 0.58], [L.drumR - 0.2, H + 0.58]], N).into(b, 'roofs', '#8d9194');
    // entrance (south, where OSM footway 1136496123 meets the footprint): open doorway in a steel portal
    for (const sg of [-1, 1]) b.box(...pol(L.pavR + 0.03, door + sg * dHalf, 0), 0.16, 2.5, 0.22, '#3a3f42', 'metal', -door);
    b.box(...pol(L.pavR + 0.03, door, 2.5), 0.22, 0.16, 5.1, '#3a3f42', 'metal', -door);
    // what shows through the glass: floor, a back wall round the drum, display plinths
    lathe(T, [[L.pavR - 0.1, 0.03], [L.drumR, 0.03]], N).into(b, 'pInt', '#b9b4aa');
    lathe(T, [[L.drumR + 0.6, 0.03], [L.drumR + 0.6, H]], N).into(b, 'pInt', '#e9e4d8');
    for (let i = 0; i < 18; i++) { const a = (i + 0.5) / 18 * TAU; if (L.legAz.some((l) => Math.abs(Math.atan2(Math.sin(a - l), Math.cos(a - l))) < 0.3)) continue; const [x, , z] = pol(16.4, a); b.box(x, 0.03, z, 2.4, 1.1 + (i % 3) * 0.3, 0.8, ['#d9d2c2', '#2f4858', '#b0483a'][i % 3], 'pInt', -a + Math.PI / 2); }
    for (let i = 0; i < 48; i++) { const [x, , z] = pol(17.2, (i + 0.5) / 48 * TAU); b.cyl(x, H - 0.06, z, 0.09, 0.04, '#fff0d2', 'glow', 6); }
    // upper drum: glass leaning in to a white cap; open in the middle where the core and the three cars pass
    lathe(T, [[L.drumR, H + 0.5], [8.35, L.drumTop]], N).into(b, 'dGlass', '#7fa6a8');
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; b.rod(pol(L.drumR + 0.02, a, H + 0.5), pol(8.37, a, L.drumTop), 0.05, FR, 'metal', 4); }
    lathe(T, [[8.25, L.drumTop], [8.6, L.drumTop], [8.6, L.drumTop + 0.55], [L.shaftR, L.drumTop + 0.55], [L.shaftR, L.drumTop]], N).into(b, 'paint', '#eef0ec');
    lathe(T, [[L.shaftR, L.drumTop], [8.25, L.drumTop]], N).into(b, 'pInt', '#f1efe9');
    lathe(T, [[L.drumR - 0.3, H + 0.5], [3.4, H + 0.5]], N).into(b, 'pInt', '#c9c4b8'); // boarding level
    const built = b.build('needle-pavilion', { matOverrides: Mt });
    built.traverse((o) => { if (!o.isMesh) return; const k = o.name.split(':')[1]; if (k === 'pGlass' || k === 'dGlass') { o.castShadow = false; o.renderOrder = 3; } });
    grp.add(built);
    // name over the doorway (white capitals on the glass, as on Street View)
    const sign = textPlane('SPACE NEEDLE · SEATTLE CENTER', 5.0, 0.32, { bg: 'rgba(0,0,0,0)', fg: '#f4f6f4', transparent: true, glow: true, ppm: 110, font: (q) => `600 ${q}px "Futura", "Century Gothic", "Helvetica Neue", sans-serif` });
    sign.position.set(...pol(L.pavR + 0.12, door, 3.25)); sign.rotation.y = Math.atan2(Math.cos(door), Math.sin(door)); sign.name = 'needle-sign-entrance'; grp.add(sign);
    grp.userData = { night: (k) => { Mt.pInt.emissiveIntensity = 0.12 + 0.34 * k; }, materials: Mt };
    return grp;
}
