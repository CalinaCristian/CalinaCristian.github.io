// Validate every published evidence pose format without equating model studies with world parity.
// Every record is checked and every failing record is reported (the run no longer stops at the first one).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {LANDMARKS} from '../../game/src/landmarks.js';
import {evidenceAsset} from '../../game/overview/evidence-paths.js';
const root=fileURLToPath(new URL('../../game/overview/',import.meta.url));
const city=process.argv.find(a=>a.startsWith('--city='))?.slice(7)||process.argv[2]?.replace(/^--.*/, '')||'all';
const available=process.argv.includes('--available');
const sha=/^[a-f0-9]{40}$/;
// The image bytes must be the format the file name claims (the viewer serves .webp, .png and .jpg captures).
const MAGIC={'.webp':b=>b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP','.png':b=>b.toString('hex',0,8)==='89504e470d0a1a0a','.jpg':b=>b.toString('hex',0,3)==='ffd8ff','.jpeg':b=>b.toString('hex',0,3)==='ffd8ff'};
const finite=values=>values.every(Number.isFinite);
// Image path (the same rule the overview viewer and generator apply), bytes, hash, source commit and date.
async function integrity(c,id,fallbackCommit){
 assert(evidenceAsset(c.image,{kind:'landmark',id}),`Capture path is outside this landmark's published evidence: ${c.image}`);
 const image=path.resolve(root,c.image);assert(!path.relative(root,image).startsWith('..'),'Capture path leaves the overview');
 const bytes=await fs.readFile(image),magic=MAGIC[path.extname(image).toLowerCase()];
 assert(magic&&magic(bytes),`Image bytes do not match the ${path.extname(image)} extension: ${c.image}`);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256,`Capture hash mismatch: ${c.image}`);
 assert(sha.test(c.sourceCommit||fallbackCommit||''),`Missing capture source commit: ${c.image}`);
 assert(!Number.isNaN(Date.parse(c.capturedAt)),`Missing capture date: ${c.image}`);
}
async function checkRecord(lm,row){
 let captures=0,historical=0;
 assert.equal(row.schemaVersion,1);assert.equal(row.id,lm.id);assert.equal(row.city,lm.city);assert.equal(row.name,lm.name);
 // Same source identities as the model. Their listing order carries no meaning; duplicates are an error.
 assert(Array.isArray(row.sourceIds)&&new Set(row.sourceIds).size===row.sourceIds.length,'Duplicate source id');
 assert.deepEqual([...row.sourceIds].sort(),[...(lm.sourceIds||[])].sort());
 assert(Math.abs(row.coordinates.lat-lm.lat)<1e-8&&Math.abs(row.coordinates.lon-lm.lon)<1e-8);
 assert(sha.test(row.sourceCommit));assert(row.status&&Array.isArray(row.remainingGaps));
 assert(row.sources.length&&row.improvements.length&&row.checks.length);
 assert(row.sources.every(s=>s.url.startsWith('https://')&&s.label&&s.type));
 // Exactly one front, oblique and top model study; in-world district views (kind "district") are additional.
 assert.deepEqual(row.captures.filter(c=>c.kind!=='district').map(c=>c.kind).sort(),['front','oblique','top']);
 for(const c of row.captures){
  assert(sha.test(c.sourceCommit));await integrity(c,lm.id);
  if(c.kind==='district'){
   // Native district view: the game camera in district metres, with the district it was taken in.
   const p=c.pose;assert(p&&Array.isArray(p.eye)&&p.eye.length===3&&finite(p.eye)&&finite([p.bearing,p.pitch,p.fov]),'District view needs eye, bearing, pitch and fov');
   assert(p.fov>0&&p.fov<180&&Math.abs(p.pitch)<=90);assert(c.label,'District view needs a label');assert(!c.comparison,'A district view is not a matched aerial');
   captures++;continue;
  }
  const pose=c.pose.camera||c.pose;
  if(pose.position){assert(pose.position.length===3&&pose.position.every(Number.isFinite));assert(pose.quaternion.length===4&&Math.abs(Math.hypot(...pose.quaternion)-1)<1e-6);}
  else assert([pose.lat,pose.lon,pose.heading,pose.pitch,pose.cameraY].every(Number.isFinite),'World pose needs exact geographic/camera metadata');
  if(pose.projection==='orthographic'){assert(pose.groundSquareM>0);assert.equal(pose.orientation,'north-up');assert.deepEqual(pose.up,[0,0,-1]);}
  if(c.comparison){
   assert.equal(c.kind,'top');assert.equal(c.comparison.orientation,'north-up');assert([c.comparison.lat,c.comparison.lon,c.comparison.size].every(Number.isFinite));assert(c.comparison.size>0);
   assert.equal(c.width,c.height,'Matched ground square requires a square image');
   assert([pose.lat,pose.lon,pose.cameraY,pose.cameraBaseY,pose.fov].every(Number.isFinite),'Matched aerial needs the actual geographic perspective pose');
   assert(Math.abs(pose.lat-c.comparison.lat)<1e-8&&Math.abs(pose.lon-c.comparison.lon)<1e-8);assert.equal(pose.pitch,-90);assert(Math.abs(pose.heading%360)<1e-8);
   const groundSquareM=2*(pose.cameraY-pose.cameraBaseY)*Math.tan(pose.fov*Math.PI/360);assert(Math.abs(groundSquareM-c.comparison.size)<1e-6,'Aerial ground square agrees with the recorded camera');
  }
  captures++;
 }
 // Superseded captures stay published: each keeps an intact image with its own source commit and date.
 if(row.historicalCollections!==undefined)assert(Array.isArray(row.historicalCollections));
 for(const h of row.historicalCollections||[]){
  assert(h.id&&h.label,'Historical collection needs an id and a label');assert.equal(h.status,'historical');assert(sha.test(h.sourceCommit),'Historical collection needs its source commit');
  assert(Array.isArray(h.captures)&&h.captures.length,'Historical collection without captures');
  for(const c of h.captures){await integrity(c,lm.id,h.sourceCommit);historical++;}
 }
 if(row.historicalCaptures!==undefined)assert(Array.isArray(row.historicalCaptures));
 for(const c of row.historicalCaptures||[]){assert(sha.test(c.sourceCommit),'Historical capture needs its own source commit');await integrity(c,lm.id);historical++;}
 return {captures,historical};
}
let records=0,captures=0,historical=0;const missing=[],failures=[];
for(const lm of LANDMARKS.filter(l=>city==='all'||l.city===city)){
 const file=path.join(root,'evidence/landmarks',lm.city,lm.id+'.json');let row;
 try{row=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'&&available){missing.push(lm.id);continue;}failures.push({id:lm.id,error:String(error.message||error)});continue;}
 try{const n=await checkRecord(lm,row);captures+=n.captures;historical+=n.historical;records++;}
 catch(error){failures.push({id:lm.id,error:String(error.message||error).split('\n').slice(0,12).join('\n')});}
}
console.log(JSON.stringify({passed:!failures.length,city,records,captures,historicalCaptures:historical,missing,failures,scope:'Image/source integrity only; physical world fidelity is a separate acceptance gate'}));
if(failures.length)process.exitCode=1;
