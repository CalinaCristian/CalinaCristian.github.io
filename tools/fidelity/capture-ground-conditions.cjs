// Real production renders from immutable source; fixed walking-height fixtures,
// not route/activity-completion or hardware-FPS evidence. No reference pixels.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),readline=require('node:readline'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
if(process.stdin.isTTY)execFileSync('stty',['-icanon','-echo'],{stdio:[0,'ignore','ignore']});
const arg=k=>process.argv.find(s=>s.startsWith('--'+k+'='))?.slice(k.length+3);
const root=path.resolve(arg('root')),out=path.resolve(arg('out')),source=arg('source');
if(!/^[a-f0-9]{40}$/.test(source||''))throw Error('An exact source commit is required');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const p of ['game/src/main.js','game/src/render.js','game/src/world.js','game/src/spots/index.js','game/src/weather.js']){const b=fs.readFileSync(path.join(root,p));if(!b.equals(execFileSync('git',['show',source+':'+p],{cwd:root,maxBuffer:b.length+65536})))throw Error('Source mismatch '+p);}
fs.mkdirSync(out,{recursive:true});fs.copyFileSync(__filename,path.join(out,'observer.cjs'));
const report={schemaVersion:1,sourceCommit:source,toolSHA256:hash(fs.readFileSync(__filename)),started:new Date().toISOString(),scope:'Production app and renderer; fixed validated on-foot camera fixtures, controlled seasonal dates/weather/time, paused automatic RAF and explicit rendering. No route, activity completion, live weather or hardware-FPS claim.',loads:[],captures:[],errors:[],commands:[],served:{}};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const note=(event,data={})=>{report.commands.push({event,at:new Date().toISOString(),...data});save();console.log(event,data.id||'',data.condition||'');};
let browser,page,server,current;
const conditions=[{id:'summer-day',label:'Summer · day',season:'summer',period:'day',hour:12,weather:'clear'},{id:'summer-night',label:'Summer · night',season:'summer',period:'night',hour:23,weather:'clear'},{id:'winter-day',label:'Winter · day',season:'winter',period:'day',hour:12,weather:'snow'},{id:'winter-night',label:'Winter · night',season:'winter',period:'night',hour:23,weather:'snow'}];
function dateAtLocal(condition,tz){const target=Date.UTC(2026,condition.season==='summer'?6:0,15,condition.hour);let d=new Date(target);for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(d),v=t=>+parts.find(p=>p.type===t).value;d=new Date(+d+target-Date.UTC(v('year'),v('month')-1,v('day'),v('hour'),v('minute'),v('second')));}return d.toISOString();}
async function load(c){
 current={kind:c.kind,id:c.id,poses:c.poses||[]};note('loading',c);
 const data=await page.evaluate(async c=>{
  const g=game;g._menuTod='day';g.weatherOverride='clear';g.r3d.setSeason('summer');g.r3d.setQuality('high');g.quality='high';g.r3d.auto=false;
  if(c.kind==='visit'){if(!await g.enterSpot(c.id))throw Error('Visit entry failed');const s=g.spot,S=s.spot;return{kind:c.kind,id:c.id,sceneId:S.data.id,clock:S.clock,spawn:S.spawn,origin:S.data.origin,projection:S.data.projection,challenges:S.challenges.map(a=>({...a,cond:undefined})),interactables:S.interactables.map(a=>({x:a.x,z:a.z,y:a.y,kind:a.kind,label:typeof a.label==='function'?a.label(s):a.label,source:a.source})),plaques:S.plaques.map(p=>({x:p.x,z:p.z,y:p.y,title:p.title})),extras:Object.keys(S.ctx.extras),caruselDoor:S.ctx.extras.caruselDoor,caruselStairs:S.ctx.extras.caruselStairs?{path:S.ctx.extras.caruselStairs.path,landings:S.ctx.extras.caruselStairs.landings}:null,sourceBuildings:S.data.buildings.filter(b=>b.name).map(b=>({id:b.id,name:b.name,poly:b.poly})).slice(0,80)};}
  if(!await g.startFreeRoam(c.id,{tod:'noon',weather:'clear',season:'summer'}))throw Error('District entry failed');
  if(!g.exitCar())throw Error('No production on-foot entry for '+c.id);
  const w=g.world;return{kind:c.kind,id:c.id,city:g.city.id,clock:{timeZone:g.clock.timeZone,lat:g.r3d.clock?.lat,lon:g.r3d.clock?.lon},spawn:{x:w.spawn?.x,z:w.spawn?.z,heading:w.spawn?.heading,y:w.spawn?.y},pois:w.pois.map(p=>({id:p.id,label:p.label||p.name,x:p.x,z:p.z,doorX:p.doorX,doorZ:p.doorZ})),landmarks:w.landmarks.map(p=>({id:p.id,label:p.label,x:p.x,z:p.z,radius:p.radius})),worldKeys:Object.keys(w)};
 },c);current.data=data;report.loads.push(data);save();fs.writeFileSync(path.join(out,c.id+'-probe.json'),JSON.stringify(data,null,2)+'\n');note('loaded',c);return data;
}
async function capture(c){
 if(!current)throw Error('Load a place first');const poses=c.poses||current.poses;if(!poses.length)throw Error('Provide ground viewpoints');
 const selected=c.conditions?conditions.filter(v=>c.conditions.includes(v.id)):conditions;
 for(const condition of selected){
  const tz=current.data.clock.timeZone,date=dateAtLocal(condition,tz);
  const observed=await page.evaluate(({condition,date,tz,kind})=>{
   const g=game,r=g.r3d;if(kind==='visit')g.spot.setConditions({date:new Date(date),timeScale:0,override:null,timeZone:tz,weather:condition.weather,season:condition.season});else{r.setClock({date:new Date(date),timeScale:0,override:null,timeZone:tz});r.setSeason(condition.season);r.setWeather(condition.weather,{instant:true});g.traffic.setHour(condition.hour,true);}
   r.frame(0);
   if(kind==='visit'){for(let i=0;i<32;i++)g.spot.update(.05);}else{g.traffic.setNightLights(r.nightLights);}
   return{date:r.simDate.toISOString(),timeZone:tz,season:r._seasonOverride,weather:r.weather,sunElevation:r.sunElevation,nightLights:r.nightLights,quality:r.stats.quality};
  },{condition,date,tz,kind:current.kind});
  if(observed.season!==condition.season||condition.period==='night'&&observed.sunElevation>-3||condition.period==='day'&&observed.sunElevation<3)throw Error('Condition did not apply '+JSON.stringify(observed));
  for(const pose of poses){
   const shot=await page.evaluate(async({pose,kind})=>{
    const g=game,s=kind==='visit'?g.spot:null,F=s?s.ctl:g.foot,cam=g.camera,r=g.r3d;
    if(s){for(const label of ['Return to the bookshop','Return to Smârdan']){const it=s.spot.interactables.find(i=>i.label===label);if(it&&(!it.cond||it.cond(s)))await it.use(s);}if(pose.enterLabel){const it=s.spot.interactables.find(i=>String(typeof i.label==='function'?i.label(s):i.label).startsWith(pose.enterLabel));if(!it)throw Error('No room entry '+pose.enterLabel);await it.use(s);}}
    const x=pose.x,z=pose.z,hint=pose.floorHint??(s?s.spot.ground.heightAt(x,z):g.world.roadHeight(x,z));
    const floor=F.groundAt(x,z,hint);
    if(!Number.isFinite(floor))throw Error('No supporting floor at '+pose.id);
    let blocked=false;
    if(s){const{collide}=await import('/game/src/spots/walker.js');blocked=!!collide(s.spot.colliders,x,z,.24,floor+.1);}else{const{collideBuildings}=await import('/game/src/world.js');blocked=!!collideBuildings(g.world.buildings,x,z,.24,floor+.05,1.7);}
    if(blocked&&!pose.allowBodyOverlap)throw Error('Camera body intersects scene at '+pose.id);
    let bearing=pose.bearing,pitch=pose.pitch??0;
    if(pose.target){const[tx,ty,tz]=pose.target;bearing=(Math.atan2(tx-x,z-tz)*180/Math.PI+360)%360;pitch=Math.atan2(ty-(floor+1.65),Math.hypot(tx-x,tz-z))*180/Math.PI;}
    F.enter(x,z,-bearing*Math.PI/180,floor);F.pitch=pitch*Math.PI/180;F.vx=0;F.vz=0;F.vy=0;F.jumpY=0;F.vel=0;F.place();cam.fov=pose.fov||70;cam.updateProjectionMatrix();
    r.advanceEnvironment(2);if(s)s.update(0);else{g.world.camera=cam;g.world.cull?.(cam);g.traffic.render?.(cam);}
    r.frame(0);const actual=cam.getWorldPosition(cam.position.clone()),dir=cam.getWorldDirection(cam.position.clone()),pixels=g.canvas.toDataURL('image/jpeg',.91).split(',')[1];
    return{pixels,pose:{x,z,floor,eye:actual.toArray(),heightAboveSupport:actual.y-floor,bearing:(Math.atan2(dir.x,-dir.z)*180/Math.PI+360)%360,pitch:Math.asin(dir.y)*180/Math.PI,fov:cam.fov},cameraBodyClear:!blocked,sourceEdge:pose.sourceEdge,sourceRoadId:pose.sourceRoadId,stats:{...r.stats}};
   },{pose,kind:current.kind});
   if(Math.abs(shot.pose.heightAboveSupport-1.65)>.04)throw Error('Incorrect eye height '+pose.id);
   const pixels=Buffer.from(shot.pixels,'base64');delete shot.pixels;const rel=`${current.kind}/${current.id}/${condition.id}/${pose.id}.jpg`,file=path.join(out,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,pixels);
   const record={id:pose.id,kind:current.kind,place:current.id,label:pose.label,purpose:pose.purpose||'Walking-height detail of the production scene.',file:rel,capturedAt:new Date().toISOString(),sourceCommit:source,viewport:{width:1280,height:800},condition:{...condition,...observed},sha256:hash(pixels),bytes:pixels.length,...shot};report.captures.push(record);save();note('captured',{id:current.id+':'+pose.id,condition:condition.id});
  }
 }
}
async function command(c){if(c.op==='district-batch'){for(const id of c.ids){await load({kind:'district',id});const poses=await page.evaluate(c.planner);fs.writeFileSync(path.join(out,id+'-plan.json'),JSON.stringify(poses,null,2));await capture({poses});note('place-complete',{id});}}else if(c.op==='load'){const data=await load(c);console.log(JSON.stringify({id:data.id,scene:data.sceneId,interactables:data.interactables,landmarks:data.landmarks,pois:data.pois,challenges:data.challenges,caruselDoor:data.caruselDoor,extras:data.extras}));}else if(c.op==='capture')await capture(c);else if(c.op==='eval'){const value=await page.evaluate(c.code);fs.writeFileSync(path.join(out,c.name+'.json'),JSON.stringify(value,null,2)+'\n');note('inspection-saved',{id:c.name});}else if(c.op==='close'){report.servedHashesUnchanged=Object.entries(report.served).every(([p,h])=>hash(fs.readFileSync(path.join(root,p)))===h);report.finished=new Date().toISOString();save();await browser.close();server.close();process.exit(0);}else throw Error('Unknown command');}
(async()=>{
 server=http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,bytes)=>{if(error){report.errors.push({http:404,path:name});save();return res.writeHead(404).end();}report.served[name]=hash(bytes);res.writeHead(200,{'cache-control':'no-store','content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.gz':'application/gzip'})[path.extname(file)]||'application/octet-stream'});res.end(bytes);});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--mute-audio','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});page.setDefaultTimeout(240000);
 page.on('pageerror',e=>{report.errors.push({page:String(e)});save();});page.on('console',m=>{if(m.type()==='error'){report.errors.push({console:m.text()});save();}});await page.route(/api\.open-meteo\.com/,route=>route.fulfill({status:200,contentType:'application/json',body:'{"error":true,"reason":"Controlled gallery conditions"}'}));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
 await page.goto('http://127.0.0.1:'+server.address().port+'/game/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.game?.r3d,null,{polling:100});note('ready');
 for await(const line of readline.createInterface({input:process.stdin})){try{await command(JSON.parse(line));console.log('COMMAND_DONE');}catch(error){note('command-failed',{error:String(error.stack||error),command:line});console.log('COMMAND_FAILED');}}
})().catch(async error=>{report.fatal=String(error.stack||error);save();console.error(report.fatal);await browser?.close();server?.close();process.exitCode=1;});
