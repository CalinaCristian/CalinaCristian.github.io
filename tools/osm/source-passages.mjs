// Physical openings require explicit OSM tags or individually reviewed shared-wall-node source topology.
import { footprintCells, ringArea } from '../../game/src/building-parts.js';
import { parseMeasure } from '../../game/src/building-roofs.js';

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
        for(let segment=1;segment<ps.length;segment++){
            const a=ps[segment-1],b=ps[segment],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
            // A 0.1mm longitudinal overlap absorbs the source-building 4-decimal representation error at shared wall nodes.
            // Keep full road precision and the literal lateral width; never move/shrink the source building.
            const seam=.0001,ux=dx/len,uz=dz/len,nx=-uz*width/2,nz=ux*width/2;
            const aa=[a[0]-ux*seam,a[1]-uz*seam],bbp=[b[0]+ux*seam,b[1]+uz*seam];
            const ring=[[aa[0]+nx,aa[1]+nz],[bbp[0]+nx,bbp[1]+nz],[bbp[0]-nx,bbp[1]-nz],[aa[0]-nx,aa[1]-nz]];
            const bb=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
            const record={sourceRoadId:'w'+id,sourceSegment:segment-1,sourceNodeIds:w.nodes.slice(segment-1,segment+1),roadIndices:rs.map(r=>r.outIndex).filter(Number.isInteger),ring,sourceCentreline:[a,b],longitudinalSeamOverlapM:seam,classificationSource:review?.classificationSource||'OSM tunnel=building_passage',...(review?{reviewedAt:review.reviewedAt,sharedWallNodeIds:review.sharedWallNodeIds,reviewNote:review.note}:{}),widthM:width,widthSource:sourceWidth>0?'OSM width':'estimate:source lane count and class lane width',clearanceM:clearance,clearanceSource:physical>0?'OSM maxheight:physical':legal>0?'estimate:legal maxheight plus0.2m':review?.clearanceSource||'estimate:3.1m motor-vehicle passage clearance',...(legal>0?{legalMaxheightM:legal}:{}),tags:{...tags},evidence:review?.evidence||['https://www.openstreetmap.org/way/'+id],dimensionNote:'An explicit building_passage tag or individually reviewed exact shared-wall-node through-access declares this opening. Untagged width/vertical clearance are explicit estimates, never inferred building minimum heights. The complete building outline and source total height remain intact.'};
            buildings.forEach((body,i)=>{
                if(body.aircraft||body.canopy||(review&&body.t.__id!==review.buildingId))return;
                const b=bounds[i];if(b[0]>bb[2]||b[2]<bb[0]||b[1]>bb[3]||b[3]<bb[1])return;
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
