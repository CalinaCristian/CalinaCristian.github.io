#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { preserveReviewedSourceContext, retainedSourceLevelEstimate, retainedSourceInferredBuildingModel } from './source-return-context.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const reports=[];const test=(name,fn)=>{fn();reports.push(name);};
const fixture=()=>{
    const survey=Buffer.from(JSON.stringify({_retention:'all-measured',trees:[[0,0,2]]}));
    const proj={lat0:0,lon0:0,mPerLat:1,mPerLon:1,scale:1};
    return {survey,doc:{proj,areaKinds:['water'],strings:[],areas:[],areaSourceIds:[],trees:[],treeInfo:[],treeCrownRadii:[],
        treeRetention:{policy:'all-measured',inputCrowns:1,retained:0,rejectedGeometryOrDuplicate:1,outsideSurveyDistrict:0,thinned:0}},
        review:{schema:1,projection:proj,sourceDataCommit:'a'.repeat(40),sourceDataSha256:'b'.repeat(64),surveySha256:sha(survey),
            waterAreas:[{sourceId:'w1',kind:'water',name:'Source lake',ringsDm:[[0,0,100,0,0,100]]}],
            measuredCrowns:[{surveyIndex:0,rawSurveyCrown:[0,0,2],packed:[0,0,142],treeInfo:[-1,0,37],crownRadiusDm:20}]}};
};
const modelFixture=()=>{
    const f=fixture(),ring=[[0,0],[0,1],[1,0],[0,0]],tags={building:'yes','roof:shape':'gabled'};
    f.review.inferredBuildingModels=[{sourceId:'w10',sourceTags:{...tags},sourceRingLL:ring,sourceHolesLL:[],style:'eclectic',wallHeightM:12.8}];
    return {...f,source:{sourceId:'w10',tags:{...tags},sourceRingLL:ring,sourceHolesLL:[],heightM:NaN}};
};
test('new road context cannot change an identical-source fallback building model',()=>{
    const f=modelFixture(),before=JSON.stringify(f),random=Math.random;Math.random=()=>{throw Error('RNG');};
    try {assert.deepEqual(retainedSourceInferredBuildingModel(f.review,f.source),{style:'eclectic',wallHeightM:12.8});}
    finally {Math.random=random;}
    assert.equal(JSON.stringify(f),before);
    assert.equal(retainedSourceInferredBuildingModel(f.review,{...f.source,sourceId:'w11'}),null);
});
test('literal and new research height/storey/roof annotations win over an old fallback',()=>{
    const f=modelFixture();
    for(const tags of [{...f.source.tags,height:'20'},{...f.source.tags,'building:levels':'6'},
        {...f.source.tags,min_height:'3'},{...f.source.tags,'building:min_level':'1'},
        {...f.source.tags,__originalTags:f.source.tags,'roof:shape':'flat'},
        {...f.source.tags,__hRes:2}]) assert.equal(retainedSourceInferredBuildingModel(f.review,{...f.source,tags}),null);
    assert.equal(retainedSourceInferredBuildingModel(f.review,{...f.source,heightM:11}),null);
});
test('identical prior research facade annotation is retained; new annotation wins',()=>{
    const f=modelFixture(),raw={...f.source.tags};
    f.review.inferredBuildingModels[0].modelInputTags={...raw,'building:colour':'#cfc1a8'};
    f.source.tags={...raw,'building:colour':'#cfc1a8',__originalTags:raw};
    assert.equal(retainedSourceInferredBuildingModel(f.review,f.source).wallHeightM,12.8);
    f.source.tags['building:colour']='#aabbcc';assert.equal(retainedSourceInferredBuildingModel(f.review,f.source),null);
});
test('changed literal tags, outer or courtyard cannot reuse prior fallback',()=>{
    const f=modelFixture();
    for(const source of [{...f.source,tags:{...f.source.tags,building:'apartments'}},
        {...f.source,sourceRingLL:[[0,0],[0,2],[1,0],[0,0]]},
        {...f.source,sourceHolesLL:[[[.1,.1],[.1,.2],[.2,.1],[.1,.1]]]}])
        assert.equal(retainedSourceInferredBuildingModel(f.review,source),null);
});
test('a prior fallback style cannot replace an unchanged literal height',()=>{
    const f=modelFixture(),record=f.review.inferredBuildingModels[0];delete record.wallHeightM;
    record.sourceTags.height='24';f.source.tags.height='24';f.source.heightM=24;
    assert.deepEqual(retainedSourceInferredBuildingModel(f.review,f.source),{style:'eclectic'});
    f.source.tags.height='25';assert.equal(retainedSourceInferredBuildingModel(f.review,f.source),null);
});
test('reviewed fallback roof is retained only while source and measured roof remain unknown',()=>{
    const f=modelFixture();delete f.source.tags['roof:shape'];delete f.review.inferredBuildingModels[0].sourceTags['roof:shape'];
    const record=f.review.inferredBuildingModels[0];record.roof='gabled';
    assert.deepEqual(retainedSourceInferredBuildingModel(f.review,f.source),{style:'eclectic',wallHeightM:12.8,roof:'gabled'});
    assert.deepEqual(retainedSourceInferredBuildingModel(f.review,{...f.source,roofKnown:true}),{style:'eclectic',wallHeightM:12.8},'current aerial or researched roof wins');
    f.source.tags['roof:shape']='flat';assert.equal(retainedSourceInferredBuildingModel(f.review,f.source),null,'new literal roof invalidates unchanged-evidence model');
    record.sourceTags['roof:shape']='flat';assert.deepEqual(retainedSourceInferredBuildingModel(f.review,f.source),{style:'eclectic',wallHeightM:12.8},'even a matching literal roof cannot be replaced by a fallback');
    record.roof='unknown-shape';assert.throws(()=>retainedSourceInferredBuildingModel(f.review,f.source),/invalid prior inferred building model/);
});
test('malformed, duplicate and unpinned prior building models fail explicitly',()=>{
    for(const mutate of [f=>{f.review.inferredBuildingModels[0].wallHeightM=Infinity;},
        f=>{f.review.inferredBuildingModels[0].sourceRingLL.pop();},
        f=>{f.review.inferredBuildingModels.push(f.review.inferredBuildingModels[0]);},
        f=>{delete f.review.sourceDataCommit;}]){
        const f=modelFixture();mutate(f);assert.throws(()=>retainedSourceInferredBuildingModel(f.review,f.source),/prior inferred building model/);
    }
});
test('domain promotion preserves an unchanged source-level MODEL before geometry baking',()=>{
    const f=fixture(),ring=[[0,0],[0,1],[1,0],[0,0]],tags={'building:levels':'5'},record={sourceId:'w10',heightM:14.5,sourceDimensions:{...tags},sourceRingLL:ring};
    f.review.levelHeightEstimates=[record];const source={sourceId:'w10',tags,sourceRingLL:ring},before=JSON.stringify({record,source});
    assert.equal(retainedSourceLevelEstimate(f.review,source,15.5),14.5);
    assert.equal(JSON.stringify({record,source}),before);
    assert.equal(retainedSourceLevelEstimate(f.review,{...source,sourceId:'w11'},15.5),15.5);
    for(const changed of [{...source,tags:{...tags,height:'16'}},{...source,tags:{...tags,height:'16',__originalDimensions:tags}},
        {...source,tags:{'building:levels':'6'}},{...source,sourceRingLL:[[0,0],[0,2],[1,0],[0,0]]}])
        assert.equal(retainedSourceLevelEstimate(f.review,changed,16),16);
    record.sourceDimensions['roof:height']='2';assert.equal(retainedSourceLevelEstimate(f.review,source,16),16);
});
test('prior level MODEL requires immutable provenance and one finite reviewed estimate',()=>{
    const f=fixture(),source={sourceId:'w10',tags:{'building:levels':'5'},sourceRingLL:[]};
    f.review.levelHeightEstimates=[{sourceId:'w10',heightM:Infinity,sourceDimensions:{'building:levels':'5'},sourceRingLL:[]}];
    assert.throws(()=>retainedSourceLevelEstimate(f.review,source,15.5),/invalid prior storey model/);
    f.review.levelHeightEstimates[0].heightM=14.5;f.review.levelHeightEstimates.push(structuredClone(f.review.levelHeightEstimates[0]));
    assert.throws(()=>retainedSourceLevelEstimate(f.review,source,15.5),/duplicate prior storey model/);
    f.review.levelHeightEstimates.pop();delete f.review.sourceDataSha256;
    assert.throws(()=>retainedSourceLevelEstimate(f.review,source,15.5),/invalid prior storey model/);
});
test('exact prior water rings/name/source identity and measured crown survive',()=>{
    const f=fixture(),r=preserveReviewedSourceContext(f.doc,f.review,f.survey);
    assert.deepEqual(f.doc.areas,[[0,0,[0,0,100,0,0,100]]]);assert.deepEqual(f.doc.areaSourceIds,['w1']);
    assert.deepEqual(f.doc.trees,[0,0,142]);assert.deepEqual(f.doc.treeInfo,[-1,0,37]);assert.deepEqual(f.doc.treeCrownRadii,[20]);
    assert.equal(f.doc.treeRetention.retained,1);assert.equal(f.doc.treeRetention.rejectedGeometryOrDuplicate,0);
    assert.match(r.physicalClearance,/unresolved/);
});
test('current source water wins over prior context, without duplicates',()=>{
    const f=fixture();f.doc.areas=[[0,-1,[10,0,100,0,0,100]]];f.doc.areaSourceIds=['w1'];
    preserveReviewedSourceContext(f.doc,f.review,f.survey);assert.equal(f.doc.areas.length,1);assert.equal(f.doc.areas[0][2][0],10);
});
test('already present measured crown is not counted twice',()=>{
    const f=fixture();preserveReviewedSourceContext(f.doc,f.review,f.survey);
    preserveReviewedSourceContext(f.doc,f.review,f.survey);assert.equal(f.doc.trees.length,3);assert.equal(f.doc.treeRetention.retained,1);
});
test('current source-tree disagreement fails rather than substituting crown metadata',()=>{
    const f=fixture();f.doc.trees=[0,0,142];f.doc.treeInfo=[-1,0,5];f.doc.treeCrownRadii=[0];
    assert.throws(()=>preserveReviewedSourceContext(f.doc,f.review,f.survey),/current source tree conflicts/);
});
test('survey hash and exact source crown/index are mandatory',()=>{
    const f=fixture();assert.throws(()=>preserveReviewedSourceContext(f.doc,f.review,Buffer.from('{}')),/survey hash differs/);
    f.review.measuredCrowns[0].surveyIndex=1;assert.throws(()=>preserveReviewedSourceContext(f.doc,f.review,f.survey),/literal survey crown differs/);
});
test('old packed geometry cannot silently move or resize a measured source crown',()=>{
    const f=fixture();f.review.measuredCrowns[0].packed[0]=1;assert.throws(()=>preserveReviewedSourceContext(f.doc,f.review,f.survey),/packed crown differs/);
});
test('projection mismatch cannot move retained context',()=>{
    const f=fixture();f.review.projection={...f.doc.proj,scale:2};assert.throws(()=>preserveReviewedSourceContext(f.doc,f.review,f.survey),/projection differs/);
});
test('absent context preserves legacy compilation',()=>{const f=fixture(),before=structuredClone(f.doc);assert.equal(preserveReviewedSourceContext(f.doc,null,f.survey),null);assert.deepEqual(f.doc,before);});
console.log(JSON.stringify({passed:reports.length,cases:reports},null,2));
