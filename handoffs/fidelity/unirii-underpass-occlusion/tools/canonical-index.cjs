// Read-only observation of the existing native cellFrustum raycast index swap.
// encode receives a detached typed-array copy; no mesh/World reference escapes.
module.exports=function captureCanonicalIndex(mesh,raycaster,encode){
 const g=mesh.geometry,meta=mesh.userData?.cellFrustum;
 if(!g||!meta)return{required:false,reason:'not-native-cellFrustum'};
 const oldIndex=g.index,oldRange={...g.drawRange},descriptor=Object.getOwnPropertyDescriptor(g,'setIndex'),setIndex=g.setIndex,raycast=mesh.raycast;
 const oldBytes=oldIndex.array.slice(),oldVersion=oldIndex.version,oldUpdates=(oldIndex.updateRanges||[]).map(r=>({...r})),oldSphere=g.boundingSphere,oldBox=g.boundingBox;
 let source=null,range=null,calls=0,exception=null;
 const witness={required:true,basis:'existing native cellFrustum.raycast temporary setIndex',sourceIndices:meta.sourceIndices,captured:false,restored:false};
 const sameArray=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const observer=function(...args){
  calls++;
  if(this!==g)throw Error('Unexpected setIndex receiver');
  if(args[0]!==oldIndex&&args[0]?.array){if(source&&source.pointer!==args[0])throw Error('Multiple native canonical index pointers');source={pointer:args[0],array:args[0].array.slice(),normalized:args[0].normalized,itemSize:args[0].itemSize,count:args[0].count};}
  if(source&&this.index===source.pointer&&args[0]===oldIndex)range={...this.drawRange};
  return setIndex.apply(this,args);
 };
 Object.defineProperty(g,'setIndex',{value:observer,configurable:true,writable:true,enumerable:descriptor?.enumerable??false});
 try{raycast.call(mesh,raycaster,[]);}catch(e){exception=e;}
 finally{
  // Native raycast has its own finally. This is a second restoration boundary.
  if(g.index!==oldIndex)setIndex.call(g,oldIndex);
  if(g.drawRange.start!==oldRange.start||g.drawRange.count!==oldRange.count)g.setDrawRange(oldRange.start,oldRange.count);
  g.boundingSphere=oldSphere;g.boundingBox=oldBox;
  if(descriptor)Object.defineProperty(g,'setIndex',descriptor);else delete g.setIndex;
  witness.restoration={indexPointer:g.index===oldIndex,indexBytes:sameArray(oldBytes,g.index.array),indexVersion:g.index.version===oldVersion,updateRanges:JSON.stringify(g.index.updateRanges||[])===JSON.stringify(oldUpdates),drawRange:g.drawRange.start===oldRange.start&&g.drawRange.count===oldRange.count,setIndexPointer:g.setIndex===setIndex,setIndexOwnDescriptor:JSON.stringify(Object.getOwnPropertyDescriptor(g,'setIndex'))===JSON.stringify(descriptor),raycastPointer:mesh.raycast===raycast,geometryPointer:mesh.geometry===g,boundingSpherePointer:g.boundingSphere===oldSphere,boundingBoxPointer:g.boundingBox===oldBox};
  witness.restored=Object.values(witness.restoration).every(Boolean);
 }
 witness.calls=calls;
 if(exception){const error=Error('Native raycast observation failed: '+String(exception.message||exception));error.witness=witness;throw error;}
 if(!witness.restored)throw Object.assign(Error('Native canonical observation changed selection state'),{witness});
 if(!source||!range||source.count!==meta.sourceIndices||source.itemSize!==1)throw Object.assign(Error('Missing/incomplete native canonical index witness'),{witness});
 const available=Number.isFinite(range.count)?range.count:source.count-range.start;
 if(range.start<0||available<0||range.start+available>source.count)throw Object.assign(Error('Invalid canonical source draw range'),{witness});
 witness.captured=true;
 return{required:true,canonicalIndex:encode(source.array,{itemSize:source.itemSize,normalized:source.normalized,count:source.count}),canonicalDrawRange:{start:range.start,count:Number.isFinite(range.count)?range.count:null,countIsUnbounded:!Number.isFinite(range.count)},canonicalCapture:witness};
};
