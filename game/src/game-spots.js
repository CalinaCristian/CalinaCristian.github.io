// Game methods: walkable spots (spots/index.js) — the menu list, entering / leaving a spot, its update and
// pause handling, tour and photo hooks. Installed on Game.prototype by main.js (mixin).
import { $, CITIES } from './game-common.js';

export class SpotMethods {

    // ---------------------------------------------------------------------------------- tourist spots (spec 15, R15.4)
    /** spots/index.js loaded lazily (a broken / missing spots module never breaks the drive) */
    loadSpotsModule() {
        if (!this._spotsP) this._spotsP = import('./spots/index.js').then(m => (this.spotsMod = m)).catch(e => { console.warn('[spots] module', e); this._spotsP = null; return null; });
        return this._spotsP;
    }
    /** buttons for a list of SPOTS entries grouped Bucharest / Seattle / Bellevue (whatever SPOTS holds) */
    spotGroupsHtml(list, { heading = 'h4', button = null } = {}) {
        const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const groups = [['București', s => s.city === 'bucharest'], ['Seattle', s => s.city === 'seattle' && s.area !== 'bellevue'], ['Bellevue', s => s.area === 'bellevue']];
        const done = this.spotsMod?.spotProgress?.()?.postcards || {};
        let html = '';
        for (const [label, f] of groups) {
            const items = list.filter(f); if (!items.length) continue;
            html += `<${heading} class="spot-group">${label}</${heading}>`;
            if (button) html += items.map(s => `<div class="nav-item"><span>${done[s.id] ? '✓ ' : ''}${esc(s.name)}</span><button data-spot="${esc(s.id)}" title="${esc(s.blurb)}">${button}</button></div>`).join('');
            else html += `<div class="chs">${items.map(s => `<button data-spot="${esc(s.id)}" title="${esc(s.blurb)}">${done[s.id] ? '✓ ' : ''}${esc(s.name)}</button>`).join('')}</div>`;
        }
        return html;
    }
    /** main menu: "Bonus: Tourist spots" (always available, R15.4 default) */
    renderMenuSpots() {
        const list = this.spotsMod?.SPOTS;
        if (!list?.length) { $('#spot-select')?.remove(); return; }
        let box = $('#spot-select');
        if (!box) { const anchor = $('#chapter-select') || $('#start')?.parentElement; if (!anchor) return; box = document.createElement('details'); box.id = 'spot-select'; anchor.insertAdjacentElement('afterend', box); }
        const open = box.open;
        box.innerHTML = `<summary>🏛️ Bonus: Tourist spots <small>(${list.length}, on foot)</small></summary>${this.spotGroupsHtml(list, { heading: 'h4' })}`;
        box.open = open;
        if (!document.getElementById('spot-select-css')) {
            const st = document.createElement('style'); st.id = 'spot-select-css';
            st.textContent = '#spot-select{margin-top:10px;text-align:left}#spot-select summary{cursor:pointer;font-weight:600;padding:6px 0}#spot-select summary small{font-weight:400;opacity:.7}#spot-select h4{margin:8px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8}#spot-select .chs{display:flex;flex-wrap:wrap;gap:6px}#spot-select button{min-height:44px;padding:4px 10px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(30,41,59,.85);color:#e2e8f0;font:13px system-ui,sans-serif;cursor:pointer;text-align:left}'; // (body.in-spot HUD / touch-pad rules live in style.css)
            document.head.appendChild(st);
        }
        box.onclick = (e) => { const b = e.target.closest('[data-spot]'); if (b) this.enterSpot(b.dataset.spot); };
    }
    /** walk a tourist spot (from the menu, or from the map panel while driving / walking); the street world stays loaded */
    async enterSpot(id) {
        this.explore?.hooks?.abortDrone?.();
        if (this._spotBusy || this._transit || this._completing) return false;
        const mod = await this.loadSpotsModule();
        const entry = mod?.SPOTS?.find(s => s.id === id) || mod?.SPOTS_ALL?.find(s => s.id === id); // (menus list the reviewed SPOTS; the API / harness can open any)
        if (!entry) { this.hud.toast('🏛️ Not available', 'This tourist spot is not ready yet.', 'warn'); return false; }
        const conditions = this.travelConditions();
        this._spotBusy = true;
        this.applyRoamTime(conditions.tod, CITIES[entry.city]?.timeZone);
        this.audio.init(); this.audio.resume();
        this.photo?.close?.(); if (this.mapOpen) this.toggleMap(false);
        if (!this.spotReturn) {
            const F = this.foot;
            this.spotReturn = { state: this.state, foot: this.state === 'foot' && F?.active ? { x: F.x, z: F.z, heading: F.heading, y: F.y } : null, near: this.camera.near, far: this.camera.far };
            if (this.state === 'foot') F.exit();
            if (this.state === 'drive' && this.player) { this.player.speed = 0; this.player.steer = 0; }
        }
        this.audio.stopEngine?.();
        this.input.lookAllowed = false; this.input.releaseLock(); this.input.flush();
        this.state = 'loading'; this.hud.prompt(null);
        $('#menu').classList.remove('show'); $('#hud').classList.add('show');
        document.body.classList.add('in-spot', 'playing');
        const ld = $('#loading'), lp = ld?.querySelector('p'); if (lp && this._loadingText == null) this._loadingText = lp.textContent;
        if (lp) lp.textContent = `Walking to ${entry.name}…`; ld?.classList.add('show');
        const old = this.spot; this.spot = null; try { old?.dispose(); } catch (e) { console.warn('[spots] dispose', e); }
        try {
            this.spot = await mod.startSpot(id, { r3d: this.r3d, camera: this.camera, input: this.input, photo: this.photo, audio: this.audio, hud: this.hud,
                returnFocus: () => this.returnFocus(), onTour: (t) => this.onSpotTour(t),
                date: this.nowDate(), override: this.clock.override || null, timeZone: this.clock.timeZone,
                weather: conditions.weather, season: conditions.season,
                onProgress: (t) => { if (lp && t) lp.textContent = String(t); } });
        } catch (e) {
            console.error('[spots] start', e);
            this.spot = null; this._spotBusy = false; ld?.classList.remove('show'); if (lp) lp.textContent = this._loadingText;
            this.leaveSpot();
            this.hud.toast('🏛️ Could not open the spot', entry.name, 'warn');
            return false;
        }
        ld?.classList.remove('show'); if (lp) lp.textContent = this._loadingText;
        this.spotId = id; this.spotEntry = entry; this.state = 'spot'; this._spotSwallow = null;
        this.input.lookAllowed = true; this.input.flush(); this.frameClock.getDelta();
        this._spotBusy = false;
        return true;
    }
    /** back to where the player was: the menu, or the chapter / free drive with the car (or the walker) where it was */
    leaveSpot() {
        const conditions = this.travelConditions();
        this.explore?.hooks?.abortDrone?.();
        this.photo?.close?.();
        if (this.hud.panelOpen) this.hud.closePanel();
        const s = this.spot; this.spot = null;
        try { s?.dispose(); } catch (e) { console.warn('[spots] dispose', e); }
        document.body.classList.remove('in-spot');
        const R = this.spotReturn || { state: 'menu' }; this.spotReturn = null; this.spotId = null; this.spotEntry = null;
        this.camera.near = R.near ?? 0.2; this.camera.far = R.far ?? 5000; this.camera.updateProjectionMatrix();
        this.input.releaseLock(); this.input.flush(); this.hud.prompt(null);
        const toGame = this.world && this.player && ['drive', 'foot'].includes(R.state);
        if (toGame) {
            this.applyRoamTime(conditions.tod, this.city.timeZone);
            this.attachWorldRender();
            this.syncHeadlights(true);
            if (typeof this.r3d.setWeather === 'function') { try { this.r3d.setWeather(this.weatherOverride); } catch { /* ignore */ } }
            if (R.state === 'foot' && R.foot && this.foot) { this.foot.enter(R.foot.x, R.foot.z, R.foot.heading, R.foot.y); this.state = 'foot'; }
            else { this.player.camHolder.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0); this.state = 'drive'; }
            $('#hud').classList.add('show');
            this.input.lookAllowed = true; this.frameClock.getDelta();
        } else {
            this._menuTod = conditions.tod;
            this.r3d.releaseScene();
            this.state = 'menu'; this.input.lookAllowed = false;
            $('#hud').classList.remove('show'); $('#menu').classList.add('show'); document.body.classList.remove('playing');
            this.renderMenuSpots();
        }
        this.explore?.hooks?.afterLeaveSpot?.();
    }
    updateSpot(dt) {
        const s = this.spot; if (!s) return;
        const inp = this.input, hud = this.hud;
        if (inp.take('KeyK')) { this.buildConditions(); this.toggleConditions(); }
        if (this.condOpen) {
            if (inp.take('Escape')) this.toggleConditions(false);
            inp.lookAllowed = false; inp.flush(); this.updateClock(0); this.r3d.frame(); return;
        }
        if (this.photo?.active || hud.panelOpen || this._pauseOpen || this.explore?.drone?.active) {
            if (typeof s.cancelActivities === 'function') s.cancelActivities('mode');
            else s.spot?.ctx?.extras?.venueActivities?.cancel('mode');
        }
        // Esc / M pause — but not the Esc / M that closed the camera, a plaque or the pause panel itself (marked at keydown)
        const busy = !!(this.photo?.active || s.ui?.panelOpen || hud.panelOpen);
        if (busy) { inp.take('Escape'); inp.take('KeyM'); }
        if (this._spotSwallow) { inp.take(this._spotSwallow); this._spotSwallow = null; }
        if (hud.panelOpen) { inp.lookAllowed = false; inp.releaseLock(); inp.flush(); this.r3d.frame(); return; }
        if (!busy && inp.take('KeyM') && typeof s.openMap === 'function') { s.openMap(); this.r3d.frame(); return; } // M = the spot map (spots-core)
        if (!busy && (inp.take('Escape') || inp.take('KeyM'))) { this.togglePause(true); this.r3d.frame(); return; }
        if (!busy && this.explore?.destination && this.holdToTravel(inp, dt)) { this.fastTravelToObjective(); return; }
        inp.take('Enter'); inp.take('NumpadEnter'); inp.take('KeyR'); inp.take('KeyF'); inp.take('KeyH');
        if (!s.ui?.panelOpen) inp.lookAllowed = true;
        s.update(dt);
        this.r3d.frame();
    }
    /** pause panel in a spot: resume, other entrances of the same scene, leave */
    spotPause() {
        const s = this.spot, e = this.spotEntry || {}; if (!s) return;
        if (typeof s.cancelActivities === 'function') s.cancelActivities('pause');
        else s.spot?.ctx?.extras?.venueActivities?.cancel('pause');
        const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const R = this.spotReturn || { state: 'menu' };
        const back = R.state === 'menu' ? 'Back to the menu' : this.ch ? `Back to ${this.chapterDone ? 'free drive' : `chapter ${this.chapterIdx + 1}`}` : 'Back to the drive';
        const same = (this.spotsMod?.SPOTS || []).filter(x => x.scene && x.scene === e.scene && x.id !== this.spotId && s.spot?.spawns?.[x.id]);
        const tp = same.length ? `<h3>Walk over to</h3><div class="links">${same.map(x => `<button class="btn ghost" data-spot-act="tp" data-id="${esc(x.id)}">📍 ${esc(x.name)}</button>`).join('')}</div>` : '';
        this.input.releaseLock(); this.input.lookAllowed = false;
        this.hud.panel(`<div class="eyebrow">🏛️ Tourist spot · paused</div><h2>${esc(e.name)}</h2><p>${esc(e.blurb)}</p>${tp}<div class="links"><button class="btn primary" data-spot-act="leave">🚪 Leave tourist spot</button></div><p class="meta">${back} · Continue / Esc = keep walking</p>`);
        document.querySelectorAll('#panel [data-spot-act]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.spotAct, id = b.dataset.id;
            this.hud.closePanel();
            if (act === 'leave') this.leaveSpot();
            else if (act === 'tp' && this.spot) { this.spot.teleport(id); this.spotId = id; this.spotEntry = this.spotsMod?.SPOTS?.find(x => x.id === id) || this.spotEntry; }
        }));
    }
    /** a guided tour in a spot finished (spots-core host callback) */
    onSpotTour(t = {}) { try { window.cvTelemetry?.track?.('spot_tour', { spot: t.spot || this.spotId || null, scene: t.scene || null, stops: Array.isArray(t.stops) ? t.stops.length : (t.stops ?? null) }); } catch { /* ignore */ } }
    /** PhotoMode.onPhoto (drive, office, on foot and spots) */
    onPhoto(meta = {}, shot = null) { this.lastShot = shot;
        if (this.state === 'spot' && this.spot) {
            const r = this.spot.onPhoto(meta);
            if (!r?.postcard) this.spot.ui?.toast?.('📸 Saved', `${meta.place || 'Photo'} · ${meta.filter || ''}`);
            this.photoCount = (this.photoCount || 0) + 1; this.lastPhoto = { state: 'spot', postcard: !!r?.postcard };
        } else {
            this.photoCount = (this.photoCount || 0) + 1; this.lastPhoto = { state: this.state };
            this.hud.toast('📸 Saved', `${meta.place || 'Photo'} · ${meta.filter}`);
        }
        this.explore?.hooks?.onPhoto?.(); // (drone photos are flagged)
    }
}
