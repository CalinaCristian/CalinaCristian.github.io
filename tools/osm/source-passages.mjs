// Build physical opening declarations only from explicit OSM building passages.
import { footprintCells, ringArea } from '../../game/src/building-parts.js';
import { parseMeasure } from '../../game/src/building-roofs.js';

export function sourcePassages(buildings, ways, nodes, project, roads) {
    const records={},issues=[];
    const bounds=buildings.map(b=>[Math.min(...b.ring.map(p=>p[0])),Math.min(...b.ring.map(p=>p[1])),Math.max(...b.ring.map(p=>p[0])),Math.max(...b.ring.map(p=>p[1]))]);
    for(const [id,w] of ways){
        const tags=w.tags||{};
        if(tags.tunnel!=='building_passage')continue;
        const points=w.nodes.map(n=>nodes.get(n));
        if(points.length<2||points.some(p=>!p)){issues.push({sourceRoadId:'w'+id,reason:'incomplete-source-building-passage'});continue;}
        const rs=roads.filter(r=>r.id===id),sourceWidth=parseMeasure(tags.width),width=sourceWidth>0?sourceWidth:rs.length?Math.max(...rs.map(r=>r.sharedLane?r.physicalSharedWidth:(r.lf+r.lb)*r.laneW)):2.8;
        const physical=parseMeasure(tags['maxheight:physical']),legal=parseMeasure(tags.maxheight),clearance=physical>0?physical:legal>0?legal+.2:3.1;
        const ps=points.map(p=>project(...p));
        for(let segment=1;segment<ps.length;segment++){
            const a=ps[segment-1],b=ps[segment],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
            const nx=-dz/len*width/2,nz=dx/len*width/2,ring=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]].map(p=>p.map(v=>+v.toFixed(4)));
            const bb=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
            const record={sourceRoadId:'w'+id,sourceSegment:segment-1,sourceNodeIds:w.nodes.slice(segment-1,segment+1),roadIndices:rs.map(r=>r.outIndex).filter(Number.isInteger),ring,widthM:width,widthSource:sourceWidth>0?'OSM width':'estimate:source lane count and class lane width',clearanceM:clearance,clearanceSource:physical>0?'OSM maxheight:physical':legal>0?'estimate:legal maxheight plus0.2m':'estimate:3.1m motor-vehicle passage clearance',...(legal>0?{legalMaxheightM:legal}:{}),tags:{...tags},evidence:['https://www.openstreetmap.org/way/'+id],dimensionNote:'Only tunnel=building_passage declares this opening. Untagged width/vertical clearance are explicit estimates, never inferred building minimum heights. The complete building outline and source total height remain intact.'};
            buildings.forEach((body,i)=>{
                if(body.aircraft||body.canopy)return;
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
