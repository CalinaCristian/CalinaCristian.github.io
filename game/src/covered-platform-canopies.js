import {pointInPolygon} from './util.js';
/** A measured canopy centre inside a literally mapped covered tram platform
 * is a source-classification conflict. OSM coverage wins over a canopy survey.
 * Mapped trees remain unresolved instead of choosing between two OSM records.
 * Run AFTER ordinary tree generation, preserving every retained instance/RNG. */
export function coveredPlatformCanopies(trees,platforms,metadata){
 const excluded=new Set(),conflicts=[],unresolved=[];
 if(!platforms.length)return{excluded,conflicts,unresolved};
 for(const t of trees){
  const meta=metadata.get(t);if(!meta)continue;
  const p=platforms.find(p=>pointInPolygon(t.x,t.z,p.points));if(!p)continue;
  const record={sourceTreeIndex:meta.sourceIndex,x:t.x,z:t.z,crownRadiusM:meta.crownRadiusM||null,platformSourceId:p.sourceId,basis:'Literal OSM covered platform takes priority over measured canopy classification; no source input or retained crown is changed'};
  if(meta.crownRadiusM>0){excluded.add(t);conflicts.push(record);}
  else unresolved.push({...record,basis:'Mapped/unknown crown conflicts with mapped covered platform; retained pending source review'});
 }
 return{excluded,conflicts,unresolved};
}
