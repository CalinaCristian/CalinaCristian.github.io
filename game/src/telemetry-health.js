// Bounded diagnostics only. No visitor identity, input text, photographs or precise positions are recorded.
const KEY = 'dmcv.health.pending.v2', TTL = 15 * 60 * 1000;
const ACTIVE = new Set(['drive', 'foot', 'office', 'spot']);
export function readPending(storage, now = Date.now()) {
    try {
        const value = JSON.parse(storage.getItem(KEY) || 'null');
        if (value?.v !== 2 || !Number.isFinite(value.updated) || now - value.updated > TTL || value.updated > now + 60000) return null;
        return value;
    } catch { return null; }
}
export function frameSummary(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b), sum = values.reduce((a, b) => a + b, 0);
    const at = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return { avg_fps: Math.round(values.length * 1000 / Math.max(1, sum)), p5_fps: Math.round(1000 / Math.max(1, at(.95))), min_fps: Math.round(1000 / Math.max(1, sorted.at(-1))), frame_p95_ms: +at(.95).toFixed(1), frame_p99_ms: +at(.99).toFixed(1), max_frame_ms: +sorted.at(-1).toFixed(1) };
}
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const safe = fn => { try { return fn(); } catch { return undefined; } };

export class GameHealth {
    constructor(game, { gpu = () => ({}) } = {}) {
        this.g = game; this.gpu = gpu; this.frames = []; this.resources = []; this.frameCount = 0;
        this.budgetFrames = 0; this.longFrames = 0; this.longest = 0; this.lastFrame = 0; this.contextKey = null;
        this.summaryAt = performance.now(); this.loadIndex = 0; this.actionCount = 0; this.anomalyCount = 0;
        this.context = null; this.pending = null; this.awaitingFrame = null; this.lastHeartbeat = 0; this.conditions = {};
        this.enabled = () => !!window.cvTelemetry && window.cvTelemetry.enabled !== false && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;
        this.send = (event, props, final = false) => {
            if (!this.enabled()) return;
            const t = window.cvTelemetry;
            safe(() => (final ? t?.trackBeacon : t?.track)?.call(t, event, { ...this.currentContext(), ...props }));
        };
        if (window.cvTelemetry) window.cvTelemetry.contextProvider = () => this.currentContext();
        if (this.enabled()) {
            const previous = safe(() => readPending(sessionStorage));
            this.recoveryExpected = previous?.stage === 'failed';
            if (previous && !previous.ended && (previous.loading || previous.awaiting_frame || previous.contextLost)) {
                this.recoveryExpected = true;
                this.send('load_interrupted', { attempt_id: previous.attempt, destination: previous.destination, prior_stage: previous.stage, age_ms: Date.now() - previous.updated, context_lost: !!previous.contextLost, navigation_type: performance.getEntriesByType('navigation')[0]?.type || 'unknown', confirmed_crash: false });
            }
            safe(() => sessionStorage.removeItem(KEY));
        }
        this.wrapLoads(); this.wrapRendering(); this.bindActions();
        this.modeObserver = new MutationObserver(() => this.syncContext());
        this.modeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        game.renderer?.domElement?.addEventListener('webglcontextlost', () => {
            this.write({ contextLost: true }); this.send('context_lost', { ...this.resourceCounts(), attempt_id: this.pending?.id || null });
        });
        game.renderer?.domElement?.addEventListener('webglcontextrestored', () => this.send('context_restored', this.resourceCounts()));
        addEventListener('pagehide', () => { this.flush(true); this.write({ ended: true }); }, { once: true });
        document.addEventListener('visibilitychange', () => { this.lastFrame = 0; if (document.hidden) this.flush(true); });
        const supported = globalThis.PerformanceObserver?.supportedEntryTypes || [];
        if (this.enabled()) this.send('diagnostics_ready', { long_tasks_supported: supported.includes('longtask'), storage_available: this.storageAvailable(), sampled_frame_times: true });
        if (this.enabled() && supported.includes('longtask')) safe(() => {
            this.longTaskObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) { this.longTasks = (this.longTasks || 0) + 1; this.longTaskMax = Math.max(this.longTaskMax || 0, entry.duration); }
            });
            this.longTaskObserver.observe({ type: 'longtask', buffered: false });
        });
    }
    storageAvailable() {
        return !!safe(() => { const k = KEY + '.probe'; sessionStorage.setItem(k, '1'); sessionStorage.removeItem(k); return true; });
    }
    currentContext() {
        const g = this.g, rs = g.r3d?.stats, mode = this.pending ? 'loading' : g.explore?.drone?.active ? 'drone' : g.photo?.active ? 'photo' : g._pauseOpen ? 'pause' : g.mapOpen || document.body.classList.contains('wm-open') ? 'map' : g.condOpen ? 'conditions' : g.achievements?.isOpen ? 'achievements' : g.hud?.panelOpen ? g.office?.talking ? 'dialogue' : 'panel' : g.spot?.ui?.panelOpen ? 'spot_panel' : g._controlsModal ? 'ui' : g.state || 'unknown';
        return { ...this.conditions, game_mode: mode, city: g.state === 'spot' ? g.spotEntry?.city || null : g.city?.id || null, district: g.district || null, spot_id: g.spotId || null, scene_id: g.spotEntry?.scene || null, chapter: g.chapter || null, play_mode: g.freeRoam ? 'free_roam' : 'story', quality_setting: g.quality || null, quality_tier: rs?.quality || null, render_pixel_ratio: rs?.pixelRatio ?? null, weather_kind: g.wxKind || g.r3d?.weather?.kind || null, season: g.r3d?._seasonOverride || g.r3d?.weather?.season || null };
    }
    resourceCounts() {
        const r = this.g.renderer, memory = r?.info?.memory || {}, c = r?.domElement;
        return { textures: memory.textures ?? null, geometries: memory.geometries ?? null, programs: r?.info?.programs?.length ?? null, buffer_width: c?.width ?? null, buffer_height: c?.height ?? null, dpr: devicePixelRatio, mobile: !!this.g.touch };
    }
    syncContext() {
        const context = this.currentContext(), key = JSON.stringify(context);
        if (key !== this.contextKey) { this.flush(); this.context = context; this.contextKey = key; this.lastFrame = 0; }
    }
    tick() {
        if (!this.enabled()) return;
        const choices = safe(() => this.g.travelConditions?.()) || {}, hour = safe(() => this.g.trafficHours?.());
        this.conditions = { time_mode: ['now', 'real', 'dawn', 'rush', 'noon', 'day', 'sunset', 'dusk', 'night'].includes(choices.tod) ? choices.tod : 'custom', local_hour: Number.isFinite(hour) ? Math.floor(((hour % 24) + 24) % 24) : null, weather_mode: ['clear', 'cloudy', 'drizzle', 'rain', 'storm', 'fog', 'snow'].includes(choices.weather) ? choices.weather : 'live' };
        this.syncContext();
    }
    write(extra = {}) {
        if (!this.enabled()) return;
        safe(() => {
            const old = readPending(sessionStorage) || {};
            sessionStorage.setItem(KEY, JSON.stringify({ v: 2, ...old, updated: Date.now(), attempt: this.pending?.id || old.attempt || null, loading: !!this.pending, destination: this.pending?.district || old.destination || null, stage: this.pending?.stage || old.stage || 'playable', ...extra }));
        });
    }
    observe(obj, name, before, after, failed) {
        const original = obj?.[name]; if (typeof original !== 'function') return;
        obj[name] = function (...args) {
            const token = safe(() => before?.(args)); let result;
            try { result = original.apply(this, args); } catch (error) { safe(() => failed?.(error, token)); throw error; }
            if (result?.then) return result.then(value => { safe(() => after?.(value, token)); return value; }, error => { safe(() => failed?.(error, token)); throw error; });
            safe(() => after?.(result, token)); return result;
        };
    }
    wrapLoads() {
        this.observe(this.g, 'loadCity', args => {
            this.flush(); const attempt = { id: id(), city: typeof args[0] === 'string' ? args[0] : args[0]?.id || null, district: args[1]?.district || null, start: performance.now(), stage: 'requested', first: this.loadIndex++ === 0 };
            this.pending = attempt; this.awaitingFrame = null; this.write({ ended: false, contextLost: false, awaiting_frame: false });
            this.send('load_started', { attempt_id: attempt.id, destination_city: attempt.city, destination: attempt.district, first: attempt.first, ...this.resourceCounts() });
            const node = document.querySelector('#loading p');
            if (node) {
                attempt.observer = new MutationObserver(() => {
                    const text = node.textContent || '';
                    attempt.stage = /building|fa[cç]ade|landmark/i.test(text) ? 'buildings' : /tree|green|vegetation/i.test(text) ? 'vegetation' : /road|street|graph|lane/i.test(text) ? 'roads' : /mesh|merge|upload/i.test(text) ? 'mesh' : /load|fetch|map|data/i.test(text) ? 'data' : 'world';
                    this.write();
                }); attempt.observer.observe(node, { subtree: true, childList: true, characterData: true });
            }
            return attempt;
        }, (_, attempt) => {
            if (!attempt) return; attempt.observer?.disconnect();
            attempt.buildMs = Math.round(performance.now() - attempt.start); attempt.scene = this.g.scene;
            const phases = this.g.world?.stats?.phases || [];
            this.send('load_completed', { attempt_id: attempt.id, destination_city: attempt.city, destination: attempt.district, build_ms: attempt.buildMs, first: attempt.first, ...this.resourceCounts() });
            // Stage labels are bucketed fixed codes; do not send DOM text or arbitrary source labels.
            const stage = label => /building|fa[cç]ade|landmark/i.test(label) ? 'buildings' : /tree|green|vegetation/i.test(label) ? 'vegetation' : /road|street|graph|lane/i.test(label) ? 'roads' : /mesh|merge|upload/i.test(label) ? 'mesh' : /load|fetch|map|data/i.test(label) ? 'data' : 'world';
            const timings = {}; for (const [label, duration] of phases.slice(0, 30)) if (Number.isFinite(duration)) timings[stage(label)] = (timings[stage(label)] || 0) + duration;
            this.send('load_stages', { attempt_id: attempt.id, destination: attempt.district, ...timings });
            this.pending = null; this.awaitingFrame = attempt; this.lastFrame = 0; this.write({ stage: 'built', loading: false, awaiting_frame: true });
        }, (error, attempt) => {
            attempt?.observer?.disconnect();
            this.send('load_failed', { attempt_id: attempt?.id || null, destination_city: attempt?.city || null, destination: attempt?.district || null, last_stage: attempt?.stage || 'requested', elapsed_ms: attempt ? Math.round(performance.now() - attempt.start) : null, error_kind: ['TypeError', 'RangeError', 'SyntaxError', 'AbortError'].includes(error?.name) ? error.name : 'Error', ...this.resourceCounts() });
            safe(() => window.cvTelemetry?.error?.(error, { area: 'world_load', attempt_id: attempt?.id || null }));
            this.pending = null; this.awaitingFrame = null; this.write({ loading: false, awaiting_frame: false, stage: 'failed' });
        });
        this.observe(this.g, 'disposeCity', () => this.resourceCounts(), (_, before) => { if (before && this.pending) this.send('scene_released', { attempt_id: this.pending.id, before_textures: before.textures, before_geometries: before.geometries, ...this.resourceCounts() }); });
    }
    wrapRendering() {
        this.observe(this.g.r3d, 'frame', () => performance.now(), (_, started) => {
            if (!this.g.r3d?.scene) return;
            this.frame(performance.now(), this.g.r3d.stats, Math.max(0, performance.now() - started), this.g.r3d.scene);
        });
        this.observe(this.g, 'updateOffice', () => ({ t: performance.now(), scene: this.g.office?.scene, calls: this.g.renderer.info.render.calls, triangles: this.g.renderer.info.render.triangles }), (_, before) => {
            if (!before || this.g.state !== 'office') return; const r = this.g.renderer.info.render;
            this.frame(performance.now(), { drawCalls: Math.max(0, r.calls - before.calls), triangles: Math.max(0, r.triangles - before.triangles) }, performance.now() - before.t, before.scene);
        });
    }
    frame(now, stats, renderMs, renderedScene) {
        if (!this.enabled() || document.hidden || (!ACTIVE.has(this.g.state) && !this.g.explore?.drone?.active)) { this.lastFrame = 0; return; }
        if (this.awaitingFrame && this.awaitingFrame.scene === renderedScene) {
            const a = this.awaitingFrame; this.awaitingFrame = null;
            this.send('scene_first_frame', { attempt_id: a.id, destination: a.district, first_frame_ms: Math.round(now - a.start), build_ms: a.buildMs, render_ms: +renderMs.toFixed(1), ...this.resourceCounts() });
            a.scene = null;
            this.write({ loading: false, awaiting_frame: false, stage: 'playable' });
        }
        this.syncContext();
        this.observedFrames = (this.observedFrames || 0) + 1;
        if ((stats?.drawCalls || 0) > 400 || (stats?.triangles || 0) > 1500000) this.budgetFrames++;
        this.maxCalls = Math.max(this.maxCalls || 0, stats?.drawCalls || 0); this.maxTriangles = Math.max(this.maxTriangles || 0, stats?.triangles || 0);
        if (renderMs > 250 && this.anomalyCount++ < 20) this.send('render_stall', { render_ms: Math.round(renderMs), action: this.action?.name || null, ...this.resourceCounts() });
        if (this.lastFrame) {
            const ms = now - this.lastFrame;
            if (ms > 0) {
                this.frameCount++; this.longest = Math.max(this.longest, ms); if (ms > 250) this.longFrames++;
                if (this.frames.length < 4096) this.frames.push(ms); else { const i = Math.floor(Math.random() * this.frameCount); if (i < 4096) this.frames[i] = ms; }
            }
        }
        this.lastFrame = now;
        this.frameResources = this.resourceCounts();
        if (this.action) {
            const a = this.action; this.action = null;
            this.send('ui_action_frame', { action: a.name, source: a.source, response_ms: Math.round(now - a.at), render_ms: +renderMs.toFixed(1), added_programs: Math.max(0, (this.resourceCounts().programs || 0) - a.programs) });
        }
        if (now - this.lastHeartbeat > 15000) { this.lastHeartbeat = now; this.write({ ended: false }); }
    }
    flush(final = false) {
        if (this.frames.length > 10 || this.longFrames || this.budgetFrames) {
            this.send('perf_summary', { ...this.context, ...frameSummary(this.frames), ...(this.frameResources || this.resourceCounts()), ...this.gpu(), samples: this.frames.length, frames_observed: this.observedFrames || 0, frame_sample_method: 'reservoir_4096', max_frame_ms: +this.longest.toFixed(1), max_draw_calls: this.maxCalls || 0, max_triangles: this.maxTriangles || 0, budget_exceeded_frames: this.budgetFrames, long_frames: this.longFrames, long_tasks: this.longTasks || 0, max_long_task_ms: +(this.longTaskMax || 0).toFixed(1), tier: this.context?.quality_tier || null, viewport: `${innerWidth}x${innerHeight}` }, final);
        }
        this.frames.length = 0; this.frameCount = this.budgetFrames = this.longFrames = this.longest = this.longTasks = this.longTaskMax = 0;
        this.observedFrames = this.maxCalls = this.maxTriangles = 0; this.frameResources = null; this.lastFrame = 0; this.summaryAt = performance.now();
    }
    bindActions() {
        addEventListener('dmcv:activity-flow', e => {
            const d = e.detail || {}, type = { start: 'activity_started', step: 'activity_step', cancel: 'activity_cancelled' }[d.type];
            if (!type || !/^[a-z][a-z0-9-]{0,63}$/.test(d.id || '') || !/^[a-z][a-z0-9-]{0,63}$/.test(d.spot || '')) return;
            const reasons = ['cancel', 'mode', 'pause', 'map', 'photo', 'drone', 'teleport', 'exit', 'mode-or-distance', 'escape', 'hidden', 'leave'];
            this.send(type, { activity_id: d.id, spot_id: d.spot, activity_attempt_id: String(d.attempt || '').slice(0, 64), step: Math.max(0, Math.min(3, d.step || 0)), elapsed_ms: Math.max(0, Math.min(3600000, d.elapsed_ms || 0)), ...(d.type === 'cancel' ? { reason: reasons.includes(d.reason) ? d.reason : 'other' } : {}) });
        });
        addEventListener('dmcv:activity', e => {
            const d = e.detail || {};
            if (!/^[a-z][a-z0-9-]{0,63}$/.test(d.id || '') || !/^[a-z][a-z0-9-]{0,63}$/.test(d.spot || '')) return;
            this.send(d.id === 'tour-start' ? 'tour_started' : d.id === 'tour' ? 'tour_completed' : 'activity_completed', { activity_id: d.id, spot_id: d.spot, completion_source: 'scene_event' });
        });
        const begin = (name, source) => {
            if (!this.enabled() || this.actionCount++ > 150) return;
            this.action = { name, source, at: performance.now(), programs: this.resourceCounts().programs || 0 };
            this.send('ui_action', { action: name, source }); this.write({ last_action: name });
        };
        addEventListener('keydown', e => { if (!e.repeat && e.code === 'KeyL' && this.currentContext().game_mode === 'drive') begin('headlights', 'keyboard'); }, true);
        document.addEventListener('click', e => {
            const target = e.target.closest?.('[data-pa], [data-achv-open], #achv-menu, [data-opt]'); if (!target) return;
            if (target.matches('[data-opt]') && this.g.office?.talking) this.send('office_dialogue_action', { option: Math.min(3, Math.max(0, Number(target.dataset.opt) || 0)), source: this.g.touch ? 'touch' : 'pointer' });
            else if (target.dataset.pa === 'headlights') begin('headlights', 'pause');
            else if (target.matches('[data-achv-open], #achv-menu') || target.dataset.pa === 'achievements') this.send('overlay_open_requested', { overlay: 'achievements', source: target.closest('#menu') ? 'title' : target.closest('#pause-menu') ? 'pause' : target.closest('#panel') ? 'panel' : 'map', office_talking: !!this.g.office?.talking });
        }, true);
        this.observe(this.g, 'togglePause', args => { if (args[0] !== false) this.send('pause_opened', {}); });
        this.observe(this.g, 'cityLoadFailed', () => { this.recoveryExpected = true; });
        this.observe(this.g.save, 'restore', () => performance.now(), result => { this.send('continue_result', { success: result !== false && ['drive', 'foot', 'spot', 'card'].includes(this.g.state), after_load_failure: !!this.recoveryExpected }); this.recoveryExpected = false; });
    }
}
