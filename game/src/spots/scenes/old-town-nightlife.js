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
import {freddoRoomDetails} from './freddo-look.js';

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
    b.flat(polygon,floor,'#2c2923','wood');ctx.ground.addPoly(polygon,floor,floor-1,{kind:'freddo-floor'});
    const ceiling=reverse(flatGeometry(polygon,floor+4.2));b.add(ceiling,'freddoCeiling',null,'#151713');ceiling.dispose();
    const wall=reverse(wallGeometry(polygon,floor,floor+4.2,{bay:3,floor:4.2},floor,'#332c22'));b.add(wall,'paint',null,'#332c22');wall.dispose();
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
    const colours=['#ffd38d','#6d8fe1','#ffcf83'];
    const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,2),new THREE.MeshStandardMaterial({color:'#b7afa0',metalness:.95,roughness:.12,flatShading:true}));ball.position.set(10000,floor+3.45,8000);room.add(ball);
    for(let i=0;i<3;i++){const light=new THREE.SpotLight(colours[i],65,15,Math.PI*.34,.75,2);light.position.set(9997+i*3,floor+3.8,8000+(i-1)*2);light.target.position.set(10000+(i-1),floor+.9,8000);room.add(light,light.target);}
    const sign=signAtlas([{x:djX,y:floor+2.5,z:djZ+.6,yaw:0,w:3,h:.65,text:'Freddo',bg:'#24231f',fg:'#f5edda',font:q=>`italic 700 ${q}px Georgia, serif`,border:false}],{name:'freddo-room-sign',night:.7});if(sign)room.add(sign);
    const details=freddoRoomDetails(ctx,b,{building,Q,floor,barX,barZ,djX,djZ,front}),staticRoom=b.build('freddo-room',{castShadow:false,matOverrides:details});room.add(staticRoom);
    const random=rng(713), indoor=makeCrowd({max:54,city:'bucharest',season:'summer',rng:random,castShadow:false}), dancers=[];
    indoor.object.name='freddo-disco-crowd';room.add(indoor.object);
    // Preserve all54 guests while leaving a continuous estimated circulation
    // aisle from the doorway through the dance slot to the bar's public side.
    const aisle=[[22,57],[18.8,56.7],[18.8,59.5],[16,60.8],[12.5,58]],clusters=[[8.2,51.4],[8.6,62],[15.5,51.6],[16,56.8],[21,52.3],[21,61.3],[19,54.2],[15,63]];
    for(let attempt=0;attempt<16000&&dancers.length<54;attempt++){const centre=clusters[attempt%clusters.length],angle=random()*Math.PI*2,radius=.35+Math.sqrt(random())*2.1,x=centre[0]+Math.cos(angle)*radius,z=centre[1]+Math.sin(angle)*radius;
        if(!inPoly(x,z,building.poly) || distPolyline(x,z,[...building.poly,building.poly[0]]).d<.45 ||
            Math.hypot(x-18.8,z-56.7)<1.2 || distPolyline(x,z,aisle).d<1.05 || Math.hypot(x-22,z-57)<1.4 || Math.hypot(x-13,z-49)<1.45 ||dancers.some(p=>Math.hypot(x+dx-p.x,z+dz-p.z)<.86)||
            collide(ctx.colliders,x+dx,z+dz,.3,floor+.2))continue;
        dancers.push({x:x+dx,z:z+dz,phase:random()*Math.PI*2,scale:.92+random()*.13,speed:.82+random()*.35,yaw:Math.atan2(centre[0]-x,centre[1]-z),motion:random()});
    }
    if(dancers.length!==54)throw new Error('Freddo circulation must preserve all54 virtual guests');
    const outfits=[];indoor.count=dancers.length;for(let i=0;i<dancers.length;i++){const outfit=dressFor('bucharest','summer',null,random);outfit.flags=0;outfit.top=['#161b1d','#eee9dd','#aa927a','#394b50','#80554a','#262726','#9b927c'][i%7];outfit.bottom=['#252a2e','#343638','#3a3028'][i%3];outfits.push(outfit);indoor.dress(i,outfit);}
    // A source-aligned street view of the same54 virtual guests and furnishings
    // behind the actual glazed frontage. The portal view is mutually exclusive.
    const frontage=ctx.extras.freddoFrontage,preview=new THREE.Group(),previewGeometries=[];preview.name='freddo-visible-street-interior';ctx.add(preview);
    const previewCrowd=makeCrowd({max:54,city:'bucharest',season:'summer',rng:rng(713),castShadow:false});previewCrowd.count=54;preview.add(previewCrowd.object);outfits.forEach((o,i)=>previewCrowd.dress(i,o));
    if(frontage){const copy=staticRoom.clone(true);copy.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone(),pos=g.attributes.position,kept=[];for(let i=0;i<g.index.count;i+=3){const t=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];let boundary=false;for(let j=0;j<polygon.length;j++){const a=polygon[j],z=polygon[(j+1)%polygon.length],ex=z[0]-a[0],ez=z[1]-a[1],L=Math.hypot(ex,ez);if(t.every(k=>Math.abs((pos.getX(k)-a[0])*ez-(pos.getZ(k)-a[1])*ex)/L<.025)){boundary=true;break;}}if(!boundary)kept.push(...t);}g.setIndex(kept);o.geometry=g;o.userData.shared=true;previewGeometries.push(g);});preview.add(copy);preview.position.set(-dx,frontage.baseY-floor,-dz);
        const warm=new THREE.PointLight('#ffd395',20,14,2);warm.position.set(cx,frontage.baseY+3.1,cz);ctx.add(warm);
    }else preview.visible=false;
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
                const compact=document.body.classList.contains('touch')||s.camera.aspect<.75;
                if(compact){r.ui.querySelector('[data-help]').textContent='Match LEFT, RIGHT or SPIN on a gold pulse.';r.button.textContent='← Left';}
                danceCamera={parent:s.camera.parent,position:s.camera.position.clone(),quaternion:s.camera.quaternion.clone()};ctx.scene.add(s.camera);s.camera.position.set(spawn.x,floor+2.05,spawn.z+.8);s.camera.lookAt(slot.x,floor+(compact?1.4:1),slot.z);
                const nav=r.ui.querySelector('nav');for(const [move,label] of [['right',compact?'Right →':'Right → · D'],['spin',compact?'Spin ↻':'Spin ↻ · Space']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.move=move;button.onclick=()=>attempt(move,r);nav.insertBefore(button,nav.querySelector('[data-leave]'));}
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
            s.ctl.enter(spawn.x,spawn.z,Math.PI/2,spawn.y);s.ui.toast('Freddo · Smârdan 24','DJs, cocktails and a late dance floor. Closing time: 05:00.');s.returnFocus?.();}});
    ctx.interactables.push({hidden:true,x:spawn.x,z:spawn.z,y:floor,r:1.25,label:'Return to Smârdan',cond:visible,use:leave},
        {x:slot.x,z:slot.z,y:floor,r:2,label:()=>nightlifeHours(localHour).party?'Dance with the crowd':'Dancing starts late · come back after 22:00',cond:visible,use:beginDance},
        {x:barX+1.5,z:barZ,y:floor,r:1.7,label:'Pour a shot · Freddo',cond:visible,use:s=>venueActivities.start(s,'shot',{name:'Freddo',address:'Strada Smârdan 24',activity:'freddo-shot'})});
    const previousObstacles=ctx.extras.obstacles;
    ctx.extras.obstacles=()=>[...(previousObstacles?.()||[]),...(room.visible?dancers.map(p=>({x:p.x,z:p.z,y:floor,fx:0,fz:1,width:.6,length:.54})):[])];
    onActivityCancel(ctx,reason=>{stopDance(lastSession);music.pause();if(room.visible && ['mode','teleport'].includes(reason))leave(lastSession);});
    ctx.onUpdate((dt,s)=>{lastSession=s;clockT-=dt;if(clockT<=0){localHour=s._conditions().hour;clockT=1;}
        const hours=nightlifeHours(localHour),blocked=activityBlocked(s),party=hours.party;
        const distance=Math.hypot(s.position.x-entry.x,s.position.z-entry.z),volume=party&&!blocked?(room.visible ? .82 : Math.max(0,1-distance/55)**2*.6):0;music.update(s.sound,volume,room.visible);
        if(room.visible && !hours.open){leave(s);return;}
        preview.visible=!!frontage&&!room.visible;
        ball.rotation.y+=dt*.3;disco.rotation.y=Math.sin(s.t*.18)*.12;
        for(let i=0;i<dancers.length;i++){const p=dancers[i],phase=s.t/CLUB_BEAT*Math.PI*p.speed+p.phase,pose=!party?'talk':p.motion<.16?'cheer':p.motion<.6?'walk':p.motion<.9?'talk':'phone',values={x:p.x+Math.sin(phase)*.035,y:floor+(party&&p.motion<.6?Math.max(0,Math.sin(phase))*.035:0),z:p.z+Math.cos(phase*.7)*.025,yaw:p.yaw+Math.sin(phase*.5)*.12,phase,amp:party&&p.motion<.6 ? .52 : 0,pose,scale:p.scale,prop:p.motion>.9?'phone':null};indoor.set(i,values);previewCrowd.set(i,values);}
        if(!room.visible)return;
        if(Math.hypot(s.position.x-10000,s.position.z-8000)>40){room.visible=false;restoreMap();music.pause();}
    });
    const api={room,entry,spawn,slot,polygon,source:{poi:poi.id,building:building.id},interiorEstimated:true,dancers,music,leave,beginDance,get active(){return dancing||room.visible;},cancel(reason){if(flow.active)flow.cancel(reason);stopDance(lastSession);music.pause();},
        dispose(){if(disposed)return;disposed=true;api.cancel('exit');restoreMap();music.dispose();indoor.dispose();previewCrowd.dispose();previewGeometries.forEach(g=>g.dispose());avatar.dispose();}};
    (ctx.extras.sceneCleanups||=[]).push(api.dispose);ctx.extras.oldTownNightlife=api;
    return api;
}
