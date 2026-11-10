import assert from 'node:assert/strict';
import {forkedBridgePier,emitForkedBridgePier} from '../src/forked-bridge-pier.js';
import {MeshBuilder,rgb} from '../src/geobuild.js';

for(const angle of [0,.7,2.3])for(const height of [4.8,7.5,11]) {
    const plan=forkedBridgePier({x:80,z:-144,height,along:[Math.cos(angle),Math.sin(angle)],headHalfWidth:2.4});
    assert.equal(plan.members.length,16);assert.equal(plan.colliders.length,16);
    const mb=new MeshBuilder();emitForkedBridgePier(mb,plan,rgb('#a9a69e'),rgb('#414441'));
    assert.equal(mb.ic,16*36,'every member is a closed six-face solid');
    for(let i=0;i<mb.ic;i+=3) {
        const ids=[mb.i[i],mb.i[i+1],mb.i[i+2]],pts=ids.map(n=>Array.from(mb.p.subarray(n*3,n*3+3))),m=plan.members[Math.floor(i/36)];
        const center=pts[0].map((_,k)=>(pts[0][k]+pts[1][k]+pts[2][k])/3),band=[m.collider.minHeightAt(center[0],center[2],1e-4),m.collider.roofHeightAt(center[0],center[2],1e-4)];
        assert.ok(band[0]!=null&&band[1]!=null&&center[1]>=band[0]-1e-4&&center[1]<=band[1]+1e-4,'serialized emitted face stays inside the corresponding physical prism');
        const a=pts[1].map((v,k)=>v-pts[0][k]),b=pts[2].map((v,k)=>v-pts[0][k]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],bodyCenter=m.A[0].map((_,k)=>[...m.A,...m.B].reduce((n,p)=>n+p[k],0)/8);
        assert.ok(normal.reduce((n,v,k)=>n+v*(center[k]-bodyCenter[k]),0)>0,'every serialized face points out of its own closed member');
    }
    const n=[-Math.sin(angle),Math.cos(angle)],outside=[80+n[0]*1.8,-144+n[1]*1.8];
    const bands=plan.colliders.map(c=>[c.minHeightAt(...outside,0),c.roofHeightAt(...outside,0)]).filter(b=>b[0]!=null);
    assert.ok(bands.length&&Math.min(...bands.map(b=>b[0]))>height*.45,'the flared head leaves real space below its outer branches');
    const shaft=plan.colliders[0];assert.equal(shaft.minHeightAt(80,-144,0),0);assert.ok(shaft.roofHeightAt(80,-144,0)>height*.4);
    assert.ok(plan.colliders.every(c=>c.estimated&&c.kind.startsWith('basarab-pier')));
}
const args={x:0,z:0,height:7.5,along:[1,0],headHalfWidth:2.4};
for(const c of [{height:4},{height:NaN},{along:[2,0]},{along:[]},{headHalfWidth:0}])assert.equal(forkedBridgePier({...args,...c}),null);
console.log('PASS: 9 rotated/height sections, all 1728 serialized triangles and physical bands, outward closed faces, under-fork space and invalid-section refusals. Stations and dimensions remain estimates; no native bridge acceptance.');
