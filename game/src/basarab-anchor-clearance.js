/** Collect actual emitted raised asphalt triangles before cell merging. These
 * finite surfaces, including pads, protect the full motor carriageway without
 * changing a source path, width or actor rule. */
export function raisedRoadTriangles(cells){
 const out=[];
 for(const c of cells)for(const kind of['road','pad']){
  const m=c[kind];if(!m)continue;
  for(let i=0;i<m.ic;i+=3){
   const p=[0,1,2].map(k=>{const v=m.i[i+k]*3;return[m.p[v],m.p[v+1],m.p[v+2]];}),minY=Math.min(...p.map(p=>p[1])),maxY=Math.max(...p.map(p=>p[1]));
   if(maxY<1)continue;
   const poly=p.map(p=>[p[0],p[2]]),area=(poly[1][0]-poly[0][0])*(poly[2][1]-poly[0][1])-(poly[1][1]-poly[0][1])*(poly[2][0]-poly[0][0]);if(Math.abs(area)<1e-7)continue;
   out.push({id:kind+':'+c.i+','+c.j+':'+i/3,poly,minY,maxY,x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),z0:Math.min(...poly.map(p=>p[1])),z1:Math.max(...poly.map(p=>p[1]))});
  }
 }
 return out;
}
/** Exact segment clipping against the outward half-planes of a convex source
 * polygon. Expansion circumscribes a member; it never rounds source vertices. */
function segmentPolygonBand(a,b,poly,radius=0){
 let signed=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];signed+=p[0]*q[1]-q[0]*p[1];}const sign=Math.sign(signed);if(!sign)return null;
 const dx=b[0]-a[0],dz=b[1]-a[1];let lo=0,hi=1;
 for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],ex=q[0]-p[0],ez=q[1]-p[1],f=sign*(ex*(a[1]-p[1])-ez*(a[0]-p[0]))+radius*Math.hypot(ex,ez),s=sign*(ex*dz-ez*dx);
  if(Math.abs(s)<1e-12){if(f<0)return null;continue;}
  const t=-f/s;if(s>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }
 return[lo,hi];
}
/** Full finite cable versus conservative motor/tram volumes. Motor bands span
 * the actual triangle's min/max height plus a4m complete-vehicle envelope. */
export function cableClearance(a,b,roads,trams=[],radius=.11*Math.SQRT2/2){
 const ax=[a[0],a[2]],bx=[b[0],b[2]],x0=Math.min(a[0],b[0])-radius,x1=Math.max(a[0],b[0])+radius,z0=Math.min(a[2],b[2])-radius,z1=Math.max(a[2],b[2])+radius;
 for(const [regions,kind]of[[roads,'motor-road'],[trams,'tram']])for(const r of regions){
  if(x1<r.x0||x0>r.x1||z1<r.z0||z0>r.z1)continue;
  const ts=segmentPolygonBand(ax,bx,r.poly,radius);if(!ts)continue;
  const ya=a[1]+(b[1]-a[1])*ts[0],yb=a[1]+(b[1]-a[1])*ts[1],bottom=r.minY-(kind==='motor-road'?.5:0),top=r.maxY+(kind==='motor-road'?4:0);
  if(Math.max(ya,yb)+radius>=bottom&&Math.min(ya,yb)-radius<=top)return{clear:false,kind,id:r.id,interval:ts};
 }
 return{clear:true};
}
/** All finite free bands across the actual deck section. Shared tram/motor
 * lanes need no invented separator; their union remains protected. */
export function anchorFreeIntervals(centre,normal,base,roads,trams,extent=24){
 const A=[centre[0]-normal[0]*extent,centre[1]-normal[1]*extent],B=[centre[0]+normal[0]*extent,centre[1]+normal[1]*extent],blocked=[];
 for(const[regions,motor]of[[roads,true],[trams,false]])for(const r of regions){
  if((motor?r.maxY+4:r.maxY)<base+.4||(motor?r.minY-.5:r.minY)>base+.4||centre[0]+extent<r.x0||centre[0]-extent>r.x1||centre[1]+extent<r.z0||centre[1]-extent>r.z1)continue;
  const q=segmentPolygonBand(A,B,r.poly,.15);if(q)blocked.push([-extent+q[0]*2*extent,-extent+q[1]*2*extent]);
 }
 blocked.sort((a,b)=>a[0]-b[0]);const free=[];let end=-extent;
 for(const[a,b]of blocked){if(a>end+.3)free.push({lo:end,hi:a});end=Math.max(end,b);}
 if(end<extent-.3)free.push({lo:end,hi:extent});return free;
}
export function deckSectionCentre(centre,normal,base,roads){
 const extent=36,A=[centre[0]-normal[0]*extent,centre[1]-normal[1]*extent],B=[centre[0]+normal[0]*extent,centre[1]+normal[1]*extent];let lo=Infinity,hi=-Infinity;
 for(const r of roads){if(r.minY>base+.5||r.maxY<base-.5)continue;const q=segmentPolygonBand(A,B,r.poly);if(q){lo=Math.min(lo,-extent+q[0]*2*extent);hi=Math.max(hi,-extent+q[1]*2*extent);}}
 return Number.isFinite(lo)&&Number.isFinite(hi)?(lo+hi)/2:0;
}
