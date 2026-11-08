#!/usr/bin/env node
// Verify that every optional shared lane retains its mapped two-way/single-lane meaning and source width.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFiles } from './parse-osm.mjs';
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const data = JSON.parse(fs.readFileSync(args.data));
const raw = parseFiles(fs.readdirSync(args.osm).filter(f => f.endsWith('.xml')).map(f => path.join(args.osm, f)));
const report = [];
for (const [key, spec] of Object.entries(data.sharedLanes || {})) {
    const row = data.roads[+key], tags = raw.ways.get(+spec.sourceId.slice(1))?.tags;
    assert.ok(tags, 'the physical lane has an exact OSM source identity');
    assert.equal(tags.lanes, '1');
    assert.ok(!['yes','1','true','-1'].includes(tags.oneway), 'both graph directions are legal');
    assert.deepEqual(row.slice(2,4), [1,1], 'both graph connections remain available');
    assert.equal(row[4], 0, 'a shared lane has no invented centre reservation');
    assert.ok(Math.abs(2 * row[5] / 10 - spec.widthM) <= .101, 'legacy widths sum to one physical lane, allowing decimetre storage');
    const explicit = parseFloat(tags.width);
    if (explicit > 0) assert.equal(spec.widthM, explicit, 'explicit source width beats the class estimate');
    else assert.ok(spec.widthSource.startsWith('estimate:'), 'an untagged width is identified as an estimate');
    report.push({road:+key, source:spec.sourceId, widthM:spec.widthM, widthSource:spec.widthSource});
}
console.log(JSON.stringify({sharedLanes: report, count: report.length}, null, 2));
