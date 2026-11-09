import * as THREE from '../../vendor/three.module.min.js';
import {inPoly,polyBox,rng} from './kit.js';
import {sourceCoastWater} from './source-coast-water.js';
import {compileSourceWaterFaces} from './source-water-faces.js';
import {waterMaterial,worldUV} from './scenes/sea-common.js';
import {parseMeasure} from '../building-roofs.js';
import {buildSpeciesTrees,speciesFromOSM,treeGeometries,SPECIES} from '../trees.js';
export function prepareContextWater(ctx,data,box){
    const coast=sourceCoastWater(data.coastlines,box);if(coast.unresolved.length||!coast.polygons.length)throw Error('Source coast coverage does not close the render frame');
    const nativeIds=new Set(ctx.data.areas.map(a=>a.id)),records=coast.polygons.map((r,i)=>({...r,id:'coast-frame-'+i,holes:coast.holes.filter(h=>inPoly(...h.poly[0],r.poly)).map(h=>h.poly),y:1-ctx.data.origin.elev,heightBasis:'Existing 1m mean-sea game estimate; tidal height/datum unmeasured',estimated:true})),unknown=[];
    for(const a of data.areas){const t=a.rawTags;if(!(t.natural==='water'||t.water)||nativeIds.has(a.id)&&a.id!=='r2793813')continue;
        const literal=parseMeasure(t.ele),samples=a.poly.map(([x,z])=>ctx.ground.sourceTerrain.heightAt(x,z)).filter(Number.isFinite).sort((a,b)=>a-b);
        if(!samples.length){unknown.push({id:a.id,reason:'source-water-height-unknown'});continue;}
        const y=literal!=null&&Number.isFinite(literal)?literal-ctx.data.origin.elev:samples[Math.floor(samples.length/2)];
        records.push({...a,y,sourceIds:[a.id],estimated:!Number.isFinite(literal),heightBasis:Number.isFinite(literal)?'Literal OSM ele in metres; source datum/time unknown; no datum conversion':'Median USGS boundary samples; unmeasured water-level estimate'});
    }
    const triangles=[];
    for(const r of records){const points=[r.poly,...(r.holes||[])],flat=points.flat(),indices=THREE.ShapeUtils.triangulateShape(r.poly.map(p=>new THREE.Vector2(...p)),(r.holes||[]).map(h=>h.map(p=>new THREE.Vector2(...p))));r.triangles=indices.map(ids=>ids.map(i=>flat[i].map(Math.fround)));triangles.push(...r.triangles);r.bounds=polyBox(r.poly);}
    const compiled=compileSourceWaterFaces(triangles),waterAt=(x,z)=>{for(const r of records){const b=r.bounds;if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&inPoly(x,z,r.poly)&&!(r.holes||[]).some(h=>inPoly(x,z,h)))return r.y;}return null;};
    return{coast,records,unknown,compiled,waterAt,box};
}
export function addSourceContextWater(ctx){
    const state=ctx.extras.sourceContext,w=state.water,group=new THREE.Group();group.name='literal-source-water';
    for(const r of w.records){const positions=[];for(const points of r.triangles){const[a,b,c]=points,flip=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0;for(const p of flip?[a,c,b]:points)positions.push(p[0],r.y,p[1]);}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();worldUV(g);const m=new THREE.Mesh(g,waterMaterial(ctx,{name:'source-water-'+r.id,color:r.id==='r2793813'?'#22383f':'#203540'}));m.name='water-source:'+r.id;m.userData.noFloor=true;m.userData.sourceIds=r.sourceIds;m.userData.heightBasis=r.heightBasis;m.receiveShadow=false;group.add(m);}
    ctx.add(group);state.water.group=group;
}
export function addSourceContextTrees(ctx,data){
    const state=ctx.extras.sourceContext,native=new Map(),key=(x,z)=>Math.round(x*10)+','+Math.round(z*10),reused=[],unknown=[],trees=[],G=treeGeometries();
    for(const[x,z]of ctx.data.trees)native.set(key(x,z),(native.get(key(x,z))||0)+1);
    const counts=new Map();for(const t of data.trees)counts.set(key(t.x,t.z),(counts.get(key(t.x,t.z))||0)+1);
    for(const t of data.trees){const k=key(t.x,t.z);if(native.get(k)===1&&counts.get(k)===1){reused.push(t.id);continue;}
        const water=state.water.waterAt(t.x,t.z),y=ctx.ground.terrainHeightAt(t.x,t.z);
        if(!Number.isFinite(y)||water!=null&&y<water){unknown.push({id:t.id,reason:'mapped-tree-support-not-modeled',x:t.x,z:t.z});continue;}
        const species=speciesFromOSM([t.tags.species,t.tags.genus,t.tags.leaf_type].filter(Boolean).join(' '))||'generic',height=parseMeasure(t.tags.height),nominal=G.shapes[SPECIES[species].shape].top;
        trees.push({id:t.id,x:t.x,z:t.z,y,s:height>0?height/nominal:1,species});
    }
    const built=buildSpeciesTrees(trees,{near:110,maxNear:160,chunk:800,cull:6500,castShadow:false,rng:rng(70519)}),eye=new THREE.Vector3();ctx.add(built.group);ctx.crownMeshes.push(...built.crownMeshes);ctx.onUpdate((dt,s)=>{const p=s.camera?.getWorldPosition?s.camera.getWorldPosition(eye):s.ctl?.position;if(p)built.update(p.x,p.z,p.y);});built.update(0,0);
    state.trees={sourceRecords:data.trees.length,rendered:trees.length,reusedNativeSourceIds:reused,unresolved:unknown,group:built.group,basis:'Literal mapped tree nodes; unique original 0.1m close-up quantization match reuses native tree. Missing dimensions/species use named nominal generic models; all far trees retained in LOD.'};
}
