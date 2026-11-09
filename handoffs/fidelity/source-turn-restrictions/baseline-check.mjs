import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Navigator, canTravel } from '../../../game/src/nav.js';
const accepted=process.argv[2]||'/workspace/reality-pass/basarab-source-domain/accepted-322ddcc6.json';
const candidate=process.argv[3]||'game/data/bucharest-grozavesti.json';
const output=process.argv[4]||'/tmp/basarab-compiled-domain-check.json';
function graph(data){
 const ends=new Set(data.district.ends),nodes=data.roadNodeIds.map((sourceId,id)=>({id,sourceId,x:data.roadNodePositions[2*id],z:data.roadNodePositions[2*id+1],mapEnd:ends.has(id),edges:[]})),edges=[];
 const seenPair=new Set();
 for(const [road,row]of data.roads.entries())for(let i=11;i<row.length;i++){
  const a=nodes[row[i-1]],b=nodes[row[i]],len=Math.hypot(b.x-a.x,b.z-a.z),access=data.roadAccess[road];
  if(a===b)continue;const key=[a.id,b.id].sort((a,b)=>a-b).join(':');
  if(seenPair.has(key))continue;seenPair.add(key);
  if(len<.05)continue; // Exact production source-builder rule, including forced-cut zero-stub negative.
  const e={id:edges.length,road,a,b,len,dirx:(b.x-a.x)/len,dirz:(b.z-a.z)/len,oneway:!!(row[8]&1),lanesF:row[2],lanesB:row[3],type:data.classes[row[1]],name:data.strings[row[0]],maxspeed:row[7]/3.6,publicDrive:access.publicDrive,throughAccess:access.throughAccess,access,bridge:!!(row[8]&2),tunnel:!!(row[8]&4)};
  e.nx=-e.dirz;e.nz=e.dirx;edges.push(e);a.edges.push(e);b.edges.push(e);
 }
 const out=nodes.map(()=>[]),inn=nodes.map(()=>[]);out.push([]);inn.push([]);const OUT=nodes.length;
 const link=(a,b)=>{out[a].push(b);inn[b].push(a)};
 for(const e of edges){if(e.publicDrive===false)continue;link(e.a.id,e.b.id);if(!e.oneway)link(e.b.id,e.a.id)}
 for(const n of nodes)if(n.mapEnd&&n.edges.some(e=>e.publicDrive!==false)){link(n.id,OUT);link(OUT,n.id)}
 const seen=new Set(),order=[];for(let s=0;s<out.length;s++){if(seen.has(s))continue;let stack=[[s,0]];seen.add(s);while(stack.length){let [u,i]=stack.at(-1);if(i<out[u].length){stack.at(-1)[1]++;let v=out[u][i];if(!seen.has(v)){seen.add(v);stack.push([v,0])}}else{order.push(u);stack.pop()}}}
 const comp=new Map(),sizes=[];for(const s of order.reverse()){if(comp.has(s))continue;let stack=[s],c=sizes.length,size=0;comp.set(s,c);while(stack.length){let u=stack.pop();size++;for(let v of inn[u])if(!comp.has(v)){comp.set(v,c);stack.push(v)}}sizes.push(size)}const main=sizes.indexOf(Math.max(...sizes));for(const e of edges)e.drivable=e.publicDrive!==false&&comp.get(e.a.id)===main&&comp.get(e.b.id)===main;
 const pub=edges.filter(e=>e.drivable),profileExtra=pub.reduce((sum,e)=>sum+((e.bridge||e.tunnel)&&e.len>14?Math.ceil(e.len/10)-1:0),0),liveNodes=nodes.filter(n=>n.edges.some(e=>e.drivable));return {nodes,edges,byId:new Map(nodes.map(n=>[n.sourceId,n])),nav:new Navigator({data,graph:{nodes:liveNodes,edges:pub}}),scc:{components:sizes.length,mainNodes:sizes[main],mainEdges:pub.length,profileMainExtra:profileExtra,nativeProfileMainNodes:sizes[main]+profileExtra,nativeProfileMainEdges:pub.length+profileExtra}};
}
const report={schema:1,scope:'CPU compiled topology and exact public Navigator on source-node graph. SCC matches production algorithm; no virtual connector is ever a driving edge. World structural geometry, actor publication, real body clearance, runtime budgets and driven acceptance remain separate.',datasets:[]};
for(const[label,file]of[['accepted',accepted],['candidate',candidate]]){
 const d=JSON.parse(fs.readFileSync(file)),g=graph(d),m=d.district.mask,bits=[];let bit=0;for(const count of m.rle){for(let i=0;i<count;i++)bits.push(bit);bit^=1}const inside=([x,z])=>{let i=Math.floor((x-m.x0)/m.cell),j=Math.floor((z-m.z0)/m.cell);return i>=0&&j>=0&&i<m.w&&j<m.h&&bits[j*m.w+i]===1};
 const required=d.district.sourceReturns.corridors.map(c=>({id:c.id,legs:c.legs.length,missing:[],offMask:[],maxDomainEnvelopeM:Math.max(...c.legs.map(l=>l.requiredRadiusM))}));
 for(const[ci,c]of d.district.sourceReturns.corridors.entries())for(const leg of c.legs){let matches=g.edges.filter(e=>e.access.sourceId===leg.sourceId&&[1,-1].some(dir=>canTravel(e,dir)&&(dir>0?e.a:e.b).sourceId===leg.from&&(dir>0?e.b:e.a).sourceId===leg.to));if(matches.length!==1)required[ci].missing.push({...leg,matches:matches.length});const len=Math.hypot(leg.toXZ[0]-leg.fromXZ[0],leg.toXZ[1]-leg.fromXZ[1]),steps=Math.ceil(len/.25);for(let i=0;i<=steps;i++)if(!inside(leg.fromXZ.map((v,j)=>v+(leg.toXZ[j]-v)*i/steps))){required[ci].offMask.push(leg);break}}
 const targets=['w458458361','w668676694','w668676697','w84482671','w139758829','w84483724'];
 const sources=targets.map(sourceId=>{const es=g.edges.filter(e=>e.access.sourceId===sourceId);return{sourceId,segments:es.length,drivable:es.filter(e=>e.drivable).length,gate:sourceId==='w84482671'?'HELD: reverse-ramp return corridor is outside this two-corridor change':'reviewed access'}});
 const routes=[];for(const[from,to]of[[981567012,6261926624],[981567012,4544537057],[4544537057,981567012],[981567012,981547574]]){const a=g.byId.get(from),b=g.byId.get(to),r=a&&b?g.nav.compute(a.x,a.z,b.x,b.z):null;routes.push({from,to,found:!!r,metres:r?.total,legs:r?.legs.map(l=>({sourceId:l.e.access.sourceId,from:(l.dir>0?l.e.a:l.e.b).sourceId,to:(l.dir>0?l.e.b:l.e.a).sourceId,dir:l.dir,virtual:!!l.e.virtual}))});}
 const restrictions=d.district.sourceReturns.restrictions;
 for(const r of routes){r.restrictionViolations=[];for(let i=1;i<(r.legs||[]).length;i++){const a=r.legs[i-1],b=r.legs[i];for(const source of restrictions){const via=source.members.filter(m=>m.role==='via'),from=source.members.filter(m=>m.role==='from'),to=source.members.filter(m=>m.role==='to');if(via.length!==1||via[0].type!=='node'||a.to!==via[0].ref||to.length!==1)continue;const kind=source.tags['restriction:motorcar']??source.tags['restriction:motor_vehicle']??source.tags.restriction;if(from.length===1&&a.sourceId!=='w'+from[0].ref)continue;if(from.length===0&&source.reviewValidation?.basis!=='missing-from-universal-known-exit')continue;const same=b.sourceId==='w'+to[0].ref;if(kind?.startsWith('only_')&&!same||kind?.startsWith('no_')&&same&&(kind!=='no_u_turn'||from[0]?.ref!==to[0].ref||b.to===a.from))r.restrictionViolations.push({restriction:source.sourceId,kind,via:via[0].ref,incoming:a,outgoing:b,rawMembers:source.members});}}}
 report.datasets.push({label,file,counts:{nodes:g.nodes.length,edges:g.edges.length},scc:g.scc,sources,required,routes});
 if(label==='candidate')report.topologyPassed=required.every(r=>!r.missing.length&&!r.offMask.length)&&sources.filter(s=>s.sourceId!=='w84482671').every(s=>s.segments&&s.segments===s.drivable)&&routes.every(r=>r.found);
}
report.runtimeRestrictionGatePassed=report.datasets.filter(d=>d.label==='candidate').every(d=>d.routes.every(r=>!r.restrictionViolations.length));
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');assert.ok(report.topologyPassed,'Recorded compiled graph gate failure: '+output);console.log(JSON.stringify(report.datasets.map(({routes,...d})=>({...d,routes:routes.map(({legs,...r})=>r)})),null,2));
