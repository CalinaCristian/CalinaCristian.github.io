import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCoveredRoadModels } from '../src/covered-road-models.js';
import { buildSourceCanopyRoadModels } from '../src/source-canopy-road-models.js';
const baseline=JSON.parse(fs.readFileSync(new URL('../data/bucharest-unirii.json',import.meta.url)));
const clone=()=>structuredClone(baseline), rec=d=>d.reviewedCoveredRoads.find(r=>r.classification==='reviewed-source-fuel-canopy-covered-road');
// Source expansion can reorder packed rows; keep these checks on their literal source owners.
const road=id=>{const rows=Object.entries(baseline.roadSourceGeometry).filter(([,s])=>s.sourceId===id);assert.equal(rows.length,1,id+' unique prepared road');return +rows[0][0];};
const covered=road('w79870041'),otherCovered=road('w982816382'),groundJoin=road('w1478497247'),canopy=baseline.buildingIds.indexOf('w670595374');
assert(canopy>=0);assert.equal(baseline.buildingIds.lastIndexOf('w670595374'),canopy);
let checks=0;
function reject(label,mutate){const d=clone();mutate(d,rec(d));const result=buildSourceCanopyRoadModels(d);assert.equal(result.accepted.length,0,label);assert.equal(result.unresolved.length,1,label);checks++;}
const before=JSON.stringify(baseline),nativeRandom=Math.random;Math.random=()=>{throw Error('RNG consumed');};
let result;
try {result=buildCoveredRoadModels(baseline);} finally {Math.random=nativeRandom;}
assert.equal(JSON.stringify(baseline),before);assert.equal(result.report.unresolved.length,0);assert.equal(result.accepted.length,1);assert.equal(result.isCovered({road:covered}),true);assert.equal(result.accepted[0].clearanceM,4.56);assert.equal(result.accepted[0].legalMaxheightM,4.25);assert.equal(result.passages.size,0);assert.equal(result.accepted[0].profileOnly,true);checks++;
// True underground source ways and all their exact source flags/dimensions remain outside this finite cover rule.
for(const sourceId of ['w241368617','w241368618','w1383050305'])assert.equal(result.isCovered({road:road(sourceId)}),false);checks++;
reject('no anonymous layer exception',(d,r)=>{delete r.sourceXmlSha256;});
reject('changed mapped roof footprint',(d,r)=>{d.buildingFootprints[canopy][0][0]+=.01;});
reject('unknown canopy classification',(d)=>{delete d.buildingCanopies[canopy];});
reject('roof lowered into legal opening',(d)=>{d.buildings[canopy][2]=440;d.buildingCanopies[canopy].clearanceM=4.4;});
reject('actual canopy dimensions disagree with declaration',(d)=>{d.buildings[canopy][2]=470;});
reject('missing original ground join',(d,r)=>{r.groundJoins[1].ways.pop();});
reject('wrong literal source node',(d,r)=>{r.groundJoins[0].anchorNodeId++;});
reject('source station/shape changed',(d)=>{d.roadSourceGeometry[covered].projected[1][0]+=.01;});
reject('source not completely under roof',(d,r)=>{d.roadSourceGeometry[covered].projected[1][0]+=20;r.sourceWays[0].projected[1][0]+=20;});
reject('source roof has courtyard over road',(d)=>{d.buildingHoleFootprints ||= {};d.buildingHoleFootprints[canopy]=[[[150,-223],[156,-223],[156,-219],[150,-219]]];});
reject('literal inclined cover cannot be flattened',(d,r)=>{d.roadSourceGeometry[covered].tags.incline='up';r.sourceWays[0].tags.incline='up';});
reject('explicit underground location remains underground',(d,r)=>{d.roadSourceGeometry[covered].tags.location='underground';r.sourceWays[0].tags.location='underground';});
reject('unknown canopy road metric datum',(d,r)=>{d.roadSourceGeometry[covered].tags.ele='72';r.sourceWays[0].tags.ele='72';});
reject('source node underground datum cannot be erased',(d,r)=>{r.sourceWays[0].nodeTags['6260825651']={layer:'-1'};});
reject('reviewed ground chain itself inclined',(d,r)=>{const s=r.sourceWays.find(s=>s.sourceId==='w1478497247');s.tags.incline='up';d.roadSourceGeometry[groundJoin].tags.incline='up';});
reject('canopy underground story is contradictory',(d,r)=>{r.sourceCanopy.tags['building:levels:underground']='1';});
// A profile-only cover still passes through the existing source-anchor profile validator.
const model=result.accepted[0],edges=[{road:covered,virtual:false,ya:0,yb:0,a:{sourceId:6260825651,y:0},b:{sourceId:13563618634,y:0}},{road:otherCovered,virtual:false,ya:0,yb:0,a:{sourceId:9088160162,y:0},b:{sourceId:9088160161,y:0}}];
assert.equal(result.validateProfile(edges),true);assert.equal(result.useNativeRibbons([]),true);assert.equal(result.passages.size,0);edges[0].yb=-.1;assert.equal(result.validateProfile(edges),false);checks++;
console.log(JSON.stringify({passed:true,checks,sourceRoad:model.sourceRoadId,sourceCanopy:model.sourceCanopyId,wholeSourceCoveredM:model.coveredM,sourceLengthM:model.lengthM,physicalOpeningM:model.clearanceM,legalMaxheightM:model.legalMaxheightM,roofAndSourceUnchanged:true,rngDraws:0}));
