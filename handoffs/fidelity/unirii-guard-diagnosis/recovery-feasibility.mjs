import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const here=path.dirname(new URL(import.meta.url).pathname),source=process.argv[2]||'/workspace/reality-pass/unirii-underpass/source-395071c2';
const {Traffic}=await import(pathToFileURL(path.join(source,'game/src/traffic.js')));
const F=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(here,'native-395-fixture.json.gz')))),D=F.dependencies[0],T=Traffic.prototype;
function pen(a,b){const f=v=>[-Math.sin(v.heading),-Math.cos(v.heading)],af=f(a),bf=f(b),ar=[-af[1],af[0]],br=[-bf[1],bf[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],d=[b.x-a.x,b.z-a.z];return Math.min(...[af,ar,bf,br].map(u=>Math.abs(dot(af,u))*a.length/2+Math.abs(dot(ar,u))*a.width/2+Math.abs(dot(bf,u))*b.length/2+Math.abs(dot(br,u))*b.width/2-Math.abs(dot(d,u))));}
function trial(id,otherId,direction,steps){
 const people=D.peds.map(p=>({...p})),all=D.vehicles.map(v=>({...v,mesh:{position:{set(){}}}})),v=all.find(v=>v.id===id),other=all.find(v=>v.id===otherId),start={x:v.x,z:v.z,s:v.s,odo:v.odo};
 const t=Object.create(T);Object.assign(t,{_frame:1,_dt:1/30,vehicles:all,player:{...D.state.player,fx:-Math.sin(D.state.player.heading),fz:-Math.cos(D.state.player.heading),front:3.42,rear:2.36,length:5.78,width:1.8},grid:{query(x,z,r,cb){for(const o of all)if(Math.hypot(x-o.x,z-o.z)<=r)cb(o);}},peds:{grid:{query(x,z,r,cb){for(const p of people)if(Math.hypot(x-p.x,z-p.z)<=r)cb(p);}}}});
 const rows=[];
 for(let i=0;i<steps;i++){
  const before=pen(v,other);t._frame=i+1;const moved=T.separateVehicleStep.call(t,v,other,direction*.8/30),after=pen(v,other);
  rows.push({tick:i+1,moved,before,after,x:v.x,z:v.z,s:v.s});if(!moved)break;
 }
 return {id,otherId,direction,rows,delta:{distanceM:Math.hypot(v.x-start.x,v.z-start.z),s:v.s-start.s,odo:v.odo-start.odo},allKnownBodyContacts:all.filter(o=>o!==v&&Math.abs(o.y-v.y)<=2).map(o=>({id:o.id,pen:pen(v,o)})).filter(x=>x.pen>0),coverage:'Existing separation helper enforces peer/player/pedestrian monotonicity. Static/source/grade/published swept-mesh feasibility is unrecorded here and NOT accepted.'};
}
const rows=[trial(35,47,1,1),trial(35,47,-1,1),trial(47,35,1,1),trial(47,35,-1,1),trial(35,47,1,6),trial(47,35,-1,2)];
assert(rows[0].rows[0].moved);assert(Math.abs(rows[0].rows[0].after-rows[0].rows[0].before)<1e-8,'outward estate movement does not meaningfully reduce its limiting SAT axis');assert(rows.every(r=>r.rows.every(s=>!s.moved||s.after<=s.before+1e-6)));assert(rows[5].rows.every(s=>s.moved));assert(rows[5].rows.at(-1).after<0,'two existing bounded sedan reverse steps separate the pair in held-body geometry');
const result={source:F.source,scope:'CPU-only existing bounded separation feasibility on retained395 state; no production guard/recovery change, no browser, no fresh native acceptance.',rows,conclusion:'At least one monotonic <=.8m/s detached translation exists, but existing overlapGuard skips recovery for the <.05m retained contact and returns immediately after rejection. This does not authorize a guard waiver or prove a complete source/static-safe route. Initial constructor poses were not recorded, so no admission cause is asserted.'};
fs.writeFileSync(path.join(here,'recovery-feasibility.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
