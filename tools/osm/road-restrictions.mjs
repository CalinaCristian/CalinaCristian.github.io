// Literal source metadata only. Interpretation belongs to the motor-mode reader.
import { createHash } from 'node:crypto';
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const canon=value=>Array.isArray(value)?value.map(canon):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canon(value[k])])):value;
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const require=(ok,message)=>{if(!ok)throw Error('road restriction source: '+message);};

export function snapshotRoadRestrictionSources(osm) {
    return { nodeIds:new Set(osm.nodes.keys()), ways:new Map([...osm.ways].map(([id,w])=>[id,{nodes:[...w.nodes],tags:{...w.tags}}])),
        relations:[...osm.rels].filter(([,r])=>r.tags?.type==='restriction').map(([id,r])=>({sourceId:'r'+id,tags:{...r.tags},members:r.members.map(m=>({...m}))})),
        rawCounts:{nodes:osm.nodes.size,ways:osm.ways.size,relations:osm.rels.size} };
}

export function roadRestrictionCatalogue(data, snapshot, sourceFiles, districtId=data.district?.id) {
    require(Array.isArray(sourceFiles)&&sourceFiles.length&&sourceFiles.every(f=>typeof f.file==='string'&&/^[a-f0-9]{64}$/.test(f.sha256)), 'missing immutable tile ledger');
    require(data.roadSourceGeometry&&Array.isArray(data.roadNodeIds), 'original core source identity unavailable');
    const sources=Object.values(data.roadSourceGeometry), ways=new Set(sources.map(s=>s.sourceId)), nodes=new Set(data.roadNodeIds.filter(n=>Number.isSafeInteger(n)&&n>0));
    const missingWays=[...ways].filter(id=>!/^w[1-9]\d*$/.test(id)||!snapshot.ways.has(+id.slice(1)));
    const missingNodes=[...nodes].filter(id=>!snapshot.nodeIds.has(id));
    const mismatches=sources.filter(s=>{const w=snapshot.ways.get(+s.sourceId.slice(1));return w&&(!same(w.nodes,s.nodeIds)||!same(w.tags,s.tags));}).map(s=>s.sourceId);
    require(!missingWays.length&&!missingNodes.length&&!mismatches.length, 'core source mismatch '+JSON.stringify({missingWays,missingNodes,mismatches:[...new Set(mismatches)]}));
    const relations=snapshot.relations.filter(r=>r.members.some(m=>m.type==='way'&&ways.has('w'+m.ref)||m.type==='node'&&nodes.has(m.ref)))
        .sort((a,b)=>+a.sourceId.slice(1)-b.sourceId.slice(1)).map(r=>({sourceId:r.sourceId,tags:{...r.tags},members:r.members.map(m=>({...m}))}));
    const exceptions=[];
    for(const r of relations){
        const reasons=[],from=r.members.filter(m=>m.role==='from'),to=r.members.filter(m=>m.role==='to'),via=r.members.filter(m=>m.role==='via');
        for(const [role,list,type]of[['from',from,'way'],['to',to,'way'],['via',via,'node']]){
            if(!list.length)reasons.push('missing-'+role);
            if(list.length>1)reasons.push('multiple-'+role);
            if(list.some(m=>m.type!==type))reasons.push(role==='via'&&list.some(m=>m.type==='way')?'via-way':'non-'+type+'-'+role);
        }
        if(Object.keys(r.tags).some(k=>/^restriction(?::.*)?:conditional$/.test(k)))reasons.push('conditional');
        if(!Object.keys(r.tags).some(k=>k==='restriction'||k.startsWith('restriction:')))reasons.push('missing-restriction-kind');
        if(reasons.length)exceptions.push({sourceId:r.sourceId,reasons});
    }
    const modeTagCounts={},exceptValues={};
    for(const r of relations){for(const k of Object.keys(r.tags))if(k==='restriction'||k.startsWith('restriction:'))modeTagCounts[k]=(modeTagCounts[k]||0)+1;if(r.tags.except)(exceptValues[r.tags.except]||=[]).push(r.sourceId);}
    return {roadRestrictions:relations,roadRestrictionCoverage:{schema:1,districtId,
        scope:'All raw type=restriction records in these cached OSM tiles touching a retained core source way or positive prepared source node. Includes mode-only, except, conditional, malformed and via-way records unchanged; no permissions inferred. Not a catalogue for any other district or uncached source.',
        sourceFiles:sourceFiles.map(f=>({...f})),coreSourceSetSha256:sha({ways:[...ways].sort(),nodes:[...nodes].sort((a,b)=>a-b)}),
        counts:{...snapshot.rawCounts,rawRestrictionRelations:snapshot.relations.length,coreSourceWays:ways.size,coreSourceNodes:nodes.size,retainedRestrictionRelations:relations.length},
        missingCoreWays:[],missingCoreNodes:[],coreSourceMismatches:[],modeTagCounts,exceptValues,exceptions}};
}
