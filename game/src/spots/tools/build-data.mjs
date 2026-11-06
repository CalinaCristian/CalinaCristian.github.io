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
};

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
    const spots = cfg.members.map((id) => { const s = research.spots.find((x) => x.id === id); if (!s) throw new Error('no research spot ' + id); return s; });
    const first = spots[0];
    const origin = cfg.origin || { lat: first.spawn.lat, lon: first.spawn.lon, elev: Math.round(first.spawn.ground_elev_m * 10) / 10 };
    const P = projector(origin.lat, origin.lon);
    const Y = (e) => (e === null || e === undefined ? null : r2(e - origin.elev));

    // ---------------- OSM (union of the member extracts, deduped by id)
    const seen = new Set();
    const out = { buildings: [], ways: [], areas: [], trees: [], pois: [], furniture: {} };
    const terrains = [];
    for (const s of spots) {
        const osm = JSON.parse(fs.readFileSync(path.join(RES, 'osm', cfg.osmDir, s.id + '.json'), 'utf8'));
        const tf = path.join(RES, 'osm', cfg.osmDir, s.id + '.terrain.json');
        if (fs.existsSync(tf)) terrains.push(JSON.parse(fs.readFileSync(tf, 'utf8')));
        for (const [list, backdrop] of [[osm.buildings, false], [osm.backdrop_buildings, true]]) for (const b of list || []) {
            if (seen.has(b.id)) continue; seen.add(b.id);
            const poly = cleanPoly(b.footprint.map(([la, lo]) => P.xy(la, lo)));
            if (poly.length < 3 || Math.abs(polyArea(poly)) < 2) continue;
            const lv = num(b['building:levels']);
            const o = {
                id: b.id, poly, h: num(b.height_m ?? b.height), lv, minH: num(b.min_height), minLv: num(b['building:min_level']),
                k: b.building || (b['building:part'] ? 'part' : 'yes'), part: !!b['building:part'],
                roof: b['roof:shape'] || null, roofH: num(b['roof:height']), rc: b['roof:colour'] || null, c: b['building:colour'] || null,
                mat: b['building:material'] || null, name: b.name || null, backdrop,
            };
            if (b.amenity) o.amenity = b.amenity; if (b.shop) o.shop = b.shop; if (b.tourism) o.tourism = b.tourism;
            if (b.layer) o.layer = num(b.layer);
            if (b['addr:street']) o.addr = `${b['addr:housenumber'] || ''} ${b['addr:street']}`.trim();
            for (const k of Object.keys(o)) if (o[k] === null || o[k] === false) delete o[k];
            out.buildings.push(o);
        }
        for (const w of osm.ways || []) {
            if (seen.has(w.id)) continue; seen.add(w.id);
            const pts = w.line.map(([la, lo]) => P.xy(la, lo));
            const o = { id: w.id, k: w.highway || w.railway || w.barrier || w.man_made || 'line', pts };
            const keep = ['name', 'footway', 'surface', 'lanes', 'oneway', 'bridge', 'tunnel', 'layer', 'width', 'service', 'crossing', 'incline', 'step_count', 'covered', 'area', 'sidewalk', 'sidewalk:both', 'cycleway', 'access', 'level', 'indoor'];
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
        spotsOut[s.id] = sp;
    }

    const data = {
        id: sceneId, city: first.city, name: cfg.name || first.name, timeZone: cfg.tz,
        origin, projection: { mLat: r2(P.mLat), mLon: r2(P.mLon) },
        members: cfg.members, terrain, ...out, spots: spotsOut,
        dialogueGeneral: research.dialogue_general || null,
        culture: research.culture || null,
        attribution: '© OpenStreetMap contributors (ODbL 1.0); terrain: USGS 3DEP via EPQS; scene specs: game/research/' + cfg.research,
        built: new Date().toISOString(),
    };
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, sceneId + '.json');
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`${sceneId}: ${out.buildings.length} buildings, ${out.ways.length} ways, ${out.areas.length} areas, ${out.trees.length} trees, ${out.pois.length} pois, terrain ${terrain ? terrain.nx + '×' + terrain.nz : 'none'} → ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

const want = process.argv.slice(2);
for (const id of (want.length ? want : Object.keys(SCENES))) buildScene(id);
