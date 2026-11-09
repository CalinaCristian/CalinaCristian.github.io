// Actual native claim methods, isolated CPU source crossing. No browser/world acceptance.
import assert from 'node:assert/strict';import * as THREE from '../../../../game/vendor/three.module.min.js';
import { Traffic } from '../../../../game/src/traffic.js';import { buildTramNetwork } from '../../../../game/src/tram-path.js';import { makeRng } from '../../../../game/src/util.js';
const A={id:1,sourceId:2001,x:0,z:-100,y:0,edges:[],radius:0},N={id:2,sourceId:2002,x:0,z:0,y:0,edges:[],radius:5},B={id:3,sourceId:2003,x:0,z:100,y:0,edges:[],radius:0};
const motor=(id,a,b)=>({id,sourceId:'w'+id,access:{sourceId:'w'+id},a,b,len:100,dirx:0,dirz:1,nx:-1,nz:0,lanesF:1,lanesB:1,laneW:3.5,median:0,oneway:false,publicDrive:true,throughAccess:true,type:'secondary',ya:0,yb:0});
const m0=motor(90,A,N),m1=motor(91,N,B);A.edges=[m0];N.edges=[m0,m1];B.edges=[m1];const motorBefore=JSON.stringify([A,N,B],(k,v)=>k==='edges'?v.map(e=>e.id):v);
const data={q:10,trams:[[-1000,0,1000,0,1000,0]],tramSources:[{sourceId:'w1',nodeIds:[3001,2002,3003]}],tramSourceWays:[{sourceId:'w1',nodeIds:[3001,2002,3003],points:[-1000,0,1000,0,1000,0],tags:{railway:'tram',oneway:'yes'}}],tramRoutes:[],tramSourceNodeTags:{}};
const network=buildTramNetwork(data,{motorNodes:[A,N,B]}),[r0,r1]=network.edges,rnode=network.bySourceNode.get('2002');
const T=Object.create(Traffic.prototype);Object.assign(T,{world:{graph:{nodes:[A,N,B],edges:[m0,m1]},nodeLight:{},buildings:[]},city:{id:'bucharest'},buc:true,chaos:1,rng:makeRng(99),vehicles:[],pool:[],group:new THREE.Group(),police:[],stats:{},_idSeq:0,boxes:new Map(),time:1,tramNetwork:network,tramMotorCrossings:new Set([N])});
const tram=T.spawn({edge:r0,dir:1,lane:0,s:80,kind:'tram-v3a'}),car=T.spawn({edge:m0,dir:1,lane:0,s:80,kind:'hatch'});tram.route=[{e:r1,dir:1}];car.route=[{e:m1,dir:1}];
const railPath=T.reservationPath(tram,r0,1,tram.route[0],rnode,5),motorPath=T.reservationPath(car,m0,1,car.route[0],N,5);assert.equal(railPath.segments.length,2);assert.equal(T.boxController(rnode),T.boxController(N));assert(T.isJunction(N));
assert.notEqual(T.boxCheck(car,m0,1,car.route[0],N,5),'wait');T.boxClaim(tram,rnode,railPath);T.time=1.1;assert.equal(T.boxCheck(car,m0,1,car.route[0],N,5),'wait');
T.boxes.clear();T.time=2;T.boxClaim(car,N,motorPath);T.time=2.1;assert.equal(T.boxCheck(tram,r0,1,tram.route[0],rnode,5),'wait');
T.boxes.clear();assert.notEqual(T.boxCheck(tram,r0,1,tram.route[0],rnode,5),'wait');assert.equal(JSON.stringify([A,N,B],(k,v)=>k==='edges'?v.map(e=>e.id):v),motorBefore);assert.equal(N.edges.length,2);
console.log(JSON.stringify({passed:true,olderTramClaimStopsMotor:true,olderMotorClaimStopsTram:true,noClaimAllowsLegalPath:true,sourceCrossingPhysicalKeyShared:true,railReservationKeepsLiteralNode:true,motorTopologyUnchanged:true,browserOpened:false,scope:'Isolated actual Traffic reservation/priority methods with source-equal crossing node; no full-world or signal-timing acceptance claim.'},null,2));
