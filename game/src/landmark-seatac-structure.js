// Source-supported SeaTac open parking decks and the mapped covered departures curb.
// Plan vertices are the exact OSM w37017723 geometry in the terminal model frame.
// Vertical alignment, deck thickness, post spacing and the under-roof facade line
// remain bounded MODEL estimates, not surveyed dimensions. No source way/layer/width moves.
import { footprintCells, insideRing } from './building-parts.js';
export const DEPARTURES_CURB = {"sourceRoadId":"w37017723","sourceNodeIds":[4272365633,11105728286,1139491631,11105728285,11105728284,255173016,2386658909,1139491623,2386658921,255173017,11105728291,2386658903,2386658906,2386658907,255173018,3732079293,11105728293,1139491564,11105728296,11105728299,11105728301,1139491577,2386658895,2386658913],"sourceTags":{"bicycle":"yes","bridge":"yes","fixme":"verify bicycle=yes","highway":"secondary","lanes":"2","layer":"2","maxspeed":"20 mph","maxweight:signed":"no","name":"Departures Drive","oneway":"yes","turn:lanes":"through|through"},"sourceModelAnchor":{"lat":47.4423743,"lon":-122.3012208,"rotation":-1.4137},"line":[[-244.92396604,-94.78523544],[-233.5634751,-78.77889499],[-211.38645704,-47.5230871],[-198.21699374,-28.7302899],[-181.63328271,-5.06755343],[-179.98141732,-2.70993198],[-173.03542606,4.01512743],[-165.15615974,9.60757597],[-155.79560193,14.23043713],[-145.80039084,17.26181426],[-142.81284515,17.6512076],[-135.44884511,18.61189115],[-125.01772896,18.25207128],[-114.77754117,16.18523734],[-105.01800104,12.46457925],[-97.5242522,8.20209585],[-71.32219843,-10.24575447],[-46.96883847,-27.39350857],[-29.46091688,-39.82548839],[-10.7998641,-53.07325118],[16.41851701,-72.39666284],[51.20616476,-97.09860516],[72.3604546,-111.87972166],[82.20870924,-119.64106371]],"widthM":7,"widthSource":"Existing compiled source-road model width:2lanes x3.5m; estimate, not a measurement.","modelRoadSurfaceLocalM":11.12,"modelVoidBottomLocalM":10.9,"modelSoffitLocalM":16.4,"verticalSource":"Bounded MODEL estimate tied to existing native11.24m road and existing16.4m roof fascia; not a surveyed clearance. Only this mapped covered curb is open, full source terminal below/above and all other masses remain."};
export const GARAGE_STRUCTURE = Object.freeze({ floorSpacingM:3.05, intervals:7, deckThicknessM:.35, spandrelDepthM:.8, postPitchM:9.5, postWidthM:.7, postDepthM:.3, operationalEntranceLimitM:2.0828, dimensions:'Existing3.05m floor interval retained; thickness, spandrels and post positions are estimates. Official6ft10in applies only to the garage entrance, not the terminal. Absolute road-floor datums and interior columns remain unknown.' });

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
export function garagePosts(b,ring,height,colour) {
    const p=GARAGE_STRUCTURE,area=ring.reduce((v,a,i)=>{const c=ring[(i+1)%ring.length];return v+a[0]*c[1]-c[0]*a[1];},0),s=area>0?1:-1;
    for(let i=0;i<ring.length;i++){
        const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length],L=Math.hypot(bx-ax,bz-az);if(L<p.postPitchM*.9)continue;
        const n=Math.max(1,Math.round(L/p.postPitchM)),dx=(bx-ax)/L,dz=(bz-az)/L,nx=s*dz,nz=-s*dx;
        for(let j=0;j<=n;j++){
            const t=Math.min(L-p.postWidthM/2,Math.max(p.postWidthM/2,j/n*L)),x=ax+dx*t,z=az+dz*t,w=p.postWidthM/2,d=p.postDepthM;
            const q=[[x-dx*w,z-dz*w],[x+dx*w,z+dz*w],[x+dx*w+nx*d,z+dz*w+nz*d],[x-dx*w+nx*d,z-dz*w+nz*d]];
            b.prism(q,0,height,colour);structureCollider(b,q,[],0,height,'r15763840','garage-visible-post');
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
