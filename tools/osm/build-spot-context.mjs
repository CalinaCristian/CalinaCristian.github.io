#!/usr/bin/env node
// Compact literal OSM context. No road graph, actor placement or image input.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFiles } from './parse-osm.mjs';
import { assembleRings } from './geom.mjs';
const args={};for(let i=2;i<process.argv.length;i++){const v=process.argv[i];if(!v.startsWith('--'))continue;const at=v.indexOf('=');if(at>=0)args[v.slice(2,at)]=v.slice(at+1);else args[v.slice(2)]=process.argv[++i];}
if(!args.tiles||!args.terrain||!args.ledger||!args.out||!args.bbox||!args.frame)throw Error('--tiles --terrain --ledger --bbox --frame --out required');
const coverage=args.bbox.split(',').map(Number);if(coverage.length!==4||!coverage.every(Number.isFinite)||coverage[0]>=coverage[2]||coverage[1]>=coverage[3])throw Error('Invalid source coverage');
const frameBytes=fs.readFileSync(args.frame),frame=JSON.parse(frameBytes);
const files=fs.readdirSync(args.tiles).filter(f=>/\.(osm|xml)$/.test(f)).sort().map(f=>path.join(args.tiles,f));
const raw=parseFiles(files),tags=[],tagMap=new Map(),usedNodes=new Set(),unresolved=[];
const positive=t=>t!=null&&!['no','false','0',''].includes(String(t).toLowerCase());
const tagIndex=t=>{const o=Object.fromEntries(Object.entries(t).sort(([a],[b])=>a.localeCompare(b))),key=JSON.stringify(o);if(!tagMap.has(key)){tagMap.set(key,tags.length);tags.push(o);}return tagMap.get(key);};
const retain=nodes=>{for(const id of nodes)usedNodes.add(id);return nodes;};
const complete=(id,nodes)=>{const missing=nodes.filter(n=>!raw.nodes.has(n));if(missing.length){unresolved.push({id,reason:'missing-source-nodes',missing});return false;}return true;};
const buildings=[],ways=[],areas=[],trees=[],coastlines=[],relations=[];
const area=t=>positive(t.landuse)||positive(t.leisure)||positive(t.water)||t.natural==='water'||t.natural==='wood'||t.natural==='scrub'||t.natural==='beach'||['pier','breakwater','quay','bridge'].includes(t.man_made)||t['area:highway']||t.place==='square'||t.highway==='pedestrian'&&t.area==='yes';
for(const[id,w]of raw.ways){
 const t=w.tags,closed=w.nodes.length>3&&w.nodes[0]===w.nodes.at(-1),source='w'+id;
 if(!complete(source,w.nodes))continue;
 if(positive(t.building)||positive(t['building:part'])){
  if(!closed){unresolved.push({id:source,reason:'open-source-building-way',nodeIds:w.nodes});continue;}
  buildings.push({id:source,n:retain(w.nodes),t:tagIndex(t)});
 }
 if(t.highway)ways.push({id:source,n:retain(w.nodes),t:tagIndex(t)});
 if(closed&&area(t))areas.push({id:source,n:retain(w.nodes),t:tagIndex(t)});
 if(t.natural==='coastline')coastlines.push({id:source,n:retain(w.nodes),t:tagIndex(t)});
}
for(const[id,r]of raw.rels){
 const t=r.tags,building=positive(t.building)||positive(t['building:part']);
 if(t.type!=='multipolygon'||!(building||area(t)))continue;
 const source='r'+id,memberWays=r.members.filter(m=>m.type==='way'),missing=memberWays.filter(m=>!raw.ways.has(m.ref));
 relations.push({id:source,t:tagIndex(t),members:r.members.map(m=>[m.type,m.ref,m.role])});
 if(missing.length){unresolved.push({id:source,reason:'missing-source-relation-ways',members:missing});continue;}
 const outer=assembleRings(memberWays.filter(m=>m.role!=='inner').map(m=>raw.ways.get(m.ref).nodes));
 const inner=assembleRings(memberWays.filter(m=>m.role==='inner').map(m=>raw.ways.get(m.ref).nodes));
 if(outer.open.length||inner.open.length||!outer.rings.length){unresolved.push({id:source,reason:'open-source-relation-rings',outerOpen:outer.open,innerOpen:inner.open});continue;}
 if(![...outer.rings,...inner.rings].every(n=>complete(source,n)))continue;
 for(let i=0;i<outer.rings.length;i++){
  const n=outer.rings[i],poly=n.map(id=>raw.nodes.get(id));
  const inside=p=>{let c=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const A=poly[a],B=poly[b];if((A[1]>p[1])!==(B[1]>p[1])&&p[0]<(B[0]-A[0])*(p[1]-A[1])/(B[1]-A[1])+A[0])c=!c;}return c;};
  const holes=inner.rings.filter(h=>inside(raw.nodes.get(h[0])));
  const record={id:outer.rings.length===1?source:source+':outer'+i,sourceId:source,n:retain(n),holes:holes.map(retain),t:tagIndex(t)};
  (building?buildings:areas).push(record);
 }
}
for(const[id,t]of raw.ntags)if(t.natural==='tree'&&raw.nodes.has(id))trees.push({id:'n'+id,n:retain([id])[0],t:tagIndex(t)});
const ordered=[...usedNodes].sort((a,b)=>a-b),index=new Map(ordered.map((id,i)=>[id,i]));
const nodes=ordered.flatMap(id=>{const p=raw.nodes.get(id);return[id,Math.round(p[0]*1e7),Math.round(p[1]*1e7)];});
for(const records of[buildings,ways,areas,coastlines])for(const r of records){r.n=r.n.map(n=>index.get(n));if(r.holes)r.holes=r.holes.map(h=>h.map(n=>index.get(n)));}
for(const t of trees)t.n=index.get(t.n);
for(const records of[buildings,ways,areas,coastlines,trees,relations])records.sort((a,b)=>a.id.localeCompare(b.id));
const ledger=JSON.parse(fs.readFileSync(args.ledger));
for(const r of ledger){const file=files.find(f=>path.basename(f)===path.basename(r.file));if(file&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==r.sha256)throw Error('raw source changed '+file);}
const result={schemaVersion:1,id:args.id||'seattle-source-context',attribution:'© OpenStreetMap contributors, ODbL1.0; USGS3DEP public-domain numeric elevations',
 sourceCoverage:coverage,
 frame:{origin:frame.origin,projection:frame.projection,sourceFileSHA256:crypto.createHash('sha256').update(frameBytes).digest('hex')},
 sourceLedger:ledger.map(r=>({...r,file:path.basename(r.file)})),
 nodeEncoding:'flat [originalOSMnodeID,latitudeE7,longitudeE7]; geometry n/holes reference node indices; original closed node order retained',
 tagEncoding:'t references exact raw source tag dictionary',nodes,tags,buildings,ways,areas,coastlines,trees,relations,
 terrain:JSON.parse(fs.readFileSync(args.terrain)),unresolvedSourceClosure:unresolved,
 estimates:'No heights or grades invented by this extraction. Runtime literal numeric height/levels/roof/minimum tags take priority; absent dimensions remain explicit estimates.'};
fs.writeFileSync(args.out,JSON.stringify(result));
console.log(JSON.stringify({output:args.out,bytes:fs.statSync(args.out).size,nodes:ordered.length,tagDictionaries:tags.length,buildings:buildings.length,ways:ways.length,areas:areas.length,coastlines:coastlines.length,trees:trees.length,relations:relations.length,unresolved:unresolved.length}));
