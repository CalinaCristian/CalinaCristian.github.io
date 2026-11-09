import * as THREE from '../../vendor/three.module.min.js';
import {terrainDistanceScale} from './source-terrain-projection.js';

/** Every original triangle belongs to one chunk; bounds use its actual vertices. */
export function terrainIndexChunks(positions,index,{chunkM=8000,eyeBoundM=1000}={}){
    const chunks=new Map(),point=new THREE.Vector3();
    for(let i=0;i<index.length;i+=3){
        const ids=[index[i],index[i+1],index[i+2]],x=ids.reduce((s,k)=>s+positions[k*3]/3,0),z=ids.reduce((s,k)=>s+positions[k*3+2]/3,0),key=Math.floor(x/chunkM)+','+Math.floor(z/chunkM);
        let c=chunks.get(key);if(!c){c={key,indices:[],box:new THREE.Box3(),minScale:1,maxCoordinate:0};chunks.set(key,c);}
        for(const k of ids){
            if(!Number.isSafeInteger(k)||k<0||k*3+2>=positions.length)throw Error('Invalid regional index');
            const p=point.set(positions[k*3],positions[k*3+1],positions[k*3+2]);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z))throw Error('Unknown regional vertex');
            c.indices.push(k);c.box.expandByPoint(p);c.minScale=Math.min(c.minScale,terrainDistanceScale(Math.hypot(p.x,p.z)));c.maxCoordinate=Math.max(c.maxCoordinate,Math.abs(p.x),Math.abs(p.y),Math.abs(p.z));
        }
    }
    // Rendering-only IEEE roundoff allowance for morph/view/projection arithmetic;
    // no source coordinate, collision band or physical width is changed.
    const u=2**-24,gamma=32*u/(1-32*u);
    return[...chunks.values()].map(c=>{const numericalGuardM=gamma*(3*c.maxCoordinate+eyeBoundM/c.minScale+1);return{key:c.key,index:Uint32Array.from(c.indices),box:c.box.clone().expandByScalar(numericalGuardM),numericalGuardM};});
}

/** Positive per-vertex ray scaling preserves angular clip planes; omit far only. */
export function selectTerrainIndices(chunks,sourceViewProjection,output){
    const frustum=new THREE.Frustum().setFromProjectionMatrix(sourceViewProjection),planes=[...frustum.planes.slice(0,4),frustum.planes[5]];let count=0,visibleChunks=0;
    for(const c of chunks){
        const b=c.box,visible=planes.every(p=>p.normal.x*(p.normal.x>0?b.max.x:b.min.x)+p.normal.y*(p.normal.y>0?b.max.y:b.min.y)+p.normal.z*(p.normal.z>0?b.max.z:b.min.z)+p.constant>=0);
        if(visible){output.set(c.index,count);count+=c.index.length;visibleChunks++;}
    }
    return{count,triangles:count/3,visibleChunks,totalChunks:chunks.length};
}
