/** Keyboard + touch input. Exposes axes: throttle (-1..1), steer (-1..1), plus edge-triggered actions. */
export class Input {
    constructor() {
        this.keys = new Set();
        this.touch = { steer: 0, throttle: 0 };
        this.actions = new Set();
        this.enabled = true;
        window.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            if (e.repeat) return;
            const k = this.norm(e);
            this.keys.add(k);
            if (['Space', 'KeyH', 'KeyE', 'Enter', 'Escape', 'KeyM', 'KeyR', 'KeyC', 'KeyT', 'KeyN', 'KeyL'].includes(e.code)) this.actions.add(e.code);
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => this.keys.delete(this.norm(e)));
        window.addEventListener('blur', () => this.keys.clear());
    }
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
    }
}
