// ============================================================================
//  Pioneer Square: Pioneer Place with the 1909 cast-iron pergola (rebuilt
//  2002), the Tlingit-style totem pole (1938–40 replica; stylised here, no
//  reproduced carving), the Chief Seattle bust fountain, the red-brick
//  Romanesque Pioneer Building, purple vault-light glass in the sidewalks,
//  Occidental Square under its plane trees, and the white terracotta Smith
//  Tower (1914) up Yesler Way. Acorn street lamps throughout.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, obb } from '../kit.js';
import { totemPole, signBoard } from '../props.js';
import { facadeMaterial, facadeStyle, wallGeometry } from '../osm.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';

function buildPergola(ctx) {
    const a = ctx.data.areas.find((x) => x.id === 'w52782041'), g = ctx.ground, b = new GeoBatch();
    const poly = a ? a.poly : [[11, -22], [24, -19], [17, -30]];
    const [cx, cz] = centroid(poly), y0 = g.heightAt(cx, cz), H = 4.9, iron = '#1e2a25', glass = '#b9d0d6';
    // columns along the outline every ~2.6 m (fluted cast iron, capitals), ornamental frieze, hipped glass roof to an apex
    const ring = []; for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 2.6)); for (let k = 0; k < n; k++) ring.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
    for (const [x, z] of ring) { b.cyl(x, y0, z, 0.13, H - 0.9, iron, 'metal', 10); b.cyl(x, y0, z, 0.22, 0.5, iron, 'metal', 10); b.cyl(x, y0 + H - 1.05, z, 0.24, 0.25, iron, 'metal', 10, 1.4); ctx.circle(x, z, 0.16, H); }
    for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length]; b.rod([ax, y0 + H - 0.8, az], [bx, y0 + H - 0.8, bz], 0.09, iron, 'metal', 6); b.rod([ax, y0 + H - 0.55, az], [bx, y0 + H - 0.55, bz], 0.06, iron, 'metal', 6);
        for (let t = 0.1; t < 1; t += 0.2) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t; b.sphere(px, y0 + H - 0.67, pz, 0.08, 0.08, 0.08, iron, 'metal', 6, 4); } } // frieze rosettes
    // roof: glass panes from the eave ring up to a central apex (+1.6 m), iron ribs, cresting
    const apex = [cx, y0 + H + 1.4, cz];
    const roof = new THREE.BufferGeometry(), pos = [];
    for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length]; pos.push(ax, y0 + H - 0.5, az, bx, y0 + H - 0.5, bz, ...apex); b.rod([ax, y0 + H - 0.5, az], apex, 0.05, iron, 'metal', 5); }
    roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roof.computeVertexNormals();
    const rm = new THREE.Mesh(roof, new THREE.MeshStandardMaterial({ color: glass, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false })); rm.name = 'pergola-glass'; ctx.add(rm);
    b.cyl(apex[0], apex[1] - 0.2, apex[2], 0.12, 1.1, iron, 'metal', 8, 0.3); // finial
    // lamp globes on top of three columns (the pergola's own lamps)
    for (const [x, z] of [poly[0], poly[Math.floor(poly.length / 3)], poly[Math.floor(poly.length * 2 / 3)]]) { b.cyl(x, y0 + H - 0.5, z, 0.05, 1.0, iron, 'metal', 6); b.sphere(x, y0 + H + 0.65, z, 0.22, 0.22, 0.22, '#fff1cf', 'glow', 10, 8); ctx.lampPoints.push({ x, z, h: H + 0.6, noPost: true }); }
    // bollards around it (the 2001 truck accident)
    for (let i = 0; i < ring.length; i += 2) { const [x, z] = ring[i], dx = x - cx, dz = z - cz, L = Math.hypot(dx, dz) || 1; const bx = x + dx / L * 1.2, bz = z + dz / L * 1.2; b.cyl(bx, g.heightAt(bx, bz), bz, 0.14, 0.9, '#1e2a25', 'metal', 8); ctx.circle(bx, bz, 0.15, 0.9); }
    ctx.add(b.build('pergola'));
    return { cx, cz, y0 };
}
function buildSmithTower(ctx) {
    const st = ctx.data.buildings.find((x) => x.id === 'w52781661'); if (!st) return null;
    ctx.skipBuildings.add(st.id);
    const g = ctx.ground, o = obb(st.poly), y0 = Math.min(...st.poly.map(([x, z]) => g.heightAt(x, z))) - 0.3;
    const cream = '#ece6d6', b = new GeoBatch(), S = facadeStyle('concrete');
    const wb = wallGeometry(st.poly, y0, y0 + 75, S, y0, cream); b.add(wb, 'f-concrete', null, cream);
    b.flat(st.poly, y0 + 75, '#cfc7b6', 'roofs');
    // the tower shaft (≈ 15 × 15 m) rising to 140.8 m, then the pyramid to 147.5 m with the glass globe
    const tw = 15.5, cx = o.cx, cz = o.cz, sq = (s) => [[cx - s, cz - s], [cx + s, cz - s], [cx + s, cz + s], [cx - s, cz + s]].map(([x, z]) => { const dx = x - cx, dz = z - cz; return [cx + dx * Math.cos(o.angle) - dz * Math.sin(o.angle), cz + dx * Math.sin(o.angle) + dz * Math.cos(o.angle)]; });
    const shaft = wallGeometry(sq(tw / 2), y0 + 75, y0 + 136, S, y0 + 75, cream); b.add(shaft, 'f-concrete', null, cream);
    b.box(cx, y0 + 136, cz, tw + 1.2, 2.2, tw + 1.2, cream, 'stone', -o.angle);
    b.add(new THREE.ConeGeometry(tw * 0.74, 9.5, 4, 1), 'paint', M(cx, y0 + 138.2 + 4.75, cz, 0, Math.PI / 4 - o.angle, 0), '#e9e3d2');
    b.sphere(cx, y0 + 148.3, cz, 0.9, 0.9, 0.9, '#a8d0e6', 'glass', 12, 8);
    ctx.add(b.build('smith-tower', { matOverrides: { 'f-concrete': facadeMaterial('concrete') } }));
    ctx.poly(st.poly);
    const sg = signBoard('SMITH TOWER', 3.6, 0.6, { bg: '#2b2b2b', fg: '#e8d9a8', font: (s) => `700 ${s}px Georgia, serif` });
    const [px, pz] = st.poly[0]; sg.position.set(px, y0 + 4.8, pz); sg.rotation.y = Math.PI; ctx.add(sg);
    return { cx, cz };
}

export default {
    env: { fogFar: 4000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('pioneer-square');
        ctx.terrainOpts = { bg: '#8c8578', bgMask: 'slab', innerPx: 2048 };
        const per = buildPergola(ctx);
        buildSmithTower(ctx);
        // totem pole + Chief Seattle bust fountain
        const tb = new GeoBatch();
        const to = sp.structures.find((s) => s.id === 'totem'), cs = sp.structures.find((s) => s.id === 'chief-seattle');
        totemPole(tb, to.x, g.heightAt(to.x, to.z), to.z, 15.2, 0.3, { seed: 5 }); ctx.circle(to.x, to.z, 0.5, 15);
        { const y = g.heightAt(cs.x, cs.z); tb.cyl(cs.x, y, cs.z, 0.9, 0.9, '#7d7a72', 'stone', 16); tb.cyl(cs.x, y + 0.9, cs.z, 0.45, 1.1, '#6f6b63', 'stone', 12); tb.sphere(cs.x, y + 2.25, cs.z, 0.32, 0.4, 0.3, '#4a3a26', 'bronze', 12, 10); tb.sphere(cs.x, y + 1.95, cs.z, 0.45, 0.25, 0.32, '#4a3a26', 'bronze', 12, 8); ctx.circle(cs.x, cs.z, 0.95, 2.5); }
        ctx.add(tb.build('totem-bust'));
        // purple vault lights (amethyst glass prisms) in the 1st Ave / Yesler sidewalks
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; const r = rng(3); for (const [x0, z0, x1, z1] of [[8, -60, 12, -20], [-12, -40, -8, -12], [14, 2, 18, 40]]) for (let px = x0; px < x1; px += 0.45) for (let pz = z0; pz < z1; pz += 0.45) { if (r() < 0.25) continue; const [a, b] = T(px, pz); x.fillStyle = r() < 0.7 ? '#7d5aa6' : '#9b7cc4'; x.fillRect(a, b, Math.max(1, 0.3 * k), Math.max(1, 0.3 * k)); } });
        ctx.exclude.push([[per.cx - 32, per.cz - 40], [per.cx + 32, per.cz - 40], [per.cx + 32, per.cz + 30], [per.cx - 32, per.cz + 30]].map(([x, z]) => [x, z])); // keep Pioneer Place open (no street trees)
        ctx.osmBackdrop({ paint: {}, style: (bd) => ((bd.h || 0) > 60 ? 'office' : 'brick'), lampOpts: { kinds: ['primary', 'secondary', 'tertiary', 'residential'] }, streetTreeOpts: { spacing: 14, prob: 0.45 } });
        ctx.lampOpts = { style: 'acorn', color: '#1c2a24', h: 4.6 };
        // Occidental Square: big London plane trees on the brick square
        { const sq = d.areas.find((a) => a.id === 'w174692555'); if (sq) { const bb = polyBox(sq.poly), r = rng(6); for (let i = 0; i < 26; i++) { const x = bb.x0 + 5 + r() * (bb.x1 - bb.x0 - 10), z = bb.z0 + 5 + r() * (bb.z1 - bb.z0 - 10); ctx.trees.push({ x, z, kind: 'broad', s: 1.25 + r() * 0.35 }); } ctx.painter.poly(sq.poly, '#9a5a44', 'brick'); } }
        // storefront signs
        const signs = [['UNDERGROUND TOUR', -13, -2, Math.PI / 2, '#3a1f12', '#f3d38a'], ["MERCHANT'S CAFE", 52, 12, -Math.PI / 2, '#1d3a2b', '#f2ead2']];
        for (const [t, x, z, yaw, bg, fg] of signs) { const s2 = signBoard(t, 3.4, 0.55, { bg, fg, font: (q) => `700 ${q}px Georgia, serif`, glow: 0.05, night: 1.2 }); s2.position.set(x, g.heightAt(x, z) + 3.6, z); s2.rotation.y = yaw; ctx.add(s2); }
        seattleBackdrop(ctx, { coreTowers: 50, clear: 320, rainier: false });
        addTraffic(ctx, { lanes: [{ pts: [[6, 272], [5, 179], [5, 85], [5, 30], [6, -8], [5, -84], [0, -94], [-12, -106], [-56, -178]], n: 3, speed: 8 }, { pts: [[-56, -178], [-12, -106], [-2, -84], [-2, -8], [-3, 85], [-4, 178], [-3, 248]].map(([x, z]) => [x - 1, z]), n: 3, speed: 8 }, { pts: [[-97, -9], [-2, -8], [45, -8], [151, -8], [247, -7]], n: 2, speed: 8 }] });
        // plaques around Pioneer Place
        const PL = sp.plaques;
        ctx.plaque(PL[0], per.cx - 5, per.cz + 6, Math.PI * 1.1); ctx.plaque(PL[1], -10, -16, Math.PI / 2); ctx.plaque(PL[2], 14, 10, -Math.PI / 2);
        ctx.plaque(PL[3], 150, -20, -Math.PI / 2, { credit: 'Smith Tower (1914): Gaggin & Gaggin.' }); ctx.plaque(PL[4], to.x - 2.2, to.z + 2.5, Math.PI * 0.9);
        ctx.challenge('pioneer-square', { r: 10, tol: 30 });
        ctx.crowdCfg = {
            personas: { local: 4, tourist_us: 4, tech: 1.5, guide: 0.8, tourist_cn: 1, tourist_kr: 1, tourist_jp: 1, tourist_de: 1.2, tourist_es: 1, tourist_ca: 1, tourist_in: 1, kid: 0.8 },
            walkers: 32, paths: ctx.footLines(),
            groups: [
                { x: per.cx + 3, z: per.cz + 9, r: 3, n: 8, act: 'watch', look: [per.cx, per.cz], personas: ['tourist_us', 'tourist_de', 'tourist_cn', 'tourist_jp', 'tourist_ca'] },
                { x: per.cx + 7, z: per.cz + 11, r: 0.3, n: 1, act: 'guide', look: [per.cx + 3, per.cz + 9], personas: ['guide'], prop: 'flag' },
                { x: to.x + 3, z: to.z + 4, r: 1.5, n: 3, act: 'photo', look: [to.x, to.z], personas: ['tourist_us', 'tourist_kr', 'photographer'] },
                { line: [[-14, -2], [-14, 4], [-14, 10], [-14, 16]], n: 8, act: 'queue', personas: ['tourist_us', 'tourist_es', 'tourist_in', 'kid', 'tourist_de'] },
                { x: 80, z: 130, r: 8, n: 8, act: 'talk', personas: ['local', 'tech', 'tourist_us'] },
            ],
        };
        ctx.sound('crowd', per.cx, per.cz, 60, 0.9); ctx.sound('traffic', 0, -8, 80, 0.8); ctx.sound('crows', 80, 130, 120, 1); ctx.sound('bell', 180, -40, 300, 0.5);
        ctx.spawns['pioneer-square'] = { x: sp.spawn.x + 1, z: sp.spawn.z + 4, heading: headingFromBearing(sp.spawn.heading_deg) };
        void inPoly;
    },
};
