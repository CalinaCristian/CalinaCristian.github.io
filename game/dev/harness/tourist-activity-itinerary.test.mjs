import test from 'node:test';
import assert from 'node:assert/strict';
import {SpotSession} from '../../src/spots/index.js';
import {TOUR_WALK_LIMIT_M} from '../../src/spots/tour.js';
import {colliderIndex} from '../../src/spots/walker.js';

// The measured public table approach is208.72m. This flat scene reproduces the
// old budget exclusion only; it is not the actual park geometry/playthrough.
function session({blocked=false,available=true}={}) {
    const s=Object.create(SpotSession.prototype),messages=[];
    const interaction={r:2.2,tourAvailable:()=>available},activity={kind:'activity',id:'cismigiu',x:208.72,z:0,floorY:0,label:'Play table with Doru',interaction};
    s.guide={x:0,z:0,y:0};s.ctl={x:0,z:0,y:0};
    s.spot={id:'cismigiu',spawns:{cismigiu:{x:0,z:0}},ground:{heightAt:()=>0,groundAt:()=>0},ctx:{extras:{}},colliders:colliderIndex(blocked?[{x:208.72,z:0,hw:5,hd:5,r:8}]:[]),data:{spots:{cismigiu:{}}}};
    s.objectives=()=>[activity,{kind:'hero',id:'cismigiu',x:2,z:0,label:'Nearby view'},{kind:'plaque',x:3,z:0,label:'Nearby sign'}];
    s.ui={toast:(...args)=>messages.push(args)};s._tourUI=()=>{};s._routeLine=()=>{};
    return {s,messages};
}
test('a reachable208.72m activity leads the short itinerary instead of a nearby sign',()=>{
    assert.equal(TOUR_WALK_LIMIT_M,300);
    const{s}=session();assert.equal(s.startTour(),true);
    assert.equal(s.tour.stops[0].kind,'activity');assert.equal(s.tour.stops[0].interaction.tourAvailable(),true);
    assert.ok(s.tour.walked>180&&s.tour.walked<=TOUR_WALK_LIMIT_M);assert.ok(s.tour.stops.length<=3);
});
test('blocked and unavailable activities never produce a hero/plaque-only fallback',()=>{
    for(const opts of[{blocked:true},{available:false}]){
        const{s,messages}=session(opts);assert.equal(s.startTour(),false);assert.equal(s.tour,undefined);
        assert.equal(messages.at(-1)[0],'No activity route right now');
    }
});
test('a substantial primary activity leads even when a coin interaction is nearer',()=>{
    const{s}=session(),primary=s.objectives()[0];primary.interaction.tourPrimary=true;
    s.objectives=()=>[{kind:'activity',x:5,z:0,floorY:0,label:'Drop a coin',interaction:{r:2}},primary];
    assert.equal(s.startTour(),true);assert.equal(s.tour.stops[0],primary);
});
test('a blocked or unavailable primary activity cannot become a coin-only tour',()=>{
    for(const options of[{blocked:true},{available:false}]){
        const{s}=session(options),primary=s.objectives()[0];primary.interaction.tourPrimary=true;
        s.objectives=()=>[{kind:'activity',x:5,z:0,floorY:0,label:'Drop a coin',interaction:{r:2}},primary];
        assert.equal(s.startTour(),false);assert.equal(s.tour,undefined);
    }
});
