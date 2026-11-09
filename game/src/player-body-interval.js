import * as THREE from '../vendor/three.module.min.js';

// The square contains the native collision disc. Clipping complete triangles,
// including their interiors, gives a conservative emitted-body height band.
export function bodyVerticalInterval(triangles, matrix, x, z, radius) {
    let min = Infinity, max = -Infinity;
    for (const tri of triangles) {
        let P = matrix ? tri.map(p => [matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12], matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13], matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]]) : tri;
        if (Math.max(...P.map(p=>p[0])) < x-radius || Math.min(...P.map(p=>p[0])) > x+radius || Math.max(...P.map(p=>p[2])) < z-radius || Math.min(...P.map(p=>p[2])) > z+radius) continue;
        for (const [axis,limit,sign] of [[0,x-radius,1],[0,x+radius,-1],[2,z-radius,1],[2,z+radius,-1]]) {
            const Q=[];
            for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],da=sign*(a[axis]-limit),db=sign*(b[axis]-limit),ia=da>=0,ib=db>=0;if(ia)Q.push(a);if(ia!==ib){const t=da/(da-db);Q.push(a.map((v,k)=>v+(b[k]-v)*t));}}
            P=Q;if(!P.length)break;
        }
        for(const p of P){min=Math.min(min,p[1]);max=Math.max(max,p[1]);}
    }
    return Number.isFinite(min)&&Number.isFinite(max)?{known:true,min,max,basis:'Actual emitted cockpit triangles under physical rig; probe-square superset of native disc'}:{known:false,reason:'no-emitted-body-over-probe'};
}

const caches=new WeakMap();
export function playerBodySampler(player) {
    const root=player.rig,body=player.cockpit;
    if(!root||!body||!Number.isFinite(player.y))return ()=>({known:false,reason:'missing-native-cockpit-rig'});
    const previous=caches.get(player)||{parts:new WeakMap()},triangles=[];let unsupported=false;
    body.traverse(o=>{
        if(!o.isMesh)return;
        if(o.isSkinnedMesh||o.morphTargetInfluences?.some(v=>v!==0)){unsupported=true;return;}
        const g=o.geometry,p=g?.attributes?.position,I=g?.index;if(!p||p.itemSize!==3||p.normalized){unsupported=true;return;}
        const frames=[];for(let n=o;n&&n!==root;n=n.parent){n.updateMatrix();frames.unshift(n.matrix);}
        const local=new THREE.Matrix4();for(const m of frames)local.multiply(m);
        const signature=[p.version,I?.version,p.count,I?.count,...local.elements].join(','),old=previous.parts.get(o);let rows;
        if(old?.position===p&&old.index===I&&old.signature===signature)rows=old.rows;
        else {rows=[];const count=I?I.count:p.count,v=new THREE.Vector3();for(let i=0;i+2<count;i+=3){const tri=[];for(let k=0;k<3;k++){v.fromBufferAttribute(p,I?I.getX(i+k):i+k).applyMatrix4(local);tri.push(v.toArray());}rows.push(tri);}previous.parts.set(o,{position:p,index:I,signature,rows});previous.revision=(previous.revision||0)+1;}
        triangles.push(...rows);
    });
    if(unsupported||!triangles.length)return ()=>({known:false,reason:'unsupported-or-empty-native-cockpit-body'});
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch??root.rotation.x,player.heading,root.rotation.z,'YXZ')),m=new THREE.Matrix4().compose(new THREE.Vector3(player.x,player.y,player.z),q,root.scale),key=m.elements.join(',');
    if(previous.key===key&&previous.cachedRevision===previous.revision)return previous.sampler;
    const v=new THREE.Vector3(),rows=triangles.map(t=>{const tri=t.map(p=>v.fromArray(p).applyMatrix4(m).toArray());return {tri,x0:Math.min(...tri.map(p=>p[0])),x1:Math.max(...tri.map(p=>p[0])),z0:Math.min(...tri.map(p=>p[2])),z1:Math.max(...tri.map(p=>p[2]))};}),queries=new Map();
    const sampler=(x,z,radius)=>{const k=[x,z,radius].join(',');if(queries.has(k))return queries.get(k);const candidates=rows.filter(r=>r.x0<=x+radius&&r.x1>=x-radius&&r.z0<=z+radius&&r.z1>=z-radius).map(r=>r.tri),value=bodyVerticalInterval(candidates,null,x,z,radius);queries.set(k,value);return value;};
    Object.assign(previous,{key,sampler,cachedRevision:previous.revision});caches.set(player,previous);return sampler;
}
export function playerProbeVerticalInterval(player,x,z,radius){return playerBodySampler(player)(x,z,radius);}
