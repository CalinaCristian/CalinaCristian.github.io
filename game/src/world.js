import * as THREE from '../vendor/three.module.min.js';
import { makeRng, distPointSeg, pointInPolygon, clamp, makeCanvasTexture, landmarkHelpers } from './util.js';
import { makeTextures } from './buildings.js';
import { makeVehicle, CAR_COLORS, makeParkedCars } from './vehicles.js';
import { projector, CHAPTERS } from './cities.js';
import { STOPS } from './data.js';
import { MeshBuilder, rgb, shadeRgb, prep, mergeProps, bakeProp, UNIT_BOX } from './geobuild.js';
import { treeGeometries, SPECIES, defaultSpecies, buildSpeciesTrees, speciesFromOSM } from './trees.js';

// ============================================================================
//  WORLD — builds the 3D city from OpenStreetMap data (game/data/<city>.json,
//  produced by tools/osm/build-data.mjs; schema documented there and in
//  game/data/README.md).
//
//  Public API (used by main.js / traffic.js / nav.js / minimap.js / player.js):
//    world.group, world.graph {nodes (object by id), edges []}, world.nearestEdge(x,z),
//    world.edgesInBox(x0,z0,x1,z1,cb), world.lightState(nodeId, edge, time, cycle),
//    world.updateLights(time, cycle), world.buildings (collision list with .query),
//    world.pois, world.isWater(x,z), world.isPark(x,z), world.bounds, world.districts,
//    world.areas, world.landmarks, world.sky, world.waterMesh, world.stats
//    world.roadHeight(x, z, { y, edge })  surface height near the body's level (bridges never snap)
//    world.surfacesAt(x, z), world.walls (railings / embankments / trench walls / guard rails / barriers,
//      also in world.buildings; collideBuildings(list, x, z, r, y) gates them by height),
//    world.onRibbon(x, z, r), world.ribbons, world.audit(), world.trafficProfile(hour, {cls, weekend}),
//    world.vegetation {treeCrownMeshes, treeTrunkMeshes, deciduousMask, grassMaterials, groundMaterials, roofMaterials}
// ================================================================================

const CELL = 250;
// layering heights (metres) — every flat layer has its own height to avoid z-fighting
const Y = { landuse: 0.02, grass: 0.045, forest: 0.06, park: 0.07, pitch: 0.095, parking: 0.095, water: 0.11, ballast: 0.2, side: 0.15, road: 0.24, layer: 0.09, mark: 0.03, kerb: 0.13 };
const TILE = { interwar: 0, eclectic: 1, civic: 2, bloc: 3, glass: 4, house: 5, shop: 6, plain: 7, church: 1 };
/** window grid (columns × rows) drawn in each facade atlas tile: wall UVs are divided by it so one window column = one
 *  bay (≈ 2.4–3.6 m) and one window row = one storey (the tiles hold 2 storeys and 2–4 bays: without this the windows
 *  came out at half / a quarter of their real size — the "tiny window dots") */
const TILE_GRID = { 0: [2, 2], 1: [3, 2], 2: [4, 2], 3: [4, 2], 4: [4, 2], 5: [3, 1], 6: [1, 1], 7: [1, 1], 8: [3, 2], 9: [3, 2], 10: [2, 2], 11: [4, 2], 12: [2, 4], 13: [2, 1], 14: [1, 1], 15: [4, 1] };
const GRASSY = new Set(['park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'turf']);
const PAVED = new Set(['parking', 'apron', 'runway', 'clay', 'hard', 'pool']); // (courts / pools over the park or yard they sit in; track stays in the first-drawn area layer, under its infield pitch)
const AREA_Y = { track: Y.pitch - 0.012, clay: Y.pitch + 0.004, turf: Y.pitch, hard: Y.pitch + 0.004, pool: Y.pitch + 0.006, yard: Y.landuse + 0.01, residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
const TRAFFIC_MUL = { motorway: 0.6, motorway_link: 0.3, trunk: 1.2, trunk_link: 0.35, primary: 1.8, primary_link: 0.4, secondary: 1.3, secondary_link: 0.3, tertiary: 0.9, tertiary_link: 0.25, residential: 0.3, unclassified: 0.35, living_street: 0.08, service: 0.04 };
const CLASS_RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, motorway_link: 4, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3, unclassified: 2, residential: 2, living_street: 1 };

const PALETTES = {
    RO: {
        interwar: ['#ecebe6', '#e7dfca', '#d2d0cb', '#f1ece1', '#dcd6c8', '#e2d6bf', '#c9c6be'],
        // 19th-c. plasters: cream, ochre, pale yellow, salmon / pink, light grey, sage, weathered white
        eclectic: ['#e8d7b0', '#d9b46a', '#ecd98e', '#e3a98c', '#e0b2a8', '#c9c7c2', '#b9c2a3', '#e6e2d8', '#d7c09a', '#cf9c7c'],
        civic: ['#efe9db', '#e8e1cf', '#f3eee3', '#e4dccb'],
        // grey / beige panels, about a third repainted in pastel thermal insulation (ochre, peach, light green, blue)
        bloc: ['#b9b5aa', '#c7c2b6', '#a9a69d', '#d1cdc3', '#bcb3a4', '#d8cfb8', '#c9b79c', '#d9b25f', '#e8b394', '#b9cf9a', '#a9c3d6', '#e3c98a'],
        glass: ['#5b86a8', '#6f9bbd', '#4d7593', '#6e9a96', '#3d5e78', '#8fa3ad', '#2f4a60', '#7d8f99'],
        house: ['#f1e8d4', '#ebdfc6', '#f6efe0', '#e3d6bd', '#dcd2c0', '#efd9b5', '#e8c9a8'],
        shop: ['#e3e3e0', '#d6d8da', '#eeeeee', '#e8e2d4'],
        plain: ['#a8a59f', '#9a9ea2', '#b5b1a8', '#c2bdb2', '#8d9194'],
        church: ['#efe6d2', '#e8dcc4', '#f4eee2'],
    },
    US: {
        interwar: ['#9e4f3a', '#8c4a36', '#b0654a', '#c9c3b8', '#a9a49b', '#7f4634'], // brick low-rise + concrete
        eclectic: ['#b98d6a', '#a7795a', '#c7a07f', '#9e4f3a'],
        civic: ['#d8d4cc', '#c9c5bd'],
        bloc: ['#c8c2b4', '#a9b4b8', '#d9cfb9', '#9fb0b8', '#b7a99a', '#e0d6c3', '#8e9ea6'],
        glass: ['#5b7f99', '#6a8a8a', '#45657d', '#9aa6ad', '#3a556b', '#7f9a96', '#2c4356', '#8d9399'], // blue-green, grey, silver
        house: ['#d8d2c4', '#c9cfd3', '#e6e1d6', '#b7c1c9', '#cbbfae', '#9fb0b8', '#e0d6c3', '#a7b59c', '#c4a98a'],
        shop: ['#d9d4c8', '#cfd2d4', '#e6e2da', '#b9b1a3'],
        plain: ['#9a9ea2', '#8d9194', '#a7abae', '#b5b1a8'],
        church: ['#d8d2c4', '#c9c3b8'],
    },
};
const VILLA_PAL = ['#ead9b0', '#e6c98a', '#f0e3c2', '#e8c3a4', '#e2b9a8', '#efe9dc', '#d8d0bc', '#dcc79a', '#f2ead6', '#c9d2b8', '#e9d29c', '#f3efe6'];
const ROOF_COL = { RO: { pitched: ['#8a4b36', '#9c5a3c', '#6d5a4e', '#7a3f2e', '#5a5e63'], flat: ['#6f6c67', '#7a7670', '#8a8075', '#5f5d59', '#3d3b39', '#8c8f92'] }, US: { pitched: ['#4a4e55', '#5e5a55', '#3f4348', '#6b5f55', '#53504c'], flat: ['#6b6f73', '#5c6062', '#7a7d80'] } };

// brand → [background, foreground, accent]
const BRANDS = {
    "mcdonald's": ['#da291c', '#ffc72c', '#ffc72c'], 'kfc': ['#a3080c', '#ffffff', '#ffffff'], 'starbucks': ['#00704a', '#ffffff', '#ffffff'],
    'mega image': ['#e4572e', '#ffffff', '#ffd200'], 'shop&go': ['#e30613', '#ffffff', '#ffffff'], 'carrefour': ['#004e9f', '#ffffff', '#e2001a'],
    'lidl': ['#0050aa', '#fff000', '#e60a14'], 'kaufland': ['#e10915', '#ffffff', '#ffffff'], 'profi': ['#e2001a', '#ffffff', '#ffffff'],
    'penny': ['#cd1414', '#fff200', '#fff200'], 'auchan': ['#e2001a', '#ffffff', '#5ab031'],
    'petrom': ['#004b93', '#ffd200', '#ffd200'], 'omv': ['#00539f', '#ffffff', '#009a44'], 'mol': ['#e2001a', '#ffffff', '#00843d'],
    'rompetrol': ['#f39200', '#ffffff', '#1d3c82'], 'lukoil': ['#e30613', '#ffffff', '#ffffff'], 'socar': ['#0057a8', '#ffffff', '#e30613'],
    'catena': ['#e2001a', '#ffffff', '#ffffff'], 'sensiblu': ['#0e7a3c', '#ffffff', '#ffffff'], 'dr. max': ['#00529c', '#ffffff', '#e30613'],
    'help net': ['#e30613', '#ffffff', '#ffffff'], 'bcr': ['#00468c', '#ffffff', '#ffffff'], 'brd': ['#111111', '#ffffff', '#e2001a'],
    'ing': ['#ff6200', '#ffffff', '#ffffff'], 'raiffeisen': ['#fff200', '#111111', '#111111'], 'banca transilvania': ['#003d7c', '#ffffff', '#fcd116'],
    'cec bank': ['#00543c', '#ffffff', '#ffffff'], 'unicredit': ['#e2001a', '#ffffff', '#ffffff'], "ted's coffee": ['#5a3825', '#ffffff', '#c8a26b'],
    '5 to go': ['#ffde00', '#111111', '#111111'], 'subway': ['#008c15', '#ffc600', '#ffc600'], 'burger king': ['#d62300', '#f5ebdc', '#ffaa00'],
    'shell': ['#ffd500', '#dd1d21', '#dd1d21'], 'chevron': ['#0054a4', '#ffffff', '#e2231a'], '76': ['#f47920', '#0055a5', '#0055a5'],
    'arco': ['#0068b4', '#ffffff', '#e2231a'], 'safeway': ['#e31837', '#ffffff', '#ffffff'], 'qfc': ['#003da5', '#ffffff', '#e31837'],
    'costco': ['#e31837', '#ffffff', '#005daa'], 'amazon': ['#232f3e', '#ff9900', '#ff9900'], 'whole foods': ['#00674b', '#ffffff', '#ffffff'],
    'bank of america': ['#012169', '#ffffff', '#e31837'], 'chase': ['#117aca', '#ffffff', '#ffffff'], 'wells fargo': ['#d71e28', '#ffcd41', '#ffcd41'],
    'walgreens': ['#e31837', '#ffffff', '#ffffff'], 'cvs': ['#cc0000', '#ffffff', '#ffffff'], 'bartell': ['#c8102e', '#ffffff', '#ffffff'],
    'target': ['#cc0000', '#ffffff', '#ffffff'], "trader joe's": ['#c8102e', '#ffffff', '#ffffff'], 'taco bell': ['#702082', '#ffffff', '#ffffff'],
    "wendy's": ['#e2203d', '#ffffff', '#ffffff'], 'jack in the box': ['#e30613', '#ffffff', '#ffffff'], 'dutch bros': ['#00468b', '#ffffff', '#ffffff'],
    'bp': ['#007f00', '#ffffff', '#ffe600'], 'valero': ['#003c71', '#ffffff', '#f7a800'], 'dm': ['#002878', '#ffffff', '#ffd600'],
    'orange': ['#111111', '#ff7900', '#ff7900'], 'vodafone': ['#e60000', '#ffffff', '#ffffff'], 'luca': ['#7a1e2c', '#ffffff', '#e8c07a'],
    'paul': ['#111111', '#ffffff', '#c8a26b'], 'mesopotamia': ['#7a1e2c', '#ffffff', '#ffffff'], 'spartan': ['#0b4f2c', '#ffffff', '#ffffff'],
};
const KIND_STYLE = {
    fuel: { bg: '#1f2937', fg: '#ffffff', icon: '⛽', color: '#0ea5e9' }, food: { bg: '#b91c1c', fg: '#ffffff', icon: '🍔', color: '#ef4444' },
    shop: { bg: '#ea580c', fg: '#ffffff', icon: '🛒', color: '#f97316' }, bank: { bg: '#1e3a8a', fg: '#ffffff', icon: '🏦', color: '#3b82f6' },
    pharmacy: { bg: '#15803d', fg: '#ffffff', icon: '💊', color: '#22c55e' }, metro: { bg: '#1d4ed8', fg: '#ffffff', icon: 'Ⓜ', color: '#2563eb' },
    busstop: { bg: '#0f766e', fg: '#ffffff', icon: '🚌', color: '#14b8a6' }, hospital: { bg: '#dc2626', fg: '#ffffff', icon: '🏥', color: '#dc2626' },
    landmark: { bg: '#44403c', fg: '#ffffff', icon: '🏛', color: '#78716c' }, park: { bg: '#166534', fg: '#ffffff', icon: '🌳', color: '#16a34a' },
    hotel: { bg: '#4b5563', fg: '#ffffff', icon: '🏨', color: '#6b7280' }, school: { bg: '#5b21b6', fg: '#ffffff', icon: '🎓', color: '#8b5cf6' },
    airport: { bg: '#111827', fg: '#ffffff', icon: '✈', color: '#111827' }, office: { bg: '#1f2937', fg: '#ffffff', icon: '🏢', color: '#f97316' },
};
let RESEARCH_BRANDS = {}; // per loaded map: data.brands (sign colours from the field research)
const brandStyle = (name) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (RESEARCH_BRANDS[k]) return RESEARCH_BRANDS[k];
    for (const b in BRANDS) if (new RegExp('(^|[^\\p{L}\\p{N}])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'u').test(k)) return BRANDS[b]; // whole-word match (research Request: 'Mega' ≠ 'Megaron')
    return null;
};

const shoulderOf = (e) => (/motorway|trunk/.test(e.type) ? (e.type.endsWith('_link') ? 0.6 : 1.2) : 0.15);
const AWNING = ['#b91c1c', '#1f4e79', '#14532d', '#7c2d12', '#374151', '#6b21a8', '#0f766e', '#a16207'].map(rgb);
const PHASES = [];
let _phaseT = 0, _phaseName = '';
const setProgress = (msg) => {
    const now = performance.now(); if (_phaseName) PHASES.push([_phaseName, Math.round(now - _phaseT)]); _phaseT = now; _phaseName = msg; if (!msg) return; try { const el = document.querySelector('#loading p'); if (el) el.textContent = msg; } catch (e) { /* no DOM */ } };
const tick = () => new Promise(r => setTimeout(r, 0));

// ---------------------------------------------------------------------------
//  Data helpers
// ---------------------------------------------------------------------------
function undelta(arr, start, q = 0.1) {
    const pts = [];
    let x = 0, z = 0;
    for (let i = start; i + 1 < arr.length; i += 2) {
        if (i === start) { x = arr[i]; z = arr[i + 1]; } else { x += arr[i]; z += arr[i + 1]; }
        pts.push([x * q, z * q]);
    }
    return pts;
}
const signedArea = (pts) => { let s = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return s / 2; };
function centroid(pts) {
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a += f; cx += (pts[j][0] + pts[i][0]) * f; cz += (pts[j][1] + pts[i][1]) * f; }
    if (Math.abs(a) < 1e-6) { let sx = 0, sz = 0; for (const p of pts) { sx += p[0]; sz += p[1]; } return [sx / pts.length, sz / pts.length]; }
    return [cx / (3 * a), cz / (3 * a)];
}
function convexHull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
}
/** do two polygons' edges cross (proper segment intersections)? */
function polysCross(A, B) {
    const cr = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    for (let i = 0; i < A.length; i++) {
        const [ax, az] = A[i], [bx, bz] = A[(i + 1) % A.length];
        for (let j = 0; j < B.length; j++) {
            const [cx, cz] = B[j], [dx, dz] = B[(j + 1) % B.length];
            const d1 = cr(ax, az, bx, bz, cx, cz), d2 = cr(ax, az, bx, bz, dx, dz), d3 = cr(cx, cz, dx, dz, ax, az), d4 = cr(cx, cz, dx, dz, bx, bz);
            if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
        }
    }
    return false;
}
function triangulate(outer, holes = []) {
    const contour = outer.map(([x, z]) => new THREE.Vector2(x, z));
    const hs = holes.map(h => h.map(([x, z]) => new THREE.Vector2(x, z)));
    try { return { pts: outer.concat(...holes), tris: THREE.ShapeUtils.triangulateShape(contour, hs) }; } catch (e) { return { pts: outer, tris: [] }; }
}

/** Uniform grid keyed by cell → array of items (items inserted by bbox). */
class BoxGrid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    k(i, j) { return i * 73856093 ^ j * 19349663; }
    insert(x0, z0, x1, z1, item) {
        const c = this.cell;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const key = this.k(i, j); let a = this.map.get(key); if (!a) this.map.set(key, a = []); a.push(item);
        }
    }
    cell_(i, j) { return this.map.get(this.k(i, j)); }
    /** items in cells overlapping the box (may contain duplicates) */
    each(x0, z0, x1, z1, cb) {
        const c = this.cell;
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
            const a = this.map.get(this.k(i, j)); if (a) for (const it of a) cb(it);
        }
    }
}

// ---------------------------------------------------------------------------
//  Materials / textures
// ---------------------------------------------------------------------------
function makeAtlas() {
    // 4x4 tiles of 256 px: tiles 0-7 = buildings.js facade textures, 8-15 = variants drawn here
    const T = makeTextures();
    const S = 256;
    const win = (ctx, x, y, { cols, rows, ww, wh, frame = 'rgba(255,255,255,0.45)', glass = 'rgba(35,55,85,0.8)', lit = 0, arch = false, shutters = null, band = 0 }) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);
        const cw = S / cols, ch = S / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const wx = x + i * cw + cw * (1 - ww) / 2, wy = y + j * ch + ch * (1 - wh) / 2, w = cw * ww, h = ch * wh;
            ctx.fillStyle = frame; ctx.fillRect(wx - 3, wy - 3, w + 6, h + 6);
            ctx.fillStyle = Math.random() < lit ? 'rgba(90,110,130,0.75)' : glass;
            if (arch) { ctx.beginPath(); ctx.moveTo(wx, wy + h); ctx.lineTo(wx, wy + w / 2); ctx.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); ctx.lineTo(wx + w, wy + h); ctx.closePath(); ctx.fill(); }
            else ctx.fillRect(wx, wy, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(wx, wy + (arch ? w / 2 : 0), w, h * 0.12);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(wx + w / 2 - 1, wy, 2, h); // mullion
            if (shutters) { ctx.fillStyle = shutters; ctx.fillRect(wx - w * 0.28, wy, w * 0.24, h); ctx.fillRect(wx + w * 1.04, wy, w * 0.24, h); }
            ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(wx - 4, wy + h + 3, w + 8, 4); // sill shadow
        }
        if (band) { ctx.fillStyle = `rgba(0,0,0,${band})`; for (let j = 0; j < rows; j++) ctx.fillRect(x, y + j * ch, S, 5); }
    };
    const tex = makeCanvasTexture(4 * S, 4 * S, (ctx) => {
        const order = ['interwar', 'eclectic', 'civic', 'bloc', 'glass', 'house', 'shop', 'plain'];
        const at = (k) => [(k % 4) * S, (3 - Math.floor(k / 4)) * S]; // flipY: uv row r → canvas row 3-r
        order.forEach((name, k) => {
            const [x, y] = at(k);
            if (name === 'plain') {
                ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y, S, S);
                for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(x + Math.random() * S, y + Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4); }
                ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + S - 6, S, 6);
            } else ctx.drawImage(T[name].image, x, y, S, S);
        });
        // variants
        let [x, y] = at(8); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.62, wh: 0.5, band: 0.12 });                                   // interwar: square windows, strong bands
        [x, y] = at(9); win(ctx, x, y, { cols: 3, rows: 2, ww: 0.36, wh: 0.66, arch: true, frame: 'rgba(255,255,255,0.7)' });       // eclectic: arched
        [x, y] = at(10); win(ctx, x, y, { cols: 2, rows: 2, ww: 0.5, wh: 0.7, frame: 'rgba(0,0,0,0.12)', glass: 'rgba(30,45,70,0.75)' }); // civic: tall
        [x, y] = at(11); win(ctx, x, y, { cols: 4, rows: 2, ww: 0.6, wh: 0.42, glass: 'rgba(25,35,55,0.8)', lit: 0.2, band: 0.08 }); // bloc: wide panes
        [x, y] = at(12); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, S, S);                                                       // glass: blue-green curtain wall
        for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 3 ? 'rgba(30,70,90,0.6)' : 'rgba(50,95,110,0.5)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, S / 4 - 4); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + i * S / 2 + 2, y + j * S / 4 + 2, S / 2 - 4, 5); }
        [x, y] = at(13); win(ctx, x, y, { cols: 2, rows: 1, ww: 0.4, wh: 0.45, shutters: 'rgba(90,60,40,0.8)', frame: 'rgba(255,255,255,0.8)' }); // house: shutters
        [x, y] = at(14); ctx.drawImage(T.shop.image, x, y, S, S); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, S, S);  // shop (lighter)
        [x, y] = at(15); ctx.fillStyle = '#e9e6df'; ctx.fillRect(x, y, S, S); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * S / 4, y); ctx.lineTo(x + i * S / 4, y + S); ctx.stroke(); } // plain: panels
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    for (const t of Object.values(T)) t.dispose();
    return tex;
}

/** night-window data atlas, same layout as the facade atlas: R = window glass mask, G = per-window random, B = shopfront
 *  (always lit). Built from the facade atlas pixels (dark bluish glass), windows = 4-connected components. */
/** night / window data atlases, same layout as the facade atlas. nightMap: R = window glass, G = per-window random,
 *  B = shopfront (255) / brand band (128). winMap: R, G = position inside the window rectangle (0..1, v up), B = glass.
 *  Windows = connected glass pixels of the facade atlas, filled to their bounding rectangle (the per-pixel colour test
 *  left noisy holes that read as "TV static" reflections); specks under 24 px are dropped. */
function nightAtlas(atlas) {
    const src = atlas.image, W = src.width, H = src.height;
    const sctx = src.getContext('2d', { willReadFrequently: true }), d = sctx.getImageData(0, 0, W, H).data;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); return { c, x, im: x.createImageData(W, H) }; };
    const N = mk(), U = mk(), o = N.im.data, u = U.im.data;
    const glass = new Uint8Array(W * H), comp = new Int32Array(W * H).fill(-1), S = W / 4;
    const tileAt = (x, y) => (x / S | 0) + (3 - (y / S | 0)) * 4; // canvas row 0 = uv row 3 (flipY)
    for (let k = 0, p = 0; k < W * H; k++, p += 4) {
        const r = d[p], g = d[p + 1], b = d[p + 2], t = tileAt(k % W, k / W | 0), shop = t === 6 || t === 14;
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        const fy = ((k / W | 0) % S) / S; // (0 = top of the cell: the shop texture's coloured sign band is the top ~14 %)
        glass[k] = shop ? (fy < 0.15 && lum > 40 ? 3 : b > r + 25 && lum > 60 ? 2 : 0) : (lum < 150 && b >= r + 4 ? 1 : 0);
    }
    for (let k = 0; k < W * H; k++) { o[k * 4 + 3] = 255; u[k * 4 + 3] = 255; }
    const stack = [];
    for (let k = 0; k < W * H; k++) {
        if (!glass[k] || comp[k] >= 0) continue;
        const kind = glass[k], px = []; comp[k] = 1; stack.push(k);
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        while (stack.length) {
            const q = stack.pop(), x = q % W, y = q / W | 0; px.push(q);
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (n >= 0 && glass[n] === kind && comp[n] < 0) { comp[n] = 1; stack.push(n); }
        }
        if (px.length < 24 && kind === 1) continue;
        const rv = Math.floor(Math.random() * 255);
        if (kind === 1) { // fill the window rectangle
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const p = (y * W + x) * 4; o[p] = 255; o[p + 1] = rv; o[p + 2] = 0;
                u[p] = Math.round((x - x0 + 0.5) / (x1 - x0 + 1) * 255); u[p + 1] = Math.round((1 - (y - y0 + 0.5) / (y1 - y0 + 1)) * 255); u[p + 2] = 255;
            }
        } else for (const q of px) { const p = q * 4; o[p] = kind === 3 ? 0 : 255; o[p + 1] = rv; o[p + 2] = kind === 2 ? 255 : 128; }
    }
    N.x.putImageData(N.im, 0, 0); U.x.putImageData(U.im, 0, 0);
    const tex = (c, nearest) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter; t.generateMipmaps = !nearest; t.anisotropy = 4; return t; };
    return { night: tex(N.c, false), win: tex(U.c, true) };
}

function solidMaterial(atlas) {
    // (2026-11-07, world-visual) PBR so glass curtain walls pick up the sky probe / environment (tiles 4 / 12: metalness
    // 0.55, roughness 0.16; everything else matte), and lit windows at night: render.js eases emissiveIntensity from 0
    // by day to userData.nightEmissive at night (contract 01 → Render); ~42 % of windows lit, warm 2700–4000 K, a few
    // TV-blue, shopfronts always lit and brighter. One material, no extra draw calls.
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.92, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 });
    m.userData.nightEmissive = 1.2;
    m.userData.uClosed = { value: 0 }; // share of shops closed (shutters down), set by world from the local hour
    let night = null, win = null; try { ({ night, win } = nightAtlas(atlas)); } catch (e) { console.warn('[world] night atlas', e); }
    m.onBeforeCompile = (sh) => {
        sh.uniforms.nightMap = { value: night }; sh.uniforms.winMap = { value: win }; sh.uniforms.uClosed = m.userData.uClosed;
        sh.vertexShader = 'attribute float tile;\nvarying float vTileRaw;\nvarying float vWY;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTileRaw = tile;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = 'varying float vTileRaw;\nvarying float vWY;\nuniform sampler2D nightMap;\nuniform sampler2D winMap;\nuniform float uClosed;\nfloat fh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat fvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh1(i), fh1(i + vec2(1, 0)), f.x), mix(fh1(i + vec2(0, 1)), fh1(i + vec2(1, 1)), f.x), f.y); }\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    float isGlass = 0.0, winFar = 1.0, glassOpen = 0.0; vec3 roomCol = vec3(0.0);
#ifdef USE_MAP
    if (vTile > -0.5) {
        vec2 cellSz = vec2(0.25, 0.25);
        vec2 cellId = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 f = fract(vMapUv);
        vec2 auv = (cellId + 0.006 + f * 0.988) * cellSz;
        vec4 sampledDiffuseColor = textureGrad(map, auv, dFdx(vMapUv) * cellSz, dFdy(vMapUv) * cellSz);
        diffuseColor *= sampledDiffuseColor;
        bool shopT = abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1, glassT = abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1;
        float px = max(length(dFdx(vMapUv)), length(dFdy(vMapUv)));
        winFar = smoothstep(0.06, 0.22, px); // window cells of ≲ 15 px: the flat atlas look
        vec4 wi = texture(winMap, auv);
        isGlass = (shopT || glassT) ? 0.0 : step(0.5, wi.b);
        if (isGlass > 0.5 && winFar < 0.999) {
            // interior mapping: ray–box through a fake room behind each window, in the wall's tangent frame (view space)
            float rid = textureLod(nightMap, auv, 0.0).g;
            vec2 key = floor(vMapUv * 4.0) + vec2(rid * 31.0, vTile);
            float r1 = fh1(key), r2 = fh1(key + 7.3), r3 = fh1(key + 13.1), r4 = fh1(key + 21.7);
            vec3 Nv = normalize(vNormal), V = normalize(vViewPosition);
            vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
            vec3 Tv = cross(upV, Nv); float tl = length(Tv); Tv = tl > 1e-3 ? Tv / tl : vec3(1.0, 0.0, 0.0); vec3 Bv = cross(Nv, Tv);
            vec3 dir = -V; vec3 dd = vec3(dot(dir, Tv), dot(dir, Bv), max(1e-3, dot(dir, -Nv)));
            float RW = 1.4, RH = 1.7, RD = 2.6 + 2.4 * r1;
            vec3 p0 = vec3(wi.r * RW, wi.g * RH, 0.0);
            float tx = dd.x > 0.0 ? (RW - p0.x) / max(dd.x, 1e-4) : -p0.x / min(dd.x, -1e-4);
            float ty = dd.y > 0.0 ? (RH - p0.y) / max(dd.y, 1e-4) : -p0.y / min(dd.y, -1e-4);
            float tz = RD / dd.z, t = min(tx, min(ty, tz));
            vec3 hp = p0 + dd * t;
            vec3 wallC = mix(vec3(0.78, 0.72, 0.62), r2 < 0.5 ? vec3(0.62, 0.66, 0.7) : vec3(0.82, 0.76, 0.66), r3);
            vec3 c;
            if (t == tz) { c = wallC; if (hp.y < RH * 0.42 && fract(hp.x / RW * 1.7 + r2) > 0.45) c = vec3(0.24, 0.17, 0.12); // furniture silhouette
                           else if (hp.y > RH * 0.55 && hp.y < RH * 0.85 && fract(hp.x / RW * 2.3 + r4) > 0.7) c = vec3(0.35, 0.3, 0.26); } // picture / shelf
            else if (t == ty) c = dd.y < 0.0 ? vec3(0.36, 0.26, 0.18) : vec3(0.88, 0.86, 0.82);
            else c = wallC * 0.82;
            c *= mix(1.0, 0.5, hp.z / RD); // light falls off into the room
            // curtains / blinds (fabric on the glass plane, top down to a random height); a few open windows
            float cl = r4 < 0.55 ? 1.0 - (0.15 + 0.6 * r3) : 2.0;
            vec3 fabric = mix(vec3(0.9, 0.88, 0.82), r2 < 0.3 ? vec3(0.62, 0.52, 0.42) : vec3(0.82, 0.8, 0.74), r1);
            if (wi.g > cl) { c = fabric * (0.85 + 0.15 * sin(wi.r * 40.0)); glassOpen = 0.5; }
            if (r1 > 0.96 && r2 > 0.5) glassOpen = 1.0;
            roomCol = c;
            // reveal shadow along the top / one side of the opening
            float rev = 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.08, 1.0 - wi.g)) - 0.3 * (1.0 - smoothstep(0.0, 0.06, wi.r));
            diffuseColor.rgb = mix(c * 0.34 * rev, diffuseColor.rgb, winFar); // (rooms are darker than the street by day)
        }
        if (!shopT && !glassT && isGlass < 0.5) { // weathering: grime near the ground, rain streaks, plaster patches
            float g = 1.0 - 0.16 * (1.0 - smoothstep(0.2, 1.8, vWY));
            float streak = fvn(vec2(vMapUv.x * 9.0, 0.5)) * smoothstep(0.55, 1.0, fvn(vec2(vMapUv.x * 23.0, vMapUv.y * 0.6)));
            g *= 1.0 - 0.07 * streak;
            bool old = abs(vTile - 1.0) < 0.1 || abs(vTile - 9.0) < 0.1 || abs(vTile - 3.0) < 0.1 || abs(vTile - 11.0) < 0.1;
            if (old) g *= 0.94 + 0.12 * smoothstep(0.35, 0.75, fvn(vMapUv * vec2(1.7, 2.3) + vTile));
            diffuseColor.rgb *= mix(g, 1.0, winFar * 0.6);
        }
        if (uClosed > 0.001 && (abs(vTile - 6.0) < 0.1 || abs(vTile - 14.0) < 0.1)) { // closed shops: roller shutters over the glass
            // the whole shop opening below the sign band (not the per-pixel glass mask, which aliased into vertical
            // streaks): horizontal roller-shutter slats every ~19 cm, a darker housing box at the top
            float sid = floor(vMapUv.x * 4.0), fu = fract(vMapUv.x * 4.0), fv = fract(vMapUv.y);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            if (hc < uClosed && fv < 0.85 && fv > 0.03 && fu > 0.04 && fu < 0.96) {
                float slat = 0.82 + 0.18 * smoothstep(0.35, 0.5, fract(vMapUv.y * 22.0)) * (1.0 - smoothstep(0.85, 1.0, fract(vMapUv.y * 22.0)));
                diffuseColor.rgb = vec3(0.36, 0.37, 0.38) * (fv > 0.78 ? 0.6 : slat);
            }
        }
    }
#endif`).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
    if (vTile > -0.5 && (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1)) { metalnessFactor = 0.55; roughnessFactor = 0.16; }
#ifdef USE_MAP
    else if (isGlass > 0.5) { // window panes: calm sky reflection over the fake room (curtains / open windows reflect less)
        float gl = 1.0 - glassOpen;
        metalnessFactor = mix(metalnessFactor, 0.35, gl); roughnessFactor = mix(roughnessFactor, 0.12, gl);
    }
#endif`).replace('#include <emissivemap_fragment>', `
#ifdef USE_MAP
    if (vTile > -0.5 && totalEmissiveRadiance.r > 0.001) {
        vec2 cellSz2 = vec2(0.25, 0.25);
        vec2 cellId2 = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 auv2 = (cellId2 + 0.006 + fract(vMapUv) * 0.988) * cellSz2;
        vec3 nm = textureGrad(nightMap, auv2, dFdx(vMapUv) * cellSz2, dFdy(vMapUv) * cellSz2).rgb;
        // lit in runs (2–3 neighbouring bays of one floor share a state, like real offices / flats), and distance-stable:
        // once a facade tile covers only a few pixels, the per-window pattern fades to its average glow (no speckle)
        vec2 cellK = vec2(floor(vMapUv.x / 2.5), floor(vMapUv.y));
        float h = fract(sin(dot(cellK + vec2(floor(nm.g * 2.99) * 7.0, vTile), vec2(12.9898, 78.233))) * 43758.5453);
        float shop = step(0.75, nm.b), sign = step(0.25, nm.b) * (1.0 - shop), lit = max(shop, step(h, 0.42));
        float h2 = fract(h * 13.7);
        vec3 col = h2 > 0.93 ? vec3(0.55, 0.68, 1.0) : mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.82, 0.58), h2);
        if (shop + sign > 0.5) { // shops: interior tint per shop (supermarket cool white, café warm, pharmacy green, bank blue, …)
            float sid = floor(vMapUv.x * 4.0);
            float hs = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(127.1, 311.7))) * 43758.5453);
            float hc = fract(sin(dot(vec2(sid, floor(vMapUv.y) + vTile * 3.1), vec2(41.3, 289.1))) * 15731.743);
            vec3 tint = hs < 0.25 ? vec3(0.68, 0.78, 0.88) : hs < 0.5 ? vec3(1.0, 0.58, 0.28) : hs < 0.62 ? vec3(0.55, 1.0, 0.62) : hs < 0.74 ? vec3(0.5, 0.66, 1.0) : vec3(1.0, 0.8, 0.6);
            float closed = step(hc, uClosed);
            col = shop * tint * (0.85 + 0.3 * fract(hs * 7.3)) * (1.0 - 0.96 * closed)
                + sign * texture(map, auv2).rgb * 1.5 * (1.0 - 0.6 * closed); // brand band brighter than the glass
            lit = 1.0; nm.r = 1.0;
        }
        float far = smoothstep(0.12, 0.45, max(length(dFdx(vMapUv)), length(dFdy(vMapUv)))); // facade tiles per pixel
        float mask = mix(step(0.5, nm.r), nm.r, far);
        lit = mix(lit, mix(0.42, 1.0, max(shop, sign)), far);
        col = mix(col, shop + sign > 0.5 ? col : vec3(1.0, 0.74, 0.47), far);
        if (isGlass > 0.5) col *= mix(vec3(0.75), roomCol * 0.9 + 0.06, (1.0 - winFar) * (1.0 - far)); // (lit room, not a white card)
        if (abs(vTile - 4.0) < 0.1 || abs(vTile - 12.0) < 0.1) { // curtain walls: lit office floors in runs, dim cool light, never per-pane tiles
            float fl = floor(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0)), run = floor(vMapUv.x / 3.0);
            float hf = fract(sin(dot(vec2(fl, run * 0.37 + floor(vMapUv.x / 9.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float fv = fract(vMapUv.y * (abs(vTile - 12.0) < 0.1 ? 4.0 : 2.0));
            lit = step(hf, 0.28) * smoothstep(0.08, 0.2, fv) * (1.0 - smoothstep(0.8, 0.92, fv));
            // (after round 6: lit floors read as solid white slabs) panes between mullions, some with blinds down or dark
            // desks, ceiling lights brighter at the top of the floor, dimmer overall
            { float px2 = vMapUv.x * 4.0, pf = fract(px2), pid = fract(sin(dot(vec2(floor(px2), fl), vec2(39.3, 11.7))) * 24634.63);
              float mull = smoothstep(0.02, 0.07, pf) * (1.0 - smoothstep(0.93, 0.98, pf));
              lit *= mull * (pid < 0.18 ? 0.15 : pid < 0.35 ? 0.55 : 1.0) * (0.55 + 0.45 * smoothstep(0.3, 0.85, fv)); }
            col = mix(vec3(0.78, 0.84, 0.92), vec3(1.0, 0.82, 0.6), step(0.6, fract(hf * 9.1))) * 0.26;
            mask = 1.0; lit = mix(lit, 0.24, far) + 0.03;
        }
        totalEmissiveRadiance *= mask * lit * col;
    } else totalEmissiveRadiance *= 0.0;
#else
    totalEmissiveRadiance *= 0.0;
#endif`);
    };
    { const ob = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { ob(sh, r);
        // (the tile id is an interpolated varying: 7.99999 picked the wrong atlas cell on some pixels — the 'TV static' on
        //  windows; round it once per fragment)
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n\tfloat vTile = floor(vTileRaw + 0.5);'); }; }
    m.customProgramCacheKey = () => 'osm-solid-atlas-pbr4';
    return m;
}

function noiseTexture() {
    const t = makeCanvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < img.data.length; i += 4) { const v = 235 + Math.random() * 20 - (Math.random() < 0.03 ? 30 : 0); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
        ctx.putImageData(img, 0, 0);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 0, 7); ctx.fill(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
}

/** Sign atlas: pages of 2048x2048 with 256x64 cells */
class SignAtlas {
    constructor() { this.pages = []; this.map = new Map(); this.cols = 8; this.rows = 32; }
    get(text, bg = '#1f2937', fg = '#ffffff', accent = null, force = false) {
        const key = text + '|' + bg + '|' + fg + '|' + accent;
        let r = this.map.get(key); if (r) return r;
        let page = this.pages[this.pages.length - 1];
        if (!page || page.n >= this.cols * this.rows) {
            if (this.pages.length >= (force ? 7 : 6)) return null; // road-sign pictograms may use one extra page
            const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
            page = { canvas: c, ctx: c.getContext('2d'), n: 0, tex: null };
            this.pages.push(page);
        }
        const i = page.n++, col = i % this.cols, row = Math.floor(i / this.cols);
        const W = 256, H = 64, x = col * W, y = row * H, ctx = page.ctx;
        ctx.fillStyle = bg; ctx.fillRect(x, y, W, H);
        if (accent) { ctx.fillStyle = accent; ctx.fillRect(x, y + H - 7, W, 7); }
        ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let size = 40; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        while (ctx.measureText(text).width > W - 16 && size > 14) { size -= 2; ctx.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; }
        ctx.fillText(text, x + W / 2, y + H / 2 - (accent ? 3 : 0), W - 12);
        const pi = this.pages.indexOf(page);
        r = { page: pi, u0: (x + 1) / 2048, u1: (x + W - 1) / 2048, v0: 1 - (y + H - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: Math.min(4, Math.max(1.6, ctx.measureText(text).width / H + 0.6)) };
        this.map.set(key, r); return r;
    }
    /** a 64×64 pictogram (road signs) drawn by draw(ctx, x, y, size); four per atlas cell */
    icon(key, draw) {
        const k = 'icon|' + key;
        let r = this.map.get(k); if (r) return r;
        if (!this.sq || this.sq.k >= 4) {
            const cell = this.get('\u0000' + (this.nIcon = (this.nIcon || 0) + 1), 'rgba(0,0,0,0)', '#000', null, true); if (!cell) return null;
            const page = this.pages[cell.page];
            const x = Math.round(cell.u0 * 2048 - 1), y = Math.round((1 - cell.v1) * 2048 - 1);
            page.ctx.clearRect(x, y, 256, 64);
            this.sq = { page: cell.page, x, y, k: 0 };
        }
        const S2 = 64, x = this.sq.x + this.sq.k * 64, y = this.sq.y, ctx = this.pages[this.sq.page].ctx;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, S2, S2); ctx.clip(); draw(ctx, x, y, S2); ctx.restore();
        this.sq.k++;
        r = { page: this.sq.page, u0: (x + 1) / 2048, u1: (x + S2 - 1) / 2048, v0: 1 - (y + S2 - 1) / 2048, v1: 1 - (y + 1) / 2048, aspect: 1 };
        this.map.set(k, r); return r;
    }
    textures() {
        return this.pages.map(p => { const t = new THREE.CanvasTexture(p.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
    }
}

// ---------------------------------------------------------------------------
//  Prop geometries (prepared once)
// ---------------------------------------------------------------------------
let PROPS = null;
function props() {
    if (PROPS) return PROPS;
    const crown = new THREE.IcosahedronGeometry(1, 0);
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1, 5);
    const tree = mergeProps([bakeProp(trunk, { y: 1.6, sy: 3.2, color: '#6b4a2f' }), bakeProp(crown, { y: 4.6, sx: 2.6, sy: 2.4, sz: 2.6, color: '#4f8a3c' })]);
    const tree2 = mergeProps([bakeProp(trunk, { y: 1.5, sy: 3, color: '#5e4330' }), bakeProp(crown, { y: 4.0, sx: 2.0, sy: 2.6, sz: 2.0, color: '#5d9440' }), bakeProp(crown, { y: 5.6, sx: 1.4, sy: 1.5, sz: 1.4, color: '#679c48' })]);
    const cone = new THREE.ConeGeometry(1, 1, 6);
    const conifer = mergeProps([bakeProp(trunk, { y: 1, sy: 2, color: '#5b4030' }), bakeProp(cone, { y: 4.5, sx: 2.3, sy: 6, sz: 2.3, color: '#2f5d3a' }), bakeProp(cone, { y: 7.6, sx: 1.6, sy: 4, sz: 1.6, color: '#356640' })]);
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 6);
    const lamp = mergeProps([bakeProp(pole, { y: 4, sy: 8, color: '#4a4f57' }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 0.9, y: 7.9, sx: 1.9, sy: 0.12, sz: 0.12, color: '#4a4f57' }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 1.8, y: 7.8, sx: 0.7, sy: 0.18, sz: 0.32, color: '#fff3c4' })]);
    const box = new THREE.BoxGeometry(1, 1, 1);
    // traffic light pole + housing (housing faces +x = toward incoming traffic after rotation)
    const tlight = mergeProps([bakeProp(pole, { y: 2.4, sy: 4.8, sx: 1.4, sz: 1.4, color: '#2f3237' }), bakeProp(box, { y: 4.1, x: 0.1, sx: 0.36, sy: 1.25, sz: 0.48, color: '#1c1e22' }),
        ...[0, 1, 2].map(i => bakeProp(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8), { x: 0.3, y: 4.5 - i * 0.38, rz: Math.PI / 2, color: '#3a3d42' }))]);
    PROPS = { tree, tree2, conifer, lamp, tlight, box: UNIT_BOX, sphere: prep(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)) };
    return PROPS;
}

const carPropCache = new Map();
function carProps(kind, color) {
    const key = kind + color;
    let p = carPropCache.get(key); if (p) return p;
    const grp = makeVehicle(kind, color, { lod: 'parked' }); // (static props: the ~250-tri parked model)
    grp.updateMatrixWorld(true);
    const list = [];
    grp.traverse(o => {
        if (!o.isMesh || !o.geometry?.attributes?.normal) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const mc = mats[0]?.color ? '#' + mats[0].color.getHexString() : '#ffffff';
        const pr = prep(g, g.attributes.color ? null : mc);
        if (g.attributes.color && mats[0]?.color) { const c = rgb('#' + mats[0].color.getHexString()); for (let i = 0; i < pr.col.length; i += 3) { pr.col[i] = pr.col[i] * c[0] / 255; pr.col[i + 1] = pr.col[i + 1] * c[1] / 255; pr.col[i + 2] = pr.col[i + 2] * c[2] / 255; } }
        list.push(pr);
    });
    p = list.length ? mergeProps(list) : UNIT_BOX;
    carPropCache.set(key, p);
    return p;
}

// ===========================================================================
//  BUILD
// ===========================================================================
export async function buildWorld(city, renderer, opts = {}) {
    const t0 = performance.now();
    setProgress('Loading OpenStreetMap data…');
    // chapters: buildWorld(city, renderer, { district, start }) loads game/data/<city>-<district>.json (real 1:1 scale);
    // without a district the old corridor map (game/data/<city>.json) is loaded
    const distId = opts.district || city.activeDistrict || null, // (city.activeDistrict: lets main.js's loadCity pick a district without a signature change)
        distCfg = distId ? (city.districts || {})[distId] : null;
    if (distId && !distCfg) throw new Error(`unknown district ${city.id}:${distId}`);
    const inDistrictLL = (lat, lon, m = 0.0015) => !distCfg || (lat >= distCfg.bbox[0] - m && lat <= distCfg.bbox[2] + m && lon >= distCfg.bbox[1] - m * 1.4 && lon <= distCfg.bbox[3] + m * 1.4);
    const url = new URL(`../data/${distId ? city.id + '-' + distId : city.id}.json`, import.meta.url).href;
    const data = await (await fetch(url)).json();
    const realPass = !!data.scenery; // (2026-11-08) a district rebuilt by the reality pass (scenery ring, aerial roofs / trees / green): street-level dressing on
    // field research (spec 20): street-tree notes per street, baked by tools/osm into data.streetTrees
    // ({street name: [species keys]}, [] = researched as treeless) — no runtime fetch of the research dossier
    const researchTrees = new Map(); // street name → { species: [...], none }
    for (const [name, out] of Object.entries(data.streetTrees || {})) researchTrees.set(name, { species: out, none: !out.length });
    RESEARCH_BRANDS = data.brands || {};
    setProgress('Building the road network…'); await tick();

    // projection (header is authoritative)
    city.proj = projector(data.proj);
    const US = city.id === 'seattle' || /US/i.test(city.country || '');
    const country = US ? 'US' : 'RO';
    const rng = makeRng(city.id === 'bucharest' ? 1337 : 4242);
    const env = city.env;
    const group = new THREE.Group();
    group.name = 'world';
    const S = data.strings;
    const str = (i) => (i >= 0 ? S[i] : '');

    // -----------------------------------------------------------------------
    //  GRAPH
    // -----------------------------------------------------------------------
    const nodes = {};
    const nodeArr = [];
    for (let i = 0; i < data.nodes.length; i += 2) {
        const n = { id: i / 2, x: data.nodes[i] * 0.1, z: data.nodes[i + 1] * 0.1, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0 };
        nodeArr.push(n);
    }
    for (let i = 0; i < data.nodeFlags.length; i += 2) {
        const n = nodeArr[data.nodeFlags[i]], f = data.nodeFlags[i + 1];
        n.flags = f; n.signal = !!(f & 1); n.crossing = !!(f & 2); n.zebra = !!(f & 4) || !!(f & 8); n.stop = !!(f & 16); n.giveWay = !!(f & 32);
        n.busStop = !!(f & 64); n.tramStop = !!(f & 128); n.speedCamera = !!(f & 256);
    }
    const edges = [];
    const seenPair = new Set();
    const roads = data.roads.map((r, ri) => {
        const cls = data.classes[r[1]];
        const flags = r[8];
        return {
            index: ri, name: str(r[0]), type: cls, lanesF: r[2], lanesB: r[3], median: r[4] / 10, laneW: r[5] / 10, sidewalk: r[6] / 10,
            maxspeed: r[7] / 3.6, flags, layer: r[9], ids: r.slice(10),
            oneway: !!(flags & 1), bridge: !!(flags & 2), tunnel: !!(flags & 4), roundabout: !!(flags & 8), busLane: !!(flags & 16),
            tram: !!(flags & 32), toll: !!(flags & 64), unpaved: !!(flags & 128), tramMedian: !!(flags & 256),
            bikeLane: !!(flags & 512), cycleTrack: !!(flags & 1024), lit: !!(flags & 2048), unlit: !!(flags & 4096),
        };
    });
    const unnamed = US ? '' : '';
    for (const rd of roads) {
        for (let i = 0; i < rd.ids.length - 1; i++) {
            const a = nodeArr[rd.ids[i]], b = nodeArr[rd.ids[i + 1]];
            if (a === b) continue;
            const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
            if (seenPair.has(key)) continue; seenPair.add(key);
            const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
            if (len < 0.05) continue;
            const dirx = dx / len, dirz = dz / len;
            const median = rd.median;
            const wR = median / 2 + rd.lanesF * rd.laneW;
            const wL = rd.oneway ? rd.lanesF * rd.laneW / 2 : median / 2 + rd.lanesB * rd.laneW;
            const e = {
                id: edges.length, a, b, dirx, dirz, len, nx: -dirz, nz: dirx,
                name: rd.name || unnamed, type: rd.type, road: rd.index,
                lanesF: rd.lanesF, lanesB: rd.oneway ? 0 : rd.lanesB, lanes: Math.max(rd.lanesF, rd.oneway ? 0 : rd.lanesB), oneway: rd.oneway,
                laneW: rd.laneW, median, wR, wL, halfW: Math.max(wR, wL), sidewalk: rd.sidewalk,
                maxspeed: rd.maxspeed, speed: rd.maxspeed, tram: rd.tram, tramMedian: rd.tramMedian, bridge: rd.bridge, tunnel: rd.tunnel, toll: rd.toll,
                busLane: rd.busLane, roundabout: rd.roundabout, unpaved: rd.unpaved, layer: rd.layer, trafficMul: TRAFFIC_MUL[rd.type] ?? 0.5,
                bikeLane: rd.bikeLane, cycleTrack: rd.cycleTrack, lit: rd.lit, unlit: rd.unlit,
            };
            edges.push(e); a.edges.push(e); b.edges.push(e);
        }
    }
    // unnamed connector pieces (junction links of dual carriageways…) borrow a neighbour's name
    for (let pass = 0; pass < 3; pass++) for (const e of edges) {
        if (e.name || e.len > 80 || (CLASS_RANK[e.type] || 0) <= 2) continue;
        for (const n of [e.a, e.b]) { const o = n.edges.find(f => f !== e && f.name && (CLASS_RANK[f.type] || 0) >= (CLASS_RANK[e.type] || 0) - 1); if (o) { e.name = o.name; break; } }
    }
    // ---- (round 6) profile resolution: road heights live on nodes and are linear along an edge, so a 150 m deck edge
    //      (Doina Cornea's flyover) could only be one straight slope — its last 25 m lay 1–2 m above the street it merges
    //      into. Bridges and tunnels are cut into ≤ 10 m pieces (plain degree-2 nodes, like OSM's own) so the
    //      profile can bend where a ramp meets its street (gore pass below).
    {
        const PIECE = 10, src = edges.slice();
        let split = 0;
        for (const e of src) {
            if (e.len <= PIECE * 1.4 || !(e.bridge || e.tunnel)) continue; // (at-grade links stay whole: traffic queues / merges there)
            const k = Math.ceil(e.len / PIECE), b = e.b, plen = e.len / k;
            b.edges.splice(b.edges.indexOf(e), 1);
            let prev = e.a;
            for (let i = 1; i <= k; i++) {
                const n = i < k ? { id: nodeArr.length, x: e.a.x + e.dirx * plen * i, z: e.a.z + e.dirz * plen * i, edges: [], radius: 0, hasLight: false, crossing: false, zebra: false, stop: false, flags: 0, profilePt: true } : b;
                if (i < k) nodeArr.push(n);
                if (i === 1) e.seg = e.id;
                const p = i === 1 ? e : { ...e, id: edges.length };
                p.a = prev; p.b = n; p.len = plen;
                if (i === 1) { n.edges.push(e); } else { edges.push(p); prev.edges.push(p); n.edges.push(p); split++; }
                prev = n;
            }
        }
        if (split) console.info('[world] profile points: +' + split + ' edge pieces');
    }
    for (const n of nodeArr) {
        if (!n.edges.length) continue;
        n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5;
        nodes[n.id] = n;
    }

    // ---- edge spatial index
    const EG = 40;
    const edgeGrid = new BoxGrid(EG);
    for (const e of edges) edgeGrid.insert(Math.min(e.a.x, e.b.x), Math.min(e.a.z, e.b.z), Math.max(e.a.x, e.b.x), Math.max(e.a.z, e.b.z), e);
    const nearestEdge = (x, z, filter = null, maxR = 3000) => {
        const ix = Math.floor(x / EG), iz = Math.floor(z / EG);
        let best = null, bd = Infinity, bt = 0, bcx = 0, bcz = 0;
        const K = Math.ceil(maxR / EG);
        for (let k = 0; k <= K; k++) {
            for (let i = ix - k; i <= ix + k; i++) for (let j = iz - k; j <= iz + k; j++) {
                if (Math.max(Math.abs(i - ix), Math.abs(j - iz)) !== k) continue;
                const arr = edgeGrid.cell_(i, j); if (!arr) continue;
                for (const e of arr) {
                    if (filter && !filter(e)) continue;
                    const r = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
                    if (r.d < bd) { bd = r.d; best = e; bt = r.t; bcx = r.cx; bcz = r.cz; }
                }
            }
            if (best && bd <= k * EG) break;
        }
        return best ? { edge: best, d: bd, t: bt, cx: bcx, cz: bcz } : null;
    };
    const edgesInBox = (x0, z0, x1, z1, cb) => { const seen = new Set(); edgeGrid.each(x0, z0, x1, z1, (e) => { if (!seen.has(e)) { seen.add(e); cb(e); } }); };

    // ---- dual carriageways cut by the map border (or by a mapping gap) end in a one-way "sink" next to a
    //      one-way "source" going the other way: join them with an invisible U-turn so they stay routable
    {
        const sinks = [], sources = [];
        for (const n of nodeArr) {
            if (n.edges.length !== 1 || !n.edges[0].oneway) continue;
            (n.edges[0].b === n ? sinks : sources).push(n);
        }
        const g = new BoxGrid(50); for (const n of sources) g.insert(n.x, n.z, n.x, n.z, n);
        let added = 0;
        for (const a of sinks) {
            let best = null, bd = 60;
            g.each(a.x - 60, a.z - 60, a.x + 60, a.z + 60, (b) => { if (b.edges.length !== 1) return; const d = Math.hypot(b.x - a.x, b.z - a.z); if (d < bd && d > 0.5) { bd = d; best = b; } });
            if (!best) continue;
            const src = a.edges[0];
            const dx = best.x - a.x, dz = best.z - a.z, len = Math.hypot(dx, dz);
            const e = { ...src, id: edges.length, a, b: best, dirx: dx / len, dirz: dz / len, len, nx: -dz / len, nz: dx / len, lanesF: 1, lanesB: 0, lanes: 1, median: -src.laneW, wR: src.laneW / 2, wL: src.laneW / 2, halfW: src.laneW / 2, maxspeed: 8, speed: 8, trafficMul: 0, virtual: true, tram: false, bridge: false, tunnel: false };
            edges.push(e); a.edges.push(e); best.edges.push(e); added++;
        }
        if (added) console.info('[world] u-turn connectors', added);
    }

    // ---- strongly connected components (one-way aware): only the main SCC is drivable / routable
    let sccInfo;
    // district maps: roads cut at the boundary (map ends) all lead to / come from "the rest of the city", so for
    // connectivity they are joined through one virtual outside node (a one-way street entering the map is not a trap)
    for (const i of data.district?.ends || []) if (nodeArr[i]) nodeArr[i].mapEnd = true;
    const computeSCC = () => {
        const N = nodeArr.length + 1, OUT = nodeArr.length;
        const out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
        for (const e of edges) { out[e.a.id].push(e.b.id); inn[e.b.id].push(e.a.id); if (!e.oneway) { out[e.b.id].push(e.a.id); inn[e.a.id].push(e.b.id); } }
        for (const n of nodeArr) if (n.mapEnd) { out[n.id].push(OUT); inn[OUT].push(n.id); out[OUT].push(n.id); inn[n.id].push(OUT); }
        // Kosaraju (iterative)
        const order = [], seen = new Uint8Array(N);
        for (let s0 = 0; s0 < N; s0++) {
            if (seen[s0] || (s0 < OUT && !nodeArr[s0].edges.length) || (s0 === OUT && !out[OUT].length)) continue;
            const stack = [[s0, 0]]; seen[s0] = 1;
            while (stack.length) {
                const top = stack[stack.length - 1]; const [u, k] = top;
                if (k < out[u].length) { top[1]++; const v = out[u][k]; if (!seen[v]) { seen[v] = 1; stack.push([v, 0]); } }
                else { order.push(u); stack.pop(); }
            }
        }
        const comp = new Int32Array(N).fill(-1); let nc = 0; const sizes = [];
        for (let i = order.length - 1; i >= 0; i--) {
            const s0 = order[i]; if (comp[s0] >= 0) continue;
            const st = [s0]; comp[s0] = nc; let sz = 0;
            while (st.length) { const u = st.pop(); sz++; for (const v of inn[u]) if (comp[v] < 0) { comp[v] = nc; st.push(v); } }
            sizes.push(sz); nc++;
        }
        let main = 0; for (let c = 1; c < nc; c++) if (sizes[c] > sizes[main]) main = c;
        let off = 0;
        for (const n of nodeArr) { n.comp = comp[n.id]; n.drivable = comp[n.id] === main; }
        for (const e of edges) { e.drivable = e.a.drivable && e.b.drivable; if (!e.drivable) off++; }
        // weakly connected components (for the report)
        const par = new Int32Array(N).map((_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        for (const e of edges) par[f(e.a.id)] = f(e.b.id);
        const wcc = new Set(); for (const n of nodeArr) if (n.edges.length) wcc.add(f(n.id));
        sccInfo = { scc: nc, mainNodes: sizes[main], nodesOutside: nodeArr.filter(n => n.edges.length && !n.drivable).length, edgesOff: off, weakComponents: wcc.size };
    };
    computeSCC();
    // one-way streets around the CV stops that are traps (not in the main network) become two-way,
    // so every stop's own street is reachable (e.g. Str. Vasile Alecsandri at UiPath HQ)
    {
        let flipped = 0;
        for (const p of city.pois || []) {
            if (!inDistrictLL(p.lat, p.lon)) continue;
            const q = city.proj(p.lat, p.lon);
            edgesInBox(q.x - 180, q.z - 180, q.x + 180, q.z + 180, (e) => {
                if (e.drivable || !e.oneway || /motorway|trunk|primary/.test(e.type)) return;
                e.oneway = false; e.lanesB = 1; e.median = 0; e.lanes = Math.max(e.lanesF, 1);
                e.wR = e.lanesF * e.laneW; e.wL = e.laneW; e.halfW = Math.max(e.wR, e.wL); e.madeTwoWay = true;
                flipped++;
            });
        }
        if (flipped) {
            for (const n of nodeArr) if (n.edges.length) n.radius = Math.max(...n.edges.map(e => e.halfW)) + 0.5;
            computeSCC();
            sccInfo.twoWayFixups = flipped;
        }
    }

    // refine tram flag per edge using the actual tram geometry
    const trams = data.trams.map(t => undelta(t, 0));
    {
        const tg = new BoxGrid(40);
        for (const pl of trams) for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; tg.insert(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]); }
        for (const e of edges) {
            if (!e.tram) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            let d = Infinity; tg.each(mx - 10, mz - 10, mx + 10, mz + 10, ([a, b]) => { d = Math.min(d, distPointSeg(mx, mz, a[0], a[1], b[0], b[1]).d); });
            e.tram = d < e.halfW + 4;
        }
    }

    // ---- vertical profile. Only real grade separations are lifted / lowered:
    //      * a bridge is raised only where it actually passes over (crosses or is stacked above) another road
    //        that does not share a junction with it — river / rail bridges stay at grade (OSM tags them layer=1,
    //        which used to lift them 6 m and drag the riverside roads up with them: the "slab" across Splaiul
    //        Independenței at Grozăvești);
    //      * tunnels are lowered (−6 m per layer);
    //      * the roads they pass over / under are pinned at their own level;
    //      * ramps are the "max of cones" around the anchors, along the connected graph (9 % grade on the
    //        approaches, ~3 % along bridge decks so viaducts stay up between the roads they cross).
    //      node.y / edge.ya / edge.yb are the vertical displacement of the road surface (asphalt top = 0.24 + y).
    const CLEAR = 6, GRADE = 0.09;
    const crossings = []; // {u (upper), f (lower), x, z}
    let profileStats = null, profileStats0 = null, wallCut = 0, blocksLane = null;
    {
        for (const e of edges) { e.L = e.virtual ? 0 : Math.max(-2, Math.min(3, e.bridge ? Math.max(1, e.layer) : e.tunnel ? Math.min(-1, e.layer) : 0)); e.over = null; e.anchorH = 0; }
        const near = (e) => { const s = new Set([e.a, e.b]); for (const n of [e.a, e.b]) for (const f of n.edges) { s.add(f.a); s.add(f.b); } return s; };
        const segX = (e, f) => { // centreline intersection → {t, u} or null
            const rx = e.b.x - e.a.x, rz = e.b.z - e.a.z, sx = f.b.x - f.a.x, sz = f.b.z - f.a.z;
            const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
            const qx = f.a.x - e.a.x, qz = f.a.z - e.a.z;
            const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
            return t > 0 && t < 1 && u > 0 && u < 1 ? { t, u } : null;
        };
        for (const u of edges) {
            if (u.L === 0 || u.virtual) continue;
            const nb = near(u);
            const pad = u.halfW + 12;
            edgesInBox(Math.min(u.a.x, u.b.x) - pad, Math.min(u.a.z, u.b.z) - pad, Math.max(u.a.x, u.b.x) + pad, Math.max(u.a.z, u.b.z) + pad, (f) => {
                if (f === u || f.virtual || nb.has(f.a) || nb.has(f.b)) return;
                if (u.L > 0 ? (f.L >= u.L || f.tunnel) : f.L <= u.L) return; // bridges look down, tunnels look up
                let hit = null;
                const X = segX(u, f);
                if (X) hit = { x: u.a.x + (u.b.x - u.a.x) * X.t, z: u.a.z + (u.b.z - u.a.z) * X.t };
                else { // stacked (parallel) roads, e.g. SeaTac departures drive above the arrivals drive
                    for (let s = Math.min(u.len / 2, u.a.radius + 2); s <= u.len - Math.min(u.len / 2, u.b.radius + 2) && !hit; s += 4) {
                        const x = u.a.x + u.dirx * s, z = u.a.z + u.dirz * s;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.t > 0.02 && q.t < 0.98 && q.d < Math.min(f.halfW, 6) + Math.min(u.halfW, 6) * 0.5) hit = { x, z };
                    }
                }
                if (hit && Math.hypot(hit.x - u.a.x, hit.z - u.a.z) > 1.5 && Math.hypot(hit.x - u.b.x, hit.z - u.b.z) > 1.5) {
                    (u.over || (u.over = [])).push(f);
                    crossings.push({ u, f, x: hit.x, z: hit.z });
                }
            });
        }
        // anchors: bridges that pass over something (lower bridges first), all tunnels
        const anchorEdges = edges.filter(e => (e.L > 0 && e.over) || e.L < 0).sort((p, q) => p.L - q.L);
        for (const e of anchorEdges) {
            if (e.L < 0) { e.anchorH = e.L * CLEAR; continue; }
            let base = 0; for (const f of e.over) if (f.L > 0 && f.anchorH > 0) base = Math.max(base, f.anchorH);
            e.anchorH = base + CLEAR;
        }
        const extraPins = new Map(); // node → height: ramps may not dive while they still overlap another road
        const solve = () => {
            for (const n of nodeArr) { n.y = 0; n.yFixed = false; n.yPin = false; }
            for (const [n, v] of extraPins) { n.y = v; n.yPin = true; }
            for (const e of anchorEdges) for (const n of [e.a, e.b]) {
                if (e.L < 0 && n.edges.some(f => !f.virtual && !f.tunnel)) continue; // tunnel portals open at street level (the ramp is inside)
                if (!n.yFixed || Math.abs(e.anchorH) > Math.abs(n.y)) n.y = e.anchorH;
                n.yFixed = true;
            }
            // pin the roads that are passed over / under (unless they are anchored themselves)
            for (const c of crossings) if (!c.f.anchorH && !(c.f.bridge && c.f.L > 1)) for (const n of [c.f.a, c.f.b]) if (!n.yFixed) n.yPin = true;
            // max-of-cones propagation (separately up and down)
            for (const sgn of [1, -1]) {
                const best = new Map(); const heap = [];
                const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                for (const n of nodeArr) if (n.yFixed && n.y * sgn > 0) { best.set(n, n.y * sgn); push(n, n.y * sgn); }
                while (heap.length) {
                    const [v, n] = pop(); if (v < best.get(n)) continue;
                    for (const e of n.edges) {
                        if (e.virtual) continue;
                        const o = e.a === n ? e.b : e.a; if (o.yFixed || o.yPin) continue;
                        const nv = v - GRADE * e.len * (e.bridge ? (e.L >= 2 ? 0.1 : 0.35) : 1); // decks stay up (layer ≥ 2: viaducts)
                        if (nv > 0.02 && nv > (best.get(o) ?? 0)) { best.set(o, nv); push(o, nv); }
                    }
                }
                for (const [n, v] of best) if (!n.yFixed && v > Math.abs(n.y)) n.y = v * sgn;
            }
            for (const e of edges) { e.ya = e.a.y; e.yb = e.b.y; }
        };
        solve();
        // ---- constraint relaxation (projections, Gauss-Seidel) on top of the cone solution:
        //   C  clearance: a structure passing over (under) a road stays ≥ CLEAR_MIN above (below) it at the crossing
        //   O  overlap: two carriageways that overlap in plan (not at a junction) are either at the same height
        //      (a ramp may not dive while it still overlaps the street beside it) or clearly separated (≥ SEP),
        //      never 0.4–3 m apart (the car would snap between them)
        //   S  grade: |Δy| ≤ MAXG · length on every edge (ramps are extended instead of stepped)
        //   H  hard nodes: minor streets (residential / service / living / unclassified) stay at grade, floating /
        //      river bridges stay just above the water, roads passed over keep their level
        const MAXG = 0.08, CLEAR_MIN = 5.2, SEP = 4.2, USE_O = false;
        const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
        const MINOR = /^(residential|living_street|unclassified|service)$/;
        // water polygons straight from the data (the area meshes are built later)
        const wGrid = new BoxGrid(200), wPolys = [];
        for (const a of data.areas) {
            if (data.areaKinds[a[0]] !== 'water') continue;
            const outer = undelta(a[2], 0); if (outer.length < 3) continue;
            let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
            const p = { outer, x0, z0, x1, z1 }; wPolys.push(p); wGrid.insert(x0, z0, x1, z1, p);
        }
        const overWater = (x, z) => { let w = false; wGrid.each(x, z, x, z, (p) => { if (!w && x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && pointInPolygon(x, z, p.outer)) w = true; }); return w; };
        for (const e of edges) e.overWater = !e.virtual && e.bridge && !e.over && overWater((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2) && overWater(e.a.x * 0.75 + e.b.x * 0.25, e.a.z * 0.75 + e.b.z * 0.25);
        const hard = new Map(); // node → height
        for (const n of nodeArr) {
            const es = n.edges.filter(e => !e.virtual); if (!es.length) continue;
            if (es.every(e => MINOR.test(e.type) && !e.bridge && !e.tunnel)) hard.set(n, 0);
            else if (es.every(e => e.overWater)) hard.set(n, 0.3);
        }
        for (const c of crossings) if (!c.f.anchorH && !c.f.bridge && !c.f.tunnel) for (const n of [c.f.a, c.f.b]) if (!hard.has(n) && Math.abs(n.y) < 0.05) hard.set(n, 0);
        for (const [n, v] of hard) n.y = v;
        // overlap samples (carriageways overlapping in plan, away from shared junctions)
        const overlaps = [];
        {
            const crossed = new Set(crossings.map(c => c.u.id + ':' + c.f.id));
            for (const e of edges) {
                if (e.virtual) continue;
                for (let s = Math.min(1, e.len / 2); s <= e.len - Math.min(1, e.len / 2); s += Math.min(3, Math.max(0.5, e.len - 2) / 2)) {
                    const x = e.a.x + e.dirx * s, z = e.a.z + e.dirz * s;
                    edgesInBox(x - 14, z - 14, x + 14, z + 14, (f) => {
                        if (f === e || f.virtual || f.id < e.id || shares(e, f) || ((crossed.has(e.id + ':' + f.id) || crossed.has(f.id + ':' + e.id)) && Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.8)) return; // (a near-parallel 'crossing' — a ramp running over the street — stays an overlap)
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.t <= 0.01 || q.t >= 0.99) return;
                        const side = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) >= 0 ? 1 : -1;
                        if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + Math.min(e.halfW, 6) * 0.7) return;
                        if ((e.tunnel && f.tunnel) || (e.L < 0) !== (f.L < 0) && Math.min(e.ya, e.yb, f.ya, f.yb) < -4) return; // a covered tunnel under a street is fine
                        overlaps.push({ e, te: s / e.len, f, tf: q.t, sep: null });
                    });
                }
            }
        }
        const yP = (e, t) => e.a.y + (e.b.y - e.a.y) * t;
        // overlapping carriageways that are already ≥ 1 m apart are a grade separation: keep them ≥ CLEAR_MIN apart
        // (otherwise a car would snap from one to the other)
        {
            const seenPair = new Set();
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = ye - yf;
                if (Math.abs(dh) < 1.0 || Math.abs(dh) >= CLEAR_MIN) continue;
                const [u, f, tu] = dh > 0 ? [o.e, o.f, o.te] : [o.f, o.e, o.tf];
                if (u.L <= 0 && !u.bridge) continue;
                const k = u.id + ':' + f.id; if (seenPair.has(k)) continue; seenPair.add(k);
                crossings.push({ u, f, x: u.a.x + (u.b.x - u.a.x) * tu, z: u.a.z + (u.b.z - u.a.z) * tu, overlap: true });
                if (!u.L) u.L = 1;
            }
        }
        // move the height of edge e at param t by d (minimal change of its free endpoints)
        const moveAt = (e, t, d) => {
            const fa = !hard.has(e.a), fb = !hard.has(e.b);
            if (!Number.isFinite(d)) return false;
            d = clamp(d, -1.5, 1.5); // damped: many constraints share nodes
            const wa = fa ? 1 - t : 0, wb = fb ? t : 0, n2 = wa * wa + wb * wb; if (n2 < 0.09) return false; // the point sits on a hard end
            e.a.y += d * wa / n2; e.b.y += d * wb / n2; return true;
        };
        // decide per pair: overlapping carriageways that start < 2.4 m apart are merged to one level; the others are
        // grade-separated already (the crossing constraints keep them apart)
        { const pair = new Map(); for (const o of overlaps) { const k = o.e.id + ':' + o.f.id; const dh = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); pair.set(k, Math.max(pair.get(k) ?? 0, dh)); }
          for (const o of overlaps) o.sep = pair.get(o.e.id + ':' + o.f.id) < 2.4 ? 0 : null; }
        const stepC = () => {
            for (const c of crossings) {
                const tu = clamp(((c.x - c.u.a.x) * c.u.dirx + (c.z - c.u.a.z) * c.u.dirz) / c.u.len, 0, 1), tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1);
                const gap = (yP(c.u, tu) - yP(c.f, tf)) * (c.u.L > 0 ? 1 : -1);
                if (gap < CLEAR_MIN) { if (!moveAt(c.u, tu, (CLEAR_MIN - gap) * (c.u.L > 0 ? 1 : -1))) moveAt(c.f, tf, -(CLEAR_MIN - gap) * (c.u.L > 0 ? 1 : -1)); }
            }
        };
        const stepO = () => {
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = ye - yf;
                if (o.sep === null) continue;
                if (o.sep === 0) { if (Math.abs(dh) > 0.25) { const [hi, th, lo, tl] = Math.abs(ye) > Math.abs(yf) ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te]; if (!moveAt(hi, th, yP(lo, tl) - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - yP(lo, tl)); } }
                else if (dh * o.sep < SEP) {
                    const v = SEP - dh * o.sep; // the upper one must go up by v, or the lower one down by v
                    const [up, tu, lo, tl] = o.sep > 0 ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                    if (Math.abs(yP(up, tu)) >= Math.abs(yP(lo, tl))) { if (!moveAt(up, tu, v)) moveAt(lo, tl, -v); }
                    else if (!moveAt(lo, tl, -v)) moveAt(up, tu, v);
                }
            }
        };
        const stepS = (honourHard) => {
            let worst = 0;
            for (const e of edges) {
                if (e.virtual) continue;
                const lim = MAXG * e.len, dy = e.b.y - e.a.y; if (Math.abs(dy) <= lim + 1e-4) continue;
                worst = Math.max(worst, Math.abs(dy) - lim);
                const ex = Math.abs(dy) - lim, s = Math.sign(dy);
                // move the endpoint nearer to the ground (extends the ramp away from the structure); else the other one
                const aNear = Math.abs(e.a.y) < Math.abs(e.b.y);
                const ha = honourHard && hard.has(e.a), hb = honourHard && hard.has(e.b);
                if (ha && hb) continue;
                if (aNear && !ha) e.a.y += s * ex; else if (!aNear && !hb) e.b.y -= s * ex;
                else if (ha) e.b.y -= s * ex; else e.a.y += s * ex;
            }
            return worst;
        };
        let nanAt = null; const nanCheck = (tag) => { for (const n of nodeArr) if (!Number.isFinite(n.y)) { nanAt = nanAt || tag + ':' + n.id; return true; } return false; };
        nanCheck('init');
        // heights stay within what a city has (a road crossing under its own ramp within a few metres is infeasible:
        // without a cap the constraints would chase each other upward)
        const capY = () => { for (const n of nodeArr) { const lim = hard.has(n) ? 0.3 : 14; if (n.y > lim) n.y = Math.max(lim, Math.min(n.y, 14)); if (n.y < -7.5) n.y = -7.5; if (hard.has(n) && Math.abs(n.y - hard.get(n)) > 1e-6) n.y = hard.get(n); } };
        for (let it = 0; it < 160; it++) { stepC(); if (nanCheck("C" + it)) break; if (USE_O) stepO(); stepS(true); capY(); }
        for (let it = 0; it < 60; it++) { stepC(); capY(); if (stepS(true) < 0.01 && it > 10) break; }
        // grade wins over everything else: the smallest MAXG-Lipschitz envelope (max of cones from every node, exact
        // Dijkstra), applied to the raised and the sunken parts separately
        const envelope = (val) => {
            const best = new Map(); const heap = [];
            const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
            const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
            for (const n of nodeArr) { const v = val(n); if (v > 0.001) { best.set(n, v); push(n, v); } }
            while (heap.length) {
                const [v, n] = pop(); if (v < best.get(n)) continue;
                for (const e of n.edges) { const o = e.a === n ? e.b : e.a; const nv = v - MAXG * e.len; if (nv > 0.001 && nv > (best.get(o) ?? 0)) { best.set(o, nv); push(o, nv); } } // (virtual U-turn links too: traffic drives them)
            }
            return best;
        };
        const resid = () => { let r = 0; for (const e of edges) r = Math.max(r, Math.abs(e.b.y - e.a.y) - MAXG * e.len); return r; };
        const gradeFix = () => {
        {
            const up = envelope(n => Math.max(0, n.y)), dn = envelope(n => Math.max(0, -n.y));
            for (const n of nodeArr) { const u = up.get(n) ?? 0, d = dn.get(n) ?? 0; n.y = u >= d ? u : -d; }
        }
        // remaining conflicts (a sunken part right next to a raised one): signed Lipschitz smoothing — L = max-envelope,
        // U = min-envelope of the current heights; nodes in conflict move to (L+U)/2 until consistent
        var _dummy;
        const signedEnv = (sgn) => { // sgn 1: max_m (y_m − G·d), sgn −1: min_m (y_m + G·d)
            const best = new Map(); const heap = [];
            const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
            const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
            for (const n of nodeArr) if (n.edges.length) { best.set(n, n.y * sgn); push(n, n.y * sgn); }
            while (heap.length) {
                const [v, n] = pop(); if (v < best.get(n)) continue;
                for (const e of n.edges) { const o = e.a === n ? e.b : e.a; const nv = v - MAXG * e.len; if (nv > best.get(o) + 1e-6) { best.set(o, nv); push(o, nv); } }
            }
            return best;
        };
        for (let pass = 0; pass < 60 && resid() > 0.01; pass++) {
            const L = signedEnv(1), U = signedEnv(-1);
            for (const n of nodeArr) if (n.edges.length) n.y = (L.get(n) + (-U.get(n))) / 2;
        }
        };
        gradeFix();
        // overlapping carriageways: never 0.45–4 m apart (the car would snap between them) — merge or separate, then
        // re-establish the grades; a few rounds
        const stepO2 = () => {
            let bad = 0;
            for (const o of overlaps) {
                const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = Math.abs(ye - yf);
                if (dh <= 0.45 || dh >= 4) continue;
                bad++;
                const [hi, th, lo, tl] = Math.abs(ye) > Math.abs(yf) ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                const target = dh < 2.2 ? yP(lo, tl) : yP(lo, tl) + Math.sign(yP(hi, th) - yP(lo, tl)) * 4.2;
                if (!moveAt(hi, th, target - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - (dh < 2.2 ? 0 : Math.sign(yP(hi, th) - yP(lo, tl)) * 4.2) - yP(lo, tl));
            }
            return bad;
        };
        // (2026-11-07, world-visual) a few merge-or-separate rounds for overlapping carriageways 0.45–4 m apart (ramps
        // lying 1–4 m above the street beside / under them, review #15c / #18), each followed by the grade fix; kept
        // only when it reduces those overlaps without adding clearance violations at crossings
        {
            const tuOf = (c, e) => clamp(((c.x - e.a.x) * e.dirx + (c.z - e.a.z) * e.dirz) / e.len, 0, 1);
            const score = () => {
                let cb = 0, ob = 0;
                for (const c of crossings) if ((yP(c.u, tuOf(c, c.u)) - yP(c.f, tuOf(c, c.f))) * (c.u.L > 0 ? 1 : -1) < 4.5) cb++;
                for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 4) ob++; }
                return { cb, ob };
            };
            const keep = nodeArr.map(n => n.y), s0 = score();
            if (s0.ob) {
                for (let r = 0; r < 8; r++) { if (!stepO2()) break; capY(); gradeFix(); }
                const s1 = score();
                if (s1.cb > s0.cb || s1.ob >= s0.ob || resid() > 0.05) nodeArr.forEach((n, i) => { n.y = keep[i]; });
                else profileStats0 = { overlapsBefore: s0.ob, overlapsAfter: s1.ob, crossBefore: s0.cb, crossAfter: s1.cb };
            }
            // (QA round 2) separate-or-dip: overlaps still 0.45–5 m apart (Pasajul Basarab over Orhideelor, Podul Barbu
            // Văcărescu over Șos. Pipera) are pulled to ≥ 5.2 m: the deck rises where its grade allows, otherwise the
            // street under it dips (an underpass, as Orhideelor really does under Basarab); < 1.2 m apart → one surface.
            // Kept when the 0.45–5 m count drops and crossing clearances do not get worse.
            // decks: every bridge / raised edge sampled every 3 m against the ribbons of the streets under it (the overlap list
            // above only takes centre lines closer than ~70 % of the widths: a ramp lying half over a street was missed)
            const ovS = [];
            for (const e of edges) {
                if (e.virtual || !(e.bridge || e.L > 0)) continue;
                for (let s2 = 1; s2 < e.len - 1; s2 += 3) {
                    const x = e.a.x + e.dirx * s2, z = e.a.z + e.dirz * s2;
                    edgesInBox(x - 16, z - 16, x + 16, z + 16, (f) => {
                        if (f === e || f.virtual || f.bridge || f.L > 0 || shares(e, f)) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0.02 || q.t >= 0.98) return;
                        if (q.d > Math.max(f.wR, f.wL) + shoulderOf(f) + Math.max(e.wR, e.wL) * 0.9) return;
                        ovS.push({ e, te: s2 / e.len, f, tf: q.t });
                    });
                }
            }
            const OV = overlaps.concat(ovS);
            const score5 = () => { let n = 0; for (const o of OV) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 5) n++; } return n; };
            const stepSep = () => {
                let bad = 0;
                for (const o of OV) {
                    const ye = yP(o.e, o.te), yf = yP(o.f, o.tf), dh = Math.abs(ye - yf);
                    if (dh <= 0.45 || dh >= 5) continue;
                    bad++;
                    const [hi, th, lo, tl] = ye > yf ? [o.e, o.te, o.f, o.tf] : [o.f, o.tf, o.e, o.te];
                    if (dh < 1.2) { if (!moveAt(hi, th, yP(lo, tl) - yP(hi, th))) moveAt(lo, tl, yP(hi, th) - yP(lo, tl)); continue; }
                    const need = 5.2 - dh;
                    const before = yP(hi, th);
                    if (hi.bridge || hi.L > 0) moveAt(hi, th, need * 0.6);
                    const got = yP(hi, th) - before;
                    if (!lo.bridge && lo.L <= 0) moveAt(lo, tl, -(need - got));
                }
                return bad;
            };
            const keep2 = nodeArr.map(n => n.y), a0 = score5(), c0 = score().cb;
            if (a0 && globalThis.__sepPass === true) { // (off: on the upb / db routes it made the visual-QA stacked count worse — 17 → 19, 6 → 27)
                for (let r = 0; r < 24; r++) { if (!stepSep()) break; capY(); gradeFix(); }
                const a1 = score5(), c1 = score().cb;
                const rej = (c1 > c0 + (a1 < a0 * 0.75 ? 1 : 0)) || a1 >= a0 || resid() > 0.05; // (one crossing a little under 4.5 m is worth a large stacked-deck reduction)
                if (rej) nodeArr.forEach((n, i) => { n.y = keep2[i]; });
                profileStats0 = { ...(profileStats0 || {}), sepBefore: a0, sepAfter: a1, sepKept: !rej, sepCross: [c0, c1] };
            }
        }
        // (2026-11-07, world-visual) gores: a node of a ramp that still lies on the carriageway of the near-parallel road it
        // leaves / joins (sharing no node with it: the overlap list skips those pairs) takes that road's height, so the
        // ramp stays on the deck / street while the two overlap and only climbs / dives once it is clear of it (no ramp
        // slab 0.1–4.5 m above or below the road beside it: review #11 / #18). Kept only without new clearance violations.
        {
            const tuOf = (c, e) => clamp(((c.x - e.a.x) * e.dirx + (c.z - e.a.z) * e.dirz) / e.len, 0, 1);
            const crossBad = () => { let cb = 0; for (const c of crossings) if ((yP(c.u, tuOf(c, c.u)) - yP(c.f, tuOf(c, c.f))) * (c.u.L > 0 ? 1 : -1) < 4.5) cb++; return cb; };
            const goreScan = (apply) => {
                let n0 = 0;
                for (const n of nodeArr) {
                    if (!n.edges.length || hard.has(n)) continue;
                    // only a ramp next to the road it leaves / joins (connected within 4 edges): a street that merely
                    // runs beside / under a viaduct keeps its own level (Șos. Pipera under Podul Barbu Văcărescu)
                    if (!n.edges.some(e => /_link$/.test(e.type))) continue;
                    const near = new Set(); { let fr = [n]; const seenN = new Set([n]); for (let d = 0; d < 4; d++) { const nf = []; for (const m of fr) for (const e of m.edges) { near.add(e); const o = e.a === m ? e.b : e.a; if (!seenN.has(o)) { seenN.add(o); nf.push(o); } } fr = nf; } }
                    let best = null;
                    for (const e of n.edges) {
                        if (e.virtual) continue;
                        edgesInBox(n.x - 24, n.z - 24, n.x + 24, n.z + 24, (f) => {
                            if (f === e || f.virtual || f.a === n || f.b === n || (e.tunnel !== f.tunnel) || !near.has(f)) return;
                            if (Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.8) return;
                            const q = distPointSeg(n.x, n.z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0.02 || q.t >= 0.98) return;
                            const side = ((n.x - q.cx) * f.nx + (n.z - q.cz) * f.nz) >= 0 ? 1 : -1;
                            if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + e.halfW * 0.6) return;
                            const dh = yP(f, q.t) - n.y; if (Math.abs(dh) < 0.1 || Math.abs(dh) > 4.5) return;
                            if (!best || Math.abs(dh) < Math.abs(best)) best = dh;
                        });
                    }
                    if (best !== null) { n0++; if (apply) n.y += best; }
                }
                return n0;
            };
            const keep = nodeArr.map(n => n.y), g0 = goreScan(false), c0 = crossBad();
            if (g0) {
                for (let r = 0; r < 8; r++) { if (!goreScan(true)) break; capY(); gradeFix(); }
                const g1 = goreScan(false), c1 = crossBad();
                if (c1 > c0 || g1 >= g0 || resid() > 0.05) nodeArr.forEach((n, i) => { n.y = keep[i]; });
                profileStats0 = { ...(profileStats0 || {}), goreBefore: g0, goreAfter: g1 >= g0 || c1 > c0 ? g0 : g1, goreCross: [c0, c1] };
            }
        }
        // ---- (2026-11-07, world-visual) decks by OSM layer (data.roadInfo raw layer): a bridge chain that passes over a
        //      street is lifted to ≈ 5.5 m per level (Pasajul Basarab's upper level ≈ 11 m, Podul Barbu Văcărescu ≈ 5.5 m),
        //      the climb spread over the whole chain + the approach ramps (≤ 8 %); at-grade junction nodes stay at grade.
        //      y = min(max-of-cones from the deck targets, min-of-cones from the ground nodes): Lipschitz by construction.
        let deckStats = null;
        if (data.roadInfo) {
            const RI = data.roadInfo, rawLayer = (e) => { const v = RI[e.road * 6]; return Number.isFinite(v) ? v : e.layer; };
            const G = MAXG * 0.98, PER = 5.5;
            // deck chains: connected bridge edges with raw layer ≥ 1; a chain counts when any of its edges passes over a road
            const isDeck = (e) => !e.virtual && e.bridge && rawLayer(e) >= 1;
            const chainOf = new Map(); let nc = 0;
            for (const e of edges) {
                if (!isDeck(e) || chainOf.has(e)) continue;
                const st = [e]; chainOf.set(e, nc);
                while (st.length) { const f = st.pop(); for (const n of [f.a, f.b]) for (const g of n.edges) if (isDeck(g) && !chainOf.has(g)) { chainOf.set(g, nc); st.push(g); } }
                nc++;
            }
            const live = new Set(); for (const e of edges) if (chainOf.has(e) && (e.over?.length || crossings.some(c => c.u === e))) live.add(chainOf.get(e));
            for (const o of overlaps) for (const [u, f] of [[o.e, o.f], [o.f, o.e]]) if (chainOf.has(u) && !f.bridge && !f.tunnel) live.add(chainOf.get(u));
            const target = new Map();
            for (const [e, k] of chainOf) { if (!live.has(k)) continue; const t = Math.min(3, rawLayer(e)) * PER; for (const n of [e.a, e.b]) target.set(n, Math.max(target.get(n) ?? 0, t)); }
            if (target.size) {
                // ground nodes: junctions with an at-grade street (non-bridge, non-link, raw layer 0, not a tunnel), and
                // nodes that are hard (minor streets, river bridges)
                const atGrade = (e) => !e.virtual && !e.bridge && !e.tunnel && !/_link$/.test(e.type) && rawLayer(e) <= 0;
                const ground = [];
                for (const n of nodeArr) {
                    if (!n.edges.length || target.has(n)) continue;
                    const g = n.edges.filter(atGrade).length;
                    if ((g >= 1 && n.edges.length >= 3) || (g >= 2 && n.edges.every(atGrade)) || hard.has(n)) ground.push(n);
                }
                const dijk = (seeds, sgn) => { // max-plus (sgn 1: max(t − G d)) or min-plus (sgn −1: min(G d))
                    const best = new Map(), heap = [];
                    const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                    for (const [n, v] of seeds) { best.set(n, v * sgn); push(n, v * sgn); }
                    while (heap.length) { const [v, n] = pop(); if (v < best.get(n)) continue; for (const e of n.edges) { if (e.virtual) continue; const o = e.a === n ? e.b : e.a, nv = v - G * e.len; if (sgn > 0 && nv <= 0) continue; if (nv > (best.get(o) ?? -Infinity)) { best.set(o, nv); push(o, nv); } } }
                    return best;
                };
                const up = dijk([...target], 1), lim = dijk(ground.map(n => [n, 0]), -1); // lim: −G·d
                let raised = 0, maxY = 0;
                for (const [n, u] of up) {
                    if (ground.includes(n)) continue;
                    const cap = lim.has(n) ? -lim.get(n) : Infinity, y = Math.min(u, cap);
                    if (y > n.y + 0.05) { n.y = y; raised++; maxY = Math.max(maxY, y); }
                }
                deckStats = { chains: live.size, targets: target.size, ground: ground.length, raised, maxY: +maxY.toFixed(1) };
                profileStats0 = { ...(profileStats0 || {}), deck: deckStats };
            }
        }
        // ---- (2026-11-07, world-visual, play-test round 4) final profile sanity: only bridge decks and their own ramps may
        //      leave the ground. Earlier passes (cone ramps through the graph, constraint relaxation, overlap merge) also
        //      lifted at-grade streets (Calea Giulești to 14 m, Orhideelor 4.9 m) and left decks sloping into lanes. Here:
        //      ramps = *_link ways and same-name continuations of a deck through plain (degree-2) nodes, ≤ 300 m; every
        //      other street node is at grade (tunnels keep their depth); deck / ramp heights are recomputed as
        //      min(max-of-cones from the deck targets, G·distance to the nearest ground node) along deck + ramp edges.
        let finalStats = null; const deckTarget = new Map(); // (node → deck height target of the final pass; the gore pass keeps decks gentle)
        {
            const RI = data.roadInfo || [], rawLayer = (e) => { const v = RI[e.road * 6]; return Number.isFinite(v) ? v : e.layer; };
            const G = MAXG * 0.97, PER = 5.5;
            const isDeck = (e) => !e.virtual && e.bridge;
            const elig = new Set();
            { // ramps
                const q = []; const dist = new Map();
                for (const n of nodeArr) if (n.edges.some(isDeck)) { dist.set(n, 0); q.push(n); }
                while (q.length) {
                    const n = q.shift(), d0 = dist.get(n), deckNames = new Set(n.edges.filter(isDeck).map(e => e.name).concat([...elig].filter(e => e.a === n || e.b === n).map(e => e.name)));
                    const plain = n.edges.filter(f => !f.virtual).length <= 2;
                    for (const e of n.edges) {
                        if (e.virtual || isDeck(e) || e.tunnel || elig.has(e)) continue;
                        const link = /_link$/.test(e.type), same = e.name && deckNames.has(e.name) && plain;
                        if (!link && !same) continue;
                        const o = e.a === n ? e.b : e.a, d = d0 + e.len; if (d > 300) continue;
                        elig.add(e); if (!dist.has(o) || dist.get(o) > d) { dist.set(o, d); q.push(o); }
                    }
                }
            }
            const region = (e) => isDeck(e) || elig.has(e);
            // live decks (pass over a road) and their targets
            const chainOf = new Map(); let nc = 0;
            for (const e of edges) { if (!isDeck(e) || chainOf.has(e)) continue; const st = [e]; chainOf.set(e, nc); while (st.length) { const f = st.pop(); for (const n of [f.a, f.b]) for (const g of n.edges) if (isDeck(g) && !chainOf.has(g)) { chainOf.set(g, nc); st.push(g); } } nc++; }
            const live = new Set(); for (const e of edges) if (chainOf.has(e) && (e.over?.length || crossings.some(c => c.u === e))) live.add(chainOf.get(e));
            for (const o of overlaps) for (const [u, f] of [[o.e, o.f], [o.f, o.e]]) if (chainOf.has(u) && !f.bridge && !f.tunnel) live.add(chainOf.get(u));
            const target = new Map();
            for (const [e, k] of chainOf) { if (!live.has(k)) continue; const t = Math.max(1, Math.min(3, rawLayer(e))) * PER; for (const n of [e.a, e.b]) target.set(n, Math.max(target.get(n) ?? 0, t)); }
            // ground nodes: touch any street that is neither deck nor ramp (tunnels aside)
            const groundN = new Set();
            for (const n of nodeArr) if (n.edges.some(e => !e.virtual && !region(e) && !e.tunnel)) groundN.add(n);
            const cone = (seeds, sgn) => {
                const best = new Map(), heap = [];
                const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                for (const [n, v] of seeds) { best.set(n, v * sgn); push(n, v * sgn); }
                while (heap.length) { const [v, n] = pop(); if (v < best.get(n)) continue; for (const e of n.edges) { if (!region(e)) continue; const o = e.a === n ? e.b : e.a, nv = v - G * e.len; if (nv > (best.get(o) ?? -Infinity)) { best.set(o, nv); push(o, nv); } } }
                return best;
            };
            for (const [n, v] of target) deckTarget.set(n, v);
            const up = cone([...target], 1), lim = cone([...groundN].map(n => [n, 0]), -1);
            let lowered = 0, raised = 0, maxY = 0;
            for (const n of nodeArr) {
                if (!n.edges.length) continue;
                const inRegion = n.edges.some(region), tunnelN = n.edges.some(e => e.tunnel && !e.virtual);
                if (tunnelN && n.y < 0) continue; // trenches / tunnels keep their depth
                let y;
                if (groundN.has(n) || !inRegion) y = Math.min(n.y, 0); // (only lifts are removed: trench approaches keep their dip)
                else { const u = up.get(n) ?? 0, cap = lim.has(n) ? -lim.get(n) : Infinity; y = Math.max(0, Math.min(u, cap)); }
                if (y < n.y - 0.05) lowered++; else if (y > n.y + 0.05) raised++;
                n.y = y; maxY = Math.max(maxY, y);
            }
            finalStats = { ramps: elig.size, liveDecks: live.size, ground: groundN.size, lowered, raised, maxY: +maxY.toFixed(1) };
            profileStats0 = { ...(profileStats0 || {}), final: finalStats };
        }
        // ---- (round 6) gores: where a deck / ramp merges into (or splits from) a near-parallel road it is connected to,
        //      their surfaces touch or overlap for the last metres before the node — no room for a barrier there (the
        //      wall-cut rule opens it so neither lane is blocked). If they are at different heights the car drops off one
        //      onto the other (audit 'cliff' at Pasajul Basarab / Bretea / Doina Cornea). Same sampling as the audit's
        //      cliff check (just beyond one road's edge) plus a sample just inside it (overlapping ribbons): on the other
        //      road's surface the heights must agree (one surface; the visual QA flags 0.05–2.5 m as a stacked road).
        //      Only lowering: the higher surface comes down to the lower one there (the lower one is usually held by
        //      its ground cone), the drop spread back along the graph at the grade limit, never more than 3 m and never
        //      under a clearance floor.
        {
            const G = MAXG * 0.97, DROP = 3, wA = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e), wS = (e, s) => wA(e, s) + e.sidewalk;
            const live = nodeArr.filter(n => n.edges.some(e => !e.virtual)), y0 = new Map(live.map(n => [n, n.y]));
            // floors: no road comes down more than DROP m (a gore that would need a deeper sag is left as it is), none goes
            // under ground (unless already sunk), and a structure over another road keeps its clearance
            const floor = new Map(), setFloor = (n, v) => floor.set(n, Math.max(floor.get(n) ?? -Infinity, Math.min(y0.get(n) ?? n.y, v)));
            for (const n of live) setFloor(n, Math.max(n.y - DROP, Math.min(n.y, 0)));
            for (const c of crossings) { if (c.u.L <= 0 || Math.abs(c.u.dirx * c.f.dirx + c.u.dirz * c.f.dirz) >= 0.85) continue; const tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1); for (const n of [c.u.a, c.u.b]) setFloor(n, yP(c.f, tf) + CLEAR_MIN); }
            for (const o of overlaps) { const ye = yP(o.e, o.te), yf = yP(o.f, o.tf); if (Math.abs(ye - yf) < 3) continue; const [hi, lo] = ye > yf ? [o.e, yf] : [o.f, ye]; for (const n of [hi.a, hi.b]) setFloor(n, lo + CLEAR_MIN); }
            const heapCone = (seeds, sgn) => { // sgn −1: min-plus (v + G d), sgn +1: max-plus (v − G d); over every real edge
                const best = new Map(), heap = [], key = (v) => sgn * v; // (max-heap on key: the best value is settled first)
                const push = (n, v) => { heap.push([key(v), v, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
                const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] > heap[c][0]) c++; if (heap[c][0] <= heap[i][0]) break; [heap[c], heap[i]] = [heap[i], heap[c]]; i = c; } } return top; };
                for (const [n, v] of seeds) if (!best.has(n) || key(v) > key(best.get(n))) { best.set(n, v); push(n, v); }
                while (heap.length) { const [, v, n] = pop(); if (v !== best.get(n)) continue; for (const f of n.edges) { if (f.virtual) continue; const o = f.a === n ? f.b : f.a, nv = v - sgn * G * f.len; if (!best.has(o) || key(nv) > key(best.get(o))) { best.set(o, nv); push(o, nv); } } }
                return best;
            };
            const F = heapCone([...floor], 1); // the highest grade-feasible lower bound
            const linked = new Map(); // edge → Set of edges within 80 m along the graph
            const linkSet = (e) => {
                let s = linked.get(e); if (s) return s;
                s = new Set(); const dist = new Map(), q = [[e.a, 0], [e.b, 0]];
                while (q.length) { const [n, d] = q.shift(); if ((dist.get(n) ?? Infinity) <= d) continue; dist.set(n, d); for (const f of n.edges) { if (f.virtual) continue; s.add(f); const o = f.a === n ? f.b : f.a, nd = d + f.len; if (nd <= 80) q.push([o, nd]); } }
                linked.set(e, s); return s;
            };
            let fixes = 0, rounds = 0, pairs = 0;
            for (; rounds < 20; rounds++) {
                const caps = new Map(), cap = (n, v) => { if (v < n.y - 0.01 && v < (caps.get(n) ?? Infinity)) caps.set(n, v); };
                pairs = 0;
                for (const e of edges) {
                    if (e.virtual || e.len < 0.5) continue;
                    const step = Math.max(0.02, 1.5 / e.len);
                    for (let t = 0; t <= 1 + 1e-6; t += step) {
                        const tt = Math.min(t, 1), he = e.a.y + (e.b.y - e.a.y) * tt;
                        // (inside its asphalt edge: overlapping ribbons; just beyond it: the audit's cliff sample)
                        for (const [s, off] of [[1, wA(e, 1) - 0.5], [-1, wA(e, -1) - 0.5], [1, (e.bridge ? wA(e, 1) + 0.3 : wS(e, 1)) + 0.6], [-1, (e.bridge ? wA(e, -1) + 0.3 : wS(e, -1)) + 0.6]]) {
                            const x = e.a.x + e.dirx * e.len * tt + e.nx * off * s, z = e.a.z + e.dirz * e.len * tt + e.nz * off * s;
                            edgesInBox(x - 1, z - 1, x + 1, z + 1, (f) => {
                                if (f === e || f.virtual || Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.85) return;
                                const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= 0 || q.t >= 1) return;
                                const sf = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) >= 0 ? 1 : -1; if (q.d > wS(f, sf)) return;
                                const hf = f.a.y + (f.b.y - f.a.y) * q.t, dh = he - hf;
                                if (Math.abs(dh) <= 0.04 || Math.abs(dh) > 6 || Math.min(he, hf) < -0.5 || !linkSet(e).has(f)) return;
                                pairs++;
                                const [h, th, lo] = dh > 0 ? [e, tt, hf] : [f, q.t, he]; // (one surface: the visual QA flags 0.05–2.5 m as a stacked road)
                                cap(h.a, lo); cap(h.b, lo); // (both ends: a linear piece is only ≤ lo at th if both are; pieces are ≤ 10 m)
                            });
                        }
                    }
                }
                if (!caps.size) break;
                // y = min(y, max(capCone, floorCone)): lowering only, grade-limited, never under a floor
                const C = heapCone([...caps], -1);
                let changed = 0;
                for (const [n, c] of C) { const ny = Math.min(n.y, Math.max(c, F.get(n) ?? -Infinity)); if (ny < n.y - 0.01) { n.y = ny; changed++; } }
                fixes += changed; if (!changed) break; // (what is left is held by a floor)
            }
            let maxDrop = 0; for (const [n, v] of y0) maxDrop = Math.max(maxDrop, v - n.y);
            profileStats0 = { ...(profileStats0 || {}), gore: { lowered: fixes, rounds, left: pairs, maxDrop: +maxDrop.toFixed(2) } };
        }
        let residual = 0; for (const e of edges) if (!e.virtual) residual = Math.max(residual, Math.abs(e.b.y - e.a.y) - MAXG * e.len);
        for (const e of edges) { e.ya = e.a.y; e.yb = e.b.y; }
        let cBad = 0, oBad = 0;
        for (const c of crossings) { const tu = clamp(((c.x - c.u.a.x) * c.u.dirx + (c.z - c.u.a.z) * c.u.dirz) / c.u.len, 0, 1), tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1); if ((yP(c.u, tu) - yP(c.f, tf)) * (c.u.L > 0 ? 1 : -1) < 3) cBad++; }
        for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 2.6) oBad++; }
        profileStats = { merge: profileStats0, crossings: crossings.length, overlaps: overlaps.length, clearanceViolations: cBad, overlapSteps: oBad, gradeResidual: +residual.toFixed(3), hardNodes: hard.size, nanAt };
        function yAt(e, x, z) { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.a.y + (e.b.y - e.a.y) * t; }
        // ramps (embankments / trenches) have at most a narrow service walkway: their walls stand right at the kerb
        for (const e of edges) if (!e.bridge && Math.max(Math.abs(e.ya), Math.abs(e.yb)) > 0.3) e.sidewalk = Math.min(e.sidewalk, 0.5);
        // (QA r2) ramps / bridge approaches that pass over a street with < 5 m clearance carry no sidewalk: their walkways
        // lay 1–2 m above the street's carriageway (Pasajul Basarab, Podul Barbu Văcărescu)
        for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.3 && d < 5) { const hi = yP(o.e, o.te) > yP(o.f, o.tf) ? o.e : o.f; hi.sidewalk = Math.min(hi.sidewalk, 0.3); } }
        { // (round 6) the pieces of one OSM segment (profile points) share its narrowest walkway, as the whole edge did
            const seg = new Map(); for (const e of edges) if (e.seg !== undefined) seg.set(e.seg, Math.min(seg.get(e.seg) ?? Infinity, e.sidewalk));
            for (const e of edges) if (e.seg !== undefined) e.sidewalk = seg.get(e.seg);
        }
    }
    const yAlong = (e, x, z) => { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.ya + (e.yb - e.ya) * t; };
    /** height of junction n's pad at (x, z): the profile of the nearest approach there (n.y on flat junctions) */
    const padHeightAt = (n, x, z) => { let best = null, bd = Infinity; for (const e of n.edges) { if (e.virtual) continue; const d = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z).d; if (d < bd) { bd = d; best = e; } } return best ? yAlong(best, x, z) : n.y; };

    // ---- traffic lights: move stop-line signals onto the junction they control, then cluster
    for (const n of nodeArr) {
        if (!n.signal || !n.edges.length) continue;
        if (n.edges.some(e => /motorway/.test(e.type))) continue;
        if (n.edges.length >= 3) { n.hasLight = true; continue; }
        // BFS along the graph up to 32 m for a junction
        let found = null; const seen = new Set([n]); let frontier = [[n, 0]];
        while (frontier.length && !found) {
            const nf = [];
            for (const [m, d] of frontier) for (const e of m.edges) {
                const o = e.a === m ? e.b : e.a; const dd = d + e.len;
                if (seen.has(o) || dd > 32) continue; seen.add(o);
                if (o.edges.length >= 3) { found = o; break; }
                nf.push([o, dd]);
            }
            frontier = nf;
        }
        if (found) { found.hasLight = true; n.crossing = true; n.zebra = true; }
        else n.hasLight = true; // stand-alone pedestrian light
    }
    // cluster nearby light nodes so complex junctions (dual carriageways) share one controller
    const lightNodes = nodeArr.filter(n => n.hasLight);
    const parent = new Map(lightNodes.map(n => [n, n]));
    const find = (n) => { while (parent.get(n) !== n) { parent.set(n, parent.get(parent.get(n))); n = parent.get(n); } return n; };
    {
        const g = new BoxGrid(40);
        for (const n of lightNodes) g.insert(n.x, n.z, n.x, n.z, n);
        for (const n of lightNodes) g.each(n.x - 38, n.z - 38, n.x + 38, n.z + 38, (m) => { if (m !== n && Math.hypot(m.x - n.x, m.z - n.z) < 38) parent.set(find(m), find(n)); });
    }
    const clusters = new Map();
    for (const n of lightNodes) { const r = find(n); let c = clusters.get(r); if (!c) clusters.set(r, c = { nodes: [], offset: rng.range(0, 20) }); c.nodes.push(n); }
    for (const c of clusters.values()) {
        let ref = null, best = -1;
        for (const n of c.nodes) for (const e of n.edges) { const s = (CLASS_RANK[e.type] || 1) * 10 + e.lanesF + e.lanesB + e.len / 1000; if (s > best) { best = s; ref = e; } }
        c.refAng = Math.atan2(ref.dirz, ref.dirx);
        for (const n of c.nodes) n.lightCluster = c;
    }
    // the node at Piața Victoriei keeps its historic id (main.js achievement)
    if (city.id === 'bucharest') {
        const pv = city.proj(44.4522, 26.0859);
        let best = null, bd = 60;
        for (const n of nodeArr) if (n.edges.length >= 3) { const d = Math.hypot(n.x - pv.x, n.z - pv.z); if (d < bd) { bd = d; best = n; } }
        if (best) { delete nodes[best.id]; best.id = 'victoriei'; nodes.victoriei = best; }
    }
    const graph = { nodes, edges };

    // -----------------------------------------------------------------------
    //  CELLS (chunked static geometry)
    // -----------------------------------------------------------------------
    const cells = new Map();
    const cellOf = (x, z) => {
        const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = i * 10007 + j;
        let c = cells.get(k);
        if (!c) cells.set(k, c = { i, j, solid: new MeshBuilder(true), roof: new MeshBuilder(), ground: new MeshBuilder(), area: new MeshBuilder(), grass: new MeshBuilder(), pave: new MeshBuilder(), marks: new MeshBuilder(), road: new MeshBuilder(), pad: new MeshBuilder(), water: new MeshBuilder(), backdrop: new MeshBuilder(), detail: new MeshBuilder(true), signs: [] });
        return c;
    };
    const signMB = (c, page) => c.signs[page] || (c.signs[page] = new MeshBuilder());

    // bounds
    const [bx0, bz0, bx1, bz1] = data.bounds.map(v => v * 0.1);
    const pad = distId ? 40 : (city.bounds?.pad ?? 300);
    const bounds = { minX: bx0 - pad, maxX: bx1 + pad, minZ: bz0 - pad, maxZ: bz1 + pad };
    // district inside-mask (20 m cells, RLE rows): where the player may drive; boundary walls follow its outline
    const dmask = data.district?.mask ? (() => {
        const m = data.district.mask, bits = new Uint8Array(m.w * m.h); let k = 0, v = 0;
        for (const run of m.rle) { bits.fill(v, k, k + run); k += run; v ^= 1; }
        return { ...m, bits, at: (x, z) => { const i = Math.floor((x - m.x0) / m.cell), j = Math.floor((z - m.z0) / m.cell); return i >= 0 && j >= 0 && i < m.w && j < m.h && bits[j * m.w + i] === 1; } };
    })() : null;
    if (dmask) Object.assign(bounds, { minX: dmask.x0 - pad, minZ: dmask.z0 - pad, maxX: dmask.x0 + dmask.w * dmask.cell + pad, maxZ: dmask.z0 + dmask.h * dmask.cell + pad });

    // -----------------------------------------------------------------------
    //  AREAS (landuse, parks, water, parking)
    // -----------------------------------------------------------------------
    setProgress('Parks, rivers and lakes…'); await tick();
    const areaColors = {
        water: env.water, park: env.grass, grass: shadeHex(env.grass, 1.08), forest: shadeHex(env.grass, 0.78), scrub: '#7c8a58', pitch: '#5e9b4a', cemetery: '#71865f',
        residential: shadeHex(env.ground, 1.08), industrial: '#8e8a86', commercial: '#a39896', retail: '#a6999a', railway: '#857d74', construction: '#9c8e78',
        parking: '#5f6064', apron: '#8b8c8e', runway: '#505256', track: '#a7a39a', clay: '#c06a45', // (velodrome concrete; clay courts / tartan)
        turf: '#3f7f3c', hard: '#4f7f8f', pool: '#4fb0d6', yard: '#9a978c', // (artificial turf; acrylic / asphalt courts; outdoor pools; school / hospital / sports grounds)
    };
    const areas = [];
    const waterGrid = new BoxGrid(200), parkGrid = new BoxGrid(200);
    for (const a of data.areas) {
        const kind = data.areaKinds[a[0]];
        const rings = a.slice(2).map(r => undelta(r, 0));
        const outer = rings[0]; if (!outer || outer.length < 3) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const area = { kind, name: str(a[1]), rings, outer, holes: rings.slice(1), x0, z0, x1, z1, size: Math.abs(signedArea(outer)) };
        areas.push(area);
        if (kind === 'water') waterGrid.insert(x0, z0, x1, z1, area);
        if (kind === 'park' || kind === 'forest' || kind === 'grass' || kind === 'cemetery') parkGrid.insert(x0, z0, x1, z1, area);
    }
    const inArea = (a, x, z) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && pointInPolygon(x, z, a.outer) && !a.holes.some(h => pointInPolygon(x, z, h));
    const isWater = (x, z) => { let w = false; waterGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    // nothing stands in water / fountain basins (play-test note 17): `m` = margin for the basin rim / coping
    const nearWater = (x, z, m = 1.5) => isWater(x, z) || (m > 0 && (isWater(x + m, z) || isWater(x - m, z) || isWater(x, z + m) || isWater(x, z - m)));
    const isPark = (x, z) => { let w = false; parkGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    const bigWater = new MeshBuilder();
    // (play-test note 11) the Dâmbovița runs in a straight concrete channel: water ≈ 4.4 m below the Splai, a lower
    // service bank (≈ 2 m) above the waterline, a sloped / vertical concrete wall up to the quay, a parapet + railing
    const CHAN = { water: -4.4, bank: -3.2, bankW: 2.0, slope: 0.9 }, channelAreas = [];
    // flat ground layers do not write depth (drawn first, in this order) → no z-fighting, sunken roads stay visible
    const AREA_ORDER = ['residential', 'industrial', 'commercial', 'retail', 'railway', 'construction', 'yard', 'cemetery', 'grass', 'scrub', 'forest', 'park', 'track', 'pitch', 'turf', 'clay', 'hard', 'pool', 'parking', 'apron', 'runway', 'water'];
    areas.sort((p, q) => AREA_ORDER.indexOf(p.kind) - AREA_ORDER.indexOf(q.kind));
    for (const a of areas) {
        const { pts, tris } = triangulate(a.outer, a.holes);
        if (!tris.length) continue;
        const y = AREA_Y[a.kind] ?? Y.landuse;
        const col = rgb(areaColors[a.kind] || env.ground);
        if (a.kind === 'water') {
            const target = (a.x1 - a.x0 > CELL * 2 || a.z1 - a.z0 > CELL * 2) ? bigWater : cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).water;
            let per = 0; for (let k = 0; k < a.outer.length; k++) { const p0 = a.outer[k], p1 = a.outer[(k + 1) % a.outer.length]; per += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); }
            // the Dâmbovița: named so, or (often unnamed riverbank polygons) a long narrow water body in Bucharest (mean width < 60 m)
            const chan = !US && (/d[âa]mbovi[tţț]a/i.test(a.name || '') || (!/lac|lacul|iaz|fântân|fantan|bazin/i.test(a.name || '') && per > 400 && a.size / (per / 2) < 60));
            const v0 = target.vc; target.flatPoly(pts, tris, chan ? CHAN.water : y, chan ? rgb('#3c4a42') : col, 0.02); a.waterMesh = { mb: target, v0, v1: target.vc };
            if (chan) { a.channel = true; channelAreas.push(a); }
        } else {
            const cc = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2);
            (GRASSY.has(a.kind) ? cc.grass : PAVED.has(a.kind) ? cc.pave : cc.area).flatPoly(pts, tris, y, col, 0.1);
        }
    }
    // sports grounds (2026-11-08): line markings, goals, tennis nets and court fences, basketball hoops, pool copings on
    // the pitch / turf / clay / hard / pool areas — they were flat coloured patches. The court is fitted with the
    // smallest-area rectangle of its outline (skipped when the outline is not rectangular enough); everything is visual.
    let pitchesDressed = 0;
    const sportsColl = []; // (colliders of the sports dressing: it runs before propColl exists — merged in below)
    const dressSports = () => { // (run after the landmarks are built: a ground inside a landmark — the Dinamo pitch — is the model's own)
        const W = rgb('#f4f4ef'), POST = rgb('#ededea'), FENCE = rgb('#2f4a3a'), NET = rgb('#2a2d30');
        const minRect = (pts) => {
            let best = null;
            for (let k = 0; k < pts.length; k++) {
                const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of pts) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                const A = (a1 - a0) * (c1 - c0); if (!best || A < best.A) best = { A, ux, uz, a0, a1, c0, c1 };
            }
            if (!best) return null;
            let { ux, uz, a0, a1, c0, c1 } = best; const pm = (a0 + a1) / 2, qm = (c0 + c1) / 2;
            let hl = (a1 - a0) / 2, hw = (c1 - c0) / 2;
            if (hw > hl) { [hl, hw] = [hw, hl]; [ux, uz] = [-uz, ux]; } // u = long axis
            return { cx: pm * best.ux - qm * best.uz, cz: pm * best.uz + qm * best.ux, ux, uz, hl, hw, A: best.A };
        };
        for (const a of areas) {
            if (!/^(pitch|turf|clay|hard|pool)$/.test(a.kind) || a.size < 60 || a.size > 20000) continue;
            if (landmarks.some(l => l.radius > 0 && Math.hypot(l.x - (a.x0 + a.x1) / 2, l.z - (a.z0 + a.z1) / 2) < l.radius)) continue;
            const R = minRect(a.outer); if (!R || a.size / R.A < 0.8) continue;
            const { cx, cz, ux, uz, hl, hw } = R, vx = -uz, vz = ux;
            const P = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
            const c = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), base = AREA_Y[a.kind] ?? Y.pitch, yL = base + 0.006; // (same cell = same mesh as the area polygon: the lines draw after it)
            const layer = GRASSY.has(a.kind) ? c.grass : c.pave;
            const line = (u0, v0, u1, v1, w = 0.1) => { const L = Math.hypot(u1 - u0, v1 - v0); if (L < 0.05) return; const nu = -(v1 - v0) / L * w / 2, nv = (u1 - u0) / L * w / 2; const [ax, az] = P(u0 + nu, v0 + nv), [bx, bz] = P(u1 + nu, v1 + nv), [qx, qz] = P(u1 - nu, v1 - nv), [rx, rz] = P(u0 - nu, v0 - nv); layer.flatQuad(ax, az, bx, bz, qx, qz, rx, rz, yL, W, 0.1); };
            const rect = (hu, hv) => { line(-hu, -hv, hu, -hv); line(-hu, hv, hu, hv); line(-hu, -hv, -hu, hv); line(hu, -hv, hu, hv); };
            const ang = Math.atan2(ux, uz);
            if (a.kind === 'pool') { // coping all round, lane ropes on long pools
                const k = 0.6; for (const [u0, v0, u1, v1] of [[-hl, -hw, hl, -hw], [-hl, hw, hl, hw], [-hl, -hw, -hl, hw], [hl, -hw, hl, hw]]) line(u0, v0, u1, v1, k);
                if (hl > 10) for (let v = -hw + 2.5; v < hw - 1.5; v += 2.5) line(-hl + 1, v, hl - 1, v, 0.08);
                pitchesDressed++; continue;
            }
            const tennis = (a.kind === 'clay' || a.kind === 'hard') && hl >= 11 && hw >= 5.5 && !(a.kind === 'hard' && hl < 13);
            if (tennis) { // a grid of courts (23.77 × 10.97 m inside 36 × 18 m run-offs), nets, a fence round the plot
                const nu = Math.max(1, Math.round(hl * 2 / 36)), nv = Math.max(1, Math.round(hw * 2 / 18)), su = hl * 2 / nu, sv = hw * 2 / nv;
                for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
                    const u0 = -hl + su * (i + 0.5), v0 = -hw + sv * (j + 0.5), HL = Math.min(11.885, su / 2 - 1.5), HW = Math.min(5.485, sv / 2 - 1), HS = HW * 4.115 / 5.485;
                    const L2 = (a0, b0, a1, b1) => line(u0 + a0, v0 + b0, u0 + a1, v0 + b1, 0.06);
                    L2(-HL, -HW, HL, -HW); L2(-HL, HW, HL, HW); L2(-HL, -HW, -HL, HW); L2(HL, -HW, HL, HW); L2(-HL, -HS, HL, -HS); L2(-HL, HS, HL, HS);
                    L2(-6.4, -HS, -6.4, HS); L2(6.4, -HS, 6.4, HS); L2(-6.4, 0, 6.4, 0);
                    const [nx0, nz0] = P(u0, v0 - HW - 0.9), [nx1, nz1] = P(u0, v0 + HW + 0.9);
                    c.detail.wall(nx0, nz0, nx1, nz1, base + 0.05, base + 0.95, ux, uz, NET); c.detail.wall(nx1, nz1, nx0, nz0, base + 0.05, base + 0.95, -ux, -uz, NET);
                    for (const [px, pz] of [[nx0, nz0], [nx1, nz1]]) c.detail.box(px, base, pz, 0.08, 1.07, 0.08, 0, POST);
                }
                const corners = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                for (let k = 0; k < 4; k++) { const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], L = Math.hypot(bx - ax, bz - az);
                    for (let t = 0; t <= L; t += 3) { const f = t / L; c.detail.box(ax + (bx - ax) * f, base, az + (bz - az) * f, 0.06, 3, 0.06, 0, FENCE); }
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, an = Math.atan2(bx - ax, bz - az);
                    c.detail.box(mx, base + 2.95, mz, 0.05, 0.05, L, an, FENCE); c.detail.box(mx, base + 1.5, mz, 0.04, 0.04, L, an, FENCE);
                    c.solid.box(mx, base, mz, 0.04, 0.12, L, an, FENCE);
                    sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: L / 2, angle: an, r: Math.hypot(0.1, L / 2), poly: null, h: 3, prop: true, kind: 'fence' }); } // (solid)
                pitchesDressed++; continue;
            }
            if (a.kind === 'hard') { // basketball / multi-sport: outline, centre line and circle, hoops at both ends
                rect(hl - 1, hw - 1); line(0, -hw + 1, 0, hw - 1);
                const n = 24, r = Math.min(1.8, hw * 0.25); for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, 0.06); }
                for (const sg of [-1, 1]) { // pole behind the end line, arm, backboard (with its target square), orange rim and a net
                    const [px, pz] = P(sg * (hl + 0.2), 0), [bx, bz] = P(sg * (hl - 1.2), 0), [ax2, az2] = P(sg * (hl - 0.5), 0);
                    c.solid.box(px, base, pz, 0.14, 3.5, 0.14, ang, rgb('#3a3d42')); sportsColl.push({ x: px, z: pz, r: 0.1, hw: 0.1, hd: 0.1, angle: 0, poly: null, h: 3, prop: true, kind: 'post' });
                    c.solid.box(ax2, base + 3.3, az2, 0.1, 0.1, 1.4, ang, rgb('#3a3d42'));
                    c.solid.box(bx, base + 2.9, bz, 0.06, 1.05, 1.8, ang + Math.PI / 2, rgb('#f2f2f0'));
                    const [qx, qz] = P(sg * (hl - 1.24), 0); c.detail.box(qx, base + 3.05, qz, 0.02, 0.45, 0.59, ang + Math.PI / 2, rgb('#c2410c'));
                    const [rx, rz] = P(sg * (hl - 1.48), 0), R = 0.23;
                    for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI * 2, a1 = (k + 1) / 10 * Math.PI * 2, cx2 = rx + (Math.cos(a0) + Math.cos(a1)) / 2 * R, cz2 = rz + (Math.sin(a0) + Math.sin(a1)) / 2 * R;
                        c.detail.box(cx2, base + 3.05, cz2, 0.03, 0.03, 2 * R * Math.sin(Math.PI / 10) + 0.02, Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)), rgb('#e8590c'));
                        if (k % 2 === 0) c.detail.box(rx + Math.cos(a0) * R * 0.8, base + 2.65, rz + Math.sin(a0) * R * 0.8, 0.012, 0.4, 0.012, 0, rgb('#f2f2f0')); } // net strands
                }
                pitchesDressed++; continue;
            }
            // football (grass / artificial turf): touch + goal lines, halfway line, centre circle, boxes, goals
            if (hl < 12 || hw < 6) continue;
            const m = Math.min(1.5, hw * 0.06), HL = hl - m, HW = hw - m;
            // (2026-11-08, owner: "football fields need a bit more love") mowing stripes across the whole pitch in two greens
            // (they also cover the aerial green-raster / yard patches that showed through), no trees on it, corner flags,
            // dugouts at halfway, ball-stop fences behind the goals, deeper goals with side nets
            { const turf = a.kind === 'turf', c1 = rgb(turf ? '#4f9a4c' : '#5d9a45'), c2 = rgb(turf ? '#468d43' : '#528d3d'), ns = Math.max(4, Math.round(hl * 2 / 5.5));
                for (let k = 0; k < ns; k++) { const u0 = -hl + hl * 2 * k / ns, u1 = -hl + hl * 2 * (k + 1) / ns, [x0, z0] = P(u0, -hw), [x1, z1] = P(u1, -hw), [x2, z2] = P(u1, hw), [x3, z3] = P(u0, hw);
                    layer.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, base + 0.003, k % 2 ? c1 : c2, 0.1); }
                const q = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
                lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) });
                for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [fx, fz] = P(su * HL, sv * HW); c.detail.box(fx, base, fz, 0.04, 1.5, 0.04, 0, POST); c.detail.box(fx + 0.2, base + 1.2, fz, 0.4, 0.3, 0.02, ang, rgb('#e8b923')); }
                if (hw > 15) for (const sd of [-1, 1]) { const [dx, dz] = P(sd * 6, -(hw + 0.4 > HW + 2.5 ? HW + 2.2 : hw + 1.2)); // dugouts: a bench under a curved perspex-ish roof
                    c.solid.box(dx, base, dz, 4.0, 0.08, 1.2, ang, rgb('#cfd2d4')); c.solid.box(dx, base + 1.95, dz, 4.1, 0.08, 1.4, ang, rgb('#2f6fb0'));
                    for (const t of [-1.95, 1.95]) { const [ex, ez] = P(sd * 6 + t, -(hw + 0.4 > HW + 2.5 ? HW + 2.2 : hw + 1.2)); c.solid.box(ex, base, ez, 0.06, 1.95, 1.3, ang, rgb('#2f6fb0')); }
                    c.solid.box(dx, base + 0.45, dz, 3.6, 0.06, 0.45, ang, rgb('#c23b3b'));
                    sportsColl.push({ x: dx, z: dz, hw: 2.05, hd: 0.7, angle: ang + Math.PI / 2, r: 2.2, poly: null, h: 2, prop: true, kind: 'furniture' }); }
                if (hl > 22) for (const sg of [-1, 1]) { const fu = sg * (hl + 0.3), fw = Math.min(hw, 24); // ball-stop fence behind the goal: posts + a few wires
                    for (let v = -fw; v <= fw + 0.01; v += 4) { const [px, pz] = P(fu, v); c.detail.box(px, base, pz, 0.08, 6, 0.08, 0, FENCE); }
                    for (const y of [1, 2.5, 4, 5.9]) { const [mx, mz] = P(fu, 0); c.detail.box(mx, base + y, mz, 0.03, 0.03, fw * 2, ang + Math.PI / 2, FENCE); }
                    { const [mx, mz] = P(fu, 0), an2 = ang + Math.PI / 2; sportsColl.push({ x: mx, z: mz, hw: 0.1, hd: fw, angle: an2, r: Math.hypot(0.1, fw), poly: null, h: 6, prop: true, kind: 'fence' }); } }
            }
            rect(HL, HW); line(0, -HW, 0, HW);
            const rc = Math.min(9.15, HW * 0.27), n = 36; for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; line(Math.cos(a0) * rc, Math.sin(a0) * rc, Math.cos(a1) * rc, Math.sin(a1) * rc); }
            const bd = Math.min(16.5, HL * 0.3), bw = Math.min(20.16, HW * 0.6), gw = HL > 40 ? 3.66 : HL > 22 ? 2.5 : 1.5, gh = HL > 40 ? 2.44 : 2;
            for (const sg of [-1, 1]) {
                const g = sg * HL; line(g, -bw, g - sg * bd, -bw); line(g - sg * bd, -bw, g - sg * bd, bw); line(g - sg * bd, bw, g, bw);
                for (const v of [-gw, gw]) { const [px, pz] = P(g + sg * 0.05, v); c.detail.box(px, base, pz, 0.1, gh, 0.1, 0, POST); sportsColl.push({ x: px, z: pz, r: 0.08, hw: 0.08, hd: 0.08, angle: 0, poly: null, h: 3, prop: true, kind: 'post' }); }
                const [tx, tz] = P(g + sg * 0.05, 0); c.detail.box(tx, base + gh - 0.1, tz, 0.1, 0.1, gw * 2 + 0.1, ang + Math.PI / 2, POST);
                // the net: a see-through mesh of thin strands at the back (a solid panel read as a white wall)
                const NETC = rgb('#e2e4e4'), nd = g + sg * Math.min(1.4, gh * 0.6);
                for (let v = -gw; v <= gw + 0.01; v += 0.3) { const [mx, mz] = P(nd, v); c.detail.box(mx, base, mz, 0.025, gh * 0.9, 0.025, 0, NETC); }
                for (let y = 0.3; y < gh * 0.9; y += 0.3) { const [mx, mz] = P(nd, 0); c.detail.box(mx, base + y, mz, 0.025, 0.025, gw * 2, ang + Math.PI / 2, NETC); }
                for (const v of [-gw, gw]) { // side frames + side nets, the top bars back to the net (a goal with depth, not a flat gate)
                    const [ax2, az2] = P(g + sg * 0.05, v), [bx2, bz2] = P(nd, v), dL = Math.hypot(bx2 - ax2, bz2 - az2);
                    c.detail.box((ax2 + bx2) / 2, base + gh - 0.08, (az2 + bz2) / 2, 0.05, 0.05, dL, ang, POST); c.detail.box((ax2 + bx2) / 2, base, (az2 + bz2) / 2, 0.05, 0.05, dL, ang, POST);
                    for (let t = 0.3; t < dL; t += 0.3) { const [sx2, sz2] = P(g + sg * (0.05 + t), v); c.detail.box(sx2, base, sz2, 0.02, gh * 0.95, 0.02, 0, NETC); } }
            }
            pitchesDressed++;
        }
    };
    // green ground (district worlds, 2026-11-08): gardens, lawns, courtyards and the ground under the crowns, measured on
    // aerial imagery (data.green raster, build-data / tools/aerial/trees.py), as grass quads under everything paved —
    // the quarter's private gardens were bare grey ground. Runs merged across rows into rectangles.
    let greenQuads = 0;
    if (data.green?.rle) {
        const G = data.green, base = rgb(shadeHex(env.grass, 0.94)), gr = makeRng(4421);
        const open = new Map(); // "c:n" → {c, n, r0}
        const flush = (o, r1) => {
            const x0 = G.x0 + o.c * G.cx, x1 = G.x0 + (o.c + o.n) * G.cx, z0 = G.z0 + o.r0 * G.cz, z1 = G.z0 + r1 * G.cz;
            const k = 0.9 + gr() * 0.16, col = [Math.round(base[0] * k), Math.round(base[1] * (k + 0.02)), Math.round(base[2] * k)];
            cellOf((x0 + x1) / 2, (z0 + z1) / 2).grass.flatQuad(x0, z0, x1, z0, x1, z1, x0, z1, Y.grass + 0.004, col, 0.1); greenQuads++;
        };
        let r = 0, c = 0, cur = 0; let rowRuns = [];
        const endRow = () => {
            const seen = new Set();
            for (const [c2, n2] of rowRuns) { const key = c2 + ':' + n2; seen.add(key); if (!open.has(key)) open.set(key, { c: c2, n: n2, r0: r }); }
            for (const [key, o] of open) if (!seen.has(key)) { flush(o, r); open.delete(key); }
            rowRuns = []; r++; c = 0; cur = 0;
        };
        for (const v of G.rle) { if (v < 0) { endRow(); continue; } if (cur && v > 0) rowRuns.push([c, v]); c += v; cur ^= 1; }
        for (const o of open.values()) flush(o, r);
    }
    // runways / rivers as ribbons
    for (const l of data.lines) {
        const kind = data.lineKinds[l[0]], w = l[1] / 10, pts = undelta(l[3], 0);
        const col = rgb(kind === 'runway' ? '#4f5156' : kind === 'taxiway' ? '#5d5f63' : env.water);
        const y = kind === 'runway' || kind === 'taxiway' ? Y.parking + 0.012 : Y.water - 0.005;
        for (let i = 0; i < pts.length - 1; i++) {
            const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
            const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
            const tgt = kind === 'runway' || kind === 'taxiway' ? cellOf(ax, az).pave : cellOf(ax, az).water;
            const inChan = channelAreas.length && kind !== 'runway' && kind !== 'taxiway' && channelAreas.some(c2 => inArea(c2, (ax + bx) / 2, (az + bz) / 2)); // (the river line inside the sunken channel)
            tgt.flatQuad(ax + nx, az + nz, bx + nx, bz + nz, bx - nx, bz - nz, ax - nx, az - nz, inChan ? CHAN.water - 0.01 : y, col, 0.05);
            if (kind === 'runway') for (let s = 10; s < L - 10; s += 50) { const ux = (bx - ax) / L, uz = (bz - az) / L; const cx = ax + ux * s, cz = az + uz * s; const hw = 0.5, hl = 15; cellOf(cx, cz).marks.flatQuad(cx - uz * hw, cz + ux * hw, cx - uz * hw + ux * hl * 2, cz + ux * hw + uz * hl * 2, cx + uz * hw + ux * hl * 2, cz - ux * hw + uz * hl * 2, cx + uz * hw, cz - ux * hw, y + 0.02, rgb('#e8e8e8')); }
        }
    }

    // -----------------------------------------------------------------------
    //  ROADS
    // -----------------------------------------------------------------------
    setProgress('Paving the streets…'); await tick();
    // asphalt albedo (linear vertex colour): weathered asphalt is ≈ 0.09–0.15, so the road reads mid-grey in shade
    // and does not wash out in sun under ACES. Bucharest: lighter, sun-bleached, patched; Seattle: darker, wetter
    // asphalt, and Portland-cement concrete panels on the motorway main lines (I-5 / I-405 / SR-518).
    // (env.asphalt, the old near-black [7, 8, 9] in Seattle, is no longer used for carriageways)
    const ASPHALT = US ? '#535250' : '#5d5c5a', CONCRETE = '#7c7a76'; // (render's AgX + SH ambient target: albedo ≈ 0.08–0.12) // (slightly warm: the sky-lit shade is blue)
    const asphaltBase = rgb(ASPHALT), concreteCol = rgb(CONCRETE);
    const sideCol = shadeRgb(rgb(env.sidewalk), 0.8); // (QA r2: sidewalks read snow-white under AgX; paving albedo ≈ 0.3)
    const kerbCol = shadeRgb(rgb(env.sidewalk), 1.18);
    const white = rgb('#e9e9e6'), yellow = rgb('#e3b341'), busCol = rgb('#8a3b34'), railCol = rgb('#55524e'), ballastCol = rgb('#6d6861');
    const layerY = () => 0; // real heights are applied per vertex (node.y), see displace()
    const isConcrete = (e) => US && e.type === 'motorway';
    // US ramps: concrete where they leave / join the motorway (they overlap it at the gore), fading to asphalt over
    // 40–120 m along the ramp, so neither the gore nor the ramp terminal shows a two-colour slab (review #2)
    // distance along the ramps from the motorway (dM) and from the street network (dA): concrete at the motorway end,
    // asphalt at the street end, a smooth blend between (no light slab where an off-ramp meets an arterial deck)
    const rampDist = (seed) => {
        const dist = new Map(), q = [];
        for (const n of nodeArr) if (n.edges.some(seed)) { dist.set(n, 0); q.push(n); }
        while (q.length) {
            const n = q.shift(), d0 = dist.get(n);
            for (const e of n.edges) { if (e.type !== 'motorway_link' || e.virtual) continue; const o = e.a === n ? e.b : e.a, d = d0 + e.len; if (d < (dist.get(o) ?? Infinity) && d < 400) { dist.set(o, d); q.push(o); } }
        }
        return dist;
    };
    const dMot = US ? rampDist(isConcrete) : new Map(), dArt = US ? rampDist(e => !e.virtual && !/^motorway/.test(e.type)) : new Map();
    const mixCol = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    const nodeSurf = (n) => {
        const m = dMot.get(n); if (m == null) return asphaltBase;
        const a = dArt.get(n) ?? 400, t = clamp((m - 25) / Math.max(1, m + a - 50), 0, 1);
        return mixCol(concreteCol, asphaltBase, t * t * (3 - 2 * t));
    };
    const asphaltOf = (e) => { // (one shade per class family: overlapping ribbons of one colour cannot flicker)
        if (e.unpaved) return rgb('#6b645b');
        if (isConcrete(e)) return e.tunnel ? shadeRgb(concreteCol, 0.85) : concreteCol;
        return e.tunnel ? shadeRgb(asphaltBase, 0.85) : asphaltBase;
    };
    /** [colour at a, colour at b] of a carriageway (ramps fade) */
    const asphaltEnds = (e) => (US && e.type === 'motorway_link' && !e.tunnel) ? [nodeSurf(e.a), nodeSurf(e.b)] : [asphaltOf(e), asphaltOf(e)];
    const padAsphalt = (n) => { const es = n.edges.filter(f => !f.virtual); const cc = es.filter(isConcrete).length; if (cc * 2 >= es.length && cc) return concreteCol; if (es.length && es.every(f => f.tunnel)) return shadeRgb(asphaltBase, 0.85); return es.some(f => f.type === 'motorway_link') ? nodeSurf(n) : asphaltBase; };
    const isPadNode = (n) => {
        if (n.edges.length !== 2) return n.edges.length >= 3;
        const [e1, e2] = n.edges;
        const d1x = e1.b === n ? e1.dirx : -e1.dirx, d1z = e1.b === n ? e1.dirz : -e1.dirz; // e1 travelling into n
        const d2x = e2.a === n ? e2.dirx : -e2.dirx, d2z = e2.a === n ? e2.dirz : -e2.dirz; // e2 leaving n
        return d1x * d2x + d1z * d2z < 0.35; // sharp turn → pad
    };
    for (const n of nodeArr) n.pad = n.edges.length ? isPadNode(n) : false;
    const retract = (e, n) => (n.pad && (n.allEdges || n.edges).length >= 2 ? Math.min(n.radius, e.len * 0.45) : 0);
    /**
     * corner point of edge e at node n on side s (+1 = right of a→b, -1 = left) at lateral distance w (≥0) from the centreline;
     * at degree-2 nodes the corner is mitred with the other edge (whose matching width is wOther).
     */
    const corner = (e, n, s, w, wOtherFn) => {
        const out = e.a === n ? 1 : -1;
        const r = retract(e, n);
        const bx = n.x + e.dirx * out * r, bz = n.z + e.dirz * out * r;
        const px = bx + e.nx * s * w, pz = bz + e.nz * s * w;
        if (n.pad || n.edges.length !== 2) return [px, pz];
        const f = n.edges[0] === e ? n.edges[1] : n.edges[0];
        const same = (e.b === n && f.a === n) || (e.a === n && f.b === n);
        const sf = same ? s : -s;
        const wf = wOtherFn(f, sf);
        const qx = n.x + f.nx * sf * wf, qz = n.z + f.nz * sf * wf;
        // intersect p + t*e.dir and q + u*f.dir
        const cr = e.dirx * f.dirz - e.dirz * f.dirx;
        if (Math.abs(cr) < 0.02) return [(px + qx) / 2, (pz + qz) / 2];
        const t = ((qx - px) * f.dirz - (qz - pz) * f.dirx) / cr;
        const ix = px + e.dirx * t, iz = pz + e.dirz * t;
        if (Math.hypot(ix - n.x, iz - n.z) > Math.max(w, wf) * 2.5 + 1) return [(px + qx) / 2, (pz + qz) / 2];
        return [ix, iz];
    };
    const widthAsphalt = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e);
    const widthSide = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e) + e.sidewalk;
    const widthKerb = (e, s) => (s > 0 ? e.wR : e.wL) + shoulderOf(e) + 0.28;
    const padCorners = new Map(); // node -> {road:[], side:[]}
    const pushPad = (n, kind, p) => { let o = padCorners.get(n); if (!o) padCorners.set(n, o = { road: [], side: [], y: 0 }); o[kind].push(p); };

    const dashLine = (mb, e, s0, s1, off, y, col, dash, gap, hw) => {
        const step = dash + gap;
        for (let s = s0 + gap * 0.5; s < s1; s += step) {
            const sEnd = Math.min(s1, s + dash);
            if (sEnd - s < 0.3) continue;
            let ax = e.a.x + e.dirx * s + e.nx * off, az = e.a.z + e.dirz * s + e.nz * off;
            let bx = e.a.x + e.dirx * sEnd + e.nx * off, bz = e.a.z + e.dirz * sEnd + e.nz * off;
            // continuous lines follow the mitred strip: at a plain bend (degree-2, no pad) end on the mitre line
            if (gap === 0) {
                const mit = (n) => !n.pad && n.edges.length === 2 ? corner(e, n, off >= 0 ? 1 : -1, Math.abs(off), () => Math.abs(off)) : null;
                if (s < 0.05) { const q = mit(e.a); if (q) { ax = q[0]; az = q[1]; } }
                if (sEnd > e.len - 0.05) { const q = mit(e.b); if (q) { bx = q[0]; bz = q[1]; } }
            }
            mb.flatQuad(ax + e.nx * hw, az + e.nz * hw, bx + e.nx * hw, bz + e.nz * hw, bx - e.nx * hw, bz - e.nz * hw, ax - e.nx * hw, az - e.nz * hw, y, col, 0);
        }
    };
    const solidLine = (mb, e, s0, s1, off, y, col, hw) => { if (s1 - s0 > 0.2) dashLine(mb, e, s0, s1, off, y, col, Math.min(4, s1 - s0), 0, hw); }; // (4 m pieces: each is checked against other surfaces)
    const band = (mb, e, s0, s1, o0, o1, y, col) => {
        if (s1 - s0 < 0.2) return;
        const p = (s, o) => [e.a.x + e.dirx * s + e.nx * o, e.a.z + e.dirz * s + e.nz * o];
        const k = Math.max(1, Math.ceil((s1 - s0) / 6));
        for (let j = 0; j < k; j++) {
            const sa = s0 + (s1 - s0) * j / k, sb = s0 + (s1 - s0) * (j + 1) / k;
            const A = p(sa, o0), B = p(sb, o0), C = p(sb, o1), D = p(sa, o1);
            mb.flatQuad(A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1], y, col, 0);
        }
    };

    const lampSpots = [];
    const treeSpots = [];
    const zebraRects = []; // signalised-junction crossings drawn so far {e, rect}
    const convexOverlap = (A, B) => { // separating axis test, convex polygons [[x, z]…]
        for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
            const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], nx = bz - az, nz = ax - bx;
            let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
            for (const [x, z] of A) { const v = x * nx + z * nz; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
            for (const [x, z] of B) { const v = x * nx + z * nz; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
            if (a1 <= b0 || b1 <= a0) return false;
        }
        return true;
    };
    const ribbons = []; // carriageway polygons (asphalt incl. shoulder) of every edge + junction pads → definitive clearance checks
    const dash = US ? [3, 9] : [3, 5];
    const displace = (mb, from, fn) => { for (let i = from; i < mb.vc; i++) mb.p[i * 3 + 1] += fn(mb.p[i * 3], mb.p[i * 3 + 2]); };
    const raised = [];
    const convexRing = (r) => { let sg = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b2 = r[(i + 1) % r.length], c2 = r[(i + 2) % r.length]; const cr = (b2[0] - a[0]) * (c2[1] - b2[1]) - (b2[1] - a[1]) * (c2[0] - b2[0]); if (Math.abs(cr) < 1e-6) continue; const t = cr > 0 ? 1 : -1; if (sg && t !== sg) return false; sg = t; } return true; };
    /** the outline offset inward by d (mitred), shrinking d until it is a clean polygon: { p, d } or null */
    const insetCache = new WeakMap();
    const insetRing = (r, area) => {
        if (insetCache.has(r)) return insetCache.get(r);
        const A0 = signedArea(r), s0 = A0 > 0 ? 1 : -1, n = r.length; let res = null;
        const segX = (p, q, u, v) => { const d = (q[0] - p[0]) * (v[1] - u[1]) - (q[1] - p[1]) * (v[0] - u[0]); if (Math.abs(d) < 1e-9) return false; const t = ((u[0] - p[0]) * (v[1] - u[1]) - (u[1] - p[1]) * (v[0] - u[0])) / d, w = ((u[0] - p[0]) * (q[1] - p[1]) - (u[1] - p[1]) * (q[0] - p[0])) / d; return t > 1e-3 && t < 1 - 1e-3 && w > 1e-3 && w < 1 - 1e-3; };
        for (let d = clamp(Math.sqrt(Math.abs(area)) * 0.2, 1.2, 4.5); d >= 0.8 && !res; d *= 0.6) {
            const p = [];
            for (let i = 0; i < n; i++) {
                const a = r[(i - 1 + n) % n], b2 = r[i], c2 = r[(i + 1) % n];
                const l1 = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1, l2 = Math.hypot(c2[0] - b2[0], c2[1] - b2[1]) || 1;
                const n1 = [-s0 * (b2[1] - a[1]) / l1, s0 * (b2[0] - a[0]) / l1], n2 = [-s0 * (c2[1] - b2[1]) / l2, s0 * (c2[0] - b2[0]) / l2]; // inward normals
                let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz); if (ml < 1e-6) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
                const k = d / Math.max(0.35, mx * n1[0] + mz * n1[1]); p.push([b2[0] + mx * k, b2[1] + mz * k]);
            }
            const A1 = signedArea(p); if (Math.sign(A1) !== s0 || Math.abs(A1) < Math.abs(A0) * 0.12) continue;
            let bad = false; for (let i = 0; i < n && !bad; i++) for (let j = i + 2; j < n && !bad; j++) { if (i === 0 && j === n - 1) continue; if (segX(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) bad = true; }
            if (!bad && p.some(q => !pointInPolygon(q[0], q[1], r))) bad = true;
            if (!bad) res = { p, d };
        }
        insetCache.set(r, res); return res;
    };
    const polyDist = (x, z, poly) => { let d = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distPointSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d); return d; };
    // ---- pass 1: every carriageway polygon (mitred at degree-2 nodes, cut back to the pad at junctions) and every
    //      junction pad (hull of the incoming ribbon corners), so pass 2 can keep kerbs / markings off any OTHER
    //      surface (dual carriageways that touch, slip lanes, pads): one visible surface per spot, no marking over it
    const ribPoly = new Map(), surfGrid = new BoxGrid(24);
    {
        const padPts = new Map();
        for (const e of edges) {
            if (e.virtual) continue;
            const aR = corner(e, e.a, 1, widthAsphalt(e, 1), widthAsphalt), aL = corner(e, e.a, -1, widthAsphalt(e, -1), widthAsphalt);
            const bR = corner(e, e.b, 1, widthAsphalt(e, 1), widthAsphalt), bL = corner(e, e.b, -1, widthAsphalt(e, -1), widthAsphalt);
            // a mitre longer than a short edge folds that side over itself (bow-tie / flipped quad, review #22): collapse
            // the folded side to its midpoint (a triangle) instead
            for (const [P, Q] of [[aR, bR], [aL, bL]]) if ((Q[0] - P[0]) * e.dirx + (Q[1] - P[1]) * e.dirz < 0.05) { const mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2; P[0] = Q[0] = mx; P[1] = Q[1] = mz; }
            const poly = [aR, bR, bL, aL]; ribPoly.set(e, poly);
            for (const [n, p, q] of [[e.a, aR, aL], [e.b, bR, bL]]) if (n.pad) { let o = padPts.get(n); if (!o) padPts.set(n, o = []); o.push(p, q); }
        }
        const ins = (o, poly) => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } Object.assign(o, { poly, x0, z0, x1, z1 }); surfGrid.insert(x0, z0, x1, z1, o); };
        for (const [e, poly] of ribPoly) ins({ e, h: (x, z) => yAlong(e, x, z) }, poly);
        for (const [n, pts] of padPts) if (pts.length >= 3) ins({ node: n, h: (x, z) => padHeightAt(n, x, z) }, convexHull(pts));
    }
    /** is (x, z) at height y well inside a road surface other than edge e's own ribbon? (inset m from its rim) */
    // prio (markings): where two carriageways overlap in plan (a ramp along its motorway at a split / merge, the two
    // directions of a road mapped too close), only the higher-class one (then the lower id) keeps its markings, so the
    // overlap reads as one road with one set of lines instead of a slab with none (review #3 / #4); pads always win
    const markWins = (e, f) => { if (Math.abs(e.dirx * f.dirx + e.dirz * f.dirz) < 0.94) return false; const re = CLASS_RANK[e.type] || 0, rf = CLASS_RANK[f.type] || 0; return re !== rf ? re > rf : e.id < f.id; }; // (near-parallel overlaps only: a road crossing at grade keeps its mouth clear)
    const coveredByOther = (x, z, e, y, inset = 0.25, prio = false) => {
        let hit = false;
        surfGrid.each(x, z, x, z, (o) => {
            if (hit || o.e === e || x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) return;
            if (prio && o.e && markWins(e, o.e)) return;
            if (Math.abs(o.h(x, z) - y) > 1.0 || !pointInPolygon(x, z, o.poly) || polyDist(x, z, o.poly) < inset) return;
            hit = true;
        });
        return hit;
    };
    /** a MeshBuilder proxy for edge e's markings: quads whose centre lies on another surface (pad, touching carriageway) are dropped */
    //   (2026-11-07) and every corner must lie on the edge's own carriageway (± 5 cm): pieces that stick out of it
    //   (edge lines over the sidewalk past a mitre, bus bands where the ribbon narrows) are halved along their
    //   length until they fit or are shorter than 0.5 m (then dropped)
    const onOwn = (e, x, z, tol = 0.05) => { const p = ribPoly.get(e); return !p || pointInPolygon(x, z, p) || polyDist(x, z, p) < tol; };
    const markProxy = (mb, e) => ({
        flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS, depth = 0) {
            const cx = (x0 + x1 + x2 + x3) / 4, cz = (z0 + z1 + z2 + z3) / 4;
            const qa = depth ? 0 : Math.abs((x2 - x0) * (z3 - z1) - (x3 - x1) * (z2 - z0)) / 2; if (qa) e._mkAll = (e._mkAll || 0) + qa; // (stats: share dropped per edge)
            if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), 0.15, true)) { if (qa) e._mkDrop = (e._mkDrop || 0) + qa; return; }
            const ok = (x, z) => onOwn(e, x, z) && !coveredByOther(x, z, e, yAlong(e, x, z), 0.15, true);
            if (!(ok(x0, z0) && ok(x1, z1) && ok(x2, z2) && ok(x3, z3))) {
                const dropQ = () => { e._mkOut = (e._mkOut || 0) + Math.abs((x2 - x0) * (z3 - z1) - (x3 - x1) * (z2 - z0)) / 2; };
                if (!onOwn(e, cx, cz) && depth > 0) { dropQ(); return; }
                if (depth >= 3 || Math.hypot(x1 - x0, z1 - z0) < 0.5) { dropQ(); return; }
                const ax = (x0 + x1) / 2, az = (z0 + z1) / 2, bx = (x2 + x3) / 2, bz = (z2 + z3) / 2;
                this.flatQuad(x0, z0, ax, az, bx, bz, x3, z3, y, col, uvS, depth + 1);
                this.flatQuad(ax, az, x1, z1, x2, z2, bx, bz, y, col, uvS, depth + 1);
                return;
            }
            mb.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS);
        },
    });
    // (2026-11-08, owner: "parked cars look sunk", then "do the sidewalks") realPass districts: sidewalks at the kerb's height
    // (Y.road + Y.kerb) instead of 0.22 m below it — the top of every sidewalk band, the junction corners between them, the
    // physics (surfacesAt → walkers, the car mounting a kerb), the crowd and everything standing on a sidewalk (DY_SIDE)
    const raisedEdge = (e) => realPass && !e.virtual && e.sidewalk > 0.3 && !/motorway|trunk/.test(e.type) && !e.tunnel && !e.bridge;
    const DY_SIDE = Y.road + Y.kerb - Y.side; // props stand at Y.side (+ profile): raised by this on a raised sidewalk
    const sideJoins = new Map(); // pad node → [{ e, asph, outer }] sidewalk ends meeting at a junction
    const cornerPolys = [], cornerGrid = new BoxGrid(24); // raised junction corners {p, n, x0..z1}
    let raisedPieces = 0; const cornerSkips = []; // (stats: why a junction corner was left low)
    const SIDE_BACK = 0.3; // the raised top runs this far past the property line (fences / hedges there stand on it)
    for (const e of edges) {
        if (e.virtual) continue; // invisible U-turn connectors
        const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
        const c = cellOf(mx, mz);
        const v0g = c.ground.vc, v0m = c.marks.vc, v0s = c.solid.vc, v0p = c.road.vc;
        const elevated = Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01;
        if (elevated) raised.push(e);
        const ly = layerY(e);
        const yR = Y.road + ly, yS = Y.side + ly, yM = Y.road + ly + Y.mark;
        const [aR, bR, bL, aL] = ribPoly.get(e);
        { const [ca, cb] = asphaltEnds(e); const mb = c.road, u = 0.15;
          const i0 = mb.v(aR[0], yR, aR[1], 0, 1, 0, aR[0] * u, aR[1] * u, ca), i1 = mb.v(bR[0], yR, bR[1], 0, 1, 0, bR[0] * u, bR[1] * u, cb);
          const i2 = mb.v(bL[0], yR, bL[1], 0, 1, 0, bL[0] * u, bL[1] * u, cb), i3 = mb.v(aL[0], yR, aL[1], 0, 1, 0, aL[0] * u, aL[1] * u, ca);
          mb.triUp(i0, i1, i2); mb.triUp(i0, i2, i3); }
        ribbons.push({ e, poly: [aR, bR, bL, aL] });
        // sidewalks
        const hasSide = e.sidewalk > 0.3;
        if (!hasSide && (e.bridge || elevated) && !e.tunnel) {
            // (round 6 note 52) decks / ramps without a walkway: a concrete edge strip from the asphalt to under the barrier
            // (it stands 0.3 m out) — the gap showed the ground / the void below the deck as a black band
            // per side, and only where the strip would not lie over another road (a gore with a ramp at another height)
            const wE = (ed, sd) => widthAsphalt(ed, sd) + 0.45, wI = (ed, sd) => Math.max(0.1, widthAsphalt(ed, sd) - 0.05);
            for (const sd of [1, -1]) {
                let clear = true;
                for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
                    const px = e.a.x + (e.b.x - e.a.x) * t + e.nx * wE(e, sd) * sd, pz = e.a.z + (e.b.z - e.a.z) * t + e.nz * wE(e, sd) * sd, py = e.ya + (e.yb - e.ya) * t;
                    edgesInBox(px - 1, pz - 1, px + 1, pz + 1, (f) => { if (!clear || f === e || f.virtual) return; const q = distPointSeg(px, pz, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.d < Math.max(f.wL, f.wR) + shoulderOf(f) && Math.abs(f.ya + (f.yb - f.ya) * q.t - py) > 0.05) clear = false; });
                    if (!clear) break;
                }
                if (!clear) continue;
                const oa = corner(e, e.a, sd, wE(e, sd), wE), ob = corner(e, e.b, sd, wE(e, sd), wE), ia = corner(e, e.a, sd, wI(e, sd), wI), ib = corner(e, e.b, sd, wI(e, sd), wI);
                c.ground.flatQuad(ia[0], ia[1], ib[0], ib[1], ob[0], ob[1], oa[0], oa[1], yR - 0.02, shadeRgb(sideCol, 0.82), 0.25);
            }
        }
        if (hasSide) {
            const sa = corner(e, e.a, 1, widthSide(e, 1), widthSide), sb = corner(e, e.b, 1, widthSide(e, 1), widthSide);
            const ta = corner(e, e.a, -1, widthSide(e, -1), widthSide), tb = corner(e, e.b, -1, widthSide(e, -1), widthSide);
            c.ground.flatQuad(sa[0], sa[1], sb[0], sb[1], tb[0], tb[1], ta[0], ta[1], yS, e.bridge ? shadeRgb(sideCol, 0.9) : sideCol, 0.25);
            if (e.a.pad) { pushPad(e.a, 'side', sa); pushPad(e.a, 'side', ta); }
            if (e.b.pad) { pushPad(e.b, 'side', sb); pushPad(e.b, 'side', tb); }
            // kerbs: raised strip + vertical face along both edges
            if (!/motorway|trunk/.test(e.type) && !e.tunnel) {
                for (const s of [1, -1]) {
                    const ia = s > 0 ? aR : aL, ib = s > 0 ? bR : bL;
                    const oa = corner(e, e.a, s, widthKerb(e, s), widthKerb), ob = corner(e, e.b, s, widthKerb(e, s), widthKerb);
                    const top = yR + Y.kerb;
                    // in ~4 m pieces; a piece that would stand on another carriageway / pad (a touching dual carriageway,
                    // a slip lane, a junction) is left out: the kerb never cuts across asphalt
                    const L = Math.max(Math.hypot(ib[0] - ia[0], ib[1] - ia[1]), Math.hypot(ob[0] - oa[0], ob[1] - oa[1]));
                    const k = Math.max(1, Math.ceil(L / 4));
                    const lp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
                    // (a piece with a corner on another surface is split in 1 m pieces, each tested on all four corners:
                    //  no kerb strip reaches into a crossing carriageway — review #8)
                    const cov = (p) => coveredByOther(p[0], p[1], e, yAlong(e, p[0], p[1]), 0.02);
                    // (2026-11-08, realPass districts) the sidewalk itself at the kerb's height: its top from the kerb strip to the
                    // property line + a face down to the ground at its back (the paving used to lie 0.22 m below the kerb top)
                    const raise = raisedEdge(e), wbk = (f, sf) => widthSide(f, sf) + SIDE_BACK;
                    const sa2 = raise ? corner(e, e.a, s, wbk(e, s), wbk) : null, sb2 = raise ? corner(e, e.b, s, wbk(e, s), wbk) : null;
                    const piece = (i0, i1, o0, o1) => {
                        c.ground.flatQuad(i0[0], i0[1], i1[0], i1[1], o1[0], o1[1], o0[0], o0[1], top, kerbCol, 0.25);
                        c.ground.wall(i0[0], i0[1], i1[0], i1[1], yR - 0.01, top, -e.nx * s, -e.nz * s, shadeRgb(kerbCol, 0.85));
                    };
                    for (let j = 0; j < k; j++) {
                        const i0 = lp(ia, ib, j / k), i1 = lp(ia, ib, (j + 1) / k), o0 = lp(oa, ob, j / k), o1 = lp(oa, ob, (j + 1) / k);
                        const cx = (i0[0] + i1[0] + o0[0] + o1[0]) / 4, cz = (i0[1] + i1[1] + o0[1] + o1[1]) / 4;
                        if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), 0.05)) continue;
                        if (!cov(i0) && !cov(i1) && !cov(o0) && !cov(o1)) { piece(i0, i1, o0, o1); continue; }
                        const m = Math.max(1, Math.ceil(Math.hypot(i1[0] - i0[0], i1[1] - i0[1])));
                        for (let q = 0; q < m; q++) {
                            const a0 = lp(i0, i1, q / m), a1 = lp(i0, i1, (q + 1) / m), b0 = lp(o0, o1, q / m), b1 = lp(o0, o1, (q + 1) / m);
                            if (!cov(a0) && !cov(a1) && !cov(b0) && !cov(b1)) piece(a0, a1, b0, b1);
                        }
                    }
                    if (raise) { // the raised sidewalk top, kerb strip → property line + SIDE_BACK: sampled densely (a side street,
                        //          a driveway, a median, a pad between two corners is never paved over), 0.8 m pieces near them
                        const swq = (o0, o1, w0, w1) => {
                            c.ground.flatQuad(o0[0], o0[1], o1[0], o1[1], w1[0], w1[1], w0[0], w0[1], top, sideCol, 0.25);
                            c.ground.wall(w0[0], w0[1], w1[0], w1[1], Y.landuse - 0.02, top, e.nx * s, e.nz * s, shadeRgb(sideCol, 0.8));
                            raisedPieces++;
                        };
                        const clear = (o0, o1, w0, w1, fs) => { for (const f of fs) { const p1 = lp(o0, o1, f), p2 = lp(w0, w1, f); if (cov(p1) || cov(p2) || cov(lp(p1, p2, 0.5))) return false; } return true; };
                        const F5 = [0, 0.25, 0.5, 0.75, 1], F3 = [0, 0.5, 1];
                        for (let j = 0; j < k; j++) {
                            const o0 = lp(oa, ob, j / k), o1 = lp(oa, ob, (j + 1) / k), w0 = lp(sa2, sb2, j / k), w1 = lp(sa2, sb2, (j + 1) / k);
                            if (clear(o0, o1, w0, w1, F5)) { swq(o0, o1, w0, w1); continue; }
                            const m = Math.max(1, Math.ceil(Math.hypot(o1[0] - o0[0], o1[1] - o0[1]) / 0.8));
                            for (let q = 0; q < m; q++) { const a0 = lp(o0, o1, q / m), a1 = lp(o0, o1, (q + 1) / m), b0 = lp(w0, w1, q / m), b1 = lp(w0, w1, (q + 1) / m); if (clear(a0, a1, b0, b1, F3)) swq(a0, a1, b0, b1); }
                        }
                    }
                    if (raise) for (const n of [e.a, e.b]) { // a raised sidewalk that just stops (dead end, map edge): close its end
                        if (n.pad || n.edges.filter(f => !f.virtual).length !== 1) continue;
                        const [ki, wo] = n === e.a ? [oa, sa2] : [ob, sb2], ri = n === e.a ? ia : ib, out = n === e.a ? -1 : 1;
                        c.ground.wall(ri[0], ri[1], wo[0], wo[1], Y.landuse - 0.02, top, e.dirx * out, e.dirz * out, shadeRgb(sideCol, 0.8));
                    }
                    if (raise) for (const n of [e.a, e.b]) if (n.pad) { // corner pieces at the junction (drawn with the pads)
                        let L2 = sideJoins.get(n); if (!L2) sideJoins.set(n, L2 = []);
                        L2.push({ e, asph: n === e.a ? ia : ib, outer: n === e.a ? sa2 : sb2 });
                    }
                }
            }
        }
        if (e.a.pad) { pushPad(e.a, 'road', aR); pushPad(e.a, 'road', aL); }
        if (e.b.pad) { pushPad(e.b, 'road', bR); pushPad(e.b, 'road', bL); }
        // ---- markings
        const s0 = retract(e, e.a), s1 = e.len - retract(e, e.b);
        if (s1 - s0 > 1 && !e.unpaved && e.type !== 'service') {
            const m = markProxy(c.marks, e), hw = 0.07;
            const minor = e.type === 'residential' || e.type === 'living_street' || e.type === 'unclassified' || e.type === 'service';
            const med2 = e.median / 2;
            // bus lanes (outermost lane each way)
            if (e.busLane && !/motorway|trunk/.test(e.type)) {
                if (realPass) { // (2026-11-08, Street View walk of Calea Floreasca) plain asphalt behind a wide solid line, not red paint (red only on the boulevards that have it)
                    const wl = rgb('#ecebe6');
                    if (e.lanesF > 1) { const o = med2 + e.laneW * (e.lanesF - 1); band(m, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                    if (e.lanesB > 1) { const o = -(med2 + e.laneW * (e.lanesB - 1)); band(m, e, s0, s1, o - 0.13, o + 0.13, yM - 0.002, wl); }
                } else {
                    if (e.lanesF > 1) band(m, e, s0, s1, med2 + e.laneW * (e.lanesF - 1), med2 + e.laneW * e.lanesF, yM - 0.004, busCol);
                    if (e.lanesB > 1) band(m, e, s0, s1, -(med2 + e.laneW * (e.lanesB - 1)), -(med2 + e.laneW * e.lanesB), yM - 0.004, busCol);
                }
            }
            // surface texture: transverse joints on concrete motorways (US, ~4.6 m panels); patched asphalt (repair
            // patches: Bucharest many, darker / lighter rectangles; Seattle a few dark sealed ones)
            if (isConcrete(e)) {
                const jc = shadeRgb(concreteCol, 0.72);
                for (let s = s0 + 2.3; s < s1 - 0.5; s += 4.6) band(m, e, s - 0.03, s + 0.03, -e.wL + 0.05, e.wR - 0.05, yM - 0.008, jc);
            } else if (!e.tunnel && e.len > 8) {
                const pr = makeRng(e.id * 7919 + 101), per = US ? 90 : minor ? 22 : 34;
                const n = Math.floor((s1 - s0) / per + pr());
                for (let q = 0; q < n; q++) {
                    const L = pr.range(1.2, US ? 4 : 7), sa = pr.range(s0 + 0.5, Math.max(s0 + 0.6, s1 - L - 0.5));
                    const wR2 = e.wR - 0.3, wL2 = -(e.wL - 0.3); if (wR2 - wL2 < 2) break;
                    const W = Math.min(wR2 - wL2, pr.range(0.9, e.laneW * 1.1)), o = pr.range(wL2, wR2 - W);
                    const pc = shadeRgb(asphaltBase, US ? 0.72 : pr.chance(0.6) ? 0.74 : 1.12);
                    band(m, e, sa, sa + L, o, o + W, yM - 0.008, pc);
                }
            }
            // lane dividers
            // (2026-11-08, owner: "some roads still don't have proper lines", Calea Floreasca by PAUL) a one-way carriageway
            // built wider than its lane count (lanes tag < the real width) left a whole unmarked lane: mark the lanes evenly
            // over the real width instead
            const Wc = e.wL + e.wR, nEff = e.oneway ? Math.round(Wc / e.laneW) : 0;
            if (e.oneway && nEff > e.lanesF && Wc - e.lanesF * e.laneW > e.laneW * 0.7) {
                for (let i = 1; i < nEff; i++) dashLine(m, e, s0, s1, -e.wL + Wc * i / nEff, yM, white, dash[0], dash[1], hw);
            } else if (!minor || e.lanesF > 1 || e.lanesB > 1) {
                for (let i = 1; i < e.lanesF; i++) dashLine(m, e, s0, s1, med2 + e.laneW * i, yM, white, dash[0], dash[1], hw * (/motorway/.test(e.type) ? 1.4 : 1));
                for (let i = 1; i < e.lanesB; i++) dashLine(m, e, s0, s1, -(med2 + e.laneW * i), yM, white, dash[0], dash[1], hw);
            }
            // centre
            if (!e.oneway) {
                const cc = US ? yellow : white;
                if (e.median > 0.5) {
                    // median: tram bed or concrete divider
                    band(m, e, s0, s1, -med2 + 0.15, med2 - 0.15, yM - 0.006, e.tramMedian ? ballastCol : rgb('#8d8a84'));
                    solidLine(m, e, s0, s1, med2, yM, cc, hw); solidLine(m, e, s0, s1, -med2, yM, cc, hw);
                } else if (US && !minor) { solidLine(m, e, s0, s1, 0.13, yM, cc, 0.06); solidLine(m, e, s0, s1, -0.13, yM, cc, 0.06); }
                else if (!US && !minor) {
                    if (e.lanesF + e.lanesB >= 4) { solidLine(m, e, s0, s1, 0.12, yM, cc, 0.06); solidLine(m, e, s0, s1, -0.12, yM, cc, 0.06); }
                    else if (e.lanesF + e.lanesB >= 3) solidLine(m, e, s0, s1, 0, yM, cc, hw);
                    else dashLine(m, e, s0, s1, 0, yM, cc, dash[0], dash[1], hw);
                }
            }
            // edge lines
            if (!minor) {
                solidLine(m, e, s0, s1, e.wR - 0.15, yM, white, 0.08);
                solidLine(m, e, s0, s1, -(e.wL - 0.15), yM, (US && e.oneway && /motorway|trunk/.test(e.type)) ? yellow : white, 0.08);
            }
            // stop lines at lights / stop signs
            for (const end of [e.a, e.b]) {
                if (!(end.hasLight || end.stop || end.giveWay) || end.edges.length < 2) continue;
                const atA = end === e.a;
                const incoming = atA ? !e.oneway : true;
                if (!incoming) continue;
                const r = retract(e, end) + 0.8;
                const s = atA ? r : e.len - r;
                const wIn = atA ? -(med2 + e.lanesB * e.laneW) : med2 + e.lanesF * e.laneW;
                const o0 = atA ? -Math.max(0, med2) : (e.oneway ? med2 : Math.max(0, med2));
                if (end.giveWay && !end.hasLight) { for (let k = 0; k < 6; k++) { const oo = o0 + (wIn - o0) * (k + 0.5) / 6; band(m, e, s - 0.25, s + 0.25, oo - 0.25, oo + 0.25, yM + 0.002, white); } }
                else band(m, e, s - 0.25, s + 0.25, o0, wIn, yM + 0.002, white);
            }
            // zebra crossings at signalised junctions (in front of the stop line) and at marked crossings
            for (const end of [e.a, e.b]) {
                const atA = end === e.a;
                if (end.hasLight && end.edges.length >= 3) {
                    const r = retract(e, end) + 2.0;
                    // skewed approaches: a crossing that would overlap another approach's crossing steps back (≤ 3 m) or is left out
                    let sc = null;
                    for (const back of [0, 1.5, 3]) {
                        const s2 = atA ? r + 1.3 + back : e.len - r - 1.3 - back;
                        if (s2 < 1 || s2 > e.len - 1) break;
                        const P = (s, o) => [e.a.x + e.dirx * s + e.nx * o, e.a.z + e.dirz * s + e.nz * o];
                        const rect = [P(s2 - 1.5, -e.wL), P(s2 + 1.5, -e.wL), P(s2 + 1.5, e.wR), P(s2 - 1.5, e.wR)];
                        if (zebraRects.some(z => z.e !== e && convexOverlap(z.rect, rect))) continue;
                        zebraRects.push({ e, rect }); sc = s2; break;
                    }
                    if (sc === null) continue;
                    for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(m, e, sc - 1.4, sc + 1.4, k, k + 0.5, yM + 0.004, white);
                }
            }
        }
        // zebra at degree-2 crossing nodes (drawn once by the edge leaving the node)
        if (e.a.zebra && e.a.edges.length === 2 && e.a.edges[0] === e && !e.unpaved) { // (on this edge's own ribbon: markings are clipped to it)
            const z0 = e.len > 4 ? 0.1 : -1.4, z1 = e.len > 4 ? 2.9 : 1.4;
            for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(markProxy(c.marks, e), e, z0, z1, k, k + 0.5, yM + 0.004, white);
        }
        // bridges: railings
        if (e.bridge) {
            for (const s of [1, -1]) {
                const pa = corner(e, e.a, s, widthAsphalt(e, s) + 0.3, widthAsphalt), pb = corner(e, e.b, s, widthAsphalt(e, s) + 0.3, widthAsphalt);
                // in ~3 m pieces; a piece standing on another deck / carriageway at this level (two ways mapped side by
                // side on one viaduct, a merging ramp) is left out — no parapet fins across a deck (upb route, Basarab)
                const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), k = Math.max(1, Math.ceil(L / 3));
                for (let j = 0; j < k; j++) {
                    const A = [pa[0] + (pb[0] - pa[0]) * j / k, pa[1] + (pb[1] - pa[1]) * j / k], B = [pa[0] + (pb[0] - pa[0]) * (j + 1) / k, pa[1] + (pb[1] - pa[1]) * (j + 1) / k];
                    const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
                    if (coveredByOther(mx, mz, e, yAlong(e, mx, mz), 0.1)) continue;
                    c.solid.wall(A[0], A[1], B[0], B[1], yR, yR + 1.1, e.nx * s, e.nz * s, rgb('#9aa3ad'));
                    c.solid.wall(A[0], A[1], B[0], B[1], yR, yR + 1.1, -e.nx * s, -e.nz * s, rgb('#8a939d'));
                    c.solid.flatQuad(A[0], A[1], B[0], B[1], B[0] + e.nx * s * 0.3, B[1] + e.nz * s * 0.3, A[0] + e.nx * s * 0.3, A[1] + e.nz * s * 0.3, yR + 1.1, rgb('#b0b8c0'), 0, -1);
                }
            }
        }
        // motorway barriers (only along plain stretches)
        if (/^(motorway|trunk)$/.test(e.type) && !e.a.pad && !e.b.pad && e.a.edges.length === 2 && e.b.edges.length === 2 && !e.bridge && !e.tunnel) {
            const sides = e.oneway ? [1, -1] : [1, -1];
            for (const s of sides) {
                const pa = corner(e, e.a, s, widthAsphalt(e, s) + 0.2, widthAsphalt), pb = corner(e, e.b, s, widthAsphalt(e, s) + 0.2, widthAsphalt);
                const col = rgb('#a7a9a6');
                c.solid.wall(pa[0], pa[1], pb[0], pb[1], yR, yR + 0.85, -e.nx * s, -e.nz * s, col);
                c.solid.wall(pa[0], pa[1], pb[0], pb[1], yR, yR + 0.85, e.nx * s, e.nz * s, shadeRgb(col, 0.9));
            }
        }
        // street furniture spots (lamps on the outer edge of the sidewalk, trees in pits on wide sidewalks)
        const big = /^(trunk|primary|secondary)$/.test(e.type) && !e.tunnel;
        const treeStreet = city.treeStreets && city.treeStreets.test(e.name);
        // (2026-11-08) Bucharest district worlds: residential streets are lit too (concrete poles with a bracket lamp, one
        // side, ≈ 32 m) — OSM maps neither the lamps nor lit=yes on most of Floreasca's streets
        const resLamp = !US && realPass && /^(residential|unclassified|living_street)$/.test(e.type);
        const lampRoad = !e.tunnel && !e.unlit && (e.lit || big || (/tertiary/.test(e.type) && !US) || resLamp);
        if (e.len > 12) {
            const ra = retract(e, e.a) + 5, rb = e.len - retract(e, e.b) - 5;
            if (lampRoad && (!/motorway/.test(e.type) || e.lit)) {
                const step = big ? 34 : resLamp ? 32 : 28, hh = big || /motorway|trunk/.test(e.type) ? 8 : 6;
                for (let s = ra + ((e.id * 7) % step); s < rb; s += step) {
                    for (const sd of (resLamp ? [((e.road * 7) % 2) ? 1 : -1] : e.oneway && e.lanesF <= 1 ? [1] : [1, -1])) {
                        const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e);
                        const yl = e.ya + (e.yb - e.ya) * s / e.len;
                        const o = e.bridge || Math.abs(yl) > 0.3 ? w + 0.35 : e.sidewalk >= 1.2 ? w + Math.max(0.55, e.sidewalk - 0.45) : w + 1.0; // (on ramps / in trenches: on the deck edge, inside the walls)
                        lampSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, Math.atan2(e.nz * sd, -e.nx * sd), e.ya + (e.yb - e.ya) * s / e.len, hh, e, sd]);
                    }
                }
            }
            // procedural street-tree rows where OSM maps few trees (tree coverage is very uneven between districts):
            // research notes first, then the city's known tree-lined streets, then defaults by road class: Bucharest
            // boulevards and residential / tertiary streets with ≥ 3 m sidewalks, Seattle / Bellevue downtown tree pits.
            // Rows keep clear of junction sight lines (12 m from the pad); the OSM trees nearby win (placeTree dedups).
            const rt = researchTrees.get(e.name);
            const dtUS = US && (e.sidewalk >= 2.5) && /^(primary|secondary|tertiary|residential)$/.test(e.type);
            const roRes = !US && /^(tertiary|residential|unclassified)$/.test(e.type) && e.sidewalk >= 3 && (((e.road * 2654435761) >>> 0) % 100) < 60;
            const rowOK = !e.bridge && !elevated && e.sidewalk >= 2.2 && !rt?.none && (rt || treeStreet || (big && e.sidewalk >= 3 && !US) || roRes || dtUS);
            if (rowOK) {
                const step = rt || treeStreet ? rng.range(7, 9) : roRes ? rng.range(8, 11) : dtUS ? 9 : 10;
                const sp = rt?.species?.length ? rt.species[((e.road * 40503) >>> 0) % rt.species.length] : null;
                const s0 = retract(e, e.a) + 12, s1 = e.len - retract(e, e.b) - 12;
                for (let s = s0 + 2; s < s1; s += step * rng.range(0.9, 1.1)) for (const sd of [1, -1]) {
                    const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + clamp(e.sidewalk * 0.45, 1.0, 2.2);
                    treeSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, rng.range(0.8, 1.2), 'street', e.road, sp]);
                }
            }
        }
        // painted bike lanes (on the carriageway, outermost 1.5 m) and cycle tracks (on the sidewalk)
        if ((e.bikeLane || e.cycleTrack) && !e.tunnel && e.len > 4) {
            const s0b = retract(e, e.a), s1b = e.len - retract(e, e.b);
            const bc = rgb(US ? '#3f7f52' : '#9e4a3e');
            for (const sd of (e.oneway ? [1] : [1, -1])) {
                const w = sd > 0 ? e.wR : e.wL;
                if (e.bikeLane && w > 4.5) band(c.marks, e, s0b, s1b, sd * (w - 1.6), sd * (w - 0.2), yM - 0.003, bc);
                else if (e.cycleTrack && e.sidewalk >= 2.2) { const o = w + shoulderOf(e); band(c.marks, e, s0b, s1b, sd * (o + e.sidewalk - 1.7), sd * (o + e.sidewalk - 0.3), raisedEdge(e) ? Y.road + Y.kerb + 0.006 : yS + 0.01, shadeRgb(bc, 1.1)); }
            }
        }
        if (elevated) { const f = (x, z) => yAlong(e, x, z); displace(c.ground, v0g, f); displace(c.road, v0p, f); displace(c.marks, v0m, f); displace(c.solid, v0s, f); }
    }
    // ---- turn arrows (OSM turn:lanes) painted in each lane 9 m before the junction a way ends at (R11.3)
    {
        const tl = data.turnLanes || [];
        const arrow = (mb, e, s, lat, dirSign, kinds, y) => {
            // local frame: forward f (travel), right r; arrow 4.5 m long, ending at s (travel direction dirSign)
            const fx = e.dirx * dirSign, fz = e.dirz * dirSign, rx = -fz, rz = fx; // (n of the travel direction: right-hand)
            const bx0 = e.a.x + e.dirx * s + e.nx * lat, bz0 = e.a.z + e.dirz * s + e.nz * lat; // arrow tip end
            const P2 = (a, b) => [bx0 + fx * a + rx * b, bz0 + fz * a + rz * b]; // a along travel (≤ 0 behind the tip), b to the right
            const quad = (p, q, r2, t) => mb.flatQuad(p[0], p[1], q[0], q[1], r2[0], r2[1], t[0], t[1], y, white, 0);
            const thr = kinds.includes('through'), lft = kinds.includes('left') || kinds.includes('slight_left'), rgt = kinds.includes('right') || kinds.includes('slight_right');
            quad(P2(-4.5, -0.08), P2(thr ? -1.1 : -2.0, -0.08), P2(thr ? -1.1 : -2.0, 0.08), P2(-4.5, 0.08)); // stem
            if (thr) quad(P2(-1.3, -0.38), P2(0, 0), P2(0, 0), P2(-1.3, 0.38));
            for (const sd of [lft ? -1 : 0, rgt ? 1 : 0]) {
                if (!sd) continue;
                quad(P2(-2.15, 0), P2(-1.95, 0), P2(-1.95, sd * 0.85), P2(-2.15, sd * 0.85)); // arm
                quad(P2(-2.55, sd * 0.85), P2(-2.05, sd * 1.4), P2(-2.05, sd * 1.4), P2(-1.55, sd * 0.85)); // head
            }
        };
        const roadEdges = new Map(); for (const e of edges) if (!e.virtual) { let l = roadEdges.get(e.road); if (!l) roadEdges.set(e.road, l = []); l.push(e); }
        for (let i = 0; i + 2 < tl.length; i += 3) {
            const ri = tl[i], fw = str(tl[i + 1]).split('|'), bw = str(tl[i + 2]).split('|'), rd = roads[ri], es = roadEdges.get(ri); if (!rd || !es) continue;
            const last = nodeArr[rd.ids[rd.ids.length - 1]], first = nodeArr[rd.ids[0]];
            for (const [end, lanes, fwd] of [[last, fw, true], [first, bw, false]]) {
                if (!lanes.some(l => /left|right/.test(l)) || end.mapEnd || (end.allEdges || end.edges).length < 3) continue;
                const e = es.find(f => f.b === end || f.a === end); if (!e || e.type === 'service') continue;
                const dirSign = e.b === end ? 1 : -1; // travel toward `end`
                const n = dirSign > 0 ? e.lanesF : e.lanesB; if (!n || lanes.length !== n) continue;
                const sStop = dirSign > 0 ? e.len - retract(e, e.b) - 9 : retract(e, e.a) + 9; if (sStop < 6 || sStop > e.len - 6) continue;
                const c = cellOf(e.a.x + e.dirx * sStop, e.a.z + e.dirz * sStop), mb = markProxy(c.marks, e), v0 = c.marks.vc;
                const med2 = e.median / 2;
                lanes.forEach((k, j) => { // j = 0 is the leftmost lane in the travel direction
                    const lat = dirSign > 0 ? med2 + e.laneW * (j + 0.5) : -(Math.max(0, med2) + e.laneW * (j + 0.5));
                    if (k && k !== 'none') arrow(mb, e, sStop, lat, dirSign, k.split(';'), Y.road + Y.mark + 0.003);
                });
                if (Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01) displace(c.marks, v0, (x, z) => yAlong(e, x, z));
            }
        }
    }
    // structures under / beside elevated and sunken roads
    const pierSpots = [], pierColl = [];
    for (const e of edges) e.lidded = !!e.tunnel && !e.virtual && Math.max(e.ya, e.yb) < -4.5;
    for (const e of raised) {
        const c = cellOf((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
        const sb = c.solid;
        const conc = rgb('#a9a69e'), dark = rgb('#55524d');
        const wr = widthSide(e, 1), wl = widthSide(e, -1);
        const P = (s2, o, y) => [e.a.x + e.dirx * s2 + e.nx * o, y, e.a.z + e.dirz * s2 + e.nz * o];
        // the same at the ends, mitred with the next edge (decks, walls and lids join without gaps / overlaps at bends)
        const Pm = (end, o, y) => { const sd = o >= 0 ? 1 : -1, ex = Math.abs(o) - widthSide(e, sd); const q = corner(e, end ? e.b : e.a, sd, Math.abs(o), (f, sf) => widthSide(f, sf) + ex); return [q[0], y, q[1]]; };
        const yA = e.ya + Y.road, yB = e.yb + Y.road;
        const up = Math.max(e.ya, e.yb) > 0.3, down = Math.min(e.ya, e.yb) < -0.3;
        if (up && e.bridge) {
            // deck fascia + underside + piers
            // (the fascia / underside thins to nothing where the deck meets the ground: no slab through the street)
            const dA = yA - Math.min(1.1, Math.max(0.05, e.ya)), dB = yB - Math.min(1.1, Math.max(0.05, e.yb));
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(Pm(0, o, dA), Pm(1, o, dB), Pm(1, o, yB + 0.05), Pm(0, o, yA + 0.05), conc, [e.nx * sgn, 0, e.nz * sgn]);
            sb.face4(Pm(0, wr, dA), Pm(1, wr, dB), Pm(1, -wl, dB), Pm(0, -wl, dA), dark, [0, -1, 0]);
            const hw = Math.max(wr, wl);
            for (let s2 = (e.id * 13) % 24 + 6; s2 < e.len - 3; s2 += 26) {
                const y = e.ya + (e.yb - e.ya) * s2 / e.len + Y.road - 1.1; if (y < 1.2) continue;
                const cols = hw > 7 ? [-hw * 0.55, hw * 0.55] : [0];
                for (const o of cols) { const q = P(s2, o, 0); pierSpots.push({ sb, x: q[0], z: q[2], y, ang: Math.atan2(e.dirx, e.dirz), e, col: conc }); }
            }
        } else if (up) {
            // ramp on an embankment: retaining walls down to the ground
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(Pm(0, o, 0), Pm(1, o, 0), Pm(1, o, Math.max(0, yB)), Pm(0, o, Math.max(0, yA)), conc, [e.nx * sgn, 0, e.nz * sgn]);
        }
        if (down) {
            // trench / tunnel walls facing the road, from the road up to street level
            for (const [o, sgn] of [[wr, -1], [-wl, 1]]) sb.face4(Pm(0, o, Math.min(yA, 0)), Pm(1, o, Math.min(yB, 0)), Pm(1, o, 0.4), Pm(0, o, 0.4), conc, [e.nx * sgn, 0, e.nz * sgn]);
            // parapet on the trench rim where the collision wall stands above street level (to 1.0 m; play-test note 46: the
            // 1 m trench wall beside Bd. Iancu de Hunedoara was invisible from the street side) — open / uncovered part only
            if (!e.lidded) {
                const fY = (t) => e.ya + (e.yb - e.ya) * t, tAt = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1);
                let p0 = 0, p1 = 1;
                const cut = (thr, keepBelow) => { if (fY(0) < thr === fY(1) < thr) return (fY(0) < thr) === keepBelow; const tc = tAt(thr); if ((fY(0) < thr) === keepBelow) p1 = Math.min(p1, tc); else p0 = Math.max(p0, tc); return true; };
                if (cut(-0.35, true) && (!e.tunnel || cut(-4.2, false)) && p1 - p0 > 0.01) {
                    const Pt = (t, o, y) => P(t * e.len, o, y), cap = rgb('#b4b0a8');
                    for (const [o, sgn] of [[wr, -1], [-wl, 1]]) {
                        const oo = o + 0.25 * -sgn;
                        sb.face4(Pt(p0, o, 0.4), Pt(p1, o, 0.4), Pt(p1, o, 1.0), Pt(p0, o, 1.0), conc, [e.nx * sgn, 0, e.nz * sgn]);
                        sb.face4(Pt(p1, oo, 0), Pt(p0, oo, 0), Pt(p0, oo, 1.0), Pt(p1, oo, 1.0), conc, [-e.nx * sgn, 0, -e.nz * sgn]);
                        sb.face4(Pt(p0, oo, 1.0), Pt(p1, oo, 1.0), Pt(p1, o, 1.0), Pt(p0, o, 1.0), cap, [0, 1, 0]);
                    }
                }
            }
            if (e.tunnel && !e.lidded && Math.min(e.ya, e.yb) < -4.2) { // (play-test note 45) partly deep tunnel edge: the
                // covered part (deeper than 4.2 m) gets its lid / ceiling and a portal where it opens (the hole in Piața Victoriei)
                const tY = (y) => clamp((y - e.ya) / ((e.yb - e.ya) || 1e-6), 0, 1), t4 = tY(-4.2);
                const [t0, t1] = e.ya < e.yb ? [0, t4] : [t4, 1];
                const Pt = (t, o, y) => P(t * e.len, o, y);
                const y0c = e.ya + (e.yb - e.ya) * t0 + Y.road + 5.2, y1c = e.ya + (e.yb - e.ya) * t1 + Y.road + 5.2;
                sb.face4(Pt(t0, wr, y0c), Pt(t1, wr, y1c), Pt(t1, -wl, y1c), Pt(t0, -wl, y0c), dark, [0, -1, 0]);
                c.ground.face4(Pt(t0, wr + 0.3, 0.06), Pt(t1, wr + 0.3, 0.06), Pt(t1, -wl - 0.3, 0.06), Pt(t0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]);
                const tp = e.ya < e.yb ? t1 : t0, yp = (tp === t1 ? y1c : y0c), out = e.ya < e.yb ? 1 : -1;
                sb.face4(Pt(tp, wr + 0.5, yp), Pt(tp, -wl - 0.5, yp), Pt(tp, -wl - 0.5, 1.2), Pt(tp, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
            }
            if (e.tunnel && e.lidded) { // (shallow 'tunnels' < 4.5 m deep stay open trenches: a lid would lie on the street)
                const ca = yA + 5.2, cb = yB + 5.2;
                sb.face4(Pm(0, wr, ca), Pm(1, wr, cb), Pm(1, -wl, cb), Pm(0, -wl, ca), dark, [0, -1, 0]); // ceiling
                c.ground.face4(Pm(0, wr + 0.3, 0.06), Pm(1, wr + 0.3, 0.06), Pm(1, -wl - 0.3, 0.06), Pm(0, -wl - 0.3, 0.06), sideCol, [0, 1, 0]); // lid at street level (paved, like the square above)
                // portal facade where the tunnel opens onto a non-tunnel road
                for (const n of [e.a, e.b]) {
                    if (n.edges.every(f => f === e || f.virtual || f.lidded)) continue;
                    const s2 = n === e.a ? 0 : e.len, yc = (n === e.a ? ca : cb);
                    const out = n === e.a ? -1 : 1;
                    sb.face4(P(s2, wr + 0.5, yc), P(s2, -wl - 0.5, yc), P(s2, -wl - 0.5, 1.2), P(s2, wr + 0.5, 1.2), rgb('#6b6862'), [e.dirx * out, 0, e.dirz * out]);
                }
            }
        }
    }
    // raised junction corners (realPass): between two neighbouring sidewalk ends round a pad, a quad from one end (asphalt
    // corner → property-line corner) to the next, at the kerb's height, with a kerb face toward the pad and a back face
    for (const [n, R] of sideJoins) {
        if (R.length < 2) continue;
        const ang = (r) => Math.atan2((r.asph[1] + r.outer[1]) / 2 - n.z, (r.asph[0] + r.outer[0]) / 2 - n.x);
        const S2 = R.map(r => ({ ...r, a: ang(r) })).sort((p, q) => p.a - q.a), c = cellOf(n.x, n.z), mb = c.ground;
        const cross = (p, q, r2, s2) => { const d = (q[0] - p[0]) * (s2[1] - r2[1]) - (q[1] - p[1]) * (s2[0] - r2[0]); if (Math.abs(d) < 1e-9) return false;
            const t = ((r2[0] - p[0]) * (s2[1] - r2[1]) - (r2[1] - p[1]) * (s2[0] - r2[0])) / d, u = ((r2[0] - p[0]) * (q[1] - p[1]) - (r2[1] - p[1]) * (q[0] - p[0])) / d; return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999; };
        for (let i = 0; i < S2.length; i++) {
            const r1 = S2[i], r2 = S2[(i + 1) % S2.length]; if (r1.e === r2.e) continue;
            const skip = (why) => { if (cornerSkips.length < 60) cornerSkips.push({ x: Math.round(n.x), z: Math.round(n.z), why }); };
            let gap = r2.a - r1.a; if (gap <= 0) gap += Math.PI * 2; if (gap > Math.PI * 1.25) { skip('gap ' + Math.round(gap * 57.3)); continue; }
            const q = [r1.asph, r1.outer, r2.outer, r2.asph];
            if (cross(q[0], q[1], q[2], q[3]) || cross(q[1], q[2], q[3], q[0])) { skip('self-crossing'); continue; }
            let ar = 0; for (let k = 0; k < 4; k++) ar += q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1]; if (Math.abs(ar) / 2 < 0.4 || Math.abs(ar) / 2 > 400) { skip('area ' + Math.round(Math.abs(ar) / 2)); continue; }
            const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cz = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
            if (r1.e.name && r1.e.name === r2.e.name && Math.abs(r1.e.dirx * r2.e.dirx + r1.e.dirz * r2.e.dirz) > 0.9) { skip('median'); continue; } // (the two halves of a dual carriageway)
            const inP = (p, f = 0.3) => { const l = Math.hypot(cx - p[0], cz - p[1]) || 1; return [p[0] + (cx - p[0]) / l * f, p[1] + (cz - p[1]) / l * f]; };
            const smp = [[cx, cz], ...q.map(v => inP(v)), ...q.map((v, k) => inP([(v[0] + q[(k + 1) % 4][0]) / 2, (v[1] + q[(k + 1) % 4][1]) / 2]))];
            if (smp.some(([x, z]) => coveredByOther(x, z, null, padHeightAt(n, x, z), 0.02))) { skip('covered'); continue; }
            const hy = (x, z) => Y.road + Y.kerb + padHeightAt(n, x, z), base = mb.vc;
            for (const [x, z] of q) mb.v(x, hy(x, z), z, 0, 1, 0, x * 0.25, z * 0.25, sideCol);
            mb.triUp(base, base + 1, base + 2); mb.triUp(base, base + 2, base + 3);
            const tn = (a, b, away) => { const mx = (a[0] + b[0]) / 2 - n.x, mz = (a[1] + b[1]) / 2 - n.z, l = Math.hypot(mx, mz) || 1; return away ? [mx / l, mz / l] : [-mx / l, -mz / l]; };
            { const [nx, nz] = tn(q[3], q[0], false); mb.wall(q[3][0], q[3][1], q[0][0], q[0][1], Y.road - 0.01 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(kerbCol, 0.85)); }   // kerb face toward the pad
            { const [nx, nz] = tn(q[1], q[2], true); mb.wall(q[1][0], q[1][1], q[2][0], q[2][1], Y.landuse - 0.02 + padHeightAt(n, cx, cz), hy(cx, cz), nx, nz, shadeRgb(sideCol, 0.8)); }   // back face
            const cp = { p: q, n, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) };
            cornerPolys.push(cp); cornerGrid.insert(cp.x0, cp.z0, cp.x1, cp.z1, cp);
        }
    }
    // junction pads
    for (const [n, o] of padCorners) {
        const c = cellOf(n.x, n.z);
        const ly = Math.max(0, Math.min(...n.edges.map(layerY)));
        if (o.side.length >= 3) { // (sloped like the pad: a flat sidewalk hull would poke through a pad on a grade)
            const hull = convexHull(o.side), mb = c.ground, base = mb.vc;
            hull.forEach(([x, z]) => mb.v(x, Y.side + ly - 0.004 + padHeightAt(n, x, z), z, 0, 1, 0, x * 0.25, z * 0.25, sideCol));
            for (let k = 1; k < hull.length - 1; k++) mb.triUp(base, base + k, base + k + 1);
        }
        if (o.road.length >= 3) {
            // (2026-11-07, world-visual) each pad corner takes the height of the approach it belongs to (a junction on
            // a grade is not a flat shelf with a 0.3–0.9 m step at every sloping mouth: the step made the rim barriers
            // across the Bellevue 13B loop / NE 8th lanes); flat junctions are unchanged
            const hull = convexHull(o.road), col = padAsphalt(n), mb = c.pad, u = 0.15, base = mb.vc;
            const hs = hull.map(([x, z]) => padHeightAt(n, x, z));
            hull.forEach(([x, z], k) => mb.v(x, Y.road + ly + hs[k], z, 0, 1, 0, x * u, z * u, col));
            for (let k = 1; k < hull.length - 1; k++) mb.triUp(base, base + k, base + k + 1);
            ribbons.push({ node: n, poly: hull, hs });
        }
    }
    // ---- ribbon index: is (x, z) (± r) on a carriageway / junction pad? (tunnel ribbons do not block the surface)
    const ribGrid = new BoxGrid(24);
    for (const rb of ribbons) {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of rb.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        Object.assign(rb, { x0, z0, x1, z1, block: rb.e ? !rb.e.lidded : rb.node.y > -4.5, y: rb.e ? Math.max(rb.e.ya, rb.e.yb) : rb.node.y });
        ribGrid.insert(x0, z0, x1, z1, rb);
    }
    /** the ribbon (carriageway or junction pad) that a circle (x, z, r) touches, or null */
    const onRibbon = (x, z, r = 0, filter = null) => {
        let hit = null;
        ribGrid.each(x - r, z - r, x + r, z + r, (rb) => {
            if (hit || !rb.block || x < rb.x0 - r || x > rb.x1 + r || z < rb.z0 - r || z > rb.z1 + r) return;
            if (filter && !filter(rb)) return;
            if (pointInPolygon(x, z, rb.poly) || (r > 0 && polyDist(x, z, rb.poly) < r)) hit = rb;
        });
        if (hit || filter) return hit;
        // also the straight lane strip of every edge from node to node (what traffic / the harness consider the lanes)
        edgeGrid.each(x - r - 12, z - r - 12, x + r + 12, z + r + 12, (e) => {
            if (hit || e.virtual || e.lidded) return;
            const s = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz; if (s < 0.3 || s > e.len - 0.3) return;
            const lat = (x - e.a.x) * e.nx + (z - e.a.z) * e.nz;
            if (Math.abs(lat) < (lat >= 0 ? e.wR : e.wL) + r + 0.25) hit = { e, strip: true, y: Math.max(e.ya, e.yb) };
        });
        return hit;
    };
    const clearOf = (x, z, r = 0.3) => !onRibbon(x, z, r);
    // bridge piers: never on the road below (only where they clear every lower carriageway)
    for (const p of pierSpots) {
        const e = p.e;
        if (onRibbon(p.x, p.z, 1.0, (rb) => rb.e !== e && rb.node !== e.a && rb.node !== e.b && rb.y < p.y - 0.5)) continue;
        p.sb.box(p.x, 0, p.z, 1.3, p.y, 1.3, p.ang, p.col);
        pierColl.push({ x: p.x, z: p.z, hw: 0.65, hd: 0.65, angle: p.ang, r: 0.95, poly: null, h: p.y, prop: true, kind: 'pier', yMax: p.y - 0.5 });
    }
    const segsCross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    /** does polygon `poly` overlap any blocking ribbon? */
    const polyOnRibbon = (poly, filter = null) => {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = null;
        ribGrid.each(x0, z0, x1, z1, (rb) => {
            if (hit || !rb.block || rb.x1 < x0 || rb.x0 > x1 || rb.z1 < z0 || rb.z0 > z1 || (filter && !filter(rb))) return;
            if (poly.some(p => pointInPolygon(p[0], p[1], rb.poly)) || rb.poly.some(p => pointInPolygon(p[0], p[1], poly))) { hit = rb; return; }
            for (let i = 0, j = poly.length - 1; i < poly.length && !hit; j = i++) for (let k = 0, l = rb.poly.length - 1; k < rb.poly.length; l = k++) if (segsCross(poly[j], poly[i], rb.poly[l], rb.poly[k])) { hit = rb; break; }
        });
        return hit;
    };
    /** (realPass) top of the raised sidewalk at (x, z): a sidewalk band of a raised edge (between its asphalt edge and the
     *  property line, + tol: fences / hedges standing on the back edge) or a raised junction corner, never on a carriageway /
     *  pad → height (with the street's profile) or null */
    const RIB_ONLY = () => true;
    const raisedTop = (x, z, tol = 0) => {
        if (!realPass) return null;
        let top = null;
        cornerGrid.each(x - tol, z - tol, x + tol, z + tol, (cp) => {
            if (top !== null || x < cp.x0 - tol || x > cp.x1 + tol || z < cp.z0 - tol || z > cp.z1 + tol) return;
            if (pointInPolygon(x, z, cp.p) || (tol > 0 && polyDist(x, z, cp.p) < tol)) top = Y.road + Y.kerb + padHeightAt(cp.n, x, z);
        });
        if (top === null) edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (top !== null || !raisedEdge(e)) return;
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z); if (q.t <= 0 || q.t >= 1) return;
            const wa = widthAsphalt(e, ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1);
            if (q.d < wa + 0.02 || q.d > wa + e.sidewalk + SIDE_BACK + tol) return;
            top = Y.road + Y.kerb + e.a.y + (e.b.y - e.a.y) * q.t;
        });
        if (top !== null && onRibbon(x, z, 0, RIB_ONLY)) return null;
        return top;
    };
    /** vertices added to a cell's solid / detail builders since (v0s, v0d) lifted onto the raised sidewalk when (x, z) is on one */
    const liftOnSide = (c, v0s, v0d, x, z, tol = 0) => {
        if (!realPass || raisedTop(x, z, tol) === null) return false;
        for (let i = v0s; i < c.solid.vc; i++) c.solid.p[i * 3 + 1] += DY_SIDE;
        if (v0d != null) for (let i = v0d; i < c.detail.vc; i++) c.detail.p[i * 3 + 1] += DY_SIDE;
        return true;
    };
    const obbPoly = (b) => { const c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const lx = u * b.hw, lz = v * b.hd; return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; }); };
    /** outer edge of the sidewalk on side s of edge e at distance `along` from e.a (where lamps / signs / trees go) */
    const kerbSpot = (e, along, s, inset = 0.45) => {
        const w = (s > 0 ? e.wR : e.wL) + shoulderOf(e);
        const o = e.sidewalk >= 1.2 ? w + Math.max(0.55, e.sidewalk - inset) : w + 0.7;
        return { x: e.a.x + e.dirx * along + e.nx * o * s, z: e.a.z + e.dirz * along + e.nz * o * s, o };
    };

    // ---- invisible collision walls: bridge railings, embankments, trench / tunnel retaining walls, motorway guard
    //      rails and median barriers. {ax, az, bx, bz, y0a, y1a, y0b, y1b, nx, nz, kind, edge}: the wall blocks a body
    //      whose height is within [y0, y1] (interpolated along the wall); (nx, nz) points toward the carriageway.
    const walls = [];
    {
        const wallGrid = [];
        const surfaceAt = (x, z, own) => { // heights of the other ribbons under (x, z)
            const hs = []; ribGrid.each(x, z, x, z, (rb) => { if (rb.e === own || (rb.e && (rb.e.a === own.a || rb.e.b === own.b || rb.e.a === own.b || rb.e.b === own.a)) || (rb.node && (rb.node === own.a || rb.node === own.b))) return; if (x < rb.x0 || x > rb.x1 || z < rb.z0 || z > rb.z1 || !pointInPolygon(x, z, rb.poly)) return; const h = rb.e ? rb.e.a.y + (rb.e.b.y - rb.e.a.y) * clamp(((x - rb.e.a.x) * rb.e.dirx + (z - rb.e.a.z) * rb.e.dirz) / rb.e.len, 0, 1) : padHeightAt(rb.node, x, z); hs.push(h); hs.tol = Math.max(hs.tol || 0, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85 ? 0 : 1); (hs.items || (hs.items = [])).push([h, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85]); }); return hs; };
        const add = (e, s, off, kind, tFrom, tTo) => {
            // sub-divide into ~6 m pieces so the wall can be cut where it would cross another carriageway (junction mouths)
            const yAtT = (t) => Y.road + e.ya + (e.yb - e.ya) * t;
            // trench walls reach street level (cars up there must not fall in) — except under a tunnel's roof
            const range = (y) => kind === 'rail' ? [y > 2.6 ? y - 2.2 : -1.5, y + 1.1] : kind === 'embank' ? [-1.5, y + 1.1] : kind === 'trench' ? [y - 1.5, (e.lidded || (e.tunnel && y < -4.2)) ? Math.min(1.0, y + 4.6) : 1.0] : [y - 1.0, y + 0.85];
            const n = Math.max(1, Math.ceil((tTo - tFrom) * e.len / 3));
            let last = null;
            for (let k = 0; k < n; k++) {
                const t0 = tFrom + (tTo - tFrom) * k / n, t1 = tFrom + (tTo - tFrom) * (k + 1) / n;
                const ax = e.a.x + e.dirx * e.len * t0 + e.nx * off * s, az = e.a.z + e.dirz * e.len * t0 + e.nz * off * s;
                const bx = e.a.x + e.dirx * e.len * t1 + e.nx * off * s, bz = e.a.z + e.dirz * e.len * t1 + e.nz * off * s;
                const mx = (ax + bx) / 2, mz = (az + bz) / 2, ym = yAtT((t0 + t1) / 2) - Y.road;
                // another road continues the surface just beyond the wall at the same level (junction mouth, merging
                // ramp, the adjacent carriageway): leave it open. A road at a different level (a ramp diving next to a
                // street) or a gap keeps the wall.
                let open = false;
                for (const f of [0.03, 0.25, 0.5, 0.75, 0.97]) for (const o of [0, 0.7]) if (!open) {
                    const px = ax + (bx - ax) * f + e.nx * s * o, pz = az + (bz - az) * f + e.nz * s * o;
                    const yy = yAtT(t0 + (t1 - t0) * f) - Y.road; open = (surfaceAt(px, pz, e).items || []).some(([h, par]) => Math.abs(h - yy) < (par ? 0.3 : 0.45));
                }
                if (open) { last = null; continue; }
                const ra = range(yAtT(t0)), rbb = range(yAtT(t1));
                if (last && Math.hypot(bx - last.ax, bz - last.az) < 24) { // extend the previous piece (the band is linear along the edge)
                    Object.assign(last, { bx, bz, y0b: rbb[0], y1b: rbb[1], x: (last.ax + bx) / 2, z: (last.az + bz) / 2, r: Math.hypot(bx - last.ax, bz - last.az) / 2 + 0.3, yr: (last.y0a + rbb[0]) / 2 + 0 * ym });
                    last.yr = undefined; continue;
                }
                last = { wall: true, ax, az, bx, bz, y0a: ra[0], y1a: ra[1], y0b: rbb[0], y1b: rbb[1], yr: undefined, nx: -e.nx * s, nz: -e.nz * s, kind, edge: e, x: mx, z: mz, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1, ta: t0, tb: t1 };
                walls.push(last);
            }
        };
        void wallGrid;
        for (const e of edges) {
            if (e.virtual) continue;
            const t0 = 0, t1 = 1; // the whole edge: junction mouths are opened by the lane-cut rule below
            const yA = e.ya, yB = e.yb;
            const plainMw = /^(motorway|trunk)$/.test(e.type) && !e.a.pad && !e.b.pad && e.a.edges.length === 2 && e.b.edges.length === 2 && !e.bridge && !e.tunnel;
            // portion of [t0, t1] where the profile is beyond a threshold
            const sub = (pred, thr) => {
                const f = (t) => yA + (yB - yA) * t;
                if (pred(f(t0), thr) && pred(f(t1), thr)) return [t0, t1];
                if (!pred(f(t0), thr) && !pred(f(t1), thr)) return null;
                const tc = clamp((thr - yA) / ((yB - yA) || 1e-9), t0, t1);
                return pred(f(t0), thr) ? [t0, tc] : [tc, t1];
            };
            for (const s of [1, -1]) {
                if (e.bridge) { add(e, s, widthAsphalt(e, s) + 0.3, 'rail', t0, t1); continue; }
                const up = sub((y, t) => y > t, 0.35); if (up) add(e, s, widthSide(e, s), 'embank', up[0], up[1]);
                const dn = sub((y, t) => y < t, -0.35); if (dn) add(e, s, widthSide(e, s), 'trench', dn[0], dn[1]);
                if (!up && !dn && plainMw) add(e, s, widthAsphalt(e, s) + 0.2, 'guard', t0, t1);
            }
            // median barrier on two-way motorways / trunk roads with a central reservation
            if (/^(motorway|trunk)$/.test(e.type) && !e.oneway && e.median > 0.5 && !e.tramMedian && t1 - t0 > 0.05) {
                const c = cellOf((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2), v0 = c.solid.vc;
                const s0 = t0 * e.len, s1 = t1 * e.len;
                for (const sd of [1, -1]) { const o = 0.3 * sd; c.solid.wall(e.a.x + e.dirx * s0 + e.nx * o, e.a.z + e.dirz * s0 + e.nz * o, e.a.x + e.dirx * s1 + e.nx * o, e.a.z + e.dirz * s1 + e.nz * o, Y.road, Y.road + 0.8, e.nx * sd, e.nz * sd, rgb('#b9b6ae')); }
                c.solid.flatQuad(e.a.x + e.dirx * s0 + e.nx * 0.3, e.a.z + e.dirz * s0 + e.nz * 0.3, e.a.x + e.dirx * s1 + e.nx * 0.3, e.a.z + e.dirz * s1 + e.nz * 0.3, e.a.x + e.dirx * s1 - e.nx * 0.3, e.a.z + e.dirz * s1 - e.nz * 0.3, e.a.x + e.dirx * s0 - e.nx * 0.3, e.a.z + e.dirz * s0 - e.nz * 0.3, Y.road + 0.8, rgb('#cfccc4'), 0, -1);
                if (Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01) displace(c.solid, v0, (x, z) => yAlong(e, x, z));
                add(e, 1, 0, 'guard', t0, t1);
            }
        }
        // final rule: no wall piece may stand on another carriageway / junction pad at its own height band (junction
        // mouths, merging ramps, overlapping ribbons stay open). Walls are cut into 1.5 m pieces and re-joined.
        blocksLane = (w, x, z, f) => {
            const mg = w.kind === 'barrier' ? 0 : 0.3, y0 = w.y0a + (w.y0b - w.y0a) * f - mg, y1 = w.y1a + (w.y1b - w.y1a) * f + mg;
            let hit = false;
            ribGrid.each(x - 0.6, z - 0.6, x + 0.6, z + 0.6, (rb) => {
                if (hit || rb.e === w.edge) return;
                if (w.node && (rb.node === w.node || (rb.e && (rb.e.a === w.node || rb.e.b === w.node)))) return; // a pad-rim barrier vs its own junction / approaches
                if (rb.node && !w.node && (rb.node === w.edge.a || rb.node === w.edge.b)) { // its own junction: keep the wall along the edge proper
                    const e = w.edge, sAl = (x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz;
                    if (sAl > retract(e, e.a) + 0.3 && sAl < e.len - retract(e, e.b) - 0.3 && (rb.node.allEdges || rb.node.edges).filter(f => !f.virtual).length <= 2) return; // (a real junction's pad is used by the other approaches)
                }
                if (x < rb.x0 - 0.6 || x > rb.x1 + 0.6 || z < rb.z0 - 0.6 || z > rb.z1 + 0.6) return;
                if (!pointInPolygon(x, z, rb.poly) || polyDist(x, z, rb.poly) < 0.3) return; // only where it would stand ≥ 0.3 m inside a lane
                if (w.kind !== 'barrier') { hit = true; return; } // wide-band walls (embankment / trench / rail / guard) never stand in a lane
                // at a split / merge the sibling ramp (sharing a node with the wall's edge) is driven through the gore: a barrier
                // standing in its lanes is always cut (the wall across 'Exit → Westfield Southcenter', QA round 2)
                const sib = distId && rb.e && w.edge && ((/_link$/.test(rb.e.type) && /_link$/.test(w.edge.type)) || rb.e.bridge || w.edge.bridge) && (rb.e.a === w.edge.a || rb.e.a === w.edge.b || rb.e.b === w.edge.a || rb.e.b === w.edge.b);
                if (sib) { const n = (rb.e.a === w.edge.a || rb.e.a === w.edge.b) ? rb.e.a : rb.e.b;
                    const hS = Y.road + rb.e.a.y + (rb.e.b.y - rb.e.a.y) * clamp(((x - rb.e.a.x) * rb.e.dirx + (z - rb.e.a.z) * rb.e.dirz) / rb.e.len, 0, 1), own = (y0 + y1) / 2;
                    if (Math.hypot(x - n.x, z - n.z) < ((rb.e.bridge || w.edge.bridge) ? 40 : 15) && Math.abs(hS - own) < 1.6 && polyDist(x, z, rb.poly) > 0.5) { hit = true; return; } } // (a deck leaving its street at a split: no barrier in the street's lane — play-test note 12)
                // narrow separation barriers: only where the lane continues on both sides (a lane merely ending at the line keeps it)
                if (!pointInPolygon(x + w.nx * 0.9, z + w.nz * 0.9, rb.poly) || !pointInPolygon(x - w.nx * 0.9, z - w.nz * 0.9, rb.poly)) return;
                // and a car pushed through the gap would really land on a surface at this level (same test as roadHeight)
                let cont = false; surfacesAt(x - w.nx * 0.6, z - w.nz * 0.6, (hh) => { if (hh >= y0 && hh <= y1) cont = true; }, null, false, w.edge);
                if (!cont) return;
                const h = Y.road + (rb.e ? rb.e.a.y + (rb.e.b.y - rb.e.a.y) * clamp(((x - rb.e.a.x) * rb.e.dirx + (z - rb.e.a.z) * rb.e.dirz) / rb.e.len, 0, 1) : padHeightAt(rb.node, x, z));
                if (h >= y0 && h <= y1) hit = true;
            });
            return hit;
        };
        const cutWalls = () => {
        const kept = []; let cutPieces = 0;
        for (const w of walls) {
            const L = Math.hypot(w.bx - w.ax, w.bz - w.az), n = Math.max(1, Math.ceil(L / 1.0));
            let run = null;
            const emit = (f0, f1) => {
                const lerp = (a, b, f) => a + (b - a) * f;
                const ax = lerp(w.ax, w.bx, f0), az = lerp(w.az, w.bz, f0), bx = lerp(w.ax, w.bx, f1), bz = lerp(w.az, w.bz, f1);
                kept.push({ ...w, ax, az, bx, bz, y0a: lerp(w.y0a, w.y0b, f0), y1a: lerp(w.y1a, w.y1b, f0), y0b: lerp(w.y0a, w.y0b, f1), y1b: lerp(w.y1a, w.y1b, f1), x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3 });
            };
            for (let k = 0; k < n; k++) {
                const f0 = k / n, f1 = (k + 1) / n;
                let bad = false;
                for (let q = 0; q <= 4; q++) { const f = f0 + (f1 - f0) * q / 4; if (!bad) bad = blocksLane(w, w.ax + (w.bx - w.ax) * f, w.az + (w.bz - w.az) * f, f); }
                if (bad) { cutPieces++; if (run) { emit(run[0], run[1]); run = null; } }
                else if (run) run[1] = f1; else run = [f0, f1];
            }
            if (run) emit(run[0], run[1]);
        }
        walls.length = 0; for (const w of kept) if (Math.hypot(w.bx - w.ax, w.bz - w.az) > 0.4) walls.push(w);
        wallCut += cutPieces;
        };
        cutWalls();
        // separation barriers: where a road's edge borders another carriageway at a different level (a ramp diving /
        // climbing right next to a street — OSM geometry squeezed by the map scale), a car leaving the road there would
        // drop / jump onto it. Put a visible concrete barrier on that edge instead of an invisible cliff.
        let wg = null; const rebuildWg = () => { wg = new BoxGrid(16); for (const w of walls) wg.insert(Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz), w); };
        const land = (x, z, y) => { let best = null, bd = Infinity; surfacesAt(x, z, (h) => { const d = Math.abs(h - y); if (d <= 2.5 && d < bd) { bd = d; best = h; } }); return best ?? Y.road; };
        const blocked = (x0, z0, x1, z1, y) => { let f = false; wg.each(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (w) => {
            if (f) return; if (!segsCross([x0, z0], [x1, z1], [w.ax, w.az], [w.bx, w.bz]) && distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).d > 1.0) return;
            const t = distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).t; if (y >= w.y0a + (w.y0b - w.y0a) * t - 0.3 && y <= w.y1a + (w.y1b - w.y1a) * t) f = true; }); return f; };
        const barrierCol = rgb('#b9b6ae');
        const genBarriers = () => {
        rebuildWg();
        for (const e of edges) {
            if (e.virtual) continue;
            const t0 = 0, t1 = 1; // the whole edge: junction mouths are opened by the lane-cut rule below
            const step = Math.max(0.02, 1.5 / e.len);
            for (const s of [1, -1]) {
                const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s));
                let run = null;
                const flush = () => {
                    if (!run) return;
                    const { ta, tb } = run; run = null;
                    const P2 = (t) => [e.a.x + e.dirx * e.len * t + e.nx * off * s, e.a.z + e.dirz * e.len * t + e.nz * off * s];
                    const [ax, az] = P2(ta), [bx, bz] = P2(tb); const ya = Y.road + e.ya + (e.yb - e.ya) * ta, yb = Y.road + e.ya + (e.yb - e.ya) * tb;
                    const w = { wall: true, ax, az, bx, bz, y0a: ya - 0.45, y1a: ya + 0.45, y0b: yb - 0.45, y1b: yb + 0.45, nx: -e.nx * s, nz: -e.nz * s, kind: 'barrier', edge: e, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                };
                for (let t = t0; t <= t1 + 1e-6; t += step) {
                    const tt = Math.min(t, t1);
                    const own = Y.road + e.ya + (e.yb - e.ya) * tt;
                    const x = e.a.x + e.dirx * e.len * tt + e.nx * (off + 0.6) * s, z = e.a.z + e.dirz * e.len * tt + e.nz * (off + 0.6) * s;
                    const ix = e.a.x + e.dirx * e.len * tt + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * tt + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                    const bad = Math.abs(land(x, z, own) - own) > 0.45 && !blocked(ix, iz, x, z, own);
                    if (bad) { if (!run) run = { ta: Math.max(t0, tt - step * 0.6), tb: Math.min(t1, tt + step * 0.6) }; else run.tb = Math.min(t1, tt + step * 0.6); }
                    else flush();
                }
                flush();
            }
        }
        // the same along the exposed rim of junction pads (elevated / sunken junctions)
        for (const rb of ribbons) {
            if (!rb.node || rb.poly.length < 3) continue;
            const n = rb.node, own = Y.road + n.y, P = rb.poly;
            let cx = 0, cz = 0; for (const [x, z] of P) { cx += x; cz += z; } cx /= P.length; cz /= P.length;
            for (let k = 0; k < P.length; k++) {
                const p = P[k], q = P[(k + 1) % P.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.3) continue;
                let ox = (q[1] - p[1]) / L, oz = -(q[0] - p[0]) / L; if ((p[0] + q[0]) / 2 * ox + (p[1] + q[1]) / 2 * oz - (cx * ox + cz * oz) < 0) { ox = -ox; oz = -oz; }
                const steps = Math.max(1, Math.ceil(L / 1.5)); let run = null;
                const mouth = (x, z) => n.edges.some(e => { if (e.virtual) return false; const rp = ribPoly.get(e); return rp && (pointInPolygon(x, z, rp) || polyDist(x, z, rp) < 0.4); });
                const flush = () => {
                    if (!run) return; const a0 = run[0], b0 = run[1]; run = null;
                    const ax = p[0] + (q[0] - p[0]) * a0, az = p[1] + (q[1] - p[1]) * a0, bx = p[0] + (q[0] - p[0]) * b0, bz = p[1] + (q[1] - p[1]) * b0;
                    const oa = Y.road + padHeightAt(n, ax, az), ob = Y.road + padHeightAt(n, bx, bz);
                    const w = { wall: true, ax, az, bx, bz, y0a: oa - 0.45, y1a: oa + 0.45, y0b: ob - 0.45, y1b: ob + 0.45, nx: -ox, nz: -oz, kind: 'barrier', edge: n.edges[0], node: n, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                };
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t, ownH = Y.road + padHeightAt(n, x, z);
                    // (a rim sample whose outside point is on one of this junction's own approaches is a mouth: open)
                    const bad = !mouth(x + ox * 0.6, z + oz * 0.6) && Math.abs(land(x + ox * 0.6, z + oz * 0.6, ownH) - ownH) > 0.45 && !blocked(n.x, n.z, x + ox * 0.6, z + oz * 0.6, ownH);
                    if (bad) { if (!run) run = [Math.max(0, t - 0.5 / steps), Math.min(1, t + 0.5 / steps)]; else run[1] = Math.min(1, t + 0.5 / steps); } else flush();
                }
                flush();
            }
        }
        };
        genBarriers(); cutWalls(); genBarriers(); cutWalls();
        genBarriers(); cutWalls(); // last sweep: barriers only where a car would still drop / step, and never standing in a lane
        // draw the concrete separation barriers that survived
        for (const w of walls) {
            if (w.kind !== 'barrier') continue;
            const ya = w.y0a + 0.45, yb = w.y0b + 0.45, L = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1, px = -(w.bz - w.az) / L * 0.15, pz = (w.bx - w.ax) / L * 0.15;
            const c = cellOf(w.x, w.z);
            for (const sd of [1, -1]) c.solid.face4([w.ax + px * sd, ya, w.az + pz * sd], [w.bx + px * sd, yb, w.bz + pz * sd], [w.bx + px * sd, yb + 0.9, w.bz + pz * sd], [w.ax + px * sd, ya + 0.9, w.az + pz * sd], shadeRgb(barrierCol, sd > 0 ? 1 : 0.9), [px * sd, 0, pz * sd]);
            c.solid.face4([w.ax + px, ya + 0.9, w.az + pz], [w.bx + px, yb + 0.9, w.bz + pz], [w.bx - px, yb + 0.9, w.bz - pz], [w.ax - px, ya + 0.9, w.az - pz], shadeRgb(barrierCol, 1.08), [0, 1, 0]);
        }
    }
    // ---- district edge (chapters): every road cut at the district boundary ends in a red/white "road closed" barrier
    //      with a solid wall across it (kind 'end'); the inside-mask outline is an invisible wall (kind 'boundary')
    const mapEnds = [];
    if (data.district) {
        // (after round 6) the boundary cuts + every other dead end of a through road (a road whose continuation was dropped:
        // "the road stops without indication") — service lanes / living streets / short stubs are left as they are
        const endIdx = new Set(data.district.ends || []);
        nodeArr.forEach((n, i) => { if (!n || endIdx.has(i)) return; const real = n.edges.filter(f => !f.virtual); if (real.length !== 1) return; const e = real[0];
            if (/service|living_street|track|path|footway|pedestrian|parking/.test(e.type || '') || (e.len || 0) < 25) return; endIdx.add(i); });
        for (const i of endIdx) {
            const n = nodeArr[i]; const real = n ? n.edges.filter(f => !f.virtual) : []; if (real.length !== 1) continue; // (a U-turn connector may join a cut dual carriageway)
            const e = real[0];
            const out = e.a === n ? 1 : -1; // into the edge (= into the map)
            // road direction over the last ~20 m (a short, skewed last OSM segment made the barrier run diagonally)
            let ix = e.dirx * out, iz = e.dirz * out;
            { let m = n, f = e, acc = 0, qx = n.x, qz = n.z; const seen = new Set([n]);
              while (f && acc < 20) { const o = f.a === m ? f.b : f.a; if (seen.has(o)) break; seen.add(o); acc += f.len; qx = o.x; qz = o.z; m = o; const nx2 = o.edges.filter(g => g !== f && !g.virtual); f = nx2.length === 1 ? nx2[0] : null; }
              const L = Math.hypot(qx - n.x, qz - n.z); if (L > 4) { const dx = (qx - n.x) / L, dz = (qz - n.z) / L; if (dx * ix + dz * iz > 0.7) { ix = dx; iz = dz; } } }
            const px = -iz, pz = ix;
            const cx = n.x + ix * 1.5, cz = n.z + iz * 1.5, y = Y.road + n.y;
            const half = Math.max(e.wR, e.wL) + shoulderOf(e) + e.sidewalk + 0.3;
            const ax = cx - px * half, az = cz - pz * half, bx = cx + px * half, bz = cz + pz * half;
            // soft collider across the whole road (kind 'closure'): the player can't drive off the map
            const w = { wall: true, ax, az, bx, bz, y0a: y - 2, y1a: y + 3, y0b: y - 2, y1b: y + 3, nx: ix, nz: iz, kind: 'closure', soft: true, edge: e, node: n, x: cx, z: cz, r: half + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1.2 };
            walls.push(w); n.mapEnd = true;
            const kind = /motorway|trunk/.test(e.type) ? 'highway' : (/^(primary|secondary)(_link)?$/.test(e.type) || e.lanesF + e.lanesB >= 4) ? 'boulevard' : 'small';
            // the visible barrier spans the asphalt only (asymmetric on one-way / offset roads): lateral l0…l1 along +p
            const sgn = px * e.nx + pz * e.nz >= 0 ? 1 : -1, wP = (sgn > 0 ? e.wR : e.wL) + shoulderOf(e), wN = (sgn > 0 ? e.wL : e.wR) + shoulderOf(e);
            mapEnds.push({ x: cx, z: cz, node: n, edge: e, ix, iz, px, pz, half, y, kind, heading: Math.atan2(ix, iz), l0: -wN, l1: wP });
        }
        if (dmask) { // outline of the inside cells, merged into straight runs
            const { w: MW, h: MH, cell: CS, x0: X0, z0: Z0 } = dmask, B = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH && dmask.bits[j * MW + i] === 1;
            const addB = (ax, az, bx, bz, nx, nz) => walls.push({ wall: true, ax, az, bx, bz, y0a: -40, y1a: 80, y0b: -40, y1b: 80, nx, nz, kind: 'boundary', edge: null, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 0 });
            for (let i = 0; i <= MW; i++) { let run = null; // vertical lines x = X0 + i*CS
                for (let j = 0; j <= MH; j++) {
                    const L = B(i - 1, j), R = B(i, j), v = j < MH && L !== R ? (R ? 1 : -1) : 0;
                    if (run && v !== run.v) { addB(X0 + i * CS, Z0 + run.j0 * CS, X0 + i * CS, Z0 + j * CS, run.v, 0); run = null; }
                    if (v && !run) run = { v, j0: j };
                }
            }
            for (let j = 0; j <= MH; j++) { let run = null;
                for (let i = 0; i <= MW; i++) {
                    const U = B(i, j - 1), D = B(i, j), v = i < MW && U !== D ? (D ? 1 : -1) : 0;
                    if (run && v !== run.v) { addB(X0 + run.i0 * CS, Z0 + j * CS, X0 + i * CS, Z0 + j * CS, 0, run.v); run = null; }
                    if (v && !run) run = { v, i0: i };
                }
            }
        }
    }
    // tram tracks
    for (const pl of trams) {
        for (let i = 0; i < pl.length - 1; i++) {
            const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            const c = cellOf(ax, az);
            c.ground.flatQuad(ax + nx * 1.4, az + nz * 1.4, bx + nx * 1.4, bz + nz * 1.4, bx - nx * 1.4, bz - nz * 1.4, ax - nx * 1.4, az - nz * 1.4, Y.ballast, ballastCol, 0.3);
            for (const o of [-0.72, 0.72]) {
                const hw = 0.045, y = Y.road + Y.mark + 0.006;
                c.marks.flatQuad(ax + nx * (o + hw), az + nz * (o + hw), bx + nx * (o + hw), bz + nz * (o + hw), bx + nx * (o - hw), bz + nz * (o - hw), ax + nx * (o - hw), az + nz * (o - hw), y, railCol, 0);
            }
        }
    }

    // -----------------------------------------------------------------------
    //  BUILDINGS (+ CV POIs, landmarks)
    // -----------------------------------------------------------------------
    setProgress('Raising the buildings…'); await tick();
    const B_OFF = (data.version || 1) >= 2 ? 9 : 6;
    const bRecs = data.buildings.map((b, i) => {
        const ring = undelta(b, B_OFF);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const c = centroid(ring);
        return { i, style: data.styles[b[0]], h: b[1] / 10, minH: b[2] / 10, roof: data.roofs[b[3]], name: str(b[4]), flags: b[5], ring, c, x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false,
            levels: B_OFF === 9 ? b[6] : 0, colour: B_OFF === 9 ? str(b[7]) : '', roofColour: B_OFF === 9 ? str(b[8]) : '' };
    });
    // ---- (round 6 notes 10 / 46) Bucharest 'house' buildings: the village-house look (shutters, steep gable) read wrong —
    //      in Floreasca / Romană they are interwar villas (plaster, low hipped roof), and a lone house among office towers
    //      (Pipera, Bd. Dimitrie Pompeiu) reads as a low commercial block. Seattle keeps its wooden houses.
    if (!US) {
        const tall = bRecs.filter(b => b.h > 20);
        for (const b of bRecs) {
            if (b.style !== 'house') continue;
            let n = 0; for (const t of tall) if (Math.hypot(t.c[0] - b.c[0], t.c[1] - b.c[1]) < 70 && ++n >= 3) break;
            if (n >= 3 && !(b.flags & 16)) { b.style = 'plain'; b.roof = 'flat'; }
            else { b.style = 'interwar'; b.villa = true; if (!(b.flags & 16) && (b.roof === 'gabled' || b.roof === 'pitched')) b.roof = 'hipped'; } // (flags 16: roof shape measured — OSM / aerial survey — kept)
        }
    }
    // ---- facade style from data.buildingInfo (world-data: OSM type, start_date year, architect, material, height source)
    {
        const BI = data.buildingInfo || [];
        let restyled = 0;
        for (const b of bRecs) {
            const k = b.i * 5; if (k + 4 >= BI.length) break;
            const type = BI[k] >= 0 ? str(BI[k]) : '', yr = BI[k + 1] || 0, mat = BI[k + 3] >= 0 ? str(BI[k + 3]) : '';
            b.type = type; b.year = yr; b.material = mat;
            if (b.style === 'church' || b.style === 'house' || b.style === 'shop') continue;
            let st = null;
            if (/glass/.test(mat) || ((type === 'office' || type === 'commercial') && yr >= 1995)) st = 'glass';
            else if (yr && yr < 1914) st = US ? 'interwar' : 'eclectic';
            else if (yr >= 1925 && yr <= 1945) st = US ? 'interwar' : 'interwar';
            else if (yr >= 1960 && yr <= 1989 && /apartments|residential|yes|^$/.test(type) && !US) st = 'bloc';
            else if (/brick/.test(mat) && US) st = 'interwar';
            if (st && st !== b.style) { b.style = st; restyled++; }
        }
        if (restyled) console.info('[world] facade styles from buildingInfo:', restyled);
    }
    // ---- height sanity (2026-11-07, world-visual): the data build gives every untagged large footprint outside the old
    //      centre 8–10 storeys (23–30 m 'bloc'), so museums, villas and institutions on Kiseleff / Dorobanți became grey
    //      slabs. Buildings without building:levels whose height is exactly such a default are re-estimated here from
    //      their name and shape: real slab blocks (≤ 22 m wide, ≥ 30 m long) keep their storeys, compact or courtyard
    //      footprints become 3–5 storeys, named institutions 2–4 (data-build fix requested in spec 12 Requests)
    const heightFixes = [];
    {
        const DEF = new Set([11.6, 12.6, 14.5, 15.5, 23.2, 24.2, 29, 30]);
        const INST = /muze|museum|biseric|church|catedral|institut|[șs]coal|liceu|gr[ăa]dini|teatr|atene|bibliotec|universit|facult|spital|palat|casa |vila|villa|ambasada\b|embassy|primări|primari|tribunal|ministe/i;
        const minWidth = (ring) => { // smallest width over the footprint's own edge directions
            let best = Infinity, len = 0;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of ring) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                if (c1 - c0 < best) { best = c1 - c0; len = a1 - a0; }
            }
            return { w: best, l: len };
        };
        const villaZone = (x, z) => { if (US) return false; const ll = city.proj.inverse ? city.proj.inverse(x, z) : null; return !!ll && ll.lat > 44.447 && ll.lat < 44.48 && ll.lon > 26.07 && ll.lon < 26.112; }; // (to 26.112: Garibaldi / the composer streets)
        for (const b of bRecs) {
            if (b.levels > 0 || b.style === 'church' || b.style === 'glass' || b.minH > 0 || /^(bl(oc)?\.?\s|bloc\b|block\b)/i.test(b.name || '')) continue; // (a named apartment block keeps its storeys)
            const named = INST.test(b.name || '');
            const isDef = DEF.has(Math.round(b.h * 10) / 10);
            if (!isDef && !(named && b.h > 18)) continue;
            const { w, l } = minWidth(b.ring);
            const slab = w <= 22 && l >= 30 && !named && !villaZone(b.c[0], b.c[1]);
            if (slab || (!named && b.h < 16)) continue;
            const lv = named ? (b.area > 3000 ? 4 : b.area > 800 ? 3 : 2) : villaZone(b.c[0], b.c[1]) ? (b.area > 1500 ? 4 : 3) : (w > 22 ? 5 : 4);
            const floor = named ? 4.6 : 3.3, h2 = Math.round((lv * floor + 1.2) * 10) / 10;
            if (h2 >= b.h - 0.5) continue;
            heightFixes.push({ name: b.name || '', from: b.h, to: h2, w: Math.round(w), l: Math.round(l), x: Math.round(b.c[0]), z: Math.round(b.c[1]) });
            b.h = h2; b.levels = lv; if (named && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
            if (!named && villaZone(b.c[0], b.c[1]) && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
        }
        if (heightFixes.length) console.info('[world] height sanity:', heightFixes.length, 'buildings re-estimated', heightFixes.slice(0, 8));
    }
    // definitive check: no footprint may overlap a carriageway / junction pad (shrink toward the centroid, else drop)
    let bShrunk = 0, bDropped = 0;
    const laneInPoly = (ring, noService = false) => { // lane samples (as devCheck / traffic see them) inside the footprint (noService: a big named building's own service lanes don't count)
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = false;
        edgesInBox(x0 - 12, z0 - 12, x1 + 12, z1 + 12, (e) => {
            if (hit || e.virtual || e.tunnel || e.layer < 0 || (noService && e.type === 'service')) return;
            for (let t = 0.03; t < 0.98 && !hit; t += Math.min(0.05, 1 / e.len)) for (const o of [0, e.wR * 0.45, e.wR * 0.85, -e.wL * 0.45, -e.wL * 0.85]) {
                const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && pointInPolygon(x, z, ring)) { hit = true; break; }
            }
        });
        return hit;
    };
    const bBad = (ring, b) => (b && (b.flags & 64)) ? (polyOnRibbon(ring, (rb) => !(rb.e && rb.e.type === 'service') && !(rb.node && (rb.node.allEdges || rb.node.edges).every(q => q.type === 'service'))) || laneInPoly(ring, true)) : (polyOnRibbon(ring) || laneInPoly(ring));
    for (const b of bRecs) {
        if (!bBad(b.ring, b)) continue;
        let ring = b.ring, ok = false;
        for (let k = 0; k < 6 && !ok; k++) { ring = ring.map(([x, z]) => [b.c[0] + (x - b.c[0]) * 0.88, b.c[1] + (z - b.c[1]) * 0.88]); ok = !bBad(ring, b); }
        if (!ok || Math.abs(signedArea(ring)) < 8) { b.skip = true; b.dropped = true; bDropped++; continue; }
        b.ring = ring; b.area = Math.abs(signedArea(ring)); bShrunk++;
        b.x0 = Math.min(...ring.map(p => p[0])); b.x1 = Math.max(...ring.map(p => p[0])); b.z0 = Math.min(...ring.map(p => p[1])); b.z1 = Math.max(...ring.map(p => p[1]));
    }
    const bGrid = new BoxGrid(32);
    for (const b of bRecs) bGrid.insert(b.x0, b.z0, b.x1, b.z1, b);
    const buildingAt = (x, z) => { let r = null; bGrid.each(x, z, x, z, (b) => { if (!r && !b.skip && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring)) r = b; }); return r; };

    // landmarks (another module; optional)
    let LANDMARKS = [], buildLandmarkFn = null;
    let SEA_SCALE = 0.5;
    try { const mod = await import('./landmarks.js'); LANDMARKS = (mod.LANDMARKS || []).filter(l => l.city === city.id); buildLandmarkFn = mod.buildLandmark || null; SEA_SCALE = mod.SEA_SCALE || 0.5; } catch (err) { LANDMARKS = []; }
    // a district only builds its own landmarks (+ distant backdrops such as Rainier)
    // (a landmark the district lists explicitly may stand outside it, up to ~2.5 km: skyline landmarks seen down an
    //  avenue, e.g. the Parliament / People's Salvation Cathedral at the west end of Bd. Unirii seen from Piața Unirii)
    if (distCfg) LANDMARKS = LANDMARKS.filter(l => (distCfg.landmarks ? distCfg.landmarks.includes(l.id) : true) && (l.backdrop || inDistrictLL(l.lat, l.lon, distCfg.landmarks ? 0.022 : 0.004)));
    const landmarks = [];
    const landmarkFences = []; // (2026-11-08) fences of landmark grounds, drawn off the streets (below)
    const lmGrounds = []; // (2026-11-08) a landmark's own surfaces (sports grounds): no measured / generated trees on them
    const collisionBoxes = [];
    const lmGroup = new THREE.Group(); lmGroup.name = 'landmarks'; group.add(lmGroup);
    for (const lm of LANDMARKS) {
        try {
            let p = city.proj(lm.lat, lm.lon);
            // district worlds (1:1): realScale models (contract 01: lk = scale / authoredScale, R = radiusM · scale)
            const ctx = { THREE, rng: makeRng(Math.floor(Math.abs(lm.lat * 1e4 + lm.lon * 1e4))), helpers: landmarkHelpers, proj: city.proj, scale: data.proj.scale, US, realScale: !!distId };
            if (lm.backdrop) {
                // real position is beyond the far plane: pull it in along the same bearing from the map centre and shrink it
                const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
                const dx = p.x - cx, dz = p.z - cz, real = Math.hypot(dx, dz) || 1;
                const want = Math.min(real, 3600);
                ctx.backdropScale = want / real;
                p = { x: cx + dx / real * want, z: cz + dz / real * want };
            }
            const res = buildLandmarkFn ? buildLandmarkFn(lm, ctx) : lm.build(ctx);
            if (!res || !res.mesh) continue;
            res.mesh.position.set(p.x, res.mesh.position.y || 0.12, p.z);
            // models are authored at 1:1 (Seattle ones already squashed to 0.5) → match the world's x/z scale
            const lk = distId && res.authoredScale ? data.proj.scale / res.authoredScale : lm.city === 'seattle' ? data.proj.scale / SEA_SCALE : data.proj.scale; // (legacy: Seattle models are authored squashed by SEA_SCALE)
            // in the compressed DN1 strip (Băneasa → Otopeni) the city is squashed north–south: squash the model too
            const cf = (!lm.backdrop && data.proj.compress && lm.lat > data.proj.compress.above) ? data.proj.compress.factor : 1;
            if (cf !== 1) {
                const wrap = new THREE.Group(); wrap.name = 'landmark-wrap:' + lm.id;
                wrap.position.copy(res.mesh.position); res.mesh.position.set(0, 0, 0);
                wrap.scale.set(lk, 1, lk * cf); wrap.add(res.mesh); res.mesh = wrap;
            } else if (lk !== 1 && !lm.backdrop) { res.mesh.scale.x *= lk; res.mesh.scale.z *= lk; }
            if (lm.backdrop) { lmGroup.add(res.mesh); res.mesh.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); continue; }
            res.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            lmGroup.add(res.mesh);
            const names = (lm.osmNames || []).map(s => s.toLowerCase());
            const R = distId && res.authoredScale && lm.radiusM != null ? lm.radiusM * data.proj.scale : (lm.footprintRadius || 0) * lk;
            bGrid.each(p.x - R - 60, p.z - R - 60, p.x + R + 60, p.z + R + 60, (b) => {
                if (b.skip) return;
                const nm = b.name.toLowerCase();
                const dB = Math.hypot(b.c[0] - p.x, b.c[1] - p.z);
                // (2026-11-08) a name match only counts near the model: the school's name reached its sports hall (a POI sign)
                // 65 m away and hid it
                if ((nm && names.some(n => nm.includes(n)) && dB < R + 25) || dB < R) b.skip = true;
                else if (nm && names.some(n => nm.includes(n)) && (lm.ownSign || lm.cvStop)) { b.flags &= ~2; b.name = ''; } // (its name only: the model carries the sign)
            });
            for (const cb of res.collision || []) {
                if (cf !== 1) { // axis-aligned bounds of the rotated box, squashed N–S
                    const a = cb.angle || 0, ex = Math.abs(cb.hw * Math.cos(a)) + Math.abs(cb.hd * Math.sin(a)), ez = Math.abs(cb.hw * Math.sin(a)) + Math.abs(cb.hd * Math.cos(a));
                    const hw = ex * lk, hd = ez * lk * cf;
                    collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk * cf, hw, hd, angle: 0, r: Math.hypot(hw, hd), h: 20, poly: null, landmark: lm.id });
                } else collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk, hw: cb.hw * lk, hd: cb.hd * lk, angle: cb.angle || 0, r: Math.hypot(cb.hw, cb.hd) * lk, h: 20, poly: null, landmark: lm.id });
            }
            const toW = ([x, z]) => [p.x + x * lk, p.z + z * lk];
            for (const f of res.fences || []) landmarkFences.push({ ...f, ring: f.ring.map(toW), inside: f.inside ? f.inside.map(toW) : (f.closed ? f.ring.map(toW) : null), gates: (f.gates || []).map(g => ({ ...g, x: p.x + g.x * lk, z: p.z + g.z * lk, w: (g.w || 4) * lk })) });
            for (const g of res.grounds || []) { const q = g.map(toW); lmGrounds.push({ p: q, x0: Math.min(...q.map(v => v[0])), x1: Math.max(...q.map(v => v[0])), z0: Math.min(...q.map(v => v[1])), z1: Math.max(...q.map(v => v[1])) }); }
            for (const pt of res.covers || []) { // OSM buildings the model replaces (e.g. a school's sports hall)
                const [cx, cz] = toW(pt);
                bGrid.each(cx, cz, cx, cz, (b) => { if (!b.skip && cx >= b.x0 && cx <= b.x1 && cz >= b.z0 && cz <= b.z1 && pointInPolygon(cx, cz, b.ring)) b.skip = true; });
            }
            landmarks.push({ id: lm.id, label: lm.name, x: p.x, z: p.z, clear: res.clear || R, radius: R, mesh: res.mesh });
        } catch (err) { console.warn('landmark failed', lm.id, err); }
    }
    // landmarks that model their own water (the Unirii fountains: basins drained Nov–Apr by landmarks.js's
    // fountainSchedule) replace the OSM water polygons inside them: those are collapsed (no doubled / always-full basins)
    {
        const OWN_WATER = new Set(['fountains']);
        const box = new THREE.Box3();
        for (const lm of landmarks) {
            if (!OWN_WATER.has(lm.id) || !lm.mesh) continue;
            box.setFromObject(lm.mesh); box.expandByScalar(3);
            for (const a of areas) {
                if (a.kind !== 'water' || !a.waterMesh || a.size > 30000) continue;
                const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
                if (cx < box.min.x || cx > box.max.x || cz < box.min.z || cz > box.max.z) continue;
                const { mb, v0, v1 } = a.waterMesh; for (let i = v0; i < v1; i++) { mb.p[i * 3] = mb.p[v0 * 3]; mb.p[i * 3 + 1] = -50; mb.p[i * 3 + 2] = mb.p[v0 * 3 + 2]; }
                a.ownedBy = lm.id;
            }
        }
    }
    // landmark collision boxes must not reach into a carriageway (e.g. the squashed SeaTac / OTP terminals over their drives)
    let lmTrim = 0, lmDrop = 0;
    for (let i = collisionBoxes.length - 1; i >= 0; i--) {
        const b = collisionBoxes[i]; b.kind = 'landmark';
        let k = 0;
        while (k < 8 && polyOnRibbon(obbPoly(b))) {
            // shrink the side that overlaps: try each axis alone first, then both
            const hw = b.hw, hd = b.hd;
            b.hw = hw * 0.85; if (!polyOnRibbon(obbPoly(b))) { k++; break; }
            b.hw = hw; b.hd = hd * 0.85; if (!polyOnRibbon(obbPoly(b))) { k++; break; }
            b.hw = hw * 0.85; k++;
        }
        b.r = Math.hypot(b.hw, b.hd);
        if (polyOnRibbon(obbPoly(b)) || b.hw < 0.5 || b.hd < 0.5) { collisionBoxes.splice(i, 1); lmDrop++; } else if (k) lmTrim++;
    }

    dressSports(); // (sports-ground markings / goals / nets — after the landmarks, so their own grounds are skipped)
    // CV POIs (offices, schools, airports)
    const pois = [];
    const poiGroup = new THREE.Group(); poiGroup.name = 'pois'; group.add(poiGroup);
    const drivable = (e) => e.drivable && !/motorway|trunk_link/.test(e.type) && !e.tunnel && e.type !== 'service';
    const kerbPoint = (x, z, re, radius = 350, anyRoad = false) => {
        let ne = re ? nearestEdge(x, z, (e) => drivable(e) && re.test(e.name), radius) : null;
        if (!ne && !anyRoad) ne = nearestEdge(x, z, drivable, 90);
        if (!ne) ne = nearestEdge(x, z, (e) => e.drivable && !e.virtual && !/motorway/.test(e.type) && !e.tunnel); // campus / access service roads
        const e = ne.edge;
        const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        const off = (side > 0 ? e.wR : e.wL) + 1.0;
        // never in a junction: keep the door ≥ 4 m clear of the pads at both ends (when the street is long enough)
        const r0 = retract(e, e.a) + 4, r1 = e.len - retract(e, e.b) - 4;
        if (r1 > r0) { const sAl = clamp(ne.t * e.len, r0, r1); ne.cx = e.a.x + e.dirx * sAl; ne.cz = e.a.z + e.dirz * sAl; }
        return { x: ne.cx + e.nx * off * side, z: ne.cz + e.nz * off * side, edge: e, side, cx: ne.cx, cz: ne.cz };
    };
    const signs = new SignAtlas();

    const cvBuildings = new Map();
    for (const p of city.pois || []) {
        if (!inDistrictLL(p.lat, p.lon)) continue; // a district only has its own stops
        let q = city.proj(p.lat, p.lon);
        const kind = p.kind;
        if (p.junction) { // anchor on the named street corner nearest to the given point (e.g. Călărașilor × Traian)
            let best = null, bd = 700;
            for (const n of nodeArr) {
                if (n.edges.length < 3 || !p.junction.every(re => n.edges.some(e => re.test(e.name)))) continue;
                const d = Math.hypot(n.x - q.x, n.z - q.z); if (d < bd) { bd = d; best = n; }
            }
            if (best) {
                // step 18 m off the corner along the first street, on the side of the original point
                const e = best.edges.find(f => p.junction[0].test(f.name));
                const out = e.a === best ? 1 : -1;
                q = { x: best.x + e.dirx * out * 18, z: best.z + e.dirz * out * 18 };
            }
        }
        let b = buildingAt(q.x, q.z);
        if (b && b.area > 15000 && kind !== 'airport') b = null; // campus-sized outlines: use the address point instead
        const inLandmark = landmarks.find(l => l.radius > 0 && Math.hypot(l.x - q.x, l.z - q.z) < l.radius);
        if (!b && kind !== 'airport' && !inLandmark) { let bd = 45; bGrid.each(q.x - 45, q.z - 45, q.x + 45, q.z + 45, (o) => { if (o.skip || o.area < 150) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (kind === 'airport' && !b && !inLandmark) { let bd = 160; bGrid.each(q.x - 160, q.z - 160, q.x + 160, q.z + 160, (o) => { if (o.skip || o.area < 2000) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        let anchor = b ? { x: b.c[0], z: b.c[1] } : { x: q.x, z: q.z };
        let door = kerbPoint(kind === 'airport' ? anchor.x : (anchor.x + q.x) / 2, kind === 'airport' ? anchor.z : (anchor.z + q.z) / 2, p.road, p.roadRadius || 350, kind === 'airport'); // airports: the terminal loop (service roads)
        // the address street is further than the building we found (geocode slightly off): use the building fronting that street
        if (p.road && kind !== 'airport' && !inLandmark && Math.hypot(anchor.x - door.x, anchor.z - door.z) > 35) {
            let nb = null, bd = 40;
            bGrid.each(door.x - 45, door.z - 45, door.x + 45, door.z + 45, (o) => { if (o.skip || o.area < 120 || o.area > 15000) return; const d = Math.hypot(o.c[0] - door.x, o.c[1] - door.z); if (d < bd) { bd = d; nb = o; } });
            if (nb) { b = nb; anchor = { x: nb.c[0], z: nb.c[1] }; door = kerbPoint(anchor.x, anchor.z, p.road, 120); }
        }
        if (p.doorAlong && door.edge) { // slide the door along its street (e.g. GTS: before the busy Traian junction, not after it)
            const e = door.edge, br = (p.doorAlong.bearing ?? 270) * Math.PI / 180, dir = (e.dirx * Math.sin(br) - e.dirz * Math.cos(br)) >= 0 ? 1 : -1;
            const ne2 = nearestEdge(door.cx + e.dirx * dir * p.doorAlong.m, door.cz + e.dirz * dir * p.doorAlong.m, (f) => drivable(f) && (!p.road || p.road.test(f.name)), 60);
            if (ne2) { const f = ne2.edge, sd = door.side * Math.sign(f.nx * e.nx + f.nz * e.nz || 1), off = (sd > 0 ? f.wR : f.wL) + 1.0; door = { x: ne2.cx + f.nx * off * sd, z: ne2.cz + f.nz * off * sd, edge: f, side: sd, cx: ne2.cx, cz: ne2.cz }; }
        }
        const stop = STOPS.find(s => s.poi === p.id);
        if (stop && !p.color) p.color = stop.color;
        const poi = { id: p.id, kind, label: p.label, brand: '', address: p.address || '', x: anchor.x, z: anchor.z, doorX: door.x, doorZ: door.z, color: p.color || null, icon: p.icon || null, visited: false, h: 20, w: 26, d: 22, cv: !p.passing, interactive: !p.passing, passing: !!p.passing, caption: p.caption || null };
        if (b) {
            b.cv = poi; poi.h = b.h; poi.w = b.x1 - b.x0; poi.d = b.z1 - b.z0;
            // (landmarks Request) a CV-stop landmark that models its own signage (ownSign) gets no generic CV panel
            const ownSign = LANDMARKS.some(l => l.ownSign && (l.cvStop === p.id || (stop && l.cvStop === stop.id)));
            if (!ownSign) { b.name = p.label; b.flags |= 2; b.cvSign = true; }
        } else if (inLandmark) {
            poi.h = 25; poi.landmark = inLandmark.id;
        } else if (kind !== 'airport') {
            // no OSM footprint: generate a simple office block between the kerb and the anchor
            const [w, h, d] = p.size || [26, 20, 22];
            const e = door.edge, sd = door.side;
            const off = (sd > 0 ? e.wR : e.wL) + e.sidewalk + 2 + d / 2;
            let cx = door.cx + e.nx * off * sd, cz = door.cz + e.nz * off * sd;
            const ux = e.dirx, uz = e.dirz, vx = e.nx * sd, vz = e.nz * sd;
            const ring = [[cx - ux * w / 2 - vx * d / 2, cz - uz * w / 2 - vz * d / 2], [cx + ux * w / 2 - vx * d / 2, cz + uz * w / 2 - vz * d / 2], [cx + ux * w / 2 + vx * d / 2, cz + uz * w / 2 + vz * d / 2], [cx - ux * w / 2 + vx * d / 2, cz - uz * w / 2 + vz * d / 2]];
            // push it back from the kerb until no road ribbon crosses it
            let blocked = true;
            for (let tries = 0; tries < 8 && blocked; tries++) {
                blocked = false;
                for (const [px, pz] of ring.concat([[cx, cz]])) { const q2 = nearestEdge(px, pz, null, 30); if (q2 && q2.d < Math.max(q2.edge.wR, q2.edge.wL) + 1.5) { blocked = true; break; } }
                if (!blocked && polyOnRibbon(ring)) blocked = true;
                if (!blocked) break;
                if (tries === 7) break;
                for (const p2 of ring) { p2[0] += vx * 5; p2[1] += vz * 5; }
                cx += vx * 5; cz += vz * 5;
            }
            if (blocked) { poi.h = 20; cvBuildings.set(p.id, null); }
            else {
            // remove anything in the way
            bGrid.each(cx - w, cz - w, cx + w, cz + w, (o) => { if (Math.hypot(o.c[0] - cx, o.c[1] - cz) < Math.max(w, d) * 0.7) o.skip = true; });
            const nb = { i: bRecs.length, style: 'glass', h, minH: 0, roof: 'flat', name: p.label, flags: 2, ring, c: [cx, cz], x0: cx - w, z0: cz - w, x1: cx + w, z1: cz + w, area: w * d, skip: false, cv: poi, cvSign: true };
            bRecs.push(nb); bGrid.insert(nb.x0, nb.z0, nb.x1, nb.z1, nb);
            poi.x = cx; poi.z = cz; poi.h = h; poi.w = w; poi.d = d;
            poi.generated = true;
            }
        } else { poi.h = 18; }
        // floating marker
        const marker = new THREE.Group();
        const pin = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12), new THREE.MeshBasicMaterial({ color: p.color || '#f97316' }));
        pin.rotation.x = Math.PI; marker.add(pin);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 2.4; marker.add(ring);
        { // over the building itself (the centroid of an L / U-shaped footprint can lie over the street)
            let mx = poi.x, mz = poi.z;
            if (b && b.ring && !pointInPolygon(mx, mz, b.ring)) {
                let bd = Infinity; const st = Math.max(1, Math.min(b.x1 - b.x0, b.z1 - b.z0) / 12);
                for (let x = b.x0; x <= b.x1; x += st) for (let z = b.z0; z <= b.z1; z += st) {
                    if (!pointInPolygon(x, z, b.ring) || polyDist(x, z, b.ring) < 2) continue;
                    const d = Math.hypot(x - poi.x, z - poi.z); if (d < bd) { bd = d; mx = x; mz = z; }
                }
            } else if (!b && !inLandmark && !poi.generated) { mx = door.x; mz = door.z; } // no footprint: above the door
            marker.position.set(mx, poi.h + 8, mz);
        }
        marker.userData.pin = pin;
        poiGroup.add(marker);
        poi.marker = marker; if (p.passing) marker.visible = false; // a passing landmark (caption) has no stop marker / door mat
        // door mat / entrance plaza at the kerb
        if (!p.passing) cellOf(door.x, door.z).marks.flatFan([[door.x - 1.2, door.z - 1.2], [door.x + 1.2, door.z - 1.2], [door.x + 1.2, door.z + 1.2], [door.x - 1.2, door.z + 1.2]], Y.road + Y.mark + 0.01, rgb(p.color || '#f97316'));
        pois.push(poi);
        cvBuildings.set(p.id, b);
    }
    // keep the marker colour in sync when main.js assigns poi.color later
    for (const p of pois) Object.defineProperty(p, 'color', {
        get() { return this._color; }, set(v) { this._color = v; if (this.marker && v) this.marker.userData.pin.material.color.set(v); }, configurable: true, enumerable: true,
    });
    for (const p of pois) p.color = p._color || (city.pois.find(q => q.id === p.id) || {}).color || null;
    const lmSignColl = []; // (monument signs: colliders added with the other props below)
    // CV facade sign on landmark-hosted stops (poi.landmark: uipath-bel → lincoln, uipath-buc → thelandmark, arnia →
    // europehouse): the models only carry real-world signage, so the stop's sign goes on the facade nearest its door,
    // found by casting rays from the door at sign height to the model (the real facade, not a trimmed collision box)
    {
        const rc = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(), nW = new THREE.Vector3();
        lmGroup.updateMatrixWorld(true);
        for (const poi of pois) {
            if (!poi.landmark || poi.passing) continue;
            const lmk = landmarks.find(l => l.id === poi.landmark); if (!lmk || !lmk.mesh) continue;
            if (LANDMARKS.some(l => l.id === lmk.id && l.ownSign)) continue; // the model carries its own real signage (landmarks Request)
            const s = signs.get(poi.label, '#111827', '#ffffff', poi._color || '#f97316'); if (!s) continue;
            const facadeAt = (ys, minDot) => { let best = null;
                for (let k = -6; k <= 6; k++) { // a fan of rays toward the model
                    const bx = lmk.x - poi.doorX, bz = lmk.z - poi.doorZ, a0 = Math.atan2(bz, bx) + k * 0.12;
                    o3.set(poi.doorX, ys, poi.doorZ); d3.set(Math.cos(a0), 0, Math.sin(a0));
                    rc.set(o3, d3); rc.far = 80;
                    const hit = rc.intersectObject(lmk.mesh, true).find(h => h.face && h.object.isMesh && h.object.visible);
                    if (!hit) continue;
                    nW.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); nW.y = 0;
                    if (nW.lengthSq() < 0.25) continue; nW.normalize();
                    if (nW.x * -d3.x + nW.z * -d3.z < minDot) continue; // facing the door
                    if (!best || hit.distance < best.d) best = { d: hit.distance, x: hit.point.x, z: hit.point.z, nx: nW.x, nz: nW.z };
                }
                return best; };
            // beside the entrance at 7.5 m (its canopy carries the building's own lettering), else above the canopy,
            // on a flush stretch of facade (slid along it); last resort: over the door, narrower
            let pick = null;
            for (const ys of [7.5, 10, 12.5]) {
                const best = facadeAt(ys, 0.8); if (!best) continue;
                const { nx, nz } = best, w = 12;
                for (const sg of [0, 1, -1]) {
                    const tx = nz * (sg || 1), tz = -nx * (sg || 1), d = sg ? w / 2 + 3 : 0, px = best.x + tx * d, pz = best.z + tz * d;
                    let flush = true;
                    for (const f of [-w / 2 + 0.5, -w / 4, 0, w / 4, w / 2 - 0.5]) {
                        o3.set(px + tx * f + nx * 6, ys, pz + tz * f + nz * 6); d3.set(-nx, 0, -nz); rc.set(o3, d3); rc.far = 12;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0]; if (!h2 || Math.abs(h2.distance - 6) > 0.6) { flush = false; break; }
                    }
                    if (flush) { pick = { ys, nx, nz, cx: px, cz: pz, w }; break; }
                }
                if (pick) break;
            }
            if (!pick) { // entrance canopy: tenant letters standing on its front edge, facing the street (above the canopy's own lettering)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35);
                if (best) {
                    // walk from the kerb side of the door toward the building with downward rays: the first roof found
                    // 3–8.5 m up is the canopy's front edge
                    let end = null, ch = 0;
                    for (let k = 0; k < 40; k++) {
                        const px = poi.doorX + best.nx * 2 - best.nx * 0.3 * k, pz = poi.doorZ + best.nz * 2 - best.nz * 0.3 * k;
                        o3.set(px, 9.0, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 9.0;
                        const h2 = rc.intersectObject(lmk.mesh, true)[0], hy = h2 ? 9.0 - h2.distance : 0;
                        if (h2 && hy > 3 && hy < 8.5) { end = [px, pz]; ch = hy; break; }
                        if (h2 && hy >= 8.5) break;
                    }
                    if (end) {
                        // (round 6 note 24) the letters must not run into the model: at Lincoln Square the 8 m sign's end went
                        // through the angled lobby glazing's mullions. Rays along the sign's face (left end → right end, at
                        // three heights) find anything crossing it; narrower / further forward until it is clear.
                        const asp = (signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316') || s).aspect, tx = best.nz, tz = -best.nx;
                        const clearAt = (cx, cz, ww, ys0, hh0) => {
                            for (const fy of [-0.4, 0, 0.4]) for (const fn of [-0.05, 0.05]) {
                                o3.set(cx - tx * (ww / 2 + 0.3) + best.nx * fn, ys0 + fy * hh0, cz - tz * (ww / 2 + 0.3) + best.nz * fn); d3.set(tx, 0, tz);
                                rc.set(o3, d3); rc.far = ww + 0.6; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false;
                            }
                            return true;
                        };
                        let fit = null;
                        for (const ww of [8, 7, 6, 5, 4.2]) { for (const fwd of [-0.4, 0.15, 0.7]) { const hh2 = ww / asp, cx = end[0] + best.nx * fwd, cz = end[1] + best.nz * fwd, ys0 = ch + hh2 / 2 + 0.25; if (clearAt(cx, cz, ww, ys0, hh2)) { fit = { ww, cx, cz, ys0 }; break; } } if (fit) break; }
                        if (!fit) { const hh2 = 4.2 / asp; fit = { ww: 4.2, cx: end[0] + best.nx * 0.7, cz: end[1] + best.nz * 0.7, ys0: ch + hh2 / 2 + 0.25 }; }
                        pick = { ys: fit.ys0, nx: best.nx, nz: best.nz, cx: fit.cx, cz: fit.cz, w: fit.ww, canopy: true, text: poi.label.split(' — ')[0] };
                    }
                }
            }
            if (!pick) { // no flush facade (glazed lobby under a canopy): a freestanding tenant monument sign by the entrance,
                // set across the sidewalk so it reads from the street in both directions (like real office-tower signage)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35); if (!best) continue;
                const { nx, nz } = best, short = signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316'); if (!short) continue;
                const midX = (best.x + poi.doorX) / 2, midZ = (best.z + poi.doorZ) / 2;
                let placed = false;
                // (round 6 note 24) clear of the model itself: Lincoln Square's lobby mullions / door frames stand 0.66 m out
                // from its glazing and cut through a sign placed there
                const clearOfModel = (x, z, tx, tz, W) => {
                    for (const f of [-W / 2 - 0.3, 0, W / 2 + 0.3]) {
                        const px = x + tx * f, pz = z + tz * f;
                        for (const sd of [1, -1]) { o3.set(px, 1.6, pz); d3.set(nx * sd, 0, nz * sd); rc.set(o3, d3); rc.far = 1.4; if (rc.intersectObject(lmk.mesh, true).some(h => h.object.isMesh && h.object.visible)) return false; }
                        o3.set(px, 12, pz); d3.set(0, -1, 0); rc.set(o3, d3); rc.far = 11.8;
                        const h = rc.intersectObject(lmk.mesh, true).find(h => h.object.isMesh && h.object.visible); if (h && 12 - h.distance > 0.3 && 12 - h.distance < 3.5) return false;
                    }
                    return true;
                };
                for (const [off, out] of [[6, 0], [-6, 0], [9, 0], [-9, 0], [4, 0], [-4, 0], [6, 2], [-6, 2], [9, 2], [-9, 2], [0, 3], [12, 1], [-12, 1]]) {
                    const tx = nz, tz = -nx, x = midX + tx * off + nx * out, z = midZ + tz * off + nz * out;
                    if (onRibbon(x, z, 1.8) || buildingAt(x, z) || !clearOfModel(x, z, tx, tz, 3.2)) continue;
                    const c2 = cellOf(x, z), W = 3.2, H = W / short.aspect;
                    c2.solid.box(x, 0.15, z, W + 0.5, 0.35, 0.7, Math.atan2(nx, nz) + Math.PI / 2, rgb('#8a8d91')); // plinth
                    c2.solid.box(x, 0.5, z, W + 0.3, H + 0.5, 0.42, Math.atan2(nx, nz) + Math.PI / 2, rgb('#2b2f36')); // slab
                    for (const sd of [1, -1]) addSignQuad(c2, x, z, Math.atan2(tx, tz), sd, W, H, 0.75 + H / 2, short, 0.22);
                    lmSignColl.push([x, z]);
                    poi.landmarkSign = { x, z, y: 0.75 + H / 2, nx: tx, nz: tz, w: W, h: H, monument: true }; placed = true; break;
                }
                if (placed) continue;
                pick = { ys: 7.5, nx, nz, cx: best.x, cz: best.z, w: 8 };
            }
            const { ys, nx, nz, cx, cz, w } = pick;
            const sg = pick.text ? signs.get(pick.text, '#111827', '#ffffff', poi._color || '#f97316') || s : s;
            const hh = w / sg.aspect, mx = cx + nx * 0.15, mz = cz + nz * 0.15;
            const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
            const mbS = signMB(cellOf(mx, mz), sg.page), wh = [255, 255, 255];
            const i0 = mbS.v(lx, ys - hh / 2, lz, nx, 0, nz, sg.u0, sg.v0, wh), i1 = mbS.v(rx, ys - hh / 2, rz, nx, 0, nz, sg.u1, sg.v0, wh);
            const i2 = mbS.v(rx, ys + hh / 2, rz, nx, 0, nz, sg.u1, sg.v1, wh), i3 = mbS.v(lx, ys + hh / 2, lz, nx, 0, nz, sg.u0, sg.v1, wh);
            mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
            poi.landmarkSign = { x: mx, z: mz, y: ys, nx, nz, w, h: hh };
        }
    }

    // ground-floor shops along the streets of the CV stops (the owner drives there: give them life) — legacy corridor maps
    // only: the district worlds are real 1:1 streets, their shops come from the data (OSM shops / businesses / research);
    // invented ones put shopfronts with awnings on the residential blocks round C.A. Rosetti (Str. Georges Bizet)
    if (!realPass) for (const p of pois) if (p.cv) bGrid.each(p.x - 140, p.z - 140, p.x + 140, p.z + 140, (o) => {
        if (!o.skip && o.h > 6 && o.minH <= 0 && ['interwar', 'eclectic', 'civic', 'bloc', 'plain'].includes(o.style) && Math.hypot(o.c[0] - p.x, o.c[1] - p.z) < 140 && o.area < 6000) o.flags |= 1;
    });
    // ---- extrude buildings
    // (round 5, note 77) non-residential archetypes from the research building specs: game/src/archetypes.js
    let ARCH = null;
    try { ARCH = (await import('./archetypes.js')).createArchetypes({ city, distId, data, US, CELL, proj: (la, lo) => city.proj(la, lo), bGrid, buildingAt, nearestEdge, onRibbon, signs, addSignQuad, brandStyle, triangulate, pointInPolygon, signedArea, TILE, TILE_GRID }); ARCH.match(bRecs); }
    catch (err) { console.warn('[arch] archetypes unavailable', err); ARCH = null; }
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    const propColl = []; // small circles for street furniture (trees, posts, shelters…)
    const treeClear = []; // (after round 6) {x, z, r}: no trees here (fuel forecourts)
    const addPropColl = (x, z, r, kind = 'prop') => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind });
    propColl.push(...sportsColl); // (pitch / court fences, dugouts, goal and hoop posts)
    // ---- landmark ground fences (2026-11-08, owner: "the Rosetti fence is on the street"): the model's fence line follows the
    //      OSM grounds, which the game's wider road + sidewalk ribbons overlap (Rosetti: OSM draws the grounds' east edge on
    //      the Garibaldi centre line). Every point that falls on a carriageway or sidewalk is moved out to the property line
    //      (sidewalk's back edge + 0.15 m) on the side of the grounds (`inside`), gates included; styles: 'bars' (iron bars
    //      on a concrete plinth, `plinth: 'arches'` = painted arches) and 'mesh' (welded-mesh panels on posts); collision.
    const fenceSegs = []; // for the property-line fences: no second fence along a landmark's
    {
        const plinth = rgb('#a9a59c'), bars = rgb('#2e3438'), pill = rgb('#cfc8b8'), meshC = rgb('#87928a'), plWhite = rgb('#e3dfd5');
        const ARCH = ['#d8473f', '#f0b62e', '#3f7fc4', '#5aa35a', '#e07a2e'].map(rgb);
        const offStreet = (x, z, inside) => { // → [x, z] on the property line when (x, z) is on a street's carriageway / sidewalk
            for (let it = 0; it < 3; it++) {
                const ne = nearestEdge(x, z, (e) => !e.virtual && !e.tunnel, 25); if (!ne) break;
                const e = ne.edge; let sd = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
                const need = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                if (ne.d >= need - 0.01 && !onRibbon(x, z, 0.2)) break;
                if (inside) { // the grounds' side of the street, whichever side of the centre line OSM put the point on
                    const inP = pointInPolygon(ne.cx + e.nx * need, ne.cz + e.nz * need, inside), inM = pointInPolygon(ne.cx - e.nx * need, ne.cz - e.nz * need, inside);
                    if (inP !== inM) sd = inP ? 1 : -1;
                }
                const nd = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(0.6, e.sidewalk || 0) + 0.15;
                x = ne.cx + e.nx * sd * nd; z = ne.cz + e.nz * sd * nd;
            }
            return [x, z];
        };
        for (const f of landmarkFences) {
            const R0 = f.ring, n = R0.length, segs = f.closed ? n : n - 1, mesh = f.style === 'mesh';
            const pts = [];
            for (let i = 0; i < segs; i++) { const [ax, az] = R0[i], [bx, bz] = R0[(i + 1) % n], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / 1.0)); for (let j = 0; j < k; j++) pts.push(offStreet(ax + (bx - ax) * j / k, az + (bz - az) * j / k, f.inside)); }
            if (!f.closed) pts.push(offStreet(...R0[n - 1], f.inside)); else pts.push(pts[0]);
            const gates = (f.gates || []).map(g => { const [x, z] = offStreet(g.x, g.z, f.inside); return { ...g, x, z }; });
            const inGate = (x, z) => gates.some(g => Math.hypot(x - g.x, z - g.z) < g.w / 2);
            let run = 0; // metres along the fence (posts / arches at a steady pitch)
            for (let i = 0; i < pts.length - 1; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05 || L > 6) continue;
                const mx = (ax + bx) / 2, mz = (az + bz) / 2, r0 = run; run += L;
                if (inGate(mx, mz) || buildingAt(mx, mz) || onRibbon(mx, mz, 0.1)) continue;
                const ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), ux = (bx - ax) / L, uz = (bz - az) / L, v0s = c.solid.vc, v0d = c.detail.vc;
                const wire = (px, pz, y0, y1, w, col) => { c.detail.wall(px - ux * w, pz - uz * w, px + ux * w, pz + uz * w, y0, y1, -uz, ux, col); c.detail.wall(px + ux * w, pz + uz * w, px - ux * w, pz - uz * w, y0, y1, uz, -ux, col); };
                if (mesh) { // welded-mesh panels (f.h tall, 2 m default): vertical wires every 0.33 m, flat horizontal wires every ≈ 0.45 m + a
                    //         V-bend, posts every 2.5 m (thin two-sided strips, not boxes: ≈ 30 triangles a metre — the frame budget)
                    const fh = f.h || 2.0, hz = (y, t) => { c.detail.wall(ax, az, bx, bz, Y.side + y, Y.side + y + t, -uz, ux, meshC); c.detail.wall(bx, bz, ax, az, Y.side + y, Y.side + y + t, uz, -ux, meshC); };
                    c.solid.box(mx, Y.side, mz, 0.12, 0.12, L + 0.02, ang, plinth);
                    const nV = Math.max(1, Math.round(L / 0.33));
                    for (let j = 0; j < nV; j++) { const t = (j + 0.5) / nV; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.12, Y.side + fh, 0.011, meshC); }
                    const nH = Math.max(3, Math.round((fh - 0.3) / 0.45)); for (let k = 0; k <= nH; k++) hz(0.3 + (fh - 0.33) * k / nH, 0.025);
                    hz(fh * 0.66, 0.06);
                    if (Math.floor(r0 / 2.5) !== Math.floor(run / 2.5)) c.solid.box(ax, Y.side, az, 0.07, fh + 0.08, 0.07, ang, meshC);
                } else {
                    c.solid.box(mx, Y.side, mz, 0.28, 0.45, L + 0.02, ang, f.plinth === 'arches' ? plWhite : plinth);
                    c.solid.box(mx, Y.side + 1.95, mz, 0.06, 0.06, L, ang, bars); c.detail.box(mx, Y.side + 0.75, mz, 0.05, 0.05, L, ang, bars);
                    const nP = Math.max(1, Math.round(L / 0.14));
                    for (let j = 0; j < nP; j++) { const t = (j + 0.5) / nP; wire(ax + (bx - ax) * t, az + (bz - az) * t, Y.side + 0.45, Y.side + 2.0, 0.017, bars); }
                    if (i % 3 === 0) c.solid.box(ax, Y.side, az, 0.12, 2.1, 0.12, ang, bars);
                    if (f.plinth === 'arches') { // painted rainbow arches on both faces of the plinth, one per metre
                        const col = ARCH[Math.floor(r0) % ARCH.length];
                        for (const sg of [1, -1]) { const ox = -uz * sg * 0.145, oz = ux * sg * 0.145, nx = -uz * sg, nz = ux * sg;
                            const seg = (t0, t1, y0, y1) => { const x0 = mx + ux * t0 + ox, z0 = mz + uz * t0 + oz, x1 = mx + ux * t1 + ox, z1 = mz + uz * t1 + oz; if (sg > 0) c.detail.wall(x0, z0, x1, z1, Y.side + y0, Y.side + y1, nx, nz, col); else c.detail.wall(x1, z1, x0, z0, Y.side + y0, Y.side + y1, nx, nz, col); };
                            const h = Math.min(0.42, L / 2 - 0.02); seg(-h, -h + 0.09, 0.06, 0.3); seg(h - 0.09, h, 0.06, 0.3); seg(-h + 0.05, h - 0.05, 0.3, 0.4); }
                    }
                }
                liftOnSide(c, v0s, v0d, mx, mz, 0.6);
                propColl.push({ x: mx, z: mz, hw: 0.15, hd: L / 2, angle: ang, r: Math.hypot(0.15, L / 2), poly: null, h: 2, prop: true, kind: 'fence' });
                fenceSegs.push([ax, az, bx, bz]);
            }
            for (const g of gates) { // gate pillars on the fence line either side of the opening
                let best = null, bd = 6; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - g.x, pts[i][1] - g.z); if (d < bd) { bd = d; best = i; } }
                if (best == null) continue;
                const a = pts[Math.max(0, best - 3)], b2 = pts[Math.min(pts.length - 1, best + 3)], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1, ux = (b2[0] - a[0]) / L, uz = (b2[1] - a[1]) / L, [gx, gz] = pts[best];
                for (const sg of [-1, 1]) { const px = gx + ux * sg * (g.w / 2 + 0.2), pz = gz + uz * sg * (g.w / 2 + 0.2); if (!onRibbon(px, pz, 0.25)) { cellOf(px, pz).solid.box(px, Y.side + (raisedTop(px, pz, 0.6) !== null ? DY_SIDE : 0), pz, 0.45, 2.4, 0.45, Math.atan2(ux, uz), pill); addPropColl(px, pz, 0.3, 'fence'); } }
            }
        }
    }
    for (const [x, z] of lmSignColl) addPropColl(x, z, 1.4, 'sign');
    let wallTris = 0;
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        const brng = makeRng(b.i * 7919 + 13);
        const AR = b.arch && ARCH ? ARCH.emit(b, c, makeRng(b.i * 7919 + 17)) : null; // archetype walls / detail / flat roof (b.h may change)
        // (2026-11-08) Bucharest villas keep the interwar facade tiles but the villa quarter's warmer plasters (cream, ochre,
        // pale yellow, salmon, off-white, sage — Floreasca / Dorobanți), not the interwar blocks' greys
        const pal = (b.villa && VILLA_PAL) || palette[b.style] || palette.plain;
        // OSM / research colour first, but the research estimates are mostly the same pale beige: a pale, unsaturated
        // tagged colour only sets the tone, the hue comes from the city / style / era palette (per-building variety)
        const palPick = rgb(pal[Math.floor(brng() * pal.length)]);
        let wallCol = palPick;
        if (b.colour && b.style !== 'glass') {
            const tc = rgb(b.colour), mx = Math.max(...tc), mn = Math.min(...tc), sat = mx ? (mx - mn) / mx : 0;
            wallCol = sat > 0.3 || mx < 120 ? tc : mixRgb(tc, palPick, 0.85); // (research estimates: tone only)
        }
        { // per-building hue / value jitter
            const j = 0.9 + brng() * 0.16, w = (brng() - 0.5) * 0.08;
            wallCol = [clamp(Math.round(wallCol[0] * j * (1 + w)), 0, 255), clamp(Math.round(wallCol[1] * j), 0, 255), clamp(Math.round(wallCol[2] * j * (1 - w)), 0, 255)];
            if (b.style !== 'glass') { const l = (wallCol[0] + wallCol[1] + wallCol[2]) / 3, k = 1.35; wallCol = wallCol.map(v => clamp(Math.round(l + (v - l) * k), 0, 255)); } // (AgX desaturates pale plasters)
        }
        if (b.cv) wallCol = shadeRgb(rgb('#f4f1ea'), 1);
        // very dark researched / tagged facades (dark glass, black cladding: linear luminance < 0.05) read as flat black
        // blocks in shade: lift them to dark-grey glass and give them the curtain-wall tile
        const lum = (0.2126 * wallCol[0] + 0.7152 * wallCol[1] + 0.0722 * wallCol[2]) / 255;
        let darkGlass = false;
        if (lum < 0.05) { wallCol = lum > 0.004 ? shadeRgb(wallCol, 0.07 / lum) : [17, 19, 22]; darkGlass = true; }
        // facade texture: base tile or its variant (atlas rows 2–3), slightly varied bay width per building
        const tile = (darkGlass ? TILE.glass : (TILE[b.style] ?? 7)) + (brng() < 0.5 ? 8 : 0);
        let floorH = b.style === 'bloc' ? 2.9 : b.style === 'glass' ? 3.6 : b.style === 'eclectic' || b.style === 'church' ? 3.7 : 3.2;
        if (b.levels > 0 && b.style !== 'church') floorH = clamp((b.h - Math.max(0, b.minH)) / b.levels, 2.6, 5.5); // real floor count from building:levels
        const bayW = (b.style === 'glass' ? 2.4 : b.style === 'house' ? 3.6 : 3.3) * (0.88 + brng() * 0.24);
        const ring = b.ring;
        const ccw = signedArea(ring) > 0; // counter-clockwise (x right, z up) → outward normal = (dz, -dx)
        const h = b.h, y0 = Math.max(0, b.minH) + 0.18;
        // (after round 6) whole storeys: the wall holds an integer number of window rows, so the top row is never sliced
        // by the eaves / roof line (it was wherever the height wasn't a multiple of the storey height)
        if (b.style !== 'church' && h - y0 > 2) { const n = Math.max(1, Math.round((h - y0) / floorH)); floorH = (h - y0) / n; }
        const shop = (b.flags & 1) && b.minH <= 0 && h > 6;
        if (shop && !b.shopFaces && distId) b.shopFaces = streetFacing(b, signedArea(b.ring) > 0); // (district worlds: shopfronts on the street faces only)
        const yShop = y0 + (b.gfh || 4.2); // (researched ground-floor height)
        const pitched = b.roof === 'gabled' || b.roof === 'pyramid';
        const wallTop = h;
        // (2026-11-08, owner: "this building still has weird windows at the roof") the facade tile repeats one window row per
        // storey from the top of the shopfront: the storeys above a shop must also be whole, or the last row is sliced by the roof
        if (shop && b.style !== 'church' && h - yShop > 2) { const n = Math.max(1, Math.round((h - yShop) / floorH)); floorH = (h - yShop) / n; }
        let perim = 0;
        if (!AR) for (let k = 0; k < ring.length; k++) { // (archetype buildings: walls from archetypes.js)
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            // outward normal: for signedArea<0 (counter-clockwise on screen with z down) the right-hand normal points out
            let nx = (bz - az) / L, nz = -(bx - ax) / L;
            if (!ccw) { nx = -nx; nz = -nz; }
            const [gc, gr] = TILE_GRID[tile] || [1, 1];
            // (after round 6) whole window bays per wall, restarting at every corner: windows were sliced at the corners of
            // narrow houses (the bays ran on round the perimeter); a wall too short for a bay shows plain wall
            const nbay = Math.round(L / bayW), u0 = k * 5, u1 = nbay > 0 ? u0 + nbay / gc : u0 + 0.02 / gc;
            if (shop && !(b.shopFaces && !b.shopFaces[k])) { // (researched shopfronts: street faces only)
                // (district worlds: the shopfront's frame / piers take a light tint of the building's plaster, so a unit in
                //  an old house reads as windows in a rendered wall, not an aluminium curtain)
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, distId ? mixRgb(wallCol, [255, 255, 255], 0.45) : rgb('#ffffff'), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (b.i % 2) * 8);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / (floorH * gr), tile);
                // night light spill on the sidewalk in front of the shop window (additive decal, 0 by day)
                if (L > 2.5) {
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, D = 3.0;
                    const ne = nearestEdge(mx + nx * 3, mz + nz * 3, (e) => !e.virtual && e.type !== 'service', 30);
                    // only shopfronts on a street (its carriageway within ≈ 12 m: a sidewalk), never fronts on a square / plaza
                    const wallToRoad = ne ? Math.max(0, ne.d + 3 - (((mx + nx * 3 - ne.cx) * ne.edge.nx + (mz + nz * 3 - ne.cz) * ne.edge.nz) >= 0 ? ne.edge.wR : ne.edge.wL)) : Infinity;
                    if (ne && wallToRoad < 12 && !buildingAt(mx + nx * 1.5, mz + nz * 1.5) && !isPark(mx + nx * 2, mz + nz * 2)) {
                        const sb = c.spill || (c.spill = new MeshBuilder()), w0 = [255, 255, 255], yS2 = (raisedTop(mx + nx * 1.5, mz + nz * 1.5) !== null ? Y.road + Y.kerb : Y.side) + 0.02;
                        // inset 0.3 m at both ends; stop at the kerb (never on the carriageway)
                        const ux = (bx - ax) / L, uz = (bz - az) / L, p0x = ax + ux * 0.3, p0z = az + uz * 0.3, p1x = bx - ux * 0.3, p1z = bz - uz * 0.3;
                        let d = Math.min(D, wallToRoad - 0.4); const offRoad = (dd) => { for (const f of [0, 0.25, 0.5, 0.75, 1]) { const px = p0x + (p1x - p0x) * f + nx * dd, pz = p0z + (p1z - p0z) * f + nz * dd; if (onRibbon(px, pz, 0.25)) return false; } return true; }; while (d > 0.8 && !offRoad(d)) d -= 0.4;
                        if (d > 0.8) {
                            const i0 = sb.v(p0x, yS2, p0z, 0, 1, 0, 0.5, 1, w0), i1 = sb.v(p1x, yS2, p1z, 0, 1, 0, 0.5, 1, w0);
                            const i2 = sb.v(p1x + nx * d, yS2, p1z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0), i3 = sb.v(p0x + nx * d, yS2, p0z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0);
                            sb.triUp(i0, i1, i2); sb.triUp(i0, i2, i3);
                        }
                    }
                }
            } else mb.wall(ax, az, bx, bz, y0, wallTop, nx, nz, wallCol, u0, u1, shop ? (y0 - yShop) / (floorH * gr) : 0, (wallTop - (shop ? yShop : y0)) / (floorH * gr), tile);
            if (!shop && L > 2 && b.style !== 'glass' && b.style !== 'house' && wallTop > 6) mb.wall(ax + nx * 0.04, az + nz * 0.04, bx + nx * 0.04, bz + nz * 0.04, y0, y0 + 0.9, nx, nz, shadeRgb(wallCol, 0.68)); // darker plinth
            wallTris += shop ? 4 : 2;
            perim += L;
        }
        if (!AR) addDetail(b, h > 40 ? mb : c.detail, brng, wallCol, h, y0, shop, yShop, floorH, ccw); // (cornices / balconies / mullions: near LOD only, except towers' silhouettes)
        // (2026-11-08, owner: the Piața Floreasca service lane ran into a blank wall) where a large named building's own
        // service lane meets its wall: a dark portal (loading bay / building passage) with a concrete frame
        if (b.flags & 64) edgesInBox(b.x0 - 2, b.z0 - 2, b.x1 + 2, b.z1 + 2, (e) => {
            if (e.type !== 'service' || e.virtual) return;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
                const d1x = e.b.x - e.a.x, d1z = e.b.z - e.a.z, d2x = bx - ax, d2z = bz - az, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-6) continue;
                const t = ((ax - e.a.x) * d2z - (az - e.a.z) * d2x) / den, u = ((ax - e.a.x) * d1z - (az - e.a.z) * d1x) / den;
                if (t < 0 || t > 1 || u < 0 || u > 1) continue;
                const px = e.a.x + d1x * t, pz = e.a.z + d1z * t, ux = d2x / L, uz = d2z / L;
                let nx = uz, nz = -ux; if (!ccw) { nx = -nx; nz = -nz; }
                const hw = Math.min(L / 2 - 0.3, Math.max(e.wR, e.wL) + 0.9), hp = Math.min(4.3, h - y0 - 0.8); if (hw < 1.2 || hp < 2.4) continue;
                const p0x = px - ux * hw + nx * 0.06, p0z = pz - uz * hw + nz * 0.06, p1x = px + ux * hw + nx * 0.06, p1z = pz + uz * hw + nz * 0.06;
                mb.wall(p0x, p0z, p1x, p1z, y0, y0 + hp, nx, nz, rgb('#1d1f22'));                                            // the opening
                c.solid.box(px + nx * 0.18, y0 + hp, pz + nz * 0.18, 0.35, 0.45, hw * 2 + 0.7, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75)); // lintel
                for (const sg of [-1, 1]) c.solid.box(px + ux * sg * (hw + 0.17) + nx * 0.18, y0, pz + uz * sg * (hw + 0.17) + nz * 0.18, 0.35, hp, 0.35, Math.atan2(ux, uz), shadeRgb(wallCol, 0.75));
            }
        });
        // roof (own mesh / material: world.vegetation.roofMaterials, so weather can tint it, e.g. snow)
        const rmb = c.roof;
        const flatRoofCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.flat[Math.floor(brng() * roofCols.flat.length)]);
        const pitchCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.pitched[Math.floor(brng() * roofCols.pitched.length)]);
        const quad4 = ring.length === 4 || (ring.length === 5 && Math.hypot(ring[0][0] - ring[4][0], ring[0][1] - ring[4][1]) < 0.3);
        if (AR && !AR.roof) { /* (archetypes.js: flat roof, parapet, plant) */ } else if ((b.roof === 'hipped' || b.roof === 'skillion') && quad4) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const P = (p, y = h) => [p[0], y, p[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - b.c[0], cy - h + 0.01, cz - b.c[1]]; };
            const depth = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            if (b.roof === 'hipped') {
                const rise = clamp(depth * 0.32, 1.2, 5);
                const m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], m30 = [(p3[0] + p0[0]) / 2, (p3[1] + p0[1]) / 2];
                const len = Math.hypot(m12[0] - m30[0], m12[1] - m30[1]) || 1, ux = (m12[0] - m30[0]) / len, uz = (m12[1] - m30[1]) / len;
                const inset = Math.min(depth / 2, len * 0.45);
                const r1 = [m12[0] - ux * inset, h + rise, m12[1] - uz * inset], r0 = [m30[0] + ux * inset, h + rise, m30[1] + uz * inset];
                rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
                rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
                rmb.face3(P(p1), P(p2), r1, shadeRgb(pitchCol, 0.92), outOf([P(p1), P(p2), r1]));
                rmb.face3(P(p3), P(p0), r0, shadeRgb(pitchCol, 0.92), outOf([P(p3), P(p0), r0]));
            } else { // skillion: one slope rising toward p2–p3
                const rise = clamp(depth * 0.18, 0.8, 3);
                rmb.face4(P(p0), P(p1), P(p2, h + rise), P(p3, h + rise), pitchCol, [0, 1, 0]);
                const nb = [p3[0] - p0[0], 0, p3[1] - p0[1]];
                mb.face4(P(p2), P(p3), P(p3, h + rise), P(p2, h + rise), wallCol, nb); // (skillion upstand: plain)
                mb.face3(P(p1), P(p2), P(p2, h + rise), wallCol, outOf([P(p1), P(p2)]));
                mb.face3(P(p3), P(p0), P(p3, h + rise), wallCol, outOf([P(p3), P(p0)]));
            }
        } else if (b.roof === 'gabled' && ring.length === 4) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const rise = clamp(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.35, 1.2, 4.5);
            const r1 = [(p1[0] + p2[0]) / 2, h + rise, (p1[1] + p2[1]) / 2], r0 = [(p3[0] + p0[0]) / 2, h + rise, (p3[1] + p0[1]) / 2];
            const P = (p) => [p[0], h, p[1]];
            const mid = [b.c[0], h + rise * 0.5, b.c[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - mid[0], cy - mid[1] + 0.01, cz - mid[2]]; };
            rmb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
            rmb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
            mb.face3(P(p1), P(p2), r1, wallCol, outOf([P(p1), P(p2), r1])); // (gable end: plain plaster — the window tile put windows in the roof triangle)
            mb.face3(P(p3), P(p0), r0, wallCol, outOf([P(p3), P(p0), r0]));
        } else if ((pitched || b.roof === 'hipped') && ring.length <= 10 && convexRing(ring)) {
            const rise = clamp(Math.sqrt(b.area) * 0.32, 1.2, 6);
            const apex = [b.c[0], h + rise, b.c[1]];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], bb = ring[(k + 1) % ring.length];
                const pa = [a[0], h, a[1]], pb = [bb[0], h, bb[1]];
                rmb.face3(pa, pb, apex, pitchCol, [(a[0] + bb[0]) / 2 - b.c[0], 0.5, (a[1] + bb[1]) / 2 - b.c[1]]);
            }
        } else if ((pitched || b.roof === 'hipped') && ring.length <= 24 && insetRing(ring, b.area)) {
            // (2026-11-08, owner: "multiple roofs seem incomplete") an L / T / U footprint: the centroid fan crossed itself
            // (holes, backwards faces). A hip roof that rises from the eaves to an inset copy of the outline, flat between.
            const inner = insetRing(ring, b.area), d = inner.d, rise = d * 0.62;
            for (let q = 0; q < ring.length; q++) {
                const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner.p[q], i1 = inner.p[(q + 1) % ring.length];
                const ex = a1[0] - a0[0], ez = a1[1] - a0[1], el = Math.hypot(ex, ez) || 1, sg = signedArea(ring) > 0 ? 1 : -1;
                rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], q % 2 ? pitchCol : shadeRgb(pitchCol, 0.94), [sg * ez / el, 1.2, -sg * ex / el]);
            }
            const { pts, tris } = triangulate(inner.p);
            if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(pitchCol, 0.9), 0.1, -1);
        } else {
            const mansard = (b.roof === 'mansard' && b.area < 6000) || (b.roof === 'flat' && b.style === 'eclectic' && b.area > 120 && b.area < 2500 && h > 10);
            if (mansard) { // slate mansard roof: sloped ring up to an inset flat top
                const k = clamp(1 - 1.3 / (Math.sqrt(b.area) / 2), 0.45, 0.9), rise = 2.6;
                const inner = ring.map(([x, z]) => [b.c[0] + (x - b.c[0]) * k, b.c[1] + (z - b.c[1]) * k]);
                const slate = b.roofColour ? rgb(b.roofColour) : rgb(brng() < 0.5 ? '#4b4f57' : '#5a4a41');
                for (let q = 0; q < ring.length; q++) {
                    const a0 = ring[q], a1 = ring[(q + 1) % ring.length], i0 = inner[q], i1 = inner[(q + 1) % ring.length];
                    rmb.face4([a0[0], h, a0[1]], [a1[0], h, a1[1]], [i1[0], h + rise, i1[1]], [i0[0], h + rise, i0[1]], slate, [(a0[0] + a1[0]) / 2 - b.c[0], 1, (a0[1] + a1[1]) / 2 - b.c[1]]);
                }
                const { pts, tris } = triangulate(inner);
                if (tris.length) rmb.flatPoly(pts, tris, h + rise, shadeRgb(slate, 0.85), 0.1, -1);
            } else {
            const { pts, tris } = triangulate(ring);
            if (tris.length) rmb.flatPoly(pts, tris, h, b.style === 'glass' && !b.roofColour ? rgb('#3b4a57') : flatRoofCol, 0.1, -1);
            }
            // parapet line + rooftop clutter on large flat roofs
            if (b.area > 250 && h > 9 && b.style !== 'house') {
                const s = Math.sqrt(b.area) * 0.18;
                mb.box(b.c[0] + (brng() - 0.5) * s, h, b.c[1] + (brng() - 0.5) * s, clamp(s, 2, 7), 2.2, clamp(s * 0.8, 2, 6), brng() * 3, shadeRgb(flatRoofCol, 1.15));
            }
            if (b.roof === 'dome') { const r = clamp(Math.sqrt(b.area) * 0.28, 3, 14); rmb.geo(props().sphere, b.c[0], h, b.c[1], 0, r, r * 0.9, r, rgb(b.style === 'church' ? '#7a8a8f' : '#8c9aa3')); }
        }
        if (b.style === 'church' && b.area > 120) { // a bell tower / cupola
            const r = clamp(Math.sqrt(b.area) * 0.12, 1.5, 4);
            mb.box(b.c[0], h, b.c[1], r * 2, r * 2.4, r * 2, 0, wallCol, tile);
            mb.geo(props().sphere, b.c[0], h + r * 2.4, b.c[1], 0, r * 1.05, r * 1.4, r * 1.05, rgb('#6f8f86'));
        }
        if (h >= 5 && b.style !== 'church' && !AR && !(b.flags & 32)) addNearDetail(b, c.detail, brng, wallCol, h, y0, shop, yShop, floorH, bayW, ccw, flatRoofCol); // (flags 32: the scenery ring outside the playable area — no street-level clutter)
        // collision
        collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(([x, z]) => Math.hypot(x - b.c[0], z - b.c[1]))), poly: ring, angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, h, poi: b.cv || undefined });
        // facade sign
        if ((b.flags & 2) && b.name && (b.cvSign || b.area < 20000) && !AR?.signed) addFacadeSign(b, h, shop, wallCol);
    }
    // archetype facades: one mesh per 500 m super-cell, the city's facade shader on the archetype atlas (shutters follow
    // the city's shop-closing share); stats in world.group.userData.archetypes
    if (ARCH) { try { const archG = new THREE.Group(); archG.name = 'archetypes'; for (const m of ARCH.finish(solidMaterial, () => solidMat.userData.uClosed.value)) archG.add(m); group.add(archG); group.userData.archetypes = ARCH.stats; } catch (err) { console.warn('[arch] meshes failed', err); } }

    // ---- facade detail (cornices, bands, balconies, colonnades, mullions, awnings)
    function streetFacing(b, ccw) {
        const ring = b.ring, out = new Array(ring.length).fill(false);
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2 + nx * 2, mz = (az + bz) / 2 + nz * 2;
            const ne = nearestEdge(mx, mz, null, 40);
            if (ne && ne.d < 35 && ((ne.cx - mx) * nx + (ne.cz - mz) * nz) > 0) out[k] = true;
        }
        return out;
    }
    /**
     * near-LOD facade / roof geometry (own 500 m super-cell meshes, drawn within ≈ 300 m; beyond, the facade atlas alone):
     * eclectic window surrounds + pediments, pilasters, rusticated ground floor; interwar floor bands; bloc balconies with
     * mixed enclosures, AC units, satellite dishes; glass spandrel bands + podium canopies; rooftop parapets, HVAC units,
     * water tanks (RO), elevator overruns, antennas. Window positions follow the facade atlas grid (TILE_GRID).
     */
    function addNearDetail(b, db, brng, wallCol, h, y0, shop, yShop, floorH, bayW, ccw, roofCol) {
        const st = b.style, ring = b.ring, n = ring.length, pitched = b.roof !== 'flat' && b.roof !== 'dome' && b.roof !== 'mansard';
        const faces = streetFacing(b, ccw);
        const yTop = h, yFirst = shop ? yShop : y0;
        const floors = Math.max(0, Math.floor((yTop - yFirst - 0.6) / floorH));
        const trim = st === 'eclectic' || st === 'civic' ? mixRgb(wallCol, [236, 230, 218], 0.6) : shadeRgb(wallCol, 0.82), deep = shadeRgb(wallCol, 0.62);
        let perim = 0;
        for (let k = 0; k < n; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az);
            const p0 = perim; perim += L;
            if (L < 4 || !faces[k]) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const ux = (bx - ax) / L, uz = (bz - az) / L, ang = Math.atan2(ux, uz);
            const P = (s2, o) => [ax + ux * s2 + nx * o, az + uz * s2 + nz * o];
            // cheap projecting element: front face + top (+ ends when deep): 4–8 triangles instead of a 12-triangle box
            const slab = (s2, y, w, hh, d, col, ends = d > 0.3) => {
                const [x0, z0] = P(s2 - w / 2, d), [x1, z1] = P(s2 + w / 2, d), [b0x, b0z] = P(s2 - w / 2, 0.02), [b1x, b1z] = P(s2 + w / 2, 0.02);
                db.wall(x0, z0, x1, z1, y, y + hh, nx, nz, col);
                db.flatQuad(b0x, b0z, b1x, b1z, x1, z1, x0, z0, y + hh, shadeRgb(col, 1.06), 0, -1);
                if (ends) { db.wall(b0x, b0z, x0, z0, y, y + hh, -ux, -uz, shadeRgb(col, 0.9)); db.wall(x1, z1, b1x, b1z, y, y + hh, ux, uz, shadeRgb(col, 0.9)); }
            };
            // window centres along this edge: the atlas puts one window column per bay, centred at (i + 0.5) bays
            const cols = []; for (let i = Math.ceil(p0 / bayW - 0.5); (i + 0.5) * bayW - p0 < L - 0.6; i++) { const s2 = (i + 0.5) * bayW - p0; if (s2 > 0.6) cols.push(s2); }
            if (st === 'eclectic' || st === 'civic') {
                for (let f = 0; f < Math.min(floors, 5); f++) { // (surrounds on the lower five storeys: what a driver sees)
                    const yb = yFirst + f * floorH, wTop = yb + floorH * 0.8, wBot = yb + floorH * 0.2;
                    for (const s2 of cols) {
                        slab(s2, wTop, bayW * 0.56, 0.28, 0.32, trim, false);                                // lintel / cornice over the window
                        if (f === 0 && st === 'eclectic') slab(s2, wTop + 0.28, bayW * 0.4, 0.34, 0.2, shadeRgb(trim, 0.95), false); // pediment
                        slab(s2, wBot - 0.12, bayW * 0.56, 0.12, 0.24, trim, false);                           // sill
                    }
                }
                if (cols.length > 3) for (let i = 1; i < cols.length; i += 2) { // pilasters between bays
                    slab((cols[i - 1] + cols[i]) / 2, yFirst, 0.45, Math.max(0.5, yTop - 0.8 - yFirst), 0.16, trim, false);
                }
                if (!shop && y0 + 3.6 < yTop) for (let y = y0 + 0.5; y < y0 + 3.6; y += 0.55) { // rusticated ground floor
                    const [x0, z0] = P(0, 0.05), [x1, z1] = P(L, 0.05); db.wall(x0, z0, x1, z1, y, y + 0.06, nx, nz, deep);
                }
            } else if (st === 'interwar') {
                for (let f = 0; f <= floors; f++) { // continuous parapet bands under the ribbon windows
                    const y = yFirst + f * floorH + floorH * 0.12; if (y > yTop - 0.8) break;
                    const [x0, z0] = P(0, 0.25), [x1, z1] = P(L, 0.25);
                    db.wall(x0, z0, x1, z1, y - 0.35, y, nx, nz, mixRgb(wallCol, [245, 242, 236], 0.5)); db.flatQuad(ax, az, bx, bz, x1, z1, x0, z0, y, [240, 238, 232], 0, -1);
                }
                if (brng() < 0.25 && L > 10) { const [x, z] = P(L * 0.5, 0.3); db.box(x, yTop, z, 0.06, 4, 0.06, 0, rgb('#cfcfcf')); } // flag pole
            } else if (st === 'bloc') {
                const ACC = ['#c0564a', '#4f7fa8', '#d99a3a', '#6c9a5a', '#8d6a9e', '#d7d2c4', '#3f6f78'].map(rgb);
                const accent = ACC[Math.floor(brng() * ACC.length)];
                // (play-test note 10c) balconies read as balconies: real blocks stack the same balcony type up a bay column
                // (open slab + parapet, or enclosed by the owners: glazed / clad), with one parapet colour per building;
                // AC units hang on the balcony fronts / under windows, small and white, with a dark grille
                const neutral = shadeRgb(wallCol, 0.86), encl = [rgb('#c9d0cf'), rgb('#b8b2a3'), neutral];
                const colType = cols.map(() => { const r = brng(); return r < 0.55 ? 'open' : r < 0.85 ? 'glazed' : 'clad'; });
                // (2026-11-08, Street View walk of Str. Garibaldi) the low 1950s–60s blocks of the district worlds' villa
                // quarter (≤ 5 storeys) have plain balconies: no coloured parapet accents
                const colAcc = cols.map(() => brng() < (distId && floors <= 5 ? 0 : 0.35));
                for (let f = 1; f < Math.min(floors, 9); f++) {
                    const yb = yFirst + f * floorH;
                    for (let i = 0; i < cols.length; i++) {
                        const s2 = cols[i], r = brng();
                        if (i % 2 === 0) {
                            const t = r < 0.12 ? (colType[i] === 'open' ? 'glazed' : 'open') : colType[i]; // (a few owners differ)
                            slab(s2, yb - 0.1, bayW * 0.9, 0.12, 1.1, neutral);                                   // slab
                            const front = colAcc[i] ? accent : t === 'clad' ? encl[i % encl.length] : neutral;
                            slab(s2, yb + 0.02, bayW * 0.9, 0.95, 1.1, front, false);                            // parapet front
                            if (t === 'glazed') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.02, rgb('#71879a'));     // glazed upper part
                            else if (t === 'clad') slab(s2, yb + 0.97, bayW * 0.88, floorH - 1.15, 1.04, shadeRgb(front, 0.92));
                            if (r > 0.82) { slab(s2 + bayW * 0.25, yb + 0.25, 0.75, 0.5, 1.32, rgb('#ececea')); slab(s2 + bayW * 0.25, yb + 0.33, 0.5, 0.32, 1.34, rgb('#55585c'), false); } // AC on the front
                        } else if (r < 0.1) { slab(s2, yb + 0.15, 0.75, 0.5, 0.3, rgb('#ececea')); slab(s2, yb + 0.23, 0.5, 0.32, 0.32, rgb('#55585c'), false); } // AC under a window
                        else if (r < 0.13) slab(s2, yb + floorH * 0.7, 0.55, 0.55, 0.14, rgb('#d6d6d0'), false); // dish
                    }
                }
                const [x0, z0] = P(0, 0.03), [x1, z1] = P(L, 0.03); // prefab panel joints (horizontal)
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.03; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.05, nx, nz, deep); }
            } else if (st === 'glass') {
                const sp = rgb(US ? '#3d4b57' : '#4a5965');
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let y = yFirst + floorH; y < yTop - 1; y += floorH) db.wall(x0, z0, x1, z1, y - 0.45, y + 0.25, nx, nz, sp); // spandrels
                if (h > 30) { const [c0x, c0z] = P(0, 2.2), [c1x, c1z] = P(L, 2.2); db.flatQuad(ax, az, bx, bz, c1x, c1z, c0x, c0z, y0 + 4.6, rgb('#3a3f45'), 0, -1); db.flatQuad(ax, az, c0x, c0z, c1x, c1z, bx, bz, y0 + 4.58, rgb('#2a2e33'), 0, -1); } // podium canopy
            } else if (US && (st === 'interwar' || st === 'bloc') && h < 25) { // brick low-rise: stone trim bands
                const [x0, z0] = P(0, 0.06), [x1, z1] = P(L, 0.06);
                for (let f = 1; f <= floors; f++) { const y = yFirst + f * floorH - 0.15; if (y < yTop - 0.4) db.wall(x0, z0, x1, z1, y, y + 0.18, nx, nz, rgb('#d8d2c4')); }
            }
        }
        // rooftop: parapet + plant (flat roofs only)
        if (!pitched && b.area > 60) {
            const pc = shadeRgb(wallCol, 0.92);
            for (let k = 0; k < n; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; if (Math.hypot(bx - ax, bz - az) < 0.5) continue; db.wall(ax, az, bx, bz, yTop, yTop + 0.9, 0, 1, pc); db.wall(bx, bz, ax, az, yTop, yTop + 0.9, 0, 1, shadeRgb(pc, 0.8)); }
            const nUnits = Math.min(6, Math.floor(b.area / 250));
            for (let u = 0; u < nUnits; u++) {
                const x = b.c[0] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45, z = b.c[1] + (brng() - 0.5) * Math.sqrt(b.area) * 0.45;
                if (!pointInPolygon(x, z, ring)) continue;
                const r = brng();
                if (r < 0.45) db.box(x, yTop, z, 1.8, 1.2, 1.2, brng() * 3, rgb('#a9adb1'));                      // HVAC
                else if (r < 0.6 && !US && st === 'bloc') db.box(x, yTop, z, 2.2, 2.6, 2.2, 0, rgb('#8d8f8c'));   // water tank / machine room
                else if (r < 0.8) db.box(x, yTop, z, 3.2, 2.8, 2.6, brng() * 3, shadeRgb(roofCol, 1.1));          // elevator overrun
                else db.box(x, yTop, z, 0.08, 4.5, 0.08, 0, rgb('#8a8a8a'));                                         // antenna
            }
        }
    }
    function addDetail(b, mb, brng, wallCol, h, y0, shop, yShop, floorH, ccw) {
        const st = b.style;
        const ring = b.ring, n = ring.length;
        const edgeN = (k) => { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n]; const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } return { ax, az, bx, bz, L, nx, nz, ux: (bx - ax) / L, uz: (bz - az) / L }; };
        let faces = null;
        if (st === 'house' || st === 'plain' || b.roof !== 'flat' && b.roof !== 'dome' || h < 6) {
            if (shop) awnings();
            return;
        }
        if (st === 'bloc' || st === 'civic' || st === 'interwar' || shop) faces = streetFacing(b, ccw);
        // projecting strip along every edge: front face + top
        const strip = (y, hh, out, col, onlyFaces = null) => {
            for (let k = 0; k < n; k++) {
                if (onlyFaces && !onlyFaces[k]) continue;
                const E = edgeN(k); if (E.L < 1) continue;
                const ox = E.nx * out, oz = E.nz * out;
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y, y + hh, E.nx, E.nz, col);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y + hh, shadeRgb(col, 1.08), 0, -1);
            }
        };
        const dark = shadeRgb(wallCol, 0.78);
        if (st !== 'glass') strip(h - 0.75, 0.75, st === 'eclectic' ? 0.5 : 0.32, dark); // cornice
        if (st === 'interwar') { for (let y = y0 + (shop ? 4.2 : floorH * 2); y < h - 3; y += floorH * 2) strip(y, 0.22, 0.14, dark, faces); }
        if (st === 'eclectic' && h > 8) strip(y0 + 4.4, 0.35, 0.22, dark);
        if (st === 'civic') { // colonnade under a projecting slab on street fronts
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                const off = 1.6;
                for (let s2 = 2; s2 < E.L - 1.5; s2 += 4) mb.box(E.ax + E.ux * s2 + E.nx * off, y0, E.az + E.uz * s2 + E.nz * off, 0.8, 6, 0.8, Math.atan2(E.ux, E.uz), shadeRgb(wallCol, 1.04));
                const ox = E.nx * (off + 0.6), oz = E.nz * (off + 0.6);
                mb.wall(E.ax + ox, E.az + oz, E.bx + ox, E.bz + oz, y0 + 6, y0 + 6.6, E.nx, E.nz, dark);
                mb.flatQuad(E.ax, E.az, E.bx, E.bz, E.bx + ox, E.bz + oz, E.ax + ox, E.az + oz, y0 + 6.6, dark, 0, -1);
            }
        }
        if (st === 'bloc') { // balconies on the street-facing fronts
            const floors = Math.min(12, Math.floor((h - y0) / floorH));
            const bc = shadeRgb(wallCol, 0.86);
            for (let k = 0; k < n; k++) {
                if (!faces[k]) continue;
                const E = edgeN(k); if (E.L < 8) continue;
                for (let f = (shop ? 2 : 1); f < floors; f++) {
                    const y = y0 + f * floorH;
                    for (let s2 = 1.2; s2 + 2.8 < E.L - 0.8; s2 += 6.2) {
                        const x0 = E.ax + E.ux * s2, z0 = E.az + E.uz * s2, x1 = x0 + E.ux * 2.8, z1 = z0 + E.uz * 2.8;
                        const ox = E.nx * 0.95, oz = E.nz * 0.95;
                        mb.wall(x0 + ox, z0 + oz, x1 + ox, z1 + oz, y, y + 1.0, E.nx, E.nz, bc);
                        mb.flatQuad(x0, z0, x1, z1, x1 + ox, z1 + oz, x0 + ox, z0 + oz, y + 1.0, shadeRgb(bc, 1.1), 0, -1);
                    }
                }
            }
        }
        if (st === 'glass') { // vertical mullions + roof crown
            const fin = shadeRgb(wallCol, 0.55);
            for (let k = 0; k < n; k++) {
                const E = edgeN(k); if (E.L < 3) continue;
                for (let s2 = 1.5; s2 < E.L - 0.5; s2 += 3) {
                    const x = E.ax + E.ux * s2 + E.nx * 0.12, z = E.az + E.uz * s2 + E.nz * 0.12;
                    mb.wall(x - E.ux * 0.14, z - E.uz * 0.14, x + E.ux * 0.14, z + E.uz * 0.14, y0, h, E.nx, E.nz, fin);
                }
            }
            strip(h - 0.2, 1.2, 0.05, rgb('#2b3a48'));
        }
        if (shop) awnings();
        function awnings() {
            if (!shop) return;
            const fc = faces || streetFacing(b, ccw);
            // (2026-11-08, Street View walk of Calea Floreasca) district worlds: most small shops in the old houses / blocks
            // have no awning — one front in three gets one, deterministic per building
            if (distId && ((b.i * 2654435761) >>> 0) % 3 !== 0) return;
            for (let k = 0; k < ring.length; k++) {
                if (!fc[k]) continue;
                const E = edgeN(k); if (E.L < 5) continue;
                const col = AWNING[(b.i + k) % AWNING.length];
                for (let s2 = 0.8; s2 + 3.6 < E.L - 0.5; s2 += 5.4) {
                    const x0 = E.ax + E.ux * s2, z0 = E.az + E.uz * s2, x1 = x0 + E.ux * 3.6, z1 = z0 + E.uz * 3.6;
                    const yt = yShop - 0.5, yb = yt - 0.7, ox = E.nx * 1.3, oz = E.nz * 1.3;
                    mb.face4([x0, yt, z0], [x1, yt, z1], [x1 + ox, yb, z1 + oz], [x0 + ox, yb, z0 + oz], col, [E.nx, 1, E.nz]);
                    mb.face4([x0, yt - 0.02, z0], [x1, yt - 0.02, z1], [x1 + ox, yb - 0.02, z1 + oz], [x0 + ox, yb - 0.02, z0 + oz], shadeRgb(col, 0.6), [0, -1, 0]);
                }
            }
        }
    }

    /** (play-test note 10a) a business inside a building: its own ground-floor fascia (brand colours + name) over its
     *  unit, on the street wall nearest to the mapped point, + a projecting blade sign; lit at night with the signs */
    let unitSigns = 0, vacantUnits = 0;
    function addUnitSign(b, x, z, text, kind) {
        if (b.skip || b.cv || (b.minH || 0) > 0.5 || b.h < 3) return;
        const ring = b.ring, ccw = signedArea(ring) > 0;
        let best = null, bd = Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1), px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
            const ne = nearestEdge(px + nx * 4, pz + nz * 4, (e) => !e.virtual && e.drivable, 30); if (!ne || buildingAt(px + nx * 1.5, pz + nz * 1.5)) continue; // (a street front)
            const d = Math.hypot(px - x, pz - z) + ne.d * 0.3; if (d < bd) { bd = d; best = { ax, az, bx, bz, L, nx, nz, t }; }
        }
        if (!best) return;
        const bs = (kind === 'vacant' ? ['#f2f2ef', '#b91c1c', null] : null) || brandStyle(text) || (kind === 'pharmacy' ? ['#15803d', '#ffffff', null] : kind === 'bank' ? ['#1e3a8a', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(((bs[3] || text).replace(/\s*\([^)]*\)/g, '').trim() || text).slice(0, 24), bs[0], bs[1], bs[2]); if (!s) return; // (data.brands[k][3] = logo text)
        const { ax, az, bx, bz, L, nx, nz } = best, tx = (bx - ax) / L, tz = (bz - az) / L;
        let w = Math.min(6.5, L - 0.8), hh = Math.min(0.7, w / s.aspect); w = Math.min(w, hh * s.aspect);
        const tc = clamp(best.t * L, w / 2 + 0.4, L - w / 2 - 0.4), mx = ax + tx * tc + nx * 0.14, mz = az + tz * tc + nz * 0.14;
        const shop = (b.flags & 1) && b.h > 6, y = b.signY != null ? b.signY - hh / 2 : shop ? (b.gfh || 4.2) - hh - 0.1 : Math.min(3.0, b.h - hh - 0.3); // (archetypes: their fascia height)
        if (signedHits(mx, mz, y)) return; // (one sign per unit: another business already signed this spot)
        const cc = cellOf(mx, mz), white = [255, 255, 255], mbS = signMB(cc, s.page);
        const lx = mx - tx * w / 2, lz = mz - tz * w / 2, rx = mx + tx * w / 2, rz = mz + tz * w / 2;
        // viewer outside looks along -n; their right-hand vector is (nz, -nx) = +t when the ring is ccw-out
        const [Lx, Lz, Rx, Rz] = (nz * tx - nx * tz) > 0 ? [lx, lz, rx, rz] : [rx, rz, lx, lz];
        const i0 = mbS.v(Lx, y, Lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(Rx, y, Rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(Rx, y + hh, Rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(Lx, y + hh, Lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
        cc.solid.box(mx - nx * 0.07, y - 0.1, mz - nz * 0.07, 0.1, hh + 0.2, w + 0.5, Math.atan2(tx, tz), rgb(bs[0])); // fascia board
        const ex = mx + tx * (w / 2 + 0.7) + nx * 0.5, ez = mz + tz * (w / 2 + 0.7) + nz * 0.5;
        if (tc + w / 2 + 1.3 < L) { // projecting blade sign (both faces), on a bracket
            cc.solid.box(ex - nx * 0.25, y + hh + 0.75, ez - nz * 0.25, 0.04, 0.04, 0.7, Math.atan2(nx, nz), rgb('#2b2b2b'));
            const cross = kind === 'pharmacy' ? signs.get('✚', '#15803d', '#ffffff', null, true) : null; // (category style: green cross)
            if (cross) addSignQuad(cc, ex, ez, Math.atan2(tx, tz), 1, 0.8, 0.8, y + hh + 0.45, cross, 0.08);
            else addSignQuad(cc, ex, ez, Math.atan2(tx, tz), 1, 1.1, Math.max(0.28, 1.1 / s.aspect), y + hh + 0.4, s, 0.05);
        }
        signedSpots.push([mx, mz, y]); unitSigns++;
    }
    const signedSpots = [];
    const signedHits = (x, z, y) => signedSpots.some(([a, b2, c]) => Math.hypot(a - x, b2 - z) < 3.5 && Math.abs(c - y) < 1);
    function addFacadeSign(b, h, shop, wallCol) {
        const ne = nearestEdge(b.c[0], b.c[1]);
        if (!ne || ne.d > 90) return;
        // wall whose outward normal faces the road and is closest to it
        const ring = b.ring; const ccw = signedArea(ring) > 0;
        let best = -1, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2;
            const tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const score = (tx * nx + tz * nz) / tl * 2 - tl / 40 + Math.min(L, 12) / 12;
            if (score > bs) { bs = score; best = k; }
        }
        if (best < 0) return;
        const [ax, az] = ring[best], [bx, bz] = ring[(best + 1) % ring.length];
        const L = Math.hypot(bx - ax, bz - az);
        let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
        const brand = brandStyle(b.name);
        const cvp = b.cv;
        const st = cvp ? ['#111827', '#ffffff', cvp._color || '#f97316'] : brand || (b.flags & 8 ? ['#b91c1c', '#ffffff', null] : ['#1f2937', '#f5f5f4', null]);
        const s = signs.get(b.name, st[0], st[1], st[2]);
        if (!s) return;
        let w = Math.min(L * 0.8, cvp ? 18 : (b.flags & 8 ? 7 : 9)); let hh = w / s.aspect;
        // (play-test note 10a) businesses sign at ground floor: a fascia over the shop window (≤ 0.75 m high) or a board
        // over the door — never a box on an upper floor; only the CV buildings keep their big sign higher up
        const hMax = cvp ? 2.4 : shop ? 0.72 : 0.85;
        if (hh > hMax) { hh = hMax; w = hh * s.aspect; } if (w > L * 0.9) { w = L * 0.9; hh = w / s.aspect; }
        const y0b = b.minH || 0;
        let y = cvp ? Math.max(4, Math.min(h - hh - 1.5, 14)) : b.signY != null ? b.signY - hh / 2 : shop ? y0b + (b.gfh || 4.2) - hh - 0.08 : y0b + Math.min(3.0, Math.max(2.4, h - hh - 0.4));
        if (y < 1) y = 1;
        const mx = (ax + bx) / 2 + nx * 0.12, mz = (az + bz) / 2 + nz * 0.12;
        // viewer outside looks along -n; their right-hand vector is (nz, -nx)
        const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
        const mbS = signMB(cellOf(b.c[0], b.c[1]), s.page);
        const white = [255, 255, 255];
        const i0 = mbS.v(lx, y, lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(rx, y, rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(rx, y + hh, rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(lx, y + hh, lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3); // (i0,i1,i2) normal = n by construction
        if (!cvp) { // fascia board in the brand colour behind the letters + a projecting (blade) sign at the end of the front
            const sb = cellOf(b.c[0], b.c[1]).solid, bg = rgb(st[0]), pad = 0.12, tx = -nz, tz = nx; // tx/tz: along the wall
            const cx0 = (ax + bx) / 2 + nx * 0.06, cz0 = (az + bz) / 2 + nz * 0.06, bw2 = Math.min(L * 0.96, w + 0.8);
            sb.box(cx0, y - pad, cz0, 0.1, hh + pad * 2, bw2, Math.atan2(tx, tz), bg);
            if (L > 4 && (b.flags & 8 || shop)) {
                const ex = (ax + bx) / 2 + tx * (bw2 / 2 + 0.6) * (L > bw2 + 2 ? 1 : 0) + nx * 0.55, ez = (az + bz) / 2 + tz * (bw2 / 2 + 0.6) * (L > bw2 + 2 ? 1 : 0) + nz * 0.55;
                const bh = 0.75, by = y + hh + 0.35;
                sb.box(ex - nx * 0.45, by + bh / 2 - 0.03, ez - nz * 0.45, 0.04, 0.04, 1.0, Math.atan2(nx, nz), rgb('#2b2b2b')); // bracket
                const bladeS = signs.get(b.name.slice(0, 14), st[0], st[1], st[2]);
                if (bladeS && L > bw2 + 2) addSignQuad(cellOf(b.c[0], b.c[1]), ex, ez, Math.atan2(tx, tz), 1, 0.8, Math.min(0.8, 0.8 / bladeS.aspect * 1.6), by, bladeS, 0.06);
            }
        }
        if (cvp) { // coloured band at the top of the CV building
            const mb = cellOf(b.c[0], b.c[1]).solid;
            const col = rgb(cvp._color || '#f97316');
            for (let k = 0; k < ring.length; k++) {
                const [px, pz] = ring[k], [qx, qz] = ring[(k + 1) % ring.length]; const LL = Math.hypot(qx - px, qz - pz); if (LL < 0.05) continue;
                let ox = (qz - pz) / LL, oz = -(qx - px) / LL; if (!ccw) { ox = -ox; oz = -oz; }
                mb.wall(px + ox * 0.08, pz + oz * 0.08, qx + ox * 0.08, qz + oz * 0.08, h - 1.0, h + 0.4, ox, oz, col);
            }
        }
    }

    // ---- rooftop advertising (R12.3) from the field research (game/research/bucharest-romana.json rooftop_signs):
    //      lit sign boxes on the roof edge facing the street / square, on a steel frame; sign-atlas material = self-lit
    const ROOF_ADS = {
        bucharest: [
            { lat: 44.44660, lon: 26.09700, text: 'Coca-Cola', bg: '#e41e2b', fg: '#ffffff', w: 26 },   // Piața Romană 9 (photo Apr 2023)
            { lat: 44.44720, lon: 26.09560, text: 'NetBet', bg: '#141a2e', fg: '#3aa0ff', w: 16 },      // Lascăr Catargiu 2–4 (photo Apr 2023)
            // Piața Victoriei: rooftop ads exist on the 1990s blocks but the current brands are not researched → unbranded frames
            { lat: 44.45160, lon: 26.08720, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
            { lat: 44.45250, lon: 26.08690, text: 'SPAȚIU PUBLICITAR', bg: '#e8e8e4', fg: '#55585c', w: 20, generic: true },
        ],
    }[city.id] || [];
    let roofAds = 0; const roofAdList = [];
    for (const ad of ROOF_ADS) {
        if (!inDistrictLL(ad.lat, ad.lon, 0)) continue;
        const q = city.proj(ad.lat, ad.lon);
        let b = buildingAt(q.x, q.z); if (b && (b.skip || b.h < 18)) b = null;
        if (!b) { let bd = 70; bGrid.each(q.x - 70, q.z - 70, q.x + 70, q.z + 70, (o) => { if (o.skip || o.area < 200 || o.h < 18) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (!b) continue; // (rooftop signs stand on blocks of ≥ 6 storeys)
        const ne = nearestEdge(b.c[0], b.c[1], (e) => !e.virtual && /^(primary|secondary|trunk)/.test(e.type), 120); if (!ne) continue;
        // the roof edge facing that road
        const ring = b.ring, ccw = signedArea(ring) > 0; let best = null, bs = -Infinity;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
            let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; }
            const mx = (ax + bx) / 2, mz = (az + bz) / 2, tx = ne.cx - mx, tz = ne.cz - mz, tl = Math.hypot(tx, tz) || 1;
            const sc = (tx * nx + tz * nz) / tl * 2 + Math.min(L, 30) / 30; if (sc > bs) { bs = sc; best = { mx, mz, nx, nz, L }; }
        }
        if (!best) continue;
        const sg = signs.get(ad.text, ad.bg, ad.fg, null, true); if (!sg) continue;
        const w = Math.min(ad.w, best.L * 0.9), hh = Math.min(4.5, w / sg.aspect), c2 = cellOf(best.mx, best.mz);
        const x = best.mx - best.nx * 1.0, z = best.mz - best.nz * 1.0, ang = Math.atan2(best.nx, best.nz), y = b.h + 1.2 + hh / 2;
        addSignQuad(c2, x, z, ang, 1, w, hh, y, sg, 0.15);
        const steel = rgb('#3a3d42');
        for (const f of [-0.42, 0, 0.42]) { const px = x + best.nz * w * f, pz = z - best.nx * w * f; c2.solid.box(px, b.h, pz, 0.14, 1.2 + hh, 0.14, ang, steel); }
        c2.solid.box(x - best.nx * 0.08, b.h + 1.2, z - best.nz * 0.08, w, hh, 0.12, ang, steel);
        roofAds++; roofAdList.push({ text: ad.text, x: Math.round(x), z: Math.round(z), y: Math.round(y), nx: +best.nx.toFixed(2), nz: +best.nz.toFixed(2) });
    }
    // (the warm 'square glow' pools were removed: render's lamps / floodlights carry the squares at night)

    // -----------------------------------------------------------------------
    //  POIs from OSM (businesses, transport…)
    // -----------------------------------------------------------------------
    setProgress('Opening the shops…'); await tick();
    const P = props();
    const fuelLog = []; // fuel forecourts: where the canopy went (or why not) — world.stats.fuel
    for (const r of data.pois) {
        const kind = data.poiKinds[r[0]];
        const x = r[1] / 10, z = r[2] / 10, name = str(r[3]), brand = str(r[4]), sub = str(r[5]), bIdx = r[6];
        const ks = KIND_STYLE[kind] || KIND_STYLE.landmark;
        const label = name || brand || (kind === 'busstop' ? (sub.startsWith('tram') ? (US ? 'Streetcar stop' : 'Stație tramvai') : (US ? 'Bus stop' : 'Stație autobuz')) : kind === 'metro' ? (US ? 'Link station' : 'Metrou') : kind);
        const poi = { id: 'osm' + pois.length, kind, sub, label, brand, x, z, doorX: x, doorZ: z, color: ks.color, icon: sub.startsWith('cafe') ? '☕' : ks.icon, visited: false, h: 4, w: 4, d: 4, interactive: false, building: bIdx };
        pois.push(poi);
        if (kind === 'fuel') { // the pump is reached from the street: door at the kerb of the nearest drivable lane
            const okLane = (q) => q.drivable && !q.virtual && !q.tunnel && !/motorway|_link/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3;
            const dn = nearestEdge(x, z, (q) => okLane(q) && q.type !== 'service', 60) || nearestEdge(x, z, okLane, 150); // a street, not the forecourt's own service lane
            if (dn) {
                const q = dn.edge, sd = ((x - dn.cx) * q.nx + (z - dn.cz) * q.nz) >= 0 ? 1 : -1;
                let off = (sd > 0 ? q.wR : q.wL) + 1.2, dx = dn.cx + q.nx * off * sd, dz = dn.cz + q.nz * off * sd;
                if (buildingAt(dx, dz)) { off = (sd > 0 ? q.wR : q.wL) + 0.4; dx = dn.cx + q.nx * off * sd; dz = dn.cz + q.nz * off * sd; }
                poi.doorX = dx; poi.doorZ = dz;
            }
        }
        const c = cellOf(x, z);
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx >= 0 && bRecs[bIdx] && (brand || name) && sub !== 'atm') addUnitSign(bRecs[bIdx], x, z, (brand || name), kind); // (ATMs do not name a unit — world-data Request)
        const ne = nearestEdge(x, z);
        if (!ne) continue;
        const e = ne.edge;
        const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        let roadAng = Math.atan2(e.dirx, e.dirz); // rotation about Y that maps local +z onto the edge direction
        if (kind === 'fuel') { // (note 5) every station gets its forecourt, also when the POI sits in its own small shop building
            // canopy on pillars + pumps + pylon sign
            let fx = x, fz = z, pyl = { e, ne, side }; // (pyl: the street the pylon / sign stands on)
            if (ne.d < (side > 0 ? e.wR : e.wL) + 9) { const off = (side > 0 ? e.wR : e.wL) + 10; fx = ne.cx + e.nx * off * side; fz = ne.cz + e.nz * off * side; }
            { // the forecourt (canopy 10 × 16 m + apron 14 × 22 m) must stay off every carriageway AND every building footprint
              // (2026-11-08: only its centre was tested, so the Pipera Petrom canopy cut through the station's own building):
              // search free ground beside the road — along the kerb ±24 m, 8–20 m back from it — else no canopy at all
                const notService = (rb) => rb.e ? rb.e.type !== 'service' : (rb.node.allEdges || rb.node.edges).some(q => q.type !== 'service'); // (the forecourt's own service lanes run under the canopy)
                const fpFreeA = (cx, cz, ang) => {
                    const fp = obbPoly({ x: cx, z: cz, hw: 7, hd: 11, angle: ang });
                    { let deck = false; surfacesAt(cx, cz, (hh) => { if (hh > Y.road + 2.5) deck = true; }); if (deck) return false; } // (never under a viaduct deck)
                    if (polyOnRibbon(fp, notService) || buildingAt(cx, cz) || fp.some(([qx, qz]) => buildingAt(qx, qz))) return false;
                    let hit = false;
                    bGrid.each(cx - 14, cz - 14, cx + 14, cz + 14, (o) => { if (hit || o.skip) return; if (o.ring.some(([qx, qz]) => pointInPolygon(qx, qz, fp)) || polysCross(o.ring, fp)) hit = true; });
                    return !hit;
                };
                // reference street: the at-grade, non-service street the pumps are reached from (else the nearest edge)
                const okRef = (q) => q.drivable && !q.virtual && !q.tunnel && q.type !== 'service' && !/motorway/.test(q.type) && Math.abs(q.ya) < 0.3 && Math.abs(q.yb) < 0.3;
                const rn = nearestEdge(x, z, okRef, 70) || ne, re = rn.edge, rside = ((x - rn.cx) * re.nx + (z - rn.cz) * re.nz) >= 0 ? 1 : -1;
                const base = (rside > 0 ? re.wR : re.wL), rAng = Math.atan2(re.dirx, re.dirz);
                // candidates: beside the reference street (8–24 m back, ±30 m along) and round the mapped point; the free one
                // closest to the mapped station wins
                const cands = [[fx, fz]];
                for (const back of [9, 12, 15, 18, 21, 24]) for (let al = -30; al <= 30; al += 6) cands.push([rn.cx + re.nx * (base + back) * rside + re.dirx * al, rn.cz + re.nz * (base + back) * rside + re.dirz * al]);
                for (let ox = -18; ox <= 18; ox += 6) for (let oz = -18; oz <= 18; oz += 6) cands.push([x + ox, z + oz]);
                let found = null, fd = Infinity;
                for (const [cx, cz] of cands) { const d = Math.hypot(cx - x, cz - z); if (d >= fd) continue; if (fpFreeA(cx, cz, rAng)) { found = [cx, cz]; fd = d; } }
                if (found) { roadAng = rAng; pyl = { e: re, ne: rn, side: rside }; }
                if (!found) { poi.h = 4; fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: false }); continue; }
                [fx, fz] = found; fuelLog.push({ name: brand || name, x: Math.round(x), z: Math.round(z), canopy: true, fx: Math.round(fx), fz: Math.round(fz) });
            }
            const bs = brandStyle(brand || name) || ['#1f2937', '#ffffff', '#f97316'];
            const ca = Math.cos(roadAng), sa = Math.sin(roadAng);
            const L2W = (lx, lz) => [fx + lx * ca + lz * sa, fz - lx * sa + lz * ca];
            const canopyCol = rgb('#f3f4f6');
            treeClear.push({ x: fx, z: fz, r: 14 }); // the forecourt + shop stay clear of trees (they covered it)
            // (after round 6) canopy: a brand-coloured fascia all round with an accent stripe, a light underside
            c.solid.box(fx, 4.95, fz, 10, 0.1, 16, roadAng, canopyCol);
            c.solid.box(fx, 5.0, fz, 10.1, 0.85, 16.1, roadAng, rgb(bs[0]));
            c.solid.box(fx, 5.02, fz, 10.14, 0.12, 16.14, roadAng, rgb(bs[2] || bs[1]));
            for (const [lx, lz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.45, 4.8, 0.45, roadAng, rgb('#d1d5db')); addPropColl(px, pz, 0.35, 'fuel'); }
            for (const [lx, lz] of [[-1.6, -3.5], [1.6, -3.5], [-1.6, 3.5], [1.6, 3.5]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.9, 1.7, 0.6, roadAng, rgb('#e5e7eb')); c.solid.box(px, 1.5, pz, 0.92, 0.35, 0.62, roadAng, rgb(bs[0])); addPropColl(px, pz, 0.55, 'fuel'); }
            c.ground.flatFan([L2W(-7, -11), L2W(7, -11), L2W(7, 11), L2W(-7, 11)], Y.parking + 0.003, rgb('#77787b'), 0.15);
            { // canopy fascia with the brand name on the long sides, light panels under the canopy, pump island kerbs,
              // the station shop (glass front, brand band) behind the forecourt when the station has no mapped building
              const fs = signs.get((brand || name || 'Benzinărie').slice(0, 18), bs[0], bs[1], bs[2]);
              if (fs) for (const sd of [1, -1]) { const [qx, qz] = L2W(sd * 5.06, 0); addSignQuad(c, qx, qz, roadAng + Math.PI / 2, sd, Math.min(9, 0.75 * fs.aspect), 0.75, 5.0, fs, 0.02); }
              for (const lz of [-4.5, 0, 4.5]) for (const lx of [-2.5, 2.5]) { const [qx, qz] = L2W(lx, lz); c.solid.box(qx, 4.53, qz, 1.4, 0.03, 0.6, roadAng, rgb('#fbfbf2')); }
              for (const lx of [-1.6, 1.6]) { const [qx, qz] = L2W(lx, 0); c.solid.box(qx, 0.05, qz, 1.2, 0.18, 9.5, roadAng, rgb('#c9c6bd')); }
              if (bIdx < 0 || !bRecs[bIdx] || bRecs[bIdx].area > 400) {
                  const [kx, kz] = L2W(-side * 0, 0), back = side, pe = pyl.e, ps = pyl.side; const [sx2, sz2] = [fx + pe.nx * ps * 12, fz + pe.nz * ps * 12];
                  const shopFp = obbPoly({ x: sx2, z: sz2, hw: 3, hd: 7, angle: roadAng });
                  if (!buildingAt(sx2, sz2) && !shopFp.some(([qx, qz]) => buildingAt(qx, qz)) && !polyOnRibbon(shopFp)) {
                      c.solid.box(sx2, 0.1, sz2, 6, 3.6, 14, roadAng, rgb('#e6e4df')); c.solid.box(sx2 - pe.nx * ps * 3.02, 0.4, sz2 - pe.nz * ps * 3.02, 0.06, 2.4, 12, roadAng, rgb('#5d7586'));
                      c.solid.box(sx2, 3.5, sz2, 6.1, 0.6, 14.1, roadAng, rgb(bs[0])); addPropColl(sx2, sz2, 3, 'fuel');
                  }
                  void kx; void kz; void back;
              }
            }
            // pylon at the kerb (of the reference street)
            const off2 = (pyl.side > 0 ? pyl.e.wR : pyl.e.wL) + 2.5;
            const px = pyl.ne.cx + pyl.e.nx * off2 * pyl.side + pyl.e.dirx * 9, pz = pyl.ne.cz + pyl.e.nz * off2 * pyl.side + pyl.e.dirz * 9;
            if (onRibbon(px, pz, 1.4)) { poi.h = 6; poi.w = 10; poi.d = 16; continue; }
            c.solid.box(px, 0.2, pz, 0.6, 7.5, 2.4, roadAng + Math.PI / 2, rgb(bs[0]));
            const s = signs.get((brand || name || 'Fuel').slice(0, 18), bs[0], bs[1], bs[2]);
            if (s) for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.3, Math.min(2.2, 2.3 / s.aspect * 2), 5.6, s, 0.32);
            { // price-board panels under the logo: fuel grades only (no invented prices)
              const g1 = signs.get(US ? 'REGULAR' : 'BENZINĂ', '#111111', '#f5f5f5', null), g2 = signs.get(US ? 'DIESEL' : 'MOTORINĂ', '#111111', '#f5f5f5', null);
              for (const sd of [1, -1]) { if (g1) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.9, g1, 0.32); if (g2) addSignQuad(c, px, pz, roadAng, sd, 2.0, 0.45, 3.3, g2, 0.32); } }
            propColl.push({ x: px, z: pz, r: 1.4, poly: null, angle: roadAng + Math.PI / 2, hw: 0.3, hd: 1.2, h: 7, prop: true });
            poi.h = 6; poi.w = 10; poi.d = 16;
            continue;
        }
        if (kind === 'metro' && sub === 'subway_entrance') {
            if (onRibbon(x, z, 0.8)) continue;
            c.solid.box(x, 0.18, z, 0.18, 3.2, 0.18, roadAng, rgb('#4b5563')); addPropColl(x, z, 0.3, 'metro');
            const s = signs.get('M', '#1d4ed8', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, x, z, roadAng, sd, 0.9, 0.9, 3.0, s, 0.11);
            c.solid.box(x, 2.95, z, 0.95, 0.95, 0.2, roadAng, rgb('#1d4ed8'));
            continue;
        }
        if (kind === 'busstop') {
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 12) continue;
            let off = sideW + shoulderOf(e) + Math.max(1.3, Math.min(e.sidewalk, 3) * 0.6);
            let sx = ne.cx + e.nx * off * side, sz = ne.cz + e.nz * off * side;
            const ang = roadAng; const ca = Math.cos(ang), sa = Math.sin(ang);
            { const shelterBad = () => { if (polyOnRibbon(obbPoly({ x: sx, z: sz, hw: 1.2, hd: 2.2, angle: ang }))) return true;
                    for (const [lx, lz, r] of [[-side * 0.5, -1.3, 0.75], [-side * 0.5, 0, 0.75], [-side * 0.5, 1.3, 0.75], [side * 0.3, 1.9, 0.15]]) if (onRibbon(sx + lx * ca + lz * sa, sz - lx * sa + lz * ca, r)) return true; return false; };
              let k = 0; while (k < 8 && shelterBad()) { off += 0.6; sx = ne.cx + e.nx * off * side; sz = ne.cz + e.nz * off * side; k++; }
              if (shelterBad() || buildingAt(sx, sz)) continue; }
            const L2W = (lx, lz) => [sx + lx * ca + lz * sa, sz - lx * sa + lz * ca];
            const back = L2W(-side * 0.8, 0), v0b = c.solid.vc; // local +x points toward the road (= -normal)
            // (real STB / King County Metro shelter: ~3.4 × 1.5 m, 2.3 m roof, tinted glass on a raised frame — not a pale box)
            const glass = rgb('#6f8a99'), frame = rgb(US ? '#2f3e46' : '#3b3f45');
            c.solid.box(back[0], 0.35, back[1], 0.06, 1.9, 3.2, ang, glass);
            for (const lz of [-1.6, 1.6]) { const p2 = L2W(-side * 0.8, lz); c.solid.box(p2[0], 0.2, p2[1], 0.1, 2.15, 0.1, ang, frame); const p3 = L2W(-side * 0.25, lz); c.solid.box(p3[0], 0.35, p3[1], 1.1, 1.9, 0.05, ang, glass); }
            const roofP = L2W(-side * 0.25, 0); c.solid.box(roofP[0], 2.35, roofP[1], 1.6, 0.1, 3.5, ang, frame);
            const bench = L2W(-side * 0.5, 0); c.solid.box(bench[0], 0.45, bench[1], 0.4, 0.08, 2.4, ang, rgb('#6b4a2f'));
            const pole = L2W(side * 0.3, 1.9);
            for (const lz of [-1.3, 0, 1.3]) { const q2 = L2W(-side * 0.5, lz); addPropColl(q2[0], q2[1], 0.75, 'busstop'); }
            addPropColl(pole[0], pole[1], 0.15, 'busstop'); c.solid.box(pole[0], 0.2, pole[1], 0.08, 2.8, 0.08, ang, frame);
            const s = signs.get(sub.startsWith('tram') ? 'T' : 'BUS', sub.startsWith('tram') ? '#c2410c' : '#0f766e', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, pole[0], pole[1], ang, sd, 0.6, 0.5, 2.5, s, 0.05);
            liftOnSide(c, v0b, null, sx, sz, 0.5);
            continue;
        }
        // businesses without a building of their own (or in a building already signed) → small pylon / board
        if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && bIdx < 0 && (brand || name)) {
            const bs = brandStyle(brand || name);
            if (!bs && kind !== 'pharmacy' && !brand) continue; // unbranded tiny places: skip the clutter
            const st = bs || [ks.bg, ks.fg, null];
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 40) continue;
            const off = sideW + shoulderOf(e) + Math.max(1.5, Math.min(e.sidewalk, 4) * 0.8);
            const px = ne.cx + e.nx * off * side, pz = ne.cz + e.nz * off * side;
            if (onRibbon(px, pz, 1.2) || buildingAt(px, pz)) continue;
            // (round 6 note 45) a business is a shop, not a sign on a stick: the fascia goes on the nearest building's street
            // front when one stands within ~18 m (the OSM point sits beside its unit), else a small single-storey pavilion
            if (sub !== 'atm') {
                // (2026-11-08) reality-pass districts: the fascia goes on the nearest building within 30 m (the OSM point is often
                // mapped on the sidewalk in front of its unit); never a sign on a pole in the middle of the pavement
                const R = realPass ? 30 : 18; let nb = null, nd = R;
                bGrid.each(x - R, z - R, x + R, z + R, (o) => { if (o.skip || o.cv || o.h < 3 || (o.minH || 0) > 0.5) return; const d = pointInPolygon(x, z, o.ring) ? 0 : polyDist(x, z, o.ring); if (d < nd) { nd = d; nb = o; } });
                if (nb) { addUnitSign(nb, x, z, brand || name, kind); continue; }
                if (realPass) continue;
            }
            const s = signs.get((brand || name).slice(0, 22), st[0], st[1], st[2]);
            if (!s) continue;
            if (sub === 'atm' || kind === 'bank') { // (after round 6) a free-standing ATM: a slim branded booth, never a shop pavilion
                const fx = -e.nx * side, fz = -e.nz * side, fAng = Math.atan2(-e.nx * side, -e.nz * side);
                c.solid.box(px, 0, pz, 1.0, 2.25, 0.7, fAng, rgb('#3a3f46'));
                c.solid.box(px + fx * 0.36, 0.95, pz + fz * 0.36, 0.55, 0.4, 0.04, fAng, rgb('#5d7f93'));                  // screen
                addSignQuad(c, px + fx * 0.36, pz + fz * 0.36, Math.atan2(fx, fz), 1, 0.95, Math.min(0.5, 0.95 / s.aspect), 1.95, s, 0.02);
                addPropColl(px, pz, 0.6, 'pylon'); continue;
            }
            if (kind === 'hotel') { c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563')); addPropColl(px, pz, 0.2, 'pylon'); for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.2, 2.2 / s.aspect, 3.4, s, 0.08); continue; }
            {
                const pvOff = off + 4.5, vx = ne.cx + e.nx * pvOff * side, vz = ne.cz + e.nz * pvOff * side, W2 = 4, D2 = 3, fAng = Math.atan2(-e.nx * side, -e.nz * side); // (local +z faces the street, x runs along it)
                const fp = obbPoly({ x: vx, z: vz, hw: W2, hd: D2, angle: fAng });
                if (!polyOnRibbon(fp) && !buildingAt(vx, vz) && !fp.some(([qx, qz]) => buildingAt(qx, qz))) {
                    const wallC = rgb(US ? '#d6d0c4' : '#e4e0d6'), fx = -e.nx * side, fz = -e.nz * side; // facing the street
                    c.solid.box(vx, 0, vz, W2 * 2, 3.4, D2 * 2, fAng, wallC);                                // pavilion body
                    c.solid.box(vx, 3.4, vz, W2 * 2 + 0.3, 0.25, D2 * 2 + 0.3, fAng, rgb('#5b5f66'));     // flat roof edge
                    const gx = vx + fx * (D2 + 0.02), gz = vz + fz * (D2 + 0.02);
                    c.solid.box(gx, 0.4, gz, W2 * 1.6, 2.1, 0.06, fAng, rgb('#5d7f93'));                   // shopfront glazing
                    { const sh = 0.72, sw = Math.min(W2 * 1.8, sh * s.aspect); addSignQuad(c, vx + fx * D2, vz + fz * D2, Math.atan2(fx, fz), 1, sw, sw / s.aspect, 2.95, s, 0.06); } // fascia band over the glazing, not a billboard
                    propColl.push({ x: vx, z: vz, r: Math.hypot(W2, D2), hw: W2, hd: D2, angle: fAng, poly: fp, h: 3.6, kind: 'kiosk' });
                    continue;
                }
            }
            c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563')); addPropColl(px, pz, 0.2, 'pylon');
            for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.2, 2.2 / s.aspect, 3.4, s, 0.08);
        }
    }
    // vacant shop units (data.vacant, world-data Request): a plain 'DE ÎNCHIRIAT' / 'FOR LEASE' board over the unit
    { const V = data.vacant || []; let vac = 0;
      for (let i = 0; i + 2 < V.length; i += 3) { const bi = V[i + 2]; if (bi >= 0 && bRecs[bi]) { addUnitSign(bRecs[bi], V[i] / 10, V[i + 1] / 10, US ? 'FOR LEASE' : 'DE ÎNCHIRIAT', 'vacant'); vac++; } }
      vacantUnits = vac; }
    /** a double/single sided sign quad at (x,z) rotated `ang` (local +z = facing), centre height y */
    function addSignQuad(c, x, z, ang, sd, w, h, y, s, thick = 0.1) {
        const fx = Math.sin(ang) * sd, fz = Math.cos(ang) * sd; // facing direction
        const cx = x + fx * thick, cz = z + fz * thick;
        const mbS = signMB(c, s.page), W = [255, 255, 255];
        // viewer in front looks along -f; their right-hand vector is (fz, -fx)
        const Lx = cx - fz * w / 2, Lz = cz + fx * w / 2, Rx = cx + fz * w / 2, Rz = cz - fx * w / 2;
        const y0 = y - h / 2, y1 = y + h / 2;
        const i0 = mbS.v(Lx, y0, Lz, fx, 0, fz, s.u0, s.v0, W), i1 = mbS.v(Rx, y0, Rz, fx, 0, fz, s.u1, s.v0, W);
        const i2 = mbS.v(Rx, y1, Rz, fx, 0, fz, s.u1, s.v1, W), i3 = mbS.v(Lx, y1, Lz, fx, 0, fz, s.u0, s.v1, W);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3);
    }

    // -----------------------------------------------------------------------
    //  TREES, LAMPS, PARKED CARS
    // -----------------------------------------------------------------------
    setProgress('Planting trees…'); await tick();
    // every tree / lamp / prop below is checked against the carriageway ribbons (onRibbon) before it is placed
    const maxTrees = city.id === 'bucharest' ? 32000 : 28000;
    const treeList = [];
    const treeSeen = new Set();
    const dtSea = US ? city.proj(47.6062, -122.3321) : null, dtBel = US ? city.proj(47.6150, -122.2000) : null;
    const coniferChance = (x, z, kind) => {
        if (!US) return kind === 'forest' ? 0.1 : 0; // (Bucharest: conifers only where OSM says needleleaved, or in woods — note 17)
        const dt = Math.min(Math.hypot(x - dtSea.x, z - dtSea.z) / 1300, Math.hypot(x - dtBel.x, z - dtBel.z) / 700);
        return kind === 'street' ? (dt < 1 ? 0.08 : 0.3) : dt < 1 ? 0.2 : 0.62;
    };
    // species trees (trees.js): species from OSM where mapped, else per city / street-type defaults (one species per
    // street row; conifers only where OSM says needleleaved, in parks / forests / gardens); size from the OSM height,
    // else typical per kind. `s` (legacy ≈ 1 for a 6–8 m tree) only seeds the height when nothing better is known.
    const TG = treeGeometries();
    const treeGrid = new BoxGrid(20), treeNear = (x, z, r) => { let f = false; treeGrid.each(x - r, z - r, x + r, z + r, (t) => { if (!f && Math.hypot(t.x - x, t.z - z) < r) f = true; }); return f; };
    const treeCoverage = Array.isArray(data.treeCoverage) && data.treeCoverage.length === 4 ? data.treeCoverage : null;
    const measuredCanopyAt = (x, z) => {
        if (!treeCoverage) return false;
        const ll = city.proj.inverse(x, z);
        return ll.lat >= treeCoverage[0] && ll.lat <= treeCoverage[2] && ll.lon >= treeCoverage[1] && ll.lon <= treeCoverage[3];
    };
    const placeTree = (x, z, s, kind, con = null, dec = null, opt = {}) => {
        // Mapped/measured crowns arrive first as 'osm'. Where a canopy survey
        // actually covers the ground, do not fill its lawns/gaps with invented trees.
        if (kind !== 'osm' && measuredCanopyAt(x, z)) return false;
        if (treeList.length >= maxTrees) return false;
        if (kind === 'street' && treeNear(x, z, 4.5)) return false; // (a mapped OSM tree already stands there)
        { let under = false; surfacesAt(x, z, (hh) => { if (hh > Y.road + 2.5) under = true; }); if (under) return false; } // (no trees under a bridge deck / viaduct)
        if (kind === 'street' && onRibbon(x, z, 1.3)) return false; // (no row trees on medians / verges narrower than ≈ 2.6 m)
        const k = Math.round(x / 1.6) + ',' + Math.round(z / 1.6); if (treeSeen.has(k)) return false;
        if (onRibbon(x, z, 0.35 * s + 0.5) || buildingAt(x, z) || nearWater(x, z, 2.0)) return false;
        if (lmGrounds.some(g => x > g.x0 - 1.5 && x < g.x1 + 1.5 && z > g.z0 - 1.5 && z < g.z1 + 1.5 && (pointInPolygon(x, z, g.p) || polyDist(x, z, g.p) < 1.5))) return false;
        treeSeen.add(k);
        const isCon = con ?? (kind === 'street' || kind === 'osm' ? false : rng.chance(coniferChance(x, z, kind)));
        let species = opt.species || (isCon ? 'conifer' : defaultSpecies(city.id, kind, opt.road ?? Math.round(x * 0.01 + z * 0.013), rng()));
        if (species === 'conifer' && !isCon) species = 'generic';
        const shape = TG.shapes[(SPECIES[species] || SPECIES.generic).shape];
        const H = opt.h > 0 ? opt.h : kind === 'street' ? (US ? rng.range(8, 12) : rng.range(10, 14)) * (shape.top < 9 ? 0.75 : 1) : kind === 'garden' ? rng.range(5, 9) : kind === 'forest' ? rng.range(12, 20) : rng.range(8, 15);
        const sz = clamp(H / shape.top, 0.35, 1.5);
        // a crown that would reach over a carriageway is narrowed toward it (clear stems keep foliage above the lanes;
        // review #20); conifers are slimmed, never lifted
        let sh = 1;
        const R = shape.rx * sz;
        if (onRibbon(x, z, R)) {
            let lo = 0.35 * s + 0.5, hi = R;
            for (let it = 0; it < 4; it++) { const m = (lo + hi) / 2; if (onRibbon(x, z, m)) hi = m; else lo = m; }
            const lowCrown = (shape.cy - shape.ry * 0.8) * sz < 4.4; // crown bottom below truck height
            sh = clamp((lo + (lowCrown ? 0.3 : 1.6)) / R, isCon ? 0.35 : 0.55, 1);
        }
        // guards (route-blocked on Str. Buzești): the trunk collider plus 0.3 m must be off every carriageway / lane strip,
        // and a crown hanging below 4.4 m may not reach over one (else it is dropped, never left in a lane)
        const collR = 0.3 * Math.max(0.6, sz * 1.4);
        if (onRibbon(x, z, collR + 0.3)) return false;
        if (treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r)) return false;
        if ((shape.cy - shape.ry * 0.8) * sz < 4.4 && onRibbon(x, z, R * sh * 0.9)) { if (kind === 'street' || kind === 'garden') return false; sh = Math.max(0.3, sh * 0.6); }
        treeList.push({ x, z, s: sz, species, con: !!isCon, dec: dec ?? (isCon ? 0 : 1), kind, sh }); treeGrid.insert(x, z, x, z, treeList[treeList.length - 1]);
        addPropColl(x, z, collR, 'tree');
        return true;
    };
    // OSM natural=tree / tree_row (real positions, leaf type where tagged)
    const osmTrees = data.trees || [];
    const TI = data.treeInfo || [];
    let treesOSM = 0, treesRows = 0;
    for (let i = 0; i + 2 < osmTrees.length; i += 3) {
        const x = osmTrees[i] / 10, z = osmTrees[i + 1] / 10, t = osmTrees[i + 2], hh = (t >> 1) / 10;
        // treeInfo (world-data): taxon text → species, circumference → size, leaf bits (2 needleleaved, 1 broadleaved)
        const k = i / 3, taxon = TI[k * 3] >= 0 ? str(TI[k * 3]) : '', circ = TI[k * 3 + 1] || 0, leaf = TI[k * 3 + 2] || 0;
        let species = taxon ? speciesFromOSM(taxon) : null;
        const con = species === 'conifer' || (leaf & 2) ? true : (t & 1) && !(leaf & 1) && !TI.length ? true : false; // (leaf data known: needleleaved only)
        if (con) species = 'conifer'; else if (species === 'conifer') species = null;
        const dbh = circ > 0 ? circ / Math.PI : 0; // trunk diameter, cm
        const h = hh > 0 ? hh : dbh > 0 ? clamp(4 + dbh * 0.2, 4, 26) : 0;
        if (placeTree(x, z, h > 0 ? clamp(h / 6.5, 0.6, 2.0) : rng.range(0.85, 1.25), 'osm', con, null, { h, species: species || undefined })) treesOSM++;
    }
    for (const [x, z, s, kind, road, sp] of treeSpots) if (placeTree(x, z, s, kind, null, null, { road, species: sp || undefined })) treesRows++;
    // parks & forests
    for (const a of areas) {
        if (!['park', 'forest', 'scrub', 'cemetery', 'grass'].includes(a.kind)) continue;
        const dens = a.kind === 'forest' ? 1 / 70 : a.kind === 'park' ? 1 / 140 : a.kind === 'cemetery' ? 1 / 120 : a.kind === 'scrub' ? 1 / 200 : 1 / 600;
        const n = Math.min(3000, Math.floor(a.size * dens));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z)) continue;
            placeTree(x, z, rng.range(0.9, a.kind === 'forest' ? 1.7 : 1.4), a.kind);
        }
    }
    // residential gardens (sparse)
    for (const a of areas) {
        if (a.kind !== 'residential' || treeList.length >= maxTrees) continue;
        const n = Math.min(400, Math.floor(a.size / (US ? 500 : 900)));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z) || !clearOf(x, z, 2.5)) continue;
            placeTree(x, z, rng.range(0.8, 1.3), 'garden');
        }
    }
    const treeCount = treeList.length;
    // instanced trees in 500 m chunks (frustum + distance culled); crowns keep a per-instance colour (instanceColor)
    // so the season / weather code can tint each tree (world.vegetation)
    const vegetation = { treeCrownMeshes: [], treeTrunkMeshes: [], deciduousMask: null, grassMaterials: [], groundMaterials: [], roofMaterials: [], trees: treeList };
    {
        // (2026-11-08) district worlds carry the measured canopy (thousands of real trees): fewer full-detail near trees
        const T = buildSpeciesTrees(treeList, { rng, cull: distId ? 480 : 550, chunk: 500, near: distId ? 60 : 95, maxNear: distId ? 110 : 240, farLayer: 2 }); // (layer 2: main view only — not the rear-view mirror pass) // (far chunks drawn to ≈ 1 km) // (≈ 1.2 km view range for trees)
        vegetation.treeCrownMeshes.push(...T.crownMeshes); vegetation.treeTrunkMeshes.push(...T.trunkMeshes);
        vegetation.update = T.update;
        vegetation.deciduousMask = new Float32Array(treeList.map(t => t.dec));
    }
    // street lamps: real OSM highway=street_lamp nodes (moved to the sidewalk edge when mapped on the carriageway)
    // + synthesized ones on lit / main roads at the outer edge of the sidewalk
    const lamps = [];
    const lampGrid = new BoxGrid(30);
    const lampNear = (x, z, r) => { let f = false; lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (!f && Math.hypot(l.x - x, l.z - z) < r) f = true; }); return f; };
    // a lamp stands on the surface under its own base (deck, embankment, trench floor, sidewalk or ground), never at
    // the height of its parent edge's profile while standing beside it (the floating / sunk lamps of review #19b)
    const standY = (x, z, y) => { const rt = raisedTop(x, z, 0.2); if (rt !== null) return rt; let best = 0.15, bd = Math.abs(y - 0.15); surfacesAt(x, z, (h, raised) => { const v = raised ? h : h - Y.road + 0.15, d = Math.abs(v - y); if (d < bd) { bd = d; best = v; } }); return best; }; // (a raised sidewalk wins)
    const addLamp = (l) => { if (nearWater(l.x, l.z, 1.5)) { lampsWet++; return; } l.y = standY(l.x, l.z, l.y); lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); addPropColl(l.x, l.z, 0.18, 'lamp'); };
    const osmLamps = data.lamps || [];
    let lampsWet = 0;
    let lampsMoved = 0;
    for (let i = 0; i + 2 < osmLamps.length; i += 3) {
        let x = osmLamps[i] / 10, z = osmLamps[i + 1] / 10;
        if (lampNear(x, z, 3)) continue;
        const ne = nearestEdge(x, z, null, 80);
        let hh = osmLamps[i + 2] / 10, ly = 0;
        if (ne && onRibbon(x, z, 0.4)) { // mapped in the carriageway: move to the sidewalk edge on the same side
            const e = ne.edge, side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
            const sp = kerbSpot(e, clamp(ne.t, 0, 1) * e.len, side); x = sp.x; z = sp.z; lampsMoved++;
            if (onRibbon(x, z, 0.4)) continue;
        }
        let rot = 0;
        if (ne) { rot = Math.atan2(-(ne.cz - z), ne.cx - x); ly = ne.d < ne.edge.halfW + 6 && !ne.edge.tunnel ? yAlong(ne.edge, x, z) : 0; if (!hh) hh = /^(motorway|trunk|primary|secondary)/.test(ne.edge.type) ? 8 : 5; }
        if (!hh) hh = 6;
        if (buildingAt(x, z)) continue;
        addLamp({ x, z, h: hh, rot, y: 0.15 + ly, osm: true });
    }
    for (const [x, z, ang, ly, hh] of lampSpots) {
        if (lampNear(x, z, osmLamps.length > 300 ? 17 : 10) || buildingAt(x, z) || onRibbon(x, z, 0.35)) continue;
        addLamp({ x, z, h: hh, rot: ang, y: 0.15 + ly, osm: false });
    }
    // street furniture from OSM (benches, bins, bollards, post boxes, hydrants, …) — never on a carriageway
    let furnCount = 0;
    {
        const F = data.furniture || [], K = data.furnKinds || [];
        const metal = rgb('#4b5563'), wood = rgb('#7a5534');
        for (let i = 0; i + 2 < F.length; i += 3) {
            const kind = K[F[i]], x = F[i + 1] / 10, z = F[i + 2] / 10;
            const R = { bench: 0.9, waste_basket: 0.3, bollard: 0.15, post_box: 0.35, bicycle_parking: 0.9, drinking_water: 0.25, fountain: 1.6, fire_hydrant: 0.2, recycling: 1.0, telephone: 0.5, vending_machine: 0.5, picnic_table: 1.0, advertising: 0.7 }[kind] ?? 0.4;
            if (onRibbon(x, z, R + 0.2) || buildingAt(x, z) || nearWater(x, z, R + 1.2)) continue;
            const ne = nearestEdge(x, z, null, 40); const ang = ne ? Math.atan2(ne.edge.dirx, ne.edge.dirz) : 0;
            const c = cellOf(x, z), sb = c.solid, v0f = sb.vc;
            switch (kind) {
                case 'bench': sb.box(x, 0.4, z, 0.5, 0.08, 1.7, ang, wood); sb.box(x, 0.15, z, 0.4, 0.25, 1.5, ang, metal); propColl.push({ x, z, hw: 0.3, hd: 0.85, angle: ang, r: 0.9, poly: null, h: 1, prop: true, kind }); break;
                case 'waste_basket': sb.box(x, 0.15, z, 0.4, 0.8, 0.4, ang, US ? rgb('#2f3a2f') : rgb('#3f6f4a')); addPropColl(x, z, 0.25, 'furniture'); break;
                case 'bollard': sb.box(x, 0.15, z, 0.16, 0.9, 0.16, ang, rgb('#3a3d42')); addPropColl(x, z, 0.12, 'furniture'); break;
                case 'post_box': sb.box(x, 0.15, z, 0.5, 1.15, 0.45, ang, US ? rgb('#1f4e9b') : rgb('#e3b021')); addPropColl(x, z, 0.3, 'furniture'); break;
                case 'fire_hydrant': sb.box(x, 0.15, z, 0.26, 0.7, 0.26, ang, US ? rgb('#c9a227') : rgb('#b91c1c')); addPropColl(x, z, 0.18, 'furniture'); break;
                case 'fountain': sb.geo(props().sphere, x, 0.12, z, 0, 1.6, 0.35, 1.6, rgb('#b8b1a3')); sb.box(x, 0.12, z, 0.4, 1.6, 0.4, 0, rgb('#a49c8c')); addPropColl(x, z, 1.5, 'furniture'); break;
                case 'recycling': sb.box(x, 0.15, z, 1.2, 1.4, 1.0, ang, rgb('#2f6b3f')); propColl.push({ x, z, hw: 0.6, hd: 0.5, angle: ang, r: 0.8, poly: null, h: 1.5, prop: true, kind }); break;
                case 'telephone': case 'vending_machine': sb.box(x, 0.15, z, 0.8, 2.0, 0.7, ang, kind === 'telephone' ? rgb('#9aa3ad') : rgb('#b91c1c')); addPropColl(x, z, 0.45, 'furniture'); break;
                case 'picnic_table': sb.box(x, 0.7, z, 0.8, 0.06, 1.8, ang, wood); sb.box(x, 0.4, z, 1.6, 0.05, 1.8, ang, wood); propColl.push({ x, z, hw: 0.8, hd: 0.9, angle: ang, r: 1.2, poly: null, h: 0.8, prop: true, kind }); break;
                case 'advertising': sb.box(x, 0.12, z, 1.1, 3.0, 1.1, ang + 0.4, rgb('#d9d4c4')); sb.box(x, 3.1, z, 1.3, 0.25, 1.3, ang + 0.4, rgb('#3f3f46')); addPropColl(x, z, 0.65, 'furniture'); break;
                case 'drinking_water': sb.box(x, 0.15, z, 0.3, 1.0, 0.3, ang, metal); addPropColl(x, z, 0.2, 'furniture'); break;
                case 'bicycle_parking': for (const o of [-0.6, 0, 0.6]) { const ox = Math.cos(ang) * o, oz = -Math.sin(ang) * o; sb.box(x + ox, 0.15, z + oz, 0.06, 0.75, 0.9, ang, metal); } propColl.push({ x, z, hw: 0.8, hd: 0.5, angle: ang, r: 0.95, poly: null, h: 0.8, prop: true, kind }); break;
                default: continue;
            }
            liftOnSide(c, v0f, null, x, z); // (on a raised sidewalk)
            furnCount++;
        }
    }
    // ---- Dâmbovița channel (note 11): quay wall, service bank, lower wall into the water, parapet + railing on the quay;
    //      cut where a street / bridge crosses (the decks stay at street level over the channel)
    let channelM = 0;
    for (const a of channelAreas) {
        const conc = rgb('#9c9890'), wet = rgb('#5d615a'), bankC = rgb('#86857c'), rail = rgb('#3d4246'), capC = rgb('#b3afa6');
        for (const ring of [a.outer, ...a.holes]) for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = -uz, nz = ux; // inward (toward the water) normal
            { const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (!isWater(mx + nx * 1.5, mz + nz * 1.5)) { nx = -nx; nz = -nz; } }
            const n = Math.max(1, Math.round(L / 4));
            for (let i = 0; i < n; i++) {
                const t0 = i / n * L, t1 = (i + 1) / n * L, P = (t, o, y) => [ax + ux * t + nx * o, y, az + uz * t + nz * o];
                const mx = ax + ux * (t0 + t1) / 2, mz = az + uz * (t0 + t1) / 2;
                if (onRibbon(mx, mz, 1.0) || onRibbon(mx + nx * 3, mz + nz * 3, 0.5)) continue; // a bridge / street over the channel
                const sb = cellOf(mx, mz).solid, o1 = CHAN.slope, o2 = CHAN.slope + CHAN.bankW, toW = [nx, 0.4, nz];
                sb.face4(P(t0, 0, 0.02), P(t1, 0, 0.02), P(t1, o1, CHAN.bank), P(t0, o1, CHAN.bank), conc, toW);            // quay wall (battered)
                sb.face4(P(t0, o1, CHAN.bank), P(t1, o1, CHAN.bank), P(t1, o2, CHAN.bank), P(t0, o2, CHAN.bank), bankC, [0, 1, 0]); // service bank
                sb.face4(P(t0, o2, CHAN.bank), P(t1, o2, CHAN.bank), P(t1, o2, CHAN.water - 0.4), P(t0, o2, CHAN.water - 0.4), wet, [nx, 0, nz]); // lower wall, wet
                // parapet (0.75 m, 0.3 m thick) on the quay edge + a steel railing on top (posts every 2.5 m, top rail at 1.15 m)
                sb.face4(P(t0, 0, 0), P(t1, 0, 0), P(t1, 0, 0.75), P(t0, 0, 0.75), capC, [nx, 0, nz]);
                sb.face4(P(t1, -0.3, 0), P(t0, -0.3, 0), P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), capC, [-nx, 0, -nz]);
                sb.face4(P(t0, -0.3, 0.75), P(t1, -0.3, 0.75), P(t1, 0, 0.75), P(t0, 0, 0.75), conc, [0, 1, 0]);
                const ang = Math.atan2(ux, uz), [rx, , rz] = P((t0 + t1) / 2, -0.15, 0);
                sb.box(rx, 1.1, rz, 0.05, 0.06, t1 - t0, ang, rail); sb.box(rx, 0.9, rz, 0.03, 0.03, t1 - t0, ang, rail);
                for (let t = t0 + 1.25; t < t1; t += 2.5) { const [px, , pz] = P(t, -0.15, 0); sb.box(px, 0.75, pz, 0.05, 0.4, 0.05, ang, rail); }
                channelM += t1 - t0;
            }
        }
    }
    // ---- district edge closures (spec R10.9): a GTA-style closure set on every road cut at the boundary, sized to the
    //      road (small street / boulevard / highway) and local in style (RO: DRUM ÎNCHIS / LUCRĂRI / DEVIERE, red-white
    //      barriers, cones, jersey barriers, arrow boards, an excavator or a Poliția Rutieră car; US: ROAD CLOSED type III
    //      barricades, drums, DETOUR / LOCAL TRAFFIC ONLY, a flagger, ramp closed for bridge maintenance)
    const closures = [];
    if (mapEnds.length) {
        const P = props();
        const coneG = P._cone || (P._cone = mergeProps([bakeProp(new THREE.ConeGeometry(0.18, 0.7, 8), { y: 0.35, color: '#ff6a13' }), bakeProp(new THREE.CylinderGeometry(0.115, 0.13, 0.12, 8), { y: 0.42, color: '#f4f4f4' }), bakeProp(new THREE.BoxGeometry(0.42, 0.04, 0.42), { y: 0.02, color: '#222222' })]));
        const drumG = P._drum || (P._drum = mergeProps([0, 1, 2, 3].map(i => bakeProp(new THREE.CylinderGeometry(0.29, 0.3, 0.24, 10), { y: 0.12 + i * 0.24, color: i % 2 ? '#f4f4f4' : '#ff6a13' })).concat([bakeProp(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), { y: 0.03, color: '#222222' })])));
        const jerseyG = P._jersey || (P._jersey = mergeProps([bakeProp(new THREE.BoxGeometry(0.6, 0.35, 2.0), { y: 0.17, color: '#c9c6bd' }), bakeProp(new THREE.BoxGeometry(0.3, 0.5, 2.0), { y: 0.6, color: '#d3d0c8' })]));
        const red = rgb('#c62828'), whiteB = rgb('#f2f2f2'), orange = rgb('#ff6a13'), postCol = rgb('#6b6b6b'), yellowM = rgb('#f2b705'), dark = rgb('#222428');
        const others = Object.entries(city.districts || {}).filter(([id]) => id !== distId).map(([id, d]) => { const q = city.proj(d.center.lat, d.center.lon); return { id, x: q.x, z: q.z }; });
        const post = (c, x, z, y, h) => c.solid.box(x, y, z, 0.08, h, 0.08, 0, postCol);
        const sign = (c, x, z, y, ang, text, bg, fg, accent, w = 1.6) => { const sg = signs.get(text, bg, fg, accent, true); if (!sg) return; post(c, x, z, y, 1.4 + 0.25); addSignQuad(c, x, z, ang, 1, w, w / sg.aspect * 1.0, y + 1.4 + w / sg.aspect / 2, sg, 0.05); };
        mapEnds.forEach((m, k) => {
            const { ix, iz, px, pz, y, kind, edge: e } = m, c = cellOf(m.x, m.z), ang = Math.atan2(px, pz), face = Math.atan2(ix, iz); // signs face the driver coming toward the edge
            // lateral positions relative to the middle of the asphalt, `half` = half its width (barriers stop at the kerbs)
            // (play-test note 6) the barrier spans every lane at the cut: widen l0…l1 over any carriageway / pad that the
            // probe line (1 m inside) still finds beyond the edge's own asphalt (merging lanes, a junction mouth)
            { const on = (l) => onRibbon(m.x + ix * 1 + px * l, m.z + iz * 1 + pz * l, 0);
              let l1 = m.l1; while (l1 < m.l1 + 12 && on(l1 + 0.5)) l1 += 0.5; let l0 = m.l0; while (l0 > m.l0 - 12 && on(l0 - 0.5)) l0 -= 0.5;
              m.l0 = l0; m.l1 = l1; }
            const half = (m.l1 - m.l0) / 2, lc = (m.l0 + m.l1) / 2;
            const at = (d, l) => [m.x + ix * d + px * (lc + l), m.z + iz * d + pz * (lc + l)];
            // the road visibly continues past the closure (note 6): a dug-up roadworks strip, then plain asphalt with kerbs and a
            // dashed centre line running out of the district (≈ 400 m, until it would re-enter the map) into the backdrop city
            { const asp = rgb(ASPHALT), kerbC = rgb('#a7a39b'), dug = rgb('#6b5a48'), dash = rgb('#d9d9d4'), wS = Math.max(1.5, m.edge.sidewalk || 2);
              const strip = (d0, d1, l0, l1, col, yy) => { const [ax, az] = at(-d0, l0), [bx, bz] = at(-d1, l0), [cx2, cz2] = at(-d1, l1), [dx, dz] = at(-d0, l1); cellOf((ax + cx2) / 2, (az + cz2) / 2).solid.face4([ax, yy, az], [bx, yy, bz], [cx2, yy, cz2], [dx, yy, dz], col, [0, 1, 0]); };
              let dEnd = 0;
              const dMax = (data.scenery || []).length ? 30 : 400; // (district scenery streets carry the real road on beyond the dug strip)
              let outS = false; for (let d = 2; d < dMax; d += 10) { const [qx, qz] = at(-(d + 10), 0), ins = dmask && dmask.at(qx, qz); if (!ins) outS = true; if ((ins && (outS || d > 60)) || buildingAt(qx, qz) || isWater(qx, qz)) break; dEnd = d + 10; } // (the coarse mask still reads 'inside' just past the edge)
              for (let d = 0.6; d < dEnd; d += 20) {
                  const d1 = Math.min(dEnd, d + 20);
                  strip(d, d1, -half, half, asp, y - 0.02 + (k % 8) * 0.002); // (two strips crossing outside the map: no z-fight)
                  strip(d, d1, -half - wS, -half, kerbC, y + 0.1); strip(d, d1, half, half + wS, kerbC, y + 0.1);
                  if (d < 25) strip(d, Math.min(d1, 22), -half * 0.6, half * 0.2, dug, y - 0.005); // the dug-up roadworks strip
                  else if (kind !== 'small') for (let q = d; q < d1 - 3; q += 9) strip(q, q + 3, -0.08, 0.08, dash, y - 0.01);
              }
              if (dEnd > 30) for (let j = 0; j < 4; j++) { const [x, z] = at(-(4 + j * 5), -half * 0.6 + (j % 2) * 0.4); c.solid.geo(coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]); }
            }
            // the closing barrier line (RO red-white boards / US type III barricade: orange-white rails)
            const segs = Math.max(2, Math.round(half * 2 / 1.2)), cA = US ? orange : red;
            for (let j = 0; j < segs; j++) {
                const f = (j + 0.5) / segs - 0.5, [x, z] = at(0, f * half * 2);
                for (let r = 0; r < (US ? 3 : 2); r++) c.solid.box(x, y + 0.45 + r * 0.38, z, half * 2 / segs, 0.22, 0.08, ang + Math.PI / 2, (j + r) % 2 ? whiteB : cA);
            }
            for (let j = 0; j <= segs; j += Math.max(1, Math.floor(segs / 3))) { const [x, z] = at(0, (j / segs - 0.5) * half * 2); post(c, x, z, y, US ? 1.35 : 1.2); }
            // cones / drums tapering across the lanes in front of it
            const nT = kind === 'small' ? 4 : 7;
            for (let j = 0; j < nT; j++) { const f = j / (nT - 1), [x, z] = at(3 + f * (kind === 'small' ? 5 : 14), (f - 0.5) * half * 1.6); c.solid.geo(US && kind !== 'small' ? drumG : coneG, x, y, z, 0, 1, 1, 1, [255, 255, 255]); addPropColl(x, z, US ? 0.35 : 0.22, 'closure'); }
            if (kind !== 'small') { // jersey barriers + an arrow board on boulevards / highways
                for (let j = -1; j <= 1; j++) { const [x, z] = at(1.0, j * 2.05 - half * 0.35); c.solid.geo(jerseyG, x, y, z, ang, 1, 1, 1, [255, 255, 255]); }
                const [bx, bz] = at(-0.6, half * 0.5); c.solid.box(bx, y, bz, 0.1, 1.2, 0.1, 0, postCol); c.solid.box(bx, y + 1.25, bz, 2.2, 1.1, 0.12, ang + Math.PI / 2, dark);
                const ab = signs.get(US ? '<<<<' : '◄◄◄', '#141414', '#ffb300', null, true); if (ab) addSignQuad(c, bx, bz, face, 1, 2.0, 0.9, y + 1.8, ab, 0.08);
            }
            // signs on the kerb
            const [sx, sz] = at(5, half + 0.7), [tx, tz] = at(9, -(half + 0.7)); // (on the kerb, just off the asphalt)
            if (US) {
                sign(c, sx, sz, y, face, 'ROAD CLOSED', '#ffffff', '#111111', null, 1.8);
                sign(c, tx, tz, y, face, kind === 'highway' ? 'RAMP CLOSED' : k % 2 ? 'LOCAL TRAFFIC ONLY' : 'DETOUR →', kind === 'highway' ? '#ff6a13' : k % 2 ? '#ffffff' : '#ff6a13', '#111111', null, 1.7);
                if (kind === 'highway') { const [hx, hz] = at(12, half + 0.7); sign(c, hx, hz, y, face, 'CLOSED FOR BRIDGE MAINTENANCE', '#ff6a13', '#111111', null, 2.6); }
            } else {
                sign(c, sx, sz, y, face, 'DRUM ÎNCHIS', '#ffffff', '#c62828', '#c62828', 1.6);
                sign(c, tx, tz, y, face, k % 2 ? 'DEVIERE →' : 'LUCRĂRI', '#f5c400', '#111111', null, 1.5);
            }
            // one character prop per closure (deterministic): excavator / police car (RO), flagger (US)
            const pick = (e.id * 7 + k) % 3;
            if (!US && kind !== 'highway' && pick === 0) { // excavator behind the barrier (in the closed part)
                const [ex, ez] = at(-6, 0), col = rgb('#f2b705');
                c.solid.box(ex, y, ez, 2.6, 1.0, 3.6, ang, dark); c.solid.box(ex, y + 1.0, ez, 2.4, 1.5, 2.6, ang, col); c.solid.box(ex + ix * -2.6, y + 2.2, ez + iz * -2.6, 0.4, 0.4, 3.4, ang, col);
                c.solid.box(ex, y, ez + 0.01, 0.6, 0.15, 6, ang + Math.PI / 2, rgb('#5a4a3a')); // dug-up strip
            } else if (!US && kind !== 'small' && pick === 1) { // Poliția Rutieră car parked across the lane before the barrier
                const [qx, qz] = at(6, half * 0.45); c.solid.geo(carProps('sedan', '#e8e8e8'), qx, y - 0.12, qz, ang, 1, 1, 1, [255, 255, 255]);
                c.solid.box(qx, y + 1.5, qz, 0.9, 0.12, 0.25, ang, rgb('#1e5bff')); addPropColl(qx, qz, 1.9, 'closure');
            } else if (US && pick !== 2) { // flagger with a STOP paddle
                const [fx, fz] = at(7, half - 1.2), vest = rgb('#d7ff1f');
                c.solid.box(fx, y, fz, 0.35, 0.85, 0.25, ang, rgb('#2b3442')); c.solid.box(fx, y + 0.85, fz, 0.45, 0.65, 0.3, ang, vest); c.solid.box(fx, y + 1.5, fz, 0.22, 0.25, 0.22, ang, rgb('#b98a6a'));
                c.solid.box(fx, y + 1.78, fz, 0.32, 0.12, 0.32, ang, rgb('#f2f2f2')); post(c, fx + px * 0.35, fz + pz * 0.35, y + 0.6, 1.0);
                const st = signs.get('STOP', '#c62828', '#ffffff', null, true); if (st) addSignQuad(c, fx + px * 0.35, fz + pz * 0.35, face, 1, 0.5, 0.5, y + 1.85, st, 0.05);
                addPropColl(fx, fz, 0.35, 'closure');
            }
            // which district this road heads toward (a later chapter's district → "opens in Chapter n")
            let leadsTo = null, best = Math.cos(45 * Math.PI / 180);
            for (const o of others) { const dx = o.x - m.x, dz = o.z - m.z, L = Math.hypot(dx, dz) || 1, cs = (-ix * dx - iz * dz) / L; if (cs > best) { best = cs; leadsTo = o.id; } }
            // roadworks crew spot (gameplay places the instanced worker there): behind the barrier on the closed asphalt, off the
            // driver's sight line to the kerb signs (the sign plate no longer sits in front of the worker's head — note 6)
            const [wx, wz] = at(-2.5, half * 0.35);
            closures.push({ x: m.x, z: m.z, heading: m.heading, edge: e, node: m.node, kind, leadsTo, l0: m.l0, l1: m.l1, worker: { x: wx, z: wz, y, yaw: Math.atan2(ix, iz) } });
        });
    }
    // road signs: speed limits where the limit changes, one-way at one-way entries, no-entry at one-way exits
    let signCount = 0;
    {
        const kmh = (e) => Math.round(e.maxspeed * 3.6);
        const label = (e) => US ? Math.round(kmh(e) / 1.609 / 5) * 5 : Math.round(kmh(e) / 10) * 10;
        const placeSign = (e, along, sd, faceSign, icon) => { // faceSign: +1 faces along +dir, -1 against
            const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e);
            const o = e.sidewalk >= 1.2 ? w + Math.min(0.6, e.sidewalk * 0.4) : w + 0.7;
            const x = e.a.x + e.dirx * along + e.nx * o * sd, z = e.a.z + e.dirz * along + e.nz * o * sd;
            if (onRibbon(x, z, 0.2) || buildingAt(x, z)) return false;
            const s = signs.icon(icon.key, icon.draw); if (!s) return false;
            const c = cellOf(x, z), y0 = 0.15 + yAlong(e, x, z) + (raisedTop(x, z) !== null ? DY_SIDE : 0);
            const ang = Math.atan2(e.dirx * faceSign, e.dirz * faceSign);
            c.solid.box(x, y0, z, 0.07, 2.3, 0.07, ang, rgb('#8d939a'));
            addSignQuad(c, x, z, ang, 1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, s, 0.06);
            const back = signs.icon('back', (ctx, X, Y2, S2) => { ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 2, 0, 7); ctx.fill(); });
            if (back) addSignQuad(c, x, z, ang, -1, icon.w || 0.75, icon.h || 0.75, y0 + 2.0, back, 0.04);
            addPropColl(x, z, 0.1, 'sign'); signCount++;
            return true;
        };
        const speedIcon = (v) => US
            ? { key: 'mph' + v, w: 0.6, h: 0.75, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#111'; ctx.fillRect(X + 6, Y2, S2 - 12, S2); ctx.fillStyle = '#fff'; ctx.fillRect(X + 9, Y2 + 3, S2 - 18, S2 - 6); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 9px Arial'; ctx.fillText('SPEED', X + S2 / 2, Y2 + 14); ctx.fillText('LIMIT', X + S2 / 2, Y2 + 24); ctx.font = 'bold 26px Arial'; ctx.fillText(String(v), X + S2 / 2, Y2 + 52); } }
            : { key: 'kmh' + v, draw: (ctx, X, Y2, S2) => { const c2 = [X + S2 / 2, Y2 + S2 / 2]; ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c2[0], c2[1], S2 / 2 - 8, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${v >= 100 ? 20 : 26}px Arial`; ctx.fillText(String(v), c2[0], c2[1] + 1); } };
        const noEntry = { key: 'noentry', draw: (ctx, X, Y2, S2) => { ctx.fillStyle = '#d0021b'; ctx.beginPath(); ctx.arc(X + S2 / 2, Y2 + S2 / 2, S2 / 2 - 1, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(X + 12, Y2 + S2 / 2 - 6, S2 - 24, 12); } };
        const oneWay = { key: 'oneway', w: 0.9, h: 0.5, draw: (ctx, X, Y2, S2) => { ctx.fillStyle = US ? '#111' : '#1d4ed8'; ctx.fillRect(X, Y2 + 14, S2, S2 - 28); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X + 8, Y2 + 28); ctx.lineTo(X + 40, Y2 + 28); ctx.lineTo(X + 40, Y2 + 21); ctx.lineTo(X + 57, Y2 + 32); ctx.lineTo(X + 40, Y2 + 43); ctx.lineTo(X + 40, Y2 + 36); ctx.lineTo(X + 8, Y2 + 36); ctx.closePath(); ctx.fill(); } };
        const cont = (n, e) => { // the edge continuing e through node n (same name preferred, best aligned)
            let best = null, bs = -Infinity;
            for (const f of n.edges) { if (f === e || f.virtual) continue; const out = f.a === n ? 1 : -1, inn = e.b === n ? 1 : -1; const d = (f.dirx * out) * (e.dirx * inn) + (f.dirz * out) * (e.dirz * inn); const sc = d + (f.name && f.name === e.name ? 1 : 0); if (sc > bs) { bs = sc; best = f; } }
            return bs > 0.6 ? best : null;
        };
        for (const e of edges) {
            if (e.virtual || e.tunnel || !e.drivable || e.type === 'service' || e.len < 20) continue;
            const mw = /motorway/.test(e.type);
            for (const dir of e.oneway ? [1] : [1, -1]) {
                const n = dir > 0 ? e.a : e.b; // node where traffic in direction `dir` enters e
                const f = cont(n, e);
                if (!f || label(f) === label(e) || (mw && !/motorway/.test(f.type))) continue;
                const r = retract(e, n) + 6; if (r > e.len - 6) continue;
                placeSign(e, dir > 0 ? r : e.len - r, dir, -dir, speedIcon(label(e)));
            }
            if (!e.oneway || mw || e.roundabout || /_link/.test(e.type)) continue;
            if (e.a.edges.length >= 3) placeSign(e, retract(e, e.a) + 3, 1, -1, oneWay);
            if (e.b.edges.length >= 3) { const r = e.len - retract(e, e.b) - 2.5; if (r > 3) { placeSign(e, r, 1, 1, noEntry); placeSign(e, r, -1, 1, noEntry); } }
        }
    }
    // instanced posts + heads (filled with the lamps near the viewer, see the culling hook below)
    const postGeo = new THREE.BufferGeometry(), headGeo = new THREE.BufferGeometry();
    {
        const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 5);
        const toGeo = (p, g) => { g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); };
        toGeo(mergeProps([bakeProp(pole, { y: 4, sy: 8 }), bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 0.9, y: 7.9, sx: 1.9, sy: 0.12, sz: 0.12 })]), postGeo);
        toGeo(bakeProp(new THREE.BoxGeometry(1, 1, 1), { x: 1.8, y: 7.78, sx: 0.75, sy: 0.16, sz: 0.34 }), headGeo);
    }
    const LAMP_MAX = Math.min(lamps.length, 6000) || 1;
    const lampPostMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#4a4f57' }), LAMP_MAX);
    const lampHeadMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#000000', emissiveIntensity: 1, roughness: 0.4 }), LAMP_MAX);
    lampPostMesh.name = 'lampPosts'; lampHeadMesh.name = 'lampHeads';
    lampPostMesh.castShadow = true; lampPostMesh.frustumCulled = false; lampHeadMesh.frustumCulled = false;
    lampPostMesh.count = lampHeadMesh.count = 0;
    group.add(lampPostMesh, lampHeadMesh);
    const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(), _ly = new THREE.Vector3(0, 1, 0);
    const fillLamps = (vx, vz, R) => {
        let n = 0;
        lampGrid.each(vx - R, vz - R, vx + R, vz + R, (l) => {
            if (n >= LAMP_MAX || Math.abs(l.x - vx) > R || Math.abs(l.z - vz) > R) return;
            const k = l.h / 8;
            _lm.compose(_lp.set(l.x, l.y, l.z), _lq.setFromAxisAngle(_ly, l.rot), _ls.set(k, k, k));
            lampPostMesh.setMatrixAt(n, _lm); lampHeadMesh.setMatrixAt(n, _lm); n++;
        });
        lampPostMesh.count = lampHeadMesh.count = n;
        lampPostMesh.instanceMatrix.needsUpdate = true; lampHeadMesh.instanceMatrix.needsUpdate = true;
    };
    void P;
    // parked cars on surface parking lots
    const carKinds = US ? ['suv', 'sedan', 'suv', 'hatch'] : ['hatch', 'sedan', 'hatch', 'suv'];
    // parked cars: vehicles.js `makeParkedCars` (low-detail ~250-tri parked models as one InstancedMesh per kind, per-car
    // colour), one group per 500 m super-cell (culling + few draw calls); full lots again (the 700 k cap is gone).
    // Fallback without it: merged low-LOD props, triangle-capped.
    const parkedLots = new Map(); // super-cell key → [{kind, color, x, y, z, yaw}]
    const useInst = typeof makeParkedCars === 'function';
    const carTris = useInst ? 260 : carKinds.reduce((s2, k) => { const pr = carProps(k, CAR_COLORS[0]); return s2 + (pr.index ? pr.index.length / 3 : 772); }, 0) / carKinds.length;
    let parked = 0; const maxParked = Math.round(Math.min(city.id === 'bucharest' ? 2600 : 2000, 195000 / Math.max(1, carTris)));
    for (const a of areas) {
        if (a.kind !== 'parking' || parked >= maxParked || a.size < 120) continue;
        // orientation: longest edge
        let best = 0, ang = 0;
        for (let k = 0; k < a.outer.length; k++) { const [ax, az] = a.outer[k], [bx, bz] = a.outer[(k + 1) % a.outer.length]; const L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ang = Math.atan2(bx - ax, bz - az); } }
        const ux = Math.sin(ang), uz = Math.cos(ang), vx = uz, vz = -ux; // u along rows, v across
        const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, R = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / 2;
        let lotCount = 0;
        // (2026-11-08) lots in the scenery ring outside the playable area (reality-pass districts): a light fill, frame budget
        const lotFill = realPass && dmask && !dmask.at(cx, cz) ? 0.22 : 0.72, lotMax = realPass ? 45 : 80;
        for (let v = -R, row = 0; v < R; row++) {
            for (let u = -R; u < R; u += 2.6) {
                const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
                if (!inArea(a, x, z) || !inArea(a, x + vx * 2.6, z + vz * 2.6) || !inArea(a, x - vx * 2.6, z - vz * 2.6)) continue;
                if (!rng.chance(lotFill) || buildingAt(x, z) || nearWater(x, z, 3.5)) continue; // (never on a channel quay slope / in water)
                const rot = ang + (row % 2 ? 0 : Math.PI) + Math.PI / 2;
                const box = { x, z, hw: 0.95, hd: 2.3, angle: rot, r: 2.5, poly: null, h: 1.5, prop: true, kind: 'parked' };
                if (polyOnRibbon(obbPoly({ ...box, hw: 1.3, hd: 2.7 })) || [-1.6, 0, 1.6].some(o => onRibbon(x + Math.sin(rot) * o, z + Math.cos(rot) * o, 1.2))) continue; // keep off any carriageway / lane strip
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                if (useInst) { const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []); L.push({ kind, color: col, x, y: 0.12, z, yaw: rot }); }
                else cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, rot, 1, 1, 1, [255, 255, 255]);
                propColl.push(box);
                parked++; lotCount++;
                if (parked >= maxParked || lotCount > lotMax) break;
            }
            if (parked >= maxParked || lotCount > lotMax) break;
            v += row % 2 ? 7.5 : 5.2; // two rows back to back, then an aisle
        }
    }

    // -----------------------------------------------------------------------
    //  TRAFFIC LIGHTS (static poles + instanced lit lamps)
    // -----------------------------------------------------------------------
    const lights = [];
    const lampList = [];
    for (const n of nodeArr) {
        if (!n.hasLight || !n.edges.length) continue;
        const cl = n.lightCluster;
        const approaches = [];
        for (const e of n.edges) {
            const atA = e.a === n;
            if (atA && e.oneway) continue; // traffic only leaves the node on this edge
            const ang = Math.atan2(e.dirz, e.dirx);
            let d = Math.abs(((ang - cl.refAng) % Math.PI + Math.PI) % Math.PI); if (d > Math.PI / 2) d = Math.PI - d;
            const phase = d < Math.PI / 4 ? 0 : 1;
            const out = atA ? 1 : -1;
            const dx = e.dirx * out, dz = e.dirz * out; // pointing away from the node along the edge
            const rx = dz, rz = -dx; // right-hand side of the incoming travel direction (-d)
            const w = (atA ? e.wL : e.wR) + shoulderOf(e) + 0.9;
            const r = retract(e, n) + 1.2;
            let px = n.x + dx * r + rx * w, pz = n.z + dz * r + rz * w;
            for (let k = 0; k < 5 && onRibbon(px, pz, 0.3); k++) { px += rx * 0.7; pz += rz * 0.7; } // never in another approach's carriageway
            const noPole = !!onRibbon(px, pz, 0.3); // no room for a pole: the approach keeps its phase, no pole is drawn
            const c = cellOf(px, pz);
            const rot = Math.atan2(-dz, dx); // housing local +x faces along +d (toward incoming cars)
            const tly = 0.15 + n.y + (raisedTop(px, pz, 0.3) !== null ? DY_SIDE : 0); // (on a raised corner)
            if (!noPole) { c.solid.geo(P.tlight, px, tly, pz, rot, 1, 1, 1, [255, 255, 255]); addPropColl(px, pz, 0.2, 'tlight'); }
            const ap = { edge: e, phase, node: n, x: px + dx * 0.36, z: pz + dz * 0.36, y: noPole ? -200 : tly, state: null, lamp: lampList.length, lamps: null, noPole };
            lampList.push(ap);
            approaches.push(ap);
        }
        if (approaches.length) lights.push({ node: n, approaches, offset: cl.offset });
    }
    const nodeLight = {};
    for (const l of lights) nodeLight[l.node.id] = l;
    const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), Math.max(1, lampList.length));
    lampMesh.count = lampList.length;
    lampMesh.frustumCulled = false;
    lampMesh.name = 'trafficLamps';
    const LAMP_COL = { red: new THREE.Color('#ff3b30').multiplyScalar(1.6), yellow: new THREE.Color('#ffcc00').multiplyScalar(1.6), green: new THREE.Color('#34c759').multiplyScalar(1.6) };
    const LAMP_Y = { red: 4.5, yellow: 4.12, green: 3.74 };
    const tmpM = new THREE.Matrix4();
    for (const ap of lampList) { tmpM.makeTranslation(ap.x, ap.y + 4.5, ap.z); lampMesh.setMatrixAt(ap.lamp, tmpM); lampMesh.setColorAt(ap.lamp, LAMP_COL.red); }
    group.add(lampMesh);

    // -----------------------------------------------------------------------
    //  MESHES
    // -----------------------------------------------------------------------
    setProgress('Finishing…'); await tick();
    const atlas = makeAtlas();
    const solidMat = solidMaterial(atlas);
    // shop light spill: additive, black diffuse + warm emissive with a falloff away from the window; render eases
    // emissiveIntensity 0 → nightEmissive at dusk (0 by day: adds nothing); dimmed as shops close (uClosed)
    const spillMat = (() => {
        const g = makeCanvasTexture(4, 64, (ctx, w, h) => { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#6a6a6a'); gr.addColorStop(1, '#000000'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); });
        g.colorSpace = THREE.NoColorSpace;
        const m = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color('#ffc890'), emissiveMap: g, emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12, fog: true });
        m.userData.nightEmissive = 0.3; m.name = 'shop-spill';
        m.onBeforeCompile = (sh) => { sh.uniforms.uClosed = solidMat.userData.uClosed; sh.fragmentShader = 'uniform float uClosed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= 1.0 - 0.8 * uClosed;'); };
        return m;
    })();
    const noise = noiseTexture();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise });
    // strict layering (spec R11.2): ground/sidewalks (0) < carriageways (-1) < junction pads (-2) < markings (-4); each also has
    // its own renderOrder, so coplanar pieces resolve the same way every frame (no z-fighting / flicker)
    const roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); roadMat.name = 'road';
    const padMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); padMat.name = 'junction';
    const marksMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); marksMat.name = 'markings';
    // shared water material from render's water.js (Fresnel env reflection, ripples, flow, night light streaks — note 11);
    // the old flat vertex-colour material stays as the fallback if the module is missing
    let waterMat = null;
    let WATER_API = null;
    try { const W2 = WATER_API = await import('./water.js'); waterMat = W2.makeWaterMaterial({ deep: US ? '#1d3340' : '#2b3a33', shallow: US ? '#3a5563' : '#46564a', flow: [0.25, 0.08] }); waterMat.depthWrite = false; } catch (err) { console.warn('water.js unavailable', err); }
    if (!waterMat) waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, depthWrite: false });
    // shoreline foam / shallow tint / wet edges (water.js): every water mesh is re-tessellated (≤ 6 m edges) and gets
    // its per-vertex distance to the shore; all-or-nothing, since the shared material then expects `aShore` everywhere
    let shoreTris = 0;
    // rivers running underground (OSM tunnel=yes): the Dambovita is covered under Piata Unirii, but its riverbank polygon
    // is mapped straight across the square — water triangles over the covered stretch are dropped (after round 6)
    const COVERED = US ? [] : [{ r: 34, pts: [[44.4288061, 26.1010674], [44.4285939, 26.1013182], [44.4262866, 26.1035491], [44.4261682, 26.1037764], [44.4261085, 26.1040376], [44.4260752, 26.1043771]] }]
        .map((c) => ({ r: c.r, pts: c.pts.map(([la, lo]) => { const q = city.proj(la, lo); return [q.x, q.z]; }) }));
    const coveredAt = (x, z) => COVERED.some((c) => { for (let i = 1; i < c.pts.length; i++) { const [ax, az] = c.pts[i - 1], [bx, bz] = c.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < c.r) return true; } return false; });
    const dropCovered = (g) => {
        if (!COVERED.length) return g; const P = g.attributes.position; if (g.index || P.count % 3) return g;
        const keep = []; for (let i = 0; i < P.count; i += 3) { const x = (P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, z = (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3; if (!coveredAt(x, z)) keep.push(i); }
        if (keep.length * 3 === P.count) return g;
        const out = new THREE.BufferGeometry();
        for (const k of Object.keys(g.attributes)) { const A = g.attributes[k], n = A.itemSize, arr = new A.array.constructor(keep.length * 3 * n); keep.forEach((i, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) arr[(j * 3 + v) * n + c] = A.array[(i + v) * n + c]; }); out.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
        g.dispose(); return out;
    };
    const shoreFoam = (m) => {
        if (!WATER_API || !m.geometry) return;
        try { const g2 = dropCovered(WATER_API.subdivideWater(m.geometry, 6, 60000)); const sd = WATER_API.computeShoreDistance(g2, { maxD: 30, material: waterMat });
            // (after round 6) a big lake that hit the triangle cap keeps only shore vertices: distance 0 everywhere read as
            // salt-and-pepper foam over the whole of Lake Floreasca — such a mesh gets calm open water instead
            { let near = 0; for (let i = 0; i < sd.length; i++) if (sd[i] < 1.5) near++; if (near > sd.length * 0.6 && sd.length > 200) sd.fill(30); }
            m.geometry.dispose(); m.geometry = g2; shoreTris += g2.attributes.position.count / 3; }
        catch (err) { console.warn('shore foam failed', err); }
    };
    const areaMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); areaMat.name = 'landuse';
    const paveMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); paveMat.name = 'paved-areas';
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); grassMat.name = 'grass';
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true }); roofMat.name = 'roofs';
    const backdropMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas, emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 0 }); backdropMat.name = 'backdrop';
    // (after round 6) the distant city keeps its lights on at night: a procedural window grid on the walls (≈ 38 % lit,
    // warm, per-window brightness), averaged into an even glow where the cells get sub-pixel (no shimmer); render.js eases
    // emissiveIntensity to userData.nightEmissive at night
    backdropMat.userData.nightEmissive = 0.9;
    backdropMat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'varying vec3 vBW;\nvarying vec3 vBN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
            // facade atlas on the walls only: a roof is plain (no windows on top of the boxes), a touch darker
            if (abs(vBN.y) < 0.5) diffuseColor *= texture2D(map, vMapUv); else diffuseColor.rgb *= 0.62;
        #endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {   float wall = 1.0 - smoothstep(0.3, 0.6, abs(vBN.y));
            vec2 tg = normalize(vec2(-vBN.z, vBN.x) + 1e-5);
            vec2 cell = vec2(dot(vBW.xz, tg), vBW.y - 1.0) / vec2(3.2, 3.0);
            vec2 id = floor(cell), f = fract(cell);
            float h = fract(sin(dot(id + floor(vBW.xz * 0.03) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
            float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.82);
            float lit = step(h, 0.38) * (0.6 + 0.8 * fract(h * 37.0));
            float fw = length(fwidth(cell));
            float m = mix(win * lit, 0.31 * 0.38, smoothstep(0.35, 0.9, fw));
            totalEmissiveRadiance *= wall * m * step(0.0, cell.y); }`);
    };
    backdropMat.customProgramCacheKey = () => 'backdrop-night2';
    const signTex = signs.textures();
    const signMats = signTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: '#e8e8e8', alphaTest: 0.5 }));
    // ---- front-garden boundaries (district worlds, Bucharest, 2026-11-08): along residential streets the property line
    //      behind the sidewalk is a railing on a low plinth, a plastered wall or a hedge (one kind per stretch, a gate /
    //      driveway gap every 15–35 m), wherever a garden lies between the sidewalk and the house. Visual only (no
    //      collision: pedestrians keep their sidewalk lines).
    let fenceM = 0;
    if (realPass && !US) {
        const fRng = makeRng(7331);
        const kindsF = [['rail', '#2f3a33'], ['rail', '#1f2326'], ['rail', '#4a4f55'], ['wall', '#d8cfbf'], ['wall', '#c9c2b4'], ['wall', '#e6dfd2'], ['rail', '#26292c'], ['wall', '#bfb8aa'], ['hedge', '#355e2e'], ['rail', '#3b4a3f'], ['rail', '#5a4a3c']];
        const plinth = rgb('#b8b2a6');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 16 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(residential|unclassified|living_street|tertiary)$/.test(e.type) || e.sidewalk < 1.2) continue;
            for (const sd of [1, -1]) {
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + e.sidewalk + 0.12;
                const s0 = retract(e, e.a) + 4, s1 = e.len - retract(e, e.b) - 4; if (s1 - s0 < 6) continue;
                let kind = kindsF[Math.floor(fRng() * kindsF.length)], run = null, nextGap = s0 + 12 + fRng() * 20;
                const ok = (sAl) => {
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.3) || buildingAt(x, z) || nearWater(x, z, 0.5)) return null;
                    if (fenceSegs.some(([ax, az, bx, bz]) => Math.abs(ax - x) < 12 && Math.abs(az - z) < 12 && distPointSeg(x, z, ax, az, bx, bz).d < 4)) return null; // (a landmark's own fence is there)
                    // Empty space alone is not evidence of a private garden: museums,
                    // civic forecourts and parks must not acquire invented perimeter walls.
                    const ix = x + e.nx * sd * 1.5, iz = z + e.nz * sd * 1.5; if (buildingAt(ix, iz)) return null;
                    if (isPark(ix, iz)) return null;
                    let home = null;
                    for (const depth of [3, 6, 10, 16, 24, 32]) {
                        const b = buildingAt(x + e.nx * sd * depth, z + e.nz * sd * depth);
                        if (b) { home = b; break; }
                    }
                    if (!home || home.name || (home.flags & 1) || home.h > 20 || !/^(house|interwar|eclectic|bloc)$/.test(home.style)) return null;
                    return [x, z];
                };
                const flushRun = () => {
                    if (!run || run.pts.length < 2) { run = null; return; }
                    const [k, hex] = run.kind, col = rgb(hex), pts = run.pts;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                        const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az), c = cellOf(mx, mz), v0s = c.solid.vc, v0d = c.detail.vc;
                        if (k === 'wall') { c.solid.box(mx, Y.side, mz, 0.22, 1.75, L + 0.02, ang, col); c.solid.box(mx, Y.side + 1.75, mz, 0.3, 0.07, L + 0.02, ang, shadeRgb(col, 0.82)); }
                        else if (k === 'hedge') { // a clipped hedge: uneven, rounded top, mottled greens (a flat green box read as a painted fence)
                            const ux = (bx - ax) / L, uz = (bz - az) / L, n2 = Math.max(1, Math.round(L / 0.9));
                            for (let j = 0; j < n2; j++) { const f = (j + 0.5) / n2, px = ax + (bx - ax) * f, pz = az + (bz - az) * f, hh2 = 1.25 + fRng() * 0.35, ww = 0.75 + fRng() * 0.25;
                                const g = shadeRgb(col, 0.8 + fRng() * 0.35); c.solid.box(px, Y.side, pz, ww, hh2, L / n2 + 0.2, ang, g);
                                c.solid.geo(props().sphere, px, Y.side + hh2 - 0.05, pz, ang, ww * 0.55, 0.28, L / n2 * 0.65 + 0.15, shadeRgb(g, 1.12)); }
                        }
                        else { // railing: plinth, two rails, posts every ~2 m and pickets as thin boxes (near LOD)
                            c.solid.box(mx, Y.side, mz, 0.26, 0.45, L + 0.02, ang, plinth);
                            c.solid.box(mx, Y.side + 1.55, mz, 0.05, 0.05, L, ang, col); c.detail.box(mx, Y.side + 0.62, mz, 0.04, 0.04, L, ang, col);
                            c.detail.box(ax, Y.side + 0.45, az, 0.08, 1.2, 0.08, ang, col);
                            // pickets: a 3 cm strip seen from both sides every 25 cm (4 triangles each, near LOD)
                            const nP = Math.max(1, Math.round(L / 0.25)), ux = (bx - ax) / L, uz = (bz - az) / L, pnx = -uz, pnz = ux;
                            for (let j = 1; j < nP; j++) { const f = j / nP, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
                                c.detail.wall(px - ux * 0.015, pz - uz * 0.015, px + ux * 0.015, pz + uz * 0.015, Y.side + 0.45, Y.side + 1.57, pnx, pnz, col);
                                c.detail.wall(px + ux * 0.015, pz + uz * 0.015, px - ux * 0.015, pz - uz * 0.015, Y.side + 0.45, Y.side + 1.57, -pnx, -pnz, col); }
                        }
                        liftOnSide(c, v0s, v0d, mx, mz, 0.6); // (on the raised sidewalk's back edge)
                        // (2026-11-08, owner: "I shouldn't be able to drive into this") solid: walls, hedges and railings collide
                        { const hwC = k === 'hedge' ? 0.45 : 0.15; propColl.push({ x: mx, z: mz, hw: hwC, hd: L / 2 + 0.05, angle: ang, r: Math.hypot(hwC, L / 2 + 0.05), poly: null, h: k === 'wall' ? 1.8 : k === 'hedge' ? 1.5 : 1.6, prop: true, kind: 'fence' }); }
                        fenceM += L;
                    }
                    run = null;
                };
                for (let sAl = s0; sAl <= s1; sAl += 2) {
                    if (sAl >= nextGap) { flushRun(); sAl += 2.5 + fRng() * 1.5; nextGap = sAl + 15 + fRng() * 20; if (fRng() < 0.35) kind = kindsF[Math.floor(fRng() * kindsF.length)]; continue; }
                    const p = ok(sAl);
                    if (!p) { flushRun(); continue; }
                    if (!run) run = { kind, pts: [] };
                    run.pts.push(p);
                }
                flushRun();
            }
        }
    }
    // ---- kerb bollards (district worlds, Bucharest, 2026-11-08): the anti-parking posts that line the kerbs of the main
    //      streets wherever parking is not allowed (OSM parking:<side>=no; untagged sides of every other main street), with
    //      gaps at junctions, crossings and driveways. Visual only (near LOD).
    let bollards = 0;
    if (realPass && !US) {
        const RI = data.roadInfo || [], bc = rgb('#3a3d42'), cap = rgb('#b9b9b4');
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 14 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            if (!/^(primary|secondary|tertiary)$/.test(e.type) || e.sidewalk < 1.5) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            for (const sd of [1, -1]) {
                const yes = sd > 0 ? (rf & 64) : (rf & 128), no = sd > 0 ? (rf & 256) : (rf & 512);
                if (yes || (!no && ((e.road * 31 + (sd > 0 ? 7 : 3)) % 2))) continue;
                const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + 0.35;
                const s0 = retract(e, e.a) + 3 + (e.a.crossing ? 5 : 0), s1 = e.len - retract(e, e.b) - 3 - (e.b.crossing ? 5 : 0);
                let gapAt = s0 + 25 + ((e.id * 13) % 20);
                for (let sAl = s0; sAl < s1; sAl += 2.2) {
                    if (sAl > gapAt) { sAl += 4; gapAt = sAl + 25 + ((e.id * 7 + Math.round(sAl)) % 25); continue; } // (a driveway / gate)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    if (onRibbon(x, z, 0.15) || buildingAt(x, z)) continue;
                    const c = cellOf(x, z), v0d = c.detail.vc; c.detail.box(x, Y.side, z, 0.11, 0.85, 0.11, 0, bc); c.detail.box(x, Y.side + 0.85, z, 0.13, 0.05, 0.13, 0, cap); bollards++;
                    liftOnSide(c, c.solid.vc, v0d, x, z);
                    addPropColl(x, z, 0.1, 'bollard'); // (owner: "I can drive through this") solid, like the OSM bollards
                }
            }
        }
    }
    // scenery streets (district worlds, 2026-11-08): the real streets of the ring of buildings outside the playable area
    // (data.scenery from build-data: carriageway width, sidewalk, class, flags, polyline) as flat asphalt + sidewalk strips,
    // below the drivable ribbons (no traffic, no markings beyond a centre dash on two-way main streets)
    let sceneryStreets = 0;
    {
        const SC = data.scenery || [], asp = rgb(ASPHALT), side = rgb(US ? '#a4a29d' : '#9d9a92'), dash = rgb('#cfcfca');
        const yA = Y.side + 0.05, yS = Y.side + 0.03;
        const strip = (pts, l0, l1, y, col) => {
            for (let i = 0; i < pts.length - 1; i++) {
                const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
                // mitred offsets at the joints
                const nrm = (k) => { const [px, pz] = pts[Math.max(0, k - 1)], [qx, qz] = pts[Math.min(pts.length - 1, k + 1)]; const l = Math.hypot(qx - px, qz - pz) || 1; return [-(qz - pz) / l, (qx - px) / l]; };
                const [n0x, n0z] = nrm(i), [n1x, n1z] = nrm(i + 1);
                const c = cellOf((ax + bx) / 2, (az + bz) / 2);
                c.ground.flatQuad(ax + n0x * l0, az + n0z * l0, bx + n1x * l0, bz + n1z * l0, bx + n1x * l1, bz + n1z * l1, ax + n0x * l1, az + n0z * l1, y, col);
            }
        };
        for (const r of SC) {
            const wC = r[0] / 10, sw = r[1] / 10, cls = data.classes[r[2]] || 'residential', fl = r[3];
            const pts = undelta(r, 4); if (pts.length < 2) continue;
            if (fl & 1) continue; // (bridges in the ring: skipped, no decks out there)
            const hw = Math.max(2.2, wC / 2);
            strip(pts, -hw, hw, yA, asp);
            if (sw > 0.5 && !/service|motorway/.test(cls)) { strip(pts, hw, hw + Math.max(1.2, sw), yS, side); strip(pts, -hw - Math.max(1.2, sw), -hw, yS, side); }
            if (/primary|secondary|tertiary/.test(cls) && wC > 6) { // dashed centre line
                for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 1; d + 3 < L; d += 9) { const f0 = d / L, f1 = (d + 3) / L; strip([[ax + (bx - ax) * f0, az + (bz - az) * f0], [ax + (bx - ax) * f1, az + (bz - az) * f1]], -0.07, 0.07, yA + 0.005, dash); } }
            }
            sceneryStreets++;
        }
    }
    // low-poly backdrop: building masses beyond the corridors (so the horizon is not empty)
    let backdropCount = 0;
    {
        const bd = data.backdrop || [], pal = PALETTES[country];
        for (let i = 0; i + 5 < bd.length; i += 6) {
            const x = bd[i] / 10, z = bd[i + 1] / 10, w = bd[i + 2] / 10, d = bd[i + 3] / 10, h = bd[i + 4] / 10, rot = -bd[i + 5] * Math.PI / 180;
            const box = { x, z, hw: w / 2, hd: d / 2, angle: rot, r: Math.hypot(w, d) / 2, poly: null, h, kind: 'backdrop' };
            if (polyOnRibbon(obbPoly({ ...box, hw: w / 2 + 2, hd: d / 2 + 2 }))) continue;
            const st = h > 30 ? 'glass' : h > 14 ? 'bloc' : US ? 'house' : 'bloc';
            const colr = shadeRgb(rgb(rng.pick(pal[st])), 0.9);
            cellOf(x, z).backdrop.box(x, 0.12, z, w, h, d, rot, colr);
            propColl.push(box); backdropCount++;
        }
    }
    // horizon masses (district worlds): the rest of the city as low-detail blocks in a ring 250 m – 4 km outside the map,
    // so the district edge and the empty ground beyond it never show (one merged mesh, always drawn). Bucharest: dense
    // 4–11 storey blocks; Seattle: low suburbs / wooded hills, no masses toward the open water west of Bellevue / SeaTac.
    const horizon = new MeshBuilder();
    if (distId) {
        const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2, R0 = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 250;
        const hr = makeRng(4711 + distId.length * 31), pal = PALETTES[country];
        const woods = [shadeRgb(rgb(env.grass), 0.55), shadeRgb(rgb(env.grass), 0.45)];
        for (let ring = 0; ring < 4; ring++) {
            const R = R0 + ring * 900 + hr.range(0, 300), n = Math.round(2 * Math.PI * R / (US ? 70 : 55));
            for (let i = 0; i < n; i++) {
                const a = (i + hr.range(-0.3, 0.3)) / n * Math.PI * 2, x = cx + Math.cos(a) * (R + hr.range(-150, 150)), z = cz + Math.sin(a) * (R + hr.range(-150, 150));
                const westDeg = ((Math.atan2(z - cz, x - cx) * 180 / Math.PI) + 360) % 360; // 180 = west (−x)
                if (US && westDeg > 150 && westDeg < 230 && (distId === 'bellevue' || distId === 'seatac')) continue;
                if (isWater(x, z)) continue;
                const trees = US ? hr.chance(0.55) : hr.chance(0.15);
                const w = hr.range(30, 70), d = hr.range(14, 40), h = trees ? hr.range(10, 22) : US ? hr.range(6, ring === 0 ? 30 : 14) : hr.range(12, ring === 0 ? 36 : 28);
                const col = trees ? hr.pick(woods) : shadeRgb(rgb(hr.pick(pal[h > 20 ? 'bloc' : US ? 'house' : 'plain'] || pal.plain)), 0.85);
                horizon.box(x, -0.2, z, w, h, d, a + hr.range(-0.4, 0.4), col);
            }
        }
    }
    const cellsGroup = new THREE.Group(); cellsGroup.name = 'cells'; group.add(cellsGroup);
    let tris = 0;
    const addMesh = (mb, mat, cast, name) => {
        if (mb.empty) return null;
        const m = new THREE.Mesh(mb.build(), mat);
        m.castShadow = cast; m.receiveShadow = true; m.name = name; m.matrixAutoUpdate = false; m.updateMatrix();
        tris += mb.ic / 3;
        m.userData.cx = (cx + 0.5) * CELL; m.userData.cz = (cz + 0.5) * CELL;
        if (name.startsWith('signs')) m.userData.cull = 520; else if (name.startsWith('marks')) m.userData.cull = 820;
        cellsGroup.add(m); return m;
    };
    // view ranges (render's weather-driven visibility is 15–20 km on clear days, so culling no longer follows the fog):
    // buildings / ground / roads ≈ 2.7 km, small props / trees / parked cars ≈ 1.2 km, signs 520 m, markings 820 m
    const VIEW = { far: 2700, props: 1200 };
    const cullR = VIEW.far + CELL * 0.71;
    let cx = 0, cz = 0;
    // (2026-11-07, world-visual) draw calls: the flat / cheap layers of neighbouring cells are merged into super-cells
    // (2×2 cells = 500 m; the far backdrop 4×4) — fewer meshes for the same pixels; solid buildings stay per cell (culling)
    const SUPER = { area: 4, grass: 4, pave: 4, roof: 4, backdrop: 4, ground: 2, road: 2, pad: 2, marks: 2, water: 4, signs: 4, spill: 4, solid: 2, detail: 1 };
    const supers = new Map();
    const superOf = (c, layer, page = 0) => {
        const K = SUPER[layer], I = Math.floor(c.i / K), J = Math.floor(c.j / K), key = layer + page + ':' + I + ',' + J;
        let o = supers.get(key); if (!o) supers.set(key, o = { layer, page, K, I, J, mb: null });
        return o;
    };
    for (const c of cells.values()) {
        for (const layer of ['area', 'grass', 'pave', 'roof', 'backdrop', 'ground', 'road', 'pad', 'marks', 'water', 'solid', 'detail']) {
            if (c[layer].empty) continue;
            const o = superOf(c, layer); if (!o.mb) o.mb = c[layer]; else o.mb.append(c[layer]);
        }
        c.signs.forEach((mb, k) => { if (!mb || mb.empty) return; const o = superOf(c, 'signs', k); if (!o.mb) o.mb = mb; else o.mb.append(mb); });
        if (c.spill && !c.spill.empty) { const o = superOf(c, 'spill'); if (!o.mb) o.mb = c.spill; else o.mb.append(c.spill); }
    }
    const addSuper = (o, mat, cast, name) => {
        cx = o.I * o.K + o.K / 2 - 0.5; cz = o.J * o.K + o.K / 2 - 0.5; // (addMesh centres at (cx + 0.5) · CELL)
        const m = addMesh(o.mb, mat, cast, `${name} ${o.I},${o.J}`); if (!m) return null;
        const extra = CELL * (o.K - 1) * 0.71; m.userData.cull = (m.userData.cull || cullR) + extra;
        return m;
    };
    for (const o of supers.values()) {
        switch (o.layer) {
            case 'area': { const m = addSuper(o, areaMat, false, 'area'); if (m) m.renderOrder = -19.5; break; }
            case 'grass': { const m = addSuper(o, grassMat, false, 'grass'); if (m) m.renderOrder = -19.2; break; }
            case 'pave': { const m = addSuper(o, paveMat, false, 'pave'); if (m) m.renderOrder = -19; break; }
            case 'roof': addSuper(o, roofMat, true, 'roofs'); break;
            case 'backdrop': { const m = addSuper(o, backdropMat, true, 'backdrop'); if (m) m.userData.cull = cullR + 600 + CELL * (o.K - 1) * 0.71; break; }
            case 'ground': { const m = addSuper(o, groundMat, false, 'ground'); if (m) m.renderOrder = 1; break; }
            case 'road': { const m = addSuper(o, roadMat, false, 'road'); if (m) m.renderOrder = 2; break; }
            case 'pad': { const m = addSuper(o, padMat, false, 'junction'); if (m) m.renderOrder = 3; break; }
            case 'marks': { const m = addSuper(o, marksMat, false, 'marks'); if (m) m.renderOrder = 4; break; }
            case 'water': { const m = addSuper(o, waterMat, false, 'water'); if (m) { m.renderOrder = -18; shoreFoam(m); } break; }
            case 'solid': addSuper(o, solidMat, true, 'solid'); break;
            case 'detail': { const m = addSuper(o, solidMat, false, 'detail'); if (m) { m.userData.cull = 110 + CELL * 0.71; m.layers.set(2); } break; } // (main view only) // near LOD only // (2026-11-08: no shadow pass — pickets, wires, nets: the frame budget)
            case 'signs': addSuper(o, signMats[o.page], false, 'signs'); break;
            case 'spill': { const m = addSuper(o, spillMat, false, 'shop-spill'); if (m) { m.renderOrder = 5; m.castShadow = m.receiveShadow = false; } break; }
        }
    }
    // ---- kerbside parking (district worlds, Bucharest, 2026-11-08): cars line both kerbs of the residential streets,
    //      parked on the sidewalk next to the kerb as they are in Floreasca / Dorobanți (the carriageway stays clear for
    //      traffic; pedestrians walk round them: they are sidewalk obstacles). OSM parking:{left,right,both} tags
    //      (data.roadInfo flags 64 / 128 yes, 256 / 512 no) decide where mapped; otherwise both sides of residential /
    //      unclassified streets (and tertiary streets with one lane each way) with a ≥ 2.2 m sidewalk. Clear of
    //      junctions (9 m past the pad), crossings (8 m), bus stops (14 m), fuel forecourts, trees, lamps, buildings.
    //      (owner: "parked on the sidewalk, the wheels look sunk in the ground") the world's kerb strip stands 0.13 m above
    //      the road and the sidewalk paving 0.22 m below the kerb: the cars stood across the kerb, wheels cut by it. They now
    //      stand just past the kerb strip at the kerb's top (wheels on the kerb line as seen from the road). Slabs under the
    //      cars were tried and dropped (owner: "pads suck"); the full fix is a sidewalk at kerb height (spec 12, open).
    let kerbParked = 0;
    if (realPass && !US && useInst) {
        const RI = data.roadInfo || [], kRng = makeRng(90127), cols = CAR_COLORS;
        const mappedParking = new Map((data.parking || []).map(row => [row[0], row]));
        const stops = pois.filter(p => p.kind === 'busstop');
        const kinds = ['hatch', 'hatch', 'sedan', 'suv', 'hatch', 'sedan'];
        const pcGrid = new BoxGrid(16); for (const pc of propColl) { const r = pc.r || 0.5; pcGrid.insert(pc.x - r, pc.z - r, pc.x + r, pc.z + r, pc); }
        for (const e of edges) {
            if (!e.drivable || e.virtual || e.tunnel || e.bridge || e.len < 22 || Math.abs(e.ya) > 0.3 || Math.abs(e.yb) > 0.3) continue;
            const rf = RI[e.road * 6 + 1] | 0;
            const parking = mappedParking.get(e.road);
            const resid = /^(residential|unclassified|living_street)$/.test(e.type) || (e.type === 'tertiary' && e.lanesF <= 1 && e.lanesB <= 1);
            for (const sd of [1, -1]) {
                const tagged = sd > 0 ? (rf & 64) : (rf & 128), none = sd > 0 ? (rf & 256) : (rf & 512);
                if (none || (!resid && !tagged) || e.sidewalk < 2.2) continue;
                if (parking) {
                    const offset = sd > 0 ? 1 : 3, location = str(parking[offset]), orientation = str(parking[offset + 1]);
                    // This pass draws parallel cars wholly on the kerb. Mapped
                    // carriageway bays, diagonal/perpendicular parking and half-on-
                    // kerb arrangements need their own surfaces/placement; don't
                    // silently turn those source facts into parallel sidewalk cars.
                    if ((orientation && orientation !== 'parallel') || (location && location !== 'on_kerb')) continue;
                    if (orientation && !location) continue;
                }
                const occ = tagged ? 0.86 : 0.72;
                const s0 = retract(e, e.a) + 9 + (e.a.crossing ? 8 : 0), s1 = e.len - retract(e, e.b) - 9 - (e.b.crossing ? 8 : 0);
                const w = (sd > 0 ? e.wR : e.wL) + shoulderOf(e), o = w + 1.2, yaw = Math.atan2(e.dirx, e.dirz) + (kRng() < 0.5 ? 0 : Math.PI);
                for (let sAl = s0 + kRng() * 2; sAl < s1; sAl += 5.4 + kRng() * 0.8) {
                    if (kRng() > occ) { if (kRng() < 0.25) sAl += 6; continue; } // (gaps, sometimes a driveway)
                    const x = e.a.x + e.dirx * sAl + e.nx * o * sd, z = e.a.z + e.dirz * sAl + e.nz * o * sd;
                    const box = { x, z, hw: 0.92, hd: 2.25, angle: yaw, r: 2.4, poly: null, h: 1.5, prop: true, kind: 'parked' };
                    const fp = obbPoly(box);
                    if (polyOnRibbon(fp) || fp.some(([qx, qz]) => buildingAt(qx, qz)) || buildingAt(x, z) || nearWater(x, z, 2.5)) continue;
                    const ry = raisedTop(x, z); if (ry === null) continue; // (only where the sidewalk is raised: the wheels stand on it)
                    if (treeNear(x, z, 2.2) || lampNear(x, z, 1.9) || treeClear.some((q) => (x - q.x) ** 2 + (z - q.z) ** 2 < (q.r + 3) ** 2)) continue;
                    if (stops.some(p => Math.hypot(p.x - x, p.z - z) < 14)) continue;
                    let blocked = false; pcGrid.each(x - 3, z - 3, x + 3, z + 3, (pc) => { if (!blocked && Math.hypot(pc.x - x, pc.z - z) < (pc.r || 0.5) + 1.6) blocked = true; });
                    if (blocked) continue;
                    pcGrid.insert(x - 2.4, z - 2.4, x + 2.4, z + 2.4, box);
                    const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []);
                    const kind = kinds[Math.floor(kRng() * kinds.length)], color = cols[Math.floor(kRng() * cols.length)], cyaw = yaw + (kRng() - 0.5) * 0.05;
                    L.push({ kind, color, x, y: ry + 0.005, z, yaw: cyaw });
                    propColl.push(box); kerbParked++;
                }
            }
        }
    }
    let parkedCalls = 0;
    for (const [k, list] of parkedLots) {
        const [I, J] = k.split(',').map(Number);
        const pg = makeParkedCars(list, { city: city.id, paintSpace: 'linear', castShadow: false }); // (no shadow pass for lots) pg.name = `parked ${k}`; // (CAR_COLORS are sRGB hex: let three.js linearise them, as the old merged lots did)
        pg.userData.cx = (I + 0.5) * CELL * 2; pg.userData.cz = (J + 0.5) * CELL * 2; pg.userData.cull = (distId ? 300 : 700) + CELL * 0.71; // (district worlds line every residential kerb with cars: drawn to ≈ 0.3 km beyond the cell)
        tris += pg.userData.triangles || 0; parkedCalls += pg.userData.drawCalls || 0;
        pg.traverse(o => o.layers.set(2)); // (layer 2, main view only: the mirror pass skips parked lots)
        cellsGroup.add(pg);
    }
    for (const m of vegetation.treeCrownMeshes.concat(vegetation.treeTrunkMeshes)) { cellsGroup.add(m); tris += (m.userData.always ? m.instanceMatrix.count : m.count) * (m.geometry.index.count / 3); }
    { const hMat = new THREE.MeshLambertMaterial({ vertexColors: true }); hMat.name = 'horizon'; const hm = addMesh(horizon, hMat, false, 'horizon'); if (hm) { hm.userData.always = true; hm.frustumCulled = true; } }
    const waterMesh = addMesh(bigWater, waterMat, false, 'water-big'); if (waterMesh) shoreFoam(waterMesh);
    if (waterMesh) { waterMesh.userData.always = true; waterMesh.renderOrder = -18; }
    // distance culling: cells beyond the fog are hidden (three.js only frustum-culls, and the camera far plane is 5 km).
    // The viewer is world.camera if set, else the widest perspective camera found in the scene.
    const _v = new THREE.Vector3();
    let viewerCam = null, lastCull = null;
    // shops closing at night: the share of shutters down follows the district's local hour (render's simulated clock;
    // a fixed 'night' look counts as 23:00, 'dusk' as 19:00): 0 until 21:00, ~55 % at 23:00, ~70 % 00–06, open by 07:30
    let closedT = 0;
    const closedShare = () => {
        const r3 = globalThis.game?.r3d, ov = r3?.clock?.override;
        let h = null;
        if (ov) h = { night: 23, dusk: 19, sunset: 18.5, dawn: 6.5, day: 12 }[ov] ?? 12;
        else { const d = r3?.simDate || new Date(); try { const f = new Intl.DateTimeFormat('en-GB', { timeZone: city.timeZone || 'UTC', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d); h = +f.find(x => x.type === 'hour').value + +f.find(x => x.type === 'minute').value / 60; } catch { h = d.getHours(); } }
        if (h >= 21) return clamp((h - 21) / 2, 0, 1) * 0.55 + clamp((h - 23) / 1, 0, 1) * 0.15;
        if (h < 6) return 0.7;
        if (h < 7.5) return 0.7 * (1 - (h - 6) / 1.5);
        return 0;
    };
    cellsGroup.updateMatrixWorld = function (force) {
        { const now = performance.now(); if (now - closedT > 2000) { closedT = now; solidMat.userData.uClosed.value = closedShare(); } }
        const cam = world.camera || viewerCam || (viewerCam = findCamera(this));
        if (cam) {
            cam.getWorldPosition(_v);
            if (!lastCull || Math.abs(_v.x - lastCull.x) + Math.abs(_v.z - lastCull.z) > 20) {
                lastCull = { x: _v.x, z: _v.z };
                fillLamps(_v.x, _v.z, Math.min(cullR, 1100));
                vegetation.update?.(_v.x, _v.z);
                for (const m of this.children) if (!m.userData.always) m.visible = Math.hypot(m.userData.cx - _v.x, m.userData.cz - _v.z) < (m.userData.cull || cullR);
            }
        }
        THREE.Group.prototype.updateMatrixWorld.call(this, force);
    };
    function findCamera(obj) {
        let root = obj; while (root.parent) root = root.parent;
        if (!root.isScene) return null;
        let best = null; root.traverse(o => { if (o.isPerspectiveCamera && (!best || o.fov > best.fov)) best = o; });
        return best;
    }
    // ground plane
    const W = bounds.maxX - bounds.minX, H = bounds.maxZ - bounds.minZ;
    // (the plane reaches 30 km past the map: its edge was visible at ~3 km on clear days with render's 15–20 km visibility)
    const GPAD = 60000;
    const groundGeo = new THREE.PlaneGeometry(W + GPAD, H + GPAD, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const uv = groundGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + GPAD) / 12, uv.getY(i) * (H + GPAD) / 12);
    const groundPlaneMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(env.ground).multiplyScalar(0.72), map: noise, depthWrite: false }); groundPlaneMat.name = 'groundPlane';
    const ground = new THREE.Mesh(groundGeo, groundPlaneMat);
    vegetation.grassMaterials.push(grassMat);
    vegetation.groundMaterials.push(groundPlaneMat, areaMat, paveMat);
    vegetation.roofMaterials.push(roofMat);
    ground.position.set((bounds.minX + bounds.maxX) / 2, -0.3, (bounds.minZ + bounds.maxZ) / 2);
    ground.renderOrder = -20; // far horizon filler only; the city's ground is per cell
    ground.receiveShadow = true; ground.name = 'ground';
    group.add(ground);

    // sky dome (render.js may hide it and draw its own)
    const sky = buildSky(env);
    group.add(sky);

    // ---- collision list with spatial query
    const allColl = collision.concat(collisionBoxes, propColl, pierColl, walls);
    const collGrid = new BoxGrid(32);
    for (const b of allColl) collGrid.insert(b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r, b);
    Object.defineProperty(allColl, 'query', { value: (x, z, r, cb) => { const seen = new Set(); collGrid.each(x - r, z - r, x + r, z + r, (b) => { if (!seen.has(b)) { seen.add(b); cb(b); } }); }, enumerable: false });

    // ---- districts / labels
    const districts = data.places.map(([n, x, z, rank]) => ({ name: str(n), x: x / 10, z: z / 10, rank }));

    // ---- spawn
    let spawn = null;
    // district: the chapter start (opts.start, else the first chapter played here) {lat, lon, heading°, road}
    const startLL = distId ? (() => { const st = opts.start || city.activeStart || (CHAPTERS.find(c => c.city === city.id && c.district === distId) || {}).start; return st ? { lat: st.lat, lon: st.lon, road: st.road, bearing: st.heading ?? st.bearing } : null; })() : city.spawnLL;
    if (startLL) {
        const sp = startLL; const q = city.proj(sp.lat, sp.lon);
        const brW = (sp.bearing ?? 0) * Math.PI / 180, wantX = Math.sin(brW), wantZ = -Math.cos(brW);
        const legalDir = (e) => sp.bearing == null || !e.oneway || e.dirx * wantX + e.dirz * wantZ > 0.2; // a one-way carriageway must run the way the chapter faces
        const flt = (e) => e.drivable && legalDir(e) && (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : (sp.road && distId) ? true : !/motorway/.test(e.type)) && e.len > 15;
        const ne = nearestEdge(q.x, q.z, flt, 1500) || nearestEdge(q.x, q.z, (e) => e.drivable && e.len > 10);
        const e = ne.edge;
        const br = (sp.bearing ?? 0) * Math.PI / 180; const want = [Math.sin(br), -Math.cos(br)];
        let dir = (e.dirx * want[0] + e.dirz * want[1]) >= 0 ? 1 : -1;
        if (e.oneway) dir = 1;
        const t = clamp(ne.t, 0.15, 0.85);
        city.spawn = { edge: [e.a.id, e.b.id], t, dir };
        const lat = (e.median / 2 + e.laneW * 0.5) * dir;
        spawn = { x: e.a.x + e.dirx * e.len * t + e.nx * lat, z: e.a.z + e.dirz * e.len * t + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
        spawn.y = Y.road + yAlong(e, spawn.x, spawn.z); // road surface at the spawn (the SeaTac departures drive is an elevated deck)
    }

    // ---- expose only the main strongly-connected network to routing / traffic (everything stays rendered)
    const allEdges = edges;
    const driv = edges.filter(e => e.drivable), rest = edges.filter(e => !e.drivable);
    driv.forEach((e, i) => { e.id = i; }); rest.forEach((e, i) => { e.id = driv.length + i; });
    for (const n of nodeArr) if (n.edges.length) { n.allEdges = n.edges; n.edges = n.edges.filter(e => e.drivable); }
    for (const id of Object.keys(nodes)) if (!nodes[id].drivable) delete nodes[id];
    graph.edges = driv;

    setProgress(''); const phases = PHASES.splice(0);
    const stats = { phases, network: sccInfo, edges: edges.length, walls: walls.length, wallPiecesCut: wallCut, piers: pierColl.length, furniture: furnCount, roadSigns: signCount, roofAds, roofAdList, backdrop: backdropCount, sceneryStreets, kerbParked, marksDropped: edges.filter(e => (e._mkAll || 0) > 4 && ((e._mkDrop || 0) + (e._mkOut || 0)) / e._mkAll > 0.2).sort((p, q) => ((q._mkDrop || 0) + (q._mkOut || 0)) / q._mkAll - ((p._mkDrop || 0) + (p._mkOut || 0)) / p._mkAll).slice(0, 30).map(e => ({ name: e.name, type: e.type, id: e.id, lanes: [e.lanesF, e.lanesB], oneway: e.oneway, x: Math.round((e.a.x + e.b.x) / 2), z: Math.round((e.a.z + e.b.z) / 2), len: Math.round(e.len), cover: +((e._mkDrop || 0) / e._mkAll).toFixed(2), out: +((e._mkOut || 0) / e._mkAll).toFixed(2) })), raisedSidewalk: { pieces: raisedPieces, corners: cornerPolys.length, joins: sideJoins.size, skipped: cornerSkips }, greenQuads, fenceM: Math.round(fenceM), bollards, pitchesDressed, fuel: fuelLog,
        profile: profileStats, treesOSM, treesRows, heightFixes: heightFixes.length, heightFixSamples: heightFixes.slice(0, 30), buildingsShrunk: bShrunk, buildingsDropped: bDropped, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, lampsInWater: lampsWet, shoreTris: Math.round(shoreTris), vacantUnits, channelM: Math.round(channelM), unitSigns, unitSignSpots: signedSpots.slice(0, 40).map(q => q.map(v => Math.round(v))), crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    console.info('[world]', city.id, stats);

    /** calls cb(height) for every drivable surface (carriageway + shoulder + sidewalk, junction pads) covering (x, z) */
    function surfacesAt(x, z, cb, prefer = null, carriagewayOnly = false, exclude = null) {
        const seen = new Set();
        if (realPass && !carriagewayOnly && cornerPolys.length) { // a raised junction corner: the only surface there (cb(h, raised))
            let hc = null; cornerGrid.each(x, z, x, z, (cp) => { if (hc === null && x >= cp.x0 && x <= cp.x1 && z >= cp.z0 && z <= cp.z1 && pointInPolygon(x, z, cp.p)) hc = Y.road + Y.kerb + padHeightAt(cp.n, x, z); });
            if (hc !== null && !onRibbon(x, z, 0, RIB_ONLY)) { cb(hc, true); return; }
        }
        edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (seen.has(e) || e.virtual || e === exclude) return; seen.add(e);
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
            const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1;
            const lim = (side > 0 ? e.wR : e.wL) + shoulderOf(e) + (carriagewayOnly ? 0 : e.sidewalk + (raisedEdge(e) ? SIDE_BACK : 0.05)) + (e === prefer ? 1.5 : 0);
            if (q.d > lim) return;
            if ((q.t <= 0 || q.t >= 1) && Math.hypot(x - (q.t <= 0 ? e.a.x : e.b.x), z - (q.t <= 0 ? e.a.z : e.b.z)) > (q.t <= 0 ? e.a : e.b).radius + (carriagewayOnly ? 0 : 1)) return;
            const h = Y.road + e.a.y + (e.b.y - e.a.y) * q.t;
            if (!carriagewayOnly && q.t > 0 && q.t < 1 && raisedEdge(e) && q.d > widthAsphalt(e, side) + 0.02 && !onRibbon(x, z, 0, RIB_ONLY)) { cb(h + Y.kerb, true); return; } // (the raised sidewalk)
            cb(h);
        });
    }

    const world = {
        camera: null, // optional: set to the main camera for distance culling (auto-detected otherwise)
        group, graph, buildings: allColl, pois, lights, nodeLight, bounds, nearestEdge, edgesInBox, isWater, isPark, waterMesh, sky,
        districts, areas, landmarks, trams, stats, data, spawn, city, allEdges,
        /** placed trees {x, z, species, con, kind} (read-only; QA detectors) */
        treeSpots: treeList,
        /** chapters: the loaded district {id, name, label, bbox, center, landmarks, congestion, areaKm2, ends:[{x,z,node,edge}] (road-closed
         *  barriers where roads leave the map; node.mapEnd = true), inside(x, z) (the drivable area)} — null for the legacy corridor maps */
        district: distId ? { id: distId, ...distCfg, areaKm2: data.district?.areaKm2, ends: mapEnds, inside: (x, z) => (dmask ? dmask.at(x, z) : true) } : null,
        /** district edge closures (spec R10.9) {x, z, heading, edge, node, kind: 'small'|'boulevard'|'highway', leadsTo: districtId|null}; also walls of kind 'closure' (soft) */
        closures,
        /** x/z scale of the world relative to reality (Bucharest 0.7, Seattle 0.5); lane widths, heights, vehicles are real size */
        scale: data.proj.scale,
        /** street lamps {x, z, h, rot, y, osm} and the instanced meshes (heads: MeshStandardMaterial, emissive turned on at night by render.js) */
        lamps, lampPostMesh, lampHeadMesh,
        /** dev check: edges whose ribbon runs into a building footprint, and dead ends that stop within 15 m of another road */
        devCheck() {
            const blocked = [], deadEnds = [];
            for (const e of allEdges) {
                if (e.tunnel || e.layer < 0 || e.virtual) continue; // virtual U-turn connectors have no carriageway
                for (let t = 0.1; t < 0.95; t += 0.2) for (const o of [0, e.wR * 0.7, -e.wL * 0.7]) {
                    const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                    let hit = null; allColl.query(x, z, 0.5, (c) => { if (!hit && c.poly && pointInPolygon(x, z, c.poly)) hit = c; });
                    if (hit) { blocked.push({ edge: e.id, name: e.name, x: Math.round(x), z: Math.round(z) }); t = 2; break; }
                }
            }
            for (const n of nodeArr) {
                if (!n.drivable || n.edges.length !== 1) continue;
                if (n.x < bx0 + 150 || n.x > bx1 - 150 || n.z < bz0 + 150 || n.z > bz1 - 150) continue; // map border
                const own = n.edges[0];
                const ne = nearestEdge(n.x, n.z, (e) => e !== own && e.a !== n && e.b !== n && e.a !== (own.a === n ? own.b : own.a) && e.b !== (own.a === n ? own.b : own.a), 15);
                if (ne && ne.d < 15) deadEnds.push({ node: n.id, name: own.name, d: +ne.d.toFixed(1), x: Math.round(n.x), z: Math.round(n.z) });
            }
            return { network: sccInfo, blocked: blocked.length, deadEnds: deadEnds.length, samples: { blocked: blocked.slice(0, 10), deadEnds: deadEnds.slice(0, 10) } };
        },
        /**
         * Height (metres) of the drivable surface top at (x, z): 0.24 + the vertical profile (bridges / ramps / tunnels).
         *   roadHeight(x, z)                    → the LOWEST road surface at (x, z) (ground 0.24 off-road)
         *   roadHeight(x, z, { y, edge })       → only surfaces within 2.5 m of `y` (the body's current height) count, the
         *                                         closest one wins (a car under a bridge never snaps up onto it, a car on
         *                                         the deck never drops through it); off-road / no match → 0.24
         *   roadHeight(x, z, edge)              → legacy: that edge's profile at (x, z)
         * The surface includes sidewalks and junction pads.
         */
        /** (realPass districts) top of the raised sidewalk at (x, z) or null — where walkers' feet go (traffic crowd) */
        walkTop: (x, z) => raisedTop(x, z),
        roadHeight(x, z, opts = null) {
            if (opts && opts.a && opts.b && opts.len) return Y.road + yAlong(opts, x, z); // legacy (edge)
            const y = opts && typeof opts.y === 'number' ? opts.y : null;
            let best = null, bd = Infinity;
            surfacesAt(x, z, (h) => {
                if (y === null) { if (h < bd) { bd = h; best = h; } return; }
                const d = Math.abs(h - y); if (d <= 2.5 && d < bd) { bd = d; best = h; }
            }, opts && opts.edge);
            return best ?? Y.road;
        },
        /** all drivable surface heights at (x, z) (array, ascending) */
        surfacesAt(x, z) { const hs = []; surfacesAt(x, z, (h) => hs.push(h)); return hs.sort((p, q) => p - q); },
        /** invisible collision walls {ax, az, bx, bz, y0a, y1a, y0b, y1b, nx, nz, kind: rail|embank|trench|guard, edge} (also in world.buildings) */
        walls,
        /** carriageway polygons {e | node, poly}, and the ribbon test used by every placement: onRibbon(x, z, r) → ribbon | null */
        ribbons, onRibbon,
        /**
         * Traffic density multiplier for a local hour (0–24, fractional ok), from the city's daily curve
         * (city.traffic.hourly, TomTom-style: RO peaks 07–10 / 16–19 ×1.6, 22–05 ×0.25; US lower).
         * opts: { cls: highway class → per-class weight (city.traffic.classWeights), weekend: true → weekend curve }.
         */
        trafficProfile(hourLocal, opts = {}) {
            const T = city.traffic || {};
            const tab = (opts.weekend && T.hourlyWeekend) || T.hourly; if (!tab) return 1;
            const h = ((hourLocal % 24) + 24) % 24, i = Math.floor(h), f = h - i;
            const m = tab[i] * (1 - f) + tab[(i + 1) % 24] * f;
            const w = opts.cls ? (T.classWeights?.[opts.cls] ?? 1) : 1;
            return Math.max(0.05, 1 + (m - 1) * w);
        },
        /** seasons / weather hooks: tree crown InstancedMeshes (+ per-instance deciduousMask, instanceColor), own material instances */
        vegetation,
        /**
         * Automated checks for the harness. Returns counts + samples (positions in world metres):
         *   props      collision props (trees, lamps, posts, shelters, furniture, parked cars, piers, landmark boxes, backdrop) on a carriageway
         *   buildings  footprints overlapping a carriageway / junction pad
         *   walls      wall pieces that cut across another carriageway at the same level
         *   lamps      lamp posts standing in the carriageway
         *   cliffs     (a) two drivable surfaces overlapping with a 0.4–4.5 m step, (b) raised / sunken carriageway edges without a wall
         *   doors      CV / interactive POI doors farther than 4 m from a drivable carriageway
         */
        audit(opts = {}) {
            const max = opts.max ?? 25;
            const out = { props: [], buildings: [], walls: [], lamps: [], cliffs: [], doors: [] };
            const R = (v) => Math.round(v * 10) / 10;
            for (const b of allColl) {
                if (b.wall) {
                    if (b.kind === 'closure' || b.kind === 'boundary') continue; // map edge: across the road on purpose
                    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
                        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
                        if (blocksLane(b, x, z, t)) { const rb = onRibbon(x, z, 0, (r) => r.e !== b.edge); out.walls.push({ kind: b.kind, road: b.edge.name, x: R(x), z: R(z), other: rb?.e ? rb.e.name : 'junction' }); break; }
                        continue;
                        const yw = Y.road + b.edge.ya + (b.edge.yb - b.edge.ya) * clamp(((x - b.edge.a.x) * b.edge.dirx + (z - b.edge.a.z) * b.edge.dirz) / b.edge.len, 0, 1); // its road's level here
                        // (a wall between two parallel carriageways at different levels is a separation / median wall: fine)
                        const wl = Math.hypot(b.bx - b.ax, b.bz - b.az) || 1, wdx = (b.bx - b.ax) / wl, wdz = (b.bz - b.az) / wl;
                        const rb = onRibbon(x, z, 0.05, (r) => {
                            if (r.e === b.edge || r.node === b.edge.a || r.node === b.edge.b || (r.e && (r.e.a === b.edge.a || r.e.b === b.edge.b || r.e.a === b.edge.b || r.e.b === b.edge.a))) return false;
                            const dh = Math.abs((r.e ? r.e.a.y + (r.e.b.y - r.e.a.y) * clamp(((x - r.e.a.x) * r.e.dirx + (z - r.e.a.z) * r.e.dirz) / r.e.len, 0, 1) : r.node.y) + Y.road - yw);
                            const parallel = r.e && Math.abs(r.e.dirx * wdx + r.e.dirz * wdz) > 0.85;
                            return dh < 0.3 || (dh < 0.45 && !parallel);
                        });
                        if (rb) { out.walls.push({ kind: b.kind, road: b.edge.name, x: R(x), z: R(z), other: rb.e ? rb.e.name : 'junction' }); break; }
                    }
                } else if (b.poly) {
                    const rb = polyOnRibbon(b.poly);
                    if (rb) out.buildings.push({ x: R(b.x), z: R(b.z), road: rb.e ? rb.e.name : 'junction', poi: b.poi?.id });
                } else {
                    if (b.kind === 'closure') continue; // district-edge roadworks: on the road on purpose
                    const rb = b.hw === b.r ? onRibbon(b.x, b.z, b.r) : polyOnRibbon(obbPoly(b), b.yMax !== undefined ? (r) => r.y < b.yMax - 0.5 : null);
                    if (rb) out.props.push({ kind: b.kind || 'prop', x: R(b.x), z: R(b.z), r: R(b.r), road: rb.e ? rb.e.name : 'junction' });
                }
            }
            for (const l of lamps) if (onRibbon(l.x, l.z, 0.12)) out.lamps.push({ x: R(l.x), z: R(l.z), osm: l.osm });
            // cliffs: walk along both edges of every drivable ribbon; just outside it, emulate a car leaving the road
            // (roadHeight with y = this road's height). If the surface it lands on differs by > 0.45 m and no wall
            // stops it there, it is a cliff (a drop off a deck / into a trench, or a step onto a parallel road).
            const wallBetween = (x0, z0, x1, z1, y) => { // a wall (active at height y) crossing the segment p0 → p1
                let f = false;
                collGrid.each(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (w) => {
                    if (f || !w.wall) return;
                    if (!segsCross([x0, z0], [x1, z1], [w.ax, w.az], [w.bx, w.bz]) && distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).d > 1.0) return;
                    const t = distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).t;
                    if (y >= w.y0a + (w.y0b - w.y0a) * t - 0.3 && y <= w.y1a + (w.y1b - w.y1a) * t) f = true;
                });
                return f;
            };
            for (const e of edges) {
                if (e.virtual || !e.drivable) continue;
                const t0 = 0, t1 = 1;
                let found = false;
                for (let t0i = t0; t0i <= t1 + 1e-6 && !found; t0i += Math.max(0.02, 1.5 / e.len)) {
                    const t = Math.min(t0i, t1);
                    const own = Y.road + e.ya + (e.yb - e.ya) * t;
                    for (const s of [1, -1]) {
                        const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s)) + 0.6;
                        const x = e.a.x + e.dirx * e.len * t + e.nx * off * s, z = e.a.z + e.dirz * e.len * t + e.nz * off * s;
                        const land = this.roadHeight(x, z, { y: own });
                        const ix = e.a.x + e.dirx * e.len * t + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * t + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                        if (Math.abs(land - own) <= 1.0 || wallBetween(ix, iz, x, z, own)) continue; // ≤ 1 m: a bump the car's surface smoothing takes
                        out.cliffs.push({ kind: Math.abs(own - Y.road) > 0.45 ? 'edge' : 'step', road: e.name, from: R(own), to: R(land), x: R(x), z: R(z) }); found = true; break;
                    }
                }
            }
            for (const p of pois) {
                if (!p.interactive || p.doorX === undefined) continue;
                const ne = nearestEdge(p.doorX, p.doorZ, (e) => e.drivable && !e.virtual, 200);
                const lim = ne ? (((p.doorX - ne.cx) * ne.edge.nx + (p.doorZ - ne.cz) * ne.edge.nz) >= 0 ? ne.edge.wR : ne.edge.wL) + 4 : 0;
                if (!ne || ne.d > lim) out.doors.push({ id: p.id, x: R(p.doorX), z: R(p.doorZ), d: ne ? R(ne.d) : null });
            }
            const res = { ok: !out.props.length && !out.buildings.length && !out.walls.length && !out.lamps.length && !out.cliffs.length && !out.doors.length, counts: {} };
            for (const k in out) { res.counts[k] = out[k].length; res[k] = out[k].slice(0, max); }
            res.counts.wallsTotal = walls.length; res.counts.collisionItems = allColl.length;
            return res;
        },
        lampsNear(x, z, r, cb) { lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (Math.hypot(l.x - x, l.z - z) <= r) cb(l); }); },
        /** phase state helper: returns 'green' | 'yellow' | 'red' for an approach edge entering node */
        lightState(nodeId, edge, time, cycle) {
            const l = nodeLight[nodeId]; if (!l) return 'green';
            const ap = l.approaches.find(a => a.edge === edge); if (!ap) return 'green';
            const t = (time + l.offset) % (cycle * 2);
            const inPhase = ap.phase === 0 ? t < cycle : t >= cycle;
            if (!inPhase) return 'red';
            const local = ap.phase === 0 ? t : t - cycle;
            return local > cycle - 2.2 ? 'yellow' : 'green';
        },
        updateLights(time, cycle) {
            let dirty = false;
            for (const l of lights) {
                for (const ap of l.approaches) {
                    const st = this.lightState(l.node.id, ap.edge, time, cycle);
                    if (st === ap.state) continue;
                    ap.state = st; dirty = true;
                    tmpM.makeTranslation(ap.x, ap.y + LAMP_Y[st], ap.z);
                    lampMesh.setMatrixAt(ap.lamp, tmpM); lampMesh.setColorAt(ap.lamp, LAMP_COL[st]);
                }
            }
            if (dirty) { lampMesh.instanceMatrix.needsUpdate = true; if (lampMesh.instanceColor) lampMesh.instanceColor.needsUpdate = true; }
        },
    };
    void renderer;
    return world;
}

function mixRgb(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

function buildSky(env) {
    const geo = new THREE.SphereGeometry(3000, 24, 12);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(env.skyTop) }, bottom: { value: new THREE.Color(env.skyBottom) }, sunDir: { value: new THREE.Vector3(...env.sun).normalize() }, sunColor: { value: new THREE.Color(env.sunColor) }, clouds: { value: env.clouds } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float clouds; varying vec3 vDir;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
            void main(){
                float h = clamp(vDir.y, 0.0, 1.0);
                vec3 col = mix(bottom, top, pow(h, 0.55));
                float s = max(dot(normalize(vDir), sunDir), 0.0);
                col += sunColor * (pow(s, 256.0) * 1.5 + pow(s, 8.0) * 0.25);
                vec2 uv = vDir.xz / max(vDir.y, 0.05) * 0.8;
                float n = noise(uv * 1.5) * 0.6 + noise(uv * 4.0) * 0.3 + noise(uv * 9.0) * 0.1;
                float c = smoothstep(0.55 - clouds * 0.25, 0.9, n) * clouds * smoothstep(0.0, 0.25, h);
                col = mix(col, vec3(1.0) * mix(0.75, 1.0, h), c * 0.8);
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    m.frustumCulled = false;
    return m;
}

// ---------------------------------------------------------------------------
//  Collision: real footprints (polygon) + oriented boxes (landmarks)
// ---------------------------------------------------------------------------
function collideOne(b, x, z, radius, y) {
    if (b.wall) { // wall segment, active only for bodies within its height band
        const r = distPointSeg(x, z, b.ax, b.az, b.bx, b.bz);
        if (r.d >= radius) return null;
        const yq = y ?? 0.24;
        const y0 = b.y0a + (b.y0b - b.y0a) * r.t, y1 = b.y1a + (b.y1b - b.y1a) * r.t;
        if (yq < y0 - 0.3 || yq > y1) return null;
        let nx, nz;
        if (r.d > 1e-4) { nx = (x - r.cx) / r.d; nz = (z - r.cz) / r.d; } else { nx = b.nx; nz = b.nz; }
        return { nx, nz, pen: radius - r.d };
    }
    if (b.yMax !== undefined && (y ?? 0.24) > b.yMax) return null; // e.g. bridge piers: only for traffic below the deck
    if (b.prop && b.hw === b.r) { // small circle (tree trunk, post…)
        const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
        if (d >= b.r + radius) return null;
        return d > 1e-4 ? { nx: dx / d, nz: dz / d, pen: b.r + radius - d } : { nx: 1, nz: 0, pen: b.r + radius };
    }
    if (b.poly) {
        const poly = b.poly;
        const inside = pointInPolygon(x, z, poly);
        let bd = Infinity, bnx = 0, bnz = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const r = distPointSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
            if (r.d < bd) { bd = r.d; if (r.d > 1e-5) { bnx = (x - r.cx) / r.d; bnz = (z - r.cz) / r.d; } else { bnx = 0; bnz = 0; } }
        }
        if (inside) return { nx: -bnx, nz: -bnz, pen: radius + bd };
        if (bd < radius) return { nx: bnx, nz: bnz, pen: radius - bd };
        return null;
    }
    const dx = x - b.x, dz = z - b.z;
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
    const ddx = lx - cx, ddz = lz - cz;
    const d = Math.hypot(ddx, ddz);
    if (d >= radius) return null;
    let nx, nz;
    if (d > 1e-4) { nx = ddx / d; nz = ddz / d; }
    else { const ox = b.hw - Math.abs(lx), oz = b.hd - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; } else { nx = 0; nz = Math.sign(lz) || 1; } }
    const pen = d > 1e-4 ? radius - d : radius + Math.min(b.hw - Math.abs(lx), b.hd - Math.abs(lz));
    return { nx: nx * c + nz * s, nz: -nx * s + nz * c, pen };
}

/**
 * Returns a push vector {px, pz, hit} or null. `buildings` may carry a spatial `.query(x, z, r, cb)`.
 * `y` (optional) = height of the body's base (e.g. player.y): walls (bridge railings, embankments, trench walls,
 * guard rails) and bridge piers only collide with bodies at their level. Without `y` the body is assumed on the
 * ground (0.24): railings of elevated decks are then ignored (so cars under a bridge are never blocked).
 */
export function collideBuildings(buildings, x, z, radius, y) {
    let px = 0, pz = 0, hit = null;
    const test = (b) => {
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz > (b.r + radius) * (b.r + radius)) return;
        const r = collideOne(b, x, z, radius, y);
        if (r && r.pen > 0) { px += r.nx * r.pen; pz += r.nz * r.pen; hit = b; }
    };
    if (buildings.query) buildings.query(x, z, radius + 2, test); else for (const b of buildings) test(b);
    return hit ? { px, pz, hit } : null;
}
