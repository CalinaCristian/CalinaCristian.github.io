// Exact projected coverage of simple OSM outlines. Integrating vertical slices
// between every vertex/intersection avoids sampling away narrow gaps or overlaps.
export function footprintCoverage(outline, parts) {
    const rings = [outline, ...parts], segments = [], cuts = [];
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        segments.push([a, b]); cuts.push(a[0]);
    }
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
        const [a,b] = segments[i], [c,d] = segments[j], ux=b[0]-a[0], uz=b[1]-a[1], vx=d[0]-c[0], vz=d[1]-c[1], den=ux*vz-uz*vx;
        if (Math.abs(den)<1e-10) continue;
        const t=((c[0]-a[0])*vz-(c[1]-a[1])*vx)/den, u=((c[0]-a[0])*uz-(c[1]-a[1])*ux)/den;
        if(t>0&&t<1&&u>0&&u<1) cuts.push(a[0]+ux*t);
    }
    const xs=[...new Set(cuts)].sort((a,b)=>a-b);
    const intervals=(ring,x)=>{
        const zs=[];for(let i=0;i<ring.length;i++){
            const a=ring[i],b=ring[(i+1)%ring.length];
            if((a[0]>x)!==(b[0]>x))zs.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
        }
        zs.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<zs.length;i+=2)out.push([zs[i],zs[i+1]]);return out;
    };
    let area=0,uncovered=0,outside=0;
    for(let i=1;i<xs.length;i++){
        const width=xs[i]-xs[i-1];if(width<1e-8)continue;
        const x=(xs[i]+xs[i-1])/2,base=intervals(outline,x),all=parts.flatMap(r=>intervals(r,x)).sort((a,b)=>a[0]-b[0]),union=[];
        for(const r of all){const last=union[union.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else union.push([...r]);}
        const len=rs=>rs.reduce((s,r)=>s+r[1]-r[0],0);
        let overlap=0;for(const a of base)for(const b of union)overlap+=Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));
        area+=len(base)*width;uncovered+=(len(base)-overlap)*width;outside+=(len(union)-overlap)*width;
    }
    return {area,uncovered:Math.max(0,uncovered),outside:Math.max(0,outside)};
}
