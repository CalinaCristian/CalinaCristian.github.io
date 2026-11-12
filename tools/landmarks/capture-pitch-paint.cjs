// Capture only the running game: actual landmark placement, reported sites and outward drone views.
// No reference service is contacted. Source imagery remains outside the public repository.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { chromium } = require('playwright');
const arg = k => process.argv.find(s => s.startsWith('--' + k + '='))?.slice(k.length + 3);
const root = path.resolve(arg('root')), baseOut = path.resolve(arg('out')), district = arg('district'), commit = arg('commit');
let out=baseOut,season = arg('season') || 'summer', weather = arg('weather') || 'clear', time = arg('time') || 'day';
const knownConditions={'summer-clear-day':{season:'summer',weather:'clear',time:'day'},'summer-clear-night':{season:'summer',weather:'clear',time:'night'},'winter-snow-day':{season:'winter',weather:'snow',time:'day'}};
const phases=arg('conditions')?arg('conditions').split(',').map(name=>{if(!knownConditions[name])throw Error('Unknown condition '+name);return{name,...knownConditions[name]};}):[{name:null,season,weather,time}];
if(new Set(phases.map(p=>p.name)).size!==phases.length)throw Error('Duplicate condition output folders');
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Provide the complete immutable source commit');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const captureToolSha256=hash(fs.readFileSync(__filename));
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
if(fs.existsSync(baseOut)&&fs.readdirSync(baseOut).length)throw Error('Capture output already exists; preserve the prior attempt');
fs.mkdirSync(baseOut, {recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.bin':'application/octet-stream'};
(async () => {
  const server=http.createServer((req,res)=>{
    let rel=decodeURIComponent(req.url.split('?')[0]); if(rel.endsWith('/'))rel+='index.html';
    const file=path.resolve(root,'.'+rel);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(err?'missing':bytes);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--mute-audio','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const batch=[];
    for(const phase of phases){
    ({season,weather,time}=phase);out=phase.name?path.join(baseOut,phase.name):baseOut;
    fs.mkdirSync(path.join(out,'images'),{recursive:true});
    const page=await browser.newPage({viewport:{width:960,height:640}}), errors=[], consoleErrors=[], validationFailures=[];
    page.setDefaultTimeout(300000); page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    await page.route(/api\.open-meteo\.com/,r=>r.fulfill({json:{error:true}}));
    const base='http://127.0.0.1:'+server.address().port+'/';
    await page.goto(base+'game/index.html?notrack&weather='+weather+'&season='+season,{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForFunction(()=>window.game,null,{timeout:180000});
    await page.addScriptTag({url:base+'game/dev/harness/visual/page/visual.js',type:'module'});
    await page.waitForFunction(()=>window.vqa,null,{timeout:180000});
    const loaded=await page.evaluate(o=>vqa.loadGroup('bucharest-'+o.district,{quality:'high',pr:1,traffic:true,time:o.time,weather:o.weather}),{district,time,weather});
    console.log('loaded',district,JSON.stringify(loaded));
    const integrity=await page.evaluate(()=>{
      const w=game.world,expected=w.district.landmarks||[],actual=w.landmarks.map(l=>({id:l.id,label:l.label,x:l.x,z:l.z})),ids=new Set(actual.map(l=>l.id)),s=w.stats;
      return {district:w.district.id,expectedLandmarks:expected,actualLandmarks:actual,missingLandmarks:expected.filter(id=>!ids.has(id)),roofProfiles:s.buildingRoofProfiles,assembliesRejected:s.buildingAssembliesRejected,unionsRejected:s.buildingUnionsRejected,sourceReplacements:s.landmarkSourceReplacements,parkingClearance:s.parkingClearance??null};
    });
    write('runtime-integrity.json',{gameSourceCommit:commit,...integrity});
    if(integrity.district!==district)errors.push('Loaded district does not match requested source district');
    if(integrity.missingLandmarks.length)errors.push('Missing actual district landmarks: '+integrity.missingLandmarks.join(','));
    if(integrity.roofProfiles.rejected.length)errors.push('Rejected native source roof profiles: '+integrity.roofProfiles.rejected.join(','));
    if(integrity.assembliesRejected.length||integrity.unionsRejected.length)errors.push('Rejected native source assembly/union geometry; see runtime-integrity.json');
    write('world-stats.json',await page.evaluate(()=>game.world.stats));
    const contacts=await page.evaluate(async()=>{
      const {buildingBlocksRoad}=await import('./src/world.js'),w=game.world,data=w.data,hits=[];
      let edges=0,points=0,publicEdges=0,privateEdges=0;
      for(const e of w.allEdges){
        if(e.virtual)continue;
        const source=data.roadSourceGeometry?.[e.road];if(!source)continue;
        edges++;if(e.publicDrive===false)privateEdges++;else publicEdges++;
        const count=Math.max(2,Math.ceil(e.len/2.5));
        for(let i=0;i<count;i++){
          const t=(i+.5)/count,roadY=.24+e.ya+(e.yb-e.ya)*t;
          for(const [side,offset]of [['centre',0],['right',e.wR*.9],['left',-e.wL*.9]]){
            const x=e.a.x+(e.b.x-e.a.x)*t+e.nx*offset,z=e.a.z+(e.b.z-e.a.z)*t+e.nz*offset;points++;
            w.buildings.query(x,z,.01,c=>{
              if(c.sourceId&&c.poly&&buildingBlocksRoad(c,x,z,roadY))hits.push({sourceRoadId:source.sourceId,sourceBuildingId:c.sourceId,edge:e.id,road:e.road,side,t,x,z,roadY,publicDrive:e.publicDrive!==false,derived:!!c.derived,widthM:e.wL+e.wR,widthSource:e.roadWidthSource??null});
            });
          }
        }
      }
      return {scope:'Runtime core source roads in world.allEdges. The separate whole-source road audit and north-up atlas cover scenery roads.',method:'Every runtime core source physical edge, including private and mapped passages, sampled at <=2.5 m and both 90% carriageway widths; actual runtime buildingBlocksRoad includes source holes, roof height and mapped passage solids. Sidewalks and broad clearance envelopes are not road samples.',edges,publicEdges,privateEdges,points,hits};
    });
    write('source-contact-probe.json',{gameSourceCommit:commit,district,...contacts});
    console.log('source contact probe',contacts.edges,'edges',contacts.points,'points',contacts.hits.length,'raw source hits');
    let views=await page.evaluate(async district=>{
      const THREE=await import('./vendor/three.module.min.js'), {collideBuildings}=await import('./src/world.js'), g=game, data=await(await import('./src/district-pack.js')).fetchDistrictPack('./data/bucharest-'+district+'.bin.gz');
      const {createFlightBoundary}=await import('./src/drone-boundary.js');
      window.contextFlightBoundary=createFlightBoundary(g.world.district.flightBoundary);window.contextProjection=data.proj;
      const views=[];
      for(const lm of g.world.landmarks){
        const box=new THREE.Box3().setFromObject(lm.mesh), c=box.getCenter(new THREE.Vector3());
        const r=Math.max(box.max.x-box.min.x,box.max.z-box.min.z,box.max.y-box.min.y,30);
        for(const [tag,dx,dz] of [['context',.85,1.25],['opposite',-.85,-1.25]])views.push({id:lm.id+'-'+tag,label:lm.label+' in district context',kind:'landmark-context',landmark:lm.id,x:c.x+dx*r,z:c.z+dz*r,y:Math.max(25,Math.min(150,(box.max.y-box.min.y)*.65+20)),target:[c.x,Math.min(box.max.y*.45,80),c.z],fov:70});
        if(['ambasador','europehouse','ase','rosetti','dinamo','politehnica'].includes(lm.id)){
          const candidates=[];
          for(const e of g.world.allEdges){
            if(e.virtual||e.bridge||e.tunnel||e.publicDrive===false||e.type==='service')continue;
            const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,ll=dx*dx+dz*dz;if(!ll)continue;
            const projected=Math.max(0,Math.min(1,((c.x-e.a.x)*dx+(c.z-e.a.z)*dz)/ll));
            for(const along of [0,-12,12,-25,25]){
              const t=Math.max(0,Math.min(1,projected+along/e.len)),x=e.a.x+dx*t,z=e.a.z+dz*t,range=Math.hypot(x-c.x,z-c.z);
              if(range>350)continue;
              const ground=g.world.roadHeight(x,z,e);
              if(collideBuildings(g.world.buildings,x,z,.25,ground+.05,1.7))continue;
              candidates.push({e,t,x,z,ground,range});
            }
          }
          candidates.sort((a,b)=>a.range-b.range||a.e.id-b.e.id);
          const near=candidates[0];if(!near)throw Error('No clear actual public-road camera body for '+lm.id);
          const {e,x,z,ground}=near;
          views.push({id:lm.id+'-street',label:lm.label+' from its actual public street',kind:'street',landmark:lm.id,sourceEdge:e.id,sourceRoadId:data.roadSourceGeometry?.[e.road]?.sourceId,x,z,y:1.7,absoluteY:ground+1.7,target:[c.x,Math.max(1.7,Math.min(box.max.y*.22,9)),c.z],fov:85,cameraBodyValidation:{method:'Production collideBuildings at actual public source-road centre and its exact native roadHeight, before capture; no offset toward or through the source facade',radiusM:.25,footY:ground+.05,heightM:1.7,clear:true}});
        }
        lm.mesh.traverse(source=>{
          const pitch=source.userData.footballPitch;
          if(pitch){const center=source.localToWorld(new THREE.Vector3(...pitch.center)),start=source.localToWorld(new THREE.Vector3(pitch.center[0]-pitch.axis[0]*45,1.7,pitch.center[2]-pitch.axis[1]*45));
            views.push({id:lm.id+'-football',label:'Dinamo pitch and goals at walking height',kind:'sports',x:start.x,z:start.z,y:1.7,target:[center.x,1.7,center.z],fov:85});
            const above=source.localToWorld(new THREE.Vector3(pitch.center[0]-pitch.axis[1]*60,70,pitch.center[2]+pitch.axis[0]*60));
            views.push({id:lm.id+'-football-drone',label:'Dinamo modeled pitch, goals and markings from a close elevated static camera',kind:'sports',x:above.x,z:above.z,y:above.y,target:[center.x,center.y,center.z],fov:80});
            for(const [tag,u,v,y]of [['lower',0,40,35],['oblique',-55,55,45]]){
              const pt=source.localToWorld(new THREE.Vector3(pitch.center[0]+pitch.axis[0]*u-pitch.axis[1]*v,y,pitch.center[2]+pitch.axis[1]*u+pitch.axis[0]*v));
              views.push({id:lm.id+'-football-drone-'+tag,label:'Dinamo unchanged physical paint at a native '+tag+' camera',kind:'sports',x:pt.x,z:pt.z,y:pt.y,target:[center.x,center.y,center.z],fov:80});
            }}
          const courts=source.userData.basketballCourt?.courts;
          if(courts)for(const [i,court]of courts.entries()){
            const center=source.localToWorld(new THREE.Vector3(...court.center)),rim=court.hoops[0]?.rim;if(!rim)continue;
            const target=source.localToWorld(new THREE.Vector3(...rim));views.push({id:lm.id+'-basketball-'+i,label:'Rosetti court '+(i+1)+' and actual hoop',kind:'sports',x:center.x,z:center.z,y:1.7,target:[target.x,target.y,target.z],fov:80});
          }
        });
      }
      // Source-policy defects include non-landmark building parts; preserve their actual source placement.
      const sourceTargets=district==='romana'?['w236091148','w236091150','w1527213313','w182932596']:[];
      for(const id of sourceTargets){
        const i=data.buildingIds.indexOf(id);if(i<0)continue;
        const ring=data.buildingFootprints[i],x=ring.reduce((s,q)=>s+q[0],0)/ring.length,z=ring.reduce((s,q)=>s+q[1],0)/ring.length,h=data.buildingDimensions?.[i]?.[0]??data.buildings[i][1]/10;
        views.push({id:id+'-facade',label:id+' source facade and roof',kind:'source-building',sourceId:id,x:x+40,z:z+55,y:Math.max(12,h*.6),target:[x,h*.4,z],fov:70});
      }
      const actualSignals=g.world.lights.filter(l=>g.world.district.inside(l.node.x,l.node.z)&&l.approaches.some(a=>!a.noPole&&a.y<2)).sort((a,b)=>Number(b.node.signal)-Number(a.node.signal)||b.approaches.length-a.approaches.length).slice(0,3);
      for(const [i,light]of actualSignals.entries()){
        const a=light.approaches.find(a=>!a.noPole&&a.y<2),e=a.edge;
        views.push({id:'signal-'+(i+1),label:'Actual runtime traffic signal and sidewalk activity',kind:'signals-pedestrians',sourceNodeId:light.node.sourceId,sourceSignalMapped:!!light.node.signal,sourceRoadId:data.roadSourceGeometry?.[e.road]?.sourceId,x:a.x+e.dirx*10,z:a.z+e.dirz*10,y:1.7,target:[a.x,a.y+3,a.z],fov:80});
      }
      const lots=new Map();
      for(const c of g.world.buildings)if(c.kind==='parked'&&c.parkingSourceId&&g.world.district.inside(c.x,c.z)){
        const list=lots.get(c.parkingSourceId)||[];list.push(c);lots.set(c.parkingSourceId,list);
      }
      for(const [i,[sourceId,cars]]of [...lots].sort((a,b)=>b[1].length-a[1].length).slice(0,3).entries()){
        const x=cars.reduce((s,c)=>s+c.x,0)/cars.length,z=cars.reduce((s,c)=>s+c.z,0)/cars.length,r=Math.max(18,...cars.map(c=>Math.hypot(c.x-x,c.z-z)));
        views.push({id:'parking-'+(i+1),label:'Actual source parking area and complete parked car placement',kind:'parking',parkingSourceId:sourceId,parkedCars:cars.length,x:x+r*.8,z:z+r,y:Math.min(80,r*.8+12),target:[x,0,z],fov:80});
      }
      const bridgeGroups=new Map();
      for(const deck of g.world.buildings)if(deck.roadDeck){const records=bridgeGroups.get(deck.sourceId)||[];records.push(deck);bridgeGroups.set(deck.sourceId,records);}
      for(const [sourceId,decks]of bridgeGroups){
        const deck=decks.reduce((a,b)=>a.y1>b.y1?a:b),c=deck.poly.reduce((p,q)=>[p[0]+q[0]/deck.poly.length,p[1]+q[1]/deck.poly.length],[0,0]),top=deck.roofHeightAt(...c),bottom=deck.minHeightAt(...c);
        const points=decks.flatMap(d=>d.poly),bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
        const side=[deck.poly[1][0]-deck.poly[0][0],deck.poly[1][1]-deck.poly[0][1]],len=Math.hypot(...side)||1,n=[-side[1]/len,side[0]/len],distance=Math.max(18,len*.7);
        const common={kind:'source-bridge',sourceId,renderedDeckBoundsXZ:bounds,passiveDeckQuads:decks.length,elevationSource:deck.elevationSource,anchor:{x:c[0],z:c[1],bottom,top}};
        views.push({...common,id:sourceId+'-bridge-above',label:sourceId+' actual passive source deck and approach context',x:c[0]+n[0]*distance,z:c[1]+n[1]*distance,y:Math.min(150,Math.max(35,top+30)),target:[c[0],top,c[1]],fov:80});
        views.push({...common,id:sourceId+'-bridge-side',label:sourceId+' actual local deck fascia and underside context',x:c[0]+n[0]*distance,z:c[1]+n[1]*distance,y:Math.max(1.7,bottom-1),target:[c[0],(bottom+top)/2,c[1]],fov:80});
      }
      const segments=g.world.district.flightBoundary.segments;
      for(const [tag,axis,sign] of [['west',0,-1],['east',0,1],['north',1,-1],['south',1,1]]){
        const points=segments.flatMap(s=>[[s.ax,s.az],[s.bx,s.bz]]),extreme=points.reduce((a,b)=>sign*b[axis]>sign*a[axis]?b:a)[axis];
        const edge=segments.find(s=>Math.abs((axis===0?s.ax:s.az)-extreme)<1e-7&&Math.abs((axis===0?s.bx:s.bz)-extreme)<1e-7);
        const p=edge?[(edge.ax+edge.bx)/2,(edge.az+edge.bz)/2]:points.find(p=>Math.abs(p[axis]-extreme)<1e-7),q=[...p];q[axis]+=sign*149;
        const target=[q[0],25,q[1]];target[axis===0?0:2]+=sign*220;
        views.push({id:'drone-edge-'+tag,label:'Outward '+tag+' view at 149 m from actual flight-domain boundary',kind:'drone-edge',boundaryPoint:p,boundarySource:'runtime playable source mask and declared landmark flight areas',x:q[0],z:q[1],y:120,target,fov:75,staticCamera:true,controllerExercised:false});
      }
      const starts=(await import('./src/cities.js')).CHAPTERS.filter(c=>c.district===district);
      for(const c of starts){const p=g.city.proj(c.start.lat,c.start.lon),a=(c.start.heading??c.start.bearing??0)*Math.PI/180;views.push({id:'chapter-'+c.id+'-street',chapterId:c.id,label:c.id+' actual chapter start street view',kind:'street',x:p.x,z:p.z,y:1.7,target:[p.x+Math.sin(a)*50,1.7,p.z-Math.cos(a)*50],fov:80});}
      return views;
    },district);
    if(arg('only'))views=views.filter(v=>arg('only').split(',').some(token=>v.id.includes(token)));
    if(new Set(views.map(v=>v.id)).size!==views.length)throw Error('Duplicate context view IDs; retain raw attempt and correct the view plan before recapture');
    const results=[];
    for(const view of views){
      const observed=await page.evaluate(async v=>{
        const THREE=await import('./vendor/three.module.min.js'),g=game,S=vqa.S,cam=g.camera;
        if(v.assertNativeClip&&(cam.near!==.2||cam.far!==5000))throw Error('Native camera clipping changed: '+cam.near+'/'+cam.far);
        g.player.place(v.x,v.z,0);g.traffic.setPlayer(g.player);for(let i=0;i<30;i++)g.traffic.update(1/30);g.traffic.peds?.writeMatrices?.();
        g.scene.add(cam);g.world.camera=cam;if(g.player.rig)g.player.rig.visible=false;
        const ground=v.kind==='street'?g.world.roadHeight(v.x,v.z):0;cam.position.set(v.x,Number.isFinite(v.absoluteY)?v.absoluteY:ground+v.y,v.z);cam.lookAt(...v.target);cam.fov=v.fov;cam.aspect=1.5;cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
        vqa.hideHud(true);for(const el of document.body.children)if(el!==g.renderer.domElement&&!el.contains(g.renderer.domElement))el.style.visibility='hidden';
        S.renderNow=true;try{g.drawFrame({mirror:false});g.renderer.info.reset();g.drawFrame({mirror:false});}finally{S.renderNow=false;}
        const p=window.contextProjection;
        const direction=cam.getWorldDirection(new THREE.Vector3());
        const heading=(Math.atan2(direction.x,-direction.z)*180/Math.PI+360)%360,pitch=Math.asin(Math.max(-1,Math.min(1,direction.y)))*180/Math.PI;
        const nearPeds=(g.traffic.peds?.list||[]).filter(p=>Math.hypot(p.x-v.x,p.z-v.z)<60).map(p=>({x:p.x,z:p.z,state:p.state,onRoad:p.onRoad,sourceRoadId:g.world.data.roadSourceGeometry?.[p.e?.road]?.sourceId??null}));
        return {cameraY:cam.position.y,groundY:ground,heading,pitch,aspect:cam.aspect,pose:{x:cam.position.x,y:cam.position.y,z:cam.position.z,heading,pitch,fov:cam.fov,aspect:cam.aspect,near:cam.near,far:cam.far,quaternion:cam.quaternion.toArray()},observedConditions:{gameClockOverride:g.clock.override,rendererClockOverride:g.r3d.clock?.override,seasonOverride:g.r3d._seasonOverride,weatherOverride:g.r3d._wxOverride,weather:g.r3d.weather,season:g.r3d._season,sunElevation:g.r3d.sunElevation},perf:{...g.r3d.stats},inPlayable:g.world.district.inside(v.x,v.z),inFlightEnvelope:window.contextFlightBoundary.allowed({x:v.x,z:v.z}),distanceFromFlightDomainM:window.contextFlightBoundary.sample(v.x,v.z).distance,pedestriansWithin60m:nearPeds,vehiclesWithin60m:g.traffic.vehicles.filter(c=>Math.hypot(c.x-v.x,c.z-v.z)<60).length,lat:p.lat0-v.z/p.mPerLat,lon:p.lon0+v.x/p.mPerLon};
      },{...view,assertNativeClip:arg('native-clip')==='true'});
      if(arg('native-clip')==='true'&&(observed.pose.near!==.2||observed.pose.far!==5000))validationFailures.push({id:view.id,type:'Native camera clip changed during drawFrame',expected:{near:.2,far:5000},actual:{near:observed.pose.near,far:observed.pose.far}});
      const image='images/'+view.id+'.jpg';await page.screenshot({path:path.join(out,image),type:'jpeg',quality:88,timeout:180000});
      results.push({...view,...observed,image,width:960,height:640,gameSourceCommit:commit,capturedAt:new Date().toISOString(),sha256:hash(fs.readFileSync(path.join(out,image))),captureType:'game-perspective-context',comparisonCompatible:false,staticCamera:true,controllerExercised:false,condition:{season,weather,time,quality:'high',traffic:true,mirror:false}});
      write('progress.json',{captured:results.length,total:views.length,last:view.id});console.log('capture',results.length+'/'+views.length,view.id);
    }
    write('world-stats.json',await page.evaluate(()=>game.world.stats));
    write('manifest.json',{schemaVersion:1,captureType:'game-perspective-context',comparisonCompatible:false,gameSourceCommit:commit,captureTool:{name:'capture-pitch-paint.cjs',sha256:captureToolSha256},district,season,weather,time,quality:'high',traffic:true,mirror:false,scope:'Game-only static cameras in the complete running district. Outward envelope poses do not exercise the drone controller. Counts are per camera and are separate from full driving/mirror budget acceptance.',loaded,pageErrors:errors,consoleErrors,validationFailures,items:results});
    if(errors.length||consoleErrors.length||validationFailures.length)process.exitCode=1;
    batch.push({condition:phase.name,frames:results.length,pageErrors:errors,consoleErrors,validationFailures});
    await page.close();
    }
    if(phases.length>1)fs.writeFileSync(path.join(baseOut,'batch-summary.json'),JSON.stringify({gameSourceCommit:commit,oneBrowser:true,conditions:batch},null,2)+'\n');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
