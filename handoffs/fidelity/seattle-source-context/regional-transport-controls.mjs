// Independent browser-language decoder parity against the original emitted cache.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {decodeContextContainer} from '../../../game/src/spots/context-array-codec.js';
import {decodeRegionalContainer} from '../../../game/src/spots/regional-array-codec.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return[a.slice(2,i),a.slice(i+1)];}));
if(!args.original||!args.packed||!args.output)throw Error('--original=FILE --packed=FILE --output=FILE');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>new Uint8Array(zlib.gunzipSync(fs.readFileSync(p))),original=read(args.original),packed=read(args.packed),before=sha(original),a=decodeContextContainer(original),start=performance.now(),b=decodeRegionalContainer(packed);let arrays=0,bytes=0;
assert.equal(a.batches.length,b.batches.length);
for(let i=0;i<a.batches.length;i++){
    const A=a.batches[i],B=b.batches[i];assert.equal(A.key,B.key);
    assert.deepEqual(Object.keys(A.attributes),Object.keys(B.attributes));
    for(const key of Object.keys(A.attributes)){
        const x=A.attributes[key],y=B.attributes[key];assert.equal(x.itemSize,y.itemSize);assert.equal(x.array.constructor.name,y.array.constructor.name);
        const X=new Uint8Array(x.array.buffer,x.array.byteOffset,x.array.byteLength),Y=new Uint8Array(y.array.buffer,y.array.byteOffset,y.array.byteLength);assert.equal(sha(X),sha(Y),A.key+':'+key);arrays++;bytes+=X.length;
    }
    const X=new Uint8Array(A.index.buffer,A.index.byteOffset,A.index.byteLength),Y=new Uint8Array(B.index.buffer,B.index.byteOffset,B.index.byteLength);assert.equal(sha(X),sha(Y));arrays++;bytes+=X.length;
}
assert.equal(sha(original),before);const compatibility=decodeRegionalContainer(original);assert.equal(compatibility.batches[0].key,a.batches[0].key);assert.throws(()=>decodeRegionalContainer(new Uint8Array(16)));const bad=read(args.packed);bad[8]=2;assert.throws(()=>decodeRegionalContainer(bad));
const report={scope:'Full typed-array bit parity in the actual JavaScript decoder; no native shader-driver/cold-load/budget/image acceptance',passed:true,originalFileSHA256:sha(fs.readFileSync(args.original)),packedFileSHA256:sha(fs.readFileSync(args.packed)),arrays,bytes,allOriginalTypedBitsAndIndexOrderIdentical:true,originalSourceBufferUnchanged:true,rawContainerCompatibility:true,malformedHeaderControls:true,nodeDecodeAndHashTimeMs:performance.now()-start};fs.writeFileSync(args.output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
