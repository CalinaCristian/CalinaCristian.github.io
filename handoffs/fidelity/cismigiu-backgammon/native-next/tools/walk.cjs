module.exports=async({page,save,capture,args})=>{
    const plan=await page.evaluate(()=>{const s=game.spot,b=s.spot.ctx.interactables.find(i=>i.kind==='backgammon'),p=s.position,path=s._navPath(p.x,p.z,b.x,b.z,{radius:1.2,maxLength:500});return{start:p,target:{x:b.x,z:b.z,r:b.r,source:b.source},path};});
    if(!plan.path?.length)return{passed:false,reason:'Native walking path unavailable',plan};
    const records=[],dt=1/30;let travelled=0,last=plan.start,blocked=0,steps=0;
    const press=async(key,n)=>{await page.keyboard.down(key);const r=await page.evaluate(({n,dt})=>{const s=game.spot,before={...s.position};let maxJump=0,p=before;const times=[];for(let i=0;i<n;i++){const t=performance.now();s.update(dt);times.push(performance.now()-t);const q=s.position;maxJump=Math.max(maxJump,Math.hypot(q.x-p.x,q.z-p.z));p={...q};}return{before,after:s.position,maxJump,ms:times};},{n,dt});await page.keyboard.up(key);steps+=n;travelled+=Math.hypot(r.after.x-last.x,r.after.z-last.z);last=r.after;records.push({key,n,...r});return r;};
    try{
        for(const target of plan.path.slice(1)){
            const maxAttempts=100+Math.ceil(Math.hypot(target[0]-last.x,target[1]-last.z)/(1.7*dt*24))*2;
            for(let attempt=0;attempt<maxAttempts;attempt++){
                const state=await page.evaluate(({target,tgt})=>{const s=game.spot,p=s.position,dx=target[0]-p.x,dz=target[1]-p.z,h=Math.atan2(-dx,-dz),err=Math.atan2(Math.sin(h-s.ctl.heading),Math.cos(h-s.ctl.heading));return{p,d:Math.hypot(dx,dz),err,arrived:Math.hypot(p.x-tgt.x,p.z-tgt.z)<1.65};},{target,tgt:plan.target});
                if(state.arrived){const result={passed:true,scope:'Continuous native-input approach segment. Original constructor pose and prior chunk retained separately; no pose/auto/source writes.',plan,records,travelledM:travelled,steps,simSeconds:steps*dt,finalPose:state.p},file=save(args.phone?'phone-public-approach':'desktop-public-approach',result);await capture(args.phone?'phone-table-approach':'desktop-table-approach');return{passed:true,file,travelledM:travelled,steps,simSeconds:steps*dt,finalPose:state.p,pathVertices:plan.path.length};}
                if(state.d<.6)break;
                if(Math.abs(state.err)>.045){await press(state.err>0?'ArrowLeft':'ArrowRight',Math.max(1,Math.min(45,Math.round(Math.abs(state.err)/(1.9*dt)))));continue;}
                const n=Math.max(1,Math.min(24,Math.floor((state.d-.4)/(1.7*dt)))),r=await press('w',n),moved=Math.hypot(r.after.x-r.before.x,r.after.z-r.before.z);
                if(r.maxJump>1.5)throw Error('Native walker jumped/reset; preserve route failure');
                blocked=moved<.015?blocked+1:0;if(blocked>8)throw Error('Native body blocked along actual returned path');
                if(travelled>550||steps*dt>500)throw Error('Bounded public approach exceeded');
            }
        }
        const result={passed:false,reason:'Path ended outside actual interaction radius',plan,records,travelledM:travelled,steps,finalPose:last},file=save(args.phone?'phone-public-approach-failed':'desktop-public-approach-failed',result);return{passed:false,reason:result.reason,file,finalPose:last};
    }catch(e){const result={passed:false,reason:String(e),plan,records,travelledM:travelled,steps,finalPose:last},file=save(args.phone?'phone-public-approach-failed':'desktop-public-approach-failed',result);await capture(args.phone?'phone-approach-failed':'desktop-approach-failed');return{passed:false,reason:result.reason,file,finalPose:last,travelledM:travelled,steps};}
    finally{for(const k of ['w','ArrowLeft','ArrowRight'])await page.keyboard.up(k);}
};
