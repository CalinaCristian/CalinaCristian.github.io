'use strict';
// Static visual inspection only. Camera transforms are explicit observations;
// they are never claimed as a driving, native-camera or budget acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {chromium}=require('playwright');
const [rootArg,outArg,manifestArg]=process.argv.slice(2),root=path.resolve(rootArg),out=path.resolve(outArg);
const manifest=JSON.parse(fs.readFileSync(manifestArg)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out))throw Error('Preserve previous output');fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:manifest.commit,scope:'Static source-domain/closure inspection at explicit camera transforms. Native public High/noon/clear/summer populations remain at time0. Camera views are not native cockpit budgets or physical driving acceptance.',startedUtc:new Date().toISOString(),toolSha256:sha(fs.readFileSync(__filename)),stages:[],served:{},errors:[],consoleErrors:[],httpErrors:[],complete:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const verify=()=>{for(const[n,m]of Object.entries(manifest.files)){const b=fs.readFileSync(path.join(root,n));if(sha(b)!==m.sha256)throw Error('Changed source '+n);}return Object.keys(manifest.files).length;};
let server,browser;
(async()=>{
 report.sourceVerifiedBefore=verify();save();
 server=http.createServer((req,res)=>{const n=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,''),p=path.resolve(root,n);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,b)=>{if(err||!manifest.files[n]||sha(b)!==manifest.files[n].sha256){report.httpErrors.push({path:n,error:String(err||'hash mismatch')});res.writeHead(404).end();return;}report.served[n]=manifest.files[n];res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'})[path.extname(n)]||'application/octet-stream','cache-control':'no-store'}).end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('requestfailed',r=>report.httpErrors.push({url:r.url(),error:r.failure()}));
 await page.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
 await page.goto(base+'game/index.html?notrack');await page.waitForFunction(()=>window.game?.r3d,null,{timeout:90000});
 await page.addScriptTag({type:'module',url:base+'game/dev/harness/page/index.js'});await page.waitForFunction(()=>window.harness);
 await page.addScriptTag({type:'module',content:"import * as T from '/game/vendor/three.module.min.js';window.INSPECT_THREE=T;"});await page.waitForFunction(()=>window.INSPECT_THREE);
 await page.selectOption('#quality','high');
 for(const district of ['grozavesti','otopeni','bellevue','seatac']){
  await page.evaluate(d=>game.startFreeRoam(d,{tod:'noon',weather:'clear',season:'summer'}),district);
  const stage={district,captures:[]};report.stages.push(stage);
  const facts=await page.evaluate(()=>{
   const W=game.world,T=game.traffic,P=game.player;
   window.__inspectionActors=()=>JSON.stringify({time:T.time,player:[P.x,P.z,P.heading,P.surfY,P.speed],vehicles:[...T.vehicles,...T.pool].map(v=>[v.id,v.x,v.z,v.y,v.heading,v.s,v.speed]),peds:T.peds.list.map(p=>[p.i,p.x,p.z,p.y,p.state])});
   window.__inspectionBefore=__inspectionActors();
   const edge=e=>e?{id:e.id,sourceId:e.access?.sourceId,road:e.road,a:{x:e.a.x,z:e.a.z,sourceId:e.a.sourceId},b:{x:e.b.x,z:e.b.z,sourceId:e.b.sourceId}}:null;
   return{district:game.district,population:{active:T.vehicles.length,pool:T.pool.length,peds:T.peds.list.length,ids:[...T.vehicles,...T.pool].map(v=>v.id)},nativeTime:T.time,
    initialAdmissionPassed:T.initialAdmission?.passed,initialTramBinding:T.initialTramBinding,boundary:W.stats.districtBoundary,
    closures:W.closures.map(c=>({...c,edge:edge(c.edge),node:{id:c.node.id,x:c.node.x,z:c.node.z,sourceId:c.node.sourceId}})),
    physicalClosureWalls:W.walls.filter(w=>w.kind==='closure').map(w=>({ax:w.ax,az:w.az,bx:w.bx,bz:w.bz,y0a:w.y0a,y1a:w.y1a,bundleId:w.bundleId,l0:w.l0,l1:w.l1,edge:edge(w.edge)})),
    sourceWalls:W.walls.filter(w=>w.kind==='boundary').map(w=>({ax:w.ax,az:w.az,bx:w.bx,bz:w.bz})),
    bounds:W.bounds,mask:{x0:W.district.mask.x0,z0:W.district.mask.z0,w:W.district.mask.w,h:W.district.mask.h,cell:W.district.mask.cell}};
  });
  const raw=Buffer.from(JSON.stringify(facts)),gz=zlib.gzipSync(raw),file=district+'-closure-facts.json.gz';fs.writeFileSync(path.join(out,file),gz);stage.facts={file,rawSha256:sha(raw),sha256:sha(gz),rawBytes:raw.length};
  const poses=[];
  if(district==='grozavesti')poses.push({id:'old-x640-boundary',x:638,y:53,z:-828,tx:638,ty:11.24,tz:-867});
  if(district==='bellevue')poses.push({id:'103rd-closure',x:-603.81475,y:2.74,z:-452.5295,tx:-603.81475,ty:2.74,tz:-502.5295},{id:'avenue-square-closure',x:-509.6814,y:2.74,z:-437.4378,tx:-511.4264,ty:7.97,tz:-487.4073});
  const preferred=district==='seatac'?facts.closures.filter(c=>c.edge.id===792):[];
  const selected=preferred.length?preferred:facts.closures.filter(c=>c.bundlePrimary).sort((a,b)=>a.bundleId-b.bundleId).slice(0,district==='otopeni'?3:1);
  for(const c of selected){const e=c.edge,a=e.a,b=e.b,L=Math.hypot(b.x-a.x,b.z-a.z),sgn=c.node.sourceId===a.sourceId?1:-1,ix=(b.x-a.x)/L*sgn,iz=(b.z-a.z)/L*sgn;
   poses.push({id:'closure-edge-'+e.id,x:c.x+ix*28,y:(c.worker?.y??0)+17,z:c.z+iz*28,tx:c.x,ty:c.worker?.y??0,tz:c.z,edgeId:e.id,bundleId:c.bundleId});}
  for(const p of poses){
   const view=await page.evaluate(p=>{const g=game,C=g.camera,V=INSPECT_THREE.Vector3;C.position.copy(C.parent.worldToLocal(new V(p.x,p.y,p.z)));C.lookAt(new V(p.tx,p.ty,p.tz));C.updateMatrixWorld(true);harness.H._renderNow=true;try{g.drawFrame({mirror:true});}finally{harness.H._renderNow=false;}return{camera:C.getWorldPosition(new V()).toArray(),quaternion:C.getWorldQuaternion(new INSPECT_THREE.Quaternion()).toArray(),fov:C.fov,far:C.far,actorPlayerTimeUnchanged:__inspectionBefore===__inspectionActors(),nativeTime:g.traffic.time};},p);
   const file=district+'-'+p.id+'.png';await page.screenshot({path:path.join(out,file)});stage.captures.push({...p,file,sha256:sha(fs.readFileSync(path.join(out,file))),view});save();
  }
  stage.complete=true;save();console.log('CLOSURES',district,poses.length,facts.closures.length);
 }
 report.sourceVerifiedAfter=verify();report.complete=!report.errors.length&&!report.consoleErrors.length&&!report.httpErrors.length&&report.stages.every(s=>s.complete&&s.captures.every(c=>c.view.actorPlayerTimeUnchanged));
})().catch(e=>{report.fatal=String(e.stack||e);process.exitCode=1;}).finally(async()=>{await browser?.close();report.browserClosed=true;if(server?.listening)await new Promise(r=>server.close(r));report.endedUtc=new Date().toISOString();save();console.log('CLOSED',report.complete,report.fatal||'');});
