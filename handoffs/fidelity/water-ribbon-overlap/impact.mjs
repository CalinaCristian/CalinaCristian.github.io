// Conservative ground-square recapture mask for removed estimated water ribbons.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { uncoveredWaterLine } from '../../../game/src/water-lines.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(new URL('../../../'+p,import.meta.url)));
const decode=ring=>{let x=0,z=0;const out=[];for(let i=0;i<ring.length;i+=2){x+=ring[i];z+=ring[i+1];out.push([x/10,z/10]);}return out;};
const catalog=read('game/overview/comparison-data/catalog.json'),districts=[];
for(const place of catalog.locations){
 const city=['seatac','bellevue'].includes(place.id)?'seattle':'bucharest',dataPath=`game/data/${city}-${place.id}.json`,data=read(dataPath);
 const areas=data.areas.flatMap((a,i)=>data.areaKinds[a[0]]==='water'?[{outer:decode(a[2]),holes:a.slice(3).map(decode),sourceId:data.areaSourceIds?.[i]}]:[]);
 const boxes=[],lines=[];
 for(const [index,line]of data.lines.entries()){
  if(['runway','taxiway'].includes(data.lineKinds[line[0]]))continue;
  const source=data.lineSources?.[index],points=source?.points||decode(line[3]),width=source?.widthM||line[1]/10;
  let length=0,covered=0,unverified=0;
  for(let i=1;i<points.length;i++){
   const selection=uncoveredWaterLine(points[i-1],points[i],areas);length+=selection.length;covered+=selection.coveredLength;
   const spans=selection.covered.slice();
   if(selection.covered.length&&source?.widthSource?.startsWith('estimate:')){spans.push(...selection.outside);unverified+=selection.outside.reduce((s,v)=>s+v.length,0);}
   for(const span of spans){const pad=width/2+10;boxes.push([Math.min(span.a[0],span.b[0])-pad,Math.min(span.a[1],span.b[1])-pad,Math.max(span.a[0],span.b[0])+pad,Math.max(span.a[1],span.b[1])+pad]);}
  }
  if(covered)lines.push({index,sourceId:source?.sourceId||`prepared-line:${index}`,lengthM:length,coveredM:covered,unverifiedBoundaryM:unverified});
 }
 const manifest=read('game/overview/comparison-data/'+place.manifest);
 const tiles=manifest.items.filter(item=>{
  let bounds=item.boundsXZ;
  if(!bounds){const p=data.proj,x=item.x??(item.lon-p.lon0)*p.mPerLon*p.scale,z=item.z??-(item.lat-p.lat0)*p.mPerLat*p.scale,s=item.size||250;bounds=[x-s/2,z-s/2,x+s/2,z+s/2];}
  return boxes.some(b=>bounds[0]<=b[2]&&bounds[2]>=b[0]&&bounds[1]<=b[3]&&bounds[3]>=b[1]);
 }).map(item=>item.id);
 districts.push({id:place.id,dataPath,lines,conservativeChangedBounds:boxes,recaptureTiles:tiles});
}
const result={schemaVersion:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),method:'Exact source centreline/polygon intersections; removed-width bounds plus10m for depressed-water projection/quantization. Source data is read only; this is a conservative mask, not a new capture or acceptance result.',districts};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(districts.map(d=>({id:d.id,changedLines:d.lines.length,tiles:d.recaptureTiles.length})),null,2));
