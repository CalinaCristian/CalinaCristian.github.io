// Freddo: source building/entrance in the city; a deliberately estimated interior.
// OSM n1416523788 / w657568283 and current official freddo.ro, checked 2026-11-09.
import * as THREE from '../../../vendor/three.module.min.js';
import { makeCrowd, dressFor } from '../../crowd.js';
import { GeoBatch, centroid, inPoly, distPolyline, rng, flatGeometry } from '../kit.js';
import { facadeToward, signAtlas, bucActivity } from '../buc.js';
import { wallGeometry } from '../osm.js';
import { activityFlow, activityBlocked, onActivityCancel } from '../participation.js';
import { clubMusic, CLUB_BEAT } from '../club-music.js';
import { collide } from '../walker.js';

export const OLD_TOWN_FOCUS = [[-12,-104],[286,-104],[286,-32],[62,-32],[62,89],[-12,89]];
export const nightlifeHours = hour => ({ open: hour >= 10 || hour < 5, party: hour >= 22 || hour < 5, closes: '05:00' });

function reverse(geometry) { const index = geometry.index.array; for (let i=0;i<index.length;i+=3) [index[i],index[i+1]]=[index[i+1],index[i]]; geometry.computeVertexNormals(); return geometry; }

export function buildOldTownNightlife(ctx, venueActivities) {
    const poi = ctx.data.pois.find(p => p.id === 'n1416523788'), building = ctx.data.buildings.find(b => b.id === 'w657568283');
    if (!poi || !building || !inPoly(poi.x,poi.z,building.poly)) return null;
    let street = null;
    for (const way of ctx.data.ways.filter(w=>w.name === 'Strada Smârdan')) { const q=distPolyline(poi.x,poi.z,way.pts); if(!street || q.d<street.d) street=q; }
    const front = street && facadeToward(ctx.data,poi.x,poi.z,street.cx,street.cz); if(!front) return null;
    let entry = null;
    for(let distance=2;distance<=7;distance+=.25) { const x=front.x+front.nx*distance,z=front.z+front.nz*distance;
        if(!collide(ctx.colliders,x,z,.5,ctx.ground.heightAt(x,z)+.3)) { entry={x,z,y:ctx.ground.heightAt(x,z)};break; } }
    if(!entry) return null;
    const room = new THREE.Group(); room.name='freddo-estimated-interior'; room.visible=false; ctx.add(room);
    const [cx,cz]=centroid(building.poly), dx=10000-cx,dz=8000-cz, floor=ctx.ground.heightAt(entry.x,entry.z)+.05;
    // An exact translated source footprint, never a claim of a measured internal floor plan.
    const polygon=building.poly.map(([x,z])=>[x+dx,z+dz]), b=new GeoBatch(), Q=(x,z)=>[x+dx,z+dz];
    b.flat(polygon,floor,'#272126','stone');ctx.ground.addPoly(polygon,floor,floor-1,{kind:'freddo-floor'});
    const ceiling=reverse(flatGeometry(polygon,floor+4.2));b.add(ceiling,'paint',null,'#151217');ceiling.dispose();
    const wall=reverse(wallGeometry(polygon,floor,floor+4.2,{bay:3,floor:4.2},floor,'#402533'));b.add(wall,'paint',null,'#402533');wall.dispose();
    for(let i=0;i<polygon.length;i++) { const a=polygon[i],p=polygon[(i+1)%polygon.length];
        ctx.collider({wall:true,ax:a[0],az:a[1],bx:p[0],bz:p[1],x:(a[0]+p[0])/2,z:(a[1]+p[1])/2,r:Math.hypot(a[0]-p[0],a[1]-p[1])/2+.5,y0a:floor-1,y1a:floor+4.2,y0b:floor-1,y1b:floor+4.2,intended:true}); }
    // Furniture layout, lighting and DJ position are explicitly artistic estimates.
    const [barX,barZ]=Q(11,58), [djX,djZ]=Q(13,49);
    b.box(barX,floor,barZ,.8,1.08,6,'#55352e','wood',.25);b.box(barX,floor+1.08,barZ,.92,.08,6.2,'#211c20','stone',.25);
    ctx.box(barX,barZ,.4,3,.25,{prop:true,y0:floor,y1:floor+1.2});
    b.box(djX,floor,djZ,4,1.2,1,'#19191e','plastic');
    for(const x of [-1,1]) {b.cyl(djX+x*.7,floor+1.23,djZ,.28,.03,'#22252e','plastic',16);b.box(djX+x*.27,floor+1.23,djZ,.32,.05,.5,'#414455','metal');}
    for(const [x,z] of [Q(7,52),Q(20,47)]) {b.box(x,floor,z,.75,2.2,.65,'#15171b','plastic');for(const y of [.6,1.5]) b.cyl(x,floor+y,z,.23,.08,'#313238','metal',12);}
    const disco=new THREE.Group();disco.name='freddo-moving-lights';disco.position.set(10000,0,8000);room.add(disco);
    const colours=['#ff459e','#6f74ff','#40dfd6'];
    for(let i=0;i<8;i++) { const a=i*Math.PI/4,px=Math.cos(a)*4,pz=Math.sin(a)*3;
        const strip=new THREE.Mesh(new THREE.BoxGeometry(.07,.09,3.5),new THREE.MeshBasicMaterial({color:colours[i%3],toneMapped:false}));strip.position.set(px,floor+3.65,pz);strip.rotation.y=a;disco.add(strip); }
    const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.43,1),new THREE.MeshStandardMaterial({color:'#9fa6b4',metalness:.9,roughness:.2,flatShading:true}));ball.position.set(10000,floor+3.45,8000);room.add(ball);
    for(let i=0;i<3;i++){const light=new THREE.PointLight(colours[i],23,15,2);light.position.set(9997+i*3,floor+3.2,8000);room.add(light);}
    const sign=signAtlas([{x:djX,y:floor+2.5,z:djZ+.6,yaw:0,w:3,h:.65,text:'FREDDO',bg:'#2f1927',fg:'#ffdfb4',border:false}],{name:'freddo-room-sign',night:.7});if(sign)room.add(sign);
    room.add(b.build('freddo-room',{castShadow:false}));
    const random=rng(713), indoor=makeCrowd({max:54,city:'bucharest',season:'summer',rng:random,castShadow:false}), dancers=[];
    indoor.object.name='freddo-disco-crowd';room.add(indoor.object);
    // A clear doorway, bar approach and player dance slot remain available.
    for(let z=50.5;z<62;z+=1.28)for(let x=9.7;x<21.5;x+=1.22){if(dancers.length>=54 || !inPoly(x,z,building.poly) || Math.hypot(x-18.8,z-56.7)<1.7 || Math.abs(x-11)<1.4 || Math.hypot(x-22,z-57)<2)continue;dancers.push({x:x+dx,z:z+dz,phase:random()*Math.PI*2,scale:.92+random()*.13});}
    indoor.count=dancers.length;for(let i=0;i<dancers.length;i++){const outfit=dressFor('bucharest','summer',null,random);outfit.flags=0;indoor.dress(i,outfit);}
    const flow=activityFlow(ctx), music=clubMusic(), slot={x:18.8+dx,z:56.7+dz,y:floor}, spawn={x:22+dx,z:57+dz,y:floor};
    let lastSession=null,returnPose=null,mapUpdate=null,dancing=false, disposed=false, localHour=23, clockT=0,danceCamera=null;
    const avatar=makeCrowd({max:1,city:'bucharest',season:'summer',rng:rng(604),castShadow:false});avatar.count=1;avatar.object.name='player-dancing-avatar';avatar.object.visible=false;room.add(avatar.object);
    const look=dressFor('bucharest','summer',null,rng(604));look.top='#f1b746';look.bottom='#243d61';look.flags=0;avatar.dress(0,look);
    const stopDance=s=>{dancing=false;avatar.object.visible=false;
        if(danceCamera&&s){danceCamera.parent.add(s.camera);s.camera.position.copy(danceCamera.position);s.camera.quaternion.copy(danceCamera.quaternion);danceCamera=null;}
        if(s?.ctl.rig)s.ctl.rig.rotation.z=0;s?.ctl.place?.();};
    const restoreMap=()=>{if(mapUpdate && lastSession?.map){lastSession.map.update=mapUpdate;mapUpdate=null;}};
    const leave=s=>{s.cancelActivities?.('club-exit');stopDance(s);room.visible=false;restoreMap();music.pause();const p=returnPose||entry;s.ctl.enter(p.x,p.z,p.heading??0,p.y);s.returnFocus?.();};
    const beginDance=s=>{
        if(!room.visible || !nightlifeHours(localHour).party || Math.hypot(s.position.x-slot.x,s.position.z-slot.z)>2.1)return false;
        const sequence=['left','right','left','right','spin','left','right','spin'];
        const attempt=(move,r)=>{if(r.busy)return;const expected=sequence[r.moves],beat=music.beat??r.elapsed/CLUB_BEAT,phase=beat-Math.floor(beat),onBeat=Math.min(phase,1-phase)<.3;
            r.inputs.push({move,expected,beat,onBeat});
            if(move!==expected){r.status.textContent=`Next: ${expected.toUpperCase()} · follow the cue`;return;}
            if(!onBeat){r.status.textContent='Catch the next gold pulse';return;}
            r.busy=true;r.stepT=0;r.move=move;r.status.textContent=`${move==='spin'?'Turn all the way around':move==='left'?'Left foot out, tap, together':'Right foot out, tap, together'}…`;};
        return flow.begin(s,{title:'Find your rhythm',help:'Follow LEFT / RIGHT / SPIN on a gold pulse. A / D / Space, or tap the matching move.',action:'← Left · A / E',cameraRide:true,
            started(_s,r){r.moves=0;r.stepT=0;r.elapsed=0;r.inputs=[];r.sequence=sequence;dancing=true;avatar.object.visible=true;
                avatar.set(0,{x:slot.x,y:floor,z:slot.z,yaw:Math.atan2(spawn.x-slot.x,spawn.z-slot.z),phase:0,amp:0,pose:'stand',scale:1,prop:null});
                danceCamera={parent:s.camera.parent,position:s.camera.position.clone(),quaternion:s.camera.quaternion.clone()};ctx.scene.add(s.camera);s.camera.position.set(spawn.x,floor+2.05,spawn.z+.8);s.camera.lookAt(slot.x,floor+1,slot.z);
                const nav=r.ui.querySelector('nav');for(const [move,label] of [['right','Right → · D'],['spin','Spin ↻ · Space']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.move=move;button.onclick=()=>attempt(move,r);nav.insertBefore(button,nav.querySelector('[data-leave]'));}
                r.status.textContent='Next: LEFT · find the pulse';r.pulse=document.createElement('div');r.pulse.style.cssText='height:7px;border-radius:5px;margin:8px 0;background:#665f4e';r.ui.querySelector('nav').before(r.pulse);},
            actioned(_s,r){attempt('left',r);},
            key(e,r){if(!['KeyA','KeyD','Space'].includes(e.code))return false;if(e.type==='keydown'&&!e.repeat)attempt(e.code==='KeyA'?'left':e.code==='KeyD'?'right':'spin',r);return true;},
            update(dt,_s,r){r.elapsed+=dt;const beat=music.beat??r.elapsed/CLUB_BEAT;r.beatPhase=beat-Math.floor(beat);const onBeat=Math.min(r.beatPhase,1-r.beatPhase)<.3;r.pulse.style.background=onBeat?'#ffd36b':'#665f4e';r.pulse.style.boxShadow=onBeat?'0 0 12px #ffd36b66':'none';
                let t=0,side=0,yaw=Math.atan2(spawn.x-slot.x,spawn.z-slot.z);
                if(r.busy){r.stepT+=dt;t=Math.min(1,r.stepT/(CLUB_BEAT*(r.move==='spin'?4:2)));side=r.move==='left'?-1:r.move==='right'?1:0;if(r.move==='spin')yaw+=Math.PI*2*t;}
                avatar.set(0,{x:slot.x+side*Math.sin(t*Math.PI)*.42,y:floor+Math.max(0,Math.sin(t*Math.PI*4))*.05,z:slot.z+Math.sin(t*Math.PI)*.08,yaw,phase:t*Math.PI*4,amp:r.busy ? .95 : .08,pose:r.move==='spin'&&r.busy?'cheer':'walk',scale:1,prop:null});
                r.progress.value=(r.moves+t)/8;
                for(const button of r.ui.querySelectorAll('[data-move]'))button.disabled=r.busy;
                if(r.busy&&t>=1){r.moves++;r.busy=false;r.status.textContent=`${r.moves}/8 · next: ${(sequence[r.moves]||'finished').toUpperCase()} · gold pulse`;if(r.moves===8)flow.complete();}},
            cancel:stopDance,complete(_s){stopDance(_s);bucActivity(_s,'old-town-lipscani','freddo-dance','🪩 On the dance floor','Eight complete dance moves at Freddo.');}});
    };
    const visible=s=>room.visible && !activityBlocked(s);
    ctx.interactables.push({x:entry.x,z:entry.z,y:entry.y,r:2.1,source:poi.id,building:building.id,tourActivityIds:['freddo-dance','freddo-shot'],tourAvailable:()=>nightlifeHours(localHour).open,
        label:()=>nightlifeHours(localHour).open?'Enter Freddo · dance or pour a shot':'Freddo · opens at 10:00',
        cond:()=>!room.visible,
        use(s){if(!nightlifeHours(localHour).open){s.ui.toast('Freddo is closed','Published opening hours: 10:00–05:00. Try a late evening visit.');return;}lastSession=s;returnPose={...s.position,heading:s.ctl.heading};room.visible=true;
            if(s.map && !mapUpdate){mapUpdate=s.map.update;s.map.update=function(dt,p){return mapUpdate.call(this,dt,room.visible?{...entry,heading:p.heading}:p);};}
            s.ctl.enter(spawn.x,spawn.z,Math.PI/2,spawn.y);s.ui.toast('Freddo · Smârdan 24','Interior layout is an estimate. DJs nightly; published closing time 05:00.');s.returnFocus?.();}});
    ctx.interactables.push({hidden:true,x:spawn.x,z:spawn.z,y:floor,r:1.25,label:'Return to Smârdan',cond:visible,use:leave},
        {x:slot.x,z:slot.z,y:floor,r:2,label:()=>nightlifeHours(localHour).party?'Dance with the crowd':'Dancing starts late · come back after 22:00',cond:visible,use:beginDance},
        {x:barX+1.5,z:barZ,y:floor,r:1.7,label:'Pour a shot · Freddo',cond:visible,use:s=>venueActivities.start(s,'shot',{name:'Freddo',address:'Strada Smârdan 24',activity:'freddo-shot'})});
    const previousObstacles=ctx.extras.obstacles;
    ctx.extras.obstacles=()=>[...(previousObstacles?.()||[]),...(room.visible?dancers.map(p=>({x:p.x,z:p.z,y:floor,fx:0,fz:1,width:.44,length:.44})):[])];
    onActivityCancel(ctx,reason=>{stopDance(lastSession);music.pause();if(room.visible && ['mode','teleport'].includes(reason))leave(lastSession);});
    ctx.onUpdate((dt,s)=>{lastSession=s;clockT-=dt;if(clockT<=0){localHour=s._conditions().hour;clockT=1;}
        const hours=nightlifeHours(localHour),blocked=activityBlocked(s),party=hours.party;
        const distance=Math.hypot(s.position.x-entry.x,s.position.z-entry.z),volume=party&&!blocked?(room.visible ? .82 : Math.max(0,1-distance/55)**2*.6):0;music.update(s.sound,volume,room.visible);
        if(room.visible && !hours.open){leave(s);return;}
        if(!room.visible)return;
        ball.rotation.y+=dt*.3;disco.rotation.y=Math.sin(s.t*.18)*.12;
        for(let i=0;i<dancers.length;i++){const p=dancers[i],beat=s.t/CLUB_BEAT,phase=beat*Math.PI+p.phase;indoor.set(i,{x:p.x+Math.sin(phase)*.065,y:floor+(party?Math.max(0,Math.sin(phase))*.055:0),z:p.z,yaw:Math.PI+.3*Math.sin(phase*.5),phase,amp:party ? .6 : 0,pose:party?(i%3?'cheer':'talk'):'talk',scale:p.scale,prop:null});}
        if(Math.hypot(s.position.x-10000,s.position.z-8000)>40){room.visible=false;restoreMap();music.pause();}
    });
    const api={room,entry,spawn,slot,polygon,source:{poi:poi.id,building:building.id},interiorEstimated:true,dancers,music,leave,beginDance,get active(){return dancing||room.visible;},cancel(reason){if(flow.active)flow.cancel(reason);stopDance(lastSession);music.pause();},
        dispose(){if(disposed)return;disposed=true;api.cancel('exit');restoreMap();music.dispose();indoor.dispose();avatar.dispose();}};
    (ctx.extras.sceneCleanups||=[]).push(api.dispose);ctx.extras.oldTownNightlife=api;
    return api;
}
