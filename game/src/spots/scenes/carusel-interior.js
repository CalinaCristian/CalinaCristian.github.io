// Photo-led authored reconstruction, not a surveyed interior floor plan.
// Outer volume/door remain in buc-old-town.js on source w658009149.
import * as THREE from '../../../vendor/three.module.min.js';
import {GeoBatch,flatGeometry,inPoly,polyArea,polyBox,offsetPolyline,rng} from '../kit.js';
import {caruselBooks,caruselTimber} from './carusel-look.js';

const WHITE='#f4f2eb',LEVELS=[0,3.1,6.6,10.0,13.6];
function inset(p,d){const q=offsetPolyline([...p,p[0],p[1]],polyArea(p)>0?d:-d);return q.slice(1,p.length+1);}
function shape(poly,hole){const s=new THREE.Shape(poly.map(([x,z])=>new THREE.Vector2(x,-z)));if(hole)s.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));return s;}

export function buildCaruselInterior(ctx,{poly,o,front,datum,height}){
    const g=ctx.ground,b=new GeoBatch(),shelves=new GeoBatch(),inner=inset(poly,.22);
    // Sample the final settled terrain throughout the source footprint, not
    // just its lower boundary vertices. No terrain or exterior datum is moved.
    const bb=polyBox(poly);let highest=-Infinity;
    const sample=(x,z)=>{highest=Math.max(highest,g.heightAt(x,z));};
    for(let z=bb.z0;z<=bb.z1;z+=.5)for(let x=bb.x0;x<=bb.x1;x+=.5)if(inPoly(x,z,poly))sample(x,z);
    for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/.5);for(let j=0;j<=n;j++)sample(a[0]+(c[0]-a[0])*j/n,a[1]+(c[1]-a[1])*j/n);}
    const floorY=highest+.04;
    const P=(r,s)=>[o.cx+o.uz*r+o.ux*s,o.cz-o.ux*r+o.uz*s],yaw=Math.atan2(o.ux,o.uz);
    const local=(x,z)=>({r:(x-o.cx)*o.uz-(z-o.cz)*o.ux,s:(x-o.cx)*o.ux+(z-o.cz)*o.uz});
    const holes=[],gallerySurfaces=[],path=[],landings=[],railRecords=[],timber=caruselTimber();
    const woodUV=geo=>{const p=geo.attributes.position,u=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const q=local(p.getX(i),p.getZ(i));u[i*2]=q.r/1.2;u[i*2+1]=q.s/2;}geo.setAttribute('uv',new THREE.BufferAttribute(u,2));};
    const top=(p,hole,y)=>{const geo=new THREE.ShapeGeometry(shape(p,hole),4);geo.rotateX(-Math.PI/2);geo.translate(0,y+.003,0);woodUV(geo);b.add(geo,'caruselTimber',null,'#ffffff');geo.dispose();};
    const slab=(p,hole,y,thick=.17,wood=true)=>{const geo=new THREE.ExtrudeGeometry(shape(p,hole),{depth:thick,bevelEnabled:false,curveSegments:4});geo.rotateX(-Math.PI/2);geo.translate(0,y-thick,0);b.add(geo,'paint',null,WHITE);geo.dispose();if(wood)top(p,hole,y);};
    const wall=(a,c,ya,yc,h=1.04)=>{const dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz);if(L<.005)return;const w={wall:true,ax:a[0],az:a[1],bx:c[0],bz:c[1],x:(a[0]+c[0])/2,z:(a[1]+c[1])/2,r:L/2+.5,nx:dz/L,nz:-dx/L,y0a:ya-.12,y1a:ya+h,y0b:yc-.12,y1b:yc+h,kind:'carusel-gallery-rail',interiorEstimated:true};ctx.collider(w);railRecords.push(w);};
    const rail=(a,c,ya,yc,{iron=false,physical=true}={})=>{
        const L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<.005)return;const col=WHITE;
        b.rod([a[0],ya+1.04,a[1]],[c[0],yc+1.04,c[1]],iron?.023:.022,col,'paint',6);
        b.rod([a[0],ya+.09,a[1]],[c[0],yc+.09,c[1]],.012,col,'paint',5);
        const n=Math.max(1,Math.ceil(L/(iron?.19:.13)));
        for(let j=0;j<=n;j++){const t=j/n,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t,y=ya+(yc-ya)*t;b.rod([x,y+.08,z],[x,y+1.04,z],.008,col,'paint',5);}
        if(iron&&L>.5){const n2=Math.max(1,Math.floor(L/.75));for(let j=0;j<n2;j++){const t=(j+.5)/n2,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t,y=ya+(yc-ya)*t;
            for(let side=-1;side<=1;side+=2){let last=null;for(let k=0;k<=10;k++){const q=k/10*Math.PI*2,r=.12,qx=x+Math.cos(q)*r*(c[0]-a[0])/L,qz=z+Math.cos(q)*r*(c[1]-a[1])/L,pt=[qx,y+.53+side*.17+Math.sin(q)*r,qz];if(last)b.rod(last,pt,.008,col,'paint',4);last=pt;}}}}
        if(physical)wall(a,c,ya,yc);
    };
    // A single continuous long hall, with a connected side stair opening.
    // Modern mezzanine edges are sinuous; the original gallery stays rectilinear.
    const opening=k=>{const W=s=>3.65-(k===1?.7*Math.exp(-(((s+2.8)/3.0)**2)):k===3?.6*Math.exp(-(((s-3.1)/3.3)**2)):0),q=[];
        for(let i=0;i<=60;i++){const s=-11.5+i*21.7/60;q.push(P(W(s),s));}
        for(let i=0;i<=46;i++){const s=10.2-i*16.5/46;q.push(P(-W(s),s));}
        q.push(P(-5.65,-6.3),P(-5.65,-11.5));return q;};
    // Solid timber floor covers the actual source boundary, with a walkable
    // entrance threshold. Terrain/streets and neighbouring source datums stay put.
    top(poly,null,floorY);g.addPoly(poly,floorY,floorY-.8,{kind:'carusel-floor'});
    const thresholdH=Math.max(.025,floorY-datum),tx=front.x+front.nx*.08,tz=front.z+front.nz*.08;
    b.box(tx,datum,tz,2.28,thresholdH,.6,'#d6ccba','stone',front.yaw);
    g.addBox(tx,tz,1.14,.3,front.yaw,datum-.1,floorY,{kind:'carusel-threshold'});
    for(let k=1;k<LEVELS.length;k++){const y=floorY+LEVELS[k],hole=opening(k);holes[k]=hole;slab(inner,hole,y);
        const s={kind:'carusel-gallery',level:k,x:o.cx,z:o.cz,r:o.len/2+3,bottom:y-.25,contains:(x,z)=>inPoly(x,z,inner)&&!inPoly(x,z,hole),top:()=>y};g.surfaces.push(s);gallerySurfaces.push(s);
        for(let i=0;i<hole.length;i++){const a=hole[i],c=hole[(i+1)%hole.length],la=local(...a),lc=local(...c);
            // The rear landing is a real stair entrance, with no rail across it.
            if(Math.abs(la.s+11.5)<.02&&Math.abs(lc.s+11.5)<.02){const breaks=[Math.min(la.r,lc.r),-5.55,-2.45,Math.max(la.r,lc.r)].sort((x,z)=>x-z);for(let j=1;j<breaks.length;j++){const lo=breaks[j-1],hi=breaks[j];if(lo<Math.min(la.r,lc.r)-.01||hi>Math.max(la.r,lc.r)+.01||(lo>=-5.55&&hi<=-2.45))continue;rail(P(lo,-11.5),P(hi,-11.5),y,y,{iron:k===2});}}
            else rail(a,c,y,y,{iron:k===2});}
    }
    // White joinery and bindings stay at real book/shelf scale.
    const shelf=caruselBooks();
    for(const h of LEVELS){const ly=floorY+h;for(let i=0;i<inner.length;i++){const a=inner[i],c=inner[(i+1)%inner.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<6)continue;const mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;if(Math.hypot(mx-front.x,mz-front.z)<3)continue;
        const ex=(c[0]-a[0])/L,ez=(c[1]-a[1])/L,nx=-ez,nz=ex,angle=Math.atan2(ex,ez),cx=mx+nx*.15,cz=mz+nz*.15,Q=(u,y)=>[a[0]+ex*u+nx*.36,y,a[1]+ez*u+nz*.36],w=L-.7;
        b.box(cx,ly,cz,.36,2.65,w,WHITE,'paint',angle);shelves.quad(Q(.35,ly+.12),Q(L-.35,ly+.12),Q(L-.35,ly+2.53),Q(.35,ly+2.53),'#ffffff','shelf',[0,0,w/1.4,0,w/1.4,1,0,1]);
        for(let j=0;j<=6;j++)b.box(cx+nx*.02,ly+.1+j*2.43/6,cz+nz*.02,.4,.028,w,WHITE,'paint',angle);
        for(let u=.35;u<L-.35;u+=1.4)b.box(a[0]+ex*u+nx*.15,ly,a[1]+ez*u+nz*.15,.4,2.65,.03,WHITE,'paint',angle);
        ctx.box(cx,cz,.2,w/2,angle,{prop:true,y:ly,h:2.65,y0:ly,y1:ly+2.65,kind:'carusel-bookcase'});}}
    // Composite columns and arched structural bays belong to the original
    // gallery, rather than capitals repeated on every modern mezzanine.
    const posts=[-5.8,0,6.8];for(const s of posts)for(const r of [-4.1,4.1]){const [x,z]=P(r,s);
        b.box(x,floorY,z,.66,.16,.66,WHITE,'paint');b.cyl(x,floorY+.16,z,.205,13.2,WHITE,'paint',16);
        for(const h of [6.6,13.6]){b.cyl(x,floorY+h-.5,z,.25,.2,WHITE,'paint',16);b.box(x,floorY+h-.15,z,.72,.15,.72,WHITE,'paint');for(let j=0;j<8;j++){const a=j*Math.PI/4;b.sphere(x+Math.cos(a)*.25,floorY+h-.3,z+Math.sin(a)*.25,.08,.12,.08,WHITE,'paint',5,4);}}
        ctx.circle(x,z,.25,13.6,{y:floorY});}
    const arch=(r,a,c)=>{const q=[[a,6.6],[c,6.6],[c,5.15]];for(let j=1;j<=24;j++){const t=1-j/24;q.push([a+(c-a)*t,5.15+Math.sin(Math.PI*t)*1.27]);}const sh=new THREE.Shape(q.map(([s,y])=>new THREE.Vector2(s,floorY+y))),geo=new THREE.ExtrudeGeometry(sh,{depth:.2,bevelEnabled:false,curveSegments:3}),p=geo.attributes.position;
        for(let i=0;i<p.count;i++){const s=p.getX(i),y=p.getY(i),d=p.getZ(i),v=P(r+.1-d,s);p.setXYZ(i,v[0],y,v[1]);}geo.computeVertexNormals();b.add(geo,'paint',null,WHITE);geo.dispose();
        for(let j=0;j<8;j++){const a0=a+(c-a)*j/8,a1=a+(c-a)*(j+1)/8,low=5.15+Math.min(Math.sin(Math.PI*j/8),Math.sin(Math.PI*(j+1)/8))*1.27,[x,z]=P(r,(a0+a1)/2);ctx.box(x,z,.1,(a1-a0)/2,yaw,{prop:true,y:floorY+low,h:6.6-low,y0:floorY+low,y1:floorY+6.6,kind:'carusel-arch'});}};
    for(const r of [-4.1,4.1])for(let i=1;i<posts.length;i++)arch(r,posts[i-1],posts[i]);
    // A supported U-return stair: twenty modest risers per storey, rounded
    // landing, continuous underside and gallery-connected rear landing.
    const A=-4.8,B=-3.2,back=-10.85,run=3,n=10,midS=back+run,centreR=(A+B)/2;
    const addPath=(r,s,y,extra={})=>{const [x,z]=P(r,s);path.push({x,z,y,...extra});};
    const rearLanding=y=>{const p=[P(-5.45,-12.25),P(-2.55,-12.25),P(-2.55,-10.8),P(-5.45,-10.8)];slab(p,null,y,.2);g.addPoly(p,y,y-.22,{kind:'carusel-stair-landing'});};
    const flight=(r,s0,s1,y0,y1,level)=>{for(let j=0;j<n;j++){const t=(j+.5)/n,s=s0+(s1-s0)*t,y=y0+(y1-y0)*(j+1)/n,[x,z]=P(r,s),rise=(y1-y0)/n;
            b.box(x,y-rise,z,1.2,rise,.32,WHITE,'paint',yaw);g.addBox(x,z,.6,.16,yaw,y-rise,y,{kind:'carusel-stair'});addPath(r,s,y,{level,tread:true});}
        const L=P(r-.6,s0),R=P(r+.6,s0),C=P(r-.6,s1),D=P(r+.6,s1),bottom0=y0-.22,bottom1=y1-.22;
        const underside=[[L[0],bottom0,L[1]],[R[0],bottom0,R[1]],[D[0],bottom1,D[1]],[C[0],bottom1,C[1]]];if(s1<s0)underside.reverse();b.quad(...underside,WHITE,'paint');
        for(const side of [-1,1]){const p=P(r+side*.6,s0),q=P(r+side*.6,s1),face=[[p[0],bottom0,p[1]],[q[0],bottom1,q[1]],[q[0],y1,q[1]],[p[0],y0,p[1]]];if((s1>s0&&side>0)||(s1<s0&&side<0))face.reverse();b.quad(...face,WHITE,'paint');rail(p,q,y0,y1);}};
    rearLanding(floorY);
    for(let k=0;k<LEVELS.length-1;k++){const lo=floorY+LEVELS[k],hi=floorY+LEVELS[k+1],mid=(lo+hi)/2;addPath(A,-11.55,lo,{level:k,landing:true});flight(A,back,midS,lo,mid,k);
        const turn=[P(centreR-1.45,midS-.3),P(centreR+1.45,midS-.3)];for(let j=0;j<=24;j++){const a=j/24*Math.PI;turn.push(P(centreR+Math.cos(a)*1.45,midS+Math.sin(a)*1.45));}slab(turn,null,mid,.2,false);g.addPoly(turn,mid,mid-.22,{kind:'carusel-stair-landing'});
        for(let j=0;j<24;j++)rail(turn[j+2],turn[j+3],mid,mid);
        rail(P(A+.6,midS-.3),P(B-.6,midS-.3),mid,mid);
        for(let j=0;j<=8;j++){const a=Math.PI-j/8*Math.PI;addPath(centreR+Math.cos(a)*.8,midS+.035+Math.sin(a)*.8,mid,{level:k,landing:true});}
        flight(B,midS,back,mid,hi,k);rearLanding(hi);addPath(B,-11.6,hi,{level:k+1,landing:true});addPath(centreR,-11.8,hi,{level:k+1,landing:true});addPath(A,-11.6,hi,{level:k+1,landing:true});
        landings.push({level:k+1,y:hi,pathIndex:path.length-1,walk:[P(A,-12.0),P(0,-12.0)],view:P(0,-12.0)});
    }
    // Glass above the single hall, enclosed by a white ceiling/cornice.
    const sky=[P(-3.9,-10.4),P(3.9,-10.4),P(3.9,10.4),P(-3.9,10.4)],ceilingY=datum+height-.08;
    const ceilingGeo=new THREE.ShapeGeometry(shape(inner,sky));ceilingGeo.rotateX(-Math.PI/2);ceilingGeo.translate(0,ceilingY,0);const ix=ceilingGeo.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];ceilingGeo.computeVertexNormals();b.add(ceilingGeo,'paint',null,WHITE);ceilingGeo.dispose();
    const glass=new THREE.MeshStandardMaterial({color:'#c4d9df',transparent:true,opacity:.13,roughness:.18,metalness:.08,depthWrite:false,side:THREE.DoubleSide});const sg=flatGeometry(sky,ceilingY+.02);b.add(sg,'caruselSky',null,'#ffffff');sg.dispose();
    for(let s=-10.4;s<=10.4;s+=2.08){const a=P(-3.9,s),c=P(3.9,s);b.rod([a[0],ceilingY+.05,a[1]],[c[0],ceilingY+.05,c[1]],.025,'#9da8a3','metal',5);}
    for(const r of [-3.9,0,3.9]){const a=P(r,-10.4),c=P(r,10.4);b.rod([a[0],ceilingY+.05,a[1]],[c[0],ceilingY+.05,c[1]],.03,'#9da8a3','metal',5);}
    for(const h of LEVELS.slice(1))for(const r of [-5.3,5.3])for(let s=-10;s<=10;s+=2.5){const [x,z]=P(r,s);b.cyl(x,floorY+h-.035,z,.04,.025,'#fff0da','glow',8);}
    for(const [s,y]of[[-3,4.5],[4,10.8]]){const [x,z]=P(0,s),light=new THREE.PointLight('#fff0d9',28,11,2);light.position.set(x,floorY+y,z);ctx.add(light);}
    // Six existing ground display tables remain; book stacks are authored art.
    const random=rng(8),covers=['#e2d8bd','#9d7054','#5a6a63','#404f58','#8b7f73','#cfb18d'];
    for(let i=0;i<6;i++){const s=((i+.5)/6-.5)*o.len*.6,[px,pz]=P(0,s),x=px+(random()-.5),z=pz;b.box(x,floorY,z,1.3,.8,.8,'#d8d2c4','wood',yaw);ctx.box(x,z,.7,.45,yaw,{prop:true,y:floorY,h:.8});
        for(let j=0;j<6;j++){const r=(j%3-1)*.35,t=(Math.floor(j/3)-.5)*.35,xx=x+r*o.uz+t*o.ux,zz=z-r*o.ux+t*o.uz;let y=floorY+.8;for(let k=0;k<2+(i+j)%3;k++){const h=.025+(i+j+k)%3*.012,col=covers[(i*3+j+k)%covers.length];b.box(xx,y,zz,.29,.003,.21,col,'paint',yaw);b.box(xx,y+.003,zz,.28,h-.006,.2,'#d9d2bf','paint',yaw);b.box(xx,y+h-.003,zz,.29,.003,.21,col,'paint',yaw);y+=h;}}}
    ctx.add(b.build('carusel-photo-led-interior',{castShadow:false,matOverrides:{caruselTimber:timber,caruselSky:glass}}));ctx.add(shelves.build('carusel-photo-led-books',{castShadow:false,matOverrides:{shelf}}));
    return{floorY,levels:LEVELS,inner,holes,gallerySurfaces,path,landings,railRecords,P,centre:{x:o.cx,z:o.cz},estimatedLayout:true};
}
