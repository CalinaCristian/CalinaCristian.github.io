// CPU export of the actual close-up kernels. No browser or replacement geometry.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../game/vendor/three.module.min.js';
import {Ground,Painter} from '../../game/src/spots/ground.js';
import {decodeSourceContext,sourceTerrainField} from '../../game/src/spots/source-context-data.js';
import {prepareContextWater} from '../../game/src/spots/source-context-landscape.js';
import {paintSourceContext,buildSourceContextGround} from '../../game/src/spots/source-context-surface.js';
import {sourceCoastWater} from '../../game/src/spots/source-coast-water.js';
import {inPoly} from '../../game/src/spots/kit.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return[a.slice(2,i),a.slice(i+1)];}));
if(!args.source||!args.native||!args.output)throw Error('Use --source=JSON --native=JSON --output=JSON [--extensions=JSON]');
const bytes=fs.readFileSync(args.source),raw=JSON.parse(bytes),native=JSON.parse(fs.readFileSync(args.native)),data=decodeSourceContext(raw,native),ground=new Ground(native.terrain),field=sourceTerrainField(raw.terrain,native.origin,native.projection),state={};
const ctx2d=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}});globalThis.document={createElement:()=>({width:0,height:0,getContext:ctx2d})};
const extras={sourceContext:state};if(args.extensions)extras.regionalTerrain={waterExtensionRecords:JSON.parse(fs.readFileSync(args.extensions)).records};
const ctx={data:native,ground,painter:new Painter(),extras,terrainOpts:{outerPad:0,innerStep:2},scene:new THREE.Scene(),add(o){this.scene.add(o);}};
ground.sourceTerrain={heightAt:field.heightAt,transitionM:native.terrain.d};state.water=prepareContextWater(ctx,data,{x0:-4000,z0:-3600,x1:4000,z1:3600});paintSourceContext(ctx,data);const result=buildSourceContextGround(ctx,{pixels:1}),unique=new Map(),segments=[];
for(const m of result.group.children){const p=m.geometry.attributes.position,I=m.geometry.index.array;for(let i=0;i<I.length;i+=3){const f=[I[i],I[i+1],I[i+2]].map(k=>[p.getX(k),p.getY(k),p.getZ(k)]);for(const[axis,v,side]of[[0,-4000,'west'],[0,4000,'east'],[2,-3600,'north'],[2,3600,'south']]){const edge=f.filter(p=>p[axis]===v);for(const p of edge)unique.set(p[0]+','+p[2],p);if(edge.length===2)segments.push({side,points:edge});}}}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),kernelNames=['ground','source-context-data','source-context-surface','source-context-landscape','source-water-faces','source-coast-water'];
const out={scope:'Actual CPU source-ground/water kernel emission; authored near-scene modifications do not reach the outer 4km frame. Native verification remains open.',id:native.id,sourceDataSHA256:hash(bytes),nativeDataSHA256:hash(fs.readFileSync(args.native)),consumerHashes:Object.fromEntries(kernelNames.map(n=>['game/src/spots/'+n+'.js',hash(fs.readFileSync(new URL('../../game/src/spots/'+n+'.js',import.meta.url)))])),frame:{origin:native.origin,projection:native.projection},nativeInner:result.nativeInner,outerBox:result.box,outerBoundaryVertices:[...unique.values()],drySegments:segments,waterRecords:state.water.records.map(r=>({id:r.id,poly:r.poly,holes:r.holes||[],y:r.y,sourceIds:r.sourceIds||[],heightBasis:r.heightBasis,estimated:r.estimated})),waterUnknown:state.water.unknown};
const F=raw.frame,tx=(F.origin.lon-native.origin.lon)*native.projection.mLon,tz=(native.origin.lat-F.origin.lat)*native.projection.mLat,sx=native.projection.mLon/F.projection.mLon,sz=native.projection.mLat/F.projection.mLat;
const coastBox={x0:-6000*sx+tx,z0:-5400*sz+tz,x1:6000*sx+tx,z1:5400*sz+tz},coast=sourceCoastWater(data.coastlines,coastBox);
if(coast.unresolved.length||!coast.polygons.length)throw Error('Original OSM coastline does not close the reviewed regional priority frame');
out.regionalOSMCoastFrame=coastBox;out.regionalOSMWaterRecords=[...coast.polygons.map((r,i)=>({...r,id:'regional-osm-coast-'+i,holes:coast.holes.filter(h=>inPoly(...h.poly[0],r.poly)).map(h=>h.poly),y:1-native.origin.elev,estimated:true,heightBasis:'Original OSM directed coast; existing 1m mean-sea estimate; tide/datum unmeasured'})),...out.waterRecords.filter(r=>!r.id.startsWith('coast-frame-')&&!r.id.startsWith('regional:'))];
fs.writeFileSync(args.output,JSON.stringify(out)+'\n');console.log(JSON.stringify({id:native.id,boundaryVertices:unique.size,segments:segments.length,waterRecords:out.waterRecords.length,output:args.output}));
