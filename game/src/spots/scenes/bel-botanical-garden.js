// ============================================================================
//  Bellevue Botanical Garden: hilly Pacific Northwest forest with garden rooms
//  — the Shorts Visitor Center, the Perennial Border, the Yao Japanese garden
//  (raked gravel, stone lanterns, maples) and the Ravine Experience suspension
//  bridge over a ~15 m ravine (it sways gently while you cross).
//  Round 5 (spots-bel): garden rooms placed from the OSM survey (Perennial
//  Border, Yao Garden + gate + koi pond, ponds, Tateuchi pavilion, the Shorts
//  Visitor Center / Aaron Education Center building), Garden d'Lights holiday
//  lights (late Nov – Dec 31, night), activities: cross the ravine bridge,
//  read five plant labels (note 57).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, alongPolyline, polylineLength, lerp, smooth, inPoly, polyBox, distPolyline } from '../kit.js';
import { signBoard } from '../props.js';
import { activityBlocked } from '../participation.js';
import { makeWaterMaterial } from '../../water.js';
import { emitActivity, seasonal, waterPoly, fairyLights, gableRoof, glowText, nightLit } from './bel-common.js';

function suspensionBridge(ctx, pts) {
    const g = ctx.ground, L = polylineLength(pts), A = alongPolyline(pts, 0), B = alongPolyline(pts, L);
    const yA = g.heightAt(A.x, A.z), yB = g.heightAt(B.x, B.z), b = new GeoBatch(), sag = 1.2;
    const yAt = (t) => lerp(yA, yB, t) + 0.1 - sag * Math.sin(Math.PI * t);
    // deep ravine under the span
    g.mod((x, z, h) => { const dx = B.x - A.x, dz = B.z - A.z, LL = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / LL)), cx = A.x + dx * t, cz = A.z + dz * t, d = Math.hypot(x - cx, z - cz); if (t <= 0.05 || t >= 0.95 || d > 24) return h; return Math.min(h, lerp(yAt(t) - 15 * Math.sin(Math.PI * t), h, smooth(6, 24, d))); });
    const deck = new THREE.Group(); deck.name = 'ravine-bridge-deck';
    const yaw = Math.atan2(B.x - A.x, B.z - A.z), nx = Math.cos(yaw), nz = -Math.sin(yaw);
    const N = 40;
    for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N, x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t);
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, L / N - 0.05), new THREE.MeshStandardMaterial({ color: i % 2 ? '#7a5a3c' : '#6f5236', roughness: 0.85 }));
        plank.position.set(x, yAt(t), z); plank.rotation.y = yaw; plank.castShadow = true; plank.userData.t = t; deck.add(plank);
        ctx.ground.addBox(x, z, 0.8, L / N / 2 + 0.02, yaw, yAt(t) - 1, yAt(t) + 0.04);
    }
    ctx.add(deck);
    // towers at both ends, main cables, hangers, mesh side rails
    for (const [P, y] of [[A, yA], [B, yB]]) for (const s of [-1, 1]) b.box(P.x + nx * s * 1.1, y - 0.2, P.z + nz * s * 1.1, 0.25, 2.6, 0.25, '#4a4f53', 'steel', yaw);
    for (const s of [-1, 1]) {
        const cable = [], rail = [];
        for (let i = 0; i <= 20; i++) { const t = i / 20, x = lerp(A.x, B.x, t) + nx * s * 1.0, z = lerp(A.z, B.z, t) + nz * s * 1.0; cable.push([x, yAt(t) + 1.15 + sag * 0.4 * (1 - Math.sin(Math.PI * t)), z]); rail.push([x, yAt(t) + 1.05, z]); if (i % 2 === 0) b.rod([x, yAt(t), z], [x, yAt(t) + 1.1, z], 0.015, '#3a3f43', 'steel', 4); }
        b.tube(cable, 0.03, '#2f3437', 'steel', 5); b.tube(rail, 0.025, '#2f3437', 'steel', 5);
        ctx.collider({ wall: true, ax: A.x + nx * s * 0.95, az: A.z + nz * s * 0.95, bx: B.x + nx * s * 0.95, bz: B.z + nz * s * 0.95, y0a: yA - 20, y1a: yA + 2, y0b: yB - 20, y1b: yB + 2, nx: 0, nz: 1 });
    }
    ctx.add(b.build('ravine-bridge'));
    // gentle sway while someone walks on it
    ctx.onUpdate((dt, s, pl) => { if (!pl) return; const on = Math.hypot(pl.x - (A.x + B.x) / 2, pl.z - (A.z + B.z) / 2) < L / 2 + 1; const amp = on ? 0.03 * Math.min(1, pl.speed) : 0.006; for (const p of deck.children) { const t = p.userData.t; p.position.y = yAt(t) + Math.sin(s.t * 3 + t * 6) * amp * Math.sin(Math.PI * t); p.rotation.z = Math.sin(s.t * 2.2) * amp * 0.6; } });
    return { A, B, yaw, yAt };
}

export default {
    env: { fogFar: 2600, ambientCity: 0.12, groundAlbedo: 0.1 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-botanical-garden');
        const area = (id) => d.areas.find((a) => a.id === id)?.poly, bld = (id) => d.buildings.find((x) => x.id === id)?.poly;
        const cen = (p) => { const b = polyBox(p); return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; };
        // the Ravine Experience: a steep V-shaped creek ravine along the OSM stream (w207683155) — slopes ~40°, rocky bed
        const stream = d.areas.find((x) => x.id === 'w207683155')?.poly || [];
        const sb = polyBox(stream.length ? stream : [[0, 0], [1, 1]]);
        const bedAt = []; for (const [x, z] of stream) bedAt.push(g.heightAt(x, z));
        const bedY = (x, z) => { const q = distPolyline(x, z, stream); let i = 0, best = 1e9; stream.forEach(([px, pz], k) => { const dd = Math.hypot(px - x, pz - z); if (dd < best) { best = dd; i = k; } }); return { d: q.d, y: bedAt[i] }; };
        if (stream.length) g.mod((x, z, h) => { if (x < sb.x0 - 30 || x > sb.x1 + 30 || z < sb.z0 - 30 || z > sb.z1 + 30) return h; const q = bedY(x, z); if (q.d > 26) return h; const floor = q.y - 5.5 + Math.min(q.d, 1.6) * 0.3, wall = floor + Math.pow(Math.max(0, q.d - 1.6) / 24.4, 1.25) * 17; return Math.min(h, wall); });
        const br = d.ways.find((w) => w.id === 'w210457899') || { pts: [[160, 240], [200, 255]] };
        const bridge = suspensionBridge(ctx, br.pts);
        if (stream.length) { // the creek: a narrow ribbon of water on the bed + boulders, ferns along it
            const ribbon = []; for (let i = 0; i < stream.length; i++) { const [x, z] = stream[i], [nx2, nz2] = stream[Math.min(stream.length - 1, i + 1)], [px2, pz2] = stream[Math.max(0, i - 1)], tx = nx2 - px2, tz = nz2 - pz2, tl = Math.hypot(tx, tz) || 1; ribbon.push([[x + tz / tl * 0.9, z - tx / tl * 0.9], [x - tz / tl * 0.9, z + tx / tl * 0.9]]); }
            const poly = [...ribbon.map((q) => q[0]), ...ribbon.map((q) => q[1]).reverse()];
            const creekMat = makeWaterMaterial({ deep: '#2c3a30', shallow: '#566a50', ripple: 1.2, wave: 0.3, flow: [0.3, 0.5] });
            for (let i = 0; i + 1 < stream.length; i++) { const [ax, az] = stream[i], [qx, qz] = stream[i + 1], ya = g.heightAt(ax, az) + 0.12, yb = g.heightAt(qx, qz) + 0.12, L = Math.hypot(qx - ax, qz - az), tx = (qx - ax) / L, tz = (qz - az) / L; const seg = [[ax + tz * 0.9, az - tx * 0.9], [qx + tz * 0.9, qz - tx * 0.9], [qx - tz * 0.9, qz + tx * 0.9], [ax - tz * 0.9, az + tx * 0.9]]; waterPoly(ctx, seg, (ya + yb) / 2, { material: creekMat, cell: 1.2, name: 'creek' }); }
            void poly;
            const rb = new GeoBatch(), rr2 = rng(7); for (const [x, z] of stream) for (let k = 0; k < 4; k++) { const px = x + (rr2() - 0.5) * 5, pz = z + (rr2() - 0.5) * 5, y = g.heightAt(px, pz); rb.sphere(px, y + 0.1, pz, 0.35 + rr2() * 0.4, 0.25 + rr2() * 0.2, 0.35 + rr2() * 0.4, ['#6d6a62', '#5e5c55', '#7a766c'][k % 3], 'stone', 7, 5); }
            ctx.add(rb.build('creek-rocks'));
            for (let i = 0; i < 260; i++) { const k = Math.floor(rng(i + 3)() * stream.length), [x, z] = stream[k], a = i * 2.39, dd = 3 + (i % 9) * 2.2; const px = x + Math.cos(a) * dd, pz = z + Math.sin(a) * dd; if (distPolyline(px, pz, br.pts).d < 3) continue; ctx.trees.push({ x: px, z: pz, kind: i % 3 ? 'con' : 'broad', s: 1.1 + (i % 5) * 0.15 }); }
        }
        ctx.skipWays.add(br.id || '');
        for (const id of ['r19675678', 'r19659543', 'w32121769']) ctx.skipBuildings.add(id);
        for (const id of ['w453135450', 'w133513232', 'w480055239']) ctx.skipAreas.add(id);
        ctx.terrainOpts = { bg: '#4f6a34', innerPx: 2048 };
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.7, density: 1 / 45 }, streetTreeOpts: { spacing: 12, prob: 0.6 } });
        const r = rng(33), b = new GeoBatch();
        // ponds (OSM) on the shared water material
        for (const id of ['w453135450', 'w133513232', 'w480055239']) { const p = area(id); if (!p) continue; const y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.25; g.mod((x, z, h) => (inPoly(x, z, p) ? Math.min(h, y - 0.6) : h)); waterPoly(ctx, p, y, { deep: '#26382c', shallow: '#4a5a3c', cell: 1.2, name: 'pond-' + id }); ctx.poly(p, { h: 0.5, intended: true }); }
        // forest (Douglas fir, western red cedar, bigleaf maple) outside the garden rooms
        const rooms = d.areas.filter((a) => a.leisure === 'garden' || a.landuse === 'flowerbed' || a.landuse === 'grass' || a.natural === 'water' || a.landuse === 'meadow').map((a) => ({ p: a.poly, b: polyBox(a.poly) }));
        const inRoom = (x, z) => rooms.some((q) => x > q.b.x0 && x < q.b.x1 && z > q.b.z0 && z < q.b.z1 && inPoly(x, z, q.p));
        for (let i = 0; i < 1800; i++) { const x = -190 + r() * 420, z = -200 + r() * 500; if (inRoom(x, z)) continue; if (d.ways.some((w) => w.k !== 'service' && w.pts.length > 1 && distPolyline(x, z, w.pts).d < 3)) continue; if (d.buildings.some((q) => inPoly(x, z, q.poly))) continue; ctx.trees.push({ x, z, kind: r() < 0.62 ? 'con' : r() < 0.6 ? 'broad' : 'shrub', s: r() < 0.62 ? 1.1 + r() * 0.7 : 0.6 + r() * 0.6 }); }
        // flower colour in every named bed (Perennial Border densest) + shrubs
        const beds = d.areas.filter((a) => a.landuse === 'flowerbed' && !/Ground Cover|Woodland|Native/.test(a.name || ''));
        const cols = ['#b55077', '#d9b24a', '#8a5aa6', '#d47a45', '#e8e4d6', '#5e7d3a', '#4f6e35'], hashC = (x, z) => { const v = Math.sin(Math.floor(x / 3) * 12.9898 + Math.floor(z / 3) * 78.233) * 43758.5453; return v - Math.floor(v); }; // colour in 3 m clumps
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const a of beds) { const B = polyBox(a.poly), A = Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)), n = Math.min(900, A * (/Perennial/.test(a.name || '') ? 0.8 : 0.35)); for (let i = 0; i < n; i++) { const px = B.x0 + r() * (B.x1 - B.x0), pz = B.z0 + r() * (B.z1 - B.z0); if (!inPoly(px, pz, a.poly)) continue; const [cx, cy] = T(px, pz); const c = cols[Math.floor(hashC(px, pz) * cols.length)]; x.fillStyle = c; x.globalAlpha = 0.7; x.beginPath(); x.arc(cx, cy, Math.max(1, 0.45 * k), 0, 7); x.fill(); x.globalAlpha = 1; } } });
        for (const a of beds) { const B = polyBox(a.poly); for (let i = 0; i < Math.min(16, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 60); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) ctx.trees.push({ x, z, kind: 'shrub', s: 0.4 + r() * 0.35, c: ['#4f6a38', '#5d7340', '#6b5a3a', '#46603a', '#7a6640'][i % 5] }); } }
        // Yao Garden (sister city Yao, Japan): gate, lanterns, maples, raked gravel
        const ygp = area('w32121704'), yg = ygp ? cen(ygp) : { x: 104, z: 18 };
        ctx.painter.custom((x, T, k, isMask) => { const [cx, cy] = T(yg.x - 14, yg.z - 4); x.fillStyle = isMask ? 'rgb(0,120,0)' : '#cfc9bb'; x.beginPath(); x.ellipse(cx, cy, 9 * k, 6 * k, 0.3, 0, 7); x.fill(); if (!isMask) { x.strokeStyle = 'rgba(120,112,98,0.6)'; x.lineWidth = Math.max(1, 0.06 * k); for (let i = 1; i < 8; i++) { x.beginPath(); x.ellipse(cx, cy, i * 1.1 * k, i * 0.7 * k, 0.3, 0, 7); x.stroke(); } } });
        const lanterns = [];
        for (const [dx, dz] of [[-10, -6], [8, 10], [-4, 14], [-18, 2]]) { const x = yg.x + dx, z = yg.z + dz, y = g.heightAt(x, z); b.cyl(x, y, z, 0.25, 0.9, '#8a867c', 'stone', 6); b.box(x, y + 0.9, z, 0.7, 0.45, 0.7, '#8a867c', 'stone'); b.cyl(x, y + 1.35, z, 0.55, 0.3, '#7a766c', 'stone', 4, 0.2); ctx.circle(x, z, 0.4, 1.6); lanterns.push([x, y + 1.1, z]); }
        for (let i = 0; i < 9; i++) ctx.trees.push({ x: yg.x + (r() - 0.5) * 30, z: yg.z + (r() - 0.5) * 22, kind: 'broad', s: 0.5 + r() * 0.2, c: ['#b8302a', '#c94a1f', '#8e2a2a'][i % 3] });
        const gate = bld('r19659543'); if (gate) { const c = cen(gate), y = g.heightAt(c.x, c.z), yaw = Math.atan2(gate[1][0] - gate[0][0], gate[1][1] - gate[0][1]); for (const s2 of [-1, 1]) { const px = c.x + Math.cos(yaw) * 1.4 * s2, pz = c.z - Math.sin(yaw) * 1.4 * s2; b.cyl(px, y, pz, 0.14, 2.6, '#5b3a26', 'wood', 8); ctx.circle(px, pz, 0.2, 2.6); } b.box(c.x, y + 2.3, c.z, 3.6, 0.18, 0.3, '#4a2f1f', 'wood', yaw + Math.PI / 2); gableRoof(b, c.x, y + 2.6, c.z, yaw + Math.PI / 2, 4.2, 1.6, 0.7, '#3d3a36', { over: 0.25 }); }
        // Tateuchi Viewing Pavilion (cedar, shingled hip roof) over the pond
        const tv = bld('w32121769'); if (tv) { const c = cen(tv), y = g.heightAt(c.x, c.z); for (const [dx, dz] of [[-2.2, -2.6], [2.2, -2.6], [-2.2, 2.6], [2.2, 2.6]]) { b.cyl(c.x + dx, y, c.z + dz, 0.12, 2.5, '#6b4a30', 'wood', 8); ctx.circle(c.x + dx, c.z + dz, 0.15, 2.5); } b.box(c.x, y, c.z, 5, 0.2, 6, '#7a5a3c', 'wood'); gableRoof(b, c.x, y + 2.5, c.z, 0.1, 6.4, 5, 1.6, '#5a4a3a', { over: 0.6 }); }
        // Shorts Visitor Center / Aaron Education Center (2015): low cedar-and-glass pavilions, planted flat roof, courtyard
        const vcp = bld('r19675678');
        if (vcp) { const yb = Math.min(...vcp.map(([x, z]) => g.heightAt(x, z))); g.flatten(vcp, yb, 4); b.prism(vcp, yb - 0.5, yb + 4.2, '#8a6446', 'wood'); b.prism(vcp.map(([x, z]) => [x, z]), yb + 4.2, yb + 4.6, '#5d7a3c', 'plant');
            for (let i = 0; i < vcp.length; i++) { const [ax, az] = vcp[i], [qx, qz] = vcp[(i + 1) % vcp.length], L = Math.hypot(qx - ax, qz - az); if (L < 6) continue; const ya = Math.atan2(qx - ax, qz - az); for (let t = 2; t < L - 2; t += 4.2) { const px = ax + (qx - ax) * t / L, pz = az + (qz - az) * t / L; b.box(px, yb + 0.3, pz, 3.4, 3.2, 0.12, '#2d353a', 'darkglass', ya + Math.PI / 2); } }
            ctx.poly(vcp); const c = cen(vcp); const glow = nightLit('#ffd59a', 1.1, { base: '#3a3a36', name: 'vc-glow' }); const gm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 30), glow); gm.position.set(polyBox(vcp).x0 - 0.2, yb + 1.9, c.z + 10); ctx.add(gm); }
        ctx.add(b.build('garden-structures'));
        const vc = vcp ? { x: polyBox(vcp).x0 - 6, z: polyBox(vcp).z1 + 6 } : (sp.structures.find((s) => s.id === 'visitor-center') || { x: 5, z: -8 });
        const sg = signBoard('BELLEVUE BOTANICAL GARDEN', 5.6, 0.8, { bg: '#3d4f2e', fg: '#efe9d8', font: (s) => `700 ${s}px Georgia, serif`, night: 0.6 }); sg.position.set(vc.x - 4, g.heightAt(vc.x - 4, vc.z - 14) + 1.2, vc.z - 14); ctx.add(sg);
        // Garden d'Lights (late Nov – Dec 31): coloured lights in beds, on paths, round the ponds — night only
        { const pts = []; for (const a of beds) { const B = polyBox(a.poly); for (let i = 0; i < Math.min(260, Math.abs((B.x1 - B.x0) * (B.z1 - B.z0)) / 4); i++) { const x = B.x0 + r() * (B.x1 - B.x0), z = B.z0 + r() * (B.z1 - B.z0); if (inPoly(x, z, a.poly)) pts.push([x, g.heightAt(x, z) + 0.3 + r() * 1.2, z]); } }
            for (const w of d.ways) { if (!['footway', 'path'].includes(w.k) || Math.hypot(w.pts[0][0], w.pts[0][1]) > 160) continue; for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [qx, qz] = w.pts[i], L = Math.hypot(qx - ax, qz - az); for (let t = 0; t < L; t += 1.4) pts.push([ax + (qx - ax) * t / L + 1.3, g.heightAt(ax, az) + 0.25, az + (qz - az) * t / L]); } }
            let on = false; seasonal(ctx, [11, 28], [12, 31], (v) => { on = v; });
            const half = Math.floor(pts.length / 2);
            fairyLights(ctx, pts.slice(0, half), { color: '#ff7ab8', size: 0.2, on: () => on, name: 'garden-dlights-a' }); fairyLights(ctx, pts.slice(half), { color: '#8fd3ff', size: 0.2, on: () => on, name: 'garden-dlights-b' });
            fairyLights(ctx, lanterns, { color: '#ffd38a', size: 0.5, twinkle: 0.05, name: 'yao-lanterns' }); }
        // ---------------------------------------------------------------- activities (note 57)
        // 1) cross the ravine suspension bridge (end to end)
        let crossing = null, crossed = false;
        const span = Math.hypot(bridge.B.x - bridge.A.x, bridge.B.z - bridge.A.z);
        ctx.extras.botanicalBridge = { A: bridge.A, B: bridge.B, debug: () => crossing && { ...crossing } };
        ctx.onUpdate((dt, s, p) => {
            if (crossed || !p) return;
            const A = bridge.A, B = bridge.B, t = Math.max(0, Math.min(1, ((p.x - A.x) * (B.x - A.x) + (p.z - A.z) * (B.z - A.z)) / (span * span)));
            const dA = Math.hypot(p.x - A.x, p.z - A.z), dB = Math.hypot(p.x - B.x, p.z - B.z);
            if (!s.ctl.active || activityBlocked(s) || Math.abs(p.y - bridge.yAt(t)) > .8 || distPolyline(p.x, p.z, [[A.x, A.z], [B.x, B.z]]).d > 3) { crossing = null; return; }
            if (crossing) {
                const delta = Math.hypot(p.x - crossing.previous.x, p.z - crossing.previous.z);
                if (delta > Math.max(1, dt * 6)) { crossing = null; return; }
                crossing.walked += delta; crossing.previous = { x: p.x, z: p.z };
                if ((crossing.from === 'A' ? dB : dA) < 3 && crossing.walked >= span - 6) {
                    crossed = true; crossing = null;
                    emitActivity(s, 'bel-botanical-garden', 'bridge', '🌉 Across the ravine', 'You walked the modelled suspension bridge continuously from one end to the other.');
                }
            } else if (dA < 3 || dB < 3) crossing = { from: dA < dB ? 'A' : 'B', walked: 0, previous: { x: p.x, z: p.z } };
        });
        ctx.interactables.push({ kind: 'activity', x: bridge.A.x, z: bridge.A.z, r: 3, label: 'Cross the ravine suspension bridge', use: (s) => s.ui.toast('🌉 Ravine Experience', 'Walk across to the far end — it sways a little.') });
        // 2) virtual trail notes at mapped garden rooms. Source names do not
        // establish specimen labels or physical sign hardware at these points.
        const LABELS = [['Perennial Border', 'r19655849', 'Northwest Perennial Alliance border — hardy geraniums, asters, sedums'], ['Yao Garden', 'w32121704', 'Japanese maple (Acer palmatum) — sister city Yao, Japan'], ['Fuchsia Garden', 'r19658437', 'Hardy fuchsias (Fuchsia magellanica)'], ['Rhododendron Glen', 'r19675946', 'Rhododendrons — Washington\'s state flower is the coast rhododendron'], ['Native Discovery Garden', 'r19676251', 'Sword fern (Polystichum munitum) and Oregon grape'], ['Waterwise Garden', 'r19674922', 'Drought-tolerant lavender, rockrose and grasses'], ['Rock Garden', 'r19795610', 'Alpine plants among granite boulders']];
        for (const [name, id, text] of LABELS) { const p = area(id); if (!p) continue; let best = null; for (const w of d.ways) { if (!['footway', 'path'].includes(w.k)) continue; for (const [x, z] of w.pts) if (inPoly(x + 1.2, z, p) || Math.hypot(x - cen(p).x, z - cen(p).z) < 25) { const dd = Math.hypot(x - cen(p).x, z - cen(p).z); if (!best || dd < best.d) best = { x: x + 1.2, z, d: dd }; } } const q = best || cen(p);
            ctx.interactables.push({ kind: 'plant', x: q.x, z: q.z, r: 2, source: id, label: `Virtual garden trail note: ${name}`, use: (s) => s.ui.toast(`🌿 Virtual trail: ${name}`, text) }); }
        // plaques
        const PL = sp.plaques, pbo = area('r19655849') ? cen(area('r19655849')) : { x: -70, z: -17 };
        ctx.plaque(PL[0], vc.x + 4, vc.z + 4, Math.PI); ctx.plaque(PL[1], pbo.x + 14, pbo.z - 8, 0.4); ctx.plaque(PL[2], yg.x - 20, yg.z, -Math.PI / 2); ctx.plaque(PL[3], vc.x - 3, vc.z + 4, Math.PI);
        { const A = bridge.A, B = bridge.B, L = Math.hypot(B.x - A.x, B.z - A.z), ux = (A.x - B.x) / L, uz = (A.z - B.z) / L, vx = A.x + ux * 5, vz = A.z + uz * 5, bb2 = ((Math.atan2(B.x - vx, -(B.z - vz)) * 180 / Math.PI) + 360) % 360; ctx.challenge('bel-botanical-garden', { view: [B.x, B.z], x: vx, z: vz, heading: bb2, pitch: -6, r: 10, tol: 35, text: 'The Ravine Experience suspension bridge disappearing into ferns and firs' }); }
        ctx.crowdCfg = {
            personas: { local: 5, tech: 2, kid: 1.5, photographer: 1.5, tourist_us: 1.5, tourist_cn: 1, tourist_in: 1.2, tourist_kr: 0.8, tourist_jp: 1, staff: 0.4 },
            walkers: 22, paths: ctx.footLines(),
            groups: [
                { x: pbo.x + 6, z: pbo.z + 6, r: 6, n: 6, act: 'photo', look: [pbo.x, pbo.z], personas: ['photographer', 'local', 'tourist_jp'] },
                { x: yg.x - 12, z: yg.z - 6, r: 3, n: 4, act: 'watch', look: [yg.x, yg.z], personas: ['tourist_jp', 'local', 'tourist_cn'] },
                { x: bridge.A.x - 3, z: bridge.A.z - 2, r: 2, n: 3, act: 'watch', look: [bridge.B.x, bridge.B.z], personas: ['kid', 'local'] },
                { x: vc.x, z: vc.z + 6, r: 2, n: 3, act: 'talk', personas: ['staff', 'local'] },
            ],
        };
        ctx.sound('birds', 0, 120, 300, 1.4); ctx.sound('wind', 150, 240, 140, 0.8); ctx.sound('water', yg.x, yg.z + 20, 30, 0.5);
        ctx.spawns['bel-botanical-garden'] = { x: sp.spawn.x, z: sp.spawn.z + 3, heading: headingFromBearing(sp.spawn.heading_deg) };
        void M; void glowText;
    },
};
