#!/usr/bin/env node
// ============================================================================
//  Spot data builder (spec 15) — research dossier + OSM extracts + USGS terrain
//  → one compact JSON per SCENE in game/data/spots/<scene>.json (local metres).
//
//  usage:  node game/src/spots/tools/build-data.mjs [sceneId ...]     (default: all scenes)
//
//  Inputs (read-only, owned by research-*):
//    game/research/<city>-spots.json            spots[] scene specs, dialogue, plaques
//    game/research/osm/<dir>/<spot>.json        buildings, ways, areas, trees, pois, furniture
//    game/research/osm/<dir>/<spot>.terrain.json 40 m elevation grid (NAVD88 / local datum)
//  Output frame: x = east, z = south (three.js: -z = north), y = up, metres; origin = scene origin
//  (lat/lon below), y = 0 at `origin.elev` (metres above the source datum).
//  Bucharest: add a SCENES entry with research: 'bucharest-spots.json', osmDir: 'buc-spots'.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { BUC_CACHE } from './fetch-buc.mjs';
import { parseMeasure } from '../../building-roofs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RES = path.join(ROOT, 'game/research');
const OUT = path.join(ROOT, 'game/data/spots');

/** scene → member spots (the first member gives the default spawn), origin, research file, OSM dir */
export const SCENES = {
    'fremont-troll': { members: ['fremont-troll'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'pike-place': { members: ['pike-place'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'seattle-center': { members: ['space-needle', 'chihuly', 'mopop'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles', origin: { lat: 47.6205063, lon: -122.3493043, elev: 40.5 }, name: 'Seattle Center' },
    'kerry-park': { members: ['kerry-park'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'waterfront': { members: ['waterfront'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles', origin: { lat: 47.6069, lon: -122.3416, elev: 0 } },
    'pioneer-square': { members: ['pioneer-square'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'ballard-locks': { members: ['ballard-locks'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'gas-works': { members: ['gas-works'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'bel-lincoln-square': { members: ['bel-lincoln-square'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'bel-downtown-park': { members: ['bel-downtown-park'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'bel-botanical-garden': { members: ['bel-botanical-garden'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    'bel-meydenbauer': { members: ['bel-meydenbauer'], research: 'seattle-spots.json', osmDir: 'sea-spots', tz: 'America/Los_Angeles' },
    // ---- Bucharest (research schema adapted by bucSpot(); OSM + terrain from tools/fetch-buc.mjs, cached outside git)
    'buc-parliament': { members: ['palace-parliament', 'peoples-salvation-cathedral'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', origin: { lat: 44.42735, lon: 26.0905 }, name: 'Dealul Arsenalului',
        spawns: { 'palace-parliament': [44.42741, 26.09205, 268], 'peoples-salvation-cathedral': [44.42528, 26.08135, 52] } },
    'buc-old-town': { members: ['old-town-lipscani', 'stavropoleos-cec'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', origin: { lat: 44.4313, lon: 26.0995 }, name: 'Centrul Vechi',
        spawns: { 'old-town-lipscani': [44.43218, 26.10100, 95], 'stavropoleos-cec': [44.43212, 26.09830, 140] } },
    'athenaeum-revolution': { members: ['athenaeum-revolution'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', spawns: { 'athenaeum-revolution': [44.44085, 26.09765, 315] } },
    'arcul-de-triumf': { members: ['arcul-de-triumf'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', spawns: { 'arcul-de-triumf': [44.46632, 26.07850, 340] } },
    'buc-herastrau': { members: ['herastrau-park', 'village-museum'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', origin: { lat: 44.4710, lon: 26.0800 }, name: 'Herăstrău',
        spawns: { 'herastrau-park': [44.46985, 26.08310, 0], 'village-museum': [44.47085, 26.07800, 40] } },
    'spring-palace': { members: ['spring-palace'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', spawns: { 'spring-palace': [44.46850, 26.09235, 320] } },
    'cismigiu': { members: ['cismigiu'], research: 'bucharest-spots.json', buc: true, tz: 'Europe/Bucharest', spawns: { 'cismigiu': [44.43700, 26.09120, 320] } },
};

// ---------------------------------------------------------------------------- Bucharest research schema → scene schema
/** short plaque titles (the research gives text + source only) */
const BUC_TITLES = {
    'palace-parliament': ['Size', 'Anca Petrescu', 'The heaviest building', 'What was lost', 'Romanian materials', 'Not for sale'],
    'old-town-lipscani': ['Lipscani = Leipzig', 'Guild streets', "Manuc's Inn (1808)", 'Curtea Veche, 1459', 'Curtea Veche church', 'Cărturești Carusel'],
    'stavropoleos-cec': ['Stavropoleos (1724)', 'Byzantine chant', "Caru' cu Bere", 'CEC Palace', 'National History Museum'],
    'athenaeum-revolution': ['One leu for the Athenaeum', 'The great fresco', 'The 1919 vote', '21 December 1989', 'Memorial of Rebirth', 'Carol I statue'],
    'arcul-de-triumf': ['Dimensions', '1922 → 1936', 'Architect and sculptors', 'The royal medallions', 'Earlier arches'],
    'village-museum': ['Opened 1936', 'A whole country', '56 railway wagons', 'Dragomirești church', 'The 2002 fire', 'Visitors'],
    'herastrau-park': ['187 hectares', 'From marsh to park', 'Many names', 'Why "Herăstrău"', 'Mammoths'],
    'spring-palace': ['24 years, 174 rooms', 'Open since 2016', 'Gold taps, mosaic pool', 'The peacocks'],
    'cismigiu': ['The oldest garden', 'The name', 'Skating since 1883', "Writers' Rotunda", 'Swans and pelicans'],
    'peoples-salvation-cathedral': ['127 metres', 'Murano mosaics', 'The great bell', 'Consecrated', 'The piazza'],
};
const LOOK_OF = { tour_guide: 'tour_guide', guard: 'guard', vendor: 'vendor', waiter: 'waiter', busker: 'busker', kid: 'kid' };
/** time / weather / season tags from the line text (both languages) */
function lineTags(t) {
    const s = t.toLowerCase(), o = {};
    if (/bună dimineața|good morning|this morning|azi-dimineaț|în dimineața|breakfast|mic dejun/.test(s)) o.when = 'morning';
    else if (/bună seara|good evening|\bseara\b|diseară|tonight|evening|\bnight\b|noaptea|noapte bună|at night|lit up|floodlit|luminat[ăe]? noaptea/.test(s)) o.when = 'evening';
    else if (/bună ziua|good day|ziua bună/.test(s)) o.when = 'day';
    if (/crăciun|christmas|colind|carol(s|ing)\b|vin fiert|mulled|decembrie|december market|târgul de crăciun/.test(s)) o.season = 'xmas';
    else if (/mărțișor|1 martie|first of march/.test(s)) o.season = 'march';
    else if (/sakura|cherry blossom|flori de cireș|cireșii|blossom/.test(s)) o.season = 'spring';
    else if (/toamn|autumn|frunze(le)? (galbene|cad)|golden leaves|falling leaves/.test(s)) o.season = 'autumn';
    else if (/patinoar|patin|skating|\brink\b|iarna|winter/.test(s)) o.season = 'winter';
    else if (/\bvara\b|vara asta|summer|înghețat|ice cream|bărci|rowing boat|barca|boats/.test(s)) o.season = 'summer';
    if (/zăpad|ninge|\bsnow|bulgăr/.test(s)) o.wx = 'snow';
    else if (/plou|\brain\b|\brainy\b|ud leoarcă|soaked/.test(s)) o.wx = 'rain';
    else if (/caniculă|ce cald|cald azi|e cald|e prea cald|heatwave|so hot|too hot|it's hot|sun cream|la umbră|transpir|sweat/.test(s)) o.wx = 'hot';
    else if (/\bger\b|ce ger|e frig|\bfrig\b|freezing|so cold|it's cold|mănuși|gloves/.test(s)) o.wx = 'cold';
    return o;
}
function bucDialogue(spot, general) {
    const lines = [], personas = new Set();
    const push = (p, ctx, l, lang) => {
        const en = l.en || l.text, orig = lang && lang !== 'en' && l.text !== en ? l.text : null;
        lines.push({ p, ctx, text: en, ...(orig ? { orig, lang } : {}), ...lineTags((l.text || '') + ' ' + en) });
    };
    for (const per of spot.dialogue?.personas || []) {
        const p = LOOK_OF[per.base] || per.base; personas.add(p);
        for (const [ctx, L] of Object.entries(per.lines || {})) for (const l of L) push(p, ctx, l, per.lang);
    }
    for (const l of spot.dialogue?.ambient_pairs || []) push('local_young', 'spot', l, 'ro');
    void general;
    return { lines, personas: [...personas] };
}
function bucGeneral(research) {
    const dg = research.dialogue_general || {}, lines = [];
    const push = (p, ctx, l, lang) => { const en = l.en || l.text, orig = lang && lang !== 'en' && l.text !== en ? l.text : null; lines.push({ p, ctx, text: en, ...(orig ? { orig, lang } : {}), ...lineTags((l.text || '') + ' ' + en) }); };
    for (const [id, per] of Object.entries(dg.persona_library || {})) for (const ctx of ['greeting', 'bumped', 'photographed', 'idle']) for (const l of per[ctx] || []) push(LOOK_OF[id] || id, ctx, l, per.lang);
    const pg = dg.pedestrian_general || {};
    for (const l of pg.idle || []) push('local_elder', 'idle', l, 'ro');
    for (const l of pg.small_talk || []) push('local_young', 'spot', l, 'ro');
    return { lines, culture: dg.culture_notes || null };
}
/** a Bucharest research spot in the Seattle research shape (spawn, extent, photo.iconic, plaques with titles) */
function bucSpot(s, cfg) {
    const sp = cfg.spawns?.[s.id] || [s.center.lat, s.center.lon, 0];
    const pa = s.photo_angle || {};
    const pers = s.crowd?.personas || [];
    return {
        ...s, city: 'bucharest',
        spawn: { lat: sp[0], lon: sp[1], heading_deg: sp[2], ground_elev_m: null },
        extent: { description: s.footprint?.note || '', polygon_latlon: s.footprint?.polygon_latlon || [] },
        photo: { iconic: pa.position ? { from: pa.position, heading_deg: pa.heading_deg, pitch_deg: pa.pitch_deg, fov_deg: pa.fov_deg, frame: pa.note, interior: !!pa.interior } : null },
        plaques: (s.plaques || []).map((p, i) => ({ title: BUC_TITLES[s.id]?.[i] || s.name, text: p.text, source_url: p.source, source: p.source })),
        crowdPersonas: pers,
        sounds: s.ambient_sounds, furniture: s.street_furniture, seasonal: s.seasonal_time_of_day,
    };
}

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

function projector(lat0, lon0) {
    const p = lat0 * Math.PI / 180;
    const mLat = 111132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
    const mLon = 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p);
    return {
        mLat, mLon,
        xy: (lat, lon) => [r1((lon - lon0) * mLon), r1(-(lat - lat0) * mLat)],
        ll: (x, z) => [lat0 - z / mLat, lon0 + x / mLon],
    };
}

function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; }
function inPoly(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
/** drop the closing duplicate vertex and near-duplicate points */
function cleanPoly(p) {
    const o = [];
    for (const q of p) { const l = o[o.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.15) o.push(q); }
    if (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 0.15) o.pop();
    return o;
}
const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

function buildScene(sceneId) {
    const cfg = SCENES[sceneId];
    const research = JSON.parse(fs.readFileSync(path.join(RES, cfg.research), 'utf8'));
    let spots = cfg.members.map((id) => { const s = research.spots.find((x) => x.id === id); if (!s) throw new Error('no research spot ' + id); return s; });
    if (cfg.buc) spots = spots.map((s) => bucSpot(s, cfg));
    const first = spots[0];
    const srcFile = (s, ext) => cfg.buc ? path.join(BUC_CACHE, sceneId + ext) : path.join(RES, 'osm', cfg.osmDir, s.id + ext);
    if (cfg.buc && !(fs.existsSync(srcFile(first, '.json')) && fs.existsSync(srcFile(first, '.terrain.json')))) {
        execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'fetch-buc.mjs'), sceneId], { stdio: 'inherit', env: { NODE_USE_ENV_PROXY: '1', NODE_EXTRA_CA_CERTS: '/root/.ccr/ca-bundle.crt', ...process.env } });
    }
    const origin = { ...(cfg.origin || { lat: first.spawn.lat, lon: first.spawn.lon, elev: first.spawn.ground_elev_m == null ? undefined : Math.round(first.spawn.ground_elev_m * 10) / 10 }) };
    if (origin.elev === undefined || origin.elev === null || Number.isNaN(origin.elev)) { // Bucharest: ground at the origin from the terrain grid
        const t = JSON.parse(fs.readFileSync(srcFile(first, '.terrain.json'), 'utf8'));
        const Q = projector(t.origin_latlon_sw[0], t.origin_latlon_sw[1]), [ox, oz] = Q.xy(origin.lat, origin.lon);
        const fx = Math.max(0, Math.min(t.nx - 1.001, ox / t.spacing_m)), fy = Math.max(0, Math.min(t.ny - 1.001, -oz / t.spacing_m)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, e = t.elev_m;
        origin.elev = Math.round((e[j][i] * (1 - u) * (1 - v) + e[j][i + 1] * u * (1 - v) + e[j + 1][i] * (1 - u) * v + e[j + 1][i + 1] * u * v) * 10) / 10;
    }
    const P = projector(origin.lat, origin.lon);
    const Y = (e) => (e === null || e === undefined ? null : r2(e - origin.elev));

    // ---------------- OSM (union of the member extracts, deduped by id)
    const seen = new Set();
    const out = { buildings: [], ways: [], areas: [], trees: [], pois: [], furniture: {} };
    const terrains = [];
    for (const s of (cfg.buc ? [first] : spots)) {
        const osm = JSON.parse(fs.readFileSync(srcFile(s, '.json'), 'utf8'));
        const tf = srcFile(s, '.terrain.json');
        if (fs.existsSync(tf)) terrains.push(JSON.parse(fs.readFileSync(tf, 'utf8')));
        for (const [list, backdrop] of [[osm.buildings, false], [osm.backdrop_buildings, true]]) for (const b of list || []) {
            if (seen.has(b.id)) continue; seen.add(b.id);
            const poly = cleanPoly(b.footprint.map(([la, lo]) => P.xy(la, lo)));
            if (poly.length < 3 || Math.abs(polyArea(poly)) < 2) continue;
            const lv = num(b['building:levels']);
            const o = {
                id: b.id, poly, h: parseMeasure(b.height_m ?? b.height), lv, minH: parseMeasure(b.min_height), minLv: num(b['building:min_level']),
                k: b.building || (b['building:part'] ? 'part' : 'yes'), part: !!b['building:part'],
                roof: b['roof:shape'] || null, roofH: parseMeasure(b['roof:height']), rc: b['roof:colour'] || null, c: b['building:colour'] || null,
                mat: b['building:material'] || null, name: b.name || null, backdrop,
            };
            const roofTags = Object.fromEntries(Object.entries(b).filter(([k]) => k.startsWith('roof:')));
            if (Object.keys(roofTags).length) o.roofTags = roofTags;
            if (b.amenity) o.amenity = b.amenity; if (b.shop) o.shop = b.shop; if (b.tourism) o.tourism = b.tourism;
            if (b.layer) o.layer = num(b.layer);
            if (b.holes) o.holes = b.holes.map((h) => cleanPoly(h.map(([la, lo]) => P.xy(la, lo))));
            if (b.historic) o.historic = b.historic; if (b.religion) o.religion = b.religion;
            if (b['addr:street']) o.addr = `${b['addr:housenumber'] || ''} ${b['addr:street']}`.trim();
            for (const k of Object.keys(o)) if (o[k] === null || o[k] === false) delete o[k];
            out.buildings.push(o);
        }
        for (const w of osm.ways || []) {
            if (seen.has(w.id)) continue; seen.add(w.id);
            const pts = w.line.map(([la, lo]) => P.xy(la, lo));
            const o = { id: w.id, k: w.highway || w.railway || w.barrier || w.man_made || 'line', pts };
            const keep = ['name', 'footway', 'surface', 'lanes', 'oneway', 'bridge', 'tunnel', 'layer', 'width', 'service', 'crossing', 'incline', 'step_count', 'covered', 'area', 'sidewalk', 'sidewalk:both', 'cycleway', 'access', 'level', 'indoor', 'height', 'material', 'fence_type', 'natural', 'tram', 'junction'];
            for (const k of keep) if (w[k] !== undefined) o[k.replace(':', '_')] = w[k];
            out.ways.push(o);
        }
        for (const a of osm.areas || []) {
            if (seen.has(a.id)) continue; seen.add(a.id);
            const poly = cleanPoly(a.outline.map(([la, lo]) => P.xy(la, lo)));
            if (poly.length < 3) continue;
            const o = { id: a.id, poly };
            const keep = ['landuse', 'leisure', 'natural', 'amenity', 'man_made', 'barrier', 'waterway', 'water', 'surface', 'name', 'area:highway', 'layer', 'level', 'indoor', 'leaf_type', 'parking', 'railway', 'fence_type', 'height', 'highway', 'place', 'building', 'tourism'];
            for (const k of keep) if (a[k] !== undefined) o[k.replace(':', '_')] = a[k];
            if (a.holes) o.holes = a.holes.map((h) => cleanPoly(h.map(([la, lo]) => P.xy(la, lo))));
            out.areas.push(o);
        }
        for (const t of osm.trees || []) {
            const key = 't' + t[0] + ',' + t[1]; if (seen.has(key)) continue; seen.add(key);
            const [x, z] = P.xy(t[0], t[1]); out.trees.push([x, z, t[2] || '', t[3] || '', t[4] || '']);
        }
        for (const p of osm.pois || []) {
            if (seen.has(p.id)) continue; seen.add(p.id);
            const [x, z] = P.xy(p.ll[0], p.ll[1]);
            const o = { id: p.id, x, z };
            for (const [k, v] of Object.entries(p)) if (!['id', 'll', 'wheelchair', 'brand:wikidata', 'wikidata', 'addr:postcode', 'addr:city', 'addr:state', 'check_date', 'source', 'opening_hours'].includes(k)) o[k] = v;
            out.pois.push(o);
        }
        for (const [k, list] of Object.entries(osm.furniture || {})) {
            const L = out.furniture[k] || (out.furniture[k] = []);
            for (const ll of list) { const key = k + ll[0] + ',' + ll[1]; if (seen.has(key)) continue; seen.add(key); L.push(P.xy(ll[0], ll[1])); }
        }
    }
    // building outlines that are fully described by their parts → skip at render time (no z-fighting)
    const parts = out.buildings.filter((b) => b.part);
    for (const b of out.buildings) {
        if (b.part) continue;
        const A = Math.abs(polyArea(b.poly)); let a = 0;
        for (const p of parts) { const c = centroid(p.poly); if (inPoly(c[0], c[1], b.poly)) a += Math.abs(polyArea(p.poly)); }
        if (a > 0.45 * A) b.hasParts = true;
    }

    // ---------------- terrain: union of the member grids resampled at 20 m (local frame)
    let terrain = null;
    if (terrains.length) {
        const grids = terrains.map((t) => {
            const [la0, lo0] = t.origin_latlon_sw; const [x0, zS] = P.xy(la0, lo0);
            return { x0, zS, d: t.spacing_m, nx: t.nx, ny: t.ny, e: t.elev_m }; // row j = south→north: z = zS - j*d
        });
        const sample = (g, x, z) => {
            const fx = (x - g.x0) / g.d, fy = (g.zS - z) / g.d;
            const inside = fx >= -0.01 && fy >= -0.01 && fx <= g.nx - 0.99 && fy <= g.ny - 0.99;
            const cx = Math.max(0, Math.min(g.nx - 1.0001, fx)), cy = Math.max(0, Math.min(g.ny - 1.0001, fy));
            const i = Math.floor(cx), j = Math.floor(cy), u = cx - i, v = cy - j;
            const e = g.e, h = e[j][i] * (1 - u) * (1 - v) + e[j][i + 1] * u * (1 - v) + e[j + 1][i] * (1 - u) * v + e[j + 1][i + 1] * u * v;
            const dOut = Math.hypot(Math.max(0, -fx, fx - (g.nx - 1)), Math.max(0, -fy, fy - (g.ny - 1))) * g.d;
            return { h, inside, dOut };
        };
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const g of grids) { x0 = Math.min(x0, g.x0); x1 = Math.max(x1, g.x0 + (g.nx - 1) * g.d); z1 = Math.max(z1, g.zS); z0 = Math.min(z0, g.zS - (g.ny - 1) * g.d); }
        const d = 20, nx = Math.ceil((x1 - x0) / d) + 1, nz = Math.ceil((z1 - z0) / d) + 1, h = [];
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
            const x = x0 + i * d, z = z0 + j * d; let s = 0, w = 0, best = null;
            for (const g of grids) { const r = sample(g, x, z); if (r.inside) { s += r.h; w++; } else if (!best || r.dOut < best.dOut) best = r; }
            h.push(r2((w ? s / w : best.h) - origin.elev));
        }
        terrain = { x0: r1(x0), z0: r1(z0), d, nx, nz, h, src: terrains.map((t) => t.source)[0] };
    }

    // ---------------- spots: research spec with local coordinates added
    const loc = (la, lo) => { const [x, z] = P.xy(la, lo); return { x, z }; };
    const spotsOut = {};
    for (const s of spots) {
        const sp = JSON.parse(JSON.stringify(s));
        sp.spawn = { ...sp.spawn, ...loc(s.spawn.lat, s.spawn.lon), y: Y(s.spawn.ground_elev_m) };
        sp.extent.polygon = (s.extent.polygon_latlon || []).map(([la, lo]) => P.xy(la, lo));
        for (const st of sp.structures || []) if (st.lat !== undefined) Object.assign(st, loc(st.lat, st.lon), { y: Y(st.ground_elev_m) });
        if (sp.photo?.iconic?.from) Object.assign(sp.photo.iconic, loc(...sp.photo.iconic.from));
        for (const a of sp.photo?.alternates || []) if (a.from) Object.assign(a, loc(...a.from));
        delete sp.refs_candidates; delete sp.sources_rank; delete sp.why_top10;
        if (cfg.buc) { sp.dialogue = bucDialogue(s, research); delete sp.osm; delete sp.colour_samples; delete sp.refs; }
        spotsOut[s.id] = sp;
    }

    const data = {
        id: sceneId, city: first.city, name: cfg.name || first.name, timeZone: cfg.tz,
        origin, projection: { mLat: r2(P.mLat), mLon: r2(P.mLon) },
        members: cfg.members, terrain, ...out, spots: spotsOut,
        dialogueGeneral: cfg.buc ? { lines: bucGeneral(research).lines } : research.dialogue_general || null,
        culture: cfg.buc ? bucGeneral(research).culture : research.culture || null,
        attribution: '© OpenStreetMap contributors (ODbL 1.0); terrain: ' + (cfg.buc ? 'EU-DEM v1.1 (Copernicus) via OpenTopoData' : 'USGS 3DEP via EPQS') + '; scene specs: game/research/' + cfg.research,
        built: new Date().toISOString(),
    };
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, sceneId + '.json');
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`${sceneId}: ${out.buildings.length} buildings, ${out.ways.length} ways, ${out.areas.length} areas, ${out.trees.length} trees, ${out.pois.length} pois, terrain ${terrain ? terrain.nx + '×' + terrain.nz : 'none'} → ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

const want = process.argv.slice(2);
for (const id of (want.length ? want : Object.keys(SCENES))) buildScene(id);
