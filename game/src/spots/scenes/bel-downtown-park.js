// ============================================================================
//  Bellevue Downtown Park (Beckley-Myers, 1987): the circular meadow ringed by
//  a half-mile promenade and a canal (full ring since 2017) that ends in a
//  240-ft-wide waterfall into a reflecting pond; the 1926 WWI memorial elms;
//  Piloti (Marc Fornes / THEVERYMANY, 2023) at the NE gateway — modelled as a
//  white perforated shell from its description, credited. Toss a coin.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, smooth, lerp, clamp } from '../kit.js';
import { meshSDF, sdCapsule, sdEllipsoid, smin, smax, noise3 } from '../sdf.js';
import { signBoard } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';

const C = { x: -47.4, z: 61.2 }, R = 124; // ring centre = the WWI memorial elms (research), radius from the 805 m promenade ≈ 2π·128

function piloti(ctx, x, y, z) {
    // three flaring white legs rising into a domed canopy, ~7 m; panel seams + rivet perforation pattern in vertex colour
    const sdf = (px, py, pz) => {
        let d = sdEllipsoid(px, py, pz, 0, 6.0, 0, 3.6, 1.3, 3.2);
        d = smax(d, -sdEllipsoid(px, py, pz, 0, 5.3, 0, 3.3, 1.1, 2.9), 0.15); // hollow canopy shell
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; d = smin(d, sdCapsule(px, py, pz, Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2, Math.cos(a) * 1.2, 5.4, Math.sin(a) * 1.0, 0.35, 0.9), 0.8); }
        return d + 0.04 * noise3(px * 3, py * 3, pz * 3);
    };
    const geo = meshSDF(sdf, { min: [-4.4, -0.2, -4], max: [4.4, 7.6, 4], cell: 0.09, ao: 0.4,
        color: (px, py, pz, nx, ny, nz, ao, o) => { const hex = Math.abs(Math.sin(px * 6.0) * Math.sin(pz * 6.0 + py * 4.0)); o.set(hex > 0.92 ? '#c9ced2' : '#f4f5f6'); return o.multiplyScalar(0.75 + 0.25 * ao); } });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.castShadow = true; m.name = 'piloti'; ctx.add(m);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; ctx.circle(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, 0.6, 5); }
}

export default {
    env: { fogFar: 5000 },
    async build(ctx) {
        const g = ctx.ground, sp = ctx.spot('bel-downtown-park');
        // the park bowl: meadow flattened, canal ring cut 0.8 m, pond below the waterfall (SW)
        const meadowY = g.heightAt(C.x, C.z);
        g.mod((x, z, h) => { const r = Math.hypot(x - C.x, z - C.z); if (r > R + 18) return h; const k = smooth(R + 18, R + 6, r); return lerp(h, meadowY, k); });
        const wf = sp.structures.find((s) => s.id === 'waterfall'), wa = Math.atan2(wf.z - C.z, wf.x - C.x);
        const pondY = meadowY - 3.2;
        g.mod((x, z, h) => { const r = Math.hypot(x - C.x, z - C.z), a = Math.atan2(z - C.z, x - C.x); let da = Math.abs(a - wa); da = Math.min(da, 2 * Math.PI - da); return r > R + 3 && r < R + 30 && da < 0.32 ? Math.min(h, pondY - 1.5) : h; });
        const P = ctx.painter;
        P.circle(C.x, C.z, R + 8, '#b7b1a6', 'slab'); P.circle(C.x, C.z, R + 3, '#5f6f74', 'none'); P.circle(C.x, C.z, R - 1.5, '#b7b1a6', 'slab'); P.circle(C.x, C.z, R - 5, '#5f8a3e', 'grass');
        // canal water ring + stone edges
        const ringGeo = new THREE.RingGeometry(R - 1.5, R + 3, 160, 1); ringGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({ color: '#4d6f75', roughness: 0.06, metalness: 0.3 }); waterMat.name = 'spot-water';
        const canal = new THREE.Mesh(ringGeo, waterMat); canal.position.set(C.x, meadowY + 0.12, C.z); ctx.add(canal);
        const b = new GeoBatch();
        for (const rr of [R - 1.6, R + 3.1]) { const t = new THREE.TorusGeometry(rr, 0.22, 4, 160); t.rotateX(Math.PI / 2); b.add(t, 'stone', M(C.x, meadowY + 0.25, C.z), '#c9c2b4'); t.dispose(); }
        // waterfall: a 73 m wide curved stepped cascade from the canal down into the reflecting pond
        const wfw = 73 / R; // radians
        for (let k = 0; k < 4; k++) { const rr = R + 3.4 + k * 1.6, y = meadowY - k * 0.8; const arc = new THREE.CylinderGeometry(rr, rr, 0.9, 64, 1, true, -wa + Math.PI / 2 - wfw / 2, wfw); b.add(arc, 'stone', M(C.x, y - 0.45, C.z), '#b0aa9e'); arc.dispose(); }
        ctx.add(b.build('canal-edges'));
        const fallMat = new THREE.MeshStandardMaterial({ color: '#e9f2f4', transparent: true, opacity: 0.8, roughness: 0.3, emissive: '#9fb7bd', emissiveIntensity: 0.15 });
        const fall = new THREE.Mesh(new THREE.CylinderGeometry(R + 3.6, R + 8.6, 3.2, 96, 1, true, -wa + Math.PI / 2 - wfw / 2, wfw), fallMat); fall.position.set(C.x, meadowY - 1.5, C.z); ctx.add(fall);
        const pond = new THREE.Mesh(new THREE.CircleGeometry(30, 48), waterMat); pond.rotation.x = -Math.PI / 2; pond.position.set(C.x + Math.cos(wa) * (R + 18), pondY, C.z + Math.sin(wa) * (R + 18)); ctx.add(pond);
        ctx.onUpdate((dt, s) => { fallMat.opacity = 0.72 + 0.1 * Math.sin(s.t * 7); });
        // WWI memorial elms (1926) in the meadow centre, other park trees around the ring
        const r = rng(26);
        const mem = sp.structures.find((s) => s.id === 'memorial');
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; ctx.trees.push({ x: mem.x + Math.cos(a) * 14, z: mem.z + Math.sin(a) * 14, kind: 'broad', s: 1.35 + r() * 0.2 }); }
        for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, rr = R + 12 + r() * 25; const x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr; let da = Math.abs(a - wa); da = Math.min(da, 2 * Math.PI - da); if (da < 0.4) continue; ctx.trees.push({ x, z, kind: r() < 0.4 ? 'con' : 'broad', s: 0.8 + r() * 0.5 }); }
        const pl = sp.structures.find((s) => s.id === 'piloti');
        piloti(ctx, pl.x, g.heightAt(pl.x, pl.z), pl.z);
        const ds = signBoard('DOWNTOWN PARK', 3.2, 0.5, { bg: '#2f4a36', fg: '#f1ece0', font: (s) => `700 ${s}px Georgia, serif` }); ds.position.set(pl.x - 8, g.heightAt(pl.x - 8, pl.z + 4) + 0.9, pl.z + 4); ds.rotation.y = Math.PI * 0.8; ctx.add(ds);
        ctx.terrainOpts = { bg: '#5f8a3e', innerPx: 2048 };
        for (const a of ctx.data.areas) if ((a.natural === 'water' || a.water) && Math.hypot(...a.poly[0].map((v, i) => v - (i ? C.z : C.x))) < R + 60) ctx.skipAreas.add(a.id); // the canal ring is modelled (OSM multipolygon holes are not in the extract)
        ctx.exclude.push(Array.from({ length: 32 }, (_, i) => [C.x + Math.cos(i / 32 * Math.PI * 2) * (R + 6), C.z + Math.sin(i / 32 * Math.PI * 2) * (R + 6)]));
        ctx.osmBackdrop({ paint: {}, trees: true, areaTreeOpts: { conifer: 0.3 }, streetTreeOpts: { spacing: 10, prob: 0.8 }, style: (bd) => ((bd.h || 0) > 40 ? 'office' : undefined) });
        seattleBackdrop(ctx, { clear: 2000, hazeK: 0.4 });
        addTraffic(ctx, { lanes: [{ pts: [[20, -300], [16, -40], [14, 60], [16, 300]], n: 3, speed: 9 }] });
        // fun: toss a coin into the reflecting pond
        const pc = pond.position;
        ctx.interactables.push({ kind: 'coin', x: pc.x - Math.cos(wa) * 26, z: pc.z - Math.sin(wa) * 26, r: 8, label: 'Toss a coin into the reflecting pond', use: (s) => { s.sound.play('coin'); s.ui.toast('🪙 Plink', 'Make a wish — the waterfall is 240 ft wide.'); } });
        // plaques
        const PL = sp.plaques;
        ctx.plaque(PL[0], C.x + Math.cos(-0.9) * (R + 6), C.z + Math.sin(-0.9) * (R + 6), Math.atan2(C.x - (C.x + Math.cos(-0.9) * (R + 6)), C.z - (C.z + Math.sin(-0.9) * (R + 6))) + Math.PI);
        ctx.plaque(PL[1], pc.x - Math.cos(wa) * 24, pc.z - Math.sin(wa) * 24, Math.atan2(Math.cos(wa), Math.sin(wa)));
        ctx.plaque(PL[2], mem.x + 3, mem.z + 3, Math.PI / 4);
        ctx.plaque(PL[3], pl.x - 5, pl.z + 2, -Math.PI / 2, { credit: 'Piloti © 2023 Marc Fornes / THEVERYMANY — modelled in 3-D from public descriptions.' });
        { const vx = C.x + Math.cos(wa) * (R + 50), vz = C.z + Math.sin(wa) * (R + 50), b = ((Math.atan2(C.x - vx, -(C.z - vz)) * 180 / Math.PI) + 360) % 360; ctx.challenge('bel-downtown-park', { x: vx, z: vz, heading: b, r: 18, tol: 35 }); } // across the pond: waterfall in front, towers behind
        const ringLine = Array.from({ length: 65 }, (_, i) => [C.x + Math.cos(i / 64 * Math.PI * 2) * (R + 5.5), C.z + Math.sin(i / 64 * Math.PI * 2) * (R + 5.5)]);
        ctx.crowdCfg = {
            personas: { local: 5, tech: 3, kid: 2.5, tourist_us: 2, tourist_in: 1.5, tourist_cn: 1.5, tourist_kr: 1, tourist_jp: 1, photographer: 0.6 },
            walkers: 26, paths: [ringLine, ...ctx.footLines()],
            groups: [
                { x: C.x + 20, z: C.z - 10, r: 12, n: 8, act: 'sit', look: [C.x, C.z], personas: ['local', 'tech', 'kid'] },
                { x: pc.x - Math.cos(wa) * 22, z: pc.z - Math.sin(wa) * 22, r: 5, n: 6, act: 'photo', look: [pc.x, pc.z], personas: ['tourist_us', 'tourist_in', 'photographer', 'tourist_kr'] },
                { x: pl.x - 4, z: pl.z + 4, r: 2, n: 3, act: 'watch', look: [pl.x, pl.z], personas: ['tech', 'local', 'kid'] },
                { x: -207, z: 160, r: 8, n: 7, act: 'talk', personas: ['kid', 'local'] },
            ],
        };
        ctx.sound('waterfall', pc.x, pc.z, 110, 1.3); ctx.sound('birds', C.x, C.z, 200, 1); ctx.sound('traffic', 16, 0, 90, 0.6);
        ctx.spawns['bel-downtown-park'] = { x: sp.spawn.x, z: sp.spawn.z, heading: headingFromBearing(sp.spawn.heading_deg) };
        void clamp;
    },
};
