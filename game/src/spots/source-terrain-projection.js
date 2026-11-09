// A continuous display projection for distant source terrain. Input coordinates
// and elevations stay in the numeric source; this module never changes them.
export const REGIONAL_TERRAIN_PROJECTION = Object.freeze({linearM:6000,tailM:6000});

export function terrainDistanceScale(radius,{linearM=6000,tailM=6000}={}){
    if(!Number.isFinite(radius)||radius<0||!(linearM>0&&tailM>0))throw Error('Invalid regional terrain projection');
    if(radius<=linearM)return 1;
    const t=radius-linearM;
    return(linearM+t/(1+t/tailM))/radius;
}

/** Fixed per-source-vertex scale; any eye E gives P'=kP+(1-k)E. */
export function projectTerrainPoint(point,eye,policy=REGIONAL_TERRAIN_PROJECTION){
    if(point.length!==3||eye.length!==3||![...point,...eye].every(Number.isFinite))throw Error('Unknown regional source/eye coordinate');
    const k=terrainDistanceScale(Math.hypot(point[0],point[2]),policy);
    if(k===1)return point.slice();
    return point.map((v,i)=>k*v+(1-k)*eye[i]);
}

/** Standard Three relative morph targets also work in depth/normal override passes. */
export function terrainProjectionAttributes(sourcePositions,policy=REGIONAL_TERRAIN_PROJECTION){
    if(sourcePositions.length%3)throw Error('Invalid regional terrain positions');
    const position=new Float32Array(sourcePositions.length),scale=new Float32Array(sourcePositions.length/3),morphs=Array.from({length:3},()=>new Float32Array(sourcePositions.length));
    for(let i=0;i<scale.length;i++){
        const k=terrainDistanceScale(Math.hypot(sourcePositions[i*3],sourcePositions[i*3+2]),policy);
        for(let j=0;j<3;j++){
            const p=sourcePositions[i*3+j];if(!Number.isFinite(p))throw Error('Unknown regional terrain coordinate');
            position[i*3+j]=p*k;morphs[j][i*3+j]=1-k;
        }
        scale[i]=k;
    }
    return{position,scale,morphs};
}

const boundFloat=new Float32Array(1),boundBits=new Uint32Array(boundFloat.buffer);
function nextFloat32(value,up){
    boundFloat[0]=value;
    if(boundFloat[0]===0){boundBits[0]=up?1:0x80000001;return boundFloat[0];}
    boundBits[0]+=(boundFloat[0]>0)===up?1:-1;return boundFloat[0];
}

/** Outward-rounded bounds include stored Float32 and fused/non-fused GPU arithmetic. */
export function terrainMorphBounds(attributes,eyeMin,eyeMax){
    if(eyeMin.length!==3||eyeMax.length!==3||![...eyeMin,...eyeMax].every(Number.isFinite)||eyeMin.some((v,i)=>v>eyeMax[i]))throw Error('Invalid regional eye bounds');
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<attributes.scale.length;i++)for(let j=0;j<3;j++){
        const at=i*3+j,base=attributes.position[at],delta=attributes.morphs[j][at],values=[];
        for(const eye of[eyeMin[j],eyeMax[j]]){const e=Math.fround(eye);values.push(base+delta*eye,Math.fround(base+delta*e),Math.fround(base+Math.fround(delta*e)));}
        min[j]=Math.min(min[j],nextFloat32(Math.min(...values),false));max[j]=Math.max(max[j],nextFloat32(Math.max(...values),true));
    }
    return{min,max};
}

/** Lower bound on every radial Jacobian eigenvalue in a bounded native camera domain. */
export function terrainProjectionRadialDerivative(radius,eyeRadius,policy=REGIONAL_TERRAIN_PROJECTION){
    const{linearM,tailM}=policy,k=terrainDistanceScale(radius,policy);
    if(!Number.isFinite(eyeRadius)||eyeRadius<0)throw Error('Invalid regional camera bound');
    if(radius<=linearM)return 1;
    const slope=1/(1+(radius-linearM)/tailM)**2,dk=(slope-k)/radius;
    return slope-eyeRadius*Math.abs(dk);
}

/** Restore true source distance/height before the shared aerial-perspective fog. */
export function installSourceTerrainFog(material){
    const original=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=function(shader,...args){
        original.call(this,shader,...args);
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float sourceTerrainScale;')
            .replace('#include <fog_vertex>',`#include <fog_vertex>
            #if defined(USE_FOG) && defined(FOG_EXP2)
                vFogV /= sourceTerrainScale;
                vFogH = cameraPosition.y + (vFogH - cameraPosition.y) / sourceTerrainScale;
            #endif`);
    };
    material.customProgramCacheKey=()=>cacheKey()+'|source-terrain-physical-fog-v1';
    return material;
}
