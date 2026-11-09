// Independent adapter for QA's lossless native export. No Traffic/model/fitter
// imports; only the independently owned typed-buffer decoder is consumed.
import {inverseAffine,transform,IDENTITY,auditTramBody,makeSourceSupportLookup} from './body-checks.js';
import {auditRailBinding,independentRailDirections} from '../unirii-pedestrian-recovery/rail-binding-checks.js';
const box=ps=>({min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i])))});
const overlap=(a,b)=>a.min.every((v,i)=>v<=b.max[i]&&a.max[i]>=b.min[i]);
const key=tri=>tri.map(p=>p.map(Math.fround).join(',')).sort().join(';');
const numeric=v=>typeof v==='number'?v:null;
const edgeId=r=>r.edge?.id??r.edgeId;
const graphEdge=e=>({...e,a:{...e.a,orderedEdgeIds:e.a.edgeIds},b:{...e.b,orderedEdgeIds:e.b.edgeIds}});
const node=n=>({...n,orderedEdgeIds:n.edgeIds,motorSourceNodeId:n.motorNodeId==null?null:n.sourceId});

/** A complete index is built before any body query. Huge triangles use a
 * separate always-queried list; they are never dropped for a hash-cell limit. */
export class TriangleIndex {
    constructor(size=16){this.size=size;this.cells=new Map();this.large=[];this.triangles=0;this.meshes=new Set();}
    add(id,triangles,metadata={}){
        this.meshes.add(id);
        for(let i=0;i<triangles.length;i++){
            const points=triangles[i],bounds=box(points),record={id,triangle:i,points,bounds,metadata};this.triangles++;
            const x0=Math.floor(bounds.min[0]/this.size),x1=Math.floor(bounds.max[0]/this.size),z0=Math.floor(bounds.min[2]/this.size),z1=Math.floor(bounds.max[2]/this.size);
            if((x1-x0+1)*(z1-z0+1)>64){this.large.push(record);continue;}
            for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(record);}
        }
    }
    query(bounds){
        const found=new Set(this.large);for(let x=Math.floor(bounds.min[0]/this.size);x<=Math.floor(bounds.max[0]/this.size);x++)for(let z=Math.floor(bounds.min[2]/this.size);z<=Math.floor(bounds.max[2]/this.size);z++)for(const r of this.cells.get(x+','+z)||[])found.add(r);
        const grouped=new Map();for(const r of found)if(overlap(bounds,r.bounds)){if(!grouped.has(r.id))grouped.set(r.id,{id:r.id,kind:'native-world-mixed-batch',...r.metadata,triangles:[],nativeTriangleIds:[]});const g=grouped.get(r.id);g.triangles.push(r.points);g.nativeTriangleIds.push(r.triangle);}
        return [...grouped.values()];
    }
}

export function prepareRecordedContext({world,scene,facts,reviewedModels,decoder,modelPinsVerified=false}){
    const gaps=[],exclusions=[],index=new TriangleIndex(),worldObjects=scene.objects.filter(o=>o.parentChain?.some(p=>p.name==='world'));
    const frame=worldObjects.flatMap(o=>o.parentChain||[]).find(p=>p.name==='world')?.matrixWorld||IDENTITY,inverse=inverseAffine(frame);
    if(!inverse)throw Error('Unsupported source world matrix');
    const pieces=(world.supportPieces||[]).map(p=>({...p,bandSamples:(p.nativeBandSamples?.values||[]).filter(s=>s.radius===0).map(s=>({u:s.u,top:numeric(s.band?.top),bottom:numeric(s.band?.bottom)})),renderedTopTriangles:[]}));
    const wanted=new Map();for(const p of pieces)for(const t of [[0,1,2],[0,1,3],[0,2,3],[1,2,3]].map(ids=>ids.map(i=>p.top?.[i])))if(t.every(Array.isArray)){const k=key(t);if(!wanted.has(k))wanted.set(k,[]);wanted.get(k).push(p);}
    const expectedMeshIds=[];
    for(const object of worldObjects){
        // These named layers are visual paint/light/water/foliage, not native
        // solid bodies. Their complete raw buffers remain in the QA export.
        if(/^(marks|spill|treeCrowns|water|grass|pave|sport|area)( |$)/.test(object.name)||object.materials?.some(m=>m.name==='shop-spill')){exclusions.push({id:object.uuid,name:object.name,reason:'explicit-native-nonsolid-render-layer; raw geometry retained'});continue;}
        expectedMeshIds.push(object.uuid);
        try{
            const geometry=scene.geometries[object.geometryId];if(geometry?.isInstancedBufferGeometry&&!object.isInstancedMesh)throw Error('Unresolved custom native shader instancing');
            const parts=decoder.meshParts(scene,object),triangles=[];
            for(const part of parts)for(const triangle of decoder.triangles(part,{respectDrawRange:false})){
                const t=triangle.vertices.map(p=>transform(inverse,p));triangles.push(t);
                for(const piece of wanted.get(key(t))||[])piece.renderedTopTriangles.push(t);
            }
            if(!triangles.length)throw Error('Empty native solid geometry');
            index.add(object.uuid,triangles,{name:object.name});
        }catch(error){gaps.push({type:'unsupported-native-solid-buffer',meshId:object.uuid,name:object.name,error:String(error)});}
    }
    if(!worldObjects.length)gaps.push({type:'missing-complete-native-world-mesh-inventory'});
    if(!modelPinsVerified)gaps.push({type:'reviewed-model-source-hashes-not-verified-against-native-archive'});
    if(facts.observerErrors?.length)gaps.push(...facts.observerErrors.map(e=>({type:'native-capture-error',...e})));
    const shared={data:world.data,pieces,reviewedModels,nativeMotorEdges:world.allEdges},lookup=makeSourceSupportLookup(shared);
    gaps.push(...lookup.catalogue.issues.map(x=>({type:'independent-support-catalogue',...x})));
    const missingDirections=new Set();
    for(const snapshot of facts.snapshots||[])for(const e of snapshot.tramNetwork?.edges||[])if(e.rail&&!Array.isArray(e.railDirections))missingDirections.add(e.id);
    const declarationGaps=missingDirections.size?[{type:'unrecorded-native-rail-direction-declarations',edgeIds:[...missingDirections],scope:'Current legal direction reconstructed independently from raw source tags for body attribution only; not recorded native graph permissions.'}]:[];
    const complete=expectedMeshIds.every(id=>index.meshes.has(id))&&!gaps.length;
    function body(record,options){
        const geometry=scene.geometries[record.model?.primaryGeometryId],raw=record.mesh;
        if(!geometry||!raw?.matrixWorld)return{passed:false,issues:[],coverageGaps:[{reason:'missing-actual-current-tram-primary-buffer-or-matrix'}],witnesses:[]};
        let p;try{p=decoder.geometryPart(geometry,raw.matrixWorld);}catch(error){return{passed:false,issues:[],coverageGaps:[{reason:'unsupported-actual-primary-tram-buffer',error:String(error)}],witnesses:[]};}
        const positions=Array.from({length:p.positions.count},(_,i)=>p.positions.get(i)),indices=p.indices?Array.from(p.indices):undefined;
        const total=indices?.length||positions.length,part={id:record.mesh.uuid,positions,indices,matrixWorld:raw.matrixWorld,drawRange:{start:p.drawRange.start,count:p.drawRange.countIsUnbounded?total:p.drawRange.count}};
        const points=positions.map(v=>transform(inverse,transform(raw.matrixWorld,v))),bounds=box(points),solids=index.query(bounds),models=new Set();
        for(const off of[0,record.length/2,-record.length/2,record.length*.36,-record.length*.36]){const v=options.samplePath(off);if(v?.grade?.modelId)models.add(v.grade.modelId);}
        const snapshot={...shared,frameMatrix:frame,actor:{...record,matrixWorld:raw.matrixWorld},parts:[part],sourceSpanKnown:!!options.samplePath(record.length/2)&&!!options.samplePath(-record.length/2),expectedModelIds:[...models],solids,staticCoverageComplete:complete,staticCoverage:{expectedSolidIds:solids.map(s=>s.id),unclassifiedIds:gaps.map(g=>g.meshId||g.type),nativeFullMeshCount:expectedMeshIds.length,nativeFullTriangleCount:index.triangles,query:'complete immutable triangle index; no camera/draw-distance filtering'}};
        const result=auditTramBody(snapshot,{...options,sourceCatalogue:lookup.catalogue});result.nativeStaticQuery={meshes:solids.length,triangles:solids.reduce((n,s)=>n+s.triangles.length,0),completeWorldMeshCount:expectedMeshIds.length,completeWorldTriangleCount:index.triangles};return result;
    }
    function auditPhase(snapshot){
        const records=[...(snapshot.active||[]),...(snapshot.pool||[])],trams=records.filter(v=>v.tramDetected),byId=new Map(trams.map(v=>[v.id,v])),pre=facts.snapshots.find(s=>s.phase==='after-original-spawnAll-before-binding');
        const actors=trams.map(v=>({...v,edgeId:v.edge.id,pitch:v.meshPose?.rotation?.[0],roll:v.meshPose?.rotation?.[2],route:(v.route||[]).map(r=>({edgeId:edgeId(r),dir:r.dir})),hist:(v.hist||[]).map(r=>({edgeId:edgeId(r),dir:r.dir})),stop:{servedSourceNodeId:v.servedRailStop,servedOdo:v.servedRailStopOdo,dwell:v.dwell,stopWhy:v.stopWhy,stopDistance:v.stopD,zeroWhy:v.zeroWhy}}));
        const declared=e=>Array.isArray(e.railDirections)?e.railDirections:independentRailDirections(world.data,e.sourceId);
        const graph=snapshot.tramNetwork||{nodes:[],edges:[]},source={data:world.data,graph:{nodes:(graph.nodes||[]).map(node),edges:(graph.edges||[]).map(e=>({...graphEdge(e),railDirections:declared(e),directionDeclarationObserved:Array.isArray(e.railDirections)}))},motorGraph:{nodes:world.graphNodes.map(node),edges:world.allEdges.filter(e=>world.graphEdgeIds.includes(e.id)).map(graphEdge)},tramMotorCrossings:snapshot.tramMotorCrossings,binding:snapshot.initialTramBinding,constructorTramIds:pre?[...pre.active,...pre.pool].filter(v=>v.tramDetected).map(v=>v.id):[],actors,admissionMode:{passed:snapshot.initialAdmission?.passed,invalidRailModes:snapshot.initialAdmission?.invalidRailModes},allActorModes:records.map(v=>({id:v.id,tram:v.tramDetected,edgeId:v.edge.id,rail:v.edge.rail,dir:v.dir,publicTram:v.edge.publicTram,throughTram:v.edge.throughTram,publicDrive:v.edge.publicDrive,throughAccess:v.edge.throughAccess,railDirections:declared(v.edge)}))};
        const result=auditRailBinding(source,{stage:snapshot.phase==='after-original-source-binding-before-initial-admission'?'publication':'motion',requireFinalModes:true,sourceGradeAt:lookup.heightAt,bodyAudit:(v,opt)=>body(byId.get(v.id),opt)});
        if(gaps.length||declarationGaps.length){result.passed=false;result.coverageGaps.push(...gaps,...declarationGaps);}return{phase:snapshot.phase,nativeTime:snapshot.nativeTime,nativeFrame:snapshot.nativeFrame,...result};
    }
    return{auditPhase,body,index,lookup,frameMatrix:frame,summary:{complete,worldMeshCount:expectedMeshIds.length,decodedMeshCount:index.meshes.size,worldTriangles:index.triangles,largeTrianglesAlwaysQueried:index.large.length,rawSupportPieces:pieces.length,independentSupportPieces:lookup.catalogue.pieces.length,gaps,declarationGaps,exclusions}};
}
