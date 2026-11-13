#!/usr/bin/env node
// ============================================================================
//  Reachable places per chapter district (round 5, notes 9/18) → game/data/places.json
//  Run after the district builds / POI appends:  node tools/osm/places.mjs [--repo DIR] [--data-dir DIR] [--out FILE]
//  (reads the district packs through district-data.mjs; --repo: where game/src and game/data are read from, --data-dir:
//  another folder of district files, --out: another output file; defaults = this repo, game/data, game/data/places.json)
//  For every district: CV stops, landmarks (minus `scenery`), tourist-spot entrances, fuel, notable (branded)
//  businesses, named parks and transit stops that lie INSIDE the playable area and next to a drivable street
//  there, with lat/lon (world-map hub) and district game metres x/z (minimap). Categories + legend in `legend`.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readDistrictData, resolveDistrictFile } from './district-data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : null; };
const REPO = arg('repo') ? path.resolve(arg('repo')) : path.resolve(HERE, '..', '..');
const DATA = arg('data-dir') ? path.resolve(arg('data-dir')) : path.join(REPO, 'game', 'data');
const OUT = arg('out') ? path.resolve(arg('out')) : path.join(REPO, 'game', 'data', 'places.json');
const mod = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { CITIES, CHAPTERS } = await mod('game/src/cities.js');
const { LANDMARKS } = await mod('game/src/landmarks.js');
let SPOTS = [];
try { SPOTS = (await mod('game/src/spots/index.js')).SPOTS || []; } catch (e) { console.warn('places: no SPOTS', e.message); }

export const LEGEND = [
    { cat: 'cv', label: 'CV stop', icon: '★', color: '#f97316' },
    { cat: 'landmark', label: 'Landmark', icon: '🏛', color: '#7c3aed' },
    { cat: 'spot', label: 'Tourist spot (walk)', icon: '📷', color: '#0d9488' },
    { cat: 'fuel', label: 'Fuel', icon: '⛽', color: '#d97706' },
    { cat: 'business', label: 'Shop / café / bank', icon: '🛍', color: '#db2777' },
    { cat: 'park', label: 'Park', icon: '🌳', color: '#16a34a' },
    { cat: 'transit', label: 'Metro / tram / train', icon: 'M', color: '#2563eb' },
];

const NAVFIX = fs.existsSync(path.join(HERE, 'places-navfix.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'places-navfix.json'), 'utf8')) : {};
const out = { generated: new Date().toISOString().slice(0, 10), legend: LEGEND, districts: {} };
for (const [cityId, city] of Object.entries(CITIES)) {
    for (const [did, dc] of Object.entries(city.districts || {})) {
        const f = resolveDistrictFile(path.join(DATA, `${cityId}-${did}.json`)); if (!fs.existsSync(f)) continue; // (.bin.gz pack or JSON)
        const d = readDistrictData(f);
        const S = (i) => (i >= 0 ? d.strings[i] : ''), P = d.proj, N = d.nodes;
        const xy = (lat, lon) => [(lon - P.lon0) * P.mPerLon, -(lat - P.lat0) * P.mPerLat];
        const ll = (x, z) => [+(P.lat0 - z / P.mPerLat).toFixed(6), +(P.lon0 + x / P.mPerLon).toFixed(6)];
        const m = d.district.mask, bits = new Uint8Array(m.w * m.h); { let k = 0, v = 0; for (const run of m.rle) { bits.fill(v, k, k + run); k += run; v ^= 1; } }
        const inside = (x, z) => { const i = Math.floor((x - m.x0) / m.cell), j = Math.floor((z - m.z0) / m.cell); return i >= 0 && j >= 0 && i < m.w && j < m.h && bits[j * m.w + i] === 1; };
        // drivable street segments inside the area (no service roads, no motorways: a place must be reachable from a street)
        // only the largest connected piece of the network counts (fragments cut off by the boundary are drivable but unreachable)
        const par = new Map(); const find = (a) => { while (par.get(a) !== a) { par.set(a, par.get(par.get(a))); a = par.get(a); } return a; };
        const uni = (a, b) => { for (const k of [a, b]) if (!par.has(k)) par.set(k, k); par.set(find(a), find(b)); };
        for (const r of d.roads) { const ns = r.slice(10); for (let i = 0; i < ns.length - 1; i++) uni(ns[i], ns[i + 1]); }
        const size = new Map(); for (const k of par.keys()) { const rt = find(k); size.set(rt, (size.get(rt) || 0) + 1); }
        const mainRoot = [...size.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        // and only streets you can drive to from a chapter start without leaving the area (directed, one-ways respected;
        // the nav's SCC joins map ends through 'the outside', which A* cannot route through)
        const fw = new Map(), bw = new Map(); const link = (M, a, b) => { if (!M.has(a)) M.set(a, []); M.get(a).push(b); };
        for (const r of d.roads) { const ns = r.slice(10), ow = r[8] & 1; for (let i = 0; i < ns.length - 1; i++) { link(fw, ns[i], ns[i + 1]); link(bw, ns[i + 1], ns[i]); if (!ow) { link(fw, ns[i + 1], ns[i]); link(bw, ns[i], ns[i + 1]); } } }
        const reach = (M, s0) => { const seen = new Set([s0]), st = [s0]; while (st.length) { const u = st.pop(); for (const v of M.get(u) || []) if (!seen.has(v)) { seen.add(v); st.push(v); } } return seen; };
        const chs = CHAPTERS.filter(c => c.city === cityId && c.district === did);
        let strong = null;
        for (const ch of chs) {
            const [sx, sz] = xy(ch.start.lat, ch.start.lon); let best = null, bd = Infinity;
            for (const n of fw.keys()) { const dd = Math.hypot(N[2 * n] / 10 - sx, N[2 * n + 1] / 10 - sz); if (dd < bd) { bd = dd; best = n; } }
            const sc = reach(fw, best); // everything you can drive to from the chapter start
            strong = strong ? new Set([...strong, ...sc]) : sc;
        }
        const segs = [];
        for (const r of d.roads) {
            const cls = d.classes[r[1]]; if (cls === 'service' || /motorway/.test(cls)) continue;
            const ns = r.slice(10);
            if (find(ns[0]) !== mainRoot) continue;
            if (strong && !(r[8] & 1 ? strong.has(ns[0]) : ns.some(n => strong.has(n)))) continue;
            for (let i = 0; i < ns.length - 1; i++) {
                const a = [N[2 * ns[i]] / 10, N[2 * ns[i] + 1] / 10], b = [N[2 * ns[i + 1]] / 10, N[2 * ns[i + 1] + 1] / 10];
                if (inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) segs.push([a, b]);
            }
        }
        const streetDist = (x, z) => { let best = Infinity; for (const [a, b] of segs) { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2)); best = Math.min(best, Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z)); } return best; };
        const reachable = (x, z, slack = 80) => inside(x, z) && streetDist(x, z) <= slack;
        const cats = { cv: [], landmark: [], spot: [], fuel: [], business: [], park: [], transit: [] };
        // nav point: the nearest point on a street reachable from the chapter start (route there, not to the icon)
        const navPoint = (x, z) => { let best = null, bd = Infinity; for (const [a, b] of segs) { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0.05, Math.min(0.95, ((x - a[0]) * vx + (z - a[1]) * vz) / L2)), px = a[0] + vx * t, pz = a[1] + vz * t, dd = Math.hypot(px - x, pz - z); if (dd < bd) { bd = dd; best = [px, pz]; } } return best; };
        const add = (cat, o, x, z) => { const [lat, lon] = ll(x, z), np = navPoint(x, z); cats[cat].push({ ...o, lat, lon, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, nx: np ? Math.round(np[0] * 10) / 10 : undefined, nz: np ? Math.round(np[1] * 10) / 10 : undefined }); };
        // CV stops (the door itself is computed at runtime: consumers prefer world.pois' doorX/doorZ for the same id)
        for (const ch of CHAPTERS.filter(c => c.city === cityId && c.district === did)) {
            if (ch.stop) { const p = city.pois.find(q => q.id === ch.stop); if (p) { const [x, z] = xy(p.lat, p.lon); add('cv', { id: p.id, name: p.label, chapter: ch.id }, x, z); } }
            else if (ch.waypoint) { const [x, z] = xy(ch.waypoint.lat, ch.waypoint.lon); add('cv', { id: ch.id + '-waypoint', name: ch.waypoint.label, chapter: ch.id }, x, z); }
        }
        // landmarks: reachable ones only (scenery = background, never listed)
        const scenery = new Set(dc.scenery || []), dropped = [];
        for (const id of dc.landmarks || []) {
            const lm = LANDMARKS.find(l => l.id === id); if (!lm || lm.backdrop || scenery.has(id)) continue;
            const [x, z] = xy(lm.lat, lm.lon);
            // reachable = a street inside the area passes within its footprint radius + 60 m, or it hosts a chapter stop here (e.g. the Rectorat behind the UPB gate)
            const hostsStop = lm.cvStop && CHAPTERS.some(c => c.city === cityId && c.district === did && c.stop === lm.cvStop) || (id === 'politehnica' && CHAPTERS.some(c => c.district === did && c.stop === 'upb'));
            if (hostsStop || streetDist(x, z) <= (lm.radiusM ? Math.max(lm.radiusM, 30) : 100) + 60) add('landmark', hostsStop ? { id, name: lm.name, stop: true } : { id, name: lm.name }, x, z); else dropped.push(id);
        }
        // tourist-spot entrances inside the area
        for (const sp of SPOTS.filter(s => s.city === cityId)) { const [x, z] = xy(sp.lat, sp.lon); if (reachable(x, z, 120)) add('spot', { id: sp.id, name: sp.name }, x, z); }
        // POIs
        const K = d.poiKinds, seenT = new Set();
        for (const p of d.pois) {
            const kind = K[p[0]], x = p[1] / 10, z = p[2] / 10, name = S(p[3]), brand = S(p[4]), sub = S(p[5]);
            if (!reachable(x, z)) continue;
            if (kind === 'fuel') add('fuel', { name: brand || name || 'Fuel', brand }, x, z);
            else if (['food', 'shop', 'bank', 'pharmacy', 'hotel'].includes(kind) && brand && !sub.startsWith('atm')) add('business', { name: name || brand, brand, kind, sub: sub.split(':')[0] }, x, z);
            else if ((kind === 'metro' || (kind === 'busstop' && sub === 'tram_stop') || (kind === 'landmark' && sub === 'station')) && name) {
                const key = kind + '|' + name; if (seenT.has(key)) continue; seenT.add(key);
                add('transit', { name, mode: kind === 'metro' ? 'metro' : sub === 'tram_stop' ? 'tram' : 'train' }, x, z);
            }
        }
        // named parks (centroid of the outer ring)
        const AK = d.areaKinds;
        for (const a of d.areas) {
            if (AK[a[0]] !== 'park' || a[1] < 0) continue;
            const ring = a[2]; let x = ring[0] / 10, z = ring[1] / 10, sx = x, sz = z, n = 1;
            for (let i = 2; i < ring.length - 1; i += 2) { x += ring[i] / 10; z += ring[i + 1] / 10; sx += x; sz += z; n++; }
            if (reachable(sx / n, sz / n, 150)) add('park', { name: S(a[1]) }, sx / n, sz / n);
        }
        // nav points verified in the game (tools/osm/places-navfix.json, written from a browser pass over game.nav): a place whose
        // nearest street the nav cannot reach gets the nearest street it CAN reach (≤ 120 m, `walk` m on foot), or is dropped
        const nf = NAVFIX[`${did}`];
        if (nf) for (const [cat, list] of Object.entries(cats)) {
            cats[cat] = list.filter(p => p.stop || !(nf.dropped || []).some(q => q.cat === cat && q.name === p.name && Math.hypot(q.x - p.x, q.z - p.z) < 2));
            for (const p of cats[cat]) { const q = (nf.fixed || []).find(q => q.cat === cat && q.name === p.name && Math.hypot(q.x - p.x, q.z - p.z) < 2); if (q) { p.nx = q.nx; p.nz = q.nz; if (q.walk) p.walk = q.walk; } }
        }
        out.districts[`${cityId}-${did}`] = { city: cityId, district: did, scenery: [...scenery], notReachable: dropped, counts: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v.length])), places: cats };
        console.log(`${cityId}-${did}`, JSON.stringify(out.districts[`${cityId}-${did}`].counts), dropped.length ? 'not reachable: ' + dropped.join(',') : '');
    }
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'kB');
