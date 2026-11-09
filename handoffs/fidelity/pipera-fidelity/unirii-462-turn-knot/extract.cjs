// Read-only reduction of the retained native run. Does not start a browser.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const [raw,root,out]=process.argv.slice(2);
if(!raw||!root||!out)throw Error('Usage: node extract.cjs REPORT SOURCE_ROOT NEW_OUTPUT');
if(fs.existsSync(out))throw Error('Output must be new');
const bytes=fs.readFileSync(raw),d=JSON.parse(bytes),source='46211271218d6d6b170cb821ec11518ed47a9213';
if(d.sourceCommit!==source||!d.complete||!d.browserClosed)throw Error('Wrong or incomplete run');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const target=v=>v&&[2,423].includes(v.id),edges=new Map();
for(const s of d.observation.samples)for(const v of [...s.nearVehicles,s.vehicle87].filter(Boolean)){
 edges.set(v.edge.id,v.edge);for(const r of v.route||[])edges.set(r.edge.id,r.edge);
}
for(const s of d.observation.vehicleSteps)for(const v of [s.before,s.after]){
 edges.set(v.edge.id,v.edge);for(const r of v.route||[])edges.set(r.edge.id,r.edge);
}
const worldData=JSON.parse(fs.readFileSync(path.join(root,'game/data/bucharest-unirii.json')));
const fixture={sourceCommit:source,raw:{bytes:bytes.length,sha256:sha(bytes)},
 scope:'Exact retained 462 target states/steps/contacts and recorded graph slice; no simulation or live mutation.',
 firstPublication:Object.fromEntries(['preAdmission','publicResolved','actualFirstWorld'].map(k=>[k,{actors:d.firstPublication[k].actors,player:d.firstPublication[k].player}])),
 observation:{samples:d.observation.samples.map(s=>({...s,nearVehicles:s.nearVehicles.filter(target),nearPedestrians:undefined,vehicle87:undefined,leaderChain:undefined,caller:undefined,controls:undefined})),
 vehicleSteps:d.observation.vehicleSteps.filter(s=>s.before.id===2),preResets:d.observation.preResets.map(s=>({reason:s.reason,frame:{label:s.frame.label,player:s.frame.player,bodies:s.frame.bodies}}))},
 globalPhysical:d.globalPhysical.map(f=>({trafficTime:f.trafficTime,trafficFrame:f.trafficFrame,vehicleBodyContacts:f.vehicleBodyContacts.filter(c=>[c.a.id,c.b.id].includes(2)&&[c.a.id,c.b.id].includes(423))})),
 recordedEdges:[...edges.values()],
 worldData:{roads:worldData.roads,roadNodeIds:worldData.roadNodeIds,roadWidths:worldData.roadWidths,roadSourceGeometry:Object.fromEntries(Object.entries(worldData.roadSourceGeometry).map(([i,g])=>[i,{sourceId:g.sourceId,tags:g.tags,nodeIds:g.nodeIds,preparedNodeIds:g.preparedNodeIds}])),turnLanes:worldData.turnLanes,strings:worldData.strings},
 sourceFiles:[]};
fs.mkdirSync(out,{recursive:true});
for(const f of ['game/src/traffic.js','game/src/nav.js','game/src/util.js','game/src/world.js','game/data/bucharest-unirii.json']){
 const b=fs.readFileSync(path.join(root,f));fixture.sourceFiles.push({path:f,bytes:b.length,sha256:sha(b)});
 if(['traffic.js','nav.js','util.js'].includes(path.basename(f)))fs.writeFileSync(path.join(out,path.basename(f)+'.gz'),zlib.gzipSync(b,{level:9}));
}
fs.writeFileSync(path.join(out,'fixture.json.gz'),zlib.gzipSync(Buffer.from(JSON.stringify(fixture)),{level:9}));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({sourceCommit:source,raw:fixture.raw,scope:fixture.scope,sourceFiles:fixture.sourceFiles,files:fs.readdirSync(out).map(f=>{const b=fs.readFileSync(path.join(out,f));return{file:f,bytes:b.length,sha256:sha(b)};})},null,2)+'\n');
console.log(JSON.stringify({out,raw:fixture.raw,targetSteps:fixture.observation.vehicleSteps.length,pairFrames:fixture.globalPhysical.filter(f=>f.vehicleBodyContacts.length).length}));
