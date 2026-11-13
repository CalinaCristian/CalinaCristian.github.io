#!/usr/bin/env node
// ============================================================================
//  Tourist-scene data append (no rebuild): adds named OSM elements that a scene's prepared data lacks, in exactly the
//  schema game/src/spots/tools/build-data.mjs writes (via fetch-buc.mjs `convert()` and the same per-feature mapping),
//  and removes only elements that live OSM has deleted. Everything else in the scene file is left as it is: existing
//  features keep their values and their order; new features are appended to their array; one `osmAppend` record is
//  appended (provenance: tool, date, input file digests, ids added / removed).
//
//  usage: node tools/spots/append-osm-features.mjs --osm <dir> --ids <id,id,…> [--remove <id,…>] [--scenes <id,…>]
//                [--repo <worktree>] [--out <dir>] [--write]
//    --osm     OSM API 0.6 responses saved as <dir>/<id>.json: {url, status, fetched, body}; `body` is the
//              node/<id>.json or way|relation/<id>/full.json reply. A removal needs the saved reply to be HTTP 410
//              (deleted in OSM); anything else refuses the removal.
//    --ids     elements to add (n123 / w123 / r123). Each is added to every listed scene whose source extract box
//              contains it: Bucharest = the research footprint + 260 m (fetch-buc.mjs `bboxOf`, the box the scene's
//              Overpass extract used); Seattle = the bbox of the scene's prepared buildings (the extract's reach)
//    --scenes  scene ids to consider (default: every scene of build-data.mjs SCENES)
//    --out     where changed scene files go (default: game/data/spots of --repo)
//  Classes the scene builder drops, mapped here the way the builder maps their nearest kept kind
//  (patch: fetch-buc.mjs, see the round-3 lane notes): unnamed nodes tagged tourism=viewpoint, leisure=playground,
//  waterway|natural=waterfall, and named ways that are neither a building, an area nor a line (an office / embassy
//  ground mapped only by its outline) become POIs like a named node (a way at its outline's vertex centroid).
//  © OpenStreetMap contributors, ODbL 1.0.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(args.repo || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const OUT = path.resolve(args.out || path.join(REPO, 'game', 'data', 'spots'));
if (!args.osm || !(args.ids || args.remove)) { console.error('usage: append-osm-features.mjs --osm <dir> --ids <ids> [--remove <ids>] [--scenes <ids>] [--repo <dir>] [--out <dir>] [--write]'); process.exit(2); }
const imp = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { convert, bboxOf } = await imp('game/src/spots/tools/fetch-buc.mjs');
const { SCENES, projector } = await imp('game/src/spots/tools/build-data.mjs');
const SRC = path.join(REPO, 'game', 'data', 'spots');

// ---- OSM input
const ledger = [];
function load(id) {
    const f = path.join(path.resolve(args.osm), id + '.json'), bytes = fs.readFileSync(f);
    ledger.push({ file: path.basename(f), sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    return JSON.parse(bytes.toString('utf8'));
}
const TYPE = { n: 'node', w: 'way', r: 'relation' };
/** the API reply as one Overpass `out geom` element (what convert() reads) */
function overpassElement(id) {
    const rec = load(id); if (rec.status !== 200 || !rec.body?.elements) throw Error(`${id}: no live OSM element (HTTP ${rec.status})`);
    const els = rec.body.elements, type = TYPE[id[0]], num = +id.slice(1);
    const N = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n])), W = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]));
    const e = els.find(x => x.type === type && x.id === num); if (!e) throw Error(id + ': element missing in reply');
    const geom = (w) => w.nodes.map(n => { const p = N.get(n); if (!p) throw Error(`${id}: node ${n} missing`); return { lat: p.lat, lon: p.lon }; });
    if (type === 'node') return { type, id: num, lat: e.lat, lon: e.lon, tags: { ...e.tags } };
    if (type === 'way') return { type, id: num, nodes: e.nodes, tags: { ...e.tags }, geometry: geom(e) };
    return { type, id: num, tags: { ...e.tags }, members: e.members.map(m => ({ ...m, ...(m.type === 'way' && W.has(m.ref) ? { geometry: geom(W.get(m.ref)) } : {}) })) };
}
const EXTRA_NODE = (t) => t.tourism === 'viewpoint' || t.leisure === 'playground' || t.waterway === 'waterfall' || t.natural === 'waterfall';
const SKIP_TAG = /^(source|check_date|wikidata|brand:wikidata|opening_hours|wheelchair|addr:postcode|addr:city|addr:country|phone|website|email|contact:|mapillary|image|wikimedia_commons|survey)/;
/** intermediate (fetch-buc) records for one element: convert() first, then the dropped classes */
function sourceRecords(el, box, sceneId) {
    const o = convert({ elements: [JSON.parse(JSON.stringify(el))] }, box, sceneId);
    const n = o.buildings.length + o.backdrop_buildings.length + o.ways.length + o.areas.length + o.pois.length;
    if (n) return { ...o, cls: 'builder classes' };
    const t = el.tags || {}, poi = (ll) => { const r = { id: el.type[0] + el.id, ll }; for (const [k, v] of Object.entries(t)) if (!SKIP_TAG.test(k)) r[k] = v; return r; };
    if (el.type === 'node' && EXTRA_NODE(t)) return { ...o, pois: [poi([el.lat, el.lon])], cls: 'dropped node class' };
    if (el.type === 'way' && t.name && (t.office || t.diplomatic)) {
        const g = el.geometry, closed = g.length > 3 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon, pts = closed ? g.slice(0, -1) : g;
        const la = pts.reduce((s, p) => s + p.lat, 0) / pts.length, lo = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
        return { ...o, pois: [poi([Math.round(la * 1e7) / 1e7, Math.round(lo * 1e7) / 1e7])], cls: 'named office way (outline only)' };
    }
    return { ...o, cls: 'not representable' };
}

// ---- build-data.mjs buildScene() per-feature mapping, verbatim (cleanPoly, keep lists, POI key filter)
function cleanPoly(p) {
    const o = [];
    for (const q of p) { const l = o[o.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.15) o.push(q); }
    if (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 0.15) o.pop();
    return o;
}
const WAY_KEEP = ['name', 'footway', 'surface', 'lanes', 'oneway', 'bridge', 'tunnel', 'layer', 'width', 'service', 'crossing', 'incline', 'step_count', 'covered', 'area', 'sidewalk', 'sidewalk:both', 'cycleway', 'access', 'foot', 'motor_vehicle', 'level', 'indoor', 'height', 'material', 'fence_type', 'natural', 'tram', 'junction', 'min_height', 'description', 'start_date', 'bridge:structure', 'bridge:support'];
const AREA_KEEP = ['landuse', 'leisure', 'natural', 'amenity', 'man_made', 'barrier', 'waterway', 'water', 'surface', 'name', 'area:highway', 'layer', 'level', 'indoor', 'leaf_type', 'parking', 'railway', 'fence_type', 'height', 'highway', 'place', 'building', 'tourism', 'min_height', 'description', 'start_date', 'bridge:structure', 'bridge:support'];
const POI_DROP = ['id', 'll', 'wheelchair', 'brand:wikidata', 'wikidata', 'addr:postcode', 'addr:city', 'addr:state', 'check_date', 'source', 'opening_hours'];
const mapWay = (w, P) => { const o = { id: w.id, k: w.highway || w.railway || w.barrier || w.man_made || 'line', pts: w.line.map(([la, lo]) => P.xy(la, lo)) }; for (const k of WAY_KEEP) if (w[k] !== undefined) o[k.replace(':', '_')] = w[k]; return o; };
const mapArea = (a, P) => { const poly = cleanPoly(a.outline.map(([la, lo]) => P.xy(la, lo))); if (poly.length < 3) return null; const o = { id: a.id, poly }; for (const k of AREA_KEEP) if (a[k] !== undefined) o[k.replace(':', '_')] = a[k]; if (a.holes) o.holes = a.holes.map((h) => cleanPoly(h.map(([la, lo]) => P.xy(la, lo)))); return o; };
const mapPoi = (p, P) => { const [x, z] = P.xy(p.ll[0], p.ll[1]); const o = { id: p.id, x, z }; for (const [k, v] of Object.entries(p)) if (!POI_DROP.includes(k)) o[k] = v; return o; };

// ---- scenes
const sceneIds = args.scenes ? String(args.scenes).split(',') : Object.keys(SCENES);
const addIds = args.ids ? String(args.ids).split(',').filter(Boolean) : [], removeIds = args.remove ? String(args.remove).split(',').filter(Boolean) : [];
const els = new Map(addIds.map(id => [id, overpassElement(id)]));
const deleted = new Map();
for (const id of removeIds) { const rec = load(id); if (rec.status !== 410) throw Error(`refusing to remove ${id}: live OSM reply is HTTP ${rec.status}, not 410 Gone`); deleted.set(id, { fetched: rec.fetched, url: rec.url, status: 410 }); }
const research = { 'bucharest-spots.json': JSON.parse(fs.readFileSync(path.join(REPO, 'game/research/bucharest-spots.json'), 'utf8')) };
const baseId = (id) => String(id).replace(/_\d+$/, '');
const report = [];
for (const sceneId of sceneIds) {
    const cfg = SCENES[sceneId]; if (!cfg) throw Error('unknown scene ' + sceneId);
    const file = path.join(SRC, sceneId + '.json'), raw = fs.readFileSync(file, 'utf8'), data = JSON.parse(raw), before = JSON.parse(raw);
    const P = projector(data.origin.lat, data.origin.lon);
    if (Math.round(P.mLat * 100) / 100 !== data.projection.mLat || Math.round(P.mLon * 100) / 100 !== data.projection.mLon) throw Error(sceneId + ': projection differs from the builder');
    let box;
    if (cfg.buc) box = bboxOf(research[cfg.research], cfg.members);
    else { let s = 90, n = -90, w = 180, e = -180; for (const b of data.buildings) for (const [x, z] of b.poly) { const [la, lo] = P.ll(x, z); s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); } box = { s, n, w, e, core: { s, n, w, e } }; }
    const inBox = (la, lo) => la >= box.s && la <= box.n && lo >= box.w && lo <= box.e;
    const have = new Set(); for (const k of ['buildings', 'ways', 'areas', 'pois']) for (const f of data[k] || []) have.add(baseId(f.id));
    const added = { buildings: [], ways: [], areas: [], pois: [] }, removed = [], skipped = [];
    for (const [id, el] of els) {
        const pts = el.type === 'node' ? [[el.lat, el.lon]] : el.type === 'way' ? el.geometry.map(p => [p.lat, p.lon]) : el.members.flatMap(m => (m.geometry || []).map(p => [p.lat, p.lon]));
        if (!pts.some(([la, lo]) => inBox(la, lo))) continue; // (the scene's extract box: an element with any vertex inside it)
        if (have.has(id)) { skipped.push({ id, why: 'already in the scene data' }); continue; }
        const rec = sourceRecords(el, box, sceneId);
        if (rec.buildings.length || rec.backdrop_buildings.length) { skipped.push({ id, why: 'building: not handled by this tool' }); continue; }
        for (const w of rec.ways) { data.ways.push(mapWay(w, P)); added.ways.push(w.id); }
        for (const a of rec.areas) { const o = mapArea(a, P); if (o) { data.areas.push(o); added.areas.push(a.id); } }
        for (const p of rec.pois) { data.pois.push(mapPoi(p, P)); added.pois.push(p.id); }
        if (!rec.ways.length && !rec.areas.length && !rec.pois.length) skipped.push({ id, why: rec.cls });
        else report.push({ scene: sceneId, id, cls: rec.cls });
        have.add(id);
    }
    for (const id of removeIds) for (const k of ['pois', 'ways', 'areas']) { const n = data[k].length; data[k] = data[k].filter(f => baseId(f.id) !== id); if (data[k].length < n) removed.push({ id, from: k, evidence: deleted.get(id) }); }
    const nAdd = Object.values(added).reduce((s, a) => s + a.length, 0);
    if (!nAdd && !removed.length) { if (skipped.length) console.log(sceneId, 'unchanged;', JSON.stringify(skipped)); continue; }
    data.osmAppend = { schema: 1, runs: [...(data.osmAppend?.runs || []), { tool: 'tools/spots/append-osm-features.mjs', date: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap API 0.6 (live), © OpenStreetMap contributors, ODbL 1.0', inputs: ledger.filter(l => [...Object.values(added).flat(), ...removed.map(r => r.id)].some(i => l.file === baseId(i) + '.json')), added: Object.fromEntries(Object.entries(added).filter(([, v]) => v.length)), removed }] };
    // proof: every pre-existing feature unchanged (removed ones excepted), every other key deep-equal
    for (const k of Object.keys(before)) {
        if (['ways', 'areas', 'pois'].includes(k)) { const keep = before[k].filter(f => !removed.some(r => r.id === baseId(f.id))); if (!isDeepStrictEqual(data[k].slice(0, keep.length), keep)) throw Error(`${sceneId}.${k}: pre-existing features changed`); }
        else if (k !== 'osmAppend' && !isDeepStrictEqual(data[k], before[k])) throw Error(`${sceneId}.${k} changed`); // (osmAppend: earlier runs kept, this run appended)
    }
    let out = JSON.stringify(data);
    // keep the source file's own number spelling where JSON.stringify would rewrite it ("30410.0" written by a Python tool)
    for (const m of raw.matchAll(/"([^"\\]+)":(-?\d+)\.0(?=[,}\]])/g)) { const a = `"${m[1]}":${m[2]}`, i = out.indexOf(a); if (i >= 0 && !/[\d.]/.test(out[i + a.length])) out = out.slice(0, i) + a + '.0' + out.slice(i + a.length); }
    console.log(`${sceneId}: +${JSON.stringify(Object.fromEntries(Object.entries(added).map(([k, v]) => [k, v.join(' ')]).filter(([, v]) => v)))} −${removed.map(r => r.id).join(' ') || 'none'}; skipped ${JSON.stringify(skipped)}; ${raw.length} → ${out.length} chars`);
    if (args.write) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, sceneId + '.json'), out); }
}
if (args.report) fs.writeFileSync(path.resolve(args.report), JSON.stringify({ inputs: ledger, added: report }, null, 1));
