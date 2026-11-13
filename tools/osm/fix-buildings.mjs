#!/usr/bin/env node
// Cached-source building corrections for a district dataset (BACKLOG r2-builder-default-heights), the same rules the
// district build applies since round 3, without rebuilding. Footprints, positions, identities and every OSM-tagged value
// stay; only estimates change:
//   A. storeys from OSM level tags: a building without building:levels / height whose OSM `min_level` / `max_level` give
//      the floors it spans from the ground (Salonul Oficial w771096084: 0–1 → 2 storeys) gets that storey count and the
//      build's height for it (storeys × the style's storey height); buildingInfo height source → 0 (OSM)
//   B. the palette ESTIMATE of a guessed "glass curtain wall" style (research `style_est` / `facade_hex_est`, #5e7f8c on
//      Hotel Minerva) is not the colour of a building the data does not draw as glass: where OSM tags no colour /
//      material, that colour is cleared (world.js styles the facade); reviewed `facade_hex` / tagged colours stay
//   C. a named office / commercial / transportation footprint (OSM building=office|commercial|transportation, an
//      aeroway=terminal, building:part=transportation) whose storeys are an estimate is not an apartment block: style
//      'bloc' (balconies) → 'interwar' (plain window grid); its estimated height stays
//
//   node tools/osm/fix-buildings.mjs --city bucharest --district otopeni --osm <dir|files> [--write] [--data F] [--out F] [--report F]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readDistrictData, writeDistrictData, resolveDistrictFile } from './district-data.mjs';
import { levelsFromLevelTags } from './poi-kinds.mjs';

const args = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) args[k.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const researchDir = args.research ? path.resolve(args.research) : path.join(REPO, 'game', 'research');
if (!args.osm || !(args.data || (args.city && args.district))) { console.error('usage: fix-buildings.mjs --city <city> --district <id> --osm <dir|files> [--write] [--report FILE]'); process.exit(2); }
const dataFile = resolveDistrictFile(args.data ? path.resolve(args.data) : path.join(REPO, 'game', 'data', `${args.city}-${args.district}.json`));
const key = args.city && args.district ? `${args.city}-${args.district}` : path.basename(dataFile).replace(/\.(json|bin\.gz)$/, '');
const outFile = args.out ? path.resolve(args.out) : dataFile;
const D = readDistrictData(dataFile);
if (D.version !== 2 || !Array.isArray(D.buildingIds) || !Array.isArray(D.buildingInfo)) throw Error('refusing: a version-2 district dataset with buildingIds / buildingInfo is required');

// ---- OSM tags of the dataset's buildings (API 0.6 map.json tiles / Overpass JSON)
const files = String(args.osm).split(',').flatMap(f => { const p = path.resolve(f); return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter(n => n.endsWith('.json')).sort().map(n => path.join(p, n)) : [p]; });
const tags = new Map(), ledger = [];
for (const f of files) { const bytes = fs.readFileSync(f); ledger.push(crypto.createHash('sha256').update(bytes).digest('hex')); for (const e of JSON.parse(bytes.toString('utf8')).elements || []) if ((e.type === 'way' || e.type === 'relation') && e.tags) { const id = (e.type === 'way' ? 'w' : 'r') + e.id; if (!tags.has(id)) tags.set(id, e.tags); } }
// ---- research estimate colours (game/research/<key>.json buildings[].facade_hex_est)
const est = new Map();
try { for (const b of JSON.parse(fs.readFileSync(path.join(researchDir, `${key}.json`), 'utf8')).buildings || []) { const id = String(b.osm || '').replace(/^way\//, 'w').replace(/^relation\//, 'r'); if (/^#[0-9a-f]{6}$/i.test(b.facade_hex_est || '') && /glass curtain/i.test(b.style_est || '') && !b.facade_hex && !b.research?.facade_hex) est.set(id, b.facade_hex_est.toLowerCase()); } } catch { /* no research file */ }

const str = (i) => (i >= 0 ? D.strings[i] : '');
const strIdx = new Map(D.strings.map((s, i) => [s, i]));
const STYLE = (n) => D.styles.indexOf(n);
const report = { levels: [], colours: [], styles: [], noTags: 0 };
const buildings = D.buildings.map(b => b.slice()), info = D.buildingInfo.slice(), profiles = { ...(D.buildingRoofProfiles || {}) };
buildings.forEach((b, i) => {
    const id = D.buildingIds[i], t = tags.get(id); if (!id) return;
    if (!t) { report.noTags++; return; }
    const hSrc = info[i * 5 + 4], estimated = hSrc === 2 || hSrc === 3, style = D.styles[b[0]], name = str(b[4]);
    // A. storeys from level tags
    if (estimated && !(Number(t['building:levels']) > 0) && !(parseFloat(t.height) > 0) && !D.buildingDimensions?.[i]) {
        const lv = levelsFromLevelTags(t);
        if (lv > 0 && (b[6] !== lv)) {
            const h = Math.round((lv * (style === 'bloc' ? 2.9 : style === 'glass' ? 3.6 : 3.2) + ((b[5] & 1) ? 1 : 0)) * 10) / 10;
            report.levels.push({ id, name, from: { h: b[1] / 10, levels: b[6] }, to: { h, levels: lv }, tags: { min_level: t.min_level, max_level: t.max_level } });
            b[1] = Math.round(h * 10); b[6] = lv; info[i * 5 + 4] = 0;
            const p = profiles[i]; if (p && p.shape === 'flat') profiles[i] = { ...p, totalM: h, eavesM: h, heightSource: 'OSM min_level / max_level storeys estimate' };
            else if (p) { const k = h / (p.totalM || h); profiles[i] = { ...p, totalM: h, eavesM: +(p.eavesM * k).toFixed(3), riseM: +((p.riseM || 0) * k).toFixed(3), heightSource: 'OSM min_level / max_level storeys estimate' }; }
        }
    }
    // B. research estimate colours
    const col = str(b[7]).toLowerCase();
    if (col && style !== 'glass' && est.get(id) === col && !t['building:colour'] && !t['building:color'] && !t['building:material'] && !t['building:facade:material']) {
        report.colours.push({ id, name, colour: col }); b[7] = -1;
    }
    // C. named non-residential classes with estimated storeys are not apartment blocks
    const cls = t.building || '', part = t['building:part'] || '';
    if (estimated && name && t.name && style === 'bloc' && (/^(office|commercial|transportation)$/.test(cls) || part === 'transportation' || t.aeroway === 'terminal')) {
        report.styles.push({ id, name, from: style, to: 'interwar', building: cls || 'part=' + part, aeroway: t.aeroway || '' }); b[0] = STYLE('interwar');
    }
});
console.log(`${key}: levels ${report.levels.length} ${report.levels.map(l => l.name + ' ' + l.from.levels + '→' + l.to.levels).join(', ')}; estimate colours cleared ${report.colours.length}; bloc→interwar ${report.styles.length} ${report.styles.map(s => s.name).join(', ')}; buildings without OSM tags in the input ${report.noTags}`);
if (args.report) { fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true }); fs.writeFileSync(path.resolve(args.report), JSON.stringify({ dataset: key, ...report }, null, 1)); }
if (args.write) {
    if (!report.levels.length && !report.colours.length && !report.styles.length) { console.log('nothing to change'); process.exit(0); }
    D.buildings = buildings; D.buildingInfo = info; if (D.buildingRoofProfiles) D.buildingRoofProfiles = profiles;
    D.buildingFix = { schema: 1, runs: [...(D.buildingFix?.runs || []), { tool: 'tools/osm/fix-buildings.mjs', date: new Date().toISOString().slice(0, 10), osmDigest: crypto.createHash('sha256').update(ledger.sort().join('')).digest('hex'), levels: report.levels.map(l => l.id), colours: report.colours.map(c => c.id), styles: report.styles.map(s => s.id) }] };
    void strIdx;
    const bytes = writeDistrictData(D, outFile);
    console.log(`wrote ${outFile} ${(bytes / 1048576).toFixed(3)} MiB`);
}
