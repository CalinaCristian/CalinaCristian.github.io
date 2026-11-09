// A separate fresh app context using its untouched native requestAnimationFrame
// loop. No activity/input/controller/performance wrappers or scene aliases.
module.exports=async({page,context,out,save,report,persist})=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const base=new URL('/game/',page.url()).href,browser=context.browser();await context.close();
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),p=await ctx.newPage();p.setDefaultTimeout(60000);
 const errors=[],consoleErrors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());for(const a of m.args())a.dispose().catch(()=>{});});
 await p.route('**/api.open-meteo.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:20,weather_code:0,is_day:1,wind_speed_10m:0,wind_direction_10m:0,relative_humidity_2m:50,cloud_cover:0,precipitation:0},hourly:{time:[]}})}));
 let result;
 try{
  await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.game?.r3d);await p.selectOption('#quality','auto');
  const d=p.locator('#spot-select');if(!await d.evaluate(el=>el.open))await d.locator(':scope > summary').click();const parks=d.locator('.spot-parks');if(await parks.count()&&!await parks.evaluate(el=>el.open))await parks.locator(':scope > summary').click();await p.locator('[data-spot="cismigiu"]').first().click();await p.waitForFunction(()=>game.state==='spot'&&game.spot?.spot?.ctx?.extras?.backgammon&&document.body.dataset.mode==='spot');
  const before=await p.evaluate(()=>{const S=game.spot,B=S.spot.ctx.extras.backgammon;window.__naturalBgWeak={board:new WeakRef(S.spot.scene.getObjectByName('cismigiu-backgammon')),checkers:new WeakRef(B.checkers),elder:new WeakRef(S.spot.scene.getObjectByName('Doru-fictional-park-regular'))};return{state:game.state,bodyMode:document.body.dataset.mode,modal:document.body.classList.contains('ui-modal'),population:S.spot.crowd?.peds?.length,checkers:B.checkers.count,quality:{...game.r3d.stats},memory:{...game.renderer.info.memory},loopSource:game.loop.toString()};});
  await p.screenshot({path:path.join(out,'natural-phone-public-spawn.png')});await p.keyboard.press('Escape');await p.waitForSelector('#pause-menu.show');await p.locator('#pause-menu [data-pa="leave-spot"]').click();await p.waitForFunction(()=>game.state==='menu'&&!game.spot);
  await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  const cdp=await ctx.newCDPSession(p);await cdp.send('HeapProfiler.collectGarbage');
  const after=await p.evaluate(()=>({state:game.state,spot:!!game.spot,ui:!!document.querySelector('.bg-game'),bodyMode:document.body.dataset.mode,refs:Object.fromEntries(Object.entries(__naturalBgWeak).map(([k,w])=>[k,!!w.deref()])),renderer:{sceneNull:game.r3d.scene===null,playerNull:game.r3d.player===null,sourceBackdrops:game.r3d._sourceBackdrops.length},memory:{...game.renderer.info.memory}}));
  result={scope:'Fresh natural-RAF app context, no stopped/wrapped loop/controller or retained scene/debug aliases. Only3WeakRefs created in one job. Actual public menu entry/Escape/visible Leave, next macrotask then one standard CDP GC.',before,after,errors,consoleErrors,passed:Object.values(after.refs).every(x=>!x)&&after.renderer.sceneNull&&after.renderer.playerNull};
  const file=save('natural-phone-menu-lifecycle',result);await p.screenshot({path:path.join(out,'natural-phone-returned-menu.png')});
  if(!result.passed){
   // Parent explicitly authorized one separate LOCAL-ONLY retaining-path heap.
   // It is not published/committed: browser heaps may contain private data.
   const heap=path.join(out,'private-natural-retention.heapsnapshot'),stream=fs.createWriteStream(heap);cdp.on('HeapProfiler.addHeapSnapshotChunk',({chunk})=>stream.write(chunk));await cdp.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});await new Promise(r=>stream.end(r));const b=fs.readFileSync(heap);result.localHeap={path:heap,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),scope:'Private local-only diagnostic after the original negative one-GC readback; not additional acceptance evidence'};
  }
  await cdp.detach();report.events.push({action:'natural-lifecycle',file,result,utc:new Date().toISOString()});persist();return{file,...result};
 }finally{await ctx.close();}
};
