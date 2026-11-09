// Read-only actual emitted support for constructor parking decisions.
import * as THREE from '../vendor/three.module.min.js';
import {sourceVehicleDimensions} from './source-vehicle-dimensions.js';
import {subtractTramTrench} from './tram-trench.js';
const finite=Number.isFinite,modelCache=new WeakMap();
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);

export function parkingBodyPolygon(v,margin=0){
    const fx=-Math.sin(v.heading),fz=-Math.cos(v.heading),rx=-fz,rz=fx;
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[v.x+fx*(v.length/2+margin)*a+rx*(v.width/2+margin)*b,v.z+fz*(v.length/2+margin)*a+rz*(v.width/2+margin)*b]);
}


/** Read actual near-model geometry. The native tyre material identifies the
 * contact facets; decorative wheel-arch vertices below local zero are retained
 * in the complete static/body envelope, never mistaken for tyre supports.
 */
export function parkingModel(v){
    const dimensions=sourceVehicleDimensions(v),g=v.mesh?.userData?._model?.geo,p=g?.attributes?.position,m=g?.attributes?.aMat;
    if(!dimensions.known||!p||!m||p.normalized||m.normalized||m.count!==p.count)return{known:false,reason:'unknown-actual-parking-model',dimensions};
    let cached=modelCache.get(g);
    if(!cached||cached.position!==p||cached.material!==m||cached.version!==p.version||cached.materialVersion!==m.version){
        let low=Infinity;const tyre=[];
        for(let i=0;i<p.count;i++)if(Math.abs(m.getX(i))<1e-7&&Math.abs(m.getY(i)-.92)<1e-6&&Math.abs(m.getZ(i))<1e-7&&Math.abs(m.getW(i))<1e-7){tyre.push(i);low=Math.min(low,p.getY(i));}
        const seen=new Set(),feet=[];
        for(const i of tyre)if(Math.abs(p.getY(i)-low)<1e-7){const point=[p.getX(i),p.getY(i),p.getZ(i)],key=point.join(',');if(!seen.has(key)){seen.add(key);feet.push(point);}}
        cached={position:p,material:m,version:p.version,materialVersion:m.version,feet,tyreBottomM:low};modelCache.set(g,cached);
    }
    if(cached.feet.length<4||cached.feet.some(p=>!p.every(finite))||![-1,1].every(x=>[-1,1].every(z=>cached.feet.some(p=>Math.sign(p[0])===x&&Math.sign(p[2])===z))))return{known:false,reason:'unknown-four-tyre-supports',dimensions};
    const s=v.mesh.scale;if(!s||['x','y','z'].some(k=>s[k]!==1))return{known:false,reason:'unsupported-parking-model-scale',dimensions};
    const b=dimensions.bounds;
    return{known:true,dimensions,length:2*Math.max(Math.abs(b[2]),Math.abs(b[5])),width:2*Math.max(Math.abs(b[0]),Math.abs(b[3])),feet:cached.feet,tyreBottomM:cached.tyreBottomM,localMinY:b[1],basis:'Actual native primary geometry/material tyre facets; complete emitted model bounds include all other parts'};
}

function worldMatrix(object){
    const chain=[];for(let o=object;o;o=o.parent)chain.push(o);
    const matrix=new THREE.Matrix4();for(const o of chain.reverse())matrix.multiply(o.matrixAutoUpdate===false?o.matrix:new THREE.Matrix4().compose(o.position,o.quaternion,o.scale));return matrix;
}
/** Exact already-emitted flat parking/sidewalk triangles, before any camera
 * selection. A selected private index is not silently treated as canonical.
 * No geometry, index, draw range, matrix or scene state is changed here.
 */
export function parkingSupportCatalog(world){
    const cells=new Map(),size=16,report={meshes:0,triangles:0,unsupported:[]},point=new THREE.Vector3(),sources=[];
    world?.group?.traverse?.(mesh=>{
        if(!mesh.isMesh||!(/^(pave|ground|road) /.test(mesh.name)))return;
        const g=mesh.geometry,p=g?.attributes?.position,c=mesh.userData?.cellFrustum;
        if(mesh.isInstancedMesh||!p||p.normalized||p.itemSize!==3||c?.updates>0||c&&g.index?.count!==c.sourceIndices){report.unsupported.push({mesh:mesh.name,reason:'unknown-or-camera-selected-parking-support-topology'});return;}
        const matrix=worldMatrix(mesh),index=g.index,start=g.drawRange.start||0,end=Math.min(index?.count??p.count,finite(g.drawRange.count)?start+g.drawRange.count:Infinity);report.meshes++;
        sources.push({mesh,g,p,index,positionVersion:p.version,indexVersion:index?.version,range:{...g.drawRange},matrix});
        for(let i=start;i+2<end;i+=3){
            const vertices=[0,1,2].map(k=>point.fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(matrix).toArray());
            const y=vertices[0][1];if(!vertices.every(v=>v.every(finite)&&Math.abs(v[1]-y)<1e-7))continue;
            const poly=vertices.map(v=>[v[0],v[2]]);if(Math.abs(cross(poly[0],poly[1],poly[2]))<1e-9)continue;
            const triangle={poly,y,mesh:mesh.name,triangle:i/3},x0=Math.min(...poly.map(p=>p[0])),x1=Math.max(...poly.map(p=>p[0])),z0=Math.min(...poly.map(p=>p[1])),z1=Math.max(...poly.map(p=>p[1]));
            // No unbounded giant plane rasterization. It is not a parking/sidewalk
            // support certificate; finite local triangles remain available.
            if((x1-x0)*(z1-z0)>4e6){report.unsupported.push({mesh:mesh.name,triangle:i/3,reason:'parking-support-index-work-bound'});continue;}
            for(let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)for(let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++){const key=x+','+z;let rows=cells.get(key);if(!rows)cells.set(key,rows=[]);rows.push(triangle);}report.triangles++;
        }
    });
    return{report,at(poly,y){
        if(sources.some(s=>s.mesh.geometry!==s.g||s.g.attributes.position!==s.p||s.g.index!==s.index||s.p.version!==s.positionVersion||s.index?.version!==s.indexVersion||s.mesh.userData.cellFrustum?.updates>0||s.g.drawRange.start!==s.range.start||s.g.drawRange.count!==s.range.count||!worldMatrix(s.mesh).equals(s.matrix)))return{valid:false,reason:'stale-or-camera-selected-parking-support'};
        const rows=new Set();for(let x=Math.floor(Math.min(...poly.map(p=>p[0]))/size);x<=Math.floor(Math.max(...poly.map(p=>p[0]))/size);x++)for(let z=Math.floor(Math.min(...poly.map(p=>p[1]))/size);z<=Math.floor(Math.max(...poly.map(p=>p[1]))/size);z++)for(const t of cells.get(x+','+z)||[])if(Math.abs(t.y-y)<1e-7)rows.add(t);
        let fragments=[poly.map(p=>[p[0],y,p[1]])],work=0;const pieces=[];
        for(const t of rows){if(++work>512)return{valid:false,reason:'parking-support-coverage-work-bound',work};fragments=fragments.flatMap(p=>subtractTramTrench(p,t.poly));pieces.push({mesh:t.mesh,triangle:t.triangle});if(!fragments.length)return{valid:true,y,pieces,work};if(fragments.length>128)return{valid:false,reason:'parking-support-fragment-work-bound',work};}
        return{valid:false,reason:'whole-parking-body-not-covered-by-actual-flat-support',work,uncovered:fragments.length};
    }};
}

