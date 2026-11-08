// Restore audited positive relation-part inputs without refetching or changing
// existing scene features. Full source builds consume the same supplemental file.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compactBuilding,projector} from './build-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const source=JSON.parse(fs.readFileSync(path.join(root,'game/research/osm/spot-part-relations.json')));
for(const sceneId of new Set(source.records.flatMap(r=>r.scenes))){
    const file=path.join(root,'game/data/spots',sceneId+'.json'),data=JSON.parse(fs.readFileSync(file)),P=projector(data.origin.lat,data.origin.lon),ids=new Set(data.buildings.map(b=>b.id)),added=[];
    for(const r of source.records.filter(r=>r.scenes.includes(sceneId))){
        if(ids.has(r.building.id))continue;
        const b=compactBuilding(r.building,P,false);if(!b)throw Error('Invalid audited relation part '+r.building.id);
        data.buildings.push(b);ids.add(b.id);added.push(b.id);
    }
    data.sourceSupplements=[{input:'game/research/osm/spot-part-relations.json',rawSHA256:source.rawSHA256,ids:source.records.filter(r=>r.scenes.includes(sceneId)).map(r=>r.building.id)}];
    fs.writeFileSync(file,JSON.stringify(data));console.log(sceneId,JSON.stringify({added,sourceRecords:data.buildings.length}));
}
