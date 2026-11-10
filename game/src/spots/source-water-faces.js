// Subtract a triangulated source water union from a terrain triangle. Every
// retained point interpolates the original terrain plane; no bank is raised.
const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const signed=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0);
const bounds=p=>({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[1])),z1:Math.max(...p.map(v=>v[1]))});
const intersects=(a,b)=>a.x0<=b.x1&&a.x1>=b.x0&&a.z0<=b.z1&&a.z1>=b.z0;
const edgeKey=(a,b)=>{const x=a.join(','),y=b.join(',');return x<y?'edge:'+x+'|'+y:'edge:'+y+'|'+x;};
const sharedLine=vertices=>vertices[0]&&[...vertices[0].lines].some(key=>vertices.every(v=>v.lines.has(key)));
function split(poly,a,b,line){
    const yes=[],no=[];
    for(let i=0;i<poly.length;i++){let p=poly[i];const q=poly[(i+1)%poly.length],u=p.lines.has(line)?0:cross(a,b,p.p),v=q.lines.has(line)?0:cross(a,b,q.p);if(u===0)p={p:p.p,lines:new Set([...p.lines,line])};if(u>=0)yes.push(p);if(u<=0)no.push(p);
        if(u<0&&v>0||u>0&&v<0){const t=u/(u-v),r={p:p.p.map((x,k)=>x+(q.p[k]-x)*t),lines:new Set([line,...[...p.lines].filter(key=>q.lines.has(key))])};yes.push(r);no.push(r);}}
    return{yes,no};
}
export function compileSourceWaterFaces(triangles,{cellM=120}={}){
    const grid=new Map(),faces=triangles.map(poly=>{const p=signed(poly)<0?[...poly].reverse():poly;return{poly:p,bounds:bounds(p)};});
    faces.forEach((f,id)=>{for(let i=Math.floor(f.bounds.x0/cellM);i<=Math.floor(f.bounds.x1/cellM);i++)for(let j=Math.floor(f.bounds.z0/cellM);j<=Math.floor(f.bounds.z1/cellM);j++){const k=i+','+j,a=grid.get(k)||[];a.push(id);grid.set(k,a);}});
    const at=(x,z)=>grid.get(Math.floor(x/cellM)+','+Math.floor(z/cellM))||[];
    const serialization={lineOnlyFragments:0,collapsedOrInvertedFragments:0,wrongSideFragments:[]};
    const catalogue={faces,cellM,grid,serialization,contains:(x,z)=>at(x,z).some(i=>{const p=faces[i].poly;return p.every((a,k)=>cross(a,p[(k+1)%3],[x,0,z])>=0);}),
        cut(face){const b=bounds(face.map(p=>[p[0],p[2]])),ids=new Set();for(let i=Math.floor(b.x0/cellM);i<=Math.floor(b.x1/cellM);i++)for(let j=Math.floor(b.z0/cellM);j<=Math.floor(b.z1/cellM);j++)for(const id of grid.get(i+','+j)||[])ids.add(id);
            const sourceEdges=face.map((p,i)=>edgeKey([p[0],p[2]],[face[(i+1)%3][0],face[(i+1)%3][2]]));
            let pieces=[face.map((p,i)=>({p,lines:new Set([sourceEdges[i],sourceEdges[(i+2)%3]])}))];for(const id of ids){const f=faces[id];if(!intersects(b,f.bounds))continue;const kept=[];
                for(const piece of pieces){let inside=piece;for(let e=0;e<3&&inside.length>=3;e++){const a=f.poly[e],b=f.poly[(e+1)%3],s=split(inside,a,b,edgeKey(a,b));if(s.no.length>=3&&!sharedLine(s.no))kept.push(s.no);inside=s.yes;}}
                pieces=kept;if(!pieces.length)break;
            }
            const orientation=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),nativeSign=Math.sign(orientation(...face)),result=[];
            for(const poly of pieces)for(let i=1;i<poly.length-1;i++){const vertices=[poly[0],poly[i],poly[i+1]];if(sharedLine(vertices)){serialization.lineOnlyFragments++;continue;}const t=vertices.map(v=>v.p.map(Math.fround));
                // Convex clipping preserves winding. A line sliver that loses
                // or reverses that topology in actual Float32 is unrenderable;
                // never turn it into a backface/phantom physical triangle.
                if(orientation(...vertices.map(v=>v.p))*nativeSign<=0||orientation(...t)*nativeSign<=0){serialization.collapsedOrInvertedFragments++;continue;}
                if(vertices.some(v=>[...v.lines].some(key=>!sourceEdges.includes(key)))){
                    const x=t.reduce((s,p)=>s+p[0]/3,0),z=t.reduce((s,p)=>s+p[2]/3,0);
                    // A sub-Float32 shore kink can change side after transport.
                    // Reject that derived fragment rather than emitting a dry
                    // floor in the actual water union. No source record/ring is
                    // removed and no spatial padding or area threshold is used.
                    if(catalogue.contains(x,z)){serialization.wrongSideFragments.push({face:t,original:vertices.map(v=>v.p),projectedArea:Math.abs(orientation(...t))/2});continue;}
                }
                result.push(t);
                if(catalogue.trace&&catalogue.contains(t.reduce((s,p)=>s+p[0]/3,0),t.reduce((s,p)=>s+p[2]/3,0)))catalogue.trace.push({face:t,original:vertices.map(v=>({p:v.p,lines:[...v.lines]})),sourceFace:face});}
            return result;
        }};return catalogue;
}
export function sourceFaceHeightAt(faces,x,z){
    let y=null;for(const[A,B,C]of faces){const d=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2]);if(d===0)continue;const u=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/d,v=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/d,w=1-u-v;
        if(u>=0&&v>=0&&w>=0){const h=A[1]*u+B[1]*v+C[1]*w;if(y===null||h>y)y=h;}}
    return y;
}
