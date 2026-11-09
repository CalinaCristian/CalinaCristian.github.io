// Read-only retake mask from native rendered separator and structural bounds.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
const prefix='handoffs/fidelity/us-districts/seatac/structure-2b2b970/';
const changes=read(prefix+'all8-generated-separator-deltas.json'),models=read(prefix+'model-impact-bounds.json');
const catalog=read('game/overview/comparison-data/catalog.json'),districts=[];
for(const place of catalog.locations){
 const delta=changes.districts.find(d=>d.key.endsWith('-'+place.id));
 const boxes=[];
 for(const wall of [...(delta?.removedOrReplaced||[]),...(delta?.addedOrShortened||[])]){
  const b=wall.renderedBoundsXZ,y=wall.renderedYRange;
  const pad=Math.max(20,3*(y[1]-y[0])+5);
  boxes.push({kind:'generated-separator',sourceId:wall.sourceOwnership?.sourceId||wall.edge?.sourceId||wall.sourceId||wall.sourceRoadId||null,boundsXZ:[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad],paddingM:pad});
 }
 if(place.id==='seatac')for(const model of models.models){
  const b=model.conservativeChangedStructuralBoundsXZ,extent=model.wholeRenderedModelBounds;
  const pad=Math.max(80,3*(extent.max[1]-extent.min[1])+10);
  boxes.push({kind:'structural-model',id:model.id,boundsXZ:[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad],paddingM:pad});
 }
 const manifest=read('game/overview/comparison-data/'+place.manifest);
 const ids=manifest.items.filter(i=>{const b=i.boundsXZ;return b&&boxes.some(v=>{const x=v.boundsXZ;return b[0]<=x[2]&&b[2]>=x[0]&&b[1]<=x[3]&&b[3]>=x[1];});}).map(i=>i.id);
 districts.push({id:place.id,boxes,recaptureTiles:ids});
}
const result={schemaVersion:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),nativeDeltaSourceCommit:changes.currentSourceCommit,method:'Conservative bounds from actual changed rendered walls and two structural models, padded for noon shadows, perspective projection and rasterization. Wall minimum20m; model minimum80m. This selects retakes only, not source edits or parity acceptance.',districts};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(districts.map(d=>({id:d.id,changedBounds:d.boxes.length,retakes:d.recaptureTiles.length})),null,2));
