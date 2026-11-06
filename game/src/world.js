import * as THREE from '../vendor/three.module.min.js';
import { makeRng, distPointSeg, pointInPolygon, clamp, makeCanvasTexture, landmarkHelpers } from './util.js';
import { makeTextures } from './buildings.js';
import { makeVehicle, CAR_COLORS } from './vehicles.js';
import { projector } from './cities.js';
import { STOPS } from './data.js';
import { MeshBuilder, rgb, shadeRgb, prep, mergeProps, bakeProp, UNIT_BOX } from './geobuild.js';

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
const GRASSY = new Set(['park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery']);
const PAVED = new Set(['parking', 'apron', 'runway']);
const AREA_Y = { residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
const TRAFFIC_MUL = { motorway: 0.6, motorway_link: 0.3, trunk: 1.2, trunk_link: 0.35, primary: 1.8, primary_link: 0.4, secondary: 1.3, secondary_link: 0.3, tertiary: 0.9, tertiary_link: 0.25, residential: 0.3, unclassified: 0.35, living_street: 0.08, service: 0.04 };
const CLASS_RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, motorway_link: 4, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3, unclassified: 2, residential: 2, living_street: 1 };

const PALETTES = {
    RO: {
        interwar: ['#e6dccb', '#efe7d8', '#d9cfbd', '#f1ece1', '#cfc5b2', '#e2d6bf'],
        eclectic: ['#e9d9b8', '#d8c6a3', '#efe3cc', '#cbbfa6', '#e4cfa7', '#d6d0c2', '#e8d8c4', '#d9b99a', '#c9b8a8'],
        civic: ['#efe9db', '#e8e1cf', '#f3eee3', '#e4dccb'],
        bloc: ['#b9b5aa', '#c7c2b6', '#a9a69d', '#d1cdc3', '#bcb3a4', '#aeaaa0', '#d8cfb8', '#c9b79c', '#b8c2c4'],
        glass: ['#5b86a8', '#6f9bbd', '#4d7593', '#7fa7c4', '#3d5e78', '#86a9bf', '#2f4a60'],
        house: ['#f1e8d4', '#ebdfc6', '#f6efe0', '#e3d6bd', '#dcd2c0', '#efd9b5', '#e8c9a8'],
        shop: ['#e3e3e0', '#d6d8da', '#eeeeee', '#e8e2d4'],
        plain: ['#a8a59f', '#9a9ea2', '#b5b1a8', '#c2bdb2', '#8d9194'],
        church: ['#efe6d2', '#e8dcc4', '#f4eee2'],
    },
    US: {
        interwar: ['#c9c3b8', '#b8b2a8', '#d6d0c4', '#a9a49b'],
        eclectic: ['#b98d6a', '#a7795a', '#c7a07f'],
        civic: ['#d8d4cc', '#c9c5bd'],
        bloc: ['#c8c2b4', '#a9b4b8', '#d9cfb9', '#9fb0b8', '#b7a99a', '#e0d6c3', '#8e9ea6'],
        glass: ['#5b7f99', '#6a8eaa', '#45657d', '#7d9bb2', '#3a556b', '#8aa3b5', '#2c4356'],
        house: ['#d8d2c4', '#c9cfd3', '#e6e1d6', '#b7c1c9', '#cbbfae', '#9fb0b8', '#e0d6c3', '#a7b59c', '#c4a98a'],
        shop: ['#d9d4c8', '#cfd2d4', '#e6e2da', '#b9b1a3'],
        plain: ['#9a9ea2', '#8d9194', '#a7abae', '#b5b1a8'],
        church: ['#d8d2c4', '#c9c3b8'],
    },
};
const ROOF_COL = { RO: { pitched: ['#8a4b36', '#9c5a3c', '#6d5a4e', '#7a3f2e', '#5a5e63'], flat: ['#6f6c67', '#7a7670', '#8a8075', '#5f5d59'] }, US: { pitched: ['#4a4e55', '#5e5a55', '#3f4348', '#6b5f55', '#53504c'], flat: ['#6b6f73', '#5c6062', '#7a7d80'] } };

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
const brandStyle = (name) => {
    if (!name) return null;
    const k = name.toLowerCase();
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

function solidMaterial(atlas) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float tile;\nvarying float vTile;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTile = tile;');
        sh.fragmentShader = 'varying float vTile;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
    if (vTile > -0.5) {
        vec2 cellSz = vec2(0.25, 0.25);
        vec2 cellId = vec2(mod(vTile, 4.0), floor(vTile / 4.0 + 0.01));
        vec2 f = fract(vMapUv);
        vec2 auv = (cellId + 0.006 + f * 0.988) * cellSz;
        vec4 sampledDiffuseColor = textureGrad(map, auv, dFdx(vMapUv) * cellSz, dFdy(vMapUv) * cellSz);
        diffuseColor *= sampledDiffuseColor;
    }
#endif`);
    };
    m.customProgramCacheKey = () => 'osm-solid-atlas';
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
    const grp = makeVehicle(kind, color);
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
export async function buildWorld(city, renderer) {
    const t0 = performance.now();
    setProgress('Loading OpenStreetMap data…');
    const url = new URL(`../data/${city.id}.json`, import.meta.url).href;
    const data = await (await fetch(url)).json();
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
    const computeSCC = () => {
        const N = nodeArr.length;
        const out = Array.from({ length: N }, () => []), inn = Array.from({ length: N }, () => []);
        for (const e of edges) { out[e.a.id].push(e.b.id); inn[e.b.id].push(e.a.id); if (!e.oneway) { out[e.b.id].push(e.a.id); inn[e.a.id].push(e.b.id); } }
        // Kosaraju (iterative)
        const order = [], seen = new Uint8Array(N);
        for (let s0 = 0; s0 < N; s0++) {
            if (seen[s0] || !nodeArr[s0].edges.length) continue;
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
        // ramps must not dive / climb while their carriageway still overlaps another road at grade (parallel service
        // roads, the street beside an underpass): pin the overlapping stretch at that road's level, the ramp starts after it
        const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
        for (let it = 0; it < 5; it++) {
            let pinned = 0;
            for (const e of edges) {
                if (e.virtual || e.L !== 0 || (Math.abs(e.ya) < 0.05 && Math.abs(e.yb) < 0.05)) continue;
                let hit = null;
                for (let s = Math.min(0.5, e.len / 2); s <= e.len - Math.min(0.5, e.len / 2) && hit === null; s += Math.min(3, Math.max(0.5, e.len - 1) / 2)) {
                    const x = e.a.x + e.dirx * s, z = e.a.z + e.dirz * s, ye = e.ya + (e.yb - e.ya) * s / e.len;
                    edgesInBox(x - 14, z - 14, x + 14, z + 14, (f) => {
                        if (hit !== null || f === e || f.virtual || shares(e, f) || f.L < 0) return;
                        const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z);
                        if (q.t <= 0.01 || q.t >= 0.99) return;
                        const side = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) >= 0 ? 1 : -1;
                        if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + Math.min(e.halfW, 6) * 0.8) return;
                        const yf = f.a.y + (f.b.y - f.a.y) * q.t, dh = Math.abs(ye - yf);
                        if (dh > 0.3 && dh < CLEAR - 1.5 && Math.abs(ye) > Math.abs(yf)) hit = yf;
                    });
                }
                if (hit === null) continue;
                for (const n of [e.a, e.b]) if (!n.yFixed && !extraPins.has(n)) { extraPins.set(n, hit); pinned++; }
            }
            // junction pads of ramps overlapping another road's carriageway
            for (const n of nodeArr) {
                if (n.yFixed || extraPins.has(n) || Math.abs(n.y) < 0.05 || !n.edges.length || n.edges.some(g => g.L !== 0)) continue; // decks may stack
                let hit = null;
                edgesInBox(n.x - 14, n.z - 14, n.x + 14, n.z + 14, (f) => {
                    if (hit !== null || f.virtual || f.a === n || f.b === n || f.L < 0 || n.edges.some(g => shares(g, f))) return;
                    const q = distPointSeg(n.x, n.z, f.a.x, f.a.z, f.b.x, f.b.z);
                    const side = ((n.x - q.cx) * f.nx + (n.z - q.cz) * f.nz) >= 0 ? 1 : -1;
                    if (q.d > (side > 0 ? f.wR : f.wL) + shoulderOf(f) + n.radius * 0.8) return;
                    const yf = f.a.y + (f.b.y - f.a.y) * q.t, dh = Math.abs(n.y - yf);
                    if (dh > 0.3 && dh < CLEAR - 1.5 && Math.abs(n.y) > Math.abs(yf)) hit = yf;
                });
                if (hit !== null) { extraPins.set(n, hit); pinned++; }
            }
            if (!pinned) break;
            solve();
        }
        // clearance check at every crossing: lift the upper structure where a ramp under it ended up too high
        for (let it = 0; it < 3; it++) {
            let fixed = 0;
            for (const c of crossings) {
                if (c.u.L < 0) continue;
                const yu = yAt(c.u, c.x, c.z), yf = yAt(c.f, c.x, c.z);
                if (yu - yf < CLEAR - 0.6) { c.u.anchorH = Math.max(c.u.anchorH, yf + CLEAR); fixed++; }
            }
            if (!fixed) break;
            solve();
        }
        function yAt(e, x, z) { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.a.y + (e.b.y - e.a.y) * t; }
        // ramps (embankments / trenches) have at most a narrow service walkway: their walls stand right at the kerb
        for (const e of edges) if (!e.bridge && Math.max(Math.abs(e.ya), Math.abs(e.yb)) > 0.3) e.sidewalk = Math.min(e.sidewalk, 0.5);
    }
    const yAlong = (e, x, z) => { const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.ya + (e.yb - e.ya) * t; };

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
        if (!c) cells.set(k, c = { i, j, solid: new MeshBuilder(true), roof: new MeshBuilder(), ground: new MeshBuilder(), area: new MeshBuilder(), grass: new MeshBuilder(), pave: new MeshBuilder(), marks: new MeshBuilder(), water: new MeshBuilder(), backdrop: new MeshBuilder(), signs: [] });
        return c;
    };
    const signMB = (c, page) => c.signs[page] || (c.signs[page] = new MeshBuilder());

    // bounds
    const [bx0, bz0, bx1, bz1] = data.bounds.map(v => v * 0.1);
    const pad = city.bounds?.pad ?? 300;
    const bounds = { minX: bx0 - pad, maxX: bx1 + pad, minZ: bz0 - pad, maxZ: bz1 + pad };

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
            target.flatPoly(pts, tris, y, col, 0.02);
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
    const asphaltBase = rgb(env.asphalt);
    const sideCol = rgb(env.sidewalk);
    const kerbCol = shadeRgb(rgb(env.sidewalk), 1.18);
    const white = rgb('#e9e9e6'), yellow = rgb('#e3b341'), busCol = rgb('#8a3b34'), railCol = rgb('#55524e'), ballastCol = rgb('#6d6861');
    const layerY = () => 0; // real heights are applied per vertex (node.y), see displace()
    const asphaltOf = (e) => {
        if (e.unpaved) return rgb('#6b645b');
        let c = asphaltBase;
        if (US && /motorway/.test(e.type)) c = rgb('#5c5c5e');
        if (e.tunnel) c = shadeRgb(c, 0.55);
        return c;
    };
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
            const ax = e.a.x + e.dirx * s + e.nx * off, az = e.a.z + e.dirz * s + e.nz * off;
            const bx = e.a.x + e.dirx * sEnd + e.nx * off, bz = e.a.z + e.dirz * sEnd + e.nz * off;
            mb.flatQuad(ax + e.nx * hw, az + e.nz * hw, bx + e.nx * hw, bz + e.nz * hw, bx - e.nx * hw, bz - e.nz * hw, ax - e.nx * hw, az - e.nz * hw, y, col, 0);
        }
    };
    const solidLine = (mb, e, s0, s1, off, y, col, hw) => { if (s1 - s0 > 0.2) dashLine(mb, e, s0, s1, off, y, col, s1 - s0, 0, hw); };
    const band = (mb, e, s0, s1, o0, o1, y, col) => {
        if (s1 - s0 < 0.2) return;
        const p = (s, o) => [e.a.x + e.dirx * s + e.nx * o, e.a.z + e.dirz * s + e.nz * o];
        const A = p(s0, o0), B = p(s1, o0), C = p(s1, o1), D = p(s0, o1);
        mb.flatQuad(A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1], y, col, 0);
    };

    const lampSpots = [];
    const treeSpots = [];
    const ribbons = []; // carriageway polygons (asphalt incl. shoulder) of every edge + junction pads → definitive clearance checks
    const dash = US ? [3, 9] : [3, 5];
    const displace = (mb, from, fn) => { for (let i = from; i < mb.vc; i++) mb.p[i * 3 + 1] += fn(mb.p[i * 3], mb.p[i * 3 + 2]); };
    const raised = [];
    for (const e of edges) {
        if (e.virtual) continue; // invisible U-turn connectors
        const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
        const c = cellOf(mx, mz);
        const v0g = c.ground.vc, v0m = c.marks.vc, v0s = c.solid.vc;
        const elevated = Math.abs(e.ya) > 0.01 || Math.abs(e.yb) > 0.01;
        if (elevated) raised.push(e);
        const ly = layerY(e);
        const yR = Y.road + ly, yS = Y.side + ly, yM = Y.road + ly + Y.mark;
        const aR = corner(e, e.a, 1, widthAsphalt(e, 1), widthAsphalt), aL = corner(e, e.a, -1, widthAsphalt(e, -1), widthAsphalt);
        const bR = corner(e, e.b, 1, widthAsphalt(e, 1), widthAsphalt), bL = corner(e, e.b, -1, widthAsphalt(e, -1), widthAsphalt);
        const asph = asphaltOf(e);
        c.ground.flatQuad(aR[0], aR[1], bR[0], bR[1], bL[0], bL[1], aL[0], aL[1], yR, asph, 0.15);
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
                    c.ground.flatQuad(ia[0], ia[1], ib[0], ib[1], ob[0], ob[1], oa[0], oa[1], top, kerbCol, 0.25);
                    c.ground.wall(ia[0], ia[1], ib[0], ib[1], yR - 0.01, top, -e.nx * s, -e.nz * s, shadeRgb(kerbCol, 0.85));
                }
            }
        }
        if (e.a.pad) { pushPad(e.a, 'road', aR); pushPad(e.a, 'road', aL); }
        if (e.b.pad) { pushPad(e.b, 'road', bR); pushPad(e.b, 'road', bL); }
        // ---- markings
        const s0 = retract(e, e.a), s1 = e.len - retract(e, e.b);
        if (s1 - s0 > 1 && !e.unpaved) {
            const m = c.marks, hw = 0.07;
            const minor = e.type === 'residential' || e.type === 'living_street' || e.type === 'unclassified' || e.type === 'service';
            const med2 = e.median / 2;
            // bus lanes (outermost lane each way)
            if (e.busLane && !/motorway|trunk/.test(e.type)) {
                if (e.lanesF > 1) band(m, e, s0, s1, med2 + e.laneW * (e.lanesF - 1), med2 + e.laneW * e.lanesF, yM - 0.004, busCol);
                if (e.lanesB > 1) band(m, e, s0, s1, -(med2 + e.laneW * (e.lanesB - 1)), -(med2 + e.laneW * e.lanesB), yM - 0.004, busCol);
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
                    const sc = atA ? r + 1.3 : e.len - r - 1.3;
                    if (sc < 1 || sc > e.len - 1) continue;
                    for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(m, e, sc - 1.4, sc + 1.4, k, k + 0.5, yM + 0.004, white);
                }
            }
        }
        // zebra at degree-2 crossing nodes (drawn once by the edge leaving the node)
        if (e.a.zebra && e.a.edges.length === 2 && e.a.edges[0] === e && !e.unpaved) {
            for (let k = -e.wL + 0.4; k < e.wR - 0.3; k += 1.0) band(c.marks, e, -1.4, 1.4, k, k + 0.5, yM + 0.004, white);
        }
        // bridges: railings
        if (e.bridge) {
            for (const s of [1, -1]) {
                const pa = corner(e, e.a, s, widthAsphalt(e, s) + 0.3, widthAsphalt), pb = corner(e, e.b, s, widthAsphalt(e, s) + 0.3, widthAsphalt);
                c.solid.wall(pa[0], pa[1], pb[0], pb[1], yR, yR + 1.1, e.nx * s, e.nz * s, rgb('#9aa3ad'));
                c.solid.wall(pa[0], pa[1], pb[0], pb[1], yR, yR + 1.1, -e.nx * s, -e.nz * s, rgb('#8a939d'));
                c.solid.flatQuad(pa[0], pa[1], pb[0], pb[1], pb[0] + e.nx * s * 0.3, pb[1] + e.nz * s * 0.3, pa[0] + e.nx * s * 0.3, pa[1] + e.nz * s * 0.3, yR + 1.1, rgb('#b0b8c0'), 0, -1);
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
                        const o = e.bridge ? w + 0.35 : e.sidewalk >= 1.2 ? w + Math.max(0.55, e.sidewalk - 0.45) : w + 1.0;
                        lampSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, Math.atan2(e.nz * sd, -e.nx * sd), e.ya + (e.yb - e.ya) * s / e.len, hh, e, sd]);
                    }
                }
            }
            if ((big || treeStreet) && !e.bridge && !elevated && e.sidewalk >= 2.2 && (treeStreet || (e.sidewalk >= 3 && !US && rng.chance(0.75)))) {
                const step = treeStreet ? 9 : 15;
                for (let s = ra + 3; s < rb; s += step * rng.range(0.85, 1.15)) for (const sd of [1, -1]) {
                    const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + clamp(e.sidewalk * 0.45, 1.0, 2.2);
                    treeSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, rng.range(0.8, 1.2), 'street']);
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
        if (elevated) { const f = (x, z) => yAlong(e, x, z); displace(c.ground, v0g, f); displace(c.marks, v0m, f); displace(c.solid, v0s, f); }
    }
    // structures under / beside elevated and sunken roads
    const pierSpots = [], pierColl = [];
    for (const e of raised) {
        const c = cellOf((e.a.x + e.b.x) / 2, (e.a.z + e.b.z) / 2);
        const sb = c.solid;
        const conc = rgb('#a9a69e'), dark = rgb('#55524d');
        const wr = widthSide(e, 1), wl = widthSide(e, -1);
        const P = (s2, o, y) => [e.a.x + e.dirx * s2 + e.nx * o, y, e.a.z + e.dirz * s2 + e.nz * o];
        const yA = e.ya + Y.road, yB = e.yb + Y.road;
        const up = Math.max(e.ya, e.yb) > 0.3, down = Math.min(e.ya, e.yb) < -0.3;
        if (up && e.bridge) {
            // deck fascia + underside + piers
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(P(0, o, yA - 1.1), P(e.len, o, yB - 1.1), P(e.len, o, yB + 0.05), P(0, o, yA + 0.05), conc, [e.nx * sgn, 0, e.nz * sgn]);
            sb.face4(P(0, wr, yA - 1.1), P(e.len, wr, yB - 1.1), P(e.len, -wl, yB - 1.1), P(0, -wl, yA - 1.1), dark, [0, -1, 0]);
            const hw = Math.max(wr, wl);
            for (let s2 = (e.id * 13) % 24 + 6; s2 < e.len - 3; s2 += 26) {
                const y = e.ya + (e.yb - e.ya) * s2 / e.len + Y.road - 1.1; if (y < 1.2) continue;
                const cols = hw > 7 ? [-hw * 0.55, hw * 0.55] : [0];
                for (const o of cols) { const q = P(s2, o, 0); pierSpots.push({ sb, x: q[0], z: q[2], y, ang: Math.atan2(e.dirx, e.dirz), e, col: conc }); }
            }
        } else if (up) {
            // ramp on an embankment: retaining walls down to the ground
            for (const [o, sgn] of [[wr, 1], [-wl, -1]]) sb.face4(P(0, o, 0), P(e.len, o, 0), P(e.len, o, Math.max(0, yB)), P(0, o, Math.max(0, yA)), conc, [e.nx * sgn, 0, e.nz * sgn]);
        }
        if (down) {
            // trench / tunnel walls facing the road, from the road up to street level
            for (const [o, sgn] of [[wr, -1], [-wl, 1]]) sb.face4(P(0, o, Math.min(yA, 0)), P(e.len, o, Math.min(yB, 0)), P(e.len, o, 0.4), P(0, o, 0.4), conc, [e.nx * sgn, 0, e.nz * sgn]);
            if (e.tunnel) {
                const ca = yA + 5.2, cb = yB + 5.2;
                sb.face4(P(0, wr, ca), P(e.len, wr, cb), P(e.len, -wl, cb), P(0, -wl, ca), dark, [0, -1, 0]); // ceiling
                c.ground.face4(P(0, wr + 0.3, 0.06), P(e.len, wr + 0.3, 0.06), P(e.len, -wl - 0.3, 0.06), P(0, -wl - 0.3, 0.06), rgb(env.ground), [0, 1, 0]); // lid at street level
                // portal facade where the tunnel opens onto a non-tunnel road
                for (const n of [e.a, e.b]) {
                    if (!n.allEdges && n.edges.every(f => f.tunnel)) continue;
                    if (n.edges.every(f => f.tunnel || f.virtual)) continue;
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
        if (o.side.length >= 3) c.ground.flatFan(convexHull(o.side), Y.side + ly - 0.004 + n.y, sideCol, 0.25);
        if (o.road.length >= 3) { const hull = convexHull(o.road); c.ground.flatFan(hull, Y.road + ly + 0.004 + n.y, asphaltOf(n.edges[0]), 0.15); ribbons.push({ node: n, poly: hull }); }
    }
    // ---- ribbon index: is (x, z) (± r) on a carriageway / junction pad? (tunnel ribbons do not block the surface)
    const ribGrid = new BoxGrid(24);
    for (const rb of ribbons) {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of rb.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        Object.assign(rb, { x0, z0, x1, z1, block: rb.e ? !(rb.e.tunnel && Math.max(rb.e.ya, rb.e.yb) < -2) : rb.node.y > -2, y: rb.e ? Math.max(rb.e.ya, rb.e.yb) : rb.node.y });
        ribGrid.insert(x0, z0, x1, z1, rb);
    }
    const polyDist = (x, z, poly) => { let d = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distPointSeg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d); return d; };
    /** the ribbon (carriageway or junction pad) that a circle (x, z, r) touches, or null */
    const onRibbon = (x, z, r = 0, filter = null) => {
        let hit = null;
        ribGrid.each(x - r, z - r, x + r, z + r, (rb) => {
            if (hit || !rb.block || x < rb.x0 - r || x > rb.x1 + r || z < rb.z0 - r || z > rb.z1 + r) return;
            if (filter && !filter(rb)) return;
            if (pointInPolygon(x, z, rb.poly) || (r > 0 && polyDist(x, z, rb.poly) < r)) hit = rb;
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
            const hs = []; ribGrid.each(x, z, x, z, (rb) => { if (rb.e === own || (rb.e && (rb.e.a === own.a || rb.e.b === own.b || rb.e.a === own.b || rb.e.b === own.a)) || (rb.node && (rb.node === own.a || rb.node === own.b))) return; if (x < rb.x0 || x > rb.x1 || z < rb.z0 || z > rb.z1 || !pointInPolygon(x, z, rb.poly)) return; const h = rb.e ? rb.e.a.y + (rb.e.b.y - rb.e.a.y) * clamp(((x - rb.e.a.x) * rb.e.dirx + (z - rb.e.a.z) * rb.e.dirz) / rb.e.len, 0, 1) : rb.node.y; hs.push(h); hs.tol = Math.max(hs.tol || 0, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85 ? 0 : 1); (hs.items || (hs.items = [])).push([h, rb.e && Math.abs(rb.e.dirx * own.dirx + rb.e.dirz * own.dirz) > 0.85]); }); return hs; };
        const add = (e, s, off, kind, tFrom, tTo) => {
            // sub-divide into ~6 m pieces so the wall can be cut where it would cross another carriageway (junction mouths)
            const yAtT = (t) => Y.road + e.ya + (e.yb - e.ya) * t;
            // trench walls reach street level (cars up there must not fall in) — except under a tunnel's roof
            const range = (y) => kind === 'rail' ? [y > 2.6 ? y - 2.2 : -1.5, y + 1.1] : kind === 'embank' ? [-1.5, y + 1.1] : kind === 'trench' ? [y - 1.5, e.tunnel ? Math.min(1.0, y + 4.6) : 1.0] : [y - 1.0, y + 0.85];
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
            const t0 = retract(e, e.a) / e.len, t1 = 1 - retract(e, e.b) / e.len; if (t1 - t0 < 0.02) continue;
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
        // separation barriers: where a road's edge borders another carriageway at a different level (a ramp diving /
        // climbing right next to a street — OSM geometry squeezed by the map scale), a car leaving the road there would
        // drop / jump onto it. Put a visible concrete barrier on that edge instead of an invisible cliff.
        const wg = new BoxGrid(16); for (const w of walls) wg.insert(Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz), w);
        const land = (x, z, y) => { let best = null, bd = Infinity; surfacesAt(x, z, (h) => { const d = Math.abs(h - y); if (d <= 2.5 && d < bd) { bd = d; best = h; } }); return best ?? Y.road; };
        const blocked = (x0, z0, x1, z1, y) => { let f = false; wg.each(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (w) => {
            if (f) return; if (!segsCross([x0, z0], [x1, z1], [w.ax, w.az], [w.bx, w.bz]) && distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).d > 1.0) return;
            const t = distPointSeg(x1, z1, w.ax, w.az, w.bx, w.bz).t; if (y >= w.y0a + (w.y0b - w.y0a) * t - 0.3 && y <= w.y1a + (w.y1b - w.y1a) * t) f = true; }); return f; };
        const barrierCol = rgb('#b9b6ae');
        for (const e of edges) {
            if (e.virtual) continue;
            const t0 = retract(e, e.a) / e.len, t1 = 1 - retract(e, e.b) / e.len; if (t1 - t0 < 0.02) continue;
            const step = Math.max(0.02, 1.5 / e.len);
            for (const s of [1, -1]) {
                const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s));
                let run = null;
                const flush = () => {
                    if (!run) return;
                    const { ta, tb } = run; run = null;
                    const P2 = (t) => [e.a.x + e.dirx * e.len * t + e.nx * off * s, e.a.z + e.dirz * e.len * t + e.nz * off * s];
                    const [ax, az] = P2(ta), [bx, bz] = P2(tb); const ya = Y.road + e.ya + (e.yb - e.ya) * ta, yb = Y.road + e.ya + (e.yb - e.ya) * tb;
                    const w = { wall: true, ax, az, bx, bz, y0a: ya - 1.5, y1a: ya + 1.0, y0b: yb - 1.5, y1b: yb + 1.0, nx: -e.nx * s, nz: -e.nz * s, kind: 'barrier', edge: e, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                    const c = cellOf(w.x, w.z), v0 = c.solid.vc;
                    for (const sd of [1, -1]) c.solid.wall(ax - e.nx * s * 0.15 * sd, az - e.nz * s * 0.15 * sd, bx - e.nx * s * 0.15 * sd, bz - e.nz * s * 0.15 * sd, Y.road, Y.road + 0.9, -e.nx * s * sd, -e.nz * s * sd, shadeRgb(barrierCol, sd > 0 ? 1 : 0.9));
                    c.solid.flatQuad(ax - e.nx * s * 0.15, az - e.nz * s * 0.15, bx - e.nx * s * 0.15, bz - e.nz * s * 0.15, bx + e.nx * s * 0.15, bz + e.nz * s * 0.15, ax + e.nx * s * 0.15, az + e.nz * s * 0.15, Y.road + 0.9, shadeRgb(barrierCol, 1.08), 0, -1);
                    displace(c.solid, v0, (x, z) => yAlong(e, x, z));
                };
                for (let t = t0; t <= t1 + 1e-6; t += step) {
                    const tt = Math.min(t, t1);
                    const own = Y.road + e.ya + (e.yb - e.ya) * tt;
                    const x = e.a.x + e.dirx * e.len * tt + e.nx * (off + 0.6) * s, z = e.a.z + e.dirz * e.len * tt + e.nz * (off + 0.6) * s;
                    const ix = e.a.x + e.dirx * e.len * tt + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * tt + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                    const bad = Math.abs(land(x, z, own) - own) > 0.55 && !blocked(ix, iz, x, z, own);
                    if (bad) { if (!run) run = { ta: Math.max(t0, tt - step / 2), tb: Math.min(t1, tt + step / 2) }; else run.tb = Math.min(t1, tt + step / 2); }
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
                const flush = () => {
                    if (!run) return; const a0 = run[0], b0 = run[1]; run = null;
                    const ax = p[0] + (q[0] - p[0]) * a0, az = p[1] + (q[1] - p[1]) * a0, bx = p[0] + (q[0] - p[0]) * b0, bz = p[1] + (q[1] - p[1]) * b0;
                    const w = { wall: true, ax, az, bx, bz, y0a: own - 1.5, y1a: own + 1.0, y0b: own - 1.5, y1b: own + 1.0, nx: -ox, nz: -oz, kind: 'barrier', edge: n.edges[0], node: n, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.3, hw: 0, hd: 0, angle: 0, poly: null, h: 1 };
                    walls.push(w); wg.insert(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), w);
                    const c = cellOf(w.x, w.z);
                    for (const sd of [1, -1]) c.solid.wall(ax + ox * 0.15 * sd, az + oz * 0.15 * sd, bx + ox * 0.15 * sd, bz + oz * 0.15 * sd, own, own + 0.9, ox * sd, oz * sd, shadeRgb(barrierCol, sd > 0 ? 0.9 : 1));
                    c.solid.flatQuad(ax - ox * 0.15, az - oz * 0.15, bx - ox * 0.15, bz - oz * 0.15, bx + ox * 0.15, bz + oz * 0.15, ax + ox * 0.15, az + oz * 0.15, own + 0.9, shadeRgb(barrierCol, 1.08), 0, -1);
                };
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
                    const bad = Math.abs(land(x + ox * 0.6, z + oz * 0.6, own) - own) > 0.55 && !blocked(n.x, n.z, x + ox * 0.6, z + oz * 0.6, own);
                    if (bad) { if (!run) run = [Math.max(0, t - 0.5 / steps), Math.min(1, t + 0.5 / steps)]; else run[1] = Math.min(1, t + 0.5 / steps); } else flush();
                }
                flush();
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
    // definitive check: no footprint may overlap a carriageway / junction pad (shrink toward the centroid, else drop)
    let bShrunk = 0, bDropped = 0;
    for (const b of bRecs) {
        if (!polyOnRibbon(b.ring)) continue;
        let ring = b.ring, ok = false;
        for (let k = 0; k < 6 && !ok; k++) { ring = ring.map(([x, z]) => [b.c[0] + (x - b.c[0]) * 0.88, b.c[1] + (z - b.c[1]) * 0.88]); ok = !polyOnRibbon(ring); }
        if (!ok || Math.abs(signedArea(ring)) < 8) { b.skip = true; b.dropped = true; bDropped++; continue; }
        b.ring = ring; b.area = Math.abs(signedArea(ring)); bShrunk++;
        b.x0 = Math.min(...ring.map(p => p[0])); b.x1 = Math.max(...ring.map(p => p[0])); b.z0 = Math.min(...ring.map(p => p[1])); b.z1 = Math.max(...ring.map(p => p[1]));
    }
    const bGrid = new BoxGrid(32);
    for (const b of bRecs) bGrid.insert(b.x0, b.z0, b.x1, b.z1, b);
    const buildingAt = (x, z) => { let r = null; bGrid.each(x, z, x, z, (b) => { if (!r && !b.skip && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInPolygon(x, z, b.ring)) r = b; }); return r; };

    // landmarks (another module; optional)
    let LANDMARKS = [], buildLandmarkFn = null;
    try { const mod = await import('./landmarks.js'); LANDMARKS = (mod.LANDMARKS || []).filter(l => l.city === city.id); buildLandmarkFn = mod.buildLandmark || null; } catch (err) { LANDMARKS = []; }
    const landmarks = [];
    const collisionBoxes = [];
    const lmGroup = new THREE.Group(); lmGroup.name = 'landmarks'; group.add(lmGroup);
    for (const lm of LANDMARKS) {
        try {
            let p = city.proj(lm.lat, lm.lon);
            const ctx = { THREE, rng: makeRng(Math.floor(Math.abs(lm.lat * 1e4 + lm.lon * 1e4))), helpers: landmarkHelpers, proj: city.proj, scale: data.proj.scale, US };
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
            const lk = lm.city === 'seattle' ? 1 : data.proj.scale;
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
            const R = (lm.footprintRadius || 0) * lk;
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
            landmarks.push({ id: lm.id, label: lm.name, x: p.x, z: p.z, clear: res.clear || R, radius: R });
        } catch (err) { console.warn('landmark failed', lm.id, err); }
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
        return { x: ne.cx + e.nx * off * side, z: ne.cz + e.nz * off * side, edge: e, side, cx: ne.cx, cz: ne.cz };
    };
    const signs = new SignAtlas();

    const cvBuildings = new Map();
    for (const p of city.pois || []) {
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
        const stop = STOPS.find(s => s.poi === p.id);
        if (stop && !p.color) p.color = stop.color;
        const poi = { id: p.id, kind, label: p.label, brand: '', address: p.address || '', x: anchor.x, z: anchor.z, doorX: door.x, doorZ: door.z, color: p.color || null, icon: p.icon || null, visited: false, h: 20, w: 26, d: 22, cv: true, interactive: true };
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
            }
        } else { poi.h = 18; }
        // floating marker
        const marker = new THREE.Group();
        const pin = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12), new THREE.MeshBasicMaterial({ color: p.color || '#f97316' }));
        pin.rotation.x = Math.PI; marker.add(pin);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 2.4; marker.add(ring);
        marker.position.set(poi.x, poi.h + 8, poi.z);
        marker.userData.pin = pin;
        poiGroup.add(marker);
        poi.marker = marker;
        // door mat / entrance plaza at the kerb
        cellOf(door.x, door.z).marks.flatFan([[door.x - 1.2, door.z - 1.2], [door.x + 1.2, door.z - 1.2], [door.x + 1.2, door.z + 1.2], [door.x - 1.2, door.z + 1.2]], Y.road + Y.mark + 0.01, rgb(p.color || '#f97316'));
        pois.push(poi);
        cvBuildings.set(p.id, b);
    }
    // keep the marker colour in sync when main.js assigns poi.color later
    for (const p of pois) Object.defineProperty(p, 'color', {
        get() { return this._color; }, set(v) { this._color = v; if (this.marker && v) this.marker.userData.pin.material.color.set(v); }, configurable: true, enumerable: true,
    });
    for (const p of pois) p.color = p._color || (city.pois.find(q => q.id === p.id) || {}).color || null;

    // ground-floor shops along the streets of the CV stops (the owner drives there: give them life)
    for (const p of pois) if (p.cv) bGrid.each(p.x - 140, p.z - 140, p.x + 140, p.z + 140, (o) => {
        if (!o.skip && o.h > 6 && o.minH <= 0 && ['interwar', 'eclectic', 'civic', 'bloc', 'plain'].includes(o.style) && Math.hypot(o.c[0] - p.x, o.c[1] - p.z) < 140 && o.area < 6000) o.flags |= 1;
    });
    // ---- extrude buildings
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    const propColl = []; // small circles for street furniture (trees, posts, shelters…)
    const addPropColl = (x, z, r, kind = 'prop') => propColl.push({ x, z, r, hw: r, hd: r, angle: 0, poly: null, h: 3, prop: true, kind });
    let wallTris = 0;
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        const brng = makeRng(b.i * 7919 + 13);
        const pal = palette[b.style] || palette.plain;
        let wallCol = rgb(b.colour && b.style !== 'glass' ? b.colour : pal[Math.floor(brng() * pal.length)]); // OSM building:colour / material first
        wallCol = shadeRgb(wallCol, 0.92 + brng() * 0.12);
        if (b.cv) wallCol = shadeRgb(rgb('#f4f1ea'), 1);
        // facade texture: base tile or its variant (atlas rows 2–3), slightly varied bay width per building
        const tile = (TILE[b.style] ?? 7) + (brng() < 0.5 ? 8 : 0);
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
            const u0 = perim / bayW, u1 = (perim + L) / bayW;
            if (shop) {
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, rgb('#ffffff'), perim / 16, (perim + L) / 16, 0, 1, TILE.shop + (b.i % 2) * 8);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / floorH, tile);
            } else mb.wall(ax, az, bx, bz, y0, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - y0) / floorH, tile);
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
            { let k = 0; while (k < 6 && polyOnRibbon(obbPoly({ x: sx, z: sz, hw: 1.2, hd: 2.2, angle: ang }))) { off += 0.6; sx = ne.cx + e.nx * off * side; sz = ne.cz + e.nz * off * side; k++; }
              if (polyOnRibbon(obbPoly({ x: sx, z: sz, hw: 1.2, hd: 2.2, angle: ang })) || buildingAt(sx, sz)) continue; }
            const L2W = (lx, lz) => [sx + lx * ca + lz * sa, sz - lx * sa + lz * ca];
            const back = L2W(-side * 0.8, 0); // local +x points toward the road (= -normal)
            const glass = rgb('#a8c3d6'), frame = rgb(US ? '#2f3e46' : '#3b3f45');
            c.solid.box(back[0], 0.2, back[1], 0.08, 2.4, 3.6, ang, glass);
            for (const lz of [-1.8, 1.8]) { const p2 = L2W(-side * 0.8, lz); c.solid.box(p2[0], 0.2, p2[1], 0.12, 2.5, 0.12, ang, frame); const p3 = L2W(-side * 0.1, lz); c.solid.box(p3[0], 0.2, p3[1], 1.4, 2.4, 0.06, ang, glass); }
            const roofP = L2W(-side * 0.2, 0); c.solid.box(roofP[0], 2.6, roofP[1], 1.9, 0.12, 4.0, ang, frame);
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
    const placeTree = (x, z, s, kind, con = null, dec = null) => {
        if (treeList.length >= maxTrees) return false;
        const k = Math.round(x / 1.6) + ',' + Math.round(z / 1.6); if (treeSeen.has(k)) return false;
        if (onRibbon(x, z, 0.35 * s + 0.5) || buildingAt(x, z) || isWater(x, z)) return false;
        treeSeen.add(k);
        const isCon = con ?? rng.chance(coniferChance(x, z, kind));
        treeList.push({ x, z, s, con: !!isCon, dec: dec ?? (isCon ? 0 : 1), kind });
        addPropColl(x, z, 0.3 * s, 'tree');
        return true;
    };
    // OSM natural=tree / tree_row (real positions, leaf type where tagged)
    const osmTrees = data.trees || [];
    for (let i = 0; i + 2 < osmTrees.length; i += 3) {
        const x = osmTrees[i] / 10, z = osmTrees[i + 1] / 10, t = osmTrees[i + 2], con = t & 1, hh = (t >> 1) / 10;
        placeTree(x, z, hh > 0 ? clamp(hh / 6.5, 0.6, 2.0) : rng.range(0.85, 1.25), 'osm', con ? true : (US ? null : false));
    }
    for (const [x, z, s, kind] of treeSpots) placeTree(x, z, s, kind);
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
        const toGeo = (p) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); g.computeBoundingSphere(); return g; };
        const ico = new THREE.IcosahedronGeometry(1, 0), cone = new THREE.ConeGeometry(1, 1, 7);
        const geoBroad = toGeo(mergeProps([bakeProp(ico, { y: 4.6, sx: 2.6, sy: 2.4, sz: 2.6 }), bakeProp(ico, { y: 5.9, x: 0.5, sx: 1.5, sy: 1.4, sz: 1.5 })]));
        const geoCon = toGeo(mergeProps([bakeProp(cone, { y: 4.5, sx: 2.3, sy: 6, sz: 2.3 }), bakeProp(cone, { y: 7.6, sx: 1.6, sy: 4, sz: 1.6 })]));
        const geoTrunk = toGeo(bakeProp(new THREE.CylinderGeometry(0.16, 0.22, 1, 5), { y: 1.6, sy: 3.2 }));
        const crownMat = new THREE.MeshLambertMaterial({ color: '#ffffff' }); crownMat.name = 'treeCrowns';
        const trunkMat = new THREE.MeshLambertMaterial({ color: '#6b4a2f' }); trunkMat.name = 'treeTrunks';
        const BROAD = ['#4f8a3c', '#5d9440', '#679c48', '#4a7f39', '#5a8f3e', '#6f9e4a'], CON = ['#2f5d3a', '#356640', '#2b5434', '#3a6b45'];
        const chunks = new Map();
        for (const t of treeList) { const k = Math.floor(t.x / 500) + ',' + Math.floor(t.z / 500); let a = chunks.get(k); if (!a) chunks.set(k, a = []); a.push(t); }
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pV = new THREE.Vector3(), sV = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
        const masks = [];
        for (const [k, list] of chunks) {
            const [ci, cj] = k.split(',').map(Number);
            for (const con of [false, true]) {
                const ts = list.filter(t => t.con === con); if (!ts.length) continue;
                const crowns = new THREE.InstancedMesh(con ? geoCon : geoBroad, crownMat, ts.length);
                const trunks = new THREE.InstancedMesh(geoTrunk, trunkMat, ts.length);
                const mask = new Float32Array(ts.length);
                ts.forEach((t, i) => {
                    m4.compose(pV.set(t.x, 0.12, t.z), q.setFromAxisAngle(up, rng() * 6.28), sV.set(t.s, t.s * rng.range(0.9, 1.15), t.s));
                    crowns.setMatrixAt(i, m4); trunks.setMatrixAt(i, m4);
                    col.set(rng.pick(con ? CON : BROAD)).multiplyScalar(rng.range(0.88, 1.08)); crowns.setColorAt(i, col);
                    mask[i] = t.dec;
                });
                crowns.instanceMatrix.needsUpdate = true; crowns.instanceColor.needsUpdate = true;
                crowns.computeBoundingSphere(); trunks.computeBoundingSphere();
                crowns.castShadow = trunks.castShadow = true; crowns.receiveShadow = true;
                crowns.name = `treeCrowns ${k} ${con ? 'conifer' : 'broadleaf'}`; trunks.name = `treeTrunks ${k}`;
                crowns.userData.deciduousMask = mask; crowns.userData.conifer = con;
                for (const m of [crowns, trunks]) { m.userData.cx = (ci + 0.5) * 500; m.userData.cz = (cj + 0.5) * 500; m.userData.cull = (env.fogFar || 1300) * 1.15 + 360; m.matrixAutoUpdate = false; }
                vegetation.treeCrownMeshes.push(crowns); vegetation.treeTrunkMeshes.push(trunks); masks.push(mask);
            }
        }
        const total = masks.reduce((s, m) => s + m.length, 0); vegetation.deciduousMask = new Float32Array(total);
        let o = 0; for (const m of masks) { vegetation.deciduousMask.set(m, o); o += m.length; }
    }
    // street lamps: real OSM highway=street_lamp nodes (moved to the sidewalk edge when mapped on the carriageway)
    // + synthesized ones on lit / main roads at the outer edge of the sidewalk
    const lamps = [];
    const lampGrid = new BoxGrid(30);
    const lampNear = (x, z, r) => { let f = false; lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (!f && Math.hypot(l.x - x, l.z - z) < r) f = true; }); return f; };
    const addLamp = (l) => { lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); addPropColl(l.x, l.z, 0.18, 'lamp'); };
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
    let parked = 0; const maxParked = city.id === 'bucharest' ? 2600 : 2000;
    const carKinds = US ? ['suv', 'sedan', 'suv', 'hatch'] : ['hatch', 'sedan', 'hatch', 'suv'];
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
                if (polyOnRibbon(obbPoly({ ...box, hw: 1.3, hd: 2.7 }))) continue; // keep 0.35 m off any carriageway
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, rot, 1, 1, 1, [255, 255, 255]);
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
    const noise = noiseTexture();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: noise });
    const marksMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
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
    const cullR = (env.fogFar || 1300) * 1.15 + CELL * 0.71;
    let cx = 0, cz = 0;
    for (const c of cells.values()) {
        cx = c.i; cz = c.j;
        const am = addMesh(c.area, areaMat, false, `area ${c.i},${c.j}`); if (am) am.renderOrder = -19.5;
        const gm = addMesh(c.grass, grassMat, false, `grass ${c.i},${c.j}`); if (gm) gm.renderOrder = -19.2;
        const pm = addMesh(c.pave, paveMat, false, `pave ${c.i},${c.j}`); if (pm) pm.renderOrder = -19;
        addMesh(c.roof, roofMat, true, `roofs ${c.i},${c.j}`);
        const bm = addMesh(c.backdrop, backdropMat, true, `backdrop ${c.i},${c.j}`); if (bm) bm.userData.cull = cullR + 600;
        addMesh(c.ground, groundMat, false, `ground ${c.i},${c.j}`);
        addMesh(c.marks, marksMat, false, `marks ${c.i},${c.j}`);
        const wm = addMesh(c.water, waterMat, false, `water ${c.i},${c.j}`); if (wm) wm.renderOrder = -18;
        addMesh(c.solid, solidMat, true, `solid ${c.i},${c.j}`);
        c.signs.forEach((mb, k) => { if (mb) addMesh(mb, signMats[k], false, `signs ${c.i},${c.j}`); });
    }
    for (const m of vegetation.treeCrownMeshes.concat(vegetation.treeTrunkMeshes)) { cellsGroup.add(m); tris += m.count * (m.geometry.index.count / 3); }
    const waterMesh = addMesh(bigWater, waterMat, false, 'water-big');
    if (waterMesh) { waterMesh.userData.always = true; waterMesh.renderOrder = -18; }
    // distance culling: cells beyond the fog are hidden (three.js only frustum-culls, and the camera far plane is 5 km).
    // The viewer is world.camera if set, else the widest perspective camera found in the scene.
    const _v = new THREE.Vector3();
    let viewerCam = null, lastCull = null;
    cellsGroup.updateMatrixWorld = function (force) {
        const cam = world.camera || viewerCam || (viewerCam = findCamera(this));
        if (cam) {
            cam.getWorldPosition(_v);
            if (!lastCull || Math.abs(_v.x - lastCull.x) + Math.abs(_v.z - lastCull.z) > 20) {
                lastCull = { x: _v.x, z: _v.z };
                fillLamps(_v.x, _v.z, Math.min(cullR, 1100));
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
    const groundGeo = new THREE.PlaneGeometry(W + 6000, H + 6000, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const uv = groundGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 6000) / 12, uv.getY(i) * (H + 6000) / 12);
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
    if (city.spawnLL) {
        const sp = city.spawnLL; const q = city.proj(sp.lat, sp.lon);
        const flt = (e) => e.drivable && (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : !/motorway/.test(e.type)) && e.len > 15;
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
    const stats = { phases, network: sccInfo, edges: edges.length, walls: walls.length, piers: pierColl.length, furniture: furnCount, roadSigns: signCount, backdrop: backdropCount,
        buildingsShrunk: bShrunk, buildingsDropped: bDropped, landmarkBoxesTrimmed: lmTrim, landmarkBoxesDropped: lmDrop, lampsMovedToKerb: lampsMoved, crossings: crossings.length, corridorKm2: data.corridor?.areaKm2, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    console.info('[world]', city.id, stats);

    /** calls cb(height) for every drivable surface (carriageway + shoulder + sidewalk, junction pads) covering (x, z) */
    function surfacesAt(x, z, cb, prefer = null, carriagewayOnly = false) {
        const seen = new Set();
        edgeGrid.each(x - 2, z - 2, x + 2, z + 2, (e) => {
            if (seen.has(e) || e.virtual) return; seen.add(e);
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
        /** x/z scale of the world relative to reality (Bucharest 0.7, Seattle 0.5); lane widths, heights, vehicles are real size */
        scale: data.proj.scale,
        /** street lamps {x, z, h, rot, y, osm} and the instanced meshes (heads: MeshStandardMaterial, emissive turned on at night by render.js) */
        lamps, lampPostMesh, lampHeadMesh,
        /** dev check: edges whose ribbon runs into a building footprint, and dead ends that stop within 15 m of another road */
        devCheck() {
            const blocked = [], deadEnds = [];
            for (const e of allEdges) {
                if (e.tunnel || e.layer < 0) continue;
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
                    for (const t of [0.25, 0.5, 0.75]) {
                        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
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
                const t0 = retract(e, e.a) / e.len, t1 = 1 - retract(e, e.b) / e.len;
                let found = false;
                for (let t0i = t0; t0i <= t1 + 1e-6 && !found; t0i += Math.max(0.02, 1.5 / e.len)) {
                    const t = Math.min(t0i, t1);
                    const own = Y.road + e.ya + (e.yb - e.ya) * t;
                    for (const s of [1, -1]) {
                        const off = (e.bridge ? widthAsphalt(e, s) + 0.3 : widthSide(e, s)) + 0.6;
                        const x = e.a.x + e.dirx * e.len * t + e.nx * off * s, z = e.a.z + e.dirz * e.len * t + e.nz * off * s;
                        const land = this.roadHeight(x, z, { y: own });
                        const ix = e.a.x + e.dirx * e.len * t + e.nx * (s > 0 ? e.wR : e.wL) * 0.5 * s, iz = e.a.z + e.dirz * e.len * t + e.nz * (s > 0 ? e.wR : e.wL) * 0.5 * s;
                        if (Math.abs(land - own) <= 0.6 || wallBetween(ix, iz, x, z, own)) continue;
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
