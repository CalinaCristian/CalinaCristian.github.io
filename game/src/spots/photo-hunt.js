import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';

// A visitor camera exercise from the public approach. The rings are game
// guides, not new site fixtures, and no interior access is implied.
export function photoHunt(ctx, { x, z, title, targets, unavailable, onDone }) {
    const flow = activityFlow(ctx), points = [];
    for (let i=0;i<48;i++) { const a=i*Math.PI/24; points.push(new THREE.Vector3(Math.cos(a),Math.sin(a),0)); }
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: .85, depthTest:false, depthWrite:false }));
    ring.renderOrder=999;
    ring.name='visitor-photo-guide';ring.userData.noFloor=true;ring.visible=false;ctx.add(ring);
    const dir=new THREE.Vector3(),toward=new THREE.Vector3();
    const guide = { targets, captures: [], ring };
    ctx.extras.photoHunt=guide;
    ctx.interactables.push({ kind:'photo-hunt',x,z,r:3,label:title,use:s=>flow.begin(s,{
        title,action:'Frame the detail',lockWalker:false,
        help:`${unavailable} Try this outdoor camera challenge: look with the mouse or swipe, centre the gold ring, then take each of three pictures.`,
        started(s,r){r.step=0;r.flash=0;guide.captures=[];r.busy=true;ring.visible=true;},
        update(dt,s,r){
            const target=targets[r.step];if(!target)return;
            ring.position.set(target.x,target.y,target.z);ring.quaternion.copy(s.camera.getWorldQuaternion(new THREE.Quaternion()));
            ring.scale.setScalar((target.radius||2)*(1+.055*Math.sin(s.t*4)));
            s.camera.getWorldPosition(toward);toward.set(target.x-toward.x,target.y-toward.y,target.z-toward.z);const distance=toward.length();toward.normalize();s.camera.getWorldDirection(dir);
            const dot=dir.dot(toward),ready=dot>Math.cos(7*Math.PI/180)&&distance>3&&distance<(target.maxDistance||260);
            r.busy=!ready||r.flash>0;r.button.textContent=ready?'Take the picture':'Centre the gold ring';r.status.textContent=`${r.step+1}/3 · ${target.label}`;r.progress.value=(r.step+Math.max(0,(dot-.8)/.2)*.85)/targets.length;
            ring.material.color.set(ready?'#9bffbe':'#fbbf24');
            if(r.flash>0){r.flash=Math.max(0,r.flash-dt);ring.material.opacity=.3+.55*(1-r.flash/.35);}
        },
        actioned(s,r){
            if(r.busy)return;
            guide.captures.push({label:targets[r.step].label,position:{...s.position}});r.step++;if(s.host.audio?.shutter)s.host.audio.shutter();else s.sound.play('chime',.2);r.ui.animate?.([{filter:'brightness(2.8)'},{filter:'brightness(1)'}],{duration:350});
            if(r.step===targets.length){flow.complete();return;}r.flash=.35;r.busy=true;
        },
        cancel(){ring.visible=false;guide.captures=[];},
        complete(s){ring.visible=false;onDone(s);},
    })});
    return guide;
}
