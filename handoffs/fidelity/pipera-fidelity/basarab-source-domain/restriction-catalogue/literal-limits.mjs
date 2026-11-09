import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
const repo=process.argv[2]||process.cwd(),out=process.argv[3]||'/tmp/literal-road-limits.json',districts=[];
for(const file of fs.readdirSync(path.join(repo,'game/data')).filter(f=>/^(bucharest|seattle)-.*\.json$/.test(f)).sort()){
 const bytes=fs.readFileSync(path.join(repo,'game/data',file)),data=JSON.parse(bytes),sources=new Map();
 for(const[index,s]of Object.entries(data.roadSourceGeometry||{})){
  const literalLimits=Object.fromEntries(Object.entries(s.tags).filter(([key])=>['maxheight','maxheight:physical','maxwidth'].includes(key)||['maxheight:','maxwidth:'].some(p=>key.startsWith(p))));
  if(!Object.keys(literalLimits).length)continue;
  if(!sources.has(s.sourceId))sources.set(s.sourceId,{sourceId:s.sourceId,roadIndices:[],literalLimits,sourceTags:s.tags,sourceNodeIds:s.nodeIds});
  sources.get(s.sourceId).roadIndices.push(+index);
 }
 districts.push({dataFile:'game/data/'+file,dataSha256:createHash('sha256').update(bytes).digest('hex'),district:data.district?.id,sourceWayRecords:[...sources.values()]});
}
fs.writeFileSync(out,JSON.stringify({schema:1,scope:'Read-only exact literal way-tag inventory from retained core roadSourceGeometry. No numeric/conditional/unit assumptions or routing/admission changes. Node-mounted signs and real-world completeness are outside scope.',districts},null,2)+'\n');
