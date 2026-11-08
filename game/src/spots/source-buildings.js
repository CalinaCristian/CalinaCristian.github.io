// Tourist contexts use the same source solids and roof profiles as the street
// worlds. Source identity, footprint and literal metre height are immutable.
import * as THREE from '../../vendor/three.module.min.js';
import { footprintCells, footprintCoverage, bakeAssembly, bakeSurface, touchingSolids, ringArea, exposedWall } from '../building-parts.js';
import { makeRoofProfile, roofMesh, visibleRoofMesh, parseMeasure } from '../building-roofs.js';

export const SOURCE_BUILDING_VERSION = 1;
const types = {house:7.5,detached:7.5,garage:3,shed:2.8,roof:4,apartments:13,residential:11,commercial:9,retail:6,office:18,industrial:8,warehouse:8,church:14,school:9,hotel:20,kiosk:3,toilets:3.5,service:4};
const positive = x => Number.isFinite(x) && x > 0;
export function sourceBuildingHeight(b) { const h=parseMeasure(b.h),estimate=parseMeasure(b.estimatedHeight);return positive(h)?h:positive(+b.lv)?+b.lv*3.2+.8:positive(estimate)?estimate:positive(+b.estimatedLevels)?+b.estimatedLevels*3.2+.8:types[b.k]??8; }
export function triangulateSource(ring, holes = []) {
    const contour=ring.map(p=>new THREE.Vector2(...p)), inner=holes.map(h=>h.map(p=>new THREE.Vector2(...p)));
    return {pts:[...ring,...holes.flat()],tris:THREE.ShapeUtils.triangulateShape(contour,inner)};
}
export function sourceBuildingProfile(b, { house = false, heightScale = 1 } = {}) {
    const bodyHeight=sourceBuildingHeight(b)*heightScale, rawMin=parseMeasure(b.minH), minHeight=Number.isFinite(rawMin)?Math.max(0,rawMin):positive(+b.minLv)?+b.minLv*3.2:b.k==='roof'?Math.max(0,bodyHeight-.18):0;
    const explicit=positive(parseMeasure(b.h)),levels=positive(+b.lv),minimumOnly=!explicit&&!levels&&(Number.isFinite(rawMin)||positive(+b.minLv));
    const height=minimumOnly?(minHeight+(b.k==='roof'?.18:bodyHeight)):bodyHeight;
    const tags={...(b.roofTags||{}),...(b.roof?{'roof:shape':b.roof}:{}),...(b.roofH!=null?{'roof:height':b.roofH}:{}),...(b.h!=null?{height:b.h}:{}),...(b.lv!=null?{'building:levels':b.lv}:{}),...(b.minH!=null?{min_height:b.minH}:{}),...(b.minLv!=null?{'building:min_level':b.minLv}:{})};
    const profile=makeRoofProfile({tags,ring:b.poly,holes:b.holes||[],triangulate:triangulateSource,shape:b.roof||b.estimatedRoof||(house?'hipped':'flat'),height,minHeight,heightIsTotal:true,heightSource:explicit?'OSM height':levels?'building:levels estimate':b.estimatedHeight||b.estimatedLevels?'scene massing estimate':minimumOnly?'building type estimate above source minimum':'building type estimate'});
    return {height:profile.totalM,minHeight,profile};
}
const bounds = ring => [Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
const within=(a,b)=>a[0]>=b[0]-.001&&a[1]>=b[1]-.001&&a[2]<=b[2]+.001&&a[3]<=b[3]+.001;

// A scene model may replace declared source buildings and their fully
// contained parts. Scenery masks and distance from an anchor are not evidence
// that a neighbouring building belongs to that model.
export function sourceHeroMembers(buildings, declared) {
    const ids=new Set(declared),parents=buildings.filter(b=>ids.has(b.id)&&!b.part&&b.poly?.length>=3).map(b=>({...b,bounds:bounds(b.poly)}));
    for(const part of buildings){
        if(ids.has(part.id)||!part.part||part.poly?.length<3)continue;
        const pb=bounds(part.poly),candidates=parents.filter(b=>within(pb,b.bounds)&&footprintCoverage(b.poly,[part.poly]).outside<=.001&&(!b.holes?.length||footprintCoverage(part.poly,b.holes).uncovered>=Math.abs(ringArea(part.poly))-.001));
        if(candidates.length===1)ids.add(part.id);
    }
    return ids;
}

/** Source-keyed complete/partial assemblies; no sample-overlap admission. */
export function sourceBuildingPlan(records) {
    const stats={sourceRecords:records.length,sourceIds:records.map(r=>r.source.id),literalHeights:records.filter(r=>positive(parseMeasure(r.source.h))).length,levelHeightEstimates:records.filter(r=>!positive(parseMeasure(r.source.h))&&positive(+r.source.lv)).length,typeHeightEstimates:records.filter(r=>!positive(parseMeasure(r.source.h))&&!positive(+r.source.lv)).length,assemblies:[],dropped:0,inset:0,issues:[]},bases=records.filter(r=>!r.source.part&&!r.holes.length&&r.minHeight===0),parents=new Map();
    for(const part of records){
        if(!part.source.part||part.holes.length||part.source.layer||!(parseMeasure(part.source.h)>0||part.source.lv>0))continue;
        const candidates=[];for(const base of bases){if(!within(part.bounds,base.bounds))continue;const c=footprintCoverage(base.ring,[part.ring]);if(c.outside<=.001)candidates.push(base);}
        if(candidates.length===1)parents.set(part,candidates[0]);
    }
    const volumes=[];
    for(const base of bases){
        const parts=[...parents].filter(([,p])=>p===base).map(([p])=>p);if(!parts.length)continue;
        const ground=parts.filter(p=>p.minHeight===0),coverage=footprintCoverage(base.ring,parts.map(p=>p.ring)),groundCoverage=footprintCoverage(base.ring,ground.map(p=>p.ring));
        const complete=ground.length>0&&coverage.uncovered<=coverage.area*.1&&(groundCoverage.uncovered<=groundCoverage.area*.1||coverage.uncovered<=coverage.area*.0001);
        if(!complete&&base.profile.shape!=='flat')continue;
        const residual=parseMeasure(base.source.h)>0||!ground.length?base.profile.eavesM:Math.min(...ground.map(p=>p.profile.eavesM));
        for(const part of parts)part.datum=base.datum;
        const relative=r=>({i:r.i,ring:r.ring,h:r.profile.eavesM,minH:r.minHeight});
        const baked=bakeAssembly(relative(base),parts.map(relative),residual,coverage.uncovered<=coverage.area*.0001,!complete);
        base.assembled=complete;base.assembly=true;parts.forEach(p=>p.assembly=true);
        for(const cell of baked.residuals)volumes.push({i:records.length+volumes.length,source:base.source,owner:base,ring:cell.ring,holes:[],minH:base.bottom,h:base.datum+cell.h,roofTop:base.datum+cell.h,residual:true});
        stats.assemblies.push({source:base.source.id,parts:parts.map(p=>p.source.id),mode:complete?'parts':'union',coverage:1-coverage.uncovered/coverage.area,residuals:baked.residuals.length,residualHeight:residual});
    }
    for(const r of records){
        if(r.assembled)continue;
        const volume={i:r.i,source:r.source,owner:r,ring:r.ring,holes:r.holes,minH:r.minHeight>0?r.datum+r.minHeight:r.bottom,h:r.datum+r.profile.eavesM,roofTop:r.datum+r.height};
        if(volume.h<volume.minH-1e-7){stats.issues.push({source:r.source.id,issue:'minimum height exceeds eaves'});continue;}
        volumes.push(volume);
    }
    // Hole-bearing solids are split into exact physical cells for visibility
    // tests. The source ring remains the roof and collision identity.
    const physical=[];
    for(const v of volumes){if(!v.holes.length)physical.push(v);else for(const c of footprintCells(v.ring,v.holes).filter(c=>!c.covered.length))physical.push({...v,i:records.length+volumes.length+physical.length,ring:c.ring,holes:[],cell:true});}
    const grid=new Map();for(const v of physical){const b=bounds(v.ring);for(let x=Math.floor(b[0]/32);x<=Math.floor(b[2]/32);x++)for(let z=Math.floor(b[1]/32);z<=Math.floor(b[3]/32);z++){const k=x+','+z,a=grid.get(k)||[];a.push(v);grid.set(k,a);}}
    const neighbours=v=>{const b=bounds(v.ring),seen=new Set(),out=[];for(let x=Math.floor(b[0]/32);x<=Math.floor(b[2]/32);x++)for(let z=Math.floor(b[1]/32);z<=Math.floor(b[3]/32);z++)for(const p of grid.get(x+','+z)||[]){if(p===v||p.owner===v.owner&&!p.residual&&!v.residual||seen.has(p))continue;seen.add(p);if(touchingSolids({...v,h:v.roofTop}, {...p,h:p.roofTop}))out.push(p);}return out;};
    for(const v of volumes){
        const near=neighbours(v);v.neighbours=near;
        // Shared helpers work in non-negative source-height bands. Rebase the
        // local absolute terrain datum, then restore exact world heights.
        const shift=Math.min(v.minH,...near.map(n=>n.minH),0)-1,local=r=>({...r,minH:r.minH-shift,h:r.h-shift}),others=near.map(local),localOwner=local(v);
        v.surface=bakeSurface(localOwner,[localOwner,...others]);
        v.surface.walls=v.surface.walls.map(bands=>bands.map(f=>({...f,y0:f.y0+shift,y1:f.y1+shift})));
        v.holeWalls=v.holes.map(ring=>{const sign=-Math.sign(ringArea(ring));return ring.map((a,k)=>{const b=ring[(k+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return exposedWall(a,b,v.minH-shift,v.h-shift,sign*(b[1]-a[1])/length,-sign*(b[0]-a[0])/length,others,v.i).map(f=>({...f,y0:f.y0+shift,y1:f.y1+shift}));});});
        if(v.holes.length){v.surface.roof=footprintCells(v.ring,[...v.holes,...near.filter(n=>n.minH<=v.h&&n.h>=v.h).map(n=>n.ring)]).filter(c=>!c.covered.length).map(c=>c.ring);}
        if(v.residual){const t=triangulateSource(v.ring);v.mesh={faces:t.tris.map(f=>f.map(i=>[t.pts[i][0],v.h,t.pts[i][1]])),walls:[],wallNormals:[]};}
        else{v.mesh=roofMesh(v.ring,v.holes,v.owner.profile,triangulateSource);v.mesh={...v.mesh,faces:v.mesh.faces.map(t=>t.map(p=>[p[0],p[1]+v.owner.datum,p[2]])),walls:v.mesh.walls.map(t=>t.map(p=>[p[0],p[1]+v.owner.datum,p[2]]))};}
    }
    for(const v of volumes){
        const near=[...new Set(v.neighbours.map(n=>volumes.find(v=>v.i===n.i)||volumes.find(v=>v.owner===n.owner&&!v.residual)).filter(Boolean))];
        v.visibleRoof=visibleRoofMesh(v.mesh,{i:v.i},near.map(n=>({i:n.i,minH:n.minH,mesh:n.mesh||{faces:[]}})));
    }
    return {volumes,stats};
}
export function sourceRecord(source,i,ground,{house=false,heightScale=1}={}) {
    const ring=source.poly,holes=(source.holes||[]).filter(h=>h.length>=3),dims=sourceBuildingProfile(source,{house,heightScale});let lo=Infinity,hi=-Infinity;
    const sample=(x,z)=>{const h=ground.heightAt(x,z);lo=Math.min(lo,h);hi=Math.max(hi,h);};
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],n=Math.max(1,Math.min(24,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.5)));for(let k=0;k<n;k++)sample(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);}
    if(ground.waterY!=null&&hi<ground.waterY+.6)hi=ground.waterY+.6;
    return{source,i,ring,holes,bounds:bounds(ring),...dims,datum:hi,sourceDatum:hi,bottom:lo-.6};
}

// Bake once against the actual scene's terrain and hero exclusions. Loading
// validates every active source ring, hole, height/profile and terrain datum;
// stale caches cannot erase or displace a source member. Normal visits do no
// planar subdivision; the dev baker owns that work.
export function sourcePlanSignature(records) {
    return JSON.stringify(['spot-source-solids',SOURCE_BUILDING_VERSION,records.map(r=>[r.i,r.source.id,r.ring,r.holes,r.height,r.minHeight,r.profile,r.sourceDatum,r.bottom])],(k,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);
}
export function packSourcePlan(records, plan) {
    return compactSourceCache({version:SOURCE_BUILDING_VERSION,signature:sourcePlanSignature(records),stats:plan.stats,volumes:plan.volumes.map(v=>({i:v.i,owner:v.owner.i,source:v.source.id,datum:v.owner.datum,...(v.residual?{residual:true,ring:v.ring}:{}),minH:v.minH,h:v.h,roofTop:v.roofTop,surface:v.surface,holeWalls:v.holeWalls,visibleRoof:v.visibleRoof}))});
}
// Reuse exact points; no coordinate quantization or source simplification.
export function compactSourceCache(cache) {
    if(cache.encoding)return cache;
    const points2=[],points3=[],maps=[new Map(),new Map()],point=(p,three=false)=>{const a=three?points3:points2,m=maps[three?1:0],key=p.join(',');if(!m.has(key)){m.set(key,a.length);a.push(p);}return m.get(key);};
    const ring=r=>r.map(p=>point(p)),bands=rows=>rows.map(row=>row.map(f=>[f.t0,f.t1,f.y0,f.y1]));
    const volumes=cache.volumes.map(v=>({...v,...(v.residual?{ring:ring(v.ring)}:{}),surface:{walls:bands(v.surface.walls),roof:v.surface.roof.map(ring),underside:v.surface.underside.map(ring)},holeWalls:v.holeWalls.map(bands),visibleRoof:{faces:v.visibleRoof.faces.map(f=>f.map(p=>point(p,true))),walls:v.visibleRoof.walls.map(f=>({...f,vertices:f.vertices.map(p=>point(p,true))}))}}));
    return {...cache,encoding:'indexed-points-v1',points2,points3,volumes};
}
function unpackSourceVolumes(cache) {
    if(cache.encoding!=='indexed-points-v1')return cache.volumes;
    const ring=r=>r.map(i=>cache.points2[i]),face=f=>f.map(i=>cache.points3[i]),bands=rows=>rows.map(row=>row.map(([t0,t1,y0,y1])=>({t0,t1,y0,y1})));
    return cache.volumes.map(v=>({...v,...(v.residual?{ring:ring(v.ring)}:{}),surface:{walls:bands(v.surface.walls),roof:v.surface.roof.map(ring),underside:v.surface.underside.map(ring)},holeWalls:v.holeWalls.map(bands),visibleRoof:{faces:v.visibleRoof.faces.map(face),walls:v.visibleRoof.walls.map(f=>({...f,vertices:face(f.vertices)}))}}));
}
export function resolveSourcePlan(records, cache) {
    const byId=new Map(records.map(r=>[r.i,r]));
    if(cache?.version===SOURCE_BUILDING_VERSION&&cache.signature===sourcePlanSignature(records)&&Array.isArray(cache.volumes)&&cache.volumes.every(v=>Number.isFinite(v.datum)&&byId.get(v.owner)?.source.id===v.source)) {
        const volumes=unpackSourceVolumes(cache).map(v=>{const owner=byId.get(v.owner);owner.datum=v.datum;return{...v,source:owner.source,owner,ring:v.residual?v.ring:owner.ring,holes:v.residual?[]:owner.holes};});
        return {volumes,stats:cache.stats,cacheHit:true,geometryCache:cache};
    }
    const plan=sourceBuildingPlan(records);return {...plan,cacheHit:false,geometryCache:packSourcePlan(records,plan)};
}
