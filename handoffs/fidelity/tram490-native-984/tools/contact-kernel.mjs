// Exact independent triangle kernel extracted from body-checks.js SHA256 f01fc852439f27d915a0e3fe0a79a3e5dbbcee63fedb7436dc1a2364cabf1135
const finite = Number.isFinite, EPS = 1e-7;
const catalogueRefs = new WeakMap();
function freezeSource(value,seen=new WeakSet()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const child of Object.values(value))freezeSource(child,seen);Object.freeze(value);}
export const IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const add = (a,b) => a.map((v,i)=>v+b[i]), sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const xyz = p => Array.isArray(p)&&p.length===3&&p.every(finite);
export function transform(m,p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; }
export function inverseAffine(m) {
    if(!Array.isArray(m)||m.length!==16||!m.every(finite)||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)return null;
    const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],d=dot(a,cross(b,c));if(Math.abs(d)<1e-15)return null;
    const r0=cross(b,c).map(v=>v/d),r1=cross(c,a).map(v=>v/d),r2=cross(a,b).map(v=>v/d),t=m.slice(12,15);
    return [r0[0],r1[0],r2[0],0,r0[1],r1[1],r2[1],0,r0[2],r1[2],r2[2],0,-dot(r0,t),-dot(r1,t),-dot(r2,t),1];
}
const box = ps => ({min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i])))});
const boxesMeet = (a,b) => a.min.every((v,i)=>v<=b.max[i]&&a.max[i]>=b.min[i]);
function clip(poly, value) {
    const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=value(p),b=value(q);if(a>=0)out.push(p);if((a>=0)!==(b>=0))out.push(mix(p,q,a/(a-b)));}return out;
}
function projectedClip(triangle, polygon, axes=[0,2]) {
    let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a[axes[0]]*b[axes[1]]-b[axes[0]]*a[axes[1]];}
    if(!area)return [];
    let result=triangle;const sign=Math.sign(area);
    for(let i=0;i<polygon.length&&result.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];result=clip(result,p=>sign*((b[axes[0]]-a[axes[0]])*(p[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(p[axes[0]]-a[axes[0]])));}return result;
}
function triangleY(triangle,p) {
    const [a,b,c]=triangle,n=cross(sub(b,a),sub(c,a));return Math.abs(n[1])>1e-15?a[1]-(n[0]*(p[0]-a[0])+n[2]*(p[2]-a[2]))/n[1]:null;
}
/** Exact surface intersection, including coplanar triangles and long edges
 * crossing a narrow solid with no actor vertex inside it. */
export function triangleContact(a,b) {
    if(!boxesMeet(box(a),box(b)))return null;
    const ea=[sub(a[1],a[0]),sub(a[2],a[1]),sub(a[0],a[2])],eb=[sub(b[1],b[0]),sub(b[2],b[1]),sub(b[0],b[2])],na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
    for(const axis of [na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y)))]){const len=Math.hypot(...axis);if(len<1e-14)continue;const A=a.map(p=>dot(p,axis)/len),B=b.map(p=>dot(p,axis)/len);if(Math.max(...A)<Math.min(...B)-1e-10||Math.max(...B)<Math.min(...A)-1e-10)return null;}
    if(Math.hypot(...cross(na,nb))<1e-12*Math.hypot(...na)*Math.hypot(...nb)){
        const drop=na.map(Math.abs).indexOf(Math.max(...na.map(Math.abs))),axes=[0,1,2].filter(i=>i!==drop),p=projectedClip(a,b,axes);return p.length?{point:p[0],coplanar:true}:null;
    }
    for(const [edges,target]of [[a,b],[b,a]])for(let i=0;i<3;i++){
        const p=edges[i],q=edges[(i+1)%3],d=sub(q,p),u=sub(target[1],target[0]),v=sub(target[2],target[0]),n=cross(u,v),den=dot(n,d);if(Math.abs(den)<1e-14)continue;
        const t=dot(n,sub(target[0],p))/den;if(t<0||t>1)continue;const hit=add(p,d.map(x=>x*t)),r=sub(hit,target[0]),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),ru=dot(r,u),rv=dot(r,v),D=uu*vv-uv*uv;
        if(!(D>0))continue;const s=(ru*vv-rv*uv)/D,w=(rv*uu-ru*uv)/D;if(s>=-1e-10&&w>=-1e-10&&s+w<=1+1e-10)return{point:hit,coplanar:false};
    }return null;
}

