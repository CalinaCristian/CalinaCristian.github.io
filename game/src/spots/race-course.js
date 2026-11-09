// Deterministic walking-race state. Scene owners supply a researched, physically
// validated closed course; this never steers or moves the player's controller.
export function compileRaceCourse(points) {
    if (!Array.isArray(points) || points.length < 4 || points.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw Error('Invalid race course');
    if (Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1]) > 1e-8) throw Error('Race course must close');
    const pts=points.map(p=>[...p]),cum=[0];
    for(let i=1;i<pts.length;i++)cum.push(cum.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const length=cum.at(-1);if(length<20)throw Error('Race course too short');
    const at=s=>{s=Math.max(0,Math.min(length,s));let i=1;while(i<pts.length-1&&cum[i]<s)i++;const L=cum[i]-cum[i-1],t=L?(s-cum[i-1])/L:0,dx=pts[i][0]-pts[i-1][0],dz=pts[i][1]-pts[i-1][1];return{x:pts[i-1][0]+dx*t,z:pts[i-1][1]+dz*t,tx:dx/(L||1),tz:dz/(L||1)};};
    return {points:pts,cumulative:cum,length,at};
}

export function createRace(course,{opponents=[{name:'Mara',pace:2.7},{name:'Andrei',pace:3.25}],countdown=3,limit=90}={}) {
    let state='ready',elapsed=0,clock=0,progress=0,offCourse=0,last=null,reason=null;
    const rivals=opponents.map((o,i)=>({...o,progress:i*1.1+.8,start:i*1.1+.8,finishTime:null}));
    const checkpoints=Array.from({length:Math.ceil(course.length/14)},(_,i)=>Math.min(course.length,(i+1)*14));checkpoints[checkpoints.length-1]=course.length;
    let checkpoint=0;
    const fail=why=>{state='lost';reason=why;};
    function project(p){
        let best=null;
        for(let i=1;i<course.points.length;i++){
            const a=course.points[i-1],b=course.points[i],L=course.cumulative[i]-course.cumulative[i-1];if(!L||course.cumulative[i]<progress-3||course.cumulative[i-1]>progress+7)continue;
            const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(L*L))),s=course.cumulative[i-1]+t*L,d=Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz);
            if(!best||d<best.distance)best={s,distance:d};
        }
        return best;
    }
    return {
        start(p){if(state!=='ready'||Math.hypot(p.x-course.points[0][0],p.z-course.points[0][1])>2)return false;state='countdown';last={...p};return true;},
        cancel(){if(!['won','lost','cancelled'].includes(state)){state='cancelled';reason='cancelled';}},
        tick(dt,p,{canAdvanceRival=()=>true}={}){
            if(!Number.isFinite(dt)||dt<=0||dt>.101||!Number.isFinite(p.x+p.z))throw Error('Race needs a real bounded physical step');
            if(!['countdown','running'].includes(state))return;
            const moved=Math.hypot(p.x-last.x,p.z-last.z);last={...p};
            if(moved>6*dt+.16){fail('Movement discontinuity');return;}
            if(state==='countdown'){
                clock+=dt;if(Math.hypot(p.x-course.points[0][0],p.z-course.points[0][1])>2){fail('Stay at the start for the countdown');return;}
                if(clock>=countdown)state='running';return;
            }
            elapsed+=dt;
            const near=project(p);
            if(!near||near.distance>1.4){offCourse+=dt;if(offCourse>2)fail('Left the island course');}
            else{
                offCourse=0;
                // Progress cannot increase faster than the actual swept player
                // displacement. Close parallel legs cannot skip checkpoints.
                if(near.s>progress&&near.s-progress<=moved+.12)progress=near.s;
                const target=checkpoints[checkpoint];
                if(target!==undefined&&progress>=target-.6&&Math.hypot(p.x-course.at(target).x,p.z-course.at(target).z)<1.5)checkpoint++;
            }
            for(let i=0;i<rivals.length;i++){
                const r=rivals[i];if(r.finishTime!==null)continue;
                const next=Math.min(course.length,r.progress+dt*r.pace*(1+.035*Math.sin(elapsed*.7+i)));
                if(canAdvanceRival(course.at(next),r,i,next))r.progress=next;
                if(r.progress>=course.length)r.finishTime=elapsed;
            }
            if(checkpoint===checkpoints.length&&progress>=course.length-.6){state=rivals.some(r=>r.finishTime!==null)?'lost':'won';reason=state==='won'?'First across the finish':'Opponent finished first';}
            else if(rivals.every(r=>r.finishTime!==null))fail('Both opponents finished');
            else if(elapsed>=limit)fail('Time limit');
        },
        snapshot(){return{state,elapsed,progress,length:course.length,checkpoint,checkpoints:checkpoints.length,nextCheckpoint:checkpoints[checkpoint]??course.length,offCourse,reason,countdown:Math.max(0,countdown-clock),rivals:rivals.map(r=>({...r,pose:course.at(r.progress)}))};},
    };
}
