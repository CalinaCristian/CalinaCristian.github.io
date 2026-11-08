import * as THREE from '../vendor/three.module.min.js';
import { sourceShoreAttribute } from './water-shore.js';
export { makeSourceShoreSampler } from './water-shore.js';

// ============================================================================
//  Water — one shared, cheap material for rivers, canals, lakes, fountains (districts + tourist spots).
//
//  makeWaterMaterial(opts) → THREE.MeshStandardMaterial (patched):
//   - Fresnel reflection of the environment (render.js hands its sky/city PMREM to every water material via
//     setWaterEnv; buildings/sky/glow come from it), low roughness, no planar pass;
//   - procedural normal ripples (6 directional waves + 2 noise octaves) advected by `flow` (m/s), faded with distance
//     (derivative-based) so far water is calm and does not alias;
//   - body colour: `deep` / `shallow` mixed by distance to the shore and view angle (darker edges + steep views);
//   - shoreline foam and wet-wall darkening band from an optional per-vertex `aShore` attribute (metres to the
//     water body's edge, see computeShoreDistance);
//   - night: real lights (street lamps, headlights) leave long streaks on the water (same model as wet roads).
//  Zero extra draw calls; per-pixel cost ≈ one Standard material + ~60 ALU. render.js ticks the time (tickWater).
// ============================================================================
const MATS = new Set();
let ENV = null, ENV_I = 1;
const U_TIME = { value: 0 };

/** @param {{deep?:string|THREE.Color, shallow?:string|THREE.Color, flow?:[number,number], ripple?:number, wave?:number,
 *  foam?:number, roughness?:number, opacity?:number, transparent?:boolean, envIntensity?:number, side?:number}} o */
export function makeWaterMaterial(o = {}) {
    const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(o.deep ?? '#22332f'), roughness: o.roughness ?? 0.06, metalness: 0,
        transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent, side: o.side ?? THREE.FrontSide,
    });
    m.name = 'water';
    // Ordinary/spot geometry without the optional mask keeps its existing foam.
    m.defaultAttributeValues = { ...m.defaultAttributeValues, aFoamReliable: [1] };
    m.envMap = ENV; m.envMapIntensity = (o.envIntensity ?? 1) * ENV_I;
    m.userData.envScale = o.envIntensity ?? 1;
    const U = m.userData.waterU = {
        uWTime: U_TIME, uWFlow: { value: new THREE.Vector2(...(o.flow ?? [0, 0])) },
        uWRipple: { value: o.ripple ?? 1 }, uWWave: { value: o.wave ?? 1 }, uWFoam: { value: o.foam ?? 1 },
        uWShallow: { value: new THREE.Color(o.shallow ?? '#3d5249') }, uWDeep: { value: new THREE.Color(o.deep ?? '#22332f') },
    };
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aShore; attribute float aFoamReliable;\nvarying vec3 vWWorld; varying float vWShore; varying float vWFoamReliable;')
            .replace('#include <project_vertex>', `#include <project_vertex>
                vWWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vWFoamReliable = aFoamReliable;
                #ifdef W_SHORE
                    vWShore = aShore;
                #else
                    vWShore = 99.0;
                #endif`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float uWTime, uWRipple, uWWave, uWFoam; uniform vec2 uWFlow; uniform vec3 uWShallow, uWDeep;
                varying vec3 vWWorld; varying float vWShore; varying float vWFoamReliable;
                float wH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                vec2 wNg(vec2 p){ // value-noise gradient (analytic)
                    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
                    float a = wH(i), b = wH(i + vec2(1, 0)), c = wH(i + vec2(0, 1)), d = wH(i + vec2(1, 1));
                    return vec2((b - a + (a - b - c + d) * u.y) * du.x, (c - a + (a - b - c + d) * u.x) * du.y); }
                // slope (dh/dx, dh/dz) of the water surface at p (m), time t
                vec2 wSlope(vec2 p, float t, float fade){
                    vec2 g = vec2(0.0); vec2 q = p - uWFlow * t;
                    // wind waves: 6 directions, wavelengths 0.6–3.4 m, phase speed ~ sqrt(g λ / 2π)
                    for (int i = 0; i < 6; i++) {
                        float fi = float(i), ang = fi * 1.07 + 0.4, lam = 3.4 * pow(0.7, fi);
                        vec2 dir = vec2(cos(ang), sin(ang)); float k = 6.2832 / lam, w = sqrt(9.81 * k);
                        float amp = 0.0035 * lam * uWWave; // slope ≈ 0.022 per wave: calm river / lake chop
                        float fw = 1.0 - smoothstep(lam * 0.12, lam * 0.4, fade); // (each wave fades out before it aliases)
                        g += dir * (amp * k * cos(dot(dir, q) * k - w * t + fi * 1.7)) * fw;
                    }
                    // the noise octaves (0.6 m / 0.23 m) fade out by their own size: from the drone they read as salt-and-
                    // pepper sparkle over Lake Floreasca (after round 6)
                    g += (wNg(q * 1.7 + t * 0.15) * 0.03 * (1.0 - smoothstep(0.07, 0.22, fade)) + wNg(q * 4.3 - t * 0.21) * 0.015 * (1.0 - smoothstep(0.03, 0.09, fade))) * uWRipple;
                    return g; }`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                // ripple normal (world → view); fade with the screen-space footprint so far water stays calm, no shimmer
                float wFp = length(fwidth(vWWorld.xz));
                float wFade = 1.0 - smoothstep(0.08, 0.6, wFp);
                vec2 wS = wSlope(vWWorld.xz, uWTime, wFp); // (per-octave fades from the pixel footprint)
                vec3 wNw = normalize(vec3(-wS.x, 1.0, -wS.y));
                normal = normalize((viewMatrix * vec4(wNw, 0.0)).xyz);
                // body colour: shallow near the shore, deep away from it and for steep views
                float wNv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
                // Coarse faces without a defensible interpolated shoreline band also lack a defensible shallow tint.
                float wEdge = (1.0 - smoothstep(0.0, 6.0, vWShore)) * clamp(vWFoamReliable, 0.0, 1.0);
                diffuseColor.rgb = mix(uWDeep, uWShallow, wEdge * 0.8) * (0.75 + 0.25 * (1.0 - wNv));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.85, 0.85), wFoam);`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                // shoreline foam: a broken band along the edge, drifting with the flow
                vec2 wFq = (vWWorld.xz - uWFlow * uWTime) * 2.3; vec2 wFi = floor(wFq), wFf = fract(wFq); wFf = wFf * wFf * (3.0 - 2.0 * wFf);
                float wFn = mix(mix(wH(wFi), wH(wFi + vec2(1, 0)), wFf.x), mix(wH(wFi + vec2(0, 1)), wH(wFi + vec2(1, 1)), wFf.x), wFf.y);
                float wFoam = uWFoam * clamp(vWFoamReliable, 0.0, 1.0) * (1.0 - smoothstep(0.1, 0.9, vWShore)) * smoothstep(0.45, 0.8, wFn) * 0.85;
                roughnessFactor = mix(roughnessFactor, 0.85, wFoam);`)
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                #if NUM_POINT_LIGHTS > 0
                { // lamp streaks on the water: narrow across the view, long toward the viewer
                    vec3 P = - vViewPosition, V = normalize(vViewPosition), R = reflect(-V, normal), T = normalize(cross(normal, V) + 1e-5);
                    vec3 acc = vec3(0.0);
                    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
                        vec3 Lv = pointLights[i].position - P; float dl = max(length(Lv), 1e-3); vec3 Ld = Lv / dl;
                        float att = 1.0 - smoothstep(pointLights[i].distance * 0.8, pointLights[i].distance * 2.5, dl);
                        vec3 dv = Ld - R; float a = dot(dv, T); float b = length(dv - a * T);
                        acc += pointLights[i].color * att * exp(-a * a * 900.0 - b * b * 25.0);
                    }
                    float fr = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, V), 0.0, 1.0), 5.0);
                    reflectedLight.directSpecular += acc * fr * 0.05 * (1.0 - wFoam);
                }
                #endif`);
        if (m.userData.hasShore) sh.vertexShader = '#define W_SHORE\n' + sh.vertexShader;
    };
    m.customProgramCacheKey = () => 'water2' + (m.userData.hasShore ? 's' : '');
    MATS.add(m);
    // Tourist scene cleanup calls Material.dispose directly through disposeTree.
    m.addEventListener('dispose', () => MATS.delete(m));
    return m;
}

/**
 * Per-vertex distance (m) to the water body's edge, stored as the `aShore` attribute (foam, shallow tint, darker
 * edges). The edge = boundary edges of the mesh (edges used by one triangle). Exact at vertices; meshes need vertices
 * inside the body (a 2-triangle strip only gets 0 at all corners — tessellate lakes/rivers to a few metres).
 * Call before first render; the material must then be told: material.userData.hasShore = true (done here when given).
 */
export function computeShoreDistance(geometry, { maxD = 40, material = null, sourceSampler = null } = {}) {
    if (sourceSampler) {
        const result = sourceShoreAttribute(geometry.attributes.position, geometry.index, sourceSampler);
        geometry.setAttribute('aShore', new THREE.BufferAttribute(result.distances, 1));
        geometry.setAttribute('aFoamReliable', new THREE.BufferAttribute(result.foamReliable, 1));
        geometry.userData.sourceShoreAudit = result.audit;
        if (material) { material.userData.hasShore = true; material.needsUpdate = true; }
        return result.distances;
    }
    const pos = geometry.attributes.position, n = pos.count;
    // weld by position (non-indexed / split meshes) so interior edges are recognised as shared
    let idx = geometry.index ? geometry.index.array : null;
    if (!idx) { const map = new Map(), ix = new Uint32Array(n); for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * 100) + ',' + Math.round(pos.getZ(i) * 100); let j = map.get(k); if (j === undefined) map.set(k, j = i); ix[i] = j; } idx = ix; }
    const tri = idx ? idx.length / 3 : n / 3, key = (a, b) => (a < b ? a * n + b : b * n + a), cnt = new Map();
    const vi = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
    for (let t = 0; t < tri; t++) for (let k = 0; k < 3; k++) { const e = key(vi(t, k), vi(t, (k + 1) % 3)); cnt.set(e, (cnt.get(e) || 0) + 1); }
    const segs = []; for (const [e, c] of cnt) if (c === 1) { const a = Math.floor(e / n), b = e % n; segs.push([pos.getX(a), pos.getZ(a), pos.getX(b), pos.getZ(b)]); }
    // spatial hash of boundary segments
    const C = 16, grid = new Map(), put = (cx, cz, s) => { const k = cx + ',' + cz; (grid.get(k) || grid.set(k, []).get(k)).push(s); };
    for (const s of segs) for (let cx = Math.floor(Math.min(s[0], s[2]) / C); cx <= Math.floor(Math.max(s[0], s[2]) / C); cx++) for (let cz = Math.floor(Math.min(s[1], s[3]) / C); cz <= Math.floor(Math.max(s[1], s[3]) / C); cz++) put(cx, cz, s);
    const out = new Float32Array(n), R = Math.ceil(maxD / C);
    for (let i = 0; i < n; i++) {
        const x = pos.getX(i), z = pos.getZ(i), cx = Math.floor(x / C), cz = Math.floor(z / C); let best = maxD;
        for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (const s of grid.get((cx + a) + ',' + (cz + b)) || []) {
            const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2));
            const d = Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t); if (d < best) best = d;
        }
        out[i] = best;
    }
    geometry.setAttribute('aShore', new THREE.BufferAttribute(out, 1));
    if (material) { material.userData.hasShore = true; material.needsUpdate = true; }
    return out;
}

/**
 * Split triangles (longest-edge bisection) until no edge is longer than maxEdge (m); returns a new non-indexed
 * geometry (position + normal up). Use before computeShoreDistance on coarse water polygons (2-triangle strips,
 * OSM polygons triangulated without interior points). ~area / (maxEdge² / 2) triangles.
 */
export function subdivideWater(geometry, maxEdge = 4, maxTris = 60000) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry, P = g.attributes.position.array, out = [];
    const stack = []; for (let i = 0; i < P.length; i += 9) stack.push(Array.from(P.slice(i, i + 9)));
    const m2 = maxEdge * maxEdge;
    while (stack.length) {
        const t = stack.pop();
        const e = [[0, 3], [3, 6], [6, 0]].map(([a, b]) => (t[a] - t[b]) ** 2 + (t[a + 1] - t[b + 1]) ** 2 + (t[a + 2] - t[b + 2]) ** 2);
        const k = e[0] >= e[1] && e[0] >= e[2] ? 0 : e[1] >= e[2] ? 1 : 2;
        if (e[k] <= m2 || out.length / 9 + stack.length > maxTris) { out.push(...t); continue; }
        const A = [0, 3, 6][k], B = [3, 6, 0][k], C = [6, 0, 3][k];
        const M = [(t[A] + t[B]) / 2, (t[A + 1] + t[B + 1]) / 2, (t[A + 2] + t[B + 2]) / 2];
        const v = (i) => [t[i], t[i + 1], t[i + 2]];
        stack.push([...v(A), ...M, ...v(C)], [...M, ...v(B), ...v(C)]);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    const nrm = new Float32Array(out.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    ng.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (g.attributes.color) { /* vertex colours are not carried over: water colour comes from the material */ }
    return ng;
}

/** render.js: environment (PMREM) for all water materials, current and future */
export function setWaterEnv(tex, intensity = 1) {
    ENV = tex; ENV_I = intensity;
    for (const m of MATS) { if (m.envMap !== tex) { m.envMap = tex; m.needsUpdate = true; } m.envMapIntensity = (m.userData.envScale || 1) * intensity; }
}
/** render.js: advance the shared water time (seconds) */
export function tickWater(dt) { U_TIME.value = (U_TIME.value + dt) % 3600; }
/** forget a material (scene disposal) */
export function disposeWater(m) { MATS.delete(m); m.dispose(); }
