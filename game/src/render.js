import * as THREE from '../vendor/three.module.min.js';
import { EffectComposer } from '../vendor/addons/EffectComposer.js';
import { RenderPass } from '../vendor/addons/RenderPass.js';
import { ShaderPass } from '../vendor/addons/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/addons/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/OutputPass.js';
import { SMAAPass } from '../vendor/addons/SMAAPass.js';
import { FXAAShader } from '../vendor/addons/FXAAShader.js';
import { WEATHER_PRESETS } from './weather.js';
import { setWaterEnv, tickWater } from './water.js';
import { CockpitDisplays, displayPixelRatio } from './cockpit-displays.js';

// Renderer3D methods by concern (prototype mixins, installed right after the class below)
import { FinalShader, makeSkyMaterial, makeSurfU, makeTreeU } from './render-shaders.js';
import { mixin } from './mixin.js';
import { LightingMethods, OVERRIDES } from './render-lighting.js';
import { WeatherMethods } from './render-weather.js';
import { LAMP_RANGE, LampMethods } from './render-lamps.js';

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
const ENV_REBUILD_DEG = 3;       // PMREM environment rebuilt when the sun moved more than this …
const SHADOW_DIR_DEG = 0.15;     // sun direction used for shadows is quantised (no slow shadow crawl)

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

    setPlayer(player) {
        this.player = player; this._applyRainToCockpit(); this._updateHeadlights();
        this.cockpitDisplays.setPlayer(player, this.camera, this.scene, this.tier.post === 'off');
        this.camera?.layers.enable(1);
        this._cabinK = -1; this._updateNight(0);
    }
    _applyRainToCockpit() { this.player?.cockpit?.userData.setRain?.(this._wipers); }

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
                  // (parked meshes are flagged too: a pre-render hook that sets its own mesh's visibility, the crowd's, must leave it off)
                  pass.overrideVisibility = () => { hide(); pass.scene?.traverse(o => { if (o.visible && skip(o)) { o.visible = false; o.userData.prepassParked = true; parked.push(o); } }); };
                  pass.restoreVisibility = () => { for (const o of parked) { o.visible = true; delete o.userData.prepassParked; } parked.length = 0; show(); }; }
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
mixin(Renderer3D, LightingMethods, WeatherMethods, LampMethods);
