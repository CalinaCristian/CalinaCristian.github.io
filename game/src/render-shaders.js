// Renderer3D shader code: the aerial-perspective fog chunks (patched into THREE.ShaderChunk on load), the sky
// dome material, the final composite and environment blend passes, and the wet-road / snow / bare-tree patches for
// surface and tree-crown materials.
import * as THREE from '../vendor/three.module.min.js';
import { installNormalGuard } from './normal-guard.js';


// ---------------------------------------------------------------------------
//  Aerial perspective (replaces three's FogExp2 for every material; linear THREE.Fog is untouched).
//  Beer–Lambert by view distance (not depth: no fog change when the head turns) with extinction fogDensity at
//  ground level in a haze layer of scale height FOG_H, so tall landmarks and far ridges keep contrast; the far blend
//  colour is the horizon sky (scene.fog.color, set by _applyLighting).
// ---------------------------------------------------------------------------
const FOG_H = 1100;
{
    const C = THREE.ShaderChunk;
    // Keep the face-normal fallback valid in Ultra's smooth normal-only pass too.
    installNormalGuard(THREE);
    C.fog_pars_vertex = `#ifdef USE_FOG
        varying float vFogDepth;
        #ifdef FOG_EXP2
            varying float vFogH; varying vec3 vFogV;
        #endif
    #endif`;
    C.fog_vertex = `#ifdef USE_FOG
        #ifdef FOG_EXP2
            // distance is computed per fragment from the (linearly interpolated) view vector: a per-vertex length()
            // interpolated across a large ground triangle overestimates it many times near the camera
            vFogDepth = - mvPosition.z; vFogV = mvPosition.xyz;
            vFogH = (transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz)).y;
        #else
            vFogDepth = - mvPosition.z;
        #endif
    #endif`;
    C.fog_pars_fragment = `#ifdef USE_FOG
        uniform vec3 fogColor;
        varying float vFogDepth;
        #ifdef FOG_EXP2
            uniform float fogDensity;
            varying float vFogH; varying vec3 vFogV;
        #else
            uniform float fogNear;
            uniform float fogFar;
        #endif
    #endif`;
    C.fog_fragment = `#ifdef USE_FOG
        #ifdef FOG_EXP2
            float fgK = ${(1 / FOG_H).toFixed(7)};
            float fgA = max(cameraPosition.y, 0.0) * fgK, fgB = max(vFogH, 0.0) * fgK, fgD = fgB - fgA;
            float fgL = abs(fgD) > 1e-3 ? (exp(-fgA) - exp(-fgB)) / fgD : exp(-fgA);
            // a negative density marks a frame drawn from inside a roofed interior (spots/precip-shelter.js): the first 30 m
            // of every view ray (the room) stay clear and the weather fog acts only beyond, so the street seen through a
            // door keeps its fog. (keep the literal "fogDensity * length": sea-common.js patches it)
            float fgClr = fogDensity < 0.0 ? 30.0 : 0.0;
            float fogFactor = 1.0 - exp(-abs(fogDensity * length(vFogV)) * max(1.0 - fgClr / max(length(vFogV), 1e-3), 0.0) * fgL);
        #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`;
}

// ---------------------------------------------------------------------------
//  Sky
// ---------------------------------------------------------------------------
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // at far plane
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uCloudLit, uCloudDark;
uniform float uCover, uTime, uSunSize, uSunPower, uHaze, uNight;
uniform vec3 uMoonDir;
uniform vec2 uCloudOff; uniform float uFlash;
varying vec3 vDir;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++){ s += a * noise(p); p = r * p; a *= 0.5; } return s; }
void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    float mu = max(dot(d, uSunDir), 0.0);
    // Rayleigh-ish: deep zenith, bright desaturated horizon, warmer toward the sun
    float hp = max(h, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(hp, 0.42));
    col = mix(col, uHorizon * 1.08, exp(-hp * 18.0) * uHaze);            // horizon haze band
    col += uSunColor * (pow(mu, 6.0) * 0.28 + pow(mu, 48.0) * 0.5) * (1.0 - uCover * 0.6); // mie glow
    // below horizon: fade to ground-tinted haze (mostly hidden by terrain)
    col = mix(col, mix(uHorizon, uGround, 0.6), smoothstep(0.0, -0.25, h));
    // sun disc (HDR, blooms)
    float disc = 1.0 - smoothstep(uSunSize * 0.8, uSunSize, acos(clamp(dot(d, uSunDir), -1.0, 1.0)));
    float sunVis = 1.0;
    // clouds: planar layer
    if (h > -0.02) {
        vec2 uv = d.xz / (h + 0.09) * 0.55 + uCloudOff; // offset accumulated on the CPU from the wind
        float n = fbm(uv * 1.3);
        float n2 = fbm(uv * 1.3 + uSunDir.xz * 0.08);
        float cov = mix(0.62, 0.05, uCover);
        float dens = smoothstep(cov, cov + 0.32, n);
        float shade = clamp(0.5 + (n - n2) * 3.0, 0.0, 1.0);
        vec3 cc = mix(uCloudDark, uCloudLit, shade);
        cc += uSunColor * pow(mu, 10.0) * 0.5 * (1.0 - dens) * (1.0 - uCover);    // silver lining
        if (uCover > 0.85) { cc = mix(uCloudDark, uCloudLit, 0.35 + 0.65 * fbm(uv * 0.7 + 3.1)); dens = mix(dens, 1.0, (uCover - 0.85) / 0.15); }
        float fade = smoothstep(-0.02, 0.22, h);
        dens *= fade;
        col = mix(col, cc, dens * 0.95);
        col = mix(col, uHorizon, (1.0 - fade) * uCover * 0.9);
        sunVis = 1.0 - dens;
    }
    col += uSunColor * disc * uSunPower * sunVis;
    if (uNight > 0.01) {
        // stars (fade near the horizon and behind clouds) + moon
        vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 160.0;
        vec2 cell = floor(sp); float hs = hash(cell);
        vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
        float sd = length(fract(sp) - 0.5 - off * 0.6);
        float star = step(0.985, hs) * smoothstep(0.12, 0.0, sd) * (0.5 + 0.5 * sin(uTime * (1.0 + hs * 3.0) + hs * 40.0));
        col += vec3(0.8, 0.85, 1.0) * star * 2.5 * uNight * sunVis * smoothstep(0.02, 0.25, h);
        float md = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
        col += vec3(0.85, 0.88, 0.95) * (1.0 - smoothstep(0.016, 0.019, md)) * 3.5 * uNight * (0.3 + 0.7 * sunVis);
        col += vec3(0.25, 0.3, 0.45) * pow(max(dot(d, uMoonDir), 0.0), 60.0) * 0.25 * uNight;
    }
    col += vec3(0.75, 0.8, 1.0) * uFlash * (0.35 + 0.65 * smoothstep(-0.05, 0.35, h)); // lightning
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

export function makeSkyMaterial() {
    return new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
        uniforms: {
            uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
            uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
            uCover: { value: 0.4 }, uTime: { value: 0 }, uSunSize: { value: 0.012 }, uSunPower: { value: 30 }, uHaze: { value: 0.6 },
            uNight: { value: 0 }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
            uCloudOff: { value: new THREE.Vector2() }, uFlash: { value: 0 },
        },
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    });
}

// ---------------------------------------------------------------------------
//  Final pass: windshield rain droplets + vignette + grain (display space)
// ---------------------------------------------------------------------------
export const FinalShader = {
    uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
        uVignette: { value: 0.28 }, uGrain: { value: 0.035 }, uGrade: { value: new THREE.Vector2(1.08, 1.05) },
        uRain: { value: 0 }, uH: { value: new THREE.Matrix3() }, uWs: { value: new THREE.Vector3(0.9, 0.76, 0.69) },
        uWp0: { value: new THREE.Vector3() }, uWp1: { value: new THREE.Vector3() },
        uWiper: { value: new THREE.Vector4(0.04, 1.72, 0.42, 1.7) }, uWT: { value: 0 }, uRainT: { value: 0 },
        uMask: { value: new THREE.Vector4(2, 2, -2, -2) }, // screen rect (uv min.xy, max.xy) kept dry: the rear-view mirror
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uRain, uWT, uRainT; uniform vec2 uRes, uGrade;
uniform mat3 uH; uniform vec3 uWs, uWp0, uWp1; uniform vec4 uWiper, uMask;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 h42(vec2 p){ vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float passTime(vec2 p, vec3 w){
    vec2 d = p - w.xy; float r = length(d);
    if (r > w.z || r < w.z * 0.12) return 1e5;
    float a = atan(d.y, d.x);
    if (a < uWiper.x || a > uWiper.y) return 1e5;
    float u = (a - uWiper.x) / (uWiper.y - uWiper.x);
    float tUp = uWiper.z * u, tDn = uWiper.z * (2.0 - u), ct = uWT;
    if (ct >= tDn) return ct - tDn;
    if (ct >= tUp) return ct - tUp;
    return ct + uWiper.w - tDn;
}
float since(vec2 p){ return min(uRainT, min(passTime(p, uWp0), passTime(p, uWp1))); }
// one droplet layer; returns (refraction offset xy, coverage z)
vec3 drops(vec2 p, float cell, float rate, float seed, float dens){
    vec2 id = floor(p / cell);
    vec4 h = h42(id + seed);
    if (h12(id * 1.37 + seed) > dens) return vec3(0.0);
    vec2 c = (id + 0.5 + (h.xy - 0.5) * 0.5) * cell;
    float r = cell * (0.1 + 0.22 * h.z * h.z);
    float delay = h.w * rate;
    if (since(c) < delay) return vec3(0.0);
    vec2 q = (p - c) / r; float d = dot(q, q);
    if (d > 1.0) return vec3(0.0);
    return vec3(q * sqrt(1.0 - d), 1.0);
}
void main(){
    vec2 uv = vUv;
    vec3 rainTint = vec3(0.0); float rainAmt = 0.0;
    bool masked = all(greaterThan(uv, uMask.xy)) && all(lessThan(uv, uMask.zw));
    if (uRain > 0.0 && !masked) {
        vec3 hp = uH * vec3(uv * 2.0 - 1.0, 1.0);
        vec2 p = hp.xy / hp.z;
        float hw = mix(uWs.y, uWs.z, clamp(p.y / uWs.x, 0.0, 1.0));
        if (hp.z > 0.0 && p.y > 0.0 && p.y < uWs.x && abs(p.x) < hw) {
            vec3 a = drops(p, 0.034, 6.0, 1.7, 0.75);
            vec3 b = drops(p + 0.011, 0.021, 4.0, 9.3, 0.55);
            vec3 m = drops(p, 0.009, 2.5, 4.1, 0.3);
            vec2 off = (a.xy * 0.02 + b.xy * 0.012 + m.xy * 0.004) * uRain;
            uv -= off * vec2(uRes.y / uRes.x, 1.0) * 1.6;
            rainAmt = max(a.z, max(b.z, m.z * 0.5)) * uRain;
            rainTint = vec3(0.04, 0.05, 0.06) * (a.z * (1.0 - length(a.xy)) + b.z * 0.5);
        }
    }
    vec3 col = texture2D(tDiffuse, uv).rgb;
    col = mix(col, col * 0.9 + rainTint * 4.0, rainAmt * 0.5);
    // grade: saturation + contrast (display space)
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp((mix(vec3(l), col, uGrade.x) - 0.5) * uGrade.y + 0.5, 0.0, 1.0);
    // vignette
    vec2 v = vUv - 0.5; v.x *= uRes.x / uRes.y;
    col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(v));
    // grain (luma-weighted)
    float g = h12(vUv * uRes + fract(uTime * 7.31) * 517.0) - 0.5;
    col += g * uGrain * (0.35 + 0.65 * (1.0 - dot(col, vec3(0.299, 0.587, 0.114))));
    gl_FragColor = vec4(col, 1.0);
}`,
};

// PMREM cross-fade: texel-exact mix of two CubeUV atlases of the same size
export const EnvBlendShader = {
    uniforms: { tA: { value: null }, tB: { value: null }, uT: { value: 0 } },
    vertexShader: /* glsl */`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D tA, tB; uniform float uT;
        void main(){ ivec2 p = ivec2(gl_FragCoord.xy); gl_FragColor = mix(texelFetch(tA, p, 0), texelFetch(tB, p, 0), uT); }`,
};

// ---------------------------------------------------------------------------
//  Weather / season surface patches (world materials). Injected once at setScene; everything sits behind a
//  uniform branch (uWxOn), so clear summer weather costs one uniform test per fragment.
// ---------------------------------------------------------------------------
export const makeSurfU = () => ({
    uWxOn: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 }, uSeasonTint: { value: new THREE.Color(1, 1, 1) },
    uWetSky: { value: new THREE.Color(0, 0, 0) }, uPuddle: { value: 0 }, uSnowFlat: { value: 0 },
});
function chainPatch(mat, tag, fn) {
    if (mat.userData.wxPatch) return false;
    mat.userData.wxPatch = tag;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); fn(sh); };
    mat.customProgramCacheKey = function () { return prevKey.call(this) + '|' + tag; };
    mat.needsUpdate = true;
    return true;
}
const UP_VIEW = 'normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)';
// wet-road light streaks: every real light (street-lamp pool, headlights) leaves a reflection that is narrow across
// the view and long toward the viewer (rough wet film); only compiled into the shader when the scene has such lights
const WET_STREAK = (arr, n, spot) => `
    #if ${n} > 0
    for (int i = 0; i < ${n}; i++) {
        vec3 Lv = ${arr}[i].position - wxP; float dl = max(length(Lv), 1e-3); vec3 Ld = Lv / dl;
        // the mirror image of a lamp keeps the lamp's own brightness: no inverse-square falloff, only a range window
        float att = 1.0 - smoothstep(${arr}[i].distance * 0.7, ${arr}[i].distance * 1.6, dl);
        ${spot ? `att *= getSpotAttenuation(${arr}[i].coneCos, ${arr}[i].penumbraCos, dot(-Ld, ${arr}[i].direction));` : ''}
        if (att <= 0.0) continue;
        vec3 dv = Ld - wxR; float a = dot(dv, wxT); float b = length(dv - a * wxT);
        wxSpec += ${arr}[i].color * att * exp(-a * a * wxSa - b * b * wxSb);
    }
    #endif`;
export function patchSurface(mat, U) {
    return chainPatch(mat, 'wxsurf3', (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxPos;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvWxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            varying vec3 vWxPos; uniform float uWxOn, uSnow, uWet, uPuddle, uSnowFlat; uniform vec3 uSeasonTint, uWetSky;
            float wxN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                float a = fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453), b = fract(sin(dot(i + vec2(1, 0), vec2(12.9898, 78.233))) * 43758.5453);
                float c = fract(sin(dot(i + vec2(0, 1), vec2(12.9898, 78.233))) * 43758.5453), d = fract(sin(dot(i + vec2(1, 1), vec2(12.9898, 78.233))) * 43758.5453);
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            float wxUpK = 0.0, wxPud = 0.0;
            if (uWxOn > 0.5) {
                wxUpK = smoothstep(0.55, 0.9, dot(normal, ${UP_VIEW}));
                diffuseColor.rgb *= uSeasonTint;
                if (uWet > 0.0 && wxUpK > 0.0) {
                    // a few small puddles (≈ 1–2 m, a few % of the surface) once soaked; the rest is a uniform wet film
                    // (note 70: large noise puddles read as camouflage blotches)
                    float pn = wxN(vWxPos.xz * 0.85) * 0.6 + wxN(vWxPos.xz * 2.7 + 7.3) * 0.4;
                    wxPud = smoothstep(0.8, 0.88, pn) * uPuddle * smoothstep(0.5, 1.0, uWet) * wxUpK;
                }
                diffuseColor.rgb *= 1.0 - uWet * (0.42 + 0.25 * wxPud) * wxUpK;
                if (uSnow > 0.0) {
                    // verges / roofs / squares: patchy cover growing with depth; driven carriageways (uSnowFlat): an even
                    // grey slush film only, never blotches
                    float n = wxN(vWxPos.xz * 0.45) * 0.6 + wxN(vWxPos.xz * 2.1) * 0.4;
                    float sn = mix(clamp((uSnow * 1.35 - n * (1.0 - uSnow * 0.7)) * 2.2, 0.0, 1.0), uSnow * 0.45, uSnowFlat) * wxUpK;
                    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.93), sn);
                    wxPud *= 1.0 - sn;
                }
            }`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            if (uWxOn > 0.5 && uWet > 0.0) { // wet film / puddles: the sky reflected (Schlick, water F0 0.02)
                float wxNv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
                float fmax = mix(0.22, 0.55, wxPud); // rough film vs standing water: roughness caps the grazing Fresnel
                float fr = 0.02 + (fmax - 0.02) * pow(1.0 - wxNv, 5.0);
                totalEmissiveRadiance += uWetSky * uWet * wxUpK * fr;
            }`)
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
            #if NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0
            if (uWxOn > 0.5 && uWet > 0.0 && wxUpK > 0.0) {
                vec3 wxP = - vViewPosition, wxV = normalize(vViewPosition);
                vec3 wxR = reflect(-wxV, normal), wxT = normalize(cross(normal, wxV) + 1e-5);
                float wxRo = mix(0.05, 0.018, wxPud), wxSa = 1.0 / (wxRo * wxRo), wxSb = wxSa / 30.0;
                vec3 wxSpec = vec3(0.0);
                ${WET_STREAK('pointLights', 'NUM_POINT_LIGHTS', false)}
                ${WET_STREAK('spotLights', 'NUM_SPOT_LIGHTS', true)}
                float fr2 = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, wxV), 0.0, 1.0), 5.0);
                reflectedLight.directDiffuse += wxSpec * uWet * wxUpK * mix(0.4, 1.0, wxPud) * fr2 * 0.06;
            }
            #endif`);
    });
}
export const makeTreeU = () => ({ uBare: { value: 0 }, uAutumn: { value: 0 }, uBlossom: { value: 0 }, uFresh: { value: 0 }, uSnow: { value: 0 }, uEver: { value: 0 }, uCrownC: { value: new THREE.Vector3(0, 5, 0) } });
export function patchCrowns(mat, U) {
    return chainPatch(mat, 'wxtree3', (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBare, uEver; uniform vec3 uCrownC; varying vec3 vCrownL; varying float vTreeH;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vCrownL = position;
                transformed = mix(transformed, uCrownC + (transformed - uCrownC) * vec3(0.8, 0.88, 0.8), uBare * (1.0 - uEver));
                #ifdef USE_INSTANCING
                    vTreeH = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
                #else
                    vTreeH = 0.5;
                #endif`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            uniform float uBare, uAutumn, uBlossom, uFresh, uSnow, uEver; varying vec3 vCrownL; varying float vTreeH;
            float crGone = 0.0; // (willows) 1 where the leaves are gone: bare shoots carry no snow cap
            #ifdef WILLOW_CROWN
                varying float vWillowU; // (spots/willow.js) 0 on the top of the crown, rising to 1 at the tip of a hanging shoot
            #endif
            float crH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
            float crN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix(crH(i), crH(i + vec3(1, 0, 0)), f.x), mix(crH(i + vec3(0, 1, 0)), crH(i + vec3(1, 1, 0)), f.x), f.y),
                           mix(mix(crH(i + vec3(0, 0, 1)), crH(i + vec3(1, 0, 1)), f.x), mix(crH(i + vec3(0, 1, 1)), crH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
            if (uBare + uAutumn + uBlossom + uFresh > 0.0) {
                float h = vTreeH, dec = 1.0 - uEver;
                vec3 g = diffuseColor.rgb; float l = dot(g, vec3(0.3, 0.59, 0.11));
                g = mix(g, g * vec3(1.1, 1.2, 0.72), uFresh * dec);
                vec3 aut = h < 0.3 ? vec3(0.95, 0.7, 0.12) : h < 0.6 ? vec3(0.92, 0.42, 0.08) : h < 0.85 ? vec3(0.55, 0.33, 0.12) : vec3(0.78, 0.17, 0.07);
                #ifdef WILLOW_CROWN
                    aut = mix(vec3(0.98, 0.78, 0.14), vec3(0.86, 0.7, 0.2), h); // (spots/willow.js) weeping willows turn gold, never orange or red
                #endif
                g = mix(g, aut * (l * 1.2 + 0.16), clamp(uAutumn * 1.6 - h * 0.45, 0.0, 1.0) * dec);
                vec3 bc = h > 0.82 ? vec3(1.0, 0.74, 0.84) : vec3(0.96, 0.95, 0.9);
                #ifdef WILLOW_CROWN
                    g = mix(g, g * vec3(1.12, 1.14, 0.62), uBlossom * dec); // (no white or pink blossom: yellow-green catkins and young leaves)
                #else
                    g = mix(g, bc * 0.8, uBlossom * dec * step(0.55, h) * 0.85);
                #endif
                float b = clamp(uBare * 1.25 - h * 0.25, 0.0, 1.0) * dec;
                if (b > 0.0) {
                    // leaves fall in clumps: a coarse 3-D mask keeps solid, fully leafed patches where the mask is above
                    // the bare fraction; where the leaves are gone the crown becomes a soft see-through twig haze (round 6
                    // note 21: the old dithered ridge lattice read as see-through scribbles with holes). The haze is alpha
                    // (render switches bare broadleaf crowns to blended; instances are drawn far → near): densest where the crown faces the
                    // viewer, thinning to a fuzzy outline; the branches inside are real geometry (trees.js branchSkeleton)
                    vec3 cp = vCrownL * (0.9 + 0.2 * h) + h * 11.0;
                    // (owner, 2026-11-11, "they look awful": the clump mask punched sky-blue holes through half-bare crowns,
                    // which read as missing polygons; before that, dark flakes in Bellevue Downtown Park) the fall goes tree by
                    // tree instead: a crown is either fully leafed or fully bare (twig haze + real branches). b already varies
                    // per tree (h), so the street thins out gradually while no single crown shows holes.
                    float gone = step(0.5, b);
                    // the leaves left thin out with the fall too: no opaque clumps floating in an empty crown
                    float leafA = 1.0; // (opaque leaves: translucent ones read as smoky blobs, after round 6)
                    if (gone > 0.0 || leafA < 1.0) {
                        float tw = crN(cp * 1.6) * 0.6 + crN(cp * 4.3 + 3.7) * 0.4;
                        // (facing from the true surface, not the crown's smoothed normals: those still face the viewer where a shell is
                        // seen edge-on, which drew dense haze as thin dark slivers floating round nearby crowns)
                        vec3 hzN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
                        float facing = abs(dot(hzN, normalize(vViewPosition)));
                        float haze = (0.02 + 0.1 * smoothstep(0.15, 0.8, facing)) * (0.3 + 1.2 * tw * tw) * (1.0 - 0.7 * smoothstep(0.02, 0.12, length(fwidth(vCrownL))));
                        #ifdef WILLOW_CROWN
                            // (spots/willow.js) a bare weeping willow keeps its curtain of thin yellow shoots: crisp lines that run
                            // down the hanging tresses (lines of constant bearing round the stem, about 160 a turn, a third left
                            // out), nothing on the top of the crown (haze there read as smoke); far away the lines merge
                            float wAz = atan(vCrownL.z, vCrownL.x) * 25.5, wId = floor(wAz), wW = fwidth(wAz);
                            float wHalf = min(0.09, 0.02 * wW / max(1e-5, length(fwidth(vCrownL)))); // (a shoot stays about 3 cm wide on faces that run along the lines too)
                            float wLine = (1.0 - smoothstep(wHalf, wHalf + wW, abs(fract(wAz) - 0.5 - 0.25 * (crH(vec3(wId, 7.0, 1.0)) - 0.5)))) * step(0.33, crH(vec3(wId, 3.0, floor(h * 9.0))));
                            haze = mix(wLine * 0.95, 0.14, smoothstep(0.25, 0.7, wW)) * smoothstep(0.02, 0.12, vWillowU);
                            crGone = gone;
                        #endif
                        float a = mix(leafA, haze, gone);
                        if (a < 0.02) discard;
                        diffuseColor.a *= a;
                        #ifdef WILLOW_CROWN
                            g = mix(g, vec3(0.56, 0.41, 0.1) * (0.85 + 0.3 * h), gone); // golden-yellow shoots
                        #else
                            g = mix(g, vec3(0.24, 0.205, 0.175) * (0.85 + 0.3 * h), gone); // grey-brown twigs
                        #endif
                    }
                }
                diffuseColor.rgb = g;
            }`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            if (uSnow > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.94), uSnow * (1.0 - crGone) * smoothstep(0.35, 0.85, dot(normal, ${UP_VIEW})) * (0.45 + 0.4 * uEver));`);
    });
}
