import * as THREE from '../../vendor/three.module.min.js';
import {decodeRegionalContainer} from './regional-array-codec.js';
import {terrainProjectionAttributes,terrainMorphBounds,installSourceTerrainFog} from './source-terrain-projection.js';
import {terrainIndexChunks,selectTerrainIndices,terrainMeshViewSelection} from './source-terrain-visibility.js';
import {waterMaterial} from './scenes/sea-common.js';

const packets=new Map();let manifestPromise;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function loadBytes(path){
    const r=await fetch(new URL('../../data/spots/'+path,import.meta.url));if(!r.ok)throw Error('Regional source asset HTTP '+r.status);
    let bytes=new Uint8Array(await r.arrayBuffer());
    if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return bytes;
}
async function packet(id){
    if(!packets.has(id))packets.set(id,(async()=>{
        manifestPromise??=loadBytes('seattle-regional-manifest.json').then(b=>JSON.parse(new TextDecoder().decode(b)));
        const manifest=await manifestPromise,asset=manifest.scenes[id];if(!asset)throw Error('No regional source frame '+id);
        const bytes=await loadBytes(asset.path);if(await digest(bytes)!==asset.uncompressedSHA256)throw Error('Regional cache hash mismatch');
        const cache=decodeRegionalContainer(bytes);
        if(cache.schemaVersion!==1||cache.renderPolicy!=='regional-source-terrain-v1'||cache.sourceDataSHA256!==manifest.source.uncompressedSHA256)throw Error('Regional source/cache mismatch');
        const nativeBytes=await loadBytes(id+'.json');if(await digest(nativeBytes)!==cache.nativeSceneDataSHA256)throw Error('Regional native source changed');
        await Promise.all(Object.entries(cache.sourceConsumerHashes).map(async([path,expected])=>{
            if(!/^game\/src\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.js$/.test(path))throw Error('Invalid regional consumer path');
            const response=await fetch(new URL(path,new URL('../../../',import.meta.url)));
            if(!response.ok||await digest(await response.arrayBuffer())!==expected)throw Error('Regional geometry consumer changed: '+path);
        }));
        for(const b of cache.batches){
            if(!['terrain','water','shore'].includes(b.key))throw Error('Unknown regional batch');
            for(const key of['position','normal','sourceTerrainAltitude',b.key==='water'?'uv':'color'])if(!b.attributes[key])throw Error('Missing regional attribute '+key);
            const n=b.attributes.position?.array.length/3;
            if(!Number.isInteger(n)||!n||b.index.length%3||!b.index.every(i=>i<n))throw Error('Invalid regional indices');
            for(const[key,a]of Object.entries(b.attributes)){
                const size=key==='sourceTerrainAltitude'?1:key==='uv'?2:3;
                if(a.itemSize!==size||a.array.length!==n*size||!a.array.every(Number.isFinite))throw Error('Invalid regional attribute '+key);
            }
        }
        return{manifest,cache};
    })().catch(e=>{packets.delete(id);throw e;}));
    return packets.get(id);
}

/** Pure numeric cache only is shared; scene objects and callbacks remain local. */
export async function prepareRegionalTerrain(ctx){
    const p=await packet(ctx.data.id),c=p.cache;
    if(!['lat','lon','elev'].every(k=>c.frame.origin[k]===ctx.data.origin[k])||!['mLat','mLon'].every(k=>c.frame.projection[k]===ctx.data.projection[k]))throw Error('Regional native frame changed');
    const state={...p,waterExtensionRecords:c.waterExtensionRecords,sourceContextDataSHA256:c.sourceContextDataSHA256,loaded:true,rendered:false};
    ctx.extras.regionalTerrain=state;return state;
}

/** Far render-only source geometry. Existing close-up terrain and bodies remain first. */
export function addRegionalTerrain(ctx){
    const s=ctx.extras.regionalTerrain;if(!s?.loaded)throw Error('Regional source not prepared');
    const c=s.cache,group=new THREE.Group();group.name='regional-source-terrain';group.userData.noFloor=true;
    const eye=new THREE.Vector3(),localEye=new THREE.Vector3(),vp=new THREE.Matrix4(),bufferSize=new THREE.Vector2(),meshes=[];
    let far=0;const eyeMin=c.eyeBounds.min,eyeMax=c.eyeBounds.max;
    for(const b of c.batches){
        const raw=b.attributes.position.array,projected=terrainProjectionAttributes(raw),g=new THREE.BufferGeometry();
        for(const[key,a]of Object.entries(b.attributes))if(key!=='position')g.setAttribute(key,new THREE.BufferAttribute(a.array,a.itemSize));
        g.setAttribute('position',new THREE.BufferAttribute(projected.position,3));g.setAttribute('sourceTerrainScale',new THREE.BufferAttribute(projected.scale,1));
        g.morphAttributes.position=projected.morphs.map(a=>new THREE.BufferAttribute(a,3));g.morphTargetsRelative=true;
        const output=new Uint32Array(b.index.length);output.set(b.index);g.setIndex(new THREE.BufferAttribute(output,1));
        const bounds=terrainMorphBounds(projected,eyeMin,eyeMax);g.boundingBox=new THREE.Box3(new THREE.Vector3(...bounds.min),new THREE.Vector3(...bounds.max));g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
        far=Math.max(far,g.boundingSphere.center.length()+g.boundingSphere.radius+Math.hypot(...eyeMax.map((v,i)=>Math.max(Math.abs(v),Math.abs(eyeMin[i])))));
        const material=b.key==='water'?waterMaterial(ctx,{name:'regional-source-water',color:'#203540'}):new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});
        material.name=b.key==='water'?material.name:'regional-source-land';installSourceTerrainFog(material);
        if(b.key==='shore')material.side=THREE.DoubleSide;
        if(b.key!=='water')(ctx.extras.sourceGroundMaterials??=[]).push(material);
        const mesh=new THREE.Mesh(g,material);mesh.name='regional-source:'+b.key;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.userData.noFloor=true;
        const chunks=terrainIndexChunks(raw,b.index,{eyeBoundM:c.eyeHorizontalBoundM});meshes.push({mesh,chunks,output,selectionCache:{}});group.add(mesh);
    }
    group.userData.sourceProjection={cameraFarM:far,basis:'Retained USGS/NHD source; WGS84 ENU outside the exact native local boundary, then continuous distance compression about the actual eye',sourceDataSHA256:c.sourceDataSHA256,projectionPolicy:c.projectionPolicy,renderOnly:true};
    ctx.env.cameraFarM=Math.max(ctx.env.cameraFarM||0,far);ctx.env.backdropFarM=Math.max(ctx.env.backdropFarM||0,far);
    // Connected measured geography supplies the content edge; actual shared
    // weather now determines contrast instead of an artificial scene-edge haze.
    ctx.env.edgeM=0;ctx.add(group);s.group=group;s.rendered=true;s.totalTriangles=c.batches.reduce((n,b)=>n+b.index.length/3,0);
    const original=ctx.scene.onBeforeRender;let nativeGround=null;
    ctx.scene.onBeforeRender=function(renderer,scene,camera,...args){
        const result=original.call(this,renderer,scene,camera,...args);camera.getWorldPosition(eye);
        s.actualEye=eye.toArray();s.outsideEyeDomain=Math.hypot(eye.x,eye.z)>c.eyeHorizontalBoundM||eye.y<eyeMin[1]||eye.y>eyeMax[1];
        renderer.getDrawingBufferSize(bufferSize);const fov=2*Math.atan(Math.tan((camera.fov||60)*Math.PI/360)/(camera.zoom||1))*180/Math.PI,policy=c.waterBoundaryLOD.policy;
        s.lodCamera={effectiveVerticalFovDeg:fov,physicalHeightPx:bufferSize.y,aspect:camera.aspect,eye:s.actualEye};
        s.outsideLODEnvelope=s.outsideEyeDomain||fov<policy.fovMinDeg||fov>policy.fovMaxDeg||bufferSize.y>policy.physicalHeightPx||camera.aspect>policy.aspectMax;
        s.submittedTriangles=0;s.visibleChunks=0;
        // The standard scene finish creates these after this regional setup.
        // Their floor sampler retains the original vertices and grid topology.
        if(!nativeGround&&ctx.extras.terrain)nativeGround=[ctx.extras.terrain.inner,ctx.extras.terrain.outer].filter(m=>m.geometry.index?.count).map(m=>terrainMeshViewSelection(m));
        s.nativeGroundSubmittedTriangles=0;
        for(const item of nativeGround||[]){item.mesh.updateWorldMatrix(true,false);s.nativeGroundSubmittedTriangles+=item.update(camera).triangles;}
        for(const item of meshes){
            const m=item.mesh;m.updateWorldMatrix(true,false);localEye.copy(eye);m.worldToLocal(localEye);m.morphTargetInfluences.splice(0,3,localEye.x,localEye.y,localEye.z);
            vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(m.matrixWorld);
            const selected=selectTerrainIndices(item.chunks,vp,item.output,item.selectionCache);
            if(selected.changed){m.geometry.index.needsUpdate=true;m.geometry.setDrawRange(0,selected.count);}
            s.submittedTriangles+=selected.triangles;s.visibleChunks+=selected.visibleChunks;
        }
        return result;
    };
    return group;
}
