// ============================================================================
//  Spot UI: DOM overlay for tourist-spot scenes — title card, interaction
//  prompt, plaque reader (title, text, artist credit, source link), toasts,
//  postcard-challenge tracker, crosshair, and chat bubbles that follow people
//  (same look as the driving reactions: `.bubble`, translation line below).
//  3-D plaques (post + angled bronze board with readable text) live here too.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { canvas, canvasTexture, fitDraw } from './kit.js';

const CSS = `
#spot-ui{position:fixed;inset:0;pointer-events:none;z-index:20;font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f5f5f4}
#spot-ui .sp-card{position:absolute;top:12px;left:12px;max-width:min(360px,calc(100vw - 24px));background:rgba(15,18,22,.62);backdrop-filter:blur(6px);border-radius:12px;padding:9px 13px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
#spot-ui .sp-card b{display:block;font-size:15px;letter-spacing:.2px}
#spot-ui .sp-card span{display:block;opacity:.78;font-size:12px}
#spot-ui .sp-chal{margin-top:6px;font-size:12px;opacity:.95}
#spot-ui .sp-chal.done{color:#86efac}
#spot-ui .sp-prompt{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);background:rgba(15,18,22,.72);padding:8px 14px;border-radius:999px;font-weight:600;white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity .15s}
#spot-ui .sp-prompt.show{opacity:1}
#spot-ui .sp-prompt kbd{display:inline-block;background:#f5f5f4;color:#111;border-radius:5px;padding:0 6px;margin-right:6px;font:700 12px/18px system-ui}
#spot-ui .sp-cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.35);opacity:0}
#spot-ui .sp-cross.show{opacity:1}
#spot-ui .sp-panel{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);pointer-events:auto}
#spot-ui .sp-panel.show{display:flex}
#spot-ui .sp-plaque{width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;background:linear-gradient(160deg,#4a3b23,#2f2616);border:3px solid #a8894f;border-radius:10px;padding:20px 22px;color:#f3e7c9;box-shadow:0 20px 60px rgba(0,0,0,.55);font-family:Georgia,"Times New Roman",serif}
#spot-ui .sp-plaque h3{margin:0 0 4px;font-size:22px;letter-spacing:.5px;color:#ffe6a8}
#spot-ui .sp-plaque .sp-place{font:600 11px/1.4 system-ui;text-transform:uppercase;letter-spacing:1.2px;opacity:.7;margin-bottom:10px}
#spot-ui .sp-plaque p{margin:0 0 12px;font-size:16px;line-height:1.5}
#spot-ui .sp-plaque .sp-credit{font:italic 13px Georgia,serif;opacity:.9;margin-bottom:8px}
#spot-ui .sp-plaque .sp-src{font:12px system-ui;opacity:.8;word-break:break-all}
#spot-ui .sp-plaque .sp-src a{color:#ffd98a}
#spot-ui .sp-plaque button{margin-top:12px;font:600 14px system-ui;background:#a8894f;color:#1d160a;border:0;border-radius:8px;padding:8px 16px;cursor:pointer}
#spot-ui .sp-toasts{position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end;max-width:min(340px,calc(100vw - 24px))}
#spot-ui .sp-toast{background:rgba(15,18,22,.78);border-left:3px solid #fbbf24;border-radius:8px;padding:8px 12px;transform:translateX(30px);opacity:0;transition:all .3s}
#spot-ui .sp-toast.show{transform:none;opacity:1}
#spot-ui .sp-toast b{display:block}
#spot-ui .sp-help{position:absolute;left:12px;bottom:10px;font-size:11px;opacity:.6;max-width:calc(100vw - 24px)}
#spot-ui .sp-bubbles{position:absolute;inset:0;overflow:hidden}
#spot-ui .bubble{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#111;padding:7px 12px;border-radius:14px;font-size:14px;font-weight:700;white-space:normal;max-width:min(300px,70vw);text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.3);animation:sp-pop .25s ease-out}
#spot-ui .bubble::after{content:'';position:absolute;left:50%;bottom:-8px;margin-left:-8px;border:8px solid transparent;border-top-color:#fff;border-bottom:0}
#spot-ui .bubble.angry{background:#fca5a5}#spot-ui .bubble.angry::after{border-top-color:#fca5a5}
#spot-ui .bubble.friendly{background:#e0f2fe}#spot-ui .bubble.friendly::after{border-top-color:#e0f2fe}
#spot-ui .bubble small{display:block;opacity:.72;font-size:.85em;font-weight:500;margin-top:2px;font-style:italic}
@keyframes sp-pop{from{transform:translate(-50%,-80%) scale(.6);opacity:0}}
#spot-ui .sp-mini{position:absolute;right:12px;bottom:12px;width:168px;height:168px;border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.75);pointer-events:auto;cursor:pointer;background:#1c2125}
#spot-ui .sp-mini canvas{width:100%;height:100%;display:block}
#spot-ui .sp-mini b{position:absolute;left:6px;top:4px;font:700 10px system-ui;color:#fff;text-shadow:0 1px 2px #000;letter-spacing:.5px}
#spot-ui .sp-map{width:min(960px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;gap:12px;background:rgba(18,21,25,.94);border-radius:14px;padding:12px;box-shadow:0 20px 60px rgba(0,0,0,.55);flex-wrap:wrap}
#spot-ui .sp-map canvas{flex:1 1 520px;min-width:0;max-width:100%;aspect-ratio:1;border-radius:10px;background:#20262b}
#spot-ui .sp-map .sp-side{flex:0 1 300px;min-width:220px;overflow:auto;max-height:calc(100vh - 60px);font-size:13px}
#spot-ui .sp-map h3{margin:0 0 6px;font-size:17px}
#spot-ui .sp-map ul{list-style:none;margin:6px 0 10px;padding:0}
#spot-ui .sp-map li{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.08)}
#spot-ui .sp-map li.done{opacity:.6;text-decoration:line-through}
#spot-ui .sp-map button{font:600 13px system-ui;background:#fbbf24;color:#1d160a;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;margin:4px 6px 0 0}
#spot-ui .sp-map .sp-legend span{display:inline-block;margin:0 10px 4px 0;opacity:.85}
#spot-ui .sp-tour{margin-top:6px;font-size:12px;border-top:1px solid rgba(255,255,255,.15);padding-top:5px}
#spot-ui .sp-tour div{opacity:.9}#spot-ui .sp-tour .done{opacity:.55;text-decoration:line-through}#spot-ui .sp-tour .cur{color:#fde68a;font-weight:700}
body.photo-mode #spot-ui .sp-mini,
body.photo-mode #spot-ui .sp-card,body.photo-mode #spot-ui .sp-prompt,body.photo-mode #spot-ui .sp-help,body.photo-mode #spot-ui .sp-cross{display:none}
@media (max-width:600px){#spot-ui .sp-help{display:none}#spot-ui .bubble{font-size:12px}#spot-ui .sp-mini{width:112px;height:112px}}
`;

export class SpotUI {
    constructor(root = document.body) {
        if (!document.getElementById('spot-ui-css')) { const st = document.createElement('style'); st.id = 'spot-ui-css'; st.textContent = CSS; document.head.appendChild(st); }
        const el = this.el = document.createElement('div'); el.id = 'spot-ui';
        el.innerHTML = `<div class="sp-bubbles"></div><div class="sp-card"><b></b><span></span><div class="sp-chal"></div><div class="sp-tour"></div></div><div class="sp-mini" title="Map (G)"><canvas width="168" height="168"></canvas><b>N ↑</b></div>
            <div class="sp-cross"></div><div class="sp-prompt"></div><div class="sp-toasts"></div><div class="sp-help"></div><div class="sp-panel"></div>`;
        root.appendChild(el);
        this.$ = (s) => el.querySelector(s);
        this.bubbles = new BubbleLayer(this.$('.sp-bubbles'));
        this._prompt = null;
    }
    setTitle(name, sub) { this.$('.sp-card b').textContent = name; this.$('.sp-card span').textContent = sub || ''; }
    setHelp(t) { this.$('.sp-help').textContent = t || ''; }
    setChallenge(text, done = false) { const c = this.$('.sp-chal'); c.textContent = text ? (done ? '✅ ' : '📷 ') + text : ''; c.classList.toggle('done', !!done); }
    prompt(html) {
        if (html === this._prompt) return; this._prompt = html;
        const p = this.$('.sp-prompt'); if (html) p.innerHTML = html; p.classList.toggle('show', !!html);
    }
    crosshair(on) { this.$('.sp-cross').classList.toggle('show', !!on); }
    toast(title, body = '') {
        const t = document.createElement('div'); t.className = 'sp-toast'; t.innerHTML = `<b></b><span></span>`;
        t.querySelector('b').textContent = title; t.querySelector('span').textContent = body;
        this.$('.sp-toasts').appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4200);
    }
    get panelOpen() { return this.$('.sp-panel').classList.contains('show'); }
    /** plaque reader; resolves when closed */
    showPlaque(pl, place = '') {
        const p = this.$('.sp-panel');
        const src = pl.source_url ? `<div class="sp-src">Source: <a href="${encodeURI(pl.source_url)}" target="_blank" rel="noopener">${esc(pl.source_url)}</a></div>` : '';
        p.innerHTML = `<div class="sp-plaque"><div class="sp-place">${esc(place)}</div><h3>${esc(pl.title)}</h3><p>${esc(pl.text)}</p>${pl.credit ? `<div class="sp-credit">${esc(pl.credit)}</div>` : ''}${src}<button data-close>Close (E)</button></div>`;
        p.classList.add('show');
        return new Promise((res) => {
            // note 21: the closing key is consumed (its keyup too, so it neither re-opens the plaque nor opens the pause
            // menu), focus leaves the panel; the session hands focus back to the game (pointer lock on the next click)
            const swallowUp = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keyup', swallowUp, true); };
            const close = (e) => { if (!p.classList.contains('show')) return; p.classList.remove('show'); window.removeEventListener('keydown', key, true); if (e?.type === 'keydown') window.addEventListener('keyup', swallowUp, true); document.activeElement?.blur?.(); p.innerHTML = ''; this._closePanel = null; res(); };
            const key = (e) => { if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(e); } };
            p.querySelector('[data-close]').onclick = () => close();
            p.onclick = (e) => { if (e.target === p) close(); };
            setTimeout(() => window.addEventListener('keydown', key, true), 120);
            this._closePanel = close;
        });
    }
    closePanel() { this._closePanel?.(); }
    /** tour checklist under the title card: [{label, done, cur}] or null */
    setTour(items, title = 'Guided tour') {
        const el = this.$('.sp-tour'); if (!items) { el.innerHTML = ''; el.style.display = 'none'; return; }
        el.style.display = ''; el.innerHTML = `<b>🚩 ${esc(title)}</b>` + items.map((it) => `<div class="${it.done ? 'done' : it.cur ? 'cur' : ''}">${it.done ? '✓' : it.cur ? '▶' : '○'} ${esc(it.label)}</div>`).join('');
    }
    /**
     * full spot map (notes 32/33/67): the map with every objective + legend + checklist + tour button. Same panel
     * discipline as the plaque (closing key consumed, focus back to the game). `map` is the SpotMap; resolves on close.
     */
    showMap(map, { title = '', items = [], tour = null } = {}) {
        const p = this.$('.sp-panel');
        const legend = MAP_KINDS.map(([k, ic, nm]) => `<span>${ic} ${nm}</span>`).join('');
        p.innerHTML = `<div class="sp-map"><canvas width="1024" height="1024"></canvas><div class="sp-side"><h3>${esc(title)}</h3><div class="sp-legend">${legend}</div>
            <ul>${items.map((it) => `<li class="${it.done ? 'done' : ''}">${it.icon} ${esc(it.label)}</li>`).join('')}</ul>
            ${tour ? `<button data-tour>${esc(tour.label)}</button>` : ''}<button data-close>Close (G)</button></div></div>`;
        map.draw(p.querySelector('canvas'), { full: true });
        p.classList.add('show');
        return new Promise((res) => {
            const swallowUp = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keyup', swallowUp, true); };
            const close = (e) => { if (!p.classList.contains('show')) return; p.classList.remove('show'); window.removeEventListener('keydown', key, true); if (e?.type === 'keydown') window.addEventListener('keyup', swallowUp, true); document.activeElement?.blur?.(); p.innerHTML = ''; this._closePanel = null; res(); };
            const key = (e) => { if (['Escape', 'KeyG', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(e); } };
            p.querySelector('[data-close]').onclick = () => close();
            const tb = p.querySelector('[data-tour]'); if (tb) tb.onclick = () => { close(); tour.run(); };
            p.onclick = (e) => { if (e.target === p) close(); };
            setTimeout(() => window.addEventListener('keydown', key, true), 120);
            this._closePanel = close;
        });
    }
    update(camera) { this.bubbles.update(camera); }
    dispose() { this.el.remove(); }
}
/** map marker kinds: [kind, icon, legend name] */
export const MAP_KINDS = [['hero', '⭐', 'Landmark'], ['plaque', '📜', 'Plaque'], ['postcard', '📷', 'Postcard photo'], ['activity', '🎯', 'Activity'], ['bike', '🚲', 'Bikes'], ['entrance', '🚪', 'Entrance'], ['view', '👁', 'Viewpoint'], ['guide', '🚩', 'Tour guide'], ['you', '➤', 'You']];
const ICON = Object.fromEntries(MAP_KINDS.map(([k, i]) => [k, i]));
/**
 * Spot map: a top-down image of the scene's ground (the terrain painter: streets, paths, lawns, water, footprints)
 * with objective markers, the tour route and the player. Minimap (north-up, ~160 m around the player) in the UI
 * corner; draw(canvas, { full }) renders the whole scene for the map panel.
 */
export class SpotMap {
    constructor(ui, { image, bounds }) {
        this.ui = ui; this.img = image; this.b = bounds; this.markers = []; this.route = null; this.player = { x: 0, z: 0, heading: 0 }; this.t = 0;
        this.mini = ui.$('.sp-mini canvas'); this.span = 160;
    }
    setMarkers(list) { this.markers = list; this._dirty = true; }
    setRoute(pts) { this.route = pts; }
    update(dt, player) { this.player = player; this.t -= dt; if (this.t > 0) return; this.t = 0.15; this.draw(this.mini, { full: false }); }
    draw(cv, { full }) {
        const c = cv.getContext('2d'), W = cv.width, H = cv.height, b = this.b, p = this.player;
        const span = full ? Math.max(b.x1 - b.x0, b.z1 - b.z0) : this.span, cx = full ? (b.x0 + b.x1) / 2 : p.x, cz = full ? (b.z0 + b.z1) / 2 : p.z, k = W / span;
        const T = (x, z) => [(x - cx) * k + W / 2, (z - cz) * k + H / 2];
        c.fillStyle = '#20262b'; c.fillRect(0, 0, W, H);
        if (this.img?.width > 0 && this.img.height > 0) { const iw = this.img.width / (b.x1 - b.x0), [ox, oy] = T(b.x0, b.z0); c.globalAlpha = 0.95; c.drawImage(this.img, ox, oy, (b.x1 - b.x0) * k, (b.z1 - b.z0) * k); c.globalAlpha = 1; void iw; }
        if (this.route?.length > 1) { c.save(); c.strokeStyle = '#fbbf24'; c.lineWidth = Math.max(2.5, W / 220); c.setLineDash([W / 60, W / 90]); c.beginPath(); this.route.forEach(([x, z], i) => { const [u, v] = T(x, z); if (i) c.lineTo(u, v); else c.moveTo(u, v); }); c.stroke(); c.restore(); }
        const fs = full ? 26 : 15; c.font = `${fs}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const m of this.markers) {
            let [u, v] = T(m.x, m.z); const off = u < 0 || v < 0 || u > W || v > H; if (off && full) continue;
            if (off) { if (!m.cur) continue; u = clamp(u, 10, W - 10); v = clamp(v, 10, H - 10); } // the current tour stop stays on the minimap edge
            c.globalAlpha = m.done ? 0.45 : 1; c.fillStyle = m.cur ? 'rgba(251,191,36,.9)' : 'rgba(15,18,22,.65)'; c.beginPath(); c.arc(u, v, fs * 0.72, 0, 7); c.fill();
            c.fillStyle = '#fff'; c.fillText(m.icon || ICON[m.kind] || '•', u, v + 1);
            if (full && m.label) { c.font = '600 15px system-ui'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(m.label.slice(0, 34), u, v + fs * 1.05); c.fillText(m.label.slice(0, 34), u, v + fs * 1.05); c.font = `${fs}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; }
            c.globalAlpha = 1;
        }
        // the player: arrow pointing along the heading (heading 0 = north = −z)
        const [u, v] = T(p.x, p.z), a = -(p.heading || 0), r = full ? 16 : 9;
        c.save(); c.translate(u, v); c.rotate(a); c.fillStyle = '#38bdf8'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.7, r * 0.8); c.lineTo(0, r * 0.4); c.lineTo(-r * 0.7, r * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
        if (full) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(W - 120, H - 34, 108, 24); const L = 50 * k; c.fillStyle = '#fff'; c.fillRect(W - 112, H - 18, L, 3); c.font = '12px system-ui'; c.textAlign = 'left'; c.fillText('50 m', W - 108 + L, H - 20); }
    }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/** chat bubbles anchored to {x, y, z} targets (getters allowed), scaled by distance, hidden off-screen */
export class BubbleLayer {
    constructor(el) { this.el = el; this.list = []; this.v = new THREE.Vector3(); this.cp = new THREE.Vector3(); }
    say(target, text, sub = '', cls = '', lang = '') {
        const b = document.createElement('div'); b.className = 'bubble ' + (cls || '');
        const main = document.createElement('span'); main.textContent = text; if (lang) main.lang = lang; b.appendChild(main);
        if (sub) { const s = document.createElement('small'); s.textContent = sub; s.lang = 'en'; b.appendChild(s); }
        this.el.appendChild(b);
        const dur = 3200 + Math.min(4000, (text.length + sub.length) * 45);
        this.list.push({ target, el: b, until: performance.now() + dur });
        while (this.list.length > 5) this.list.shift().el.remove();
        return b;
    }
    update(camera) {
        const now = performance.now(), w = innerWidth, h = innerHeight;
        camera.getWorldPosition(this.cp);
        this.list = this.list.filter((b) => {
            if (now > b.until) { b.el.remove(); return false; }
            const t = b.target; this.v.set(t.x, t.y ?? 2.4, t.z).project(camera);
            const vis = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
            b.el.style.display = vis ? 'block' : 'none';
            if (vis) {
                const d = Math.hypot(t.x - this.cp.x, (t.y ?? 0) - this.cp.y, t.z - this.cp.z);
                b.sx = (this.v.x + 1) / 2 * w; b.sy = (1 - this.v.y) / 2 * h; b.sc = Math.max(0.55, Math.min(1.05, 1.5 - d / 30)); b.d = d;
            }
            b.vis = vis; return true;
        });
        // note 48: bubbles never overlap — nearer speakers keep their anchor, farther ones move up out of the way
        const vis = this.list.filter((b) => b.vis).sort((a, b) => a.d - b.d), placed = [];
        for (const b of vis) {
            const bw = (b.el.offsetWidth || 160) * b.sc, bh = (b.el.offsetHeight || 40) * b.sc; let y = b.sy;
            for (let k = 0; k < 8; k++) { const hit = placed.find((q) => Math.abs(q.x - b.sx) < (q.w + bw) / 2 + 4 && y > q.y - q.h - 4 && y - bh < q.y + 4); if (!hit) break; y = hit.y - hit.h - 6; }
            placed.push({ x: b.sx, y, w: bw, h: bh });
            b.el.style.left = b.sx.toFixed(1) + 'px'; b.el.style.top = y.toFixed(1) + 'px'; b.el.style.transform = `translate(-50%,-100%) scale(${b.sc.toFixed(3)})`;
        }
    }
    clear() { for (const b of this.list) b.el.remove(); this.list = []; }
}

/** a 3-D plaque: post + angled bronze board with the title and text (readable up close) */
export function plaqueMesh(pl, { style = 'bronze', w = 0.62, h = 0.42 } = {}) {
    const g = new THREE.Group(); g.name = 'plaque:' + pl.title;
    const c = canvas(512, 348), x = c.getContext('2d');
    const bg = style === 'bronze' ? ['#5a4627', '#3a2d17'] : style === 'park' ? ['#2f4a2e', '#1f331f'] : ['#2d3540', '#1b2129'];
    const gr = x.createLinearGradient(0, 0, 512, 348); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); x.fillStyle = gr; x.fillRect(0, 0, 512, 348);
    x.strokeStyle = style === 'bronze' ? '#b8975a' : '#c8d2c0'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 328);
    const fg = style === 'bronze' ? '#f1dfb0' : '#eef2ea';
    fitDraw(x, pl.title.toUpperCase(), 30, 24, 452, 52, { font: (s) => `700 ${s}px Georgia, serif`, color: fg, max: 40 });
    fitDraw(x, pl.text, 34, 84, 444, 200, { font: (s) => `${s}px Georgia, serif`, color: fg, max: 26, min: 9, maxLines: 9, lineH: 1.25 });
    if (pl.credit) fitDraw(x, pl.credit, 34, 288, 444, 34, { font: (s) => `italic ${s}px Georgia, serif`, color: fg, max: 18, min: 8 });
    const t = canvasTexture(c);
    // note 36: the text reads on both faces (a box's −z face shows the map unmirrored from behind); a lectern tilt that
    // still reads from the back (bronze) or an upright park board
    const face = new THREE.MeshStandardMaterial({ map: t, metalness: style === 'bronze' ? 0.45 : 0.1, roughness: 0.45 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [
        ...Array(4).fill(new THREE.MeshStandardMaterial({ color: style === 'bronze' ? '#4a3b20' : '#2b2f2a', metalness: 0.7, roughness: 0.4 })), face, face,
    ]);
    board.position.set(0, style === 'bronze' ? 1.0 : 1.12, 0); board.rotation.x = style === 'bronze' ? -0.4 : -0.08; board.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 8), new THREE.MeshStandardMaterial({ color: '#2f3134', metalness: 0.6, roughness: 0.4 }));
    post.position.y = 0.47; post.castShadow = true;
    g.add(board, post);
    return g;
}
