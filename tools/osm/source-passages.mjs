// Physical openings require explicit OSM tags or individually reviewed shared-wall-node source topology.
import { footprintCells, ringArea } from '../../game/src/building-parts.js';
import { parseMeasure } from '../../game/src/building-roofs.js';
import { edgeCuts, passageBaseUnknown } from '../../game/src/building-passages.js';
import { pointInPolygon } from './geom.mjs';

// A mapped passage describes a vehicle corridor, including the finite-width mouths.
// Sweep its source centreline by half its width; round caps retain a clear transition
// through an oblique/corner source wall without extending a new tunnel along a wing.
function sweptPassageRing(a,b,width,seam=.0001,capSegments=12){
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],r=width/2;
    const aa=[a[0]-u[0]*seam,a[1]-u[1]*seam],bb=[b[0]+u[0]*seam,b[1]+u[1]*seam],ring=[];
    for(const [c,start]of[[bb,angle+Math.PI/2],[aa,angle-Math.PI/2]])for(let k=0;k<=capSegments;k++){const q=start-Math.PI*k/capSegments;ring.push([c[0]+Math.cos(q)*r,c[1]+Math.sin(q)*r]);}
    return ring;
}

export function sourcePassages(buildings, ways, nodes, project, roads, reviewed = []) {
    const records={},issues=[],reviewByWay=new Map();
    for (const r of reviewed) {
        const way=ways.get(+String(r.sourceRoadId).slice(1)),body=ways.get(+String(r.buildingId).slice(1));
        const shared=r.sharedWallNodeIds;
        const valid=/^w\d+$/.test(r.sourceRoadId||'')&&/^w\d+$/.test(r.buildingId||'')&&way&&body&&Array.isArray(shared)&&shared.length===2&&shared[0]===way.nodes[0]&&shared[1]===way.nodes.at(-1)&&shared.every(n=>body.nodes.includes(n))&&r.classificationSource==='reviewed source shared-wall-node topology'&&Array.isArray(r.evidence)&&r.evidence.length&&r.evidence.every(u=>typeof u==='string'&&u.startsWith('https://'))&&Number.isFinite(r.clearanceM)&&r.clearanceM>0;
        if(!valid){issues.push({sourceId:r.buildingId,sourceRoadId:r.sourceRoadId,reason:'invalid-reviewed-source-opening'});continue;}
        if(reviewByWay.has(r.sourceRoadId)){issues.push({sourceId:r.buildingId,sourceRoadId:r.sourceRoadId,reason:'duplicate-reviewed-source-opening'});continue;}
        reviewByWay.set(r.sourceRoadId,r);
    }
    const bounds=buildings.map(b=>[Math.min(...b.ring.map(p=>p[0])),Math.min(...b.ring.map(p=>p[1])),Math.max(...b.ring.map(p=>p[0])),Math.max(...b.ring.map(p=>p[1]))]);
    for(const [id,w] of ways){
        const tags=w.tags||{};
        const review=reviewByWay.get('w'+id);
        if(tags.tunnel!=='building_passage'&&!review)continue;
        const points=w.nodes.map(n=>nodes.get(n));
        if(points.length<2||points.some(p=>!p)){issues.push({sourceRoadId:'w'+id,reason:'incomplete-source-building-passage'});continue;}
        const rs=roads.filter(r=>r.id===id),sourceWidth=parseMeasure(tags.width),width=sourceWidth>0?sourceWidth:rs.length?Math.max(...rs.map(r=>r.sharedLane?r.physicalSharedWidth:(r.lf+r.lb)*r.laneW)):2.8;
        const physical=parseMeasure(tags['maxheight:physical']),legal=parseMeasure(tags.maxheight),clearance=physical>0?physical:legal>0?legal+.2:review?.clearanceM??3.1;
        const ps=points.map(p=>project(...p));
        if(passageBaseUnknown(tags)){
            const matching=buildings.filter(body=>!body.aircraft&&ps.slice(1).some((b,j)=>{const a=ps[j],cuts=edgeCuts(a,b,[body.ring,...body.holes]);return cuts.slice(1).some((hi,k)=>{const t=(cuts[k]+hi)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return pointInPolygon(...p,body.ring)&&!body.holes.some(h=>pointInPolygon(...p,h));});})).map(b=>b.t.__id);
            if(matching.length)issues.push({sourceRoadId:'w'+id,reason:'absolute-passage-base-unknown',baseUnknown:true,status:'unsupported without a physical vertical datum',classificationSource:review?.classificationSource||'OSM tunnel=building_passage',buildingIds:[...new Set(matching)],sourceNodeIds:[...w.nodes],sourceCentreline:ps,tags:{...tags},evidence:review?.evidence||['https://www.openstreetmap.org/way/'+id],dimensionNote:'Relative source layer/level/bridge ordering does not establish metres above local ground. No ground void is cut; source identities and complete horizontal geometry are retained for review.'});
            continue;
        }

        for(let segment=1;segment<ps.length;segment++){
            const a=ps[segment-1],b=ps[segment],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
            // A 0.1mm longitudinal overlap absorbs the source-building 4-decimal representation error at shared wall nodes.
            // Keep full road precision and the literal lateral width; never move/shrink the source building.
            const seam=.0001,ring=sweptPassageRing(a,b,width,seam);
            const bb=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
            const record={sourceRoadId:'w'+id,sourceSegment:segment-1,sourceNodeIds:w.nodes.slice(segment-1,segment+1),roadIndices:rs.map(r=>r.outIndex).filter(Number.isInteger),ring,sourceCentreline:[a,b],longitudinalSeamOverlapM:seam,mouthGeometry:{type:'source centreline swept by half width',radiusM:width/2,capSegments:12,interpretation:'finite-width vehicle corridor; round end-cap approximation, not a longer source road'},classificationSource:review?.classificationSource||'OSM tunnel=building_passage',...(review?{reviewedAt:review.reviewedAt,sharedWallNodeIds:review.sharedWallNodeIds,reviewNote:review.note}:{}),widthM:width,widthSource:sourceWidth>0?'OSM width':'estimate:source lane count and class lane width',clearanceM:clearance,clearanceSource:physical>0?'OSM maxheight:physical':legal>0?'estimate:legal maxheight plus0.2m':review?.clearanceSource||'estimate:3.1m motor-vehicle passage clearance',...(legal>0?{legalMaxheightM:legal}:{}),tags:{...tags},evidence:review?.evidence||['https://www.openstreetmap.org/way/'+id],dimensionNote:'An explicit building_passage tag or individually reviewed exact shared-wall-node through-access declares this opening. Untagged width/vertical clearance are explicit estimates, never inferred building minimum heights. The complete building outline and source total height remain intact.'};
            buildings.forEach((body,i)=>{
                if(body.aircraft||body.canopy||(review&&body.t.__id!==review.buildingId))return;
                const b=bounds[i];if(b[0]>bb[2]||b[2]<bb[0]||b[1]>bb[3]||b[3]<bb[1])return;
                const cuts=edgeCuts(a,b,[body.ring,...body.holes]);
                if(!cuts.slice(1).some((hi,j)=>{const t=(cuts[j]+hi)/2,p=[a[0]+dx*t,a[1]+dz*t];return pointInPolygon(...p,body.ring)&&!body.holes.some(h=>pointInPolygon(...p,h));}))return; // a nearby frontage is not a passage through this body
                const cells=footprintCells(ring,[body.ring,...body.holes]);
                if(!cells.some(c=>c.covered.includes(0)&&c.covered.length===1&&Math.abs(ringArea(c.ring))>1e-5))return;
                if(body.minH>clearance+2)return; // an already elevated source body does not need a ground opening
                if((body.roofProfile?.eavesM??body.h)<=clearance+.24){issues.push({sourceId:body.t.__id,sourceRoadId:record.sourceRoadId,reason:'mapped-passage-clearance-incompatible-with-source-body',bodyTopM:body.roofProfile?.eavesM??body.h,clearanceM:clearance});return;}
                (records[i]||=[]).push(record);
            });
        }
    }
    return {records,issues};
}
