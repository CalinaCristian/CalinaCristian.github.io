module.exports=async({page,save,capture,args})=>{
 const prefix=args.phone?'phone':'desktop',rows=[];
 const inspect=()=>page.evaluate(()=>{
  const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}:null;};
  const panel=document.querySelector('.bg-game'),tour=document.querySelector('#spot-ui .sp-card');
  return{viewport:{w:innerWidth,h:innerHeight},panel:rect(panel),tour:rect(tour),participating:document.getElementById('spot-ui').classList.contains('sp-participating'),buttons:[...panel.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;return{text:b.textContent,disabled:b.disabled,rect:rect(b),centerInViewport:cx>=0&&cx<innerWidth&&cy>=0&&cy<innerHeight,centerHit:!b.disabled&&document.elementFromPoint(cx,cy)?.closest('button')===b};}),observerActive:!!game.spot.ui._activityLayout,tourState:game.spot.tour?{state:game.spot.tour.state,i:game.spot.tour.i,stops:game.spot.tour.stops.map(t=>({kind:t.kind,id:t.id,participated:t.participated}))}:null};
 });
 const start=await inspect();rows.push(start);await capture(prefix+'-layout-portrait');
 if(args.phone){await page.setViewportSize({width:844,height:390});await page.evaluate(()=>new Promise(requestAnimationFrame));rows.push(await inspect());await capture('phone-layout-landscape');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(requestAnimationFrame));}
 const file=save(prefix+'-native-layout',{scope:'Actual scene/DOM portrait and optional short landscape readback. Scrollable offscreen controls retained and classified; no DOM/source mutation.',rows});
 return{file,rows:rows.map(r=>({viewport:r.viewport,panel:r.panel,tour:r.tour,buttons:r.buttons.length,visibleEnabled:r.buttons.filter(b=>!b.disabled&&b.centerInViewport).length,visibleEnabledHit:r.buttons.filter(b=>!b.disabled&&b.centerInViewport&&b.centerHit).length,minVisibleButtonHeight:Math.min(...r.buttons.filter(b=>b.centerInViewport).map(b=>b.rect.h)),participating:r.participating,observerActive:r.observerActive}))};
};
