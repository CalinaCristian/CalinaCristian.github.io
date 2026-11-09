const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/4621127/fixture.json.gz'))));
const frames=new Map(fixture.globalPhysical.map(f=>[f.trafficFrame,f]));
const pair=f=>f?.vehicleBodyContacts[0],body=(p,id)=>[p.a,p.b].find(b=>b.id===id);
const contacts=fixture.globalPhysical.filter(f=>pair(f)),counts={accepted:0,reverted:0,corrected:0},examples={};
for(const step of fixture.observation.vehicleSteps){
    const p=pair(frames.get(step.step)),p0=pair(frames.get(step.step-1));if(!p||!p0)continue;
    const v=body(p,2),before=step.before,proposed=step.after,keys=['x','z','heading','s'];
    const eq=(a,b)=>keys.every(k=>Math.abs(a[k]-b[k])<1e-9);
    const type=eq(v,proposed)?'accepted':eq(v,before)&&!eq(before,proposed)?'reverted':'corrected';
    counts[type]++;if(!examples[type])examples[type]={trafficFrame:step.step,trafficTimeBefore:step.t,before,proposed,actual:v,estateBefore:body(p0,423),pairActualPenM:p.orientedXZPenetrationM};
}
const progress=[];
for(const [lo,hi]of[[5.9,10],[10,20],[20,30.267]]){
    const rows=contacts.filter(f=>f.trafficTime>=lo&&f.trafficTime<=hi),result={interval:[lo,hi],samples:rows.length,targets:[]};
    for(const id of[2,423]){const a=body(pair(rows[0]),id),b=body(pair(rows.at(-1)),id);result.targets.push({id,centerProgressM:Math.hypot(b.x-a.x,b.z-a.z),stationDeltaM:b.s-a.s});}progress.push(result);
}
const out={sourceCommit:fixture.sourceCommit,raw:fixture.raw,scope:'Read-only join by actual trafficFrame; proposed native stepVehicle vs final guards, not equivalent clocks or a simulated full-fleet acceptance.',
    pairContact:{samples:contacts.length,firstTime:contacts[0].trafficTime,lastTime:contacts.at(-1).trafficTime,minPenM:Math.min(...contacts.map(f=>pair(f).orientedXZPenetrationM)),maxPenM:Math.max(...contacts.map(f=>pair(f).orientedXZPenetrationM))},
    joinedSteps:counts,examples,progress,
    source:{way:'w153967352',sourceTurnLanes:fixture.worldData.roadSourceGeometry[33].tags['turn:lanes'],preparedTerminalNode:fixture.worldData.roads[33].at(-1),originalTerminalSourceNode:fixture.worldData.roadSourceGeometry[33].nodeIds.at(-1)},
    missingCaptureFields:['current odo','current lateralExtra/latExtraCur','423 proposed stepVehicle poses'],
    scopeLimits:['Positive contacts below .05m remain real contacts.','Only recorded2 proposed poses can be joined to post-guard poses.','No new browser or live/source mutation.']};
const dest=process.argv[2];if(dest){if(fs.existsSync(dest))throw Error('Output must be new');fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');}
console.log(JSON.stringify({pairContact:out.pairContact,joinedSteps:out.joinedSteps,source:out.source,progress},null,2));
