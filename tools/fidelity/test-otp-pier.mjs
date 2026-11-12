import assert from 'node:assert/strict';
import fs from 'node:fs';
import { otpPierVolumes, buildOTPPier } from '../../game/src/landmark-otp-pier.js';
import { OTP_PIER_PARTS } from '../../game/src/landmark-otp-source.js';
import { ringArea, footprintCells } from '../../game/src/building-parts.js';
import { readDistrictData } from '../osm/district-data.mjs';
const data=readDistrictData(new URL('../../game/data/bucharest-otopeni.bin.gz', import.meta.url));
const pr=data.proj,ox=(26.0795884-pr.lon0)*pr.mPerLon,oz=-(44.5708154-pr.lat0)*pr.mPerLat,c=Math.cos(-1.4661),s=Math.sin(-1.4661);
const local=([x,z])=>[(x-ox)*c-(z-oz)*s,(x-ox)*s+(z-oz)*c];
const outline=data.buildingFootprints[data.buildingIds.indexOf('w771096083')].map(local),volumes=otpPierVolumes(outline),literal=volumes.slice(0,32);
for(const p of literal){const i=data.buildingIds.indexOf(p.sourceId),row=data.buildings[i];assert.deepEqual(p.ring,data.buildingFootprints[i].map(local));assert.equal(p.h,row[1]/10);assert.equal(p.minH,row[2]/10);}
for(const residual of volumes.slice(32))for(const cell of footprintCells(residual.ring,literal.map(p=>p.ring)))assert.equal(cell.covered.length,0,'Residual invaded literal part');
const residualArea=volumes.slice(32).reduce((n,p)=>n+Math.abs(ringArea(p.ring)),0),expected=footprintCells(outline,literal.map(p=>p.ring)).filter(x=>!x.covered.length).reduce((n,p)=>n+Math.abs(ringArea(p.ring)),0);assert(Math.abs(residualArea-expected)<1e-7);
const colliders=[],faces=[],caps=[];const b={quad(...args){faces.push(args)},cap(...args){caps.push(args)},colPolygon(ring,o){colliders.push({ring,...o})}};
buildOTPPier(b,outline,{},(ring,y)=>caps.push([ring,y]),{pier:{},spine:{}});assert.equal(colliders.length,volumes.length);assert.equal(b.sourceMassAudit.otpPier.literalParts,32);
for(const p of literal.filter(p=>p.kind==='bridge'&&p.minH===5)){const col=colliders.find(c=>c.ring===p.ring);assert(col);assert.equal(col.y0,5);assert.equal(col.y1,8);}
for(const face of faces)for(const point of face.slice(0,4))assert(point.every(Number.isFinite));
for(const r of volumes.slice(32)){const p=literal.find(p=>p.sourceId===r.adjoiningSourceId);assert(p);assert.equal(r.h,p.h);assert.equal(r.minH,p.minH);if(r.kind==='bridge') assert(r.adjoiningDistanceM<.05);}
const result={maxResidualDistanceM:Math.max(...volumes.slice(32).map(p=>p.adjoiningDistanceM)),parts:32,residuals:volumes.length-32,residualArea,wallFaces:faces.length,roofAndUndersidePieces:caps.length,colliders:colliders.length,literalFootprintsAndBandsExact:true,sourceDataUnchanged:true,clearanceRetained:true,scope:'CPU source/partition/render-adapter controls; native visuals still required'};
console.log(JSON.stringify(result,null,2));
