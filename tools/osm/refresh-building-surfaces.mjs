#!/usr/bin/env node
// Targeted prepared-data cache refresh. Source arrays, dimensions, dates and
// unrelated data fields remain byte-equivalent as JSON values.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assemblySignature, geometryRing } from '../../game/src/building-parts.js';
import { validRoofProfile } from '../../game/src/building-roofs.js';
import { buildSourceSurfaceCache } from '../../game/src/building-surface-cache.js';

export function preparedSurfaceBodies(data) {
    const delta = (row, off = 0) => { let x=0,z=0; const ring=[]; for(let j=off;j<row.length;j+=2){x+=row[j];z+=row[j+1];ring.push([x/(data.q||10),z/(data.q||10)]);}return ring; };
    const physical = data.buildings.map((row,i) => {
        const h=data.buildingDimensions?.[i]?.[0]??row[1]/10,minH=data.buildingDimensions?.[i]?.[1]??row[2]/10;
        const roofProfile=validRoofProfile(data.buildingRoofProfiles?.[i],h,minH)?data.buildingRoofProfiles[i]:null;
        return {i,sourceId:data.buildingIds?.[i],ring:data.buildingFootprints?.[i]||delta(row,(data.version||1)>=2?9:6),holes:data.buildingHoleFootprints?.[i]||(data.buildingHoles?.[i]||[]).map(h=>delta(h)),h:roofProfile?.eavesM??h,minH,roofProfile,heightSourceCode:data.buildingInfo?.[i*5+4],canopy:data.buildingCanopies?.[i],aircraft:data.buildingAircraft?.[i],passages:data.buildingPassages?.[i]};
    });
    const canonical=ring=>{const rows=ring.map(p=>p.map(v=>Math.round(v*1e4)).join(',')),forms=[];for(const order of [rows,[...rows].reverse()])for(let i=0;i<order.length;i++)forms.push(order.slice(i).concat(order.slice(0,i)).join(';'));return forms.sort()[0];};
    const footprint=b=>canonical(b.ring)+'|'+b.holes.map(canonical).sort().join('|');
    for(const [key,index]of Object.entries(data.buildingCoveredBy||{})) {
        const base=physical[+key],part=physical[index];
        if(!base||!part||part.minH>0||part.h<base.h||footprint(base)!==footprint(part))throw Error('Stale buildingCoveredBy '+key);
        base.suppressed=true;
    }
    for(const [key,spec]of Object.entries(data.buildingAssemblies||{})) {
        const base=physical[+key],parts=spec.parts.map(i=>physical[i]);
        if(!base||parts.some(p=>!p)||spec.geometry?.signature!==assemblySignature(base,parts))throw Error('Stale buildingAssemblies '+key+'; regenerate assembly before visibility');
        base.suppressed=spec.mode==='parts';
        for(const r of spec.geometry.residuals)physical.push({...base,suppressed:false,i:physical.length,ring:geometryRing(r.ring,data.buildingGeometryPoints),holes:[],h:r.h,minH:0,roofProfile:null});
    }
    return physical;
}

export function refreshBuildingSurfaces(data) {
    const cache=buildSourceSurfaceCache(preparedSurfaceBodies(data));
    // Preserve old point indices used by assemblies; reuse every exact point.
    const points=(data.buildingGeometryPoints||[]).map(p=>[...p]),lookup=new Map(points.map((p,i)=>[p.join(','),i]));
    const pack=ring=>ring.map(p=>{const key=p.join(',');if(!lookup.has(key)){lookup.set(key,points.length);points.push(p);}return lookup.get(key);});
    for(const {surface}of cache.surfaces){surface.roof=surface.roof.map(pack);surface.underside=surface.underside.map(pack);}
    return {...data,buildingUnions:cache,buildingGeometryPoints:points};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const args=Object.fromEntries(process.argv.slice(2).map((a,i,x)=>a.startsWith('--')?[a.slice(2),x[i+1]]:[]).filter(p=>p.length));
    if(!args.in||!args.out||args.in===args.out)throw Error('Use --in prepared.json --out NEW.json');
    const original=JSON.parse(fs.readFileSync(args.in,'utf8')),result=refreshBuildingSurfaces(original);
    fs.writeFileSync(args.out,JSON.stringify(result));
    console.log(JSON.stringify({sourceRecords:original.buildings.length,version:result.buildingUnions.version,sources:result.buildingUnions.sources.length,surfaces:result.buildingUnions.surfaces.length,changedFields:['buildingUnions','buildingGeometryPoints'],output:args.out}));
}
