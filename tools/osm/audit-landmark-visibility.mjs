import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
import{CITIES}from'../../game/src/cities.js';import{LANDMARKS}from'../../game/src/landmarks.js';import{districtLandmarkCoverage}from'../../game/src/landmark-visibility.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),apply=process.argv.includes('--apply'),output=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
const report={scope:'All61 existing catalogue entries against all8 stored district flight/playable domains and the ordinary5km camera far limit plus the existing150m flight margin. Potential coverage only: camera direction, building/terrain occlusion and successful native construction require separate checks. Existing explicit mountain backdrops are retained. Distant real-world visibility beyond the current draw limit remains a separate coverage gap.',districts:[],missingPairs:0,legacyBoxRejected:0};
let source=fs.readFileSync(path.join(root,'game/src/cities.js'),'utf8');
for(const[cityId,city]of Object.entries(CITIES))for(const[id,district]of Object.entries(city.districts)){
 const data=JSON.parse(fs.readFileSync(path.join(root,`game/data/${cityId}-${id}.json`))),coverage=districtLandmarkCoverage({landmarks:LANDMARKS,cityId,district,data}),missing=coverage.filter(c=>c.missing),rejected=coverage.filter(c=>c.legacyBoxRejected);
 report.missingPairs+=missing.length;report.legacyBoxRejected+=rejected.length;report.districts.push({id,city:cityId,name:district.name,coverage,missing:missing.map(c=>c.id),legacyBoxRejected:rejected.map(c=>c.id)});
 if(apply&&missing.length){
  for(const[field,values]of[['landmarks',[...(district.landmarks||[]),...missing.map(c=>c.id)]],['scenery',[...(district.scenery||[]),...missing.map(c=>c.id)]]]){
   const pattern=new RegExp('(^    '+id+': \\{[\\s\\S]*?\\n        '+field+': )\\[[^\\]]*\\]','m');
   if(!pattern.test(source))throw Error('Cannot locate district field '+id+':'+field);
   source=source.replace(pattern,(_,prefix)=>prefix+'['+[...new Set(values)].map(v=>"'"+v+"'").join(', ')+']');
  }
 }
}
if(apply)fs.writeFileSync(path.join(root,'game/src/cities.js'),source);
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({missingPairs:report.missingPairs,legacyBoxRejected:report.legacyBoxRejected,districts:report.districts.map(d=>({id:d.id,missing:d.missing,legacyBoxRejected:d.legacyBoxRejected})),applied:apply},null,2));
