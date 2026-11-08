import { drawFitText } from './canvasText.js';
import { drawGlobe, drawPlane } from './flight.js';
/** a small top-down car (heading = direction of travel in canvas radians) for drives across town (after round 6) */
function drawCar(ctx, x, y, hd, dpr) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(hd); const s = dpr;
    ctx.fillStyle = '#fa4616'; ctx.strokeStyle = 'rgba(15,23,42,0.85)'; ctx.lineWidth = 1.2 * s;
    const rr = (x0, y0, w, h, r) => { ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath(); };
    ctx.fillStyle = '#0f172a'; for (const [wx, wy] of [[-6, -6.4], [4, -6.4], [-6, 4.6], [4, 4.6]]) ctx.fillRect(wx * s, wy * s, 3.4 * s, 1.8 * s); // wheels
    ctx.fillStyle = '#fa4616'; rr(-9 * s, -5 * s, 18 * s, 10 * s, 3 * s); ctx.fill(); ctx.stroke();                                      // body
    ctx.fillStyle = '#bfdbfe'; rr(1.5 * s, -3.6 * s, 3.6 * s, 7.2 * s, 1.2 * s); ctx.fill(); rr(-6 * s, -3.4 * s, 2.6 * s, 6.8 * s, 1 * s); ctx.fill(); // windscreens
    ctx.fillStyle = '#fef3c7'; ctx.fillRect(8 * s, -4 * s, 1.2 * s, 2 * s); ctx.fillRect(8 * s, 2 * s, 1.2 * s, 2 * s);                    // headlights
    ctx.restore();
}

/**
 * Cinematic chapter transition (note 16, cockpit-ui). Full-screen overlay: a stylised night-map of the city (district
 * blocks with a procedural street grid, water, labels) — on the first chapter of a city the camera first drops from the
 * globe onto it — the route line drawing from the previous stop to the next (optional waypoints), the year counter
 * ticking, the chapter title, and a clean CV card (company, role, period, colour, icon). Fades in/out, a soft sting,
 * phone-friendly, skippable (click / tap / any key).
 *
 * playChapterTransition({ cityName, city: {center:{lat,lon}}, districts: {id:{name,bbox,center}}, from, to (district
 *   ids), fromStop, toStop ({lat, lon, label}), year0, year1, title, caption, kicker, travel, via:[{lat,lon,label?,hi?}],
 *   water:[{lat,lon,rlat,rlon,label?,land?}], card: {company, role, period, color, icon}, audio, duration (ms), globe })
 *   → Promise<void>
 * Same inputs as chapters.js chapterMontage (plus `card`, `fromStop`/`toStop`, `globe`) so gameplay can switch with one call.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

function overlay() {
    let el = document.getElementById('chapter-transition');
    if (!el) { el = document.createElement('div'); el.id = 'chapter-transition'; document.body.appendChild(el); }
    return el;
}

export function playChapterTransition(o = {}) {
    const el = overlay();
    const card = o.card || null;
    el.innerHTML = `<canvas></canvas><div class="ct-vignette"></div>
        <div class="ct-top">${o.kicker ? `<span class="ct-kicker">${esc(o.kicker)}</span>` : ''}<span class="ct-city">${esc(o.cityName || '')}</span></div>
        <div class="ct-year" aria-hidden="true">${esc(o.year0 ?? o.year1 ?? '')}</div>
        <div class="ct-title"><h2>${esc(o.title || '')}</h2>${o.caption ? `<p>${esc(o.caption)}</p>` : ''}${o.travel ? `<p class="ct-travel">${esc(o.travel)}</p>` : ''}</div>
        ${card ? `<div class="ct-card" style="--c:${esc(card.color || '#fa4616')}"><span class="ct-ic">${esc(card.icon || '')}</span><div><b>${esc(card.company || '')}</b><span>${esc(card.role || '')}</span><small>${esc(card.period || '')}</small></div></div>` : ''}
        <div class="ct-skip">tap / any key to skip</div>`;
    const cv = el.querySelector('canvas'), yrEl = el.querySelector('.ct-year');
    requestAnimationFrame(() => el.classList.add('show'));
    try { o.audio?.chime?.(); } catch { /* ignore */ }
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.width = Math.round(innerWidth * dpr), H = cv.height = Math.round(innerHeight * dpr);
    const ctx = cv.getContext('2d');
    // ---- geography: frame = from + to districts (+ via), local equirectangular in metres
    const ds = Object.entries(o.districts || {}).map(([id, d]) => ({ id, ...d, c: d.center || (d.bbox ? { lat: (d.bbox[0] + d.bbox[2]) / 2, lon: (d.bbox[1] + d.bbox[3]) / 2 } : null) })).filter(d => d.c);
    const byId = Object.fromEntries(ds.map(d => [d.id, d]));
    const A = o.fromStop || byId[o.from]?.c || null, B = o.toStop || byId[o.to]?.c || o.city?.center || { lat: 44.43, lon: 26.1 };
    const pts = [A, ...(o.via || []), B].filter(Boolean);
    const fr = [byId[o.from], byId[o.to]].filter(d => d?.bbox);
    let a0 = 90, a1 = -90, b0 = 180, b1 = -180;
    for (const d of fr) { a0 = Math.min(a0, d.bbox[0]); b0 = Math.min(b0, d.bbox[1]); a1 = Math.max(a1, d.bbox[2]); b1 = Math.max(b1, d.bbox[3]); }
    for (const p of pts) { a0 = Math.min(a0, p.lat); a1 = Math.max(a1, p.lat); b0 = Math.min(b0, p.lon); b1 = Math.max(b1, p.lon); }
    if (a0 > a1) { a0 = B.lat - 0.02; a1 = B.lat + 0.02; b0 = B.lon - 0.03; b1 = B.lon + 0.03; }
    const lat0 = (a0 + a1) / 2, lon0 = (b0 + b1) / 2, kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
    const spanX = Math.max(3000, (b1 - b0) * kx), spanY = Math.max(3000, (a1 - a0) * ky);
    const portrait = H > W;
    const fit = Math.min(W * (portrait ? 0.86 : 0.62) / spanX, H * (portrait ? 0.42 : 0.62) / spanY);
    const mx = W * (portrait ? 0.5 : 0.62), my = H * (portrait ? 0.4 : 0.48);
    const toXY = (p, z = 1) => [mx + (p.lon - lon0) * kx * fit * z, my - (p.lat - lat0) * ky * fit * z];
    // procedural street grid per district (seeded), cached as segments in lat/lon
    const grids = ds.map((d) => {
        if (!d.bbox) return null;
        let s = d.id.length * 97 + d.id.charCodeAt(0); const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const segs = [], [la0, lo0, la1, lo1] = d.bbox, ang = (r() - 0.5) * 0.5;
        const n = 14;
        for (let i = 0; i <= n; i++) for (const dir of [0, 1]) {
            const t = i / n, wob = (r() - 0.5) * 0.002;
            if (dir === 0) segs.push([[la0 + (la1 - la0) * t + wob, lo0], [la0 + (la1 - la0) * t - wob + ang * 0.004, lo1], i % 4 === 0]);
            else segs.push([[la0, lo0 + (lo1 - lo0) * t + wob], [la1, lo0 + (lo1 - lo0) * t - wob - ang * 0.004], i % 4 === 0]);
        }
        return { d, segs };
    }).filter(Boolean);
    const DUR = o.duration || 5200, GLOBE = o.globe ? 1600 : 0, start = performance.now();
    let raf = 0, done = false, resolveP;
    const y0 = +o.year0, y1 = +o.year1;
    const frame = (now) => {
        const T = now - start, tg = clamp01(T / Math.max(1, GLOBE)), t = clamp01((T - GLOBE) / (DUR - GLOBE));
        ctx.fillStyle = '#060b16'; ctx.fillRect(0, 0, W, H);
        if (GLOBE && T < GLOBE + 400) { // drop from the globe onto the city
            const k = ease(tg), R = Math.min(W, H) * (0.42 + 2.6 * k * k);
            ctx.globalAlpha = 1 - clamp01((T - GLOBE + 200) / 600);
            drawGlobe(ctx, { lon0: B.lon - 20 * (1 - k), lat0: B.lat - 10 * (1 - k), R, cx: mx, cy: my, dpr });
            ctx.globalAlpha = 1;
        }
        const zin = 1.25 - 0.25 * ease(clamp01(t * 1.4)); // slow push-in
        const mapA = GLOBE ? clamp01((T - GLOBE + 300) / 700) : clamp01(T / 500);
        ctx.globalAlpha = mapA;
        // water
        for (const w of o.water || []) { const [x, y] = toXY(w, zin); ctx.fillStyle = w.land ? '#0d1626' : '#0f2c4a'; ctx.beginPath(); ctx.ellipse(x, y, w.rlon * kx * fit * zin, w.rlat * ky * fit * zin, 0, 0, 7); ctx.fill(); }
        // districts: glow block + grid + label
        for (const g of grids) {
            const [la0, lo0, la1, lo1] = g.d.bbox, [x0, yA] = toXY({ lat: la1, lon: lo0 }, zin), [x1, yB] = toXY({ lat: la0, lon: lo1 }, zin);
            const active = g.d.id === o.to, prev = g.d.id === o.from;
            ctx.fillStyle = active ? 'rgba(250,70,22,0.10)' : prev ? 'rgba(96,165,250,0.08)' : 'rgba(148,163,184,0.05)';
            ctx.fillRect(x0, yA, x1 - x0, yB - yA);
            for (const [p, q, major] of g.segs) { const [ax, ay] = toXY({ lat: p[0], lon: p[1] }, zin), [bx, by] = toXY({ lat: q[0], lon: q[1] }, zin); ctx.strokeStyle = major ? (active ? 'rgba(255,170,120,0.45)' : 'rgba(148,163,184,0.28)') : (active ? 'rgba(255,170,120,0.18)' : 'rgba(148,163,184,0.12)'); ctx.lineWidth = (major ? 1.6 : 0.8) * dpr; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
            ctx.strokeStyle = active ? 'rgba(250,70,22,0.85)' : prev ? 'rgba(96,165,250,0.6)' : 'rgba(148,163,184,0.25)'; ctx.lineWidth = (active ? 2 : 1) * dpr; ctx.strokeRect(x0, yA, x1 - x0, yB - yA);
            ctx.fillStyle = active ? '#ffd2bf' : '#94a3b8'; ctx.textAlign = 'center';
            drawFitText(ctx, g.d.name || g.d.id, (x0 + x1) / 2, yB + 14 * dpr, Math.max(60 * dpr, x1 - x0 + 40 * dpr), { maxSize: Math.round((active ? 15 : 12) * dpr), minSize: Math.round(8 * dpr), font: (s) => `600 ${s}px system-ui, sans-serif`, label: 'transition district' });
        }
        for (const w of o.water || []) if (w.label) { const [x, y] = toXY(w, zin); ctx.fillStyle = 'rgba(147,197,253,0.7)'; ctx.textAlign = 'center'; drawFitText(ctx, w.label, x, y, 160 * dpr, { maxSize: Math.round(12 * dpr), minSize: 8, font: (s) => `italic ${s}px Georgia, serif`, label: 'transition water' }); }
        // route: draws from A through the waypoints to B
        if (pts.length >= 2) {
            const P = pts.map(p => toXY(p, zin)); let L = 0; const segL = []; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segL.push(l); L += l; }
            const k = ease(clamp01((t - 0.12) / 0.55)); let left = L * k;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const path = (w, style) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); let rem = left; let head = P[0]; for (let i = 1; i < P.length && rem > 0; i++) { const f = Math.min(1, rem / segL[i - 1]); head = [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f]; ctx.lineTo(head[0], head[1]); rem -= segL[i - 1]; } ctx.stroke(); return head; };
            path(9 * dpr, 'rgba(250,70,22,0.25)'); const head = path(3.2 * dpr, '#ff7a45');
            const hd = (() => { let i = 1, rem = left; while (i < P.length - 1 && rem > segL[i - 1]) { rem -= segL[i - 1]; i++; } return Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]); })();
            if (k > 0 && k < 1) (o.globe ? drawPlane(ctx, head[0], head[1], hd, 0.55 * dpr) : drawCar(ctx, head[0], head[1], hd, dpr)); // a plane only after a flight; across town it's a drive
            for (const [i, p] of [[0, P[0]], [P.length - 1, P[P.length - 1]]]) { const end = i > 0; if (end && k < 0.98) continue; ctx.fillStyle = end ? '#fa4616' : '#60a5fa'; ctx.beginPath(); ctx.arc(p[0], p[1], 6 * dpr, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.stroke(); }
            for (const v of o.via || []) if (v.label && v.hi) { const [x, y] = toXY(v, zin); ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left'; drawFitText(ctx, v.label, x + 10 * dpr, y - 10 * dpr, 180 * dpr, { maxSize: Math.round(12 * dpr), minSize: 8, font: (s) => `600 ${s}px system-ui, sans-serif`, label: 'transition via' }); }
        } else { const [x, y] = toXY(B, zin); const pulse = 1 + 0.3 * Math.sin(T / 180); ctx.fillStyle = '#fa4616'; ctx.beginPath(); ctx.arc(x, y, 7 * dpr * pulse, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        // year counter
        if (Number.isFinite(y0) && Number.isFinite(y1) && y0 !== y1) yrEl.textContent = String(Math.round(y0 + (y1 - y0) * ease(clamp01((t - 0.1) / 0.6))));
        else if (Number.isFinite(y1)) yrEl.textContent = String(y1);
        el.classList.toggle('ct-cardin', t > 0.45);
        if (T < DUR) raf = requestAnimationFrame(frame); else finish();
    };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.classList.remove('show'); removeEventListener('keydown', onKey, true); el.removeEventListener('pointerdown', finish); setTimeout(() => { el.innerHTML = ''; resolveP(); }, 420); };
    const onKey = (e) => { e.preventDefault(); finish(); };
    return new Promise((res) => {
        resolveP = res;
        setTimeout(() => { addEventListener('keydown', onKey, true); el.addEventListener('pointerdown', finish); }, 350);
        raf = requestAnimationFrame(frame);
    });
}
