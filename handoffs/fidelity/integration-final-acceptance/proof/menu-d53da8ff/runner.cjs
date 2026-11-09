// Native menu controls and current-catalog completion; no scene-fidelity claim.
// Usage: node integration-spot-menu-check.cjs ROOT OUT
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const report={root,checks:[],errors:[],consoleErrors:[],captures:[],fixtures:[],notes:['Native desktop clicks/390px touch controls. Saved-progress fixtures are synthetic and explicitly labelled. No claim that fixture achievements were earned through gameplay.']};
const persist=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});console.log((pass?'PASS ':'FAIL ')+name);persist();};
const server=http.createServer((req,res)=>{let uri=decodeURIComponent(req.url.split('?')[0]);if(uri.endsWith('/'))uri+='index.html';const f=path.join(root,uri);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'content-type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.webm':'video/webm','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream'});res.end(e?'missing':b);});});
let browser;const contexts=[];
const targets=['spots-buc','spots-sea','postcards-all','tours-buc','tours-sea'];
async function ready(page){await page.waitForFunction(()=>window.game?.achievements&&game.spotsMod?.SPOTS&&document.querySelector('#spot-select'));await page.evaluate(async()=>{await game.save.ready;game.audio.setMuted(true);game.r3d.setQuality('low');game.quality='low';});}
async function shot(page,label){await require('./integration-browser-bounds.cjs').captureViewport(page,path.join(out,label+'.png'));report.captures.push(label+'.png');persist();}
async function click(page,selector,touch){const l=page.locator(selector);await l.scrollIntoViewIfNeeded();if(touch)await l.tap();else await l.click();}
async function snapshot(page){return page.evaluate(async()=>{const{activeAchievements}=await import('/game/src/achievements.js'),{ACHIEVEMENTS}=await import('/game/src/data.js'),{MENU_ORDER,touristTarget}=await import('/game/src/spot-availability.js');const g=game,A=g.achievements,list=g.spotsMod.SPOTS,all=g.spotsMod.SPOTS_ALL,c=A.completion(),active=activeAchievements();return{ids:list.map(s=>s.id),allIds:all.map(s=>s.id),menuOrder:MENU_ORDER,cityCounts:Object.fromEntries(['bucharest','seattle'].map(city=>[city,list.filter(s=>s.city===city).length])),counts:Object.fromEntries(['spots-buc','spots-sea','postcards-all','tours-buc','tours-sea'].map(id=>[id,A.count(id)])),targets:Object.fromEntries(ACHIEVEMENTS.filter(a=>['spots-buc','spots-sea','postcards-all','tours-buc','tours-sea'].includes(a.id)).map(a=>[a.id,touristTarget(a.id,a.target,list)])),completion:c,activeIds:active.map(a=>a.id),retiredIds:ACHIEVEMENTS.filter(a=>a.activity&&!a.activity.startsWith('*:')&&!new Set(list.map(s=>s.id)).has(a.activity.split(':')[0])).map(a=>a.id),saved:{spots:A.state.sets.spots,postcards:Object.keys(g.spotsMod.spotProgress().postcards||{}),unlocked:A.state.unlocked,activities:A.state.sets.activities}};});}
async function menu(page,label,touch,expected){
 await click(page,'#spot-select > summary',touch);await page.waitForFunction(()=>document.querySelector('#spot-select').open);
 const data=await page.locator('#spot-select').evaluate(el=>({ids:[...el.querySelectorAll('[data-spot]')].map(b=>b.dataset.spot),first:[...el.querySelectorAll('[data-spot]')].slice(0,3).map(b=>b.dataset.spot),parksOpen:el.querySelector('.spot-parks').open,parkIds:[...el.querySelectorAll('.spot-parks [data-spot]')].map(b=>b.dataset.spot),parkVisible:[...el.querySelectorAll('.spot-parks [data-spot]')].some(b=>b.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true,opacityProperty:true})&&b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0),summary:el.querySelector('summary').textContent,parkSummaryHeight:el.querySelector('.spot-parks>summary').getBoundingClientRect().height}));
 check(label+' unique menu count',data.ids.length===expected&&new Set(data.ids).size===expected,data);
 check(label+' Recommended first is Troll/cathedral/Old Town',JSON.stringify(data.first)===JSON.stringify(['fremont-troll','peoples-salvation-cathedral','old-town-lipscani']),data.first);
 if(expected===21)check(label+' three unverified destinations absent',['herastrau-park','village-museum','ballard-locks'].every(id=>!data.ids.includes(id)),data.ids);
 check(label+' parks collapsed by default',!data.parksOpen&&!data.parkVisible,data);
 await page.locator('#spot-select [data-spot="fremont-troll"]').scrollIntoViewIfNeeded();await shot(page,label+'-recommended');
 await click(page,'#spot-select .spot-parks > summary',touch);await page.waitForFunction(()=>document.querySelector('#spot-select .spot-parks').open);
 const all=page.locator('#spot-select [data-spot]'),measured=[];
 for(let i=0;i<await all.count();i++){const b=all.nth(i);await b.scrollIntoViewIfNeeded();measured.push(await b.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:el.dataset.spot,w:r.width,h:r.height,hit:!!h&&el.contains(h),fits:r.x>=-.1&&r.y>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1};}));}
 check(label+' every scrolled destination has a reachable 44px target',measured.every(x=>x.w>=43.9&&x.h>=43.9&&x.hit&&x.fits),measured);
 await page.locator('#spot-select .spot-parks > summary').scrollIntoViewIfNeeded();await shot(page,label+'-parks-open');
 await click(page,'#spot-select .spot-parks > summary',touch);check(label+' native park close hides its destinations',await page.locator('#spot-select .spot-parks').evaluate(el=>!el.open&&![...el.querySelectorAll('[data-spot]')].some(b=>b.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true,opacityProperty:true})&&b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0)));
 await shot(page,label+'-parks-closed');
}
async function panelTargets(page,label,touch){
 await click(page,'#achv-menu',touch);await page.waitForFunction(()=>document.querySelector('#achv-panel.show'));
 const expected=await page.evaluate(async()=>{const{ACHIEVEMENTS}=await import('/game/src/data.js');return ACHIEVEMENTS.filter(a=>['spots-buc','spots-sea','postcards-all','tours-buc','tours-sea'].includes(a.id)).map(a=>({id:a.id,title:a.title,cat:a.cat}));});
 const state=await snapshot(page),values=[];
 for(const cat of ['explorer','photo','landmarks']){await click(page,`#achv-panel [data-achv-filter="${cat}"]`,touch);for(const a of expected.filter(a=>a.cat===cat)){const row=await page.locator('#achv-panel').evaluate((el,a)=>{const card=[...el.querySelectorAll('.achv-card')].find(c=>c.querySelector('b')?.textContent===a.title);return{found:!!card,text:card?.querySelector('.prog small')?.textContent||'',title:a.title};},a);values.push({...a,...row,expected:`0/${state.targets[a.id]}`});}}
 check(label+' native achievement cards use current city/postcard/tour targets',values.every(v=>v.found&&v.text===v.expected),values);
 await click(page,'#achv-panel [data-achv-act="close"]',touch);
}
async function seed(page,kind){return page.evaluate(async kind=>{
 const{ACHIEVEMENTS,STOPS}=await import('/game/src/data.js'),{CHAPTERS,CITIES}=await import('/game/src/cities.js'),{activeAchievements}=await import('/game/src/achievements.js');
 const g=game,A=g.achievements,now=1794000000000,list=g.spotsMod.SPOTS,all=g.spotsMod.SPOTS_ALL,available=new Set(list.map(s=>s.id)),active=activeAchievements(),drop=active.find(a=>a.id==='vlad')?.id;
 const ids=(kind==='legacy'?all:list).map(s=>s.id),full=kind==='full'||kind==='minus-one',retired=ACHIEVEMENTS.filter(a=>a.activity&&!a.activity.startsWith('*:')&&!available.has(a.activity.split(':')[0]));
 const unlocked=full?Object.fromEntries(active.filter(a=>kind!=='minus-one'||a.id!==drop).map(a=>[a.id,now])):kind==='legacy'?Object.fromEntries([...retired.map(a=>[a.id,now]),['retired-unknown-fixture',now]]):{};
 const state={v:1,created:now,unlocked,counters:{walk:0,photos:0},dist:{rain:0,snow:0,fog:0},sets:{screens:full?STOPS.flatMap(s=>(s.stations||[]).map((_,i)=>`${s.id}:${i}`)):[],roam:full?Object.values(CITIES).flatMap(c=>Object.keys(c.districts||{})):[],spots:ids,plaques:[],rush:[],activities:full?[...new Set([...g.spotsMod.ACTIVITIES.filter(a=>available.has(a.spot)).map(a=>`${a.spot}:${a.id}`),...ids.map(id=>id+':tour')])]:ids.map(id=>id+':tour')},milestones:full&&kind==='minus-one'?[25,50,75]:[],gold:false};
 const done=full?CHAPTERS.map(c=>c.id):[];g.progress.done=new Set(done);localStorage.setItem('dmcv:chapters',JSON.stringify({reached:done,done}));localStorage.setItem('dmcv.spots.v1',JSON.stringify({postcards:Object.fromEntries(ids.map(id=>[id,now]))}));A.state=structuredClone(state);A.dirty=false;A.silent=true;A.save(true);return{kind,ids,retired:retired.map(a=>a.id),drop,active:active.map(a=>a.id),stamp:now};
 },kind);}
async function loadFixture(page,kind){const fixture=await seed(page,kind);report.fixtures.push(fixture);await page.reload({waitUntil:'domcontentloaded'});await ready(page);return{fixture,state:await snapshot(page)};}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const mode of ['desktop','phone','developer']){
  const touch=mode==='phone',ctx=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:720},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});contexts.push(ctx);await ctx.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));const page=await ctx.newPage();page.setDefaultTimeout(90000);require('./integration-browser-bounds.cjs').boundEvaluations(page);page.on('pageerror',e=>{report.errors.push({mode,text:e.message});persist();});page.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push({mode,text:m.text()});persist();}for(const a of m.args())a.dispose().catch(()=>{});});
  let release;const gate=new Promise(r=>release=r);
  if(mode==='desktop')await page.route('**/game/src/spots/index.js',async r=>{await gate;await r.continue();});else release();
  await page.goto(`http://127.0.0.1:${server.address().port}/game/${mode==='developer'?'?spots=all':''}`,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.game?.achievements);
  if(mode==='desktop'){
   const pre=await page.evaluate(async()=>{const{activeAchievements}=await import('/game/src/achievements.js'),{ACHIEVEMENTS}=await import('/game/src/data.js'),{MENU_AVAILABLE}=await import('/game/src/spot-availability.js');return{registryLoaded:!!game.spotsMod,parts:game.achievements.completion().parts,active:activeAchievements().map(a=>a.id),retired:ACHIEVEMENTS.filter(a=>a.activity&&!a.activity.startsWith('*:')&&!MENU_AVAILABLE.has(a.activity.split(':')[0])).map(a=>a.id)};});
   check('pre-registry completion already uses 21 spots/postcards and excludes unavailable activities',!pre.registryLoaded&&pre.parts.filter(p=>['spots','postcards'].includes(p.key)).every(p=>p.total===21)&&pre.retired.every(id=>!pre.active.includes(id)),pre);release();
  }
  await ready(page);const initial=await snapshot(page);report[mode]=initial;
  check(mode+' runtime registry scope',initial.ids.length===(mode==='developer'?24:21)&&initial.allIds.length===24&&new Set(initial.ids).size===initial.ids.length,initial.ids);
  if(mode!=='developer')check(mode+' post-registry inactive activities remain excluded',initial.retiredIds.every(id=>!initial.activeIds.includes(id)),initial.retiredIds);
  await menu(page,mode,touch,mode==='developer'?24:21);
  if(mode!=='developer')await panelTargets(page,mode,touch);
  if(mode==='desktop'){
   const current=await loadFixture(page,'current'),legacy=await loadFixture(page,'legacy');
   check('legacy all24 visits/postcards/tours count exactly the same available scope as current21',JSON.stringify(current.state.completion.parts)===JSON.stringify(legacy.state.completion.parts)&&JSON.stringify(current.state.counts)===JSON.stringify(legacy.state.counts)&&Math.abs(current.state.completion.exact-legacy.state.completion.exact)<1e-9,{current:current.state,legacy:legacy.state});
   check('legacy retired/unknown unlocks and all24 saved records remain stored',legacy.state.saved.spots.length===24&&legacy.state.saved.postcards.length===24&&[...legacy.fixture.retired,'retired-unknown-fixture'].every(id=>legacy.state.saved.unlocked[id]===legacy.fixture.stamp),legacy.state.saved);
   report.legacy=legacy.state;
  }
  if(mode!=='developer'){
   const full=await loadFixture(page,'full');report[mode+'Full']=full.state;
   check(mode+' current catalogue/live-activity fixture reaches exactly100%',full.state.completion.pct===100&&full.state.completion.all&&Math.abs(full.state.completion.exact-100)<1e-9&&full.state.completion.unlocked===full.state.completion.total&&full.state.completion.total===full.fixture.active.length,full.state.completion);
   await click(page,'#achv-menu',touch);await page.waitForFunction(()=>document.querySelector('#achv-panel.show'));await shot(page,mode+'-current-completion100');await click(page,'#achv-panel [data-achv-act="close"]',touch);
   if(mode==='desktop'){const minus=await loadFixture(page,'minus-one');check('one actual active achievement missing stays99%',!!minus.fixture.drop&&minus.state.completion.pct===99&&!minus.state.completion.all,minus.state.completion);await page.evaluate(id=>game.achievements.unlock(id),minus.fixture.drop);const done=await snapshot(page);check('real unlock of last current active entry reaches100%',done.completion.pct===100&&done.completion.all,done.completion);}
  }
  if(mode==='phone'){
   await click(page,'#spot-select > summary',true);await page.waitForFunction(()=>document.querySelector('#spot-select').open);
   await click(page,'#spot-select [data-spot="fremont-troll"]',true);await page.waitForFunction(()=>game.state==='spot'&&game.spotId==='fremont-troll',null,{timeout:240000});
   const route=await page.evaluate(()=>({state:game.state,id:game.spotId,city:game.spotEntry?.city,zone:game.r3d.clock?.timeZone,title:document.querySelector('#spot-ui')?.textContent.slice(0,160)}));
   check('phone native recommended button opens the actual Seattle Troll session',route.state==='spot'&&route.id==='fremont-troll'&&route.city==='seattle'&&route.zone==='America/Los_Angeles',route);await shot(page,'phone-native-recommended-entry');await page.evaluate(()=>game.leaveSpot());
  }
  await ctx.close();
 }
 check('no browser exceptions or console errors',report.errors.length===0&&report.consoleErrors.length===0,{errors:report.errors,consoleErrors:report.consoleErrors});report.complete=true;
})().catch(e=>{report.fatal=e.stack||String(e);report.complete=false;process.exitCode=1;}).finally(async()=>{for(const c of contexts)await c.close().catch(()=>{});await browser?.close();await new Promise(r=>server.close(r));persist();if(report.checks.some(c=>!c.pass)||report.errors.length||report.consoleErrors.length)process.exitCode=1;});
