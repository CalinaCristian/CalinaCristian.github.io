// ============================================================================
//  Seattle Waterfront — the pier sheds, the Overlook Walk and the businesses, on their OpenStreetMap footprints, as
//  Street View shows them (Google panoramas along the rebuilt Alaskan Way from Seneca St to Pine St, dated Sep 2025
//  where the date is shown; viewed for reference only, nothing copied):
//   Pier 54   pale grey-green two-storey shed (Ivar's, Ye Olde Curiosity Shop)
//   Pier 55   red-brown shed under a dark hipped roof (Starbucks, Argosy ticket office beside it)
//   Pier 56   dark green gabled shed with white trim, Elliott's on the street gable
//   Pier 57   Miners Landing: red shed, MINERS LANDING in gold letters along the top, yellow awnings
//   Pier 59   the Seattle Aquarium: grey-green shed, SEATTLE AQUARIUM on the street front
//   Pier 60   the Aquarium: a low open-sided shed under a shallow gable; Ocean Pavilion (2024): charcoal ribbed cladding
//   Overlook Walk (2024): a thick pale concrete deck from the Ocean Pavilion roof over Alaskan Way up to MarketFront,
//             on round columns beside the road. It is drawn, not walkable (its stairs and lifts are not built here).
//  Before, every shed was a generic flat-roofed brick / concrete block and the Overlook Walk a tilted sheet.
//  Estimates: eave / ridge heights (Street View; OSM gives 10.9 m for Piers 54 / 55 and 10.9–14.2 m for Pier 57's
//  parts), window rhythm, colours. Deck levels: Ocean Pavilion roof (ground 5 m + OSM height 10.9 m) and the USGS
//  1 m DEM at MarketFront (23.8 m NAVD88 at 47.60951, -122.34293).
//  Businesses: OpenStreetMap, live database of 2026-11-12 (the extract of 2026-11-06 plus the ones in LIVE below);
//  "Elliott's Oyster House" on Pier 56 is not mapped: its sign is there in the Sep 2025 panorama (documented
//  exception, game/research/seattle-spots.md, "Waterfront").
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, obb, inPoly, centroid, clamp } from '../kit.js';
import { signBoard } from '../props.js';
import { gableFrame, gableRoof, gableWalls } from '../gable-plan.js';

const SERIF = (s) => `700 ${s}px Georgia, "Times New Roman", serif`, SANS = (s) => `800 ${s}px "Helvetica Neue", Arial, sans-serif`;
const SHEDS = {
    w232088564: { name: 'Pier 54', wall: '#a7ab9d', trim: '#e9e6da', roof: '#55585a', eave: 7.5, ridge: 10.9, awning: '#2f5a44', signs: [['PIER 54', 4.2, 0.9, '#a7ab9d', '#2b3a33', SANS]] },
    w166910704: { name: 'Pier 55', wall: '#8a3b2d', trim: '#e6dcc6', roof: '#3b3431', eave: 7.5, ridge: 10.9, hip: true, awning: '#6e2a20', signs: [['PIER 55', 4.2, 0.9, '#8a3b2d', '#f0e2c0', SANS]] },
    w166910697: { name: 'Pier 56', wall: '#3f5b47', trim: '#ece8dc', roof: '#4a4f4c', eave: 7.5, ridge: 11.5, awning: '#2c4434', signs: [["ELLIOTT'S OYSTER HOUSE", 7.5, 1.0, '#ece8dc', '#2c4434', SERIF], ['PIER 56', 4.2, 0.9, '#3f5b47', '#ece8dc', SANS]] },
    w166910699: { name: 'Pier 57', wall: '#8c2f25', trim: '#e3c98a', roof: '#4b4441', eave: 8.5, ridge: 12.5, awning: '#e2b33c', side: 'MINERS LANDING', parts: true, signs: [['MINERS LANDING', 13, 1.5, '#8c2f25', '#e8c15a', SERIF], ['PIER 57', 4.6, 1.0, '#8c2f25', '#e8c15a', SERIF]] },
    w35345179: { name: 'Pier 59', wall: '#51655c', trim: '#e6e4da', roof: '#3d4345', eave: 8, ridge: 12, awning: null, signs: [['SEATTLE AQUARIUM', 11, 1.3, '#51655c', '#f2f0e6', SANS]] },
};
// appearance only (colour and wall pattern) for mapped buildings that stay generic volumes
const TINTS = {
    w1256939021: ['#3b3e41', '#4a5a4c', 'industrial'], // Ocean Pavilion: charcoal ribbed metal, planted roof
    w184870422: ['#a8a59c', '#8a8784', 'parking'],     // Pike Place Market garage
    w234810726: ['#8a3b2d', '#3b3431', 'house'],       // Argosy Cruises ticket office
    w429553385: ['#f1efe8', '#3d5f8a', 'house'],       // Great Wheel ticket booth
};
// in the live OSM database on 2026-11-12, not in the extract: [name, x, z, kind, level]
const LIVE = [
    ["Mark's Ark", 8.5, 81.1, 'shop', 0], ['Pirates Plunder', 43.4, 82.4, 'shop', 0], ['Sports Den', 14.4, 99.7, 'shop', 0], ['The Sourdough Bakery', 27.3, 83.9, 'shop', 0],
    ['The Seattle Shop at Pier 56', 95.6, 156.6, 'shop', 0], ['WingDome', 99.7, 172.8, 'restaurant', 0],
    ['Starbucks', 142.4, 228.4, 'cafe', 0], ['Seattle Shirt Company', 150, 240.9, 'shop', 0], ['Burgundy Viscosi Gallery', 129, 227.7, 'shop', 0],
    ["Ivar's Acres of Clams", 191.1, 323, 'restaurant', 0], ['Ye Olde Curiosity Shop', 118.1, 287.4, 'shop', 0], ['Simply Seattle', 189.9, 309.3, 'shop', 0], ["Ivar's Fish Bar", 203.4, 327.3, 'cafe', 0],
    ['Great State Burger', 181.7, 294.9, 'fast_food', 0], ['Premier Meat Pies', 148.3, 290.6, 'restaurant', 0], ['Harley-Davidson Motorcycles', 136.8, 295.5, 'shop', 0],
    ['Copperworks Tasting Room & Distillery', 140.6, 99.2, 'bar', 0],
];
const P57_PARTS = ['w396606855', 'w396606860', 'w429553382', 'w429553383', 'w429553384']; // building:part volumes of Pier 57
// (r3-sea-spots-b-6) Pier 57 is several sheds joined (seattle-spots.md "Waterfront"): each mapped building:part is its own
// gabled volume at its OSM height (building:levels → h), the ridge along the pier: the 3-level main shed (10.9 m) under the
// 4-level raised middle shed (14.2 m, w396606860) running down its spine, the 2-level street-end shed on the slanted
// Alaskan Way front (w429553384, 7.6 m, ridge along that front), the 2-level west shed round the middle shed's end
// (w429553382) and the 1-level west tip (w396606855). Eave heights (ridge − 1.4 / 1.6 / 2.4 / 0.7 m) are estimates.
// [id, eave, ridge, axis: 'pier' (the middle shed's axis) | 'own' (the part's long axis), main span half-width]
const P57_SHEDS = [['w429553383', 8.5, 10.9, 'pier', 15.55], ['w396606860', 12.6, 14.2, 'pier'], ['w429553384', 6.2, 7.6, 'own'], ['w429553382', 6.2, 7.6, 'pier'], ['w396606855', 3.6, 4.3, 'pier']];
function pier57Parts(ctx) {
    const by = (id) => ctx.data.buildings.find((b) => b.id === id), spine = by('w396606860'); if (!spine) return null;
    const S0 = gableFrame(spine.poly, { eave: 12.6, ridge: 14.2 }), out = [];
    for (const [id, eave, ridge, axis, hw] of P57_SHEDS) { const bd = by(id); if (!bd) continue;
        let F = axis === 'pier' ? gableFrame(bd.poly, { ux: S0.ux, uz: S0.uz, eave, ridge }) : gableFrame(bd.poly, { eave, ridge });
        // the main shed's ridge runs under the middle shed's (same axis: the V of the two frames differ by a constant)
        if (hw) F = gableFrame(bd.poly, { ux: S0.ux, uz: S0.uz, eave, ridge, vMid: S0.vMid + F.V(0, 0) - S0.V(0, 0), hw, minTop: eave - 2.5 });
        out.push({ id, poly: bd.poly, F, ridge }); }
    return out;
}
const FOOD = /^(restaurant|cafe|fast_food|bar|pub|ice_cream)$/;

/** every mapped business of the scene as { id, name, x, z, kind, level } (points, indoor rooms, named buildings, live additions) */
export function waterfrontBusinesses(d) {
    const out = [], kindOf = (p) => (p.shop ? 'shop' : FOOD.test(p.amenity || '') ? p.amenity : /^(hotel|gallery)$/.test(p.tourism || '') ? p.tourism : p.leisure === 'amusement_arcade' || p.tourism === 'attraction' ? 'shop' : null);
    for (const p of d.pois || []) { const k = p.name && kindOf(p); if (k && !/Great Wheel$/.test(p.name)) out.push({ id: p.id, name: p.name, x: p.x, z: p.z, kind: k, level: parseFloat(p.level) || 0 }); }
    for (const a of d.areas || []) { const k = a.name && a.indoor && kindOf(a); if (k) { const [x, z] = centroid(a.poly); out.push({ id: a.id, name: a.name, x, z, kind: k, level: parseFloat(a.level) || 0 }); } }
    for (const b of d.buildings || []) { const k = b.name && !SHEDS[b.id] && !b.part && kindOf(b); if (k && !/Tickets$|Argosy/.test(b.name)) { const [x, z] = centroid(b.poly); out.push({ id: b.id, name: b.name, x, z, kind: k, level: 0 }); } }
    LIVE.forEach(([name, x, z, kind, level], i) => out.push({ id: 'live' + i, name, x, z, kind, level }));
    return out;
}

/** before ctx.osmBackdrop(): the sheds replace their generic volumes; tints for the buildings that stay */
export function preparePiers(ctx) {
    for (const id of [...Object.keys(SHEDS), ...P57_PARTS]) if (ctx.data.buildings.some((b) => b.id === id)) ctx.skipBuildings.add(id);
    for (const b of ctx.data.buildings) { const t = TINTS[b.id]; if (t) { b.c = t[0]; b.rc = t[1]; } }
    // Pier 60 (w1154870289): drawn by pier60() as an open-sided shed (no generic volume)
    if (ctx.data.buildings.some((b) => b.id === 'w1154870289')) ctx.skipBuildings.add('w1154870289');
}
export const pierStyle = (bd) => TINTS[bd.id]?.[2];

// thin sheets seen from both sides (roof planes, gables, awnings, the deck's edge): one two-sided face, not two coincident ones
const BOTH = { side: THREE.DoubleSide };
const two = (b, p0, p1, p2, p3, col, key) => { const tri = p2 === p3 || (p2[0] === p3[0] && p2[1] === p3[1] && p2[2] === p3[2]), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri ? [...p0, ...p1, ...p2] : [...p0, ...p1, ...p2, ...p3], 3)); g.setIndex(tri ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); b.add(g, key, null, col, BOTH); g.dispose(); };

function shed(ctx, b, bld, S, y0, isWater) {
    const o = obb(bld.poly); if (!o) return;
    let ux = o.ux, uz = o.uz, hl = o.len / 2, hw = o.wid / 2; if (o.wid > o.len) { [ux, uz] = [-uz, ux]; hl = o.wid / 2; hw = o.len / 2; }
    // u points to the street end (the end on land)
    if (isWater(o.cx + ux * (hl + 8), o.cz + uz * (hl + 8)) && !isWater(o.cx - ux * (hl + 8), o.cz - uz * (hl + 8))) { ux = -ux; uz = -uz; }
    const vx = -uz, vz = ux, P = (u, v, y) => [o.cx + ux * u + vx * v, y, o.cz + uz * u + vz * v], e = y0 + S.eave, r = y0 + S.ridge, ov = 0.6, hip = S.hip ? hw : 0;
    const PT = S.parts ? pier57Parts(ctx) : null;
    // wall top at a point just inside the footprint (the part holding it; Infinity for a one-roof shed)
    const topAt = (x, z) => { if (!PT) return Infinity; let t = -Infinity; for (const q of PT) if (inPoly(x, z, q.poly)) t = Math.max(t, y0 + q.F.top(x, z)); return t; };
    if (PT) for (const q of PT) {
        // a party wall is drawn only by the taller of the two parts it divides
        const F = { ...q.F, top: (x, z) => y0 + q.F.top(x, z) };
        gableWalls(b, q.poly, F, y0 - 0.5, { color: S.wall, key: 'wood', skip: (mx, mz, nx, nz) => PT.some((o2) => o2 !== q && o2.ridge > q.ridge && inPoly(mx + nx * 0.3, mz + nz * 0.3, o2.poly)) });
        gableRoof(b, q.poly, F, { color: S.roof, overhang: 0.45, lift: 0.02, thick: 0.3, fascia: S.trim });
        // clerestory windows on the raised middle shed's long walls, above the main roof (spacing as the walls below)
        if (q.id === 'w396606860') for (let i = 0; i < q.poly.length; i++) { const [ax, az] = q.poly[i], [bx, bz] = q.poly[(i + 1) % q.poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 12) continue;
            const dx = (bx - ax) / L, dz = (bz - az) / L; if (Math.abs(dx * q.F.ux + dz * q.F.uz) < 0.9) continue; let nx = dz, nz = -dx; if (inPoly((ax + bx) / 2 + nx * 0.3, (az + bz) / 2 + nz * 0.3, q.poly)) { nx = -nx; nz = -nz; }
            for (let t = 4; t < L - 3; t += 4.4) { const x = ax + dx * t, z = az + dz * t, wy = y0 + 10.95; b.box(x + nx * 0.03, wy - 0.1, z + nz * 0.03, 1.8, 1.1, 0.1, S.trim, 'paint', Math.atan2(nx, nz)); b.box(x + nx * 0.07, wy, z + nz * 0.07, 1.55, 0.9, 0.1, '#1e2a33', 'darkglass', Math.atan2(nx, nz)); } }
    }
    else b.prism(bld.poly, y0 - 0.5, e, S.wall, 'wood');
    if (!PT) for (const s of [-1, 1]) {
        two(b, P(-hl - ov, s * (hw + ov), e - 0.1), P(hl + ov, s * (hw + ov), e - 0.1), P(hl + ov - hip, 0, r), P(-hl - ov + hip, 0, r), S.roof, 'roofs');
        b.box(...P(0, s * (hw + ov), e - 0.38), 0.14, 0.3, 2 * (hl + ov), S.trim, 'paint', Math.atan2(ux, uz)); // eave fascia
        if (hip) two(b, P(s * (hl + ov), -hw - ov, e - 0.1), P(s * (hl + ov), hw + ov, e - 0.1), P(s * (hl + ov - hip), 0, r), P(s * (hl + ov - hip), 0, r), S.roof, 'roofs');
        else { two(b, P(s * hl, -hw, e), P(s * hl, hw, e), P(s * hl, 0, r - 0.25), P(s * hl, 0, r - 0.25), S.wall, 'wood');
            for (const q of [-1, 1]) b.rod(P(s * (hl + ov), q * (hw + ov), e - 0.05), P(s * (hl + ov), 0, r + 0.05), 0.11, S.trim, 'paint', 4); } // barge boards
    }
    // windows and street front, edge by edge of the mapped footprint
    const n = bld.poly.length;
    for (let i = 0; i < n; i++) {
        const [ax, az] = bld.poly[i], [bx, bz] = bld.poly[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 5) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L; let nx = dz, nz = -dx; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (inPoly(mx + nx * 0.5, mz + nz * 0.5, bld.poly)) { nx = -nx; nz = -nz; }
        // the street end: an edge across the pier near its land end; a slanted end (Pier 56: cut at ≈ 58° over 20 m) reaches
        // back from the end by half its own run along the pier, so its midpoint is measured from there (sea-spots-a-3)
        const ry = Math.atan2(nx, nz), front = Math.abs(dx * ux + dz * uz) < 0.85 && (PT ? !isWater(mx + nx * 8, mz + nz * 8) : (mx - o.cx) * ux + (mz - o.cz) * uz > hl - 4 - Math.abs(dx * ux + dz * uz) * L / 2);
        if (front) {
            b.box(mx + nx * 0.05, y0 + 0.35, mz + nz * 0.05, L * 0.82, 2.9, 0.14, '#1b252d', 'darkglass', ry);
            for (let k = -2; k <= 2; k++) b.box(mx + dx * k * L * 0.164 + nx * 0.1, y0 + 0.3, mz + dz * k * L * 0.164 + nz * 0.1, 0.16, 3.0, 0.16, S.trim, 'paint', ry);
            if (S.awning) two(b, [ax + dx * L * 0.08 + nx * 0.1, y0 + 3.9, az + dz * L * 0.08 + nz * 0.1], [bx - dx * L * 0.08 + nx * 0.1, y0 + 3.9, bz - dz * L * 0.08 + nz * 0.1], [bx - dx * L * 0.08 + nx * 1.6, y0 + 3.25, bz - dz * L * 0.08 + nz * 1.6], [ax + dx * L * 0.08 + nx * 1.6, y0 + 3.25, az + dz * L * 0.08 + nz * 1.6], S.awning, 'fabric');
            continue;
        }
        const cnt = Math.max(1, Math.floor((L - 2) / 4.4));
        for (let k = 0; k < cnt; k++) { const t = (k + 0.5) / cnt * L, x = ax + dx * t, z = az + dz * t, wt = topAt(x - nx * 0.3, z - nz * 0.3);
            for (const [wy, wh] of S.eave >= 7 ? [[y0 + 1.15, 1.5], [y0 + 4.7, 1.35]] : [[y0 + 1.15, 1.5]]) { if (wy + wh + 0.4 > wt) continue; b.box(x + nx * 0.03, wy - 0.12, z + nz * 0.03, 1.9, wh + 0.24, 0.1, S.trim, 'paint', ry); b.box(x + nx * 0.07, wy, z + nz * 0.07, 1.62, wh, 0.1, '#1e2a33', 'darkglass', ry); } }
    }
    if (S.side) for (const sd of [-1, 1]) if (sd * vz < 0) { // the name again along the long side that faces north (Pier 58 and the spawn)
        // round 3 (sea-spots-a-10): on the mapped wall piece itself (the longest footprint edge facing that side), not on the
        // bounding box's side, which floats off the recessed parts of Pier 57
        let best = null; for (let i = 0; i < n; i++) { const [ax, az] = bld.poly[i], [bx, bz] = bld.poly[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 13) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * 0.5, mz + nz * 0.5, bld.poly)) { nx = -nx; nz = -nz; }
            if (nx * sd * vx + nz * sd * vz > 0.9 && (!best || L > best.L)) best = { L, mx, mz, nx, nz, dx: (bx - ax) / L, dz: (bz - az) / L }; }
        const sg = signBoard(S.side, 12, 1.3, { bg: S.wall, fg: S.signs[0][4], font: SERIF, frame: S.wall, depth: 0.1 });
        if (best) { const along = clamp(hl - 16 - ((best.mx - o.cx) * ux + (best.mz - o.cz) * uz), -(best.L / 2 - 6.2), best.L / 2 - 6.2), k = best.dx * ux + best.dz * uz >= 0 ? 1 : -1;
            sg.position.set(best.mx + best.dx * along * k + best.nx * 0.12, e - 1.2, best.mz + best.dz * along * k + best.nz * 0.12); sg.rotation.y = Math.atan2(best.nx, best.nz); }
        else { const p = P(hl - 16, sd * (hw + 0.12), e - 1.2); sg.position.set(p[0], p[1], p[2]); sg.rotation.y = Math.atan2(sd * vx, sd * vz); }
        ctx.add(sg); }
    // names on the street gable
    if (PT) { pier57Names(ctx, PT, S, y0, isWater); ctx.poly(bld.poly); return; }
    let sy = y0 + Math.min(S.eave - 0.9, 6.4);
    for (const [text, w, h, bg, fg, font] of S.signs) { const sg = signBoard(text, Math.min(w, hw * 1.7), h, { bg, fg, font, frame: bg === S.wall ? S.wall : '#1d1f20', depth: 0.1 }); const p = P(hl + 0.12, 0, sy); sg.position.set(p[0], p[1], p[2]); sg.rotation.y = Math.atan2(ux, uz); ctx.add(sg); sy += h + 1.5; }
    ctx.poly(bld.poly);
}

// Pier 57's names: MINERS LANDING along the top of the street-end shed's slanted Alaskan Way front (its longest land-facing
// edge), PIER 57 on the main shed's gable wall above and behind it
function pier57Names(ctx, PT, S, y0, isWater) {
    const face = (q) => { let best = null; const P = q.poly, n = P.length;
        for (let i = 0; i < n; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }
            if (isWater(mx + nx * 8, mz + nz * 8) || Math.abs(nx * q.F.ux + nz * q.F.uz) > 0.95 && q.id !== 'w429553383') continue;
            if (q.id === 'w429553383' && !PT.some((o2) => o2.id === 'w429553384' && inPoly(mx + nx * 0.3, mz + nz * 0.3, o2.poly))) continue; // the gable wall above the street shed
            if (!best || L > best.L) best = { L, mx, mz, nx, nz }; }
        return best; };
    const put = (q, [text, w, h, bg, fg, font], below) => { const f = face(q); if (!f) return;
        const sg = signBoard(text, Math.min(w, f.L * 0.8), h, { bg, fg, font, frame: bg === S.wall ? S.wall : '#1d1f20', depth: 0.1 });
        sg.position.set(f.mx + f.nx * 0.12, y0 + q.F.top(f.mx - f.nx * 0.3, f.mz - f.nz * 0.3) - below - h / 2, f.mz + f.nz * 0.12); sg.rotation.y = Math.atan2(f.nx, f.nz); ctx.add(sg); };
    const street = PT.find((q) => q.id === 'w429553384'), main = PT.find((q) => q.id === 'w429553383');
    if (street) put(street, S.signs[0], 0.45);
    if (main) put(main, S.signs[1], 0.8);
}

/** the Overlook Walk deck (OSM way 1256939020, man_made=bridge) and its columns beside the covered road (way 1256939017) */
function overlook(ctx, b) {
    const d = ctx.data, g = ctx.ground, ow = d.areas.find((a) => a.id === 'w1256939020'); if (!ow) return;
    const top = (x, z) => 15.5 + clamp((-205 - z) / 74, 0, 1) * 8.5, T = 1.4, col = '#cfcbc2';
    for (const up of [true, false]) { const geo = new THREE.ShapeGeometry(new THREE.Shape(ow.poly.map(([x, z]) => new THREE.Vector2(x, z)))); geo.rotateX(Math.PI / 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, top(p.getX(i), p.getZ(i)) - (up ? 0 : T));
        if (up !== (() => { geo.computeVertexNormals(); return geo.attributes.normal.getY(0) > 0; })()) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals(); }
        b.add(geo, 'concrete', null, up ? col : '#b9b5ac'); geo.dispose(); }
    const n = ow.poly.length, open = overlookOpenings(d); // (round 3: no railing, no upstand across the mapped stair heads)
    for (let i = 0; i < n; i++) { const [ax, az] = ow.poly[i], [bx, bz] = ow.poly[(i + 1) % n], ya = top(ax, az), yb = top(bx, bz);
        two(b, [ax, ya - T, az], [bx, yb - T, bz], [bx, yb + (open((ax + bx) / 2, (az + bz) / 2) ? 0 : 0.25), bz], [ax, ya + (open((ax + bx) / 2, (az + bz) / 2) ? 0 : 0.25), az], col, 'concrete'); // edge beam / upstand
        if (!open((ax + bx) / 2, (az + bz) / 2)) b.rod([ax, ya + 1.1, az], [bx, yb + 1.1, bz], 0.035, '#5c6468', 'metal', 5); if (i % 2 === 0 && !open(ax, az)) b.rod([ax, ya + 0.25, az], [ax, ya + 1.1, az], 0.03, '#5c6468', 'metal', 4); }
    const road = d.ways.find((w) => w.id === 'w1256939017')?.pts || [[-95.1, -201], [-79.6, -178.4]];
    const a = road[0], c = road[road.length - 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
    for (let t = -18; t <= L + 18; t += 12) for (const s of [-1, 1]) { const x = a[0] + ux * t - uz * s * 12.5, z = a[1] + uz * t + ux * s * 12.5; if (!inPoly(x, z, ow.poly)) continue; const y = g.heightAt(x, z); b.cyl(x, y, z, 0.75, top(x, z) - T - y, '#c4c0b7', 'concrete', 14); ctx.circle(x, z, 0.8, 9); }
    return walkOverlook(ctx, b, ow, top, T);
}

/**
 * Round 3 (sea-spots-a-1): the Overlook Walk is walkable. The deck (OSM w1256939020) is a solid with its top at the deck
 * level and its underside T below, so Alaskan Way (w1256939017, layer −1) still runs underneath; railings are walls in the
 * deck's height band, open only where mapped stairs join it. Access as mapped: the Salish Steps (w1320933922 + w1320933923,
 * steps "down" from the deck's west edge to the promenade), joined on the deck by the bridge steps w1320933924/5, and the
 * stair core at the deck's east end (w1289027232–4 levels 1–3, footway w1289027233 level 4 on top, w1256939012): a
 * four-level core too small to walk with the game's body, so it is a "take the stairs" use between its foot and the
 * deck. Estimates: the Salish Steps' width (6.5 m, panorama cLi3KbZ4ALUiPoUywFMtKw looking 70°) and their even fall; the deck stays at one level over its west lobe
 * (the bridge steps' own fall is not known).
 */
/** (x, z) on the deck edge where a mapped stair joins it: the Salish Steps' head (w1320933922) and the east stair core */
function overlookOpenings(d) {
    const way = (id) => d.ways.find((w) => w.id === id)?.pts || null, s = way('w1320933922'), c = way('w1289027232') || way('w1256939012'), pts = [];
    if (s) pts.push([s[0][0], s[0][1], 6.5 / 2 + 0.8]);
    if (c) pts.push([c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length, 5.5]);
    return (x, z) => pts.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r);
}
function walkOverlook(ctx, b, ow, top, T) {
    const g = ctx.ground, d = ctx.data, way = (id) => d.ways.find((w) => w.id === id)?.pts || null, out = { deck: true };
    const lo = Math.min(...ow.poly.map(([x, z]) => top(x, z)));
    g.addPoly(ow.poly, top, lo - T, { kind: 'overlook-walk' });
    // the Salish Steps: one flight along the mapped ways, deck edge → promenade
    const s1 = way('w1320933922'), s2 = way('w1320933923'), chain = s1 && s2 ? [...s1, ...s2.slice(1)] : null, gaps = [];
    if (chain) {
        const [x0, z0] = chain[0], [x1, z1] = chain[chain.length - 1], yTop = top(x0, z0), yBot = g.heightAt(x1 - 1.5, z1 + 0.5), W = 6.5;
        let Ltot = 0; const cum = [0]; for (let i = 1; i < chain.length; i++) { Ltot += Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]); cum.push(Ltot); }
        const yAt = (s) => yTop + (yBot - yTop) * (s / Ltot);
        for (let i = 1; i < chain.length; i++) {
            const [ax, az] = chain[i - 1], [bx, bz] = chain[i], L = cum[i] - cum[i - 1], ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            const ext = i === 1 ? -0.6 : 0, quad = [[ax - ux * 0.6 + nx * W / 2, az - uz * 0.6 + nz * W / 2], [bx + ux * 0.6 + nx * W / 2, bz + uz * 0.6 + nz * W / 2], [bx + ux * 0.6 - nx * W / 2, bz + uz * 0.6 - nz * W / 2], [ax - ux * 0.6 - nx * W / 2, az - uz * 0.6 - nz * W / 2]];
            void ext;
            g.addPoly(quad, (x, z) => yAt(clamp(cum[i - 1] + ((x - ax) * ux + (z - az) * uz), 0, Ltot)), Math.min(yAt(cum[i]), yAt(cum[i - 1])) - 1.2, { kind: 'salish-steps' });
            // treads (0.17 m risers), stringer walls and handrails
            const n = Math.max(1, Math.round((yAt(cum[i - 1]) - yAt(cum[i])) / 0.17));
            for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = yAt(cum[i - 1] + L * t); b.box(x, y - 0.17, z, W, 0.17, L / n + 0.02, '#c9c5bc', 'concrete', Math.atan2(ux, uz)); }
            for (const s of [-1, 1]) { const px = nx * s * (W / 2 + 0.15), pz = nz * s * (W / 2 + 0.15), ya = yAt(cum[i - 1]), yb = yAt(cum[i]);
                two(b, [ax + px, g.heightAt(ax + px, az + pz) - 0.3, az + pz], [bx + px, g.heightAt(bx + px, bz + pz) - 0.3, bz + pz], [bx + px, yb + 0.2, bz + pz], [ax + px, ya + 0.2, az + pz], '#bdb9b0', 'concrete');
                b.rod([ax + px, ya + 1.05, az + pz], [bx + px, yb + 1.05, bz + pz], 0.035, '#5c6468', 'metal', 5);
                ctx.collider({ wall: true, kind: 'salish-steps-rail', ax: ax + px, az: az + pz, bx: bx + px, bz: bz + pz, y0a: yBot - 1, y0b: yBot - 1, y1a: ya + 1.1, /* closed down to the promenade (cheek walls) */ y1b: yb + 1.1, nx: nx * s, nz: nz * s, x: (ax + bx) / 2 + px, z: (az + bz) / 2 + pz, r: L / 2 + 1, hw: 0, hd: 0, angle: 0, poly: null, h: 0 }); }
        }
        // the cheek wall under the flight down to the ground
        gaps.push({ x: x0, z: z0, r: W / 2 + 0.8 });
        out.salishSteps = { from: [x0, z0, +yTop.toFixed(2)], to: [x1, z1, +yBot.toFixed(2)], length: +Ltot.toFixed(1), slope: +((yTop - yBot) / Ltot).toFixed(2) };
    }
    // the east stair core (levels 1–4): a concrete tower; "take the stairs" between its foot and the deck
    const core = way('w1289027232') || way('w1256939012');
    if (core) {
        const cx = core.reduce((s, p) => s + p[0], 0) / core.length, cz = core.reduce((s, p) => s + p[1], 0) / core.length, yG = g.heightAt(cx, cz), yD = top(cx, cz);
        b.box(cx, yG, cz, 4.2, yD + 1.2 - yG, 3.6, '#bdb9b0', 'concrete', 0.55); ctx.box(cx, cz, 2.1, 1.8, -0.55, { h: yD - yG + 1.2 });
        let foot = null, deck = null; for (let r = 3; r < 9 && (!foot || !deck); r += 0.5) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (!deck && inPoly(x, z, ow.poly)) deck = { x, z }; if (!foot && !inPoly(x, z, ow.poly) && Math.abs(g.heightAt(x, z) - yG) < 0.6) foot = { x, z }; }
        if (foot && deck) {
            gaps.push({ x: deck.x, z: deck.z, r: 3.5 });
            const go = (s, p, y) => { s.ctl.y = y; s.ctl.teleport(p.x, p.z, s.ctl.heading); s.sound?.play?.('step'); };
            ctx.interactables.push({ kind: 'stairs', x: foot.x, z: foot.z, r: 2.6, label: 'Take the stairs up to the Overlook Walk', use: (s) => go(s, deck, yD) });
            ctx.interactables.push({ kind: 'stairs', x: deck.x, z: deck.z, r: 2.6, label: 'Take the stairs down to Alaskan Way', use: (s) => go(s, foot, g.heightAt(foot.x, foot.z)) });
            out.stairCore = { at: [+cx.toFixed(1), +cz.toFixed(1)], foot: [+foot.x.toFixed(1), +foot.z.toFixed(1)], deck: [+deck.x.toFixed(1), +deck.z.toFixed(1)], rise: +(yD - yG).toFixed(2) };
        }
    }
    // railings: walls in the deck's band along every edge, open where stairs join
    let rails = 0; const openAt = overlookOpenings(d);
    for (let i = 0; i < ow.poly.length; i++) { const [ax, az] = ow.poly[i], [bx, bz] = ow.poly[(i + 1) % ow.poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (openAt(mx, mz) || gaps.some((q) => Math.hypot(mx - q.x, mz - q.z) < q.r)) continue;
        const ya = top(ax, az), yb = top(bx, bz);
        ctx.collider({ wall: true, kind: 'overlook-rail', ax, az, bx, bz, y0a: ya - 0.3, y0b: yb - 0.3, y1a: ya + 1.1, y1b: yb + 1.1, nx: (bz - az) / L, nz: -(bx - ax) / L, x: mx, z: mz, r: L / 2 + 1, hw: 0, hd: 0, angle: 0, poly: null, h: 0 }); rails++; }
    out.rails = rails;
    ctx.extras.overlookWalk = out;
    return out;
}

/**
 * (r3-sea-spots-b-6) Pier 60 (w1154870289, building=yes, no height or roof tags): official panorama VuVTZJti0rfyEFN0lJAiMQ
 * looking 240° shows a low open-sided shed under a shallow gable in the Aquarium's grey-green. The gable is clipped to the
 * irregular 59-vertex plan (gable-plan.js; a gable over the bounding box overhung the water and the promenade), ridge along
 * the plan's long axis, on posts round the plan; the deck stays walkable under it. Eave 5.2 m, ridge 7 m, post spacing
 * ≈ 6 m, 0.6 m overhang and the colours are estimates.
 */
function pier60(ctx, b, y0) {
    const bld = ctx.data.buildings.find((q) => q.id === 'w1154870289'); if (!bld) return null;
    const F0 = gableFrame(bld.poly, { eave: 5.2, ridge: 7 }); if (!F0) return null;
    const F = { ...F0, top: (x, z) => y0 + F0.top(x, z) }, P = bld.poly, n = P.length, post = '#51655c';
    gableRoof(b, P, F, { color: '#3d4345', overhang: 0.6, thick: 0.45, fascia: '#e6e4da' });
    gableRoof(b, P, F, { color: '#9a9d94', key: 'paint', overhang: 0.6, lift: -0.45 }); // pale soffit under the roof deck
    let posts = 0, run = 0;
    const at = (x, z) => { const h = F.top(x, z) - 0.45 - y0; b.box(x, y0, z, 0.32, h, 0.32, post, 'paint'); ctx.circle(x, z, 0.25, h); posts++; };
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], c = P[i], e = P[(i + 1) % n], L = Math.hypot(e[0] - c[0], e[1] - c[1]);
        const turn = Math.abs(Math.atan2((c[0] - a[0]) * (e[1] - c[1]) - (c[1] - a[1]) * (e[0] - c[0]), (c[0] - a[0]) * (e[0] - c[0]) + (c[1] - a[1]) * (e[1] - c[1])));
        if (turn > 0.35 || run > 5) { at(c[0], c[1]); run = 0; }
        for (let t = 6; t < L - 2; t += 6) at(c[0] + (e[0] - c[0]) * t / L, c[1] + (e[1] - c[1]) * t / L);
        run += L % 6; }
    return { source: bld.id, posts, eave: +(y0 + 5.2).toFixed(2), ridge: +(y0 + 7).toFixed(2) };
}

function norm2(x, z) { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; }
/** after ctx.osmBackdrop() */
export function buildPiers(ctx, { deckY, isWater }) {
    const b = new GeoBatch(), built = [];
    for (const [id, S] of Object.entries(SHEDS)) { const bld = ctx.data.buildings.find((q) => q.id === id); if (!bld) continue; shed(ctx, b, bld, S, deckY + 0.08, isWater); built.push(S.name); }
    overlook(ctx, b);
    ctx.extras.pier60 = pier60(ctx, b, deckY + 0.08);
    // round 3 (sea-spots-a-2): the Ocean Pavilion (w1256939021) stands on a board-formed concrete base about 2.2 m high under
    // its charcoal ribbed cladding, with a grey steel handrail along the sidewalk (panoramas d_zvaPdDFeRnyCx2epCvqA looking
    // 250°, nVwg3181AIHZBcGR4Gy80w looking 270°). Base height estimated from those views.
    { const op = ctx.data.buildings.find((q) => q.id === 'w1256939021');
      if (op) { const P = op.poly, n = P.length, A = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1, out = [];
        for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], c = P[i], e = P[(i + 1) % n]; const n1 = norm2(c[1] - a[1], -(c[0] - a[0])), n2 = norm2(e[1] - c[1], -(e[0] - c[0])); let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const L = Math.hypot(mx, mz) || 1; mx /= L; mz /= L; const k = 0.07 / Math.max(0.4, mx * n1[0] + mz * n1[1]); out.push([c[0] + A * mx * k, c[1] + A * mz * k]); }
        const y0 = Math.min(...P.map(([x, z]) => ctx.ground.heightAt(x, z))) - 0.3;
        b.prism(out, y0, y0 + 2.5, '#b9b6ad', 'concrete', { noTop: true });
        ctx.extras.oceanPavilionBase = { source: op.id, top: +(y0 + 2.5).toFixed(2) }; } }
    const m = b.build('waterfront-piers'); ctx.add(m);
    ctx.extras.piers = { sheds: built, tris: b.tris };
    return ctx.extras.piers;
}
