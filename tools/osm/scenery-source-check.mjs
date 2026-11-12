import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scenerySourceProfile } from '../../game/src/scenery-source.js';
import { parseMeasure } from '../../game/src/building-roofs.js';
import { readDistrictData } from './district-data.mjs';

const row = [null, 20, 0, 0, 10, 20, 100, 101];
const precise = [[1.023, 2.009], [10.987, 12.091]], legacy = [[1, 2], [11, 12.1]];
const fixture = (tags = {}, cache, points = precise) => ({ roadGeometryPolicy: 'source', scenery: [row], scenerySourceGeometry: { 0: { sourceId: 'w1', prepared: points, tags } }, roadWidths: cache ? { 0: { sourceId: 'w1', ...cache } } : {} });
const resolve = d => scenerySourceProfile(d, 0, legacy);
let checks = 0;
let result = resolve(fixture());
assert.equal(result.points, precise); assert.equal(result.precise, true); assert.equal(result.widthM, 4.4); assert.match(result.widthSource, /^estimate:/); checks += 4;
for (const d of [
    { ...fixture({ width: '2' }), roadGeometryPolicy: undefined },
    fixture({ width: '2' }, null, [[1.123, 2.009], precise[1]]),
    fixture({ width: '2' }, null, [[NaN, 2], precise[1]]),
    fixture({ width: '2' }, null, [precise[0]]),
]) {
    result = resolve(d); assert.equal(result.points, legacy); assert.equal(result.precise, false); assert.equal(result.widthM, 4.4); checks += 3;
}
for (const [width, metres] of [['5', 5], ['2 m', 2], ['5 ft', 1.524], ['630 cm', 6.3]]) {
    result = resolve(fixture({ width })); assert.equal(result.widthM, metres); assert.equal(result.leftM + result.rightM, metres); assert.equal(result.widthSource, 'OSM width'); checks += 3;
}
for (const width of ['0', '-5', 'unknown', '5;7']) {
    result = resolve(fixture({ width })); assert.equal(result.widthM, 4.4); assert.match(result.widthSource, /^estimate:/); checks += 2;
}
const review = { sourceRoadId: 'w1', widthM: 3.6, source: 'independent aerial measurement', uncertaintyM: .3, evidence: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'] };
result = resolve(fixture({}, { widthM: 3.6, review })); assert.equal(result.widthM, 3.6); assert.equal(result.widthSource, review.source); checks += 2;
result = resolve(fixture({ width: '5' }, { widthM: 3.6, review, leftM: 1, rightM: 2.6 })); assert.equal(result.widthM, 5); assert.equal(result.leftM, 2.5); assert.equal(result.widthSource, 'OSM width'); checks += 3;
result = resolve(fixture({ width: '5' }, { widthM: 5, leftM: 1, rightM: 4, laneCenterShiftM: 1.5 })); assert.equal(result.leftM, 1); assert.equal(result.rightM, 4); assert.equal(result.lineOffsetM, 1.5); checks += 3;
result = resolve(fixture({}, { widthM: 8, source: 'estimate:class lane width' })); assert.equal(result.widthM, 4.4); checks++;
result = resolve(fixture({}, { widthM: 3.6, review: { ...review, sourceRoadId: 'w2' } })); assert.equal(result.widthM, 4.4); checks++;
result = resolve(fixture({}, { widthM: 3.6, review: { ...review, evidence: [] } })); assert.equal(result.widthM, 4.4); checks++;

const dataRoot = process.argv.find(s => s.startsWith('--data-root='))?.slice(12) || 'game/data';
const districts = [];
for (const file of fs.readdirSync(dataRoot).filter(f => /^[a-z]+(-[a-z]+)?\.(json|bin\.gz)$/.test(f))) {
    const data = readDistrictData(path.join(dataRoot, file));
    if (data.roadGeometryPolicy !== 'source' || !data.scenerySourceGeometry) continue;
    let pieces = 0, literalWidths = 0, nullPackedWidths = 0;
    for (const [i, row] of data.scenery.entries()) {
        let x = 0, z = 0; const points = [];
        for (let j = 4; j < row.length; j += 2) { x += row[j]; z += row[j + 1]; points.push([x / 10, z / 10]); }
        const profile = scenerySourceProfile(data, i, points);
        assert.equal(profile.precise, true, file + ': piece ' + i + ' ' + profile.issue);
        assert.equal(profile.points, data.scenerySourceGeometry[i].prepared, 'Never quantize source coordinates or remove a node');
        const literal = parseMeasure(data.scenerySourceGeometry[i].tags.width);
        if (literal > 0) { assert.equal(profile.widthM, literal); assert.equal(profile.widthSource, 'OSM width'); literalWidths++; }
        if (row[0] == null) nullPackedWidths++;
        pieces++; checks += 2;
    }
    districts.push({ district: file.replace('.json', ''), precisePieces: pieces, literalWidthPieces: literalWidths, nullPackedWidths });
}
console.log(JSON.stringify({ passed: true, checks, controls: 'Exact scenery node preservation, row identity alignment, corrupt cache/legacy fallback, literal unit-aware narrow widths, accepted review precedence and unchanged unknown-width estimates', districts }, null, 2));
