'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'game/overview/inventory.json')));
const result={sourceCommit:process.argv[4],toolSha256:sha(fs.readFileSync(__filename)),scope:'Focused static-page layout check of every landmark/destination record at390px; external aerial response mocked; no live-provider, parity or physical-phone claim.',errors:[],consoleErrors:[],recordLayouts:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');}catch{res.writeHead(404).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
  await page.route(/https:\/\/.*(?:arcgisonline|arcgis)\.com\//,r=>r.fulfill({contentType:'image/png',body:png,headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/overview/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#spot-evidence-viewer select option').length===24);
  for(const [kind,entries]of [['landmark',inventory.landmarks],['spot',inventory.spots]])for(const {id}of entries){
   await page.locator(`#${kind}-evidence-viewer select`).selectOption(id);
   await page.waitForFunction(([kind,id])=>document.querySelector(`#${kind}-evidence-viewer article .eyebrow`)?.textContent.startsWith(id+' ·'),[kind,id]);
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,selectHeights:[...document.querySelectorAll('#spot-evidence-viewer select,#landmark-evidence-viewer select')].map(e=>e.getBoundingClientRect().height)}));
   result.recordLayouts.push({kind,id,...layout});assert(layout.scrollWidth<=390,`${kind}:${id} overflows to${layout.scrollWidth}`);assert(layout.selectHeights.every(h=>h>=44));
  }
  const note=page.locator('#landmark-evidence-viewer .lm-evidence li').filter({hasText:'The shared explicit-ID source-replacement implementation is integrated in production'}).first();
  await note.scrollIntoViewIfNeeded();result.fullRevisionRetained=(await note.textContent()).includes('2c73f3d986a4e52d85f5520ca6cb3d4b732f0d13');assert(result.fullRevisionRetained);
  result.note=await note.evaluate(e=>({text:e.textContent,overflowWrap:getComputedStyle(e).overflowWrap,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth}));
  await page.screenshot({path:path.join(out,'landmark-notes-mobile.png')});
  await page.locator('#spot-evidence').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'destination-mobile.png')});
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);result.complete=true;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,records:result.recordLayouts.length,maxScrollWidth:Math.max(...result.recordLayouts.map(r=>r.scrollWidth)),errors:result.errors,consoleErrors:result.consoleErrors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{result.complete=false;result.failure=e.stack||e.message;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.error(e);server.close();process.exitCode=1;});
