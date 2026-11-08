#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'positive-level-fixture-'));
try{
 for(const dir of ['tools','game','tiles','game/research'])fs.mkdirSync(path.join(tmp,dir),{recursive:true});
 fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 const source=JSON.parse(fs.readFileSync(path.join(root,'tools/osm/fixtures/seatac-positive-levels.json'))),nodes=Object.entries(source.nodes).map(([id,[lat,lon]])=>`<node id="${id}" lat="${lat}" lon="${lon}"/>`),ways=source.ways.map(w=>`<way id="${w.id}">${w.nodeIds.map(id=>`<nd ref="${id}"/>`).join('')}${Object.entries(w.tags).map(([k,v])=>`<tag k="${k}" v="${v.replaceAll('&','&amp;').replaceAll('"','&quot;')}"/>`).join('')}</way>`);
 let nid=90000001;
 const extra=[{building:'yes',height:'35ft','building:levels':'9'},{building:'yes'},{building:'church','building:levels':'7'},{building:'stadium','building:levels':'14'}];
 for(const [i,tags]of extra.entries()){
  const lat=47.445+i*.0006,lon=-122.295,ids=[];
  for(const [da,dl]of [[0,0],[0,.0005],[.0005,.0005],[.0005,0]]){nodes.push(`<node id="${nid}" lat="${lat+da}" lon="${lon+dl}"/>`);ids.push(nid++);}ids.push(ids[0]);
  ways.push(`<way id="${99000+i}">${ids.map(id=>`<nd ref="${id}"/>`).join('')}${Object.entries(tags).map(([k,v])=>`<tag k="${k}" v="${v}"/>`).join('')}</way>`);
 }
 nodes.push('<node id="99999991" lat="47.444" lon="-122.296"/><node id="99999992" lat="47.452" lon="-122.296"/>');ways.push('<way id="9999999"><nd ref="99999991"/><nd ref="99999992"/><tag k="highway" v="residential"/></way>');
 fs.writeFileSync(path.join(tmp,'tiles/sea_fixture.xml'),'<osm version="0.6">'+nodes.join('')+ways.join('')+'</osm>');
 execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--districts','--city','seattle','--district','seatac'],{stdio:'pipe'});
 const d=JSON.parse(fs.readFileSync(path.join(tmp,'game/data/seattle-seatac.json'))),record=id=>{const i=d.buildingIds.indexOf('w'+id);assert.ok(i>=0,'source identity retained w'+id);return {b:d.buildings[i],h:d.buildingDimensions?.[i]?.[0]??d.buildings[i][1]/10,p:d.buildingRoofProfiles[i]};};
 for(const [id,levels]of [[314940617,7],[314940620,5],[23772636,2]]){const r=record(id);assert.equal(r.b[6],levels);assert.ok(Math.abs(r.h-levels*3.2)<1e-8,'source levels reach normal estimated storey spacing');assert.equal(r.p.heightSource,'OSM building:levels estimate');}
 const literal=record(99000);assert.ok(Math.abs(literal.h-10.668)<1e-8,'literal imperial height wins over levels');assert.equal(literal.p.heightSource,'OSM height');
 assert.ok(record(99001).h>0,'untagged source still receives an explicit estimate');assert.equal(record(99001).p.heightSource,'style estimate');
 assert.ok(Math.abs(record(99002).p.eavesM-7*3.2)<1e-8,'religious height fallback cannot ignore positive source levels');
 assert.ok(Math.abs(record(99003).h-14*3.2)<1e-8,'source grandstand levels cannot be truncated by legacy30m cap');
 console.log(JSON.stringify({actualSourceWays:3,builderCases:7,positiveLevelsPreserved:true,literalImperialHeightPreserved:true,issues:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
