#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { preserveReviewedSourceContext } from './source-return-context.mjs';
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
