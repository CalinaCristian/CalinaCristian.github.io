// ============================================================================
//  Shared hero props for spot scenes: neon / painted signs, storefront fascias,
//  arcade canopies, market stalls with produce, the Seattle Great Wheel, the
//  Space Needle, distant skylines + mountains (fog-free impostors), totem
//  poles, railings. Scenes compose these; nothing here is spot-specific data.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, M, rng, canvas, canvasTexture, fitDraw, alongPolyline, polylineLength, offsetPolyline, clamp, inPoly, distPolyline } from './kit.js';

// ---------------------------------------------------------------------------- signs
/**
 * channel-letter / neon sign: rows of text drawn on a transparent canvas; letters lit at night (emissive).
 * rows: [{ text, size? (relative), color? }], w × h metres. Returns a Mesh (double-sided planes, letters only).
 */
export function neonSign(rows, w, h, { color = '#e8262a', glow = '#ff3b2f', font = (s) => `800 ${s}px "Arial Black", Impact, Helvetica, sans-serif`, outline = '#5a0c0a', day = 0.25, night = 3.2, back = '#d8d2c4', ppm = 90, align = 'center', stroke = 0 } = {}) {
    const cw = Math.min(2048, Math.round(w * ppm)), ch = Math.min(1024, Math.round(h * ppm)), c = canvas(cw, ch), x = c.getContext('2d');
    const e = canvas(cw, ch), xe = e.getContext('2d');
    const total = rows.reduce((s, r) => s + (r.size || 1), 0);
    let y = 0;
    for (const r of rows) {
        const rh = ch * (r.size || 1) / total;
        for (const [ctx, col] of [[x, r.color || color], [xe, r.glow || glow]]) {
            ctx.save();
            ctx.shadowColor = ctx === x ? outline : 'rgba(0,0,0,0)'; ctx.shadowBlur = ctx === x ? 2 : 0;
            if (stroke && ctx === x) { ctx.lineWidth = stroke; ctx.strokeStyle = outline; }
            fitDraw(ctx, r.text, r.x0 ? r.x0 * cw : cw * 0.02, y + rh * 0.06, r.w ? r.w * cw : cw * 0.96, rh * 0.88, { font: r.font || font, color: col, max: rh, align: r.align || align });
            ctx.restore();
        }
        y += rh;
    }
    const tex = canvasTexture(c), etex = canvasTexture(e);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: etex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: day, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.5 });
    m.userData.dayGlow = day; m.userData.nightGlow = night;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.name = 'neon:' + rows.map((r) => r.text).join(' ');
    void back;
    return mesh;
}
/** a flat painted sign board (box with a text face), optional lit border bulbs */
export function signBoard(text, w, h, { bg = '#0f5e57', fg = '#f4f1e6', font = (s) => `700 ${s}px Georgia, serif`, depth = 0.12, frame = '#1d1f20', glow = 0, night = 0, bulbs = false, ppm = 100, maxLines = 1, draw = null } = {}) {
    const cw = Math.min(2048, Math.round(w * ppm)), ch = Math.min(1024, Math.round(h * ppm)), c = canvas(cw, ch), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
    if (bulbs) { x.fillStyle = '#fff6d8'; const n = Math.round(w * 3); for (let i = 0; i < n; i++) { const px = (i + 0.5) / n * cw; x.beginPath(); x.arc(px, ch * 0.06, ch * 0.025, 0, 7); x.arc(px, ch * 0.94, ch * 0.025, 0, 7); x.fill(); } }
    fitDraw(x, text, cw * 0.04, ch * 0.12, cw * 0.92, ch * 0.76, { font, color: fg, maxLines });
    draw?.(x, cw, ch);
    const t = canvasTexture(c);
    const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: glow });
    face.userData.dayGlow = glow; face.userData.nightGlow = night || glow;
    const side = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.6, metalness: 0.3 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [side, side, side, side, face, side]);
    m.name = 'sign:' + text; m.castShadow = true;
    return m;
}
/** steel lattice frame (verticals + X bracing) for rooftop signs; returns GeoBatch parts added to b */
export function latticeFrame(b, x, y, z, w, h, yaw, { cols = 4, color = '#1c1d1f', r = 0.07 } = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (u, v) => [x + c * u, y + v, z - s * u];
    for (let i = 0; i <= cols; i++) { const u = -w / 2 + w * i / cols; b.rod(P(u, 0), P(u, h), r, color, 'metal', 6); }
    for (let k = 0; k <= 3; k++) { const v = h * k / 3; b.rod(P(-w / 2, v), P(w / 2, v), r * 0.8, color, 'metal', 5); }
    for (let i = 0; i < cols; i++) for (let k = 0; k < 3; k++) { const u0 = -w / 2 + w * i / cols, u1 = u0 + w / cols, v0 = h * k / 3, v1 = v0 + h / 3; b.rod(P(u0, v0), P(u1, v1), r * 0.6, color, 'metal', 4); b.rod(P(u1, v0), P(u0, v1), r * 0.6, color, 'metal', 4); }
}
/** round clock face texture (white face, red numerals + hands at the given local time) */
export function clockFace(d, { face = '#f4f1e8', ink = '#c3161c', date = new Date(), timeZone = 'America/Los_Angeles', ring = '#e8262a' } = {}) {
    const c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = face; x.beginPath(); x.arc(256, 256, 250, 0, 7); x.fill();
    x.strokeStyle = ring; x.lineWidth = 14; x.beginPath(); x.arc(256, 256, 238, 0, 7); x.stroke();
    x.fillStyle = ink; x.font = '700 58px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; x.fillText(String(i), 256 + Math.sin(a) * 185, 256 - Math.cos(a) * 185); }
    let h = 4, m = 38; try { const p = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date); h = +p.find((q) => q.type === 'hour').value % 12; m = +p.find((q) => q.type === 'minute').value; } catch { /* default 4:38 */ }
    const hand = (a, L, W) => { x.save(); x.translate(256, 256); x.rotate(a); x.fillStyle = ink; x.beginPath(); x.moveTo(-W, 20); x.lineTo(0, -L); x.lineTo(W, 20); x.closePath(); x.fill(); x.restore(); };
    hand((h + m / 60) / 12 * Math.PI * 2, 120, 12); hand(m / 60 * Math.PI * 2, 175, 8);
    x.beginPath(); x.arc(256, 256, 14, 0, 7); x.fill();
    const t = canvasTexture(c);
    const mat = new THREE.MeshStandardMaterial({ map: t, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.15, roughness: 0.4 });
    mat.userData.dayGlow = 0.15; mat.userData.nightGlow = 1.6;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(d / 2, 48), mat); mesh.name = 'clock';
    return mesh;
}

// ---------------------------------------------------------------------------- arcades, stalls, produce
/** canopy along a polyline (roof w wide at height y(x,z)+h), columns every `every` m, optional hanging lamps */
export function canopy(b, pts, w, yFn, { h = 3.6, every = 5.5, roof = '#2f4f3a', col = '#2f4f3a', side = 1, lamps = null, depth = 0.25 } = {}) {
    const L = polylineLength(pts);
    for (let s = 0; s < L; s += 1.5) {
        const p = alongPolyline(pts, s), q = alongPolyline(pts, Math.min(L, s + 1.5)), y = yFn(p.x, p.z) + h, yq = yFn(q.x, q.z) + h;
        const nx = -p.tz * side, nz = p.tx * side;
        b.quad([p.x, y, p.z], [q.x, yq, q.z], [q.x + nx * w, yq + 0.35, q.z + nz * w], [p.x + nx * w, y + 0.35, p.z + nz * w], roof, 'paint');
        b.quad([p.x + nx * w, y + 0.35 + depth, p.z + nz * w], [q.x + nx * w, yq + 0.35 + depth, q.z + nz * w], [q.x, yq + depth, q.z], [p.x, y + depth, p.z], roof, 'paint');
        b.quad([p.x, y - 0.4, p.z], [q.x, yq - 0.4, q.z], [q.x, yq + depth, q.z], [p.x, y + depth, p.z], roof, 'paint'); // fascia
    }
    for (let s = 0; s <= L; s += every) {
        const p = alongPolyline(pts, s), y = yFn(p.x, p.z);
        b.cyl(p.x, y, p.z, 0.11, h, col, 'paint', 10);
        b.cyl(p.x, y + h - 0.35, p.z, 0.2, 0.3, col, 'paint', 10, 1.6);
        if (lamps) lamps.push({ x: p.x - p.tz * side * w * 0.5, z: p.z + p.tx * side * w * 0.5, y: y + h - 0.6 });
    }
}
const PRODUCE = [['#d42b2b', '#b81f1f'], ['#f2c12e', '#e0a919'], ['#f28a1d', '#de7612'], ['#5aa832', '#3f8a26'], ['#7b2d8e', '#5d1f6e'], ['#e85f8a', '#c94473'], ['#f7f2e0', '#e6dcc0'], ['#8bc34a', '#6fa83a'], ['#c0392b', '#962d22']];
/** a market stall counter (tilted produce crates / flowers / fish on ice), facing yaw (+z local = customer side) */
export function stall(b, x, y, z, yaw, { w = 3.2, kind = 'produce', seed = 1 } = {}) {
    const r = rng(seed), c = Math.cos(yaw), s = Math.sin(yaw), P = (u, v) => [x + c * u + s * v, z - s * u + c * v];
    // counter body
    { const [px, pz] = P(0, 0); b.box(px, y, pz, w, 0.82, 1.1, kind === 'fish' ? '#7a7d80' : '#6b4a2f', kind === 'fish' ? 'steel' : 'wood', yaw); }
    if (kind === 'fish') {
        const [px, pz] = P(0, 0.05); b.boxC(px, y + 0.9, pz, w - 0.1, 0.12, 1.0, '#f2f5f7', 'plastic', yaw, -0.22); // ice
        for (let i = 0; i < Math.round(w * 4); i++) {
            const u = -w / 2 + 0.25 + r() * (w - 0.5), v = -0.35 + r() * 0.7, [fx, fz] = P(u, v), crab = r() < 0.35;
            if (crab) b.sphere(fx, y + 1.0 + v * -0.2, fz, 0.13, 0.05, 0.11, '#d0552c', 'plastic', 8, 5);
            else b.sphere(fx, y + 1.0 + v * -0.2, fz, 0.07, 0.05, 0.32, r() < 0.5 ? '#e0805a' : '#aab3ba', 'plastic', 8, 5);
        }
        for (let i = 0; i < 6; i++) { const [fx, fz] = P(-w / 2 + 0.3 + i * (w - 0.6) / 5, 0.52); b.box(fx, y + 0.95, fz, 0.18, 0.16, 0.02, '#ffffff', 'plastic', yaw); } // price cards
        return;
    }
    const crates = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < crates; i++) for (let row = 0; row < 2; row++) {
        const u = -w / 2 + (i + 0.5) * w / crates, v = -0.3 + row * 0.45, [cx, cz] = P(u, v), yy = y + 0.85 + (1 - row) * 0.12;
        b.boxC(cx, yy, cz, w / crates - 0.04, 0.12, 0.42, '#8a6a45', 'wood', yaw, -0.3);
        const pal = kind === 'flowers' ? [['#e94a7a', '#c22d5c'], ['#f6d32d', '#e8b90f'], ['#ffffff', '#f2f2f2'], ['#9b59d0', '#7d3cb5'], ['#ff7f2a', '#e66711']][(i + row) % 5] : PRODUCE[(i * 2 + row + seed) % PRODUCE.length];
        const n = kind === 'flowers' ? 7 : 9;
        for (let k = 0; k < n; k++) {
            const du = (r() - 0.5) * (w / crates - 0.12), dv = (r() - 0.5) * 0.3, [qx, qz] = P(u + du, v + dv), rr = kind === 'flowers' ? 0.07 : 0.055 + r() * 0.02;
            b.sphere(qx, yy + 0.09 + (kind === 'flowers' ? 0.25 + r() * 0.15 : 0) - dv * 0.3, qz, rr, rr, rr, pal[k % 2], 'plant', 6, 4);
            if (kind === 'flowers' && k % 2 === 0) b.cyl(qx, yy, qz, 0.008, 0.3, '#3f6b2a', 'plant', 4);
        }
    }
    // price signs on sticks
    for (let i = 0; i < 3; i++) { const [px, pz] = P(-w / 2 + (i + 0.5) * w / 3, 0.62); b.box(px, y + 1.05, pz, 0.2, 0.13, 0.015, '#fffdf2', 'paint', yaw); }
}
/** a salmon (for flying fish) */
export function fishMesh() {
    const g = new THREE.Group(); g.name = 'fish';
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.7, roughness: 0.3 }));
    body.scale.set(0.16, 0.22, 0.9); g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6), new THREE.MeshStandardMaterial({ color: '#e07a52', roughness: 0.5 })); belly.scale.set(0.12, 0.12, 0.7); belly.position.y = -0.04; g.add(belly);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.25, 4), body.material); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.52; tail.scale.x = 0.3; g.add(tail);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
}

// ---------------------------------------------------------------------------- Seattle Great Wheel (2012): 53.3 m, 42 gondolas
export function greatWheel(x, y, z, yaw, { spin = true } = {}) {
    const grp = new THREE.Group(); grp.name = 'great-wheel'; grp.position.set(x, y, z); grp.rotation.y = yaw;
    const H = 53.3, R = 24.5, hub = H - R - 1.5, white = '#f2f4f5';
    const b = new GeoBatch();
    // A-frame legs (both sides of the wheel plane, z = ±4)
    for (const sz of [-4.2, 4.2]) for (const sx of [-14, 14]) b.rod([sx, 0, sz * 2.2], [0, hub, sz], 0.65, white, 'paint', 10, 0.45);
    b.rod([0, hub, -4.6], [0, hub, 4.6], 1.1, '#d9dde0', 'steel', 14);
    // base deck
    b.box(0, -0.2, 0, 34, 1.2, 22, '#8f8a80', 'concrete');
    const fixed = b.build('wheel-frame');
    const rot = new THREE.Group(); rot.name = 'wheel-rotor'; rot.position.y = hub;
    const w = new GeoBatch();
    for (const sz of [-1.6, 1.6]) {
        const ring = new THREE.TorusGeometry(R, 0.45, 8, 96); w.add(ring, 'paint', M(0, 0, sz), white); ring.dispose();
        const ring2 = new THREE.TorusGeometry(R - 2.2, 0.28, 6, 96); w.add(ring2, 'paint', M(0, 0, sz), white); ring2.dispose();
    }
    for (let i = 0; i < 42; i++) {
        const a = i / 42 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        for (const sz of [-1.6, 1.6]) w.rod([0, 0, sz * 1.8], [c * (R - 2.2), s * (R - 2.2), sz], 0.06, '#e8eaec', 'steel', 4);
        for (const sz of [-1.6, 1.6]) w.rod([c * (R - 2.2), s * (R - 2.2), sz], [c * R, s * R, sz], 0.12, white, 'paint', 4);
        w.rod([c * R, s * R, -1.6], [c * R, s * R, 1.6], 0.1, white, 'paint', 4);
    }
    const rotor = w.build('wheel-rotor-geo'); rot.add(rotor);
    // gondolas (stay upright): one instanced mesh
    const gG = new THREE.CylinderGeometry(1.25, 1.25, 2.4, 12); gG.rotateX(Math.PI / 2); gG.scale(1, 1.1, 1);
    const gondolas = new THREE.InstancedMesh(gG, new THREE.MeshStandardMaterial({ color: '#cfd8de', metalness: 0.5, roughness: 0.15, emissive: '#000000' }), 42);
    gondolas.castShadow = true; gondolas.frustumCulled = false;
    grp.add(fixed, rot, gondolas);
    // LED rim lights (night): an additive ring
    const led = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.12, 6, 128), new THREE.MeshBasicMaterial({ color: '#7fb8ff', toneMapped: false }));
    led.position.y = hub; led.visible = false; grp.add(led);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let ang = 0;
    const update = (dt, night = 0) => {
        if (spin) ang += dt * (Math.PI * 2 / 240); // 3 revolutions in 12 min
        rot.rotation.z = ang;
        for (let i = 0; i < 42; i++) { const a = ang + i / 42 * Math.PI * 2; v.set(Math.cos(a) * (R + 1.3), hub + Math.sin(a) * (R + 1.3) - 1.4, 0); m4.compose(v, q, one); gondolas.setMatrixAt(i, m4); }
        gondolas.instanceMatrix.needsUpdate = true;
        led.visible = night > 0.3; led.material.color.setHSL((performance.now() / 8000) % 1, 0.7, 0.6);
        gondolas.material.emissive.set(night > 0.3 ? '#3a4a5a' : '#000000');
    };
    update(0);
    return { group: grp, update, hub, radius: R, rotor: rot };
}

// ---------------------------------------------------------------------------- Space Needle (1962): 184 m (see seattle-center for the plaza)
/**
 * Six legs in three pairs (pinched waist at ~110 m), SkyLine ring 30.5–36.6 m, saucer house 152.4–170 m (Ø 42 m), glass bands,
 * Loupe floor, white roof + pyramid spire to 184 m, exterior glass elevators. Built at full detail (≈ 40 k tris).
 */
export function spaceNeedle(x, y, z, { detail = 1, roof = '#f1f1ec' } = {}) {
    const b = new GeoBatch(), white = '#eef0ee', steel = '#d9dcdc', grey = '#9aa0a3';
    const N = detail > 0.5 ? 24 : 12;
    // legs: 3 pairs; each leg a curved tube from the base (r≈18 m) in to the waist (r≈4.5 m at 113 m) out to the saucer underside (r≈13 m at 150 m)
    const legPt = (t, ang) => {
        const yy = t * 152, rr = yy < 113 ? 4.6 + 13.8 * Math.pow(1 - yy / 113, 1.6) : 4.6 + (yy - 113) / 39 * 9.5;
        return [Math.cos(ang) * rr, yy, Math.sin(ang) * rr];
    };
    for (let k = 0; k < 3; k++) for (const off of [-0.17, 0.17]) {
        const ang = k * Math.PI * 2 / 3 + off + Math.PI / 6; const pts = [];
        for (let i = 0; i <= 16; i++) pts.push(legPt(i / 16, ang + (i / 16 > 0.74 ? (i / 16 - 0.74) * off * -1.5 : 0)));
        b.tube(pts, 0.85, white, 'paint', 8);
        for (let i = 2; i < 15; i += 3) { const a = legPt(i / 16, ang), c = legPt(i / 16, ang + (off > 0 ? -0.34 : 0.34)); b.rod(a, c, 0.35, white, 'paint', 6); } // cross ties
    }
    // core (elevator shaft) + exterior glass elevators
    b.cyl(0, 0, 0, 1.7, 152, '#e2e4e2', 'paint', 12);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 - Math.PI / 6; for (const s of [-0.5, 0.5]) b.box(Math.cos(a) * 2.6 - Math.sin(a) * s, 0, Math.sin(a) * 2.6 + Math.cos(a) * s, 0.18, 152, 0.18, '#f0f1ef', 'paint', -a); b.box(Math.cos(a) * 2.8, 30 + k * 41, Math.sin(a) * 2.8, 1.5, 2.6, 1.4, '#e9c76a', 'metal', -a); } // elevator rails + gold cabins
    b.add(new THREE.CylinderGeometry(2.2, 3.4, 9, N, 1, true), 'paint', M(0, 155, 0), steel); // spiral stair housing top
    // SkyLine ring (100 ft) + mid ring
    b.add(new THREE.CylinderGeometry(9.5, 9.5, 6.1, N * 2, 1), 'paint', M(0, 30.5 + 3.05, 0), white);
    b.add(new THREE.CylinderGeometry(8.8, 8.8, 6.0, N * 2, 1), 'glass', M(0, 33.5, 0), '#4f6573');
    b.add(new THREE.CylinderGeometry(5.2, 5.2, 3, N, 1), 'paint', M(0, 62.5, 0), white);
    // saucer house: underside cone, glass bands, Loupe, roof halo + spire
    b.add(new THREE.CylinderGeometry(20.5, 9, 6, N * 2, 1), 'paint', M(0, 149.4, 0), white);
    b.add(new THREE.CylinderGeometry(21, 20.5, 3.7, N * 2, 1), 'glass', M(0, 154.3, 0), '#40525d');
    b.add(new THREE.CylinderGeometry(21.05, 21.05, 0.6, N * 2, 1), 'paint', M(0, 156.4, 0), white);
    b.add(new THREE.CylinderGeometry(21.05, 21.05, 1.4, N * 2, 1), 'paint', M(0, 157.4, 0), grey);
    b.add(new THREE.CylinderGeometry(21.6, 21.0, 3.2, N * 2, 1), 'glass', M(0, 159.7, 0), '#3d4f5a'); // observation deck glass (open-air barrier)
    b.add(new THREE.CylinderGeometry(21.6, 21.6, 0.5, N * 2, 1), 'paint', M(0, 161.5, 0), white);
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; b.rod([Math.cos(a) * 21.6, 158, Math.sin(a) * 21.6], [Math.cos(a) * 21.6, 161.4, Math.sin(a) * 21.6], 0.06, steel, 'steel', 4); }
    b.add(new THREE.CylinderGeometry(17.5, 21.2, 5.5, N * 2, 1), 'roofs', M(0, 164.6, 0), roof);
    b.add(new THREE.CylinderGeometry(8.5, 17.5, 2.6, N * 2, 1), 'roofs', M(0, 168.6, 0), roof);
    b.add(new THREE.CylinderGeometry(3.4, 8.5, 1.7, N, 1), 'roofs', M(0, 170.7, 0), roof);
    b.add(new THREE.ConeGeometry(3.1, 9.5, 6), 'paint', M(0, 176.3, 0), white);
    b.rod([0, 181, 0], [0, 184.4, 0], 0.18, steel, 'steel', 6);
    // halo struts from the waist to the saucer (the "crown" arms)
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.rod([Math.cos(a) * 9, 146.5, Math.sin(a) * 9], [Math.cos(a) * 20.4, 152.2, Math.sin(a) * 20.4], 0.35, white, 'paint', 5); }
    const g = b.build('space-needle'); g.position.set(x, y, z);
    // aircraft warning beacon + top light (night)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3020', toneMapped: false })); beacon.position.y = 184.6; g.add(beacon);
    const haloLight = new THREE.Mesh(new THREE.TorusGeometry(21.7, 0.25, 6, 96), new THREE.MeshBasicMaterial({ color: '#ffe6b0', toneMapped: false })); haloLight.rotation.x = Math.PI / 2; haloLight.position.y = 157.9; haloLight.visible = false; g.add(haloLight);
    g.userData.night = (k) => { haloLight.visible = k > 0.3; beacon.visible = k > 0.1 || true; };
    return g;
}

// ---------------------------------------------------------------------------- distant skyline + mountains (fog-free impostors)
/**
 * towers: [{x, z, w, d, h, c, crown?:'pyramid'|'stepped'|'spire'|'flat'}]; drawn with fog off and a haze tint so the
 * downtown skyline reads from Kerry Park / Gas Works / Meydenbauer at 1–9 km.
 */
export function skyline(towers, { haze = '#9fb2c4', hazeK = 0.25, windows = true, y0 = 0 } = {}) {
    const grp = new THREE.Group(); grp.name = 'skyline';
    const mats = new Map();
    const matFor = (c) => { if (!mats.has(c)) { const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(haze), hazeK), fog: false }); m.userData.nightWindows = false; mats.set(c, m); } return mats.get(c); };
    const winTex = windows ? (() => { const c = canvas(64, 128), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128); const r = rng(5); for (let j = 0; j < 32; j++) for (let i = 0; i < 8; i++) if (r() < 0.45) { x.fillStyle = r() < 0.7 ? '#ffd9a0' : '#cfe3ff'; x.fillRect(i * 8 + 1, j * 4 + 1, 6, 2); } const t = canvasTexture(c, { repeat: true }); return t; })() : null;
    const nightMats = [];
    for (const t of towers) {
        const m = matFor(t.c || '#6f7d8a').clone();
        if (winTex) { m.emissiveMap = winTex.clone(); m.emissiveMap.needsUpdate = true; m.emissiveMap.repeat.set(Math.max(1, t.w / 6), Math.max(1, t.h / 12)); m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0; nightMats.push(m); }
        const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), m); body.position.set(t.x, (t.y ?? y0) + t.h / 2, t.z); body.rotation.y = t.yaw || 0; grp.add(body);
        if (t.crown === 'pyramid') { const p = new THREE.Mesh(new THREE.ConeGeometry(Math.max(t.w, t.d) * 0.62, t.w * 0.9, 4), matFor(t.cc || t.c)); p.rotation.y = Math.PI / 4 + (t.yaw || 0); p.position.set(t.x, (t.y ?? y0) + t.h + t.w * 0.45, t.z); grp.add(p); }
        else if (t.crown === 'stepped') { for (let k = 1; k <= 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(t.w * (1 - k * 0.2), t.h * 0.04, t.d * (1 - k * 0.2)), m); s.position.set(t.x, (t.y ?? y0) + t.h + t.h * 0.04 * (k - 0.5), t.z); s.rotation.y = t.yaw || 0; grp.add(s); } }
        else if (t.crown === 'spire') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, t.h * 0.12, 6), matFor('#cfd3d6')); p.position.set(t.x, (t.y ?? y0) + t.h * 1.06, t.z); grp.add(p); }
    }
    grp.userData.night = (k) => { for (const m of nightMats) m.emissiveIntensity = 0.85 * k; };
    return grp;
}
/** a snow-capped stratovolcano / range silhouette far away, scaled to keep its true angular size at distance `dist` */
export function mountain(fromX, fromZ, bearingDeg, realDistM, realHeightAboveEyeM, realWidthM, { dist = 5200, color = '#8a9bb0', snow = '#f3f5f8', haze = '#b6c4d3', eyeY = 0, seed = 3 } = {}) {
    const k = dist / realDistM, H = realHeightAboveEyeM * k, W = realWidthM * k;
    const a = bearingDeg * Math.PI / 180, cx = fromX + Math.sin(a) * dist, cz = fromZ - Math.cos(a) * dist;
    const g = new THREE.ConeGeometry(W / 2, H, 48, 6, true), p = g.attributes.position, col = [], r = rng(seed);
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) + H / 2, t = y / H, rr = 1 + (r() - 0.5) * 0.08 * (1 - t);
        p.setX(i, p.getX(i) * rr); p.setZ(i, p.getZ(i) * rr * 0.6);
        const c = new THREE.Color(color).lerp(new THREE.Color(snow), smoothSnow(t + (r() - 0.5) * 0.08)).lerp(new THREE.Color(haze), 0.35);
        col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    m.position.set(cx, eyeY + H / 2 - H * 0.02, cz); m.rotation.y = -a; m.name = 'mountain'; m.renderOrder = -50;
    return m;
}
function smoothSnow(t) { return clamp((t - 0.55) / 0.2, 0, 1); }

// ---------------------------------------------------------------------------- totem pole (stylised, no reproduced carving)
export function totemPole(b, x, y, z, h, yaw = 0, { seed = 1, colors = ['#1d1d1f', '#b0282a', '#2c5a6b', '#e8e2d0'] } = {}) {
    const r = rng(seed), base = '#8a6447';
    b.cyl(x, y, z, 0.42, h, base, 'wood', 14, 0.85);
    const c = Math.cos(yaw), s = Math.sin(yaw), F = (u, v) => [x + s * v + c * u, z + c * v - s * u];
    let yy = y + 0.5;
    while (yy < y + h - 1.2) { // stacked figures: brow band, eyes, beak/snout, wings
        const fh = 1.4 + r() * 0.8, k = 1 - (yy - y) / h * 0.15;
        const [ex, ez] = F(-0.17, 0.36 * k), [fx, fz] = F(0.17, 0.36 * k), [bx, bz] = F(0, 0.42 * k);
        b.box(...[F(0, 0.38 * k)].flatMap(([a, bb]) => [a, yy + fh * 0.72, bb]), 0.62 * k, 0.1, 0.12, colors[0], 'paint', yaw);
        b.sphere(ex, yy + fh * 0.6, ez, 0.11, 0.07, 0.06, colors[3], 'paint', 8, 5); b.sphere(fx, yy + fh * 0.6, fz, 0.11, 0.07, 0.06, colors[3], 'paint', 8, 5);
        b.sphere(ex, yy + fh * 0.6, ez + 0.03, 0.05, 0.05, 0.05, colors[0], 'paint', 6, 4); b.sphere(fx, yy + fh * 0.6, fz + 0.03, 0.05, 0.05, 0.05, colors[0], 'paint', 6, 4);
        if (r() < 0.5) b.add(new THREE.ConeGeometry(0.12, 0.5, 6), 'paint', M(bx, yy + fh * 0.42, bz, Math.PI / 2, yaw, 0), colors[1]);
        else b.box(bx, yy + fh * 0.3, bz, 0.4 * k, 0.16, 0.12, colors[1], 'paint', yaw);
        if (r() < 0.4) for (const sd of [-1, 1]) { const [wx, wz] = F(sd * 0.48 * k, 0.05); b.box(wx, yy + fh * 0.2, wz, 0.18, fh * 0.6, 0.3, colors[2], 'paint', yaw); }
        yy += fh;
    }
    const [tx, tz] = F(0, 0.1); b.add(new THREE.ConeGeometry(0.45, 0.9, 8), 'paint', M(tx, y + h + 0.3, tz), colors[0]);
}
/** simple pipe railing along a polyline at height h above yFn */
export function railing(b, pts, yFn, { h = 1.07, post = 2.2, color = '#2c3135', r = 0.03 } = {}) {
    const L = polylineLength(pts);
    for (let s = 0; s <= L + 0.01; s += post) { const p = alongPolyline(pts, Math.min(s, L)), y = yFn(p.x, p.z); b.rod([p.x, y, p.z], [p.x, y + h, p.z], r * 1.3, color, 'metal', 6); }
    const top = []; for (let s = 0; s <= L; s += 1.5) { const p = alongPolyline(pts, s); top.push([p.x, yFn(p.x, p.z) + h, p.z]); }
    const last = alongPolyline(pts, L); top.push([last.x, yFn(last.x, last.z) + h, last.z]);
    b.tube(top, r * 1.4, color, 'metal', 6);
    const mid = top.map(([x, y, z]) => [x, y - h * 0.55, z]); b.tube(mid, r, color, 'metal', 5);
}
export { offsetPolyline };

// ---------------------------------------------------------------------------- downtown Seattle towers (approximate, for distant skylines)
/** [lat, lon, height m, width, depth, colour, crown] — the tallest / most recognisable silhouettes */
export const SEATTLE_TOWERS = [
    [47.6045, -122.3307, 284, 52, 40, '#2c3540', 'stepped'], // Columbia Center
    [47.6094, -122.3344, 259, 40, 36, '#8fa3b3', 'flat'],    // Rainier Square Tower
    [47.6077, -122.3369, 235, 38, 38, '#d9d2c3', 'pyramid'], // 1201 Third Avenue
    [47.6106, -122.3329, 226, 40, 34, '#2f3b44', 'flat'],    // Two Union Square
    [47.6052, -122.3299, 220, 40, 36, '#4a5866', 'flat'],    // Seattle Municipal Tower
    [47.6100, -122.3347, 203, 34, 34, '#6d7f8f', 'flat'],    // U.S. Bank Center
    [47.6061, -122.3332, 192, 40, 40, '#3c3f43', 'flat'],    // Safeco Plaza
    [47.6056, -122.3335, 175, 34, 34, '#bfb6a7', 'pyramid'], // Wells Fargo Center
    [47.6074, -122.3371, 181, 36, 30, '#5f7487', 'flat'],    // Russell Investments Center
    [47.6031, -122.3316, 172, 32, 32, '#d2cbb9', 'flat'],    // Fourth & Madison
    [47.6083, -122.3315, 180, 32, 32, '#a9b6c1', 'flat'],    // 1000 Second? (Fifth & Columbia area)
    [47.6113, -122.3366, 165, 30, 30, '#7d8c98', 'flat'],    // Westin / Fifth Ave
    [47.6159, -122.3393, 160, 34, 30, '#6f8394', 'flat'],    // Amazon Day 1
    [47.6150, -122.3385, 150, 32, 30, '#5b6f80', 'flat'],    // Amazon Doppler
    [47.6163, -122.3445, 125, 28, 28, '#c8ccd0', 'flat'],    // Insignia
    [47.6085, -122.3384, 135, 30, 30, '#99a6b1', 'flat'],    // Fourth & Pike
    [47.6020, -122.3317, 148, 14, 14, '#ecebe4', 'pyramid'], // Smith Tower
    [47.6127, -122.3310, 140, 30, 30, '#8b97a3', 'flat'],    // Hyatt Regency
    [47.6110, -122.3291, 155, 36, 30, '#7e8e9c', 'flat'],    // Summit / Convention area
    [47.6066, -122.3350, 140, 30, 30, '#c9c0b0', 'flat'],    // Washington Mutual / Seattle Art Museum area
    [47.6016, -122.3288, 155, 30, 30, '#7d8790', 'flat'],    // Municipal / courthouse area
];

/**
 * Shopfront signs from OSM POIs (notes 51 / 52), shared by every scene: one upright fascia board per street shop, flush
 * on the street-facing wall of the building that holds it, at ground-floor fascia height, packed per wall without
 * overlaps (skipped when the wall is full). Shops inside a market hall / on another level (`level`≠0, `indoor`,
 * `addr:floor`, or `isIndoor(p)` true) get no façade sign: their names are returned (`indoorNames`) for stall boards /
 * a directory board.
 * @param {SceneContext} ctx  @param {{ streets?: number[][][], skip?: (p)=>boolean, isIndoor?: (p)=>boolean, maxW?: number, h?: number, y?: number, palette?: string[][] }} o
 * @returns {{ group: THREE.Group, signs: number, indoorNames: string[], skippedFull: number }}
 */
export function shopfrontSigns(ctx, o = {}) {
    const grp = new THREE.Group(); grp.name = 'storefronts';
    const d = ctx.data, g = ctx.ground, seen = new Set(), indoorNames = [], byWall = new Map();
    const streets = o.streets || d.ways.filter((w) => w.pts?.length > 1 && /^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service)$/.test(w.k) && !(w.bridge && w.bridge !== 'no') && !w.tunnel).map((w) => w.pts);
    const streetDist = (x, z) => { let m = 1e9; for (const L of streets) { const r = distPolyline(x, z, L).d; if (r < m) m = r; } return m; };
    const bldgs = d.buildings.filter((bd) => !ctx.skipBuildings?.has(bd.id) && !bd.part);
    const pal = o.palette || [['#1f3d2b', '#f2e9d0'], ['#5a1e1e', '#f6efe0'], ['#14213d', '#fca311'], ['#2b2b2b', '#f5f5f5'], ['#f2e8cf', '#3a2a1a'], ['#0b4f6c', '#f5f5f5']];
    for (const p of d.pois || []) {
        if (!p.name || seen.has(p.name) || !(p.shop || /^(cafe|restaurant|fast_food|bar|pub|ice_cream|pharmacy|bank)$/.test(p.amenity || '') || p.craft)) continue;
        if (o.skip?.(p)) continue;
        const indoor = (p.level && !/^0(;|$)/.test(String(p.level))) || p['addr:floor'] || p.indoor || o.isIndoor?.(p);
        if (indoor) { seen.add(p.name); indoorNames.push(p.name); continue; }
        let host = bldgs.find((bd) => inPoly(p.x, p.z, bd.poly));
        if (!host) { let best = 6; for (const bd of bldgs) for (let i = 0; i < bd.poly.length; i++) { const dd = distPolyline(p.x, p.z, [bd.poly[i], bd.poly[(i + 1) % bd.poly.length]]).d; if (dd < best) { best = dd; host = bd; } } }
        if (!host) continue;
        let wall = null, score = 1e9;
        for (let i = 0; i < host.poly.length; i++) {
            const [ax, az] = host.poly[i], [bx, bz] = host.poly[(i + 1) % host.poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            const sc = streetDist((ax + bx) / 2, (az + bz) / 2) + 0.25 * distPolyline(p.x, p.z, [[ax, az], [bx, bz]]).d;
            if (sc < score) { score = sc; wall = { ax, az, bx, bz, L, key: host.id + ':' + i }; }
        }
        if (!wall || streetDist((wall.ax + wall.bx) / 2, (wall.az + wall.bz) / 2) > 16) continue;
        const ux = (wall.bx - wall.ax) / wall.L, uz = (wall.bz - wall.az) / wall.L; let nx = uz, nz = -ux;
        if (inPoly((wall.ax + wall.bx) / 2 + nx * 0.5, (wall.az + wall.bz) / 2 + nz * 0.5, host.poly)) { nx = -nx; nz = -nz; }
        seen.add(p.name);
        if (!byWall.has(wall.key)) byWall.set(wall.key, { wall, ux, uz, nx, nz, items: [] });
        byWall.get(wall.key).items.push({ p, t: clamp((p.x - wall.ax) * ux + (p.z - wall.az) * uz, 0, wall.L) });
    }
    let n = 0, full = 0;
    for (const W of byWall.values()) {
        W.items.sort((a, b) => a.t - b.t); let end = 0.3;
        for (const it of W.items) {
            const w = Math.min(o.maxW || 4.2, 0.9 + it.p.name.length * 0.17, W.wall.L - 0.6); if (w < 1.4) { full++; continue; }
            const c = Math.max(it.t, end + w / 2); if (c + w / 2 > W.wall.L - 0.3) { full++; continue; } end = c + w / 2 + 0.5;
            const x = W.wall.ax + W.ux * c + W.nx * 0.14, z = W.wall.az + W.uz * c + W.nz * 0.14;
            const y = (o.y ?? g.heightAt(x + W.nx * 1.5, z + W.nz * 1.5)) + 3.05;
            const [bg, fg] = pal[n % pal.length];
            const sb = signBoard(it.p.name, w, o.h || 0.55, { bg, fg, font: (q) => `700 ${q}px Georgia, serif`, glow: 0.05, night: 1.1, depth: 0.06 });
            sb.position.set(x, y, z); sb.rotation.y = Math.atan2(W.nx, W.nz); sb.userData.fascia = true; grp.add(sb); n++;
        }
    }
    ctx.add(grp);
    return { group: grp, signs: n, indoorNames, skippedFull: full };
}
