// Actual DOM/Input/SpotSession/activityFlow state regression. No 3D renderer or physical-route claim.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.argv[2]||'/tmp/tourist-flow-state';
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{if(req.url==='/fixture.html'){res.setHeader('content-type','text/html');res.end('<!doctype html><body></body>');return;}try{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type',p.endsWith('.js')?'application/javascript':p.endsWith('.json')?'application/json':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({headless:true,args:['--mute-audio']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture.html`);
 await page.evaluate(async()=>{
  document.body.innerHTML='';
  const [{SpotSession},{SpotUI},{activityFlow},{Input},THREE]=await Promise.all([import('/game/src/spots/index.js'),import('/game/src/spots/ui.js'),import('/game/src/spots/participation.js'),import('/game/src/input.js'),import('/game/vendor/three.module.min.js')]);
  const updates=[],ctx={extras:{},onUpdate:f=>updates.push(f)},s=Object.create(SpotSession.prototype);
  Object.assign(s,{t:0,nightK:0,progress:{},input:new Input(),camera:new THREE.PerspectiveCamera(),host:{},r3d:{nightLights:false},ui:new SpotUI(document.body),sound:{update(){}},guide:{x:0,z:0,speed:0},map:{setRoute(){},update(){}},spot:{id:'old-town-lipscani',name:'Test visit',sceneId:'state-fixture',scene:new THREE.Scene(),ground:{heightAt:()=>0,groundAt:()=>0},ctx,updaters:updates,nightHooks:[],interactables:[]}});
  s.ctl={x:0,z:0,y:0,active:true,update(){},get position(){return{x:this.x,y:this.y,z:this.z};}};
  s._navPath=()=>[[0,0],[3,0]];s._refreshMarkers=()=>{};s._pushOut=()=>{};
  const interaction={};
  const reset=()=>{s.tour={stops:[{kind:'activity',interaction,x:0,z:0,label:'Complete an activity',path:[[0,0],[0,0]],tx:0,tz:0},{kind:'plaque',x:3,z:0,label:'Next stop',radius:1}],i:0,state:'walk',wait:0,said:false,t:0,travelled:0,skipped:0};s._tourUI();};
  const flow=activityFlow(ctx);let awards=0,cancels=0;
  const begin=()=>{s._usingInteraction=interaction;const ok=flow.begin(s,{title:'Real activity flow',action:'Finish',complete:()=>awards++,cancel:()=>cancels++});s._usingInteraction=null;return ok;};
  window.fixture={s,flow,reset,begin,counts:()=>({awards,cancels})};reset();
 });
 const stages=[];
 const check=async(name,fn)=>{const result=await page.evaluate(fn);assert.equal(result,true,name);stages.push(name);};
 await check('Opening a modal activity preserves the active itinerary',()=>{const f=fixture,T=f.s.tour;return f.begin()&&f.s.tour===T&&f.s.tour.i===0&&!T.stops[0].participated;});
 await check('Cancellation restores walking without completing or restarting the stop',()=>{const f=fixture,T=f.s.tour;f.flow.cancel('leave');return f.s.tour===T&&T.i===0&&!T.stops[0].participated&&f.s.ctl.active&&f.counts().cancels===1;});
 await check('Actual flow completion advances exactly once even before guide arrival',()=>{const f=fixture;f.begin();f.flow.complete();f.flow.complete();return f.s.tour.i===1&&f.counts().awards===1;});
 await page.locator('[data-tour-skip]').click();
 await check('Visible skip control ends skipped itinerary without awarding a tour',()=>fixture.s.tour.state==='done'&&fixture.s.tour.skipped===1&&!fixture.s.progress.tours);
 await page.evaluate(()=>fixture.reset());await page.keyboard.press('j');await page.evaluate(()=>fixture.s.update(0));
 await check('Native J shortcut reaches session skip logic',()=>fixture.s.tour.i===1&&fixture.s.tour.skipped===1);
 await check('Compound club entry waits for its named completed activity',()=>{const f=fixture;f.reset();const st=f.s.tour.stops[0];st.interaction.tourActivityIds=['freddo-dance'];f.s.recordTourActivity('old-town-lipscani','unrelated');if(f.s.tour.i!==0)return false;f.s.recordTourActivity('old-town-lipscani','freddo-dance');return f.s.tour.i===1;});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>fixture.reset());
 const phone=await page.locator('[data-tour-skip]').boundingBox();assert(phone&&phone.x>=0&&phone.x+phone.width<=390);
 await page.screenshot({path:path.join(out,'tour-step-phone.png')});
 assert.deepEqual(errors,[]);
 const report={passed:true,scope:'Actual native DOM/Input/SpotSession/modal-flow state with explicit synthetic stops, flat ground and stub route provider. No physical access, scene beauty, or hardware FPS claim.',checks:stages,errors};
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
