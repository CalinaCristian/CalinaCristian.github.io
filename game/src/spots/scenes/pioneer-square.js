// ============================================================================
//  Pioneer Square: Pioneer Place with the 1909 cast-iron pergola (rebuilt
//  2002), the Chief-of-All-Women pole (1940 Tlingit replica, modelled from the
//  research figure list and palette, carvers credited), the Chief Seattle bust fountain, the red-brick
//  Romanesque Pioneer Building, purple vault-light glass in the sidewalks,
//  Occidental Square under its plane trees, and the white terracotta Smith
//  Tower (1914) up Yesler Way. Acorn street lamps throughout.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly, obb } from '../kit.js';
import { signBoard } from '../props.js';
import { meshSDF, sdEllipsoid, sdCapsule, sdSphere, sdBox, smin, smax, fbm3 } from '../sdf.js';
import { seaBackdrop } from './sea-common.js';
import { facadeMaterial, facadeStyle, wallGeometry } from '../osm.js';
import { addTraffic } from '../cars.js';

// ---------------------------------------------------------------------------- the Chief-of-All-Women pole (1940 replica)
/**
 * Modelled from the research dossier (game/research/pioneer-totem.md: Garfield 1996 pp. 15–17 via Wikipedia): western red
 * cedar, ≈ 15.2 m × 1.37 m, deep relief; figures top → bottom: Raven with the crescent moon in his beak; a woman holding
 * her frog child; her frog husband; Mink; Raven; Whale holding a seal; Raven-at-the-Head-of-Nass. Paint only in the
 * Tlingit palette — black formline, red (lips, nostrils, secondary lines), blue-green (eye sockets, tertiary) — on
 * unpainted weathered grey-brown cedar. Local frame: front = +z, y up from the base.
 */
function totemFigures() {
    const F = []; // {kind, y0, y1}
    const R = 0.56; // core radius (4.5 ft wide incl. relief)
    const parts = []; // painted / projecting features: {d: (x,y,z)=>dist, col}
    const BLACK = '#17150f', RED = '#a3261d', BG = '#2f6b66', CEDAR = '#8a7a66';
    const face = (yc, s = 1, o = {}) => { // a formline face on the front at height yc (scale s): brows, eye sockets + eyes, nostrils, mouth
        const zf = R * 0.92;
        for (const sx of [-1, 1]) {
            parts.push({ col: BLACK, d: (x, y, z) => sdCapsule(x, y, z, sx * 0.06 * s, yc + 0.28 * s, zf + 0.05, sx * 0.36 * s, yc + 0.24 * s, zf - 0.02, 0.045 * s) }); // brow
            parts.push({ col: BG, d: (x, y, z) => sdEllipsoid(x, y, z, sx * 0.21 * s, yc + 0.1 * s, zf + 0.02, 0.15 * s, 0.09 * s, 0.05) }); // socket
            parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, sx * 0.21 * s, yc + 0.1 * s, zf + 0.06, 0.08 * s, 0.05 * s, 0.035) }); // eye
        }
        if (!o.beak) {
            parts.push({ col: CEDAR, d: (x, y, z) => sdEllipsoid(x, y, z, 0, yc - 0.08 * s, zf + 0.06, 0.09 * s, 0.17 * s, 0.11) }); // nose
            parts.push({ col: RED, d: (x, y, z) => sdEllipsoid(x, y, z, 0, yc - 0.22 * s, zf + 0.06, 0.12 * s, 0.035 * s, 0.05) }); // nostrils band
            parts.push({ col: RED, d: (x, y, z) => sdEllipsoid(x, y, z, 0, yc - 0.38 * s, zf + 0.03, (o.wide ? 0.42 : 0.24) * s, 0.06 * s, 0.06) }); // lips
            parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, 0, yc - 0.38 * s, zf + 0.07, (o.wide ? 0.36 : 0.18) * s, 0.018 * s, 0.03) }); // mouth line
        }
        for (const sx of [-1, 1]) parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, sx * 0.5 * s, yc + 0.12 * s, zf * 0.55, 0.06, 0.14 * s, 0.12) }); // ears / side ovoids
    };
    const beak = (yc, len, down = 0.25, col = BLACK) => parts.push({ col, d: (x, y, z) => sdCapsule(x, y, z, 0, yc, R * 0.8, 0, yc - down, R + len, 0.17, 0.05) });
    const wings = (y0, y1, col = BLACK) => { for (const sx of [-1, 1]) parts.push({ col, d: (x, y, z) => sdEllipsoid(x, y, z, sx * R * 0.86, (y0 + y1) / 2, 0.12, 0.13, (y1 - y0) / 2, 0.5) }); };
    // 1 top: Raven with the crescent moon in his beak (12.3–15.2)
    face(14.0, 1.0, { beak: true }); beak(13.75, 0.85, 0.2); wings(12.5, 14.6);
    parts.push({ col: '#e9e2cf', d: (x, y, z) => smax(sdSphere(x, y, z, 0, 13.4, R + 0.68, 0.22), -sdSphere(x, y, z, 0, 13.47, R + 0.78, 0.2), 0.02) }); // crescent moon (white? paint: keep pale)
    // 2: the woman holding her frog child (10.1–12.3)
    face(11.75, 0.92); for (const sx of [-1, 1]) parts.push({ col: CEDAR, d: (x, y, z) => sdCapsule(x, y, z, sx * 0.48, 11.25, R * 0.75, sx * 0.12, 10.65, R + 0.2, 0.08) }); // arms
    parts.push({ col: BG, d: (x, y, z) => sdEllipsoid(x, y, z, 0, 10.55, R + 0.18, 0.22, 0.2, 0.18) }); // frog child body
    parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, 0, 10.62, R + 0.33, 0.12, 0.05, 0.04) });
    // 3: the frog husband — wide mouth, no ears, squat legs (8.4–10.1)
    face(9.45, 1.05, { wide: true }); for (const sx of [-1, 1]) parts.push({ col: BG, d: (x, y, z) => sdCapsule(x, y, z, sx * 0.45, 8.95, R * 0.7, sx * 0.25, 8.55, R + 0.12, 0.1) });
    // 4: Mink — smaller face, long body down the front (7.0–8.4)
    face(8.0, 0.75); parts.push({ col: CEDAR, d: (x, y, z) => sdCapsule(x, y, z, 0, 7.6, R + 0.08, 0, 7.1, R + 0.1, 0.13) });
    // 5: Raven (second) — beak pointing down onto the whale (5.2–7.0)
    face(6.5, 0.95, { beak: true }); beak(6.2, 0.55, 0.55); wings(5.3, 6.6);
    // 6: Whale holding a seal in its mouth (3.0–5.2): blowhole face on top, pectoral fins, the seal across the jaws
    face(4.6, 1.05, { wide: true }); for (const sx of [-1, 1]) parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, sx * (R + 0.18), 3.7, 0.22, 0.1, 0.42, 0.32) }); // fins
    parts.push({ col: CEDAR, d: (x, y, z) => sdCapsule(x, y, z, -0.42, 4.17, R + 0.12, 0.42, 4.17, R + 0.12, 0.12, 0.09) }); // the seal
    parts.push({ col: BLACK, d: (x, y, z) => sdEllipsoid(x, y, z, -0.3, 4.24, R + 0.22, 0.04, 0.04, 0.03) });
    // 7 bottom: Raven-at-the-Head-of-Nass — the large face at the base with a short (restored) beak (0.3–3.0)
    face(2.1, 1.35, { beak: true }); beak(1.75, 0.35, 0.3, BLACK);
    parts.push({ col: RED, d: (x, y, z) => sdEllipsoid(x, y, z, 0, 1.0, R + 0.02, 0.45, 0.08, 0.06) }); // lips under the beak
    for (const sx of [-1, 1]) parts.push({ col: CEDAR, d: (x, y, z) => sdCapsule(x, y, z, sx * 0.42, 0.95, R * 0.8, sx * 0.3, 0.35, R * 0.9, 0.13) }); // knees / hands
    // figure dividers: slightly recessed grooves between the figures
    const cuts = [3.0, 5.2, 7.0, 8.4, 10.1, 12.3];
    const sdf = (x, y, z) => {
        const r = Math.hypot(x, z * 1.05);
        let d = r - R * (1 - 0.05 * Math.min(1, y / 15)); // the trunk, slightly tapering
        d = smax(d, y - 15.25, 0.1); d = smax(d, -y, 0.02);
        for (const c of cuts) d = smax(d, 0.05 - Math.hypot(r - R, y - c) , 0.03); // grooves
        for (const p of parts) d = smin(d, p.d(x, y, z), 0.06);
        d += 0.012 * (fbm3(x * 9, y * 3, z * 9) - 0.5); // adze texture
        return d;
    };
    const col = (x, y, z, out) => {
        let best = null, bd = 0.035; for (const p of parts) { const v = p.d(x, y, z); if (v < bd) { bd = v; best = p; } }
        const g = fbm3(x * 4, y * 1.5, z * 4); // weathered silvery cedar, darker grain lines
        out.set(best && best.col !== CEDAR ? best.col : CEDAR);
        if (!best || best.col === CEDAR) out.lerp(new THREE.Color('#a39a8c'), 0.35 * g).multiplyScalar(0.85 + 0.25 * g);
        else out.multiplyScalar(0.88 + 0.2 * g); // paint weathered too
        return out;
    };
    return { sdf, col };
}
function buildTotem(ctx, x, y, z, yaw) {
    const t0 = performance.now(), T = totemFigures();
    const geo = meshSDF(T.sdf, { min: [-1.5, -0.1, -1.2], max: [1.5, 15.4, 2.0], cell: 0.05, ao: 0.12, lipschitz: 2.2, color: (px, py, pz, nx, ny, nz, ao, o) => T.col(px, py, pz, o).multiplyScalar(0.62 + 0.38 * ao) });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })); m.name = 'totem-pole'; m.castShadow = true; m.receiveShadow = true;
    m.position.set(x, y, z); m.rotation.y = yaw; ctx.add(m);
    // concrete footing ring
    const b = new GeoBatch(); b.cyl(x, y - 0.1, z, 1.0, 0.22, '#9a958b', 'concrete', 24); ctx.add(b.build('totem-footing'));
    ctx.circle(x, z, 0.75, 15.2);
    ctx.extras.totem = { ms: Math.round(performance.now() - t0), tris: geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3 };
    return m;
}

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
        buildTotem(ctx, to.x, g.heightAt(to.x, to.z), to.z, Math.atan2(cs.x - to.x, cs.z - to.z) * 0 + Math.PI * 0.9); // faces 1st Ave / the plaza (south-west)
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
        ctx.extras.seaBackdrop = seaBackdrop(ctx, { clear: 330, rainier: false, olympics: false, bay: false, ferries: false, cranes: false, midrise: 500, midClear: 420, midBox: [47.596, -122.34, 47.612, -122.318] });
        addTraffic(ctx, { lanes: [{ pts: [[6, 272], [5, 179], [5, 85], [5, 30], [6, -8], [5, -84], [0, -94], [-12, -106], [-56, -178]], n: 3, speed: 8 }, { pts: [[-56, -178], [-12, -106], [-2, -84], [-2, -8], [-3, 85], [-4, 178], [-3, 248]].map(([x, z]) => [x - 1, z]), n: 3, speed: 8 }, { pts: [[-97, -9], [-2, -8], [45, -8], [151, -8], [247, -7]], n: 2, speed: 8 }] });
        // plaques around Pioneer Place
        const PL = sp.plaques;
        ctx.plaque(PL[0], per.cx - 5, per.cz + 6, Math.PI * 1.1); ctx.plaque(PL[1], -10, -16, Math.PI / 2); ctx.plaque(PL[2], 14, 10, -Math.PI / 2);
        ctx.plaque(PL[3], 150, -20, -Math.PI / 2, { credit: 'Smith Tower (1914): Gaggin & Gaggin.' }); ctx.plaque({ ...PL[4], title: 'Chief-of-All-Women pole (replica)', text: 'Carved 1939–40 at Saxman, Alaska, by Tlingit carvers led by Charles Brown, among them members of the Kinninook family, for whom the original was carved about 1790 at Tongass Island to honour Chief-of-All-Women. The original was taken without consent by a Seattle business excursion in 1899 and burned in 1938. Figures, top to bottom: Raven with the moon; a woman holding her frog child; her frog husband; Mink; Raven; Whale holding a seal; Raven-at-the-Head-of-Nass.' }, to.x - 2.2, to.z + 2.5, Math.PI * 0.9, { credit: 'Restored 1972 by Tsimshian carver John C. Hudson Jr. National Historic Landmark (1977). Modelled respectfully in 3-D from published descriptions (Garfield, The Seattle Totem Pole).' });
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
