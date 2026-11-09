#!/usr/bin/env node
import assert from 'node:assert/strict';
import {snapshotRoadRestrictionSources,roadRestrictionCatalogue}from './road-restrictions.mjs';
const reports=[],test=(name,fn)=>{fn();reports.push(name)},files=[{file:'literal.xml',sha256:'a'.repeat(64)}];
const fixture=()=>({osm:{nodes:new Map([[1,[0,0]],[2,[0,1]],[3,[0,2]],[4,[1,0]]]),ways:new Map([[1,{nodes:[1,2],tags:{highway:'residential',oneway:'yes'}}],[2,{nodes:[2,3],tags:{highway:'residential'}}]]),rels:new Map()},data:{district:{id:'fixture'},roadNodeIds:[1,2,-2000000000],roadSourceGeometry:{0:{sourceId:'w1',nodeIds:[1,2],tags:{highway:'residential',oneway:'yes'}}},untouched:{geometry:[1,2,3]}}});
const restriction=(tags={},members=[{type:'way',ref:1,role:'from'},{type:'node',ref:2,role:'via'},{type:'way',ref:2,role:'to'}])=>({tags:{type:'restriction',restriction:'no_left_turn',...tags},members});
const compile=f=>roadRestrictionCatalogue(f.data,snapshotRoadRestrictionSources(f.osm),files);
test('literal raw tags, member order and source identity survive without a permission inference',()=>{
 const f=fixture(),r=restriction();f.osm.rels.set(10,r);const before=JSON.stringify({data:f.data,relation:r}),out=compile(f);
 assert.deepEqual(out.roadRestrictions,[{sourceId:'r10',...r}]);assert.equal(JSON.stringify({data:f.data,relation:r}),before);assert.deepEqual(out.roadRestrictionCoverage.exceptions,[]);
 const appended={...f.data,...out};for(const[k,v]of Object.entries(f.data))assert.deepEqual(appended[k],v);
});
test('matching a positive retained node preserves a restriction whose member ways are outside core',()=>{
 const f=fixture();f.osm.rels.set(11,restriction({},[{type:'way',ref:2,role:'from'},{type:'node',ref:2,role:'via'},{type:'way',ref:9,role:'to'}]));f.osm.rels.set(12,restriction({},[{type:'way',ref:9,role:'from'},{type:'node',ref:4,role:'via'},{type:'way',ref:10,role:'to'}]));
 assert.deepEqual(compile(f).roadRestrictions.map(r=>r.sourceId),['r11']);
});
test('mode-only, except, conditional and via-way records stay literal and observable',()=>{
 const f=fixture(),r=restriction({'restriction:bus':'only_straight_on','restriction:hgv:conditional':'no_left_turn @ (Mo-Fr)',except:'motorcar;bicycle'});delete r.tags.restriction;r.members[1]={type:'way',ref:2,role:'via'};f.osm.rels.set(20,r);
 const out=compile(f);assert.deepEqual(out.roadRestrictions[0].tags,r.tags);assert.deepEqual(out.roadRestrictionCoverage.exceptValues,{'motorcar;bicycle':['r20']});assert.deepEqual(out.roadRestrictionCoverage.exceptions[0].reasons,['via-way','conditional']);
});
test('missing from/to/via are retained as missing and never reconstructed',()=>{
 const f=fixture();for(const[off,role]of['from','to','via'].entries())f.osm.rels.set(30+off,restriction({},restriction().members.filter(m=>m.role!==role)));
 const out=compile(f);assert.deepEqual(out.roadRestrictionCoverage.exceptions.map(e=>e.reasons),[['missing-from'],['missing-to'],['missing-via']]);assert.ok(!out.roadRestrictions[0].members.some(m=>m.role==='from'));
});
test('multiple-member restrictions remain explicit, not collapsed to a guessed node rule',()=>{
 const f=fixture(),r=restriction({restriction:'no_entry'});r.members.push({type:'way',ref:2,role:'from'});f.osm.rels.set(40,r);const out=compile(f);assert.equal(out.roadRestrictions[0].members.length,4);assert.deepEqual(out.roadRestrictionCoverage.exceptions[0].reasons,['multiple-from']);
});
test('an immutable pre-enrichment snapshot survives later source-object changes',()=>{
 const f=fixture();f.osm.rels.set(1,restriction());const snap=snapshotRoadRestrictionSources(f.osm);f.osm.rels.get(1).members.length=0;f.osm.ways.get(1).tags.oneway='no';f.osm.ways.get(1).nodes.reverse();
 const out=roadRestrictionCatalogue(f.data,snap,files);assert.equal(out.roadRestrictions[0].members.length,3);
});
test('missing raw nodes/ways and changed original direction/topology cannot claim coverage',()=>{
 for(const mutate of[f=>f.osm.nodes.delete(2),f=>f.osm.ways.delete(1),f=>f.osm.ways.get(1).tags.oneway='no',f=>f.osm.ways.get(1).nodes.reverse()]){const f=fixture();mutate(f);assert.throws(()=>compile(f),/core source mismatch/);}
 const f=fixture();assert.throws(()=>roadRestrictionCatalogue(f.data,snapshotRoadRestrictionSources(f.osm),[]),/missing immutable tile ledger/);
});
test('stable ordering and coverage consume no random numbers',()=>{
 const f=fixture();f.osm.rels.set(100,restriction());f.osm.rels.set(2,restriction());const random=Math.random;Math.random=()=>{throw Error('RNG consumed')};
 try{const a=compile(f);f.osm.rels=new Map([...f.osm.rels].reverse());assert.deepEqual(compile(f),a);assert.deepEqual(a.roadRestrictions.map(r=>r.sourceId),['r2','r100']);}finally{Math.random=random;}
});
console.log(JSON.stringify({passed:reports.length,cases:reports},null,2));
