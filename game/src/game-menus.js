// Game methods: menus — the big map and its navigation list, the pause panel (items, views, actions,
// settings) and units. Installed on Game.prototype by main.js (mixin).
import { chapterSelectHtml } from './chapters.js';
import { AIRPORTS } from './data.js';
import * as MINIMAP from './minimap.js';
import { mapPlaceActions } from './map-place-actions.js';
import { roadName, fmtDist } from './nav.js';
import { clamp } from './util.js';
import { save } from './save.js';
import { $, CITIES, fkey, mapFilter, money } from './game-common.js';

export class MenuMethods {

    // ---------------------------------------------------------------------------------- big map + nav panel
    toggleMap(open) {
        if (open) this.basketball?.cancel('map');
        if (open) { this._ftT = 0; this._ftRing?.classList.remove('on'); }
        if (open) { const h = document.getElementById('map-route-hint'); if (h) h.textContent = ''; }
        if (open && this.explore?.active) { this.explore.openWorldMap(); return; } // M while roaming: the hub (its "Here" tab is the local map); in the story M is this district map
        const was = this.mapOpen; this.mapOpen = open;
        $('#bigmap-wrap').classList.toggle('show', open);
        if (was && !open) this.returnFocus();
        if (open) {
            const c = $('#bigmap');
            const narrow = window.innerWidth < 900;
            const landscapeTouch = this.touch && window.innerWidth > window.innerHeight;
            const cssW = landscapeTouch ? window.innerWidth - 320 : narrow ? window.innerWidth - 24 : Math.min(window.innerWidth - 320, 1100);
            const cssH = landscapeTouch ? window.innerHeight - 96 : this.touch ? Math.min(window.innerHeight * 0.42, 600) : narrow ? Math.min(window.innerHeight * 0.55, 600) : Math.min(window.innerHeight - 80, 760);
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
        // (place pins: drawn by MiniMap only — one renderer, filtered by the shared map filter)
        ctx.restore();
    }
    onMapClick(e) {
        const c = $('#bigmap'); const r = c.getBoundingClientRect(); const mv = this.mapView; if (!mv) return;
        const px = (e.clientX - r.left) * (c.width / r.width), py = (e.clientY - r.top) * (c.height / r.height);
        const x = (px - c.width / 2) / mv.scale + mv.cx, z = (py - c.height / 2) / mv.scale + mv.cz;
        if (e.shiftKey) { mv.cx = x; mv.cz = z; this.redrawMap(); return; }
        const ne = this.nav.index.nearest(x, z, 400);
        const hitR = 18 * (c.width / r.width) / mv.scale;
        const place = (this.navItems || []).filter(p => (!p.cat || MINIMAP.filterOn?.(p.cat) !== false) && Math.hypot(p.x - x, p.z - z) < hitR).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
        this.setNavDest(place ? { x: place.nx ?? place.x, z: place.nz ?? place.z, label: place.label, station: place.group === 'Gas stations' } : { x, z, label: ne ? `Waypoint · ${roadName(ne.edge)}` : 'Waypoint' }, true);
        if (this.nav.route && this.hud.achievement('navigator')) this.audio.chime();
        this.audio.blip(880, 0.06, 0.08);
        this.redrawMap(); this.buildNavList();
    }
    buildNavList() {
        const ft = $('#map-fast-travel'), status = this.fastTravelStatus(); if (ft) { ft.disabled = status.disabled; ft.title = status.note; }
        const p = this.player; const items = this.navItems = [];
        const dist = (x, z) => fmtDist(Math.hypot(x - p.x, z - p.z), this.city.units);
        const add = (group, icon, label, x, z, cat = null, q = null) => { if (x === undefined || z === undefined) return; items.push({ group, icon, label, x, z, cat, nx: q?.nx ?? null, nz: q?.nz ?? null, walk: q?.walk || 0 }); };
        const n = this.nextStop;
        if (n && n.poiRef) add('Next objective', n.icon, `Next: ${n.short}`, n.poiRef.doorX ?? n.poiRef.x, n.poiRef.doorZ ?? n.poiRef.z);
        for (const s of this.stops) if (s.poiRef && s !== n) add('Offices', s.icon, `${s.short}${this.visited.has(s.id) ? ' ✓' : ''}`, s.poiRef.doorX ?? s.poiRef.x, s.poiRef.doorZ ?? s.poiRef.z, 'cv');
        if (this.airport) add('Travel', '✈️', AIRPORTS[this.city.id].name, this.airport.doorX ?? this.airport.x, this.airport.doorZ ?? this.airport.z);
        const st = [...this.stations].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).filter(s => this.stationOffered(s)).slice(0, 6);
        for (const s of st) add('Gas stations', '⛽', `${s.brand} · ${this.city.units === 'mph' ? '$' + s.price.toFixed(2) + '/gal' : s.price.toFixed(2) + ' RON/L'}`, s.x, s.z, 'fuel');
        if (this.places?.length) {
            // every reachable place of the district by category (world-data places.json): nearest first, long lists capped
            const order = ['landmark', 'spot', 'park', 'transit', 'business'], cap = { business: 60, transit: 20 }; // (CV stops: "Offices" above; fuel: "Gas stations")
            const groupName = { landmark: 'Landmarks', spot: 'Tourist spots', park: 'Parks', transit: 'Transit', business: 'Shops' };
            for (const cat of order) {
                const L = this.places.filter(q => q.cat === cat).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, cap[cat] || 40);
                for (const q of L) add(groupName[cat] || q.label, q.icon, q.name, q.x, q.z, cat, q);
            }
        } else {
            const lms = (this.bigmap.landmarks || []).slice(0, 12);
            for (const l of lms) add('Landmarks', '📍', l.label || l.name || l.id, l.x, l.z, 'landmark');
        }
        let html = '', g = '';
        if (this.foot?.active && this.carBody?.parent) html += `<div class="nav-item active"><span>🚗 Your car <small>${fmtDist(Math.hypot(this.player.x - this.foot.x, this.player.z - this.foot.z), this.city.units)}</small></span><button data-car="route">Walk there</button><button data-car="call" title="Call the car to you">📲</button></div>`;
        if (this.ch) {
            const next = this.chapters[this.chapterIdx + 1];
            if (this.chapterDone && next) html += `<div class="nav-item active"><span>▶️ Next chapter: ${next.year} · ${next.title}</span><button data-chapter="${this.chapterIdx + 1}">Go</button></div>`;
            html += chapterSelectHtml(this.chapters, this.progress, this.chapterIdx).replace('<h4>Chapters</h4>', '<h4>Chapters <small>(replay)</small></h4>');
        }
        if (this.explore?.destination?.remote) html += `<div class="nav-item active"><span>📍 ${this.explore.destination.label} <small>Another area · hold F to travel</small></span><button data-nav="-1">Clear</button></div>`;
        if (this.navManual) html += `<div class="nav-item active"><span>🧭 ${this.nav.dest?.label || 'Custom'}</span><button data-nav="-1">Clear</button></div>`;
        const spotsHere = (this.spotsMod?.SPOTS || []).filter(sp => sp.city === this.city.id);
        // collapsible groups (owner note 81: the full list was overwhelming): the essentials open, the long lists closed with a
        // count; a group's checkbox is the same category toggle as the map legend (minimap.js MAP_FILTER, shared)
        const OPEN = new Set(['Next objective', 'Offices', 'Gas stations', 'Landmarks', 'Tourist spots', 'Travel']);
        const F = mapFilter(), open = this._navOpen || (this._navOpen = {});
        const groups = []; items.forEach((it, i) => { let gr = groups[groups.length - 1]; if (!gr || gr.name !== it.group) groups.push(gr = { name: it.group, cat: it.cat, rows: [] }); gr.rows.push(i); });
        for (const gr of groups) {
            const isOpen = open[gr.name] ?? (OPEN.has(gr.name) && (!gr.cat || MINIMAP.filterOn?.(gr.cat) !== false)), cb = gr.cat && fkey(gr.cat) in F ? `<input type="checkbox" data-filter="${gr.cat}" title="Show on the map"${F[fkey(gr.cat)] ? ' checked' : ''}>` : '';
            html += `<details class="nav-group" data-group="${gr.name}"${isOpen ? ' open' : ''}><summary><span>${gr.name}</span><small>${gr.rows.length}${isOpen ? '' : ' ›'}</small>${cb}</summary>`;
            for (const i of gr.rows) { const it = items[i]; html += `<div class="nav-item"><span class="nav-place-name">${it.icon} ${it.label} <small>${dist(it.x, it.z)}${it.walk ? ` · walk the last ${fmtDist(it.walk, this.city.units)}` : ''}</small></span>${mapPlaceActions(i, it.label)}</div>`; }
            html += '</details>';
        }
        html += '<div class="nav-item active"><span>☀️ Time, weather &amp; season</span><button data-cond="1">Open</button></div>'; // (everyone; districts: the world-map hub, explore.js)
        if (spotsHere.length) html += this.spotGroupsHtml(spotsHere, { heading: 'h4', button: 'Visit' });
        $('#navlist').innerHTML = html;
    }

    // ---------------------------------------------------------------------------------- pause menu (note 72)
    /** Esc (once the mouse is free) / ⏸: Resume · (Resume story while roaming) · Map · World map · Chapters · Tourist spots ·
     *  Time, weather & season · Achievements · Drone · Photo mode · Settings · Main menu; in spots also the entrances + Leave;
     *  the game is paused. (The Explore ⇄ Story switch is gone: one mode since 2026-11-08.) */
    pauseItems() {
        const st = this.state, inGame = ['drive', 'foot', 'office'].includes(st) && !!this.world;
        const ex = this.explore, droneOn = !!ex?.drone?.active;
        const items = [['resume', '▶️', 'Resume']];
        if (ex?.active && this.chapters?.length) { const i = this.chapters.findIndex((c) => !this.progress?.done?.has(c.id)); if (i >= 0) items.push(['resume-story', '📖', 'Resume story', 'objective, nav & chapter cards back']); }
        if (droneOn) items.push(['drone-land', '🛬', 'Land drone', 'flies back to your hand']);
        if (st === 'spot') {
            const e = this.spotEntry || {}, same = (this.spotsMod?.SPOTS || []).filter(x => x.scene && x.scene === e.scene && x.id !== this.spotId && this.spot?.spot?.spawns?.[x.id]);
            for (const x of same) items.push(['tp:' + x.id, '📍', `Walk to ${x.name}`]);
            items.push(['leave-spot', '🚪', 'Leave tourist spot']);
        }
        if (inGame && st !== 'office') items.push(['map', '🗺️', 'Map & navigation']);
        if (['drive', 'foot', 'spot'].includes(st)) { const ft = this.fastTravelStatus(); items.push(['fast-travel', '⏩', 'Fast travel', ft.note, ft.disabled]); }
        if (st === 'drive' || st === 'foot') items.push(['reset-position', '🛟', 'Reset position', st === 'drive' ? 'Return to the nearest road · position only' : 'Return to the nearest sidewalk · position only', droneOn || !!this.refuel || (st === 'drive' && Math.abs(this.player?.speed || 0) >= 6)]);
        if (st === 'drive' && !droneOn) items.push(['car-exit', '🚶', 'Get out of the car']);
        if (st === 'drive' && !droneOn) items.push(['headlights', '💡', 'Headlights', this.headlightsOn ? 'On · tap to turn off' : 'Off · tap to turn on']);
        if (ex) items.push(['worldmap', '🌍', 'World map', ex.active || !this.chapters ? 'every district & tourist spot' : 'go anywhere · the story waits']);
        if (this.clamp && !this.clamp.paid && (st === 'drive' || st === 'foot')) items.push(['pay-clamp', '🔓', 'Pay fine', `wheel clamp${this.clamp.amount ? ' · ' + money(this.clamp.cur, this.clamp.amount) : ''}`]);
        if (st === 'foot' && this.carBody?.parent) items.push(['car-route', '🚗', 'Walk back to the car'], ['car-return', '🚶', 'Return to the car'], ['car-call', '📲', 'Call the car']);
        if (this.chapters) items.push(['chapters', '📖', 'Chapters']);
        if (this.spotsMod?.SPOTS?.length) items.push(['spots', '🏛️', 'Tourist spots']);
        if (['drive', 'foot', 'spot'].includes(st)) items.push(['conditions', '☀️', 'Time, weather & season']);
        if (this.achievements?.open) { let pct = null; try { pct = this.achievements.completion?.().pct; } catch { /* ignore */ } items.push(['achievements', '🏆', `Achievements${pct != null ? ` · ${pct} %` : ''}`]); }
        if (ex && !droneOn && (st === 'foot' || st === 'spot')) items.push(['drone', '🚁', 'Deploy drone']);
        if (this.photo && st !== 'drive') items.push(['photo', '📷', 'Photo mode']);
        if (this.save?.openGallery || save?.openGallery) items.push(['gallery', '🖼️', 'Photo gallery']);
        items.push(['settings', '⚙️', 'Settings']);
        items.push(['main-menu', '🏠', 'Main menu']);
        return items;
    }
    buildPause() {
        if (document.getElementById('pause-menu')) return;
        const btn = document.createElement('button'); btn.id = 'pause-btn'; btn.title = this.touch ? 'Menu & pause (Esc)' : 'Pause (Esc)'; btn.setAttribute('aria-label',btn.title); btn.textContent = this.touch ? '☰' : '⏸';
        btn.addEventListener('click', (e) => { e.preventDefault(); this.togglePause(); });
        document.body.appendChild(btn);
        const el = document.createElement('div'); el.id = 'pause-menu'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Pause');
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-pa]'); if (b && !b.disabled) this.pauseAction(b.dataset.pa, b); else if (e.target === el) this.togglePause(false); });
        el.addEventListener('input', (e) => this.pauseSetting(e.target));
        el.addEventListener('change', (e) => this.pauseSetting(e.target));
        el.addEventListener('keydown', (e) => {
            if (this.state !== 'menu' || e.key !== 'Tab') return;
            const controls = [...el.querySelectorAll('button, input, select')], first = controls[0], last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }
    get pauseOpen() { return !!this._pauseOpen; }
    togglePause(open = !this._pauseOpen, view = 'main') {
        this.buildPause();
        const el = document.getElementById('pause-menu');
        if (open && !['drive', 'foot', 'office', 'spot'].includes(this.state) && !(this.state === 'menu' && view === 'settings')) return;
        if (open) {
            if (typeof this.spot?.cancelActivities === 'function') this.spot.cancelActivities('pause');
            else this.spot?.spot?.ctx?.extras?.venueActivities?.cancel('pause');
            this.basketball?.cancel('pause');
            if (this.photo?.active) this.photo.close();
            if (this.mapOpen) this.toggleMap(false);
            if (this.condOpen) this.toggleConditions(false);
            this.input.releaseLock(); this.input.lookAllowed = false; this.input.flush();
            this._pauseOpen = true; this.renderPause(view); el.classList.add('show'); document.body.classList.add('paused');
            if (this.state === 'menu') $('#menu').inert = true;
            this.audio.stopEngine?.();
            el.querySelector('[data-pa]')?.focus({ preventScroll: true });
        } else if (this._pauseOpen) {
            this._pauseOpen = false; el.classList.remove('show'); document.body.classList.remove('paused');
            if (this.state === 'menu') { $('#menu').inert = false; $('#menu-settings')?.focus({ preventScroll: true }); this.input.flush(); }
            else this.returnFocus();
        }
    }
    renderPause(view = 'main') {
        const el = document.getElementById('pause-menu'); if (!el) return;
        const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const where = this.state === 'spot' ? (this.spotEntry?.name || 'Tourist spot') : this.state === 'office' ? (this.office?.stop?.company || 'Office')
            : this.state === 'menu' ? 'Drive My CV' : this.freeRoam ? `🗺️ Free roam · ${this.city?.districts?.[this.district]?.name || ''}` : this.ch ? `Chapter ${this.chapterIdx + 1}/${this.chapters.length} · ${this.ch.title}` : (this.city?.name || '');
        let body = '';
        if (view === 'main') body = `<div class="pm-grid">${this.pauseItems().map(([id, ic, label, note, disabled]) => `<button data-pa="${id}"${disabled ? ' disabled' : ''}><span class="ic">${ic}</span><span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span></button>`).join('')}</div>`;
        else if (view === 'chapters') body = `<div class="pm-list">${this.chapters.map((c, i) => { const ok = this.progress.reached.has(c.id) || i === 0; return `<button data-pa="chapter:${i}"${ok ? '' : ' disabled'}><span class="ic">${this.progress.done.has(c.id) ? '✓' : ok ? '▶' : '🔒'}</span><span>${c.year} · ${esc(c.title)}<small>${esc(this.city?.districts?.[c.district]?.name || CITIES[c.city]?.districts?.[c.district]?.name || c.district)}</small></span></button>`; }).join('')}</div>`;
        else if (view === 'spots') body = `<div class="pm-list">${(this.spotsMod?.SPOTS || []).map(sp => `<button data-pa="spot:${esc(sp.id)}"><span class="ic">${sp.city === 'bucharest' ? '🇷🇴' : '🇺🇸'}</span><span>${esc(sp.name)}</span></button>`).join('')}</div>`;
        else if (view === 'settings') {
            const q = this.quality, u = this.loadStr('units', 'auto'), sens = this.input.sens ?? 1, vol = this.audio.volume ?? 1;
            body = `<div class="pm-set">
${['menu', 'drive', 'foot', 'spot'].includes(this.state) ? '<button class="btn" data-pa="conditions">☀️ Time, weather & season</button>' : ''}
<label>Graphics quality <select data-set="quality">${['auto', 'ultra', 'high', 'medium', 'low'].map(x => `<option value="${x}"${x === q ? ' selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
<label>Mouse / touch look sensitivity <input type="range" data-set="sens" min="0.3" max="2.5" step="0.05" value="${sens}"></label>
<label class="cb"><input type="checkbox" data-set="invert"${this.input.invertY ? ' checked' : ''}> Invert vertical look</label>
<label>Mouse look <select data-set="look">${[['lock', 'Pointer lock (click the view)'], ['hold', 'Hold right button'], ['off', 'Off']].map(([v, l]) => `<option value="${v}"${v === this.input.lookMode ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
<label>Volume <input type="range" data-set="volume" min="0" max="1" step="0.05" value="${vol}"></label>
<label class="cb"><input type="checkbox" data-set="mute"${this.audio.muted ? ' checked' : ''}> Mute</label>
<label class="cb"><input type="checkbox" data-set="minimap"${this.opts.minimap ? ' checked' : ''}> Mini-map</label>
<label class="cb"><input type="checkbox" data-set="hud"${this.opts.hudOff ? '' : ' checked'}> HUD</label>
<label>Units <select data-set="units">${[['auto', 'Local (km/h in Bucharest, mph in Seattle)'], ['kmh', 'km/h'], ['mph', 'mph']].map(([v, l]) => `<option value="${v}"${v === u ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
        }
        const back = view === 'main' || this.state === 'menu' ? '' : '<button class="pm-back" data-pa="back">← Back</button>';
        const title = { main: 'Paused', chapters: 'Chapters', spots: 'Tourist spots', settings: 'Settings' }[view] || 'Paused';
        el.innerHTML = `<div class="pm-card"><div class="pm-head">${back}<div><div class="pm-eyebrow">${esc(where)}</div><h2>${title}</h2></div><button class="pm-x" data-pa="resume" aria-label="${this.state === 'menu' ? 'Close Settings' : 'Resume'}">✕</button></div>${body}<div class="pm-foot">Esc · ${this.state === 'menu' ? 'Back to main menu' : 'Resume'}</div></div>`;
        this._pauseView = view;
    }
    pauseAction(a, b) {
        const [k, arg] = a.split(/:(.*)/s);
        if (k === 'resume') return this.togglePause(false);
        if (k === 'back') return this.renderPause('main');
        if (['chapters', 'spots', 'settings'].includes(k)) return this.renderPause(k);
        if (k === 'fast-travel' && this.fastTravelStatus().disabled) return;
        const ex = this.explore;
        if (ex) { // explore.js API: world map, drone, back to the story; a place-changing action lands the drone first
            if (k === 'worldmap') { ex.openWorldMap(); return; }
            if (k === 'drone') { this.togglePause(false); setTimeout(() => ex.deployDrone(), 60); return; }
            if (k === 'drone-land') { this.togglePause(false); ex.landDrone(); return; }
            if (k === 'resume-story') { this.togglePause(false); ex.resumeStory(); return; }
            if (ex.drone?.active && !['photo', 'achievements'].includes(k)) ex.hooks?.abortDrone?.();
        }
        this.togglePause(false);
        if (k === 'car-exit') this.exitCar();
        else if (k === 'map') this.toggleMap(true);
        else if (k === 'fast-travel') this.fastTravelToObjective();
        else if (k === 'reset-position') this.resetPosition();
        else if (k === 'headlights') { this.headlights = !this.headlightsOn; this.hud.toast(this.headlights ? '💡 Headlights on' : '💡 Headlights off', ''); }
        else if (k === 'conditions') { this.buildConditions(); this.toggleConditions(true, { any: true }); }
        else if (k === 'achievements') this.achievements?.open?.();
        else if (k === 'photo') { if (this.state === 'drive') this.hud.toast('📷 Get out first', 'Photos are taken on foot: Enter (or 🚶) to get out.', 'warn'); else this.photo?.open?.(); }
        else if (k === 'gallery') (this.save || save)?.openGallery?.();
        else if (k === 'car-route') this.routeToCar();
        else if (k === 'car-return') this.backToCar();
        else if (k === 'car-call') this.callCar();
        else if (k === 'pay-clamp') this.payClamp();
        else if (k === 'main-menu') { this.toMainMenu(); }
        else if (k === 'leave-spot') this.leaveSpot();
        else if (k === 'tp' && this.spot) { this.spot.teleport(arg); this.spotId = arg; this.spotEntry = this.spotsMod?.SPOTS?.find(x => x.id === arg) || this.spotEntry; }
        else if (k === 'chapter') { if (this.state === 'spot') this.leaveSpot(); if (this.started) this.goToChapter(+arg); else this.start(+arg); }
        else if (k === 'spot') this.enterSpot(arg);
    }
    pauseSetting(t) {
        const k = t?.dataset?.set; if (!k) return;
        if (k === 'quality') { this.quality = t.value; this.r3d.setQuality(t.value); const q = $('#quality'); if (q) q.value = t.value; }
        else if (k === 'sens') { this.input.sens = +t.value; this.saveStr('sens', t.value); }
        else if (k === 'invert') { this.input.invertY = t.checked; this.saveOpt('invertY', t.checked); }
        else if (k === 'look') { this.opts.look = t.value; this.saveStr('look', t.value); this.input.setLookMode(t.value); this.applyOpts(); }
        else if (k === 'volume') { this.audio.setVolume?.(+t.value); this.saveStr('volume', t.value); }
        else if (k === 'mute') { this.audio.setMuted(t.checked); const m = $('#mute'); if (m) m.textContent = t.checked ? '🔇' : '🔊'; }
        else if (k === 'minimap') { this.opts.minimap = t.checked; this.saveOpt('minimap', t.checked); this.applyOpts(); }
        else if (k === 'hud') { this.opts.hudOff = !t.checked; this.saveOpt('hudOff', this.opts.hudOff); document.body.classList.toggle('hud-off', this.opts.hudOff); }
        else if (k === 'units') { this.saveStr('units', t.value); this.applyUnits(); }
    }
    /** units preference: 'auto' = the city's own, else km/h or mph everywhere */
    applyUnits() {
        if (!this.city) return;
        if (this.city._units0 === undefined) this.city._units0 = this.city.units;
        const u = this.loadStr('units', 'auto'); this.city.units = u === 'auto' ? this.city._units0 : u;
        this.hud.setUnits(this.city.units); this._closeCarScreen = true;
    }
}
