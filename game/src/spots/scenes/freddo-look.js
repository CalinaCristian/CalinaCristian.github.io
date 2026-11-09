// Primary photo references: freddo.ro freddo-hero.jpeg, DSC_9986 and DSC00466.
// All geometry/textures below are procedural; no reference pixels are shipped.
import * as THREE from '../../../vendor/three.module.min.js';
import {GeoBatch,canvas,canvasTexture,distPolyline,inPoly,polyArea,rng,centroid} from '../kit.js';
import {facadeToward,signAtlas} from '../buc.js';
import {sourceRecord} from '../source-buildings.js';

export function freddoFrontagePlan(ctx){
    const p=ctx.data.pois.find(p=>p.id==='n1416523788');if(!p)return null;let q=null;
    for(const w of ctx.data.ways.filter(w=>w.name==='Strada Smârdan')){const d=distPolyline(p.x,p.z,w.pts);if(!q||d.d<q.d)q=d;}
    const f=q&&facadeToward(ctx.data,p.x,p.z,q.cx,q.cz);if(!f)return null;
    let edge=null;for(let i=0;i<f.b.poly.length;i++){const a=f.b.poly[i],b=f.b.poly[(i+1)%f.b.poly.length],d=distPolyline(f.x,f.z,[a,b]);if(!edge||d.d<edge.d)edge={a,b,d:d.d};}
    const L=Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]),ux=(edge.b[0]-edge.a[0])/L,uz=(edge.b[1]-edge.a[1])/L;
    return{...f,...edge,building:f.b,L,ux,uz,source:f.b.id,poi:p.id,opening:{source:f.b.id,a:edge.a,b:edge.b,y0:0,y1:4.3,relative:true,foundation:true}};
}

export function oldTownGlazing(ctx,plan){
    // Neutral black frames and warm/cool glass replace the former repeated
    // invented tricolour fascias. No business identities are invented.
    const c=canvas(1024,1024),g=c.getContext('2d'),random=rng(32);
    for(let row=0;row<4;row++)for(let bay=0;bay<4;bay++){const x=bay*256,y=row*256;g.fillStyle=['#d3c9b5','#bdb7a9','#c8c2b6','#dad2c2'][row];g.fillRect(x,y,256,256);g.fillStyle='#242825';g.fillRect(x+12,y+38,232,218);
        const grad=g.createLinearGradient(0,y+44,0,y+256);grad.addColorStop(0,'#25343a');grad.addColorStop(.4,row%2?'#403c31':'#4c4636');grad.addColorStop(1,'#181e20');g.fillStyle=grad;g.fillRect(x+19,y+45,218,211);
        g.fillStyle='#c4af84';for(let j=0;j<8;j++)if(random()>.35)g.fillRect(x+24+j*25,y+172,9+random()*9,22+random()*35);
        g.fillStyle='#a18b66';g.fillRect(x+20,y+212,216,4);g.fillStyle='#171c1d';g.fillRect(x+122,y+45,7,211);g.fillStyle='rgba(176,198,201,.16)';g.beginPath();g.moveTo(x+25,y+45);g.lineTo(x+72,y+45);g.lineTo(x+210,y+256);g.lineTo(x+167,y+256);g.fill();}
    const map=canvasTexture(c,{repeat:true}),mat=new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:new THREE.Color('#f2d5a0'),emissiveIntensity:.12,roughness:.5});mat.name='old-town-neutral-shop-glazing';
    ctx.extras.buildings.group.traverse(o=>{if(o.isMesh&&o.material?.name==='facade-bucshop')o.material=mat;});
    if(!plan)return;
    const record=sourceRecord(plan.building,0,ctx.ground),y=record.datum;plan.baseY=y;
    const b=new GeoBatch(),P=(u,h,d=.04)=>[plan.a[0]+plan.ux*u+plan.nx*d,y+h,plan.a[1]+plan.uz*u+plan.nz*d],n=5,bay=plan.L/n;
    const glass=new THREE.MeshStandardMaterial({color:'#a9c1bc',transparent:true,opacity:.105,roughness:.13,metalness:.12,depthWrite:false,side:THREE.DoubleSide});
    b.quad(P(0,record.bottom-y),P(plan.L,record.bottom-y),P(plan.L,.18),P(0,.18),'#38382f','stone');b.quad(P(0,3.75),P(plan.L,3.75),P(plan.L,4.3),P(0,4.3),'#252821','metal');
    for(let i=0;i<n;i++){const a=i*bay+.12,z=(i+1)*bay-.12;b.quad(P(a,.18),P(z,.18),P(z,3.75),P(a,3.75),'#ffffff','freddoGlass');}
    for(let i=0;i<=n;i++){const [x,h,z]=P(i*bay,0,.08);b.box(x,h,z,.12,3.92,.14,'#22231f','metal',Math.atan2(plan.nx,plan.nz));}
    for(const h of [.12,3.74,4.1])b.rod(P(.02,h,.08),P(plan.L-.02,h,.08),h===4.1?.07:.035,'#a7864f','metal',6);
    ctx.add(b.build('freddo-source-glazed-front',{castShadow:false,matOverrides:{freddoGlass:glass}}));
    const sign=signAtlas([{x:plan.x+plan.nx*.2,y:y+3.98,z:plan.z+plan.nz*.2,yaw:Math.atan2(plan.nx,plan.nz),w:4.7,h:.75,text:'Freddo',bg:'#1e201d',fg:'#f5edda',font:q=>`italic 700 ${q}px Georgia, serif`,border:false}],{name:'freddo-official-name',night:.8});if(sign)ctx.add(sign);
}

export function freddoRoomDetails(ctx,b,{building,Q,floor,barX,barZ,djX,djZ,front}){
    const gold=new THREE.MeshStandardMaterial({color:'#b99555',roughness:.32,metalness:.72}),glow=new THREE.MeshStandardMaterial({color:'#e3bd76',emissive:'#ffc66d',emissiveIntensity:.65,roughness:.38}),mirror=new THREE.MeshStandardMaterial({color:'#7d6a4c',roughness:.18,metalness:.88});
    const p=polyArea(building.poly)>0?building.poly:[...building.poly].reverse();
    for(let i=0;i<p.length;i++){const a=p[i],z=p[(i+1)%p.length],L=Math.hypot(z[0]-a[0],z[1]-a[1]),ux=(z[0]-a[0])/L,uz=(z[1]-a[1])/L,nx=-uz,nz=ux;
        const V=(u,h,d=.055)=>{const [x,zz]=Q(a[0]+ux*u+nx*d,a[1]+uz*u+nz*d);return[x,floor+h,zz];};
        for(const h of [1.05,3.25,4.02])b.rod(V(.05,h),V(L-.05,h),.026,'#bc9655','freddoGold',6);
        if(front&&distPolyline(front.x,front.z,[a,z]).d<.01)continue;
        for(let u=.2;u<L-1;u+=2.8){const e=Math.min(L-.2,u+2.6);b.quad(V(u,1.16),V(e,1.16),V(e,3.12),V(u,3.12),'#665840','freddoMirror');
            b.rod(V(u,1.35,.07),V(e,2.9,.07),.009,'#edc079','freddoGlow',4);b.rod(V(u,2.85,.075),V(e,2,.075),.008,'#edc079','freddoGlow',4);}
    }
    for(const z of [50,54,58,62]){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length];if((a[1]>z)!==(c[1]>z))xs.push(a[0]+(c[0]-a[0])*(z-a[1])/(c[1]-a[1]));}xs.sort((a,b)=>a-b);if(xs.length<2)continue;const A=Q(xs[0]+.1,z),B=Q(xs.at(-1)-.1,z);b.rod([A[0],floor+4.02,A[1]],[B[0],floor+4.02,B[1]],.075,'#1e211f','metal',6);}
    for(const x of [10,18]){const A=Q(x,51),B=Q(x,60);b.rod([A[0],floor+3.78,A[1]],[B[0],floor+3.78,B[1]],.13,'#55534b','freddoGold',10);}
    for(let i=0;i<15;i++){const x=13.4+(i%5)*.22,z=53.5+Math.floor(i/5)*.22,h=.58+(i*7%6)*.12,[px,pz]=Q(x,z);b.cyl(px,floor+4.05-h,pz,.055,h,'#b69450','freddoGold',8);b.cyl(px,floor+4.05-h-.025,pz,.051,.025,'#f2c57c','freddoGlow',8);}
    for(const [x,z] of [[8.2,56],[8.6,61],[20.5,50.4]])if(inPoly(x,z,p)){const [px,pz]=Q(x,z);b.cyl(px,floor,pz,.055,1.03,'#252725','metal',8);b.cyl(px,floor+1.03,pz,.46,.055,'#6f4d30','wood',16);ctx.circle(px,pz,.46,1.1,{y:floor});}
    for(const h of [1.5,2.15]){b.box(barX-.15,floor+h,barZ,.3,.055,5.5,'#302a21','wood',.25);for(let i=0;i<16;i++){const z=barZ-2.45+i*.32;b.cyl(barX-.16,floor+h+.05,z,.036,.22,['#64522c','#454c34','#836643','#343f40'][i%4],'glass',6);b.cyl(barX-.16,floor+h+.27,z,.018,.065,'#b69f63','metal',6);}}
    for(let i=0;i<15;i++)b.box(djX-1.8+i*.25,floor,djZ+.53,.075,1.18,.045,'#775230','wood');
    for(const [x,z]of[[7.5,54],[8,61],[19.8,48.5]])for(let i=0;i<12;i++){const a=i*2.4,r=.12+(i%3)*.1,[px,pz]=Q(x+Math.cos(a)*r,z+Math.sin(a)*r);b.sphere(px,floor+3.3-(i%5)*.1,pz,.14,.08,.2,['#294a37','#345941','#46684a'][i%3],'paint',5,4);}
    return{freddoGold:gold,freddoGlow:glow,freddoMirror:mirror};
}
