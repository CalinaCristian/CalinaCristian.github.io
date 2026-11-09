import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const {OTP_ROOF_ZONES:R}=await import(root+'/game/src/landmark-otp-roofs.js');
const {footprintCells,ringArea}=await import(root+'/game/src/building-parts.js');
const {BUCHAREST_SOURCE_MASSES:M}=await import(root+'/game/src/landmark-source-masses.js');
const {LANDMARKS,buildLandmark}=await import(root+'/game/src/landmarks.js');
const source=JSON.parse(fs.readFileSync(root+'/game/research/landmark-source-bucharest.json')).landmarks.find(l=>l.id==='otp');
const ring=id=>source.primarySources.find(p=>p.id===id).ring.slice(0,-1),results=[];
for(const [key,r]of[['departures',ring('w771096082')],['pier',ring('w771096083')],['spine',M.otp.spine]]){
 const cells=footprintCells(r,R[key].zones.map(z=>z.ring)),area=cells.reduce((s,c)=>s+ringArea(c.ring),0),rawArea=Math.abs(ringArea(r));
 assert.ok(Math.abs(area-rawArea)<1e-5,'every source roof square metre survives the nonoverlapping subdivision');
 assert.ok(cells.every(c=>ringArea(c.ring)>0));
 results.push({roof:key,cells:cells.length,areaM2:area,sourceAreaM2:rawArea,baseColour:R[key].base});
}
const current=buildLandmark(LANDMARKS.find(l=>l.id==='otp'),{realScale:true});
if(process.argv[2]){
 const old=await import(path.resolve(process.argv[2])+'/game/src/landmarks.js'),before=old.buildLandmark(old.LANDMARKS.find(l=>l.id==='otp'),{realScale:true});
 assert.deepEqual(current.collision,before.collision,'all exact footprint, courtyard and vertical collision bands remain unchanged');
 assert.deepEqual(LANDMARKS.find(l=>l.id==='otp').sourceIds,old.LANDMARKS.find(l=>l.id==='otp').sourceIds,'source replacement identities remain unchanged');
 results.push({trianglesBefore:before.triangles,trianglesAfter:current.triangles,colliders:current.collision.length,collisionsUnchanged:true});
}
console.log(JSON.stringify(results,null,2));
