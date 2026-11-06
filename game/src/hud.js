import * as THREE from '../vendor/three.module.min.js';
import { PHRASES, ACHIEVEMENTS } from './data.js';
import { clamp } from './util.js';

const $ = (s) => document.querySelector(s);

/** DOM-based HUD: speed, street, objective, rage, ticker, toasts, bubbles, panels, prompts. */
export class HUD {
    constructor() {
        this.el = {
            speed: $('#speed'), unit: $('#speed-unit'), street: $('#street'), district: $('#district'),
            objective: $('#objective'), progress: $('#progress'), rage: $('#rage-fill'), rageWrap: $('#rage'),
            ticker: $('#ticker'), tickerText: $('#ticker span'), toasts: $('#toasts'), bubbles: $('#bubbles'),
            prompt: $('#prompt'), panel: $('#panel'), year: $('#year'), hint: $('#hint'), chapter: $('#chapter'),
            limit: $('#limit'), limitVal: $('#limit .val'), fuel: $('#fuel'), fuelFill: $('#fuel-fill'), fuelText: $('#fuel-text'),
            trip: $('#trip'), flash: $('#flash'), navline: $('#navline'),
        };
        this._limitKey = '';
        this.bubbles = [];
        this.unlocked = new Set();
        this.rage = 0;
        this.tickerQueue = []; this.tickerTimer = 0;
        this._tmp = new THREE.Vector3();
    }
    setUnits(u) { this.units = u; this.el.unit.textContent = u === 'mph' ? 'mph' : 'km/h'; }
    setSpeed(ms) { this.el.speed.textContent = this.units === 'mph' ? Math.round(Math.abs(ms) * 2.237) : Math.round(Math.abs(ms) * 3.6); }
    setStreet(name, district) { if (this.el.street.textContent !== name) this.el.street.textContent = name || ''; this.el.district.textContent = district || ''; }
    setObjective(text) { this.el.objective.innerHTML = text; }
    setProgress(done, total) { this.el.progress.textContent = `${done}/${total}`; }
    setYear(y) { this.el.year.textContent = y; }
    setChapter(t) { this.el.chapter.textContent = t; }
    setHint(t) { this.el.hint.textContent = t; }
    /** road sign with the current limit. value=null hides it. */
    setLimit(value, us, over) {
        const el = this.el.limit; if (!el) return;
        const key = value + ':' + us + ':' + over;
        if (key === this._limitKey) return; this._limitKey = key;
        el.classList.toggle('show', value != null);
        el.classList.toggle('us', !!us); el.classList.toggle('ro', !us);
        el.classList.toggle('over', !!over);
        if (value != null) this.el.limitVal.textContent = value;
    }
    setFuel(frac, text) {
        if (!this.el.fuel) return;
        const f = clamp(frac, 0, 1);
        this.el.fuelFill.style.width = (f * 100).toFixed(1) + '%';
        this.el.fuel.classList.toggle('low', f < 0.15);
        this.el.fuel.classList.toggle('mid', f >= 0.15 && f < 0.3);
        if (this.el.fuelText.textContent !== text) this.el.fuelText.textContent = text;
    }
    setTrip(text) { if (this.el.trip && this.el.trip.textContent !== text) this.el.trip.textContent = text; }
    setNavLine(html) { if (!this.el.navline) return; if (this._nav !== html) { this._nav = html; this.el.navline.innerHTML = html || ''; this.el.navline.classList.toggle('show', !!html); } }
    flash() { const f = this.el.flash; if (!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    addRage(v, max = 100) { this.rage = clamp(this.rage + v, 0, max); return this.rage; }
    update(dt, camera, cityId) {
        this.rage = Math.max(0, this.rage - dt * 1.5);
        this.el.rage.style.width = this.rage + '%';
        this.el.rageWrap.classList.toggle('hot', this.rage > 70);
        // bubbles follow their vehicle
        const now = performance.now();
        const w = window.innerWidth, h = window.innerHeight;
        this.bubbles = this.bubbles.filter(b => {
            if (now > b.until) { b.el.remove(); return false; }
            this._tmp.set(b.v.x, 2.6, b.v.z).project(camera);
            const visible = this._tmp.z < 1 && Math.abs(this._tmp.x) < 1.2 && Math.abs(this._tmp.y) < 1.2;
            b.el.style.display = visible ? 'block' : 'none';
            if (visible) {
                b.el.style.left = ((this._tmp.x + 1) / 2 * w) + 'px';
                b.el.style.top = ((1 - this._tmp.y) / 2 * h) + 'px';
                const cp = camera.getWorldPosition(this._tmp2 || (this._tmp2 = new THREE.Vector3()));
                const d = Math.hypot(b.v.x - cp.x, b.v.z - cp.z);
                b.el.style.transform = `translate(-50%,-100%) scale(${clamp(1.6 - d / 40, 0.55, 1.1)})`;
            }
            return true;
        });
        // ticker
        this.tickerTimer -= dt;
        if (this.tickerTimer <= 0 && this.tickerQueue.length) {
            const t = this.tickerQueue.shift(); this.tickerQueue.push(t);
            this.el.tickerText.textContent = '📻 ' + t;
            this.el.ticker.classList.remove('show'); void this.el.ticker.offsetWidth; this.el.ticker.classList.add('show');
            this.tickerTimer = 14;
        }
    }
    setTicker(facts) { this.tickerQueue = [...facts]; this.tickerTimer = 3; }
    bubble(v, kind, cityId) {
        const list = (PHRASES[cityId] || PHRASES.bucharest)[kind] || PHRASES.bucharest[kind];
        const text = list[Math.floor(Math.random() * list.length)];
        const el = document.createElement('div');
        el.className = 'bubble ' + (kind === 'bumped' ? 'angry' : kind === 'honkedAt' ? 'mad' : '');
        el.textContent = text;
        this.el.bubbles.appendChild(el);
        this.bubbles.push({ v, el, until: performance.now() + 2600 + Math.random() * 1200 });
        if (this.bubbles.length > 14) { const b = this.bubbles.shift(); b.el.remove(); }
    }
    toast(title, body, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.innerHTML = `<strong>${title}</strong>${body ? `<span>${body}</span>` : ''}`;
        this.el.toasts.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 4200);
    }
    achievement(id) {
        if (this.unlocked.has(id)) return false;
        const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return false;
        this.unlocked.add(id);
        this.toast('🏆 ' + a.title, a.desc, 'achv');
        return true;
    }
    prompt(text) {
        if (!text) { this.el.prompt.classList.remove('show'); return; }
        if (this.el.prompt.innerHTML !== text) this.el.prompt.innerHTML = text;
        this.el.prompt.classList.add('show');
    }
    /** full-screen panel; returns a promise resolved on close */
    panel(html, { closable = true } = {}) {
        const p = this.el.panel;
        p.innerHTML = `<div class="panel-inner">${html}${closable ? '<button class="btn close" data-close>Continue ▸</button>' : ''}</div>`;
        p.classList.add('show');
        return new Promise(res => {
            const close = () => { p.classList.remove('show'); window.removeEventListener('keydown', onKey); res(); };
            const onKey = (e) => { if (closable && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space')) { e.preventDefault(); close(); } };
            p.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
            setTimeout(() => window.addEventListener('keydown', onKey), 250);
            this._closePanel = close;
        });
    }
    closePanel() { if (this._closePanel) this._closePanel(); }
    get panelOpen() { return this.el.panel.classList.contains('show'); }
}
