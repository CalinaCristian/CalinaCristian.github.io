import * as THREE from '../../vendor/three.module.min.js';
import { activityFlow } from './participation.js';
import { inPoly, distPolyline } from './kit.js';

// A visitor camera exercise from the public approach. The rings are game
// guides, not new site fixtures, and no interior access is implied.
export function photoHunt(ctx, { x, z, y, r = 3, spot, cond, title, targets, unavailable = '', onDone }) {
    const flow = activityFlow(ctx), points = [];
    for (let i=0;i<48;i++) { const a=i*Math.PI/24; points.push(new THREE.Vector3(Math.cos(a),Math.sin(a),0)); }
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: .85, depthTest:false, depthWrite:false }));
    ring.renderOrder=999;
    ring.name='visitor-photo-guide';ring.userData.noFloor=true;ring.visible=false;ctx.add(ring);
    const dir=new THREE.Vector3(),toward=new THREE.Vector3(),origin=new THREE.Vector3(),ray=new THREE.Raycaster();
    let occluders=[];
    const opaque = m => m && m.depthTest!==false && !(m.transparent&&m.opacity<.95);
    const visible = object => { for(let p=object;p;p=p.parent)if(!p.visible)return false;return true; };
    const sight = (s,target) => {
        const started=performance.now();
        s.camera.getWorldPosition(origin);toward.set(target.x-origin.x,target.y-origin.y,target.z-origin.z);
        const distance=toward.length(),tolerance=target.surfaceTolerance??Math.max(.8,(target.radius||2)*1.5);
        ray.set(origin,toward.normalize());ray.near=.08;ray.far=Math.max(.08,distance-tolerance);
        ctx.scene.updateMatrixWorld(true);
        const hit=ray.intersectObjects(occluders.filter(visible),false).find(h=>{
            const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;if(!opaque(material))return false;
            const g=s.guide;if(!g)return true;let crowd=false;for(let p=h.object;p;p=p.parent)if(p.name==='crowd')crowd=true;
            return !(crowd&&Math.hypot(h.point.x-g.x,h.point.z-g.z)<.9&&h.point.y>=g.y-.1&&h.point.y<=g.y+3.4);
        });
        const surface=target.surface,p=hit?.point;
        let featureHit=false;for(let o=hit?.object;o;o=o.parent)if(target.featureName&&o.name===target.featureName)featureHit=true;
        const onFeature=featureHit||!!(p&&surface&&p.y>=surface.bottom&&p.y<=surface.top&&!surface.holes?.some(h=>inPoly(p.x,p.z,h))&&(inPoly(p.x,p.z,surface.poly)||distPolyline(p.x,p.z,[...surface.poly,surface.poly[0]]).d<.15));
        guide.visibility={label:target.label,clear:!hit||onFeature,targetDistance:distance,surfaceTolerance:tolerance,hitDistance:hit?.distance??null,hitPoint:p?.toArray()||null,sourceSurface:onFeature?(surface?.source||target.featureName):null,blocker:hit?.object.name||null,raycastMs:performance.now()-started,meshCount:occluders.length};
        return !hit||onFeature;
    };
    const guide = { targets, captures: [], ring };
    ctx.extras.photoHunt=guide;
    const available=s=>(!spot||s.spot.entry.id===spot)&&(!cond||cond(s));
    ctx.interactables.push({ kind:'photo-hunt',x,z,y,r,label:title,cond:available,use:s=>available(s)&&flow.begin(s,{
        title,action:'Frame the detail',lockWalker:false,
        help:`${unavailable} Move along the public paths for a clear view, look with the mouse or swipe, centre the gold ring, then take each of ${targets.length} pictures.`,
        started(s,r){r.step=0;r.flash=0;r.sightAt=-Infinity;guide.captures=[];r.busy=true;ring.visible=true;occluders=[];ctx.scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(['visitor-photo-guide','visitor-candle','virtual-handheld-candle-holder','activity-coin'].includes(p.name))return;const materials=Array.isArray(o.material)?o.material:[o.material];if(!materials.some(opaque))return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();occluders.push(o);});},
        update(dt,s,r){
            if(!available(s)){flow.cancel('entry');return;}
            const target=targets[r.step];if(!target)return;
            ring.position.set(target.x,target.y,target.z);ring.quaternion.copy(s.camera.getWorldQuaternion(new THREE.Quaternion()));
            ring.scale.setScalar((target.radius||2)*(1+.055*Math.sin(s.t*4)));
            s.camera.getWorldPosition(toward);toward.set(target.x-toward.x,target.y-toward.y,target.z-toward.z);const distance=toward.length();toward.normalize();s.camera.getWorldDirection(dir);
            const dot=dir.dot(toward),aligned=dot>Math.cos(7*Math.PI/180)&&distance>(target.minDistance??3)&&distance<(target.maxDistance||260);
            if(aligned&&(s.t-r.sightAt>.15||r.sightStep!==r.step)){r.clear=sight(s,target);r.sightAt=s.t;r.sightStep=r.step;}
            const permitted=!target.available||target.available(s);
            r.hold=aligned&&r.clear&&permitted?(r.hold||0)+dt:0;
            const ready=aligned&&r.clear&&permitted&&r.hold>=(target.holdSeconds||0);
            r.busy=!ready||r.flash>0;r.button.textContent=ready?'Take the picture':!permitted?(target.waitHint||'Wait for the view'):aligned&&r.clear?'Hold the frame steady':aligned?'Move for a clear view':'Centre the gold ring';r.status.textContent=`${r.step+1}/${targets.length} · ${target.label}`;r.progress.value=(r.step+Math.max(0,(dot-.8)/.2)*.85)/targets.length;
            ring.material.color.set(ready?'#9bffbe':'#fbbf24');
            if(r.flash>0){r.flash=Math.max(0,r.flash-dt);ring.material.opacity=.3+.55*(1-r.flash/.35);}
        },
        actioned(s,r){
            if(r.busy||!available(s)||(targets[r.step].available&&!targets[r.step].available(s))||!sight(s,targets[r.step])){r.busy=true;return;}
            guide.captures.push({label:targets[r.step].label,position:{...s.position}});r.step++;r.hold=0;if(s.host.audio?.shutter)s.host.audio.shutter();else s.sound.play('chime',.2);r.ui.animate?.([{filter:'brightness(2.8)'},{filter:'brightness(1)'}],{duration:350});
            if(r.step===targets.length){flow.complete();return;}r.flash=.35;r.busy=true;
        },
        cancel(){ring.visible=false;guide.captures=[];},
        complete(s){ring.visible=false;onDone(s);},
    })});
    return guide;
}
