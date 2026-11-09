import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';
import * as THREE from '../vendor/three.module.min.js';
import {Player} from '../src/player.js';
import {bodyVerticalInterval,playerProbeVerticalInterval,playerBodySampler} from '../src/player-body-interval.js';
import {bridgeJunctionSlab} from '../src/bridge-junction.js';
function referenceBodyInterval(triangles, matrix, x, z, radius) {
    let min = Infinity, max = -Infinity;
    for (const tri of triangles) {
        let P = matrix ? tri.map(p => [matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12], matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13], matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]]) : tri;
        if (Math.max(...P.map(p=>p[0])) < x-radius || Math.min(...P.map(p=>p[0])) > x+radius || Math.max(...P.map(p=>p[2])) < z-radius || Math.min(...P.map(p=>p[2])) > z+radius) continue;
        for (const [axis,limit,sign] of [[0,x-radius,1],[0,x+radius,-1],[2,z-radius,1],[2,z+radius,-1]]) {
            const Q=[];
            for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],da=sign*(a[axis]-limit),db=sign*(b[axis]-limit),ia=da>=0,ib=db>=0;if(ia)Q.push(a);if(ia!==ib){const t=da/(da-db);Q.push(a.map((v,k)=>v+(b[k]-v)*t));}}
            P=Q;if(!P.length)break;
        }
        for(const p of P){min=Math.min(min,p[1]);max=Math.max(max,p[1]);}
    }
    return Number.isFinite(min)&&Number.isFinite(max)?{known:true,min,max,basis:'Actual emitted cockpit triangles under physical rig; probe-square superset of native disc'}:{known:false,reason:'no-emitted-body-over-probe'};
}

const D=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../handoffs/fidelity/shared-bridge-native-b006/player-pad-fixture.json.gz',import.meta.url))));
const decode=a=>{const T={Float32Array,Uint16Array,Uint32Array}[a.type],b=Uint8Array.from(Buffer.from(a.base64,'base64'));assert(T);return new T(b.buffer)};
const height=(triangles,x,z)=>{for(const [a,b,c]of triangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-1e-5&&v>=-1e-5&&u+v<=1+1e-5)return u*a[1]+v*b[1]+(1-u-v)*c[1];}return null;};
const pad=bridgeJunctionSlab({node:{sourceId:981547574},poly:D.nativePad.poly,topTriangles:D.nativePad.topTriangles,edges:Array.from({length:3},()=>({ya:4,yb:4,bridge:true})),mouths:[],sourceIds:D.nativePad.sourceIds,bottomHeightAt:(x,z)=>height(D.nativePad.bottomTriangles,x,z)}).deck;
const first=D.observations.rows.find(r=>r.after.count>4).before;
function nativePlayer({marked=true,body=true,pose=first,collider=pad}={}){
 const P=Object.create(Player.prototype);Object.assign(P,{...pose,front:3.42,rear:2.36,width:1.8,_colS:D.samples.map(s=>[s.o,s.l,s.r]),debug:{count:4,hits:[],lastCollider:null},contactAge:0,deckContact:false,collisionCd:0,shake:0,onCollide(){},supportEdge:marked?{sourceBridgeGrade:{known:true}}:null});
 P.world={buildings:[collider],walls:[]};P.rig=new THREE.Group();P.rig.position.set(pose.x,pose.y,pose.z);P.rig.rotation.set(pose.pitch,pose.heading,0,'YXZ');
 if(body){P.cockpit=new THREE.Group();P.rig.add(P.cockpit);const inv=new THREE.Matrix4().fromArray(D.pose.rig).invert();for(const o of D.meshes){const g=D.geometries[o.geometryId],a=g.attributes.position,bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(decode(a.array),a.itemSize));if(g.index)bg.setIndex(new THREE.BufferAttribute(decode(g.index.array),1));const m=new THREE.Mesh(bg,new THREE.MeshBasicMaterial()),local=new THREE.Matrix4().multiplyMatrices(inv,new THREE.Matrix4().fromArray(o.matrixWorld));local.decompose(m.position,m.quaternion,m.scale);m.name=o.name;P.cockpit.add(m);}}
 return P;
}
const old=nativePlayer({marked:false}),newP=nativePlayer();old.collide(1/30);newP.collide(1/30);
const displacement=P=>Math.hypot(P.x-first.x,P.z-first.z);
assert(displacement(old)>.3,'actual native scalar-height pad rejection reproduced');assert.equal(displacement(newP),0,'pitched actual emitted-body band clears unchanged pad');
const absent=nativePlayer({body:false});absent.collide(1/30);assert(displacement(absent)>.3,'unknown emitted body retains conservative legacy guard');
// A real upper slab at the actual nose body height remains solid. This is a
// deliberate synthetic height control, not a changed native source profile.
const roof={...pad,y0:0,y1:10,h:10,roofHeightAt:()=>10,minHeightAt:()=>4.5};const blocked=nativePlayer({collider:roof});blocked.collide(1/30);assert(displacement(blocked)>.3,'actual overhead slab contact retained');
const fx=-Math.sin(first.heading),fz=-Math.cos(first.heading),wx=first.x+fx*2.52,wz=first.z+fz*2.52;const wall={wall:true,kind:'test-wall',x:wx,z:wz,r:4,ax:wx-fz*3,az:wz+fx*3,bx:wx+fz*3,bz:wz-fx*3,nx:-fx,nz:-fz,y0a:0,y1a:20,y0b:0,y1b:20};const a=nativePlayer({marked:false,collider:wall}),b=nativePlayer({collider:wall});a.collide(1/30);b.collide(1/30);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.debug.count,b.debug.count,'external wall guards unchanged');assert(a.debug.count>4);
const mutable=nativePlayer(),px=first.x-Math.sin(first.heading)*3.1,pz=first.z-Math.cos(first.heading)*3.1,q0=playerProbeVerticalInterval(mutable,px,pz,.1);mutable.cockpit.children.find(o=>o.name==='hood').position.y+=.25;const q1=playerProbeVerticalInterval(mutable,px,pz,.1);assert(q0.known&&q1.known&&q1.min>q0.min+.24,'same-pose part-transform change invalidates interval cache');mutable.cockpit.remove(mutable.cockpit.children.find(o=>o.name==='hood'));assert.equal(playerProbeVerticalInterval(mutable,px,pz,.1).known,false,'removed part invalidates cached body catalogue');
const tri=[[[0,0,0],[10,10,0],[0,0,10]]],I=new THREE.Matrix4().elements,band=bodyVerticalInterval(tri,I,4,1,.1);assert(band.known&&Math.abs(band.min-3.9)<1e-10&&Math.abs(band.max-4.1)<1e-10,'triangle-interior band, not vertex-only samples');
for(const slope of [0,.08,-.08]){const P=nativePlayer({pose:{...first,x:0,y:.24,z:0,heading:0,pitch:Math.atan(slope)}}),q=playerProbeVerticalInterval(P,0,-3,.35);assert(q.known&&q.max>q.min);}
// The actual Player placement/ownSurface methods consume the marked 2D field,
// preserving endpoint interpolation and candidate order for all legacy roads.
const edge={a:{x:0,z:0},b:{x:10,z:0},len:10,ya:0,yb:.8,wL:3.5,wR:3.5,laneW:3.5,dirx:1,dirz:0};
for(const marked of [false,true]){const P=Object.create(Player.prototype);P.updateRig=()=>{};P.world={edgesInBox:(x0,z0,x1,z1,cb)=>cb(edge)};if(marked)edge.sourceBridgeGrade={known:true,heightAtWorld:(x,z)=>.008*x*x+.02*z};else delete edge.sourceBridgeGrade;P.place(5,1,0,edge);const expected=.24+(marked?.22:.4);assert(Math.abs(P.surfY-expected)<1e-12);assert(Math.abs(P.ownSurface(5,1,expected).h-expected)<1e-12);}
// Conservative rig-space pruning must preserve the full transformed-triangle
// result at actual native body probes across pitch/roll and world headings.
const localTriangles=[],invRig=new THREE.Matrix4().fromArray(D.pose.rig).invert(),V=new THREE.Vector3();
for(const o of D.meshes){const g=D.geometries[o.geometryId],A=decode(g.attributes.position.array),I=g.index?decode(g.index.array):null,m=new THREE.Matrix4().multiplyMatrices(invRig,new THREE.Matrix4().fromArray(o.matrixWorld));for(let i=0;i<(I?.length??A.length/3);i+=3){const tri=[];for(let k=0;k<3;k++){const n=I?I[i+k]:i+k;tri.push(V.fromArray(A,n*3).applyMatrix4(m).toArray());}localTriangles.push(tri);}}
let intervalParitySamples=0,maxIntervalParityErrorM=0;
for(const heading of [0,first.heading,1.7])for(const pitch of [-Math.atan(.08),0,Math.atan(.08)])for(const roll of [-.035,0,.035]){const P=nativePlayer({pose:{...first,pitch,heading}});P.rig.rotation.z=roll;const sampler=playerBodySampler(P),m=new THREE.Matrix4().compose(new THREE.Vector3(P.x,P.y,P.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,P.heading,roll,'YXZ')),P.rig.scale);for(const [o,l,r]of [[3.07,.415,.35],[.53,0,.9],[-2.01,.55,.35]]){const x=P.x+P.fx*o-P.fz*l,z=P.z+P.fz*o+P.fx*l,a=sampler(x,z,r),b=referenceBodyInterval(localTriangles,m.elements,x,z,r);assert.equal(a.known,b.known);if(a.known){maxIntervalParityErrorM=Math.max(maxIntervalParityErrorM,Math.abs(a.min-b.min),Math.abs(a.max-b.max));assert(maxIntervalParityErrorM<1e-8);}intervalParitySamples++;}}
const bench=nativePlayer(),movingCosts=[];for(let i=0;i<24;i++){bench.x+=.001;const t=performance.now(),sample=playerBodySampler(bench);for(const [o,l,r]of D.samples.map(v=>[v.o,v.l,v.r]))sample(bench.x+bench.fx*o-bench.fz*l,bench.z+bench.fz*o+bench.fx*l,r);movingCosts.push(performance.now()-t);}const sortedCosts=movingCosts.slice(4).sort((a,b)=>a-b),bodyIntervalCpu={warmMovingMedianMs:sortedCosts[Math.floor(sortedCosts.length/2)],warmMovingP95Ms:sortedCosts[Math.floor(sortedCosts.length*.95)],coldMs:movingCosts[0],scope:'Node CPU actual native cockpit, every collision probe, no FPS claim'};
console.log(JSON.stringify({passed:true,source:D.source,actualCockpitParts:D.meshes.length,intervalParitySamples,maxIntervalParityErrorM,bodyIntervalCpu,legacyNativePadPushM:displacement(old),candidatePadPushM:displacement(newP),unknownBodyPushM:displacement(absent),actualOverheadControlPushM:displacement(blocked),scope:'Actual native Player methods and emitted cockpit/source pad fixture; pre-collide candidate reconstruction. Fresh native continuous drive still required.'}));
