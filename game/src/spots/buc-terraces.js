// Bucharest Old Town terraces for buc.js (split out by spec 22; buc.js re-exports them): facadeToward, oldTownTerraces
// (pergolas, awnings, tables in front of the bars) and floodlight.
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, rng, inPoly, polyBox } from './kit.js';

// ---------------------------------------------------------------------------- old-town terraces (pergolas, awnings, tables)
/** façade point of the building containing (px, pz) toward the street point (qx, qz): { x, z, nx, nz } or null */
export function facadeToward(data, px, pz, qx, qz) {
    for (const b of data.buildings) {
        if (b.part || b.backdrop) continue; const bb = b._bb || (b._bb = polyBox(b.poly));
        if (px < bb.x0 || px > bb.x1 || pz < bb.z0 || pz > bb.z1 || !inPoly(px, pz, b.poly)) continue;
        let best = null; const p = b.poly;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], [bx, bz] = p[i], dx = qx - px, dz = qz - pz, ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t >= 0 && t <= 1.5 && u >= 0 && u <= 1 && (!best || t < best.t)) { const L = Math.hypot(ex, ez); best = { t, x: px + dx * t, z: pz + dz * t, ex: ex / L, ez: ez / L }; }
        }
        if (!best) return null;
        let nx = best.ez, nz = -best.ex; if ((qx - best.x) * nx + (qz - best.z) * nz < 0) { nx = -nx; nz = -nz; }
        return { x: best.x, z: best.z, nx, nz, b };
    }
    return null;
}
/**
 * terraces in front of bars / restaurants / cafés (POIs) along pedestrian streets: pergola posts, canvas awning, tables + chairs,
 * planters; a shop sign above the door. Returns { group, signs[], lamps[] } (signs → signAtlas, lamps → ctx.lampPoints).
 * o: { inside(x,z), streets: ways to consider, maxDepth, colours }
 */
export function oldTownTerraces(ctx, o = {}) {
    const d = ctx.data, b = new GeoBatch(), r = rng(o.seed || 21), out = { signs: [], lamps: [], terraces: [], seats: [] };
    const streets = o.streets || d.ways.filter((w) => ['pedestrian', 'living_street'].includes(w.k));
    const awn = o.colours || ['#e9e1c8', '#2f5a3a', '#7a2230', '#d9cfb3', '#3b4a5a', '#c9b48a', '#5a3a2a'];
    const placed = [], signPlaced = [];
    // A mapped venue is evidence for its name, not for a terrace. Reserve the
    // activity frontages first so a neighbouring venue cannot erase their sign.
    const priority = new Set(o.prioritySources || []);
    const pois = [...d.pois].sort((a, c) => Number(priority.has(c.id)) - Number(priority.has(a.id)));
    for (const p of pois) {
        const shop = !!p.shop, eat = ['restaurant', 'bar', 'cafe', 'pub', 'fast_food', 'ice_cream', 'biergarten'].includes(p.amenity);
        if (!(eat || shop) || !p.name) continue;
        if (o.inside && !o.inside(p.x, p.z)) continue;
        let best = null; for (const w of streets) { const q = distPolylineK(p.x, p.z, w.pts); if (!best || q.d < best.d) best = { ...q, w }; }
        if (!best || best.d > 28) continue;
        const f = facadeToward(d, p.x, p.z, best.cx, best.cz); if (!f) continue;
        const half = Math.hypot(best.cx - f.x, best.cz - f.z); if (half > 16) continue;
        const y = ctx.ground.heightAt(f.x, f.z), tx = -f.nz, tz = f.nx, yaw = Math.atan2(f.nx, f.nz);
        // sign above the door (on the façade)
        const signW = Math.min(5.5, 1.2 + p.name.length * 0.28);
        if (!signPlaced.some(q => Math.hypot(q.x - f.x, q.z - f.z) < (q.w + signW) / 2 + .2)) {
            out.signs.push({ source: p.id, x: f.x + f.nx * 0.12, y: y + 3.9, z: f.z + f.nz * 0.12, yaw, w: signW, h: 0.62, text: p.name, bg: r.pick(['#1d2a24', '#2a1d1a', '#1a2230', '#3b2a1e', '#0f0f10', '#5a1e22']), fg: r.pick(['#f1e6c8', '#e8c870', '#ffffff']) });
            signPlaced.push({ ...f, w: signW });
        }
        if (!eat || p.outdoor_seating !== 'yes' || half < 2.2) continue;
        if (placed.some((q) => Math.hypot(q.x - f.x, q.z - f.z) < 7)) continue;
        placed.push(f);
        const depth = Math.min(o.maxDepth ?? 3.4, half * 0.62), W = 5.5 + r() * 3, seededColour=r.pick(awn),canopy=o.canopies?.[p.id],col=canopy?.colour||seededColour,canopyKey=canopy?.glass?'terrace-glass':'fabric',cx = f.x + f.nx * depth / 2, cz = f.z + f.nz * depth / 2;
        // pergola: 4 posts, beams, canvas roof sloping to the street, side valance
        const P = (u, v) => [f.x + tx * u + f.nx * v, f.z + tz * u + f.nz * v];
        for (const [u, v] of [[-W / 2, depth - 0.15], [W / 2, depth - 0.15], [-W / 2, 0.3], [W / 2, 0.3]]) { const [x, z] = P(u, v); b.box(x, y, z, 0.1, 2.75, 0.1, '#2b2724', 'metal'); }
        const [ax, az] = P(-W / 2, 0.15), [bx, bz] = P(W / 2, 0.15), [cx2, cz2] = P(W / 2, depth), [dx2, dz2] = P(-W / 2, depth);
        b.quad([dx2, y + 2.6, dz2], [cx2, y + 2.6, cz2], [bx, y + 3.05, bz], [ax, y + 3.05, az], col, canopyKey);
        b.quad([ax, y + 3.03, az], [bx, y + 3.03, bz], [cx2, y + 2.58, cz2], [dx2, y + 2.58, dz2], col, canopyKey); // underside, 2 cm below (no coplanar faces)
        { const [vx, vz] = P(0, depth); b.box(vx, y + 2.3, vz, 0.03, 0.3, W, col, 'fabric', yaw + Math.PI / 2); }
        // furniture at real size (note 22): round bistro tables with two slatted chairs facing each other, a cushioned rattan
        // sofa along the façade on some terraces, bamboo planters at the ends, a patio heater, a menu A-board at the street end
        const nT = Math.max(1, Math.floor(W / 2.1)), chairCol = r.pick(['#3a2c22', '#6b4a32', '#22262a', '#8a6a48']), sofa = depth >= 2.8 && r() < 0.5;
        const chair = (qx, qz, fyaw) => { // fyaw: direction the sitter faces
            const fx = Math.sin(fyaw), fz = Math.cos(fyaw), sx = Math.cos(fyaw), sz = -Math.sin(fyaw);
            for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(qx + sx * a * 0.18 + fx * c * 0.18, y, qz + sz * a * 0.18 + fz * c * 0.18, 0.035, 0.44, 0.035, '#1e1f21', 'metal', fyaw);
            b.box(qx, y + 0.44, qz, 0.44, 0.05, 0.42, chairCol, 'wood', fyaw);
            const bx = qx - fx * 0.2, bz = qz - fz * 0.2;
            for (const a of [-1, 1]) b.box(bx + sx * a * 0.18, y + 0.44, bz + sz * a * 0.18, 0.035, 0.46, 0.035, '#1e1f21', 'metal', fyaw);
            for (const hh of [0.62, 0.78]) b.box(bx, y + hh, bz, 0.42, 0.08, 0.025, chairCol, 'wood', fyaw);
        };
        for (let i = 0; i < nT; i++) { const u = -W / 2 + (i + 0.5) * W / nT, [x, z] = P(u, depth * (sofa ? 0.62 : 0.55)); b.cyl(x, y, z, 0.22, 0.03, '#1e1f21', 'metal', 8); b.cyl(x, y, z, 0.03, 0.73, '#1e1f21', 'metal', 6); b.cyl(x, y + 0.73, z, 0.33, 0.035, r.pick(['#d8d2c4', '#6b4a32', '#2a2a2a', '#efe9dc']), 'wood', 12);
            for (const s of [-1, 1]) { const [qx, qz] = P(u + s * 0.55, depth * (sofa ? 0.62 : 0.55)); const fyaw = Math.atan2(-s * tx, -s * tz); chair(qx, qz, fyaw); out.seats.push({ x: qx - s * tx * 0.04, z: qz - s * tz * 0.04, y, yaw: fyaw }); } }
        if (sofa) { // rattan sofa with grey cushions against the pergola's façade side, facing the street
            const [sx0, sz0] = P(0, 0.62), cush = r.pick(['#8c8f93', '#d8d0c0', '#5a6a5a', '#7a2230']);
            b.box(sx0, y, sz0, W - 0.8, 0.42, 0.75, '#7a5a3a', 'wood', yaw + Math.PI / 2); b.box(sx0, y + 0.425, sz0, W - 0.9, 0.12, 0.7, cush, 'fabric', yaw + Math.PI / 2);
            const [bk, bkz] = P(0, 0.2); b.box(bk, y + 0.42, bkz, W - 0.8, 0.5, 0.14, '#7a5a3a', 'wood', yaw + Math.PI / 2); b.box(bk + f.nx * 0.18, y + 0.5, bkz + f.nz * 0.18, W - 1.0, 0.34, 0.12, cush, 'fabric', yaw + Math.PI / 2); // offsets keep every face ≥ 3 cm from its neighbours (audit z-fight)
            for (let u = -W / 2 + 0.9; u < W / 2 - 0.5; u += 1.2) { const [qx, qz] = P(u, 0.72); out.seats.push({ x: qx, z: qz, y, yaw }); }
        }
        for (const s of [-1, 1]) { const [x, z] = P(s * (W / 2 + 0.35), depth * 0.5); b.box(x, y, z, 0.5, 0.55, 0.5, '#3b3a36', 'concrete', yaw); for (let q = 0; q < 5; q++) { const ox = (r() - 0.5) * 0.3, oz = (r() - 0.5) * 0.3; b.cyl(x + ox, y + 0.55, z + oz, 0.015, 1.2 + r() * 0.6, '#7d8a4a', 'plant', 4); b.sphere(x + ox, y + 1.5 + r() * 0.4, z + oz, 0.18, 0.32, 0.18, '#4f7a3a', 'plant', 6, 4); } }
        if (r() < 0.6) { const [x, z] = P(W / 2 - 0.5, depth - 0.45); b.cyl(x, y, z, 0.22, 0.06, '#2b2d30', 'metal', 10); b.cyl(x, y, z, 0.05, 2.1, '#5c5f63', 'steel', 8); b.cyl(x, y + 2.05, z, 0.34, 0.1, '#5c5f63', 'steel', 12, 0.4); }
        { const [x, z] = P(-W / 2 - 0.2, depth + 0.35), a = yaw + Math.PI / 2; b.box(x, y, z, 0.55, 1.05, 0.06, '#1b1c1d', 'wood', a, 0.12); b.box(x, y, z, 0.55, 1.05, 0.06, '#1b1c1d', 'wood', a, -0.12); b.box(x + f.nx * 0.07, y + 0.25, z + f.nz * 0.07, 0.45, 0.6, 0.02, '#e9e4d6', 'paint', a + Math.PI / 2 * 0, 0.12); }
        // Local x follows the facade tangent; local z follows its outward normal.
        ctx.box(cx, cz, W / 2 + 0.6, depth / 2, yaw, { prop: true, h: 0.8 });
        out.lamps.push({ x: cx, z: cz, h: 2.6, noPost: true });
        out.terraces.push({ source: p.id, x: cx, z: cz, yaw, W, depth, name: p.name, f });
    }
    const overrides=Object.values(o.canopies||{}).some(c=>c.glass)?{'terrace-glass':new THREE.MeshStandardMaterial({color:'#9da89b',transparent:true,opacity:.2,roughness:.2,metalness:.12,depthWrite:false,side:THREE.DoubleSide})}:{};
    out.group = b.build('terraces',{matOverrides:overrides});
    return out;
}
function distPolylineK(px, pz, pts) { let best = { d: 1e9 }; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const cx = ax + dx * t, cz = az + dz * t, d2 = Math.hypot(px - cx, pz - cz); if (d2 < best.d) best = { d: d2, cx, cz }; } return best; }
/** floodlit at night: clone the meshes' materials and give them a warm emissive driven by the session's night factor */
export function floodlight(root, colour = '#ffd9a0', k = 0.35) {
    root.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const m = o.material.clone(); m.userData = { ...o.material.userData, shared: false, dayGlow: 0, nightGlow: k };
        if (m.emissive) { m.emissive = new THREE.Color(colour); m.emissiveIntensity = 0; if (m.map && !m.emissiveMap) m.emissiveMap = m.map; }
        o.material = m;
    });
}
