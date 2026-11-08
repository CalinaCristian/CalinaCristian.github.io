// Validate published per-landmark evidence as consumed by the overview UI.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../game/overview/',import.meta.url));
const city=process.argv[2]||'bucharest';
const directory=path.join(root,'evidence/landmarks',city);
const files=(await fs.readdir(directory)).filter(x=>x.endsWith('.json'));let captures=0;
for(const file of files){
 const record=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
 assert.equal(record.schemaVersion,1);assert.equal(record.city,city);assert.equal(file,record.id+'.json');
 assert(/^[0-9a-f]{40}$/.test(record.sourceCommit),`${file}: immutable source SHA`);
 assert(record.status&&record.remainingGaps.length,`${file}: honest review status and gaps`);
 assert(Number.isFinite(record.coordinates.lat)&&Number.isFinite(record.coordinates.lon));
 assert(record.sources.length&&record.improvements.length&&record.checks.length);
 assert(record.sources.every(s=>s.url.startsWith('https://')&&s.label&&s.type));
 assert.equal(record.captures.length,3);assert.deepEqual(new Set(record.captures.map(c=>c.kind)),new Set(['front','top','oblique']));
 for(const capture of record.captures){
  const target=path.resolve(root,capture.image);assert(target.startsWith(path.join(root,'assets/landmarks',record.id)+path.sep));
  const bytes=await fs.readFile(target);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),capture.sha256,`${file}: published image checksum`);
  assert(/^[0-9a-f]{40}$/.test(capture.sourceCommit));assert(!Number.isNaN(Date.parse(capture.capturedAt)));
  const camera=capture.pose.camera;assert(camera.position.length===3&&camera.quaternion.length===4&&camera.viewport.length===2);
  assert([...camera.position,...camera.quaternion,camera.fov,camera.near,camera.far,...camera.viewport].every(Number.isFinite));
  assert(capture.pose.viewerRoute.includes('id='+record.id));
  assert(!capture.comparison,`${file}: perspective model studies must not claim an aerial-matched pair`);captures++;
 }
}
if(city==='bucharest'){
 const facts=JSON.parse(await fs.readFile(new URL('../../game/research/landmark-source-bucharest.json',import.meta.url),'utf8'));
 assert.deepEqual(new Set(files.map(f=>f.slice(0,-5))),new Set(facts.landmarks.map(l=>l.id)),'All owned source-reviewed landmarks have individual evidence');
}
console.log(JSON.stringify({passed:true,city,records:files.length,captures,publishedBytes:'SHA256 verified'}));
