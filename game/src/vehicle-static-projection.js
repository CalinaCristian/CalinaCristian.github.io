import {convexHull} from './bridge-profile-geometry.js';

const models=new WeakMap(),poses=new WeakMap(),finite=Number.isFinite;
function nativeBodyProjection(v){
    const mesh=v?.mesh,g=mesh?.userData?._model?.geo,p=g?.attributes?.position;
    if(!p?.count||p.itemSize!==3||p.normalized||!['getX','getY','getZ'].every(k=>typeof p[k]==='function'))return null;
    if(mesh.userData._extras?.length||mesh.userData._taxiSign)return null;
    // Native traffic groups use world coordinates. A different parent frame
    // needs its own explicit adapter, never an assumed identity transform.
    for(let n=mesh.parent;n;n=n.parent)if(typeof n.position?.lengthSq!=='function'||!n.rotation||!n.scale||n.position.lengthSq()||n.rotation.x||n.rotation.y||n.rotation.z||n.scale.x!==1||n.scale.y!==1||n.scale.z!==1)return null;
    const pitch=v.pitch??mesh.rotation?.x??0,roll=v.roll??mesh.rotation?.z??0,s=v.scale||mesh.scale;
    const key=[v.x,v.y,v.z,v.heading,pitch,roll,s?.x,s?.y,s?.z,v.length,v.width];
    if(!key.every(finite)||v.length<=0||v.width<=0||!s.x||!s.y||!s.z)return null;
    let model=models.get(g);
    if(!model||model.p!==p||model.version!==p.version||model.count!==p.count){
        const points=new Float64Array(p.count*3);
        for(let i=0;i<p.count;i++){
            const xyz=[p.getX(i),p.getY(i),p.getZ(i)];if(!xyz.every(finite))return null;
            points.set(xyz,i*3);
        }
        model={p,version:p.version,count:p.count,points};models.set(g,model);
    }
    const previous=poses.get(v);if(previous?.model===model&&key.every((a,i)=>a===previous.key[i]))return previous.poly;
    const cp=Math.cos(pitch),sp=Math.sin(pitch),ch=Math.cos(v.heading),sh=Math.sin(v.heading),cr=Math.cos(roll),sr=Math.sin(roll),points=[];
    for(let i=0;i<model.points.length;i+=3){
        const x=model.points[i]*s.x,y=model.points[i+1]*s.y,z=model.points[i+2]*s.z,rx=cr*x-sr*y,ry=sr*x+cr*y,rz=sp*ry+cp*z;
        points.push([v.x+ch*rx+sh*rz,v.z-sh*rx+ch*rz]);
    }
    const fx=-sh,fz=-ch;
    for(const a of[-1,1])for(const b of[-1,1])points.push([v.x+fx*v.length/2*a-fz*v.width/2*b,v.z+fz*v.length/2*a+fx*v.width/2*b]);
    if(!points.every(p=>p.every(finite)))return null;
    const poly=convexHull(points);if(poly.length<3)return null;
    poses.set(v,{model,key,poly});return poly;
}

function colliderProjection(c){
    if(!c||typeof c!=='object')return null;
    if(c.wall){
        const L=Math.hypot(c.bx-c.ax,c.bz-c.az),r=c.renderHalfWidthM;
        if(![c.ax,c.az,c.bx,c.bz,r,L].every(finite)||r<0||!L)return null;
        const x=-(c.bz-c.az)/L*r,z=(c.bx-c.ax)/L*r;
        return{poly:[[c.ax+x,c.az+z],[c.bx+x,c.bz+z],[c.bx-x,c.bz-z],[c.ax-x,c.az-z]]};
    }
    if(c.prop&&c.hw===c.r){
        if(![c.x,c.z,c.r].every(finite)||c.r<0)return null;
        return{circle:{x:c.x,z:c.z,r:c.r}};
    }
    if(c.poly){
        if(!Array.isArray(c.poly)||c.poly.length<3||!c.poly.every(p=>p.length===2&&p.every(finite)))return null;
        const poly=convexHull(c.poly);return poly.length>=3?{poly}:null;
    }
    if(![c.x,c.z,c.hw,c.hd,c.angle].every(finite)||c.hw<0||c.hd<0)return null;
    const C=Math.cos(c.angle),S=Math.sin(c.angle);
    return{poly:[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>[c.x+C*x*c.hw+S*z*c.hd,c.z-S*x*c.hw+C*z*c.hd])};
}

/** Only a proven separating axis can waive a conservative cover contact.
 * Both projections contain their complete physical/rendered objects. An
 * overlap or unknown is deliberately not an actual collision determination. */
export function separatedVehicleStaticProjection(v,c){
    const body=nativeBodyProjection(v),other=colliderProjection(c);if(!body||!other)return null;
    const axes=[];
    for(const poly of other.poly?[body,other.poly]:[body])for(let i=0;i<poly.length;i++){
        const q=poly[(i+1)%poly.length];axes.push([q[1]-poly[i][1],poly[i][0]-q[0]]);
    }
    if(other.circle){
        const c=other.circle;let nearest=body[0];
        for(const p of body)if(Math.hypot(p[0]-c.x,p[1]-c.z)<Math.hypot(nearest[0]-c.x,nearest[1]-c.z))nearest=p;
        axes.push([c.x-nearest[0],c.z-nearest[1]]);
    }
    for(const[x,z]of axes){
        const length=Math.hypot(x,z);if(!length)continue;
        let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
        for(const p of body){const t=p[0]*x+p[1]*z;a0=Math.min(a0,t);a1=Math.max(a1,t);}
        if(other.poly)for(const p of other.poly){const t=p[0]*x+p[1]*z;b0=Math.min(b0,t);b1=Math.max(b1,t);}
        else{const c=other.circle,t=c.x*x+c.z*z;b0=t-c.r*length;b1=t+c.r*length;}
        const gap=Math.max(a0-b1,b0-a1),error=128*Number.EPSILON*(1+Math.max(Math.abs(a0),Math.abs(a1),Math.abs(b0),Math.abs(b1)));
        if(gap>error)return{separated:true,gapM:gap/length,axis:[x/length,z/length],basis:'Full emitted model projection and native rectangle versus complete static footprint; conservative separating axis'};
    }
    return{separated:false};
}
