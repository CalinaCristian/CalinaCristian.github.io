#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
import { readDistrictData } from './district-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),fixture=JSON.parse(fs.readFileSync(path.join(root,'tools/osm/fixtures/us-reviewed-roof-shapes.json'))),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'reviewed-source-roofs-'));
try{
 fs.mkdirSync(path.join(tmp,'tiles'),{recursive:true});fs.mkdirSync(path.join(tmp,'game/research'),{recursive:true});fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),tags=t=>Object.entries(t).map(([k,v])=>`<tag k="${esc(k)}" v="${esc(v)}"/>`).join(''),rawNodes=new Map(fixture.nodes.map(n=>[n.id,n.coordinates]));
 const nodes=fixture.nodes.map(n=>`<node id="${n.id}" lat="${n.coordinates[0]}" lon="${n.coordinates[1]}"/>`).join(''),ways=fixture.ways.map(w=>`<way id="${w.id}">${w.nodes.map(n=>`<nd ref="${n}"/>`).join('')}${tags(w.tags)}</way>`).join(''),r=fixture.relation;
 fs.writeFileSync(path.join(tmp,'tiles/sea_fixture.xml'),`<osm version="0.6">${nodes}${ways}<relation id="${r.id}">${r.members.map(m=>`<member type="${m.type}" ref="${m.ref}" role="${m.role}"/>`).join('')}${tags(r.tags)}</relation><node id="999000001" lat="47.617" lon="-122.197"/><node id="999000002" lat="47.617" lon="-122.193"/><way id="999000003"><nd ref="999000001"/><nd ref="999000002"/><tag k="highway" v="residential"/></way></osm>`);
 fs.writeFileSync(path.join(tmp,'game/research/roofs-seattle-bellevue.json'),JSON.stringify(fixture.aerial));
 execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--city','seattle','--district','bellevue'],{stdio:'pipe'});
 const d=readDistrictData(path.join(tmp,'game/data/seattle-bellevue.json')),P=ll=>[(ll[1]-d.proj.lon0)*d.proj.mPerLon,-(ll[0]-d.proj.lat0)*d.proj.mPerLat];
 for(const[id,expected]of Object.entries(fixture.expected)){
  const i=d.buildingIds.indexOf(id);assert.ok(i>=0,'actual source identity retained');assert.equal(d.buildingRoofProfiles[i].shape,expected,'reviewed shape applies while literal OSM shape retains priority');
  const raw=fixture.ways.find(w=>'w'+w.id===id),ring=d.buildingFootprints[i];assert.equal(ring.length,raw.nodes.length-1,'every arbitrary source vertex retained');for(const ni of raw.nodes.slice(0,-1)){const p=P(rawNodes.get(ni));assert.ok(ring.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.0001),'source ring is never replaced by a rectangle');}
 }
 const i=d.buildingIds.indexOf('r'+r.id);assert.ok(i>=0);for(const m of r.members){const w=fixture.ways.find(w=>w.id===m.ref),ring=m.role==='inner'?d.buildingHoleFootprints[i][0]:d.buildingFootprints[i];assert.equal(ring.length,w.nodes.length-1);for(const ni of w.nodes.slice(0,-1)){const p=P(rawNodes.get(ni));assert.ok(ring.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.0001),'source courtyard boundary retained');}}
 assert.ok(/estimate/.test(d.buildingRoofProfiles[d.buildingIds.indexOf('w111868853')].riseSource),'unmeasured pitch/rise remains an estimate');
 console.log(JSON.stringify({actualMeasuredBuildings:2,actualOSMShapePriorityControls:2,actualMultipolygonCourtyardControl:1,arbitrarySourceVerticesRetained:true,issues:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
