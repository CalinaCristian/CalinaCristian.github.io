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
body.photo-mode #spot-ui .sp-card,body.photo-mode #spot-ui .sp-prompt,body.photo-mode #spot-ui .sp-help,body.photo-mode #spot-ui .sp-cross{display:none}
@media (max-width:600px){#spot-ui .sp-help{display:none}#spot-ui .bubble{font-size:12px}}
`;

export class SpotUI {
    constructor(root = document.body) {
        if (!document.getElementById('spot-ui-css')) { const st = document.createElement('style'); st.id = 'spot-ui-css'; st.textContent = CSS; document.head.appendChild(st); }
        const el = this.el = document.createElement('div'); el.id = 'spot-ui';
        el.innerHTML = `<div class="sp-bubbles"></div><div class="sp-card"><b></b><span></span><div class="sp-chal"></div></div>
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
            const close = () => { p.classList.remove('show'); window.removeEventListener('keydown', key, true); res(); };
            const key = (e) => { if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(); } };
            p.querySelector('[data-close]').onclick = close;
            p.onclick = (e) => { if (e.target === p) close(); };
            setTimeout(() => window.addEventListener('keydown', key, true), 120);
            this._closePanel = close;
        });
    }
    closePanel() { this._closePanel?.(); }
    update(camera) { this.bubbles.update(camera); }
    dispose() { this.el.remove(); }
}
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
                b.el.style.left = ((this.v.x + 1) / 2 * w).toFixed(1) + 'px'; b.el.style.top = ((1 - this.v.y) / 2 * h).toFixed(1) + 'px';
                b.el.style.transform = `translate(-50%,-100%) scale(${Math.max(0.55, Math.min(1.05, 1.5 - d / 30)).toFixed(3)})`;
            }
            return true;
        });
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
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [
        ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#4a3b20', metalness: 0.7, roughness: 0.4 })),
        new THREE.MeshStandardMaterial({ map: t, metalness: style === 'bronze' ? 0.45 : 0.1, roughness: 0.45 }),
        new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7 }),
    ]);
    board.position.set(0, 1.0, 0); board.rotation.x = -0.55; board.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 8), new THREE.MeshStandardMaterial({ color: '#2f3134', metalness: 0.6, roughness: 0.4 }));
    post.position.y = 0.47; post.castShadow = true;
    g.add(board, post);
    return g;
}
