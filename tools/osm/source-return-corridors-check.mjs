#!/usr/bin/env node
import assert from 'node:assert/strict';
import { compileSourceReturns } from './source-return-corridors.mjs';
import { resolveRoadAccess } from '../../game/src/road-access.js';
import { buildCorridor } from './corridors.mjs';
import { buildMotorTurnRestrictions } from '../../game/src/motor-turn-restrictions.js';

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
test('missing-from only-straight is obeyed universally without inventing the absent member',()=>{
    const f=fixture(),r={tags:{type:'restriction',restriction:'only_straight_on'},members:[{type:'node',ref:2,role:'via'},{type:'way',ref:2,role:'to'}]};
    f.relations.set(73,r);const before=JSON.stringify(r),out=compileSourceReturns(f);
    assert.equal(JSON.stringify(r),before);assert.deepEqual(out.restrictions[0].members,r.members);
    assert.equal(out.restrictions[0].reviewValidation.basis,'missing-from-universal-known-exit');
    // Replacing the incoming identity cannot evade the universal rule.
    f.roads[0].id=8;f.ways.set(8,f.ways.get(1));f.ways.delete(1);f.review.corridors[0].legs[0].sourceId='w8';
    assert.equal(compileSourceReturns(f).restrictions[0].reviewValidation.requiredExit,'w2');
    r.members[1].ref=3;assert.throws(()=>compileSourceReturns(f),/requires its known sole exit/);
});
test('incomplete only-straight does not excuse a different exit or an unobserved boundary',()=>{
    const missing={tags:{type:'restriction',restriction:'only_straight_on'},members:[{type:'node',ref:2,role:'via'},{type:'way',ref:2,role:'to'}]};
    assert.throws(()=>compile(f=>{f.relations.set(74,missing);f.review.corridors[0].legs=f.review.corridors[0].legs.slice(0,1);}),/unsupported touching motor restriction|requires its known sole exit/);
    assert.throws(()=>compile(f=>{f.relations.set(74,{...missing,members:[{type:'node',ref:5,role:'via'},missing.members[1]]});}),/requires its known sole exit/);
});
test('incomplete conditional, via-way, unknown exit and ambiguous exits stay rejected',()=>{
    const base={tags:{type:'restriction',restriction:'only_straight_on'},members:[{type:'node',ref:2,role:'via'},{type:'way',ref:2,role:'to'}]};
    for(const mutate of [r=>r.tags['restriction:conditional']='only_straight_on @ (Mo-Fr)',r=>r.members[0].type='way',r=>r.members.pop(),r=>r.members.push({type:'way',ref:3,role:'to'}),r=>r.members.push({type:'node',ref:1,role:'from'}),r=>r.tags.restriction='no_right_turn'])
        assert.throws(()=>compile(f=>{const r=structuredClone(base);mutate(r);f.relations.set(75,r);}),/unsupported touching motor restriction|conditional motor restriction/);
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
function missingViaFixture() {
    const f = fixture(), relation = { tags: { type: 'restriction', restriction: 'only_right_turn' }, members: [{ type: 'way', ref: 1, role: 'from' }, { type: 'way', ref: 2, role: 'to' }] };
    f.relations.set(80, relation);
    f.review.restrictionCompliance = [{ sourceId: 'r80', basis: 'missing-via-universal-known-transition', fromSourceId: 'w1', toSourceId: 'w2', sharedSourceNodeId: 2, expectedRecord: structuredClone(relation) }];
    return f;
}
test('opted-in malformed missing-via only-right complies at its unique literal source incidence without editing raw', () => {
    const f = missingViaFixture(), before = JSON.stringify(f.relations.get(80)), out = compileSourceReturns(f), r = out.restrictions.find(r => r.sourceId === 'r80');
    assert.equal(JSON.stringify(f.relations.get(80)), before); assert.deepEqual(r.members, f.relations.get(80).members);
    assert.equal(r.reviewValidation.basis, 'missing-via-universal-source-incidence'); assert.equal(r.reviewValidation.sharedSourceNodeId, 2); assert.equal(r.reviewValidation.runtimeStatus, 'unresolved-missing-via');
    const runtime = buildMotorTurnRestrictions({ roadRestrictions: [r] });
    assert.ok(runtime.report.unresolved.some(u => u.sourceId === 'r80' && u.reasons.includes('missing-or-ambiguous-via-node')));
});
test('known restriction FROM absent from the complete reviewed path proves finite-path irrelevance', () => {
    const f = missingViaFixture(); f.review.corridors[0].legs = f.review.corridors[0].legs.slice(1);
    assert.equal(compileSourceReturns(f).restrictions[0].reviewValidation.basis, 'known-from-not-traversed');
});
test('unreviewed malformed missing-via relation remains refused', () => {
    const f = missingViaFixture(); delete f.review.restrictionCompliance;
    assert.throws(() => compileSourceReturns(f), /unsupported touching motor restriction/);
});
test('multiple shared source nodes or repeated incidence never supplies a guessed missing via', () => {
    for (const repeated of [false, true]) { const f = missingViaFixture(), nodes = repeated ? [1, 2, 5, 2] : [1, 2, 3]; f.ways.get(1).nodes = nodes; f.roads[0].nodes = nodes;
        assert.throws(() => compileSourceReturns(f), /ambiguous literal shared-node incidence/); }
});
test('nearby equal XY with different source node IDs does not repair missing-via topology', () => {
    const f = missingViaFixture(); f.ways.get(2).nodes = [5, 3]; f.roads[1].nodes = [5, 3]; f.review.corridors[0].legs[1].from = 5;
    assert.throws(() => compileSourceReturns(f), /disconnected source node identities/);
});
test('a real alternate reviewed legal exit cannot evade the exact known TO', () => {
    const f = missingViaFixture(); f.ways.set(8, structuredClone(f.ways.get(2))); f.roads.push({ ...f.roads[1], id: 8 }); f.review.corridors[0].legs[1].sourceId = 'w8';
    assert.throws(() => compileSourceReturns(f), /requires its exact known TO/);
});
test('changed raw record or wrong pinned shared-node identity needs new review', () => {
    const f = missingViaFixture(); f.relations.get(80).members[1].ref = 3;
    assert.throws(() => compileSourceReturns(f), /differs from its literal source pin/);
    const g = missingViaFixture(); g.review.restrictionCompliance[0].sharedSourceNodeId = 5;
    assert.throws(() => compileSourceReturns(g), /ambiguous literal shared-node incidence/);
});
test('conditional missing-via records remain refused even with an updated source pin', () => {
    const f = missingViaFixture(); f.relations.get(80).tags['restriction:conditional'] = 'only_right_turn @ (Mo-Fr)'; f.review.restrictionCompliance[0].expectedRecord = structuredClone(f.relations.get(80));
    assert.throws(() => compileSourceReturns(f), /unsupported reviewed missing-via restriction/);
});
test('missing off-path source metrics cannot certify a complete shared-node model', () => {
    const f = missingViaFixture(); f.ways.get(2).nodes.push(999); f.roads[1].nodes.push(999);
    assert.throws(() => compileSourceReturns(f), /missing exact source metrics/);
});
test('a boundary-ending FROM cannot claim the unobserved mandatory exit', () => {
    const f = missingViaFixture(); f.review.corridors[0].legs = f.review.corridors[0].legs.slice(0, 1);
    assert.throws(() => compileSourceReturns(f), /requires its exact known TO/);
});
function missingToFixture() {
    const f = fixture(), relation = { tags: { type: 'restriction', restriction: 'only_right_turn' }, members: [{ type: 'way', ref: 2, role: 'from' }, { type: 'node', ref: 2, role: 'via' }] };
    f.relations.set(81, relation); f.review.restrictionCompliance = [{ sourceId: 'r81', basis: 'known-from-via-arrival-not-traversed', fromSourceId: 'w2', viaSourceNodeId: 2, expectedRecord: structuredClone(relation) }]; return f;
}
test('departing the known VIA along its one-way FROM does not trigger the missing-TO arrival restriction', () => {
    const f = missingToFixture(), before = JSON.stringify(f.relations.get(81)), r = compileSourceReturns(f).restrictions[0];
    assert.equal(r.reviewValidation.sourceOneWayDepartsVia, true); assert.equal(r.reviewValidation.reviewedConstrainedArrivals, 0);
    assert.equal(JSON.stringify(f.relations.get(81)), before); assert.deepEqual(r.members, f.relations.get(81).members);
    assert.ok(buildMotorTurnRestrictions({ roadRestrictions: [r] }).report.unresolved.some(u => u.sourceId === 'r81' && u.reasons.includes('missing-or-ambiguous-to-way')));
});
test('an actual legal arrival from the known FROM into VIA cannot use the missing-TO irrelevance review', () => {
    const f = missingToFixture(); f.relations.get(81).members[1].ref = 3; f.review.restrictionCompliance[0].viaSourceNodeId = 3; f.review.restrictionCompliance[0].expectedRecord = structuredClone(f.relations.get(81));
    assert.throws(() => compileSourceReturns(f), /known constrained arrival.*is traversed/);
});
test('reversing the source one-way to arrive at VIA stays illegal', () => {
    const f = missingToFixture(); f.review.corridors[0].legs = [{ sourceId: 'w2', from: 3, to: 2 }];
    assert.throws(() => compileSourceReturns(f), /illegal literal source direction/);
});
console.log(JSON.stringify({passed:reports.length,cases:reports},null,2));
