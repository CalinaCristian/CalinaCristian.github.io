// Lightweight real browser Input/OnFootController test; no WebGL renderer or world data.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__venue-look.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas>'}));
 await page.goto(`http://127.0.0.1:${process.env.PORT||8147}/__venue-look.html`);
 await page.evaluate(async()=>{
  const THREE=await import('/game/vendor/three.module.min.js'),{Input}=await import('/game/src/input.js'),{OnFootController}=await import('/game/src/onfoot.js'),{SpotUI}=await import('/game/src/spots/ui.js'),{createVenueActivities}=await import('/game/src/spots/venue-activities.js');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,800/600,.1,100),updates=[];
  const input=new Input();input.lookAllowed=true;input.setLookMode('hold');input.bindLook(document.querySelector('canvas'));
  const ctl=new OnFootController({scene,camera,input,groundAt:()=>0});ctl.enter(0,0,0,0);
  const ui=new SpotUI(),ctx={scene,extras:{},add:o=>scene.add(o),onUpdate:f=>updates.push(f)};
  const s={ctl,camera,input,ui,host:{},spot:{id:'old-town-lipscani'},get position(){return ctl.position},endTour(){}};
  const api=createVenueActivities(ctx);window.checkVenue={ctx,s,api,update:()=>updates.forEach(f=>f(.05,s))};api.start(s,'shaorma',{name:'Dristor Kebap',address:'Strada Franceză 17'});for(let i=0;i<9;i++)updates.forEach(f=>f(.05,s));
 });
 const drag=async()=>{await page.mouse.move(600,150);await page.mouse.down({button:'right'});await page.mouse.move(700,180,{steps:5});await page.mouse.up({button:'right'});assert.ok(await page.evaluate(()=>checkVenue.s.input.lookDX!==0),'real look gesture must reach Input');};
 await drag();await page.evaluate(()=>checkVenue.update());assert.equal(await page.evaluate(()=>checkVenue.s.input.lookDX),0,'activity consumes queued look');
 await drag();await page.locator('.sp-venue [data-act]').focus();await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>checkVenue.api.debug().animating),'native Space activates the focused action button');await page.locator('.sp-venue [data-cancel]').click();
 const resumed=await page.evaluate(()=>{const{s}=checkVenue;s.ctl.update(.05);return{heading:s.ctl.heading,pitch:s.ctl.pitch,active:s.ctl.active,jump:s.ctl.jumpY}});assert.deepEqual(resumed,{heading:0,pitch:0,active:true,jump:0});
 const resources=await page.evaluate(()=>{
  const{ctx,s,api}=checkVenue;api.start(s,'shot',{name:'Shoteria',address:'Strada Șelari 17'});
  const root=s.camera.getObjectByName('venue-held-props'),expected={geometry:new Set(),material:new Set(),texture:new Set()},freed={geometry:new Set(),material:new Set(),texture:new Set()};
  const track=(kind,o)=>{if(!o||expected[kind].has(o.uuid))return;expected[kind].add(o.uuid);o.addEventListener('dispose',()=>freed[kind].add(o.uuid));};
  root.traverse(o=>{track('geometry',o.geometry);for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[])){track('material',m);track('texture',m.map);}});
  ctx.scene.remove(ctx.scene.getObjectByName('old-town-venue-activities'));
  return{disposed:api.disposed,active:api.active,ui:!!document.querySelector('.sp-venue'),attached:!!s.camera.getObjectByName('venue-held-props'),expected:Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,v.size])),freed:Object.fromEntries(Object.entries(freed).map(([k,v])=>[k,v.size]))};
 });assert.ok(resources.disposed&&!resources.active&&!resources.ui&&!resources.attached);assert.deepEqual(resources.expected,resources.freed);assert.ok(resources.expected.geometry>0&&resources.expected.texture>0);assert.deepEqual(errors,[]);console.log(JSON.stringify({resumed,resources,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
