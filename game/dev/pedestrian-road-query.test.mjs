import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';
import {Pedestrians} from '../src/traffic.js';
import {EdgeIndex} from '../src/nav.js';
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../handoffs/fidelity/shared-bridge-profile/source-fixture.json.gz',import.meta.url))));
const C=Object.create(Pedestrians.prototype);C.t={index:new EdgeIndex(f.edges),world:{district:true}};
// Independent retained exact predicate, including ownership/ties and widths.
function legacy(x,z,margin){let best=null,bp=0;for(const e of C.t.index.near(x,z,30,[])){
 if(e.tunnel||(e.ya??0)>1.5||(e.yb??0)>1.5)continue;
 const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,L2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-e.a.x)*dx+(z-e.a.z)*dz)/L2)),cx=e.a.x+dx*t,cz=e.a.z+dz*t,d=Math.hypot(x-cx,z-cz),side=(x-cx)*e.nx+(z-cz)*e.nz,hw=((C.t.world.district?(side>=0?e.wR:e.wL):null)??e.halfW??6)+margin;
 if(d<hw&&hw-d>bp){bp=hw-d;best={e,d,cx,cz,hw};}
}return best;}
let state=92382;const rnd=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
let comparisons=0;
for(const district of [true,false]){C.t.world.district=district;for(let i=0;i<8000;i++){
 const e=f.edges[Math.floor(rnd()*f.edges.length)],t=rnd(),side=rnd()<.5?-1:1,margin=[0,.3,.4,1.7][i%4],w=(side>0?e.wR:e.wL)??e.halfW??6,offset=i%3?(rnd()*30-15):side*(w+margin+[-1e-10,0,1e-10][i%3]),x=e.a.x+(e.b.x-e.a.x)*t+e.nx*offset,z=e.a.z+(e.b.z-e.a.z)*t+e.nz*offset;
 assert.deepEqual(C.roadAt(x,z,margin),legacy(x,z,margin));comparisons++;
}}
// Width and grade predicates remain live even after geometry was cached.
const a={x:0,z:0},b={x:30,z:0},e={a,b,len:30,dirx:1,dirz:0,nx:0,nz:1,wL:2,wR:7,halfW:4,ya:0,yb:0};C.t.index=new EdgeIndex([e]);C.t.world.district=true;
assert(C.roadAt(15,6,0));assert.equal(C.roadAt(15,-6,0),null);e.wR=3;assert.equal(C.roadAt(15,6,0),null);e.wR=7;e.ya=2;assert.equal(C.roadAt(15,6,0),null);e.ya=0;e.tunnel=true;assert.equal(C.roadAt(15,6,0),null);
console.log(JSON.stringify({passed:true,comparisons,scope:'Exact road ownership/penetration parity across native source edges, both width modes and boundary controls; not route/FPS acceptance'}));
