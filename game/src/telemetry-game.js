/*
 * Game telemetry: observes window.game from the outside (no hooks inside the game code), so it keeps
 * working when gameplay code is refactored. Sends through window.cvTelemetry (public/telemetry.js),
 * which is a no-op unless analytics is enabled (production host, no DNT, not a bot/headless browser).
 *
 * Events: game_menu_view, game_start, world_loaded, stop_visited, office_enter, office_screen_read,
 * flight_taken, seattle_arrived, finale_reached, fast_travel, map_opened, refuel, fine, reset_used,
 * headlights_toggle, achievement, weather_source, stuck_detected, context_lost, perf_summary, game_exit;
 * chapters / on foot / photo / tourist spots (spec 21): chapter_start, chapter_complete, chapter_select, free_drive,
 * boundary_hit, on_foot, photo_taken, spot_enter, spot_leave, spot_plaque, spot_challenge; free roam: free_roam_start;
 * achievements.js sends completion_milestone {pct: 25|50|75|100}.
 * No personal data; positions are rounded to 50 m and only sent with stuck reports. The new events are coarse:
 * ids from fixed lists (chapter / district / spot ids, filter names, counts, minutes), never free text or coordinates.
 * Events that other modules send themselves (photo.js photo_taken, spots/* spot_*) pass through `coarse()` below,
 * which drops their free-text props (place names, plaque titles) and renames them to the documented events.
 */
import { GameHealth } from './telemetry-health.js';
const T = () => window.cvTelemetry;
const track = (e, p) => { try { T()?.track(e, p); } catch (_) { /* never break the game */ } };
const beacon = (e, p) => { try { T()?.trackBeacon(e, p); } catch (_) { /* ignore */ } };

const t0 = performance.now();
const minutes = () => Math.round((performance.now() - t0) / 6000) / 10;
const round50 = (v) => Math.round(v / 50) * 50;

function gpuInfo(renderer) {
    try {
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 120) : 'unknown',
            gpu_vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)).slice(0, 60) : 'unknown',
            webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
        };
    } catch (_) { return { gpu: 'unknown' }; }
}

/** rewrite events sent directly by other modules into the documented, coarse shape (null = drop) */
function coarseRules(game) {
    const where = () => ({ city: game.city?.id || null, district: game.district || null });
    return {
        photo_taken: (p) => ['photo_taken', { ...(game.state === 'spot' ? { city: game.spotEntry?.city || p.city || null, spot: game.spotId || null } : where()), mode: game.state, filter: typeof p.filter === 'string' ? p.filter : null }],
        spot_enter: (p) => ['spot_enter', { id: p.id || game.spotId || null, city: p.city || game.spotEntry?.city || null, from: game.spotReturn?.state || 'menu' }],
        spot_exit: (p) => ['spot_leave', { id: p.id || null, seconds: Number.isFinite(p.seconds) ? p.seconds : null }],
        spot_plaque: (p) => { const list = game.spot?.spot?.plaques || []; const i = list.findIndex(x => x?.title === p.title); return ['spot_plaque', { id: p.id || game.spotId || null, plaque: i >= 0 ? i : null }]; },
        spot_postcard: (p) => ['spot_challenge', { id: p.id || null, first: !!p.first }],
    };
}
function installCoarseFilter(game, tries = 0) {
    const api = T();
    if (!api) { if (tries < 50) setTimeout(() => installCoarseFilter(game, tries + 1), 200); return; }
    if (api._coarse) return; api._coarse = true;
    const raw = api.track, rules = coarseRules(game);
    api.track = function (event, props, options) {
        const r = rules[event];
        if (r) { let out = null; try { out = r(props || {}); } catch (_) { out = null; } if (!out) return; return raw.call(this, out[0], out[1], options); }
        return raw.call(this, event, props, options);
    };
}

function start(game) {
    installCoarseFilter(game);
    const prev = { state: game.state, city: null, visited: 0, read: 0, mapOpen: false, fast: 0, fines: 0, fuelL: 0, achv: 0, headlights: game.headlights, quality: null };
    let gpu = null, stuckFor = 0, stuckReports = 0, finaleSent = false, started = false;
    const health = game.health = new GameHealth(game, { gpu: () => gpu || {} });

    track('game_menu_view', { dpr: window.devicePixelRatio, mobile: !!game.touch });

    // wrap a few user actions if the methods exist (safe if they are renamed)
    const wrap = (name, fn) => {
        const orig = game[name];
        if (typeof orig !== 'function') return;
        game[name] = function (...args) { try { fn(...args); } catch (_) { /* ignore */ } return orig.apply(this, args); };
    };
    wrap('resetToRoad', (opts) => { if (!opts?.silent) track('reset_used', { city: game.city?.id }); });
    // call-through wrapper that sees the result (sync or a promise)
    const wrapAfter = (name, fn) => {
        const orig = game[name];
        if (typeof orig !== 'function') return;
        game[name] = function (...args) {
            const r = orig.apply(this, args);
            try { if (r && typeof r.then === 'function') r.then((v) => { try { fn(v, ...args); } catch (_) { /* ignore */ } }, () => { }); else fn(r, ...args); } catch (_) { /* ignore */ }
            return r;
        };
    };
    // world loads: time loadCity itself (the city / district build), not the menu, the world map, a chapter card or the
    // flight cutscene around it; world_loaded is sent on the next tick in drive / foot, so it still follows game_start
    let loadT = 0, loadMs = null, loads = 0;
    wrap('loadCity', () => { loadT = performance.now(); });
    wrapAfter('loadCity', () => { if (loadT) loadMs = Math.round(performance.now() - loadT); loadT = 0; });
    // chapters (spec 10)
    const chap = { id: null, t: 0, done: false, replay: false };
    wrapAfter('enterChapter', (ok, idx) => {
        const ch = game.chapters?.[idx]; if (!ok || !ch) return;
        chap.id = ch.id; chap.t = performance.now(); chap.done = false; chap.replay = !!game.progress?.done?.has?.(ch.id);
        track('chapter_start', { id: ch.id, n: idx + 1, district: ch.district, city: ch.city, replay: chap.replay, minutes: minutes() });
    });
    wrapAfter('chainChapter', (ok, idx) => {
        const ch = game.chapters?.[idx]; if (!ok || !ch) return;
        chap.id = ch.id; chap.t = performance.now(); chap.done = false; chap.replay = !!game.progress?.done?.has?.(ch.id);
        track('chapter_start', { id: ch.id, n: idx + 1, district: ch.district, city: ch.city, replay: chap.replay, minutes: minutes(), chained: true });
    });
    wrap('start', (idx) => { if (idx != null && game.chapters?.[idx]) track('chapter_select', { id: game.chapters[idx].id, source: 'menu' }); });
    document.getElementById('navlist')?.addEventListener('click', (e) => {
        const b = e.target.closest?.('[data-chapter]'); const ch = b && game.chapters?.[+b.dataset.chapter];
        if (ch) track('chapter_select', { id: ch.id, source: ch === game.chapters[game.chapterIdx + 1] && game.chapterDone ? 'next' : 'map' });
    }, true);
    // free roam (R10.10): district + time-of-day / weather picks (ids from fixed lists)
    wrapAfter('startFreeRoam', (ok, district, o) => { if (ok) track('free_roam_start', { district: district || null, tod: o?.tod || 'now', weather: o?.weather || 'live' }); });
    // illegal parking (note 8): coarse event types and reason ids only
    wrap('onParkingEvent', (ev) => { if (ev && ['illegal', 'ticket', 'clamp', 'tow', 'cleared'].includes(ev.type)) track('parking_event', { type: ev.type, reason: typeof ev.reason === 'string' ? ev.reason.slice(0, 32) : null, city: ev.city || null, district: ev.district || null }); });
    // district edge closures: the approach toast (R10.9)
    let boundaryHits = 0;
    wrap('closureText', (c) => { if (boundaryHits++ < 20) track('boundary_hit', { district: game.district || null, kind: c?.kind || null, leads_to: c?.leadsTo || null, chapter: game.chapter || null }); });
    // on foot (spec 14)
    let footT = 0;
    wrapAfter('exitCar', (ok) => { if (ok) { footT = performance.now(); track('on_foot', { action: 'enter', district: game.district || null, city: game.city?.id || null }); } });
    wrap('enterCar', () => { track('on_foot', { action: 'exit', seconds: footT ? Math.round((performance.now() - footT) / 1000) : null, district: game.district || null }); footT = 0; });

    function sendPerf(final) {
        health.flush(final);
    }

    setInterval(() => {
        if (document.hidden) return;
        health.tick();
        const st = game.state, city = game.city?.id;

        // start + world loads
        if (!started && st !== 'menu') {
            started = true;
            const q = (id) => document.getElementById(id)?.value;
            track('game_start', { quality: q('quality') || game.quality, time_of_day: q('timeofday') || 'real', weather: q('weather') || 'real', entry: st === 'spot' || st === 'loading' ? 'spot' : 'story' });
        }
        if ((st === 'drive' || st === 'foot') && city && loadMs != null) {
            if (!gpu && game.renderer) gpu = gpuInfo(game.renderer);
            track('world_loaded', { city, district: game.district || null, load_ms: loadMs, first: loads++ === 0, ...(gpu || {}) });
            loadMs = null;
        }
        if (st === 'drive' && city && city !== prev.city) {
            if (city === 'seattle') track('seattle_arrived', { minutes: minutes() });
            const w = game.r3d?.weather;
            if (w) track('weather_source', { city, source: w.source, label: w.label, season: w.season });
            prev.city = city;
        }
        if (prev.state !== 'flight' && st === 'flight') track('flight_taken', { from: city, minutes: minutes() });

        // story progress
        const visited = game.visited ? [...game.visited] : [];
        if (visited.length > prev.visited) {
            for (const id of visited.slice(prev.visited)) track('stop_visited', { id, n: visited.length, minutes: minutes() });
            prev.visited = visited.length;
        }
        if (prev.state !== 'office' && st === 'office') { track('office_enter', { stop: game.office?.stop?.id }); prev.read = 0; }
        if (st === 'office' && game.office?.read && game.office.read.size > prev.read) {
            const titles = game.office.stations?.map(s => s.data?.title) || [];
            for (const i of [...game.office.read].slice(prev.read)) track('office_screen_read', { stop: game.office.stop?.id, screen: titles[i] || i });
            prev.read = game.office.read.size;
        }
        if (!finaleSent && game.visited?.has?.('uipath-bel')) {
            finaleSent = true;
            const s = game.stats || {};
            track('finale_reached', { minutes: minutes(), stops: visited.length, fast_travels: s.fastTravels, fines: s.fineCount, honks: game.honks, km: s.dist ? Math.round(s.dist / 100) / 10 : null });
        }

        // chapter completion + "free drive here" on the card
        if (chap.id && game.chapter === chap.id && game.chapterDone && !chap.done) {
            chap.done = true;
            track('chapter_complete', { id: chap.id, district: game.district || null, minutes: Math.round((performance.now() - chap.t) / 6000) / 10, replay: chap.replay, fast_travels: game.stats?.fastTravels ?? null });
        }
        if (prev.state === 'card' && (st === 'drive' || st === 'foot') && game.chapterDone) track('free_drive', { chapter: game.chapter || null, district: game.district || null });

        // feature usage
        if (game.mapOpen && !prev.mapOpen) track('map_opened', { city });
        prev.mapOpen = !!game.mapOpen;
        const s = game.stats || {};
        if ((s.fastTravels || 0) > prev.fast) { track('fast_travel', { city, count: s.fastTravels }); prev.fast = s.fastTravels; }
        if ((s.fineCount || 0) > prev.fines) { track('fine', { city, count: s.fineCount }); prev.fines = s.fineCount; }
        if ((s.fuelL || 0) > prev.fuelL + 1) { track('refuel', { city, liters: Math.round(s.fuelL - prev.fuelL) }); prev.fuelL = s.fuelL; }
        if (game.headlights !== prev.headlights) { track('headlights_toggle', { to: String(game.headlights) }); prev.headlights = game.headlights; }
        const ach = game.hud?.unlocked ? [...game.hud.unlocked] : [];
        if (ach.length > prev.achv) { for (const id of ach.slice(prev.achv)) track('achievement', { id }); prev.achv = ach.length; }

        // stuck with throttle but (apparently) nothing in front: helps find invisible-collision spots
        const p = game.player, inp = game.input;
        if (st === 'drive' && p && inp && Math.abs(p.speed) < 0.5 && Math.abs(inp.throttle) > 0.5) stuckFor++;
        else stuckFor = 0;
        if (stuckFor === 3 && stuckReports < 5) {
            stuckReports++;
            const ne = game.world?.nearestEdge?.(p.x, p.z);
            const lc = game.debug?.lastCollider;
            track('stuck_detected', { city, street: ne?.edge?.name || null, x: round50(p.x), z: round50(p.z), collider: lc?.type || null });
        }
        prev.state = st;
    }, 1000);

    setInterval(() => sendPerf(false), 60000);
    addEventListener('pagehide', () => {
        sendPerf(true);
        beacon('game_exit', { state: game.state, city: game.city?.id, stops: game.visited?.size || 0, minutes: minutes() });
    }, { once: true });
}

// wait for the game object, then start observing
(function waitForGame(tries = 0) {
    if (window.game) start(window.game);
    else if (tries < 100) setTimeout(() => waitForGame(tries + 1), 100);
})();
