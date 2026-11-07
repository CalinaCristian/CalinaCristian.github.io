/**
 * Keyboard + mouse + touch input. Exposes axes: throttle (-1..1), steer (-1..1), plus edge-triggered actions
 * and a look accumulator (mouse with pointer lock / right button held, or a touch drag on the right half).
 */
const ACTIONS = ['Space', 'KeyH', 'KeyE', 'Enter', 'Escape', 'KeyM', 'KeyR', 'KeyC', 'KeyT', 'KeyN', 'KeyL', 'KeyF', 'KeyB', 'KeyU', 'KeyG', 'KeyK', 'NumpadEnter'];
const LOOK_MODES = ['lock', 'hold', 'off'];

export class Input {
    constructor() {
        this.keys = new Set();
        this.touch = { steer: 0, throttle: 0 };
        this.actions = new Set();
        this.enabled = true;
        // ---- look ----
        this.lookMode = 'lock';          // 'lock' (pointer lock after a click) | 'hold' (right button) | 'off'
        this.lookAllowed = false;        // set by the game: only while driving / walking (not in menus / panels)
        this.lookDX = 0; this.lookDY = 0;
        this.rmb = false; this.touchLook = null;
        this.onLockChange = () => { };
        this._unlockAt = 0;
        window.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            if (e.repeat) return;
            const k = this.norm(e);
            // the Esc that releases the pointer lock must not also leave the office / close things
            if (e.code === 'Escape' && performance.now() - this._unlockAt < 250) return;
            this.keys.add(k);
            if (ACTIONS.includes(e.code)) this.actions.add(e.code);
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => this.keys.delete(this.norm(e)));
        window.addEventListener('blur', () => { this.keys.clear(); this.rmb = false; });
        // mouse look
        window.addEventListener('mousemove', (e) => {
            if (!this.lookAllowed) return;
            if (this.locked || (this.lookMode === 'hold' && this.rmb)) { this.lookDX += e.movementX || 0; this.lookDY += e.movementY || 0; }
        });
        document.addEventListener('pointerlockchange', () => {
            const was = this._wasLocked; this._wasLocked = this.locked;
            if (was && !this.locked) this._unlockAt = performance.now();
            this.onLockChange(this.locked);
        });
        document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
        window.addEventListener('mouseup', (e) => { if (e.button === 2) this.rmb = false; });
        this._initTouch(); // analog touch controls (cockpit-ui, round 5 note 78): see the TOUCH section below
    }
    /** wire the canvas: click → pointer lock (lock mode), right button → hold-to-look (hold mode) */
    bindLook(canvas) {
        canvas.addEventListener('contextmenu', (e) => { if (this.lookAllowed && this.lookMode !== 'off') e.preventDefault(); });
        canvas.addEventListener('mousedown', (e) => {
            if (!this.lookAllowed) return;
            if (e.button === 2 && this.lookMode === 'hold') { this.rmb = true; e.preventDefault(); }
            if (e.button === 0 && this.lookMode === 'lock' && !this.locked) this.requestLock(canvas);
        });
    }
    requestLock(canvas) {
        try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => { this.lockFailed = true; }); } catch { this.lockFailed = true; }
    }
    releaseLock() { if (this.locked) { try { document.exitPointerLock(); } catch { /* ignore */ } } this.rmb = false; this.touchLook = null; }
    get locked() { return !!document.pointerLockElement; }
    setLookMode(m) { this.lookMode = LOOK_MODES.includes(m) ? m : 'lock'; if (this.lookMode !== 'lock') this.releaseLock(); }
    /** the look gesture is active (head stays where it was put) */
    get lookHeld() { return this.locked || (this.lookMode === 'hold' && this.rmb) || !!this.touchLook; }
    /** consume the accumulated look movement → {dx, dy} in px */
    takeLook() { const r = { dx: this.lookDX * (this.sens ?? 1), dy: this.lookDY * (this.sens ?? 1) * (this.invertY ? -1 : 1) }; /* settings: sensitivity, invert Y */ this.lookDX = this.lookDY = 0; if (!this.lookAllowed || this.lookMode === 'off' && !this.touchLook) { r.dx = r.dy = 0; } return r; }

    norm(e) { return e.code; }
    get steer() {
        let s = 0;
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) s -= 1;
        if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) s += 1;
        return s || this.touch.steer;
    }
    get throttle() {
        let t = 0;
        if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) t += 1;
        if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) t -= 1;
        return t || this.touch.throttle;
    }
    get brake() { return this.keys.has('Space') || this.touch.brake; }
    get horn() { return this.keys.has('KeyH') || this.touch.horn; }
    get shift() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.touch.run; }
    /** consume an edge-triggered action */
    take(code) { if (this.actions.has(code)) { this.actions.delete(code); return true; } return false; }
    flush() { this.actions.clear(); }

    /** wire the on-screen touch buttons */
    bindTouch(root) {
        const bind = (sel, down, up) => {
            const el = root.querySelector(sel); if (!el) return;
            const d = (e) => { e.preventDefault(); down(); el.classList.add('active'); };
            const u = (e) => { e.preventDefault(); up(); el.classList.remove('active'); };
            el.addEventListener('touchstart', d, { passive: false }); el.addEventListener('touchend', u); el.addEventListener('touchcancel', u);
            el.addEventListener('mousedown', d); el.addEventListener('mouseup', u); el.addEventListener('mouseleave', u);
        };
        // (round 5: the ◀ ▶ ▲ ▼ buttons are replaced by the analog controls; the pedals are built in _buildTouchUI)
        this._buildTouchUI(root);
        bind('[data-btn=horn]', () => { this.touch.horn = true; this.actions.add('KeyH'); }, () => this.touch.horn = false);
        bind('[data-btn=act]', () => this.actions.add('KeyE'), () => { });
        bind('[data-btn=map]', () => this.actions.add('KeyM'), () => { });
        bind('[data-btn=jump]', () => this.actions.add('Space'), () => { });
        bind('[data-btn=foot]', () => this.actions.add('Enter'), () => { }); // get out of / back into the car (spec 14)
        bind('[data-btn=run]', () => { this._runToggle = !this._runToggle; this.touch.run = this._runToggle || !!this._stickRun; }, () => { });
    }

    // =================================================================================================================
    //  TOUCH (cockpit-ui, round 5 note 78): analog controls.
    //  · left half: driving → horizontal steer drag from where the thumb lands (auto-centres on release);
    //    on foot / drone → floating thumbstick (appears under the thumb; analog walk + turn, run at the edge)
    //  · right half: drag anywhere (not on a button) to look; driving → analog gas / brake pedals at the bottom right
    //  · `touch.stick = {x, y, mag, active}` (−1..1, y + = back) for any mode; `setTouchMode('drive'|'foot'|'drone'|null)`
    //    overrides the automatic mode (on-foot / office / spot classes → foot). Sensitivity: `sens` (settings).
    // =================================================================================================================
    setTouchMode(m) { this.touchMode = m || null; document.body.classList.toggle('tmode-foot', m === 'foot' || m === 'drone'); document.body.classList.toggle('tmode-drive', m === 'drive'); }
    get touchModeNow() {
        if (this.touchMode) return this.touchMode;
        const b = document.body, hud = document.getElementById('hud');
        return b.classList.contains('on-foot') || b.classList.contains('in-spot') || b.classList.contains('drone-mode') || hud?.classList.contains('in-office') ? 'foot' : 'drive';
    }
    _initTouch() {
        this.touch.stick = { x: 0, y: 0, mag: 0, active: false };
        this._tL = null; // left control {id, ox, oy, mode}
        const skip = (t) => t && t.closest && t.closest('button, a, select, input, label, #bigmap-wrap, #panel, #menu, .pad, .tpedal, .photo-open, #finale, #chapter-transition, .overlay.show');
        const R = () => Math.max(46, Math.min(70, Math.min(innerWidth, innerHeight) * 0.11)); // stick radius (px)
        window.addEventListener('touchstart', (e) => {
            if (!this.enabled) return;
            for (const t of e.changedTouches) {
                if (skip(t.target)) continue;
                const left = t.clientX < innerWidth * 0.5;
                if (left && !this._tL) {
                    const mode = this.touchModeNow;
                    this._tL = { id: t.identifier, ox: t.clientX, oy: t.clientY, mode };
                    this._showStick(mode, t.clientX, t.clientY);
                } else if (!left && !this.touchLook && this.lookAllowed) this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            for (const t of e.changedTouches) {
                const tl = this.touchLook;
                if (tl && t.identifier === tl.id) { this.lookDX += (t.clientX - tl.x) * 1.6; this.lookDY += (t.clientY - tl.y) * 1.6; tl.x = t.clientX; tl.y = t.clientY; continue; }
                const L = this._tL; if (!L || t.identifier !== L.id) continue;
                const r = R(); let dx = (t.clientX - L.ox) / r, dy = (t.clientY - L.oy) / r;
                if (L.mode === 'drive') { // steering: horizontal only, gentle centre (expo) + full lock at the edge
                    const s = Math.max(-1, Math.min(1, (t.clientX - L.ox) / (r * 1.8)));
                    this.touch.steer = Math.sign(s) * Math.pow(Math.abs(s), 1.35);
                    this.touch.stick.x = s; this.touch.stick.y = 0; this.touch.stick.mag = Math.abs(s); this.touch.stick.active = true;
                    this._moveStick(s, 0, true);
                } else {
                    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
                    const mag = Math.min(1, m), dead = 0.12, k = mag < dead ? 0 : (mag - dead) / (1 - dead);
                    Object.assign(this.touch.stick, { x: dx, y: dy, mag, active: true });
                    this.touch.throttle = -dy * k / Math.max(mag, 1e-3) * Math.min(1, mag); this.touch.steer = dx * k / Math.max(mag, 1e-3) * Math.min(1, mag) * 0.85;
                    this._stickRun = m > 0.95; this.touch.run = this._stickRun || this._runToggle;
                    this._moveStick(dx, dy, false);
                }
            }
        }, { passive: true });
        const end = (e) => {
            for (const t of e.changedTouches) {
                if (this.touchLook && t.identifier === this.touchLook.id) this.touchLook = null;
                if (this._tL && t.identifier === this._tL.id) {
                    this._tL = null; this.touch.steer = 0; if (!this._pedal) this.touch.throttle = 0;
                    Object.assign(this.touch.stick, { x: 0, y: 0, mag: 0, active: false }); this._stickRun = false; this.touch.run = !!this._runToggle;
                    this._hideStick();
                }
            }
        };
        window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
    }
    _buildTouchUI(root) {
        const host = root.querySelector?.('#touch') || document.getElementById('touch'); if (!host || host.querySelector('.tstick')) return;
        const stick = document.createElement('div'); stick.className = 'tstick'; stick.innerHTML = '<div class="tknob"></div>'; host.appendChild(stick);
        const wheel = document.createElement('div'); wheel.className = 'twheel'; wheel.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="9"/><path d="M8 50h28M64 50h28M50 58v34" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="50" r="10" fill="currentColor"/></svg>'; host.appendChild(wheel);
        const pedals = document.createElement('div'); pedals.className = 'tpedals';
        pedals.innerHTML = '<div class="tpedal brake" data-pedal="brake"><span>BRAKE</span><i></i></div><div class="tpedal gas" data-pedal="gas"><span>GAS</span><i></i></div>';
        host.appendChild(pedals);
        this._ui = { stick, knob: stick.firstChild, wheel };
        // analog pedals: pressure = how far up the pedal the thumb is (bottom ≈ 35 %, top = 100 %), slides with the thumb
        for (const el of pedals.querySelectorAll('.tpedal')) {
            const gas = el.dataset.pedal === 'gas', bar = el.querySelector('i');
            const val = (t) => { const r = el.getBoundingClientRect(); return Math.max(0.35, Math.min(1, 0.35 + 0.65 * (r.bottom - t.clientY) / r.height * 1.15)); };
            let id = null;
            const set = (v) => { if (gas) this.touch.throttle = v; else { this.touch.throttle = -v; this.touch.brake = v > 0.5; } bar.style.transform = `scaleY(${v})`; el.classList.toggle('active', v > 0); this._pedal = v > 0 ? el.dataset.pedal : null; };
            el.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; id = t.identifier; set(val(t)); }, { passive: false });
            el.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) set(val(t)); }, { passive: false });
            const up = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; set(0); this.touch.brake = false; this.touch.throttle = 0; } };
            el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
            el.addEventListener('mousedown', () => set(0.9)); el.addEventListener('mouseup', () => { set(0); this.touch.brake = false; }); el.addEventListener('mouseleave', () => { if (this._pedal === el.dataset.pedal) { set(0); this.touch.brake = false; } });
        }
    }
    _showStick(mode, x, y) {
        const u = this._ui; if (!u) return;
        const el = mode === 'drive' ? u.wheel : u.stick;
        el.style.left = `${x}px`; el.style.top = `${y}px`; el.classList.add('show');
        if (mode !== 'drive') u.knob.style.transform = 'translate(-50%, -50%)';
        else u.wheel.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }
    _moveStick(x, y, drive) {
        const u = this._ui; if (!u) return;
        if (drive) u.wheel.style.transform = `translate(-50%, -50%) rotate(${x * 120}deg)`;
        else { const r = u.stick.clientWidth / 2 || 60; u.knob.style.transform = `translate(calc(-50% + ${x * r}px), calc(-50% + ${y * r}px))`; }
    }
    _hideStick() { const u = this._ui; if (!u) return; u.stick.classList.remove('show'); u.wheel.classList.remove('show'); u.wheel.style.transform = 'translate(-50%, -50%) rotate(0deg)'; }
}
