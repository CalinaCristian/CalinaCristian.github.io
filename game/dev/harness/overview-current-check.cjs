// Native overview delivery/interaction checks; external aerial pixels are a cache fixture.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'/tmp/overview-current-check');
const load=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const publicDir=path.join(root,'game/overview'),inventory=load(path.join(publicDir,'inventory.json'));
const catalog=load(path.join(publicDir,'comparison-data/catalog.json'));
const result={toolSha256:sha(fs.readFileSync(__filename)),snapshotRoot:root,snapshotSourceCommit:process.argv[4]||null,sourceInventory:inventory.sourceSha,scope:'Actual published local game images and UI; official aerial response intercepted for cache tests only. No visual parity or physical-phone claim.',districts:[],landmarks:[],spots:[],errors:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');}catch{res.writeHead(404).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
function retakeAliases(manifest,file){
 const byId=new Map();for(const item of manifest.items){assert(item.id&&!byId.has(item.id),'Missing/repeated retake ID:'+file);byId.set(item.id,item);}
 const groups=new Set(),aliases=[];
 for(const item of manifest.items){
  assert.equal(item.gameSourceCommit,manifest.gameSourceCommit,'Retake source differs from collection:'+item.id);
  if(!item.duplicateOf){groups.add(item.id);continue;}
  const original=byId.get(item.duplicateOf);assert(original&&original!==item,'Missing/self retake alias:'+item.id);
  assert.match(item.imageSha256||'',/^[a-f0-9]{64}$/);assert.match(item.gameSourceCommit||'',/^[a-f0-9]{40}$/);
  assert.equal(item.imageSha256,original.imageSha256,'Alias pixels differ:'+item.id);
  assert(Number.isFinite(Date.parse(item.capturedAt)),'Alias capture date missing:'+item.id);
  assert.equal(item.capturedAt,original.capturedAt,'Alias dates differ:'+item.id);
  assert.equal(item.gameSourceCommit,original.gameSourceCommit,'Alias sources differ:'+item.id);
  for(const key of ['lat','lon','x','z','cameraBaseY','cameraY','pitch','fov','h','sourceRoadId','sourceLayer','cameraSourceEdge'])assert.deepEqual(item[key],original[key],'Alias camera differs:'+key+':'+item.id);
  const heading=v=>Number.isFinite(v)?((v%360)+360)%360:v;assert.equal(heading(item.heading),heading(original.heading),'Alias heading differs:'+item.id);
  groups.add(original.id);aliases.push({id:item.id,duplicateOf:original.id,imageSha256:item.imageSha256});
 }
 return{rawRequests:manifest.items.length,displayedPictures:groups.size,aliases};
}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:900}});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>result.errors.push(e.message));
  result.consoleErrors=[];page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}`;let cacheRequests=0;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
  await page.route(/https:\/\/.*(?:arcgisonline|arcgis)\.com\//,r=>{if(new URL(r.request().url()).searchParams.get('size')==='1,1')cacheRequests++;return r.fulfill({contentType:'image/png',body:png,headers:{'Access-Control-Allow-Origin':'*'}});});
  await page.goto(base+'/game/overview/',{waitUntil:'domcontentloaded'});
  try { await page.waitForFunction(()=>[...document.querySelectorAll('[data-cv="location"] option')].filter(o=>o.value).length===8&&document.querySelectorAll('#spot-evidence-viewer select option').length===24); } catch(e) { result.initial=await page.evaluate(()=>({locations:document.querySelectorAll('[data-cv="location"] option').length,spots:document.querySelectorAll('#spot-evidence-viewer select option').length,body:document.body.innerText.slice(-7000)}));await page.screenshot({path:path.join(out,'initial-failure.png')});throw e; }
  assert.equal(await page.locator('#district-comparison-cards article').count(),8);
  const images=new Map(),reports=new Map(),retakeDelivery=new Map();result.retakes=[];
  result.legacyHashGaps=[];
  function checkImage(file,hash,historical=false){const bytes=fs.readFileSync(file),actual=sha(bytes),url='/'+path.relative(root,file).split(path.sep).join('/');if(hash)assert.equal(actual,hash,file);else{assert(historical,'Current image hash missing:'+file);result.legacyHashGaps.push({path:url,observedSha256:actual,note:'Original historical ledger did not record this image hash. Bytes are decoded and retained from the immutable archived tree; historical metadata is unchanged.'});}images.set(url,true);return{url,sha256:actual};}
  function retakeFile(file,expected){const bytes=fs.readFileSync(file),actual=sha(bytes),url='/'+path.relative(root,file).split(path.sep).join('/');if(expected)assert.equal(actual,expected,'Retake file hash:'+file);retakeDelivery.set(url,actual);return bytes;}
  for(const place of catalog.locations){
   const file=path.join(publicDir,'comparison-data',place.manifest),m=load(file),dir=path.dirname(file);
   await page.locator('[data-cv="location"]').selectOption(place.id);
   await page.waitForFunction(id=>document.querySelector('[data-cv="location"]')?.value===id&&document.querySelector('[data-cv="collection"]')?.value==='survey',place.id);
   await page.locator('[data-cv="scopes"] [data-scope="all"]').click();
   assert.equal(await page.locator('[data-cv="thumbnails"] [data-id]').count(),m.items.filter(i=>i.dataset!=='published').length);
   await page.locator('[data-cv="game-image"]').evaluate(async i=>{await i.decode();if(!i.naturalWidth)throw Error('Undecoded current image');});
   const collections=[{file,data:m}];
   for(const h of m.historicalCollections||[]){
    const hf=path.join(dir,h.manifest),hm=load(hf);collections.push({file:hf,data:hm});
    const value='archive:'+h.manifest;assert.equal(await page.locator(`[data-cv="collection"] option[value="${value}"]`).isDisabled(),false);
    await page.locator('[data-cv="collection"]').selectOption(value);
    assert.equal(await page.locator('[data-cv="thumbnails"] [data-id]').count(),hm.items.length);
    await page.locator('[data-cv="game-image"]').evaluate(async i=>{await i.decode();if(!i.naturalWidth)throw Error('Undecoded archived image');});
   }
   for(const [j,c]of collections.entries())for(const i of c.data.items){checkImage(path.resolve(path.dirname(c.file),i.image),i.sha256,j>0);checkImage(path.resolve(path.dirname(c.file),i.thumbnail),i.thumbnailSha256,j>0);}
   if(m.historicalCollections?.length)await page.locator('[data-cv="collection"]').selectOption('survey');
   const context=page.locator('#perspective-viewer > div > div > details');
   await page.waitForFunction(id=>document.querySelector('#perspective-viewer select')?.value===id,place.id);
   const contextRefs=(m.perspectiveCollections||[]).filter(c=>c.captureType==='game-perspective-context'&&c.comparisonCompatible===false).map(c=>({...c,retake:false}));
   if(m.streetWalk?.manifest==='street-walk/manifest.json'){
    contextRefs.unshift({manifest:m.streetWalk.manifest,retake:false});
    const retakes=m.streetWalk.retakes||[];
    for(const entry of [...retakes].reverse()){assert.match(entry.manifest||'',/^street-walk\/retakes\/[a-zA-Z0-9_-]+\/manifest\.json$/,'Invalid public retake manifest');contextRefs.unshift({...entry,retake:true});}
   }
   for(const ref of contextRefs){
    const cf=path.resolve(dir,ref.manifest),cd=path.dirname(cf),cm=load(cf);ref.data=cm;
    if(ref.retake){
     assert.equal(cm.referenceImageryTracked,false,'Retake must remain game-only');assert.match(cm.gameSourceCommit||'',/^[a-f0-9]{40}$/);assert.equal(ref.gameSourceCommit,cm.gameSourceCommit,'Retake registry source differs');
     ref.aliasAudit=retakeAliases(cm,cf);retakeFile(cf);
     for(const key of ['captureLedger','sourceProvenance'])if(cm[key]){
      assert.equal(typeof cm[key],'string');const file=path.resolve(cd,cm[key]);assert(file.startsWith(cd+path.sep),'Retake metadata escapes collection:'+cm[key]);
      const record=JSON.parse(retakeFile(file,cm[key+'Sha256']));assert.equal(record.sourceCommit,cm.gameSourceCommit,'Retake metadata source differs:'+file);
      if(key==='captureLedger'){assert.deepEqual(record.items.map(item=>item.id).sort(),cm.items.map(item=>item.id).sort(),'Raw retake requests lost');for(const item of cm.items){const raw=record.items.find(r=>r.id===item.id);assert.equal(raw.imageSha256,item.imageSha256);assert.equal(raw.capturedAt,item.capturedAt);assert.equal(raw.duplicateOf,item.duplicateOf);}}
     }
     const issues=ref.captureIssues||cm.captureIssues||[];if(/known-issue/.test(ref.status||cm.collectionStatus||'')){assert(issues.length,'Known-issue retake lacks issue metadata');for(const issue of issues){assert(issue.description&&issue.poseIds?.length);assert(issue.poseIds.every(id=>cm.items.some(item=>item.id===id)),'Issue references missing retake pose');}}
     result.retakes.push({district:place.id,manifest:ref.manifest,sourceCommit:cm.gameSourceCommit,status:ref.status||cm.collectionStatus,...ref.aliasAudit});
    }
    for(const item of cm.items)for(const [key,hash]of [['image',item.sha256||item.imageSha256],['thumbnail',item.thumbnailSha256]]){if(!item[key])continue;const file=path.resolve(cd,item[key]);assert(file.startsWith(cd+path.sep),'Context asset escapes collection:'+item[key]);const checked=checkImage(file,hash);if(ref.retake)retakeDelivery.set(checked.url,checked.sha256);}
   }
   const expectedContexts=contextRefs.length;
   await page.waitForFunction(n=>document.querySelectorAll('#perspective-viewer > div > div > details').length===n,expectedContexts);
   const n=await context.count(),counts=[];
   for(let i=0;i<n;i++){
    const d=context.nth(i);await d.locator('summary').first().click();await d.locator('figure').first().waitFor();
    let more=d.getByRole('button',{name:'Show next 24 captures',exact:true});
    while(await more.count())await more.click();
    const num=await d.locator('figure').count();assert(num>0);counts.push(num);const ref=contextRefs[i];
    if(ref.retake){assert.equal(num,ref.aliasAudit.displayedPictures,'Retake alias display count');const records=await d.locator('figure pre').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.textContent)));assert.deepEqual(records.flatMap(r=>r.recordedRequests||[]).sort(),ref.data.items.map(item=>item.id).sort(),'UI lost raw retake request aliases');for(const issue of ref.captureIssues||ref.data.captureIssues||[])assert(await d.locator('figure').getByText(issue.description,{exact:true}).count()>0,'Known issue not displayed');}
    const first=d.locator('figure img').first();await first.evaluate(async i=>{await i.decode();if(!i.naturalWidth)throw Error('Undecoded perspective capture');});
    assert(['Camera and capture details','Camera, conditions and exercise coverage'].includes(await d.locator('figure').first().locator('summary').textContent()),'Capture metadata details missing');
    await d.locator('summary').first().click();
   }
   result.districts.push({id:place.id,current:m.items.length,historical:collections.slice(1).map(c=>c.data.items.length),contextCounts:counts});
  }
  for(const kind of ['landmark','spot'])for(const entry of inventory[kind==='spot'?'spots':'landmarks']){
   const record=load(path.join(publicDir,entry.evidence)),selector=`#${kind}-evidence-viewer`;
   await page.locator(selector+' select').selectOption(entry.id);
   await page.waitForFunction(([selector,id])=>document.querySelector(selector+' article')?.dataset.evidenceId===id,[selector,entry.id]);
   const collections=[record,...(record.historicalCollections||[])];
   const expected=collections.reduce((n,c)=>n+(c.captures||[]).length,0);
   assert.equal(await page.locator(selector+' .lm-captures figure > a > img').count(),expected);
   const primaryVisitor=record.visitorGallery?.captures||[],retainedVisitor=record.visitorGallery?.retainedIllustrations||[],visitor=[...primaryVisitor,...retainedVisitor];
   assert.equal(await page.locator(selector+' .visit-primary figure > a > img').count(),primaryVisitor.length);
   assert.equal(await page.locator(selector+' .visit-retained figure > a > img').count(),retainedVisitor.length);
   if(visitor.length){assert.equal(kind,'spot');assert.equal(await page.locator(selector+' .visit-validation:not([open])').count(),1);assert.equal(await page.locator(selector+' .visit-preview .notice').getByText('Staging game preview.',{exact:true}).count(),1);}
   await page.locator(selector+' .lm-captures figure > a > img,'+selector+' .visit-gallery figure > a > img').evaluateAll(async imgs=>{for(const i of imgs){i.loading='eager';await i.decode();if(!i.naturalWidth)throw Error('Undecoded dedicated evidence');if(i.parentElement.getAttribute('href')!==i.getAttribute('src'))throw Error('Image link differs from image');}});
   for(const c of collections)for(const i of c.captures||[])checkImage(path.resolve(publicDir,i.image),i.sha256);
   for(const i of visitor)checkImage(path.resolve(publicDir,i.image),i.sha256);
   for(const proof of [...(record.nativeProofs||[]),...(record.visitorGallery?.reports||[]),...(record.visitorGallery?.report?[{report:record.visitorGallery.report,sha256:record.visitorGallery.reportSha256}]:[])]){const file=path.resolve(publicDir,proof.report),bytes=fs.readFileSync(file);assert.equal(sha(bytes),proof.sha256,'Native/capture report hash:'+file);JSON.parse(bytes);reports.set('/'+path.relative(root,file).split(path.sep).join('/'),true);assert.equal(await page.locator(selector+' a[href="'+proof.report+'"]').count(),1);}
   const native=(record.nativeProofs||[]).length;
   if(native)assert.equal(await page.locator(selector+' article').getByText('Native activity and access evidence',{exact:true}).count(),1);
   assert.equal(new URL(page.url()).searchParams.get(kind),entry.id);assert.equal(new URL(page.url()).hash,'#'+kind+'-evidence');
   result[kind==='spot'?'spots':'landmarks'].push({id:entry.id,visitor:primaryVisitor.length,retainedVisitor:retainedVisitor.length,current:record.captures.length,historical:expected-record.captures.length,nativeReports:native});
  }
  const urls=[...images.keys()];
  // Decode every distinct current/historical game image without retaining GPU bitmaps.
  for(let i=0;i<urls.length;i+=24)await page.evaluate(async paths=>{await Promise.all(paths.map(async path=>{const r=await fetch(path);if(!r.ok)throw Error(path+':'+r.status);const b=await createImageBitmap(await r.blob());if(!b.width||!b.height)throw Error('Empty image:'+path);b.close();}));},urls.slice(i,i+24));
  result.uniqueGameImagesDecoded=urls.length;
  for(const [url,hash]of retakeDelivery){const response=await page.request.get(base+url);assert.equal(response.status(),200,'Retake asset unavailable:'+url);const bytes=await response.body();assert.equal(sha(bytes),hash,'Retake HTTP bytes differ:'+url);if(url.endsWith('.json'))JSON.parse(bytes);}result.retakeHTTPAssetsChecked=retakeDelivery.size;
  for(const url of reports.keys()){const response=await page.request.get(base+url);assert.equal(response.status(),200,'Native report unavailable:'+url);await response.json();}result.uniqueEvidenceReportsChecked=reports.size;
  await page.locator('#comparisons').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'overview-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#spot-evidence').scrollIntoViewIfNeeded();
  result.mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,selectHeights:[...document.querySelectorAll('#spot-evidence-viewer select,#landmark-evidence-viewer select')].map(e=>e.getBoundingClientRect().height)}));
  assert(result.mobile.scrollWidth<=391);assert(result.mobile.selectHeights.every(h=>h>=44));await page.screenshot({path:path.join(out,'overview-mobile.png')});
  const url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=1,2,3,4&bboxSR=3857&imageSR=3857&size=1,1&format=png&f=image';
  const cacheGet=async()=>page.evaluate(async url=>{const {createAerialCache}=await import('./comparison-viewer.js');const c=createAerialCache();try{await c.get(url);}finally{c.dispose();}},url);
  await cacheGet();assert.equal(cacheRequests,1);
  await page.addInitScript(()=>{const now=Date.now.bind(Date);Date.now=()=>now()+Number(sessionStorage.getItem('cache-proof-offset')||0);});
  for(const [minutes,requests]of [[10,1],[16,2]]){await page.evaluate(m=>sessionStorage.setItem('cache-proof-offset',String(m*60000)),minutes);await page.reload({waitUntil:'domcontentloaded'});await cacheGet();assert.equal(cacheRequests,requests);}
  result.cache={reloadAt10MinutesReused:true,reloadAt16MinutesRefetched:true,fixture:true};assert.deepEqual(result.errors,[]);
  result.complete=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,districts:result.districts.length,landmarks:result.landmarks.length,spots:result.spots.length,decoded:urls.length,errors:result.errors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{result.complete=false;result.failure=e.stack||e.message;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.error(e);server.close();process.exitCode=1;});
