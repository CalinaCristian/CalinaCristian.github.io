// Optional independently measured surface-lot orientation. Bearings are axial compass degrees.
export const PARKING_LAYOUT_CONFIDENCE = 0.75;
const axial = v => ((v % 180) + 180) % 180;
const angle = (a,b) => Math.min(axial(a-b),180-axial(a-b));
export const parkingBearingYaw = bearing => Math.PI-bearing*Math.PI/180;
export function resolveParkingLayout(record,tags={}) {
    const reject=reason=>({layout:null,reason});
    if(!record)return reject('no independent layout measurement');
    if(record.mixed)return reject('mixed/uncertain layout has no uniform measured row model');
    if(!(Number.isFinite(record.confidence)&&record.confidence>=PARKING_LAYOUT_CONFIDENCE))return reject('measurement confidence below 0.75');
    if(![record.rowBearingDeg,record.stallBearingDeg].every(Number.isFinite)||record.alternateStallBearingDeg!=null&&!Number.isFinite(record.alternateStallBearingDeg))return reject('missing finite axial bearings');
    if(!record.evidence?.sourceUrl||!Array.isArray(record.evidence.rowSamplesPx)||record.evidence.rowSamplesPx.length<2||!Array.isArray(record.evidence.stallSamplesPx)||record.evidence.stallSamplesPx.length<3||record.alternateStallBearingDeg!=null&&(!Array.isArray(record.evidence.alternateStallSamplesPx)||record.evidence.alternateStallSamplesPx.length<3))return reject('missing independently reviewable pixel samples');
    const row=axial(record.rowBearingDeg),stalls=[axial(record.stallBearingDeg),...(record.alternateStallBearingDeg==null?[]:[axial(record.alternateStallBearingDeg)])];
    const deltas=stalls.map(s=>angle(row,s));
    if(deltas.some(d=>d<25))return reject('parallel or near-parallel stalls need a separately measured row spacing model');
    const orientation=String(tags['parking:orientation']||tags.orientation||'').toLowerCase();
    const layoutTag=String(tags['parking:layout']||tags.layout||'').toLowerCase();
    const category=d=>d>=75?'perpendicular':d<=20?'parallel':'diagonal';
    if(orientation&&(!['parallel','perpendicular','diagonal'].includes(orientation)||deltas.some(d=>category(d)!==orientation)))return reject('explicit OSM orientation takes priority over aerial measurement');
    if(layoutTag&&!['diagonal','perpendicular','parallel','herringbone'].includes(layoutTag))return reject('unsupported explicit OSM layout retained without aerial override');
    if(layoutTag==='herringbone'&&stalls.length!==2||['parallel','perpendicular','diagonal'].includes(layoutTag)&&deltas.some(d=>category(d)!==layoutTag))return reject('explicit OSM layout takes priority over aerial measurement');
    return {layout:{...record,rowBearingDeg:row,stallBearingDeg:stalls[0],...(stalls.length===2?{alternateStallBearingDeg:stalls[1]}:{}),sourceTags:tags},reason:'independent measured angles; explicit OSM layout compatible'};
}
export function parkingRowPose(layout,row) {
    const bearing=row%2&&layout.alternateStallBearingDeg!=null?layout.alternateStallBearingDeg:layout.stallBearingDeg;
    const delta=angle(layout.rowBearingDeg,bearing)*Math.PI/180;
    return {rowYaw:parkingBearingYaw(layout.rowBearingDeg),stallYaw:parkingBearingYaw(bearing)+(row%2?0:Math.PI),stallPitchM:2.6/Math.max(.3,Math.abs(Math.sin(delta)))};
}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const on=(p,a,b)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if(on(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const edgesCross=(a,b)=>a.some((p,i)=>b.some((q,j)=>{const p2=a[(i+1)%a.length],q2=b[(j+1)%b.length],x1=cross(p,p2,q),x2=cross(p,p2,q2),y1=cross(q,q2,p),y2=cross(q,q2,p2);return x1*x2<0&&y1*y2<0||on(p,q,q2)||on(p2,q,q2)||on(q,p,p2)||on(q2,p,p2);}));
export const parkingPolygonsOverlap=(a,b)=>a.some(p=>inside(p,b))||b.some(p=>inside(p,a))||edgesCross(a,b);
export function parkingBodyOverlap(footprint,body,vehicleTopM=2.1) {
    if((body.minHeightM||0)>vehicleTopM||body.maxHeightM!=null&&body.maxHeightM<.1)return false;
    if(!parkingPolygonsOverlap(footprint,body.outer))return false;
    return !(body.holes||[]).some(h=>footprint.every(p=>inside(p,h))&&!edgesCross(footprint,h));
}
