// Preserve source carriageway dimensions without changing mapped nodes or legal lane counts.
import { parseMeasure } from './building-roofs.js';
const laneKeys=['lanes','lanes:forward','lanes:backward','lanes:both_ways'];
export function validRoadWidthReview(r){
    return !!r && /^w\d+$/.test(r.sourceRoadId||'') && Number.isFinite(r.widthM) && r.widthM>0 && Number.isFinite(r.uncertaintyM) && r.uncertaintyM>=0 && ['independent aerial measurement','geometry-constrained estimate'].includes(r.source) && Array.isArray(r.evidence) && r.evidence.length>0 && r.evidence.every(u=>typeof u==='string'&&u.startsWith('https://'));
}
export function reviewedSingleLane(tags,r){
    const m=r?.measurement;
    return validRoadWidthReview(r) && r.physicalSingleLane===true && r.source==='independent aerial measurement' && tags.width==null && laneKeys.every(k=>tags[k]==null) && Number.isFinite(m?.metresPerPixel) && m.metresPerPixel>0 && Array.isArray(m.calipers) && m.calipers.length>0 && m.calipers.every(c=>[c.a,c.b].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
}
export function resolveRoadWidth(tags,review,{lanes,lanesF=1,lanesB=1,oneway=false,reverse=false,medianM=0,sharedLane=false,defaultSharedWidth=3,defaultLaneWidth=3}={}){
    const literal=parseMeasure(tags.width),measured=validRoadWidthReview(review)?review:null;
    const placement=tags.placement||tags['placement:forward']||tags['placement:backward'];
    if(!(literal>0)&&!measured&&!sharedLane&&!placement)return null;
    const widthM=literal>0?literal:measured?.widthM??(sharedLane?defaultSharedWidth:medianM+lanes*defaultLaneWidth);
    const source=literal>0?'OSM width':measured?.source??(sharedLane?'estimate:class single-lane width':'estimate:class lane width with source placement');
    const issues=[];
    // A median inferred from road class/tram proximity is not a source width. Keep it inside the total,
    // and omit that unsupported median when it would consume the available carriageway.
    if(sharedLane)medianM=0;
    else if(medianM>0&&widthM-medianM<lanes*1.8){issues.push('inferred median omitted: source total width leaves insufficient vehicle-lane space');medianM=0;}
    const laneWidthM=(widthM-medianM)/Math.max(1,lanes);
    if(!sharedLane&&laneWidthM<1.8)issues.push('source/review width is narrower than1.8m per legal lane; lane counts and width retained for review');
    const baseRightM=oneway||sharedLane?widthM/2:medianM/2+lanesF*laneWidthM;
    const baseLeftM=widthM-baseRightM;
    let sides=null,placementSource=null;
    if(placement){
        const match=tags.placement&&/^(left_of|middle_of|right_of):([1-9]\d*)$/.exec(tags.placement);
        const count=sharedLane?1:lanes;
        if(match&&+match[2]<=count){
            const index=+match[2],fraction=match[1]==='left_of'?0:match[1]==='middle_of'?.5:1;
            const step=sharedLane?widthM:laneWidthM;
            const medianGap=!oneway&&!sharedLane&&index>lanesB?medianM:0;
            const rawLine=-baseLeftM+(index-1+fraction)*step+medianGap;
            sides={leftM:baseLeftM+rawLine,rightM:baseRightM-rawLine};
            if(reverse)[sides.leftM,sides.rightM]=[sides.rightM,sides.leftM];
            placementSource='OSM placement';
        }else issues.push('unresolved OSM placement retained; reviewed lateral placement not applied');
    }else if(measured&&(measured.leftM!=null||measured.rightM!=null)){
        if(Number.isFinite(measured.leftM)&&Number.isFinite(measured.rightM)&&measured.leftM>=0&&measured.rightM>=0&&Math.abs(measured.leftM+measured.rightM-measured.widthM)<=.02&&measured.measurement?.scope==='travel carriageway excluding parking and sidewalks'){
            const scale=widthM/measured.widthM;
            sides={leftM:measured.leftM*scale,rightM:measured.rightM*scale};
            if(reverse)[sides.leftM,sides.rightM]=[sides.rightM,sides.leftM];
            placementSource=measured.source+': lateral pavement extents';
            if(Math.abs(scale-1)>1e-6)issues.push('reviewed side extents proportioned within literal OSM total width');
        }else issues.push('invalid asymmetric review or unresolved carriageway/parking scope; lateral placement not applied');
    }
    const lateral=sides?{...sides,laneCenterShiftM:sides.rightM-baseRightM,pavementCenterOffsetM:(sides.rightM-sides.leftM)/2,placementSource,placementFrame:'prepared source-way direction; +right follows edge.nx=-dirz,nz=dirx; raw reverse ways swap left/right'}:{};
    return {widthM,medianM,laneWidthM,source,widthSource:source,...lateral,...(placement?{rawPlacement:placement}:{}),...(literal>0?{rawWidth:tags.width}:{}),...(measured?{review:measured}:{}),...(issues.length?{issues}:{}),definition:'total road width including any inferred median; legal lane counts unchanged'};
}
