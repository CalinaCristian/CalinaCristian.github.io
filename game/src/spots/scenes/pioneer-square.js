// ============================================================================
//  Pioneer Square: Pioneer Place with the 1909 cast-iron pergola (rebuilt
//  2002), the Chief-of-All-Women pole (1940 Tlingit replica, modelled from the
//  research figure list and palette, carvers credited), the Chief Seattle bust fountain, the red-brick
//  Romanesque Pioneer Building, purple vault-light glass in the sidewalks,
//  Occidental Square under its plane trees, and the white terracotta Smith
//  Tower (1914) up Yesler Way. Acorn street lamps throughout.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, headingFromBearing, centroid, polyBox, inPoly } from '../kit.js';
import { signBoard, totemPole } from '../props.js';
import { buildShopSigns } from './pike-place-shops.js';
import { photoHunt } from '../photo-hunt.js';
import { meshSDF, sdEllipsoid, sdCapsule, sdSphere, sdBox, smin, smax, fbm3 } from '../sdf.js';
import { seaBackdrop, seaActivity } from './sea-common.js';
import { addTraffic } from '../cars.js';
import { LANDMARKS, buildLandmark } from '../../landmarks.js';
import { FRONTS, buildFronts, OCC_CANOPY, occidentalSquareProps } from './pioneer-square-fronts.js';
import { playgroundKit } from '../playground-kit.js';
import { westEndStreets } from './pioneer-square-westend.js';
import { colmanDock, colmanFurniture } from './pioneer-square-colman.js';
import { FRONTS_OSM, smithTowerBase, merchantsCafeSign } from './pioneer-square-backfronts.js';

// ---------------------------------------------------------------------------- the Chief-of-All-Women pole (1940 replica)
/**
 * Modelled from the research dossier (game/research/seattle-spots.md, "The totem pole": Garfield 1996 pp. 15–17 via Wikipedia): western red
 * cedar, ≈ 15.2 m × 1.37 m, deep relief; figures top → bottom: Raven with the crescent moon in his beak; a woman holding
 * her frog child; her frog husband; Mink; Raven; Whale holding a seal; Raven-at-the-Head-of-Nass. Paint only in the
 * Tlingit palette — black formline, red (lips, nostrils, secondary lines), blue-green (eye sockets, tertiary) — on
 * unpainted weathered grey-brown cedar. Local frame: front = +z, y up from the base.
 */
function totemFigures() {
    const F = []; // {kind, y0, y1}
    const R = 0.56; // core radius (4.5 ft wide incl. relief)
    const parts = []; // painted / projecting features: {d: (x,y,z)=>dist, col}
    const BLACK = '#121110', RED = '#a8231b', BG = '#2a6a64', CEDAR = '#6b5a49';
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
        let d = r - R * (1 - 0.05 * Math.min(1, y / 15)) * (z < 0 ? 0.9 : 1); // the trunk, slightly tapering, back flattened
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
        if (!best || best.col === CEDAR) out.lerp(new THREE.Color('#8f8577'), 0.3 * g).multiplyScalar(0.8 + 0.25 * g);
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
    const lm=LANDMARKS.find(l=>l.id==='smith'),st=ctx.data.buildings.find(x=>x.id==='w52781661');if(!st)return null;
    for(const id of lm.sourceIds)ctx.skipBuildings.add(id);
    const p=ctx.ll(lm.lat,lm.lon),y0=Math.min(...st.poly.map(([x,z])=>ctx.ground.heightAt(x,z)))-.3,model=buildLandmark(lm,{realScale:true});
    model.mesh.position.set(p.x,y0,p.z);ctx.add(model.mesh);ctx.poly(st.poly);
    return {cx:p.x,cz:p.z,y0,surface:{source:st.id,poly:st.poly,holes:st.holes||[],bottom:y0,top:y0+st.h}};
}

// ---------------------------------------------------------------------------- businesses (OpenStreetMap)
// The extract of 2026-11-06 checked against the live database on 2026-11-12: seven are now mapped as closed
// (`disused:*`) and get no sign; three are new. Each sign goes on the wall of its own building nearest to its mapped point.
const CLOSED = new Set(['n2351695509', 'n2351695585', 'n2351695606', 'n2351695730', 'n2351700811', 'n2354406522', 'n4626879391']); // Woven Art, Luigi's, The Underground Gallery, Revolution Books, Flame Catering Cafe, Tobacco Patch, Comedy Underground
const LIVE = [['Sam Day Studio & Gallery', -78.3, 191.7, 'shop'], ["Cookie's Country Chicken", 213.2, 239.2, 'restaurant'], ['Good Bar', 215, 166.6, 'bar']];
function pioneerBusinesses(d) {
    const FOOD = /^(restaurant|cafe|fast_food|bar|pub|ice_cream|nightclub)$/, out = [];
    const kindOf = (p) => (p.shop ? 'shop' : FOOD.test(p.amenity || '') ? (p.amenity === 'nightclub' ? 'bar' : p.amenity) : p.craft ? 'shop' : /^(hotel|gallery|guest_house)$/.test(p.tourism || '') ? p.tourism : p.leisure === 'fitness_centre' ? 'shop' : /Underground Tour|Beneath the Streets/.test(p.name || '') ? 'shop' : null);
    for (const p of d.pois || []) { const k = p.name && !CLOSED.has(p.id) && kindOf(p), lv = parseFloat(p.level) || 0; if (k && lv < 5) out.push({ id: p.id, name: p.name, x: p.x, z: p.z, kind: k, level: lv }); }
    for (const b of d.buildings || []) { const k = b.name && !b.part && kindOf(b); if (k) { const [x, z] = centroid(b.poly); out.push({ id: b.id, name: b.name, x, z, kind: k, level: 0 }); } }
    LIVE.forEach(([name, x, z, kind], i) => out.push({ id: 'live' + i, name, x, z, kind, level: 0 }));
    return out;
}
// Occidental Square (OSM nodes 3211770100–103 and 2998927033): Duane Pasco's four cedar carvings at their mapped places and
// tagged heights (35 ft, 12 ft, 13 ft, 13 ft), and Hai Ying Wu's Fallen Fire Fighters' Memorial (four bronze firefighters).
// Stylised from the tags' descriptions (carved, painted cedar; no photo, no copied design).
function occidentalArt(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), node = (id) => d.pois.find((p) => p.id === id);
    for (const [id, h, seed] of [['n3211770100', 10.7, 3], ['n3211770101', 3.7, 5], ['n3211770102', 4.0, 7], ['n3211770103', 4.0, 9]]) { const p = node(id); if (!p) continue; totemPole(b, p.x, g.heightAt(p.x, p.z), p.z, h, Math.PI, { seed }); ctx.circle(p.x, p.z, 0.5, h); }
    const m = node('n2998927033');
    if (m) { const y = g.heightAt(m.x, m.z), BR = '#4a3a26';
        for (let i = 0; i < 4; i++) { const x = m.x + [-1.6, -0.5, 0.7, 1.7][i], z = m.z + [0.4, -0.5, 0.3, -0.4][i], lean = [0.25, 0.1, -0.15, 0.3][i];
            b.cyl(x, y, z, 0.24, 1.25, BR, 'bronze', 8, 0.8, lean); b.sphere(x, y + 1.45, z + lean * 0.5, 0.15, 0.17, 0.15, BR, 'bronze', 8, 6); b.cyl(x, y + 1.5, z + lean * 0.5, 0.2, 0.12, BR, 'bronze', 8, 0.5); }
        for (const [dx, dz, w] of [[-2.6, 1.6, 1.8], [2.4, 1.4, 1.5], [0.2, -2.0, 2.2]]) b.box(m.x + dx, y, m.z + dz, w, 0.45, 0.8, '#77736b', 'stone', 0.3);
        ctx.circle(m.x, m.z, 2.4, 1.8); }
    ctx.add(b.build('occidental-art'));
}

// ---------------------------------------------------------------------------- the west end: Alaskan Way, Colman Dock, Elliott Bay
// The spot extract ends at Western Ave; beyond it the scene was flat grey ground to the horizon. From the live OSM database
// (2026-11-12, scene metres, rounded): the coastline (way 1464900126: the seawall, Colman Dock and Pier 48 as land), the
// two Alaskan Way roadways (ways 223785010 + 835645674 and 1321962096 + 1321962090) and the two ferry buildings (way
// 1154870285 Washington State Ferries Terminal, 2 levels; way 226321140 Water Taxi / Fast Ferries Terminal, 1 level).
// Street View (Yesler Way at Post Ave, 47.60172,-122.33578, looking west): the signalled Alaskan Way crossing, trees and the
// dock beyond, open sky over the bay; no viaduct. The buildings are plain volumes on their footprints (heights from the
// level counts), the dock's surface and the bay level are estimates.
const COAST = [[-362, -208], [-320, -208], [-297, -172], [-305, -167], [-301, -162], [-307, -159], [-310, -155], [-383, -155], [-392, -149], [-393, -35], [-381, -35], [-381, 10], [-352, 10], [-350, 14], [-342, 14], [-341, 17], [-316, 15], [-311, 26], [-273, 26], [-265, 27], [-266, 20], [-213, 20], [-214, 14], [-191, 14], [-198, 20], [-217, 31], [-223, 34], [-218, 43], [-217, 56], [-213, 71], [-220, 75], [-214, 82], [-204, 82], [-194, 83], [-177, 83], [-159, 80], [-155, 97], [-199, 95], [-200, 137], [-406, 137], [-409, 140], [-409, 211], [-407, 214], [-242, 215], [-217, 224], [-203, 235], [-204, 250], [-230, 246], [-243, 262], [-242, 287], [-436, 286]];
const ALASKAN = [[[-147, -6], [-155, -20], [-189, -77], [-199, -94], [-205, -102], [-240, -159], [-252, -169]], [[-160, -3], [-171, -21], [-202, -73], [-209, -88], [-215, -99], [-249, -154], [-252, -169], [-273, -204]]];
const WSF = [[-259, -82], [-246, -90], [-275, -138], [-285, -154], [-293, -167], [-307, -159], [-299, -146], [-290, -132], [-269, -99]], TAXI = [[-267, 25], [-310, 25], [-317, 14], [-221, 13], [-215, 11], [-215, 18], [-267, 18]];
function buildWestEnd(ctx) {
    const g = ctx.ground, SEA = -6.9, land = [[-362, -900], ...COAST, [-436, 900], [3000, 900], [3000, -900]];
    const wet = (x, z) => x < -185 && !inPoly(x, z, land);
    g.mod((x, z, h) => (wet(x, z) ? SEA - 4 : x < -185 ? Math.min(h, SEA + 3.4) : h)); // the dock and the seawall top stand about 3.4 m over the water
    return { wet, finish() {
        // round 3: the streets, crossings, beds, trees and signals from live OSM (pioneer-square-westend.js) replace the two
        // approximate Alaskan Way bands (ALASKAN, kept above for reference)
        ctx.extras.westEnd = westEndStreets(ctx);
        // the terminals (panorama 96BnTtZETD_9PxJd3_oy9w looking 250°: the 2023 WSF terminal is a glazed ground floor under a
        // timber-slatted upper storey and a dark flat roof; the Water Taxi terminal a low grey shed). Level splits estimated.
        const b = new GeoBatch();
        { const y = Math.min(...WSF.map(([x, z]) => g.heightAt(x, z))); b.prism(WSF, y - 0.5, y + 4.2, '#2f3b44', 'darkglass', { noTop: true }); b.prism(WSF, y + 4.2, y + 8.4, '#a8835c', 'wood', { noTop: true }); b.prism(WSF, y + 8.4, y + 9, '#3a3d40', 'metal'); ctx.poly(WSF); }
        void TAXI; ctx.extras.colmanDock = colmanDock(ctx); // (r3-sea-spots-b-3) the Water Taxi shed on its OSM outline, its pier block, the WSF canopy / stairs, the slips (pioneer-square-colman.js)
        ctx.add(b.build('colman-dock'));
    } };
}

// ---------------------------------------------------------------------------- Pioneer Building (1892, Elmer Fisher)
// OSM way 52782046 (height 28 m, 6 levels) on its mapped footprint. Character from the research dossier and published
// descriptions (Romanesque Revival: grey rusticated stone ground floor with round-arched openings, dark red brick above,
// stone belt courses, brick piers, round-arched top windows, a tall arched entrance on Pioneer Place). Compared (round 3)
// with the official panorama kJVn9dVw2rWKgTf-rsYWzw on 1st Ave (47.60198,-122.33415) looking 75–100°: red brick wings,
// a central sandstone tower bay with oriels (added below). Estimates: bay width, floor heights, opening sizes, colours.
function buildPioneerBuilding(ctx) {
    const bd = ctx.data.buildings.find((q) => q.id === 'w52782046'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const g = ctx.ground, b = new GeoBatch(), poly = bd.poly, y0 = Math.min(...poly.map(([x, z]) => g.heightAt(x, z))) - 0.3, H = bd.h || 28, BASE = 5.4, TOP = 1.6, F = (H - TOP - BASE) / 5;
    const STONE = '#8f8a7f', BRICK = '#8a3c2e', TRIM = '#a39c8e', GLASS = '#1c242b';
    b.prism(poly, y0, y0 + BASE, STONE, 'stone', { noTop: true }); b.prism(poly, y0 + BASE, y0 + H - TOP, BRICK, 'brick', { noTop: true }); b.prism(poly, y0 + H - TOP, y0 + H, TRIM, 'stone');
    let longest = null;
    const edges = poly.map((a, i) => { const c = poly[(i + 1) % poly.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); return { a, c, L }; }).filter((e) => e.L > 8);
    const others = ctx.data.buildings.filter((q) => q.id !== bd.id && q.k !== 'roof' && q.poly?.length > 2);
    for (const e of edges) { const dx = (e.c[0] - e.a[0]) / e.L, dz = (e.c[1] - e.a[1]) / e.L; let nx = dz, nz = -dx; const mx = (e.a[0] + e.c[0]) / 2, mz = (e.a[1] + e.c[1]) / 2; if (inPoly(mx + nx * 0.5, mz + nz * 0.5, poly)) { nx = -nx; nz = -nz; } Object.assign(e, { dx, dz, nx, nz, mx, mz, ry: Math.atan2(nx, nz) });
        e.party = others.some((q) => inPoly(mx + nx * 1.2, mz + nz * 1.2, q.poly)); if (!e.party && nx < 0 && (!longest || e.L > longest.L)) longest = e; } // the entrance front: the longest street face towards Pioneer Place (round 3: was the party wall)
    for (const e of edges) {
        if (e.party) continue; // a party wall: the neighbour stands against it
        const { a, L, dx, dz, nx, nz, mx, mz, ry } = e, n = Math.max(2, Math.round(L / 3.7)), w = L / n, at = (t, o) => [a[0] + dx * t + nx * o, a[1] + dz * t + nz * o];
        const disc = (t, y, r, col, key) => { const p = at(t, 0.02), q = at(t, 0.12); b.rod([p[0], y, p[1]], [q[0], y, q[1]], r, col, key, 16); };
        for (const y of [BASE - 0.3, BASE + 2 * F - 0.2, BASE + 4 * F - 0.2]) b.box(mx + nx * 0.17, y0 + y, mz + nz * 0.17, L, 0.4, 0.3, TRIM, 'stone', ry); // belt courses
        for (let k = 0; k <= n; k += 3) { const p = at(Math.min(L - 0.35, Math.max(0.35, k * w)), 0.12); b.box(p[0], y0 + BASE, p[1], 0.7, H - TOP - BASE, 0.3, BRICK, 'brick', ry); }             // brick piers
        const door = e === longest ? Math.floor(n / 2) : -1;
        for (let k = 0; k < n; k++) { const t = (k + 0.5) * w, p = at(t, 0.07);
            if (k === door) { /* the entrance arch; every face at its own depth from the wall (no coplanar pairs): stone surround 0.05-0.10, glass 0.13-0.18, glazed tympanum 0.21-0.26 */ const d0 = at(t, 0.05), d1 = at(t, 0.10); b.rod([d0[0], y0 + 4.6, d0[1]], [d1[0], y0 + 4.6, d1[1]], 2.3, TRIM, 'stone', 16); const q = at(t, 0.155); b.box(q[0], y0, q[1], 3.6, 4.6, 0.05, GLASS, 'darkglass', ry); const r2 = at(t, 0.21), r3 = at(t, 0.26); b.rod([r2[0], y0 + 4.6, r2[1]], [r3[0], y0 + 4.6, r3[1]], 1.8, GLASS, 'darkglass', 16); }
            else { disc(t, y0 + 3.3, 1.2, GLASS, 'darkglass'); b.box(p[0], y0 + 0.5, p[1], 2.4, 2.8, 0.12, GLASS, 'darkglass', ry); }   // round-arched ground-floor openings in the stone base
            for (let i = 0; i < 5; i++) { const y = y0 + BASE + i * F + 0.85, h = F - 1.75;
                b.box(p[0], y - 0.18, p[1], 1.8, 0.18, 0.2, TRIM, 'stone', ry); b.box(p[0], y, p[1], 1.45, h, 0.12, GLASS, 'darkglass', ry);
                if (i >= 3) disc(t, y + h, 0.725, GLASS, 'darkglass'); else b.box(p[0], y + h, p[1], 1.8, 0.22, 0.2, TRIM, 'stone', ry); } }
    }
    // the central bay on Pioneer Place (official panorama kJVn9dVw2rWKgTf-rsYWzw looking 75–100°): a full-height tower of
    // rough-faced grey-brown sandstone round the arched entrance, two stacked oriel bays of dark blue-grey metal and glass
    // over floors 2–5, round-arched windows at the top. Width, depths and oriel sizes are estimates.
    if (longest) { const e = longest, T = 7.6, o = 0.18, p = [e.mx + e.nx * (o + 0.16), e.mz + e.nz * (o + 0.16)]; // (o: clear of the wall's own window boxes)
        b.box(p[0], y0 + 7.0, p[1], T, H - TOP - 7.05, 0.32, '#857b6c', 'stone', e.ry); // (starts over the entrance arch)
        for (const s of [-1, 1]) b.box(e.mx + e.dx * s * (T / 2 - 0.6) + e.nx * (o + 0.2), y0, e.mz + e.dz * s * (T / 2 - 0.6) + e.nz * (o + 0.2), 1.3, 7.25, 0.3, '#857b6c', 'stone', e.ry); // flanking piers (into the tower)
        for (let y = 7.3; y < H - TOP; y += 0.62) b.box(e.mx + e.nx * (o + 0.335), y0 + y, e.mz + e.nz * (o + 0.335), T - 0.02, 0.06, 0.03, '#5f574c', 'stone', e.ry); // coursing
        for (const s of [-1.55, 1.55]) { const q = [e.mx + e.dx * s + e.nx * (o + 0.78), e.mz + e.dz * s + e.nz * (o + 0.78)];
            b.box(q[0], y0 + BASE + F + 0.55, q[1], 2.3, 3 * F - 0.2, 0.9, '#4d5965', 'metal', e.ry); // oriel
            for (let i = 1; i < 4; i++) b.box(e.mx + e.dx * s + e.nx * (o + 1.25), y0 + BASE + i * F + 0.95, e.mz + e.dz * s + e.nz * (o + 1.25), 1.9, F - 1.25, 0.04, GLASS, 'darkglass', e.ry); }
    }
    ctx.add(b.build('pioneer-building')); ctx.poly(poly);
    return { tris: b.tris };
}

export default {
    env: { fogFar: 4000 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('pioneer-square');
        // round 3: the fine (2 m) terrain reaches west over Alaskan Way and Colman Dock (was 8 m outer steps there)
        ctx.treeLod = { cap: Infinity, near: 90, max: 700, force: true }; // round 3: every tree kept; the far ones (the west end's street trees) draw the low crown
        ctx.terrainOpts = { bg: '#8c8578', bgMask: 'slab', innerPx: 2816, inner: { x0: -440, z0: -184, x1: 288, z1: 264 } }; // (r3-sea-spots-b-3) to x = −440: the slips and Pier 48's west end off the 8 m outer steps // (+43 k terrain triangles; the default box starts at x = −144)
        const west = buildWestEnd(ctx);
        const per = buildPergola(ctx);
        ctx.extras.pioneerBuilding = buildPioneerBuilding(ctx);
        const smith=buildSmithTower(ctx);
        // totem pole + Chief Seattle bust fountain
        const tb = new GeoBatch();
        const to = sp.structures.find((s) => s.id === 'totem'), cs = sp.structures.find((s) => s.id === 'chief-seattle');
        buildTotem(ctx, to.x, g.heightAt(to.x, to.z), to.z, -0.15); // carved front faces south over Pioneer Place (toward the pergola / 1st Ave approach)
        { const y = g.heightAt(cs.x, cs.z); tb.cyl(cs.x, y, cs.z, 0.9, 0.9, '#7d7a72', 'stone', 16); tb.cyl(cs.x, y + 0.9, cs.z, 0.45, 1.1, '#6f6b63', 'stone', 12); tb.sphere(cs.x, y + 2.25, cs.z, 0.32, 0.4, 0.3, '#4a3a26', 'bronze', 12, 10); tb.sphere(cs.x, y + 1.95, cs.z, 0.45, 0.25, 0.32, '#4a3a26', 'bronze', 12, 8); ctx.circle(cs.x, cs.z, 0.95, 2.5); }
        ctx.add(tb.build('totem-bust'));
        // purple vault lights (amethyst glass prisms) in the 1st Ave / Yesler sidewalks
        // (r3-sea-spots-b-1) the vault lights are set in cast-iron panels: rows of round prisms on a regular grid, not random
        // patches; panel size (1.2 m, 0.3 m prism pitch) is the usual Pioneer Square pattern; the strips' extent is an estimate
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const [x0, z0, x1, z1] of [[8, -60, 12, -20], [-12, -40, -8, -12], [14, 2, 18, 40]]) for (let qx = x0; qx < x1 - 1.1; qx += 1.35) for (let qz = z0; qz < z1 - 1.1; qz += 1.35) {
            { const [a, b] = T(qx, qz); x.fillStyle = '#3d3a38'; x.fillRect(a, b, Math.max(1, 1.2 * k), Math.max(1, 1.2 * k)); } // the iron panel
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const [a, b] = T(qx + 0.15 + i * 0.3, qz + 0.15 + j * 0.3); x.fillStyle = (i + j) % 3 ? '#8a68b2' : '#a689cc'; x.beginPath(); x.arc(a, b, Math.max(0.6, 0.1 * k), 0, 7); x.fill(); } } });
        ctx.exclude.push([[per.cx - 32, per.cz - 40], [per.cx + 32, per.cz - 40], [per.cx + 32, per.cz + 30], [per.cx - 32, per.cz + 30]].map(([x, z]) => [x, z])); // keep Pioneer Place open (no street trees)
        { const pg = d.areas.find((a) => a.id === 'w1155308011'); if (pg) ctx.extras.occidentalPlayground = playgroundKit(ctx, pg.poly, { name: 'occidental-playground' }).pieces; } // (r3-sea-spots-b-1) OSM area, equipment generic
        ctx.skipBuildings.add(OCC_CANOPY); ctx.extras.occidentalSquare = occidentalSquareProps(ctx); // the open canopy over the square's kiosk (round 3)
        // (r3-sea-spots-b-2) Sinking Ship Garage w52781697 (OSM 3 levels / 10.9 m): the building volume stands on the highest
        // ground under its footprint, so its roof was 10.9 m above the 2nd Ave Extension corner. Official panorama
        // NMuWBnWs062EFE23JyuBAg on 2nd Ave Extension shows the open top deck about level with that street; the USGS 1 m DEM
        // gives 12.52–12.84 m NAVD88 at the footprint's 2nd Ave Extension corners and 8.2 m at the prow (EPQS, 2026-11-13).
        // Documented exception (look from the panorama, plan from OSM): the deck is at the street level of that corner
        // (12.68 m NAVD88), the levels below it run down the slope (one open level shows at the prow); the rest of the
        // mapped 10.9 m is below the high street.
        { const ss = d.buildings.find((x) => x.id === 'w52781697'); if (ss) { const hi = Math.max(...ss.poly.map(([x, z]) => g.heightAt(x, z))), deck = 12.68 - d.origin.elev; if (deck > hi) { ss.h = deck - hi; ss.lv = 1; ctx.extras.sinkingShipDeck = +deck.toFixed(2); } } }
        ctx.extras.colmanFurniture = colmanFurniture(ctx); // (r3-sea-spots-b-3) the Waterfront Trail's mapped benches and lamps
        ctx.osmBackdrop({ paint: {}, filter: (bd) => !FRONTS[bd.id] && !FRONTS_OSM[bd.id], style: (bd) => (bd.amenity === 'parking' || bd.k === 'parking' ? 'parking' : (bd.h || 0) > 60 ? 'office' : 'brick'), // the Sinking Ship and the other garages are open concrete decks, not brick blocks
            lampOpts: { kinds: ['primary', 'secondary', 'tertiary', 'residential'] }, streetTreeOpts: { spacing: 14, prob: 0.45 } });
        ctx.extras.pioneerFronts = buildFronts(ctx, { ...FRONTS, ...FRONTS_OSM }); // the mapped fronts, each with its panorama-checked facade (+ the OSM-only fronts behind the walk area)
        ctx.extras.smithBase = smith ? smithTowerBase(ctx, smith.y0) : null; ctx.extras.merchantsSign = merchantsCafeSign(ctx); // (r3-sea-spots-b-1)
        ctx.lampOpts = { style: 'acorn', color: '#1c2a24', h: 4.6 };
        // Pioneer Place is under big trees (Street View): the nine mapped maples there (OSM natural=tree, genus Acer) stand; only
        // generated street trees stay out of the square
        for (const [x, z] of d.trees) if (x > per.cx - 32 && x < per.cx + 32 && z > per.cz - 40 && z < per.cz + 30) ctx.trees.push({ x, z, kind: 'broad', s: 1.45 });
        west?.finish();
        ctx.extras.shops = buildShopSigns(ctx, { list: pioneerBusinesses(d), skip: (b) => /Smith Tower|^Merchant's Cafe/.test(b.name) }); // (Merchant's Cafe: its own board, merchantsCafeSign)
        occidentalArt(ctx);
        // Occidental Square: big London plane trees on the brick square
        { const sq = d.areas.find((a) => a.id === 'w174692555'); if (sq) { const bb = polyBox(sq.poly), r = rng(6); const can = d.buildings.find((q) => q.id === OCC_CANOPY)?.poly; for (let i = 0; i < 26; i++) { const x = bb.x0 + 5 + r() * (bb.x1 - bb.x0 - 10), z = bb.z0 + 5 + r() * (bb.z1 - bb.z0 - 10); if (can && inPoly(x, z, polyBox(can) && [[polyBox(can).x0 - 3, polyBox(can).z0 - 3], [polyBox(can).x1 + 3, polyBox(can).z0 - 3], [polyBox(can).x1 + 3, polyBox(can).z1 + 3], [polyBox(can).x0 - 3, polyBox(can).z1 + 3]])) continue; ctx.trees.push({ x, z, kind: 'broad', s: 1.25 + r() * 0.35 }); } ctx.painter.poly(sq.poly, '#9a5a44', 'brick'); } }
        ctx.extras.seaBackdrop = seaBackdrop(ctx, { clear: 330, rainier: false, olympics: true, bay: true, ferries: true, cranes: true, midrise: 500, midClear: 420, midBox: [47.596, -122.34, 47.612, -122.318] });
        addTraffic(ctx, { lanes: [{ pts: [[6, 272], [5, 179], [5, 85], [5, 30], [6, -8], [5, -84], [0, -94], [-12, -106], [-56, -178]], n: 3, speed: 8 }, { pts: [[-56, -178], [-12, -106], [-2, -84], [-2, -8], [-3, 85], [-4, 178], [-3, 248]].map(([x, z]) => [x - 1, z]), n: 3, speed: 8 }, { pts: [[-97, -9], [-2, -8], [45, -8], [151, -8], [247, -7]], n: 2, speed: 8 }] });
        // plaques around Pioneer Place
        const PL = sp.plaques;
        ctx.plaque(PL[0], per.cx - 5, per.cz + 6, Math.PI * 1.1); ctx.plaque(PL[1], -10, -16, Math.PI / 2); ctx.plaque(PL[2], 14, 10, -Math.PI / 2);
        ctx.plaque(PL[3], 150, -20, -Math.PI / 2, { credit: 'Smith Tower (1914): Gaggin & Gaggin.' }); ctx.plaque({ ...PL[4], title: 'Chief-of-All-Women pole (replica)', text: 'Carved 1939–40 at Saxman, Alaska, by Tlingit carvers led by Charles Brown, among them members of the Kinninook family, for whom the original was carved about 1790 at Tongass Island to honour Chief-of-All-Women. The original was taken without consent by a Seattle business excursion in 1899 and burned in 1938. Figures, top to bottom: Raven with the moon; a woman holding her frog child; her frog husband; Mink; Raven; Whale holding a seal; Raven-at-the-Head-of-Nass.' }, to.x - 2.2, to.z + 2.5, Math.PI * 0.9, { credit: 'Restored 1972 by Tsimshian carver John C. Hudson Jr. National Historic Landmark (1977). Modelled respectfully in 3-D from published descriptions (Garfield, The Seattle Totem Pole).' });
        // Read the actual outdoor carving by framing each published figure.
        // The guide rings are temporary game UI, not fixtures on the pole.
        const figures=[['Raven with the moon in his beak',13.6],['A woman holding her frog child',11.2],['Her frog husband',9.25],['Mink',7.7],['Raven',6.1],['Whale holding a seal',4.1],['Raven-at-the-Head-of-Nass',1.6]],ty=g.heightAt(to.x,to.z);
        ctx.extras.pioneerTotem=photoHunt(ctx,{x:to.x-2.6,z:to.z+3.2,title:'Frame the seven pole figures',unavailable:'The 1939–40 replica was carved at Saxman by Tlingit carvers led by Charles Brown; the original was taken without consent in 1899.',
            targets:figures.map(([label,y])=>({label,x:to.x-Math.sin(.15)*.85,y:ty+y,z:to.z+Math.cos(.15)*.85,radius:.55,maxDistance:40})),
            onDone:s=>seaActivity(s,'lm-totem-read','pioneer-square','🪶 Seven figures framed','You framed each published figure of the Chief-of-All-Women pole from the public square.')});
        // No verified real staircase or private Underground room is modeled.
        // Keep the public streets and valid buildings intact and offer a real
        // outdoor exercise rather than an automatic trip to an invented room.
        ctx.extras.pioneerPublicHistory=photoHunt(ctx,{x:cs.x-6.5,z:cs.z+3,title:'Frame Pioneer Square history outdoors',unavailable:'A real Underground tour uses an operator and ticketed access. No interior entrance is verified in this game; explore these public features instead.',targets:[
            {label:'The cast-iron pergola',x:per.cx,y:per.y0+4.6,z:per.cz,radius:1.4},
            {label:'The Chief Seattle bust',x:cs.x,y:g.heightAt(cs.x,cs.z)+2.25,z:cs.z,radius:.5},
            ...(smith?[{label:'The white terracotta Smith Tower',x:smith.cx,y:smith.y0+40,z:smith.cz,radius:5,maxDistance:300,surfaceTolerance:2,surface:smith.surface}]:[])],
            onDone:s=>seaActivity(s,'lm-underground','pioneer-square','🏛 Public square details framed','You framed three outdoor details in Pioneer Square. A ticketed Underground interior has not been entered or simulated.')});
        ctx.extras.pioneerContext={removedUnverifiedUndergroundRoom:true};
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
