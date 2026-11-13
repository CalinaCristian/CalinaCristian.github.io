#!/usr/bin/env node
// Cached-source POI append: adds the OSM businesses, public places and transit stops a district dataset lost, without
// rebuilding it. Roads, buildings, trees, areas and every existing POI row keep their values and their indices; only
//   pois            new rows appended ([kind, x, z, name, brand, sub, buildingIndex], same schema)
//   strings         new strings appended (existing indices unchanged)
//   furniture       appended [kind, x, z] rows for small amenity=fountain ways (--fountains, default on)
//   poiSources      (new, optional) {poiIndex: 'node/…' | 'way/…' | 'relation/…'} for the appended rows
//   buildingOwnTags (new, optional) {buildingSourceId: {name, tourism?, brand?, 'addr:street'?}}: a signed building's own OSM
//                   name where the build gave its sign to a tenant POI (world.js shows the building's name; the tenant keeps
//                   its unit fascia)
//   poiAppend       (new) provenance: tool, date, edge distance, OSM input ledger, counts
// are written. `generated` is not touched.
//
//   node tools/osm/add-pois.mjs --city bucharest --district unirii --osm <dir | file[,file]> [--edge 100] [--write]
//        [--data FILE] [--out FILE] [--report FILE] [--no-fountains] [--no-building-names]
//
// --osm: OSM API 0.6 `map.json` tiles (https://api.openstreetmap.org/api/0.6/map.json?bbox=w,s,e,n; tile the district and
//        its edge strip) and / or Overpass `out body geom;` JSON. Downloads stay outside the repo. First occurrence of an id wins.
// What is added (tools/osm/poi-kinds.mjs):
//   1. everything the build's own classifier keeps, when the element lies up to --edge metres OUTSIDE the playable edge
//      (the build kept POIs only inside it: frontages across the edge street had no businesses, stops or metro entrances);
//   2. the classes the build drops (nightclub, gallery, fitness / gaming centre, craft, kindergarten, healthcare, every
//      named office kind, courthouse, marketplace …), inside the area and in the edge strip;
//   3. POIs mapped as multipolygon relations (the build reads nodes and ways only);
//   4. anything of 1–3 inside the area that live OSM has and the dataset does not (mapped after the build).
// Never added: closed / disused / vacant / under-construction objects, businesses the research marks stale
// (`businesses-<city>-<district>.json` flag "not in official locator") or closed (`businesses-gamediff.json` closed),
// units that are not at street level (level ≠ 0, indoor, underground; a node deep inside a multi-tenant hall of over
// 3000 m²: mall gallery, terminal) and anything already in the dataset (same name
// within 40 m, or the same kind within 1 m; transit: same kind within 8 m). Without --write nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readDistrictData, writeDistrictData, resolveDistrictFile } from './district-data.mjs';
import { poiKind, basePoiKind, isClosedPoi, isOffStreet, signText } from './poi-kinds.mjs';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const researchDir = args.research ? path.resolve(args.research) : path.join(REPO, 'game', 'research');
if (!args.osm || !(args.data || (args.city && args.district))) { console.error('usage: add-pois.mjs --city <city> --district <id> --osm <dir|files> [--edge 100] [--write] [--data FILE] [--out FILE] [--report FILE]'); process.exit(2); }
const dataFile = resolveDistrictFile(args.data ? path.resolve(args.data) : path.join(REPO, 'game', 'data', `${args.city}-${args.district}.json`));
const key = args.city && args.district ? `${args.city}-${args.district}` : path.basename(dataFile).replace(/\.(json|bin\.gz)$/, '');
const outFile = args.out ? path.resolve(args.out) : dataFile, EDGE = Number(args.edge ?? 100);
const D = readDistrictData(dataFile), P = D.proj, G = D.district?.geometry;
if (!P || P.compress || P.scale !== 1) throw Error('refusing: only an uncompressed 1:1 district projection is supported');
if (!G) throw Error('refusing: the dataset has no district.geometry (exact playable boundary)');
if (!Array.isArray(D.pois) || !Array.isArray(D.strings) || D.version !== 2) throw Error('refusing: unexpected dataset schema');
const country = /^seattle/.test(key) ? 'US' : 'RO', q = D.q || 10;

// ---- geometry helpers
const dseg = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)); return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t); };
const inPoly = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
/** metres outside the playable area (≤ 0 inside): exact union of buffered polylines, circles and polygons */
const margin = (x, z) => { let m = Infinity; for (const pc of G.pieces || []) for (let i = 0; i + 1 < pc.pts.length; i++) m = Math.min(m, dseg(x, z, pc.pts[i], pc.pts[i + 1]) - pc.r); for (const c of G.circles || []) m = Math.min(m, Math.hypot(x - c.x, z - c.z) - c.r); for (const r of G.polys || []) { if (inPoly(x, z, r)) m = Math.min(m, -1); else for (let i = 0, j = r.length - 1; i < r.length; j = i++) m = Math.min(m, dseg(x, z, r[j], r[i])); } return m; };
const proj = (lat, lon) => [(lon - P.lon0) * P.mPerLon, -(lat - P.lat0) * P.mPerLat];
const area2 = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a; };
const centroid = (r) => { const A = area2(r); if (Math.abs(A) < 1e-6) return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; let cx = 0, cz = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; cx += (r[j][0] + r[i][0]) * f; cz += (r[j][1] + r[i][1]) * f; } return [cx / (3 * A), cz / (3 * A)]; };
const undelta = (a, o) => { const r = []; let x = 0, z = 0; for (let i = o; i + 1 < a.length; i += 2) { x += a[i]; z += a[i + 1]; r.push([x / q, z / q]); } return r; };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const str = (i) => (i >= 0 ? D.strings[i] : '');

// ---- the dataset's buildings (precise footprints where the data has them) and existing POIs
const B = D.buildings.map((b, i) => {
    const ring = D.buildingFootprints?.[i] || undelta(b, 9), holes = D.buildingHoleFootprints?.[i] || (D.buildingHoles?.[i] || []).map(h => undelta(h, 0)).filter(h => h.length >= 3);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { i, ring, holes, x0, z0, x1, z1, area: Math.abs(area2(ring)) / 2, minH: D.buildingDimensions?.[i]?.[1] ?? b[2] / 10, flags: b[5], name: str(b[4]), id: D.buildingIds?.[i] || '' };
});
const CELL = 32, grid = new Map(), cellsOf = (b) => { const r = []; for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++) for (let j = Math.floor(b.z0 / CELL); j <= Math.floor(b.z1 / CELL); j++) r.push(i + ',' + j); return r; };
for (const b of B) for (const k of cellsOf(b)) (grid.get(k) || grid.set(k, []).get(k)).push(b);
const solid = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(x, z, b.ring) && !b.holes.some(h => inPoly(x, z, h));
/** the ground-based footprint containing the point (the largest: an outline rather than one of its parts) */
const buildingAt = (x, z) => { let best = null; for (const b of grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || []) if (b.minH < 0.5 && solid(b, x, z) && (!best || b.area > best.area)) best = b; return best; };
const byId = new Map(); for (const b of B) if (b.id) (byId.get(b.id) || byId.set(b.id, []).get(b.id)).push(b);
const existing = D.pois.map(p => ({ kind: D.poiKinds[p[0]], x: p[1] / q, z: p[2] / q, name: norm(str(p[3])), brand: norm(str(p[4])) }));
const known = new Set(Object.values(D.poiSources || {})); // appended by an earlier run

// ---- OSM input: API 0.6 map.json tiles and / or Overpass JSON; first occurrence of an id wins
const files = String(args.osm).split(',').flatMap(f => { const p = path.resolve(f); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => n.endsWith('.json')).sort().map(n => path.join(p, n)) : [p]; });
if (!files.length) throw Error('no OSM JSON input');
const nodes = new Map(), ways = new Map(), rels = new Map(), ledger = [];
for (const f of files) {
    const bytes = fs.readFileSync(f); ledger.push({ file: path.basename(f), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    for (const e of JSON.parse(bytes.toString('utf8')).elements || []) {
        if (e.type === 'node') { if (!nodes.has(e.id)) nodes.set(e.id, e); }
        else if (e.type === 'way') { if (!ways.has(e.id)) ways.set(e.id, e); if (e.geometry && e.nodes) e.nodes.forEach((n, i) => { if (!nodes.has(n) && e.geometry[i]) nodes.set(n, { id: n, lat: e.geometry[i].lat, lon: e.geometry[i].lon }); }); }
        else if (e.type === 'relation') { if (!rels.has(e.id)) rels.set(e.id, e); }
    }
}
const wayRing = (w) => { const pts = []; for (const n of w.nodes || []) { const p = nodes.get(n); if (!p) return null; pts.push(proj(p.lat, p.lon)); } return pts; };
/** [x, z, closed outer ring | null] of an element, or null when its geometry is not in the input */
function locate(e) {
    if (e.type === 'node') return [...proj(e.lat, e.lon), null];
    if (e.type === 'way') { const r = wayRing(e); if (!r || r.length < 2) return null; const closed = e.nodes[0] === e.nodes[e.nodes.length - 1] && r.length >= 4; if (closed) { const ring = r.slice(0, -1); return [...centroid(ring), ring]; } const m = r[Math.floor(r.length / 2)]; return [m[0], m[1], null]; }
    let best = null; const all = [];
    for (const m of e.members || []) { if (m.type !== 'way' || (m.role && m.role !== 'outer')) continue; const w = ways.get(m.ref); const r = w && wayRing(w); if (!r) continue; all.push(...r); if (w.nodes[0] === w.nodes[w.nodes.length - 1] && r.length >= 4) { const ring = r.slice(0, -1); if (!best || Math.abs(area2(ring)) > Math.abs(area2(best))) best = ring; } }
    if (best) return [...centroid(best), best];
    if (!all.length) return null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return [(x0 + x1) / 2, (z0 + z1) / 2, null];
}

// ---- research: stale / closed businesses are never (re)added
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const research = readJson(path.join(researchDir, `businesses-${key}.json`)) || [], gamediff = readJson(path.join(researchDir, 'businesses-gamediff.json'))?.[key] || {};
const banned = [];
for (const e of research) if (e.flag === 'not in official locator' || /^Microsoft Store$/i.test(e.name || '')) banned.push({ osm: e.osm || '', xz: e.lat ? proj(e.lat, e.lon) : null, label: norm(e.brand || e.name), why: 'research: stale' });
for (const c of gamediff.closed || []) banned.push({ osm: c.osm || '', xz: c.lat ? proj(c.lat, c.lon) : null, label: norm(c.brand || c.name), why: 'research: closed' });

// ---- candidates
const strIdx = new Map(D.strings.map((s, i) => [s, i])), newStrings = [];
const S = (s) => { if (!s) return -1; let i = strIdx.get(s); if (i === undefined) { i = D.strings.length + newStrings.length; newStrings.push(s); strIdx.set(s, i); } return i; };
const rows = [], sources = [], seen = new Set(), report = { added: [], skipped: {}, buildingNames: [], buildingNamesKept: [], fountains: [], edgeHistogram: {} };
const skip = (why) => { report.skipped[why] = (report.skipped[why] || 0) + 1; };
// interior units: a node more than 10 m inside a footprint over 3000 m² that holds four or more businesses is a unit of a
// mall / hypermarket gallery / terminal, not a street frontage (OSM rarely tags `level` there: Carrefour Orhideea's gallery
// came out as fascias on the hypermarket's outer wall). A single business in a big box, and anything mapped as a way, stays.
const ownBuilding = (e) => (e.type !== 'node' ? (byId.get((e.type === 'way' ? 'w' : 'r') + e.id) || []).filter(b => b.minH < 0.5).sort((a, b) => b.area - a.area)[0] : null) || null;
const tenants = new Map(), SIGNED = /^(food|shop|bank|pharmacy|hotel)$/;
for (const e of [...nodes.values(), ...ways.values()]) {
    const t = e.tags, k = t && poiKind(t); if (!k || !SIGNED.test(k[0]) || k[1] === 'atm' || !(t.name || t.brand) || isClosedPoi(t)) continue;
    const loc = locate(e); if (!loc) continue; const b = ownBuilding(e) || buildingAt(loc[0], loc[1]); if (b) tenants.set(b.i, (tenants.get(b.i) || 0) + 1);
}
const ringDist = (x, z, r) => { let d = Infinity; for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, dseg(x, z, r[j], r[i])); return d; };
const consider = (e) => {
    const t = e.tags; if (!t) return;
    if (e.type === 'relation' && /^(route|route_master|restriction|public_transport|boundary|network|associatedStreet|street)$/.test(t.type || '')) return;
    const k = poiKind(t); if (!k) return;
    const osm = `${e.type}/${e.id}`;
    if (known.has(osm)) return skip('appended by an earlier run');
    if (isClosedPoi(t)) return skip('closed / disused / vacant');
    const st = signText(t, country), name = st.name || st.brand || '', transit = k[0] === 'busstop' || k[0] === 'metro';
    if (!transit && !name) return skip('no name');
    const loc = locate(e); if (!loc) return skip('geometry not in the input');
    const [x, z] = loc, m = margin(x, z);
    { const hb = m <= 0 ? 'inside' : m <= 60 ? '0-60' : m <= 150 ? '60-150' : m <= 300 ? '150-300' : '>300'; report.edgeHistogram[hb] = (report.edgeHistogram[hb] || 0) + 1; } // (every classified, open, named OSM object in the input)
    if (m > EDGE) return;
    const signed = /^(food|shop|bank|pharmacy|hotel)$/.test(k[0]);
    if (signed && k[1] !== 'atm' && isOffStreet(t)) return skip('not at street level (level / indoor)');
    if (k[1] === 'atm' && m > 0) return skip('ATM outside the area'); // (an ATM is a map marker only: nothing to see across the edge)
    if (banned.some(b => (b.osm && b.osm === osm) || (b.xz && b.label && Math.hypot(b.xz[0] - x, b.xz[1] - z) < 35 && b.label === norm(st.brand || st.name)))) return skip('research: stale or closed');
    const nn = norm(st.name), nb = norm(st.brand);
    if (existing.some(p => { const d = Math.hypot(p.x - x, p.z - z); return (p.kind === k[0] && d < (transit ? 8 : 1)) || (!transit && d < 40 && ((nn && (p.name === nn || p.brand === nn)) || (nb && (p.brand === nb || p.name === nb)))); })) return skip('already in the dataset');
    // the building: its own outline when the element is a mapped building, else the ground footprint at the point
    const b = ownBuilding(e) || buildingAt(x, z);
    if (signed && k[0] !== 'hotel' && e.type === 'node' && b && b.area > 3000 && (tenants.get(b.i) || 0) >= 4 && ringDist(x, z, b.ring) > 10) return skip('interior unit (deep inside a multi-tenant hall)');
    const dk = k[0] + '|' + name + '|' + Math.round(x / 15) + '|' + Math.round(z / 15); if (seen.has(dk)) return skip('duplicate in OSM (same kind and name within 15 m)'); seen.add(dk);
    rows.push([D.poiKinds.indexOf(k[0]), Math.round(x * q), Math.round(z * q), S(st.name), S(st.brand), S(k[1] + (t.cuisine ? ':' + t.cuisine : '')), b ? b.i : -1]);
    sources.push(osm);
    report.added.push({ osm, kind: k[0], sub: k[1], name: st.name, brand: st.brand, lat: +(P.lat0 - z / P.mPerLat).toFixed(7), lon: +(P.lon0 + x / P.mPerLon).toFixed(7), edgeM: Math.round(m), building: b ? (b.id || b.i) : null, cls: basePoiKind(t) ? (e.type === 'relation' ? 'relation' : m > 0 ? 'edge' : 'new in OSM / filtered by the build') : 'dropped class' });
};
for (const e of nodes.values()) consider(e);
for (const e of ways.values()) consider(e);
for (const e of rels.values()) consider(e);
if (rows.some(r => r[0] < 0)) throw Error('a kind is missing from the dataset poiKinds table');

// ---- a signed building's own name (the build signs a building with the first POI inside it)
const ownTags = {};
if (!args['no-building-names']) for (const e of [...ways.values(), ...rels.values()]) {
    const t = e.tags; if (!t || !t.building || !t.name) continue;
    const id = (e.type === 'way' ? 'w' : 'r') + e.id, bs = byId.get(id); if (!bs || bs.length !== 1) continue; // (a relation with several outers has no single sign)
    const b = bs[0]; if ((b.flags & 32) || !(b.flags & 2) || D.buildingOwnTags?.[id]) continue;
    const name = signText(t, country).name; if (!name || !norm(b.name) || norm(b.name).includes(norm(name)) || norm(name).includes(norm(b.name))) continue; // (the sign already names it)
    // only where the tenant keeps a sign of its own: a street-level business (unit fascia), or the building is itself a hotel.
    // A faculty, clinic, museum or office tenant has no unit fascia in world.js: its name stays on the building.
    const lodging = /^(hotel|hostel|motel|guest_house)$/.test(t.tourism || '');
    const tenant = D.pois.find(p => p[6] === b.i && norm(str(p[4]) || str(p[3])) === norm(b.name)), tk = tenant ? D.poiKinds[tenant[0]] : '';
    if (!lodging && !/^(food|shop|bank|pharmacy)$/.test(tk)) { report.buildingNamesKept.push({ building: id, own: name, signedAs: b.name, tenantKind: tk || 'unknown' }); continue; }
    // build-data.mjs: what makes a building's own name a sign (not an address, a block number or a plain residential name)
    const n2 = name.toLowerCase().replace(/^(strada|str\.?|bulevardul|bd\.?|calea|șoseaua|sos\.?|intrarea|aleea|piața)\s+/, '').trim(), stt = String(t['addr:street'] || '').toLowerCase().replace(/^(strada|bulevardul|calea|șoseaua|intrarea|aleea|piața)\s+/, '').trim();
    const addrLike = /^\D*\d+[a-z]?(\s*[-,]\s*\d+[a-z]?)?$/i.test(n2) && (!stt || n2.startsWith(stt.slice(0, 6)) || /^(nr\.?|no\.?)\s*\d/.test(n2)) || (t['addr:housenumber'] && n2.endsWith(' ' + String(t['addr:housenumber']).toLowerCase()) && stt && n2.startsWith(stt.slice(0, 5)));
    const residential = /^(residential|apartments|house|detached|semidetached_house|terrace|villa|dormitory|yes)$/.test(t.building || '') && !(t.amenity || t.shop || t.office || t.tourism || t.healthcare || t.leisure || t.historic || t.wikidata || t.wikipedia); // (a named house with its own encyclopedia entry is a known place: Casa Gheorghe Petrașcu)
    if (addrLike || residential || /^(bl(oc)?\.?|block|scara|sc\.|cl[aă]direa|corp(ul)?|building|bldg\.?)\s*\S{1,5}$/i.test(name.trim())) continue; // ("Clădirea B+C", "Corp BN": a lettered wing, not a sign)
    ownTags[id] = { name, ...(lodging ? { tourism: t.tourism, ...(t.brand ? { brand: signText(t, country).brand } : {}) } : {}), ...(t['addr:street'] ? { 'addr:street': t['addr:street'] } : {}) };
    report.buildingNames.push({ building: id, own: name, signedAs: b.name, lodging });
}

// ---- small fountains mapped as ways (the build keeps amenity=fountain nodes only): the same street-furniture fountain
const furn = [];
if (!args['no-fountains'] && D.furnKinds?.includes('fountain')) {
    const F = D.furniture || [], fk = D.furnKinds.indexOf('fountain'), have = []; for (let i = 0; i + 2 < F.length; i += 3) if (F[i] === fk) have.push([F[i + 1] / q, F[i + 2] / q]);
    const AK = D.areaKinds, water = (D.areas || []).filter(a => AK[a[0]] === 'water' || AK[a[0]] === 'pool').map(a => undelta(a[2], 0));
    for (const e of [...ways.values(), ...rels.values()]) {
        const t = e.tags; if (!t || t.amenity !== 'fountain' || isClosedPoi(t)) continue;
        const loc = locate(e); if (!loc) continue; const [x, z, ring] = loc; if (margin(x, z) > 0) continue;
        const A = ring ? Math.abs(area2(ring)) / 2 : 0, rec = { osm: `${e.type}/${e.id}`, name: t.name || '', lat: +(P.lat0 - z / P.mPerLat).toFixed(7), lon: +(P.lon0 + x / P.mPerLon).toFixed(7), areaM2: Math.round(A) };
        if (water.some(w => inPoly(x, z, w))) { report.fountains.push({ ...rec, status: 'already a water area in the dataset' }); continue; }
        if (have.some(h => Math.hypot(h[0] - x, h[1] - z) < 4)) { report.fountains.push({ ...rec, status: 'already a furniture fountain' }); continue; }
        if (buildingAt(x, z)) { report.fountains.push({ ...rec, status: 'inside a building footprint: not added' }); continue; }
        // the furniture fountain is a 3.2 m bowl: a larger basin needs its outline as water, which this tool does not write
        if (A > 30) { report.fountains.push({ ...rec, status: 'basin larger than the furniture fountain: NOT added (needs its outline as a water area)' }); continue; }
        furn.push(fk, Math.round(x * q), Math.round(z * q)); have.push([x, z]); report.fountains.push({ ...rec, status: 'added as furniture fountain' });
    }
}

// ---- write
const n0 = D.pois.length, byKind = {}, byClass = {};
for (const a of report.added) { byKind[a.kind] = (byKind[a.kind] || 0) + 1; byClass[a.cls] = (byClass[a.cls] || 0) + 1; }
const digest = crypto.createHash('sha256').update(ledger.map(l => l.sha256).sort().join('')).digest('hex');
console.log(`${key}: ${n0} POIs in the dataset; +${rows.length} (${JSON.stringify(byClass)}) by kind ${JSON.stringify(byKind)}; +${newStrings.length} strings; own building names ${report.buildingNames.length}; fountains +${furn.length / 3}; skipped ${JSON.stringify(report.skipped)}`);
if (args.report) { fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true }); fs.writeFileSync(path.resolve(args.report), JSON.stringify({ dataset: key, edgeM: EDGE, osmFiles: ledger.length, osmDigest: digest, existing: n0, byKind, byClass, ...report }, null, 1)); }
if (args.write) {
    if (!rows.length && !Object.keys(ownTags).length && !furn.length) { console.log('nothing to add: dataset left as it is'); process.exit(0); }
    D.pois.push(...rows); D.strings.push(...newStrings);
    if (furn.length) D.furniture = [...(D.furniture || []), ...furn];
    if (rows.length) D.poiSources = { ...(D.poiSources || {}), ...Object.fromEntries(sources.map((s, i) => [n0 + i, s])) };
    if (Object.keys(ownTags).length) D.buildingOwnTags = { ...(D.buildingOwnTags || {}), ...ownTags };
    const run = { tool: 'tools/osm/add-pois.mjs', date: new Date().toISOString().slice(0, 10), edgeM: EDGE, osmFiles: ledger.length, osmDigest: digest, addedPois: rows.length, byClass, ownBuildingNames: Object.keys(ownTags).length, fountains: furn.length / 3 };
    D.poiAppend = { schema: 1, runs: [...(D.poiAppend?.runs || []), run] };
    const bytes = writeDistrictData(D, outFile);
    console.log(`wrote ${outFile} ${(bytes / 1048576).toFixed(3)} MiB${bytes > 3 * 1048576 ? '  OVER the 3 MiB budget (spec 10)' : ''}`);
}
