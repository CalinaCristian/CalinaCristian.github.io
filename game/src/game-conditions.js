// Game methods: conditions — the city clock and time of day, live / overridden weather, seasons, traffic
// hours, headlights, and the free-roam conditions panel (hour, weather, season). Installed on Game.prototype by
// main.js (mixin).
import { $, BAND_TEXT, CITIES, localHours, OVERRIDE_HOURS, PHASE_ICON, phaseFromHours, SEASON_ICON, seasonText, WEATHER_OVERRIDES, weatherKind, WX_GRIP, WX_ICON, WX_LABEL, WX_NPC } from './game-common.js';

export class ConditionsMethods {

    /** real local time of the current city (or the menu override) + day phase + NPC lights */
    updateClock(dt) {
        const c = this.clock; c.date = this.nowDate();
        const h = c.override ? OVERRIDE_HOURS[c.override] : localHours(c.date, c.timeZone);
        c.hours = h;
        if (this.r3d && (this.scene || this.state === 'spot')) {
            this.r3d.setClock({ date: c.date, override: c.override || null });
            if (this.state !== 'spot') this.syncHeadlights();
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
        if (this.traffic) this.traffic.weatherKind = k; // pedestrians' umbrellas / coats (crowd.js)
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
    cityHours() { const c = this.clock; return c.override ? OVERRIDE_HOURS[c.override] : localHours(this.nowDate(), c.timeZone); }
    /** the game's "now": real time, shifted by the free-roam time-of-day pick (clock.offsetMs) */
    nowDate() { return new Date(Date.now() + (this.clock.offsetMs || 0)); }
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
    // ---------------------------------------------------------------------------------- free roam (spec 10, R10.10)
    /** every district (story order), with its city and the chapter start the car is put at */
    roamDistricts() {
        const out = [], seen = new Set();
        for (const ch of this.chapters || []) {
            if (seen.has(ch.district)) continue; seen.add(ch.district);
            const c = CITIES[ch.city], d = c?.districts?.[ch.district]; if (!d) continue;
            out.push({ id: ch.district, city: ch.city, cityName: ch.city === 'bucharest' ? 'București' : 'Seattle area', name: d.name || ch.district, label: d.label || '', start: ch.start, years: ch.year });
        }
        return out;
    }
    /** time-of-day pick → clock: rush / noon shift the real clock to that local hour (real sun), golden hour / night use the render looks */
    applyRoamTime(tod, timeZone) {
        const c = this.clock; c.offsetMs = 0; c.override = null;
        c.timeZone = timeZone || c.timeZone;
        const H = tod === 'dawn' ? 6.5 : tod === 'rush' ? 8.5 : tod === 'noon' ? 12.5 : /^h\d/.test(tod) ? Number(tod.slice(1)) : null;
        if (H != null) { const h0 = localHours(new Date(), c.timeZone); c.offsetMs = (((H - h0) % 24 + 24) % 24) * 3600e3; }
        else if (tod === 'golden') c.override = 'sunset';
        else if (tod === 'night') c.override = 'night';
        else if (tod === 'dusk' || tod === 'day') c.override = tod;
    }
    /** Explicit conditions travel with the player; live time/weather remain local to the destination. */
    travelConditions() {
        const c = this.clock, pick = c.override === 'sunset' ? 'golden' : c.override;
        return { tod: (this.state === 'menu' ? this._menuTod : null) ?? this.freeRoam?.tod ?? pick ?? (c.offsetMs ? 'h' + localHours(this.nowDate(), c.timeZone) : 'now'),
            weather: this.weatherOverride || 'live', season: this.r3d?._seasonOverride || 'auto' };
    }
    // ---------------------------------------------------------------------------------- free-roam conditions panel (R10.10)
    /** ☀️ button (HUD) + panel: 24 h slider + presets, weather, season — applied live through the render API */
    buildConditions() {
        if (document.getElementById('cond-panel')) { this.syncConditions(); return; }
        const btn = document.createElement('button'); btn.id = 'cond-btn'; btn.title = 'Time, weather & season (K)'; btn.textContent = '☀️';
        btn.addEventListener('click', (e) => { e.preventDefault(); this.toggleConditions(); });
        $('#hud')?.appendChild(btn);
        const el = document.createElement('div'); el.id = 'cond-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Conditions');
        const pre = [['now', 'Live'], ['dawn', '🌅 Dawn'], ['rush', '🚦 Rush 08:30'], ['noon', '☀️ Noon'], ['day', '☀️ Day'], ['golden', '🌇 Golden hour'], ['dusk', '🌆 Dusk'], ['night', '🌙 Night']];
        const wx = [['live', 'Live'], ['clear', '☀️ Clear'], ['cloudy', '☁️ Cloudy'], ['drizzle', '🌦️ Drizzle'], ['rain', '🌧️ Rain'], ['storm', '⛈️ Storm'], ['fog', '🌫️ Fog'], ['snow', '🌨️ Snow']];
        const se = [['auto', 'Auto'], ['spring', '🌸 Spring'], ['summer', '☀️ Summer'], ['autumn', '🍂 Autumn'], ['winter', '❄️ Winter']];
        const chips = (name, list) => `<div class="cond-chips" data-group="${name}">${list.map(([v, l]) => `<button data-${name}="${v}">${l}</button>`).join('')}</div>`;
        el.innerHTML = `<div class="cond-head"><b>Conditions</b><button class="cond-x" data-close aria-label="Close">✕</button></div>
<div class="cond-sec"><div class="cond-lbl">Time of day <output id="cond-time">--:--</output></div><input id="cond-hour" type="range" min="0" max="23.75" step="0.25" aria-label="Hour of day">${chips('tod', pre)}</div>
<div class="cond-sec"><div class="cond-lbl">Weather</div>${chips('wx', wx)}</div>
<div class="cond-sec"><div class="cond-lbl">Season</div>${chips('season', se)}</div>
<div class="cond-foot"><span data-cond-note>Traffic follows the hour · game paused</span><span class="cond-keys"> · <kbd>K</kbd> / <kbd>Esc</kbd> closes</span></div>`;
        document.body.appendChild(el);
        el.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.hasAttribute('data-close')) return this.toggleConditions(false);
            if (b.dataset.tod) this.setRoamTime(b.dataset.tod);
            else if (b.dataset.wx) this.setRoamWeather(b.dataset.wx);
            else if (b.dataset.season) this.setRoamSeason(b.dataset.season);
        });
        el.querySelector('#cond-hour').addEventListener('input', (e) => this.setRoamHour(+e.target.value));
        el.addEventListener('keydown', (e) => {
            // Keep keyboard navigation inside the open dialog; native range arrows still work.
            if (e.key !== 'Tab') return;
            const controls = [...el.querySelectorAll('button, input')], first = controls[0], last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        this.syncConditions();
    }
    toggleConditions(open = !this.condOpen, { any = false } = {}) {
        const el = document.getElementById('cond-panel'); if (!el) { this.condOpen = false; return; }
        if (open && !['menu', 'drive', 'foot', 'spot'].includes(this.state)) return;
        if (open && this.mapOpen) this.toggleMap(false);
        this.condOpen = !!open; el.classList.toggle('show', this.condOpen); document.body.classList.toggle('cond-open', this.condOpen);
        if (this.condOpen) {
            if (typeof this.spot?.cancelActivities === 'function') this.spot.cancelActivities('conditions');
            else this.spot?.spot?.ctx?.extras?.venueActivities?.cancel('conditions');
            this.input.releaseLock(); this.input.lookAllowed = false; this.input.flush();
            if (this.player) this.player.speed *= 0.2;
            if (this.state === 'menu') $('#menu').inert = true;
            this.syncConditions(); el.querySelector('[data-close]')?.focus({ preventScroll: true });
        } else if (this.state === 'menu') { $('#menu').inert = false; this.togglePause(true, 'settings'); }
        else this.returnFocus();
    }
    /** a local hour (0..24) in the district's city: the real sun at that hour, traffic for that hour */
    setRoamHour(h) {
        const c = this.clock; c.override = null;
        const h0 = localHours(new Date(), c.timeZone); c.offsetMs = (((h - h0) % 24 + 24) % 24) * 3600e3;
        if (this.state === 'menu') this._menuTod = 'h' + h;
        if (this.freeRoam) this.freeRoam.tod = 'h' + h;
        this.updateClock(0);
        if (this.state === 'spot') this.spot?.setConditions?.({ date: this.nowDate(), override: c.override, timeZone: c.timeZone });
        else this.traffic?.setHour(this.trafficHours(), true);
        this.syncConditions();
    }
    setRoamTime(tod) {
        if (/^h\d/.test(tod)) return this.setRoamHour(Number(tod.slice(1)));
        const H = { dawn: 6.5, rush: 8.5, noon: 12.5 }[tod];
        if (H != null) return this.setRoamHour(H);
        const c = this.clock; c.offsetMs = 0; c.override = tod === 'golden' ? 'sunset' : ['dusk', 'night', 'day'].includes(tod) ? tod : null;
        if (this.state === 'menu') this._menuTod = tod;
        if (this.freeRoam) this.freeRoam.tod = tod;
        this.updateClock(0);
        if (this.state === 'spot') this.spot?.setConditions?.({ date: this.nowDate(), override: c.override, timeZone: c.timeZone });
        else this.traffic?.setHour(this.trafficHours(), true);
        this.syncConditions();
    }
    setRoamWeather(w) {
        if (this.freeRoam) this.freeRoam.weather = w;
        if (this.state === 'menu') this.weatherOverride = WEATHER_OVERRIDES.includes(w) ? w : null; // no live request before a place is loaded
        else this.setWeatherOverride(w === 'live' ? null : w);
        if (this.state === 'spot') this.spot?.setConditions?.({ weather: w });
        if (this.traffic && w !== 'live') this.traffic.weatherKind = w;
        this.syncConditions();
    }
    setRoamSeason(s) {
        if (this.freeRoam) this.freeRoam.season = s;
        if (this.state === 'spot' && typeof this.spot?.setConditions === 'function') this.spot.setConditions({ season: s });
        else this.r3d.setSeason?.(s === 'auto' ? null : s);
        this.syncConditions();
    }
    syncConditions() {
        const selected = this.travelConditions(), tod = ({ 'h6.5': 'dawn', 'h8.5': 'rush', 'h12.5': 'noon' })[selected.tod] || selected.tod;
        const time = $('#timeofday'), value = ({ now: 'real', golden: 'sunset' })[tod] || tod;
        if (time) {
            time.querySelector('[data-custom-hour]')?.remove();
            if (/^h\d/.test(value)) {
                const h = Number(value.slice(1)), option = new Option(`${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round(h % 1 * 60)).padStart(2, '0')} local time`, value);
                option.dataset.customHour = ''; time.add(option);
            }
            time.value = value;
        }
        const weather = $('#weather'); if (weather) weather.value = selected.weather === 'live' ? 'real' : selected.weather;
        const el = document.getElementById('cond-panel'); if (!el) return;
        if (this.state === 'menu') this.clock.date = this.nowDate();
        const c = this.clock, h = c.override ? OVERRIDE_HOURS[c.override] : localHours(this.nowDate(), c.timeZone);
        const sl = el.querySelector('#cond-hour'); if (sl && document.activeElement !== sl) sl.value = String(Math.round(h * 4) / 4 % 24);
        const o = el.querySelector('#cond-time'); if (o) o.textContent = this.clockText();
        for (const [key, value] of [['tod', tod], ['wx', selected.weather], ['season', selected.season]]) {
            for (const b of el.querySelectorAll(`[data-${key}]`)) {
                const on = b.dataset[key] === value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
            }
        }
        el.querySelector('[data-cond-note]').textContent = this.state === 'menu' ? 'Applies to New story and world-map starts · Continue restores saved conditions' : this.state === 'spot' ? 'Local scene conditions · activity paused' : 'Traffic follows the hour · game paused';
    }
}
