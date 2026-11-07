// ============================================================================
//  OSM backdrop for spot scenes: ground painting (areas, roads, sidewalks,
//  crossings, markings), building extrusions with procedural façades + night
//  windows, roofs, street/park trees (season-tinted by render.js), street
//  lamps (render.js light pool), street furniture props and water planes.
//  Hero builders exclude/replace anything here by id or polygon.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, mat, rng, hash2, fbm2, polyArea, inPoly, centroid, polyBox, obb, distPolyline, alongPolyline, polylineLength, offsetPolyline, canvas, canvasTexture, clamp, M } from './kit.js';

// ---------------------------------------------------------------------------- palettes (Seattle defaults; scenes override)
export const COL = {
    asphalt: '#4d4e52', asphaltWorn: '#5a5b5e', concreteRoad: '#a29e96', sidewalk: '#b5b1a8', kerb: '#8a867e', grass: '#5d7a3a', lawn: '#62803f',
    wood: '#3d4d2a', scrub: '#50632f', dirt: '#7a6a52', gravel: '#a39a86', brick: '#8b4a37', pavers: '#a38f7a', sand: '#cbb995', water: '#28434f',
    bark: '#8a6a4b', deck: '#8d7a62', yellow: '#d6ac2c', white: '#e8e6df', parking: '#56575b', building: '#5f5c56', flower: '#5b5a2e',
};
const ROAD_W = { motorway: 14, trunk: 14, primary: 14, secondary: 12.5, tertiary: 10.5, unclassified: 8, residential: 8.5, living_street: 6, service: 5, trunk_link: 7, primary_link: 7, secondary_link: 7, motorway_link: 7, construction: 7, pedestrian: 6, road: 7 };
const FOOT_W = { footway: 2.2, path: 1.6, cycleway: 2.6, steps: 2.4, bridleway: 2, track: 3, pedestrian: 5 };
export const isMotorRoad = (k) => k in ROAD_W && k !== 'pedestrian';
/** carriageway width of an OSM road (width tag, lanes, or the class default) */
export function roadWidth(w) { const lw = parseFloat(w.width); if (lw > 2) return lw; const lanes = parseInt(w.lanes, 10); const base = ROAD_W[w.k] || 7; return lanes > 0 ? Math.max(base * 0.6, lanes * 3.3 + (['primary', 'secondary', 'tertiary', 'residential', 'unclassified'].includes(w.k) ? 2.6 : 0.4)) : base; }
/**
 * point-on-carriageway test for ground-level motor roads (note 29: no lamps / trees / furniture in the traffic lanes):
 * fn(x, z, margin = 0.3) → true when (x, z) is within half the carriageway width + margin of a road's centreline
 */
export function carriagewayTest(data, { skipWays = new Set() } = {}) {
    const cell = 24, grid = new Map(), key = (i, j) => i * 92821 + j;
    for (const w of data.ways || []) {
        if (skipWays.has(w.id) || !onGround(w) || !isMotorRoad(w.k) || w.area === 'yes' || !w.pts || w.pts.length < 2) continue;
        const hw = roadWidth(w) / 2;
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], seg = [ax, az, bx, bz, hw];
            for (let gi = Math.floor((Math.min(ax, bx) - hw) / cell); gi <= Math.floor((Math.max(ax, bx) + hw) / cell); gi++)
                for (let gj = Math.floor((Math.min(az, bz) - hw) / cell); gj <= Math.floor((Math.max(az, bz) + hw) / cell); gj++) { const k = key(gi, gj); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(seg); }
        }
    }
    return (x, z, margin = 0.3) => { const b = grid.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!b) return false; for (const [ax, az, bx, bz, hw] of b) if (distSegXZ(x, z, ax, az, bx, bz) < hw + margin) return true; return false; };
}
function distSegXZ(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1) : 0; return Math.hypot(x - ax - dx * t, z - az - dz * t); }
/**
 * the paved street network at ground level, for the street-conformed ground (Ground.conform): carriageways with their
 * sidewalks, footways / paths as bands, pedestrian areas / squares / plazas as polygons
 */
export function streetBands(data, { skipWays = new Set(), skipAreas = new Set() } = {}) {
    const lines = [], polys = [];
    for (const w of data.ways || []) {
        if (skipWays.has(w.id) || !onGround(w) || !w.pts || w.pts.length < 2) continue;
        if (w.area === 'yes') { if (w.k in FOOT_W || w.k === 'pedestrian') polys.push(w.pts); continue; }
        if (isMotorRoad(w.k)) lines.push({ pts: w.pts, w: roadWidth(w) + (['service', 'trunk', 'motorway', 'trunk_link', 'motorway_link'].includes(w.k) && !w.sidewalk ? 0.4 : 5.2), motor: true });
        else if (w.k in FOOT_W && w.k !== 'steps' && w.k !== 'track') lines.push({ pts: w.pts, w: parseFloat(w.width) > 0.5 ? parseFloat(w.width) : FOOT_W[w.k], motor: false });
    }
    for (const a of data.areas || []) {
        if (skipAreas.has(a.id) || a.indoor === 'yes' || (a.layer && +a.layer !== 0) || (a.level && !/^0(;|$)/.test(String(a.level)))) continue;
        if (a.area_highway || a.highway === 'pedestrian' || a.place === 'square') polys.push(a.poly);
    }
    return { lines, polys, buildings: (data.buildings || []).filter((b) => !b.part).map((b) => b.poly) };
}

/** is this way at ground level and outdoors (painted on the terrain)? */
export function onGround(w) {
    if (w.indoor === 'yes' || w.tunnel || w.k === 'corridor' || w.k === 'elevator') return false;
    if (w.bridge && w.bridge !== 'no') return false;
    if (w.layer && +w.layer !== 0) return false;
    if (w.level && !/^0(;|$)/.test(String(w.level))) return false;
    return true;
}
function surfaceColour(s, fallback) {
    if (!s) return fallback;
    if (/paving_stones|sett|bricks|brick|cobblestone|unhewn/.test(s)) return { c: COL.pavers, m: /sett|cobble|unhewn/.test(s) ? 'cobble' : 'brick' };
    if (/concrete/.test(s)) return { c: COL.sidewalk, m: 'slab' };
    if (/asphalt|paved/.test(s)) return { c: COL.asphaltWorn, m: 'asphalt' };
    if (/gravel|compacted|fine_gravel|pebble/.test(s)) return { c: COL.gravel, m: 'dirt' };
    if (/dirt|ground|earth|mud|unpaved/.test(s)) return { c: COL.dirt, m: 'dirt' };
    if (/wood/.test(s)) return { c: COL.deck, m: 'wood' };
    if (/grass/.test(s)) return { c: COL.grass, m: 'grass' };
    if (/sand/.test(s)) return { c: COL.sand, m: 'dirt' };
    if (/metal/.test(s)) return { c: '#7c7f82', m: 'none' };
    return fallback;
}

// ---------------------------------------------------------------------------- ground painting from OSM
/**
 * @param {Painter} P
 * @param {object} data scene data
 * @param {{skipWays?:Set, skipAreas?:Set, roadColour?:(w)=>string|null, sidewalks?:boolean, markings?:boolean}} o
 */
export function paintOSM(P, data, o = {}) {
    const skipW = o.skipWays || new Set(), skipA = o.skipAreas || new Set();
    // areas (largest first so small ones land on top)
    const areas = data.areas.filter((a) => !skipA.has(a.id) && a.indoor !== 'yes' && !(a.level && !/^0(;|$)/.test(String(a.level))) && !(a.layer && +a.layer !== 0 && a.man_made !== 'pier'))
        .map((a) => ({ a, A: Math.abs(polyArea(a.poly)) })).sort((p, q) => q.A - p.A).map((p) => p.a);
    for (const a of areas) {
        const lu = a.landuse, le = a.leisure, na = a.natural, am = a.amenity;
        if (a.waterway && !['riverbank', 'dock', 'boatyard'].includes(a.waterway) && na !== 'water') { if (['stream', 'river', 'ditch', 'drain'].includes(a.waterway)) P.line(a.poly, a.waterway === 'river' ? 8 : 2.2, '#3d5560', 'none'); continue; } // linear waterways (streams, canals, dams, lock gates) are not areas
        let c = null, m = 'none';
        if (lu === 'residential') { c = COL.lawn; m = 'grass'; }
        else if (lu === 'commercial' || lu === 'retail' || lu === 'construction' || lu === 'railway' || lu === 'industrial') { c = '#8e8b83'; m = 'slab'; }
        else if (lu === 'grass' || le === 'park' || le === 'garden' || na === 'grass' || lu === 'meadow' || lu === 'recreation_ground' || lu === 'village_green' || le === 'common') { c = le === 'garden' ? '#58753a' : COL.grass; m = 'grass'; }
        else if (na === 'wood' || lu === 'forest') { c = COL.wood; m = 'grass'; }
        else if (na === 'scrub' || lu === 'shrubs' || na === 'heath') { c = COL.scrub; m = 'grass'; }
        else if (lu === 'flowerbed' || a.man_made === 'planter') { c = COL.flower; m = 'grass'; }
        else if (am === 'parking' || am === 'parking_space') { c = am === 'parking' ? COL.parking : null; m = 'asphalt'; }
        else if (na === 'water' || a.waterway || a.water || am === 'fountain' || le === 'swimming_pool' || na === 'coastline') { if (!o.paintBigWater && Math.abs(polyArea(a.poly)) > 25000) continue; c = COL.water; m = 'none'; } // big water bodies: the scene's water plane draws them (OSM multipolygon holes are not in the extracts)
        else if (na === 'beach' || na === 'sand') { c = COL.sand; m = 'dirt'; }
        else if (le === 'playground') { c = COL.bark; m = 'dirt'; }
        else if (le === 'pitch') { c = a.surface && /artificial|turf/.test(a.surface) ? '#4e7a3c' : COL.grass; m = 'grass'; }
        else if (a.area_highway || a.highway === 'pedestrian' || a.place === 'square') { const s = surfaceColour(a.surface, { c: '#aaa59b', m: 'slab' }); c = s.c; m = s.m; }
        else if (a.man_made === 'pier' || a.man_made === 'breakwater') { c = COL.deck; m = 'wood'; }
        else if (a.surface) { const s = surfaceColour(a.surface, null); if (s) { c = s.c; m = s.m; } }
        if (!c && am === 'parking_space') { P.line([...a.poly, a.poly[0]], 0.1, COL.white, 'none'); continue; }
        if (c) P.poly(a.poly, c, m);
        if (lu === 'flowerbed') P.custom((g, T, k, isMask) => { if (isMask) return; const r = rng(a.poly.length * 31 + 7), bb = polyBox(a.poly); const cols = ['#c9475a', '#e7c84a', '#f0efe6', '#a35bb5', '#e98a3b']; for (let i = 0; i < Math.min(400, Math.abs(polyArea(a.poly)) * 2); i++) { const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0); if (!inPoly(x, z, a.poly)) continue; const [px, py] = T(x, z); g.fillStyle = r.pick(cols); g.fillRect(px, py, Math.max(1, 0.18 * k), Math.max(1, 0.18 * k)); } });
    }
    // building footprints (dark under the walls so no grass bleeds at the base)
    for (const b of data.buildings) if (!b.part && !(o.skipBuildings?.has(b.id))) P.poly(b.poly, COL.building, 'none');
    // roads: sidewalks under, kerb edge, carriageway, markings
    const ways = data.ways.filter((w) => !skipW.has(w.id) && onGround(w));
    const roads = ways.filter((w) => isMotorRoad(w.k) && w.area !== 'yes');
    const width = roadWidth;
    if (o.sidewalks !== false) for (const w of roads) if (!['service', 'trunk', 'motorway', 'trunk_link', 'motorway_link'].includes(w.k) || w.sidewalk_both || w.sidewalk) P.line(w.pts, width(w) + 5.2, COL.sidewalk, 'slab');
    for (const w of roads) P.line(w.pts, width(w) + 0.35, COL.kerb, 'slab');
    for (const w of roads) {
        const cc = o.roadColour?.(w);
        const s = cc ? { c: cc, m: 'asphalt' } : surfaceColour(w.surface, { c: COL.asphalt, m: 'asphalt' });
        P.line(w.pts, width(w), s.c === COL.sidewalk ? COL.concreteRoad : s.c, s.m === 'slab' ? 'slab' : s.m);
    }
    if (o.markings !== false) for (const w of roads) {
        if (w.k === 'service' || w.k === 'living_street') continue;
        const lanes = parseInt(w.lanes, 10) || (w.k === 'residential' ? 0 : 2);
        if (w.oneway !== 'yes' && lanes >= 2) { for (const d of (o.centreSingle ? [0] : [-0.11, 0.11])) P.line(offsetPolyline(w.pts, d), o.centreSingle ? 0.15 : 0.1, o.centre || COL.yellow, 'none', { cap: 'butt' }); }
        if (lanes >= 3) { const W = width(w); const per = w.oneway === 'yes' ? lanes : Math.max(1, Math.floor(lanes / 2)); for (let i = 1; i < per; i++) { const off = (w.oneway === 'yes' ? -W / 2 + 1.3 : 0) + i * 3.3; for (const s of (w.oneway === 'yes' ? [1] : [-1, 1])) P.line(offsetPolyline(w.pts, s * off), 0.1, COL.white, 'none', { dash: [3, 9], cap: 'butt' }); } }
    }
    // footways, paths, plazas drawn as lines
    for (const w of ways) {
        if (isMotorRoad(w.k) || !(w.k in FOOT_W)) continue;
        if (w.area === 'yes') { const s = surfaceColour(w.surface, { c: '#aaa59b', m: 'slab' }); P.poly(w.pts, s.c, s.m); continue; }
        if (w.footway === 'crossing' || w.crossing) continue;
        const def = w.k === 'path' || w.k === 'track' ? { c: COL.gravel, m: 'dirt' } : { c: COL.sidewalk, m: 'slab' };
        const s = surfaceColour(w.surface, def);
        P.line(w.pts, parseFloat(w.width) > 0.5 ? parseFloat(w.width) : (w.footway === 'sidewalk' ? 2.4 : FOOT_W[w.k] || 2), s.c, s.m);
    }
    // crossings: continental bars (US) / zebra
    for (const w of ways) {
        if (!(w.footway === 'crossing' || (w.k === 'footway' && w.crossing))) continue;
        if (w.crossing === 'unmarked' || w.crossing_markings === 'no') continue;
        P.line(w.pts, 3, COL.white, 'none', { dash: [0.6, 0.6], cap: 'butt', join: 'miter' });
    }
}

// ---------------------------------------------------------------------------- façade textures (4 × 4 bays per tile)
const FACADES = {};
const STYLES = {
    house: { bay: 3.4, floor: 3.0, wall: '#ffffff', glass: '#2b3540', siding: true, win: [0.32, 0.25, 0.68, 0.78] },
    apartment: { bay: 3.2, floor: 3.0, wall: '#ffffff', glass: '#26303a', panel: true, win: [0.18, 0.25, 0.82, 0.8] },
    brick: { bay: 3.6, floor: 3.9, wall: '#c9a08f', glass: '#232a31', brick: true, win: [0.28, 0.22, 0.72, 0.82], arch: true },
    office: { bay: 1.6, floor: 3.9, wall: '#d7dde3', glass: '#5a6f82', curtain: true, win: [0.06, 0.12, 0.94, 0.96] },
    concrete: { bay: 3.0, floor: 3.6, wall: '#ffffff', glass: '#2a333c', win: [0.1, 0.35, 0.9, 0.8] },
    industrial: { bay: 4.0, floor: 4.5, wall: '#ffffff', glass: '#384048', corrugated: true, win: [0.2, 0.55, 0.8, 0.8], sparse: true },
    shop: { bay: 4.2, floor: 4.3, wall: '#ffffff', glass: '#1f2a33', shop: true, win: [0.06, 0.05, 0.94, 0.72] },
    // Bucharest ground floors: plaster piers, timber / bronze frames, lit displays behind the glass (albedo ≈ 0.05–0.15)
    bucshop: { bay: 4.0, floor: 4.3, wall: '#ffffff', glass: '#6f5d4a', shop: true, buc: true, win: [0.1, 0.06, 0.9, 0.74] },
    // Bucharest: 19th / early-20th c. eclectic stucco (tall windows in moulded surrounds, pediments, floor cornices)
    eclectic: { bay: 3.3, floor: 4.0, wall: '#ffffff', glass: '#2a2f33', eclectic: true, win: [0.3, 0.18, 0.7, 0.8] },
    // Bucharest: 1970s–80s apartment blocks (panel joints, balcony bands, mixed glazing / enclosed balconies)
    bloc: { bay: 3.0, floor: 2.75, wall: '#ffffff', glass: '#2d3438', bloc: true, win: [0.16, 0.2, 0.84, 0.82] },
    // Bucharest: interwar modernist (horizontal bands, wide windows)
    interwar: { bay: 3.6, floor: 3.2, wall: '#ffffff', glass: '#283038', interwar: true, win: [0.12, 0.28, 0.88, 0.8] },
};
export function facadeMaterial(style, { lambert = false } = {}) {
    const key = style + (lambert ? 'L' : 'S');
    if (FACADES[key]) return FACADES[key];
    const S = STYLES[style] || STYLES.apartment, T = 256, cell = T / 4;
    const c = canvas(T, T), g = c.getContext('2d'), e = canvas(T, T), ge = e.getContext('2d');
    g.fillStyle = S.wall; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    const r = rng(style.length * 97 + 3);
    if (S.siding) { g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1; for (let y = 0; y < T; y += 5) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(T, y + 0.5); g.stroke(); } }
    if (S.brick) { for (let y = 0; y < T; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < T; x += 8) { g.fillStyle = `rgba(${120 + r() * 50},${50 + r() * 25},${40 + r() * 20},${0.25 + r() * 0.2})`; g.fillRect(x, y, 7, 3); } }
    if (S.corrugated) { for (let x = 0; x < T; x += 4) { g.fillStyle = x % 8 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 2, T); } }
    if (S.panel) { g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * cell * 2, 0); g.lineTo(i * cell * 2, T); g.stroke(); } }
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 4; fx++) {
        const x0 = fx * cell, y0 = (3 - fy) * cell; // floor 0 at the bottom of the tile
        if (S.sparse && (fx + fy) % 2) continue;
        const [a, b, cc, d] = S.win, wx = x0 + a * cell, wy = y0 + (1 - d) * cell, ww = (cc - a) * cell, wh = (d - b) * cell;
        if (S.eclectic) {
            // rusticated / plain wall, moulded window surround, sill, pediment or straight hood, cornice line per floor
            g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x0, y0 + cell - 3, cell, 3);
            g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, y0 + 1, cell, 3); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y0 + 4, cell, 1.5); // cornice band
            g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(wx - 4, wy - 3, ww + 8, wh + 7); // light surround
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
            g.fillStyle = S.glass; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(wx + 2, wy + 2, ww * 0.35, wh * 0.45);
            g.fillStyle = 'rgba(240,236,226,0.85)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh * 0.32, ww, 2); // casement + transom
            const kind = (fx * 7 + fy * 3) % 3;
            g.fillStyle = 'rgba(255,255,255,0.55)';
            if (fy === 1 && kind !== 2) { g.beginPath(); g.moveTo(wx - 6, wy - 4); g.lineTo(wx + ww / 2, wy - 13); g.lineTo(wx + ww + 6, wy - 4); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(wx - 6, wy - 4, ww + 12, 1.5); }
            else { g.fillRect(wx - 6, wy - 8, ww + 12, 4); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(wx - 6, wy - 4, ww + 12, 1.5); }
            g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx - 5, wy + wh + 3, ww + 10, 2.5); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(wx - 5, wy + wh + 1, ww + 10, 2.5); // sill
            if (fy === 1 && fx % 2 === 0) { g.fillStyle = 'rgba(25,25,25,0.85)'; g.fillRect(wx - 4, wy + wh - 7, ww + 8, 1.5); for (let q = wx - 3; q < wx + ww + 4; q += 3) g.fillRect(q, wy + wh - 7, 1, 9); g.fillRect(wx - 4, wy + wh + 2, ww + 8, 1.5); } // wrought-iron balconette
            if (fy === 0) { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let q = y0 + 8; q < y0 + cell; q += 7) g.fillRect(x0, q, cell, 1); } // rusticated ground floor
        } else if (S.bloc) {
            g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0, y0 + cell - 2, cell, 2); g.fillRect(x0 + cell - 1, y0, 1, cell); // panel joints
            const balcony = (fx % 2 === 1);
            if (balcony) {
                const enclosed = r() < 0.55;
                g.fillStyle = enclosed ? ['#c9d3d8', '#7d8b93', '#e8e4da', '#a0aab0'][Math.floor(r() * 4)] : S.glass; g.fillRect(x0 + 3, wy - 2, cell - 6, wh + 2);
                if (enclosed) { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let q = x0 + 3; q < x0 + cell - 3; q += 9) g.fillRect(q, wy - 2, 1.5, wh + 2); }
                g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x0 + 1, wy + wh * 0.55, cell - 2, wh * 0.45 + 2); // parapet
                g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 + 1, wy + wh + 2, cell - 2, 3);
            } else {
                g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
                g.fillStyle = S.glass; g.fillRect(wx, wy, ww, wh);
                g.fillStyle = r() < 0.6 ? 'rgba(255,255,255,0.85)' : 'rgba(120,80,50,0.8)'; g.fillRect(wx, wy, ww, 2); g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh - 2, ww, 2); // PVC / old wood frames
                if (r() < 0.25) { g.fillStyle = 'rgba(230,230,225,0.9)'; g.fillRect(wx + ww * 0.55, wy + wh * 0.5, ww * 0.35, wh * 0.28); } // AC unit
            }
        } else if (S.interwar) {
            g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, wy + wh + 2, cell, 3);
            g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0, wy - 5, cell, 3);
            g.fillStyle = S.glass; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(255,255,255,0.75)'; for (let q = 1; q < 3; q++) g.fillRect(wx + ww * q / 3 - 1, wy, 2, wh);
            g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(wx + 2, wy + 2, ww * 0.3, wh * 0.4);
        } else if (S.curtain) {
            g.fillStyle = S.glass; g.fillRect(x0, y0, cell, cell);
            g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0 + 2, y0 + 2, cell * 0.45, cell - 4);
            g.fillStyle = '#9aa6b1'; g.fillRect(x0, y0, 2, cell); g.fillRect(x0, y0 + cell - 5, cell, 5);
        } else if (S.shop && S.buc) {
            g.fillStyle = '#d9d1c2'; g.fillRect(x0, y0, cell, cell); // plaster piers
            const sx = wx, sy = wy + wh * 0.22, sw = ww, sh = wh * 0.78;
            g.fillStyle = ['#4a3424', '#2f3b33', '#3b2a22', '#5a5048'][(fx + fy * 3) % 4]; g.fillRect(sx - 3, sy - 3, sw + 6, sh + 3); // frame
            const gr = g.createLinearGradient(0, sy, 0, sy + sh); gr.addColorStop(0, '#a89880'); gr.addColorStop(1, '#6e5e4c'); g.fillStyle = gr; g.fillRect(sx, sy, sw, sh); // lit interior
            for (let q = 0; q < 6; q++) { g.fillStyle = `hsl(${(fx * 70 + q * 50) % 360},35%,${45 + r() * 25}%)`; g.fillRect(sx + 4 + q * (sw - 8) / 6, sy + sh * (0.45 + r() * 0.3), (sw - 8) / 7, sh * 0.25); } // goods / tables
            g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(sx + 3, sy + 3, sw * 0.3, sh * 0.8); g.fillStyle = 'rgba(40,30,20,0.85)'; g.fillRect(sx + sw / 2 - 1.5, sy, 3, sh); // reflection + mullion
            g.fillStyle = ['#2f5a3a', '#7a2230', '#e9e1c8', '#3b4a5a'][(fx + fy) % 4]; g.fillRect(x0 + 2, y0 + cell * 0.06, cell - 4, cell * 0.12); // fascia
        } else if (S.shop) {
            g.fillStyle = '#2a2d31'; g.fillRect(x0, y0, cell, cell);
            g.fillStyle = S.glass; g.fillRect(wx, wy + wh * 0.25, ww, wh * 0.75);
            g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(wx + 3, wy + wh * 0.3, ww * 0.3, wh * 0.6);
            g.fillStyle = ['#7a2a2a', '#2f4f6f', '#2f5f3f', '#5a4a3a'][(fx + fy * 3) % 4]; g.fillRect(x0, y0 + cell * 0.04, cell, cell * 0.16); // awning / fascia band
        } else {
            g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 5); // frame shadow
            g.fillStyle = S.glass; g.fillRect(wx, wy, ww, wh);
            if (S.arch) { g.beginPath(); g.ellipse(wx + ww / 2, wy, ww / 2, ww * 0.28, 0, Math.PI, 0); g.fill(); }
            g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(wx + 2, wy + 2, ww * 0.35, wh * 0.5);
            g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh * 0.45, ww, 2); // mullions
            g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 3, wy + wh, ww + 6, 3); // sill
        }
        // night: some windows lit (warm / cool), office floors more uniform
        const lit = S.curtain ? r() < 0.55 : S.shop ? r() < 0.85 : r() < 0.38;
        if (lit) {
            const warm = r() < 0.75; ge.fillStyle = warm ? `rgb(255,${190 + r() * 40},${120 + r() * 40})` : `rgb(${190 + r() * 30},${215 + r() * 20},255)`;
            if (S.curtain) ge.fillRect(x0 + 3, y0 + 3, cell - 6, cell - 9); else if (S.shop) ge.fillRect(wx, wy + wh * 0.25, ww, wh * 0.75); else ge.fillRect(wx, wy, ww, wh);
        }
    }
    const map = canvasTexture(c, { repeat: true }), em = canvasTexture(e, { repeat: true });
    const M2 = lambert ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
    const m = new M2({ map, emissiveMap: em, emissive: new THREE.Color('#ffffff'), emissiveIntensity: S.buc ? 0.12 : 0, vertexColors: !S.buc, ...(lambert ? {} : { roughness: S.curtain ? 0.3 : S.buc ? 0.55 : 0.88, metalness: S.curtain ? 0.35 : 0 }) });
    m.name = 'facade-' + style; m.userData.shared = true; m.userData.style = S; m.userData.nightWindows = true; if (S.buc) m.userData.dayWindows = 0.12;
    FACADES[key] = m;
    return m;
}
export const facadeStyle = (s) => STYLES[s] || STYLES.apartment;

// ---------------------------------------------------------------------------- buildings
const HOUSE_COLS = ['#cfc8b8', '#8fa3ad', '#d9caa3', '#6f7f8c', '#a5594c', '#e4ded2', '#5f6d5c', '#b9a58a', '#7d8b74', '#c4b49a', '#3f4f5f', '#d3cfc4'];
const APT_COLS = ['#c4bdaf', '#8c9095', '#c7b299', '#6d7a84', '#a34c3c', '#d2cbbd', '#7a8a7a', '#b8afa0', '#55606a', '#9a8670'];
const OFFICE_COLS = ['#8fa3b6', '#6c7f92', '#a6b4c0', '#5a6a78', '#7f8f99'];
const BRICK_COLS = ['#c8826a', '#b8725c', '#d39478', '#c08470', '#ddb196'];
// Bucharest stucco / plaster and block colours (judged albedos from the research colour samples)
const ECLECTIC_COLS = ['#e4dccb', '#dccfb4', '#e8d9b8', '#d9c3a5', '#e6d3c3', '#cfc7b8', '#e2cfa2', '#d8cdc0', '#c9b9a0', '#e9e1d2', '#d6b9a3', '#bfb6a6'];
const BLOC_COLS = ['#d9d3c5', '#cfc8b8', '#e2dccd', '#bdb7aa', '#d8cdb5', '#c7cdc9', '#e0d2bd', '#cfc0a8', '#b9bdb6', '#e6e0d2'];
const PALETTES = { eclectic: ECLECTIC_COLS, bloc: BLOC_COLS, interwar: ['#e7e3d8', '#d9d4c7', '#cec9bb', '#e3dccb', '#c9c3b6'] };

export function buildingStyle(b, urban) {
    const k = b.k, m = b.mat || '';
    if (/glass/.test(m)) return 'office';
    if (/brick/.test(m)) return 'brick';
    if (k === 'house' || k === 'detached' || k === 'semidetached_house' || k === 'bungalow' || k === 'garage' || k === 'shed') return 'house';
    if (k === 'industrial' || k === 'warehouse' || k === 'hangar' || k === 'manufacture') return 'industrial';
    if (k === 'office' || k === 'commercial' && (b.h || 0) > 30) return 'office';
    if (k === 'apartments' || k === 'residential' || k === 'dormitory' || k === 'hotel') return (b.h || (b.lv || 3) * 3) > 40 ? 'office' : 'apartment';
    if (k === 'retail' || k === 'commercial') return urban ? 'brick' : 'concrete';
    if ((b.h || 0) > 45) return 'office';
    return urban ? 'apartment' : 'house';
}
export function buildingHeight(b) {
    if (b.h) return b.h;
    if (b.lv) return b.lv * 3.2 + 0.8;
    return { house: 7.5, detached: 7.5, garage: 3, shed: 2.8, roof: 4, apartments: 13, residential: 11, commercial: 9, retail: 6, office: 18, industrial: 8, warehouse: 8, church: 14, school: 9, hotel: 20, kiosk: 3, toilets: 3.5, service: 4 }[b.k] ?? 8;
}

/**
 * extrude OSM buildings
 * @returns {{ group, colliders[], tris }}
 */
export function buildBuildings(data, ground, o = {}) {
    const skip = o.skip || new Set(), exclude = o.exclude || [], urban = o.urban ?? true;
    const r = rng(1234);
    const batch = new GeoBatch();
    const colliders = [];
    const mats = {};
    const add = (style, g) => { const k = 'f-' + style; mats[k] = facadeMaterial(style); batch.add(g, k, null, g.userData.col); };
    // notes 23/26: overlapping OSM footprints (duplicates, parts over parts) z-fight on coplanar facades and roofs.
    // Largest first; a footprint (mostly) inside an accepted one that is not taller is dropped; a partly overlapping
    // or taller one is inset 0.12 m and its roof lifted 8 cm so no facade / roof plane coincides.
    const acc = [], cellA = 32, gridA = new Map(), keyA = (i, j) => i * 7919 + j;
    const insideAcc = (x, z) => { for (const a of gridA.get(keyA(Math.floor(x / cellA), Math.floor(z / cellA))) || []) if (x >= a.bb.x0 && x <= a.bb.x1 && z >= a.bb.z0 && z <= a.bb.z1 && inPoly(x, z, a.poly)) return a; return null; };
    const order = data.buildings.filter((b) => !skip.has(b.id) && !b.hasParts && b.poly?.length > 2).map((b) => ({ b, A: Math.abs(polyArea(b.poly)) })).sort((p, q) => q.A - p.A).map((p) => p.b);
    let dropped = 0, inset = 0;
    for (const b0 of order) {
        let b = b0;
        if (b.k === 'roof' && !o.keepRoofs) continue;
        { // overlap with accepted footprints
            const [qx, qz] = centroid(b.poly), bbq = polyBox(b.poly), smp = [[qx, qz], ...b.poly.map(([x, z]) => [x + (qx - x) * 0.2, z + (qz - z) * 0.2])];
            for (let i = 0; i < 9; i++) { const x = bbq.x0 + (bbq.x1 - bbq.x0) * ((i % 3) + 0.5) / 3, z = bbq.z0 + (bbq.z1 - bbq.z0) * (Math.floor(i / 3) + 0.5) / 3; if (inPoly(x, z, b.poly)) smp.push([x, z]); }
            let hit = 0, host = null; for (const [x, z] of smp) { const a = insideAcc(x, z); if (a) { hit++; host = a; } }
            const f = hit / smp.length, H0 = buildingHeight(b) + (b.minH || 0);
            if (f >= 0.85 && host && H0 <= host.H + 0.5 && !b.minH) { dropped++; continue; }
            if (f > 0.04 || smp.some(([x, z]) => insideAcc(x, z))) { const pin = insetPoly(b.poly, 0.12); if (pin) { b = { ...b, poly: pin, _lift: 0.08 }; inset++; } }
        }
        const [cx, cz] = centroid(b.poly);
        if (exclude.some((p) => inPoly(cx, cz, p))) continue;
        if (o.filter && !o.filter(b)) continue;
        const H = buildingHeight(b) * (o.heightScale || 1);
        let gmin = 1e9, gmax = -1e9;
        // lowest / highest ground under the footprint: vertices, centroid and every ~2.5 m along the edges (a long
        // wall over a slope or a re-graded street must still reach the ground: closed volume, nothing to see under)
        const gs = (x, z) => { const h = ground.heightAt(x, z); if (h < gmin) gmin = h; if (h > gmax) gmax = h; };
        for (let i = 0, j = b.poly.length - 1; i < b.poly.length; j = i++) { const [ax, az] = b.poly[j], [bx, bz] = b.poly[i], n = Math.min(24, Math.ceil(Math.hypot(bx - ax, bz - az) / 2.5)); for (let q = 0; q < n; q++) gs(ax + (bx - ax) * q / n, az + (bz - az) * q / n); }
        gs(cx, cz);
        const base = b.minH ? gmax + b.minH : (b.minLv ? gmax + b.minLv * 3.2 : gmin - 0.6);
        const top = (b.minH || b.minLv ? gmax : gmax) + H + (b._lift || 0);
        if (top - base < 1) continue;
        { const bb = polyBox(b0.poly), a = { poly: b0.poly, bb, H: buildingHeight(b0) + (b0.minH || 0) }; acc.push(a);
            for (let i = Math.floor(bb.x0 / cellA); i <= Math.floor(bb.x1 / cellA); i++) for (let j = Math.floor(bb.z0 / cellA); j <= Math.floor(bb.z1 / cellA); j++) { const k = keyA(i, j); let l = gridA.get(k); if (!l) gridA.set(k, l = []); l.push(a); } }
        const style = o.style?.(b) || buildingStyle(b, urban);
        const pal = PALETTES[style] || (style === 'house' ? HOUSE_COLS : style === 'office' ? OFFICE_COLS : style === 'brick' ? BRICK_COLS : APT_COLS);
        const hcol = b.c ? safeCol(b.c) : pal[Math.floor(hash2(cx, cz) * pal.length)];
        const S = facadeStyle(style);
        const pitched = (style === 'house' && (b.roof !== 'flat')) || /gabled|hipped|pitched/.test(b.roof || '');
        const wallTop = pitched ? top - Math.min(3.5, H * 0.3) : top;
        // ground floor shop band for urban commercial/mixed buildings
        const shopBand = urban && !b.minH && H > 7 && (b.shop || b.amenity || /commercial|retail|mixed|yes/.test(b.k)) && style !== 'house' && style !== 'industrial';
        const yGF = shopBand ? Math.min(wallTop, gmax + 4.3) : base;
        if (shopBand) add(o.shopStyle || 'shop', wallGeometry(b.poly, base, yGF, facadeStyle(o.shopStyle || 'shop'), gmax, hcol));
        add(style, wallGeometry(b.poly, yGF, wallTop, S, shopBand ? yGF : gmax, hcol));
        // roof
        if (pitched) { const g = gableRoof(b.poly, wallTop, top, b.rc ? safeCol(b.rc) : ['#4a4a4f', '#5b4a42', '#3f4a52', '#6b6660'][Math.floor(hash2(cz, cx) * 4)], hcol); if (g) { batch.add(g.roof, 'roofs', null, g.roofCol); batch.add(g.gables, 'f-' + style, null, hcol); mats['f-' + style] = facadeMaterial(style); } }
        else {
            batch.flat(b.poly, top, b.rc ? safeCol(b.rc) : (style === 'office' ? '#7d8288' : '#8a8784'), 'roofs');
            // parapet + rooftop units on bigger roofs
            const A = Math.abs(polyArea(b.poly));
            if (A > 300 && H > 9) { const bb = obb(b.poly); if (bb) for (let i = 0; i < Math.min(4, A / 400); i++) { const u = (r() - 0.5) * bb.len * 0.5, v = (r() - 0.5) * bb.wid * 0.5; batch.box(bb.cx + bb.ux * u - bb.uz * v, top, bb.cz + bb.uz * u + bb.ux * v, 2 + r() * 3, 1.2 + r() * 1.5, 2 + r() * 2, '#9a9a96', 'metal', bb.angle); } }
        }
        // the walker can't get under / into a building that stands on the ground (floating parts keep their underside)
        colliders.push(polyCollider(b.poly, b.minH || b.minLv ? base : base - 30, top));
    }
    for (const m of Object.values(mats)) m.side = THREE.DoubleSide; // inside a wall the camera sees a wall, never the street beyond
    const group = batch.build('osm-buildings', { matOverrides: mats });
    return { group, colliders, tris: countFromGroup(group), dedupe: { dropped, inset } };
}
/** polygon offset inward by d (per-vertex bisector; null when the result folds over) */
export function insetPoly(poly, d) {
    const n = poly.length, sgn = polyArea(poly) > 0 ? 1 : -1, out = [];
    for (let i = 0; i < n; i++) {
        const [px, pz] = poly[(i + n - 1) % n], [x, z] = poly[i], [nx2, nz2] = poly[(i + 1) % n];
        let ax = x - px, az = z - pz, bx = nx2 - x, bz = nz2 - z; const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
        // inward normals (left of the edge for a positive-area ring in x/z)
        const n1x = -az * sgn, n1z = ax * sgn, n2x = -bz * sgn, n2z = bx * sgn; let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
        if (ml < 0.2) return null; mx /= ml; mz /= ml; const k = d / Math.max(0.35, mx * n1x + mz * n1z);
        out.push([x + mx * k, z + mz * k]);
    }
    const a0 = polyArea(poly), a1 = polyArea(out); return Math.sign(a0) === Math.sign(a1) && Math.abs(a1) < Math.abs(a0) ? out : null;
}
function countFromGroup(g) { let n = 0; g.traverse((o) => { if (o.isMesh) n += o.geometry.index.count / 3; }); return n; }
function safeCol(c) { try { return '#' + new THREE.Color(c).getHexString(); } catch { return '#9a958c'; } }
export function polyCollider(poly, y0 = -1e3, y1 = 1e3) {
    const [cx, cz] = centroid(poly); let r = 0; for (const [x, z] of poly) r = Math.max(r, Math.hypot(x - cx, z - cz));
    return { x: cx, z: cz, r, poly, y0, y1, building: true };
}
/** walls of a polygon with façade UVs (u: 4 bays per tile, v: 4 floors per tile from vBase) */
export function wallGeometry(poly, y0, y1, S, vBase, col) {
    const p = polyArea(poly) > 0 ? poly : [...poly].reverse();
    const pos = [], uv = [], idx = [];
    let u = 0;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
        const k = pos.length / 3, uA = Math.round(u / S.bay) * S.bay; // restart bays per wall so windows don't straddle corners badly
        pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]);
        const ua = uA / (S.bay * 4), ub = (uA + Math.max(S.bay, Math.round(L / S.bay) * S.bay)) / (S.bay * 4), va = (y0 - vBase) / (S.floor * 4), vb = (y1 - vBase) / (S.floor * 4);
        uv.push(ua, va, ub, va, ub, vb, ua, vb);
        idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
        u += L;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); g.userData.col = col;
    return g;
}
/** gable roof on the polygon's oriented box: ridge along the long side */
function gableRoof(poly, y0, y1, roofCol, wallCol) {
    const b = obb(poly); if (!b || b.wid < 2) return null;
    const ov = 0.35, hl = b.len / 2 + ov, hw = b.wid / 2 + ov, ux = b.ux, uz = b.uz, vx = -uz, vz = ux;
    const P = (u, v, y) => [b.cx + ux * u + vx * v, y, b.cz + uz * u + vz * v];
    const yE = y0 - 0.15, rh = Math.min(y1 - y0, b.wid * 0.45) + 0.15;
    const A = P(-hl, -hw, yE), B = P(hl, -hw, yE), C = P(hl, hw, yE), D = P(-hl, hw, yE), R1 = P(-hl, 0, yE + rh), R2 = P(hl, 0, yE + rh);
    const roof = new THREE.BufferGeometry();
    const rp = [...A, ...B, ...R2, ...R1, ...C, ...D, ...R1, ...R2];
    roof.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); roof.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    roof.computeVertexNormals();
    // gable triangles (wall material)
    const ga = P(-b.len / 2, -b.wid / 2, y0), gb = P(-b.len / 2, b.wid / 2, y0), gc = P(-b.len / 2, 0, y0 + rh - 0.1), gd = P(b.len / 2, -b.wid / 2, y0), ge = P(b.len / 2, b.wid / 2, y0), gf = P(b.len / 2, 0, y0 + rh - 0.1);
    const gables = new THREE.BufferGeometry();
    gables.setAttribute('position', new THREE.Float32BufferAttribute([...ga, ...gb, ...gc, ...gd, ...ge, ...gf], 3));
    gables.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.2, 0, 0.1, 0.1, 0, 0, 0.2, 0, 0.1, 0.1], 2));
    gables.setIndex([0, 1, 2, 0, 2, 1, 3, 4, 5, 3, 5, 4]); gables.computeVertexNormals();
    return { roof, gables, roofCol };
}

// ---------------------------------------------------------------------------- trees (instanced, season-tinted by render.js)
let TREE_GEO = null;
function treeGeos() {
    if (TREE_GEO) return TREE_GEO;
    const merge = (parts) => { const pos = []; for (const [g, m] of parts) { let gg = g.clone().applyMatrix4(m); if (gg.index) gg = gg.toNonIndexed(); const p = gg.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    const ico = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 8);
    const mk = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    // jitter vertices so the crowns are not perfect spheres
    const jitter = (g, a) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (hash2(x * 3.1 + z, y * 2.7) - 0.5) * a; p.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; };
    const broad = jitter(merge([[ico, mk(0, 5.0, 0, 2.8, 2.5, 2.8)], [ico, mk(1.1, 6.2, 0.4, 1.9, 1.7, 1.9)], [ico, mk(-1.0, 5.9, -0.6, 1.8, 1.6, 1.8)], [ico, mk(0.2, 7.0, -0.2, 1.5, 1.3, 1.5)]]), 0.22);
    const con = jitter(merge([[cone, mk(0, 4.2, 0, 2.6, 5.5, 2.6)], [cone, mk(0, 7.0, 0, 2.0, 4.5, 2.0)], [cone, mk(0, 9.6, 0, 1.3, 3.6, 1.3)]]), 0.12);
    const shrub = jitter(merge([[ico, mk(0, 0.55, 0, 0.9, 0.65, 0.9)], [ico, mk(0.5, 0.5, 0.2, 0.6, 0.5, 0.6)]]), 0.3);
    const trunk = new THREE.CylinderGeometry(0.13, 0.22, 4.4, 6); trunk.translate(0, 2.2, 0);
    const trunkC = new THREE.CylinderGeometry(0.12, 0.25, 4, 6); trunkC.translate(0, 2, 0);
    // low-detail variants for distant trees (scenes opt in with ctx.treeLod)
    const ico0 = new THREE.IcosahedronGeometry(1, 0), cone5 = new THREE.ConeGeometry(1, 1, 5);
    const broadLow = jitter(merge([[ico0, mk(0, 5.2, 0, 3.0, 2.7, 3.0)], [ico0, mk(0.4, 6.8, 0.1, 2.0, 1.7, 2.0)]]), 0.15);
    const conLow = merge([[cone5, mk(0, 5.0, 0, 2.6, 7.5, 2.6)], [cone5, mk(0, 8.6, 0, 1.6, 4.6, 1.6)]]);
    const trunkLow = new THREE.CylinderGeometry(0.13, 0.22, 4.4, 3); trunkLow.translate(0, 2.2, 0);
    TREE_GEO = { broad, con, shrub, trunk, trunkC, broadLow, conLow, trunkLow, ...speciesGeos() };
    return TREE_GEO;
}
// ---------------------------------------------------------------------------- smooth species crowns (Bucharest street / park trees)
/** a crown of noise-displaced, smooth-shaded lobes; normals bent toward the crown centre (soft foliage light) */
function lobeCrown(lobes, { seg = [9, 6], amp = 0.22, freq = 1.7, bend = 0.55, seed = 1 } = {}) {
    const pos = [], nor = [], idx = []; let base = 0;
    let cx = 0, cy = 0, cz = 0, W = 0; for (const [x, y, z, rx, ry, rz] of lobes) { const w = rx * ry * rz; cx += x * w; cy += y * w; cz += z * w; W += w; } cx /= W; cy /= W; cz /= W;
    for (const [x, y, z, rx, ry, rz] of lobes) {
        const g = new THREE.SphereGeometry(1, seg[0], seg[1]), P = g.attributes.position;
        for (let i = 0; i < P.count; i++) {
            const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i), px = x + ux * rx, py = y + uy * ry, pz = z + uz * rz;
            const n = 1 + amp * (fbm2(px * freq + seed * 7.1, pz * freq + py * 0.7) - 0.5) * 2;
            P.setXYZ(i, x + ux * rx * n, y + uy * ry * n, z + uz * rz * n);
        }
        g.computeVertexNormals();
        const N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
            const px = P.getX(i), py = P.getY(i), pz = P.getZ(i); let rx2 = px - cx, ry2 = py - cy, rz2 = pz - cz; const L = Math.hypot(rx2, ry2, rz2) || 1; rx2 /= L; ry2 /= L; rz2 /= L;
            let nx = N.getX(i) * (1 - bend) + rx2 * bend, ny = N.getY(i) * (1 - bend) + ry2 * bend, nz = N.getZ(i) * (1 - bend) + rz2 * bend; const l2 = Math.hypot(nx, ny, nz) || 1;
            pos.push(px, py, pz); nor.push(nx / l2, ny / l2, nz / l2);
        }
        for (const i of g.index.array) idx.push(base + i); base += P.count; g.dispose();
    }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setIndex(idx); return o;
}
/** trunk with a clear stem and a few scaffold branches into the crown */
function trunkWithLimbs(h, r0, limbs) {
    const parts = [], t = new THREE.CylinderGeometry(r0 * 0.6, r0, h, 7); t.translate(0, h / 2, 0); parts.push(t);
    for (const [ax, az, len, tilt] of limbs) { const b = new THREE.CylinderGeometry(r0 * 0.25, r0 * 0.45, len, 5); b.translate(0, len / 2, 0); b.rotateZ(-tilt * Math.cos(Math.atan2(az, ax))); b.rotateX(tilt * Math.sin(Math.atan2(az, ax))); b.translate(0, h * 0.92, 0); parts.push(b); }
    return mergeGeos(parts);
}
function speciesGeos() {
    return {
        // London plane: tall clear stem (≈ 6 m), broad irregular crown 7–15 m
        plane: lobeCrown([[0, 10.5, 0, 3.8, 3.0, 3.8], [2.4, 9.2, 1.0, 2.6, 2.3, 2.6], [-2.2, 9.6, -1.2, 2.7, 2.4, 2.6], [0.6, 12.6, -0.6, 2.4, 2.0, 2.4], [-1.0, 8.4, 2.0, 2.2, 1.8, 2.2]], { seed: 1 }),
        trunk_plane: trunkWithLimbs(7.2, 0.28, [[1, 0.3, 3.2, 0.5], [-0.8, -0.6, 3.0, 0.45], [0.1, 1, 2.8, 0.4]]),
        // linden: dense ovoid crown from ≈ 4 m, 4.5–13 m
        linden: lobeCrown([[0, 8.6, 0, 3.0, 4.2, 3.0], [1.3, 7.2, 0.6, 2.2, 2.6, 2.2], [-1.2, 7.5, -0.7, 2.2, 2.6, 2.2], [0, 11.4, 0.2, 2.0, 2.0, 2.0]], { seed: 2, amp: 0.16 }),
        trunk_linden: trunkWithLimbs(5.4, 0.24, [[1, 0, 2.4, 0.35], [-1, 0.4, 2.2, 0.35]]),
        // horse chestnut: rounded broad dome from ≈ 3.5 m, 4–11 m
        chestnut: lobeCrown([[0, 7.4, 0, 3.6, 3.0, 3.6], [2.0, 6.4, 0.8, 2.4, 2.0, 2.4], [-1.9, 6.6, -0.9, 2.4, 2.0, 2.4], [0.3, 9.4, 0, 2.6, 1.8, 2.6]], { seed: 3, amp: 0.2 }),
        trunk_chestnut: trunkWithLimbs(4.6, 0.26, [[1, 0.2, 2.4, 0.55], [-0.9, -0.3, 2.3, 0.5], [0, 1, 2.0, 0.45]]),
        // smooth low crown for distant species trees (one lobe, few triangles)
        speciesLow: lobeCrown([[0, 8.8, 0, 3.4, 3.4, 3.4]], { seg: [6, 4], seed: 4, amp: 0.15, bend: 0.4 }),
        trunk_speciesLow: (() => { const t = new THREE.CylinderGeometry(0.16, 0.25, 6.4, 4); t.translate(0, 3.2, 0); return t; })(),
    };
}
const BROAD_C = ['#4f8a3c', '#5d9440', '#679c48', '#4a7f39', '#5a8f3e', '#6f9e4a', '#55893f'];
const CON_C = ['#2f5d3a', '#356640', '#2b5434', '#3a6a45'];
const SHRUB_C = ['#456f35', '#3e6530', '#567d3c', '#3a5c2e'];
/**
 * instanced trees. list: [{x, z, y?, s?, kind:'broad'|'con'|'shrub', c?}]
 * lod: optional { near = 90, max = 700 } → dynamic LOD: the `max` trees within `near` m of the viewer use the full crown,
 *      all others a low-detail crown + trunk (same season tinting); call update(x, z) with the viewer position.
 * @returns {{ group, crowns[], colliders[], update?(x, z) }}
 */
export function buildTrees(list, ground, { seed = 5, collide = true, lod = null } = {}) {
    const G = treeGeos(), r = rng(seed), grp = new THREE.Group(); grp.name = 'trees';
    const crowns = [], colliders = [], dyn = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const mk = (geo, mat, n, name) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.name = name; return m; };
    const SPECIES = ['plane', 'linden', 'chestnut'];
    for (const kind of ['broad', 'con', 'shrub', ...SPECIES]) {
        const L = list.filter((t) => (t.kind || 'broad') === kind); if (!L.length) continue;
        const sp = SPECIES.includes(kind);
        const useLod = !!lod && kind !== 'shrub' && L.length > (lod.max ?? 700) * (sp ? 0.25 : 0.6);
        const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff' }); crownMat.name = 'treeCrowns';
        const trunkMat = new THREE.MeshLambertMaterial({ color: '#5f4632' });
        const hiN = useLod ? Math.min(L.length, Math.round((lod.max ?? 700) * (sp ? 0.3 : 1))) : L.length;
        const crown = mk(sp ? G[kind] : kind === 'broad' ? G.broad : kind === 'con' ? G.con : G.shrub, crownMat, hiN, `treeCrowns ${kind === 'con' ? 'conifer' : kind}`); crown.userData.conifer = kind === 'con' || kind === 'shrub';
        const trunk = kind === 'shrub' ? null : mk(sp ? G['trunk_' + kind] : kind === 'con' ? G.trunkC : G.trunk, trunkMat, hiN, 'treeTrunks');
        const lowC = useLod ? mk(sp ? G.speciesLow : kind === 'broad' ? G.broadLow : G.conLow, crownMat, L.length, `treeCrowns ${kind === 'con' ? 'conifer' : kind} low`) : null;
        if (lowC) lowC.userData.conifer = crown.userData.conifer;
        const lowT = useLod ? mk(sp ? G.trunk_speciesLow : G.trunkLow, trunkMat, L.length, 'treeTrunks low') : null;
        const mats = [], cols = [];
        L.forEach((t, i) => {
            const s = t.s || (kind === 'shrub' ? 0.7 + r() * 0.8 : sp ? 0.85 + r() * 0.3 : 0.75 + r() * 0.5), y = t.y ?? ground.heightAt(t.x, t.z) - 0.05;
            m4.compose(new THREE.Vector3(t.x, y, t.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s * (t.sx || 1), s * (t.sy || 1), s * (t.sx || 1)));
            col.set(t.c || (kind === 'con' ? r.pick(CON_C) : kind === 'shrub' ? r.pick(SHRUB_C) : r.pick(BROAD_C)));
            if (useLod) { mats.push(m4.clone()); cols.push(col.clone()); }
            else { crown.setMatrixAt(i, m4); trunk?.setMatrixAt(i, m4); crown.setColorAt(i, col); }
            if (collide && kind !== 'shrub') colliders.push({ x: t.x, z: t.z, r: (sp ? 0.32 : 0.28) * s, hw: (sp ? 0.32 : 0.28) * s, prop: true, h: 6 });
        });
        for (const m of [crown, lowC]) if (m) { m.castShadow = true; m.receiveShadow = true; grp.add(m); crowns.push(m); }
        for (const m of [trunk, lowT]) if (m) { m.castShadow = true; grp.add(m); }
        if (useLod) {
            const near2 = (lod.near ?? 90) ** 2;
            const D = { L, mats, cols, crown, trunk, lowC, lowT, hiN, last: null };
            D.apply = (px, pz) => {
                const idx = L.map((t, i) => [i, (t.x - px) ** 2 + (t.z - pz) ** 2]).filter((e) => e[1] < near2).sort((a, b2) => a[1] - b2[1]).slice(0, hiN).map((e) => e[0]);
                const hi = new Uint8Array(L.length); let k = 0;
                for (const i of idx) { hi[i] = 1; crown.setMatrixAt(k, mats[i]); trunk?.setMatrixAt(k, mats[i]); crown.setColorAt(k, cols[i]); k++; }
                crown.count = k; if (trunk) trunk.count = k;
                let j = 0; for (let i = 0; i < L.length; i++) if (!hi[i]) { lowC.setMatrixAt(j, mats[i]); lowT.setMatrixAt(j, mats[i]); lowC.setColorAt(j, cols[i]); j++; }
                lowC.count = j; lowT.count = j;
                for (const m of [crown, trunk, lowC, lowT]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
            };
            dyn.push(D);
        } else { crown.instanceMatrix.needsUpdate = true; crown.computeBoundingSphere(); trunk?.computeBoundingSphere(); }
        for (const m of [crown, trunk, lowC, lowT]) if (m) m.frustumCulled = !useLod;
    }
    let lx = 1e9, lz = 1e9;
    const update = dyn.length ? (x, z) => { if (Math.hypot(x - lx, z - lz) < 12) return; lx = x; lz = z; for (const D of dyn) D.apply(x, z); } : null;
    return { group: grp, crowns, colliders, update };
}
/** street trees along motor roads (both sides, skipping building footprints / exclusions) */
export function streetTrees(data, { inside = null, spacing = 11, offset = null, skip = new Set(), exclude = [], seed = 3, kinds = ['residential', 'tertiary', 'secondary', 'primary', 'unclassified'], prob = 0.75 } = {}) {
    const r = rng(seed), out = [];
    const blocked = (x, z) => data.buildings.some((b) => { const bb = b._bb || (b._bb = polyBox(b.poly)); return x > bb.x0 - 1 && x < bb.x1 + 1 && z > bb.z0 - 1 && z < bb.z1 + 1 && inPoly(x, z, b.poly); }) || exclude.some((p) => inPoly(x, z, p));
    for (const w of data.ways) {
        if (skip.has(w.id) || !kinds.includes(w.k) || !onGround(w)) continue;
        const lanes = parseInt(w.lanes, 10), W = (lanes > 0 ? lanes * 3.3 + 2.6 : ROAD_W[w.k] || 8), off = offset ?? W / 2 + 1.3;
        const L = polylineLength(w.pts);
        for (let s = spacing * r(); s < L; s += spacing * (0.8 + r() * 0.5)) {
            for (const side of [-1, 1]) {
                if (r() > prob) continue;
                const p = alongPolyline(w.pts, s), x = p.x - p.tz * off * side, z = p.z + p.tx * off * side;
                if (inside && !inside(x, z)) continue;
                if (blocked(x, z)) continue;
                out.push({ x, z, kind: 'broad', s: 0.65 + r() * 0.4 });
            }
        }
    }
    return out;
}
/** scatter trees inside wood/park areas */
export function areaTrees(data, { density = 1 / 90, kinds = ['wood', 'forest', 'scrub'], seed = 9, inside = null, conifer = 0.5, exclude = [] } = {}) {
    const r = rng(seed), out = [];
    for (const a of data.areas) {
        const k = a.natural === 'wood' || a.landuse === 'forest' ? 'wood' : a.natural === 'scrub' || a.landuse === 'shrubs' ? 'scrub' : a.leisure === 'park' ? 'park' : null;
        if (!k || !kinds.includes(k)) continue;
        const bb = polyBox(a.poly), A = Math.abs(polyArea(a.poly)), n = Math.min(400, Math.round(A * density * (k === 'scrub' ? 0.6 : 1)));
        for (let i = 0; i < n * 2 && out.length < 4000; i++) {
            const x = bb.x0 + r() * (bb.x1 - bb.x0), z = bb.z0 + r() * (bb.z1 - bb.z0);
            if (!inPoly(x, z, a.poly) || (inside && !inside(x, z)) || exclude.some((p) => inPoly(x, z, p))) continue;
            out.push({ x, z, kind: k === 'scrub' ? (r() < 0.6 ? 'shrub' : 'broad') : r() < (a.leaf_type === 'needleleaved' ? 0.9 : conifer) ? 'con' : 'broad', s: 0.7 + r() * 0.6 });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------- street lamps (format for render.setLamps)
/**
 * lamps from OSM furniture + generated along motor roads; returns { group, lamps[], headMesh, colliders[] }
 * style: 'cobra' (Seattle steel cobra-head) | 'acorn' (historic) | 'park'
 */
export function buildLamps(allPoints, ground, { style = 'cobra', color = '#5c6066', h = 8.5 } = {}) {
    const grp = new THREE.Group(); grp.name = 'lamps';
    // meshless light points (lamps modelled by the scene itself, e.g. under an arcade): render-lamp entries only
    const extra = allPoints.filter((p) => p.noPost).map((p) => ({ x: p.x, z: p.z, h: p.h || 3, y: p.y ?? ground.heightAt(p.x, p.z) }));
    const points = allPoints.filter((p) => !p.noPost), n = points.length;
    if (!n) return { group: grp, lamps: extra, headMesh: null, colliders: [] };
    const top = style === 'acorn' || style === 'lantern' || style === 'candelabra';
    const postG = top ? new THREE.CylinderGeometry(0.06, style === 'lantern' ? 0.16 : 0.14, h, 8) : new THREE.CylinderGeometry(0.07, 0.13, h, 7); postG.translate(0, h / 2, 0);
    if (style === 'lantern') { const base = new THREE.CylinderGeometry(0.2, 0.24, 0.9, 6, 1, true); base.translate(0, 0.45, 0); const cap = new THREE.CylinderGeometry(0.03, 0.2, 0.22, 6); cap.translate(0, h + 0.72, 0); const ring = new THREE.CylinderGeometry(0.12, 0.08, 0.12, 6); ring.translate(0, h + 0.02, 0); const fin = new THREE.SphereGeometry(0.05, 4, 3); fin.translate(0, h + 0.86, 0); postG.copy(mergeGeos([postG, base, cap, ring, fin])); }
    const armG = new THREE.BoxGeometry(0.08, 0.08, 1.9); armG.translate(0, h - 0.15, -0.95);
    const headG = style === 'candelabra' ? (() => { const gl = []; for (const [x, z] of [[-1.15, 0], [1.15, 0], [0, 0]]) { const q = new THREE.SphereGeometry(0.26, 7, 5); q.translate(x, h - 0.2 + (x === 0 && z === 0 ? 0.45 : 0), z); gl.push(q); } return mergeGeos(gl); })() : style === 'acorn' ? new THREE.SphereGeometry(0.28, 10, 8) : style === 'lantern' ? new THREE.CylinderGeometry(0.2, 0.13, 0.62, 6) : new THREE.BoxGeometry(0.38, 0.14, 0.75);
    if (style === 'candelabra') { /* globes already placed */ } else if (style === 'acorn') headG.translate(0, h + 0.2, 0); else if (style === 'lantern') headG.translate(0, h + 0.39, 0); else headG.translate(0, h - 0.24, -1.8);
    const post = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 }), n);
    if (style === 'candelabra') { // Bucharest boulevard candelabra: fluted post, scroll ring, crossbar with three globes
        const base = new THREE.CylinderGeometry(0.26, 0.32, 1.4, 8); base.translate(0, 0.7, 0);
        const ring = new THREE.TorusGeometry(0.45, 0.04, 3, 10); ring.translate(0, h - 1.6, 0);
        const ring2 = ring.clone(); ring2.rotateY(Math.PI / 2);
        const bar = new THREE.BoxGeometry(2.4, 0.08, 0.08); bar.translate(0, h - 0.5, 0);
        const bar2 = new THREE.BoxGeometry(0.08, 0.08, 1.6); bar2.translate(0, h - 0.5, 0);
        postG.copy(mergeGeos([postG, base, ring, ring2, bar, bar2]));
    }
    const arm = top ? null : new THREE.InstancedMesh(armG, post.material, n);
    const headMat = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.3, emissive: '#000000' }); headMat.name = 'lampHeads';
    const head = new THREE.InstancedMesh(headG, headMat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const lamps = [], colliders = [];
    points.forEach((p, i) => {
        const y = p.y ?? ground.heightAt(p.x, p.z), rot = p.rot ?? 0; // rot: yaw so the arm points along −z rotated
        m4.compose(new THREE.Vector3(p.x, y, p.z), q.setFromAxisAngle(up, rot), one);
        post.setMatrixAt(i, m4); arm?.setMatrixAt(i, m4); head.setMatrixAt(i, m4);
        // render.js lamp head offset: x += cos(rot)·1.8, z -= sin(rot)·1.8 → our arm (−z rotated by rot) matches rot' = rot + π/2
        if (top) lamps.push({ x: p.x, z: p.z, h: (h + 0.3) * 8 / 7.7, y });
        else lamps.push({ x: p.x, z: p.z, h, rot: rot + Math.PI / 2, y });
        colliders.push({ x: p.x, z: p.z, r: 0.16, hw: 0.16, prop: true, h });
    });
    for (const m of [post, arm, head]) if (m) { m.castShadow = m !== head; m.computeBoundingSphere(); grp.add(m); }
    return { group: grp, lamps: [...lamps, ...extra], headMesh: head, colliders };
}
function mergeGeos(list) {
    const pos = [], nor = [], idx = []; let base = 0;
    for (const g0 of list) { const g = g0.index ? g0 : g0; const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); } if (g.index) for (const i of g.index.array) idx.push(base + i); else for (let i = 0; i < P.count; i++) idx.push(base + i); base += P.count; }
    const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setIndex(idx); return o;
}
/** lamp positions along motor roads (every `spacing` m, alternating sides), arm pointing over the road */
export function roadLampPoints(data, { spacing = 34, skip = new Set(), inside = null, kinds = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk'], seed = 2 } = {}) {
    const r = rng(seed), out = [];
    for (const w of data.ways) {
        if (skip.has(w.id) || !kinds.includes(w.k) || !onGround(w)) continue;
        const lanes = parseInt(w.lanes, 10), W = lanes > 0 ? lanes * 3.3 + 2.6 : ROAD_W[w.k] || 8, L = polylineLength(w.pts);
        let side = r() < 0.5 ? 1 : -1;
        for (let s = spacing * 0.5 * r(); s < L; s += spacing) {
            const p = alongPolyline(w.pts, s), off = W / 2 + 0.6, x = p.x - p.tz * off * side, z = p.z + p.tx * off * side;
            if (inside && !inside(x, z)) { side = -side; continue; }
            // arm points toward the road centre: direction (p.tz*side, -p.tx*side)
            const dx = p.tz * side, dz = -p.tx * side; // unit vector from lamp toward the road
            out.push({ x, z, rot: Math.atan2(-dx, -dz) });
            side = -side;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------- furniture props
/** benches, bins, bike racks, hydrants, bollards, drinking fountains, info boards from OSM furniture points */
export function buildFurniture(data, ground, { inside = null, exclude = [], seed = 4, onRoad = null } = {}) {
    const b = new GeoBatch(), r = rng(seed), colliders = [];
    const ok = (x, z) => (!inside || inside(x, z)) && !exclude.some((p) => inPoly(x, z, p)) && !(onRoad && onRoad(x, z, 0.4));
    const yaw = (x, z) => { // face the nearest footway/road
        let best = null; for (const w of data.ways) { const d = distPolyline(x, z, w.pts); if (!best || d.d < best.d) best = d; }
        return best && best.d < 15 ? Math.atan2(best.cx - x, best.cz - z) : r() * 6.28;
    };
    for (const [x, z] of data.furniture.bench || []) {
        if (!ok(x, z)) continue; const y = ground.heightAt(x, z), a = yaw(x, z);
        bench(b, x, y, z, a); colliders.push({ x, z, r: 1, angle: a, hw: 0.9, hd: 0.3, prop: true, h: 0.45 });
    }
    for (const [x, z] of data.furniture.waste_basket || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z); b.cyl(x, y, z, 0.28, 0.95, '#2f3a33', 'metal', 10); b.cyl(x, y + 0.95, z, 0.3, 0.06, '#1f2622', 'metal', 10); colliders.push({ x, z, r: 0.3, hw: 0.3, prop: true, h: 1 }); }
    for (const [x, z] of data.furniture.fire_hydrant || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z); b.cyl(x, y, z, 0.13, 0.65, '#c9a227', 'paint', 8); b.sphere(x, y + 0.68, z, 0.14, 0.1, 0.14, '#c9a227', 'paint', 8, 5); b.boxC(x, y + 0.45, z, 0.42, 0.09, 0.09, '#c9a227', 'paint'); }
    for (const [x, z] of data.furniture.bollard || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z); b.cyl(x, y, z, 0.11, 0.95, '#3a3d40', 'metal', 8); colliders.push({ x, z, r: 0.12, hw: 0.12, prop: true, h: 0.95 }); }
    for (const [x, z] of data.furniture.bicycle_parking || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z), a = yaw(x, z); for (let i = -1; i <= 1; i += 2) { const ox = Math.cos(a) * i * 0.45, oz = -Math.sin(a) * i * 0.45; b.tube([[x + ox - Math.sin(a) * 0.35, y, z + oz - Math.cos(a) * 0.35], [x + ox - Math.sin(a) * 0.35, y + 0.8, z + oz - Math.cos(a) * 0.35], [x + ox + Math.sin(a) * 0.35, y + 0.8, z + oz + Math.cos(a) * 0.35], [x + ox + Math.sin(a) * 0.35, y, z + oz + Math.cos(a) * 0.35]], 0.03, '#8c9196', 'steel', 6); } }
    for (const [x, z] of data.furniture.drinking_water || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z); b.cyl(x, y, z, 0.2, 0.9, '#5d6a72', 'metal', 10); b.cyl(x, y + 0.9, z, 0.28, 0.08, '#9aa3a8', 'steel', 12); }
    // OSM `tourism=information` boards carry no text in the data: no blank board is placed (note 36); scenes add real plaques
    for (const [x, z] of data.furniture.picnic_table || []) { if (!ok(x, z)) continue; const y = ground.heightAt(x, z), a = yaw(x, z); b.box(x, y + 0.72, z, 1.8, 0.06, 0.8, '#7a5a3c', 'wood', a); for (const s of [-1, 1]) b.box(x + Math.cos(a) * 0 + Math.sin(a) * 0, y + 0.42, z, 1.8, 0.05, 0.3, '#6d5034', 'wood', a); b.box(x, y, z, 0.1, 0.72, 0.1, '#5d4632', 'wood', a); colliders.push({ x, z, r: 1, angle: a, hw: 0.9, hd: 0.7, prop: true, h: 0.78 }); }
    return { group: b.build('furniture'), colliders };
}
export function bench(b, x, y, z, a, col = '#6e5a42', frame = '#2e3236') {
    // slats + back + two cast frames; forward = facing direction a (yaw) → +z local
    const S = Math.sin(a), C = Math.cos(a), P = (lx, lz) => [x + C * lx + S * lz, z - S * lx + C * lz];
    for (let i = 0; i < 3; i++) { const [px, pz] = P(0, -0.12 + i * 0.13); b.box(px, y + 0.43, pz, 1.8, 0.04, 0.1, col, 'wood', a); }
    for (let i = 0; i < 2; i++) { const [px, pz] = P(0, -0.25); b.boxC(px, y + 0.62 + i * 0.14, pz, 1.8, 0.1, 0.035, col, 'wood', a, -0.2); }
    for (const s of [-0.8, 0.8]) { const [px, pz] = P(s, -0.05); b.box(px, y, pz, 0.06, 0.45, 0.5, frame, 'metal', a); const [qx, qz] = P(s, -0.27); b.box(qx, y + 0.4, qz, 0.06, 0.45, 0.05, frame, 'metal', a, -0.2); }
}

// ---------------------------------------------------------------------------- water
/** a big water plane at level y (fog-friendly, sun glints), optionally clipped to a box */
export function waterPlane(y, box, { color = '#2f4f5e', name = 'water' } = {}) {
    const W = box.x1 - box.x0, H = box.z1 - box.z0;
    const g = new THREE.PlaneGeometry(W, H, 1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.2 });
    m.name = 'spot-water';
    const mesh = new THREE.Mesh(g, m); mesh.position.set((box.x0 + box.x1) / 2, y, (box.z0 + box.z1) / 2); mesh.name = name; mesh.receiveShadow = true;
    return mesh;
}
