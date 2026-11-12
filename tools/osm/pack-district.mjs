// Convert district data between JSON and the shipped binary pack (spec 10: ≤ 3 MB per district).
//   node tools/osm/pack-district.mjs game/data/bucharest-unirii.json [...]     → writes <name>.bin.gz next to it
//        --replace   also deletes the .json once the pack is verified
//   node tools/osm/pack-district.mjs --unpack game/data/bucharest-unirii.bin.gz [out.json]   → JSON for inspection
// The pack decodes to exactly the JSON's object, except long cache signatures, which are stored as their hash
// (game/src/district-pack.js); unpacked JSON therefore carries the hashed signatures, which the builder accepts.
import fs from 'node:fs';
import { readDistrictData, writeDistrictData } from './district-data.mjs';

const args = process.argv.slice(2);
const MiB = (n) => (n / 1048576).toFixed(2) + ' MiB';
if (args[0] === '--unpack') {
    const [, from, to = from.replace(/\.bin\.gz$/, '.json')] = args;
    const n = writeDistrictData(readDistrictData(from), to);
    console.log(`${from} → ${to} (${MiB(n)})`);
} else {
    const replace = args.includes('--replace');
    for (const file of args.filter((a) => !a.startsWith('--'))) {
        if (!file.endsWith('.json')) throw new Error('expected a .json district file: ' + file);
        const before = fs.statSync(file).size, out = file.slice(0, -5) + '.bin.gz';
        const n = writeDistrictData(JSON.parse(fs.readFileSync(file, 'utf8')), out);
        console.log(`${file} ${MiB(before)} → ${out} ${MiB(n)}${n > 3 * 1048576 ? '  OVER the 3 MiB budget (spec 10)' : ''}`);
        if (replace) fs.unlinkSync(file);
    }
}
