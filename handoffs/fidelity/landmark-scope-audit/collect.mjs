// Read-only audit of a pinned checkout; outputs only within the requested audit directory.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const arg=k=>process.argv.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
const root=path.resolve(arg('root')),out=path.resolve(arg('out'));
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const head=arg('head')||git('rev-parse','HEAD').toString().trim(),base=arg('base')||git('rev-parse','master').toString().trim();
const digest=data=>createHash('sha256').update(data).digest('hex');
const blob=data=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+data.length+'\0'),data])).digest('hex');
const tree=new Map(git('ls-tree','-r',head).toString().trim().split('\n').map(line=>{const [meta,name]=line.split('\t');return[name,meta.split(' ')[2]];}));
const failures=[],commits=new Map();
const existsCommit=sha=>{if(!commits.has(sha)){let okay=/^[0-9a-f]{40}$/.test(sha||'');if(okay)try{git('cat-file','-e',sha+'^{commit}');}catch{okay=false;}commits.set(sha,okay);}return commits.get(sha);};
const bytes=rel=>{const data=fs.readFileSync(path.join(root,rel));if(blob(data)!==tree.get(rel))throw Error('Working tree differs from pinned source: '+rel);return data;};
const records=kind=>[...tree.keys()].filter(name=>name.startsWith('game/overview/evidence/'+kind+'/')&&name.endsWith('.json'));
const seenAssets=new Set();
const asset=(value,expected,label)=>{const rel=path.relative(root,path.resolve(root,'game/overview',value));try{if(rel.startsWith('..'))throw Error('Asset leaves repository');const data=bytes(rel);if(expected&&digest(data)!==expected)throw Error('SHA mismatch');seenAssets.add(rel);return{path:rel,sha256:digest(data),bytes:data.length,passed:true};}catch(e){failures.push({label,path:rel,error:e.message});return{path:rel,passed:false};}};
for(const file of ['game/src/landmarks.js','game/src/cities.js'])bytes(file);
const {LANDMARKS}=await import(pathToFileURL(path.join(root,'game/src/landmarks.js')));
const {CITIES}=await import(pathToFileURL(path.join(root,'game/src/cities.js')));
const sourceModule=async sha=>{const url=pathToFileURL(path.join(root,'game/src/landmarks.js'));const code=git('show',sha+':game/src/landmarks.js').toString().replace(/from '([^']+)'/g,(_,name)=>`from '${new URL(name,url).href}'`);return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));};
const original=await sourceModule(base),captureModules=new Map();
const landmarks=[];
for(const file of records('landmarks')){
 const row=JSON.parse(bytes(file)),lm=LANDMARKS.find(l=>l.id===row.id),old=original.LANDMARKS.find(l=>l.id===row.id);
 if(!lm)throw Error('Record has no current registry entry: '+row.id);
 const valid=existsCommit(row.sourceCommit);if(!valid)failures.push({label:row.id,error:'Invalid record source commit'});
 if(!captureModules.has(row.sourceCommit))captureModules.set(row.sourceCommit,await sourceModule(row.sourceCommit));
 const captured=captureModules.get(row.sourceCommit).LANDMARKS.find(l=>l.id===row.id);
 const captures=(row.captures||[]).map(c=>{if(!existsCommit(c.sourceCommit))failures.push({label:row.id,error:'Invalid current capture source commit'});return{id:c.id||c.kind,sourceCommit:c.sourceCommit,capturedAt:c.capturedAt||null,...asset(c.image,c.sha256,row.id+'/'+(c.id||c.kind))};});
 const districts=Object.entries(CITIES[lm.city].districts||{}).filter(([_,d])=>d.landmarks?.includes(lm.id)).map(([id,d])=>({id,role:lm.backdrop?'backdrop':d.scenery?.includes(lm.id)?'scenery':'district landmark'}));
 landmarks.push({id:lm.id,name:lm.name,city:lm.city,record:file,status:row.status,sourceCommit:row.sourceCommit,sourceCommitExists:valid,captureSourceCommits:[...new Set(captures.map(c=>c.sourceCommit))],builder:lm._fn.name,directBuilderChangedFromMaster:old?lm._fn.toString()!==old._fn.toString():null,directBuilderMatchesCapturedSource:captured?lm._fn.toString()===captured._fn.toString():false,builderComparisonLimit:'Static own-function comparison only: shared helpers, source arrays, materials, dependencies and world placement may differ. It is not a complete mesh or visual-compatibility test.',sourceIds:lm.sourceIds||[],districtOnly:!!lm.districtOnly,backdrop:!!lm.backdrop,districts,improvements:row.improvements,remainingGaps:row.remainingGaps,checks:row.checks.map(c=>({label:c.label,passed:c.passed})),captures});
}
const spots=[];
for(const file of records('spots')){
 const row=JSON.parse(bytes(file));
 const captures=row.captures.map((c,index)=>{if(!existsCommit(c.sourceCommit))failures.push({label:row.id,error:'Invalid current capture commit'});return{id:c.id||c.kind||index,sourceCommit:c.sourceCommit,...asset(c.image,c.sha256,row.id+'/'+(c.kind||index))};});
 const history=(row.historicalCollections||[]).flatMap((h,index)=>(h.captures||[]).map((c,j)=>({collection:index,id:c.id||c.kind||j,sourceCommit:c.sourceCommit||h.sourceCommit||null,...asset(c.image,c.sha256,row.id+'/historical/'+index+'/'+j)})));
 const proofs=(row.nativeProofs||[]).map(p=>{const historical=p.provenance==='historical-source-unrecorded';if(!historical&&!existsCommit(p.sourceCommit))failures.push({label:row.id,error:'Invalid current native proof commit'});const check=p.report?asset(p.report,p.sha256,row.id+'/native-proof'):null;return{label:p.label,sourceCommit:p.sourceCommit,passed:p.passed,provenance:p.provenance||null,scope:p.scope,asset:check};});
 spots.push({id:row.id,name:row.name,city:row.city,record:file,status:row.status,sceneId:row.sceneId,menuAvailable:row.menuAvailable,sourceCommit:row.sourceCommit,captureSourceCommits:[...new Set(captures.map(c=>c.sourceCommit))],primaryRouteStatus:row.access?.primaryRouteStatus,routeSourceCommit:row.access?.sourceCommit,phoneConditionsSource:row.access?.phoneConditionControls?.sourceCommit,sourceGeometry:row.sourceGeometry,improvements:row.improvements,remainingGaps:row.remainingGaps,captures,history,nativeProofs:proofs});
}
const countBy=(items,fn)=>Object.fromEntries([...new Set(items.map(fn))].map(k=>[k,items.filter(i=>fn(i)===k).length]));
const summary={head,base,registry:LANDMARKS.length,landmarkRecords:landmarks.length,landmarkCaptures:landmarks.reduce((n,r)=>n+r.captures.length,0),landmarkCities:countBy(landmarks,r=>r.city),landmarkRecordSources:countBy(landmarks,r=>r.sourceCommit),landmarkCurrentCaptureSources:countBy(landmarks.flatMap(r=>r.captures),r=>r.sourceCommit),mixedCaptureRecords:landmarks.filter(r=>r.captureSourceCommits.length>1).map(r=>({id:r.id,sources:r.captureSourceCommits})),directBuilderChanges:countBy(landmarks,r=>String(r.directBuilderChangedFromMaster)),directBuilderMatchesCapturedSource:countBy(landmarks,r=>String(r.directBuilderMatchesCapturedSource)),landmarksWithDistrictInstantiation:landmarks.filter(r=>r.districts.length).length,notInEightDistrictLists:landmarks.filter(r=>!r.districts.length).map(r=>r.id),backdrops:landmarks.filter(r=>r.backdrop).map(r=>r.id),touristRecords:spots.length,touristDistinctScenes:new Set(spots.map(r=>r.sceneId)).size,touristCurrentCaptures:spots.reduce((n,r)=>n+r.captures.length,0),touristHistoricalCaptures:spots.reduce((n,r)=>n+r.history.length,0),touristRouteStatus:countBy(spots,r=>r.primaryRouteStatus),touristMenuAvailable:countBy(spots,r=>String(r.menuAvailable)),touristCurrentCaptureSources:countBy(spots.flatMap(r=>r.captures),r=>r.sourceCommit),uniqueVerifiedAssets:seenAssets.size,sourceCommitsVerified:[...commits.keys()],failures};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({summary,landmarks,spots},null,2)+'\n');fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
