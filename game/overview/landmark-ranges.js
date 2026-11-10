const labels={close:'Close range',nearby:'Nearby scenery',distant:'Distant backdrop'};
export function landmarkRangeSummary(landmark){
 const ranges=new Set((landmark.rangeContexts||[]).map(c=>c.range));
 return ['close','nearby','distant'].filter(k=>ranges.has(k)).map(k=>labels[k]).join(' / ')||'Outside covered views';
}
export function landmarkRangeContexts(landmark){
 return(landmark.rangeContexts||[]).map(c=>({...c,label:labels[c.range]||'Range unavailable',distance:c.distanceM==null?'':c.distanceM<1000?`about ${Math.round(c.distanceM)} m`:`about ${(c.distanceM/1000).toFixed(1)} km`}));
}
