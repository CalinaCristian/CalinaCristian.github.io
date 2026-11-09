#!/usr/bin/env node
import assert from 'node:assert/strict';
import { compileSourceReturns } from './source-return-corridors.mjs';
import { resolveRoadAccess } from '../../game/src/road-access.js';
import { buildCorridor } from './corridors.mjs';

const reports = [];
function test(name, fn) { fn(); reports.push(name); }
function fixture() {
    const pos = new Map([[1,[0,0]],[2,[0,100]],[3,[100,100]],[4,[100,0]],[5,[0,100]]]);
    const ways = new Map([[1,{nodes:[1,2],tags:{highway:'residential',oneway:'yes'}}],
        [2,{nodes:[2,3],tags:{highway:'residential',oneway:'yes'}}],
        [3,{nodes:[3,4],tags:{highway:'residential',oneway:'yes'}}],
        [9,{nodes:[10,11,12,10],tags:{amenity:'fuel',brand:'Lukoil'}}]]);
    const roads = [...ways].filter(([id])=>id!==9).map(([id,w])=>({id,nodes:[...w.nodes],tags:w.tags,
        cls:'residential',oneway:true,lf:1,lb:0,laneW:3,sidewalk:2.5,maxspeed:30,access:resolveRoadAccess(w.tags)}));
    const review = {schema:1,evidence:['literal source fixture'],destination:{sourceId:'w9',requiredTags:{amenity:'fuel',brand:'Lukoil'}},
        envelope:{playerFrontM:3.42,playerRearM:2.36,playerHalfWidthM:.9,maxShoulderM:1.2,maskCellM:20},
        corridors:[{id:'return',radiusM:40,destinationSourceId:'w9',legs:[{sourceId:'w1',from:1,to:2},{sourceId:'w2',from:2,to:3},{sourceId:'w3',from:3,to:4}]}]};
    return {pos,ways,roads,relations:new Map(),review};
}
const compile = change => { const f=fixture(); change?.(f); return compileSourceReturns(f); };
test('literal joined source legs retain exact XY/IDs/order and form one finite selection',()=>{
    const f=fixture(),before=JSON.stringify([...f.pos]),out=compileSourceReturns(f);
    assert.equal(out.corridors[0].lengthM,300); assert.equal(out.pieces.length,1);
    assert.deepEqual(out.pieces[0].pts,[[0,0],[0,100],[100,100],[100,0]]);
    assert.deepEqual([...out.routeNodes],[1,2,3,4]); assert.equal(JSON.stringify([...f.pos]),before);
    assert.ok(out.corridors[0].legs.every(l=>l.requiredRadiusM<40));
});
test('reviewed source pieces extend only finite common corridor geometry',()=>{
    const f=fixture(),out=compileSourceReturns(f),cfg={route:[],circles:[{lat:0,lon:0,r:1}],exact:true,fieldPad:10,
        sourcePieces:out.pieces,sourceReturnNodes:out.routeNodes};
    const c=buildCorridor(f.roads,f.pos,(lat,lon)=>[lon,lat],cfg);
    assert.ok(c.margin(50,100)<0); assert.ok(c.margin(1000,100)>0);
    assert.deepEqual([...c.routeNodes],[1,2,3,4]);
});
test('nearby equal coordinates with different source node identities do not join',()=>{
    assert.throws(()=>compile(f=>{f.roads[1].nodes=[5,3];f.ways.get(2).nodes=[5,3];f.review.corridors[0].legs[1].from=5;}),/disconnected source node identities/);
});
test('skipped shape vertex is never a new direct segment',()=>{
    assert.throws(()=>compile(f=>{f.ways.get(1).nodes=[1,5,2];f.roads[0].nodes=[1,5,2];}),/consecutive raw source segment/);
});
test('mapped one-way is preserved',()=>assert.throws(()=>compile(f=>f.review.corridors[0].legs[0]={sourceId:'w1',from:2,to:1}),/illegal literal source direction/));
test('oneway=-1 uses normalized legal direction without moving raw nodes',()=>{
    const f=fixture(); f.ways.get(1).nodes=[2,1];f.ways.get(1).tags.oneway='-1';
    const out=compileSourceReturns(f); assert.equal(out.corridors[0].legs[0].sourceIndex,0); assert.equal(out.corridors[0].legs[0].dir,1);assert.deepEqual(f.ways.get(1).nodes,[2,1]);
});
for(const [label,tags]of [['private',{access:'private'}],['destination',{access:'destination'}],['conditional',{'motorcar:conditional':'yes @ (Mo-Fr)'}]])
    test(`${label} road cannot become a public through return corridor`,()=>assert.throws(()=>compile(f=>{
        Object.assign(f.roads[1].tags,tags);f.roads[1].access=resolveRoadAccess(f.roads[1].tags);
    }),/public through road/));
test('only-straight restriction is retained and rejects wrong literal transition',()=>{
    const relation={tags:{type:'restriction',restriction:'only_straight_on'},members:[{type:'way',ref:1,role:'from'},{type:'node',ref:2,role:'via'},{type:'way',ref:3,role:'to'}]};
    assert.throws(()=>compile(f=>f.relations.set(70,relation)),/prohibited motor transition r70/);
    relation.members[2].ref=2;const out=compile(f=>f.relations.set(70,relation));assert.equal(out.restrictions[0].sourceId,'r70');
});
test('touching conditional/via-way restrictions remain unresolved, never guessed',()=>{
    const members=[{type:'way',ref:1,role:'from'},{type:'node',ref:2,role:'via'},{type:'way',ref:2,role:'to'}];
    assert.throws(()=>compile(f=>f.relations.set(71,{tags:{type:'restriction','restriction:conditional':'no_right_turn @ (Mo-Fr)'},members})),/conditional motor restriction/);
    assert.throws(()=>compile(f=>f.relations.set(72,{tags:{type:'restriction',restriction:'no_right_turn'},members:members.map(m=>m.role==='via'?{...m,type:'way'}:m)})),/unsupported touching motor restriction/);
});
test('terminal source turn lanes require an actually permitted lane',()=>{
    assert.throws(()=>compile(f=>{
        f.ways.get(1).tags['turn:lanes']='right';f.pos.set(6,[-100,100]);
        f.roads.push({...f.roads[1],id:4,nodes:[2,6]});
    }),/no source lane permits/);
    assert.ok(compile(f=>f.ways.get(1).tags['turn:lanes']='left').corridors.length);
});
test('source split after an already curved turn retains its sole legal continuation',()=>{
    const out=compile(f=>{
        f.ways.get(1).tags['turn:lanes']='left'; f.pos.set(3,[25,200]);
        f.pos.set(6,[-100,100]);f.roads.push({...f.roads[1],id:4,nodes:[6,2]});
    });
    assert.equal(out.corridors[0].legs[1].incomingTurnLaneValidation.decision,'single-legal-source-continuation');
});
test('terminal turn rule is not repeated at an internal source shape point',()=>{
    assert.ok(compile(f=>{f.ways.get(1).nodes.push(5);f.ways.get(1).tags['turn:lanes']='right';}).corridors.length);
});
test('immediate reverse leg is rejected even on a legal two-way source',()=>{
    assert.throws(()=>compile(f=>{f.roads[0].oneway=false;f.roads[0].lb=1;f.review.corridors[0].legs[1]={sourceId:'w1',from:2,to:1};}),/immediate source U-turn/);
});
test('source-priority wide pavement cannot be narrowed to fit domain radius',()=>{
    assert.throws(()=>compile(f=>{f.roads[0].tags.width='100';}),/cannot contain road\/body\/raster envelope/);
    assert.throws(()=>compile(f=>f.review.corridors[0].radiusM=Infinity),/nonfinite\/unbounded/);
});
test('literal destination remains a real source fuel record',()=>{
    assert.throws(()=>compile(f=>f.ways.delete(9)),/destination source way is unavailable/);
    assert.throws(()=>compile(f=>f.ways.get(9).tags.amenity='parking'),/destination source amenity differs/);
});
test('absent review preserves the legacy path without mutation',()=>{
    const f=fixture();f.review=null;assert.deepEqual(compileSourceReturns(f),{pieces:[],routeNodes:new Set(),corridors:[],restrictions:[]});
});
test('deterministic bounded compilation consumes no random numbers',()=>{
    const random=Math.random;Math.random=()=>{throw Error('RNG used');};
    try {assert.deepEqual(compile(),compile());} finally {Math.random=random;}
});
console.log(JSON.stringify({passed:reports.length,cases:reports},null,2));
