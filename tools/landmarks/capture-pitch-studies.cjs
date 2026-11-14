// Only Dinamo's three isolated GAME studies, from an immutable source snapshot.
const fs=require('fs'),path=require('path'),http=require('http'),{createHash}=require('crypto'),{execFileSync}=require('child_process'),{chromium}=require('playwright');
const arg=k=>process.argv.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
const root=path.resolve(arg('root')),out=path.resolve(arg('out')),sourceCommit=arg('commit');
const hash=v=>createHash('sha256').update(v).digest('hex');
if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Complete source commit required');
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Preserve prior output');
const inputs={};
for(const file of ['game/dev/landmarks.html','game/src/landmarks.js','game/src/landmark-pitch-paint.js','game/src/landmark-pitch-paint-coverage.js','game/src/landmark-pitch-paint-coverage-a.js','game/src/landmark-pitch-paint-coverage-b.js']){
  const served=fs.readFileSync(path.join(root,file)),expected=execFileSync('git',['show',sourceCommit+':'+file]);
  if(!served.equals(expected))throw Error('Snapshot does not match commit: '+file);inputs[file]=hash(served);
}
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
  const server=http.createServer((req,res)=>{if(req.url.split('?')[0]==='/favicon.ico'){res.writeHead(204).end();return;}const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(err?'missing':data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:960,height:720}}),errors=[],consoleErrors=[],records=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    for(const [id,route]of [['front','view=street&az=0'],['top','view=top&az=0'],['oblique','view=oblique&az=35&el=28']]){
      const viewerRoute='/game/dev/landmarks.html?id=dinamo&clean=1&fountains=on&'+route;
      await page.goto('http://127.0.0.1:'+server.address().port+viewerRoute,{waitUntil:'domcontentloaded',timeout:180000});
      await page.waitForFunction(()=>window.__ready,null,{timeout:180000});
      const capture=await page.evaluate(()=>window.__landmarkCapture),image=id+'.png';
      await page.locator('canvas').screenshot({path:path.join(out,image)});
      records.push({id,image,sha256:hash(fs.readFileSync(path.join(out,image))),sourceCommit,capturedAt:new Date().toISOString(),viewerRoute,capture});
      console.log(id,capture.triangles,capture.drawCalls);
    }
    fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({sourceCommit,captureToolSha256:hash(fs.readFileSync(__filename)),inputs,errors,consoleErrors,records},null,2)+'\n');
    if(errors.length||consoleErrors.length)process.exitCode=1;
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
