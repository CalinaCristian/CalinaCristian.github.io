import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseFiles } from '../../../../tools/osm/parse-osm.mjs';
import { resolveRoadAccess } from '../../../../game/src/road-access.js';
const nativePath=process.argv[2]||'/workspace/integration-qa-evidence/basarab-shared-b006000f-native/native-world.json.gz';
const tilesPath=process.argv[3]||'/workspace/reality-pass/grozavesti/tiles';
const outputPath=process.argv[4]||'/tmp/basarab-source-domain-audit.json';
const nativeBytes=fs.readFileSync(nativePath), n=JSON.parse(zlib.gunzipSync(nativeBytes));
if(!n.data&&n.dataSourceCommit){const bytes=execFileSync('git',['show',n.dataSourceCommit+':game/data/bucharest-grozavesti.json'],{maxBuffer:32*1024*1024});if(createHash('sha256').update(bytes).digest('hex')!==n.dataSha256)throw Error('Frozen native data source differs');n.data=JSON.parse(bytes);}
const files=fs.readdirSync(tilesPath).filter(f=>f.endsWith('.xml')).sort().map(f=>path.join(tilesPath,f));
const raw=parseFiles(files), p=n.data.proj;
const pos=new Map([...raw.nodes].map(([id,[lat,lon]])=>[id,[(lon-p.lon0)*p.mPerLon*p.scale,(p.lat0-lat)*p.mPerLat*p.scale]]));
const classes=new Set(n.data.classes), roads=new Map(), adj=new Map();
const add=e=>{if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e)};
for(const [id,w] of raw.ways){
 const t=w.tags||{}, access=resolveRoadAccess(t);if(!classes.has(t.highway)||t.area==='yes'||!access.publicDrive||!access.throughAccess||w.nodes.some(id=>!pos.has(id)))continue;
 const oneway=['yes','true','1','-1'].includes(t.oneway)||(['roundabout','circular'].includes(t.junction)&&t.oneway!=='no')||(['motorway','motorway_link'].includes(t.highway)&&t.oneway!=='no');
 const nodes=t.oneway==='-1'?[...w.nodes].reverse():w.nodes;roads.set(id,{...w,oneway,access});
 for(let i=1;i<nodes.length;i++){const from=nodes[i-1],to=nodes[i],a=pos.get(from),b=pos.get(to),lengthM=Math.hypot(b[0]-a[0],b[1]-a[1]);add({sourceId:'w'+id,from,to,lengthM});if(!oneway)add({sourceId:'w'+id,from:to,to:from,lengthM})}
}
const restrictions=[];
for(const [id,r] of raw.rels){if(r.tags?.type!=='restriction')continue;const f=r.members.filter(m=>m.role==='from'),t=r.members.filter(m=>m.role==='to'),v=r.members.filter(m=>m.role==='via');if(f.length===1&&t.length===1&&v.length===1&&v[0].type==='node')restrictions.push({sourceId:'r'+id,from:'w'+f[0].ref,to:'w'+t[0].ref,via:v[0].ref,value:r.tags.restriction,tags:r.tags});}
const allowed=(last,e)=>!restrictions.some(r=>r.via===e.from&&r.from===last&&(r.value?.startsWith('only_')?e.sourceId!==r.to:r.value?.startsWith('no_')?e.sourceId===r.to:true));
function route(start,goal){
 const starts=Array.isArray(start)?start:[start],goals=new Set(Array.isArray(goal)?goal:[goal]); const queue=starts.map(s=>[0,s,'',null,null]),best=new Map(),done=new Set();
 while(queue.length){queue.sort((a,b)=>b[0]-a[0]);const [cost,u,last,prior,previous]=queue.pop(),key=u+'/'+last+'/'+previous;if(done.has(key))continue;done.add(key);best.set(key,{cost,prior});if(goals.has(u)){let k=key,legs=[];while(best.get(k).prior){const h=best.get(k).prior;legs.push(h.leg);k=h.key}legs.reverse();return {found:true,lengthM:cost,legs};}for(const e of adj.get(u)||[]){if(e.to===previous||!allowed(last,e))continue;const next=e.to+'/'+e.sourceId+'/'+u;if(done.has(next))continue;queue.push([cost+e.lengthM,e.to,e.sourceId,{key,leg:e},u]);}}
 return {found:false};
}
const ids=['w139758829','w84483724','w458458361','w668676694','w668676695','w668676696','w668676697','w84482671'];
const graph=new Set(n.graphEdgeIds), summaries=ids.map(sourceId=>{const es=n.allEdges.filter(e=>e.access?.sourceId===sourceId);return{sourceId,count:es.length,routable:es.filter(e=>graph.has(e.id)).length,coreRoads:[...new Set(es.map(e=>e.road))],source:raw.ways.get(+sourceId.slice(1)),prepared:Object.entries(n.data.roadSourceGeometry).filter(([i,s])=>s.sourceId===sourceId).map(([i,s])=>({index:+i,nodeIds:s.preparedNodeIds}))}});
const main=[...new Set(n.allEdges.filter(e=>e.drivable===true).flatMap(e=>[e.a.sourceId,e.b.sourceId]).filter(id=>Number.isSafeInteger(id)&&id>0))];
const paths=Object.fromEntries([['approach-to-outer',981567012,6261926624],['outer-to-south-bridge',6261926624,4544537057],['south-bridge-to-approach',4544537057,981567012],['approach-to-north-bridge-end',981567012,984551993],['main-to-south-bridge',main,4544537057],['south-bridge-to-main',4544537057,main],['main-to-outer',main,6261926624],['outer-to-main',6261926624,main],['main-to-bridge-fork',main,981547574],['bridge-fork-to-main',981547574,main],['reverse-ramp-end-to-main',2624398781,main],['main-to-reverse-ramp-end',main,2624398781]].map(([id,a,b])=>[id,route(a,b)]));
const geometry=n.data.district.geometry;
const pointSeg=(x,z,a,b)=>{let dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)};
function margin([x,z]){let m=Infinity;for(const pl of geometry.pieces)for(let i=1;i<pl.pts.length;i++)m=Math.min(m,pointSeg(x,z,pl.pts[i-1],pl.pts[i])-pl.r);for(const c of geometry.circles)m=Math.min(m,Math.hypot(x-c.x,z-c.z)-c.r);return m}
for(const r of Object.values(paths))if(r.found){r.wayRuns=[];let peak=0;for(const l of r.legs){if(r.wayRuns.at(-1)?.sourceId!==l.sourceId)r.wayRuns.push({sourceId:l.sourceId,from:l.from,to:l.to,lengthM:l.lengthM});else{const h=r.wayRuns.at(-1);h.to=l.to;h.lengthM+=l.lengthM}const a=pos.get(l.from),b=pos.get(l.to),steps=Math.ceil(l.lengthM);for(let i=0;i<=steps;i++)peak=Math.max(peak,margin([a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps]));}r.maxExcursionOutsideCurrentCoreM=peak;r.touchingRestrictions=restrictions.filter(t=>r.legs.some(l=>l.sourceId===t.from&&l.to===t.via));}
const sha=b=>createHash('sha256').update(b).digest('hex');
const out={schema:1,scope:'Read-only literal source/domain diagnosis and proposal. Search excludes immediate reversals and checks public through access/simple node restrictions. The actual compiler must validate all touching restrictions and turn lanes before any proposal is accepted; whole-body/native gates remain separate.',nativeSourceSha:'b006000f7bae6e6c64103b9548438082026c14eb',nativeFileSha256:sha(nativeBytes),tiles:files.map(f=>({file:path.basename(f),sha256:sha(fs.readFileSync(f))})),counts:{nodes:raw.nodes.size,ways:raw.ways.size,publicThroughRoads:roads.size},summaries,paths};
fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');for(const [id,r]of Object.entries(paths))console.log(id,JSON.stringify({found:r.found,lengthM:r.lengthM,maxExcursion:r.maxExcursionOutsideCurrentCoreM,ways:r.wayRuns,restrictions:r.touchingRestrictions}));console.log('wrote',outputPath);
