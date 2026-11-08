// Exact native-versus-progressive HDR atlases, real high-quality frame budgets and pending-map cleanup.
// Usage: node pmrem-check.cjs ROOT OUT (optional PMREM_CASE selects one named condition or resources-only)
const fs=require('fs'),http=require('http'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../..')),out=path.resolve(process.argv[3]||'/tmp/pmrem-check'),mode=process.argv[4]||'keyboard',mobile=mode==='touch',quality='high';fs.mkdirSync(out,{recursive:true});
(async()=>{const server=http.createServer((q,r)=>{let uri=decodeURIComponent(q.url.split('?')[0]);if(uri.endsWith('/'))uri+='index.html';const f=path.join(root,uri);fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':f.endsWith('.css')?'text/css':'text/html'});r.end(e?'':b)});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await require('playwright').chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(mobile?{viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720}}),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('PAGE_CRASH'));await page.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
await page.addInitScript(()=>{window.trace={calls:{},times:{},long:[],lost:[],maxGap:0,previous:performance.now()};for(const proto of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype])for(const method of ['createProgram','linkProgram','compileShader','createTexture','createFramebuffer','createRenderbuffer','texImage2D','renderbufferStorage','getProgramParameter']){const fn=proto[method];if(!fn)continue;proto[method]=function(...args){const t=performance.now(),result=fn.apply(this,args);trace.calls[method]=(trace.calls[method]||0)+1;trace.times[method]=(trace.times[method]||0)+performance.now()-t;return result;};}new PerformanceObserver(list=>{for(const e of list.getEntries())trace.long.push({duration:e.duration,start:e.startTime})}).observe({type:'longtask',buffered:true});setInterval(()=>{const now=performance.now();trace.maxGap=Math.max(trace.maxGap,now-trace.previous);trace.previous=now},10);addEventListener('webglcontextlost',e=>trace.lost.push({type:e.type,t:performance.now()}),true);addEventListener('webglcontextrestored',e=>trace.lost.push({type:e.type,t:performance.now()}),true);});
await page.goto(`http://127.0.0.1:${server.address().port}/game/`);await page.waitForFunction(()=>window.game);await page.evaluate(()=>{game.r3d.setQuality('low');game.quality='high';game.audio?.setMuted?.(true)});await page.addScriptTag({type:'module',url:`http://127.0.0.1:${server.address().port}/game/dev/harness/page/index.js`});await page.waitForFunction(()=>window.harness);await page.evaluate(async quality=>{game.started=true;document.querySelector('#menu').classList.remove('show');document.querySelector('#hud').classList.add('show');document.body.classList.add('playing');await game.enterChapter(game.chapters.findIndex(c=>c.id==='arnia'),{initial:true});game.r3d.setQuality(quality);game.quality=quality;game.traffic.setHour(8,true);game.clock.override='day';game.updateClock(0);game.setWeatherOverride('clear');game.headlights=false;game._hlSent=false;game.r3d.setHeadlights(false);game.input.lookAllowed=true;game.player.mirrorEnabled=true;document.body.dataset.mode=game.state;game.syncModalControls?.();},quality);

await page.evaluate(()=>{
 const r=game.renderer,frame=game.r3d.frame.bind(game.r3d),fade=game.r3d._stepEnvFade.bind(game.r3d);
 window.proof={draws:[],step:0};
 const direct=r.renderBufferDirect.bind(r);
 r.renderBufferDirect=function(...args){const before={...r.info.render};direct(...args);const calls=r.info.render.calls-before.calls,triangles=r.info.render.triangles-before.triangles;if(calls)proof.draws.push({calls,triangles,material:args[3].name||args[3].type});};
 game.r3d.frame=()=>{game.r3d.time=100;frame(0)};
 game.r3d._stepEnvFade=dt=>fade(dt || 1/15);
 game.r3d._envT=Infinity;
 proof.read=rt=>{const previous=r.getRenderTarget(),face=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel(),gl=r.getContext(),data=new Float32Array(rt.width*rt.height*4);r.setRenderTarget(rt);gl.readPixels(0,0,rt.width,rt.height,gl.RGBA,gl.FLOAT,data);const error=gl.getError();r.setRenderTarget(previous,face,mip);if(error)throw Error('Float HDR read failed: '+error);return data;};
});
// Isolated slices are explicit atlas-reference work, not presented as complete game frames. Counters are never reset here.
async function frame(full=true){return page.evaluate(full=>{proof.draws=[];const before={...game.renderer.info.render};harness.H._renderNow=true;if(full){if(game.state==='spot')game.r3d.frame();else game.drawFrame({mirror:true});}else game.r3d._stepEnvJob();harness.H._renderNow=false;const logical=proof.draws.reduce((a,d)=>({calls:a.calls+d.calls,triangles:a.triangles+d.triangles}),{calls:0,triangles:0});return{state:game.state,spotId:game.spotId,population:{vehicles:game.traffic?.vehicles.length,people:game.traffic?.peds.list.length},kind:full?'complete-frame':'isolated-bake-slice',before,after:{...game.renderer.info.render},stats:{...game.r3d.stats},logical,draws:proof.draws,pending:!!game.r3d._envJob,fade:game.r3d._envFade,env:game.r3d._envB.texture.uuid,water:game.r3d._waterEnv.texture.uuid};},full);}
const completeSlices=new Set([0,1,2,3,4,5,6,17,20,23,34]);
async function finishJob(sparse=false){const rows=[];for(let i=0;i<40;i++){const row=await frame(sparse?new Set([0,6,17,34]).has(i):completeSlices.has(i));rows.push(row);if(!row.pending)break;}await page.evaluate(()=>game.r3d._stepEnvFade(2));rows.push(await frame());return rows;}
const requested=process.env.PMREM_CASE||'';if(requested&&!['arnia-day','arnia-night-rain','seattle-center-day-rain','resources-only'].includes(requested))throw Error('Unknown PMREM_CASE');
const results=[];
for(const [label,night,weather,spot] of [['arnia-day',false,'clear',false],['arnia-night-rain',true,'rain',false],['seattle-center-day-rain',false,'rain',true]].filter(row=>!process.env.PMREM_CASE||row[0]===process.env.PMREM_CASE)){
 if(spot)await page.evaluate(async()=>{await game.enterSpot('space-needle');if(game.state!=='spot'||game.spotId!=='space-needle')throw Error('Space Needle spot did not open');});
 await page.evaluate(({night,weather})=>{const r=game.r3d;game.clock.override=night?'night':'day';r.setClock({override:night?'night':'day'});r.setWeather(weather,{instant:true});r._envT=Infinity;}, {night,weather});
 await page.evaluate(()=>{const r=game.r3d;r._updateNight(2);r.camera.getWorldPosition(r._tmp.cam);for(let i=0;i<10;i++)r._updateLamps(r._tmp.cam,0.25);});
 await frame();
 await page.evaluate(()=>{const r=game.r3d;r._buildEnvMap(true);proof.native=[proof.read(r._envB),proof.read(r._waterEnv)];});
 const native=await frame();
 await page.screenshot({path:path.join(out,label+'-native.png'),timeout:120000});
 await page.evaluate(()=>{const r=game.r3d;r._buildEnvMap(false);proof.retained={env:r._envB.texture.uuid,water:r._waterEnv.texture.uuid};});
 const rows=await finishJob();
 const comparison=await page.evaluate(()=>{const r=game.r3d,now=[proof.read(r._envB),proof.read(r._waterEnv)];return now.map((data,i)=>{let differentValues=0,maxDifference=0,nonfinite=0;for(let j=0;j<data.length;j++){if(!Number.isFinite(data[j]))nonfinite++;const delta=Math.abs(data[j]-proof.native[i][j]);if(delta)differentValues++;maxDifference=Math.max(maxDifference,delta);}return{kind:i?'water':'main',differentValues,maxDifference,nonfinite,values:data.length};});});
 await page.screenshot({path:path.join(out,label+'-progressive.png'),timeout:120000});
 const result={label,native,rows,comparison};results.push(result);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({root,results,errors},null,2));
 console.log(JSON.stringify({label,frames:rows.length,peak:Math.max(...rows.map(r=>r.logical.calls)),triangles:Math.max(...rows.map(r=>r.logical.triangles)),comparison}));
}
const automatic=[];
for(const trigger of ['sun','cloud']){
 await page.evaluate(trigger=>{const r=game.r3d;r._envT=0;if(trigger==='sun')r._envEl=r.sunElevation-4;else r._envCloud=r._wx.cloud-0.3;},trigger);
 const rows=await finishJob(true);
 automatic.push({trigger,rows});console.log(JSON.stringify({trigger,frames:rows.length,firstPending:rows[0].pending,peak:Math.max(...rows.map(r=>r.logical.calls))}));
}
// A pending job must survive a quality change, and be cancelled when an actual scene is replaced.
await page.evaluate(()=>{game.leaveSpot();game.clock.override='day';game.updateClock(0);game.r3d._envT=Infinity;});await frame();
await page.evaluate(()=>{game.r3d._buildEnvMap(false)});await frame();
await page.evaluate(()=>{const r=game.r3d,j=r._envJob;proof.cancel={target:0,skyMaterial:0,groundGeometry:0,blocksMaterial:0};j.task.target.addEventListener('dispose',()=>proof.cancel.target++);j.dome.material.addEventListener('dispose',()=>proof.cancel.skyMaterial++);j.ground.geometry.addEventListener('dispose',()=>proof.cancel.groundGeometry++);j.blocks.addEventListener('dispose',()=>proof.cancel.blocksMaterial++);r.setQuality('medium');});await frame();
const qualityProbe=await page.evaluate(()=>({pending:!!game.r3d._envJob,disposed:{...proof.cancel}}));
await page.evaluate(async()=>{await game.enterSpot('space-needle');if(game.state!=='spot'||game.spotId!=='space-needle')throw Error('Space Needle spot did not open');});
const cancellation=await page.evaluate(()=>({pending:!!game.r3d._envJob,disposed:{...proof.cancel},environment:!!game.r3d.scene.environment,water:!!game.r3d._waterEnv}));
const fallback=await page.evaluate(()=>{const r=game.r3d,pmrem=r._pmrem;r._pmrem={fromScene:pmrem.fromScene.bind(pmrem)};try{r._buildEnvMap(false);return{pending:!!r._envJob,environment:!!r.scene.environment,water:!!r._waterEnv};}finally{r._pmrem=pmrem;}});
await page.evaluate(()=>game.r3d._buildEnvMap(false));
const waterRows=[];for(let i=0;i<30;i++){waterRows.push(await frame(i===0));if(await page.evaluate(()=>!!game.r3d._envJob?.rt))break;}
const waterCancellation=await page.evaluate(()=>{const r=game.r3d,j=r._envJob;const disposed={main:0,water:0};j.rt.addEventListener('dispose',()=>disposed.main++);j.task.target.addEventListener('dispose',()=>disposed.water++);r.dispose();return{pending:!!r._envJob,disposed};});
waterCancellation.rows=waterRows;
const source=Object.fromEntries(['game/src/progressive-pmrem.js','game/src/render.js','game/src/vehicles.js','game/src/traffic.js','game/src/main.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({root,source,results,automatic,quality:qualityProbe,cancellation,fallback,waterCancellation,errors},null,2));
await browser.close();server.close();
assert.deepEqual(errors,[]);assert.equal(results.length,requested==='resources-only'?0:requested?1:3);
for(const result of results){for(const cmp of result.comparison){assert.equal(cmp.nonfinite,0);assert.equal(cmp.differentValues,0,`${result.label} ${cmp.kind} atlas differs`);}assert.equal(result.rows.at(-1).pending,false);assert.equal(result.rows.at(-1).fade,1);for(const row of result.rows){assert.ok(row.logical.calls<=400,`${result.label} ${row.logical.calls} calls`);assert.ok(row.logical.triangles<=1500000);if(row.kind==='complete-frame'){assert.equal(row.stats.drawCalls,row.before.calls+row.logical.calls);assert.equal(row.stats.triangles,row.before.triangles+row.logical.triangles);}else{assert.equal(row.after.calls,row.before.calls+row.logical.calls);assert.equal(row.after.triangles,row.before.triangles+row.logical.triangles);}if(row.pending){assert.equal(row.env,result.native.env);assert.equal(row.water,result.native.water);}}}
for(const run of automatic){assert.equal(run.rows[0].pending,true);assert.equal(run.rows.at(-1).pending,false);for(const row of run.rows){assert.ok(row.logical.calls<=400);assert.ok(row.logical.triangles<=1500000);}}assert.equal(waterCancellation.pending,false);assert.deepEqual(waterCancellation.disposed,{main:1,water:1});assert.equal(qualityProbe.pending,true);assert.deepEqual(Object.values(qualityProbe.disposed),[0,0,0,0]);assert.equal(cancellation.pending,false);assert.deepEqual(Object.values(cancellation.disposed),[1,1,1,1]);assert.equal(cancellation.environment,true);assert.equal(cancellation.water,true);assert.equal(fallback.pending,false);assert.equal(fallback.environment,true);assert.equal(fallback.water,true);
console.log(`PASS: ${results.length} native HDR conditions; full logical-frame budgets, retained maps, quality/cancellation and native fallback.`);
})().catch(e=>{console.error(e);process.exit(1)});
