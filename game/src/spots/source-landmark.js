import { LANDMARKS, buildLandmark } from '../landmarks.js';
import * as THREE from '../../vendor/three.module.min.js';

/** Uniformly compress source terrain about the actual eye, preserving its ray. */
export function sourceBackdropTransform(anchor, originElevation, scale, eye) {
    return { x: eye.x + (anchor.x - eye.x) * scale,
        y: eye.y * (1 - scale) - originElevation * scale,
        z: eye.z + (anchor.z - eye.z) * scale };
}

/**
 * Mount Rainier seen from Seattle / Bellevue (87 km, sea-spots-b-6): the shared landmark colours put the snow line at
 * 2400 m over dark rock, so from Kerry Park it read as a dark slab with a small cap. Glaciers and the summer snowfield cover
 * the cone from about 1900 m (USGS glacier outlines reach 1500–2000 m on the north and west faces), and at that range the
 * rock takes the haze's blue-grey. A copy of the mesh's vertex colours: white above 1950 m, blended to the rock over 300 m,
 * the rock mixed 45 % towards the haze. The heights (USGS 3DEP) are untouched; the shared landmark is not changed.
 */
function distantSnowcap(mesh){
    const g=mesh.geometry.clone(),P=g.attributes.position,C=g.attributes.color;if(!C)return;
    const snow=new THREE.Color('#f1f4f8'),haze=new THREE.Color('#a7b5c4'),c=new THREE.Color();
    for(let i=0;i<P.count;i++){const y=P.getY(i);c.setRGB(C.getX(i),C.getY(i),C.getZ(i)).lerp(haze,0.45);const k=Math.min(1,Math.max(0,(y-1650)/300));c.lerp(snow,k*k*(3-2*k));C.setXYZ(i,c.r,c.g,c.b);}
    C.needsUpdate=true;mesh.geometry=g;
}

/** Reuse the reviewed USGS landmark terrain at its true angular size. */
export function sourceMountain(ctx, id, { distance = 8000, eyeY = 1.6 } = {}) {
    const lm=LANDMARKS.find(l=>l.id===id),p=ctx.ll(lm.lat,lm.lon),realDistance=Math.hypot(p.x,p.z),k=distance/realDistance;
    const model=buildLandmark(lm,{realScale:true}),group=model.mesh;
    const eye = new THREE.Vector3(0, eyeY, 0);
    const place = () => { const q=sourceBackdropTransform(p,ctx.data.origin.elev,k,eye);group.position.set(q.x,q.y,q.z); };
    group.scale.setScalar(k);place();
    group.traverse(m=>{if(!m.isMesh)return;m.material=m.material.clone();m.material.fog=false;m.castShadow=false;m.receiveShadow=false;m.userData.weatherMountain=true;});
    if(id==='rainier')group.traverse(m=>{if(m.isMesh)distantSnowcap(m);});
    group.userData.sourceLandmark=id;group.userData.realDistanceM=realDistance;
    group.userData.sourceProjection={scale:k,anchor:{...p},originElevationM:ctx.data.origin.elev,basis:'uniform source terrain compression about the current native camera; original mesh vertices retained'};
    // Include the complete source terrain, not only a near strip cut by the
    // street camera's 5 km far plane. The camera domain is the actual terrain
    // rectangle plus the existing scene's highest/lowest modeled level.
    const box=new THREE.Box3().setFromObject(group),t=ctx.data.terrain;
    const sceneBox=ctx.scene?new THREE.Box3().setFromObject(ctx.scene):new THREE.Box3();
    const rawHeights=t?.h||[0],y=Math.max(...rawHeights.map(Math.abs),Number.isFinite(sceneBox.max.y)?Math.abs(sceneBox.max.y):0,Number.isFinite(sceneBox.min.y)?Math.abs(sceneBox.min.y):0,eyeY);
    const cameraDomainRadiusM=t?Math.hypot(Math.max(Math.abs(t.x0),Math.abs(t.x0+(t.nx-1)*t.d)),Math.max(Math.abs(t.z0),Math.abs(t.z0+(t.nz-1)*t.d)),y):Math.abs(eyeY);
    const sourceBoundFarM=box.getCenter(new THREE.Vector3()).length()+box.getSize(new THREE.Vector3()).length()/2+cameraDomainRadiusM;
    ctx.env??={};ctx.env.cameraFarM=Math.max(ctx.env.cameraFarM||0,sourceBoundFarM);
    ctx.env.backdropFarM=Math.max(ctx.env.backdropFarM||0,sourceBoundFarM);
    group.userData.sourceProjection.cameraFarM=sourceBoundFarM;
    group.userData.sourceProjection.cameraDomainRadiusM=cameraDomainRadiusM;
    ctx.onUpdate?.((dt,s)=>{
        if(!s?.camera)return;s.camera.getWorldPosition(eye);place();
        // Same visibility policy as the scene's mountain material fade. Expose
        // effective group visibility to source-aware fog/far-plane culling.
        const w=s.r3d?.weather,vis=w?Math.min(1,(w.visibilityM??20000)/25000)*(1-Math.max(0,((w.cloud??.3)-.6)/.4)):1;
        group.visible=vis>.15;
    });
    return group;
}
