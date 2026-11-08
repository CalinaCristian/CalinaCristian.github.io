// Independent source-polyline audit. A prepared segment cannot skip even a collinear OSM node.
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function auditSourcePath(prepared, source, tolerance=1e-7) {
    if(prepared.length<2||source.length<2)return 'missing source/prepared polyline';
    const positions = point => {
        const result=[];
        for(let i=0;i<source.length-1;i++){
            const a=source[i],b=source[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
            if(!length2){if(distance(point,a)<=tolerance)result.push(i,i+1);continue;}
            const t=((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length2;
            if(t>=-1e-10&&t<=1+1e-10&&distance(point,[a[0]+t*dx,a[1]+t*dz])<=tolerance)result.push(i+Math.max(0,Math.min(1,t)));
        }
        return [...new Set(result.map(t=>Math.abs(t-Math.round(t))<1e-9?Math.round(t):t))];
    };
    let previous=positions(prepared[0]);
    if(!previous.length)return 'prepared point is not on source polyline';
    for(let i=1;i<prepared.length;i++){
        const candidates=positions(prepared[i]);
        if(!candidates.length)return 'prepared point is not on source polyline';
        const ordered=candidates.filter(b=>previous.some(a=>b>=a-1e-9));
        if(!ordered.length)return 'source order reversed or fabricated join';
        const complete=ordered.filter(b=>previous.some(a=>b>=a-1e-9&&Math.ceil(a+1e-8)>=b-1e-8));
        if(!complete.length)return 'mapped source vertex omitted between prepared points';
        previous=complete;
    }
    return null;
}
