import {projector} from './cities.js';
import {FLIGHT_GRACE} from './drone-boundary.js';
export const LANDMARK_VIEW_DISTANCE_M=5000;
const pointInRing=(x,z,P)=>{let yes=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,t=L?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
/** Distance to the actual stored playable capsules/circles/polygons, in district metres. */
export function distanceToDistrictCore(x,z,data){
 const geometry=data?.district?.geometry;if(!geometry)return Infinity;let distance=Infinity;
 for(const piece of geometry.pieces||[]){if(!Number.isFinite(piece.r))continue;for(let i=1;i<piece.pts.length;i++)distance=Math.min(distance,Math.max(0,segmentDistance(x,z,piece.pts[i-1],piece.pts[i])-piece.r));}
 for(const c of geometry.circles||[])if([c.x,c.z,c.r].every(Number.isFinite))distance=Math.min(distance,Math.max(0,Math.hypot(x-c.x,z-c.z)-c.r));
 for(const P of [...(geometry.polys||[]),...(data.district.polys||[])]){if(!Array.isArray(P)||P.length<3)continue;if(pointInRing(x,z,P))return 0;for(let i=0;i<P.length;i++)distance=Math.min(distance,segmentDistance(x,z,P[i],P[(i+1)%P.length]));}
 return distance;
}
/** Potential clear-view coverage, not a guarantee of camera direction or line of sight. */
export function districtLandmarkCoverage({landmarks,cityId,district,data,drawDistanceM=LANDMARK_VIEW_DISTANCE_M}){
 const project=projector(data.proj),listed=new Set(district.landmarks||[]),scenery=new Set(district.scenery||[]),bbox=district.bbox;
 return landmarks.filter(l=>l.city===cityId).map(l=>{
  const p=project(l.lat,l.lon),distanceM=distanceToDistrictCore(p.x,p.z,data),configured=listed.has(l.id),backdrop=!!l.backdrop;
  const inLegacyBox=backdrop||l.lat>=bbox[0]-.022&&l.lat<=bbox[2]+.022&&l.lon>=bbox[1]-.022*1.4&&l.lon<=bbox[3]+.022*1.4;
  const potentiallyVisible=backdrop||Number.isFinite(distanceM)&&distanceM<=drawDistanceM+FLIGHT_GRACE+(l.radiusM||0);
  const range=backdrop||distanceM>600?'distant':distanceM>1?'nearby':'close';
  return{id:l.id,distanceM:Number.isFinite(distanceM)?distanceM:null,range,configured,scenery:scenery.has(l.id),backdrop,potentiallyVisible,missing:potentiallyVisible&&!configured,legacyBoxRejected:configured&&!inLegacyBox,drawDistanceM,flightMarginM:FLIGHT_GRACE};
 });
}
