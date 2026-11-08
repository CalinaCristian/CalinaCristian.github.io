const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const port = Number(process.env.PORT || 8131), out = process.env.OUT || '/tmp/secret-bar-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser = await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
  page.setDefaultTimeout(180000);
  page.on('pageerror', e=>errors.push(e.message));
  const captureScene = async (name) => { const png=await page.evaluate(()=>{game.drawFrame();return game.canvas.toDataURL('image/png').split(',')[1];});fs.writeFileSync(`${out}/${name}.png`,Buffer.from(png,'base64')); };
  await page.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(`http://127.0.0.1:${port}/game/`);await page.waitForFunction(()=>window.game?.achievements);
  const initial=await page.evaluate(async()=>{
   await game.enterSpot('old-town-lipscani');
   const s=game.spot,S=s.spot,e=S.ctx.extras.wcpRoom;
   const {findWalkPath}=await import('./src/spots/tour.js');
   const {ACHIEVEMENTS}=await import('./src/data.js');
   window.stepBar=()=>{s.update(.05);game.drawFrame();};
   const path=findWalkPath(S.ground,S.colliders,128,-56.5,e.entry.x,e.entry.z,{radius:1.5,maxLength:100});
   const host=S.data.buildings.find(b=>b.id==='w1456757039'),part=S.data.buildings.find(b=>b.id==='w658012732'),poi=S.data.pois.find(p=>p.id==='n10775260925');
   const sourceSolid=S.colliders.some(c=>c.poly&&c.poly.some(p=>Math.hypot(p[0]-254.6,p[1]+56)<.2));
   return {triangles:S.tris,catalogue:ACHIEVEMENTS.length,active:game.achievements.completion().total,roomHidden:!e.room.visible,host,part,poi,sourceSolid,path,objectives:s.objectives().map(o=>o.label),entry:e.entry};
  });
  assert.equal(initial.roomHidden,true);assert.equal(initial.poi.name,'Starbucks');assert.ok(initial.host&&initial.part&&initial.sourceSolid);assert.ok(initial.path,'existing bookshop door must reach hidden entrance');assert.ok(initial.triangles<1e6);assert.ok(!initial.objectives.some(s=>/wcp|project|unmarked|football room/i.test(s)));
  await page.evaluate(()=>{const s=game.spot;s.ctl.enter(262,-49,0,s.spot.ground.heightAt(262,-49));stepBar();});
  await captureScene('source-starbucks-frontage');
  await page.evaluate(()=>{const s=game.spot,e=s.spot.ctx.extras.wcpRoom;s.ctl.enter(e.entry.x,e.entry.z,0,e.entry.y);s.input.actions.add('KeyE');stepBar();for(let i=0;i<4;i++)stepBar();});
  await page.waitForFunction(()=>game.spot.spot.ctx.extras.wcpHint.video.readyState>=2);
  // Keep manual host frames current while the native media element decodes normally.
  for(let i=0;i<8;i++){await page.evaluate(()=>stepBar());await page.waitForTimeout(100);}
  const playback=await page.evaluate(()=>{const s=game.spot,h=s.spot.ctx.extras.wcpHint;return{entered:s.spot.ctx.extras.wcpRoom.room.visible,time:h.video.currentTime,loop:h.video.loop,muted:h.video.muted,playsInline:h.video.playsInline,paused:h.video.paused,noGoal:!game.achievements.isUnlocked('dinamo-drone-goal'),noProject:!game.achievements.isUnlocked('wcp-bar'),mapAnchor:s.map.player,fans:s.spot.crowd.peds.filter(p=>p.group?.wcpFan&&!p.hidden).length,position:s.position};});
  assert.ok(Math.hypot(playback.mapAnchor.x-initial.entry.x,playback.mapAnchor.z-initial.entry.z)<.01);
  assert.ok(playback.entered&&playback.time>0&&playback.loop&&playback.muted&&playback.playsInline&&!playback.paused&&playback.noGoal&&playback.noProject&&playback.fans>0);
  await page.evaluate(()=>{const s=game.spot,h=s.spot.ctx.extras.wcpHint;s.ctl.enter(8000,s.spot.ctx.extras.wcpRoom.spawn.z+3,Math.PI,s.position.y);s.ctl.pitch=.05;s.ctl.place();stepBar();});
  await captureScene('interior');
  await page.evaluate(()=>{game._pauseOpen=false;game.spot.spot.ctx.extras.wcpHint.video.currentTime=7.8;stepBar();});
  for(let i=0;i<5;i++){await page.waitForTimeout(100);await page.evaluate(()=>stepBar());}
  const looped=await page.evaluate(()=>{const h=game.spot.spot.ctx.extras.wcpHint;return{time:h.video.currentTime,paused:h.video.paused,noGoal:!game.achievements.isUnlocked('dinamo-drone-goal'),render:{triangles:game.r3d.stats.triangles,calls:game.r3d.stats.drawCalls}};});
  assert.ok(looped.time<7.8&&!looped.paused&&looped.noGoal);
  assert.ok(looped.render.triangles>0&&looped.render.triangles<1.5e6&&looped.render.calls>0&&looped.render.calls<400);
  await page.evaluate(()=>{game._pauseOpen=true;game.drawFrame();});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>game.spot.spot.ctx.extras.wcpHint.video.paused));
  await page.evaluate(()=>{game._pauseOpen=false;stepBar();});
  const kiosk=await page.evaluate(()=>{const s=game.spot;const it=s.spot.interactables.find(i=>String(i.label).startsWith('World Cup Predictions'));s.ctl.enter(it.x,it.z,0,it.y);s.input.actions.add('KeyE');stepBar();return{project:game.achievements.isUnlocked('wcp-bar'),goal:game.achievements.isUnlocked('dinamo-drone-goal'),link:s.ui.$('.wcp-open').href,images:s.ui.$('.wcp-dots').children.length,open:s.ui.panelOpen};});
  assert.ok(kiosk.project&&!kiosk.goal&&kiosk.images===6&&kiosk.open);assert.equal(kiosk.link,'https://wcpredictions.cristiancalina.com/');
  await page.locator('.wcp-next').click();assert.match(await page.locator('.wcp-cap').textContent(),/2 \/ 6/);
  await page.screenshot({path:`${out}/project.png`,timeout:180000});
  await page.locator('.wcp-close').click();
  const exit=await page.evaluate(()=>{const s=game.spot,e=s.spot.ctx.extras.wcpRoom;s.ctl.enter(e.spawn.x,e.spawn.z-.5,0,e.spawn.y);s.input.actions.add('KeyE');stepBar();return{hidden:!e.room.visible,paused:s.spot.ctx.extras.wcpHint.video.paused,distance:Math.hypot(s.position.x-e.entry.x,s.position.z-e.entry.z)};});assert.ok(exit.hidden&&exit.paused&&exit.distance<.01);
  const disposal=await page.evaluate(async()=>{window.oldHint=game.spot.spot.ctx.extras.wcpHint;await game.leaveSpot();return{disposed:oldHint.disposed,paused:oldHint.video.paused,src:oldHint.video.getAttribute('src'),pendingVideoFrame:oldHint.pendingVideoFrame,noScene:!oldHint.screen.parent?.parent};});assert.ok(disposal.disposed&&disposal.paused&&!disposal.src&&disposal.pendingVideoFrame===0);
  await page.reload();await page.waitForFunction(()=>window.game?.achievements);const persistence=await page.evaluate(()=>({project:game.achievements.isUnlocked('wcp-bar'),goal:game.achievements.isUnlocked('dinamo-drone-goal')}));assert.ok(persistence.project&&!persistence.goal);
  assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/results.json`,JSON.stringify({initial,playback,looped,kiosk,exit,disposal,persistence,errors},null,2));console.log(JSON.stringify({initial,playback,looped,kiosk,exit,disposal,persistence,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
