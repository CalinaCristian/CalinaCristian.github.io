// Physical voids follow explicit mapped building passages, not inferred streets.
// Source outlines/heights remain intact; only the reviewed low opening is cut.
import { footprintCells } from './building-parts.js';

export function passageBaseUnknown(tags={}) {
    const nonzeroOrUnknown=k=>tags[k]!=null&&!String(tags[k]).split(';').every(v=>v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)===0);
    return nonzeroOrUnknown('layer')||nonzeroOrUnknown('level')||(tags.bridge!=null&&tags.bridge!=='no')||/^(elevated|underground|overground)$/.test(tags.location||'');
}

const inside=(p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const boundary=(p,ring)=>ring.some((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)<1e-6;});
export function edgeCuts(a,b,rings){
    const d=[b[0]-a[0],b[1]-a[1]],cuts=[0,1];
    for(const ring of rings)for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],v=[q[0]-p[0],q[1]-p[1]],den=cross(d,v);if(Math.abs(den)<1e-10)continue;const w=[p[0]-a[0],p[1]-a[1]],t=cross(w,v)/den,u=cross(w,d)/den;if(t>1e-8&&t<1-1e-8&&u>=-1e-8&&u<=1+1e-8)cuts.push(t);}
    return [...new Set(cuts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b);
}
export function clipPassageWall(a,b,faces,passages){
    if(!passages.length)return faces;
    const cuts=edgeCuts(a,b,passages.map(p=>p.ring)),out=[];
    for(const f of faces){const ts=[f.t0,...cuts.filter(t=>t>f.t0+1e-9&&t<f.t1-1e-9),f.t1];for(let i=1;i<ts.length;i++){const t0=ts[i-1],t1=ts[i],mid=(t0+t1)/2,p=[a[0]+(b[0]-a[0])*mid,a[1]+(b[1]-a[1])*mid];const ceiling=Math.max(-Infinity,...passages.filter(v=>inside(p,v.ring)).map(v=>v.ceilingM));const y0=Math.max(f.y0,ceiling);if(f.y1>y0+1e-7)out.push({...f,t0,t1,y0});}}
    return out;
}
export function passageSolids(ring,holes,minH,height,passages){
    const ys=[...new Set([minH,...passages.map(p=>p.ceilingM).filter(y=>y>minH&&y<height),height])].sort((a,b)=>a-b),bands=[];
    for(let i=1;i<ys.length;i++){const y0=ys[i-1],y1=ys[i],active=passages.filter(p=>p.ceilingM>y0+1e-7).map(p=>p.ring);const polys=footprintCells(ring,[...holes,...active]).filter(c=>!c.covered.length).map(c=>c.ring);if(polys.length)bands.push({y0,y1,polys});}
    return bands;
}
// A shared corridor may cross several source buildings. Its interior faces are
// emitted once against the union of their solids, so overlapping records do not flicker.
export function passageInterior(passages,bodies){
    const walls=[],ceilings=[];
    const solid=(p,b)=>inside(p,b.ring)&&!b.holes.some(h=>inside(p,h));
    for(let k=0;k<passages.length;k++){
        const passage=passages[k],others=passages.filter((p,j)=>j!==k&&p.ceilingM>=passage.ceilingM-1e-7),matching=bodies.filter(b=>b.passages.some(p=>p.key===passage.key));
        const blockers=others.filter(p=>p.ceilingM>passage.ceilingM+1e-7||passages.indexOf(p)<k);
        const rings=matching.flatMap(b=>[b.ring,...b.holes]),flat=matching.flatMap(b=>[b.ring,...b.holes]);
        const offsets=[];let n=0;for(const b of matching){offsets.push({b,outer:n,holes:Array.from({length:b.holes.length},(_,j)=>n+1+j)});n+=1+b.holes.length;}
        for(const cell of footprintCells(passage.ring,[...flat,...blockers.map(p=>p.ring)])){
            if(cell.covered.some(i=>i>=flat.length))continue;
            const owner=offsets.find(o=>cell.covered.includes(o.outer)&&!o.holes.some(i=>cell.covered.includes(i))&&o.b.minH<passage.ceilingM&&o.b.h>passage.ceilingM);
            if(owner)ceilings.push({ring:cell.ring,y:passage.ceilingM,owner:owner.b.i});
        }
        const winding=Math.sign(passage.ring.reduce((s,p,i)=>{const q=passage.ring[(i+1)%passage.ring.length];return s+p[0]*q[1]-p[1]*q[0];},0))||1;
        for(let i=0;i<passage.ring.length;i++){
            const a=passage.ring[i],b=passage.ring[(i+1)%passage.ring.length],cuts=edgeCuts(a,b,[...rings,...others.map(p=>p.ring)]);
            for(let j=1;j<cuts.length;j++){
                const lo=cuts[j-1],hi=cuts[j],t=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],L=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[-(b[1]-a[1])*winding/L,(b[0]-a[0])*winding/L];
                const outside=[p[0]-normal[0]*1e-4,p[1]-normal[1]*1e-4];
                if(others.some(v=>inside(outside,v.ring)||(boundary(p,v.ring)&&(v.ceilingM>passage.ceilingM+1e-7||passages.indexOf(v)<k))))continue;
                const owner=matching.find(v=>solid(p,v)&&v.minH<passage.ceilingM&&v.h>passage.ceilingM);if(!owner)continue;
                walls.push({a:[a[0]+(b[0]-a[0])*lo,a[1]+(b[1]-a[1])*lo],b:[a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi],normal,y0:Math.max(owner.minH,.18),y1:passage.ceilingM,owner:owner.i});
            }
        }
    }
    return {walls,ceilings};
}
