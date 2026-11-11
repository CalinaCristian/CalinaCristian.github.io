import * as THREE from '../vendor/three.module.min.js';
import { installNormalGuard } from './normal-guard.js';
import { EffectComposer } from '../vendor/addons/EffectComposer.js';
import { RenderPass } from '../vendor/addons/RenderPass.js';
import { ShaderPass } from '../vendor/addons/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/addons/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/OutputPass.js';
import { SMAAPass } from '../vendor/addons/SMAAPass.js';
import { FXAAShader } from '../vendor/addons/FXAAShader.js';
import { FullScreenQuad } from '../vendor/addons/Pass.js';
import { Rain, Snow, solarPosition, dirFromElAz, skyState, classifyWMO, fetchLiveWeather, climateWeather, nearestClimate, weatherTargets, seasonState, WEATHER_PRESETS, WEATHER_TTL_MS } from './weather.js';
import { setVehicleEnvMap, setVehicleSnow } from './vehicles.js';
import { setWaterEnv, tickWater } from './water.js';
import { progressivePMREM, supportsProgressivePMREM } from './progressive-pmrem.js';
import { CockpitDisplays, displayPixelRatio } from './cockpit-displays.js';

// ============================================================================
//  Renderer3D — WebGL renderer + sky + sun/shadows + post-processing + weather
//  + adaptive quality. main.js keeps its own scene/camera; this module owns how
//  a frame gets drawn.
// ============================================================================

/** quality ladder, best → cheapest. Auto mode moves between AUTO_MIN..AUTO_MAX. */
export const QUALITY_LADDER = [
    { name: 'ultra', pr: 2.0, shadow: 4096, post: 'full', aa: 'smaa', ao: true, lamps: 24 },
    { name: 'high', pr: 1.5, shadow: 4096, post: 'full', aa: 'smaa', ao: false, lamps: 16 },
    { name: 'high-', pr: 1.25, shadow: 2048, span: 140, post: 'full', aa: 'smaa', ao: false, lamps: 12 },
    { name: 'medium', pr: 1.0, shadow: 2048, span: 120, post: 'lite', aa: 'fxaa', ao: false, lamps: 8 },
    { name: 'low+', pr: 1.0, shadow: 0, post: 'lite', aa: 'fxaa', ao: false, lamps: 4 },
    { name: 'low', pr: 1.0, shadow: 0, post: 'off', aa: 'none', ao: false, lamps: 0 },
];
const NAMED = { ultra: 0, high: 1, medium: 3, low: 5 };
const AUTO_MAX = 1, AUTO_MIN = 5; // auto never enables 'ultra' (GTAO doubles the draw calls)
const SHADOW_SPAN = 160; // metres covered by the sun's shadow map (tier.span overrides: fewer casters, sharper texels on cheaper tiers)
const LAMP_RANGE = 150;  // light-pool discs drawn within this distance (m)
const DISC_GAIN = 7;     // light-pool disc: lit surface × (1 + gain × falloff × lamp colour) at the pool centre
const MAX_DISCS = 220;
// street-lamp real lights (PointLight pool): assignment is hysteretic and every change fades, so nothing pops
const LAMP_LIGHT_I = 55;         // candela at full weight
const LAMP_LIGHT_NEAR = 55, LAMP_LIGHT_FAR = 85; // a light's intensity fades out with distance to the car over this band
const LAMP_ASSIGN_R = 80;        // lamps considered for a real light (m)
const LAMP_FADE_S = 0.4;         // fade-in / fade-out time of one real light
const LAMP_ASSIGN_DT = 0.2;      // re-selection period (s)
const LAMP_MAX_NEW = 2;          // at most this many new lights per re-selection (≤ 10 / s)
const NIGHT_FADE_S = 1.5;        // dusk switch / setLampLightsEnabled fade
const ENV_REBUILD_DEG = 3;       // PMREM environment rebuilt when the sun moved more than this …
const ENV_FADE_S = 1.5;          // … and cross-faded from the previous one over this time
const SHADOW_DIR_DEG = 0.15;     // sun direction used for shadows is quantised (no slow shadow crawl)
const WX_TAU = 3.3;              // weather transitions: exponential, ~95 % after 10 s
const WET_DRY_S = 1800;          // roads stay wet ~30 min after the rain stops
const sky0 = new THREE.Color('#888888');
const WX_TRANSITION_KEYS = ['cloud', 'rain', 'snow', 'snowCover', 'sunMul', 'fogDens', 'windX', 'windZ'];
// fixed direction set (Fibonacci sphere) + SH basis for the ambient probe projection
const AMB_DIRS = (() => {
    const N = 192, out = [], b = new Array(9).fill(0), v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
        const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
        v.set(Math.cos(a) * r, y, Math.sin(a) * r); THREE.SphericalHarmonics3.getBasisAt(v, b);
        out.push({ x: v.x, y: v.y, z: v.z, b: b.slice() });
    }
    return out;
})();
const OVERRIDES = { day: { el: 48, az: 200 }, sunset: { el: 3, az: 290 }, dusk: { el: -4, az: 300 }, night: { el: -28, az: 350 }, dawn: { el: 2.5, az: 75 } };

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
            float fogFactor = 1.0 - exp(-fogDensity * length(vFogV) * fgL);
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

function makeSkyMaterial() {
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
const FinalShader = {
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
const EnvBlendShader = {
    uniforms: { tA: { value: null }, tB: { value: null }, uT: { value: 0 } },
    vertexShader: /* glsl */`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D tA, tB; uniform float uT;
        void main(){ ivec2 p = ivec2(gl_FragCoord.xy); gl_FragColor = mix(texelFetch(tA, p, 0), texelFetch(tB, p, 0), uT); }`,
};

// ---------------------------------------------------------------------------
//  Weather / season surface patches (world materials). Injected once at setScene; everything sits behind a
//  uniform branch (uWxOn), so clear summer weather costs one uniform test per fragment.
// ---------------------------------------------------------------------------
const makeSurfU = () => ({
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
function patchSurface(mat, U) {
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
const makeTreeU = () => ({ uBare: { value: 0 }, uAutumn: { value: 0 }, uBlossom: { value: 0 }, uFresh: { value: 0 }, uSnow: { value: 0 }, uEver: { value: 0 }, uCrownC: { value: new THREE.Vector3(0, 5, 0) } });
function patchCrowns(mat, U) {
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
                g = mix(g, aut * (l * 1.2 + 0.16), clamp(uAutumn * 1.6 - h * 0.45, 0.0, 1.0) * dec);
                vec3 bc = h > 0.82 ? vec3(1.0, 0.74, 0.84) : vec3(0.96, 0.95, 0.9);
                g = mix(g, bc * 0.8, uBlossom * dec * step(0.55, h) * 0.85);
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
                        float a = mix(leafA, haze, gone);
                        if (a < 0.02) discard;
                        diffuseColor.a *= a;
                        g = mix(g, vec3(0.24, 0.205, 0.175) * (0.85 + 0.3 * h), gone); // grey-brown twigs
                    }
                }
                diffuseColor.rgb = g;
            }`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            if (uSnow > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.94), uSnow * smoothstep(0.35, 0.85, dot(normal, ${UP_VIEW})) * (0.45 + 0.4 * uEver));`);
    });
}

// ---------------------------------------------------------------------------
export class Renderer3D {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{quality?: 'auto'|'low'|'medium'|'high'|'ultra', renderer?: THREE.WebGLRenderer, autoGauges?: boolean, envLighting?: number}} opts
     */
    constructor(canvas, opts = {}) {
        this.opts = { autoGauges: false, envLighting: 0.3, ...opts };
        // AA belongs to the adaptive world target, not the full-DPR presentation buffer.
        const r = this._renderer = opts.renderer || new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, reverseDepthBuffer: opts.reverseDepth === true });
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        // AgX: photographic toe (ACES-fitted crushed shaded asphalt to ~0.2 % reflectance on screen, review #1);
        // the display-space grade in FinalShader restores the punch (saturation / contrast)
        r.toneMapping = { aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }[opts.toneMapping] ?? THREE.AgXToneMapping;
        r.outputColorSpace = THREE.SRGBColorSpace;
        this._satK = r.toneMapping === THREE.AgXToneMapping ? 1.12 : 1; // AgX desaturates: grade compensates
        r.info.autoReset = false;
        this.width = canvas.clientWidth || window.innerWidth; this.height = canvas.clientHeight || window.innerHeight;
        this.time = 0;
        this.scene = null; this.camera = null; this.env = null; this.player = null;
        this.stats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, pixelRatio: 1, shadows: 0, post: 'off', quality: '', auto: false, level: 1 };

        // lights + sky (re-parented into each scene)
        this.sun = new THREE.DirectionalLight('#ffffff', 2);
        this.sun.castShadow = true;
        // the sun's shadow map is drawn once per frame() (main pass); the rear-view mirror / photo / GTAO renders in
        // between reuse it instead of re-rendering the 4096² map
        this.sun.shadow.autoUpdate = false;
        this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 600; // light sits 400 m up-sun: receivers end ≈ 400 + 80 + 60 m
        this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.6); // not in the scene: its colours/intensity feed the probe
        // image-based ambient for every lit material (Lambert included): SH9 of sky + sunlit walls + ground bounce
        this.probe = new THREE.LightProbe(); this.probe.userData.shared = true; this._ambAt = -1e9; this._ambKey = '';
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), makeSkyMaterial());
        this.sky.name = 'sky'; this.sky.frustumCulled = false; this.sky.renderOrder = -100; this.sky.userData.shared = true;
        this._sunDir = new THREE.Vector3(0, 1, 0);
        this._moonDir = new THREE.Vector3(0, 1, 0);
        this.rain = null;
        // time of day
        this.clock = null;          // set by setClock()
        this.phase = 'day'; this.sunElevation = 45; this.sunAzimuth = 180;
        this.nightLights = false;   // true when NPC/street lights should be on
        this.onNightLights = null;  // optional callback(on)
        this._headManual = null;    // null = automatic (on with nightLights)
        this.headlightsOn = false;
        this._envEl = null; this._envT = 0;
        this._envA = null; this._envB = null; this._envOut = null; this._envFade = 1; this._envQuad = null;
        this._nightK = 0;           // 0..1, eased night factor (lamps, heads, cabin glow); 0 by day = all night systems idle
        this._lampEnabled = true; this._lampEnK = 1; this._cabinK = -1;
        this._shadowDir = new THREE.Vector3(0, 1, 0);
        // weather + seasons
        this.weather = null;        // public snapshot (see _publishWeather)
        this.onWeatherChange = null; this.onThunder = null;
        this.snow = null;
        let qp = null; try { qp = new URLSearchParams(location.search); } catch { /* no location */ }
        const qw = qp?.get('weather'), qs = qp?.get('season');
        this._wxOverride = qw && WEATHER_PRESETS[qw] ? qw : null;
        this._seasonOverride = ['spring', 'summer', 'autumn', 'winter'].includes(qs) ? qs : null;
        this._wxData = null; this._wxSource = null; this._wxNext = 0; this._wxLoc = ''; this._wxBusy = false; this._wxGen = 0;
        this._wxT = null; this._wx = null; this._wet = 0; this._wipers = false; this._wxInstant = true;
        this._flash = 0; this._thunderT = 8; this._hemiBase = 0.6; this._cloudOff = new THREE.Vector2();
        this._surfU = { road: makeSurfU(), ground: makeSurfU(), grass: makeSurfU(), roof: makeSurfU(), sport: makeSurfU() };
        this._surfU.road.uPuddle.value = 1; this._surfU.ground.uPuddle.value = 0.35; this._surfU.roof.uPuddle.value = 0; this._surfU.road.uSnowFlat.value = 1;
        this._surfU.sport.uSnowFlat.value = 1; this._surfU.sport.uPuddle.value = 0.2; // (sports surfaces / landmark grounds: an even dusting, the lines still read)
        this._treeU = { broad: makeTreeU(), con: makeTreeU() }; this._treeU.con.uEver.value = 1;
        this._crowns = []; this._season = null; this._seasonT = 0; this._seasonKey = '';
        // street lamps
        this.lamps = null; this._lampHead = null; this._lampPool = []; this._lampGroup = new THREE.Group(); this._lampGroup.visible = false;
        this._lampGroup.userData.shared = true;
        this._discs = null; this._lampT = 0; this._lampAt = new THREE.Vector3(1e9, 0, 1e9);
        this._lampSlots = []; this._lampNear = []; this._lampAssignT = 0; this._lampReal = null; this._discFar = LAMP_RANGE;

        // post
        this.composer = new EffectComposer(r);
        this.renderPass = new RenderPass(null, null);
        this.outputPass = new OutputPass();
        this.finalPass = new ShaderPass(FinalShader);
        this.bloomPass = null; this.smaaPass = null; this.fxaaPass = null; this.gtaoPass = null;
        this.cockpitDisplays = new CockpitDisplays(r, this.composer);

        // adaptive quality state
        this._ema = 16.7; this._slowT = 0; this._fastT = 0; this._settle = 2; this._dts = []; this._block = {}; this._backoff = {};
        this._fpsAcc = 0; this._fpsN = 0; this._lastStatsNow = null;
        this._pmrem = new THREE.PMREMGenerator(r);
        this._tmp = { v: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(), m: new THREE.Matrix4(), cam: new THREE.Vector3(), vel: new THREE.Vector3() };
        this.setQuality(opts.quality || 'auto');
    }

    get renderer() { return this._renderer; }

    /** District replacement: drop scene references without resizing the persistent light pool or cockpit targets. */
    releaseScene() {
        this._cancelEnvJob();
        const retained = [this.sun, this.sun.target, this.probe, this.sky, this._lampGroup, this._discs].filter(Boolean);
        for (const o of retained) o.removeFromParent();
        for (const k of ['rain', 'snow']) if (this[k]) { this[k].mesh.removeFromParent(); this[k].dispose(); this[k] = null; }
        this._wxGen++; this._wxBusy = false; this._wxLoc = ''; // discard the old response; setClock refreshes the new place
        this._crowns = []; this._nightMats = []; this._sourceBackdrops = []; this._lampHead = null;
        this.lamps = this._lampDens = this._lampTint = this._lampReal = null; this._lampNear = [];
        for (const sl of this._lampSlots) { sl.lamp = -1; sl.w = sl.target = 0; sl.light.intensity = 0; }
        this.scene = null; this.player = null; this.renderPass.scene = null;
        this.cockpitDisplays.setPlayer(null);
        if (this.gtaoPass) this.gtaoPass.scene = null;
        this._envA?.dispose(); this._envB?.dispose(); this._waterEnv?.dispose();
        this._envA = this._envB = this._waterEnv = null; this._envFade = 1;
        setWaterEnv(null, 1);
        return retained;
    }

    // ------------------------------------------------------------------ scene
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {object} env city.env from cities.js
     * @param {{sky?: THREE.Object3D, replaceLights?: boolean, units?: 'kmh'|'mph'}} o  sky = the world's own sky dome to hide
     */
    setScene(scene, camera, env, o = {}) {
        this.scene = scene; this.camera = camera; this.env = env; this.mph = o.units === 'mph';
        this._sourceBackdrops = [];
        scene.traverse(object => { if (Number.isFinite(object.userData?.sourceProjection?.cameraFarM)) this._sourceBackdrops.push(object); });
        camera.layers.enable(1); // layer 1 = seen by the main camera only (rear cabin; the mirror camera stays on layer 0)
        const replace = o.replaceLights !== false;
        if (replace) for (const c of [...scene.children]) if ((c.isDirectionalLight || c.isHemisphereLight || c.isAmbientLight || (c.isLightProbe && c !== this.probe)) && c !== this.sun) scene.remove(c);
        if (o.sky) o.sky.visible = false;
        if (this.hemi.parent) this.hemi.removeFromParent();
        scene.add(this.sun, this.sun.target, this.probe, this.sky, this._lampGroup);
        if (this._discs) scene.add(this._discs);
        // FogExp2 here = aerial perspective (patched chunk below): density is the ground-level extinction coefficient
        // (3.912 / meteorological visibility, from the weather). env.edgeM (or a spot's env.fogFar ≥ 2500 m) sets a
        // minimum haze that hides a scene's content edge; district worlds hide theirs with backdrop masses.
        const edge = env.edgeM ?? (env.fogFar >= 2500 ? env.fogFar : null);
        this._fogBase = edge ? 3.0 / edge : 0;
        scene.fog = new THREE.FogExp2(env.fog, Math.max(this._fogBase, 3.912 / 15000));
        this.setVegetation(o.vegetation || scene.userData?.vegetation || null);
        // Establish the new place's clock and weather before baking its reflections. Building an environment with
        // the previous place's lighting makes the first frame bake it again after the host sets the actual clock.
        scene.background = new THREE.Color(env.fog);
        this._wxInstant = true;
        if ('weather' in o) this._wxOverride = typeof o.weather === 'string' && WEATHER_PRESETS[o.weather] ? o.weather : null;
        if (o.clock) this.setClock(o.clock);
        // setClock refreshes a changed location; a same-location scene still needs its instantaneous weather state.
        if (!this._wx || this._wxInstant) this._refreshWeather({ live: !!this.clock });
        this._applyLighting(true);
        // environment map for reflections (vehicle paint, glass, wet roads)
        this._buildEnvMap(true);
        this._envEl = this.sunElevation;
        // weather
        for (const k of ['rain', 'snow']) if (this[k]) { this[k].mesh.removeFromParent(); this[k].dispose(); this[k] = null; }
        this._wxInstant = true;
        this._applyRainToCockpit();
        // passes
        this.renderPass.scene = scene; this.renderPass.camera = camera;
        if (this.gtaoPass) { this.gtaoPass.scene = scene; this.gtaoPass.camera = camera; }
        else if (this.tier?.ao) this._buildPasses();
        this._settle = 2;
        this._lastStatsNow = null;
        this._fpsAcc = 0; this._fpsN = 0; this.stats.fps = 0; this.stats.frameMs = 0;
    }

    // ------------------------------------------------------------------ time of day
    /**
     * Drive sun/sky/lighting from a real clock or a fixed look.
     * setClock({ date, lat, lon, timeZone, timeScale })  — real solar position for that instant & place
     * setClock({ override: 'day'|'sunset'|'dusk'|'night'|'dawn' })  — fixed look (menu option)
     * setClock({ override: null }) returns to the date-driven clock; setClock(null) restores the static city env.
     * `date` may be passed every frame: with timeScale 1 it is used as-is; with timeScale ≠ 1 the renderer
     * advances its own simulated clock from the first date (a later date only re-bases it when it jumps > 1 min).
     */
    setClock(c) {
        if (c === null) { this.clock = null; this._applyLighting(true); return; }
        const k = this.clock || (this.clock = { lat: 44.43, lon: 26.1, timeScale: 1, override: null, baseMs: Date.now(), baseReal: performance.now(), lastDate: null });
        if (c.lat !== undefined) k.lat = c.lat;
        if (c.lon !== undefined) k.lon = c.lon;
        if (c.timeZone !== undefined) k.timeZone = c.timeZone;
        if (c.override !== undefined) k.override = c.override && OVERRIDES[c.override] ? c.override : null;
        const now = performance.now();
        if (c.timeScale !== undefined && c.timeScale !== k.timeScale) { k.baseMs = this._simMs(); k.baseReal = now; k.timeScale = c.timeScale; }
        if (c.date) {
            const ms = +c.date;
            const expected = k.lastDate === null ? null : k.lastDate.ms + (now - k.lastDate.real);
            if (k.timeScale === 1 || expected === null || Math.abs(ms - expected) > 60000) { k.baseMs = ms; k.baseReal = now; }
            k.lastDate = { ms, real: now };
        }
        const loc = k.lat.toFixed(2) + ',' + k.lon.toFixed(2);
        if (loc !== this._wxLoc) { this._wxLoc = loc; this._wxInstant = true; this._seasonT = 0; if (this.scene) this._refreshWeather(); }
        this._applyLighting(true);
    }
    _simMs() { const k = this.clock; return k.baseMs + (performance.now() - k.baseReal) * k.timeScale; }
    /** current simulated time as a Date (or null without a clock) */
    get simDate() { return this.clock ? new Date(this._simMs()) : null; }

    _applyLighting(force = false) {
        const env = this.env; if (!env || !this.scene) return;
        const u = this.sky.material.uniforms, fu = this.finalPass.uniforms;
        let el, az;
        if (!this.clock) { // static look from the city env (legacy)
            this._sunDir.set(...env.sun).normalize();
            el = Math.asin(this._sunDir.y) / (Math.PI / 180); az = (Math.atan2(this._sunDir.x, -this._sunDir.z) / (Math.PI / 180) + 360) % 360;
        } else if (this.clock.override) ({ el, az } = OVERRIDES[this.clock.override]);
        else ({ elevation: el, azimuth: az } = solarPosition(this._simMs(), this.clock.lat, this.clock.lon));
        this.sunElevation = el; this.sunAzimuth = az;
        this.phase = el >= 8 ? 'day' : el < -6 ? 'night' : (az < 180 ? 'dawn' : 'dusk');
        const clouds = this._wx ? this._wx.cloud : env.clouds;
        const overcastEnv = clouds >= 0.85;
        if (!this.clock) {
            this.sun.color.set(env.sunColor);
            this.sun.intensity = env.sunIntensity * (overcastEnv ? 1.05 : 1.3);
            this.sun.shadow.intensity = overcastEnv ? 0.45 : 0.9;
            this.sun.userData.dir = this._sunDir;
            this.hemi.color.set(env.hemiSky); this.hemi.groundColor.set(env.hemiGround);
            this.hemi.intensity = overcastEnv ? 1.0 : 0.85;
            this.scene.fog?.color.set(env.fog); this.scene.background?.set?.(env.fog);
            this._renderer.toneMappingExposure = env.exposure;
            u.uZenith.value.set(env.skyTop); u.uHorizon.value.set(env.fog); u.uGround.value.set(env.hemiGround);
            u.uSunDir.value.copy(this._sunDir); u.uSunColor.value.set(env.sunColor);
            u.uSunPower.value = overcastEnv ? 2 : 28; u.uNight.value = 0;
            if (overcastEnv) { u.uCloudLit.value.set('#c3cbd4'); u.uCloudDark.value.set('#6e7884'); }
            else { u.uCloudLit.value.set('#fff4e6').lerp(new THREE.Color(env.sunColor), 0.35); u.uCloudDark.value.set(env.skyBottom).lerp(new THREE.Color('#8a8ea0'), 0.5); }
            fu.uGrade.value.set((overcastEnv ? 0.95 : 1.1) * this._satK, overcastEnv ? 1.04 : 1.06);
            this._sunLightDir = this._sunDir; this._sunShadows = true;
        } else {
            const st = skyState(el, clouds);
            this._skyHorizon = st.horizon; this._hemiI0 = st.hemiI;
            dirFromElAz(el, az, this._sunDir);
            dirFromElAz(Math.max(22, 12 - el * 0.8), (az + 180) % 360, this._moonDir);
            const useSun = el > -2;
            this._lightDir = (this._lightDir || new THREE.Vector3()).copy(useSun ? this._sunDir : this._moonDir);
            if (this._lightDir.y < 0.05) { this._lightDir.y = 0.05; this._lightDir.normalize(); }
            this._sunLightDir = this._lightDir;
            if (useSun) { this.sun.color.copy(st.sun); this.sun.intensity = st.sunI * (env.sunIntensity >= 2 ? 1 : 1.15) * (this._wx ? this._wx.sunMul : 1); }
            else { this.sun.color.set('#9fb2e6'); this.sun.intensity = 0.16 * st.night * (1 - st.overcast * 0.7); }
            this.sun.shadow.intensity = (1 - 0.55 * st.overcast) * 0.9;
            this._sunShadows = useSun && st.sunI > 0.15;
            this.hemi.color.copy(st.hemiSky); this.hemi.groundColor.copy(st.hemiGround); this.hemi.intensity = this._hemiBase = st.hemiI * (this._wx ? 0.75 + 0.25 * this._wx.sunMul : 1);
            // fog/haze colour: the horizon by day; at night the air between the viewer and the streets is dark (the sky glow
            // is light scattered high up), otherwise distant blocks turn into a beige veil
            const fog = st.horizon.clone().multiplyScalar(0.94 - 0.62 * st.night);
            this.scene.fog?.color.copy(fog); if (this.scene.background?.isColor) this.scene.background.copy(fog);
            this._renderer.toneMappingExposure = env.exposure * st.expo;
            u.uZenith.value.copy(st.zenith); u.uHorizon.value.copy(st.horizon); u.uGround.value.copy(st.hemiGround).multiplyScalar(0.8);
            u.uSunDir.value.copy(this._sunDir); u.uSunColor.value.copy(st.sun);
            u.uSunPower.value = (overcastEnv ? 2 : 28) * THREE.MathUtils.smoothstep(el, -1.5, 1);
            u.uCloudLit.value.copy(st.cLit); u.uCloudDark.value.copy(st.cDark);
            u.uNight.value = st.night; u.uMoonDir.value.copy(this._moonDir); this._skyNight = st.night;
            const n = st.night;
            fu.uGrade.value.set(((overcastEnv ? 0.95 : 1.1) - n * 0.15) * this._satK, 1.05);
            this._rainBright = THREE.MathUtils.clamp(st.hemiI / 0.85 + 0.12, 0.25, 1);
            // bloom: by day only the sun / speculars; at night only genuinely bright sources (lamp heads, headlights,
            // signs) — lit windows (emissive ≈ 1–2) stay crisp, halos tighter
            if (this.bloomPass) { const bn = st.night; this.bloomPass.threshold = 0.95 + 1.6 * bn; this.bloomPass.strength = 0.32 - 0.1 * bn; this.bloomPass.radius = 0.55 - 0.2 * bn; }
        }
        u.uCover.value = clouds; u.uHaze.value = overcastEnv ? 0.3 : 0.65;
        if (!this.clock) this._hemiBase = this.hemi.intensity;
        this._updateAmbient(force, this.clock ? (this._skyNight ?? 0) : 0, clouds);
        // shadows follow the tier, and are off for moonlight
        this.sun.castShadow = !!this.tier?.shadow && this._sunShadows;
        // night lights switch (hysteresis ±0.5°)
        const thr = 4 + (overcastEnv ? 4 : 0);
        const night = this.nightLights ? el < thr + 0.5 : el < thr - 0.5;
        if (night !== this.nightLights || force) this._setNight(night, force);
    }

    /**
     * Ambient light as a 3rd-order SH light probe (works for Lambert + Standard). Radiance model per direction:
     *  - sky: the hemisphere colour/intensity (same upward irradiance as before), brighter toward the horizon and the
     *    sun when clear, toward the zenith when overcast (CIE overcast);
     *  - street canyon: below ~27° a share of the view is building walls; a wall facing the sun bounces
     *    albedo × (sun + sky) / π, so shaded surfaces facing sunlit walls are lifted and warmed;
     *  - ground: urban albedo × (sun + sky) / π (bounce onto walls, car bodies and undersides);
     *  - night: a faint sodium/LED glow from below and from the walls (lamps, windows), none by day.
     * Re-projected at most every 0.4 s (and on force); the cost per pixel is the same as the hemisphere light it replaces.
     */
    _updateAmbient(force, night = 0, clouds = 0.4) {
        const now = performance.now();
        if (!force && now - this._ambAt < 400) return;
        this._ambAt = now;
        const T = this._amb || (this._amb = { sky: new THREE.Color(), gnd: new THREE.Color(), sun: new THREE.Color(), wall: new THREE.Color(), glow: new THREE.Color('#ffb36b'), c: new THREE.Color(), out: Array.from({ length: 9 }, () => new THREE.Vector3()) });
        const h = this.hemi, sd = this._sunLightDir || this._sunDir;
        const skyE = this._hemiBase ?? h.intensity, sky = T.sky.copy(h.color); // base: the lightning flash scales probe.intensity
        // the eye / a camera white-balances shade: keep only part of the sky's blue in the ambient (spec 18 request)
        { const l = sky.r * 0.2126 + sky.g * 0.7152 + sky.b * 0.0722; sky.lerp(T.c.setRGB(l, l, l), 0.4); }
        const sunOn = this.sun.intensity > 0 && sd.y > 0 && (this.clock ? this.sunElevation > -2 : true);
        const sunI = sunOn ? this.sun.intensity * (this.sun.shadow ? 0.55 + 0.45 * (this.sun.shadow.intensity ?? 1) : 1) : 0;
        const sun = T.sun.copy(this.sun.color);
        const oc = THREE.MathUtils.smoothstep(clouds, 0.55, 1);
        const env = this.env || {};
        const cityK = env.ambientCity ?? 0.5, gAlb = env.groundAlbedo ?? 0.15, wAlb = env.wallAlbedo ?? 0.3;
        // ground tint: hemiGround chroma at unit luminance
        const hg = h.groundColor, hl = Math.max(1e-4, hg.r * 0.2126 + hg.g * 0.7152 + hg.b * 0.0722);
        const gt = T.gnd.setRGB(hg.r / hl, hg.g / hl, hg.b / hl).lerp(T.c.setRGB(1, 1, 1), 0.5);
        const Esun = sunI * Math.max(0, sd.y);                       // horizontal sun irradiance
        const D = AMB_DIRS, n = D.length, w4 = 4 * Math.PI / n;
        // sky shape normalisation: the cosine-weighted sky integral must give the hemisphere light's irradiance
        const shape = (d) => {
            const y = Math.max(0, d.y), mu = Math.max(0, d.x * sd.x + d.y * sd.y + d.z * sd.z);
            const clear = 0.75 + 0.7 * (1 - y) ** 3 + (sunOn ? 1.6 * mu ** 8 : 0);
            return clear * (1 - oc) + oc * (1 + 2 * y) / 3 * 1.6;
        };
        let norm = 0; for (const d of D) if (d.y > 0) norm += shape(d) * d.y * w4;
        const skyL = skyE / Math.max(1e-4, norm);                  // radiance scale (per unit shape)
        const out = T.out; for (const v of out) v.set(0, 0, 0);
        const Lg = gAlb * (Esun * 0.6 + skyE) / Math.PI;           // ground radiance (partly shaded)
        const glow = night * (0.018 + 0.012 * oc);
        const c = T.c, wall = T.wall;
        for (const d of D) {
            let r, g, b;
            if (d.y >= 0) {
                const k = shape(d) * skyL; r = sky.r * k; g = sky.g * k; b = sky.b * k;
                const band = d.y < 0.45 ? cityK * (1 - d.y / 0.45) : 0;
                if (band > 0) {
                    // the wall seen in direction d faces -d: lit when the sun is on that side
                    const hl2 = Math.hypot(d.x, d.z) || 1, ndl = Math.max(0, -(d.x * sd.x + d.z * sd.z) / hl2);
                    const Ew = sunI * ndl * Math.sqrt(Math.max(0, 1 - sd.y * sd.y)), Es = 0.5 * skyE;
                    wall.setRGB(sun.r * Ew + sky.r * Es + gt.r * Lg * 1.6, sun.g * Ew + sky.g * Es + gt.g * Lg * 1.6, sun.b * Ew + sky.b * Es + gt.b * Lg * 1.6).multiplyScalar(wAlb / Math.PI);
                    wall.r += T.glow.r * glow * 0.7; wall.g += T.glow.g * glow * 0.7; wall.b += T.glow.b * glow * 0.7;
                    r += (wall.r - r) * band; g += (wall.g - g) * band; b += (wall.b - b) * band;
                }
            } else {
                const e = Esun * 0.6 + skyE;
                r = gAlb * gt.r * (sun.r * Esun * 0.6 + sky.r * skyE) / Math.PI; g = gAlb * gt.g * (sun.g * Esun * 0.6 + sky.g * skyE) / Math.PI; b = gAlb * gt.b * (sun.b * Esun * 0.6 + sky.b * skyE) / Math.PI;
                if (!(e > 0)) r = g = b = 0;
                r += T.glow.r * glow; g += T.glow.g * glow; b += T.glow.b * glow;
            }
            // (round 6 note 44) urban night fill: street lighting scattered by façades, pavement and haze lights the whole
            // street a little — the roads between the lamp pools were near-black. From above (haze, façades) more than below.
            if (night > 0) { const fill = night * (0.075 + 0.025 * oc) * (d.y >= 0 ? 1.0 : 0.6); r += T.glow.r * fill; g += T.glow.g * fill; b += T.glow.b * fill; }
            const B = d.b;
            for (let i = 0; i < 9; i++) { const f = B[i] * w4; out[i].x += r * f; out[i].y += g * f; out[i].z += b * f; }
        }
        const co = this.probe.sh.coefficients; for (let i = 0; i < 9; i++) co[i].copy(out[i]);
    }

    _setNight(on, force) {
        const changed = on !== this.nightLights;
        this.nightLights = on;
        // lamps, lamp heads and cabin glow ease in/out in _updateNight (force = jump straight to the new state)
        if (force) { this._nightK = on ? 1 : 0; this._lampEnK = this._lampEnabled ? 1 : 0; }
        this._lampAt.set(1e9, 0, 1e9); this._lampT = 0;
        this._updateNight(0);
        this._updateHeadlights();
        if (changed) this.onNightLights?.(on);
    }
    /** ease the night factor; drives lamp-head emission, light-pool discs, the PointLight pool and the cabin glow */
    _updateNight(dt) {
        const tgt = this.nightLights ? 1 : 0, lt = this._lampEnabled ? 1 : 0;
        if (this._nightK !== tgt) this._nightK = tgt > this._nightK ? Math.min(1, this._nightK + dt / NIGHT_FADE_S) : Math.max(0, this._nightK - dt / NIGHT_FADE_S);
        if (this._lampEnK !== lt) this._lampEnK = lt > this._lampEnK ? Math.min(1, this._lampEnK + dt / NIGHT_FADE_S) : Math.max(0, this._lampEnK - dt / NIGHT_FADE_S);
        const n = this._nightK, k = THREE.MathUtils.smoothstep(n, 0, 1), lk = k * this._lampEnK;
        // heads glow with the night (not with the lamp-light toggle: that only switches the light pool)
        const hm = this._lampHead;
        if (hm && hm.userData._k !== k) {
            hm.userData._k = k;
            if (hm.emissive) { hm.emissive.set(k > 0 ? '#ffd7a0' : '#000000'); hm.emissiveIntensity = 3 * k; }
            else if (hm.color) hm.color.set(hm.userData.dayColor || '#d8d4c8').lerp(new THREE.Color(hm.userData.nightColor || '#ffe2b0').multiplyScalar(3), k);
        }
        if (this.headlightsOn && Math.abs((this._headK ?? -1) - k) > 0.02) this._updateHeadlights();
        if (this._nightMats?.length && this._nightMatK !== k) { this._nightMatK = k; for (const m of this._nightMats) m.emissiveIntensity = m.userData.nightEmissive * k; }
        if (this._discs) this._discs.visible = n > 0 && this._discs.count > 0;
        this._lampGroup.visible = lk > 0 && this._lampPool.length > 0;
        this._lampK = lk;
        // cabin: direct light through the (open) roof dims, instrument glow + cabin fill rise
        if (Math.abs(this._cabinK - k) > 1e-3 || (k === 0) !== (this._cabinK === 0)) {
            this._cabinK = k;
            const ck = this.player?.cockpit?.userData;
            ck?.setInteriorLight?.(1 - 0.7 * k);
            ck?.setNightGlow?.(k);
        }
    }
    /** street-lamp PointLight pool on/off (fades). Discs and lamp heads stay; off = zero per-pixel lamp cost. */
    setLampLightsEnabled(on) { this._lampEnabled = !!on; }
    get lampLightsEnabled() { return this._lampEnabled; }

    // ------------------------------------------------------------------ weather + seasons
    /**
     * Weather override: 'clear' | 'cloudy' | 'rain' | 'drizzle' | 'snow' | 'fog' | 'storm', or null / 'real' for real
     * weather (live Open-Meteo, climatology fallback). Transitions take ~10 s unless {instant: true}.
     */
    setWeather(v, { instant = false } = {}) {
        this._wxOverride = typeof v === 'string' && WEATHER_PRESETS[v] ? v : null;
        if (instant) this._wxInstant = true;
        this._wxSource = null;
        if (this.scene) this._refreshWeather();
    }
    /** season override for the vegetation ('spring'|'summer'|'autumn'|'winter'), null = from the date */
    setSeason(s) { this._seasonOverride = ['spring', 'summer', 'autumn', 'winter'].includes(s) ? s : null; this._seasonT = 0; }
    /**
     * Materials / meshes that weather + seasons tint (world.vegetation: {treeCrownMeshes, grassMaterials,
     * groundMaterials, roofMaterials}); anything missing is found in the scene by name (grass, groundPlane, landuse,
     * paved-areas, roofs, 'ground i,j' / 'marks i,j' road meshes, 'treeCrowns …' instanced meshes).
     */
    setVegetation(v) {
        const sc = this.scene; if (!sc) return;
        const cats = { road: new Set(), ground: new Set(), grass: new Set(), roof: new Set(), sport: new Set() }, crowns = new Set(v?.treeCrownMeshes || []);
        for (const m of v?.grassMaterials || []) cats.grass.add(m);
        for (const m of v?.groundMaterials || []) cats.ground.add(m);
        for (const m of v?.roofMaterials || []) cats.roof.add(m);
        for (const m of v?.sportMaterials || []) cats.sport.add(m); // (pitches / courts, landmark masonry: the same weather as the streets)
        sc.traverse((o) => {
            if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
            const m = o.material, n = m.name || '', on = o.name || '';
            if (o.isInstancedMesh && /^treeCrowns/.test(on)) { crowns.add(o); return; }
            if (!(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial)) return;
            if (n === 'grass') cats.grass.add(m);
            else if (n === 'groundPlane' || n === 'landuse' || n === 'paved-areas') cats.ground.add(m);
            else if (n === 'roofs') cats.roof.add(m);
            else if (n === 'road' || n === 'junction' || n === 'markings' || /^(ground|marks|road|junction) /.test(on)) cats.road.add(m);
        });
        for (const k in cats) for (const m of cats[k]) if (!m.userData.wxPatch) patchSurface(m, this._surfU[k]);
        this._conMats ??= new WeakMap();
        for (const c of crowns) {
            // Keep the builder's LOD shadow policy across all season changes.
            c.userData.seasonCastShadow ??= c.castShadow;
            if (c.userData.conifer) {
                let cm = this._conMats.get(c.material);
                if (!cm && c.material.userData.wxPatch !== 'wxtree-con') {
                    const orig = c.material; cm = orig.clone(); delete cm.userData.wxPatch;
                    patchCrowns(cm, this._treeU.con); cm.userData.wxPatch = 'wxtree-con'; this._conMats.set(orig, cm);
                }
                if (cm) c.material = cm;
            } else patchCrowns(c.material, this._treeU.broad);
        }
        this._crowns = [...crowns];
        this._seasonT = 0;
        // night-lit materials (lit windows, shop fronts, signs): material.userData.nightEmissive = emissiveIntensity at full
        // night; render scales it with the eased night factor (0 by day)
        const nm = new Set(v?.nightMaterials || []);
        sc.traverse((o) => { const ms = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m.userData?.nightEmissive > 0 && m.emissive) nm.add(m); });
        this._nightMats = [...nm]; this._nightMatK = -1;
    }
    _wxPlace() { return this.clock || { lat: 44.43, lon: 26.1, timeZone: 'Europe/Bucharest' }; }
    _refreshWeather({ live = true } = {}) {
        const gen = ++this._wxGen, k = this._wxPlace(), loc = k.lat.toFixed(2) + ',' + k.lon.toFixed(2);
        this._wxNext = performance.now() + WEATHER_TTL_MS;
        if (this._wxOverride) { this._applyWeatherData({ ...WEATHER_PRESETS[this._wxOverride] }, 'override', loc); return; }
        // climatology right away (unless fresh live data for this place is already showing); live data replaces it
        if (this._wxSource !== 'live' || this._wxDataLoc !== loc) this._applyWeatherData(climateWeather(k.lat, k.lon, this.simDate || new Date(), k.timeZone), 'climate', loc);
        if (typeof fetch !== 'function' || !live) return;
        this._wxBusy = true;
        fetchLiveWeather(k.lat, k.lon, k.timeZone || 'auto')
            .then((w) => { if (gen === this._wxGen && !this._wxOverride) this._applyWeatherData(w, 'live', loc); })
            .catch((err) => { if (!this._wxWarned) { this._wxWarned = true; console.info('[weather] live weather unavailable, using climatology:', err?.message || err); } })
            .finally(() => { if (gen === this._wxGen) this._wxBusy = false; });
    }
    _applyWeatherData(w, source, loc) {
        this._wxData = w; this._wxSource = source; this._wxDataLoc = loc;
        const t = weatherTargets(w);
        t.fogDens = 3.912 / Math.max(150, t.visibilityM); // Koschmieder: 2 % contrast left at the visibility distance
        this._wxT = t;
        // a fresh place / load snaps to the weather instead of easing in; the climatology placeholder shown while the
        // live request runs keeps that window open (round 6 note 33: climatology said rain, the ground loaded fully
        // wet, then the live — dry — weather arrived and the ground visibly dried over a minute)
        const now = performance.now();
        if (!this._wx || this._wxInstant || (source === 'live' && now < (this._wxSnapUntil ?? 0))) {
            this._wx = { ...t };
            this._wet = t.rain > 0.1 ? 1 : 0;
            this._wxSnapUntil = this._wxInstant && source === 'climate' ? now + 15000 : 0;
            this._wxInstant = false;
        }
        this._publishWeather();
    }
    _publishWeather() {
        const w = this._wxData; if (!w) return;
        const isDay = w.isDay ?? this.sunElevation > -3, c = classifyWMO(w.code, isDay);
        this.weather = {
            source: this._wxSource, code: w.code, kind: c.kind, label: c.label, icon: c.icon,
            tempC: w.tempC, precipMm: w.precipMm, snowCm: w.snowDepthCm, snowfallCm: w.snowfallCm,
            windKmh: w.windKmh, windDir: w.windDir, visibilityM: Math.round(this._wxT?.visibilityM ?? w.visibilityM), cloud: w.cloud,
            season: this._season?.season || null, updatedAt: Date.now(), climate: w.climate || null,
        };
        try { this.onWeatherChange?.(this.weather); } catch (e) { console.warn('[weather] onWeatherChange', e); }
    }
    _applySeason() {
        const k = this._wxPlace(), cl = nearestClimate(k.lat, k.lon);
        const st = this._season = seasonState(this.simDate || new Date(), k.lat, { timeZone: k.timeZone, maritime: cl.id === 'seattle', override: this._seasonOverride });
        // grass: dormant brown (winter / dry late summer), fresh spring green, a touch of autumn yellow
        const g = this._surfU.grass.uSeasonTint.value, b = st.brown, f = st.fresh * 0.5, a = st.autumn * 0.3 * (1 - st.brown);
        g.setRGB((1 + 0.9 * b) * (1 - 0.05 * f) * (1 + 0.25 * a), (1 - 0.15 * b) * (1 + 0.12 * f), (1 - 0.55 * b) * (1 - 0.2 * f) * (1 - 0.3 * a));
        const B = this._treeU.broad;
        B.uBare.value = st.bare; B.uAutumn.value = st.autumn; B.uBlossom.value = st.blossom; B.uFresh.value = st.fresh;
        for (const c of this._crowns) if (!c.userData.conifer) {
            c.castShadow = c.userData.seasonCastShadow && st.bare < 0.6; // far LOD and leafless crowns: no blob shadows
            const tr = st.bare > 0.02, m = c.material; // bare crowns: blended twig haze (see patchCrowns)
            if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } // (depth write stays on: tree builders draw crowns far → near)
        }
        const key = st.season;
        if (key !== this._seasonKey) { this._seasonKey = key; if (this.weather) { this.weather.season = key; try { this.onWeatherChange?.(this.weather); } catch { /* ignore */ } } }
    }
    _updateWeather(dt, cam, vel) {
        const t = this._wxT; if (!t || !this.scene) return;
        if (performance.now() > this._wxNext && !this._wxBusy) this._refreshWeather();
        const c = this._wx, a = 1 - Math.exp(-dt / WX_TAU);
        for (const key of WX_TRANSITION_KEYS) c[key] += (t[key] - c[key]) * a;
        c.thunder = t.thunder;
        this._wet = c.rain > 0.08 ? Math.min(1, this._wet + dt * c.rain / 40) : Math.max(0, this._wet - dt / WET_DRY_S);
        this._seasonT -= dt; if (this._seasonT <= 0) { this._seasonT = 600; this._applySeason(); }
        // fog (visibility) + cloud drift with the wind
        if (this.scene.fog?.isFogExp2) this.scene.fog.density = Math.max(this._fogBase, c.fogDens);
        this._cloudOff.x += (0.006 - c.windX * 0.0011) * dt; this._cloudOff.y += (0.0025 - c.windZ * 0.0011) * dt;
        const su = this.sky.material.uniforms; su.uCloudOff.value.copy(this._cloudOff);
        // precipitation: particle systems exist only while it rains / snows (zero cost when dry)
        const bright = this.clock ? this._rainBright ?? 1 : 1, wind = this._tmp.wind || (this._tmp.wind = { x: 0, z: 0 });
        wind.x = c.windX; wind.z = c.windZ;
        if (c.rain > 0.01 || t.rain > 0) {
            if (!this.rain) { this.rain = new Rain({ count: 5000, opacity: 0.22 }); this.scene.add(this.rain.mesh); }
            this.rain.setIntensity(c.rain); this.rain.update(dt, cam, vel, wind);
            this.rain.uniforms.uColor.value.set('#b9c4cf').multiplyScalar(bright);
        } else if (this.rain) { this.rain.mesh.removeFromParent(); this.rain.dispose(); this.rain = null; }
        if (c.snow > 0.01 || t.snow > 0) {
            if (!this.snow) { this.snow = new Snow({ count: 7000 }); this.scene.add(this.snow.mesh); }
            this.snow.setIntensity(c.snow); this.snow.update(dt, cam, vel, wind);
            this.snow.uniforms.uColor.value.set('#f4f7fb').multiplyScalar(Math.max(0.35, bright));
            this.snow.uniforms.uScale.value = this.height * this._renderer.getPixelRatio() * 0.9;
        } else if (this.snow) { this.snow.mesh.removeFromParent(); this.snow.dispose(); this.snow = null; }
        // wipers (hysteresis)
        const wantW = this._wipers ? (c.rain > 0.08 || c.snow > 0.25) : (c.rain > 0.15 || c.snow > 0.4);
        if (wantW !== this._wipers) { this._wipers = wantW; this._applyRainToCockpit(); }
        // thunderstorm: rare short double flash of sky + ambient, rumble callback with a delay
        if (c.thunder) {
            this._thunderT -= dt;
            if (this._thunderT <= 0) {
                this._thunderT = 7 + Math.random() * 18; this._flashT = 0;
                try { this.onThunder?.({ delay: 0.8 + Math.random() * 3.5, intensity: 0.5 + Math.random() * 0.5 }); } catch { /* ignore */ }
            }
        }
        if (this._flashT !== undefined && this._flashT !== null) {
            const f = this._flashT += dt;
            this._flash = f < 0.06 ? 1 : f < 0.13 ? 0.2 : f < 0.2 ? 0.75 : Math.max(0, 0.75 - (f - 0.2) * 4);
            if (f > 0.45) { this._flashT = null; this._flash = 0; }
        }
        su.uFlash.value = this._flash * 1.4;
        this.hemi.intensity = this._hemiBase + this._flash * 1.6;
        this.probe.intensity = 1 + this._flash * 1.6 / Math.max(0.2, this._hemiBase);
        // surfaces: snow dusting, wet darkening + sheen, grass season tint
        const S = this._surfU, sc = c.snowCover, wet = this._wet;
        const sky = S.road.uWetSky.value.copy(this.scene.fog?.color || this._skyHorizon || sky0).multiplyScalar(0.6); // a street reflects facades as much as sky
        const set = (U, snow, w) => {
            U.uSnow.value = snow; U.uWet.value = w; if (U !== S.road) U.uWetSky.value.copy(sky);
            const tc = U.uSeasonTint.value;
            U.uWxOn.value = snow > 0.002 || w > 0.002 || tc.r !== 1 || tc.g !== 1 || tc.b !== 1 ? 1 : 0;
        };
        set(S.road, sc * 0.5, wet); set(S.ground, sc, wet * 0.75); set(S.grass, sc, wet * 0.35); set(S.roof, sc * 1.05, wet * 0.5); set(S.sport, sc * 1.1, wet * 0.6);
        this._treeU.broad.uSnow.value = sc; this._treeU.con.uSnow.value = sc;
        if (Math.abs((this._vehSnow ?? -1) - sc) > 0.005) { this._vehSnow = sc; setVehicleSnow?.(sc > 0.005 ? sc : 0); } // white caps on cars (cockpit-ui)
    }

    // ------------------------------------------------------------------ headlights
    /** true/false = manual; null = automatic (on whenever nightLights) */
    setHeadlights(v) { this._headManual = v === null || v === undefined ? null : !!v; this._updateHeadlights(); }
    _updateHeadlights() {
        const on = this._headManual ?? this.nightLights;
        this.headlightsOn = on;
        // by day (fog, rain, manual) the beams are dimmed: 140 cd at night, ≈ 25 cd in daylight (no white blow-out on a
        // light vehicle ahead); _updateNight re-applies it while the night factor eases
        this._headK = THREE.MathUtils.smoothstep(this._nightK, 0, 1);
        this.player?.cockpit?.userData.headlights?.setOn(on, 140 * (0.18 + 0.82 * this._headK));
    }

    // ------------------------------------------------------------------ street lamps
    /**
     * @param {Array<{x,z,h,rot?,y?}>|Float32Array|number[]|Array<[number,number,number]>} lamps
     *        world.lamps objects (head offset 1.8·h/8 m along `rot`, base height y), or [x, z, height] triples
     * @param {{headMesh?: THREE.Mesh, headMaterial?: THREE.Material}} o  lamp heads to light up at night (world.lampHeadMesh)
     */
    setLamps(lamps, o = {}) {
        // internal layout: stride 4 = [headX, headZ, headY, groundY]
        const n = !lamps ? 0 : (typeof lamps[0] === 'number' ? Math.floor(lamps.length / 3) : lamps.length);
        const flat = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
            let x, z, h, rot = null, y = 0;
            if (typeof lamps[0] === 'number') { x = lamps[i * 3]; z = lamps[i * 3 + 1]; h = lamps[i * 3 + 2] || 8; }
            else if (Array.isArray(lamps[i])) { [x, z, h = 8] = lamps[i]; }
            else { ({ x, z } = lamps[i]); h = lamps[i].h || 8; rot = lamps[i].rot ?? null; y = lamps[i].y || 0; }
            const k = h / 8;
            if (rot !== null) { x += Math.cos(rot) * 1.8 * k; z -= Math.sin(rot) * 1.8 * k; }
            flat.set([x, z, y + 7.7 * k, y], i * 4);
        }
        this.lamps = flat;
        // dense lamp areas (squares, boulevards with lamps every few metres) must not add up to a uniform flood: each
        // lamp's pool / light is scaled by 1/√(lamps within 14 m); a per-lamp tint mixes sodium and LED stock
        {
            const dens = this._lampDens = new Float32Array(n), tint = this._lampTint = new Float32Array(n * 3), cell = new Map(), C = 14;
            for (let i = 0; i < n; i++) { const k = Math.floor(flat[i * 4] / C) + ',' + Math.floor(flat[i * 4 + 1] / C); (cell.get(k) || cell.set(k, []).get(k)).push(i); }
            const us = (this.clock?.lon ?? this._wxPlace?.().lon ?? 26) < 0, c = new THREE.Color();
            for (let i = 0; i < n; i++) {
                const x = flat[i * 4], z = flat[i * 4 + 1], cx = Math.floor(x / C), cz = Math.floor(z / C); let m = 0;
                for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of cell.get((cx + a) + ',' + (cz + b)) || []) if ((flat[j * 4] - x) ** 2 + (flat[j * 4 + 1] - z) ** 2 < C * C) m++;
                dens[i] = 1 / Math.sqrt(Math.max(1, m));
                const hsh = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
                c.set(hsh < (us ? 0.15 : 0.45) ? '#ffad5c' : us ? '#f2f0ff' : '#ffe0b8'); // sodium | LED (US cooler)
                tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
            }
        }
        const head = o.headMaterial || o.headMesh?.material || null;
        if (this._lampHead && this._lampHead !== head && this._lampHead.emissive) this._lampHead.emissiveIntensity = 0;
        this._lampHead = head;
        if (this._lampHead?.color && !this._lampHead.emissive) this._lampHead.userData.dayColor ??= '#' + this._lampHead.color.getHexString();
        if (!this._discs) {
            // light pools multiply the lit surface (out = dst × (1 + pool)): a lamp lights asphalt, paving and grass by
            // their own albedo — round 6 note 27: the old additive white disc made the same glowing blob on dark grass.
            // The falloff lives in RGB (opaque black canvas): the blend factors ignore alpha.
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
            gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(0.3, 'rgb(190,190,190)'); gr.addColorStop(0.65, 'rgb(80,80,80)'); gr.addColorStop(1, 'rgb(0,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace;
            const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(DISC_GAIN, DISC_GAIN, DISC_GAIN), transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
                blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor });
            this._discs = new THREE.InstancedMesh(geo, mat, MAX_DISCS);
            this._discs.count = 0; this._discs.frustumCulled = false; this._discs.renderOrder = 2; this._discs.userData.shared = true;
            this._discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DISCS * 3), 3);
        }
        this.scene?.add(this._discs);
        this._discs.count = 0; this._discs.visible = false;
        this._lampNear = []; this._lampReal = new Float32Array(n);
        for (const sl of this._lampSlots) { sl.lamp = -1; sl.w = 0; sl.target = 0; sl.light.intensity = 0; }
        this._syncLampPool();
        this._lampAt.set(1e9, 0, 1e9); this._lampT = 0; this._lampAssignT = 0;
    }
    _syncLampPool() {
        const want = this.lamps && this.lamps.length ? (this.tier?.lamps ?? 0) : 0;
        const slots = this._lampSlots;
        while (slots.length > want) {
            const sl = slots.pop(); this._lampGroup.remove(sl.light);
            if (sl.lamp >= 0 && this._lampReal) this._lampReal[sl.lamp] = 0;
        }
        while (slots.length < want) {
            const l = new THREE.PointLight('#ffc98a', 0, 28, 1.7); l.userData.shared = true;
            slots.push({ light: l, lamp: -1, w: 0, target: 0 }); this._lampGroup.add(l);
        }
        this._lampPool = slots.map(sl => sl.light);
        this._lampGroup.visible = (this._lampK || 0) > 0 && slots.length > 0;
    }
    /**
     * Street lamps at night.
     *  - candidate scan (≤ 4 Hz or after 8 m): lamps within LAMP_RANGE, sorted by distance; disc matrices set here
     *  - every frame: disc brightness from the exact distance (continuous fade, no switching)
     *  - real PointLights: re-selected at 5 Hz with hysteresis (assigned lamps keep their light until clearly worse),
     *    stable ordering (look-ahead distance, tie-break by lamp id), ≤ LAMP_MAX_NEW new lights per selection;
     *    each light fades in/out over LAMP_FADE_S and its intensity also falls off continuously with distance.
     */
    _updateLamps(cam, dt, camera = this.camera) {
        if (!(this._nightK > 0) || !this.lamps || !this.lamps.length) {
            if (this._lampSlots.length && this._lampSlots[0].lamp !== -2) { // day: release every light once, then idle
                for (const sl of this._lampSlots) { if (sl.lamp >= 0 && this._lampReal) this._lampReal[sl.lamp] = 0; sl.lamp = -1; sl.w = 0; sl.target = 0; sl.light.intensity = 0; }
                this._lampSlots[0].lamp = -2;
            }
            return;
        }
        if (this._lampSlots.length && this._lampSlots[0].lamp === -2) this._lampSlots[0].lamp = -1;
        // (owner register #66: "night drone view does not show the road lighting") the pools and real lights followed the
        // player on the ground while the drone flew elsewhere. A camera away from the player (drone, free camera) is the
        // centre instead: its ground point plus a look-ahead that grows with height, and from higher up a wider range.
        const p0 = this.player, camAway = !p0 || Math.hypot(cam.x - p0.x, cam.z - p0.z) > 40 || cam.y - (p0.y || 0) > 25;
        let cx = p0 ? p0.x : cam.x, cz = p0 ? p0.z : cam.z, rangeK = 1;
        if (camAway && camera) {
            const f = camera.getWorldDirection(this._tmp.dir || (this._tmp.dir = new THREE.Vector3())), fl = Math.hypot(f.x, f.z) || 1, h = Math.max(0, cam.y - (p0?.y || 0));
            const la = THREE.MathUtils.clamp(h * 0.8, 0, 120);
            cx = cam.x + f.x / fl * la; cz = cam.z + f.z / fl * la; rangeK = 1 + THREE.MathUtils.clamp(h / 100, 0, 1);
        }
        const p = camAway ? null : p0, RANGE = LAMP_RANGE * rangeK;
        const L = this.lamps, sm = THREE.MathUtils.smoothstep;
        // ---- candidate scan
        this._lampT -= dt;
        const moved = (cx - this._lampAt.x) ** 2 + (cz - this._lampAt.z) ** 2;
        const D = this._discs, m = this._tmp.m;
        if (this._lampT <= 0 || moved > 64) {
            this._lampT = 0.25; this._lampAt.set(cx, 0, cz);
            const R = RANGE + 12, R2 = R * R, near = [];
            for (let i = 0; i < L.length; i += 4) {
                const dx = L[i] - cx, dz = L[i + 1] - cz, d2 = dx * dx + dz * dz;
                if (d2 < R2) near.push({ d2, i });
            }
            near.sort((a, b) => a.d2 - b.d2 || a.i - b.i); // stable: distance, then lamp id
            const n = Math.min(near.length, MAX_DISCS), list = this._lampNear = new Int32Array(n);
            for (let k = 0; k < n; k++) list[k] = near[k].i;
            // more candidates than discs: fade the far end out before the cut-off so the last discs never pop
            this._discFarT = near.length > MAX_DISCS ? Math.min(RANGE, Math.sqrt(near[MAX_DISCS].d2) - 10) : RANGE;
            for (let k = 0; k < n; k++) {
                const i = list[k], r = (L[i + 2] - L[i + 3]) * (1.1 + 0.6 * (this._lampDens?.[i / 4] ?? 1)); // tighter pools where lamps are dense
                m.makeScale(r, 1, r).setPosition(L[i], L[i + 3] + 0.22, L[i + 1]);
                D.setMatrixAt(k, m);
            }
            D.count = n; D.instanceMatrix.needsUpdate = true;
        }
        this._discFar += ((this._discFarT ?? RANGE) - this._discFar) * Math.min(1, dt * 2);
        const list = this._lampNear, real = this._lampReal, nk = THREE.MathUtils.smoothstep(this._nightK, 0, 1);
        // ---- real lights: selection
        const slots = this._lampSlots, lk = this._lampK || 0;
        if (slots.length && lk > 0) {
            this._lampAssignT -= dt;
            if (this._lampAssignT <= 0) { this._lampAssignT = LAMP_ASSIGN_DT; this._assignLampLights(cx, cz, p, rangeK); }
        } else if (slots.length) for (const sl of slots) { sl.target = 0; }
        // ---- real lights: fade + distance falloff (every frame)
        for (const sl of slots) {
            if (sl.lamp < 0) continue;
            const step = dt / LAMP_FADE_S;
            sl.w = sl.target > sl.w ? Math.min(1, sl.w + step) : Math.max(0, sl.w - step);
            const i = sl.lamp * 4, d = Math.hypot(L[i] - cx, L[i + 1] - cz);
            const k = sm(sl.w, 0, 1) * (1 - sm(d / rangeK, LAMP_LIGHT_NEAR, LAMP_LIGHT_FAR)); // (from a drone the lit reach widens with height)
            // low arcade / bollard lamps (2–4 m) would blow out the floor at street-lamp candela: scale with height²
            const hh = (L[sl.lamp * 4 + 2] - L[sl.lamp * 4 + 3]) / 7.7, hK = THREE.MathUtils.clamp(hh * hh, 0.12, 1);
            sl.light.intensity = LAMP_LIGHT_I * k * lk * hK * (0.35 + 0.65 * (this._lampDens?.[sl.lamp] ?? 1));
            real[sl.lamp] = k * lk;
            if (sl.w <= 0 && sl.target <= 0) { real[sl.lamp] = 0; sl.lamp = -1; sl.light.intensity = 0; }
        }
        // ---- discs: continuous distance fade; slightly dimmer where a real light already lights the ground
        const col = this._tmp.col || (this._tmp.col = new THREE.Color()), far = this._discFar;
        for (let k = 0; k < list.length; k++) {
            const i = list[k], d = Math.hypot(L[i] - cx, L[i + 1] - cz);
            const f = (1 - sm(d, far * 0.65, far)) * nk * (1 - 0.35 * real[i / 4]);
            const li = i / 4, td = this._lampTint, dd = this._lampDens ? this._lampDens[li] : 1;
            D.setColorAt(k, td ? col.setRGB(td[li * 3], td[li * 3 + 1], td[li * 3 + 2]).multiplyScalar(f * dd * 1.25 * THREE.MathUtils.clamp((L[i + 2] - L[i + 3]) / 7.7, 0.35, 1)) : col.setScalar(f));
        }
        if (D.instanceColor) D.instanceColor.needsUpdate = true;
        D.visible = list.length > 0;
    }
    _assignLampLights(cx, cz, p = this.player, rangeK = 1) {
        const L = this.lamps, slots = this._lampSlots, list = this._lampNear;
        const sp = p ? Math.abs(p.speed || 0) : 0, la = THREE.MathUtils.clamp(10 + sp * 0.9, 10, 32);
        const ax = p ? cx + p.fx * la : cx, az = p ? cz + p.fz * la : cz;
        const owner = new Map(); for (const sl of slots) if (sl.lamp >= 0) owner.set(sl.lamp, sl);
        // score = distance to the look-ahead point; lamps that already own a light get a strong bonus (hysteresis)
        const cand = [], R2 = (LAMP_ASSIGN_R * rangeK) ** 2;
        for (let k = 0; k < list.length; k++) {
            const i = list[k], dx = L[i] - cx, dz = L[i + 1] - cz;
            if (dx * dx + dz * dz > R2) continue;
            const id = i / 4, sl = owner.get(id);
            let sc = Math.hypot(L[i] - ax, L[i + 1] - az);
            if (sl && sl.target > 0) sc = sc * 0.7 - 10;
            cand.push({ id, sc });
        }
        cand.sort((a, b) => a.sc - b.sc || a.id - b.id);
        const spare = Math.max(1, Math.round(slots.length * 0.2)), K = Math.max(1, slots.length - spare);
        const want = new Set(); for (let k = 0; k < Math.min(K, cand.length); k++) want.add(cand[k].id);
        for (const sl of slots) if (sl.lamp >= 0) sl.target = want.has(sl.lamp) ? 1 : 0;
        let added = 0;
        for (let k = 0; k < Math.min(K, cand.length) && added < LAMP_MAX_NEW; k++) {
            const id = cand[k].id; if (owner.has(id)) continue;
            const sl = slots.find(s => s.lamp < 0); if (!sl) break;
            const i = id * 4;
            sl.lamp = id; sl.w = 0; sl.target = 1; sl.light.intensity = 0;
            sl.light.position.set(L[i], L[i + 2] - 0.4, L[i + 1]);
            if (this._lampTint) sl.light.color.setRGB(this._lampTint[id * 3], this._lampTint[id * 3 + 1], this._lampTint[id * 3 + 2]);
            owner.set(id, sl); added++;
        }
    }

    setPlayer(player) {
        this.player = player; this._applyRainToCockpit(); this._updateHeadlights();
        this.cockpitDisplays.setPlayer(player, this.camera, this.scene, this.tier.post === 'off');
        this.camera?.layers.enable(1);
        this._cabinK = -1; this._updateNight(0);
    }
    _applyRainToCockpit() { this.player?.cockpit?.userData.setRain?.(this._wipers); }

    /**
     * Environment map for reflections/ambient (vehicle paint, glass, wet roads). The texture handed to materials is a
     * stable render target (_envOut): a rebuilt PMREM is cross-faded into it over ENV_FADE_S, so a rebuild never pops
     * and never changes material programs. immediate = jump (new scene).
     */
    _buildEnvMap(immediate = false) {
        this._cancelEnvJob();
        const envScene = new THREE.Scene();
        // Freeze all sky uniforms while the six faces are captured on different frames.
        const dome = new THREE.Mesh(this.sky.geometry, this.sky.material.clone());
        envScene.add(dome);
        const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.env.asphalt || '#444').lerp(new THREE.Color(this.env.fog), 0.25) }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -2; envScene.add(ground);
        const blocks = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.env.hemiGround).multiplyScalar(0.7) });
        for (let i = 0; i < 14; i++) {
            const a = i / 14 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(14, 6 + (i * 7) % 11, 14), blocks);
            b.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 60); envScene.add(b);
        }
        const job = { scene: envScene, dome, ground, blocks, waterColor: (this.scene?.fog?.color || new THREE.Color(this.env.fog)).clone().multiplyScalar(0.45) };
        this._envCloud = this._wx ? this._wx.cloud : null;
        if (!immediate && supportsProgressivePMREM(this._pmrem)) {
            job.task = progressivePMREM(this._renderer, this._pmrem, envScene);
            this._envJob = job;
            return;
        }
        // New scenes are baked before their first draw. An incompatible future Three revision keeps the native path.
        const rt = this._pmrem.fromScene(envScene, 0, 0.5, 300);
        this._prepareWaterEnv(job);
        const water = this._pmrem.fromScene(envScene, 0.004, 0.5, 300);
        this._disposeEnvScene(job);
        this._finishEnvMap(rt, water, immediate);
    }
    _prepareWaterEnv(job) {
        for (const o of [...job.scene.children]) if (o !== job.dome && o !== job.ground) { job.scene.remove(o); o.geometry.dispose(); }
        job.ground.material.color.copy(job.waterColor); job.ground.position.y = -6;
    }
    _disposeEnvScene(job) {
        job.scene.traverse(o => { if (o !== job.dome) o.geometry?.dispose(); });
        job.dome.material.dispose(); job.blocks.dispose(); job.ground.material.dispose();
    }
    _cancelEnvJob() {
        const job = this._envJob; if (!job) return;
        this._envJob = null; job.task.dispose(); job.rt?.dispose(); this._disposeEnvScene(job);
    }
    _stepEnvJob() {
        const job = this._envJob; if (!job || !job.task.step()) return;
        if (!job.rt) {
            job.rt = job.task.target;
            this._prepareWaterEnv(job);
            job.task = progressivePMREM(this._renderer, this._pmrem, job.scene, 0.004);
        } else {
            this._envJob = null; this._disposeEnvScene(job);
            this._finishEnvMap(job.rt, job.task.target, false);
        }
    }
    _finishEnvMap(rt, water, immediate) {
        this._waterEnv?.dispose(); this._waterEnv = water; setWaterEnv(water.texture, 1);
        let out = this._envOut;
        if (!out || out.width !== rt.width || out.height !== rt.height) {
            out?.dispose();
            out = this._envOut = new THREE.WebGLRenderTarget(rt.width, rt.height, {
                type: rt.texture.type, format: rt.texture.format, colorSpace: rt.texture.colorSpace,
                magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false,
            });
            out.texture.mapping = THREE.CubeUVReflectionMapping; out.texture.name = 'EnvBlend';
            immediate = true;
            setVehicleEnvMap(out.texture, 1);
        }
        if (!this._envQuad) this._envQuad = new FullScreenQuad(new THREE.ShaderMaterial({ ...EnvBlendShader, uniforms: THREE.UniformsUtils.clone(EnvBlendShader.uniforms), depthTest: false, depthWrite: false }));
        if (immediate || !this._envB) {
            this._envA?.dispose(); this._envB?.dispose();
            this._envA = null; this._envB = rt; this._envFade = 1;
            this._blendEnv(rt.texture, rt.texture, 1, out);
        } else {
            if (this._envFade < 1) { // mid-fade: freeze what is on screen as the new start
                this._blendEnv(out.texture, out.texture, 0, this._envA);
                this._envB.dispose();
            } else { this._envA?.dispose(); this._envA = this._envB; }
            this._envB = rt; this._envFade = 0;
        }
        if (this.opts.envLighting > 0) { this.scene.environment = out.texture; this.scene.environmentIntensity = this.opts.envLighting; }
    }
    _blendEnv(a, b, t, target) {
        const r = this._renderer, u = this._envQuad.material.uniforms, prev = r.getRenderTarget(), xr = r.xr.enabled;
        u.tA.value = a; u.tB.value = b; u.uT.value = t;
        r.xr.enabled = false; r.setRenderTarget(target); this._envQuad.render(r); r.setRenderTarget(prev); r.xr.enabled = xr;
    }
    _stepEnvFade(dt) {
        if (this._envFade >= 1 || !this._envA) return;
        this._envFade = Math.min(1, this._envFade + dt / ENV_FADE_S);
        this._blendEnv(this._envA.texture, this._envB.texture, THREE.MathUtils.smoothstep(this._envFade, 0, 1), this._envOut);
        if (this._envFade >= 1) { this._envA.dispose(); this._envA = null; }
    }

    // ------------------------------------------------------------------ quality
    /** q: 'auto' | 'low' | 'medium' | 'high' | 'ultra' | ladder index */
    setQuality(q) {
        this.auto = q === 'auto';
        let level;
        if (this.auto) level = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 4 : AUTO_MAX;
        else level = typeof q === 'number' ? q : (NAMED[q] ?? 1);
        this.qualityName = this.auto ? 'auto' : (typeof q === 'number' ? QUALITY_LADDER[q].name : q);
        this._block = {}; this._backoff = {};
        this._applyLevel(level);
    }
    _applyLevel(level) {
        level = THREE.MathUtils.clamp(level, 0, QUALITY_LADDER.length - 1);
        this.level = level;
        const t = this.tier = QUALITY_LADDER[level];
        const r = this._renderer;
        const pr = Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, t.pr);
        this._worldPixelRatio = pr;
        const outputPR = displayPixelRatio(pr, globalThis.devicePixelRatio, this.width, this.height, this.cockpitDisplays.active);
        if (r.getPixelRatio() !== outputPR) r.setPixelRatio(outputPR);
        const cssSize = r.getSize(this._bufferCSSSize ||= new THREE.Vector2());
        if (cssSize.x !== this.width || cssSize.y !== this.height) r.setSize(this.width, this.height, false);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(this.width, this.height);
        this.cockpitDisplays.resize(this.width, this.height, pr);
        // shadows
        if (t.shadow) {
            if (this.sun.shadow.mapSize.x !== t.shadow) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(t.shadow, t.shadow); }
            this.sun.castShadow = this._sunShadows !== false;
            const span = t.span || SHADOW_SPAN, sc = this.sun.shadow.camera, h = span / 2;
            sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.updateProjectionMatrix();
            const texel = span / t.shadow;
            this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = texel * 0.9;
            this.sun.shadow.radius = 3;
        } else {
            this.sun.castShadow = false;
            this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
            this.sun.shadow.mapPass?.dispose(); this.sun.shadow.mapPass = null;
        }
        this._buildPasses();
        this.cockpitDisplays.prewarm(this.camera, this.scene, t.post === 'off');
        if (this._lampGroup) this._syncLampPool();
        this._settle = 2; this._slowT = 0; this._fastT = 0;
        Object.assign(this.stats, { pixelRatio: pr, shadows: t.shadow, post: t.post + (t.ao ? '+ao' : ''), quality: this.auto ? `auto (${t.name})` : t.name, auto: this.auto, level });
    }
    _buildPasses() {
        const t = this.tier, c = this.composer, w = this.width, h = this.height;
        for (const p of [...c.passes]) c.removePass(p);
        // Removed passes still own render targets. Auto/high → low must release those allocations.
        for (const [name, needed] of [['bloomPass', t.post === 'full'], ['smaaPass', t.post !== 'off' && t.aa === 'smaa'], ['gtaoPass', t.post !== 'off' && t.ao]]) {
            if (!needed && this[name]) { this[name].dispose(); this[name] = null; }
        }
        if (t.post === 'off') return;
        c.addPass(this.renderPass);
        c.addPass(this.cockpitDisplays.capturePass);
        if (t.ao && this.scene && this.camera) { // (GTAO needs a camera: an 'ultra' set before the first scene is built at setScene)
            if (!this.gtaoPass) this._gtaoLoading ??= import('../vendor/addons/GTAOPass.js').then(({ GTAOPass }) => {
                if (!this.tier.ao || !this.scene || !this.camera) return;
                this.gtaoPass = new GTAOPass(this.scene, this.camera, w, h);
                // The pass draws the scene's normals with one override material. A mesh whose shape lives in its own vertex
                // shader is drawn there in its rest shape: the walkers' hidden outfit parts (an umbrella canopy, a backpack, a
                // coat skirt on everyone) and unposed limbs became faint boxes and stray dark patches around people at Ultra
                // (owner: "shadows for pedestrians, invisible boxes"). Such meshes (userData.skipNormalPrepass) sit that
                // prepass out; they are still drawn, lit and shadowed as before.
                { const pass = this.gtaoPass, hide = pass.overrideVisibility.bind(pass), show = pass.restoreVisibility.bind(pass), parked = [];
                  // A transparent mesh (fountain jets and spray, glass, water) is drawn opaque by that override material too: the
                  // fountains' jets became grey ghost shapes ("fountains are still just a shadow"). Transparent meshes sit it out as well.
                  const skip = o => o.userData?.skipNormalPrepass || (o.isMesh && (Array.isArray(o.material) ? o.material.some(m => m?.transparent) : o.material?.transparent));
                  pass.overrideVisibility = () => { hide(); pass.scene?.traverse(o => { if (o.visible && skip(o)) { o.visible = false; parked.push(o); } }); };
                  pass.restoreVisibility = () => { for (const o of parked) o.visible = true; parked.length = 0; show(); }; }
                this.gtaoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1 });
                this.gtaoPass.blendIntensity = 0.85;
                if (this.tier.ao) this._buildPasses();
            }).finally(() => { this._gtaoLoading = null; });
            if (this.gtaoPass) { this.gtaoPass.scene = this.scene; this.gtaoPass.camera = this.camera; c.addPass(this.gtaoPass); }
        }
        if (t.post === 'full') {
            if (!this.bloomPass) this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.95);
            c.addPass(this.bloomPass);
        }
        c.addPass(this.outputPass);
        c.addPass(this.finalPass);
        this.finalPass.uniforms.uGrain.value = t.post === 'full' ? 0.035 : 0.0;
        if (t.aa === 'smaa') {
            if (!this.smaaPass) this.smaaPass = new SMAAPass(w * this._worldPixelRatio, h * this._worldPixelRatio);
            c.addPass(this.smaaPass);
        } else if (t.aa === 'fxaa') {
            if (!this.fxaaPass) this.fxaaPass = new ShaderPass(FXAAShader);
            c.addPass(this.fxaaPass);
        }
        c.setSize(w, h); // propagate sizes to newly added passes
        this._updateResUniforms();
    }
    _updateResUniforms() {
        const pr = this._worldPixelRatio;
        this.finalPass.uniforms.uRes.value.set(this.width * pr, this.height * pr);
        if (this.fxaaPass) this.fxaaPass.material.uniforms.resolution.value.set(1 / (this.width * pr), 1 / (this.height * pr));
    }

    resize(w, h) {
        this.width = w; this.height = h;
        this._renderer.setSize(w, h, false);
        this.composer.setSize(w, h);
        this.cockpitDisplays.resize(w, h, this._worldPixelRatio);
        this._updateResUniforms();
        this._settle = Math.max(this._settle, 1);
    }

    // ------------------------------------------------------------------ frame
    /** Advance the existing scene's environment without drawing or ticking any actors.
     * A window uses its dedicated source-world camera and configures off-axis
     * projection AFTER this update; cull:false preserves that projection. */
    advanceEnvironment(dt, {camera = this.camera, cockpit = true, cull = true} = {}) {
        if (!this.scene || !camera) return false;
        if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Finite nonnegative environment dt required');
        this.time += dt;
        tickWater(dt);
        const T = this._tmp;
        camera.getWorldPosition(T.cam);
        // sky follows the camera
        this.sky.position.copy(T.cam);
        this.sky.material.uniforms.uTime.value = this.time;
        if (this.clock || this._wx) {
            this._applyLighting();
            // refresh reflections when the sun moved > ENV_REBUILD_DEG (≤ every 2 s; the sky is constant below -14°),
            // cross-faded so there is no visible pop
            this._envT -= dt;
            const e0 = this._envEl, e1 = this.sunElevation;
            const dc = this._wx ? Math.abs(this._wx.cloud - (this._envCloud ?? this._wx.cloud)) : 0;
            if (!this._envJob && this._envT <= 0 && ((Math.abs(e1 - e0) > ENV_REBUILD_DEG && !(e0 < -14 && e1 < -14)) || dc > 0.2)) {
                this._envT = 2; this._buildEnvMap(); this._envEl = e1;
            }
        }
        this._stepEnvJob();
        this._stepEnvFade(dt);
        this._updateNight(dt);
        this._updateSun(T.cam);
        this._updateLamps(T.cam, dt, camera);
        // weather + cockpit
        const p = cockpit ? this.player : null;
        if (p) {
            T.vel.set(p.fx * p.speed, 0, p.fz * p.speed);
            const ck = p.cockpit?.userData;
            if (ck) {
                ck.tick?.(dt);
                // looking back: the driver's own seat back/headrest steps out of the way (as if the head turned past it)
                if (ck.driverSeatBack) {
                    camera.getWorldDirection(T.v); const back = T.v.x * p.fx + T.v.z * p.fz < -0.35;
                    ck.driverSeatBack.visible = !back;
                }
                if (this.opts.autoGauges && ck.updateGauges) {
                    const sp = Math.abs(p.speed), gear = Math.min(5, Math.floor(sp / 8.5));
                    const rpm = 0.11 + Math.min(0.85, ((sp - gear * 8.5) / 8.5) * 0.55 + 0.18 + (p.speed > 0.3 ? 0.05 : 0));
                    ck.updateGauges(p.speed, sp < 0.3 ? 0.1 : rpm, 0.72, this.mph);
                }
            }
        } else T.vel.set(0, 0, 0);
        this._updateWeather(dt, T.cam, T.vel);
        if (cockpit) this._updateWindshield();
        if (cull) this._fogCull(camera);
        return true;
    }

    /** Render one frame. dt advances effects; diagnostics use actual visible frame cadence. */
    frame(dt) {
        const { scene, camera } = this;
        if (!scene || !camera) return;
        const now = performance.now();
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        const elapsed = visible && this._lastStatsNow != null ? (now - this._lastStatsNow) / 1000 : 0;
        this._lastStatsNow = visible ? now : null;
        if (!visible) { this._fpsAcc = 0; this._fpsN = 0; this.stats.fps = 0; this.stats.frameMs = 0; }
        if (dt === undefined) dt = this._lastNow ? Math.min(0.1, (now - this._lastNow) / 1000) : 1 / 60;
        this._lastNow = now;
        this.advanceEnvironment(dt);
        const p = this.player;
        // render
        const fu = this.finalPass.uniforms; fu.uTime.value = this.time;
        this.sun.shadow.needsUpdate = true;
        this.cockpitDisplays.begin(scene, camera, p, this._worldPixelRatio, this.width, this.height);
        if (this.tier.post === 'off') this.cockpitDisplays.renderLow(scene, camera, this.outputPass);
        else this.composer.render(dt);
        this.cockpitDisplays.render(scene, camera);
        this.displayStats = this.cockpitDisplays.stats;
        // stats
        const info = this._renderer.info;
        this.stats.drawCalls = info.render.calls; this.stats.triangles = info.render.triangles;
        info.reset();
        if (elapsed > 0 && Number.isFinite(elapsed)) {
            this.stats.frameMs = Math.round(elapsed * 10000) / 10;
            this._fpsAcc += elapsed; this._fpsN++;
            if (this._fpsAcc >= 0.5) {
                const rate = this._fpsN / this._fpsAcc, precision = rate < 1 ? 100 : rate < 10 ? 10 : 1;
                this.stats.fps = Math.round(rate * precision) / precision;
                this._fpsAcc = 0; this._fpsN = 0;
            }
        }
        this._adapt(dt);
    }

    /**
     * In rain / snow / fog the visibility is far shorter than the world's draw distance: pull the camera far plane in to
     * where the fog leaves < 0.5 % of an object's colour (FogExp2: exp(-(d·z)²) = 0.005 → z ≈ 2.3 / d), so whole cells,
     * buildings and their draw calls are frustum-culled. Never below 220 m, restored as soon as it clears; clear-weather
     * fog is left alone (backdrops beyond it are meant to show).
     */
    /** Read the current scene/weather limit without rewriting a camera projection. */
    visibilityFar(baseFar) {
        const fog = this.scene?.fog;
        let want = baseFar;
        if (fog?.isFogExp2 && fog.density > 0) want = Math.min(baseFar, Math.max(220, 5.3 / fog.density)); // 0.5 % left
        for (const object of this._sourceBackdrops || []) {
            let visible = true;
            for (let p = object; p; p = p.parent) if (!p.visible) { visible = false; break; }
            if (visible) want = Math.max(want, Math.min(baseFar, object.userData.sourceProjection.cameraFarM));
        }
        return want;
    }

    _fogCull(camera) {
        if (!camera?.isPerspectiveCamera) return;
        if (this._farSet === undefined || Math.abs(camera.far - this._farSet) > 0.01) { this._farBase = camera.far; this._farSet = camera.far; }
        const want = this.visibilityFar(this._farBase);
        if (Math.abs(want - camera.far) > camera.far * 0.04) { camera.far = want; camera.updateProjectionMatrix(); this._farSet = want; }
    }

    _updateSun(cam) {
        const s = this.sun, T = this._tmp, src = this._sunLightDir || this._sunDir;
        // the light direction only follows the sun in SHADOW_DIR_DEG steps: a continuously rotating shadow camera
        // makes every shadow edge crawl across texels
        const d = this._shadowDir;
        if (d.dot(src) < Math.cos(SHADOW_DIR_DEG * Math.PI / 180) || !s.castShadow) d.copy(src);
        // centre the shadow frustum a bit ahead of the player, snapped to shadow texels (no shimmering)
        const p = this.player;
        const c = T.v.copy(cam); c.y = 0;
        const span = this.tier?.span || SHADOW_SPAN;
        if (p) { c.x += p.fx * span * 0.25; c.z += p.fz * span * 0.25; }
        if (s.castShadow) {
            const texel = span / s.shadow.mapSize.x;
            const right = T.v2.set(0, 1, 0).cross(d).normalize(); const up = T.v3.copy(d).cross(right).normalize();
            const cr = c.dot(right), cu = c.dot(up);
            c.addScaledVector(right, Math.round(cr / texel) * texel - cr).addScaledVector(up, Math.round(cu / texel) * texel - cu);
        }
        s.target.position.copy(c);
        s.position.copy(c).addScaledVector(d, 400);
        s.target.updateMatrixWorld();
    }

    _updateWindshield() {
        const fu = this.finalPass.uniforms;
        const ck = this.player?.cockpit;
        const ws = ck?.userData.windshield, st = ck?.userData.wiperState;
        const wr = this._wx ? Math.max(this._wx.rain, this._wx.snow * 0.5) : 0;
        if (!ws || !st || !(wr > 0.02) || this.tier.post === 'off' || !ck.visible || !this.player.cockpit.parent) { fu.uRain.value = 0; return; }
        const cam = this.camera, T = this._tmp;
        this.player.rig?.updateMatrixWorld(true);
        cam.updateMatrixWorld(true);
        const A = T.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse.copy(cam.matrixWorld).invert());
        const mw = ck.matrixWorld;
        const O = T.v.copy(ws.origin).applyMatrix4(mw);
        const U = T.v2.copy(ws.u).transformDirection(mw);
        const S = T.v3.copy(ws.s).transformDirection(mw);
        const e = A.elements; // column-major
        const clip = (x, y, z, w) => [e[0] * x + e[4] * y + e[8] * z + e[12] * w, e[1] * x + e[5] * y + e[9] * z + e[13] * w, e[3] * x + e[7] * y + e[11] * z + e[15] * w];
        const cu = clip(U.x, U.y, U.z, 0), cs = clip(S.x, S.y, S.z, 0), co = clip(O.x, O.y, O.z, 1);
        // windshield centre must be in front of the camera (not looking back)
        const wMid = co[2] + cs[2] * ws.len * 0.5;
        if (wMid <= 0.05) { fu.uRain.value = 0; return; }
        const H = fu.uH.value.set(cu[0], cs[0], co[0], cu[1], cs[1], co[1], cu[2], cs[2], co[2]);
        H.invert();
        fu.uWs.value.set(ws.len, ws.halfW0, ws.halfW1);
        fu.uWp0.value.set(ws.wipers[0].px, ws.wipers[0].ps, ws.wipers[0].len);
        fu.uWp1.value.set(ws.wipers[1].px, ws.wipers[1].ps, ws.wipers[1].len);
        fu.uWiper.value.set(st.a0, st.a1, st.sweep, st.period);
        fu.uWT.value = st.t; fu.uRainT.value = st.rainT;
        fu.uRain.value = st.on ? Math.min(1, 0.35 + wr) : 0;
        // keep the rear-view mirror (a plane in front of the camera, player.js) free of droplets
        const mir = this.player.mirror, mk = fu.uMask.value;
        mk.set(2, 2, -2, -2);
        if (mir && mir.visible && mir.geometry) {
            mir.updateMatrixWorld(true);
            const pa = mir.geometry.parameters || { width: 0.33, height: 0.11 }, hw = pa.width / 2 + 0.03, hh = pa.height / 2 + 0.03;
            for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
                const q = T.v.set(x, y, 0).applyMatrix4(mir.matrixWorld).applyMatrix4(A);
                const qx = q.x * 0.5 + 0.5, qy = q.y * 0.5 + 0.5; // applyMatrix4 divides by w
                mk.x = Math.min(mk.x, qx); mk.y = Math.min(mk.y, qy); mk.z = Math.max(mk.z, qx); mk.w = Math.max(mk.w, qy);
            }
        }
    }

    // ------------------------------------------------------------------ adaptive quality
    /** feed one frame interval (seconds). Public for testing. */
    _adapt(dt) {
        if (!this.auto) return;
        if (dt <= 0 || dt > 0.25) return; // tab switch / hitch
        if (this._settle > 0) { this._settle -= dt; return; }
        const ms = dt * 1000;
        const a = 1 - Math.exp(-dt / 0.4);
        this._ema += (ms - this._ema) * a;
        // display refresh estimate (10th percentile of recent intervals, clamped to 59..144 Hz)
        const d = this._dts; d.push(ms); if (d.length > 120) d.shift();
        const sorted = [...d].sort((x, y) => x - y);
        const refresh = THREE.MathUtils.clamp(sorted[Math.floor(sorted.length * 0.1)] || 16.7, 6.9, 16.9);
        const up = Math.max(11, refresh * 1.1), down = 20;
        this._slowT = this._ema > down ? this._slowT + dt : 0;
        this._fastT = this._ema < up ? this._fastT + dt : 0;
        const now = this.time;
        if (this._slowT > 2 && this.level < AUTO_MIN) {
            // block the level we leave; each level's own back-off doubles every time it fails (20 s, 40 s, … ≤ 10 min)
            const bo = this._backoff[this.level] || 20;
            this._block[this.level] = now + bo; this._backoff[this.level] = Math.min(bo * 2, 600);
            this._applyLevel(this.level + 1);
            this._ema = Math.min(this._ema, 18);
        } else if (this._fastT > 5 && this.level > AUTO_MAX && !((this._block[this.level - 1] || 0) > now)) {
            this._applyLevel(this.level - 1);
            this._ema = 16;
        }
    }
    dispose() {
        this._cancelEnvJob();
        this.cockpitDisplays.dispose();
        this._wxGen++; this.snow?.dispose();
        this.composer.dispose?.(); this._envOut?.dispose(); this._envA?.dispose(); this._envB?.dispose(); this._envQuad?.dispose(); this._pmrem.dispose(); this.rain?.dispose();
    }
}
