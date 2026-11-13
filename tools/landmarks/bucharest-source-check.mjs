// Checks the actual researched landmark source rings and ground collision, not an implementation mirror.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../../game/vendor/three.module.min.js';
import {collideBuildings} from '../../game/src/world.js';
const url=new URL('../../game/src/landmarks.js',import.meta.url);
const source=(await fs.readFile(url,'utf8')).replace(/from '([^']+)'/g,(_,p)=>`from '${new URL(p,url).href}'`)+ '\nexport {P,P2,FOUNTAIN_RINGS};';
const {P,P2,FOUNTAIN_RINGS,LANDMARKS,buildLandmark}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const facts=JSON.parse(await fs.readFile(new URL('../../game/research/landmark-source-bucharest.json',import.meta.url)));
const inside=(p,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])hit=!hit;return hit;};
const nearRing=(p,r)=>r.some((a,i)=>{const b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)<0.011;});
const results=[];let checks=0;
for(const record of facts.landmarks){
 const lm=LANDMARKS.find(l=>l.id===record.id),model=buildLandmark(lm,{realScale:true}),box=new THREE.Box3().setFromObject(model.mesh);
 assert.deepEqual(lm.sourceIds,record.sourceIds,`${lm.id}: replacement identities match evidence`);checks++;
 const floor=record.groundPit?.floorY??0; // (a recorded sunk bowl stands on its pit floor: Stadionul Dinamo)
 assert(box.min.y<=floor+(floor?0.13:0.01)&&box.min.y>=floor-0.5,`${lm.id}: model has actual ground support`);checks++;
 const refs=[...record.primarySources,...record.associatedParts,...record.primarySources.flatMap(r=>(r.members||[]).map(m=>m.way).filter(Boolean))];
 for(const mapping of record.footprintUpgrades){
  const key=typeof mapping.authoredRing==='string'?mapping.authoredRing:record.id;
  const flat=mapping.ringCollection==='FOUNTAIN_RINGS'?FOUNTAIN_RINGS[mapping.authoredRing]:(P[key]||P2[key])[typeof mapping.authoredRing==='number'?mapping.authoredRing:0];const ring=[];for(let i=0;i<flat.length;i+=2)ring.push([flat[i],flat[i+1]]);
  const actual=refs.find(r=>r.id===mapping.sourceId)?.ring;assert(actual,`${lm.id}: source ring exists`);
  assert(ring.every(p=>nearRing(p,actual))&&actual.every(p=>nearRing(p,ring)),`${lm.id}: full source boundary retained to 0.011 m`);checks+=2;
 }
 let courts=0;
 for(const collider of model.collision){
  if(!collider.poly||!collider.holes?.length)continue;const cs=Math.cos(collider.angle||0),sn=Math.sin(collider.angle||0);
  for(const hole of collider.holes){
   const minX=Math.min(...hole.map(p=>p[0])),maxX=Math.max(...hole.map(p=>p[0])),minZ=Math.min(...hole.map(p=>p[1])),maxZ=Math.max(...hole.map(p=>p[1]));let tested=false;
   for(let x=minX+1;x<maxX-1&&!tested;x+=1)for(let z=minZ+1;z<maxZ-1&&!tested;z+=1){
    const clearance=Math.min(...hole.map((a,i)=>{const b=hole[(i+1)%hole.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}));
    if(!inside([x,z],hole)||clearance<0.5)continue;
    const wx=x,wz=z;
    // Test this source solid independently; unrelated elevated details may legitimately cross a court.
    assert.equal(collideBuildings([{...collider,r:Math.hypot(collider.hw,collider.hd)}],wx,wz,0.1,Math.max(1,(collider.y0||0)+0.5)),null,`${lm.id}: source court is open`);tested=true;courts++;checks++;
   }
   if(!tested){
    // Thin mapped slots may have no walkable 0.5 m clearance. Test their actual triangulated interior
    // with a correspondingly small body rather than treating their bounding rectangle as a courtyard.
    const area=Math.abs(hole.reduce((sum,a,i)=>{const b=hole[(i+1)%hole.length];return sum+a[0]*b[1]-a[1]*b[0]},0))/2;
    const candidates=THREE.ShapeUtils.triangulateShape(hole.map(p=>new THREE.Vector2(...p)),[]).map(face=>face.reduce((p,i)=>[p[0]+hole[i][0]/3,p[1]+hole[i][1]/3],[0,0]));
    for(const [x,z]of candidates){
     if(!inside([x,z],hole))continue;
     const clear=Math.min(...hole.map((a,i)=>{const b=hole[(i+1)%hole.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)}));
     if(clear<0.00001)continue;
     assert.equal(collideBuildings([{...collider,r:Math.hypot(collider.hw,collider.hd)}],x,z,Math.min(0.05,clear/4),Math.max(1,(collider.y0||0)+0.5)),null,`${lm.id}: narrow source slot remains clear`);tested=true;courts++;checks++;break;
    }
    if(area>0.01)assert(tested,`${lm.id}: nondegenerate source void has an interior probe`);
   }
  }
 }
 for(const probe of record.massUpgrades?.heightProbes||[]){
  const c=Math.cos(lm.rotation||0),sn=Math.sin(lm.rotation||0),x=probe.x*c+probe.z*sn,z=-probe.x*sn+probe.z*c;
  model.mesh.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,300,z),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(model.mesh,true);assert(hits.length,`${lm.id}: source height probe hits geometry`);
  assert(Math.abs(hits[0].point.y-probe.height)<0.12,`${lm.id}: source ${probe.sourceId} roof ${hits[0].point.y} matches ${probe.height}`);checks++;
 }
 const expected={cathedral:127.05,regal:18,ateneu:41,romexpo:34,baneasasc:22,marriott:40,promenada:18.05,gara:26,globalworth:120}[lm.id];
 if(expected!==undefined){assert(Math.abs(box.max.y-expected)<0.11,`${lm.id}: documented height envelope`);checks++;}
 results.push({id:lm.id,passed:true,rings:record.footprintUpgrades.length,courts,height:box.max.y,triangles:model.triangles,sourceIdentities:lm.sourceIds.length});
}
assert.equal(results.length,33,'All 33 owned Bucharest landmarks have source-led geometry checks');
console.log(JSON.stringify({passed:true,checks,models:results},null,2));
