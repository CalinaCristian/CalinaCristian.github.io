#!/usr/bin/env node
// Live-OSM area tag append (backlog fp-rebuild, 2026-11-13): the district build files every area under one kind (`areas`
// [kind, name, rings]) and drops the area's own `tourism` / `man_made` / `sport` tags, so the game cannot tell a rugby
// infield from a football pitch, a zoo / attraction ground from a park, or a pier / bridge area from plain paving. This tool
// adds those literal tags, without rebuilding the dataset:
//   areaSourceTags  { sourceId: { …existing keys, tourism?, man_made?, sport? } } (existing keys are never changed)
//   areaTagAppend   (new) provenance: tool, date, source, keys, counts
// Every other key, row and index stays as it is. Input: the dataset's own `areaSourceIds` (OSM way / relation identities,
// parallel to `areas`), read from the live OSM API 0.6 multi-fetch (`ways.json?ways=…`, `relations.json?relations=…`,
// 150 ids a request, retried / split on errors). An id the API no longer returns is reported, nothing is invented.
//
//   node tools/osm/add-area-tags.mjs --city bucharest --district floreasca [--write] [--report FILE]
// Without --write nothing is written. Data © OpenStreetMap contributors (ODbL).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDistrictData, writeDistrictData, resolveDistrictFile } from './district-data.mjs';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!args.city || !args.district) { console.error('usage: add-area-tags.mjs --city <city> --district <id> [--write] [--report FILE]'); process.exit(2); }
const KEYS = ['tourism', 'man_made', 'sport'], API = 'https://api.openstreetmap.org/api/0.6', BATCH = 150;
const file = resolveDistrictFile(path.join(REPO, 'game', 'data', `${args.city}-${args.district}.json`));
const D = readDistrictData(file);
if (!Array.isArray(D.areaSourceIds) || D.areaSourceIds.length !== D.areas.length) throw Error('refusing: no areaSourceIds parallel to areas');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchBatch(kind, ids, depth = 0) {
    const url = `${API}/${kind}s.json?${kind}s=${ids.join(',')}`;
    for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': 'drive-my-cv-data-tool/1.0 (area tag append)' } });
        if (res.ok) return (await res.json()).elements || [];
        if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
        // 404 / 410: one id is gone; split until it is isolated
        if (ids.length === 1) return [];
        const h = ids.length >> 1;
        return [...await fetchBatch(kind, ids.slice(0, h), depth + 1), ...await fetchBatch(kind, ids.slice(h), depth + 1)];
    }
    throw Error(`OSM API refused ${url.slice(0, 120)}…`);
}

const wanted = [...new Set(D.areaSourceIds.filter(s => /^[wr]\d+$/.test(s || '')))];
const got = new Map();
for (const [prefix, kind] of [['w', 'way'], ['r', 'relation']]) {
    const ids = wanted.filter(s => s[0] === prefix).map(s => s.slice(1));
    for (let i = 0; i < ids.length; i += BATCH) {
        for (const el of await fetchBatch(kind, ids.slice(i, i + BATCH))) got.set(prefix + el.id, el.tags || {});
        await sleep(400);
    }
}
const tags = { ...(D.areaSourceTags || {}) }, byKey = Object.fromEntries(KEYS.map(k => [k, 0])), missing = wanted.filter(s => !got.has(s));
let changed = 0;
for (const id of wanted) {
    const t = got.get(id); if (!t) continue;
    const add = {}; for (const k of KEYS) if (t[k] != null && tags[id]?.[k] == null) { add[k] = t[k]; byKey[k]++; }
    if (Object.keys(add).length) { tags[id] = { ...(tags[id] || {}), ...add }; changed++; }
}
const run = { tool: 'tools/osm/add-area-tags.mjs', date: new Date().toISOString().slice(0, 10), source: 'api.openstreetmap.org 0.6 multi-fetch (live)', keys: KEYS, areas: wanted.length, returned: got.size, missing: missing.length, areasTagged: changed, byKey };
console.log(`${args.city}-${args.district}`, JSON.stringify(run), missing.length ? 'missing: ' + missing.slice(0, 20).join(',') : '');
if (args.report) fs.writeFileSync(args.report, JSON.stringify({ ...run, missingIds: missing }, null, 1));
if (args.write && changed) {
    D.areaSourceTags = tags;
    D.areaTagAppend = { schema: 1, runs: [...(D.areaTagAppend?.runs || []), run] };
    writeDistrictData(D, file);
    console.log('wrote', path.relative(REPO, file));
}
