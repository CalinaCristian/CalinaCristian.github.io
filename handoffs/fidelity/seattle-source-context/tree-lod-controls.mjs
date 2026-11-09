// CPU geometry/selection controls. No browser, source overrides or screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {buildSpeciesTrees} from '../../../game/src/trees.js';
import {buildTrees} from '../../../game/src/spots/osm.js';
import {addSourceContextTrees} from '../../../game/src/spots/source-context-landscape.js';
const BASE='3f8f86be7835bc541f2323bd5f5178e29e81be7e',checks=[];
async function original(file){const source=execFileSync('git',['show',BASE+':'+file],{encoding:'utf8'}),url=pathToFileURL(process.cwd()+'/'+file);return import('data:text/javascript;base64,'+Buffer.from(source.replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,s)=>'from '+q+new URL(s,url).href+q)).toString('base64'));}
const oldSpecies=(await original('game/src/trees.js')).buildSpeciesTrees,oldNative=(await original('game/src/spots/osm.js')).buildTrees;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),record=(name,fn)=>{fn();checks.push({name,passed:true});};
function snapshot(group){const out=[];group.traverse(m=>{if(!m.isMesh)return;out.push({name:m.name,count:m.count,castShadow:m.castShadow,receiveShadow:m.receiveShadow,geometry:Object.fromEntries([...Object.entries(m.geometry.attributes).map(([k,v])=>[k,hash(Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength))]),['index',m.geometry.index?hash(Buffer.from(m.geometry.index.array.buffer)):null]]),matrices:hash(Buffer.from(m.instanceMatrix.array.buffer,m.instanceMatrix.array.byteOffset,m.count*16*4))});});return out;}
function activeCount(group,match){let count=0;group.traverse(m=>{if(!m.isInstancedMesh||!match(m.name))return;for(let i=0;i<m.count;i++){const e=m.instanceMatrix.array.subarray(i*16,i*16+16);if(e[0]||e[5]||e[10])count++;}});return count;}
const speciesList=Array.from({length:60},(_,i)=>({id:'n'+i,x:(i%10)*23-100,z:Math.floor(i/10)*23-50,y:i%4,s:1+(i%3)*.1,species:i%2?'plane':'conifer'}));
const nativeList=Array.from({length:60},(_,i)=>({id:'n'+i,x:(i%10)*23-100,z:Math.floor(i/10)*23-50,y:i%4,s:1+(i%3)*.1,kind:i%2?'broad':'con'}));
const stableInput=JSON.stringify({speciesList,nativeList}),options={near:90,maxNear:30,chunk:80,rng:()=>.4},nativeOptions={seed:17,lod:{near:90,max:20}},ground={heightAt:()=>0};
const sp=buildSpeciesTrees(speciesList,options),oldSp=oldSpecies(speciesList,options),nt=buildTrees(nativeList,ground,nativeOptions),oldNt=oldNative(nativeList,ground,nativeOptions);
for(const [x,z]of [[0,0],[50,0],[-100,-50]]){sp.update(x,z);oldSp.update(x,z);nt.update(x,z);oldNt.update(x,z);record('two-argument exact emitted geometry/matrices/shadows at '+x+','+z,()=>{assert.deepEqual(snapshot(sp.group),snapshot(oldSp.group));assert.deepEqual(snapshot(nt.group),snapshot(oldNt.group));});}
const colliderBefore=JSON.stringify(nt.colliders),geomBefore=snapshot(nt.group).map(({geometry})=>geometry);
nt.update(0,0,155.75);sp.update(0,0,155.75);
record('vertical-only elevator motion changes native detail',()=>assert.equal(activeCount(nt.group,n=>!n.endsWith(' low')&&n.startsWith('treeCrowns')),0));
record('vertical-only elevator motion changes species detail',()=>assert.equal(activeCount(sp.group,n=>n.startsWith('treeCrowns near')),0));
record('every native crown remains in the far variants',()=>assert.equal(activeCount(nt.group,n=>n.startsWith('treeCrowns')&&n.endsWith(' low')),nativeList.length));
record('every source crown remains in the far variants',()=>assert.equal(activeCount(sp.group,n=>n.startsWith('treeCrowns')&&n.endsWith(' far')),speciesList.length));
record('geometry and colliders survive detail changes exactly',()=>{assert.equal(JSON.stringify(nt.colliders),colliderBefore);assert.deepEqual(snapshot(nt.group).map(({geometry})=>geometry),geomBefore);assert.equal(JSON.stringify({speciesList,nativeList}),stableInput);});
// The current native observation recorded this real child-camera world transform.
const raw=JSON.parse(fs.readFileSync(process.argv[2]||new URL('./proof/tree-lod/native-camera.json',import.meta.url)));
const frame=raw.scopes.find(s=>s.spot==='space-needle').frames.find(f=>f.label==='native-elevator-arrival-downtown');
const parent=new THREE.Object3D(),camera=new THREE.PerspectiveCamera();parent.add(camera);parent.matrixAutoUpdate=false;parent.matrix.fromArray(frame.camera.worldMatrix);parent.updateMatrixWorld(true);
let updater;const fixture=[{id:'n-near-world',x:15.389047024857273,z:9.364909686871892,tags:{height:'12'}},{id:'n-local-trap',x:1000,z:0,tags:{height:'12'}}];
const ctx={data:{trees:[]},ground:{terrainHeightAt:()=>0},extras:{sourceContext:{water:{waterAt:()=>null}}},crownMeshes:[],add(){},onUpdate(fn){updater=fn;}};
addSourceContextTrees(ctx,{trees:fixture});const treeGroup=ctx.extras.sourceContext.trees.group;
updater(0,{camera});
record('actual native child-camera matrix selects no ground near trees at Loupe',()=>{assert.deepEqual(camera.position.toArray(),[0,0,0]);assert.equal(activeCount(treeGroup,n=>n.startsWith('treeCrowns near')),0);});
parent.matrix.elements[13]=1.65;parent.updateMatrixWorld(true);updater(0,{camera});
record('same native world XZ at ground height selects its source crown',()=>assert.equal(activeCount(treeGroup,n=>n.startsWith('treeCrowns near')),1));
parent.matrix.elements[12]=1000;parent.matrix.elements[14]=0;parent.updateMatrixWorld(true);updater(0,{camera});
record('world movement follows the actual eye rather than local camera zero',()=>{const m=treeGroup.children.find(m=>m.name==='treeTrunks near');assert.equal(m.count,1);assert.equal(m.instanceMatrix.array[12],1000);});
// Derive selection height from actual emitted crown geometry, not declared tree height.
const high=buildSpeciesTrees([{x:0,z:0,y:130,s:2,species:'plane'}],{near:20,maxNear:10,rng:()=>.4});high.update(0,0);
const crown=high.group.children.find(m=>m.name==='treeCrowns near plane'),matrix=new THREE.Matrix4().fromArray(crown.instanceMatrix.array),centre=crown.geometry.boundingSphere.center.clone().applyMatrix4(matrix);
high.update(centre.x,centre.z,centre.y);
record('tall crown selection uses actual emitted transformed centre',()=>assert.equal(crown.count,1));
high.update(centre.x,centre.z,centre.y+50);
record('same XZ outside actual crown-centre radius returns to far detail',()=>assert.equal(crown.count,0));
const forced=buildTrees([{x:0,z:0,y:0,s:1,kind:'broad'}],ground,{lod:{force:true,near:90,max:700}});forced.update(0,0,155.75);
record('scene force selects existing far variants for small groups without dropping records',()=>assert.equal(activeCount(forced.group,n=>n.startsWith('treeCrowns')&&n.endsWith(' low')),1));
nt.update(0,0);oldNt.update(0,0);sp.update(0,0);oldSp.update(0,0);
record('returning to two arguments restores exact historical selection',()=>{assert.deepEqual(snapshot(nt.group),snapshot(oldNt.group));assert.deepEqual(snapshot(sp.group),snapshot(oldSp.group));});
console.log(JSON.stringify({base:BASE,nativeFixtureSource:raw.sourceCommit,nativeFixtureSHA256:hash(fs.readFileSync(process.argv[2]||new URL('./proof/tree-lod/native-camera.json',import.meta.url))),checks:checks.length,passed:checks.every(c=>c.passed),results:checks},null,2));
