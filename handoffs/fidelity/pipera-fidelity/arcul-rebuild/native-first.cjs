'use strict';
// Short normal-menu entry/static/photo probe. No activity completion or walk
// acceptance follows from this observer; all native actors remain at time0.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const {chromium}=require('playwright'),{accountFrame}=require('./counter-accounting.cjs');
const [rootArg,outArg,sourceCommit,manifestArg]=process.argv.slice(2),root=path.resolve(rootArg),out=path.resolve(outArg);
const manifest=JSON.parse(fs.readFileSync(manifestArg)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(manifest.commit!==sourceCommit||!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact committed source required');
if(fs.existsSync(out))throw Error('Preserve prior output');fs.mkdirSync(out,{recursive:true});
const report={sourceCommit,observerCommit:cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),observerSha256:sha(fs.readFileSync(__filename)),startedUtc:new Date().toISOString(),scope:'Short actual public-menu High/noon/clear Arc entry, complete native warm render work, unchanged-player/actor read-only complete-scene static body/terrain scan, actual first-person pictures. No walk, race, catch, award, full tour, phone or global acceptance.',errors:[],consoleErrors:[],httpErrors:[],failures:[],frames:[],served:{},complete:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const verify=()=>{for(const[n,m]of Object.entries(manifest.files)){const b=fs.readFileSync(path.join(root,n));if(sha(b)!==m.sha256)throw Error('Changed source '+n);}return Object.keys(manifest.files).length;};
let server,browser,page;
(async()=>{
 report.verifiedSourceBefore=verify();save();
 server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,''),p=path.resolve(root,n);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,b)=>{if(err||!manifest.files[n]||sha(b)!==manifest.files[n].sha256){report.httpErrors.push({path:n,error:String(err||'hash mismatch')});res.writeHead(404).end();return;}report.served[n]=manifest.files[n];res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'})[path.extname(n)]||'application/octet-stream','cache-control':'no-store'}).end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();
 page.on('pageerror',e=>{report.errors.push(String(e.stack||e));save();});page.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push(m.text());save();}});page.on('requestfailed',r=>report.httpErrors.push({url:r.url(),failure:r.failure()}));
 await context.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
 await page.goto(base+'game/index.html?notrack');await page.waitForFunction(()=>window.game?.r3d,null,{timeout:90000});
 await page.addScriptTag({type:'module',url:base+'game/dev/harness/page/index.js'});await page.waitForFunction(()=>window.harness);
 await page.evaluate(()=>{
  const g=game,H=harness.H;H.noShots=true;H.renderEvery=0;
  const S=window.ARC_OBSERVE={count:false,draws:[],unframed:[]},original=g.renderer.renderBufferDirect;
  g.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){const before={...this.info.render},result=original.apply(this,arguments),after={...this.info.render};
   const calls=after.calls-before.calls,triangles=after.triangles-before.triangles;if(calls||triangles){const row={calls,triangles,countersBefore:before,countersAfter:after,
    pass:camera===g.camera?'main':camera===g.r3d.sun?.shadow.camera?'true-shadow':material.name==='SphericalGaussianBlur'?'reflection-blur':scene===S.envScene||material.name==='PMREM.Background'?'reflection':'other',
    camera:{id:camera.id,type:camera.type},object:{id:object.id,name:object.name,type:object.type},material:{name:material.name,type:material.type}};(S.count?S.draws:S.unframed).push(row);}return result;};
  S.actors=()=>{const s=g.spot;if(!s)return null;const e=s.spot.ctx.extras;return JSON.stringify({time:s.t,player:[s.ctl.x,s.ctl.y,s.ctl.z,s.ctl.heading,s.ctl.pitch],cars:e.arcAmbientTraffic.cars.map(c=>[c.id,c.x,c.z,c.s,c.speed,c.v.visible]),people:s.spot.crowd.peds.map(p=>[p.id,p.x,p.y,p.z,p.yaw,p.hidden]),racers:e.arcActivities.opponents.peds.map(p=>[p.id,p.x,p.y,p.z,p.yaw,p.hidden])});};
 });
 await page.selectOption('#quality','high');await page.selectOption('#timeofday','noon');await page.selectOption('#weather','clear');
 await page.locator('#spot-select summary').click();await page.locator('#spot-select [data-spot="arcul-de-triumf"]').click();
 await page.waitForFunction(()=>game.state==='spot'&&game.spot?.spot.entry.id==='arcul-de-triumf'&&!game._spotBusy,null,{timeout:180000});
 report.entry=await page.evaluate(()=>{const s=game.spot,S=s.spot,e=S.ctx.extras;return{state:game.state,id:S.entry.id,time:s.t,pose:{...s.position,heading:s.ctl.heading,pitch:s.ctl.pitch},source:e.arcSource,
   people:S.crowd.peds.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,hidden:!!p.hidden,persona:p.persona})),racers:e.arcActivities.opponents.peds.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,hidden:!!p.hidden,driven:p.driven})),
   cars:e.arcAmbientTraffic.cars.map(c=>({id:c.id,x:c.x,z:c.z,s:c.s,visible:c.v.visible,kind:c.kind})),terrain:S.ctx.extras.terrainBox,colliders:S.colliders.length,uniqueTriangles:S.tris,
   camera:{fov:game.camera.fov,near:game.camera.near,far:game.camera.far},quality:game.quality,clock:game.nowDate().toISOString(),season:game.r3d._seasonOverride||'native-auto',activityIds:S.interactables.filter(i=>i.tourActivityIds).map(i=>({label:i.label,ids:i.tourActivityIds}))};});save();console.log('ENTRY',JSON.stringify({time:report.entry.time,people:report.entry.people.length,racers:report.entry.racers.length,cars:report.entry.cars.length,camera:report.entry.camera}));
 for(let i=0;i<4;i++){
  const f=await page.evaluate(label=>{const g=game,S=ARC_OBSERVE,before=S.actors();S.envScene=g.r3d._envJob?.scene;S.draws=[];S.count=true;
   const preDrawCounters={...g.renderer.info.render};try{g.r3d.frame(0);}finally{S.count=false;}
   return{label,preDrawCounters,postDrawCounters:{...g.renderer.info.render},nativeRawStats:{calls:g.r3d.stats.drawCalls,triangles:g.r3d.stats.triangles},draws:S.draws,pendingReflection:!!g.r3d._envJob,actorsUnchanged:before===S.actors(),camera:{fov:g.camera.fov,near:g.camera.near,far:g.camera.far},size:{width:g.renderer.domElement.width,height:g.renderer.domElement.height,pixelRatio:g.renderer.getPixelRatio()}};},'native-entry-'+i);
  f.accounting=accountFrame(f.preDrawCounters,f.postDrawCounters,f.nativeRawStats,f.draws);report.frames.push(f);save();await page.screenshot({path:path.join(out,f.label+'.png')});console.log('FRAME',f.label,JSON.stringify(f.accounting.measuredCompleteFrame));
  if(!f.actorsUnchanged||!f.accounting.rawStatsAgreement)report.failures.push({kind:'frame-invariant',label:f.label});
  if(f.accounting.measuredFrameOverBudget)report.failures.push({kind:'render-budget',label:f.label});
  if(i>=1&&!f.pendingReflection)break;
 }
 const scan=await page.evaluate(async()=>{const {collideBuildings}=await import('/game/src/world.js'),s=game.spot,S=s.spot,e=S.ctx.extras,course=e.arcActivities.course,before=ARC_OBSERVE.actors(),rows=[];
  for(let i=1;i<course.points.length;i++){const a=course.points[i-1],b=course.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1);
   for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n,terrain=S.ground.heightAt(x,z),y=S.ground.groundAt(x,z,s.position.y+.6),hit=collideBuildings(S.colliders,x,z,.3,y+.2);
    rows.push({segment:i,t:j/n,x,z,terrain,y,heightUnknown:!Number.isFinite(y)||Math.abs(y-s.position.y)>.7,hit:hit?{px:hit.px,pz:hit.pz,kind:hit.hit?.kind,sourceId:hit.hit?.sourceId}:null});}}
  return{rows,actorPlayerTimeUnchanged:before===ARC_OBSERVE.actors(),nativeTime:s.t,scope:'Exact native OnFoot R.3/feet+.2/default bodyHeight2 static kernel at every<=.1m point; source course/ground/complete actual scene colliders. Dynamic race opponents/crowd remain and require native input navigation, not a clear-road claim.'};});
 fs.writeFileSync(path.join(out,'native-static-course.json.gz'),zlib.gzipSync(Buffer.from(JSON.stringify(scan))));report.staticCourse={rows:scan.rows.length,positiveRows:scan.rows.filter(r=>r.hit),heightUnknown:scan.rows.filter(r=>r.heightUnknown),actorPlayerTimeUnchanged:scan.actorPlayerTimeUnchanged,nativeTime:scan.nativeTime};
 if(report.staticCourse.positiveRows.length||report.staticCourse.heightUnknown.length||!scan.actorPlayerTimeUnchanged)report.failures.push({kind:'native-static-course'});
 report.complete=true;console.log('BODY',JSON.stringify({rows:scan.rows.length,positive:report.staticCourse.positiveRows.length,heightUnknown:report.staticCourse.heightUnknown.length}));
})().catch(e=>{report.fatal=String(e.stack||e);report.failures.push({kind:'tool-or-runtime-fatal'});process.exitCode=1;}).finally(async()=>{
 if(page&&!page.isClosed())try{report.unframedDraws=await page.evaluate(()=>window.ARC_OBSERVE?.unframed||[]);}catch(e){report.unframedReadError=String(e);}
 await browser?.close();report.browserClosed=true;if(server?.listening)await new Promise(r=>server.close(r));try{report.verifiedSourceAfter=verify();}catch(e){report.failures.push({kind:'source-changed',error:String(e)});}
 report.endedUtc=new Date().toISOString();save();console.log('CLOSED',report.complete,report.fatal||'');if(report.failures.length||report.errors.length||report.consoleErrors.length||report.httpErrors.length)process.exitCode=1;
});
