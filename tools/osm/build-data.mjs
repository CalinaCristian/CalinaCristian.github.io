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
//               64 toll, 128 unpaved/cobbles, 256 tram in the median
//    trams: [delta, ...]                             railway=tram centre lines
//    buildings: [[style, heightDm, minHeightDm, roof, name, flags, ...delta ring], ...]
//        style index into `styles`, roof index into `roofs` (flat|pyramid|gabled|dome),
//        flags: 1 ground-floor shop band, 2 has a sign (name = sign text), 4 tall landmark-ish,
//               8 brand sign (name is a brand)
//    pois: [[kind, x, z, name, brand, sub, buildingIndex], ...]   sub = raw OSM value (e.g. fast_food)
//    areas: [[kind, name, outerDelta, holeDelta, ...], ...]
//    lines: [[kind, widthDm, name, delta], ...]     runways / taxiways / rivers drawn as ribbons
//    places: [[name, x, z, rank], ...]               rank 0 city, 1 suburb, 2 quarter, 3 neighbourhood
//    lamps: [x, z, heightDm, ...]                    highway=street_lamp nodes (height 0 = unknown)
//  }
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFiles, parseInto } from './parse-osm.mjs';
import { distPointSeg, pointInPolygon, polyArea, polyCentroid, simplifyIdx, simplifyRing, Grid, assembleRings } from './geom.mjs';

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
const ROOFS = ['flat', 'pyramid', 'gabled', 'dome'];
const POI_KINDS = ['office', 'school', 'airport', 'fuel', 'food', 'shop', 'bank', 'pharmacy', 'metro', 'busstop', 'hospital', 'landmark', 'park', 'hotel'];
const AREA_KINDS = ['water', 'park', 'grass', 'forest', 'scrub', 'pitch', 'cemetery', 'residential', 'industrial', 'commercial', 'retail', 'railway', 'parking', 'apron', 'runway', 'construction'];
const LINE_KINDS = ['runway', 'taxiway', 'river', 'canal', 'stream'];

const log = (...a) => console.log('[osm]', ...a);

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
function buildCity(cityId) {
    const C = CITIES[cityId];
    const files = fs.readdirSync(TILES).filter(f => f.endsWith('.xml') && C.prefixes.some(p => f.startsWith(p))).sort().map(f => path.join(TILES, f));
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

    // ---- push apart dual carriageways that overlap at this scale (opposite one-way ways)
    {
        const segGrid = new Grid(40);
        const big = roads.filter(r => r.oneway && /^(motorway|trunk|primary|secondary|tertiary)$/.test(r.cls));
        for (const r of big) for (let i = 0; i < r.nodes.length - 1; i++) {
            const a = pos.get(r.nodes[i]), b = pos.get(r.nodes[i + 1]);
            segGrid.insertBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), { r, i, a, b });
        }
        const disp = new Map();
        for (const r of big) {
            const nodeSet = new Set(r.nodes);
            const hwSelf = sideW(r)[0];
            for (let i = 0; i < r.nodes.length; i++) {
                const p = pos.get(r.nodes[i]);
                const pa = pos.get(r.nodes[Math.max(0, i - 1)]), pb = pos.get(r.nodes[Math.min(r.nodes.length - 1, i + 1)]);
                let dx = pb[0] - pa[0], dz = pb[1] - pa[1]; const L = Math.hypot(dx, dz); if (L < 1e-6) continue; dx /= L; dz /= L;
                let deficit = 0;
                segGrid.query(p[0], p[1], 30, (s) => {
                    if (s.r === r) return;
                    if (nodeSet.has(s.r.nodes[s.i]) || nodeSet.has(s.r.nodes[s.i + 1])) return;
                    let sx = s.b[0] - s.a[0], sz = s.b[1] - s.a[1]; const sl = Math.hypot(sx, sz); if (sl < 1e-6) return; sx /= sl; sz /= sl;
                    if (sx * dx + sz * dz > -0.8) return; // only opposite direction
                    const q = distPointSeg(p[0], p[1], s.a[0], s.a[1], s.b[0], s.b[1]);
                    if (q.t <= 0 || q.t >= 1) return;
                    // the other carriageway must be on our LEFT (right-hand traffic)
                    const side = (q.cx - p[0]) * (-dz) + (q.cz - p[1]) * dx; // >0 => right
                    if (side > 0) return;
                    const need = hwSelf + sideW(s.r)[0] + 0.8;
                    deficit = Math.max(deficit, need - q.d);
                });
                if (deficit > 0.05) {
                    const m = Math.min(deficit / 2, 6);
                    const prev = disp.get(r.nodes[i]) || [0, 0, 0];
                    prev[0] += -dz * m; prev[1] += dx * m; prev[2]++;
                    disp.set(r.nodes[i], prev);
                }
            }
        }
        for (const [n, d] of disp) { const p = pos.get(n); pos.set(n, [p[0] + d[0] / d[2], p[1] + d[1] / d[2]]); }
        log('dual carriageway nodes pushed apart:', disp.size);
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
        // keep when near the network (or big water/park/forest)
        let near = false;
        for (let i = 0; i < so.length && !near; i += Math.max(1, Math.floor(so.length / 40))) near = nearNetwork(so[i][0], so[i][1], kind === 'water' || kind === 'park' || kind === 'forest' ? 600 : 300);
        if (!near) { const c = polyCentroid(so); near = nearNetwork(c[0], c[1], 600); }
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
        if (!sp.some(p => nearNetwork(p[0], p[1], 600))) continue;
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
        const t = w.tags; if (!t.building || t.building === 'no' || t['building:part']) continue;
        if (w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
        if (bRelWays.has(id) && !t.name && Object.keys(t).length <= 1) continue;
        addRaw(w.nodes, t, false);
    }
    log('raw buildings', rawBuildings.length);

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
            if (/gabled|hipped|half-hipped|gambrel|mansard|saltbox/.test(rs) && realArea < 1500) roof = lls.length <= 6 ? 2 : 1;
            else if (/pyramidal|cone/.test(rs)) roof = 1;
            else if (/dome|onion/.test(rs)) roof = 3;
            else if (rs === 'flat') roof = 0;
        }
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
        const rec = { style, h, minH: Math.min(minH, h - 1), roof, name, brand, flags, ring, c: c2, area: Math.abs(polyArea(ring)), t };
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
        const radius = k[0] === 'landmark' || k[0] === 'airport' || k[0] === 'park' ? 700 : BUFFER;
        if (!nearNetwork(x, z, radius)) return;
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

    // street lamps (highway=street_lamp nodes near the network)
    const lamps = [];
    for (const [id, t] of ntags) {
        if (t.highway !== 'street_lamp') continue;
        const p = pt(id); if (!p || !nearNetwork(p[0], p[1], 60)) continue;
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
        if (!nearNetwork(p[0], p[1], 1500)) continue;
        places.push([S(t.name), Math.round(p[0] * 10), Math.round(p[1] * 10), rank[t.place]]);
    }

    // =======================================================================
    // OUTPUT
    // =======================================================================
    const outB = buildings.map(b => {
        let flags = b.flags;
        let name = b.name;
        if (b.signName) { name = b.signName; flags |= 2; if (b.signBrand) flags |= 8; }
        else if (b.brand) { name = b.brand; flags |= 2 | 8; }
        else if (name) flags |= 2;
        return [STYLES.indexOf(b.style), Math.round(b.h * 10), Math.round(Math.max(0, b.minH) * 10), b.roof, S(name), flags, ...delta(b.ring)];
    });
    const outP = pois.map(p => [POI_KINDS.indexOf(p.kind), Math.round(p.x * 10), Math.round(p.z * 10), S(p.name), S(p.brand), S(p.sub + (p.cuisine ? ':' + p.cuisine : '')), p.bIdx]);
    const outA = areaRings.map(a => [AREA_KINDS.indexOf(a.kind), S(a.name), ...a.rings.map(delta)]);
    const outT = tramLines.filter(pl => pl.some(p => nearNetwork(p[0], p[1], 100))).map(pl => delta(pl.filter((p, i) => i === 0 || i === pl.length - 1 || true)));
    const doc = {
        version: 1, city: cityId, generated: new Date().toISOString().slice(0, 10),
        attribution: '© OpenStreetMap contributors (ODbL)',
        proj: P.params, q: 10,
        bounds: [minX, minZ, maxX, maxZ],
        classes: ROAD_CLASSES, styles: STYLES, roofs: ROOFS, poiKinds: POI_KINDS, areaKinds: AREA_KINDS, lineKinds: LINE_KINDS,
        strings,
        nodes: outNodes, nodeFlags, roads: outRoads, trams: outT, buildings: outB, pois: outP, areas: outA, lines: outLines, places, lamps,
    };
    const outDir = path.join(REPO, 'game', 'data');
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${cityId}.json`);
    const json = JSON.stringify(doc);
    fs.writeFileSync(file, json);
    log(`wrote ${file}  ${(json.length / 1e6).toFixed(2)} MB  roads=${outRoads.length} buildings=${outB.length} pois=${outP.length} areas=${outA.length}`);
}

function ROOF_FOR_HOUSE(area, nverts) { return nverts <= 6 && area < 400 ? 2 : area < 300 ? 1 : 0; }

const which = args.city ? [args.city] : Object.keys(CITIES);
for (const c of which) buildCity(c);
