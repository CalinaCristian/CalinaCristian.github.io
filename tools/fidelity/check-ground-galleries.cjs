// Delivery/UI audit of all four conditions, all selected visits and all districts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'/tmp/ground-gallery-check'),base=path.join(root,'game/overview'),read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={started:new Date().toISOString(),scope:'Local original-asset delivery, metadata and actual desktop/mobile overview interactions. Official aerial responses are intercepted only to isolate this gallery test. No game route, visual parity or physical-phone claim.',checks:[],errors:[]};fs.mkdirSync(out,{recursive:true});
const conditionIds=['summer-day','summer-night','winter-day','winter-night'],files=new Map();
function audit(gallery,dir,id){
 assert.deepEqual(gallery.conditionSets.map(s=>s.id),conditionIds);const ref=gallery.conditionSets[0].captures;assert(ref.length>=4);
 for(const set of gallery.conditionSets){assert.deepEqual(set.captures.map(c=>c.id),ref.map(c=>c.id));for(const [i,c]of set.captures.entries()){
  const file=path.resolve(dir,c.image);assert(file.startsWith(base+path.sep));assert.equal(hash(fs.readFileSync(file)),c.sha256);assert.equal(c.cameraBodyClear,true);assert(Math.abs(c.pose.heightAboveSupport-1.65)<.04);assert.equal(c.condition.quality,'high');assert.equal(c.condition.season,set.season);assert.equal(c.condition.weather.kind,set.weather);assert(set.period==='night'?c.condition.sunElevation< -3:c.condition.sunElevation>3);
  for(const key of ['x','z','floor','bearing','pitch','fov'])assert(Math.abs(c.pose[key]-ref[i].pose[key])<.05,id+': camera mismatch');assert(/^[a-f0-9]{40}$/.test(c.sourceCommit));assert(Number.isFinite(Date.parse(c.capturedAt)));files.set('/'+path.relative(root,file).split(path.sep).join('/'),c.sha256);
 }}
 return gallery.conditionSets.reduce((n,s)=>n+s.captures.length,0);
}
const inventory=read(path.join(base,'inventory.json')),visits=inventory.spots.filter(s=>s.menuAvailable),catalog=read(path.join(base,'comparison-data/catalog.json')).locations;
assert.equal(visits.length,7);assert.equal(catalog.length,8);
for(const visit of visits){const record=read(path.join(base,visit.evidence));audit(record.visitorGallery,base,visit.id);}
for(const district of catalog){const manifest=path.join(base,'comparison-data',district.manifest),record=read(manifest),file=path.resolve(path.dirname(manifest),record.groundConditions.manifest);audit(read(file),path.dirname(file),district.id);}
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();if(req.url.split('?')[0].endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,b)=>{if(e){result.errors.push({http:404,url:req.url});return res.writeHead(404).end();}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--mute-audio','--no-sandbox']});
try{for(const viewport of[{width:1440,height:1000},{width:390,height:844}]){
 const page=await browser.newPage({viewport});page.on('pageerror',e=>result.errors.push({page:String(e)}));await page.route(/arcgisonline\.com/,r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/game/overview/',{waitUntil:'networkidle'});
 async function inspect(host,id,gallery){
  const panel=host.locator('.condition-gallery');await panel.locator('[role=tab]').first().waitFor();assert.equal(await panel.locator('[role=tab]').count(),4);
  for(let i=0;i<4;i++){
   await panel.locator('[role=tab]').nth(i).click();assert.equal(await panel.locator('[role=tab][aria-selected=true]').count(),1);assert.equal(await panel.locator('[role=tab][aria-selected=true]').textContent(),gallery.conditionSets[i].label);
   const imgs=panel.locator('.condition-grid img');assert.equal(await imgs.count(),gallery.conditionSets[i].captures.length);
   await imgs.evaluateAll(async imgs=>{for(const img of imgs){img.loading='eager';await img.decode();if(img.naturalWidth!==1280||img.naturalHeight!==800)throw Error('Unexpected image dimensions');if(img.parentElement.href!==img.src)throw Error('Original link mismatch');}});
   assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Gallery horizontal overflow:'+id);
   result.checks.push({id,viewport:viewport.width,condition:conditionIds[i],decoded:await imgs.count()});
  }
  await panel.locator('[role=tab]').last().focus();await page.keyboard.press('ArrowRight');assert.equal(await panel.locator('[role=tab]').first().getAttribute('aria-selected'),'true');
  if(id==='old-town-lipscani'||id==='bellevue')await panel.screenshot({path:path.join(out,id+'-'+viewport.width+'.png')});
 }
 for(const v of visits){const host=page.locator('#spot-evidence-viewer');await host.locator('.ep-trigger').click();await host.locator('[data-value="'+v.id+'"]').click();await page.waitForFunction(id=>document.querySelector('#spot-evidence-viewer article')?.dataset.evidenceId===id,v.id);await inspect(host,v.id,read(path.join(base,v.evidence)).visitorGallery);}
 for(const d of catalog){const host=page.locator('#perspective-viewer'),record=read(path.join(base,'comparison-data',d.manifest)),file=path.join(base,'comparison-data',path.dirname(d.manifest),record.groundConditions.manifest);await host.locator('select').selectOption(d.id);await page.waitForFunction(id=>document.querySelector('#perspective-viewer select')?.value===id,d.id);await inspect(host,d.id,read(file));}
 // Decode the exact selected files and verify the actual HTTP response bytes.
 if(viewport.width===1440)for(const[url,expected]of files){const response=await page.request.get('http://127.0.0.1:'+server.address().port+url);assert(response.ok(),url);assert.equal(hash(await response.body()),expected,url);}
 await page.close();
 }assert.equal(result.errors.length,0);result.complete=true;result.images=files.size;result.finished=new Date().toISOString();
}finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');}console.log(JSON.stringify({complete:result.complete,checks:result.checks.length,images:result.images,errors:result.errors}));})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
