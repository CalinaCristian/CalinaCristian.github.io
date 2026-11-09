// Read-only native crowd attribution. No pose, RNG, camera or scheduling edits.
import * as THREE from '__BASE__game/vendor/three.module.min.js';
import {Pedestrians} from '__BASE__game/src/traffic.js';
window.peerQA={poses:new Map(),steps:[],separations:[],renders:[],geometry:null};
const state=(C,p)=>({id:p.i,x:p.x,z:p.z,state:p.state,edge:p.e?.id,source:p.e?.access,dir:p.dir,side:p.side,s:p.s,walkOff:p.walkOff,walkGoal:p.walkGoal,passT:p.passT,sepLeft:p.sepLeft,ovT:p.ovT,unpiled:p.unpiled,recovery:!!p.recovery,scale:p.scale,heading:p.heading,live:p.live,hidden:p.hidden,reach:C.reach(p),model:peerQA.poses.get(p.i)});
const originalWrite=Pedestrians.prototype.writeMatrices;
Pedestrians.prototype.writeMatrices=function(dt){
    const C=this;
    if(!this.crowd._peerObserved){
        this.crowd._peerObserved=true;const set=this.crowd.set.bind(this.crowd);
        this.crowd.set=function(i,pose){peerQA.poses.set(i,{...pose});return set(i,pose);};
        const build=this.grid.build.bind(this.grid);this.grid._peerIndexed=new Map(this.list.map(p=>[p.i,{x:p.x,z:p.z}]));
        this.grid.build=function(items){const r=build(items);this._peerIndexed=new Map(items.map(p=>[p.i,{x:p.x,z:p.z}]));return r;};
        const g=this.crowd.object.children[0].geometry;
        peerQA.geometry={positions:Array.from(g.attributes.position.array),parts:Array.from(g.attributes.aPart.array),limbs:Array.from(g.attributes.aLimb.array),indices:Array.from(g.index.array)};
        const original=game.renderer.renderBufferDirect.bind(game.renderer);
        game.renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
            const result=original(camera,scene,geometry,material,object,group);
            if(object===C.crowd.object.children[0]||object===C.crowd.object.children[1]){
                const instances=[];for(let k=0;k<object.count;k++){
                    const m=object.instanceMatrix.array.subarray(k*16,k*16+16),ids=C.list.filter(p=>Math.abs(p.x-m[12])<.0002&&Math.abs(p.z-m[14])<.0002).map(p=>p.i),a=geometry.attributes.aAnim.array.subarray(k*4,k*4+4);
                    instances.push({ids,matrix:Array.from(m),phase:a[0],amp:a[1],flags:a[2],pose:a[3]});
                }
                peerQA.renders.push({time:C.t.time,frame:C._fr,pass:camera===game.camera?'main':camera===game.player.mirrorCam?'mirror':camera===game.r3d.sun.shadow.camera?'sun-shadow':'other',mesh:object.name,instances});
            }return result;
        };
    }
    return originalWrite.call(this,dt);
};
const originalSeparate=Pedestrians.prototype.separate;
Pedestrians.prototype.separate=function(dt){
    const close=[],misses=[];for(const p of this.list){
        if(p.state==='down')continue;const found=new Set();this.grid.query(p.x,p.z,1.1,q=>found.add(q.i));
        for(const q of this.list){if(q.i<=p.i||q.state==='down')continue;const distance=Math.hypot(p.x-q.x,p.z-q.z);if(distance>=CReach(this,p)+CReach(this,q))continue;
            close.push({ids:[p.i,q.i],distance});if(!found.has(q.i))misses.push({a:state(this,p),b:state(this,q),indexed:[this.grid._peerIndexed?.get(p.i),this.grid._peerIndexed?.get(q.i)],cell:this.grid.cell});
        }
    }
    const result=originalSeparate.call(this,dt);peerQA.separations.push({time:this.t.time,frame:this._fr,dt,close,misses});return result;
};
const CReach=(C,p)=>C.reach(p);
function hull(points){const ps=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),out=[];const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=1e-9)out.pop();out.push(p);}const n=out.length;for(let i=ps.length-2;i>=0;i--){const p=ps[i];while(out.length>n&&cross(out.at(-2),out.at(-1),p)<=1e-9)out.pop();out.push(p);}out.pop();return out;}
function section(model,worldY){
    const g=peerQA.geometry,y=(worldY-model.y)/model.scale,points=[];
    for(let k=0;k<g.indices.length;k+=3){const ids=g.indices.slice(k,k+3);if(ids.some(i=>g.parts[i]!==1||g.limbs[i]!==0))continue;
        const vs=ids.map(i=>g.positions.slice(i*3,i*3+3));for(let n=0;n<3;n++){const a=vs[n],b=vs[(n+1)%3];if((a[1]-y)*(b[1]-y)>0||Math.abs(b[1]-a[1])<1e-9)continue;const t=(y-a[1])/(b[1]-a[1]);points.push([a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t]);}
    }
    const co=Math.cos(model.yaw),si=Math.sin(model.yaw);return hull(points).map(([x,z])=>[model.x+model.scale*(co*x+si*z),model.z+model.scale*(-si*x+co*z)]);
}
function sat(a,b){if(a.length<3||b.length<3)return null;let pen=Infinity;for(const poly of[a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dx=q[0]-p[0],dz=q[1]-p[1],n=Math.hypot(dx,dz),ux=-dz/n,uz=dx/n,ap=a.map(v=>v[0]*ux+v[1]*uz),bp=b.map(v=>v[0]*ux+v[1]*uz);pen=Math.min(pen,Math.min(Math.max(...ap),Math.max(...bp))-Math.max(Math.min(...ap),Math.min(...bp)));}return pen;}
function views(model){return ['main','mirror'].map(pass=>{
    const camera=pass==='main'?game.camera:game.player.mirrorCam;camera.updateWorldMatrix(true,false);const cp=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld),s=new THREE.Sphere(new THREE.Vector3(model.x,model.y+.9,model.z),1.2*model.scale+3),distance=cp.distanceTo(s.center),fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));return{pass,distance,eligible:distance<=260&&fr.intersectsSphere(s),lod:distance<45?'near':'far'};
});}
peerQA.sample=function(){
    const C=game.traffic.peds,actors=C.list.map(p=>state(C,p)),pairs=[];
    for(let i=0;i<actors.length;i++)for(let k=i+1;k<actors.length;k++){
        const a=actors[i],b=actors[k],distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance>=Math.max(.6,a.reach+b.reach))continue;
        const ma=a.model,mb=b.model,row={a,b,distance,bodyDiscPenetrationM:.6-distance,carriedDiscPenetrationM:a.reach+b.reach-distance};
        if(ma&&mb&&!ma.down&&!mb.down&&(ma.pose||0)===0&&(mb.pose||0)===0){const lo=Math.max(ma.y+.96*ma.scale,mb.y+.96*mb.scale),hi=Math.min(ma.y+1.46*ma.scale,mb.y+1.46*mb.scale);row.commonTorsoHeightM=hi-lo;if(hi>lo){row.testPlaneY=(lo+hi)/2;row.sections=[section(ma,row.testPlaneY),section(mb,row.testPlaneY)];row.actualTorsoSectionPenetrationM=sat(...row.sections);}else row.actualTorsoSectionPenetrationM=null;}
        row.views=[views(ma),views(mb)];pairs.push(row);
    }
    peerQA.steps.push({time:game.traffic.time,frame:C._fr,scenarioTime:harness.H.scT,actors:actors.length,pairs});
};
