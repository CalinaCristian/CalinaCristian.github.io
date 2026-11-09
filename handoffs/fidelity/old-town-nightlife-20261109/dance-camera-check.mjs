import assert from 'node:assert/strict';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {danceViewFit} from '../../../game/src/spots/dance-camera.js';
const facing=Math.atan2(3.2,.3),slot={x:18.8,y:0,z:56.7},position={x:22,y:2.05,z:57.8},results=[];
for(const [width,height,panel]of[[390,844,{right:374,bottom:380}],[390,844,{right:374,bottom:300}],[844,390,{right:406,bottom:378}],[844,390,{right:406,bottom:295}]]){
    for(const [name,side,spin]of[['stand',0,false],['left',-1,false],['right',1,false],['spin',0,true]]){
        const avatar={x:slot.x+side*.42*Math.cos(facing),y:.03,z:slot.z-side*.42*Math.sin(facing),upper:spin?2.32:1.95},fit=danceViewFit({width,height,panel,position,avatar,target:slot,fov:72}),camera=new THREE.PerspectiveCamera(72,width/height,.1,1000);
        camera.position.set(position.x,fit.positionY,position.z);camera.lookAt(fit.look.x,fit.look.y,fit.look.z);camera.updateMatrixWorld(true);
        assert.equal(fit.limited,false,JSON.stringify({width,height,name,fit}));
        const points=[];for(const x of [-.28,.28])for(const z of [-.22,.22])for(const y of [0,spin?2.2:1.83]){const p=new THREE.Vector3(avatar.x+x,avatar.y+y,avatar.z+z).project(camera);points.push({x:(p.x+1)*width/2,y:(1-p.y)*height/2});}
        assert.ok(points.every(p=>p.x>2&&p.x<width-2&&p.y>2&&p.y<height-12));
        assert.ok(points.every(p=>fit.beside?p.x>panel.right+4:p.y>panel.bottom+4));
        results.push({width,height,pose:name,beside:fit.beside,cameraY:fit.positionY});
    }
}
console.log(JSON.stringify({passed:true,scope:'Actual Three camera projection controls for portrait/landscape and transient notification panels; not native visual acceptance',cases:results},null,2));
