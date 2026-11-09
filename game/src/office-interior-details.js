// Original procedural interpretation of privately compared interior photographs.
// Geometry dimensions/positions are authored estimates, not measured floor plans.
// Source links and the photo/CGI/historical distinctions: research/cv-interiors.md.
import * as THREE from '../vendor/three.module.min.js';
import {makeCanvasTexture} from './util.js';
import {GeoBatch} from './spots/kit.js';

const WHITE='#f0f0eb',YELLOW='#dfbd0b',GREY='#929a9c',DARK='#303638';
function weave(){return makeCanvasTexture(64,64,c=>{c.fillStyle='#ffffff';c.fillRect(0,0,64,64);for(let i=0;i<64;i++){c.fillStyle=i%2?'rgba(20,24,24,.05)':'rgba(255,255,255,.08)';c.fillRect(i,0,1,64);c.fillRect(0,i,64,1);}});}
function builder(o,id){
 const b=new GeoBatch(),fabric=weave(),materials={
  finish:new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.78}),
  cloth:new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,map:fabric,roughness:.96}),
  metal:new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,metalness:.55,roughness:.38}),
  glass:new THREE.MeshStandardMaterial({color:'#d3e6e8',vertexColors:true,transparent:true,opacity:.14,depthWrite:false,roughness:.15,metalness:.05}),
  glow:new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true}),
 };
 const box=(x,y,z,w,h,d,col=WHITE,key='finish',yaw=0)=>b.box(x,y,z,w,h,d,col,key,yaw);
 const body=(x,z,w,d)=>o.addBox(x,z,w,d);
 const chair=(x,z,col=YELLOW,yaw=0,high=false)=>{
  const y=high?.78:.42,w=high?.44:.54,back=high?.45:.65;
  box(x,y-.035,z,w,.07,w,col,'cloth',yaw);box(x+Math.sin(yaw)*w*.42,y+.035,z+Math.cos(yaw)*w*.42,w,back,.065,col,'cloth',yaw);
  for(const u of[-1,1])for(const v of[-1,1]){const dx=u*w*.4,dz=v*w*.4,xx=x+Math.cos(yaw)*dx+Math.sin(yaw)*dz,zz=z-Math.sin(yaw)*dx+Math.cos(yaw)*dz;b.rod([xx,.03,zz],[xx,y-.035,zz],.013,'#a3a8a7','metal',6);}
  body(x,z,w+.1,w+.15);
 };
 const plant=(x,z,h=1.35)=>{b.cyl(x,0,z,.21,.42,'#9b9f99','finish',10,.85);for(let i=0;i<7;i++){const a=i*Math.PI*2/7,tip=[x+Math.sin(a)*.35,h-.16*(i%3),z+Math.cos(a)*.35];b.rod([x,.35,z],tip,.012,'#697b55','finish',5);b.sphere(tip[0],tip[1],tip[2],.12,.24,.035,i%2?'#4b6c4a':'#617b52','finish',5,4);}body(x,z,.5,.5);};
 const roundTable=(x,z,r=.38,h=.61)=>{b.cyl(x,h-.035,z,r,.035,'#c6b397','finish',16);b.cyl(x,.04,z,.028,h-.075,'#c1c6c4','metal',6);b.cyl(x,0,z,r*.46,.035,'#a1a8a7','metal',12);body(x,z,r*2,r*2);};
 const pendant=(x,z,y,w=1.65,col='#267e78')=>{box(x,y,z,w,.10,.18,col,'finish');box(x,y-.014,z,w-.05,.014,.12,'#fff5da','glow');for(const dx of[-w*.35,w*.35])b.rod([x+dx,y+.1,z],[x+dx,y+.38,z],.004,'#b6b9b3','metal',4);};
 const finish=()=>{const group=b.build('office-photo-led-'+id,{matOverrides:materials});group.userData.sourceInterpretation=id;group.userData.estimatedLayout=true;o.scene.add(group);const ownedMaterials=new Set(Object.values(materials)),ownedTextures=new Set([fabric,...Object.values(materials).flatMap(m=>Object.values(m).filter(v=>v?.isTexture))]);let disposed=false;return{group,estimatedLayout:true,ownedMaterials,ownedTextures,dispose(){if(disposed)return;disposed=true;for(const t of ownedTextures)t.dispose();for(const m of ownedMaterials)m.dispose();ownedTextures.clear();ownedMaterials.clear();},get disposed(){return disposed;}};};
 return{b,box,body,chair,plant,roundTable,pendant,materials,finish};
}
function meetingRoom(q,{x,z,w,d,H}){
 const{box,body,b}=q,h=Math.min(H-.18,2.8),door=1.1;
 // Real visible partition pieces and a clear authored door aperture, rather
 // than the old filled collision box over the entire meeting-room floor.
 box(x,0,z,w,h,.035,'#ffffff','glass');body(x,z,w,.08);
 for(const side of[-1,1]){box(x+side*w/2,0,z+d/2,.035,h,d,'#ffffff','glass');body(x+side*w/2,z+d/2,.08,d);}
 for(const side of[-1,1]){const sw=(w-door)/2,px=x+side*(door/2+sw/2);box(px,0,z+d,sw,h,.035,'#ffffff','glass');body(px,z+d,sw,.08);}
 for(const px of[x-w/2,x+w/2])box(px,0,z+d/2,.035,h,.04,DARK,'metal');
 for(const zz of[z,z+d])box(x,h,zz,w,.035,.04,DARK,'metal');
 for(const px of[x-door/2,x+door/2])box(px,0,z+d,.025,h,.04,DARK,'metal');
 box(x,.73,z+d*.48,w-1.1,.045,d*.36,'#dfdcd2');body(x,z+d*.48,w-1.1,d*.36);
 for(const xx of[x-.85,x+.85])for(const zz of[z+d*.2,z+d*.78])q.chair(xx,zz,GREY,zz<z+d*.4?0:Math.PI);
 b.cyl(x,h-.05,z+d*.5,.45,.035,'#fff6db','glow',18);
}

/** Europe House: selected workplace/lounge character, not its complete plan. */
export function buildArniaInterior(o,{W,D,H}){
 const q=builder(o,'arnia-europe-house'),{b,box,body,chair,plant,pendant}=q;
 // A simple original circulation pattern in the observed yellow/grey palette.
 box(0,.003,-.2,1.8,.004,D-1.2,YELLOW,'cloth');
 for(const[z,side]of[[-4,1],[-1.8,-1],[1.8,1],[4.6,-1]]){box(side*1.5,.003,z,1.2,.004,.8,YELLOW,'cloth');box(side*2.25,.003,z+.4,.3,.004,.8,DARK,'cloth');}
 for(let z=-D/2+.7;z<D/2-.4;z+=1.2){box(0,H-.02,z,W-.2,.012,.014,'#c6cac5');}
 for(let x=-W/2+.6;x<W/2-.2;x+=1.2)box(x,H-.02,0,.014,.012,D-.2,'#c6cac5');
 for(const side of[-1,1])for(const z of[-1.6,1.0]){
  const x=side*4;box(x,.72,z,2.5,.045,.9,'#e7e6df');body(x,z,2.5,.9);
  for(const dx of[-1.14,1.14])box(x+dx,.02,z,.045,.70,.76,'#a9b0ad','metal');
  for(const dx of[-.48,.48]){box(x+dx,.9,z-.28,.56,.35,.035,'#202528');box(x+dx,.918,z-.259,.51,.30,.008,'#304e62','glow');box(x+dx,.76,z+.03,.46,.018,.15,'#383f42');box(x+dx,.76,z-.28,.18,.10,.12,'#373d3e');}
  chair(x,z+.65,'#363d40',0);pendant(x,z,H-.4,2.3);
 }
 // Acoustic rectangles are original arrangements, using observed material tones.
 for(let i=0;i<7;i++){const z=-2.5+i*1.05;box(-W/2+.13,1.45,z,.055,.55+(i%3)*.28,.62,i%3?YELLOW:GREY,'cloth');box(-W/2+.85,H-.32,z,1.3,.06,.7,i%3?YELLOW:GREY,'cloth');}
 meetingRoom(q,{x:-3.85,z:-D/2+.45,w:4.8,d:3.5,H});
 // White kitchenette and window-side counter preserve the full window run.
 const kx=W/2-2.2,kz=-D/2+.45;box(kx,0,kz,3.5,.88,.6,WHITE);body(kx,kz,3.5,.6);box(kx,.88,kz,3.6,.035,.64,'#b3b7b0');box(kx,1.55,kz,3.5,.7,.36,WHITE);
 for(const dx of[-.9,0,.9])box(kx+dx,0.08,kz+.306,.012,.72,.012,'#c5c8c1');
 b.cyl(kx+.65,.917,kz,.18,.012,'#7a8582','metal',12);b.rod([kx+.65,.92,kz-.2],[kx+.65,1.16,kz-.2],.012,'#a7b0af','metal',6);b.rod([kx+.65,1.16,kz-.2],[kx+.65,1.16,kz-.05],.012,'#a7b0af','metal',6);
 const cx=W/2-.55,cz=-3.95;box(cx,1.04,cz,.60,.05,3.25,WHITE);for(const zz of[cz-1.4,cz+1.4])box(cx,0,zz,.52,1.04,.05,WHITE);body(cx,cz,.6,3.25);
 for(const zz of[cz-1.0,cz+.3])chair(cx-.8,zz,YELLOW,-Math.PI/2,true);
 for(const zz of[cz-1,cz+.5]){b.rod([cx,H-.05,zz],[cx,H-.72,zz],.006,DARK,'metal',5);b.cyl(cx,H-.83,zz,.17,.16,'#b99582','finish',12,.30);}
 // Modular waiting seats/ottomans, away from the dialogue and exit aisle.
 for(const[x,z,col]of[[-5.4,4.5,YELLOW],[-4.55,4.5,GREY],[-3.7,4.5,YELLOW]]){box(x,.03,z,.78,.42,.78,col,'cloth');box(x,.45,z+.32,.78,.38,.10,col,'cloth');body(x,z,.8,.85);}
 for(const[x,z,col]of[[-5.2,3.25,GREY],[-3.8,3.25,YELLOW]]){b.cyl(x,.02,z,.34,.40,col,'cloth',16);body(x,z,.7,.7);}
 plant(-W/2+.65,D/2-1,1.5);plant(W/2-1.3,2.8,1.55);
 return q.finish();
}

/** Official DB Bucharest Education Plaza lounge, not a generic bank lobby. */
export function buildDBInterior(o,{W,D,H}){
 const q=builder(o,'db-bob-education-plaza'),{b,box,body,roundTable,plant,pendant}=q;
 const loungeChair=(x,z,col,yaw=0)=>{
  const poly=[];for(let i=0;i<=18;i++){const a=-Math.PI*.7+i/18*Math.PI*1.4;poly.push([Math.sin(a)*.49,Math.cos(a)*.49]);}for(let i=18;i>=0;i--){const a=-Math.PI*.7+i/18*Math.PI*1.4;poly.push([Math.sin(a)*.40,Math.cos(a)*.40]);}
  const world=poly.map(([u,v])=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,z-Math.sin(yaw)*u+Math.cos(yaw)*v]);b.cyl(x,.02,z,.44,.35,GREY,'cloth',18);b.prism(world,.32,.94,GREY,'cloth');b.cyl(x,.36,z,.39,.13,col,'cloth',18);body(x,z,1.02,1.02);
 };
 const sofa=(x,z,col)=>{box(x,.08,z,2.3,.34,.82,GREY,'cloth');box(x,.42,z,2.3,.12,.75,col,'cloth');box(x,.48,z+.34,2.3,.51,.15,col,'cloth');for(const dx of[-1.14,1.14]){b.cyl(x+dx,.08,z,.14,.68,GREY,'cloth',12);};body(x,z,2.6,.94);};
 sofa(-4.3,4.8,'#d96e18');loungeChair(-5.9,1.8,'#d96e18',-.4);loungeChair(-2.4,2.0,'#dfbd14',.6);roundTable(-4.1,2.5,.42);
 sofa(4.0,3.4,'#e0b914');loungeChair(5.6,.1,'#d96e18',.7);loungeChair(2.7,.05,'#e0b914',-.6);roundTable(4.3,1.45,.40);
 for(const[x,z]of[[-5.3,-4.5],[4.8,-4.8]]){box(x,0,z,1.4,1.75,.12,'#c65a20','cloth');body(x,z,1.4,.2);loungeChair(x+.6,z+1.4,'#e0b914',.4);roundTable(x-.6,z+1.7,.32,.7);}
 // Original nonfigurative wall art: photo murals/portraits are not copied.

 for(let j=0;j<8;j++){const x=-W/2+.14,z=-D/2+1.2+j*.54;box(x,.75+(j%3)*.23,z,.035,1.55-(j%3)*.18,.36,['#a6aba5','#dcba25','#b7b4a5','#be6c4d'][j%4]);}
 for(let z=-D/2+1.4;z<D/2-.5;z+=2.4){pendant(0,z,H-.40,W-.9,'#777b76');for(const x of[-W*.28,W*.28])b.rod([x,H-.18,-D/2+.4],[x,H-.18,D/2-.4],.065,'#727c7c','metal',10);}
 for(let x=-W/2+.6;x<W/2-.2;x+=.42)box(x,H-.19,-D/2+2.8,.10,.14,4.2,'#a4906d');
 // Brick accents are procedural masonry, not sampled photo pixels.
 for(let row=0;row<10;row++)for(let col=0;col<12;col++){const x=W/2-3.0+(col%12)*.20+(row%2)*.10;box(x,.06+row*.105,-D/2+.13,.19,.095,.025,['#a68d6c','#8d785b','#b49d7a'][(row+col)%3]);}
 plant(-W/2+.8,-D/2+1,1.65);plant(W/2-1,5.9,1.5);
 return q.finish();
}

/** PROEDUS Rosetti classroom character; acquisition date/CV-era fit unknown. */
export function buildRosettiInterior(o,{W,D,H}){
 const q=builder(o,'rosetti-proedus-classroom'),{b,box,body}=q,blue='#238ab1',metal='#8f9898',wood='#bb9b6f';
 for(const[x,z,w,d,yaw]of[[-W/2+.13,0,.04,D-.25,0],[0,D/2-.13,W-.25,.04,0],[0,-D/2+.13,W-.25,.04,0]]){box(x,1.02,z,w,1.25,d,blue);box(x,.94,z,w,.08,d,DARK);box(x,2.27,z,w,.08,d,DARK);}
 const ink=makeCanvasTexture(1024,320,c=>{c.fillStyle='#edf0ec';c.fillRect(0,0,1024,320);c.fillStyle='#253d52';c.textAlign='center';c.font='38px sans-serif';c.fillText('Matematică · Informatică',512,82);c.font='31px monospace';c.fillText('f(x) = x² − 4x + 3',512,168);c.font='25px monospace';c.fillText("program p; begin writeln('Hello'); end.",512,246);});
 q.materials.board=new THREE.MeshStandardMaterial({map:ink,vertexColors:true,roughness:.7});
 box(0,1.12,-D/2+.17,4.9,1.45,.04,'#4f5958');b.quad([-2.35,1.19,-D/2+.197],[2.35,1.19,-D/2+.197],[2.35,2.48,-D/2+.197],[-2.35,2.48,-D/2+.197],'#ffffff','board');
 box(0,2.74,-D/2+.22,5.0,.075,.09,'#3b4142');box(0,1.1,-D/2+.25,4.9,.045,.12,WHITE);
 o.signMesh.position.set(-W/2+.15,2.75,-1.4);o.signMesh.rotation.y=Math.PI/2;o.signMesh.scale.setScalar(.47);
 box(-2.6,.74,-3.1,1.35,.055,.68,'#bdc3bf');body(-2.6,-3.1,1.35,.68);for(const x of[-3.18,-2.02])box(x,.02,-3.1,.045,.72,.58,metal,'metal');
 // Paired individual desks flank a continuous clear entrance aisle. Their
 // count/spacing is an authored selection, not a traced classroom plan.
 for(let r=0;r<4;r++)for(const x of[-3.6,-2.65,2.65,3.6]){const z=-1.4+r*1.6;box(x,.72,z,.84,.045,.52,'#69abc2');body(x,z,.84,.52);
  for(const dx of[-.34,.34]){box(x+dx,.04,z,.035,.68,.40,metal,'metal');box(x+dx,.02,z+.07,.035,.035,.57,metal,'metal');}
  box(x,.42,z+.52,.38,.035,.39,wood);box(x,.47,z+.70,.38,.36,.032,wood);for(const dx of[-.15,.15]){box(x+dx,.02,z+.55,.025,.42,.33,metal,'metal');box(x+dx,.42,z+.7,.025,.4,.025,metal,'metal');}body(x,z+.55,.43,.48);
 }
 const lx=-W/2+1.15,lz=D/2-.4;box(lx,0,lz,1.75,1.88,.48,'#a2abaa');body(lx,lz,1.75,.48);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=lx-.56+col*.56,y=.04+row*.60;box(x,y,lz-.25,.53,.57,.025,(row+col)%3===0?'#73a0b0':(row+col)%3===1?'#b6bfba':'#858f8d');b.cyl(x+.17,y+.28,lz-.267,.018,.018,'#454e4d','metal',6,1,Math.PI/2);}
 // Keep the full glass run clear; only the physical radiator/rolled shade
 // hardware observed below/above it is represented.
 box(W/2-.24,.15,0,.12,.55,D*.5,'#e1e3da');for(let z=-D*.23;z<D*.25;z+=.13)box(W/2-.30,.17,z,.03,.51,.045,'#bfc6be');
 const winH=Math.min(H-1.2,2.2+(H>5?H*.4:0));for(let z=-D/2+1.4;z<D/2-.6;z+=2.2)b.rod([W/2-.13,.95+winH,z-.95],[W/2-.13,.95+winH,z+.95],.055,'#c4c9c1','finish',8);
 for(const z of[-2.25,2.25])box(0,H-.25,z,W,.25,.3,WHITE);
 for(const z of[-2.8,.7,3.6]){box(0,H-.08,z,1.3,.06,.25,'#dddeda');box(0,H-.095,z,1.22,.015,.18,'#fffaf1','glow');}
 return q.finish();
}
