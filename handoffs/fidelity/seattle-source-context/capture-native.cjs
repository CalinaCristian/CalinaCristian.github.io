// One browser. Actual public app, normal keyboard walks and native elevator.
// Fixture camera placements are explicitly distinct from controller routes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const out=process.env.OUT,url=process.env.APP_URL,expected=process.env.SOURCE_SHA;
if(!out||!url||!/^[a-f0-9]{40}$/.test(expected||''))throw Error('OUT APP_URL SOURCE_SHA required');
const source=JSON.parse(fs.readFileSync(path.join(out,'source-manifest.json')));if(source.sourceCommit!==expected)throw Error('Frozen source mismatch');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),report={sourceCommit:expected,toolSHA256:hash(fs.readFileSync(__filename)),started:new Date().toISOString(),scopes:[],failures:[]};
const save=()=>fs.writeFileSync(path.join(out,'native-report.json'),JSON.stringify(report,null,2));
const inputWalk=async(page,goals,limit=60)=>page.evaluate(async({goals,limit})=>{
    const s=game.spot,c=s.ctl,g=s.spot.ground,keys=new Set(),samples=[],events=[];let goal=0,seconds=0,moved=0,still=0,maxStill=0,maxFloorError=0,maxStep=0;
    const {collideBuildings}=await import(new URL('src/world.js',location.href)),oldCollide=c.collide,contacts=[];
    if(oldCollide)c.collide=function(...args){const before={...this.position},hits=[];s.spot.colliders.query(this.x,this.z,3,col=>{const feet=this.y+(this.jumpY||0);if(col.y0a===undefined&&col.prop&&(col.h??3)+(col.y??0)<feet+.3)return;const hit=collideBuildings([col],this.x,this.z,.3,feet+.2);if(hit)hits.push({index:s.spot.colliders.indexOf(col),source:col.source,sources:col.sources,push:{px:hit.px,pz:hit.pz}});});const result=oldCollide.apply(this,args);if(hits.length)contacts.push({seconds,before,after:{...this.position},hits});return result;};
    const key=(code,on)=>{if(keys.has(code)===on)return;on?keys.add(code):keys.delete(code);window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code,bubbles:true}));},norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
    for(let i=0;i<limit*30&&goal<goals.length;i++){
        const[x,z]=goals[goal],dx=x-c.x,dz=z-c.z;if(Math.hypot(dx,dz)<.8){events.push({goal,seconds,position:{...c.position}});goal++;continue;}
        const err=norm(Math.atan2(-dx,-dz)-c.heading);key('ArrowLeft',err>.05);key('ArrowRight',err<-.05);key('KeyW',Math.abs(err)<.28);
        const before={...c.position};s.update(1/30);seconds+=1/30;const distance=Math.hypot(c.x-before.x,c.z-before.z);moved+=distance;still=distance<.002?still+1/30:0;maxStill=Math.max(maxStill,still);maxStep=Math.max(maxStep,Math.abs(c.y-before.y));
        const floor=g.groundAt(c.x,c.z,c.y),error=Math.abs(c.y-floor);maxFloorError=Math.max(maxFloorError,error);
        if(i%10===0){const nearby=[];s.spot.colliders.query(c.x,c.z,2,col=>nearby.push({index:s.spot.colliders.indexOf(col),source:col.source,sources:col.sources,prop:col.prop,wall:col.wall,x:col.x,z:col.z,r:col.r,poly:col.poly,holes:col.holes,y:col.y,h:col.h,y0:col.y0,y1:col.y1,y0a:col.y0a,y1a:col.y1a,y0b:col.y0b,y1b:col.y1b,ax:col.ax,az:col.az,bx:col.bx,bz:col.bz}));const peds=s.spot.crowd?.peds?.filter(p=>Math.hypot(p.x-c.x,p.z-c.z)<3).map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,act:p.act,speed:p.speed,persona:p.persona}));samples.push({i,goal,before,after:{...c.position},heading:c.heading,floor,error,bumped:c.bumped,nearby,peds});}
        if(still>8)break;
    }
    for(const code of keys)key(code,false);
    if(oldCollide)c.collide=oldCollide;
    return{kind:'normal-DOM-keyboard-walk',observer:'Before/after native collide, preserving receiver/args/return; exact native collideBuildings query with actual .3m body radius; no movement writes',goals,reached:goal,passed:goal===goals.length,seconds,movedM:moved,maxStillSec:maxStill,maxVerticalStepM:maxStep,maxFloorErrorM:maxFloorError,end:{...c.position},events,samples,contacts};
},{goals,limit});
(async()=>{
    const browser=await chromium.launch({headless:true,args:['--mute-audio','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    try{
        for(const id of['pike-place','space-needle']){
            const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),scope={spot:id,photos:[],routes:[],errors:[],consoleErrors:[],responses:[],started:new Date().toISOString()};report.scopes.push(scope);save();
            page.on('pageerror',e=>{scope.errors.push(e.message);save();});page.on('console',m=>{if(m.type()==='error'){scope.consoleErrors.push(m.text());save();}});
            page.on('response',r=>{if(r.url().startsWith(new URL(url).origin))scope.responses.push({url:r.url(),status:r.status(),bytes:Number(r.headers()['content-length'])||null});});
            await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
            await page.goto(url+'?weather=clear',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.game,{timeout:180000});
            scope.load=await page.evaluate(async id=>{const g=game;g._menuTod='day';g.weatherOverride='clear';g.r3d.setSeason('summer');g.r3d.setQuality('high');g.quality='high';const start=performance.now(),entered=await g.enterSpot(id);return{entered,wallMs:performance.now()-start,nativeTiming:g.spot?.spot?.timing,transport:'Fresh browser context, no service worker; local HTTP, unthrottled; not a WAN/mobile hardware load certificate'};},id);save();
            if(!scope.load.entered)throw Error(id+' native enterSpot failed');
            scope.context=await page.evaluate(()=>{const c=game.spot.spot.ctx.extras.sourceContext;return{sourceDataSHA256:c.sourceDataSHA256,renderSHA256:c.renderSHA256,sourceRecords:c.sourceRecords,contextTriangles:c.renderedTriangles,meshChunks:c.meshChunks,physicalVolumes:c.physicalVolumes,reusedNativeSourceIds:c.reusedNativeSourceIds,heroReplacementSourceIds:c.heroReplacementSourceIds,nativeSourceCorrections:c.nativeSourceCorrections,unresolvedVertical:c.unresolvedVertical,unresolvedSourceClosure:c.unresolvedSourceClosure,unmodeledWayGrades:c.unmodeledWayGrades,unmodeledDeckAreas:c.unmodeledDeckAreas,ground:{box:c.ground.box,triangles:c.ground.triangles,nativeInner:c.ground.nativeInner,waterSerialization:c.water.compiled.serialization},trees:{sourceRecords:c.trees.sourceRecords,rendered:c.trees.rendered,reusedNativeSourceIds:c.trees.reusedNativeSourceIds,unresolved:c.trees.unresolved},water:c.water.records.map(r=>({id:r.id,y:r.y,heightBasis:r.heightBasis,estimated:r.estimated,sourceIds:r.sourceIds})),sceneTriangles:game.spot.spot.tris};});save();
            async function photo(name,pose=null,kind='actual-native-pose'){
                const data=await page.evaluate(({pose,kind})=>{const g=game,s=g.spot,c=s.ctl,ground=s.spot.ground;if(pose){if(pose.x!=null)c.teleport(pose.x,pose.z,-pose.bearing*Math.PI/180);else if(pose.bearing!=null)c.heading=-pose.bearing*Math.PI/180;if(pose.pitch!=null)c.pitch=pose.pitch*Math.PI/180;c.place?.();}
                    s.update(0);g.r3d.frame(0);g.r3d.frame(0);const eye=g.camera.getWorldPosition(g.camera.position.clone()),direction=g.camera.getWorldDirection(g.camera.position.clone()),body={...c.position},nearby=[];s.spot.colliders.query(body.x,body.z,1,col=>nearby.push({source:col.source,sources:col.sources,wall:col.wall,prop:col.prop,y0:col.y0,y1:col.y1,poly:col.poly,holes:col.holes,ax:col.ax,az:col.az,bx:col.bx,bz:col.bz}));
                    return{pixels:g.canvas.toDataURL('image/jpeg',.95).split(',')[1],kind,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,hasTouch:navigator.maxTouchPoints>0,canvasWidth:g.canvas.width,canvasHeight:g.canvas.height},body,camera:{x:eye.x,y:eye.y,z:eye.z,direction:{x:direction.x,y:direction.y,z:direction.z},quaternion:g.camera.getWorldQuaternion(g.camera.quaternion.clone()).toArray(),fov:g.camera.fov,aspect:g.camera.aspect,near:g.camera.near,far:g.camera.far,pitch:c.pitch,heading:c.heading},analyticGroundY:ground.heightAt(body.x,body.z),physicalTerrainY:ground.terrainHeightAt(body.x,body.z),physicalFloorY:ground.groundAt(body.x,body.z,body.y),nearby,stats:{...g.r3d.stats},rendererInfo:{render:{...g.r3d._renderer.info.render},memory:{...g.r3d._renderer.info.memory}},conditions:{selected:g.travelConditions(),weather:g.r3d.weather,clock:{override:g.r3d.clock?.override,date:g.r3d.clock?.lastDate,lat:g.r3d.clock?.lat,lon:g.r3d.clock?.lon},season:g.r3d._seasonOverride,quality:g.r3d.stats.quality},activity:{elevator:s.spot.ctx.extras.needleElevator?.debug(),participation:s.spot.ctx.extras.participation?.active}};},{pose,kind});
                const pixels=Buffer.from(data.pixels,'base64');delete data.pixels;const file=id+'-'+name+'.jpg';fs.writeFileSync(path.join(out,file),pixels);scope.photos.push({id:name,file,captureDate:new Date().toISOString(),sourceCommit:expected,sha256:hash(pixels),bytes:pixels.length,...data});save();
            }
            await photo('spawn');
            if(id==='pike-place'){
                scope.routes.push(await inputWalk(page,[[-20,14],[-43,35],[-47,44],[-49,48],[-40,62]],65));save();await photo('walk-end',null,'normal-input-route-end');
                for(const[name,pose]of[['market-sign',{x:-35,z:25,bearing:244,pitch:4}],['stalls',{x:-80,z:3,bearing:235,pitch:0}],['gum-wall',{x:-44,z:57,bearing:120,pitch:-4}],['source-paving-counterexample',{x:-33.5,z:83.5,bearing:305,pitch:-20}]])await photo(name,pose,'fixed-validation-camera; legality and obstruction require review');
                await page.setViewportSize({width:390,height:844});await photo('phone-market-sign',{x:-35,z:25,bearing:244,pitch:4},'phone-fixed-validation-camera');await page.screenshot({path:path.join(out,'pike-place-phone-full-ui.png')});
            }else{
                scope.routes.push(await inputWalk(page,[[-.7,18.9]],20));save();await photo('elevator-approach',null,'normal-input-route-end');
                await page.keyboard.press('KeyE');await page.evaluate(()=>game.spot.update(1/30));
                scope.elevatorStart=await page.evaluate(()=>({active:game.spot.spot.ctx.extras.participation?.active,debug:game.spot.spot.ctx.extras.needleElevator?.debug(),position:{...game.spot.position}}));save();
                if(scope.elevatorStart.active){for(const segment of['lower','middle','arrival']){await page.evaluate(()=>{for(let i=0;i<420;i++)game.spot.update(1/30);});await photo('elevator-'+segment,null,'actual-native-elevator');}
                    for(const[bearing,name]of[[150,'downtown'],[255,'elliott-bay'],[20,'lake-union'],[90,'capitol-hill']])await photo('loupe-'+name,{bearing,pitch:-8},'native-elevator-arrival; orientation-only validation');
                    for(const condition of['night','winter','rain']){await page.evaluate(condition=>{game.applyRoamTime(condition==='night'?'night':'day','America/Los_Angeles');game.r3d.setClock({date:game.nowDate(),override:game.clock.override});game.setWeatherOverride(condition==='rain'?'rain':'clear');game.r3d.setWeather(condition==='rain'?'rain':'clear',{instant:true});game.r3d.setSeason(condition==='winter'?'winter':'summer');},condition);await photo('loupe-downtown-'+condition,{bearing:150,pitch:-8},'native-elevator-arrival; condition/orientation-only validation');}
                    await page.evaluate(()=>{game.applyRoamTime('day','America/Los_Angeles');game.r3d.setClock({date:game.nowDate(),override:game.clock.override});game.setWeatherOverride('clear');game.r3d.setWeather('clear',{instant:true});game.r3d.setSeason('summer');});
                    await page.setViewportSize({width:390,height:844});await photo('phone-loupe-downtown',{bearing:150,pitch:-8},'phone-native-elevator-arrival; orientation-only validation');await page.screenshot({path:path.join(out,'space-needle-phone-full-ui.png')});
                }else report.failures.push({spot:id,reason:'normal-input-elevator-not-started',raw:scope.elevatorStart});
            }
            scope.finished=new Date().toISOString();scope.badResponses=scope.responses.filter(r=>r.status>=400);if(scope.errors.length||scope.badResponses.length)report.failures.push({spot:id,reason:'native-errors-or-local-HTTP-failures'});save();await context.close();
        }
    }finally{await browser.close();report.browserClosed=new Date().toISOString();save();}
})().catch(e=>{report.failures.push({error:e.stack||e.message});save();console.error(e);process.exitCode=1;});
