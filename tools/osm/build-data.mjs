#!/usr/bin/env node
// ============================================================================
//  build-data.mjs — converts raw OpenStreetMap XML tiles (API 0.6 `map` calls)
//  into the compact JSON files the game loads at runtime:
//      game/data/bucharest.json   game/data/seattle.json
//
//  Usage:  node tools/osm/build-data.mjs --tiles <dir-with-xml-tiles> [--city bucharest|seattle] [--cache <dir>]
//  (see tools/osm/README.md). No npm dependencies.
//
//  ---------------------------------------------------------------------------
//  OUTPUT SCHEMA (version 1). All coordinates are INTEGERS in decimetres
//  (value / 10 = metres) in game space: x = east, z = south, origin = anchor.
//  "delta" arrays are [x0, z0, dx1, dz1, dx2, dz2, ...] (each point relative
//  to the previous one). String fields are indices into `strings` (-1 = none).
//  {
//    version: 1, city, generated, attribution,
//    proj: { lat0, lon0, scale, mPerLat, mPerLon, compress: {above, factor} | null },
//        game x = (lon-lon0)*mPerLon*scale
//        game z = -(dlat)*mPerLat*scale, where dlat = lat-lat0, and above
//                 `compress.above` the excess latitude is multiplied by factor
//    q: 10,                      // integer units per metre
//    bounds: [minX, minZ, maxX, maxZ],               (dm)
//    strings: [..], classes: [highway classes], styles: [..], roofs: [..],
//    poiKinds: [..], areaKinds: [..], lineKinds: [..],
//    nodes: [x0, z0, x1, z1, ...],                   road graph nodes (dm, absolute)
//    nodeFlags: [nodeIndex, flags, ...]              bit 1 traffic_signals, 2 crossing,
//               4 zebra, 8 crossing with signals, 16 stop, 32 give_way, 64 bus_stop,
//               128 tram_stop, 256 speed_camera, 512 mini_roundabout
//    roads: [[name, cls, lanesF, lanesB, median(dm, signed), laneW(dm), sidewalk(dm),
//             maxspeed(km/h), flags, layer, nodeIndex0, nodeIndex1, ...], ...]
//        Nodes are ordered in the direction of travel for one-way roads.
//        lanesB = 0 for one-way. median: centre-reservation width; for one-way
//        roads it is NEGATIVE (= -lanesF*laneW) so that the lane-centre formula
//        offset = median/2 + laneW*(i+0.5) centres the lanes on the OSM centreline.
//        flags: 1 oneway, 2 bridge, 4 tunnel, 8 roundabout, 16 bus lane, 32 tram on/along road,
//               64 toll, 128 unpaved/cobbles, 256 tram in the median, 512 bike lane, 1024 cycle track,
//               2048 lit, 4096 lit=no
//    trams: [delta, ...]                             railway=tram centre lines
//    buildings: [[style, heightDm, minHeightDm, roof, name, flags, levels, colour, roofColour, ...delta ring], ...]
//        (version 2) levels = building:levels (0 unknown), colour / roofColour = string index of '#rrggbb' (-1 none)
//        style index into `styles`, roof index into `roofs` (flat|pyramid|gabled|dome|hipped|skillion|mansard),
//        flags: 1 ground-floor shop band, 2 has a sign (name = sign text), 4 tall landmark-ish,
//               8 brand sign (name is a brand)
//    pois: [[kind, x, z, name, brand, sub, buildingIndex], ...]   sub = raw OSM value (e.g. fast_food)
//    areas: [[kind, name, outerDelta, holeDelta, ...], ...]
//    lines: [[kind, widthDm, name, delta], ...]     runways / taxiways / rivers drawn as ribbons
//    places: [[name, x, z, rank], ...]               rank 0 city, 1 suburb, 2 quarter, 3 neighbourhood
//    lamps: [x, z, heightDm, ...]                    highway=street_lamp nodes (height 0 = unknown)
//    buildingInfo: [type, startYear, architect, material, hSrc, ...]   one 5-tuple per building (district builds): OSM `building`
//                                                    value (string index, -1 for yes/none), start_date year (0 unknown), architect and
//                                                    building:material (string index), hSrc: 0 OSM height/levels, 1 research, 2 default
//                                                    estimate, 3 re-estimated by the height-sanity pass (levels then = the estimate)
//    trees: [x, z, t, ...]                           natural=tree / tree_row, t = heightDm*2 + conifer
//    treeInfo: [taxon, circumferenceCm, leaf, ...]   one triple per tree (same order as `trees`): taxon = string index of
//                                                    the OSM species / taxon / genus text ("Tilia cordata", "Platanus", -1 none),
//                                                    circumference in cm (0 unknown), leaf: 0 unknown, 1 broadleaved, 2 needleleaved,
//                                                    +4 deciduous, +8 evergreen (leaf_cycle); +16 from a tree_row
//    furniture: [kind, x, z, ...]                    kind index into `furnKinds`
//    backdrop: [x, z, w, d, h, angleDeg, ...]        building masses beyond the corridors (40 m cells)
//    corridor: { areaKm2, legs: [[label, km]] }      everything above is restricted to these corridors
//  }
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFiles, parseInto } from './parse-osm.mjs';
import { distPointSeg, pointInPolygon, polyArea, polyCentroid, simplifyIdx, simplifyRing, Grid, assembleRings } from './geom.mjs';
import { buildCorridor } from './corridors.mjs';
import { CITIES as GAME_CITIES } from '../../game/src/cities.js';
import { LANDMARKS } from '../../game/src/landmarks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const TILES = args.tiles || process.env.OSM_TILES;
const CACHE = args.cache || path.join(HERE, 'cache');
if (!TILES) { console.error('usage: node build-data.mjs --tiles <dir> [--city bucharest|seattle]'); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });

// ---------------------------------------------------------------------------
const CITIES = {
    bucharest: {
        prefixes: ['buc_', 'dn1_', 'bucx_'], country: 'RO',
        lat0: 44.4268, lon0: 26.1025, scale: 0.7, compress: { above: 44.497, factor: 0.35 }, // whole city at 0.7 (play-test: trips too long)
        // building footprint scale (local shape around its centroid) — in the compressed DN1 strip
        // buildings are squashed less than the road geometry so they still look like buildings
        shape: (lat) => lat > 44.497 ? [0.75, 0.45] : [0.7, 0.7], // = the position scale in the core → no new overlaps
        heightMap: (h) => h,
    },
    seattle: {
        prefixes: ['sea_'], country: 'US',
        lat0: 47.4435, lon0: -122.3016, scale: 0.5, compress: null,
        shape: () => [0.7, 0.7],
        heightMap: (h) => h <= 20 ? h : 20 + (h - 20) * 0.6,
    },
};

const ROAD_CLASSES = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
    'tertiary', 'tertiary_link', 'residential', 'unclassified', 'living_street', 'service'];
const STYLES = ['interwar', 'eclectic', 'civic', 'bloc', 'glass', 'house', 'shop', 'plain', 'church'];
const ROOFS = ['flat', 'pyramid', 'gabled', 'dome', 'hipped', 'skillion', 'mansard'];
const FURN_KINDS = ['bench', 'waste_basket', 'bollard', 'post_box', 'bicycle_parking', 'drinking_water', 'fountain', 'fire_hydrant', 'recycling', 'telephone', 'vending_machine', 'picnic_table', 'advertising'];
const CSS_COLOURS = { white: '#f2f0ea', black: '#2e2e2e', grey: '#9a9a96', gray: '#9a9a96', lightgrey: '#c9c8c3', lightgray: '#c9c8c3', darkgrey: '#5f5f5c', darkgray: '#5f5f5c', silver: '#b8bcc0',
    red: '#a8513a', darkred: '#7a3326', maroon: '#7a2f2f', brown: '#7b5a43', darkbrown: '#5a4030', yellow: '#e3cb7a', lightyellow: '#efe2a8', beige: '#dccbaa', cream: '#efe6cc', ivory: '#efe9d8', tan: '#c9b08a',
    orange: '#d38a52', blue: '#5b7ca3', lightblue: '#9db8d0', darkblue: '#34507a', green: '#6f8f5f', lightgreen: '#a5c08f', darkgreen: '#3f5f3a', pink: '#dba6a0', salmon: '#e09a80', terracotta: '#b5603e', sand: '#d8c49a', ochre: '#c89b4a', khaki: '#c3b57f', olive: '#80804a', gold: '#c8a54a', teal: '#3f7f7f', purple: '#7a5a8a', violet: '#8a6aa0' };
function normColour(v) {
    if (!v) return '';
    v = String(v).trim().toLowerCase().split(';')[0];
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return CSS_COLOURS[v.replace(/[\s_-]/g, '')] || '';
}
const MATERIAL_COLOUR = { brick: '#a65f45', stone: '#c9bfae', sandstone: '#d4c29a', limestone: '#ddd5c2', wood: '#9a7552', timber_framing: '#d9cdb5', metal: '#9ea4a9', concrete: '#b3b0a8', plaster: '#e4dccb', glass: '' };
const POI_KINDS = ['office', 'school', 'airport', 'fuel', 'food', 'shop', 'bank', 'pharmacy', 'metro', 'busstop', 'hospital', 'landmark', 'park', 'hotel'];
const AREA_KINDS = ['water', 'park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'residential', 'industrial', 'commercial', 'retail', 'railway', 'parking', 'apron', 'runway', 'construction'];
const LINE_KINDS = ['runway', 'taxiway', 'river', 'canal', 'stream'];

const log = (...a) => console.log('[osm]', ...a);

// ---------------------------------------------------------------------------
//  CORRIDORS — what the story drives (see corridors.mjs). Everything else is dropped
//  (except a low-poly backdrop of building masses so the horizon is not empty).
// ---------------------------------------------------------------------------
function corridorConfig(cityId) {
    const gc = GAME_CITIES[cityId];
    const poi = (id) => { const p = gc.pois.find(q => q.id === id); return { lat: p.lat, lon: p.lon, name: id, road: p.road || null }; };
    const lms = LANDMARKS.filter(l => l.city === cityId && !l.backdrop).map(l => ({ lat: l.lat, lon: l.lon, name: l.id, r: 450 }));
    const stops = gc.pois.map(p => ({ lat: p.lat, lon: p.lon, name: p.id, r: 450 }));
    const sp = gc.spawnLL;
    if (cityId === 'bucharest') {
        const C = 600; // historic centre buffer (Unirii – Universitate – Romană – Victoriei)
        return {
            rRoute: 300, rStop: 450, maxSpur: 2600,
            route: [{ lat: sp.lat, lon: sp.lon, road: sp.road, name: 'spawn' }, poi('rosetti'), poi('upb'), poi('gts'), poi('luxoft'), poi('db'), poi('arnia'), poi('uipath-buc'),
                { lat: 44.5185, lon: 26.0870, road: /DN1|București-Ploiești|Bucureşti-Ploieşti/, name: 'DN1 Băneasa' }, { ...poi('otopeni'), road: null }],
            loops: [
                { name: 'centre', closed: true, points: [
                    { lat: 44.4522, lon: 26.0859, name: 'Piața Victoriei', r: C }, { lat: 44.4466, lon: 26.0975, road: /Magheru|Piața Romană/, name: 'Piața Romană', r: C },
                    { lat: 44.4400, lon: 26.1010, road: /Bălcescu|Magheru/, name: 'Bd. Bălcescu', r: C }, { lat: 44.4355, lon: 26.1025, road: /Brătianu|Bălcescu|Piața Universității/, name: 'Universitate', r: C },
                    { lat: 44.4268, lon: 26.1025, name: 'Piața Unirii', r: C }, { lat: 44.4318, lon: 26.0968, road: /Calea Victoriei/, name: 'Calea Victoriei (CEC)', r: C },
                    { lat: 44.4413, lon: 26.0973, road: /Calea Victoriei/, name: 'Calea Victoriei (Ateneu)', r: C }] },
                { name: 'north', closed: true, points: [
                    { lat: 44.4522, lon: 26.0859, name: 'Piața Victoriei' }, { lat: 44.4600, lon: 26.0830, road: /Kiseleff/, name: 'Kiseleff' },
                    { lat: 44.4672, lon: 26.0781, road: /Kiseleff|Arcul de Triumf/, name: 'Arcul de Triumf' }, { lat: 44.4790, lon: 26.0728, road: /Kiseleff|Presei Libere/, name: 'Casa Presei' },
                    { lat: 44.4700, lon: 26.0850, road: /Aviatorilor|Charles de Gaulle|Herăstrău/, name: 'Aviatorilor' }] },
            ],
            circles: [...stops, { lat: sp.lat, lon: sp.lon, name: 'spawn', r: 450 }],
            spurs: lms,
        };
    }
    return {
        rRoute: 300, rStop: 450, maxSpur: 3000,
        route: [{ lat: 47.4425, lon: -122.3005, road: /Departures/, bearing: 135, name: 'seatac departures' },
            { lat: 47.4635, lon: -122.2750, road: /SR-518/, bearing: 90, motorway: true, name: 'SR-518' },
            { lat: 47.5300, lon: -122.3060, road: /^I-5\b/, bearing: 340, motorway: true, name: 'I-5 Boeing Field' },
            { lat: 47.6000, lon: -122.3260, road: /^I-5\b/, bearing: 0, motorway: true, name: 'I-5 downtown' },
            { lat: 47.5895, lon: -122.2700, road: /^I-90\b/, bearing: 90, motorway: true, name: 'I-90 floating bridge' },
            { lat: 47.5800, lon: -122.2050, road: /^I-90\b/, bearing: 90, motorway: true, name: 'I-90 east' },
            { lat: 47.6000, lon: -122.1880, road: /^I-405\b/, bearing: 0, motorway: true, name: 'I-405' },
            { ...poi('uipath-bel'), road: /8th Street/ }],
        loops: [
            { name: 'SR-520', points: [{ lat: 47.6000, lon: -122.3260, road: /^I-5\b/, bearing: 0, motorway: true, name: 'I-5 downtown' },
                { lat: 47.6390, lon: -122.3220, road: /^I-5\b/, bearing: 0, motorway: true, name: 'I-5 north' },
                { lat: 47.6420, lon: -122.2700, road: /SR-520/, bearing: 90, motorway: true, name: 'SR-520 bridge' },
                { lat: 47.6370, lon: -122.2150, road: /SR-520/, bearing: 90, motorway: true, name: 'SR-520 east' }, { ...poi('uipath-bel'), road: /8th Street/ }] },
            { name: 'downtown', closed: true, points: [{ lat: 47.6045, lon: -122.3307, name: 'Columbia Center' }, { lat: 47.6156, lon: -122.3395, name: 'Spheres' },
                { lat: 47.6205, lon: -122.3480, name: 'Space Needle' }, { lat: 47.6062, lon: -122.3400, name: 'Pike Place' }, { lat: 47.5960, lon: -122.3300, name: 'Pioneer Square' }] },
        ],
        circles: [...stops],
        spurs: lms,
    };
}

// ---------------------------------------------------------------------------
function makeProj(c) {
    const mPerLat = 111132, mPerLon = 111320 * Math.cos(c.lat0 * Math.PI / 180);
    const zOf = (lat) => {
        let dlat = lat - c.lat0;
        if (c.compress && lat > c.compress.above) dlat = (c.compress.above - c.lat0) + (lat - c.compress.above) * c.compress.factor;
        return -dlat * mPerLat * c.scale;
    };
    const P = (lat, lon) => [(lon - c.lon0) * mPerLon * c.scale, zOf(lat)];
    P.params = { lat0: c.lat0, lon0: c.lon0, scale: c.scale, mPerLat, mPerLon, compress: c.compress };
    P.mPerLat = mPerLat; P.mPerLon = mPerLon;
    return P;
}

const num = (v) => { if (v == null) return NaN; const m = String(v).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const yes = (v) => v === 'yes' || v === 'true' || v === '1';

function parseSpeed(v, country) {
    if (!v) return 0;
    if (/RO:urban/i.test(v)) return 50;
    if (/RO:rural/i.test(v)) return 90;
    if (/RO:trunk/i.test(v)) return 100;
    if (/RO:motorway/i.test(v)) return 130;
    if (v === 'none') return 130;
    const n = num(v);
    if (!isFinite(n)) return 0;
    if (/mph/.test(v) || (country === 'US' && !/km/.test(v))) return Math.round(n * 1.609);
    return Math.round(n);
}

function defaultSpeed(cls, country, lat) {
    if (cls === 'service') return country === 'US' ? 24 : 20;
    if (country === 'US') {
        const mph = { motorway: 60, trunk: 55, motorway_link: 40, trunk_link: 40, primary: 35, secondary: 35, tertiary: 30, primary_link: 30, secondary_link: 30, tertiary_link: 25, residential: 25, unclassified: 25, living_street: 15 }[cls] || 25;
        return Math.round(mph * 1.609);
    }
    if (cls === 'living_street') return 30;
    if ((cls === 'trunk' || cls === 'primary') && lat > 44.515) return 100; // DN1 outside Băneasa
    if (cls === 'motorway') return 130;
    return 50;
}

const DEFAULT_LANES = { motorway: 3, trunk: 3, primary: 2, secondary: 2, tertiary: 1, residential: 1, unclassified: 1, living_street: 1 };
const laneWidthFor = (cls) => /motorway|trunk/.test(cls) ? 3.7 : (cls === 'residential' || cls === 'living_street' || cls === 'unclassified' || cls === 'service') ? 3.0 : 3.5;
const SIDEWALK = { motorway: 0, motorway_link: 0, trunk: 1.5, trunk_link: 1, primary: 4, primary_link: 2.5, secondary: 3.5, secondary_link: 2.5, tertiary: 3, tertiary_link: 2.5, residential: 2.5, unclassified: 2, living_street: 2, service: 1 };

// ---------------------------------------------------------------------------
function fetchRelationFull(id) {
    const f = path.join(CACHE, `relation-${id}.xml`);
    if (fs.existsSync(f) && fs.statSync(f).size > 500) return fs.readFileSync(f, 'utf8');
    log('fetching full relation', id);
    try {
        execFileSync('curl', ['-sS', '--max-time', '180', '-A', 'drive-my-cv-osm-build/1.0 (github CalinaCristian)', '-o', f, `https://api.openstreetmap.org/api/0.6/relation/${id}/full`]);
        return fs.readFileSync(f, 'utf8');
    } catch (e) { log('  failed', e.message); return null; }
}

// ===========================================================================
// district mode: a compact area (+ optional corridor) at REAL 1:1 scale, projection anchored at the district centre
function districtSetup(cityId, did) {
    const gc = GAME_CITIES[cityId], d = gc.districts && gc.districts[did];
    if (!d) throw new Error(`unknown district ${cityId}:${did}`);
    const C = { ...CITIES[cityId], lat0: d.center.lat, lon0: d.center.lon, scale: 1, compress: null, shape: () => [1, 1], heightMap: (h) => h };
    const bb = d.bbox;
    const polys = d.poly ? [d.poly] : (d.route || d.bands) ? [] : [[[bb[0], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]], [bb[2], bb[1]]]];
    const cfg = { rRoute: d.rRoute ?? 300, rStop: 300, maxSpur: 0, route: d.route || [], loops: [], circles: d.circles || [], spurs: [], polys, fieldPad: 1800, bands: d.bands || [] };
    return { C, cfg, district: d };
}

function buildCity(cityId, did = null) {
    const ds = did ? districtSetup(cityId, did) : null;
    const C = ds ? ds.C : CITIES[cityId];
    const near = (f) => { // district mode: only the tiles around the district (+ ~2 km for the backdrop)
        if (!ds) return true;
        const m = f.match(/_(-?[\d.]+)_(-?[\d.]+)_(-?[\d.]+)_(-?[\d.]+)\.xml$/); if (!m) return true;
        const [la0, lo0, la1, lo1] = m.slice(1).map(Number), bb = ds.district.bbox, k = 0.02;
        return !(la1 < bb[0] - k || la0 > bb[2] + k || lo1 < bb[1] - k * 1.4 || lo0 > bb[3] + k * 1.4);
    };
    const files = fs.readdirSync(TILES).filter(f => f.endsWith('.xml') && C.prefixes.some(p => f.startsWith(p)) && near(f)).sort().map(f => path.join(TILES, f));
    log(cityId, files.length, 'tiles');
    const osm = parseFiles(files);
    const { nodes: N, ntags, ways: W, rels: R } = osm;
    log(`parsed nodes=${N.size} ways=${W.size} rels=${R.size}`);
    const P = makeProj(C);
    const country = C.country;

    // ---- complete interesting multipolygons with missing members (e.g. Lake Washington)
    for (const [id, r] of R) {
        const t = r.tags;
        if (t.type !== 'multipolygon') continue;
        const interesting = t.natural === 'water' || t.water || t.waterway === 'riverbank' || t.leisure === 'park' || t.landuse === 'forest' || t.natural === 'wood';
        if (!interesting) continue;
        const missing = r.members.some(m => m.type === 'way' && (!W.has(m.ref) || W.get(m.ref).nodes.some(n => !N.has(n))));
        if (!missing) continue;
        if (r.members.length > 400) continue;
        const xml = fetchRelationFull(id);
        if (xml) parseInto(xml, osm);
    }

    const pt = (id) => { const ll = N.get(id); return ll ? P(ll[0], ll[1]) : null; };
    const strings = [], strIdx = new Map();
    const S = (s) => { if (!s) return -1; let i = strIdx.get(s); if (i === undefined) { i = strings.length; strings.push(s); strIdx.set(s, i); } return i; };

    // =======================================================================
    // 1. ROADS
    // =======================================================================
    const roads = [];
    for (const [id, w] of W) {
        const t = w.tags; const cls = t.highway;
        if (!ROAD_CLASSES.includes(cls)) continue;
        if (t.area === 'yes' || t.oneway === 'reversible' || t.access === 'no' || t.motor_vehicle === 'no' || t.motorcar === 'no') continue;
        // HOV / transit-only ramps (every lane hov=designated + bus designated, e.g. the I-405 NE 6th St direct-access ramp)
        // (2026-11-07: every lane HOV-designated is enough — the NE 6th St HOV-only ramps carry hov:lanes=designated|designated without bus tags)
        if (/_link$/.test(cls) && (t.hov === 'designated' || /^designated(\|designated)*$/.test(t['hov:lanes'] || ''))) continue;
        // service roads only as connectors (pruned below unless they link the network); never parking aisles / private
        if (cls === 'service' && (/parking_aisle|drive-through|emergency_access/.test(t.service || '') || /private|no|delivery/.test(t.access || '') || t.motor_vehicle === 'private')) continue;
        if (w.nodes.some(n => !N.has(n)) || w.nodes.length < 2) continue;
        let nodes = w.nodes.slice();
        let oneway = yes(t.oneway) || t.oneway === '-1' || ((t.junction === 'roundabout' || t.junction === 'circular') && t.oneway !== 'no') || ((cls === 'motorway' || cls === 'motorway_link') && t.oneway !== 'no');
        if (t.oneway === '-1') nodes.reverse();
        const isLink = cls.endsWith('_link');
        const base = cls.replace('_link', '');
        const total = parseInt(t.lanes) || 0;
        let lf = parseInt(t['lanes:forward']) || 0, lb = parseInt(t['lanes:backward']) || 0;
        if (oneway) { lf = total || (isLink ? 1 : DEFAULT_LANES[base] || 1); lb = 0; if (t.oneway === '-1' && parseInt(t['lanes:backward'])) lf = parseInt(t['lanes:backward']); }
        else if (lf && lb) { /* given */ }
        else if (total) {
            if (lf) lb = Math.max(1, total - lf); else if (lb) lf = Math.max(1, total - lb);
            else { lf = Math.ceil(total / 2); lb = Math.max(1, total - lf); }
        } else { lf = lb = isLink ? 1 : (DEFAULT_LANES[base] || 1); }
        lf = Math.min(lf, 6); lb = Math.min(lb, 6);
        const laneW = laneWidthFor(cls);
        let sidewalk = SIDEWALK[cls] ?? 2;
        if (t.sidewalk === 'no' || t.sidewalk === 'none' || t.foot === 'no') sidewalk = Math.min(sidewalk, 0.8);
        const ll0 = N.get(nodes[0]);
        let maxspeed = parseSpeed(t.maxspeed, country) || defaultSpeed(cls, country, ll0[0]);
        let flags = 0;
        if (oneway) flags |= 1;
        if (t.bridge && t.bridge !== 'no') flags |= 2;
        if (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') flags |= 4;
        if (t.junction === 'roundabout' || t.junction === 'circular') flags |= 8;
        if (t['lanes:bus'] || t['lanes:psv'] || /designated/.test(t['bus:lanes'] || '') || /designated/.test(t['psv:lanes'] || '') || /lane/.test(t.busway || '') || /lane/.test(t['busway:right'] || '') || /lane/.test(t['busway:both'] || '')) flags |= 16;
        if (t.toll === 'yes' || /toll/i.test(t.name || '') || t['toll:motorcar'] === 'yes') flags |= 64;
        const cyc = [t.cycleway, t['cycleway:right'], t['cycleway:left'], t['cycleway:both']].join(' ');
        if (/\blane\b/.test(cyc)) flags |= 512;                                              // painted bike lane on the carriageway
        if (/track|separate/.test(cyc) || t['sidewalk:bicycle'] === 'designated' || t['sidewalk:both:bicycle'] === 'designated') flags |= 1024; // cycle track beside it
        if (/^(yes|24\/7|automatic|limited|interval|sunset-sunrise)$/.test(t.lit || '')) flags |= 2048;   // street lighting
        if (t.lit === 'no') flags |= 4096;
        if (/unpaved|gravel|dirt|ground|sett|cobblestone|unhewn/.test(t.surface || '')) flags |= 128;
        let layer = parseInt(t.layer) || 0;
        if ((flags & 2) && layer < 1) layer = 1;
        if ((flags & 4) && layer > -1) layer = -1;
        // display name
        let ref = (t.ref || '').split(';')[0].trim();
        if (country === 'US' && ref) ref = ref.replace(/^I\s*/, 'I-').replace(/^SR\s*/, 'SR-').replace(/^US\s*/, 'US-').replace(/^WA\s*/, 'SR-');
        let name = t.name || '';
        if (t['bridge:name'] && !name.includes(t['bridge:name'])) name = name ? `${name} — ${t['bridge:name']}` : t['bridge:name'];
        if (/motorway|trunk/.test(cls) && ref) {
            if (!name) name = ref;
            else if (!name.includes(ref)) name = `${ref} — ${name}`;
        }
        if (!name && ref) name = ref;
        if (!name && isLink) name = t.destination ? `Exit → ${t.destination.split(';')[0]}` : (country === 'US' ? 'Ramp' : 'Bretea');
        roads.push({ id, cls, nodes, oneway, lf, lb, laneW, sidewalk, maxspeed, flags, layer, name, lat: ll0[0], tags: t });
    }
    // prune service ways that do not connect anything (dangling chains)
    {
        let changed = true, removed = 0;
        while (changed) {
            changed = false;
            const cnt = new Map();
            for (const r of roads) for (const n of r.nodes) cnt.set(n, (cnt.get(n) || 0) + 1);
            for (let i = roads.length - 1; i >= 0; i--) {
                const r = roads[i]; if (r.cls !== 'service') continue;
                const a = r.nodes[0], b = r.nodes[r.nodes.length - 1];
                const touches = r.nodes.some(n => cnt.get(n) > 1);
                if (!touches || (a !== b && (cnt.get(a) === 1 || cnt.get(b) === 1))) { roads.splice(i, 1); removed++; changed = true; for (const n of r.nodes) cnt.set(n, cnt.get(n) - 1); }
            }
        }
        log('service connectors kept', roads.filter(r => r.cls === 'service').length, 'pruned', removed);
    }
    log('roads', roads.length);

    // projected positions for all road nodes (mutable for push-apart)
    const pos = new Map();
    for (const r of roads) for (const n of r.nodes) if (!pos.has(n)) pos.set(n, pt(n));

    // ---- corridors: keep only what the story drives (+ buffers); see corridors.mjs
    const cor = buildCorridor(roads, pos, (lat, lon) => P(lat, lon), ds ? ds.cfg : corridorConfig(cityId), log);
    const M = (x, z) => cor.margin(x, z);
    const stat = { roadsBefore: roads.length };
    const cutIds = new Map(); let cutNext = -2e9;
    {
        const out = [];
        for (const r of roads) {
            const mg = r.nodes.map(n => M(...pos.get(n)));
            let run = [];
            const flush = () => { if (run.length >= 2) out.push({ ...r, nodes: run }); run = []; };
            // district mode: cut exactly at the boundary (a new node where the way crosses it → a clean road end)
            const cut = (ia, ib) => {
                let p = pos.get(r.nodes[ia]), q = pos.get(r.nodes[ib]); // p inside, q outside
                for (let k = 0; k < 18; k++) { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (M(m[0], m[1]) <= 0) p = m; else q = m; }
                const key = Math.min(r.nodes[ia], r.nodes[ib]) + ':' + Math.max(r.nodes[ia], r.nodes[ib]);
                let id = cutIds.get(key); if (id === undefined) { id = cutNext--; cutIds.set(key, id); pos.set(id, p); }
                return id;
            };
            for (let i = 0; i < r.nodes.length; i++) {
                if (ds) {
                    if (mg[i] <= 0) { if (!run.length && i > 0) run.push(cut(i, i - 1)); run.push(r.nodes[i]); }
                    else { if (run.length) run.push(cut(i - 1, i)); flush(); }
                    continue;
                }
                if (mg[i] <= 0) { if (!run.length && i > 0 && mg[i - 1] <= 120) run.push(r.nodes[i - 1]); run.push(r.nodes[i]); }
                else { if (run.length && mg[i] <= 120) run.push(r.nodes[i]); flush(); }
            }
            flush();
        }
        // keep only the pieces connected to the corridor routes
        const par = new Map(); const f = (x) => { let r = x; while (par.has(r) && par.get(r) !== r) r = par.get(r); let y = x; while (par.has(y) && par.get(y) !== r) { const nx = par.get(y); par.set(y, r); y = nx; } return r; };
        for (const r of out) for (const n of r.nodes) if (!par.has(n)) par.set(n, n);
        for (const r of out) for (let i = 1; i < r.nodes.length; i++) { const a = f(r.nodes[0]), b = f(r.nodes[i]); if (a !== b) par.set(a, b); }
        const good = new Set(); for (const n of cor.routeNodes) if (par.has(n)) good.add(f(n));
        if (ds) { // district: the main network + sizeable pieces (no isolated parking-lot fragments)
            const size = new Map(); for (const r of out) { const k = f(r.nodes[0]); size.set(k, (size.get(k) || 0) + r.nodes.length); }
            const big = Math.max(...size.values()); for (const k of [...good]) if (size.get(k) < Math.max(12, big * 0.04)) good.delete(k);
        }
        roads.length = 0;
        for (const r of out) if (good.has(f(r.nodes[0]))) roads.push(r);
        log(`corridor roads: ${stat.roadsBefore} ways → ${out.length} clipped pieces → ${roads.length} connected`);
    }

    // half width of a road (each side) used for clearance
    const sideW = (r) => {
        if (r.oneway) { const h = r.lf * r.laneW / 2 + (/motorway|trunk/.test(r.cls) ? 1.2 : 0.3); return [h, h]; }
        return [r.median / 2 + r.lf * r.laneW + 0.3, r.median / 2 + r.lb * r.laneW + 0.3];
    };

    // ---- tram tracks
    const tramLines = [];
    for (const w of W.values()) {
        const t = w.tags;
        if (t.railway !== 'tram') continue;
        if (t.service === 'yard' || t.service === 'siding' || t.usage === 'depot') continue;
        const pts = w.nodes.map(pt).filter(Boolean);
        if (pts.length >= 2) tramLines.push(pts);
    }
    const tramGrid = new Grid(40);
    for (const pl of tramLines) for (let i = 0; i < pl.length - 1; i++) {
        const a = pl[i], b = pl[i + 1];
        tramGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a, b]);
    }
    const tramDist = (x, z, rmax) => { let best = Infinity; tramGrid.query(x, z, rmax, ([a, b]) => { const d = distPointSeg(x, z, a[0], a[1], b[0], b[1]).d; if (d < best) best = d; }); return best; };

    // ---- tram flag / median per road (sample along the polyline)
    for (const r of roads) {
        let n = 0, near = 0, centre = 0;
        for (let i = 0; i < r.nodes.length - 1; i++) {
            const a = pos.get(r.nodes[i]), b = pos.get(r.nodes[i + 1]);
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const steps = Math.max(1, Math.round(L / 10));
            for (let s = 0; s <= steps; s++) {
                const x = a[0] + (b[0] - a[0]) * s / steps, z = a[1] + (b[1] - a[1]) * s / steps;
                const d = tramDist(x, z, 8);
                n++; if (d < (r.oneway ? r.lf * r.laneW / 2 + 4 : 4.5)) near++; if (d < 2.5) centre++;
            }
        }
        r.tram = n > 0 && near / n > 0.5;
        r.median = 0;
        if (!r.oneway && r.tram && centre / n > 0.4 && r.lf + r.lb >= 2) { r.median = 6.5; r.flags |= 256; }
        else if (!r.oneway && /motorway|trunk/.test(r.cls) && !r.cls.endsWith('_link')) r.median = 3;
        if (r.tram) r.flags |= 32;
    }

    // ---- push apart parallel carriageways that would overlap at the drawn lane widths at this scale:
    //      dual carriageways, a street running beside an underpass / overpass ramp, parallel ramps…
    //      Long segments are densified first so the push acts along their whole length; near a node the two roads
    //      share (a merge / diverge) the push tapers to zero.
    {
        const MAIN = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/;
        const big = roads.filter(r => MAIN.test(r.cls));
        let densId = -1e9, added = 0;
        for (const r of big) {
            const out = [r.nodes[0]];
            for (let i = 1; i < r.nodes.length; i++) {
                const a = pos.get(r.nodes[i - 1]), b = pos.get(r.nodes[i]); const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
                const k = Math.floor(L / 18);
                for (let j = 1; j <= k; j++) { const id = densId--; pos.set(id, [a[0] + (b[0] - a[0]) * j / (k + 1), a[1] + (b[1] - a[1]) * j / (k + 1)]); out.push(id); added++; }
                out.push(r.nodes[i]);
            }
            r.nodes = out;
        }
        const roadsOf = new Map(); for (const r of big) for (const n of r.nodes) { let s = roadsOf.get(n); if (!s) roadsOf.set(n, s = []); s.push(r); }
        let movedTotal = 0;
        for (let pass = 0; pass < 3; pass++) {
        const segGrid = new Grid(40);
        for (const r of big) for (let i = 0; i < r.nodes.length - 1; i++) {
            const a = pos.get(r.nodes[i]), b = pos.get(r.nodes[i + 1]);
            segGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { r, i, a, b });
        }
        const graded = (r) => !!(r.flags & 6) || r.layer !== 0 || r.cls.endsWith('_link');
        const disp = new Map();
        for (const r of big) {
            const nodeSet = new Set(r.nodes);
            const sw = sideW(r);
            for (let i = 0; i < r.nodes.length; i++) {
                if ((roadsOf.get(r.nodes[i]) || []).length > 1) continue; // junction nodes stay where they are
                const p = pos.get(r.nodes[i]);
                const pa = pos.get(r.nodes[Math.max(0, i - 1)]), pb = pos.get(r.nodes[Math.min(r.nodes.length - 1, i + 1)]);
                let dx = pb[0] - pa[0], dz = pb[1] - pa[1]; const L = Math.hypot(dx, dz); if (L < 1e-6) continue; dx /= L; dz /= L;
                let push = 0, pushSide = 0;
                segGrid.query(p[0], p[1], 30, (s) => {
                    if (s.r === r) return;
                    if (nodeSet.has(s.r.nodes[s.i]) || nodeSet.has(s.r.nodes[s.i + 1])) return;
                    if (s.r.layer !== r.layer && ((s.r.flags | r.flags) & 2)) return; // a deck stacked on purpose (e.g. SeaTac departures over arrivals)
                    let sx = s.b[0] - s.a[0], sz = s.b[1] - s.a[1]; const sl = Math.hypot(sx, sz); if (sl < 1e-6) return; sx /= sl; sz /= sl;
                    const dot = sx * dx + sz * dz; if (Math.abs(dot) < 0.8) return; // parallel only
                    const q = distPointSeg(p[0], p[1], s.a[0], s.a[1], s.b[0], s.b[1]);
                    if (q.t <= 0 || q.t >= 1 || q.d < 0.3) return;
                    const side = (q.cx - p[0]) * (-dz) + (q.cz - p[1]) * dx > 0 ? 1 : -1; // other road on our right (+1) / left (−1)
                    if (!r.oneway || !s.r.oneway || dot > 0) { /* any parallel pair */ } else if (side > 0) return; // opposite one-ways: the other carriageway must be on our left
                    const swo = sideW(s.r);
                    const pSideOfS = (p[0] - s.a[0]) * (-sz) + (p[1] - s.a[1]) * sx > 0 ? 0 : 1; // which half of s faces us
                    const need = sw[side > 0 ? 0 : 1] + swo[pSideOfS] + 0.8 + (graded(r) !== graded(s.r) ? 0.9 : 0);
                    let deficit = need - q.d; if (deficit <= 0.05) return;
                    // taper toward nodes the two roads share (merges, diverges)
                    let taper = 1;
                    for (const n of s.r.nodes) if (nodeSet.has(n)) { const pn = pos.get(n); const d = Math.hypot(pn[0] - p[0], pn[1] - p[1]); taper = Math.min(taper, Math.max(0, (d - 6) / 45)); }
                    deficit *= taper;
                    if (deficit > push) { push = deficit; pushSide = side; }
                });
                if (push > 0.05) {
                    const m = Math.min(push / 2, 5) * -pushSide; // move away from the other road
                    const prev = disp.get(r.nodes[i]) || [0, 0, 0];
                    prev[0] += -dz * m; prev[1] += dx * m; prev[2]++;
                    disp.set(r.nodes[i], prev);
                }
            }
        }
        for (const [n, d] of disp) { const p = pos.get(n); pos.set(n, [p[0] + d[0] / d[2], p[1] + d[1] / d[2]]); }
        movedTotal += disp.size;
        if (!disp.size) break;
        }
        log(`parallel carriageways pushed apart: ${movedTotal} node moves (${added} densified)`);
    }

    // ---- connect dead ends that stop just short of another road (mapping gaps, excluded service links…)
    //      and drop tiny dead-end stubs
    {
        const cnt = new Map();
        for (const r of roads) for (const n of r.nodes) cnt.set(n, (cnt.get(n) || 0) + 1);
        const g = new Grid(30);
        const addSeg = (r, a, b) => { const pa = pos.get(a), pb = pos.get(b); const seg = { r, a, b, dead: false }; g.insertBox(Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1]), seg); return seg; };
        for (const r of roads) for (let i = 0; i < r.nodes.length - 1; i++) addSeg(r, r.nodes[i], r.nodes[i + 1]);
        let nextId = -1, joined = 0, before = 0;
        const isMw = (r) => /motorway/.test(r.cls);
        for (const r of roads) {
            for (const atStart of [true, false]) {
                const n = atStart ? r.nodes[0] : r.nodes[r.nodes.length - 1];
                if (cnt.get(n) !== 1 || r.nodes[0] === r.nodes[r.nodes.length - 1]) continue;
                const p = pos.get(n), q = pos.get(atStart ? r.nodes[1] : r.nodes[r.nodes.length - 2]);
                let dx = p[0] - q[0], dz = p[1] - q[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; // outward direction of the dead end
                let best = null, bd = 12;
                g.query(p[0], p[1], 12, (sg) => {
                    if (sg.dead || sg.r === r || sg.r.layer !== r.layer || isMw(sg.r) !== isMw(r)) return;
                    const pa = pos.get(sg.a), pb = pos.get(sg.b);
                    const d = distPointSeg(p[0], p[1], pa[0], pa[1], pb[0], pb[1]);
                    if (d.d < 0.3 || d.d >= bd) return;
                    if (((d.cx - p[0]) * dx + (d.cz - p[1]) * dz) / d.d < 0.2) return; // must continue roughly forward
                    bd = d.d; best = { sg, d, pa, pb };
                });
                if (!best) continue;
                before++;
                const { sg, d, pa, pb } = best;
                let target;
                if (Math.hypot(d.cx - pa[0], d.cz - pa[1]) < 2) target = sg.a;
                else if (Math.hypot(d.cx - pb[0], d.cz - pb[1]) < 2) target = sg.b;
                else {
                    target = nextId--; pos.set(target, [d.cx, d.cz]);
                    const nodes = sg.r.nodes; const k = nodes.findIndex((v, i) => v === sg.a && nodes[i + 1] === sg.b);
                    if (k < 0) continue;
                    nodes.splice(k + 1, 0, target); sg.dead = true;
                    addSeg(sg.r, sg.a, target); addSeg(sg.r, target, sg.b);
                    cnt.set(target, 1);
                }
                if (atStart) r.nodes.unshift(target); else r.nodes.push(target);
                cnt.set(target, (cnt.get(target) || 0) + 1); cnt.set(n, 2);
                addSeg(r, atStart ? target : n, atStart ? n : target);
                joined++;
            }
        }
        // tiny stubs: ways shorter than 15 m with a free end
        const lenOf = (r) => { let L = 0; for (let i = 0; i < r.nodes.length - 1; i++) { const a = pos.get(r.nodes[i]), b = pos.get(r.nodes[i + 1]); L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; };
        const before2 = roads.length;
        for (let i = roads.length - 1; i >= 0; i--) { const r = roads[i]; if (lenOf(r) < 15 && (cnt.get(r.nodes[0]) === 1 || cnt.get(r.nodes[r.nodes.length - 1]) === 1)) roads.splice(i, 1); }
        log(`dev-check: ${before} dead ends within 12 m of another road → ${joined} connected; ${before2 - roads.length} stubs < 15 m removed`);
    }

    // ---- simplify polylines, keep junctions & tagged nodes
    const useCount = new Map();
    for (const r of roads) for (const n of r.nodes) useCount.set(n, (useCount.get(n) || 0) + 1);
    const nodeFlagOf = (id) => {
        const t = ntags.get(id); if (!t) return 0;
        let f = 0; const h = t.highway || '';
        if (/traffic_signals/.test(h) || t.crossing === 'traffic_signals' && h === 'traffic_signals') f |= 1;
        if (/crossing/.test(h) || t.crossing) { f |= 2; if (t.crossing === 'zebra' || t.crossing_ref === 'zebra' || t.crossing === 'marked' || t.crossing === 'uncontrolled') f |= 4; if (t.crossing === 'traffic_signals') f |= 8; }
        if (h === 'stop') f |= 16;
        if (h === 'give_way') f |= 32;
        if (h === 'bus_stop' || t.public_transport === 'stop_position' && t.bus === 'yes') f |= 64;
        if (t.railway === 'tram_stop' || (t.public_transport === 'stop_position' && t.tram === 'yes')) f |= 128;
        if (h === 'speed_camera') f |= 256;
        if (h === 'mini_roundabout') f |= 512;
        return f;
    };
    const keptIndex = new Map(); const outNodes = []; const nodeFlags = [];
    const idxOf = (id) => {
        let i = keptIndex.get(id);
        if (i === undefined) {
            i = outNodes.length / 2; keptIndex.set(id, i);
            const p = pos.get(id); outNodes.push(Math.round(p[0] * 10), Math.round(p[1] * 10));
            const f = nodeFlagOf(id); if (f) nodeFlags.push(i, f);
        }
        return i;
    };
    const outRoads = [];
    const turnLanes = []; // [roadIndex, forward 'left|through;right|…' string, backward string, …] (OSM turn:lanes → painted arrows)
    let segCount = 0;
    for (const r of roads) {
        const pts = r.nodes.map(n => pos.get(n));
        const keep = r.nodes.map((n, i) => (useCount.get(n) > 1 || nodeFlagOf(n) || (i > 0 && r.nodes[i] === r.nodes[0])) ? 1 : 0);
        const idx = simplifyIdx(pts, 0.35, keep);
        // drop consecutive near-duplicates (<0.3 m) unless junction
        const ids = [];
        for (const i of idx) { const n = r.nodes[i]; if (ids.length && Math.hypot(pos.get(n)[0] - pos.get(ids[ids.length - 1])[0], pos.get(n)[1] - pos.get(ids[ids.length - 1])[1]) < 0.3 && !(useCount.get(n) > 1)) continue; ids.push(n); }
        if (ids.length < 2) continue;
        r.median = r.oneway ? -(r.lf * r.laneW) : r.median;
        segCount += ids.length - 1;
        r.keptIds = ids;
        { const t = r.tags || {}; const fw = t['turn:lanes:forward'] || (r.oneway ? t['turn:lanes'] : '') || '', bw = r.oneway ? '' : (t['turn:lanes:backward'] || '');
          if (/left|right|through/.test(fw + bw)) turnLanes.push(outRoads.length, S(fw), S(bw)); }
        outRoads.push([S(r.name), ROAD_CLASSES.indexOf(r.cls), r.lf, r.oneway ? 0 : r.lb, Math.round(r.median * 10), Math.round(r.laneW * 10), Math.round(r.sidewalk * 10), r.maxspeed, r.flags, r.layer, ...ids.map(idxOf)]);
    }
    log('graph nodes', outNodes.length / 2, 'segments', segCount);

    // ---- road segment grid in output space (for buffers / clearance / styles)
    const roadGrid = new Grid(50);
    for (const r of roads) {
        if (!r.keptIds) continue;
        const sw = sideW(r);
        for (let i = 0; i < r.keptIds.length - 1; i++) {
            const a = pos.get(r.keptIds[i]), b = pos.get(r.keptIds[i + 1]);
            roadGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { r, a, b, wR: sw[0], wL: sw[1] });
        }
    }
    const nearestRoad = (x, z, rmax, filter) => {
        let best = null, bd = rmax;
        roadGrid.query(x, z, rmax, (s) => { if (filter && !filter(s.r)) return; const q = distPointSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); if (q.d < bd) { bd = q.d; best = { s, d: q.d }; } });
        return best;
    };
    const BUFFER = 250;
    const nearNetwork = (x, z, r = BUFFER) => !!nearestRoad(x, z, r);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < outNodes.length; i += 2) { minX = Math.min(minX, outNodes[i]); maxX = Math.max(maxX, outNodes[i]); minZ = Math.min(minZ, outNodes[i + 1]); maxZ = Math.max(maxZ, outNodes[i + 1]); }

    // output-space projection of a lat/lon ring with local shape scaling around the centroid
    const delta = (pts) => { const out = []; let px = 0, pz = 0; pts.forEach((p, i) => { const x = Math.round(p[0] * 10), z = Math.round(p[1] * 10); if (i === 0) out.push(x, z); else out.push(x - px, z - pz); px = x; pz = z; }); return out; };

    // =======================================================================
    // 2. AREAS (landuse, parks, water, parking …)
    // =======================================================================
    const areaKindOf = (t) => {
        if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.water) return 'water';
        if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'dog_park' || t.leisure === 'playground') return 'park';
        if (t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'golf_course') return t.leisure === 'golf_course' ? 'grass' : 'pitch';
        if (t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'village_green' || t.landuse === 'recreation_ground' || t.natural === 'grassland' || t.landuse === 'flowerbed') return 'grass';
        if (t.landuse === 'forest' || t.natural === 'wood') return 'forest';
        if (t.natural === 'scrub' || t.natural === 'heath') return 'scrub';
        if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
        if (t.amenity === 'parking' && !/underground|multi-storey|rooftop/.test(t.parking || '') && t.building == null) return 'parking';
        if (t.aeroway === 'apron') return 'apron';
        if ((t.aeroway === 'runway' || t.aeroway === 'taxiway') && t.area === 'yes') return 'runway';
        if (['residential', 'industrial', 'commercial', 'retail', 'railway', 'construction'].includes(t.landuse)) return t.landuse;
        return null;
    };
    const areaRings = []; // {kind, name, rings:[outer, ...holes] in output coords}
    const ringPts = (ids) => { const pts = []; for (const n of ids) { const p = pt(n); if (!p) return null; pts.push(p); } return pts; };
    const pushArea = (kind, name, outerIds, holesIds) => {
        const outer = ringPts(outerIds); if (!outer) return;
        const tol = kind === 'water' ? 1.5 : 1.0;
        const so = simplifyRing(outer, tol, tol * 0.6, 2000); if (!so) return;
        const A = Math.abs(polyArea(so));
        if (A < 30) return;
        // keep when near the corridors (parks / water / forest may extend further for scenery)
        const lim = kind === 'water' || kind === 'park' || kind === 'forest' ? 600 : kind === 'apron' || kind === 'runway' ? 400 : 120;
        let near = false;
        for (let i = 0; i < so.length && !near; i += Math.max(1, Math.floor(so.length / 60))) near = M(so[i][0], so[i][1]) <= lim;
        if (!near) { const c = polyCentroid(so); near = M(c[0], c[1]) <= lim; }
        if (!near && A > 2e4) for (const c of cor.circles) if (pointInPolygon(c.x, c.z, so)) { near = true; break; }
        if (!near && A > 2e4) for (const pc of cor.pieces) { for (let i = 0; i < pc.pts.length && !near; i += 15) near = pointInPolygon(pc.pts[i][0], pc.pts[i][1], so); if (near) break; }
        if (!near && !(kind === 'water' && A > 1e5)) return;
        const holes = [];
        for (const h of holesIds || []) { const hp = ringPts(h); if (!hp) continue; const sh = simplifyRing(hp, tol, tol * 0.6, 2000); if (sh && Math.abs(polyArea(sh)) > 20) holes.push(sh); }
        areaRings.push({ kind, name: name || '', rings: [so, ...holes] });
    };
    const relWays = new Set();
    for (const [id, r] of R) {
        const t = r.tags; if (t.type !== 'multipolygon') continue;
        const kind = areaKindOf(t); if (!kind) continue;
        const outers = [], inners = [];
        for (const m of r.members) if (m.type === 'way' && W.has(m.ref)) { (m.role === 'inner' ? inners : outers).push(W.get(m.ref).nodes); relWays.add(m.ref); }
        const o = assembleRings(outers), i2 = assembleRings(inners);
        for (const ring of o.rings) {
            const op = ringPts(ring); if (!op) continue;
            const holes = i2.rings.filter(h => { const hp = pt(h[0]); return hp && pointInPolygon(hp[0], hp[1], op); });
            pushArea(kind, t.name, ring, holes);
        }
        if (o.open.length && kind === 'water') log('  water relation with open rings', id, t.name, o.open.length);
    }
    for (const [id, w] of W) {
        const t = w.tags; if (t.building || t.highway) continue;
        if (w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
        const kind = areaKindOf(t); if (!kind) continue;
        if (relWays.has(id) && Object.keys(t).length <= 1) continue;
        pushArea(kind, t.name, w.nodes, null);
    }
    // coastline (Puget Sound): chain ways (land left, water right) and close them clockwise around a box
    {
        const coast = [...W.values()].filter(w => w.tags.natural === 'coastline').map(w => w.nodes);
        if (coast.length) {
            const { rings, open } = assembleRings(coast.map(c => c.slice()));
            // re-orient chains: assembleRings may have reversed some; coastline direction must be kept —
            // re-chain manually preserving direction instead
            const byStart = new Map(); for (const c of coast) byStart.set(c[0], c);
            const used = new Set(); const chains = [];
            for (const c of coast) {
                if (used.has(c)) continue;
                // walk back to the beginning of this chain
                let head = c; let guard = 0;
                const byEnd = new Map(); for (const d of coast) byEnd.set(d[d.length - 1], d);
                while (byEnd.has(head[0]) && byEnd.get(head[0]) !== c && !used.has(byEnd.get(head[0])) && guard++ < 1000) head = byEnd.get(head[0]);
                let chain = []; let cur = head; guard = 0;
                while (cur && !used.has(cur) && guard++ < 1000) { used.add(cur); chain = chain.length ? chain.concat(cur.slice(1)) : cur.slice(); cur = byStart.get(cur[cur.length - 1]); }
                chains.push(chain);
            }
            void rings; void open;
            for (const ch of chains) {
                const lls = ch.map(n => N.get(n)).filter(Boolean);
                if (lls.length < 2) continue;
                if (ch[0] === ch[ch.length - 1]) continue; // island – ignore
                // water is on the right of the direction of travel. Close the chain by walking a large box clockwise
                // (in lat/lon with north up, clockwise = interior on the right).
                let la0 = Infinity, la1 = -Infinity, lo0 = Infinity, lo1 = -Infinity;
                for (const [la, lo] of lls) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
                const pad = 0.02; la0 -= pad; la1 += pad; lo0 -= pad; lo1 += pad;
                const box = [[la1, lo0], [la1, lo1], [la0, lo1], [la0, lo0]]; // NW, NE, SE, SW (clockwise)
                const param = ([la, lo]) => { // perimeter parameter clockwise from NW corner
                    const W_ = lo1 - lo0, H_ = la1 - la0;
                    const dN = Math.abs(la - la1), dE = Math.abs(lo - lo1), dS = Math.abs(la - la0), dW = Math.abs(lo - lo0);
                    const m = Math.min(dN, dE, dS, dW);
                    if (m === dN) return (lo - lo0);
                    if (m === dE) return W_ + (la1 - la);
                    if (m === dS) return W_ + H_ + (lo1 - lo);
                    return 2 * W_ + H_ + (la - la0);
                };
                const snap = ([la, lo]) => { const dN = Math.abs(la - la1), dE = Math.abs(lo - lo1), dS = Math.abs(la - la0), dW = Math.abs(lo - lo0); const m = Math.min(dN, dE, dS, dW); return m === dN ? [la1, lo] : m === dE ? [la, lo1] : m === dS ? [la0, lo] : [la, lo0]; };
                const end = lls[lls.length - 1], start = lls[0];
                const ring = lls.slice();
                ring.push(snap(end));
                const per = 2 * (lo1 - lo0) + 2 * (la1 - la0);
                let t0 = param(end), t1 = param(start); if (t1 < t0) t1 += per;
                const cornerT = [0, lo1 - lo0, (lo1 - lo0) + (la1 - la0), 2 * (lo1 - lo0) + (la1 - la0)];
                for (let k = 0; k < 8; k++) { const ct = cornerT[k % 4] + (k >= 4 ? per : 0); if (ct > t0 && ct < t1) ring.push(box[k % 4]); }
                ring.push(snap(start));
                const proj = ring.map(([la, lo]) => P(la, lo));
                const so = simplifyRing(proj, 2, 1.0, 3000);
                if (so) areaRings.push({ kind: 'water', name: 'Puget Sound', rings: [so] });
            }
        }
    }
    log('areas', areaRings.length);
    const waterPolys = areaRings.filter(a => a.kind === 'water');
    const landuseGrid = new Grid(200);
    for (const a of areaRings) {
        if (!['residential', 'industrial', 'commercial', 'retail'].includes(a.kind)) continue;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of a.rings[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        landuseGrid.insertBox(x0, z0, x1, z1, a);
    }
    const landuseAt = (x, z) => { let k = null; landuseGrid.query(x, z, 0, (a) => { if (!k && pointInPolygon(x, z, a.rings[0])) k = a.kind; }); return k; };

    // lines: runways, rivers
    const outLines = [];
    for (const w of W.values()) {
        const t = w.tags;
        let kind = null, width = 0;
        if ((t.aeroway === 'runway' || t.aeroway === 'taxiway') && t.area !== 'yes') { kind = t.aeroway; width = num(t.width) || (t.aeroway === 'runway' ? 45 : 20); }
        else if (t.waterway === 'river' || t.waterway === 'canal' || t.waterway === 'stream') { kind = t.waterway; width = num(t.width) || (t.waterway === 'river' ? 30 : t.waterway === 'canal' ? 15 : 3); if (kind === 'stream') continue; }
        if (!kind) continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        const idx = simplifyIdx(pts, 1.0);
        const sp = idx.map(i => pts[i]);
        if (!sp.some(p => M(p[0], p[1]) <= 600)) continue;
        outLines.push([LINE_KINDS.indexOf(kind), Math.round(width * C.scale * 10), S(t.name), delta(sp)]);
    }

    // =======================================================================
    // 3. BUILDINGS
    // =======================================================================
    const centreLL = cityId === 'bucharest' ? [44.4355, 26.1021] : [47.6062, -122.3321];
    const realDist = (la, lo, la2, lo2) => Math.hypot((lo - lo2) * P.mPerLon, (la - la2) * P.mPerLat);
    const roadNameNear = (x, z, d, re) => !!nearestRoad(x, z, d, (r) => re.test(r.name));
    const RE_CIVIC = /Bulevardul Unirii|Bulevardul Libertății|Națiunile Unite|Piața Unirii|Piața Constituției|Bulevardul Decebal|Corneliu Coposu|Bulevardul Burebista|Bulevardul Octavian Goga|Bulevardul Mircea Vodă/;
    const RE_INTERWAR = /Magheru|Nicolae Bălcescu|Ion C\. Brătianu|Lascăr Catargiu|Bulevardul Dacia|Piața Romană|Piața Universității|Bulevardul Hristo Botev/;
    const RE_ECLECTIC = /Calea Victoriei|Regina Elisabeta|Carol I|Mihail Kogălniceanu|Lipscani|Calea Moșilor|Bulevardul Schitu Măgureanu|Strada Academiei|Calea Dorobanților|Bulevardul Lascăr|Calea Griviței/;
    const RE_BIGROAD = /^(trunk|primary|secondary)$/;

    const researchBrands = {};
    // ---- field research (game/research/<city>-<district>.json, spec 20): fill missing height / levels / facade and roof
    //      colours / roof shape on the OSM tags of the researched buildings (OSM tags win where present)
    if (ds) {
        const rf = path.join(REPO, 'game', 'research', `${cityId}-${did}.json`);
        let applied = 0;
        if (fs.existsSync(rf)) {
            let rj = null; try { rj = JSON.parse(fs.readFileSync(rf, 'utf8')); } catch (e) { log('research: cannot parse', rf, e.message); }
            for (const b of rj?.buildings || []) {
                const id = parseInt(String(b.osm).replace(/^[wr]/, ''), 10); const w = W.get(id); if (!w) continue;
                const t = w.tags = { ...w.tags }, ot = b.osmTags || {};
                const set = (k, v) => { if (v == null || v === '' || t[k] != null) return false; t[k] = String(v); return true; };
                let ch = false;
                // `research: {height_m, storeys, facade_hex, roof}` = the hand-researched key buildings (CV stops, landmarks): they beat the estimates
                const rs = (b.research && typeof b.research === 'object') ? b.research : {};
                const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) ? v : null;
                const roofShape = (v) => (typeof v === 'string' && /^(flat|gabled|hipped|pyramidal|dome|skillion|mansard|round|gambrel)$/.test(v)) ? v : null;
                let hr = 0; // 1 = researched height / storeys, 2 = only the research estimate
                if (set('height', rs.height_m ?? b.heightM ?? b.height ?? ot.height)) { ch = true; hr = 1; }
                if (set('building:levels', rs.storeys ?? b.levels ?? b.building_levels ?? ot['building:levels'])) { ch = true; hr = 1; }
                if (t.height == null && t['building:levels'] == null && set('height', b.heightEstM ?? b.height_est_m)) { ch = true; hr = hr || 2; }
                if (t['building:levels'] == null && t.height == null && set('building:levels', b.levelsEst)) { ch = true; hr = hr || 2; }
                if (hr) t.__hRes = hr;
                const fc = hex(rs.facade_hex) || b.facade_hex || b.facade_hex_est || b.building_colour || (b.facade && (b.facade.colour || b.facade.wall || b.facade.glass));
                ch = set('building:colour', fc) || ch;
                ch = set('roof:shape', roofShape(rs.roof) ?? b.roof_shape ?? b.roofShape) || ch;
                ch = set('roof:colour', b.roof_colour ?? b.roofColour) || ch;
                ch = set('min_height', b.min_height) || ch;
                if (ch) applied++;
            }
            log(`research: ${rf} → ${applied} buildings enriched`);
            // shop-sign colours per brand (bg, fg, accent) for the facade signs
            for (const b of rj?.businesses || []) {
                const sg = b.sign || {}; const key = (b.brand || b.brand_key || '').toLowerCase().trim();
                if (!key || !/^#[0-9a-f]{6}$/i.test(sg.bg || '') || !/^#[0-9a-f]{6}$/i.test(sg.fg || '')) continue;
                researchBrands[key] = [sg.bg, sg.fg, /^#[0-9a-f]{6}$/i.test(sg.accent || '') ? sg.accent : sg.fg];
            }
        }
    }
    const buildings = [];
    const bGrid = new Grid(60);
    const rawBuildings = [];
    const addRaw = (ids, t, isRel) => {
        const lls = []; for (const n of ids) { const ll = N.get(n); if (!ll) return; lls.push(ll); }
        rawBuildings.push({ lls, t, isRel });
    };
    const bRelWays = new Set();
    for (const [, r] of R) {
        const t = r.tags; if (t.type !== 'multipolygon' || !t.building) continue;
        const outers = r.members.filter(m => m.type === 'way' && m.role !== 'inner' && W.has(m.ref)).map(m => { bRelWays.add(m.ref); return W.get(m.ref).nodes; });
        for (const ring of assembleRings(outers).rings) addRaw(ring, t, true);
    }
    for (const [id, w] of W) {
        const t = w.tags;
        // district mode: tall building:parts (towers rising out of a podium, e.g. Lincoln Square North) are kept as buildings
        const tallPart = ds && t['building:part'] && t['building:part'] !== 'no' && (num(t.height) >= 20 || num(t['building:levels']) >= 6);
        if (tallPart && !t.building) t.building = 'yes';
        if (!t.building || t.building === 'no' || (t['building:part'] && !tallPart)) continue;
        if (w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
        if (bRelWays.has(id) && !t.name && Object.keys(t).length <= 1) continue;
        addRaw(w.nodes, t, false);
    }
    log('raw buildings', rawBuildings.length);

    // low-poly backdrop of the building masses beyond the corridors (40 m cells → one box each)
    const bdCells = new Map();
    const addBackdrop = (c, realArea, local, t, la) => {
        if (realArea < 40 || /^(garage|garages|shed|hut|kiosk|roof|carport|container|toilets)$/.test(t.building)) return;
        let h = num(t.height); const lv = num(t['building:levels']);
        if (!isFinite(h)) h = isFinite(lv) ? lv * 3.1 : realArea > 1500 ? 18 : realArea > 400 ? 12 : 7;
        h = C.heightMap(Math.min(h, 250));
        const [sx, sz] = C.shape(la); const a = realArea * sx * sz;
        const k = Math.floor(c[0] / 40) + ',' + Math.floor(c[1] / 40);
        let o = bdCells.get(k); if (!o) bdCells.set(k, o = { a: 0, x: 0, z: 0, h: 0, big: 0, ang: 0, hmax: 0 });
        o.a += a; o.x += c[0] * a; o.z += c[1] * a; o.h += h * a; o.hmax = Math.max(o.hmax, h);
        if (a > o.big) { o.big = a; let bl = 0; for (let i = 0; i < local.length - 1; i++) { const L = Math.hypot(local[i + 1][0] - local[i][0], local[i + 1][1] - local[i][1]); if (L > bl) { bl = L; o.ang = Math.atan2(local[i + 1][1] - local[i][1], local[i + 1][0] - local[i][0]); } } }
    };
    const HOUSE = /^(house|detached|semidetached_house|terrace|bungalow|villa|cabin|farm|static_caravan)$/;
    const SMALL = /^(garage|garages|shed|hut|kiosk|roof|carport|container|toilets|gatehouse|guardhouse|booth|bunker|ruins|tent)$/;
    const INDUSTRIAL = /^(industrial|warehouse|hangar|factory|manufacture|service|transformer_tower|storage_tank|silo|power|greenhouse|barn|farm_auxiliary|parking)$/;
    const RELIGIOUS = /^(church|cathedral|chapel|religious|mosque|synagogue|temple|monastery|basilica)$/;
    const PUBLIC = /^(school|university|college|kindergarten|hospital|public|civic|government|train_station|transportation|sports_hall|stadium|museum|fire_station|police)$/;

    for (const rb of rawBuildings) {
        const { lls, t } = rb;
        const b = t.building;
        // centroid in lat/lon, then local real-metre offsets
        let la = 0, lo = 0; for (const [a, c] of lls) { la += a; lo += c; } la /= lls.length; lo /= lls.length;
        const local = lls.map(([a, c]) => [(c - lo) * P.mPerLon, -(a - la) * P.mPerLat]);
        const realArea = Math.abs(polyArea(local));
        if (realArea < 12) continue;
        const cL = polyCentroid(local);
        const cOut = P(la, lo); cOut[0] += cL[0] * C.scale; cOut[1] += cL[1] * C.scale; // approx centroid in output space
        const mg = M(cOut[0], cOut[1]);
        if (mg > 0) { if (mg > 70 && mg < 1700) addBackdrop(cOut, realArea, local, t, la); continue; }
        if (!nearNetwork(cOut[0], cOut[1])) continue;
        const [sx, sz] = C.shape(la);
        let ring = local.map(([x, z]) => [cOut[0] + (x - cL[0]) * sx, cOut[1] + (z - cL[1]) * sz]);
        ring = simplifyRing(ring, 1.0, 0.25, 40);
        if (!ring) continue;
        // ---- style & height
        const levels = num(t['building:levels']);
        const roofLevels = num(t['roof:levels']) || 0;
        let h = num(t.height); if (!isFinite(h)) h = NaN;
        const minH = num(t.min_height) || (num(t['building:min_level']) ? num(t['building:min_level']) * 3.2 : 0);
        const dCentre = realDist(la, lo, centreLL[0], centreLL[1]);
        const nearBig = !!nearestRoad(cOut[0], cOut[1], Math.sqrt(realArea) * 0.7 * sx + 16, (r) => RE_BIGROAD.test(r.cls));
        const lu = landuseAt(cOut[0], cOut[1]);
        let style = 'plain', defLevels = 2, roof = 0, flags = 0;
        const amen = t.amenity || '', shop = t.shop || '';
        const isOffice = b === 'office' || b === 'commercial' || !!t.office;
        if (RELIGIOUS.test(b) || amen === 'place_of_worship') { style = 'church'; defLevels = 0; if (!isFinite(h)) h = realArea < 300 ? 11 : 16; roof = realArea < 900 ? 1 : 3; }
        else if (SMALL.test(b)) { style = 'plain'; if (!isFinite(h)) h = b === 'roof' || b === 'carport' ? 4 : 3; }
        else if (INDUSTRIAL.test(b)) { style = 'plain'; if (!isFinite(h)) h = b === 'greenhouse' ? 4 : realArea > 2000 ? 10 : 7; }
        else if (b === 'retail' || b === 'supermarket' || shop === 'supermarket' || shop === 'mall' || b === 'kiosk') { style = 'shop'; defLevels = realArea > 3000 ? 2 : 1; flags |= 1; }
        else if (HOUSE.test(b)) { style = 'house'; defLevels = country === 'US' ? 2 : 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
        else if (PUBLIC.test(b)) {
            style = dCentre < 2200 && country === 'RO' ? 'eclectic' : country === 'US' ? 'interwar' : 'bloc';
            defLevels = { school: 3, kindergarten: 2, university: 5, college: 4, hospital: 6, train_station: 3, stadium: 4, sports_hall: 3 }[b] || 4;
        }
        else if (country === 'RO') {
            const pipera = la > 44.4745 && lo > 26.095;
            if (isOffice && (pipera || (isFinite(levels) && levels >= 6) || realArea > 1500)) { style = 'glass'; defLevels = pipera ? 10 : 8; }
            else if (pipera && (realArea > 900 || (isFinite(levels) && levels >= 7))) { style = 'glass'; defLevels = 10; }
            else if (realArea > 250 && roadNameNear(cOut[0], cOut[1], 75, RE_CIVIC)) { style = 'civic'; defLevels = 9; }
            else if (roadNameNear(cOut[0], cOut[1], 55, RE_INTERWAR)) { style = 'interwar'; defLevels = 8; }
            else if (roadNameNear(cOut[0], cOut[1], 45, RE_ECLECTIC) || (la > 44.4290 && la < 44.4345 && lo > 26.0960 && lo < 26.1060)) { style = 'eclectic'; defLevels = 5; }
            else if (dCentre < 1900) {
                if (isFinite(levels) && levels >= 7) { style = 'interwar'; defLevels = 8; }
                else if (realArea < 110 && !(isFinite(levels) && levels > 2)) { style = 'house'; defLevels = 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
                else { style = 'eclectic'; defLevels = 4; }
            } else {
                const villaZone = la > 44.455 && la < 44.478 && lo > 26.072 && lo < 26.102;
                if (b === 'apartments' || (isFinite(levels) && levels >= 5) || realArea > 520) { style = 'bloc'; defLevels = realArea > 520 || b === 'apartments' ? (realArea > 900 ? 10 : 8) : 5; }
                else if (realArea < 170 || (villaZone && realArea < 420)) { style = 'house'; defLevels = 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
                else if (lu === 'industrial') { style = 'plain'; defLevels = 2; }
                else { style = 'bloc'; defLevels = 4; }
            }
        } else { // US
            const dtSea = la > 47.596 && la < 47.626 && lo > -122.347 && lo < -122.318;
            const dtBel = la > 47.606 && la < 47.624 && lo > -122.207 && lo < -122.185;
            if ((dtSea || dtBel) && (realArea > 400 || isOffice || (isFinite(levels) && levels >= 6))) { style = 'glass'; defLevels = dtSea ? (realArea > 1500 ? 22 : 12) : (realArea > 1500 ? 16 : 8); }
            else if (isOffice) { style = (isFinite(levels) && levels >= 5) ? 'glass' : 'interwar'; defLevels = 3; }
            else if (b === 'apartments' || b === 'dormitory') { style = 'bloc'; defLevels = 4; }
            else if (b === 'hotel') { style = 'glass'; defLevels = 8; }
            else if (lu === 'industrial' || (realArea > 2500 && b === 'yes')) { style = 'plain'; if (!isFinite(h)) h = 9; }
            else if (lu === 'commercial' || lu === 'retail') { style = 'shop'; defLevels = 1; flags |= 1; }
            else if (realArea < 320) { style = 'house'; defLevels = realArea < 90 ? 1 : 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
            else { style = 'bloc'; defLevels = 3; }
        }
        if (b === 'hotel' && country === 'RO' && style !== 'glass') defLevels = Math.max(defLevels, 7);
        if (t['roof:shape']) {
            const rs = t['roof:shape'];
            if (/mansard|gambrel/.test(rs)) roof = 6;
            else if (/hipped|half-hipped/.test(rs) && realArea < 2500) roof = lls.length <= 6 ? 4 : 1;
            else if (/gabled|saltbox/.test(rs) && realArea < 1500) roof = lls.length <= 6 ? 2 : 1;
            else if (/skillion|lean_to/.test(rs) && realArea < 1500) roof = 5;
            else if (/pyramidal|cone/.test(rs)) roof = 1;
            else if (/dome|onion/.test(rs)) roof = 3;
            else if (rs === 'flat') roof = 0;
        }
        if (/glass/.test(t['building:material'] || '') && !['church', 'house'].includes(style)) style = 'glass';
        // shop band on ground floors along big roads (Romanian blocs & centre always have shops)
        if (['interwar', 'eclectic', 'civic', 'bloc'].includes(style) && (nearBig || shop || amen)) flags |= 1;
        if (!isFinite(h)) {
            const lv = isFinite(levels) ? levels : defLevels;
            h = lv * (style === 'bloc' ? 2.9 : style === 'glass' ? 3.6 : 3.2) + ((flags & 1) ? 1 : 0) + roofLevels * 2.6;
        }
        h = Math.max(2.5, Math.min(h, 320));
        h = C.heightMap(h);
        // ---- shrink to keep clear of the road ribbons
        const clearOK = (rg) => {
            for (let i = 0; i < rg.length; i++) {
                const a = rg[i], bb = rg[(i + 1) % rg.length];
                for (const p of [a, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2]]) {
                    let bad = false;
                    roadGrid.query(p[0], p[1], 20, (s) => {
                        if (bad || (s.r.flags & 4) || s.r.layer < 0) return;
                        const q = distPointSeg(p[0], p[1], s.a[0], s.a[1], s.b[0], s.b[1]);
                        if (q.d > 20) return;
                        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
                        const right = (p[0] - s.a[0]) * (-dz) + (p[1] - s.a[1]) * dx > 0;
                        const need = (right ? s.wR : s.wL) + Math.min(s.r.sidewalk, 1.6);
                        if (q.d < need) bad = true;
                    });
                    if (bad) return false;
                }
            }
            return true;
        };
        let ok = clearOK(ring), tries = 0;
        const c2 = polyCentroid(ring);
        while (!ok && tries < 7) { ring = ring.map(([x, z]) => [c2[0] + (x - c2[0]) * 0.9, c2[1] + (z - c2[1]) * 0.9]); ok = clearOK(ring); tries++; }
        if (!ok) continue;
        if (Math.abs(polyArea(ring)) < 8) continue;
        // ---- overlap test against already accepted buildings (only needed where shapes were rescaled)
        if (sx !== C.scale || sz !== C.scale || tries > 0) {
            let overlap = false;
            bGrid.query(c2[0], c2[1], 40, (o) => {
                if (overlap) return;
                if (ring.some(p => pointInPolygon(p[0], p[1], o.ring)) || o.ring.some(p => pointInPolygon(p[0], p[1], ring)) || pointInPolygon(c2[0], c2[1], o.ring)) overlap = true;
            });
            if (overlap) continue;
        }
        let name = t.name || '';
        let brand = t.brand || '';
        if (t.tourism || t.historic || (h > 60)) flags |= 4;
        const colour = normColour(t['building:colour'] || t['building:color']) || MATERIAL_COLOUR[(t['building:material'] || '').split(';')[0]] || '';
        const roofColour = normColour(t['roof:colour'] || t['roof:color']) || (/tile|clay/.test(t['roof:material'] || '') ? '#9c5a3c' : /metal|tin|copper/.test(t['roof:material'] || '') ? (t['roof:material'] === 'copper' ? '#6f9a86' : '#7d848a') : '');
        const rec = { style, h, minH: Math.min(minH, h - 1), roof, name, brand, flags, ring, c: c2, area: Math.abs(polyArea(ring)), t, levels: isFinite(levels) ? Math.round(levels) : 0, colour, roofColour, la, lo,
            hSrc: t.__hRes === 1 ? 1 : t.__hRes === 2 ? 2 : (isFinite(num(t.height)) || isFinite(levels)) ? 0 : 2 };
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        bGrid.insertBox(x0, z0, x1, z1, rec);
        buildings.push(rec);
    }
    // ---- dev check: no building may sit on a road ribbon (roads would run into a block)
    {
        let hits = 0; const drop = new Set();
        for (const r of roads) {
            if (!r.keptIds || (r.flags & 4) || r.layer < 0) continue;
            const [wr, wl] = sideW(r);
            for (let i = 0; i < r.keptIds.length - 1; i++) {
                const a = pos.get(r.keptIds[i]), b = pos.get(r.keptIds[i + 1]);
                const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue;
                const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
                for (let s2 = 0; s2 <= L; s2 += 2) {
                    for (const o of [0, wr * 0.8, -wl * 0.8]) {
                        const x = a[0] + (b[0] - a[0]) * s2 / L + nx * o, z = a[1] + (b[1] - a[1]) * s2 / L + nz * o;
                        bGrid.query(x, z, 0, (bb) => { if (!drop.has(bb) && pointInPolygon(x, z, bb.ring)) { drop.add(bb); hits++; } });
                    }
                }
            }
        }
        for (let i = buildings.length - 1; i >= 0; i--) if (drop.has(buildings[i])) buildings.splice(i, 1);
        log(`dev-check: ${hits} buildings overlapping road ribbons removed`);
    }
    log('buildings kept', buildings.length);

    // =======================================================================
    // 4. POIs
    // =======================================================================
    const poiKind = (t) => {
        const a = t.amenity, s = t.shop, tr = t.tourism;
        if (a === 'fuel') return ['fuel', a];
        if (a === 'fast_food' || a === 'cafe' || a === 'restaurant' || a === 'food_court' || a === 'ice_cream') return ['food', a];
        if (a === 'bank' || a === 'atm' || a === 'bureau_de_change') return ['bank', a];
        if (a === 'pharmacy' || s === 'chemist' && false) return ['pharmacy', a];
        if (a === 'hospital' || a === 'clinic') return ['hospital', a];
        if (a === 'university' || a === 'school' || a === 'college') return ['school', a];
        if (a === 'cinema' || a === 'theatre' || a === 'place_of_worship' || a === 'police' || a === 'fire_station' || a === 'townhall' || a === 'arts_centre' || a === 'library') return ['landmark', a];
        if (a === 'bus_station') return ['busstop', a];
        if (['supermarket', 'mall', 'convenience', 'department_store', 'car', 'bakery', 'electronics', 'clothes', 'doityourself', 'hardware', 'furniture'].includes(s)) return ['shop', s];
        if (tr === 'hotel' || tr === 'hostel' || tr === 'motel') return ['hotel', tr];
        if (tr === 'attraction' || tr === 'museum' || tr === 'viewpoint' || tr === 'artwork' && t.name || t.historic === 'monument' || t.historic === 'memorial' && t.name) return ['landmark', tr || t.historic];
        if (t.railway === 'subway_entrance' || t.station === 'subway' || (t.railway === 'station' && (t.subway === 'yes' || t.station === 'subway' || t.station === 'light_rail'))) return ['metro', t.railway || 'station'];
        if (t.railway === 'station' || (t.public_transport === 'station' && !t.bus)) return ['landmark', 'station'];
        if (t.highway === 'bus_stop' || (t.public_transport === 'platform' && t.bus === 'yes')) return ['busstop', 'bus_stop'];
        if (t.railway === 'tram_stop' || (t.public_transport === 'platform' && t.tram === 'yes')) return ['busstop', 'tram_stop'];
        if (t.leisure === 'park' && t.name) return ['park', 'park'];
        if (t.leisure === 'stadium') return ['landmark', 'stadium'];
        if (t.aeroway === 'terminal' || t.aeroway === 'aerodrome') return ['airport', t.aeroway];
        if (t.office && t.name && ['company', 'it', 'telecommunication', 'government', 'diplomatic', 'financial', 'insurance'].includes(t.office)) return ['office', t.office];
        return null;
    };
    const pois = [];
    const poiSeen = new Set();
    const addPoi = (t, x, z, bIdx = -1) => {
        const k = poiKind(t); if (!k) return;
        const name = t.name || t.brand || '';
        if (k[0] !== 'busstop' && k[0] !== 'metro' && !name) return;
        if (M(x, z) > (k[0] === 'landmark' || k[0] === 'airport' || k[0] === 'park' ? 100 : 0)) return;
        if (!nearNetwork(x, z, k[0] === 'landmark' || k[0] === 'airport' || k[0] === 'park' ? 700 : BUFFER)) return;
        const key = k[0] + '|' + name + '|' + Math.round(x / 15) + '|' + Math.round(z / 15);
        if (poiSeen.has(key)) return; poiSeen.add(key);
        if (bIdx < 0) bGrid.query(x, z, 1, (o) => { if (bIdx < 0 && pointInPolygon(x, z, o.ring)) bIdx = buildings.indexOf(o); });
        pois.push({ kind: k[0], sub: k[1], x, z, name: t.name || '', brand: t.brand || '', op: t.operator || '', cuisine: t.cuisine || '', bIdx });
    };
    for (const [id, t] of ntags) { const p = pt(id); if (p) addPoi(t, p[0], p[1]); }
    for (const w of W.values()) {
        const t = w.tags; if (!poiKind(t)) continue;
        if (w.nodes.length < 3) continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        const c = polyCentroid(pts);
        addPoi(t, c[0], c[1]);
    }
    // businesses/names attached to buildings → facade signs
    for (const p of pois) {
        if (p.bIdx < 0) continue;
        const b = buildings[p.bIdx];
        if (['busstop', 'metro'].includes(p.kind)) continue;
        if (!b.signName) { b.signName = p.brand || p.name; b.signBrand = !!p.brand; }
    }
    log('pois', pois.length);

    // ---- trees (natural=tree nodes + tree_row ways) and street furniture, inside the corridors, off the carriageway
    const onCarriageway = (x, z, extra) => !!nearestRoad(x, z, 25, null) && (() => { let bad = false; roadGrid.query(x, z, 20, (s) => { if (bad || (s.r.flags & 4)) return; const q = distPointSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1]; const right = (x - s.a[0]) * (-dz) + (z - s.a[1]) * dx > 0; if (q.d < (right ? s.wR : s.wL) + extra) bad = true; }); return bad; })();
    const CONIFER = /^(Pinus|Picea|Abies|Thuja|Pseudotsuga|Cedrus|Taxus|Juniperus|Tsuga|Larix|Sequoia|Chamaecyparis|Cupressus)/i;
    const outTrees = [], outTreeInfo = []; const treeSeen = new Set();
    const circCm = (v) => { if (v == null) return 0; const n = num(v); if (!isFinite(n) || n <= 0) return 0; const cm = /cm/.test(v) ? n : n < 20 ? n * 100 : n; return Math.min(2000, Math.round(cm)); };
    const addTree = (x, z, t, row = false) => {
        if (M(x, z) > 0 || onCarriageway(x, z, 0.9)) return;
        const key = Math.round(x / 1.5) + ',' + Math.round(z / 1.5); if (treeSeen.has(key)) return; treeSeen.add(key);
        const con = t.leaf_type === 'needleleaved' || CONIFER.test(t.genus || t['species'] || '') ? 1 : 0;
        let h = num(t.height); if (!isFinite(h) || h > 45) h = 0;
        outTrees.push(Math.round(x * 10), Math.round(z * 10), Math.round(h * 10) * 2 + con);
        // species text for world.js / trees.js speciesFromOSM (spec 12 request): most specific first
        const taxon = t.species || t.taxon || t['species:en'] || t['taxon:en'] || t.genus || t['genus:en'] || '';
        const lt = t.leaf_type === 'broadleaved' ? 1 : (t.leaf_type === 'needleleaved' || con) ? 2 : 0;
        const lc = t.leaf_cycle === 'deciduous' ? 4 : t.leaf_cycle === 'evergreen' ? 8 : 0;
        outTreeInfo.push(S(taxon.trim()), circCm(t.circumference), lt + lc + (row ? 16 : 0));
    };
    for (const [id, t] of ntags) if (t.natural === 'tree') { const p = pt(id); if (p) addTree(p[0], p[1], t); }
    for (const w of W.values()) {
        if (w.tags.natural !== 'tree_row') continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 7) addTree(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, w.tags, true); }
    }
    const outFurn = [];
    for (const [id, t] of ntags) {
        let k = null;
        if (['bench', 'waste_basket', 'post_box', 'bicycle_parking', 'drinking_water', 'fountain', 'recycling', 'telephone', 'vending_machine'].includes(t.amenity)) k = t.amenity;
        else if (t.barrier === 'bollard') k = 'bollard';
        else if (t.emergency === 'fire_hydrant') k = 'fire_hydrant';
        else if (t.leisure === 'picnic_table') k = 'picnic_table';
        else if (t.advertising === 'column' || t.advertising === 'billboard') k = 'advertising';
        if (!k) continue;
        const p = pt(id); if (!p || M(p[0], p[1]) > 0) continue;
        if (k !== 'bollard' && onCarriageway(p[0], p[1], 0.6)) continue;
        if (k === 'bollard' && onCarriageway(p[0], p[1], 0.3)) continue; // bollards on the road (access barriers) would block it
        if (k === 'fountain' && t.amenity === 'fountain' && !nearNetwork(p[0], p[1], 60)) continue;
        outFurn.push(FURN_KINDS.indexOf(k), Math.round(p[0] * 10), Math.round(p[1] * 10));
    }
    log('osm trees', outTrees.length / 3, 'furniture', outFurn.length / 3);

    // street lamps (highway=street_lamp nodes near the network)
    const lamps = [];
    for (const [id, t] of ntags) {
        if (t.highway !== 'street_lamp') continue;
        const p = pt(id); if (!p || M(p[0], p[1]) > 0 || !nearNetwork(p[0], p[1], 60)) continue;
        const hgt = num(t.height);
        lamps.push(Math.round(p[0] * 10), Math.round(p[1] * 10), isFinite(hgt) ? Math.round(Math.min(hgt, 20) * 10) : 0);
    }
    log('street lamps', lamps.length / 3);

    // places
    const places = [];
    const rank = { city: 0, town: 0, suburb: 1, quarter: 2, neighbourhood: 3 };
    for (const [id, t] of ntags) {
        if (!(t.place in rank) || !t.name) continue;
        const p = pt(id); if (!p) continue;
        if (M(p[0], p[1]) > 400) continue;
        places.push([S(t.name), Math.round(p[0] * 10), Math.round(p[1] * 10), rank[t.place]]);
    }

    // =======================================================================
    // OUTPUT
    // =======================================================================
    const finalName = (b) => b.signName ? b.signName : b.brand ? b.brand : (b.name || '');
    // ---- height sanity (district mode; mirrors world.js' runtime pass, spec 12 request 2026-11-07): untagged large
    //      footprints outside the old centre got 8–10 storeys (23–30 m). Re-estimate them from name and shape: real slab
    //      blocks (≤ 22 m wide, ≥ 30 m long) and "Bl. …" names keep their storeys, named institutions 2–4 storeys,
    //      compact / wide footprints 4–5, the Kiseleff / Primăverii / Dorobanți villa zone ≤ 4. Research / OSM tags win.
    let heightFixes = 0;
    if (ds) {
        const DEF = new Set([11.6, 12.6, 14.5, 15.5, 23.2, 24.2, 29, 30]);
        const INST = /muze|museum|biseric|church|catedral|institut|[șs]coal|liceu|gr[ăa]dini|teatr|atene|bibliotec|universit|facult|spital|palat|casa |vila|villa|ambasada\b|embassy|primări|primari|tribunal|ministe/i;
        const minWidth = (ring) => {
            let best = Infinity, len = 0;
            for (let k = 0; k < ring.length; k++) {
                const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
                for (const [x, z] of ring) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
                if (c1 - c0 < best) { best = c1 - c0; len = a1 - a0; }
            }
            return { w: best, l: len };
        };
        const US = country === 'US';
        const villa = (b) => !US && b.la > 44.447 && b.la < 44.48 && b.lo > 26.07 && b.lo < 26.103;
        for (const b of buildings) {
            const name = finalName(b);
            if (b.levels > 0 || b.style === 'church' || b.style === 'glass' || b.minH > 0 || /^(bl(oc)?\.?\s|bloc\b|block\b)/i.test(name)) continue;
            const named = INST.test(name);
            const isDef = DEF.has(Math.round(b.h * 10) / 10);
            if (!isDef && !(named && b.h > 18)) continue;
            // a real (OSM / researched) height: keep it and give it storeys so world.js' runtime pass leaves it alone
            if (b.hSrc === 0 || b.hSrc === 1) { b.levels = Math.max(1, Math.round((b.h - 1) / 3.3)); continue; }
            const { w, l } = minWidth(b.ring);
            const vz = villa(b);
            const slab = w <= 22 && l >= 30 && !named && !vz;
            if (slab || (!named && b.h < 16)) continue;
            const lv = named ? (b.area > 3000 ? 4 : b.area > 800 ? 3 : 2) : vz ? (b.area > 1500 ? 4 : 3) : (w > 22 ? 5 : 4);
            const h2 = Math.round((lv * (named ? 4.6 : 3.3) + 1.2) * 10) / 10;
            if (h2 >= b.h - 0.5) continue;
            b.h = h2; b.levels = lv; b.hSrc = 3; heightFixes++;
            if ((named || vz) && b.style === 'bloc') b.style = US ? 'interwar' : 'eclectic';
        }
        log('height sanity:', heightFixes, 'untagged footprints re-estimated');
    }
    // building type / era hints for the facade styles (parallel to `buildings`): [type, startYear, architect, material, hSrc]
    const yearOf = (v) => { const m = String(v || '').match(/(1[5-9]\d\d|20[0-4]\d)/); return m ? +m[1] : 0; };
    const outBInfo = [];
    for (const b of buildings) {
        const t = b.t || {};
        outBInfo.push(S(t.building && t.building !== 'yes' ? t.building : ''), yearOf(t.start_date || t['building:start_date'] || t.construction_date), S(t.architect || ''), S((t['building:material'] || t['building:facade:material'] || '').split(';')[0]), b.hSrc ?? 0);
    }
    const outB = buildings.map(b => {
        let flags = b.flags;
        let name = b.name;
        if (b.signName) { name = b.signName; flags |= 2; if (b.signBrand) flags |= 8; }
        else if (b.brand) { name = b.brand; flags |= 2 | 8; }
        else if (name) flags |= 2;
        return [STYLES.indexOf(b.style), Math.round(b.h * 10), Math.round(Math.max(0, b.minH) * 10), b.roof, S(name), flags, b.levels || 0, S(b.colour), S(b.roofColour), ...delta(b.ring)];
    });
    const backdrop = [];
    for (const o of bdCells.values()) {
        if (o.a < 220) continue;
        const h = o.h / o.a; if (h < 5) continue;
        const side = Math.min(36, Math.sqrt(o.a) * 1.05);
        backdrop.push(Math.round(o.x / o.a * 10), Math.round(o.z / o.a * 10), Math.round(side * 1.12 * 10), Math.round(side * 0.88 * 10), Math.round(Math.min(o.hmax, h * 1.25) * 10), Math.round(((o.ang * 180 / Math.PI) % 180 + 180) % 180));
    }
    log('backdrop boxes', backdrop.length / 6);
    const outP = pois.map(p => [POI_KINDS.indexOf(p.kind), Math.round(p.x * 10), Math.round(p.z * 10), S(p.name), S(p.brand), S(p.sub + (p.cuisine ? ':' + p.cuisine : '')), p.bIdx]);
    const outA = areaRings.map(a => [AREA_KINDS.indexOf(a.kind), S(a.name), ...a.rings.map(delta)]);
    const outT = [];
    for (const pl of tramLines) { // clip to the corridors
        let run = [];
        const flush = () => { if (run.length >= 2) outT.push(delta(run)); run = []; };
        for (const p of pl) { if (M(p[0], p[1]) <= 30 && nearNetwork(p[0], p[1], 40)) run.push(p); else flush(); }
        flush();
    }
    const doc = {
        version: 2, city: cityId, generated: new Date().toISOString().slice(0, 10),
        attribution: '© OpenStreetMap contributors (ODbL)',
        proj: P.params, q: 10,
        bounds: [minX, minZ, maxX, maxZ],
        classes: ROAD_CLASSES, styles: STYLES, roofs: ROOFS, poiKinds: POI_KINDS, areaKinds: AREA_KINDS, lineKinds: LINE_KINDS, furnKinds: FURN_KINDS,
        strings,
        nodes: outNodes, nodeFlags, roads: outRoads, trams: outT, buildings: outB, buildingInfo: outBInfo, pois: outP, areas: outA, lines: outLines, places, lamps,
        trees: outTrees, treeInfo: outTreeInfo, furniture: outFurn, backdrop,
        corridor: { areaKm2: +cor.areaKm2.toFixed(2), legs: cor.legs.map(l => [l.label, l.km]) },
    };
    if (Object.keys(researchBrands).length) doc.brands = researchBrands;
    if (turnLanes.length) doc.turnLanes = turnLanes;
    if (ds) { // district boundary (game metres): the polygons and the corridor field are the same margin() → sample its outline
        doc.district = { id: did, name: ds.district.name, bbox: ds.district.bbox, areaKm2: +cor.areaKm2.toFixed(2),
            polys: cor.polys.map(pl => pl.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])),
            ends: [...cutIds.values()].filter(id => keptIndex.has(id)).map(id => keptIndex.get(id)) };
        // where the player may drive: cells within 25 m of the cut (road ends get their barrier first), RLE rows
        const cell = 20, gx0 = Math.floor((minX / 10 - 150) / cell) * cell, gz0 = Math.floor((minZ / 10 - 150) / cell) * cell;
        const w = Math.ceil((maxX / 10 + 150 - gx0) / cell), h = Math.ceil((maxZ / 10 + 150 - gz0) / cell);
        const rle = []; let cur = 0, run = 0;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const v = M(gx0 + (i + 0.5) * cell, gz0 + (j + 0.5) * cell) <= 25 ? 1 : 0;
            if (v === cur) run++; else { rle.push(run); cur = v; run = 1; }
        }
        rle.push(run);
        doc.district.mask = { x0: gx0, z0: gz0, cell, w, h, rle };
    }
    const outDir = path.join(REPO, 'game', 'data');
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, did ? `${cityId}-${did}.json` : `${cityId}.json`);
    const json = JSON.stringify(doc);
    fs.writeFileSync(file, json);
    log(`wrote ${file}  ${(json.length / 1e6).toFixed(2)} MB  roads=${outRoads.length} segments=${segCount} buildings=${outB.length} pois=${outP.length} areas=${outA.length} lamps=${lamps.length / 3} trees=${outTrees.length / 3} furniture=${outFurn.length / 3} backdrop=${backdrop.length / 6}`);
}

function ROOF_FOR_HOUSE(area, nverts) { return nverts <= 6 && area < 400 ? 2 : area < 300 ? 1 : 0; }

// node build-data.mjs --tiles DIR [--city bucharest|seattle]               the old corridor maps (game/data/<city>.json)
// node build-data.mjs --tiles DIR --districts [--city c] [--district id]    the 1:1 chapter districts (game/data/<city>-<id>.json)
const which = args.city ? [args.city] : Object.keys(CITIES);
if (args.districts || args.district) {
    for (const c of which) for (const d of Object.keys(GAME_CITIES[c].districts || {})) if (!args.district || args.district === true || args.district.split(',').includes(d)) buildCity(c, d);
} else for (const c of which) buildCity(c);
