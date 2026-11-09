'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'game/overview/inventory.json')));
const result={sourceCommit:process.argv[4],toolSha256:sha(fs.readFileSync(__filename)),scope:'Read-only diagnosis after failed unchanged overview harness; external aerial responses mocked; no live provider proof.',errors:[],consoleErrors:[],states:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');}catch{res.writeHead(404).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:900}});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
  await page.route(/https:\/\/.*(?:arcgisonline|arcgis)\.com\//,r=>r.fulfill({contentType:'image/png',body:png,headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/game/overview/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#spot-evidence-viewer select option').length===24);
  await page.locator('[data-cv="location"]').selectOption('bellevue');
  await page.waitForFunction(()=>document.querySelector('#perspective-viewer select')?.value==='bellevue');
  await page.locator('[data-cv="scopes"] [data-scope="all"]').click();
  for(const [kind,entries]of [['landmark',inventory.landmarks],['spot',inventory.spots]]){
   const id=entries.at(-1).id;await page.locator(`#${kind}-evidence-viewer select`).selectOption(id);
   await page.waitForFunction(([kind,id])=>document.querySelector(`#${kind}-evidence-viewer article .eyebrow`)?.textContent.startsWith(id+' ·'),[kind,id]);
  }
  await page.setViewportSize({width:390,height:844});
  async function inspect(label){
   result.states.push(await page.evaluate(label=>({label,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollX,scrollY,overflow:[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,className:typeof e.className==='string'?e.className:'',text:e.textContent?.trim().slice(0,280),left:r.left,right:r.right,width:r.width,height:r.height,display:s.display,visibility:s.visibility,whiteSpace:s.whiteSpace,overflowWrap:s.overflowWrap,wordBreak:s.wordBreak,overflowX:s.overflowX,minWidth:s.minWidth};}).filter(e=>e.width>0&&e.height>0&&(e.right>innerWidth+1||e.left< -1)).sort((a,b)=>b.right-a.right).slice(0,60)}),label));
  }
  await page.locator('#spot-evidence').scrollIntoViewIfNeeded();await inspect('exact-last-selector-mobile');await page.screenshot({path:path.join(out,'mobile-last-selector.png')});
  await page.locator('#comparisons').scrollIntoViewIfNeeded();await inspect('comparison-mobile');await page.screenshot({path:path.join(out,'mobile-comparison.png')});
  await page.evaluate(()=>window.scrollTo(0,0));await inspect('top-mobile');await page.screenshot({path:path.join(out,'mobile-top.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({states:result.states.map(s=>({label:s.label,scrollWidth:s.scrollWidth,largest:s.overflow[0]})),errors:result.errors,consoleErrors:result.consoleErrors}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{result.failure=e.stack||e.message;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.error(e);server.close();process.exitCode=1;});
