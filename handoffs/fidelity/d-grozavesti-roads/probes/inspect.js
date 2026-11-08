(()=>{
 const g=window.game,w=g.world;
 const pp=(e)=>({id:e.id,road:e.road,seg:e.seg,name:e.name,type:e.type,bridge:e.bridge,layer:e.layer,ya:e.ya,yb:e.yb,len:e.len,wR:e.wR,wL:e.wL,sidewalk:e.sidewalk,a:{id:e.a.id,x:e.a.x,z:e.a.z,y:e.a.y,edges:e.a.edges.map(v=>v.id)},b:{id:e.b.id,x:e.b.x,z:e.b.z,y:e.b.y,edges:e.b.edges.map(v=>v.id)}});
 const pts=[[1011.4,-1215.7],[191.2,-448.4],[196.8,-464.7],[-224,301.9],[98.3,-571.8]];
 return {stats:w.stats.profile,audit:w.audit(),points:pts.map(([x,z])=>({x,z,hs:w.surfacesAt(x,z),edges:w.allEdges.filter(e=>Math.hypot((e.a.x+e.b.x)/2-x,(e.a.z+e.b.z)/2-z)<50).map(pp),walls:w.walls.filter(v=>Math.hypot(v.x-x,v.z-z)<25).map(v=>({...v,edge:v.edge?.id,node:v.node?.id})),groups:w.group?.children?.map(v=>({name:v.name,type:v.type}))})),fuel:w.stats.fuel};
})()
