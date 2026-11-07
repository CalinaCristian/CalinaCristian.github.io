#!/usr/bin/env node
// ============================================================================
//  Reachable places per chapter district (round 5, notes 9/18) → game/data/places.json
//  Run after the district builds:  node tools/osm/places.mjs
//  For every district: CV stops, landmarks (minus `scenery`), tourist-spot entrances, fuel, notable (branded)
//  businesses, named parks and transit stops that lie INSIDE the playable area and next to a drivable street
//  there, with lat/lon (world-map hub) and district game metres x/z (minimap). Categories + legend in `legend`.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, CHAPTERS } from '../../game/src/cities.js';
import { LANDMARKS } from '../../game/src/landmarks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '..', '..', 'game', 'data');
let SPOTS = [];
try { SPOTS = (await import('../../game/src/spots/index.js')).SPOTS || []; } catch (e) { console.warn('places: no SPOTS', e.message); }

export const LEGEND = [
    { cat: 'cv', label: 'CV stop', icon: '★', color: '#f97316' },
    { cat: 'landmark', label: 'Landmark', icon: '🏛', color: '#7c3aed' },
    { cat: 'spot', label: 'Tourist spot (walk)', icon: '📷', color: '#0d9488' },
    { cat: 'fuel', label: 'Fuel', icon: '⛽', color: '#d97706' },
    { cat: 'business', label: 'Shop / café / bank', icon: '🛍', color: '#db2777' },
    { cat: 'park', label: 'Park', icon: '🌳', color: '#16a34a' },
    { cat: 'transit', label: 'Metro / tram / train', icon: 'M', color: '#2563eb' },
];

const out = { generated: new Date().toISOString().slice(0, 10), legend: LEGEND, districts: {} };
for (const [cityId, city] of Object.entries(CITIES)) {
    for (const [did, dc] of Object.entries(city.districts || {})) {
        const f = path.join(DATA, `${cityId}-${did}.json`); if (!fs.existsSync(f)) continue;
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        const S = (i) => (i >= 0 ? d.strings[i] : ''), P = d.proj, N = d.nodes;
        const xy = (lat, lon) => [(lon - P.lon0) * P.mPerLon, -(lat - P.lat0) * P.mPerLat];
        const ll = (x, z) => [+(P.lat0 - z / P.mPerLat).toFixed(6), +(P.lon0 + x / P.mPerLon).toFixed(6)];
        const m = d.district.mask, bits = new Uint8Array(m.w * m.h); { let k = 0, v = 0; for (const run of m.rle) { bits.fill(v, k, k + run); k += run; v ^= 1; } }
        const inside = (x, z) => { const i = Math.floor((x - m.x0) / m.cell), j = Math.floor((z - m.z0) / m.cell); return i >= 0 && j >= 0 && i < m.w && j < m.h && bits[j * m.w + i] === 1; };
        // drivable street segments inside the area (no service roads, no motorways: a place must be reachable from a street)
        const segs = [];
        for (const r of d.roads) {
            const cls = d.classes[r[1]]; if (cls === 'service' || /motorway/.test(cls)) continue;
            const ns = r.slice(10);
            for (let i = 0; i < ns.length - 1; i++) {
                const a = [N[2 * ns[i]] / 10, N[2 * ns[i] + 1] / 10], b = [N[2 * ns[i + 1]] / 10, N[2 * ns[i + 1] + 1] / 10];
                if (inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) segs.push([a, b]);
            }
        }
        const streetDist = (x, z) => { let best = Infinity; for (const [a, b] of segs) { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / L2)); best = Math.min(best, Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z)); } return best; };
        const reachable = (x, z, slack = 80) => inside(x, z) && streetDist(x, z) <= slack;
        const cats = { cv: [], landmark: [], spot: [], fuel: [], business: [], park: [], transit: [] };
        const add = (cat, o, x, z) => { const [lat, lon] = ll(x, z); cats[cat].push({ ...o, lat, lon, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }); };
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
            if (hostsStop || streetDist(x, z) <= (lm.radiusM ? Math.max(lm.radiusM, 30) : 100) + 60) add('landmark', { id, name: lm.name }, x, z); else dropped.push(id);
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
        out.districts[`${cityId}-${did}`] = { city: cityId, district: did, scenery: [...scenery], notReachable: dropped, counts: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v.length])), places: cats };
        console.log(`${cityId}-${did}`, JSON.stringify(out.districts[`${cityId}-${did}`].counts), dropped.length ? 'not reachable: ' + dropped.join(',') : '');
    }
}
fs.writeFileSync(path.join(DATA, 'places.json'), JSON.stringify(out));
console.log('wrote game/data/places.json', (fs.statSync(path.join(DATA, 'places.json')).size / 1024).toFixed(0), 'kB');
