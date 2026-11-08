// Native controller access proof. Temporary pedestrian buffers affect planning only;
// no source geometry, collider, crowd member or player coordinate is edited.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),{chromium}=require('playwright');
const out=process.env.OUT,root=process.env.GAME_SOURCE_ROOT,port=process.env.PORT||8192,ids=(process.env.SPOTS||'fremont-troll,mopop').split(',');
fs.mkdirSync(out,{recursive:true});
const revision=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({viewport:{width:1280,height:720}});await context.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
 const page=await context.newPage();page.setDefaultTimeout(300000);
 for(const id of ids){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/game/dev/spots.html?id=${id}&manual=1&audit=0&q=high&ov=day&weather=clear&season=summer&date=2026-07-15T12:00:00Z&ui=0`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.spotDev?.ready,null,{timeout:180000});await page.evaluate(()=>spotDev.step(1,.05));
  console.log('loaded',id);
  const result=await page.evaluate(async()=>{
   const s=spotDev.session,S=s.spot,{findWalkPath,pathLength,walkSegment}=await import('../src/spots/tour.js'),{collide}=await import('../src/spots/walker.js');
   const start={...s.position},nearest=S.plaques.slice().sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z))[0];
   const goal=[nearest.x+Math.sin(nearest.mesh.rotation.y)*1.2,nearest.z+Math.cos(nearest.mesh.rotation.y)*1.2];
   const staticPath=findWalkPath(S.ground,S.colliders,start.x,start.z,...goal,{radius:1.2,maxLength:180});
   const footprint=JSON.stringify(S.data.buildings),population=S.crowd?.peds.length||0,colliderCount=S.colliders.length;
   const events=[],trace=[];let points=null,index=1,steps=0,walked=0,stuck=0,error=null,detours=0;
   const obstacles=()=>S.crowd.obstacles(s.position.x,s.position.z,1000).map(p=>({x:p.x,z:p.z,r:.4,hw:.4,prop:true,y0:p.y-.3,y1:p.y+2}));
   const replan=()=>{const p=s.position;const next=findWalkPath(S.ground,[...S.colliders,...obstacles()],p.x,p.z,...goal,{radius:1.2,maxLength:200});if(next){points=next;index=1;events.push({kind:'pedestrian-aware-plan',position:{...p},points:next,length:pathLength(next)});return true;}return false;};
   if(!replan()){points=staticPath;events.push({kind:'static-plan-fallback'});}
   if(!points)return{passed:false,error:'No physical public path to plaque',start,goal,target:nearest.title};
   for(;steps<5000;steps++){
    const p=s.position;if(Math.hypot(p.x-goal[0],p.z-goal[1])<1.2)break;
    if(index>=points.length){if(!replan()){error='No continuation to exact interaction point';break;}}
    const target=points[index],dx=target[0]-p.x,dz=target[1]-p.z;
    if(Math.hypot(dx,dz)<.65){index++;continue;}
    s.ctl.auto={fwd:1,side:0,heading:Math.atan2(-dx,-dz)};s.update(.05);
    const now=s.position,delta=Math.hypot(now.x-p.x,now.z-p.z);walked+=delta;stuck=delta<.008?stuck+1:0;
    if(delta>.8){error='Unexpected relocation';break;}
    if(steps%10===0)trace.push({...now,step:steps,delta});
    if(stuck>20){
     const hit=collide(S.colliders,now.x,now.z,.34,now.y+.3);
     events.push({kind:'blocked',position:{...now},staticHit:hit?{source:hit.hit.source,kind:hit.hit.kind,poly:!!hit.hit.poly}:null,pedestrians:S.crowd.obstacles(now.x,now.z,2).map(p=>({x:p.x,z:p.z,y:p.y}))});
     if(++detours>12){error='Detour limit reached';break;}
     if(!replan()){
      let side=null;for(const a of [Math.PI/2,-Math.PI/2,Math.PI/3,-Math.PI/3,Math.PI]){
       const heading=Math.atan2(-dx,-dz)+a,q=[now.x-Math.sin(heading)*1.6,now.z-Math.cos(heading)*1.6];
       if(!walkSegment(S.ground,S.colliders,[now.x,now.z],q)||obstacles().some(o=>Math.hypot(q[0]-o.x,q[1]-o.z)<.9))continue;
       side=q;break;
      }
      if(!side){error='No legal physical sidestep';break;}
      points=[[now.x,now.z],side];index=1;events.push({kind:'native-sidestep',to:side});
     }
     stuck=0;
    }
   }
   s.ctl.auto=null;s.input.keys?.clear?.();for(let k=0;k<8;k++)s.update(.05);
   return{passed:!error&&Math.hypot(s.position.x-goal[0],s.position.z-goal[1])<1.2,error,walker:s.walkerKind,start,goal,target:nearest.title,staticPath,staticLength:staticPath&&pathLength(staticPath),position:{...s.position},walked,steps,simulationSeconds:steps*.05,detours,events,trace,populationBefore:population,populationAfter:S.crowd.peds.length,colliderCountBefore:colliderCount,colliderCountAfter:S.colliders.length,sourceBuildingRecordsUnchanged:footprint===JSON.stringify(S.data.buildings),sourceGeometry:S.ctx.extras.buildings.sourceGeometry,sourceMembers:S.ctx.extras.buildings.sourceMembers.map(v=>({source:v.source,volume:v.volume,minHeight:v.minHeight,top:v.top}))};
  });
  await page.evaluate(()=>spotDev.step(.1,.05));
  const frame=await page.evaluate(()=>({image:document.querySelector('#gl').toDataURL('image/webp',.85),triangles:spotDev.r3d.stats.triangles,drawCalls:spotDev.r3d.stats.drawCalls}));
  fs.writeFileSync(path.join(out,id+'.webp'),Buffer.from(frame.image.split(',')[1],'base64'));delete frame.image;
  fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify({revision,id,method:'Actual OnFootController automatic walking and legal sidesteps. Dynamic pedestrian circles are temporary planner buffers only; scene colliders/population/source records remain intact. No dev walkTo/teleport during travel.',...result,frame,errors},null,2)+'\n');
  console.log(id,JSON.stringify({passed:result.passed,walked:result.walked,steps:result.steps,detours:result.detours,error:result.error}));
 }
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
