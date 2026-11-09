// CPU-only exact production through retaining-wall generation; no browser/renderer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),freeze=path.resolve(process.argv[3]||'/workspace/integration-qa-evidence/all8-4378317'),out=path.resolve(process.argv[4]||'/tmp/romana-wall-comparison.json');
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const block=s=>s.slice(s.indexOf('        blocksLane = '),s.indexOf('        const cutWalls = '));
const current=fs.readFileSync(path.join(root,'game/src/world.js'),'utf8');
const baseline=execFileSync('git',['show','0775fdaf15442a46c3fe98f4e6875c9c09046a99:game/src/world.js'],{cwd:root,encoding:'utf8'});
assert.equal(current.replace(block(current),block(baseline)),baseline,'candidate contains only reviewed wall-rule change');
async function run(label,dir,source){
 let extracted=source.slice(0,source.indexOf('    // ---- district edge (chapters):'));
 assert.ok(extracted.length>20000);
 const start=source.indexOf('    function surfacesAt('),end=source.indexOf('    const world = {',start);
 extracted+='\n'+source.slice(start,end)+`\nreturn {walls,wallCut,cells,edges,nodeArr,ribbons,data};\n}\n`;
 extracted+=source.slice(source.indexOf('function mixRgb('));
 extracted=extracted.replace(/from '(\.[^']+)'/g,(_,p)=>`from '${new URL(p,pathToFileURL(path.join(dir,'game/src/world.js'))).href}'`);
 extracted=extracted.replace(/^    const url = new URL.*$/m,'    const url = '+JSON.stringify(pathToFileURL(path.join(dir,'game/data/bucharest-romana.json')).href)+';');
 const {CITIES}=await import(pathToFileURL(path.join(dir,'game/src/cities.js')));
 const savedFetch=globalThis.fetch;globalThis.fetch=async p=>({json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(p),'utf8'))});
 let world;try{const {buildWorld}=await import('data:text/javascript;base64,'+Buffer.from(extracted).toString('base64'));world=await buildWorld({...CITIES.bucharest},null,{district:'romana'});}finally{globalThis.fetch=savedFetch}
 const edge=e=>e?{id:e.id,sourceId:world.data.roadSourceGeometry?.[e.road]?.sourceId,a:[e.a.sourceId,e.a.x,e.a.z,e.ya],b:[e.b.sourceId,e.b.x,e.b.z,e.yb]}:null;
 const walls=world.walls.map(w=>Object.fromEntries(Object.entries(w).map(([k,v])=>[k,k==='edge'?edge(v):k==='node'?{id:v.id,sourceId:v.sourceId,x:v.x,z:v.z}:v])));
 const cells=[...world.cells.values()].map(c=>({i:c.i,j:c.j,builders:Object.fromEntries(Object.entries(c).filter(([k,v])=>v&&ArrayBuffer.isView(v.p)).map(([k,v])=>[k,{vc:v.vc,ic:v.ic,attributes:Object.fromEntries(Object.entries({p:3*v.vc,n:3*v.vc,u:2*v.vc,c:3*v.vc,t:v.vc,i:v.ic}).filter(([a,b])=>v[a]).map(([a,b])=>{const view=v[a].subarray(0,b);return[a,{type:view.constructor.name,length:view.length,sha256:sha(Buffer.from(view.buffer,view.byteOffset,view.byteLength))}]}))}]))}));
 assert.ok(cells.some(c=>Object.keys(c.builders).length>0),'typed mesh arrays captured');
 const result={label,sourceRoot:dir,worldSha256:sha(source),dataSha256:sha(fs.readFileSync(path.join(dir,'game/data/bucharest-romana.json'))),edges:world.edges.length,ribbons:world.ribbons.length,wallCut:world.wallCut,wallCount:walls.length,wallSha256:sha(walls),cellCount:cells.length,cellBuilderSha256:sha(cells),cells,walls};
 console.log(JSON.stringify({...result,walls:undefined,cells:undefined}));return result;
}
const before=await run('0775-baseline',root,baseline),after=await run('0775-candidate2',root,current),old=await run('437-soak-source',freeze,fs.readFileSync(path.join(freeze,'game/src/world.js'),'utf8'));
const report={method:'Exact production buildWorld from loading through all retaining-wall generation/cuts/visible barrier emission, plus actual hoisted surfacesAt, executed with source-native imports/data. Stops before district closures/buildings; later closures/landmark/play-area changes are outside this rule. No canvas, browser or renderer. Full cell MeshBuilder arrays and every retained wall compared without rounded coordinates.',before,after,soak:old,candidateEquivalent:before.wallSha256===after.wallSha256&&before.cellBuilderSha256===after.cellBuilderSha256,soakEquivalent:old.wallSha256===after.wallSha256&&old.cellBuilderSha256===after.cellBuilderSha256};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({candidateEquivalent:report.candidateEquivalent,soakEquivalent:report.soakEquivalent}));if(!report.candidateEquivalent)process.exitCode=1;
