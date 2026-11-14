// Synthetic district limits share the finite support of already-kept source
// roads. This module never adds an edge, travel right or passive scenery road.
const EPS = 1e-9;
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const box = p => ({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[2])),z1:Math.max(...p.map(v=>v[2]))});
const overlap = (a,b) => a.x0<=b.x1&&a.x1>=b.x0&&a.z0<=b.z1&&a.z1>=b.z0;
const cross = (a,b,p) => (b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
const area3 = p => {
    let x=0,y=0,z=0;
    for(let i=1;i+1<p.length;i++){
        const a=p[i].map((v,k)=>v-p[0][k]),b=p[i+1].map((v,k)=>v-p[0][k]);
        x+=a[1]*b[2]-a[2]*b[1];y+=a[2]*b[0]-a[0]*b[2];z+=a[0]*b[1]-a[1]*b[0];
    }
    return Math.hypot(x,y,z)>EPS;
};
function split(poly,plane){
    const inside=[],outside=[];
    for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b),ia=da>=-EPS,ib=db>=-EPS;
        (ia?inside:outside).push(a);
        if(ia!==ib){const p=mix(a,b,da/(da-db));inside.push(p);outside.push(p);}
    }
    return {inside:area3(inside)?inside:[],outside:area3(outside)?outside:[]};
}
function partition(poly,planes){
    let inside=poly;const outside=[];
    for(const plane of planes){if(!inside.length)break;const s=split(inside,plane);if(s.outside.length)outside.push(s.outside);inside=s.inside;}
    return {inside,outside};
}
function pointSegment(p,a,b){
    const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
}
const intersects = (a,b,c,d) => Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&
    Math.max(Math.min(a[2],b[2]),Math.min(c[2],d[2]))<=Math.min(Math.max(a[2],b[2]),Math.max(c[2],d[2]))&&
    cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
function cellDistance(x,z,cell,triangle){
    const rect=[[x,0,z],[x+cell,0,z],[x+cell,0,z+cell],[x,0,z+cell]];
    if(triangle.planes.every(f=>f(rect[0])>=-EPS)||rect.some(p=>triangle.planes.every(f=>f(p)>=-EPS))||
        triangle.poly.some(p=>p[0]>=x&&p[0]<=x+cell&&p[2]>=z&&p[2]<=z+cell))return 0;
    let distance=Infinity;
    for(let i=0;i<3;i++)for(let j=0;j<4;j++){
        const a=triangle.poly[i],b=triangle.poly[(i+1)%3],c=rect[j],d=rect[(j+1)%4];
        if(intersects(a,b,c,d))return 0;
        distance=Math.min(distance,pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
    }
    return distance;
}
export function decodeDistrictMask(m){
    if(!m)return null;
    const bits=new Uint8Array(m.w*m.h);let k=0,v=0;
    for(const run of m.rle){if(!Number.isSafeInteger(run)||run<0||k+run>bits.length)throw Error('Invalid district mask run');bits.fill(v,k,k+run);k+=run;v^=1;}
    if(k!==bits.length)throw Error('Incomplete district mask');
    return maskObject({...m,bits});
}
function maskObject(m){
    const at=(x,z)=>{const i=Math.floor((x-m.x0)/m.cell),j=Math.floor((z-m.z0)/m.cell);return i>=0&&j>=0&&i<m.w&&j<m.h&&m.bits[j*m.w+i]===1;};
    return Object.freeze({...m,at});
}
const rle = bits => {const out=[];let value=0,count=0;for(const b of bits){if(b===value)count++;else{out.push(count);count=1;value=b;}}out.push(count);return out;};

export function districtMaskSegments(mask){
    if(!mask)return [];
    const {w,h,cell,x0,z0,bits}=mask,out=[],at=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&bits[j*w+i]===1;
    for(let i=0;i<=w;i++){
        let run=null;
        for(let j=0;j<=h;j++){
            const left=at(i-1,j),right=at(i,j),v=j<h&&left!==right?(right?1:-1):0;
            if(run&&v!==run.v){out.push({ax:x0+i*cell,az:z0+run.start*cell,bx:x0+i*cell,bz:z0+j*cell,nx:run.v,nz:0});run=null;}
            if(v&&!run)run={v,start:j};
        }
    }
    for(let j=0;j<=h;j++){
        let run=null;
        for(let i=0;i<=w;i++){
            const up=at(i,j-1),down=at(i,j),v=i<w&&up!==down?(down?1:-1):0;
            if(run&&v!==run.v){out.push({ax:x0+run.start*cell,az:z0+j*cell,bx:x0+i*cell,bz:z0+j*cell,nx:0,nz:run.v});run=null;}
            if(v&&!run)run={v,start:i};
        }
    }
    return out;
}

// The actual cockpit collision extent from vehicles.js: front3.42/rear2.36,
// half-width0.9. This finite domain margin is not a collision tolerance.
const SOURCE_DOMAIN_BODY_RADIUS = Math.hypot(3.42,.9);

/** supports: exact emitted core-road/pad polygons as XYZ, with owning edges. */
export function buildSourceBoundarySupport(supports,{bodyRadiusM=SOURCE_DOMAIN_BODY_RADIUS}={}){
    const triangles=[],grid=new Map(),CELL=32;
    const report={sourceSupports:supports.length,triangles:0,bodyRadiusM,addedMaskCells:0,oldMaskCells:0,
        clippedClosureSections:0,removedClosureSections:0,closureBundles:0,clippedDecorationPolygons:0,rejectedDiscreteProps:0,unresolved:[],
        basis:'Finite whole-body support of kept literal source core roads/pads; no passive scenery, OUT or mapped barrier edits'};
    for(const support of supports){
        const p=support.poly;
        if(!Array.isArray(p)||p.length<3||p.some(v=>v.length<3||!v.slice(0,3).every(Number.isFinite))){report.unresolved.push({reason:'unknown-source-support',sourceId:support.sourceId});continue;}
        for(let i=1;i+1<p.length;i++){
            const poly=[p[0],p[i],p[i+1]],den=cross(poly[0],poly[1],poly[2]);if(Math.abs(den)<EPS)continue;
            const sign=Math.sign(den),planes=poly.map((a,j)=>{const b=poly[(j+1)%3];return q=>sign*cross(a,b,q);});
            const height=q=>{
                const a=poly[0],b=poly[1],c=poly[2],u=((q[0]-a[0])*(c[2]-a[2])-(q[2]-a[2])*(c[0]-a[0]))/den,
                    v=((b[0]-a[0])*(q[2]-a[2])-(b[2]-a[2])*(q[0]-a[0]))/den;
                return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
            };
            const t={...support,poly,planes,height,...box(poly)};triangles.push(t);
            for(let x=Math.floor(t.x0/CELL);x<=Math.floor(t.x1/CELL);x++)for(let z=Math.floor(t.z0/CELL);z<=Math.floor(t.z1/CELL);z++){
                const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);
            }
        }
    }
    report.triangles=triangles.length;
    const nearby=b=>{const found=new Set();for(let x=Math.floor(b.x0/CELL);x<=Math.floor(b.x1/CELL);x++)for(let z=Math.floor(b.z0/CELL);z<=Math.floor(b.z1/CELL);z++)
        for(const t of grid.get(x+','+z)||[])if(overlap(t,b))found.add(t);return [...found];};
    const other=(t,owners)=>!t.ownerEdges?.some(e=>owners.includes(e));
    const cutPlanes=(t,y0,y1)=>[...t.planes,p=>t.height(p)-y0,p=>y1-t.height(p)];
    const clipPolygon=(poly,{ownerEdges=[],y0,y1}={},record=true)=>{
        if(!Number.isFinite(y0)||!Number.isFinite(y1)||y1<y0)throw Error('Synthetic boundary query needs its actual vertical interval');
        let fragments=[poly],changed=false;
        for(const t of nearby(box(poly))){
            if(!other(t,ownerEdges))continue;
            const next=[];
            for(const f of fragments){const q=partition(f,cutPlanes(t,y0,y1));next.push(...q.outside);if(q.inside.length)changed=true;}
            fragments=next;if(!fragments.length)break;
        }
        if(changed&&record)report.clippedDecorationPolygons++;
        return changed?fragments:[poly];
    };
    const clearCircle=(x,z,r,{ownerEdges=[],y0,y1}={})=>{
        if(![x,z,r,y0,y1].every(Number.isFinite)||r<0||y1<y0)throw Error('Invalid synthetic boundary circle interval');
        const point=[x,0,z];
        for(const t of nearby({x0:x-r,x1:x+r,z0:z-r,z1:z+r})){
            if(!other(t,ownerEdges))continue;
            // Clip the road triangle to the caller's actual vertical interval.
            let p=t.poly;
            for(const plane of [q=>t.height(q)-y0,q=>y1-t.height(q)]){p=split(p,plane).inside;if(!p.length)break;}
            if(!p.length)continue;
            const sign=Math.sign(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[2]-a[2]*b[0];},0));
            if(p.every((a,i)=>sign*cross(a,p[(i+1)%p.length],point)>=-EPS)||p.some((a,i)=>pointSegment(point,a,p[(i+1)%p.length])<=r))return false;
        }
        return true;
    };
    const segmentIntervals=(a,b,{ownerEdges=[],y0,y1}={})=>{
        if(![y0,y1].every(Number.isFinite)||y1<y0)throw Error('Synthetic boundary segment needs its actual vertical interval');
        const cuts=[];
        for(const t of nearby(box([a,b]))){
            if(!other(t,ownerEdges))continue;
            let lo=0,hi=1;
            for(const plane of cutPlanes(t,y0,y1)){
                const da=plane(a),db=plane(b),delta=db-da;
                if(Math.abs(delta)<EPS){if(da<0){hi=-1;break;}continue;}
                const v=-da/delta;if(delta>0)lo=Math.max(lo,v);else hi=Math.min(hi,v);
                if(lo>=hi)break;
            }
            if(hi>lo&&hi>0&&lo<1)cuts.push([Math.max(0,lo),Math.min(1,hi)]);
        }
        const out=[];let start=0;
        for(const[lo,hi]of cuts.sort((a,b)=>a[0]-b[0])){if(lo>start+EPS)out.push([start,lo]);start=Math.max(start,hi);}
        if(start<1-EPS)out.push([start,1]);return out;
    };
    const extendMask=mask=>{
        if(!mask||!triangles.length)return mask;
        const cs=mask.cell,r=bodyRadiusM;
        let i0=0,j0=0,i1=mask.w,j1=mask.h;
        for(const t of triangles){i0=Math.min(i0,Math.floor((t.x0-r-mask.x0)/cs));j0=Math.min(j0,Math.floor((t.z0-r-mask.z0)/cs));i1=Math.max(i1,Math.ceil((t.x1+r-mask.x0)/cs));j1=Math.max(j1,Math.ceil((t.z1+r-mask.z0)/cs));}
        const w=i1-i0,h=j1-j0,x0=mask.x0+i0*cs,z0=mask.z0+j0*cs;
        if(w*h>2e6)throw Error('Source district support exceeds bounded mask capacity');
        const bits=new Uint8Array(w*h);
        for(let j=0;j<mask.h;j++)for(let i=0;i<mask.w;i++)if(mask.bits[j*mask.w+i]){bits[(j-j0)*w+i-i0]=1;report.oldMaskCells++;}
        for(const t of triangles){
            const a=Math.max(0,Math.floor((t.x0-r-x0)/cs)),b=Math.min(w-1,Math.floor((t.x1+r-x0)/cs)),
                c=Math.max(0,Math.floor((t.z0-r-z0)/cs)),d=Math.min(h-1,Math.floor((t.z1+r-z0)/cs));
            for(let j=c;j<=d;j++)for(let i=a;i<=b;i++)if(!bits[j*w+i]&&cellDistance(x0+i*cs,z0+j*cs,cs,t)<=r){bits[j*w+i]=1;report.addedMaskCells++;}
        }
        return maskObject({x0,z0,cell:cs,w,h,bits,rle:rle(bits)});
    };
    const vertex=(mesh,i)=>{const p=mesh.p,n=mesh.n,u=mesh.u,c=mesh.c,i3=i*3,i2=i*2;return [p[i3],p[i3+1],p[i3+2],n[i3],n[i3+1],n[i3+2],u[i2],u[i2+1],c[i3],c[i3+1],c[i3+2],mesh.t?.[i]??-1];};
    const triangleOptions=(poly,options)=>options.floorY===undefined?options:{...options,y0:options.floorY-.3,y1:Math.max(options.floorY,...poly.map(v=>v[1]))};
    // (spec 10 load budget) true when clipPolygon would return mesh triangle a, b, c unchanged because no support
    // triangle of another owner overlaps its box (the same box, interval and owner test, without building the polygon);
    // an invalid interval returns false so that clipPolygon raises its error as before
    const untouched=(mesh,a,b,c,options)=>{
        const P=mesh.p,ay=P[a*3+1],by=P[b*3+1],cy=P[c*3+1];
        const y0=options.floorY===undefined?options.y0:options.floorY-.3,y1=options.floorY===undefined?options.y1:Math.max(options.floorY,ay,by,cy);
        if(!Number.isFinite(y0)||!Number.isFinite(y1)||y1<y0)return false;
        const owners=options.ownerEdges===undefined?[]:options.ownerEdges,ax=P[a*3],bx=P[b*3],cx=P[c*3],az=P[a*3+2],bz=P[b*3+2],cz=P[c*3+2];
        const x0=Math.min(ax,bx,cx),x1=Math.max(ax,bx,cx),z0=Math.min(az,bz,cz),z1=Math.max(az,bz,cz);
        for(let x=Math.floor(x0/CELL);x<=Math.floor(x1/CELL);x++)for(let z=Math.floor(z0/CELL);z<=Math.floor(z1/CELL);z++){
            const list=grid.get(x+','+z);if(list)for(const t of list)if(t.x0<=x1&&t.x1>=x0&&t.z0<=z1&&t.z1>=z0&&other(t,owners))return false;
        }
        return true;
    };
    const clearMeshRange=(mesh,start,options)=>{
        for(let i=start;i<mesh.ic;i+=3){
            if(untouched(mesh,mesh.i[i],mesh.i[i+1],mesh.i[i+2],options))continue;
            const poly=[0,1,2].map(j=>vertex(mesh,mesh.i[i+j])),parts=clipPolygon(poly,triangleOptions(poly,options),false);
            if(parts.length!==1||parts[0]!==poly)return false;
        }
        return true;
    };
    const applyMesh=(mesh,start,options)=>{
        const original=Array.from(mesh.i.subarray(start,mesh.ic)),result=[];let changed=false;
        for(let i=0;i<original.length;i+=3){
            const ids=original.slice(i,i+3);
            if(untouched(mesh,ids[0],ids[1],ids[2],options)){result.push({ids});continue;}
            const poly=ids.map(id=>vertex(mesh,id)),parts=clipPolygon(poly,triangleOptions(poly,options));
            if(parts.length===1&&parts[0]===poly)result.push({ids});else{changed=true;result.push(...parts.map(poly=>({poly})));}
        }
        if(!changed)return false;
        mesh.ic=start;
        for(const r of result){
            if(r.ids){mesh.tri(...r.ids);continue;}
            const ids=r.poly.map(v=>mesh.v(...v.slice(0,8),v.slice(8,11),v[11]));
            for(let i=1;i+1<ids.length;i++)mesh.tri(ids[0],ids[i],ids[i+1]);
        }
        return true;
    };
    return {report,extendMask,clipPolygon,clearCircle,segmentIntervals,clearMeshRange,applyMesh};
}

/** One immutable frame per surviving physical section; decoration consumes it. */
export function normalizeSourceMapEnds(candidates,support){
    const bundles=[];
    for(const m of candidates){
        let group=bundles.find(g=>g.some(q=>Math.abs(q.y-m.y)<.15&&q.ix*m.ix+q.iz*m.iz>.98&&
            Math.abs((m.x-q.x)*q.ix+(m.z-q.z)*q.iz)<6&&Math.abs((m.x-q.x)*q.px+(m.z-q.z)*q.pz)<q.half+m.half));
        if(!group)bundles.push(group=[]);group.push(m);
    }
    const out=[];support.report.closureBundles=bundles.length;
    for(let bundle=0;bundle<bundles.length;bundle++){
        const members=bundles[bundle],owners=members.map(m=>m.edge),prior=[];
        let primary=true;
        for(const m of members){
            const a=[m.x+m.px*m.l0,m.y,m.z+m.pz*m.l0],b=[m.x+m.px*m.l1,m.y,m.z+m.pz*m.l1];
            let intervals=support.segmentIntervals(a,b,{ownerEdges:owners,y0:m.y-.3,y1:m.y+(m.barrierHeight??1.51)});
            // Exact coplanar overlaps are emitted once. Parallel offset end
            // sections remain literal, but share a single worksite bundle.
            for(const q of prior){
                if(Math.abs((m.x-q.x)*m.ix+(m.z-q.z)*m.iz)>.02||m.ix*q.ix+m.iz*q.iz<.99999)continue;
                const offset=(q.x-m.x)*m.px+(q.z-m.z)*m.pz,lo=(offset+q.l0-m.l0)/(m.l1-m.l0),hi=(offset+q.l1-m.l0)/(m.l1-m.l0);
                intervals=intervals.flatMap(([a,b])=>b<=lo||a>=hi?[[a,b]]:[[a,Math.max(a,lo)],[Math.min(b,hi),b]].filter(([x,y])=>y-x>EPS));
            }
            if(intervals.length!==1||intervals[0][0]!==0||intervals[0][1]!==1)support.report.clippedClosureSections++;
            if(!intervals.length)support.report.removedClosureSections++;
            for(const[a,b]of intervals){
                const l0=m.l0+(m.l1-m.l0)*a,l1=m.l0+(m.l1-m.l0)*b;
                if(l1-l0<.02)continue;
                const q=Object.freeze({...m,l0,l1,half:(l1-l0)/2,ownerEdges:Object.freeze([...owners]),bundleId:bundle,bundlePrimary:primary});
                out.push(q);prior.push(q);primary=false;
            }
        }
    }
    return out;
}
