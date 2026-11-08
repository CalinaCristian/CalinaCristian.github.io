import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { LANDMARKS } from '../../game/src/landmarks.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),city=process.argv.find(a=>a.startsWith('--city='))?.slice(7)||'seattle';
const models=LANDMARKS.filter(l=>l.city===city),dir=path.join(root,'game/overview/evidence/landmarks',city),hashes=new Set();let captures=0;
for(const lm of models){
 const row=JSON.parse(await fs.readFile(path.join(dir,lm.id+'.json'),'utf8'));
 assert.equal(row.schemaVersion,1);assert.equal(row.id,lm.id);assert.equal(row.city,city);assert.equal(row.name,lm.name);
 assert.deepEqual(row.sourceIds,lm.sourceIds||[]);assert(Math.abs(row.coordinates.lat-lm.lat)<1e-8);assert(Math.abs(row.coordinates.lon-lm.lon)<1e-8);
 assert(row.improvements.length&&row.remainingGaps.length,'Reviewed models must state changes and limits');assert(row.sources.length,'Every model needs independently inspectable sources');
 assert.deepEqual(row.captures.map(c=>c.kind).sort(),['front','oblique','top']);
 for(const c of row.captures){
  assert(/^[0-9a-f]{40}$/.test(c.sourceCommit),'Capture commits must be exact');assert(!Number.isNaN(Date.parse(c.capturedAt)));
  assert(c.image.startsWith('assets/landmarks/'+lm.id+'/'));assert(!c.image.includes('..'));assert(/isolated model study/i.test(c.label),'Do not imply a matched ground comparison');
  const bytes=await fs.readFile(path.join(root,'game/overview',c.image));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256,'Published image hash mismatch');
  assert(c.pose.position.length===3&&c.pose.position.every(Number.isFinite));assert(c.pose.quaternion.length===4&&Math.abs(Math.hypot(...c.pose.quaternion)-1)<1e-6);
  if(c.kind==='top'){assert.equal(c.pose.projection,'orthographic');assert.equal(c.pose.orientation,'north-up');assert.deepEqual(c.pose.up,[0,0,-1]);assert(c.pose.groundSquareM>0);}
  assert(!c.comparison,'Isolated studies cannot claim a matched world ground square');hashes.add(c.sha256);captures++;
 }
}
assert.equal(captures,models.length*3);console.log(JSON.stringify({passed:true,city,models:models.length,captures,uniqueGameImages:hashes.size,notes:['Hashes verify published game-only WebP files, not source photographs.','Source-policy, whole-world fidelity and seasonal acceptance remain separate.']},null,2));
