// Validate all three evidence pose formats without equating model studies with world parity.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {LANDMARKS} from '../../game/src/landmarks.js';
const root=fileURLToPath(new URL('../../game/overview/',import.meta.url));
const city=process.argv.find(a=>a.startsWith('--city='))?.slice(7)||process.argv[2]?.replace(/^--.*/, '')||'all';
const available=process.argv.includes('--available');
let records=0,captures=0;const missing=[];
for(const lm of LANDMARKS.filter(l=>city==='all'||l.city===city)){
 const file=path.join(root,'evidence/landmarks',lm.city,lm.id+'.json');let row;
 try{row=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'&&available){missing.push(lm.id);continue;}throw error;}
 assert.equal(row.schemaVersion,1);assert.equal(row.id,lm.id);assert.equal(row.city,lm.city);assert.equal(row.name,lm.name);
 assert.deepEqual(row.sourceIds,lm.sourceIds||[]);
 assert(Math.abs(row.coordinates.lat-lm.lat)<1e-8&&Math.abs(row.coordinates.lon-lm.lon)<1e-8);
 assert(/^[a-f0-9]{40}$/.test(row.sourceCommit));assert(row.status&&Array.isArray(row.remainingGaps));
 assert(row.sources.length&&row.improvements.length&&row.checks.length);
 assert(row.sources.every(s=>s.url.startsWith('https://')&&s.label&&s.type));
 assert.deepEqual(row.captures.map(c=>c.kind).sort(),['front','oblique','top']);
 for(const c of row.captures){
  assert(/^[a-f0-9]{40}$/.test(c.sourceCommit));assert(!Number.isNaN(Date.parse(c.capturedAt)));
  const image=path.resolve(root,c.image);assert(image.startsWith(path.join(root,'assets/landmarks',lm.id)+path.sep));
  const bytes=await fs.readFile(image);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
  const pose=c.pose.camera||c.pose;
  if(pose.position){assert(pose.position.length===3&&pose.position.every(Number.isFinite));assert(pose.quaternion.length===4&&Math.abs(Math.hypot(...pose.quaternion)-1)<1e-6);}
  else assert([pose.lat,pose.lon,pose.heading,pose.pitch,pose.cameraY].every(Number.isFinite),'World pose needs exact geographic/camera metadata');
  if(pose.projection==='orthographic'){assert(pose.groundSquareM>0);assert.equal(pose.orientation,'north-up');assert.deepEqual(pose.up,[0,0,-1]);}
  assert(!c.comparison,'Published model studies currently do not claim a matched world aerial pair');captures++;
 }
 records++;
}
console.log(JSON.stringify({passed:true,city,records,captures,missing,scope:'Image/source integrity only; physical world fidelity is a separate acceptance gate'}));
