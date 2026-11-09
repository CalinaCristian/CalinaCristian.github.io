import {BufferAttribute} from '../../game/vendor/three.module.min.js';
// Share only vertices with identical complete Float32 attribute bit patterns.
// Index/triangle order and every expanded shader input remain unchanged.
export function deduplicateAttributes(g){
 const entries=Object.entries(g.attributes),n=g.attributes.position.count,views=entries.map(([,a])=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length)),remap=new Uint32Array(n),representatives=[],buckets=new Map();
 for(let i=0;i<n;i++){
  let hash=2166136261;for(let a=0;a<entries.length;a++){const size=entries[a][1].itemSize;for(let k=0;k<size;k++)hash=Math.imul(hash^views[a][i*size+k],16777619)>>>0;}
  let bucket=buckets.get(hash),found=-1;
  for(const candidate of bucket||[]){const old=representatives[candidate];let equal=true;for(let a=0;a<entries.length&&equal;a++){const size=entries[a][1].itemSize;for(let k=0;k<size;k++)if(views[a][i*size+k]!==views[a][old*size+k]){equal=false;break;}}if(equal){found=candidate;break;}}
  if(found<0){found=representatives.length;representatives.push(i);if(!bucket){bucket=[];buckets.set(hash,bucket);}bucket.push(found);}remap[i]=found;
 }
 for(let a=0;a<entries.length;a++){const[name,attr]=entries[a],array=new attr.array.constructor(representatives.length*attr.itemSize),bits=new Uint32Array(array.buffer);for(let i=0;i<representatives.length;i++)for(let k=0;k<attr.itemSize;k++)bits[i*attr.itemSize+k]=views[a][representatives[i]*attr.itemSize+k];g.setAttribute(name,new BufferAttribute(array,attr.itemSize,attr.normalized));}
 const index=representatives.length>65535?new Uint32Array(g.index.count):new Uint16Array(g.index.count);for(let i=0;i<index.length;i++)index[i]=remap[g.index.array[i]];g.setIndex(new BufferAttribute(index,1));
 return{beforeVertices:n,afterVertices:representatives.length,triangles:g.index.count/3};
}
