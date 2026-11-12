/** Mesh-only adaptive displacement. Keeps source graph vertices/edges and
 * material attributes; records sampled chord error instead of changing grade. */
export function displaceBridgeSurface(mesh, fromVertex, fromIndex, heightAtWorld, { maxErrorM=.002, maxDepth=18 }={}) {
    const rows=[];
    for(let k=fromIndex;k<mesh.ic;k+=3)rows.push([0,1,2].map(j=>{const i=mesh.i[k+j];return{p:Array.from(mesh.p.subarray(i*3,i*3+3)),n:Array.from(mesh.n.subarray(i*3,i*3+3)),u:Array.from(mesh.u.subarray(i*2,i*2+2)),c:Array.from(mesh.c.subarray(i*3,i*3+3)),t:mesh.t?.[i]??-1};}));
    mesh.vc=fromVertex;mesh.ic=fromIndex;
    const stats={inputTriangles:rows.length,outputTriangles:0,maxLeafControlErrorM:0,depthLimit:0,limitSamples:[],worstControl:null};
    const mix=(a,b,t)=>({p:a.p.map((v,k)=>v+(b.p[k]-v)*t),n:a.n.map((v,k)=>v+(b.n[k]-v)*t),u:a.u.map((v,k)=>v+(b.u[k]-v)*t),c:a.c.map((v,k)=>v+(b.c[k]-v)*t),t:a.t});
    const at=v=>heightAtWorld(v.p[0],v.p[2],v.p[1]);
    // height at mix(a, b, t).p, with mix's own arithmetic, without building the whole vertex
    const atMix=(a,b,t)=>{const A=a.p,B=b.p;return heightAtWorld(A[0]+(B[0]-A[0])*t,A[2]+(B[2]-A[2])*t,A[1]+(B[1]-A[1])*t);};
    const edgeError=(a,b,ha,hb)=>{let e=0;for(const t of [.25,.5,.75])e=Math.max(e,Math.abs(atMix(a,b,t)-(ha+(hb-ha)*t)));return e;};
    const snap=v=>({...v,p:[Math.fround(v.p[0]),v.p[1],Math.fround(v.p[2])]});
    // heightAtWorld is a pure function of its arguments, so values already known for the same arguments are reused: a
    // child keeps two of its parent's (already snapped) corners and the error of the parent edge it shares (same
    // vertices, same direction), and a leaf's displacement is its corner control height (the same snapped x, z, y).
    const recurse=(tri,depth,knownH,knownE)=>{
        // Controls and subsequent child nodes use the actual serialized XY.
        // Longest-edge bisection bounds both horizontal dimensions, including
        // long thin fascia faces; the deeper finite budget is numerical only.
        if(!knownH)tri=tri.map(snap);
        const H=knownH?knownH.map((h,i)=>h===undefined?at(tri[i]):h):tri.map(at),E=[];let error=0,longest=-1,split=0;
        for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],d=Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2]);if(d>longest){longest=d;split=i;}const e=knownE?.[i]??edgeError(a,b,H[i],H[(i+1)%3]);E.push(e);error=Math.max(error,e);}
        const C={p:tri[0].p.map((v,k)=>(v+tri[1].p[k]+tri[2].p[k])/3)};error=Math.max(error,Math.abs(at(C)-(H[0]+H[1]+H[2])/3));
        if(error>maxErrorM&&depth<maxDepth&&longest>1e-5){const j=(split+1)%3,k=(split+2)%3,m=snap(mix(tri[split],tri[j],.5)),hm=at(m);recurse([tri[split],m,tri[k]],depth+1,[H[split],hm,H[k]],[undefined,undefined,E[k]]);recurse([m,tri[j],tri[k]],depth+1,[hm,H[j],H[k]],[undefined,E[j],undefined]);return;}
        const witness=()=>({depth,errorM:error,vertices:tri.map((v,i)=>({position:v.p,heightDisplacement:H[i],color:v.c,materialTag:v.t}))});
        if(error>maxErrorM){stats.depthLimit++;if(stats.limitSamples.length<16)stats.limitSamples.push(witness());}if(error>stats.maxLeafControlErrorM)stats.worstControl=witness();stats.maxLeafControlErrorM=Math.max(stats.maxLeafControlErrorM,error);
        const P=tri.map((v,i)=>[v.p[0],v.p[1]+H[i],v.p[2]]),a=P[1].map((v,k)=>v-P[0][k]),b=P[2].map((v,k)=>v-P[0][k]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],L=Math.hypot(...normal)||1,n=normal.map(v=>v/L),ids=[];
        for(let i=0;i<3;i++){const v=tri[i];ids.push(mesh.v(...P[i],...n,...v.u,v.c,v.t));}mesh.tri(...ids);stats.outputTriangles++;
    };
    for(const tri of rows)recurse(tri,0,null,null);
    return stats;
}
