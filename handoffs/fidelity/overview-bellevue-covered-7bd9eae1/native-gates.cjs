// Read-only observers and native controls; no runtime/source/geometry changes.
async function nativeGates({oldProfiles,views,sourceCommit}) {
 const g=window.game,W=g.world,P=g.player;
 const {collideBuildings}=await import('/game/src/world.js');
 const {Harness}=await import('/game/dev/harness/page/core.js');
 const sourceId=e=>W.data.roadSourceGeometry?.[e.road]?.sourceId||e.access?.sourceId;
 const node=n=>({id:n.id,sourceId:n.sourceId,x:n.x,z:n.z,y:n.y});
 const profiles=W.allEdges.filter(e=>!e.virtual).map(e=>({id:e.id,sourceId:sourceId(e),road:e.road,name:e.name,bridge:e.bridge,tunnel:e.tunnel,layer:e.layer,modelLayer:e.modelLayer??null,coveredRoadModel:e.coveredRoadModel??null,publicDrive:e.publicDrive,drivable:e.drivable,a:node(e.a),b:node(e.b),ya:e.ya,yb:e.yb,wR:e.wR,wL:e.wL,sidewalk:e.sidewalk,shoulder:e.shoulder}));
 const key=e=>[e.sourceId,e.a.sourceId,e.b.sourceId,...[e.a,e.b].flatMap(n=>[n.x.toFixed(6),n.z.toFixed(6)])].join('|'),old=new Map(oldProfiles.map(e=>[key(e),e]));
 const deltas=profiles.flatMap(e=>{const o=old.get(key(e));return o&&(Math.abs(e.ya-o.ya)>1e-7||Math.abs(e.yb-o.yb)>1e-7)?[{...e,before:{sourceCommit:'2b2b970836c58516fb11b6bd98ec18b936b33f65',ya:o.ya,yb:o.yb},deltaYa:e.ya-o.ya,deltaYb:e.yb-o.yb}]:[];});
 const report=W.stats.coveredRoadModels,record=W.data.reviewedCoveredRoads[0],m=report.models.find(m=>m.id===record.id),covered=W.allEdges.filter(e=>!e.virtual&&sourceId(e)===record.sourceRoadId),bodies=W.buildings.filter(b=>m.sourceBuildingIds.includes(b.sourceId));
 const compact=b=>({sourceId:b.sourceId,kind:b.kind,wall:!!b.wall,minH:b.minH,h:b.h,passageSolids:b.passageSolids?.map(s=>({y0:s.y0,y1:s.y1,polys:s.polys}))});
 const tests=[],outsideControls=[];
 for(const e of covered) for(const t of [.15,.5,.85]) for(const lateral of [-1.5,1.5]) {
  const x=e.a.x+(e.b.x-e.a.x)*t+e.nx*lateral,z=e.a.z+(e.b.z-e.a.z)*t+e.nz*lateral,fx=e.dirx,fz=e.dirz,R=P.width/2,F=P.front,B=P.rear,n=Math.max(3,Math.ceil((F+B-2*R)/(R*1.4))+1),samples=[];
  for(let k=0;k<n;k++)samples.push([F-R-(F+B-2*R)*k/(n-1),0,R]);
  samples.push([F-.35,R*.85-.35,.35],[F-.35,-(R*.85-.35),.35],[-B+.35,R-.35,.35],[-B+.35,-(R-.35),.35]);
  const hits=[],circles=[];for(const [o,l,r]of samples){const px=x+fx*o-fz*l,pz=z+fz*o+fx*l,hit=collideBuildings(bodies,px,pz,r,.24);circles.push({x:px,z:pz,r});if(hit)hits.push({x:px,z:pz,r,hit:compact(hit.hit),push:[hit.px,hit.pz]});}
  tests.push({edge:e.id,t,lateral,x,z,roadY:W.roadHeight(x,z,e),hits,circles});
 }
 const ce=covered[Math.floor(covered.length/2)],cx=(ce.a.x+ce.b.x)/2,cz=(ce.a.z+ce.b.z)/2;
 for(const b of bodies){const roof=collideBuildings([b],cx,cz,.2,3.5,.5);outsideControls.push({sourceId:b.sourceId,test:'ceiling/upper-body',blocked:!!roof,y:3.5});let hit=null;for(const lat of [-4,4,-5,5]){const x=cx+ce.nx*lat,z=cz+ce.nz*lat,r=collideBuildings([b],x,z,.15,3.5,1);if(r){hit={x,z,lateral:lat};break;}}outsideControls.push({sourceId:b.sourceId,test:'solid-outside-passage',blocked:!!hit,pose:hit,y:3.5});}
 const requested=views.map(v=>{const p=g.city.proj(v.lat,v.lon),s=g.city.proj(v.clat,v.clon),ne=W.nearestEdge(s.x,s.z,e=>!e.virtual&&sourceId(e)===v.sourceRoadId&&(e.layer??0)===(v.sourceLayer??0),1);if(!ne)throw Error('Unresolved original source pose '+v.id);const y=W.roadHeight(p.x,p.z,ne.edge);return{id:v.id,sourceRoadId:v.sourceRoadId,edge:ne.edge.id,before:v.cameraBaseY,after:y,delta:y-v.cameraBaseY};});
 const profilePassed=!!m?.floorModelVerified&&m.nativePassage?.accepted===true&&!report.unresolved.length&&covered.length>0&&covered.every(e=>e.tunnel&&e.modelLayer===0&&e.ya===0&&e.yb===0)&&requested.filter(v=>v.sourceRoadId==='w6422057').every(v=>Math.abs(v.after-.24)<1e-7);
 const pip=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
 const ribbons=W.ribbons.filter(r=>Math.abs(r.y)<1e-6).map(r=>({edge:r.e?.id??null,node:r.node?.id??null,sourceId:r.e?sourceId(r.e):null,sourceNodeId:r.node?.sourceId??null,poly:r.poly,y:r.y}));
 function outsideCircle({x,z,r}){const polys=ribbons.filter(q=>{const xs=q.poly.map(p=>p[0]),zs=q.poly.map(p=>p[1]);return Math.min(...xs)<=x+r&&Math.max(...xs)>=x-r&&Math.min(...zs)<=z+r&&Math.max(...zs)>=z-r;}).map(q=>q.poly),angles=[0,2*Math.PI];if(!polys.some(p=>pip([x,z],p)))return[x,z];for(const poly of polys)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],ax=a[0]-x,az=a[1]-z,A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-r*r,D=B*B-4*A*C;if(A&&D>=0)for(const t of[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(t>=0&&t<=1)angles.push((Math.atan2(az+dz*t,ax+dx*t)+2*Math.PI)%(2*Math.PI));}angles.sort((a,b)=>a-b);for(let i=1;i<angles.length;i++){const a=(angles[i]+angles[i-1])/2,p=[x+r*Math.cos(a),z+r*Math.sin(a)];if(!polys.some(poly=>pip(p,poly)))return p;}return null;}
 for(const test of tests){const outside=test.circles.flatMap(circle=>{const witness=outsideCircle(circle);return witness?[{circle,outsideNativeAsphaltPoint:witness}]:[];});test.domain={scope:'Every native body-circle centre and circular boundary interval against actual complete ground-asphalt ribbon/pad union; no onRibbon fallback tolerance.',nativeAsphaltBoundaryContained:outside.length===0,outsideAsphalt:outside.length>0,witnesses:outside};}

 const physicalPassed=bodies.length===2&&bodies.every(b=>b.passageSolids?.length)&&tests.every(t=>Math.abs(t.roadY-.24)<1e-7&&(!t.hits.length||t.domain?.outsideAsphalt))&&outsideControls.every(c=>c.blocked);
 await window.writeNativeEarly?.({profilePassed,physicalPassed,report,profiles,deltas,requested,ribbons,legalAsphaltBodyFixtureCount:tests.filter(t=>t.domain.nativeAsphaltBoundaryContained).length,bodies:bodies.map(compact),tests,outsideControls,ribbons});
 const H=new Harness(g);H.install();H.noShots=true;H.begin('covered-road-native-drive');H.refuelInstant();window.coveredHarness=H;
 const src=W.data.roadSourceGeometry[covered[0].road],first=src.projected[0],last=src.projected.at(-1),near=(p,arr)=>arr.reduce((a,e)=>Math.hypot(e.a.x-p[0],e.a.z-p[1],e.b.x-p[0],e.b.z-p[1])<Math.hypot(a.a.x-p[0],a.a.z-p[1],a.b.x-p[0],a.b.z-p[1])?e:a);
 const start=W.allEdges.find(e=>!e.virtual&&sourceId(e)==='w1285047732'),end=W.allEdges.find(e=>!e.virtual&&sourceId(e)==='w1225324171'&&[e.a.sourceId,e.b.sourceId].includes(4270714562)),dir=start.a.sourceId===3514287876?1:-1;
 const pose=H.placeOnRoad(0,0,null,{edge:start,dir,s:Math.min(1,start.len/2),lane:0});
 const samples=[],step=H.stepOnce.bind(H);H.stepOnce=function(dt){const before={x:P.x,z:P.z,y:P.surfY,speed:P.speed,contactAge:P.contactAge};step(dt);if(H.mon.steps%3===0||P.touching)samples.push({t:H.scT,before,after:{x:P.x,z:P.z,y:P.surfY,speed:P.speed,heading:P.heading,contactAge:P.contactAge,touching:P.touching},edge:g.prevEdgeInfo?.edge?.id??null,layer:g.prevEdgeInfo?.edge?.modelLayer??g.prevEdgeInfo?.edge?.layer??null});};
 const endDir=end.b.sourceId===4270714562?1:-1,exit=endDir===1?end.b:end.a,tx=exit.x+end.nx*endDir*1.5,tz=exit.z+end.nz*endDir*1.5;
 const result=await H.driveTo(tx,tz,{arriveR:3,timeout:70,speedMul:.65,stop:true,label:'Avenue Square exact covered source passage including both reviewed ground mouths'});
 const route={fixtureStart:{x:pose.x,z:pose.z,heading:pose.heading,edge:start.id,dir},target:{x:tx,z:tz,edge:end.id},result,samples,issues:H.issues,log:H.log,controllerExercised:true,trafficRendered:false,scope:'Native fixed-step input/autopilot drive after one labelled starting placement; no position repair outside existing harness behavior, resets reported.'};
 const routePassed=result.ok&&result.resets===0&&!samples.some(s=>s.after.touching)&&!H.issues.some(i=>i.severity==='high'||i.severity==='medium');
 return {sourceCommit,report,profilePassed,physicalPassed,routePassed,passed:profilePassed&&physicalPassed&&routePassed,profiles,deltas,requested,ribbons,legalAsphaltBodyFixtureCount:tests.filter(t=>t.domain.nativeAsphaltBoundaryContained).length,bodies:bodies.map(compact),tests,outsideControls,route,stats:W.stats};
}
module.exports=nativeGates;
