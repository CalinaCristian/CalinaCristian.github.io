import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {buildSourceBoundarySupport,decodeDistrictMask,districtMaskSegments} from '../../src/district-boundary.js';
import {collideBuildings} from '../../src/world.js';
const fixturePath=new URL('../../../handoffs/fidelity/pipera-fidelity/source-domain-boundaries/native-8e4-fixture.json.gz',import.meta.url);
const bytes=zlib.gunzipSync(fs.readFileSync(fixturePath)),f=JSON.parse(bytes),before=JSON.stringify(f.supports),start=performance.now(),support=buildSourceBoundarySupport(f.supports),old=decodeDistrictMask(f.mask),mask=support.extendMask(old),buildMs=performance.now()-start;
const walls=mask=>districtMaskSegments(mask).map(s=>({...s,wall:true,kind:'boundary',y0a:-40,y1a:80,y0b:-40,y1b:80,x:(s.ax+s.bx)/2,z:(s.az+s.bz)/2,r:Math.hypot(s.bx-s.ax,s.bz-s.az)/2+.3}));
const oldWalls=walls(old),newWalls=walls(mask),positive=f.rows.filter(r=>r.hits.length),results=[];
for(const row of f.rows){
    const fx=-Math.sin(row.heading),fz=-Math.cos(row.heading),sx=-fz,sz=fx,oldHits=[],newHits=[];
    for(const[o,l,rad]of f.body.samples){
        const x=row.x+fx*o+sx*l,z=row.z+fz*o+sz*l;
        const a=collideBuildings(oldWalls,x,z,rad,row.sourceProfileSurface),b=collideBuildings(newWalls,x,z,rad,row.sourceProfileSurface);
        if(a)oldHits.push({o,l,rad,x,z,push:[a.px,a.pz]});if(b)newHits.push({o,l,rad,x,z,push:[b.px,b.pz]});
    }
    results.push({station:row.station,sourceId:row.sourceId,edgeId:row.edgeId,lane:row.lane,x:row.x,z:row.z,oldHits,newHits});
}
const oldPositive=results.filter(r=>r.oldHits.length),newPositive=results.filter(r=>r.newHits.length);
const sameWall=(a,b)=>['ax','az','bx','bz','nx','nz'].every(k=>a[k]===b[k]);
const retained=oldWalls.filter(w=>newWalls.some(q=>sameWall(w,q)));
test('exact old native six-row wall failure reproduces with current native collision function',()=>{
    assert.equal(positive.length,6);assert.equal(oldPositive.length,6);
    assert.deepEqual(oldPositive.map(r=>[r.station,r.lane]),positive.map(r=>[r.station,r.lane]));
    for(let i=0;i<positive.length;i++)for(let j=0;j<positive[i].hits.length;j++){
        assert.ok(Math.abs(positive[i].hits[j].push[0]-oldPositive[i].oldHits[j].push[0])<1e-9);
        assert.ok(Math.abs(positive[i].hits[j].push[1]-oldPositive[i].oldHits[j].push[1])<1e-9);
    }
});
test('all1736 actual source/lane poses with full native nine-disc body clear regenerated mask walls',()=>{
    assert.equal(results.length,1736);assert.equal(newPositive.length,0);
});
test('x640 source continuation is admitted with body margin and unrelated exterior walls remain',()=>{
    assert.equal(mask.at(640.381545212403,-868.1261184835336),true);
    assert.ok(retained.length>0);assert.ok(newWalls.length>0);assert.equal(mask.at(100000,100000),false);
    assert.equal(JSON.stringify(f.supports),before);
});
const report={scope:f.scope,nativeSource:f.nativeSource,fixtureRawSha256:crypto.createHash('sha256').update(bytes).digest('hex'),nativeProfileRawSha256:f.nativeProfileRawSha256,nativeScanRawSha256:f.nativeScanRawSha256,
    scanRows:results.length,oldPositiveRows:oldPositive.length,newPositiveRows:newPositive.length,oldWalls:oldWalls.length,newWalls:newWalls.length,exactUnrelatedOldWallsRetained:retained.length,unrelatedControl:retained[0],body:f.body,helperReport:support.report,buildMs,
    oldPositive,newPositive,nativeGate:'OPEN: this is CPU replay of actual old native data, not a fresh native World/draw or driven trip'};
if(process.env.SOURCE_DOMAIN_REPORT)fs.writeFileSync(process.env.SOURCE_DOMAIN_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,oldPositive:undefined},null,2));
