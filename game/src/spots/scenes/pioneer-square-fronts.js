// ============================================================================
//  Pioneer Square: the mapped fronts on Pioneer Place, 1st Ave S, Yesler Way,
//  Occidental Ave S and S Main St, each with its own facade (material, colour,
//  storeys, arches, base, storefront, cornice) instead of the generic brick.
//
//  Volumes, roofs and colliders stay the native source plan (spots/osm.js
//  buildBuildings on the unchanged footprints and heights); only the wall
//  material changes: one canvas per building, drawn to the building's own
//  height and storey count (OSM `building:levels`), with a cornice moulding
//  along its street faces. OSM `building:colour` wins where it is mapped
//  (the 1st Ave S row #85552e). Everything else is what the official Google
//  panoramas show (viewed 2026-11-13 through the thumbnail endpoint, nothing
//  stored; ids per front below). Estimates: bay widths, opening sizes, floor
//  heights, colours (judged albedo), window frames.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, canvas, canvasTexture, inPoly } from '../kit.js';
import { buildBuildings } from '../osm.js';

// mat: brick | stone | paint | modern ; base: ground-floor (and `baseFl` floors) material colour ; shop: storefront frame ;
// arch: gf (round-arched ground-floor openings) | f1 (arched first upper floor) | big (arches over floors 1–2) | top (arched top floor) | all
// pair: two windows per bay ; frame: window frame colour ; cornice: moulding colour (null: plain parapet) ; src: panorama id @ bearing
const RED = '#8c4535', TRIM = '#cfc6b3';
export const FRONTS = {
    w140345971: { name: 'Mutual Life Building', mat: 'brick', wall: '#cbb68e', base: '#a65b44', baseFl: 2, arch: ['gf'], pair: true, cornice: '#b8a684', frame: '#e3dccb', src: 'kJVn9dVw2rWKgTf-rsYWzw@250' },
    w439990280: { name: 'Yesler Building', mat: 'stone', wall: '#8f8678', base: '#8f8678', baseFl: 1, arch: ['f1'], cornice: '#9c9384', src: 'kJVn9dVw2rWKgTf-rsYWzw@215' },
    w226937778: { name: 'Gatzert and Schwabacher Building', mat: 'paint', wall: '#d8d2c4', base: '#34373b', shop: '#34373b', frame: '#55595d', cornice: null, src: 'uVzwONsTTGBy9AqfGImghA@290' },
    w226321137: { name: 'Terry Denny Lofts', mat: 'brick', wall: RED, base: '#9a8f7e', arch: ['top'], pair: true, cornice: '#6f6457', frame: TRIM, src: 'uVzwONsTTGBy9AqfGImghA@250, StRtj6G68vgv607YPmToqw@310' },
    w226937777: { name: 'Maynard Building', mat: 'stone', wall: '#bab4a7', base: '#aea89b', baseFl: 1, arch: ['gf', 'top'], cornice: '#a7a194', frame: '#3c3f40', src: 'StRtj6G68vgv607YPmToqw@270, @250' },
    w226321136: { name: 'J&M Hotel', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#2c4636', cornice: '#6a4636', frame: '#e7e2d6', src: 'iEVQhhDOR8aTqLQD5K522g@255' },
    w439990261: { name: 'Skagit Building', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#2a4a7a', cornice: '#6a4636', frame: '#e7e2d6', src: 'iEVQhhDOR8aTqLQD5K522g@255' },
    w439990229: { name: 'Marathon Building', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#3b2f2a', cornice: '#6a4636', frame: '#e7e2d6', src: 'g3aSGggFrVoEYwpMr3OBLA@270' },
    w439990251: { name: 'Lucky Hotel', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#2d3b47', cornice: '#6a4636', frame: '#e7e2d6', src: 'g3aSGggFrVoEYwpMr3OBLA@270' },
    w439990255: { name: '(1st Ave S row)', mat: 'brick', osmColour: true, base: '#3a3634', shop: '#3b2f2a', cornice: '#6a4636', frame: '#e7e2d6', src: 'g3aSGggFrVoEYwpMr3OBLA@270' },
    w439990270: { name: 'New England Hotel', mat: 'brick', wall: '#8a4636', base: '#3a3634', shop: '#1f4a6a', cornice: '#6a4636', frame: '#e7e2d6', src: 'g3aSGggFrVoEYwpMr3OBLA@270' },
    w226321142: { name: 'Olympic Block', mat: 'modern', wall: '#cbbfa9', base: '#cbbfa9', shop: '#3b3d3f', frame: '#4a4d50', cornice: null, src: 'uVzwONsTTGBy9AqfGImghA@70, 97bndGEyQS57itfhcMvcfA@200' },
    w140631721: { name: 'Lippy Building', mat: 'brick', wall: '#7d4c3d', base: '#9a917f', shop: '#56705f', frame: '#56705f', pair: true, cornice: '#6b5a4a', src: 'uVzwONsTTGBy9AqfGImghA@110' },
    w226321147: { name: 'City Club Building', mat: 'brick', wall: '#a2523e', base: '#3a3634', shop: '#3a3634', arch: ['all'], cornice: '#7a4434', frame: TRIM, src: 'StRtj6G68vgv607YPmToqw@60' },
    w367359273: { name: 'The Delmar Building', mat: 'brick', wall: '#8b4232', base: '#8b4232', shop: '#1f2a44', arch: ['big'], pair: true, cornice: '#6e3a2c', frame: '#2c2f33', src: 'StRtj6G68vgv607YPmToqw@60, @75' },
    w140631796: { name: 'Buttnick Building', mat: 'paint', wall: '#404346', base: '#404346', shop: '#2a2c2e', frame: '#6c7176', cornice: '#4a4d50', src: 'iEVQhhDOR8aTqLQD5K522g@60, @100' },
    w140631769: { name: 'Grand Central', mat: 'brick', wall: '#8e4333', base: '#a8956f', baseFl: 1, arch: ['gf', 'top'], pair: true, cornice: '#7a4434', frame: TRIM, src: 'g3aSGggFrVoEYwpMr3OBLA@70, @90' },
    w226323009: { name: 'Globe Building', mat: 'brick', wall: '#8d4535', base: '#9b958a', baseFl: 2, arch: ['f1'], shop: '#2f6f6a', pair: true, cornice: '#7a4434', frame: TRIM, src: 'OqApslrrErDPH77wLl-ESg@110, 998tDSzok9LVXyH1FIpejQ@135' },
    w389138212: { name: 'Union Trust Building', mat: 'stone', wall: '#b4a68a', base: '#8f8a80', baseFl: 1, arch: ['top'], shop: '#1f3a2c', cornice: '#a49679', frame: '#2c2f2c', src: 'KLmc32jpRbH8dU_WjBku6A@215, 998tDSzok9LVXyH1FIpejQ@135' },
    w389138218: { name: 'Union Trust Annex', mat: 'stone', wall: '#b4a68a', base: '#8f8a80', baseFl: 1, arch: ['top'], shop: '#1f3a2c', cornice: '#a49679', frame: '#2c2f2c', src: '998tDSzok9LVXyH1FIpejQ@135' },
    w226321146: { name: 'Interurban Building', mat: 'brick', wall: '#b0614b', base: '#b0614b', shop: '#22313c', arch: ['big', 'top'], pair: true, cornice: '#9a5440', frame: '#2c2f33', src: 'Eoj9slwTpsFLNZYztebPNg@60' },
    w439990299: { name: 'Korn Building', mat: 'brick', wall: '#8c4535', base: '#3d6b4f', shop: '#3d6b4f', arch: ['top'], pair: true, cornice: '#6e3a2c', frame: TRIM, src: '97bndGEyQS57itfhcMvcfA@185, Eoj9slwTpsFLNZYztebPNg@290' },
    w52782171: { name: "Merchant's Cafe and Saloon", mat: 'brick', wall: '#8a4434', base: '#24402f', shop: '#24402f', cornice: '#6e3a2c', frame: TRIM, src: '97bndGEyQS57itfhcMvcfA@185' },
    w439990295: { name: '(Yesler / Occidental, one storey)', mat: 'modern', wall: '#2a2c2e', base: '#2a2c2e', shop: '#1c1d1f', frame: '#1c1d1f', cornice: null, src: 'Eoj9slwTpsFLNZYztebPNg@250' },
    w27183365: { name: '200 Occidental Building', mat: 'modern', wall: '#5d4c42', base: '#3a3a3a', shop: '#2a2b2d', frame: '#2a2b2d', cornice: null, src: 'b5T7tpwVchrYOjElqXCH9Q@140' },
};

// ---------------------------------------------------------------------------- Occidental Square furniture
// OSM w1155305355 (building=yes, no other tags, 25 × 9 m) is an open canopy: panorama wtV8CTwZJSh3TDNhSKHKLA
// (47.60026,-122.33301) looking 265–290° shows glass roof panels on pale timber beams over black steel posts (~4.6 m)
// with a small timber-clad glass kiosk under it; the walk continues underneath. Rendered so (open canopy over the mapped
// outline, the source record kept): posts, beams, glass. The kiosk's place and size under the canopy are estimates.
// Table tennis n14005376908 and chess n14005378203 (leisure=pitch) at their mapped points: standard outdoor tables.
export const OCC_CANOPY = 'w1155305355';
export function occidentalSquareProps(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), out = {};
    const cb = d.buildings.find((q) => q.id === OCC_CANOPY);
    if (cb) {
        const P = cb.poly, y0 = Math.min(...P.map(([x, z]) => g.heightAt(x, z))), H = 4.6;
        // long axis a→b (first edge), short axis a→d
        const [A, B2, , D] = P.length === 4 ? P : [P[0], P[1], P[2], P[P.length - 1]];
        const ux = B2[0] - A[0], uz = B2[1] - A[1], L = Math.hypot(ux, uz), vx = D[0] - A[0], vz = D[1] - A[1], W = Math.hypot(vx, vz), ry = Math.atan2(-uz, ux);
        const at = (s, t) => [A[0] + ux * s + vx * t, A[1] + uz * s + vz * t];
        const nP = Math.max(2, Math.round(L / 6.2));
        for (let i = 0; i <= nP; i++) for (const t of [0.12, 0.88]) { const [x, z] = at(i / nP * 0.94 + 0.03, t); b.box(x, g.heightAt(x, z) - 0.1, z, 0.22, H - g.heightAt(x, z) + y0 + 0.1, 0.22, '#1d1f21', 'metal'); ctx.circle(x, z, 0.16, H); }
        for (let i = 0; i <= nP; i++) { const [x, z] = at(i / nP * 0.94 + 0.03, 0.5); b.box(x, y0 + H, z, 0.24, 0.42, W * 0.98, '#d9cfbd', 'wood', ry); } // cross beams
        for (const t of [0.12, 0.88]) { const [x, z] = at(0.5, t); b.box(x, y0 + H + 0.42, z, L * 0.98, 0.3, 0.2, '#d9cfbd', 'wood', ry); } // long beams
        const [cx, cz] = at(0.5, 0.5);
        { const gm = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.04, W * 0.98), new THREE.MeshStandardMaterial({ color: '#d4e6ea', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }));
            gm.position.set(cx, y0 + H + 0.74, cz); gm.rotation.y = ry; gm.name = 'occidental-canopy-glass'; ctx.add(gm); }
        // the kiosk (timber band over a glass counter), east part of the canopy
        { const [kx, kz] = at(0.66, 0.5); b.box(kx, y0, kz, 5.6, 1.0, 3.4, '#b99a72', 'wood', ry); b.box(kx, y0 + 1.0, kz, 5.6, 1.2, 3.4, '#2a3238', 'darkglass', ry); b.box(kx, y0 + 2.2, kz, 5.8, 1.1, 3.6, '#c7ab82', 'wood', ry); b.box(kx, y0 + 3.3, kz, 6.2, 0.12, 4.0, '#1d1f21', 'metal', ry);
            const ex = ux / L, ez = uz / L, fx = vx / W, fz = vz / W; ctx.poly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [kx + ex * s * 2.8 + fx * t * 1.7, kz + ez * s * 2.8 + fz * t * 1.7])); }
        out.canopy = { source: OCC_CANOPY, height: H, posts: (nP + 1) * 2 };
    }
    const node = (lat, lon) => ctx.ll(lat, lon);
    { const p = node(47.6002742, -122.3334565), y = g.heightAt(p.x, p.z); // table tennis (n14005376908)
        b.box(p.x, y, p.z, 0.25, 0.66, 1.2, '#4f5356', 'concrete'); b.box(p.x, y + 0.66, p.z, 2.74, 0.1, 1.525, '#2f5d4c', 'concrete'); b.box(p.x, y + 0.76, p.z, 0.04, 0.15, 1.6, '#9aa0a3', 'metal'); ctx.box(p.x, p.z, 1.37, 0.76, 0, { h: 0.9 }); out.tableTennis = [+p.x.toFixed(1), +p.z.toFixed(1)]; }
    { const p = node(47.6002718, -122.3331846), y = g.heightAt(p.x, p.z); // chess (n14005378203)
        b.cyl(p.x, y, p.z, 0.12, 0.72, '#55595c', 'concrete', 10); b.box(p.x, y + 0.72, p.z, 0.8, 0.06, 0.8, '#6f7376', 'concrete');
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) b.box(p.x - 0.28 + i * 0.08 - 0.04 + 0.04, y + 0.781, p.z - 0.28 + j * 0.08, 0.08, 0.004, 0.08, '#2b2b2b', 'concrete');
        for (const [dx, dz] of [[0, 0.85], [0, -0.85]]) b.cyl(p.x + dx, y, p.z + dz, 0.2, 0.45, '#55595c', 'concrete', 10);
        ctx.circle(p.x, p.z, 0.45, 0.8); out.chess = [+p.x.toFixed(1), +p.z.toFixed(1)]; }
    ctx.add(b.build('occidental-square-props'));
    return out;
}

/** canvas facade for one front: 4 bays wide (repeats along the wall), the whole height once (v = 0 at the street, 1 at the top) */
function frontTexture(id, F, H, n, wall) {
    const W = 256, B = W / 4, Ht = Math.max(128, Math.min(1024, Math.round(H * 20))), k = Ht / H, r = rng(id.length * 31 + parseInt(id.slice(1), 10) % 997);
    const c = canvas(W, Ht), g = c.getContext('2d'), e = canvas(W / 2, Ht / 2), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, W / 2, Ht / 2);
    const Y = (m) => Ht - m * k; // metres over the street → canvas y
    const arch = new Set(F.arch || []), corH = F.cornice ? 0.95 : 0.45, gfH = Math.min(5.0, Math.max(3.9, (H / n) * 1.3)), fl = n > 1 ? (H - gfH - corH) / (n - 1) : 0;
    const baseTop = gfH + fl * Math.max(0, (F.baseFl || 1) - 1);
    // wall
    g.fillStyle = wall; g.fillRect(0, 0, W, Ht);
    if (F.mat === 'brick') { for (let y = 0; y < Ht; y += 3) for (let x = (y / 3) % 2 ? -3 : 0; x < W; x += 7) { g.fillStyle = `rgba(${r() < 0.5 ? '40,20,15' : '255,235,220'},${0.04 + r() * 0.07})`; g.fillRect(x, y, 6, 2); } }
    else if (F.mat === 'stone') { g.fillStyle = 'rgba(40,35,30,0.16)'; for (let m = 0; m < H; m += 0.6) { const y = Y(m); g.fillRect(0, y, W, 1); for (let x = ((m / 0.6) % 2) * 10; x < W; x += 20) g.fillRect(x, y - 0.6 * k, 1, 0.6 * k); } }
    else if (F.mat === 'modern') { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < W; x += B) g.fillRect(x, 0, 1.5, Ht); }
    // base (ground floor, or the two lower floors) in its own material, rusticated when stone
    g.fillStyle = F.base || wall; g.fillRect(0, Y(baseTop), W, baseTop * k);
    if (F.base && F.base !== wall) { g.fillStyle = 'rgba(30,25,20,0.18)'; for (let m = 0.5; m < baseTop; m += 0.5) g.fillRect(0, Y(m), W, 1.2); }
    g.fillStyle = 'rgba(255,250,240,0.35)'; g.fillRect(0, Y(gfH) - 2, W, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, Y(gfH) + 2, W, 2); // belt course over the shopfronts
    const glass = (x, y, w, h, lit, warm = true) => { // glazing with sky reflection; lit at night (emissive)
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#46525c'); gr.addColorStop(0.5, '#262d34'); gr.addColorStop(1, '#1b2026'); g.fillStyle = gr; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(x + 1, y + 1, w * 0.35, h * 0.5);
        if (r() < lit) { ge.fillStyle = warm ? `rgb(255,${195 + r() * 40},${125 + r() * 40})` : 'rgb(200,220,255)'; ge.fillRect(x / 2, y / 2, Math.max(1, w / 2), Math.max(1, h / 2)); }
    };
    const archTop = (x, y, w) => { g.beginPath(); g.moveTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + w / 2); g.closePath(); g.fill(); };
    const archWin = (x, y, w, h) => { // round-headed opening (y = top of the arch)
        g.fillStyle = F.frame || TRIM; g.beginPath(); g.moveTo(x - 2, y + h); g.lineTo(x - 2, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 2, Math.PI, 0); g.lineTo(x + w + 2, y + h); g.closePath(); g.fill();
        g.save(); g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.clip(); glass(x, y, w, h, 0.35); g.restore();
        g.fillStyle = 'rgba(0,0,0,0.0)';
    };
    const window = (x, y, w, h, arched) => {
        if (arched) archWin(x, y, w, h);
        else { g.fillStyle = F.frame || TRIM; g.fillRect(x - 2, y - 2, w + 4, h + 4); glass(x, y, w, h, 0.35); }
        g.fillStyle = F.frame || TRIM; g.fillRect(x + w / 2 - 1, y + (arched ? w / 2 : 0), 2, h - (arched ? w / 2 : 0)); g.fillRect(x, y + h * 0.42, w, 2); // mullion + transom
        g.fillStyle = 'rgba(235,228,212,0.75)'; g.fillRect(x - 4, y + h + 1, w + 8, 3); // sill
        if (!arched && F.mat !== 'modern') { g.fillStyle = F.mat === 'brick' ? 'rgba(225,215,195,0.55)' : 'rgba(0,0,0,0.18)'; g.fillRect(x - 4, y - 6, w + 8, 4); } // lintel
    };
    for (let b = 0; b < 4; b++) {
        const x0 = b * B;
        // ground floor: shopfront in each bay between piers (round-arched where the panorama shows arches)
        { const ox = x0 + B * 0.12, ow = B * 0.76, top = Y(gfH - 0.55), bot = Y(0.12), h = bot - top;
            g.fillStyle = F.shop || '#2b2b2b';
            if (arch.has('gf')) { g.fillStyle = 'rgba(0,0,0,0.3)'; archTop(ox - 3, top - 3, ow + 6); g.fillRect(ox - 3, top + ow / 2, ow + 6, h - ow / 2); g.save(); g.beginPath(); g.moveTo(ox, bot); g.lineTo(ox, top + ow / 2); g.arc(ox + ow / 2, top + ow / 2, ow / 2, Math.PI, 0); g.lineTo(ox + ow, bot); g.closePath(); g.clip(); glass(ox, top, ow, h, 0.85); g.restore(); g.fillStyle = F.shop || '#2b2b2b'; g.fillRect(ox, top + ow / 2, ow, 3); }
            else { g.fillRect(ox - 3, top - 8, ow + 6, h + 8); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(ox - 3, top - 8, ow + 6, 1.5); glass(ox, top + 6, ow, h - 6 - 0.55 * k, 0.85); g.fillStyle = F.shop || '#2b2b2b'; g.fillRect(ox, top + 6 + (h - 6) * 0.22, ow, 2.5); g.fillRect(ox + ow / 2 - 1.5, top + 6, 3, h - 6); g.fillRect(ox, bot - 0.55 * k, ow, 0.55 * k); }
        }
        // upper floors
        if (arch.has('big') && n >= 3) { // one round arch per bay over floors 1–2, a pair of windows in each storey, spandrel panel between
            const ox = x0 + B * 0.14, ow = B * 0.72, top = Y(gfH + 2 * fl - 0.45), bot = Y(gfH + 0.7);
            g.fillStyle = 'rgba(0,0,0,0.22)'; archTop(ox - 4, top - 4, ow + 8); g.fillRect(ox - 4, top + ow / 2, ow + 8, bot - top - ow / 2 + 4);
            g.save(); g.beginPath(); g.moveTo(ox, bot); g.lineTo(ox, top + ow / 2); g.arc(ox + ow / 2, top + ow / 2, ow / 2, Math.PI, 0); g.lineTo(ox + ow, bot); g.closePath(); g.clip(); glass(ox, top, ow, bot - top, 0.35); g.restore();
            g.fillStyle = F.frame || TRIM; g.fillRect(ox + ow / 2 - 1.5, top + ow / 2, 3, bot - top - ow / 2); g.fillStyle = wall; g.fillRect(ox, Y(gfH + fl + 0.35), ow, 0.7 * k); // spandrel
        }
        for (let i = 1; i < n; i++) {
            if (arch.has('big') && n >= 3 && i <= 2) continue;
            const yb = gfH + (i - 1) * fl, top = Y(yb + fl - 0.55), bot = Y(yb + 0.85), h = bot - top, arched = arch.has('all') || (arch.has('top') && i === n - 1) || (arch.has('f1') && i === 1);
            if (F.mat === 'modern') { const ox = x0 + B * 0.08, ow = B * 0.84; g.fillStyle = F.frame || '#444'; g.fillRect(ox - 2, top - 2, ow + 4, h + 4); glass(ox, top, ow, h, 0.4, r() < 0.4); g.fillStyle = F.frame || '#444'; g.fillRect(ox + ow / 2 - 1, top, 2, h); continue; }
            if (F.mat === 'paint') { const ox = x0 + B * 0.1, ow = B * 0.8; g.fillStyle = F.frame || '#555'; g.fillRect(ox - 3, top - 3, ow + 6, h + 6); glass(ox, top, ow, h, 0.4); g.fillStyle = F.frame || '#555'; for (const q of [1 / 3, 2 / 3]) g.fillRect(ox + ow * q - 1.5, top, 3, h); g.fillRect(ox, top + h * 0.3, ow, 2.5); continue; }
            if (F.pair) { const w = B * 0.27; window(x0 + B * 0.16, top, w, h, arched); window(x0 + B * 0.57, top, w, h, arched); }
            else { const w = B * 0.42; window(x0 + (B - w) / 2, top, w, h, arched); }
        }
        g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0, Y(H - corH), 2, (H - corH - gfH) * k); // pier shadow line
    }
    // cornice band (the moulding itself is geometry, see below)
    if (F.cornice) { g.fillStyle = F.cornice; g.fillRect(0, 0, W, corH * k); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, corH * k - 3, W, 3); for (let x = 0; x < W; x += 6) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, corH * k - 9, 3, 5); } }
    else { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, W, 3); }
    const map = canvasTexture(c, { repeat: true }), em = canvasTexture(e, { repeat: true });
    for (const t of [map, em]) { t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; }
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true, roughness: F.mat === 'modern' ? 0.6 : 0.86, metalness: 0, side: THREE.DoubleSide });
    m.name = 'ps-front-' + id; m.userData.nightWindows = true; m.userData.front = { id, storeys: n, height: +H.toFixed(2) };
    return m;
}

/**
 * Build the fronts: native source volumes (osm.js buildBuildings, one call per front so each gets its own facade canvas),
 * walls re-mapped so v runs 0 → 1 from the street to the top, roofs merged into one mesh, cornice mouldings on street faces.
 * The scene's own osmBackdrop must leave these ids out (`filter`).
 */
export function buildFronts(ctx) {
    const d = ctx.data, g = ctx.ground, out = { fronts: [], tris: 0 }, grp = new THREE.Group(); grp.name = 'pioneer-fronts';
    const cornices = new GeoBatch(), roofs = [];
    const others = d.buildings.filter((q) => q.k !== 'roof' && q.poly?.length > 2 && !q.part);
    for (const b of d.buildings) {
        const F = FRONTS[b.id]; if (!F || ctx.skipBuildings.has(b.id) || b.part) continue;
        const wall = F.osmColour && b.c ? b.c : F.wall;
        const clone = { ...d, buildings: d.buildings.map((q) => (q === b ? { ...q, c: '#ffffff' } : q)) };
        const B = buildBuildings(clone, g, { skip: ctx.skipBuildings, urban: false, style: () => 'brick', filter: (q) => q.id === b.id });
        const fac = B.group.children.find((m) => /:f-brick$/.test(m.name)); if (!fac) { B.group.traverse((o) => o.geometry?.dispose()); continue; }
        const P = fac.geometry.attributes.position; let y1 = -1e9; for (let i = 0; i < P.count; i++) y1 = Math.max(y1, P.getY(i));
        const y0 = Math.min(...b.poly.map(([x, z]) => g.heightAt(x, z))), H = Math.max(3, y1 - y0), n = b.lv ? Math.max(1, Math.round(b.lv)) : Math.max(1, Math.round((H - 1) / 3.7));
        const UV = fac.geometry.attributes.uv; for (let i = 0; i < P.count; i++) UV.setY(i, (P.getY(i) - y0) / H); UV.needsUpdate = true;
        fac.material = frontTexture(b.id, F, H, n, wall); fac.name = 'pioneer-front:' + b.id;
        grp.add(fac);
        for (const m of B.group.children) if (m !== fac) { if (/:roofs$/.test(m.name)) roofs.push(m); else grp.add(m); }
        ctx.colliders.push(...B.colliders);
        // cornice moulding along the street faces (no neighbour against the wall)
        if (F.cornice) for (let i = 0; i < b.poly.length; i++) {
            const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3) continue;
            const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L; let nx = dz, nz = -dx; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
            if (inPoly(mx + nx * 0.5, mz + nz * 0.5, b.poly)) { nx = -nx; nz = -nz; }
            if (others.some((q) => q.id !== b.id && inPoly(mx + nx * 1.2, mz + nz * 1.2, q.poly))) continue;
            cornices.box(mx + nx * 0.3, y1 - 0.72, mz + nz * 0.3, L + 0.5, 0.75, 0.55, F.cornice, 'stone', Math.atan2(dx, dz) + Math.PI / 2); // (clear of the roof plane: no coplanar strip)
        }
        out.fronts.push({ id: b.id, name: F.name, storeys: n, height: +H.toFixed(1), wall, src: F.src });
    }
    // roofs: one mesh (same shared roof material, vertex-coloured)
    if (roofs.length) {
        const pos = [], nor = [], col = [], idx = []; let base = 0;
        for (const m of roofs) { const G = m.geometry, p = G.attributes.position, nn = G.attributes.normal, cc = G.attributes.color; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); col.push(cc.getX(i), cc.getY(i), cc.getZ(i)); } for (const v of G.index.array) idx.push(base + v); base += p.count; G.dispose(); }
        const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); G.setIndex(idx); G.computeBoundingSphere();
        const rm = new THREE.Mesh(G, roofs[0].material); rm.name = 'pioneer-fronts:roofs'; rm.castShadow = true; rm.receiveShadow = true; grp.add(rm);
    }
    const cm = cornices.build('pioneer-cornices'); grp.add(cm);
    ctx.add(grp);
    grp.traverse((o) => { if (o.isMesh) out.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    out.tris = Math.round(out.tris);
    return out;
}
