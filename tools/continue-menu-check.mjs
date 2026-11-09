// Actual main menu and SaveStore, frozen Git-served runtime. No world load or
// claim of restoring a physically driven session; the saved pose is a fixture.
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('../',import.meta.url).pathname),out=process.argv[2]||'/tmp/continue-menu-native';
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),cache=new Map(),served=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const server=createServer((req,res)=>{
    let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    if(file.endsWith('/'))file+='index.html';
    if(!file.startsWith('game/')||file.includes('..')){res.statusCode=404;res.end();return;}
    try{
        if(!cache.has(file)){
            const b=execFileSync('git',['show',`${source}:${file}`],{cwd:root,maxBuffer:32*1024*1024,stdio:['ignore','pipe','ignore']});
            cache.set(file,b);served.push({path:file,sha256:hash(b),bytes:b.length});
        }
        res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream');
        res.setHeader('cache-control','no-store');res.end(cache.get(file));
    }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,args:['--mute-audio']}),errors=[],checks=[],states=[];
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
try{
    const url=`http://127.0.0.1:${server.address().port}/game/`;
    const ready=async()=>{await page.waitForFunction(()=>window.game?.state==='menu');await page.evaluate(async()=>{const{save}=await import('/game/src/save.js');await save.ready;});};
    const state=async label=>{
        const v=await page.evaluate(async()=>{const{save}=await import('/game/src/save.js'),b=document.getElementById('continue'),r=b.getBoundingClientRect();return{hidden:b.hidden,display:getComputedStyle(b).display,hasSession:save.hasSession(),started:!!game.started,world:!!game.world,rect:{x:r.x,y:r.y,width:r.width,height:r.height},store:save.mode};});
        states.push({label,...v});return v;
    };
    await page.goto(url);await ready();
    for(const[width,height]of[[1280,720],[390,844]]){
        await page.setViewportSize({width,height});const v=await state(`fresh ${width}`);
        assert.equal(v.hasSession,false);assert.equal(v.started,false);assert.equal(v.hidden,true);assert.equal(v.display,'none');assert.equal(v.rect.height,0);assert.equal(v.world,false);
        checks.push(`Fresh actual menu hides Continue at ${width}x${height}`);
        await page.screenshot({path:path.join(out,`fresh-${width}.png`)});
    }
    await page.evaluate(async()=>{
        const{save}=await import('/game/src/save.js'),prior=save.game;
        try{save.game={started:true,state:'drive',world:{},player:{x:12,z:24,heading:0,surfY:.24},city:{id:'bucharest'},district:'romana',chapterIdx:0,chapter:'first',fuel:90,stats:{},visited:new Set()};if(!await save.saveSession('menu-availability-fixture'))throw Error('Save fixture failed');}
        finally{save.game=prior;}
    });
    await page.reload();await ready();
    for(const[width,height]of[[1280,720],[390,844]]){
        await page.setViewportSize({width,height});const v=await state(`valid fixture ${width}`);
        assert.equal(v.hasSession,true);assert.equal(v.hidden,false);assert.notEqual(v.display,'none');assert.ok(v.rect.height>=44);assert.equal(v.world,false);
        checks.push(`Persisted SaveStore session exposes actual Continue at ${width}x${height}`);
        await page.screenshot({path:path.join(out,`valid-${width}.png`)});
    }
    await page.evaluate(async()=>{const{save}=await import('/game/src/save.js');await save.clearSession();});
    await page.reload();await ready();const reset=await state('cleared');assert.equal(reset.hasSession,false);assert.equal(reset.hidden,true);assert.equal(reset.display,'none');
    checks.push('Clear session and reload hides Continue again');assert.deepEqual(errors,[]);
}finally{
    await browser.close();await new Promise(r=>server.close(r));
    const report={sourceCommit:source,executedToolSHA256:hash(await readFile(new URL(import.meta.url))),scope:'Actual fresh-context Main menu and persisted SaveStore fixture; no gameplay restoration or physical journey claim',passed:checks.length===5&&!errors.length,checks,states,errors,served};
    await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,sourceCommit:source,checks,errors,servedFiles:served.length}));
}
