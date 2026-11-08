#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {CITIES} from '../../game/src/cities.js';
import {Navigator,canTravel} from '../../game/src/nav.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'source-roads-fixture-')),reports=[];
try{
 fs.mkdirSync(path.join(tmp,'tools'),{recursive:true});fs.mkdirSync(path.join(tmp,'game'),{recursive:true});fs.mkdirSync(path.join(tmp,'tiles'));
 fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});
 fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 for(const [city,c]of Object.entries(CITIES))for(const [did,d]of Object.entries(c.districts)){
  const anchor=d.bands?.[0]?.line[1]||[(d.bbox[0]+d.bbox[2])/2,(d.bbox[1]+d.bbox[3])/2],mlon=111320*Math.cos(anchor[0]*Math.PI/180);
  // Parallel main roads four metres apart, nearby unjoined dead end, five-metre stub,
  // and geometrically crossing elevated road with distinct source node IDs.
  const xy=[[-40,0],[0,0],[40,0],[-40,4],[0,4],[40,4],[0,5],[0,30],[-30,30],[-25,30],[10,-30],[10,30]];
  const pts=xy.map(([x,z])=>[anchor[0]-z/111132,anchor[1]+x/mlon]);
  const ways=[[9001,[1,2,3],{highway:'primary',name:'Lower main',lanes:'4'}],[9002,[4,5,6],{highway:'primary',name:'Upper main',lanes:'4'}],[9003,[7,8],{highway:'residential',name:'Unjoined dead end'}],[9004,[9,10],{highway:'service',name:'Five metre stub',access:'private'}],[9005,[11,12],{highway:'trunk',name:'Crossing deck',bridge:'yes',layer:'2',access:'private'}]];
  const xml='<osm version="0.6">'+pts.map(([lat,lon],i)=>`<node id="${i+1}" lat="${lat}" lon="${lon}"/>`).join('')+ways.map(([id,ns,tags])=>`<way id="${id}">${ns.map(n=>`<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k,v])=>`<tag k="${k}" v="${v}"/>`).join('')}</way>`).join('')+'</osm>';
  const source=path.join(tmp,'tiles',city==='seattle'?'sea_fixture.xml':'buc_fixture.xml');fs.writeFileSync(source,xml);
  execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--districts','--city',city,'--district',did],{stdio:'pipe'});
  const dataPath=path.join(tmp,'game/data',`${city}-${did}.json`),data=JSON.parse(fs.readFileSync(dataPath));
  const audit=JSON.parse(execFileSync(process.execPath,[path.join(root,'tools/osm/road-source-audit.mjs'),'--data',dataPath,'--osm',source],{encoding:'utf8'}));
  assert.equal(audit.expectedWhole,5);assert.equal(audit.missingWhole,0);assert.equal(audit.issues.length,0);assert.ok(audit.shortSourceStubs>=1);assert.equal(audit.privatePhysical,2);
  assert.ok(data.roadNodeIds.every(n=>n>0),'no inferred joins, densification, cuts or stub deletion in whole-core fixtures');
  assert.deepEqual(new Set(data.roadNodeIds),new Set(xy.map((_,i)=>i+1)),'all source vertices, including collinear ones, remain exact');
  reports.push({district:did,wholeWays:audit.expectedWhole,sourceVertices:data.roadNodeIds.length,shortStubs:audit.shortSourceStubs,privatePhysical:audit.privatePhysical,issues:audit.issues.length});
 }
 // A ghost connector is a tempting 20m shortcut across the closed map border.
 // Public source route goes around three real roads; neither GPS nor foot navigation may use the ghost.
 const nodes=[[0,0],[0,100],[100,100],[100,0]].map(([x,z],id)=>({id,x,z,edges:[]}));
 const edge=(a,b,virtual=false)=>{const A=nodes[a],B=nodes[b],len=Math.hypot(B.x-A.x,B.z-A.z),e={a:A,b:B,len,dirx:(B.x-A.x)/len,dirz:(B.z-A.z)/len,lanesF:1,lanesB:1,type:'residential',maxspeed:10,virtual};A.edges.push(e);B.edges.push(e);return e;};
 const edges=[edge(0,1),edge(1,2),edge(2,3),edge(0,3,true)],nav=new Navigator({graph:{nodes,edges},data:{roadGeometryPolicy:'source'}});
 for(const walking of [false,true]){nav.walking=walking;const route=nav.compute(0,1,100,1);assert.ok(route);assert.ok(route.legs.every(l=>!l.e.virtual));assert.ok(route.legs.length>=3,'real public approach retained despite tempting ghost shortcut');}
 assert.equal(canTravel(edges[3],1),false);assert.ok(!nav.index.edges.includes(edges[3]));
 console.log(JSON.stringify({districts:reports,ghostConnectorRoutesChecked:2,issues:0},null,2));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
