// CPU component parity/timing, not renderer or hardware FPS acceptance.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Pedestrians} from '../game/src/traffic.js';
import {relocationPeerQuery} from '../game/src/pedestrian-relocation-peers.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../handoffs/fidelity/pedestrian-relocation-performance/native-position-fixture.json.gz',import.meta.url))));
const edges=fixture.edges,people=fixture.people.map(p=>({...p}));
// Explicit benchmark-only incoming reservations and carried-body radii.
for(let i=9;i<people.length;i+=19){people[i].state='legs';people[i].next={e:edges[i%edges.length],side:i%2?1:-1};}
const c=Object.create(Pedestrians.prototype);c.list=people;c.crowd={reach:i=>.3+(i%4)*.03};
c.walkSpace=e=>({lo:0,hi:e.len,w:3,sw:3});
const queries=edges.filter(e=>e.len>4&&e.len<160).filter((e,i)=>i%3===0);
const targets=people.filter((p,i)=>i%56===0),rounds=[];
function run(indexed){
 const start=performance.now();let count=0,clear=0;
 for(const p of targets){
  const q=indexed?relocationPeerQuery(people,p,o=>c.reach(o)):null;
  for(const e of queries)for(const side of[-1,1])count+=c.spaceLoad(e,side,p,q);
  for(let j=0;j<50;j++){
   const e=queries[(j*17)%queries.length],trial={...p,x:e.a.x,z:e.a.z};
   // The indexed peer set excludes original p, as the production candidate
   // does; move that same object temporarily, never a different actor.
   const x=p.x,z=p.z;p.x=trial.x;p.z=trial.z;
   clear+=c.freePersonalSpace(p,q)?1:0;p.x=x;p.z=z;
  }
 }
 return{ms:performance.now()-start,count,clear};
}
for(let i=0;i<5;i++){const baseline=run(false),indexed=run(true);if(baseline.count!==indexed.count||baseline.clear!==indexed.clear)throw Error('Full population parity failed');rounds.push({baseline,indexed});}
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)],base=median(rounds.map(r=>r.baseline.ms)),next=median(rounds.map(r=>r.indexed.ms));
const report={scope:fixture.scope,sourceCommit:fixture.sourceCommit,people:people.length,segments:edges.length,queriedSegments:queries.length,relocationTargets:targets.length,rounds,medianBaselineMs:base,medianIndexedMs:next,speedup:base/next,passed:true};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
