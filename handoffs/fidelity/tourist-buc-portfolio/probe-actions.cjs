const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path');
const repo=process.argv[2] || process.cwd();
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.join(repo,req.url.split('?')[0]);fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'content-type':{'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css'}[path.extname(f)]||'application/octet-stream'});res.end(e?'missing':b)});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),ctx=await browser.newContext();
 await ctx.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
 const out=[];
 try{for(const id of ['cismigiu','village-museum','old-town-lipscani']){
  const page=await ctx.newPage();
  // Exercise the ride on a warm wall-clock date as well as a summer simulated date.
  await page.clock.setFixedTime(new Date('2026-07-05T10:00:00Z'));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/dev/spots.html?id=${id}&date=2026-07-05T10:00:00Z&manual=1&audit=0&ov=day&weather=clear&season=summer`);
  await page.waitForFunction(()=>window.spotDev?.ready,null,{timeout:90000});
  const v=await page.evaluate(()=>{
   const s=spotDev.session,acts=s.spot.interactables,lb=i=>typeof i.label==='function'?i.label(s):i.label;
   if(s.spot.id==='cismigiu'){
    const a=acts.find(i=>/Rent a rowing/.test(lb(i))),toasts=[];s.ui.toast=(...x)=>toasts.push(x);s.ctl.teleport(a.x,a.z);const activeBefore=s.ctl.active;a.use(s);const activeAfter=s.ctl.active;
    for(let k=0;k<10;k++)for(const f of s.spot.updaters)f(.1,s,s.position);
    return {id:s.spot.id,wallMonth:new Date().getMonth()+1,simMonth:s.r3d.simDate.getMonth()+1,label:lb(a),activeBefore,activeAfter,after1s:s.ctl.active,toasts};
   }
   if(s.spot.id==='village-museum'){
    const a=acts.filter(i=>/^Step into the house:/.test(lb(i))),start=s.position,dist=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);let best={d:Infinity};
    const rec=(p,left,path,d)=>{if(path.length===5){if(d<best.d)best={d,path};return;}for(const q of left)rec(q,left.filter(x=>x!==q),[...path,q],d+dist(p,q))};rec(start,a,[],0);
    let p={...start},total=0;const legs=[];for(const q of best.path){const path=s._navPath(p.x,p.z,q.x,q.z),L=path?.slice(1).reduce((n,q,i)=>n+Math.hypot(q[0]-path[i][0],q[1]-path[i][1]),0);legs.push({label:lb(q),routeMetres:L,endGap:path?Math.hypot(path.at(-1)[0]-q.x,path.at(-1)[1]-q.z):null});total+=L||0;p=q;}
    const toasts=[];s.ui.toast=(...x)=>toasts.push(x);for(const q of best.path)q.use(s);
    return {id:s.spot.id,stamps:a.length,shortest5Euclidean:best.d,completeRouteFound:legs.every(l=>l.routeMetres!=null),chosenRouteMetres:legs.every(l=>l.routeMetres!=null)?total:null,measuredReachableLegMetres:total,legs,completion:Array.from(s._bucDone||[]),toasts};
   }
   const a=acts.find(i=>/World Cup/.test(lb(i))),kp={x:a.x,z:a.z},pin=(x,z,p)=>{let b=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])b=!b;return b};
   const buildings=s.spot.data.buildings.filter(b=>pin(kp.x,kp.z,b.poly));const pois=s.spot.data.pois.filter(p=>dist(p,kp)<20);function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
   return {id:s.spot.id,kiosk:kp,buildings,pois};
  });out.push(v);console.log(JSON.stringify(v));await page.close();
 }}finally{await browser.close();server.close();}
 fs.writeFileSync(process.argv[3] || '/tmp/tourist-buc-actions.json',JSON.stringify(out,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
