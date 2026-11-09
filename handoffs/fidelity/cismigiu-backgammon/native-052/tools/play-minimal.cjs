module.exports=async({page,out,save,capture,args})=>{
    const prefix=args.phone?'phone':'desktop',started=Date.now(),checkpoints=[],actions=[];const fs=require('node:fs'),path=require('node:path');const progress=path.join(out,prefix+'-match-progress.jsonl');
    await page.evaluate(async()=>{window.__bgAdvisor=await import('/game/src/spots/backgammon-engine.js');});
    const tick=async n=>page.evaluate(n=>{const s=game.spot,t=performance.now();for(let i=0;i<n;i++)s.update(1/30);return performance.now()-t;},n);
    const click=async locator=>args.phone?locator.tap():locator.click();
    const read=()=>page.evaluate(()=>{const S=game.spot,B=S.spot.ctx.extras.backgammon,r=S.spot.ctx.extras.participation.run,m=B.state();return{match:m,active:!!r,busy:r?.busy,button:r?.button.textContent,actionDisabled:r?.button.disabled,movesReady:!!r?.dice?.querySelector('button:enabled'),achievement:game.achievements?.isUnlocked('lm-cismigiu-backgammon'),events:B.events().length,next:m.phase==='move'&&m.turn===1?__bgAdvisor.chooseTurn(m)[0]||null:null,tour:S.tour?{state:S.tour.state,i:S.tour.i,stops:S.tour.stops.map(t=>({id:t.id,kind:t.kind,participated:t.participated}))}:null};});
    let losses=0,actualMoves=0,sawHit=false,sawDoubles=false;
    for(let i=0;i<2000;i++){
        let state=await read();fs.appendFileSync(progress,JSON.stringify({i,utc:new Date().toISOString(),state})+'\n');if(!state.active)return{passed:state.match.winner===1&&state.achievement===true,reason:state.match.winner===1?'completed':'Activity became inactive',losses,actualMoves,state};
        if(state.match.phase==='finished'){
            await tick(10);state=await read();if(state.match.winner!==1){losses++;if(losses>5)throw Error('Bounded fair-dice match attempts exceeded');await click(page.locator('.bg-game [data-action]'));await tick(2);continue;}
            if(state.achievement)throw Error('Achievement unlocked before confirm');
            await capture(prefix+'-winning-board-before-confirm');checkpoints.push({label:'before-confirm',state});
            await click(page.locator('.bg-game [data-action]'));await tick(1);
            const final=await page.evaluate(()=>{const S=game.spot,B=S.spot.ctx.extras.backgammon,O=window.__bgNative||{clickCPU:[],updateCPU:[]};return{match:B.state(),events:B.events(),ctlActive:S.ctl.active,achievement:game.achievements.isUnlocked('lm-cismigiu-backgammon'),achievementState:game.achievements.state,uiPresent:!!document.querySelector('.bg-game'),clickCPU:O.clickCPU,updateCPU:O.updateCPU,tour:S.tour?{state:S.tour.state,i:S.tour.i,stops:S.tour.stops.map(t=>({kind:t.kind,id:t.id,participated:t.participated}))}:null};});
            const file=save(prefix+'-full-native-match',{scope:'Fair native dice; actual click/tap UI actions from standard opening, actual opponent updates, no position/dice writes',startedUtc:new Date(started).toISOString(),endedUtc:new Date().toISOString(),losses,actualMoves,actions,checkpoints,final});
            await capture(prefix+'-match-win-confirmed');return{passed:final.match.winner===1&&final.match.off[0]===15&&final.achievement===true&&final.ctlActive===true&&!final.uiPresent,file,losses,actualMoves,events:final.events.length,sawHit,sawDoubles,seconds:(Date.now()-started)/1000};
        }
        if(state.match.turn===-1&&state.match.phase!=='opening'){await tick(150);continue;}
        if(state.actionDisabled&&!(state.match.phase==='move'&&state.next&&state.movesReady)){await tick(15);continue;}
        if(state.match.phase==='opening'||state.match.phase==='roll'){
            await click(page.locator('.bg-game [data-action]'));await tick(15);const next=await read();actions.push({kind:'roll',state:next.match});if(next.match.dice[0]===next.match.dice[1]&&next.match.dice.length&&!sawDoubles){sawDoubles=true;await capture(prefix+'-doubles');}continue;
        }
        if(state.next){
            const m=state.next,die=page.locator('.bg-game .bg-dice button:enabled').filter({hasText:new RegExp('^'+m.die+'$')}).first();await click(die);
            await click(m.from==='bar'?page.locator('.bg-game .bg-trays button').first():page.locator('.bg-game [data-point="'+m.from+'"]'));
            await click(m.to==='off'?page.locator('.bg-game .bg-trays button').nth(1):page.locator('.bg-game [data-point="'+m.to+'"]'));
            actualMoves++;actions.push({kind:'move',move:m});await tick(9);
            if(m.hit&&!sawHit){sawHit=true;await capture(prefix+'-actual-hit');}
        }else{await click(page.locator('.bg-game [data-action]'));await tick(1);actions.push({kind:'confirm-turn'});}
    }
    throw Error('Bounded native match action limit reached');
};
