// Vehicle materials (split from vehicles.js, spec 22): the shared fleet / parked / parts / body / cockpit materials,
// the environment map and snow registry, and the taxi roof sign. vehicles.js keeps the public API.
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture } from './util.js';
import { drawFitText } from './canvasText.js';

// ---------------------------------------------------------------------------
//  Materials
// ---------------------------------------------------------------------------
export let ENV_MAP = null;
const allMats = new Set();
export function track(m) { allMats.add(m); if (ENV_MAP) { m.envMap = ENV_MAP; m.needsUpdate = true; } return m; }

/** shared emissive decoding (see aMat): k = light factor (1 day / 4.5 night), br = brake 0..1 */
const EMIS_GLSL = `
    float eRaw = vMat.x; float isTail = step(9.5, eRaw) * (1.0 - step(19.5, eRaw)); float isSign = step(19.5, eRaw);
    float eBase = eRaw - 10.0 * isTail - 20.0 * isSign;
    float eK = mix(mix(1.0, 4.5, vLB.x), 2.2, isSign) + isTail * vLB.y * 2.6;
    totalEmissiveRadiance += diffuseColor.rgb * eBase * eK;`;
/** classic (per-mesh) parts material: uLB = (lights, brake) uniform */
function partsMaterial(lights) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 });
    m.userData.uLB = { value: new THREE.Vector2(lights, 0) };
    m.userData.uDirect = { value: 1 };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uLB = m.userData.uLB; sh.uniforms.uDirect = m.userData.uDirect;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nuniform vec2 uLB;\nuniform float uDirect;\n#define vLB uLB')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIS_GLSL);
    };
    m.customProgramCacheKey = () => 'vehicleParts2';
    return track(m);
}
/** instanced fleet material: one draw call per kind × LOD; per instance aPaint (linear rgb) + aLB (lights, brake) */
let FLEET_MAT = null, PARKED_MAT = null;
/** parked lots: same shader, half the sky reflection (dusty, seen from above they otherwise read washed-out next to the matte world) */
export function parkedMaterial() { if (!PARKED_MAT) { PARKED_MAT = addSnow(newFleetMaterial(0.5), SNOW_PARKED); PARKED_MAT.userData.envScale = 0.5; PARKED_MAT.roughness = 1.6; PARKED_MAT.metalness = 0.4; } return PARKED_MAT; } // (roughness / metalness scale the per-vertex aMat values: paint 0.32 → 0.51, metal 0.3 → 0.12)
export function fleetMaterial() { return FLEET_MAT || (FLEET_MAT = addSnow(newFleetMaterial(1.05))); }
function newFleetMaterial(envI) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: envI });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute vec3 aPaint;\nattribute vec2 aLB;\nvarying vec4 vMat;\nvarying vec2 vLB;')
            .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(color.rgb, aPaint, aMat.w);')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vLB = aLB;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nvarying vec2 vLB;')
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y;')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIS_GLSL);
    };
    m.customProgramCacheKey = () => 'vehicleFleet';
    m.userData.envScale = envI;
    return track(m);
}
/**
 * Cockpit interior material: like partsMaterial, plus a night "cabin glow" (uGlow 0..1): instrument/screen backlight
 * falling off with distance from the dash, a dim cool cabin fill so the interior never goes pitch black, and
 * aMat.x emitters (ambient strips) that only light up with the glow. uOff = mesh origin in cockpit space.
 */
export function cockpitMaterial(off = new THREE.Vector3()) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1 });
    m.userData.uDirect = { value: 1 };
    m.userData.uGlow = { value: 0 };
    m.userData.uOff = { value: off.clone() };
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uDirect = m.userData.uDirect; sh.uniforms.uGlow = m.userData.uGlow; sh.uniforms.uOff = m.userData.uOff;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vCab;\nuniform vec3 uOff;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vCab = position + uOff;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vMat;\nvarying vec3 vCab;\nuniform float uDirect;\nuniform float uGlow;')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                // soft-touch grain on matte trim (8 mm cells, ±3 %): reads as leather-grain plastic, not flat paint
                float gn = fract(sin(dot(floor(vCab * 125.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
                float softT = step(0.62, vMat.y);
                diffuseColor.rgb *= 1.0 + softT * (gn - 0.5) * 0.07;`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMat.y * (1.0 + softT * (gn - 0.5) * 0.12);')
            .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMat.z;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                if (uGlow > 0.0) {
                    vec3 base = max(diffuseColor.rgb, vec3(0.035));
                    float gc = exp(-length((vCab - vec3(-0.3, 1.09, -1.15)) * vec3(1.0, 1.4, 1.0)) * 3.2); // gauge cluster
                    float gs = exp(-length(vCab - vec3(0.07, 1.04, -1.15)) * 3.6);                       // centre screen
                    float fill = 0.55 + 0.45 * smoothstep(0.5, 1.8, vCab.y);                              // city glow through the glass
                    vec3 glow = vec3(1.0, 0.72, 0.5) * gc * 0.7 + vec3(0.45, 0.65, 1.0) * gs * 0.5 + vec3(0.30, 0.36, 0.5) * 0.12 * fill;
                    totalEmissiveRadiance += (base * glow + diffuseColor.rgb * vMat.x * 2.5) * uGlow;
                }`);
    };
    m.customProgramCacheKey = () => 'cockpitInterior2';
    return track(m);
}
const partsMats = [[partsMaterial(0), partsMaterial(1)], [null, null]]; // [lights][brake]
export function partsMat(light, brake) {
    const L = light ? 1 : 0, B = brake ? 1 : 0;
    if (!partsMats[B]) partsMats[B] = [null, null];
    if (!partsMats[B][L]) { partsMats[B][L] = partsMaterial(L); partsMats[B][L].userData.uLB.value.y = B; }
    return partsMats[B][L];
}
const bodyMats = {};
export function bodyMat(color) {
    return bodyMats[color] || (bodyMats[color] = track(addSnow(new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.3, envMapIntensity: 1.1 }))));
}

// ---------------------------------------------------------------------------
//  Snow on cars (render Request): roofs / bonnets / boots (up-facing surfaces) turn white with the snow cover.
//  Two shared uniforms (parked cars full, moving fleet lighter); injected into every vehicle material, no extra draws.
// ---------------------------------------------------------------------------
const SNOW_PARKED = { value: 0 }, SNOW_MOVING = { value: 0 };
/** snow cover 0..1 (render.js: the weather's snowCover); moving cars get ~55 % of it */
export function setVehicleSnow(k = 0) { k = Math.max(0, Math.min(1, +k || 0)); SNOW_PARKED.value = k; SNOW_MOVING.value = k * 0.55; }
function addSnow(m, uni = SNOW_MOVING) {
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
        prev?.call(m, sh, r);
        sh.uniforms.uSnow = uni;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSnowY;')
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
                { vec3 snN = objectNormal;
                #ifdef USE_INSTANCING
                  snN = mat3(instanceMatrix) * snN;
                #endif
                  vec3 snW = mat3(modelMatrix) * snN; vSnowY = dot(snW, snW) > 1e-10 ? normalize(snW).y : 0.0; }`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSnowY;\nuniform float uSnow;')
            .replace('#include <normal_fragment_begin>', `float snK = uSnow * smoothstep(0.45, 0.85, vSnowY);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), snK); roughnessFactor = mix(roughnessFactor, 0.8, snK); metalnessFactor *= 1.0 - snK;
                #include <normal_fragment_begin>`);
    };
    const base = prevKey ? prevKey.call(m) : '';
    m.customProgramCacheKey = () => base + '|snow' + (uni === SNOW_PARKED ? 'P' : 'M');
    return m;
}

/** Give every vehicle material (existing and future) an environment map for reflections (call after PMREM). */
export function setVehicleEnvMap(tex, intensity = 1) {
    ENV_MAP = tex;
    for (const m of allMats) { m.envMap = tex; m.envMapIntensity = (m.userData.envScale || 1) * intensity; m.needsUpdate = true; }
}

// taxi sign + police lamps (shared)
let taxiSign = null;
export function getTaxiSign() {
    if (taxiSign) return taxiSign;
    const tex = makeCanvasTexture(256, 96, (ctx, w, h) => {
        ctx.fillStyle = '#ffd400'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#111'; ctx.fillRect(0, h - 10, w, 10);
        ctx.textAlign = 'center'; ctx.fillStyle = '#111';
        drawFitText(ctx, 'TAXI', w / 2, (h - 10) / 2, w - 24, { maxSize: 72, minSize: 20, maxHeight: h - 18, lineHeight: 1, font: (s) => `bold ${s}px "Helvetica Neue", Arial, sans-serif`, label: 'taxi sign' });
    });
    const dark = new THREE.MeshBasicMaterial({ color: '#c9a800' });
    const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25) });
    const geo = new THREE.BoxGeometry(0.8, 0.22, 0.24);
    // BoxGeometry makes six material groups; contiguous faces share the same two materials.
    geo.clearGroups(); geo.addGroup(0, 24, 0); geo.addGroup(24, 12, 1);
    taxiSign = { geo, mats: [dark, face] };
    return taxiSign;
}
