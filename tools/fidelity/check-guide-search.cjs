const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'/tmp/guide-search');fs.mkdirSync(out,{recursive:true});
const report={scope:'Actual local overview, desktop and phone search interactions. External aerial requests intercepted; no game renderer or hardware-FPS claim.',checks:[],errors:[]};
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://local').pathname;if(p.endsWith('/'))p+='index.html';const f=path.resolve(root,'.'+decodeURIComponent(p));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(error,b)=>{if(error)return res.writeHead(404).end();res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--mute-audio']});try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.route(/arcgisonline\.com|server\.arcgisonline\.com/,r=>r.abort());
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/game/overview/');await page.waitForFunction(()=>document.querySelectorAll('#landmark-table tbody tr').length===61);
  const original=await page.locator('#experience').textContent();await page.locator('.content details').evaluateAll(ds=>{window.__searchDetails=ds.map(node=>({node,open:node.open}));});
  await page.locator('#search').fill('traffic');await page.waitForFunction(()=>document.querySelectorAll('mark.guide-match').length>0);
  const hits=await page.locator('mark.guide-match').allTextContents();assert(hits.length>10);assert(hits.every(t=>t.toLowerCase()==='traffic'));assert((await page.locator('#search-status').textContent()).startsWith(hits.length+' highlighted matches'));
  await page.locator('#experience mark.guide-match').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'traffic-'+width+'.png')});
  await page.locator('#search').fill('romana');await page.waitForFunction(()=>[...document.querySelectorAll('mark.guide-match')].some(m=>m.textContent.includes('Romană')));assert(await page.locator('mark.guide-match').count()>0);
  await page.locator('#search').fill('traffic mirror');assert(await page.locator('mark.guide-match').count()>1);assert.equal(await page.locator('section.search-hidden mark.guide-match').count(),0);
  await page.locator('#search').fill('<script>');assert.equal(await page.locator('mark.guide-match').count(),0);assert.equal(await page.locator('#no-results').isVisible(),true);
  await page.locator('#clear-search').click();assert.equal(await page.locator('mark.guide-match').count(),0);assert.equal(await page.locator('#experience').textContent(),original);assert(await page.evaluate(()=>window.__searchDetails.filter(({node})=>node.isConnected).every(({node,open})=>node.open===open))); 
  await page.locator('#landmark-evidence-viewer .ep-trigger').click();assert.equal(await page.locator('#landmark-evidence-viewer .ep-panel').isVisible(),true);
  report.checks.push({width,matches:hits.length,accentInsensitive:true,multiTerm:true,literalQuerySafe:true,clearRestoresTextAndDetails:true,controlsRetained:true});
 }assert.equal(report.errors.length,0);report.complete=true;
}catch(error){report.failure=String(error.stack||error);throw error;}finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
