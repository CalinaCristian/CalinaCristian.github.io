import * as THREE from '../../vendor/three.module.min.js';
import {GeoBatch,M} from './kit.js';
import {makeCrowd} from '../crowd.js';
import {activityFlow,activityBlocked} from './participation.js';
import {createGame,rollDice,legalMoves,applyMove,confirmTurn,chooseTurn,pipCount,gameResult} from './backgammon-engine.js';

const CSS=`.sp-participation.bg-game{left:auto;right:16px;bottom:20px;top:auto;width:min(660px,calc(100vw - 32px));max-height:calc(100vh - 130px);overflow:auto;background:#182027f2}.bg-game [data-help]{font-size:12px}.bg-game progress{height:5px}.bg-game .bg-summary{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px}.bg-game .bg-dice{display:flex;gap:6px;align-items:center;margin:8px 0}.bg-game .bg-dice button{min-width:44px;padding:5px;background:#f3e5ca;color:#251b12;border:2px solid transparent}.bg-game .bg-dice button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #deaa3f}.bg-game .bg-dice button[data-used]{opacity:.35;text-decoration:line-through}.bg-game .bg-board{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;border:5px solid #765036;border-radius:6px;background:#a97d4e}.bg-game .bg-half{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:2px}.bg-game .bg-point{position:relative;min-width:0;min-height:72px;padding:0;border:1px solid #d8b778;border-radius:2px;background:#d7b47d;color:#21190e;cursor:default;font:700 11px system-ui;overflow:hidden}.bg-game .bg-point:before{content:'';position:absolute;inset:5px 2px 3px;background:#6d3828;clip-path:polygon(0 0,100% 0,50% 100%)}.bg-game .bg-point:nth-child(2n):before{background:#e9ca91}.bg-game .bg-point[data-bottom]:before{transform:rotate(180deg)}.bg-game .bg-point:disabled{opacity:1}.bg-game .bg-point[data-source]{border:2px solid #fef3c7;cursor:pointer}.bg-game .bg-point[data-destination]{border:2px solid #86efac;box-shadow:inset 0 0 0 2px #166534;cursor:pointer}.bg-game .bg-point[aria-pressed=true]{outline:3px solid #fbbf24;outline-offset:-3px}.bg-game .bg-number{position:absolute;left:3px;top:1px;z-index:1;background:#d7b47dd9;font-size:10px}.bg-game .bg-stack{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:58px;padding-top:10px}.bg-game .bg-checker{width:20px;height:12px;flex:none;border-radius:50%;margin-top:-3px;border:1px solid #34251d;background:#f5e6cb;box-shadow:0 2px #b6a58d}.bg-game .bg-checker[data-dark]{background:#513327;box-shadow:0 2px #291c17;border-color:#dfbd7d}.bg-game .bg-count{z-index:1;padding:0 3px;border-radius:3px;background:#17212bdd;color:#fff;font-size:11px}.bg-game .bg-trays{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.bg-game .bg-trays button{min-height:44px;padding:7px 10px;background:#48525c;color:white}.bg-game .bg-trays button[aria-pressed=true]{outline:2px solid #fbbf24}.bg-game [data-status]{min-height:36px}.bg-game .bg-log{margin:6px 0;font-size:11px;color:#d6dce2;min-height:16px}.bg-game nav{position:sticky;bottom:-12px;background:#182027;padding:6px 0}.bg-game .bg-undo{background:#465360;color:white}@media(max-width:600px){.sp-participation.bg-game{right:10px;bottom:12px;width:calc(100vw - 20px);max-height:calc(100dvh - 120px);padding:10px}.bg-game .bg-board{grid-template-columns:1fr;padding:5px;gap:6px}.bg-game .bg-half{grid-template-columns:repeat(6,minmax(44px,1fr))}.bg-game .bg-point{min-height:58px}.bg-game .bg-stack{min-height:48px}.bg-game .bg-checker{height:10px;width:18px}.bg-game h2{font-size:15px}.bg-game [data-help]{font-size:12px}.bg-game [data-status]{font-size:12px;min-height:30px}}`;

const side=p=>p===1?0:1;
const playerName=p=>p===1?'You':'Doru';
const moveLabel=m=>`${m.from==='bar'?'bar':m.from+1} → ${m.to==='off'?'off':m.to+1} (${m.die})${m.hit?' · hit':''}`;
const die=()=>{if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1),limit=Math.floor(0x100000000/6)*6;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%6+1;}return Math.floor(Math.random()*6)+1;};
const counts = s => [1,-1].map(p=>{
    const locations=[];
    for(let i=0;i<24;i++)for(let j=0;j<s.points[i]*p;j++)locations.push({point:i,stack:j});
    for(let j=0;j<s.bar[side(p)];j++)locations.push({point:'bar',stack:j});
    for(let j=0;j<s.off[side(p)];j++)locations.push({point:'off',stack:j});
    return locations;
});
const pointX=i=>{const col=i>=12?i-12:11-i;return (col-5.5)*.045+(col<6?-.014:.014);};
const pointPosition=(p,{point,stack})=>{
    if(point==='bar')return new THREE.Vector3(0,.0165+stack*.010,p===1?.065:-.065);
    if(point==='off')return new THREE.Vector3(p===1?.365:-.365,-.0075,-.245+stack*.035);
    const top=point>=12,j=stack%5;
    return new THREE.Vector3(pointX(point),.0055+Math.floor(stack/5)*.010,(top?-.238:.238)+(top?1:-1)*j*.036);
};

/** A full match on an existing source-backed park table. The regular is a
 * fictional NPC, not a representation of a named real person. y is the
 * existing concrete tabletop, 0.8m above its seats' ground datum. */
export function backgammonGame(ctx,{x,y,z,source,onDone}) {
    const flow=activityFlow(ctx),root=new THREE.Group();root.name='cismigiu-backgammon';root.userData.noFloor=true;ctx.add(root);
    root.position.set(x,y+.012,z);root.rotation.y=Math.PI/2; // the player's board edge faces the existing east seat
    const batch=new GeoBatch();batch.box(0,-.012,0,.66,.012,.55,'#a8794c','wood');
    for(const sd of [-1,1]){batch.box(sd*.326,0,0,.016,.018,.55,'#69472f','wood');batch.box(0,0,sd*.268,.66,.018,.014,'#69472f','wood');}
    batch.box(0,0,0,.028,.012,.52,'#69472f','wood');
    for(let i=0;i<24;i++){const px=pointX(i),top=i>=12,zz=top?-.255:.255;batch.flat([[px-.021,zz],[px+.021,zz],[px,top?-.025:.025]],.001,i%2?'#e5c78f':'#783f2d','paint');}
    root.add(batch.build('backgammon-board'));
    const checkerGeometry=new THREE.CylinderGeometry(.018,.018,.009,16),checkerMaterial=new THREE.MeshStandardMaterial({color:'#fff',roughness:.62,metalness:.02});
    const checkers=new THREE.InstancedMesh(checkerGeometry,checkerMaterial,30);checkers.name='backgammon-30-checkers';checkers.castShadow=true;checkers.receiveShadow=true;root.add(checkers);
    for(let i=0;i<30;i++)checkers.setColorAt(i,new THREE.Color(i<15?'#f2e4c7':'#4d2c20'));checkers.instanceColor.needsUpdate=true;
    const diceMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.028,.028,.028),new THREE.MeshStandardMaterial({color:'#f8efd9',roughness:.5}),2);diceMesh.name='backgammon-dice';diceMesh.castShadow=true;root.add(diceMesh);
    const pips=new THREE.InstancedMesh(new THREE.SphereGeometry(.0018,6,4),new THREE.MeshStandardMaterial({color:'#201b18',roughness:.8}),42);pips.name='backgammon-dice-pips';root.add(pips);
    const patterns={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[-1,1],[1,-1],[1,1]],5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};
    const faces=[null,{n:[0,1,0],u:[1,0,0],v:[0,0,1]},{n:[1,0,0],u:[0,1,0],v:[0,0,1]},{n:[0,0,1],u:[1,0,0],v:[0,1,0]},{n:[0,0,-1],u:[1,0,0],v:[0,1,0]},{n:[-1,0,0],u:[0,1,0],v:[0,0,1]},{n:[0,-1,0],u:[1,0,0],v:[0,0,1]}];
    const elder=makeCrowd({max:1,city:'bucharest',rng:()=>.5});elder.count=1;elder.dress(0,{top:'#43594b',bottom:'#4b443d',skin:'#cda886',hair:'#a9a7a0',acc:'#82684d',flags:0});
    elder.set(0,{x:x-.95,y:y-.8,z,yaw:-Math.PI/2,pose:'sit',amp:0,phase:1.4,scale:.98});ctx.add(elder.object);elder.object.name='Doru-fictional-park-regular';elder.object.userData.fictional=true;
    ctx.circle(x-.95,z,.28,1.3);(ctx.extras.sceneCleanups||=[]).push(()=>elder.dispose());

    let match=createGame(),turnStart=match,undo=[],selectedFrom=null,selectedDie=null,awarded=false,resultConfirmed=false,resultClosed=false,aiWait=.6,rollTime=0,animationTime=1,fromPositions=[],toPositions=[],lastLine='Doru: “Shall we play a full game?”';
    let moveCachePosition=null,moveCache=[];
    const movesFor=()=>{if(moveCachePosition!==match){moveCachePosition=match;moveCache=legalMoves(match);}return moveCache;};
    const events=[],record=(action,detail={})=>events.push({action,...detail,state:match});
    const targets=s=>counts(s).flatMap((locations,i)=>locations.map(loc=>pointPosition(i===0?1:-1,loc)));
    const renderCheckers=(s,animate=false)=>{
        const next=targets(s);
        if(toPositions.length&&animate){
            const assigned=Array(30),remaining=new Set(next.map((_,i)=>i));
            for(let i=0;i<30;i++){const found=[...remaining].find(j=>(i<15)===(j<15)&&toPositions[i].distanceToSquared(next[j])<1e-12);if(found!==undefined){assigned[i]=next[found];remaining.delete(found);}}
            for(let i=0;i<30;i++)if(!assigned[i]){const found=[...remaining].find(j=>(i<15)===(j<15));assigned[i]=next[found];remaining.delete(found);}
            fromPositions=toPositions.map(v=>v.clone());toPositions=assigned;animationTime=0;
        }else{toPositions=next;fromPositions=next.map(v=>v.clone());animationTime=1;}
        if(!animate)for(let i=0;i<30;i++)checkers.setMatrixAt(i,M(...toPositions[i].toArray()));
        checkers.instanceMatrix.needsUpdate=true;
    };
    const renderDice=()=>{
        const values=match.dice.length?match.dice:match.openingDice.length?match.openingDice:[1,1];let at=0;
        for(let i=0;i<2;i++){
            const face=faces[values[i]],target=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.n),new THREE.Vector3(0,1,0)),spin=new THREE.Quaternion().setFromEuler(new THREE.Euler(rollTime*17*(i?1:-1),rollTime*13,rollTime*11));
            const q=spin.multiply(target),pos=new THREE.Vector3(i?-.065:.065,.015+Math.sin(Math.min(1,rollTime/.45)*Math.PI)*.035,0),m=new THREE.Matrix4().compose(pos,q,new THREE.Vector3(1,1,1));diceMesh.setMatrixAt(i,m);
            for(let value=1;value<=6;value++){const f=faces[value];for(const[a,b]of patterns[value]){const p=new THREE.Vector3(...f.n).multiplyScalar(.0142).addScaledVector(new THREE.Vector3(...f.u),a*.006).addScaledVector(new THREE.Vector3(...f.v),b*.006).applyQuaternion(q).add(pos);pips.setMatrixAt(at++,M(...p.toArray()));}}
        }
        diceMesh.instanceMatrix.needsUpdate=true;pips.instanceMatrix.needsUpdate=true;
    };
    renderCheckers(match);renderDice();
    const eventMove=(m,p)=>{record('move',{player:p,move:{...m}});lastLine=`${playerName(p)}: ${moveLabel(m)}`;};
    const resetSelection=()=>{const moves=movesFor();if(!moves.some(m=>m.die===selectedDie))selectedDie=moves[0]?.die??null;selectedFrom=match.turn===1&&moves.some(m=>m.from==='bar')?'bar':null;};
    const roll=()=>{const a=die(),b=die();match=rollDice(match,a,b);record('roll',{dice:[a,b]});rollTime=.45;turnStart=match;undo=[];aiWait=.75;resetSelection();renderDice();};
    const resetMatch=()=>{match=createGame();turnStart=match;undo=[];selectedFrom=null;selectedDie=null;awarded=false;resultConfirmed=false;resultClosed=false;aiWait=.6;record('new-match');lastLine='Doru: “Your white checkers move toward points 1–6.”';renderCheckers(match);};
    const changeMove=(m,human)=>{const before=match;if(human)undo.push(before);match=applyMove(match,m);eventMove(m,before.turn);renderCheckers(match,true);resetSelection();};
    const current=()=>flow.run?.backgammon===true?flow.run:null;
    const readyForPoint=()=>current()&&!activityBlocked(current().s)&&match.turn===1&&match.phase==='move'&&animationTime>=1&&rollTime<=0;
    const clickPoint=(point,expectedRun)=>{
        if(current()!==expectedRun||!readyForPoint())return;
        const moves=movesFor().filter(m=>m.die===selectedDie),move=moves.find(m=>m.from===selectedFrom&&m.to===point);
        if(move)changeMove(move,true);else if(moves.some(m=>m.from===point))selectedFrom=selectedFrom===point?null:point;
        refresh();
    };
    function refresh(){
        const r=current();if(!r)return;
        const moves=movesFor(),chosen=moves.filter(m=>m.die===selectedDie),human=match.turn===1,transition=animationTime<1||rollTime>0;
        r.summary.textContent=`You · white · ${match.off[0]}/15 off · ${pipCount(match,1)} pips     Doru · brown · ${match.off[1]}/15 off · ${pipCount(match,-1)} pips`;
        r.progress.value=match.off[0]/15;r.log.textContent=lastLine;
        r.dice.replaceChildren();
        const pool=match.dice.length?(match.dice[0]===match.dice[1]?Array(4).fill(match.dice[0]):match.dice):[];
        const available=[...match.remaining];
        for(const value of pool){const b=document.createElement('button'),index=available.indexOf(value),used=index<0;if(!used)available.splice(index,1);b.type='button';b.textContent=String(value);b.setAttribute('aria-label',`Die ${value}${used?' used':''}`);b.setAttribute('aria-pressed',String(!used&&selectedDie===value));if(used)b.dataset.used='';b.disabled=used||!human||transition||!moves.some(m=>m.die===value);b.onclick=()=>{if(current()!==r||!readyForPoint())return;selectedDie=value;selectedFrom=moves.some(m=>m.from==='bar')?'bar':null;refresh();};r.dice.append(b);}
        if(!pool.length){const label=document.createElement('span');label.textContent=match.openingDice.length?`Opening dice: you ${match.openingDice[0]}, Doru ${match.openingDice[1]} · tie`:'Roll one opening die each.';r.dice.append(label);}
        for(const[i,b]of r.points.entries()){
            const n=match.points[i],canFrom=human&&chosen.some(m=>m.from===i),canTo=human&&chosen.some(m=>m.from===selectedFrom&&m.to===i);
            b.disabled=!readyForPoint()||(!canFrom&&!canTo);b.toggleAttribute('data-source',canFrom);b.toggleAttribute('data-destination',canTo);b.setAttribute('aria-pressed',String(selectedFrom===i));b.setAttribute('aria-label',`Point ${i+1}: ${Math.abs(n)} ${n<0?'brown':'white'} checkers${canTo?', legal destination':canFrom?', choose checker':''}`);
            b.stack.replaceChildren();for(let j=0;j<Math.min(5,Math.abs(n));j++){const disc=document.createElement('span');disc.className='bg-checker';if(n<0)disc.dataset.dark='';b.stack.append(disc);}if(Math.abs(n)>5){const label=document.createElement('span');label.className='bg-count';label.textContent=String(Math.abs(n));b.stack.append(label);}
        }
        r.bar.textContent=`Your bar: ${match.bar[0]} · Doru: ${match.bar[1]}`;r.bar.disabled=!readyForPoint()||!chosen.some(m=>m.from==='bar');r.bar.setAttribute('aria-pressed',String(selectedFrom==='bar'));
        r.off.textContent=`Bear off · ${match.off[0]}/15`;r.off.disabled=!readyForPoint()||!chosen.some(m=>m.from===selectedFrom&&m.to==='off');
        r.undo.disabled=!human||match.phase==='finished'||!undo.length||transition;r.busy=transition||(!human&&match.phase!=='finished')||(human&&match.phase==='move'&&moves.length>0);
        if(match.phase==='opening'){r.button.textContent='Roll opening dice';r.status.textContent=match.openingDice.length?'A tie. Roll one die each again.':'Highest opening die starts and uses both numbers.';}
        else if(match.phase==='finished'){r.busy=transition;r.button.textContent=human?'Confirm match win':'Confirm match';r.status.textContent=human?'You bore off all fifteen checkers. You won! Confirm the result to finish.':'Doru won this match. Confirm the result to finish; you can start a new match next time.';}
        else if(!human){r.button.textContent='Doru is playing…';r.status.textContent=match.phase==='roll'?'Doru is rolling his dice.':`Doru is considering ${match.remaining.join(', ')||'the end of his turn'}.`;}
        else if(match.phase==='roll'){r.button.textContent='Roll dice';r.status.textContent='Your turn. Roll both dice.';}
        else if(!moves.length){r.button.textContent=match.remaining.length?'Confirm blocked turn':'Confirm turn';r.status.textContent=match.remaining.length?'No remaining die has a legal move. Confirm to pass.':'Both dice have been played. Confirm, or undo before handing over.';}
        else{r.button.textContent='Play the highlighted dice';r.status.textContent=match.bar[0]?'Enter from the bar first. Choose a highlighted landing point.':selectedFrom!==null?`Choose a green destination for die ${selectedDie}.`:`Choose die ${selectedDie}, then a highlighted white checker.`;}
        r.button.disabled=r.busy;
    }

    ctx.interactables.push({kind:'backgammon',source,x:x+.95,z,r:1.8,label:'Play backgammon with Doru',use:s=>{
        let activityRun=null;
        return flow.begin(s,{title:'Backgammon at La Șahiști',help:'Choose a die, a white checker and its green destination. Use both dice if possible; if only one can be played, use the higher. Enter from the bar first. Get all fifteen home (points 1–6), then bear off.',action:'Roll opening dice',focus:{x:x-.95,y:y+.35,z},
            started(s,r){
                activityRun=r;if(resultClosed)resetMatch();
                r.backgammon=true;r.ui.classList.add('bg-game');if(!document.getElementById('backgammon-game-css')){const st=document.createElement('style');st.id='backgammon-game-css';st.textContent=CSS;document.head.append(st);}
                r.summary=document.createElement('p');r.summary.className='bg-summary';r.dice=document.createElement('div');r.dice.className='bg-dice';r.dice.setAttribute('aria-label','Available dice');
                const board=document.createElement('div');board.className='bg-board';board.setAttribute('role','group');board.setAttribute('aria-label','Backgammon board. White home points are 1 to 6.');r.points=Array(24);
                for(const half of [[12,13,14,15,16,17,11,10,9,8,7,6],[18,19,20,21,22,23,5,4,3,2,1,0]]){const section=document.createElement('div');section.className='bg-half';for(const i of half){const b=document.createElement('button');b.className='bg-point';b.type='button';b.dataset.point=i;if(i<12)b.dataset.bottom='';const number=document.createElement('span');number.className='bg-number';number.textContent=i+1;b.stack=document.createElement('span');b.stack.className='bg-stack';b.append(number,b.stack);b.onclick=()=>clickPoint(i,r);r.points[i]=b;section.append(b);}board.append(section);}
                const trays=document.createElement('div');trays.className='bg-trays';r.bar=document.createElement('button');r.bar.type='button';r.bar.onclick=()=>{if(current()===r&&readyForPoint()){selectedFrom='bar';refresh();}};r.off=document.createElement('button');r.off.type='button';r.off.onclick=()=>{if(current()!==r||!readyForPoint())return;const m=movesFor().find(m=>m.from===selectedFrom&&m.to==='off'&&m.die===selectedDie);if(m){changeMove(m,true);refresh();}};trays.append(r.bar,r.off);
                r.log=document.createElement('p');r.log.className='bg-log';r.log.setAttribute('aria-live','polite');const nav=r.ui.querySelector('nav');r.ui.insertBefore(r.summary,r.progress);r.ui.insertBefore(r.dice,nav);r.ui.insertBefore(board,nav);r.ui.insertBefore(trays,nav);r.ui.insertBefore(r.log,nav);
                r.undo=document.createElement('button');r.undo.type='button';r.undo.className='bg-undo';r.undo.textContent='Undo move';r.undo.onclick=()=>{if(current()!==r||activityBlocked(s)||match.phase==='finished'||match.turn!==1||!undo.length||animationTime<1||rollTime>0)return;match=undo.pop();record('undo');resetSelection();renderCheckers(match);refresh();};nav.insertBefore(r.undo,nav.querySelector('[data-leave]'));
                resetSelection();record('begin');refresh();
            },
            actioned(s,r){
                if(current()!==r||r!==activityRun)return;
                if(match.phase==='finished'){
                    if(resultConfirmed||resultClosed)return;
                    resultConfirmed=true;record('confirm-result',{winner:match.winner});
                    if(match.winner===1)record('confirm-win');
                    flow.complete();return;
                }
                if(match.phase==='opening'||(match.phase==='roll'&&match.turn===1)){roll();refresh();return;}
                if(match.turn===1&&match.phase==='move'&&!movesFor().length){match=confirmTurn(match);undo=[];turnStart=match;record('confirm-turn');aiWait=.6;selectedFrom=null;refresh();}
            },
            update(dt){
                if(match.turn!==-1||match.phase==='finished'||rollTime>0||animationTime<1)return;
                aiWait-=dt;if(aiWait>0)return;
                if(match.phase==='roll'){roll();refresh();return;}
                if(match.phase==='move'){const plan=chooseTurn(match);if(plan.length){changeMove(plan[0],false);aiWait=.55;}else{match=confirmTurn(match);record('opponent-confirm');turnStart=match;undo=[];aiWait=.6;resetSelection();}refresh();}
            },
            cancel(s,reason){
                if(match.phase!=='finished'&&match.turn===1&&undo.length){match=turnStart;undo=[];renderCheckers(match);resetSelection();}
                resultConfirmed=false;record('cancel',{reason});
            },
            complete(s){
                if(!resultConfirmed||resultClosed||match.phase!=='finished')return;
                resultClosed=true;record('result-closed',{winner:match.winner});
                if(match.winner===1&&!awarded){awarded=true;record('awarded');onDone?.(s,gameResult(match));}
            },
        });
    }});
    ctx.onUpdate(dt=>{
        let controlsChanged=false;
        if(animationTime<1){animationTime=Math.min(1,animationTime+dt/.24);const t=animationTime*(2-animationTime);for(let i=0;i<30;i++){const p=fromPositions[i].clone().lerp(toPositions[i],t);if(fromPositions[i].distanceToSquared(toPositions[i])>1e-12)p.y+=Math.sin(animationTime*Math.PI)*.055;checkers.setMatrixAt(i,M(...p.toArray()));}checkers.instanceMatrix.needsUpdate=true;controlsChanged=animationTime===1;}
        if(rollTime>0){rollTime=Math.max(0,rollTime-dt);renderDice();controlsChanged=controlsChanged||rollTime===0;}
        // The position and point counts already changed in the input handler.
        // Only re-enable controls when motion ends; preserve DOM focus while
        // checker/die matrices alone advance through the intervening frames.
        if(controlsChanged)refresh();
    });
    ctx.extras.backgammon={source,table:{x,y,z,boardRotationY:Math.PI/2},opponent:{name:'Doru',fictional:true,x:x-.95,y:y-.8,z,yaw:-Math.PI/2},state:()=>match,result:()=>Object.freeze({confirmed:resultConfirmed,closed:resultClosed,awarded}),legalMoves:()=>movesFor().map(m=>({...m})),events:()=>events.map(e=>({...e})),checkers,diceMesh,pips};
    return root;
}
