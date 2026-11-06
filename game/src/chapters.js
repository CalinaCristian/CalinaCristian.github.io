// ============================================================================
//  CHAPTERS — UI pieces of the chapter flow (spec 10, R10.5–7): the "Chapter
//  complete" card, the district-jump montage (city map, year ticking forward,
//  one-line story caption) and the progress persistence. The flow itself
//  (which district to load, objectives, completion) lives in main.js.
//  Self-contained: builds its own DOM and styles (no style.css dependency).
// ============================================================================
const $ = (s) => document.querySelector(s);
const STORE = 'dmcv:chapters';

/** chapters reached / completed, persisted per browser (chapter select) */
export function loadProgress() {
    try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return { reached: new Set(o.reached || []), done: new Set(o.done || []) }; }
    catch { return { reached: new Set(), done: new Set() }; }
}
export function saveProgress(p) {
    try { localStorage.setItem(STORE, JSON.stringify({ reached: [...p.reached], done: [...p.done] })); } catch { /* private mode */ }
}

let styled = false;
function injectStyles() {
    if (styled) return; styled = true;
    const css = `
#chapter-card,#chapter-montage{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .35s ease}
#chapter-card.show,#chapter-montage.show{opacity:1;pointer-events:auto}
#chapter-card{background:rgba(6,10,20,.6)}
#chapter-card .cc{width:min(460px,calc(100vw - 32px));background:rgba(15,23,42,.94);color:#e2e8f0;border:1px solid rgba(148,163,184,.25);border-radius:16px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.45);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#chapter-card .eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#93c5fd}
#chapter-card h2{margin:4px 0 6px;font-size:24px;line-height:1.2}
#chapter-card .next{margin:14px 0 4px;padding:12px 14px;border-radius:12px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3)}
#chapter-card .next b{color:#fff}
#chapter-card .next small{display:block;color:#94a3b8;margin-top:4px}
#chapter-card .row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
#chapter-card button{flex:1 1 140px;min-height:44px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:rgba(30,41,59,.9);color:#e2e8f0;font:600 15px system-ui,sans-serif;cursor:pointer}
#chapter-card button.primary{background:#2563eb;border-color:#2563eb;color:#fff}
#chapter-card button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
#chapter-card .keys{margin-top:10px;font-size:12px;color:#94a3b8}
#chapter-montage{background:#050914}
#chapter-montage canvas{position:absolute;inset:0;width:100%;height:100%}
#chapter-montage .cap{position:absolute;left:50%;bottom:9vh;transform:translateX(-50%);width:min(720px,calc(100vw - 32px));text-align:center;color:#e2e8f0;font:16px/1.45 system-ui,sans-serif;text-shadow:0 2px 8px #000}
#chapter-montage .yr{display:block;font:800 clamp(44px,9vw,92px)/1 system-ui,sans-serif;color:#fff;letter-spacing:.02em;margin-bottom:8px;font-variant-numeric:tabular-nums}
#chapter-montage .ti{display:block;font-weight:700;font-size:20px;color:#93c5fd;margin-bottom:6px}
#chapter-montage .skip{position:absolute;right:16px;top:16px;color:#64748b;font:12px system-ui,sans-serif}
#chapter-select{margin-top:12px;text-align:left}
#chapter-select h4,#navlist h4 small{margin:8px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8}
#chapter-select .chs,#navlist .chs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
#chapter-select button,#navlist button[data-chapter]{min-height:36px;padding:4px 10px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(30,41,59,.85);color:#e2e8f0;font:13px system-ui,sans-serif;cursor:pointer}
`;
    const st = document.createElement('style'); st.id = 'chapters-css'; st.textContent = css; document.head.appendChild(st);
}
function el(id, cls = '') {
    let e = document.getElementById(id);
    if (!e) { e = document.createElement('div'); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); }
    return e;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * "Chapter complete" card. done/next = chapter objects (next may be null = story complete).
 * Resolves 'next' (Continue) or 'free' (Free drive here). Enter / Space / E = Continue, F / Esc = free drive.
 */
export function chapterCard({ done, next, index, total, nextDistrictName }) {
    injectStyles();
    const c = el('chapter-card');
    const nxt = next ? `<div class="next">Next: <b>${esc(next.year)} · ${esc(next.title)}</b><small>${esc(next.intro || '')}${nextDistrictName ? ` · ${esc(nextDistrictName)}` : ''}</small></div>` : '';
    c.innerHTML = `<div class="cc" role="dialog" aria-label="Chapter complete"><div class="eyebrow">Chapter ${index + 1} of ${total} complete</div>
<h2>${esc(done.year)} · ${esc(done.title)}</h2>${nxt}
<div class="row"><button class="primary" data-act="next">${next ? 'Continue ▸' : 'Finish ▸'}</button><button data-act="free">Free drive here</button></div>
<div class="keys">Enter = continue · F = free drive (continue later from the map, M)</div></div>`;
    c.classList.add('show');
    return new Promise((res) => {
        const finish = (act) => { c.classList.remove('show'); window.removeEventListener('keydown', onKey, true); res(act); };
        const onKey = (e) => {
            if (['Enter', 'Space', 'KeyE', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); finish('next'); }
            else if (['KeyF', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); finish('free'); }
        };
        c.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => finish(b.dataset.act)));
        setTimeout(() => { window.addEventListener('keydown', onKey, true); c.querySelector('.primary')?.focus(); }, 300);
        c._finish = finish;
    });
}
export function closeChapterCard(act = 'next') { const c = document.getElementById('chapter-card'); if (c?._finish && c.classList.contains('show')) c._finish(act); }
export const chapterCardOpen = () => !!document.getElementById('chapter-card')?.classList.contains('show');

/**
 * District-jump montage on the city map (4–6 s): the city's districts as outlines, a marker jumping from the
 * previous district to the next one, the year ticking forward and the chapter's `intro` as a caption.
 * districts: { id: { name, bbox:[minLat,minLon,maxLat,maxLon], center:{lat,lon} } }. Any key / click skips.
 */
export function chapterMontage({ cityName, districts = {}, from = null, to, year0, year1, title, caption, duration = 5000 }) {
    injectStyles();
    const m = el('chapter-montage');
    m.innerHTML = `<canvas></canvas><div class="cap"><span class="yr">${esc(year0 ?? year1)}</span><span class="ti">${esc(title || '')}</span><span class="tx">${esc(caption || '')}</span></div><div class="skip">click / any key to skip</div>`;
    const cv = m.querySelector('canvas'), yr = m.querySelector('.yr');
    m.classList.add('show');
    const list = Object.entries(districts).map(([id, d]) => ({ id, ...d }));
    const ctr = (d) => d?.center || (d?.bbox ? { lat: (d.bbox[0] + d.bbox[2]) / 2, lon: (d.bbox[1] + d.bbox[3]) / 2 } : null);
    // frame: around the two districts of the jump (an outlier such as the airport does not shrink the rest),
    // at least ~4 km tall; equirectangular with cos(lat)
    const fr = [districts[from], districts[to]].filter(d => d?.bbox);
    let a0 = 90, a1 = -90, o0 = 180, o1 = -180;
    for (const d of (fr.length ? fr : list)) { const b = d.bbox; if (!b) continue; a0 = Math.min(a0, b[0]); o0 = Math.min(o0, b[1]); a1 = Math.max(a1, b[2]); o1 = Math.max(o1, b[3]); }
    if (a0 > a1) { a0 = 0; a1 = 1; o0 = 0; o1 = 1; }
    const k = Math.cos(((a0 + a1) / 2) * Math.PI / 180);
    { const cl = (a0 + a1) / 2, co = (o0 + o1) / 2, hl = Math.max((a1 - a0) * 0.85, 0.018), ho = Math.max((o1 - o0) * 0.85, hl / k); a0 = cl - hl; a1 = cl + hl; o0 = co - ho; o1 = co + ho; }
    const A = ctr(districts[from]), B = ctr(districts[to]);
    const t0 = performance.now();
    return new Promise((res) => {
        let done = false;
        const end = () => { if (done) return; done = true; window.removeEventListener('keydown', skip, true); m.removeEventListener('pointerdown', skip); m.classList.remove('show'); setTimeout(res, 200); };
        const skip = (e) => { if (performance.now() - t0 > 600) { e.preventDefault?.(); end(); } };
        window.addEventListener('keydown', skip, true); m.addEventListener('pointerdown', skip);
        const draw = () => {
            if (done) return;
            const now = performance.now(), u = Math.min(1, (now - t0) / duration);
            const W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
            if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
            const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.fillStyle = '#050914'; g.fillRect(0, 0, W, H);
            const pad = 24, sw = (o1 - o0) * k, sh = (a1 - a0), mapH = H * 0.5;
            const sc = Math.min((W - 2 * pad) / sw, mapH / sh);
            const ox = (W - sw * sc) / 2, oy = H * 0.06 + (mapH - sh * sc) / 2;
            g.save(); g.beginPath(); g.rect(0, H * 0.04, W, mapH + H * 0.06); g.clip();
            const P = (lat, lon) => [ox + (lon - o0) * k * sc, oy + (a1 - lat) * sc];
            // grid
            g.strokeStyle = 'rgba(148,163,184,.07)'; g.lineWidth = 1;
            for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
            for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
            g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'center';
            for (const d of list) {
                if (!d.bbox) continue;
                const [x0, y0] = P(d.bbox[2], d.bbox[1]), [x1, y1] = P(d.bbox[0], d.bbox[3]);
                const on = d.id === to, was = d.id === from;
                g.fillStyle = on ? `rgba(37,99,235,${0.18 + 0.25 * u})` : was ? 'rgba(148,163,184,.12)' : 'rgba(148,163,184,.06)';
                g.strokeStyle = on ? '#60a5fa' : 'rgba(148,163,184,.35)'; g.lineWidth = on ? 2 : 1;
                g.fillRect(x0, y0, x1 - x0, y1 - y0); g.strokeRect(x0, y0, x1 - x0, y1 - y0);
                if (on || was || d.id === from) { g.fillStyle = on ? '#bfdbfe' : '#94a3b8'; g.fillText(d.name || d.id, (x0 + x1) / 2, y1 + 15); }
            }
            g.restore();
            g.textAlign = 'left'; g.fillStyle = '#94a3b8'; g.font = '600 13px system-ui,sans-serif'; g.fillText(cityName || '', 16, 24);
            // the jump: an arc from A to B, a dot travelling along it
            if (B) {
                const [bx, by] = P(B.lat, B.lon);
                if (A && (A.lat !== B.lat || A.lon !== B.lon)) {
                    const [ax, ay] = P(A.lat, A.lon); const mx = (ax + bx) / 2, my = Math.min(ay, by) - Math.hypot(bx - ax, by - ay) * 0.35;
                    const e = Math.min(1, Math.max(0, (u - 0.1) / 0.6)), s = e * e * (3 - 2 * e);
                    g.strokeStyle = 'rgba(147,197,253,.8)'; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath();
                    for (let i = 0; i <= 40 * s; i++) { const t = i / 40, x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by; i ? g.lineTo(x, y) : g.moveTo(x, y); }
                    g.stroke(); g.setLineDash([]);
                    const x = (1 - s) * (1 - s) * ax + 2 * (1 - s) * s * mx + s * s * bx, y = (1 - s) * (1 - s) * ay + 2 * (1 - s) * s * my + s * s * by;
                    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
                } else { g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 6 + 2 * Math.sin(now / 150), 0, 7); g.fill(); }
                g.strokeStyle = `rgba(96,165,250,${1 - (now / 900) % 1})`; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 8 + 24 * ((now / 900) % 1), 0, 7); g.stroke();
            }
            // the year ticks forward
            if (year0 != null && year1 != null && year1 !== year0) { const yv = Math.round(year0 + (year1 - year0) * Math.min(1, Math.max(0, (u - 0.15) / 0.55))); yr.textContent = yv; }
            else yr.textContent = year1 ?? '';
            if (u >= 1) { end(); return; }
            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    });
}

/** chapter select markup (menu card / map panel): reached chapters as buttons with data-chapter=<index> */
export function chapterSelectHtml(chapters, progress, current = -1) {
    injectStyles();
    const items = chapters.map((c, i) => ({ c, i })).filter(({ c }) => progress.reached.has(c.id));
    if (!items.length) return '';
    return `<h4>Chapters</h4><div class="chs">${items.map(({ c, i }) => `<button data-chapter="${i}" title="${esc(c.intro || '')}">${progress.done.has(c.id) ? '✓ ' : ''}${esc(c.year)} · ${esc(c.title)}${i === current ? ' •' : ''}</button>`).join('')}</div>`;
}
