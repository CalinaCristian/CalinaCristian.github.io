import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { facadePanels, facadePiers } = await import('data:text/javascript;base64,'+readFileSync(new URL('../../game/src/facade-panels.js',import.meta.url)).toString('base64'));
const rect=[[0,0],[20,0],[20,10],[0,10]];
function capture(ring,options={}) { const quads=[];facadePanels(ring,4,24,{wall:'wall',bands:[{lo:6,hi:10,colour:'glass',material:'g'},{lo:14,hi:18,colour:'glass',material:'g'}],...options},(q,colour,mat,n)=>quads.push({q,colour,mat,n}));return quads; }
test('each original facade point has exactly one face, including overlapping corner and fin ownership',()=>{
 const strips=[{lo:0,hi:3,colour:'corner'},...facadePiers(20,2,.12,0,'fin')];const faces=capture(rect,{strips:i=>i===0?strips:[]}).filter(f=>f.q.every(p=>p[2]===0));
 for(let x=.013;x<20;x+=.173)for(let y=4.017;y<24;y+=.231){const hits=faces.filter(f=>x>f.q[0][0]&&x<f.q[1][0]&&y>f.q[0][1]&&y<f.q[2][1]);assert.equal(hits.length,1);if(x<3)assert.equal(hits[0].colour,'corner');}
 const area=faces.reduce((s,f)=>s+(f.q[1][0]-f.q[0][0])*(f.q[2][1]-f.q[0][1]),0);assert.ok(Math.abs(area-400)<1e-8);
});
test('projecting fins have no backing face and clipped ends retain returns',()=>{
 const faces=capture(rect,{strips:i=>i===0?[{lo:0,hi:3,colour:'corner'},{lo:2,hi:4,depth:.2,colour:'fin'}]:[]});
 const fronts=faces.filter(f=>f.colour==='fin'&&f.n[2]===-1);assert.equal(fronts.length,1);assert.equal(fronts[0].q[0][0],3);assert.equal(fronts[0].q[1][0],4);assert.equal(fronts[0].q[0][2],-.2);
 assert.equal(faces.filter(f=>f.colour==='fin'&&Math.abs(f.n[0])===1).length,2);
 assert.equal(faces.filter(f=>f.q.every(p=>p[2]===0)&&f.q[0][0]>=3&&f.q[1][0]<=4).length,0);
});
test('courtyard normals reverse without moving its source boundary',()=>{
 const outer=capture(rect),inner=capture(rect,{inward:true});assert.equal(outer.length,inner.length);
 for(let i=0;i<outer.length;i++){assert.deepEqual(inner[i].q,outer[i].q);for(let k=0;k<3;k++)assert.equal(inner[i].n[k]+outer[i].n[k],0);}
});
test('concave and short edges retain finite complete vertical skins',()=>{
 const ring=[[0,0],[20,0],[20,1],[10,1],[10,10],[0,10]];const faces=capture(ring,{strips:(_,l)=>facadePiers(l,9,.9,.025,'fin',3)});
 for(const f of faces)assert.ok(f.q.flat().every(Number.isFinite));
 assert.deepEqual(facadePiers(.2,9,.9,.025,'fin'),[]);
 assert.ok(faces.some(f=>f.q[0][0]===20&&f.q[1][0]===20));
});
