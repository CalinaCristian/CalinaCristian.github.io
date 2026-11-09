import test from 'node:test';
import assert from 'node:assert/strict';
import {SpotSession} from '../../src/spots/index.js';

const player={x:-129.1337,z:76.2291,y:-.1};
function fixture(){
    const s=Object.create(SpotSession.prototype),used=()=>{throw Error('Selection cannot use or complete an activity');};
    const table={kind:'activity',x:-130.15,z:76.8,r:2.1,label:'Play backgammon',use:used};
    const guide={kind:'guide',x:-129.9324,z:76.4722,r:2.6,label:'Tour guide',use:used};
    s.spot={interactables:[table,guide]};s.tour={state:'arrive',stops:[{interaction:table}],i:0};
    return{s,table,guide};
}
test('actual phone-arrival coordinates expose the reached table instead of the closer guide',()=>{
    const{s,table,guide}=fixture();assert.ok(Math.hypot(player.x-guide.x,player.z-guide.z)<Math.hypot(player.x-table.x,player.z-table.z));
    assert.equal(s._interactionAt(player),table);
    assert.equal(s.tour.i,0);assert.equal(s.tour.stops[0].participated,undefined);
});
test('arrival priority preserves actual reach, vertical range and enabled conditions',()=>{
    for(const change of[t=>t.r=.5,t=>t.y=4,t=>t.x=NaN,t=>t.cond=()=>false]){
        const{s,table,guide}=fixture();change(table);assert.equal(s._interactionAt(player),guide);
    }
    const{s,table}=fixture();let calls=0;table.cond=()=>{calls++;return true;};
    assert.equal(s._interactionAt(player),table);assert.equal(calls,1,'conditions keep one evaluation in source order');
});
test('ordinary nearest interactions and unrelated physical targets retain their behavior',()=>{
    for(const state of['walk','blocked','done']){const{s,guide}=fixture();s.tour.state=state;assert.equal(s._interactionAt(player),guide);}
    const{s,guide,table}=fixture();s.tour=null;assert.equal(s._interactionAt(player),guide);
    s.tour={state:'arrive',stops:[{interaction:{...table}}],i:0};assert.equal(s._interactionAt(player),guide,'a stale or different interaction is not preferred');
    s.tour.stops[0].interaction=table;const door={kind:'entrance',x:player.x,z:player.z,r:1};s.spot.interactables.push(door);
    assert.equal(s._interactionAt(player),door,'the new priority only displaces guide/conversation prompts');
    s.spot.interactables=[];assert.equal(s._interactionAt(player),null);
});
