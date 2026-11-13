import {mountInspection} from './inspection.js';
import * as THREE from '../vendor/three.module.min.js';
import { loadProgress, saveProgress } from './chapters.js';
import { STOPS, AIRPORTS, FACTS } from './data.js';
import { buildWorld } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { HUD } from './hud.js';
import * as MINIMAP from './minimap.js';
import { syncModalControls } from './modal-controls.js';
import { Navigator, fmtDist } from './nav.js';
import { isTouch, clamp } from './util.js';
import { Renderer3D } from './render.js';
import { disposeDistrictScene } from './sceneResources.js';
import { PhotoMode } from './photo.js';
import * as VEHICLES from './vehicles.js';
import { initAchievements } from './achievements.js'; // spec 23 (progression): observes window.game
import { save } from './save.js'; // progression, note 73
import { districtFile } from './district-pack.js';
import { createDinamoFootball } from './football.js';
import { createRosettiBasketball } from './basketball.js';
import { initExplore } from './explore.js'; // world-map hub, free roam ⇄ story (resume chip), drone — hooks listed in spec 10 (one mode since 2026-11-08)

// Game methods by concern (prototype mixins, installed right after the class below)
import { $, CHAPTERS, CITIES, DEV, MiniMap, TANK_L, TIME_ZONES, WEATHER_OVERRIDES } from './game-common.js';
import { mixin } from './mixin.js';
import { DriveMethods } from './game-drive.js';
import { RoadMethods } from './game-road.js';
import { FootMethods } from './game-foot.js';
import { ConditionsMethods } from './game-conditions.js';
import { StoryMethods } from './game-story.js';
import { MenuMethods } from './game-menus.js';
import { SpotMethods } from './game-spots.js';
import { DebugMethods } from './game-debug.js';

class Game {
    constructor() {
        this.canvas = $('#gl');
        // Renderer3D owns the WebGLRenderer, lighting, sky, weather, post-processing and adaptive quality
        this.r3d = this.renderer3d = new Renderer3D(this.canvas, { quality: 'auto' });
        this.renderer = this.r3d.renderer; // still used directly for the mirror pass and the office scene
        setTimeout(() => { try { this.r3d.prewarmEnvBake?.(); } catch (e) { /* only a warm-up */ } }, 0); // (spec 10: first place's env bake)
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
        this.opts = { minimap: this.loadOpt('minimap', this.touch), look: this.loadStr('look', 'lock') };
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
        // closing any panel hands keyboard focus back to the game (a focused, hidden button would eat Space / Enter) and
        // lets the next click on the view take the mouse look again (note 21)
        this.canvas.tabIndex = -1; this.canvas.style.outline = 'none';
        this.hud.onPanelClose = () => this.returnFocus();
        // settings (pause menu): look sensitivity / invert, volume, HUD
        { const sv = +this.loadStr('sens', '1'); this.input.sens = Number.isFinite(sv) && sv > 0 ? sv : 1; this.input.invertY = this.loadOpt('invertY', false);
          const vv = +this.loadStr('volume', '1'); this.audio.volume = Number.isFinite(vv) ? vv : 1; this.opts.hudOff = this.loadOpt('hudOff', false); document.body.classList.toggle('hud-off', this.opts.hudOff); }
        this.buildPause();
        // in a spot, an Esc / M that closes the camera, a plaque or a panel must not also open the pause panel
        window.addEventListener('keydown', (e) => {
            if ((e.code === 'Escape' || e.code === 'KeyM') && this.state === 'spot' && (this.photo?.active || this.spot?.ui?.panelOpen || this.hud.panelOpen)) this._spotSwallow = e.code;
        }, true);
        this.applyOpts();
        document.addEventListener('click', (e) => { if (e.target.closest('#spot-ui [data-spot-use]') && this.state === 'spot' && !this._controlsModal && !this.spot?.spot?.ctx?.extras?.venueActivities?.active) this.input.actions.add('KeyE'); });
        $('#prompt')?.addEventListener('click', (e) => { if (e.target.closest('[data-act=uturn]')) this.uTurn(); });
        // photo mode (spec 16): listens to P itself while drive / office / on foot
        try {
            this.photo = new PhotoMode({
                renderer: this.renderer, getScene: () => (this.state === 'spot' ? this.spot?.spot?.scene : this.state === 'office' ? this.office?.scene : this.scene), getCamera: () => this.camera,
                hud: this.hud, audio: this.audio, input: this.input,
                canOpen: () => (this.state === 'office' || this.state === 'foot' || // (no photos from behind the wheel — round 6 note 36)
                     (this.state === 'spot' && !this.spot?.ui?.panelOpen)) && !this.mapOpen && !this.hud.panelOpen,
                getInfo: () => (this.state === 'spot' && this.spot ? this.spot.photoInfo() : { place: this.state === 'office' ? this.office?.stop.company : document.getElementById('street')?.textContent, city: this.city?.id, timeZone: this.clock.timeZone, night: !!this.r3d.nightLights }),
                onPhoto: (meta, shot) => this.onPhoto(meta, shot),
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

    toggleMiniMap(collapsed = !this._minimapCollapsed) {
        this._minimapCollapsed = !!collapsed; document.body.classList.toggle('minimap-collapsed', this._minimapCollapsed);
        const b = $('#minimap-toggle'); if (b) { b.textContent = collapsed ? '🗺️ Map' : '−'; b.setAttribute('aria-label', collapsed ? 'Restore mini-map' : 'Collapse mini-map'); b.setAttribute('aria-expanded', String(!collapsed)); }
    }

    resize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
        this.r3d.resize(w, h);
    }

    bindMenu() {
        $('#start').addEventListener('click', () => this.newStory());
        $('#menu-settings')?.addEventListener('click', () => this.togglePause(true, 'settings'));
        this.renderMenuChapters();
        this.loadSpotsModule().then(() => this.renderMenuSpots());
        // World map (explore.js): the hub to pick a start anywhere — free roam, the story waits (one mode since 2026-11-08)
        $('#worldmap-start')?.addEventListener('click', () => { this.audio.init(); this.audio.resume(); this.explore?.roam?.(); });
        // Continue (progression / save.js, note 73): restores the last session (position, mode, conditions)
        try { save.ready?.then?.(() => { const b = $('#continue'); if (b) { b.hidden = !save.hasSession?.(); b.onclick = () => save.restore(this); } this.prefetchDistrictPacks(); }); } catch (e) { console.warn('[save]', e); }
        { const cw = $('#menu .controls-wrap'); if (cw && matchMedia('(min-height: 900px) and (min-width: 900px)').matches) cw.open = true; } // tall screens: controls open; else collapsed so the menu fits
        $('#quality').addEventListener('change', (e) => { this.quality = e.target.value; this.r3d.setQuality(e.target.value); });
        $('#mute').addEventListener('click', (e) => { this.audio.setMuted(!this.audio.muted); e.target.textContent = this.audio.muted ? '🔇' : '🔊'; });
        { const ws = $('#weather'); if (ws) { if (this.weatherOverride) ws.value = this.weatherOverride; ws.addEventListener('change', (e) => this.setRoamWeather(e.target.value === 'real' ? 'live' : e.target.value)); } }
        $('#timeofday')?.addEventListener('change', (e) => this.setRoamTime(({ real: 'now', sunset: 'golden' })[e.target.value] || e.target.value));
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
        $('#minimap-toggle')?.addEventListener('click', () => this.toggleMiniMap());
        $('#minimap')?.addEventListener('click', () => { if (this.touch) this.toggleMiniMap(true); });
        $('#map-close')?.addEventListener('click', () => this.toggleMap(false));
        $('#map-fast-travel')?.addEventListener('click', () => { if (!this.fastTravelStatus().disabled) { this.toggleMap(false); this.fastTravelToObjective(); } });
        // (round 6 note 51) hover tooltip: the nearest listed place / station under the pointer
        { const tip = document.createElement('div'); tip.id = 'map-tip'; $('#bigmap-wrap')?.appendChild(tip);
            bm.addEventListener('pointerleave', () => tip.classList.remove('show'));
            bm.addEventListener('pointermove', (e) => {
                const mv = this.mapView; if (!mv || this._drag) { tip.classList.remove('show'); return; }
                const r = bm.getBoundingClientRect(), sx = bm.width / r.width, px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sx;
                const x = (px - bm.width / 2) / mv.scale + mv.cx, z = (py - bm.height / 2) / mv.scale + mv.cz, lim = 16 * sx / mv.scale;
                let best = null, bd = lim;
                for (const it of this.navItems || []) { const d = Math.hypot((it.x ?? it.nx) - x, (it.z ?? it.nz) - z); if (d < bd) { bd = d; best = { label: `${it.icon || ''} ${String(it.label).replace(/ ✓$/, '')}`, x: it.x ?? it.nx, z: it.z ?? it.nz }; } }
                for (const st of this.stations || []) { const d = Math.hypot(st.x - x, st.z - z); if (d < bd) { bd = d; best = { label: `⛽ ${st.brand}`, x: st.x, z: st.z }; } }
                if (!best) { tip.classList.remove('show'); return; }
                const P = this.state === 'foot' && this.foot ? this.foot : this.player;
                tip.textContent = `${best.label.trim()} · ${fmtDist(Math.hypot(best.x - P.x, best.z - P.z), this.city.units)}`;
                const wr = $('#bigmap-wrap').getBoundingClientRect(); tip.style.left = `${e.clientX - wr.left + 14}px`; tip.style.top = `${e.clientY - wr.top + 12}px`; tip.classList.add('show');
            });
        }
        // the legend rows (minimap.js) and the list checkboxes share one filter: either one re-renders the list + map
        addEventListener('dmcv:mapfilter', () => { if (this.mapOpen) { this.buildNavList(); this.redrawMap(); } });
        $('#navlist')?.addEventListener('toggle', (e) => { const d = e.target; if (d?.dataset?.group) { (this._navOpen || (this._navOpen = {}))[d.dataset.group] = d.open; const sm = d.querySelector('summary small'); if (sm) sm.textContent = sm.textContent.replace(/ ›$/, '') + (d.open ? '' : ' ›'); } }, true);
        $('#navlist')?.addEventListener('click', (e) => {
            if (e.target.closest('[data-cond]')) { this.toggleMap(false); this.buildConditions(); this.toggleConditions(true, { any: true }); return; }
            const fl = e.target.closest('[data-filter]');
            if (fl) { e.stopPropagation(); MINIMAP.setMapFilter(fl.dataset.filter, fl.checked); this.redrawMap(); return; } // (same toggle as the map legend)
            const cb = e.target.closest('[data-car]');
            if (cb) { this.toggleMap(false); if (cb.dataset.car === 'call') this.callCar(); else this.routeToCar(); return; }
            const spb = e.target.closest('[data-spot]');
            if (spb) { this.toggleMap(false); this.enterSpot(spb.dataset.spot); return; }
            const chb = e.target.closest('[data-chapter]');
            if (chb) { this.toggleMap(false); this.goToChapter(+chb.dataset.chapter); return; }
            const ft = e.target.closest('[data-ft]');
            if (ft) { const it = this.navItems[+ft.dataset.ft]; if (it) { this.toggleMap(false); this.fastTravel({ x: it.nx ?? it.x, z: it.nz ?? it.z, label: it.label.replace(/ ✓$/, ''), station: it.group === 'Gas stations' }); } return; }
            const b = e.target.closest('[data-nav]'); if (!b) return;
            const idx = +b.dataset.nav;
            if (idx < 0) { this.explore?.clearDestination?.({ restore: false }); this.navManual = false; this.autoRoute(true); }
            else { const it = this.navItems[idx]; if (it) { this.setNavDest({ x: it.nx ?? it.x, z: it.nz ?? it.z, label: it.label, station: it.group === 'Gas stations' }, true); if (it.walk && this.state === 'drive') this.hud.toast(`${it.icon} ${it.label}`, `The route ends on the nearest street: park there and walk the last ${fmtDist(it.walk, this.city.units)} (Enter).`); } }
            // (round 6 note 51) stay on the map: the route and the destination show; frame them, then M / Close to drive
            { const mv = this.mapView, P = this.player, d = this.nav.dest; if (mv && d) { mv.cx = (P.x + d.x) / 2; mv.cz = (P.z + d.z) / 2; } }
            this.redrawMap(); this.buildNavList();
            const hint = $('#map-route-hint') || (() => { const h = document.createElement('div'); h.id = 'map-route-hint'; $('#bigmap-wrap .map-hint')?.before(h); return h; })();
            hint.textContent = this.nav.route ? `🧭 Route set: ${this.nav.dest?.label || 'destination'} · ${fmtDist(this.nav.route.total, this.city.units)} — press M or Close to drive` : '';
        });
    }

    /** (round 6 note 57) "New story" is a fresh run: chapter progress, the saved Continue session, this run's stats /
     *  fines / clamp and the visited stops are cleared (achievements and photos are lifetime collections and stay;
     *  the achievements panel has the full reset). Asks first when there is progress to lose. */
    async newStory() {
        const P = this.progress, has = P && (P.done.size || P.reached.size > 1);
        if (has && !confirm('Start a new story from 2009?\n\nChapter progress and this run\'s stats are reset. Achievements and photos are kept.')) return;
        this.progress = { reached: new Set(), done: new Set() }; saveProgress(this.progress);
        this.visited = new Set(); this.clamp = null; this.fuel = TANK_L * 0.6;
        this.stats = { dist: 0, time: 0, fuelL: 0, fuelReal: 0, fuelCost: { RON: 0, USD: 0 }, fines: { RON: 0, USD: 0 }, fineCount: 0, tow: { RON: 0, USD: 0 }, cleanDist: 0, peds: 0, fastTravels: 0, fastDist: 0 };
        try { await save.clearSession?.(); } catch (e) { console.warn('[save] clear', e); }
        try { const b = $('#continue'); if (b) b.hidden = true; } catch { /* ignore */ }
        this.renderMenuChapters?.();
        return this.start(0);
    }
    /** (spec 10 load budget, owner 2026-11-13) while the menu is open, the data packs of the districts the player most likely
     *  enters next (the saved session's, and the first chapter not done yet) are downloaded at low priority into the HTTP
     *  cache: the build worker's fetch of that pack then skips the download. Nothing else changes; a failure is ignored. */
    prefetchDistrictPacks() {
        const go = () => {
            if (this.started || this.state !== 'menu') return;
            const files = new Set(), add = (city, district) => { if (city && district && CITIES[city]?.districts?.[district]) files.add(districtFile(city, district)); };
            const s = save.session; if (s) add(s.city, s.freeRoam?.district || s.district);
            const next = this.chapters?.find(c => !this.progress?.done?.has(c.id)) || this.chapters?.[0]; if (next) add(next.city, next.district);
            for (const f of files) fetch(new URL(`../data/${f}`, import.meta.url), { priority: 'low' }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 500);
    }
    async start(chapterIdx = null) {
        if (this.started) return; this.started = true;
        $('#start').blur();
        this.audio.init(); this.audio.resume();
        $('#menu').classList.remove('show');
        $('#hud').classList.add('show'); document.body.classList.add('playing');
        this.startTime = performance.now();
        await this.enterChapter(chapterIdx ?? 0, { initial: true });
        this.hud.toast('🚗 Follow the blue route', this.touch ? 'Dashboard screen = navigation. Tap 🧭 for the map, or ⏸ for actions and settings.' : 'Dashboard screen = navigation. H = horn · M = map, chapters & navigation.', 'intro');
        setTimeout(() => this.lookHint(), 4500);
    }
    /** back to play after a panel / card / map closed: keyboard focus on the game canvas, input flushed (the Esc / Enter
     *  that closed it does nothing more), mouse look allowed again (pointer lock comes back on the next click on the view) */
    returnFocus() {
        const a = document.activeElement; if (a && a !== document.body && a !== this.canvas) a.blur?.();
        try { this.canvas.focus({ preventScroll: true }); } catch { /* ignore */ }
        this.input.flush(); this.input.keys?.clear?.();
        if (['drive', 'foot', 'spot', 'office'].includes(this.state)) this.input.lookAllowed = true;
        this.frameClock.getDelta();
    }
    /** one-time hint for mouse / touch look */
    lookHint() {
        if (this.loadOpt('lookHintShown', false) || this.state !== 'drive') return;
        const m = this.input.lookMode;
        if (this.touch) this.hud.toast('👀 Look around', 'Drag on the right half of the screen to look around (the left thumb steers / walks).', 'intro');
        else if (m === 'lock') this.hud.toast('🖱️ Look around', 'Click the view to look around with the mouse · Esc frees the cursor · C looks back.', 'intro');
        else if (m === 'hold') this.hud.toast('🖱️ Look around', 'Hold the right mouse button and move the mouse · C looks back.', 'intro');
        else return;
        this.saveOpt('lookHintShown', true);
    }
    onLockChange(locked) {
        if (locked && !this.flags.lockToast) { this.flags.lockToast = true; this.hud.toast('🖱️ Mouse look on', 'Esc frees the cursor. The view re-centres when you drive straight.'); }
    }

    // ----------------------------------------------------------------------------------
    /** Release the outgoing district before fetching/building its replacement. The cockpit and render rig survive. */
    disposeCity() {
        if (this.officeReturn) {
            const transitionState = this.state === 'office' ? 'loading' : this.state;
            try { this.restoreOfficeReturn(); }
            finally { this.state = transitionState; }
        }
        this.endFoot();
        this.football?.dispose(); this.football = null;
        this.basketball?.dispose(); this.basketball = null;
        const retained = [this.player?.rig, this.carBody, this.foot?.rig, ...this.r3d.releaseScene()];
        // Free crowd instance attributes before its module teardown detaches them from the wrapper geometry.
        disposeDistrictScene(this.scene, { retained, landmarks: this.world?.landmarks || [] });
        this.traffic?.dispose?.(); this.crew?.dispose?.(); this.crew = null;
        this.renderer.renderLists.dispose(); // cached render items otherwise retain the outgoing scene's objects
        if (this.player) Object.assign(this.player, { scene: null, world: null, traffic: null, bounds: null, supportEdge: null, softZones: [], _rhWorld: null, _wallSrc: null, _walls: null, _surf: null, _own: null });
        if (this.foot) Object.assign(this.foot, { scene: null, world: null, traffic: null, colliders: null });
        if (this.achievements) Object.assign(this.achievements, { drivePrev: null, walkPrev: null, _zw: null, _zebras: null });
        for (const mm of [this.minimap, this.bigmap]) if (mm && mm.canvas?.__mm === mm) mm.canvas.__mm = null;
        for (const s of STOPS) s.poiRef = null;
        for (const key of ['world', 'scene', 'nav', 'traffic', 'minimap', 'bigmap', 'props', 'airport', 'objective', 'prevEdgeInfo', 'navInfo', '_passWorld', '_passList', '_outside', 'clamp']) this[key] = null;
        for (const key of ['stopPois', 'stations', 'cameras', 'actionMarks', 'closures', 'workers']) this[key] = [];
    }
    /** A failed replacement has no street scene to resume; keep the last stable save available through Continue. */
    cityLoadFailed(error) {
        console.error('[world] district load failed', error);
        this.disposeCity();
        this.city = null; this.district = null; this.freeRoam = null; this.started = false; this.state = 'menu';
        this.input.lookAllowed = false; this.input.releaseLock(); this.input.flush(); this.audio.stopEngine?.();
        $('#loading').classList.remove('show'); $('#hud').classList.remove('show'); $('#menu').classList.add('show');
        const resume = $('#continue'); if (resume) resume.hidden = !save.hasSession();
        document.body.classList.remove('playing', 'free-roam');
    }
    /** load one chapter district of a city: `{ district, start }` (spec 10; every map is a 1:1 district) */
    async loadCity(id, { district = null, start = null } = {}) {
        this.explore?.hooks?.abortDrone?.();
        const city = CITIES[id];
        if (!city || !city.districts?.[district]) throw new Error(`unknown district ${id}:${district}`);
        this.disposeCity();
        this.city = city;
        this.chapter = null; this.ch = null; this.chapterIdx = -1; this.chapterDone = false; this.district = district;
        this.clock.timeZone = city.timeZone || TIME_ZONES[id] || 'UTC';
        const scene = this.scene = new THREE.Scene();
        const env = city.env;
        // lighting, sky, fog and weather are owned by Renderer3D (set up after the world exists)
        // world (buildWorld may be async)
        try { VEHICLES.setFleetCity?.(id); } catch { /* older vehicles.js */ } // plates / police livery of parked props + the player's exterior car
        // (spec 10 load budget) deferGround: the build workers finish the fallback ground while traffic and the player are
        // set up below; world.ready is awaited before the renderer is attached (the first frame)
        const world = this.world = await buildWorld(city, this.renderer, { district, start, deferGround: true });
        scene.add(world.group);
        this.football = createDinamoFootball(this);
        this.basketball = createRosettiBasketball(this);
        // layer 2 = main view only (the rear-view mirror camera renders layer 0): far backdrop / horizon masses
        this.camera.layers.enable(2);
        world.group.traverse(o => { if (o.isMesh && /^(backdrop|horizon)$/.test(o.material?.name || '')) o.layers.set(2); });
        // navigation (spatial index shared with traffic)
        this.nav = new Navigator(world);
        // traffic
        const hi = !(this.quality === 'low' || this.quality === 'medium' || this.touch);
        this.traffic = new Traffic(world, city, scene, {
            // pool size at the rush-hour peak; the live count follows the local hour (traffic.setHour)
            maxVehicles: hi ? (id === 'bucharest' ? 480 : 125) : (id === 'bucharest' ? 170 : 50),
            // (instanced crowd: 2 draw calls whatever the count; a district is ~1 km², so these fill its sidewalks — QA round 2)
            maxPeds: district ? (hi ? (id === 'bucharest' ? 560 : 180) : (id === 'bucharest' ? 260 : 90)) : hi ? (id === 'bucharest' ? 250 : 60) : (id === 'bucharest' ? 110 : 30),
            index: this.nav.index,
            onBubble: (v, kind) => this.hud.bubble(v, kind, city.id),
            onSay: (target, text, sub, cls) => this.hud.say(target, text, sub, cls), // (parking reactions, driver lines with the English gloss)
            onHonk: (v, reason) => this.vehicleHonk(v, reason),
            dialogueHost: this,
            onBand: (band, prev) => this.onTrafficBand(band, prev),
        });
        try { this.traffic.onParkingEvent?.((ev) => this.onParkingEvent(ev)); } catch (e) { console.warn('[parking]', e); } // traffic lane, note 8
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
        } else { scene.add(this.player.rig); this.player.scene = scene; }
        this.player.world = world; this.player.traffic = this.traffic; this.player.bounds = world.bounds;
        this.nav.sourceVehicle = this.player;
        this.placeSpawn(city, world);
        // Admit the replacement crowd around the new pose before its first render.
        // The previous world's eye/vehicle pose is invalid in this world.
        this.traffic.setPlayer(this.player);
        this.traffic.clearForPlayer?.(this.player) ?? this.traffic.clearAround(this.player.x, this.player.z, 14);
        // renderer: scene, lighting, real-time sun, street lamps, weather
        await world.ready;
        this.attachWorldRender();
        this.r3d.onNightLights = (on) => { this.nightLights = on; this.traffic?.setNightLights(on || !!this._fogLights); };
        this.r3d.onNightLights(this.r3d.nightLights);
        this.syncHeadlights(true);
        this._wxKey = null; this._seasonShown = false;
        if (typeof this.r3d.setWeather === 'function') { try { this.r3d.setWeather(this.weatherOverride); } catch (err) { console.warn('[weather] setWeather', err); } }
        if ('onWeatherChange' in this.r3d || typeof this.r3d.setWeather === 'function') this.r3d.onWeatherChange = () => this.pollWeather(true);
        setTimeout(() => this.seasonToast(), 2500);
        this.audio.ambience(env.rain ? 0.08 : 0.02);
        // minimap
        this.minimap = new MiniMap($('#minimap'), world, city);
        this.bigmap = new MiniMap($('#bigmap'), world, city);
        this.bigmap.onChange = () => this.redrawMap(); // (legend clicks: filters / collapse)
        // gas stations + speed cameras
        this.props = new THREE.Group(); scene.add(this.props);
        this.setupStations(city, world);
        this.setupCameras(city, world);
        // hud
        this.applyUnits(); // (settings: km/h / mph override)
        this.hud.setTicker(FACTS[city.id]);
        this.hud.setChapter(district ? (city.districts?.[district]?.name || district) : city.id === 'bucharest' ? 'București' : 'Seattle → Bellevue'); // (the chapter / free-roam objective overrides it)
        this.stops = STOPS.filter(s => s.city === city.id).sort((a, b) => a.order - b.order);
        for (const s of this.stops) { s.poiRef = world.pois.find(p => p.id === s.poi && p.interactive !== false); if (s.poiRef) { s.poiRef.visited = this.visited.has(s.id); s.poiRef.color = s.color; s.poiRef.icon = s.icon; } }
        this.stopPois = this.stops.filter(s => s.poiRef).map(s => ({ stop: s, poi: s.poiRef }));
        this.airport = world.pois.find(p => p.id === AIRPORTS[city.id].poi && p.interactive !== false) || world.pois.find(p => p.id === AIRPORTS[city.id].poi);
        this.buildActionMarkers();
        this.prevEdgeInfo = null;
        this.navManual = false; this.navInfo = null;
        this.setupClosures(city, world);
        this.loadPlaces(city, district); // note 9: the district's reachable places by category (world-data places.json)
        this.updateObjective();
    }

    /** hand the loaded world to Renderer3D (scene, vegetation, player, real sun at the city, lamps); also used when
     *  coming back from a tourist spot, which swapped the renderer to its own scene */
    attachWorldRender() {
        const city = this.city, world = this.world, id = city.id;
        // the district's own centre (sun + weather cell: Bellevue is not downtown Seattle), else the city's (R18.5)
        const dc = world.district?.center || city.districts?.[this.district]?.center;
        const center = (dc && Number.isFinite(dc.lat) ? dc : null) || city.center || (id === 'seattle' ? { lat: 47.61, lon: -122.33 } : { lat: 44.4268, lon: 26.1025 });
        this.r3d.setScene(this.scene, this.camera, city.env, { sky: world.sky, units: city.units, vegetation: world.vegetation || null,
            clock: { date: this.nowDate(), lat: center.lat, lon: center.lon, timeZone: this.clock.timeZone, override: this.clock.override || null, timeScale: 1 },
            weather: this.weatherOverride });
        if (world.vegetation) this.r3d.setVegetation?.(world.vegetation);
        this.r3d.setPlayer(this.player);
        this.r3d.setLamps(world.lamps || [], { headMesh: world.lampHeadMesh });
    }

    // ----------------------------------------------------------------------------------
    /** Keep gameplay controls out of every modal, including the hub's early-return frame. */
    syncModalControls() {
        syncModalControls(this);
    }
    loop() {
        requestAnimationFrame(this.loop);
        if (this._modeAttr !== this.state) { this._modeAttr = this.state; document.body.dataset.mode = this.state; } // (round 6 note 36: context-based touch buttons in CSS)
        this.syncModalControls();
        this.basketball?.syncActivity();
        if (this.explore?.hooks?.frame?.()) return; // (explore: drone frames; the world-map hub over a frozen scene)
        const dt = Math.min(0.1, this.frameClock.getDelta());
        if (this._pauseOpen) { // paused: nothing moves; the scene keeps being drawn behind the menu
            if (this.input.take('Escape')) this.togglePause(false);
            this.input.flush();
            if (this.state === 'office') this.renderOffice(); else if (this.state === 'spot') this.r3d.frame(); else if (this.scene) this.drawFrame();
            return;
        }
        if ((this.state === 'drive' || this.state === 'foot') && !this.photo?.active && !this.mapOpen && !this.hud?.panelOpen) this.football?.update(dt);
        if (this.basketball?.available()) this.basketball.update(dt);
        if (this.state === 'drive') this.updateDrive(dt);
        else if (this.state === 'office') this.updateOffice(dt);
        else if (this.state === 'foot') this.updateFoot(dt);
        else if (this.state === 'spot') this.updateSpot(dt);
        else if (this.state === 'card' && this.scene) this.drawFrame();
        else if (this.state === 'menu' && this.condOpen) {
            if (this.input.take('Escape') || this.input.take('KeyK')) this.toggleConditions(false);
            this.input.flush();
        }
        this.explore?.hooks?.afterFrame?.();
    }

    /** capture tools / screenshots: render the rear-view mirror now (it otherwise refreshes every 2nd–3rd frame) */
    renderMirrorNow() { if (this.player && this.scene && this.state === 'drive') { this.player.renderMirror(this.renderer, this.scene); return true; } return false; }
    /** the ONLY place the main scene is rendered while driving (render agent may replace the body) */
    drawFrame({ mirror = false } = {}) {
        if (mirror && this.player) this.player.renderMirror(this.renderer, this.scene);
        this.r3d.frame();
    }
    /** back to the title menu: progress is saved; a fresh page is the cleanest way to drop the world */
    toMainMenu() { this.explore?.hooks?.abortDrone?.(); try { this.photo?.close(); } catch { /* ignore */ } location.reload(); }
}
mixin(Game, DriveMethods, RoadMethods, FootMethods, ConditionsMethods, StoryMethods, MenuMethods, SpotMethods, DebugMethods);

window.game = new Game();
initAchievements(window.game); // spec 23: achievements, completion %, panel
try { initExplore(window.game); } catch (e) { console.error('[explore] init', e); } // explore lane: game.explore API

window.game.inspection = mountInspection(window.game);
