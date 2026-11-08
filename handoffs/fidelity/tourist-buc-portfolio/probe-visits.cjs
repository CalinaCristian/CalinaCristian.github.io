const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path');
const repo=process.argv[2] || process.cwd();
const out=process.argv[3] || '/tmp/tourist-buc-probe.json';
const ids=['old-town-lipscani','stavropoleos-cec','arcul-de-triumf','palace-parliament','peoples-salvation-cathedral','cismigiu','village-museum','herastrau-park','athenaeum-revolution','spring-palace'];
(async()=>{
 const server=http.createServer((req,res)=>{let f=path.join(repo,decodeURIComponent(req.url.split('?')[0]));fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'content-type':{'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css'}[path.extname(f)]||'application/octet-stream'});res.end(e?'missing':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720}}), results=[];
 await ctx.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
 try {for(const id of ids){
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/dev/spots.html?id=${id}&date=2026-07-05T10:00:00Z&ov=day&season=summer&weather=clear&manual=1&audit=0`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.spotDev?.ready,null,{timeout:90000});
  const r=await page.evaluate(()=>{
   const s=spotDev.session,p=s.position,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),length=a=>a?.slice(1).reduce((n,q,i)=>n+Math.hypot(q[0]-a[i][0],q[1]-a[i][1]),0);
   const objectives=s.objectives().map(o=>({kind:o.kind,label:o.label,x:o.x,z:o.z,straight:dist(p,o)}));
   const acts=s.spot.interactables.filter(i=>!['guide','talk','plaque'].includes(i.kind)).map(i=>({kind:i.kind,label:typeof i.label==='function'?i.label(s):i.label,x:i.x,z:i.z,y:i.y,r:i.r,straight:dist(p,i),hidden:i.hidden}));
   const nearest=acts.filter(i=>!i.hidden&&i.y==null).sort((a,b)=>a.straight-b.straight).slice(0,4);
   for(const a of nearest){const path=s._navPath(p.x,p.z,a.x,a.z);a.route=path;a.routeMetres=length(path);a.endGap=path?Math.hypot(path.at(-1)[0]-a.x,path.at(-1)[1]-a.z):null;}
   let tour;try{s.startTour();tour=s.tour?{guide:{x:s.guide.x,z:s.guide.z},stops:s.tour.stops.map(t=>({label:t.label,kind:t.kind,x:t.x,z:t.z,tx:t.tx,tz:t.tz,routeMetres:length(t.path),endpointGap:Math.hypot(t.x-t.tx,t.z-t.tz)}))}:null;}catch(e){tour={error:e.message};}
   const data=s.spot.data;
   return {id:s.spot.id,spawn:{x:p.x,y:p.y,z:p.z},objectives,acts,nearest,tour,members:data.members,origin:data.origin,extras:Object.keys(s.spot.ctx.extras),loadMs:spotDev.loadMs};
  });r.errors=errors;results.push(r);fs.writeFileSync(out,JSON.stringify(results,null,2));console.log(id,JSON.stringify({spawn:r.spawn,nearest:r.nearest.map(a=>({label:a.label,d:a.straight,route:a.routeMetres,gap:a.endGap})),tour:r.tour?.stops?.map(a=>({label:a.label,d:a.routeMetres,gap:a.endpointGap})),errors}));
  await page.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
