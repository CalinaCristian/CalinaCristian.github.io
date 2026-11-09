module.exports=function(g){
 const old=g.renderer.renderBufferDirect,rows=[];let draws;
 g.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){const a={...this.info.render},r=old.apply(this,arguments),b=this.info.render;if(b.calls!==a.calls||b.triangles!==a.triangles)draws.push({calls:b.calls-a.calls,triangles:b.triangles-a.triangles,pass:camera===g.camera?'main':camera===g.player.mirrorCam?'mirror':camera===g.r3d.sun?.shadow.camera?'shadow':'other',object:object.name,material:material.name});return r;};
 try{for(let i=0;i<2;i++){draws=[];const pre={...g.renderer.info.render},t=performance.now();g.drawFrame({mirror:true});const gl=g.renderer.getContext();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));rows.push({pre,post:{...g.renderer.info.render},stats:{...g.r3d.stats},elapsedMs:performance.now()-t,draws,quality:g.quality,size:[g.renderer.domElement.width,g.renderer.domElement.height],pixelRatio:g.renderer.getPixelRatio(),fov:g.camera.fov,far:g.camera.far,mirror:g.player.mirrorEnabled});}}
 finally{g.renderer.renderBufferDirect=old;}return rows;
};
