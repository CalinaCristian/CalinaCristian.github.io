// Independent literal source/controller and recorded event checks. No runtime
// signal/path helpers; no real-world timing claim or inferred nearest light.
const id=v=>String(v),controlled=t=>t?.highway==='traffic_signals'||t?.crossing==='traffic_signals'||t?.['crossing:signals']==='yes';
export function auditRecordedSignals({data,world,snapshot}){
    const issues=[],checks=[],unobserved=[],motors=new Map((world.graphNodes||[]).map(n=>[id(n.id),n])),edges=new Map((world.allEdges||[]).map(e=>[id(e.id),e])),lights=new Map((world.lights||[]).map(l=>[id(l.node.id),l]));
    for(const n of snapshot.tramNetwork?.nodes||[]){
        const s=n.sourceSignal;if(!s)continue;
        const fail=(reason,fields={})=>issues.push({reason,railSourceNodeId:n.sourceId,...fields});
        if(s.unresolved){fail('unresolved-literal-source-signal');continue;}
        const motor=motors.get(id(s.nodeId)),edge=edges.get(id(s.edgeId)),light=lights.get(id(s.nodeId)),approach=light?.approaches.find(a=>id(a.edge?.id)===id(s.edgeId)),wayIds=s.raw?.crossingSourceIds||[s.crossingSourceId];
        const contexts=(data.tramSourceCrossings||[]).filter(w=>wayIds.includes(w.sourceId)&&w.nodeIds.some(v=>id(v)===id(n.sourceId))&&w.railNodeIds.some(v=>id(v)===id(n.sourceId))&&controlled(w.nodeTags?.[id(n.sourceId)])&&w.roadIncidences.some(i=>id(i.nodeId)===id(s.roadSourceNodeId)&&i.sourceId===s.roadSourceId&&controlled(w.nodeTags?.[id(i.nodeId)])));
        if(!contexts.length||!motor||id(motor.sourceId)!==id(s.roadSourceNodeId)||!edge||(edge.sourceId??edge.access?.sourceId)!==s.roadSourceId||!motor.hasLight||!n.hasLight||!approach){fail('missing-or-wrong-literal-source-road-signal-identity');continue;}
        if(s.controller?.identity!==light.controller?.identity||s.phase!==approach.phase){fail('wrong-existing-native-controller-or-phase');continue;}
        if(n.motorNodeId!=null&&id(n.motorNodeId)!==id(motor.id)){fail('source-signal-was-incorrectly-aliased-to-motor-node');continue;}
        for(const railEdgeId of s.railEdgeIds||[]){
            const rail=snapshot.tramNetwork.edges.find(e=>id(e.id)===id(railEdgeId)),sample=(snapshot.railSignalStates||[]).find(r=>id(r.railSourceNodeId)===id(n.sourceId)&&id(r.railEdgeId)===id(railEdgeId));
            if(!rail||Math.abs(rail.dirx*edge.dirx+rail.dirz*edge.dirz)<=Math.cos(Math.PI/9)){fail('source-signal-approach-axis-mismatch',{railEdgeId});continue;}
            if(!sample||id(sample.motorNodeId)!==id(motor.id)||id(sample.motorEdgeId)!==id(edge.id)||sample.controllerIdentity!==s.controller.identity||sample.phase!==s.phase||sample.trafficTime!==snapshot.nativeTime||!['red','yellow','green'].includes(sample.railState)||sample.railState!==sample.motorState){fail('missing-or-inconsistent-direct-native-road-rail-state',{railEdgeId,sample});continue;}
            checks.push({railSourceNodeId:n.sourceId,railEdgeId,motorNodeId:motor.id,motorEdgeId:edge.id,controllerIdentity:s.controller.identity,phase:s.phase,trafficTime:sample.trafficTime,state:sample.railState,crossingSourceIds:contexts.map(c=>c.sourceId)});
            if(sample.actualRendererApproachState==null)unobserved.push({reason:'rendered-approach-lamp-state-not-initialized-or-captured',railSourceNodeId:n.sourceId,railEdgeId});
        }
    }
    return{passed:!issues.length,issues,checks,unobserved,nativeRedStopObserved:false,nativeGreenResumeObserved:false,nativeMappedDwellObserved:false,scope:'Literal association and direct state at recorded clock only. No driven red stop, dwell, green resume or renderer phase equivalence is inferred.'};
}

/** Event gate for future actual per-step traces. Progress comes from captured
 * physical clocks/odo/source distance, never a producer completion flag. */
export function auditRecordedTramEvents(rows,{requiredSourceSignalIds=[],requiredStopNodeIds=[]}={}){
    const issues=[],redStops=[],resumes=[],dwells=[];const byActor=new Map();
    for(const r of rows||[]){if(!byActor.has(r.id))byActor.set(r.id,[]);byActor.get(r.id).push(r);}
    for(const[id,list]of byActor){let prior=null,red=null,stop=null;
        for(const r of list){
            if(!Number.isFinite(r.time)||!Number.isFinite(r.odo)||!Number.isFinite(r.speed)){issues.push({reason:'unknown-native-event-clock-or-motion',id});continue;}
            if(prior&&(r.time<=prior.time||r.odo<prior.odo-1e-7)){issues.push({reason:'nonmonotonic-native-event-clock-or-odo',id});prior=r;continue;}
            if(prior&&r.odo-prior.odo>Math.max(Math.abs(r.speed),Math.abs(prior.speed))*(r.time-prior.time)+1e-5)issues.push({reason:'event-odometer-progress-exceeds-recorded-physical-motion',id,time:r.time});
            if(r.signal&&r.signal.state==='red'&&r.signal.motorState==='red'&&Number.isFinite(r.frontDistanceM)&&r.frontDistanceM>=-1e-7&&r.speed<.05){if(!red||red.node!==r.signal.sourceNodeId)red={id,node:r.signal.sourceNodeId,start:r.time,odo:r.odo};else if(r.time-red.start>=.25&&!red.recorded){red.recorded=true;redStops.push({...red,end:r.time});}}
            if(red?.recorded&&r.signal?.sourceNodeId===red.node&&r.signal.state==='green'&&r.signal.motorState==='green'&&r.odo>red.odo+2&&r.frontDistanceM<-.5){resumes.push({id,sourceNodeId:red.node,time:r.time,odoProgress:r.odo-red.odo});red=null;}
            if(r.stopSourceNodeId!=null&&r.mappedStop===true&&r.speed<.5&&Number.isFinite(r.sourceStopDistanceM)&&Math.abs(r.sourceStopDistanceM)<=.7&&r.dwell>0){if(!stop||stop.node!==r.stopSourceNodeId)stop={id,node:r.stopSourceNodeId,start:r.time,startOdo:r.odo};}
            if(stop&&r.servedSourceNodeId===stop.node){if(r.time-stop.start>=5-2*(r.dt||1/30)-1e-7&&Math.abs(r.odo-stop.startOdo)<.7)dwells.push({id,sourceNodeId:stop.node,start:stop.start,end:r.time,duration:r.time-stop.start});else issues.push({reason:'mapped-stop-dwell-duration-or-motion-invalid',id,stop,current:r});stop=null;}
            prior=r;
        }
    }
    const gaps=[];for(const id of requiredSourceSignalIds){if(!redStops.some(r=>String(r.node)===String(id)))gaps.push({reason:'actual-controlled-red-stop-not-observed',sourceNodeId:id});if(!resumes.some(r=>String(r.sourceNodeId)===String(id)))gaps.push({reason:'actual-controlled-green-resume-not-observed',sourceNodeId:id});}
    for(const id of requiredStopNodeIds)if(!dwells.some(r=>String(r.sourceNodeId)===String(id)))gaps.push({reason:'actual-mapped-stop-dwell-not-observed',sourceNodeId:id});
    return{passed:!issues.length&&!gaps.length,issues,coverageGaps:gaps,redStops,resumes,dwells,scope:'Recorded native per-step clocks, source distances and actual motion only; no simulation control or real-world schedule claim.'};
}
