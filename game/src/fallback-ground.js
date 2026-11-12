import * as THREE from '../vendor/three.module.min.js';
import {fallbackVisit,fallbackState,overlaps} from './fallback-partition.js';

const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const bounds=p=>({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[1])),z1:Math.max(...p.map(v=>v[1]))});

/** Complete source triangles only, collected before any camera selects indices.
 * The datum is the old fallback, not a surveyed terrain/road/water elevation. */
export function fallbackGroundApertures({datum=-.3,maxCuts=200000}={}){
    const cuts=[],report={known:true,datum,sourceTriangles:0,apertures:0,byKind:{},reason:null};
    const addTriangle=(vertices,kind)=>{
        report.sourceTriangles++;
        if(!vertices.flat().every(Number.isFinite)){report.known=false;report.reason='nonfinite-source-triangle';return;}
        const[a,b,c]=vertices,up=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
        if(up>=-1e-9||Math.min(...vertices.map(v=>v[1]))>=datum-1e-7)return;
        // Clip the real affine surface where it crosses the unchanged datum.
        const polygon=[];
        for(let i=0;i<3;i++){
            const p=vertices[i],q=vertices[(i+1)%3],inside=p[1]<datum,other=q[1]<datum;
            if(inside)polygon.push([p[0],p[2]]);
            if(inside!==other){const t=(datum-p[1])/(q[1]-p[1]);polygon.push([p[0]+(q[0]-p[0])*t,p[2]+(q[2]-p[2])*t]);}
        }
        if(polygon.length<3||area(polygon)<1e-9)return;
        if(cuts.length>=maxCuts){report.known=false;report.reason='source-aperture-limit';return;}
        cuts.push({poly:polygon,...bounds(polygon)});report.apertures++;report.byKind[kind]=(report.byKind[kind]||0)+1;
    };
    const addGeometry=(geometry,kind)=>{
        const p=geometry?.attributes?.position,index=geometry?.index;
        if(!p||(index?index.count:p.count)%3){report.known=false;report.reason='malformed-source-geometry';return;}
        // Construction-time input must still contain every original triangle.
        if(geometry.drawRange.start!==0||geometry.drawRange.count<(index?index.count:p.count)){report.known=false;report.reason='camera-selected-aperture-input';return;}
        if(!geometry.boundingBox)geometry.computeBoundingBox();
        if(geometry.boundingBox.min.y>=datum-1e-7){report.sourceTriangles+=(index?index.count:p.count)/3;return;}
        for(let i=0;i<(index?index.count:p.count);i+=3)addTriangle([0,1,2].map(k=>{const j=index?index.getX(i+k):i+k;return[p.getX(j),p.getY(j),p.getZ(j)];}),kind);
    };
    return {cuts,report,addTriangle,addGeometry};
}

/** Adaptive rectangles stay coarse away from source openings. Exact convex
 * subtraction preserves islands and overlapping holes without raster masks. */
export function buildFallbackGround(apertures,{x0,x1,z0,z1,leafSize=64,maxNodes=100000,maxFragments=2048}={}){
    const report={...apertures.report,leafSize,nodes:0,leaves:0,triangles:0};
    if(!report.known)return {geometry:null,parts:[],report};
    if(![x0,x1,z0,z1,leafSize].every(Number.isFinite)||x1<=x0||z1<=z0||leafSize<1)return {geometry:null,parts:[],report:{...report,known:false,reason:'invalid-fallback-bounds'}};
    const st=fallbackVisit({x0,x1,z0,z1},apertures.cuts.filter(c=>overlaps(c,{x0,x1,z0,z1})),fallbackState({report,leafSize,maxNodes,maxFragments,datum:report.datum,x0,z1}));
    return finishGround(st.positions,st.normals,st.uv,st.indices,st.parts,report);
}
function finishGround(positions,normals,uv,indices,parts,report){
    if(!report.known)return {geometry:null,parts:[],report};
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();report.triangles=indices.length/3;
    return {geometry,parts,report};
}

/** buildFallbackGround with the subtrees below the top levels walked in the build workers (spec 10 load budget). The
 *  top levels split here exactly as fallbackVisit does; every subtree is walked by fallbackVisit (in a worker when it has
 *  cuts) and the outputs are joined in depth-first order with their indices offset: the same arrays as one walk. Should a
 *  subtree stop at a limit, or the node total pass maxNodes, the whole ground is built here by buildFallbackGround. */
export async function buildFallbackGroundParallel(apertures,opts,pool,{depth=6}={}){
    const {x0,x1,z0,z1,leafSize=64,maxNodes=100000,maxFragments=2048}=opts||{};
    const report={...apertures.report,leafSize,nodes:0,leaves:0,triangles:0};
    if(!pool||!report.known||![x0,x1,z0,z1,leafSize].every(Number.isFinite)||x1<=x0||z1<=z0||leafSize<1)return buildFallbackGround(apertures,opts);
    const cuts=apertures.cuts.filter(c=>overlaps(c,{x0,x1,z0,z1})),index=new Map(cuts.map((c,i)=>[c,i])),params={leafSize,maxNodes,maxFragments,datum:report.datum,x0,z1};
    const chunks=[];let nodes=0;
    const descend=(box,nearby,d)=>{
        const w=box.x1-box.x0,h=box.z1-box.z0;
        if(!nearby.length){chunks.push(fallbackVisit(box,nearby,fallbackState({report:{known:true,reason:null,nodes:0,leaves:0},...params})));return;}
        if(!(Math.max(w,h)>leafSize)||d>=depth){chunks.push(pool.fallback(box,Int32Array.from(nearby,c=>index.get(c)),params));return;}
        nodes++;
        const split=w>=h?(box.x0+box.x1)/2:(box.z0+box.z1)/2;
        const children=w>=h?[{...box,x1:split},{...box,x0:split}]:[{...box,z1:split},{...box,z0:split}];
        for(const child of children)descend(child,nearby.filter(c=>overlaps(child,c)),d+1);
    };
    pool.fallbackCuts(cuts);
    descend({x0,x1,z0,z1},cuts,0);
    let parts;
    try{parts=await Promise.all(chunks);}catch(e){console.warn('[fallback ground] worker failed, building here',e);return buildFallbackGround(apertures,opts);}
    let leaves=0;for(const c of parts){if(!c.report.known)return buildFallbackGround(apertures,opts);nodes+=c.report.nodes;leaves+=c.report.leaves;}
    if(nodes>maxNodes)return buildFallbackGround(apertures,opts);
    const positions=[],normals=[],uv=[],indices=[],outParts=[];
    for(const c of parts){
        const vOff=positions.length/3,iOff=indices.length;
        for(const v of c.positions)positions.push(v);for(const v of c.normals)normals.push(v);for(const v of c.uv)uv.push(v);
        for(const v of c.indices)indices.push(v+vOff);
        for(const q of c.parts)outParts.push({start:q.start+iOff,count:q.count,bounds:q.bounds});
    }
    report.nodes=nodes;report.leaves=leaves;
    return finishGround(positions,normals,uv,indices,outParts,report);
}
