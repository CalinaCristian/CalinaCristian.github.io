import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceBoundarySupport,decodeDistrictMask,normalizeSourceMapEnds,SOURCE_DOMAIN_BODY_RADIUS} from '../../src/district-boundary.js';
import {MeshBuilder} from '../../src/geobuild.js';
const rectangle=(x0,z0,x1,z1,y=0,ownerEdges=[])=>({poly:[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],ownerEdges,sourceId:'w1'});
const mask=()=>decodeDistrictMask({x0:0,z0:0,w:2,h:2,cell:20,rle:[0,1,3]});
const end=(extra={})=>({x:0,z:0,y:.24,ix:0,iz:1,px:-1,pz:0,l0:-10,l1:10,half:10,edge:{id:1},node:{id:1},...extra});
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[2]-a[2]*b[0];},0))/2;

test('mask decoder verifies complete RLE and preserves source occupancy',()=>{
    const m=mask();assert.equal(m.at(10,10),true);assert.equal(m.at(30,10),false);
    assert.throws(()=>decodeDistrictMask({x0:0,z0:0,w:1,h:1,cell:20,rle:[]}),/Incomplete/);
    assert.throws(()=>decodeDistrictMask({x0:0,z0:0,w:1,h:1,cell:20,rle:[2]}),/Invalid/);
});
test('finite source-road support extends the whole body domain and leaves unrelated exterior closed',()=>{
    const s=buildSourceBoundarySupport([rectangle(38,4,70,10,11.24)]),old=mask(),m=s.extendMask(old);
    assert.equal(m.at(50,8),true);assert.equal(m.at(70+SOURCE_DOMAIN_BODY_RADIUS-.01,8),true);
    assert.equal(m.at(500,500),false);assert.equal(m.at(10,10),true);
    assert.ok(s.report.addedMaskCells>0);assert.equal(s.report.oldMaskCells,1);
    const decoded=decodeDistrictMask(m);assert.deepEqual(decoded.bits,m.bits);
});
test('cell/road intersection keeps narrow diagonal support even when cell centre misses it',()=>{
    const s=buildSourceBoundarySupport([{poly:[[39,0,1],[40,0,0],[61,0,21]],ownerEdges:[]}],{bodyRadiusM:0});
    const m=s.extendMask(mask());assert.equal(m.at(41,1),true);
});
test('no selected source support creates no extension or substitute connection',()=>{
    const m=mask();assert.equal(buildSourceBoundarySupport([]).extendMask(m),m);
});
test('physical segment subtraction splits only actual compatible-level source crossing',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24)]),a=[-10,.24,0],b=[10,.24,0];
    assert.deepEqual(s.segmentIntervals(a,b,{y0:-1.76,y1:3.24}),[[0,.4],[.6,1]]);
    assert.deepEqual(s.segmentIntervals(a,b,{y0:9,y1:14}),[[0,1]]);
});
test('own legitimate closed-road cross-section remains closed',()=>{
    const owner={},s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24,[owner])]);
    assert.deepEqual(s.segmentIntervals([-10,.24,0],[10,.24,0],{ownerEdges:[owner],y0:-2,y1:3}),[[0,1]]);
});
test('primitive polygon subtraction preserves geometry/attributes outside source road',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24)]),poly=[[-10,.22,-1,0],[10,.22,-1,20],[10,.22,1,20],[-10,.22,1,0]];
    const out=s.clipPolygon(poly,{y0:.19,y1:.27});
    assert.ok(Math.abs(out.reduce((v,p)=>v+area(p),0)-32)<1e-8);
    for(const p of out)for(const v of p)assert.ok(Math.abs(v[3]-(v[0]+10))<1e-8);
});
test('other-level pavement/decorations remain untouched',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,11.24)]),p=[[-1,.24,-1],[1,.24,-1],[1,.24,1],[-1,.24,1]];
    assert.equal(s.clipPolygon(p,{y0:.2,y1:1.2})[0],p);
    assert.equal(s.clearCircle(0,0,.4,{y0:.2,y1:1.2}),true);
});
test('graded actual support is clipped at its true height intervals',()=>{
    const s=buildSourceBoundarySupport([{poly:[[0,0,0],[10,10,0],[10,10,10],[0,0,10]],ownerEdges:[]}]);
    const p=[[-1,0,1],[11,0,1],[11,0,9],[-1,0,9]],out=s.clipPolygon(p,{y0:4,y1:6});
    assert.ok(Math.abs(out.reduce((v,p)=>v+area(p),0)-80)<1e-8);
});
test('discrete prop clearance tests the complete radius at the actual level',()=>{
    const s=buildSourceBoundarySupport([rectangle(0,0,10,10,.24)]);
    assert.equal(s.clearCircle(-.5,5,.6,{y0:0,y1:1}),false);
    assert.equal(s.clearCircle(-.5,5,.4,{y0:0,y1:1}),true);
});
test('normalized physical and visible sections share immutable exact spans',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24)]),m=end(),out=normalizeSourceMapEnds([m],s);
    assert.equal(out.length,2);assert.deepEqual(out.map(q=>[q.l0,q.l1]),[[-10,-2],[2,10]]);
    assert.equal(out[0].bundlePrimary,true);assert.equal(out[1].bundlePrimary,false);
    assert.equal(out[0].half,4);assert.ok(Object.isFrozen(out[0]));assert.ok(Object.isFrozen(out[0].ownerEdges));
    assert.equal(m.l0,-10);assert.equal(m.l1,10);
});
test('coplanar street-bundle overlaps are emitted once with one worksite primary',()=>{
    const s=buildSourceBoundarySupport([]),a=end(),b=end({edge:{id:2},node:{id:2},x:1});
    const out=normalizeSourceMapEnds([a,b],s);
    assert.equal(out.filter(m=>m.bundlePrimary).length,1);assert.equal(new Set(out.map(m=>m.bundleId)).size,1);
    const length=out.reduce((v,m)=>v+m.l1-m.l0,0);assert.ok(Math.abs(length-21)<1e-8);
});
test('unrelated boundary and other-level local closure remain',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24)]),far=end({x:100}),high=end({y:11.24});
    const out=normalizeSourceMapEnds([far,high],s);assert.equal(out.length,2);
    assert.deepEqual(out.map(m=>[m.l0,m.l1]),[[-10,10],[-10,10]]);
});
test('source support and graph identity are not modified and no RNG is used',()=>{
    const e={id:1},supports=[rectangle(-2,-2,2,2,.24,[e])],before=JSON.stringify(supports),random=Math.random;
    Math.random=()=>{throw Error('RNG used');};
    try{const s=buildSourceBoundarySupport(supports);s.extendMask(mask());normalizeSourceMapEnds([end({edge:e})],s);}finally{Math.random=random;}
    assert.equal(JSON.stringify(supports),before);
});
test('invalid primitive heights fail rather than removing another road blindly',()=>{
    const s=buildSourceBoundarySupport([]);
    assert.throws(()=>s.clipPolygon([[0,0,0],[1,0,0],[0,0,1]],{}),/vertical interval/);
    assert.throws(()=>s.clearCircle(0,0,1,{}),/circle interval/);
    assert.throws(()=>s.segmentIntervals([0,0,0],[1,0,0],{}),/vertical interval/);
});
test('render clipping retains the complete existing source prefix and interpolated closure attributes',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,.24)]),mesh=new MeshBuilder(true);
    mesh.flatQuad(40,40,41,40,41,41,40,41,.24,[100,110,120],1,3);
    const start=mesh.ic,oldVertices=mesh.vc,oldIndices=Array.from(mesh.i.subarray(0,start)),oldPositions=Array.from(mesh.p.subarray(0,oldVertices*3));
    mesh.flatQuad(-10,-1,10,-1,10,1,-10,1,.22,[130,140,150],1,4);
    assert.equal(s.clearMeshRange(mesh,start,{floorY:.24}),false);assert.equal(s.applyMesh(mesh,start,{floorY:.24}),true);
    assert.deepEqual(Array.from(mesh.i.subarray(0,start)),oldIndices);assert.deepEqual(Array.from(mesh.p.subarray(0,oldVertices*3)),oldPositions);
    let retained=0;
    for(let i=start;i<mesh.ic;i+=3){const p=[0,1,2].map(j=>Array.from(mesh.p.subarray(mesh.i[i+j]*3,mesh.i[i+j]*3+3)));retained+=area(p);}
    assert.ok(Math.abs(retained-32)<1e-6);
});
test('barrier normalization does not reserve an invented two-metre volume below an elevated closure',()=>{
    const s=buildSourceBoundarySupport([rectangle(-2,-2,2,2,9.24)]),out=normalizeSourceMapEnds([end({y:11.24,barrierHeight:1.36})],s);
    assert.equal(out.length,1);assert.equal(out[0].l0,-10);assert.equal(out[0].l1,10);
});
