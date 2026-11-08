#!/usr/bin/env node
// Downloads raw OSM XML tiles from the OSM API (0.6 `map` call) for the regions used by the game.
// Usage: node tools/osm/fetch-tiles.mjs --out <dir> [--only sea_x5,sea_x405] [--bbox minlat,minlon,maxlat,maxlon]
// Existing files are skipped, so the script can be re-run to resume. Be gentle with the API.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// [name, minlat, maxlat, minlon, maxlon, dlat, dlon]
export const REGIONS = [
    ['buc', 44.415, 44.495, 26.045, 26.125, 0.01, 0.016],      // Bucharest core
    ['dn1', 44.495, 44.585, 26.060, 26.105, 0.015, 0.045],     // DN1 corridor to Otopeni (auto-split when too big)
    ['bucx', 44.465, 44.495, 26.125, 26.157, 0.01, 0.016],     // east of Pipera (Fabrica de Glucoză east, Petricani): db chapter run-in + pipera backdrop (2026-11-07)
    ['sea_seatac', 47.430, 47.470, -122.320, -122.260, 0.02, 0.03],
    ['sea_i5', 47.470, 47.590, -122.345, -122.295, 0.02, 0.025],
    ['sea_dt', 47.590, 47.640, -122.360, -122.300, 0.0125, 0.02],
    ['sea_i90', 47.570, 47.600, -122.300, -122.180, 0.03, 0.03],
    ['sea_bel', 47.600, 47.650, -122.220, -122.170, 0.0125, 0.025],
    ['sea_520', 47.630, 47.660, -122.300, -122.220, 0.03, 0.04],
    ['sea_x5', 47.470, 47.535, -122.295, -122.263, 0.01, 0.016],  // I-5 through Tukwila (gap fill)
    ['sea_x405', 47.575, 47.605, -122.185, -122.165, 0.01, 0.02], // I-90 / I-405 interchange (gap fill)
    ['sea_x520', 47.635, 47.660, -122.335, -122.295, 0.0125, 0.02], // I-5 / SR-520 interchange (gap fill for the SR-520 alternative)
];

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1]]); return a; }, []));
const OUT = args.out || 'tiles';
const ONLY = args.only ? args.only.split(',') : null;
const BBOX = args.bbox ? args.bbox.split(',').map(Number) : null;
if (BBOX && (BBOX.length !== 4 || BBOX.some(n => !Number.isFinite(n)) || BBOX[0] >= BBOX[2] || BBOX[1] >= BBOX[3])) {
    console.error('--bbox must be minlat,minlon,maxlat,maxlon with increasing bounds');
    process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

function fetch(name, a, b, c, d, depth = 0) {
    const fn = path.join(OUT, `${name}_${a.toFixed(4)}_${c.toFixed(4)}_${b.toFixed(4)}_${d.toFixed(4)}.xml`);
    if (fs.existsSync(fn) && fs.statSync(fn).size > 1000) return;
    const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${c.toFixed(5)},${a.toFixed(5)},${d.toFixed(5)},${b.toFixed(5)}`;
    for (let attempt = 0; attempt < 4; attempt++) {
        let code = '';
        try { code = execFileSync('curl', ['-sS', '--max-time', '240', '-A', 'drive-my-cv-osm-build/1.0 (github CalinaCristian)', '-o', fn + '.tmp', '-w', '%{http_code}', url], { encoding: 'utf8' }).trim(); } catch (e) { code = 'ERR'; }
        if (code === '200') { fs.renameSync(fn + '.tmp', fn); console.log(name, a, c, 'ok', fs.statSync(fn).size); return; }
        if (code === '400' && depth < 3) { // too many nodes -> split in four
            const ma = (a + b) / 2, mc = (c + d) / 2;
            for (const [p, q, r, s] of [[a, ma, c, mc], [a, ma, mc, d], [ma, b, c, mc], [ma, b, mc, d]]) fetch(name, p, q, r, s, depth + 1);
            return;
        }
        console.log(name, a, c, 'retry', code);
        execFileSync('sleep', [String(5 * (attempt + 1))]);
    }
}

for (const [name, la0, la1, lo0, lo1, dla, dlo] of REGIONS) {
    if (ONLY && !ONLY.includes(name)) continue;
    for (let la = la0; la < la1 - 1e-9; la += dla) for (let lo = lo0; lo < lo1 - 1e-9; lo += dlo) {
        const lb = Math.min(la + dla, la1), lob = Math.min(lo + dlo, lo1);
        if (BBOX && (lb <= BBOX[0] || la >= BBOX[2] || lob <= BBOX[1] || lo >= BBOX[3])) continue;
        fetch(name, la, lb, lo, lob);
    }
}
console.log('ALL_TILES_DONE');
