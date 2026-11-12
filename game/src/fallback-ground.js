import * as THREE from '../vendor/three.module.min.js';
import {subtractTramTrench} from './tram-trench.js';

const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const bounds=p=>({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),z0:Math.min(...p.map(v=>v[1])),z1:Math.max(...p.map(v=>v[1]))});
const overlaps=(a,b)=>a.x1>=b.x0&&a.x0<=b.x1&&a.z1>=b.z0&&a.z0<=b.z1;

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
    const positions=[],normals=[],uv=[],indices=[],parts=[],datum=report.datum;
    const vertex=(x,z)=>[x,datum,z,(x-x0)/12,(z1-z)/12];
    const append=polygons=>{
        const start=indices.length;let bx0=Infinity,bx1=-Infinity,bz0=Infinity,bz1=-Infinity;
        for(const p of polygons){const first=positions.length/3;for(const v of p){positions.push(v[0],v[1],v[2]);normals.push(0,1,0);uv.push(v[3],v[4]);bx0=Math.min(bx0,v[0]);bx1=Math.max(bx1,v[0]);bz0=Math.min(bz0,v[2]);bz1=Math.max(bz1,v[2]);}for(let i=1;i<p.length-1;i++)indices.push(first,first+i,first+i+1);}
        if(indices.length>start)parts.push({start,count:indices.length-start,bounds:[bx0,datum,bz0,bx1,datum,bz1]});
    };
    const visit=(box,nearby)=>{
        if(!report.known)return;
        if(++report.nodes>maxNodes){report.known=false;report.reason='fallback-partition-limit';return;}
        const polygon=[vertex(box.x0,box.z0),vertex(box.x0,box.z1),vertex(box.x1,box.z1),vertex(box.x1,box.z0)];
        if(!nearby.length){append([polygon]);report.leaves++;return;}
        const w=box.x1-box.x0,h=box.z1-box.z0;
        if(Math.max(w,h)>leafSize){
            const split=w>=h?(box.x0+box.x1)/2:(box.z0+box.z1)/2;
            const children=w>=h?[{...box,x1:split},{...box,x0:split}]:[{...box,z1:split},{...box,z0:split}];
            for(const child of children)visit(child,nearby.filter(c=>overlaps(child,c)));return;
        }
        let fragments=[polygon];
        // a fragment's box is the same for every cut tested against it: computed once (Math.min / max as bounds() does)
        const boxes=new WeakMap(),boxOf=p=>{let b=boxes.get(p);if(!b){let ax=Infinity,bx=-Infinity,az=Infinity,bz=-Infinity;for(const v of p){ax=Math.min(ax,v[0]);bx=Math.max(bx,v[0]);az=Math.min(az,v[2]);bz=Math.max(bz,v[2]);}b={x0:ax,x1:bx,z0:az,z1:bz};boxes.set(p,b);}return b;};
        for(const cut of nearby){
            fragments=fragments.flatMap(p=>overlaps(boxOf(p),cut)?subtractTramTrench(p,cut.poly):[p]);
            if(fragments.length>maxFragments){report.known=false;report.reason='fallback-subtraction-limit';return;}
            if(!fragments.length)break;
        }
        append(fragments);report.leaves++;
    };
    visit({x0,x1,z0,z1},apertures.cuts.filter(c=>overlaps(c,{x0,x1,z0,z1})));
    if(!report.known)return {geometry:null,parts:[],report};
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();report.triangles=indices.length/3;
    return {geometry,parts,report};
}
