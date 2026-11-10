import * as THREE from '../vendor/three.module.min.js';

// Source signs describe the upright vehicle, not the longer global-Y interval
// of a rigid body pitched on a ramp. Preserve all model-local transforms/scale.
const primaryBounds = new WeakMap();
const valid = n => Number.isFinite(n);
function rawBounds(g) {
    const p = g?.attributes?.position;
    if (!p || p.itemSize !== 3 || p.normalized || !p.count) return null;
    const old = primaryBounds.get(g);
    if (old?.attribute === p && old.version === p.version && old.array === p.array && old.count === p.count) return old.bounds;
    const bounds = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for (let i=0;i<p.count;i++) for (const [axis,value] of [p.getX(i),p.getY(i),p.getZ(i)].entries()) {bounds[axis]=Math.min(bounds[axis],value);bounds[axis+3]=Math.max(bounds[axis+3],value);}
    if (!bounds.every(valid)) return null;
    primaryBounds.set(g,{attribute:p,version:p.version,array:p.array,count:p.count,bounds}); return bounds;
}

/** Actual emitted primary geometry plus additional native model meshes, or the
 * authoritative cockpit hierarchy under Player.rig. No declared-height fallback
 * and no actor/world matrix updates, pose changes or random draws. */
export function sourceVehicleDimensions(actor) {
    const root = actor?.mesh || actor?.rig, body = actor?.cockpit || root;
    if (!root || !body) return {known:false,reason:'missing-native-model-root'};
    if(root.matrixAutoUpdate===false)return{known:false,reason:'manual-root-matrix-upright-basis-unresolved'};
    for (let parent=root.parent;parent;parent=parent.parent) {
        if(parent.matrixAutoUpdate===false)return{known:false,reason:'manual-parent-matrix-scale-unresolved'};
        if (parent.scale && ['x','y','z'].some(k=>Math.abs(parent.scale[k]-1)>1e-8)) return {known:false,reason:'nonunit-parent-scale-unresolved'};
    }
    const scale = actor.scale || root.scale;
    if (!scale || ![scale.x,scale.y,scale.z].every(valid)) return {known:false,reason:'unknown-native-model-scale'};
    const bounds = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity], parts = [], vertex = new THREE.Vector3();
    let unsupported = null;
    const include = p => {for(let i=0;i<3;i++){bounds[i]=Math.min(bounds[i],p[i]);bounds[i+3]=Math.max(bounds[i+3],p[i]);}};
    const primary = root.userData?._model?.geo, b = rawBounds(primary);
    if (b) {
        for (const x of [b[0],b[3]]) for (const y of [b[1],b[4]]) for (const z of [b[2],b[5]]) include([x*scale.x,y*scale.y,z*scale.z]);
        parts.push({basis:'native-primary-model-vertices',vertices:primary.attributes.position.count});
    }
    const seen = new Set();
    body.traverse?.(o => {
        if (!o.isMesh || o.geometry === primary) return;
        seen.add(o);
        if (o.isSkinnedMesh || o.morphTargetInfluences?.some(x=>x!==0) || o.userData?.cellFrustum) {unsupported='unsupported-deformed-or-private-culled-model';return;}
        const g=o.geometry,p=g?.attributes?.position;if(!p||p.itemSize!==3||p.normalized){unsupported='missing-native-model-position';return;}
        const chain=[];let n=o;for(;n&&n!==root;n=n.parent)chain.push(n);
        if(n!==root){unsupported='model-outside-physical-root';return;}
        const matrix=new THREE.Matrix4().makeScale(scale.x,scale.y,scale.z);
        for(const node of chain.reverse()) matrix.multiply(node.matrixAutoUpdate===false?node.matrix:new THREE.Matrix4().compose(node.position,node.quaternion,node.scale));
        const count=o.isInstancedMesh?o.count:1;
        for(let instance=0;instance<count;instance++){
            const m=o.isInstancedMesh?matrix.clone().multiply(new THREE.Matrix4().fromArray(o.instanceMatrix.array,instance*16)):matrix;
            for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(m);include(vertex.toArray());}
        }
        parts.push({name:o.name||'',basis:'native-model-local-hierarchy',vertices:p.count,instances:count});
    });
    // Instanced taxis emit this native detached template via
    // vehicle.matrixWorld * sign.matrix rather than a child of the actor group.
    const sign=root.userData?._taxiSign;
    if(sign&&!seen.has(sign)){
        const p=sign.geometry?.attributes?.position;
        if(!sign.isMesh||!p||p.itemSize!==3||p.normalized||!sign.matrix)unsupported='unsupported-native-detached-taxi-sign';
        else{
            const matrix=new THREE.Matrix4().makeScale(scale.x,scale.y,scale.z).multiply(sign.matrix);
            for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(matrix);include(vertex.toArray());}
            parts.push({name:sign.name||'fleet-taxi-sign',basis:'native-detached-template-matrix',vertices:p.count});
        }
    }
    if (unsupported || !parts.length || !bounds.every(valid)) return {known:false,reason:unsupported||'missing-emitted-model-geometry',parts};
    const [x0,y0,z0,x1,y1,z1]=bounds, width=x1-x0,geometryHeight=y1-y0,height=y1-Math.min(0,y0),length=z1-z0;
    if (!(width>0&&height>0&&length>0)) return {known:false,reason:'degenerate-native-model-bounds',bounds,parts};
    return {known:true,width,height,length,geometryHeight,bounds,parts,source:'emitted-model-local-geometry',basis:'Upright physical-root axes; native local hierarchy/scale retained; include support datum0 below a cockpit with no emitted wheels. World translation/yaw/road pitch excluded'};
}
