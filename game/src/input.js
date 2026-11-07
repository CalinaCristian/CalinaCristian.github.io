/**
 * Keyboard + mouse + touch input. Exposes axes: throttle (-1..1), steer (-1..1), plus edge-triggered actions
 * and a look accumulator (mouse with pointer lock / right button held, or a touch drag on the upper half).
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
        // touch look: a drag that starts on the upper half of the screen (not on a button / panel)
        const skip = (t) => t && t.closest && t.closest('button, a, select, input, label, #bigmap-wrap, #panel, #menu, .pad');
        window.addEventListener('touchstart', (e) => {
            if (!this.lookAllowed || this.touchLook) return;
            for (const t of e.changedTouches) {
                if (t.clientY < window.innerHeight * 0.5 && !skip(t.target)) { this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY }; break; }
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            const tl = this.touchLook; if (!tl) return;
            for (const t of e.changedTouches) {
                if (t.identifier !== tl.id) continue;
                this.lookDX += (t.clientX - tl.x) * 1.6; this.lookDY += (t.clientY - tl.y) * 1.6; tl.x = t.clientX; tl.y = t.clientY;
            }
        }, { passive: true });
        const end = (e) => { const tl = this.touchLook; if (!tl) return; for (const t of e.changedTouches) if (t.identifier === tl.id) this.touchLook = null; };
        window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
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
    takeLook() { const r = { dx: this.lookDX, dy: this.lookDY }; this.lookDX = this.lookDY = 0; if (!this.lookAllowed || this.lookMode === 'off' && !this.touchLook) { r.dx = r.dy = 0; } return r; }

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
        bind('[data-btn=left]', () => this.touch.steer = -1, () => { if (this.touch.steer < 0) this.touch.steer = 0; });
        bind('[data-btn=right]', () => this.touch.steer = 1, () => { if (this.touch.steer > 0) this.touch.steer = 0; });
        bind('[data-btn=gas]', () => this.touch.throttle = 1, () => { if (this.touch.throttle > 0) this.touch.throttle = 0; });
        bind('[data-btn=rev]', () => this.touch.throttle = -1, () => { if (this.touch.throttle < 0) this.touch.throttle = 0; });
        bind('[data-btn=horn]', () => { this.touch.horn = true; this.actions.add('KeyH'); }, () => this.touch.horn = false);
        bind('[data-btn=act]', () => this.actions.add('KeyE'), () => { });
        bind('[data-btn=map]', () => this.actions.add('KeyM'), () => { });
        bind('[data-btn=jump]', () => this.actions.add('Space'), () => { });
        bind('[data-btn=foot]', () => this.actions.add('Enter'), () => { }); // get out of / back into the car (spec 14)
        bind('[data-btn=run]', () => { this.touch.run = !this.touch.run; }, () => { });
    }
}
