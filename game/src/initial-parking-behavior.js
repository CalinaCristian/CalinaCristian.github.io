// A generated parked flag is a behavior choice, not mapped source identity.
// Evaluate it before publication, without changing the original actor or RNG.
import {canTravel,lanesDir,isMotorway} from './nav.js';
import {resolveRoadAccess} from './road-access.js';
import {sourceRoadClearance} from './source-road-clearance.js';
import {sourceVehicleDimensions} from './source-vehicle-dimensions.js';
import {initialVehicleConflict} from './initial-vehicle-admission.js';
import {initialTrafficStaticClearance} from './initial-traffic-admission.js';
import {parkingPolygonsOverlap} from './parking-layout.js';
import {parkingModel,parkingBodyPolygon,parkingSupportCatalog} from './initial-parking-support.js';

const finite=Number.isFinite;
const supportByTraffic=new WeakMap();
const sourceId=e=>e.access?.sourceId||e.sourceId;
const no=v=>/^(no|none|no_parking|no_stopping|prohibited)$/.test(String(v));
function sourceForward(source,e){
    const nodes=source.nodeIds||[],a=nodes.indexOf(e.a.sourceId),b=nodes.indexOf(e.b.sourceId);
    return a>=0&&b>=0&&Math.abs(a-b)===1?Math.sign(b-a):null;
}
function initialParkingSource(T,v){
    const e=v.edge,source=T.world?.data?.roadSourceGeometry?.[e.road],tags=source?.tags;
    if(!source||source.sourceId!==sourceId(e)||!tags)return{valid:false,reason:'missing-literal-parking-road-context'};
    const access=resolveRoadAccess(tags);
    if(!canTravel(e,v.dir)||!access.publicDrive||!access.throughAccess||e.publicDrive===false||e.throughAccess===false||e.virtual||e.rail||e.tram||e.tunnel||e.bridge||e.roundabout||isMotorway(e)||e.a.mapEnd||e.b.mapEnd)return{valid:false,reason:'parking-source-access-or-structure'};
    if(!finite(e.a.y)||!finite(e.b.y)||Math.abs(e.a.y-e.b.y)>1e-7||e.sourceBridgeGrade||tags.incline&&!/^(0|0%|no)$/.test(tags.incline))return{valid:false,reason:'parking-support-grade-unresolved'};
    const forward=sourceForward(source,e);if(forward==null)return{valid:false,reason:'parking-source-direction-unresolved'};
    const side=v.dir*forward>0?'right':'left';
    const keys=['parking:'+side,'parking:both','parking:lane:'+side,'parking:lane:both'],key=keys.find(k=>tags[k]!=null),location=key?String(tags[key]):null;
    const relevant=Object.entries(tags).filter(([k])=>k==='parking'||k.startsWith('parking:')&&(!/:(left|right)(:|$)/.test(k)||k.includes(':'+side)));
    if(relevant.some(([k,value])=>k.includes('conditional')||k.includes('restriction')||k.startsWith('parking:condition')||no(value)))return{valid:false,reason:'literal-parking-prohibition-or-unresolved-condition',sourceId:source.sourceId,side,sourceTags:Object.fromEntries(relevant)};
    if(!key)return{valid:false,reason:'parking-not-literally-designated',sourceId:source.sourceId,side};
    const orientation=tags['parking:'+side+':orientation']??tags['parking:both:orientation']??tags['parking:lane:'+side+':orientation']??tags['parking:lane:both:orientation'];
    if(orientation&&orientation!=='parallel')return{valid:false,reason:'parking-orientation-not-parallel',orientation};
    if(!['on_kerb','lane','street_side'].includes(location))return{valid:false,reason:'parking-location-support-unresolved',location};
    const clearance=sourceRoadClearance(T.world.data,e,v);
    if(clearance.eligible!==true||!clearance.known)return{valid:false,reason:'parking-literal-vehicle-dimensions',clearance};
    if(location!=='on_kerb'&&!tags.width)return{valid:false,reason:'parking-lane-physical-width-unresolved',location};
    const nativeSide=v.dir>0?e.sidewalkRightM:e.sidewalkLeftM;
    if(location==='on_kerb'&&(!finite(nativeSide)||nativeSide<=0))return{valid:false,reason:'parking-own-side-support-absent',location,sidewalkM:nativeSide};
    return{valid:true,sourceId:source.sourceId,side,edgeSide:v.dir,location,sourceTags:Object.fromEntries(relevant),sidewalkM:nativeSide};
}

function movingLaneContact(T,body){
    const poly=parkingBodyPolygon(body,.05);
    for(const e of T.world.graph?.edges||[]){
        if(Math.hypot((e.a.x+e.b.x)/2-body.x,(e.a.z+e.b.z)/2-body.z)>e.len/2+body.length+body.width+Math.max(e.wR||0,e.wL||0)+5)continue;
        for(const dir of [1,-1])for(let lane=0;canTravel(e,dir)&&lane<lanesDir(e,dir);lane++){
            const p={},q={};T.laneTarget({edge:e,dir,laneCur:lane,latExtraCur:0,s:0},p);T.laneTarget({edge:e,dir,laneCur:lane,latExtraCur:0,s:e.len},q);
            const w=(e.laneW??3.3)/2,rx=e.nx*dir,rz=e.nz*dir,strip=[[p.x-rx*w,p.z-rz*w],[q.x-rx*w,q.z-rz*w],[q.x+rx*w,q.z+rz*w],[p.x+rx*w,p.z+rz*w]];
            if(parkingPolygonsOverlap(poly,strip))return{valid:false,reason:'parking-body-in-legal-moving-lane',edgeId:e.id,dir,lane};
        }
    }
    for(const r of T.world.ribbons||[])if((r.node||r.e!==body.edge)&&parkingPolygonsOverlap(poly,r.poly))return{valid:false,reason:'parking-body-in-other-road-or-junction-pad',edgeId:r.e?.id,nodeId:r.node?.id};
    return{valid:true};
}
function peerBody(v){
    const d=sourceVehicleDimensions(v);if(!d.known)return null;
    const b=d.bounds,p=v.mesh.rotation.x,r=v.mesh.rotation.z,cx=Math.cos(p),sx=Math.sin(p),cz=Math.cos(r),sz=Math.sin(r);let lo=Infinity,hi=-Infinity;
    for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]]){const h=v.y+cx*sz*x+cx*cz*y-sx*z;lo=Math.min(lo,h);hi=Math.max(hi,h);}
    return{...v,length:2*Math.max(Math.abs(b[2]),Math.abs(b[5])),width:2*Math.max(Math.abs(b[0]),Math.abs(b[3])),verticalInterval:{min:lo,max:hi,source:'actual-complete-model-conservative-rotated-bounds'}};
}

/** Returns a candidate only. The caller commits a valid parked choice, or keeps
 * exactly the ordinary actor just created by spawn(). Up to three same-station
 * lateral proposals; no station/road reassignment, scene writes or random draws.
 */
export function evaluateInitialParking(T,v,{desiredOffset,walkOffset}={}){
    if((T.time||0)>0||(T._frame||0)>0||T.peds||v.parked)return{valid:false,reason:'initial-parking-after-admission-forbidden'};
    const source=initialParkingSource(T,v);if(!source.valid)return source;
    const model=parkingModel(v);if(!model.known)return{valid:false,reason:model.reason};
    const e=v.edge,sd=v.dir,start=sd>0?e.a:e.b,target={};T.laneTarget({...v,latExtraCur:0},target);
    const nativeSide=sd>0?e.wR:e.wL,base=((target.x-start.x)*e.nx+(target.z-start.z)*e.nz)*sd;
    const line=typeof walkOffset==='function'?walkOffset(e,sd):NaN;
    if(!finite(line)||!Array.isArray(T.world.ribbons))return{valid:false,reason:'missing-native-pedestrian-or-road-corridor'};
    const half=model.width/2,offsets=[desiredOffset,nativeSide+half+.05-base,line+.4+half+.05-base].filter((n,i,a)=>finite(n)&&a.indexOf(n)===i);
    let catalog=supportByTraffic.get(T);if(!catalog){catalog=parkingSupportCatalog(T.world);supportByTraffic.set(T,catalog);}const attempts=[];
    for(const extra of offsets){
        const plan={...v,latExtraCur:extra,lateralExtra:extra},point={};T.laneTarget(plan,point);
        const y=source.location==='on_kerb'?T.world.walkTop?.(point.x,point.z):T.world.roadHeight?.(point.x,point.z,e);
        if(!finite(y)){attempts.push({offset:extra,reason:'missing-own-source-parking-surface'});continue;}
        const body={...plan,x:point.x,z:point.z,y,heading:Math.atan2(-point.fx,-point.fz),pitch:0,roll:0,length:model.length,width:model.width},poly=parkingBodyPolygon(body,.05);
        const extents=poly.map(([x,z])=>({s:(x-start.x)*e.dirx*sd+(z-start.z)*e.dirz*sd,lat:((x-start.x)*e.nx+(z-start.z)*e.nz)*sd}));
        const lo=(sd>0?e.a:e.b),hi=(sd>0?e.b:e.a),margin=n=>(n.edges?.length>=3||n.hasLight||n.crossing||n.zebra)?Math.max(30,n.radius||0):Math.max(3,n.radius||0);
        if(extents.some(p=>p.s<margin(lo)||p.s>e.len-margin(hi))){attempts.push({offset:extra,reason:'parking-whole-body-portal-or-control-margin'});continue;}
        const moving=movingLaneContact(T,body);if(!moving.valid){attempts.push({offset:extra,...moving});continue;}
        if(source.location==='on_kerb'&&extents.some(p=>p.lat<nativeSide||p.lat>nativeSide+source.sidewalkM)){attempts.push({offset:extra,reason:'parking-whole-body-outside-own-side-pavement'});continue;}
        if(Math.max(...extents.map(p=>p.lat))>line-.4&&Math.min(...extents.map(p=>p.lat))<line+.4){attempts.push({offset:extra,reason:'parking-body-blocks-native-pedestrian-line'});continue;}
        const support=catalog.at(poly,y);if(!support.valid){attempts.push({offset:extra,...support});continue;}
        const feet=model.feet.map(p=>{const c=Math.cos(body.heading),s=Math.sin(body.heading),x=body.x+c*p[0]+s*p[2],z=body.z-s*p[0]+c*p[2],top=source.location==='on_kerb'?T.world.walkTop?.(x,z):T.world.roadHeight?.(x,z,e);return{x,z,worldY:y+p[1],surfaceY:top,gapM:finite(top)?y+p[1]-top:null};});
        if(feet.some(p=>!finite(p.surfaceY)||Math.abs(p.surfaceY-y)>1e-7)){attempts.push({offset:extra,reason:'parking-tyres-straddle-unsupported-height-bands'});continue;}
        const statics=initialTrafficStaticClearance(T.world,body);if(!statics.valid){attempts.push({offset:extra,...statics});continue;}
        let peerHit=null;
        for(const o of T.vehicles){if(o===v||o.inactive)continue;const reach=(body.length+body.width+o.length+o.width)/2+1;if(Math.abs(o.x-body.x)>reach||Math.abs(o.z-body.z)>reach)continue;const peer=peerBody(o);if(!peer){peerHit={reason:'unknown-actual-nearby-peer-model',peer:o.id};break;}const hit=initialVehicleConflict(body,peer,{clearanceM:.05});if(hit.conflict){peerHit={reason:'parking-actual-body-peer-contact',peer:o.id,hit};break;}}
        if(peerHit){attempts.push({offset:extra,...peerHit});continue;}
        if(!T.sharedLanes?.canPlace?.(e,v.dir,T.vehicles,v,body)){attempts.push({offset:extra,reason:'parking-native-shared-lane-reservation'});continue;}
        return{valid:true,source,body,offset:extra,feet,support,staticSamples:statics.samples,modelBounds:model.dimensions.bounds,nativeTyreFacetGapM:model.tyreBottomM,decorativeArchBelowSupportM:Math.max(0,-model.localMinY),attempts,rngDraws:0};
    }
    return{valid:false,reason:'no-legal-supported-nonblocking-parking-pose',source,attempts,supportCoverage:catalog.report,rngDraws:0};
}
