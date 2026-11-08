import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CEC_SOURCE_MASSES as source } from '../../src/landmark-cec-source.js';
import { LANDMARKS, buildLandmark } from '../../src/landmarks.js';
import { parseMeasure } from '../../src/building-roofs.js';
import { Box3 } from '../../vendor/three.module.min.js';

const bytes=fs.readFileSync(new URL('../../data/bucharest-unirii.json',import.meta.url)),data=JSON.parse(bytes);
// The recorded dataset SHA identifies the source snapshot used to bake the model.
// Unrelated district trees/roads can change later; compare the actual CEC source
// records below so a source-volume edit still fails without rebaking the model.
const landmark=LANDMARKS.find(l=>l.id==='cec'),built=buildLandmark(landmark,{realScale:true,floodlit:false}),volumes=source.volumes;
assert.equal(volumes.length,162);assert.equal(built.collision.length,162);
assert.equal(new Set(volumes.map(v=>v.sourceId)).size,161);
assert.equal(volumes.reduce((n,v)=>n+v.holes.length,0),5);
const yaw=source.anchor.yaw,c=Math.cos(yaw),s=Math.sin(yaw),ox=(source.anchor.lon-data.proj.lon0)*data.proj.mPerLon,oz=-(source.anchor.lat-data.proj.lat0)*data.proj.mPerLat;
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
let literals=0;
for(let i=0;i<volumes.length;i++){
 const v=volumes[i],actual=built.collision[i],raw=data.buildingFootprints[v.sourceIndex];
 assert.equal(v.sourceId,data.buildingIds[v.sourceIndex]);assert.ok(landmark.sourceIds.includes(v.sourceId));
 const row=data.buildings[v.sourceIndex],dimensions=data.buildingDimensions?.[v.sourceIndex];
 close(v.totalM,dimensions?.[0]??row[1]/10,'compiled source total');
 close(v.minimumM,dimensions?.[1]??row[2]/10,'compiled source minimum');
 assert.deepEqual(v.roofProfile,data.buildingRoofProfiles[v.sourceIndex],'compiled source roof profile');
 close(actual.y0,v.minimumM,'source minimum');close(actual.y1,v.totalM,'source total');
 assert.equal(actual.sourceId,v.sourceId);assert.equal(actual.poly.length,raw.length);
 for(let j=0;j<raw.length;j++){close(actual.poly[j][0]+ox,raw[j][0],'exact outer x');close(actual.poly[j][1]+oz,raw[j][1],'exact outer z');}
 const holes=data.buildingHoleFootprints[v.sourceIndex]||[];assert.equal(actual.holes.length,holes.length);
 for(let h=0;h<holes.length;h++){assert.equal(actual.holes[h].length,holes[h].length);for(let j=0;j<holes[h].length;j++){close(actual.holes[h][j][0]+ox,holes[h][j][0],'exact hole x');close(actual.holes[h][j][1]+oz,holes[h][j][1],'exact hole z');}}
 const literal=parseMeasure(v.rawTags.height);if(Number.isFinite(literal)){close(v.totalM,literal,'literal OSM total includes roof');literals++;}
}
assert.equal(literals,153);
const relations=['r13104090','r13104091','r13104092','r13104229','r13104230','r13104231'],restored=volumes.filter(v=>relations.includes(v.sourceId));
assert.equal(restored.length,7);assert.equal(restored.reduce((n,v)=>n+v.holes.length,0),5);
assert.deepEqual(restored.filter(v=>v.sourceId==='r13104229').map(v=>v.totalM),[25,25]);
assert.equal(restored.find(v=>v.sourceId==='r13104091').totalM,23.5);
assert.notEqual(restored.find(v=>v.sourceId==='r13104092').roofProfile.heightSource,'OSM height');
const bounds=new Box3().setFromObject(built.mesh);close(bounds.max.y,37.5,'model literal maximum');
const key=f=>f.map(p=>p.map(x=>Math.round(x*1e7)).join(',')).sort().join(';'),seen=new Set();let duplicate=0;
for(const f of source.roofs){const k=key(f.vertices);if(seen.has(k))duplicate++;seen.add(k);}
assert.equal(duplicate,0,'canonical source roof has no duplicate coplanar triangle');
const ledger=JSON.parse(fs.readFileSync(new URL('../../research/landmark-cec-source-assemblies.json',import.meta.url)));
assert.ok(ledger.derivedGeometry.maximumSourceBodyDeficitM2<1e-8);assert.equal(ledger.derivedGeometry.maximumDerivedOutsideSourceM2,0);
console.log(JSON.stringify({sourceVolumes:volumes.length,newRelationOuters:restored.length,rawHoles:5,literalHeights:literals,estimatedTotals:volumes.length-literals,modelColliders:built.collision.length,modelTriangles:built.triangles,duplicateRoofTriangles:duplicate,maximumHeight:bounds.max.y,uncertainProfiles:built.mesh.userData.sourceMassAudit.roofIssues.length}));
