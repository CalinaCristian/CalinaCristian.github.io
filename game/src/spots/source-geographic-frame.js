// WGS84 coordinate projection; source elevations are never edited. Input numeric
// heights are used without a local vertical-datum conversion (an explicit model
// limitation). Native close-up equirectangular coordinates remain unchanged.
const A=6378137,F=1/298.257223563,E2=F*(2-F),RAD=Math.PI/180;
export const GEOGRAPHIC_TERRAIN_POLICY=Object.freeze({nearM:6000,fullM:12000,ellipsoid:'WGS84',semiMajorM:A,inverseFlattening:1/F,verticalDatumConversion:false});
export function sourceECEF(lat,lon,height){
    if(![lat,lon,height].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid geographic source coordinate');
    const p=lat*RAD,l=lon*RAD,s=Math.sin(p),c=Math.cos(p),n=A/Math.sqrt(1-E2*s*s);
    return[(n+height)*c*Math.cos(l),(n+height)*c*Math.sin(l),(n*(1-E2)+height)*s];
}
export function sourceENU(lat,lon,height,origin){
    const p=sourceECEF(lat,lon,height),o=sourceECEF(origin.lat,origin.lon,origin.elev),d=p.map((v,i)=>v-o[i]),f=origin.lat*RAD,l=origin.lon*RAD,sf=Math.sin(f),cf=Math.cos(f),sl=Math.sin(l),cl=Math.cos(l);
    return[-sl*d[0]+cl*d[1],cf*cl*d[0]+cf*sl*d[1]+sf*d[2],sf*cl*d[0]+sf*sl*d[1]-cf*d[2]]; // east,up,south
}
export function sourceGeographicPosition(lat,lon,height,frame,policy=GEOGRAPHIC_TERRAIN_POLICY){
    const{origin,projection}=frame,{nearM,fullM}=policy;
    if(!(nearM>0&&fullM>nearM))throw Error('Invalid geographic transition');
    const flat=[(lon-origin.lon)*projection.mLon,height-origin.elev,(origin.lat-lat)*projection.mLat],r=Math.hypot(flat[0],flat[2]);
    if(r<=nearM){sourceECEF(lat,lon,height);return flat;}
    const curved=sourceENU(lat,lon,height,origin);
    if(r>=fullM)return curved;
    const t=(r-nearM)/(fullM-nearM),w=t*t*(3-2*t);
    return flat.map((v,i)=>v*(1-w)+curved[i]*w);
}
