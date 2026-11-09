module.exports=async({page,save,capture,args})=>{
 const facts=await page.evaluate(()=>{
  const read=()=>({state:game.state,bodyMode:document.body.dataset.mode,uiModal:document.body.classList.contains('ui-modal'),controlsModal:game._controlsModal,miniVisible:!!document.querySelector('#spot-ui .sp-mini')?.getClientRects().length,miniInert:document.querySelector('#spot-ui .sp-mini')?.inert,spotUseVisible:!!document.querySelector('[data-spot-use]')?.getClientRects().length});
  const before=read();Object.getPrototypeOf(game).loop.call(game);const after=read();
  const S=game.spot,O=window.__bgNative,ctx=S.spot.ctx;
  if(O){for(const w of O.wrappers)if(ctx.updaters[w.i]===w.wrapper)ctx.updaters[w.i]=w.fn;document.removeEventListener('click',O.captureClick,true);document.removeEventListener('click',O.finishClick);}delete window.__bgNative;
  return{before,after,observedWrappersRemoved:O?.wrappers.length||0,scope:'Actual existing prototype Game.loop handles native mode/modal/update/render after intentionally stopped RAF. No body class/actor/source override. Observer instrumentation removed before phone match/memory check.'};
 });
 const file=save((args.phone?'phone':'desktop')+'-native-host-sync',facts);await capture((args.phone?'phone':'desktop')+'-actual-host-controls');return{file,...facts};
};
