// The actual prepare function, with file-backed HTTP Response objects. No browser.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {prepareRegionalTerrain} from '../../../game/src/spots/source-regional-terrain.js';
const fetched=[];globalThis.fetch=async url=>{const path=fileURLToPath(url);fetched.push(path);try{return new Response(fs.readFileSync(path),{status:200});}catch{return new Response('',{status:404});}};
const results=[];
for(const id of['seattle-center','pike-place']){
    const data=JSON.parse(fs.readFileSync(new URL('../../../game/data/spots/'+id+'.json',import.meta.url))),ctx={data,extras:{}},start=performance.now(),s=await prepareRegionalTerrain(ctx);
    assert(s.loaded&&!s.rendered);assert.equal(s.cache.frame.origin.lat,data.origin.lat);assert.equal(s.cache.renderOnly,true);assert.equal(s.sourceContextDataSHA256,'19afb36376e615e7075dcf5eb5f8d70e7c95d351b3759848dff271d2c793cea8');
    assert(s.cache.waterBoundaryLOD.maxCertifiedAdditionalPixelError<.5);
    results.push({id,nodeFileAdapterLoadAndValidationMs:performance.now()-start,triangles:s.cache.batches.reduce((n,b)=>n+b.index.length/3,0),rendered:false,sourceDataSHA256:s.cache.sourceDataSHA256});
}
assert(!fetched.some(p=>p.endsWith('/seattle-regional-source.json.gz')));
const report={scope:'Actual cache prepare/manifest/kernel/native-frame validation with file-read Response adapter, warm OS cache, no browser/GL/network/visit acceptance',passed:true,numericRegionalSourceNotFetchedOrParsed:true,fetches:fetched.length,results};const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
