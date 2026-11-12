// The fallback ground's adaptive partition (fallback-ground.js), without THREE, so the build workers run the very same
// code on a subtree (spec 10 load budget). A state holds the counters and the output arrays of one depth-first walk.
import {subtractTramTrench} from './tram-trench.js';

export const overlaps=(a,b)=>a.x1>=b.x0&&a.x0<=b.x1&&a.z1>=b.z0&&a.z0<=b.z1;
/** report: {known, reason, nodes, leaves} (updated in place); x0 / z1: the whole ground's west / south edge (uv origin) */
export function fallbackState({report,leafSize,maxNodes,maxFragments,datum,x0,z1}){
    return {report,leafSize,maxNodes,maxFragments,datum,x0,z1,positions:[],normals:[],uv:[],indices:[],parts:[]};
}
export function fallbackVisit(box,nearby,st){
    const {report,leafSize,maxNodes,maxFragments,datum,x0,z1,positions,normals,uv,indices,parts}=st;
    const vertex=(x,z)=>[x,datum,z,(x-x0)/12,(z1-z)/12];
    const append=polygons=>{
        const start=indices.length;let bx0=Infinity,bx1=-Infinity,bz0=Infinity,bz1=-Infinity;
        for(const p of polygons){const first=positions.length/3;for(const v of p){positions.push(v[0],v[1],v[2]);normals.push(0,1,0);uv.push(v[3],v[4]);bx0=Math.min(bx0,v[0]);bx1=Math.max(bx1,v[0]);bz0=Math.min(bz0,v[2]);bz1=Math.max(bz1,v[2]);}for(let i=1;i<p.length-1;i++)indices.push(first,first+i,first+i+1);}
        if(indices.length>start)parts.push({start,count:indices.length-start,bounds:[bx0,datum,bz0,bx1,datum,bz1]});
    };
    const visit=(box,nearby)=>{
        if(!report.known)return;
        if(++report.nodes>maxNodes){report.known=false;report.reason='fallback-partition-limit';return;}
        const polygon=[vertex(box.x0,box.z0),vertex(box.x0,box.z1),vertex(box.x1,box.z1),vertex(box.x1,box.z0)];
        if(!nearby.length){append([polygon]);report.leaves++;return;}
        const w=box.x1-box.x0,h=box.z1-box.z0;
        if(Math.max(w,h)>leafSize){
            const split=w>=h?(box.x0+box.x1)/2:(box.z0+box.z1)/2;
            const children=w>=h?[{...box,x1:split},{...box,x0:split}]:[{...box,z1:split},{...box,z0:split}];
            for(const child of children)visit(child,nearby.filter(c=>overlaps(child,c)));return;
        }
        let fragments=[polygon];
        // a fragment's box is the same for every cut tested against it: computed once (Math.min / max as bounds() does)
        const boxes=new WeakMap(),boxOf=p=>{let b=boxes.get(p);if(!b){let ax=Infinity,bx=-Infinity,az=Infinity,bz=-Infinity;for(const v of p){ax=Math.min(ax,v[0]);bx=Math.max(bx,v[0]);az=Math.min(az,v[2]);bz=Math.max(bz,v[2]);}b={x0:ax,x1:bx,z0:az,z1:bz};boxes.set(p,b);}return b;};
        for(const cut of nearby){
            fragments=fragments.flatMap(p=>overlaps(boxOf(p),cut)?subtractTramTrench(p,cut.poly):[p]);
            if(fragments.length>maxFragments){report.known=false;report.reason='fallback-subtraction-limit';return;}
            if(!fragments.length)break;
        }
        append(fragments);report.leaves++;
    };
    visit(box,nearby);
    return st;
}
