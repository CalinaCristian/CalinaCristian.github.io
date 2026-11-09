// Read-only native static/body station scan. No actor pose, RNG, admission or route mutation.
module.exports=async function scanMainBridge(g,{sourceCommit}){
 const {collideBuildings}=await import('/game/src/world.js'),{lanesDir,canTravel}=await import('/game/src/nav.js'),W=g.world,P=g.player,allowed=['w458458361','w1535667121','w1535667122','w668700432','w668700431','w668700428','w668700430','w668700429','w668700433'];
 const before=JSON.stringify({x:P.x,y:P.y,z:P.z,heading:P.heading,surfY:P.surfY,speed:P.speed}),edges=W.allEdges.filter(e=>allowed.includes(e.access?.sourceId)),used=new Set(),chain=[];let node=edges.flatMap(e=>[e.a,e.b]).find(n=>n.sourceId===4544537057)?.id;if(node==null)throw Error('Missing literal start source node4544537057');
 for(let i=0;i<1000;i++){const opts=edges.filter(e=>!used.has(e.id)&&(e.a.id===node||e.b.id===node));if(!opts.length)break;if(opts.length!==1)throw Error('Ambiguous literal source join at '+node);const e=opts[0],dir=e.a.id===node?1:-1;if(!canTravel(e,dir))throw Error('Illegal literal source direction on '+e.access?.sourceId);used.add(e.id);chain.push({e,dir});node=dir===1?e.b.id:e.a.id;}
 if(!chain.length)throw Error('Missing literal source main bridge');
 const originalCache=P._colS;let bodyCache=P._colS,cacheBasis='actual-live-native-cache';
 if(!bodyCache?.length){
  // Native lazy body initializer, isolated from all live collision/motion state.
  const isolated=Object.create(P);Object.assign(isolated,{x:P.x,z:P.z,heading:P.heading,world:{buildings:[]},traffic:null,deckContact:false,_colS:null,_one:null,contactAge:0});
  P.collide.call(isolated,0);bodyCache=isolated._colS;cacheBasis='unchanged-native-collide-on-isolated-empty-query-receiver';
 }
 const samples=(bodyCache||[]).map(s=>s.slice());if(!samples.length)throw Error('Actual current player collision samples unavailable');
 const rows=[],colliders=[],ids=new WeakMap();let station=0;
 const collider=b=>{if(ids.has(b))return ids.get(b);const i=colliders.length;ids.set(b,i);colliders.push({index:W.buildings.indexOf(b),kind:b.kind,syntheticMaskBoundary:b.wall&&b.kind==='boundary'&&b.y0a===-40&&b.y1a===80,actual:Object.fromEntries(['wall','ax','az','bx','bz','y0a','y1a','y0b','y1b','nx','nz','x','z','r','hw','hd','angle','poly','holes','y','h','top','kind'].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]))});return i;};
 const candidate=Object.create(P);Object.assign(candidate,{_surf:null,_own:null,_rhWorld:null,_rhMode:null,_wallSrc:null,_wallLen:0,_walls:null});
 const previous=new Map();
 for(const {e,dir}of chain){const steps=Math.max(1,Math.ceil(e.len/2));for(let k=0;k<steps;k++){
  const s=e.len*k/steps,t=dir===1?s/e.len:1-s/e.len,fx=e.dirx*dir,fz=e.dirz*dir,heading=Math.atan2(-fx,-fz),n=lanesDir(e,dir);
  for(let lane=0;lane<n;lane++){const offset=g.traffic.laneOffset(e,lane,dir),x=e.a.x+e.dirx*(t*e.len)+e.nx*dir*offset,z=e.a.z+e.dirz*(t*e.len)+e.nz*dir*offset,surf=.24+e.ya+(e.yb-e.ya)*t;
   Object.assign(candidate,{x,z,y:surf,surfY:surf,heading,supportEdge:e});let actualSurface=null,surfaceError=null;try{const q=candidate.surfaceAt(x,z,surf);actualSurface={h:q.h,edgeId:q.edge?.id};}catch(error){surfaceError=String(error);}
   const hits=[];for(const[o,l,rad]of samples){const px=x+fx*o-fz*l,pz=z+fz*o+fx*l,test=b=>{if(!candidate.atLevel(b))return;const r=collideBuildings([b],px,pz,rad,surf);if(r&&Math.hypot(r.px,r.pz)>1e-5)hits.push({collider:collider(b),o,l,rad,x:px,z:pz,push:[r.px,r.pz]});};if(P.world.buildings.query)P.world.buildings.query(px,pz,3,test);else P.world.buildings.forEach(test);}
   const prev=previous.get(lane),gradeBump=prev&&actualSurface?Math.abs(actualSurface.h-prev.h):null;let nativeRoadHeight=null;try{nativeRoadHeight=P.world.roadHeight(x,z,{y:surf,edge:e});}catch(error){surfaceError||=String(error);}
   rows.push({station:station+s,edgeId:e.id,sourceId:e.access?.sourceId,dir,lane,x,z,heading,sourceProfileSurface:surf,actualPlayerSurface:actualSurface,nativeRoadHeight,gradeBumpM:gradeBump,expectedDeltaM:actualSurface?actualSurface.h-surf:null,inside:W.district.inside(x,z),surfaceError,hits});if(actualSurface)previous.set(lane,{h:actualSurface.h});
  }
 }station+=e.len;}
 const after=JSON.stringify({x:P.x,y:P.y,z:P.z,heading:P.heading,surfY:P.surfY,speed:P.speed});if(before!==after||P._colS!==originalCache)throw Error('Read-only scan changed actual player pose/cache');
 return{captureKind:'source-domain-native-main-bridge',source:sourceCommit,scope:'Read-only2m station scan on literal northbound Basarab main source chain, every legal lane, actual current asymmetric native collision discs and native static collider/atLevel queries. No simulated trip/actor pose writes. Raw positives retained; synthetic mask walls separate.',stepMaxM:2,body:{front:P.front,rear:P.rear,width:P.width,samples,cacheBasis},actualPlayerUnchanged:true,actualCacheUnchanged:true,playerWorldEqualsGame:P.world===W,wallsInBuildings:P.wallsInBuildings(),lengthM:station,chain:chain.map(({e,dir})=>({id:e.id,sourceId:e.access?.sourceId,dir,from:dir===1?e.a.id:e.b.id,to:dir===1?e.b.id:e.a.id})),rows,colliders};
};
