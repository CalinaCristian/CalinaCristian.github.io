// ============================================================================
//  SAVE (FEEDBACK note 73, progression role) — IndexedDB persistence
//  - versioned schema: DB `dmcv` v1, stores `kv` (key → value) and `photos`
//    (auto id → { t, meta, blob }); record `meta:schema` = SCHEMA
//  - the live session (story chapter / free-roam district, car + walker pose,
//    on foot / driving, fuel, fines, trip stats, conditions) autosaved every 30 s,
//    after chapter events and on visibilitychange / pagehide; `hasSession()` +
//    `restore(game)` = the main menu's "Continue"
//  - the localStorage progress keys (chapters, progression, spots, options:
//    every `dmcv*` key) are mirrored into IndexedDB (migration on first run) and
//    written back when localStorage lost them; their sync readers keep working
//  - photo gallery: shots of PhotoMode (observed in `game.photo.gallery`) kept as
//    blobs (newest 60), small gallery panel (view / download / delete)
//  - fallback when IndexedDB is unavailable (private mode): session in
//    localStorage, photos in memory; every access in try/catch
//  - `clearAll()` = "Reset progress": both stores + every `dmcv*` localStorage key
// ============================================================================
const DB_NAME = 'dmcv', DB_VER = 1, SCHEMA = 1;
const LS_SESSION = 'dmcv.save.session';   // sync copy of the session (pagehide / fallback)
const AUTOSAVE_MS = 30000, MAX_PHOTOS = 60;
const lsKeys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('dmcv') && k !== LS_SESSION) out.push(k); } } catch { /* blocked */ } return out; };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export class SaveStore {
    constructor() {
        this.db = null; this.mode = 'memory'; this.mem = { kv: new Map(), photos: [] }; this.memId = 1;
        this.session = null; this.game = null; this.seen = new WeakSet();
        this.ready = this._open().then(() => this._migrate()).then(() => this._loadSession()).catch((e) => { console.warn('[save] init', e); });
    }
    async _open() {
        try {
            if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
            const r = indexedDB.open(DB_NAME, DB_VER);
            r.onupgradeneeded = () => {
                const db = r.result;
                if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
                if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { autoIncrement: true });
            };
            this.db = await Promise.race([req(r), new Promise((_, rej) => setTimeout(() => rej(new Error('indexedDB open timeout')), 4000))]);
            this.db.onversionchange = () => { try { this.db.close(); } catch { /* ignore */ } this.db = null; this.mode = lsSet('dmcv.save.probe', '1') ? 'local' : 'memory'; };
            this.mode = 'idb';
        } catch (e) {
            this.db = null; this.mode = lsSet('dmcv.save.probe', '1') ? 'local' : 'memory'; lsDel('dmcv.save.probe');
            console.info('[save] IndexedDB unavailable, fallback:', this.mode, e?.message || e);
        }
    }
    // ---------------------------------------------------------------- key/value
    async get(key) {
        if (this.db) { try { return await req(this.db.transaction('kv').objectStore('kv').get(key)); } catch (e) { console.warn('[save] get', e); } }
        if (this.mode === 'local') { const v = lsGet('dmcv.save.kv:' + key); try { return v == null ? undefined : JSON.parse(v); } catch { return undefined; } }
        return this.mem.kv.get(key);
    }
    async set(key, val) {
        if (this.db) { try { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); return true; } catch (e) { console.warn('[save] set', e); } }
        if (this.mode === 'local' && key !== 'session') { try { return lsSet('dmcv.save.kv:' + key, JSON.stringify(val)); } catch { /* ignore */ } }
        this.mem.kv.set(key, val); return true;
    }
    async keys() {
        if (this.db) { try { return await req(this.db.transaction('kv').objectStore('kv').getAllKeys()); } catch { /* ignore */ } }
        return [...this.mem.kv.keys()];
    }
    // ---------------------------------------------------------------- localStorage mirror (migration)
    async _migrate() {
        if (!this.db) return;
        const schema = await this.get('meta:schema');
        const have = new Set((await this.keys()).filter(k => typeof k === 'string' && k.startsWith('ls:')).map(k => k.slice(3)));
        // first run (or a key added since): localStorage → IndexedDB
        for (const k of lsKeys()) if (!have.has(k)) await this.set('ls:' + k, lsGet(k));
        // localStorage lost a key IndexedDB still has (cleared site data, other tab): write it back
        for (const k of have) if (lsGet(k) == null) { const v = await this.get('ls:' + k); if (typeof v === 'string') lsSet(k, v); }
        if (schema !== SCHEMA) await this.set('meta:schema', SCHEMA);
    }
    /** copy the current localStorage progress keys into IndexedDB */
    async syncLocal() { if (!this.db) return; for (const k of lsKeys()) { const v = lsGet(k); if (v != null && v !== this._lsCache?.[k]) { await this.set('ls:' + k, v); (this._lsCache ||= {})[k] = v; } } }

    // ---------------------------------------------------------------- session
    /** the live session of `game` as plain data, or null when there is nothing to save (menu, loading, cut-scenes) */
    capture(g = this.game) {
        if (!g || !g.started || !g.world || !g.player || !g.city) return null;
        const st = g.state;
        if (!['drive', 'foot', 'office', 'spot'].includes(st)) return null;
        const P = g.player, F = g.foot;
        let onFoot = st === 'foot', foot = null;
        if (st === 'foot' && F) foot = { x: F.x, z: F.z, heading: F.heading, y: F.y };
        else if (st === 'office' && g.officeFromFoot && F) { onFoot = true; foot = { x: F.x, z: F.z, heading: F.heading, y: F.y }; }
        else if (st === 'spot' && g.spotReturn) { onFoot = g.spotReturn.state === 'foot'; foot = g.spotReturn.foot || null; }
        const num = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
        // ('explore' = free roam off the story: the stored key of the old Explore mode, kept so older saves and this one agree)
        const mode = g.mode === 'explore' || g.explore?.active || g.freeRoam ? 'explore' : 'story';
        let stats = null; try { stats = JSON.parse(JSON.stringify(g.stats || {})); } catch { stats = null; }
        return {
            schema: SCHEMA, t: Date.now(), mode, city: g.city.id, district: g.district || null,
            chapterIdx: g.chapterIdx ?? -1, chapter: g.chapter || null, chapterDone: !!g.chapterDone,
            freeRoam: g.freeRoam ? { district: g.freeRoam.district, tod: g.freeRoam.tod || 'now', weather: g.freeRoam.weather || 'live', season: g.freeRoam.season ?? null } : null,
            season: g.r3d?._seasonOverride || null,
            onFoot, car: { x: num(P.x), z: num(P.z), heading: num(P.heading), y: num(P.surfY), edge: P.supportEdge?.id ?? null },
            foot: foot ? { x: num(foot.x), z: num(foot.z), heading: num(foot.heading), y: num(foot.y) } : null,
            fuel: num(g.fuel), stats, honks: g.honks || 0, visited: [...(g.visited || [])],
            clock: { offsetMs: g.clock?.offsetMs || 0, override: g.clock?.override || null }, weatherOverride: g.weatherOverride || null,
            headlights: g.headlights ?? 'auto', place: st === 'spot' ? { spot: g.spotId } : st === 'office' ? { office: g.office?.stop?.id } : null,
            label: this._label(g),
        };
    }
    _label(g) {
        const d = g.city?.districts?.[g.district]?.name || g.district || '';
        if (g.freeRoam || g.mode === 'explore') return `Free roam · ${d}`;
        return g.ch ? `Chapter ${g.chapterIdx + 1} · ${g.ch.title}${d ? ' · ' + d : ''}` : d;
    }
    async saveSession(reason = 'auto') {
        if (this._cleared) return false; // reset in progress: nothing may be written back before the reload
        const s = this.capture(); if (!s) return false;
        s.reason = reason; this.session = s;
        lsSet(LS_SESSION, JSON.stringify(s)); // sync copy: survives a pagehide where the IndexedDB write does not complete
        await this.set('session', s);
        await this.syncLocal();
        return true;
    }
    async _loadSession() {
        let a = null, b = null;
        try { a = await this.get('session'); } catch { /* ignore */ }
        try { b = JSON.parse(lsGet(LS_SESSION) || 'null'); } catch { b = null; }
        const ok = (s) => s && s.schema === SCHEMA && s.car && Number.isFinite(s.car.x);
        const best = [a, b].filter(ok).sort((x, y) => y.t - x.t)[0] || null;
        this.session = best; return best;
    }
    /** "Continue" available? (call after `await save.ready`) */
    hasSession() { return !!this.session; }
    async clearSession() { this.session = null; lsDel(LS_SESSION); await this.set('session', null); }
    /** put the game back where the session was: story chapter / free-roam district, car + walker pose, fuel, stats, conditions */
    async restore(g = this.game) {
        await this.ready;
        const s = this.session; if (!g || !s) return false;
        this._restoring = true;
        try {
            try { g.photo?.close?.(); } catch { /* ignore */ }
            let ok = false;
            const roam = s.freeRoam?.district || (s.mode === 'explore' ? s.district : null);
            const enterX = typeof g.explore?.roam === 'function' ? g.explore.roam : typeof g.explore?.enterExplore === 'function' ? g.explore.enterExplore : typeof g.enterExplore === 'function' ? g.enterExplore.bind(g) : typeof g.startFreeRoam === 'function' ? g.startFreeRoam.bind(g) : null; // note 75 Explore, else the free roam
            if (s.mode === 'explore' && roam && enterX) ok = await enterX(roam, { tod: s.freeRoam?.tod || 'now', weather: s.freeRoam?.weather || 'live', season: s.freeRoam?.season ?? null });
            else if (g.chapters && s.chapterIdx >= 0) {
                if (!g.started) { await g.start(s.chapterIdx); ok = true; }
                else ok = await g.enterChapter(s.chapterIdx);
            }
            if (!ok && g.state !== 'drive') return false;
            await this._until(() => g.state === 'drive' && g.player && g.world, 60000);
            // the story state of the chapter
            if (s.chapterDone && g.ch && g.ch.id === s.chapter && !g.chapterDone) { g.chapterDone = true; try { g.updateObjective?.(); } catch { /* ignore */ } }
            for (const id of s.visited || []) g.visited?.add?.(id);
            if (Number.isFinite(s.fuel) && s.fuel > 0) g.fuel = s.fuel;
            if (s.stats && g.stats) Object.assign(g.stats, s.stats);
            g.honks = s.honks || 0;
            if (s.mode !== 'explore' && g.clock) { g.clock.offsetMs = s.clock?.offsetMs || 0; if (s.clock?.override !== undefined) g.clock.override = s.clock.override; }
            if ((s.weatherOverride || null) !== (g.weatherOverride || null)) { try { g.setWeatherOverride?.(s.weatherOverride); } catch { /* ignore */ } }
            if (s.season !== undefined) g.r3d?.setSeason?.(s.season);
            if (s.headlights !== undefined) g.headlights = s.headlights;
            // the car exactly where it was (on the same road layer)
            const P = g.player, c = s.car;
            const edge = c.edge != null ? (g.world.allEdges || g.world.graph?.edges || []).find(e => e.id === c.edge) || null : null;
            P.place(c.x, c.z, c.heading, edge); P.speed = 0; P.steer = 0; P.contactAge = 9; P.resetLook?.();
            try { g.traffic?.clearAround?.(c.x, c.z, 14); g.nav?.reroute?.(P); } catch { /* ignore */ }
            // on foot: out of the car, then the walker where it stood
            if (s.onFoot && s.foot && typeof g.exitCar === 'function' && g.exitCar()) g.foot?.teleport?.(s.foot.x, s.foot.z, s.foot.heading);
            g.input?.flush?.();
            try { g.hud?.toast?.('💾 Welcome back', String(s.label || 'Your game was restored where you left it.').replace(/^Explore · /, 'Free roam · '), 'intro'); } catch { /* ignore */ }
            return true;
        } catch (e) { console.warn('[save] restore', e); return false; } finally { this._restoring = false; }
    }
    _until(fn, ms) { return new Promise((res) => { const t0 = performance.now(); const f = () => { if (fn() || performance.now() - t0 > ms) res(); else setTimeout(f, 100); }; f(); }); }

    // ---------------------------------------------------------------- photos
    async addPhoto(blob, meta = {}) {
        if (!blob) return null;
        const rec = { t: Date.now(), meta: { ...meta }, blob };
        let id = null;
        if (this.db) {
            try {
                const tx = this.db.transaction('photos', 'readwrite'), os = tx.objectStore('photos');
                id = await req(os.add(rec));
                const keys = await req(os.getAllKeys());
                for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PHOTOS))) os.delete(k);
            } catch (e) { console.warn('[save] photo', e); id = null; }
        }
        if (id == null) { id = 'm' + this.memId++; this.mem.photos.push({ id, ...rec }); while (this.mem.photos.length > MAX_PHOTOS) this.mem.photos.shift(); }
        this.renderGallery();
        return id;
    }
    async listPhotos() {
        let out = [];
        if (this.db) {
            try {
                const os = this.db.transaction('photos').objectStore('photos');
                const [keys, vals] = await Promise.all([req(os.getAllKeys()), req(os.getAll())]);
                out = vals.map((v, i) => ({ id: keys[i], ...v }));
            } catch (e) { console.warn('[save] photos', e); }
        }
        return [...out, ...this.mem.photos].sort((a, b) => b.t - a.t);
    }
    async deletePhoto(id) {
        if (typeof id === 'string' && id.startsWith('m')) this.mem.photos = this.mem.photos.filter(p => p.id !== id);
        else if (this.db) { try { const tx = this.db.transaction('photos', 'readwrite'); tx.objectStore('photos').delete(id); await new Promise(r => { tx.oncomplete = r; tx.onerror = r; }); } catch { /* ignore */ } }
        this.renderGallery();
    }
    /** "Reset progress": everything this game stored in this browser */
    async clearAll() {
        this._cleared = true;
        for (const k of lsKeys()) lsDel(k); lsDel(LS_SESSION);
        this.session = null; this.mem = { kv: new Map(), photos: [] };
        if (this.db) { try { const tx = this.db.transaction(['kv', 'photos'], 'readwrite'); tx.objectStore('kv').clear(); tx.objectStore('photos').clear(); await new Promise((r) => { tx.oncomplete = r; tx.onerror = r; tx.onabort = r; }); } catch (e) { console.warn('[save] clear', e); } }
    }

    // ---------------------------------------------------------------- autosave + observers
    /** start autosaving `game` (main.js / achievements.js call it once) */
    attach(g) {
        if (!g || this.game === g) return this;
        this.game = g; g.save = this;
        const after = (name, fn) => {
            const orig = g[name]; if (typeof orig !== 'function') return;
            g[name] = function (...args) { const r = orig.apply(this, args); const run = () => { try { fn(); } catch { /* ignore */ } }; if (r && typeof r.then === 'function') r.then(run, () => { }); else run(); return r; };
        };
        // chapter events: after the goal (card) and once the next chapter / district is entered
        for (const n of ['completeChapter', 'enterChapter', 'enterRoam', 'leaveOffice', 'leaveSpot', 'enterCar', 'exitCar']) after(n, () => setTimeout(() => this.saveSession(n), 300));
        this._timer = setInterval(() => { if (!document.hidden && !this._restoring) this.saveSession('auto'); this.observePhotos(); }, AUTOSAVE_MS);
        this._ph = setInterval(() => this.observePhotos(), 1000);
        document.addEventListener('visibilitychange', () => { if (document.hidden && !this._restoring) this.saveSession('hidden'); });
        addEventListener('pagehide', () => { if (!this._restoring) this.saveSession('pagehide'); });
        this.ready.then(() => this.injectContinue());
        return this;
    }
    /** new shots in PhotoMode's in-memory gallery → the persistent gallery */
    observePhotos() {
        const list = this.game?.photo?.gallery; if (!Array.isArray(list)) return;
        for (const shot of [...list].reverse()) { if (!shot?.blob || this.seen.has(shot)) continue; this.seen.add(shot); this.addPhoto(shot.blob, { ...(shot.meta || {}), name: shot.name }); }
    }
    /** main menu "Continue" when gameplay has not added its own (`#continue` / `[data-continue]` calling save.restore) */
    injectContinue() {
        const start = document.getElementById('start');
        if (!this.session || !start || document.getElementById('continue') || document.querySelector('[data-continue]')) return;
        const b = document.createElement('button'); b.id = 'save-continue'; b.className = 'btn primary'; b.setAttribute('data-continue', '');
        const ago = Math.max(1, Math.round((Date.now() - this.session.t) / 60000));
        b.innerHTML = `▶ Continue <small>${esc(this.session.label || '')} · ${ago < 60 ? ago + ' min' : Math.round(ago / 60) + ' h'} ago</small>`;
        b.addEventListener('click', () => { b.disabled = true; this.restore(); });
        start.insertAdjacentElement('beforebegin', b);
        start.classList.remove('primary'); start.classList.add('ghost'); start.textContent = '🚗 New story';
    }

    // ---------------------------------------------------------------- gallery panel
    async openGallery() {
        let p = document.getElementById('save-gallery');
        if (!p) {
            p = document.createElement('div'); p.id = 'save-gallery'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Photo gallery');
            document.body.appendChild(p);
            p.addEventListener('click', (e) => {
                if (e.target === p || e.target.closest('[data-gal=close]')) return this.closeGallery();
                const del = e.target.closest('[data-gal-del]'); if (del) { this.deletePhoto(isNaN(+del.dataset.galDel) ? del.dataset.galDel : +del.dataset.galDel); return; }
                const im = e.target.closest('[data-gal-view]'); if (im) { const u = im.dataset.galView; const v = p.querySelector('.gal-view'); v.innerHTML = `<img src="${u}" alt=""><button class="achv-btn" data-gal="back">← Back</button>`; v.classList.add('show'); return; }
                if (e.target.closest('[data-gal=back]')) p.querySelector('.gal-view').classList.remove('show');
            });
            window.addEventListener('keydown', (e) => { if (p.classList.contains('show') && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); this.closeGallery(); } }, true);
        }
        p.classList.add('show');
        await this.renderGallery();
    }
    closeGallery() { const p = document.getElementById('save-gallery'); if (!p) return; p.classList.remove('show'); this._revoke(); }
    _revoke() { for (const u of this._urls || []) URL.revokeObjectURL(u); this._urls = []; }
    async renderGallery() {
        const p = document.getElementById('save-gallery'); if (!p || !p.classList.contains('show')) return;
        const list = await this.listPhotos();
        this._revoke();
        const fmt = (t) => { try { return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
        const cards = list.map(ph => {
            const u = URL.createObjectURL(ph.blob); this._urls.push(u);
            const name = ph.meta?.name || `drive-my-cv-${ph.t}.jpg`;
            return `<li><img src="${u}" alt="${esc(ph.meta?.place || 'Photo')}" data-gal-view="${u}" loading="lazy"><div><b>${esc(ph.meta?.place || 'Photo')}</b><small>${esc(fmt(ph.t))}</small></div><div class="gal-act"><a class="achv-btn" href="${u}" download="${esc(name)}">⬇︎</a><button class="achv-btn ghost" data-gal-del="${esc(ph.id)}" aria-label="Delete">🗑</button></div></li>`;
        }).join('');
        p.innerHTML = `<div class="gal-inner"><header><h2>📷 Photo gallery</h2><span>${list.length} photo${list.length === 1 ? '' : 's'} · kept in this browser${this.mode === 'idb' ? '' : ' (this session only)'}</span><button class="achv-x" data-gal="close" aria-label="Close">✕</button></header>${list.length ? `<ul class="gal-grid">${cards}</ul>` : '<p class="gal-empty">No photos yet. Press P in the game to take one.</p>'}<div class="gal-view"></div></div>`;
    }
}

/** the one store (module singleton) */
export const save = new SaveStore();
