#!/usr/bin/env node
// Source/collision controls for explicitly mapped aircraft exhibits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFiles } from './parse-osm.mjs';
import { aircraftBody } from '../../game/src/building-aircraft.js';
import { pointInPolygon, distPointSeg } from '../../game/src/util.js';
import { collideBuildings } from '../../game/src/world.js';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const d=JSON.parse(fs.readFileSync(args.data));
const raw=parseFiles(fs.readdirSync(args.osm).filter(f=>f.endsWith('.xml')).map(f=>path.join(args.osm,f)));
const report=[];
for(const [key,meta] of Object.entries(d.buildingAircraft||{})){
    const i=+key,id=d.buildingIds[i],w=raw.ways.get(+id.slice(1));
    assert.ok(w&&(w.tags.historic==='aircraft'||w.tags.aeroway==='aircraft'),'only explicit source aircraft have aircraft meaning');
    assert.equal(meta.sourceId,id);
    const ring=d.buildingFootprints[i],height=d.buildingDimensions?.[i]?.[0]??d.buildings[i][1]/10,body=aircraftBody(ring,height);
    assert.ok(body&&body.faces.length>0,'a valid source plan produces a finite low aircraft body');
    const inside=p=>pointInPolygon(p[0],p[1],ring)||ring.some((a,j)=>distPointSeg(p[0],p[1],...a,...ring[(j+1)%ring.length]).d<.001);
    assert.ok(body.footprint.every(inside),'estimated fuselage stays inside its mapped planform');
    for(const f of [...body.faces,body.tail])for(const p of f)assert.ok(p.every(Number.isFinite)&&p[1]>=0&&p[1]<=height+.001,'aircraft vertical detail stays within its declared envelope');
    const p=body.footprint.reduce((s,q)=>[s[0]+q[0]/body.footprint.length,s[1]+q[1]/body.footprint.length],[0,0]);
    const collider={x:p[0],z:p[1],r:100,poly:body.footprint,holes:[],minH:body.bodyBaseM,h:body.bodyTopM,y1:body.bodyTopM};
    assert.ok(collideBuildings([collider],...p,.4,.24),'a ground vehicle cannot drive through the fuselage');
    assert.equal(collideBuildings([collider],...p,.4,height+.5),null,'flight above the source envelope remains clear');
    report.push({source:id,heightM:height,faces:body.faces.length+2,planVertices:ring.length,dimensionSource:meta.dimensionsSource});
}
assert.ok(report.length>0,'the fixture actually contains source aircraft');
console.log(JSON.stringify({count:report.length,aircraft:report},null,2));
