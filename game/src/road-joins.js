// An offset-line intersection is a feasible miter only if it fits both actual
// adjoining source legs. Wider, nearly parallel short legs need a bevel pad;
// clamping their corners together would erase an entire source carriageway.
export function roadMiter(e,f,n,p,q,maxWidth) {
    const cr=e.dirx*f.dirz-e.dirz*f.dirx;
    const t=Math.abs(cr)<.02?null:((q[0]-p[0])*f.dirz-(q[1]-p[1])*f.dirx)/cr;
    const point=t===null?[(p[0]+q[0])/2,(p[1]+q[1])/2]:[p[0]+e.dirx*t,p[1]+e.dirz*t];
    const ex=(point[0]-n.x)*e.dirx+(point[1]-n.z)*e.dirz,fx=(point[0]-n.x)*f.dirx+(point[1]-n.z)*f.dirz;
    return {point,feasible:Math.hypot(point[0]-n.x,point[1]-n.z)<=maxWidth*2.5+1&&Math.abs(ex)<=e.len*.45&&Math.abs(fx)<=f.len*.45};
}

export function needsRoadBevelPad(e,f,n,width) {
    const same=(e.b===n&&f.a===n)||(e.a===n&&f.b===n);
    for(const s of [1,-1]){
        const sf=same?s:-s,w=width(e,s),wf=width(f,sf),p=[n.x+e.nx*s*w,n.z+e.nz*s*w],q=[n.x+f.nx*sf*wf,n.z+f.nz*sf*wf];
        if(!roadMiter(e,f,n,p,q,Math.max(w,wf)).feasible)return true;
    }
    return false;
}
