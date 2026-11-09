// Classify and package native read-only actual torso and spatial-index evidence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {pipeline}=require('node:stream/promises');
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('INPUT_DIRECTORY OUTPUT_DIRECTORY');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
const raw=fs.readFileSync(path.join(input,'report.json')),j=JSON.parse(raw),d=j.districts[0],q=d.peerAttribution; if(!j.complete)throw Error('Incomplete native report');
fs.mkdirSync(output,{recursive:true});for(const s of j.sourceFiles)if(sha(fs.readFileSync(path.join(j.root,s.path)))!==s.sha256)throw Error('Changed source '+s.path);
const series=new Map();let maxProxy=0,maxReal=0,realSteps=0,eligibleSteps=0,unclassified=0,minPeerDistance=Infinity;
for(const s of q.steps){const real=s.pairs.filter(p=>p.actualTorsoSectionPenetrationM>1e-6);maxReal=Math.max(maxReal,real.length);maxProxy=Math.max(maxProxy,s.pairs.filter(p=>p.bodyDiscPenetrationM>1e-6).length);unclassified+=s.pairs.filter(p=>p.actualTorsoSectionPenetrationM==null).length;
 for(const p of s.pairs)minPeerDistance=Math.min(minPeerDistance,p.distance);
 for(const p of real){realSteps++;if(p.views.every(v=>v.some(w=>w.eligible)))eligibleSteps++;const key=p.a.id+':'+p.b.id;let r=series.get(key);if(!r)series.set(key,r={ids:[p.a.id,p.b.id],frames:[],peak:0,sample:null});r.frames.push({frame:s.frame,time:s.time,scenarioTime:s.scenarioTime});if(p.actualTorsoSectionPenetrationM>r.peak){r.peak=p.actualTorsoSectionPenetrationM;r.sample=p;}}
}
const longest=[...series.values()].map(r=>{let best=[],cur=[];for(const f of r.frames){if(cur.length&&f.frame!==cur.at(-1).frame+1){if(cur.length>best.length)best=cur;cur=[];}cur.push(f);}if(cur.length>best.length)best=cur;return{ids:r.ids,allContactSteps:r.frames.length,longestContinuousSteps:best.length,longestPhysicalSeconds:best.length/30,first:best[0],last:best.at(-1),peakTorsoPenetrationM:r.peak,actualModelSample:r.sample};}).sort((a,b)=>b.longestPhysicalSeconds-a.longestPhysicalSeconds);
const misses=q.separations.flatMap(s=>s.misses.map(m=>({...m,frame:s.frame,time:s.time}))),at=new Map(q.steps.map(s=>[s.frame,s]));
const realMiss=misses.filter(m=>at.get(m.frame)?.pairs.some(p=>p.a.id===m.a.id&&p.b.id===m.b.id&&p.actualTorsoSectionPenetrationM>1e-6));
const sum={sourceCommit:j.sourceCommit,startedAt:j.startedAt,endedAt:j.endedAt,rawSha256:sha(raw),complete:j.complete,sourceFilesChecked:j.sourceFiles.length,errors:j.errors,consoleErrors:j.consoleErrors,failedRequests:j.failedRequests,originalFailures:j.failures,
 population:d.initialPopulation,constructorVehicleGate:d.initialVehicleGate??null,
 coverage:{constructorVehicleBodiesRecorded:!!d.initialVehicleGate,warmupFindingsRecorded:d.cases.every(c=>!!c.warmup),note:'Older reports without warmup findings cover only their saved drive intervals; original raw files are retained unchanged.'},
 drives:d.cases.flatMap(c=>c.drives.map(r=>({condition:c.condition,phase:r.phase,result:r.drive,contacts:r.contacts,warmup:c.warmup??null,issues:r.issues}))),
 peer:{physicalSamples:q.steps.length,separationChecks:q.separations.length,actualCrowdDrawSubmissions:q.renders.length,maxXYBodyProxyPairs:maxProxy,maxDefiniteStaticTorsoPairs:maxReal,definiteTorsoPairSteps:realSteps,distinctDefiniteTorsoPairs:series.size,unclassifiedPairSteps:unclassified,minimumPeerDistanceM:Number.isFinite(minPeerDistance)?minPeerDistance:null,hashOmissions:misses.length,hashOmissionsWithSameFrameDefiniteBodyContact:realMiss.length,
       bothRecordedCameraEligiblePairSteps:eligibleSteps,visibilityNote:'Frustum/distance eligibility is retained separately from actual render submissions and does not establish unoccluded pixel visibility. Mirror matrices between explicit renders are the recorded native matrices, not a changed camera.',
       geometryMethod:'Actual crowd.set feet/heading/scale/pose and TOP/aLimb0 triangles, intersected at a common native world-height torso plane. TOP is always drawn, including inside a coat; the near torso is contained by the far torso box. This proves positive body intersections for active pose0 walkers; a negative torso plane alone is not a claim about every articulated limb or prop.',
       longestContacts:longest.slice(0,12),firstActualHashOmission:realMiss[0]??null},
 captures:d.cases.flatMap(c=>c.captures.map(x=>({file:x.file,sha256:x.sha256,label:x.label}))),observerFiles:j.observerFiles};
fs.writeFileSync(path.join(output,'classification.json'),JSON.stringify(sum,null,2)+'\n');
await pipeline(fs.createReadStream(path.join(input,'report.json')),zlib.createGzip({level:9}),fs.createWriteStream(path.join(output,'report.json.gz')));
for(const e of j.observerFiles){const pinned=path.join(input,'observer-files',e.file),file=fs.existsSync(pinned)?pinned:path.join(__dirname,e.file),b=fs.readFileSync(file);if(sha(b)!==e.sha256)throw Error('Changed executed observer '+e.file);fs.writeFileSync(path.join(output,e.file),b);}
for(const c of sum.captures){const b=fs.readFileSync(path.join(input,c.file));if(sha(b)!==c.sha256)throw Error('Changed capture '+c.file);fs.writeFileSync(path.join(output,c.file),b);}
fs.copyFileSync(input+'.log',path.join(output,'execution.log'));
const artifacts=fs.readdirSync(output).filter(x=>x!=='manifest.json').sort().map(file=>{const b=fs.readFileSync(path.join(output,file));return{file,bytes:b.length,sha256:sha(b)};});
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({sourceCommit:j.sourceCommit,rawSha256:sha(raw),artifacts},null,2)+'\n');
console.log(JSON.stringify({source:j.sourceCommit,rawSha256:sha(raw),peer:{samples:q.steps.length,trueTorsoPairSteps:realSteps,maxTrueTorsoPairs:maxReal,minimumPeerDistance:sum.peer.minimumPeerDistanceM,hashOmissions:misses.length},sourceFilesChecked:j.sourceFiles.length,compressedBytes:fs.statSync(path.join(output,'report.json.gz')).size}));
})().catch(e=>{console.error(e);process.exitCode=1;});
