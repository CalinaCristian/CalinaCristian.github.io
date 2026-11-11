import * as THREE from '../vendor/three.module.min.js';
import { MeshBuilder, rgb } from './geobuild.js';
import { decodeTramPoints } from './tram-path.js';
import { BASARAB_PLATFORMS } from './basarab-source.js';
import { convexHull } from './bridge-profile-geometry.js';
import { cableClearance,anchorFreeIntervals,deckSectionCentre } from './basarab-anchor-clearance.js';

const railIds=['w118416425','w205971103'];
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function sourceLine(data,id,grades){
 const w=data.tramSourceWays?.find(w=>w.sourceId===id),points=w&&decodeTramPoints(w.points,data.q||10);
 if(!points)return null;
 const segments=points.slice(1).map((b,i)=>{const a=points[i],length=distance(a,b);return{a,b,length,i,grade:grades.resolveGrade(w,{index:i})};});
 return {id,points,segments};
}
function roadLine(data,id,edges){
 const es=edges.filter(e=>(data.roadSourceGeometry?.[e.road]?.sourceId||e.sourceId)===id);
 let station=0;
 return es.length?{id,segments:es.map(e=>{const s={a:[e.a.x,e.a.z],b:[e.b.x,e.b.z],s0:station,length:e.len,edge:e,grade:{known:true,baseY:.24,heightAt:t=>e.sourceBridgeGrade?.known?e.sourceBridgeGrade.heightAt(t):e.ya+(e.yb-e.ya)*t}};station+=e.len;return s;})}:null;
}
function alongRoad(line,anchor,offset){
 const target=anchor.s0+anchor.t*anchor.length+offset;
 const s=line.segments.find(s=>target>=s.s0&&target<=s.s0+s.length);
 if(!s)return null;
 const t=(target-s.s0)/s.length;return{...s,t,p:mix(s.a,s.b,t),dx:(s.b[0]-s.a[0])/s.length,dz:(s.b[1]-s.a[1])/s.length};
}
function nearest(line,p){
 let best=null;
 for(const s of line.segments){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dz)/(s.length*s.length))),q=mix(s.a,s.b,t),d=distance(q,p);if(!best||d<best.d)best={...s,p:q,t,d,dx:dx/s.length,dz:dz/s.length};}
 return best;
}
function height(q,p=q.p){const g=q?.grade;return g?.known? (g.baseY??.2)+(g.heightAtWorld?g.heightAtWorld(...p):g.heightAt(q.t)):null;}
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
 // (owner, 2026-11-11, (549, -831) "why is this cut": the pale top read as a slice through the deck between the tracks; deck concrete now)
 for(const t of piece.triangles){mb.face3(...t,rgb('#6f6d68'),[0,1,0]);mb.face3(...t.map(p=>[p[0],p[1]-piece.depth,p[2]]),rgb('#555a60'),[0,-1,0]);}
 for(let i=0;i<piece.top.length;i++){const a=piece.top[i],b=piece.top[(i+1)%piece.top.length];mb.face4([a[0],a[1]-piece.depth,a[2]],[b[0],b[1]-piece.depth,b[2]],b,a,rgb('#92999d'),[b[2]-a[2],0,a[0]-b[0]]);}
}
/** Mesh-batched square beam. Member dimensions remain documented estimates. */
export function bridgeBeam(cellOf,a,b,width,col,colliders=null,kind='basarab-steel-member'){
 const d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d);if(L<1e-7)return;
 const u=d.map(v=>v/L),basis=Math.abs(u[1])>.95?[1,0,0]:[0,1,0],cross=(v,w)=>[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]],v=cross(u,basis),vl=Math.hypot(...v),n=v.map(x=>x/vl),m=cross(u,n),r=width/2;
 const ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>p.map((x,i)=>x+r*(s*n[i]+t*m[i]))),A=ring(a),B=ring(b),mb=cellOf((a[0]+b[0])/2,(a[2]+b[2])/2).solid,color=rgb(col);
 for(let i=0;i<4;i++){const j=(i+1)%4;mb.face4(A[i],B[i],B[j],A[j],color,A[i].map((x,k)=>x-a[k]));}
 mb.face4(...A,color,u.map(x=>-x));mb.face4(...B,color,u);
 if(colliders)colliders.push(bridgePrismCollider(a.map((x,i)=>(x+b[i])/2),[u,n,m],[L/2,r,r],kind));
}
/** A finite oriented solid, including its varying lower/upper height. A tall
 * AABB alone would make a sloping arch/cable block the street underneath it.
 * At radius0 the vertical slab intersection is exact; a moving body's radius
 * conservatively expands the three horizontal projections of the same solid. */
export function bridgePrismCollider(center,axes,half,kind){
 const vertices=[];
 for(const i of[-1,1])for(const j of[-1,1])for(const k of[-1,1])vertices.push(center.map((v,d)=>v+axes[0][d]*half[0]*i+axes[1][d]*half[1]*j+axes[2][d]*half[2]*k));
 const poly=convexHull(vertices.map(p=>[p[0],p[2]])),[x,,z]=center,y0=Math.min(...vertices.map(p=>p[1])),y1=Math.max(...vertices.map(p=>p[1]));
 const band=(px,pz,radius=0)=>{
  let bottom=-Infinity,top=Infinity;
  for(let i=0;i<3;i++){
   const v=axes[i],beta=v[0]*(px-x)+v[2]*(pz-z),h=half[i]+Math.max(0,radius)*Math.hypot(v[0],v[2]);
   if(Math.abs(v[1])<1e-10){if(Math.abs(beta)>h+1e-8)return null;continue;}
   const a=center[1]+(-h-beta)/v[1],b=center[1]+(h-beta)/v[1];bottom=Math.max(bottom,Math.min(a,b));top=Math.min(top,Math.max(a,b));
   if(bottom>top+1e-8)return null;
  }
  return [bottom,top];
 };
 return {x,z,r:Math.max(...poly.map(p=>Math.hypot(p[0]-x,p[1]-z))),poly,holes:[],h:y1,y0,y1,prop:true,kind,estimated:true,
  roofHeightAt:(x,z,radius)=>band(x,z,radius)?.[1]??null,minHeightAt:(x,z,radius)=>band(x,z,radius)?.[0]??null};
}
function roofPaneCollider(A,B,D){
 const ab=B.map((x,i)=>x-A[i]),ad=D.map((x,i)=>x-A[i]),L=Math.hypot(...ab),W=Math.hypot(...ad),u=ab.map(x=>x/L),v=ad.map(x=>x/W),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 return bridgePrismCollider(A.map((x,i)=>x+ab[i]/2+ad[i]/2),[u,v,n],[L/2,W/2,.02],'basarab-station-glazing');
}
export function basarabEdge(data,e){return data.city==='bucharest'&&data.district?.id==='grozavesti'&&(data.roadSourceGeometry?.[e.road]?.tags?.name==='Pasajul Basarab'||e.sourceBridgeGrade?.modelId==='basarab-shared-fork'||['w84488180','w314448326','w458458362'].includes(data.roadSourceGeometry?.[e.road]?.sourceId));}
/** Real literal platform outlines and a bounded centre support gap. The same
 * source height field already carries the two tracks. No invented broad deck
 * polygon, coordinate snapping, lane edits or source-record deletion. */
export function buildBasarabStructure(data,grades,cellOf,group,edges=[],{roadRegions=[],tramEnvelope=null,supportAt=null,tramSweep=null}={}){
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
 const tramRegions=[];
 if(tramEnvelope)for(const c of grades.corridors){
  const L=distance(c.a,c.b);if(L<1e-8)continue;const nx=-(c.b[1]-c.a[1])/L,nz=(c.b[0]-c.a[0])/L,w=tramEnvelope.halfWidthM,poly=[[c.a[0]+nx*w,c.a[1]+nz*w],[c.b[0]+nx*w,c.b[1]+nz*w],[c.b[0]-nx*w,c.b[1]-nz*w],[c.a[0]-nx*w,c.a[1]-nz*w]],hs=[0,.5,1].map(t=>.24+c.heightAt(t)),guard=(c.maxGrade||0)*L/4;
  tramRegions.push({id:c.sourceId,poly,minY:Math.min(...hs)-guard+tramEnvelope.tiltedMinY,maxY:Math.max(...hs)+guard+tramEnvelope.tiltedMaxY,x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),z0:Math.min(...poly.map(p=>p[1])),z1:Math.max(...poly.map(p=>p[1]))});
 }
 const deckSupportAt=(x,z,base)=>{let top=supportAt?.(x,z,base)??null;for(const p of pieces){const h=p.roofHeightAt(x,z);if(h!==null&&Math.abs(h-base)<.3&&(top===null||Math.abs(h-base)<Math.abs(top-base)))top=h;}return top;};
 const structure=drawSuperstructure(BASARAB_PLATFORMS,line,paired,cellOf,group,roadLine(data,'w458458361',edges),roadLine(data,'w1552024280',edges),roadRegions,tramRegions,tramEnvelope?.halfWidthM,deckSupportAt,tramSweep);
 colliders.push(...structure.colliders);report.superstructure=structure.report;
 report.unresolved.push(...structure.report.anchorUnresolved);
 return {report,pieces,colliders};
}

/** Surviving physical rail intervals own the visible Basarab edge treatment.
 * White open steel rails and a blue fascia follow builder photographs. */
/** `lit` (optional MeshBuilder): the blue band along the deck edge is repeated in it, for the night lighting. */
export function drawBasarabGuard(w,cellOf,lit=null){
 const L=Math.hypot(w.bx-w.ax,w.bz-w.az),n=Math.max(1,Math.ceil(L/2.4)),at=(t,h)=>[w.ax+(w.bx-w.ax)*t,w.y1a+(w.y1b-w.y1a)*t-1.1+h,w.az+(w.bz-w.az)*t];
 for(const h of [.48,.97])bridgeBeam(cellOf,at(0,h),at(1,h),.1,'#e4e8e7');
 bridgeBeam(cellOf,at(0,.1),at(1,.1),.18,'#456e9a');
 if(lit)bridgeBeam(()=>({solid:lit}),at(0,.1),at(1,.1),.215,'#456e9a');
 for(let i=0;i<=n;i++)bridgeBeam(cellOf,at(i/n,.15),at(i/n,1.08),.085,'#dce2e2');
}

/** Completed bridge form from the builder's description/photos. Untagged
 * placement and member sections are estimates, listed in the source ledger.
 * The 2006 proposal's different span sizes are deliberately not used. */
/** A finite cable against the swept cover of the rigid tram bodies, in 1 m pieces with the member's own height there. */
function cableInTramSweep(sweep,a,b,radius=.2){
 const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])));
 for(let i=0;i<n;i++){const p=[0,1,2].map(k=>a[k]+(b[k]-a[k])*i/n),q=[0,1,2].map(k=>a[k]+(b[k]-a[k])*(i+1)/n);if(sweep.segment([p[0],p[2]],[q[0],q[2]],radius,Math.min(p[1],q[1])-radius,Math.max(p[1],q[1])+radius))return true;}
 return false;
}
function drawSuperstructure(platforms,line,paired,cellOf,group,riverLine,riverPair,roads,trams,tramHalfWidth,supportAt,tramSweep=null){
 const pts=platforms.flatMap(p=>p.points),a=platforms[0].points[0],b=platforms[0].points[4],L=distance(a,b),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-u[1],u[0]],ss=p=>(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],ns=p=>(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1];
 const s0=Math.min(...pts.map(ss)),s1=Math.max(...pts.map(ss)),n0=Math.min(...pts.map(ns)),n1=Math.max(...pts.map(ns)),nc=(n0+n1)/2,half=(n1-n0)/2+.25;
 const at=(s,t,y)=>[a[0]+u[0]*s+n[0]*t,y,a[1]+u[1]*s+n[1]*t];
 const deck=height(nearest(line,[(a[0]+b[0])/2,(a[1]+b[1])/2]));
 const colliders=[],report={estimated:true,pylonHeightM:80,stays:60,emittedStays:0,anchors:[],anchorUnresolved:[],protectedRoadRegions:roads.length,archSpanM:120,roofLengthM:s1-s0,roofWidthM:2*half,sourcePlatforms:platforms.map(p=>p.sourceId),placementBasis:'Station frame from literal platform boundaries; pylon/arch anchor offsets and structural sections estimated, not surveyed'};
 if(deck===null)return {colliders,report:{...report,unresolved:'station-height-missing'}};
 // Transparent station barrel, open at both ends, with white steel hoops.
 // It is an elevated canopy, not a semicylinder ending at platform level.
 // Eaves/rise remain explicit visual estimates; the original6.65m crown is kept.
 const roofEaves=3.8,roofRise=2.85;
 report.roofEavesAboveDeckM=roofEaves;report.roofCrownAboveDeckM=roofEaves+roofRise;
 const glass=new MeshBuilder(),bands=12,ribs=Math.ceil((s1-s0)/5),roof=(s,k)=>{const theta=k/bands*Math.PI;return at(s,nc-Math.cos(theta)*half,deck+roofEaves+Math.sin(theta)*roofRise);};
 for(let i=0;i<=ribs;i++)for(let j=0;j<bands;j++)bridgeBeam(cellOf,roof(s0+(s1-s0)*i/ribs,j),roof(s0+(s1-s0)*i/ribs,j+1),.105,'#dce6e7',colliders);
 for(let j=1;j<bands;j+=2)bridgeBeam(cellOf,roof(s0,j),roof(s1,j),.075,'#dce6e7',colliders);
 // The canopy hung in the air: its hoops ended 3.8 m above the platforms with nothing below. An eaves beam now runs along
 // each side and a vertical post stands under every second hoop, footed on the platform inside its outer edge and meeting
 // the hoop above it (ESTIMATE of form, like the roof). The foot moves inward until it has deck under it and the post is
 // clear of every road and tram volume; a post that finds no such place is left out and listed.
 report.roofPosts=0;report.roofPostsOmitted=[];
 for(const j of[0,bands])bridgeBeam(cellOf,roof(s0,j),roof(s1,j),.14,'#dce6e7',colliders);
 for(let i=0;i<=ribs;i+=2)for(const side of[-1,1]){
  const s=s0+(s1-s0)*i/ribs;let placed=false,why='no-deck-under-foot';
  for(const inset of[.6,1,1.4,1.8]){
   const t=nc+side*(half-inset),foot=at(s,t,0),ground=supportAt?supportAt(foot[0],foot[2],deck):deck;if(ground===null||ground===undefined)continue;
   const top=at(s,t,deck+roofEaves+Math.sqrt(Math.max(0,1-((half-inset)/half)**2))*roofRise),base=[foot[0],ground,foot[2]],lift=[foot[0],ground+.35,foot[2]];
   if(!cableClearance(lift,top,roads,trams,.1).clear||(tramSweep&&cableInTramSweep(tramSweep,lift,top,.12))){why='road-or-tram-volume';continue;}
   bridgeBeam(cellOf,base,top,.16,'#dce6e7',colliders);report.roofPosts++;placed=true;break;
  }
  if(!placed)report.roofPostsOmitted.push({s,side,reason:why});
 }
 for(let i=0;i<ribs;i++)for(let j=0;j<bands;j++){const sa=s0+(s1-s0)*i/ribs,sb=s0+(s1-s0)*(i+1)/ribs,A=roof(sa,j),B=roof(sb,j),C=roof(sb,j+1),D=roof(sa,j+1);glass.face4(A,B,C,D,rgb('#aacbd8'),[n[0],1,n[1]]);colliders.push(roofPaneCollider(A,B,D));}
 if(group){const mesh=new THREE.Mesh(glass.build(),new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.2,roughness:.34,metalness:.08,depthWrite:false,side:THREE.DoubleSide}));mesh.name='Basarab mapped-platform station roof (estimated section)';mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}
 // Twin 80m legs with upper crossbeams and sixty fan stays. Their longitudinal
 // anchor is a MODEL30m southwest of the literal covered-platform endpoint.
 // The H-frame stands beside the central tracks, inside the flanking motor
 // carriageways. Its14m leg-centre spacing is an explicit photo-informed
 // estimate; using the wider station roof as its span put both legs in lanes.
 const towerS=s0-30,legOffset=7;
 // Night lighting, from photographs of the bridge after dark (the owner's reference, 2026-11-11): the white pylon and its
 // stays are floodlit warm white and a blue light band runs along the deck edge. The floodlit members are repeated in one
 // mesh, a few centimetres proud of the day geometry and the same colour by day; its material glows at night
 // (userData.nightEmissive, the renderer's night-material contract). ESTIMATE of colour and strength.
 const lit=new MeshBuilder(),litCell=()=>({solid:lit}),litCol='#d8d8d0';
 report.pylonLegCentreSpacingM=legOffset*2;
 // The completed main span crosses the railway southwest of the pylon. The
 // station/northeast arm is the shorter backspan.132m is inferred from the
 // analysis source's302m overall structural length minus the170m main span;
 // builder340m refers to a different overall scope. End setback is estimated.
 const mainSpanSW=170,backspanNE=132,anchorEndSetback=6,anchorStations=new Map();
 report.cableSpanBasis={mainSpanSWM:mainSpanSW,backspanNEM:backspanNE,anchorEndSetbackM:anchorEndSetback,backspanEstimated:true,maxAnchorAdjustmentSWM:9,maxAnchorAdjustmentNEM:3,minAnchorSeparationM:3};
 // (integration) the deck stretches these stays carry: the bridge-bent planner places no pier inside them
 { const A=at(towerS-mainSpanSW,nc,0),B=at(towerS+backspanNE,nc,0); report.carriedSpans=[{kind:'cable-stayed',a:[A[0],A[2]],b:[B[0],B[2]],halfWidthM:34}]; }
 for(const sign of [-1,1]){
  const c=at(towerS,nc+sign*legOffset,.2);cellOf(c[0],c[2]).solid.box(c[0],.2,c[2],3,79.8,3,Math.atan2(u[0],u[1]),rgb('#d8d8d0'));
  lit.box(c[0],12.5,c[2],3.06,67.6,3.06,Math.atan2(u[0],u[1]),rgb(litCol)); // (from the deck up)
  const poly=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([v,w])=>[c[0]+u[0]*v*1.5+n[0]*w*1.5,c[2]+u[1]*v*1.5+n[1]*w*1.5]);
  colliders.push({x:c[0],z:c[2],r:Math.SQRT2*1.5,poly,holes:[],h:80,y0:.2,y1:80,prop:true,kind:'basarab-pylon',estimated:true});
  for(const dir of [-1,1])for(let i=0;i<15;i++){
   const fraction=(i+1)/15,span=dir>0?backspanNE:mainSpanSW,plannedS=towerS+dir*(18+fraction*(span-18-anchorEndSetback)),tower=at(towerS,nc+sign*legOffset,42+fraction*35);let chosen=null,lastFailure='native-road/tram-catalogue-missing';
   // Anchor stations are estimates. The native source fork interrupts the
   // median, so a bounded9m search can use its supported outer band instead.
   // Keep anchors separate and ordered; never change a carriageway or track.
   const shifts=[0];for(let d=.5;d<=(dir<0?9:3);d+=.5)shifts.push(-d,d);
   if(roads.length&&tramHalfWidth>0&&supportAt)for(const shift of shifts){
    const anchorS=plannedS+shift,previous=anchorStations.get(sign+','+dir);
    if(previous!==undefined&&(anchorS-previous)*dir<3)continue;
    const raw=at(anchorS,nc,0),centre=[raw[0],raw[2]],base=deck,normal=n,localCentre=deckSectionCentre(centre,normal,base,roads),desired=localCentre+sign*legOffset,free=anchorFreeIntervals(centre,normal,base,roads,trams).filter(r=>sign>0?r.hi>localCentre+.3:r.lo<localCentre-.3),distance=r=>Math.max(r.lo-desired,0,desired-r.hi);free.sort((a,b)=>distance(a)-distance(b));
    if(!free.length){lastFailure={kind:'no-source-clear-deck-band',centre,base};continue;}
    for(const range of free){const offsets=[Math.max(range.lo+.15,Math.min(range.hi-.15,desired)),(range.lo+range.hi)/2,range.lo+.2,range.hi-.2];for(let v=range.lo+.15;v<range.hi-.15;v+=.25)offsets.push(v);offsets.sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));for(const offset of offsets){
     if((offset-localCentre)*sign<.15)continue;
     const x=centre[0]+normal[0]*offset,z=centre[1]+normal[1]*offset,ground=supportAt(x,z,base);
     if(ground===null){lastFailure={kind:'native-deck-support-missing',x,z,base,offset};continue;}
     const anchor=[x,ground+.4,z],clearance=cableClearance(tower,anchor,roads,trams);
     if(!clearance.clear){lastFailure=clearance;continue;}
     // The straight corridor test above uses the literal body width; the rail guard covers a rigid body (tram-sweep.js).
     if(tramSweep&&cableInTramSweep(tramSweep,tower,anchor)){lastFailure={clear:false,kind:'tram-sweep'};continue;}chosen={anchor,anchorS,plannedS,offset,range};break;
    }if(chosen)break;}
    if(chosen)break;
   }
   if(!chosen){report.anchorUnresolved.push({sign,direction:dir,index:i,plannedS,reason:lastFailure});continue;}
   anchorStations.set(sign+','+dir,chosen.anchorS);
   bridgeBeam(cellOf,tower,chosen.anchor,.11,'#b4c3c9',colliders,'basarab-stay');bridgeBeam(litCell,tower,chosen.anchor,.14,'#b4c3c9');report.emittedStays++;report.anchors.push({sign,direction:dir,index:i,...chosen});
  }
 }
 for(const y of [58,67,76])bridgeBeam(cellOf,at(towerS,nc-legOffset,y),at(towerS,nc+legOffset,y),1,'#d7d9d3',colliders);
 for(const y of [58,67,76])bridgeBeam(litCell,at(towerS,nc-legOffset,y),at(towerS,nc+legOffset,y),1.05,'#d7d9d3');
 if(group&&lit.ic>0){const mesh=new THREE.Mesh(lit.build(),new THREE.MeshStandardMaterial({vertexColors:true,emissive:'#ffdcae',emissiveIntensity:0,roughness:.7}));mesh.material.userData.nightEmissive=.8;mesh.name='Basarab night floodlighting: pylon and stays (estimate)';mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);report.nightLitMembers=lit.ic/3;}
 // River crossing: the mapped lower Grozavesti bridge constrains its position;
 // the upper main rail pair supplies the local Basarab direction and level.
 const river=riverLine&&riverPair?nearest(riverLine,[115,-222]):null;
 if(river?.grade?.known){
  report.riverSourceIds=[riverLine.id,riverPair.id];report.riverSourceAnchor=river.p;
  const span=120,section=t=>{
   const q=alongRoad(riverLine,river,(t-.5)*span);if(!q)return null;
   const mate=nearest(riverPair,q.p),center=mix(q.p,mate.p,.5),halfWidth=distance(q.p,mate.p)/2+Math.max(q.edge.wR,q.edge.wL,mate.edge.wR,mate.edge.wL)+.8;
   return {center,nx:-q.dz,nz:q.dx,base:(height(q)+height(mate))/2,halfWidth};
  },arch=(t,sign)=>{const s=section(t);return s&&[s.center[0]+s.nx*sign*s.halfWidth,s.base+Math.sin(Math.PI*t)*26,s.center[1]+s.nz*sign*s.halfWidth];};
  if(!section(0)||!section(1)){report.unresolved='river-span-exceeds-source-road';return{colliders,report};}
  (report.carriedSpans||(report.carriedSpans=[])).push({kind:'river-arch',a:section(0).center,b:section(1).center,halfWidthM:Math.max(section(0).halfWidth,section(.5).halfWidth,section(1).halfWidth)+6});
  for(const sign of [-1,1]){for(let i=0;i<32;i++)bridgeBeam(cellOf,arch(i/32,sign),arch((i+1)/32,sign),1.15,'#e1e5e4',colliders,'basarab-river-arch');for(let i=1;i<16;i++){const t=i/16,q=arch(t,sign);bridgeBeam(cellOf,q,[q[0],section(t).base+.15,q[2]],.115,'#b6c4c8',colliders,'basarab-hanger');}}
  for(const t of [.25,.5,.75])bridgeBeam(cellOf,arch(t,-1),arch(t,1),.65,'#d8e0e1',colliders);
  // (backlog: west deck over the Dambovita; Street View from Pod Grozavesti, 2026-11-11) the arch carries a deep steel-blue
  // box girder: its underside passes about two storeys over the lower bridge, where the thin slab left 9.9 m of air. Edge
  // girders about 2.5 m deep along both sides and cross girders under the deck (depth and colour estimated from the panorama).
  const BLUE='#2d5d8c',edge=(t,sign,dy)=>{const s=section(t);return s&&[s.center[0]+s.nx*sign*(s.halfWidth-.7),s.base+dy,s.center[1]+s.nz*sign*(s.halfWidth-.7)];};
  for(const sign of [-1,1])for(let i=0;i<32;i++)bridgeBeam(cellOf,edge(i/32,sign,-1.35),edge((i+1)/32,sign,-1.35),2.2,BLUE,colliders,'basarab-river-girder');
  for(let i=0;i<=16;i++)bridgeBeam(cellOf,edge(i/16,-1,-1.1),edge(i/16,1,-1.1),.8,BLUE,colliders,'basarab-river-cross-girder');
  report.riverGirder={estimated:true,depthM:2.45,colour:BLUE};
 }
 report.physicalMembers=colliders.length;
 return {colliders,report};
}
