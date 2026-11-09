import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {roadClearancePolicy,assessRoadClearance} from '../../../game/src/source-road-clearance.js';
import {sourceVehicleDimensions} from '../../../game/src/source-vehicle-dimensions.js';
import {makeVehicle} from '../../../game/src/vehicles.js';

const fixture=fs.readFileSync(new URL('./literal-road-limits.json',import.meta.url)),inventory=JSON.parse(fixture);
const noop=()=>{},gradient={addColorStop:noop},oldDocument=globalThis.document;
// Only the unmodified model factory's canvas paint API is stubbed in this CPU
// check. Neither the output nor the geometry is a browser/visual claim.
globalThis.document={createElement(type){assert.equal(type,'canvas');const c={width:0,height:0,style:{}};const ctx=new Proxy({canvas:c,measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});c.getContext=()=>ctx;return c;}};
let models;
try{
    models=[['hatch','bucharest'],['taxi','bucharest'],['van','bucharest'],['truck','bucharest'],['stb-bus','bucharest'],['trolleybus','bucharest'],['kcm-bus','seattle']].map(([kind,city])=>{
        const actor={kind,bus:/bus/.test(kind),trolley:kind==='trolleybus',mesh:makeVehicle(kind,undefined,{instanced:true,city})},dimensions=sourceVehicleDimensions(actor);
        assert.equal(dimensions.known,true,kind);return{kind,city,dimensions,declaredModelHeight:actor.mesh.userData.height};
    });
}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
const sourceWays=inventory.districts.reduce((s,d)=>s+d.sourceWayRecords.length,0);assert.equal(sourceWays,79);
const districts=inventory.districts.map(d=>{
    const roadSourceGeometry={};for(const w of d.sourceWayRecords)for(const i of w.roadIndices)roadSourceGeometry[i]={sourceId:w.sourceId,tags:w.sourceTags};
    const data={roadSourceGeometry},before=JSON.stringify(data),policy=roadClearancePolicy(data);
    assert.equal(policy.report.records,Object.keys(roadSourceGeometry).length);
    const assessments=d.sourceWayRecords.map(w=>({sourceId:w.sourceId,literalLimits:w.literalLimits,models:models.map(m=>{
        const a=assessRoadClearance(policy,{road:w.roadIndices[0],access:{sourceId:w.sourceId}},m.dimensions,{mode:/bus/.test(m.kind)?'bus':'motorcar'});
        for(const c of a.checks||[])if(Number.isFinite(c.limitM))assert.equal(c.passed,c.actualM<=c.limitM+1e-7);
        if(w.literalLimits.maxheight==='default')assert.equal(a.known,false);
        return{kind:m.kind,eligible:a.eligible,known:a.known,checks:a.checks,unknown:a.unknown};
    })}));
    assert.equal(JSON.stringify(data),before);
    return{district:d.district,dataFile:d.dataFile,dataSha256:d.dataSha256,policy:policy.report,assessments};
});
const un=districts.find(d=>d.district==='unirii');
for(const id of ['w241368617','w241368618','w226274205','w1383050305'])assert.equal(un.assessments.find(w=>w.sourceId===id).models.find(m=>m.kind==='trolleybus').eligible,false,id);
const st=districts.find(d=>d.district==='seatac');assert(st.assessments.some(w=>w.literalLimits.maxheight==='6\'10"'));
console.log(JSON.stringify({passed:true,scope:'Read-only 79 literal retained source-way tag fixtures/all8 districts and actual production factory geometry; no native world/admission/publication or full road-sign completeness claim.',fixtureSha256:createHash('sha256').update(fixture).digest('hex'),sourceWays,models,districts},null,2));
