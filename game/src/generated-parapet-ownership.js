// Ownership of coincident GENERATED render surfaces. No collider, source
// record, source coordinate, physical guard or actor is removed or moved.
const area3 = P => { let sum=0;for(let i=1;i<P.length-1;i++){const a=P[i].map((v,k)=>v-P[0][k]),b=P[i+1].map((v,k)=>v-P[0][k]);sum+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;}return sum; };
// Intersection vertices carry the exact construction boundary. Evaluating that
// same plane again must return zero rather than a cancellation-sized signed
// distance. Coordinates are never offset and no geometric epsilon is used.
const boundaries=new WeakMap();
function makePlane(raw,key){const score=v=>boundaries.get(v)?.has(key)?0:raw(v);score.key=key;return score;}
function clip(P,score,inside){const Q=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],sa=score(a),sb=score(b),ia=inside?sa>=0:sa<0,ib=inside?sb>=0:sb<0;if(ia)Q.push(a);if(ia!==ib){const t=sa/(sa-sb),p=a.map((v,k)=>v+(b[k]-v)*t),A=boundaries.get(a),B=boundaries.get(b),on=new Set([score.key]);if(A&&B)for(const key of A)if(B.has(key))on.add(key);boundaries.set(p,on);Q.push(p);}}return Q;}

const bounds=P=>({x0:Math.min(...P.map(p=>p[0])),x1:Math.max(...P.map(p=>p[0])),y0:Math.min(...P.map(p=>p[1])),y1:Math.max(...P.map(p=>p[1])),z0:Math.min(...P.map(p=>p[2])),z1:Math.max(...P.map(p=>p[2]))});
const overlaps=(a,b)=>a.x0<=b.x1&&a.x1>=b.x0&&a.y0<=b.y1&&a.y1>=b.y0&&a.z0<=b.z1&&a.z1>=b.z0;
// Independent builders subdivide the same inferred boundary differently before
// storing it in Float32. Its rounding cell, rather than a world-space epsilon,
// defines when two emitted boundaries represent the same construction plane.
const floatCellRadius=v=>Math.max(2**-150,2**(Math.floor(Math.log2(Math.abs(v)||2**-126))-24));
const radius3=P=>[0,1,2].map(k=>Math.max(...P.map(p=>floatCellRadius(p[k]))));
function roundingPlanes(piece,face){
 const queryRadius=radius3(face),corners=piece.top;
 return piece.planes.map((plane,i)=>{
  let error;
  if(i<3){
   const a=corners[i],b=corners[(i+1)%3],ra=radius3([a]),rb=radius3([b]);
   error=Math.max(...face.map(p=>Math.abs(b[2]-p[2])*ra[0]+Math.abs(p[0]-b[0])*ra[2]+
    Math.abs(p[2]-a[2])*rb[0]+Math.abs(p[0]-a[0])*rb[2]+
    Math.abs(b[2]-a[2])*queryRadius[0]+Math.abs(b[0]-a[0])*queryRadius[2]))+
    (ra[0]+rb[0])*(ra[2]+queryRadius[2])+(ra[2]+rb[2])*(ra[0]+queryRadius[0]);
  }else{
   const r=radius3(corners),[A,Z]=piece.slope;
   error=Math.abs(A)*(r[0]+queryRadius[0])+r[1]+queryRadius[1]+Math.abs(Z)*(r[2]+queryRadius[2]);
  }
  // Only a whole coincident face can adopt the shared plane. Ordinary crossing
  // faces keep the exact construction boundary, including line-only touches.
  return face.every(v=>Math.abs(plane(v))<=error)
   ? makePlane(v=>plane(v)+error,plane.key+':float32') : plane;
 });
}
export function buildGeneratedParapetOwnership(){
 const pieces=[],cells=new Map(),cell=16,report={caps:0,faces:0,untouched:0,fullyOwned:0,partial:0,inputAreaM2:0,keptAreaM2:0,serializedDegenerates:0,maxSerializationErrorM:0,constrainedSerializationVertices:0,unresolvedSerializationVertices:0,owners:[],policy:'Later inferred separation render faces yield to earlier bridge-cap prisms. Whole coincident faces share a boundary only within their calculated Float32 rounding cells. All physical and mapped guards remain untouched.'};
 const keys=b=>{const out=[];for(let x=Math.floor(b.x0/cell);x<=Math.floor(b.x1/cell);x++)for(let z=Math.floor(b.z0/cell);z<=Math.floor(b.z1/cell);z++)out.push(x+','+z);return out;};
 const addCapTriangle=(top,{heightM,owner}={})=>{
  if(owner?.emitter!=='bridge-parapet'||owner.inferred!==true||!(heightM>0)||top.length!==3||!top.flat().every(Number.isFinite))return false;
  top=top.map(p=>p.slice());const[p,q,r]=top,den=(q[0]-p[0])*(r[2]-p[2])-(r[0]-p[0])*(q[2]-p[2]);if(!den)return false;
  const A=((q[1]-p[1])*(r[2]-p[2])-(r[1]-p[1])*(q[2]-p[2]))/den,Z=((q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]))/den,sign=Math.sign(den),planes=[],planeKey=JSON.stringify([top,heightM]);
  for(let i=0;i<3;i++){const a=top[i],b=top[(i+1)%3];planes.push(makePlane(v=>sign*((b[0]-a[0])*(v[2]-a[2])-(b[2]-a[2])*(v[0]-a[0])),planeKey+':'+i));}
  const topAt=v=>p[1]+A*(v[0]-p[0])+Z*(v[2]-p[2]);
  planes.push(makePlane(v=>topAt(v)-v[1],planeKey+':top'),makePlane(v=>v[1]-(topAt(v)-heightM),planeKey+':bottom'));
  const box=bounds(top);box.y0-=heightM;const piece={id:pieces.length,top:top.map(p=>p.slice()),slope:[A,Z],heightM,owner:{...owner},box,planes};pieces.push(piece);for(const k of keys(box)){if(!cells.has(k))cells.set(k,[]);cells.get(k).push(piece);}report.caps++;if(report.owners.length<24&&!report.owners.some(o=>o.sourceId===owner.sourceId&&o.edgeId===owner.edgeId))report.owners.push({...owner});return true;
 };
 const addBuilderCaps=(mb,metadata)=>{for(let i=0;i<mb.ic;i+=3){const ids=[mb.i[i],mb.i[i+1],mb.i[i+2]];if(ids.some(k=>mb.n[k*3+1]<=.5))continue;addCapTriangle(ids.map(k=>Array.from(mb.p.subarray(k*3,k*3+3))),metadata);}};
 const subtractFace=(face,metadata={})=>{
  if(metadata.inferred!==true||metadata.emitter!=='separation-barrier')return{changed:false,polygons:[face],ownerIds:[]};
  report.faces++;const originalArea=area3(face),box=bounds(face),r=radius3(face),search={x0:box.x0-4*r[0],x1:box.x1+4*r[0],y0:box.y0-4*r[1],y1:box.y1+4*r[1],z0:box.z0-4*r[2],z1:box.z1+4*r[2]},near=[...new Set(keys(search).flatMap(k=>cells.get(k)||[]))].filter(p=>overlaps(search,p.box));let polygons=[face],changed=false;const ownerIds=[];
  for(const piece of near){const planes=roundingPlanes(piece,face),next=[];for(const P of polygons){let rest=P,parts=[];for(const plane of planes){const outside=clip(rest,plane,false);if(outside.length>=3&&area3(outside)>0)parts.push(outside);rest=clip(rest,plane,true);if(rest.length<3)break;}const boundaryOnly=rest.length>=3&&planes.some(plane=>rest.every(v=>plane(v)===0)&&P.some(v=>plane(v)!==0));if(rest.length>=3&&!boundaryOnly&&area3(rest)>0){changed=true;ownerIds.push(piece.id);next.push(...parts);}else next.push(P);}polygons=next;if(!polygons.length)break;}
  const kept=polygons.reduce((n,P)=>n+area3(P),0);report.inputAreaM2+=originalArea;report.keptAreaM2+=kept;if(!changed)report.untouched++;else if(!polygons.length)report.fullyOwned++;else report.partial++;return{changed,polygons,ownerIds:[...new Set(ownerIds)]};
 };
 // Round newly constructed intersections to an adjacent representable point
 // on the retained side of each already-proven outside halfplane. This is
 // directed Float32 serialization of new mesh vertices, never a prism offset.
 const bits=new DataView(new ArrayBuffer(4)),adjacent=(v,up)=>{if(v===0)return up?2**-149:-(2**-149);bits.setFloat32(0,v);let n=bits.getUint32(0);n+=(v>0)===up?1:-1;bits.setUint32(0,n);return bits.getFloat32(0);};
 const serializePolygon=P=>{
  const b=bounds(P),m=Math.max(1,...P.flat().map(Math.abs)),ulp=2**(Math.floor(Math.log2(m))-23),search={x0:b.x0-ulp,x1:b.x1+ulp,y0:b.y0-ulp,y1:b.y1+ulp,z0:b.z0-ulp,z1:b.z1+ulp},near=[...new Set(keys(search).flatMap(k=>cells.get(k)||[]))].filter(p=>overlaps(search,p.box)),constraints=[];
  for(const piece of near){const candidates=piece.planes.filter(plane=>P.every(v=>plane(v)<=0)&&P.some(v=>plane(v)<0));if(candidates.length)constraints.push(candidates[0]);}
  return P.map(p=>{const nearest=p.map(Math.fround);if(constraints.every(plane=>plane(nearest)<=0))return nearest;
   const choices=p.map((v,i)=>nearest[i]===v?[v]:nearest[i]<v?[nearest[i],adjacent(nearest[i],true)]:[adjacent(nearest[i],false),nearest[i]]);let best=null,distance=Infinity;
   for(const x of choices[0])for(const y of choices[1])for(const z of choices[2]){const f=[x,y,z];if(!constraints.every(plane=>plane(f)<=0))continue;const d=f.reduce((s,v,i)=>s+(v-p[i])**2,0);if(d<distance){best=f;distance=d;}}
   if(best){report.constrainedSerializationVertices++;return best;}report.unresolvedSerializationVertices++;return nearest;
  });
 };
 return{addCapTriangle,addBuilderCaps,subtractFace,serializePolygon,pieces,report};
}

/** Same original material normal/UVs, with only owned face portions removed.
 * Classification uses the Float32 vertices the original MeshBuilder emitted.
 * Sub-ULP child triangles may collapse on directed serialization; no clearance epsilon
 * or offset expands a prism. Physical walls are not inputs to this function. */
export function emitOwnedSeparationQuad(mb,quad,col,out,metadata,ownership){
 const cornersUV=[[0,0],[1,0],[1,1],[0,1]];
 for(const ids of [[0,1,2],[0,2,3]]){
  const original=ids.map(i=>quad[i]),face=original.map(p=>p.map(Math.fround)),uvs=ids.map(i=>cornersUV[i]),result=ownership.subtractFace(face,metadata);
  if(!result.changed){mb.face3(...original,col,out,-1,uvs);continue;}
  const a=original[0],u=original[1].map((v,k)=>v-a[k]),v=original[2].map((v,k)=>v-a[k]);let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...normal)||1;normal=normal.map(n=>n/len);const flip=out&&normal.reduce((s,n,k)=>s+n*out[k],0)<0;if(flip)normal=normal.map(n=>-n);
  const A=face[0],U=face[1].map((v,k)=>v-A[k]),V=face[2].map((v,k)=>v-A[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),uu=dot(U,U),dotUV=dot(U,V),vv=dot(V,V),den=uu*vv-dotUV*dotUV;
  const atUV=p=>{const D=p.map((v,k)=>v-A[k]),du=dot(D,U),dv=dot(D,V),s=(vv*du-dotUV*dv)/den,t=(uu*dv-dotUV*du)/den;return[0,1].map(k=>uvs[0][k]*(1-s-t)+uvs[1][k]*s+uvs[2][k]*t);};
  for(const P of result.polygons){const serialized=ownership.serializePolygon(P);for(let i=1;i<P.length-1;i++){
   const T=[P[0],P[i],P[i+1]],F=[serialized[0],serialized[i],serialized[i+1]];for(let j=0;j<3;j++)for(let k=0;k<3;k++)ownership.report.maxSerializationErrorM=Math.max(ownership.report.maxSerializationErrorM,Math.abs(T[j][k]-F[j][k]));
   if(!area3(F)){ownership.report.serializedDegenerates++;continue;}
   const q=T.map((p,j)=>mb.v(...F[j],...normal,...atUV(p),col,-1));if(flip)mb.tri(q[0],q[2],q[1]);else mb.tri(q[0],q[1],q[2]);
  }}
 }
}
