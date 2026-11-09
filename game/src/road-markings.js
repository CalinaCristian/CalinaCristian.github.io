// Source-connected paint stations and convex footprint operations. These do not
// move source nodes, change widths, or infer connections between nearby roads.
export const markingArea = p => Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const signedArea = p => p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const clean = p => p.filter((a,i)=>{const b=p[(i+p.length-1)%p.length];return Math.hypot(a[0]-b[0],a[1]-b[1])>1e-9;});

export function clipMarkingHalfPlane(poly, distance) {
    const out=[];
    for(let i=0;i<poly.length;i++){
        const p=poly[i],q=poly[(i+1)%poly.length],a=distance(p),b=distance(q),pin=a>=-1e-10,qin=b>=-1e-10;
        if(pin)out.push(p);
        if(pin!==qin){const t=a/(a-b);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    const result=clean(out);return result.length>=3&&markingArea(result)>1e-10?result:[];
}

export function clipMarkingConvex(poly, boundary, inset=0) {
    const sign=Math.sign(signedArea(boundary));if(!sign)return [];
    let result=poly;
    for(let i=0;i<boundary.length&&result.length;i++){
        const a=boundary[i],b=boundary[(i+1)%boundary.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);
        if(L<1e-10)continue;
        result=clipMarkingHalfPlane(result,p=>sign*(dx*(p[1]-a[1])-dz*(p[0]-a[0]))-inset*L);
    }
    return result;
}

export function subtractMarkingConvex(poly, boundary) {
    const sign=Math.sign(signedArea(boundary));if(!sign)return [poly];
    const outside=[];let inside=poly;
    for(let i=0;i<boundary.length&&inside.length;i++){
        const a=boundary[i],b=boundary[(i+1)%boundary.length],distance=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        const fragment=clipMarkingHalfPlane(inside,p=>-distance(p));if(fragment.length)outside.push(fragment);
        inside=clipMarkingHalfPlane(inside,distance);
    }
    return outside;
}

// Return the part satisfying an affine height inequality. Non-affine pad or
// endpoint-clamped profiles are explicit: the caller retains its prior policy.
export function clipAffineMarkingRange(poly, value, low, high) {
    if(!poly.length)return [];
    const p=poly[0];let q,r,det=0;
    for(let i=1;i<poly.length-1;i++){q=poly[i];r=poly[i+1];det=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(Math.abs(det)>1e-10)break;}
    if(Math.abs(det)<=1e-10)return [];
    const vp=value(p),vq=value(q),vr=value(r),ax=((vq-vp)*(r[1]-p[1])-(vr-vp)*(q[1]-p[1]))/det,az=((q[0]-p[0])*(vr-vp)-(r[0]-p[0])*(vq-vp))/det;
    const plane=a=>vp+ax*(a[0]-p[0])+az*(a[1]-p[1]);
    const samples=[...poly,poly.reduce((s,a)=>[s[0]+a[0]/poly.length,s[1]+a[1]/poly.length],[0,0])];
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(const t of [.25,.5,.75])samples.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    if(samples.some(a=>!Number.isFinite(value(a))||Math.abs(value(a)-plane(a))>1e-8))return null;
    return clipMarkingHalfPlane(clipMarkingHalfPlane(poly,a=>plane(a)-low),a=>high-plane(a));
}

export function buildMarkingStations(edges, sourceId=e=>e.access?.sourceId) {
    const selected=new Set(edges.filter(e=>!e.virtual)),next=new Map(),stations=new Map();
    const count=(e,d)=>[d>0?e.lanesF:e.lanesB,d>0?e.lanesB:e.lanesF,d>0?e.wR:e.wL,d>0?e.wL:e.wR,e.laneW,e.median,(e.laneCenterShiftM||0)*d];
    const at=(e,n)=>{
        if(n.pad||n.hasLight||n.crossing||n.zebra||n.stop||n.giveWay)return null;
        const es=n.edges.filter(f=>selected.has(f));if(es.length!==2)return null;
        const f=es.find(f=>f!==e),key=sourceId(e);if(!key||key!==sourceId(f)||e.type!==f.type||!!e.oneway!==!!f.oneway||!!e.bridge!==!!f.bridge||!!e.tunnel!==!!f.tunnel||(e.layer||0)!==(f.layer||0))return null;
        const de=e.b===n?1:-1,df=f.a===n?1:-1;
        if(e.oneway&&de!==df)return null;
        const a=count(e,de),b=count(f,df);if(a.some((v,i)=>!Number.isFinite(v)||Math.abs(v-b[i])>1e-6))return null;
        return f;
    };
    for(const e of selected)next.set(e,[at(e,e.a),at(e,e.b)]);
    for(const seed of [...selected].sort((a,b)=>a.id-b.id)){
        if(stations.has(seed))continue;
        const component=[],todo=[seed],seen=new Set();
        while(todo.length){const e=todo.pop();if(seen.has(e))continue;seen.add(e);component.push(e);for(const f of next.get(e))if(f&&!seen.has(f))todo.push(f);}
        const ends=component.flatMap(e=>[e.a,e.b].filter((n,i)=>!next.get(e)[i]).map(n=>({e,n})));
        const first=ends.sort((a,b)=>a.n.id-b.n.id||a.e.id-b.e.id)[0]||{e:component.sort((a,b)=>a.id-b.id)[0],n:component[0].a};
        let e=first.e,n=first.n,s=0;
        while(e&&!stations.has(e)){
            const forward=e.a===n;stations.set(e,{offset:s+(forward?0:e.len),direction:forward?1:-1});s+=e.len;
            const end=forward?e.b:e.a,f=next.get(e)[forward?1:0];n=end;e=f;
        }
    }
    return stations;
}

export function markingDashIntervals(s0,s1,dash,gap,station={offset:0,direction:1}) {
    const step=dash+gap;if(!(step>0&&dash>0&&s1>s0))return [];
    const a=station.offset+station.direction*s0,b=station.offset+station.direction*s1,lo=Math.min(a,b),hi=Math.max(a,b),phase=gap*.5,out=[];
    for(let k=Math.floor((lo-phase-dash)/step)+1;phase+k*step<hi-1e-9;k++){
        const u=Math.max(lo,phase+k*step),v=Math.min(hi,phase+k*step+dash);if(v-u<1e-7)continue;
        const x=(u-station.offset)/station.direction,y=(v-station.offset)/station.direction;out.push([Math.min(x,y),Math.max(x,y)]);
    }
    return out.sort((a,b)=>a[0]-b[0]);
}
