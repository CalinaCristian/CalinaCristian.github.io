import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inferredRoadSignUnit} from '../src/inferred-road-sign.js';
import {buildTramGrades} from '../src/tram-grade.js';
import {emittedTramClearance} from '../src/tram-clearance.js';
import {makeVehicle} from '../src/vehicles.js';
import {sidewalkWidth} from '../src/sidewalk-source.js';
import {MeshBuilder,rgb} from '../src/geobuild.js';
import {triangleContact} from './fixtures/tram490-contact-kernel.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/inferred-noentry-tram490-984.json',import.meta.url))),envelope=emittedTramClearance(makeVehicle,'bucharest'),source=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
let checks=0;const check=(yes,label)=>{assert.ok(yes,label);checks++;};
const actualData=JSON.stringify(fixture.data),actualGrades=()=>buildTramGrades(fixture.data,{models:[]});
const owner=fixture.sourceOwner,edge={...owner,dirx:owner.dirx,dirz:owner.dirz,nx:owner.nx,nz:owner.nz,sidewalk:owner.sidewalkScalar,sidewalkLeftM:0,sidewalkRightM:3.5,a:{...owner.a,edges:owner.a.edgeIds},b:{...owner.b,edges:owner.b.edgeIds}};
const signStart=source.indexOf('        const placeSign ='),signEnd=source.indexOf('        const speedIcon =',signStart),current=source.slice(signStart,signEnd);
const quadStart=source.indexOf('    function addSignQuad('),quadEnd=source.indexOf('\n    }',quadStart)+6,quad=source.slice(quadStart,quadEnd);
function emitter(code,grades=actualGrades()){
    const cell={solid:new MeshBuilder(true),signs:[]},colliders=[],audit={checked:0,refused:0,bySource:{},samples:[]},atlas=[];
    const signMB=(c,page)=>c.signs[page]||(c.signs[page]=new MeshBuilder()),addQuad=new Function('signMB',quad+';return addSignQuad;')(signMB);
    const args={sidewalkWidth,shoulderOf:()=>.15,onRibbon:()=>false,buildingAt:()=>false,signs:{icon(key){atlas.push(key);return{page:0,u0:0,v0:0,u1:1,v1:1};}},cellOf:()=>cell,yAlong:()=>0,raisedTop:(x,z)=>((x-edge.a.x)*edge.nx+(z-edge.a.z)*edge.nz)>0?.37:null,DY_SIDE:.13,data:{roadSourceGeometry:{[edge.road]:{sourceId:edge.sourceId}}},tramGrades:grades,tramPropEnvelope:envelope,inferredRoadSignUnit,signRailAudit:audit,addSignQuad:addQuad,addPropColl:(x,z,r,kind)=>colliders.push({x,z,r,kind,h:3}),rgb};
    const create=new Function(...Object.keys(args),'let signCount=0;'+code+';return{placeSign,count:()=>signCount};');
    return{...create(...Object.values(args)),cell,colliders,audit,atlas};
}
const icon={key:'noentry',draw(){}};
const before=emitter(fixture.baselinePlaceSign);check(before.placeSign(edge,owner.alongM,-1,1,icon),'the native original inferred left unit is emitted');
check(before.cell.solid.ic/3===12&&before.cell.signs[0].ic/3===4&&before.colliders.length===1,'whole original unit has12 post/4 plate triangles and one collider');
const tris=mb=>Array.from({length:mb.ic/3},(_,i)=>[0,1,2].map(j=>Array.from(mb.p.subarray(mb.i[i*3+j]*3,mb.i[i*3+j]*3+3))));
const post=tris(before.cell.solid),plate=tris(before.cell.signs[0]),native=fixture.sourceUnit.exactUnitTriangles;
const key=t=>t.map(v=>v.join(',')).sort().join('|');
assert.deepEqual(post.map(key).sort(),native.filter(t=>t.object.startsWith('solid')).map(t=>key(t.vertices)).sort());checks++;
assert.deepEqual(plate.map(key).sort(),native.filter(t=>t.object.startsWith('signs')).map(t=>key(t.vertices)).sort());checks++;
const floor=fixture.contacts[0].bodyVertices,contacts=post.flatMap((t,i)=>triangleContact(t,floor)?[i]:[]);check(contacts.length===8,'the exact native eight post/floor intersections reproduce independently');
const after=emitter(current);check(after.placeSign(edge,owner.alongM,-1,1,icon)===false,'actual known-source rail envelope rejects the complete inferred left unit');
check(after.cell.solid.ic===0&&after.cell.signs.length===0&&after.colliders.length===0&&after.atlas.length===0,'refusal occurs before atlas, geometry AND collider emission');
check(after.audit.refused===1&&after.audit.samples[0].sourceId==='w80013062'&&after.audit.samples[0].side===-1,'the exact source/side/icon/reason remains observable');
check(after.audit.samples[0].component==='post-and-collider-footprint','the actual native post contact is attributed to its complete unit');
check(JSON.stringify(fixture.data)===actualData,'all real source data remain exact');
const clearBefore=emitter(fixture.baselinePlaceSign),clearAfter=emitter(current);
check(clearBefore.placeSign(edge,owner.alongM,1,1,icon)&&clearAfter.placeSign(edge,owner.alongM,1,1,icon),'the clear source-right no-entry unit remains');
for(const k of ['p','n','u','c','t','i'])assert.deepEqual(clearAfter.cell.solid[k],clearBefore.cell.solid[k]);checks++;
assert.deepEqual(clearAfter.colliders,clearBefore.colliders);checks++;
assert.deepEqual(clearAfter.atlas,clearBefore.atlas);checks++;
for(const k of ['p','n','u','c','t','i'])assert.deepEqual(clearAfter.cell.signs[0][k],clearBefore.cell.signs[0][k]);checks++;
const legacy={...edge};delete legacy.sidewalkLeftM;delete legacy.sidewalkRightM;
const empty=()=>buildTramGrades({trams:[],tramSources:[],tramSourceWays:[]},{models:[]}),oldLegacy=emitter(fixture.baselinePlaceSign,empty()),newLegacy=emitter(current,empty());
check(oldLegacy.placeSign(legacy,owner.alongM,-1,1,icon)&&newLegacy.placeSign(legacy,owner.alongM,-1,1,icon),'legacy scalar fallback still emits the same nonrail unit');
assert.deepEqual(newLegacy.cell.solid.p,oldLegacy.cell.solid.p);assert.deepEqual(newLegacy.colliders,oldLegacy.colliders);checks++;

function gradeScene(height=0,unknown=false){
    const tags={railway:'tram',gauge:'1435',...(height||unknown?{bridge:'yes',layer:'1'}:{})},data={q:10,trams:[[-1000,0,2000,0]],tramSources:[{sourceId:'w1',nodeIds:[1,2]}],tramSourceWays:[{sourceId:'w1',nodeIds:[1,2],points:[-1000,0,2000,0],tags}]};
    const extraGrades=height&&!unknown?new Map([['w1:0',{known:true,ya:height,yb:height,deckHalfWidthM:1.7,thicknessM:.35,modelId:'control-only',basis:'explicit test model'}]]):null;
    return buildTramGrades(data,{models:[],extraGrades});
}
const run=(grades,changes={})=>inferredRoadSignUnit({grades,envelope,x:0,z:0,angle:0,baseY:.15,width:.75,height:.75,sourceId:'w9',...changes});
check(!run(gradeScene()).allowed,'known ground rail blocks an actual-height inferred unit');
check(run(gradeScene(7)).allowed,'an elevated source rail does not erase a ground sign');
check(!run(gradeScene(7),{baseY:7.15}).allowed,'the same elevated source rail excludes a height-compatible unit');
const unknown=gradeScene(0,true);check(unknown.corridors.length===0&&run(unknown).allowed,'unknown grade supplies no invented vertical conflict or clearance pass');
check(run(gradeScene(),{baseY:20}).allowed,'a truly clear vertical interval remains');
const front=run(gradeScene(),{z:1.5,angle:Math.PI/2});check(!front.allowed&&front.component==='front-plate','complete plate reach is tested even when post/collider footprint is clear');
const back=run(gradeScene(),{z:1.5,angle:Math.PI/4});check(!back.allowed&&back.component==='back-plate','the actual separate back plate cannot be omitted');
let queried=false;check(run({excludesInferredObstacle(){queried=true;return true;}},{inferred:false}).allowed&&!queried,'mapped hardware bypasses this inferred-only policy');
const random=Math.random;try{Math.random=()=>{throw Error('No geometry placement RNG');};check(!run(gradeScene()).allowed,'the source decision consumes no random draw');}finally{Math.random=random;}
console.log(JSON.stringify({passed:true,checks,sourceCommit:fixture.sourceCommit,actualNativeContactsBefore:8,emittedContactsAfter:0,actualRightUnitExact:true,legacyExact:true,scope:'Actual native Float32 source-unit reproduction and production placement/helper CPU controls; no fresh native World/constructor/drive/budget acceptance'}));
