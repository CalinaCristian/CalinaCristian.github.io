/*
 * Game telemetry: observes window.game from the outside (no hooks inside the game code), so it keeps
 * working when gameplay code is refactored. Sends through window.cvTelemetry (public/telemetry.js),
 * which is a no-op unless analytics is enabled (production host, no DNT, not a bot/headless browser).
 *
 * Events: game_menu_view, game_start, world_loaded, stop_visited, office_enter, office_screen_read,
 * flight_taken, seattle_arrived, finale_reached, fast_travel, map_opened, refuel, fine, reset_used,
 * headlights_toggle, achievement, weather_source, stuck_detected, context_lost, perf_summary, game_exit.
 * No personal data; positions are rounded to 50 m and only sent with stuck reports.
 */
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

function percentile(arr, p) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function start(game) {
    const prev = { state: game.state, city: null, visited: 0, read: 0, mapOpen: false, fast: 0, fines: 0, fuelL: 0, achv: 0, headlights: game.headlights, quality: null };
    const perf = { fps: [], calls: [], tierChanges: 0, lastTier: null };
    let gpu = null, cityLoadStart = null, stuckFor = 0, stuckReports = 0, finaleSent = false, started = false;

    track('game_menu_view', { dpr: window.devicePixelRatio, mobile: !!game.touch });

    // wrap a few user actions if the methods exist (safe if they are renamed)
    const wrap = (name, fn) => {
        const orig = game[name];
        if (typeof orig !== 'function') return;
        game[name] = function (...args) { try { fn(...args); } catch (_) { /* ignore */ } return orig.apply(this, args); };
    };
    wrap('resetToRoad', (opts) => { if (!opts?.silent) track('reset_used', { city: game.city?.id }); });

    const canvas = game.renderer?.domElement;
    canvas?.addEventListener('webglcontextlost', () => track('context_lost', { city: game.city?.id, minutes: minutes() }));

    function sendPerf(final) {
        if (!perf.fps.length) return;
        const avg = perf.fps.reduce((a, b) => a + b, 0) / perf.fps.length;
        const props = {
            city: game.city?.id, avg_fps: Math.round(avg), p5_fps: percentile(perf.fps, 0.05), min_fps: Math.min(...perf.fps),
            samples: perf.fps.length, tier: game.r3d?.stats?.quality, tier_changes: perf.tierChanges,
            avg_draw_calls: perf.calls.length ? Math.round(perf.calls.reduce((a, b) => a + b, 0) / perf.calls.length) : null,
            dpr: window.devicePixelRatio, viewport: `${innerWidth}x${innerHeight}`, mobile: !!game.touch, ...(gpu || {}),
        };
        (final ? beacon : track)('perf_summary', props);
        perf.fps.length = 0; perf.calls.length = 0; perf.tierChanges = 0;
    }

    setInterval(() => {
        if (document.hidden) return;
        const st = game.state, city = game.city?.id;

        // start + world loads
        if (!started && st !== 'menu') {
            started = true; cityLoadStart = performance.now();
            const q = (id) => document.getElementById(id)?.value;
            track('game_start', { quality: q('quality') || game.quality, time_of_day: q('timeofday') || 'real', weather: q('weather') || 'real' });
        }
        if (st === 'drive' && city && city !== prev.city) {
            if (!gpu && game.renderer) gpu = gpuInfo(game.renderer);
            track('world_loaded', { city, load_ms: cityLoadStart ? Math.round(performance.now() - cityLoadStart) : null, ...(gpu || {}) });
            if (city === 'seattle') track('seattle_arrived', { minutes: minutes() });
            const w = game.r3d?.weather;
            if (w) track('weather_source', { city, source: w.source, label: w.label, season: w.season });
            prev.city = city; cityLoadStart = null;
        }
        if (prev.state !== 'flight' && st === 'flight') { track('flight_taken', { from: city, minutes: minutes() }); cityLoadStart = performance.now(); }

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

        // performance samples while driving
        const rs = game.r3d?.stats;
        if (st === 'drive' && rs) {
            if (rs.fps) perf.fps.push(rs.fps);
            if (rs.drawCalls) perf.calls.push(rs.drawCalls);
            if (perf.lastTier && rs.quality !== perf.lastTier) perf.tierChanges++;
            perf.lastTier = rs.quality;
        }

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
