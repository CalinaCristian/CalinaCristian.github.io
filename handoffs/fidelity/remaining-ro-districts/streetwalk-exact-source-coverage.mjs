import fs from 'node:fs';
import {footprintMargin} from '/workspace/fidelity-workers/remaining-ro-districts/tools/osm/geom.mjs';
for(const district of ['unirii','otopeni']){
 const root='/workspace/reality-pass/remaining-ro',p=`${root}/${district}/full-source-streetwalk-4198996`,d=JSON.parse(fs.readFileSync(`${root}/source-4198996/game/data/bucharest-${district}.json`)),b=JSON.parse(fs.readFileSync(`${root}/${district}/atlas-4198996/boundary-source.json`)),s=JSON.parse(fs.readFileSync(p+'/source-candidates.json')),keys=new Set(s.map(v=>v.sourceGroup+':'+v.sourcePiece)),missing=[],outside=[];
 let checked=0,represented=0;
 for(const[group,source,access]of[['core',d.roadSourceGeometry,d.roadAccess],['nearby',d.scenerySourceGeometry,d.sceneryAccess]])for(const[index,row]of Object.entries(source)){
  if(!access[index]?.publicDrive||row.tags?.tunnel&&row.tags.tunnel!=='no')continue;checked++;
  if(keys.has(group+':'+index)){represented++;continue;}
  const pts=row.prepared||row.projected;let min=Infinity;
  for(let j=1;j<pts.length;j++) min=Math.min(min,footprintMargin([pts[j-1],pts[j]],b.analyticCore));
  const item={sourceWay:row.sourceId,sourcePiece:index,sourceGroup:group,name:row.tags?.name||'',exactCentrelineMinMarginM:min};
  if(min>600+1e-7) outside.push(item); else missing.push(item);
 }
 const report={district,sourceCommit:'4198996ab142e3496c9224478eb8cd1aced676fb',method:'Exact closed segment distance to analytic buffered source lines, circles and source polygons; no metre sampling, centroid or bounding circle.',scope:'Outdoor public motorcar source centrelines intersecting core + 600 m; source tunnels/restricted access explicit in source-plan exclusions. Full road pieces retained; camera samples every 50 m plus a boundary/short-piece control.',checkedPublicPieces:checked,representedSourcePieces:represented,fullyOutside600m:outside.length,unsampledIntersectingPieces:missing,outside};
 fs.writeFileSync(p+'/exact-sampling-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,outside:undefined}));
}
