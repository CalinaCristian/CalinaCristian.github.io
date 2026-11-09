'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
exports.install=require('./controls.cjs').install;
exports.run=async(page,out)=>{
 const report={sourceCommit:'1e6400893716fb5e02112e88346c5b1132e88996',toolSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),scope:'Auxiliary-buffer ownership/release at every selected quality. Native input applies the existing mirror policy. GPU readback completes submitted work; environment work is recorded rather than cancelled or treated as a display leak.',rows:[]};
 const save=()=>fs.writeFileSync(path.join(out,'resource-controls.json'),JSON.stringify(report,null,2)+'\n');
 for(let repeat=0;repeat<2;repeat++)for(const quality of ['low','medium','high','auto']){
  const row=await page.evaluate(({repeat,quality})=>{
   const g=game,r=g.renderer,gl=r.getContext(),h=g.r3d.cockpitDisplays;
   const get=()=>{const result=[];const add=(name,value)=>{if(!value)return;if(Array.isArray(value)){for(const v of value)add(name,v);return;}const kind=value instanceof WebGLFramebuffer?'Framebuffer':value instanceof WebGLTexture?'Texture':value instanceof WebGLRenderbuffer?'Renderbuffer':null;if(kind&&!result.some(e=>e.object===value))result.push({name,kind,object:value});};for(const t of [h.lowTarget,h.savedDepth,h.planeDepth]){for(const [key,value]of Object.entries(r.properties.get(t)))add(t.texture.name+':'+key,value);add(t.texture.name+':color',r.properties.get(t.texture).__webglTexture);if(t.depthTexture)add(t.texture.name+':depth',r.properties.get(t.depthTexture).__webglTexture);}return result;};
   const alive=e=>e.kind==='Texture'?gl.isTexture(e.object):e.kind==='Framebuffer'?gl.isFramebuffer(e.object):gl.isRenderbuffer(e.object);
   const previous=window.displayPreviousHandles||[];
   g.r3d.setQuality(quality);g.quality=quality;g.updateDrive(1/30);g.updateDrive(1/30);
   const frames=[];harness.H._renderNow=true;
   try{for(let i=0;i<3;i++){const carry={...r.info.render};r.info.reset();g.drawFrame({mirror:true});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));frames.push({preFrameCarry:carry,stats:{...g.r3d.stats},displayStats:{...g.r3d.displayStats},environmentPending:!!g.r3d._envJob,environmentFade:g.r3d._envFade});}}
   finally{harness.H._renderNow=false;}
   const current=get(),retired=previous.filter(e=>!current.some(c=>c.object===e.object));window.displayPreviousHandles=current;
   const targets=[h.lowTarget,h.savedDepth,h.planeDepth].map(t=>({name:t.texture.name,width:t.width,height:t.height,samples:t.samples,initialized:!!r.properties.get(t).__webglFramebuffer,depthTexture:!!t.depthTexture}));
   return{repeat,quality,frames,targets,ownedGpuHandles:current.map(({name,kind})=>({name,kind})),ownedGpuHandleCounts:Object.fromEntries(['Framebuffer','Texture','Renderbuffer'].map(k=>[k,current.filter(e=>e.kind===k).length])),retiredHandles:retired.map(e=>({name:e.name,kind:e.kind,stillAlive:alive(e)})),resources:{...r.info.memory,programs:r.info.programs.length},gpu:displayGpuSnapshot(),context:gl.getContextAttributes(),mirror:{enabled:g.player.mirrorEnabled,visible:g.player.mirror.visible,width:g.player.mirrorTarget.width,height:g.player.mirrorTarget.height},population:{vehicles:g.traffic.vehicles.length,pooled:g.traffic.pool.length,pedestrians:g.traffic.peds.list.length},contextLost:gl.isContextLost()};
  },{repeat,quality});
  report.rows.push(row);save();
  assert.equal(row.contextLost,false);assert.equal(row.context.antialias,false);assert(row.retiredHandles.every(e=>!e.stillAlive),'An auxiliary GPU handle survived its owning target resize');
  for(const f of row.frames){assert(f.stats.drawCalls<=400&&f.stats.triangles<=1500000);assert(f.displayStats.outputPixels<=4000000);}
  const post=row.frames.at(-1).stats.post;
  assert(row.targets.filter(t=>t.name!=='low-world'||post==='off').every(t=>t.initialized));
  if(quality==='low'){assert.equal(row.mirror.enabled,false);assert.equal(row.mirror.visible,false);}
 }
 for(const q of ['low','medium','high','auto']){
  const[a,b]=report.rows.filter(r=>r.quality===q);assert.deepEqual(a.ownedGpuHandleCounts,b.ownedGpuHandleCounts,q+' auxiliary object growth');
 }
 report.disposal=await page.evaluate(()=>{
  const h=game.r3d.cockpitDisplays,r=game.renderer,gl=r.getContext(),sourceObjects=h.bindings.map(b=>b.source),events=[];
  for(const o of sourceObjects){o.geometry.addEventListener('dispose',()=>events.push(o.name+':geometry'));o.material.addEventListener('dispose',()=>events.push(o.name+':material'));}
  const handles=window.displayPreviousHandles||[];h.dispose();
  return{sourceGeometryOrMaterialDisposals:events,targetsDeleted:handles.map(e=>({name:e.name,kind:e.kind,stillAlive:e.kind==='Texture'?gl.isTexture(e.object):e.kind==='Framebuffer'?gl.isFramebuffer(e.object):gl.isRenderbuffer(e.object)})),bindingCount:h.bindings.length,helperSceneChildren:h.scene.children.length};
 });save();assert.deepEqual(report.disposal.sourceGeometryOrMaterialDisposals,[]);assert(report.disposal.targetsDeleted.every(e=>!e.stillAlive));assert.equal(report.disposal.bindingCount,0);assert.equal(report.disposal.helperSceneChildren,0);
 report.complete=true;save();return report;
};
