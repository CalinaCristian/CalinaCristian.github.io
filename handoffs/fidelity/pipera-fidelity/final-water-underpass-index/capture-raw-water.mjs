// CPU-only prefix replay of the pinned actual World code and exact source JSON.
// Stops before roads/landmarks/materials; no DOM/WebGL/browser/production writes.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {CITIES} from '../../../../game/src/cities.js';
const [sourceFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw Error('SOURCE_DATA_JSON OUTPUT_JSON required');
const root=path.resolve(new URL('../../../..',import.meta.url).pathname),worldFile=root+'/game/src/world.js',world=fs.readFileSync(worldFile,'utf8'),sourceBytes=fs.readFileSync(sourceFile);
const marker="    setProgress('Paving the streets…'); await tick();";
if(world.split(marker).length!==2)throw Error('Frozen source marker changed');
const hook=`    const encodeWaterArray=a=>({type:a.constructor.name,data:Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64'),byteLength:a.byteLength});
    const encodeWaterBuilder=mb=>({vc:mb.vc,ic:mb.ic,p:encodeWaterArray(mb.p.slice(0,mb.vc*3)),n:encodeWaterArray(mb.n.slice(0,mb.vc*3)),u:encodeWaterArray(mb.u.slice(0,mb.vc*2)),c:encodeWaterArray(mb.c.slice(0,mb.vc*3)),i:encodeWaterArray(mb.i.slice(0,mb.ic))});
    return {scope:'CPU exact-World prefix snapshot before roads, landmark pool collapse and final4x4 merging; not a native browser snapshot',cellOrder:[...cells].map(([key,c])=>({key,i:c.i,j:c.j})),cells:[...cells].filter(([,c])=>!c.water.empty).map(([key,c])=>({key,i:c.i,j:c.j,water:encodeWaterBuilder(c.water)})),bigWater:encodeWaterBuilder(bigWater),waterAreas:areas.filter(a=>a.kind==='water').map(a=>({sourceId:a.sourceId,name:a.name,areaIndex:a.areaIndex,size:a.size,bounds:[a.x0,a.z0,a.x1,a.z1],waterRange:a.waterMesh&&{v0:a.waterMesh.v0,v1:a.waterMesh.v1}}))};
`;
const derived=world.replace(marker,hook+marker),temporary=root+'/game/src/.capture-water-'+process.pid+'.mjs';
if(fs.existsSync(temporary))throw Error('Refuse overwrite');
const savedFetch=globalThis.fetch;globalThis.fetch=async()=>({json:async()=>JSON.parse(sourceBytes)});
fs.writeFileSync(temporary,derived);
try{
 const {buildWorld}=await import(pathToFileURL(temporary).href),snapshot=await buildWorld({...CITIES.bucharest},null,{district:'unirii'}),sha=b=>createHash('sha256').update(b).digest('hex');
 const result={worldSourceSha256:sha(world),derivedSourceSha256:sha(derived),dataSha256:sha(sourceBytes),sourceFile,...snapshot};
 fs.writeFileSync(outputFile,JSON.stringify(result));console.log(JSON.stringify({cells:result.cells.length,rawWaterTriangles:result.cells.reduce((n,c)=>n+c.water.ic/3,0),rawBigTriangles:result.bigWater.ic/3,dataSha256:result.dataSha256}));
}finally{globalThis.fetch=savedFetch;fs.unlinkSync(temporary);}
