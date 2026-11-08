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
export function resolveRoadWidth(tags,review,{lanes,medianM=0,sharedLane=false,defaultSharedWidth=3}={}){
    const literal=parseMeasure(tags.width),measured=validRoadWidthReview(review)?review:null;
    if(!(literal>0)&&!measured&&!sharedLane)return null;
    const widthM=literal>0?literal:measured?.widthM??defaultSharedWidth;
    const source=literal>0?'OSM width':measured?.source??'estimate:class single-lane width';
    const issues=[];
    // A median inferred from road class/tram proximity is not a source width. Keep it inside the total,
    // and omit that unsupported median when it would consume the available carriageway.
    if(sharedLane)medianM=0;
    else if(medianM>0&&widthM-medianM<lanes*1.8){issues.push('inferred median omitted: source total width leaves insufficient vehicle-lane space');medianM=0;}
    const laneWidthM=(widthM-medianM)/Math.max(1,lanes);
    if(!sharedLane&&laneWidthM<1.8)issues.push('source/review width is narrower than1.8m per legal lane; lane counts and width retained for review');
    return {widthM,medianM,laneWidthM,source,widthSource:source,...(literal>0?{rawWidth:tags.width}:{}),...(measured?{review:measured}:{}),...(issues.length?{issues}:{}),definition:'total road width including any inferred median; legal lane counts unchanged'};
}
