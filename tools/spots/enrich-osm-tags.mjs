#!/usr/bin/env node
// ============================================================================
//  Tourist-scene tag enrichment (no rebuild). The scene builder keeps a fixed list of tags per feature and drops some that
//  scene modules need (lane buc-spots, round 3): bridge outlines lose `bridge:structure` / `bridge:support` / `start_date`
//  (Cișmigiu, Podul de Nuc w1478446295), barriers lose `height` / `min_height`, walls lose `description` (Zidul amintirii
//  w1454592908 / w1454592909); and `barrier=gate` nodes are not kept at all (Spring Palace gates). This tool reads the live
//  OSM tags of the scene's own features (Overpass `out tags`, saved under --osm) and
//    - ADDS the listed literal tags a feature lacks (key spelt as the builder spells it: the first ':' → '_'); an existing
//      value is never changed, nothing is removed, geometry is untouched;
//    - with --gates, appends the `barrier=gate` nodes inside the scene's building extent (not disused; a gate is a gate whatever its access) as `furniture.gate`
//      points (scene projection), a new furniture list the scenes may read; nothing else in `furniture` changes.
//  Every other key / feature is unchanged; an `osmEnrich` provenance record is appended.
//
//  usage: node tools/spots/enrich-osm-tags.mjs --scene <id> --osm <dir> [--fetch] [--keys k1,k2] [--kinds ways,areas]
//               [--gates] [--repo <worktree>] [--in <dir>] [--out <dir>] [--write]
//  © OpenStreetMap contributors, ODbL 1.0.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(args.repo || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const IN = path.resolve(args.in || path.join(REPO, 'game', 'data', 'spots')), OUT = path.resolve(args.out || IN), OSM = path.resolve(args.osm || '.');
const KEYS = String(args.keys || 'bridge:structure,bridge:support,start_date,height,min_height,description').split(',');
const KINDS = String(args.kinds || 'ways,areas').split(',');
const scene = args.scene; if (!scene) { console.error('usage: enrich-osm-tags.mjs --scene <id> --osm <dir> [--fetch] [--gates] [--write]'); process.exit(2); }
fs.mkdirSync(OSM, { recursive: true });
const { projector } = await import(pathToFileURL(path.join(REPO, 'game/src/spots/tools/build-data.mjs')).href);
const d = JSON.parse(fs.readFileSync(path.join(IN, scene + '.json'), 'utf8')), P = projector(d.origin.lat, d.origin.lon);
const HOSTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function overpass(q, file) {
    const f = path.join(OSM, file);
    if (!fs.existsSync(f)) {
        if (!args.fetch) throw Error('no saved reply ' + f + ' (run with --fetch)');
        let ok = false;
        for (let round = 0; round < 3 && !ok; round++) for (const h of HOSTS) {
            try { const r = await fetch(h, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'osm-spot-tag-check/1.0' }, signal: AbortSignal.timeout(120000) }); const t = await r.text(); if (r.ok && t.startsWith('{')) { fs.writeFileSync(f, JSON.stringify({ host: h, query: q, fetched: new Date().toISOString(), body: t })); ok = true; break; } } catch { /* next host */ }
            await new Promise(res => setTimeout(res, 3000));
        }
        if (!ok) throw Error('Overpass failed for ' + file);
    }
    const rec = JSON.parse(fs.readFileSync(f, 'utf8')); return { json: JSON.parse(rec.body), sha256: crypto.createHash('sha256').update(rec.body).digest('hex'), fetched: rec.fetched };
}
// the scene's own OSM ways (ids w123 or w123_b …: the suffix is the builder's split of one way)
const feats = []; for (const k of KINDS) for (const f of d[k] || []) { const m = /^w(\d+)/.exec(String(f.id)); if (m) feats.push({ f, k, way: +m[1] }); }
const ids = [...new Set(feats.map(x => x.way))];
const tags = new Map(), inputs = [];
for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400), r = await overpass(`[out:json][timeout:120];way(id:${chunk.join(',')});out tags;`, `${scene}-ways-${i / 400}.json`);
    inputs.push({ file: `${scene}-ways-${i / 400}.json`, sha256: r.sha256, fetched: r.fetched }); for (const e of r.json.elements) tags.set(e.id, e.tags || {});
}
const added = [];
for (const { f, way } of feats) { const t = tags.get(way); if (!t) continue; for (const k of KEYS) { const kk = k.replace(':', '_'); if (t[k] != null && f[kk] === undefined) { f[kk] = t[k]; added.push([f.id, kk, t[k]]); } } }
let gates = [];
if (args.gates) {
    let s = 90, w = 180, n = -90, e = -180; for (const b of d.buildings) for (const [x, z] of b.poly) { const [la, lo] = P.ll(x, z); s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); e = Math.max(e, lo); }
    const r = await overpass(`[out:json][timeout:60];node[barrier=gate](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)});out;`, `${scene}-gates.json`);
    inputs.push({ file: `${scene}-gates.json`, sha256: r.sha256, fetched: r.fetched });
    gates = r.json.elements.filter(g => !(g.tags?.disused === 'yes' || g.tags?.['disused:barrier'])).map(g => ({ id: 'n' + g.id, xz: P.xy(g.lat, g.lon), tags: g.tags }));
    const have = new Set((d.furniture?.gate || []).map(p => p.join(',')));
    gates = gates.filter(g => !have.has(g.xz.join(',')));
}
console.log(`${scene}: tags added ${added.length} on ${new Set(added.map(a => a[0])).size} features (${[...new Set(added.map(a => a[1]))].join(', ') || '-'}); gates +${gates.length} ${gates.map(g => g.id).join(' ')}`);
for (const a of added.filter(a => !/height/.test(a[1]))) console.log('  ', a.join(' '));
if (args.write && (added.length || gates.length)) {
    if (gates.length) d.furniture = { ...d.furniture, gate: [...(d.furniture?.gate || []), ...gates.map(g => g.xz)] };
    d.osmEnrich = [...(d.osmEnrich || []), { tool: 'tools/spots/enrich-osm-tags.mjs', date: new Date().toISOString().slice(0, 10), inputs, keys: KEYS, tagsAdded: added.length, features: [...new Set(added.map(a => a[0]))].length, gates: gates.map(g => g.id) }];
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, scene + '.json'), JSON.stringify(d)); console.log('wrote', path.join(OUT, scene + '.json'));
}
