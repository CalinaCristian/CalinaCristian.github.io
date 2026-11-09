import fs from 'node:fs';
import {decodeSourceContext,sourceTerrainField,unknownContextVerticalParts} from '../../game/src/spots/source-context-data.js';
import {sourceRecord,resolveSourcePlan} from '../../game/src/spots/source-buildings.js';
import {buildingStyle} from '../../game/src/spots/osm.js';
const[input,output]=process.argv.slice(2);if(!input||!output)throw Error('input-context.json output-plan.json');
const raw=JSON.parse(fs.readFileSync(input)),data=decodeSourceContext(raw,raw.frame),field=sourceTerrainField(raw.terrain,raw.frame.origin,raw.frame.projection),unknown=new Set(unknownContextVerticalParts(data).map(b=>b.id));
const ground={heightAt:(x,z)=>{const h=field.heightAt(x,z);if(h==null)throw Error('Unknown source terrain');return h;}};
const start=performance.now(),records=data.buildings.map((b,i)=>unknown.has(b.id)?null:sourceRecord(b,i,ground,{house:buildingStyle(b,true)==='house'})).filter(Boolean),plan=resolveSourcePlan(records,null);
fs.writeFileSync(output,JSON.stringify(plan.geometryCache));console.log(JSON.stringify({input,output,sourceRecords:data.buildings.length,modeledSourceRecords:records.length,unresolvedVerticalSourceIds:[...unknown],volumes:plan.volumes.length,issues:plan.stats.issues,elapsedMs:performance.now()-start,bytes:fs.statSync(output).size}));
