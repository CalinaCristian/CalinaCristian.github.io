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
// ============================================================================

const CELL = 250;
// layering heights (metres) — every flat layer has its own height to avoid z-fighting
const Y = { landuse: 0.02, grass: 0.045, forest: 0.06, park: 0.07, pitch: 0.095, parking: 0.095, water: 0.11, ballast: 0.2, side: 0.15, road: 0.24, layer: 0.09, mark: 0.03, kerb: 0.13 };
const TILE = { interwar: 0, eclectic: 1, civic: 2, bloc: 3, glass: 4, house: 5, shop: 6, plain: 7, church: 1 };
const AREA_Y = { residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
const TRAFFIC_MUL = { motorway: 0.6, motorway_link: 0.3, trunk: 1.2, trunk_link: 0.35, primary: 1.8, primary_link: 0.4, secondary: 1.3, secondary_link: 0.3, tertiary: 0.9, tertiary_link: 0.25, residential: 0.3, unclassified: 0.35, living_street: 0.08 };
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
    const T = makeTextures();
    const S = 256;
    const tex = makeCanvasTexture(4 * S, 2 * S, (ctx) => {
        const order = ['interwar', 'eclectic', 'civic', 'bloc', 'glass', 'house', 'shop', 'plain'];
        order.forEach((name, k) => {
            const col = k % 4, rowUV = Math.floor(k / 4);
            const x = col * S, y = (1 - rowUV) * S;
            if (name === 'plain') {
                ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x, y, S, S);
                for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(x + Math.random() * S, y + Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4); }
                ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + S - 6, S, 6);
            } else ctx.drawImage(T[name].image, x, y, S, S);
        });
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
        vec2 cellSz = vec2(0.25, 0.5);
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
    get(text, bg = '#1f2937', fg = '#ffffff', accent = null) {
        const key = text + '|' + bg + '|' + fg + '|' + accent;
        let r = this.map.get(key); if (r) return r;
        let page = this.pages[this.pages.length - 1];
        if (!page || page.n >= this.cols * this.rows) {
            if (this.pages.length >= 6) return null;
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
            };
            edges.push(e); a.edges.push(e); b.edges.push(e);
        }
    }
    // unnamed connector pieces (junction links of dual carriageways…) borrow a neighbour's name
    for (let pass = 0; pass < 3; pass++) for (const e of edges) {
        if (e.name || e.len > 80) continue;
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
        if (!c) cells.set(k, c = { i, j, solid: new MeshBuilder(true), ground: new MeshBuilder(), marks: new MeshBuilder(), water: new MeshBuilder(), signs: [] });
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
    for (const a of areas) {
        const { pts, tris } = triangulate(a.outer, a.holes);
        if (!tris.length) continue;
        const y = AREA_Y[a.kind] ?? Y.landuse;
        const col = rgb(areaColors[a.kind] || env.ground);
        if (a.kind === 'water') {
            const target = (a.x1 - a.x0 > CELL * 2 || a.z1 - a.z0 > CELL * 2) ? bigWater : cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).water;
            target.flatPoly(pts, tris, y, col, 0.02);
        } else {
            cellOf((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2).ground.flatPoly(pts, tris, y, col, 0.1);
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
            const tgt = kind === 'runway' || kind === 'taxiway' ? cellOf(ax, az).ground : cellOf(ax, az).water;
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
    const layerY = (e) => (e.tunnel ? -0.05 : Math.max(0, Math.min(3, e.layer)) * Y.layer);
    const shoulderOf = (e) => (/motorway|trunk/.test(e.type) ? (e.type.endsWith('_link') ? 0.6 : 1.2) : 0.15);
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
    const retract = (e, n) => (n.pad && n.edges.length >= 2 ? Math.min(n.radius, e.len * 0.45) : 0);
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
    const dash = US ? [3, 9] : [3, 5];
    for (const e of edges) {
        const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
        const c = cellOf(mx, mz);
        const ly = layerY(e);
        const yR = Y.road + ly, yS = Y.side + ly, yM = Y.road + ly + Y.mark;
        const aR = corner(e, e.a, 1, widthAsphalt(e, 1), widthAsphalt), aL = corner(e, e.a, -1, widthAsphalt(e, -1), widthAsphalt);
        const bR = corner(e, e.b, 1, widthAsphalt(e, 1), widthAsphalt), bL = corner(e, e.b, -1, widthAsphalt(e, -1), widthAsphalt);
        const asph = asphaltOf(e);
        c.ground.flatQuad(aR[0], aR[1], bR[0], bR[1], bL[0], bL[1], aL[0], aL[1], yR, asph, 0.15);
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
            const minor = e.type === 'residential' || e.type === 'living_street' || e.type === 'unclassified';
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
        // street furniture spots
        const big = /^(trunk|primary|secondary)$/.test(e.type) && !e.tunnel;
        const treeStreet = city.treeStreets && city.treeStreets.test(e.name);
        if ((big || treeStreet) && e.len > 12) {
            const ra = retract(e, e.a) + 6, rb = e.len - retract(e, e.b) - 6;
            if (big && !e.bridge) for (let s = ra + ((e.id * 7) % 30); s < rb; s += 35) {
                for (const sd of [1, -1]) {
                    const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.min(0.7, e.sidewalk * 0.3);
                    lampSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, Math.atan2(e.nz * sd, -e.nx * sd), ly, 8]);
                }
            }
            if (!e.bridge && (treeStreet || (e.sidewalk >= 3 && !US && rng.chance(0.75)))) {
                const step = treeStreet ? 9 : 15;
                for (let s = ra + 3; s < rb; s += step * rng.range(0.85, 1.15)) for (const sd of [1, -1]) {
                    const o = (sd > 0 ? e.wR : e.wL) + shoulderOf(e) + Math.max(1.4, e.sidewalk * 0.55);
                    treeSpots.push([e.a.x + e.dirx * s + e.nx * o * sd, e.a.z + e.dirz * s + e.nz * o * sd, rng.range(0.8, 1.2), 'street']);
                }
            }
        }
    }
    // junction pads
    for (const [n, o] of padCorners) {
        const c = cellOf(n.x, n.z);
        const ly = Math.max(0, Math.min(...n.edges.map(layerY)));
        if (o.side.length >= 3) c.ground.flatFan(convexHull(o.side), Y.side + ly - 0.004, sideCol, 0.25);
        if (o.road.length >= 3) c.ground.flatFan(convexHull(o.road), Y.road + ly + 0.004, asphaltOf(n.edges[0]), 0.15);
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
    const bRecs = data.buildings.map((b, i) => {
        const ring = undelta(b, 6);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        const c = centroid(ring);
        return { i, style: data.styles[b[0]], h: b[1] / 10, minH: b[2] / 10, roof: data.roofs[b[3]], name: str(b[4]), flags: b[5], ring, c, x0, z0, x1, z1, area: Math.abs(signedArea(ring)), skip: false };
    });
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
            if (lm.backdrop) { lmGroup.add(res.mesh); res.mesh.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); continue; }
            res.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            lmGroup.add(res.mesh);
            const names = (lm.osmNames || []).map(s => s.toLowerCase());
            const R = lm.footprintRadius || 0;
            bGrid.each(p.x - R - 60, p.z - R - 60, p.x + R + 60, p.z + R + 60, (b) => {
                if (b.skip) return;
                const nm = b.name.toLowerCase();
                if ((nm && names.some(n => nm.includes(n))) || Math.hypot(b.c[0] - p.x, b.c[1] - p.z) < R) b.skip = true;
            });
            for (const cb of res.collision || []) collisionBoxes.push({ x: p.x + cb.x, z: p.z + cb.z, hw: cb.hw, hd: cb.hd, angle: cb.angle || 0, r: Math.hypot(cb.hw, cb.hd), h: 20 });
            landmarks.push({ id: lm.id, label: lm.name, x: p.x, z: p.z, clear: res.clear || R, radius: R });
        } catch (err) { console.warn('landmark failed', lm.id, err); }
    }

    // CV POIs (offices, schools, airports)
    const pois = [];
    const poiGroup = new THREE.Group(); poiGroup.name = 'pois'; group.add(poiGroup);
    const drivable = (e) => !/motorway|trunk_link/.test(e.type) && !e.tunnel;
    const kerbPoint = (x, z, re) => {
        let ne = re ? nearestEdge(x, z, (e) => drivable(e) && re.test(e.name), 400) : null;
        if (!ne) ne = nearestEdge(x, z, drivable);
        const e = ne.edge;
        const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
        const off = (side > 0 ? e.wR : e.wL) + 1.0;
        return { x: ne.cx + e.nx * off * side, z: ne.cz + e.nz * off * side, edge: e, side, cx: ne.cx, cz: ne.cz };
    };
    const signs = new SignAtlas();
    const cvBuildings = new Map();
    for (const p of city.pois || []) {
        const q = city.proj(p.lat, p.lon);
        const kind = p.kind;
        let b = buildingAt(q.x, q.z);
        const inLandmark = landmarks.find(l => l.radius > 0 && Math.hypot(l.x - q.x, l.z - q.z) < l.radius);
        if (!b && kind !== 'airport' && !inLandmark) { let bd = 45; bGrid.each(q.x - 45, q.z - 45, q.x + 45, q.z + 45, (o) => { if (o.skip || o.area < 150) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        if (kind === 'airport' && !b && !inLandmark) { let bd = 160; bGrid.each(q.x - 160, q.z - 160, q.x + 160, q.z + 160, (o) => { if (o.skip || o.area < 2000) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } }); }
        const anchor = b ? { x: b.c[0], z: b.c[1] } : { x: q.x, z: q.z };
        const door = kerbPoint(anchor.x, anchor.z, p.road);
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
            const cx = door.cx + e.nx * off * sd, cz = door.cz + e.nz * off * sd;
            const ux = e.dirx, uz = e.dirz, vx = e.nx * sd, vz = e.nz * sd;
            const ring = [[cx - ux * w / 2 - vx * d / 2, cz - uz * w / 2 - vz * d / 2], [cx + ux * w / 2 - vx * d / 2, cz + uz * w / 2 - vz * d / 2], [cx + ux * w / 2 + vx * d / 2, cz + uz * w / 2 + vz * d / 2], [cx - ux * w / 2 + vx * d / 2, cz - uz * w / 2 + vz * d / 2]];
            // remove anything in the way
            bGrid.each(cx - w, cz - w, cx + w, cz + w, (o) => { if (Math.hypot(o.c[0] - cx, o.c[1] - cz) < Math.max(w, d) * 0.7) o.skip = true; });
            const nb = { i: bRecs.length, style: 'glass', h, minH: 0, roof: 'flat', name: p.label, flags: 2, ring, c: [cx, cz], x0: cx - w, z0: cz - w, x1: cx + w, z1: cz + w, area: w * d, skip: false, cv: poi, cvSign: true };
            bRecs.push(nb); bGrid.insert(nb.x0, nb.z0, nb.x1, nb.z1, nb);
            poi.x = cx; poi.z = cz; poi.h = h; poi.w = w; poi.d = d;
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

    // ---- extrude buildings
    const palette = PALETTES[country], roofCols = ROOF_COL[country];
    const collision = [];
    let wallTris = 0;
    for (const b of bRecs) {
        if (b.skip) continue;
        const c = cellOf(b.c[0], b.c[1]);
        const mb = c.solid;
        const brng = makeRng(b.i * 7919 + 13);
        const pal = palette[b.style] || palette.plain;
        let wallCol = rgb(pal[Math.floor(brng() * pal.length)]);
        wallCol = shadeRgb(wallCol, 0.92 + brng() * 0.12);
        if (b.cv) wallCol = shadeRgb(rgb('#f4f1ea'), 1);
        const tile = TILE[b.style] ?? 7;
        const floorH = b.style === 'bloc' ? 2.9 : b.style === 'glass' ? 3.6 : b.style === 'eclectic' || b.style === 'church' ? 3.7 : 3.2;
        const bayW = b.style === 'glass' ? 2.4 : b.style === 'house' ? 3.6 : 3.3;
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
                mb.wall(ax, az, bx, bz, y0, yShop, nx, nz, rgb('#ffffff'), perim / 16, (perim + L) / 16, 0, 1, TILE.shop);
                mb.wall(ax, az, bx, bz, yShop, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - yShop) / floorH, tile);
            } else mb.wall(ax, az, bx, bz, y0, wallTop, nx, nz, wallCol, u0, u1, 0, (wallTop - y0) / floorH, tile);
            wallTris += shop ? 4 : 2;
            perim += L;
        }
        // roof
        const flatRoofCol = rgb(roofCols.flat[Math.floor(brng() * roofCols.flat.length)]);
        const pitchCol = rgb(roofCols.pitched[Math.floor(brng() * roofCols.pitched.length)]);
        if (b.roof === 'gabled' && ring.length === 4) {
            let [p0, p1, p2, p3] = ring;
            if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) [p0, p1, p2, p3] = [p1, p2, p3, p0];
            const rise = clamp(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.35, 1.2, 4.5);
            const r1 = [(p1[0] + p2[0]) / 2, h + rise, (p1[1] + p2[1]) / 2], r0 = [(p3[0] + p0[0]) / 2, h + rise, (p3[1] + p0[1]) / 2];
            const P = (p) => [p[0], h, p[1]];
            const mid = [b.c[0], h + rise * 0.5, b.c[1]];
            const outOf = (pts) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length; return [cx - mid[0], cy - mid[1] + 0.01, cz - mid[2]]; };
            mb.face4(P(p0), P(p1), r1, r0, pitchCol, outOf([P(p0), P(p1), r1, r0]));
            mb.face4(P(p2), P(p3), r0, r1, pitchCol, outOf([P(p2), P(p3), r0, r1]));
            mb.face3(P(p1), P(p2), r1, wallCol, outOf([P(p1), P(p2), r1]), tile);
            mb.face3(P(p3), P(p0), r0, wallCol, outOf([P(p3), P(p0), r0]), tile);
        } else if (pitched && ring.length <= 10) {
            const rise = clamp(Math.sqrt(b.area) * 0.32, 1.2, 6);
            const apex = [b.c[0], h + rise, b.c[1]];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], bb = ring[(k + 1) % ring.length];
                const pa = [a[0], h, a[1]], pb = [bb[0], h, bb[1]];
                mb.face3(pa, pb, apex, pitchCol, [(a[0] + bb[0]) / 2 - b.c[0], 0.5, (a[1] + bb[1]) / 2 - b.c[1]]);
            }
        } else {
            const { pts, tris } = triangulate(ring);
            if (tris.length) mb.flatPoly(pts, tris, h, b.style === 'glass' ? rgb('#3b4a57') : flatRoofCol, 0.1, -1);
            // parapet line + rooftop clutter on large flat roofs
            if (b.area > 250 && h > 9 && b.style !== 'house') {
                const s = Math.sqrt(b.area) * 0.18;
                mb.box(b.c[0] + (brng() - 0.5) * s, h, b.c[1] + (brng() - 0.5) * s, clamp(s, 2, 7), 2.2, clamp(s * 0.8, 2, 6), brng() * 3, shadeRgb(flatRoofCol, 1.15));
            }
            if (b.roof === 'dome') { const r = clamp(Math.sqrt(b.area) * 0.28, 3, 14); mb.geo(props().sphere, b.c[0], h, b.c[1], 0, r, r * 0.9, r, rgb(b.style === 'church' ? '#7a8a8f' : '#8c9aa3')); }
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
            const bs = brandStyle(brand || name) || ['#1f2937', '#ffffff', '#f97316'];
            const ca = Math.cos(roadAng), sa = Math.sin(roadAng);
            const L2W = (lx, lz) => [fx + lx * ca + lz * sa, fz - lx * sa + lz * ca];
            const canopyCol = rgb('#f3f4f6');
            c.solid.box(fx, 5.0, fz, 10, 0.9, 16, roadAng, canopyCol);
            c.solid.box(fx, 5.0, fz, 10.05, 0.5, 16.05, roadAng, rgb(bs[0]));
            for (const [lx, lz] of [[-3.5, -6], [3.5, -6], [-3.5, 6], [3.5, 6]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.45, 4.8, 0.45, roadAng, rgb('#d1d5db')); }
            for (const [lx, lz] of [[-1.6, -3.5], [1.6, -3.5], [-1.6, 3.5], [1.6, 3.5]]) { const [px, pz] = L2W(lx, lz); c.solid.box(px, 0.2, pz, 0.9, 1.7, 0.6, roadAng, rgb('#e5e7eb')); c.solid.box(px, 1.5, pz, 0.92, 0.35, 0.62, roadAng, rgb(bs[0])); }
            c.ground.flatFan([L2W(-7, -11), L2W(7, -11), L2W(7, 11), L2W(-7, 11)], Y.parking + 0.003, rgb('#77787b'), 0.15);
            // pylon at the kerb
            const off2 = (side > 0 ? e.wR : e.wL) + 2.5;
            const px = ne.cx + e.nx * off2 * side + e.dirx * 9, pz = ne.cz + e.nz * off2 * side + e.dirz * 9;
            c.solid.box(px, 0.2, pz, 0.6, 7.5, 2.4, roadAng + Math.PI / 2, rgb(bs[0]));
            const s = signs.get((brand || name || 'Fuel').slice(0, 18), bs[0], bs[1], bs[2]);
            if (s) for (const sd of [1, -1]) addSignQuad(c, px, pz, roadAng, sd, 2.3, Math.min(2.2, 2.3 / s.aspect * 2), 5.6, s, 0.32);
            collision.push({ x: px, z: pz, r: 1.4, poly: null, angle: roadAng + Math.PI / 2, hw: 0.3, hd: 1.2, h: 7 });
            poi.h = 6; poi.w = 10; poi.d = 16;
            continue;
        }
        if (kind === 'metro' && sub === 'subway_entrance') {
            c.solid.box(x, 0.18, z, 0.18, 3.2, 0.18, roadAng, rgb('#4b5563'));
            const s = signs.get('M', '#1d4ed8', '#ffffff', null);
            if (s) for (const sd of [1, -1]) addSignQuad(c, x, z, roadAng, sd, 0.9, 0.9, 3.0, s, 0.11);
            c.solid.box(x, 2.95, z, 0.95, 0.95, 0.2, roadAng, rgb('#1d4ed8'));
            continue;
        }
        if (kind === 'busstop') {
            const sideW = side > 0 ? e.wR : e.wL;
            if (ne.d > sideW + 12) continue;
            const off = sideW + Math.max(1.2, Math.min(e.sidewalk, 3) * 0.6);
            const sx = ne.cx + e.nx * off * side, sz = ne.cz + e.nz * off * side;
            const ang = roadAng; const ca = Math.cos(ang), sa = Math.sin(ang);
            const L2W = (lx, lz) => [sx + lx * ca + lz * sa, sz - lx * sa + lz * ca];
            const back = L2W(-side * 0.8, 0); // local +x points toward the road (= -normal)
            const glass = rgb('#a8c3d6'), frame = rgb(US ? '#2f3e46' : '#3b3f45');
            c.solid.box(back[0], 0.2, back[1], 0.08, 2.4, 3.6, ang, glass);
            for (const lz of [-1.8, 1.8]) { const p2 = L2W(-side * 0.8, lz); c.solid.box(p2[0], 0.2, p2[1], 0.12, 2.5, 0.12, ang, frame); const p3 = L2W(-side * 0.1, lz); c.solid.box(p3[0], 0.2, p3[1], 1.4, 2.4, 0.06, ang, glass); }
            const roofP = L2W(-side * 0.2, 0); c.solid.box(roofP[0], 2.6, roofP[1], 1.9, 0.12, 4.0, ang, frame);
            const bench = L2W(-side * 0.5, 0); c.solid.box(bench[0], 0.45, bench[1], 0.4, 0.08, 2.4, ang, rgb('#6b4a2f'));
            const pole = L2W(side * 0.3, 2.4); c.solid.box(pole[0], 0.2, pole[1], 0.08, 2.8, 0.08, ang, frame);
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
            const off = sideW + Math.max(1.5, Math.min(e.sidewalk, 4) * 0.8);
            const px = ne.cx + e.nx * off * side, pz = ne.cz + e.nz * off * side;
            const s = signs.get((brand || name).slice(0, 22), st[0], st[1], st[2]);
            if (!s) continue;
            c.solid.box(px, 0.18, pz, 0.14, 3.6, 0.14, roadAng, rgb('#4b5563'));
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
    const roadClear = (x, z, extra = 1) => { const ne = nearestEdge(x, z, null, 60); if (!ne) return true; const e = ne.edge; const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0; return ne.d > (side ? e.wR : e.wL) + shoulderOf(e) + extra; };
    const maxTrees = city.id === 'bucharest' ? 36000 : 30000;
    let treeCount = 0;
    const conifer = US;
    const placeTree = (x, z, s, kind) => {
        if (treeCount >= maxTrees) return;
        const c = cellOf(x, z);
        const v = 205 + Math.floor(rng() * 50);
        const prop = conifer && (kind !== 'street' || rng.chance(0.5)) ? P.conifer : (rng.chance(0.5) ? P.tree : P.tree2);
        c.solid.geo(prop, x, 0.12, z, rng() * 6.28, s, s * rng.range(0.9, 1.15), s, [v, Math.min(255, v + 10), v - 10]);
        treeCount++;
    };
    for (const [x, z, s, kind] of treeSpots) { if (!buildingAt(x, z) && !isWater(x, z)) placeTree(x, z, s, kind); }
    // parks & forests
    for (const a of areas) {
        if (!['park', 'forest', 'scrub', 'cemetery', 'grass'].includes(a.kind)) continue;
        const dens = a.kind === 'forest' ? 1 / 70 : a.kind === 'park' ? 1 / 140 : a.kind === 'cemetery' ? 1 / 120 : a.kind === 'scrub' ? 1 / 200 : 1 / 600;
        const n = Math.min(3000, Math.floor(a.size * dens));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z) || isWater(x, z) || buildingAt(x, z) || !roadClear(x, z, 2)) continue;
            placeTree(x, z, rng.range(0.9, a.kind === 'forest' ? 1.7 : 1.4), a.kind);
        }
    }
    // residential gardens (sparse)
    for (const a of areas) {
        if (a.kind !== 'residential' || treeCount >= maxTrees) continue;
        const n = Math.min(400, Math.floor(a.size / (US ? 500 : 900)));
        for (let i = 0; i < n; i++) {
            const x = rng.range(a.x0, a.x1), z = rng.range(a.z0, a.z1);
            if (!inArea(a, x, z) || buildingAt(x, z) || !roadClear(x, z, 3)) continue;
            placeTree(x, z, rng.range(0.8, 1.3), 'garden');
        }
    }
    // street lamps
    // street lamps: real OSM highway=street_lamp nodes + synthesized ones along big roads where OSM has none
    const lamps = [];
    const lampGrid = new BoxGrid(30);
    const lampNear = (x, z, r) => { let f = false; lampGrid.each(x - r, z - r, x + r, z + r, (l) => { if (!f && Math.hypot(l.x - x, l.z - z) < r) f = true; }); return f; };
    const addLamp = (l) => { lamps.push(l); lampGrid.insert(l.x, l.z, l.x, l.z, l); };
    const osmLamps = data.lamps || [];
    for (let i = 0; i + 2 < osmLamps.length; i += 3) {
        const x = osmLamps[i] / 10, z = osmLamps[i + 1] / 10;
        if (lampNear(x, z, 3)) continue;
        const ne = nearestEdge(x, z, null, 80);
        let rot = 0, hh = osmLamps[i + 2] / 10, ly = 0;
        if (ne) { rot = Math.atan2(-(ne.cz - z), ne.cx - x); ly = layerY(ne.edge) * (ne.d < ne.edge.halfW ? 1 : 0); if (!hh) hh = /^(motorway|trunk|primary|secondary)/.test(ne.edge.type) ? 8 : 5; }
        if (!hh) hh = 6;
        if (buildingAt(x, z)) continue;
        addLamp({ x, z, h: hh, rot, y: 0.15 + ly, osm: true });
    }
    for (const [x, z, ang, ly, hh] of lampSpots) {
        if (lampNear(x, z, lamps.length && osmLamps.length ? 17 : 8) || buildingAt(x, z)) continue;
        addLamp({ x, z, h: hh, rot: ang, y: 0.15 + ly, osm: false });
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
                if (!rng.chance(0.72) || buildingAt(x, z) || !roadClear(x, z, 2.5)) continue;
                const kind = rng.pick(carKinds), col = rng.pick(CAR_COLORS);
                cellOf(x, z).solid.geo(carProps(kind, col), x, 0.12, z, ang + (row % 2 ? 0 : Math.PI) + Math.PI / 2, 1, 1, 1, [255, 255, 255]);
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
            const px = n.x + dx * r + rx * w, pz = n.z + dz * r + rz * w;
            const c = cellOf(px, pz);
            const rot = Math.atan2(-dz, dx); // housing local +x faces along +d (toward incoming cars)
            c.solid.geo(P.tlight, px, 0.15 + layerY(e), pz, rot, 1, 1, 1, [255, 255, 255]);
            const ap = { edge: e, phase, node: n, x: px + dx * 0.36, z: pz + dz * 0.36, y: 0.15 + layerY(e), state: null, lamp: lampList.length, lamps: null };
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
    const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15 });
    const signTex = signs.textures();
    const signMats = signTex.map(t => new THREE.MeshBasicMaterial({ map: t, color: '#e8e8e8' }));
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
    let cx = 0, cz = 0;
    for (const c of cells.values()) {
        cx = c.i; cz = c.j;
        addMesh(c.ground, groundMat, false, `ground ${c.i},${c.j}`);
        addMesh(c.marks, marksMat, false, `marks ${c.i},${c.j}`);
        addMesh(c.water, waterMat, false, `water ${c.i},${c.j}`);
        addMesh(c.solid, solidMat, true, `solid ${c.i},${c.j}`);
        c.signs.forEach((mb, k) => { if (mb) addMesh(mb, signMats[k], false, `signs ${c.i},${c.j}`); });
    }
    const waterMesh = addMesh(bigWater, waterMat, false, 'water-big');
    if (waterMesh) waterMesh.userData.always = true;
    // distance culling: cells beyond the fog are hidden (three.js only frustum-culls, and the camera far plane is 5 km).
    // The viewer is world.camera if set, else the widest perspective camera found in the scene.
    const cullR = (env.fogFar || 1300) * 1.15 + CELL * 0.71;
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
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: env.ground, map: noise }));
    ground.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    ground.receiveShadow = true; ground.name = 'ground';
    group.add(ground);

    // sky dome (render.js may hide it and draw its own)
    const sky = buildSky(env);
    group.add(sky);

    // ---- collision list with spatial query
    const allColl = collision.concat(collisionBoxes);
    const collGrid = new BoxGrid(32);
    for (const b of allColl) collGrid.insert(b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r, b);
    Object.defineProperty(allColl, 'query', { value: (x, z, r, cb) => { const seen = new Set(); collGrid.each(x - r, z - r, x + r, z + r, (b) => { if (!seen.has(b)) { seen.add(b); cb(b); } }); }, enumerable: false });

    // ---- districts / labels
    const districts = data.places.map(([n, x, z, rank]) => ({ name: str(n), x: x / 10, z: z / 10, rank }));

    // ---- spawn
    let spawn = null;
    if (city.spawnLL) {
        const sp = city.spawnLL; const q = city.proj(sp.lat, sp.lon);
        const flt = (e) => (sp.road ? sp.road.test(e.name) : true) && (sp.classes ? sp.classes.test(e.type) : !/motorway/.test(e.type)) && e.len > 15;
        const ne = nearestEdge(q.x, q.z, flt, 1500) || nearestEdge(q.x, q.z, (e) => e.len > 10);
        const e = ne.edge;
        const br = (sp.bearing ?? 0) * Math.PI / 180; const want = [Math.sin(br), -Math.cos(br)];
        let dir = (e.dirx * want[0] + e.dirz * want[1]) >= 0 ? 1 : -1;
        if (e.oneway) dir = 1;
        const t = clamp(ne.t, 0.15, 0.85);
        city.spawn = { edge: [e.a.id, e.b.id], t, dir };
        const lat = (e.median / 2 + e.laneW * 0.5) * dir;
        spawn = { x: e.a.x + e.dirx * e.len * t + e.nx * lat, z: e.a.z + e.dirz * e.len * t + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir };
    }

    setProgress(''); const phases = PHASES.splice(0);
    const stats = { phases, edges: edges.length, nodes: Object.keys(nodes).length, buildings: collision.length, pois: pois.length, trees: treeCount, parked, lights: lights.length, lamps: lamps.length, osmLamps: lamps.filter(l => l.osm).length, cells: cells.size, triangles: Math.round(tris), meshes: cellsGroup.children.length, signPages: signTex.length, buildMs: Math.round(performance.now() - t0) };
    console.info('[world]', city.id, stats);

    const world = {
        camera: null, // optional: set to the main camera for distance culling (auto-detected otherwise)
        group, graph, buildings: allColl, pois, lights, nodeLight, bounds, nearestEdge, edgesInBox, isWater, isPark, waterMesh, sky,
        districts, areas, landmarks, trams, stats, data, spawn, city,
        /** street lamps {x, z, h, rot, y, osm} and the instanced meshes (heads: MeshStandardMaterial, emissive turned on at night by render.js) */
        lamps, lampPostMesh, lampHeadMesh,
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
function collideOne(b, x, z, radius) {
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

/** Returns a push vector {px, pz, hit} or null. `buildings` may carry a spatial `.query(x, z, r, cb)`. */
export function collideBuildings(buildings, x, z, radius) {
    let px = 0, pz = 0, hit = null;
    const test = (b) => {
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz > (b.r + radius) * (b.r + radius)) return;
        const r = collideOne(b, x, z, radius);
        if (r && r.pen > 0) { px += r.nx * r.pen; pz += r.nz * r.pen; hit = b; }
    };
    if (buildings.query) buildings.query(x, z, radius + 2, test); else for (const b of buildings) test(b);
    return hit ? { px, pz, hit } : null;
}
