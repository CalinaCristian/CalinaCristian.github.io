// Real-browser lifecycle regression. Usage: node game/dev/harness/district-transitions.cjs ROOT OUT.json [high|auto] [chromium|webkit]
// Integration variant: two cycles Floreasca ↔ Grozăvești/Pipera/SeaTac/Bellevue; actual resource counters, retired-world weakrefs and failed-load Continue.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium, webkit } = require('playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const out = path.resolve(process.argv[3] || '/tmp/district-transitions.json');
const quality = process.argv[4] || 'auto';
fs.mkdirSync(path.dirname(out), { recursive: true });
const browserKind = process.argv[5] || 'chromium';
const bridgeDump = process.env.BRIDGE_DUMP_PAYLOAD ? require(path.resolve(process.env.BRIDGE_DUMP_PAYLOAD)) : null;
const mime = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
const server = http.createServer((q,r)=> {let p=decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/'))p+='index.html'; const f=path.join(root,p); fs.readFile(f,(e,b)=> {r.writeHead(e?404:200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(e?'missing':b);});});
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 const result={root,quality,browserKind,checksEnabled:!!process.env.PROBE_CHECKS,errors:[],consoleErrors:[],lost:[],navigations:[],stages:[],fetchStages:[]};
 try{
 browser = await (browserKind==='webkit'?webkit:chromium).launch({headless:true,...(browserKind==='chromium'?{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--mute-audio','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--js-flags=--expose-gc','--enable-precise-memory-info']}:{})});
 const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();require('./integration-browser-bounds.cjs').boundEvaluations(page);
 const cdp=browserKind==='chromium'?await context.newCDPSession(page):null;
 if (cdp && process.env.PROBE_CPU_RATE) await cdp.send('Emulation.setCPUThrottlingRate',{rate:+process.env.PROBE_CPU_RATE});
 page.on('pageerror',e=>result.errors.push(e.message)); page.on('crash',()=>result.errors.push('PAGE_CRASH'));
 page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());for(const argument of m.args())argument.dispose().catch(()=>{});});
 page.on('framenavigated',f=>{if(f===page.mainFrame())result.navigations.push(f.url())});
 await page.addInitScript(()=>{
  window.__generation=(+(sessionStorage.__probeGeneration||0))+1;sessionStorage.__probeGeneration=window.__generation;
  window.__contextEvents=[];window.addEventListener('webglcontextlost',e=>window.__contextEvents.push({type:e.type,t:performance.now()}),true);window.addEventListener('webglcontextrestored',e=>window.__contextEvents.push({type:e.type,t:performance.now()}),true);
  const gls=[];window.__gls=gls;
  const proto=WebGL2RenderingContext.prototype;
  const live={textures:0,buffers:0,framebuffers:0,renderbuffers:0,bufferBytes:0,peakBufferBytes:0,peakTextures:0};window.__glLive=live;
  const sizes=new WeakMap();
  for(const [one,many] of [['Texture','textures'],['Buffer','buffers'],['Framebuffer','framebuffers'],['Renderbuffer','renderbuffers']]){
   const create=proto['create'+one],del=proto['delete'+one];
   proto['create'+one]=function(...a){const o=create.apply(this,a);if(o){sizes.set(o,0);live[many]++;if(many==='textures')live.peakTextures=Math.max(live.peakTextures,live[many]);}return o};
   proto['delete'+one]=function(o){if(o&&sizes.has(o)){live[many]--;if(one==='Buffer')live.bufferBytes-=sizes.get(o);sizes.delete(o)}return del.call(this,o)};
  }
  const bind=proto.bindBuffer,allocate=proto.bufferData;const bound=new Map();
  proto.bindBuffer=function(t,b){bound.set(t,b);return bind.call(this,t,b)};
  proto.bufferData=function(t,d,...a){const b=bound.get(t),n=typeof d==='number'?d:(d?.byteLength||0);if(b&&sizes.has(b)){live.bufferBytes+=n-sizes.get(b);sizes.set(b,n);live.peakBufferBytes=Math.max(live.peakBufferBytes,live.bufferBytes)}return allocate.call(this,t,d,...a)};
 });
 await page.route('**/api.open-meteo.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:20,weather_code:0,is_day:1,wind_speed_10m:0,wind_direction_10m:0,relative_humidity_2m:50,cloud_cover:0,precipitation:0},hourly:{time:[]}})}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/game/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.game?.r3d,null,{timeout:90000});
 await page.evaluate(q=>{const g=game;g.loop=()=>{};g.r3d.setQuality(q);g.quality=q;g.opts.quality=q;window.__retiredWorlds=[];const load=g.loadCity;g.loadCity=function(...args){if(this.world)window.__retiredWorlds.push({district:this.district,ref:new WeakRef(this.world)});return load.apply(this,args)};window.__fetchStages=[];const orig=window.fetch;window.fetch=function(...a){if(/data\/(bucharest|seattle)-.*\.json/.test(String(a[0]))){window.__fetchStages.push({url:String(a[0]),oldWorld:g.world?.district?.id||null,navWorld:g.nav?.world?.district?.id||null,trafficWorld:g.traffic?.world?.district?.id||null,playerWorld:g.player?.world?.district?.id||null,rendererScene:g.r3d.scene===g.scene,rendererMemory:{...g.renderer.info.memory},gl:{...window.__glLive},heap:performance.memory?.usedJSHeapSize})}return orig.apply(this,a)}} ,quality);
 const cycles=process.env.PROBE_CYCLES?+process.env.PROBE_CYCLES:2;
 const cycle=['grozavesti','floreasca','pipera','floreasca','seatac','bellevue','floreasca'];
 const sequence=['floreasca',...Array.from({length:cycles},()=>cycle).flat()];result.sequence=sequence;
 for(const district of sequence){
  const t=Date.now();
  const stage=await page.evaluate(async({district,quality})=>{
   const g=game; const started=performance.now();
   await g.startFreeRoam(district,{tod:'noon',weather:'clear',season:'summer'});
   g.r3d.setQuality(quality);
   for(let i=0;i<3;i++){g.r3d.frame(1/60);g.player.renderMirror(g.renderer,g.scene)}
   if(window.gc)window.gc();
   let materials=new Set(),textures=new Set(),geometry=new Set(),arrayBytes=0,arrays=new Set(),instances=0;
   g.scene.traverse(o=>{if(o.geometry){geometry.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){if(a.array&&!arrays.has(a.array)){arrays.add(a.array);arrayBytes+=a.array.byteLength}}}if(o.isInstancedMesh){instances++;for(const a of [o.instanceMatrix,o.instanceColor])if(a?.array&&!arrays.has(a.array)){arrays.add(a.array);arrayBytes+=a.array.byteLength}}for(const m of (!o.material?[]:Array.isArray(o.material)?o.material:[o.material])){materials.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t)}});
   const gl=g.renderer.getContext();
   return {district,ms:performance.now()-started,generation:window.__generation,state:g.state,dpr:devicePixelRatio,pixelRatio:g.renderer.getPixelRatio(),quality:g.r3d.stats.quality,stats:{...g.r3d.stats},rendererMemory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,gl:{...window.__glLive},heap:performance.memory?.usedJSHeapSize,scene:{materials:materials.size,textures:textures.size,geometry:geometry.size,arrayBytes,instances},contextLost:gl.isContextLost(),contextEvents:window.__contextEvents.slice(),savedDistrict:g.save?.session?.district};
  },{district,quality});
  if(cdp){await cdp.send('Runtime.discardConsoleEntries');await cdp.send('HeapProfiler.collectGarbage');stage.collectedHeap=await cdp.send('Runtime.getHeapUsage');stage.retiredWorlds=await page.evaluate(()=>window.__retiredWorlds.map(w=>({district:w.district,alive:!!w.ref.deref()})));}
  if(bridgeDump&&['pipera','bellevue'].includes(district)&&!result.bridgeDumps?.[district]){
   const dump=await page.evaluate(bridgeDump),file=out.replace(/\.json$/,'.bridge-'+district+'.json');
   fs.writeFileSync(file,JSON.stringify(dump,null,2));result.bridgeDumps||={};result.bridgeDumps[district]={file,recomputedStatsMatchNative:dump.recomputedStatsMatchNative,unresolvedPairs:dump.unresolvedPairs.length};
   if(!dump.recomputedStatsMatchNative)throw Error('Read-only bridge profile dump differs from the actual native world');
  }
  result.stages.push(stage);console.log(district,Date.now()-t,JSON.stringify({memory:stage.rendererMemory,gl:stage.gl,heap:stage.heap,calls:stage.stats.drawCalls,tris:stage.stats.triangles}));
  fs.writeFileSync(out,JSON.stringify(result,null,2));
 }
 if(cycles>=2){
  const previous=result.stages[result.stages.length-1-cycle.length],last=result.stages.at(-1);
  result.retention={textureDelta:last.rendererMemory.textures-previous.rendererMemory.textures,bufferDelta:last.gl.buffers-previous.gl.buffers,geometryDelta:last.rendererMemory.geometries-previous.rendererMemory.geometries};
  if(process.env.PROBE_CHECKS&&(result.retention.textureDelta>1||result.retention.bufferDelta>48))throw Error('District resources accumulated across a repeated cycle: '+JSON.stringify(result.retention));
 }
 if(process.env.PROBE_CHECKS){
  result.resourceOwnership=await page.evaluate(async()=>{
   const THREE=await import('/game/vendor/three.module.min.js');
   const {disposeDistrictScene}=await import('/game/src/sceneResources.js');
   const scene=new THREE.Scene(),keep=new THREE.Group();scene.add(keep);
   const persistent=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());keep.add(persistent);
   const ownedTex=new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1),hiddenTex=new THREE.DataTexture(new Uint8Array([0,255,0,255]),1,1);
   const ownedMat=new THREE.MeshBasicMaterial({map:ownedTex});ownedMat.userData.ownedTextures=[hiddenTex];
   const ownedGeo=new THREE.BoxGeometry(),owned=new THREE.Mesh(ownedGeo,ownedMat);scene.add(owned);
   const base=new THREE.BoxGeometry(),wrapper=new THREE.BufferGeometry();for(const [k,v] of Object.entries(base.attributes))wrapper.setAttribute(k,v);wrapper.setIndex(base.index);
   wrapper.setAttribute('aPaint',new THREE.InstancedBufferAttribute(new Float32Array(3),3));
   const fleet=new THREE.InstancedMesh(wrapper,new THREE.MeshBasicMaterial(),1);fleet.userData.fleet=true;scene.add(fleet);
   const tree=new THREE.InstancedMesh(base,new THREE.MeshBasicMaterial(),1);tree.name='treeCrowns near test';scene.add(tree);
   const got={};for(const [name,o]of Object.entries({persistentGeo:persistent.geometry,persistentMat:persistent.material,base,ownedGeo,ownedMat,ownedTex,hiddenTex,wrapper,fleet,tree})){got[name]=0;o.addEventListener('dispose',()=>got[name]++)}
   disposeDistrictScene(scene,{retained:[keep]});
   return {...got,retainedDetached:keep.parent===null,sceneEmpty:scene.children.length===0,baseAttributes:base.attributes.position.count,wrapperOwnedOnly:Object.keys(wrapper.attributes).join(',')==='aPaint'};
  });
  const expected={persistentGeo:0,persistentMat:0,base:0,ownedGeo:1,ownedMat:1,ownedTex:1,hiddenTex:1,wrapper:1,fleet:1,tree:1};
  for(const [k,v] of Object.entries(expected))if(result.resourceOwnership[k]!==v)throw Error('Resource ownership check failed: '+k);
  if(!result.resourceOwnership.retainedDetached||!result.resourceOwnership.sceneEmpty||!result.resourceOwnership.wrapperOwnedOnly)throw Error('Resource detachment check failed');
  const asset='**/data/bucharest-grozavesti.json';let failedFetches=0;
  await page.route(asset,r=>{failedFetches++;return r.fulfill({status:200,contentType:'application/json',body:'{ invalid JSON'});});
  const injectedConsoleStart=result.consoleErrors.length;
  result.failedTravel=await page.evaluate(async()=>{
   const g=game;g.fuel=0;const before=g.save.capture();const ok=await g.startFreeRoam('grozavesti');
   return {ok,before,state:g.state,generation:window.__generation,loading:document.querySelector('#loading').classList.contains('show'),saved:g.save.session,continueVisible:!document.querySelector('#continue').hidden};
  });
  await page.unroute(asset);
  result.expectedConsoleErrors=result.consoleErrors.slice(injectedConsoleStart).map((text,index)=>({index:injectedConsoleStart+index,text,reason:'Explicit malformed destination JSON fixture'}));
  if(result.expectedConsoleErrors.length!==1||!result.expectedConsoleErrors.every(e=>e.text.startsWith('[world] district load failed')&&/JSON|SyntaxError|position|property/i.test(e.text)))throw Error('Malformed destination produced unexpected console errors');
  if(result.failedTravel.ok!==false||result.failedTravel.state!=='menu'||result.failedTravel.loading||!result.failedTravel.continueVisible||result.failedTravel.saved.district!==result.failedTravel.before.district||result.failedTravel.saved.fuel!==0||failedFetches!==1)throw Error('Failed travel did not preserve the stable session');
  result.continue=await page.evaluate(async()=>{const g=game,ok=await g.save.restore();g.r3d.frame(1/60);return{ok,state:g.state,district:g.district,fuel:g.fuel,x:g.player.x,z:g.player.z,generation:window.__generation}});
  if(!result.continue.ok||result.continue.district!==result.failedTravel.before.district||result.continue.fuel!==0||result.continue.generation!==result.failedTravel.generation)throw Error('Continue failed after rejected destination');
  result.qualityRelease=await page.evaluate(()=>{
   const g=game;g.r3d.setQuality('high');g.r3d.frame(1/60);const high={...g.renderer.info.memory};
   g.r3d.setQuality('auto');g.r3d.frame(1/60);
   return{high,auto:{...g.renderer.info.memory},tier:g.r3d.tier.name,bloomReleased:g.r3d.bloomPass===null,smaaReleased:g.r3d.smaaPass===null,shadowReleased:g.r3d.sun.shadow.map===null,lamps:g.r3d._lampSlots.length,gl:{...window.__glLive}};
  });
  if(!result.qualityRelease.bloomReleased||!result.qualityRelease.smaaReleased||!result.qualityRelease.shadowReleased)throw Error('Inactive quality targets were retained');
 }
 result.fetchStages=await page.evaluate(()=>window.__fetchStages);result.lost=await page.evaluate(()=>window.__contextEvents);
 if(process.env.PROBE_CHECKS&&result.fetchStages.some(s=>s.oldWorld||s.navWorld||s.trafficWorld||s.playerWorld))throw Error('An outgoing world was retained at replacement fetch');
 if(cdp){await cdp.send('Runtime.discardConsoleEntries');await cdp.send('HeapProfiler.collectGarbage');result.retiredWorlds=await page.evaluate(()=>window.__retiredWorlds.map(w=>({district:w.district,alive:!!w.ref.deref()})));}
 if(process.env.PROBE_CHECKS&&result.retiredWorlds?.some(w=>w.alive))throw Error('A retired district remained reachable after garbage collection');
 await page.evaluate(()=>game.r3d.frame(1/60));
 await require('./integration-browser-bounds.cjs').captureViewport(page,out.replace(/\.json$/,'.png'));
 const expectedConsoleIndices=new Set((result.expectedConsoleErrors||[]).map(e=>e.index));
 result.unexpectedConsoleErrors=result.consoleErrors.filter((_,index)=>!expectedConsoleIndices.has(index));
 if(result.errors.length||result.lost.length||result.unexpectedConsoleErrors.length)throw Error('Browser error, unexpected console error or WebGL context loss');
 result.complete=true;
 }catch(e){result.fatal=String(e.stack||e);console.error(result.fatal);process.exitCode=1}finally{result.complete??=false;fs.writeFileSync(out,JSON.stringify(result,null,2));await browser?.close();server.close()}
}
run();
