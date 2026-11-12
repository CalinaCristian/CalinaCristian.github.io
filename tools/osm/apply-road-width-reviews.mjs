#!/usr/bin/env node
// Applies the reviewed carriageway widths of a district (game/research/<city>-<district>.json `road_widths`, the same
// input build-data.mjs reads) to its prepared data without a full rebuild from OSM tiles:
//     node tools/osm/apply-road-width-reviews.mjs bucharest-unirii [--check]
// For every reviewed way it writes roadWidths[roadIndex] with resolveRoadWidth(), exactly as build-data.mjs does, and
// the road row's lane width and (one-way) median. Scenery pieces of the same way read that record at runtime
// (scenery-source.js). Only the plain case is handled: a one-way, unshared carriageway without a literal OSM width or
// placement. Anything else needs the full build and is refused. --check reports what would change and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validRoadWidthReview, resolveRoadWidth } from '../../game/src/road-widths.js';
import { readDistrictData, writeDistrictData } from './district-data.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const id = process.argv[2], check = process.argv.includes('--check');
if (!/^[a-z]+-[a-z]+$/.test(id || '')) { console.error('usage: apply-road-width-reviews.mjs <city>-<district> [--check]'); process.exit(2); }
const dataFile = path.join(REPO, 'game', 'data', id + '.bin.gz'), researchFile = path.join(REPO, 'game', 'research', id + '.json');
const data = readDistrictData(dataFile); // the district pack (game/data/README.md)
const reviews = JSON.parse(fs.readFileSync(researchFile, 'utf8')).road_widths || [];
const seen = new Set(), applied = [];
data.roadWidths ||= {};
for (const review of reviews) {
    if (!validRoadWidthReview(review)) throw new Error('invalid road width review: ' + JSON.stringify(review).slice(0, 200));
    if (seen.has(review.sourceRoadId)) throw new Error('duplicate road width review: ' + review.sourceRoadId); seen.add(review.sourceRoadId);
    const rows = Object.keys(data.roadAccess || {}).map(Number).filter(ri => data.roadAccess[ri].sourceId === review.sourceRoadId);
    if (!rows.length) throw new Error(review.sourceRoadId + ': no prepared road (a scenery-only way needs the full build)');
    for (const ri of rows) {
        const r = data.roads[ri], tags = data.roadSourceGeometry?.[ri]?.tags;
        if (!tags) throw new Error(review.sourceRoadId + ': no source tags in the prepared data');
        if (!(r[8] & 1) || data.sharedLanes?.[ri] || tags.width != null || tags.placement || tags['placement:forward'] || tags['placement:backward'])
            throw new Error(review.sourceRoadId + ': not a plain one-way carriageway; run the full build');
        const profile = resolveRoadWidth(tags, review, { lanes: r[2], lanesF: r[2], lanesB: 0, oneway: true, reverse: tags.oneway === '-1', medianM: 0, sharedLane: false, defaultLaneWidth: r[5] / 10 });
        const before = JSON.stringify([data.roadWidths[ri] || null, r[4], r[5]]);
        data.roadWidths[ri] = { sourceId: review.sourceRoadId, ...profile };
        r[5] = Math.round(profile.laneWidthM * 10); r[4] = Math.round(-(r[2] * profile.laneWidthM) * 10);
        applied.push({ road: ri, sourceId: review.sourceRoadId, widthM: profile.widthM, leftM: profile.leftM, rightM: profile.rightM, laneWidthM: +profile.laneWidthM.toFixed(4), laneCenterShiftM: profile.laneCenterShiftM, issues: profile.issues || [], changed: before !== JSON.stringify([data.roadWidths[ri], r[4], r[5]]) });
    }
}
console.log(JSON.stringify({ district: id, reviews: reviews.length, applied, written: !check && applied.some(a => a.changed) }, null, 1));
if (!check && applied.some(a => a.changed)) writeDistrictData(data, dataFile);
