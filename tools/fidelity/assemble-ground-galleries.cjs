// Publish only original, complete matched sets; retain raw attempts outside the site.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),arg=k=>process.argv.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3),input=path.resolve(arg('input'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const ids=['summer-day','summer-night','winter-day','winter-night'];
const visits=['old-town-lipscani','cismigiu','arcul-de-triumf','space-needle','pike-place','bel-meydenbauer','bel-downtown-park'];
const districts=['grozavesti','unirii','romana','floreasca','pipera','otopeni','seatac','bellevue'];
const reports=(arg('reports')||'visits-v2,districts-final').split(',').map(dir=>({dir:path.join(input,dir),data:read(path.join(input,dir,'report.json'))}));
const selected=new Map();
for(const report of reports)for(const c of report.data.captures){const key=[c.kind,c.place,c.condition.id,c.id].join('/'),previous=selected.get(key);if(!previous||Date.parse(c.capturedAt)>Date.parse(previous.c.capturedAt))selected.set(key,{c,report});}
const counts=[];
for(const [kind,places] of [['visit',visits],['district',districts]])for(const place of places){
 const day=[...selected.values()].filter(({c})=>c.kind===kind&&c.place===place&&c.condition.id===ids[0]);
 assert(day.length>=4,place+': fewer than four views');
 const relative=kind==='visit'?`assets/spots/${place}/ground-4c57f810`:`comparison-data/${place}/context/ground-4c57f810`;
 const dest=path.join(root,'game/overview',relative),sources=new Set(),records=[];
 const conditionSets=ids.map(id=>({id,label:id.split('-').map(v=>v[0].toUpperCase()+v.slice(1)).join(' · '),season:id.split('-')[0],period:id.split('-')[1],weather:id.startsWith('winter')?'snow':'clear',hour:id.endsWith('night')?23:12,captures:day.map(({c:base})=>{
   const entry=selected.get([kind,place,id,base.id].join('/'));assert(entry,place+': missing '+id+'/'+base.id);const{c,report}=entry;
   assert(c.cameraBodyClear);assert(Math.abs(c.pose.heightAboveSupport-1.65)<.04);assert(c.condition.quality==='high');assert(id.endsWith('night')?c.condition.sunElevation< -3:c.condition.sunElevation>3);
   for(const field of ['x','z','floor','bearing','pitch','fov'])assert(Math.abs(c.pose[field]-base.pose[field])<.05,place+': unmatched '+field+' '+c.id);
   const bytes=fs.readFileSync(path.join(report.dir,c.file));assert.equal(sha(bytes),c.sha256);sources.add(c.sourceCommit);
   const target=path.join(dest,id,c.id+'.jpg');fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.linkSync(path.join(report.dir,c.file),target);else assert.equal(sha(fs.readFileSync(target)),c.sha256,'Old output needs a new directory: '+target);
   const capture={...c,image:kind==='visit'?`${relative}/${id}/${c.id}.jpg`:`${id}/${c.id}.jpg`};delete capture.file;records.push({...capture,observerSHA256:report.data.toolSHA256});return capture;
 })}));
 assert.equal(sources.size,1,place+': mixed game sources');
 const limitations=['Fixed on-foot appearance fixtures; cameras were positioned for inspection. These pictures do not establish a traversed route, activity completion, physical-phone behavior or hardware FPS.'];
 if(place==='old-town-lipscani')limitations.push('The shipped renderer currently draws some snow particles inside the bookshop and bars. This remains a rendering defect. The Hagi screen here is its idle game surface; video playback is not demonstrated.');
 if(place==='space-needle')limitations.push('The Loupe picture is taken on its modeled supporting floor, not a drone. It does not establish a completed elevator ride or an accurate distant Seattle skyline.');
 const gallery={schemaVersion:1,sourceCommit:[...sources][0],notice:`${day.length} matched walking-height viewpoints in each of four conditions, captured from the shipped game. Open any picture at its original size.`,setup:'Production app, scene, actors, lighting and renderer at High quality, 1280 × 800. Automatic animation was paused and explicit frames rendered at fixed on-foot cameras 1.65 m above their supporting surfaces. Local simulation dates and weather were controlled; capturedAt records the real capture time.',limitations,conditionSets};
 write(path.join(dest,'manifest.json'),{...gallery,captureScope:'appearance-only',captures:records});
 if(kind==='visit'){
  const recordPath=path.join(root,'game/overview/evidence/spots',place+'.json'),record=read(recordPath);
  record.visitorGallery={...gallery,captures:conditionSets[0].captures,report:relative+'/manifest.json',reportSha256:sha(fs.readFileSync(path.join(dest,'manifest.json')))};write(recordPath,record);
 }else{
  const recordPath=path.join(root,'game/overview/comparison-data',place,'manifest.json'),record=read(recordPath);
  record.groundConditions={manifest:'context/ground-4c57f810/manifest.json',gameSourceCommit:gallery.sourceCommit,conditionCount:4,viewpointCount:day.length};write(recordPath,record);
 }
 counts.push({kind,place,viewpoints:day.length,conditions:4,captures:records.length,source:gallery.sourceCommit});
}
write(path.join(input,'assembled.json'),{createdAt:new Date().toISOString(),counts,total:counts.reduce((n,c)=>n+c.captures,0)});console.log(JSON.stringify(counts));
