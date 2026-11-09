#!/usr/bin/env node
// Geometry-only compiler. Canvas commands are inert here: no texture pixels,
// browser render, reference image or screenshot is produced or substituted.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {decodeSourceContext,sourceTerrainField,unknownContextVerticalParts} from '../../game/src/spots/source-context-data.js';
import {buildBuildings as buildings} from '../../game/src/spots/osm.js';
import {GeoBatch,compactTriangles} from '../../game/src/spots/kit.js';
import {encodeContextContainer,decodeContextContainer} from '../../game/src/spots/context-array-codec.js';
import {deduplicateAttributes} from './deduplicate-attributes.mjs';
const [input,planFile,output]=process.argv.slice(2);if(!input||!planFile||!output)throw Error('input.json native-plan.json output.json.gz');
const raw=fs.readFileSync(input),source=JSON.parse(raw),frame=source.frame,data=decodeSourceContext(source,frame),field=sourceTerrainField(source.terrain,frame.origin,frame.projection);
data.buildingGeometry=JSON.parse(fs.readFileSync(planFile));
const unresolvedVerticalSourceIds=unknownContextVerticalParts(data).map(b=>b.id),unresolvedSet=new Set(unresolvedVerticalSourceIds),known=b=>!unresolvedSet.has(b.id);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const makeContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:t=>({width:String(t).length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:tag=>{if(tag!=='canvas')throw Error('Unexpected geometry compiler DOM '+tag);return{width:0,height:0,getContext:()=>makeContext()};}};
const ground={heightAt:(x,z)=>{const y=field.heightAt(x,z);if(y==null)throw Error('Unknown source terrain');return y;}};
let current=null,capture=true;const ranges=new Map(),originalAdd=GeoBatch.prototype.add;
GeoBatch.prototype.add=function(g,key,m,color,opts){
 if(capture){assert.equal(m,null,'Source geometry must already be in the canonical frame');assert(current,'Missing source ownership');const c=g.clone();compactTriangles(c);const count=c.index.count;c.dispose();if(count){const list=ranges.get(key)||[];list.push({source:current,count});ranges.set(key,list);}}
 return originalAdd.call(this,g,key,m,color,opts);
};
const full=buildings(data,ground,{filter:known,onSourceVolume:id=>current=id});capture=false;
assert.equal(full.sourceGeometry.cacheHit,true,'A validated native source plan is required');
const batches=[],deduplication=[];
for(const mesh of full.group.children){
 const key=mesh.name.slice('osm-buildings:'.length),r=ranges.get(key)||[],g=mesh.geometry;
 let at=0;const sourceRanges=r.map(({source,count})=>{const o={source,start:at,count};at+=count;return o;});assert.equal(at,g.index.count,'Source ownership must cover every final triangle');
 deduplication.push({key,...deduplicateAttributes(g)});
 batches.push({key,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{array:a.array,itemSize:a.itemSize}])),index:g.index.array,sourceRanges});
}
const decoded=new Map(batches.map(b=>[b.key,{b,attrs:Object.fromEntries(Object.entries(b.attributes).map(([k,a])=>[k,a.array])),index:b.index}]));
// Compare actual expanded vertex attribute streams, including winding, UVs,
// colours and normals. This is independent of buffer index renumbering.
const expandedHash=(attrs,index)=>{const h=crypto.createHash('sha256');for(const key of Object.keys(attrs).sort()){const a=attrs[key],n=key==='uv'?2:3,values=new Float32Array(index.length*n);let at=0;for(const i of index)for(let k=0;k<n;k++)values[at++]=a[i*n+k];h.update(key);h.update(Buffer.from(values.buffer));}return h.digest('hex');};
const controls=[];
for(const scene of['seattle-center','pike-place']){
 const native=JSON.parse(fs.readFileSync(`game/data/spots/${scene}.json`)),skip=new Set(native.buildings.map(b=>b.id)),expected=buildings(data,ground,{filter:known,reuseSceneSourceIds:skip});assert.equal(expected.sourceGeometry.cacheHit,true);
 let triangles=0;
 for(const mesh of expected.group.children){const key=mesh.name.slice('osm-buildings:'.length),got=decoded.get(key),idx=[];for(const r of got.b.sourceRanges)if(!skip.has(r.source))for(let i=r.start;i<r.start+r.count;i++)idx.push(got.index[i]);
  const attrs=Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,a.array]));assert.equal(expandedHash(got.attrs,idx),expandedHash(attrs,mesh.geometry.index.array));triangles+=idx.length/3;}
 controls.push({scene,matchedNativeSourceIds:expected.sourceGeometry.reusedSceneSourceIds.length,triangleAttributeStreamsIdentical:true,triangles});
}
GeoBatch.prototype.add=originalAdd;
const sourceConsumers=['game/src/spots/osm.js','game/src/spots/source-buildings.js','game/src/spots/kit.js','game/src/building-parts.js','game/src/building-roofs.js','game/src/spots/source-context-data.js','game/src/spots/context-array-codec.js'];
const result={schemaVersion:1,renderPolicy:'native-source-context-v1',sourceDataSHA256:hash(raw),profileSignatureSHA256:hash(Buffer.from(data.buildingGeometry.signature)),frame,unresolvedVerticalSourceIds,
 sourceConsumerHashes:Object.fromEntries(sourceConsumers.map(p=>[p,hash(fs.readFileSync(p))])),batches,colliders:full.colliders,sourceGeometry:full.sourceGeometry,sourceMembers:full.sourceMembers.map(m=>({source:m.source,volume:m.volume,minHeight:m.minHeight,top:m.top})),
 controls,deduplication,provenance:'Actual native source/profile/visibility/roof/GeoBatch geometry. Geometry-only inert canvas context; actual material pixels and native image/budget acceptance remain separate.'};
const container=encodeContextContainer(result),roundtrip=decodeContextContainer(container);for(let i=0;i<batches.length;i++){assert.deepEqual(roundtrip.batches[i].index,batches[i].index);for(const[k,a]of Object.entries(batches[i].attributes))assert.deepEqual(roundtrip.batches[i].attributes[k].array,a.array);}
fs.writeFileSync(output,zlib.gzipSync(container,{level:9,mtime:0}));
console.log(JSON.stringify({output,bytes:fs.statSync(output).size,uncompressedBytes:container.length,batches:batches.length,triangles:full.tris,colliders:full.colliders.length,sourceRecords:full.sourceGeometry.sourceRecords,losslessBinaryRoundtrip:true,controls},null,2));
