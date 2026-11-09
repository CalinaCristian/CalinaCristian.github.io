'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),sourceCommit=process.argv[4];fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={sourceCommit,toolSha256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),scope:'Controlled portrait mode/depth/picking/resource checks only. The12 native-camera full-mirror stress captures are retained in the separate original and portrait-followup reports. No fixture image is a native availability proof.',cases:[],errors:[],consoleErrors:[],httpFailures:[],served:[],complete:false};
const served=new Map(),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webm':'video/webm'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');}catch{res.writeHead(404).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}served.set(path.relative(root,f).split(path.sep).join('/'),sha(b));res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
let browser;
const save=()=>{result.served=[...served].map(([path,sha256])=>({path,sha256}));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const config of [{id:'phone-portrait',viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true}]){
  const {id,...options}=config,context=await browser.newContext(options),page=await context.newPage();page.setDefaultTimeout(180000);if(process.env.COCKPIT_CONTROLS)await require(path.resolve(process.env.COCKPIT_CONTROLS)).install(page);
  page.on('pageerror',e=>result.errors.push({id,message:e.message}));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push({id,message:m.text()});});page.on('response',r=>{if(r.status()>=400)result.httpFailures.push({id,url:r.url(),status:r.status()});});
  await page.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.game);
  await page.evaluate(()=>{game.audio?.setMuted?.(true);});
  await page.addScriptTag({type:'module',url:`http://127.0.0.1:${server.address().port}/game/dev/harness/page/index.js`});await page.waitForFunction(()=>window.harness);
  await page.evaluate(async()=>{const g=game;g.started=true;document.querySelector('#menu').classList.remove('show');document.querySelector('#hud').classList.add('show');document.body.classList.add('playing');await g.enterChapter(g.chapters.findIndex(c=>c.id==='arnia'),{initial:true});g.setRoamTime('day');g.setRoamWeather('clear');g.r3d.setSeason('summer');g.updateClock(0);g.input.lookAllowed=true;g.player.mirrorEnabled=true;document.body.dataset.mode=g.state;g.syncModalControls?.();g.updateDrive(1/60);g.updateDrive(1/60);});
  for(const quality of []){
   await page.evaluate(q=>{game.r3d.setQuality(q);game.quality=q;},quality);
   const frames=[];
   for(let i=0;i<3;i++)frames.push(await page.evaluate(()=>{const g=game,r=g.renderer,pre={calls:r.info.render.calls,triangles:r.info.render.triangles};r.info.reset();harness.H._renderNow=true;g.drawCarScreen(g.hud?.el?.street?.textContent||'','');g.drawFrame({mirror:true});harness.H._renderNow=false;const gl=r.getContext();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return {preFrameCarry:pre,stats:{...g.r3d.stats},resources:{...r.info.memory,programs:r.info.programs.length},contextLost:gl.isContextLost()};}));
   const row=await page.evaluate(async({id,quality,frames})=>{
    const g=game,p=g.player,r=g.renderer,T=await import('/game/vendor/three.module.min.js');g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld(true);
    const rect=o=>{o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const v=new T.Vector3(x,y,b.max.z).applyMatrix4(o.matrixWorld).project(g.camera);points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,z:v.z});}return {points,x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};};
    const texture=t=>t?{width:t.image?.width,height:t.image?.height,minFilter:t.minFilter,magFilter:t.magFilter,generateMipmaps:t.generateMipmaps,anisotropy:t.anisotropy,colorSpace:t.colorSpace}:null;
    return {id,quality,frames,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:r.domElement.width,height:r.domElement.height,pixelRatio:r.getPixelRatio()},camera:{fov:g.camera.fov,aspect:g.camera.aspect,near:g.camera.near,far:g.camera.far,matrix:g.camera.matrixWorld.toArray(),projection:g.camera.projectionMatrix.toArray(),layers:g.camera.layers.mask},player:{x:p.x,y:p.y,z:p.z,heading:p.heading,speed:p.speed,length:p.length,width:p.width,front:p.front,rear:p.rear},displays:{cluster:{rect:rect(p.cockpit.userData.cluster),texture:texture(p.cockpit.userData.cluster.material.map)},screen:{rect:rect(p.cockpit.userData.screen),texture:texture(p.cockpit.userData.screen.material.map),home:texture(p.cockpit.userData.screen.material.userData.uHome?.value)},mirror:{rect:rect(p.mirror),texture:texture(p.mirror.material.map)}},population:{vehicles:g.traffic.vehicles.map(v=>v.id),pooled:g.traffic.pool.map(v=>v.id),pedestrians:g.traffic.peds.list.map(v=>v.i),target:g.traffic.target},mirror:{enabled:p.mirrorEnabled,visible:p.mirror.visible,layers:p.mirrorCam.layers.mask,width:p.mirrorTarget.width,height:p.mirrorTarget.height},sharpDisplayStats:g.r3d.displayStats||null};
   },{id,quality,frames});
   const stem=id+'-'+quality;await page.screenshot({path:path.join(out,stem+'.png')});
   for(const [display,data]of Object.entries(row.displays)){const a=data.rect,x=Math.max(0,Math.floor(a.x)-2),y=Math.max(0,Math.floor(a.y)-2),right=Math.min(row.viewport.width,Math.ceil(a.right)+2),bottom=Math.min(row.viewport.height,Math.ceil(a.bottom)+2);if(right>x&&bottom>y)await page.screenshot({path:path.join(out,stem+'-'+display+'.png'),clip:{x,y,width:right-x,height:bottom-y}});}
   result.cases.push(row);save();console.log(JSON.stringify({id,quality,canvas:row.canvas,level:frames.at(-1).stats.level,calls:Math.max(...frames.map(f=>f.stats.drawCalls)),triangles:Math.max(...frames.map(f=>f.stats.triangles))}));
  }
  if(process.env.COCKPIT_CONTROLS&&id==='phone-portrait')result.controls=await require(path.resolve(process.env.COCKPIT_CONTROLS)).run(page,out);
  await context.close();
 }
 result.complete=true;
})().catch(e=>{result.failure=e.stack||e.message;console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server.listening)await new Promise(r=>server.close(r));result.browserClosed=true;result.endedAt=new Date().toISOString();save();});
