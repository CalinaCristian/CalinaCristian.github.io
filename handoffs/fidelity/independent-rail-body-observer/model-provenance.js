// Independent reconstruction from reviewed MODEL inputs, raw rail references
// and exact native road profiles. No runtime grade/path/fitter imports.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const no=v=>v==null||/^(no|false|0)$/.test(String(v));
const yes=v=>/^(yes|true|1)$/.test(String(v));
const ground=t=>no(t.bridge)&&no(t.tunnel)&&(t.layer==null||Number(t.layer)===0)&&(t.level==null||Number(t.level)===0)&&t.ele==null&&t.incline==null;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function decode(w,q){if(!w?.points||w.missingNodeIds?.length)return null;let x=0,z=0;const p=[];for(let i=0;i<w.points.length;i+=2){x+=w.points[i];z+=w.points[i+1];p.push([x/q,z/q]);}return p.length===w.nodeIds.length&&p.every(p=>p.every(Number.isFinite))?p:null;}
function pathFor(ways,definition){
    const nodes=[],points=[],legs=[],station=new Map();let total=0;
    for(const[sourceId,direction]of definition.ways||[]){const w=ways.get(sourceId);if(!w?.xy)return null;const ids=w.nodeIds.map((_,i)=>i);if(direction<0)ids.reverse();
        if(nodes.length&&(String(nodes.at(-1))!==String(w.nodeIds[ids[0]])||distance(points.at(-1),w.xy[ids[0]])>1e-7))return null;
        for(let k=0;k<ids.length;k++){const i=ids[k],node=w.nodeIds[i];if(k){const before=ids[k-1],start=total;total+=distance(w.xy[before],w.xy[i]);legs.push({sourceId,index:Math.min(i,before),s0:direction>0?start:total,s1:direction>0?total:start});}
            if(!nodes.length||String(nodes.at(-1))!==String(node)){nodes.push(node);points.push(w.xy[i]);}if(station.has(String(node))&&Math.abs(station.get(String(node))-total)>1e-7)return null;station.set(String(node),total);}
    }return{nodes,points,legs,station};
}
function ramp(s,length,height,maxGrade,easeM){
    if(height===0)return 0;if(!(height>0&&length>height/maxGrade))return null;const ease=Math.min(easeM,length/3,(length-height/maxGrade)*.999),g=height/(length-ease);
    if(!(ease>0)||g>maxGrade+1e-10)return null;if(s<=0)return 0;if(s>=length)return height;if(s<ease)return g*s*s/(2*ease);if(s>length-ease)return height-g*(length-s)**2/(2*ease);return g*(s-ease/2);
}
function stationRoadHeight(P,N,sourceId,edges){
    const hits=[];for(const e of edges)if((e.sourceId??e.access?.sourceId)===sourceId&&e.bridge&&!e.tunnel){const D=[e.b.x-e.a.x,e.b.z-e.a.z],Q=[e.a.x-P[0],e.a.z-P[1]],den=cross(N,D);if(Math.abs(den)<1e-8)continue;const u=cross(Q,N)/den,t=cross(Q,D)/den;if(u<-1e-7||u>1+1e-7)continue;const y=e.ya+(e.yb-e.ya)*u;if(!Number.isFinite(y))return null;if(!hits.some(h=>Math.abs(h.t-t)<1e-6))hits.push({t,y,edgeId:e.id});}
    return hits.length===1?hits[0]:null;
}
export function buildIndependentModelProfiles({data,reviewedModels,nativeMotorEdges=[]}){
    const ways=new Map((data?.tramSourceWays||[]).map(w=>[w.sourceId,{...w,xy:decode(w,data.q)}])),profiles=new Map(),issues=[],roofs=[];
    const put=(model,path,height)=>{for(const leg of path.legs)profiles.set(leg.sourceId+':'+leg.index,{modelId:model.id,heightAt:t=>height(leg.s0+(leg.s1-leg.s0)*t)});};
    const sourceGround=(node,road)=>{
        const matches=nativeMotorEdges.filter(e=>(e.sourceId??e.access?.sourceId)===road&&[e.a,e.b].some(n=>String(n.sourceId)===String(node))&&ground(data.roadSourceGeometry?.[e.road]?.tags||{}));
        if(matches.length)return matches.every(e=>[e.a,e.b].filter(n=>String(n.sourceId)===String(node)).every(n=>Number.isFinite(n.y)&&Math.abs(n.y)<1e-8));
        return Object.values(data.scenerySourceGeometry||{}).some(w=>w.sourceId===road&&w.nodeIds.some(n=>String(n)===String(node))&&ground(w.tags||{}));
    };
    for(const model of reviewedModels||[]){
        const selected=new Set((data.tramSources||[]).map(r=>r.sourceId)),ids=new Set([...(model.bridgeWays||[]),...(model.paths||[]).flatMap(p=>(p.ways||[]).map(w=>w[0]))]);if(![...ids].some(id=>selected.has(id)))continue;
        const fail=reason=>issues.push({modelId:model.id,reason});
        if(model.kind==='constant'){for(const id of model.sourceWayIds||model.bridgeWays||[]){const w=ways.get(id);if(w?.xy)for(let i=0;i<w.xy.length-1;i++)profiles.set(id+':'+i,{modelId:model.id,heightAt:()=>model.heightM});}continue;}
        if(model.kind==='polynomial'){for(const id of model.sourceWayIds||model.bridgeWays||[]){const w=ways.get(id);if(w?.xy)for(let i=0;i<w.xy.length-1;i++)profiles.set(id+':'+i,{modelId:model.id,heightAt:t=>{const[A,B,C]=model.sourceCoefficients;return(A*t+B)*t+C;}});}continue;}
        if(model.kind==='level'){
            const roads=(model.roadSources||[]).map(id=>nativeMotorEdges.filter(e=>(e.sourceId??e.access?.sourceId)===id&&e.bridge&&!e.tunnel));
            if(roads.some(es=>!es.length)||roads.flat().some(e=>Math.abs(e.ya)>1e-8||Math.abs(e.yb)>1e-8)){fail('independent-lower-source-road-zero-datum-unconfirmed');continue;}
            for(const id of model.bridgeWays||[]){const w=ways.get(id);if(!w?.xy){fail('missing-complete-reviewed-level-bridge-source');continue;}for(let i=0;i<w.xy.length-1;i++)profiles.set(id+':'+i,{modelId:model.id,heightAt:()=>0});}continue;
        }
        if(model.kind==='station-plateau'){
            const prepared=[];let bad=false;
            if([...ids].some(id=>{const w=ways.get(id),t=w?.tags;return!w?.xy||!t||t.ele!=null||t.incline!=null||!no(t.tunnel)||(!model.bridgeWays.includes(id)&&!ground(t));})){fail('independent-source-bridge-path-tags-or-grade-constraints-changed');continue;}
            for(let k=0;k<model.paths.length;k++){
                const def=model.paths[k],p=pathFor(ways,def),stop=model.stationNodes[k];if(!p){bad=true;break;}const i=p.nodes.indexOf(stop),tags=data.tramSourceNodeTags?.[stop];
                if(i<=0||i>=p.nodes.length-1||tags?.railway!=='tram_stop'||tags?.public_transport!=='stop_position'){bad=true;break;}
                const before=p.points[i-1],at=p.points[i],after=p.points[i+1],a=distance(before,at),b=distance(at,after),u=[(at[0]-before[0])/a+(after[0]-at[0])/b,(at[1]-before[1])/a+(after[1]-at[1])/b],L=Math.hypot(...u),N=[-u[1]/L,u[0]/L];
                const hits=model.stationRoadSources.map(id=>stationRoadHeight(at,N,id,nativeMotorEdges));if(hits.some(h=>!h)||hits[0].t*hits[1].t>=0||Math.abs(hits[0].y-hits[1].y)>.05){bad=true;break;}
                const height=(hits[0].y+hits[1].y)/2,bridge=p.legs.filter(l=>model.bridgeWays.includes(l.sourceId)),lo=Math.min(...bridge.flatMap(l=>[l.s0,l.s1])),hi=Math.max(...bridge.flatMap(l=>[l.s0,l.s1])),south=p.station.get(String(def.southGround)),north=p.station.get(String(def.northGround)),station=p.station.get(String(stop));
                const branch=ways.get(def.southFlatBranch),southKnown=branch?.nodeIds.includes(def.southGround)&&ground(branch.tags||{})&&sourceGround(def.southGroundReference,def.southRoad)&&p.station.get(String(def.southGroundReference))<south||sourceGround(def.southGround,def.southRoad);
                if(!southKnown||!sourceGround(def.northGround,def.northRoad)||!(south<lo&&lo<station&&station<hi&&hi<north)){bad=true;break;}
                const entry=model.bridgeEntryHeightM??height,rise=Math.min(model.bridgeRiseLengthM??station-lo,station-lo),atHeight=s=>s<lo?ramp(s-south,lo-south,entry,model.maxGrade,model.easeM):s>hi?height-ramp(s-hi,north-hi,height,model.maxGrade,model.easeM):entry+ramp(s-lo,rise,height-entry,model.maxDeckGrade??model.maxGrade,model.easeM);
                if(ramp(0,lo-south,entry,model.maxGrade,model.easeM)===null||ramp(0,north-hi,height,model.maxGrade,model.easeM)===null||ramp(0,rise,height-entry,model.maxDeckGrade??model.maxGrade,model.easeM)===null){bad=true;break;}
                if([south,lo,station,hi,north].some(s=>!Number.isFinite(atHeight(s)))){bad=true;break;}prepared.push({p,atHeight,height});
            }
            if(bad||prepared.length!==model.paths.length||Math.max(...prepared.map(p=>p.height))-Math.min(...prepared.map(p=>p.height))>.05){fail('independent-common-station-source-anchor-profile-unconfirmed');continue;}
            for(const p of prepared)put(model,p.p,p.atHeight);continue;
        }
        if(model.id==='victoria-tram-underpass'){
            const prepared=[];let bad=false;
            for(const def of model.paths){
                const p=pathFor(ways,def);if(!p){bad=true;break;}const stop=p.station.get(String(def.stationNode)),west=p.station.get(String(def.westGround)),east=p.station.get(String(def.eastGround)),tags=data.tramSourceNodeTags?.[def.stationNode],legs=p.legs.filter(l=>l.sourceId===def.tunnelWay),start=Math.min(...legs.flatMap(l=>[l.s0,l.s1])),end=Math.max(...legs.flatMap(l=>[l.s0,l.s1])),lo=start+model.tunnelRampInsetM,hi=end-model.tunnelRampInsetM;
                const anchors=[[def.westGround,def.westGroundWay],[def.eastGround,def.eastGroundWay]].every(([n,id])=>{const w=ways.get(id),i=w?.nodeIds.indexOf(n),j=p.nodes.indexOf(n);return i>=0&&j>=0&&ground(w.tags||{})&&distance(w.xy[i],p.points[j])<=1e-7;});
                const raw=ways.get(def.tunnelWay)?.tags;
                if(!anchors||!yes(raw?.tunnel)||Number(raw.layer)!==-1||Number(raw.level)!==-1||tags?.railway!=='tram_stop'||tags?.public_transport!=='stop_position'||Number(tags?.level)!==-1||!(west<lo&&lo<=stop-model.stationHalfPlateauM&&stop+model.stationHalfPlateauM<=hi&&hi<east)){bad=true;break;}
                const height=s=>s<lo?-ramp(s-west,lo-west,model.depthM,model.maxGrade,model.easeM):s<=hi?-model.depthM:-model.depthM+ramp(s-hi,east-hi,model.depthM,model.maxGrade,model.easeM);
                if(ramp(0,lo-west,model.depthM,model.maxGrade,model.easeM)===null||ramp(0,east-hi,model.depthM,model.maxGrade,model.easeM)===null){bad=true;break;}
                if([west,lo,hi,east].some(s=>!Number.isFinite(height(s)))){bad=true;break;}prepared.push({p,height});roofs.push({modelId:model.id,sourceId:def.tunnelWay,sourceStation:stop,halfLengthM:model.stationHalfPlateauM,bottomM:model.roofBottomM,topM:model.roofTopM});
            }
            if(bad||prepared.length!==model.paths.length){fail('independent-source-underground-stop-or-ground-join-unconfirmed');continue;}for(const p of prepared)put(model,p.p,p.height);continue;
        }
        fail('unsupported-reviewed-model-profile-kind');
    }
    return{profiles,issues,roofs};
}
