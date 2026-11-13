// ============================================================================
//  Bellevue: Lincoln Square + Bellevue Square + the skybridges (the Bellevue
//  Collection) at NE 8th St × Bellevue Way — rebuilt round 5 (owner note 66).
//  The towers are the district's own landmark models (landmarks.js `lincoln`,
//  `onelincoln`, `lincolnsouth`, `bellevuesq`: curtain walls, podium, Westin /
//  W signage, the Bellevue Way + NE 8th + NE 6th skybridges) with lit office
//  floors at night instead of the generic OSM slabs. Streetscape: Bellevue Way
//  and NE 8th from OSM with street trees in grated pits, Bellevue Collection
//  holiday lights in the trees (late Nov – early Jan), the remaining skybridges
//  (Bellevue Square ↔ garage, Bellevue Place), the Bellevue Square pylon.
//  UiPath (Lincoln Square North, 700 Bellevue Way NE, Suite 2000, since Sept
//  2025 — the game's final CV chapter). The office is private. The visitor
//  activity frames the documented tower and skybridge from the sidewalk.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { photoHunt } from '../photo-hunt.js';
import { GeoBatch, rng, headingFromBearing, polyBox, inPoly, distPolyline, offsetPolyline, polyArea } from '../kit.js';
import { signBoard, shopfrontSigns } from '../props.js';
import { seattleBackdrop } from '../backdrop.js';
import { addTraffic } from '../cars.js';
import { emitActivity, seasonal, placeLitLandmark, skipNearLandmark, fairyLights, treeLightPoints, glowText, nightLit, parkPavilions } from './bel-common.js';

const SKY_Y = 6.2; // skybridge floor above the roadway (landmarks.js uses the same)

/** a band of half-width hw along a polyline with mitred bends (a polygon for a prism): the bridge decks / roofs used to be
 *  one box per segment, unmitred, open wedges or overlapping (z-fighting) corners at each bend (r3-builder-spots-5) */
function mitredBand(pts, hw) {
    const P = pts.filter((q, i) => !i || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) > 0.05), L = [], R = [];
    for (let i = 0; i < P.length; i++) {
        const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
        const n0 = i > 0 ? nrm(P[i - 1], P[i]) : null, n1 = i < P.length - 1 ? nrm(P[i], P[i + 1]) : null;
        let [nx, nz] = n0 && n1 ? [n0[0] + n1[0], n0[1] + n1[1]] : (n0 || n1); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const k = n0 && n1 ? Math.min(3, 1 / Math.max(0.2, nx * n0[0] + nz * n0[1])) : 1;
        L.push([P[i][0] + nx * hw * k, P[i][1] + nz * hw * k]); R.push([P[i][0] - nx * hw * k, P[i][1] - nz * hw * k]);
    }
    return [...L, ...R.reverse()];
}
function skybridge(ctx, b, pts, glassMat) {
    const g = ctx.ground;
    // one floor level per bridge (the higher end's ground + SKY_Y: per-segment levels stepped at the bends)
    const y = Math.max(...pts.map(([x, z]) => g.heightAt(x, z))) + SKY_Y;
    b.prism(mitredBand(pts, 2.3), y - 0.6, y, '#d9dcdd', 'paint', { bottom: true });
    b.prism(mitredBand(pts, 2.5), y + 4.2, y + 4.7, '#d9dcdd', 'paint', { bottom: true });
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const yaw = Math.atan2(bx - ax, bz - az);
        for (const s of [-1, 1]) { const ox = Math.cos(yaw) * 2.3 * s, oz = -Math.sin(yaw) * 2.3 * s; for (let t = 0; t <= L; t += 4) { const px = ax + (bx - ax) * t / L + ox, pz = az + (bz - az) * t / L + oz; b.box(px, y, pz, 0.14, 4.2, 0.14, '#c9cdd0', 'steel', yaw); } }
        const glass = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.1, L), glassMat); glass.position.set((ax + bx) / 2, y + 2.05, (az + bz) / 2); glass.rotation.y = yaw; ctx.add(glass);
    }
}

/** an open footbridge (garage-deck walkway, OSM bridge=yes layer=1, not covered): concrete deck with steel rails at the
 *  skybridges' floor estimate (no measured level) */
function openBridge(ctx, b, pts) {
    const g = ctx.ground, y = Math.max(...pts.map(([x, z]) => g.heightAt(x, z))) + SKY_Y;
    // a way that runs out and back round a deck (w843400114: ends 2.8 m apart, legs 2 m apart) outlines that deck
    const [p0, pn] = [pts[0], pts[pts.length - 1]];
    if (pts.length > 3 && Math.hypot(pn[0] - p0[0], pn[1] - p0[1]) < 3.5) { b.prism(pts, y - 0.5, y, '#bdb9b0', 'concrete', { bottom: true }); return; }
    b.prism(mitredBand(pts, 1.2), y - 0.5, y, '#bdb9b0', 'concrete', { bottom: true });
    for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const yaw = Math.atan2(bx - ax, bz - az);
        for (const s of [-1, 1]) { const ox = Math.cos(yaw) * 1.15 * s, oz = -Math.sin(yaw) * 1.15 * s;
            b.rod([ax + ox, y + 1.05, az + oz], [bx + ox, y + 1.05, bz + oz], 0.035, '#7d8387', 'steel', 6);
            b.rod([ax + ox, y + 0.5, az + oz], [bx + ox, y + 0.5, bz + oz], 0.02, '#7d8387', 'steel', 5);
            for (let t = 0; t <= L; t += 2) { const px = ax + (bx - ax) * t / L + ox, pz = az + (bz - az) * t / L + oz; b.rod([px, y, pz], [px, y + 1.05, pz], 0.025, '#7d8387', 'steel', 5); } }
    }
}

export default {
    env: { fogFar: 6000, ambientCity: 0.55 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, sp = ctx.spot('bel-lincoln-square'), r = rng(66);
        ctx.terrainOpts = { bg: '#8e8a80', bgMask: 'slab', innerPx: 2048 };
        // ---------------------------------------------------------------- district landmark models replace the OSM slabs
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth']) skipNearLandmark(ctx, id);
        for (const a of d.areas) if ((a.landuse === 'grass' || a.leisure === 'garden') && a.poly.length < 16 && Math.hypot(a.poly[0][0], a.poly[0][1]) < 40) { ctx.skipAreas.add(a.id); ctx.painter.poly(a.poly, '#4a3b2c', 'dirt'); } // corner planters: bark mulch, not a flat lawn slab // no painted grass slab on the corner paving (QA R2 #5)
        for (const id of ['w604028609', 'w604028611', 'w328017119', 'w161929514', 'w1474737770', 'w1364249504', 'w604028603', 'w1326151866', 'w1326151868', 'w1391221517',
            'w29234887', 'w497738386', 'w497739259']) ctx.skipBuildings.add(id);
        // (w33106348 — the Crate & Barrel corner and the Bellevue Way restaurant row wrapping the NE garage — is NOT part
        // of the `bellevuesq` landmark (its source rings are w29234887 + w497739259): it stays an OSM building.)
        const LMS = {};
        for (const id of ['lincoln', 'onelincoln', 'lincolnsouth', 'bellevuesq']) LMS[id] = placeLitLandmark(ctx, id, { seed: id.length * 3, frac: id === 'bellevuesq' ? 0.9 : 0.5, collide: false });
        // collisions from the real OSM footprints the models are built from (the landmark collision boxes are coarse bounds)
        for (const bd of d.buildings) if (ctx.skipBuildings.has(bd.id) && bd.k !== 'bridge' && !bd.minLv && !bd.minH && !(+bd.layer >= 1 && /connector|bridge/.test(bd.k || ''))) ctx.poly(bd.poly);
        // skybridges: the landmark models carry Bellevue Way / NE 8th / NE 6th; the others are built here (not painted on the ground)
        const skyIds = ['w43872832', 'w43872826', 'w1222676052', 'w29234890', 'w497738385', 'w516915099'];
        for (const id of skyIds) ctx.skipWays.add(id);
        // Bellevue Place (NE corner, OSM w366831926 + parts, w33613428): Street View (official pano at the corner, 2026-11-12)
        // shows tan / rose precast with rectangular punched windows — not the generic red-brick style with arched windows.
        const BPLACE = new Set(['w366831926', 'w366831918', 'w366831921', 'w366831924', 'w366831929', 'w366831931', 'w33613428']);
        for (const bd of d.buildings) if (BPLACE.has(bd.id) && !bd.c) bd.c = '#cdb09c';
        // Avenue Bellevue (NW corner of NE 8th × Bellevue Way, OSM w1215907936 residential 26 levels + w1215907937 and their
        // parts): Street View from NE 8th St and Bellevue Way (official panoramas, 2026-11-12) shows two white towers ringed
        // by balcony bands — they were drawn as dark office glass (every building over 40 m was). Light banded facade now;
        // the curved plan and the balconies themselves are not modelled.
        const AVENUE = new Set(['w1215907936', 'w1215907937', 'w1223091248', 'w1223378663', 'w1223091245', 'w1223374204']);
        for (const bd of d.buildings) if (AVENUE.has(bd.id)) bd.c = '#e6e8e7';
        // (round 3, bel-spots-3) w33106348 carries no building:levels / height in OSM and rose at the generic default. Official
        // panoramas on Bellevue Way (by the skybridge and at NE 7th, 2026-11-13): two tall storeys; the restaurant row's cornice
        // is level with the top of a street-light head (≈ 10 m), the Crate & Barrel corner's white parapet ≈ 12 m. The volume
        // takes the row's 10 m (2 storeys); the corner's extra 2 m is its street-face parapet below. Heights are estimates.
        { const bq0 = d.buildings.find((x) => x.id === 'w33106348'); if (bq0 && !bq0.h) { bq0.h = 10; bq0.lv = 2; } }
        parkPavilions(ctx); // bus shelters / park restrooms in the surroundings: open roofs / low blocks, not shop blocks
        ctx.osmBackdrop({ paint: {}, streetTrees: false, lampOpts: { kinds: ['primary', 'secondary', 'tertiary'], spacing: 30 },
            style: (bd) => (AVENUE.has(bd.id) ? 'concrete' : (bd.h || 0) > 40 ? 'office' : /Square|Mall|Nordstrom|Macy/.test(bd.name || '') ? 'mall' : BPLACE.has(bd.id) ? 'concrete' : undefined) });
        // (r2-bel-spots-6) Avenue Bellevue's balcony rings: Street View (NE 8th St / Bellevue Way, 2026-11-12) shows both towers
        // ringed by white balcony bands, one per storey. The tower parts follow their OSM rings (w1223091248, w1223378663,
        // w1223091245: 30–65-vertex curved plans); each storey above the part's base gets a slab round the ring, 1.2 m deep
        // (depth and slab thickness are estimates), at the part's own storey height (height / levels from OSM).
        { const grow = (poly, dd) => { const cw = polyArea(poly) > 0, o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -dd : dd); return o.slice(1, poly.length + 1); };
            const bb = new GeoBatch(); let slabs = 0;
            for (const id of ['w1223091248', 'w1223378663', 'w1223091245']) {
                const bd = d.buildings.find((x) => x.id === id), c = ctx.colliders.find((q) => q.source === id && q.poly); if (!bd || !c || !(bd.lv > (bd.minLv || 0))) continue;
                const n = bd.lv - (bd.minLv || 0), fh = (c.y1 - c.y0) / n, ring = grow(bd.poly, 1.2);
                if (!ring?.length || ring.some((q) => !Number.isFinite(q[0] + q[1]))) continue;
                for (let k = 1; k < n; k++) { const y = c.y0 + k * fh; bb.prism(ring, y - 0.22, y, '#f1f2f0', 'concrete', { bottom: true }); slabs++; } // (the cap inside the tower is hidden by its walls)
            }
            if (slabs) ctx.add(bb.build('avenue-balconies')); ctx.extras.avenueBalconies = slabs; }
        // street shop fascias (shared helper), none inside the landmark blocks (their podium storefronts are part of the models)
        const lmPolys = d.buildings.filter((bd) => ctx.skipBuildings.has(bd.id)).map((bd) => bd.poly);
        ctx.painter.poly([[-22, -22], [4.5, -22], [4.5, -1.5], [-22, -1.5]], '#a8a49a', 'slab'); // NW corner paving (no residential-lawn paint showing through)
        shopfrontSigns(ctx, { skip: (p) => lmPolys.some((q) => inPoly(p.x, p.z, q)) });
        const b = new GeoBatch();
        // ---- Bellevue Square NE block (w33106348) street faces, from Street View (official panos at the NE 8th corner and on
        // Bellevue Way by the skybridge, 2026-11-12): a white, fully glazed two-storey Crate & Barrel on the corner; south of it
        // a brick-and-stucco restaurant row with dark canopies and ivy. Laid 6-9 cm over the generic shopfront walls of the OSM
        // volume, 6-13 cm proud (it keeps its footprint, collider and mapped signs). Bay rhythm and the heights (row 10 m, corner 12 m: round 3) are estimates.
        { const bq = d.buildings.find((x) => x.id === 'w33106348');
            if (bq) { const P = bq.poly;
                for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [qx, qz] = P[(i + 1) % P.length], Le = Math.hypot(qx - ax, qz - az); if (Le < 2.5) continue;
                    let nx = -(qz - az) / Le, nz = (qx - ax) / Le, p0 = [ax, az], p1 = [qx, qz]; const mx = (ax + qx) / 2, mz = (az + qz) / 2;
                    if (inPoly(mx + nx * 0.5, mz + nz * 0.5, P)) { nx = -nx; nz = -nz; p0 = [qx, qz]; p1 = [ax, az]; }
                    const south = nz > 0.7 && mz > 130;                                                          // the south face (towards NE 6th)
                    if (!((nx > 0.7 && mx > -2) || (nz < -0.7 && mz < 32) || south)) continue;                 // the Bellevue Way, NE 8th and south faces
                    // ne8w: the NE 8th face west of the corner — red brick, a steel-and-glass canopy and a glazed upper storey (official
                    // panorama on NE 8th at x ≈ −70, round 3); upper-level tenants (Thai Kitchen Bird Pepper, level 2) show no sign there
                    const crate = mz < 62 && mx > -55, ne8w = !crate && nz < -0.7 && mz < 32, H = crate ? 12 : 10, ux = (p1[0] - p0[0]) / Le, uz = (p1[1] - p0[1]) / Le, ga = g.heightAt(p0[0] + nx, p0[1] + nz), gb = g.heightAt(p1[0] + nx, p1[1] + nz), y0 = Math.min(ga, gb) - 0.3, yb = Math.max(ga, gb), yT = yb + H;
                    const Q = (t0, t1, ya, yc, off, col, key) => { const a = [p0[0] + ux * t0 + nx * off, p0[1] + uz * t0 + nz * off], c = [p0[0] + ux * t1 + nx * off, p0[1] + uz * t1 + nz * off]; b.quad([a[0], ya, a[1]], [c[0], ya, c[1]], [c[0], yc, c[1]], [a[0], yc, a[1]], col, key); };
                    Q(0, Le, y0, yT, 0.06, crate ? '#f1f0ec' : south ? '#e6dfcf' : ne8w ? '#9a553e' : '#ece7dc', ne8w ? 'brick' : 'paint');
                    if (crate) b.box(mx + nx * 0.06, yT - 0.05, mz + nz * 0.06, 0.4, 0.3, Le, '#f4f3ef', 'paint', Math.atan2(ux, uz)); // parapet coping over the corner's taller face
                    // (round 2, Street View on Bellevue Way under the skybridge: the restaurant row — Tavern Hall, Castilla,
                    // Shake Shack — is white stucco on both storeys with dark shopfronts and ivy bays; the red-brick building
                    // is the next one south (The Cheesecake Factory, part of the Bellevue Square model). No brick base here.)
                    if (!crate) Q(0, Le, y0, yb + (south ? 1.2 : 0.5), 0.09, south ? '#8a4a3a' : '#cfc9bc', 'paint');      // stone plinth (south face: a brick base, panorama on NE 6th)
                    const bay = crate ? 3.2 : 4.6, n = Math.max(1, Math.floor((Le - 0.8) / bay)), m0 = (Le - n * bay) / 2;
                    for (let k = 0; k < n; k++) { const t0 = m0 + k * bay + 0.15, t1 = m0 + (k + 1) * bay - 0.15;
                        if (ne8w) { r(); Q(t0, t1, yb + 0.6, yb + 3.3, 0.12, '#2c3b45', 'darkglass'); Q(t0 - 0.1, t1 + 0.1, yb + 4.4, yT - 0.5, 0.12, '#3a4c58', 'darkglass'); continue; } // no ivy here; the draw is still taken (keeps the other faces' random sequence)
                        if (south ? k === 0 : !crate && r() < 0.3) { Q(t0 - 0.15, t1 + 0.15, yb, yT - 0.4, 0.13, '#3f6b35', 'plant'); continue; }  // ivy-covered bay
                        Q(t0, t1, yb + 0.35, yb + 3.5, 0.12, '#2c3b45', 'darkglass'); Q(t0, t1, yb + (crate ? 4.9 : 5.4), yb + (crate ? 10.2 : 8.4), 0.12, '#31424d', 'darkglass'); }
                    if (!crate && !south) b.box(mx + nx * 0.75, yb + 3.55, mz + nz * 0.75, 1.4, 0.12, Le - 0.6, '#2b2d2f', 'metal', Math.atan2(ux, uz));
                }
                const cs = glowText('Crate&Barrel', 7, 1.0, { fg: '#1a1a1a', bg: '#f1f0ec', night: 0.6 }); cs.position.set(-8, g.heightAt(-8, 24) + 10.6, Math.min(...P.filter((q) => q[0] > -20 && q[1] < 40).map((q) => q[1])) - 0.16); cs.rotation.y = Math.PI; ctx.add(cs);
            } }
        // ---- street-level tenants of the Lincoln Square podiums (OSM POIs inside the landmark footprints; the landmark models
        // carry no tenant signs): a plate on the nearest podium street wall. Cinemark's large parapet sign over Bellevue Way is
        // as seen in Street View (OSM: amenity=cinema "Cinemark Lincoln Square").
        { const hosts = d.buildings.filter((bd) => ['w161929514', 'w1326151868', 'w328017119'].includes(bd.id)), seen = new Set(); let n = 0;
            const streetNear = (x, z) => d.ways.some((w) => /^(primary|secondary|tertiary|residential|service|pedestrian)$/.test(w.k) && w.pts.length > 1 && distPolyline(x, z, w.pts).d < 12);
            for (const p of d.pois || []) { if (!p.name || seen.has(p.name) || !(p.shop || /^(cafe|restaurant|fast_food|bar|pub|bank)$/.test(p.amenity || '')) || (p.level && !/^0(;|$)/.test(String(p.level)))) continue;
                let best = null; for (const h of hosts) for (let i = 0; i < h.poly.length; i++) { const A = h.poly[i], B = h.poly[(i + 1) % h.poly.length], q = distPolyline(p.x, p.z, [A, B]); if (q.d < 9 && (!best || q.d < best.d)) best = { d: q.d, A, B, cx: q.cx, cz: q.cz, h }; }
                if (!best) continue; const Le = Math.hypot(best.B[0] - best.A[0], best.B[1] - best.A[1]); if (Le < 5) continue;
                let nx = -(best.B[1] - best.A[1]) / Le, nz = (best.B[0] - best.A[0]) / Le; if (inPoly(best.cx + nx, best.cz + nz, best.h.poly)) { nx = -nx; nz = -nz; }
                if (!streetNear(best.cx + nx * 6, best.cz + nz * 6)) continue;
                seen.add(p.name); const w = Math.min(4.2, 0.9 + p.name.length * 0.17), sb = signBoard(p.name, w, 0.55, { bg: n % 2 ? '#2b2b2b' : '#14213d', fg: '#f5f1e6', font: (q) => `700 ${q}px Georgia, serif`, night: 1.1, depth: 0.06 });
                sb.position.set(best.cx + nx * 0.4, g.heightAt(best.cx + nx * 1.5, best.cz + nz * 1.5) + 3.3, best.cz + nz * 0.4); sb.rotation.y = Math.atan2(nx, nz); ctx.add(sb); n++; }
            const pod = hosts.find((h) => h.id === 'w161929514');
            if (pod && (d.pois || []).some((p) => /^Cinemark Lincoln Square$/.test(p.name || ''))) { const wx = Math.min(...pod.poly.filter((q) => Math.abs(q[1] - 112) < 40).map((q) => q[0])), cm = glowText('CINEMARK', 9, 1.5, { fg: '#c8102e', bg: '#f3f2ee', night: 1.2 }); cm.position.set(wx - 0.45, g.heightAt(wx - 2, 112) + 11.5, 112); cm.rotation.y = -Math.PI / 2; ctx.add(cm); } }
        const glassMat = new THREE.MeshStandardMaterial({ color: '#8fb0c2', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false });
        for (const id of ['w1222676052', 'w29234890', 'w497738385']) { const w = d.ways.find((x) => x.id === id); if (w) skybridge(ctx, b, w.pts, glassMat); }
        // (r3, bel-spots-2) the covered OSM skybridges between Bellevue Square and the West Parking Garage across its service
        // drive (live OSM, in the data since the round-3 append): floor height is the same estimate as the other skybridges
        for (const id of ['w387201731', 'w29234888', 'w843400178', 'w843400185', 'w843400163', 'w30758942', 'w843400165']) { const w = d.ways.find((x) => x.id === id); if (w && w.covered === 'yes') skybridge(ctx, b, w.pts, glassMat); }
        // (r3-builder-spots-4) the open garage-deck walkways across the same drive (OSM footway bridge=yes layer=1, no roof)
        for (const id of ['w29234889', 'w843400118', 'w843400136', 'w843400114']) { const w = d.ways.find((x) => x.id === id); if (w && w.covered !== 'yes') { ctx.skipWays.add(id); openBridge(ctx, b, w.pts); } }
        // ---------------------------------------------------------------- streetscape: trees in grated pits along Bellevue Way + NE 8th, holiday lights
        const blockers = d.ways.filter((w) => ['service', 'footway', 'residential', 'unclassified'].includes(w.k)).flatMap((w) => [w.pts[0], w.pts[w.pts.length - 1]]);
        const lines = [[[4.5, -92], [4.5, -6]], [[4.5, 30], [4.5, 205]], [[32.6, 30], [32.6, 205]], [[32.6, -92], [32.6, -6]], [[38, 27], [140, 27]], [[-180, 27], [1, 27]], [[38, -2.5], [150, -2.5]], [[-180, -2.5], [0, -2.5]]];
        const holiday = [];
        for (const [[x0, z0], [x1, z1]] of lines) {
            const L = Math.hypot(x1 - x0, z1 - z0);
            for (let t = 4; t < L; t += 9.5) {
                const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L;
                if (blockers.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6)) continue;
                if (d.buildings.some((bd) => !bd.part && !ctx.skipBuildings.has(bd.id) && inPoly(x, z, bd.poly))) continue;
                if (skyIds.some((id) => { const w = d.ways.find((q) => q.id === id); return w && distPolyline(x, z, w.pts).d < 5; })) continue;
                ctx.trees.push({ x, z, kind: 'broad', s: 0.85 + r() * 0.15 });
                const y = g.heightAt(x, z);
                b.box(x, y + 0.01, z, 1.5, 0.03, 1.5, '#2b2d2f', 'metal'); b.box(x, y + 0.02, z, 0.5, 0.03, 0.5, '#4a3b2c', 'dirt');      // cast-iron tree grate
                holiday.push(...treeLightPoints(x, y, z, { seed: (x * 7 + z) | 0, n: 80, crownY: 4.4, crownR: 2.2 }));
            }
        }
        let season = false; seasonal(ctx, [11, 20], [1, 6], (on) => { season = on; });
        fairyLights(ctx, holiday, { on: () => season, name: 'bellevue-collection-holiday-lights' });
        // The office address is documented; its private floor and physical
        // tenant-directory design are not. Keep the activity on the sidewalk.
        const ue = sp.structures.find(s => s.id === 'uipath-entrance');
        const tower = LMS.lincoln, towerSource=d.buildings.find(b=>b.id==='w604028609'), towerBounds=towerSource&&polyBox(towerSource.poly), tx=towerBounds?(towerBounds.x0+towerBounds.x1)/2:tower?.x, tz=towerBounds?(towerBounds.z0+towerBounds.z1)/2:tower?.z;
        // Aim at the retained north-west facade edge, not the solid tower's
        // centre30m behind its visible face. The crown uses that same source
        // edge; its modelled setback is less than the finite2m allowance.
        const face=towerSource&&(()=>{const p=towerSource.poly,q=distPolyline(-2,2,[...p,p[0]]),a=p[q.i],b=p[(q.i+1)%p.length];return{x:q.cx+((a[0]+b[0])/2-q.cx)*.25,z:q.cz+((a[1]+b[1])/2-q.cz)*.25};})();
        if(tower)photoHunt(ctx,{x:-2,z:2,title:'Lincoln Square camera challenge',unavailable:'Suite 2000 is private; interior access is unavailable.',targets:[
            {label:'Lincoln Square North: the office tower',x:face?.x??tx,y:tower.y+60,z:face?.z??tz,radius:3,surfaceTolerance:2},
            {label:'The west end of the Bellevue Way skybridge',x:3,y:g.heightAt(3,96.4)+8.25,z:96.4,radius:2},
            {label:'Lincoln Square North: the crown',x:face?.x??tx,y:tower.y+123,z:face?.z??tz,radius:3,surfaceTolerance:2},
        ],onDone:s=>emitActivity(s,'bel-lincoln-square','badge-in','📷 Lincoln Square details','You framed the office tower, public skybridge and crown from the public approach.')});
        // ---------------------------------------------------------------- Bellevue Collection wayfinding pylon, Bellevue Square entrance
        const pyl = signBoard('THE BELLEVUE COLLECTION', 0.9, 3.2, { bg: '#1d2b36', fg: '#e8e3d6', maxLines: 4, font: (s) => `600 ${s}px Georgia, serif`, ppm: 220, night: 0.8 }); pyl.position.set(4, g.heightAt(4, 40) + 1.7, 40); pyl.rotation.y = Math.PI / 2; ctx.add(pyl); ctx.box(4, 40, 0.2, 0.5, 0, { prop: true, h: 3.4 });
        // ---- Bellevue Way median (round 3, r2-bel-spots-6). OSM maps Bellevue Way south of NE 8th as two one-way carriageways
        // (southbound w425272687, northbound w738584326 / w470492322): a divided road. Street View (round 2, official panoramas)
        // shows a raised median with yellow kerbs under the skybridge and a planted one with grasses near NE 6th. Drawn here as
        // its own geometry on the road paint (the painter is the hash-locked spots/osm.js): centred between the carriageways,
        // as wide as the gap between their painted edges (0.6–2.4 m), broken where a mapped road or crossing meets it. Width,
        // the planted stretch (the last 30 m before NE 6th) and the kerb height (15 cm) are estimates.
        { const sbw = d.ways.find((w) => w.id === 'w425272687'), nbw = [d.ways.find((w) => w.id === 'w738584326'), d.ways.find((w) => w.id === 'w470492322')].filter(Boolean);
            const xAt = (pts, z) => { for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; if ((z - az) * (z - bz) <= 0 && az !== bz) return ax + (bx - ax) * (z - az) / (bz - az); } return null; };
            const halfW = (w) => { const n = parseInt(w.lanes, 10); return (n > 0 ? n * 3.3 + 2.6 : 9) / 2; };
            const cross = d.ways.filter((w) => w.pts.length > 1 && !['w425272687', 'w738584326', 'w470492322'].includes(w.id) && /^(primary|secondary|tertiary|residential|service|unclassified|footway)$/.test(w.k) && (w.k !== 'footway' || /crossing/.test(w.footway || '')));
            const md = new GeoBatch(), MZ0 = 88, MZ1 = 203, STEP = 3, grass = [];
            if (sbw && nbw.length) for (let z = MZ0; z < MZ1; z += STEP) { const zc = z + STEP / 2, xs = xAt(sbw.pts, zc), xn = nbw.map((w) => xAt(w.pts, zc)).find((v) => v !== null); if (xs === null || xn == null) continue;
                const e0 = xs + halfW(sbw), e1 = xn - halfW(nbw[0]), xm = (e0 + e1) / 2, w = Math.max(0.6, Math.min(2.4, e1 - e0)); if (cross.some((cw) => distPolyline(xm, zc, cw.pts).d < 4)) continue;
                const y = g.heightAt(xm, zc), planted = zc > MZ1 - 30;
                md.box(xm, y - 0.05, zc, w, 0.2, STEP - 0.02, '#d6b03c', 'paint');                                                  // yellow kerb faces
                md.box(xm, y, zc, w - 0.16, 0.19, STEP - 0.18, planted ? '#5b6a3a' : '#bdb9b0', planted ? 'plant' : 'concrete');  // top 4 cm higher, 8 cm in
                if (planted) for (let k = 0; k < 3; k++) grass.push({ x: xm + (k - 1) * Math.min(0.25, w / 5), z: zc + (k - 1) * 0.9, kind: 'shrub', s: 0.22, c: ['#8a8a4a', '#7a7d44', '#9a9150'][k] }); }
            ctx.trees.push(...grass); ctx.add(md.build('bellevue-way-median')); }
        ctx.add(b.build('lincoln-streetscape'));
        // Seattle across Lake Washington (≈ 9 km) — towers + Needle on clear days
        seattleBackdrop(ctx, { clear: 2000, hazeK: 0.4, needle: true });
        addTraffic(ctx, { lanes: [{ pts: [[13, -101], [13, -43], [12, 7], [11, 27], [13, 149], [14, 225], [15, 278], [18, 409]], n: 6, speed: 9 }, { pts: [[31, 484], [28, 317], [25, 217], [24, 83], [24, 18], [23, -2], [22, -95]], n: 6, speed: 9 }, { pts: [[219, 8], [150, 8], [93, 8], [24, 8], [-88, 7], [-213, 8]], n: 5, speed: 9 }, { pts: [[-262, 18], [-112, 17], [12, 18], [77, 20], [176, 20]], n: 5, speed: 9 }] });
        // plaques
        const PL = sp.plaques;
        // (these two stood at x = 1.5 / 2: inside the w33106348 block since it is a building again — its Bellevue Way face is
        // at x = 3.4 / 2.6 there. On the sidewalk in front of it now.)
        ctx.plaque(PL[0], 4.7, 120, Math.PI / 2); ctx.plaque(PL[1], 3.9, 82, Math.PI / 2); ctx.plaque(PL[2], 31, 110, -Math.PI / 2); ctx.plaque(PL[3], ue.x - 5.5, ue.z - 5, -Math.PI / 2, { credit: 'UiPath office address from UiPath; move reported by GeekWire (2025).' });
        // postcard: from the NE 8th × Bellevue Way corner, looking up at Lincoln Square North + One Lincoln with the skybridge
        ctx.challenge('bel-lincoln-square', { x: -2, z: 2, heading: 145, pitch: 18, r: 12, tol: 35, text: 'Lincoln Square North (UiPath) and One Lincoln Tower over Bellevue Way' });
        const s0 = { x: sp.spawn.x - 3, z: sp.spawn.z - 3 }, gx = s0.x + 2.67 + 3, gz = s0.z - 2.1; // tour guide at the side of the spawn, facing the player
        ctx.crowdCfg = {
            tour: false,
            personas: { tech: 5, local: 4, tourist_us: 2, tourist_cn: 1.5, tourist_in: 1.5, tourist_kr: 1, tourist_jp: 1, kid: 1 },
            walkers: 42, paths: ctx.footLines(),
            groups: [
                { x: 30, z: 30, r: 2.5, n: 6, act: 'watch', look: [0, 0], personas: ['tech', 'local', 'tourist_in'] },
                { x: -8, z: 2, r: 2.5, n: 5, act: 'watch', look: [30, 30], personas: ['tech', 'local', 'kid'] },
                { x: ue.x - 4, z: ue.z + 2, r: 1.5, n: 3, act: 'talk', personas: ['tech'] },
                { x: 3, z: 140, r: 4, n: 5, act: 'talk', personas: ['local', 'tourist_us', 'tourist_cn'] },
                { x: gx, z: gz, r: 0, n: 1, act: 'guide', personas: ['tour_guide'], tour: true, fixedYaw: true, yaw: Math.atan2(s0.x - gx, s0.z - gz) },
            ],
        };
        ctx.sound('traffic', 18, 12, 120, 1); ctx.sound('crowd', 18, 60, 60, 0.6);
        ctx.spawns['bel-lincoln-square'] = { x: sp.spawn.x - 3, z: sp.spawn.z - 3, heading: headingFromBearing(sp.spawn.heading_deg) };
    },
};
