(async()=>{
 const THREE=await import('/game/vendor/three.module.min.js'),g=game,W=g.world;
 const guides=[],marks=[];W.group.traverse(m=>{if(m.isMesh&&m.geometry?.attributes?.position){if(m.name==='poi-door-guides')guides.push(m);if(/^marks /.test(m.name||''))marks.push(m);}});
 const triangles=m=>{const a=m.geometry.attributes,p=a.position.array,c=a.color?.array,I=m.geometry.index.array,out=[];for(let t=0;t<I.length;t+=3)out.push(Array.from(I.slice(t,t+3)).map(i=>({p:Array.from(p.slice(i*3,i*3+3)),c:c?Array.from(c.slice(i*3,i*3+3)):null})));return out;};
 const guideTriangles=guides.flatMap(triangles),oldGuideTriangles=marks.flatMap(triangles).filter(t=>t.every(v=>v.c?.[0]===242&&v.c?.[1]===44&&v.c?.[2]===2));
 const sameMaterial=guides.length===1&&marks.some(m=>m.material===guides[0].material);
 // Keep a real white carriageway-paint positive control at the exact entrance-guide square.
 const p=W.pois.find(p=>Math.hypot(p.doorX+127.18,p.doorZ+550.51)<5),x=p.doorX,z=p.doorZ;
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x-1.2,.28,z-1.2,x+1.2,.28,z-1.2,x+1.2,.28,z+1.2,x-1.2,.28,z+1.2],3));geo.setAttribute('color',new THREE.Uint8BufferAttribute([233,233,230,233,233,230,233,233,230,233,233,230],3,true));geo.setIndex([0,1,2,0,2,3]);
 const m=new THREE.Mesh(geo,marks[0].material);m.name='marks qa-white-paint';W.group.add(m);
 const previous=vqa.issues().map(i=>({...i}));const control=vqa.runGeometry(true);const whitePositive=vqa.issues().filter(i=>i.type==='marking-off-road'&&Math.hypot(i.x-x,i.z-z)<3).map(i=>({...i}));W.group.remove(m);geo.dispose();
 return {guides:guides.length,sameMaterial,guideTriangles,oldGuideTriangles,door:{x,z},whitePositive,control,beforeControl:previous.filter(i=>i.type==='marking-off-road')};
})()
