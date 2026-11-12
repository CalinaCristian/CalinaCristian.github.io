#!/usr/bin/env node
// Exact-source model controls for the three Pipera-owned landmarks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { collideBuildings } from '../../game/src/world.js';
import { pointInPolygon } from '../../game/src/util.js';
import { footprintCoverage } from '../../game/src/building-parts.js';
import { readDistrictData } from '../osm/district-data.mjs';
const data=readDistrictData(process.argv[2]||'game/data/bucharest-pipera.bin.gz');
const proj=ll=>[(ll.lon-data.proj.lon0)*data.proj.mPerLon,-(ll.lat-data.proj.lat0)*data.proj.mPerLat];
const decode=a=>{let x=0,z=0;const p=[];for(let i=0;i<a.length;i+=2){x+=a[i];z+=a[i+1];p.push([x/10,z/10]);}return p;};
let checks=0;const report=[];
for(const id of ['skytower','hermes','bob']){
    const lm=LANDMARKS.find(l=>l.id===id),anchor=proj(lm),c=Math.cos(lm.rotation),s=Math.sin(lm.rotation),local=([x,z])=>{x-=anchor[0];z-=anchor[1];return[x*c-z*s,x*s+z*c];};
    const sourceBuildings=Object.fromEntries(lm.sourceIds.map(source=>[source,data.buildingIds.flatMap((v,i)=>v===source?[{
        sourceId:source,ring:(data.buildingFootprints?.[i]||decode(data.buildings[i].slice(9))).map(local),
        holes:(data.buildingHoleFootprints?.[i]||(data.buildingHoles?.[i]||[]).map(decode)).map(h=>h.map(local)),
        h:data.buildingDimensions?.[i]?.[0]??data.buildings[i][1]/10,minH:0,levels:data.buildings[i][6],colour:data.strings[data.buildings[i][7]],roofColour:data.strings[data.buildings[i][8]]
    }]:[])]));
    assert(Object.values(sourceBuildings).every(a=>a.length===1),'every declared source is present exactly once');checks++;
    const model=buildLandmark(lm,{realScale:true,sourceBuildings});let maxY=-Infinity,triangles=0;
    model.mesh.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position.array;for(let i=0;i<p.length;i++){assert(Number.isFinite(p[i]));if(i%3===1)maxY=Math.max(maxY,p[i]);}triangles+=(o.geometry.index?.count??p.length/3)/3;});
    const world=p=>[p[0]*c+p[1]*s,-p[0]*s+p[1]*c];
    for(const list of Object.values(sourceBuildings))for(const source of list){const ring=source.ring.map(world),hit=model.collision.find(b=>b.poly&&Math.abs(footprintCoverage(ring,[b.poly]).uncovered)<1e-6&&Math.abs(footprintCoverage(b.poly,[ring]).uncovered)<1e-6);assert(hit,'a complete source outer has an exact model collider');checks++;}
    if(id==='skytower'){assert(Math.abs(maxY-137)<.001,'source137m is the total roof height');assert.equal(sourceBuildings.w219622660[0].colour.toLowerCase(),'#3960da');checks+=2;}
    if(id==='bob'){assert(Math.abs(maxY-sourceBuildings.w55450549[0].h)<.001,'estimated total envelope and plant top agree');checks++;}
    if(id==='hermes'){
        const source=sourceBuildings.r6774709[0],hole=source.holes[0],p=hole.reduce((a,q)=>[a[0]+q[0]/hole.length,a[1]+q[1]/hole.length],[0,0]),q=world(p);
        for(const y of [.3,4,8,15,25]){assert.equal(collideBuildings(model.collision,q[0],q[1],.3,y),null,'mapped courtyard remains clear through every tier');checks++;}
        const worldHole=hole.map(world);model.mesh.updateMatrixWorld(true);
        model.mesh.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry,p=geo.attributes.position.array,idx=geo.index?.array||Array.from({length:p.length/3},(_,i)=>i);for(let j=0;j<idx.length;j+=3){const a=[...p.slice(idx[j]*3,idx[j]*3+3)],b=[...p.slice(idx[j+1]*3,idx[j+1]*3+3)],d=[...p.slice(idx[j+2]*3,idx[j+2]*3+3)];if(Math.max(a[1],b[1],d[1])-Math.min(a[1],b[1],d[1])>.001)continue;const tri=[world([a[0],a[2]]),world([b[0],b[2]]),world([d[0],d[2]])];const ar=Math.abs((tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[2][0]-tri[0][0])*(tri[1][1]-tri[0][1]))/2;if(ar<1e-6)continue;assert(footprintCoverage(tri,[worldHole]).uncovered>=ar-1e-3,'no horizontal cap fills the courtyard (<=0.001m² Float32 boundary tolerance) '+JSON.stringify({y:a[1],tri,ar,uncovered:footprintCoverage(tri,[worldHole]).uncovered}));checks++;}});
    }
    report.push({id,sourceIds:lm.sourceIds,maxY,triangles,colliders:model.collision.length});
}
console.log(JSON.stringify({passed:true,checks,models:report},null,2));
