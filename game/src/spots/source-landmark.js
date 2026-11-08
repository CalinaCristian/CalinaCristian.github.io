import { LANDMARKS, buildLandmark } from '../landmarks.js';

/** Reuse the reviewed USGS landmark terrain at its true angular size. */
export function sourceMountain(ctx, id, { distance = 8000, eyeY = 1.6 } = {}) {
    const lm=LANDMARKS.find(l=>l.id===id),p=ctx.ll(lm.lat,lm.lon),realDistance=Math.hypot(p.x,p.z),k=distance/realDistance;
    const model=buildLandmark(lm,{realScale:true}),group=model.mesh;
    group.scale.setScalar(k);group.position.set(p.x*k,eyeY-(ctx.data.origin.elev+eyeY)*k,p.z*k);
    group.traverse(m=>{if(!m.isMesh)return;m.material=m.material.clone();m.material.fog=false;m.castShadow=false;m.receiveShadow=false;m.userData.weatherMountain=true;});
    group.userData.sourceLandmark=id;group.userData.realDistanceM=realDistance;
    return group;
}
