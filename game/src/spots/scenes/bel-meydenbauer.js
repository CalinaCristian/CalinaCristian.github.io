// ============================================================================
//  Meydenbauer Bay Park (reopened 2019): the sandy beach, the 420-ft floating
//  crescent pier curving out over Lake Washington, the pavilion, the wooded
//  ravine behind — and Seattle's skyline small on the horizon ≈ 9 km west.
//  Fun: skip stones from the beach.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, lerp, smooth } from '../kit.js';
import { signBoard } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { bench } from '../osm.js';

const LAKE_Y = -0.5; // Lake Washington surface in the DEM ≈ 5.0–5.2 m NAVD88 (scene datum 5.7 m)

export default {
    env: { fogFar: 9000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-meydenbauer');
        const lake = d.areas.filter((a) => a.natural === 'water' || a.water === 'lake' || a.natural === 'bay').map((a) => a.poly);
        // shoreline from the DEM (≈ 5 m NAVD at the water): everything below 0.1 is lake
        g.mod((x, z, h) => (h < -0.45 ? Math.min(h, LAKE_Y - 2.5) : Math.max(h, LAKE_Y + 0.3)));
        ctx.water(LAKE_Y, { x0: -8000, z0: -8000, x1: 8000, z1: 8000 }, [], { depth: 2.5 }); void lake; // shoreline from the DEM (the OSM lake outline is coarser than the beach here)
        // beach (sand) along the shore near the pier root
        const beach = sp.structures.find((s) => s.id === 'beach');
        ctx.painter.custom((x, T, k, isMask) => { const [cx, cy] = T(beach.x - 30, beach.z); x.fillStyle = isMask ? 'rgb(0,0,120)' : '#d2c09a'; x.beginPath(); x.ellipse(cx, cy, 55 * k, 16 * k, -0.35, 0, 7); x.fill(); });
        // crescent floating pier (128 m), curving out from the beach promenade
        const cp = sp.structures.find((s) => s.id === 'crescent-pier'), b = new GeoBatch();
        const pierW = d.ways.find((w) => w.id === 'w688415225'), arc = pierW ? [...pierW.pts].reverse() : [[48, 16], [42, 32], [23, 53], [-2, 63], [-32, 60], [-59, 44]];
        const { alongPolyline, polylineLength } = await import('../kit.js'); const arcL = polylineLength(arc);
        const Q = (t) => alongPolyline(arc, t * arcL), tip = Q(1);
        for (const id of ['w688415225', 'w687934817']) ctx.skipWays.add(id);
        const deckY = LAKE_Y + 0.75, N = 48, W = 4.2;
        for (let i = 0; i < N; i++) {
            const a = Q(i / N), c = Q((i + 1) / N), L = Math.hypot(c.x - a.x, c.z - a.z), yaw = Math.atan2(c.x - a.x, c.z - a.z), mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
            b.box(mx, deckY - 0.5, mz, W, 0.5, L + 0.05, '#9b9a94', 'concrete', yaw);
            g.addBox(mx, mz, W / 2, L / 2 + 0.05, yaw, deckY - 2, deckY);
            for (const s of [-1, 1]) { const ox = Math.cos(yaw) * (W / 2 - 0.05) * s, oz = -Math.sin(yaw) * (W / 2 - 0.05) * s; b.rod([a.x + ox, deckY + 1.05, a.z + oz], [c.x + ox, deckY + 1.05, c.z + oz], 0.035, '#30363a', 'steel', 5); b.rod([a.x + ox, deckY, a.z + oz], [a.x + ox, deckY + 1.05, a.z + oz], 0.03, '#30363a', 'steel', 4); ctx.collider({ wall: true, ax: a.x + ox, az: a.z + oz, bx: c.x + ox, bz: c.z + oz, y0a: deckY - 2, y1a: deckY + 1.1, y0b: deckY - 2, y1b: deckY + 1.1, nx: 0, nz: 1 }); }
            if (i % 8 === 4) { bench(b, mx, deckY, mz, yaw + Math.PI / 2); }
        }
        // pavilion (restrooms / kayak rental) with a butterfly roof
        const pv = sp.structures.find((s) => s.id === 'pavilion'), py = g.heightAt(pv.x, pv.z);
        b.box(pv.x, py, pv.z, 14, 3.2, 7, '#a9876a', 'wood', 0.4); b.box(pv.x, py + 3.2, pv.z, 17, 0.25, 10, '#3f4549', 'metal', 0.4, 0.06); ctx.box(pv.x, pv.z, 7, 3.5, 0.4);
        ctx.add(b.build('crescent-pier'));
        const sg = signBoard('MEYDENBAUER BAY PARK', 4.6, 0.6, { bg: '#24485a', fg: '#f2efe6', font: (s) => `700 ${s}px Georgia, serif` }); sg.position.set(pv.x + 10, py + 1.2, pv.z - 8); sg.rotation.y = -0.4; ctx.add(sg);
        ctx.terrainOpts = { bg: '#5a7a3a', innerPx: 2048, skirtY: LAKE_Y - 0.4, skirtColor: '#3f5a66' };
        ctx.osmBackdrop({ paint: {}, urban: false, areaTreeOpts: { conifer: 0.5, density: 1 / 50 } });
        // the wooded ravine behind the beach
        const r = rng(4); for (let i = 0; i < 260; i++) { const x = 40 + r() * 160, z = -160 + r() * 150; if (g.heightAt(x, z) < 2) continue; ctx.trees.push({ x, z, kind: r() < 0.55 ? 'con' : 'broad', s: 0.9 + r() * 0.6 }); }
        // Seattle on the horizon (≈ 9 km west across the lake) + Olympics behind
        seattleBackdrop(ctx, { baseY: LAKE_Y - 0.4, clear: 3000, hazeK: 0.45, olympics: true, rainier: true, eyeY: 1.6 });
        // fun: skip stones (count the bounces, wind-dependent)
        ctx.interactables.push({ kind: 'skip', x: beach.x - 40, z: beach.z + 5, r: 14, label: 'Skip a stone', use: (s) => { const w = s.r3d.weather?.windKmh ?? 8, n = Math.max(1, Math.round(3 + Math.random() * 6 - w / 10)); s.sound.play('splat', 0.4); s.ui.toast('🪨 ' + '•'.repeat(n), `${n} skip${n > 1 ? 's' : ''}${n >= 7 ? ' — impressive!' : ''}`); } });
        const PL = sp.plaques;
        ctx.plaque(PL[0], 14, 8, -2.2); ctx.plaque(PL[1], pv.x - 10, pv.z + 6, -2.0); ctx.plaque(PL[2], 40, -10, -2.4);
        // postcard: on the pier near its root, the crescent curving out ahead over the bay, the crescent pier curving out over the bay, marina + Seattle beyond
        const root = Q(0), mid = Q(0.55), back = Q(0.02), dx = root.x - mid.x, dz = root.z - mid.z, dl = Math.hypot(dx, dz) || 1;
        const pcx = root.x + dx / dl * 9, pcz = root.z + dz / dl * 9, pb = (Math.atan2(mid.x - pcx, -(mid.z - pcz)) * 180 / Math.PI + 360) % 360;
        const p0 = Q(0.14), p1 = Q(0.78), pb2 = (Math.atan2(p1.x - p0.x, -(p1.z - p0.z)) * 180 / Math.PI + 360) % 360;
        ctx.challenge('bel-meydenbauer', { view: [p1.x, p1.z], x: p0.x, z: p0.z, heading: pb2, pitch: 1, r: 14, tol: 35, text: 'The crescent pier curving out over Meydenbauer Bay, Seattle on the horizon' });
        void back;
        const pierLine = Array.from({ length: 25 }, (_, i) => { const p = Q(i / 24); return [p.x, p.z]; });
        ctx.crowdCfg = {
            personas: { local: 5, tech: 2, kid: 2.5, tourist_us: 1.5, tourist_in: 1.5, tourist_cn: 1, photographer: 1, staff: 0.3 },
            walkers: 14, paths: [pierLine, ...ctx.footLines()],
            groups: [
                { x: beach.x - 30, z: beach.z, r: 18, n: 9, act: 'sit', look: [-300, 200], personas: ['local', 'kid', 'tech'] },
                { x: tip.x + 2, z: tip.z - 3, r: 1.5, n: 4, act: 'photo', look: [-2000, 300], y: deckY, personas: ['photographer', 'tourist_us', 'tourist_in'] },
                { x: pv.x - 8, z: pv.z + 2, r: 0.3, n: 1, act: 'watch', look: [pv.x - 20, pv.z + 10], personas: ['staff'] },
            ],
        };
        ctx.sound('water', beach.x - 30, beach.z + 10, 120, 1.3); ctx.sound('gulls', -40, 60, 220, 1); ctx.sound('birds', 120, -80, 160, 1);
        ctx.spawns['bel-meydenbauer'] = { x: pcx + dx / dl * 3, z: pcz + dz / dl * 3, heading: headingFromBearing(pb) }; // walk straight onto the pier
        void lerp; void smooth; void M;
    },
};
