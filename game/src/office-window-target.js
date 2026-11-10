import * as THREE from '../vendor/three.module.min.js';

/** Pixel bounds apply only to the portal target, never to source actors/geometry. */
export function boundedOfficeWindowSize(width,height,pixelRatio=1,{maxPixels=262144,maxDimension=1024}={}){
 if(![width,height,pixelRatio].every(n=>Number.isFinite(n)&&n>0)||!Number.isSafeInteger(maxPixels)||maxPixels<1||!Number.isSafeInteger(maxDimension)||maxDimension<1)throw new RangeError('Window dimensions and positive integer pixel limits are required');
 const w=Math.ceil(width*pixelRatio),h=Math.ceil(height*pixelRatio);if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h))throw new RangeError('Requested pixel dimensions exceed safe integer range');
 const scale=Math.min(1,maxDimension/w,maxDimension/h,Math.sqrt(maxPixels/(w*h)));let x=Math.max(1,Math.floor(w*scale)),y=Math.max(1,Math.floor(h*scale));
 if(x*y>maxPixels){if(x>=y)x=Math.max(1,Math.floor(maxPixels/y));else y=Math.max(1,Math.floor(maxPixels/x));}
 return{width:x,height:y,pixels:x*y};
}
/** Grow in bounded buckets during a visit; camera motion never shrinks/reallocates a target. */
export function retainedOfficeWindowCapacity(width,height,previous=null,{maxPixels=1000000,maxDimension=2048}={}){
 const request=boundedOfficeWindowSize(width,height,1,{maxPixels,maxDimension});
 const bucket=n=>Math.min(maxDimension,Math.max(128,Math.ceil(n/128)*128));
 return{width:Math.max(previous?.width||0,bucket(request.width)),height:Math.max(previous?.height||0,bucket(request.height))};
}
/**
 * Own exactly one bounded target. Root supplies a synchronous render callback
 * for its ONE existing world, including current actors/time/weather/season.
 * This helper creates no scene, world, environment, actor, clock or timer.
 */
export function createOfficeWindowTarget({renderer,maxPixels=262144,maxDimension=1024,type=THREE.UnsignedByteType,colorSpace=THREE.LinearSRGBColorSpace,linearHDR=false}){
 if(!renderer?.getRenderTarget||!renderer?.setRenderTarget)throw new TypeError('An existing renderer is required');
 maxDimension=Math.min(maxDimension,renderer.capabilities?.maxTextureSize||maxDimension);boundedOfficeWindowSize(1,1,1,{maxPixels,maxDimension});
 let target=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,stencilBuffer:false,generateMipmaps:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 target.texture.colorSpace=colorSpace;target.texture.name='office-live-district-window';target.texture.userData.officeExternal=true;let disposed=false,capturing=false;
 const ensure=()=>{if(disposed)throw new Error('Office window target is disposed');};
 return{
  get target(){return target;},get texture(){return target?.texture||null;},get disposed(){return disposed;},
  resize(width,height,pixelRatio=1){ensure();if(capturing)throw new Error('Cannot resize a window target during capture');const size=boundedOfficeWindowSize(width,height,pixelRatio,{maxPixels,maxDimension});if(target.width!==size.width||target.height!==size.height)target.setSize(size.width,size.height);return size;},
  capture(camera,renderWorld){ensure();if(capturing)throw new Error('Recursive office window capture');if(typeof renderWorld!=='function')throw new TypeError('A synchronous existing-world renderer callback is required');
   const saved={target:renderer.getRenderTarget(),cube:renderer.getActiveCubeFace?.()??0,mip:renderer.getActiveMipmapLevel?.()??0,viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,xr:renderer.xr?.enabled,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,clearColor:renderer.getClearColor?.(new THREE.Color()).clone(),clearAlpha:renderer.getClearAlpha?.(),autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil};capturing=true;
   try{if(linearHDR){renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;}if(renderer.xr)renderer.xr.enabled=false;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setViewport(0,0,target.width,target.height);renderer.setScissor(0,0,target.width,target.height);renderer.setScissorTest(false);renderer.clear(true,true,true);const result=renderWorld(camera,target);if(result?.then)throw new TypeError('Window capture callback must be synchronous');return result;}
   finally{renderer.setRenderTarget(saved.target,saved.cube,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.toneMappingExposure;renderer.outputColorSpace=saved.outputColorSpace;renderer.autoClearColor=saved.autoClearColor;renderer.autoClearDepth=saved.autoClearDepth;renderer.autoClearStencil=saved.autoClearStencil;if(saved.clearColor)renderer.setClearColor(saved.clearColor,saved.clearAlpha);if(renderer.xr)renderer.xr.enabled=saved.xr;capturing=false;}
  },
  dispose(){if(disposed)return;if(capturing)throw new Error('Cannot dispose a window target during capture');disposed=true;target.dispose();target=null;}
 };
}
