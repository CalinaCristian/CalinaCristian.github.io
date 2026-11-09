// Independent proposed-pose source sampling; no runtime routing/fit imports.
import {independentRailDirections} from '../unirii-pedestrian-recovery/rail-binding-checks.js';
const id=v=>String(v),same=(a,b)=>id(a)===id(b);
function decode(w,q){let x=0,z=0;const p=[];for(let i=0;i<(w?.points||[]).length;i+=2){x+=w.points[i];z+=w.points[i+1];p.push([x/q,z/q]);}return p;}
export function makeIndependentPoseSampler(data,graph,heightAt){
    const ways=new Map((data.tramSourceWays||[]).map(w=>[w.sourceId,{...w,pointsXY:decode(w,data.q)}])),edges=new Map(),invalid=[];
    for(const e of graph.edges||[]){
        const w=ways.get(e.sourceId),k=e.sourceSegment,directions=independentRailDirections(data,e.sourceId),a=w?.pointsXY[k],b=w?.pointsXY[k+1],deny=w?.tags||{};
        const access=deny.tram??deny.vehicle??deny.access,blocked=Object.keys(deny).some(k=>/^(access|vehicle|tram):conditional$/.test(k))||['yes','true','1'].includes(String(deny.disused))||['yes','true','1'].includes(String(deny.abandoned))||access!=null&&!['yes','designated','permissive'].includes(access);
        const ok=w&&a&&b&&e.rail&&e.usable&&e.modeled&&e.publicTram===true&&e.throughTram===true&&e.publicDrive===false&&e.throughAccess===false&&deny.railway==='tram'&&!deny.construction&&!deny.proposed&&!blocked&&!['yard','siding','spur'].includes(deny.service)&&Array.isArray(e.railDirections)&&JSON.stringify([...e.railDirections].sort())===JSON.stringify([...directions].sort())&&same(e.a.sourceId,w.nodeIds[k])&&same(e.b.sourceId,w.nodeIds[k+1])&&same(e.sourceNodeIds[0],w.nodeIds[k])&&same(e.sourceNodeIds[1],w.nodeIds[k+1])&&Math.hypot(e.a.x-a[0],e.a.z-a[1],e.b.x-b[0],e.b.z-b[1])<=1e-5&&Math.abs(e.len-Math.hypot(b[0]-a[0],b[1]-a[1]))<=1e-5;
        if(!ok){invalid.push({edgeId:e.id,sourceId:e.sourceId,reason:'unresolved-independent-source-mode-or-geometry'});continue;}edges.set(id(e.id),{e,w,a,b,directions,len:Math.hypot(b[0]-a[0],b[1]-a[1])});
    }
    const choices=(current,dir,back)=>{
        const endpoint=back?(dir>0?current.e.a:current.e.b):(dir>0?current.e.b:current.e.a),out=[];
        for(const c of edges.values())if(c!==current)for(const d of c.directions){const n=back?(d>0?c.e.b:c.e.a):(d>0?c.e.a:c.e.b);if(same(n.sourceId,endpoint.sourceId))out.push({e:c.e,dir:d});}return out;
    };
    function extend(e,dir,length,back){let c=edges.get(id(e.id)),d=dir,covered=0;const list=[],branches=[],seen=new Set([id(e.id)]);
        for(let i=0;c&&covered<length&&i<256;i++){
            const options=choices(c,d,back).filter(r=>!seen.has(id(r.e.id))),sameWay=options.filter(r=>r.e.sourceId===c.e.sourceId),next=options.length===1?options[0]:sameWay.length===1?sameWay[0]:null;
            if(options.length>1)branches.push({sourceNodeId:(back?(d>0?c.e.a:c.e.b):(d>0?c.e.b:c.e.a)).sourceId,options:options.map(r=>({edgeId:r.e.id,dir:r.dir})),selected:next?{edgeId:next.e.id,dir:next.dir}:null});
            if(!next)break;if(back)list.unshift(next);else list.push(next);seen.add(id(next.e.id));covered+=next.e.len;c=edges.get(id(next.e.id));d=next.dir;
        }return{list,branches,covered};
    }
    function proposal(e,dir,s,length){const forward=extend(e,dir,length,false),backward=extend(e,dir,length,true);return{edgeId:e.id,dir,s,length,route:forward.list.map(r=>({edgeId:r.e.id,dir:r.dir})),hist:backward.list.map(r=>({edgeId:r.e.id,dir:r.dir})),branchUncertainty:[...forward.branches,...backward.branches]};}
    function sample(v,offset){let c=edges.get(id(v.edgeId??v.edge?.id)),d=v.dir,s=v.s+offset,ri=0,hi=(v.hist||[]).length-1;
        for(let i=0;c&&i<256;i++){
            if(!c.directions.includes(d))return null;
            if(s>=-1e-8&&s<=c.len+1e-8){const t=d>0?s/c.len:1-s/c.len,grade=heightAt(c.w,c.a,c.b,t);return grade?{x:c.a[0]+(c.b[0]-c.a[0])*t,z:c.a[1]+(c.b[1]-c.a[1])*t,y:grade.y,grade,edgeId:c.e.id,dir:d,station:s}:null;}
            const back=s<0,saved=back?v.hist?.[hi--]:v.route?.[ri++],options=choices(c,d,back),next=saved&&options.find(r=>id(r.e.id)===id(saved.edgeId??saved.edge?.id)&&r.dir===saved.dir)||(!saved&&options.length===1?options[0]:null);if(!next)return null;
            if(back){const previous=edges.get(id(next.e.id));s+=previous.len;}else s-=c.len;c=edges.get(id(next.e.id));d=next.dir;
        }return null;
    }
    return{edges:[...edges.values()].map(c=>c.e),invalid,proposal,sample};
}
