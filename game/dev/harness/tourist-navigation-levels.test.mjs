import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Ground } from '../../src/spots/ground.js';
import { walkingLevelGround, walkSegment, findWalkPath } from '../../src/spots/tour.js';
import { SpotSession } from '../../src/spots/index.js';
import { walkBoundary } from '../../src/spots/walk-boundary.js';

function galleries() {
    const ground = new Ground({x0:-30,z0:-30,d:60,nx:2,nz:2,h:[0,0,0,0]});
    ground.addBox(-5,0,1.5,8,0,2.9,3.1);
    ground.addBox(5,0,1.5,8,0,2.9,3.1);
    ground.addBox(0,7,6.5,1,0,2.9,3.1);
    return ground;
}
function session(ground) {
    const s=Object.create(SpotSession.prototype),states=[];
    s.spot={ground,ctx:{extras:{}}};
    s.ctl={x:-5,z:0,y:3.1,get position(){return{x:this.x,z:this.z,y:this.y};}};
    s.ui={setWaypoint:t=>states.push(t)};
    s.map={setWaypoint(){}};s._navColliders=()=>[];
    return {s,states};
}

test('raised gallery route goes around its actual void, while ground route stays below',()=>{
    const ground=galleries(),view=walkingLevelGround(ground,-5,0,3.1);
    assert.equal(view.groundAt(-5,0),3.1);
    assert.ok(Number.isNaN(view.groundAt(0,0)));
    assert.equal(walkSegment(view,[],[-5,0],[5,0]),false);
    const path=findWalkPath(view,[],-5,0,5,0,{maxLength:40});
    assert.ok(path&&path.length>2);
    assert.ok(path.slice(1).every((p,i)=>walkSegment(view,[],path[i],p)));
    assert.equal(walkingLevelGround(ground,-5,0,0),ground);
    assert.equal(walkSegment(ground,[],[-5,0],[5,0]),true);
});
test('same-floor custom waypoint routes, another floor is neither routed nor arrived',()=>{
    const {s,states}=session(galleries());
    s.setWaypoint({x:5,z:0});
    assert.equal(s.waypoint.floorY,3.1);assert.ok(s._waypointPath);
    s.setWaypoint({x:5,z:0,floorY:0,label:'Ground-floor activity'});
    assert.equal(s._waypointPath,null);
    s.ctl.x=5;s._updateWaypoint(true);
    assert.equal(states.at(-1).arrived,false);
    s.ctl.y=0;s._updateWaypoint();
    assert.equal(states.at(-1).arrived,true);
    assert.equal(s._waypointFrom.y,0,'a vertical-only floor change must invalidate the route');
});
test('guide planning uses its own ground floor while player is on a gallery',()=>{
    const {s}=session(galleries());
    assert.ok(s._navPath(-5,0,5,0,{startY:0,targetY:0}));
    assert.equal(s._navPath(-5,0,5,0,{startY:3.1,targetY:0}),null);
});
test('a real concave Old Town extent never puts its primary marker outside the visit',()=>{
    const data=JSON.parse(fs.readFileSync(new URL('../../data/spots/buc-old-town.json',import.meta.url)));
    const d=data.spots['old-town-lipscani'],boundary=walkBoundary(()=>[d.extent.polygon]);
    assert.equal(boundary.inside(137,-7.5),false,'retain the actual old outside-centre witness');
    const {s}=session(galleries());
    Object.assign(s.spot,{id:'old-town-lipscani',sceneId:'buc-old-town',data,spawns:{'old-town-lipscani':d.spawn},challenges:[],plaques:[],interactables:[]});
    s.spot.ctx.extras.walkBoundary=boundary;s.progress={};
    const hero=s.objectives().find(o=>o.kind==='hero');
    assert.ok(hero&&boundary.inside(hero.x,hero.z));
    assert.equal(hero.x,d.spawn.x);assert.equal(hero.z,d.spawn.z);
});
