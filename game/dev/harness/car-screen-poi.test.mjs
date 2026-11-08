import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium }=createRequire(import.meta.url)('playwright');

// Production 2D component: a clipped map marker must not tint the translucent
// header. Positive inside and crossing-boundary controls prevent a vacuous fix.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'car-screen-poi-'));
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
    if(req.url==='/fixture.html'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>CarScreen POI clip fixture</title>');return;}
    const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{const bytes=await fs.readFile(file);res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(bytes);}
    catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
    browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--mute-audio']});
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(`http://127.0.0.1:${server.address().port}/fixture.html`);
    const result=await page.evaluate(async()=>{
        const {CarScreen}=await import('/game/src/nav.js');
        const screen=new CarScreen(512,320),scale=1.25,cy=320*.66;
        const info={player:{x:0,z:0,speed:0,heading:0},index:{near:()=>[]},route:null,nav:null,dest:null,street:'POI clip fixture',fuel:.5,fuelText:'25 L',year:2022,units:'km/h',speedText:'0 km/h',clock:'12:00'};
        const render=pois=>{screen.draw({...info,pois});return{pixels:screen.ctx.getImageData(0,0,512,320).data.slice(),png:screen.canvas.toDataURL('image/png')};};
        const base=render([]),rows=[];
        for(const [id,x,y]of[['inside',270,100],['partial-top',270,76],['outside-top',270,65],['native-top-overflow',270,2],['outside-bottom',270,276]]){
            const poi={sourceId:'fixture-poi',x:(x-256)/scale,z:(y-cy)/scale,icon:'⛽',color:'#fa0027'};
            const before=JSON.stringify(poi),frame=render([poi]);let changed=0,outsideMap=0;
            for(let py=0;py<320;py++)for(let px=0;px<512;px++){
                const i=(py*512+px)*4;
                if(frame.pixels[i]!==base.pixels[i]||frame.pixels[i+1]!==base.pixels[i+1]||frame.pixels[i+2]!==base.pixels[i+2]||frame.pixels[i+3]!==base.pixels[i+3]){changed++;if(py<74||py>=266)outsideMap++;}
            }
            rows.push({id,screenCentre:[x,y],changedPixels:changed,changedOutsideMap:outsideMap,inputUnchanged:before===JSON.stringify(poi),png:frame.png});
        }
        return{canvas:[512,320],viewport:[1280,720],mapBounds:[0,74,512,266],font:'11px sans-serif',scope:'isolated production CarScreen; synthetic control poses; no source POI movement',base:base.png,rows};
    });
    for(const row of result.rows){await fs.writeFile(path.join(out,row.id+'.png'),Buffer.from(row.png.split(',')[1],'base64'));delete row.png;}
    await fs.writeFile(path.join(out,'empty.png'),Buffer.from(result.base.split(',')[1],'base64'));delete result.base;
    await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
    for(const row of result.rows){assert(row.inputUnchanged,`${row.id}: source marker mutated`);assert.equal(row.changedOutsideMap,0,`${row.id}: map marker tinted a header/footer pixel`);if(row.id==='inside'||row.id==='partial-top')assert(row.changedPixels>20,`${row.id}: visible positive control disappeared`);else assert.equal(row.changedPixels,0,`${row.id}: wholly outside marker remained visible`);}
    console.log(`CarScreen POI clip controls passed; pictures and pixel counts: ${out}`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
