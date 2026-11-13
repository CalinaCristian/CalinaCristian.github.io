// ============================================================================
//  Shared helpers for the four Bellevue scenes (spots-bel lane, round 5):
//  activity events (note 57), seasons, lit office floors on the district
//  landmark models, water bodies on the shared water material (spec 18),
//  shoreline fields, boulder rockeries, fairy lights, signs and small props.
//  Not a scene module (no default export with build): imported by bel-*.js.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { LANDMARKS, buildLandmark } from '../../landmarks.js';
import { makeWaterMaterial } from '../../water.js';
import { GeoBatch, inPoly, polyBox, distSeg, rng, hash2, canvas, canvasTexture } from '../kit.js';

// ---------------------------------------------------------------------------- activities (01 *Activities*)
/** report a completed activity once per session + toast; ids follow the Landmarks catalogue (spec 15 Requests) */
export function emitActivity(s, spot, id, title, body) {
    s._belDone = s._belDone || new Set();
    const first = !s._belDone.has(id); s._belDone.add(id);
    try {
        if (typeof window.game?.emit === 'function') window.game.emit('activity', { spot, id });
        else window.dispatchEvent(new CustomEvent('dmcv:activity', { detail: { spot, id } }));
    } catch { /* no host */ }
    window.cvTelemetry?.track?.('spot_activity', { spot, id });
    if (title) s.ui.toast(title, body || '');
    return first;
}

// ---------------------------------------------------------------------------- season / clock
/** the simulated date of the session (dev page `date=`, game clock), as month (1–12) + day in Pacific time */
export function localMD(s) {
    const d = s?.r3d?.simDate || s?.host?.date || new Date();
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'America/Los_Angeles', month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23' }).formatToParts(d).map(p=>[p.type,p.value]));
    return { m:+p.month,d:+p.day,h:+p.hour + +p.minute / 60 };
}
/** inclusive month/day window, may wrap the new year: inWindow({m,d}, [11, 20], [1, 6]) */
export function inWindow({ m, d }, [m0, d0], [m1, d1]) {
    const v = m * 100 + d, a = m0 * 100 + d0, b = m1 * 100 + d1;
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
}
/** call fn(on) now and whenever the seasonal window flips (checked every 5 s) */
export function seasonal(ctx, from, to, fn) {
    let last = null, t = 0;
    ctx.onUpdate((dt, s) => { t -= dt; if (t > 0 && last !== null) return; t = 5; const on = inWindow(localMD(s), from, to); if (on !== last) { last = on; fn(on, s); } });
}

// ---------------------------------------------------------------------------- landmarks with lit office floors
/**
 * Place a landmarks.js model (1:1, district look) at its real lat/lon and give its glass a lit-floor night pattern:
 * each glass quad (one floor of one facade edge) gets a random value; at night ~`frac` of the floors glow in warm /
 * cool office light, broken into runs along the facade; ground-floor glazing (< `shopH` m) always glows (lobbies,
 * shops). Returns { mesh, x, z, y, tris } (or null).
 */
export function placeLitLandmark(ctx, id, { frac = 0.46, shopH = 6.5, seed = 1, collide = true, colliderH = 16 } = {}) {
    const lm = LANDMARKS.find((l) => l.id === id); if (!lm) return null;
    const r = buildLandmark(lm, { THREE, realScale: true }); if (!r) return null;
    const p = ctx.ll(lm.lat, lm.lon), y = ctx.ground.heightAt(p.x, p.z);
    r.mesh.position.set(p.x, y, p.z); r.mesh.updateMatrixWorld(true); ctx.add(r.mesh);
    const glass = litGlassMaterial({ y0: y, frac, shopH, seed });
    r.mesh.traverse((o) => {
        if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (m?.isMeshStandardMaterial && m.vertexColors && Math.abs(m.roughness - 0.28) < 1e-3) { tagQuads(o.geometry, seed); o.material = glass; }
    });
    if (collide) for (const c of r.collision) ctx.box(p.x + c.x, p.z + c.z, c.hw, c.hd, c.angle, { y0: y - 1, y1: y + colliderH });
    return { mesh: r.mesh, x: p.x, z: p.z, y, tris: r.triangles, lm };
}
/** per-triangle random `aLit` shared by the two triangles of a quad (same bbox min corner) */
function tagQuads(geo, seed) {
    const P = geo.attributes.position, n = P.count, a = new Float32Array(n);
    for (let t = 0; t + 2 < n; t += 3) {
        let x = 1e9, y = 1e9, z = 1e9;
        for (let k = 0; k < 3; k++) { x = Math.min(x, P.getX(t + k)); y = Math.min(y, P.getY(t + k)); z = Math.min(z, P.getZ(t + k)); }
        const v = hash2(Math.round(x * 2) + seed * 17.3 + Math.round(y * 4) * 0.37, Math.round(z * 2) - seed * 3.1 + Math.round(y * 4) * 1.31);
        a[t] = a[t + 1] = a[t + 2] = v;
    }
    geo.setAttribute('aLit', new THREE.BufferAttribute(a, 1));
}
function litGlassMaterial({ y0, frac, shopH, seed }) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.45, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0, envMapIntensity: 1.25 });
    m.name = 'bel-litglass';
    m.userData.nightEmissive = 1; m.userData.nightGlow = 1; m.userData.dayGlow = 0;
    const U = { uY0: { value: y0 }, uFrac: { value: frac }, uShop: { value: shopH }, uSeed: { value: seed * 1.37 } };
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit; varying vec3 vLW; flat varying vec3 vLN;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvLit = aLit; vLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            uniform float uY0, uFrac, uShop, uSeed; varying float vLit; varying vec3 vLW; flat varying vec3 vLN; // (flat: an interpolated normal wobbled the window grid → speckle, round 6 note 32)
            float lH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            {
                float vert = 1.0 - smoothstep(0.3, 0.6, abs(vLN.y));
                vec2 tg = normalize(vec2(-vLN.z, vLN.x) + 1e-5);
                float along = dot(vLW.xz, tg);
                float cell = floor(along / 3.2), run = floor(along / 11.0);
                float floorOn = step(vLit, uFrac);
                float cellOn = step(lH(vec2(cell, vLit * 97.0 + uSeed)), floorOn > 0.5 ? 0.86 : 0.07);
                float runOff = step(0.82, lH(vec2(run * 1.7, vLit * 53.0 + uSeed)));
                float lit = cellOn * (1.0 - runOff * floorOn);
                float shop = 1.0 - step(uShop, vLW.y - uY0);
                lit = max(lit, shop);
                float tone = lH(vec2(cell * 0.31, vLit * 11.0));
                vec3 col = tone < 0.62 ? vec3(1.0, 0.84, 0.6) : tone < 0.92 ? vec3(0.86, 0.93, 1.0) : vec3(1.0, 0.95, 0.85);
                float k = (0.55 + 0.6 * lH(vec2(cell * 3.1, vLit * 7.0))) * (shop > 0.5 ? 1.5 : 1.0);
                totalEmissiveRadiance *= col * lit * vert * k * 0.85;
            }`);
    };
    m.customProgramCacheKey = () => 'bel-litglass';
    return m;
}

// ---------------------------------------------------------------------------- shoreline field + water
/**
 * Signed distance field of a water polygon over a box (cell m): positive in the water, negative on land, |d| = metres
 * to the shoreline. Returns sample(x, z) (bilinear, clamped).
 */
export function shoreField(poly, box, cell = 3) {
    const nx = Math.ceil((box.x1 - box.x0) / cell) + 1, nz = Math.ceil((box.z1 - box.z0) / cell) + 1, F = new Float32Array(nx * nz);
    const pad = 120, segs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, az] = poly[j], [bx, bz] = poly[i];
        if (Math.max(ax, bx) < box.x0 - pad || Math.min(ax, bx) > box.x1 + pad || Math.max(az, bz) < box.z0 - pad || Math.min(az, bz) > box.z1 + pad) continue;
        segs.push([ax, az, bx, bz]);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = box.x0 + i * cell, z = box.z0 + j * cell; let d = pad;
        for (const s of segs) { const r = distSeg(x, z, s[0], s[1], s[2], s[3]); if (r.d < d) d = r.d; }
        F[j * nx + i] = inPoly(x, z, poly) ? d : -d;
    }
    const sample = (x, z) => {
        const fx = Math.max(0, Math.min(nx - 1.001, (x - box.x0) / cell)), fz = Math.max(0, Math.min(nz - 1.001, (z - box.z0) / cell));
        const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nx + i;
        return (F[k] * (1 - u) + F[k + 1] * u) * (1 - v) + (F[k + nx] * (1 - u) + F[k + nx + 1] * u) * v;
    };
    return { sample, box, cell };
}
/**
 * Water surface at level y over `box` as a grid of `cell` m quads, kept where sdf(x, z) > -keep (the terrain hides
 * the overlap: the shoreline is where the carved terrain crosses the water plane). `aShore` from the field (foam,
 * shallow tint). opts.far = [[x0, z0, x1, z1], …] adds open-water rectangles (far lake) with the same material.
 */
export function waterGrid(ctx, sdf, y, box, { cell = 4, keep = 10, deep = '#1d3640', shallow = '#45625b', far = [], ripple = 1, wave = 1, flow = [0, 0], name = 'lake', envIntensity = 1 } = {}) {
    const mat = makeWaterMaterial({ deep, shallow, ripple, wave, flow, envIntensity });
    const nx = Math.ceil((box.x1 - box.x0) / cell), nz = Math.ceil((box.z1 - box.z0) / cell);
    const pos = [], sh = [], idx = [], vid = new Map();
    const V = (i, j) => { const k = j * (nx + 1) + i; let v = vid.get(k); if (v !== undefined) return v; const x = box.x0 + i * cell, z = box.z0 + j * cell; v = pos.length / 3; pos.push(x, y, z); sh.push(Math.max(0, sdf(x, z))); vid.set(k, v); return v; };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = box.x0 + (i + 0.5) * cell, z = box.z0 + (j + 0.5) * cell;
        if (sdf(x, z) < -keep) continue;
        const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
        idx.push(a, d, c, a, c, b);
    }
    for (const [x0, z0, x1, z1] of far) { // far open water rectangles (aShore 99), e.g. the lake out to the horizon
        const base = pos.length / 3;
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { pos.push(x, y - 0.003, z); sh.push(99); }
        idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(sh, 1));
    g.setIndex(idx); g.computeBoundingSphere();
    mat.userData.hasShore = true;
    const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.receiveShadow = true; ctx.add(mesh);
    return mesh;
}
/** a flat water polygon (pond, canal piece) at y with shore distance to its own outline */
export function waterPoly(ctx, poly, y, o = {}) {
    const bb = polyBox(poly), segs = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
    const sdf = (x, z) => { let d = 1e9; for (const [a, b] of segs) d = Math.min(d, distSeg(x, z, a[0], a[1], b[0], b[1]).d); return inPoly(x, z, poly) ? d : -d; };
    const cell = o.cell ?? 1.5;
    const mat = o.material || makeWaterMaterial({ deep: o.deep ?? '#23413f', shallow: o.shallow ?? '#3f5d55', ripple: o.ripple ?? 0.6, wave: o.wave ?? 0.4, flow: o.flow ?? [0, 0], envIntensity: o.envIntensity ?? 1.1, foam: o.foam ?? 1 });
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    let g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
    g = subdivideTris(g, cell * 1.6);
    const P = g.attributes.position, sh = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) { P.setY(i, y); sh[i] = Math.max(0, sdf(P.getX(i), P.getZ(i))); }
    g.setAttribute('aShore', new THREE.BufferAttribute(sh, 1)); g.computeBoundingSphere();
    mat.userData.hasShore = true;
    const mesh = new THREE.Mesh(g, mat); mesh.name = o.name || 'pond'; mesh.receiveShadow = true; ctx.add(mesh);
    void bb; return mesh;
}
/** longest-edge bisection of an indexed/non-indexed geometry into a non-indexed one (positions + up normals) */
function subdivideTris(geometry, maxEdge) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry, P = g.attributes.position.array, out = [], m2 = maxEdge * maxEdge;
    const stack = []; for (let i = 0; i < P.length; i += 9) stack.push(Array.from(P.slice(i, i + 9)));
    while (stack.length) {
        const t = stack.pop();
        const e = [[0, 3], [3, 6], [6, 0]].map(([a, b]) => (t[a] - t[b]) ** 2 + (t[a + 2] - t[b + 2]) ** 2);
        const k = e[0] >= e[1] && e[0] >= e[2] ? 0 : e[1] >= e[2] ? 1 : 2;
        if (e[k] <= m2 || out.length / 9 > 40000) { out.push(...t); continue; }
        const A = [0, 3, 6][k], B = [3, 6, 0][k], C = [6, 0, 3][k], Mm = [(t[A] + t[B]) / 2, (t[A + 1] + t[B + 1]) / 2, (t[A + 2] + t[B + 2]) / 2], v = (i) => [t[i], t[i + 1], t[i + 2]];
        stack.push([...v(A), ...Mm, ...v(C)], [...Mm, ...v(B), ...v(C)]);
    }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    const n = new Float32Array(out.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; ng.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return ng;
}

// ---------------------------------------------------------------------------- rockeries, lights, small props
/** two-course boulder rockery (PNW retaining wall) along a polyline: grey granite boulders 0.7–1.3 m */
export function boulderWall(b, pts, yFn, { h = 1.4, seed = 1, cols = ['#8d8a83', '#7c7a74', '#9b978e', '#6f6d68'] } = {}) {
    const r = rng(seed); let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
        const yaw = Math.atan2(bx - ax, bz - az);
        for (let s = acc; s < L; s += 0.95 + r() * 0.35) {
            const t = s / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = yFn(x, z);
            const rr = 0.32 + r() * 0.22, c = cols[Math.floor(r() * cols.length)];
            b.add(ROCK, 'stone', new THREE.Matrix4().compose(new THREE.Vector3(x, y + rr * 0.55, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.5, yaw + r() * 3, r() * 0.4)), new THREE.Vector3(rr * 2.1, rr * 1.5, rr * 1.8)), c);
            if (h > 1 && r() < 0.7) { const r2 = 0.26 + r() * 0.16; b.add(ROCK, 'stone', new THREE.Matrix4().compose(new THREE.Vector3(x + (r() - 0.5) * 0.4, y + rr * 1.2 + r2 * 0.5, z + (r() - 0.5) * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(r2 * 2, r2 * 1.4, r2 * 1.8)), cols[Math.floor(r() * cols.length)]); }
        }
        acc = 0;
    }
}
const ROCK = (() => { const g = new THREE.IcosahedronGeometry(0.5, 1); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.82 + 0.3 * hash2(x * 7.1 + z * 3.3, y * 5.7); P.setXYZ(i, x * k, y * k * (y < 0 ? 0.6 : 1), z * k); } g.computeVertexNormals(); return g; })();
export const rockGeometry = () => ROCK;

/**
 * Fairy / holiday lights: small additive points (pts = [[x, y, z], …]), visible only at night (nightK) and while
 * `on()` says so. One draw call.
 */
// screenPx: a fixed on-screen size in pixels (navigation / masthead lights read as a point at any distance)
export function fairyLights(ctx, pts, { color = '#ffe2a8', size = 0.22, twinkle = 0.25, on = () => true, name = 'fairy-lights', screenPx = 0 } = {}) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const ph = new Float32Array(pts.length); for (let i = 0; i < ph.length; i++) ph[i] = hash2(i * 0.37, i * 1.13) * 6.28; g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const sprite = (() => { const c = canvas(32, 32), x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return canvasTexture(c, { mips: false }); })();
    const U = { uT: { value: 0 }, uK: { value: 0 }, uTw: { value: twinkle } };
    const m = new THREE.PointsMaterial({ color, size: screenPx || size, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: !screenPx, toneMapped: false });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPh; uniform float uT, uK, uTw; varying float vA;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvA = uK * (1.0 - uTw + uTw * (0.5 + 0.5 * sin(uT * 2.3 + aPh)));');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\ngl_FragColor.rgb *= vA * 2.2; gl_FragColor.a *= vA;');
    };
    m.customProgramCacheKey = () => 'bel-fairy' + (screenPx ? '-px' : '');
    const P = new THREE.Points(g, m); P.name = name; P.frustumCulled = false; ctx.add(P);
    ctx.onUpdate((dt, s) => { U.uT.value += dt; const k = on(s) ? s.nightK : 0; U.uK.value = k; P.visible = k > 0.02; });
    return P;
}
/** points spiralling round a tree (trunk wrap + crown shell), for fairyLights */
export function treeLightPoints(x, y, z, { trunkH = 3.2, crownY = 4.6, crownR = 2.6, n = 90, seed = 1 } = {}) {
    const r = rng(seed), out = [];
    for (let i = 0; i < 26; i++) { const t = i / 26, a = t * Math.PI * 2 * 5; out.push([x + Math.cos(a) * 0.2, y + 0.4 + t * trunkH, z + Math.sin(a) * 0.2]); }
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, e = (r() - 0.35) * 1.6, rr = crownR * (0.75 + r() * 0.3); out.push([x + Math.cos(a) * Math.cos(e) * rr, y + crownY + Math.sin(e) * rr * 0.9, z + Math.sin(a) * Math.cos(e) * rr]); }
    return out;
}

/** night-lit material (emissive eased by render.js / setNightWindows): `glow` color, `k` intensity */
export function nightLit(color, k = 1.5, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color: o.base || '#1c1c1c', emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: o.roughness ?? 0.5, ...(o.extra || {}) });
    m.userData.nightEmissive = k; m.userData.nightGlow = k; m.userData.dayGlow = o.day ?? 0; m.name = o.name || 'bel-nightlit';
    return m;
}
/** vertical sign text plate (canvas) that glows at night: returns a Mesh (w × h m), front faces +z */
export function glowText(text, w, h, { fg = '#ffffff', bg = null, font = (s) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`, night = 1.4, day = 0, ppm = 120, letter = 0 } = {}) {
    const W = Math.max(16, Math.round(w * ppm)), H = Math.max(16, Math.round(h * ppm)), c = canvas(W, H), x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); } else x.clearRect(0, 0, W, H);
    let s = H * 0.78; x.font = font(s); while (x.measureText(text).width + letter * text.length > W * 0.94 && s > 6) { s *= 0.94; x.font = font(s); }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (letter) { let tw = x.measureText(text).width + letter * (text.length - 1), px = W / 2 - tw / 2; x.textAlign = 'left'; for (const ch of text) { x.fillText(ch, px, H / 2); px += x.measureText(ch).width + letter; } } else x.fillText(text, W / 2, H / 2);
    const t = canvasTexture(c);
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: !bg, alphaTest: bg ? 0 : 0.35, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: day, roughness: 0.5 });
    m.userData.nightEmissive = night; m.userData.nightGlow = night; m.userData.dayGlow = day; m.name = 'bel-sign';
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.name = 'sign:' + text;
    return mesh;
}

/**
 * Prism over an outer ring with inner rings left open (OSM multipolygon courtyards / atria): walls face out on the
 * outer ring and into each courtyard, the top cap has the holes. `bottom: false` drops the underside.
 */
export function ringPrism(b, outer, holes, y0, y1, color, key = 'concrete', { bottom = false } = {}) {
    const ccw = (p) => (polyAreaSigned(p) > 0 ? p : [...p].reverse()), cw = (p) => (polyAreaSigned(p) > 0 ? [...p].reverse() : p);
    const shape = new THREE.Shape(ccw(outer).map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes || []) shape.holes.push(new THREE.Path(cw(h).map(([x, z]) => new THREE.Vector2(x, -z))));
    let g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    if (!bottom) { const ng = g.toNonIndexed(), P = ng.attributes.position, keep = []; // drop the down-facing cap (never seen, costs triangles)
        for (let t = 0; t < P.count; t += 3) { const ys = [P.getY(t), P.getY(t + 1), P.getY(t + 2)]; if (ys.every((v) => Math.abs(v - y0) < 1e-4)) continue; for (let k = 0; k < 3; k++) keep.push(P.getX(t + k), P.getY(t + k), P.getZ(t + k)); }
        g.dispose(); g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); g.computeVertexNormals(); }
    b.add(g, key, null, color); g.dispose();
}
// signed shoelace area in the x/z plane (x east, z south): > 0 is counter-clockwise seen from above (−z up the page)
function polyAreaSigned(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] * -p[i][1]) - (p[i][0] * -p[j][1]); return a / 2; }

/** a single triangle into a GeoBatch (no degenerate quads → no zero normals) */
export function tri(b, a, c, d, color, key = 'concrete') {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...c, ...d], 3)); g.computeVertexNormals(); b.add(g, key, null, color); g.dispose();
}
/** gable roof: ridge along `yaw` (L long), W wide, H high, eaves at y, overhang `over` m */
export function gableRoof(b, cx, y, cz, yaw, L, W, H, color, { key = 'roofs', over = 0.45, gable = null } = {}) {
    const s = Math.sin(yaw), c = Math.cos(yaw), P = (lx, ly, lz) => [cx + c * lx + s * lz, y + ly, cz - s * lx + c * lz];
    const w = W / 2 + over, l = L / 2 + over;
    b.quad(P(-w, 0, -l), P(-w, 0, l), P(0, H, l), P(0, H, -l), color, key);
    b.quad(P(w, 0, l), P(w, 0, -l), P(0, H, -l), P(0, H, l), color, key);
    const gw = W / 2, gl = L / 2;
    tri(b, P(-gw, 0, gl), P(gw, 0, gl), P(0, H * gw / w, gl), gable || color, gable ? 'paint' : key);
    tri(b, P(gw, 0, -gl), P(-gw, 0, -gl), P(0, H * gw / w, -gl), gable || color, gable ? 'paint' : key);
}

/** skip the OSM buildings whose centroid lies within `r` m of a landmark anchor (the landmark model replaces them) */
export function skipNearLandmark(ctx, id, r = null) {
    const lm = LANDMARKS.find((l) => l.id === id); if (!lm) return [];
    const sourceIds=new Set(lm.sourceIds||[]),out=[];
    for (const b of ctx.data.buildings) if(sourceIds.has(b.id)){ctx.skipBuildings.add(b.id);out.push(b.id);}
    void r; // legacy callers may pass a radius; source membership is authoritative.
    return out;
}

// ---------------------------------------------------------------------------- park shelters / restrooms, pitch markings
/**
 * Small park structures that OSM maps as plain footprints: amenity=shelter (an open roof on posts) and public toilets
 * (one low block). The generic extruder turns `building=yes` + amenity into a multi-storey block with a shopfront, so
 * these are taken out of it (call BEFORE ctx.osmBackdrop) and built here on the mapped outline. Heights are estimates
 * (2.6 m eaves, 2.9 m walls); no tag gives them. Returns the ids handled.
 */
export function parkPavilions(ctx, { roofCol = '#4b4f52', postCol = '#6a5a48', wallCol = '#a39c90' } = {}) {
    const g = ctx.ground, b = new GeoBatch(), done = [];
    for (const bd of ctx.data.buildings) {
        if (bd.part || ctx.skipBuildings.has(bd.id) || !bd.poly || bd.poly.length < 3) continue;
        const shelter = bd.amenity === 'shelter', wc = bd.amenity === 'toilets' || bd.k === 'toilets';
        if (!shelter && !wc) continue;
        const bb = polyBox(bd.poly); if ((bb.x1 - bb.x0) * (bb.z1 - bb.z0) > 900) continue; // a large building that merely contains toilets
        ctx.skipBuildings.add(bd.id); done.push(bd.id);
        const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, hs = bd.poly.map(([x, z]) => g.heightAt(x, z)), y = Math.max(...hs), y0 = Math.min(...hs) - 0.4;
        const grow = (k) => bd.poly.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
        if (shelter) {
            const posts = [];
            for (const [x, z] of grow(0.9)) { if (posts.some((p) => Math.hypot(x - p[0], z - p[1]) < 2.4)) continue; posts.push([x, z]); b.cyl(x, y0, z, 0.09, y + 2.6 - y0, postCol, 'wood', 8); ctx.circle(x, z, 0.14, 2.6); }
            b.prism(grow(1.06), y + 2.6, y + 2.82, roofCol, 'metal', { bottom: true });
        } else {
            b.prism(bd.poly, y0, y + 2.9, wallCol, 'concrete'); b.prism(grow(1.1), y + 2.9, y + 3.12, roofCol, 'metal', { bottom: true }); ctx.poly(bd.poly);
        }
    }
    if (done.length) ctx.add(b.build('park-pavilions'));
    return done;
}
/**
 * White line markings on a mapped pitch (a painter op: call AFTER ctx.osmBackdrop, which paints the surface): outline,
 * halfway line, centre circle and the goal / key boxes in the polygon's own long-axis frame. Standard proportions
 * scaled to the mapped surface — OSM gives the pitch and its sport, not the paint.
 */
export function pitchMarkings(ctx, poly, sport = 'soccer') {
    let best = 0, ux = 1, uz = 0;
    for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ux = (bx - ax) / L; uz = (bz - az) / L; } }
    const vx = -uz, vz = ux; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [x, z] of poly) { const u = x * ux + z * uz, v = x * vx + z * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const m = sport === 'soccer' ? 2.5 : 0.6; u0 += m; u1 -= m; v0 += m; v1 -= m; // run-off inside the mapped surface
    const W = (u, v) => [u * ux + v * vx, u * uz + v * vz], uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, Lv = v1 - v0;
    ctx.painter.custom((x, T, k, isMask) => {
        if (isMask) return;
        x.save(); x.strokeStyle = 'rgba(244,244,238,0.92)'; x.lineWidth = Math.max(1.2, 0.12 * k); x.lineJoin = 'miter'; x.setLineDash([]);
        const path = (pts, close = false) => { x.beginPath(); pts.forEach(([u, v], i) => { const [px, py] = T(...W(u, v)); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); if (close) x.closePath(); x.stroke(); };
        const arc = (u, v, r, a0 = 0, a1 = Math.PI * 2) => path(Array.from({ length: 33 }, (_, i) => { const a = a0 + (a1 - a0) * i / 32; return [u + Math.cos(a) * r, v + Math.sin(a) * r]; }));
        path([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], true); path([[uc, v0], [uc, v1]]);
        if (sport === 'soccer') {
            const s = Math.min(1, Lv / 64); arc(uc, vc, 9.15 * s);
            for (const [ue, d] of [[u0, 1], [u1, -1]]) for (const [dep, half] of [[16.5, 20.15], [5.5, 9.16]]) path([[ue, vc - half * s], [ue + d * dep * s, vc - half * s], [ue + d * dep * s, vc + half * s], [ue, vc + half * s]]);
        } else {
            arc(uc, vc, 1.8);
            for (const [ue, d] of [[u0, 1], [u1, -1]]) { path([[ue, vc - 2.45], [ue + d * 5.8, vc - 2.45], [ue + d * 5.8, vc + 2.45], [ue, vc + 2.45]]); const r = Math.min(6.75, Lv / 2 - 0.3), a = d > 0 ? -Math.PI / 2 : Math.PI / 2; arc(ue + d * 1.6, vc, r, a, a + Math.PI); }
        }
        x.restore();
    });
}
