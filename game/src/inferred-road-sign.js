// One inferred road-sign unit: post/collider footprint and both actual plate
// surfaces. This never classifies or removes a mapped sign/hardware record.
export function inferredRoadSignUnit({grades,envelope,x,z,angle,baseY,width=.75,height=.75,inferred=true,sourceId=null}){
    if(!inferred)return{allowed:true,reason:'mapped-unit-outside-inferred-placement-policy'};
    if(!grades?.excludesInferredObstacle||!envelope||!['halfWidthM','minY','maxY','tiltedMinY','tiltedMaxY'].every(k=>Number.isFinite(envelope[k])))return{allowed:true,reason:'no-known-native-tram-envelope; no-clearance-pass-asserted'};
    if(![x,z,angle,baseY,width,height].every(Number.isFinite)||width<=0||height<=0)return{allowed:false,reason:'malformed-inferred-sign-unit'};
    // The native sign collider has radius .1; the actual square post is .07.
    // Retain that footprint and the actual emitted post's absolute height.
    const components=[{name:'post-and-collider-footprint',a:[x,z],b:[x,z],radiusM:.1,y0a:baseY,y1a:baseY+2.3}];
    for(const[name,side,offset]of[['front-plate',1,.06],['back-plate',-1,.04]]){
        const fx=Math.sin(angle)*side,fz=Math.cos(angle)*side,cx=x+fx*offset,cz=z+fz*offset;
        components.push({name,a:[cx-fz*width/2,cz+fx*width/2],b:[cx+fz*width/2,cz-fx*width/2],radiusM:0,y0a:baseY+2-height/2,y1a:baseY+2+height/2});
    }
    for(const part of components)if(grades.excludesInferredObstacle(part.a,part.b,{inferred:true,bodyEnvelope:envelope,radiusM:part.radiusM,y0a:part.y0a,y1a:part.y1a,kind:'inferred-road-sign-'+part.name,sourceId}))return{allowed:false,reason:'inferred-unit-intersects-known-source-tram-body',component:part.name,sourceId,components};
    return{allowed:true,reason:'no-known-source-tram-body-intersection',components,scope:'Existing known-grade source-rail query only; unresolved source grades remain unresolved, not certified clear.'};
}
