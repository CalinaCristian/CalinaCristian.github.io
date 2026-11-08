#!/usr/bin/env node
// Capture planned game-only aerials from an immutable git archive. Requires Playwright.
// The source root stays read-only; no reference service is contacted or cached.
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const root=path.resolve(args.root||'.'),out=path.resolve(args.out||'/tmp/game-grid'),city=args.city||'bucharest',district=args.district||'floreasca';
const width=+(args.width||640),traffic=args.traffic==='true';
const poses=JSON.parse(fs.readFileSync(path.join(out,'poses.json'))),plan=JSON.parse(fs.readFileSync(path.join(out,'grid-plan.json')));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(f,o)=>fs.writeFileSync(path.join(out,f),JSON.stringify(o,null,2)+'\n');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.bin':'application/octet-stream'};
function sourceFiles(dir,rel=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(path.join(dir,e.name),path.join(rel,e.name)):[{path:path.join(rel,e.name),sha256:hash(fs.readFileSync(path.join(dir,e.name)))}]);}
(async()=>{
  fs.mkdirSync(path.join(out,'images'),{recursive:true});fs.mkdirSync(path.join(out,'thumbs'),{recursive:true});
  const sourceIdentity={gameSourceCommit:plan.gameSourceCommit,sourceRoot:root,delivery:'git archive of published source commit; capture tool is outside the served archive',files:sourceFiles(root)};
  sourceIdentity.treeSha256=hash(Buffer.from(JSON.stringify(sourceIdentity.files)));write('source-provenance.json',sourceIdentity);
  const server=http.createServer((req,res)=>{
    let rel;try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
    const f=path.resolve(root,'.'+rel);
    if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/`,errors=[],consoleErrors=[],failedRequests=[];
  const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--mute-audio']});
  try{
    const ctx=await browser.newContext({viewport:{width,height:width},deviceScaleFactor:1});
    await ctx.route(/api\.open-meteo\.com/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"error":true}'}));
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('requestfailed',r=>failedRequests.push({url:r.url().split('?')[0],failure:r.failure()?.errorText}));
    await page.addInitScript(()=>{localStorage.setItem('dmcv:minimap','0');localStorage.setItem('dmcv:lookHintShown','1');});
    const startedAt=new Date().toISOString(),t0=Date.now();
    await page.goto(base+'game/index.html?weather=clear&season=summer&notrack',{waitUntil:'load'});
    await page.waitForFunction(()=>window.game,null,{timeout:90000});
    await page.addScriptTag({url:base+'game/dev/harness/visual/page/visual.js',type:'module'});
    await page.waitForFunction(()=>window.vqa,null,{timeout:30000});
    await page.evaluate(o=>window.vqa.setOpts(o),{quality:'high',time:'day',weather:'clear',pr:1,far:0,traffic});
    const loaded=await page.evaluate(k=>window.vqa.loadGroup(k),`${city}-${district}`);
    await page.evaluate(()=>{window.vqa.hideHud(true);const c=window.game.renderer.domElement;for(const e of document.body.children)if(e!==c&&!e.contains(c))e.style.visibility='hidden';});
    const worldStats=await page.evaluate(()=>window.game.world.stats);write('world-stats.json',worldStats);
    console.log('loaded',JSON.stringify(loaded),'elapsed',Math.round((Date.now()-t0)/1000),'s');
    const rows=[];
    for(const v of poses){
      const capturedAt=new Date().toISOString(),tf=Date.now();
      const pose=await page.evaluate(({v,traffic})=>{
        const g=window.game,S=window.vqa.S,p=g.city.proj(v.lat,v.lon),cam=g.camera;
        if(g.player?.rig)g.player.rig.visible=false;
        if(traffic){g.player.place(p.x,p.z,0);g.traffic.setPlayer(g.player);for(let i=0;i<12;i++)g.traffic.update(1/30);g.traffic.peds?.writeMatrices?.();}
        g.scene.add(cam);g.world.camera=cam;
        const gy=g.world.groundAt?.(p.x,p.z)??0;
        cam.position.set(p.x,gy+v.h,p.z);cam.rotation.set(-Math.PI/2,0,0,'YXZ');cam.fov=v.fov;cam.aspect=1;
        const originalFar=cam.far;cam.far=Math.max(originalFar,v.h+200);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
        const fog=g.scene.fog;g.scene.fog=null;
        // First frame warms camera-distance culling/shadows; second records the settled frame.
        S.renderNow=true;let perf;try{
          g.drawFrame({mirror:false});g.renderer.info.reset();const t=performance.now();g.drawFrame({mirror:false});
          const s=g.r3d.stats||{};perf={drawCalls:s.drawCalls??g.renderer.info.render.calls,triangles:s.triangles??g.renderer.info.render.triangles,renderMs:performance.now()-t,quality:s.quality||'high'};
        }finally{S.renderNow=false;g.scene.fog=fog;cam.far=originalFar;cam.updateProjectionMatrix();}
        return {x:p.x,z:p.z,cameraBaseY:gy,cameraY:cam.position.y,perf,traffic:{enabled:traffic,visible:!!g.traffic?.group?.visible,vehicleCount:g.traffic?.vehicles?.length??null},renderer:{width:g.renderer.domElement.width,height:g.renderer.domElement.height,pixelRatio:g.renderer.getPixelRatio()},season:g.season?.id??g.season??'summer',weather:'clear',time:'day'};
      },{v,traffic});
      const image=`images/${v.id}.jpg`,thumbnail=`thumbs/${v.id}.jpg`;
      await page.screenshot({path:path.join(out,image),type:'jpeg',quality:88});
      const row={...v,...pose,capturedAt,gamePath:image,image,thumbnail,sha256:hash(fs.readFileSync(path.join(out,image))),width,height:width,captureWallMs:Date.now()-tf,dataset:'atlas'};
      rows.push(row);write('capture-progress.json',{startedAt,completed:rows.length,total:poses.length,elapsedSeconds:(Date.now()-t0)/1000,last:row.id});
      if(rows.length%10===0||rows.length===poses.length)console.log(`capture ${rows.length}/${poses.length} elapsed ${Math.round((Date.now()-t0)/1000)}s ${v.id}`);
    }
    const endedAt=new Date().toISOString();
    const report={startedAt,endedAt,elapsedSeconds:(Date.now()-t0)/1000,source:sourceIdentity.treeSha256,loaded,pageErrors:errors,consoleErrors,failedRequests,traffic,quality:'high',weather:'clear',season:'summer',time:'day',mirror:false,frameCounts:rows.length,coverageClaim:plan.coverage,scopeCounts:plan.counts};write('capture-report.json',report);
    const manifest={schemaVersion:1,title:`${district} aerial comparisons`,generatedDate:endedAt.slice(0,10),generatedAt:endedAt,defaultTile:plan.locations.find(l=>l.kind==='chapter-start')?.tileId||rows.find(r=>r.scope==='core-touches')?.id||rows[0].id,tileMetres:poses[0].size,orientation:'north-up',atlasScopeCounts:plan.counts,publishedBaseline:plan.gameSourceCommit,gameSourceCommit:plan.gameSourceCommit,capture:report,locations:plan.locations,coverage:plan.coverage,boundarySource:'boundary-source.json',items:rows};write('manifest.json',manifest);
    console.log('complete',JSON.stringify({frames:rows.length,elapsedSeconds:report.elapsedSeconds,pageErrors:errors.length,consoleErrors:consoleErrors.length,source:plan.gameSourceCommit}));
    if(errors.length||consoleErrors.length)process.exitCode=1;
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
