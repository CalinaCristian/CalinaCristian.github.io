// Primary photo references: freddo.ro freddo-hero.jpeg, DSC_9986 and DSC00466.
// All geometry/textures below are procedural; no reference pixels are shipped.
import * as THREE from '../../../vendor/three.module.min.js';
import {GeoBatch,canvas,canvasTexture,distPolyline,inPoly,polyArea,rng} from '../kit.js';
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

// ---------------------------------------------------------------------------- Old Town shopfronts
// (owner, 2026-11-11: "Old Town shopfronts") The shop ground floors were one neutral bay design repeated: dark panels with
// tan blocks. They are now a 4 x 4 atlas of 16 shopfront bays in the Lipscani manner: a cornice, a painted fascia with a
// gilt line (left blank: no business names are invented), some with a striped awning, a transom of small panes, a lit
// display of a kind of shop (café, books, clothes, souvenirs, bakery, wine, jewellery, flowers), a glazed door in most, a
// stone stall riser, plastered piers between bays. The renderer maps one shop storey of 4 bays onto every wall, so the
// shader picks one of the 16 bays per bay from the bay's index and the building's colour: neighbouring bays and buildings
// differ. At night the interiors are lit. All procedural; the contents are generic and estimated.
const SHOP_KINDS=['cafe','books','fashion','souvenir','bakery','wine','jewel','florist'];
const FASCIA=['#1f3a2e','#5a1f22','#1d2023','#23324a','#3b2a1e','#e6dcc6','#2c4a44','#4a1d33'];
const AWNING=[['#7d1f22','#e9e1cf'],['#1f4a36','#e6dfcc'],['#2a3550','#e3dccb'],null];
function drawShopBay(g,e,x0,y0,k,rnd){
    const kind=SHOP_KINDS[k%8],fas=FASCIA[(k*5+1)%8],aw=k%4===1||k%7===3?AWNING[(k>>1)%3]:null,door=['l','r','c',null][(k*3)%4],frame=k%3===0?'#24282a':k%3===1?fas:'#3a3128';
    // plaster (tinted by the building colour), piers, cornice
    g.fillStyle='#efe8da';g.fillRect(x0,y0,256,256);
    for(const px of [x0,x0+246]){g.fillStyle='#f4eee2';g.fillRect(px,y0,10,256);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(px===x0?px+9:px,y0,1.5,256);}
    g.fillStyle='#f6f1e6';g.fillRect(x0,y0,256,11);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(x0,y0+11,256,3);
    // fascia: painted board with a gilt line, blank
    g.fillStyle=fas;g.fillRect(x0+10,y0+16,236,40);g.strokeStyle='#b99a5b';g.lineWidth=2;g.strokeRect(x0+15,y0+20,226,32);
    g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x0+10,y0+16,236,6);
    let top=y0+60;
    if(aw){ // striped canvas awning with a scalloped valance
        for(let i=0;i<15;i++){g.fillStyle=aw[i%2];g.fillRect(x0+10+i*15.8,y0+58,15.8,26);}
        g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x0+10,y0+58,236,4);
        for(let i=0;i<15;i++){g.fillStyle=aw[i%2];g.beginPath();g.arc(x0+18+i*15.8,y0+84,7.9,0,Math.PI);g.fill();}
        top=y0+96;}
    const bot=y0+226,L=x0+12,R=x0+244;
    g.fillStyle=frame;g.fillRect(L,top,R-L,bot-top);
    // openings: door (58 px = 0.9 m) and display window(s)
    const dw=58,dx=door==='l'?L+6:door==='r'?R-6-dw:door==='c'?x0+128-dw/2:null;
    const wins=[];if(dx===null)wins.push([L+6,R-6]);else{if(dx-(L+6)>20)wins.push([L+6,dx-6]);if(R-6-(dx+dw)>20)wins.push([dx+dw+6,R-6]);}
    const tTop=top+5,tBot=top+22,gTop=tBot+5;
    // transom panes over everything
    for(let x=L+6;x<R-6;x+=29){const w=Math.min(26,R-6-x);g.fillStyle='#3c4446';g.fillRect(x,tTop,w,tBot-tTop);g.fillStyle='rgba(255,226,170,.35)';g.fillRect(x+2,tTop+2,w-4,tBot-tTop-4);}
    const interior=(ax,ay,bx,by,dark=1)=>{ // the lit room seen through the glass
        const gr=g.createLinearGradient(0,ay,0,by);gr.addColorStop(0,kind==='jewel'?'#2a2622':'#8a6a46');gr.addColorStop(.55,kind==='jewel'?'#3a332b':'#b8935f');gr.addColorStop(1,'#4a3a2a');
        g.fillStyle=gr;g.fillRect(ax,ay,bx-ax,by-ay);
        g.fillStyle='rgba(255,236,190,.55)';for(let x=ax+14;x<bx-6;x+=34){g.fillRect(x,ay,1,10);g.beginPath();g.arc(x+.5,ay+12,3.2,0,7);g.fill();}
        const W=bx-ax,H=by-ay,c=['#a33a2e','#2f5d7a','#d0a43c','#3f6b3a','#6d3a6b','#c76a2b','#e2d8c4','#2b2b2b'];
        if(kind==='books'||kind==='wine'||kind==='bakery'||kind==='souvenir'){
            for(let sy=ay+22;sy<by-10;sy+=kind==='souvenir'?16:20){g.fillStyle='#5a4128';g.fillRect(ax+3,sy+14,W-6,3);
                for(let x=ax+5;x<bx-6;){const w=kind==='books'?3+rnd()*4:kind==='wine'?4:kind==='bakery'?11+rnd()*6:7+rnd()*3,h=kind==='books'?9+rnd()*5:kind==='wine'?13:kind==='bakery'?6:10;
                    if(kind==='bakery'){g.fillStyle=rnd()<.5?'#c48a4a':'#d9a865';g.beginPath();g.ellipse(x+w/2,sy+14-h/2,w/2,h/2,0,0,7);g.fill();}
                    else if(kind==='wine'){g.fillStyle=rnd()<.5?'#2d4a2a':'#4a2626';g.fillRect(x,sy+14-h,w,h);g.fillRect(x+1,sy+14-h-4,2,4);}
                    else{g.fillStyle=c[Math.floor(rnd()*c.length)];g.fillRect(x,sy+14-h,w,h);}
                    x+=w+(kind==='books'?.6:kind==='wine'?2.5:2);}}}
        else if(kind==='fashion'){g.fillStyle='#2b2520';g.fillRect(ax+4,ay+26,W-8,2);for(let x=ax+8;x<bx-10;x+=11+rnd()*4){g.fillStyle=c[Math.floor(rnd()*c.length)];g.beginPath();g.moveTo(x,ay+30);g.lineTo(x+9,ay+30);g.lineTo(x+11,ay+30+34+rnd()*12);g.lineTo(x-2,ay+30+34+rnd()*12);g.fill();}
            g.fillStyle='#d8cfc0';const mx=ax+W*.5;g.beginPath();g.arc(mx,by-H*.62,4,0,7);g.fill();g.fillRect(mx-6,by-H*.58,12,24);g.fillStyle=c[Math.floor(rnd()*5)];g.fillRect(mx-7,by-H*.58,14,20);g.fillStyle='#2a2a2a';g.fillRect(mx-1,by-H*.58+24,2,H*.3);}
        else if(kind==='cafe'){g.fillStyle='#3a2a1e';g.fillRect(ax+4,by-30,W*.45,22);g.fillStyle='#d8c7a3';g.fillRect(ax+4,by-32,W*.45,3);
            for(let x=ax+W*.55;x<bx-14;x+=26){g.fillStyle='#2a201a';g.fillRect(x,by-24,16,2);g.fillRect(x+7,by-24,2,16);g.fillRect(x-6,by-20,2,14);g.fillRect(x+20,by-20,2,14);g.fillStyle='rgba(240,230,210,.9)';g.fillRect(x+5,by-27,5,3);}
            g.fillStyle='#262626';g.fillRect(ax+8,ay+28,W*.35,16);g.fillStyle='#efe6d2';for(let i=0;i<4;i++)g.fillRect(ax+11,ay+31+i*3.2,W*.25,1.2);}
        else if(kind==='jewel'){for(let x=ax+8;x<bx-20;x+=32){g.fillStyle='#1c1a18';g.fillRect(x,by-34,26,26);g.fillStyle='rgba(220,235,240,.25)';g.fillRect(x,by-34,26,8);for(let i=0;i<6;i++){g.fillStyle=rnd()<.5?'#f2e2a0':'#ffffff';g.fillRect(x+3+rnd()*20,by-30+rnd()*8,1.6,1.6);}}}
        else if(kind==='florist'){for(let x=ax+6;x<bx-8;x+=14){g.fillStyle='#4a4f4a';g.fillRect(x,by-16,11,10);for(let i=0;i<7;i++){g.fillStyle=i<3?'#3f6b34':c[[0,2,4,5,6][Math.floor(rnd()*5)]];g.beginPath();g.arc(x+5.5+(rnd()-.5)*10,by-20-rnd()*16,2.6+rnd()*2,0,7);g.fill();}}
            g.fillStyle='#3f6b34';for(let i=0;i<5;i++){g.beginPath();g.arc(ax+10+rnd()*(W-20),ay+30+rnd()*20,5+rnd()*5,0,7);g.fill();}}
        g.fillStyle=`rgba(0,0,0,${.12*dark})`;g.fillRect(ax,ay,W,H);
    };
    const glass=(ax,ay,bx,by)=>{g.fillStyle='rgba(150,180,190,.12)';g.fillRect(ax,ay,bx-ax,by-ay);g.fillStyle='rgba(230,240,245,.13)';g.beginPath();g.moveTo(ax+(bx-ax)*.15,ay);g.lineTo(ax+(bx-ax)*.32,ay);g.lineTo(ax+(bx-ax)*.06,by);g.lineTo(ax-(bx-ax)*.11,by);g.closePath();g.save();g.beginPath();g.rect(ax,ay,bx-ax,by-ay);g.clip();g.beginPath();g.moveTo(ax+(bx-ax)*.55,ay);g.lineTo(ax+(bx-ax)*.62,ay);g.lineTo(ax+(bx-ax)*.4,by);g.lineTo(ax+(bx-ax)*.33,by);g.fill();g.restore();};
    const lit=[];
    for(const [ax,bx] of wins){interior(ax,gTop,bx,bot-4);glass(ax,gTop,bx,bot-4);if(bx-ax>110){g.fillStyle=frame;g.fillRect((ax+bx)/2-2.5,gTop,5,bot-4-gTop);}g.fillStyle='rgba(0,0,0,.35)';g.fillRect(ax,bot-6,bx-ax,2);lit.push([ax,gTop,bx,bot-4]);}
    lit.push([L+6,tTop,R-6,tBot]);
    if(dx!==null){g.fillStyle=frame;g.fillRect(dx-3,gTop-2,dw+6,256+y0-gTop+2);interior(dx+5,gTop+3,dx+dw-5,bot+8,1.6);glass(dx+5,gTop+3,dx+dw-5,bot+8);g.fillStyle=frame;g.fillRect(dx+5,bot+8,dw-10,y0+252-bot-8);
        g.fillStyle='#c9a85a';g.fillRect(door==='r'?dx+9:dx+dw-12,gTop+60,3,26);lit.push([dx+5,gTop+3,dx+dw-5,bot+8]);g.fillStyle='#6f685d';g.fillRect(dx-4,y0+250,dw+8,6);}
    // stall riser: stone panel under the windows
    for(const [ax,bx] of wins){g.fillStyle='#a49c8e';g.fillRect(ax-2,bot,bx-ax+4,y0+256-bot);g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=1.5;g.strokeRect(ax+4,bot+6,bx-ax-8,y0+256-bot-12);}
    // night: the same lit areas, brighter lamps
    for(const [ax,ay,bx,by] of lit){e.drawImage(g.canvas,ax,ay,bx-ax,by-ay,ax,ay,bx-ax,by-ay);}
    e.fillStyle='rgba(0,0,0,.35)';for(const [ax,ay,bx,by] of lit)e.fillRect(ax,ay,bx-ax,by-ay);
}
export function oldTownGlazing(ctx,plan){
    const c=canvas(1024,1024),g=c.getContext('2d'),ec=canvas(1024,1024),e=ec.getContext('2d'),random=rng(32);
    e.fillStyle='#000';e.fillRect(0,0,1024,1024);
    for(let k=0;k<16;k++)drawShopBay(g,e,(k%4)*256,Math.floor(k/4)*256,k,random);
    const map=canvasTexture(c,{repeat:true}),em=canvasTexture(ec,{repeat:true});
    const mat=new THREE.MeshStandardMaterial({map,vertexColors:true,emissiveMap:em,emissive:new THREE.Color('#ffe0b0'),emissiveIntensity:0,roughness:.55});
    mat.name='old-town-shopfront-atlas';mat.userData.nightEmissive=.42;
    mat.customProgramCacheKey=()=>'old-town-shopfront-atlas';
    // (owner, 2026-11-11: "old town flickers like crazy") The bay's design is a hash of the building colour. Read from the
    // interpolated vColor, that colour differs by a rounding step from pixel to pixel on a wall seen at an angle, and the hash
    // turns the step into another design: the shopfront was a per-pixel stipple of two designs that crawled with the camera.
    // The hash now reads the colour through a flat varying: the vertex value itself, the same for every pixel of the wall.
    mat.onBeforeCompile=sh=>{
        sh.vertexShader=sh.vertexShader.replace('#include <color_pars_vertex>',`#include <color_pars_vertex>
            flat varying vec3 vOtColor;`).replace('#include <color_vertex>',`#include <color_vertex>
            #ifdef USE_COLOR
                vOtColor = color.rgb;
            #else
                vOtColor = vec3(0.5);
            #endif`);
        const pick=`
            vec2 otU = vMapUv * 4.0; float otBay = floor(otU.x);
            vec3 otC = vOtColor;
            float otH = fract(sin(dot(vec3(otBay, otC.r * 61.0 + otC.g * 17.0, otC.b * 43.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            float otK = floor(otH * 15.999);
            vec2 otUV = (vec2(mod(otK, 4.0), floor(otK / 4.0)) + vec2(fract(otU.x), clamp(fract(otU.y), 0.002, 0.998))) / 4.0;
            vec2 otDX = dFdx(vMapUv), otDY = dFdy(vMapUv);`;
        sh.fragmentShader=sh.fragmentShader.replace('#include <color_pars_fragment>',`#include <color_pars_fragment>
            flat varying vec3 vOtColor;`).replace('#include <map_fragment>',`${pick}
            vec4 sampledDiffuseColor = textureGrad(map, otUV, otDX, otDY); diffuseColor *= sampledDiffuseColor;`)
            .replace('#include <emissivemap_fragment>',`
            vec4 emissiveColor = textureGrad(emissiveMap, otUV, otDX, otDY); totalEmissiveRadiance *= emissiveColor.rgb;`);
    };
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
    // The name board hangs in the top of the glazing (just under its top band, where the terrace roof does not hide it), in
    // the end bay: the first-floor balcony stands on the middle window bays (up to three, as the facade draws them).
    const nb=Math.max(1,Math.round(plan.L/3.3)),bw=plan.L/nb,sw=Math.min(3.2,bw-.35),[sx,,sz]=P(plan.L-bw/2,0,.2);
    const sign=signAtlas([{x:sx,y:y+3.42,z:sz,yaw:Math.atan2(plan.nx,plan.nz),w:sw,h:.6,text:'Freddo',bg:'#1e201d',fg:'#f5edda',font:q=>`italic 700 ${q}px Georgia, serif`,border:false}],{name:'freddo-official-name',night:.8});if(sign)ctx.add(sign);
}

export function freddoRoomDetails(ctx,b,{building,Q,floor,barX,barZ,djX,djZ,front}){
    const gold=new THREE.MeshStandardMaterial({color:'#b99555',roughness:.32,metalness:.72}),glow=new THREE.MeshStandardMaterial({color:'#e3bd76',emissive:'#ffc66d',emissiveIntensity:.65,roughness:.38}),mirror=new THREE.MeshStandardMaterial({color:'#7d6a4c',roughness:.18,metalness:.88}),ceiling=new THREE.MeshStandardMaterial({color:'#141713',roughness:.95,metalness:0}),duct=new THREE.MeshStandardMaterial({color:'#4c514a',roughness:.6,metalness:.55});
    const p=polyArea(building.poly)>0?building.poly:[...building.poly].reverse();
    for(let i=0;i<p.length;i++){const a=p[i],z=p[(i+1)%p.length],L=Math.hypot(z[0]-a[0],z[1]-a[1]),ux=(z[0]-a[0])/L,uz=(z[1]-a[1])/L,nx=-uz,nz=ux;
        const V=(u,h,d=.055)=>{const [x,zz]=Q(a[0]+ux*u+nx*d,a[1]+uz*u+nz*d);return[x,floor+h,zz];};
        for(const h of [1.05,3.25,4.02])b.rod(V(.05,h),V(L-.05,h),.026,'#bc9655','freddoGold',6);
        if(front&&distPolyline(front.x,front.z,[a,z]).d<.01)continue;
        for(let u=.2;u<L-1;u+=2.8){const e=Math.min(L-.2,u+2.6);b.quad(V(u,1.16),V(e,1.16),V(e,3.12),V(u,3.12),'#665840','freddoMirror');
            b.rod(V(u,1.35,.07),V(e,2.9,.07),.009,'#edc079','freddoGlow',4);b.rod(V(u,2.85,.075),V(e,2,.075),.008,'#edc079','freddoGlow',4);}
    }
    for(const z of [50,54,58,62]){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length];if((a[1]>z)!==(c[1]>z))xs.push(a[0]+(c[0]-a[0])*(z-a[1])/(c[1]-a[1]));}xs.sort((a,b)=>a-b);if(xs.length<2)continue;const A=Q(xs[0]+.1,z),B=Q(xs.at(-1)-.1,z);b.rod([A[0],floor+4.02,A[1]],[B[0],floor+4.02,B[1]],.075,'#1e211f','metal',6);}
    for(const x of [10,18]){const A=Q(x,51),B=Q(x,60);b.rod([A[0],floor+3.78,A[1]],[B[0],floor+3.78,B[1]],.13,'#55534b','freddoDuct',10);}
    for(const x of [11.5,16.5])for(let j=0;j<11;j++){const z=49.9+j*1.18;if(!inPoly(x,z,p))continue;const [px,pz]=Q(x,z);b.sphere(px,floor+3.55-.08*Math.sin(j*.7),pz,.025,.035,.025,'#f2cc85','freddoGlow',6,4);if(j){const [ax,az]=Q(x,z-1.18);b.rod([ax,floor+3.65,az],[px,floor+3.65,pz],.006,'#272a24','metal',3);}}
    for(let i=0;i<15;i++){const x=13.4+(i%5)*.22,z=53.5+Math.floor(i/5)*.22,h=.58+(i*7%6)*.12,[px,pz]=Q(x,z);b.cyl(px,floor+4.05-h,pz,.055,h,'#b69450','freddoGold',8);b.cyl(px,floor+4.05-h-.025,pz,.051,.025,'#f2c57c','freddoGlow',8);}
    for(const [x,z] of [[8.6,61],[15.2,54.4],[14.5,58.3],[19.5,52.5],[18.5,61.5]])if(inPoly(x,z,p)){const [px,pz]=Q(x,z);b.cyl(px,floor,pz,.055,1.03,'#252725','metal',8);b.cyl(px,floor+1.03,pz,.46,.055,'#795634','wood',16);for(const side of [-1,1]){b.cyl(px+side*.18,floor+1.09,pz,.035,.16,'#92704d','glass',8);b.cyl(px+side*.18,floor+1.25,pz,.039,.015,'#c1b18e','glass',8);}ctx.circle(px,pz,.46,1.1,{y:floor});}
    for(const h of [1.5,2.15]){b.box(barX-.15,floor+h,barZ,.3,.055,5.5,'#302a21','wood',.25);for(let i=0;i<16;i++){const z=barZ-2.45+i*.32;b.cyl(barX-.16,floor+h+.05,z,.036,.22,['#64522c','#454c34','#836643','#343f40'][i%4],'glass',6);b.cyl(barX-.16,floor+h+.27,z,.018,.065,'#b69f63','metal',6);}}
    for(let i=0;i<15;i++)b.box(djX-1.8+i*.25,floor,djZ+.53,.075,1.18,.045,'#775230','wood');
    for(const [x,z]of[[7.5,54],[8,61],[19.8,48.5]])for(let i=0;i<12;i++){const a=i*2.4,r=.12+(i%3)*.1,[px,pz]=Q(x+Math.cos(a)*r,z+Math.sin(a)*r);b.sphere(px,floor+3.3-(i%5)*.1,pz,.14,.08,.2,['#294a37','#345941','#46684a'][i%3],'paint',5,4);}
    return{freddoGold:gold,freddoGlow:glow,freddoMirror:mirror,freddoCeiling:ceiling,freddoDuct:duct};
}
