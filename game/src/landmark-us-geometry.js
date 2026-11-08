import * as THREE from '../vendor/three.module.min.js';

// Roof profiles use complete source contours. Subdivide the common triangulation
// uniformly so a curved surface does not crack at an interior edge.
export function sourceProfile(b, p, yAt, colour, material = 'm', depth = 3) {
    const v = p.map(([x,z]) => new THREE.Vector2(x,z));
    const mid = (a,c) => [(a[0]+c[0])/2,(a[1]+c[1])/2];
    const point = a => [a[0],yAt(a[0],a[1]),a[1]];
    function emit(a,c,d,n) {
        if (!n) { b.tri(point(a),point(c),point(d),colour,material,[0,1,0]); return; }
        const ac=mid(a,c),cd=mid(c,d),da=mid(d,a);
        emit(a,ac,da,n-1);emit(ac,c,cd,n-1);emit(da,cd,d,n-1);emit(ac,cd,da,n-1);
    }
    for (const [i,j,k] of THREE.ShapeUtils.triangulateShape(v,[])) emit(p[i],p[j],p[k],depth);
}

export function sourceSlope(p, directionDegrees, bottom, rise, round = false) {
    const a = directionDegrees*Math.PI/180, ux=Math.sin(a), uz=-Math.cos(a);
    const ds=p.map(q=>q[0]*ux+q[1]*uz),lo=Math.min(...ds),hi=Math.max(...ds);
    return (x,z) => { const t=Math.max(0,Math.min(1,(x*ux+z*uz-lo)/(hi-lo||1)));
        return bottom+rise*(round?Math.sqrt(Math.max(0,1-(t*2-1)**2)):t); };
}
