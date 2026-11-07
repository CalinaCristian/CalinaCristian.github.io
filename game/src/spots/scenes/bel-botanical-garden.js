// ============================================================================
//  Bellevue Botanical Garden: hilly Pacific Northwest forest with garden rooms
//  — the Shorts Visitor Center, the Perennial Border, the Yao Japanese garden
//  (raked gravel, stone lanterns, maples) and the Ravine Experience suspension
//  bridge over a ~15 m ravine (it sways gently while you cross).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, alongPolyline, polylineLength, lerp, smooth } from '../kit.js';
import { signBoard } from '../props.js';

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
    return { A, B, yaw };
}

export default {
    env: { fogFar: 2600 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-botanical-garden');
        const br = d.ways.find((w) => w.id === 'w210457899') || { pts: [[160, 240], [200, 255]] };
        const bridge = suspensionBridge(ctx, br.pts);
        ctx.skipWays.add(br.id || '');
        ctx.terrainOpts = { bg: '#4f6a34', innerPx: 2048 };
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.7, density: 1 / 45 }, streetTreeOpts: { spacing: 12, prob: 0.6 } });
        const r = rng(33);
        // dense PNW forest (Douglas fir, western red cedar, bigleaf maple) outside the garden rooms + ferns
        for (let i = 0; i < 900; i++) { const x = -190 + r() * 380, z = -200 + r() * 420; const nearPath = d.ways.some((w) => w.k !== 'service' && w.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4)); if (nearPath) continue; if (Math.hypot(x - 82, z - 66) < 30 || Math.hypot(x - 22, z - 122) < 25 || Math.hypot(x - 7, z + 11) < 22) continue; ctx.trees.push({ x, z, kind: r() < 0.62 ? 'con' : r() < 0.6 ? 'broad' : 'shrub', s: r() < 0.62 ? 1.1 + r() * 0.7 : 0.6 + r() * 0.6 }); }
        // Perennial Border: long beds of colour
        const pb = sp.structures.find((s) => s.id === 'perennial-border');
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; const cols = ['#c94f7c', '#e8b72c', '#9b59b6', '#e8743b', '#f2efe4', '#5a8f3e', '#d64545']; for (let i = 0; i < 2200; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 26; const [px, py] = T(pb.x + Math.cos(a) * rr * 1.6, pb.z + Math.sin(a) * rr * 0.6); x.fillStyle = cols[i % cols.length]; x.fillRect(px, py, Math.max(1, 0.25 * k), Math.max(1, 0.25 * k)); } });
        for (let i = 0; i < 90; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 24; ctx.trees.push({ x: pb.x + Math.cos(a) * rr * 1.6, z: pb.z + Math.sin(a) * rr * 0.6, kind: 'shrub', s: 0.5 + r() * 0.5, c: ['#7b4a6e', '#c9a43a', '#6d8f3e', '#b8564a'][i % 4] }); }
        // Yao Garden: raked gravel, stone lanterns, Japanese maples, a pond
        const yg = sp.structures.find((s) => s.id === 'yao-garden'), b = new GeoBatch();
        ctx.painter.custom((x, T, k, isMask) => { const [cx, cy] = T(yg.x, yg.z); x.fillStyle = isMask ? 'rgb(0,120,0)' : '#cfc9bb'; x.beginPath(); x.ellipse(cx, cy, 14 * k, 9 * k, 0.3, 0, 7); x.fill(); if (!isMask) { x.strokeStyle = 'rgba(120,112,98,0.6)'; x.lineWidth = Math.max(1, 0.06 * k); for (let i = 1; i < 12; i++) { x.beginPath(); x.ellipse(cx, cy, i * 1.1 * k, i * 0.7 * k, 0.3, 0, 7); x.stroke(); } } });
        for (const [dx, dz] of [[-10, -6], [12, 4], [-4, 10]]) { const x = yg.x + dx, z = yg.z + dz, y = g.heightAt(x, z); b.cyl(x, y, z, 0.25, 0.9, '#8a867c', 'stone', 6); b.box(x, y + 0.9, z, 0.7, 0.45, 0.7, '#8a867c', 'stone'); b.cyl(x, y + 1.35, z, 0.55, 0.3, '#7a766c', 'stone', 4, 0.2); ctx.circle(x, z, 0.4, 1.6); }
        for (let i = 0; i < 9; i++) ctx.trees.push({ x: yg.x + (r() - 0.5) * 34, z: yg.z + (r() - 0.5) * 24, kind: 'broad', s: 0.5 + r() * 0.2, c: ['#b8302a', '#c94a1f', '#8e2a2a'][i % 3] });
        ctx.add(b.build('yao-garden'));
        const vc = sp.structures.find((s) => s.id === 'visitor-center');
        const sg = signBoard('BELLEVUE BOTANICAL GARDEN', 5.6, 0.8, { bg: '#3d4f2e', fg: '#efe9d8', font: (s) => `700 ${s}px Georgia, serif` }); sg.position.set(vc.x - 8, g.heightAt(vc.x - 8, vc.z - 14) + 1.2, vc.z - 14); ctx.add(sg);
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], vc.x + 4, vc.z + 10, Math.PI); ctx.plaque(PL[1], pb.x - 10, pb.z - 8, 0.4); ctx.plaque(PL[2], yg.x + 15, yg.z, -Math.PI / 2); ctx.plaque(PL[3], vc.x - 6, vc.z + 9, Math.PI);
        ctx.challenge('bel-botanical-garden', { r: 14, tol: 35 });
        ctx.crowdCfg = {
            personas: { local: 5, tech: 2, kid: 1.5, photographer: 1.5, tourist_us: 1.5, tourist_cn: 1, tourist_in: 1.2, tourist_kr: 0.8, tourist_jp: 1, staff: 0.4 },
            walkers: 22, paths: ctx.footLines(),
            groups: [
                { x: pb.x + 4, z: pb.z + 6, r: 6, n: 6, act: 'photo', look: [pb.x, pb.z], personas: ['photographer', 'local', 'tourist_jp'] },
                { x: yg.x, z: yg.z - 12, r: 3, n: 4, act: 'watch', look: [yg.x, yg.z], personas: ['tourist_jp', 'local', 'tourist_cn'] },
                { x: bridge.A.x - 3, z: bridge.A.z - 2, r: 2, n: 3, act: 'watch', look: [bridge.B.x, bridge.B.z], personas: ['kid', 'local'] },
                { x: vc.x, z: vc.z + 14, r: 2, n: 3, act: 'talk', personas: ['staff', 'local'] },
            ],
        };
        ctx.sound('birds', 0, 120, 300, 1.4); ctx.sound('wind', 150, 240, 140, 0.8); ctx.sound('water', yg.x, yg.z, 30, 0.5);
        ctx.spawns['bel-botanical-garden'] = { x: sp.spawn.x, z: sp.spawn.z + 3, heading: headingFromBearing(sp.spawn.heading_deg) };
        void M;
    },
};
