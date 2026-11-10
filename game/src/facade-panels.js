/** A facade is one skin, split at window bands and structural strips.
 * Strips own their opening: no glass or backing wall remains underneath their
 * front face. Depth adds only the two returns, retaining projecting fins.
 * All coordinates are measured along the original outer/courtyard edges. */
export function facadePanels(ring, y0, y1, options, emit) {
    const area = ring.reduce((sum, a, i) => { const b=ring[(i+1)%ring.length]; return sum+a[0]*b[1]-b[0]*a[1]; },0);
    const sign = (area > 0 ? 1 : -1) * (options.inward ? -1 : 1);
    const bands = options.bands || [];
    const ys = [...new Set([y0,y1,...bands.flatMap(b=>[Math.max(y0,b.lo),Math.min(y1,b.hi)]).filter(y=>y>y0&&y<y1)])].sort((a,b)=>a-b);
    for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(length<1e-8)continue;
        const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,nx=sign*dz,nz=-sign*dx;
        const strips=(options.strips?.(i,length)||[]).map(s=>({...s,lo:Math.max(0,s.lo),hi:Math.min(length,s.hi)})).filter(s=>s.hi>s.lo);
        const xs=[...new Set([0,length,...strips.flatMap(s=>[s.lo,s.hi])])].sort((a,b)=>a-b);
        const point=(x,y,depth=0)=>[a[0]+dx*x+nx*depth,y,a[1]+dz*x+nz*depth];
        // Earlier structural strips win, e.g. solid corner cladding over a mullion.
        const spans=xs.slice(1).map((hi,j)=>({lo:xs[j],hi,strip:strips.find(s=>(xs[j]+hi)/2>s.lo&&(xs[j]+hi)/2<s.hi)}));
        for(let j=0;j<spans.length;j++) {
            const {lo,hi,strip}=spans[j];
            if(strip) {
                const depth=strip.depth||0;
                emit([point(lo,y0,depth),point(hi,y0,depth),point(hi,y1,depth),point(lo,y1,depth)],strip.colour,'m',[nx,0,nz]);
                if(depth) {
                    const left=spans[j-1]?.strip?.depth||0,right=spans[j+1]?.strip?.depth||0;
                    if(depth>left)emit([point(lo,y0,left),point(lo,y0,depth),point(lo,y1,depth),point(lo,y1,left)],strip.colour,'m',[-dx,0,-dz]);
                    if(depth>right)emit([point(hi,y0,depth),point(hi,y0,right),point(hi,y1,right),point(hi,y1,depth)],strip.colour,'m',[dx,0,dz]);
                }
                continue;
            }
            for(let k=1;k<ys.length;k++) {
                const low=ys[k-1],high=ys[k],middle=(low+high)/2,band=bands.find(b=>middle>b.lo&&middle<b.hi);
                emit([point(lo,low),point(hi,low),point(hi,high),point(lo,high)],band?.colour||options.wall,band?.material||'m',[nx,0,nz]);
            }
        }
    }
}

/** Preserve the existing pilaster rhythm, including clamped corner bays. */
export function facadePiers(length,pitch,width,depth,colour,every=1) {
    if(length<pitch*.9)return [];
    const count=Math.max(1,Math.round(length/pitch)),strips=[];
    for(let j=0;j<=count;j+=every) {
        const centre=Math.min(length-width/2,Math.max(width/2,j/count*length));
        strips.push({lo:centre-width/2,hi:centre+width/2,depth,colour});
    }
    return strips;
}
