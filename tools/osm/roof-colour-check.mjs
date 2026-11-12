#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import { readDistrictData } from './district-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'roof-colour-fixture-'));
try{
 for(const dir of ['tools','game','tiles','game/research'])fs.mkdirSync(path.join(tmp,dir),{recursive:true});
 fs.cpSync(path.join(root,'tools/osm'),path.join(tmp,'tools/osm'),{recursive:true,filter:f=>!f.includes('/cache/')});fs.cpSync(path.join(root,'game/src'),path.join(tmp,'game/src'),{recursive:true});fs.symlinkSync(path.join(root,'game/vendor'),path.join(tmp,'game/vendor'),'dir');
 const nodes=[],ways=[];let id=1;
 for(let b=0;b<6;b++){
  const lat=47.444+b*.00015,lon=-122.300,ids=[];
  for(const [da,do_]of [[0,0],[0,.00008],[.00005,.00008],[.00005,0]]){nodes.push(`<node id="${id}" lat="${lat+da}" lon="${lon+do_}"/>`);ids.push(id++);}ids.push(ids[0]);
  const t={building:'house',height:'6',...(b===2?{'roof:colour':'#123456'}:{}),...(b===3?{'roof:material':'copper'}:{})};
  ways.push(`<way id="${9100+b}">${ids.map(n=>`<nd ref="${n}"/>`).join('')}${Object.entries(t).map(([k,v])=>`<tag k="${k}" v="${v}"/>`).join('')}</way>`);
 }
 nodes.push(`<node id="${id}" lat="47.443" lon="-122.301"/><node id="${id+1}" lat="47.446" lon="-122.301"/>`);ways.push(`<way id="9999"><nd ref="${id}"/><nd ref="${id+1}"/><tag k="highway" v="residential"/></way>`);
 fs.writeFileSync(path.join(tmp,'tiles/sea_fixture.xml'),'<osm version="0.6">'+nodes.join('')+ways.join('')+'</osm>');
 const roofs={};for(let b=0;b<6;b++)roofs[9100+b]=[b===5?'flat':'unknown',b===5?.9:0,'#9a8c72',37];
 const colourMeasurements={'9100':{hex:'#8d939a',confidence:.85},'9101':{hex:'#557755',confidence:.1},'9102':{hex:'#8d939a',confidence:.85},'9103':{hex:'#8d939a',confidence:.85}};
 fs.writeFileSync(path.join(tmp,'game/research/roofs-seattle-seatac.json'),JSON.stringify({roofs,colourMeasurements}));
 execFileSync(process.execPath,[path.join(tmp,'tools/osm/build-data.mjs'),'--tiles',path.join(tmp,'tiles'),'--districts','--city','seattle','--district','seatac'],{stdio:'pipe'});
 const d=readDistrictData(path.join(tmp,'game/data/seattle-seatac.json')),colour=id=>{const i=d.buildingIds.indexOf('w'+id);assert.ok(i>=0);return d.strings[d.buildings[i][8]]||null;};
 assert.equal(colour(9100),'#8d939a','uncertain gray pitched roof can retain reliable independent colour');
 assert.equal(colour(9101),null,'tree/shadow sample never forces colour');
 assert.equal(colour(9102),'#123456','OSM colour overrides measurement');assert.equal(colour(9103),'#6f9a86','OSM copper material overrides measurement');
 assert.equal(colour(9104),null,'legacy uncertain shape keeps its prior colour behaviour');assert.ok(colour(9105),'legacy confident flat roof keeps its prior colour behaviour');
 assert.equal(d.buildings[d.buildingIds.indexOf('w9100')][5]&16,0,'independent colour is never evidence of measured shape');
 console.log(JSON.stringify({builderCases:7,legacyFourSlotSchemaPreserved:true,independentColourThreshold:.65,issues:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
