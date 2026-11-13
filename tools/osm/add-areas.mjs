#!/usr/bin/env node
// Cached-source water / pool area append: adds the water basins, fountain basins and outdoor pools a district dataset lacks,
// without rebuilding it. Every existing row keeps its values and its index; only
//   areas           new rows appended ([kind, name, outer delta, hole delta …], the build's schema and simplification)
//   areaSourceIds   their OSM identities appended (parallel to areas)
//   areaSourceTags  literal water / natural / waterway (and amenity / fountain for a fountain basin) of the new rows
//   strings         new strings appended
//   areaAppend      (new) provenance: tool, date, OSM input ledger, counts
// are written.
//
//   node tools/osm/add-areas.mjs --city bucharest --district unirii --osm <dir | file[,file]> [--write] [--data FILE]
//        [--out FILE] [--report FILE] [--exclude w1,w2] [--classes water,pool]
//
// What is added: closed ways / multipolygon relations the district build classifies as `water` (natural=water, water=*,
// waterway=riverbank, landuse=reservoir|basin), a fountain mapped as an outline (amenity=fountain: the build of round 3 files
// it as its basin's water; before, only fountain NODES were kept, as street furniture) and outdoor `pool`s
// (leisure=swimming_pool, not indoor, not a building), that
//   - are not in the dataset (`areaSourceIds`), are open / not closed / disused,
//   - measure at least MIN_WET_M2 (4 m²) after the build's simplification: a 15 m² fountain basin or courtyard pool is a
//     visible thing (the build's general 30 m² area threshold dropped the Colțea basins, the Unirii and Bellevue plaza
//     fountains and the Ramada pool); smaller outlines (jet slits) stay out, a fountain under it is the furniture fountain,
//   - a furniture fountain inside a fountain outline that is added here is removed from `furniture` (the generic 3.2 m bowl
//     stood for the same OSM fountain: add-pois.mjs of round 2 had appended the small outlines as bowls), reported by position,
//   - lie within the build's area ring (the district's outer ring + 40 m),
//   - are not already covered by a dataset water / pool area (their centre inside one),
//   - are not listed in --exclude (a landmark that models that water itself, e.g. Romană `veronafountain` w1183885625).
// Without --write nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readDistrictData, writeDistrictData, resolveDistrictFile } from './district-data.mjs';
import { isClosedPoi } from './poi-kinds.mjs';
import { simplifyRing, polyArea, polyCentroid, pointInPolygon, assembleRings } from './geom.mjs';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!args.osm || !(args.data || (args.city && args.district))) { console.error('usage: add-areas.mjs --city <city> --district <id> --osm <dir|files> [--write] [--exclude ids] [--report FILE]'); process.exit(2); }
const dataFile = resolveDistrictFile(args.data ? path.resolve(args.data) : path.join(REPO, 'game', 'data', `${args.city}-${args.district}.json`));
const key = args.city && args.district ? `${args.city}-${args.district}` : path.basename(dataFile).replace(/\.(json|bin\.gz)$/, '');
const outFile = args.out ? path.resolve(args.out) : dataFile;
const D = readDistrictData(dataFile), P = D.proj, G = D.district?.geometry, q = D.q || 10;
if (!P || P.compress || P.scale !== 1) throw Error('refusing: only an uncompressed 1:1 district projection is supported');
if (!G || !Array.isArray(D.areaSourceIds) || D.areaSourceIds.length !== D.areas.length) throw Error('refusing: the dataset has no district geometry or no areaSourceIds parallel to areas');
const CLASSES = new Set(String(args.classes || 'water,pool').split(','));
const EXCLUDE = new Set(String(args.exclude || '').split(',').filter(Boolean));
const RING = (D.district.outerRing ?? 600) + 40, MIN_WET_M2 = 4;

const dseg = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)); return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t); };
const margin = (x, z) => { let m = Infinity; for (const pc of G.pieces || []) for (let i = 0; i + 1 < pc.pts.length; i++) m = Math.min(m, dseg(x, z, pc.pts[i], pc.pts[i + 1]) - pc.r); for (const c of G.circles || []) m = Math.min(m, Math.hypot(x - c.x, z - c.z) - c.r); for (const r of G.polys || []) { if (pointInPolygon(x, z, r)) m = Math.min(m, -1); else for (let i = 0, j = r.length - 1; i < r.length; j = i++) m = Math.min(m, dseg(x, z, r[j], r[i])); } return m; };
const proj = (lat, lon) => [(lon - P.lon0) * P.mPerLon, -(lat - P.lat0) * P.mPerLat];
const undelta = (a, o = 0) => { const r = []; let x = 0, z = 0; for (let i = o; i + 1 < a.length; i += 2) { x += a[i]; z += a[i + 1]; r.push([x / q, z / q]); } return r; };
// the build's area encoding (build-data.mjs `delta`, decimetres)
const delta = (pts) => { const out = []; let px = 0, pz = 0; pts.forEach((p, i) => { const x = Math.round(p[0] * 10), z = Math.round(p[1] * 10); if (i === 0) out.push(x, z); else out.push(x - px, z - pz); px = x; pz = z; }); return out; };

/** build-data.mjs areaKindOf, restricted to the classes this tool appends */
function kindOf(t) {
    if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.water) return 'water';
    if (t.amenity === 'fountain' && t.building == null && !/^(splash_pad|bubbler|drinking|nozzle)$/.test(t.fountain || '')) return 'water'; // (a splash pad has no standing water)
    if (t.leisure === 'swimming_pool' && !t.building && !/indoor|yes/.test(t.indoor || '')) return 'pool';
    return null;
}

// ---- OSM input (API 0.6 map.json tiles and / or Overpass JSON); first occurrence of an id wins
const files = String(args.osm).split(',').flatMap(f => { const p = path.resolve(f); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => n.endsWith('.json')).sort().map(n => path.join(p, n)) : [p]; });
const nodes = new Map(), ways = new Map(), rels = new Map(), ledger = [];
for (const f of files) {
    const bytes = fs.readFileSync(f); ledger.push({ file: path.basename(f), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    for (const e of JSON.parse(bytes.toString('utf8')).elements || []) {
        if (e.type === 'node') { if (!nodes.has(e.id)) nodes.set(e.id, e); }
        else if (e.type === 'way') { if (!ways.has(e.id)) ways.set(e.id, e); if (e.geometry && e.nodes) e.nodes.forEach((n, i) => { if (!nodes.has(n) && e.geometry[i]) nodes.set(n, { id: n, lat: e.geometry[i].lat, lon: e.geometry[i].lon }); }); }
        else if (e.type === 'relation') { if (!rels.has(e.id)) rels.set(e.id, e); }
    }
}
const ringPts = (ids) => { const pts = []; for (const n of ids) { const p = nodes.get(n); if (!p) return null; pts.push(proj(p.lat, p.lon)); } return pts; };

// ---- what the dataset already has
const have = new Set(D.areaSourceIds.map(String));
const AK = D.areaKinds, wetRings = D.areas.filter(a => AK[a[0]] === 'water' || AK[a[0]] === 'pool').map(a => undelta(a[2]));
const strIdx = new Map(D.strings.map((s, i) => [s, i])), newStrings = [];
const S = (s) => { if (!s) return -1; let i = strIdx.get(s); if (i === undefined) { i = D.strings.length + newStrings.length; newStrings.push(s); strIdx.set(s, i); } return i; };
const report = { added: [], skipped: [] };
const rows = [], ids = [], tags = {};
const relWays = new Set();
function consider(sourceId, t, outerIds, holesIds) {
    const kind = kindOf(t); if (!kind || !CLASSES.has(kind)) return;
    const rec = { osm: sourceId, kind, tags: Object.fromEntries(Object.entries(t).filter(([k]) => /^(name|natural|water|waterway|amenity|fountain|leisure|location|access|landuse)$/.test(k))) };
    if (have.has(sourceId)) return; // (already a dataset area)
    if (EXCLUDE.has(sourceId)) return report.skipped.push({ ...rec, why: 'excluded (--exclude: modelled by a landmark, or reviewed as stale in OSM)' });
    if (isClosedPoi(t)) return report.skipped.push({ ...rec, why: 'closed / disused' });
    const outer = ringPts(outerIds); if (!outer) return report.skipped.push({ ...rec, why: 'geometry not in the input' });
    const tol = kind === 'water' ? 1.5 : 1.0, so = simplifyRing(outer, tol, tol * 0.6, 2000);
    if (!so) return report.skipped.push({ ...rec, why: 'degenerate ring' });
    const A = Math.abs(polyArea(so)), c = polyCentroid(so), m = margin(c[0], c[1]);
    Object.assign(rec, { areaM2: Math.round(A), edgeM: Math.round(m), lat: +(P.lat0 - c[1] / P.mPerLat).toFixed(7), lon: +(P.lon0 + c[0] / P.mPerLon).toFixed(7) });
    if (A < MIN_WET_M2) return report.skipped.push({ ...rec, why: `under ${MIN_WET_M2} m² (a jet slit / the furniture fountain)` });
    let near = false; for (let i = 0; i < so.length && !near; i += Math.max(1, Math.floor(so.length / 60))) near = margin(so[i][0], so[i][1]) <= RING;
    if (!near && margin(c[0], c[1]) > RING) return report.skipped.push({ ...rec, why: 'outside the area ring' });
    if (wetRings.some(r => pointInPolygon(c[0], c[1], r))) return report.skipped.push({ ...rec, why: 'inside a dataset water / pool area' });
    const holes = []; for (const h of holesIds || []) { const hp = ringPts(h); if (!hp) continue; const sh = simplifyRing(hp, tol, tol * 0.6, 2000); if (sh && Math.abs(polyArea(sh)) > 20) holes.push(sh); }
    rows.push([AK.indexOf(kind), S(t.name || ''), delta(so), ...holes.map(delta)]); ids.push(sourceId);
    const lt = Object.fromEntries(['water', 'natural', 'waterway', ...(t.amenity === 'fountain' ? ['amenity', 'fountain'] : [])].flatMap(k => t[k] != null ? [[k, t[k]]] : []));
    if (Object.keys(lt).length) tags[sourceId] = lt;
    wetRings.push(so); report.added.push(rec);
}
for (const [id, r] of rels) {
    const t = r.tags || {}; if (t.type !== 'multipolygon' || !kindOf(t)) continue;
    const outers = [], inners = [];
    for (const m of r.members || []) if (m.type === 'way' && ways.has(m.ref)) { (m.role === 'inner' ? inners : outers).push(ways.get(m.ref).nodes); relWays.add(m.ref); }
    const o = assembleRings(outers), i2 = assembleRings(inners);
    for (const ring of o.rings) { const op = ringPts(ring); if (!op) continue; const holes = i2.rings.filter(h => { const hp = ringPts([h[0]]); return hp && pointInPolygon(hp[0][0], hp[0][1], op); }); consider('r' + id, t, ring, holes); }
}
for (const [id, w] of ways) {
    const t = w.tags || {}; if (t.building || t.highway) continue;
    if (!w.nodes || w.nodes.length < 4 || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
    if (!kindOf(t) || (relWays.has(id) && Object.keys(t).length <= 1)) continue;
    consider('w' + id, t, w.nodes, null);
}

// furniture fountains standing for a fountain whose outline is added now
const furnOut = [], F = D.furniture || [], fk = D.furnKinds?.indexOf('fountain') ?? -1, fountainRings = [];
rows.forEach((r, i) => { if (tags[ids[i]]?.amenity === 'fountain') fountainRings.push(undelta(r[2])); });
const ringNear = (x, z, r, m) => pointInPolygon(x, z, r) || r.some((p, k) => dseg(x, z, p, r[(k + 1) % r.length]) <= m);
for (let i = 0; i + 2 < F.length; i += 3) {
    if (F[i] !== fk) { furnOut.push(F[i], F[i + 1], F[i + 2]); continue; }
    const x = F[i + 1] / q, z = F[i + 2] / q;
    if (fountainRings.some(r => ringNear(x, z, r, 1))) { report.furnitureRemoved = [...(report.furnitureRemoved || []), { x, z, lat: +(P.lat0 - z / P.mPerLat).toFixed(7), lon: +(P.lon0 + x / P.mPerLon).toFixed(7) }]; continue; }
    furnOut.push(F[i], F[i + 1], F[i + 2]);
}
const digest = crypto.createHash('sha256').update(ledger.map(l => l.sha256).sort().join('')).digest('hex');
if (report.furnitureRemoved) console.log(`  furniture fountains replaced by their outline: ${report.furnitureRemoved.map(f => f.x.toFixed(1) + ',' + f.z.toFixed(1)).join(' ')}`);
console.log(`${key}: ${D.areas.length} areas; +${rows.length} (${report.added.map(a => a.osm + ' ' + a.kind + ' ' + a.areaM2 + 'm²').join(', ') || 'none'}); skipped ${report.skipped.length}`);
for (const s of report.skipped) if (s.why !== 'outside the area ring') console.log('  skip', s.osm, s.kind, s.areaM2 ?? '', s.why);
if (args.report) { fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true }); fs.writeFileSync(path.resolve(args.report), JSON.stringify({ dataset: key, osmFiles: ledger.length, osmDigest: digest, ...report }, null, 1)); }
if (args.write) {
    if (!rows.length) { console.log('nothing to add: dataset left as it is'); process.exit(0); }
    D.areas.push(...rows); D.areaSourceIds.push(...ids); D.strings.push(...newStrings);
    if (Object.keys(tags).length) D.areaSourceTags = { ...(D.areaSourceTags || {}), ...tags };
    if (report.furnitureRemoved) D.furniture = furnOut;
    const run = { tool: 'tools/osm/add-areas.mjs', date: new Date().toISOString().slice(0, 10), osmFiles: ledger.length, osmDigest: digest, minAreaM2: MIN_WET_M2, added: ids, excluded: [...EXCLUDE], furnitureFountainsReplaced: report.furnitureRemoved?.length || 0 };
    D.areaAppend = { schema: 1, runs: [...(D.areaAppend?.runs || []), run] };
    const bytes = writeDistrictData(D, outFile);
    console.log(`wrote ${outFile} ${(bytes / 1048576).toFixed(3)} MiB${bytes > 3 * 1048576 ? '  OVER the 3 MiB budget (spec 10)' : ''}`);
}
