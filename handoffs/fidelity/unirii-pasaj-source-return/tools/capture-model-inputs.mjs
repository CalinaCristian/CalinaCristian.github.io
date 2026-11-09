// Stop an isolated copy of the actual compiler at its raw-building checkpoint.
// No dataset is serialized; no producer source file is edited.
import fs from 'node:fs';import path from 'node:path';import {spawnSync}from'node:child_process';import{createHash}from'node:crypto';
const[root,tiles,cache,out]=process.argv.slice(2);if(!out)throw Error('ROOT TILES CACHE OUT required');fs.mkdirSync(out,{recursive:false});
const source=fs.readFileSync(path.join(root,'tools/osm/build-data.mjs'),'utf8'),marker="    log('raw buildings', rawBuildings.length);";
if(source.split(marker).length!==2)throw Error('unique raw-building checkpoint required');
const target=path.resolve(out,'model-inputs.json'),probe=source.replace(marker,marker+`\n    fs.writeFileSync(${JSON.stringify(target)}, JSON.stringify(rawBuildings.filter(b=>sourceContextReview?.inferredBuildingModels?.some(r=>r.sourceId===b.t.__id)).map(b=>({sourceId:b.t.__id,tags:b.t,sourceRingLL:b.lls,sourceHolesLL:b.holesLL||[]})),null,2)); process.exit(0);\n`);
const tmp=path.resolve(root,`tools/osm/.context-input-probe-${process.pid}.mjs`),sha=b=>createHash('sha256').update(b).digest('hex');
try{fs.writeFileSync(tmp,probe,{flag:'wx'});fs.writeFileSync(path.join(out,'executed-probe.mjs'),probe);
 const args=[tmp,'--tiles',path.resolve(tiles),'--cache',path.resolve(cache),'--city','bucharest','--district','unirii'];
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});fs.writeFileSync(path.join(out,'probe.log'),r.stdout+r.stderr);
 if(r.status!==0)throw Error('input-stage compiler failed '+r.status);
 const report={scope:'Actual compiler input-stage checkpoint only; no dataset write, geometry/cache bake, source-change or native acceptance.',sourceCompilerSHA256:sha(source),executedProbeSHA256:sha(probe),modelInputsSHA256:sha(fs.readFileSync(target)),command:[process.execPath,...args],exitCode:r.status};
 fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
