#!/usr/bin/env node
// Proposed static poses over immutable native geometry, NOT observed motion.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import crypto from 'node:crypto';import {createRequire}from'node:module';
import * as THREE from '../../../game/vendor/three.module.min.js';
import {prepareRecordedContext}from'./recorded-context.mjs';import{makeIndependentPoseSampler}from'./source-pose-sampler.js';
const args={};for(let i=2;i<process.argv.length;i++)if(process.argv[i].startsWith('--'))args[process.argv[i].slice(2)]=process.argv[++i];
if(!args.dir||!args.district||!args.archive||!args.out)throw Error('--dir QA_EXPORT --district grozavesti|romana --archive EXACT_ARCHIVE --out NEW_REPORT required; no browser');
if(fs.existsSync(args.out))throw Error('Refuse to overwrite sweep');
const require=createRequire(import.meta.url),decoder=require(path.join(path.resolve(args.dir),'decode-geometry.cjs')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),inputs=[];
const load=n=>{const file=path.join(args.dir,args.district+'-'+n+'.json.gz'),bytes=fs.readFileSync(file);inputs.push({path:file,sha256:sha(bytes)});return JSON.parse(zlib.gunzipSync(bytes));};
const world=load('world'),scene=load('scene'),facts=load('facts'),catalogue=JSON.parse(fs.readFileSync(new URL('./reviewed-models.json',import.meta.url))),pins=catalogue.sources.map(s=>{const file=path.join(args.archive,s.path.slice(s.path.indexOf('game/src/')));return{file,passed:sha(fs.readFileSync(file))===s.sha256};});
const context=prepareRecordedContext({world,scene,facts,reviewedModels:catalogue.models,decoder,modelPinsVerified:pins.every(p=>p.passed)}),snapshot=facts.snapshots.at(-1),baseline=context.auditPhase(snapshot);
const prior=JSON.parse(fs.readFileSync(path.join(path.dirname(args.out),args.district+'-audit-final.json'))).phases.at(-1).checks;
for(const row of baseline.checks){const old=prior.find(v=>v.id===row.id);if(JSON.stringify(row.body?.contactCounters)!==JSON.stringify(old?.body?.contactCounters))throw Error('Counter parity failed after independent body index update: '+row.id);}
if(!context.summary.complete)throw Error('Independent source/geometry context incomplete');
const sampler=makeIndependentPoseSampler(world.data,snapshot.tramNetwork,context.lookup.heightAt),models=[...new Map([...snapshot.active,...snapshot.pool].filter(v=>v.tramDetected).map(v=>[v.kind,v])).values()],step=Number(args.step||5),tasks=[];
if(!(step>0&&step<=5)||!Number.isFinite(step))throw Error('Source step must be finite and <=5m');
for(const e of sampler.edges)for(const dir of e.railDirections){const count=Math.max(1,Math.ceil(e.len/step));for(let i=0;i<=count;i++)for(const base of models)tasks.push({e,dir,s:e.len*i/count,base});}
const result={sourceCommit:'ff6b2bff3cfe5b45c5dba9624abbb6672304bfed',district:args.district,complete:false,scope:'Offline proposed rigid native-mesh poses at all original admitted vertices and <=5m source stations; immutable captured static world only. No runtime actors moved, no physics clocks/browser, no dynamic actor/wholepath/all8/native-motion acceptance. Unique same-source continuation is selected at forks; alternative choices and unresolved endpoint/body spans remain explicit.',stepM:step,inputs,pins,context:context.summary,sourceInvalid:sampler.invalid,baselineCounterParity:true,total:tasks.length,done:0,clearSamples:0,contactSamples:0,unknownSamples:0,branchSamples:0,rows:[]};
const save=()=>fs.writeFileSync(args.out,JSON.stringify(result));save();
function pose(record,y,pitch,heading){record.y=y;record.heading=heading;record.meshPose={...record.meshPose,rotation:[pitch,heading,0,'YXZ']};const scale=record.meshPose.scale||[1,1,1],local=new THREE.Matrix4().compose(new THREE.Vector3(record.x,y,record.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,heading,0,'YXZ')),new THREE.Vector3(...scale)),matrix=new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().fromArray(context.frameMatrix),local).toArray();record.mesh={...record.mesh,matrixWorld:matrix};}
for(const task of tasks){
    const {e,dir,s,base}=task,v=sampler.proposal(e,dir,s,base.length),samplePath=o=>sampler.sample(v,o),C=samplePath(0),F=samplePath(base.length*.36),R=samplePath(-base.length*.36),row={sourceId:e.sourceId,segment:e.sourceSegment,edgeId:e.id,dir,s,kind:base.kind,branchUncertainty:v.branchUncertainty};
    if(v.branchUncertainty.length)result.branchSamples++;
    if(!C||!F||!R){row.status='unknown-source-body-span';result.unknownSamples++;}
    else{
        const heading=Math.atan2(-(F.x-R.x),-(F.z-R.z)),pitch=Math.atan2(F.y-R.y,Math.hypot(F.x-R.x,F.z-R.z)),record={...base,edge:e,dir,s,x:C.x,z:C.z,route:v.route,hist:v.hist};pose(record,C.y+.24,pitch,heading);
        const fit=context.body(record,{samplePath,expectedHeading:heading,fitOnly:true});
        if(!fit.known){row.status='unknown-independent-rigid-fit';row.coverageGaps=fit.coverageGaps;result.unknownSamples++;}
        else{
            pose(record,fit.rigidPose.expectedY,fit.rigidPose.expectedPitch,heading);const audit=context.body(record,{samplePath,expectedHeading:heading});row.pose={x:record.x,y:record.y,z:record.z,heading,pitch:fit.rigidPose.expectedPitch};row.contactCounters=audit.contactCounters;
            if(audit.coverageGaps.length||audit.issues.some(i=>i.reason!=='actual-emitted-tram-geometry-contact')){row.status='unknown-or-mismatched-rigid-source-pose';row.issues=audit.issues;row.coverageGaps=audit.coverageGaps;result.unknownSamples++;}
            else if(audit.contactCounters.worldTriangleContactPairs||audit.contactCounters.continuousViolatingEdgeConstraints||audit.contactCounters.renderedViolatingClipVertices){row.status='contact';row.groups=audit.worldContactGroups;row.supportWitnesses=audit.witnesses.filter(w=>w.reason!=='actual-emitted-body-world-solid-contact').slice(0,3);result.contactSamples++;}
            else{row.status='sampled-proxy-clear';result.clearSamples++;}
        }
    }
    result.rows.push(row);result.done++;if(result.done%25===0){save();console.log(JSON.stringify({district:args.district,done:result.done,total:result.total,contacts:result.contactSamples,unknown:result.unknownSamples}));}
}
result.complete=true;save();console.log(JSON.stringify({complete:true,district:args.district,total:result.total,clear:result.clearSamples,contacts:result.contactSamples,unknown:result.unknownSamples,branchSamples:result.branchSamples}));
