// Pike's source-bound hero components. Dimensions below are explicit model
// estimates constrained by the retained market references, never OSM heights.
import * as THREE from '../../vendor/three.module.min.js';
import {GeoBatch,alongPolyline,polylineLength,polyArea,inPoly,centroid} from './kit.js';

export const PIKE_HERO_PROFILES=Object.freeze({
    w231357660:{role:'open-main-arcade',heightM:4.1,confidence:'Low roof carrying the PUBLIC MARKET frame; relative roof/sign relationship visible in entrance and rear references'},
    w1271653800:{role:'leland-upper-storeys',heightM:10.8,confidence:'Distinct cream historic retail/hotel wing; two modeled upper rows above the market floor, absolute height unmeasured'},
    w1271653801:{role:'low-north-arcade',heightM:4.1,confidence:'Low daystall/clerestory wing, separately modeled from Leland; height unmeasured'},
    w1275882970:{role:'covered-frontage',heightM:4.1,confidence:'Thin contiguous mapped frontage; low cover association is a model estimate, not a literal source type/height'},
    w1275882966:{role:'unclassified-service',heightM:10.8,confidence:'Raw building=yes; previous envelope retained pending specific source evidence, no invented residential window grid'},
});
export function pikeHeroProfile(source){
    const model=PIKE_HERO_PROFILES[source.id];if(!model)return null;
    const literal=Number.isFinite(source.h)&&source.h>0,levels=Number.isFinite(source.lv)&&source.lv>0;
    const heightM=literal?source.h:levels?source.lv*3.3:model.heightM;
    const minHeightM=Number.isFinite(source.minH)?source.minH:Number.isFinite(source.minLv)?source.minLv*3.3:0;
    if(!(heightM>minHeightM&&minHeightM>=0))throw Error('Invalid Pike source height interval '+source.id);
    return{...model,sourceId:source.id,heightM,minHeightM,estimated:!literal,basis:literal?'Existing numeric source height':levels?'Source storey count;3.3m alignment estimate':model.confidence};
}

/** Modeled billboard mount on its identified source roof, not a nearby body. */
export function pikeRoofSignMount(source,{width=13,depth=.16,yaw=2.36}={}){
    const rx=Math.cos(yaw),rz=-Math.sin(yaw),fx=Math.sin(yaw),fz=Math.cos(yaw),C=centroid(source.poly),rings=[source.poly,...(source.holes||[])];
    const inside=p=>inPoly(...p,source.poly)&&!(source.holes||[]).some(h=>inPoly(...p,h));
    const fullEdge=(a,b)=>{const ts=[0,1],dx=b[0]-a[0],dz=b[1]-a[1];for(const ring of rings)for(let i=0;i<ring.length;i++){const c=ring[i],d=ring[(i+1)%ring.length],ex=d[0]-c[0],ez=d[1]-c[1],den=dx*ez-dz*ex;if(!den)continue;const t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);}ts.sort((a,b)=>a-b);return ts.slice(1).every((t,i)=>inside([a[0]+dx*(t+ts[i])/2,a[1]+dz*(t+ts[i])/2]));};
    const candidates=[];
    for(let i=0;i<source.poly.length;i++){const a=source.poly[i],b=source.poly[(i+1)%source.poly.length],M=[(a[0]+b[0])/2,(a[1]+b[1])/2];for(const t of[.05,.1,.2,.35,.5,.75,1])candidates.push([M[0]+(C[0]-M[0])*t,M[1]+(C[1]-M[1])*t]);}
    candidates.sort((a,b)=>(b[0]-a[0])*fx+(b[1]-a[1])*fz);
    for(const[x,z]of candidates){const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+rx*width*u/2+fx*depth*v/2,z+rz*width*u/2+fz*depth*v/2]);if(!footprint.every(inside)||!footprint.every((a,i)=>fullEdge(a,footprint[(i+1)%4]))||(source.holes||[]).some(h=>h.some(p=>inPoly(...p,footprint))))continue;return{x,z,yaw,width,depth,footprint,sourceId:source.id,estimated:true,basis:'Full modeled sign footprint fits the identified literal Leland roof; source-photo ownership, estimated setback/dimensions'};}
    throw Error('Leland roof cannot support the modeled billboard footprint');
}

/** Original outer/inner rings, including every vertex; roof thickness is a model. */
export function addPikeRoof(batch,source,y,color='#65665c',down=false){
    const rings=[source.poly,...(source.holes||[])],flat=rings.flat(),index=THREE.ShapeUtils.triangulateShape(rings[0].map(p=>new THREE.Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(...p)))),pos=[];
    for(const face of index){let points=face.map(i=>[flat[i][0],y,flat[i][1]]);const a=points[0],b=points[1],c=points[2];if(((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)!==down)points=[points[0],points[2],points[1]];pos.push(...points.flat());}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();batch.add(g,'roofs',null,color);g.dispose();
}

/** Recessed paired sashes, cream piers and a shallow cornice on the actual ring.
 * The apertures are visual models; no enterable interior or surveyed bay count. */
export function addPikeHistoricFacade(batch,ring,y0,y1,{leland=false,sourceId='unknown',hole=false}={}){
    if(!(y1>y0))return{windows:0};const sign=Math.sign(polyArea(ring))*(hole?-1:1),report={sourceId,windows:0,estimated:true};
    for(let i=0;i<ring.length;i++){
        const A=ring[i],B=ring[(i+1)%ring.length],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz);if(!L)continue;
        const nx=sign*dz/L,nz=-sign*dx/L,P=(u,y,depth=0)=>[A[0]+dx*u/L+nx*depth,y,A[1]+dz*u/L+nz*depth];
        const quad=(a,b,c,d,color,key='concrete')=>{const points=sign>0?[a,d,c,b]:[a,b,c,d];batch.quad(...points,color,key);};
        const rect=(u0,u1,v0,v1,color,key='concrete',depth=0)=>{if(u1>u0&&v1>v0)quad(P(u0,v0,depth),P(u1,v0,depth),P(u1,v1,depth),P(u0,v1,depth),color,key);};
        const cornice=Math.min(.42,(y1-y0)*.18),windows=[];
        if(leland&&!hole&&L>=3.2&&y1-y0>=4.5){
            const rows=2,count=Math.max(1,Math.round(L/3.8)),bay=L/count,pitch=(y1-y0-cornice)/rows,w=Math.min(2.35,bay*.65),h=Math.min(2.1,pitch*.72);
            for(let row=0;row<rows;row++)for(let col=0;col<count;col++){const mid=(col+.5)*bay,bottom=y0+row*pitch+(pitch-h)*.44;windows.push({u0:mid-w/2,u1:mid+w/2,v0:bottom,v1:bottom+h});}
        }
        const xs=[...new Set([0,L,...windows.flatMap(w=>[w.u0,w.u1])])].sort((a,b)=>a-b),ys=[...new Set([y0,y1-cornice,y1,...windows.flatMap(w=>[w.v0,w.v1])])].sort((a,b)=>a-b);
        for(let u=0;u<xs.length-1;u++)for(let v=0;v<ys.length-1;v++){const cx=(xs[u]+xs[u+1])/2,cy=(ys[v]+ys[v+1])/2;if(!windows.some(w=>cx>w.u0&&cx<w.u1&&cy>w.v0&&cy<w.v1))rect(xs[u],xs[u+1],ys[v],ys[v+1],'#e4d9bd');}
        for(const w of windows){
            rect(w.u0,w.u1,w.v0,w.v1,'#25343b','market-glass',-.09);
            // Actual reveal geometry joins the wall to its recessed pane.
            quad(P(w.u0,w.v0),P(w.u0,w.v1),P(w.u0,w.v1,-.09),P(w.u0,w.v0,-.09),'#b5aa91');
            quad(P(w.u1,w.v1),P(w.u1,w.v0),P(w.u1,w.v0,-.09),P(w.u1,w.v1,-.09),'#b5aa91');
            quad(P(w.u0,w.v1),P(w.u1,w.v1),P(w.u1,w.v1,-.09),P(w.u0,w.v1,-.09),'#a29884');
            const frame='#6c3430',f=.065;rect(w.u0,w.u1,w.v0,w.v0+f,frame,'paint',.015);rect(w.u0,w.u1,w.v1-f,w.v1,frame,'paint',.015);rect(w.u0,w.u0+f,w.v0,w.v1,frame,'paint',.015);rect(w.u1-f,w.u1,w.v0,w.v1,frame,'paint',.015);
            const middle=(w.u0+w.u1)/2;rect(middle-f/2,middle+f/2,w.v0,w.v1,frame,'paint',.02);rect(w.u0,w.u1,w.v0+(w.v1-w.v0)*.52-f/2,w.v0+(w.v1-w.v0)*.52+f/2,frame,'paint',.02);report.windows++;
        }
        rect(0,L,y1-cornice,y1-cornice+Math.min(.065,cornice),'#576052','paint',.025);rect(0,L,Math.max(y0,y1-.13),y1,'#d8d1bf','concrete',.08);
    }
    return report;
}

/** Keep the existing estimated frontage/spacing, replace the deep floating
 * fascia with roof-thickness fascia and physically joined posts/rafters. */
export function buildPikeArcadeCanopy(ctx,front,yFn,{width=4.4,height=3.5,every=6}={}){
    const batch=new GeoBatch(),L=polylineLength(front),lamps=[],posts=[],roof='#34483a';
    for(let s=0;s<L;s+=1.5){
        const p=alongPolyline(front,s),q=alongPolyline(front,Math.min(L,s+1.5)),nx=p.tz,nz=-p.tx,a=yFn(p.x,p.z)+height,b=yFn(q.x,q.z)+height;
        batch.quad([p.x,a,p.z],[q.x,b,q.z],[q.x+nx*width,b+.35,q.z+nz*width],[p.x+nx*width,a+.35,p.z+nz*width],roof,'paint');
        batch.quad([p.x+nx*width,a+.60,p.z+nz*width],[q.x+nx*width,b+.60,q.z+nz*width],[q.x,b+.25,q.z],[p.x,a+.25,p.z],roof,'paint');
        batch.quad([p.x,a,p.z],[q.x,b,q.z],[q.x,b+.25,q.z],[p.x,a+.25,p.z],'#c9c3af','concrete');
        batch.quad([q.x,b,q.z],[p.x,a,p.z],[p.x,a+.045,p.z],[q.x,b+.045,q.z],roof,'paint');
    }
    for(let s=0;s<=L;s+=every){
        const p=alongPolyline(front,s),floor=ctx.ground.heightAt(p.x,p.z),under=yFn(p.x,p.z)+height,h=under-floor,yaw=Math.atan2(-p.tz,p.tx),nx=p.tz,nz=-p.tx;
        if(!(h>2.2&&Number.isFinite(h)))throw Error('Pike canopy/ground support unresolved at '+s);
        batch.box(p.x,floor,p.z,.22,h,.22,'#34483a','paint',yaw);ctx.box(p.x,p.z,.11,.11,yaw,{prop:true,y:floor,h,source:'pike-arcade-estimated-structural-post'});
        batch.rod([p.x,under-.065,p.z],[p.x+nx*width,under+.285,p.z+nz*width],.065,'#4b4a3c','wood',4);
        batch.rod([p.x,under-.55,p.z],[p.x+nx*.8,under-.001,p.z+nz*.8],.04,'#34483a','paint',4);
        lamps.push({x:p.x+nx*width*.5,z:p.z+nz*width*.5,y:under-.6});posts.push({s,x:p.x,z:p.z,floor,top:under,height:h,estimated:true});
    }
    ctx.add(batch.build('pike-arcade-structure'));return{lamps,posts,estimated:true,widthM:width,fasciaDepthM:.25,basis:'Existing inferred frontage/width; referenced open frame and thin fascia; sampled actual ground supports posts. No source roof polygon moved.'};
}
