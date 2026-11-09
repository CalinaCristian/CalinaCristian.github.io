// Explicit valid ENDGAME fixtures, not fair full matches or public/native proof.
// Only the constructor createGame factory is substituted in-memory; final moves,
// AI, engine transitions, actual DOM controls/activityFlow and SpotSession tour
// capture/completion/skip methods are production code. No World/WebGL/browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {backgammonGame as productionGame} from '../../../game/src/spots/backgammon-game.js';
import {SpotSession} from '../../../game/src/spots/index.js';
import {createGame,validatePosition,legalMoves,gameResult} from '../../../game/src/spots/backgammon-engine.js';
const require=createRequire(import.meta.url),domPath=process.env.BACKGAMMON_DOM_PACKAGE||'/tmp/cismigiu-backgammon-test-dom/node_modules/linkedom',{parseHTML}=require(domPath),packageInfo=require(path.join(domPath,'package.json'));
const checks=[],fixtures=[],sha=v=>createHash('sha256').update(v).digest('hex');
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
const gameURL=new URL('../../../game/src/spots/backgammon-game.js',import.meta.url),source=fs.readFileSync(gameURL,'utf8');
const initial=(winner)=>{const s={...createGame(),points:Array(24).fill(0),bar:[0,0],off:winner===1?[14,0]:[0,14],turn:winner,phase:'move',dice:[1,1],remaining:[1],openingDice:[],winner:0};s.points[winner===1?0:5]=winner===1?1:15;s.points[winner===1?18:23]=winner===1?-15:-1;validatePosition(s);return s;};
async function fixtureModule(winner,name){
 const s=initial(winner);assert.ok(legalMoves(s).some(m=>m.to==='off'));
 let transformed=source.replace('createGame,rollDice','createGame as fullCreateGame,rollDice').replace(/from ['"](\.[^'"]+)['"]/g,(_,r)=>`from '${new URL(r,gameURL).href}'`);
 const factory=`let suppliedFixtureUsed=false;const createGame=()=>{if(suppliedFixtureUsed)return fullCreateGame();suppliedFixtureUsed=true;const s=${JSON.stringify(s)};for(const k of ['points','bar','off','dice','remaining','openingDice'])Object.freeze(s[k]);return Object.freeze(s);};\n// Explicit endgame case ${name}\n`;
 assert.notEqual(transformed,source);transformed=transformed.replace('const CSS=',factory+'const CSS=');
 transformed+='\nexport function resetExplicitFixture(){suppliedFixtureUsed=false;}';
 const module=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));
 fixtures.push({name,scope:'Explicit valid near-finished supplied endgame, not a full-opening/fair/native match',initial:s,initialValid:true,legalFinalMoves:legalMoves(s),transformedModuleSHA256:sha(transformed)});
 return (...args)=>{module.resetExplicitFixture();return module.backgammonGame(...args);};
}
function fixture(buildGame=productionGame){
 const {window,document}=parseHTML('<html><head></head><body><div id="spot-ui"></div></body></html>');globalThis.window=window;globalThis.document=document;
 const updates=[],scene=new THREE.Scene(),awards=[],activityStates=[],s=Object.create(SpotSession.prototype);
 s.ctl={position:{x:.95,y:0,z:0},active:true,heading:0,pitch:0,place(){}};s.input={keys:new Set(),take:()=>false,takeLook:()=>({dx:0,dy:0}),releaseLock(){}};s.host={};s.ui={el:document.getElementById('spot-ui'),panelOpen:false,prompt(){},setActivityActive:b=>activityStates.push(b)};
 const ctx={extras:{sceneCleanups:[]},interactables:[],onUpdate:f=>updates.push(f),add:g=>scene.add(g),circle(){}};
 s.spot={id:'cismigiu',ctx};s.guide={x:0,y:0,z:0,speed:0};s._tourUI=s._routeLine=s._refreshMarkers=()=>{};
 // Explicit flat synthetic next-leg route: only tour state logic is under test.
 s._navPath=()=>[[0,0],[3,0]];
 globalThis.game={state:'spot',spot:s,pauseOpen:false,condOpen:false};
 buildGame(ctx,{x:0,y:.8,z:0,source:'explicit-test-table-not-source-approach',onDone:(host,result)=>{assert.equal(host,s);awards.push(result);}});
 const interaction=ctx.interactables[0],st={kind:'activity',label:'Explicit backgammon fixture',interaction,x:0,z:0,radius:2},next={kind:'activity',label:'Explicit unrelated next stop',interaction:{},x:3,z:0,radius:1};
 s.tour={stops:[st,next],i:0,state:'activity',skipped:0,travelled:0};
 const flow=ctx.extras.participation,data=ctx.extras.backgammon;
 const tick=(n=1)=>{for(let i=0;i<n;i++)for(const f of updates)f(.1,s,s.position);};
 const open=()=>{s._usingInteraction=interaction;try{return interaction.use(s);}finally{s._usingInteraction=null;}};
 const click=b=>{assert.ok(b&&!b.disabled,'Actual requested control is disabled');b.click();};
 const key=code=>{const e=new window.Event('keydown',{bubbles:true,cancelable:true});e.code=code;window.dispatchEvent(e);return e;};
 const humanFinish=(settle=true)=>{const r=flow.run;click([...r.dice.querySelectorAll('button')].find(b=>!b.disabled&&b.textContent==='1'));click(r.points[0]);click(r.off);assert.equal(data.state().phase,'finished');if(settle)tick(3);};
 const assertUnfinished=()=>{assert.equal(s.tour.i,0);assert.ok(!st.participated&&!st.done);assert.equal(awards.length,0);assert.deepEqual(data.result(),{confirmed:false,closed:false,awarded:false});};
 const dispose=()=>{flow.dispose();for(const f of ctx.extras.sceneCleanups)f();scene.clear();};
 return{s,ctx,data,flow,awards,activityStates,st,next,tick,open,click,key,humanFinish,assertUnfinished,dispose};
}
const human=await fixtureModule(1,'human-final-bearoff'),opponent=await fixtureModule(-1,'Doru-final-bearoff');
const oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');let draws=0;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(a){a[0]=[1,4][draws++%2];return a;}}});
try{
 const f=fixture();
 check('opening and rolling actual supplied-die controls never completes a tour or awards',()=>{assert.equal(f.open(),true);f.assertUnfinished();f.key('KeyE');assert.equal(f.data.state().phase,'move');f.assertUnfinished();f.key('Escape');assert.equal(f.flow.active,false);assert.equal(f.s.ctl.active,true);f.assertUnfinished();});f.dispose();
 const h=fixture(human);assert.equal(h.open(),true);h.humanFinish();
 check('human final legal point/off clicks finish actual engine/instances but await result confirmation',()=>{assert.equal(validatePosition(h.data.state()),true);assert.equal(h.data.state().winner,1);assert.equal(h.data.state().off[0],15);assert.equal(h.flow.run.button.textContent,'Confirm match win');assert.equal(h.flow.run.undo.disabled,true);h.assertUnfinished();});
 const finishedHuman=h.data.state();h.key('Escape');
 check('Escape preserves the exact finished human board and keeps the captured stop unfinished',()=>{assert.equal(h.flow.active,false);assert.equal(h.data.state(),finishedHuman);h.assertUnfinished();});
 assert.equal(h.open(),true);const oldWinRun=h.flow.run;oldWinRun.undo.click();
 check('reopening an unconfirmed win resumes its immutable finished board; finished Undo stays disabled',()=>{assert.equal(h.data.state(),finishedHuman);h.assertUnfinished();});
 h.key('KeyE');
 check('actual keyboard result confirmation awards one human win and advances the actual captured SpotSession stop once',()=>{assert.equal(h.flow.active,false);assert.equal(h.s.ctl.active,true);assert.equal(h.s.tour.i,1);assert.equal(h.st.participated,true);assert.equal(h.st.done,true);assert.equal(h.awards.length,1);assert.equal(h.awards[0].winner,1);assert.deepEqual(h.data.result(),{confirmed:true,closed:true,awarded:true});assert.equal(h.data.events().filter(e=>e.action==='confirm-result').length,1);assert.equal(h.data.events().filter(e=>e.action==='awarded').length,1);});
 oldWinRun.button.click();oldWinRun.opts.complete(h.s);h.flow.complete();
 check('duplicate removed confirmation/completion cannot reaward or advance the unrelated next tour stop',()=>{assert.equal(h.awards.length,1);assert.equal(h.s.tour.i,1);assert.ok(!h.next.participated);});
 assert.equal(h.open(),true);const rematch=h.data.state();oldWinRun.button.click();
 check('next interaction after confirmed human result starts a full opening match and stale confirm cannot roll it',()=>{assert.equal(rematch.phase,'opening');assert.deepEqual(rematch.off,[0,0]);assert.deepEqual(rematch,createGame());assert.equal(h.data.state(),rematch);assert.equal(h.awards.length,1);assert.deepEqual(h.data.result(),{confirmed:false,closed:false,awarded:false});});h.dispose();
 const anim=fixture(human);assert.equal(anim.open(),true);anim.humanFinish(false);const pendingAnimation=anim.data.state();anim.key('KeyE');anim.key('Escape');
 check('last-checker animation blocks premature confirmation, and cancelling it retains the finished board for resumed confirmation',()=>{assert.equal(anim.flow.active,false);assert.equal(anim.data.state(),pendingAnimation);anim.assertUnfinished();assert.equal(anim.open(),true);assert.equal(anim.flow.run.button.disabled,true);anim.tick(3);assert.equal(anim.flow.run.button.disabled,false);anim.key('KeyE');assert.equal(anim.awards.length,1);assert.equal(anim.s.tour.i,1);});anim.dispose();
 const d=fixture(opponent);assert.equal(d.open(),true);d.tick(10);const finishedLoss=d.data.state();
 check('actual opponent update legally bears off checker15 and exposes Confirm match without auto-completion',()=>{assert.equal(validatePosition(finishedLoss),true);assert.equal(finishedLoss.winner,-1);assert.equal(finishedLoss.off[1],15);assert.equal(d.flow.run.button.textContent,'Confirm match');assert.ok(!d.flow.run.button.disabled);d.assertUnfinished();});
 d.click(d.flow.run.ui.querySelector('[data-leave]'));
 check('Leave before loss confirmation retains the exact finished board and no tour/award credit',()=>{assert.equal(d.flow.active,false);assert.equal(d.data.state(),finishedLoss);d.assertUnfinished();});
 assert.equal(d.open(),true);const oldLossRun=d.flow.run;d.click(oldLossRun.button);
 check('actual loss-confirm button closes flow and advances the captured tour stop once with zero win award',()=>{assert.equal(d.flow.active,false);assert.equal(d.s.ctl.active,true);assert.equal(d.s.tour.i,1);assert.equal(d.st.participated,true);assert.equal(d.st.done,true);assert.equal(d.awards.length,0);assert.deepEqual(d.data.result(),{confirmed:true,closed:true,awarded:false});assert.equal(d.data.events().filter(e=>e.action==='result-closed').length,1);assert.equal(d.data.events().filter(e=>e.action==='awarded').length,0);});
 oldLossRun.button.click();oldLossRun.opts.complete(d.s);d.flow.complete();assert.equal(d.open(),true);const newLossGame=d.data.state();oldLossRun.button.click();
 check('confirmed loss permits a fresh full match only on next interaction; stale loss controls stay harmless',()=>{assert.deepEqual(newLossGame,createGame());assert.equal(d.data.state(),newLossGame);assert.equal(d.s.tour.i,1);assert.equal(d.awards.length,0);assert.deepEqual(d.data.result(),{confirmed:false,closed:false,awarded:false});});d.dispose();
 const skip=fixture(opponent);assert.equal(skip.open(),true);skip.tick(10);const beforeSkip=skip.data.state();skip.s.skipTourStop();
 check('actual tour skip cancels without confirming/awarding the match; skipped stop is never marked participated/done',()=>{assert.equal(skip.flow.active,false);assert.equal(skip.data.state(),beforeSkip);assert.equal(skip.s.tour.i,1);assert.equal(skip.st.skipped,true);assert.ok(!skip.st.participated&&!skip.st.done);assert.equal(skip.awards.length,0);assert.deepEqual(skip.data.result(),{confirmed:false,closed:false,awarded:false});});
 assert.equal(skip.open(),true);skip.click(skip.flow.run.button);
 check('confirming a resumed result after skip cannot advance or complete the unrelated current stop',()=>{assert.equal(skip.flow.active,false);assert.equal(skip.s.tour.i,1);assert.ok(!skip.next.participated&&!skip.next.done);assert.equal(skip.awards.length,0);});skip.dispose();
 const mode=fixture(opponent);assert.equal(mode.open(),true);mode.tick(10);const beforeMode=mode.data.state();globalThis.game.pauseOpen=true;mode.tick();globalThis.game.pauseOpen=false;
 check('host takeover before confirmation keeps finished loss resumable and earns no tour credit',()=>{assert.equal(mode.flow.active,false);assert.equal(mode.data.state(),beforeMode);mode.assertUnfinished();assert.equal(mode.open(),true);assert.equal(mode.data.state(),beforeMode);});mode.dispose();
 const exit=fixture(opponent);assert.equal(exit.open(),true);exit.tick(10);const beforeExit=exit.data.state();exit.flow.dispose();
 check('actual flow disposal/exit before confirmation never confirms, awards or advances its captured stop',()=>{assert.equal(exit.flow.active,false);assert.equal(exit.data.state(),beforeExit);assert.equal(exit.s.ctl.active,true);exit.assertUnfinished();});exit.dispose();
 for(const fixtureRecord of fixtures){const state=fixtureRecord.name==='human-final-bearoff'?finishedHuman:finishedLoss;fixtureRecord.final=state;fixtureRecord.finalValid=validatePosition(state);fixtureRecord.result=gameResult(state);}
 const testedFiles=Object.fromEntries(['game/src/spots/backgammon-game.js','game/src/spots/backgammon-engine.js','game/src/spots/participation.js','game/src/spots/index.js'].map(p=>[p,sha(fs.readFileSync(new URL('../../../'+p,import.meta.url)))]));
 const out=path.resolve(process.argv[2]||'handoffs/fidelity/backgammon-result-confirmation-20261109');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'controller-report.json'),JSON.stringify({passed:true,scope:'CPU DOM/Three endgame fixtures with actual activityFlow and SpotSession capture/completion/skip; no World/WebGL/browser/native/full-match claim',domPackage:{name:packageInfo.name,version:packageInfo.version},checks,testedFiles,fixtures},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,fixtures:fixtures.map(f=>({name:f.name,winner:f.final.winner,finalValid:f.finalValid}))}));
}finally{if(oldCrypto)Object.defineProperty(globalThis,'crypto',oldCrypto);else delete globalThis.crypto;}
