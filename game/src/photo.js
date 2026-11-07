// ============================================================================
//  PHOTO MODE — pull out a camera (P / 📷), aim with the mouse or a drag, zoom with the wheel / pinch / + −,
//  pick a filter, shoot (Space / click / tap). The rendered frame is cropped to the viewfinder, filtered, framed
//  as a polaroid postcard with a caption, and saved on the device (share sheet on phones, download elsewhere).
//  Nothing is uploaded. Self-contained: it only needs to be constructed (see spec 16 for the main.js hooks).
// ============================================================================
import { fitText, drawFitText } from './canvasText.js';

const FILTERS = [
    { id: 'none', label: 'Natural', css: '' },
    { id: 'warm', label: 'Warm', css: 'sepia(.22) saturate(1.18) hue-rotate(-8deg) brightness(1.03)' },
    { id: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.18)' },
    { id: 'film', label: 'Film', css: 'contrast(1.06) saturate(.82) sepia(.16) brightness(1.04)' },
];
const FOV_MIN = 20, FOV_MAX = 90, ASPECT = 3 / 2, MAX_OUT = 1600, KEEP = 12;
const CITY_LABEL = { bucharest: 'București', seattle: 'Seattle' };

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const slug = (s) => String(s || 'photo').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
const pad2 = (n) => String(n).padStart(2, '0');

/** per-pixel filters for the saved image (match the CSS preview closely; no ctx.filter needed → works in Safari) */
export function applyFilter(canvas, id) {
    if (!id || id === 'none') return canvas;
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const cx = W / 2, cy = H / 2, R2 = cx * cx + cy * cy;
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (id === 'bw') { const v = (l - 128) * 1.18 + 128; r = g = b = v; }
        else if (id === 'warm') {
            const s = 1.18; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
            r = r * 1.08 + 6; g = g * 1.02 + 2; b = b * 0.88;
        } else if (id === 'film') {
            const s = 0.82; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
            r = (r - 128) * 1.06 + 128 + 10; g = (g - 128) * 1.06 + 128 + 6; b = (b - 128) * 1.06 + 128 - 2;
            r = 14 + r * 0.92; g = 12 + g * 0.92; b = 14 + b * 0.9;           // lifted blacks
            const x = p % W - cx, y = (p / W | 0) - cy, v = 1 - 0.35 * Math.pow((x * x + y * y) / R2, 1.4); // vignette
            const n = (rnd() - 0.5) * 18;                                      // grain
            r = r * v + n; g = g * v + n; b = b * v + n;
        }
        d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
}

/** polaroid postcard: white frame, caption (place · city · date · time), small watermark */
export function composePostcard(photo, { caption, sub = '', watermark = 'cristiancalina.com' }) {
    const pw = photo.width, ph = photo.height, m = Math.round(pw * 0.045), bottom = Math.round(ph * 0.24);
    const c = document.createElement('canvas'); c.width = pw + 2 * m; c.height = ph + m + bottom;
    const x = c.getContext('2d');
    x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, c.width, c.height);
    // paper grain
    x.fillStyle = 'rgba(120,110,90,0.035)'; for (let i = 0; i < 900; i++) x.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    x.drawImage(photo, m, m);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = Math.max(1, pw / 900); x.strokeRect(m + 0.5, m + 0.5, pw - 1, ph - 1);
    const by = m + ph, cw = pw - m * 0.5;
    x.textAlign = 'left'; x.fillStyle = '#23262b';
    const hand = (s) => `italic 600 ${s}px "Segoe Print", "Bradley Hand", "Comic Sans MS", Georgia, serif`;
    const capSize = Math.round(bottom * 0.3);
    const a = fitText(x, caption, cw, { maxSize: capSize, minSize: Math.round(capSize * 0.45), maxLines: 2, maxHeight: bottom * 0.55, font: hand, label: 'postcard caption' });
    const lh = a.size * a.lineHeight, top = by + bottom * 0.12 + a.size * 0.5;
    a.lines.forEach((l, i) => x.fillText(l, m, top + i * lh));
    if (sub) { x.fillStyle = '#6b7280'; drawFitText(x, sub, m + cw / 2, top + a.lines.length * lh + capSize * 0.1, cw, { maxSize: Math.round(capSize * 0.55), minSize: 9, font: (s) => `${s}px Georgia, serif`, label: 'postcard sub' }); }
    x.textAlign = 'right'; x.fillStyle = 'rgba(55,65,81,0.6)';
    drawFitText(x, watermark, c.width - m, c.height - m * 0.75, pw * 0.4, { maxSize: Math.round(bottom * 0.12), minSize: 8, font: (s) => `600 ${s}px "Helvetica Neue", Arial, sans-serif`, label: 'postcard watermark' });
    return c;
}

export class PhotoMode {
    /**
     * @param {object} o
     *   renderer   THREE.WebGLRenderer (its canvas is captured)
     *   getScene, getCamera  () => current scene / camera (car, on foot, office, tourist spot)
     *   hud, audio, input    game modules (optional: hud.toast, audio.ctx/master, input.keys/touch/lookAllowed)
     *   render     optional () => void that renders a fresh frame now (capture in the same task); without it the
     *              frame is grabbed in the next animation frame, right after the game rendered it
     *   getInfo    optional () => { place, district, city, cityLabel, timeZone, night }
     *   canOpen    optional () => bool (P is ignored when false); hotkey default 'KeyP'
     *   onPhoto    optional (meta) => void after each shot (tourist-spot postcard challenges, telemetry, …)
     */
    constructor(o = {}) {
        this.o = o; this.renderer = o.renderer; this.input = o.input; this.audio = o.audio; this.hud = o.hud;
        this._active = false; this.filter = 0; this.grid = true; this.fov = 60; this.gallery = [];
        this.hotkey = o.hotkey || 'KeyP';
        this._buildDom();
        this._onKey = (e) => this._key(e);
        this._onWheel = (e) => { if (!this._active) return; e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.08 : 1 / 1.08); };
        window.addEventListener('keydown', this._onKey, true);
        window.addEventListener('wheel', this._onWheel, { passive: false });
        this._pinch = null;
        window.addEventListener('touchstart', (e) => { if (this._active && e.touches.length === 2) this._pinch = { d: this._touchDist(e), fov: this.fov }; }, { passive: true });
        window.addEventListener('touchmove', (e) => { if (this._active && this._pinch && e.touches.length === 2) this.setFov(this._pinch.fov * this._pinch.d / Math.max(1, this._touchDist(e))); }, { passive: true });
        window.addEventListener('touchend', (e) => { if (e.touches.length < 2) this._pinch = null; });
        window.addEventListener('resize', () => this._layout());
    }
    get active() { return this._active; }
    get filterId() { return FILTERS[this.filter].id; }

    open() {
        if (this._active) return;
        const cam = this.o.getCamera?.(); if (!cam) return;
        this._active = true; this.cam = cam;
        // (gameplay, note 19) remember the camera exactly as the game had it, restored on close
        this._restore = { fov: cam.fov, near: cam.near, far: cam.far, zoom: cam.zoom, layers: cam.layers.mask, rotZ: cam.rotation.z };
        this.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, cam.fov || 60));
        // own the camera FOV while active: the game's own per-frame FOV damping becomes a no-op
        const self = this;
        Object.defineProperty(cam, 'fov', { configurable: true, get() { return self.fov; }, set() { } });
        cam.updateProjectionMatrix();
        this.input?.keys?.clear?.();
        if (this.input?.touch) { this._prevBrake = this.input.touch.brake; this.input.touch.brake = true; this.input.touch.throttle = 0; this.input.touch.steer = 0; }
        document.body.classList.add('photo-mode');
        this.root.classList.add('show'); this.root.classList.toggle('grid', this.grid);
        this._applyFilterPreview();
        this._layout(); this._readouts();
        this._sound('open');
        const tick = () => { if (!this._active) return; this._readouts(); this._raf = requestAnimationFrame(tick); };
        this._raf = requestAnimationFrame(tick);
    }
    close() {
        if (!this._active) return;
        this._active = false; cancelAnimationFrame(this._raf);
        const cam = this.cam, R = this._restore;
        if (cam) {
            delete cam.fov;
            // the game's own FOV (drive damping / portrait viewFor / on foot / spot), not the photo zoom (note 19)
            cam.fov = R?.fov ?? this.fov;
            if (R) { cam.near = R.near; cam.far = R.far; cam.zoom = R.zoom; cam.layers.mask = R.layers; cam.rotation.z = R.rotZ; }
            cam.updateProjectionMatrix();
        }
        this._restore = null;
        if (this.input?.touch) this.input.touch.brake = this._prevBrake || false;
        document.body.classList.remove('photo-mode');
        this.root.classList.remove('show', 'gallery-open');
        this._glCanvas().style.filter = '';
        this._sound('close');
    }
    toggle() { if (this._active) this.close(); else if (!this.o.canOpen || this.o.canOpen()) this.open(); }
    /** per-frame hook (optional): keeps the readouts fresh when the host prefers to drive it */
    update() { if (this._active) this._readouts(); }
    setFov(f) { this.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, f)); this.cam?.updateProjectionMatrix(); this._readouts(); }
    zoom(k) { this.setFov(this.fov * k); }
    cycleFilter() { this.filter = (this.filter + 1) % FILTERS.length; this._applyFilterPreview(); this._readouts(); }
    toggleGrid() { this.grid = !this.grid; this.root.classList.toggle('grid', this.grid); }

    // ------------------------------------------------------------------ capture
    /** shoot: returns a Promise of the saved shot { blob, url, name, meta } */
    shoot() {
        if (!this._active || this._busy) return Promise.resolve(null);
        this._busy = true;
        this._sound('shutter');
        return new Promise((resolve) => {
            const grab = () => {
                let photo = null;
                try { photo = this._grab(); } catch (err) { console.warn('[photo] capture failed', err); }
                this._flash();
                if (!photo) { this._busy = false; resolve(null); return; }
                applyFilter(photo, this.filterId);
                const info = this._info();
                const card = composePostcard(photo, { caption: info.caption, sub: info.sub });
                card.toBlob((blob) => {
                    this._busy = false;
                    if (!blob) { resolve(null); return; }
                    const shot = { blob, url: URL.createObjectURL(blob), name: `drive-my-cv-${slug(info.place || info.cityLabel)}-${info.stamp}.jpg`, meta: { city: info.city, place: info.place, filter: this.filterId, fov: Math.round(this.fov), w: card.width, h: card.height, bytes: blob.size } };
                    this.gallery.unshift(shot);
                    while (this.gallery.length > KEEP) URL.revokeObjectURL(this.gallery.pop().url);
                    this._renderGallery(); this._print(shot);
                    try { window.cvTelemetry?.track?.('photo_taken', { city: info.city, place: info.place, filter: this.filterId }); } catch { /* ignore */ }
                    try { this.o.onPhoto?.(shot.meta, shot); } catch (err) { console.warn('[photo] onPhoto', err); }
                    if (!this._shareCapable()) this.save(shot);
                    resolve(shot);
                }, 'image/jpeg', 0.9);
            };
            if (this.o.render) { try { this.o.render(); } catch (err) { console.warn('[photo] render', err); } grab(); }
            else requestAnimationFrame(grab); // runs right after the game's own frame callback
        });
    }
    /** crop the WebGL canvas to the viewfinder (must run in the same task as the render) */
    _grab() {
        const gl = this._glCanvas(), r = this._rect;
        const box = gl.getBoundingClientRect(), sx = gl.width / box.width, sy = gl.height / box.height;
        const x = Math.max(0, (r.x - box.left) * sx), y = Math.max(0, (r.y - box.top) * sy);
        const w = Math.min(gl.width - x, r.w * sx), h = Math.min(gl.height - y, r.h * sy);
        const k = Math.min(1, MAX_OUT / w);
        const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(gl, x, y, w, h, 0, 0, c.width, c.height);
        return c;
    }
    _shareCapable() {
        const touch = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
        try { return touch && !!navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] }); } catch { return false; }
    }
    /** share sheet on phones (needs a tap), download elsewhere */
    async save(shot, { share = false } = {}) {
        if (!shot) return false;
        if (share && navigator.share) {
            try {
                const file = new File([shot.blob], shot.name, { type: 'image/jpeg' });
                if (!navigator.canShare || navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Drive My CV' }); return true; }
            } catch (err) { if (err && err.name === 'AbortError') return false; }
        }
        const a = document.createElement('a'); a.href = shot.url; a.download = shot.name; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        return true;
    }

    // ------------------------------------------------------------------ info / readouts
    _info() {
        const i = this.o.getInfo?.() || {};
        const tz = i.timeZone || undefined, now = i.date || new Date();
        const parts = (opts) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(now); } catch { return new Intl.DateTimeFormat('en-GB', opts).format(now); } };
        const date = parts({ day: 'numeric', month: 'short', year: 'numeric' }), time = parts({ hour: '2-digit', minute: '2-digit', hour12: false });
        const ymd = parts({ year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join(''), hms = parts({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '');
        const cityLabel = i.cityLabel || CITY_LABEL[i.city] || '';
        const place = (i.place || '').trim();
        const caption = [place, cityLabel, date, time].filter(Boolean).join(' · ');
        return { ...i, place, cityLabel, date, time, caption, sub: i.sub || '', stamp: `${ymd}-${hms}`, night: !!i.night };
    }
    _readouts() {
        if (!this.root) return;
        const info = this._info(), f = Math.round(12 / Math.tan(this.fov * Math.PI / 360)); // 35 mm-equivalent focal length
        const iso = info.night ? 3200 : 100, sh = info.night ? '1/30' : '1/250';
        const t = `ISO ${iso} · ${sh} · f/2.8 · ${f} mm`;
        if (this._rt !== t) { this._rt = t; this.q.read.textContent = t; }
        const p = [info.place, info.cityLabel].filter(Boolean).join(' · '), d = `${info.date} · ${info.time}`;
        if (this._pt !== p + d) { this._pt = p + d; this.q.place.textContent = p || ' '; this.q.time.textContent = d; }
        const fl = `${FILTERS[this.filter].label} · ${(f / 24).toFixed(1)}×`;
        if (this._fl !== fl) { this._fl = fl; this.q.filter.textContent = fl; this.q.zoom.value = String(FOV_MAX + FOV_MIN - this.fov); }
    }

    // ------------------------------------------------------------------ DOM
    _glCanvas() { return this.renderer?.domElement || document.querySelector('canvas'); }
    _applyFilterPreview() { this._glCanvas().style.filter = this._active ? FILTERS[this.filter].css : ''; }
    _buildDom() {
        const r = this.root = el('div', 'photo'); r.id = 'photo';
        r.innerHTML = `
            <div class="pv-frame">
                <i class="pv-c tl"></i><i class="pv-c tr"></i><i class="pv-c bl"></i><i class="pv-c br"></i>
                <div class="pv-grid"><i></i><i></i><i></i><i></i></div>
                <div class="pv-focus"></div>
                <div class="pv-rec"><b></b>REC</div>
                <div class="pv-read"></div>
                <div class="pv-meta"><div class="pv-place"></div><div class="pv-time"></div></div>
                <div class="pv-filter"></div>
            </div>
            <div class="pv-bar">
                <button class="pv-btn" data-a="filter" title="Filter (F)">🎨</button>
                <button class="pv-btn" data-a="grid" title="Rule of thirds (G)">#</button>
                <input class="pv-zoom" type="range" min="${FOV_MIN}" max="${FOV_MAX}" step="1" title="Zoom (wheel, + −)">
                <button class="pv-shutter" data-a="shoot" title="Take the picture (Space)"></button>
                <button class="pv-btn" data-a="gallery" title="Gallery (V)">🖼️</button>
                <button class="pv-btn" data-a="close" title="Put the camera away (P / Esc)">✕</button>
            </div>
            <div class="pv-hint">Space shoot · wheel / + − zoom · F filter · G grid · V gallery · P / Esc close</div>
            <div class="pv-flash"></div>
            <div class="pv-print"><img alt="Your photo"><div class="pv-print-actions"><button class="small-btn pv-save">⬇ Save</button><button class="small-btn pv-share">Share…</button><button class="small-btn pv-dismiss">Keep shooting</button></div></div>
            <div class="pv-gallery"><div class="pv-gal-head"><span>Last ${KEEP} shots</span><button class="small-btn pv-gal-close">Close</button></div><div class="pv-gal-grid"></div></div>`;
        document.body.appendChild(r);
        const $ = (s) => r.querySelector(s);
        this.q = { frame: $('.pv-frame'), read: $('.pv-read'), place: $('.pv-place'), time: $('.pv-time'), filter: $('.pv-filter'), zoom: $('.pv-zoom'), flash: $('.pv-flash'), print: $('.pv-print'), printImg: $('.pv-print img'), galGrid: $('.pv-gal-grid') };
        const act = { filter: () => this.cycleFilter(), grid: () => this.toggleGrid(), shoot: () => this.shoot(), gallery: () => this.toggleGallery(), close: () => this.close() };
        for (const b of r.querySelectorAll('[data-a]')) b.addEventListener('click', (e) => { e.stopPropagation(); act[b.dataset.a](); });
        this.q.zoom.addEventListener('input', () => this.setFov(FOV_MAX + FOV_MIN - +this.q.zoom.value));
        // tap / click inside the viewfinder shoots (a drag looks around instead)
        let down = null;
        this.q.frame.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
        this.q.frame.addEventListener('pointerup', (e) => {
            if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
            if (moved < 8 && dt < 350 && !this._pinch && !this.input?.locked) this.shoot();
        });
        // desktop: the viewfinder lets clicks through to the game canvas (first click = pointer lock for mouse aim);
        // with the pointer locked, a left click is the shutter
        window.addEventListener('mousedown', (e) => { if (this._active && e.button === 0 && this.input?.locked) { e.preventDefault(); this.shoot(); } }, true);
        $('.pv-save').addEventListener('click', () => this.save(this.gallery[0]));
        $('.pv-share').addEventListener('click', () => this.save(this.gallery[0], { share: true }));
        $('.pv-dismiss').addEventListener('click', () => this.q.print.classList.remove('show'));
        this.q.print.addEventListener('pointerenter', () => clearTimeout(this._printT)); // stays while you decide
        $('.pv-gal-close').addEventListener('click', () => this.toggleGallery(false));
        // touch / click entry point (shown on touch devices; desktop uses P)
        const btn = this.openBtn = el('button', 'photo-open', '📷'); btn.title = 'Camera (P)';
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
        document.body.appendChild(btn);
    }
    _layout() {
        const W = innerWidth, H = innerHeight, bar = H < 520 ? 64 : 92, m = H < 520 ? 10 : 24;
        let w = Math.min(W - 2 * m, (H - bar - 2 * m) * ASPECT), h = w / ASPECT;
        const x = (W - w) / 2, y = Math.max(m, (H - bar - h) / 2);
        this._rect = { x, y, w, h };
        Object.assign(this.q.frame.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }
    _flash() { const f = this.q.flash; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    _print(shot) {
        const p = this.q.print; this.q.printImg.src = shot.url;
        p.classList.toggle('can-share', this._shareCapable());
        p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
        clearTimeout(this._printT); this._printT = setTimeout(() => p.classList.remove('show'), 12000);
    }
    toggleGallery(open = !this.root.classList.contains('gallery-open')) { this.root.classList.toggle('gallery-open', open); }
    _renderGallery() {
        const g = this.q.galGrid; g.innerHTML = '';
        for (const s of this.gallery) {
            const b = el('button', 'pv-thumb'); b.title = `Save ${s.name}`;
            const img = el('img'); img.src = s.url; img.alt = s.meta.place || 'photo'; b.appendChild(img);
            b.addEventListener('click', () => this.save(s, { share: this._shareCapable() }));
            g.appendChild(b);
        }
    }
    _touchDist(e) { const [a, b] = e.touches; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    _key(e) {
        if (e.repeat) return;
        const typing = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target !== this.q.zoom;
        if (typing) return;
        if (!this._active) {
            if (e.code === this.hotkey && (!this.o.canOpen || this.o.canOpen())) { e.preventDefault(); e.stopPropagation(); this.open(); }
            return;
        }
        // while the camera is up, it owns the keyboard (the car coasts to a stop; mouse look keeps working)
        const k = e.code;
        const map = {
            Space: () => this.shoot(), Enter: () => this.shoot(), KeyF: () => this.cycleFilter(), KeyG: () => this.toggleGrid(), KeyV: () => this.toggleGallery(),
            Equal: () => this.zoom(1 / 1.15), NumpadAdd: () => this.zoom(1 / 1.15), Minus: () => this.zoom(1.15), NumpadSubtract: () => this.zoom(1.15),
            Escape: () => (this.root.classList.contains('gallery-open') ? this.toggleGallery(false) : this.close()),
        };
        map[this.hotkey] = () => this.close();
        if (map[k]) map[k]();
        e.preventDefault(); e.stopPropagation();
    }
    _sound(kind) {
        const a = this.audio, ctx = a?.ctx; if (!ctx || a.muted) return;
        try {
            const out = a.master || ctx.destination, t = ctx.currentTime;
            if (kind === 'shutter') { // two short filtered noise clicks (mirror up / down)
                for (const [dt, f, g] of [[0, 2600, 0.5], [0.075, 1700, 0.35]]) {
                    const len = Math.round(ctx.sampleRate * 0.04), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
                    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
                    const s = ctx.createBufferSource(); s.buffer = buf;
                    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.9;
                    const gn = ctx.createGain(); gn.gain.value = g;
                    s.connect(bp).connect(gn).connect(out); s.start(t + dt);
                }
            } else { // soft beep on open / close
                const o = ctx.createOscillator(), gn = ctx.createGain();
                o.frequency.value = kind === 'open' ? 1320 : 880; gn.gain.setValueAtTime(0.06, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
                o.connect(gn).connect(out); o.start(t); o.stop(t + 0.09);
            }
        } catch { /* audio is optional */ }
    }
    dispose() {
        this.close();
        window.removeEventListener('keydown', this._onKey, true); window.removeEventListener('wheel', this._onWheel);
        for (const s of this.gallery) URL.revokeObjectURL(s.url);
        this.root.remove(); this.openBtn.remove();
    }
}
