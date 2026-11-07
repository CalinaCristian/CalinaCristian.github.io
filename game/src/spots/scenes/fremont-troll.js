// ============================================================================
//  Fremont Troll (Steve Badanes, Will Martin, Donna Walter, Ross Whitehead, 1990)
//  — the owner's favourite. Modelled in 3-D from the research description and
//  dimensions (R15.7: no photo textures; artists credited on the plaque):
//  head, shoulders and two hands emerging from the ground under the concrete
//  arches of the Aurora Bridge's north approach, the viewer-left hand splayed
//  flat, the viewer-right hand clamping a (grey-painted) VW Beetle, one hubcap
//  eye, the other hidden under the hair; stairs on the right, boulders around.
//  Climbable (hand, Beetle, shoulders, head via the slope behind).
//  Local frame: x east, z south, y up; origin = research spawn on Troll Ave N.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, mat, textPlane, canvas, canvasTexture, inPoly, smooth, clamp, headingFromBearing, fitDraw } from '../kit.js';
import { meshSDF, sdfHeightmap, sdEllipsoid, sdCapsule, sdSphere, sdBox, smin, smax, noise3, fbm3 } from '../sdf.js';
import { addTraffic } from '../cars.js';
import { bench } from '../osm.js';
import { seaActivity } from './sea-common.js';

// ---------------------------------------------------------------------------- site constants (local metres)
const TX = -3.0, TZ = -50.0, TY = 4.0;           // troll base centre (OSM node n2485251324 ≈ (−1.1, −49.8); centred in its arch bay)
const COLS = [-19.5, -8.75, 2.75];               // bridge column lines (x): west bay + the troll's bay
const DECK = { x0: -20.6, x1: 3.9 };             // deck edges (Aurora Bridge 21.3 m + sidewalks)
const BENTS = []; for (let z = -88; z <= 190; z += 15) BENTS.push(z); // transverse bents; −43 frames the Troll
const UNDER = (z) => 13.5 + 0.025 * (z + 43);    // deck underside height (rises south toward the canal)
const N36 = [[-102, -61], [-93, -59], [-57, -50], [-23, -42], [-16, -41], [-4, -38.4], [4, -36.4], [40, -29], [82, -20], [180, 1]];

// ============================================================================
//  The Troll — SDF sculpt (troll-local: origin at base centre, +z toward the viewer/south, +x viewer's right)
// ============================================================================
export function trollSDF() {
    // limb groups with bounding spheres (skip far groups → fast)
    const E = sdEllipsoid, C = sdCapsule, S = sdSphere;
    const fingersL = [[-4.3, -0.55], [-3.68, -0.24], [-3.08, 0.06], [-2.52, 0.34]];
    const fingersR = [2.02, 2.48, 2.94, 3.4];
    const hairStrand = (x, y, z) => { const w = noise3(x * 1.1, y * 0.45, z * 1.1) * 1.8; return 0.65 * noise3(x * 5.2 + w, y * 0.9, z * 5.2 - w) + 0.35 * noise3(x * 11 - w, y * 1.6, z * 11 + w); };
    // bounding-sphere gate: a group is evaluated only when it can affect the result (no creases at gate borders)
    const far = (x, y, z, cx, cy, cz, R, d) => { const dx = x - cx, dy = y - cy, dz = z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz) - R > d + 0.7; };
    const skin = (x, y, z) => {
        let d = 1e9;
        // head: skull + face, brow, cheeks, nose, lips
        if (!far(x, y, z, 0.15, 4.0, 0.6, 2.2, 0.8)) {
            let h = E(x, y, z, 0.15, 4.08, 0.12, 1.34, 1.42, 1.2);
            h = smin(h, E(x, y, z, 0.18, 3.78, 0.7, 1.08, 1.0, 0.75), 0.3);
            h = smin(h, C(x, y, z, -0.75, 4.55, 0.98, 0.95, 4.58, 0.98, 0.21), 0.18);
            h = smin(h, S(x, y, z, -0.62, 3.72, 1.05, 0.42), 0.2);
            h = smin(h, S(x, y, z, 0.88, 3.72, 1.05, 0.42), 0.2);
            h = smax(h, -S(x, y, z, -0.45, 4.3, 1.2, 0.2), 0.08);
            h = smax(h, -S(x, y, z, 0.64, 4.3, 1.24, 0.24), 0.08);
            // nose: long drooping bulb
            let n = C(x, y, z, 0.14, 4.38, 1.18, 0.15, 3.8, 1.82, 0.2, 0.27);
            n = smin(n, S(x, y, z, 0.15, 3.66, 1.9, 0.36), 0.18);
            n = smin(n, S(x, y, z, -0.14, 3.6, 1.72, 0.2), 0.1);
            n = smin(n, S(x, y, z, 0.45, 3.6, 1.72, 0.2), 0.1);
            h = smin(h, n, 0.12);
            // lips + mouth groove
            h = smin(h, C(x, y, z, -0.38, 3.12, 1.24, 0.66, 3.12, 1.24, 0.13), 0.1);
            h = smax(h, -C(x, y, z, -0.32, 3.25, 1.39, 0.6, 3.25, 1.39, 0.055), 0.04);
            d = Math.min(d, h);
        }
        // viewer-left hand (troll's right): palm + 4 knobbly splayed fingers + thumb
        if (!far(x, y, z, -3.3, 0.5, 3.2, 2.4, 0.8)) {
            let h = E(x, y, z, -3.42, 0.45, 2.42, 0.98, 0.42, 0.82);
            for (const [xb, dx] of fingersL) {
                const k1 = [xb + dx * 0.15, 0.55, 3.0], k2 = [xb + dx * 0.55, 0.55, 3.8], k3 = [xb + dx, 0.24, 4.55];
                let f = C(x, y, z, ...k1, ...k2, 0.3, 0.27); f = Math.min(f, C(x, y, z, ...k2, ...k3, 0.27, 0.23));
                f = smin(f, S(x, y, z, ...k2, 0.31), 0.08); f = smin(f, S(x, y, z, ...k1, 0.32), 0.08); f = smin(f, S(x, y, z, k3[0], 0.25, k3[2], 0.23), 0.06);
                h = smin(h, f, 0.14);
            }
            let t = C(x, y, z, -2.75, 0.42, 2.25, -2.1, 0.36, 2.75, 0.27, 0.24); t = smin(t, C(x, y, z, -2.1, 0.36, 2.75, -1.62, 0.17, 3.12, 0.24, 0.2), 0.08);
            h = smin(h, t, 0.15);
            if (h < 0.3) h -= 0.03 * noise3(x * 6, y * 6, z * 6); // knobbly ferro-cement
            d = Math.min(d, h);
        }
        // viewer-right hand (troll's left) on the Beetle: back of the hand + 4 fingers hanging down + thumb
        if (!far(x, y, z, 2.9, 1.4, 2.7, 2.1, 0.8)) {
            let h = E(x, y, z, 2.78, 1.86, 2.3, 0.9, 0.42, 0.56);
            for (const xf of fingersR) {
                const k1 = [xf, 1.82, 2.74], k2 = [xf + 0.04, 1.36, 3.1], k3 = [xf + 0.08, 0.88, 3.22];
                let f = C(x, y, z, ...k1, ...k2, 0.25, 0.235); f = Math.min(f, C(x, y, z, ...k2, ...k3, 0.235, 0.205));
                f = smin(f, S(x, y, z, ...k2, 0.26), 0.05);
                h = smin(h, f, 0.06);
            }
            h = smin(h, C(x, y, z, 3.55, 1.86, 1.95, 4.0, 1.5, 2.3, 0.29, 0.25), 0.12);
            if (h < 0.3) h -= 0.03 * noise3(x * 6, y * 6, z * 6);
            d = Math.min(d, h);
        }
        return d;
    };
    const hair = (x, y, z) => {
        let d = 1e9;
        // body mass rising from the ground: torso, shoulders, neck
        d = E(x, y, z, 0.1, 1.15, -1.05, 3.25, 2.45, 2.45);
        d = smin(d, E(x, y, z, -2.1, 2.3, -0.4, 1.55, 1.25, 1.45), 0.5);
        d = smin(d, E(x, y, z, 2.25, 2.5, -0.5, 1.55, 1.25, 1.5), 0.5);
        d = smin(d, E(x, y, z, 0.15, 3.2, -0.62, 1.95, 1.6, 1.6), 0.5);
        // hair cap over the skull (face carved out) + side locks + fringe over the left eye
        if (!far(x, y, z, 0.15, 3.7, 0.0, 3.1, d)) {
            let hc = E(x, y, z, 0.15, 4.36, -0.12, 1.52, 1.42, 1.45);
            hc = smax(hc, -E(x, y, z, 0.28, 3.86, 1.36, 1.0, 1.18, 1.12), 0.15);
            hc = smin(hc, C(x, y, z, -1.22, 4.4, 0.3, -1.65, 1.9, 0.62, 0.48, 0.62), 0.3);
            hc = smin(hc, C(x, y, z, 1.45, 4.4, 0.3, 1.85, 1.9, 0.6, 0.48, 0.62), 0.3);
            hc = smin(hc, C(x, y, z, -0.1, 5.05, 0.75, -0.72, 4.02, 1.3, 0.32, 0.26), 0.25);
            d = smin(d, hc, 0.3);
        }
        // moustache + beard flowing down the chest to the ground
        if (!far(x, y, z, 0.15, 2.0, 1.1, 2.4, d)) {
            let b = C(x, y, z, 0.15, 3.36, 1.42, -0.72, 2.9, 1.22, 0.17, 0.2);
            b = smin(b, C(x, y, z, 0.15, 3.36, 1.42, 0.98, 2.9, 1.22, 0.17, 0.2), 0.1);
            b = smin(b, E(x, y, z, 0.15, 2.45, 0.98, 1.0, 1.05, 0.6), 0.2);
            b = smin(b, C(x, y, z, 0.15, 2.5, 1.12, 0.22, 0.45, 1.55, 0.78, 0.52), 0.35);
            d = smin(d, b, 0.25);
        }
        // arms (hair flows over them)
        {
            let a = C(x, y, z, -2.3, 2.55, -0.35, -3.3, 1.2, 0.7, 0.78, 0.62);
            a = smin(a, C(x, y, z, -3.3, 1.2, 0.7, -3.48, 0.55, 2.0, 0.62, 0.5), 0.25);
            d = smin(d, a, 0.35);
        }
        {
            let a = C(x, y, z, 2.4, 2.8, -0.6, 3.7, 2.4, 0.35, 0.8, 0.68);
            a = smin(a, C(x, y, z, 3.7, 2.4, 0.35, 3.0, 2.0, 1.95, 0.66, 0.55), 0.25);
            d = smin(d, a, 0.35);
        }
        // strands: vertical grooves + lumpy ferro-cement
        return d - 0.085 * hairStrand(x, y, z) - 0.02;
    };
    // the Beetle (beetle-local: front +z), under the right hand, nose slightly down, rear buried under the arm/body
    const BP = { x: 3.3, y: 0.04, z: 1.7, yaw: 0.32, pitch: -0.05 };
    const cy = Math.cos(BP.yaw), sy = Math.sin(BP.yaw), cp = Math.cos(BP.pitch), sp = Math.sin(BP.pitch);
    const toBeetle = (x, y, z) => {
        const dx = x - BP.x, dy = y - BP.y, dz = z - BP.z;
        const lx = dx * cy - dz * sy, lz0 = dx * sy + dz * cy;
        return [lx, dy * cp - lz0 * sp, dy * sp + lz0 * cp];
    };
    const beetle = (x, y, z) => {
        const [lx, ly, lz] = toBeetle(x, y, z);
        // body: rounded dome, slab sides; cabin; front fenders with headlights; rear fenders; bumper; front wheel
        let d = E(lx, ly, lz, 0, 0.72, -0.1, 0.78, 0.62, 2.02);
        d = smax(d, Math.abs(lx) - 0.7, 0.12);
        d = smin(d, E(lx, ly, lz, 0, 1.1, -0.42, 0.6, 0.47, 1.05), 0.22);
        d = smax(d, -sdBox(lx, ly, lz, 0, 1.24, 0.48, 0.48, 0.2, 0.06, 0.02), 0.03); // windscreen recess
        for (const s of [-1, 1]) {
            d = smin(d, E(lx, ly, lz, s * 0.6, 0.6, 1.2, 0.27, 0.37, 0.72), 0.2);
            d = smin(d, E(lx, ly, lz, s * 0.6, 0.6, -1.3, 0.28, 0.38, 0.66), 0.2);
        }
        d = smax(d, -C(lx, ly, lz, 0, 1.02, 0.62, 0, 0.66, 1.92, 0.025), 0.02); // trunk-lid seam
        d = smax(d, -C(lx, ly, lz, -0.5, 1.0, 0.6, 0.5, 1.0, 0.6, 0.02), 0.02);
        d = smax(d, -(ly - 0.26), 0.05); // flat floor pan
        d = Math.min(d, C(lx, ly, lz, -0.72, 0.33, 1.2, -0.62, 0.33, 1.2, 0.31));
        d = Math.min(d, C(lx, ly, lz, 0.62, 0.33, 1.2, 0.72, 0.33, 1.2, 0.31));
        return d - 0.008 * noise3(lx * 7, ly * 7, lz * 7);
    };
    const sdf = (x, y, z) => { const a = skin(x, y, z), b = hair(x, y, z), c = beetle(x, y, z); return Math.min(smin(a, b, 0.22), smin(c, Math.min(a, b) + 0.02, 0.06)); };
    return { sdf, skin, hair, beetle, hairStrand, BP, toBeetle };
}

function buildTroll(ctx) {
    const T = trollSDF();
    const lit = new THREE.Color('#c9c6bd'), mid = new THREE.Color('#aeaba3'), shadow = new THREE.Color('#84847f'), patch = new THREE.Color('#9aa2ae'), dirt = new THREE.Color('#8a7058');
    const bee = new THREE.Color('#b4b9c0'), beeShadow = new THREE.Color('#878d94'), chalk = new THREE.Color('#d8d6cf');
    const tmpA = new THREE.Color();
    const t0 = performance.now();
    const geo = meshSDF(T.sdf, {
        min: [-5.6, -0.25, -4.1], max: [4.9, 5.75, 5.0], cell: 0.07, ao: 0.42,
        color: (x, y, z, nx, ny, nz, ao, out) => {
            const dB = T.beetle(x, y, z), dS = T.skin(x, y, z), dH = T.hair(x, y, z);
            if (dB < Math.min(dS, dH) - 0.01) {
                out.copy(beeShadow).lerp(bee, clamp(0.55 + 0.45 * ny, 0, 1));
                const [bx, by, bz] = T.toBeetle(x, y, z);
                if (by < 0.62 && Math.abs(bx) > 0.6 && Math.abs(bz - 1.2) < 0.36) out.set('#55595d'); // tyre + rusty rim
                else if (Math.abs(bz - 0.48) < 0.1 && by > 1.05 && by < 1.45) out.multiplyScalar(0.72);  // windscreen

                const p = noise3(x * 2.1, y * 2.1, z * 2.1); if (p > 0.62) out.lerp(chalk, (p - 0.62) * 1.6);
                if (noise3(x * 5 + 9, y * 5, z * 5) > 0.8) out.lerp(new THREE.Color('#8a4a3a'), 0.35); // rust spots
            } else {
                out.copy(shadow).lerp(mid, clamp(0.35 + 0.5 * ny + 0.25 * nz, 0, 1)).lerp(lit, clamp(ny * 0.6 + 0.1 * nz, 0, 1) * 0.6);
                const pn = fbm3(x * 0.55, y * 0.55, z * 0.55, 3); if (pn > 0.55) out.lerp(patch, Math.min(0.5, (pn - 0.55) * 2.5));
                if (dH < dS) { const s = T.hairStrand(x, y, z); out.multiplyScalar(0.8 + 0.36 * s); }
                else out.multiplyScalar(0.95 + 0.1 * noise3(x * 4, y * 4, z * 4));
                // polished where people sit and climb (hand, nose, Beetle edge)
                if ((y < 1.0 && z > 2.0 && x < -1.5) || (z > 1.6 && y > 3.4 && y < 4.0 && Math.abs(x - 0.15) < 0.45)) out.lerp(lit, 0.25);
            }
            if (y < 0.35) out.lerp(dirt, (0.35 - y) * 1.6);
            tmpA.copy(out); out.copy(tmpA).multiplyScalar(0.62 + 0.38 * ao);
            return out;
        },
    });
    const ms = Math.round(performance.now() - t0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }));
    m.name = 'troll'; m.castShadow = true; m.receiveShadow = true;
    m.position.set(TX, TY, TZ);
    ctx.add(m);
    // hubcap eye (chrome dish, slightly domed) on the viewer-right side of the face
    const cap = new THREE.Group(); cap.name = 'troll-hubcap';
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 8, 0, Math.PI * 2, 0, 0.6), new THREE.MeshStandardMaterial({ color: '#dadde0', metalness: 1, roughness: 0.18 }));
    dish.rotation.x = Math.PI / 2; dish.scale.set(1, 0.55, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 24), new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 1, roughness: 0.25 }));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), dish.material); hub.rotation.x = Math.PI / 2; hub.position.z = 0.1;
    cap.add(dish, ring, hub); cap.position.set(TX + 0.64, TY + 4.3, TZ + 1.3); cap.rotation.y = 0.2;
    ctx.add(cap);
    // walkable top surface (hand, Beetle, shoulders, head) → Ground surface with steep cells as walls
    const hm = sdfHeightmap(T.sdf, { min: [-5.4, -0.2, -4.1], max: [4.9, 5.9, 5.0], cell: 0.2, step: 0.06 });
    ctx.ground.addHeightmap(hm, TX, TY, TZ, 0, { maxSlope: 1.6, bottom: TY - 0.5 });
    ctx.extras.troll = { mesh: m, tris: geo.userData.stats.tris, ms, T };
    return m;
}

// ============================================================================
//  Aurora Bridge north approach: bents (columns + capitals + transverse arches), longitudinal arches, deck
// ============================================================================
function archShape(x0, x1, ys, crown, top, n = 18) {
    // spandrel wall shape between two springing points: arch intrados below, flat top
    const s = new THREE.Shape(), span = x1 - x0, rise = crown - ys;
    s.moveTo(x0, ys);
    for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + span * t, u = 2 * t - 1; s.lineTo(x, ys + rise * Math.sqrt(Math.max(0, 1 - u * u * 0.98)) ** 0.85); }
    s.lineTo(x1, top); s.lineTo(x0, top); s.closePath();
    return s;
}
function buildBridge(ctx) {
    const b = new GeoBatch(), g = ctx.ground;
    const concrete = (x, y, z, nx, ny, nz) => { // stained concrete: vertical rust/water streaks, darker low down
        const st = Math.sin(x * 3.1 + Math.sin(z * 1.7) * 2) * 0.5 + 0.5, k = 0.86 + 0.1 * st + 0.04 * Math.sin(y * 0.7 + x);
        const c = new THREE.Color('#b8b5ad').multiplyScalar(k);
        if (st > 0.92) c.lerp(new THREE.Color('#8a6a4a'), 0.3);
        if (ny < -0.5) c.multiplyScalar(1.12);
        return c;
    };
    const archGeo = (x0, x1, ys, crown, top, depth) => { const geo = new THREE.ExtrudeGeometry(archShape(x0, x1, ys, crown, top), { depth, bevelEnabled: false, curveSegments: 4 }); return geo; };
    for (const zb of BENTS) {
        const und = UNDER(zb), crown = und - 0.35, ys = crown - 3.9;
        // columns with base + capital
        for (const cx of COLS) {
            const gy = g.heightAt(cx, zb) - 0.4;
            b.box(cx, gy, zb, 1.5, ys - gy, 1.5, concrete, 'concrete');
            b.box(cx, gy, zb, 1.9, 0.9, 1.9, concrete, 'concrete');
            b.box(cx, ys - 0.55, zb, 1.95, 0.6, 1.95, concrete, 'concrete');
            b.box(cx, ys - 0.75, zb, 1.7, 0.2, 1.7, concrete, 'concrete');
            ctx.box(cx, zb, 0.95, 0.95, 0, { bridgePier: true });
        }
        // transverse arches across each bay (+ cantilevered edges)
        for (let i = 0; i < COLS.length - 1; i++) {
            const geo = archGeo(COLS[i] + 0.75, COLS[i + 1] - 0.75, ys, crown, und + 0.02, 1.2);
            b.add(geo, 'concrete', M(0, 0, zb - 0.6), concrete); geo.dispose();
        }
        b.box(DECK.x0 + 0.5, ys + 1.5, zb, 1.8, und - ys - 1.5, 1.2, concrete, 'concrete');
        b.box(DECK.x1 - 0.5, ys + 1.5, zb, 1.6, und - ys - 1.5, 1.2, concrete, 'concrete');
    }
    // longitudinal arches along each column line between bents
    for (let k = 0; k < BENTS.length - 1; k++) {
        const z0 = BENTS[k], z1 = BENTS[k + 1], zm = (z0 + z1) / 2, und = UNDER(zm), crown = und - 0.3, ys = crown - 3.6;
        for (const cx of COLS) {
            const shape = archShape(z0 + 0.75, z1 - 0.75, ys, crown, Math.max(UNDER(z0), UNDER(z1)) + 0.02);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false, curveSegments: 4 });
            geo.rotateY(-Math.PI / 2); // shape x → world z
            b.add(geo, 'concrete', M(cx + 0.5, 0, 0), concrete); geo.dispose();
        }
    }
    // deck slab (stepped per bay, rising south) + longitudinal girders + parapets + suicide-prevention fence
    const zN = BENTS[0] - 7, zS = 640;
    for (let z = zN; z < zS; z += 15) {
        const z1 = Math.min(zS, z + 15), u0 = UNDER(z), u1 = UNDER(z1);
        // slab as a sloped box: quads top/bottom
        const geo = new THREE.BoxGeometry(DECK.x1 - DECK.x0, 1.15, z1 - z);
        const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const zz = pos.getZ(i) > 0 ? 1 : 0; pos.setY(i, pos.getY(i) + (zz ? u1 : u0) + 0.575); }
        geo.computeVertexNormals();
        b.add(geo, 'concrete', M((DECK.x0 + DECK.x1) / 2, 0, (z + z1) / 2), concrete); geo.dispose();
        for (const gx of [-16, -11.5, -6, -1.5]) { const gg = new THREE.BoxGeometry(0.55, 0.9, z1 - z); const p = gg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getZ(i) > 0 ? u1 : u0) - 0.45); gg.computeVertexNormals(); b.add(gg, 'concrete', M(gx, 0, (z + z1) / 2), concrete); gg.dispose(); }
        for (const ex of [DECK.x0 + 0.2, DECK.x1 - 0.2]) {
            const pg = new THREE.BoxGeometry(0.35, 1.0, z1 - z); const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + (p.getZ(i) > 0 ? u1 : u0) + 1.65); pg.computeVertexNormals(); b.add(pg, 'concrete', M(ex, 0, (z + z1) / 2), concrete); pg.dispose();
            for (let zz = z; zz < z1; zz += 2.5) b.box(ex, UNDER(zz) + 2.1, zz, 0.08, 2.4, 0.08, '#3d4246', 'metal');
            b.box(ex, UNDER(z + 7.5) + 4.45, z + 7.5, 0.06, 0.06, z1 - z, '#3d4246', 'metal');
        }
    }
    // north abutment wall where the deck meets the embankment
    const zA = zN;
    b.box((DECK.x0 + DECK.x1) / 2, g.heightAt(-8, zA) - 1, zA, DECK.x1 - DECK.x0 + 1, UNDER(zA) - g.heightAt(-8, zA) + 2.4, 1.5, concrete, 'concrete');
    // the main span far south: two tall piers + cantilever truss silhouette over the ship canal
    for (const pz of [470, 615]) { const gy = -30; for (const sx of [-15, -1]) b.box(sx, gy, pz, 3.2, UNDER(pz) - gy, 4, '#9a978f', 'concrete'); }
    for (let z = 470; z < 760; z += 9) { const top = UNDER(z) + 1.2 + 9 * Math.sin(Math.PI * clamp((z - 470) / 290, 0, 1)); for (const sx of [DECK.x0 + 0.6, DECK.x1 - 0.6]) { b.rod([sx, UNDER(z) + 1.2, z], [sx, top, z + 4.5], 0.18, '#5e6b6e', 'steel', 5); b.rod([sx, top, z + 4.5], [sx, UNDER(z + 9) + 1.2, z + 9], 0.18, '#5e6b6e', 'steel', 5); } }
    const grp = b.build('aurora-bridge');
    ctx.add(grp);
    // the deck is a solid you can't stand under-and-through: no collider needed except piers (above)
    return grp;
}

// ---------------------------------------------------------------------------- graffiti panels + chain-link fences in the bays behind the Troll
function graffitiTexture(seed) {
    const c = canvas(512, 256), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = '#9d9a92'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(${90 + r() * 40},${90 + r() * 30},${85 + r() * 30},0.5)`; x.fillRect(r() * 512, r() * 256, 60 + r() * 140, 30 + r() * 80); } // buff-outs
    const cols = ['#2b2b2b', '#3b3b3b', '#7a7a7a', '#5a5f8a', '#8c3b3b', '#2f5f4f', '#e0e0e0'];
    for (let t = 0; t < 7; t++) { // abstract tags (no real artwork reproduced)
        x.strokeStyle = r.pick(cols); x.lineWidth = 3 + r() * 8; x.lineCap = 'round'; x.beginPath();
        let px = r() * 460, py = 60 + r() * 150; x.moveTo(px, py);
        for (let k = 0; k < 6; k++) { px += 10 + r() * 40; x.quadraticCurveTo(px - 20, py - 60 + r() * 120, px, py + (r() - 0.5) * 40); }
        x.stroke();
    }
    return canvasTexture(c);
}
function chainLink() {
    const c = canvas(64, 64), x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(160,165,168,0.95)'; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.moveTo(32, 64); x.lineTo(64, 32); x.moveTo(0, 32); x.lineTo(32, 64); x.moveTo(32, 0); x.lineTo(64, 32); x.stroke();
    const t = canvasTexture(c, { repeat: true }); return t;
}
function buildBays(ctx) {
    const g = ctx.ground, grp = new THREE.Group(); grp.name = 'bays';
    const fenceTex = chainLink();
    const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 });
    const post = new THREE.MeshStandardMaterial({ color: '#8f9498', metalness: 0.7, roughness: 0.4 });
    const fence = (x0, z0, x1, z1, h = 3.2) => {
        const L = Math.hypot(x1 - x0, z1 - z0), y0 = Math.min(g.heightAt(x0, z0), g.heightAt(x1, z1));
        const tex = fenceTex.clone(); tex.needsUpdate = true; tex.repeat.set(L / 0.12, h / 0.12);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(L, h), fenceMat.clone()); m.material.map = tex;
        m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); grp.add(m);
        for (let i = 0; i <= Math.ceil(L / 3); i++) { const t = i / Math.ceil(L / 3), px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h + 0.1, 6), post); p.position.set(px, g.heightAt(px, pz) + h / 2, pz); grp.add(p); }
        ctx.collider({ wall: true, ax: x0, az: z0, bx: x1, bz: z1, y0a: y0 - 1, y1a: y0 + h, y0b: y0 - 1, y1b: y0 + h, nx: 0, nz: 1 });
    };
    // behind the Troll (next bent north), both bays; west bay along Troll Ave north of N 36th
    fence(COLS[0] + 0.8, -58, COLS[1] - 0.8, -58); fence(COLS[1] + 0.8, -60.5, COLS[2] - 0.8, -60.5, 2.6);
    fence(COLS[0] + 0.8, -73, COLS[1] - 0.8, -73); fence(COLS[1] + 0.8, -73, COLS[2] - 0.8, -73);
    // graffiti on the spandrel walls / abutment seen through the fences
    for (const [x0, x1, z, s] of [[COLS[0] + 0.8, COLS[1] - 0.8, -73.65, 3], [COLS[1] + 0.8, COLS[2] - 0.8, -73.65, 5], [COLS[0] + 0.8, COLS[1] - 0.8, -88.6, 8]]) {
        const y0 = g.heightAt((x0 + x1) / 2, z), w = x1 - x0, h = Math.min(4, UNDER(z) - 4.5 - y0);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.max(1.5, h)), new THREE.MeshStandardMaterial({ map: graffitiTexture(s), roughness: 0.95 }));
        m.position.set((x0 + x1) / 2, y0 + Math.max(1.5, h) / 2 + 0.1, z); grp.add(m);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, Math.max(1.5, h) + 0.3, 0.6), mat('concrete')); wall.position.set((x0 + x1) / 2, y0 + Math.max(1.5, h) / 2, z - 0.32); grp.add(wall);
        ctx.box((x0 + x1) / 2, z - 0.3, w / 2, 0.4);
    }
    ctx.add(grp);
}

// ---------------------------------------------------------------------------- stairs (rebuilt Sept 2023), boulders, ledge, Moss Turtle
function buildSurrounds(ctx) {
    const b = new GeoBatch(), g = ctx.ground, r = rng(42);
    // stairs: east of the Beetle (OSM steps w50612754, x≈4), climbing north from the plaza to the slope behind
    const sx = TX + 6.6, z0 = TZ - 0.5, steps = 26, run = 0.62, rise = 0.205;
    for (let i = 0; i < steps; i++) {
        const z = z0 - i * run, y0 = TY + i * rise;
        b.box(sx, y0 - 0.6, z - run / 2, 2.0, 0.6 + rise, run + 0.02, i % 2 ? '#c4c1ba' : '#c0bdb5', 'concrete');
        g.addBox(sx, z - run / 2, 1.0, run / 2 + 0.01, 0, y0 - 0.6, y0 + rise);
    }
    const stairTop = TY + steps * rise;
    // landing at the top joining the slope
    b.box(sx, stairTop - 0.6, z0 - steps * run - 1.2, 2.6, 0.6, 2.4, '#bcb9b1', 'concrete');
    g.addBox(sx, z0 - steps * run - 1.2, 1.3, 1.2, 0, stairTop - 0.6, stairTop);
    // pipe handrail
    for (const s of [-1, 1]) b.tube([[sx + s * 1.05, TY + 0.95, z0], [sx + s * 1.05, stairTop + 0.95, z0 - steps * run]], 0.03, '#5d6266', 'steel', 6);
    // raise the slope behind the Troll to meet the landing (dirt bank)
    g.mod((x, z, h) => {
        if (x < TX - 9 || x > TX + 10 || z > TZ - 3 || z < TZ - 40) return h;
        const t = smooth(TZ - 3, TZ - 17, z), want = TY + 0.4 + t * (stairTop - TY - 0.4);
        const edge = smooth(TX + 10, TX + 8, x) * smooth(TX - 9, TX - 7, x);
        return Math.max(h, h + (want - h) * edge * (z < TZ - 3 ? 1 : 0));
    });
    // concrete ledge on the right behind the Troll (abutment step)
    b.box(TX + 4.2, TY, TZ - 4.6, 3.6, 2.5, 2.2, '#b3b0a8', 'concrete'); g.addBox(TX + 4.2, TZ - 4.6, 1.8, 1.1, 0, TY - 1, TY + 2.5);
    // boulders: displaced icosahedra
    const rock = (x, z, s, sy = 0.7) => {
        const geo = new THREE.SphereGeometry(1, 18, 12), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), n = 1 + 0.28 * (noise3(vx * 1.7 + x, vy * 1.7, vz * 1.7 + z) - 0.5) + 0.08 * (noise3(vx * 5, vy * 5, vz * 5) - 0.5); p.setXYZ(i, vx * n, vy * n, vz * n); }
        geo.computeVertexNormals();
        const y = g.heightAt(x, z);
        b.add(geo, 'stone', M(x, y + s * sy * 0.45, z, r() * 0.4, r() * 6, 0, s, s * sy, s * (0.8 + r() * 0.4)), (px, py, pz, nx, ny) => new THREE.Color('#b9b4aa').multiplyScalar(0.72 + 0.28 * Math.max(0, ny) + 0.06 * noise3(px * 3, py * 3, pz * 3)));
        geo.dispose();
        ctx.circle(x, z, s * 0.85, s * sy * 0.9);
        g.addBox(x, z, s * 0.6, s * 0.6, 0, y - 1, y + s * sy * 0.9);
    };
    rock(TX - 6.6, TZ + 2.3, 1.15); rock(TX - 7.6, TZ - 0.5, 1.4, 0.8); rock(TX - 5.4, TZ + 5.0, 0.7); rock(TX + 6.6, TZ + 5.8, 0.8); rock(TX + 8.6, TZ - 2.5, 1.3);
    rock(TX + 6.1, TZ - 6.0, 0.6); rock(TX - 6.2, TZ - 4.0, 0.9); rock(TX + 4.9, TZ + 5.6, 0.55, 0.6); rock(TX - 8.8, TZ + 4.0, 0.8);
    for (let i = 0; i < 14; i++) rock(TX + (r() - 0.5) * 20, TZ - 2 - r() * 10, 0.25 + r() * 0.35, 0.6); // gravel stones
    // Moss Turtle (Michiko Tanaka, 2020) by the park path
    {
        const tx = 16.1, tz = -62.1, ty = g.heightAt(tx, tz);
        const geo = meshSDF((x, y, z) => smin(sdEllipsoid(x, y, z, 0, 0.18, 0, 0.55, 0.3, 0.7), smin(sdSphere(x, y, z, 0, 0.22, 0.72, 0.17), sdCapsule(x, y, z, -0.4, 0.06, -0.4, 0.4, 0.06, 0.4, 0.09), 0.1), 0.08) - 0.02 * noise3(x * 9, y * 9, z * 9),
            { min: [-0.8, -0.05, -0.9], max: [0.8, 0.6, 1.0], cell: 0.045, ao: 0.12, color: (x, y, z, nx, ny, nz, ao, o) => o.set(ny > 0.2 ? '#4f6b2a' : '#6b6d62').multiplyScalar((0.6 + 0.4 * ao) * (0.85 + 0.3 * noise3(x * 12, y * 12, z * 12))) });
        b.add(geo, 'plant', M(tx, ty, tz, 0, 0.6)); geo.dispose();
    }
    ctx.add(b.build('troll-surrounds'));
    return { stairTop };
}

// ---------------------------------------------------------------------------- street signs + apartments sign + floodlights
function buildSigns(ctx) {
    const grp = new THREE.Group(); grp.name = 'signs';
    const g = ctx.ground;
    const blade = (text, w) => textPlane(text, w, 0.24, { bg: '#0f6b47', fg: '#f4f4ee', border: '#e8e8e0', double: true, font: (s) => `600 ${s}px "Highway Gothic", "Arial Narrow", Arial, sans-serif`, pad: 0.16, ppm: 220 });
    // corner of N 36th St × Troll Ave N (SE corner of the junction, on the sidewalk south of the crossing)
    const px = 3.1, pz = -31.8, py = g.heightAt(px, pz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 3.4, 8), new THREE.MeshStandardMaterial({ color: '#9aa0a4', metalness: 0.8, roughness: 0.35 }));
    pole.position.set(px, py + 1.7, pz); grp.add(pole); ctx.circle(px, pz, 0.08, 3.4);
    const a = blade('Troll Ave N', 0.95); a.position.set(px, py + 3.05, pz); a.rotation.y = 0; grp.add(a);
    const b = blade('N 36th St', 0.9); b.position.set(px, py + 3.32, pz); b.rotation.y = Math.PI / 2 - 0.22; grp.add(b);
    const knit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 10), new THREE.MeshStandardMaterial({ color: '#2b7fb8', roughness: 1 })); knit.position.set(px, py + 1.6, pz); grp.add(knit); // yarn bomb (ref photo)
    // FREMONT TROLL EYE APARTMENTS sign (3510 Troll Ave N; yellow-green posts, white panel)
    {
        const sx = 12.6, sz = 22.5, sy = g.heightAt(sx, sz);
        const panel = textPlane('TROLL EYE', 1.0, 0.68, { bg: '#f3f1ea', fg: '#6b6b6b', double: true, ppm: 300, pad: 0.22, font: (s) => `300 ${s}px Georgia, serif`,
            draw: (x, w, h) => { x.fillStyle = '#2f4a6a'; x.fillRect(0, 0, w, h * 0.1); x.fillStyle = '#6b6b6b'; x.font = `600 ${h * 0.08}px Arial`; x.textAlign = 'center'; x.fillText('F R E M O N T', w / 2, h * 0.2); x.fillText('A P A R T M E N T S', w / 2, h * 0.88); x.strokeStyle = '#b33'; x.lineWidth = 3; x.beginPath(); x.arc(w * 0.5, h * 0.5, h * 0.05, 0, 7); x.stroke(); } });
        panel.position.set(sx, sy + 1.35, sz); panel.rotation.y = -Math.PI / 2 + 0.3; grp.add(panel);
        for (const s of [-0.55, 0.55]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: '#c8d64a', roughness: 0.7 })); p.position.set(sx + Math.sin(panel.rotation.y + Math.PI / 2) * s, sy + 0.95, sz + Math.cos(panel.rotation.y + Math.PI / 2) * s); grp.add(p); }
    }
    ctx.add(grp);
}
function buildFloodlights(ctx) {
    // neighbour-funded floodlights (since 1991) on short posts in front, aimed up at the face
    const grp = new THREE.Group(); grp.name = 'troll-floodlights';
    const lights = [];
    for (const [dx, dz] of [[-4.8, 7.5], [4.6, 7.2]]) {
        const x = TX + dx, z = TZ + dz, y = ctx.ground.heightAt(x, z);
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.28), new THREE.MeshStandardMaterial({ color: '#2a2d30', metalness: 0.6, roughness: 0.4 }));
        housing.position.set(x, y + 0.45, z); housing.lookAt(TX, TY + 3.8, TZ); grp.add(housing);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffe1a8', emissiveIntensity: 0 }));
        lens.position.set(0, 0, 0.145); housing.add(lens); lens.material.userData.dayGlow = 0; lens.material.userData.nightGlow = 4;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), housing.material); pole.position.set(x, y + 0.2, z); grp.add(pole);
        const L = new THREE.SpotLight('#ffd9a0', 0, 22, 0.55, 0.6, 1.4); L.position.set(x, y + 0.6, z); L.target.position.set(TX + dx * 0.15, TY + 3.6, TZ); grp.add(L, L.target);
        lights.push(L); ctx.circle(x, z, 0.2, 0.5);
    }
    ctx.add(grp);
    ctx.onNight((k) => { for (const L of lights) { L.intensity = 220 * k; L.visible = k > 0.01; } });
}

// ============================================================================
export default {
    env: { fogFar: 2600 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('fremont-troll');
        // ---- ground shaping: Troll plaza, Troll Ave + N 36th St carriageways keep their slope but are smooth across
        g.corridor([[-8.2 + 4.0, 160], [-8.2 + 4.0, 60], [-4.1, 0], [-4.1, -36]], 12, 6);
        g.corridor(N36, 9, 5);
        g.flatten([[TX - 9.5, TZ + 7.5], [TX + 9, TZ + 7.5], [TX + 9, TZ - 3], [TX - 9.5, TZ - 3]], TY, 3);
        // ---- paint: OSM + the pieces OSM splits differently under the bridge
        const P = ctx.painter;
        ctx.skipAreas.add('w295288784'); // Troll's Knoll park polygon covers the plaza — painted by hand below
        ctx.exclude.push([[DECK.x0 - 1, -100], [DECK.x1 + 1, -100], [DECK.x1 + 1, 200], [DECK.x0 - 1, 200]]); // no OSM buildings/trees under the deck
        // knoll + embankments (ivy, ferns, blackberry, dry soil under the bridge)
        P.poly([[-50, -147], [-50, -58], [39, -38], [39, -161]], '#55703a', 'grass');
        P.poly([[DECK.x0, -100], [DECK.x1, -100], [DECK.x1, -42], [DECK.x0, -45]], '#6f6a60', 'dirt');
        P.poly([[DECK.x0 - 4, -42], [DECK.x0, -42], [DECK.x0, 160], [DECK.x0 - 4, 160]], '#3f5a2e', 'grass');
        ctx.osmBackdrop({ paint: { sidewalks: true }, streetTreeOpts: { spacing: 13, prob: 0.6 }, areaTreeOpts: { conifer: 0.55 } });
        // Troll's Knoll + embankments: trees, ivy / blackberry / fern shrubs (none under the deck)
        {
            const knoll = [[-50, -147], [-50, -58], [39, -38], [39, -161]], rr = rng(77);
            for (let i = 0; i < 240; i++) {
                const x = -50 + rr() * 89, z = -161 + rr() * 123;
                if (!inPoly(x, z, knoll) || (x > DECK.x0 - 2 && x < DECK.x1 + 2) || Math.hypot(x - TX, z - TZ) < 12) continue;
                if (rr() < 0.32) ctx.trees.push({ x, z, kind: rr() < 0.45 ? 'con' : 'broad', s: 0.7 + rr() * 0.5 });
                else if (rr() < 0.5) ctx.trees.push({ x, z, kind: 'shrub', s: 0.8 + rr() * 0.9 });
            }
            for (let z = -40; z < 150; z += 2.2) for (const x0 of [DECK.x0 - 2.5, DECK.x1 + 2.6]) if (rr() < 0.7) ctx.trees.push({ x: x0 + (rr() - 0.5) * 2, z: z + rr(), kind: 'shrub', s: 0.6 + rr() * 0.8, c: rr() < 0.5 ? '#3c5a2c' : '#4a6b33' });
        }
        // Troll Ave N (concrete, 2 lanes) from N 34th up to N 36th, under the bridge; east sidewalk
        P.line([[-4.1, 160], [-4.1, -36]], 2.6 + 7.6 + 2.4 + 0.3, '#8a867e', 'slab');
        P.line([[-4.1, 160], [-4.1, -37]], 7.8, '#a7a39b', 'slab');
        P.line([[1.6, 160], [1.6, -33]], 2.4, '#b5b1a8', 'slab');
        P.line([[-12.6, 160], [-12.6, -36]], 7.4, '#66655f', 'asphalt'); // west bay: gravel/asphalt parking under the bridge
        // N 36th St east continuation (the OSM way ends at the bridge) + its crossings
        P.line(N36.slice(5), 9.6 + 5.2, '#b5b1a8', 'slab'); P.line(N36.slice(5), 9.95, '#8a867e', 'slab'); P.line(N36.slice(5), 9.6, '#4d4e52', 'asphalt');
        for (const s of [-0.11, 0.11]) P.line(N36.map(([x, z]) => [x, z + s]), 0.1, '#d6ac2c', 'none', { cap: 'butt' });
        P.line([[0.6, -32.2], [0.6, -43.6]], 3, '#e8e6df', 'none', { dash: [0.6, 0.6], cap: 'butt' });
        // Troll plaza: packed dirt/gravel + worn concrete apron
        P.poly([[TX - 9.5, TZ + 7.5], [TX + 9, TZ + 7.5], [TX + 9, TZ - 3], [TX - 9.5, TZ - 3]], '#7a7166', 'dirt');
        P.poly([[TX - 6, TZ + 7.6], [TX + 5, TZ + 7.6], [TX + 4, TZ + 3.5], [TX - 5, TZ + 3.2]], '#9a958c', 'slab');
        P.custom((x, T, k, isMask) => { if (isMask) return; const rr = rng(9); for (let i = 0; i < 900; i++) { const [px, py] = T(TX - 9 + rr() * 18, TZ - 3 + rr() * 10.5); const v = 70 + rr() * 90; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.88},0.35)`; x.fillRect(px, py, Math.max(1, k * 0.05), Math.max(1, k * 0.05)); } });
        // ---- hero
        buildTroll(ctx);
        buildBridge(ctx);
        buildBays(ctx);
        const { stairTop } = buildSurrounds(ctx);
        buildSigns(ctx);
        buildFloodlights(ctx);
        // park benches on the knoll
        { const b = new GeoBatch(); for (const [x, z, a] of [[14, -50, -2.4], [22, -70, -1.7], [-30, -62, 2.6]]) { bench(b, x, g.heightAt(x, z), z, a); ctx.box(x, z, 0.9, 0.3, a, { prop: true, h: 0.45 }); } ctx.add(b.build('knoll-benches')); }
        // ---- street lamps: cobra heads on N 36th; under-bridge lights on the columns
        ctx.lampPoints.push(...[[-60, -56.5, Math.PI / 2 + 0.25], [-30, -48.5, Math.PI / 2 + 0.25], [20, -38, -Math.PI / 2 + 0.2], [62, -29, -Math.PI / 2 + 0.2], [10.5, -2, -Math.PI / 2], [10.5, 40, -Math.PI / 2]].map(([x, z, rot]) => ({ x, z, rot })));
        // ---- traffic: N 36th St both ways, Troll Ave occasional; parked cars along Troll Ave and in the west bay
        const n36E = N36.map(([x, z]) => [x, z + 1.8]), n36W = [...N36].reverse().map(([x, z]) => [x, z - 1.8]);
        addTraffic(ctx, {
            lanes: [{ pts: n36E, n: 2, speed: 8 }, { pts: n36W, n: 2, speed: 8 }, { pts: [[-6.0, 175], [-6.0, 60], [-6.0, -20], [-6.0, -34], [-14, -39.5], [-60, -51.5], [-102, -63]], n: 1, speed: 7 }],
            parked: [[-9.9, 20, 0], [-9.9, 31, 0], [-9.9, 60, Math.PI], [-15.5, -12, 0], [-15.5, -1, 0.05], [-15.5, 10, 0], [-15.5, 48, Math.PI], [0.2 + 1.8, 75, Math.PI], [-35, -48.5, Math.PI / 2 + 0.25], [30, -36, -Math.PI / 2 + 0.22]].map(([x, z, yaw]) => ({ x, z, yaw })),
        });
        // ---- plaques (artists credited — R15.7)
        const PL = sp.plaques, credit = 'Sculpture © 1990 Steve Badanes, Will Martin, Donna Walter and Ross Whitehead — modelled in 3-D from public descriptions for this non-commercial portfolio.';
        ctx.plaque(PL[0], TX - 6.3, TZ + 7.2, 0.25, { credit });
        ctx.plaque(PL[1], TX + 6.0, TZ + 6.2, -0.35, { credit: 'Beetle: VW Type 1, about 4.07 × 1.54 × 1.50 m.' });
        ctx.plaque(PL[2], TX + 9.2, TZ + 1.8, -1.0);
        ctx.plaque(PL[3], 4.5, -25, -1.3, { style: 'city' });
        ctx.plaque(PL[4], COLS[0] + 2.0, -16, 1.5, { style: 'city' });
        // ---- postcard challenge (iconic: head-on, framed by the arch)
        ctx.challenge('fremont-troll', { r: 9, tol: 30 });
        // ---- fun: climb spots (E): hand, Beetle, head
        const toTop = (x, z) => ({ x, z });
        const climb = (label, x, z, tx, tz, line) => ctx.interactables.push({ kind: 'climb', x, z, r: 1.8, label, use: (s) => { seaActivity(s, 'lm-troll-climb', 'fremont-troll'); const p = toTop(tx, tz); s.ctl.teleport(p.x, p.z, s.ctl.heading); s.sound.play('whoosh', 0.6); if (line && s.spot.crowd) { const c = s.spot.crowd, k = c.peds.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 9); if (k) c._say(k, 'photographed', { force: true }); } } });
        climb('Climb onto the hand', TX - 3.4, TZ + 5.2, TX - 3.3, TZ + 2.6, true);
        climb('Sit on the Beetle', TX + 4.8, TZ + 4.6, TX + 4.0, TZ + 2.6, true);
        ctx.interactables.push({ kind: 'touch', x: TX + 0.15, z: TZ + 3.2, r: 1.3, cond: (s) => s.ctl.position.y > TY + 2.6, label: 'Touch his nose', use: (s) => { s.ui.toast('👃 Boop', 'Generations of visitors polished that nose.'); s.sound.play('chime', 0.5); } });
        // ---- crowd (low–medium: trickle of tourists, a tour group, climbers, photographers)
        const hmTop = (x, z) => g.groundAt(x, z, 10);
        ctx.crowdCfg = {
            personas: { tourist_us: 4, tourist_cn: 2, tourist_kr: 1.5, tourist_jp: 1.5, tourist_de: 1, tourist_es: 1, tourist_ca: 1, tourist_in: 1, local: 2.5, kid: 1.2, photographer: 1, guide: 0.4 },
            walkers: 9,
            paths: [
                [[1.6, 150], [1.6, 60], [1.6, 10], [1.4, -31]], [[-17.2, 140], [-17.2, 40], [-17.2, -34]],
                N36.slice(4).map(([x, z]) => [x, z + 6]), N36.slice(0, 6).map(([x, z]) => [x, z - 6]),
                [[1.4, -31], [0.6, -38], [TX + 3.8, TZ + 7.8], [TX - 4, TZ + 8.2], [-14, -45]],
                [[TX + 6.6, TZ + 1], [TX + 6.6, TZ - 16.6], [TX + 6.6, TZ - 19], [19, -55], [26, -63], [27, -74], [18, -93]],
            ],
            groups: [
                { x: TX - 3.3, z: TZ + 2.4, r: 0.4, n: 1, act: 'pose', look: [TX - 3, TZ + 14], y: hmTop, personas: ['tourist_us', 'kid', 'tourist_es'] },
                { x: TX + 3.95, z: TZ + 2.4, r: 0.15, n: 1, act: 'sit', look: [TX + 1, TZ + 12], y: (x, z) => hmTop(x, z) - 0.02, personas: ['tourist_kr', 'local'] },
                { x: TX - 1.5, z: TZ + 12.5, r: 1.6, n: 3, act: 'photo', look: [TX - 2, TZ + 1], personas: ['tourist_us', 'tourist_cn', 'photographer', 'tourist_in'] },
                { x: TX + 3.5, z: TZ + 10.5, r: 2.2, n: 5, act: 'watch', look: [TX, TZ + 1], personas: ['tourist_cn', 'tourist_jp', 'tourist_de', 'tourist_es', 'tourist_ca'] },
                { x: TX + 5.6, z: TZ + 12.5, r: 0.3, n: 1, act: 'guide', look: [TX + 3, TZ + 10], personas: ['guide'], prop: 'flag' },
                { x: TX - 7.2, z: TZ + 8.8, r: 1, n: 2, act: 'talk', personas: ['local', 'tourist_us'] },
                { x: TX + 6.6, z: TZ - 9.5, r: 0.2, n: 1, act: 'watch', look: [TX, TZ], y: (x, z) => g.groundAt(x, z, 10), personas: ['kid', 'tourist_us'] },
                { x: 9, z: -37.5, r: 0.5, n: 1, act: 'watch', look: [TX, TZ], personas: ['local'] },
            ],
        };
        // ---- spawn: research spawn (Troll Ave, 50 m south, looking north up the slope)
        ctx.spawns['fremont-troll'] = { x: sp.spawn.x - 1.2, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
        // ---- sound: bridge drone overhead, expansion-joint thumps, crows, crowd at the Troll, N 36th traffic
        ctx.sound('traffic', -8, -10, 160, 1.0); ctx.sound('thump', -8, -40, 120, 1); ctx.sound('crows', 20, -70, 120, 1); ctx.sound('crowd', TX, TZ + 8, 30, 0.8); ctx.sound('traffic', 0, -36, 60, 0.6);
        // ---- season: Halloween — the Troll's birthday (unveiled Halloween 1990): pumpkins
        const now = new Date();
        if (now.getMonth() === 9 && now.getDate() >= 24 || now.getMonth() === 10 && now.getDate() <= 2) {
            const b = new GeoBatch();
            for (const [dx, dz, s] of [[-1.4, 4.4, 0.32], [1.2, 4.8, 0.26], [-5.6, 6.2, 0.36], [3.9, 5.6, 0.3], [0.1, 6.3, 0.22]]) { const x = TX + dx, z = TZ + dz, y = g.heightAt(x, z); b.sphere(x, y + s * 0.8, z, s, s * 0.8, s, '#e2711d', 'plant', 14, 10); b.cyl(x, y + s * 1.5, z, 0.03, 0.12, '#4a5a2a', 'plant', 5); }
            ctx.add(b.build('pumpkins'));
        }
        ctx.terrainOpts = { bg: '#55693e', innerPx: 2048 };
        ctx.minY = -40;
        ctx.extras.stairTop = stairTop;
    },
};
