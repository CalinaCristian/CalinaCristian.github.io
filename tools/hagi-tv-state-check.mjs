// Real SpotUI and TV lifecycle with an explicitly mocked publisher API.
// This cannot establish third-party playback, embedding permission or scene access.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.argv[2]||'/tmp/hagi-tv-state';
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 if(req.url==='/fixture.html'){res.setHeader('content-type','text/html');res.end('<!doctype html><body style="background:#333"></body>');return;}
 try{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type','application/javascript');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://www.youtube.com/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture.html`);
 await page.evaluate(async()=>{
  const [{SpotUI},{officialHagiTV,hagiEmbedURL,HAGI_BROADCAST}]=await Promise.all([import('/game/src/spots/ui.js'),import('/game/src/spots/official-hagi-tv.js')]);
  const updates=[],room=new EventTarget();room.visible=true;
  const ctx={extras:{},room,onUpdate:f=>updates.push(f)},audio={enabled:true,muted:false,volume:.4};
  const s={ui:new SpotUI(),host:{audio},input:{releaseLock(){},take(){},keys:new Set(),flush(){}},returnFocus(){window.focusReturned=(window.focusReturned||0)+1;}};
  window.players=[];globalThis.YT={Player:class{
   constructor(frame,{events}){this.frame=frame;this.events=events;this.muted=true;this.playing=false;this.destroyed=false;players.push(this);queueMicrotask(()=>events.onReady());}
   mute(){this.muted=true;}isMuted(){return this.muted;}setVolume(v){this.volume=v;}playVideo(){this.playing=true;}pauseVideo(){this.playing=false;}seekTo(t){this.seek=t;}destroy(){this.destroyed=true;this.playing=false;this.frame.remove();}
  }};
  const tv=officialHagiTV(ctx);window.fixture={ctx,s,audio,tv,updates,hagiEmbedURL,HAGI_BROADCAST,tick:()=>updates.forEach(f=>f(.1,s))};
 });
 const check=async(label,fn)=>{assert.equal(await page.evaluate(fn),true,label);checks.push(label);};
 await check('Only the selected official video and matching repeat playlist are embedded',()=>{
  const f=fixture,u=new URL(f.hagiEmbedURL(location.origin));return u.hostname==='www.youtube.com'&&u.pathname==='/embed/rx8GxxrkJEc'&&u.searchParams.get('playlist')===f.HAGI_BROADCAST.id&&u.searchParams.get('loop')==='1'&&u.searchParams.get('mute')==='1'&&u.searchParams.get('origin')===location.origin;
 });
 await check('A hidden sports room cannot start a player',()=>{fixture.ctx.room.visible=false;const no=!fixture.tv.open(fixture.s);fixture.ctx.room.visible=true;return no&&players.length===0;});
 await page.evaluate(()=>fixture.tv.open(fixture.s));await page.waitForFunction(()=>players.length===1&&players[0].playing);
 await check('Opening starts muted and keeps official source links and a 44px exit',()=>{
  const p=players[0],u=fixture.s.ui;return p.muted&&p.volume===40&&u.panelOpen&&u.$('[data-close]').getBoundingClientRect().height>=44&&u.$('a').href===fixture.HAGI_BROADCAST.url;
 });
 await check('Game mute overrides a subsequent player-control unmute',()=>{fixture.audio.muted=true;players[0].muted=false;fixture.tick();if(!players[0].muted)return false;players[0].muted=false;fixture.tick();return players[0].muted;});
 await check('A completed clip repeats through the publisher API',()=>{const p=players[0];p.playing=false;p.events.onStateChange({data:0});return p.seek===0&&p.playing;});
 await page.screenshot({path:path.join(out,'phone-player-shell.png')});
 await page.locator('[data-close]').click();
 await check('Back to bar destroys the player and removes the iframe',()=>!fixture.tv.active&&!fixture.s.ui.panelOpen&&players[0].destroyed&&!document.querySelector('iframe')&&focusReturned===1);
 await page.evaluate(()=>fixture.tv.open(fixture.s));await page.waitForFunction(()=>players.length===2&&players[1].playing);
 await check('Publisher failure pauses playback and keeps a readable official fallback',()=>{players[1].events.onError({data:150});return !players[1].playing&&document.querySelector('iframe').getClientRects().length===0&&document.querySelector('[data-video-status]').textContent.includes('Video unavailable')&&[...document.querySelectorAll('a')].some(a=>a.href===fixture.HAGI_BROADCAST.fallback);});
 await page.screenshot({path:path.join(out,'phone-unavailable.png')});
 await page.keyboard.press('Escape');
 await check('Escape closes the TV without leaving media active',()=>players[1].destroyed&&!fixture.tv.active&&!fixture.s.ui.panelOpen);
 await page.evaluate(()=>fixture.tv.open(fixture.s));await page.waitForFunction(()=>players.length===3);
 await check('A host takeover cancels and releases the publisher player',()=>{fixture.ctx.extras.activityCancellers.forEach(f=>f('pause'));return players[2].destroyed&&!document.querySelector('iframe');});
 await page.evaluate(()=>fixture.tv.open(fixture.s));await page.waitForFunction(()=>players.length===4);
 await check('Scene removal destroys media and prevents later reentry',()=>{fixture.ctx.room.dispatchEvent(new Event('removed'));return players[3].destroyed&&!fixture.tv.open(fixture.s)&&!document.querySelector('iframe');});
 assert.deepEqual(errors,[]);
 const report={passed:true,source:process.env.SOURCE_COMMIT||null,scope:'Actual SpotUI and TV open/close/mute/repeat/error/disposal with explicitly mocked YouTube API and blocked iframe requests. No actual publisher playback or physical scene claim.',checks,errors};
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
