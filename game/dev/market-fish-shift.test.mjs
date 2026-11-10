import assert from 'node:assert/strict';
import test from 'node:test';
import {createMarketFishShift} from '../src/spots/market-fish-shift.js';
const monger={x:0,y:1.6,z:0},hands={x:0,y:1.3,z:4};
function catchAtArrival(shift){for(let i=0;i<200&&shift.phase==='incoming';i++){shift.tick(.01,hands);if(shift.catch(hands))return;}throw Error('Legal incoming fish could not be caught');}
function deliver(shift){assert(shift.returnTo(hands,monger));let event;for(let i=0;i<150&&shift.phase==='returning';i++)event=shift.tick(.01,hands);return event;}

test('completion requires three caught AND physically returned fish',()=>{
 const shift=createMarketFishShift();assert(shift.begin());
 for(let n=0;n<3;n++){
  assert(shift.request(monger,hands));assert.equal(shift.catch(hands),false);assert.equal(shift.returnTo(hands,monger),false);
  catchAtArrival(shift);assert.equal(shift.phase,'holding');assert.equal(shift.delivered,n);
  assert.equal(deliver(shift),n===2?'complete':'delivered');assert.equal(shift.delivered,n+1);
 }
 assert.equal(shift.phase,'done');assert.equal(shift.tick(1,hands),null);assert.equal(shift.catch(hands),false);
});

test('a released trajectory does not follow a moved viewer; a miss retains only completed deliveries',()=>{
 const shift=createMarketFishShift();shift.begin();shift.request(monger,hands);catchAtArrival(shift);deliver(shift);
 shift.request(monger,hands);const moved={x:40,y:1.3,z:40};
 for(let i=0;i<200&&shift.phase==='incoming';i++){shift.tick(.01,moved);assert.equal(shift.catch(moved),false);}
 assert.equal(shift.phase,'missed');assert.equal(shift.delivered,1);assert.equal(shift.point,null);
 assert(shift.request(monger,hands));catchAtArrival(shift);assert.equal(shift.delivered,1);
});

test('cancelling an unfinished shift cannot deliver or reuse an old catch',()=>{
 const shift=createMarketFishShift();shift.begin();shift.request(monger,hands);catchAtArrival(shift);shift.cancel();
 assert.equal(shift.phase,'idle');assert.equal(shift.point,null);assert.equal(shift.delivered,0);assert.equal(shift.returnTo(hands,monger),false);
 assert.equal(shift.tick(100,hands),null);assert(shift.begin());assert.equal(shift.phase,'ready');
});
