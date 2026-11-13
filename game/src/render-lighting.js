// Renderer3D methods: sun / sky lighting, the ambient probe, the night switch, and the PMREM environment map
// (progressive bake, cross-fade, water reflections). Installed on Renderer3D.prototype by render.js (mixin).
import * as THREE from '../vendor/three.module.min.js';
import { FullScreenQuad } from '../vendor/addons/Pass.js';
import { solarPosition, dirFromElAz, skyState } from './weather.js';
import { setVehicleEnvMap } from './vehicles.js';
import { setWaterEnv } from './water.js';
import { progressivePMREM, supportsProgressivePMREM } from './progressive-pmrem.js';
import { EnvBlendShader } from './render-shaders.js';

const NIGHT_FADE_S = 1.5;        // dusk switch / setLampLightsEnabled fade
const ENV_FADE_S = 1.5;          // … and cross-faded from the previous one over this time
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
export const OVERRIDES = { day: { el: 48, az: 200 }, sunset: { el: 3, az: 290 }, dusk: { el: -4, az: 300 }, night: { el: -28, az: 350 }, dawn: { el: 2.5, az: 75 } };

export class LightingMethods {

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
    /** (spec 10 load budget) compile the environment bake's programs (sky dome, flat colour, PMREM passes) while the page
     *  is idle, so the first place's bake does not stop for them; nothing of this bake is kept */
    prewarmEnvBake() {
        const envScene = new THREE.Scene(), dome = new THREE.Mesh(this.sky.geometry, this.sky.material.clone()), flat = new THREE.MeshBasicMaterial({ color: '#808080' });
        const disc = new THREE.CircleGeometry(90, 24), box = new THREE.BoxGeometry(14, 6, 14);
        try {
            const ground = new THREE.Mesh(disc, flat); ground.rotation.x = -Math.PI / 2; ground.position.y = -2;
            const block = new THREE.Mesh(box, flat); block.position.set(60, 0, 0);
            envScene.add(dome, ground, block);
            this._pmrem.fromScene(envScene, 0, 0.5, 300).dispose();
        } catch (e) { /* only a warm-up */ }
        finally { dome.material.dispose(); flat.dispose(); disc.dispose(); box.dispose(); }
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
}
