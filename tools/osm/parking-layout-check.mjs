#!/usr/bin/env node
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
import{resolveParkingLayout,parkingRowPose,parkingBearingYaw,parkingBodyOverlap,parkingPolygonsOverlap}from'../../game/src/parking-layout.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),fixture=JSON.parse(fs.readFileSync(path.join(root,'tools/osm/fixtures/us-parking-layouts.json'))),actual=fixture.districts.seatac.measurements.lots.w276643612;
assert.ok(resolveParkingLayout(actual).layout,'reviewed high confidence diagonal source lot applies');
assert.equal(resolveParkingLayout({...actual,confidence:.4}).layout,null,'uncertain angles never forced');
assert.equal(resolveParkingLayout({...actual,mixed:true}).layout,null,'mixed negative control remains estimated');
assert.equal(resolveParkingLayout(actual,{orientation:'perpendicular'}).layout,null,'explicit OSM orientation wins over measured diagonal');
assert.ok(resolveParkingLayout(actual,{orientation:'diagonal'}).layout,'compatible OSM class permits independently measured absolute angles');
assert.equal(resolveParkingLayout(actual,{'parking:layout':'parallel'}).layout,null,'OSM layout conflict remains source fact');
assert.equal(resolveParkingLayout({...actual,evidence:{}}).layout,null,'confidence alone cannot force measurement without reviewable evidence');
assert.notEqual(parkingRowPose(actual,0).stallYaw%Math.PI,parkingRowPose(actual,1).stallYaw%Math.PI,'independently measured alternating diagonal stall families remain distinct');
assert.ok(parkingRowPose(actual,0).stallPitchM>2.6,'diagonal spacing accounts for perpendicular vehicle separation');
assert.equal(parkingBearingYaw(90),Math.PI/2);
const car=[[-1,-2.5],[1,-2.5],[1,2.5],[-1,2.5]],thinBuilding={outer:[[-3,-.1],[3,-.1],[3,.1],[-3,.1]]};
assert.ok(parkingBodyOverlap(car,thinBuilding),'thin body crossing whole car is rejected even if no car corner lies inside');
assert.equal(parkingBodyOverlap(car,{...thinBuilding,minHeightM:3}),false,'mapped clear underside is not a ground obstruction');
assert.equal(parkingBodyOverlap(car,{outer:[[-5,-5],[5,-5],[5,5],[-5,5]],holes:[[[-2,-3],[2,-3],[2,3],[-2,3]]]}),false,'whole car inside a source courtyard remains allowed');
assert.ok(parkingBodyOverlap(car,{outer:[[-5,-5],[5,-5],[5,5],[-5,5]],holes:[[[-.5,-3],[2,-3],[2,3],[-.5,3]]]}),'crossing a courtyard boundary remains rejected');
assert.ok(parkingPolygonsOverlap(car,[[-3,-.1],[3,-.1],[3,.1],[-3,.1]]),'sidewalk crossing middle of the whole car is rejected');
assert.equal(parkingPolygonsOverlap(car,[[4,4],[6,4],[6,6],[4,6]]),false,'valid separated parked footprint remains unchanged');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'parking-source-fixture-'));try{
 fs.mkdirSync(path.join(tmp,'game/research'),{recursive:true});fs.mkdirSync(path.join(tmp,'tiles'));fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 const nodes=new Map(),ways=[];const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');for(const[d,entry]of Object.entries(fixture.districts)){fs.writeFileSync(path.join(tmp,`game/research/parking-layouts-seattle-${d}.json`),JSON.stringify(entry.measurements));for(const w of entry.ways){w.nodeIds.forEach((id,i)=>nodes.set(id,w.coordinates[i]));ways.push(`<way id="${w.id}">${w.nodeIds.map(id=>`<nd ref="${id}"/>`).join('')}${Object.entries(w.tags).map(([k,v])=>`<tag k="${esc(k)}" v="${esc(v)}"/>`).join('')}</way>`);}}
 nodes.set(90000001,[47.443,-122.300]);nodes.set(90000002,[47.450,-122.300]);nodes.set(90000003,[47.617,-122.198]);nodes.set(90000004,[47.617,-122.191]);for(const[id,a,b]of[[900001,90000001,90000002],[900002,90000003,90000004]])ways.push(`<way id="${id}"><nd ref="${a}"/><nd ref="${b}"/><tag k="highway" v="residential"/></way>`);
 fs.writeFileSync(path.join(tmp,'tiles/sea_fixture.xml'),'<osm version="0.6">'+[...nodes].map(([id,[lat,lon]])=>`<node id="${id}" lat="${lat}" lon="${lon}"/>`).join('')+ways.join('')+'</osm>');
 execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--city','seattle','--district','seatac,bellevue'],{stdio:'pipe'});
 for(const[d,entry]of Object.entries(fixture.districts)){const data=JSON.parse(fs.readFileSync(path.join(tmp,`game/data/seattle-${d}.json`))),p=data.proj;for(const w of entry.ways){const i=data.areaSourceIds.indexOf('w'+w.id);assert.ok(i>=0,'exact source area identity remains');const rings=data.parkingFootprints[i];assert.equal(rings[0].length,w.nodeIds.length-1,'every source parking vertex remains without simplification');for(let j=0;j<rings[0].length;j++){const[la,lo]=w.coordinates[j],expected=[(lo-p.lon0)*p.mPerLon,-(la-p.lat0)*p.mPerLat];assert.ok(Math.hypot(rings[0][j][0]-expected[0],rings[0][j][1]-expected[1])<1e-8,'literal projected source lot geometry remains exact');}const measurement=entry.measurements.lots['w'+w.id];assert.equal(!!data.parkingLayouts?.[i],!measurement.mixed,'only independently reliable measured source lot changes angle');}}
 console.log(JSON.stringify({actualSourceLots:4,measuredLots:2,mixedNegativeControls:2,orientationAndFullCarCases:16,sourceLotVerticesRetained:true,issues:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
