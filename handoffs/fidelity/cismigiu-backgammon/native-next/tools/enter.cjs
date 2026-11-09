module.exports=async({page,save,capture,args})=>{
    const details=page.locator('#spot-select');if(await details.count()&&!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();
    const parks=page.locator('#spot-select .spot-parks');if(await parks.count()&&!await parks.evaluate(el=>el.open))await parks.locator(':scope > summary').click();
    await page.locator('[data-spot="cismigiu"]').first().click();await page.waitForFunction(()=>game.state==='spot'&&game.spot?.spot?.ctx?.extras?.backgammon,null,{timeout:120000});
    const initial=await page.evaluate(()=>{
        const s=game.spot,ctx=s.spot.ctx,B=ctx.extras.backgammon;
        window.__bgNative={startedUtc:new Date().toISOString(),initialPose:{...s.position},route:[],clickCPU:[],updateCPU:[],samples:[],events:[],wrappers:[],clickTimes:new WeakMap()};const O=__bgNative;
        const describe=()=>{const m=B.state();return{phase:m.phase,turn:m.turn,dice:[...m.dice],remaining:[...m.remaining],winner:m.winner};};
        O.captureClick=e=>{if(e.target.closest?.('.bg-game'))O.clickTimes.set(e,{t:performance.now(),before:describe()});};
        O.finishClick=e=>{const q=O.clickTimes.get(e);if(q)O.clickCPU.push({ms:performance.now()-q.t,before:q.before,after:describe(),target:e.target.closest('button')?.textContent});};
        document.addEventListener('click',O.captureClick,true);document.addEventListener('click',O.finishClick);
        for(let i=0;i<ctx.updaters.length;i++){
            const fn=ctx.updaters[i],source=fn.toString();if(!source.includes('animationTime')&&!source.includes('run.opts.update'))continue;
            const wrapper=function(...a){const t=performance.now(),before=describe();try{return fn.apply(this,a);}finally{O.updateCPU.push({i,ms:performance.now()-t,before,after:describe()});}};
            ctx.updaters[i]=wrapper;O.wrappers.push({i,fn,wrapper,source});
        }
        const npcs=s.spot.crowd?.peds||[];return{spot:game.spotId,position:s.position,controller:s.ctl.constructor.name,table:B.table,opponent:B.opponent,source:B.source,match:B.state(),population:npcs.map(p=>({id:p.id,persona:p.persona,x:p.x,y:p.y,z:p.z,act:p.act,hidden:p.hidden})),colliders:ctx.colliders.filter(c=>Math.hypot(c.x-B.table.x,c.z-B.table.z)<5).map(c=>({x:c.x,y:c.y,z:c.z,r:c.r,hw:c.hw,hd:c.hd,angle:c.angle,h:c.h,y0:c.y0,y1:c.y1,prop:c.prop})),updaterObservers:O.wrappers.map(w=>({i:w.i,source:w.source})),tour:s.tour?{state:s.tour.state,i:s.tour.i,stops:s.tour.stops.map(t=>({id:t.id,kind:t.kind,x:t.x,z:t.z,participated:t.participated}))}:null};
    });
    const file=save((args.phone?'phone':'desktop')+'-constructor',initial);await capture((args.phone?'phone':'desktop')+'-public-spawn');return{file,initialPose:initial.position,table:initial.table,source:initial.source,controller:initial.controller,population:initial.population.length,observerCount:initial.updaterObservers.length};
};
