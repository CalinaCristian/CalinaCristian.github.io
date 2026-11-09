import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { US_FOOTPRINTS } from '../../game/src/landmark-us-source.js';
import { SEATAC_AIRCRAFT } from '../../game/src/landmark-seatac-aircraft.js';
const root = new URL('../../', import.meta.url), sourceUrl = new URL('game/src/landmarks.js', root);
const evidence = JSON.parse(fs.readFileSync(new URL('game/research/landmarks-seatac-aircraft.json', root)));
const raw = JSON.parse(fs.readFileSync(new URL('game/research/source-roads-seattle-seatac.json', root)));
const district = JSON.parse(fs.readFileSync(new URL('game/data/seattle-seatac.json', root)));
const source = fs.readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (all, p) => p.startsWith('.') ? `from '${new URL(p, sourceUrl).href}'` : all);
const { Builder, airliner, M } = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport { Builder, airliner, M };').toString('base64'));
const near = (a,b,t=.003) => Math.hypot(a[0]-b[0],a[1]-b[1]) < t;
const inside = (p, r) => { let on=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])on=!on;}return on; };
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const intersects = (a,b,c,d) => {const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),x=cross(c,d,b);return u*v < -1e-8 && w*x < -1e-8;};
const trianglesInside = (p,t) => {const a=cross(t[0],t[1],p),b=cross(t[1],t[2],p),c=cross(t[2],t[0],p);return(a>1e-7&&b>1e-7&&c>1e-7)||(a< -1e-7&&b< -1e-7&&c< -1e-7);};
const f=evidence.modelFrame,co=Math.cos(f.rotation),si=Math.sin(f.rotation);
const local=([lat,lon])=>{const x=(lon-f.lon)*f.mPerLon,z=-(lat-f.lat)*f.mPerLat;return[x*co-z*si,x*si+z*co];};
const aprons=raw.airfield.filter(a=>a.tags.aeroway==='apron');
assert.equal(SEATAC_AIRCRAFT.length,4,'Retain all four representative aircraft; no population thinning');
const rows=[];
for(const a of SEATAC_AIRCRAFT){
 const e=evidence.records.find(r=>r.id===a.id);assert(e);assert.deepEqual(e.model,a);
 const center=e.geographicModelOrigin;
 const apron=aprons.filter(p=>inside([center.lon,center.lat],p.coordinates.map(([la,lo])=>[lo,la])));
 assert(apron.length,`${a.id} must be inside original mapped airside apron`);
 const dir=[Math.cos(a.heading),-Math.sin(a.heading)],k=a.lengthM/38;
 assert(near([a.x+dir[0]*17*k,a.z+dir[1]*17*k],local(e.samplePixelWgs84.nose)),`${a.id} measured nose axis`);
 assert(near([a.x-dir[0]*19.5*k,a.z-dir[1]*19.5*k],local(e.samplePixelWgs84.tailCone)),`${a.id} measured tail axis`);
 const b=new Builder(1);b.push(M(a.x,0,a.z,a.heading,1,1,a.spanM/(36.4*k)));airliner(b,0,0,0,a.livery,a.lengthM);b.pop();const g=b.finish().group;
 const verts=[],tris=[];g.updateMatrixWorld(true);g.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)verts.push([p.getX(i),p.getZ(i)]);const ix=o.geometry.index;for(let i=0;i<(ix?.count||p.count);i+=3){const tri=[0,1,2].map(j=>{const n=ix?ix.getX(i+j):i+j;return[p.getX(n),p.getZ(n)]});if(Math.abs(cross(...tri))>1e-8)tris.push(tri);}});
 let contacts=[];
 for(const id of ['w23772634','w23772637','w734002404','w869951038']){const poly=US_FOOTPRINTS[id];if(verts.some(v=>inside(v,poly))||tris.some(t=>poly.some(p=>trianglesInside(p,t))||t.some((a,i)=>poly.some((p,j)=>intersects(a,t[(i+1)%3],p,poly[(j+1)%poly.length])))))contacts.push(id);}
 assert.deepEqual(contacts,[],`${a.id}: do not overlap a source terminal body to fit an aircraft`);
 const anchor=[(f.lon-district.proj.lon0)*district.proj.mPerLon,-(f.lat-district.proj.lat0)*district.proj.mPerLat];
 const world=p=>[p[0]*co+p[1]*si+anchor[0],-p[0]*si+p[1]*co+anchor[1]],wv=verts.map(world),wt=tris.map(t=>t.map(world));
 const box=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))],ab=box(wv);
 const districtContacts=[];
 for(const [i,poly]of Object.entries(district.buildingFootprints)){const bb=box(poly);if(bb[2]<ab[0]||bb[0]>ab[2]||bb[3]<ab[1]||bb[1]>ab[3])continue;if(wv.some(v=>inside(v,poly))||wt.some(t=>poly.some(p=>trianglesInside(p,t))||t.some((v,j)=>poly.some((p,k)=>intersects(v,t[(j+1)%3],p,poly[(k+1)%poly.length])))))districtContacts.push(district.buildingIds[i]);}
 assert.deepEqual(districtContacts,[],`${a.id}: preserve every whole source body, including nearby parts`);
 const lateral=verts.map(v=>(v[0]-a.x)*dir[1]-(v[1]-a.z)*dir[0]);const span=Math.max(...lateral)-Math.min(...lateral);
 assert(Math.abs(span-a.spanM)<.15,`${a.id} measured wing span within mesh tessellation precision`);
 rows.push({id:a.id,sourceGate:e.gateContext.sourceId,sourceAprons:apron.map(p=>p.sourceId),planSpanM:span,sourceBuildingContacts:contacts,districtBodyContacts:districtContacts});
}
for(const i of [0,1]){const a=evidence.rejectedGenericPlacements[i];assert(!aprons.some(p=>inside([a.lon,a.lat],p.coordinates.map(([la,lo])=>[lo,la]))),'Actual unsupported original landside/bridge anchor stays rejected');}
const lm=LANDMARKS.find(l=>l.id==='seatac'),model=buildLandmark(lm,{realScale:true});
const collisionSha256=createHash('sha256').update(JSON.stringify(model.collision)).digest('hex');assert(model.collision.some(c=>c.structureKind==='terminal-below-covered-curb'));assert(model.collision.some(c=>c.structureKind==='terminal-above-covered-curb'));
assert.deepEqual(lm.sourceIds,['w23772634','w23772637','w734002404','w869951038']);
console.log(JSON.stringify({passed:true,aircraft:rows,collisionSha256,triangles:model.triangles,note:'Complete terminal rings, vertical envelope and road geometry retained; covered-curb structural collision is checked separately. Aircraft pose/plan measured independently; vertical shape and subtype remain estimates.'},null,2));
