const EPS = 1e-7;
export const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export function clipConvex(A, B) {
    const area = B.reduce((s, p, i) => s + cross(p, B[(i + 1) % B.length]), 0), sign = Math.sign(area); if (!sign) return [];
    let P = A;
    for (let i = 0; i < B.length && P.length; i++) {
        const a = B[i], b = B[(i + 1) % B.length], side = p => sign * cross([b[0] - a[0], b[1] - a[1]], [p[0] - a[0], p[1] - a[1]]), Q = [];
        for (let k = 0; k < P.length; k++) {
            const p = P[k], q = P[(k + 1) % P.length], u = side(p), v = side(q), inside = u >= -EPS, other = v >= -EPS;
            if (inside) Q.push(p); if (inside !== other) { const t = u / (u - v); Q.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
        }
        P = Q;
    }
    return P;
}
export const polygonArea = P => Math.abs(P.reduce((s, p, i) => s + cross(p, P[(i + 1) % P.length]), 0)) / 2;
export function convexHull(points) {
    const P = [...new Map(points.map(p => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]), half = ps => {
        const out = []; for (const p of ps) { while (out.length > 1 && cross([out.at(-1)[0] - out.at(-2)[0], out.at(-1)[1] - out.at(-2)[1]], [p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]]) <= 0) out.pop(); out.push(p); } return out;
    };
    return [...half(P).slice(0, -1), ...half(P.slice().reverse()).slice(0, -1)];
}
export function sourcePath(lookup, definition) {
    const points = [], nodeIds = [], legs = [], stations = new Map(); let length = 0;
    for (const [id, dir] of definition.ways) {
        const w = lookup.get(id); if (!w) return null;
        const indexes = w.nodeIds.map((_, i) => i); if (dir < 0) indexes.reverse();
        if (nodeIds.length && nodeIds.at(-1) !== w.nodeIds[indexes[0]]) return null;
        for (let j = 0; j < indexes.length; j++) {
            const i = indexes[j], p = w.projected[i], n = w.nodeIds[i];
            if (j) { const prev = indexes[j - 1], start = length; length += distance(w.projected[prev], p); legs.push({ sourceId: id, index: Math.min(i, prev), s0: dir > 0 ? start : length, s1: dir > 0 ? length : start }); }
            if (!nodeIds.length || nodeIds.at(-1) !== n) { points.push(p); nodeIds.push(n); }
            if (stations.has(n) && Math.abs(stations.get(n) - length) > EPS) return null; stations.set(n, length);
        }
    }
    return { points, nodeIds, legs, stations, length };
}
export function sourceStation(way, point) {
    const hits = []; let s = 0;
    for (let i = 1; i < way.projected.length; i++) {
        const a = way.projected[i - 1], b = way.projected[i], len = distance(a, b), dx = b[0] - a[0], dz = b[1] - a[1];
        const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (len * len);
        if (t >= -EPS && t <= 1 + EPS && Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t) < 1e-6) hits.push(s + len * Math.max(0, Math.min(1, t)));
        s += len;
    }
    return hits.length && Math.max(...hits) - Math.min(...hits) < 1e-5 ? hits[0] : null;
}
export function pathStation(path, lookup, edge, point) {
    const id = edge.sourceId, way = lookup.get(id), a = sourceStation(way, [edge.a.x, edge.a.z]), b = sourceStation(way, [edge.b.x, edge.b.z]);
    if (a === null || b === null) return null;
    const t = Math.max(0, Math.min(1, ((point[0] - edge.a.x) * edge.dirx + (point[1] - edge.a.z) * edge.dirz) / edge.len)), local = a + (b - a) * t;
    let original = 0;
    for (let i = 1; i < way.projected.length; i++) {
        const len = distance(way.projected[i - 1], way.projected[i]);
        if (local >= original - EPS && local <= original + len + EPS) {
            const leg = path.legs.find(l => l.sourceId === id && l.index === i - 1);
            return leg ? leg.s0 + (leg.s1 - leg.s0) * Math.max(0, Math.min(1, (local - original) / len)) : null;
        }
        original += len;
    }
    return null;
}
/** Unique curvilinear source section, using exact shared miter boundaries.
 * This associates height only; source coordinates and graph topology stay put. */
export function sourceFrames(points, halfWidth = 25) {
    const cumulative = [0], vectors = [];
    for (let i = 1; i < points.length; i++) { const len = distance(points[i - 1], points[i]); if (!(len > EPS)) return null; vectors.push([(points[i][0] - points[i - 1][0]) / len, (points[i][1] - points[i - 1][1]) / len]); cumulative.push(cumulative.at(-1) + len); }
    const normals = points.map((_, i) => { const a = vectors[Math.max(0, i - 1)], b = vectors[Math.min(vectors.length - 1, i)], d = 1 + a[0] * b[0] + a[1] * b[1]; return d > .1 ? [-(a[1] + b[1]) / d, (a[0] + b[0]) / d] : null; });
    if (normals.some(n => !n)) return null;
    // Piecewise-affine sections keep station continuous across shared miter
    // boundaries, and preserve exact piecewise-quadratic ramp coefficients.
    const cells = [];
    for (let i = 0; i < vectors.length; i++) for (const side of [-1, 1]) {
        const a = points[i], b = points[i + 1], c = [a[0] + normals[i][0] * halfWidth * side, a[1] + normals[i][1] * halfWidth * side], d = [b[0] + normals[i + 1][0] * halfWidth * side, b[1] + normals[i + 1][1] * halfWidth * side];
        cells.push({poly:[a,b,d], stations:[cumulative[i],cumulative[i+1],cumulative[i+1]], segment:i}, {poly:[a,d,c],stations:[cumulative[i],cumulative[i+1],cumulative[i]],segment:i});
    }
    const bary = (p, poly) => { const [a,b,c]=poly, v=[b[0]-a[0],b[1]-a[1]], w=[c[0]-a[0],c[1]-a[1]], r=[p[0]-a[0],p[1]-a[1]], den=cross(v,w); if(Math.abs(den)<1e-12)return null; const u=cross(r,w)/den,vv=cross(v,r)/den; return [1-u-vv,u,vv]; };
    for(const cell of cells){const q0=bary([0,0],cell.poly),qx=bary([1,0],cell.poly),qz=bary([0,1],cell.poly); const val=q=>q.reduce((v,w,i)=>v+w*cell.stations[i],0), c=val(q0);cell.stationCoefficients=[val(qx)-c,val(qz)-c,c];}
    // Every height query on the shared profile ends here. It used to test all cells; a tram beside the shared decks asked
    // thousands of times per step (a quarter of the whole traffic step). The grid only skips cells whose bounding box,
    // padded far beyond the barycentric tolerance, cannot hold the point; candidates keep their original order, so the
    // result is the same.
    const GRID=12, PAD=.05, lookup=new Map();
    cells.forEach((cell,n)=>{const xs=cell.poly.map(p=>p[0]),zs=cell.poly.map(p=>p[1]);
        for(let i=Math.floor((Math.min(...xs)-PAD)/GRID);i<=Math.floor((Math.max(...xs)+PAD)/GRID);i++)for(let j=Math.floor((Math.min(...zs)-PAD)/GRID);j<=Math.floor((Math.max(...zs)+PAD)/GRID);j++){const k=i+','+j;let list=lookup.get(k);if(!list)lookup.set(k,list=[]);list.push(n);}});
    const locate = point => {
        const hits=[], list=lookup.get(Math.floor(point[0]/GRID)+','+Math.floor(point[1]/GRID)); if(!list)return null;
        for(const n of list){const cell=cells[n],q=bary(point,cell.poly); if(!q || q.some(v=>v < -EPS || v > 1+EPS))continue; const s=q.reduce((sum,v,i)=>sum+v*cell.stations[i],0), segment=cell.segment,t=(s-cumulative[segment])/(cumulative[segment+1]-cumulative[segment]); if(!hits.some(h=>Math.abs(h.s-s)<1e-5))hits.push({s,segment,t});}
        return hits.length===1?hits[0]:null;
    };
    const breaksForSegment = (a,b,stations=[]) => {
        const fractions=new Set([0,1]), v=[b[0]-a[0],b[1]-a[1]];
        for(const cell of cells){
            for(let i=0;i<3;i++){const p=cell.poly[i],q=cell.poly[(i+1)%3],w=[q[0]-p[0],q[1]-p[1]],r=[p[0]-a[0],p[1]-a[1]],den=cross(v,w);if(Math.abs(den)<1e-12)continue;const t=cross(r,w)/den,u=cross(r,v)/den;if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)fractions.add(t);}
        }
        const ts=[...fractions].sort((x,y)=>x-y);
        for(let i=1;i<ts.length;i++){const t0=ts[i-1],t1=ts[i],q0=locate([a[0]+v[0]*t0,a[1]+v[1]*t0]),q1=locate([a[0]+v[0]*t1,a[1]+v[1]*t1]);if(!q0||!q1||Math.abs(q1.s-q0.s)<1e-12)continue;for(const station of stations){const u=(station-q0.s)/(q1.s-q0.s);if(u>EPS&&u<1-EPS)fractions.add(t0+(t1-t0)*u);}}
        return [...fractions].sort((x,y)=>x-y);
    };
    return { points, normals, cumulative, cells, locate, breaksForSegment, length: cumulative.at(-1) };
}

/** Clip a convex polygon by affine value >= minimum. */
export function clipAffine(poly, coefficients, minimum=0){
 const value=p=>coefficients[0]*p[0]+coefficients[1]*p[1]+coefficients[2]-minimum, out=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=value(a),v=value(b),ia=u>=-1e-9,ib=v>=-1e-9;if(ia)out.push(a);if(ia!==ib){const t=u/(u-v);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;
}
