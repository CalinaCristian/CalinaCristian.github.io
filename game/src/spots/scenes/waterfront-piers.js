// ============================================================================
//  Seattle Waterfront — the pier sheds, the Overlook Walk and the businesses, on their OpenStreetMap footprints, as
//  Street View shows them (Google panoramas along the rebuilt Alaskan Way from Seneca St to Pine St, dated Sep 2025
//  where the date is shown; viewed for reference only, nothing copied):
//   Pier 54   pale grey-green two-storey shed (Ivar's, Ye Olde Curiosity Shop)
//   Pier 55   red-brown shed under a dark hipped roof (Starbucks, Argosy ticket office beside it)
//   Pier 56   dark green gabled shed with white trim, Elliott's on the street gable
//   Pier 57   Miners Landing: red shed, MINERS LANDING in gold letters along the top, yellow awnings
//   Pier 59   the Seattle Aquarium: grey-green shed, SEATTLE AQUARIUM on the street front
//   Pier 60   the Aquarium's dark exhibit building; Ocean Pavilion (2024): charcoal ribbed cladding
//   Overlook Walk (2024): a thick pale concrete deck from the Ocean Pavilion roof over Alaskan Way up to MarketFront,
//             on round columns beside the road. It is drawn, not walkable (its stairs and lifts are not built here).
//  Before, every shed was a generic flat-roofed brick / concrete block and the Overlook Walk a tilted sheet.
//  Estimates: eave / ridge heights (Street View; OSM gives 10.9 m for Piers 54 / 55 and 10.9–14.2 m for Pier 57's
//  parts), window rhythm, colours. Deck levels: Ocean Pavilion roof (ground 5 m + OSM height 10.9 m) and the USGS
//  1 m DEM at MarketFront (23.8 m NAVD88 at 47.60951, -122.34293).
//  Businesses: OpenStreetMap, live database of 2026-11-12 (the extract of 2026-11-06 plus the ones in LIVE below);
//  "Elliott's Oyster House" on Pier 56 is not mapped: its sign is there in the Sep 2025 panorama (documented
//  exception, game/research/seattle-spots.md).
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, obb, inPoly, centroid, clamp } from '../kit.js';
import { signBoard } from '../props.js';

const SERIF = (s) => `700 ${s}px Georgia, "Times New Roman", serif`, SANS = (s) => `800 ${s}px "Helvetica Neue", Arial, sans-serif`;
export const SHEDS = {
    w232088564: { name: 'Pier 54', wall: '#a7ab9d', trim: '#e9e6da', roof: '#55585a', eave: 7.5, ridge: 10.9, awning: '#2f5a44', signs: [['PIER 54', 4.2, 0.9, '#a7ab9d', '#2b3a33', SANS]] },
    w166910704: { name: 'Pier 55', wall: '#8a3b2d', trim: '#e6dcc6', roof: '#3b3431', eave: 7.5, ridge: 10.9, hip: true, awning: '#6e2a20', signs: [['PIER 55', 4.2, 0.9, '#8a3b2d', '#f0e2c0', SANS]] },
    w166910697: { name: 'Pier 56', wall: '#3f5b47', trim: '#ece8dc', roof: '#4a4f4c', eave: 7.5, ridge: 11.5, awning: '#2c4434', signs: [["ELLIOTT'S OYSTER HOUSE", 7.5, 1.0, '#ece8dc', '#2c4434', SERIF], ['PIER 56', 4.2, 0.9, '#3f5b47', '#ece8dc', SANS]] },
    w166910699: { name: 'Pier 57', wall: '#8c2f25', trim: '#e3c98a', roof: '#4b4441', eave: 8.5, ridge: 12.5, awning: '#e2b33c', side: 'MINERS LANDING', signs: [['MINERS LANDING', 13, 1.5, '#8c2f25', '#e8c15a', SERIF], ['PIER 57', 4.6, 1.0, '#8c2f25', '#e8c15a', SERIF]] },
    w35345179: { name: 'Pier 59', wall: '#51655c', trim: '#e6e4da', roof: '#3d4345', eave: 8, ridge: 12, awning: null, signs: [['SEATTLE AQUARIUM', 11, 1.3, '#51655c', '#f2f0e6', SANS]] },
};
// appearance only (colour and wall pattern) for mapped buildings that stay generic volumes
export const TINTS = {
    w1256939021: ['#3b3e41', '#4a5a4c', 'industrial'], // Ocean Pavilion: charcoal ribbed metal, planted roof
    w1154870289: ['#3f4a48', '#3a3f41', 'industrial'], // Seattle Aquarium on Pier 60
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
const P57_PARTS = ['w396606855', 'w396606860', 'w429553382', 'w429553383', 'w429553384']; // building:part volumes of Pier 57: one shed here
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
    b.prism(bld.poly, y0 - 0.5, e, S.wall, 'wood');
    for (const s of [-1, 1]) {
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
        const ry = Math.atan2(nx, nz), front = Math.abs(dx * ux + dz * uz) < 0.85 && (mx - o.cx) * ux + (mz - o.cz) * uz > hl - 4;
        if (front) {
            b.box(mx + nx * 0.05, y0 + 0.35, mz + nz * 0.05, L * 0.82, 2.9, 0.14, '#1b252d', 'darkglass', ry);
            for (let k = -2; k <= 2; k++) b.box(mx + dx * k * L * 0.164 + nx * 0.1, y0 + 0.3, mz + dz * k * L * 0.164 + nz * 0.1, 0.16, 3.0, 0.16, S.trim, 'paint', ry);
            if (S.awning) two(b, [ax + dx * L * 0.08 + nx * 0.1, y0 + 3.9, az + dz * L * 0.08 + nz * 0.1], [bx - dx * L * 0.08 + nx * 0.1, y0 + 3.9, bz - dz * L * 0.08 + nz * 0.1], [bx - dx * L * 0.08 + nx * 1.6, y0 + 3.25, bz - dz * L * 0.08 + nz * 1.6], [ax + dx * L * 0.08 + nx * 1.6, y0 + 3.25, az + dz * L * 0.08 + nz * 1.6], S.awning, 'fabric');
            continue;
        }
        const cnt = Math.max(1, Math.floor((L - 2) / 4.4));
        for (let k = 0; k < cnt; k++) { const t = (k + 0.5) / cnt * L, x = ax + dx * t, z = az + dz * t;
            for (const [wy, wh] of S.eave >= 7 ? [[y0 + 1.15, 1.5], [y0 + 4.7, 1.35]] : [[y0 + 1.15, 1.5]]) { b.box(x + nx * 0.03, wy - 0.12, z + nz * 0.03, 1.9, wh + 0.24, 0.1, S.trim, 'paint', ry); b.box(x + nx * 0.07, wy, z + nz * 0.07, 1.62, wh, 0.1, '#1e2a33', 'darkglass', ry); } }
    }
    if (S.side) for (const sd of [-1, 1]) if (sd * vz < 0) { // the name again along the long side that faces north (Pier 58 and the spawn)
        const sg = signBoard(S.side, 12, 1.3, { bg: S.wall, fg: S.signs[0][4], font: SERIF, frame: S.wall, depth: 0.1 }), p = P(hl - 16, sd * (hw + 0.12), e - 1.2);
        sg.position.set(p[0], p[1], p[2]); sg.rotation.y = Math.atan2(sd * vx, sd * vz); ctx.add(sg); }
    // names on the street gable
    let sy = y0 + Math.min(S.eave - 0.9, 6.4);
    for (const [text, w, h, bg, fg, font] of S.signs) { const sg = signBoard(text, Math.min(w, hw * 1.7), h, { bg, fg, font, frame: bg === S.wall ? S.wall : '#1d1f20', depth: 0.1 }); const p = P(hl + 0.12, 0, sy); sg.position.set(p[0], p[1], p[2]); sg.rotation.y = Math.atan2(ux, uz); ctx.add(sg); sy += h + 1.5; }
    ctx.poly(bld.poly);
}

/** the Overlook Walk deck (OSM way 1256939020, man_made=bridge) and its columns beside the covered road (way 1256939017) */
function overlook(ctx, b) {
    const d = ctx.data, g = ctx.ground, ow = d.areas.find((a) => a.id === 'w1256939020'); if (!ow) return;
    const top = (x, z) => 15.5 + clamp((-205 - z) / 74, 0, 1) * 8.5, T = 1.4, col = '#cfcbc2';
    for (const up of [true, false]) { const geo = new THREE.ShapeGeometry(new THREE.Shape(ow.poly.map(([x, z]) => new THREE.Vector2(x, z)))); geo.rotateX(Math.PI / 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, top(p.getX(i), p.getZ(i)) - (up ? 0 : T));
        if (up !== (() => { geo.computeVertexNormals(); return geo.attributes.normal.getY(0) > 0; })()) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals(); }
        b.add(geo, 'concrete', null, up ? col : '#b9b5ac'); geo.dispose(); }
    const n = ow.poly.length;
    for (let i = 0; i < n; i++) { const [ax, az] = ow.poly[i], [bx, bz] = ow.poly[(i + 1) % n], ya = top(ax, az), yb = top(bx, bz);
        two(b, [ax, ya - T, az], [bx, yb - T, bz], [bx, yb + 0.25, bz], [ax, ya + 0.25, az], col, 'concrete'); // edge beam / upstand
        b.rod([ax, ya + 1.1, az], [bx, yb + 1.1, bz], 0.035, '#5c6468', 'metal', 5); if (i % 2 === 0) b.rod([ax, ya + 0.25, az], [ax, ya + 1.1, az], 0.03, '#5c6468', 'metal', 4); }
    const road = d.ways.find((w) => w.id === 'w1256939017')?.pts || [[-95.1, -201], [-79.6, -178.4]];
    const a = road[0], c = road[road.length - 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
    for (let t = -18; t <= L + 18; t += 12) for (const s of [-1, 1]) { const x = a[0] + ux * t - uz * s * 12.5, z = a[1] + uz * t + ux * s * 12.5; if (!inPoly(x, z, ow.poly)) continue; const y = g.heightAt(x, z); b.cyl(x, y, z, 0.75, top(x, z) - T - y, '#c4c0b7', 'concrete', 14); ctx.circle(x, z, 0.8, 9); }
}

/** after ctx.osmBackdrop() */
export function buildPiers(ctx, { deckY, isWater }) {
    const b = new GeoBatch(), built = [];
    for (const [id, S] of Object.entries(SHEDS)) { const bld = ctx.data.buildings.find((q) => q.id === id); if (!bld) continue; shed(ctx, b, bld, S, deckY + 0.08, isWater); built.push(S.name); }
    overlook(ctx, b);
    const m = b.build('waterfront-piers'); ctx.add(m);
    ctx.extras.piers = { sheds: built, tris: b.tris };
    return ctx.extras.piers;
}
