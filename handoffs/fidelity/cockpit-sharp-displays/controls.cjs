'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

exports.install=async page=>page.addInitScript(()=>{
 const kinds=['Texture','Framebuffer','Renderbuffer','Program','Shader','Buffer'];
 const created={},deleted={},live={},links=[];for(const k of kinds){created[k]=deleted[k]=0;live[k]=new Set();}
 for(const k of kinds){const p=WebGL2RenderingContext.prototype,create=p['create'+k],remove=p['delete'+k];if(!create||!remove)continue;
  p['create'+k]=function(...a){const o=create.apply(this,a);if(o){created[k]++;live[k].add(o);}return o;};
  p['delete'+k]=function(o){if(o){deleted[k]++;live[k].delete(o);}return remove.call(this,o);};}
 const proto=WebGL2RenderingContext.prototype,link=proto.linkProgram;
 proto.linkProgram=function(program){const value=link.call(this,program);links.push({t:performance.now(),phase:window.displayControlPhase||'native-startup',sources:(this.getAttachedShaders(program)||[]).map(shader=>{const s=this.getShaderSource(shader)||'';return{name:s.match(/#define SHADER_NAME ([^\n]+)/)?.[1]||null,type:s.match(/#define SHADER_TYPE ([^\n]+)/)?.[1]||null};})});return value;};
 window.displayGpuSnapshot=()=>({created:{...created},deleted:{...deleted},live:Object.fromEntries(kinds.map(k=>[k,live[k].size])),links:[...links]});
});

exports.run=async(page,out)=>{
 const report={scope:'Separate controlled regressions after native captures: explicit added occluder, authored home fallback, native exit/enter, source picking, mirror-byte equality, cold headlights and quality/resource cycles. No fixture frame is relabelled as native-world imagery.',rows:[]};
 const save=()=>fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(report,null,2)+'\n');
 const images=[];
 await page.evaluate(()=>{game.r3d.setQuality('medium');game.quality='medium';});
 async function capture(label,fixture=false,home=false){
  const row=await page.evaluate(async({label,fixture,home})=>{
   const g=game,r=g.renderer,h=g.r3d.cockpitDisplays,T=await import('/game/vendor/three.module.min.js'),V=await import('/game/src/vehicles.js');
   const source=g.player.cockpit.userData.screen,added=fixture?new T.Mesh(new T.PlaneGeometry(.085,.09),new T.MeshBasicMaterial({color:0xff00ff,toneMapped:false})):null;
   if(added){added.name='EXPLICIT_OCCLUDER_CONTROL';added.position.set(.04,.005,.025);added.layers.mask=source.layers.mask;source.add(added);}
   const rect=o=>{o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,p=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const v=new T.Vector3(x,y,b.max.z).applyMatrix4(o.matrixWorld).project(g.camera);p.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,z:v.z});}return p;};
   const hash=b=>{let v=2166136261;for(const x of b)v=Math.imul(v^x,16777619);return(v>>>0).toString(16);};
   const mirror=()=>{const t=g.player.mirrorTarget,b=new Uint8Array(t.width*t.height*4);r.readRenderTargetPixels(t,0,0,t.width,t.height,b);return b;};
   const picks=()=>{const ray=new T.Raycaster();ray.layers.mask=g.camera.layers.mask;return [[.2,.2],[.5,.5],[.8,.8]].map(([u,v])=>{const p=new T.Vector3((u-.5)*source.geometry.parameters.width,(v-.5)*source.geometry.parameters.height,0).applyMatrix4(source.matrixWorld).project(g.camera);ray.setFromCamera(new T.Vector2(p.x,p.y),g.camera);const hit=ray.intersectObject(source,false)[0];return {u,v,hit:hit?{u:hit.uv.x,v:hit.uv.y}:null};});};
   const original=h.render,callback=g.scene.onBeforeRender,mask=g.camera.layers.mask,projection=g.camera.projectionMatrix.toArray(),matrix=g.camera.matrixWorld.toArray();
   let snapshot;
   h.render=function(scene,camera){
    const before=r.domElement.toDataURL('image/png'),m0=mirror(),fleet={...V.fleetStats};delete fleet.ms;
    const dw=h.savedDepth.width,dh=h.savedDepth.height,sd=new Uint8Array(dw*dh*4),pd=new Uint8Array(dw*dh*4),protectedPixels=[];
    r.readRenderTargetPixels(h.savedDepth,0,0,dw,dh,sd);r.readRenderTargetPixels(h.planeDepth,0,0,dw,dh,pd);
    const unpack=(b,i)=>b[i]/256+b[i+1]/65536+b[i+2]/16777216+b[i+3]/(255*16777216);
    for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){const i=4*(y*dw+x),plane=unpack(pd,i);if(plane<.999999&&unpack(sd,i)+4/16777216<plane)protectedPixels.push((dh-1-y)*dw+x);}
    const beforePick=picks();original.call(this,scene,camera);
    const m1=mirror(),afterFleet={...V.fleetStats};delete afterFleet.ms;
    snapshot={before,after:r.domElement.toDataURL('image/png'),nativeOccludedPixels:{width:dw,height:dh,indices:protectedPixels},mirrorBytesUnchanged:m0.every((v,i)=>v===m1[i]),mirrorHashBefore:hash(m0),mirrorHashAfter:hash(m1),fleetBefore:fleet,fleetAfter:afterFleet,picksBefore:beforePick,picksAfter:picks(),displayPolygons:h.bindings.filter(b=>b.mesh.visible).map(b=>({name:b.source.name||'native-mirror',points:rect(b.source)})),occluderPolygon:added?rect(added):null};
   };
   try{
    harness.H._renderNow=true;g.drawCarScreen(g.hud?.el?.street?.textContent||'','');
    if(home){g.carScreen.ctx.clearRect(0,0,g.carScreen.canvas.width,g.carScreen.canvas.height);g.screenTex.needsUpdate=true;}
    r.info.reset();g.drawFrame({mirror:true});
    const gl=r.getContext();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    return {label,fixture,home,...snapshot,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},stats:{...g.r3d.stats},displayStats:{...g.r3d.displayStats},callbackUnchanged:callback===g.scene.onBeforeRender,layersUnchanged:mask===g.camera.layers.mask,projectionUnchanged:projection.every((v,i)=>v===g.camera.projectionMatrix.elements[i]),cameraWorldUnchanged:matrix.every((v,i)=>v===g.camera.matrixWorld.elements[i]),logicalCanvas:{width:g.carScreen.canvas.width,height:g.carScreen.canvas.height},homeSource:{width:source.material.userData.uHome.value.image.width,height:source.material.userData.uHome.value.image.height}};
   }finally{h.render=original;harness.H._renderNow=false;if(added){source.remove(added);added.geometry.dispose();added.material.dispose();}if(home){harness.H._renderNow=true;g.drawCarScreen('','');harness.H._renderNow=false;}}
  },{label,fixture,home});
  for(const key of ['before','after']){const name=`${label}-${key}.png`;fs.writeFileSync(path.join(out,name),Buffer.from(row[key].split(',')[1],'base64'));delete row[key];images.push(name);}
  assert(row.mirrorBytesUnchanged);assert.deepEqual(row.fleetBefore,row.fleetAfter);assert(row.callbackUnchanged&&row.layersUnchanged&&row.projectionUnchanged&&row.cameraWorldUnchanged);assert.deepEqual(row.picksBefore,row.picksAfter);assert.deepEqual(row.logicalCanvas,{width:512,height:320});
  for(const p of row.picksAfter){assert(p.hit);assert(Math.abs(p.hit.u-p.u)<1e-8&&Math.abs(p.hit.v-p.v)<1e-8);}
  report.rows.push(row);save();return row;
 }
 await capture('clear-native-plane');
 await capture('explicit-near-occluder',true);
 await capture('authored-home-fallback',false,true);
 report.headlights=[];
 for(const label of ['post-fixture-key-on','post-fixture-key-off','post-fixture-repeat-key-on']){
  const before=await page.evaluate(label=>{window.displayControlPhase=label;return displayGpuSnapshot();},label);await page.keyboard.press('l');
  const row=await page.evaluate(label=>{const g=game;g.updateDrive(1/30);g.updateDrive(1/30);harness.H._renderNow=true;g.renderer.info.reset();g.drawFrame({mirror:true});harness.H._renderNow=false;return{label,on:g.headlightsOn,gpu:displayGpuSnapshot(),stats:{...g.r3d.stats},displayStats:{...g.r3d.displayStats}};},label);
  row.gpuBefore=before;row.newLinks=row.gpu.links.slice(before.links.length);row.allocationDeltas=Object.fromEntries(['Program','Shader','Texture','Framebuffer','Renderbuffer'].map(k=>[k,row.gpu.created[k]-before.created[k]]));
  row.scope='Post-fixture input diagnostic; cold-headlight acceptance uses the separate unchanged fresh canonical headlights-check.cjs.';
  report.headlights.push(row);save();
 }
 report.modeTransitions=[];
 for(const mode of ['foot','drive']){
  const row=await page.evaluate(mode=>{const g=game;if(mode==='foot')g.exitCar();else g.enterCar();harness.H._renderNow=true;g.renderer.info.reset();g.drawFrame({mirror:true});harness.H._renderNow=false;return{mode,state:g.state,driveRigShown:g.player.driveRigShown,displayStats:{...g.r3d.displayStats},stats:{...g.r3d.stats},mirrorVisible:g.player.mirror.visible,canvasRatio:g.renderer.getPixelRatio()};},mode);
  assert.equal(row.displayStats.active,mode==='drive');if(mode==='foot')assert.equal(row.canvasRatio,row.stats.pixelRatio);
  report.modeTransitions.push(row);save();
 }
 report.layerGuard=await page.evaluate(()=>{const g=game,mask=g.camera.layers.mask;try{g.camera.layers.disable(1);harness.H._renderNow=true;g.drawFrame({mirror:true});harness.H._renderNow=false;return{active:g.r3d.displayStats.active,maskDuring:g.camera.layers.mask,originalMask:mask};}finally{g.camera.layers.mask=mask;}});assert.equal(report.layerGuard.active,false);
 report.normalLow=await page.evaluate(()=>{const g=game;g.r3d.setQuality('low');g.quality='low';g.updateDrive(1/30);g.updateDrive(1/30);harness.H._renderNow=true;g.renderer.info.reset();g.drawCarScreen('','');g.drawFrame({mirror:true});harness.H._renderNow=false;return{state:g.state,level:g.r3d.level,mirrorEnabled:g.player.mirrorEnabled,mirrorVisible:g.player.mirror.visible,displayStats:{...g.r3d.displayStats},visiblePlanes:g.r3d.cockpitDisplays.bindings.filter(b=>b.mesh.visible).map(b=>b.source.name||'native-mirror'),stats:{...g.r3d.stats},environmentPending:!!g.r3d._envJob};});
 save();assert.equal(report.normalLow.mirrorEnabled,false);assert.equal(report.normalLow.mirrorVisible,false);assert(report.normalLow.displayStats.active);assert.equal(report.normalLow.displayStats.outputPixelRatio,3);assert.equal(report.normalLow.visiblePlanes.length,2);
 await page.screenshot({path:path.join(out,'normal-low-no-forced-mirror.png')});
 // Environment generation is independent of the display buffers. Let its
 // normal native frames finish before comparing persistent per-tier resources;
 // record every warm frame instead of erasing or cancelling that work.
 report.environmentWarm=[];
 for(let i=0;i<80;i++){
  const pending=await page.evaluate(()=>({job:!!game.r3d._envJob,fade:game.r3d._envFade??1}));
  if(!pending.job&&pending.fade>=1)break;
  const row=await page.evaluate(()=>{harness.H._renderNow=true;game.renderer.info.reset();game.drawFrame({mirror:true});harness.H._renderNow=false;return{stats:{...game.r3d.stats},pending:!!game.r3d._envJob,fade:game.r3d._envFade??1,gpu:displayGpuSnapshot()};});
  report.environmentWarm.push(row);save();
 }
 report.environmentSettled=await page.evaluate(()=>!game.r3d._envJob&&(game.r3d._envFade??1)>=1);save();assert(report.environmentSettled);
 report.qualityCycles=[];
 for(let repeat=0;repeat<2;repeat++)for(const quality of ['low','medium','high','auto']){
  const row=await page.evaluate(({repeat,quality})=>{const g=game;g.r3d.setQuality(quality);g.quality=quality;harness.H._renderNow=true;for(let i=0;i<2;i++){g.renderer.info.reset();g.drawFrame({mirror:true});}harness.H._renderNow=false;const h=g.r3d.cockpitDisplays,r=g.renderer;return{repeat,quality,stats:{...g.r3d.stats},displayStats:{...g.r3d.displayStats},resources:{...r.info.memory,programs:r.info.programs.length},gpu:displayGpuSnapshot(),contextAttributes:r.getContext().getContextAttributes(),targets:[h.lowTarget,h.savedDepth,h.planeDepth].map(t=>({name:t.texture.name,width:t.width,height:t.height,samples:t.samples,texture:t.texture.uuid,initialized:!!r.properties.get(t).__webglFramebuffer,depthTexture:!!t.depthTexture})),canvas:{width:r.domElement.width,height:r.domElement.height,pixelRatio:r.getPixelRatio()}};},{repeat,quality});
  report.qualityCycles.push(row);save();
  assert(row.displayStats.outputPixels<=4000000);assert(row.targets.filter(t=>t.name!=='low-world'||row.stats.post==='off').every(t=>t.initialized));assert(row.stats.drawCalls<=400&&row.stats.triangles<=1500000);assert.equal(row.contextAttributes.antialias,false);
 }
 for(const q of ['low','medium','high','auto']){
  const [a,b]=report.qualityCycles.filter(r=>r.quality===q);assert.equal(b.resources.textures,a.resources.textures,q+' texture growth');assert.equal(b.resources.geometries,a.resources.geometries,q+' geometry growth');
  for(const k of ['Texture','Framebuffer','Renderbuffer'])assert.equal(b.gpu.live[k],a.gpu.live[k],q+' GPU object growth');
 }
 report.images=images;report.complete=true;save();return report;
};
