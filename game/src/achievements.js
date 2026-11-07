// ============================================================================
//  ACHIEVEMENTS & COMPLETION (spec 23, progression role)
//  Observes window.game from the outside (like telemetry-game.js): a 4 Hz poll of
//  the game state + a few call-through wrappers on game methods. The only hooks
//  inside gameplay files: hud.achievement() delegates to unlock() here, and main.js
//  calls initAchievements(game) once.
//  - catalogue: ACHIEVEMENTS in data.js (id → trigger table in specs/23 log)
//  - persistence: localStorage `dmcv.progression.v1` (unlock timestamps, counters,
//    sets), merged with chapter progress (game.progress, chapters.js) and spot
//    postcards (spots/index.js spotProgress())
//  - completion %: one weights table (WEIGHTS), ring + % in the main menu, map
//    panel (chapters / pause) and the spot pause panel; panel with filters
//  - feedback: one toast at a time (queue), 25/50/75/100 % milestones, 100 % reward
//  - telemetry: `completion_milestone {pct}` (achievement events: telemetry-game.js)
// ============================================================================
import { ACHIEVEMENTS, STOPS, PROFILE } from './data.js';
import { save as SAVE } from './save.js'; // note 73: IndexedDB autosave / Continue / gallery

const KEY = 'dmcv.progression.v1';
const SPOTS_KEY = 'dmcv.spots.v1';      // spots/index.js (read-only here)
const CHAPTERS_KEY = 'dmcv:chapters';   // chapters.js (read-only here; cleared by reset)

/** completion weights (sum 100) — the one table */
export const WEIGHTS = [
    { key: 'story', label: 'Story chapters', icon: '📖', weight: 40 },
    { key: 'cv', label: 'CV answers heard', icon: '💬', weight: 10 }, // (offices are conversations since note 37)
    { key: 'spots', label: 'Tourist spots visited', icon: '🏛️', weight: 15 },
    { key: 'postcards', label: 'Postcards', icon: '💌', weight: 10 },
    { key: 'achievements', label: 'Achievements', icon: '🏆', weight: 25 },
];
export const CATEGORIES = [
    { id: 'story', label: 'Story', icon: '📖' }, { id: 'explorer', label: 'Explorer', icon: '🧭' },
    { id: 'driver', label: 'Driver', icon: '🚗' }, { id: 'local', label: 'Local colour', icon: '📣' },
    { id: 'photo', label: 'Photographer', icon: '📷' }, { id: 'foot', label: 'On foot', icon: '🚶' },
    { id: 'landmarks', label: 'Landmarks', icon: '🎡' }, { id: 'secret', label: 'Secrets', icon: '🗝️' },
];
const MILESTONES = [25, 50, 75, 100];
const BUC_OFFICES = ['rosetti', 'upb', 'gts', 'luxoft', 'db', 'arnia', 'uipath-buc'];
const N_CHAPTERS = 10, N_SPOTS = 24;
const N_SCREENS = STOPS.reduce((n, s) => n + (s.stations?.length || 0), 0);
/** peak-hour hotspots (CITIES[…].districts[…].congestion notes) for `rush-hour` */
const HOTSPOTS = [['victoriei', /^Piața Victoriei/], ['unirii', /^Piața Unirii/], ['pompeiu', /Dimitrie Pompeiu/], ['i405', /I-405/]];
const GOLD = '#d4a017';

const byId = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
/** Landmarks (note 57): an activity achievement counts (panel, completion %) only once its activity exists in the game:
 *  `live: true` in data.js, or listed by the spots module (`spotsMod.ACTIVITIES` = [{spot, id}]) — see 01-architecture *Activities* */
let liveActs = new Set();
const isLive = (a) => a.cat !== 'landmarks' || a.live === true || (a.activity && liveActs.has(a.activity)) || (a.id === 'landmarks-all' && ACHIEVEMENTS.some(x => x.activity && (x.live === true || liveActs.has(x.activity))));
export const activeAchievements = () => ACHIEVEMENTS.filter(isLive);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rainy = (w) => !!w && (/rain|drizzle|shower|storm|thunder/i.test(`${typeof w.code === 'string' ? w.code : ''} ${w.kind || ''} ${w.label || ''}`) || (typeof w.code === 'number' && ((w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95)));

function emptyState() {
    return { v: 1, created: Date.now(), unlocked: {}, counters: { walk: 0, photos: 0 }, dist: { rain: 0, snow: 0, fog: 0 },
        sets: { screens: [], roam: [], spots: [], plaques: [], rush: [], activities: [] }, milestones: [], gold: false, thanksShown: false };
}
function loadState() {
    try {
        const o = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!o || o.v !== 1) return emptyState();
        const d = emptyState();
        return { ...d, ...o, counters: { ...d.counters, ...o.counters }, dist: { ...d.dist, ...o.dist }, sets: { ...d.sets, ...o.sets }, unlocked: o.unlocked || {}, milestones: o.milestones || [] };
    } catch { return emptyState(); }
}
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }

/** SVG progress ring */
export function ringSvg(pct, size = 64, stroke = 7) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `<svg class="achv-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(148,163,184,.25)" stroke-width="${stroke}"/>`
        + `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${pct >= 100 ? GOLD : '#fbbf24'}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`
        + `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="${Math.round(size * (pct >= 100 ? 0.22 : 0.27))}" font-weight="700" font-family="system-ui,sans-serif">${Math.floor(pct)}%</text></svg>`;
}

export class Progression {
    constructor(game) {
        this.game = game;
        this.state = loadState();
        this.queue = []; this.showing = false; this.filter = 'all'; this.dirty = false; this.lastSave = 0;
        this.silent = true; // first evaluation merges earlier progress without toasts / milestone moments
        this.walkPrev = null; this.drivePrev = null; this.hotDist = new Map(); this.jamT = 0; this.chap = null; this.navDest = null; this.lastBump = 0;
        this.lastChime = 0; this.pendingThanks = false;
        if (game.hud) { game.hud.progression = this; game.hud.unlocked = game.hud.unlocked || new Set(); }
        this.installWraps();
        this.installActivities();
        this.buildDom();
        this.evaluate();
        this.silent = false;
        this.refreshUi();
        game.loadSpotsModule?.()?.then?.(() => { this.evaluate(); this.refreshUi(); });
        this._last = performance.now();
        this._timer = setInterval(() => { try { this.tick(); } catch (e) { console.warn('[achievements]', e); } }, 250);
        addEventListener('pagehide', () => { if (this.dirty) this.save(true); });
    }

    // ------------------------------------------------------------------ persistence
    save(force = false) {
        const now = performance.now();
        if (!force && now - this.lastSave < 2000) { this.dirty = true; return; }
        this.lastSave = now; this.dirty = false;
        try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* private mode */ }
    }
    addTo(set, v) { const a = this.state.sets[set]; if (a.includes(v)) return false; a.push(v); this.save(); return true; }
    /** wipe everything (achievements, chapters, spots/postcards) and reload */
    async reset() {
        clearInterval(this._timer); this.state = emptyState(); this.dirty = false; this._resetting = true;
        try { [KEY, CHAPTERS_KEY, SPOTS_KEY].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
        try { await SAVE.clearAll(); } catch (e) { console.warn('[achievements] reset', e); } // IndexedDB session, mirror, photos + every dmcv* key
        location.reload();
    }

    // ------------------------------------------------------------------ unlocks
    isUnlocked(id) { return !!this.state.unlocked[id]; }
    unlock(id) {
        const a = byId.get(id); if (!a || this.state.unlocked[id]) return false;
        this.state.unlocked[id] = Date.now();
        if (!this.silent) this.game.hud?.unlocked?.add(id); // (telemetry-game.js sends `achievement` for new entries)
        this.save(true);
        if (!this.silent) this.enqueue({ icon: a.icon, title: a.title, desc: a.desc, cls: 'achv' });
        this.evaluate();
        return true;
    }
    /** all spot data as {SPOTS, postcards} */
    spotData() {
        const list = this.game.spotsMod?.SPOTS || null;
        const prog = this.game.spotsMod?.spotProgress?.() || readJSON(SPOTS_KEY);
        return { list, postcards: Object.keys(prog.postcards || {}) };
    }
    /** counter value of an achievement with a target */
    count(id) {
        const s = this.state, sd = this.spotData(), ids = sd.list ? new Set(sd.list.map(x => x.id)) : null;
        const visited = s.sets.spots.filter(x => !ids || ids.has(x));
        const city = (c) => sd.list ? visited.filter(x => sd.list.find(y => y.id === x)?.city === c).length : 0;
        switch (id) {
            case 'reader-all': return s.sets.screens.length;
            case 'roam-all': return s.sets.roam.length;
            case 'spots-buc': return city('bucharest');
            case 'spots-sea': return city('seattle');
            case 'plaques-25': return s.sets.plaques.length;
            case 'rush-hour': return s.sets.rush.length;
            case 'postcards-all': return sd.postcards.filter(x => !ids || ids.has(x)).length;
            case 'photo-roll': return s.counters.photos;
            case 'foot-km': return Math.floor(s.counters.walk);
            case 'landmarks-all': return ACHIEVEMENTS.filter(a => a.activity && isLive(a) && s.unlocked[a.id]).length;
            default: return 0;
        }
    }
    /** derived unlocks: chapter progress, counters (also merges progress made before this module existed) */
    evaluate() {
        if (this._eval) return; this._eval = true;
        try {
            const done = this.game.progress?.done || new Set(readJSON(CHAPTERS_KEY).done || []);
            for (const ch of this.game.chapters || []) if (done.has(ch.id)) this.unlock('ch-' + ch.id);
            if (BUC_OFFICES.every(id => done.has(id))) this.unlock('all-buc');
            if ((this.game.chapters || []).length && this.game.chapters.every(ch => done.has(ch.id))) this.unlock('all');
            if (done.has('seatac')) this.unlock('flight');
            if (this.state.sets.roam.length) this.unlock('roam-first');
            if (this.state.sets.spots.length) this.unlock('spot-first');
            if (this.spotData().postcards.length) this.unlock('postcard-first');
            if (this.state.counters.photos > 0) this.unlock('photo-first');
            for (const a of ACHIEVEMENTS) if (a.target && this.count(a.id) >= a.target) this.unlock(a.id);
            // activities done before their achievement shipped (or before a reload)
            for (const a of ACHIEVEMENTS) if (a.activity && this.state.sets.activities?.includes(a.activity)) this.unlock(a.id);
            { const L = activeAchievements().filter(a => a.activity); if (L.length && L.every(a => this.state.unlocked[a.id])) this.unlock('landmarks-all'); }
        } finally { this._eval = false; }
        this.checkMilestones();
        this.refreshUi();
    }

    // ------------------------------------------------------------------ completion %
    completion() {
        const s = this.state, g = this.game, sd = this.spotData(), ids = sd.list ? new Set(sd.list.map(x => x.id)) : null;
        const done = g.progress?.done || new Set(readJSON(CHAPTERS_KEY).done || []);
        const chapters = g.chapters || [];
        const nCh = chapters.length || N_CHAPTERS, nSpots = sd.list?.length || N_SPOTS;
        const raw = {
            story: [chapters.filter(c => done.has(c.id)).length, nCh],
            cv: [Math.min(s.sets.screens.length, N_SCREENS), N_SCREENS],
            spots: [s.sets.spots.filter(x => !ids || ids.has(x)).length, nSpots],
            postcards: [sd.postcards.filter(x => !ids || ids.has(x)).length, nSpots],
            achievements: [activeAchievements().filter(a => s.unlocked[a.id]).length, activeAchievements().length],
        };
        const parts = WEIGHTS.map(w => { const [n, total] = raw[w.key]; const frac = total ? Math.min(1, n / total) : 0; return { ...w, n: Math.min(n, total), total, frac, points: w.weight * frac }; });
        const exact = parts.reduce((t, p) => t + p.points, 0);
        const all = parts.every(p => p.frac >= 1);
        return { pct: all ? 100 : Math.min(99, Math.floor(exact)), exact, all, parts, unlocked: raw.achievements[0], total: raw.achievements[1] };
    }
    checkMilestones() {
        const { pct, all } = this.completion(), s = this.state;
        this._all = all;
        for (const m of MILESTONES) {
            if (pct < m || s.milestones.includes(m)) continue;
            s.milestones.push(m);
            if (m === 100) s.gold = true; // reward on (the panel toggles it)
            this.save(true);
            if (this.silent) continue;
            try { window.cvTelemetry?.track?.('completion_milestone', { pct: m }); } catch { /* ignore */ }
            this.enqueue({ icon: m === 100 ? '👑' : '⭐', title: m === 100 ? '100 % — everything!' : `${m} % complete`, desc: m === 100 ? 'Gold paint unlocked for the car. Thank you for playing!' : 'Keep going: the panel shows what is left (M → 🏆).', cls: 'achv milestone', pct: m });
            if (m === 100) this.pendingThanks = true;
        }
    }

    // ------------------------------------------------------------------ toasts (one at a time)
    enqueue(t) { this.queue.push(t); if (!this.showing) this.next(); }
    next() {
        const t = this.queue.shift(); if (!t) { this.showing = false; return; }
        this.showing = true;
        const box = this.toastBox, el = document.createElement('div');
        el.className = 'achv-toast ' + (t.cls || '');
        el.setAttribute('role', 'status');
        el.innerHTML = `${t.pct ? ringSvg(t.pct, 46, 5) : `<span class="ic">${esc(t.icon)}</span>`}<div><b>${t.pct ? esc(t.title) : '🏆 ' + esc(t.title)}</b><span>${esc(t.desc)}</span></div>`;
        box.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        const t0 = performance.now();
        setTimeout(() => { if (this.lastChime < t0) this.chime(); }, 40); // main.js may chime for the same unlock
        if (t.pct) setTimeout(() => this.chime(), 260);
        const dur = t.pct ? 5200 : 3800;
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); this.next(); }, 380); }, dur);
    }
    chime() { try { this.game.audio?.chime?.(); } catch { /* audio not started */ } }

    // ------------------------------------------------------------------ observing the game
    installWraps() {
        const g = this.game, self = this;
        const after = (name, fn) => {
            const orig = g[name]; if (typeof orig !== 'function') return;
            g[name] = function (...args) {
                const r = orig.apply(this, args);
                const run = (v) => { try { fn(v, ...args); } catch (e) { console.warn('[achievements]', name, e); } };
                if (r && typeof r.then === 'function') r.then(run, () => { }); else run(r);
                return r;
            };
        };
        const before = (name, fn) => {
            const orig = g[name]; if (typeof orig !== 'function') return;
            g[name] = function (...args) { try { fn(...args); } catch (e) { console.warn('[achievements]', name, e); } return orig.apply(this, args); };
        };
        // chapters: crash count per chapter (clean-chapter), the montage over the I-90 bridge (bridge)
        // note 44: chapter achievements unlock at the goal (completeChapter adds to progress.done before the card)
        after('completeChapter', () => self.evaluate());
        before('enterChapter', (idx) => { const ch = g.chapters?.[idx]; if (ch) self.chap = { id: ch.id, crashes: 0, checked: false }; });
        before('chainChapter', (idx) => { const ch = g.chapters?.[idx]; if (ch) self.chap = { id: ch.id, crashes: 0, checked: false }; }); // same-district chapters chain in place (gameplay)
        before('goToChapter', () => { self._fromChapter = g.ch?.id || null; });
        after('goToChapter', (ok, idx) => { const ch = g.chapters?.[idx]; if (ok && ch?.id === 'uipath-bel' && self._fromChapter === 'seatac') self.unlock('bridge'); });
        before('onCollide', () => { if (self.chap) self.chap.crashes++; });
        // district edge closures (approach toast)
        before('closureText', () => { if (g.state === 'drive') self.unlock('roadworks'); });
        before('playerHonk', () => { if (g.city?.id === 'seattle') self.unlock('seattle-honk'); });
        before('onPhoto', (meta = {}) => self.onPhoto(meta));
        // ring + button in the map panel (chapters / navigation = the in-game pause) and the spot pause panel
        after('buildNavList', () => self.injectNav());
        after('spotPause', () => self.injectSpotPause());
        // double-chime guard
        const a = g.audio; if (a && typeof a.chime === 'function' && !a._achvWrapped) { const c = a.chime.bind(a); a.chime = (...x) => { self.lastChime = performance.now(); return c(...x); }; a._achvWrapped = true; }
    }
    /** note 57 activity events: `game.emit('activity', {spot, id})` or `window.dispatchEvent(new CustomEvent('dmcv:activity', {detail: {spot, id}}))` */
    installActivities() {
        const g = this.game;
        if (typeof g.emit !== 'function') g.emit = (type, detail = {}) => { try { window.dispatchEvent(new CustomEvent('dmcv:' + type, { detail })); } catch (e) { console.warn('[emit]', e); } };
        addEventListener('dmcv:activity', (e) => this.onActivity(e.detail || {}));
        const refresh = () => { const L = g.spotsMod?.ACTIVITIES; if (Array.isArray(L)) liveActs = new Set(L.map(x => `${x.spot}:${x.id}`)); };
        refresh(); g.loadSpotsModule?.()?.then?.(() => { refresh(); this.evaluate(); });
    }
    onActivity({ spot, id } = {}) {
        if (!spot || !id) return;
        const key = `${spot}:${id}`;
        liveActs.add(key); // an activity that fired exists in the game
        this.state.sets.activities ||= [];
        if (this.addTo('activities', key)) { const a = ACHIEVEMENTS.find(x => x.activity === key); if (a) this.unlock(a.id); this.evaluate(); }
    }
    onPhoto(meta) {
        const g = this.game, s = this.state;
        s.counters.photos++; this.save(true);
        this.unlock('photo-first');
        if (g.r3d?.nightLights || g.phase === 'night') this.unlock('photo-night');
        if (g.state === 'spot' ? rainy(g.r3d?.weather) : ['rain', 'storm'].includes(g.wxKind)) this.unlock('photo-rain');
        if (meta.filter === 'bw') this.unlock('photo-bw');
        this.evaluate();
    }
    /** per spot session: plaques read (+ secrets) and postcard toasts (Mountain out, peacock) */
    wrapSession(sess) {
        if (!sess || sess._achv) return; sess._achv = true;
        const self = this, scene = sess.spot?.sceneId || sess.spot?.id || 'spot';
        const key = (p) => `${scene}|${p.title}`;
        if (typeof sess.readPlaque === 'function') {
            const orig = sess.readPlaque.bind(sess);
            sess.readPlaque = (p, ...rest) => {
                try {
                    if (p?.title) {
                        if (self.addTo('plaques', key(p))) self.evaluate();
                        if (/Memorial of Rebirth/i.test(p.title)) self.unlock('potato');
                        if (/^Curtea Veche, 1459/.test(p.title)) self.unlock('vlad');
                        const all = sess.spot?.plaques || [];
                        if (all.length && all.every(q => self.state.sets.plaques.includes(key(q)))) self.unlock('plaques-spot');
                    }
                } catch (e) { console.warn('[achievements] plaque', e); }
                return orig(p, ...rest);
            };
        }
        const ui = sess.ui;
        if (ui && typeof ui.toast === 'function') {
            const orig = ui.toast.bind(ui);
            ui.toast = (title, body, ...rest) => {
                try {
                    if (/Postcard/i.test(String(title))) {
                        if (/Mountain out/i.test(String(body))) self.unlock('mountain-out');
                        if (/peacock/i.test(String(body))) self.unlock('peacock');
                        setTimeout(() => self.evaluate(), 0);
                    }
                } catch { /* ignore */ }
                return orig(title, body, ...rest);
            };
        }
    }
    tick() {
        const g = this.game, s = this.state, now = performance.now();
        const dt = Math.min(0.5, (now - this._last) / 1000); this._last = now;
        const st = g.state;
        // ---- chapter progress changed (any path): unlock right away (note 44)
        const nDone = g.progress?.done?.size ?? 0; if (nDone !== this._nDone) { this._nDone = nDone; this.evaluate(); }
        // ---- free roam
        if (g.freeRoam?.district && (st === 'drive' || st === 'foot')) { if (this.addTo('roam', g.freeRoam.district)) this.evaluate(); }
        // ---- tourist spots
        if (st === 'spot' && g.spotId) {
            if (this.addTo('spots', g.spotId)) this.evaluate();
            if (g.spot) this.wrapSession(g.spot);
            if (g.spotId === 'fremont-troll' && g.r3d?.nightLights) this.unlock('troll-night');
        }
        // ---- offices: screens read
        if (st === 'office' && g.office?.stop && g.office.read) {
            let added = false;
            for (const i of g.office.read) added = this.addTo('screens', `${g.office.stop.id}:${i}`) || added;
            if (added) this.evaluate();
            if (g.officeFromFoot) this.unlock('foot-office');
        }
        // ---- postcards (spots module writes them)
        if (st === 'spot' && (this._pcT = (this._pcT || 0) + dt) > 1) { this._pcT = 0; const n = this.spotData().postcards.length; if (n !== this._pcN) { this._pcN = n; this.evaluate(); } }
        // ---- driving
        const P = g.player;
        if (st === 'drive' && P) {
            const prev = this.drivePrev; this.drivePrev = { x: P.x, z: P.z, w: g.world };
            const d = prev && prev.w === g.world ? Math.hypot(P.x - prev.x, P.z - prev.z) : 0;
            const step = d < 30 ? d : 0; // fast travel / resets are not driving
            const wx = g.wxKind, key = wx === 'rain' || wx === 'storm' ? 'rain' : wx === 'snow' ? 'snow' : wx === 'fog' ? 'fog' : null;
            if (key && step) { s.dist[key] += step; this.dirty = true; if (s.dist[key] >= 1000) this.unlock(key + '-drive'); }
            // peak-hour hotspots: ≥ 150 m driven inside one at ≥ half its peak level
            for (const h of g.traffic?.hot || []) {
                const hk = HOTSPOTS.find(([, re]) => re.test(h.note || ''))?.[0]; if (!hk || s.sets.rush.includes(hk)) continue;
                if (step && h.L >= 0.5 * h.level && h.level > 0 && Math.hypot(P.x - h.x, P.z - h.z) < 0.9 * h.r) {
                    const v = (this.hotDist.get(h) || 0) + step; this.hotDist.set(h, v);
                    if (v >= 150 && this.addTo('rush', hk)) { this.enqueue({ icon: '🚦', title: 'Rush hour survived', desc: `${h.note.split(/[(,]/)[0].trim()} at peak (${s.sets.rush.length}/4)`, cls: 'achv' }); this.evaluate(); }
                }
            }
            // a minute standing still in a Bucharest jam
            const jam = g.city?.id === 'bucharest' && g.traffic?.jamAt ? g.traffic.jamAt(P.x, P.z) : 0;
            if (jam > 0.4 && Math.abs(P.speed) < 1) { this.jamT += dt; if (this.jamT >= 60) this.unlock('jam-stuck'); } else if (jam < 0.2) this.jamT = 0;
            // own waypoint followed to the end
            if (g.navManual && g.nav?.dest) this.navDest = { x: g.nav.dest.x, z: g.nav.dest.z };
            else if (this.navDest) { if (Math.hypot(P.x - this.navDest.x, P.z - this.navDest.z) < 45) this.unlock('nav-arrive'); this.navDest = null; }
        } else this.drivePrev = null;
        // ---- a chapter finished without a crash
        const c = this.chap;
        if (c && !c.checked && g.chapterDone && g.chapter === c.id) { c.checked = true; if (c.crashes === 0) this.unlock('clean-chapter'); }
        // ---- on foot (streets) and walking in spots
        const F = st === 'foot' ? g.foot : st === 'spot' ? g.spot?.ctl : null;
        if (F) {
            if (st === 'foot') this.unlock('foot-first');
            const p = { x: F.x, z: F.z, o: F };
            const pv = this.walkPrev; this.walkPrev = p;
            if (pv && pv.o === F) { const d = Math.hypot(p.x - pv.x, p.z - pv.z); if (d < 6) { s.counters.walk += d; this.dirty = true; if (s.counters.walk >= 1000) this.unlock('foot-km'); } }
            if ((F.jumpY || 0) > 0.12) this.unlock('foot-jump');
            if (st === 'foot') {
                if (F.bumped && F.bumped !== this.lastBump && F.t - F.bumped < 1) { this.lastBump = F.bumped; this.unlock('jaywalker'); }
                this.checkZebra(F);
            }
        } else this.walkPrev = null;
        // ---- gold paint (100 % reward) + the deferred thank-you card
        this.applyGold();
        if (this.pendingThanks && !this.showing && !g.hud?.panelOpen && (['foot', 'spot', 'menu'].includes(st) || (st === 'drive' && Math.abs(g.player?.speed || 0) < 1)) && !g.mapOpen && !g.photo?.active && !this.isOpen && !document.getElementById('chapter-card')?.classList.contains('show')) { this.pendingThanks = false; this.showThanks(); }
        if (this.dirty) this.save();
    }
    /** on the carriageway within a pedestrian crossing (world nodes flagged zebra / crossing) */
    checkZebra(F) {
        const w = this.game.world; if (!w?.graph?.nodes || this.isUnlocked('foot-zebra')) return;
        if (this._zw !== w) { this._zw = w; this._zebras = w.graph.nodes.filter(n => n.zebra || n.crossing); }
        const ne = this.game.nav?.index?.nearest?.(F.x, F.z, 30);
        if (!ne || ne.d > Math.max(1, (ne.edge.halfW ?? 4) - 0.6)) return;
        for (const n of this._zebras) if (Math.hypot(n.x - F.x, n.z - F.z) < (n.radius || 4) + 5) { this.unlock('foot-zebra'); return; }
    }
    applyGold() {
        const g = this.game, on = !!(this.state.gold && this._all);
        const paint = (m, key) => {
            if (!m?.color) return;
            const u = m.userData || (m.userData = {});
            if (on && !u.achvGold) { u.achvOrig = { c: m.color.getHex(), mt: m.metalness, r: m.roughness }; m.color.set(GOLD); if ('metalness' in m) m.metalness = 0.85; if ('roughness' in m) m.roughness = 0.28; u.achvGold = true; }
            else if (!on && u.achvGold && u.achvOrig) { m.color.setHex(u.achvOrig.c); if ('metalness' in m) m.metalness = u.achvOrig.mt; if ('roughness' in m) m.roughness = u.achvOrig.r; u.achvGold = false; }
        };
        paint(g.player?.cockpit?.userData?.hood?.material, 'hood');
        const cb = g.carBody;
        if (cb && (on || cb.userData.achvGoldMat)) {
            // the parked car's body material is shared by colour with NPCs: give it its own copy first
            if (!cb.userData.achvGoldMat) {
                cb.traverse(o => { if (o.isMesh && !Array.isArray(o.material) && o.material?.color && o.material.color.getHexString() === '1e3a8a') { o.material = o.material.clone(); cb.userData.achvGoldMat = o.material; } });
                if (!cb.userData.achvGoldMat) cb.userData.achvGoldMat = { none: true };
            }
            if (cb.userData.achvGoldMat.color) paint(cb.userData.achvGoldMat);
        }
    }

    // ------------------------------------------------------------------ UI
    buildDom() {
        this.toastBox = document.createElement('div'); this.toastBox.id = 'achv-toasts'; this.toastBox.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.toastBox);
        const p = this.panelEl = document.createElement('div'); p.id = 'achv-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', 'Achievements');
        document.body.appendChild(p);
        p.addEventListener('click', (e) => this.onPanelClick(e));
        // main menu: ring + % + button (above the controls)
        const card = document.querySelector('#menu .menu-card');
        if (card) {
            const m = this.menuEl = document.createElement('div'); m.id = 'achv-menu';
            const lead = card.querySelector(':scope > .lead');
            if (lead) lead.insertAdjacentElement('afterend', m); else (document.getElementById('start')?.parentElement || card.firstElementChild)?.insertAdjacentElement('beforebegin', m);
            m.setAttribute('data-achv-open', ''); m.title = 'Achievements & completion';
            m.addEventListener('click', () => this.open()); // the whole bar is the target (the button is hidden on phones)
        }
        document.getElementById('navlist')?.addEventListener('click', (e) => { if (e.target.closest('[data-achv-open]')) { e.stopPropagation(); this.open(); } }, true);
        // Esc closes the panel before the game / hud panel see it
        window.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            e.stopImmediatePropagation(); // the game and the hud panel underneath never see keys while the panel is open
            if (e.code === 'Escape') { e.preventDefault(); this.close(); }
        }, true);
    }
    summaryHtml(size = 56) {
        const c = this.completion();
        return `${ringSvg(c.pct, size, Math.max(5, Math.round(size / 9)))}<div class="achv-sum"><b>${c.pct}% complete</b><small>🏆 ${c.unlocked}/${c.total} achievements</small></div><button class="achv-btn" data-achv-open>🏆 Achievements</button><span class="achv-chev" aria-hidden="true">›</span>`;
    }
    refreshUi() {
        if (this.menuEl) this.menuEl.innerHTML = this.summaryHtml(44);
        const nav = document.querySelector('#navlist .achv-nav'); if (nav) nav.innerHTML = this.summaryHtml(48);
        const sp = document.querySelector('#panel .achv-pause'); if (sp) sp.innerHTML = this.summaryHtml(48);
        if (this.isOpen) this.renderPanel();
    }
    injectNav() {
        const nl = document.getElementById('navlist'); if (!nl || nl.querySelector('.achv-nav')) return;
        const d = document.createElement('div'); d.className = 'achv-nav'; d.innerHTML = this.summaryHtml(48);
        nl.prepend(d);
    }
    injectSpotPause() {
        const inner = document.querySelector('#panel .panel-inner'); if (!inner || inner.querySelector('.achv-pause')) return;
        const d = document.createElement('div'); d.className = 'achv-pause'; d.innerHTML = this.summaryHtml(48);
        d.addEventListener('click', (e) => { if (e.target.closest('[data-achv-open]')) this.open(); });
        const links = inner.querySelector('.links'); (links || inner.lastElementChild)?.insertAdjacentElement('afterend', d);
    }
    get isOpen() { return this.panelEl?.classList.contains('show'); }
    open(filter = null) {
        if (filter) this.filter = filter;
        this.confirmReset = false;
        try { this.game.input?.releaseLock?.(); } catch { /* ignore */ }
        this.evaluate();
        this.renderPanel();
        this.panelEl.classList.add('show');
        document.body.classList.add('achv-open');
        setTimeout(() => this.panelEl.querySelector('.achv-x, [data-achv-act=close]')?.focus({ preventScroll: true }), 30);
    }
    close() { this.view = null; this.panelEl.classList.remove('show'); document.body.classList.remove('achv-open'); this.game.input?.flush?.(); try { this.game.returnFocus?.(); } catch { /* ignore */ } } // (returnFocus: gameplay, note 21)
    renderPanel() {
        if (this.view === 'thanks') { this.panelEl.innerHTML = this.thanksHtml(); return; }
        const c = this.completion(), s = this.state, f = this.filter;
        const fmtDate = (t) => { try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
        const catCount = (id) => { const l = activeAchievements().filter(a => id === 'all' || a.cat === id); return `${l.filter(a => s.unlocked[a.id]).length}/${l.length}`; };
        const chips = [{ id: 'all', label: 'All', icon: '🏆' }, ...CATEGORIES.filter(k => activeAchievements().some(a => a.cat === k.id))].map(k => `<button class="achv-chip${f === k.id ? ' on' : ''}" data-achv-filter="${k.id}" aria-pressed="${f === k.id}">${k.icon} ${esc(k.label)} <small>${catCount(k.id)}</small></button>`).join('');
        const parts = c.parts.map(p => `<li><span class="lbl">${p.icon} ${esc(p.label)} <small>${p.n}/${p.total}</small></span><span class="bar"><i style="width:${(p.frac * 100).toFixed(1)}%"></i></span><span class="pts">${p.points.toFixed(1)} / ${p.weight}</span></li>`).join('');
        const list = activeAchievements().filter(a => f === 'all' || a.cat === f);
        const cards = list.map(a => {
            const on = !!s.unlocked[a.id], secret = a.hidden && !on;
            let prog = '';
            const target = a.id === 'landmarks-all' ? activeAchievements().filter(x => x.activity).length : a.target;
            if (target && !on) { const n = Math.min(this.count(a.id), target); prog = `<div class="prog"><span class="bar"><i style="width:${(n / target * 100).toFixed(1)}%"></i></span><small>${a.unit === 'm' ? `${n} / ${target} m` : `${n}/${target}`}</small></div>`; }
            return `<li class="achv-card${on ? ' on' : ''}${secret ? ' secret' : ''}"><span class="ic" aria-hidden="true">${secret ? '❓' : a.icon}</span><div><b>${secret ? '???' : esc(a.title)}</b><p>${secret ? 'A secret. Keep exploring.' : esc(a.desc)}</p>${prog}${on ? `<small class="when">✓ ${fmtDate(s.unlocked[a.id])}</small>` : ''}</div></li>`;
        }).join('');
        const reward = c.all
            ? `<div class="achv-reward"><b>👑 100 % — thank you!</b><div class="row"><button class="achv-btn" data-achv-act="gold">${s.gold ? '🟡 Gold paint: on' : '⚪ Gold paint: off'}</button><button class="achv-btn" data-achv-act="thanks">💌 Thank-you card</button></div></div>`
            : `<p class="achv-hint">At 100 %: gold paint for the car and a thank-you card.</p>`;
        const reset = this.confirmReset
            ? `<div class="achv-reset confirm"><span>Reset all progress? Chapters, tourist spots, postcards and achievements are cleared, and the game reloads.</span><button class="achv-btn danger" data-achv-act="reset-yes">Yes, reset</button><button class="achv-btn" data-achv-act="reset-no">Cancel</button></div>`
            : `<div class="achv-reset"><button class="achv-btn ghost" data-achv-act="reset">Reset progress…</button></div>`;
        this.panelEl.innerHTML = `<div class="achv-inner">
<header><div class="achv-ringbig">${ringSvg(c.pct, 92, 9)}</div><div class="achv-head"><div class="eyebrow">Drive My CV</div><h2>Achievements</h2><p>${c.unlocked}/${c.total} unlocked · ${c.pct}% complete</p></div><button class="achv-x" data-achv-act="close" aria-label="Close">✕</button></header>
<details class="achv-break"${this._breakOpen ? ' open' : ''}><summary>Completion breakdown</summary><ul>${parts}</ul></details>
<nav class="achv-chips">${chips}</nav>
<ul class="achv-grid">${cards}</ul>
<footer><div class="achv-reset"><button class="achv-btn" data-achv-act="gallery">📷 Photo gallery</button></div>${reward}${reset}</footer></div>`;
        const det = this.panelEl.querySelector('.achv-break'); det?.addEventListener('toggle', () => { this._breakOpen = det.open; });
    }
    onPanelClick(e) {
        if (e.target === this.panelEl) { this.close(); return; }
        const fb = e.target.closest('[data-achv-filter]'); if (fb) { this.filter = fb.dataset.achvFilter; this.renderPanel(); return; }
        const act = e.target.closest('[data-achv-act]')?.dataset.achvAct; if (!act) return;
        if (act === 'close') this.close();
        else if (act === 'reset') { this.confirmReset = true; this.renderPanel(); }
        else if (act === 'reset-no') { this.confirmReset = false; this.renderPanel(); }
        else if (act === 'reset-yes') this.reset();
        else if (act === 'gallery') { this.close(); SAVE.openGallery(); }
        else if (act === 'gold') { this.state.gold = !this.state.gold; this.save(true); this.applyGold(); this.renderPanel(); }
        else if (act === 'thanks') this.showThanks();
        else if (act === 'list') { this.view = null; this.renderPanel(); }
    }
    /** the 100 % thank-you card (contact links from the CV: PROFILE in data.js), drawn in the panel overlay (above the menu) */
    showThanks() {
        this.state.thanksShown = true; this.save(true);
        this.view = 'thanks'; this.open();
    }
    thanksHtml() {
        const links = PROFILE.links.map(l => `<a class="btn ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
        return `<div class="achv-inner achv-thanks">${ringSvg(100, 96, 9)}<div class="eyebrow">👑 100 % complete</div><h2>Thank you for playing!</h2>
<p>Every chapter driven, every CV screen read, every tourist spot walked and every secret found. The car has a gold paint option now.</p>
<p>${esc(PROFILE.name)} would love to hear from you:</p><div class="links">${links}<a class="btn ghost" href="mailto:${esc(PROFILE.email)}">Email</a></div>
<div class="row"><button class="achv-btn" data-achv-act="gold">${this.state.gold ? '🟡 Gold paint: on' : '⚪ Gold paint: off'}</button><button class="achv-btn" data-achv-act="list">🏆 Achievements</button><button class="achv-btn ghost" data-achv-act="close">Close</button></div></div>`;
    }
}

/** called once by main.js after `window.game = new Game()` */
export function initAchievements(game) {
    if (!game || game.achievements) return game?.achievements || null;
    try { SAVE.attach(game); } catch (e) { console.warn('[save] attach', e); } // note 73: autosave + Continue + gallery
    try { game.achievements = new Progression(game); } catch (e) { console.warn('[achievements] init', e); return null; }
    return game.achievements;
}
