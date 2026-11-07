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
const GRASSY = new Set(['park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery']);
const PAVED = new Set(['parking', 'apron', 'runway']);
const AREA_Y = { residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
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
    for (const b in BRANDS) if (k === b || k.startsWith(b + ' ') || k.startsWith(b)) return BRANDS[b];
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
    m.customProgramCacheKey = () => 'osm-solid-atlas-pbr3';
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
    // field research (spec 20), optional: street-tree notes per street (streets[].research.trees, streets[].trees)
    let research = null;
    if (distId) { try { const r = await fetch(new URL(`../research/${city.id}-${distId}.json`, import.meta.url).href); if (r.ok) research = await r.json(); } catch { research = null; } }
    const researchTrees = new Map(); // street name → { species: [...], none }
    for (const st of research?.streets || []) {
        const txt = String(st.research?.trees || ''), gen = st.trees?.genus || {}, out = [];
        for (const g of Object.keys(gen)) { const k = speciesFromOSM(g); if (k && !out.includes(k)) out.push(k); }
        for (const w of txt.split(/[^\p{L}]+/u)) { const k = speciesFromOSM(w); if (k && k !== 'conifer' && !out.includes(k)) out.push(k); }
        if (out.length || /no (street )?trees|treeless|none/i.test(txt)) researchTrees.set(st.name, { species: out, none: !out.length });
    }
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
                        if (f === e || f.virtual || f.id < e.id || shares(e, f) || crossed.has(e.id + ':' + f.id) || crossed.has(f.id + ':' + e.id)) return;
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
        let residual = 0; for (const e of edges) if (!e.virtual) residual = Math.max(residual, Math.abs(e.b.y - e.a.y) - MAXG * e.len);
        for (const e of edges) { e.ya = e.a.y; e.yb = e.b.y; }
        let cBad = 0, oBad = 0;
        for (const c of crossings) { const tu = clamp(((c.x - c.u.a.x) * c.u.dirx + (c.z - c.u.a.z) * c.u.dirz) / c.u.len, 0, 1), tf = clamp(((c.x - c.f.a.x) * c.f.dirx + (c.z - c.f.a.z) * c.f.dirz) / c.f.len, 0, 1); if ((yP(c.u, tu) - yP(c.f, tf)) * (c.u.L > 0 ? 1 : -1) < 3) cBad++; }
        for (const o of overlaps) { const d = Math.abs(yP(o.e, o.te) - yP(o.f, o.tf)); if (d > 0.45 && d < 2.6) oBad++; }
        profileStats = { merge: profileStats0, crossings: crossings.length, overlaps: overlaps.length, clearanceViolations: cBad, overlapSteps: oBad, gradeResidual: +residual.toFixed(3), hardNodes: hard.size, nanAt };
        function yAt(e, x, z) { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.a.y + (e.b.y - e.a.y) * t; }
        // ramps (embankments / trenches) have at most a narrow service walkway: their walls stand right at the kerb
        for (const e of edges) if (!e.bridge && Math.max(Math.abs(e.ya), Math.abs(e.yb)) > 0.3) e.sidewalk = Math.min(e.sidewalk, 0.5);
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
        parking: '#5f6064', apron: '#8b8c8e', runway: '#505256',
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
    const isPark = (x, z) => { let w = false; parkGrid.each(x, z, x, z, (a) => { if (!w && inArea(a, x, z)) w = true; }); return w; };
    const bigWater = new MeshBuilder();
    // flat ground layers do not write depth (drawn first, in this order) → no z-fighting, sunken roads stay visible
    const AREA_ORDER = ['residential', 'industrial', 'commercial', 'retail', 'railway', 'construction', 'cemetery', 'grass', 'scrub', 'forest', 'park', 'pitch', 'parking', 'apron', 'runway', 'water'];
    areas.sort((p, q) => AREA_ORDER.indexOf(p.kind) - AREA_ORDER.indexOf(q.kind));
    for (const a of areas) {
        const { pts, tris } = triangulate(a.outer, a.holes);
        if (!tris.length) continue;
        const y = AREA_Y[a.kind] ?? Y.landuse;
        const col = rgb(areaColors[a.kind] || env.ground);
        if (a.kind === 'water') {
            const target = (a.x1 - a.x0 > CELL * 2 || a.z1 - a.z0 > CELL * 2) ? bigWater : cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).water;
            const v0 = target.vc; target.flatPoly(pts, tris, y, col, 0.02); a.waterMesh = { mb: target, v0, v1: target.vc };
        } else {
            const cc = cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2);
            (GRASSY.has(a.kind) ? cc.grass : PAVED.has(a.kind) ? cc.pave : cc.area).flatPoly(pts, tris, y, col, 0.1);
        }
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
            tgt.flatQuad(ax + nx, az + nz, bx + nx, bz + nz, bx - nx, bz - nz, ax - nx, az - nz, y, col, 0.05);
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
    const sideCol = rgb(env.sidewalk);
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
            if (coveredByOther(cx, cz, e, yAlong(e, cx, cz), 0.15, true)) return;
            const ok = (x, z) => onOwn(e, x, z) && !coveredByOther(x, z, e, yAlong(e, x, z), 0.15, true);
            if (!(ok(x0, z0) && ok(x1, z1) && ok(x2, z2) && ok(x3, z3))) {
                if (!onOwn(e, cx, cz) && depth > 0) return;
                if (depth >= 3 || Math.hypot(x1 - x0, z1 - z0) < 0.5) return;
                const ax = (x0 + x1) / 2, az = (z0 + z1) / 2, bx = (x2 + x3) / 2, bz = (z2 + z3) / 2;
                this.flatQuad(x0, z0, ax, az, bx, bz, x3, z3, y, col, uvS, depth + 1);
                this.flatQuad(ax, az, x1, z1, x2, z2, bx, bz, y, col, uvS, depth + 1);
                return;
            }
            mb.flatQuad(x0, z0, x1, z1, x2, z2, x3, z3, y, col, uvS);
        },
    });
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
                if (e.lanesF > 1) band(m, e, s0, s1, med2 + e.laneW * (e.lanesF - 1), med2 + e.laneW * e.lanesF, yM - 0.004, busCol);
                if (e.lanesB > 1) band(m, e, s0, s1, -(med2 + e.laneW * (e.lanesB - 1)), -(med2 + e.laneW * e.lanesB), yM - 0.004, busCol);
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
            if (!minor || e.lanesF > 1 || e.lanesB > 1) {
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
        const lampRoad = !e.tunnel && !e.unlit && (e.lit || big || (/tertiary/.test(e.type) && !US));
        if (e.len > 12) {
            const ra = retract(e, e.a) + 5, rb = e.len - retract(e, e.b) - 5;
            if (lampRoad && (!/motorway/.test(e.type) || e.lit)) {
                const step = big ? 34 : 28, hh = big || /motorway|trunk/.test(e.type) ? 8 : 6;
                for (let s = ra + ((e.id * 7) % step); s < rb; s += step) {
                    for (const sd of (e.oneway && e.lanesF <= 1 ? [1] : [1, -1])) {
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
                else if (e.cycleTrack && e.sidewalk >= 2.2) { const o = w + shoulderOf(e); band(c.marks, e, s0b, s1b, sd * (o + e.sidewalk - 1.7), sd * (o + e.sidewalk - 0.3), yS + 0.01, shadeRgb(bc, 1.1)); }
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
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(Pm(0, o, yA - 1.1), Pm(1, o, yB - 1.1), Pm(1, o, yB + 0.05), Pm(0, o, yA + 0.05), conc, [e.nx * sgn, 0, e.nz * sgn]);
            sb.face4(Pm(0, wr, yA - 1.1), Pm(1, wr, yB - 1.1), Pm(1, -wl, yB - 1.1), Pm(0, -wl, yA - 1.1), dark, [0, -1, 0]);
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
            if (e.tunnel && e.lidded) { // (shallow 'tunnels' < 4.5 m deep stay open trenches: a lid would lie on the street)
                const ca = yA + 5.2, cb = yB + 5.2;
                sb.face4(Pm(0, wr, ca), Pm(1, wr, cb), Pm(1, -wl, cb), Pm(0, -wl, ca), dark, [0, -1, 0]); // ceiling
                c.ground.face4(Pm(0, wr + 0.3, 0.06), Pm(1, wr + 0.3, 0.06), Pm(1, -wl - 0.3, 0.06), Pm(0, -wl - 0.3, 0.06), rgb(env.ground), [0, 1, 0]); // lid at street level
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
            const range = (y) => kind === 'rail' ? [y > 2.6 ? y - 2.2 : -1.5, y + 1.1] : kind === 'embank' ? [-1.5, y + 1.1] : kind === 'trench' ? [y - 1.5, e.lidded ? Math.min(1.0, y + 4.6) : 1.0] : [y - 1.0, y + 0.85];
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
        for (const i of data.district.ends || []) {
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
        const villaZone = (x, z) => { if (US) return false; const ll = city.proj.inverse ? city.proj.inverse(x, z) : null; return !!ll && ll.lat > 44.447 && ll.lat < 44.48 && ll.lon > 26.07 && ll.lon < 26.103; };
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
    const laneInPoly = (ring) => { // lane samples (as devCheck / traffic see them) inside the footprint
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        let hit = false;
        edgesInBox(x0 - 12, z0 - 12, x1 + 12, z1 + 12, (e) => {
            if (hit || e.virtual || e.tunnel || e.layer < 0) return;
            for (let t = 0.03; t < 0.98 && !hit; t += Math.min(0.05, 1 / e.len)) for (const o of [0, e.wR * 0.45, e.wR * 0.85, -e.wL * 0.45, -e.wL * 0.85]) {
                const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * o, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * o;
                if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && pointInPolygon(x, z, ring)) { hit = true; break; }
            }
        });
        return hit;
    };
    const bBad = (ring) => polyOnRibbon(ring) || laneInPoly(ring);
    for (const b of bRecs) {
        if (!bBad(b.ring)) continue;
        let ring = b.ring, ok = false;
        for (let k = 0; k < 6 && !ok; k++) { ring = ring.map(([x, z]) => [b.c[0] + (x - b.c[0]) * 0.88, b.c[1] + (z - b.c[1]) * 0.88]); ok = !bBad(ring); }
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
                if ((nm && names.some(n => nm.includes(n))) || Math.hypot(b.c[0] - p.x, b.c[1] - p.z) < R) b.skip = true;
            });
            for (const cb of res.collision || []) {
                if (cf !== 1) { // axis-aligned bounds of the rotated box, squashed N–S
                    const a = cb.angle || 0, ex = Math.abs(cb.hw * Math.cos(a)) + Math.abs(cb.hd * Math.sin(a)), ez = Math.abs(cb.hw * Math.sin(a)) + Math.abs(cb.hd * Math.cos(a));
                    const hw = ex * lk, hd = ez * lk * cf;
                    collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk * cf, hw, hd, angle: 0, r: Math.hypot(hw, hd), h: 20, poly: null });
                } else collisionBoxes.push({ x: p.x + cb.x * lk, z: p.z + cb.z * lk, hw: cb.hw * lk, hd: cb.hd * lk, angle: cb.angle || 0, r: Math.hypot(cb.hw, cb.hd) * lk, h: 20, poly: null });
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
            b.name = p.label; b.flags |= 2; b.cvSign = true;
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
                        const ww = 8, hh2 = ww / (signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316') || s).aspect;
                        pick = { ys: ch + hh2 / 2 + 0.25, nx: best.nx, nz: best.nz, cx: end[0] - best.nx * 0.4, cz: end[1] - best.nz * 0.4, w: ww, canopy: true, text: poi.label.split(' — ')[0] };
                    }
                }
            }
            if (!pick) { // no flush facade (glazed lobby under a canopy): a freestanding tenant monument sign by the entrance,
                // set across the sidewalk so it reads from the street in both directions (like real office-tower signage)
                const best = facadeAt(4, 0.35) || facadeAt(7.5, 0.35); if (!best) continue;
                const { nx, nz } = best, short = signs.get(poi.label.split(' — ')[0], '#111827', '#ffffff', poi._color || '#f97316'); if (!short) continue;
                const midX = (best.x + poi.doorX) / 2, midZ = (best.z + poi.doorZ) / 2;
                let placed = false;
                for (const off of [6, -6, 9, -9, 4, -4]) {
                    const tx = nz, tz = -nx, x = midX + tx * off, z = midZ + tz * off;
                    if (onRibbon(x, z, 1.8) || buildingAt(x, z)) continue;
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

    // ground-floor shops along the streets of the CV stops (the owner drives there: give them life)
    for (const p of pois) if (p.cv) bGrid.each(p.x - 140, p.z - 140, p.x + 140, p.z + 140, (o) => {
        if (!o.skip && o.h > 6 && o.minH <= 0 && ['interwar', 'eclectic', 'civic', 'bloc', 'plain'].includes(o.style) && Math.hypot(o.c[0] - p.x, o.c[1] - p.z) < 140 && o.area < 6000) o.flags |= 1;
    });
    // ---- extrude buildings
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    const propColl = []; // small circles for street furniture (trees, posts, shelters…)
    const addPropColl = (x, z, r, kind = 'prop') => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind });
    for (const [x, z] of lmSignColl) addPropColl(x, z, 1.4, 'sign');
    let wallTris = 0;
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        const brng = makeRng(b.i * 7919 + 13);
        const pal = palette[b.style] || palette.plain;
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
        const shop = (b.flags & 1) && b.minH <= 0 && h > 6;
        const yShop = y0 + 4.2;
        const pitched = b.roof === 'gabled' || b.roof === 'pyramid';
        const wallTop = h;
        let perim = 0;
        for (let k = 0; k < ring.length; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length];
            const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
            // outward normal: for signedArea<0 (counter-clockwise on screen with z down) the right-hand normal points out
            let nx = (bz - az) / L, nz = -(bx - ax) / L;
            if (!ccw) { nx = -nx; nz = -nz; }
            const [gc, gr] = TILE_GRID[tile] || [1, 1];
            const u0 = perim / (bayW * gc), u1 = (perim + L) / (bayW * gc);
            if (shop) {
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, rgb('#ffffff'), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (b.i % 2) * 8);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / (floorH * gr), tile);
                // night light spill on the sidewalk in front of the shop window (additive decal, 0 by day)
                if (L > 2.5) {
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2, D = 3.2;
                    const ne = nearestEdge(mx + nx * 3, mz + nz * 3, null, 30);
                    if (ne && ne.d < 22 && !buildingAt(mx + nx * 1.5, mz + nz * 1.5)) {
                        const sb = c.spill || (c.spill = new MeshBuilder()), w0 = [255, 255, 255], yS2 = Y.side + 0.02;
                        // inset 0.3 m at both ends; stop at the kerb (never on the carriageway)
                        const ux = (bx - ax) / L, uz = (bz - az) / L, p0x = ax + ux * 0.3, p0z = az + uz * 0.3, p1x = bx - ux * 0.3, p1z = bz - uz * 0.3;
                        let d = D; while (d > 0.8 && (onRibbon(p0x + nx * d, p0z + nz * d, 0.2) || onRibbon(p1x + nx * d, p1z + nz * d, 0.2) || onRibbon(mx + nx * d, mz + nz * d, 0.2))) d -= 0.4;
                        if (d > 0.8) {
                            const i0 = sb.v(p0x, yS2, p0z, 0, 1, 0, 0.5, 1, w0), i1 = sb.v(p1x, yS2, p1z, 0, 1, 0, 0.5, 1, w0);
                            const i2 = sb.v(p1x + nx * d, yS2, p1z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0), i3 = sb.v(p0x + nx * d, yS2, p0z + nz * d, 0, 1, 0, 0.5, 1 - d / D, w0);
                            sb.triUp(i0, i1, i2); sb.triUp(i0, i2, i3);
                        }
                    }
                }
            } else mb.wall(ax, az, bx, bz, y0, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - y0) / (floorH * gr), tile);
            if (!shop && L > 2 && b.style !== 'glass' && b.style !== 'house' && wallTop > 6) mb.wall(ax + nx * 0.04, az + nz * 0.04, bx + nx * 0.04, bz + nz * 0.04, y0, y0 + 0.9, nx, nz, shadeRgb(wallCol, 0.68)); // darker plinth
            wallTris += shop ? 4 : 2;
            perim += L;
        }
        addDetail(b, mb, brng, wallCol, h, y0, shop, yShop, floorH, ccw);
        // roof (own mesh / material: world.vegetation.roofMaterials, so weather can tint it, e.g. snow)
        const rmb = c.roof;
        const flatRoofCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.flat[Math.floor(brng() * roofCols.flat.length)]);
        const pitchCol = b.roofColour ? rgb(b.roofColour) : rgb(roofCols.pitched[Math.floor(brng() * roofCols.pitched.length)]);
        const quad4 = ring.length === 4 || (ring.length === 5 && Math.hypot(ring[0][0] - ring[4][0], ring[0][1] - ring[4][1]) < 0.3);
        if ((b.roof === 'hipped' || b.roof === 'skillion') && quad4) {
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
                mb.face4(P(p2), P(p3), P(p3, h + rise), P(p2, h + rise), wallCol, nb, tile);
                mb.face3(P(p1), P(p2), P(p2, h + rise), wallCol, outOf([P(p1), P(p2)]), tile);
                mb.face3(P(p3), P(p0), P(p3, h + rise), wallCol, outOf([P(p3), P(p0)]), tile);
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
            mb.face3(P(p1), P(p2), r1, wallCol, outOf([P(p1), P(p2), r1]), tile);
            mb.face3(P(p3), P(p0), r0, wallCol, outOf([P(p3), P(p0), r0]), tile);
        } else if ((pitched || b.roof === 'hipped') && ring.length <= 10) {
            const rise = clamp(Math.sqrt(b.area) * 0.32, 1.2, 6);
            const apex = [b.c[0], h + rise, b.c[1]];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], bb = ring[(k + 1) % ring.length];
                const pa = [a[0], h, a[1]], pb = [bb[0], h, bb[1]];
                rmb.face3(pa, pb, apex, pitchCol, [(a[0] + bb[0]) / 2 - b.c[0], 0.5, (a[1] + bb[1]) / 2 - b.c[1]]);
            }
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
        if (h >= 5 && b.style !== 'church') addNearDetail(b, c.detail, brng, wallCol, h, y0, shop, yShop, floorH, bayW, ccw, flatRoofCol);
        // collision
        collision.push({ x: b.c[0], z: b.c[1], r: Math.max(...ring.map(([x, z]) => Math.hypot(x - b.c[0], z - b.c[1]))), poly: ring, angle: 0, hw: (b.x1 - b.x0) / 2, hd: (b.z1 - b.z0) / 2, h, poi: b.cv || undefined });
        // facade sign
        if ((b.flags & 2) && b.name && (b.cvSign || b.area < 20000)) addFacadeSign(b, h, shop, wallCol);
    }

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
                const encl = [rgb('#c9d4d8'), rgb('#9fb3bd'), accent, accent, rgb('#d8cfb8'), rgb('#7d8c96'), rgb('#b8a48a')];
                for (let f = 1; f < Math.min(floors, 9); f++) {
                    const yb = yFirst + f * floorH;
                    for (let i = 0; i < cols.length; i++) {
                        const s2 = cols[i], r = brng();
                        if (i % 2 === 0) { // balcony every other bay: open slab + parapet, or enclosed (glazed / clad, mixed colours)
                            if (r < 0.45) slab(s2, yb - 0.1, bayW * 0.9, 1.0, 1.1, encl[Math.floor(brng() * encl.length)]); // enclosed lower part
                            else slab(s2, yb - 0.1, bayW * 0.9, 0.12, 1.1, shadeRgb(wallCol, 0.85));                      // open slab
                            if (r < 0.3) slab(s2, yb + 0.9, bayW * 0.88, floorH - 1.1, 1.0, rgb('#6f8794'));             // glazed top
                            else if (r < 0.75) slab(s2, yb + 0.02, bayW * 0.9, 0.9, 1.1, brng() < 0.6 ? accent : shadeRgb(wallCol, 0.8), false);  // parapet (coloured fronts)
                        } else if (r < 0.18) slab(s2 + bayW * 0.3, yb + 0.25, 0.8, 0.55, 0.3, rgb('#e2e2de')); // AC unit
                        else if (r < 0.22) slab(s2, yb + floorH * 0.7, 0.55, 0.55, 0.14, rgb('#d6d6d0'), false); // dish
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
        if (hh > 2.4 && !cvp) { hh = 2.4; w = hh * s.aspect; }
        let y = shop ? 4.6 + 0.2 : Math.min(h - hh - 0.6, 3.6);
        if (cvp) y = Math.max(4, Math.min(h - hh - 1.5, 14));
        else if (!(b.flags & 8) && h > 14) y = h - hh - 0.8; // named buildings: sign near the top
        if (y < 1) y = 1;
        const mx = (ax + bx) / 2 + nx * 0.12, mz = (az + bz) / 2 + nz * 0.12;
        // viewer outside looks along -n; their right-hand vector is (nz, -nx)
        const lx = mx - nz * w / 2, lz = mz + nx * w / 2, rx = mx + nz * w / 2, rz = mz - nx * w / 2;
        const mbS = signMB(cellOf(b.c[0], b.c[1]), s.page);
        const white = [255, 255, 255];
        const i0 = mbS.v(lx, y, lz, nx, 0, nz, s.u0, s.v0, white), i1 = mbS.v(rx, y, rz, nx, 0, nz, s.u1, s.v0, white);
        const i2 = mbS.v(rx, y + hh, rz, nx, 0, nz, s.u1, s.v1, white), i3 = mbS.v(lx, y + hh, lz, nx, 0, nz, s.u0, s.v1, white);
        mbS.tri(i0, i1, i2); mbS.tri(i0, i2, i3); // (i0,i1,i2) normal = n by construction
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

    // -----------------------------------------------------------------------
    //  POIs from OSM (businesses, transport…)
    // -----------------------------------------------------------------------
    setProgress('Opening the shops…'); await tick();
    const P = props();
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
        const ne = nearestEdge(x, z);
        if (!ne) continue;
        const e = ne.edge;
        const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        const roadAng = Math.atan2(e.dirx, e.dirz); // rotation about Y that maps local +z onto the edge direction
        if (kind === 'fuel' && bIdx < 0 || kind === 'fuel' && bRecs[bIdx] && bRecs[bIdx].area > 120) {
            // canopy on pillars + pumps + pylon sign
            let fx = x, fz = z;
            if (ne.d < (side > 0 ? e.wR : e.wL) + 9) { const off = (side > 0 ? e.wR : e.wL) + 10; fx = ne.cx + e.nx * off * side; fz = ne.cz + e.nz * off * side; }
            { // the forecourt must not reach into any carriageway: push it back from the road, else skip the canopy
                let k = 0;
                while (k < 6 && polyOnRibbon(obbPoly({ x: fx, z: fz, hw: 7, hd: 11, angle: roadAng }))) { fx += e.nx * side * 3; fz += e.nz * side * 3; k++; }
                if (polyOnRibbon(obbPoly({ x: fx, z: fz, hw: 7, hd: 11, angle: roadAng })) || buildingAt(fx, fz)) { poi.h = 4; continue; }
            }
            const bs = brandStyle(brand || name) || ['#1f2937', '#ffffff', '#f97316'];
            const ca = Math.cos(roadAng), sa = Math.sin(roadAng);
            const L2W = (lx, lz) => [fx + lx * ca + lz * sa, fz - lx * sa + lz * ca];
            const canopyCol = rgb('#f3f4f6');
            c.solid.box(fx, 5.0, fz, 10, 0.9, 16, roadAng, canopyCol);
            c.solid.box(fx, 5.0, fz, 10.05, 0.5, 16.05, roadAng, rgb(bs[0]));
            for (const [lx, lz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.45, 4.8, 0.45, roadAng, rgb('#d1d5db')); addPropColl(px, pz, 0.35, 'fuel'); }
            for (const [lx, lz] of [[-1.6, -3.5], [1.6, -3.5], [-1.6, 3.5], [1.6, 3.5]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.9, 1.7, 0.6, roadAng, rgb('#e5e7eb')); c.solid.box(px, 1.5, pz, 0.92, 0.35, 0.62, roadAng, rgb(bs[0])); addPropColl(px, pz, 0.55, 'fuel'); }
            c.ground.flatFan([L2W(-7, -11), L2W(7, -11), L2W(7, 11), L2W(-7, 11)], Y.parking + 0.003, rgb('#77787b'), 0.15);
            // pylon at the kerb
            const off2 = (side > 0 ? e.wR : e.wL) + 2.5;
            const px = ne.cx + e.nx * off2 * side + e.dirx * 9, pz = ne.cz + e.nz * off2 * side + e.dirz * 9;
            if (onRibbon(px, pz, 1.4)) { poi.h = 6; poi.w = 10; poi.d = 16; continue; }
            c.solid.box(px, 0.2, pz, 0.6, 7.5, 2.4, roadAng + Math.PI / 2, rgb(bs[0]));
            const s = signs.get((brand || name || 'Fuel').slice(0, 18), bs[0], bs[1], bs[2]);
            if (s) for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.3, Math.min(2.2, 2.3 / s.aspect * 2), 5.6, s, 0.32);
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
            const back = L2W(-side * 0.8, 0); // local +x points toward the road (= -normal)
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
            const s = signs.get((brand || name).slice(0, 22), st[0], st[1], st[2]);
            if (!s) continue;
            c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563')); addPropColl(px, pz, 0.2, 'pylon');
            for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.2, 2.2 / s.aspect, 3.4, s, 0.08);
        }
    }
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
        if (!US) return kind === 'forest' ? 0.15 : kind === 'park' ? 0.08 : 0.03;
        const dt = Math.min(Math.hypot(x - dtSea.x, z - dtSea.z) / 1300, Math.hypot(x - dtBel.x, z - dtBel.z) / 700);
        return kind === 'street' ? (dt < 1 ? 0.08 : 0.3) : dt < 1 ? 0.2 : 0.62;
    };
    // species trees (trees.js): species from OSM where mapped, else per city / street-type defaults (one species per
    // street row; conifers only where OSM says needleleaved, in parks / forests / gardens); size from the OSM height,
    // else typical per kind. `s` (legacy ≈ 1 for a 6–8 m tree) only seeds the height when nothing better is known.
    const TG = treeGeometries();
    const treeGrid = new BoxGrid(20), treeNear = (x, z, r) => { let f = false; treeGrid.each(x - r, z - r, x + r, z + r, (t) => { if (!f && Math.hypot(t.x - x, t.z - z) < r) f = true; }); return f; };
    const placeTree = (x, z, s, kind, con = null, dec = null, opt = {}) => {
        if (treeList.length >= maxTrees) return false;
        if (kind === 'street' && treeNear(x, z, 4.5)) return false; // (a mapped OSM tree already stands there)
        if (kind === 'street' && onRibbon(x, z, 1.3)) return false; // (no row trees on medians / verges narrower than ≈ 2.6 m)
        const k = Math.round(x / 1.6) + ',' + Math.round(z / 1.6); if (treeSeen.has(k)) return false;
        if (onRibbon(x, z, 0.35 * s + 0.5) || buildingAt(x, z) || isWater(x, z)) return false;
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
        const con = species === 'conifer' || (leaf & 2) ? true : (t & 1) && !(leaf & 1) ? true : false;
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
        const T = buildSpeciesTrees(treeList, { rng, cull: 1200, near: 100, maxNear: 280 }); // (≈ 1.2 km view range for trees)
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
    const standY = (x, z, y) => { let best = 0.15, bd = Math.abs(y - 0.15); surfacesAt(x, z, (h) => { const v = h - Y.road + 0.15, d = Math.abs(v - y); if (d < bd) { bd = d; best = v; } }); return best; };
    const addLamp = (l) => { l.y = standY(l.x, l.z, l.y); lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); addPropColl(l.x, l.z, 0.18, 'lamp'); };
    const osmLamps = data.lamps || [];
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
            if (onRibbon(x, z, R + 0.2) || buildingAt(x, z) || isWater(x, z)) continue;
            const ne = nearestEdge(x, z, null, 40); const ang = ne ? Math.atan2(ne.edge.dirx, ne.edge.dirz) : 0;
            const c = cellOf(x, z), sb = c.solid;
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
            furnCount++;
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
            const half = (m.l1 - m.l0) / 2, lc = (m.l0 + m.l1) / 2;
            const at = (d, l) => [m.x + ix * d + px * (lc + l), m.z + iz * d + pz * (lc + l)];
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
            closures.push({ x: m.x, z: m.z, heading: m.heading, edge: e, node: m.node, kind, leadsTo });
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
            const c = cellOf(x, z), y0 = 0.15 + yAlong(e, x, z);
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
        for (let v = -R, row = 0; v < R; row++) {
            for (let u = -R; u < R; u += 2.6) {
                const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
                if (!inArea(a, x, z) || !inArea(a, x + vx * 2.6, z + vz * 2.6) || !inArea(a, x - vx * 2.6, z - vz * 2.6)) continue;
                if (!rng.chance(0.72) || buildingAt(x, z)) continue;
                const rot = ang + (row % 2 ? 0 : Math.PI) + Math.PI / 2;
                const box = { x, z, hw: 0.95, hd: 2.3, angle: rot, r: 2.5, poly: null, h: 1.5, prop: true, kind: 'parked' };
                if (polyOnRibbon(obbPoly({ ...box, hw: 1.3, hd: 2.7 })) || [-1.6, 0, 1.6].some(o => onRibbon(x + Math.sin(rot) * o, z + Math.cos(rot) * o, 1.2))) continue; // keep off any carriageway / lane strip
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                if (useInst) { const k2 = Math.floor(x / (CELL * 2)) + ',' + Math.floor(z / (CELL * 2)); let L = parkedLots.get(k2); if (!L) parkedLots.set(k2, L = []); L.push({ kind, color: col, x, y: 0.12, z, yaw: rot }); }
                else cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, rot, 1, 1, 1, [255, 255, 255]);
                propColl.push(box);
                parked++; lotCount++;
                if (parked >= maxParked || lotCount > 80) break;
            }
            if (parked >= maxParked || lotCount > 80) break;
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
            if (!noPole) { c.solid.geo(P.tlight, px, 0.15 + n.y, pz, rot, 1, 1, 1, [255, 255, 255]); addPropColl(px, pz, 0.2, 'tlight'); }
            const ap = { edge: e, phase, node: n, x: px + dx * 0.36, z: pz + dz * 0.36, y: noPole ? -200 : 0.15 + n.y, state: null, lamp: lampList.length, lamps: null, noPole };
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
        m.userData.nightEmissive = 0.45; m.name = 'shop-spill';
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
    const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, depthWrite: false });
    const areaMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); areaMat.name = 'landuse';
    const paveMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); paveMat.name = 'paved-areas';
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise, depthWrite: false }); grassMat.name = 'grass';
    const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true }); roofMat.name = 'roofs';
    const backdropMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas }); backdropMat.name = 'backdrop';
    const signTex = signs.textures();
    const signMats = signTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: '#e8e8e8', alphaTest: 0.5 }));
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
            case 'water': { const m = addSuper(o, waterMat, false, 'water'); if (m) m.renderOrder = -18; break; }
            case 'solid': addSuper(o, solidMat, true, 'solid'); break;
            case 'detail': { const m = addSuper(o, solidMat, true, 'detail'); if (m) m.userData.cull = 110 + CELL * 0.71; break; } // near LOD only
            case 'signs': addSuper(o, signMats[o.page], false, 'signs'); break;
            case 'spill': { const m = addSuper(o, spillMat, false, 'shop-spill'); if (m) { m.renderOrder = 5; m.castShadow = m.receiveShadow = false; } break; }
        }
    }
    let parkedCalls = 0;
    for (const [k, list] of parkedLots) {
        const [I, J] = k.split(',').map(Number);
        const pg = makeParkedCars(list, { city: city.id, paintSpace: 'linear' }); pg.name = `parked ${k}`; // (CAR_COLORS are sRGB hex: let three.js linearise them, as the old merged lots did)
        pg.userData.cx = (I + 0.5) * CELL * 2; pg.userData.cz = (J + 0.5) * CELL * 2; pg.userData.cull = VIEW.props + CELL * 0.71;
        tris += pg.userData.triangles || 0; parkedCalls += pg.userData.drawCalls || 0;
        cellsGroup.add(pg);
    }
    for (const m of vegetation.treeCrownMeshes.concat(vegetation.treeTrunkMeshes)) { cellsGroup.add(m); tris += (m.userData.always ? m.instanceMatrix.count : m.count) * (m.geometry.index.count / 3); }
    { const hMat = new THREE.MeshLambertMaterial({ vertexColors: true }); hMat.name = 'horizon'; const hm = addMesh(horizon, hMat, false, 'horizon'); if (hm) { hm.userData.always = true; hm.frustumCulled = true; } }
    const waterMesh = addMesh(bigWater, waterMat, false, 'water-big');
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
    const groundPlaneMat = new THREE.MeshLambertMaterial({ color: env.ground, map: noise, depthWrite: false }); groundPlaneMat.name = 'groundPlane';
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
    const stats = { phases, network: sccInfo, edges: edges.length, walls: walls.length, wallPiecesCut: wallCut, piers: pierColl.length, furniture: furnCount, roadSigns: signCount, backdrop: backdropCount,
        profile: profileStats, treesOSM, treesRows, heightFixes: heightFixes.length, heightFixSamples: heightFixes.slice(0, 30), buildingsShrunk: bShrunk, buildingsDropped: bDropped, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    console.info('[world]', city.id, stats);

    /** calls cb(height) for every drivable surface (carriageway + shoulder + sidewalk, junction pads) covering (x, z) */
    function surfacesAt(x, z, cb, prefer = null, carriagewayOnly = false, exclude = null) {
        const seen = new Set();
        edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (seen.has(e) || e.virtual || e === exclude) return; seen.add(e);
            const q = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z);
            const side = ((x - q.cx) * e.nx + (z - q.cz) * e.nz) >= 0 ? 1 : -1;
            const lim = (side > 0 ? e.wR : e.wL) + shoulderOf(e) + (carriagewayOnly ? 0 : e.sidewalk + 0.05) + (e === prefer ? 1.5 : 0);
            if (q.d > lim) return;
            if ((q.t <= 0 || q.t >= 1) && Math.hypot(x - (q.t <= 0 ? e.a.x : e.b.x), z - (q.t <= 0 ? e.a.z : e.b.z)) > (q.t <= 0 ? e.a : e.b).radius + (carriagewayOnly ? 0 : 1)) return;
            cb(Y.road + e.a.y + (e.b.y - e.a.y) * q.t);
        });
    }

    const world = {
        camera: null, // optional: set to the main camera for distance culling (auto-detected otherwise)
        group, graph, buildings: allColl, pois, lights, nodeLight, bounds, nearestEdge, edgesInBox, isWater, isPark, waterMesh, sky,
        districts, areas, landmarks, trams, stats, data, spawn, city, allEdges,
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
