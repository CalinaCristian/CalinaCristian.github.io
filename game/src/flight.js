/**
 * Flight cutscene: a stylised world map (canvas 2D) with a plane flying the great-circle-ish arc
 * between Bucharest (OTP) and Seattle (SEA). Resolves when finished or skipped.
 */

// Very coarse continent outlines (lon, lat) — intentionally stylised.
const NORTH_AMERICA = [[-168, 66], [-162, 70], [-140, 70], [-125, 71], [-110, 73], [-95, 72], [-82, 70], [-70, 62], [-62, 56], [-55, 52], [-60, 47], [-66, 44], [-70, 42], [-74, 40], [-76, 35], [-81, 31], [-80, 26], [-83, 29], [-89, 30], [-95, 29], [-97, 26], [-100, 20], [-105, 20], [-106, 23], [-110, 24], [-113, 29], [-117, 32], [-122, 37], [-124, 42], [-124, 48], [-128, 52], [-134, 57], [-140, 60], [-148, 61], [-152, 59], [-160, 56], [-165, 60], [-166, 64]];
const GREENLAND = [[-55, 60], [-45, 61], [-40, 65], [-22, 70], [-18, 76], [-30, 83], [-55, 82], [-68, 78], [-60, 70], [-52, 66]];
const EUROPE_AFRICA = [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [-2, 49], [2, 51], [5, 53], [9, 54], [8, 57], [11, 59], [5, 62], [14, 68], [24, 71], [30, 70], [40, 67], [45, 60], [50, 55], [60, 55], [60, 45], [48, 42], [40, 44], [30, 46], [29, 41], [26, 38], [22, 37], [16, 38], [12, 44], [8, 44], [4, 43], [0, 42], [-2, 37], [-6, 36], [-10, 33], [-16, 24], [-17, 15], [-15, 11], [-8, 5], [0, 5], [10, 4], [12, 10], [20, 32], [30, 31], [35, 32], [38, 36], [36, 37]];
const UK = [[-5, 50], [1, 51], [2, 53], [-2, 56], [-3, 59], [-6, 58], [-5, 55], [-3, 54], [-5, 52]];
const ICELAND = [[-24, 64], [-18, 63], [-13, 65], [-16, 66], [-22, 66]];

const OTP = { lon: 26.08, lat: 44.57, name: 'Bucharest (OTP)' };
const SEA = { lon: -122.30, lat: 47.44, name: 'Seattle (SEA)' };

export function playFlight({ from = 'bucharest', hud, audio, texts }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('flight');
        const canvas = overlay.querySelector('canvas');
        const caption = overlay.querySelector('.caption');
        const skip = overlay.querySelector('[data-skip]');
        overlay.classList.add('show');
        const ctx = canvas.getContext('2d');
        const W = canvas.width = Math.min(1400, window.innerWidth * devicePixelRatio);
        const H = canvas.height = Math.min(800, window.innerHeight * devicePixelRatio);
        // projection window
        const lon0 = -150, lon1 = 50, lat0 = 12, lat1 = 80;
        const P = (lon, lat) => [((lon - lon0) / (lon1 - lon0)) * W, ((lat1 - lat) / (lat1 - lat0)) * H];
        const A = from === 'bucharest' ? OTP : SEA, B = from === 'bucharest' ? SEA : OTP;
        const start = performance.now(); const DUR = 11000;
        let raf, finished = false;
        const captions = texts || [
            [0, 'Summer 2022'], [0.12, 'Boarding at Henri Coandă (OTP)…'], [0.3, 'Over the Atlantic. 1 layover, ~14 hours door to door.'], [0.55, 'Crossing Greenland & northern Canada'], [0.75, 'Descending into the Pacific Northwest'], [0.9, 'Welcome to Seattle–Tacoma (SEA). Grab a rental car ➜ Bellevue.'],
        ];
        const fill = (poly, color) => { ctx.beginPath(); poly.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); };
        const arc = (t) => { // quadratic curve bending north (approximate great circle)
            const [ax, ay] = P(A.lon, A.lat), [bx, by] = P(B.lon, B.lat);
            const [cx, cy] = P((A.lon + B.lon) / 2, 78);
            const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
            const dx = 2 * (1 - t) * (cx - ax) + 2 * t * (bx - cx), dy = 2 * (1 - t) * (cy - ay) + 2 * t * (by - cy);
            return { x, y, ang: Math.atan2(dy, dx) };
        };
        const draw = (now) => {
            const t = Math.min(1, (now - start) / DUR);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            // ocean
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b2a4a'); g.addColorStop(1, '#123e63');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            // graticule
            ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
            for (let lo = -180; lo <= 60; lo += 20) { const [x] = P(lo, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let la = 0; la <= 80; la += 10) { const [, y] = P(0, la); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
            // land
            fill(NORTH_AMERICA, '#3f6b4f'); fill(GREENLAND, '#d9e2ea'); fill(ICELAND, '#9fb3a6'); fill(EUROPE_AFRICA, '#4a7a55'); fill(UK, '#4a7a55');
            // route
            ctx.setLineDash([8 * devicePixelRatio, 10 * devicePixelRatio]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * devicePixelRatio;
            ctx.beginPath(); for (let i = 0; i <= 60; i++) { const p = arc(i / 60); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3 * devicePixelRatio; ctx.beginPath(); for (let i = 0; i <= 60; i++) { const p = arc(i / 60 * e); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
            // endpoints
            for (const c of [A, B]) { const [x, y] = P(c.lon, c.lat); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 6 * devicePixelRatio, 0, 7); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y, 3 * devicePixelRatio, 0, 7); ctx.fill(); ctx.font = `bold ${15 * devicePixelRatio}px Helvetica, Arial`; ctx.fillStyle = '#fff'; ctx.textAlign = c === A ? 'left' : 'right'; ctx.fillText(c.name, x + (c === A ? 12 : -12) * devicePixelRatio, y - 12 * devicePixelRatio); }
            // plane
            const p = arc(e);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.scale(devicePixelRatio, devicePixelRatio);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -4); ctx.lineTo(-14, -14); ctx.lineTo(-8, -14); ctx.lineTo(-2, -4); ctx.lineTo(-10, -2); ctx.lineTo(-16, -8); ctx.lineTo(-18, 0); ctx.lineTo(-16, 8); ctx.lineTo(-10, 2); ctx.lineTo(-2, 4); ctx.lineTo(-8, 14); ctx.lineTo(-14, 14); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
            // caption
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
