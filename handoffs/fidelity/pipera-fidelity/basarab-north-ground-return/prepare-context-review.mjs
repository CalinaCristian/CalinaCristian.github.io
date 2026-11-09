import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFiles } from '../../../../tools/osm/parse-osm.mjs';
const root = new URL('../../../..', import.meta.url).pathname, base = '/workspace/reality-pass/basarab-north-ground-return';
const originalBytes = fs.readFileSync(base + '/base-b8f33f2d.json'), old = JSON.parse(originalBytes), audit = JSON.parse(fs.readFileSync(base + '/first-source-retention.json'));
const prior = JSON.parse(fs.readFileSync(base + '/prior-model-inputs.json')), current = JSON.parse(fs.readFileSync(base + '/candidate-model-inputs.json')), byCurrent = new Map(current.map(r => [r.sourceId, r]));
const reviewFile = root + '/game/research/source-context-bucharest-grozavesti.json', review = JSON.parse(fs.readFileSync(reviewFile));
const dir = '/workspace/reality-pass/grozavesti/tiles', files = fs.readdirSync(dir).filter(n => n.endsWith('.xml')).sort().map(n => dir + '/' + n), raw = parseFiles(files);
const sha = b => createHash('sha256').update(b).digest('hex'), pub = tags => Object.fromEntries(Object.entries(tags).filter(([k]) => !k.startsWith('__')).sort(([a], [b]) => a.localeCompare(b)));
const inferredBuildingModels = [], levelModels = [];
for (const r of prior) {
    const fresh = byCurrent.get(r.sourceId), way = raw.ways.get(+r.sourceId.slice(1));
    assert.deepEqual(pub(r.tags), pub(fresh.tags), 'no new evidence may be overridden'); assert.deepEqual(r.sourceRingLL, fresh.sourceRingLL); assert.deepEqual(r.sourceHolesLL, fresh.sourceHolesLL);
    const sourceTags = r.tags.__sourceTags || r.tags.__originalTags || pub(r.tags), ll = way.nodes.map(id => raw.nodes.get(id));
    assert.deepEqual(pub(sourceTags), pub(way.tags)); assert.deepEqual(r.sourceRingLL, ll); assert.deepEqual(ll[0], ll.at(-1));
    const i = old.buildingIds.indexOf(r.sourceId); assert.ok(i >= 0 && old.buildingIds.filter(s => s === r.sourceId).length === 1);
    const profile = old.buildingRoofProfiles[i], row = old.buildings[i], fp = ll.slice(0, -1).map(([lat, lon]) => [+( (lon - old.proj.lon0) * old.proj.mPerLon).toFixed(4), +((old.proj.lat0 - lat) * old.proj.mPerLat).toFixed(4)]);
    assert.deepEqual(old.buildingFootprints[i], fp); assert.ok(!old.buildingHoleFootprints?.[i]?.length); assert.deepEqual(r.sourceHolesLL, []);
    const record = { sourceId: r.sourceId, sourceTags, modelInputTags: pub(r.tags), sourceRingLL: r.sourceRingLL, sourceHolesLL: [], style: old.styles[row[0]], roof: old.roofs[row[3]],
        basis: 'Same-source prior fallback MODEL; added road proximity is not new physical height/style evidence. Raw/effective evidence and exact closed footprint unchanged; source/research changes win.' };
    if (profile.heightSource === 'style estimate') {
        for (const key of ['height', 'building:levels', 'min_height', 'building:min_level']) { assert.equal(sourceTags[key], undefined); assert.equal(record.modelInputTags[key], undefined); }
        assert.equal(r.heightM, null); record.wallHeightM = profile.eavesM;
    } else {
        assert.equal(profile.heightSource, 'OSM building:levels estimate');
        const dimensions = Object.fromEntries(Object.entries(r.tags.__originalDimensions || r.tags).filter(([k]) => /^(height|min_height|min_level|building:levels|building:min_level|roof:)/.test(k)));
        assert.ok(Number(dimensions['building:levels']) > 0 && sourceTags.height == null);
        levelModels.push({ sourceId: r.sourceId, sourceDimensions: dimensions, sourceRingLL: r.sourceRingLL, heightM: profile.eavesM,
            basis: 'Retain prior per-storey MODEL for identical literal storeys/footprint; source/research metres win. New domain/shop-band context is not height evidence.' });
    }
    inferredBuildingModels.push(record);
}
const crowns = JSON.parse(fs.readFileSync(base + '/missing-crowns-proposal.json'));
assert.equal(crowns.surveySha256, review.surveySha256); assert.equal(crowns.baselineDataSha256, sha(originalBytes));
assert.ok(crowns.records.every(r => !review.measuredCrowns.some(o => o.surveyIndex === r.surveyIndex)));
const oldSource = { sourceDataCommit: review.sourceDataCommit, sourceDataSha256: review.sourceDataSha256, scope: review.scope };
review.sourceDataCommit = 'b8f33f2dac916f0495134c793a88a3d67d30082a'; review.sourceDataSha256 = sha(originalBytes);
review.priorSourceContext = oldSource; review.inferredBuildingModels = inferredBuildingModels;
for (const r of levelModels) { assert.ok(!review.levelHeightEstimates.some(o => o.sourceId === r.sourceId)); review.levelHeightEstimates.push(r); }
review.measuredCrowns.push(...crowns.records);
review.scope += ' The finite north main bridge exit additionally retains identical prior inferred style/wall models and22exact measured crowns; all baseline source bodies/profiles remain checked separately.';
review.evidence.push('handoffs/fidelity/pipera-fidelity/basarab-north-ground-return/model-evidence-parity.json', 'handoffs/fidelity/pipera-fidelity/basarab-north-ground-return/source-retention.json');
review.priorModelInputsSha256 = sha(fs.readFileSync(base + '/prior-model-inputs.json'));
fs.writeFileSync(process.argv[2] || reviewFile, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ inferredBuildingModels: inferredBuildingModels.length, fallbackWallHeights: inferredBuildingModels.filter(r => r.wallHeightM != null).length, addedLiteralStoreyModels: levelModels.length, addedCrowns: crowns.records.length, totalRetainedCrownReviews: review.measuredCrowns.length, unchangedPriorWaterRecords: review.waterAreas.length }));
