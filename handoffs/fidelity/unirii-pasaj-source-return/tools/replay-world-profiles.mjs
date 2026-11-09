// Isolated CPU execution of the unchanged World graph/profile prefix. This is
// not a native scene, renderer, terrain, geometry or driving acceptance test.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), sample=require('./sample-native-profiles.cjs');
const [root,dataFile,queriesFile,outFile,nativeFixtureFile]=process.argv.slice(2);
if(!outFile)throw Error('SOURCE_ROOT DATA QUERIES OUT required');
const sourceFile=path.join(root,'game/src/world.js'),source=fs.readFileSync(sourceFile,'utf8');
const marker='    coveredRoadModels.validateProfile(edges);',cut=source.indexOf(marker);
if(cut<0||source.indexOf(marker,cut+marker.length)>=0)throw Error('unique exact profile checkpoint required');
const append='\n    return {data,allEdges:edges,nodeArr,profileStats,graph:{nodes,edges},roadHeight(x,z,e){if(!e?.len)throw Error("explicit source edge required");return Y.road+yAlong(e,x,z);}};\n}\n';
// These exact declarations are hoisted in the original function and used by
// the prefix. Do not execute their later n.pad assignment ahead of native order.
const helpersStart=source.indexOf('    function isPadNode(n) {'),helpersEnd=source.indexOf('    for (const e of edges) {\n        e.sidewalkSource',helpersStart);
if(helpersStart<cut||helpersEnd<helpersStart)throw Error('hoisted profile geometry declarations changed');
const hoisted=source.slice(helpersStart,helpersEnd).replace('    for (const n of nodeArr) n.pad = n.edges.length ? isPadNode(n) : false;\n','');
const isolated=source.slice(0,cut)+hoisted+append;
const temp=path.join(root,'game/src',`.profile-cpu-probe-${process.pid}.mjs`),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(dataFile),data=JSON.parse(bytes),qb=fs.readFileSync(queriesFile),decoded=JSON.parse(queriesFile.endsWith('.gz')?zlib.gunzipSync(qb):qb),queries=decoded.queries||decoded;
const fetchBefore=globalThis.fetch;
try{
    fs.writeFileSync(temp,isolated,{flag:'wx'});
    globalThis.fetch=async url=>{if(!String(url).endsWith('/data/bucharest-unirii.json'))throw Error('Unexpected CPU fetch '+url);return{json:async()=>structuredClone(data)};};
    const {buildWorld}=await import(pathToFileURL(temp)),{BUCHAREST}=await import(pathToFileURL(path.join(root,'game/src/cities.js')));
    const world=await buildWorld({...BUCHAREST},null,{district:'unirii'});
    const result=sample(world,queries);
    result.scope='Explicit-source-edge sampler on isolated CPU World graph/profile prefix; NOT native capture.';
    const edges=world.allEdges.map(e=>({id:e.id,road:e.road,sourceId:data.roadSourceGeometry?.[e.road]?.sourceId,
        a:{sourceId:e.a.sourceId??null,x:e.a.x,z:e.a.z,y:e.ya},b:{sourceId:e.b.sourceId??null,x:e.b.x,z:e.b.z,y:e.yb},
        len:e.len,bridge:e.bridge,tunnel:e.tunnel,layer:e.layer,sourceTags:data.roadSourceGeometry?.[e.road]?.tags}));
    let routing=null;
    if(nativeFixtureFile){
        // Reproduce only the native final drivable-graph exposure. The later
        // Victoriei display ID does not change node identity/source incidence.
        const {Navigator}=await import(pathToFileURL(path.join(root,'game/src/nav.js')));
        const driv=world.allEdges.filter(e=>e.drivable);world.graph.edges=driv;
        for(const n of world.nodeArr){n.allEdges=n.edges;n.edges=n.edges.filter(e=>e.drivable);}
        for(const id of Object.keys(world.graph.nodes))if(!world.graph.nodes[id].drivable)delete world.graph.nodes[id];
        const nav=new Navigator(world),bytes=fs.readFileSync(nativeFixtureFile),native=JSON.parse(zlib.gunzipSync(bytes));
        const at=id=>world.nodeArr.find(n=>n.sourceId===id),origin=native.capturedNormalGTSInitialPlayer;
        const pairs=[['normal-GTS-origin-to-north-entry',origin,at(257684039)],['normal-GTS-origin-to-south-entry',origin,at(257685484)],
            ['north-entry-through-south-exit',at(257684039),at(257685697)],['south-entry-through-north-exit',at(257685484),at(2351309047)]];
        routing={scope:'CPU actual Navigator on World-prefix drivable graph. Literal source-node destinations and historical normal GTS origin; not a native transition or driven passage.',fixtureSHA256:sha(bytes),routes:pairs.map(([id,from,to])=>{
            if(!from||!to)return{id,unresolved:'literal source endpoint absent'};
            const route=nav.compute(from.x,from.z,to.x,to.z,from.heading??null,from.surfY??(typeof from.y==='number'?from.y+.24:.24));
            return{id,from:{sourceId:from.sourceId??null,x:from.x,z:from.z},to:{sourceId:to.sourceId??null,x:to.x,z:to.z},found:!!route,
                total:route?.total,legs:route?.legs.map(l=>({sourceId:data.roadSourceGeometry?.[l.e.road]?.sourceId,dir:l.dir,from:l.dir>0?l.e.a.sourceId:l.e.b.sourceId,to:l.dir>0?l.e.b.sourceId:l.e.a.sourceId,virtual:!!l.e.virtual})),points:route?.points};
        })};
    }
    const out={scope:'Isolated CPU replay of unchanged actual World graph/profile prefix, ending before mesh/rail emission. NOT a native scene, World solid/terrain, actor, route or pixel pass.',
        sourceSHA256:sha(source),executedPrefixSHA256:sha(isolated),datasetSHA256:sha(bytes),queriesSHA256:sha(qb),profileStats:world.profileStats,
        sourceModuleHashes:Object.fromEntries(fs.readdirSync(path.join(root,'game/src')).filter(f=>f.endsWith('.js')).sort().map(f=>[f,sha(fs.readFileSync(path.join(root,'game/src',f)))])),
        result,edges,routing};
    fs.writeFileSync(outFile,zlib.gzipSync(JSON.stringify(out)));
    console.log(JSON.stringify({outFile,edges:edges.length,stations:result.results.length,unresolved:result.results.filter(r=>r.unresolved).length,sourceSHA256:out.sourceSHA256}));
}finally{globalThis.fetch=fetchBefore;if(fs.existsSync(temp))fs.unlinkSync(temp);}
