// Native overview delivery/interaction checks; external aerial pixels are a cache fixture.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'/tmp/overview-current-check');
const load=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const publicDir=path.join(root,'game/overview'),inventory=load(path.join(publicDir,'inventory.json'));
const catalog=load(path.join(publicDir,'comparison-data/catalog.json'));
const result={sourceInventory:inventory.sourceSha,scope:'Actual published local game images and UI; official aerial response intercepted for cache tests only. No visual parity or physical-phone claim.',districts:[],landmarks:[],spots:[],errors:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');}catch{res.writeHead(404).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
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
  const images=new Map();
  function checkImage(file,hash){const bytes=fs.readFileSync(file);assert.equal(sha(bytes),hash,file);images.set('/'+path.relative(root,file).split(path.sep).join('/'),true);}
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
   for(const c of collections)for(const i of c.data.items){checkImage(path.resolve(path.dirname(c.file),i.image),i.sha256);checkImage(path.resolve(path.dirname(c.file),i.thumbnail),i.thumbnailSha256);}
   if(m.historicalCollections?.length)await page.locator('[data-cv="collection"]').selectOption('survey');
   const context=page.locator('#perspective-viewer > div > div > details');
   await page.waitForFunction(id=>document.querySelector('#perspective-viewer select')?.value===id,place.id);
   const expectedContexts=(m.perspectiveCollections||[]).filter(c=>c.captureType==='game-perspective-context'&&c.comparisonCompatible===false).length+(m.streetWalk?.manifest==='street-walk/manifest.json'?1:0);
   await page.waitForFunction(n=>document.querySelectorAll('#perspective-viewer > div > div > details').length===n,expectedContexts);
   const n=await context.count(),counts=[];
   for(let i=0;i<n;i++){
    const d=context.nth(i);await d.locator('summary').first().click();await d.locator('figure').first().waitFor();
    let more=d.getByRole('button',{name:'Show next 24 captures',exact:true});
    while(await more.count())await more.click();
    const num=await d.locator('figure').count();assert(num>0);counts.push(num);
    const first=d.locator('figure img').first();await first.evaluate(async i=>{await i.decode();if(!i.naturalWidth)throw Error('Undecoded perspective capture');});
    assert.equal(await d.locator('figure').first().locator('summary').textContent(),'Camera, conditions and exercise coverage');
    await d.locator('summary').first().click();
   }
   result.districts.push({id:place.id,current:m.items.length,historical:collections.slice(1).map(c=>c.data.items.length),contextCounts:counts});
  }
  for(const kind of ['landmark','spot'])for(const entry of inventory[kind==='spot'?'spots':'landmarks']){
   const record=load(path.join(publicDir,entry.evidence)),selector=`#${kind}-evidence-viewer`;
   await page.locator(selector+' select').selectOption(entry.id);
   await page.waitForFunction(([selector,id])=>document.querySelector(selector+' article .eyebrow')?.textContent.startsWith(id+' ·'),[selector,entry.id]);
   const collections=[record,...(record.historicalCollections||[])];
   const expected=collections.reduce((n,c)=>n+(c.captures||[]).length,0);
   assert.equal(await page.locator(selector+' .lm-captures figure > a > img').count(),expected);
   await page.locator(selector+' .lm-captures figure > a > img').evaluateAll(async imgs=>{for(const i of imgs){i.loading='eager';await i.decode();if(!i.naturalWidth)throw Error('Undecoded dedicated evidence');}});
   for(const c of collections)for(const i of c.captures||[])checkImage(path.resolve(publicDir,i.image),i.sha256);
   const native=(record.nativeProofs||[]).length;
   if(native)assert.equal(await page.locator(selector+' article').getByText('Native activity and access evidence',{exact:true}).count(),1);
   result[kind==='spot'?'spots':'landmarks'].push({id:entry.id,current:record.captures.length,historical:expected-record.captures.length,nativeReports:native});
  }
  const urls=[...images.keys()];
  // Decode every distinct current/historical game image without retaining GPU bitmaps.
  for(let i=0;i<urls.length;i+=24)await page.evaluate(async paths=>{await Promise.all(paths.map(async path=>{const r=await fetch(path);if(!r.ok)throw Error(path+':'+r.status);const b=await createImageBitmap(await r.blob());if(!b.width||!b.height)throw Error('Empty image:'+path);b.close();}));},urls.slice(i,i+24));
  result.uniqueGameImagesDecoded=urls.length;
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
