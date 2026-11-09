import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../../game/vendor/three.module.min.js';
import {Ground,Painter,buildTerrain} from '../../game/src/spots/ground.js';
import {decodeSourceContext,sourceTerrainField} from '../../game/src/spots/source-context-data.js';
import {sourceCoastWater,joinSourceCoasts} from '../../game/src/spots/source-coast-water.js';
import {compileSourceWaterFaces,sourceFaceHeightAt} from '../../game/src/spots/source-water-faces.js';
import {prepareContextWater} from '../../game/src/spots/source-context-landscape.js';
import {paintSourceContext,buildSourceContextGround} from '../../game/src/spots/source-context-surface.js';
const coast=[{id:'w1',nodeRefs:[1,2],pts:[[0,-2],[0,0]]},{id:'w2',nodeRefs:[2,3],pts:[[0,0],[0,2]]}],box={x0:-1,z0:-1,x1:1,z1:1};
const water=sourceCoastWater(coast,box);assert.equal(water.unresolved.length,0);assert.equal(water.polygons.length,1);assert(water.polygons[0].poly.some(p=>p[0]===-1));assert(!water.polygons[0].poly.some(p=>p[0]===1));
const separate=structuredClone(coast);separate[1].nodeRefs[0]=99;assert.equal(joinSourceCoasts(separate).chains.length,2);assert(sourceCoastWater(separate,box).unresolved.length>0);
const mask=compileSourceWaterFaces([[[0,-10],[10,-10],[0,10]],[[0,10],[10,-10],[10,10]]]);
const input=[[-1,0,-1],[-1,2,1],[1,1,-1]],cut=mask.cut(input);assert(cut.length>0);for(const f of cut){const x=f.reduce((s,p)=>s+p[0]/3,0),z=f.reduce((s,p)=>s+p[2]/3,0);assert(!mask.contains(x,z));assert(sourceFaceHeightAt([f],x,z)!=null);}assert.equal(mask.cut([[1,0,-1],[1,0,1],[2,0,-1]]).length,0);
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}});globalThis.document={createElement:tag=>({width:0,height:0,getContext:()=>ctx2d()})};
const raw=JSON.parse(fs.readFileSync(process.argv[2])),reports=[];
for(const scene of ['seattle-center','pike-place']){
    const native=JSON.parse(fs.readFileSync(`game/data/spots/${scene}.json`)),data=decodeSourceContext(raw,native),g=new Ground(native.terrain),field=sourceTerrainField(raw.terrain,native.origin,native.projection),state={},ctx={data:native,ground:g,painter:new Painter(),extras:{sourceContext:state},terrainOpts:{outerPad:0,innerStep:2},scene:new THREE.Scene(),add(o){this.scene.add(o);}};
    g.sourceTerrain={heightAt:field.heightAt,transitionM:native.terrain.d};state.water=prepareContextWater(ctx,data,{x0:-4000,z0:-3600,x1:4000,z1:3600});paintSourceContext(ctx,data);
    state.water.compiled.trace=[];
    const started=performance.now(),result=buildSourceContextGround(ctx,{pixels:8}),built=performance.now(),ray=new THREE.Raycaster();ctx.scene.updateMatrixWorld(true);let faces=0,badQueries=[],wetCentroids=[],maxRayError=0;
    for(const m of result.group.children){const p=m.geometry.attributes.position,idx=m.geometry.index.array;for(let i=0;i<idx.length;i+=3){const f=[...idx.slice(i,i+3)].map(k=>[p.getX(k),p.getY(k),p.getZ(k)]),x=(f[0][0]+f[1][0]+f[2][0])/3,z=(f[0][2]+f[1][2]+f[2][2])/3,expected=(f[0][1]+f[1][1]+f[2][1])/3,actual=result.physical(x,z);faces++;
            if(!Number.isFinite(actual)||Math.abs(actual-expected)>1e-5)badQueries.push({face:f,x,z,expected,actual});
            if(state.water.compiled.contains(x,z))wetCentroids.push({face:f,x,z});
            if(faces%503===0){ray.set(new THREE.Vector3(x,1000,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(m,false)[0];assert(hit);maxRayError=Math.max(maxRayError,Math.abs(hit.point.y-actual));}
        }}
    buildTerrain(g,ctx.painter,{inner:result.nativeInner,outer:result.nativeInner,innerPx:8,outerPx:8,innerStep:2,outerStep:8,skirt:0});let seamVertices=0,derivedSeamMaxErrorM=0;
    for(const m of result.group.children){const p=m.geometry.attributes.position,b=result.nativeInner;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if((x===b.x0||x===b.x1)&&z>=b.z0&&z<=b.z1||(z===b.z0||z===b.z1)&&x>=b.x0&&x<=b.x1){
        if(Number.isInteger((x-b.x0)/2)&&Number.isInteger((z-b.z0)/2)){assert.equal(Math.fround(g.renderedHeightAt(x,z)),p.getY(i));seamVertices++;}else derivedSeamMaxErrorM=Math.max(derivedSeamMaxErrorM,Math.abs(g.renderedHeightAt(x,z)-p.getY(i)));}}}
    const report={scene,faces,badQueries:badQueries.length,wetCentroids:wetCentroids.length,maxRayError,nativeSeamSourceVerticesExact:seamVertices,derivedWaterClipSeamMaxErrorM:derivedSeamMaxErrorM,buildMs:built-started,elapsedMs:performance.now()-started,serialization:state.water.compiled.serialization,waterPolygons:state.water.records.length,sourceCoastWays:data.coastlines.length,coastIssues:state.water.coast.unresolved};reports.push(report);
    if(badQueries.length||wetCentroids.length){fs.writeFileSync(`/workspace/reality-pass/seattle-source-context/${scene}-surface-failures.json`,JSON.stringify({report,badQueries,wetCentroids,trace:state.water.compiled.trace}));throw Error(JSON.stringify(report));}
    assert(maxRayError<1e-6);
}
console.log(JSON.stringify({syntheticSourceIdentityAndWaterControls:8,reports,scope:'Geometry-only CPU. Source ground mesh/query/triangle union; no actual browser pixels, authored scene routes or cold-load acceptance.'},null,2));
