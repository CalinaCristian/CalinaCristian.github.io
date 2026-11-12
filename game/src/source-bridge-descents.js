import { SOURCE_BRIDGE_DESCENTS } from './source-bridge-descent-models.js';
import { sourcePath, sourceFrames, pathStation, clipConvex, clipAffine, polygonArea } from './bridge-profile-geometry.js';
import { smoothTramRamp } from './tram-grade.js';
const sort=v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):Array.isArray(v)?v.map(sort):v;
const equal=(a,b)=>JSON.stringify(sort(a))===JSON.stringify(sort(b));
const point=n=>[n.x,n.z];
/** Pure reviewed associations. Original data, nodes and legacy profiles are inputs,
 * never modified here. Application and native physical acceptance remain separate. */
export function compileSourceBridgeDescents(data,{coreEdges=[],lanePolygon,padLanePolygon,structuralPolygon=lanePolygon,models=SOURCE_BRIDGE_DESCENTS}={}){
 const lookup=new Map(),roadGrades=new Map(),padFields=new Map(),reports=[];
 for(const field of ['roadSourceGeometry','scenerySourceGeometry'])for(const w of Object.values(data[field]||{}))if(w?.sourceId){const old=lookup.get(w.sourceId);if(old&&!['nodeIds','projected','tags'].every(k=>equal(old[k],w[k])))return{known:false,roadGrades,report:{known:false,unresolved:[{reason:'duplicate-original-source-context-disagrees',sourceId:w.sourceId}]}};lookup.set(w.sourceId,w);}
 for(const model of models){
  const report={modelId:model.id,estimated:true,basis:model.basis,active:model.ways.some(([id])=>lookup.has(id)),known:false,unresolved:[],oldProfiles:[]};reports.push(report);if(!report.active)continue;
  const fail=(reason,extra={})=>{report.unresolved.push({reason,...extra});return false;};
  const run=()=>{
   if(typeof lanePolygon!=='function'||typeof padLanePolygon!=='function')return fail('actual-protected-lane-geometry-missing');
   const coverage=data.roadSourceNodeTagCoverage;
   if(!coverage||coverage.missingSourceNodes?.length||!['ele','incline','level'].every(k=>coverage.keys?.includes(k))||!data.roadSourceNodeTags)return fail('original-road-node-metric-coverage-unknown');
   for(const[id,expected]of Object.entries(model.snapshots)){
    const w=lookup.get(id);if(!w||!['nodeIds','projected','tags'].every(k=>equal(w[k],expected[k])))return fail('reviewed-original-source-context-changed',{sourceId:id});
    if(w.tags.ele!=null||w.tags.incline!=null)return fail('authoritative-source-way-metric-requires-review',{sourceId:id});
    for(const sourceNodeId of w.nodeIds){const tags=data.roadSourceNodeTags[sourceNodeId];if(tags&&Object.keys(tags).length)return fail('source-node-metric-or-level-requires-review',{sourceId:id,sourceNodeId,tags});}
   }
   const path=sourcePath(lookup,{ways:model.ways}),frames=path&&sourceFrames(path.points,model.associationHalfWidthM);
   if(!path||!frames||path.nodeIds[0]!==model.crownNode||path.nodeIds.at(-1)!==model.groundNode)return fail('literal-source-chain-or-named-anchor-changed');
   const ids=new Set(model.ways.map(([id])=>id)),edges=coreEdges.filter(e=>!e.virtual).map(e=>({...e,nativeEdge:e,sourceId:e.sourceId||e.access?.sourceId||data.roadSourceGeometry?.[e.road]?.sourceId})),affected=edges.filter(e=>ids.has(e.sourceId));
   if(model.ways.some(([id])=>!affected.some(e=>e.sourceId===id)))return fail('actual-native-descent-source-coverage-missing');
   const crown=affected.flatMap(e=>[e.a,e.b]).find(n=>n.sourceId===model.crownNode),ground=affected.flatMap(e=>[e.a,e.b]).find(n=>n.sourceId===model.groundNode);
   if(!crown||!ground||Math.abs(crown.y-model.crownHeightM)>1e-7)return fail('named-existing-crown-anchor-changed',{sourceNodeId:model.crownNode,oldY:crown?.y});
   const groundEdges=edges.filter(e=>model.groundJoinSources.includes(e.sourceId)),join=groundEdges.filter(e=>e.a===ground||e.b===ground);
   if(model.groundJoinSources.some(id=>!join.some(e=>e.sourceId===id)))return fail('actual-native-at-grade-incoming-outgoing-joins-missing',{sourceNodeId:model.groundNode});
   if(join.some(e=>e.bridge||e.tunnel||e.layer||e.publicDrive===false))return fail('reviewed-at-grade-source-join-context-conflicts');
   for(const e of join){const other=e.a===ground?e.b:e.a;if(Math.abs(other.y-model.groundHeightM)>1e-7)return fail('at-grade-joining-legacy-profile-requires-review',{sourceId:e.sourceId,sourceNodeId:other.sourceId,oldY:other.y});}
   const incident=edges.filter(e=>e.a===ground||e.b===ground);
   if(incident.some(e=>!ids.has(e.sourceId)&&!model.groundJoinSources.includes(e.sourceId)))return fail('unreviewed-source-incident-at-ground-junction');
   const pad=padLanePolygon(ground,incident.map(e=>e.nativeEdge)),reservePoints=pad.slice(),overlaps=[],earlierCrossings=[];
   for(const e of affected)for(const f of groundEdges){const poly=clipConvex(structuralPolygon(e.nativeEdge),lanePolygon(f.nativeEdge));if(polygonArea(poly)>1e-9){const row={descentEdgeId:e.id,groundEdgeId:f.id,poly};if(join.includes(f)){overlaps.push(row);reservePoints.push(...poly);}else earlierCrossings.push(row);}}
   // Flat ground owns its complete actual shared lane/pad footprint, not an
   // arbitrary distance from a nearest road. All points use one source frame.
   let flatReserveM=0;
   for(const p of reservePoints){const q=frames.locate(p);if(q)flatReserveM=Math.max(flatReserveM,path.length-q.s);else{const a=path.points.at(-1),b=path.points.at(-2),dx=a[0]-b[0],dz=a[1]-b[1];if((p[0]-a[0])*dx+(p[1]-a[1])*dz< -1e-7)return fail('actual-ground-overlap-outside-bounded-source-field',{point:p});}}
   const incidentGroundReserveM=flatReserveM;
   if(model.modelRampFinishSourceNode!=null){const end=path.stations.get(model.modelRampFinishSourceNode);if(!Number.isFinite(end))return fail('reviewed-model-ramp-finish-vertex-absent');flatReserveM=Math.max(flatReserveM,path.length-end);}
   // (2026-11-11) a crown hold keeps the crown height up to a named vertex (a station platform on the deck), the ramp starts there
   // (2026-11-12) crownHoldExtraM: further metres of hold beyond that vertex, where the carriageway beside it starts its own descent between two source vertices
   const holdNodeM=model.crownHoldSourceNode!=null?path.stations.get(model.crownHoldSourceNode):0;if(!Number.isFinite(holdNodeM))return fail('reviewed-crown-hold-vertex-absent');
   const holdM=holdNodeM+(model.crownHoldExtraM||0);
   const length=path.length-flatReserveM-holdM,rise=model.crownHeightM-model.groundHeightM,ramp=smoothTramRamp(length,rise,{maxGrade:model.maxGrade,easeM:model.preferredEaseM});
   if(!ramp)return fail('finite-source-descent-c1-grade-infeasible',{pathLengthM:path.length,flatReserveM,length,rise});
   const atStation=s=>model.crownHeightM-ramp.at(s-holdM);
   const station=p=>{const q=frames.locate(p);if(q)return q.s;for(const[start,at]of [[true,0],[false,path.length]]){const i=start?0:path.points.length-1,a=path.points[i],b=path.points[start?1:i-1],dx=a[0]-b[0],dz=a[1]-b[1];if((p[0]-a[0])*dx+(p[1]-a[1])*dz>=0)return at;}throw Error('Source descent height query outside certified source-section bounds: '+model.id);};
   const atWorld=(x,z)=>atStation(station([x,z]));
   const profileBreaks=[...ramp.breaks.map(b=>b+holdM),holdM,path.length].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
   const surfaceRegions=poly=>{
    const result=[];
    for(const cell of frames.cells){const P=clipConvex(poly,cell.poly);if(polygonArea(P)<1e-10)continue;const C=cell.stationCoefficients,at=p=>C[0]*p[0]+C[1]*p[1]+C[2],lo=Math.min(...P.map(at)),hi=Math.max(...P.map(at)),bounds=[lo,...profileBreaks.filter(s=>s>lo+1e-8&&s<hi-1e-8),hi];
     for(let i=1;i<bounds.length;i++){const a=bounds[i-1],b=bounds[i],d=b-a;if(d<1e-9)continue;const Q=clipAffine(clipAffine(P,C,a),C.map(v=>-v),-b);if(polygonArea(Q)<1e-10)continue;const y0=atStation(a),ym=atStation((a+b)/2),y1=atStation(b),A=2*(y0+y1-2*ym)/(d*d),B=(y1-y0)/d-A*d,values=[y0,y1];if(A){const u=-B/(2*A);if(u>0&&u<d)values.push((A*u+B)*u+y0);}result.push({poly:Q,stationCoefficients:C,stationIntervalM:[a,b],heightCoefficients:[A,B,y0],heightAtWorld:(x,z)=>{const u=C[0]*x+C[1]*z+C[2]-a;return(A*u+B)*u+y0;},minHeightM:Math.min(...values),maxHeightM:Math.max(...values)});}
    }return result;
   };
   const pending=[];
   for(const e of affected){const s0=pathStation(path,lookup,e,point(e.a)),s1=pathStation(path,lookup,e,point(e.b));if(![s0,s1].every(Number.isFinite))return fail('native-edge-not-on-literal-source-chain',{edgeId:e.id,sourceId:e.sourceId});for(const p of lanePolygon(e.nativeEdge))try{station(p);}catch{return fail('native-lane-outside-bounded-source-field',{edgeId:e.id,point:p});}
    const grade={known:true,modelId:model.id,estimated:true,basis:model.basis,sourceId:e.sourceId,role:'source-descent',ya:atStation(s0),yb:atStation(s1),heightAt:t=>atStation(s0+(s1-s0)*Math.max(0,Math.min(1,t))),heightAtWorld:atWorld,surfaceRegions,oldYa:e.ya,oldYb:e.yb};pending.push([e.id,grade]);report.oldProfiles.push({edgeId:e.id,sourceId:e.sourceId,ya:e.ya,yb:e.yb,newYa:grade.ya,newYb:grade.yb});
   }
   for(const[edgeId]of pending)if(roadGrades.has(edgeId))return fail('source-descent-model-ownership-overlap',{edgeId});for(const[edgeId,grade]of pending)roadGrades.set(edgeId,grade);
   report.known=true;report.crown={sourceNodeId:model.crownNode,heightM:model.crownHeightM};report.ground={sourceNodeId:model.groundNode,heightM:model.groundHeightM,oldHeightM:ground.y,sourceJoins:model.groundJoinSources};report.groundJoinProfiles=join.map(e=>({edgeId:e.id,sourceId:e.sourceId,oldYa:e.ya,oldYb:e.yb,newYa:e.a===ground?model.groundHeightM:e.a.y,newYb:e.b===ground?model.groundHeightM:e.b.y}));report.pathLengthM=path.length;report.incidentGroundReserveM=incidentGroundReserveM;report.flatGroundReserveM=flatReserveM;report.rampLengthM=length;report.modelRampFinishSourceNode=model.modelRampFinishSourceNode;report.rampFinishBasis=model.rampFinishBasis;report.peakGrade=ramp.peakGrade;report.easeM=ramp.easeM;report.groundLaneOverlaps=overlaps;report.earlierGradeSeparatedFootprints=earlierCrossings;report.nativePhysicalGatePending=true;return true;
  };run();
 }
 return{known:reports.some(r=>r.known),roadGrades,report:{known:reports.some(r=>r.known),models:reports},bindPadSurface:(n,p)=>padFields.set(n.id,p),padHeightAt:(n,x,z)=>padFields.get(n.id)?.heightAtWorld(x,z)??null};
}
