import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2] || '/workspace/integration-qa-evidence/all8-4378317');
const out=path.resolve(process.argv[3] || '/workspace/integration-qa-evidence/bridge-classify');
const nativeRoot=path.resolve(process.argv[4] || '/workspace/reality-pass/original-districts-refresh/geometry-bf32/native-bridges');fs.mkdirSync(out,{recursive:true});
let source=fs.readFileSync(root+'/game/src/world.js','utf8');const tail=source.slice(source.indexOf('    function isPadNode(n)'),source.indexOf('    const widthAsphalt'));const helpers=tail.replace(/^    for \(const n of nodeArr\).*$/m,'');source=source.slice(0,source.indexOf('    // ---- traffic lights:'))+helpers+'    return {data,edges,nodeArr};\n}\n';
source=source.replace(/from '(\.[^']+)'/g,(_,p)=>`from '${new URL(p,pathToFileURL(root+'/game/src/world.js')).href}'`);
const {CITIES}=await import(pathToFileURL(root+'/game/src/cities.js'));
for(const key of ['bucharest-pipera','seattle-bellevue']){
 const [city,dist]=key.split('-');let local=source.replace(/^    const url = new URL.*$/m,'    const url = '+JSON.stringify(pathToFileURL(root+'/game/data/'+key+'.json').href)+';');
 const originalFetch=globalThis.fetch;globalThis.fetch=async u=>({json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(u),'utf8'))});
 const {buildWorld}=await import('data:text/javascript;base64,'+Buffer.from(local).toString('base64')+'#cpu-world-grade');const w=await buildWorld({...CITIES[city]},null,{district:dist});globalThis.fetch=originalFetch;
 const core=w.edges.filter(e=>!e.virtual).map(e=>({road:e.road,sourceId:w.data.roadSourceGeometry?.[e.road]?.sourceId,a:[e.a.x,e.a.z,e.ya],b:[e.b.x,e.b.z,e.yb],wL:e.wL,wR:e.wR,access:e.access}));
 const sha=crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');const native=JSON.parse(fs.readFileSync(path.join(nativeRoot,key+'.json')));
 const {scenerySourceProfile}=await import(pathToFileURL(root+'/game/src/scenery-source.js'));let ss=fs.readFileSync(root+'/game/src/scenery-bridges.js','utf8');ss=ss.replace('    return { profiles: output, stats };','    return { profiles: output, stats, debug: { graphNodes, targets, caps, high, low } };');
 const {sceneryBridgeProfiles}=await import('data:text/javascript;base64,'+Buffer.from(ss).toString('base64'));
 const undelta=r=>{let x=0,z=0;const p=[];for(let i=4;i<r.length;i+=2){x+=r[i];z+=r[i+1];p.push([x/10,z/10])}return p};
 const prof=w.data.scenery.map((r,i)=>scenerySourceProfile(w.data,i,undelta(r)));const p=sceneryBridgeProfiles(w.data,prof,w.edges),d=p.debug;
 const unresolved=p.stats.unresolved.map(u=>{
  let n=d.graphNodes.find(n=>Math.hypot(n.p[0]-u.x,n.p[1]-u.z)<1e-5),v=n,trace=[],seen=new Set();
  while(v&&!seen.has(v)){seen.add(v);trace.push({xy:v.p,nodeId:v.sourceNode,coreY:v.coreY,cap:d.caps.get(v),high:d.high.get(v),target:d.targets.get(v),ways:v.links.map(e=>({id:e.piece.source.sourceId,eligible:e.eligible,bridge:e.piece.bridge,name:e.piece.tags.name,type:e.piece.type}))});if(d.caps.has(v))break;const curr=d.high.get(v);v=v.adj.map(e=>({n:e.a===v?e.b:e.a,cost:e.cost})).find(q=>Math.abs(d.high.get(q.n)+q.cost-curr)<1e-6)?.n;}
  const lower=[];for(const e of w.edges.filter(e=>!e.virtual&&w.data.roadSourceGeometry?.[e.road]?.sourceId===u.lowerSourceId)){const t=((u.x-e.a.x)*e.dirx+(u.z-e.a.z)*e.dirz)/e.len;const x=e.a.x+(e.b.x-e.a.x)*t,z=e.a.z+(e.b.z-e.a.z)*t;if(t>=-1e-6&&t<=1+1e-6&&Math.hypot(x-u.x,z-u.z)<1e-5)lower.push({kind:'core',y:.24+e.ya+(e.yb-e.ya)*t});}
  for(const q of p.profiles.values())if(q.sourceId===u.lowerSourceId)for(let i=1;i<q.points.length;i++){const a=q.points[i-1],b=q.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=((u.x-a[0])*dx+(u.z-a[1])*dz)/(dx*dx+dz*dz);if(t>=-1e-6&&t<=1+1e-6&&Math.hypot(a[0]+dx*t-u.x,a[1]+dz*t-u.z)<1e-5)lower.push({kind:'profile',y:.24+q.heights[i-1]+(q.heights[i]-q.heights[i-1])*t});}
  if(!lower.length)lower.push({kind:'unchanged scenery',y:.20});
  return {...u,actualUpperUndersideM:.24+u.actualDisplacementM-.4,lowerCandidates:lower,clearanceCandidates:lower.map(l=>.24+u.actualDisplacementM-.4-l.y),trace};
 });
 const record={key,source:'4378317',method:'Exact production world.js prefix through final core grade; no renderer/material/world geometry construction. CPU core rows checked against previously saved native hash.',coreSha:sha,nativeSha:native.coreSha256,coreHashMatchesNative:sha===native.coreSha256,recomputedStatsMatchNative:JSON.stringify(p.stats)===JSON.stringify(native.stats),unresolved};fs.writeFileSync(path.join(out,key+'.json'),JSON.stringify(record,null,2));console.log(key,sha===native.coreSha256,record.recomputedStatsMatchNative,unresolved.map(u=>({upper:u.sourceId,lower:u.lowerSourceId,clearance:u.clearanceCandidates,trace:u.trace.at(-1)})));
}
