// Owner-requested fictional Easter egg (feedback 79 / 84), reached from the existing enterable bookshop lobby.
// Keep this room separate from the source street frontage and the normal tourist itinerary.
import { declareInterior } from '../precip-shelter.js';
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, canvas, canvasTexture, obb, polyArea, offsetPolyline, flatGeometry,distPolyline } from '../kit.js';
import { bucActivity, signAtlas } from '../buc.js';
import { wallGeometry } from '../osm.js';
import { addDinamoHintTV } from './dinamo-hint-tv.js';
import { officialHagiTV } from '../official-hagi-tv.js';
import { createBarBroadcast } from './bar-broadcast.js';
import { dressFor } from '../../crowd.js';
const grow = (poly, d) => { const o = offsetPolyline([...poly, poly[0], poly[1]], polyArea(poly) > 0 ? -d : d); return o.slice(1, poly.length + 1); };
function ringWalls(ctx, poly, y0, y1) { for (let i=0; i<poly.length; i++) { const [ax,az]=poly[i], [bx,bz]=poly[(i+1)%poly.length]; ctx.collider({ wall:true, ax,az,bx,bz, y0a:y0,y1a:y1,y0b:y0,y1b:y1, x:(ax+bx)/2,z:(az+bz)/2,r:Math.hypot(bx-ax,bz-az)/2+.5 }); } }
const WCP_URL = 'https://wcpredictions.cristiancalina.com/';
const WCP_PAGES = ['home', 'matches', 'standings', 'bracket', 'today', 'guide'];
const NATIONS = [['#002b7f', '#fcd116', '#ce1126'], ['#000000', '#dd0000', '#ffce00'], ['#0055a4', '#ffffff', '#ef4135'], ['#009246', '#ffffff', '#ce2b37'], ['#74acdf', '#ffffff', '#74acdf'], ['#009c3b', '#ffdf00', '#002776'], ['#c60b1e', '#ffc400', '#c60b1e'], ['#ff6600', '#ffffff', '#21468b'], ['#006600', '#ff0000', '#ffcc00'], ['#ffffff', '#cf142b', '#ffffff'], ['#000000', '#ffd700', '#e00000'], ['#006847', '#ffffff', '#ce1126']];
// note 84: the kiosk opens a panel about the project (facts only from the site's own home / guide pages), with a screenshot
// carousel and "Open the site"; same panel container + close rules as the spot plaques (Esc / E / Close, focus back to the game)
const WCP_CAPS = { home: 'Home — the 2026 tournament at a glance', matches: 'Matches — every fixture, pick the outcome', standings: 'Standings — the World leaderboard and your groups', bracket: 'Bracket — groups through to the final', today: 'Today — the matchday board with live results', guide: 'Guide — how picks and points work' };
let WCP_CSS = false;
function wcpPanel(s, onSeen) {
    const ui = s.ui, p = ui.$('.sp-panel'); if (!p || ui.panelOpen) return;
    if (!WCP_CSS) { WCP_CSS = true; const st = document.createElement('style'); st.textContent = `
#spot-ui .wcp{width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:linear-gradient(165deg,#0f2a1a,#0b1d13);border:2px solid #f4d35e;border-radius:12px;padding:18px 20px;color:#eef3ea;box-shadow:0 20px 60px rgba(0,0,0,.6);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#spot-ui .wcp h3{margin:0;font-size:24px;color:#f4d35e} #spot-ui .wcp .wcp-sub{margin:4px 0 12px;opacity:.9}
#spot-ui .wcp h4{margin:12px 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:1px;color:#f4d35e}
#spot-ui .wcp ul{margin:0 0 6px 18px;padding:0} #spot-ui .wcp li{margin:0 0 5px}
#spot-ui .wcp .wcp-car{position:relative;margin-top:10px;background:#000;border-radius:8px;overflow:hidden;touch-action:pan-y}
#spot-ui .wcp .wcp-car img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain;background:#0b0f0c}
#spot-ui .wcp .wcp-cap{font-size:13px;opacity:.85;margin:6px 2px 0;text-align:center}
#spot-ui .wcp .wcp-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font:700 20px system-ui;cursor:pointer}
#spot-ui .wcp .wcp-prev{left:8px} #spot-ui .wcp .wcp-next{right:8px}
#spot-ui .wcp .wcp-dots{display:flex;gap:6px;justify-content:center;margin-top:6px} #spot-ui .wcp .wcp-dots span{width:8px;height:8px;border-radius:50%;background:#4b5b50} #spot-ui .wcp .wcp-dots span.on{background:#f4d35e}
#spot-ui .wcp .wcp-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px} #spot-ui .wcp .wcp-btns a,#spot-ui .wcp .wcp-btns button{font:700 15px system-ui;border-radius:8px;padding:10px 16px;cursor:pointer;text-decoration:none;border:0}
#spot-ui .wcp .wcp-open{background:#f4d35e;color:#0f2a1a} #spot-ui .wcp .wcp-close{background:#2c3e33;color:#eef3ea}
@media (max-width:480px){#spot-ui .wcp{padding:14px 14px;font-size:14px} #spot-ui .wcp h3{font-size:20px}}`; document.head.appendChild(st); }
    if (s.input) { s.input.lookAllowed = false; s.input.releaseLock?.(); }
    const url = (n) => new URL(`../../../assets/wcp/${n}.webp`, import.meta.url).href;
    p.innerHTML = `<div class="wcp" role="dialog" aria-label="World Cup Predictions"><h3>World Cup Predictions</h3>
<div class="wcp-sub">A side project by Cristian, built for fun — a World Cup 2026 prediction game to play with friends.</div>
<h4>How it works</h4><ul>
<li>Build as many fun prediction sets as you like, then submit one official set per edition — to the World leaderboard or to your private groups.</li>
<li>Every saved pick is a "contract": its points are frozen from the odds when you save, so harder correct picks pay more (a 64 % favourite: +10 / −9; a 12 % underdog: +38 / −2).</li>
<li>Private groups use reusable invite links and the same scoring as World.</li>
<li>Picks stay hidden until you submit them to that scope, and become a read-only archive after the tournament.</li>
<li>The whole 2026 tournament: 48 teams, 104 matches, from the groups to the final bracket, a matchday board with live results, an AI forecast, in Romanian and English.</li></ul>
<div class="wcp-car"><img alt=""><button class="wcp-nav wcp-prev" aria-label="Previous">‹</button><button class="wcp-nav wcp-next" aria-label="Next">›</button></div>
<div class="wcp-cap"></div><div class="wcp-dots">${WCP_PAGES.map(() => '<span></span>').join('')}</div>
<div class="wcp-btns"><a class="wcp-open" href="${WCP_URL}" target="_blank" rel="noopener">Open the site ↗</a><button class="wcp-close" data-close>Close</button></div></div>`;
    let i = 0; const img = p.querySelector('.wcp-car img'), cap = p.querySelector('.wcp-cap'), dots = [...p.querySelectorAll('.wcp-dots span')];
    const show = (k) => { i = (k + WCP_PAGES.length) % WCP_PAGES.length; img.src = url(WCP_PAGES[i]); img.alt = WCP_CAPS[WCP_PAGES[i]]; cap.textContent = `${i + 1} / ${WCP_PAGES.length} · ${WCP_CAPS[WCP_PAGES[i]]}`; dots.forEach((d, j) => d.classList.toggle('on', j === i)); };
    show(0); p.classList.add('show'); onSeen?.();
    p.querySelector('.wcp-prev').onclick = () => show(i - 1); p.querySelector('.wcp-next').onclick = () => show(i + 1);
    { const car = p.querySelector('.wcp-car'); let x0 = null; car.addEventListener('pointerdown', (e) => { x0 = e.clientX; }); car.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) show(i + (e.clientX < x0 ? 1 : -1)); x0 = null; }); }
    p.querySelector('.wcp-open').addEventListener('click', () => onSeen?.());
    const swallowUp = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keyup', swallowUp, true); };
    const close = (e) => { if (!p.classList.contains('show')) return; p.classList.remove('show'); window.removeEventListener('keydown', key, true); if (e?.type === 'keydown') window.addEventListener('keyup', swallowUp, true); document.activeElement?.blur?.(); p.innerHTML = ''; ui._closePanel = null; if (s.input) { s.input.lookAllowed = true; s.input.flush?.(); s.input.keys?.clear?.(); } s.returnFocus?.(); };
    const key = (e) => { if (['Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(e); } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); show(i + (e.code === 'ArrowRight' ? 1 : -1)); } };
    p.querySelector('[data-close]').onclick = () => close(); p.onclick = (e) => { if (e.target === p) close(); };
    const keyTimer = setTimeout(() => { if (p.classList.contains('show')) window.addEventListener('keydown', key, true); }, 120);
    s.spot.ctx.extras.wcpRoom.room.addEventListener('removed', () => { clearTimeout(keyTimer); window.removeEventListener('keydown', key, true); }, { once:true });
    ui._closePanel = close;
}
function buildRoom(ctx, B) {
    const g = ctx.ground, { p, gmax, door } = B, y = gmax + 0.03, H = 4.1, b = new GeoBatch();
    // Enclosed fictional Easter egg room. Its remote scene coordinates never replace a real venue.
    const o = obb(p), D = Math.max(6, Math.min(10.5, Math.max(o.wid, o.len) - 1)), RW = door.L / 2 - 0.3;
    const Q = (u, v) => [door.mx + door.ux * u - door.nx * v, door.mz + door.uz * u - door.nz * v];
    let inner = [Q(-RW, 0.3), Q(RW, 0.3), Q(RW, D), Q(-RW, D)]; if (polyArea(inner) < 0) inner = inner.reverse();
    ringWalls(ctx, inner, y - 1, y + H);
    // floor (walkable), ceiling, warm dark-red interior walls with a wood dado
    let floorP = [Q(-RW, -0.12), Q(RW, -0.12), Q(RW, D), Q(-RW, D)]; if (polyArea(floorP) < 0) floorP = floorP.reverse(); // floor runs out under the threshold (no grass strip in the doorway)
    b.flat(floorP, y, '#5a3a24', 'wood'); g.addPoly(floorP, y, y - 2);
    { const cg = flatGeometry(inner, y + H); const idx = cg.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } cg.computeVertexNormals(); b.add(cg, 'paint', null, '#2a2220'); cg.dispose(); }
    const inward = (geo) => { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } geo.computeVertexNormals(); return geo; }; // wallGeometry faces outward: flip to face into the room
    b.add(inward(wallGeometry(inner, y, y + H, { bay: 3, floor: 4 }, y, '#9a4434')), 'paint', null, '#9a4434'); b.add(inward(wallGeometry(grow(inner, -0.03), y, y + 1.0, { bay: 3, floor: 4 }, y, '#4a2e1c')), 'wood', null, '#4a2e1c');
    // local frame: u along the street front, v inward
    ctx.extras.wcpDoor = { mx: door.mx, mz: door.mz, nx: door.nx, nz: door.nz, y };
    const ux = door.ux, uz = door.uz, vx = -door.nx, vz = -door.nz, depth = D - 0.3, half = door.L / 2 - 0.6;
    const P = (u, v) => [door.mx + ux * u + vx * v, door.mz + uz * u + vz * v], yaw = Math.atan2(ux, uz);
    // bar counter along the back wall, taps, bottle shelves, stools
    const cv = depth - 1.6; { const [x, z] = P(0, cv); b.box(x, y, z, 0.7, 1.08, door.L * 0.62, '#3b2416', 'wood', yaw); b.box(x, y + 1.08, z, 0.82, 0.06, door.L * 0.64, '#1d1a17', 'stone', yaw); ctx.box(x, z, door.L * 0.31, 0.4, Math.atan2(vx, vz) + Math.PI / 2, { prop: true, h: 1.1 });
        for (let k = -3; k <= 3; k++) { const [tx, tz] = P(k * 0.35, cv + 0.15); b.cyl(tx, y + 1.14, tz, 0.03, 0.42, '#c9c9c9', 'chrome', 8); b.box(tx, y + 1.5, tz, 0.07, 0.14, 0.05, NATIONS[(k + 6) % NATIONS.length][0], 'paint', yaw); }
        const [sx, sz] = P(0, depth - 0.25); for (const hh of [1.3, 1.8, 2.3]) { b.box(sx, y + hh, sz, 0.3, 0.04, door.L * 0.62, '#3b2416', 'wood', yaw); for (let k = 0; k < 26; k++) { const [bx, bz] = P(-door.L * 0.29 + k * door.L * 0.58 / 25, depth - 0.25); b.cyl(bx, y + hh + 0.04, bz, 0.035, 0.26, ['#2e5a2e', '#6b3a1a', '#d8d0b0', '#3a2a5a', '#8a1a1a'][k % 5], 'glass', 6); } }
        for (let k = -2; k <= 2; k++) { const [qx, qz] = P(k * door.L * 0.13, cv - 0.75); b.cyl(qx, y, qz, 0.03, 0.75, '#222', 'metal', 6); b.cyl(qx, y + 0.75, qz, 0.2, 0.06, '#5a1e22', 'fabric', 10); } }
    // high tables, scarves and flags of many nations, bunting across the ceiling
    for (const [u, v] of [[-half * 0.6, 1.8], [half * 0.6, 1.8], [-half * 0.6, 3.6], [half * 0.6, 3.6]]) { if (v > cv - 1.2) continue; const [x, z] = P(u, v); b.cyl(x, y, z, 0.05, 1.05, '#1e1f21', 'metal', 6); b.cyl(x, y + 1.05, z, 0.38, 0.04, '#3b2416', 'wood', 12); ctx.circle(x, z, 0.4, 1.1); }
    NATIONS.forEach((n, i) => { const side = i % 2 ? 1 : -1, v = 0.8 + (i >> 1) * Math.max(0.6, (depth - 1.6) / 6); if (side === 1 && Math.abs(v - 4.6) < 1.9) return; const [x, z] = P(side * (door.L / 2 - 0.36), v); for (let k = 0; k < 3; k++) b.box(x, y + 2.3 + k * 0.42, z, 0.03, 0.42, 1.0, n[k], 'fabric', yaw); });
    for (let row = 0; row < 3; row++) { const v = 1.2 + row * (depth - 2) / 3, n = 16; for (let k = 0; k < n; k++) { const u = -half + k * (half * 2) / (n - 1), [x, z] = P(u, v), col = NATIONS[(k + row * 5) % NATIONS.length][k % 3]; b.add(new THREE.ConeGeometry(0.12, 0.26, 3), 'fabric', M(x, y + H - 0.32, z, Math.PI, yaw, 0), col); } }
    for (let k = 0; k < 5; k++) { const [x, z] = P(-half + 0.3 + k * 0.5, cv - 0.02); b.box(x, y + 1.6, z, 0.18, 0.9, 0.02, NATIONS[k * 2][k % 2], 'fabric', yaw); } // scarves hung on the bar front
    // Main sports TV: enter the official repeating Hagi player from the floor before the bar.
    // (L28) the screen plays an original match broadcast on its own while the room is visible (bar-broadcast.js)
    const tvCanvas = canvas(768, 432), broadcast = createBarBroadcast(tvCanvas);
    const hagi = officialHagiTV(ctx), tvTex = canvasTexture(tvCanvas), tvMat = new THREE.MeshBasicMaterial({ map: tvTex, color: new THREE.Color(0.8, 0.8, 0.8), toneMapped: false }); tvMat.name = 'wcp-tv';
    const tvs = [];
    const tv = (u, v, ry, w = 1.6) => { const [x, z] = P(u, v); b.box(x, y + 2.1, z, w + 0.08, w * 0.5625 + 0.08, 0.06, '#111', 'plastic', ry); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), tvMat); m.position.set(x + Math.sin(ry) * 0.035, y + 2.1 + (w * 0.5625 + 0.08) / 2, z + Math.cos(ry) * 0.035); m.rotation.y = ry; m.name = 'hagi-highlights-tv'; ctx.add(m); tvs.push(m); };
    tv(0, depth - 0.3, Math.PI, 2.6);
    const [hx, hz] = P(half - 0.03, 4.6);
    const hint = addDinamoHintTV(ctx, { x: hx, y: y + 2.6, z: hz, yaw: -Math.PI / 2, w: 2.6 });
    const [watchX, watchZ] = P(0, cv - 1.0);
    ctx.interactables.push({ hidden: true, x: watchX, z: watchZ, y, r: 2.0, label: 'Watch Hagi highlights · FIFA', cond: () => ctx.room.visible, use: s => hagi.open(s) });
    ctx.extras.hagiTV = hagi;
    ctx.onUpdate(dt => { if (ctx.room.visible && broadcast.update(dt)) tvTex.needsUpdate = true; });
    ctx.extras.barBroadcast = broadcast;
    // the World Cup Predictions kiosk (owner's project): a standing screen cycling through the site previews; E = next page
    const kv = Math.min(1.6, depth * 0.3), [kx, kz] = P(-(half - 0.5), kv), kyaw = yaw + Math.PI / 2 * 0 + Math.atan2(0, 1) + Math.PI * 0 + (Math.PI / 2); void kyaw;
    const kioskYaw = Math.PI / 2; // faces +u (into the room from the left wall)
    b.box(kx, y, kz, 0.6, 0.9, 0.5, '#1d1f22', 'plastic', kioskYaw); b.box(kx, y + 0.9, kz, 0.12, 0.6, 0.12, '#1d1f22', 'metal', kioskYaw);
    const tl = new THREE.TextureLoader(), pages = WCP_PAGES.map((n) => { const t = tl.load(new URL(`../../../assets/wcp/${n}.webp`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
    const kMat = new THREE.MeshBasicMaterial({ map: pages[0], color: new THREE.Color(0.82, 0.82, 0.82), toneMapped: false }); kMat.name = 'wcp-kiosk'; // readable: unlit, ~0.82 white, under the bloom threshold
    const kScr = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.8), kMat); const fx = Math.sin(kioskYaw), fz = Math.cos(kioskYaw);
    b.box(kx, y + 1.45, kz, 1.38, 0.9, 0.08, '#111', 'plastic', kioskYaw); kScr.position.set(kx + fx * 0.045, y + 1.9, kz + fz * 0.045); kScr.rotation.y = kioskYaw; kScr.name = 'wcp-kiosk-screen'; ctx.add(kScr);
    let page = 0, auto = 0; const show = (i) => { page = (i + pages.length) % pages.length; kMat.map = pages[page]; kMat.needsUpdate = true; };
    ctx.onUpdate((dt) => { if (!ctx.room.visible) return; auto += dt; if (auto > 5) { auto = 0; show(page + 1); } });
    const sg = signAtlas([{ x: kx + fx * 0.05, y: y + 2.5, z: kz + fz * 0.05, yaw: kioskYaw, w: 1.38, h: 0.22, text: 'WORLD CUP PREDICTIONS', bg: '#0f2a1a', fg: '#f1e6c8', border: false, font: (q) => `700 ${q}px Helvetica, Arial, sans-serif` }], { name: 'wcp-signs', night: 1.0 }); if (sg) ctx.add(sg);
    const kp = { x: kx + fx * 1.0, z: kz + fz * 1.0 };
    const seen = (s) => { if (!s._wcpSeen) { s._wcpSeen = true; bucActivity(s, 'old-town-lipscani', 'wcp-bar', '⚽ Hidden project', 'World Cup Predictions — a side project by Cristian.'); } };
    ctx.interactables.push({ hidden: true, x: kp.x, z: kp.z, y, r: 1.8, label: 'World Cup Predictions — look at the screen', use: (s) => { auto = -6; wcpPanel(s, () => seen(s)); } });
    ctx.extras.openWcp = (s) => wcpPanel(s, () => seen(s)); // dev / screenshots
    // warm pendant lights, chants
    for (const [u, v] of [[-half * 0.5, depth * 0.35], [half * 0.5, depth * 0.35], [0, depth * 0.7]]) { const [x, z] = P(u, v); b.rod([x, y + H, z], [x, y + H - 0.7, z], 0.01, '#111', 'metal', 3); b.sphere(x, y + H - 0.78, z, 0.22, 0.16, 0.22, '#ffcf8a', 'glow', 10, 6); }
    for (const v of [0.6, D - 0.5]) { const [x, z] = P(0, v); b.box(x, y + H - 0.12, z, 0.08, 0.06, door.L - 1.2, '#ffd9a0', 'glow', yaw); } // warm LED strips under the ceiling
    // Romanian supporters (owner, note 79): a "TRICOLORII" banner in blue-yellow-red over the screen wall
    { const [x, z] = P(0, depth - 0.12); for (let k = 0; k < 3; k++) { const [bx, bz] = P((k - 1) * 0.9, depth - 0.12); b.box(bx, y + 3.15, bz, 0.9, 0.6, 0.02, ['#002b7f', '#fcd116', '#ce1126'][k], 'fabric', 0); } void x; void z;
      const bs = signAtlas([{ x: P(0, depth - 0.16)[0], y: y + 3.45, z: P(0, depth - 0.16)[1], yaw: Math.PI, w: 2.4, h: 0.36, text: 'HAI ROMÂNIA! · TRICOLORII', bg: '#fcd116', fg: '#002b7f', border: false, font: (q) => `800 ${q}px Helvetica, Arial, sans-serif` }], { name: 'wcp-banner', night: 0.6 }); if (bs) ctx.add(bs); }
    // (owner, 2026-11-11: "there's no exit door shown in the bar") The way back is the front wall's centre: a door there,
    // with a lit EXIT sign over it, where "Return to the bookshop" is.
    { const [dx, dz] = P(0, 0.33); b.box(dx, y, dz, 0.06, 2.2, 1.1, '#2f352c', 'wood', yaw); const [hx, hz] = P(0.38, 0.37); b.box(hx, y + 1.0, hz, 0.08, 0.05, 0.05, '#b69a60', 'chrome', yaw); // (box: depth along v, length along the wall)
      const [ex, ez] = P(0, 0.34); b.box(ex, y + 2.32, ez, 0.04, 0.2, 0.62, '#2bd46b', 'glow', yaw);
      const es = signAtlas([{ x: P(0, 0.37)[0], y: y + 2.42, z: P(0, 0.37)[1], yaw: Math.atan2(vx, vz), w: 0.58, h: 0.17, text: 'IEȘIRE · EXIT', bg: '#1f9e52', fg: '#ffffff', border: false, font: (q) => `700 ${q}px system-ui, sans-serif` }], { name: 'wcp-exit-sign', night: .9 }); if (es) ctx.add(es); }
    ctx.add(b.build('wcp-bar', { castShadow: false }));
    for (const v of [D * 0.3, D * 0.7]) { const [x, z] = P(0, v); ctx.lampPoints.push({ x, z, h: H - 0.9 + (y - g.heightAt(x, z)), noPost: true }); }
    ctx.sound('crowd', door.mx + vx * depth / 2, door.mz + vz * depth / 2, 14, 1.0);
    // fans: watching the screens, sitting at the bar, a group at the high tables
    const [fx0, fz0] = P(0, Math.min(depth * 0.35, cv - 1.8)), [tvx, tvz] = P(0, depth);
    ctx.extras.wcpHint = hint;
    ctx.room.addEventListener('removed', () => { pages.forEach(t => t.dispose()); tvTex.dispose(); tvs.forEach(m => m.onBeforeRender = () => {}); });
    return { door, hint, groups: [
        ...[[-half * 0.22, 2.7], [half * 0.22, Math.min(4.9, cv - 2.2)], [0, Math.min(6.4, cv - 1.4)]].map(([u, v]) => { const [gx, gz] = P(u, v); return { x: gx, z: gz, r: 0.55, n: 3, act: 'watch', look: [tvx, tvz], fixedYaw: true, y, personas: ['fan_ro'] }; }), // three groups round the high tables, all facing the screen over the bar
        ...[-1, 1].map((k) => { const [qx, qz] = P(k * door.L * 0.13, cv - 0.75); return { x: qx, z: qz, r: 0.01, n: 1, act: 'sit', yaw: yaw + Math.PI / 2 * 0 + Math.atan2(vx, vz) - yaw, y: y + 0.81 - 0.45, fixedYaw: true, personas: ['fan_ro'] }; }), // (on a bar stool: its seat is 0.81 m up, the sitting pose puts the hips 0.45 m above the feet)
        { x: door.mx + vx * 0.9 + ux * (half - 0.4), z: door.mz + vz * 0.9 + uz * (half - 0.4), r: 0.6, n: 2, act: 'talk', y, personas: ['fan_ro'] },
    ] };
}


export function buildSecretWcpBar(ctx, carusel) {
    if (!carusel) return { groups: [] };
    // An unmarked interior door in the existing lobby. No exterior venue name or real-world claim.
    const f = carusel.front;
    const oldEntry={x:f.x-f.nx*8+f.nz*3.5,z:f.z-f.nz*8-f.nx*3.5};
    const wall=distPolyline(oldEntry.x,oldEntry.z,[...carusel.poly,carusel.poly[0]]), vx=oldEntry.x-wall.cx,vz=oldEntry.z-wall.cz,L=Math.hypot(vx,vz),ix=vx/L,iz=vz/L;
    // Put the fictional side door on the modeled interior wall, with its Use
    // position1.25m in front of the wall, rather than an unmarked point in the atrium.
    const entry = { x:wall.cx+ix*1.25,z:wall.cz+iz*1.25,y:carusel.y0 };
    const portal=new GeoBatch(),doorYaw=Math.atan2(ix,iz);
    portal.box(wall.cx+ix*.6,carusel.y0,wall.cz+iz*.6,1.08,2.25,.12,'#2f352c','wood',doorYaw);
    portal.box(wall.cx+ix*.68,carusel.y0+.95,wall.cz+iz*.68,.07,.07,.035,'#b69a60','chrome',doorYaw);
    ctx.box(wall.cx+ix*.6,wall.cz+iz*.6,.54,.06,doorYaw,{prop:true,y0:carusel.y0,y1:carusel.y0+2.25});
    ctx.add(portal.build('carusel-unmarked-fictional-side-door',{castShadow:false}));
    const room = new THREE.Group(); room.name = 'wcp-secret-interior'; room.visible = false; ctx.add(room);
    // A remote enclosed interior keeps source building colliders/roofs completely intact.
    const x = 8000, z = 8000, y = ctx.ground.heightAt(x, z) + .03;
    const rctx = Object.create(ctx); rctx.room = room;
    rctx.add = (...objects) => { room.add(...objects); return objects[0]; };
    rctx.collider = (c) => ctx.collider({ y0:y-.2, y1:y+4.1, intended:true, ...c });
    const door = { mx:x, mz:z, ux:1, uz:0, nx:0, nz:-1, L:11.6 };
    declareInterior(ctx,{box:{x0:x-5.8,z0:z-.5,x1:x+5.8,z1:z+10.5},y0:y-1,y1:y+4.3,pad:1,name:'wcp-room'}); // a ceilinged room: no rain or snow in it
    const B = buildRoom(rctx, { p:[[x-5.8,z],[x+5.8,z],[x+5.8,z+10.5],[x-5.8,z+10.5]], gmax:y-.03, door });
    B.groups.forEach(group => { group.wcpFan = true; });
    const lines = ctx.spot('old-town-lipscani').dialogue.lines;
    lines.push({p:'fan_ro',ctx:'greeting',text:'Come on, Romania!',orig:'Hai România!',lang:'ro'}, {p:'fan_ro',ctx:'idle',text:'What a goal!',orig:'Ce gol!',lang:'ro'});
    const light = new THREE.PointLight('#ffd4a3', 38, 16, 2); light.position.set(x,y+3.5,z+4.5); room.add(light);
    let lastSession = null, returnPose = null, fans = null, mapUpdate = null;
    const restoreMap = () => { if (mapUpdate && lastSession?.map) { lastSession.map.update = mapUpdate; mapUpdate = null; } };
    room.addEventListener('removed', restoreMap);
    const leave = (s) => {
        const dest = returnPose || entry; room.visible = false; B.hint.pause(); restoreMap();
        s.ctl.enter(dest.x, dest.z, dest.heading ?? 0, dest.y); s.returnFocus();
    };
    ctx.interactables.push({ hidden:true, x:entry.x,z:entry.z,y:entry.y,r:1.6,label:'Open the unmarked side door',use:(s)=>{
        returnPose = { ...s.position, heading:s.ctl.heading }; lastSession = s; room.visible = true;
        if (!mapUpdate && s.map) { mapUpdate = s.map.update; s.map.update = function(dt,p) { return mapUpdate.call(this,dt,room.visible ? {...entry,heading:p.heading} : p); }; }
        s.ctl.enter(x,z+1.1,Math.PI,y); s.returnFocus();
    }});
    ctx.interactables.push({ x,z:z+.6,y,r:1.4,label:'Exit · return to the bookshop',cond:()=>room.visible,use:leave });
    let hinted=false;
    ctx.onUpdate((dt,s)=>{ lastSession=s;
        if(!hinted&&!room.visible&&Math.hypot(s.position.x-f.x,s.position.z-f.z)<13&&s.ctl.active){hinted=true;s.ui.toast('A little Carusel secret','Walk through the central bookshop doorway. On the ground floor, look for the unmarked dark side door.');}
        if (!fans && s.spot.crowd?.cr) { fans = s.spot.crowd.peds.map((p,i)=>({p,i})).filter(({p})=>p.group?.wcpFan); fans.forEach(({p,i})=>{p.look.prop='none';s.spot.crowd.cr.dress(i,dressFor('bucharest','summer',null,Math.random,'fan'));}); }
        if (room.visible && fans) fans.forEach(({p,i})=>s.spot.crowd.cr.set(i,{x:p.x,y:p.y,z:p.z,yaw:p.yaw+Math.PI,phase:p.phase,scale:p.look.scale,amp:0,pose:p.act==='sit'?'sit':i%3===0?'cheer':'stand',prop:i%4===0?'flag':null})); if(room.visible && Math.hypot(s.position.x-x,s.position.z-z)>30) {room.visible=false;ctx.extras.wcpHint.pause();restoreMap();} });
    ctx.extras.wcpRoom = { room,entry,sideDoor:{x:wall.cx,z:wall.cz,y:carusel.y0},spawn:{x,z:z+1.1,y},leave, get session(){return lastSession;} };
    // No rendering of a second world during TV playback. Scene removal releases video and textures.
    return B;
}
