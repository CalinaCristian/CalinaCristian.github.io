// Real production helper/flow + Three geometry under a CPU DOM fixture. This
// exercises actual click handlers; it is not a native public-scene or visual pass.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {backgammonGame} from '../../../game/src/spots/backgammon-game.js';
import {chooseTurn,validatePosition} from '../../../game/src/spots/backgammon-engine.js';
const require=createRequire(import.meta.url),domPath=process.env.BACKGAMMON_DOM_PACKAGE||'/tmp/cismigiu-backgammon-test-dom/node_modules/linkedom',{parseHTML}=require(domPath),packageInfo=require(path.join(domPath,'package.json'));
const originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'),checks=[],matches=[];
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
function fixture(seed=1){
    const {window,document}=parseHTML('<html><head></head><body><div id="spot-ui"></div></body></html>');globalThis.window=window;globalThis.document=document;
    let randomState=seed>>>0;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(a){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;a[0]=Math.floor(randomState/4294967296*6);return a;}}});
    const updates=[],scene=new THREE.Scene(),colliders=[],awards=[],tourCompletions=[],s={position:{x:.95,y:0,z:0},ctl:{active:true,heading:0,pitch:0,place(){}},input:{take:()=>false,takeLook:()=>({dx:0,dy:0}),keys:new Set(),releaseLock(){}},host:{},ui:{el:document.getElementById('spot-ui'),panelOpen:false,prompt(){}},captureTourActivity:()=>({id:'captured-tour-stop'}),completeTourActivity:t=>tourCompletions.push(t)};
    globalThis.game={state:'spot',spot:s,pauseOpen:false,condOpen:false};
    const ctx={extras:{sceneCleanups:[]},interactables:[],onUpdate:f=>updates.push(f),add:g=>scene.add(g),circle:(x,z,r,h)=>colliders.push({x,z,r,h})};
    backgammonGame(ctx,{x:0,y:.8,z:0,source:'test-source-table',onDone:(host,result)=>{assert.equal(host,s);awards.push(result);}});
    const data=ctx.extras.backgammon,flow=ctx.extras.participation,tick=(n=1)=>{for(let i=0;i<n;i++)for(const f of updates)f(.1,s,s.position);},open=()=>ctx.interactables[0].use(s);
    const click=b=>{assert.ok(b&&!b.disabled,'Requested actual button is disabled');b.click();};
    const playMove=(m,settle=true)=>{const r=flow.run;const d=[...r.dice.querySelectorAll('button')].find(b=>!b.disabled&&Number(b.textContent)===m.die);click(d);if(m.from==='bar')click(r.bar);else click(r.points[m.from]);if(m.to==='off')click(r.off);else click(r.points[m.to]);if(settle)tick(3);};
    const dispose=()=>{flow.dispose();for(const f of ctx.extras.sceneCleanups)f();scene.traverse(o=>o.geometry?.dispose());};
    return{ctx,scene,colliders,awards,tourCompletions,s,data,flow,tick,open,click,playMove,dispose};
}
try{
    const f=fixture(1);
    check('The actual helper creates one30-checker model and two complete six-faced dice',()=>{assert.equal(f.data.checkers.count,30);assert.equal(f.data.diceMesh.count,2);assert.equal(f.data.pips.count,42);assert.equal(f.scene.getObjectByName('Doru-fictional-park-regular').userData.fictional,true);assert.equal(f.colliders.length,1);assert.equal(f.data.table.y,.8);f.scene.updateMatrixWorld(true);const matrix=new THREE.Matrix4();f.data.checkers.getMatrixAt(0,matrix);matrix.premultiply(f.data.checkers.matrixWorld);const p=new THREE.Vector3().setFromMatrixPosition(matrix);assert.ok(Math.abs(p.y-.8175)<1e-6);});
    check('Opening the actual activity creates24native point buttons without awarding or completing a tour',()=>{assert.equal(f.open(),true);assert.equal(f.flow.run.points.length,24);assert.equal(f.s.ctl.active,false);assert.equal(f.awards.length,0);assert.equal(f.tourCompletions.length,0);});
    f.click(f.flow.run.button);f.tick(6);
    let guard=0;while(f.data.state().turn===-1&&guard++<20)f.tick(20);
    if(f.data.state().phase==='roll'){f.click(f.flow.run.button);f.tick(6);}
    const start=JSON.stringify(f.data.state()),m=chooseTurn(f.data.state())[0];assert.ok(m);
    check('Read-only legal-move diagnostics cannot corrupt the cached immutable position',()=>{const original=JSON.stringify(f.data.legalMoves()),view=f.data.legalMoves();view[0].die=99;assert.equal(JSON.stringify(f.data.legalMoves()),original);});
    f.playMove(m,false);const dieNode=f.flow.run.dice.firstElementChild;f.tick();
    check('Checker-only animation preserves actual die controls and keyboard focus nodes',()=>assert.equal(f.flow.run.dice.firstElementChild,dieNode));f.tick(2);
    check('Actual point/die click handlers apply a legal move to both position and 3D instances',()=>{assert.notEqual(JSON.stringify(f.data.state()),start);assert.equal(validatePosition(f.data.state()),true);assert.equal(f.data.checkers.count,30);assert.equal(f.data.events().at(-1).action,'move');assert.equal(f.awards.length,0);});
    f.click(f.flow.run.undo);
    check('Undo restores the exact rolled position without rerolling',()=>assert.equal(JSON.stringify(f.data.state()),start));
    const oldRun=f.flow.run;f.playMove(m);
    const blockedMove=chooseTurn(f.data.state())[0];assert.ok(blockedMove);
    const dieButton=[...oldRun.dice.querySelectorAll('button')].find(b=>!b.disabled&&Number(b.textContent)===blockedMove.die);f.click(dieButton);f.click(blockedMove.from==='bar'?oldRun.bar:oldRun.points[blockedMove.from]);
    const blockedDestination=blockedMove.to==='off'?oldRun.off:oldRun.points[blockedMove.to];assert.equal(blockedDestination.disabled,false);
    globalThis.game.pauseOpen=true;const beforeBlocked=JSON.stringify(f.data.state());blockedDestination.click();
    check('Paused custom point controls cannot change the match',()=>assert.equal(JSON.stringify(f.data.state()),beforeBlocked));
    f.tick();
    check('A host takeover cancels partial turn, restores input and never awards',()=>{assert.equal(f.flow.active,false);assert.equal(f.s.ctl.active,true);assert.equal(JSON.stringify(f.data.state()),start);assert.equal(f.awards.length,0);assert.equal(f.tourCompletions.length,0);});
    globalThis.game.pauseOpen=false;assert.equal(f.open(),true);f.playMove(chooseTurn(f.data.state())[0]);const resumed=JSON.stringify(f.data.state());oldRun.undo.click();oldRun.points[0].click();
    check('Stale removed point/undo handlers cannot edit a resumed game',()=>assert.equal(JSON.stringify(f.data.state()),resumed));
    f.click(f.flow.run.ui.querySelector('[data-leave]'));
    check('Leave restores control and preserves fair rolled dice without completion',()=>{assert.equal(f.flow.active,false);assert.equal(f.s.ctl.active,true);assert.equal(JSON.stringify(f.data.state()),start);assert.equal(f.awards.length,0);assert.equal(f.tourCompletions.length,0);});
    f.dispose();

    check('A full click-driven legal match awards only after the confirmed15th borne-off checker',()=>{
        const g=fixture(7);assert.equal(g.open(),true);let actions=0,losses=0;
        while(!g.awards.length&&actions++<1800){
            const s=g.data.state();validatePosition(s);
            if(s.phase==='finished'){
                g.tick(4);assert.equal(g.awards.length,0);
                if(s.winner!==1)losses++;
                g.click(g.flow.run.button);continue;
            }
            if(s.turn===-1&&s.phase!=='opening'){g.tick(60);continue;}
            if(s.phase==='opening'||s.phase==='roll'){g.click(g.flow.run.button);g.tick(6);continue;}
            const move=chooseTurn(s)[0];if(move)g.playMove(move);else{g.click(g.flow.run.button);g.tick();}
        }
        assert.equal(g.awards.length,1,'No completed genuine human win');assert.equal(g.data.state().winner,1);assert.equal(g.data.state().off[0],15);assert.equal(g.flow.active,false);assert.equal(g.s.ctl.active,true);assert.deepEqual(g.tourCompletions,[{id:'captured-tour-stop'}]);
        for(let i=0;i<15;i++){const m=new THREE.Matrix4();g.data.checkers.getMatrixAt(i,m);const p=new THREE.Vector3().setFromMatrixPosition(m);assert.ok(Math.abs(p.x-.365)<1e-6,'A white checker is absent from the actual off tray');assert.ok(Math.abs(p.y-(-.0075))<1e-6,'An off checker does not rest on the concrete tabletop');}
        const final=g.data.state(),events=g.data.events();assert.equal(events.filter(e=>e.action==='awarded').length,1);assert.equal(events.at(-1).state.winner,1);
        matches.push({seed:7,scope:'CPU DOM fixture using real production click handlers and supplied test dice; not native public-game proof',actions,losses,finalState:final,events});
        assert.equal(g.open(),true);assert.equal(g.data.state().phase,'opening');assert.equal(g.data.state().winner,0);assert.equal(g.awards.length,1);g.dispose();
    });
    const out=path.resolve(process.argv[2]||'handoffs/fidelity/cismigiu-backgammon/controller-validation');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,scope:'CPU DOM/Three geometry and click-driven production helper lifecycle, not native or visual acceptance',domPackage:{name:packageInfo.name,version:packageInfo.version},checks,matches},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,matches:matches.map(m=>({actions:m.actions,losses:m.losses,events:m.events.length}))}));
}finally{if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else delete globalThis.crypto;}
