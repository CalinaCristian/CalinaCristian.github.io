import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.min.js';
import { arcRaceCourse,arcRoundabout,arcActiveCarriageway } from '../../src/spots/scenes/arcul-layout.js';
import { createRace } from '../../src/spots/race-course.js';
import { createBaguetteGame } from '../../src/spots/baguette-game.js';
import { ARC_SOURCE_PARTS,ARC_SOURCE_SHA256 } from '../../src/landmark-arcul-source.js';
import { LANDMARKS,buildLandmark } from '../../src/landmarks.js';
import { collideBuildings } from '../../src/world.js';
import { translatedLandmarkCollider } from '../../src/spots/landmark-colliders.js';

const data=JSON.parse(fs.readFileSync(new URL('../../data/spots/arcul-de-triumf.json',import.meta.url))),course=arcRaceCourse(data),dt=1/30;
const source=fs.readFileSync(new URL('../../../game/research/landmark-source-bucharest.json',import.meta.url));
const actualSource=JSON.parse(source).landmarks.find(l=>l.id==='arcul');
function begin(){const r=createRace(course),p=course.at(0);assert.equal(r.start(p),true);for(let i=0;i<91;i++)r.tick(dt,p);assert.equal(r.snapshot().state,'running');return r;}
function run(r,speed){for(let s=speed*dt;s<course.length+2;s+=speed*dt){r.tick(dt,course.at(Math.min(course.length,s)));if(['won','lost'].includes(r.snapshot().state))break;}return r.snapshot();}

test('mapped course and circular road retain their literal points/directions',()=>{
    assert.ok(Math.abs(course.length-166.7043007344284)<1e-8);
    for(const id of course.sourceWays)for(const p of data.ways.find(w=>w.id===id).pts)assert.ok(course.points.some(q=>q[0]===p[0]&&q[1]===p[1]));
    const loop=arcRoundabout(data);assert.deepEqual(loop.points[0],loop.points.at(-1));assert.equal(loop.sourceWays.length,8);
    const bad=structuredClone(data);bad.ways.find(w=>w.id==='w1558883517').oneway='no';assert.throws(()=>arcRoundabout(bad));
});
test('literal27 source masses retain every polygon and tagged vertical interval',()=>{
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),ARC_SOURCE_SHA256);
    assert.deepEqual(ARC_SOURCE_PARTS,actualSource.associatedParts.map(q=>({id:q.id,ring:q.ring,height:+q.tags.height,minimum:+(q.tags.min_height||0)})));
});
test('public-foot exceptions require both literal permissions and never open motor roads',()=>{
    const bad=structuredClone(data);delete bad.ways.find(w=>w.id==='w1191723271').foot;assert.throws(()=>arcRaceCourse(bad));
    const mixed=structuredClone(data);delete mixed.ways.find(w=>w.id==='w1191738377').motor_vehicle;assert.throws(()=>arcRaceCourse(mixed));
    const road=data.ways.find(w=>w.id==='w1110051056').pts[2];assert.equal(arcActiveCarriageway(data)(...road,.3),true);
});
test('real emitted monument has its .01m public floor, not a1.3m passage plinth',()=>{
    const r=buildLandmark(LANDMARKS.find(l=>l.id==='arcul'),{realScale:true});r.mesh.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(0,4,0),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObject(r.mesh,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-.01)<1e-6);
    assert.equal(r.collision.length,27);assert.equal(r.mesh.userData.sourceMassAudit.sourceIds.length,27);
});
test('entire source course clears native27-part body collision and actual carriageways',()=>{
    const lm=LANDMARKS.find(l=>l.id==='arcul'),r=buildLandmark(lm,{realScale:true}),anchor={x:(lm.lon-data.origin.lon)*data.projection.mLon,z:-(lm.lat-data.origin.lat)*data.projection.mLat};
    const cs=r.collision.map(c=>translatedLandmarkCollider(c,anchor,0,30,'arcul')),road=arcActiveCarriageway(data);let samples=0;
    for(let i=1;i<course.points.length;i++){
        const a=course.points[i-1],b=course.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1);
        for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;samples++;
            assert.equal(collideBuildings(cs,x,z,.3,.25,1.65),null,`source body at ${x},${z}`);assert.equal(road(x,z,.3),false);}
    }
    assert.equal(samples,1770);
    const pier=cs.find(c=>c.sourceId==='w1191615159'),p=actualSource.associatedParts.find(p=>p.id==='w1191615159').ring[0];
    assert.ok(pier);assert.ok(p.length===2);
});
test('continuous fast running beats two actually progressing opponents',()=>{
    const q=run(begin(),4.2);assert.equal(q.state,'won');assert.equal(q.checkpoint,q.checkpoints);assert.ok(q.rivals.every(r=>r.progress>50));
});
test('walking slowly loses to the opponents rather than receiving a timed award',()=>{assert.equal(run(begin(),1.6).state,'lost');});
test('idle cannot win and actual blocker admission prevents ghost rival progress',()=>{
    const r=begin(),initial=r.snapshot().rivals.map(p=>p.progress);
    for(let i=0;i<400;i++)r.tick(dt,course.at(0),{canAdvanceRival:()=>false});
    assert.equal(r.snapshot().progress,0);assert.deepEqual(r.snapshot().rivals.map(p=>p.progress),initial);assert.notEqual(r.snapshot().state,'won');
});
test('teleport/checkpoint shortcut and cancellation do not win',()=>{
    const r=begin();r.tick(dt,course.at(40));assert.equal(r.snapshot().state,'lost');
    const c=begin();c.cancel();run(c,4.2);assert.equal(c.snapshot().state,'cancelled');
});
test('start requires the real start area and leaving the course fails',()=>{
    const r=createRace(course);assert.equal(r.start(course.at(30)),false);
    const c=begin(),p=course.at(0);for(let i=0;i<250;i++)c.tick(dt,{x:p.x+i*.1,z:p.z});assert.notEqual(c.snapshot().state,'won');assert.equal(c.snapshot().state,'lost');
});
function advance(b,seconds){for(let t=0;t<seconds-1e-7;t+=dt)b.tick(dt);}
test('baguette requires three timed catches and completed visible catch animations',()=>{
    const b=createBaguetteGame();advance(b,5);assert.equal(b.snapshot().streak,0);
    for(let i=0;i<3;i++){assert.equal(b.action(),'toss');advance(b,.9);assert.equal(b.action(),'catch');assert.notEqual(b.snapshot().state,'won');advance(b,.64);}
    assert.equal(b.snapshot().state,'won');
});
test('early/late misses reset the streak and recovery needs another deliberate input',()=>{
    const b=createBaguetteGame();b.action();advance(b,.2);assert.equal(b.action(),'miss');advance(b,2);assert.equal(b.snapshot().state,'dropped');
    assert.equal(b.action(),'recover');advance(b,.74);assert.equal(b.snapshot().state,'held');b.action();advance(b,1.3);assert.equal(b.snapshot().state,'dropped');assert.equal(b.snapshot().streak,0);
});
test('cancelling after third catch before its animation ends never completes',()=>{
    const b=createBaguetteGame();for(let i=0;i<3;i++){b.action();advance(b,.9);b.action();if(i<2)advance(b,.64);}
    b.cancel();advance(b,3);assert.equal(b.snapshot().state,'cancelled');
});
