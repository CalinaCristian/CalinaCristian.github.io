// Actual DOM/Input/SpotSession/activityFlow state regression. No 3D renderer or physical-route claim.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.argv[2]||'/tmp/tourist-flow-state';
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{if(req.url==='/fixture.html'){res.setHeader('content-type','text/html');res.end('<!doctype html><link rel="stylesheet" href="/game/style.css"><body></body>');return;}try{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({headless:true,args:['--mute-audio']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture.html`);
 await page.evaluate(async()=>{
  document.body.innerHTML='';
  const [{SpotSession},{SpotUI},{activityFlow},{Input},THREE,{syncModalControls}]=await Promise.all([import('/game/src/spots/index.js'),import('/game/src/spots/ui.js'),import('/game/src/spots/participation.js'),import('/game/src/input.js'),import('/game/vendor/three.module.min.js'),import('/game/src/modal-controls.js')]);
  const updates=[],ctx={extras:{},onUpdate:f=>updates.push(f)},s=Object.create(SpotSession.prototype);
  Object.assign(s,{t:0,nightK:0,progress:{},input:new Input(),camera:new THREE.PerspectiveCamera(),host:{},r3d:{nightLights:false},ui:new SpotUI(document.body),sound:{update(){}},guide:{x:0,z:0,speed:0},map:{setRoute(){},update(){}},spot:{id:'old-town-lipscani',name:'Test visit',sceneId:'state-fixture',scene:new THREE.Scene(),ground:{heightAt:()=>0,groundAt:()=>0},ctx,updaters:updates,nightHooks:[],interactables:[]}});
  s.ctl={x:0,z:0,y:0,active:true,update(){},get position(){return{x:this.x,y:this.y,z:this.z};}};
  s._navPath=()=>[[0,0],[3,0]];s._refreshMarkers=()=>{};s._pushOut=()=>{};
  const interaction={};
  const reset=()=>{s.tour={stops:[{kind:'activity',interaction,x:0,z:0,label:'Complete an activity',path:[[0,0],[0,0]],tx:0,tz:0},{kind:'plaque',x:3,z:0,label:'Next stop',radius:1}],i:0,state:'walk',wait:0,said:false,t:0,travelled:0,skipped:0};s._tourUI();};
  const flow=activityFlow(ctx);let awards=0,cancels=0;
  const begin=()=>{s._usingInteraction=interaction;const ok=flow.begin(s,{title:'Real activity flow',action:'Finish',complete:()=>awards++,cancel:()=>cancels++});s._usingInteraction=null;return ok;};
  const host={state:'spot',spot:s,hud:{panelOpen:false},input:s.input};
  window.fixture={s,flow,reset,begin,host,syncHost:()=>syncModalControls(host),counts:()=>({awards,cancels})};reset();
 });
 const stages=[];
 const check=async(name,fn)=>{const result=await page.evaluate(fn);assert.equal(result,true,name);stages.push(name);};
 await check('Current activity completion excludes chess and retains combined Glasshouse progress',async()=>{
  const [{Progression,activeAchievements},{activityAvailable},{ACHIEVEMENTS}]=await Promise.all([import('/game/src/achievements.js'),import('/game/src/spot-availability.js'),import('/game/src/data.js')]);
  const p=Object.create(Progression.prototype),unlocked=new Set();
  Object.assign(p,{game:{},state:{sets:{roam:[],spots:[],activities:['chihuly:lm-chihuly-glasshouse']},counters:{photos:0},unlocked:{}},count:()=>0,spotData:()=>({postcards:[],list:[]}),checkMilestones(){},refreshUi(){},unlock:id=>{unlocked.add(id);p.state.unlocked[id]=1;},addTo:(set,key)=>{if(!p.state.sets[set].includes(key))p.state.sets[set].push(key);}});
  p.evaluate();if(!unlocked.has('lm-chihuly-glasshouse'))return false;
  for(const [spot,id] of [['old-town-lipscani','freddo-dance'],['old-town-lipscani','freddo-shot'],['cismigiu','backgammon']])p.onActivity({spot,id});
  const active=new Set(activeAchievements().map(a=>a.id));
  return ['lm-freddo-dance','lm-freddo-shot','lm-cismigiu-backgammon','lm-chihuly-glasshouse'].every(id=>unlocked.has(id)&&active.has(id))&&!active.has('lm-cismigiu-chess')&&!activityAvailable(ACHIEVEMENTS.find(a=>a.id==='lm-cismigiu-chess'));
 });
 await check('Opening a modal activity preserves the active itinerary',()=>{const f=fixture,T=f.s.tour;return f.begin()&&f.s.tour===T&&f.s.tour.i===0&&!T.stops[0].participated;});
 await check('Cancellation restores walking without completing or restarting the stop',()=>{const f=fixture,T=f.s.tour;f.flow.cancel('leave');return f.s.tour===T&&T.i===0&&!T.stops[0].participated&&f.s.ctl.active&&f.counts().cancels===1;});
 await check('Actual flow completion advances exactly once even before guide arrival',()=>{const f=fixture;f.begin();f.flow.complete();f.flow.complete();return f.s.tour.i===1&&f.counts().awards===1;});
 await page.locator('[data-tour-skip]').click();
 await check('Visible skip control ends skipped itinerary without awarding a tour',()=>fixture.s.tour.state==='done'&&fixture.s.tour.skipped===1&&!fixture.s.progress.tours);
 await page.evaluate(()=>fixture.reset());await page.keyboard.press('j');await page.evaluate(()=>fixture.s.update(0));
 await check('Native J shortcut reaches session skip logic',()=>fixture.s.tour.i===1&&fixture.s.tour.skipped===1);
 await check('Compound club entry waits for its named completed activity',()=>{const f=fixture;f.reset();const st=f.s.tour.stops[0];st.interaction.tourActivityIds=['freddo-dance'];f.s.recordTourActivity('old-town-lipscani','unrelated');if(f.s.tour.i!==0)return false;f.s.recordTourActivity('old-town-lipscani','freddo-dance');return f.s.tour.i===1;});
 await page.evaluate(async()=>{
  const {SpotMap}=await import('/game/src/spots/ui.js'),s=fixture.s,img=document.createElement('canvas');img.width=img.height=400;
  delete s._navPath;s._navColliders=()=>[];s.spot.colliders=[];
  const c=img.getContext('2d');c.fillStyle='#617242';c.fillRect(0,0,400,400);
  const map=new SpotMap(s.ui,{image:img,bounds:{x0:-100,z0:-100,x1:100,z1:100}}),marker={kind:'activity',x:15,z:10,label:'A complete destination name that should remain readable on a small phone'};
  map.setMarkers([marker]);s.map=map;fixture.map=map;
  void s.ui.showMap(map,{title:'Waypoint input fixture',items:[{icon:'🎯',label:marker.label,marker}],navigate:{set:t=>s.setWaypoint(t),clear:()=>s.clearWaypoint()}});
 });
 await page.locator('li[data-i]').click();
 await check('Selecting a destination sets a persistent named waypoint',()=>fixture.s.waypoint?.x===15&&fixture.map.waypoint?.kind==='waypoint'&&document.querySelector('.sp-nav-status').textContent.includes('complete destination'));
 const custom=await page.evaluate(()=>{const t=fixture.map._full;return{px:(-25-t.cx)*t.k+t.W/2,py:(-25-t.cz)*t.k+t.H/2};});
 // Convert using the actual device-pixel canvas ratio, not an assumed DPR.
 const click=await page.evaluate(({px,py})=>{const c=document.querySelector('.sp-map canvas'),r=c.getBoundingClientRect();return{x:r.x+px*r.width/c.width,y:r.y+py*r.height/c.height};},custom);
 await page.mouse.click(click.x,click.y);
 await check('Clicking empty map ground sets the inverse-projected custom waypoint',()=>Math.abs(fixture.s.waypoint.x+25)<1&&Math.abs(fixture.s.waypoint.z+25)<1&&fixture.s.waypoint.label==='Custom waypoint');
 await page.locator('[data-clear-waypoint]').click();
 await check('Clear removes both route and waypoint',()=>!fixture.s.waypoint&&!fixture.map.waypoint&&!fixture.map.waypointRoute);
 await page.locator('li[data-i]').focus();await page.keyboard.press('Enter');
 await check('Keyboard destination selection stays in the map and sets a waypoint',()=>fixture.s.ui.panelOpen&&fixture.s.waypoint?.x===15);
 await page.screenshot({path:path.join(out,'waypoint-map-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>document.body.classList.add('touch'));
 const targets=await page.locator('.sp-map button,.sp-map li[data-i]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(targets.every(h=>h>=44));
 await page.screenshot({path:path.join(out,'waypoint-map-phone.png')});
 await page.locator('[data-close]').click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>fixture.reset());
 const phone=await page.locator('[data-tour-skip]').boundingBox();assert(phone&&phone.x>=0&&phone.x+phone.width<=390);
 await page.screenshot({path:path.join(out,'tour-step-phone.png')});
 await page.evaluate(()=>{
  fixture.s.ui.setTitle('A long visit name with an activity and a saved itinerary','City and country');
  fixture.s.ui.setTour({title:'Three stops through the visit',i:0,n:3,stop:'Complete the full activity with the park regular',text:'Long guide narration '.repeat(14),skip:()=>fixture.s.skipTourStop(),end:()=>fixture.s.endTour()});
  fixture.begin();
 });
 const activityLayout=async(label,width,height)=>{
  await page.setViewportSize({width,height});
  await page.waitForFunction(()=>{const c=document.querySelector('.sp-card').getBoundingClientRect(),a=document.querySelector('.sp-participation').getBoundingClientRect();return a.top>=c.bottom+7&&a.bottom<=innerHeight-10;});
  await check(label,()=>{const c=document.querySelector('.sp-card').getBoundingClientRect(),a=document.querySelector('.sp-participation').getBoundingClientRect(),skip=document.querySelector('[data-tour-skip]').getBoundingClientRect();return a.top>=c.bottom+7&&skip.height>=44&&skip.bottom<=a.top&&a.right<=innerWidth;});
  await page.screenshot({path:path.join(out,`tour-activity-${width}x${height}.png`)});
 };
 await activityLayout('Phone tour Skip/End stay above the real activity panel',390,844);
 await activityLayout('Landscape activity fits below the compact tour card',844,390);
 await page.evaluate(()=>{
  // Explicit adversarial host chrome at the activity button, reproducing the
  // observed global toolbar obstruction without a 3D scene or provider API.
  const a=document.querySelector('.sp-participation [data-action]').getBoundingClientRect();
  for(const id of ['explore-bar','touch','pause-btn']){
   const e=document.createElement('div');e.id=id;e.innerHTML='<button>Host action</button>';e.style.cssText=`position:fixed;display:block;left:${a.left}px;top:${a.top}px;z-index:1000`;document.body.append(e);
  }
  fixture.syncHost();
 });
 await check('Activity gates obstructing host chrome while keeping tour Skip/End usable',()=>{
  const hidden=['explore-bar','touch','pause-btn'].every(id=>{const e=document.getElementById(id);return e.inert&&getComputedStyle(e).visibility==='hidden';});
  const skip=document.querySelector('[data-tour-skip]'),a=document.querySelector('.sp-participation [data-action]'),r=a.getBoundingClientRect();
  return hidden&&!skip.closest('.sp-tour-controls').inert&&getComputedStyle(skip).visibility==='visible'&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===a;
 });
 await check('A full host modal still hides and disables the guide controls',()=>{
  fixture.host._pauseOpen=true;fixture.syncHost();const e=document.querySelector('.sp-tour-controls');const hidden=e.inert&&getComputedStyle(e).visibility==='hidden';fixture.host._pauseOpen=false;fixture.syncHost();return hidden&&!e.inert;
 });
 await page.evaluate(()=>fixture.s.ui.toast('Activity reached','A long arrival message '.repeat(12)));
 for(const [width,height]of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  await check(`Activity notification stays below controls at ${width}x${height}`,()=>{
   const panel=document.querySelector('.sp-participation'),region=document.querySelector('.sp-toasts'),toast=document.querySelector('.sp-toast'),nav=panel.querySelector('nav').getBoundingClientRect(),skip=document.querySelector('[data-tour-skip]').getBoundingClientRect();
   const t=toast.getBoundingClientRect();return panel.contains(region)&&t.top>=nav.bottom&&t.top>=skip.bottom&&t.right<=innerWidth;
  });
  await page.screenshot({path:path.join(out,`activity-notification-${width}x${height}.png`)});
 }
 await page.locator('[data-tour-skip]').click();
 await page.evaluate(()=>fixture.syncHost());
 await check('Skipping an active modal cancels it and releases its layout observer',()=>!fixture.flow.active&&!fixture.s.ui.el.classList.contains('sp-participating')&&!fixture.s.ui._activityLayout&&fixture.s.ctl.active);
 await check('Finishing an activity restores host controls without leaving an inert toolbar',()=>['explore-bar','touch','pause-btn'].every(id=>{const e=document.getElementById(id);return !e.inert&&getComputedStyle(e).visibility==='visible';})&&!document.body.classList.contains('ui-activity'));
 await check('Leaving restores the same notification region for later messages',()=>{
  const ui=fixture.s.ui,region=ui.$('.sp-toasts');if(!region||region.parentElement!==ui.el||!region.querySelector('.sp-toast'))return false;
  ui.toast('Walk resumed','The notification region survives activity removal.');return region.querySelectorAll('.sp-toast').length===2;
 });
 await page.evaluate(async()=>{
  const f=fixture,{createVenueActivities}=await import('/game/src/spots/venue-activities.js');
  const ctx=f.s.spot.ctx;ctx.add=g=>f.s.spot.scene.add(g);f.s.spot.id='old-town-lipscani';f.reset();
  f.venue=createVenueActivities(ctx);f.venue.start(f.s,'shot',{name:'Freddo',address:'Strada Smârdan 24',activity:'freddo-shot'});f.syncHost();
 });
 for(const [width,height]of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(()=>{const a=document.querySelector('.sp-venue').getBoundingClientRect(),c=document.querySelector('.sp-card').getBoundingClientRect();return a.top>=c.bottom+7&&a.bottom<=innerHeight-10;});
  await check(`Venue shot keeps host chrome clear and tour controls above it at ${width}x${height}`,()=>{
   const a=document.querySelector('.sp-venue').getBoundingClientRect(),skip=document.querySelector('[data-tour-skip]');return fixture.venue.active&&document.body.classList.contains('ui-activity')&&!skip.closest('.sp-tour-controls').inert&&skip.getBoundingClientRect().bottom<=a.top&&document.querySelector('.sp-venue .sp-toasts')!==null;
  });
 }
 await page.locator('.sp-venue [data-cancel]').click();await page.evaluate(()=>fixture.syncHost());
 await check('Venue cancellation restores the shared notification region and launchers',()=>!fixture.venue.active&&!document.body.classList.contains('ui-activity')&&fixture.s.ui.$('.sp-toasts').parentElement===fixture.s.ui.el&&!document.getElementById('touch').inert);
 assert.deepEqual(errors,[]);
 const report={passed:true,scope:'Actual native DOM/Input/SpotSession/modal-flow state with explicit synthetic stops, flat ground and stub route provider. No physical access, scene beauty, or hardware FPS claim.',checks:stages,errors};
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
