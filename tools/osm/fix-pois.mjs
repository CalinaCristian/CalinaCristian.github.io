#!/usr/bin/env node
// Cached-source POI corrections for a district dataset, without rebuilding it:
//   1. building links (BACKLOG r2-builder-poi-building-link): a node POI the build left without a building (`buildingIndex`
//      −1) because its point lies just outside the footprint (drawn on the yard / pavement side of the wall) is linked to
//      that footprint when exactly one ground footprint is within LINK_M (5 m) and every other one is at least LINK_GAP_M
//      (2.5 m) further away. Only `pois[i][6]` of such rows changes; every link is reported.
//   2. sign anchors (BACKLOG r2-builder-sign-side): where the real sign is, by OSM evidence in this order:
//        a. an OSM `entrance` node of the POI's building (a vertex of its outline, or within 1 m of it) that names the POI
//           (`name` / `ref` = the POI's name or brand), an `entrance=shop` node within 15 m of the POI, or the building's
//           only customer entrance (main / yes) when the POI is the building's only signed business;
//        b. (only with --street) the street of the POI's address (`addr:street`, else the building's): the point on the footprint face that
//           fronts that OSM street, nearest to the POI, written only when the face nearest to the POI does not front it.
//      (The store's own customer car park is already used by world.js for a large store mapped as a central point.)
//      Written as `poiSignAnchors` {poiIndex: [x, z, how, source]}: world.js picks the fascia face / position from the
//      anchor instead of the bare POI point. POI rows do not change for this.
// Everything else in the dataset is left as it is; `poiFix` records provenance.
//
//   node tools/osm/fix-pois.mjs --city bucharest --district romana --osm <dir|files> [--write] [--data F] [--out F] [--report F]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readDistrictData, writeDistrictData, resolveDistrictFile } from './district-data.mjs';
import { poiKind, signText, SIGNED_KIND } from './poi-kinds.mjs';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!args.osm || !(args.data || (args.city && args.district))) { console.error('usage: fix-pois.mjs --city <city> --district <id> --osm <dir|files> [--write] [--report FILE]'); process.exit(2); }
const dataFile = resolveDistrictFile(args.data ? path.resolve(args.data) : path.join(REPO, 'game', 'data', `${args.city}-${args.district}.json`));
const key = args.city && args.district ? `${args.city}-${args.district}` : path.basename(dataFile).replace(/\.(json|bin\.gz)$/, '');
const outFile = args.out ? path.resolve(args.out) : dataFile;
const D = readDistrictData(dataFile), P = D.proj, q = D.q || 10, country = /^seattle/.test(key) ? 'US' : 'RO';
if (!P || P.compress || P.scale !== 1 || D.version !== 2) throw Error('refusing: only an uncompressed 1:1 version-2 district dataset is supported');
const LINK_M = 5, LINK_GAP_M = 2.5;

const dseg = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)); return { d: Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t), t, px: a[0] + ex * t, pz: a[1] + ez * t }; };
const inPoly = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
const ringDist = (x, z, r) => { let d = Infinity; for (let i = 0; i < r.length; i++) d = Math.min(d, dseg(x, z, r[i], r[(i + 1) % r.length]).d); return d; };
const area2 = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a; };
const proj = (lat, lon) => [(lon - P.lon0) * P.mPerLon, -(lat - P.lat0) * P.mPerLat];
const undelta = (a, o) => { const r = []; let x = 0, z = 0; for (let i = o; i + 1 < a.length; i += 2) { x += a[i]; z += a[i + 1]; r.push([x / q, z / q]); } return r; };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const str = (i) => (i >= 0 ? D.strings[i] : '');
const r2 = (v) => Math.round(v * 100) / 100;

// ---- buildings
const B = D.buildings.map((b, i) => {
    const ring = D.buildingFootprints?.[i] || undelta(b, 9), holes = D.buildingHoleFootprints?.[i] || (D.buildingHoles?.[i] || []).map(h => undelta(h, 0)).filter(h => h.length >= 3);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { i, ring, holes, x0, z0, x1, z1, minH: D.buildingDimensions?.[i]?.[1] ?? b[2] / 10, h: D.buildingDimensions?.[i]?.[0] ?? b[1] / 10, flags: b[5], id: D.buildingIds?.[i] || '' };
});
const solid = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(x, z, b.ring) && !b.holes.some(h => inPoly(x, z, h));
const ground = B.filter(b => b.minH < 0.5 && b.h >= 3 && b.ring.length >= 3);

// ---- OSM input
const files = String(args.osm).split(',').flatMap(f => { const p = path.resolve(f); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => n.endsWith('.json')).sort().map(n => path.join(p, n)) : [p]; });
const nodes = new Map(), ways = new Map(), ledger = [];
for (const f of files) {
    const bytes = fs.readFileSync(f); ledger.push({ file: path.basename(f), sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    for (const e of JSON.parse(bytes.toString('utf8')).elements || []) {
        if (e.type === 'node') { if (!nodes.has(e.id)) nodes.set(e.id, e); }
        else if (e.type === 'way') { if (!ways.has(e.id)) ways.set(e.id, e); if (e.geometry && e.nodes) e.nodes.forEach((n, i) => { if (!nodes.has(n) && e.geometry[i]) nodes.set(n, { id: n, lat: e.geometry[i].lat, lon: e.geometry[i].lon }); }); }
    }
}
const P2 = (n) => proj(n.lat, n.lon);
const entranceNodes = [...nodes.values()].filter(n => n.tags?.entrance);
// OSM element of a POI row: poiSources when the row has it, else the classified element of the same name within 3 m
const bySrc = (s) => { const [t, id] = s.split('/'); return t === 'node' ? nodes.get(+id) : t === 'way' ? ways.get(+id) : null; };
const named = [];
for (const e of [...nodes.values(), ...ways.values()]) { const t = e.tags; if (!t || !(t.name || t.brand) || !poiKind(t)) continue; let xz; if (e.type === 'node') xz = P2(e); else { const pts = (e.nodes || []).map(n => nodes.get(n)).filter(Boolean).map(P2); if (!pts.length) continue; xz = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]; } named.push({ e, x: xz[0], z: xz[1], n: norm(signText(t, country).name), b: norm(signText(t, country).brand) }); }
const osmOf = (k, row) => {
    if (D.poiSources?.[k]) return bySrc(D.poiSources[k]) || null;
    const x = row[1] / q, z = row[2] / q, n = norm(str(row[3])), b = norm(str(row[4]));
    let best = null, bd = 3; for (const c of named) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd && ((n && (c.n === n || c.b === n)) || (b && (c.b === b || c.n === b)))) { bd = d; best = c.e; } }
    return best;
};
// streets by name (OSM highway ways)
const streets = new Map();
for (const w of ways.values()) { const t = w.tags; if (!t?.highway || !t.name || /^(footway|path|steps|cycleway|corridor|platform|proposed|construction)$/.test(t.highway)) continue; const pts = (w.nodes || []).map(n => nodes.get(n)).filter(Boolean).map(P2); if (pts.length < 2) continue; (streets.get(norm(t.name)) || streets.set(norm(t.name), []).get(norm(t.name))).push(pts); }
const fronts = (face, street) => { // does the face front this street (a segment of it within 35 m in front of the face's middle third)?
    const segs = streets.get(norm(street)); if (!segs) return false;
    for (const f of [0.35, 0.5, 0.65]) { const mx = face.ax + (face.bx - face.ax) * f, mz = face.az + (face.bz - face.az) * f;
        for (const dd of [4, 10, 18, 26, 35]) { const sx = mx + face.nx * dd, sz = mz + face.nz * dd; for (const pts of segs) for (let i = 0; i + 1 < pts.length; i++) if (dseg(sx, sz, pts[i], pts[i + 1]).d < 3.5) return true; } }
    return false;
};
const facesOf = (b) => { const ccw = area2(b.ring) > 0, out = []; for (let k = 0; k < b.ring.length; k++) { const [ax, az] = b.ring[k], [bx, bz] = b.ring[(k + 1) % b.ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (!ccw) { nx = -nx; nz = -nz; } out.push({ ax, az, bx, bz, L, nx, nz }); } return out; };

const report = { links: [], linksAmbiguous: [], anchors: [], streetCandidates: [] };
// ---- 1. building links
const pois = D.pois.map(r => r.slice());
pois.forEach((r, k) => {
    if (r[6] >= 0) return; const kind = D.poiKinds[r[0]], sub = str(r[5]).split(':')[0]; if (!SIGNED_KIND.test(kind) && !(kind === 'landmark' && /^(museum|gallery|theatre|cinema|arts_centre|library)$/.test(sub))) return; // (a business, a hotel or a museum-like place names its building; an artwork / memorial linked to a building would stop being a freestanding monument)
    const src = D.poiSources?.[k]; if (src && !src.startsWith('node/')) return; // (way / relation POIs: the build already used their own outline)
    const x = r[1] / q, z = r[2] / q; if (ground.some(b => solid(b, x, z))) return;
    const near = ground.map(b => ({ b, d: ringDist(x, z, b.ring) })).filter(o => o.d <= LINK_M + LINK_GAP_M + 1).sort((a, b) => a.d - b.d);
    if (!near.length || near[0].d > LINK_M) return;
    const rec = { poi: k, kind, name: str(r[3]) || str(r[4]), building: near[0].b.id || near[0].b.i, distM: r2(near[0].d), nextM: near[1] ? r2(near[1].d) : null };
    if (near[1] && near[1].d - near[0].d < LINK_GAP_M) { report.linksAmbiguous.push(rec); return; }
    r[6] = near[0].b.i; report.links.push(rec);
});
// ---- 2. sign anchors
const anchors = {};
const tenants = new Map(); pois.forEach((r, k) => { const kind = D.poiKinds[r[0]]; if (SIGNED_KIND.test(kind) && str(r[5]) !== 'atm' && r[6] >= 0) (tenants.get(r[6]) || tenants.set(r[6], []).get(r[6])).push(k); });
const EXCL = /^(staircase|service|emergency|exit|garage|home|private|no|emergency_exit|delivery)$/;
const osmWay = (id) => (/^w\d+$/.test(id) ? ways.get(+id.slice(1)) : null);
pois.forEach((r, k) => {
    const kind = D.poiKinds[r[0]]; if (!SIGNED_KIND.test(kind) || str(r[5]) === 'atm' || r[6] < 0) return;
    const b = B[r[6]]; if (!b) return;
    const x = r[1] / q, z = r[2] / q, name = norm(str(r[3])), brand = norm(str(r[4])), e = osmOf(k, r), t = e?.tags || {};
    // a. entrances of this building
    const w = osmWay(b.id), ent = [];
    const cand = new Set(w?.nodes || []);
    for (const n of entranceNodes) if (!cand.has(n.id)) { const [ex, ez] = P2(n); if (ex >= b.x0 - 1 && ex <= b.x1 + 1 && ez >= b.z0 - 1 && ez <= b.z1 + 1 && ringDist(ex, ez, b.ring) <= 1) cand.add(n.id); }
    for (const id of cand) { const n = nodes.get(id); if (!n?.tags?.entrance || EXCL.test(n.tags.entrance)) continue; const [ex, ez] = P2(n); if (ringDist(ex, ez, b.ring) > 1) continue; ent.push({ n, x: ex, z: ez, kind: n.tags.entrance, label: norm(n.tags.name || n.tags.ref || '') }); }
    let pick = ent.find(o => o.label && (o.label === name || o.label === brand)) || null, how = pick ? 'entrance named for the POI' : '';
    if (!pick) { const shops = ent.filter(o => o.kind === 'shop').map(o => ({ ...o, d: Math.hypot(o.x - x, o.z - z) })).filter(o => o.d <= 15).sort((a, c) => a.d - c.d); if (shops.length) { pick = shops[0]; how = 'nearest entrance=shop'; } }
    if (!pick && (tenants.get(r[6]) || []).length === 1) { const main = ent.filter(o => /^(main|yes)$/.test(o.kind)); if (main.length === 1) { pick = main[0]; how = 'the building\'s only customer entrance'; } }
    if (pick) { if (Math.hypot(pick.x - x, pick.z - z) > 1.5) { anchors[k] = [r2(pick.x), r2(pick.z), 'entrance', 'node/' + pick.n.id]; report.anchors.push({ poi: k, name: str(r[3]) || str(r[4]), building: b.id, how, source: 'node/' + pick.n.id, movedM: r2(Math.hypot(pick.x - x, pick.z - z)) }); } return; }
    // b. the street of the address: only with --street (round 3: ~260 candidates in 8 districts, not reviewed one by one;
    //    a sample moved Unirea Shopping Center's interior KFC / Mega Image 57 m onto the Piața Unirii facade). Reported always.
    const street = t['addr:street'] || ''; if (!street || !streets.has(norm(street))) return; // (the POI's OWN address: a building's address is not where each tenant's sign is - the Sheraton's Calea Dorobanților address would have moved Alpha Bank off its Bd. Dacia front)
    const faces = facesOf(b); if (!faces.length) return;
    const nearest = faces.map(f => ({ f, ...dseg(x, z, [f.ax, f.az], [f.bx, f.bz]) })).sort((a, c) => a.d - c.d)[0];
    if (fronts(nearest.f, street)) return; // (the face nearest to the point already fronts the address street)
    const ok = faces.filter(f => f.L >= 4 && fronts(f, street)).map(f => ({ f, ...dseg(x, z, [f.ax, f.az], [f.bx, f.bz]) })).sort((a, c) => a.d - c.d);
    if (!ok.length) return;
    const o = ok[0], tt = Math.max(0.15, Math.min(0.85, o.t)), ax = o.f.ax + (o.f.bx - o.f.ax) * tt, az = o.f.az + (o.f.bz - o.f.az) * tt;
    if (args.street) anchors[k] = [r2(ax), r2(az), 'street', street];
    report[args.street ? 'anchors' : 'streetCandidates'].push({ poi: k, name: str(r[3]) || str(r[4]), building: b.id, how: 'face on the address street', source: street, movedM: r2(Math.hypot(ax - x, az - z)) });
});

const changed = pois.filter((r, k) => r[6] !== D.pois[k][6]).length;
console.log(`${key}: links ${report.links.length} (${report.links.map(l => `${l.name} → ${l.building} @${l.distM}m`).join('; ')}), ambiguous ${report.linksAmbiguous.length}; sign anchors ${Object.keys(anchors).length} (entrance ${report.anchors.filter(a => a.how !== 'face on the address street').length}, street ${report.anchors.filter(a => a.how === 'face on the address street').length}; address-street candidates not applied ${report.streetCandidates.length})`);
if (args.report) { fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true }); fs.writeFileSync(path.resolve(args.report), JSON.stringify({ dataset: key, osmFiles: ledger.length, ...report }, null, 1)); }
if (args.write) {
    if (!changed && !Object.keys(anchors).length) { console.log('nothing to change: dataset left as it is'); process.exit(0); }
    D.pois = pois;
    if (Object.keys(anchors).length) D.poiSignAnchors = { ...(D.poiSignAnchors || {}), ...anchors };
    const digest = crypto.createHash('sha256').update(ledger.map(l => l.sha256).sort().join('')).digest('hex');
    D.poiFix = { schema: 1, runs: [...(D.poiFix?.runs || []), { tool: 'tools/osm/fix-pois.mjs', date: new Date().toISOString().slice(0, 10), osmFiles: ledger.length, osmDigest: digest, linkM: LINK_M, linkGapM: LINK_GAP_M, links: report.links.map(l => [l.poi, l.building]), anchors: Object.keys(anchors).length }] };
    const bytes = writeDistrictData(D, outFile);
    console.log(`wrote ${outFile} ${(bytes / 1048576).toFixed(3)} MiB`);
}
