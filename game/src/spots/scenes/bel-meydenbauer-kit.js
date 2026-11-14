// Meydenbauer Bay Park parts for scenes/bel-meydenbauer.js (split out by spec 22): lake / deck levels, lofted boat hulls,
// the wire-mesh railing material, quad strips and the Lake Washington Blvd arch bridge.
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, lerp, canvas, canvasTexture } from '../kit.js';

const LAKE_Y = -0.55; // Lake Washington ≈ 5.1–5.7 m NAVD88 (regulated); scene datum 5.7 m
const DECK = LAKE_Y + 0.62; // floating pier deck above the water

// ---------------------------------------------------------------------------- boats
const HULLS = new Map();
/** lofted hull (stern at -L/2, bow at +L/2 along +z), deck sheer rising to the bow; y = waterline */
function hullGeo(L, W, fb = 0.75, draft = 0.45) {
    const k = [L, W, fb, draft].join(':'); if (HULLS.has(k)) return HULLS.get(k);
    const N = 12, st = [];
    for (let i = 0; i <= N; i++) {
        const s = i / N, z = -L / 2 + s * L;
        const w = (W / 2) * (s < 0.62 ? 1 - 0.12 * (1 - s / 0.62) ** 2 : Math.sqrt(Math.max(0, (1 - s) / 0.38))) + (i === N ? 0 : 0);
        const top = fb + 0.25 * s * s, bot = -draft * (1 - 0.6 * s * s);
        st.push([[-w, top, z], [-w * 0.92, 0.05, z], [-w * 0.45, bot * 0.75, z], [0, bot, z], [w * 0.45, bot * 0.75, z], [w * 0.92, 0.05, z], [w, top, z]]);
    }
    const pos = [], push = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let i = 0; i < N; i++) for (let j = 0; j < 6; j++) { const a = st[i][j], b = st[i][j + 1], c = st[i + 1][j + 1], d = st[i + 1][j]; push(a, c, b); push(a, d, c); }
    for (let j = 1; j < 6; j++) push(st[0][0], st[0][j], st[0][j + 1]); // transom
    for (let i = 0; i < N; i++) { const a = st[i][0], b = st[i][6], c = st[i + 1][6], d = st[i + 1][0]; push(a, b, c); if (i + 1 < N) push(a, c, d); } // deck (bow: one triangle)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    HULLS.set(k, g); return g;
}
function boat(b, x, y, z, yaw, kind, r) {
    const C = (lx, ly, lz) => [x + Math.sin(yaw) * lz + Math.cos(yaw) * lx, y + ly, z + Math.cos(yaw) * lz - Math.sin(yaw) * lx];
    if (kind === 'sail') {
        const L = 8 + r() * 3.5, W = L * 0.32, col = ['#f4f4f0', '#eef0f2', '#1f3550', '#f1ece0'][Math.floor(r() * 4)];
        const boot = (px, py) => (py < y + 0.24 ? '#2b2f33' : col); // boot stripe as vertex colour (no overlapping shell)
        b.add(hullGeo(L, W, 0.8, 0.5), 'paint', M(x, y, z, 0, yaw), boot);
        const [cx, cy, cz] = C(0, 0.6, -L * 0.08); b.box(cx, cy, cz, W * 0.62, 0.75, L * 0.32, '#e9e7e1', 'paint', yaw);
        const [wx, wy, wz] = C(0, 1.1, -L * 0.02); b.box(wx, wy, wz, W * 0.72, 0.18, L * 0.2, '#2d3438', 'darkglass', yaw);
        const mh = L * 1.35, [mx, my, mz] = C(0, 0.9, L * 0.12); b.cyl(mx, my, mz, 0.06, mh, '#c9ccce', 'chrome', 6);
        const [bx0, by0, bz0] = C(0, 2.0, L * 0.12), [bx1, by1, bz1] = C(0, 2.0, -L * 0.36); b.rod([bx0, by0, bz0], [bx1, by1, bz1], 0.05, '#c9ccce', 'chrome', 5);
        b.rod([bx0, by0 + 0.12, bz0], [bx1, by1 + 0.12, bz1], 0.16, ['#1d4f8a', '#2b6f8f', '#1f3b5e'][Math.floor(r() * 3)], 'fabric', 6); // sail cover
        const [fx, fy, fz] = C(0, 0.85, L * 0.5); b.rod([mx, my + mh, mz], [fx, fy, fz], 0.012, '#9aa0a4', 'steel', 3); // forestay
        const [sx, sy, sz] = C(0, 0.9, -L * 0.5); b.rod([mx, my + mh, mz], [sx, sy, sz], 0.012, '#9aa0a4', 'steel', 3);
        return { light: [mx, my + mh + 0.1, mz], body:{x,z,angle:yaw,hw:W/2,hd:L/2} };
    }
    const L = 7 + r() * 5, W = L * 0.36;
    const hc = r() < 0.8 ? '#f5f5f2' : '#e9e3d6', sc = ['#1f3b5e', '#7a1f22', '#2b2f33'][Math.floor(r() * 3)];
    b.add(hullGeo(L, W, 0.95, 0.5), 'paint', M(x, y, z, 0, yaw), (px, py) => (py < y + 0.28 ? sc : hc));
    const [cx, cy, cz] = C(0, 0.75, -L * 0.05); b.box(cx, cy, cz, W * 0.7, 1.3, L * 0.38, '#f2f2ef', 'paint', yaw);
    const [gx, gy, gz] = C(0, 1.4, -L * 0.05); b.box(gx, gy, gz, W * 0.8, 0.45, L * 0.24, '#22292e', 'darkglass', yaw);
    if (L > 9.5) { const [fx, fy, fz] = C(0, 2.05, -L * 0.1); b.box(fx, fy, fz, W * 0.6, 0.12, L * 0.24, '#ece9e2', 'paint', yaw); b.rod(C(-W * 0.28, 2.17, -L * 0.2), C(-W * 0.28, 2.9, -L * 0.15), 0.025, '#c9ccce', 'chrome', 4); }
    const [ax, ay, az] = C(0, 2.3, -L * 0.15); b.rod([ax, ay - 0.25, az], [ax, ay + 0.5, az], 0.03, '#c9ccce', 'chrome', 4);
    return { light: [ax, ay + 0.55, az], body:{x,z,angle:yaw,hw:W/2,hd:L/2} };
}
/** wire-mesh railing infill texture (galvanised diamond mesh, alpha) */
let MESH_MAT = null;
function meshMaterial() {
    if (MESH_MAT) return MESH_MAT;
    const c = canvas(64, 64), x = c.getContext('2d'); x.clearRect(0, 0, 64, 64); x.strokeStyle = '#ffffff'; x.lineWidth = 3;
    for (let i = -64; i <= 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
    const t = canvasTexture(c, { repeat: true });
    MESH_MAT = new THREE.MeshStandardMaterial({ map: t, color: '#c3c8cb', alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.45 });
    MESH_MAT.name = 'bel-wiremesh'; MESH_MAT.userData.shared = true;
    return MESH_MAT;
}
/** strip of quads (u = metres) between two parallel 3-D polylines (same length) */
function stripGeo(lo, hi, uScale = 1) {
    const pos = [], uv = [], idx = []; let u = 0;
    for (let i = 0; i < lo.length; i++) {
        if (i) u += Math.hypot(lo[i][0] - lo[i - 1][0], lo[i][2] - lo[i - 1][2]);
        pos.push(...lo[i], ...hi[i]); uv.push(u * uScale, 0, u * uScale, (hi[i][1] - lo[i][1]) * uScale);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Lake Washington Blvd arch bridge over the ravine (OSM w753604118): deck, sidewalks, balustrades, lanterns, piers */
function lwbBridge(ctx, g, way) {
    const lwb = way('w753604118');
    if (lwb) {
        ctx.skipWays.add('w753604118');
        const [a0, a1] = [lwb[0], lwb[lwb.length - 1]], Lb = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), yaw = Math.atan2(a1[0] - a0[0], a1[1] - a0[1]), nx = Math.cos(yaw), nz = -Math.sin(yaw);
        const ya = g.heightAt(a0[0], a0[1]) + 0.1, yb = g.heightAt(a1[0], a1[1]) + 0.1, br = new GeoBatch(), cx = a0[0] - nx * 5, cz = a0[1] - nz * 5;
        const yAt = (t) => lerp(ya, yb, t);
        // deck: one sloped slab (it was 24 level boxes: a 13 cm stair every 4 m, and nothing to stand on — walkers on the
        // boulevard dropped to the ravine floor inside it). Street View on the bridge (2026-11-12): a raised concrete
        // sidewalk on each side inside the balustrades, dark lantern posts at the parapet. Sidewalk width, the lamps'
        // number (two mid-span, one at each end) and height are estimates.
        const Pt = (t, off, dy = 0) => [cx + (a1[0] - a0[0]) * t + nx * off, yAt(t) + dy, cz + (a1[1] - a0[1]) * t + nz * off], HWD = 6.75, DTH = 1.4;
        br.quad(Pt(0, -HWD), Pt(1, -HWD), Pt(1, HWD), Pt(0, HWD), '#9d9b95', 'concrete');
        br.quad(Pt(0, HWD, -DTH), Pt(1, HWD, -DTH), Pt(1, -HWD, -DTH), Pt(0, -HWD, -DTH), '#8f8c85', 'concrete');
        br.quad(Pt(0, HWD, -DTH), Pt(0, HWD), Pt(1, HWD), Pt(1, HWD, -DTH), '#a9a59c', 'concrete'); br.quad(Pt(1, -HWD, -DTH), Pt(1, -HWD), Pt(0, -HWD), Pt(0, -HWD, -DTH), '#a9a59c', 'concrete');
        br.quad(Pt(0, 4.9, 0.17), Pt(1, 4.9, 0.17), Pt(1, 6.45, 0.17), Pt(0, 6.45, 0.17), '#bcb9b1', 'concrete'); br.quad(Pt(1, 4.9), Pt(1, 4.9, 0.17), Pt(0, 4.9, 0.17), Pt(0, 4.9), '#aaa79f', 'concrete');
        br.quad(Pt(0, -6.45, 0.17), Pt(1, -6.45, 0.17), Pt(1, -4.9, 0.17), Pt(0, -4.9, 0.17), '#bcb9b1', 'concrete'); br.quad(Pt(0, -4.9), Pt(0, -4.9, 0.17), Pt(1, -4.9, 0.17), Pt(1, -4.9), '#aaa79f', 'concrete');
        for (let i = 0; i < 48; i++) { const t = (i + 0.5) / 48, p = Pt(t, 0); g.addBox(p[0], p[2], HWD, Lb / 96 + 0.03, yaw, p[1] - DTH, p[1]); }
        for (const s of [-1, 1]) ctx.collider({ wall: true, ax: Pt(0, 6.6 * s)[0], az: Pt(0, 6.6 * s)[2], bx: Pt(1, 6.6 * s)[0], bz: Pt(1, 6.6 * s)[2], y0a: ya - 0.5, y1a: ya + 1.05, y0b: yb - 0.5, y1b: yb + 1.05, nx: 0, nz: 1, y: ya, intended: true }); // balustrades
        for (const [t, s] of [[0.03, 1], [0.97, -1], [0.42, -1], [0.58, 1]]) { const p = Pt(t, 6.25 * s, 0.17); br.cyl(p[0], p[1], p[2], 0.07, 4.0, '#232527', 'metal', 8); br.box(p[0], p[1] + 4.0, p[2], 0.26, 0.42, 0.26, '#e9e2c8', 'glass'); br.box(p[0], p[1] + 4.42, p[2], 0.42, 0.08, 0.42, '#2b2d2f', 'metal'); }
        for (const s of [-1, 1]) for (let t = 0; t <= 1.001; t += 1 / 46) { const x = cx + (a1[0] - a0[0]) * t + nx * 6.6 * s, z = cz + (a1[1] - a0[1]) * t + nz * 6.6 * s, y = yAt(t); br.box(x, y, z, 0.18, 0.75, 0.18, '#c9c5bb', 'concrete', yaw); if (t < 0.99) { const x2 = cx + (a1[0] - a0[0]) * (t + 1 / 46) + nx * 6.6 * s, z2 = cz + (a1[1] - a0[1]) * (t + 1 / 46) + nz * 6.6 * s; br.box((x + x2) / 2, y + 0.75, (z + z2) / 2, 0.32, 0.22, Lb / 46 + 0.02, '#cdc9bf', 'concrete', yaw); } }
        // (round 3) the substructure as seen from below in an official panorama on the ravine lane beside the bridge (2026-11-13):
        // a concrete slab deck on single tapered rectangular piers standing upright on the slope under the deck's middle —
        // not the two pairs of canted struts guessed before. Pier count / spacing and section are estimates (three piers).
        for (const t of [0.25, 0.5, 0.75]) { const [x, , z] = Pt(t, 0), y = yAt(t) - DTH, gy = g.heightAt(x, z), h = y - gy + 1.2; if (h < 3) continue;
            const pg = new THREE.CylinderGeometry(1.0, 0.72, h, 4).rotateY(Math.PI / 4); br.add(pg, 'concrete', M(x, gy - 1.2 + h / 2, z, 0, yaw, 0, 1.8, 1, 1), '#a29e95'); pg.dispose(); ctx.circle(x, z, 0.9, h, { y: gy }); }
        ctx.add(br.build('lwb-bridge'));
    }
}
export { LAKE_Y, DECK, meshMaterial, stripGeo, boat, lwbBridge, hullGeo };
