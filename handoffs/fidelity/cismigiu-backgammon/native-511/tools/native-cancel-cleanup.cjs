module.exports=async({page,context,save,capture})=>{
    const step=n=>page.evaluate(n=>{for(let i=0;i<n;i++)game.spot.update(1/30);},n),rows=[];
    await page.keyboard.press('e');await step(1);await page.waitForSelector('.bg-game');
    for(let i=0;i<20;i++){
        const s=await page.evaluate(()=>game.spot.spot.ctx.extras.backgammon.state());if(s.turn===-1&&s.phase!=='opening'){await step(180);continue;}if(s.phase==='opening'||s.phase==='roll'){await page.locator('.bg-game [data-action]').click();await step(16);continue;}break;
    }
    const before=await page.evaluate(()=>{const B=game.spot.spot.ctx.extras.backgammon;return{state:B.state(),awards:B.events().filter(e=>e.action==='awarded').length,unlock:game.achievements.state.unlocked['lm-cismigiu-backgammon']};});
    const m=await page.evaluate(()=>__bgAdvisor.chooseTurn(game.spot.spot.ctx.extras.backgammon.state())[0]);if(!m)throw Error('No legal native move for undo fixture');
    const move=async()=>{await page.locator('.bg-game .bg-dice button:enabled').filter({hasText:new RegExp('^'+m.die+'$')}).first().click();await(m.from==='bar'?page.locator('.bg-trays button').first():page.locator('[data-point="'+m.from+'"]')).click();await(m.to==='off'?page.locator('.bg-trays button').nth(1):page.locator('[data-point="'+m.to+'"]')).click();await step(9);};
    await move();await page.locator('.bg-game .bg-undo').click();
    const undo=await page.evaluate(()=>game.spot.spot.ctx.extras.backgammon.state());if(JSON.stringify(undo)!==JSON.stringify(before.state))throw Error('Native Undo changed original roll');rows.push({check:'undo',passed:true});
    await move();await page.locator('.bg-game [data-leave]').click();
    const leave=await page.evaluate(()=>{const B=game.spot.spot.ctx.extras.backgammon;return{state:B.state(),ctlActive:game.spot.ctl.active,ui:!!document.querySelector('.bg-game'),awards:B.events().filter(e=>e.action==='awarded').length};});if(JSON.stringify(leave.state)!==JSON.stringify(before.state)||!leave.ctlActive||leave.ui||leave.awards!==before.awards)throw Error('Native Leave lifecycle mismatch');rows.push({check:'leave',passed:true});
    await page.keyboard.press('e');await step(1);await page.waitForSelector('.bg-game');await page.keyboard.press('Escape');
    const esc=await page.evaluate(()=>({active:game.spot.spot.ctx.extras.participation.active,ctl:game.spot.ctl.active}));if(esc.active||!esc.ctl)throw Error('Native Escape failed');rows.push({check:'escape',passed:true});
    await page.keyboard.press('Escape');
    const pause=await page.evaluate(()=>({open:game.pauseOpen,buttons:[...document.querySelectorAll('[data-pa]')].filter(b=>b.getClientRects().length).map(b=>({kind:b.dataset.pa,text:b.textContent}))}));
    if(pause.open){const settings=page.locator('[data-pa="settings"]:visible');if(await settings.count())await settings.click();const mute=page.locator('input[data-set="mute"]:visible');if(await mute.count()){const start=await mute.isChecked();await mute.setChecked(!start);const changed=await page.evaluate(()=>game.audio.muted);await mute.setChecked(start);rows.push({check:'native-mute-control',passed:changed===!start});}else rows.push({check:'native-mute-control',passed:false,reason:'Actual settings control unavailable',pause});}
    const facts=await page.evaluate(()=>{const S=game.spot,B=S.spot.ctx.extras.backgammon,O=__bgNative;return{rows:null,beforeLeave:{state:B.state(),events:B.events(),memory:{...game.renderer.info.memory},tour:S.tour?{i:S.tour.i,state:S.tour.state}:null},pageErrors:[],updaters:O.wrappers.map(w=>({i:w.i,source:w.source}))};});
    await page.evaluate(()=>{const S=game.spot,O=__bgNative,ctx=S.spot.ctx,B=ctx.extras.backgammon;window.__bgWeak={board:new WeakRef(S.spot.scene.getObjectByName('cismigiu-backgammon')),checkers:new WeakRef(B.checkers),elder:new WeakRef(S.spot.scene.getObjectByName('Doru-fictional-park-regular'))};for(const w of O.wrappers)if(ctx.updaters[w.i]===w.wrapper)ctx.updaters[w.i]=w.fn;document.removeEventListener('click',O.captureClick,true);document.removeEventListener('click',O.finishClick);delete window.__bgNative;delete window.__bgAdvisor;});
    // Public native lifecycle method (the same method as the menu's Leave).
    await page.evaluate(()=>{if(game.pauseOpen)game.togglePause(false);game.leaveSpot();game.r3d.frame(0);});
    const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await cdp.detach();
    const after=await page.evaluate(()=>({state:game.state,spot:!!game.spot,ui:!!document.querySelector('.bg-game'),memory:{...game.renderer.info.memory},refs:Object.fromEntries(Object.entries(__bgWeak).map(([k,w])=>[k,!!w.deref()])),achievement:game.achievements.isUnlocked('lm-cismigiu-backgammon')}));
    const file=save('desktop-native-cancel-lifecycle',{scope:'Actual public input controls; native leaveSpot lifecycle; one standard CDP garbage collection, no extra waits',rows,before,facts,after});await capture('desktop-returned-to-menu');return{file,rows,after};
};
