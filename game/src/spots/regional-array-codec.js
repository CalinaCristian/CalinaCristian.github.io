// Lossless transport only. Every original typed numeric bit is restored before
// the existing context decoder sees the container; no float arithmetic/rounding.
import {decodeContextContainer} from './context-array-codec.js';
const decoder=new TextDecoder(),encoder=new TextEncoder();
export function decodeRegionalContainer(bytes){
    const magic=decoder.decode(bytes.subarray(0,8));
    if(magic==='DMCCACHE')return decodeContextContainer(bytes);
    if(magic!=='DMCXOR02'||bytes.length<16)throw Error('Unknown regional numeric transport');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=view.getUint32(12,true),body=16+Math.ceil(size/4)*4;
    if(view.getUint32(8,true)!==1||body>bytes.length)throw Error('Invalid regional numeric header');
    const meta=JSON.parse(decoder.decode(bytes.subarray(16,16+size)));
    if(meta.transport?.codec!=='axis-xor-byteplanes-v2')throw Error('Missing regional transport provenance');
    const restore=(d,stride)=>{
        if(!['Float32Array','Uint32Array'].includes(d.type)||!Number.isSafeInteger(d.count)||d.count<0||!Number.isInteger(stride)||stride<1||d.count%stride||!Number.isSafeInteger(d.byteOffset)||d.byteOffset<0||d.byteOffset%4||d.byteLength!==d.count*4||body+d.byteOffset+d.byteLength>bytes.length)throw Error('Invalid regional numeric block');
        const input=bytes.subarray(body+d.byteOffset,body+d.byteOffset+d.byteLength),out=new Uint8Array(d.byteLength),words=new DataView(out.buffer),count=d.count/stride;
        for(let axis=0;axis<stride;axis++){
            let previous=0;
            for(let i=0;i<count;i++){
                const at=axis*count+i,word=(input[at]|input[d.count+at]<<8|input[d.count*2+at]<<16|input[d.count*3+at]<<24)^previous;
                words.setUint32((i*stride+axis)*4,word>>>0,true);previous=word;
            }
        }
        bytes.set(out,body+d.byteOffset);
    };
    for(const b of meta.batches){for(const d of Object.values(b.attributes))restore(d,d.itemSize);restore(b.index,1);}
    bytes.set(encoder.encode('DMCCACHE'));return decodeContextContainer(bytes);
}
