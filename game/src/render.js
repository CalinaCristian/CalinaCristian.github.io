import * as THREE from '../vendor/three.module.min.js';
import { EffectComposer } from '../vendor/addons/EffectComposer.js';
import { RenderPass } from '../vendor/addons/RenderPass.js';
import { ShaderPass } from '../vendor/addons/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/addons/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/OutputPass.js';
import { SMAAPass } from '../vendor/addons/SMAAPass.js';
import { FXAAShader } from '../vendor/addons/FXAAShader.js';
import { Rain, solarPosition, dirFromElAz, skyState } from './weather.js';
import { setVehicleEnvMap } from './vehicles.js';

// ============================================================================
//  Renderer3D — WebGL renderer + sky + sun/shadows + post-processing + weather
//  + adaptive quality. main.js keeps its own scene/camera; this module owns how
//  a frame gets drawn.
// ============================================================================

/** quality ladder, best → cheapest. Auto mode moves between AUTO_MIN..AUTO_MAX. */
export const QUALITY_LADDER = [
    { name: 'ultra', pr: 2.0, shadow: 4096, post: 'full', aa: 'smaa', ao: true, lamps: 24 },
    { name: 'high', pr: 1.5, shadow: 4096, post: 'full', aa: 'smaa', ao: false, lamps: 16 },
    { name: 'high-', pr: 1.25, shadow: 2048, post: 'full', aa: 'smaa', ao: false, lamps: 12 },
    { name: 'medium', pr: 1.0, shadow: 2048, post: 'lite', aa: 'fxaa', ao: false, lamps: 8 },
    { name: 'low+', pr: 1.0, shadow: 0, post: 'lite', aa: 'fxaa', ao: false, lamps: 4 },
    { name: 'low', pr: 1.0, shadow: 0, post: 'off', aa: 'none', ao: false, lamps: 0 },
];
const NAMED = { ultra: 0, high: 1, medium: 3, low: 5 };
const AUTO_MAX = 1, AUTO_MIN = 5; // auto never enables 'ultra' (GTAO doubles the draw calls)
const SHADOW_SPAN = 160; // metres covered by the sun's shadow map
const LAMP_RANGE = 150;  // light-pool discs drawn within this distance (m)
const MAX_DISCS = 220;
const OVERRIDES = { day: { el: 48, az: 200 }, sunset: { el: 3, az: 290 }, dusk: { el: -4, az: 300 }, night: { el: -28, az: 350 }, dawn: { el: 2.5, az: 75 } };

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
        vec2 uv = d.xz / (h + 0.09) * 0.55 + vec2(uTime * 0.006, uTime * 0.0025);
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
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uRain, uWT, uRainT; uniform vec2 uRes, uGrade;
uniform mat3 uH; uniform vec3 uWs, uWp0, uWp1; uniform vec4 uWiper;
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
    if (uRain > 0.0) {
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

// ---------------------------------------------------------------------------
export class Renderer3D {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{quality?: 'auto'|'low'|'medium'|'high'|'ultra', renderer?: THREE.WebGLRenderer, autoGauges?: boolean, envLighting?: number}} opts
     */
    constructor(canvas, opts = {}) {
        this.opts = { autoGauges: false, envLighting: 0.3, ...opts };
        const r = this._renderer = opts.renderer || new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.info.autoReset = false;
        this.width = canvas.clientWidth || window.innerWidth; this.height = canvas.clientHeight || window.innerHeight;
        this.time = 0;
        this.scene = null; this.camera = null; this.env = null; this.player = null;
        this.stats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, pixelRatio: 1, shadows: 0, post: 'off', quality: '', auto: false, level: 1 };

        // lights + sky (re-parented into each scene)
        this.sun = new THREE.DirectionalLight('#ffffff', 2);
        this.sun.castShadow = true;
        this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 900;
        this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.6);
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), makeSkyMaterial());
        this.sky.frustumCulled = false; this.sky.renderOrder = -100; this.sky.userData.shared = true;
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
        this._envEl = null; this._envNight = null; this._envT = 0;
        // street lamps
        this.lamps = null; this._lampHead = null; this._lampPool = []; this._lampGroup = new THREE.Group(); this._lampGroup.visible = false;
        this._lampGroup.userData.shared = true;
        this._discs = null; this._lampT = 0; this._lampAt = new THREE.Vector3(1e9, 0, 1e9);

        // post
        this.composer = new EffectComposer(r);
        this.renderPass = new RenderPass(null, null);
        this.outputPass = new OutputPass();
        this.finalPass = new ShaderPass(FinalShader);
        this.bloomPass = null; this.smaaPass = null; this.fxaaPass = null; this.gtaoPass = null;

        // adaptive quality state
        this._ema = 16.7; this._slowT = 0; this._fastT = 0; this._settle = 2; this._dts = []; this._block = {}; this._backoff = {};
        this._fpsAcc = 0; this._fpsN = 0;
        this._pmrem = new THREE.PMREMGenerator(r);
        this._envRT = null;
        this._tmp = { v: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(), m: new THREE.Matrix4(), cam: new THREE.Vector3(), vel: new THREE.Vector3() };
        this.setQuality(opts.quality || 'auto');
    }

    get renderer() { return this._renderer; }

    // ------------------------------------------------------------------ scene
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {object} env city.env from cities.js
     * @param {{sky?: THREE.Object3D, replaceLights?: boolean, units?: 'kmh'|'mph'}} o  sky = the world's own sky dome to hide
     */
    setScene(scene, camera, env, o = {}) {
        this.scene = scene; this.camera = camera; this.env = env; this.mph = o.units === 'mph';
        const replace = o.replaceLights !== false;
        if (replace) for (const c of [...scene.children]) if ((c.isDirectionalLight || c.isHemisphereLight || c.isAmbientLight) && c !== this.sun && c !== this.hemi) scene.remove(c);
        if (o.sky) o.sky.visible = false;
        scene.add(this.sun, this.sun.target, this.hemi, this.sky, this._lampGroup);
        if (this._discs) scene.add(this._discs);
        scene.fog = new THREE.FogExp2(env.fog, (env.rain ? 2.0 : 1.45) / env.fogFar);
        scene.background = new THREE.Color(env.fog);
        this._applyLighting(true);
        // environment map for reflections (vehicle paint, glass, wet roads)
        this._buildEnvMap();
        this._envEl = this.sunElevation; this._envNight = this.nightLights;
        // weather
        if (this.rain) { this.rain.mesh.removeFromParent(); this.rain.dispose(); this.rain = null; }
        if (env.rain) { this.rain = new Rain({ count: 4000, opacity: 0.2 }); scene.add(this.rain.mesh); }
        this._applyRainToCockpit();
        // passes
        this.renderPass.scene = scene; this.renderPass.camera = camera;
        if (this.gtaoPass) { this.gtaoPass.scene = scene; this.gtaoPass.camera = camera; }
        this._settle = 2;
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
        const overcastEnv = env.clouds >= 0.85;
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
            fu.uGrade.value.set(overcastEnv ? 0.95 : 1.1, overcastEnv ? 1.04 : 1.06);
            this._sunLightDir = this._sunDir; this._sunShadows = true;
        } else {
            const st = skyState(el, env.clouds);
            dirFromElAz(el, az, this._sunDir);
            dirFromElAz(Math.max(22, 12 - el * 0.8), (az + 180) % 360, this._moonDir);
            const useSun = el > -2;
            this._lightDir = (this._lightDir || new THREE.Vector3()).copy(useSun ? this._sunDir : this._moonDir);
            if (this._lightDir.y < 0.05) { this._lightDir.y = 0.05; this._lightDir.normalize(); }
            this._sunLightDir = this._lightDir;
            if (useSun) { this.sun.color.copy(st.sun); this.sun.intensity = st.sunI * (env.sunIntensity >= 2 ? 1 : 1.15); }
            else { this.sun.color.set('#9fb2e6'); this.sun.intensity = 0.16 * st.night * (1 - st.overcast * 0.7); }
            this.sun.shadow.intensity = (1 - 0.55 * st.overcast) * 0.9;
            this._sunShadows = useSun && st.sunI > 0.15;
            this.hemi.color.copy(st.hemiSky); this.hemi.groundColor.copy(st.hemiGround); this.hemi.intensity = st.hemiI;
            const fog = st.horizon.clone().multiplyScalar(0.94);
            this.scene.fog?.color.copy(fog); if (this.scene.background?.isColor) this.scene.background.copy(fog);
            this._renderer.toneMappingExposure = env.exposure * st.expo;
            u.uZenith.value.copy(st.zenith); u.uHorizon.value.copy(st.horizon); u.uGround.value.copy(st.hemiGround).multiplyScalar(0.8);
            u.uSunDir.value.copy(this._sunDir); u.uSunColor.value.copy(st.sun);
            u.uSunPower.value = (overcastEnv ? 2 : 28) * THREE.MathUtils.smoothstep(el, -1.5, 1);
            u.uCloudLit.value.copy(st.cLit); u.uCloudDark.value.copy(st.cDark);
            u.uNight.value = st.night; u.uMoonDir.value.copy(this._moonDir);
            const n = st.night;
            fu.uGrade.value.set((overcastEnv ? 0.95 : 1.1) - n * 0.15, 1.05);
            this._rainBright = THREE.MathUtils.clamp(st.hemiI / 0.85 + 0.12, 0.25, 1);
        }
        u.uCover.value = env.clouds; u.uHaze.value = overcastEnv ? 0.3 : 0.65;
        // shadows follow the tier, and are off for moonlight
        this.sun.castShadow = !!this.tier?.shadow && this._sunShadows;
        // night lights switch (hysteresis ±0.5°)
        const thr = 4 + (overcastEnv ? 4 : 0);
        const night = this.nightLights ? el < thr + 0.5 : el < thr - 0.5;
        if (night !== this.nightLights || force) this._setNight(night, force);
    }

    _setNight(on, force) {
        const changed = on !== this.nightLights;
        this.nightLights = on;
        this._lampGroup.visible = on && this._lampPool.length > 0;
        if (this._discs) this._discs.visible = on;
        const hm = this._lampHead;
        if (hm) {
            if (hm.emissive) { hm.emissive.set(on ? '#ffd7a0' : '#000000'); hm.emissiveIntensity = on ? 3 : 0; }
            else if (hm.color) hm.color.set(on ? hm.userData.nightColor || '#ffe2b0' : hm.userData.dayColor || '#d8d4c8');
            if (hm.color && !hm.emissive && on) hm.color.multiplyScalar(3);
        }
        this._lampAt.set(1e9, 0, 1e9);
        this._updateHeadlights();
        this.player?.cockpit?.userData.setInteriorLight?.(on ? 0.3 : 1);
        if (changed) this.onNightLights?.(on);
    }

    // ------------------------------------------------------------------ headlights
    /** true/false = manual; null = automatic (on whenever nightLights) */
    setHeadlights(v) { this._headManual = v === null || v === undefined ? null : !!v; this._updateHeadlights(); }
    _updateHeadlights() {
        const on = this._headManual ?? this.nightLights;
        this.headlightsOn = on;
        this.player?.cockpit?.userData.headlights?.setOn(on);
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
        const head = o.headMaterial || o.headMesh?.material || null;
        if (this._lampHead && this._lampHead !== head && this._lampHead.emissive) this._lampHead.emissiveIntensity = 0;
        this._lampHead = head;
        if (this._lampHead?.color && !this._lampHead.emissive) this._lampHead.userData.dayColor ??= '#' + this._lampHead.color.getHexString();
        if (!this._discs) {
            const c = document.createElement('canvas'); c.width = c.height = 128;
            const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
            const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
            const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffc98a').multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
            this._discs = new THREE.InstancedMesh(geo, mat, MAX_DISCS);
            this._discs.count = 0; this._discs.frustumCulled = false; this._discs.renderOrder = 2; this._discs.userData.shared = true;
            this._discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DISCS * 3), 3);
        }
        this.scene?.add(this._discs);
        this._discs.visible = this.nightLights;
        this._syncLampPool();
        this._lampAt.set(1e9, 0, 1e9);
    }
    _syncLampPool() {
        const want = this.lamps && this.lamps.length ? (this.tier?.lamps ?? 0) : 0;
        while (this._lampPool.length > want) this._lampGroup.remove(this._lampPool.pop());
        while (this._lampPool.length < want) {
            const l = new THREE.PointLight('#ffc98a', 0, 28, 1.7); l.userData.shared = true;
            this._lampPool.push(l); this._lampGroup.add(l);
        }
        this._lampGroup.visible = this.nightLights && this._lampPool.length > 0;
    }
    _updateLamps(cam, dt) {
        if (!this.nightLights || !this.lamps || !this.lamps.length) return;
        this._lampT -= dt;
        const p = this.player, cx = p ? p.x : cam.x, cz = p ? p.z : cam.z;
        const moved = (cx - this._lampAt.x) ** 2 + (cz - this._lampAt.z) ** 2;
        if (this._lampT > 0 && moved < 36) return;
        this._lampT = 0.25; this._lampAt.set(cx, 0, cz);
        // bias toward lamps ahead of the car
        const ax = p ? cx + p.fx * 25 : cx, az = p ? cz + p.fz * 25 : cz;
        const L = this.lamps, R2 = LAMP_RANGE * LAMP_RANGE, near = [];
        for (let i = 0; i < L.length; i += 4) {
            const dx = L[i] - cx, dz = L[i + 1] - cz, d2 = dx * dx + dz * dz;
            if (d2 < R2) near.push(d2, i);
        }
        const idx = []; for (let k = 0; k < near.length; k += 2) idx.push(k);
        idx.sort((a, b) => near[a] - near[b]);
        // discs
        const D = this._discs, m = this._tmp.m, col = new THREE.Color();
        const n = Math.min(idx.length, MAX_DISCS);
        for (let k = 0; k < n; k++) {
            const i = near[idx[k] + 1], d = Math.sqrt(near[idx[k]]), h = L[i + 2] - L[i + 3], r = h * 1.9;
            m.makeScale(r, 1, r).setPosition(L[i], L[i + 3] + 0.22, L[i + 1]);
            D.setMatrixAt(k, m);
            const f = 1 - THREE.MathUtils.smoothstep(d, LAMP_RANGE * 0.65, LAMP_RANGE);
            D.setColorAt(k, col.setScalar(f));
        }
        D.count = n; D.instanceMatrix.needsUpdate = true; if (D.instanceColor) D.instanceColor.needsUpdate = true;
        // real point lights: nearest to the look-ahead point
        const pool = this._lampPool; if (!pool.length) return;
        const cand = idx.slice(0, Math.min(idx.length, pool.length * 3)).map(k => near[k + 1]);
        cand.sort((a, b) => ((L[a] - ax) ** 2 + (L[a + 1] - az) ** 2) - ((L[b] - ax) ** 2 + (L[b + 1] - az) ** 2));
        for (let j = 0; j < pool.length; j++) {
            const l = pool[j], i = cand[j];
            if (i === undefined) { l.intensity = 0; continue; }
            const d = Math.hypot(L[i] - cx, L[i + 1] - cz);
            l.position.set(L[i], L[i + 2] - 0.4, L[i + 1]);
            l.intensity = 55 * (1 - THREE.MathUtils.smoothstep(d, 60, 95));
        }
    }

    setPlayer(player) { this.player = player; this._applyRainToCockpit(); this._updateHeadlights(); player?.cockpit?.userData.setInteriorLight?.(this.nightLights ? 0.3 : 1); }
    _applyRainToCockpit() { this.player?.cockpit?.userData.setRain?.(!!this.env?.rain); }

    _buildEnvMap() {
        const envScene = new THREE.Scene();
        const dome = new THREE.Mesh(this.sky.geometry, this.sky.material);
        envScene.add(dome);
        // a hint of ground + city mass below the horizon so reflections are not pure sky
        const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.env.asphalt || '#444').lerp(new THREE.Color(this.env.fog), 0.25) }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -2; envScene.add(ground);
        const blocks = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.env.hemiGround).multiplyScalar(0.7) });
        for (let i = 0; i < 14; i++) {
            const a = i / 14 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(14, 6 + (i * 7) % 11, 14), blocks);
            b.position.set(Math.cos(a) * 60, 0, Math.sin(a) * 60); envScene.add(b);
        }
        if (this._envRT) this._envRT.dispose();
        this._envRT = this._pmrem.fromScene(envScene, 0, 0.5, 300);
        envScene.traverse(o => { if (o !== dome && o.geometry) o.geometry.dispose(); });
        blocks.dispose(); ground.material.dispose();
        setVehicleEnvMap(this._envRT.texture, 1);
        if (this.opts.envLighting > 0) { this.scene.environment = this._envRT.texture; this.scene.environmentIntensity = this.opts.envLighting; }
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
        r.setPixelRatio(pr);
        r.setSize(this.width, this.height, false);
        this.composer.setPixelRatio(pr);
        this.composer.setSize(this.width, this.height);
        // shadows
        if (t.shadow) {
            if (this.sun.shadow.mapSize.x !== t.shadow) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(t.shadow, t.shadow); }
            this.sun.castShadow = this._sunShadows !== false;
            const sc = this.sun.shadow.camera, h = SHADOW_SPAN / 2;
            sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.updateProjectionMatrix();
            const texel = SHADOW_SPAN / t.shadow;
            this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = texel * 0.9;
            this.sun.shadow.radius = 3;
        } else this.sun.castShadow = false;
        this._buildPasses();
        if (this._lampGroup) this._syncLampPool();
        this._settle = 2; this._slowT = 0; this._fastT = 0;
        Object.assign(this.stats, { pixelRatio: pr, shadows: t.shadow, post: t.post + (t.ao ? '+ao' : ''), quality: this.auto ? `auto (${t.name})` : t.name, auto: this.auto, level });
    }
    _buildPasses() {
        const t = this.tier, c = this.composer, w = this.width, h = this.height;
        for (const p of [...c.passes]) c.removePass(p);
        if (t.post === 'off') return;
        c.addPass(this.renderPass);
        if (t.ao) {
            if (!this.gtaoPass) this._gtaoLoading ??= import('../vendor/addons/GTAOPass.js').then(({ GTAOPass }) => {
                this.gtaoPass = new GTAOPass(this.scene, this.camera, w, h);
                this.gtaoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1 });
                this.gtaoPass.blendIntensity = 0.85;
                if (this.tier.ao) this._buildPasses();
            });
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
            if (!this.smaaPass) this.smaaPass = new SMAAPass(w * this._renderer.getPixelRatio(), h * this._renderer.getPixelRatio());
            c.addPass(this.smaaPass);
        } else if (t.aa === 'fxaa') {
            if (!this.fxaaPass) this.fxaaPass = new ShaderPass(FXAAShader);
            c.addPass(this.fxaaPass);
        }
        c.setSize(w, h); // propagate sizes to newly added passes
        this._updateResUniforms();
    }
    _updateResUniforms() {
        const pr = this._renderer.getPixelRatio();
        this.finalPass.uniforms.uRes.value.set(this.width * pr, this.height * pr);
        if (this.fxaaPass) this.fxaaPass.material.uniforms.resolution.value.set(1 / (this.width * pr), 1 / (this.height * pr));
    }

    resize(w, h) {
        this.width = w; this.height = h;
        this._renderer.setSize(w, h, false);
        this.composer.setSize(w, h);
        this._updateResUniforms();
        this._settle = Math.max(this._settle, 1);
    }

    // ------------------------------------------------------------------ frame
    /** Render one frame. dt in seconds; omit it to use an internal clock. */
    frame(dt) {
        const { scene, camera } = this;
        if (!scene || !camera) return;
        const now = performance.now();
        if (dt === undefined) dt = this._lastNow ? Math.min(0.1, (now - this._lastNow) / 1000) : 1 / 60;
        this._lastNow = now;
        this.time += dt;
        const T = this._tmp;
        camera.getWorldPosition(T.cam);
        // sky follows the camera
        this.sky.position.copy(T.cam);
        this.sky.material.uniforms.uTime.value = this.time;
        if (this.clock) {
            this._applyLighting();
            // refresh reflections when the sky changed noticeably (≤ every 2 s)
            this._envT -= dt;
            if (this._envT <= 0 && (Math.abs(this.sunElevation - this._envEl) > 1.5 || this.nightLights !== this._envNight)) {
                this._envT = 2; this._buildEnvMap(); this._envEl = this.sunElevation; this._envNight = this.nightLights;
            }
        }
        this._updateSun(T.cam);
        this._updateLamps(T.cam, dt);
        // weather + cockpit
        const p = this.player;
        if (p) {
            T.vel.set(p.fx * p.speed, 0, p.fz * p.speed);
            const ck = p.cockpit?.userData;
            if (ck) {
                ck.tick?.(dt);
                if (this.opts.autoGauges && ck.updateGauges) {
                    const sp = Math.abs(p.speed), gear = Math.min(5, Math.floor(sp / 8.5));
                    const rpm = 0.11 + Math.min(0.85, ((sp - gear * 8.5) / 8.5) * 0.55 + 0.18 + (p.speed > 0.3 ? 0.05 : 0));
                    ck.updateGauges(p.speed, sp < 0.3 ? 0.1 : rpm, 0.72, this.mph);
                }
            }
        } else T.vel.set(0, 0, 0);
        if (this.rain) { this.rain.update(dt, T.cam, T.vel); this.rain.uniforms.uColor.value.set('#b9c4cf').multiplyScalar(this.clock ? this._rainBright ?? 1 : 1); }
        this._updateWindshield();
        // render
        const fu = this.finalPass.uniforms; fu.uTime.value = this.time;
        if (this.tier.post === 'off') this._renderer.render(scene, camera);
        else this.composer.render(dt);
        // stats
        const info = this._renderer.info;
        this.stats.drawCalls = info.render.calls; this.stats.triangles = info.render.triangles;
        info.reset();
        this._fpsAcc += dt; this._fpsN++;
        if (this._fpsAcc > 0.5) { this.stats.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
        this._adapt(dt);
    }

    _updateSun(cam) {
        const s = this.sun, d = this._sunLightDir || this._sunDir, T = this._tmp;
        // centre the shadow frustum a bit ahead of the player, snapped to shadow texels (no shimmering)
        const p = this.player;
        const c = T.v.copy(cam); c.y = 0;
        if (p) { c.x += p.fx * SHADOW_SPAN * 0.25; c.z += p.fz * SHADOW_SPAN * 0.25; }
        if (s.castShadow) {
            const texel = SHADOW_SPAN / s.shadow.mapSize.x;
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
        if (!ws || !st || !this.env?.rain || this.tier.post === 'off' || !ck.visible || !this.player.cockpit.parent) { fu.uRain.value = 0; return; }
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
        fu.uRain.value = st.on ? 1 : 0;
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
        this.stats.frameMs = Math.round(this._ema * 10) / 10;
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
        this.composer.dispose?.(); this._envRT?.dispose(); this._pmrem.dispose(); this.rain?.dispose();
    }
}
