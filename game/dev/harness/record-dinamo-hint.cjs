// Record the actual Dinamo goal physics with held-key Drone._fly input.
// Run from the repository root; writes 160 PNG frames + capture.json (20 fps, 8 s).
// The controller's real drone model is shown through a third-person camera; physics
// and goal detection are never replaced or directly awarded by this recorder.
// Encode: ffmpeg -framerate 20 -i /tmp/secret-bar-clip/frame-%03d.png \
//   -c:v libvpx-vp9 -b:v 220k -crf 34 -an -pix_fmt yuv420p game/assets/wcp/dinamo-hint.webm
const assert = require('node:assert/strict');
const fs = require('node:fs'); const http = require('node:http'); const path = require('node:path');
const {chromium} = require('playwright');
const root=process.cwd(), out=process.env.OUT || '/tmp/secret-bar-clip';
(async()=>{
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'content-type':{'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.bin':'application/octet-stream'}[path.extname(f)]||'application/octet-stream'});res.end(e?'missing':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const ctx=await browser.newContext({viewport:{width:480,height:270}});await ctx.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
await page.goto(`http://127.0.0.1:${server.address().port}/game/`);await page.waitForFunction(()=>window.game);fs.mkdirSync(out,{recursive:true});

await page.evaluate(async()=>{
 const g=game;await g.startFreeRoam('floreasca',{tod:'noon',weather:'clear',season:'summer'});g.audio.setMuted(true);g.exitCar();
 const f=g.football,c=f.pitch.center,a=f.pitch.axis;
 window.pitchPoint=(u,v,h)=>f.source.localToWorld(new g.camera.position.constructor(c[0]+a[0]*u+a[1]*v,c[1]+h,c[2]+a[1]*u-a[0]*v));
 const w=pitchPoint(0,0,30);g.foot.x=w.x;g.foot.z=w.z-160;g.foot.y=0;
 const d=g.explore.drone;d.deploy();d.t=3;d._lift(.05);d.pos.copy(pitchPoint(-4,0,.32));d.vel.set(0,0,0);d.yaw=Math.atan2(-a[0],-a[1]);d.mode=1;
 f.reset();f.update(.05,d);g.camera.fov=62;g.camera.updateProjectionMatrix();g.input.keys.add('KeyW');window.samples=[];
 document.querySelectorAll('body>*:not(canvas)').forEach(el=>el.style.display='none');
});
for(let i=0;i<160;i++){
 const frame=await page.evaluate(i=>{
  const g=game,f=g.football,d=g.explore.drone;
  if(i>=12&&f.physics.goals===0){d._fly(.05);f.update(.05,d);} else g.input.keys.clear();
  if(i===12)g.input.keys.add('KeyW');
  // Third-person broadcast camera: render the same physical drone normally hidden by its first-person camera.
  d.model.visible=true;d.model.position.copy(d.pos);d.model.rotation.set(0,d.yaw,0);
  for(const r of d.model.userData.rotors)r.blades.rotation.y+=r.dir*.8;
  d.model.userData.disc.opacity=.24;
  const p=f.physics.pos, u=f.physics.goals ? f.pitch.halfLength : p.u;
  g.camera.position.copy(pitchPoint(u-3.0,-4.3,2.3));g.camera.lookAt(pitchPoint(u+1.9,0,.55));
  g.updateClock(0);g.drawFrame();
  samples.push({frame:i,ball:{...p},drone:f.local(d.pos),touched:f.physics.touched,goals:f.physics.goals});
  return g.canvas.toDataURL('image/png').split(',')[1];
 },i);
 fs.writeFileSync(path.join(out,`frame-${String(i).padStart(3,'0')}.png`),Buffer.from(frame,'base64'));
}
const samples=await page.evaluate(()=>samples);assert.ok(samples.some(s=>s.touched));assert.equal(samples.at(-1).goals,1);assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({samples,errors},null,2));console.log(JSON.stringify({frames:samples.length,touch:samples.find(s=>s.touched),goal:samples.find(s=>s.goals),errors}));
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
