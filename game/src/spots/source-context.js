import * as THREE from '../../vendor/three.module.min.js';
import {decodeSourceContext,sourceTerrainField,unknownContextVerticalParts} from './source-context-data.js';
import {decodeContextContainer,validateContextBatches} from './context-array-codec.js';
import {sourceRecord,sourcePlanSignature,sourceHeroMembers} from './source-buildings.js';
import {facadeMaterial,buildingStyle,polyCollider,onGround} from './osm.js';
import {mat} from './kit.js';
import {simpleFootprint} from '../building-parts.js';
import {paintSourceContext,buildSourceContextGround} from './source-context-surface.js';
import {prepareContextWater,addSourceContextWater,addSourceContextTrees} from './source-context-landscape.js';
const CACHE_POLICY='native-source-context-v1';
let packetPromise;
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function assetBytes(name){
    const response=await fetch(new URL(`../../data/spots/${name}`,import.meta.url));if(!response.ok)throw Error(`Source context HTTP${response.status}`);
    let bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return{bytes,digest:await sha(bytes)};
}
async function packet(){
    if(!packetPromise)packetPromise=(async()=>{
        const [a,b]=await Promise.all([assetBytes('seattle-context.json.gz'),assetBytes('seattle-context-render.bin.gz')]),source=JSON.parse(new TextDecoder().decode(a.bytes)),cache=decodeContextContainer(b.bytes);
        if(cache.schemaVersion!==1||cache.renderPolicy!==CACHE_POLICY||cache.sourceDataSHA256!==a.digest)throw Error('Source context cache/input mismatch');
        await Promise.all(Object.entries(cache.sourceConsumerHashes).map(async([path,expected])=>{
            if(!/^game\/src\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.js$/.test(path))throw Error('Invalid context consumer path');
            const response=await fetch(new URL(path,new URL('../../../',import.meta.url)));if(!response.ok||await sha(await response.arrayBuffer())!==expected)throw Error('Source context native geometry consumer changed: '+path);
        }));
        const data=decodeSourceContext(source,source.frame),field=sourceTerrainField(source.terrain,source.frame.origin,source.frame.projection);
        validateContextBatches(cache.batches,new Set(data.buildings.map(b=>b.id)));
        const ground={heightAt:(x,z)=>{const y=field.heightAt(x,z);if(y==null)throw Error('Source context terrain unknown');return y;}};
        const unknownIds=new Set(unknownContextVerticalParts(data).map(b=>b.id));
        if(JSON.stringify([...unknownIds].sort())!==JSON.stringify([...cache.unresolvedVerticalSourceIds].sort()))throw Error('Source context vertical scope mismatch');
        const records=data.buildings.map((r,i)=>unknownIds.has(r.id)?null:sourceRecord(r,i,ground,{house:buildingStyle(r,true)==='house'})).filter(Boolean);
        if(await sha(new TextEncoder().encode(sourcePlanSignature(records)))!==cache.profileSignatureSHA256)throw Error('Source context profile/terrain cache mismatch');
        const batches=cache.batches;delete cache.batches;
        return{source,cache,data,field,batches,sourceSHA256:a.digest,renderSHA256:b.digest};
    })().catch(e=>{packetPromise=null;throw e;});
    return packetPromise;
}
export async function prepareSourceContext(ctx,{heroSourceIds=[],replaceNativeSourceIds=[]}={}){
    const p=await packet(),f=p.source.frame,sameFrame=f.origin.lat===ctx.data.origin.lat&&f.origin.lon===ctx.data.origin.lon&&f.origin.elev===ctx.data.origin.elev&&f.projection.mLat===ctx.data.projection.mLat&&f.projection.mLon===ctx.data.projection.mLon;
    const field=sameFrame?p.field:sourceTerrainField(p.source.terrain,ctx.data.origin,ctx.data.projection);
    ctx.ground.sourceTerrain={heightAt:field.heightAt,sourceSHA256:p.source.terrain.sourceSHA256,basis:field.basis,transitionM:ctx.data.terrain.d};
    const nativeIds=new Set(ctx.data.buildings.map(b=>b.id));
    const nativeSourceCorrections=[];
    for(const id of replaceNativeSourceIds){const old=ctx.data.buildings.find(b=>b.id===id),components=p.source.buildings.filter(b=>b.sourceId===id);
        if(!old||components.length<2||simpleFootprint(old.poly))throw Error('Native source component correction no longer matches its evidence: '+id);
        ctx.skipBuildings.add(id);nativeIds.delete(id);nativeSourceCorrections.push({sourceId:id,oldRecordRetained:true,reason:'Separate source outer rings were concatenated into one invalid native polygon',componentIds:components.map(b=>b.id)});
    }
    const unresolvedVertical=unknownContextVerticalParts(p.data).map(b=>({id:b.id,rawTags:b.rawTags,reason:'elevated-source-part-minimum-unknown',nativeSceneRetained:nativeIds.has(b.id)}));
    const modelOmitIds=new Set([...nativeIds,...unresolvedVertical.map(b=>b.id)]);
    const heroReplacementSourceIds=[...sourceHeroMembers(p.data.buildings,new Set(heroSourceIds))],visualOmitIds=new Set([...modelOmitIds,...heroReplacementSourceIds]);
    ctx.extras.sourceContext={packet:p,nativeIds,modelOmitIds,visualOmitIds,heroReplacementSourceIds,nativeSourceCorrections,unresolvedVertical,sourceDataSHA256:p.sourceSHA256,renderSHA256:p.renderSHA256,
        sourceRecords:p.data.buildings.length,unknownDimensionEstimates:p.cache.sourceGeometry.typeHeightEstimates,
        literalHeights:p.cache.sourceGeometry.literalHeights,sourceLevelEstimates:p.cache.sourceGeometry.levelHeightEstimates,
        unresolvedSourceClosure:p.source.unresolvedSourceClosure,renderedSourceIds:[],reusedNativeSourceIds:[...nativeIds].filter(id=>p.data.buildings.some(b=>b.id===id)),
        scope:'Literal bounded OSM context and USGS terrain; unknown dimensions/materials remain estimates. Not a source survey or photographic-parity certificate.'};
    const state=ctx.extras.sourceContext;state.localData=sameFrame?p.data:decodeSourceContext(p.source,ctx.data);
    state.unmodeledWayGrades=state.localData.ways.filter(w=>!onGround(w)).map(w=>({id:w.id,layer:w.layer,level:w.level,bridge:w.bridge,tunnel:w.tunnel,reason:'Elevated/underground source path has no modeled context grade; layer is not metres'}));
    state.unmodeledDeckAreas=state.localData.areas.filter(a=>['pier','bridge','quay'].includes(a.rawTags.man_made)).map(a=>({id:a.id,reason:'Literal source footprint retained; structural deck height/volume is not modeled by terrain painting'}));
    state.water=prepareContextWater(ctx,state.localData,{x0:-4000,z0:-3600,x1:4000,z1:3600});
    ctx.ground.sourceTerrain.waterAt=state.water.waterAt;
    paintSourceContext(ctx,state.localData);
    return state;
}
export function addSourceContext(ctx){
    buildSourceContextGround(ctx);addSourceContextBuildings(ctx);addSourceContextWater(ctx);addSourceContextTrees(ctx,ctx.extras.sourceContext.localData);
    return ctx.extras.sourceContext;
}
/** Whole-source chunks: only native scene duplicates are reused. Every other
 * original triangle remains available; actual indexed bounds drive frustum culling. */
function addSourceContextBuildings(ctx,{chunkM=800}={}){
    const state=ctx.extras.sourceContext;if(!state)throw Error('Source context not prepared');
    const p=state.packet,group=new THREE.Group();group.name='literal-source-city-context';group.userData.noFloor=true; // Source solids/roofs are not crowd step platforms.
    const sourceBounds=new Map();
    for(const b of p.data.buildings){const xs=b.poly.map(q=>q[0]),zs=b.poly.map(q=>q[1]);sourceBounds.set(b.id,{x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2});}
    const rendered=new Set();let triangles=0,meshes=0;
    for(const batch of p.batches){
        const chunks=new Map();
        for(const r of batch.sourceRanges){if((state.visualOmitIds||state.modelOmitIds).has(r.source))continue;const b=sourceBounds.get(r.source);if(!b)throw Error('Unknown cached source owner');
            const key=`${Math.floor(b.x/chunkM)},${Math.floor(b.z/chunkM)}`,a=chunks.get(key)||[];
            for(let i=r.start;i<r.start+r.count;i++)a.push(batch.index[i]);chunks.set(key,a);rendered.add(r.source);
        }
        const material=batch.key.startsWith('f-')?facadeMaterial(batch.key.slice(2)):mat(batch.key);material.side=THREE.DoubleSide;
        const attributes=Object.fromEntries(Object.entries(batch.attributes).map(([k,a])=>[k,new THREE.BufferAttribute(a.array,a.itemSize)]));
        for(const[key,indices]of chunks){
            const g=new THREE.BufferGeometry();for(const[k,a]of Object.entries(attributes))g.setAttribute(k,a);
            g.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices),1));
            // Position arrays are shared; default computeBoundingSphere would
            // use the whole city. Bounds must cover only this actual index set.
            const box=new THREE.Box3(),v=new THREE.Vector3(),positions=g.attributes.position;
            for(const i of indices)box.expandByPoint(v.fromBufferAttribute(positions,i));
            g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new THREE.Sphere());
            const mesh=new THREE.Mesh(g,material);mesh.name=`source-context:${batch.key}:${key}`;mesh.castShadow=false;mesh.receiveShadow=false;
            mesh.userData.sourceContext=true;mesh.userData.sourceTriangleCount=indices.length/3;group.add(mesh);triangles+=indices.length/3;meshes++;
        }
    }
    const origin=ctx.ll(p.source.frame.origin.lat,p.source.frame.origin.lon),sx=ctx.data.projection.mLon/p.source.frame.projection.mLon,sz=ctx.data.projection.mLat/p.source.frame.projection.mLat,dy=p.source.frame.origin.elev-ctx.data.origin.elev;
    group.scale.set(sx,1,sz);group.position.set(origin.x,dy,origin.z);ctx.add(group);
    let colliders=0;
    for(const c of p.cache.colliders){const sources=c.sources.filter(id=>!state.modelOmitIds.has(id));if(!sources.length)continue;
        const convert=ring=>ring.map(([x,z])=>[origin.x+x*sx,origin.z+z*sz]),poly=convert(c.poly),holes=(c.holes||[]).map(convert);
        ctx.collider({...polyCollider(poly,c.y0+dy,c.y1+dy),holes,source:sources[0],sources,sourceContext:true});colliders++;
    }
    state.renderedSourceIds=[...rendered];state.renderedTriangles=triangles;state.meshChunks=meshes;state.physicalVolumes=colliders;state.group=group;
    return state;
}
