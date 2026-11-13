// Source-supported SeaTac open parking decks and the mapped covered departures curb.
// Plan vertices are the exact OSM w37017723 geometry in the terminal model frame.
// Vertical alignment, deck thickness, post spacing and the under-roof facade line
// remain bounded MODEL estimates, not surveyed dimensions. No source way/layer/width moves.
import { footprintCells, insideRing } from './building-parts.js';
export const DEPARTURES_CURB = {"sourceRoadId":"w37017723","sourceNodeIds":[4272365633,11105728286,1139491631,11105728285,11105728284,255173016,2386658909,1139491623,2386658921,255173017,11105728291,2386658903,2386658906,2386658907,255173018,3732079293,11105728293,1139491564,11105728296,11105728299,11105728301,1139491577,2386658895,2386658913],"sourceTags":{"bicycle":"yes","bridge":"yes","fixme":"verify bicycle=yes","highway":"secondary","lanes":"2","layer":"2","maxspeed":"20 mph","maxweight:signed":"no","name":"Departures Drive","oneway":"yes","turn:lanes":"through|through"},"sourceModelAnchor":{"lat":47.4423743,"lon":-122.3012208,"rotation":-1.4137},"line":[[-244.92396604,-94.78523544],[-233.5634751,-78.77889499],[-211.38645704,-47.5230871],[-198.21699374,-28.7302899],[-181.63328271,-5.06755343],[-179.98141732,-2.70993198],[-173.03542606,4.01512743],[-165.15615974,9.60757597],[-155.79560193,14.23043713],[-145.80039084,17.26181426],[-142.81284515,17.6512076],[-135.44884511,18.61189115],[-125.01772896,18.25207128],[-114.77754117,16.18523734],[-105.01800104,12.46457925],[-97.5242522,8.20209585],[-71.32219843,-10.24575447],[-46.96883847,-27.39350857],[-29.46091688,-39.82548839],[-10.7998641,-53.07325118],[16.41851701,-72.39666284],[51.20616476,-97.09860516],[72.3604546,-111.87972166],[82.20870924,-119.64106371]],"widthM":7,"widthSource":"Existing compiled source-road model width:2lanes x3.5m; estimate, not a measurement.","modelRoadSurfaceLocalM":11.12,"modelVoidBottomLocalM":10.9,"modelSoffitLocalM":16.4,"verticalSource":"Bounded MODEL estimate tied to existing native11.24m road and existing16.4m roof fascia; not a surveyed clearance. Only this mapped covered curb is open, full source terminal below/above and all other masses remain."};
export const GARAGE_STRUCTURE = Object.freeze({"floorDatumsM":[0,2.6,5.2,7.8,11.1875,14.575,17.9625,21.35],"level4WalkSurfaceM":7.85,"intervals":7,"deckThicknessM":0.35,"spandrelDepthM":0.8,"lowerSpandrelDepthM":0.35,"postPitchM":9.5,"postWidthM":0.7,"postDepthM":0.3,"operationalEntranceLimitM":2.0828,"dimensions":"MODEL estimates constrained by the official Level4 connection,8-level relationship, unchanged21.35m roof datum and6ft10in entrance limit. No source floor or layer becomes a metre elevation; absolute road-floor alignment and interior columns remain unknown."});

// An explicit minH uses full native body-height testing; y0 alone tests only actor base.
export function structureCollider(b,ring,holes,y0,y1,sourceId,kind) {
    b.colPolygon(ring,{holes,y0,y1});
    const c=b.cols[b.cols.length-1];delete c.y0;c.minH=y0;c.structureKind=kind;c.sourceId=sourceId;
}
export function stripRing(a,c,thickness) {
    const dx=c[0]-a[0],dz=c[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*thickness/2,nz=dx/l*thickness/2;
    return [[a[0]+nx,a[1]+nz],[c[0]+nx,c[1]+nz],[c[0]-nx,c[1]-nz],[a[0]-nx,a[1]-nz]];
}
export function boundaryBand(b,ring,y0,y1,thickness,sourceId,kind) {
    for(let i=0;i<ring.length;i++)structureCollider(b,stripRing(ring[i],ring[(i+1)%ring.length],thickness),[],y0,y1,sourceId,kind);
}
const GARAGE_POST_BAND={fromM:0.9,toM:1.8,colour:'#b5272d'}; // red band on each facade column at street level: height / position estimates
export function garagePosts(b,ring,height,colour) {
    const p=GARAGE_STRUCTURE,area=ring.reduce((v,a,i)=>{const c=ring[(i+1)%ring.length];return v+a[0]*c[1]-c[0]*a[1];},0),s=area>0?1:-1;
    for(let i=0;i<ring.length;i++){
        const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length],L=Math.hypot(bx-ax,bz-az);if(L<p.postPitchM*.9)continue;
        const n=Math.max(1,Math.round(L/p.postPitchM)),dx=(bx-ax)/L,dz=(bz-az)/L,nx=s*dz,nz=-s*dx;
        for(let j=0;j<=n;j++){
            const t=Math.min(L-p.postWidthM/2,Math.max(p.postWidthM/2,j/n*L)),x=ax+dx*t,z=az+dz*t,w=p.postWidthM/2;
            // (r2-landmarks-b-2, round 2b panorama 47.4423, -122.3005 h 41) the facade columns are round with red bands, not square
            // posts: an 8-sided column of the post width just inside the outline, a red band at street level (band height an estimate)
            const q=Array.from({length:8},(_,k)=>[x+nx*w+Math.cos(k*Math.PI/4)*w,z+nz*w+Math.sin(k*Math.PI/4)*w]);
            // Mapped public skybridge mouths interrupt an estimated facade post only
            // at their own entry storey; its support below/above remains physical.
            const entry=SKYBRIDGE_STRUCTURE.profiles.find(p=>Math.hypot(x-p.garage[0],z-p.garage[1])<3.65);
            const bands=entry?[[0,entry.garageFloorM],[entry.garageFloorM+SKYBRIDGE_STRUCTURE.clearInteriorM,height]]:[[0,height]];
            for(const [lo,hi]of bands){
                let y=lo;{const r0=GARAGE_POST_BAND.fromM,r1=GARAGE_POST_BAND.toM;if(r0>=y&&r1<=hi){b.prism(q,y,r0,colour);b.prism(q,r0,r1,GARAGE_POST_BAND.colour);y=r1;}}
                if(hi>y)b.prism(q,y,hi,colour);structureCollider(b,q,[],lo,hi,'r15763840','garage-visible-post');
            }
        }
    }
}
let curbCache=null;
export function coveredCurbCells(terminal) {
    if(curbCache)return curbCache;
    const line=DEPARTURES_CURB.line,r=DEPARTURES_CURB.widthM/2,parts=[];
    for(let i=1;i<line.length;i++)parts.push(stripRing(line[i-1],line[i],r*2));
    // Round junction caps stay inside the existing physical road width, never expand it.
    for(const [x,z]of line)parts.push(Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*r,z+Math.sin(i*Math.PI/8)*r]));
    const cells=footprintCells(terminal,parts),solid=cells.filter(c=>!c.covered.length).map(c=>c.ring),open=cells.filter(c=>c.covered.length).map(c=>c.ring);
    return curbCache={solid,open,parts,contains:(x,z)=>parts.some(p=>insideRing([x,z],p))};
}
export function coveredCurbPosts(b,terminal,colour) {
    const p=DEPARTURES_CURB,line=p.line,half=p.widthM/2-.15;let next=6,walked=0;
    for(let i=1;i<line.length;i++){
        const a=line[i-1],c=line[i],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;
        while(next<=walked+L){const t=(next-walked)/L;
            for(const side of [-1,1]){const x=a[0]+dx*t+nx*half*side,z=a[1]+dz*t+nz*half*side;if(!insideRing([x,z],terminal))continue;
                const q=[[x-.2,z-.2],[x+.2,z-.2],[x+.2,z+.2],[x-.2,z+.2]];
                b.prism(q,p.modelVoidBottomLocalM,p.modelSoffitLocalM,colour);structureCollider(b,q,[],p.modelVoidBottomLocalM,p.modelSoffitLocalM,'w23772634','terminal-covered-curb-post');
            }next+=12;
        }walked+=L;
    }
}

// Source XY is unchanged. These modest1.7–2.2% profiles are estimates constrained
// beneath native upper-road slabs and above lower arrivals, with2.3m clear interiors.
export const SKYBRIDGE_STRUCTURE = {"baselineSourceCommit":"c78a5f4c522723fb2f4e640999e3ac5d164fc724","method":"Exact native high-quality source-edge endpoint profile, total deckwidth asphalt+sidewalk, existing1.1m road underside, full7.3m bridge roof width sampled every0.2% of each exact sourcefootway;0.15m separation estimate. No source road is moved or assigned height from layer.","garageLevel4DatumM":7.85,"clearInteriorM":2.3,"roofThicknessM":0.2,"floorThicknessM":0.25,"upperRoadSlabThicknessM":1.1,"separationMarginM":0.15,"profiles":[{"sourceId":"w37017724","garageIndex":1,"garage":[-64.8,-143],"terminal":[-88,-166.6],"lengthM":33.09380606699688,"garageFloorM":7.85,"terminalFloorM":7.14,"gradient":0.02145416573006555,"firstUpperDeckOverlapFraction":0.678,"upperSourceRoads":["w963677010"],"lowerArrivalsClearanceM":6.77},{"sourceId":"w37017725","garageIndex":0,"garage":[-111.2,-97.1],"terminal":[-134.1,-120.8],"lengthM":32.95603131446504,"garageFloorM":7.85,"terminalFloorM":7.15,"gradient":0.021240421618751035,"firstUpperDeckOverlapFraction":0.69,"upperSourceRoads":["w37017723"],"lowerArrivalsClearanceM":6.78},{"sourceId":"w37017726","garageIndex":0,"garage":[-153.8,-53.2],"terminal":[-184.2,-68],"lengthM":33.81124073440664,"garageFloorM":7.85,"terminalFloorM":7.16,"gradient":0.02040741436908729,"firstUpperDeckOverlapFraction":0.696,"upperSourceRoads":["w37017723"],"lowerArrivalsClearanceM":6.79},{"sourceId":"w37017727","garageIndex":1,"garage":[-154,-21.6],"terminal":[-184.1,-6.6],"lengthM":33.6304921165302,"garageFloorM":7.85,"terminalFloorM":7.17,"gradient":0.020219745748702955,"firstUpperDeckOverlapFraction":0.706,"upperSourceRoads":["w37017723"],"lowerArrivalsClearanceM":6.8},{"sourceId":"w37017728","garageIndex":0,"garage":[-112.6,22],"terminal":[-136,46.4],"lengthM":33.80709984603826,"garageFloorM":7.85,"terminalFloorM":7.18,"gradient":0.01981832227701469,"firstUpperDeckOverlapFraction":0.726,"upperSourceRoads":["w37017723"],"lowerArrivalsClearanceM":6.81},{"sourceId":"w37017729","garageIndex":1,"garage":[-29.5,106.5],"terminal":[-54.6,137.5],"lengthM":39.88746670321393,"garageFloorM":7.85,"terminalFloorM":7.07,"gradient":0.01955501475698257,"firstUpperDeckOverlapFraction":0.62,"upperSourceRoads":["w37017723"],"lowerArrivalsClearanceM":6.7}]};

function spanRing(a,c,width) { return stripRing(a,c,width); }
function slopedSolid(b,ring,lo,hi,colour,material='m') {
    const low=ring.map(([x,z])=>[x,lo(x,z),z]),high=ring.map(([x,z])=>[x,hi(x,z),z]);
    b.quad(...high,colour,material,[0,1,0]);b.quad(...low,colour,material,[0,-1,0]);
    for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(low[i],low[j],high[j],high[i],colour,material);}
}
export function emitGarageSkybridges(b) {
    const p=SKYBRIDGE_STRUCTURE;
    for(const q of p.profiles){
        const a=q.garage,c=q.terminal,dx=c[0]-a[0],dz=c[1]-a[1],L=q.lengthM,nx=-dz/L,nz=dx/L;
        const floor=(x,z)=>{const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(L*L)));return q.garageFloorM+(q.terminalFloorM-q.garageFloorM)*t;};
        slopedSolid(b,spanRing(a,c,7), (x,z)=>floor(x,z)-p.floorThicknessM,floor,'#e1e3e4');
        slopedSolid(b,spanRing(a,c,7.3),(x,z)=>floor(x,z)+p.clearInteriorM,(x,z)=>floor(x,z)+p.clearInteriorM+p.roofThicknessM,'#e1e3e4');
        for(const side of [-1,1]){
            const r=spanRing([a[0]+nx*3.25*side,a[1]+nz*3.25*side],[c[0]+nx*3.25*side,c[1]+nz*3.25*side],.12);
            slopedSolid(b,r,floor,(x,z)=>floor(x,z)+p.clearInteriorM,'#7f9fb3','g');
        }
        // Fine strips keep native collision aligned with the sloped physical slabs.
        // The conservative vertical excess is below2.2cm; the2.3m interior gives a
        // full2.2m body its own independent clearance control.
        const n=Math.ceil(L);
        for(let i=0;i<n;i++){
            const f0=i/n,f1=(i+1)/n,v0=[a[0]+dx*f0,a[1]+dz*f0],v1=[a[0]+dx*f1,a[1]+dz*f1],y0=floor(...v0),y1=floor(...v1),low=Math.min(y0,y1),high=Math.max(y0,y1);
            structureCollider(b,spanRing(v0,v1,7),[],low-p.floorThicknessM,high,q.sourceId,'skybridge-floor');
            structureCollider(b,spanRing(v0,v1,7.3),[],low+p.clearInteriorM,high+p.clearInteriorM+p.roofThicknessM,q.sourceId,'skybridge-roof');
            for(const side of [-1,1])structureCollider(b,spanRing([v0[0]+nx*3.25*side,v0[1]+nz*3.25*side],[v1[0]+nx*3.25*side,v1[1]+nz*3.25*side],.12),[],low,high+p.clearInteriorM,q.sourceId,'skybridge-side');
        }
    }
}

const TERMINAL_SOURCE_BRIDGE_ENTRIES = [{"sourceId":"w37017724","garage":[-227.73257703189387,-121.31367190944887],"terminal":[-254.67162235802132,-102.09160550344416],"garageFloorM":7.85,"terminalFloorM":7.14},{"sourceId":"w37017725","garage":[-189.65712632146455,-68.30395531713275],"terminal":[-216.64800493440364,-49.39383972516511],"garageFloorM":7.85,"terminalFloorM":7.15},{"sourceId":"w37017726","garage":[-152.9625334451942,-19.360346401925447],"terminal":[-172.336391222735,8.349825644015144],"garageFloorM":7.85,"terminalFloorM":7.16},{"sourceId":"w37017727","garage":[-121.7829546019637,-14.218959122331116],"terminal":[-111.6768423715337,17.857145622259488],"garageFloorM":7.85,"terminalFloorM":7.17},{"sourceId":"w37017728","garage":[-72.2427873418377,-48.28788672269375],"terminal":[-51.80420787040576,-21.35863739802887],"garageFloorM":7.85,"terminalFloorM":7.18},{"sourceId":"w37017729","garage":[24.21773099640393,-117.14446521681975],"terminal":[50.909069657601705,-87.50357385921642],"garageFloorM":7.85,"terminalFloorM":7.07}];

let entryCache=null;
export function terminalBridgeEntries(terminal) {
    if(entryCache)return entryCache;
    const parts=TERMINAL_SOURCE_BRIDGE_ENTRIES.map(p=>{const a=p.garage,c=p.terminal,dx=c[0]-a[0],dz=c[1]-a[1],ll=dx*dx+dz*dz;return{...p,ring:spanRing(a,c,7),floorAt:(x,z)=>{const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/ll));return p.garageFloorM+(p.terminalFloorM-p.garageFloorM)*t;}};});
    const minimumFloor=Math.min(...parts.map(p=>Math.min(p.garageFloorM,p.terminalFloorM)))-.05;
    const contains=(x,z)=>parts.some(p=>insideRing([x,z],p.ring));
    return entryCache={parts,minimumFloor,contains,cells:footprintCells(terminal,parts.map(p=>p.ring))};
}
export function emitTerminalLowerStructure(b,terminal,top,colour) {
    const entries=terminalBridgeEntries(terminal),base=entries.minimumFloor;
    b.prism(terminal,0,base,colour);
    structureCollider(b,terminal,[],0,base,'w23772634','terminal-below-covered-curb');
    for(const cell of entries.cells){
        const voids=cell.covered.map(i=>{const p=entries.parts[i],ys=cell.ring.map(([x,z])=>p.floorAt(x,z));return[Math.min(...ys)-.05,Math.max(...ys)+SKYBRIDGE_STRUCTURE.clearInteriorM+.05];}).sort((a,c)=>a[0]-c[0]);
        const merged=[];for(const v of voids){const last=merged.at(-1);if(last&&v[0]<=last[1])last[1]=Math.max(last[1],v[1]);else merged.push(v.slice());}
        let cursor=base;const emit=(lo,hi)=>{if(hi-lo<=1e-7)return;b.prism(cell.ring,lo,hi,colour,{bottom:true});structureCollider(b,cell.ring,[],lo,hi,'w23772634','terminal-lower-entry-solid');};
        for(const [lo,hi]of merged){emit(cursor,Math.min(top,lo));cursor=Math.max(cursor,hi);}
        emit(cursor,top);
    }
}
