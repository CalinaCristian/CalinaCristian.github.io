import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {makeVehicle} from '../src/vehicles.js';
import {initialTrafficStaticClearance} from '../src/initial-traffic-admission.js';
import {separatedVehicleStaticProjection} from '../src/vehicle-static-projection.js';

const F=JSON.parse(fs.readFileSync(new URL('./fixtures/basarab-tram-static-cover.json',import.meta.url)));
for(const row of F.rows){
    const mesh=makeVehicle(row.kind,'#fff',{instanced:true,city:'bucharest'});mesh.scale.fromArray(row.scale);mesh.rotation.set(row.pose.pitch,row.pose.heading,row.pose.roll||0,'YXZ');
    const body={...row.pose,id:row.id,length:row.length,width:row.width,mesh,edge:{rail:true}},before=JSON.stringify(row.objects);
    assert.equal(row.original.valid,false,'fixture retains the original native cover-contact failure');
    for(const c of row.objects){
        const proof=separatedVehicleStaticProjection(body,c);assert(proof?.separated,'complete native body is clear of recorded '+c.kind+' #'+row.id);assert(proof.gapM>.01);
        const r=initialTrafficStaticClearance({buildings:[c]},body);assert.equal(r.valid,true);assert.equal(r.separatedCoverContacts,1,'a conservative cover hit needs its complete-body proof');
        assert.equal(initialTrafficStaticClearance({buildings:[c]},{...body,edge:{rail:false}}).valid,false,'ordinary actor admission retains its previous rule');
        if(c.wall){
            const unknown={...c};delete unknown.renderHalfWidthM;assert.equal(separatedVehicleStaticProjection(body,unknown),null);assert.equal(initialTrafficStaticClearance({buildings:[unknown]},body).valid,false,'unknown rendered wall width keeps the contact');
        }else{
            const occupied={...c,x:body.x,z:body.z};assert.equal(separatedVehicleStaticProjection(body,occupied).separated,false);assert.equal(initialTrafficStaticClearance({buildings:[occupied]},body).valid,false,'a real static contact inside the collision body is never waived');
        }
    }
    assert.equal(JSON.stringify(row.objects),before,'no prop/tree/wall is moved, resized or removed');
    const c=row.objects[0];assert.equal(separatedVehicleStaticProjection({...body,mesh:null},c),null,'missing emitted model is conservative');
    const extraMesh=makeVehicle(row.kind,'#fff',{instanced:true,city:'bucharest'});extraMesh.userData._extras=[{}];assert.equal(separatedVehicleStaticProjection({...body,mesh:extraMesh},c),null,'unsupported additional model geometry cannot grant separation');
    const parent=new THREE.Group();parent.position.x=1;parent.add(mesh);assert.equal(separatedVehicleStaticProjection(body,c),null,'unknown parent transform cannot grant separation');parent.remove(mesh);
}

const block=new THREE.Group();block.userData._model={geo:new THREE.BoxGeometry(2,2,4)};
const blockBody={x:0,y:.24,z:0,heading:0,pitch:0,roll:0,length:4,width:2,mesh:block},wall={wall:true,kind:'barrier',ax:1.1,az:-2,bx:1.1,bz:2,renderHalfWidthM:0};
assert(separatedVehicleStaticProjection(blockBody,wall).separated);
assert.equal(separatedVehicleStaticProjection(blockBody,{...wall,renderHalfWidthM:.15}).separated,false,'the complete rendered barrier width can block a body clear of its centre line');
block.userData._model.geo.dispose();

// A changed source model buffer must invalidate an earlier whole-body proof.
const row=F.rows[0],mesh=makeVehicle(row.kind,'#fff',{instanced:true,city:'bucharest'}),original=mesh.userData._model;
mesh.userData._model={...original,geo:original.geo.clone()};mesh.scale.fromArray(row.scale);
const body={...row.pose,length:row.length,width:row.width,mesh},c=row.objects[0];assert(separatedVehicleStaticProjection(body,c).separated);
const matrix=new THREE.Matrix4().compose(new THREE.Vector3(body.x,body.y,body.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(body.pitch,body.heading,body.roll||0,'YXZ')),mesh.scale),local=new THREE.Vector3(c.x,body.y,c.z).applyMatrix4(matrix.invert()),p=mesh.userData._model.geo.attributes.position;
p.setXYZ(0,local.x,local.y,local.z);p.needsUpdate=true;
assert.equal(separatedVehicleStaticProjection(body,c).separated,false,'an actual new model protrusion invalidates the old separated projection');mesh.userData._model.geo.dispose();
console.log('PASS: all three native tram/bollard/barrier/tree cover witnesses, full body and render widths, true contact/ordinary/model/transform/unknown negatives, buffer invalidation and unchanged source objects');
