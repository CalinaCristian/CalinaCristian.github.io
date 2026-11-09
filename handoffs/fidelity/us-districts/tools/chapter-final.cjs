// Focused native SeaTac completion against the actual production road objective.
// Retains the declared geographic point separately; does not edit runtime code.
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {execFileSync}=require('child_process'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),sha=process.argv[4],rawPath=process.argv[5];
if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('Full immutable source revision required');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),inputs={};
for(const file of ['game/data/seattle-seatac.json','game/src/main.js','game/src/world.js','game/src/cities.js','game/src/chapter-waypoint.js','game/dev/harness/page/core.js','game/dev/harness/page/util.js']){
 const bytes=fs.readFileSync(path.join(root,file));if(!bytes.equals(execFileSync('git',['show',sha+':'+file],{maxBuffer:32*1024*1024})))throw Error('Source mismatch: '+file);inputs[file]=hash(bytes);
}
const raw=rawPath?JSON.parse(fs.readFileSync(rawPath)):null;if(raw&&raw.sourceCommit!==sha)throw Error('Raw road findings belong to another source');
fs.mkdirSync(out,{recursive:true});
const report={gateScope:'Only continuous native completion at the actual production objective. Static road finding replays remain diagnostic; a clear point does not establish full body/road clearance.',sourceCommit:sha,inputHashes:inputs,captureToolSha256:hash(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),errors:[],consoleErrors:[],captures:[]};
const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(e?'missing':b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  await page.route('**/api.open-meteo.com/**',r=>r.fulfill({json:{error:true}}));
  await page.goto(base+'/game/index.html?weather=clear&season=summer&notrack',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.game);
  await page.addScriptTag({url:base+'/game/dev/harness/visual/page/visual.js',type:'module'});await page.waitForFunction(()=>window.vqa);
  report.loaded=await page.evaluate(()=>vqa.loadGroup('seattle-seatac',{quality:'high',time:'day',weather:'clear',pr:1,far:0,traffic:true}));
  await page.evaluate(async()=>{await game.enterChapter(game.chapters.findIndex(c=>c.city==='seattle'&&c.district==='seatac'));game.hud.closePanel?.();game.clock.trafficHour=12;game.traffic.setHour(12,true);});
  await page.addScriptTag({url:base+'/game/dev/harness/page/index.js',type:'module'});await page.waitForFunction(()=>window.harness);await page.evaluate(()=>{harness.H.noShots=true;});
  if(raw){
   report.rawFindingsReportSha256=hash(fs.readFileSync(rawPath));
   report.roadFindingReplay=await page.evaluate(async rows=>{
    const {ribbonHits,hitLevel}=await import('/game/dev/harness/page/core.js'),{lampSet,pointInCollider}=await import('/game/dev/harness/page/util.js'),{buildingBlocksRoad}=await import('/game/src/world.js'),w=game.world,lamps=lampSet(w),out=[];
    for(const r of rows.filter(r=>r.type==='object-in-road'||r.type==='object-under-elevated-road')){
     const e=w.allEdges.find(e=>e.id===r.data.edge);if(!e){out.push({rawId:r.id,status:'source-edge-absent'});continue;}
     const hits=ribbonHits(e,w,lamps).sort((a,b)=>Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z)),h=hits[0];
     if(!h||Math.hypot(h.x-r.x,h.z-r.z)>.3){out.push({rawId:r.id,edge:e.id,status:'exact-static-hit-not-reproduced'});continue;}
     const level=hitLevel(e,h),roadY=.24+level.deckY,bodies=[];
     w.buildings.query(h.x,h.z,.1,c=>{if(pointInCollider(c,h.x,h.z,.05,roadY,2))bodies.push({kind:c.kind||null,sourceId:c.sourceId||null,landmark:c.landmark||null,nativeBlocksRoad:buildingBlocksRoad(c,h.x,h.z,roadY,2),minimumM:c.minH??c.y0??null,maximumM:c.y1??c.h??null,keys:Object.keys(c).filter(k=>!['poly','holes','passageSolids'].includes(k))});});
     const access=e.access||{},publicDrive=e.publicDrive??access.publicDrive??null,source=w.data.roadSourceGeometry?.[e.road];
     out.push({rawId:r.id,rawType:r.type,edge:e.id,road:e.road,sourceRoadId:source?.sourceId||access.sourceId||null,sourceTags:source?.tags||null,publicDrive,throughAccess:e.throughAccess??access.throughAccess??null,drivable:e.drivable,actualPoint:{x:h.x,z:h.z,roadY},level:level.level,rawDepthMeaning:'For solid landmark hits depth is a positive lane-sample count, not penetration metres (core.js ribbonHits).',roadWidthM:e.wL+e.wR,widthSource:e.roadWidthSource??null,bodies,status:bodies.some(b=>b.nativeBlocksRoad)?(publicDrive===false?'unresolved restricted/source road-body overlap':'unresolved source road-body overlap; do not claim clearance'):'production road-body test clear at the exact reproduced sample'});
    }
    return out;
   },raw.issues||[]);write();
  }
  async function capture(id){const obs=await page.evaluate(()=>{const g=game,H=harness.H,S=vqa.S;H._renderNow=true;S.renderNow=true;try{g.drawFrame({mirror:true});g.renderer.info.reset();g.drawFrame({mirror:true});return{state:g.state,objective:g.objective?{...g.objective}:null,player:{x:g.player.x,z:g.player.z,y:g.player.y},vehicles:g.traffic.vehicles.length,pedestrians:g.traffic.peds?.list?.length??null,perf:{drawCalls:g.r3d.stats.drawCalls,triangles:g.r3d.stats.triangles},fogEnabled:!!g.scene.fog,cameraFar:g.camera.far};}finally{H._renderNow=false;S.renderNow=false;}});const image=id+'.jpg';await page.screenshot({path:path.join(out,image),type:'jpeg',quality:88});report.captures.push({id,image,sha256:hash(fs.readFileSync(path.join(out,image))),capturedAt:new Date().toISOString(),...obs});write();}
  await capture('native-chapter-start');
  report.chapter=await page.evaluate(async()=>{
   const g=game,H=harness.H;H.begin('native-seatac-actual-production-objective');
   const declared=g.city.proj(g.ch.waypoint.lat,g.ch.waypoint.lon),objective={...g.objective};if(!objective.waypoint)throw Error('Native waypoint objective absent');
   const target={x:objective.x,z:objective.z},start={x:g.player.x,z:g.player.z,y:g.player.y},route=g.nav.compute(start.x,start.z,target.x,target.z,g.player.heading),events=[],placements=[],place=g.player.place,complete=g.completeChapter,run=H.run.bind(H);
   g.player.place=function(...args){placements.push({before:{x:g.player.x,z:g.player.z},requested:{x:args[0],z:args[1]}});return place.apply(this,args);};
   g.completeChapter=function(...args){events.push({player:{x:g.player.x,z:g.player.z,y:g.player.y},actualObjective:{...g.objective},actualObjectiveDistanceM:Math.hypot(g.player.x-g.objective.x,g.player.z-g.objective.z),declaredCoordinateDistanceM:Math.hypot(g.player.x-declared.x,g.player.z-declared.z),navigationRemainingM:g.navInfo?.remaining??null});return complete.apply(this,args);};
   H.run=(seconds,until)=>run(seconds,()=>g.chapterDone||!!until?.());let result;
   try{result=await H.driveTo(target.x,target.z,{label:'actual production SeaTac road objective',timeout:420,arriveR:16,stop:false});}finally{g.completeChapter=complete;g.player.place=place;H.run=run;}
   const completedAtActualObjective=g.chapterDone&&events.length>0&&events.every(e=>e.actualObjectiveDistanceM<30);
   return{declaredCoordinate:declared,actualProductionObjective:objective,declaredToProductionOffsetM:Math.hypot(declared.x-objective.x,declared.z-objective.z),start,routeLengthM:route?.total,routeHasVirtual:route?.legs?.some(l=>l.e.virtual),routeSourceLegs:route?.legs?.map(l=>({sourceId:l.e.access?.sourceId,layer:l.e.layer,dir:l.dir,drivable:l.e.drivable,publicDrive:l.e.access?.publicDrive,throughAccess:l.e.access?.throughAccess,virtual:!!l.e.virtual})),result,completionEvents:events,placementsDuringTraversal:placements,chapterDone:g.chapterDone,state:g.state,completedAtActualObjective,continuousCompletion:completedAtActualObjective&&placements.length===0&&result.resets===0,note:'The game projects the declared coordinate to its actual road objective. The unchanged30m production gate is checked against that real objective. Native completion opens the card before the tighter16m driveTo arrival; its unmodified result is retained.'};
  });write();await capture('native-chapter-complete');report.harnessIssues=await page.evaluate(()=>harness.issues);
  report.nativeDynamicHighMedium=report.harnessIssues.filter(i=>i.severity==='high'||i.severity==='medium');report.endedAt=new Date().toISOString();report.passed=report.chapter.continuousCompletion&&!report.errors.length&&!report.consoleErrors.length&&!report.nativeDynamicHighMedium.length;write();if(!report.passed)process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{report.failure=e.message;write();console.error(e);server.close();process.exitCode=1;});
