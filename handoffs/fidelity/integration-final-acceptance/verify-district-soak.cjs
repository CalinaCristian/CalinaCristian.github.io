// Strict integrity gate for an explicitly identified district physical900/high-mirror/night source.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'proof/soak-c78a5f4'));
const file=path.join(dir,'profile.json'),raw=JSON.parse(fs.existsSync(file)?fs.readFileSync(file,'utf8'):zlib.gunzipSync(fs.readFileSync(path.join(dir,'profile.json.gz'))));
const source=JSON.parse(fs.readFileSync(path.join(dir,'source-manifest.json'),'utf8'));
const expectedCommit=process.argv[3]||'c78a5f4c522723fb2f4e640999e3ac5d164fc724';assert.match(expectedCommit,/^[a-f0-9]{40}$/);assert.equal(source.commit,expectedCommit);
assert.equal(raw.complete,true);assert.equal(raw.fatal,undefined);assert.equal(raw.terminalIncomplete,undefined);
assert.deepEqual(raw.errors,[]);assert.deepEqual(raw.consoleErrors,[]);assert.deepEqual(raw.failures,[]);
assert.equal(raw.runnerSha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'runner.cjs'))).digest('hex'));
for(const[file,sha]of Object.entries(raw.source))assert.equal(sha,source.files[file],file+' source hash');
assert.equal(raw.samples.length,16);assert.deepEqual(raw.samples.map(s=>s.minute),Array.from({length:16},(_,i)=>i));
assert.ok(Math.abs(raw.samples.at(-1).physicalSimSeconds-900)<1e-6);
const native=raw.populationPreparation.final;assert.deepEqual(native.counts,{moving:618,parked:9,active:631,pool:0});assert.deepEqual(native.target,{moving:618,parked:9});assert.equal(native.maxVehicles,480);assert.equal(new Set(native.activeIds).size,631);
assert.ok(raw.warmFrames.length);assert.equal(raw.warmFrames.at(-1).pending,false);assert.equal(raw.warmFrames.at(-1).fade,1);
assert.deepEqual(raw.refreshes.map(r=>r.trigger),['night-rain']);
for(const r of raw.refreshes){assert.ok(r.frames.length>=30);assert.equal(r.frames[0].pending,true);assert.equal(r.frames.at(-1).pending,false);assert.equal(r.frames.at(-1).fade,1);}
const frames=[...raw.warmFrames,...raw.samples.flatMap(s=>s.frames),...raw.refreshes.flatMap(r=>r.frames),raw.finalFrame];
for(const f of frames){
 assert.equal(f.population.people,560);assert.equal(f.population.vehicles,631);assert.ok(f.population.originalPeople&&f.population.originalVehicles);
 assert.equal(f.stats.quality,'high');assert.equal(f.stats.auto,false);assert.equal(f.stats.pixelRatio,1);assert.equal(f.stats.shadows,4096);assert.equal(f.stats.post,'full');
 assert.ok(f.draws.some(d=>d.pass==='mirror'));assert.ok(f.logical.calls<=400&&f.logical.triangles<=1500000);
 assert.equal(f.stats.drawCalls,f.before.calls+f.logical.calls);assert.equal(f.stats.triangles,f.before.triangles+f.logical.triangles);
}
const physicalEnd=raw.lifecycle.find(e=>e.phase==='physical900-persisted-before-evolved-night-rain');assert.ok(physicalEnd);const physicalWallSeconds=(physicalEnd.at-raw.wallStart)/1000;assert.ok(physicalWallSeconds>=900,'physical run wall duration below900s');
const people=raw.samples[0].people.map(p=>p.id).sort((a,b)=>a-b);assert.equal(new Set(people).size,560);
for(const s of raw.samples){assert.deepEqual(s.people.map(p=>p.id).sort((a,b)=>a-b),people);assert.equal(s.people.length,560);assert.deepEqual(s.visibleSnaps,[]);assert.deepEqual(s.stalledRecoveries,[]);}
assert.ok(Array.isArray(raw.relocations));assert.ok(raw.relocations.every(r=>r.distance<=.4||(!r.from.visible&&!r.to.visible)));
assert.equal(raw.finalFrame.pending,false);assert.equal(raw.finalFrame.fade,1);assert.equal(raw.finalFrame.conditions.override,'night');assert.equal(raw.finalFrame.conditions.weather,'rain');assert.ok(raw.finalFrame.conditions.nightLights);assert.ok(raw.finalFrame.conditions.sunElevation<0);
for(const label of ['minute-0','minute-5','minute-10','minute-15','evolved-final']){const c=raw.captures.find(c=>c.label===label);assert.ok(c,'missing capture '+label);assert.ok(fs.statSync(path.join(dir,c.file)).size>0,'empty capture '+label);}
for(const phase of ['physical900-persisted-before-evolved-night-rain','evolved-night-rain-publication-and-fade-persisted','terminal-relocations-persisted','terminal-frame-and-capture-persisted','complete'])assert.ok(raw.lifecycle.some(e=>e.phase===phase),'missing lifecycle '+phase);
console.log(JSON.stringify({sourceCommit:source.commit,sourceRunComplete:true,physicalSeconds:raw.samples.at(-1).physicalSimSeconds,physicalWallSeconds,people:560,vehicles:631,frames:frames.length,maxCalls:Math.max(...frames.map(f=>f.logical.calls)),maxTriangles:Math.max(...frames.map(f=>f.logical.triangles)),nightRainFrames:raw.refreshes[0].frames.length,relocationAuditComplete:true,captures:raw.captures.length,scope:'Exact district source physical900 plus high/full-mirror and combined night/rain. Later tourist runtime/release compatibility and final phone/load/headlight/telemetry gates remain separate.'}));
