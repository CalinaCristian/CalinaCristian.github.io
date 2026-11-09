// Capture the real procedural models. These are isolated model studies; never a
// matched street-view/aerial comparison, and never a reference image publication.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const {execFileSync}=require('child_process');const {createHash}=require('crypto');
const get=(key,fallback)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.split('=').slice(1).join('=')||fallback;
(async()=>{const out=path.resolve(get('out','/tmp/us-landmark-captures')),base=get('base','http://127.0.0.1:8160'),sourceCommit=get('source-commit','');fs.mkdirSync(out,{recursive:true});
if(!/^[0-9a-f]{40}$/.test(sourceCommit))throw new Error('--source-commit requires a complete git SHA');
const inputHashes={};for(const file of ['game/src/landmarks.js','game/src/landmark-seatac-structure.js','game/src/landmark-seatac-aircraft.js','game/src/landmark-us-source.js','game/src/landmark-us-geometry.js','game/src/landmark-us-terrain.js','game/dev/landmarks.html']){
 const expected=execFileSync('git',['show',sourceCommit+':'+file],{maxBuffer:32*1024*1024});const response=await fetch(base+'/'+file);if(!response.ok)throw new Error('Missing capture input '+file);const served=Buffer.from(await response.arrayBuffer());
 if(!served.equals(expected))throw new Error('Capture server differs from source commit: '+file);inputHashes[file]=createHash('sha256').update(served).digest('hex');}
fs.writeFileSync(path.join(out,'input-manifest.json'),JSON.stringify({captureToolSha256:createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),sourceCommit,verifiedAt:new Date().toISOString(),inputHashes},null,2));
if(get('verify-only','0')==='1')return;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:640,height:640}});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/game/dev/landmarks.html?id=spaceneedle&clean=1');await page.waitForFunction(()=>window.__ready);const ids=await page.evaluate(()=>import('/game/src/landmarks.js').then(x=>x.LANDMARKS.filter(l=>l.city==='seattle').map(l=>l.id)));
const selected=get('ids','').split(',').filter(Boolean);
const front={greatwheel:-58,mtbaker:90,lincoln:270,onelincoln:270,lincolnsouth:270,sonic:270,bellevue600:90,seagarage:270,sealink:90,bellevuesq:90,rainier:180,olympics:90,murroww:90,murrowe:90};const records=[];
for(const id of ids.filter(id=>!selected.length||selected.includes(id)))for(const view of ['front','top','oblique']){
 const az=view==='front'?(front[id]??0):id==='greatwheel'?-25:id==='mtbaker'?110:35;
 const qs=new URLSearchParams({id,view:view==='top'?'top':'34',clean:'1',az:String(az),el:view==='front'?'0':'26'});
 if(id==='plazacenter'&&view==='front')qs.set('d','180');
 await page.goto(base+'/game/dev/landmarks.html?'+qs);await page.waitForFunction(()=>window.__ready);const stats=await page.evaluate(()=>window.__stats);const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});await page.locator('canvas').screenshot({path:path.join(dir,view+'.png')});
 records.push({id,view,image:id+'/'+view+'.png',sha256:createHash('sha256').update(fs.readFileSync(path.join(dir,view+'.png'))).digest('hex'),width:640,height:640,stats,sourceCommit,capturedAt:new Date().toISOString(),url:'/game/dev/landmarks.html?'+qs});console.log(id,view,stats.triangles,stats.drawCalls);
}
fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({sourceCommit,inputHashes,records,errors},null,2));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
