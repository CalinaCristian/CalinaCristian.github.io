module.exports=async({page,context,save,capture,args})=>{
 const prefix=args.phone?'phone':'desktop';
 const before=await page.evaluate(()=>({match:game.spot.spot.ctx.extras.backgammon.state(),events:game.spot.spot.ctx.extras.backgammon.events(),refsPresent:!!window.__bgWeak,renderer:{scene:!!game.r3d.scene,player:!!game.r3d.player},memory:{...game.renderer.info.memory}}));
 await page.keyboard.press('Escape');await page.evaluate(()=>game.updateSpot(1/30));await page.locator('#pause-menu [data-pa="leave-spot"]').click();
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await cdp.detach();
 const after=await page.evaluate(()=>({state:game.state,spot:!!game.spot,ui:!!document.querySelector('.bg-game'),memory:{...game.renderer.info.memory},refs:Object.fromEntries(Object.entries(__bgWeak).map(([k,w])=>[k,!!w.deref()])),renderer:{sceneNull:game.r3d.scene===null,playerNull:game.r3d.player===null,sourceBackdrops:game.r3d._sourceBackdrops?.length??null},achievement:game.achievements.isUnlocked('lm-cismigiu-backgammon')}));
 const file=save(prefix+'-native-menu-release-r2',{scope:'Resumes after preserved observer-only hidden-pause-button timeout. Actual keyboard Escape host update then actual visible Leave tourist spot; one standard CDP GC immediately afterward, no manual host reference clearing.',before,after});await capture(prefix+'-returned-to-menu');return{file,after,weakRefsReleased:Object.values(after.refs).every(x=>!x)};
};
