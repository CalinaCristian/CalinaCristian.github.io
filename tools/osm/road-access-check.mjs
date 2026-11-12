import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveRoadAccess, ambientTrafficAccess } from '../../game/src/road-access.js';
import { Navigator, canTravel } from '../../game/src/nav.js';
import { readDistrictData } from './district-data.mjs';

const cases=[
 [{highway:'trunk',access:'private'},false,false,'access'],
 [{highway:'service',access:'private',motorcar:'yes'},true,true,'motorcar'],
 [{access:'yes',vehicle:'no',motor_vehicle:'private',motorcar:'permissive'},true,true,'motorcar'],
 [{access:'private',vehicle:'destination'},true,false,'vehicle'],
 [{access:'customers'},true,false,'access'],
 [{access:'permissive'},true,true,'access'],
 [{access:'delivery'},false,false,'access'],
 [{access:'yes','motorcar:conditional':'no @ (Mo-Fr 08:00-18:00)'},false,false,'access'],
 [{access:'private','motorcar:conditional':'yes @ (Su)'},false,false,'access'],
 [{highway:'motorway_link','hov:lanes':'designated|designated'},false,false,null],
 [{service:'emergency_access'},false,false,null],
 [{service:'emergency_access',motorcar:'yes'},true,true,'motorcar'],
 [{service:'parking_aisle'},true,false,null],
 [{oneway:'reversible'},false,false,null],
 [{access:'not_private'},false,false,'access'],
];
for(const [tags,pub,through,key]of cases){const actual=resolveRoadAccess(tags);assert.equal(actual.publicDrive,pub,JSON.stringify(tags));assert.equal(actual.throughAccess,through);assert.equal(actual.key,key);}

// A short customers-only shortcut is physically present but cannot carry through routing.
const nodes=[[0,0],[100,0],[200,0],[100,100]].map(([x,z],id)=>({id,x,z,edges:[]}));
const edge=(a,b,tags={},name='public')=>{const A=nodes[a],B=nodes[b],len=Math.hypot(B.x-A.x,B.z-A.z);const e={a:A,b:B,len,dirx:(B.x-A.x)/len,dirz:(B.z-A.z)/len,lanesF:1,lanesB:1,type:'residential',name,maxspeed:10,...resolveRoadAccess(tags)};A.edges.push(e);B.edges.push(e);return e;};
const edges=[edge(0,1),edge(1,2),edge(0,3,{access:'customers'},'customers'),edge(3,2,{access:'customers'},'customers'),edge(1,3,{access:'private'},'private')];
const nav=new Navigator({graph:{nodes,edges}}),r=nav.compute(10,0,190,0);
assert.ok(r);assert.ok(r.legs.every(l=>l.e.throughAccess!==false),'public endpoints never route through customers/private roads');
const end=nav.compute(10,0,100,95);assert.ok(end);assert.ok(end.legs.some(l=>l.e.name==='customers'),'a selected customer destination remains reachable');
assert.ok(end.legs.every(l=>l.e.publicDrive!==false),'private source roads never carry the route');
assert.equal(canTravel(edges[4],1),false);assert.equal(ambientTrafficAccess(edges[2]),false);assert.equal(ambientTrafficAccess(edges[0]),true);

// Exercise actual builder serialization in an isolated miniature repository.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'road-access-fixture-'));
try{
 fs.mkdirSync(path.join(tmp,'tools'),{recursive:true});fs.mkdirSync(path.join(tmp,'game'),{recursive:true});
 fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});
 fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.mkdirSync(path.join(tmp,'tiles'));
 fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 const pts=[[47.444,-122.301],[47.445,-122.301],[47.445,-122.299],[47.444,-122.299],[47.4445,-122.300],[47.4447,-122.300],[47.4448,-122.3005],[47.4442,-122.3005]];
 const ways=[
  [9001,[1,2,3,4,1],{highway:'residential',name:'Public loop',lanes:'2'}],
  [9002,[2,5,4],{highway:'trunk',name:'Private elevated road',access:'private',bridge:'yes',layer:'2',lanes:'2'}],
  [9003,[1,6,3],{highway:'service',name:'Public specific override',access:'private',motorcar:'yes',lanes:'2'}],
  [9004,[2,7,3],{highway:'service',service:'parking_aisle',access:'customers',lanes:'2'}],
  [9005,[1,8,4],{highway:'service',service:'emergency_access',access:'private'}],
  [9006,[7,8],{highway:'footway'}],
  [9007,[5,6],{aeroway:'runway',ref:'fixture'}],
 ];
 const xml='<osm version="0.6">'+pts.map(([lat,lon],i)=>`<node id="${i+1}" lat="${lat}" lon="${lon}"/>`).join('')+ways.map(([id,ns,tags])=>`<way id="${id}">${ns.map(n=>`<nd ref="${n}"/>`).join('')}${Object.entries(tags).map(([k,v])=>`<tag k="${k}" v="${v}"/>`).join('')}</way>`).join('')+'</osm>';
 fs.writeFileSync(path.join(tmp,'tiles/sea_fixture.xml'),xml);
 execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--districts','--district','seatac'],{stdio:'pipe'});
 const data=readDistrictData(path.join(tmp,'game/data/seattle-seatac.json')),rows=Object.entries(data.roadAccess),lookup=id=>rows.find(([,r])=>r.sourceId==='w'+id);
 for(const id of [9001,9002,9003,9004,9005])assert.ok(lookup(id),'whole mapped physical road retained: w'+id);
 assert.equal(lookup(9002)[1].publicDrive,false);assert.equal(lookup(9002)[1].tags.layer,'2');
 assert.ok(data.roads[+lookup(9002)[0]][8]&2,'restricted bridge retains its elevated road flag');
 assert.equal(lookup(9003)[1].publicDrive,true,'specific public motorcar permission beats inherited private access');
 assert.equal(lookup(9004)[1].throughAccess,false);assert.equal(lookup(9005)[1].publicDrive,false);
 assert.equal(lookup(9006),undefined,'footways are never invented as driving roads');assert.equal(lookup(9007),undefined,'runways remain source aeroways, never driving roads');
 console.log(JSON.stringify({unitCases:cases.length,routerChecks:5,builderChecks:10,restrictedPhysicalRoadsRetained:true,sourceFixture:tmp},null,2));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
