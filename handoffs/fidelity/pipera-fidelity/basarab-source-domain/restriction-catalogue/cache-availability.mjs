import fs from 'node:fs';
import path from 'node:path';
import {createHash}from 'node:crypto';
import {parseFiles}from '../../../../../tools/osm/parse-osm.mjs';
import {snapshotRoadRestrictionSources,roadRestrictionCatalogue}from '../../../../../tools/osm/road-restrictions.mjs';
const repo=process.argv[2]||process.cwd(),out=process.argv[3]||'/tmp/road-restriction-cache-availability.json';
const entries=[['bucharest-romana','/workspace/reality-pass/romana/tiles'],['bucharest-floreasca','/workspace/reality-pass/original-districts-refresh/tiles'],['bucharest-unirii','/workspace/reality-pass/remaining-ro/unirii/tiles'],['bucharest-otopeni','/workspace/reality-pass/remaining-ro/otopeni/tiles'],['bucharest-pipera','/workspace/reality-pass/pipera/tiles'],['seattle-seatac','/workspace/reality-pass/us-districts/tiles','sea_seatac_'],['seattle-bellevue','/workspace/reality-pass/us-districts/tiles','sea_bel_']];
const reports=[];
for(const[id,dir,prefix]of entries){
 const file=path.join(repo,'game/data',id+'.json'),bytes=fs.readFileSync(file),data=JSON.parse(bytes),files=fs.readdirSync(dir).filter(f=>f.endsWith('.xml')&&(!prefix||f.startsWith(prefix))).sort().map(f=>path.join(dir,f));
 const ledger=files.map(f=>({file:path.basename(f),sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex'),bytes:fs.statSync(f).size})),snapshot=snapshotRoadRestrictionSources(parseFiles(files));
 const r={district:id,dataSha256:createHash('sha256').update(bytes).digest('hex'),sourceDirectory:dir,files:ledger};
 try{const c=roadRestrictionCatalogue(data,snapshot,ledger,data.district?.id);r.coreSourcesExactlyAvailable=true;r.counts=c.roadRestrictionCoverage.counts;r.modeTagCounts=c.roadRestrictionCoverage.modeTagCounts;r.exceptValues=c.roadRestrictionCoverage.exceptValues;r.exceptions=c.roadRestrictionCoverage.exceptions;}catch(error){r.coreSourcesExactlyAvailable=false;r.error=error.message;}
 reports.push(r);console.log(id,r.coreSourcesExactlyAvailable,r.counts||r.error);
}
fs.writeFileSync(out,JSON.stringify({schema:1,scope:'Read-only cached-source availability for seven other districts at the recorded data hashes. No dataset was rebuilt or written, no runtime catalogue completeness/interpretation/native acceptance is claimed.',reports},null,2)+'\n');
