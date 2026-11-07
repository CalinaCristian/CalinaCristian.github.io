// ============================================================================
//  EXPLORE (notes 75 + 76, explore lane) — one game, two modes over the same world:
//  Story (chapters, objectives, cards) ↔ Explore (every district + tourist spot unlocked, no objectives /
//  cards, time / weather / season panel, fast travel, the drone; driving still possible). Switch in place
//  from the pause menu; the world-map hub (worldmap.js) jumps anywhere; the drone lives in drone.js.
//
//  Explore in a district reuses the game's free-roam state (game.freeRoam: no objective, no story progress,
//  conditions panel), so offices, closures and achievements keep working; free roam is folded into Explore.
//
//  main.js:  import { initExplore } from './explore.js';  …  initExplore(window.game);
//  API (game.explore): active · enterExplore(where?) · exitExplore() · openWorldMap(tab?) · closeWorldMap()
//                      deployDrone() · landDrone() · jump(key) · fastTravelTo(x, z) · drone · map · stats()
//  Hooks: `game.explore.hooks` (abortDrone, afterLeaveSpot, beforeChapter, afterFreeRoam, onPhoto, frame, afterFrame),
//  called by main.js — explore no longer wraps Game methods (spec 10).
// ============================================================================
import { CITIES } from './cities.js';
import { chapterMontage, saveProgress } from './chapters.js';
import { collideBuildings } from './world.js';
import { WorldMap } from './worldmap.js';
import { Drone } from './drone.js';

const STORE = 'dmcv.explore.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
const save = (patch) => { try { const s = { ...load(), ...patch }; localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* private mode / quota */ } };
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** one icon per tourist spot (what it is) */
const SPOT_ICON = {
    'pike-place': '🐟', chihuly: '🌺', 'space-needle': '🗼', 'fremont-troll': '🧌', 'kerry-park': '🔭', mopop: '🎸', waterfront: '🎡', 'pioneer-square': '🏛️',
    'ballard-locks': '⚓', 'gas-works': '🏭', 'bel-lincoln-square': '🏙️', 'bel-downtown-park': '🌳', 'bel-botanical-garden': '🌿', 'bel-meydenbauer': '🏖️',
    'palace-parliament': '🏛️', 'peoples-salvation-cathedral': '⛪', 'old-town-lipscani': '📚', 'stavropoleos-cec': '⛪', 'athenaeum-revolution': '🎻',
    'arcul-de-triumf': '🏟️', 'village-museum': '🛖', 'herastrau-park': '🌳', 'spring-palace': '🦚', cismigiu: '🚣',
};
const DISTRICT_ICON = { grozavesti: '🎓', unirii: '⛲', romana: '🏢', floreasca: '🏫', pipera: '💼', otopeni: '✈️', seatac: '🛫', bellevue: '🏙️' };

export function initExplore(game) {
    if (!game || game.explore) return game?.explore;
    let busy = false, jumping = false, story = null, thumbDue = null;
    const api = { active: false };
    game.explore = api; document.body.classList.add('has-explore');

    // ------------------------------------------------------------------ drone + hub
    const drone = api.drone = new Drone(game, { onEvent: (d) => { if (d.type === 'deploy') { game.hud?.prompt?.(null); } }, onGoHere: (x, z) => footTravel(x, z, null, { strict: true }) });
    const map = api.map = new WorldMap({
        items, here, current: () => { const c = currentPlace(); return { key: c.key, region: c.region }; },
        mode: () => (api.active ? 'explore' : 'story'),
        thumb: (k) => load().thumbs?.[k] || null,
        recent: () => load().recent || [],
        onGo: (it) => jump(it),
        onHere: (x, z, pin) => fastTravelTo(x, z, pin),
        onClose: () => {
            if (map.startMode && game.state === 'menu' && !busy) setActive(false);
            if (['drive', 'foot', 'spot'].includes(game.state)) game.returnFocus?.();
        },
        canConditions: () => api.active && ['drive', 'foot'].includes(game.state) && !!game.world,
        onConditions: () => { game.buildConditions?.(); game.toggleConditions?.(true, { any: true }); },
    });

    function setActive(on) {
        api.active = !!on; document.body.classList.toggle('explore', api.active);
        renderBar();
    }
    function toast(title, body, cls = 'intro') {
        try { if (game.state === 'spot' && game.spot?.ui?.toast) game.spot.ui.toast(title, body); else game.hud.toast(title, body, cls); } catch { /* ignore */ }
    }

    // ------------------------------------------------------------------ data for the hub
    function regionOf(city, id, area) { return city === 'bucharest' ? 'bucharest' : (id === 'bellevue' || area === 'bellevue') ? 'bellevue' : 'seattle'; }
    function items() {
        const out = [];
        const done = game.spotsMod?.spotProgress?.()?.postcards || {};
        for (const d of game.roamDistricts?.() || []) {
            const cd = CITIES[d.city]?.districts?.[d.id] || {}, c = cd.center || (cd.bbox ? { lat: (cd.bbox[0] + cd.bbox[2]) / 2, lon: (cd.bbox[1] + cd.bbox[3]) / 2 } : null); if (!c) continue;
            out.push({ key: 'district:' + d.id, kind: 'district', id: d.id, city: d.city, region: regionOf(d.city, d.id), name: d.name, sub: d.label, blurb: d.label, lat: c.lat, lon: c.lon, bbox: cd.bbox, poly: cd.poly, icon: DISTRICT_ICON[d.id] || '🏙️' });
        }
        for (const s of game.spotsMod?.SPOTS || []) {
            out.push({ key: 'spot:' + s.id, kind: 'spot', id: s.id, city: s.city, region: regionOf(s.city, s.id, s.area), name: s.name, sub: s.blurb, blurb: s.blurb, lat: s.lat, lon: s.lon, icon: SPOT_ICON[s.id] || '📷', done: !!done[s.id] });
        }
        return out;
    }
    function currentPlace() {
        const g = game;
        if (g.state === 'spot' && g.spotId) { const e = g.spotEntry || g.spotsMod?.SPOTS?.find((s) => s.id === g.spotId) || {}; return { kind: 'spot', city: e.city, key: 'spot:' + g.spotId, region: regionOf(e.city, e.id, e.area), lat: e.lat, lon: e.lon, name: e.name, mapKey: 'spot:' + g.spotId }; }
        if (g.world && g.district && g.city) { const cd = CITIES[g.city.id]?.districts?.[g.district] || {}; return { kind: 'district', city: g.city.id, key: 'district:' + g.district, region: regionOf(g.city.id, g.district), lat: cd.center?.lat, lon: cd.center?.lon, name: cd.name, mapKey: g.district }; }
        return { kind: null, city: null, key: null, region: g.city?.id === 'seattle' ? 'seattle' : 'bucharest' };
    }
    function here() {
        const g = game;
        if (g.state === 'spot' && g.spot?.spot?.data) {
            const sp = g.spot.spot, ctl = g.spot.ctl, d = sp.data;
            let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
            for (const s of Object.values(d.spots || {})) for (const [x, z] of s.extent?.polygon || []) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
            if (!(x1 > x0)) { x0 = ctl.x - 200; x1 = ctl.x + 200; z0 = ctl.z - 200; z1 = ctl.z + 200; }
            const pins = Object.entries(sp.spawns || {}).map(([id, s]) => ({ x: s.x, z: s.z, id, label: (g.spotsMod?.SPOTS?.find((e) => e.id === id)?.name || id).split(/[:(]/)[0].trim(), icon: SPOT_ICON[id] || '📍', color: '#e11d48' }));
            return { kind: 'spot', key: 'spot:' + sp.sceneId, name: g.spotEntry?.name?.split(/[:(&]/)[0].trim(), data: d, bounds: { x0: x0 - 40, z0: z0 - 40, x1: x1 + 40, z1: z1 + 40 }, player: { x: ctl.x, z: ctl.z, heading: ctl.heading }, pins };
        }
        if (g.world && g.district && ['drive', 'foot'].includes(g.state)) {
            const b = g.world.bounds, foot = g.state === 'foot' && g.foot?.active;
            const P = foot ? g.foot : g.player;
            const pins = (g.stopPois || []).map(({ stop, poi }) => ({ x: poi.doorX ?? poi.x, z: poi.doorZ ?? poi.z, label: stop.short, icon: stop.icon, color: stop.color || '#7c3aed', office: true }));
            return { kind: 'district', key: 'district:' + g.district, name: g.city?.districts?.[g.district]?.name, world: g.world, city: g.city, pois: g.world.pois,
                bounds: { x0: b.minX, z0: b.minZ, x1: b.maxX, z1: b.maxZ }, player: { x: P.x, z: P.z, heading: P.heading, fx: P.fx, fz: P.fz }, pins, car: foot && g.carBox ? { x: g.carBox.x, z: g.carBox.z } : null };
        }
        return null;
    }

    // ------------------------------------------------------------------ mode switches
    /** the loaded district becomes Explore (the free-roam state: no objective, conditions panel) */
    function makeRoam() {
        const g = game; if (!g.world || !g.district) return false;
        if (!g.freeRoam) {
            story = { chapterIdx: g.chapterIdx, chapterDone: g.chapterDone, weather: g.weatherOverride ?? null };
            g.freeRoam = { district: g.district, tod: 'now', weather: g.weatherOverride || 'live', explore: true };
            g.ch = null; g.chapter = null; g.chapterIdx = -1; g.chapterDone = false; g.navManual = false;
            try { g.nav?.clear?.(); } catch { /* ignore */ }
            g.buildConditions?.(); document.body.classList.add('free-roam');
            g.updateObjective?.();
        }
        return true;
    }
    async function enterExplore(where = null) {
        if (where) { const it = typeof where === 'string' ? items().find((i) => i.key === where || i.id === where) : where; if (it) return jump(it); }
        if (game.state === 'menu') { await game.loadSpotsModule?.(); setActive(true); openWorldMap(null, { startMode: true }); return true; }
        setActive(true);
        if (['drive', 'foot', 'office'].includes(game.state)) makeRoam();
        toast('🧭 Explore', `Every district and tourist spot unlocked, no objectives. ${game.touch ? '🌍 map' : 'M'} → world map · ${game.touch ? '🚁' : 'G'} on foot → drone · pause → Switch to Story.`);
        window.cvTelemetry?.track?.('explore_enter', { from: game.state, district: game.district || null, spot: game.spotId || null });
        return true;
    }
    function storyIdx() {
        const ch = game.chapters; if (!ch?.length) return -1;
        if (story && story.chapterIdx >= 0) return story.chapterIdx;
        const P = game.progress || { done: new Set(), reached: new Set() };
        let i = ch.findIndex((c, k) => !P.done.has(c.id) && (k === 0 || P.reached.has(c.id)));
        if (i < 0) i = ch.length - 1; return i;
    }
    /** back to Story: in place when the chapter is in this district, else the montage / flight to its start */
    async function exitExplore() {
        if (busy) return false;
        const idx = storyIdx(), ch = game.chapters?.[idx]; if (!ch) { setActive(false); return false; }
        busy = true;
        try {
            drone.abort(); map.close();
            setActive(false);
            if (game.state === 'office') game.leaveOffice?.();
            if (game.state === 'spot') { jumping = true; try { game.leaveSpot(); } finally { jumping = false; } }
            if (game.state === 'menu') { story = null; game.started = false; await game.start(idx); return true; }
            const g = game;
            if (g.world && g.city?.id === ch.city && g.district === ch.district && ['drive', 'foot'].includes(g.state)) {
                const st = story; story = null;
                if (g.freeRoam) { g.freeRoam = null; g.clock.offsetMs = 0; g.clock.override = g.menuOverride ?? null; g.toggleConditions?.(false); document.body.classList.remove('free-roam'); g.r3d.setSeason?.(null); if (st && (g.weatherOverride ?? null) !== st.weather) g.setWeatherOverride?.(st.weather); g.updateClock?.(0); g.traffic?.setHour?.(g.trafficHours(), true); }
                g.chapterIdx = idx; g.ch = ch; g.chapter = ch.id; g.chapterDone = !!(st && st.chapterIdx === idx && st.chapterDone);
                g.progress.reached.add(ch.id); saveProgress(g.progress); g.renderMenuChapters?.();
                g.navManual = false; g.updateObjective();
                if (g.state === 'foot' && g.foot?.active && g.objective) g.nav.setDestination({ x: g.objective.doorX ?? g.objective.x, z: g.objective.doorZ ?? g.objective.z, label: g.objectivePlain }, { x: g.foot.x, z: g.foot.z, heading: g.foot.heading });
                toast(`📖 Story · ${ch.year} · ${ch.title}`, g.chapterDone ? 'Chapter done: free drive here, M → next chapter.' : `${ch.intro || ''}`);
            } else {
                const st = story; story = null;
                if (st && (g.weatherOverride ?? null) !== st.weather) g.setWeatherOverride?.(st.weather);
                await transition({ fromCity: g.city?.id, toCity: ch.city, from: g.district, to: ch.district, title: ch.title, caption: ch.intro, kicker: `Story · ${ch.year}` });
                await g.enterChapter(idx);
            }
            window.cvTelemetry?.track?.('explore_exit', { chapter: ch.id });
            return true;
        } finally { busy = false; renderBar(); }
    }

    // ------------------------------------------------------------------ transitions + jumps
    /** the montage map (same city) or the flight (other city) — the game's own cutscenes */
    async function transition({ fromCity, toCity, from, to, fromItem = null, toItem = null, title = '', caption = '', kicker = 'Explore' }) {
        const g = game, prev = g.state;
        g.photo?.close?.(); g.state = 'montage'; g.input.lookAllowed = false; g.input.releaseLock(); g.hud.prompt(null); g.hud.setNavLine?.(''); g.audio.stopEngine?.();
        try {
            if (fromCity && toCity && fromCity !== toCity) await g.flightCutscene(fromCity);
            else if (toCity) {
                const districts = { ...(CITIES[toCity]?.districts || {}) };
                const pseudo = (it) => ({ name: it.name, center: { lat: it.lat, lon: it.lon }, bbox: [it.lat - 0.0022, it.lon - 0.003, it.lat + 0.0022, it.lon + 0.003] });
                if (toItem?.kind === 'spot') districts[to] = pseudo(toItem);
                if (fromItem?.kind === 'spot' && fromItem.lat != null) districts[from] = pseudo(fromItem);
                const region = toItem?.region || (to === 'bellevue' ? 'bellevue' : null);
                await chapterMontage({ cityName: region === 'bellevue' ? 'Bellevue' : CITIES[toCity]?.name, districts, from: from && districts[from] ? from : null, to, year0: '', title, caption: String(caption || '').split(/(?<=\.)\s/)[0], kicker, duration: 2400 });
            }
        } catch (e) { console.warn('[explore] transition', e); }
        if (g.state === 'montage') g.state = prev;
    }
    function warp(fn) {
        let el = $('#explore-warp'); if (!el) { el = document.createElement('div'); el.id = 'explore-warp'; document.body.appendChild(el); }
        el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
        return new Promise((res) => setTimeout(() => { try { fn(); } catch (e) { console.warn('[explore] warp', e); } res(); }, 200));
    }
    function pushRecent(key) { const r = (load().recent || []).filter((k) => k !== key); r.unshift(key); save({ recent: r.slice(0, 8) }); }
    function scheduleThumb(key) { thumbDue = { key, at: performance.now() + 1600 }; }
    /** one click on a hub pin / list row */
    async function jump(it) {
        if (typeof it === 'string') it = items().find((i) => i.key === it || i.id === it);
        if (!it || busy || game._transit || game._spotBusy) return false;
        busy = true;
        try {
            await game.loadSpotsModule?.();
            drone.abort(); map.close();
            if (game._pauseOpen) game.togglePause(false);
            if (game.condOpen) game.toggleConditions(false);
            setActive(true);
            game.audio?.init?.(); game.audio?.resume?.();
            if (game.state === 'office') game.leaveOffice?.();
            const cur = currentPlace(), curItem = cur.key ? items().find((i) => i.key === cur.key) : null;
            pushRecent(it.key);
            const fr = game.freeRoam || {}, opts = { tod: fr.tod || 'now', weather: fr.weather || 'live' };
            if (it.kind === 'spot') {
                if (game.state === 'spot' && game.spot?.spot?.spawns?.[it.id]) { // same scene: walk over (Space Needle ⇄ Chihuly ⇄ MoPOP)
                    await warp(() => { game.spot.teleport(it.id); game.spotId = it.id; game.spotEntry = game.spotsMod?.SPOTS?.find((s) => s.id === it.id) || game.spotEntry; });
                } else {
                    if (game.state !== 'menu') await transition({ fromCity: cur.city, toCity: it.city, from: cur.mapKey, to: 'spot:' + it.id, fromItem: curItem, toItem: it, title: it.name, caption: it.blurb });
                    await game.enterSpot(it.id);
                }
            } else if (game.state === 'spot') {
                const R = game.spotReturn, back = game.world && R && ['drive', 'foot'].includes(R.state) && game.district === it.id;
                await transition({ fromCity: cur.city, toCity: it.city, from: cur.mapKey, to: it.id, fromItem: curItem, toItem: it, title: it.name, caption: it.sub });
                jumping = true; try { game.leaveSpot(); } finally { jumping = false; }
                if (back) makeRoam(); else await game.startFreeRoam(it.id, opts);
            } else if (game.state === 'menu') {
                await game.startFreeRoam(it.id, opts);
            } else if (game.district === it.id && game.world) {
                makeRoam(); toast(`🧭 ${it.name}`, 'You are already here.');
            } else {
                makeRoam();
                await transition({ fromCity: cur.city, toCity: it.city, from: cur.mapKey, to: it.id, toItem: it, title: it.name, caption: it.sub });
                await game.startFreeRoam(it.id, { tod: (game.freeRoam || fr).tod || 'now', weather: (game.freeRoam || fr).weather || 'live' });
            }
            setActive(true);
            scheduleThumb(it.key);
            window.cvTelemetry?.track?.('worldmap_jump', { to: it.key, from: cur.key });
            return true;
        } catch (e) { console.error('[explore] jump', e); return false; }
        finally { busy = false; }
    }
    /** "Here" tab: click a point → fast travel inside the current district / spot (Explore) */
    async function fastTravelTo(x, z, pin = null) {
        if (!api.active) return false;
        drone.abort();
        return footTravel(x, z, pin);
    }
    /** move the player there (drive: lane pose; on foot: sidewalk / free ground; spot: dry free ground). strict (drone
     *  "Go here"): only walkable ground of the loaded district / spot — a street within 60 m in a district (the street
     *  graph ends at the closures), dry land inside the spot's terrain in a spot; never inside a building. → {x, z} | null */
    async function footTravel(x, z, pin = null, { strict = false } = {}) {
        const g = game;
        if (g.state === 'spot' && g.spot) {
            const sp = g.spot.spot;
            if (pin?.id && sp.spawns?.[pin.id]) { await warp(() => { g.spot.teleport(pin.id); g.spotId = pin.id; g.spotEntry = g.spotsMod?.SPOTS?.find((s) => s.id === pin.id) || g.spotEntry; }); return true; }
            const dry = sp.ground?.nearestDry?.(x, z) || { x, z };
            if (strict) { const b = sp.ctx?.extras?.terrainBox; if (Math.hypot(dry.x - x, dry.z - z) > 40 || (b && (dry.x < b.x0 || dry.x > b.x1 || dry.z < b.z0 || dry.z > b.z1))) return null; }
            const free = freeSpot(sp.colliders, dry.x, dry.z, (px, pz) => sp.ground?.heightAt?.(px, pz) ?? 0);
            if (strict && free.bad) return null;
            await warp(() => g.spot.ctl.teleport(free.x, free.z, g.spot.ctl.heading));
            return { x: free.x, z: free.z };
        }
        if (!g.world || !['drive', 'foot'].includes(g.state)) return strict ? null : false;
        if (g.state === 'drive') {
            const P = g.player, pose = g.lanePose?.(x, z, P.heading);
            if (!pose) { toast('🧭 No road there', 'Pick a point on a street.', 'warn'); return false; }
            await warp(() => {
                P.place(pose.x, pose.z, pose.heading, pose.edge); P.speed = 0; P.steer = 0; P.contactAge = 9;
                g.stuckT = 0; g.prevEdgeInfo = null; g.traffic.setPlayer(P); g.traffic.clearForPlayer?.(P) ?? g.traffic.clearAround(pose.x, pose.z, 12);
                for (const c of g.cameras || []) c.lastD = 1e9;
            });
            return true;
        }
        // on foot: offices → their door; else the nearest sidewalk when close to a street, never inside a building
        let tx = x, tz = z;
        if (!pin?.office) {
            const ne = g.nav?.index?.nearest(x, z, 60);
            if (strict && !ne) return null;
            if (ne && (strict || ne.d < (ne.edge.halfW ?? 4) + 10)) { const e = ne.edge, sd = (x - ne.cx) * e.nx + (z - ne.cz) * e.nz >= 0 ? 1 : -1, off = (e.halfW ?? 4) + 1.5; tx = ne.cx + e.nx * sd * off; tz = ne.cz + e.nz * sd * off; }
        }
        const free = freeSpot(g.world.buildings, tx, tz);
        if (strict && (free.bad || g.world.isWater?.(free.x, free.z))) return null;
        await warp(() => g.foot.teleport(free.x, free.z));
        return { x: free.x, z: free.z };
    }
    function freeSpot(C, x, z, hAt = null) {
        const hit = (px, pz) => { try { return !!collideBuildings(C, px, pz, 0.45, hAt ? hAt(px, pz) + 0.2 : 0.4); } catch { return false; } };
        if (!C || !hit(x, z)) return { x, z };
        for (let r = 1; r <= 40; r += 1) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!hit(px, pz)) return { x: px, z: pz }; }
        return { x, z, bad: true };
    }
    async function openWorldMap(tab = null, { startMode = false } = {}) {
        await game.loadSpotsModule?.();
        if (game._pauseOpen) game.togglePause(false);
        if (game.mapOpen) game.toggleMap(false);
        if (game.condOpen) game.toggleConditions(false);
        if (game.photo?.active) game.photo.close();
        game.input.releaseLock?.(); game.input.lookAllowed = false; game.input.flush?.();
        map.open({ tab, startMode });
    }

    // ------------------------------------------------------------------ hooks the Game calls (main.js: `this.explore?.hooks?.<name>?.(…)`)
    // (explore no longer wraps Game methods: main.js renders the pause items (worldmap / drone / drone-land /
    //  explore-mode), sends M to the hub while exploring, and uses the Explore wording itself)
    api.hooks = {
        /** before any place-changing action (enterSpot, loadCity, fastTravel, enterOffice, toMainMenu, leaveSpot, startFreeRoam, pause actions) */
        abortDrone: () => drone.abort(),
        /** leaving a spot entered from the menu while exploring: back to the hub, not the title menu; in a district: stay in Explore */
        afterLeaveSpot: () => { if (!jumping && api.active) { if (game.state === 'menu') setTimeout(() => openWorldMap(null, { startMode: true }), 50); else if (['drive', 'foot'].includes(game.state)) makeRoam(); } },
        /** any chapter entry is Story */
        beforeChapter: () => { drone.abort(); if (api.active) setActive(false); story = null; },
        /** any free-roam start is Explore (note 76) */
        afterFreeRoam: (districtId) => { setActive(true); if (!thumbDue) scheduleThumb('district:' + districtId); },
        /** after the game's photo bookkeeping: drone photos are flagged */
        onPhoto: () => { if (drone.active) { drone.onPhoto(); if (game.lastPhoto) game.lastPhoto.drone = true; } },
        /** the frame loop, before the game's own update: true = this frame was the drone's / the hub's (over a frozen scene) */
        frame: () => {
            const g = game;
            if (drone.active && !g._pauseOpen && !map.isOpen) {
                const dt = Math.min(0.25, g.frameClock.getDelta());
                try { drone.frame(dt); } catch (e) { console.error('[drone] frame', e); drone.abort(); }
                return true;
            }
            if (map.isOpen && !g._pauseOpen && ['drive', 'foot', 'spot'].includes(g.state)) {
                g.frameClock.getDelta(); g.input.flush();
                if (g.state === 'spot') g.r3d.frame(); else if (g.scene) g.drawFrame();
                return true;
            }
            return false;
        },
        /** after the game's frame: hub thumbnails */
        afterFrame: () => { if (thumbDue && performance.now() > thumbDue.at) captureThumb(); },
    };
    function captureThumb() {
        const g = game, k = thumbDue?.key;
        if (!k || !['drive', 'foot', 'spot'].includes(g.state) || g._pauseOpen || map.isOpen || g.photo?.active || g.hud?.panelOpen || $('#loading.show')) return;
        if (currentPlace().key !== k && !(k.startsWith('spot:') && g.state === 'spot')) { thumbDue = null; return; }
        thumbDue = null;
        try {
            const src = g.renderer.domElement, W = 192, H = 108, c = document.createElement('canvas'); c.width = W; c.height = H;
            const sw = src.width, sh = src.height, k2 = Math.min(sw / W, sh / H), cw = W * k2, ch = H * k2;
            c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2 * 0.7, cw, ch, 0, 0, W, H);
            const url = c.toDataURL('image/jpeg', 0.62);
            if (url.length > 2000) { const th = load().thumbs || {}; th[k] = url; save({ thumbs: th }); }
        } catch (e) { console.warn('[explore] thumb', e); }
    }

    // ------------------------------------------------------------------ keys (capture: before the game's Input)
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const typing = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
        const stop = () => { e.preventDefault(); e.stopPropagation(); };
        if (map.isOpen) { if (e.code === 'Escape' || (e.code === 'KeyM' && !typing)) { stop(); map.close(); } return; }
        if (typing || game.photo?.active || game._pauseOpen || game.hud?.panelOpen || game.condOpen || game.mapOpen) return;
        const st = game.state; if (!['drive', 'foot', 'spot'].includes(st) || (st === 'spot' && game.spot?.ui?.panelOpen)) return;
        if (drone.active) {
            if (e.code === 'KeyG') { stop(); drone.land(); }
            else if (e.code === 'KeyX') { stop(); drone.land(); }
            else if (e.code === 'KeyT') { stop(); drone.goHere(); }
            else if (/^Digit[1-3]$/.test(e.code)) { stop(); drone.setMode(+e.code.slice(5) - 1); }
            else if (e.code === 'KeyM') { stop(); openWorldMap(); }
            return;
        }
        if (e.code === 'KeyG' && (st === 'foot' || st === 'spot')) { stop(); api.deployDrone(); }
        else if (e.code === 'KeyM' && api.active) { stop(); openWorldMap(); }
    }, true);
    { let wt = 0; window.addEventListener('wheel', (e) => { if (!drone.flying || game.photo?.active || game._pauseOpen || map.isOpen) return; const n = performance.now(); if (n - wt < 220) return; wt = n; drone.cycleMode(e.deltaY < 0 ? 1 : -1); }, { passive: true }); }

    // ------------------------------------------------------------------ HUD bar (🌍 map · 🚁 drone) + main-menu entry
    const bar = document.createElement('div'); bar.id = 'explore-bar';
    bar.innerHTML = '<button data-x="map" title="World map (M)">🌍</button><button data-x="drone" title="Deploy drone (G)">🚁</button>';
    bar.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; e.preventDefault(); b.blur(); if (b.dataset.x === 'map') openWorldMap(); else if (drone.active) drone.land(); else api.deployDrone(); });
    document.body.appendChild(bar);
    function renderBar() { bar.classList.toggle('show-map', api.active); }
    // (the title-menu entry #explore-start is in index.html; main.js calls game.explore.enterExplore())

    // ------------------------------------------------------------------ API
    Object.assign(api, {
        enterExplore, exitExplore, jump, fastTravelTo,
        openWorldMap: (tab = null) => openWorldMap(tab),
        closeWorldMap: () => map.close(),
        deployDrone: () => { if (!['foot', 'spot'].includes(game.state)) { toast('🚁 Drone', game.state === 'drive' ? 'Get out of the car first (Enter), then G.' : 'Only on foot, outdoors.', 'warn'); return false; } return drone.deploy(); },
        landDrone: () => drone.land(),
        items, here: () => here(), current: () => currentPlace(),
        stats: () => ({ ...(load().drone || {}), recent: load().recent || [] }),
    });
    renderBar();
    return api;
}
