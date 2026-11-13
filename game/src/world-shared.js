// ============================================================================
//  WORLD SHARED — constants, palettes, brand / sign styles, grids and helpers used by the world builder
//  (split out of world.js, spec 22)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { sharedBuildPool } from './build-pool.js';
import { makeVehicle } from './vehicles.js';
import { rgb, prep, mergeProps, bakeProp, UNIT_BOX } from './geobuild.js';

try { if (typeof window !== 'undefined') sharedBuildPool(); } catch (e) { /* no workers: buildWorld runs everything here */ }
// (spec 10 load budget) the modules buildWorld imports on demand are fetched and compiled while the page is idle; a build
// awaits the same import (a failed prefetch is retried there, as before)
export const lazyModule = (load) => { let p = null; if (typeof window !== 'undefined') { p = load(); p.catch(() => {}); } return () => (p ? p.catch(load) : load()); };
export const landmarksModule = lazyModule(() => import('./landmarks.js')), archetypesModule = lazyModule(() => import('./archetypes.js'));

export const CELL = 250;
// layering heights (metres) — every flat layer has its own height to avoid z-fighting
export const Y = { landuse: 0.02, grass: 0.045, forest: 0.06, park: 0.07, pitch: 0.095, parking: 0.095, water: 0.11, ballast: 0.2, side: 0.15, road: 0.24, layer: 0.09, mark: 0.03, kerb: 0.13 };
export const TILE = { interwar: 0, eclectic: 1, civic: 2, bloc: 3, glass: 4, house: 5, shop: 6, plain: 7, church: 7 }; // (church: plain wall, the tall arched openings are geometry: worship.js)
/** window grid (columns × rows) drawn in each facade atlas tile: wall UVs are divided by it so one window column = one
 *  bay (≈ 2.4–3.6 m) and one window row = one storey (the tiles hold 2 storeys and 2–4 bays: without this the windows
 *  came out at half / a quarter of their real size — the "tiny window dots") */
export const TILE_GRID = { 0: [2, 2], 1: [3, 2], 2: [4, 2], 3: [4, 2], 4: [4, 2], 5: [3, 1], 6: [1, 1], 7: [1, 1], 8: [3, 2], 9: [3, 2], 10: [2, 2], 11: [4, 2], 12: [2, 4], 13: [2, 1], 14: [1, 1], 15: [4, 1] };
export const GRASSY = new Set(['park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'turf']);
export const SPORT_KINDS = new Set(['pitch', 'turf', 'clay', 'hard', 'track']); // (drawn in the 'sport' ground layer)
// (r3-builder-4, 2026-11-13) stops without shelter metadata whose official panorama shows only a stop pole (documented
// look exceptions to the inferred-shelter rule): OSM identity of the stop POI → the panorama that shows it
export const STOP_POLE_ONLY = { 'node/5810960053': 'Unirii, Piața Sf. Gheorghe (pano 6pmwrKMHq2FbxifltMYaqw)' };
// (r3-builder-1, 2026-11-13) fountain basin copings seen on an official panorama (the generic coping is light stone):
// Bellevue w469892286, round basin with a red-brick coping
export const FOUNTAIN_COPING = { w469892286: '#9a5442' };
export const PAVED = new Set(['parking', 'apron', 'runway', 'clay', 'hard', 'pool']); // (courts / pools over the park or yard they sit in; track stays in the first-drawn area layer, under its infield pitch)
export const AREA_Y = { track: Y.pitch - 0.012, clay: Y.pitch + 0.004, turf: Y.pitch, hard: Y.pitch + 0.004, pool: Y.pitch + 0.006, yard: Y.landuse + 0.01, residential: Y.landuse, industrial: Y.landuse, commercial: Y.landuse, retail: Y.landuse, railway: Y.landuse, construction: Y.landuse, cemetery: Y.grass, grass: Y.grass, scrub: Y.grass, forest: Y.forest, park: Y.park, pitch: Y.pitch, parking: Y.parking, apron: Y.parking, runway: Y.parking + 0.01, water: Y.water };
export const TRAFFIC_MUL = { motorway: 0.6, motorway_link: 0.3, trunk: 1.2, trunk_link: 0.35, primary: 1.8, primary_link: 0.4, secondary: 1.3, secondary_link: 0.3, tertiary: 0.9, tertiary_link: 0.25, residential: 0.3, unclassified: 0.35, living_street: 0.08, service: 0.04 };
export const CLASS_RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, motorway_link: 4, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3, unclassified: 2, residential: 2, living_street: 1 };

export const PALETTES = {
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
export const VILLA_PAL = ['#ead9b0', '#e6c98a', '#f0e3c2', '#e8c3a4', '#e2b9a8', '#efe9dc', '#d8d0bc', '#dcc79a', '#f2ead6', '#c9d2b8', '#e9d29c', '#f3efe6'];
export const ROOF_COL = { RO: { pitched: ['#8a4b36', '#9c5a3c', '#6d5a4e', '#7a3f2e', '#5a5e63'], flat: ['#6f6c67', '#7a7670', '#8a8075', '#5f5d59', '#3d3b39', '#8c8f92'] }, US: { pitched: ['#4a4e55', '#5e5a55', '#3f4348', '#6b5f55', '#53504c'], flat: ['#6b6f73', '#5c6062', '#7a7d80'] } };

// brand → [background, foreground, accent]
export const BRANDS = {
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
export const KIND_STYLE = {
    fuel: { bg: '#1f2937', fg: '#ffffff', icon: '⛽', color: '#0ea5e9' }, food: { bg: '#b91c1c', fg: '#ffffff', icon: '🍔', color: '#ef4444' },
    shop: { bg: '#ea580c', fg: '#ffffff', icon: '🛒', color: '#f97316' }, bank: { bg: '#1e3a8a', fg: '#ffffff', icon: '🏦', color: '#3b82f6' },
    pharmacy: { bg: '#15803d', fg: '#ffffff', icon: '💊', color: '#22c55e' }, metro: { bg: '#1d4ed8', fg: '#ffffff', icon: 'Ⓜ', color: '#2563eb' },
    busstop: { bg: '#0f766e', fg: '#ffffff', icon: '🚌', color: '#14b8a6' }, hospital: { bg: '#dc2626', fg: '#ffffff', icon: '🏥', color: '#dc2626' },
    landmark: { bg: '#44403c', fg: '#ffffff', icon: '🏛', color: '#78716c' }, park: { bg: '#166534', fg: '#ffffff', icon: '🌳', color: '#16a34a' },
    hotel: { bg: '#4b5563', fg: '#ffffff', icon: '🏨', color: '#6b7280' }, school: { bg: '#5b21b6', fg: '#ffffff', icon: '🎓', color: '#8b5cf6' },
    airport: { bg: '#111827', fg: '#ffffff', icon: '✈', color: '#111827' }, office: { bg: '#1f2937', fg: '#ffffff', icon: '🏢', color: '#f97316' },
};
export let RESEARCH_BRANDS = {}; // per loaded map: data.brands (sign colours from the field research)
export const brandStyle = (name) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (RESEARCH_BRANDS[k]) return RESEARCH_BRANDS[k];
    // (round 3 review, Floreasca: "Mega Image Maison des Chefs" stayed the generic orange-red while the district's reviewed
    // Mega Image boards are dark grey) a longer name of a researched / reviewed brand takes that brand's palette (same
    // brand rule; the longest brand that heads the name wins, whole words only; colours only, the name keeps its own text)
    { let rk = null; for (const key in RESEARCH_BRANDS) if (key.length >= 3 && k.startsWith(key + ' ') && (!rk || key.length > rk.length)) rk = key; if (rk) return RESEARCH_BRANDS[rk].slice(0, 3); }
    // whole-word match (research Request: 'Mega' ≠ 'Megaron'); BRANDS is fixed, so its patterns and answers are kept
    if (BRAND_HITS.has(k)) return BRAND_HITS.get(k);
    BRAND_RES ||= brandPatterns();
    let hit = null; for (const [re, style] of BRAND_RES) if (re.test(k)) { hit = style; break; }
    BRAND_HITS.set(k, hit); return hit;
};
export let BRAND_RES = null; export const BRAND_HITS = new Map();
export function brandPatterns() { return Object.keys(BRANDS).map(b => [new RegExp('(^|[^\\p{L}\\p{N}])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'u'), BRANDS[b]]); }
// (spec 10 load budget) the brand patterns (Unicode property classes: slow to compile, and V8 compiles a pattern on its
// first test) are made and run once while the page is idle; the same patterns, in the same order
if (typeof window !== 'undefined') setTimeout(() => { try { BRAND_RES ||= brandPatterns(); for (const [re] of BRAND_RES) re.test(''); } catch (e) { /* made on first use instead */ } }, 0);

// (spec 10 load budget) the motorway / trunk test per road type, kept (a regular expression per call before)
export const MOTORWAY_TRUNK = new Map(), isMotorwayTrunk = (t) => { let v = MOTORWAY_TRUNK.get(t); if (v === undefined) MOTORWAY_TRUNK.set(t, v = /motorway|trunk/.test(t)); return v; };
export const shoulderOf = (e) => (e.roadWidthSource && (e.roadWidthSource.source === 'OSM width' || e.roadWidthSource.review)) ? 0 : (isMotorwayTrunk(e.type) ? (e.type.endsWith('_link') ? 0.6 : 1.2) : 0.15);
export const AWNING = ['#b91c1c', '#1f4e79', '#14532d', '#7c2d12', '#374151', '#6b21a8', '#0f766e', '#a16207'].map(rgb);
export const PHASES = [];
export let _phaseT = 0, _phaseName = '';
export const setProgress = (msg) => {
    const now = performance.now(); if (_phaseName) PHASES.push([_phaseName, Math.round(now - _phaseT)]); _phaseT = now; _phaseName = msg; if (!msg) return; try { const el = document.querySelector('#loading p'); if (el) el.textContent = msg; } catch (e) { /* no DOM */ } };
export const tick = () => new Promise(r => setTimeout(r, 0));

// ---------------------------------------------------------------------------
//  Data helpers
// ---------------------------------------------------------------------------
export function undelta(arr, start, q = 0.1) {
    const pts = [];
    let x = 0, z = 0;
    for (let i = start; i + 1 < arr.length; i += 2) {
        if (i === start) { x = arr[i]; z = arr[i + 1]; } else { x += arr[i]; z += arr[i + 1]; }
        pts.push([x * q, z * q]);
    }
    return pts;
}
export const signedArea = (pts) => { let s = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return s / 2; };
export function centroid(pts) {
    let a = 0, cx = 0, cz = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a += f; cx += (pts[j][0] + pts[i][0]) * f; cz += (pts[j][1] + pts[i][1]) * f; }
    if (Math.abs(a) < 1e-6) { let sx = 0, sz = 0; for (const p of pts) { sx += p[0]; sz += p[1]; } return [sx / pts.length, sz / pts.length]; }
    return [cx / (3 * a), cz / (3 * a)];
}
export function convexHull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
}
/** do two polygons' edges cross (proper segment intersections)? */
export function polysCross(A, B) {
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

/** Uniform grid keyed by cell → array of items (items inserted by bbox). */
export class BoxGrid {
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
//  Prop geometries (prepared once)
// ---------------------------------------------------------------------------
export let PROPS = null;
export function props() {
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
    const cylY = prep(new THREE.CylinderGeometry(1, 1, 1, 8)), cylZ = prep(new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2)); // (unit, centred; cylZ lies along z)
    PROPS = { tree, tree2, conifer, lamp, tlight, box: UNIT_BOX, sphere: prep(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), cylY, cylZ };
    return PROPS;
}

export const carPropCache = new Map();
export function carProps(kind, color) {
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



export function mixRgb(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
export function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

export function buildSky(env) {
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
export function setRESEARCHBRANDS(v) { RESEARCH_BRANDS = v; }
