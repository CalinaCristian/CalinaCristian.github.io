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
//               128 tram_stop, 256 speed_camera, 512 mini_roundabout, 1024 red-light camera
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
//    buildingHoles: { buildingIndex: [deltaRing, ...] } optional mapped courtyards; same dm coordinates, no header
//    buildingCoveredBy: { baseIndex: coveringPartIndex } exact full-footprint, full-height ground part; both records kept
//    buildingAssemblies: { outlineIndex: {parts:[indices], residualHeightDm, residualHeightSource, sourceCoverage, sourceOutsideArea, preparedCoverage} }
//        conservative unique raw-source part associations; residual strips retain a source-derived ground envelope
//    buildingDimensions: {index:[heightM,minHeightM]} sparse source precision beyond decimetres
//    buildingFootprints: {index:[[x,z],...]} sparse precise simple rings when dm quantization folds a notch
//    buildingUnions: {sources:[{i,signature}],surfaces:[{i,neighbours,surface}]} physical surface visibility, not parent association
//    buildingGeometryPoints: [[x,z],...] lossless vertex table for cached residual/roof/underside rings
//        (version 2) levels = building:levels (0 unknown), colour / roofColour = string index of '#rrggbb' (-1 none)
//        style index into `styles`, roof index into `roofs` (flat|pyramid|gabled|dome|hipped|skillion|mansard),
//        flags: 1 ground-floor shop band, 2 has a sign (name = sign text), 4 tall landmark-ish,
//               8 brand sign (name is a brand)
//    pois: [[kind, x, z, name, brand, sub, buildingIndex], ...]   sub = raw OSM value (e.g. fast_food)
//    areas: [[kind, name, outerDelta, holeDelta, ...], ...]
//    lines: [[kind, widthDm, name, delta], ...]     runways / taxiways / rivers drawn as ribbons
//    places: [[name, x, z, rank], ...]               rank 0 city, 1 suburb, 2 quarter, 3 neighbourhood
//    lamps: [x, z, heightDm, ...]                    highway=street_lamp nodes (height 0 = unknown)
//    roadInfo: [osmLayer, flags, widthDm, maxheightDm, placement, bridgeStructure, ...]   6 per road (same order as `roads`; flags 64/128 kerbside parking right/left, 256/512 none):
//                                                    the raw OSM layer (roads[] keeps the bridge/tunnel-adjusted one), flags 1 covered,
//                                                    2 tunnel=building_passage, 4 bridge, 8 has `level`, 16 *_link ramp, 32 layer tagged;
//                                                    OSM width / maxheight (clearance under a deck) in dm (0 unknown); placement and
//                                                    bridge:structure|bridge:name as string indices
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
import { footprintCoverage, simpleFootprint, uncrossFootprint, bakeAssembly, bakeSurface, touchingSolids, assemblySignature } from '../../game/src/building-parts.js';
import { sourceRing } from './source-footprints.mjs';
import { sourcePartHeightReview } from './source-height-review.mjs';
import { parseMeasure, makeRoofProfile, roofMesh, visibleRoofMesh, roofSignature } from '../../game/src/building-roofs.js';
import { ShapeUtils, Vector2 } from '../../game/vendor/three.module.min.js';
import { resolveRoadAccess } from '../../game/src/road-access.js';
import { sourcePassages } from './source-passages.mjs';
import { validRoadWidthReview, reviewedSingleLane, resolveRoadWidth } from '../../game/src/road-widths.js';
import { resolveParkingLayout } from '../../game/src/parking-layout.js';
import { distPointSeg, pointInPolygon, polyArea, polyCentroid, footprintMargin, simplifyIdx, simplifyRing, Grid, assembleRings } from './geom.mjs';
import { buildCorridor } from './corridors.mjs';
import { CITIES as GAME_CITIES } from '../../game/src/cities.js';
import { LANDMARKS } from '../../game/src/landmarks.js';
import { speciesFromOSM } from '../../game/src/trees.js';
import { resolveResearchSource } from './research-source.mjs';

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
const AREA_KINDS = ['water', 'park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'residential', 'industrial', 'commercial', 'retail', 'railway', 'parking', 'apron', 'runway', 'construction', 'track', 'clay', 'turf', 'hard', 'pool', 'yard'];
// (2026-11-08) track = concrete / asphalt sports track (velodrome), clay = clay courts / tartan tracks, turf = artificial-turf
// pitch, hard = asphalt / concrete / acrylic courts, pool = outdoor swimming pool, yard = school / hospital / sports-centre grounds
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
function triangulateSourceRoof(outer, holes = []) { return { pts: outer.concat(...holes), tris: ShapeUtils.triangulateShape(outer.map(p => new Vector2(...p)), holes.map(r => r.map(p => new Vector2(...p)))) }; }
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

function defaultSpeed(cls, country, lat, lon = null) {
    if (cls === 'service') return country === 'US' ? 24 : 20;
    // (spec 11, speedlimits.json) Bellevue: local streets without maxspeed are 20 mph (city 2026 local-street reduction)
    if (country === 'US' && lon != null && /^(residential|unclassified|living_street)$/.test(cls) && lat > 47.57 && lat < 47.64 && lon > -122.215 && lon < -122.14) return 32;
    if (country === 'US') {
        const mph = { motorway: 60, trunk: 55, motorway_link: 40, trunk_link: 40, primary: 35, secondary: 35, tertiary: 30, primary_link: 30, secondary_link: 30, tertiary_link: 25, residential: 25, unclassified: 25, living_street: 15 }[cls] || 25;
        return Math.round(mph * 1.609);
    }
    if (cls === 'living_street') return 30;
    // DN1 outside Băneasa: 100 outside localities; inside Otopeni (locality ≈ 44.53–44.575 × 26.04–26.10) the urban 50 applies
    if ((cls === 'trunk' || cls === 'primary') && lat > 44.515) return (lon != null && lat > 44.53 && lat < 44.575 && lon > 26.04 && lon < 26.10) ? 50 : 100;
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
    const cfg = { rRoute: d.rRoute ?? 300, rStop: 300, maxSpur: 0, route: d.route || [], loops: [], circles: d.circles || [], spurs: [], polys, fieldPad: 1800, bands: d.bands || [], exact: true };
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
    const roadWidthReviews=new Map(),roadWidthIssues=[];
    if(ds){
        const file=path.join(REPO,'game','research',`${cityId}-${did}.json`);
        if(fs.existsSync(file)){
            const research=JSON.parse(fs.readFileSync(file,'utf8'));
            for(const review of research.road_widths||[]){
                if(!validRoadWidthReview(review)||!W.has(+review.sourceRoadId.slice(1))){roadWidthIssues.push({sourceRoadId:review.sourceRoadId,reason:'invalid-or-unmatched-road-width-review'});continue;}
                if(roadWidthReviews.has(+review.sourceRoadId.slice(1))){roadWidthIssues.push({sourceRoadId:review.sourceRoadId,reason:'duplicate-road-width-review'});continue;}
                roadWidthReviews.set(+review.sourceRoadId.slice(1),review);
            }
        }
    }


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
        if (t.area === 'yes') continue;
        const access = resolveRoadAccess(t);
        if (!ds && !access.publicDrive) continue;
        // Districts preserve physical restricted roads; mode-specific access controls their routing separately.
        // Legacy corridor data still excludes parking/service-only aisles from its public network.
        if (!ds && cls === 'service' && /parking_aisle|drive-through|emergency_access/.test(t.service || '')) continue;
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
        // A tagged single lane may legally carry traffic in both directions. Keep both graph directions,
        // but do not turn its one physical lane into two inferred full-width lanes.
        const widthReview=roadWidthReviews.get(id);
        const sharedLane = !!ds && !oneway && (total === 1 || reviewedSingleLane(t,widthReview));
        const physicalSharedWidth = sharedLane ? (parseMeasure(t.width) > 0 ? parseMeasure(t.width) : widthReview?.widthM ?? laneWidthFor(cls)) : 0;
        const laneW = sharedLane ? physicalSharedWidth / 2 : laneWidthFor(cls);
        let sidewalk = SIDEWALK[cls] ?? 2;
        if (t.sidewalk === 'no' || t.sidewalk === 'none' || t.foot === 'no') sidewalk = Math.min(sidewalk, 0.8);
        const ll0 = N.get(nodes[0]);
        let maxspeed = parseSpeed(t.maxspeed, country) || defaultSpeed(cls, country, ll0[0], ll0[1]);
        // US ramps without a posted limit (spec 11): Washington ramps carry no regulatory sign, only yellow advisory plates.
        // maxspeed = the advisory (what drivers / AI do: maxspeed:advisory, else 25 mph on loops, 40 mph otherwise);
        // the legal limit for the HUD is the mainline's (60 mph state highway, RCW 46.61.400) → `rampLimits`
        let regKmh = 0;
        if (country === 'US' && isLink && /motorway|trunk/.test(base) && !t.maxspeed) {
            let turn = 0, prev = null;
            for (let i = 1; i < nodes.length; i++) { const a = N.get(nodes[i - 1]), b = N.get(nodes[i]); const h = Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]); if (prev != null) { let d = h - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn += d; } prev = h; }
            maxspeed = parseSpeed(t['maxspeed:advisory'], country) || (Math.abs(turn) > Math.PI * 0.9 ? 40 : 64);
            regKmh = 97;
        }
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
        roads.push({ id, cls, nodes, oneway, lf, lb, laneW, sharedLane, physicalSharedWidth, sidewalk, maxspeed, flags, layer, name, lat: ll0[0], tags: t, regKmh, access, widthReview });
    }
    // prune service ways that do not connect anything (dangling chains)
    if (!ds) {
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
    const cor = buildCorridor(roads.filter(r => r.access.publicDrive), pos, (lat, lon) => P(lat, lon), ds ? ds.cfg : corridorConfig(cityId), log);
    const M = (x, z) => cor.margin(x, z);
    const stat = { roadsBefore: roads.length };
    const cutIds = new Map(); let cutNext = -2e9;
    const scenery = []; // district mode: non-drivable street strips in the scenery ring ({r, pts})
    {
        const out = [];
        // (after round 6) overpasses are never cut mid-span: a bridge / viaduct with any node in the playable area is kept
        // whole, plus ~150 m of the at-grade road beyond each end, so its decks come down to the ground (Pasajul Basarab at
        // the Politehnica start ended in mid-air at the band edge). Those extra pieces end in ordinary closures.
        const forced = new Set();
        if (ds) {
            const isBr = (r) => r.tags && (r.tags.bridge && r.tags.bridge !== 'no' || (+r.tags.layer || 0) >= 1);
            const byNode = new Map(); for (const r of roads) for (const n of r.nodes) { let a = byNode.get(n); if (!a) byNode.set(n, a = []); a.push(r); }
            const done = new Set(), queue = [];
            for (const r of roads) if (isBr(r) && r.nodes.some(n => M(...pos.get(n)) <= 0)) queue.push(r);
            while (queue.length) { // whole connected bridge chains
                const r = queue.pop(); if (done.has(r)) continue; done.add(r); for (const n of r.nodes) forced.add(n);
                for (const n of [r.nodes[0], r.nodes[r.nodes.length - 1]]) for (const q of byNode.get(n) || []) {
                    if (done.has(q)) continue;
                    if (isBr(q)) { queue.push(q); continue; }
                    // the approach beyond the end: walk away from n up to 150 m
                    const fwd = q.nodes[0] === n ? q.nodes : q.nodes[q.nodes.length - 1] === n ? [...q.nodes].reverse() : null; if (!fwd) continue;
                    let L = 0; forced.add(fwd[0]); for (let i = 1; i < fwd.length && L < 150; i++) { const a = pos.get(fwd[i - 1]), b = pos.get(fwd[i]); L += Math.hypot(b[0] - a[0], b[1] - a[1]); forced.add(fwd[i]); }
                }
            }
        }
        for (const r of roads) {
            const mg = r.nodes.map(n => (forced.has(n) ? -1 : M(...pos.get(n))));
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
        // (2026-11-08) district mode: the streets of the scenery ring (outside the playable area, up to OUTER_RING_ROADS m)
        // and the inside pieces not connected to the drivable network are kept as non-drivable scenery strips
        // (asphalt + sidewalks), so the ring of real buildings stands on real streets, not on a grey plain
        if (ds) {
            const RING = (ds.district.outerRing ?? 600) + 80;
            for (const r of roads) {
                if (r.tags && (r.tags.tunnel && r.tags.tunnel !== 'no' || r.tags.covered === 'yes')) continue;
                const mg = r.nodes.map(n => M(...pos.get(n)));
                let run = [];
                const flush = () => { if (run.length >= 2) scenery.push({ r, pts: run }); run = []; };
                for (let i = 0; i < r.nodes.length; i++) {
                    const p = pos.get(r.nodes[i]);
                    if (mg[i] > 0 && mg[i] <= RING) { if (!run.length && i > 0) run.push(pos.get(r.nodes[i - 1])); run.push(p); }
                    else { if (run.length) run.push(p); flush(); }
                }
                flush();
            }
            // Core source roads keep their full road profile, including restricted elevated roads.
            // Runtime access/SCC filtering controls routing; scenery strips cannot represent bridge decks.
        }
        roads.length = 0;
        for (const r of out) if (ds || good.has(f(r.nodes[0]))) roads.push(r);
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
        if (!r.sharedLane && !r.oneway && r.tram && centre / n > 0.4 && r.lf + r.lb >= 2) { r.median = 6.5; r.flags |= 256; }
        else if (!r.sharedLane && !r.oneway && /motorway|trunk/.test(r.cls) && !r.cls.endsWith('_link')) r.median = 3;
        if(ds){
            r.widthProfile=resolveRoadWidth(r.tags,r.widthReview,{lanes:r.lf+r.lb,lanesF:r.lf,lanesB:r.lb,oneway:r.oneway,reverse:r.tags.oneway==='-1',medianM:r.median,sharedLane:r.sharedLane,defaultSharedWidth:r.physicalSharedWidth||laneWidthFor(r.cls),defaultLaneWidth:r.laneW});
            if(r.widthProfile){r.median=r.widthProfile.medianM;r.laneW=r.widthProfile.laneWidthM;if(r.sharedLane)r.physicalSharedWidth=r.widthProfile.widthM;if(!r.median)r.flags&=~256;}
        }

        if (r.tram) r.flags |= 32;
    }

    // ---- push apart parallel carriageways that would overlap at the drawn lane widths at this scale:
    //      dual carriageways, a street running beside an underpass / overpass ramp, parallel ramps…
    //      Long segments are densified first so the push acts along their whole length; near a node the two roads
    //      share (a merge / diverge) the push tapers to zero.
    if (!ds) {
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
    if (!ds) {
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
        if (h === 'speed_camera' && t.enforcement !== 'traffic_signals') f |= 256;
        if (t.enforcement === 'traffic_signals' || (h === 'speed_camera' && /red_light|traffic_signals/.test(t['camera:type'] || t.enforcement || ''))) f |= 1024; // red-light camera (spec 11)
        if (h === 'mini_roundabout') f |= 512;
        return f;
    };
    const keptIndex = new Map(); const outNodes = [], roadNodePositions = [], roadNodeIds = []; const nodeFlags = [];
    const idxOf = (id) => {
        let i = keptIndex.get(id);
        if (i === undefined) {
            i = outNodes.length / 2; keptIndex.set(id, i);
            const p = pos.get(id); outNodes.push(Math.round(p[0] * 10), Math.round(p[1] * 10));
            if (ds) { roadNodePositions.push(...p); roadNodeIds.push(id); }
            const f = nodeFlagOf(id); if (f) nodeFlags.push(i, f);
        }
        return i;
    };
    const outRoads = [], sharedLanes = {}, roadAccess = {}, roadSourceGeometry = {}, roadWidths = {};
    const sourceRoadGeometry = (r) => {
        const source = W.get(r.id);
        return { sourceId: 'w' + r.id, nodeIds: source.nodes, wgs84: source.nodes.map(id => N.get(id)), projected: source.nodes.map(pt), tags: source.tags };
    };
    const rampLimits = []; // [roadIndex, legalKmh, …]: US ramps without a posted limit (roads[i].maxspeed = advisory; no R2-1 sign)
    const roadInfo = []; // per output road: [osmLayer, flags, widthDm, maxheightDm, placement, bridgeStructure] (vertical / placement hints, see header)
    const parking = []; // optional rows: road index, right location/orientation, left location/orientation (string indices)
    const turnLanes = []; // [roadIndex, forward 'left|through;right|…' string, backward string, …] (OSM turn:lanes → painted arrows)
    let segCount = 0;
    for (const r of roads) {
        const pts = r.nodes.map(n => pos.get(n));
        const keep = r.nodes.map((n, i) => (useCount.get(n) > 1 || nodeFlagOf(n) || (i > 0 && r.nodes[i] === r.nodes[0])) ? 1 : 0);
        const idx = ds ? pts.map((_, i) => i) : simplifyIdx(pts, 0.35, keep);
        // drop consecutive near-duplicates (<0.3 m) unless junction
        const ids = [];
        for (const i of idx) { const n = r.nodes[i]; if (!ds && ids.length && Math.hypot(pos.get(n)[0] - pos.get(ids[ids.length - 1])[0], pos.get(n)[1] - pos.get(ids[ids.length - 1])[1]) < 0.3 && !(useCount.get(n) > 1)) continue; ids.push(n); }
        if (ids.length < 2) continue;
        r.median = r.oneway ? -(r.lf * r.laneW) : r.median;
        segCount += ids.length - 1;
        r.keptIds = ids;
        { const t = r.tags || {}; const fw = t['turn:lanes:forward'] || (r.oneway ? t['turn:lanes'] : '') || '', bw = r.oneway ? '' : (t['turn:lanes:backward'] || '');
          if (/left|right|through/.test(fw + bw)) turnLanes.push(outRoads.length, S(fw), S(bw)); }
        { const t = r.tags || {}; const lay = parseInt(t.layer); const dm = (v) => { const n = parseMeasure(v); return isFinite(n) && n > 0 && n < 100 ? Math.round(n * 10) : 0; };
          // kerbside parking (OSM parking:{left,right,both} or the older parking:lane:*; sides in the way's own direction,
          // swapped for oneway=-1 ways, which the build reverses): 64 / 128 parking right / left, 256 / 512 none right / left
          const pk = (sd) => t['parking:' + sd] || t['parking:lane:' + sd] || t['parking:both'] || t['parking:lane:both'] || '';
          const pYes = (v) => /^(lane|street_side|on_kerb|half_on_kerb|shoulder|parallel|diagonal|perpendicular|marked)$/.test(v), pNo = (v) => /^(no|separate|no_parking|no_stopping|fire_lane)$/.test(v);
          let pR = pk('right'), pL = pk('left'); if (t.oneway === '-1') [pR, pL] = [pL, pR];
          const parkingSide = (sd) => {
              const legacy = t[`parking:lane:${sd}`] || t['parking:lane:both'] || '';
              const oldOrientation = /^(parallel|diagonal|perpendicular)$/.test(legacy) ? legacy : '';
              const oldLocation = oldOrientation ? (t[`parking:lane:${sd}:${oldOrientation}`] || t[`parking:lane:both:${oldOrientation}`] || '') : legacy;
              return [t[`parking:${sd}`] || t['parking:both'] || oldLocation,
                  t[`parking:${sd}:orientation`] || t['parking:both:orientation'] || oldOrientation];
          };
          let right = parkingSide('right'), left = parkingSide('left');
          if (t.oneway === '-1') [right, left] = [left, right];
          if ([...right, ...left].some(Boolean)) parking.push([outRoads.length, ...right.map(S), ...left.map(S)]);
          const f = (t.covered && t.covered !== 'no' ? 1 : 0) | (t.tunnel === 'building_passage' ? 2 : 0) | (/^(yes|viaduct|aqueduct|boardwalk|cantilever|covered|movable|trestle)$/.test(t.bridge || '') ? 4 : 0) | (t.level != null ? 8 : 0) | (r.cls.endsWith('_link') ? 16 : 0) | (t.layer != null ? 32 : 0)
              | (pYes(pR) ? 64 : 0) | (pYes(pL) ? 128 : 0) | (pNo(pR) ? 256 : 0) | (pNo(pL) ? 512 : 0);
          roadInfo.push(isFinite(lay) ? lay : 0, f, dm(t.width), dm(t.maxheight || t['maxheight:physical']), S(t.placement || t['placement:forward'] || ''), S(t['bridge:structure'] || t['bridge:name'] || '')); }
        if (r.regKmh) rampLimits.push(outRoads.length, r.regKmh);
        if (r.sharedLane) sharedLanes[outRoads.length] = { widthM: r.physicalSharedWidth, sourceId: 'w' + r.id, widthSource: r.widthProfile?.source || (parseMeasure(r.tags.width) > 0 ? 'OSM width' : 'estimate:class single-lane width'), evidence: r.tags.lanes==='1' ? 'OSM lanes=1; legal two-way' : 'individually reviewed aerial physical single lane; raw legal lane counts absent', classificationSource: r.tags.lanes==='1' ? 'OSM lanes=1' : 'independent aerial measurement' };
        if (ds) {
            if(r.widthProfile)roadWidths[outRoads.length]={sourceId:'w'+r.id,...r.widthProfile};
            roadAccess[outRoads.length] = { sourceId: 'w' + r.id, ...r.access };
            roadSourceGeometry[outRoads.length] = { ...sourceRoadGeometry(r), preparedNodeIds: ids };
        }
        r.outIndex = outRoads.length;
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
        if (t.leisure === 'track') return /grass/.test(t.surface || '') ? 'pitch' : 'track'; // (any running / cycling track: under its infield pitch)
        if (t.leisure === 'pitch' && /clay|tartan/.test(t.surface || '')) return 'clay';
        if (t.leisure === 'pitch' && /artificial_turf|artificial_grass|turf/.test(t.surface || '')) return 'turf';
        if (t.leisure === 'pitch' && /asphalt|concrete|acrylic|paved|rubber|paving_stones|compacted|sett/.test(t.surface || '')) return 'hard';
        if (t.leisure === 'pitch' && /basketball|volleyball|handball|multi|skateboard/.test(t.sport || '') && !t.surface) return 'hard';
        if (t.leisure === 'swimming_pool' && !t.building && !/indoor|yes/.test(t.indoor || '')) return 'pool';
        if (t.leisure === 'pitch' || t.leisure === 'golf_course') return t.leisure === 'golf_course' ? 'grass' : 'pitch';
        if (t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'village_green' || t.landuse === 'recreation_ground' || t.natural === 'grassland' || t.landuse === 'flowerbed' || t.landuse === 'greenery' || t.landuse === 'plant_nursery') return 'grass';
        if (/^(school|kindergarten|college|university|hospital|clinic)$/.test(t.amenity || '') || /^(sports_centre|stadium|fitness_centre)$/.test(t.leisure || '') || t.landuse === 'education') return 'yard';
        if (t.landuse === 'brownfield') return 'construction';
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
    const pushArea = (kind, name, outerIds, holesIds, sourceId = '', sourceTags = {}) => {
        const outer = ringPts(outerIds); if (!outer) return;
        const tol = kind === 'water' ? 1.5 : 1.0;
        const so = simplifyRing(outer, tol, tol * 0.6, 2000); if (!so) return;
        const A = Math.abs(polyArea(so));
        if (A < 30) return;
        // keep when near the corridors (parks / water / forest may extend further for scenery)
        // (2026-11-08) district mode: everything out to the scenery ring (pitches, courts, pools, lawns, yards between 120 and
        // 600 m were dropped and left bare patches next to the real buildings)
        const lim0 = kind === 'water' || kind === 'park' || kind === 'forest' ? 600 : kind === 'apron' || kind === 'runway' ? 400 : 120;
        const lim = ds ? Math.max(lim0, (ds.district.outerRing ?? 600) + 40) : lim0;
        let near = false;
        for (let i = 0; i < so.length && !near; i += Math.max(1, Math.floor(so.length / 60))) near = M(so[i][0], so[i][1]) <= lim;
        if (!near) { const c = polyCentroid(so); near = M(c[0], c[1]) <= lim; }
        if (!near && A > 2e4) for (const c of cor.circles) if (pointInPolygon(c.x, c.z, so)) { near = true; break; }
        if (!near && A > 2e4) for (const pc of cor.pieces) { for (let i = 0; i < pc.pts.length && !near; i += 15) near = pointInPolygon(pc.pts[i][0], pc.pts[i][1], so); if (near) break; }
        if (!near && !(kind === 'water' && A > 1e5)) return;
        const holes = [], rawHoles = [];
        for (const h of holesIds || []) { const hp = ringPts(h); if (!hp) continue; if (Math.abs(polyArea(hp)) > 0) rawHoles.push(hp); const sh = simplifyRing(hp, tol, tol * 0.6, 2000); if (sh && Math.abs(polyArea(sh)) > 20) holes.push(sh); }
        const openRing = r => r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r;
        areaRings.push({ kind, name: name || '', rings: [so, ...holes], sourceId, sourceTags, ...(ds && kind === 'parking' ? { sourceParkingRings: [outer, ...rawHoles].map(openRing) } : {}) });
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
            pushArea(kind, t.name, ring, holes, 'r' + id, t);
        }
        if (o.open.length && kind === 'water') log('  water relation with open rings', id, t.name, o.open.length);
    }
    for (const [id, w] of W) {
        const t = w.tags; if (t.building || t.highway) continue;
        if (w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
        const kind = areaKindOf(t); if (!kind) continue;
        if (relWays.has(id) && Object.keys(t).length <= 1) continue;
        pushArea(kind, t.name, w.nodes, null, 'w' + id, t);
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
    const outLines = [], lineSources = [];
    for (const [sourceWayId, w] of W.entries()) {
        const t = w.tags;
        let kind = null, width = 0;
        const literalWidth = parseMeasure(t.width);
        if ((t.aeroway === 'runway' || t.aeroway === 'taxiway') && t.area !== 'yes') { kind = t.aeroway; width = literalWidth > 0 ? literalWidth : (t.aeroway === 'runway' ? 45 : 20); }
        else if (t.waterway === 'river' || t.waterway === 'canal' || t.waterway === 'stream') { kind = t.waterway; width = literalWidth > 0 ? literalWidth : (t.waterway === 'river' ? 30 : t.waterway === 'canal' ? 15 : 3); if (kind === 'stream') continue; }
        if (!kind) continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        const idx = simplifyIdx(pts, 1.0);
        const sp = idx.map(i => pts[i]);
        if (!sp.some(p => M(p[0], p[1]) <= 600)) continue;
        outLines.push([LINE_KINDS.indexOf(kind), Math.round(width * C.scale * 10), S(t.name), delta(sp)]);
        lineSources.push({ sourceId: 'w' + sourceWayId, tags: { ...t }, nodeIds: w.nodes.map(String), wgs84: w.nodes.map(id => N.get(id)), points: pts, widthM: width * C.scale, widthSource: literalWidth > 0 ? 'OSM width' : 'estimate:' + kind + ' class; literal source width absent' });
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
    const reviewedBuildingPassages = [];
    const streetTrees = {}; // street name → species keys (trees.js speciesFromOSM) from the research notes; [] = researched as treeless
    // ---- field research (game/research/<city>-<district>.json, spec 20): fill missing height / levels / facade and roof
    //      colours / roof shape on the OSM tags of the researched buildings (OSM tags win where present)
    if (ds) {
        const rf = path.join(REPO, 'game', 'research', `${cityId}-${did}.json`);
        let applied = 0;
        if (fs.existsSync(rf)) {
            let rj = null; try { rj = JSON.parse(fs.readFileSync(rf, 'utf8')); } catch (e) { log('research: cannot parse', rf, e.message); }
            reviewedBuildingPassages.push(...(rj?.building_passages || []));
            for (const b of rj?.buildings || []) {
                const source = resolveResearchSource(b, W, R); if (!source) continue;
                const { id, object: w } = source;
                const originalTags = Object.fromEntries(Object.entries(w.tags).filter(([k]) => !k.startsWith('__')));
                const t = w.tags = { ...w.tags }, ot = b.osmTags || {};
                t.__originalTags ||= originalTags;
                t.__originalDimensions ||= Object.fromEntries(Object.entries(t).filter(([k]) => /^(height|min_height|min_level|building:levels|building:min_level|roof:)/.test(k)));
                const set = (k, v) => { if (v == null || v === '' || t[k] != null) return false; t[k] = String(v); return true; };
                let ch = false;
                // `research: {height_m, storeys, facade_hex, roof}` = the hand-researched key buildings (CV stops, landmarks): they beat the estimates
                const rs = (b.research && typeof b.research === 'object') ? b.research : {};
                // Open canopy semantics require an explicit independently reviewed record, never amenity=fuel alone.
                const oc = rs.open_canopy;
                if (oc && Array.isArray(oc.evidence) && oc.evidence.length && Number.isFinite(oc.topM) && Number.isFinite(oc.clearanceM) && oc.clearanceM > 0 && oc.topM > oc.clearanceM) t.__canopy = { ...oc, classificationSource: 'research:' + path.basename(rf) + '#' + b.osm };
                const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) ? v : null;
                const roofShape = (v) => (typeof v === 'string' && /^(flat|gabled|hipped|pyramidal|dome|skillion|mansard|round|gambrel)$/.test(v)) ? v : null;
                let hr = 0; // 1 = researched height / storeys, 2 = only the research estimate
                let heightReviewAllowed = true;
                if (rs.height_source_part) {
                    const ref = rs.height_source_part, part = /^w\d+$/.test(ref.sourceId || '') ? W.get(+ref.sourceId.slice(1)) : null;
                    const rawPart = part && { ...part.tags, ...(part.tags.__originalDimensions || {}), height: part.tags.__originalDimensions ? part.tags.__originalDimensions.height : part.tags.height };
                    const proof = part && sourcePartHeightReview({ parentTags: t.__originalDimensions, parentRing: w.nodes.map(pt), partTags: rawPart, partRing: part.nodes.map(pt), review: ref });
                    heightReviewAllowed = !!proof && rs.height_m === proof.heightM && rs.height_source === 'estimate';
                    if (!heightReviewAllowed) log(`research: rejected source-part height guard for ${b.osm}`);
                }
                if (heightReviewAllowed && set('height', rs.height_m ?? b.heightM ?? b.height ?? ot.height)) { ch = true; hr = rs.height_source === 'estimate' ? 2 : 1; }
                if (set('building:levels', rs.storeys ?? b.levels ?? b.building_levels ?? ot['building:levels'])) { ch = true; hr = hr || 1; }
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
            // per-street tree notes (streets[].research.trees text + streets[].trees.genus): baked here so world.js no longer
            // fetches the whole dossier at runtime (same parsing world.js did)
            for (const st of rj?.streets || []) {
                const txt = String(st.research?.trees || ''), gen = st.trees?.genus || {}, out = [];
                for (const g of Object.keys(gen)) { const k = speciesFromOSM(g); if (k && !out.includes(k)) out.push(k); }
                for (const w of txt.split(/[^\p{L}]+/u)) { const k = speciesFromOSM(w); if (k && k !== 'conifer' && !out.includes(k)) out.push(k); }
                if (st.name && (out.length || /no (street )?trees|treeless|none/i.test(txt))) streetTrees[st.name] = out;
            }
        }
    }
    // aerial roof measurements (tools/aerial/roofs.py → game/research/roofs-<city>-<district>.json): roof shape + median
    // roof colour per OSM way, used where OSM has no roof:shape / roof:colour (OSM tags always win)
    const aerial = new Map(), aerialColours = new Map();
    if (ds) {
        const af = path.join(REPO, 'game', 'research', `roofs-${cityId}-${did}.json`);
        if (fs.existsSync(af)) { try { const aj = JSON.parse(fs.readFileSync(af, 'utf8')); for (const [k, v] of Object.entries(aj.roofs || {})) aerial.set(k, v); for (const [k, v] of Object.entries(aj.colourMeasurements || {})) aerialColours.set(k, v); } catch (e) { log('aerial roofs: cannot parse', af, e.message); } }
        if (aerial.size) log(`aerial roofs: ${aerial.size} footprints measured (${af})`);
    }
    const buildings = [];
    const bDrops = {}, bDropList = [], DEBUG_DROPS = !!process.env.DEBUG_DROPS; // why footprints inside the playable area were not kept
    const bGrid = new Grid(60);
    // Adjacent OSM buildings commonly share a wall. A boundary point can round to the other side by 1e-13 m;
    // that is not an overlap and must not force a whole-footprint shrink or drop.
    const strictInside = (p, poly) => pointInPolygon(p[0], p[1], poly) && poly.every((a, i) => {
        const b = poly[(i + 1) % poly.length];
        return distPointSeg(p[0], p[1], a[0], a[1], b[0], b[1]).d > 0.05;
    });
    const solidAt = (x, z, ring, holes = []) => pointInPolygon(x, z, ring) && !holes.some(h => pointInPolygon(x, z, h));
    const ringKey = (ring) => { // exact cyclic/reversed equality, not a proximity or bounding-box match
        const r = ring.slice(); if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
        const tokens = r.map(p => p.join(',')), variants = [];
        for (const seq of [tokens, tokens.slice().reverse()]) for (let i = 0; i < seq.length; i++) variants.push(seq.slice(i).concat(seq.slice(0, i)).join(';'));
        return variants.sort()[0] || '';
    };
    const footprintKey = (outer, holes = []) => ringKey(outer) + '|' + holes.map(ringKey).sort().join('|');
    const ringsCross = (a, b) => {
        const side = (p, q, r) => ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / Math.max(1e-9, Math.hypot(q[0] - p[0], q[1] - p[1]));
        for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
            const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
            const v = [side(p, q, r), side(p, q, s), side(r, s, p), side(r, s, q)];
            if (v[0] * v[1] < 0 && v[2] * v[3] < 0 && v.every(x => Math.abs(x) > 0.05)) return true;
        }
        return false;
    };
    const interiorOverlap = (a, b, ah = [], bh = []) => a.some(p => strictInside(p, b) && !bh.some(h => pointInPolygon(p[0], p[1], h))) || b.some(p => strictInside(p, a) && !ah.some(h => pointInPolygon(p[0], p[1], h))) || ringsCross(a, b);
    const rawBuildings = [], buildingSourceSkips = [], buildingRoadConflicts = [];
    const addRaw = (ids, t, isRel, oid = '', innerIds = []) => {
        const sourceId = (isRel ? 'r' : 'w') + oid;
        const lls = []; for (const n of ids) { const ll = N.get(n); if (!ll) { buildingSourceSkips.push({ sourceId, reason: 'incomplete-source-nodes', node: n }); return; } lls.push(ll); }
        const holesLL = innerIds.map(r => r.map(n => N.get(n))).filter(r => r.length > 3 && r.every(Boolean));
        if (holesLL.length !== innerIds.length) { buildingSourceSkips.push({ sourceId, reason: 'incomplete-source-courtyard' }); return; }
        rawBuildings.push({ lls, holesLL, t: { ...t, __id: (isRel ? 'r' : 'w') + oid }, isRel, aer: !isRel ? aerial.get(String(oid)) || null : null, aerColour: !isRel ? aerialColours.get(String(oid)) : undefined });
    };
    const bRelWays = new Set();
    const addAnnulus = (outLL, inLL, t) => {
        let cla = 0, clo = 0; for (const [a, c] of inLL) { cla += a; clo += c; } cla /= inLL.length; clo /= inLL.length;
        const mLo = 111320 * Math.cos(cla * Math.PI / 180), loc = (ll) => [(ll[1] - clo) * mLo, -(ll[0] - cla) * 111320], back = ([x, z]) => [cla - z / 111320, clo + x / mLo];
        const O = outLL.map(loc), I = inLL.map(loc);
        const hit = (poly, a) => { const dx = Math.cos(a), dz = Math.sin(a); let best = Infinity;
            for (let i = 0; i < poly.length - 1; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[i + 1], ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
                const tt = (x1 * ez - z1 * ex) / den, u = (x1 * dz - z1 * dx) / den; if (tt > 0 && u >= 0 && u <= 1 && tt < best) best = tt; }
            return isFinite(best) ? [dx * best, dz * best] : null; };
        const n = 28, tags = { ...t, building: 'stadium' };
        for (let k = 0; k < n; k++) {
            const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, o0 = hit(O, a0), o1 = hit(O, a1), i0 = hit(I, a0), i1 = hit(I, a1);
            if (!o0 || !o1 || !i0 || !i1) continue;
            const q = [o0, o1, i1, i0, o0].map(back); rawBuildings.push({ lls: q, t: tags, isRel: true });
        }
    };
    for (const [rid, r] of R) {
        const original = r.tags;
        const positive = value => value != null && value !== '' && !/^(no|false|0)$/i.test(String(value));
        const positiveBuilding = positive(original.building), positivePart = ds && positive(original['building:part']);
        if (original.type !== 'multipolygon' || (ds ? !positiveBuilding && !positivePart : !original.building)) continue;
        const barePart = positivePart && original['building:part'] === 'yes' && !positiveBuilding && !['name', 'shop', 'office', 'amenity', 'tourism', 'leisure'].some(k => original[k]) && !original['roof:shape'] && !original['roof:height'] && !original['roof:levels'];
        const t = ds ? { ...original, ...(positivePart && !positiveBuilding ? { building: 'yes' } : {}), ...(barePart ? { __barePart: true } : {}), __sourceTags: original.__originalTags || Object.fromEntries(Object.entries(original).filter(([k]) => !k.startsWith('__'))) } : original;
        const outers = r.members.filter(m => m.type === 'way' && m.role !== 'inner' && W.has(m.ref)).map(m => { bRelWays.add(m.ref); return W.get(m.ref).nodes; });
        const inners = r.members.filter(m => m.type === 'way' && m.role === 'inner' && W.has(m.ref)).map(m => { bRelWays.add(m.ref); return W.get(m.ref).nodes; });
        const inRings = inners.length ? assembleRings(inners).rings : [];
        for (const ring of assembleRings(outers).rings) {
            // Legacy corridor stadiums keep their existing stand sectors. Source districts retain the exact relation and holes, associated with
            // the containing outer only (a multipolygon can have several separate buildings).
            const lls = ring.map(n => N.get(n)); if (lls.some(x => !x)) continue;
            const contained = inRings.filter(ir => ir.length > 3 && ir.every(n => { const p = N.get(n); return p && pointInPolygon(p[1], p[0], lls.map(([la, lo]) => [lo, la])); }));
            const inner = contained.map(ir => ir.map(n => N.get(n)))[0];
            if (!ds && inner && /stadium|grandstand|sports_centre|arena/.test(t.building + ' ' + (t.leisure || ''))) { addAnnulus(lls, inner, t); continue; }
            addRaw(ring, t, true, rid, contained);
        }
    }
    for (const [id, w] of W) {
        const t = w.tags;
        // Retain every explicitly dimensioned building part, including the short
        // podiums and narrow columns supporting a tower. Tall-only filtering
        // left the tower floating and forced its aggregate outline to act as a body.
        const tallPart = ds && t['building:part'] && t['building:part'] !== 'no';
        const barePart = tallPart && t['building:part'] === 'yes' && !t.building && !['name', 'shop', 'office', 'amenity', 'tourism', 'leisure'].some(k => t[k]) && !t['roof:shape'] && !t['roof:height'] && !t['roof:levels'];
        if (tallPart && !t.building) t.building = 'yes';
        if (!t.building || t.building === 'no' || (t['building:part'] && !tallPart)) continue;
        if (w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) { if (ds) buildingSourceSkips.push({ sourceId: 'w' + id, reason: 'unclosed-source-way' }); continue; }
        if (bRelWays.has(id) && !t.name && Object.keys(t).length <= 1) continue;
        addRaw(w.nodes, barePart ? { ...t, __barePart: true } : t, false, id);
    }
    log('raw buildings', rawBuildings.length);

    // low-poly backdrop of the building masses beyond the corridors (40 m cells → one box each)
    const bdCells = new Map();
    const addBackdrop = (c, realArea, local, t, la) => {
        if (realArea < 40 || /^(garage|garages|shed|hut|kiosk|roof|carport|container|toilets)$/.test(t.building)) return;
        let h = parseMeasure(t.height); const lv = num(t['building:levels']);
        if (!isFinite(h)) h = isFinite(lv) ? lv * 3.1 : realArea > 1500 ? 18 : realArea > 400 ? 12 : 7;
        h = C.heightMap(Math.min(h, 250));
        const [sx, sz] = C.shape(la); const a = realArea * sx * sz;
        const k = Math.floor(c[0] / 40) + ',' + Math.floor(c[1] / 40);
        let o = bdCells.get(k); if (!o) bdCells.set(k, o = { a: 0, x: 0, z: 0, h: 0, big: 0, ang: 0, hmax: 0 });
        o.a += a; o.x += c[0] * a; o.z += c[1] * a; o.h += h * a; o.hmax = Math.max(o.hmax, h);
        if (a > o.big) { o.big = a; let bl = 0; for (let i = 0; i < local.length - 1; i++) { const L = Math.hypot(local[i + 1][0] - local[i][0], local[i + 1][1] - local[i][1]); if (L > bl) { bl = L; o.ang = Math.atan2(local[i + 1][1] - local[i][1], local[i + 1][0] - local[i][0]); } } }
    };
    const OUTER_RING = ds ? (ds.district.outerRing ?? 600) : 0;
    const SMALL_OUT = /^(garage|garages|shed|hut|kiosk|roof|carport|container|toilets)$/;
    const aerialStats = { used: 0, shape: 0, colour: 0 };
    // footprint proportions: smallest width over the outline's own edge directions and the length across it (real metres)
    const rectOf = (pts) => {
        let best = Infinity, len = 0;
        for (let k = 0; k < pts.length - 1; k++) {
            const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
            for (const [x, z] of pts) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); c0 = Math.min(c0, q); c1 = Math.max(c1, q); }
            if (c1 - c0 < best) { best = c1 - c0; len = a1 - a0; }
        }
        return { w: isFinite(best) ? best : 0, l: len };
    };
    const hash01 = (sid) => { let h = 2166136261; for (const ch of String(sid)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };
    const lumHex = (hex) => { const v = parseInt(String(hex).slice(1), 16); return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255); };
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
        const sourcePart = ds && t['building:part'] && t['building:part'] !== 'no' && (parseMeasure(t.height) > 0 || num(t['building:levels']) > 0);
        if (!ds && realArea < (sourcePart ? 0.05 : 12)) continue;
        const cL = polyCentroid(local);
        const cOut = P(la, lo); cOut[0] += cL[0] * C.scale; cOut[1] += cL[1] * C.scale; // approx centroid in output space
        const mg = ds ? footprintMargin(lls.slice(0, -1).map(([a, c]) => P(a, c)), cor, (rb.holesLL || []).map(h => h.slice(0, -1).map(([a, c]) => P(a, c)))) : M(cOut[0], cOut[1]);
        const dropWhy = (why) => { bDrops[why] = (bDrops[why] || 0) + 1; if (DEBUG_DROPS) bDropList.push({ why, id: t.__id, la: +la.toFixed(6), lo: +lo.toFixed(6), area: Math.round(realArea), building: b, levels: t['building:levels'], name: t.name }); };
        // (2026-11-08) district mode: every real footprint up to OUTER_RING m beyond the playable area is a full building
        // (real outline, height, roof shape and colour; flag 32 = outside the playable area: no shops / signs / near
        // detail), the low-poly backdrop boxes only start beyond it. Before, the first 30 m past the edge were dropped
        // altogether (114 footprints in Floreasca, among them the 8-storey Floreasca hospital) and the rest were boxes.
        const outside = mg > 0;
        if (outside) {
            if (ds && mg <= OUTER_RING) { /* retain every valid positive-area source footprint */ }
            else { if (sourcePart && parseMeasure(t.height) < 20 && !(num(t['building:levels']) >= 6)) continue; if (mg > (ds ? 0 : 30) && mg < 1700) { addBackdrop(cOut, realArea, local, t, la); if (DEBUG_DROPS && ds && mg < OUTER_RING + 150) bDropList.push({ why: 'backdrop', mg: Math.round(mg), id: t.__id, la: +la.toFixed(6), lo: +lo.toFixed(6), area: Math.round(realArea) }); } else if (mg <= 30) dropWhy('edge-belt'); continue; } // (after round 6: from 30 m past the corridor edge, not 70 — the first 70 m were a bare "dead" belt)
        }
        // The exact district boundary already admits campus/courtyard buildings beyond the road buffer.
        // Keep the legacy network-distance filter only for corridor builds.
        if (!ds && !outside && !nearNetwork(cOut[0], cOut[1])) { dropWhy('far'); continue; }
        const [sx, sz] = C.shape(la);
        let ring = local.map(([x, z]) => [cOut[0] + (x - cL[0]) * sx, cOut[1] + (z - cL[1]) * sz]);
        // Thin mapped structural parts are real strips, not independent houses. The ordinary 1 m duplicate tolerance
        // folded sub-metre four-corner fins into half-area triangles; preserve their source width and tagged heights.
        if (ds) {
            const valid = sourceRing(lls.map(([a, c]) => P(a, c)));
            if (!valid.ring) { buildingSourceSkips.push({ sourceId: t.__id, reason: valid.reason, marginM: mg }); continue; }
            ring = valid.ring;
        } else ring = simplifyRing(ring, sourcePart ? 0.05 : 1.0, sourcePart ? 0.03 : 0.25, sourcePart ? 200 : 40);
        if (!ring) { dropWhy('simplify'); continue; }
        let holes = (rb.holesLL || []).map(h => ds ? sourceRing(h.map(([a, c]) => P(a, c))).ring : simplifyRing(h.map(([a, c]) => [cOut[0] + ((c - lo) * P.mPerLon - cL[0]) * sx, cOut[1] + (-(a - la) * P.mPerLat - cL[1]) * sz]), 0.2, 0.1, 80)).filter(h => h && (ds || Math.abs(polyArea(h)) >= 1));
        if (ds && holes.length !== (rb.holesLL || []).length) { buildingSourceSkips.push({ sourceId: t.__id, reason: 'invalid-source-courtyard', marginM: mg }); continue; }
        // Keep the source courtyard in place when only a street-facing outer wall is pushed. A radial fallback scales
        // both outlines together. Never accept a clearance correction that folds an inner ring through an outer wall.
        const holesFit = (outer, inner) => inner.every(h => h.every((p, i) => { const q = h[(i + 1) % h.length]; return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]].every(v => pointInPolygon(v[0], v[1], outer)); }) && !ringsCross(h, outer));
        if (holes.length && !holesFit(ring, holes)) { if (ds) buildingSourceSkips.push({ sourceId: t.__id, reason: 'courtyard-outside-source-outline', marginM: mg }); else dropWhy('invalid-courtyard'); continue; }
        // ---- style & height
        const levels = num(t['building:levels']);
        const roofLevels = num(t['roof:levels']) || 0;
        let h = parseMeasure(t.height); if (!isFinite(h)) h = NaN;
        const literalMinimum = parseMeasure(t.min_height);
        let minH = literalMinimum > 0 ? literalMinimum : (num(t['building:min_level']) > 0 ? num(t['building:min_level']) * 3.2 : 0);
        const sourceIssues = [];
        if (Number.isFinite(h) && h > 0 && literalMinimum === h) sourceIssues.push('zero vertical source band: height equals min_height=' + t.height);
        else if (Number.isFinite(h) && h > 0 && literalMinimum > h) sourceIssues.push('minimum height exceeds literal total height');
        if (Number.isFinite(h) && h <= 0) { sourceIssues.push('nonpositive OSM height=' + t.height); h = NaN; }
        if (t.height != null && !Number.isFinite(parseMeasure(t.height))) sourceIssues.push('invalid height measure=' + t.height);
        if (t.min_height != null && !(literalMinimum >= 0)) sourceIssues.push('invalid minimum height=' + t.min_height);
        if (t['building:min_levels'] != null) sourceIssues.push('unsupported minimum-level tag building:min_levels=' + t['building:min_levels'] + '; no physical minimum derived from this key');
        const canopy = t.__canopy ? { ...t.__canopy, topSource: parseMeasure(t.height) > 0 ? 'OSM height' : 'estimate', clearanceSource: literalMinimum > 0 || num(t['building:min_level']) > 0 ? 'OSM minimum' : 'estimate', supportSource: 'estimate' } : null;
        if (canopy) {
            if (!Number.isFinite(h) && !(levels > 0)) h = canopy.topM;
            if (!(literalMinimum > 0) && !(num(t['building:min_level']) > 0)) minH = canopy.clearanceM;
        }
        const dCentre = realDist(la, lo, centreLL[0], centreLL[1]);
        const nearBig = !!nearestRoad(cOut[0], cOut[1], Math.sqrt(realArea) * 0.7 * sx + 16, (r) => RE_BIGROAD.test(r.cls));
        const lu = landuseAt(cOut[0], cOut[1]);
        let style = 'plain', defLevels = 2, roof = 0, flags = 0;
        const amen = t.amenity || '', shop = t.shop || '';
        const isOffice = b === 'office' || b === 'commercial' || !!t.office;
        if (RELIGIOUS.test(b) || amen === 'place_of_worship') { style = 'church'; defLevels = 0; if (!isFinite(h) && !(levels > 0)) h = realArea < 300 ? 11 : 16; roof = realArea < 900 ? 1 : 3; }
        else if (SMALL.test(b)) { style = 'plain'; if (!isFinite(h) && !(levels > 0)) h = b === 'roof' || b === 'carport' ? 4 : 3; }
        else if (INDUSTRIAL.test(b)) { style = 'plain'; if (!isFinite(h) && !isFinite(levels)) h = b === 'greenhouse' ? 4 : realArea > 2000 ? 10 : 7; }
        else if (b === 'retail' || b === 'supermarket' || shop === 'supermarket' || shop === 'mall' || b === 'kiosk') { style = 'shop'; defLevels = realArea > 3000 ? 2 : 1; flags |= 1; }
        // (2026-11-08, owner: Piața Floreasca was a 15.5 m "bloc" wall) a market hall is a low shop building
        else if (amen === 'marketplace' || b === 'marketplace') { style = 'shop'; defLevels = 2; flags |= 1; }
        else if (HOUSE.test(b)) { style = 'house'; defLevels = country === 'US' ? 2 : 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
        else if (b === 'stadium' || b === 'grandstand') { style = 'plain'; if (!isFinite(h)) h = levels > 0 ? (ds ? levels * 3.2 : Math.min(levels * 3.2, 30)) : 14; }
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
                const villaZone = la > 44.455 && la < 44.478 && lo > 26.072 && lo < 26.112; // (to 26.112: Garibaldi / the composer streets around C.A. Rosetti)
                // (2026-11-08) Floreasca / Dorobanți villa quarter: the aerial roof survey decides villa vs block. Before, every
                // footprint < 420 m² became a 2-storey house with a pitched roof — a sea of identical roofs, while the core is
                // mostly long 4-storey flat-roofed 1950s–60s blocks (dark bitumen) with tiled villas scattered between them
                // and newer 4–6-storey flat-roofed boutique blocks (light membrane roofs).
                const aer = rb.aer, aFlat = aer && aer[0] === 'flat' && aer[1] >= 0.5, aTile = aer && (aer[0] === 'hipped' || aer[0] === 'gabled') && aer[1] >= 0.5;
                const { w: fw, l: fl } = rectOf(local), elong = fl / Math.max(1, fw), hv = hash01(t.__id || (la * 1e6 + lo));
                const lvTag = isFinite(levels);
                if (villaZone && !(lvTag && levels >= 5) && !(b === 'apartments' && realArea > 900)) {
                    if (aTile && realArea < 520) { // tiled villa: 1–3 storeys, the roof the aerial survey saw
                        style = 'house'; defLevels = lvTag ? levels : realArea < 90 ? 1 : realArea < 140 ? (hv < 0.55 ? 1 : 2) : hv < 0.55 ? 2 : 3;
                        roof = aer[0] === 'gabled' && (ds || lls.length <= 6) ? 2 : (ds || lls.length <= 6 ? 4 : 1); rb.roofKnown = true;
                    } else if (aTile) { style = 'bloc'; defLevels = lvTag ? levels : 4; roof = ds || lls.length <= 6 ? 4 : 1; rb.roofKnown = true; } // big tiled interwar block
                    else if (aFlat && realArea >= 140) { // flat-roofed block: dark bitumen = 1950s–60s bloc (P+3), light membrane = newer boutique block
                        const light = lumHex(aer[2]) > 150;
                        style = 'bloc'; roof = 0; rb.roofKnown = true;
                        defLevels = lvTag ? levels : light && elong < 2.2 ? (hv < 0.3 ? 4 : hv < 0.75 ? 5 : 6) : realArea > 1100 ? 5 : realArea < 220 ? 3 : 4;
                    } else if (aFlat) { style = 'house'; roof = 0; rb.roofKnown = true; defLevels = lvTag ? levels : realArea < 60 ? 1 : 2; } // small flat: annex / modern house
                    else if (elong > 2.3 && realArea >= 200) { style = 'bloc'; roof = 0; defLevels = lvTag ? levels : 4; } // (no aerial: a long slab is a bloc)
                    else if (realArea < 420) { style = 'house'; defLevels = lvTag ? levels : realArea < 110 ? 1 : (b === 'apartments' || hv > 0.6 ? 3 : 2); roof = ROOF_FOR_HOUSE(realArea, lls.length); }
                    else { style = 'bloc'; defLevels = lvTag ? levels : 4; }
                }
                else if (b === 'apartments' || (isFinite(levels) && levels >= 5) || realArea > 520) { style = 'bloc'; defLevels = realArea > 520 || b === 'apartments' ? (realArea > 900 ? 10 : 8) : 5; }
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
            else if (lu === 'industrial' || (realArea > 2500 && b === 'yes')) { style = 'plain'; if (!isFinite(h) && !(levels > 0)) h = 9; }
            else if (lu === 'commercial' || lu === 'retail') { style = 'shop'; defLevels = 1; flags |= 1; }
            else if (realArea < 320) { style = 'house'; defLevels = realArea < 90 ? 1 : 2; roof = ROOF_FOR_HOUSE(realArea, lls.length); }
            else { style = 'bloc'; defLevels = 3; }
        }
        // An unspecified small building:part has no evidence of a dwelling or a pitched roof. Keep explicit height,
        // min_height and colour, with a plain flat fallback; later authoritative roof evidence still takes priority.
        if (t.__barePart && style === 'house') { style = 'plain'; roof = 0; }
        if (b === 'hotel' && country === 'RO' && style !== 'glass') defLevels = Math.max(defLevels, 7);
        let measuredRoof = !!rb.roofKnown && !t['roof:shape'];
        // Reviewed independent roof shape overrides a style estimate at any source area/plan complexity.
        // Native profiles clip to the full source boundary and holes; explicit OSM roof tags still win below.
        if (rb.aer && !t['roof:shape'] && rb.aer[1] >= 0.5) {
            aerialStats.used++;
            if (!rb.roofKnown) {
                const a0 = rb.aer[0];
                if (a0 === 'flat') { if (roof !== 0) aerialStats.shape++; roof = 0; measuredRoof = true; }
                else if (a0 === 'hipped' || a0 === 'gabled') { const r = a0 === 'gabled' && (ds || lls.length <= 6) ? 2 : ds || lls.length <= 6 ? 4 : 1; if (roof !== r) aerialStats.shape++; roof = r; measuredRoof = true; }
            }
        }
        if (t['roof:shape']) {
            const rs = t['roof:shape'];
            const setRoof = (value) => { roof = value; measuredRoof = true; };
            if (/mansard|gambrel/.test(rs)) setRoof(6);
            else if (/hipped|half-hipped/.test(rs)) setRoof(ds || lls.length <= 6 ? 4 : 1);
            else if (/gabled|saltbox/.test(rs)) setRoof(ds || lls.length <= 6 ? 2 : 1);
            else if (/skillion|lean_to/.test(rs)) setRoof(5);
            else if (/pyramidal|cone/.test(rs)) setRoof(1);
            else if (/dome|onion/.test(rs)) setRoof(3);
            else if (rs === 'flat') setRoof(0);
        }
        if (/glass/.test(t['building:material'] || '') && !['church', 'house'].includes(style)) style = 'glass';
        // Reality passes need evidence of a trading ground floor: a boulevard, embassy, museum or school is not a
        // shop. Named business POIs assigned to the footprint also enable the band below, after POI matching.
        const mappedTrading = (shop && !/^(no|vacant|disused)$/.test(shop)) ||
            /^(fast_food|cafe|restaurant|food_court|ice_cream|bar|pub|biergarten|bank|bureau_de_change|pharmacy|bookmaker|casino|gambling|car_rental|car_wash|post_office|money_transfer|dentist|doctors|veterinary|internet_cafe|driving_school)$/.test(amen);
        if (['interwar', 'eclectic', 'civic', 'bloc'].includes(style) && (ds ? mappedTrading : (nearBig || shop || amen)) && !outside) flags |= 1;
        if (!isFinite(h)) {
            const lv = isFinite(levels) ? levels : defLevels;
            // (2026-11-08) roof:levels = an attic: inside a pitched roof (the roof rise is drawn on top of the walls), a set-back
            // storey only under a flat roof — villas tagged 2 + 1 attic were walls of 3 storeys with the roof on top
            h = lv * (style === 'bloc' ? 2.9 : style === 'glass' ? 3.6 : 3.2) + ((flags & 1) ? 1 : 0) + (roof === 0 ? roofLevels * 2.6 : 0);
        }
        // A literal positive OSM height can describe a low utility structure; the 2.5m fallback is not source truth.
        h = parseMeasure(t.height) > 0 ? parseMeasure(t.height) : Math.max(sourcePart ? 0.01 : 2.5, Math.min(h, 320));
        if (canopy) { style = 'plain'; roof = 0; flags &= ~1; if (!(literalMinimum > 0)) minH = Math.min(minH, h - 0.01); }
        if (t.historic === 'aircraft' || t.aeroway === 'aircraft') { style = 'plain'; roof = 0; flags &= ~1; }
        h = C.heightMap(h);
        // ---- shrink to keep clear of the road ribbons
        // (2026-11-08) a large named building (a market hall, a mall) is not shrunk away by its own service lanes running
        // into it (loading bays, building passages: Piața Floreasca was dropped); world.js keeps the same exemption
        const ownService = realArea > 1500 && !!(t.name || t.amenity || t.shop);
        if (ownService) flags |= 64;
        const clearOK = (rg, sideMargin = 1.6) => {
            for (let i = 0; i < rg.length; i++) {
                const a = rg[i], bb = rg[(i + 1) % rg.length];
                for (const p of [a, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2]]) {
                    let bad = false;
                    roadGrid.query(p[0], p[1], 20, (s) => {
                        if (bad || (s.r.flags & 4) || s.r.layer < 0 || (ownService && s.r.cls === 'service') || (minH >= 3 && s.r.layer === 0 && !(s.r.flags & 2))) return;
                        const q = distPointSeg(p[0], p[1], s.a[0], s.a[1], s.b[0], s.b[1]);
                        if (q.d > 20) return;
                        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
                        const right = (p[0] - s.a[0]) * (-dz) + (p[1] - s.a[1]) * dx > 0;
                        const need = (right ? s.wR : s.wL) + Math.min(s.r.sidewalk, sideMargin);
                        if (q.d < need) bad = true;
                    });
                    if (bad) return false;
                }
            }
            return true;
        };
        const sourceConflict = ds && !clearOK(ring);
        if (sourceConflict) buildingRoadConflicts.push({ sourceId: t.__id, phase: 'source-clearance', resolution: 'source-footprint-preserved', dimensionNote: 'Inferred road/sidewalk envelope is not evidence to alter an OSM building.' });
        let ok = ds || clearOK(ring), tries = 0;
        let c2 = polyCentroid(ring);
        // (2026-11-08) first push back only the corners that reach into the road clearance (along the road's normal), so a
        // house fronting a narrow sidewalk loses a metre of depth instead of being scaled to a third of its size toward
        // its centre (the audit found 18 such footprints kept at 35–53 % of their real area west of Calea Floreasca)
        if (!ok) {
            const need = (x, z) => { // [push x, push z] out of every road clearance at this point, or null
                let px = 0, pz = 0, any = false, largest = 0;
                roadGrid.query(x, z, 20, (sg) => {
                    if ((sg.r.flags & 4) || sg.r.layer < 0 || (ownService && sg.r.cls === 'service') || (minH >= 3 && sg.r.layer === 0 && !(sg.r.flags & 2))) return;
                    const q = distPointSeg(x, z, sg.a[0], sg.a[1], sg.b[0], sg.b[1]); if (q.d > 20) return;
                    const dx = sg.b[0] - sg.a[0], dz = sg.b[1] - sg.a[1], L = Math.hypot(dx, dz) || 1;
                    const right = (x - sg.a[0]) * (-dz) + (z - sg.a[1]) * dx > 0;
                    const want = (right ? sg.wR : sg.wL) + Math.min(sg.r.sidewalk, 1.6);
                    if (q.d >= want) return;
                    const nx = (right ? -dz : dz) / L, nz = (right ? dx : -dx) / L, k = want - q.d + 0.05;
                    // Adjacent segments of the same road can both contain this
                    // corner. Adding their normals doubles one clearance and
                    // needlessly cuts the footprint; resolve the deepest hit,
                    // then let the next pass handle any independent constraint.
                    if (k > largest) { px = nx * k; pz = nz * k; largest = k; }
                    any = true;
                });
                return any ? [px, pz] : null;
            };
            let rg = ring.map(p => [...p]);
            for (let pass = 0; pass < 4; pass++) {
                let moved = false;
                for (const p of rg) { const m = need(p[0], p[1]); if (m && Math.hypot(m[0], m[1]) < 6) { p[0] += m[0]; p[1] += m[1]; moved = true; } }
                // Long facades can cross a curved road while both corners are clear. clearOK checks midpoints too;
                // push that whole edge along the same clearance normal instead of shrinking the entire building.
                for (let i = 0; i < rg.length; i++) {
                    const a = rg[i], b = rg[(i + 1) % rg.length], m = need((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
                    if (m && Math.hypot(m[0], m[1]) < 6) { a[0] += m[0]; a[1] += m[1]; b[0] += m[0]; b[1] += m[1]; moved = true; }
                }
                if (!moved) break;
            }
            // Repair only a folded prepared boundary, retaining every corner.
            // A valid repair must still clear the full carriageway; an inferred
            // sidewalk margin must not force the real building down to a sliver.
            const quantized = rg.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
            const repaired = !simpleFootprint(quantized);
            if (repaired) rg = uncrossFootprint(quantized);
            const cg = polyCentroid(rg); let hitsOther = false;
            bGrid.query(cg[0], cg[1], 40, (o) => { if (!hitsOther && interiorOverlap(rg, o.ring, holes, o.holes)) hitsOther = true; });
            if (!hitsOther && simpleFootprint(rg.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)])) && holesFit(rg, holes) && clearOK(rg, repaired ? 0 : 1.6) && Math.abs(polyArea(rg)) >= 0.55 * Math.abs(polyArea(ring)) && polyArea(rg) * polyArea(ring) > 0) { ring = rg; ok = true; c2 = cg; }
        }
        while (!ok && tries < 7) { const shrink = ([x, z]) => [c2[0] + (x - c2[0]) * 0.9, c2[1] + (z - c2[1]) * 0.9]; ring = ring.map(shrink); holes = holes.map(h => h.map(shrink)); ok = clearOK(ring); tries++; }
        if (!ok) { dropWhy('road-clearance'); continue; }
        if (!ds && Math.abs(polyArea(ring)) < (sourcePart ? 0.02 : 8)) { dropWhy('tiny'); continue; }
        // ---- overlap test against already accepted buildings (only needed where shapes were rescaled)
        if (sx !== C.scale || sz !== C.scale || tries > 0) {
            let overlap = false;
            bGrid.query(c2[0], c2[1], 40, (o) => {
                if (overlap) return;
                if (!sourcePart && interiorOverlap(ring, o.ring, holes, o.holes)) overlap = true;
            });
            if (overlap) { dropWhy('overlap'); continue; }
        }
        let name = t.name || '';
        let brand = t.brand || '';
        if (t.tourism || t.historic || (h > 60)) flags |= 4;
        const colour = normColour(t['building:colour'] || t['building:color']) || MATERIAL_COLOUR[(t['building:material'] || '').split(';')[0]] || '';
        let roofColour = normColour(t['roof:colour'] || t['roof:color']) || (/tile|clay/.test(t['roof:material'] || '') ? '#9c5a3c' : /metal|tin|copper/.test(t['roof:material'] || '') ? (t['roof:material'] === 'copper' ? '#6f9a86' : '#7d848a') : '');
        if (!roofColour && rb.aerColour !== undefined) {
            const measurement = rb.aerColour;
            if (Number.isFinite(measurement.confidence) && measurement.confidence >= 0.65 && /^#[0-9a-f]{6}$/i.test(measurement.hex || '')) { roofColour = measurement.hex.toLowerCase(); aerialStats.colour++; }
        }
        if (!roofColour && rb.aerColour === undefined && rb.aer && rb.aer[0] !== 'unknown' && rb.aer[1] >= 0.5) {
            const v = parseInt(rb.aer[2].slice(1), 16); let rgbA = [v >> 16, (v >> 8) & 255, v & 255];
            const l = (rgbA[0] + rgbA[1] + rgbA[2]) / 3, k = roof === 0 ? 0.35 : 0.9; // (flat: mostly grey; tiles keep their hue)
            rgbA = rgbA.map(c => Math.max(0, Math.min(255, Math.round(l + (c - l) * k))));
            roofColour = '#' + rgbA.map(c => c.toString(16).padStart(2, '0')).join(''); aerialStats.colour++;
        }
        if (measuredRoof) flags |= 16; // an OSM/aerial roof shape was actually applied; unsupported mixed/round tags are not a measurement of the fallback
        if (outside) flags |= 32; // outside the playable area (scenery ring)
        const aircraft = t.historic === 'aircraft' || t.aeroway === 'aircraft' ? { classificationSource: 'OSM historic=aircraft / aeroway=aircraft', sourceId: t.__id, name: t.name || '', dimensionsSource: parseMeasure((t.__originalDimensions || t).height) > 0 ? 'OSM height' : 'estimate', dimensionNote: 'The mapped outline is the aircraft planform. Fuselage, fin and clearance within its source outline are authored estimates; this object is not a building roof.' } : null;
        const rec = { style, h, canopy, aircraft, sourceIssues, minH: literalMinimum > 0 ? minH : Math.max(0, Math.min(minH, h - (sourcePart || canopy ? 0.01 : 1))), roof, name, brand, flags, ring, holes, sourceRing: lls.slice(0, -1).map(([a, c]) => P(a, c)), sourceFootprint: footprintKey(lls, rb.holesLL || []), c: c2, area: Math.abs(polyArea(ring)), t, levels: isFinite(levels) ? Math.round(levels) : 0, colour, roofColour, la, lo,
            hSrc: parseMeasure((t.__originalDimensions || t).height) > 0 ? 0 : t.__hRes === 1 ? 1 : t.__hRes === 2 ? 2 : (levels > 0) ? 0 : 2 };
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
                        bGrid.query(x, z, 0, (bb) => { if (r.cls === 'service' && ((bb.flags & 64) || (bb.canopy && r.layer === 0 && bb.minH >= 3))) return; if (!drop.has(bb) && solidAt(x, z, bb.ring, bb.holes)) { drop.add(bb); hits++; } });
                    }
                }
            }
        }
        if (ds) for (const b of drop) buildingRoadConflicts.push({ sourceId: b.t.__id, phase: 'road-ribbon-overlap', resolution: 'source-footprint-preserved' });
        else for (let i = buildings.length - 1; i >= 0; i--) if (drop.has(buildings[i])) buildings.splice(i, 1);
        log(`dev-check: ${hits} buildings overlapping road ribbons ${ds ? 'retained with source conflicts' : 'removed'}`);
    }
    log('buildings kept', buildings.length, 'outside ring:', buildings.filter(b => b.flags & 32).length, 'dropped inside the area:', JSON.stringify(bDrops), 'aerial roofs:', JSON.stringify(aerialStats));
    if (DEBUG_DROPS) fs.writeFileSync(process.env.DEBUG_DROPS, JSON.stringify(bDropList, null, 1));

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
        // (2026-11-07, research R12.2) every named trading shop (books, optician, mobile_phone, cosmetics, chemist, pastry, variety_store,
        // houseware …) and the street-front amenities the research found missing (betting, car rental, couriers / post, bars, clinics)
        if (s && !/^(vacant|no|yes|disused)$/.test(s) && (t.name || t.brand)) return ['shop', s];
        if (['bookmaker', 'casino', 'gambling', 'car_rental', 'car_wash', 'post_office', 'money_transfer', 'dentist', 'doctors', 'veterinary', 'internet_cafe', 'driving_school'].includes(a)) return ['shop', a];
        if (a === 'bar' || a === 'pub' || a === 'biergarten') return ['food', a];
        if (t.office === 'courier' && (t.name || t.brand)) return ['shop', 'courier'];
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
    // brand names as they are written on the signs (research businesses-*.json brandTable / notes)
    const BRAND_NORM = [
        [/^garanti( bankas[ıi]| bank)?$/i, 'Garanti BBVA'], [/^(лукойл|lukoil)$/i, 'Lukoil'], [/^(omv petrom|petrom)$/i, 'Petrom'],
        [/^omv$/i, 'OMV'], [/^mol( romania)?$/i, 'MOL'], [/^rompetrol$/i, 'Rompetrol'], [/^(газпром|gazprom)$/i, 'Gazprom'],
        [/^socar$/i, 'SOCAR'], [/^banca transilvania$/i, 'Banca Transilvania'], [/^brd( groupe soci[eé]t[eé] g[eé]n[eé]rale)?$/i, 'BRD'],
        [/^ing( bank)?$/i, 'ING'], [/^bcr$/i, 'BCR'],
    ];
    const NON_LATIN = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u06ff\u0e00-\u0eff\u3040-\u9fff\uac00-\ud7af]/;
    const signText = (t) => { // Romanian signage never shows non-Latin scripts: fall back to name:ro / name:en / the brand
        let name = t.name || '', brand = t.brand || '';
        for (const [re, v] of BRAND_NORM) { if (re.test(brand.trim())) brand = v; if (re.test(name.trim())) name = v; }
        if (country === 'RO') { if (NON_LATIN.test(name)) name = t['name:ro'] || t['name:en'] || (NON_LATIN.test(brand) ? '' : brand); if (NON_LATIN.test(brand)) brand = t['brand:en'] || ''; }
        return { name, brand };
    };
    const addPoi = (t, x, z, bIdx = -1, osm = '') => {
        const k = poiKind(t); if (!k) return;
        const st = signText(t);
        const name = st.name || st.brand || '';
        if (k[0] !== 'busstop' && k[0] !== 'metro' && !name) return;
        if (M(x, z) > (k[0] === 'landmark' || k[0] === 'airport' || k[0] === 'park' ? 100 : 0)) return;
        if (!nearNetwork(x, z, k[0] === 'landmark' || k[0] === 'airport' || k[0] === 'park' ? 700 : BUFFER)) return;
        const key = k[0] + '|' + name + '|' + Math.round(x / 15) + '|' + Math.round(z / 15);
        if (poiSeen.has(key)) return; poiSeen.add(key);
        if (bIdx < 0) bGrid.query(x, z, 1, (o) => { if (bIdx < 0 && solidAt(x, z, o.ring, o.holes)) bIdx = buildings.indexOf(o); });
        pois.push({ kind: k[0], sub: k[1], x, z, name: st.name, brand: st.brand, op: t.operator || '', cuisine: t.cuisine || '', bIdx, osm, inside: (t.level != null && !/^0(;0)*$/.test(String(t.level))) || t.location === 'indoor' });
    };
    for (const [id, t] of ntags) { const p = pt(id); if (p) addPoi(t, p[0], p[1], -1, 'node/' + id); }
    for (const [wid, w] of W) {
        const t = w.tags; if (!poiKind(t)) continue;
        if (w.nodes.length < 3) continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        const c = polyCentroid(pts);
        addPoi(t, c[0], c[1], -1, 'way/' + wid);
    }
    // ---- verified businesses (research R12.2: game/research/businesses-<city>-<district>.json, businesses-gamediff.json):
    //      locator-confirmed stores missing from OSM are added, stale ones (not in the official locator, unverified) dropped,
    //      disused units on the routes listed as `vacant`, sign colours + logo text into `brands`
    const vacant = [];
    let bizAdded = 0, bizDropped = 0;
    if (ds) {
        const rf = path.join(REPO, 'game', 'research', `businesses-${cityId}-${did}.json`);
        let E = []; try { if (fs.existsSync(rf)) E = JSON.parse(fs.readFileSync(rf, 'utf8')); } catch (e) { log('businesses: cannot parse', rf, e.message); }
        const KIND = (c) => /^(fast_food|cafe|restaurant|bar|pub|ice_cream|food_court)$/.test(c) ? 'food' : c === 'bank' ? 'bank' : c === 'pharmacy' ? 'pharmacy' : c === 'fuel' ? 'fuel' : /^(hotel|hostel|motel)$/.test(c) ? 'hotel' : 'shop';
        const drop = new Set();
        for (const e of E) {
            const stale = e.flag === 'not in official locator' || /^Microsoft Store$/i.test(e.name || '');
            if (stale) {
                const [x, z] = P(e.lat, e.lon);
                pois.forEach((p, i) => { if ((e.osm && p.osm === e.osm) || (Math.hypot(p.x - x, p.z - z) < 35 && (p.brand || p.name) && ((p.brand || p.name) === (e.brand || e.name)))) drop.add(i); });
                continue;
            }
            if (!e.osm && e.lat && e.confidence !== 'low') { // official-locator store not mapped in OSM
                const [x, z] = P(e.lat, e.lon); const brand = e.brand || '';
                if (M(x, z) > 0) continue;
                if (pois.some(p => Math.hypot(p.x - x, p.z - z) < 80 && brand && (p.brand === brand || p.name === brand))) continue;
                let bIdx = -1; bGrid.query(x, z, 1, (o) => { if (bIdx < 0 && solidAt(x, z, o.ring, o.holes)) bIdx = buildings.indexOf(o); });
                if (bIdx < 0) { let bd = 40; bGrid.query(x, z, 40, (o) => { const d = Math.hypot(o.c[0] - x, o.c[1] - z); if (d < bd && o.area > 150) { bd = d; bIdx = buildings.indexOf(o); } }); }
                pois.push({ kind: KIND(e.category || ''), sub: e.category || 'shop', x, z, name: e.name || brand, brand, op: '', cuisine: '', bIdx, osm: 'locator', inside: false });
                bizAdded++;
            }
            const sg = e.sign || {}; const key = (e.brand || '').toLowerCase().trim();
            if (key && /^#[0-9a-f]{6}$/i.test(sg.bg || '') && /^#[0-9a-f]{6}$/i.test(sg.fg || '')) {
                const acc = /^#[0-9a-f]{6}$/i.test(sg.accent || '') ? sg.accent : sg.fg;
                researchBrands[key] = sg.logoText && sg.logoText.toLowerCase() !== key ? [sg.bg, sg.fg, acc, sg.logoText] : [sg.bg, sg.fg, acc];
            }
        }
        // the old district dossier gave Inglot (cosmetics, black/white) the ING orange
        if (researchBrands.inglot && /^#ff6200$/i.test(researchBrands.inglot[0])) researchBrands.inglot = ['#000000', '#FFFFFF', '#FFFFFF'];
        for (const i of [...drop].sort((a, b) => b - a)) { pois.splice(i, 1); bizDropped++; }
        try {
            const gd = JSON.parse(fs.readFileSync(path.join(REPO, 'game', 'research', 'businesses-gamediff.json'), 'utf8'))[`${cityId}-${did}`];
            for (const c of gd?.closed || []) { const [x, z] = P(c.lat, c.lon); if (M(x, z) > 0) continue; let bIdx = -1; bGrid.query(x, z, 1, (o) => { if (bIdx < 0 && solidAt(x, z, o.ring, o.holes)) bIdx = buildings.indexOf(o); }); vacant.push(Math.round(x * 10), Math.round(z * 10), bIdx); }
        } catch { /* no gamediff */ }
        log(`businesses: +${bizAdded} locator-only, −${bizDropped} stale, ${vacant.length / 3} vacant units`);
    }
    // businesses/names attached to buildings → facade signs
    for (const p of pois) {
        if (p.bIdx < 0) continue;
        const b = buildings[p.bIdx];
        if (['busstop', 'metro'].includes(p.kind)) continue;
        if (p.sub === 'atm' || p.inside) continue; // ATMs are not branches; shops inside malls / upper floors get no street sign
        if (!b.signName) { b.signName = p.brand || p.name; b.signBrand = !!p.brand; }
        // (2026-11-08) a street-level business in a block / villa = a ground-floor shop unit (world.js: street faces only)
        if (ds && /^(food|shop|bank|pharmacy)$/.test(p.kind) && !(b.flags & 32) && /^(interwar|eclectic|civic|bloc|plain)$/.test(b.style) && b.h > 6) b.flags |= 1;
    }
    log('pois', pois.length);

    // ---- trees (natural=tree nodes + tree_row ways) and street furniture, inside the corridors, off the carriageway
    const onCarriageway = (x, z, extra) => !!nearestRoad(x, z, 25, null) && (() => { let bad = false; roadGrid.query(x, z, 20, (s) => { if (bad || (s.r.flags & 4)) return; const q = distPointSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1]; const right = (x - s.a[0]) * (-dz) + (z - s.a[1]) * dx > 0; if (q.d < (right ? s.wR : s.wL) + extra) bad = true; }); return bad; })();
    const CONIFER = /^(Pinus|Picea|Abies|Thuja|Pseudotsuga|Cedrus|Taxus|Juniperus|Tsuga|Larix|Sequoia|Chamaecyparis|Cupressus)/i;
    // Preserve complete OSM railway ways which touch the required source ring; rendering remains data-gated.
    const rawRailways = [];
    if (ds) for (const [id, w] of W) {
        const t = w.tags; if (!['rail', 'narrow_gauge', 'light_rail', 'disused', 'abandoned'].includes(t.railway)) continue;
        const pts = w.nodes.map(pt); if (pts.length < 2 || pts.some(p => !p)) continue;
        if (!pts.slice(1).some((p, i) => footprintMargin([pts[i], p], cor) <= OUTER_RING)) continue;
        rawRailways.push({ id: 'w' + id, nodeIds: [...w.nodes], tags: Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('__'))), pts });
    }
    const railGrid = new Grid(40);
    for (const r of rawRailways) if (r.tags.railway === 'rail' && !(r.tags.tunnel && r.tags.tunnel !== 'no') && !(r.tags.bridge && r.tags.bridge !== 'no') && (r.tags.layer == null || num(r.tags.layer) === 0)) for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1], b = r.pts[i]; railGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { a, b });
    }
    const onMappedRail = (x, z) => { let hit = false; railGrid.query(x, z, 1.3, r => { if (distPointSeg(x, z, ...r.a, ...r.b).d < 1.3) hit = true; }); return hit; };
    const outTrees = [], outTreeInfo = [], outTreeCrownRadii = []; const treeSeen = new Set();
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
        outTreeCrownRadii.push(Math.max(0, Math.round((num(t.diameter_crown || t['crown:diameter']) || 0) * 5)));
    };
    for (const [id, t] of ntags) if (t.natural === 'tree') { const p = pt(id); if (p) addTree(p[0], p[1], t); }
    for (const w of W.values()) {
        if (w.tags.natural !== 'tree_row') continue;
        const pts = w.nodes.map(pt); if (pts.some(p => !p)) continue;
        for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 7) addTree(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, w.tags, true); }
    }
    // (2026-11-08) tree crowns measured on aerial imagery (tools/aerial/trees.py → game/research/trees-<city>-<district>.json):
    // OSM maps almost no single trees in Bucharest's residential quarters, so the playable area and the scenery ring
    // get their real canopy. Mapped OSM trees win (dedup), trunks stay off carriageways, scenery streets, buildings,
    // pitches, parking lots and water. treeInfo leaf bits: 1 broadleaved + 4 deciduous (the local default) + 32 aerial.
    let treeCoverage = null, treeRetention = null;
    if (ds) {
        const tf = path.join(REPO, 'game', 'research', `trees-${cityId}-${did}.json`);
        let tj = null; if (fs.existsSync(tf)) { try { tj = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch (e) { log('aerial trees: cannot parse', tf, e.message); } }
        const bb = tj?._coverage; // older surveys do not record optional --bbox clipping, so their coverage is unknown
        if (Array.isArray(bb) && bb.length === 4 && bb.every(Number.isFinite) && bb[0] < bb[2] && bb[1] < bb[3]) treeCoverage = bb;
        if (tj?.trees?.length) {
            const scGrid = new Grid(40);
            for (const { r, pts } of scenery) { const hw = (r.oneway ? r.lf * r.laneW : r.median + (r.lf + r.lb) * r.laneW) / 2; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; scGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { a, b, hw }); } }
            const onScenery = (x, z) => { let bad = false; scGrid.query(x, z, 12, (q) => { if (!bad && distPointSeg(x, z, q.a[0], q.a[1], q.b[0], q.b[1]).d < q.hw + 0.6) bad = true; }); return bad; };
            const noTreeAreas = areaRings.filter(a => /^(pitch|parking|water|apron|runway|clay|turf|hard|pool|track)$/.test(a.kind));
            const naGrid = new Grid(100); for (const a of noTreeAreas) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of a.rings[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } naGrid.insertBox(x0, z0, x1, z1, a); }
            const inNoTree = (x, z) => { let f = false; naGrid.query(x, z, 0, (a) => { if (!f && pointInPolygon(x, z, a.rings[0])) f = true; }); return f; };
            const inBuilding = (x, z) => { let f = false; bGrid.query(x, z, 0, (o) => { if (!f && solidAt(x, z, o.ring, o.holes)) f = true; }); return f; };
            const retainAll = tj._retention === 'all-measured';
            const RINGT = OUTER_RING + 40; let added = 0, skipped = 0, thinned = 0, outside = 0;
            for (const [lat, lon, cr] of tj.trees) {
                const [x, z] = P(lat, lon), mg = M(x, z);
                if (mg > RINGT) { outside++; continue; }
                // Legacy surveys keep their old policy; explicitly reviewed surveys retain every valid measured crown.
                if (!retainAll && mg > 0 && (cr < (mg > 100 ? 3.0 : 2.2) || (mg > 100 && hash01(lat * 1e7 + lon) > 0.6))) { thinned++; continue; }
                if (onCarriageway(x, z, 0.9) || onScenery(x, z) || onMappedRail(x, z) || inNoTree(x, z) || inBuilding(x, z)) { skipped++; continue; }
                const key = Math.round(x / 1.5) + ',' + Math.round(z / 1.5); if (treeSeen.has(key)) { skipped++; continue; } treeSeen.add(key);
                const h = Math.max(5, Math.min(22, 2.3 * cr + 2.5));
                outTrees.push(Math.round(x * 10), Math.round(z * 10), Math.round(h * 10) * 2);
                outTreeInfo.push(-1, 0, 1 + 4 + 32); outTreeCrownRadii.push(Math.round(cr * 10)); added++;
            }
            treeRetention = { policy: retainAll ? 'all-measured' : 'legacy-ring-thinning', inputCrowns: tj.trees.length, retained: added, rejectedGeometryOrDuplicate: skipped, outsideSurveyDistrict: outside, thinned };
            log(`aerial trees: ${added} added (${skipped} on streets / buildings / pitches / duplicates, ${thinned} small ring crowns thinned) from ${tf}`);
        }
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
    // Finalize profiles after the estimate sanity pass, before any body/cache serialization.
    // A height tag (including a documented research estimate) denotes the total; levels estimate the wall body.
    const outBuildingRoofProfiles = {};
    if (ds) for (const [i, b] of buildings.entries()) {
        const t = b.t || {};
        if (t.historic === 'aircraft' || t.aeroway === 'aircraft') continue;
        const literal = parseMeasure(t.height) > 0, osmHeight = parseMeasure((t.__originalDimensions || t).height) > 0;
        const heightSource = osmHeight ? 'OSM height' : t.__hRes === 1 ? (literal ? 'research height' : 'research storeys estimate') : t.__hRes === 2 ? 'research estimate' : num(t['building:levels']) > 0 ? 'OSM building:levels estimate' : 'style estimate';
        b.roofProfile = makeRoofProfile({ tags: t, ring: b.ring, holes: b.holes, triangulate: triangulateSourceRoof, shape: ROOFS[b.roof], height: b.h, minHeight: b.minH, heightSource, heightIsTotal: literal });
        b.h = b.roofProfile.totalM;
        outBuildingRoofProfiles[i] = b.roofProfile;
    }
    for (const b of buildings) {
        const t = b.t || {};
        outBInfo.push(S(t.building && t.building !== 'yes' ? t.building : ''), yearOf(t.start_date || t['building:start_date'] || t.construction_date), S(t.architect || ''), S((t['building:material'] || t['building:facade:material'] || '').split(';')[0]), b.hSrc ?? 0);
    }
    const outBuildingCanopies = Object.fromEntries(buildings.flatMap((b, i) => b.canopy ? [[i, { ...b.canopy, topM: b.h, clearanceM: b.minH }]] : []));
    const mappedPassages = ds ? sourcePassages(buildings, W, N, P, roads, reviewedBuildingPassages) : { records: {}, issues: [] };
    const outBuildingSourceIssues = Object.fromEntries(buildings.flatMap((b, i) => b.sourceIssues?.length ? [[i, b.sourceIssues]] : []));
    const outBuildingSourceTags = Object.fromEntries(buildings.flatMap(b => b.t?.__sourceTags ? [[b.t.__id, b.t.__sourceTags]] : []));
    const outB = buildings.map(b => {
        let flags = b.flags;
        let name = b.name;
        // (2026-11-08) a building's own `name` is a sign only for what would carry one: not outside the playable area, not
        // an address used as a name ("Georges Bizet 10" was a shop fascia over the awnings), not a residential block's
        // name / number ("Bl. 8A", a villa's name), unless the building also hosts an amenity / shop / office / hotel
        const tt = b.t || {};
        const addrLike = (nm) => { const n2 = String(nm).toLowerCase().replace(/^(strada|str\.?|bulevardul|bd\.?|calea|șoseaua|sos\.?|intrarea|aleea|piața)\s+/, '').trim();
            const st = String(tt['addr:street'] || '').toLowerCase().replace(/^(strada|bulevardul|calea|șoseaua|intrarea|aleea|piața)\s+/, '').trim();
            return /^\D*\d+[a-z]?(\s*[-,]\s*\d+[a-z]?)?$/i.test(n2) && (!st || n2.startsWith(st.slice(0, 6)) || /^(nr\.?|no\.?)\s*\d/.test(n2)) || (tt['addr:housenumber'] && n2.endsWith(' ' + String(tt['addr:housenumber']).toLowerCase()) && st && n2.startsWith(st.slice(0, 5))); };
        const residential = /^(residential|apartments|house|detached|semidetached_house|terrace|villa|dormitory|yes)$/.test(tt.building || '') && !(tt.amenity || tt.shop || tt.office || tt.tourism || tt.healthcare || tt.leisure);
        const blockNo = /^(bl(oc)?\.?|block|scara|sc\.)\s*\S{1,5}$/i.test(String(name).trim());
        if (flags & 32) { /* scenery ring: no signs */ }
        else if (b.name && (/^(marketplace)$/.test(tt.amenity || '') || /^(mall|department_store)$/.test(tt.shop || '') || tt.building === 'marketplace')) flags |= 2; // (the market hall / mall keeps its own name as its sign; its shops get unit signs)
        else if (b.signName) { name = b.signName; flags |= 2; if (b.signBrand) flags |= 8; }
        else if (b.brand) { name = b.brand; flags |= 2 | 8; }
        else if (name && !addrLike(name) && !blockNo && !residential) flags |= 2;
        return [STYLES.indexOf(b.style), Math.round(b.h * 10), Math.round(Math.max(0, b.minH) * 10), b.roof, S(name), flags, b.levels || 0, S(b.colour), S(b.roofColour), ...delta(b.ring)];
    });
    const outBuildingFootprints = Object.fromEntries(buildings.flatMap((b, i) => {
        const quantized = b.ring.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
        return ds || (!simpleFootprint(quantized) && simpleFootprint(b.ring)) ? [[i, b.ring.map(p => p.map(v => +v.toFixed(4)))]] : [];
    }));
    const preparedRing = (b, i) => outBuildingFootprints[i] || b.ring.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    const outBuildingDimensions = Object.fromEntries(buildings.flatMap((b, i) => Math.abs(b.h - outB[i][1] / 10) > 1e-7 || Math.abs(b.minH - outB[i][2] / 10) > 1e-7 ? [[i, [+b.h.toFixed(4), +b.minH.toFixed(4)]]] : []));
    const outBuildingHoles = Object.fromEntries(buildings.flatMap((b, i) => b.holes?.length ? [[i, b.holes.map(delta)]] : []));
    const outBuildingHoleFootprints = ds ? Object.fromEntries(buildings.flatMap((b, i) => b.holes?.length ? [[i, b.holes.map(h => h.map(p => p.map(v => +v.toFixed(4))))]] : [])) : {};
    if (Object.keys(outBuildingHoles).length) log('building courtyards', Object.keys(outBuildingHoles).length, 'buildings,', Object.values(outBuildingHoles).reduce((n, hs) => n + hs.length, 0), 'inner rings');
    // A building outline plus a complete mapped part can describe the same body. Keep both source records for audits,
    // and identify only an unambiguous exact ground/full-height cover for runtime suppression of the duplicate facade.
    const outBuildingCoveredBy = {}, sourceGroups = new Map();
    const isPart = b => b.t?.['building:part'] && b.t['building:part'] !== 'no';
    const ground = b => b.minH === 0 && ['min_height', 'building:min_level', 'layer', 'level'].every(k => b.t?.[k] == null || /^[+-]?0(?:\.0+)?(?:\s*m)?$/.test(String(b.t[k]).trim()));
    const taggedPartHeight = b => b.hSrc === 0 && (parseMeasure(b.t.height) > 0 || (/^\d+$/.test(String(b.t['building:levels']).trim()) && num(b.t['building:levels']) > 0));
    const quantizedFootprint = b => footprintKey(b.ring.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)]), (b.holes || []).map(h => h.map(([x, z]) => [Math.round(x * 10), Math.round(z * 10)])));
    buildings.forEach((b, i) => { if (!b.sourceFootprint) return; let g = sourceGroups.get(b.sourceFootprint); if (!g) sourceGroups.set(b.sourceFootprint, g = []); g.push({ b, i }); });
    for (const group of sourceGroups.values()) {
        const bases = group.filter(({ b }) => !isPart(b)); if (bases.length !== 1) continue;
        const base = bases[0]; if (!ground(base.b)) continue;
        const q = quantizedFootprint(base.b);
        const parts = group.filter(({ b }) => isPart(b) && ground(b) && taggedPartHeight(b) && b.h >= base.b.h && quantizedFootprint(b) === q);
        if (parts.length === 1) outBuildingCoveredBy[base.i] = parts[0].i;
    }
    if (Object.keys(outBuildingCoveredBy).length) log('building outlines covered by exact ground parts', Object.keys(outBuildingCoveredBy).length);
    // Simple 3-D Buildings: the enclosing building is an aggregate outline when
    // mapped parts describe its body. Match against unmodified source geometry,
    // require unique containment and near-complete coverage, and retain every
    // uncovered strip as a separately audited source-derived ground envelope.
    const outBuildingAssemblies = {}, partParents = new Map();
    const simpleBases = buildings.map((b, i) => ({ b, i })).filter(({ b, i }) => !isPart(b) && ground(b) && !b.holes.length && !outBuildingCoveredBy[i]);
    const bounds = ring => [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))];
    for (let i = 0; i < buildings.length; i++) {
        const part = buildings[i]; if (!isPart(part) || !taggedPartHeight(part) || part.holes.length || !part.sourceRing) continue;
        if (['layer', 'level'].some(k => part.t[k] != null && num(part.t[k]) !== 0)) continue;
        const pb = bounds(part.sourceRing), candidates = [];
        for (const base of simpleBases) {
            const bb = bounds(base.b.sourceRing);
            if (pb[0] < bb[0] - 0.001 || pb[1] < bb[1] - 0.001 || pb[2] > bb[2] + 0.001 || pb[3] > bb[3] + 0.001) continue;
            const c = footprintCoverage(base.b.sourceRing, [part.sourceRing]);
            if (c.outside <= 0.1) candidates.push(base.i);
        }
        if (candidates.length === 1) partParents.set(i, candidates[0]);
    }
    for (const { b: base, i } of simpleBases) {
        const parts = [...partParents].filter(([, parent]) => parent === i).map(([p]) => p);
        const groundParts = parts.map(p => buildings[p]).filter(ground);
        if (!parts.length) continue;
        const source = footprintCoverage(base.sourceRing, parts.map(p => buildings[p].sourceRing));
        const groundCoverage = footprintCoverage(base.sourceRing, groundParts.map(p => p.sourceRing));
        const quant = b => preparedRing(b, buildings.indexOf(b));
        const prepared = footprintCoverage(quant(base), parts.map(p => quant(buildings[p])));
        if (prepared.outside > Math.max(0.5, prepared.area * 0.015)) continue;
        const complete = groundParts.length > 0 && source.uncovered <= source.area * 0.1 && prepared.uncovered <= prepared.area * 0.1 && (groundCoverage.uncovered <= groundCoverage.area * 0.1 || source.uncovered <= source.area * 0.0001);
        if (!complete && base.roof !== 0) continue;
        // Explicit parent metre heights remain authoritative. A storey/default
        // estimate is not a measured mass below/around the detailed source parts.
        const explicitHeight = base.hSrc <= 1 && isFinite(parseMeasure(base.t.height));
        const eaves = b => b.roofProfile?.eavesM ?? b.h;
        const residualHeight = explicitHeight || !groundParts.length ? eaves(base) : Math.min(...groundParts.map(eaves));
        outBuildingAssemblies[i] = { mode: complete ? 'parts' : 'union', parts, residualHeightDm: Math.round(residualHeight * 10), residualHeightM: +residualHeight.toFixed(4), residualHeightSource: source.uncovered <= source.area * 0.0001 ? 'adjacent-ground-part' : explicitHeight ? 'parent-height' : 'lowest-ground-part',
            sourceCoverage: +(1 - source.uncovered / source.area).toFixed(8), sourceOutsideArea: +source.outside.toFixed(6), preparedCoverage: +(1 - prepared.uncovered / prepared.area).toFixed(8) };
        const volume = p => ({ i: p, ring: preparedRing(buildings[p], p), holes: [], h: eaves(buildings[p]), minH: buildings[p].minH });
        outBuildingAssemblies[i].geometry = bakeAssembly(volume(i), parts.map(volume), residualHeight, source.uncovered <= source.area * 0.0001, !complete);
    }
    if (Object.keys(outBuildingAssemblies).length) log('building outline/part assemblies', Object.keys(outBuildingAssemblies).length);
    // Union physical surfaces independently of OSM containment. An ambiguous
    // part is retained as its own source solid, but must not draw a duplicate
    // coplanar face through the building it touches.
    const physical = buildings.map((b, i) => ({ i, ring: preparedRing(b, i), holes: b.holes, h: b.roofProfile?.eavesM ?? b.h, minH: b.minH, part: !!isPart(b), assembly: false }));
    for (const key of Object.keys(outBuildingCoveredBy)) physical[+key].suppressed = true;
    for (const [key, spec] of Object.entries(outBuildingAssemblies)) {
        const base = physical[+key]; base.suppressed = spec.mode === 'parts'; base.assembly = true;
        for (const i of spec.parts) physical[i].assembly = true;
        for (const r of spec.geometry.residuals) physical.push({ i: physical.length, ring: r.ring, holes: [], h: r.h, minH: 0, assembly: true });
    }
    const active = physical.filter(b => !b.suppressed && !b.holes.length), neighbours = new Map(active.map(b => [b.i, []])), spatial = new Map();
    for (const b of active) {
        const bb = bounds(b.ring), seen = new Set();
        for (let x = Math.floor(bb[0] / 40); x <= Math.floor(bb[2] / 40); x++) for (let z = Math.floor(bb[1] / 40); z <= Math.floor(bb[3] / 40); z++) {
            const key = x + ',' + z, cell = spatial.get(key) || [];
            for (const other of cell) if (!seen.has(other.i)) { seen.add(other.i); if (touchingSolids(b, other)) { neighbours.get(b.i).push(other); neighbours.get(other.i).push(b); } }
            cell.push(b); spatial.set(key, cell);
        }
    }
    const unionBodies = active.filter(b => neighbours.get(b.i).length && (b.part || b.assembly || neighbours.get(b.i).some(p => p.part || p.assembly)));
    const required = new Set(unionBodies.flatMap(b => [b.i, ...neighbours.get(b.i).map(p => p.i)]));
    const outBuildingUnions = { sources: active.filter(b => required.has(b.i)).map(b => ({ i: b.i, signature: assemblySignature(b, []) })),
        surfaces: unionBodies.map(b => ({ i: b.i, neighbours: neighbours.get(b.i).map(p => p.i), surface: bakeSurface(b, [b, ...neighbours.get(b.i)]) })) };
    if (unionBodies.length) log('physical source-solid unions', unionBodies.length, 'locally validated surfaces');
    // Reuse identical derived vertices without rounding. Source records and
    // signatures remain independently readable; only the offline cap meshes
    // use this lossless indexed representation.
    const geometryPoints = [], pointIndex = new Map();
    const packRing = ring => ring.map(p => { const key = p[0] + ',' + p[1]; if (!pointIndex.has(key)) { pointIndex.set(key, geometryPoints.length); geometryPoints.push(p); } return pointIndex.get(key); });
    const packSurface = s => { s.roof = s.roof.map(packRing); s.underside = s.underside.map(packRing); };
    for (const spec of Object.values(outBuildingAssemblies)) { spec.geometry.residuals.forEach(r => r.ring = packRing(r.ring)); spec.geometry.surfaces.forEach(packSurface); }
    outBuildingUnions.surfaces.forEach(s => packSurface(s.surface));

    // Roof visibility is clipped against the actual neighbouring roof planes, not a total-height box.
    // Only intersecting source roofs need a cache; the unchanged source profile remains authoritative for collision.
    const roofBodies = physical.filter(b => !b.suppressed && buildings[b.i]?.roofProfile).map(b => {
        const source = buildings[b.i], body = { ...source, i: b.i, ring: b.ring, holes: b.holes };
        body.mesh = roofMesh(body.ring, body.holes, body.roofProfile, triangulateSourceRoof);
        return body;
    });
    const roofGrid = new Grid(40), outBuildingRoofSurfaces = {};
    for (const b of roofBodies) {
        b.bounds = [Math.min(...b.ring.map(p => p[0])), Math.min(...b.ring.map(p => p[1])), Math.max(...b.ring.map(p => p[0])), Math.max(...b.ring.map(p => p[1]))];
        roofGrid.insertBox(...b.bounds, b);
    }
    for (const b of roofBodies) {
        const neighbours = [];
        roofGrid.query((b.bounds[0] + b.bounds[2]) / 2, (b.bounds[1] + b.bounds[3]) / 2, Math.hypot(b.bounds[2] - b.bounds[0], b.bounds[3] - b.bounds[1]) / 2, o => {
            if (o !== b && o.bounds[0] < b.bounds[2] - 1e-6 && o.bounds[2] > b.bounds[0] + 1e-6 && o.bounds[1] < b.bounds[3] - 1e-6 && o.bounds[3] > b.bounds[1] + 1e-6 && o.h >= b.minH && b.h >= o.minH && touchingSolids(b, o)) neighbours.push(o);
        });
        if (!neighbours.length) continue;
        const visible = visibleRoofMesh(b.mesh, b, neighbours);
        if (JSON.stringify(visible.faces) === JSON.stringify(b.mesh.faces) && !b.mesh.walls.length) continue;
        outBuildingRoofSurfaces[b.i] = { sources: [b, ...neighbours].map(o => ({ i: o.i, signature: roofSignature(o) })), ...visible };
    }
    const roofGeometryPoints = [], roofPointIndex = new Map();
    const packRoofFace = face => face.map(vertex => { const p = vertex.map(v => +v.toFixed(4)), key = p.join(','); if (!roofPointIndex.has(key)) { roofPointIndex.set(key, roofGeometryPoints.length); roofGeometryPoints.push(p); } return roofPointIndex.get(key); });
    for (const spec of Object.values(outBuildingRoofSurfaces)) { spec.faces = spec.faces.map(packRoofFace); spec.walls.forEach(w => w.vertices = packRoofFace(w.vertices)); }
    if (Object.keys(outBuildingRoofSurfaces).length) log('source roof surface unions', Object.keys(outBuildingRoofSurfaces).length);

    // scenery streets: [carriagewayWidthDm, sidewalkDm, classIdx, flags (1 bridge, 2 inside-the-area fragment), delta…]
    const outScenery = [], sceneryAccess = {}, scenerySourceGeometry = {};
    for (const { r, pts, inside } of scenery) {
        const sp = ds ? pts : pts.length > 2 ? simplifyIdx(pts, 0.5).map(i => pts[i]) : pts;
        const wC = r.oneway ? r.lf * r.laneW : r.median + (r.lf + r.lb) * r.laneW;
        sceneryAccess[outScenery.length] = { sourceId: 'w' + r.id, ...r.access };
        if (ds) scenerySourceGeometry[outScenery.length] = { ...sourceRoadGeometry(r), prepared: sp };
        outScenery.push([Math.round(wC * 10), Math.round(Math.min(r.sidewalk, 4) * 10), ROAD_CLASSES.indexOf(r.cls), ((r.flags & 2) ? 1 : 0) | (inside ? 2 : 0), ...delta(sp)]);
    }
    log('scenery streets', outScenery.length);
    // (2026-11-08) green ground measured on aerial imagery (tools/aerial/trees.py --ground-out → game/research/
    // green-<city>-<district>.json, a lat/lon raster): gardens, lawns and the ground under the crowns in the playable area
    // and the scenery ring, re-gridded in game metres → data.green {x0, z0, cx, cz, w, h, rle} (runs per row: off, on, …)
    let outGreen = null;
    if (ds) {
        const gf = path.join(REPO, 'game', 'research', `green-${cityId}-${did}.json`);
        let gj = null; if (fs.existsSync(gf)) { try { gj = JSON.parse(fs.readFileSync(gf, 'utf8')); } catch (e) { log('green ground: cannot parse', gf, e.message); } }
        if (gj?.rle) {
            const on = new Uint8Array(gj.w * gj.h); let i = 0, row = 0, col = 0, cur = 0;
            for (const v of gj.rle) { if (v < 0) { row++; col = 0; cur = 0; continue; } if (cur) for (let k = 0; k < v; k++) on[row * gj.w + col + k] = 1; col += v; cur ^= 1; i++; }
            const [xa, za] = P(gj.north, gj.west), [xb, zb] = P(gj.south, gj.east);
            const cx = (xb - xa) / gj.w, cz = (zb - za) / gj.h, RINGG = OUTER_RING + 40;
            // crop to the rows / columns that reach the playable area + ring
            let r0 = gj.h, r1 = -1, c0 = gj.w, c1 = -1;
            const keep = new Uint8Array(gj.w * gj.h);
            for (let r = 0; r < gj.h; r++) for (let c = 0; c < gj.w; c++) {
                if (!on[r * gj.w + c]) continue;
                const x = xa + (c + 0.5) * cx, z = za + (r + 0.5) * cz; if (M(x, z) > RINGG) continue;
                keep[r * gj.w + c] = 1; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
            }
            if (r1 >= 0) {
                const rle = []; let cells = 0;
                for (let r = r0; r <= r1; r++) { let cur2 = 0, n2 = 0; for (let c = c0; c <= c1; c++) { const v = keep[r * gj.w + c]; if (v === cur2) n2++; else { rle.push(n2); cur2 = v; n2 = 1; } cells += v; } rle.push(n2, -1); }
                outGreen = { x0: Math.round((xa + c0 * cx) * 100) / 100, z0: Math.round((za + r0 * cz) * 100) / 100, cx: Math.round(cx * 1000) / 1000, cz: Math.round(cz * 1000) / 1000, w: c1 - c0 + 1, h: r1 - r0 + 1, rle };
                log(`green ground: ${cells} cells of ${cx.toFixed(2)} × ${cz.toFixed(2)} m (${(cells * cx * cz / 1e6).toFixed(2)} km²) from ${gf}`);
            }
        }
    }
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
    const areaSourceTags = Object.fromEntries(areaRings.flatMap(a => {
        const tags = Object.fromEntries(['water', 'natural', 'waterway'].flatMap(k => a.sourceTags?.[k] != null ? [[k, a.sourceTags[k]]] : []));
        return a.sourceId && Object.keys(tags).length ? [[a.sourceId, tags]] : [];
    }));
    const parkingLayouts = {}, parkingLayoutAudit = [], parkingFootprints = Object.fromEntries(areaRings.flatMap((a,i) => a.sourceParkingRings ? [[i,a.sourceParkingRings]] : []));
    if (ds) {
        const file = path.join(REPO, 'game', 'research', `parking-layouts-${cityId}-${did}.json`);
        let measurements = {};
        try { if (fs.existsSync(file)) measurements = JSON.parse(fs.readFileSync(file, 'utf8')).lots || {}; } catch (e) { throw new Error(`Invalid parking layout research: ${e.message}`); }
        for (let i = 0; i < areaRings.length; i++) {
            const a = areaRings[i], record = measurements[a.sourceId];
            if (a.kind !== 'parking' || !record) continue;
            const result = resolveParkingLayout(record, a.sourceTags);
            parkingLayoutAudit.push({ sourceId: a.sourceId, areaIndex: i, applied: !!result.layout, reason: result.reason });
            if (result.layout) parkingLayouts[i] = { sourceId: a.sourceId, ...result.layout };
        }
    }
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
        strings, ...(Object.keys(outBuildingRoofSurfaces).length ? { buildingRoofSurfaces: outBuildingRoofSurfaces, buildingRoofGeometryPoints: roofGeometryPoints } : {}),
        nodes: outNodes, nodeFlags, roads: outRoads, trams: outT, roadInfo, rampLimits, vacant, buildings: outB, ...(ds ? { buildingRoofProfiles: outBuildingRoofProfiles } : {}), ...(Object.keys(outBuildingDimensions).length ? { buildingDimensions: outBuildingDimensions } : {}), ...(Object.keys(outBuildingFootprints).length ? { buildingFootprints: outBuildingFootprints } : {}), buildingInfo: outBInfo, ...(Object.keys(outBuildingSourceTags).length ? { buildingSourceTags: outBuildingSourceTags } : {}), ...(Object.keys(outBuildingCanopies).length ? { buildingCanopies: outBuildingCanopies } : {}), ...(Object.keys(outBuildingSourceIssues).length ? { buildingSourceIssues: outBuildingSourceIssues } : {}), ...(ds ? { buildingIds: buildings.map(b => b.t?.__id || '') } : {}), ...(Object.keys(outBuildingHoles).length ? { buildingHoles: outBuildingHoles } : {}), ...(Object.keys(outBuildingCoveredBy).length ? { buildingCoveredBy: outBuildingCoveredBy } : {}), ...(Object.keys(outBuildingAssemblies).length ? { buildingAssemblies: outBuildingAssemblies } : {}), ...(unionBodies.length ? { buildingUnions: outBuildingUnions } : {}), ...(geometryPoints.length ? { buildingGeometryPoints: geometryPoints } : {}), pois: outP, areas: outA, ...(ds ? { areaSourceIds: areaRings.map(a => a.sourceId || '') } : {}), ...(Object.keys(parkingFootprints).length ? { parkingFootprints } : {}), ...(Object.keys(parkingLayouts).length ? { parkingLayouts } : {}), ...(parkingLayoutAudit.length ? { parkingLayoutAudit } : {}), lines: outLines, ...(lineSources.length ? { lineSources } : {}), places, lamps,
        ...(rawRailways.length ? { railways: rawRailways.map(r => ({ id: r.id, nodeIds: r.nodeIds, tags: r.tags, points: delta(r.pts) })) } : {}),
        ...(ds && Object.keys(areaSourceTags).length ? { areaSourceTags } : {}),
        ...(outTreeCrownRadii.some(r => r > 0) ? { treeCrownRadii: outTreeCrownRadii } : {}), ...(treeRetention ? { treeRetention } : {}),
        trees: outTrees, treeInfo: outTreeInfo, furniture: outFurn, backdrop, ...(ds ? { scenery: outScenery } : {}), ...(outGreen ? { green: outGreen } : {}),
        ...(parking.length ? { parking } : {}), ...(treeCoverage ? { treeCoverage } : {}),
        corridor: { areaKm2: +cor.areaKm2.toFixed(2), legs: cor.legs.map(l => [l.label, l.km]) },
    };
    if (Object.keys(researchBrands).length) doc.brands = researchBrands;
    if (ds) {
        doc.buildingGeometryPolicy = 'source';
        doc.buildingSourceSkips = buildingSourceSkips;
        doc.buildingRoadConflicts = buildingRoadConflicts;
        const aircraft = Object.fromEntries(buildings.flatMap((b,i) => b.aircraft ? [[i,b.aircraft]] : []));
        if (Object.keys(aircraft).length) doc.buildingAircraft = aircraft;
        if (Object.keys(mappedPassages.records).length) doc.buildingPassages = mappedPassages.records;
        if (mappedPassages.issues.length) doc.buildingPassageIssues = mappedPassages.issues;
        if (Object.keys(outBuildingHoleFootprints).length) doc.buildingHoleFootprints = outBuildingHoleFootprints;
        if (Object.keys(sharedLanes).length) doc.sharedLanes = sharedLanes;
        doc.roadAccess = roadAccess;
        if(Object.keys(roadWidths).length)doc.roadWidths=roadWidths;
        if(roadWidthIssues.length)doc.roadWidthIssues=roadWidthIssues;
        doc.roadGeometryPolicy = 'source';
        doc.roadNodePositions = roadNodePositions;
        doc.roadNodeIds = roadNodeIds;
        doc.roadSourceGeometry = roadSourceGeometry;
        doc.scenerySourceGeometry = scenerySourceGeometry;
        doc.sceneryAccess = sceneryAccess;
    }
    if (ds) doc.streetTrees = streetTrees;
    if (turnLanes.length) doc.turnLanes = turnLanes;
    if (ds) { // district boundary (game metres): the polygons and the corridor field are the same margin() → sample its outline
        doc.district = { id: did, name: ds.district.name, bbox: ds.district.bbox, areaKm2: +cor.areaKm2.toFixed(2),
            geometry: { pieces: cor.pieces, circles: cor.circles, polys: cor.polys },
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
