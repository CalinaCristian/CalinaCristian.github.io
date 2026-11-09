// Exact typed-array transport. No coordinate/normal/UV quantization.
const types={Float32Array,Uint32Array,Uint16Array};
const little=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
const rawBytes=array=>{
    if(!types[array.constructor.name])throw Error('Unknown context array type');
    const bytes=new Uint8Array(array.byteLength);
    if(little)bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
    else{const view=new DataView(bytes.buffer),set=array instanceof Float32Array?'setFloat32':array instanceof Uint16Array?'setUint16':'setUint32';for(let i=0;i<array.length;i++)view[set](i*array.BYTES_PER_ELEMENT,array[i],true);}
    return bytes;
};
export function encodeContextArray(array,stride=1){
    const bytes=rawBytes(array);
    let s='';
    for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return{type:array.constructor.name,count:array.length,stride,codec:'raw-little-endian-v1',data:btoa(s)};
}
/** Binary cache transport: one JSON metadata block plus aligned lossless raw
 * numeric blocks. Avoids retaining/decoding 100+MB of base64 on mobile. */
export function encodeContextContainer(cache){
    const blocks=[];let size=0;
    const retain=array=>{const offset=size;size+=Math.ceil(array.byteLength/4)*4;blocks.push({array,offset});return{type:array.constructor.name,count:array.length,byteOffset:offset,byteLength:array.byteLength};};
    const metadata={...cache,container:'dmcv-source-context-v1',batches:cache.batches.map(b=>({...b,attributes:Object.fromEntries(Object.entries(b.attributes).map(([k,a])=>[k,{...retain(a.array),itemSize:a.itemSize}])),index:retain(b.index)}))};
    const json=new TextEncoder().encode(JSON.stringify(metadata)),body=16+Math.ceil(json.length/4)*4,out=new Uint8Array(body+size),view=new DataView(out.buffer);
    out.set(new TextEncoder().encode('DMCCACHE'));view.setUint32(8,1,true);view.setUint32(12,json.length,true);out.set(json,16);
    for(const block of blocks)out.set(rawBytes(block.array),body+block.offset);return out;
}
export function decodeContextContainer(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<16||new TextDecoder().decode(bytes.subarray(0,8))!=='DMCCACHE')throw Error('Unknown source context container');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonLength=view.getUint32(12,true),body=16+Math.ceil(jsonLength/4)*4;
    if(view.getUint32(8,true)!==1||body>bytes.length)throw Error('Invalid source context header');
    const cache=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+jsonLength)));if(cache.container!=='dmcv-source-context-v1')throw Error('Invalid source context metadata');
    const decode=d=>{const Type=types[d.type];if(!Type||!Number.isSafeInteger(d.count)||d.count<0||!Number.isSafeInteger(d.byteOffset)||d.byteOffset<0||d.byteOffset%4||d.byteLength!==d.count*Type.BYTES_PER_ELEMENT||body+d.byteOffset+d.byteLength>bytes.length)throw Error('Invalid source context numeric block');
        const offset=bytes.byteOffset+body+d.byteOffset;if(little&&offset%Type.BYTES_PER_ELEMENT===0)return new Type(bytes.buffer,offset,d.count);
        const array=new Type(d.count),v=new DataView(bytes.buffer,offset,d.byteLength),get=d.type==='Float32Array'?'getFloat32':d.type==='Uint16Array'?'getUint16':'getUint32';for(let i=0;i<d.count;i++)array[i]=v[get](i*Type.BYTES_PER_ELEMENT,true);return array;};
    cache.batches=cache.batches.map(b=>({...b,attributes:Object.fromEntries(Object.entries(b.attributes).map(([k,a])=>[k,{array:decode(a),itemSize:a.itemSize}])),index:decode(b.index)}));return cache;
}
export function validateContextBatches(batches,sourceIds){
    for(const b of batches){const p=b.attributes.position?.array;if(!(p instanceof Float32Array)||p.length%3)throw Error('Invalid context positions');const vertices=p.length/3;
        for(const[key,a]of Object.entries(b.attributes)){const size=key==='uv'?2:3;if(a.itemSize!==size||!(a.array instanceof Float32Array)||a.array.length!==vertices*size||!a.array.every(Number.isFinite))throw Error('Invalid context vertex attribute');}
        if(!(b.index instanceof Uint32Array||b.index instanceof Uint16Array)||b.index.length%3||!b.index.every(i=>i<vertices))throw Error('Invalid context indices');
        let offset=0;for(const r of b.sourceRanges){if(!sourceIds.has(r.source)||r.start!==offset||!Number.isSafeInteger(r.count)||r.count<0||r.count%3)throw Error('Invalid context source ranges');offset+=r.count;}if(offset!==b.index.length)throw Error('Incomplete context source ownership');
    }
    return true;
}
export function decodeContextArray(encoded){
    const Type=types[encoded.type];if(!Type||encoded.codec!=='raw-little-endian-v1')throw Error('Unknown context array codec');
    let bytes;if(Uint8Array.fromBase64)bytes=Uint8Array.fromBase64(encoded.data);else{const s=atob(encoded.data);bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);}
    if(bytes.length!==encoded.count*Type.BYTES_PER_ELEMENT)throw Error('Invalid context array length');
    if(little)return new Type(bytes.buffer,bytes.byteOffset,encoded.count);
    const out=new Type(encoded.count),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),get=encoded.type==='Float32Array'?'getFloat32':encoded.type==='Uint16Array'?'getUint16':'getUint32';
    for(let i=0;i<out.length;i++)out[i]=view[get](i*Type.BYTES_PER_ELEMENT,true);return out;
}
