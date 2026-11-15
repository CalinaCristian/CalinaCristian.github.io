import * as THREE from '../../../vendor/three.module.min.js';
import { activityFlow } from '../participation.js';
import { createRace } from '../race-course.js';
import { petanqueGame } from '../petanque.js';
import { Crowd } from '../people.js';
import { collide } from '../walker.js';
import { bucActivity } from '../buc.js';

export function createArcActivities(ctx,course,{floor,arch}) {
    const flow=activityFlow(ctx),owner=new THREE.Group();owner.name='arcul-activities';ctx.add(owner);
    const grid=[.8,1.9],positions=[...grid];let returning=false,race=null,session=null;
    const rivals=new Crowd({ground:ctx.ground,city:'bucharest',walkers:0,paths:[],seed:1936,personas:{local_young:1},
        groups:grid.map((s,i)=>{const p=course.at(s);return{x:p.x,z:p.z,r:0,n:1,act:'watch',y:floor,personas:[i?'tourist_it':'local_young'],fixedYaw:true,yaw:Math.atan2(p.tx,p.tz)};})});
    rivals.group.name='arcul-race-opponents';ctx.add(rivals.group);
    for(const p of rivals.peds){p.driven=true;p.pose=null;}
    const previousObstacles=ctx.extras.obstacles;
    ctx.extras.obstacles=()=>[...(previousObstacles?.()||[]),...rivals.peds.map(p=>({x:p.x,z:p.z,y:p.y,fx:Math.sin(p.yaw),fz:Math.cos(p.yaw),length:.34,width:.5,ped:p}))];
    const clearRival=(p,i,player)=>{
        const old=rivals.peds[i],distance=q=>Math.hypot(p.x-q.x,p.z-q.z),prior=q=>Math.hypot(old.x-q.x,old.z-q.z);
        if(player&&distance(player)<.72&&distance(player)<=prior(player))return false;
        if(rivals.peds.some((q,j)=>j!==i&&distance(q)<.62&&distance(q)<=prior(q)))return false;
        const h=ctx.ground.groundAt(p.x,p.z,floor+.4);
        return Number.isFinite(h)&&h<floor+.7&&!collide(session?.spot.colliders||ctx.colliders,p.x,p.z,.28,h+.25);
    };
    const marker=new THREE.Mesh(new THREE.TorusGeometry(.55,.035,5,28),new THREE.MeshBasicMaterial({color:'#61d6ff',transparent:true,opacity:.85,depthWrite:false}));marker.rotation.x=Math.PI/2;marker.name='virtual-race-checkpoint';marker.userData.noFloor=true;marker.visible=false;owner.add(marker);
    const routeGeometry=new THREE.BufferGeometry().setFromPoints(course.points.map(([x,z])=>new THREE.Vector3(x,floor+.035,z)));
    const route=new THREE.Line(routeGeometry,new THREE.LineDashedMaterial({color:'#70dfff',dashSize:.5,gapSize:.4,transparent:true,opacity:.8,depthWrite:false}));
    route.name='virtual-island-race-course';route.userData.noFloor=true;route.computeLineDistances();route.visible=false;owner.add(route);
    function beginRace(s) {
        if(returning){s.ui.toast('The runners are returning','They are walking back to the start. A round of pétanque while you wait?');return;}
        const engine=createRace(course);let awarded=false;
        const began=flow.begin(s,{title:'Race around the Arc',lockWalker:false,action:'Start the race',
            help:'One island lap, two opponents. Follow the blue checkpoint. WASD to walk, hold Shift to run; touch movement works too. Stay off the roundabout.',
            actioned(_s,r){if(engine.snapshot().state==='ready'&&engine.start(s.position)){r.button.hidden=true;s.input?.keys?.clear?.();}},
            update(dt,_s,r){
                if(dt>0)engine.tick(dt,s.position,{canAdvanceRival:(p,_r,i)=>clearRival(p,i,s.position)});
                const q=engine.snapshot();race=engine;
                if(q.state==='ready'){r.status.textContent='Stand beside the runners, then Start. A win earns the race achievement.';return;}
                marker.visible=route.visible=['countdown','running'].includes(q.state);const target=course.at(q.nextCheckpoint);marker.position.set(target.x,floor+.06,target.z);
                r.progress.value=q.progress/q.length;
                r.status.textContent=q.state==='countdown'?`Ready… ${Math.ceil(q.countdown)}`:`${q.elapsed.toFixed(1)}s · checkpoint ${q.checkpoint}/${q.checkpoints} · ${Math.round(q.length-q.progress)}m to finish${q.offCourse?' · Return to the blue course':''}`;
                if(q.state==='won'&&!awarded){awarded=true;marker.visible=route.visible=false;flow.complete();}
                else if(q.state==='lost'){s.ui.toast('The runners won this one',q.reason+'. Follow the island paths back and try again.');flow.cancel('race-lost');}
            },
            complete(){bucActivity(s,'arcul-de-triumf','arcul-race','🏁 First around the Arc',`You beat both runners over ${Math.round(course.length)}m in ${engine.snapshot().elapsed.toFixed(1)}s.`);race=null;returning=true;},
            cancel(){engine.cancel();race=null;marker.visible=route.visible=false;returning=true;},
        });
        if(began){session=s;race=engine;}
    }
    // (owner, 2026-11-15: "the baguette catch is dumb") a round of pétanque on the apron opposite the start (petanque.js)
    const p0=course.at(0),boulesAt=course.at(course.length/2+3);
    const petanque=petanqueGame(ctx,{x:boulesAt.x,z:boulesAt.z,floor,onWin:s=>bucActivity(s,'arcul-de-triumf','arcul-petanque','🎯 Carreau!','Your boule beat Mihai\'s to the jack, a point by Bucharest\'s Paris-style arch.')});
    ctx.interactables.push({x:p0.x,z:p0.z,y:floor,r:2.3,label:'Race the island runners',tourActivityIds:['arcul-race'],use:beginRace},
        {x:boulesAt.x,z:boulesAt.z,y:floor,r:2.3,label:'Play pétanque against Mihai',tourActivityIds:['arcul-petanque'],use:s=>petanque.start(s)});
    ctx.onUpdate((dt,s)=>{
        const q=race?.snapshot();
        if(q){for(let i=0;i<positions.length;i++)positions[i]=q.rivals[i].progress;}
        else if(returning){
            let ready=true;for(let i=0;i<positions.length;i++){
                let delta=((grid[i]-positions[i])%course.length+course.length)%course.length;if(delta>course.length/2)delta-=course.length;
                if(Math.abs(delta)>.001){
                    const next=(positions[i]+Math.sign(delta)*Math.min(Math.abs(delta),dt*2.7)+course.length)%course.length;
                    if(clearRival(course.at(next),i,s.position))positions[i]=next;
                    ready=false;
                }
            }returning=!ready;
        }
        for(let i=0;i<rivals.peds.length;i++){
            const p=rivals.peds[i],at=course.at(positions[i]),oldX=p.x,oldZ=p.z;p.x=at.x;p.z=at.z;p.y=ctx.ground.groundAt(at.x,at.z,floor+.4);
            p.speed=dt?Math.hypot(p.x-oldX,p.z-oldZ)/dt:0;
            if(p.speed>.01)p.tyaw=Math.atan2(p.x-oldX,p.z-oldZ);
            p.yaw+=Math.atan2(Math.sin(p.tyaw-p.yaw),Math.cos(p.tyaw-p.yaw))*Math.min(1,dt*8);p.phase+=dt*p.speed*4.6;
        }
        rivals.update(dt,null,null);
        void s;
    });
    (ctx.extras.sceneCleanups||=[]).push(()=>{race?.cancel();rivals.dispose();rivals.group.removeFromParent();ctx.extras.obstacles=previousObstacles;});
    const api={course,opponents:rivals,get race(){return race?.snapshot()||null;},get petanque(){return petanque;},get returning(){return returning;},get session(){return session;},arch};
    ctx.extras.arcActivities=api;return api;
}
