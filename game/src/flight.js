import { drawFitText } from './canvasText.js';
import { NE_LAND, NE_BORDERS } from '../data/geo/ne110.js';

/**
 * Flight cutscene (note 47): an orthographic globe with Natural Earth 1:110m coastlines + land borders (public domain),
 * the real great-circle route OTP → SEA (over Scandinavia, Greenland and northern Canada) drawn as it is flown, the
 * plane, both airports, and a timezone panel (local time at departure and arrival). The globe turns with the plane.
 * Round 5 (note 83): the globe itself is the shared high-fidelity one from globe.js (Natural Earth 1:50m, day / night for
 * the elapsed flight time with NASA Black Marble city lights, glowing route), imported lazily when the cut-scene starts;
 * the 1:110m `drawGlobe` below stays as its fallback.
 * Same API as before: playFlight({ from, hud, audio, texts }) → Promise (resolves when finished or skipped).
 * `drawGlobe` is shared with the chapter-transition map (transition.js).
 */
export const OTP = { lon: 26.0850, lat: 44.5711, name: 'Bucharest (OTP)', tz: 'Europe/Bucharest', code: 'OTP' };
export const SEA = { lon: -122.3088, lat: 47.4502, name: 'Seattle (SEA)', tz: 'America/Los_Angeles', code: 'SEA' };
const D2R = Math.PI / 180;
const toV = (lon, lat) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
const toLL = (v) => [Math.atan2(v[1], v[0]) / D2R, Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R];
/** point at fraction t of the great circle a → b ([lon, lat]) */
export function slerpLL(a, b, t) {
    const A = toV(a.lon ?? a[0], a.lat ?? a[1]), B = toV(b.lon ?? b[0], b.lat ?? b[1]);
    const d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))); if (d < 1e-9) return toLL(A);
    const s = Math.sin(d), ka = Math.sin((1 - t) * d) / s, kb = Math.sin(t * d) / s;
    return toLL([A[0] * ka + B[0] * kb, A[1] * ka + B[1] * kb, A[2] * ka + B[2] * kb]);
}
/** orthographic projection around (lon0, lat0), radius R, centre (cx, cy) → fn(lon, lat) = [x, y, visible(cos c)] */
function ortho(lon0, lat0, R, cx, cy) {
    const s0 = Math.sin(lat0 * D2R), c0 = Math.cos(lat0 * D2R);
    return (lon, lat) => {
        const p = lat * D2R, dl = (lon - lon0) * D2R, cp = Math.cos(p), sp = Math.sin(p), cd = Math.cos(dl);
        const cosc = s0 * sp + c0 * cp * cd;
        return [cx + R * cp * Math.sin(dl), cy - R * (c0 * sp - s0 * cp * cd), cosc];
    };
}
/**
 * Draw the globe: ocean disc + atmosphere, graticule, land (Natural Earth), borders. opts: { lon0, lat0, R, cx, cy, dpr,
 * land, ocean, border, night (0..1) }. Returns the projection.
 */
export function drawGlobe(ctx, o) {
    const { lon0, lat0, R, cx, cy, dpr = 1 } = o;
    const P = ortho(lon0, lat0, R, cx, cy);
    // atmosphere glow + ocean
    const glow = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.12); glow.addColorStop(0, 'rgba(120,180,255,0.35)'); glow.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 7); ctx.fill();
    const oc = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); oc.addColorStop(0, o.ocean?.[0] || '#1e5a8c'); oc.addColorStop(1, o.ocean?.[1] || '#0a2747');
    ctx.fillStyle = oc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    // graticule
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1 * dpr;
    for (let lo = -180; lo < 180; lo += 20) { ctx.beginPath(); let pen = false; for (let la = -80; la <= 80; la += 4) { const [x, y, v] = P(lo, la); if (v > 0) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); }
    for (let la = -60; la <= 80; la += 20) { ctx.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 4) { const [x, y, v] = P(lo, la); if (v > 0) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); }
    // land: back-facing vertices are pushed onto the limb (keeps polygons closed at the horizon)
    const limb = (x, y) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [cx + dx / l * R, cy + dy / l * R]; };
    ctx.fillStyle = o.land || '#557d5a'; ctx.strokeStyle = 'rgba(20,30,20,0.35)'; ctx.lineWidth = 0.8 * dpr;
    for (const r of NE_LAND) {
        let vis = false; ctx.beginPath();
        for (let i = 0; i < r.length; i += 2) { let [x, y, v] = P(r[i] / 10, r[i + 1] / 10); if (v > 0) vis = true; else [x, y] = limb(x, y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        if (vis) { ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.strokeStyle = o.border || 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.7 * dpr;
    for (const r of NE_BORDERS) { ctx.beginPath(); let pen = false; for (let i = 0; i < r.length; i += 2) { const [x, y, v] = P(r[i] / 10, r[i + 1] / 10); if (v > 0.02) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); }
    // terminator shading (optional)
    if (o.night) { const sh = ctx.createLinearGradient(cx - R, 0, cx + R, 0); sh.addColorStop(0, `rgba(0,5,20,${0.55 * o.night})`); sh.addColorStop(0.6, 'rgba(0,5,20,0)'); ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
    // limb shading
    const lim = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R); lim.addColorStop(0, 'rgba(0,0,0,0)'); lim.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = lim; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
    return P;
}
/** plane silhouette at (x, y) heading ang (radians, canvas), scale s */
export function drawPlane(ctx, x, y, ang, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -3.5); ctx.lineTo(-14, -15); ctx.lineTo(-8, -15); ctx.lineTo(-1, -3.5); ctx.lineTo(-11, -2); ctx.lineTo(-16, -8); ctx.lineTo(-18, 0); ctx.lineTo(-16, 8); ctx.lineTo(-11, 2); ctx.lineTo(-1, 3.5); ctx.lineTo(-8, 15); ctx.lineTo(-14, 15); ctx.lineTo(-10, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
}
let GLOBE = null; // globe.js module once loaded (shared high-fidelity globe, round 5)
const fmtTime = (date, tz) => { try { return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return date.toISOString().slice(11, 16); } };
const fmtDay = (date, tz) => { try { return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }); } catch { return ''; } };

export function playFlight({ from = 'bucharest', hud, audio, texts }) {
    void hud;
    return new Promise((resolve) => {
        const overlay = document.getElementById('flight');
        const canvas = overlay.querySelector('canvas');
        const caption = overlay.querySelector('.caption');
        const skip = overlay.querySelector('[data-skip]');
        overlay.classList.add('show');
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(2, devicePixelRatio || 1);
        const W = canvas.width = Math.round(window.innerWidth * dpr), H = canvas.height = Math.round(window.innerHeight * dpr);
        const A = from === 'bucharest' ? OTP : SEA, B = from === 'bucharest' ? SEA : OTP;
        const start = performance.now(), DUR = 12000, FLIGHT_H = 14; // ~14 h door to door, one layover (as in the CV story)
        const depart = new Date();
        let raf, finished = false;
        const captions = texts || [
            [0, 'Summer 2022'], [0.12, 'Boarding at Henri Coandă (OTP)…'], [0.3, 'Over the Atlantic. 1 layover, ~14 hours door to door.'], [0.55, 'Crossing Greenland & northern Canada'], [0.75, 'Descending into the Pacific Northwest'], [0.9, 'Welcome to Seattle–Tacoma (SEA). Grab a rental car ➜ Bellevue.'],
        ];
        let G = GLOBE, gAt = start - 1e4, gFail = false; // globe.js loads lazily with the first flight (no cost for district loads)
        if (!G) import('./globe.js').then((m) => { GLOBE = G = m; gAt = performance.now(); }).catch((err) => { gFail = true; console.warn('[flight] globe', err); });
        const route = []; for (let i = 0; i <= 120; i++) route.push(slerpLL(A, B, i / 120));
        const mid = slerpLL(A, B, 0.5);
        const draw = (now) => {
            const t = Math.min(1, (now - start) / DUR);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const plane = slerpLL(A, B, e);
            // the globe turns from the origin to the destination, staying centred between the plane and the mid-route
            const c = slerpLL({ lon: mid[0], lat: mid[1] }, { lon: plane[0], lat: plane[1] }, 0.55);
            const portrait = H > W, R = Math.min(W, H) * (portrait ? 0.46 : 0.44) * (1.18 - 0.12 * Math.sin(Math.PI * e));
            const cx = W / 2, cy = H * (portrait ? 0.46 : 0.5);
            const now2 = new Date(depart.getTime() + e * FLIGHT_H * 3600e3);
            if (G) { // the shared high-fidelity globe (globe.js): 1:50m, sun-lit day / night + city lights for the elapsed time
                const fade = Math.min(1, (now - gAt) / 300);
                if (fade < 1) { ctx.fillStyle = '#02050c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = fade; }
                G.flightScene(ctx, { W, H, cx, cy, R, dpr, lon0: c[0], lat0: c[1], A, B, e, date: now2, portrait, t: (now - start) / 1000 });
                ctx.globalAlpha = 1;
            } else if (!gFail && now - start < 700) { ctx.fillStyle = '#02050c'; ctx.fillRect(0, 0, W, H); } // globe.js still loading
            else { // fallback: the 1:110m globe
                // space background
                const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(W, H)); bg.addColorStop(0, '#0c1830'); bg.addColorStop(1, '#03060d');
                ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 90; i++) { const sx = (i * 977 % 1000) / 1000 * W, sy = (i * 571 % 1000) / 1000 * H; if (Math.hypot(sx - cx, sy - cy) > R * 1.15) ctx.fillRect(sx, sy, dpr, dpr); }
                const P = drawGlobe(ctx, { lon0: c[0], lat0: c[1], R, cx, cy, dpr });
                // route: full great circle dashed, flown part solid
                const seg = (n, style, w, dash) => { ctx.setLineDash(dash); ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); let pen = false; for (let i = 0; i <= n; i++) { const [x, y, v] = P(route[i][0], route[i][1]); if (v > 0) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); ctx.setLineDash([]); };
                seg(120, 'rgba(255,255,255,0.45)', 1.6 * dpr, [6 * dpr, 7 * dpr]);
                const n = Math.round(e * 120); if (n > 0) { seg(n, 'rgba(251,191,36,0.35)', 7 * dpr, []); seg(n, '#fbbf24', 2.6 * dpr, []); }
                // airports
                for (const ap of [A, B]) {
                    const [x, y, v] = P(ap.lon, ap.lat); if (v <= 0) continue;
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, 7); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y, 2.5 * dpr, 0, 7); ctx.fill();
                    const right = x < cx; ctx.textAlign = right ? 'left' : 'right'; ctx.fillStyle = '#fff';
                    const lx = x + (right ? 10 : -10) * dpr, room = right ? W - lx - 10 * dpr : lx - 10 * dpr;
                    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4 * dpr;
                    drawFitText(ctx, ap.name, lx, y - 12 * dpr, Math.min(room, 220 * dpr), { maxSize: Math.round(15 * dpr), minSize: Math.round(9 * dpr), font: (s) => `600 ${s}px system-ui, "Helvetica Neue", Arial, sans-serif`, label: 'flight airport label' });
                    ctx.shadowBlur = 0;
                }
                // plane (heading from the next route point)
                const [px, py, pv] = P(plane[0], plane[1]), nx = slerpLL(A, B, Math.min(1, e + 0.01)), [qx, qy] = P(nx[0], nx[1]);
                if (pv > 0) drawPlane(ctx, px, py, Math.atan2(qy - py, qx - px), dpr * (portrait ? 0.9 : 1.1));
            }
            // timezone panel: local time at origin and destination for the elapsed flight time
            const pw = Math.min(W - 24 * dpr, 360 * dpr), ph = 64 * dpr, px0 = portrait ? (W - pw) / 2 : 24 * dpr, py0 = portrait ? 76 * dpr : 22 * dpr; // portrait: below the Skip button
            ctx.fillStyle = 'rgba(8,12,22,0.72)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px0, py0, pw, ph, 14 * dpr) : ctx.rect(px0, py0, pw, ph); ctx.fill();
            ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
            const col = (ap, x) => {
                ctx.fillStyle = '#94a3b8'; drawFitText(ctx, `${ap.code} · ${fmtDay(now2, ap.tz)}`, x, py0 + 20 * dpr, pw / 2 - 28 * dpr, { maxSize: Math.round(12 * dpr), minSize: Math.round(8 * dpr), font: (s) => `600 ${s}px system-ui, sans-serif`, label: 'flight tz day' });
                ctx.fillStyle = '#f8fafc'; drawFitText(ctx, fmtTime(now2, ap.tz), x, py0 + 44 * dpr, pw / 2 - 28 * dpr, { maxSize: Math.round(24 * dpr), minSize: Math.round(12 * dpr), font: (s) => `300 ${s}px system-ui, sans-serif`, label: 'flight tz time' });
            };
            col(A, px0 + 16 * dpr); col(B, px0 + pw / 2 + 12 * dpr);
            ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; drawFitText(ctx, '→', px0 + pw / 2 - 2 * dpr, py0 + 40 * dpr, 20 * dpr, { maxSize: Math.round(18 * dpr), minSize: 8, font: (s) => `${s}px system-ui`, label: 'flight tz arrow' });
            // progress bar
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px0 + 16 * dpr, py0 + ph - 8 * dpr, pw - 32 * dpr, 3 * dpr); ctx.fillStyle = '#fbbf24'; ctx.fillRect(px0 + 16 * dpr, py0 + ph - 8 * dpr, (pw - 32 * dpr) * e, 3 * dpr);
            let cap = captions[0][1]; for (const [at, txt] of captions) if (t >= at) cap = txt; caption.textContent = cap;
            if (t < 1) raf = requestAnimationFrame(draw); else setTimeout(finish, 900);
        };
        const finish = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); overlay.classList.remove('show'); skip.removeEventListener('click', finish); window.removeEventListener('keydown', onKey); resolve(); };
        const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') finish(); };
        skip.addEventListener('click', finish); window.addEventListener('keydown', onKey);
        if (audio) audio.chime();
        raf = requestAnimationFrame(draw);
    });
}
