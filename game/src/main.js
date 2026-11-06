import * as THREE from '../vendor/three.module.min.js';
import * as CITY_MOD from './cities.js';
import { chapterCard, chapterMontage, chapterSelectHtml, loadProgress, saveProgress, chapterCardOpen } from './chapters.js';
import { STOPS, AIRPORTS, FACTS, PROFILE, ROADWORKS } from './data.js';
import { buildWorld, collideBuildings } from './world.js';
import { Traffic, laneOffset } from './traffic.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { HUD } from './hud.js';
import { MiniMap } from './minimap.js';
import { Office } from './office.js';
import { playFlight } from './flight.js';
import { Navigator, CarScreen, canTravel, edgeSpeed, isMotorway, roadName, fmtDist, stepText, stepArrow, lanesDir } from './nav.js';
import { isTouch, clamp, angleDiff, signTexture } from './util.js';
import { Renderer3D } from './render.js';
import { PhotoMode } from './photo.js';

const $ = (s) => document.querySelector(s);
const { CITIES } = CITY_MOD;
// chapters in districts (spec 10): feature-detected — without CHAPTERS the old continuous-map flow runs
const CHAPTERS = Array.isArray(CITY_MOD.CHAPTERS) && CITY_MOD.CHAPTERS.length && Object.values(CITIES).some(c => c.districts) ? CITY_MOD.CHAPTERS : null;
/** dev tools (collision overlay on B) only on localhost or with ?dev */
const DEV = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname) || /[?&]dev\b/.test(location.search);
// ---------- weather (render agent exposes r3d.weather / setWeather / onWeatherChange; all feature-detected) ----------
const WEATHER_OVERRIDES = ['clear', 'cloudy', 'drizzle', 'rain', 'snow', 'fog', 'storm'];
const WX_ICON = { clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '🌨️', fog: '🌫️', storm: '⛈️' };
const WX_LABEL = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', fog: 'Fog', storm: 'Storm' };
/** coarse class of a weather object: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm' */
function weatherKind(w) {
    if (!w) return 'clear';
    const c = w.code;
    if (typeof c === 'number') { // WMO weather codes
        if (c >= 95) return 'storm';
        if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
        if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
        if (c === 45 || c === 48) return 'fog';
        if (c >= 2) return 'cloudy';
    }
    const t = `${typeof c === 'string' ? c : ''} ${w.label || ''} ${w.kind || ''}`.toLowerCase();
    if (/thunder|storm/.test(t)) return 'storm';
    if (/snow|sleet|blizzard|flurr/.test(t)) return 'snow';
    if (/rain|drizzle|shower/.test(t)) return 'rain';
    if (/fog|mist|haze/.test(t)) return 'fog';
    if ((w.snowCm ?? 0) > 0.05) return 'snow';
    if ((w.precipMm ?? 0) > 0.1) return 'rain';
    if (Number.isFinite(w.visibilityM) && w.visibilityM < 1000) return 'fog';
    if (/cloud|overcast/.test(t) || (w.cloud ?? 0) > 0.7) return 'cloudy';
    return 'clear';
}
/** grip (1 dry) and NPC speed factor per weather class */
const WX_GRIP = { rain: 0.72, storm: 0.66, snow: 0.45 };
const WX_NPC = { rain: 0.85, storm: 0.8, snow: 0.65 };
const SEASON_ICON = { winter: '❄️', spring: '🌸', summer: '☀️', autumn: '🍂', fall: '🍂' };
/** season text for a date and hemisphere (fallback when the weather object has none) */
function seasonText(date, timeZone) {
    let m = date.getMonth();
    try { m = +new Intl.DateTimeFormat('en-GB', { timeZone, month: 'numeric' }).format(date) - 1; } catch { /* ignore */ }
    const names = ['winter', 'spring', 'summer', 'autumn'];
    const si = Math.floor(((m + 1) % 12) / 3), pos = (m + 1) % 3; // Dec-Feb winter … Sep-Nov autumn; 0 early, 1 mid, 2 late
    const name = names[si];
    return { name, text: pos === 0 ? `Early ${name}` : pos === 2 ? `Late ${name}` : name[0].toUpperCase() + name.slice(1) };
}
const BAND_TEXT = {
    rush: ['🚦 Rush hour', 'Heavy traffic until the peak is over. Expect queues, honking and double-parkers.'],
    night: ['🌙 Night: light traffic', 'Empty streets — mind the speed cameras.'],
    normal: ['🚗 Traffic back to normal', ''],
};

// ---------- fuel model ----------
const TANK_L = 45;
const FUEL_IDLE = 0.8 / 3600;      // L/s at idle (~0.8 L/h)
const FUEL_ROLL = 4.4e-5;          // L per metre-ish term (rolling / drivetrain)
const FUEL_AERO = 5e-8;            // L/s per (m/s)^3
const FUEL_ACC = 5e-5;             // L per (m/s^2 · m/s · s) while accelerating
// ≈ 7 L/100 km cruising at 50 km/h, ~12 in stop-and-go, ~9.5 at 110 km/h.
// The tank drains FUEL_GAME_MULT× faster than the trip computer shows, so a playthrough needs a fill-up.
const FUEL_GAME_MULT = 6;
const GAL = 3.78541;
const PRICES = {
    bucharest: { cur: 'RON', unit: 'L', def: 7.35, brands: { Petrom: 7.39, OMV: 7.52, MOL: 7.36, Rompetrol: 7.41, Lukoil: 7.29, Socar: 7.34, Gazprom: 7.31 } },
    seattle: { cur: 'USD', unit: 'gal', def: 4.49, brands: { Chevron: 4.79, Shell: 4.69, '76': 4.59, Arco: 4.29, ARCO: 4.29, Costco: 4.19, BP: 4.55, Texaco: 4.65, Mobil: 4.62 } },
};
const BRANDS = { bucharest: ['Petrom', 'OMV', 'MOL', 'Rompetrol', 'Lukoil', 'Socar'], seattle: ['Chevron', 'Shell', '76', 'Arco'] };
// fines by km/h over the limit (RO: OUG 195/2002 classes, approx 2025; WA: approx 2025 base + fees)
function fineFor(cityId, overKmh) {
    if (cityId === 'bucharest') return overKmh <= 20 ? 580 : overKmh <= 30 ? 1015 : overKmh <= 40 ? 1450 : 2030;
    const mph = overKmh / 1.609;
    return mph <= 10 ? 187 : mph <= 15 ? 236 : mph <= 20 ? 289 : mph <= 25 ? 370 : mph <= 30 ? 463 : 555;
}
// ---------- local time of the current city ----------
const TIME_ZONES = { bucharest: 'Europe/Bucharest', seattle: 'America/Los_Angeles' };
const OVERRIDE_HOURS = { dawn: 6.2, day: 13, sunset: 19.6, night: 23.2 };
const PHASE_ICON = { night: '🌙', dawn: '🌅', dusk: '🌇', day: '☀️' };
/** hours (0..24, fractional) of `date` in `timeZone` */
function localHours(date, timeZone) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
        const h = +parts.find(x => x.type === 'hour').value, m = +parts.find(x => x.type === 'minute').value;
        return h + m / 60;
    } catch { return date.getHours() + date.getMinutes() / 60; }
}
/** coarse phase from local hour (used when the render module does not expose one) */
function phaseFromHours(h) { return h < 5.5 || h >= 21 ? 'night' : h < 7.5 ? 'dawn' : h >= 19 ? 'dusk' : 'day'; }
const money = (cur, v) => cur === 'RON' ? `${Math.round(v).toLocaleString('ro-RO')} RON` : `$ ${v.toFixed(v >= 100 ? 0 : 2)}`;

class Game {
    constructor() {
        this.canvas = $('#gl');
        // Renderer3D owns the WebGLRenderer, lighting, sky, weather, post-processing and adaptive quality
        this.r3d = this.renderer3d = new Renderer3D(this.canvas, { quality: 'auto' });
        this.renderer = this.r3d.renderer; // still used directly for the mirror pass and the office scene
        this.camera = new THREE.PerspectiveCamera(72, 1, 0.2, 5000); // near 0.2: the door trim is 0.47 m from the eye (R17.4)
        this.input = new Input();
        this.audio = new Audio();
        this.hud = new HUD();
        this.touch = isTouch();
        this.quality = 'auto'; // Renderer3D's auto mode starts high on desktop, low+ on touch, and adapts to frame time
        this.state = 'menu';
        this.visited = new Set();
        // chapters: `chapter` = current chapter id (telemetry), `ch` its CHAPTERS entry, `chapterDone` = completed (free drive)
        this.chapters = CHAPTERS; this.progress = loadProgress();
        this.chapter = null; this.ch = null; this.chapterIdx = -1; this.chapterDone = false; this.district = null;
        this.honks = 0;
        this.frameClock = new THREE.Clock();
        this.mapOpen = false;
        this.flags = {};
        this.fuel = TANK_L * 0.6;
        this.stats = { dist: 0, time: 0, fuelL: 0, fuelReal: 0, fuelCost: { RON: 0, USD: 0 }, fines: { RON: 0, USD: 0 }, fineCount: 0, tow: { RON: 0, USD: 0 }, cleanDist: 0, peds: 0, fastTravels: 0, fastDist: 0 };
        this.opts = { minimap: this.loadOpt('minimap', false), look: this.loadStr('look', 'lock') };
        { const q = new URLSearchParams(location.search).get('weather'); this.weatherOverride = WEATHER_OVERRIDES.includes(q) ? q : null; }
        this.wxGrip = 1; this.wxNpc = 1; this.wxKind = 'clear';
        this.frame = 0;
        this.clock = { date: new Date(), timeZone: 'Europe/Bucharest', override: null };
        this.headlights = 'auto'; // 'auto' | true | false
        this.nightLights = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        if (this.touch) { document.body.classList.add('touch'); this.input.bindTouch(document); }
        this.input.bindLook(this.canvas);
        this.input.setLookMode(this.opts.look);
        this.input.onLockChange = (locked) => this.onLockChange(locked);
        // debug info for the dev harness (collision log, overlay toggle)
        this.debug = { dev: DEV, overlay: false, lastCollider: null, hits: [], setOverlay: (on) => this.setDebugOverlay(on) };
        this.bindMenu();
        this.applyOpts();
        $('#prompt')?.addEventListener('click', (e) => { if (e.target.closest('[data-act=uturn]')) this.uTurn(); });
        // photo mode (spec 16): listens to P itself while drive / office / on foot
        try {
            this.photo = new PhotoMode({
                renderer: this.renderer, getScene: () => (this.state === 'office' ? this.office?.scene : this.scene), getCamera: () => this.camera,
                hud: this.hud, audio: this.audio, input: this.input,
                canOpen: () => (this.state === 'drive' || this.state === 'office' || this.state === 'foot') && !this.mapOpen && !this.hud.panelOpen,
                getInfo: () => ({ place: this.state === 'office' ? this.office?.stop.company : document.getElementById('street')?.textContent, city: this.city?.id, timeZone: this.clock.timeZone, night: !!this.r3d.nightLights }),
                onPhoto: (meta) => this.hud.toast('📸 Saved', `${meta.place || 'Photo'} · ${meta.filter}`),
            });
        } catch (e) { console.warn('[photo]', e); this.photo = null; }
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }
    loadOpt(k, def) { try { const v = localStorage.getItem('dmcv:' + k); return v === null ? def : v === '1'; } catch { return def; } }
    saveOpt(k, v) { try { localStorage.setItem('dmcv:' + k, v ? '1' : '0'); } catch { /* ignore */ } }
    loadStr(k, def) { try { return localStorage.getItem('dmcv:' + k) ?? def; } catch { return def; } }
    saveStr(k, v) { try { localStorage.setItem('dmcv:' + k, v); } catch { /* ignore */ } }
    applyOpts() {
        document.body.classList.toggle('no-minimap', !this.opts.minimap); const cb = $('#opt-minimap'); if (cb) cb.checked = this.opts.minimap;
        const lm = $('#lookmode'); if (lm) lm.value = this.opts.look;
    }

    resize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
        this.r3d.resize(w, h);
    }

    bindMenu() {
        $('#start').addEventListener('click', () => this.start());
        this.renderMenuChapters();
        $('#quality').addEventListener('change', (e) => { this.quality = e.target.value; this.r3d.setQuality(e.target.value); });
        $('#mute').addEventListener('click', (e) => { this.audio.setMuted(!this.audio.muted); e.target.textContent = this.audio.muted ? '🔇' : '🔊'; });
        { const ws = $('#weather'); if (ws) { if (this.weatherOverride) ws.value = this.weatherOverride; ws.addEventListener('change', (e) => this.setWeatherOverride(e.target.value === 'real' ? null : e.target.value)); } }
        $('#timeofday')?.addEventListener('change', (e) => { this.clock.override = e.target.value === 'real' ? null : e.target.value; });
        $('#lookmode')?.addEventListener('change', (e) => { this.opts.look = e.target.value; this.saveStr('look', this.opts.look); this.input.setLookMode(this.opts.look); });
        $('#opt-minimap')?.addEventListener('change', (e) => { this.opts.minimap = e.target.checked; this.saveOpt('minimap', this.opts.minimap); this.applyOpts(); });
        const bm = $('#bigmap');
        bm.addEventListener('click', (e) => { if (this._dragged) { this._dragged = false; return; } this.onMapClick(e); });
        bm.addEventListener('pointerdown', (e) => { this._drag = { x: e.clientX, y: e.clientY, cx: this.mapView?.cx, cz: this.mapView?.cz }; this._dragged = false; });
        window.addEventListener('pointerup', () => { this._drag = null; });
        bm.addEventListener('pointermove', (e) => {
            const d = this._drag; if (!d || !this.mapView) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (!this._dragged && Math.hypot(dx, dy) < 6) return;
            this._dragged = true;
            const k = devicePixelRatio / this.mapView.scale;
            this.mapView.cx = d.cx - dx * k; this.mapView.cz = d.cz - dy * k;
            if (!this._mapRaf) this._mapRaf = requestAnimationFrame(() => { this._mapRaf = 0; this.redrawMap(); });
        });
        $('#map-close')?.addEventListener('click', () => this.toggleMap(false));
        $('#navlist')?.addEventListener('click', (e) => {
            const chb = e.target.closest('[data-chapter]');
            if (chb) { this.toggleMap(false); this.goToChapter(+chb.dataset.chapter); return; }
            const ft = e.target.closest('[data-ft]');
            if (ft) { const it = this.navItems[+ft.dataset.ft]; if (it) { this.toggleMap(false); this.fastTravel({ x: it.x, z: it.z, label: it.label.replace(/ ✓$/, ''), station: it.group === 'Gas stations' }); } return; }
            const b = e.target.closest('[data-nav]'); if (!b) return;
            const idx = +b.dataset.nav;
            if (idx < 0) { this.navManual = false; this.autoRoute(true); }
            else { const it = this.navItems[idx]; if (it) this.setNavDest({ x: it.x, z: it.z, label: it.label }, true); }
            this.toggleMap(false);
        });
    }

    async start(chapterIdx = null) {
        if (this.started) return; this.started = true;
        $('#start').blur();
        this.audio.init(); this.audio.resume();
        $('#menu').classList.remove('show');
        $('#hud').classList.add('show');
        this.startTime = performance.now();
        if (this.chapters) {
            await this.enterChapter(chapterIdx ?? 0, { initial: true });
            this.hud.toast('🚗 Follow the blue route', 'Dashboard screen = navigation. H = horn · M = map, chapters & navigation.', 'intro');
            setTimeout(() => this.lookHint(), 4500);
            return;
        }
        $('#loading').classList.add('show');
        await new Promise(r => setTimeout(r, 30));
        await this.loadCity('bucharest');
        $('#loading').classList.remove('show');
        this.state = 'drive';
        this.hud.toast('🚗 Bucharest, 2013', 'Follow the blue route on the dashboard screen. H = horn · M = map & navigation.', 'intro');
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        setTimeout(() => this.lookHint(), 4500);
    }
    /** one-time hint for mouse / touch look */
    lookHint() {
        if (this.loadOpt('lookHintShown', false) || this.state !== 'drive') return;
        const m = this.input.lookMode;
        if (this.touch) this.hud.toast('👀 Look around', 'Drag on the upper half of the screen to look around.', 'intro');
        else if (m === 'lock') this.hud.toast('🖱️ Look around', 'Click the view to look around with the mouse · Esc frees the cursor · C looks back.', 'intro');
        else if (m === 'hold') this.hud.toast('🖱️ Look around', 'Hold the right mouse button and move the mouse · C looks back.', 'intro');
        else return;
        this.saveOpt('lookHintShown', true);
    }
    onLockChange(locked) {
        if (locked && !this.flags.lockToast) { this.flags.lockToast = true; this.hud.toast('🖱️ Mouse look on', 'Esc frees the cursor. The view re-centres when you drive straight.'); }
    }

    // ----------------------------------------------------------------------------------
    /** load a city: the old continuous map, or with `{ district, start }` one chapter district (spec 10) */
    async loadCity(id, { district = null, start = null } = {}) {
        const city = CITIES[id];
        this.city = city;
        this.chapter = null; this.ch = null; this.chapterIdx = -1; this.chapterDone = false; this.district = district;
        this.clock.timeZone = city.timeZone || TIME_ZONES[id] || 'UTC';
        if (this.scene) { this.scene.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose?.(); }); }
        const scene = this.scene = new THREE.Scene();
        const env = city.env;
        // lighting, sky, fog and weather are owned by Renderer3D (set up after the world exists)
        // world (buildWorld may be async)
        const world = this.world = await buildWorld(city, this.renderer, district ? { district, start } : {});
        scene.add(world.group);
        // navigation (spatial index shared with traffic)
        this.nav = new Navigator(world);
        // traffic
        const hi = !(this.quality === 'low' || this.quality === 'medium' || this.touch);
        this.traffic = new Traffic(world, city, scene, {
            // pool size at the rush-hour peak; the live count follows the local hour (traffic.setHour)
            maxVehicles: hi ? (id === 'bucharest' ? 480 : 125) : (id === 'bucharest' ? 170 : 50),
            maxPeds: hi ? (id === 'bucharest' ? 250 : 60) : (id === 'bucharest' ? 110 : 30),
            index: this.nav.index,
            onBubble: (v, kind) => this.hud.bubble(v, kind, city.id),
            onHonk: (v, reason) => this.vehicleHonk(v, reason),
            onBand: (band, prev) => this.onTrafficBand(band, prev),
        });
        // standstill hotspots of this district (spec 13): from the loaded world, else the city's district config
        { const cong = world.district?.congestion || (district && city.districts?.[district]?.congestion) || null; if (cong?.length && this.traffic.setCongestion) this.traffic.setCongestion(cong, city.proj); }
        { const q = new URLSearchParams(location.search); if (q.has('jam')) this.traffic.jamOverride = clamp(+q.get('jam') || 0, 0, 1); }
        this.traffic.setHour(this.trafficHours(), true);
        this.traffic.setNightLights(this.nightLights);
        // player
        if (!this.player) {
            this.player = new Player(scene, this.camera);
            this.player.onCollide = (s, what, v) => this.onCollide(s, what, v);
            this.setupScreen();
        } else { scene.add(this.player.rig); }
        this.player.world = world; this.player.traffic = this.traffic; this.player.bounds = world.bounds;
        this.traffic.setPlayer(this.player);
        this.placeSpawn(city, world);
        // renderer: scene, lighting, real-time sun, street lamps, weather
        const center = city.center || (id === 'seattle' ? { lat: 47.61, lon: -122.33 } : { lat: 44.4268, lon: 26.1025 });
        this.r3d.setScene(scene, this.camera, env, { sky: world.sky, units: city.units });
        if (world.vegetation) this.r3d.setVegetation?.(world.vegetation);
        this.r3d.setPlayer(this.player);
        this.r3d.setClock({ date: new Date(), lat: center.lat, lon: center.lon, timeZone: this.clock.timeZone, override: this.clock.override || null, timeScale: 1 });
        this.r3d.setLamps(world.lamps || [], { headMesh: world.lampHeadMesh });
        this.r3d.onNightLights = (on) => { this.nightLights = on; this.traffic?.setNightLights(on || !!this._fogLights); };
        this.r3d.onNightLights(this.r3d.nightLights);
        this.r3d.setHeadlights(this.headlights === 'auto' ? null : this.headlights);
        this._wxKey = null; this._seasonShown = false;
        if (typeof this.r3d.setWeather === 'function') { try { this.r3d.setWeather(this.weatherOverride); } catch (err) { console.warn('[weather] setWeather', err); } }
        if ('onWeatherChange' in this.r3d || typeof this.r3d.setWeather === 'function') this.r3d.onWeatherChange = () => this.pollWeather(true);
        setTimeout(() => this.seasonToast(), 2500);
        this.audio.ambience(env.rain ? 0.08 : 0.02);
        // minimap
        this.minimap = new MiniMap($('#minimap'), world, city);
        this.bigmap = new MiniMap($('#bigmap'), world, city);
        // gas stations + speed cameras
        this.props = new THREE.Group(); scene.add(this.props);
        this.setupStations(city, world);
        this.setupCameras(city, world);
        // hud
        this.hud.setUnits(city.units);
        this.hud.setTicker(FACTS[city.id]);
        this.hud.setChapter(city.id === 'bucharest' ? 'Chapter 1 · București' : 'Chapter 2 · Seattle → Bellevue');
        this.stops = STOPS.filter(s => s.city === city.id).sort((a, b) => a.order - b.order);
        for (const s of this.stops) { s.poiRef = world.pois.find(p => p.id === s.poi && p.interactive !== false); if (s.poiRef) { s.poiRef.visited = this.visited.has(s.id); s.poiRef.color = s.color; s.poiRef.icon = s.icon; } }
        this.stopPois = this.stops.filter(s => s.poiRef).map(s => ({ stop: s, poi: s.poiRef }));
        this.airport = world.pois.find(p => p.id === AIRPORTS[city.id].poi && p.interactive !== false) || world.pois.find(p => p.id === AIRPORTS[city.id].poi);
        this.leftAirport = false;
        this.prevEdgeInfo = null;
        this.navManual = false; this.navInfo = null;
        this.setupClosures(city, world);
        this.updateObjective();
    }

    /** put a point on the nearest drivable lane, returns {x,z,heading,edge,dir} */
    roadPose(x, z, preferDir = 1) {
        const ne = this.nav.index.nearest(x, z, 3000); if (!ne) return { x, z, heading: 0 };
        const e = ne.edge;
        let dir = canTravel(e, preferDir) ? preferDir : -preferDir;
        if (!canTravel(e, dir)) dir = 1;
        const lat = laneOffset(e, 0) * dir;
        return { x: ne.cx + e.nx * lat, z: ne.cz + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
    }
    placeSpawn(city, world) {
        if (world.spawn && world.spawn.x !== undefined) {
            const p = world.spawn.heading !== undefined ? world.spawn : this.roadPose(world.spawn.x, world.spawn.z);
            this.player.place(p.x, p.z, p.heading, p.edge || null); return;
        }
        const sp = city.spawn;
        const e = sp && world.graph.edges.find(ed => ed.a.id === sp.edge[0] && ed.b.id === sp.edge[1]);
        if (e) {
            const lat = laneOffset(e, 0) * sp.dir;
            this.player.place(e.a.x + e.dirx * e.len * sp.t + e.nx * lat, e.a.z + e.dirz * e.len * sp.t + e.nz * lat, Math.atan2(-e.dirx * sp.dir, -e.dirz * sp.dir), e);
            return;
        }
        const ap = world.pois.find(p => p.id === AIRPORTS[city.id].poi);
        const ref = city.id === 'seattle' && ap ? { x: ap.doorX ?? ap.x, z: ap.doorZ ?? ap.z } : { x: 0, z: 0 };
        const p = this.roadPose(ref.x, ref.z); this.player.place(p.x, p.z, p.heading, p.edge || null);
    }

    /** dashboard navigation screen: uses the cockpit's screen mesh if provided, else a fallback plane */
    setupScreen() {
        const cockpit = this.player.cockpit;
        let screen = cockpit.userData.screen;
        if (!screen) {
            screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ toneMapped: false }));
            screen.position.set(0.25, 1.0, -1.15); screen.rotation.set(-0.3, -0.3, 0, 'YXZ');
            cockpit.add(screen); cockpit.userData.screen = screen;
        }
        this.carScreen = new CarScreen(512, 320);
        const tex = this.screenTex = new THREE.CanvasTexture(this.carScreen.canvas);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        if (!(screen.material instanceof THREE.MeshBasicMaterial)) screen.material = new THREE.MeshBasicMaterial({ toneMapped: false });
        screen.material.map = tex; screen.material.color?.set('#ffffff'); screen.material.needsUpdate = true;
    }

    // ---------------------------------------------------------------------------------- stations & cameras
    /** farthest-point sampling of edges for fallback props */
    spreadEdges(filter, n) {
        const cands = this.world.graph.edges.filter(filter); if (!cands.length) return [];
        const mid = (e) => [(e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2];
        const chosen = [cands.reduce((a, b) => (b.len > a.len ? b : a))];
        const md = cands.map(e => { const [x, z] = mid(e), [cx, cz] = mid(chosen[0]); return Math.hypot(x - cx, z - cz); });
        while (chosen.length < n) {
            let bi = -1, bd = -1;
            for (let i = 0; i < cands.length; i++) if (md[i] * Math.min(1, cands[i].len / 150) > bd) { bd = md[i] * Math.min(1, cands[i].len / 150); bi = i; }
            if (bi < 0 || bd <= 0) break;
            const e = cands[bi]; chosen.push(e); const [cx, cz] = mid(e);
            for (let i = 0; i < cands.length; i++) { const [x, z] = mid(cands[i]); md[i] = Math.min(md[i], Math.hypot(x - cx, z - cz)); }
        }
        return chosen;
    }
    setupStations(city, world) {
        const P = PRICES[city.id];
        const real = world.pois.filter(p => p.kind === 'fuel');
        this.stations = real.map(p => {
            const brand = p.brand || p.label || p.name || BRANDS[city.id][0];
            return { x: p.doorX ?? p.x, z: p.doorZ ?? p.z, brand, price: P.brands[brand] ?? P.def, poi: p };
        });
        if (!this.stations.length) {
            const edges = this.spreadEdges(e => !isMotorway(e) || city.id === 'seattle', city.id === 'bucharest' ? 5 : 3);
            edges.forEach((e, i) => {
                const dir = canTravel(e, 1) ? 1 : -1; const t = 0.5;
                const cx = e.a.x + (e.b.x - e.a.x) * t, cz = e.a.z + (e.b.z - e.a.z) * t;
                const rx = e.nx * dir, rz = e.nz * dir; const hw = e.halfW ?? 6, sw = e.sidewalk ?? 2;
                const brand = BRANDS[city.id][i % BRANDS[city.id].length];
                const st = { x: cx + rx * (hw + 1.5), z: cz + rz * (hw + 1.5), brand, price: P.brands[brand] ?? P.def, fallback: true };
                this.props.add(buildStationMesh(cx + rx * (hw + sw + 7), cz + rz * (hw + sw + 7), Math.atan2(rx, rz), brand));
                this.stations.push(st);
            });
        }
        for (const s of this.stations) { s.icon = '⛽'; s.color = '#0f766e'; }
    }
    setupCameras(city, world) {
        const real = world.pois.filter(p => p.kind === 'camera' || p.kind === 'speed_camera');
        this.cameras = real.map(p => ({ x: p.x ?? p.doorX, z: p.z ?? p.doorZ, cd: 0, lastD: 1e9 }));
        if (!this.cameras.length) {
            const edges = this.spreadEdges(e => edgeSpeed(e) >= 13 && e.len > 25 && !e.tunnel && !e.roundabout, city.id === 'bucharest' ? 6 : 4);
            for (const e of edges) {
                const cx = (e.a.x + e.b.x) / 2, cz = (e.a.z + e.b.z) / 2;
                const hw = (e.halfW ?? 6) + 1.2;
                this.cameras.push({ x: cx, z: cz, cd: 0, lastD: 1e9, edge: e });
                this.props.add(buildCameraMesh(cx + e.nx * hw, cz + e.nz * hw, Math.atan2(e.dirx, e.dirz)));
            }
        }
    }

    makeRain() {
        // rain streaks as short vertical line segments around the player
        const n = 900; const pos = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const x = (Math.random() - 0.5) * 50, y = Math.random() * 25, z = (Math.random() - 0.5) * 50;
            pos.set([x, y, z, x, y + 0.6, z], i * 6);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.LineBasicMaterial({ color: '#c9d3dd', transparent: true, opacity: 0.28, depthWrite: false });
        this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.scene.add(this.rain);
    }
    updateRain(dt) {
        const p = this.rain.geometry.attributes.position; const fall = dt * 22;
        for (let i = 0; i < p.count; i += 2) {
            let y = p.getY(i) - fall; if (y < 0) y += 25;
            p.setY(i, y); p.setY(i + 1, y + 0.6);
        }
        p.needsUpdate = true;
        this.rain.position.set(this.player.x + this.player.fx * 12, 0, this.player.z + this.player.fz * 12);
    }

    // ---------------------------------------------------------------------------------- objective / navigation
    get nextStop() { return this.stops.find(s => !this.visited.has(s.id)); }
    updateObjective() {
        if (this.ch) return this.updateChapterObjective();
        const done = STOPS.filter(s => this.visited.has(s.id)).length;
        this.hud.setProgress(done, STOPS.length);
        const n = this.nextStop;
        if (n) { this.objective = n.poiRef; this.objectiveLabel = `${n.icon} ${n.short} <small>(${n.year})</small>`; this.objectivePlain = n.short; this.hud.setYear(n.year); this.year = n.year; }
        else if (this.city.id === 'bucharest') { this.objective = this.airport; this.objectiveLabel = '✈️ Otopeni Airport — fly to Seattle <small>(2022)</small>'; this.objectivePlain = 'Otopeni Airport'; this.hud.setYear(2022); this.year = 2022; if (this.hud.achievement('all-buc')) this.audio.chime(); }
        else { this.objective = null; this.objectiveLabel = '🏁 Story complete — free roam'; this.objectivePlain = ''; this.hud.setYear('2026'); this.year = 2026; }
        this.autoRoute(true);
    }
    autoRoute(force = false) {
        if (this.navManual) return;
        const o = this.objective;
        if (!o) { this.nav.clear(); return; }
        const x = o.doorX ?? o.x, z = o.doorZ ?? o.z;
        if (!force && this.nav.dest && this.nav.dest.x === x && this.nav.dest.z === z) return;
        this.setNavDest({ x, z, label: this.objectivePlain }, false);
    }
    setNavDest(dest, manual) {
        this.navManual = manual;
        this.nav.setDestination(dest, this.player);
        if (manual && !this.nav.route) this.hud.toast('🧭 No route', 'Could not find a drivable route there.', 'warn');
    }

    // ----------------------------------------------------------------------------------
    loop() {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.1, this.frameClock.getDelta());
        if (this.state === 'drive') this.updateDrive(dt);
        else if (this.state === 'office') this.updateOffice(dt);
        else if (this.state === 'card' && this.scene) this.drawFrame();
        else if (this.state === 'menu') { /* idle */ }
    }

    /** the ONLY place the main scene is rendered while driving (render agent may replace the body) */
    drawFrame({ mirror = false } = {}) {
        if (mirror && this.player) this.player.renderMirror(this.renderer, this.scene);
        this.r3d.frame();
    }

    updateDrive(dt) {
        const { player, traffic, world, hud, input, city } = this;
        if (input.take('KeyM')) this.toggleMap(!this.mapOpen);
        if (this.mapOpen && input.take('Escape')) this.toggleMap(false);
        if (this.mapOpen || hud.panelOpen) { input.lookAllowed = false; input.releaseLock(); input.flush(); this.drawFrame(); return; }
        input.lookAllowed = true;
        if (DEV && input.take('KeyB')) this.setDebugOverlay(!this.debug.overlay);
        if (input.take('KeyN')) { this.opts.minimap = !this.opts.minimap; this.saveOpt('minimap', this.opts.minimap); this.applyOpts(); }
        this.frame++;
        this.updateClock(dt);
        if (this.frame % 30 === 0) this.pollWeather();
        if (input.take('KeyL')) {
            this.headlights = !this.headlightsOn;
            hud.toast(this.headlights ? '💡 Headlights on' : '💡 Headlights off', '');
            this.audio.blip(this.headlights ? 900 : 600, 0.05, 0.06);
        }
        player.lookBack = input.keys.has('KeyC');
        { const lk = input.takeLook(); player.applyLook(lk.dx, lk.dy, input.lookHeld, dt); }
        const empty = this.fuel <= 0;
        const prevSpeed = player.speed;
        if (this.refuel) player.update(dt, { throttle: 0, brake: true, steer: 0 }, { maxSpeed: 38 });
        else player.update(dt, input, { maxSpeed: empty ? 2 : 38, grip: this.wxGrip });
        traffic.setHour(this.trafficHours());
        traffic.update(dt);
        this.updateUnstick(dt);
        this.debug.lastCollider = player.debug.lastCollider; this.debug.hits = player.debug.hits;
        if (this.debug.overlay && this.frame % 6 === 0) this.updateDebugOverlay();
        if (input.take('KeyR')) {
            if (Math.abs(player.speed) < 6) this.resetToRoad();
            else hud.toast('🛟 Slow down first', 'Reset to the road works below ~20 km/h.', 'warn');
        }
        if (input.take('KeyF')) { this.fastTravelToObjective(); if (this.state !== 'drive') return; }
        hud.update(dt, this.camera, city.id);
        this.audio.engine(empty ? player.speed * 0.3 : player.speed, empty ? 0 : input.throttle, dt);
        this.stats.time += dt;
        // (sun follow / shadows / rain are handled inside Renderer3D.frame())
        // horn
        if (input.take('KeyH')) this.playerHonk();
        // markers bob
        const t = performance.now() / 1000;
        for (const sp of this.stopPois) { const p = sp.poi; if (p.marker) { p.marker.position.y = (p.h ?? 20) + 8 + Math.sin(t * 2 + p.x) * 0.6; p.marker.rotation.y = t; p.marker.visible = !p.visited; } }
        if (this.airport?.marker) { const p = this.airport; p.marker.position.y = (p.h ?? 20) + 8 + Math.sin(t * 2) * 0.6; p.marker.rotation.y = t; }
        // street / district
        const ne = this.nav.index.nearest(player.x, player.z, 200);
        const onRoad = ne && ne.d < (ne.edge.halfW ?? 6) + (ne.edge.sidewalk ?? 2) + 6;
        let district = '', bd = Infinity;
        for (const d of this.minimap.districts || []) { const dd = Math.hypot(d.x - player.x, d.z - player.z); if (dd < bd) { bd = dd; district = d.name; } }
        const streetName = onRoad ? roadName(ne.edge) : (world.isPark?.(player.x, player.z) ? 'Park' : 'Off road');
        hud.setStreet(streetName, district);
        hud.setSpeed(player.speed);
        this.checkRoadEvents(ne, dt);
        // ---- odometer & fuel ----
        const v = Math.abs(player.speed);
        const acc = (Math.abs(player.speed) - Math.abs(prevSpeed)) / Math.max(dt, 1e-3);
        const burn = this.refuel ? 0 : (FUEL_IDLE + FUEL_ROLL * v + FUEL_AERO * v * v * v + FUEL_ACC * Math.max(0, acc) * v) * dt;
        if (!empty) { this.fuel = Math.max(0, this.fuel - burn * FUEL_GAME_MULT); this.stats.fuelReal += burn; }
        this.stats.dist += v * dt; this.stats.cleanDist += v * dt;
        if (this.stats.cleanDist > 5000 && hud.achievement('law-abiding')) this.audio.chime();
        if (this.fuel <= 0 && !this.flags.emptyToast) { this.flags.emptyToast = true; hud.toast('⛽ Out of fuel!', 'Limping at walking pace. Press T to call a tow truck.', 'warn'); this.audio.blip(220, 0.4, 0.15); }
        if (this.fuel / TANK_L < 0.15 && this.fuel > 0 && !this.flags.lowFuel) { this.flags.lowFuel = true; hud.toast('⛽ Low fuel', 'Under 15% — find a gas station (M → Gas stations).', 'warn'); this.audio.blip(660, 0.2, 0.12); }
        if (this.fuel / TANK_L > 0.2) this.flags.lowFuel = false;
        // ---- speed limit / enforcement ----
        const us = city.units === 'mph';
        let limitDisp = null, over = false, overKmh = 0;
        if (ne && ne.d < (ne.edge.halfW ?? 6) + 2.5) {
            const lim = edgeSpeed(ne.edge);
            limitDisp = us ? Math.max(5, Math.round(lim * 2.237 / 5) * 5) : Math.max(10, Math.round(lim * 3.6 / 10) * 10);
            const limKmh = us ? limitDisp * 1.609 : limitDisp;
            overKmh = v * 3.6 - limKmh;
            over = overKmh > 10;
        }
        hud.setLimit(limitDisp, us, over);
        this.limitInfo = limitDisp != null ? { value: limitDisp, us } : null;
        this.over = over;
        this.updateEnforcement(dt, over, overKmh);
        // ---- navigation ----
        const nv = this.navInfo = this.nav.update(player, dt);
        if (nv && nv.arrived && this.navManual) { hud.toast('🏁 You have arrived', this.nav.dest?.label || ''); this.navManual = false; this.nav.clear(); this.autoRoute(true); }
        if (nv && nv.rerouted) this.audio.blip(520, 0.06, 0.06);
        // objective text
        if (this.objective || this.nav.dest) {
            const label = this.navManual ? `🧭 ${this.nav.dest.label}` : this.objectiveLabel;
            if (nv) {
                hud.setObjective(`${label} · ${fmtDist(nv.remaining, city.units)}`);
                hud.setNavLine(`<b>${stepArrow(nv.next)}</b>${stepText(nv.next, nv.distToNext, city.units)}`);
            } else if (this.objective) {
                const o = this.objective; const dx = (o.doorX ?? o.x) - player.x, dz = (o.doorZ ?? o.z) - player.z; const dist = Math.hypot(dx, dz);
                const bearing = Math.atan2(-dx, -dz); const rel = angleDiff(player.heading, bearing);
                const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
                const arrow = arrows[((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8];
                hud.setObjective(`${label} · ${fmtDist(dist, city.units)} ${arrow}`);
                hud.setNavLine('');
                if (this.frame % 180 === 0) this.autoRoute(true);
            }
        } else { hud.setObjective(this.objectiveLabel); hud.setNavLine(''); }
        // ---- "you are passing …" captions (e.g. Plaza Center, UiPath Bellevue 2022–2025, on the way to Lincoln Square) ----
        if (this.frame % 15 === 0) this.checkPassing(player);
        // ---- chapter waypoint (e.g. drive out of SeaTac to the I-5 junction) ----
        if (this.ch?.waypoint && !this.chapterDone && this.objective?.waypoint && (Math.hypot(this.objective.x - player.x, this.objective.z - player.z) < 30 || (this.navInfo && !this.navManual && this.navInfo.remaining < 25))) this.completeChapter();
        // ---- interactions (office > airport > refuel > tow) ----
        let prompt = null;
        for (const { stop, poi } of this.stopPois) {
            const d = Math.hypot((poi.doorX ?? poi.x) - player.x, (poi.doorZ ?? poi.z) - player.z);
            if (d < 11 && v < 5) {
                prompt = `<kbd>E</kbd> Enter <b>${stop.company}</b> ${this.visited.has(stop.id) ? '✓' : ''}`;
                if (input.take('KeyE')) this.enterOffice(stop);
            }
        }
        if (this.airport) {
            const p = this.airport; const d = Math.hypot((p.doorX ?? p.x) - player.x, (p.doorZ ?? p.z) - player.z);
            if (d > 140) this.leftAirport = true;
            if (this.ch) {
                // chapters: boarding completes the Otopeni chapter (card → flight → SeaTac)
                if (!prompt && d < 90 && v < 6 && this.ch.stop === 'otopeni' && !this.chapterDone) {
                    prompt = '<kbd>E</kbd> Board the flight to Seattle ✈️';
                    if (input.take('KeyE')) this.completeChapter();
                }
            } else if (!prompt && d < 90 && v < 6 && (this.leftAirport || city.id === 'bucharest')) {
                prompt = city.id === 'bucharest' ? (this.nextStop ? `<kbd>E</kbd> Board flight to Seattle <small>(${this.stops.filter(s => !this.visited.has(s.id)).length} stops still unvisited in Bucharest)</small>` : '<kbd>E</kbd> Board flight to Seattle ✈️') : '<kbd>E</kbd> Fly back to Bucharest ✈️';
                if (input.take('KeyE')) this.fly();
            }
        }
        if (!prompt) prompt = this.updateClosures(dt);
        if (!prompt) prompt = this.updateFuelStops(dt, v);
        if (!prompt && this.stuckT > 2) prompt = '<kbd>R</kbd> Stuck? Reset to the road <small>(nearest lane, facing the traffic flow)</small>';
        hud.prompt(prompt);
        const st = this.r3d.stats;
        const perf = st ? ` · ${st.quality}${st.fps ? ` · ${st.fps} fps` : ''}` : '';
        const lookTxt = input.lookMode === 'lock' ? (input.locked ? 'mouse look (Esc frees)' : 'click to look') : input.lookMode === 'hold' ? 'right-drag look' : '';
        hud.setHint(this.touch ? perf.trim() : `W/S drive · A/D steer · Space brake · H horn · C look back${lookTxt ? ' · ' + lookTxt : ''} · M map & nav · F fast travel · R reset · N mini-map · L lights · E enter/refuel${DEV ? ' · B colliders' : ''}` + perf);
        // ---- HUD fuel / trip ----
        const frac = this.fuel / TANK_L;
        const fuelText = us ? `${Math.round(frac * 100)}% · ${(this.fuel / GAL).toFixed(1)} gal` : `${Math.round(frac * 100)}% · ${this.fuel.toFixed(1)} L`;
        hud.setFuel(frac, fuelText);
        if (this.frame % 15 === 0) hud.setTrip(this.tripText());
        player.cockpit.userData.updateGauges?.(player.speed, clamp(0.12 + v / 45 + Math.max(0, input.throttle) * 0.15, 0, 1), frac, us);
        // ---- screens ----
        if (this.opts.minimap && this.frame % 2 === 0) {
            this.minimap.draw({ cx: player.x, cz: player.z, scale: 0.16, heading: player.heading, player, pois: world.pois, objective: this.objective });
            this.drawRouteOverlay(this.minimap.ctx, $('#minimap'), { cx: player.x, cz: player.z, scale: 0.16, heading: player.heading });
        }
        if (this.frame % 2 === 1) this.drawCarScreen(streetName, fuelText);
        player.mirrorEnabled = this.quality !== 'low' && !/low/.test(this.r3d.stats?.quality || '');
        this.drawFrame({ mirror: this.frame % 2 === 1 });
    }

    /** real local time of the current city (or the menu override) + day phase + NPC lights */
    updateClock(dt) {
        const c = this.clock; c.date = new Date();
        const h = c.override ? OVERRIDE_HOURS[c.override] : localHours(c.date, c.timeZone);
        c.hours = h;
        if (this.r3d && this.scene) {
            this.r3d.setClock({ date: c.date, override: c.override || null });
            const want = this.headlights === 'auto' ? (this._fogLights ? true : null) : !!this.headlights;
            if (this._hlSent !== want) { this._hlSent = want; this.r3d.setHeadlights(want); }
        }
        const ph = this.renderer3d?.phase;
        this.phase = typeof ph === 'string' ? (ph === 'sunset' ? 'dusk' : ph) : phaseFromHours(h);
        if (typeof ph !== 'string') {
            const night = this.phase === 'night' || this.phase === 'dusk' || this.phase === 'dawn';
            if (night !== this.nightLights) { this.nightLights = night; this.traffic?.setNightLights(night || !!this._fogLights); }
        }
        if (this.phase === 'night' && this.state === 'drive') {
            this._nightDist = (this._nightDist || 0) + Math.abs(this.player?.speed || 0) * dt;
            if (this._nightDist > 500 && this.hud.achievement('night-owl')) this.audio.chime();
        }
    }
    // ---------------------------------------------------------------------------------- weather
    get weather() { const w = this.r3d?.weather; return w && typeof w === 'object' ? w : null; }
    /** "🌧️ 7°C Rain" (°F in Seattle); '' when no weather data */
    weatherText(withLabel = true) {
        const w = this.weather; if (!w) return '';
        const k = weatherKind(w), icon = w.icon || WX_ICON[k] || '';
        const us = this.city?.units === 'mph';
        const t = Number.isFinite(w.tempC) ? (us ? `${Math.round(w.tempC * 9 / 5 + 32)}°F` : `${Math.round(w.tempC)}°C`) : '';
        return [icon, t, withLabel ? (w.label || WX_LABEL[k]) : ''].filter(Boolean).join(' ');
    }
    setWeatherOverride(v) {
        this.weatherOverride = WEATHER_OVERRIDES.includes(v) ? v : null;
        if (typeof this.r3d?.setWeather === 'function') { try { this.r3d.setWeather(this.weatherOverride); } catch (err) { console.warn('[weather] setWeather', err); } }
        this.pollWeather(true);
    }
    /** read the live weather: gameplay effects (grip, NPC speed, fog lights) + a ticker line when it changes */
    pollWeather() {
        const w = this.weather, k = weatherKind(w);
        this.wxKind = k; this.wxGrip = WX_GRIP[k] ?? 1; this.wxNpc = WX_NPC[k] ?? 1;
        if (this.traffic) this.traffic.weatherMul = this.wxNpc;
        // fog: player + NPC lights on (unless the player switched the headlights manually)
        const fog = k === 'fog';
        if (this.r3d && this.scene && this._fogLights !== fog) {
            this._fogLights = fog; // (updateClock forwards it to the headlights in 'auto' mode)
            this.traffic?.setNightLights(fog || this.nightLights);
        }
        if (!w) return;
        const key = `${k}|${w.label || ''}|${w.source || ''}`;
        if (this._wxKey === key) return;
        const first = this._wxKey === null || this._wxKey === undefined; this._wxKey = key;
        if (first && (k === 'clear' || k === 'cloudy')) return;
        const cityName = this.city?.id === 'bucharest' ? 'București' : 'Seattle';
        const tail = k === 'rain' || k === 'storm' ? ' — wipers on' : k === 'snow' ? ' — winter tyres, keep your distance' : k === 'fog' ? ' — fog lights on' : '';
        const temp = this.weatherText(false).replace(/^\S+\s*/, ''); // drop the icon
        this.hud.tickerNow(`${w.icon || WX_ICON[k]} ${w.label || WX_LABEL[k]} in ${cityName}${temp ? ', ' + temp : ''}${tail}`);
    }
    seasonToast() {
        if (this._seasonShown || this.state !== 'drive' || !this.city) return; this._seasonShown = true;
        const w = this.weather; let name, text;
        const mine = seasonText(new Date(), this.clock.timeZone);
        if (w && typeof w.season === 'string' && w.season && w.season.toLowerCase() !== mine.name) { text = w.season.replace(/[-_]/g, ' '); text = text[0].toUpperCase() + text.slice(1); name = (text.match(/winter|spring|summer|autumn|fall/i) || ['autumn'])[0].toLowerCase(); }
        else ({ name, text } = mine); // (same season: keep the early / late nuance)
        const where = this.city.id === 'bucharest' ? 'Bucharest' : 'Seattle';
        this.hud.toast(`${SEASON_ICON[name] || '🗓️'} ${text} in ${where}`, this.weatherText() || '');
    }
    /** local hour of the current city (or the menu override) */
    /** the hour the traffic follows: `?hour=8` / clock.trafficHour (tests, rush-hour demos), else the city clock */
    trafficHours() {
        if (this.clock.trafficHour == null) { const q = new URLSearchParams(location.search).get('hour'); this.clock.trafficHour = q != null && q !== '' && Number.isFinite(+q) ? +q : false; }
        return this.clock.trafficHour !== false ? this.clock.trafficHour : (this.clock.hours ?? this.cityHours());
    }
    cityHours() { const c = this.clock; return c.override ? OVERRIDE_HOURS[c.override] : localHours(new Date(), c.timeZone); }
    onTrafficBand(band, prev) {
        const t = BAND_TEXT[band]; if (!t) return;
        if (prev === null && band === 'normal') return; // nothing to say at load in normal traffic
        const msg = `${t[0]}${t[1] ? ' — ' + t[1] : ''}`;
        if (prev === null) { setTimeout(() => { if (this.state === 'drive') this.hud.tickerNow(msg); }, 3500); return; } // after the city's facts are queued
        this.hud.tickerNow(msg);
        if (prev !== null && band !== 'normal') this.hud.toast(t[0], t[1]);
    }
    get headlightsOn() { return this.headlights === 'auto' ? (this.r3d?.headlightsOn ?? this.nightLights) : !!this.headlights; }
    /** HH:MM in the city's time zone (or the override's nominal hour) */
    clockText() {
        const c = this.clock;
        if (c.override) { const h = OVERRIDE_HOURS[c.override]; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`; }
        try { return new Intl.DateTimeFormat('en-GB', { timeZone: c.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(c.date); }
        catch { return c.date.toTimeString().slice(0, 5); }
    }
    get phaseIcon() { return PHASE_ICON[this.phase] || '☀️'; }

    tripText() {
        const s = this.stats, us = this.city.units === 'mph';
        const l100 = s.dist > 200 ? s.fuelReal / (s.dist / 100000) : null;
        const cur = PRICES[this.city.id].cur;
        const dist = us ? `${(s.dist / 1609.34).toFixed(1)} mi` : `${(s.dist / 1000).toFixed(1)} km`;
        const eco = l100 == null ? '—' : us ? `${Math.round(235.21 / l100)} mpg` : `${l100.toFixed(1)} L/100km`;
        const fines = s.fines[cur] ? ` · Fines ${money(cur, s.fines[cur])}` : '';
        const wx = this.weatherText();
        return `${this.phaseIcon} ${this.clockText()}${wx ? ' · ' + wx : ''} · Trip ${dist} · Ø ${eco}${fines}`;
    }

    drawCarScreen(street, fuelText) {
        if (!this.carScreen) return;
        const us = this.city.units === 'mph', p = this.player;
        this.carScreen.draw({
            player: p, index: this.nav.index, route: this.nav.route, segIdx: this.nav.segIdx, nav: this.navInfo, dest: this.nav.dest,
            street, limit: this.limitInfo, over: this.over, fuel: this.fuel / TANK_L, fuelText, year: this.year, units: this.city.units,
            speedText: us ? `${Math.round(Math.abs(p.speed) * 2.237)} mph` : `${Math.round(Math.abs(p.speed) * 3.6)} km/h`,
            pois: this.stations, clock: this.clockText(), phaseIcon: this.phaseIcon, weather: this.weatherText(),
        });
        this.screenTex.needsUpdate = true;
    }

    /** draws the route + waypoint on a MiniMap canvas using the same transform it was drawn with */
    drawRouteOverlay(ctx, canvas, { cx, cz, scale, heading = null }) {
        this.drawOutside(ctx, canvas, { cx, cz, scale, heading });
        const r = this.nav?.route; if (!r) return;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (heading !== null) ctx.rotate(heading);
        ctx.scale(scale, scale); ctx.translate(-cx, -cz);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        const s0 = this.nav.segIdx || 0;
        ctx.moveTo(this.player.x, this.player.z);
        for (let i = s0 + 1; i < r.points.length; i++) ctx.lineTo(r.points[i][0], r.points[i][1]);
        ctx.strokeStyle = 'rgba(29,78,216,0.85)'; ctx.lineWidth = Math.max(4 / scale, 5); ctx.stroke();
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = Math.max(2 / scale, 2.5); ctx.stroke();
        const d = this.nav.dest;
        if (d) {
            ctx.translate(d.x, d.z); if (heading !== null) ctx.rotate(-heading); ctx.scale(1 / scale, 1 / scale);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -16, 9, Math.PI, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();
    }

    // ---------------------------------------------------------------------------------- fuel
    nearestStation(x, z) { let best = null, bd = Infinity; for (const s of this.stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best ? { st: best, d: bd } : null; }
    updateFuelStops(dt, v) {
        const { player, input, hud, city } = this;
        const P = PRICES[city.id];
        if (this.refuel) {
            const r = this.refuel; r.t += dt;
            const k = clamp(r.t / r.dur, 0, 1);
            this.fuel = r.from + (r.to - r.from) * k;
            if (k >= 1) {
                const liters = r.to - r.from; const cost = liters * r.st.price / (P.unit === 'gal' ? GAL : 1);
                this.stats.fuelL += liters; this.stats.fuelCost[P.cur] += cost;
                const qty = P.unit === 'gal' ? `${(liters / GAL).toFixed(1)} gal` : `${liters.toFixed(1)} L`;
                hud.toast(`⛽ ${r.st.brand} · full tank`, `${qty} · ${money(P.cur, cost)}`);
                if (hud.achievement('full-tank')) this.audio.chime();
                this.refuel = null; this.flags.emptyToast = false;
            }
            return `⛽ Refuelling at <b>${r.st.brand}</b>… ${Math.round(k * 100)}%`;
        }
        const ns = this.nearestStation(player.x, player.z);
        if (ns && ns.d < 12 && v < 2 && this.fuel < TANK_L - 0.5) {
            const price = P.unit === 'gal' ? `$${ns.st.price.toFixed(2)}/gal` : `${ns.st.price.toFixed(2)} RON/L`;
            if (input.take('KeyE')) {
                const liters = TANK_L - this.fuel;
                this.refuel = { t: 0, dur: clamp(2 + liters / 25, 2, 3), from: this.fuel, to: TANK_L, st: ns.st };
                this.audio.pump(this.refuel.dur);
            }
            return `<kbd>E</kbd> Refuel at <b>${ns.st.brand}</b> · ${price}`;
        }
        if (this.fuel <= 0 && v < 2.5) {
            if (input.take('KeyT') || input.take('KeyE')) this.towTruck();
            return `<kbd>T</kbd> Out of fuel — call a tow truck → nearest station`;
        }
        return null;
    }
    towTruck() {
        const ns = this.nearestStation(this.player.x, this.player.z); if (!ns) { this.fuel = 10; return; }
        const p = this.roadPose(ns.st.x, ns.st.z);
        // stop a few metres before the pumps so the refuel prompt is in reach
        this.player.place(p.x - Math.sin(p.heading) * -4, p.z - Math.cos(p.heading) * -4, p.heading, p.edge || null);
        this.fuel = 10;
        const cur = PRICES[this.city.id].cur; const fee = cur === 'RON' ? 350 : 195;
        this.stats.tow[cur] += fee;
        this.hud.addRage(30);
        this.hud.toast('🚛 Tow truck', `Dropped at ${ns.st.brand} with 10 L. Tow fee: ${money(cur, fee)}.`, 'warn');
        if (this.hud.achievement('ran-dry')) this.audio.chime();
        this.flags.emptyToast = false;
        this.nav.reroute(this.player);
    }

    // ---------------------------------------------------------------------------------- enforcement
    giveFine(title, body, overKmh, kind) {
        const cur = PRICES[this.city.id].cur;
        const amount = kind === 'pedestrian' ? (cur === 'RON' ? 2900 : 1000) : kind === 'red' ? (cur === 'RON' ? 1160 : 139) : fineFor(this.city.id, overKmh);
        this.stats.fines[cur] += amount; this.stats.fineCount++; this.stats.cleanDist = 0;
        this.hud.toast(title, `${body} ${cur === 'RON' ? `Amendă ${money(cur, amount)}` : `${money(cur, amount)} ticket`}`, 'warn');
        return amount;
    }
    updateEnforcement(dt, over, overKmh) {
        const p = this.player;
        for (const c of this.cameras || []) {
            c.cd = Math.max(0, c.cd - dt);
            const d = Math.hypot(c.x - p.x, c.z - p.z);
            if (c.lastD >= 16 && d < 16 && over && c.cd <= 0) {
                c.cd = 15; this.hud.flash(); this.audio.shutter();
                this.giveFine('📸 Speed camera', `${Math.round(Math.abs(p.speed) * (this.city.units === 'mph' ? 2.237 : 3.6))} ${this.city.units === 'mph' ? 'mph' : 'km/h'} in a ${this.limitInfo?.value} zone.`, overKmh, 'speed');
                this.hud.achievement('camera');
            }
            c.lastD = d;
        }
        this.policeCd = Math.max(0, (this.policeCd || 0) - dt);
        if (over && overKmh > 15 && this.policeCd <= 0) {
            const cop = this.traffic.policeNear(p.x, p.z, 45);
            if (cop && Math.random() < dt * 0.6) {
                this.policeCd = 30; this.audio.siren(1.4);
                this.giveFine(this.city.id === 'bucharest' ? '🚓 Poliția Rutieră' : '🚓 Pulled over (WSP)', this.city.id === 'bucharest' ? 'Actele la control, vă rog.' : 'License and registration, please.', overKmh, 'speed');
                this.hud.addRage(10);
                this.hud.achievement('police');
            }
        }
    }

    checkRoadEvents(ne, dt) {
        const { player, hud, traffic } = this;
        if (!ne || ne.d > (ne.edge.halfW ?? 6) + 1) { this.prevEdgeInfo = null; return; }
        const e = ne.edge;
        const towardB = (player.fx * e.dirx + player.fz * e.dirz) > 0;
        const endNode = towardB ? e.b : e.a;
        const distEnd = towardB ? e.len * (1 - ne.t) : e.len * ne.t;
        const key = e.id + ':' + endNode.id;
        const line = (endNode.radius ?? 6) + 1.6;
        if (this.prevEdgeInfo && this.prevEdgeInfo.key === key && this.prevEdgeInfo.distEnd > line && distEnd <= line && Math.abs(player.speed) > 2.5 && endNode.hasLight) {
            const st = traffic.lightState(endNode, e);
            if (st === 'red') {
                hud.toast('🚦 Red light!', this.city.id === 'bucharest' ? 'Very local of you.' : 'That\'s a ticket in Washington.', 'warn'); hud.achievement('red-light'); hud.addRage(8); traffic.playerHonk(player.x, player.z, player.fx, player.fz);
                if (traffic.policeNear(player.x, player.z, 70) || this.city.id === 'seattle') this.giveFine(this.city.id === 'bucharest' ? '🚓 Poliția Rutieră' : '📸 Red-light camera', 'Ran a red light.', 0, 'red');
            }
        }
        this.prevEdgeInfo = { key, distEnd };
        // special places
        const name = e.name || '';
        if ((endNode.id === 'victoriei' || /Victoriei/.test(name) && endNode.edges.length >= 4) && distEnd < 25) hud.achievement('victoriei');
        if (e.toll && !this.flags['toll:' + (e.name || e.id)]) { this.flags['toll:' + (e.name || e.id)] = true; hud.toast('💳 Good To Go!', 'SR-520 toll charged: $4.50', 'warn'); hud.achievement('toll'); this.stats.tolls = (this.stats.tolls || 0) + 4.5; }
        if (e.bridge && /Murrow|I-90|I 90/.test(name + (e.ref || '')) && /Lake|Murrow|Floating/.test(name) && !this.flags.bridge) { this.flags.bridge = true; hud.achievement('bridge'); hud.toast('🌉 Lake Washington', 'Floating on I-90. Mount Rainier to your right on a clear day.'); }
        if (name.includes('Kiseleff') && !this.flags.kiseleff) { this.flags.kiseleff = true; hud.toast('🌳 Șoseaua Kiseleff', 'Bucharest\'s grand tree-lined boulevard. Arcul de Triumf ahead.'); }
        if ((e.type === 'dn' || /DN1\b|București-Ploiești/.test(name + (e.ref || ''))) && !this.flags.dn1) { this.flags.dn1 = true; hud.toast('🛣️ DN1', 'The only road to the airport. Everyone in Bucharest is on it right now.'); }
    }

    playerHonk() {
        const p = this.player;
        this.audio.horn(0, 0, 1.0, 0.45);
        this.honks++;
        const reacted = this.traffic.playerHonk(p.x, p.z, p.fx, p.fz);
        const rage = this.hud.addRage(this.city.id === 'bucharest' ? 6 + reacted * 2 : 3);
        if (this.honks === 1) this.hud.achievement('first-honk');
        if (this.honks === 10) this.hud.achievement('honk-10');
        if (rage >= 100 && this.hud.achievement('rage-max')) this.audio.chime();
    }
    vehicleHonk(v) {
        const p = this.player; const dx = v.x - p.x, dz = v.z - p.z; const d = Math.hypot(dx, dz);
        if (d > 120) return;
        { const now = performance.now(); if (now - (this._honkAt || 0) < 160) return; this._honkAt = now; } // (a jam's honk storm: ≤ 6 horns a second)
        const pan = clamp((dx * -p.fz + dz * p.fx) / (d || 1), -1, 1) * -1;
        this.audio.horn(pan, d, 0.8 + ((v.x * 13) % 7) / 10, 0.3 + Math.random() * 0.4);
        if (d < 40) this.hud.addRage(2);
    }
    onCollide(strength, what, v) {
        if (what === 'pedestrian') {
            this.audio.crash(0.35);
            this.stats.peds++;
            this.hud.addRage(35);
            this.giveFine('🚶 Pieton!', this.city.id === 'bucharest' ? 'Pedestrians have priority. They got up and are shouting at you.' : 'They\'re okay, thankfully. The officer is less okay.', 0, 'pedestrian');
            this.hud.achievement('pedestrian');
            this.traffic.playerHonk(this.player.x, this.player.z, this.player.fx, this.player.fz);
            return;
        }
        this.audio.crash(clamp(strength / 10, 0.2, 1));
        if (what === 'vehicle' && v) { this.traffic.bump(v); this.hud.addRage(12); }
        else if (what === 'edge') { /* deck edge / trench wall: the crash sound is enough */ }
        else if (strength > 8) this.hud.toast('💥 Ouch', 'Buildings in Bucharest do not move. Neither do double-parked cars.', 'warn');
    }

    // ---------------------------------------------------------------------------------- dev: collision overlay
    /** B (dev): draw every collision shape near the player (buildings, props, walls, vehicles, drivable surface) */
    setDebugOverlay(on) {
        this.debug.overlay = !!on;
        if (!this.debugLines) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 20000), 3));
            g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6 * 20000), 3));
            const m = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false });
            this.debugLines = new THREE.LineSegments(g, m); this.debugLines.frustumCulled = false; this.debugLines.renderOrder = 999;
        }
        if (this.debugLines.parent !== this.scene) this.scene?.add(this.debugLines);
        this.debugLines.visible = this.debug.overlay;
        if (on) this.updateDebugOverlay();
        else { const cv = document.getElementById('dbg-plan'); if (cv) cv.style.display = 'none'; }
        this.hud.toast(on ? '🧱 Collision overlay on' : '🧱 Collision overlay off', on ? 'red buildings · orange props · magenta walls · cyan vehicles · yellow you · green drivable surface' : '');
    }
    updateDebugOverlay(R = 45) {
        const P = this.player, w = this.world, L = this.debugLines; if (!L || !P || !w) return;
        if (L.parent !== this.scene) this.scene.add(L);
        // 1) collect shapes: { c: [r,g,b], pts: [[x,z],…], closed, y0, y1 }
        const shapes = [];
        const RED = [1, 0.15, 0.15], ORANGE = [1, 0.6, 0.1], MAG = [1, 0.2, 1], CYAN = [0.2, 0.9, 1], YEL = [1, 1, 0.2], GREEN = [0.3, 1, 0.4], GREY = [0.55, 0.55, 0.6], WHITE = [1, 1, 1];
        const hitRef = P.debug.lastCollider?.ref;
        const circle = (x, z, r, k = 14) => Array.from({ length: k }, (_, i) => [x + Math.cos(i / k * Math.PI * 2) * r, z + Math.sin(i / k * Math.PI * 2) * r]);
        const obb = (x, z, fx, fz, hl, hw) => { const rx = -fz, rz = fx; return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, b]) => [x + fx * a + rx * b, z + fz * a + rz * b]); };
        const sy = P.surfY ?? 0.24;
        if (w.buildings) {
            const each = (b) => {
                if (Math.hypot(b.x - P.x, b.z - P.z) > R + (b.r || 0)) return;
                if (b.wall) { shapes.push({ c: b === hitRef ? WHITE : MAG, pts: [[b.ax, b.az], [b.bx, b.bz]], closed: false, y0: Math.max(b.y0a ?? 0, sy - 0.2), y1: Math.min(b.y1a ?? 1, sy + 1.5), kind: 'wall' }); return; }
                const lvl = P.atLevel(b), c = b === hitRef ? WHITE : !lvl ? GREY : b.prop ? ORANGE : RED;
                const y0 = (b.y ?? 0) + 0.3, y1 = y0 + Math.min(b.h ?? 3, 3);
                if (b.prop && b.hw === b.r) shapes.push({ c, pts: circle(b.x, b.z, b.r, 10), closed: true, y0, y1, kind: 'prop' });
                else if (b.poly) shapes.push({ c, pts: b.poly, closed: true, y0, y1, kind: 'building' });
                else { const a = b.angle || 0; shapes.push({ c, pts: obb(b.x, b.z, Math.sin(a), Math.cos(a), b.hd, b.hw), closed: true, y0, y1, kind: 'box' }); }
            };
            if (w.buildings.query) w.buildings.query(P.x, P.z, R, each); else for (const b of w.buildings) each(b);
        }
        const walls = P.wallsInBuildings?.() ? null : P.wallList?.();
        if (walls) for (const s of walls) if (Math.hypot(s.x - P.x, s.z - P.z) <= R + s.r) shapes.push({ c: P.atLevel(s) ? MAG : GREY, pts: [[s.ax, s.az], [s.bx, s.bz]], closed: false, y0: Math.max(s.y, sy - 0.2), y1: Math.min(s.top, sy + 1.5), kind: 'wall' });
        for (const v of this.traffic.near(P.x, P.z, R)) shapes.push({ c: CYAN, pts: obb(v.x, v.z, v.fx, v.fz, v.length / 2, v.width / 2), closed: true, y0: (v.y ?? 0.24), y1: (v.y ?? 0.24) + 1.3, kind: 'vehicle' });
        if (w.edgesInBox) w.edgesInBox(P.x - R, P.z - R, P.x + R, P.z + R, (e) => {
            if (e.ya === undefined) return;
            const hw = e.halfW ?? 6, ym = 0.24 + (e.ya + e.yb) / 2;
            if (Math.abs(ym - sy) > 3) return;
            for (const sd of [1, -1]) shapes.push({ c: GREEN, pts: [[e.a.x + e.nx * hw * sd, e.a.z + e.nz * hw * sd], [e.b.x + e.nx * hw * sd, e.b.z + e.nz * hw * sd]], closed: false, y0: ym + 0.05, y1: ym + 0.05, kind: 'ribbon' });
        });
        shapes.push({ c: YEL, pts: obb(P.x, P.z, P.fx, P.fz, P.length / 2, P.width / 2), closed: true, y0: sy, y1: sy + 1.2, kind: 'player' });
        for (const o of [1.3, 0, -1.3]) shapes.push({ c: YEL, pts: circle(P.x + P.fx * o, P.z + P.fz * o, 1.0, 12), closed: true, y0: sy + 0.1, y1: sy + 0.1, kind: 'player' });
        this.debug.shapes = shapes.length;
        // 2) 3D lines (through everything)
        const pos = L.geometry.attributes.position, col = L.geometry.attributes.color, max = pos.count;
        let n = 0;
        const seg = (x1, y1, z1, x2, y2, z2, c) => { if (n + 2 > max) return; pos.setXYZ(n, x1, y1, z1); col.setXYZ(n++, c[0], c[1], c[2]); pos.setXYZ(n, x2, y2, z2); col.setXYZ(n++, c[0], c[1], c[2]); };
        for (const sh of shapes) {
            const p = sh.pts, m = sh.closed ? p.length : p.length - 1;
            for (let i = 0; i < m; i++) {
                const a = p[i], b = p[(i + 1) % p.length];
                seg(a[0], sh.y0, a[1], b[0], sh.y0, b[1], sh.c);
                if (sh.y1 > sh.y0 + 0.01) { seg(a[0], sh.y1, a[1], b[0], sh.y1, b[1], sh.c); if (i % 3 === 0) seg(a[0], sh.y0, a[1], a[0], sh.y1, a[1], sh.c); }
            }
        }
        L.geometry.setDrawRange(0, n);
        pos.needsUpdate = true; col.needsUpdate = true;
        // 3) plan view (top-down, heading up) in a corner canvas — legible in screenshots
        let cv = document.getElementById('dbg-plan');
        if (!cv) { cv = document.createElement('canvas'); cv.id = 'dbg-plan'; cv.width = cv.height = 260; document.body.appendChild(cv); }
        cv.style.display = this.debug.overlay ? 'block' : 'none';
        const ctx = cv.getContext('2d'), S = 260 / (2 * R) * 1.4, Hh = P.heading;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 260, 260); ctx.fillStyle = 'rgba(8,10,16,0.82)'; ctx.fillRect(0, 0, 260, 260);
        ctx.translate(130, 150); ctx.scale(S, S); ctx.rotate(Hh); ctx.translate(-P.x, -P.z);
        ctx.lineWidth = 1.6 / S;
        const order = { ribbon: 0, building: 1, box: 1, prop: 2, wall: 3, vehicle: 4, player: 5 };
        for (const sh of shapes.slice().sort((a, b) => order[a.kind] - order[b.kind])) {
            ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); if (sh.closed) ctx.closePath();
            const css = `rgb(${sh.c.map(v => Math.round(v * 255)).join(',')})`;
            ctx.strokeStyle = css; ctx.lineWidth = (sh.kind === 'wall' ? 3 : 1.6) / S; ctx.stroke();
            if (sh.closed && sh.kind !== 'player') { ctx.globalAlpha = 0.18; ctx.fillStyle = css; ctx.fill(); ctx.globalAlpha = 1; }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#e5e7eb'; ctx.font = '11px monospace';
        const lc = P.debug.lastCollider;
        ctx.fillText(`y ${sy.toFixed(2)}  hits ${P.debug.count}`, 6, 14);
        if (lc) ctx.fillText(`last: ${lc.type} ${lc.id ?? ''}`.slice(0, 40), 6, 28);
    }

    // ---------------------------------------------------------------------------------- big map + nav panel
    toggleMap(open) {
        this.mapOpen = open;
        $('#bigmap-wrap').classList.toggle('show', open);
        if (open) {
            const c = $('#bigmap');
            const narrow = window.innerWidth < 900;
            const cssW = narrow ? window.innerWidth - 24 : Math.min(window.innerWidth - 320, 1100);
            const cssH = narrow ? Math.min(window.innerHeight * 0.55, 600) : Math.min(window.innerHeight - 80, 760);
            c.width = cssW * devicePixelRatio; c.height = cssH * devicePixelRatio;
            c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
            if (!this.mapView || this.mapView.city !== this.city.id) {
                const b = this.world.bounds; const pad = 60;
                const fit = Math.min(c.width / (b.maxX - b.minX - pad * 2), c.height / (b.maxZ - b.minZ - pad * 2)) * 0.98;
                // start zoomed around the player for big (OSM) cities
                const scale = Math.max(fit, Math.min(0.35 * devicePixelRatio, c.width / 9000));
                this.mapView = { city: this.city.id, cx: scale > fit * 1.01 ? this.player.x : (b.minX + b.maxX) / 2, cz: scale > fit * 1.01 ? this.player.z : (b.minZ + b.maxZ) / 2, scale, fit };
            }
            this.redrawMap();
            this.buildNavList();
            if (!this._wheelBound) {
                this._wheelBound = true;
                c.addEventListener('wheel', (e) => { e.preventDefault(); const mv = this.mapView; mv.scale = clamp(mv.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), mv.fit * 0.8, 3 * devicePixelRatio); this.redrawMap(); }, { passive: false });
            }
        }
    }
    redrawMap() {
        const c = $('#bigmap'); const mv = this.mapView;
        this.bigmap.draw({ cx: mv.cx, cz: mv.cz, scale: mv.scale, heading: null, player: this.player, pois: this.world.pois, objective: this.objective, full: true, vehicles: this.traffic.vehicles });
        const ctx = this.bigmap.ctx;
        this.drawRouteOverlay(ctx, c, { cx: mv.cx, cz: mv.cz, scale: mv.scale });
        // stations (fallback ones are not world POIs)
        ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.scale(mv.scale, mv.scale); ctx.translate(-mv.cx, -mv.cz);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const s of this.stations) if (s.fallback) { ctx.save(); ctx.translate(s.x, s.z); ctx.scale(1 / mv.scale, 1 / mv.scale); ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fillStyle = '#0f766e'; ctx.fill(); ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('⛽', 0, 1); ctx.restore(); }
        ctx.restore();
    }
    onMapClick(e) {
        const c = $('#bigmap'); const r = c.getBoundingClientRect(); const mv = this.mapView; if (!mv) return;
        const px = (e.clientX - r.left) * (c.width / r.width), py = (e.clientY - r.top) * (c.height / r.height);
        const x = (px - c.width / 2) / mv.scale + mv.cx, z = (py - c.height / 2) / mv.scale + mv.cz;
        if (e.shiftKey) { mv.cx = x; mv.cz = z; this.redrawMap(); return; }
        const ne = this.nav.index.nearest(x, z, 400);
        this.setNavDest({ x, z, label: ne ? `Waypoint · ${roadName(ne.edge)}` : 'Waypoint' }, true);
        if (this.nav.route && this.hud.achievement('navigator')) this.audio.chime();
        this.audio.blip(880, 0.06, 0.08);
        this.redrawMap(); this.buildNavList();
    }
    buildNavList() {
        const p = this.player; const items = this.navItems = [];
        const dist = (x, z) => fmtDist(Math.hypot(x - p.x, z - p.z), this.city.units);
        const add = (group, icon, label, x, z) => { if (x === undefined || z === undefined) return; items.push({ group, icon, label, x, z }); };
        const n = this.nextStop;
        if (n && n.poiRef) add('Story', n.icon, `Next: ${n.short}`, n.poiRef.doorX ?? n.poiRef.x, n.poiRef.doorZ ?? n.poiRef.z);
        for (const s of this.stops) if (s.poiRef && s !== n) add('Offices', s.icon, `${s.short}${this.visited.has(s.id) ? ' ✓' : ''}`, s.poiRef.doorX ?? s.poiRef.x, s.poiRef.doorZ ?? s.poiRef.z);
        if (this.airport) add('Travel', '✈️', AIRPORTS[this.city.id].name, this.airport.doorX ?? this.airport.x, this.airport.doorZ ?? this.airport.z);
        const st = [...this.stations].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 6);
        for (const s of st) add('Gas stations', '⛽', `${s.brand} · ${this.city.units === 'mph' ? '$' + s.price.toFixed(2) + '/gal' : s.price.toFixed(2) + ' RON/L'}`, s.x, s.z);
        const lms = (this.bigmap.landmarks || []).slice(0, 12);
        for (const l of lms) add('Landmarks', '📍', l.label || l.name || l.id, l.x, l.z);
        let html = '', g = '';
        if (this.ch) {
            const next = this.chapters[this.chapterIdx + 1];
            if (this.chapterDone && next) html += `<div class="nav-item active"><span>▶️ Next chapter: ${next.year} · ${next.title}</span><button data-chapter="${this.chapterIdx + 1}">Go</button></div>`;
            html += chapterSelectHtml(this.chapters, this.progress, this.chapterIdx).replace('<h4>Chapters</h4>', '<h4>Chapters <small>(replay)</small></h4>');
        }
        if (this.navManual) html += `<div class="nav-item active"><span>🧭 ${this.nav.dest?.label || 'Custom'}</span><button data-nav="-1">Clear</button></div>`;
        items.forEach((it, i) => {
            if (it.group !== g) { g = it.group; html += `<h4>${g}</h4>`; }
            html += `<div class="nav-item"><span>${it.icon} ${it.label} <small>${dist(it.x, it.z)}</small></span><button data-nav="${i}" title="Route there">Go</button><button class="ft" data-ft="${i}" title="Fast travel (skip the drive)">⏩</button></div>`;
        });
        $('#navlist').innerHTML = html;
    }


    /** one caption toast per place passed: stops' `passing` list (data.js) + world POIs flagged `passing` */
    checkPassing(P) {
        if (!this._passList || this._passWorld !== this.world) {
            this._passWorld = this.world; const list = this._passList = [];
            for (const st of this.stops || []) for (const ps of st.passing || []) {
                const poi = this.world.pois.find(p => p.id === ps.poi);
                const q = poi ? { x: poi.doorX ?? poi.x, z: poi.doorZ ?? poi.z } : (ps.lat != null ? this.city.proj(ps.lat, ps.lon) : null);
                if (q) list.push({ key: ps.poi || ps.title, x: q.x, z: q.z, title: ps.title, caption: ps.caption, r: ps.r || 90 });
            }
            for (const p of this.world.pois || []) if (p.passing && p.caption && !list.some(l => l.key === p.id)) list.push({ key: p.id, x: p.doorX ?? p.x, z: p.doorZ ?? p.z, title: `🏢 ${p.label || p.id}`, caption: p.caption, r: 90 });
        }
        const seen = this.flags.passed || (this.flags.passed = new Set());
        for (const l of this._passList) if (!seen.has(l.key) && Math.hypot(l.x - P.x, l.z - P.z) < l.r) { seen.add(l.key); this.hud.toast(l.title, l.caption, 'intro'); }
    }


    // ---------------------------------------------------------------------------------- district edges (R10.9)
    /** closures where roads leave the district (world.closures) + a roadworks crew at the Bucharest ones */
    setupClosures(city, world) {
        this.closures = (world.closures || []).map(c => ({ ...c, toastT: -1e9 }));
        this.closureStopT = 0; this._outside = null;
        if (this.player) this.player.softZones = this.closures;
        this.workers = [];
        if (city.id !== 'bucharest' || !this.closures.length) return;
        const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
        const vest = lam('#f97316'), stripe = new THREE.MeshBasicMaterial({ color: '#f1f5f9' }), skin = lam('#e0ac85'), helmet = lam('#facc15'), pants = lam('#1f2937');
        const gBody = new THREE.CapsuleGeometry(0.24, 0.55, 3, 8), gLeg = new THREE.CapsuleGeometry(0.1, 0.62, 2, 6), gHead = new THREE.SphereGeometry(0.13, 10, 8);
        const gHelm = new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), gStripe = new THREE.CylinderGeometry(0.255, 0.255, 0.06, 12, 1, true);
        for (const c of this.closures) {
            const e = c.edge; if (!e) continue;
            const ix = Math.sin(c.heading), iz = Math.cos(c.heading), px = -iz, pz = ix; // into the map / across the road
            const side = Math.max(e.wR ?? 3, e.wL ?? 3) + 1.6;
            const g = new THREE.Group();
            const body = new THREE.Mesh(gBody, vest); body.position.y = 1.15; g.add(body);
            for (const y of [1.0, 1.3]) { const st = new THREE.Mesh(gStripe, stripe); st.position.y = y; g.add(st); }
            for (const lx of [-0.11, 0.11]) { const l = new THREE.Mesh(gLeg, pants); l.position.set(lx, 0.42, 0); g.add(l); }
            const head = new THREE.Mesh(gHead, skin); head.position.y = 1.72; g.add(head);
            const hm = new THREE.Mesh(gHelm, helmet); hm.position.y = 1.76; g.add(hm);
            const x = c.x + ix * 3 + px * side, z = c.z + iz * 3 + pz * side, y = (c.node?.y ?? 0) + 0.2;
            g.position.set(x, y, z); g.rotation.y = Math.atan2(ix, iz) + Math.PI; // facing the traffic coming from inside
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            this.scene.add(g);
            this.workers.push({ x, z, mesh: g, nextT: 0 });
        }
    }
    closureText(c) {
        const name = c.leadsTo ? (this.city.districts?.[c.leadsTo]?.name || c.leadsTo) : null;
        const idx = c.leadsTo && this.chapters ? this.chapters.findIndex(ch => ch.city === this.city.id && ch.district === c.leadsTo) : -1;
        if (idx < 0) return ['🚧 Road closed', 'Outside the story. Turn around (U).'];
        const ch = this.chapters[idx];
        if (this.progress.reached.has(ch.id) && ch.district !== this.district) return [`🚧 ${name}`, 'Open it from the chapter map (M → Chapters).'];
        if (ch.district === this.district) return ['🚧 Road closed', 'Outside the story. Turn around (U).'];
        return ['🚧 Road closed', `${name} opens in Chapter ${idx + 1} (${ch.year}).`];
    }
    /** approach toast, soft stop → "Turn around" prompt (U / tap), roadworks chatter; returns a prompt or null */
    updateClosures(dt) {
        if (!this.closures?.length) return null;
        const P = this.player, now = performance.now(); let prompt = null;
        for (const c of this.closures) {
            const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
            if (d < 40 && d > 0.5 && (dx * P.fx + dz * P.fz) / d > 0.6 && now - c.toastT > 30000 && now - (this._closureToastT || 0) > 8000) { c.toastT = now; this._closureToastT = now; const [t, b] = this.closureText(c); this.hud.toast(t, b, 'warn'); }
        }
        if (P.closureHit && now - (P.closureAt || 0) < 500) this.closureStopT += dt; else this.closureStopT = Math.max(0, this.closureStopT - dt * 0.5);
        if (this.closureStopT > 2 && Math.abs(P.speed) < 2) {
            prompt = '<kbd>U</kbd> Turn around <button class="btn small" data-act="uturn" style="pointer-events:auto">↩︎ Turn around</button>';
            if (this.input.take('KeyU')) { this.uTurn(); prompt = null; }
        }
        for (const w of this.workers || []) {
            if (now < w.nextT) continue;
            const d = Math.hypot(w.x - P.x, w.z - P.z);
            if (d < 35) { const L = ROADWORKS[this.city.id] || ROADWORKS.bucharest; const l = L[Math.floor(Math.random() * L.length)]; this.hud.say(w, l.text, l.en); w.nextT = now + 9000 + Math.random() * 7000; }
        }
        return prompt;
    }
    /** auto U-turn at a closure: the right-most lane of the same road, the other way */
    uTurn() {
        const P = this.player;
        const pose = this.lanePose(P.x - P.fx * 3, P.z - P.fz * 3, P.heading + Math.PI, P.surfY ?? null);
        if (!pose) return false;
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.speed = 0; P.steer = 0; P.contactAge = 9; P.closureHit = null;
        this.closureStopT = 0; this.traffic.clearAround(pose.x, pose.z, 10); this.nav.reroute(P);
        this.audio.blip(640, 0.06, 0.07);
        return true;
    }
    /** hatched area outside the district (minimap / big map), from world.district.inside() sampled once per world */
    drawOutside(ctx, canvas, { cx, cz, scale, heading = null }) {
        const W = this.world, inside = W?.district?.inside, b = W?.bounds; if (!inside || !b) return;
        if (!this._outside || this._outside.world !== W) {
            const cell = 10, pad = 300, x0 = b.minX - pad, z0 = b.minZ - pad, w = Math.ceil((b.maxX - b.minX + 2 * pad) / cell), h = Math.ceil((b.maxZ - b.minZ + 2 * pad) / cell);
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
            const img = g.createImageData(w, h);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
                if (inside(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) continue;
                const k = (j * w + i) * 4, hatch = ((i + j) % 6) < 2;
                img.data[k] = hatch ? 148 : 15; img.data[k + 1] = hatch ? 163 : 23; img.data[k + 2] = hatch ? 184 : 42; img.data[k + 3] = hatch ? 150 : 110;
            }
            g.putImageData(img, 0, 0);
            this._outside = { world: W, cv, x0, z0, w: w * cell, h: h * cell };
        }
        const o = this._outside;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (heading !== null) ctx.rotate(heading);
        ctx.scale(scale, scale); ctx.translate(-cx, -cz);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(o.cv, o.x0, o.z0, o.w, o.h);
        ctx.restore();
    }

    // ---------------------------------------------------------------------------------- chapters (spec 10)
    renderMenuChapters() {
        if (!this.chapters) return;
        let box = $('#chapter-select');
        if (!box) { const card = $('#menu .menu-card'); if (!card) return; box = document.createElement('div'); box.id = 'chapter-select'; ($('#start')?.parentElement || card).insertAdjacentElement('afterend', box); }
        box.innerHTML = chapterSelectHtml(this.chapters, this.progress);
        box.onclick = (e) => { const b = e.target.closest('[data-chapter]'); if (b) this.start(+b.dataset.chapter); };
    }
    /** the car pose at a chapter's start: right-most lane of the named road, facing the compass heading */
    chapterPose(ch) {
        const st = ch.start; if (!st) return null;
        const q = this.city.proj(st.lat, st.lon), heading = -((st.heading ?? st.bearing ?? 0) * Math.PI / 180);
        const named = st.road ? (e) => st.road.test(e.name || '') || st.road.test(e.ref || '') : null;
        return (named && this.lanePose(q.x, q.z, heading, null, named)) || this.lanePose(q.x, q.z, heading);
    }
    /** load (or reuse) the chapter's district, put the car at its start, set the objective */
    async enterChapter(idx, { initial = false } = {}) {
        const ch = this.chapters[idx]; if (!ch) return false;
        const same = this.world && this.city?.id === ch.city && this.district === ch.district && !initial;
        if (!same) {
            $('#loading').classList.add('show');
            await new Promise(r => setTimeout(r, 30));
            await this.loadCity(ch.city, { district: ch.district, start: ch.start });
            $('#loading').classList.remove('show');
        }
        // world.spawn is the chapter start when the world built this district for it; otherwise place it here
        const builtFor = !same && this.world.district?.id === ch.district;
        if (!builtFor) { const p = this.chapterPose(ch); if (p) this.player.place(p.x, p.z, p.heading, p.edge); }
        this.player.speed = 0; this.player.steer = 0; this.player.contactAge = 9; this.player.resetLook?.();
        this.traffic.setPlayer(this.player); this.traffic.clearAround(this.player.x, this.player.z, 14);
        this.stuckT = 0; this.prevEdgeInfo = null; this.navManual = false;
        this.chapterIdx = idx; this.ch = ch; this.chapter = ch.id; this.chapterDone = false;
        this.progress.reached.add(ch.id); saveProgress(this.progress); this.renderMenuChapters();
        this.fuel = Math.max(this.fuel, TANK_L * 0.6); this.flags.emptyToast = false;
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.state = 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.updateObjective();
        const km = this.nav.route ? ` · ${fmtDist(this.nav.route.total, this.city.units)} drive` : '';
        this.hud.toast(`📖 ${ch.year} · ${ch.title}`, `${ch.intro || ''}${km}`, 'intro');
        return true;
    }
    updateChapterObjective() {
        const ch = this.ch, N = this.chapters.length, hud = this.hud;
        hud.setProgress(this.chapters.filter(c => this.progress.done.has(c.id)).length, N, 'Chapters');
        hud.setYear(ch.year); this.year = ch.year;
        hud.setChapter(`Chapter ${this.chapterIdx + 1}/${N} · ${ch.title}`);
        const stop = this.stops.find(s => s.id === ch.stop);
        if (this.chapterDone) {
            this.objective = null; this.objectivePlain = '';
            const next = this.chapters[this.chapterIdx + 1];
            this.objectiveLabel = next ? `🚗 Free drive · M → next chapter (${next.year} · ${next.title})` : '🏁 Story complete — free drive';
        } else if (ch.waypoint) {
            // the waypoint on the road (lat/lon may sit in the junction's grass): reached = within 30 m of that point
            const q = this.city.proj(ch.waypoint.lat, ch.waypoint.lon), ne = this.nav.index.nearest(q.x, q.z, 300, (e) => e.main !== false);
            this.objective = { x: ne ? ne.cx : q.x, z: ne ? ne.cz : q.z, waypoint: true, label: ch.waypoint.label };
            this.objectiveLabel = `📍 ${ch.waypoint.label} <small>(${ch.year})</small>`; this.objectivePlain = ch.waypoint.label;
        } else if (stop?.poiRef) {
            this.objective = stop.poiRef; this.objectiveLabel = `${stop.icon} ${stop.short} <small>(${ch.year})</small>`; this.objectivePlain = stop.short;
        } else if (ch.stop === 'otopeni' || (this.airport && ch.stop === AIRPORTS[this.city.id]?.poi)) {
            this.objective = this.airport; this.objectiveLabel = `✈️ ${AIRPORTS[this.city.id]?.name || 'Airport'} — departures <small>(${ch.year})</small>`; this.objectivePlain = AIRPORTS[this.city.id]?.name || 'Airport';
        } else { this.objective = null; this.objectiveLabel = `${ch.title}`; this.objectivePlain = ''; }
        this.autoRoute(true);
    }
    /** the chapter's goal reached: card → Continue (montage / flight → next chapter) or free drive here */
    async completeChapter(expect = null) {
        if (this._completing || !this.ch || this.chapterDone || (expect && expect !== this.chapter)) return; this._completing = true;
        const idx = this.chapterIdx, ch = this.ch, next = this.chapters[idx + 1] || null;
        this.chapterDone = true; this.progress.done.add(ch.id); if (next) this.progress.reached.add(next.id);
        saveProgress(this.progress); this.renderMenuChapters();
        this.audio.chime(); this.updateObjective(); this.hud.setObjective(this.objectiveLabel); this.hud.setNavLine('');
        if (!next) { this._completing = false; setTimeout(() => this.finale(), 900); return; }
        this.player.speed = 0; this.input.releaseLock(); this.input.lookAllowed = false; this.hud.prompt(null);
        this.photo?.close?.(); this.state = 'card';
        const nd = CITIES[next.city]?.districts?.[next.district];
        const act = await chapterCard({ done: ch, next, index: idx, total: this.chapters.length, nextDistrictName: nd?.name });
        this._completing = false;
        if (act === 'next') { await this.goToChapter(idx + 1); return; }
        this.state = 'drive'; this.input.flush(); this.frameClock.getDelta();
        this.hud.toast('🚗 Free drive', `Explore ${this.world.district?.name || 'the district'}. Continue the story any time: M → Next chapter.`, 'intro');
    }
    /** montage (same city) or the flight cutscene (other city), then the chapter */
    async goToChapter(idx) {
        const ch = this.chapters[idx]; if (!ch || this._transit) return false;
        this._transit = true;
        try {
            const prev = this.ch;
            this.photo?.close?.(); this.state = 'montage'; this.input.lookAllowed = false; this.input.releaseLock(); this.hud.prompt(null); this.hud.setNavLine('');
            this.audio.stopEngine?.();
            if (prev && prev.city !== ch.city) await this.flightCutscene(prev.city);
            else await chapterMontage({ cityName: this.city?.name, districts: CITIES[ch.city].districts || {}, from: prev?.district, to: ch.district, year0: prev?.year, year1: ch.year, title: ch.title, caption: ch.intro, duration: prev ? 5000 : 4200 });
            await this.enterChapter(idx);
            if (prev && prev.city !== ch.city && ch.city === 'seattle') this.hud.achievement('flight');
        } finally { this._transit = false; }
        return true;
    }
    async flightCutscene(from) {
        $('#hud').classList.add('in-office');
        try { await playFlight({ from, hud: this.hud, audio: this.audio }); } catch (e) { console.warn('[flight]', e); }
        $('#hud').classList.remove('in-office');
    }

    // ---------------------------------------------------------------------------------- unstick / reset
    /** stuck = barely moving while touching something for 2 s → prompt for R */
    updateUnstick(dt) {
        const P = this.player;
        if (Math.abs(P.speed) < 1 && P.touching) this.stuckT = (this.stuckT || 0) + dt;
        else this.stuckT = Math.max(0, (this.stuckT || 0) - dt * 0.5);
    }
    /** right-most lane pose on the nearest drivable edge to (x,z), facing the legal direction (closest to `heading`) */
    lanePose(x, z, heading, y = null, filter = null) {
        const cands = this.nav.index.near(x, z, 120, []);
        const scored = [];
        for (const e of cands) {
            if (filter && !filter(e)) continue;
            if (e.len < 6 || e.tramOnly || !(canTravel(e, 1) || canTravel(e, -1))) continue;
            if (e.type === 'service' || e.virtual) continue; // never reset onto service roads (narrow, private, dead ends)
            const ax = e.a.x, az = e.a.z, dx = e.b.x - ax, dz = e.b.z - az, L2 = dx * dx + dz * dz || 1;
            const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
            const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
            // on the car's level (a deck above / a street below is not "the nearest road")
            const ey = 0.24 + (e.ya ?? 0) + ((e.yb ?? 0) - (e.ya ?? 0)) * t;
            const lvl = y == null ? 0 : Math.abs(ey - y) < 2 ? 0 : 80;
            const score = d + lvl + (e.main === false ? 200 : 0) + (e.tunnel || e.bridge ? 25 : 0) + (e.len < 15 ? 12 : 0) + (isMotorway(e) ? 6 : 0);
            scored.push({ e, t, score });
        }
        scored.sort((a, b) => a.score - b.score);
        if (!scored.length) { const ne = this.nav.index.nearest(x, z, 3000, (e) => e.type !== 'service') || this.nav.index.nearest(x, z, 3000); if (!ne) return null; scored.push({ e: ne.edge, t: ne.t }); }
        const hx = -Math.sin(heading), hz = -Math.cos(heading);
        const poseOf = ({ e, t }, shift = 0) => {
            let dir = (e.dirx * hx + e.dirz * hz) >= 0 ? 1 : -1;
            if (!canTravel(e, dir)) dir = -dir;
            const lane = Math.max(0, lanesDir(e, dir) - 1);
            // keep out of the junction boxes when the edge is long enough
            const ra = (e.a.radius ?? 6) + 3, rb = (e.b.radius ?? 6) + 3;
            let s = t * e.len + shift; if (e.len > ra + rb) s = clamp(s, ra, e.len - rb); else s = clamp(s, 0, e.len);
            let lat = this.traffic.laneOffset(e, lane);
            // never outside the carriageway (a narrow service road / lane: centre the car on it)
            const hw = dir > 0 ? (e.wR ?? e.halfW) : (e.wL ?? e.halfW);
            if (hw != null) lat = Math.min(lat, Math.max(0, hw - 1.1));
            if (e.type === 'service' && lanesDir(e, 1) + lanesDir(e, -1) <= 2) lat = Math.min(lat, e.oneway ? 0 : 0.6);
            return { x: e.a.x + e.dirx * s + e.nx * dir * lat, z: e.a.z + e.dirz * s + e.nz * dir * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
        };
        for (const c of scored.slice(0, 8)) for (const sh of [0, 8, -8, 16, -16]) { const p = poseOf(c, sh); if (this.spotFree(p)) return p; }
        return poseOf(scored[0]);
    }
    /** a car pose is free of buildings / props / walls at its level (the car body = 3 circles of 1 m) and, with
     *  `vehR`, of non-parked-away vehicles within that radius on the same level */
    spotFree(p, vehR = 0) {
        const w = this.world;
        const e = p.edge, sx = e ? ((p.x - e.a.x) * e.dirx + (p.z - e.a.z) * e.dirz) / (e.len || 1) : 0;
        const py = 0.24 + (e ? (e.ya ?? 0) + ((e.yb ?? 0) - (e.ya ?? 0)) * clamp(sx, 0, 1) : 0);
        const fx = -Math.sin(p.heading), fz = -Math.cos(p.heading);
        if (w?.buildings) for (const o of [1.3, 0, -1.3]) if (collideBuildings(w.buildings, p.x + fx * o, p.z + fz * o, 1.05, py)) return false;
        if (vehR > 0) for (const v of this.traffic.near(p.x, p.z, vehR)) if (v.parked && Math.abs((v.y ?? 0.24) - py) < 2) return false;
        return true;
    }
    /** R: put the car back on the road (nearest edge, right lane, legal direction) and clear NPCs around it */
    resetToRoad({ silent = false } = {}) {
        const P = this.player;
        const pose = this.lanePose(P.x, P.z, P.heading, P.surfY ?? null); if (!pose) return false;
        P.place(pose.x, pose.z, pose.heading, pose.edge); P.contactAge = 9; P.steer = 0;
        this.stuckT = 0; this.prevEdgeInfo = null;
        const n = this.traffic.clearAround(pose.x, pose.z, 12);
        this.nav.reroute(P);
        if (!silent) { this.hud.toast('🛟 Back on the road', `${roadName(pose.edge)}${n ? ` · ${n} car${n > 1 ? 's' : ''} moved along` : ''}`); this.audio.blip(700, 0.08, 0.08); }
        return pose;
    }

    // ---------------------------------------------------------------------------------- fast travel
    fastTravelToObjective() {
        if (this.navManual && this.nav.dest) return this.fastTravel({ ...this.nav.dest });
        const o = this.objective;
        if (!o) { this.hud.toast('⏩ Nowhere to fast-travel', 'Pick a destination on the map (M).'); return; }
        return this.fastTravel({ x: o.doorX ?? o.x, z: o.doorZ ?? o.z, label: this.objectivePlain || 'Destination' });
    }
    /** point `d` metres along a route → lane pose (right-most lane of that leg, facing along the route) */
    poseAlongRoute(route, d) {
        const { points: P, cum, legs } = route;
        let i = 0; while (i < P.length - 2 && cum[i + 1] < d) i++;
        const leg = legs[Math.min(i, legs.length - 1)]; const e = leg.e, dir = leg.dir;
        const segLen = cum[i + 1] - cum[i] || 1;
        let local = d - cum[i];
        const r0 = (i === 0 ? 0 : ((dir > 0 ? e.a : e.b).radius ?? 6) + 3), r1 = (i >= P.length - 2 ? 0 : ((dir > 0 ? e.b : e.a).radius ?? 6) + 3);
        if (segLen > r0 + r1) local = clamp(local, r0, segLen - r1);
        const t = clamp(local / segLen, 0, 1);
        const cx = P[i][0] + (P[i + 1][0] - P[i][0]) * t, cz = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
        const lat = this.traffic.laneOffset(e, Math.max(0, lanesDir(e, dir) - 1));
        return { x: cx + e.nx * dir * lat, z: cz + e.nz * dir * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
    }
    async fastTravel(dest) {
        if (this.state !== 'drive' || this.refuel) return false;
        const { player, hud, city } = this;
        const route = this.nav.compute(player.x, player.z, dest.x, dest.z, player.heading, player.surfY ?? null);
        if (!route) { hud.toast('🧭 No route', 'Could not find a drivable route there.', 'warn'); return false; }
        if (route.total < 120) { hud.toast('⏩ Already here', `${dest.label || 'Destination'} is just ahead.`); return false; }
        // travel time on the route (speed limits, ~35% lost to lights and traffic) and fuel at the normal rate
        let t = 0; for (const leg of route.legs) t += leg.e.len / Math.max(5, edgeSpeed(leg.e) * 0.8);
        t = Math.max(t * 1.35, route.total / 16);
        const vAvg = route.total / t;
        const burn = (FUEL_IDLE + FUEL_ROLL * vAvg + FUEL_AERO * vAvg * vAvg * vAvg) * t * 1.15; // +15% stop-and-go
        const tank = burn * FUEL_GAME_MULT;
        if (tank > this.fuel - 0.2 && !dest.station) {
            hud.toast('⛽ Not enough fuel for that trip', 'Fast-travel to a gas station first (M → Gas stations).', 'warn');
            return false;
        }
        // land on the last stretch of the route (the destination's own street when it is long enough), ~22 m
        // before the door, in the legal direction, on a spot clear of walls, props and parked cars
        let pose = null, landD = 60;
        for (const d of [22, 26, 32, 40, 50, 60]) {
            const p = this.poseAlongRoute(route, Math.max(0, route.total - d));
            if (this.spotFree(p, 6)) { pose = p; landD = d; break; }
        }
        if (!pose) pose = this.poseAlongRoute(route, Math.max(0, route.total - 60));
        const names = []; for (const leg of route.legs) { const n = leg.e.name || leg.e.ref; if (n && names[names.length - 1] !== n && !names.includes(n)) names.push(n); }
        this.photo?.close?.(); this.state = 'montage';
        this.input.lookAllowed = false; this.input.releaseLock();
        hud.prompt(null); hud.setNavLine('');
        this.audio.blip(520, 0.08, 0.08);
        await this.playMontage({ dest, names, dist: route.total, liters: burn, tank, secs: t });
        // apply
        this.fuel = Math.max(0.3, this.fuel - tank);
        this.stats.fuelReal += burn; this.stats.dist += route.total; this.stats.time += t;
        this.stats.fastTravels++; this.stats.fastDist += route.total;
        player.place(pose.x, pose.z, pose.heading, pose.edge); player.contactAge = 9; player.steer = 0;
        this.stuckT = 0; this.prevEdgeInfo = null;
        this.traffic.setPlayer(player);           // big worlds: rebuild the traffic bubble around the new spot
        this.traffic.clearAround(pose.x, pose.z, 12);
        // and nobody queued between the landing spot and the door
        for (let d = route.total - landD + 6; d < route.total + 4; d += 6) {
            const q = this.poseAlongRoute(route, Math.min(route.total, d)); this.traffic.clearAround(q.x, q.z, 5);
        }
        const o = this.objective, isObjective = o && Math.hypot((o.doorX ?? o.x) - dest.x, (o.doorZ ?? o.z) - dest.z) < 5;
        if (isObjective) { this.navManual = false; this.autoRoute(true); }
        else this.setNavDest({ x: dest.x, z: dest.z, label: dest.label }, true); // keep guiding to where we fast-travelled
        for (const c of this.cameras || []) c.lastD = 1e9;
        this.state = 'drive';
        this.input.flush(); this.frameClock.getDelta();
        hud.toast(`⏩ ${dest.label || 'Arrived'}`, `${fmtDist(landD, city.units)} to go on ${roadName(pose.edge)}.`);
        if (this.stats.fastTravels === 1) hud.achievement('fast-travel');
        return true;
    }
    /** 1.5 s "driving montage": city, street names flashing by, distance, fuel and time */
    playMontage({ dest, names, dist, liters, tank, secs }) {
        const el = $('#montage'); if (!el) return Promise.resolve();
        const us = this.city.units === 'mph';
        const scale = this.world.scale ?? 1;
        const cityName = this.city.name || (this.city.id === 'bucharest' ? 'București' : 'Seattle');
        el.querySelector('.m-city').textContent = cityName;
        el.querySelector('.m-dest').textContent = '→ ' + (dest.label || 'Destination');
        const street = el.querySelector('.m-street'), dEl = el.querySelector('.m-dist'), fEl = el.querySelector('.m-fuel'), tEl = el.querySelector('.m-time'), bar = el.querySelector('.m-bar i');
        const list = names.length ? names : ['…'];
        el.classList.add('show');
        const DUR = 1500, t0 = performance.now();
        return new Promise(res => {
            let lastIdx = -1;
            const tick = () => {
                const k = clamp((performance.now() - t0) / DUR, 0, 1), e = 1 - Math.pow(1 - k, 2);
                const idx = Math.min(list.length - 1, Math.floor(k * list.length));
                if (idx !== lastIdx) { lastIdx = idx; street.textContent = list[idx]; street.classList.remove('flash'); void street.offsetWidth; street.classList.add('flash'); }
                const real = scale !== 1 && k >= 1 ? ` <small>(≈ ${fmtDist(dist / scale, this.city.units)} in real life)</small>` : '';
                dEl.innerHTML = `🛣️ ${fmtDist(dist * e, this.city.units)}${real}`;
                fEl.textContent = `⛽ −${us ? (tank * e / GAL).toFixed(2) + ' gal' : (tank * e).toFixed(2) + ' L'} tank`;
                tEl.textContent = `🕒 +${Math.max(1, Math.round(secs * e / 60))} min`;
                bar.style.width = (k * 100).toFixed(1) + '%';
                if (k < 1) requestAnimationFrame(tick);
                else setTimeout(() => { el.classList.remove('show'); res(); }, 120);
            };
            requestAnimationFrame(tick);
        });
    }

    // ----------------------------------------------------------------------------------
    enterOffice(stop) {
        this.photo?.close?.();
        this.state = 'office';
        this.audio.stopEngine(); this.audio.blip(520, 0.15, 0.1);
        $('#hud').classList.add('in-office');
        this.player.resetLook();
        this.office = new Office(this.renderer, this.camera, stop, this.hud, this.input, this.audio);
        this.hud.toast(`${stop.icon} ${stop.company}`, stop.tagline);
        this.hud.setStreet(stop.company, stop.address);
        this.hud.prompt(null);
        this.hud.setNavLine('');
    }
    updateOffice(dt) {
        const o = this.office;
        o.update(dt);
        this.hud.update(dt, this.camera, this.city.id);
        o.render();
        if (o.done) this.leaveOffice();
    }
    leaveOffice() {
        this.photo?.close?.();
        const o = this.office; const stop = o.stop;
        o.dispose(); this.office = null;
        $('#hud').classList.remove('in-office');
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.player.resetLook();
        this.state = 'drive';
        if (this.ch) { // chapters: reading a screen of this chapter's office completes it
            if (o.read.size > 0 && !this.visited.has(stop.id)) { this.visited.add(stop.id); stop.poiRef.visited = true; this.audio.chime(); }
            if (o.read.size > 0 && this.ch.stop === stop.id && !this.chapterDone) { const id = this.chapter; queueMicrotask(() => this.completeChapter(id)); }
            else if (o.read.size === 0) this.hud.toast('👀 Nothing read', 'Walk up to a screen and press E to read it.');
        } else if (o.read.size > 0 && !this.visited.has(stop.id)) {
            this.visited.add(stop.id); stop.poiRef.visited = true;
            this.audio.chime();
            this.hud.toast('✅ ' + stop.short + ' unlocked', `${this.visited.size}/${STOPS.length} chapters of the CV discovered`);
            this.updateObjective();
            if (stop.id === 'uipath-bel') setTimeout(() => this.finale(), 1200);
            else if (this.objective) setTimeout(() => this.hud.toast('⏩ Press F to fast-travel to the next stop', `${this.objectivePlain} · or drive there yourself`, 'intro'), 1600);
        } else if (o.read.size === 0) this.hud.toast('👀 Nothing read', 'Walk up to a screen and press E to read it.');
        this.input.flush();
        this.player.speed = 0;
    }

    async fly() {
        this.photo?.close?.();
        const from = this.city.id;
        this.state = 'flight';
        this.input.lookAllowed = false; this.input.releaseLock();
        this.audio.stopEngine();
        $('#hud').classList.add('in-office');
        this.hud.setNavLine('');
        await playFlight({ from, hud: this.hud, audio: this.audio, texts: from === 'seattle' ? [[0, 'Back to Romania for a visit'], [0.4, 'Over Greenland again'], [0.8, 'Landing at Otopeni. Brace for DN1.']] : undefined });
        $('#loading').classList.add('show');
        await new Promise(r => setTimeout(r, 30));
        await this.loadCity(from === 'bucharest' ? 'seattle' : 'bucharest');
        this.fuel = TANK_L * 0.85; // rental car / back home: fresh tank
        $('#loading').classList.remove('show');
        $('#hud').classList.remove('in-office');
        this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.state = 'drive';
        if (from === 'bucharest') { this.hud.achievement('flight'); this.hud.toast('🌧️ Welcome to Seattle', 'Rental car picked up at SeaTac. Follow the route: I-5 N → I-90 E → I-405 N to Bellevue.', 'intro'); }
        else this.hud.toast('🇷🇴 Back in Bucharest', 'Free roam. The traffic missed you.');
        this.input.flush();
    }

    finale() {
        this.photo?.close?.();
        this.input.releaseLock();
        this.hud.achievement('all');
        const s = this.stats;
        const links = PROFILE.links.map(l => `<a class="btn ghost" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('');
        const timeline = STOPS.map(st => `<li><span class="dot" style="background:${st.color}"></span><b>${st.company}</b> — ${st.role} <small>${st.period}</small></li>`).join('');
        const both = (o) => [o.RON ? money('RON', o.RON) : '', o.USD ? money('USD', o.USD) : ''].filter(Boolean).join(' + ') || '0';
        const mins = Math.round((performance.now() - (this.startTime || performance.now())) / 60000);
        const statLine = [
            `Time: ${mins} min`,
            `Distance driven: ${(s.dist / 1000).toFixed(1)} km (${(s.dist / 1609.34).toFixed(1)} mi)`,
            `Fuel spent: ${s.fuelReal.toFixed(1)} L burned · ${s.fuelL.toFixed(1)} L bought (${both(s.fuelCost)})`,
            `Fines: ${s.fineCount} (${both(s.fines)})`,
            `Honks: ${this.honks}`,
            `Fast travels: ${s.fastTravels}${s.fastTravels ? ` (${(s.fastDist / 1000).toFixed(1)} km skipped)` : ''}`,
            `Achievements: ${this.hud.unlocked.size}`,
        ].join(' · ');
        this.hud.panel(`<div class="eyebrow">🏁 Story complete</div><h2>${PROFILE.name}</h2><p class="lead">${PROFILE.title} · ${PROFILE.location}</p><p>${PROFILE.summary}</p><ul class="timeline">${timeline}</ul><div class="chips">${PROFILE.topSkills.map(sk => `<span class="chip">${sk}</span>`).join('')}</div><h3>Say hi</h3><div class="links">${links}<a class="btn ghost" href="mailto:${PROFILE.email}">Email</a></div><h3>Trip computer</h3><p class="meta">${statLine}</p><p class="meta">You can keep driving around, or fly back to Bucharest from SeaTac.</p>`);
    }
}

// ---------- fallback props (only used when the world has no fuel / camera POIs) ----------
function buildStationMesh(x, z, angle, brand) {
    const g = new THREE.Group();
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, h, d, c, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(px, py, pz); m.castShadow = true; g.add(m); return m; };
    const col = { Petrom: '#0f5132', OMV: '#1d4ed8', MOL: '#dc2626', Rompetrol: '#f59e0b', Lukoil: '#b91c1c', Socar: '#0ea5e9', Chevron: '#1e40af', Shell: '#facc15', '76': '#f97316', Arco: '#1e3a8a' }[brand] || '#0f766e';
    box(12, 0.6, 8, '#f1f5f9', 0, 5, 0); box(12.1, 0.35, 8.1, col, 0, 4.6, 0);
    for (const sx of [-5, 5]) for (const sz of [-3, 3]) box(0.35, 4.6, 0.35, '#e5e7eb', sx, 2.3, sz);
    for (const sx of [-2.5, 2.5]) { box(0.8, 1.6, 0.6, '#e2e8f0', sx, 0.8, 0); box(0.82, 0.3, 0.62, col, sx, 1.5, 0); }
    box(10, 3.2, 5, '#f8fafc', 0, 1.6, -8);
    const tex = signTexture(brand, { bg: col, fg: '#ffffff', accent: '#ffffff', w: 512, h: 128 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(0, 4.8, 4.06); g.add(sign);
    const pylon = box(0.5, 6, 0.5, '#94a3b8', 6.5, 3, 5.5);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); ps.position.set(6.5, 6.2, 5.5); g.add(ps); pylon.castShadow = true;
    g.position.set(x, 0.2, z); g.rotation.y = angle + Math.PI;
    return g;
}
function buildCameraMesh(x, z, angle) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), new THREE.MeshLambertMaterial({ color: '#6b7280' })); pole.position.y = 2; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.8), new THREE.MeshLambertMaterial({ color: '#d4d4d8' })); box.position.y = 4.1; g.add(box);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), new THREE.MeshBasicMaterial({ color: '#111827' })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 4.1, 0.42); g.add(lens);
    g.position.set(x, 0.2, z); g.rotation.y = angle + Math.PI;
    return g;
}

window.game = new Game();
