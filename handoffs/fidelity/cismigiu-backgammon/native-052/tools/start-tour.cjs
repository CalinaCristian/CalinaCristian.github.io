module.exports=async({page,save,capture,args})=>{
 const prefix=args.phone?'phone':'desktop';await page.locator('#spot-ui .sp-mini').click();await page.locator('#spot-ui [data-tour]').click();await page.evaluate(()=>game.spot.update(1/30));
 const facts=await page.evaluate(()=>{const S=game.spot;return{position:S.position,guide:S.guide?{x:S.guide.x,z:S.guide.z}:null,tour:S.tour?{state:S.tour.state,i:S.tour.i,walked:S.tour.walked,stops:S.tour.stops.map(t=>({kind:t.kind,id:t.id,x:t.x,z:t.z,label:t.label,participated:t.participated}))}:null};});
 const file=save(prefix+'-actual-public-tour',facts);await capture(prefix+'-public-tour-start');return{file,...facts};
};
