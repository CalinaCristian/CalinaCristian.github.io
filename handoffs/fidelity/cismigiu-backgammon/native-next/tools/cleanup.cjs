module.exports=async({page,context,save,capture,args})=>{
 const prefix=args.phone?'phone':'desktop',step=n=>page.evaluate(n=>{for(let i=0;i<n;i++)game.spot.update(1/30);},n),rows=[];
 const use=async()=>{if(args.phone)await page.locator('#spot-ui [data-spot-use]').click();else await page.keyboard.press('e');await step(1);await page.waitForSelector('.bg-game');};
 await use();
 for(let i=0;i<25;i++){
  const s=await page.evaluate(()=>game.spot.spot.ctx.extras.backgammon.state());
  if(s.turn===-1&&s.phase!=='opening'){await step(180);continue;}
  if(s.phase==='opening'||s.phase==='roll'){await page.locator('.bg-game [data-action]').click();await step(16);continue;}break;
 }
 const before=await page.evaluate(()=>{const B=game.spot.spot.ctx.extras.backgammon;return{state:B.state(),awards:B.events().filter(e=>e.action==='awarded').length,unlock:game.achievements.isUnlocked('lm-cismigiu-backgammon')};});
 await page.evaluate(async()=>{window.__bgAdvisor=await import('/game/src/spots/backgammon-engine.js');});
 const m=await page.evaluate(()=>__bgAdvisor.chooseTurn(game.spot.spot.ctx.extras.backgammon.state())[0]);
 if(!m)throw Error('Native rolled turn has no legal undo move; retain actual state');
 const move=async()=>{await page.locator('.bg-dice button:enabled').filter({hasText:new RegExp('^'+m.die+'$')}).first().click();await(m.from==='bar'?page.locator('.bg-trays button').first():page.locator('[data-point="'+m.from+'"]')).click();await(m.to==='off'?page.locator('.bg-trays button').nth(1):page.locator('[data-point="'+m.to+'"]')).click();await step(9);};
 await move();await page.locator('.bg-undo').click();
 const undo=await page.evaluate(()=>game.spot.spot.ctx.extras.backgammon.state());if(JSON.stringify(undo)!==JSON.stringify(before.state))throw Error('Native Undo did not restore same rolled state');rows.push({check:'undo',passed:true});
 await move();await page.locator('.bg-game [data-leave]').click();
 const leave=await page.evaluate(()=>({state:game.spot.spot.ctx.extras.backgammon.state(),ctl:game.spot.ctl.active,ui:!!document.querySelector('.bg-game')}));if(JSON.stringify(leave.state)!==JSON.stringify(before.state)||!leave.ctl||leave.ui)throw Error('Native Leave rollback mismatch');rows.push({check:'leave',passed:true});
 await use();await page.keyboard.press('Escape');await page.evaluate(()=>game.updateSpot(1/30));
 const esc=await page.evaluate(()=>({active:game.spot.spot.ctx.extras.participation.active,ctl:game.spot.ctl.active,pause:game.pauseOpen}));if(esc.active||!esc.ctl)throw Error('Native activity Escape failed');rows.push({check:'escape',passed:true,...esc});
 // The second Escape belongs to the host Game, whose update handles pause.
 if(!esc.pause){await page.keyboard.press('Escape');await page.evaluate(()=>game.updateSpot(1/30));}
 await page.waitForSelector('#pause-menu.show');await page.locator('#pause-menu [data-pa="settings"]').click();
 const mute=page.locator('#pause-menu input[data-set="mute"]'),start=await mute.isChecked();await mute.setChecked(!start);const changed=await page.evaluate(()=>game.audio.muted);await mute.setChecked(start);const restored=await page.evaluate(()=>game.audio.muted);if(changed!==!start||restored!==start)throw Error('Native mute toggle failed');rows.push({check:'mute-through-host-pause',passed:true,start,changed,restored});
 await page.locator('#pause-menu [data-pa="resume"]').click();
 const beforeLeave=await page.evaluate(()=>{const S=game.spot,B=S.spot.ctx.extras.backgammon;return{match:B.state(),events:B.events(),memory:{...game.renderer.info.memory},tour:S.tour?{i:S.tour.i,state:S.tour.state,stops:S.tour.stops.map(t=>({kind:t.kind,id:t.id,participated:t.participated}))}:null,population:S.spot.crowd?.peds?.map(p=>({id:p.id,hidden:p.hidden}))};});
 await page.evaluate(()=>{const S=game.spot,O=window.__bgNative,ctx=S.spot.ctx,B=ctx.extras.backgammon;window.__bgWeak={board:new WeakRef(S.spot.scene.getObjectByName('cismigiu-backgammon')),checkers:new WeakRef(B.checkers),elder:new WeakRef(S.spot.scene.getObjectByName('Doru-fictional-park-regular'))};if(O){for(const w of O.wrappers)if(ctx.updaters[w.i]===w.wrapper)ctx.updaters[w.i]=w.fn;document.removeEventListener('click',O.captureClick,true);document.removeEventListener('click',O.finishClick);}delete window.__bgNative;delete window.__bgAdvisor;});
 // Actual public pause/menu action dispatches Main.leaveSpot. No reference clear.
 await page.locator('#pause-btn').click();await page.locator('#pause-menu [data-pa="leave-spot"]').click();
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await cdp.detach();
 const after=await page.evaluate(()=>({state:game.state,spot:!!game.spot,ui:!!document.querySelector('.bg-game'),memory:{...game.renderer.info.memory},refs:Object.fromEntries(Object.entries(__bgWeak).map(([k,w])=>[k,!!w.deref()])),renderer:{sceneNull:game.r3d.scene===null,playerNull:game.r3d.player===null,sourceBackdrops:game.r3d._sourceBackdrops?.length??null},achievement:game.achievements.isUnlocked('lm-cismigiu-backgammon')}));
 const file=save(prefix+'-native-cancel-lifecycle',{scope:'Native actual Undo/Leave/Escape/pause/mute/menu-leave controls; one standard CDP GC, no extra waits/manual reference clears.',rows,before,beforeLeave,after});await capture(prefix+'-returned-to-menu');return{file,rows,after,weakRefsReleased:Object.values(after.refs).every(x=>!x)};
};
