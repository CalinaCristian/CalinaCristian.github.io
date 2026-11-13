/** One mesh/query surface over an unchanged source-junction road hull.
 * A fan includes the literal source node and source-road mouth centre rays.
 * Added vertices are tessellation only; no graph nodes or joins are created. */
export function sharedBridgePadSurface(node,poly,edges,heightFor,{baseM=.24}={}){
 if(!(node?.sourceId>0)||poly.length<3||!edges.some(e=>e.sourceBridgeGrade?.known))return null;
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],P=poly.map(p=>p.slice()), rows=[];
 for(let i=0;i<P.length;i++){
  const a=P[i],b=P[(i+1)%P.length],v=[b[0]-a[0],b[1]-a[1]],hits=[{t:0,p:a}];
  for(const e of edges){const sign=e.a===node?1:-1,u=[e.dirx*sign,e.dirz*sign],r=[a[0]-node.x,a[1]-node.z],den=cross(u,v);if(Math.abs(den)<1e-12)continue;const ray=cross(r,v)/den,t=cross(r,u)/den;if(ray>0&&t>1e-8&&t<1-1e-8)hits.push({t,p:[a[0]+v[0]*t,a[1]+v[1]*t],edge:e});}
  hits.sort((a,b)=>a.t-b.t);for(const hit of hits)if(!rows.length||Math.hypot(rows.at(-1).p[0]-hit.p[0],rows.at(-1).p[1]-hit.p[1])>1e-7)rows.push(hit);
 }
 const nearest=p=>{let best=Infinity,y;for(const e of edges){const t=Math.max(0,Math.min(1,((p[0]-e.a.x)*e.dirx+(p[1]-e.a.z)*e.dirz)/e.len)),d=Math.hypot(p[0]-e.a.x-e.dirx*e.len*t,p[1]-e.a.z-e.dirz*e.len*t);if(d<best){best=d;y=heightFor(e,p);}}return y;};
 const inside=(()=>{let sign=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],v=(b[0]-a[0])*(node.z-a[1])-(b[1]-a[1])*(node.x-a[0]);if(Math.abs(v)<1e-9)continue;if(sign&&Math.sign(v)!==sign)return false;sign=Math.sign(v);}return true;})(),center=inside?[node.x,node.z]:[P.reduce((v,p)=>v+p[0],0)/P.length,P.reduce((v,p)=>v+p[1],0)/P.length];
 const C=[Math.fround(center[0]),Math.fround(baseM+(inside?node.y:nearest(center))),Math.fround(center[1])],boundary=rows.map(r=>[Math.fround(r.p[0]),Math.fround(baseM+(r.edge?heightFor(r.edge,r.p):nearest(r.p))),Math.fround(r.p[1])]),triangles=boundary.map((p,i)=>[C,p,boundary[(i+1)%boundary.length]]);
 const {heightAtWorld,blendHeight}=padFieldFunctions(P,triangles,baseM);
 return Object.defineProperty({topTriangles:triangles,sourceNodeId:node.sourceId,sourceNodeInside:inside,poly:P,heightAtWorld,blendHeight,transitionBandM:2,contains:p=>heightAtWorld(...p)!==null,basis:'MODEL shared source-junction fan; exact original road hull and node; Float32 triangle/query agreement'},'baseM',{value:baseM}); // (baseM: not enumerable, so the record is as before)
}

/** A pad's height queries from its hull P and fan triangles (sharedBridgePadSurface; the build workers make them from the
 *  same numbers): heightAtWorld(x, z) inside the fan, else null; blendHeight(x, z, raw) eases a road height into it. */
export function padFieldFunctions(P,triangles,baseM){
 const heightAtWorld=(x,z)=>{for(const [a,b,c]of triangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-1e-5&&v>=-1e-5&&u+v<=1+1e-5)return u*a[1]+v*b[1]+(1-u-v)*c[1]-baseM;}return null;};
 // (spec 10 load budget) bounds of the hull and the fan: a point more than bandM + 1 m outside them is outside every
 // fan triangle (its tolerance is 1e-5 of a triangle) and at least bandM from the hull, so its answer is raw
 let bx0=Infinity,bz0=Infinity,bx1=-Infinity,bz1=-Infinity;for(const p of [...P,...triangles.flat().map(q=>[q[0],q[2]])]){bx0=Math.min(bx0,p[0]);bz0=Math.min(bz0,p[1]);bx1=Math.max(bx1,p[0]);bz1=Math.max(bz1,p[1]);}
 const blendHeight=(x,z,raw,bandM=2)=>{
  if(x<bx0-bandM-1||x>bx1+bandM+1||z<bz0-bandM-1||z>bz1+bandM+1)return raw;
  const inside=heightAtWorld(x,z);if(inside!==null)return inside;
  let nearest=Infinity;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));nearest=Math.min(nearest,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}
  if(nearest>=bandM)return raw;
  for(const [a,b,c]of triangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
   // The fan origin is vertex a: its angular sector extends beyond b→c.
   if(v>=-1e-5&&1-u-v>=-1e-5){const extended=u*a[1]+v*b[1]+(1-u-v)*c[1]-baseM,t=nearest/bandM,w=t*t*(3-2*t);return extended+(raw-extended)*w;}
  }
  return raw;
 };
 return{heightAtWorld,blendHeight};
}
