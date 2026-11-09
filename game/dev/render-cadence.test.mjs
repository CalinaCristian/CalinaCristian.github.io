import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {Renderer3D} from '../src/render.js';

// Execute the real frame orchestration and Auto method. Only GPU work is a
// no-op: these controls establish diagnostic timing, never native GPU speed.
function host(auto=false){
    const r=Object.create(Renderer3D.prototype),effects=[],adapt=[];
    Object.assign(r,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),time:0,clock:null,_wx:null,player:null,
        _lastNow:null,_lastStatsNow:null,_fpsAcc:0,_fpsN:0,stats:{fps:0,frameMs:0},
        _tmp:{cam:new THREE.Vector3(),vel:new THREE.Vector3()},sky:{position:new THREE.Vector3(),material:{uniforms:{uTime:{value:0}}}},
        finalPass:{uniforms:{uTime:{value:0}}},sun:{shadow:{}},tier:{post:'full'},composer:{render:dt=>effects.push(dt)},
        cockpitDisplays:{begin(){},render(){},stats:{}},_renderer:{info:{render:{calls:17,triangles:123},reset(){}}},
        auto,_settle:20,_ema:16.7,_dts:[],_slowT:0,_fastT:0,_block:{},_backoff:{},level:1});
    for(const name of['_stepEnvJob','_stepEnvFade','_updateNight','_updateSun','_updateLamps','_updateWeather','_updateWindshield','_fogCull'])r[name]=()=>{};
    r._adapt=dt=>{adapt.push(dt);Renderer3D.prototype._adapt.call(r,dt);};
    return{r,effects,adapt};
}
test('foreground stalls measure actual cadence while the existing effects clamp stays unchanged',t=>{
    let now=100;t.mock.method(performance,'now',()=>now);
    const{r,effects,adapt}=host();r.frame();assert.equal(r.stats.fps,0);
    now+=1000;r.frame();assert.equal(r.stats.fps,1);assert.equal(r.stats.frameMs,1000);
    now+=15000;r.frame();assert.equal(r.stats.fps,.07);assert.equal(r.stats.frameMs,15000);
    assert.deepEqual(effects,[1/60,.1,.1]);assert.deepEqual(adapt,effects);
    assert.equal(r.stats.drawCalls,17);assert.equal(r.stats.triangles,123);
});
test('explicit simulation dt cannot turn a slow frame into60fps or a false100ms diagnostic',t=>{
    let now=100;t.mock.method(performance,'now',()=>now);const{r,effects,adapt}=host(true);
    r.frame(1/60);now+=200;r.frame(1/60);assert.equal(r.stats.fps,0);
    now+=1800;r.frame(1/60);assert.equal(r.stats.fps,1);assert.equal(r.stats.frameMs,1800);
    assert.deepEqual(effects,[1/60,1/60,1/60]);assert.deepEqual(adapt,effects);
    assert.equal(r._ema,16.7,'timing diagnostics do not feed a changed dt into Auto');
    assert.equal(r.level,1,'no preset downgrade is introduced');
});
test('visible60Hz intervals remain60fps and hidden-tab gaps are not foreground samples',t=>{
    let now=100;t.mock.method(performance,'now',()=>now);
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),doc={visibilityState:'visible'};
    Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
    t.after(()=>descriptor?Object.defineProperty(globalThis,'document',descriptor):delete globalThis.document);
    const{r}=host();r.frame();for(let i=0;i<32;i++){now+=1000/60;r.frame();}
    assert.equal(r.stats.fps,60);assert.equal(r.stats.frameMs,16.7);
    doc.visibilityState='hidden';now+=60000;r.frame();assert.equal(r.stats.fps,0);assert.equal(r.stats.frameMs,0);
    doc.visibilityState='visible';now+=60000;r.frame();assert.equal(r.stats.fps,0);assert.equal(r.stats.frameMs,0);
    now+=1000;r.frame();assert.equal(r.stats.fps,1);assert.equal(r.stats.frameMs,1000);
    const before={...r.stats};r.scene=null;now+=5000;r.frame();assert.deepEqual(r.stats,before,'no-scene calls are not render samples');
});
test('environment-only portal update does not draw, simulate actors or rewrite the off-axis projection',()=>{
    const{r,effects,adapt}=host(),sourceCamera=new THREE.PerspectiveCamera();sourceCamera.position.set(123,24,-80);
    sourceCamera.projectionMatrix.elements[8]=.25;const projection=sourceCamera.projectionMatrix.toArray();
    let weather=0,windshield=0,culls=0,lighting=0;
    r._updateWeather=(dt,position,velocity)=>{weather++;assert.equal(dt,.05);assert.deepEqual(position.toArray(),[123,24,-80]);assert.deepEqual(velocity.toArray(),[0,0,0]);};
    r._updateWindshield=()=>windshield++;r._fogCull=()=>culls++;
    r.clock={};r._envT=1;r._envEl=0;r.sunElevation=0;r._applyLighting=()=>lighting++;
    const actor={speed:18,fx:1,fz:0,update(){throw Error('No actor simulation in environment adapter');}};r.player=actor;
    assert.equal(r.advanceEnvironment(.05,{camera:sourceCamera,cockpit:false,cull:false}),true);
    assert.equal(weather,1);assert.equal(lighting,1);assert.equal(windshield,0);assert.equal(culls,0);
    assert.deepEqual(sourceCamera.projectionMatrix.toArray(),projection);assert.equal(r.time,.05);
    assert.deepEqual(r.stats,{fps:0,frameMs:0});assert.equal(r._lastStatsNow,null);assert.equal(r.player,actor);
    assert.deepEqual(effects,[]);assert.deepEqual(adapt,[]);assert.equal(r.camera.position.x,0);
    r.scene=null;assert.equal(r.advanceEnvironment(.05),false);
});
test('pure weather far-limit query preserves a caller-owned off-axis frustum',()=>{
    const{r}=host(),camera=new THREE.PerspectiveCamera();camera.projectionMatrix.elements[8]=.31;
    r.scene.fog=new THREE.FogExp2('#888888',.01);const before=camera.projectionMatrix.toArray();
    assert.equal(r.visibilityFar(5000),530);assert.deepEqual(camera.projectionMatrix.toArray(),before);
    const backdrop=new THREE.Object3D();backdrop.userData.sourceProjection={cameraFarM:1000};r._sourceBackdrops=[backdrop];
    assert.equal(r.visibilityFar(5000),1000);backdrop.visible=false;assert.equal(r.visibilityFar(5000),530);
    r.scene.fog.density=1;assert.equal(r.visibilityFar(5000),220);r.scene.fog=null;assert.equal(r.visibilityFar(5000),5000);
    assert.equal(r._farBase,undefined);assert.equal(r._farSet,undefined);
});
