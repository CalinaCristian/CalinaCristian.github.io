import fs from 'node:fs';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const output=process.argv[2] || fileURLToPath(new URL('./actual-ground-controls.json',import.meta.url));
const {buildTramGrades}=await import(root+'/game/src/tram-grade.js');const {buildTramNetwork}=await import(root+'/game/src/tram-path.js');
const {Traffic}=await import(root+'/game/src/traffic.js');const {makeVehicle}=await import(root+'/game/src/vehicles.js');const {bridgeJunctionSlab}=await import(root+'/game/src/bridge-junction.js');const {triangleContact}=await import(root+'/handoffs/fidelity/independent-rail-body-observer/body-checks.js');
const {data,edges}=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/handoffs/fidelity/rail-roadside-clearance/grade-inputs.json.gz'))).grozavesti;const g=buildTramGrades(data,{coreEdges:edges});const net=buildTramNetwork(data,{resolveGrade:g.resolveGrade});
const F=JSON.parse(fs.readFileSync(root+'/handoffs/fidelity/bridge-junction-slabs/native-pad-fixture.json'));
const slabs=F.nodes.map(row=>bridgeJunctionSlab({...row,bottomHeightAt:(x,z)=>{const es=row.edges;let best=Infinity,y;for(const e of es){let t=Math.max(0,Math.min(1,((x-e.a.x)*e.dirx+(z-e.a.z)*e.dirz)/e.len));const d=Math.hypot(x-e.a.x-e.dirx*e.len*t,z-e.a.z-e.dirz*e.len*t);if(d<best){best=d;y=e.ya+(e.yb-e.ya)*t;}}return .24+y-Math.min(1.1,Math.max(.05,y));}}));
const T=Object.create(Traffic.prototype);T.world={tramDeckSupportAt:g.support.at};
let poses=0,unknown=0,contacts=[];const sources=new Set();
for(const edge of net.edges){if(!g.corridors.some(c=>c.groundLevel&&c.sourceId===edge.sourceId))continue;
 const near=F.nodes.some(r=>Math.min(Math.hypot(edge.a.x-r.node.x,edge.a.z-r.node.z),Math.hypot(edge.b.x-r.node.x,edge.b.z-r.node.z))<90);if(!near)continue;
 const wayEdges=net.allEdges.filter(e=>e.sourceId===edge.sourceId).sort((a,b)=>a.sourceSegment-b.sourceSegment),i=wayEdges.indexOf(edge);
 for(const dir of edge.railDirections)for(const kind of ['tram-v3a','tram-imperio']){const mesh=makeVehicle(kind,undefined,{city:'bucharest',instanced:true});const geo=mesh.userData._model.geo,P=geo.attributes.position,I=geo.index;
  for(let j=0;j<=Math.ceil(edge.len);j++){const s=edge.len*j/Math.ceil(edge.len),v={edge,dir,s,tram:true,long:true,length:mesh.userData.length,width:mesh.userData.width,mesh,route:(dir>0?wayEdges.slice(i+1):wayEdges.slice(0,i).reverse()).filter(e=>e.usable).map(e=>({e,dir})),hist:(dir>0?wayEdges.slice(0,i):wayEdges.slice(i+1).reverse()).filter(e=>e.usable).map(e=>({e,dir,lat:0})),speed:0,lane:0,laneCur:0,latExtraCur:0,lateralExtra:0,latBlend:0,y:.24};
   try{T.ensureRoute(v);T.placeOnLane(v,true,0);}catch{unknown++;continue;}poses++;sources.add(edge.sourceId);mesh.updateMatrixWorld(true);const m=mesh.matrixWorld.elements;
   const vs=Array.from({length:P.count},(_,k)=>{const x=P.getX(k),y=P.getY(k),z=P.getZ(k);return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];});
   for(const slab of slabs){if(Math.hypot(v.x-slab.deck.x,v.z-slab.deck.z)>v.length/2+slab.deck.r+2)continue;const ts=[...slab.underside,...slab.fascia.flatMap(f=>[[f.vertices[0],f.vertices[1],f.vertices[2]],[f.vertices[0],f.vertices[2],f.vertices[3]]])];
    for(let k=0;k<(I?I.count:P.count);k+=3){const b=[0,1,2].map(n=>vs[I?I.getX(k+n):k+n]);for(const t of ts){const hit=triangleContact(b,t);if(hit){contacts.push({sourceId:edge.sourceId,segment:edge.sourceSegment,s,dir,kind,sourcePad:slab.sourceNodeId,bodyTriangle:k/3,point:hit.point});break;}}if(contacts.length>500)break;}
   }
  }
 }
}
fs.writeFileSync(output,JSON.stringify({source:F.source,poses,unknown,sources:[...sources],contacts,scope:'Actual emitted primary27/36m bodies at≤1m source stations through native Traffic pose; fixed existing native road pad hulls, modeled depths, no browser/new canonical World pass'},null,2));console.log({poses,unknown,contacts:contacts.length,sources:[...sources]});
// Geometric-only controls for two real nearby source tracks whose route
// direction is unresolved. Do not change source graph/admission or claim travel.
const {decodeTramPoints}=await import(root+'/game/src/tram-path.js');let geometric=0,geometricUnknown=0,geometricContacts=[];
for(const sourceId of ['w660927514','w660927520']){const w=data.tramSourceWays.find(w=>w.sourceId===sourceId),points=decodeTramPoints(w.points,data.q),ss=[0];for(let i=1;i<points.length;i++)ss.push(ss.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 const point=s=>{if(s<0||s>ss.at(-1))return null;let i=ss.findIndex((v,k)=>k&&v>=s);if(i<1)i=1;const t=(s-ss[i-1])/(ss[i]-ss[i-1]);return[points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];};
 for(const kind of ['tram-v3a','tram-imperio'])for(const dir of [1,-1]){const mesh=makeVehicle(kind,undefined,{city:'bucharest',instanced:true}),geo=mesh.userData._model.geo,P=geo.attributes.position,I=geo.index,L=mesh.userData.length;
  for(let s=0;s<=ss.at(-1);s+=1){const C=point(s);if(!slabs.some(r=>Math.hypot(C[0]-r.deck.x,C[1]-r.deck.z)<L/2+r.deck.r+2))continue;const A=point(s+dir*L*.36),B=point(s-dir*L*.36);if(!A||!B){geometricUnknown++;continue;}geometric++;const h=Math.atan2(-(A[0]-B[0]),-(A[1]-B[1]));mesh.position.set(C[0],.24,C[1]);mesh.rotation.set(0,h,0,'YXZ');mesh.updateMatrixWorld(true);const m=mesh.matrixWorld.elements;const vs=Array.from({length:P.count},(_,k)=>{const x=P.getX(k),y=P.getY(k),z=P.getZ(k);return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]});
   for(const slab of slabs){if(Math.hypot(C[0]-slab.deck.x,C[1]-slab.deck.z)>L/2+slab.deck.r+2)continue;const ts=[...slab.underside,...slab.fascia.flatMap(f=>[[f.vertices[0],f.vertices[1],f.vertices[2]],[f.vertices[0],f.vertices[2],f.vertices[3]]])];for(let k=0;k<(I?I.count:P.count);k+=3){const b=[0,1,2].map(n=>vs[I?I.getX(k+n):k+n]);for(const t of ts){const hit=triangleContact(b,t);if(hit){geometricContacts.push({sourceId,s,dir,kind,sourcePad:slab.sourceNodeId,bodyTriangle:k/3,point:hit.point});break;}}}}
  }
 }
}
const q=JSON.parse(fs.readFileSync(output));q.unresolvedDirectionGeometricControls={poses:geometric,unknown:geometricUnknown,contacts:geometricContacts,sourceIds:['w660927514','w660927520'],scope:'Physical geometry only, both headings on each complete unchanged source polyline; no legal-direction/admission/source override and no cross-way routing joins'};fs.writeFileSync(output,JSON.stringify(q,null,2));console.log({geometric,geometricUnknown,contacts:geometricContacts.length});
