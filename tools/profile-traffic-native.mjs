// Bounded V8 sampling of the actual unmodified RAF host. Source files are read
// from one immutable Git commit. No manual physics ticks or actor thinning.
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
const root=path.resolve(new URL('../',import.meta.url).pathname),out=process.argv[2]||'/tmp/native-traffic-profile';
const source=process.argv[3]||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(!/^[a-f\d]{40}$/.test(source))throw Error('Full source commit required');
execFileSync('git',['rev-parse','--verify',`${source}^{commit}`],{cwd:root,stdio:'pipe'});
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),cache=new Map(),served=[],errors=[],httpErrors=[];
const report={sourceCommit:source,scope:'Actual normal RAF at public Grozavesti spawn, same evolving traffic, V8 sample attribution. Software renderer/scheduler observations are not hardware FPS or a driven/body-clearance acceptance.',started:new Date().toISOString(),phases:[],errors,httpErrors,served};
const save=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const server=createServer((req,res)=>{
 let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');if(file.endsWith('/'))file+='index.html';if(file==='favicon.ico')file='public/favicon.ico';
 try{
  if(!(file.startsWith('game/')||file.startsWith('public/'))||file.includes('..'))throw Error('Not a public runtime file');
  if(!cache.has(file)){const b=execFileSync('git',['show',`${source}:${file}`],{cwd:root,maxBuffer:40*1024*1024,stdio:['ignore','pipe','ignore']});cache.set(file,b);served.push({path:file,sha256:hash(b),bytes:b.length});}
  const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(cache.get(file));
 }catch(e){httpErrors.push({file,error:String(e)});res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const{chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"error":true,"reason":"profile uses explicit clear preset"}'}));
const state=()=>page.evaluate(()=>{const g=game,t=g.traffic;return{state:g.state,quality:g.r3d.quality,stats:{...g.r3d.stats},nativeFrame:t?._frame,trafficTime:t?.time,updateMs:t?.stats?.updateMs,active:t?.vehicles.length,pool:t?.pool.length,peds:t?.peds?.list.length,ids:t?.vehicles.map(v=>v.id),player:g.player&&{x:g.player.x,y:g.player.y,z:g.player.z,speed:g.player.speed},date:g.r3d.simDate?.toISOString(),initialAdmissionPassed:t?.initialAdmission?.passed};});
function reduce(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of profile.nodes)for(const id of n.children||[])parent.set(id,n.id);
 const rows=new Map();let elapsedUs=0;
 for(let i=0;i<(profile.samples||[]).length;i++){
  const dt=profile.timeDeltas?.[i]||0;elapsedUs+=dt;let id=profile.samples[i],depth=0;const seen=new Set();
  while(id&&depth++<200){const n=nodes.get(id);if(!n)break;const f=n.callFrame;if(f.url.includes('/game/src/')){
   const key=f.url.split('/game/src/')[1]+':'+(f.lineNumber+1)+':'+f.functionName;
   if(!rows.has(key))rows.set(key,{function:f.functionName,file:f.url.split('/game/src/')[1],line:f.lineNumber+1,selfUs:0,inclusiveUs:0});
   const row=rows.get(key);if(depth===1)row.selfUs+=dt;if(!seen.has(key)){row.inclusiveUs+=dt;seen.add(key);}
  }id=parent.get(id);}
 }
 return{sampledElapsedUs:elapsedUs,samples:profile.samples?.length||0,topGameSelf:[...rows.values()].sort((a,b)=>b.selfUs-a.selfUs).slice(0,35),topTrafficInclusive:[...rows.values()].filter(r=>r.file==='traffic.js').sort((a,b)=>b.inclusiveUs-a.inclusiveUs).slice(0,25)};
}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/game/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.game?.r3d);
 await page.selectOption('#quality','high');
 await page.evaluate(async()=>{game.audio?.setMuted?.(true);const ok=await game.startFreeRoam('grozavesti',{tod:'noon',weather:'clear',season:'summer'});if(ok===false||game.state!=='drive')throw Error('Public district entry failed');});
 await page.keyboard.down('Space');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
 for(const quality of['high','ultra']){
  if(quality==='ultra'){
   await page.keyboard.up('Space');await page.locator('#pause-btn').click();
   await page.locator('[data-pa="settings"]').click();await page.locator('[data-set="quality"]').selectOption(quality);
   await page.locator('[data-pa="resume"]').click();await page.keyboard.down('Space');
  }
  const warmFrame=(await state()).nativeFrame;
  await page.waitForFunction(n=>game.traffic._frame>=n+3,warmFrame,{timeout:120000});
  const before=await state();await cdp.send('Profiler.start');await page.waitForTimeout(12000);const{profile}=await cdp.send('Profiler.stop');const after=await state();
  await writeFile(path.join(out,`${quality}-v8-profile.json.gz`),gzipSync(JSON.stringify(profile),{level:6}));
  report.phases.push({quality,before,after,profile:reduce(profile)});await save();console.log(JSON.stringify({phase:quality,nativeFrames:after.nativeFrame-before.nativeFrame,active:after.active,top:report.phases.at(-1).profile.topTrafficInclusive.slice(0,6)}));
 }
 await page.keyboard.up('Space');report.complete=true;
}catch(e){report.failure=String(e.stack||e);throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));report.closed=new Date().toISOString();report.executedToolSHA256=hash(await readFile(new URL(import.meta.url)));await save();console.log(JSON.stringify({complete:!!report.complete,source,errors,httpErrors,phases:report.phases.length}));}
