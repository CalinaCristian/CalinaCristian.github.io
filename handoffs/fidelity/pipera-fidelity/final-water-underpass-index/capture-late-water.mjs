// CPU actual World execution through unchanged landmark-owned pool collapse.
// Canvas is the installed native Canvas implementation; no browser/WebGL/actors.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {CITIES} from '../../../../game/src/cities.js';
import {landmarkWaterSurfaces} from '../../../../game/src/final-water-topology.js';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
const [mode,dataFile,outputFile,stage='late']=process.argv.slice(2);if(!outputFile||!['old','candidate'].includes(mode))throw Error('old|candidate DATA OUTPUT required');
const root=path.resolve(new URL('../../../..',import.meta.url).pathname),worldFile=root+'/game/src/world.js',world=mode==='old'?execFileSync('git',['show','720a460a8a1d3dc9ad9f601081196a8d3d22162d:game/src/world.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(worldFile,'utf8');
if(!['late','final'].includes(stage))throw Error('stage must be late|final');
const sourceBytes=fs.readFileSync(dataFile),marker=stage==='late'?'    // landmark collision boxes must not reach into a carriageway':'    if (waterMesh?.isGroup) batchWaterChunks(waterMesh);';if(world.split(marker).length!==2)throw Error('Frozen source marker changed');
const hook=`    const encodeWaterArray=a=>({type:a.constructor.name,data:Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64'),byteLength:a.byteLength});
    const encodeWaterBuilder=mb=>({vc:mb.vc,ic:mb.ic,p:encodeWaterArray(mb.p.slice(0,mb.vc*3)),n:encodeWaterArray(mb.n.slice(0,mb.vc*3)),u:encodeWaterArray(mb.u.slice(0,mb.vc*2)),c:encodeWaterArray(mb.c.slice(0,mb.vc*3)),i:encodeWaterArray(mb.i.slice(0,mb.ic))});
    const captureFinalWater=[];if(globalThis.__captureWaterFinal)group.traverse(object=>{const materials=Array.isArray(object.material)?object.material:[object.material];if(!object.isMesh||!object.geometry?.attributes.position||!materials.some(m=>m&&(m.name==='water'||m.name==='landmark-fountain-water'||m.userData?.waterU)))return;object.updateWorldMatrix(true,false);captureFinalWater.push({name:object.name,positionAttributes:Object.fromEntries(Object.entries(object.geometry.attributes).map(([k,a])=>[k,{itemSize:a.itemSize,normalized:a.normalized,array:encodeWaterArray(a.array)}])),index:object.geometry.index&&encodeWaterArray(object.geometry.index.array),matrixWorld:object.matrixWorld.toArray(),renderOrder:object.renderOrder,visible:object.visible,material:materials.map(m=>({name:m.name,type:m.type,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,depthTest:m.depthTest,colorWrite:m.colorWrite,side:m.side})),drawRange:object.geometry.drawRange});});
    return {scope:'CPU exact-World replay after actual pool collapse or normal final water assembly; not a native browser snapshot',finalWater:globalThis.__captureWaterFinal?captureFinalWater:null,cellOrder:[...cells].map(([key,c])=>({key,i:c.i,j:c.j})),cells:[...cells].filter(([,c])=>!c.water.empty).map(([key,c])=>({key,i:c.i,j:c.j,water:encodeWaterBuilder(c.water)})),bigWater:encodeWaterBuilder(bigWater),ownedWater:areas.filter(a=>a.ownedBy).map(a=>({sourceId:a.sourceId,owner:a.ownedBy,areaIndex:a.areaIndex})),underpassModels:underpassRoofAudit.map(({edge,...r})=>({...r,edgeId:edge.id})),underpassCover:encodeWaterBuilder(underpassCover),underpassColliders:underpassColl.map((c,i)=>({...c,sourceEdgeId:underpassCollEdges[i].id})),landmarkWater:globalThis.__captureLandmarkWater(landmarks).map(s=>({id:s.id,mesh:{p:encodeWaterArray(s.mesh.p),i:encodeWaterArray(s.mesh.i),ic:s.mesh.ic}}))};
`;
const derived=world.replace(marker,stage==='final'?marker+'\n'+hook:hook+marker),temporary=root+'/game/src/.capture-late-water-'+process.pid+'.mjs';if(fs.existsSync(temporary))throw Error('Refuse overwrite');
const saved={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window,Image:globalThis.Image};
globalThis.fetch=async url=>{if(!String(url).endsWith('/data/bucharest-unirii.json'))throw Error('Unexpected CPU fetch '+url);return{json:async()=>JSON.parse(sourceBytes)}};
globalThis.document={createElement(name){if(name!=='canvas')throw Error('Unsupported element '+name);return createCanvas(32,32)},querySelector(){return null}};
globalThis.window={devicePixelRatio:1};globalThis.Image=Image;globalThis.__captureWaterFinal=stage==='final';globalThis.__captureLandmarkWater=landmarkWaterSurfaces;
fs.writeFileSync(temporary,derived);
try{
 const {buildWorld}=await import(pathToFileURL(temporary).href),snapshot=await buildWorld({...CITIES.bucharest},null,{district:'unirii'}),sha=b=>createHash('sha256').update(b).digest('hex');
 const result={mode,stage,worldSourceSha256:sha(world),derivedSourceSha256:sha(derived),dataSha256:sha(sourceBytes),...snapshot};
 fs.writeFileSync(outputFile,JSON.stringify(result));console.log(JSON.stringify({mode,cells:result.cells.length,ownedWater:result.ownedWater,knownRoofs:result.underpassModels.filter(r=>r.known).length,heldRoofs:result.underpassModels.filter(r=>!r.known).length}));
}finally{Object.assign(globalThis,saved);delete globalThis.__captureLandmarkWater;delete globalThis.__captureWaterFinal;fs.unlinkSync(temporary);}
