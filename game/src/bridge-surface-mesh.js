// (spec 10 load budget) heightAtWorld is a pure function of its arguments; neighbouring triangles ask it again at the same
// points (shared corners, the samples of a shared edge), mostly moments apart: close to half the questions on a deck.
// Recent answers are kept in a small direct-mapped table (a slot holds the last key that hashed to it), keyed by the
// exact bits of (x, z, y); a generation per call marks the slots of the current function. Only numbers are kept.
const KEY = new Float64Array(3), KEYW = new Uint32Array(KEY.buffer), MEMO_BITS = 14, MEMO_MASK = (1 << MEMO_BITS) - 1;
const memoW = new Uint32Array(6 << MEMO_BITS), memoV = new Float64Array(1 << MEMO_BITS), memoG = new Uint32Array(1 << MEMO_BITS);
let memoGen = 0;
function memoHeights(fn) {
    if (++memoGen > 0xfffffff0) { memoG.fill(0); memoGen = 1; }
    const gen = memoGen;
    return (x, z, y) => {
        KEY[0] = x; KEY[1] = z; KEY[2] = y;
        const w0 = KEYW[0], w1 = KEYW[1], w2 = KEYW[2], w3 = KEYW[3], w4 = KEYW[4], w5 = KEYW[5];
        let h = Math.imul(w0 ^ w1, 0x9e3779b1) ^ Math.imul(w2 ^ w3, 0x85ebca6b) ^ Math.imul(w4 ^ w5, 0xc2b2ae35);
        h ^= h >>> 16; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 15; h &= MEMO_MASK;
        const o = h * 6;
        if (memoG[h] === gen && memoW[o] === w0 && memoW[o + 1] === w1 && memoW[o + 2] === w2 && memoW[o + 3] === w3 && memoW[o + 4] === w4 && memoW[o + 5] === w5) return memoV[h];
        const v = fn(x, z, y);
        if (typeof v === 'number') { memoW[o] = w0; memoW[o + 1] = w1; memoW[o + 2] = w2; memoW[o + 3] = w3; memoW[o + 4] = w4; memoW[o + 5] = w5; memoV[h] = v; memoG[h] = gen; }
        return v;
    };
}
/** Mesh-only adaptive displacement. Keeps source graph vertices/edges and
 * material attributes; records sampled chord error instead of changing grade. */
export function displaceBridgeSurface(mesh, fromVertex, fromIndex, heightAtWorldFn, { maxErrorM=.002, maxDepth=18 }={}) {
    const heightAtWorld = memoHeights(heightAtWorldFn);
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
        const H=knownH?knownH.map((h,i)=>h===undefined?at(tri[i]):h):tri.map(at),E=[undefined,undefined,undefined];let error=0,longest=-1,split=0;
        for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],d=Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2]);if(d>longest){longest=d;split=i;}}
        const edge=i=>E[i]??(E[i]=knownE?.[i]??edgeError(tri[i],tri[(i+1)%3],H[i],H[(i+1)%3]));
        const p0=tri[0].p,p1=tri[1].p,p2=tri[2].p,centre=()=>Math.abs(heightAtWorld((p0[0]+p1[0]+p2[0])/3,(p0[2]+p1[2]+p2[2])/3,(p0[1]+p1[1]+p2[1])/3)-(H[0]+H[1]+H[2])/3);
        const j=(split+1)%3,k=(split+2)%3,canSplit=depth<maxDepth&&longest>1e-5;
        // The node splits when the largest control error exceeds the tolerance. When it can split, the controls are tested
        // in an order (the edges its children keep first) and the test stops at the first one over the tolerance: the
        // decision is the same, and a split node records nothing; a child recomputes a kept edge's error identically
        // (same vertices, same direction, same heights). A leaf always evaluates every control.
        for(const i of canSplit?[k,j,split]:[0,1,2]){error=Math.max(error,edge(i));if(canSplit&&error>maxErrorM)break;}
        if(!(canSplit&&error>maxErrorM))error=Math.max(error,centre());
        if(error>maxErrorM&&canSplit){const m=snap(mix(tri[split],tri[j],.5)),hm=at(m);recurse([tri[split],m,tri[k]],depth+1,[H[split],hm,H[k]],[undefined,undefined,E[k]]);recurse([m,tri[j],tri[k]],depth+1,[hm,H[j],H[k]],[undefined,E[j],undefined]);return;}
        const witness=()=>({depth,errorM:error,vertices:tri.map((v,i)=>({position:v.p,heightDisplacement:H[i],color:v.c,materialTag:v.t}))});
        if(error>maxErrorM){stats.depthLimit++;if(stats.limitSamples.length<16)stats.limitSamples.push(witness());}if(error>stats.maxLeafControlErrorM)stats.worstControl=witness();stats.maxLeafControlErrorM=Math.max(stats.maxLeafControlErrorM,error);
        // (the same arithmetic as before, on scalars: P = corner + its displacement, normal = (P1 − P0) × (P2 − P0) / |…|)
        const x0=p0[0],y0=p0[1]+H[0],z0=p0[2],x1=p1[0],y1=p1[1]+H[1],z1=p1[2],x2=p2[0],y2=p2[1]+H[2],z2=p2[2];
        const a0=x1-x0,a1=y1-y0,a2=z1-z0,b0=x2-x0,b1=y2-y0,b2=z2-z0,c0=a1*b2-a2*b1,c1=a2*b0-a0*b2,c2=a0*b1-a1*b0,L=Math.hypot(c0,c1,c2)||1,n0=c0/L,n1=c1/L,n2=c2/L;
        const u0=tri[0].u,u1=tri[1].u,u2=tri[2].u;
        mesh.tri(mesh.v(x0,y0,z0,n0,n1,n2,u0[0],u0[1],tri[0].c,tri[0].t),mesh.v(x1,y1,z1,n0,n1,n2,u1[0],u1[1],tri[1].c,tri[1].t),mesh.v(x2,y2,z2,n0,n1,n2,u2[0],u2[1],tri[2].c,tri[2].t));stats.outputTriangles++;
    };
    for(const tri of rows)recurse(tri,0,null,null);
    return stats;
}
