// Renderer3D methods: weather (live / climate / override, transitions, rain and snow, wet roads), seasons and
// vegetation material patches. Installed on Renderer3D.prototype by render.js (mixin).
import * as THREE from '../vendor/three.module.min.js';
import { Rain, Snow, classifyWMO, fetchLiveWeather, climateWeather, nearestClimate, weatherTargets, seasonState, WEATHER_PRESETS, WEATHER_TTL_MS } from './weather.js';
import { setVehicleSnow } from './vehicles.js';
import { patchCrowns, patchSurface } from './render-shaders.js';

const WX_TAU = 3.3;              // weather transitions: exponential, ~95 % after 10 s
const WET_DRY_S = 1800;          // roads stay wet ~30 min after the rain stops
const sky0 = new THREE.Color('#888888');
const WX_TRANSITION_KEYS = ['cloud', 'rain', 'snow', 'snowCover', 'sunMul', 'fogDens', 'windX', 'windZ'];

export class WeatherMethods {

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
}
