import fs from 'node:fs';
import { Navigator, canTravel } from '/workspace/fidelity-workers/ordinary-source-span/game/src/nav.js';
import { buildTurnLaneRules, laneTurnAllowed } from '/workspace/fidelity-workers/ordinary-source-span/game/src/turn-lanes.js';
const files={original:'/workspace/reality-pass/groz-lukoil-nav/original-406a-grozavesti.json',candidate:'/workspace/fidelity-workers/ordinary-source-span/game/data/bucharest-grozavesti.json'};
const target=[95.61743476364953,-571.3682937897058],reports=[];
for(const[label,file]of Object.entries(files)){
 const d=JSON.parse(fs.readFileSync(file)),ends=new Set(d.district.ends),nodes=d.roadNodeIds.map((sourceId,id)=>({id,sourceId,x:d.roadNodePositions[2*id],z:d.roadNodePositions[2*id+1],edges:[],mapEnd:ends.has(id)})),edges=[];
 for(const[road,row]of d.roads.entries())for(let j=11;j<row.length;j++){
  const a=nodes[row[j-1]],b=nodes[row[j]],len=Math.hypot(b.x-a.x,b.z-a.z),access=d.roadAccess[road];
  const e={id:edges.length,road,a,b,len,dirx:(b.x-a.x)/len,dirz:(b.z-a.z)/len,oneway:!!(row[8]&1),lanesF:row[2],lanesB:row[3],type:d.classes[row[1]],name:d.strings[row[0]],maxspeed:row[7]/3.6,publicDrive:access.publicDrive,throughAccess:access.throughAccess,access};
  e.nx=-e.dirz;e.nz=e.dirx;edges.push(e);a.edges.push(e);b.edges.push(e);
 }
 const pub=edges.filter(e=>e.publicDrive!==false),nav=new Navigator({data:d,graph:{nodes,edges:pub}}),rules=buildTurnLaneRules(d,edges),m=d.district.mask,bits=[];let v=0;for(const n of m.rle){bits.push(...Array(n).fill(v));v^=1;}
 const inside=(x,z)=>{const i=Math.floor((x-m.x0)/m.cell),j=Math.floor((z-m.z0)/m.cell);return i>=0&&j>=0&&i<m.w&&j<m.h&&!!bits[j*m.w+i];};
 const doina=pub.filter(e=>/Doina Cornea/.test(e.name)),routes=doina.map(e=>{
  const x=(e.a.x+e.b.x)/2,z=(e.a.z+e.b.z)/2,r=nav.compute(x,z,...target);
  return{source:e.access.sourceId,from:e.a.sourceId,to:e.b.sourceId,x,z,route:r?{metres:r.total,goalSource:r.legs.at(-1).e.access.sourceId,legs:r.legs.map(l=>({sourceId:l.e.access.sourceId,from:l.dir>0?l.e.a.sourceId:l.e.b.sourceId,to:l.dir>0?l.e.b.sourceId:l.e.a.sourceId,dir:l.dir,virtual:!!l.e.virtual}))}:null};
 });
 const required=(d.district.sourceReturns?.corridors||[]).map(c=>({id:c.id,legs:c.legs.length,missing:[],offMask:[]}));
 for(const[cindex,c]of(d.district.sourceReturns?.corridors||[]).entries())for(const leg of c.legs){
  const matches=edges.filter(e=>e.access.sourceId===leg.sourceId&&([1,-1].some(dir=>canTravel(e,dir)&&(dir>0?e.a:e.b).sourceId===leg.from&&(dir>0?e.b:e.a).sourceId===leg.to)));
  if(matches.length!==1)required[cindex].missing.push({...leg,matches:matches.length});
  const n=Math.ceil(Math.hypot(leg.toXZ[0]-leg.fromXZ[0],leg.toXZ[1]-leg.fromXZ[1])/.5);
  for(let i=0;i<=n;i++)if(!inside(leg.fromXZ[0]+(leg.toXZ[0]-leg.fromXZ[0])*i/n,leg.fromXZ[1]+(leg.toXZ[1]-leg.fromXZ[1])*i/n)){required[cindex].offMask.push(leg);break;}
 }
 reports.push({label,scope:'Exact compiled literal XY/node/direction/source-access graph, native Navigator. This is an offline topology/mask check, not native World grade/mesh/static/driving acceptance. No virtual edges are created; reconstructed graph omits World structural elevation/SCC filtering.',edges:edges.length,publicEdges:pub.length,doinaLegs:doina.length,routable:routes.filter(r=>r.route).length,required,routes});
}
fs.writeFileSync('/workspace/reality-pass/groz-lukoil-nav/compiled-route-check.json',JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(({routes,...r})=>r),null,2));
