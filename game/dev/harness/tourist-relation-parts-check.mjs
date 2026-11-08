import fs from 'node:fs';
import assert from 'node:assert/strict';
import {convert,positiveBuildingTag} from '../../src/spots/tools/fetch-buc.mjs';
import {compactBuilding,projector} from '../../src/spots/tools/build-data.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../research/osm/spot-part-relations.json',import.meta.url)));
const box={core:{s:44,n:45,w:26,e:27}};
const actual=convert({elements:structuredClone(manifest.rawRelations)},box,'buc-old-town');
assert.equal(actual.buildings.length,7,'six real relations include seven outer rings');
for(const b of actual.buildings){
    const expected=manifest.records.find(r=>r.building.id===b.id)?.building;
    assert.deepEqual(b,expected,'full source rings, inner rings and tags retained');
    const c=compactBuilding(b,projector(44.4313,26.0995));assert.equal(c.part,true);assert.ok(c.poly.length>=3);
    if(b.height)assert.equal(c.h,Number(b.height));
}
for(const v of ['no','false','0','',null,undefined])assert.equal(positiveBuildingTag(v),false);
for(const v of ['yes','roof','apartments'])assert.equal(positiveBuildingTag(v),true);
const negative=structuredClone(manifest.rawRelations[0]);negative.tags['building:part']='no';
assert.equal(convert({elements:[negative]},box,'negative').buildings.length,0,'building:part=no is not a building');
const p=projector(44.4313,26.0995);
const tiny={id:'tiny-control',footprint:[[44.4313,26.0995],[44.4313,26.099507],[44.431305,26.099507],[44.431305,26.0995]],'building:part':'yes',height:'2'};
assert.ok(compactBuilding(tiny,p),'a valid source footprint below 2m² must remain');
console.log('Tourist relation-part raw rings, positive tags, projection and small-volume preservation pass.');
