// Join only literal shared OSM node identities. Frame closures below belong to
// the finite render surface, not to the source geometry or navigation graph.
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
function joinSourceCoasts(coasts){
    const start=new Map(),end=new Map(),used=new Set(),chains=[],unresolved=[];
    for(const c of coasts){for(const[m,key]of[[start,c.nodeRefs[0]],[end,c.nodeRefs.at(-1)]]){const a=m.get(key)||[];a.push(c);m.set(key,a);}}
    for(const c of coasts){if(used.has(c.id))continue;let first=c;
        const seen=new Set();while(!seen.has(first.id)){seen.add(first.id);const prev=end.get(first.nodeRefs[0])||[];if(prev.length!==1||start.get(first.nodeRefs[0])?.length!==1||prev[0].id===c.id)break;first=prev[0];}
        let next=first,pts=[],refs=[],ids=[];
        while(next&&!used.has(next.id)){used.add(next.id);ids.push(next.id);pts.push(...next.pts.slice(pts.length?1:0));refs.push(...next.nodeRefs.slice(refs.length?1:0));const key=next.nodeRefs.at(-1),following=start.get(key)||[];
            if(following.length>1||(end.get(key)||[]).length>1){unresolved.push({reason:'ambiguous-source-coast-node',node:key,ways:[...following,...(end.get(key)||[])].map(w=>w.id)});break;}
            next=following[0];
        }
        chains.push({pts,nodeRefs:refs,sourceIds:ids,closed:refs[0]===refs.at(-1)});
    }
    return{chains,unresolved};
}
function clipSegment(a,b,box){
    const dx=b[0]-a[0],dz=b[1]-a[1];let lo=0,hi=1;
    for(const[p,q]of[[-dx,a[0]-box.x0],[dx,box.x1-a[0]],[-dz,a[1]-box.z0],[dz,box.z1-a[1]]]){if(p===0){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}
    return[lo===0?a:[a[0]+lo*dx,a[1]+lo*dz],hi===1?b:[a[0]+hi*dx,a[1]+hi*dz]];
}
function clippedRuns(chain,box){
    const runs=[];let current=null;
    for(let i=1;i<chain.pts.length;i++){const segment=clipSegment(chain.pts[i-1],chain.pts[i],box);if(!segment||same(...segment)){current=null;continue;}
        if(current&&same(current.at(-1),segment[0]))current.push(segment[1]);else{current=[...segment];runs.push(current);}}
    if(chain.closed&&runs.length>1&&same(runs.at(-1).at(-1),runs[0][0])){const last=runs.pop();runs[0]=[...last,...runs[0].slice(1)];}
    return runs;
}
const inside=(p,b)=>p[0]>b.x0&&p[0]<b.x1&&p[1]>b.z0&&p[1]<b.z1;
function perimeter(p,b){
    const W=b.x1-b.x0,H=b.z1-b.z0,tol=1e-7;
    if(Math.abs(p[1]-b.z0)<tol)return p[0]-b.x0;
    if(Math.abs(p[0]-b.x1)<tol)return W+p[1]-b.z0;
    if(Math.abs(p[1]-b.z1)<tol)return W+H+b.x1-p[0];
    if(Math.abs(p[0]-b.x0)<tol)return 2*W+H+b.z1-p[1];
    return null;
}
export function sourceCoastWater(coasts,box){
    const joined=joinSourceCoasts(coasts),unresolved=[...joined.unresolved],runs=[],holes=[],islands=[];
    for(const chain of joined.chains){
        if(chain.closed&&chain.pts.every(p=>inside(p,box))){const poly=chain.pts.slice(0,-1);(area(poly)<0?holes:islands).push({poly,sourceIds:chain.sourceIds});continue;}
        for(const pts of clippedRuns(chain,box)){const start=perimeter(pts[0],box),end=perimeter(pts.at(-1),box);if(start==null||end==null){unresolved.push({reason:'coast-source-coverage-end-inside-render-frame',sourceIds:chain.sourceIds,ends:[pts[0],pts.at(-1)]});continue;}runs.push({pts,start,end,sourceIds:chain.sourceIds});}
    }
    const W=box.x1-box.x0,H=box.z1-box.z0,P=2*(W+H),corners=[[0,[box.x0,box.z0]],[W,[box.x1,box.z0]],[W+H,[box.x1,box.z1]],[2*W+H,[box.x0,box.z1]]],used=new Set(),polygons=[...islands];
    const ports=runs.flatMap((r,i)=>[{s:r.start,start:true,i},{s:r.end,start:false,i}]).sort((a,b)=>a.s-b.s);
    for(let i=0;i<runs.length;i++){if(used.has(i))continue;let k=i,poly=[],sourceIds=[],valid=true;
        do{if(used.has(k)){valid=false;break;}used.add(k);const r=runs[k];poly.push(...r.pts.slice(poly.length?1:0));sourceIds.push(...r.sourceIds);
            const choices=ports.map(p=>({...p,delta:(p.s-r.end+P)%P})).filter(p=>!(p.i===k&&!p.start)).sort((a,b)=>a.delta-b.delta),next=choices[0];
            if(!next?.start){unresolved.push({reason:'coast-frame-directions-do-not-form-water-face',sourceIds:r.sourceIds});valid=false;break;}
            for(const c of corners.map(([s,p])=>({p,delta:(s-r.end+P)%P})).filter(c=>c.delta>0&&c.delta<next.delta).sort((a,b)=>a.delta-b.delta))poly.push(c.p);
            poly.push(runs[next.i].pts[0]);k=next.i;
        }while(k!==i);
        if(valid&&poly.length>=3&&area(poly)>0)polygons.push({poly,sourceIds:[...new Set(sourceIds)]});else if(valid)unresolved.push({reason:'coast-water-face-invalid-winding',sourceIds});
    }
    return{polygons,holes,unresolved,sourceChains:joined.chains.length,renderFrame:box,basis:'Literal directed coastline/shared-node identities; finite water frame closures only; source geometry unchanged'};
}
