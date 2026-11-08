#!/usr/bin/env node
// ============================================================================
//  Bucharest spot sources (spec 15): OSM extract (Overpass) + terrain grid
//  (EU-DEM 25 m via OpenTopoData, filtered to bare earth) per scene, written in
//  the same format as game/research/osm/sea-spots/<spot>.json / .terrain.json
//  so build-data.mjs treats both cities alike.
//
//  usage:  node game/src/spots/tools/fetch-buc.mjs [sceneId ...] [--force]
//  cache:  $SPOTS_OSM_CACHE (default <os tmp>/dmcv-spots-osm/buc/) — raw sources stay out of git;
//          build-data.mjs runs this automatically for a Bucharest scene whose cache is missing.
//  The research dossier (game/research/bucharest-spots.json, read-only) gives each member spot's
//  footprint; the extract covers the union + BACKDROP_PAD metres of backdrop.
//  © OpenStreetMap contributors (ODbL 1.0); EU-DEM v1.1 (Copernicus) via api.opentopodata.org.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const BUC_CACHE = process.env.SPOTS_OSM_CACHE || path.join(os.tmpdir(), 'dmcv-spots-osm', 'buc');
const OVERPASS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const BACKDROP_PAD = 260;

/** Bucharest scenes → member spots (kept in sync with build-data.mjs SCENES) */
export const BUC_SCENES = {
    'buc-parliament': ['palace-parliament', 'peoples-salvation-cathedral'],
    'buc-old-town': ['old-town-lipscani', 'stavropoleos-cec'],
    'athenaeum-revolution': ['athenaeum-revolution'],
    'arcul-de-triumf': ['arcul-de-triumf'],
    'buc-herastrau': ['herastrau-park', 'village-museum'],
    'spring-palace': ['spring-palace'],
    'cismigiu': ['cismigiu'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function bboxOf(research, members, pad = BACKDROP_PAD) {
    let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
    for (const id of members) {
        const s = research.spots.find((x) => x.id === id);
        for (const [la, lo] of s.footprint.polygon_latlon) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
    }
    const dLa = pad / 111132, dLo = pad / (111320 * Math.cos(((la0 + la1) / 2) * Math.PI / 180));
    return { s: la0 - dLa, n: la1 + dLa, w: lo0 - dLo, e: lo1 + dLo, core: { s: la0, n: la1, w: lo0, e: lo1 } };
}
async function overpass(q) {
    let last = null;
    for (let attempt = 0; attempt < 6; attempt++) {
        const url = OVERPASS[attempt % OVERPASS.length];
        try {
            const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(180000) });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) { last = e; console.warn('  overpass', url, e.message); await sleep(15000 * (attempt + 1)); }
    }
    throw last;
}
const ll = (g) => g.map((p) => [Math.round(p.lat * 1e7) / 1e7, Math.round(p.lon * 1e7) / 1e7]);
/** join member ways of a multipolygon into closed rings */
function rings(members, role) {
    const segs = members.filter((m) => m.type === 'way' && (m.role || 'outer') === role && m.geometry?.length > 1).map((m) => ll(m.geometry));
    const out = [];
    const key = (p) => p[0] + ',' + p[1];
    while (segs.length) {
        let ring = segs.shift();
        for (let guard = 0; guard < 500 && key(ring[0]) !== key(ring[ring.length - 1]); guard++) {
            const end = key(ring[ring.length - 1]); let found = false;
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                if (key(s[0]) === end) { ring = ring.concat(s.slice(1)); segs.splice(i, 1); found = true; break; }
                if (key(s[s.length - 1]) === end) { ring = ring.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); found = true; break; }
            }
            if (!found) break;
        }
        if (ring.length > 3) out.push(ring);
    }
    return out;
}
const FURN = { bench: 'bench', waste_basket: 'waste_basket', bicycle_parking: 'bicycle_parking', drinking_water: 'drinking_water', fountain: 'fountain', clock: 'clock', toilets: 'toilets', post_box: 'post_box', fire_hydrant: 'fire_hydrant', street_lamp: 'street_lamp', bollard: 'bollard', flagpole: 'flagpole', information: 'information', bus_stop: 'bus_stop', traffic_signals: 'traffic_signals', picnic_table: 'picnic_table', cross: 'cross', bicycle_rental: 'bicycle_rental', vending_machine: 'vending_machine', planter: 'planter', shelter: 'shelter', telephone: 'telephone', atm: 'atm' };
const BUILDING_KEYS = ['building', 'building:part', 'building:levels', 'building:min_level', 'min_height', 'height', 'roof:shape', 'roof:height', 'roof:colour', 'building:colour', 'building:material', 'name', 'amenity', 'shop', 'tourism', 'layer', 'addr:street', 'addr:housenumber', 'historic', 'religion'];

export const positiveBuildingTag = (value) => value != null && !['', 'no', 'false', '0'].includes(String(value).trim().toLowerCase());

export function convert(json, box, sceneId) {
    const inCore = (pts) => { let la = 0, lo = 0; for (const p of pts) { la += p[0]; lo += p[1]; } la /= pts.length; lo /= pts.length; const c = box.core, m = 40 / 111132; return la > c.s - m && la < c.n + m && lo > c.w - m * 1.4 && lo < c.e + m * 1.4; };
    const out = { spot: sceneId, source: 'Overpass API (OpenStreetMap), fetched ' + new Date().toISOString().slice(0, 10) + '; © OpenStreetMap contributors, ODbL 1.0', buildings: [], backdrop_buildings: [], ways: [], areas: [], trees: [], furniture: {}, pois: [] };
    const furn = (k, p) => (out.furniture[k] || (out.furniture[k] = [])).push(p);
    for (const el of json.elements) {
        const t = el.tags || {};
        if (el.type === 'node') {
            const p = [el.lat, el.lon];
            if (t.natural === 'tree') { out.trees.push([el.lat, el.lon, t.leaf_type || '', t.species || t.genus || '', t.height || '']); continue; }
            const k = t.highway === 'street_lamp' ? 'street_lamp' : t.highway === 'bus_stop' ? 'bus_stop' : t.highway === 'traffic_signals' ? 'traffic_signals' : t.barrier === 'bollard' ? 'bollard' : t.man_made === 'flagpole' ? 'flagpole' : t.man_made === 'cross' || t.historic === 'wayside_cross' ? 'cross' : t.emergency === 'fire_hydrant' ? 'fire_hydrant' : t.tourism === 'information' && t.information !== 'office' ? 'information' : t.leisure === 'picnic_table' ? 'picnic_table' : FURN[t.amenity] || null;
            if (k) furn(k, p);
            if (t.name || t.tourism === 'artwork' || t.historic || t.amenity === 'fountain' || t.amenity === 'clock' || t.shop || (t.amenity && !FURN[t.amenity])) {
                const o = { id: 'n' + el.id, ll: p };
                for (const [kk, v] of Object.entries(t)) if (!/^(source|check_date|wikidata|brand:wikidata|opening_hours|wheelchair|addr:postcode|addr:city|addr:country|phone|website|email|contact:|mapillary|image|wikimedia_commons|survey)/.test(kk)) o[kk] = v;
                out.pois.push(o);
            }
            continue;
        }
        let polys = null, line = null;
        if (el.type === 'way' && el.geometry) {
            const g = ll(el.geometry);
            const closed = g.length > 3 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
            if (closed) polys = [g]; line = g;
        } else if (el.type === 'relation' && el.members) {
            if (t.type !== 'multipolygon' && !positiveBuildingTag(t.building) && !positiveBuildingTag(t['building:part'])) continue;
            polys = rings(el.members, 'outer');
            if (!polys.length) continue;
            const inner = rings(el.members, 'inner');
            if (inner.length) t.__inner = inner;
        }
        const id = (el.type === 'way' ? 'w' : 'r') + el.id;
        if ((positiveBuildingTag(t.building) || positiveBuildingTag(t['building:part'])) && polys) {
            for (let i = 0; i < polys.length; i++) {
                const o = { id: polys.length > 1 ? id + '_' + i : id };
                for (const k of BUILDING_KEYS) if (t[k] !== undefined) o[k] = t[k];
                for (const [k,v] of Object.entries(t)) if (k.startsWith('roof:') || k.startsWith('building:')) o[k] = v;
                o.height_m = t.height ? parseFloat(t.height) : null;
                o.footprint = polys[i];
                if (t.__inner) o.holes = t.__inner;
                (inCore(polys[i]) ? out.buildings : out.backdrop_buildings).push(o);
            }
            continue;
        }
        const isArea = polys && (t.area === 'yes' || t.landuse || t.leisure || t.natural || t.amenity || t.water || t.waterway === 'riverbank' || t['area:highway'] || t.place || t.man_made === 'bridge' || t.tourism || (t.highway === 'pedestrian' && t.area === 'yes'));
        const isLine = line && (t.highway || t.railway || t.barrier || t.man_made || t.waterway || t.natural === 'tree_row');
        if (isArea && !(t.highway && t.area !== 'yes' && !t['area:highway'])) {
            for (let i = 0; i < polys.length; i++) {
                const o = { id: polys.length > 1 ? id + '_' + i : id };
                for (const [k, v] of Object.entries(t)) if (!k.startsWith('__') && !/^(source|check_date|wikidata|wikipedia|wikimedia|website|opening_hours|phone|image)/.test(k)) o[k] = v;
                o.outline = polys[i];
                if (t.__inner) o.holes = t.__inner;
                out.areas.push(o);
            }
            if (t.barrier && line) out.ways.push({ id: id + '_b', barrier: t.barrier, line, height: t.height });
            continue;
        }
        if (isLine) {
            const o = { id, line };
            for (const [k, v] of Object.entries(t)) if (!/^(source|check_date|wikidata|wikipedia|maxspeed:|old_name|alt_name|name:)/.test(k)) o[k] = v;
            if (t.natural === 'tree_row') o.barrier = o.barrier || 'tree_row';
            out.ways.push(o);
        }
    }
    out.summary = { buildings: out.buildings.length, backdrop_buildings: out.backdrop_buildings.length, ways: out.ways.length, areas: out.areas.length, trees: out.trees.length, pois: out.pois.length, furniture: Object.fromEntries(Object.entries(out.furniture).map(([k, v]) => [k, v.length])) };
    return out;
}

/** EU-DEM grid (spacing 40 m) over the bbox; buildings / tree canopy removed by a morphological opening (min filter
 *  over ~100 m, then a max filter of the same size and a light blur) so the result reads as bare earth. */
async function terrain(box) {
    const d = 40, lat0 = box.s, lon0 = box.w;
    const mLat = 111132, mLon = 111320 * Math.cos(((box.s + box.n) / 2) * Math.PI / 180);
    const nx = Math.ceil((box.e - box.w) * mLon / d) + 1, ny = Math.ceil((box.n - box.s) * mLat / d) + 1;
    const pts = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([lat0 + j * d / mLat, lon0 + i * d / mLon]);
    const elev = new Array(pts.length).fill(null);
    for (let k = 0; k < pts.length; k += 100) {
        const chunk = pts.slice(k, k + 100), q = chunk.map(([a, b]) => a.toFixed(6) + ',' + b.toFixed(6)).join('|');
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const r = await fetch('https://api.opentopodata.org/v1/eudem25m?locations=' + q, { signal: AbortSignal.timeout(60000) });
                const j = await r.json(); if (j.status !== 'OK') throw new Error(j.error || j.status);
                j.results.forEach((x, i) => { elev[k + i] = x.elevation; }); break;
            } catch (e) { console.warn('  opentopodata', e.message); await sleep(2500 * (attempt + 1)); }
        }
        await sleep(1100); // public API: 1 call / s
    }
    const raw = []; for (let j = 0; j < ny; j++) raw.push(elev.slice(j * nx, (j + 1) * nx).map((v) => v ?? 75));
    const filt = (g, R, f) => g.map((row, j) => row.map((_, i) => { let v = f === 'min' ? 1e9 : -1e9; for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const jj = j + b, ii = i + a; if (jj < 0 || ii < 0 || jj >= ny || ii >= nx || a * a + b * b > R * R + 0.5) continue; v = f === 'min' ? Math.min(v, g[jj][ii]) : Math.max(v, g[jj][ii]); } return v; }));
    const blur = (g) => g.map((row, j) => row.map((_, i) => { let s = 0, w = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const jj = j + b, ii = i + a; if (jj < 0 || ii < 0 || jj >= ny || ii >= nx) continue; const k = a || b ? 1 : 2; s += g[jj][ii] * k; w += k; } return s / w; }));
    const bare = blur(filt(filt(raw, 2, 'min'), 2, 'max')).map((r) => r.map((v) => Math.round(v * 100) / 100));
    return { source: 'EU-DEM v1.1 25 m (Copernicus) via api.opentopodata.org, opened (min/max 80 m) + blurred to remove buildings and tree canopy; fetched ' + new Date().toISOString().slice(0, 10), origin_latlon_sw: [lat0, lon0], spacing_m: d, nx, ny, row_order: 'south_to_north', elev_m: bare, raw_elev_m: raw };
}

export async function fetchScene(sceneId, { force = false } = {}) {
    const members = BUC_SCENES[sceneId]; if (!members) throw new Error('not a Bucharest scene: ' + sceneId);
    const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/research/bucharest-spots.json'), 'utf8'));
    fs.mkdirSync(BUC_CACHE, { recursive: true });
    const fo = path.join(BUC_CACHE, sceneId + '.json'), ft = path.join(BUC_CACHE, sceneId + '.terrain.json');
    const box = bboxOf(research, members, BACKDROP_PAD);
    if (force || !fs.existsSync(fo)) {
        const bb = `${box.s.toFixed(6)},${box.w.toFixed(6)},${box.n.toFixed(6)},${box.e.toFixed(6)}`;
        const q = `[out:json][timeout:170];(
  way["building"](${bb}); relation["building"](${bb}); way["building:part"](${bb}); relation["building:part"](${bb});
  way["highway"](${bb}); way["railway"](${bb}); way["barrier"](${bb}); way["man_made"](${bb}); way["waterway"](${bb}); way["natural"](${bb});
  way["landuse"](${bb}); way["leisure"](${bb}); way["amenity"](${bb}); way["area:highway"](${bb}); way["place"](${bb}); way["tourism"](${bb}); way["historic"](${bb});
  relation["type"="multipolygon"]["landuse"](${bb}); relation["type"="multipolygon"]["leisure"](${bb}); relation["type"="multipolygon"]["natural"](${bb});
  relation["type"="multipolygon"]["amenity"](${bb}); relation["type"="multipolygon"]["highway"](${bb}); relation["type"="multipolygon"]["place"](${bb});
  relation["type"="multipolygon"]["water"](${bb});
  node["natural"="tree"](${bb}); node["amenity"](${bb}); node["highway"](${bb}); node["barrier"](${bb}); node["man_made"](${bb});
  node["tourism"](${bb}); node["historic"](${bb}); node["shop"](${bb}); node["leisure"](${bb}); node["emergency"="fire_hydrant"](${bb}); node["craft"](${bb}); node["office"](${bb});
);out geom;`;
        console.log(`${sceneId}: overpass ${bb}`);
        const json = await overpass(q);
        const o = convert(json, box, sceneId);
        // Keep raw tags/member geometry and the exact source scope outside git.
        // Prepared-array membership alone cannot establish extract completeness.
        fs.writeFileSync(path.join(BUC_CACHE, sceneId + '.overpass.json'), JSON.stringify(json));
        o.extract = { bbox: [box.s, box.w, box.n, box.e], core: box.core, query: q, fetchedAt: new Date().toISOString(), raw: sceneId + '.overpass.json' };
        fs.writeFileSync(fo, JSON.stringify(o));
        console.log(`  → ${fo}`, JSON.stringify(o.summary));
    }
    if (force || !fs.existsSync(ft)) {
        console.log(`${sceneId}: terrain`);
        const t = await terrain(box); t.spot = sceneId;
        fs.writeFileSync(ft, JSON.stringify(t));
        console.log(`  → ${ft} ${t.nx}×${t.ny}`);
    }
    return { osm: fo, terrain: ft };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2), force = args.includes('--force'), ids = args.filter((a) => !a.startsWith('--'));
    for (const id of (ids.length ? ids : Object.keys(BUC_SCENES))) await fetchScene(id, { force });
}
