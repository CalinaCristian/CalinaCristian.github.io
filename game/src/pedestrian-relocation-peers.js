// A read-only index for one synchronous relocation search. Other pedestrians
// cannot move during that search; the candidate itself is always excluded.
// Exact predicates remain identical to the ordinary full-population queries.
export function relocationPeerQuery(people, except, reach) {
    const records=[],buckets=new Map(),incoming=new Map(),cell=8;
    let maxReach=0,knownReach=true;
    for(const o of people){
        if(o===except)continue;
        const record={o};records.push(record);
        if(Number.isFinite(o.x)&&Number.isFinite(o.z)){
            const ix=Math.floor(o.x/cell),iz=Math.floor(o.z/cell),key=`${ix},${iz}`;
            let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket={ix,iz,records:[]});bucket.records.push(record);
        }
        if(!o.hidden){
            const r=reach(o);if(Number.isFinite(r)&&r>=0)maxReach=Math.max(maxReach,r);else knownReach=false;
            if((o.state==='legs'||o.state==='wait')&&o.next?.e){
                let sides=incoming.get(o.next.e);if(!sides)incoming.set(o.next.e,sides=new Map());
                let rows=sides.get(o.next.side);if(!rows)sides.set(o.next.side,rows=[]);rows.push(record);
            }
        }
    }
    const visit=(bounds,fn)=>{
        if(!bounds||!bounds.every(Number.isFinite)){for(const r of records)fn(r);return;}
        // One extra hash cell is a conservative broad-phase guard against
        // inverse-transform rounding at a cell boundary, never body clearance.
        const [x0,z0,x1,z1]=bounds,loX=Math.floor(x0/cell)-1,hiX=Math.floor(x1/cell)+1,loZ=Math.floor(z0/cell)-1,hiZ=Math.floor(z1/cell)+1;
        if(![loX,hiX,loZ,hiZ].every(Number.isSafeInteger)){for(const r of records)fn(r);return;}
        if((hiX-loX+1)*(hiZ-loZ+1)<=buckets.size){
            for(let x=loX;x<=hiX;x++)for(let z=loZ;z<=hiZ;z++)for(const r of buckets.get(`${x},${z}`)?.records||[])fn(r);
        }else for(const b of buckets.values())if(b.ix>=loX&&b.ix<=hiX&&b.iz>=loZ&&b.iz<=hiZ)for(const r of b.records)fn(r);
    };
    const corridorBounds=(e,side,space,pad)=>{
        const d=e.dirx*side*e.nz-e.dirz*side*e.nx;
        if(!Number.isFinite(d)||d===0)return null;
        let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
        for(const s of[space.lo-pad,space.hi+pad])for(const u of[space.w,space.w+space.sw]){
            const x=e.a.x+(s*side*e.nz-u*e.dirz)/d,z=e.a.z+(u*e.dirx-s*side*e.nx)/d;
            x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);
        }
        return[x0,z0,x1,z1];
    };
    return {
        except,
        spaceLoad(e,side,space,pad){
            const here=o=>{const dx=o.x-e.a.x,dz=o.z-e.a.z,s=dx*e.dirx+dz*e.dirz,u=(dx*e.nx+dz*e.nz)*side;return s>=space.lo-pad&&s<=space.hi+pad&&u>=space.w&&u<=space.w+space.sw;};
            let n=0;
            visit(corridorBounds(e,side,space,pad),({o})=>{if(!o.hidden&&here(o))n++;});
            // Route reservations may be arbitrarily far from the sidewalk.
            // Here OR inbound remains a union, including duplicate list rows.
            for(const{o}of incoming.get(e)?.get(side)||[])if(!here(o))n++;
            return n;
        },
        freePersonalSpace(p,r,padding){
            let clear=true;
            const radius=r+maxReach+padding;
            visit(knownReach?[p.x-radius,p.z-radius,p.x+radius,p.z+radius]:null,({o})=>{if(!o.hidden&&Math.hypot(o.x-p.x,o.z-p.z)<r+reach(o)+padding)clear=false;});
            return clear;
        },
        standingCount(x,z,r){
            let n=0;visit([x-r,z-r,x+r,z+r],({o})=>{if(o.state==='stand'&&Math.hypot(o.x-x,o.z-z)<r)n++;});return n;
        },
    };
}
