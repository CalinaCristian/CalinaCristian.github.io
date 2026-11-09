// Build an explicit immutable context review; does not modify a dataset.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFiles } from '../../../../tools/osm/parse-osm.mjs';
const [oldFile, auditFile, tilesDir, surveyFile, outFile, modelInputsFile] = process.argv.slice(2);
if (!outFile) throw Error('OLD_DATA AUDIT TILES SURVEY OUT required');
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p)), sha = b => createHash('sha256').update(b).digest('hex');
const old = json(oldFile), audit = json(auditFile), survey = json(surveyFile), p = old.proj;
const files = fs.readdirSync(tilesDir).filter(f => f.endsWith('.xml')).sort().map(f => path.join(tilesDir, f));
const inputTags = new Map(modelInputsFile ? json(modelInputsFile).map(r=>[r.sourceId,r.tags]) : []);
const raw = parseFiles(files), heightIds = new Set(audit.changedDimensions.map(r=>r.sourceId)), sourceIds = new Set([...heightIds,
    ...audit.changedAppearance.filter(r => r.changes.style).map(r => r.sourceId)]);
const inferredBuildingModels = [...sourceIds].sort().map(sourceId => {
    assert.match(sourceId, /^w\d+$/);
    const index = old.buildingIds.indexOf(sourceId), way = raw.ways.get(Number(sourceId.slice(1)));
    assert.ok(index >= 0 && way); const row = old.buildings[index], profile = old.buildingRoofProfiles[index];
    if (heightIds.has(sourceId)) {
        assert.equal(profile.heightSource, 'style estimate');
        for (const key of ['height', 'building:levels', 'min_height', 'building:min_level']) assert.equal(way.tags[key], undefined);
    }
    assert.ok(!old.buildingHoleFootprints?.[index]?.length, 'relation/courtyard requires a separately retained raw review');
    const sourceRingLL = way.nodes.map(n => raw.nodes.get(n)); assert.ok(sourceRingLL.every(Boolean));
    const expected = sourceRingLL.slice(0, -1).map(([lat, lon]) => [(lon-p.lon0)*p.mPerLon*p.scale, (p.lat0-lat)*p.mPerLat*p.scale].map(v=>+v.toFixed(4)));
    const actual = old.buildingFootprints[index]; assert.equal(actual.length, expected.length);
    assert.deepEqual(actual,expected,'identical native four-decimal source footprint required');
    const prepared=inputTags.get(sourceId),modelInputTags=prepared&&Object.fromEntries(Object.entries(prepared).filter(([k])=>!k.startsWith('__')));
    if(heightIds.has(sourceId)&&modelInputTags)for(const key of ['height','building:levels','min_height','building:min_level'])assert.equal(modelInputTags[key],undefined);
    return { sourceId, sourceTags: way.tags, ...(modelInputTags?{modelInputTags}:{}), sourceRingLL, sourceHolesLL: [], style: old.styles[row[0]], ...(heightIds.has(sourceId)?{wallHeightM:profile.eavesM}:{}),
        basis: 'Retain the identical-source prior fallback MODEL. Newly admitted road proximity supplies no new building height/style evidence. Roof tags/research and literal dimensions still win.' };
});
const missing = new Map(audit.missingOldTreeRecords.map(r => [r.join(','), r])), measuredCrowns = [];
assert.equal(survey._retention, 'all-measured');
for (let i=0; i<survey.trees.length; i++) {
    const r = survey.trees[i], [lat,lon,radius] = r;
    const packed = [Math.round((lon-p.lon0)*p.mPerLon*p.scale*10),Math.round((p.lat0-lat)*p.mPerLat*p.scale*10),Math.round(Math.max(5,Math.min(22,2.3*radius+2.5))*10)*2];
    const key = [...packed, Math.round(radius*10), '',0,37].join(',');
    if (!missing.has(key)) continue;
    measuredCrowns.push({surveyIndex:i,rawSurveyCrown:r,packed,treeInfo:[-1,0,37],crownRadiusDm:Math.round(radius*10)}); missing.delete(key);
}
assert.equal(missing.size,0,'every omitted crown must match exact unchanged measured source');
assert.equal(measuredCrowns.length,audit.missingOldTreeRecords.length);
const review = {schema:1,sourceDataCommit:audit.source,sourceDataSha256:sha(read(oldFile)),surveySha256:sha(read(surveyFile)),projection:p,
    scope:'Exact prior fallback building models and measured source crowns retained through the finite Pasaj source-return expansion. No physical clearance, surveyed height, route or native pass is implied.',
    evidence:['handoffs/fidelity/unirii-pasaj-source-return/retention-prototype-r1.json.gz','game/research/trees-bucharest-unirii.json'],
    ...(modelInputsFile?{priorModelInputsSha256:sha(read(modelInputsFile))}:{}),
    rawTiles:files.map(f=>({name:path.basename(f),sha256:sha(read(f)),bytes:read(f).length})),waterAreas:[],measuredCrowns,inferredBuildingModels};
fs.writeFileSync(outFile,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({inferredBuildingModels:inferredBuildingModels.length,measuredCrowns:measuredCrowns.length,sha256:sha(read(outFile))}));
