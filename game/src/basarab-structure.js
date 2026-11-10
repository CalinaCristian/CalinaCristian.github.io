import * as THREE from '../vendor/three.module.min.js';
import { MeshBuilder, rgb } from './geobuild.js';
import { decodeTramPoints } from './tram-path.js';
import { BASARAB_PLATFORMS } from './basarab-source.js';

const railIds=['w118416425','w205971103'];
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function sourceLine(data,id,grades){
 const w=data.tramSourceWays?.find(w=>w.sourceId===id),points=w&&decodeTramPoints(w.points,data.q||10);
 if(!points)return null;
 const segments=points.slice(1).map((b,i)=>{const a=points[i],length=distance(a,b);return{a,b,length,i,grade:grades.resolveGrade(w,{index:i})};});
 return {id,points,segments};
}
function nearest(line,p){
 let best=null;
 for(const s of line.segments){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/(s.length*s.length))),q=mix(s.a,s.b,t),d=distance(q,p);if(!best||d<best.d)best={...s,p:q,t,d,dx:dx/s.length,dz:dz/s.length};}
 return best;
}
function height(q,p=q.p){const g=q?.grade;return g?.known? .2+(g.heightAtWorld?g.heightAtWorld(...p):g.heightAt(q.t)):null;}
/** Closed support pieces expose their actual serialized top triangles to both
 * rendering and physical height readers; they never alter rail/motor routing. */
function support(poly,ys,depth,sourceId,kind){
 const top=poly.map((p,i)=>[Math.fround(p[0]),Math.fround(ys[i]),Math.fround(p[1])]);
 const indices=THREE.ShapeUtils.triangulateShape(top.map(p=>new THREE.Vector2(p[0],p[2])),[]);
 const triangles=indices.map(t=>t.map(i=>top[i]));
 const at=(x,z)=>{for(const [a,b,c]of triangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return u*a[1]+v*b[1]+(1-u-v)*c[1];}return null;};
 const x=top.reduce((n,p)=>n+p[0],0)/top.length,z=top.reduce((n,p)=>n+p[2],0)/top.length;
 return {poly:top.map(p=>[p[0],p[2]]),top,triangles,depth,sourceId,kind,x,z,r:Math.max(...top.map(p=>Math.hypot(p[0]-x,p[2]-z))),holes:[],roadDeck:true,railDeck:true,estimated:true,y0:Math.min(...ys)-depth,y1:Math.max(...ys),h:Math.max(...ys),roofHeightAt:at,minHeightAt:(x,z)=>{const h=at(x,z);return h===null?null:h-depth;}};
}
function drawSupport(piece,cellOf){
 const mb=cellOf(piece.x,piece.z).solid;
 for(const t of piece.triangles){mb.face3(...t,rgb('#a8aaa7'),[0,1,0]);mb.face3(...t.map(p=>[p[0],p[1]-piece.depth,p[2]]),rgb('#555a60'),[0,-1,0]);}
 for(let i=0;i<piece.top.length;i++){const a=piece.top[i],b=piece.top[(i+1)%piece.top.length];mb.face4([a[0],a[1]-piece.depth,a[2]],[b[0],b[1]-piece.depth,b[2]],b,a,rgb('#92999d'),[b[2]-a[2],0,a[0]-b[0]]);}
}
/** Mesh-batched square beam. Member dimensions remain documented estimates. */
export function bridgeBeam(cellOf,a,b,width,col){
 const d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d);if(L<1e-7)return;
 const u=d.map(v=>v/L),basis=Math.abs(u[1])>.95?[1,0,0]:[0,1,0],cross=(v,w)=>[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]],v=cross(u,basis),vl=Math.hypot(...v),n=v.map(x=>x/vl),m=cross(u,n),r=width/2;
 const ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>p.map((x,i)=>x+r*(s*n[i]+t*m[i]))),A=ring(a),B=ring(b),mb=cellOf((a[0]+b[0])/2,(a[2]+b[2])/2).solid,color=rgb(col);
 for(let i=0;i<4;i++){const j=(i+1)%4;mb.face4(A[i],B[i],B[j],A[j],color,A[i].map((x,k)=>x-a[k]));}
 mb.face4(...A,color,u.map(x=>-x));mb.face4(...B,color,u);
}
export function basarabEdge(data,e){return data.city==='bucharest'&&data.district?.id==='grozavesti'&&(data.roadSourceGeometry?.[e.road]?.tags?.name==='Pasajul Basarab'||e.sourceBridgeGrade?.modelId==='basarab-shared-fork'||['w84488180','w314448326','w458458362'].includes(data.roadSourceGeometry?.[e.road]?.sourceId));}
/** Real literal platform outlines and a bounded centre support gap. The same
 * source height field already carries the two tracks. No invented broad deck
 * polygon, coordinate snapping, lane edits or source-record deletion. */
export function buildBasarabStructure(data,grades,cellOf,group){
 const report={active:false,sourcePlatforms:[],gapPieces:0,unresolved:[],estimated:true},pieces=[],colliders=[];
 if(data.city!=='bucharest'||data.district?.id!=='grozavesti')return{report,pieces,colliders};
 const [line,paired]=railIds.map(id=>sourceLine(data,id,grades));if(!line||!paired)return{report,pieces,colliders};report.active=true;
 for(const seg of line.segments){
  if(!seg.grade?.known)continue;
  const count=Math.max(1,Math.ceil(seg.length/2));
  for(let i=0;i<count;i++){
   const ps=[mix(seg.a,seg.b,i/count),mix(seg.a,seg.b,(i+1)/count)],rows=ps.map(p=>{
    const a=nearest(line,p),b=nearest(paired,p);if(!a||!b||b.d>10||b.d<3.4)return null;
    const dx=(b.p[0]-p[0])/b.d,dz=(b.p[1]-p[1])/b.d,A=[p[0]+dx*1.7,p[1]+dz*1.7],B=[b.p[0]-dx*1.7,b.p[1]-dz*1.7],ha=height(a,A),hb=height(b,B);
    if(ha===null||hb===null||Math.min(ha,hb)<1||Math.abs(ha-hb)>.02)return null;
    return {A,B,ha,hb};
   });
   if(rows.some(r=>!r))continue;
   const [a,b]=rows,piece=support([a.A,b.A,b.B,a.B],[a.ha,b.ha,b.hb,a.hb],.4,railIds.join('+'),'basarab-centre-support');drawSupport(piece,cellOf);pieces.push(piece);report.gapPieces++;
  }
 }
 for(const platform of BASARAB_PLATFORMS){
  const hs=platform.points.map(p=>height(nearest(line,p)));if(hs.some(h=>h===null)||Math.max(...hs)-Math.min(...hs)>.5){report.unresolved.push({sourceId:platform.sourceId,reason:'platform-compatible-source-grade-missing'});continue;}
  const piece=support(platform.points,hs.map(h=>h+.18),.35,platform.sourceId,'basarab-platform');drawSupport(piece,cellOf);pieces.push(piece);report.sourcePlatforms.push(platform.sourceId);
 }
 const structure=drawSuperstructure(BASARAB_PLATFORMS,line,paired,cellOf,group);
 colliders.push(...structure.colliders);report.superstructure=structure.report;
 return {report,pieces,colliders};
}

/** Surviving physical rail intervals own the visible Basarab edge treatment.
 * White open steel rails and a blue fascia follow builder photographs. */
export function drawBasarabGuard(w,cellOf){
 const L=Math.hypot(w.bx-w.ax,w.bz-w.az),n=Math.max(1,Math.ceil(L/2.4)),at=(t,h)=>[w.ax+(w.bx-w.ax)*t,w.y1a+(w.y1b-w.y1a)*t-1.1+h,w.az+(w.bz-w.az)*t];
 for(const h of [.48,.97])bridgeBeam(cellOf,at(0,h),at(1,h),.1,'#e4e8e7');
 bridgeBeam(cellOf,at(0,.1),at(1,.1),.18,'#456e9a');
 for(let i=0;i<=n;i++)bridgeBeam(cellOf,at(i/n,.15),at(i/n,1.08),.085,'#dce2e2');
}

/** Completed bridge form from the builder's description/photos. Untagged
 * placement and member sections are estimates, listed in the source ledger.
 * The 2006 proposal's different span sizes are deliberately not used. */
function drawSuperstructure(platforms,line,paired,cellOf,group){
 const pts=platforms.flatMap(p=>p.points),a=platforms[0].points[0],b=platforms[0].points[4],L=distance(a,b),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-u[1],u[0]],ss=p=>(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],ns=p=>(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1];
 const s0=Math.min(...pts.map(ss)),s1=Math.max(...pts.map(ss)),n0=Math.min(...pts.map(ns)),n1=Math.max(...pts.map(ns)),nc=(n0+n1)/2,half=(n1-n0)/2+.25;
 const at=(s,t,y)=>[a[0]+u[0]*s+n[0]*t,y,a[1]+u[1]*s+n[1]*t];
 const deck=height(nearest(line,[(a[0]+b[0])/2,(a[1]+b[1])/2]));
 const colliders=[],report={estimated:true,pylonHeightM:80,stays:60,archSpanM:120,roofLengthM:s1-s0,roofWidthM:2*half,sourcePlatforms:platforms.map(p=>p.sourceId),placementBasis:'Station frame from literal platform boundaries; pylon/arch anchor offsets and structural sections estimated, not surveyed'};
 if(deck===null)return {colliders,report:{...report,unresolved:'station-height-missing'}};
 // Transparent station barrel, open at both ends, with white steel hoops.
 const glass=new MeshBuilder(),bands=12,ribs=Math.ceil((s1-s0)/5),roof=(s,k)=>{const theta=k/bands*Math.PI;return at(s,nc-Math.cos(theta)*half,deck+.35+Math.sin(theta)*6.3);};
 for(let i=0;i<=ribs;i++)for(let j=0;j<bands;j++)bridgeBeam(cellOf,roof(s0+(s1-s0)*i/ribs,j),roof(s0+(s1-s0)*i/ribs,j+1),.105,'#dce6e7');
 for(let j=1;j<bands;j+=2)bridgeBeam(cellOf,roof(s0,j),roof(s1,j),.075,'#dce6e7');
 for(let i=0;i<ribs;i++)for(let j=0;j<bands;j++){const sa=s0+(s1-s0)*i/ribs,sb=s0+(s1-s0)*(i+1)/ribs;glass.face4(roof(sa,j),roof(sb,j),roof(sb,j+1),roof(sa,j+1),rgb('#aacbd8'),[n[0],1,n[1]]);}
 if(group){const mesh=new THREE.Mesh(glass.build(),new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.2,roughness:.34,metalness:.08,depthWrite:false,side:THREE.DoubleSide}));mesh.name='Basarab mapped-platform station roof (estimated section)';mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}
 // Twin 80m legs with upper crossbeams and sixty fan stays. Their longitudinal
 // anchor is a MODEL30m southwest of the literal covered-platform endpoint.
 const towerS=s0-30,legOffset=half+1.8;
 for(const sign of [-1,1]){
  const c=at(towerS,nc+sign*legOffset,.2);cellOf(c[0],c[2]).solid.box(c[0],.2,c[2],3,79.8,3,Math.atan2(u[0],u[1]),rgb('#d8d8d0'));
  const poly=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([v,w])=>[c[0]+u[0]*v*1.5+n[0]*w*1.5,c[2]+u[1]*v*1.5+n[1]*w*1.5]);
  colliders.push({x:c[0],z:c[2],r:Math.SQRT2*1.5,poly,holes:[],h:80,y0:.2,y1:80,prop:true,kind:'basarab-pylon',estimated:true});
  for(const dir of [-1,1])for(let i=0;i<15;i++){const fraction=(i+1)/15,anchorS=towerS+dir*(18+fraction*(dir>0?152:92));bridgeBeam(cellOf,at(towerS,nc+sign*legOffset,42+fraction*35),at(anchorS,nc+sign*legOffset,deck+.4),.11,'#b4c3c9');}
 }
 for(const y of [58,67,76])bridgeBeam(cellOf,at(towerS,nc-legOffset,y),at(towerS,nc+legOffset,y),1,'#d7d9d3');
 // River crossing: the mapped lower Grozavesti bridge constrains its position;
 // the upper main rail pair supplies the local Basarab direction and level.
 const river=nearest(line,[115,-222]);
 if(river?.grade?.known){
  const center=mix(river.p,nearest(paired,river.p).p,.5),ux=river.dx,uz=river.dz,nx=-uz,nz=ux,base=height(river),span=120,arch=(t,sign)=>[center[0]+ux*(t-.5)*span+nx*sign*15,base+Math.sin(Math.PI*t)*26,center[1]+uz*(t-.5)*span+nz*sign*15];
  for(const sign of [-1,1]){for(let i=0;i<32;i++)bridgeBeam(cellOf,arch(i/32,sign),arch((i+1)/32,sign),1.15,'#e1e5e4');for(let i=1;i<16;i++){const t=i/16,q=arch(t,sign);bridgeBeam(cellOf,q,[q[0],base+.15,q[2]],.115,'#b6c4c8');}}
  for(const t of [.25,.5,.75])bridgeBeam(cellOf,arch(t,-1),arch(t,1),.65,'#d8e0e1');
 }
 return {colliders,report};
}
