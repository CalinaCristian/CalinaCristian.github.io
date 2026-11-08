// PORT=8147 OUT=/tmp/lipscani-qa node game/dev/harness/lipscani-activities-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const port = Number(process.env.PORT || 8147), out = process.env.OUT || '/tmp/lipscani-qa';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:720}}), errors = [], results = {};
  page.setDefaultTimeout(180000); page.on('pageerror', e => errors.push(e.message));
  await page.route(/api\.open-meteo\.com/, r => r.fulfill({json:{error:true}}));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`http://127.0.0.1:${port}/game/`); await page.waitForFunction(() => window.game?.achievements);
  results.initial = await page.evaluate(async () => {
   await game.enterSpot('old-town-lipscani');
   window.stepVenue = (n = 1, dt = .05) => { for (let i=0;i<n;i++) game.spot.update(dt); };
   window.va = () => game.spot.spot.ctx.extras.venueActivities;
   window.startVenue = kind => {
    const s = game.spot, it = s.spot.interactables.find(it => it.source === (kind === 'shaorma' ? 'n1731040881' : 'n10775253367'));
    s.ctl.enter(it.x, it.z, kind === 'shaorma' ? 1.265 : -1.864, it.y); game.drawFrame(); window.lastVenueApproachFrame = {triangles:game.r3d.stats.triangles,calls:game.r3d.stats.drawCalls}; s.input.actions.add('KeyE'); stepVenue(); stepVenue(9);
    return {active:va().active, debug:va().debug(), walker:s.ctl.active};
   };
   const { findWalkPath } = await import('./src/spots/tour.js');
   const s = game.spot, d = s.spot.data;
   return {triangles:s.spot.tris, venues:s.spot.interactables.filter(it => it.source).map(it=>({source:it.source,x:it.x,z:it.z,path:!!findWalkPath(s.spot.ground,s.spot.colliders,128,-56.5,it.x,it.z,{radius:1.5,maxLength:500})})), sources:d.pois.filter(p => ['n1731040881','n10775253367'].includes(p.id)), buildings:d.buildings.filter(b=>['w657568318','w658248961'].includes(b.id)), roomHidden:!s.spot.ctx.extras.wcpRoom.room.visible};
  });
  fs.writeFileSync(`${out}/initial.json`,JSON.stringify(results.initial,null,2)); console.log('initial',JSON.stringify(results.initial)); assert.ok(results.initial.triangles < 1e6); assert.equal(results.initial.venues.length,2); assert.ok(results.initial.venues.every(v=>v.path)); assert.ok(results.initial.roomHidden);
  assert.equal(results.initial.sources[0].name,'Dristor Kebap'); assert.equal(results.initial.sources[1].name,'Shoteria'); assert.equal(results.initial.buildings.length,2);
  results.frames = [];
  const snap = async name => { const frame = await page.evaluate(()=>{game.drawFrame();return{triangles:game.r3d.stats.triangles,calls:game.r3d.stats.drawCalls}}); results.frames.push({name,...frame}); console.log("frame",name,JSON.stringify(frame)); fs.writeFileSync(`${out}/frames.json`,JSON.stringify(results.frames,null,2)); assert.ok(frame.triangles<1.5e6 && frame.calls<400,name+JSON.stringify(frame)); await page.screenshot({path:`${out}/${name}.png`}); };
  const action = async (frames, keyboard=false) => { if (keyboard) await page.keyboard.press('e'); else await page.locator('.sp-venue [data-act]').click(); await page.evaluate(n=>stepVenue(n),frames); };
  assert.ok((await page.evaluate(()=>startVenue('shaorma'))).active); results.approach = await page.evaluate(()=>lastVenueApproachFrame); assert.ok(results.approach.triangles<1.5e6 && results.approach.calls<400);
  assert.ok(!(await page.evaluate(()=>game.achievements.isUnlocked('lm-dristor-shaorma'))));
  const idle = await page.evaluate(()=>{stepVenue(200);return va().debug()}); assert.equal(idle.step,0); assert.ok(!idle.animating);
  await action(10); await page.locator('.sp-venue [data-cancel]').click(); assert.ok(!(await page.evaluate(()=>game.achievements.isUnlocked('lm-dristor-shaorma')))); await page.evaluate(()=>startVenue('shaorma'));
  await page.locator('.sp-venue [data-act]').click(); await page.evaluate(()=>stepVenue(15));
  results.bite = await page.evaluate(()=>va().debug()); assert.ok(results.bite.animating && results.bite.hand[2]>-.65);
  await snap('dristor-bite');
  // Repeated E cannot skip an animation or queue the next bite.
  for(let i=0;i<6;i++) await page.keyboard.press('e');
  await page.evaluate(()=>stepVenue(23)); assert.equal(await page.evaluate(()=>va().debug().step),1);
  await page.evaluate(()=>stepVenue(100)); assert.equal(await page.evaluate(()=>va().debug().step),1);
  await action(38,true); assert.equal(await page.evaluate(()=>va().debug().step),2);
  assert.ok(!(await page.evaluate(()=>game.achievements.isUnlocked('lm-dristor-shaorma'))));
  await action(38); assert.ok(!(await page.evaluate(()=>va().active))); assert.ok(await page.evaluate(()=>game.achievements.isUnlocked('lm-dristor-shaorma')));
  results.foodComplete = await page.evaluate(()=>({walker:game.spot.ctl.active, timestamp:game.achievements.state.unlocked['lm-dristor-shaorma']})); assert.ok(results.foodComplete.walker);
  await page.evaluate(()=>startVenue('shot')); await action(10); await page.locator('.sp-venue [data-cancel]').click(); assert.ok(!(await page.evaluate(()=>game.achievements.isUnlocked('lm-shoteria-shot'))));
  await page.evaluate(()=>startVenue('shot')); await page.locator('.sp-venue [data-act]').click(); await page.evaluate(()=>stepVenue(26));
  results.pour = await page.evaluate(()=>va().debug()); assert.ok(results.pour.animating && results.pour.fill>.1 && results.pour.fill<1); await snap('shoteria-pour');
  await page.evaluate(()=>stepVenue(22)); assert.equal(await page.evaluate(()=>va().debug().step),1);
  assert.ok(!(await page.evaluate(()=>game.achievements.isUnlocked('lm-shoteria-shot'))));
  await page.locator('.sp-venue [data-act]').click(); await page.evaluate(()=>stepVenue(16)); await snap('shoteria-noroc'); await page.evaluate(()=>stepVenue(19));
  assert.equal(await page.evaluate(()=>va().debug().step),2); await page.locator('.sp-venue [data-act]').click(); await page.evaluate(()=>stepVenue(24)); await snap('shoteria-drink');
  await page.evaluate(()=>stepVenue(24)); assert.ok(await page.evaluate(()=>game.achievements.isUnlocked('lm-shoteria-shot')));
  results.render = await page.evaluate(()=>{game.drawFrame();return{triangles:game.r3d.stats.triangles,calls:game.r3d.stats.drawCalls}}); assert.ok(results.render.triangles<1.5e6 && results.render.calls<400);
  results.cancellation = {};
  for (const mode of ['leave','escape','map','photo','drone','pause','distance','teleport','hidden']) {
   await page.evaluate(()=>startVenue('shaorma')); await action(10);
   if(mode==='pause') await page.locator('#pause-btn').click();
   await page.evaluate(mode=>{
    const s=game.spot;
    if(mode==='leave') s.ui.el.querySelector('.sp-venue [data-cancel]').click();
    if(mode==='map') {s.input.actions.add('KeyM');game.updateSpot(.05);}
    if(mode==='photo') {game.photo.open(); if(!game.photo.active) throw new Error('Photo mode did not open');game.updateSpot(.05);game.photo.close();}
    if(mode==='drone') {const chk=game.explore.drone.canDeploy(); if(!chk.ok) throw new Error('Real drone deploy blocked: '+chk.reason);const ok=game.explore.deployDrone();window.venueDroneControl={ok,active:game.explore.drone.active,cancelled:!va().active,frozen:s.ctl.input!==game.input&&s.input!==game.input};game.explore.drone.abort();}
    if(mode==='pause'&&!game.pauseOpen) throw new Error('Actual pause button did not open pause');
    if(mode==='distance') {s.ctl.x+=5;stepVenue();}
    if(mode==='teleport') s.teleport('stavropoleos-cec');
    if(mode==='hidden') {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;}
   },mode);
   if(mode==='escape') await page.keyboard.press('Escape');
   const state = await page.evaluate(()=>({active:va().active,walker:game.spot.ctl.active,ui:!!document.querySelector('.sp-venue'),reason:va().lastCancel}));
   assert.ok(!state.active && state.walker && !state.ui,mode);results.cancellation[mode]=state;fs.writeFileSync(`${out}/cancellation.json`,JSON.stringify(results.cancellation,null,2)); if(mode==='drone') {results.droneControl=await page.evaluate(()=>venueDroneControl);assert.ok(Object.values(results.droneControl).every(Boolean));}
   await page.evaluate(()=>{game.togglePause(false);game.spot.ui.closePanel();game.spot.teleport('old-town-lipscani');game.spot.input.flush();});
  }
  // Touch targets/layout and full repeat completion are exercised on both phone orientations.
  results.mobile=[];
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
   await page.setViewportSize(viewport); await page.waitForTimeout(150); await page.evaluate(()=>game.resize()); await page.evaluate(()=>startVenue('shaorma'));
   const bounds = await page.locator('.sp-venue').evaluate(el=>({box:el.getBoundingClientRect().toJSON(),buttons:[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON()),overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.ok(bounds.box.left>=0 && bounds.box.right<=viewport.width && bounds.box.bottom<=viewport.height && !bounds.overflow); assert.ok(bounds.buttons.every(b=>b.height>=44));
   await snap(`mobile-${viewport.width}`); await action(38); await action(38); await action(38);
   assert.ok(!await page.evaluate(()=>va().active));results.mobile.push({viewport,bounds});
  }
  assert.equal(await page.evaluate(()=>game.achievements.state.unlocked['lm-dristor-shaorma']),results.foodComplete.timestamp);
  await page.evaluate(()=>startVenue('shot'));
  results.disposal=await page.evaluate(async()=>{window.oldVenue=va();await game.leaveSpot();return{disposed:oldVenue.disposed,active:oldVenue.active,ui:!!document.querySelector('.sp-venue'),props:!!game.camera.getObjectByName('venue-held-props')}});
  assert.ok(results.disposal.disposed&&!results.disposal.active&&!results.disposal.ui&&!results.disposal.props);
  await page.reload();await page.waitForFunction(()=>window.game?.achievements);
  results.persistence=await page.evaluate(()=>({food:game.achievements.isUnlocked('lm-dristor-shaorma'),shot:game.achievements.isUnlocked('lm-shoteria-shot')}));assert.ok(results.persistence.food&&results.persistence.shot);
  assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
