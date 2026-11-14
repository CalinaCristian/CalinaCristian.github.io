import {sourceVehicleDimensions} from './source-vehicle-dimensions.js';
import {motorRestrictionMode} from './motor-turn-restrictions.js';

const cache = new WeakMap();
const MODES = {motorcar:['motorcar','motor_vehicle','vehicle'],taxi:['taxi','psv','motorcar','motor_vehicle','vehicle'],bus:['bus','psv','motor_vehicle','vehicle'],hgv:['hgv','goods','motor_vehicle','vehicle'],goods:['goods','motor_vehicle','vehicle'],motorcycle:['motorcycle','motor_vehicle','vehicle'],motor_vehicle:['motor_vehicle','vehicle']};
/** OSM bare numeric clearance is metres. Never turn default, signed=no,
 * condition text, ranges or a source layer into a numeric clearance. */
function parseSourceClearance(raw) {
    const value = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim().toLowerCase();
    if (value === 'none') return {known:true,unbounded:true,raw};
    if (/^[0-9]+(?:\.[0-9]+)?\s*(?:m|metres?|meters?)?$/.test(value)) {
        const metres = parseFloat(value); return Number.isFinite(metres) && metres > 0 ? {known:true,metres,raw,unit:'m'} : {known:false,reason:'nonpositive-or-nonfinite-clearance',raw};
    }
    const feet = value.replaceAll('′',"'").replaceAll('″','"').match(/^([0-9]+(?:\.[0-9]+)?)\s*'\s*(?:([0-9]+(?:\.[0-9]+)?)\s*")?$/);
    if (feet && Number(feet[2] || 0) < 12) {const metres=Number(feet[1])*.3048+Number(feet[2]||0)*.0254;return Number.isFinite(metres)&&metres>0?{known:true,metres,raw,unit:'ft-in'}:{known:false,reason:'nonpositive-or-nonfinite-clearance',raw};}
    return {known:false,reason:value==='default'?'jurisdiction-default-unresolved':'unsupported-or-conditional-clearance',raw};
}

export function roadClearancePolicy(data) {
    if (!data || typeof data !== 'object') return {byRoad:new Map(),report:{records:0,unresolved:[],scope:'no prepared source data'}};
    if (cache.has(data)) return cache.get(data);
    const byRoad = new Map(), unresolved = [];
    for (const [road,source] of Object.entries(data.roadSourceGeometry || {})) {
        const tags=source.tags||{},limits=Object.fromEntries(Object.entries(tags).filter(([k])=>k==='maxheight'||k==='maxwidth'||k.startsWith('maxheight:')||k.startsWith('maxwidth:')));
        if (!Object.keys(limits).length) continue;
        const parsed={};for(const[k,raw]of Object.entries(limits)){
            if(k.endsWith(':signed'))continue;
            const suffix=k.slice(k.startsWith('maxheight')?10:9),knownSelector=!suffix||suffix==='physical'||Object.values(MODES).some(m=>m.includes(suffix));
            parsed[k]=k.endsWith(':conditional')?{known:false,reason:'conditional-clearance-unresolved',raw}:!knownSelector?{known:false,reason:'unsupported-clearance-selector-unresolved',raw}:parseSourceClearance(raw);
            if(!parsed[k].known)unresolved.push({sourceId:source.sourceId,road:Number(road),key:k,...parsed[k]});
        }
        byRoad.set(Number(road),{sourceId:source.sourceId,tags:limits,parsed});
    }
    const policy={byRoad,report:{records:byRoad.size,sourceWays:new Set([...byRoad.values()].map(r=>r.sourceId)).size,finiteRules:[...byRoad.values()].reduce((sum,r)=>sum+Object.values(r.parsed).filter(p=>p.known&&Number.isFinite(p.metres)).length,0),unresolved,scope:'Literal prepared source-way dimension tags only. Missing/node-mounted signs and physical world clearance are separate.'}};cache.set(data,policy);return policy;
}

export function assessRoadClearance(policy, edge, dimensions, {mode='motorcar'} = {}) {
    const record=policy?.byRoad?.get(edge?.road);
    if(!record)return{eligible:true,known:true,reason:'no-literal-way-dimension-rule',scope:'No real-world sign-completeness claim'};
    const actual=edge?.access?.sourceId||edge?.sourceId;
    if(!actual||actual!==record.sourceId)return{eligible:null,known:false,reason:'source-way-identity-unresolved',sourceId:record.sourceId};
    const checks=[],unknown=[],chain=MODES[mode]||MODES.motor_vehicle;
    for(const[base,dimension]of [['maxheight','height'],['maxwidth','width']]){
        const selected=chain.map(m=>base+':'+m).find(k=>Object.hasOwn(record.parsed,k))||base;
        for(const key of [selected,base+':physical']){
            const limit=record.parsed[key];if(!limit)continue;
            if(!limit.known){unknown.push({key,...limit});continue;}
            if(limit.unbounded){checks.push({key,unbounded:true,passed:true});continue;}
            if(!dimensions?.known||!Number.isFinite(dimensions[dimension])){unknown.push({key,reason:'actual-emitted-model-dimension-unavailable',requiredDimension:dimension,limitM:limit.metres});continue;}
            checks.push({key,dimension,limitM:limit.metres,actualM:dimensions[dimension],passed:dimensions[dimension]<=limit.metres+1e-7});
        }
        for(const[key,limit]of Object.entries(record.parsed))if(key.startsWith(base+':')&&key.endsWith(':conditional'))unknown.push({key,...limit});
        for(const[key,limit]of Object.entries(record.parsed))if(key.startsWith(base+':')&&limit.reason==='unsupported-clearance-selector-unresolved')unknown.push({key,...limit});
    }
    const failed=checks.filter(c=>!c.passed),missingDimension=unknown.some(u=>u.reason==='actual-emitted-model-dimension-unavailable');
    return{eligible:failed.length?false:missingDimension?null:true,known:unknown.length===0,sourceId:record.sourceId,checks,unknown,reason:failed.length?'source-vehicle-dimension-exceeded':missingDimension?'unknown-actual-vehicle-dimension':unknown.length?'literal-clearance-unresolved':'literal-source-dimensions-compatible'};
}

/** Unknown default/conditional values retain legacy access but never count as a
 * measured pass. A finite sign with unknown actual model dimensions is blocked. */
export function sourceRoadClearance(data, edge, actor, {dimensions,mode=motorRestrictionMode(actor)}={}) {
    if(edge?.rail||actor?.tram)return{eligible:true,known:true,reason:'separate-rail-source-clearance-scope'};
    const policy=roadClearancePolicy(data);
    if(!policy.byRoad.has(edge?.road))return{eligible:true,known:true,reason:'no-literal-way-dimension-rule'};
    return assessRoadClearance(policy,edge,dimensions||sourceVehicleDimensions(actor),{mode});
}
