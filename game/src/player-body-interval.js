import * as THREE from '../vendor/three.module.min.js';

// The square contains the native collision disc. Clipping complete triangles,
// including their interiors, gives a conservative emitted-body height band.
function bodyVerticalInterval(triangles, matrix, x, z, radius) {
    let min=Infinity,max=-Infinity;const x0=x-radius,x1=x+radius,z0=z-radius,z1=z+radius;
    for(const tri of triangles){
        // A triangle whose complete vertical range is already enclosed by
        // witnessed intersections cannot change either extremum.
        const A=tri[0],B=tri[1],C=tri[2],ya=matrix?matrix[1]*A[0]+matrix[5]*A[1]+matrix[9]*A[2]+matrix[13]:A[1],yb=matrix?matrix[1]*B[0]+matrix[5]*B[1]+matrix[9]*B[2]+matrix[13]:B[1],yc=matrix?matrix[1]*C[0]+matrix[5]*C[1]+matrix[9]*C[2]+matrix[13]:C[1];
        if(Math.min(ya,yb,yc)>=min&&Math.max(ya,yb,yc)<=max)continue;
        const P=matrix?tri.map(p=>[matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12],matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13],matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]]):tri,[a,b,c]=P;
        if(Math.max(a[0],b[0],c[0])<x0||Math.min(a[0],b[0],c[0])>x1||Math.max(a[2],b[2],c[2])<z0||Math.min(a[2],b[2],c[2])>z1)continue;
        // Intersection-polygon vertices are triangle vertices, edge/box-edge
        // intersections, or box corners inside the projected triangle. Their
        // Y extrema give the exact same interval without temporary clip arrays.
        for(let i=0;i<3;i++){
            const p=P[i],q=P[(i+1)%3];
            if(p[0]>=x0&&p[0]<=x1&&p[2]>=z0&&p[2]<=z1){min=Math.min(min,p[1]);max=Math.max(max,p[1]);}
            for(const axis of [0,2]){const d=q[axis]-p[axis];if(!d)continue;const other=2-axis,lo=other===0?x0:z0,hi=other===0?x1:z1;
                for(const limit of axis===0?[x0,x1]:[z0,z1]){const t=(limit-p[axis])/d;if(t<0||t>1)continue;const v=p[other]+(q[other]-p[other])*t;if(v<lo||v>hi)continue;const y=p[1]+(q[1]-p[1])*t;min=Math.min(min,y);max=Math.max(max,y);}}
        }
        const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
        if(den)for(const px of [x0,x1])for(const pz of [z0,z1]){const u=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/den,v=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/den;if(u>=0&&v>=0&&u+v<=1){const y=u*a[1]+v*b[1]+(1-u-v)*c[1];min=Math.min(min,y);max=Math.max(max,y);}}
    }
    return Number.isFinite(min)&&Number.isFinite(max)?{known:true,min,max,basis:'Actual emitted cockpit triangles under physical rig; probe-square superset of native disc'}:{known:false,reason:'no-emitted-body-over-probe'};
}

const caches=new WeakMap();
export function playerBodySampler(player) {
    const root=player.rig,body=player.cockpit;
    if(!root||!body||!Number.isFinite(player.y))return ()=>({known:false,reason:'missing-native-cockpit-rig'});
    const previous=caches.get(player)||{parts:new WeakMap(),partSerial:0},entries=[],partIds=[];let unsupported=false;
    body.traverse(o=>{
        if(!o.isMesh)return;
        if(o.isSkinnedMesh||o.morphTargetInfluences?.some(v=>v!==0)){unsupported=true;return;}
        const g=o.geometry,p=g?.attributes?.position,I=g?.index;if(!p||p.itemSize!==3||p.normalized){unsupported=true;return;}
        const frames=[];for(let n=o;n&&n!==root;n=n.parent){n.updateMatrix();frames.unshift(n.matrix);}
        const local=new THREE.Matrix4();for(const m of frames)local.multiply(m);
        const signature=[p.version,I?.version,p.count,I?.count,...local.elements].join(','),old=previous.parts.get(o);let rows,boxes;
        if(old?.position===p&&old.index===I&&old.signature===signature){rows=old.rows;boxes=old.boxes;}
        else {rows=[];const count=I?I.count:p.count,v=new THREE.Vector3();for(let i=0;i+2<count;i+=3){const tri=[];for(let k=0;k<3;k++){v.fromBufferAttribute(p,I?I.getX(i+k):i+k).applyMatrix4(local);tri.push(v.toArray());}rows.push(tri);}boxes=rows.map(tri=>({tri,x0:Math.min(...tri.map(p=>p[0])),x1:Math.max(...tri.map(p=>p[0])),y0:Math.min(...tri.map(p=>p[1])),y1:Math.max(...tri.map(p=>p[1])),z0:Math.min(...tri.map(p=>p[2])),z1:Math.max(...tri.map(p=>p[2]))}));previous.parts.set(o,{position:p,index:I,signature,rows,boxes,id:++previous.partSerial});previous.revision=(previous.revision||0)+1;}
        entries.push(...boxes);partIds.push(previous.parts.get(o).id);
    });
    const partSet=partIds.join(',');if(previous.partSet!==partSet){previous.revision=(previous.revision||0)+1;previous.partSet=partSet;}
    if(unsupported||!entries.length)return ()=>({known:false,reason:'unsupported-or-empty-native-cockpit-body'});
    if(previous.orderedRevision!==previous.revision){previous.ordered=entries.slice().sort((a,b)=>(b.y1-b.y0)-(a.y1-a.y0));previous.orderedRevision=previous.revision;}
    const ordered=previous.ordered;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch??root.rotation.x,player.heading,root.rotation.z,'YXZ')),m=new THREE.Matrix4().compose(new THREE.Vector3(player.x,player.y,player.z),q,root.scale),key=m.elements.join(',');
    if(previous.key===key&&previous.cachedRevision===previous.revision)return previous.sampler;
    // Reject candidates in rig coordinates before allocating/transformation of
    // full world triangles. The inverse image of a world probe prism encloses
    // every possible actual body/box intersection, including triangle interiors.
    const v=new THREE.Vector3(),inverse=m.clone().invert(),B={x0:Infinity,y0:Infinity,z0:Infinity,x1:-Infinity,y1:-Infinity,z1:-Infinity};
    for(const r of entries)for(const axis of ['x','y','z']){B[axis+'0']=Math.min(B[axis+'0'],r[axis+'0']);B[axis+'1']=Math.max(B[axis+'1'],r[axis+'1']);}
    let y0=Infinity,y1=-Infinity;for(const x of [B.x0,B.x1])for(const y of [B.y0,B.y1])for(const z of [B.z0,B.z1]){v.set(x,y,z).applyMatrix4(m);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
    const queries=new Map(),sampler=(x,z,radius)=>{
        const k=[x,z,radius].join(',');if(queries.has(k))return queries.get(k);
        let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
        for(const px of [x-radius,x+radius])for(const py of [y0,y1])for(const pz of [z-radius,z+radius]){v.set(px,py,pz).applyMatrix4(inverse);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);}
        // Outward rounding for candidate selection only, never a clearance or
        // interval tolerance. Every retained triangle still uses exact clipping.
        const roundoff=64*Number.EPSILON*(1+Math.max(Math.abs(x),Math.abs(z),Math.abs(y0),Math.abs(y1),Math.abs(x0),Math.abs(x1),Math.abs(z0),Math.abs(z1)));
        const candidates=ordered.filter(r=>r.x0<=x1+roundoff&&r.x1>=x0-roundoff&&r.z0<=z1+roundoff&&r.z1>=z0-roundoff).map(r=>r.tri),value=bodyVerticalInterval(candidates,m.elements,x,z,radius);queries.set(k,value);return value;
    };
    Object.assign(previous,{key,sampler,cachedRevision:previous.revision});caches.set(player,previous);return sampler;
}
function playerProbeVerticalInterval(player,x,z,radius){return playerBodySampler(player)(x,z,radius);}
