import * as THREE from '../vendor/three.module.min.js';
import {convexHull} from './bridge-profile-geometry.js';

const modelBounds=new WeakMap(),poses=new WeakMap();
const rotation=new THREE.Matrix4(),euler=new THREE.Euler(0,0,0,'YXZ');

/** Conservative projection of the complete emitted model bound, unioned with
 * the native collision rectangle. Unknown models keep the legacy occupancy. */
function bodyFootprint(v){
    const mesh=v.mesh,g=mesh?.userData?._model?.geo,p=g?.attributes?.position;
    const pitch=v.pitch??mesh?.rotation?.x??0,roll=v.roll??mesh?.rotation?.z??0,s=v.scale||mesh?.scale;
    const values=[v.x,v.z,v.heading,v.length,v.width,pitch,roll,s?.x,s?.y,s?.z];
    if(!p?.count||!values.every(Number.isFinite)||v.length<=0||v.width<=0||p.itemSize!==3||p.normalized)return null;
    let b=modelBounds.get(g);
    if(!b||b.p!==p||b.version!==p.version||b.count!==p.count){
        b={p,version:p.version,count:p.count,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
        for(let i=0;i<p.count;i++)for(let k=0;k<3;k++){
            const a=k===0?p.getX(i):k===1?p.getY(i):p.getZ(i);
            if(!Number.isFinite(a))return null;
            b.min[k]=Math.min(b.min[k],a);b.max[k]=Math.max(b.max[k],a);
        }
        modelBounds.set(g,b);
    }
    const old=poses.get(v);if(old?.bounds===b&&values.every((x,i)=>x===old.values[i]))return old.poly;
    rotation.makeRotationFromEuler(euler.set(pitch,v.heading,roll,'YXZ'));
    const m=rotation.elements,points=[];
    for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])
        points.push([v.x+m[0]*x*s.x+m[4]*y*s.y+m[8]*z*s.z,v.z+m[2]*x*s.x+m[6]*y*s.y+m[10]*z*s.z]);
    const fx=-Math.sin(v.heading),fz=-Math.cos(v.heading);
    for(const a of[-1,1])for(const c of[-1,1])points.push([v.x+fx*v.length/2*a-fz*v.width/2*c,v.z+fz*v.length/2*a+fx*v.width/2*c]);
    const poly=convexHull(points);poses.set(v,{values,bounds:b,poly});return poly;
}

// Final junction pads are convex hulls. Inclusive SAT keeps touching rears
// occupied and catches edge crossings even when neither polygon has a vertex inside.
function intersects(a,b){
    for(const p of[a,b])for(let i=0;i<p.length;i++){
        const q=p[(i+1)%p.length],nx=q[1]-p[i][1],nz=p[i][0]-q[0];
        let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
        for(const[x,z]of a){const v=x*nx+z*nz;a0=Math.min(a0,v);a1=Math.max(a1,v);}
        for(const[x,z]of b){const v=x*nx+z*nz;b0=Math.min(b0,v);b1=Math.max(b1,v);}
        const eps=64*Number.EPSILON*(1+Math.max(Math.abs(a0),Math.abs(a1),Math.abs(b0),Math.abs(b1)));
        if(a1<b0-eps||b1<a0-eps)return false;
    }
    return true;
}

/** Read the final, complete native pad catalogue once. This changes only phase
 * occupancy; the original full movement reservation remains in Traffic.boxes. */
export function signalPadOccupancy(world){
    if(!Array.isArray(world?.ribbons))return()=>null;
    const byNode=new Map(),byController=new WeakMap();
    for(const r of world.ribbons){
        if(!r.node)continue;
        const p=r.poly;let sign=0;
        let valid=Array.isArray(p)&&p.length>=3&&p.every(v=>v.length===2&&v.every(Number.isFinite));
        if(valid)for(let i=0;i<p.length;i++){
            const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
            if(Math.abs(cross)<1e-10)continue;
            if(sign&&Math.sign(cross)!==sign){valid=false;break;}sign=Math.sign(cross);
        }
        valid=valid&&sign!==0;
        const rows=byNode.get(r.node)||[];rows.push(valid?p:null);byNode.set(r.node,rows);
    }
    return(v,controller,reservation)=>{
        if(!controller||typeof controller!=='object')return null;
        if(controller.nodes?.some(n=>n.pad&&!byNode.has(n)))return null;
        let base=byController.get(controller);
        if(!base){
            base=[];
            for(const[node,pads]of byNode)if(node===controller||node.lightCluster===controller)base.push(...pads);
            byController.set(controller,base);
        }
        const pads=base.slice();
        for(const n of[reservation?.entryNode,reservation?.exitNode])if(n){
            if(n.pad&&!byNode.has(n))return null;
            if(n!==controller&&n.lightCluster!==controller)pads.push(...(byNode.get(n)||[]));
        }
        if(!pads.length||pads.some(p=>!p))return null;
        const body=bodyFootprint(v);if(!body)return null;
        return pads.some(p=>intersects(body,p));
    };
}
