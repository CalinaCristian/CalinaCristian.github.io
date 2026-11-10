/** Fixed storage for an exact, static height query. Hash collisions only cause
 * recomputation: coordinates are compared at full double precision. No spatial
 * rounding, time-dependent values, string keys or per-query allocations. */
export function cachedPointHeight(query, capacity=4096) {
    if(capacity<1 || (capacity & (capacity-1)))throw Error('Power-of-two capacity required');
    const xs=new Float64Array(capacity),zs=new Float64Array(capacity),values=new Float64Array(capacity),valid=new Uint8Array(capacity);
    const pair=new Float64Array(2),bits=new Uint32Array(pair.buffer),mask=capacity-1;
    return (x,z)=>{
        pair[0]=x;pair[1]=z;
        let h=Math.imul(bits[0]^bits[1],0x45d9f3b)^Math.imul(bits[2]^bits[3],0x119de1f3);h^=h>>>16;
        const i=h&mask;
        if(valid[i]&&xs[i]===x&&zs[i]===z)return Number.isNaN(values[i])?null:values[i];
        const result=query(x,z);
        xs[i]=x;zs[i]=z;values[i]=result===null?NaN:result;valid[i]=1;
        return result;
    };
}
