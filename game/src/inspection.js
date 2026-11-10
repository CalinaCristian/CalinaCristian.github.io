// Opt-in owner bug-reporting tools. No listeners, timers or DOM in normal play.
const enabled = new URLSearchParams(globalThis.location?.search || '').get('inspect') === '1';
export const inspectionEnabled = search => search === undefined ? enabled : new URLSearchParams(search).get('inspect') === '1';
const rounded = (v, digits = 3) => Number.isFinite(v) ? +v.toFixed(digits) : null;
export function inspectionReport(g) {
    const spot = g.state === 'spot' ? g.spot?.spot : null, drone = g.explore?.drone;
    const camera = g.camera, eye = camera?.getWorldPosition(camera.position.clone()), direction = camera?.getWorldDirection(camera.position.clone());
    const actor = drone?.active ? eye : spot ? g.spot.ctl : g.state === 'foot' ? g.foot : g.player;
    const position = actor ? {x:rounded(actor.x),y:rounded(actor.y),z:rounded(actor.z)} : null;
    let geographic = null;
    if (position && spot) {
        const {origin, projection} = spot.data;
        // Allocated Easter-egg interiors have their own local coordinates.
        if (origin && projection && Math.hypot(actor.x, actor.z) < 4000) geographic = {lat:rounded(origin.lat-actor.z/projection.mLat,7),lon:rounded(origin.lon+actor.x/projection.mLon,7)};
    } else if (position && g.city?.proj?.inverse) geographic = g.city.proj.inverse(actor.x,actor.z);
    return {schemaVersion:1,inspection:true,reportedAt:new Date().toISOString(),release:document.querySelector('meta[name="game-release"]')?.content,source:document.querySelector('meta[name="game-source"]')?.content,
        city:spot?.city||g.city?.id,district:spot?null:g.district,visit:spot?.entry?.id||g.spot?.entry?.id||null,scene:spot?.data?.id||g.district,office:g.state==='office'?g.office?.stop?.id:null,mode:g.state,drone:!!drone?.active,
        geographic:geographic&&{lat:rounded(geographic.lat,7),lon:rounded(geographic.lon,7)},position,
        camera:eye&&{eye:eye.toArray().map(v=>rounded(v)),bearing:rounded((Math.atan2(direction.x,-direction.z)*180/Math.PI+360)%360),pitch:rounded(Math.asin(direction.y)*180/Math.PI),fov:camera.fov},
        conditions:{date:g.r3d?.simDate?.toISOString(),timeZone:g.r3d?.clock?.timeZone,weather:g.r3d?.weather?.kind,season:g.r3d?._seasonOverride||g.r3d?.weather?.season},
        performance:{...g.r3d?.stats,trafficUpdateMs:rounded(g.traffic?.stats?.updateMs),vehicles:g.traffic?.vehicles?.length,pedestrians:g.traffic?.peds?.list?.length},url:location.origin+location.pathname+'?inspect=1'};
}
export function mountInspection(g) {
    if (!inspectionEnabled()) return null;
    const root=document.createElement('aside');root.id='inspection-tools';root.setAttribute('aria-label','Bug inspection tools');
    root.innerHTML='<output aria-label="Current coordinates"></output><div><button type="button" data-inspect="copy">Copy location · F8</button><button type="button" data-inspect="places">Places</button><button type="button" data-inspect="drone">Drone · G</button></div><small>Inspection · unrestricted drone range / altitude / battery</small><p role="status"></p>';
    const style=document.createElement('style');style.textContent='#inspection-tools{position:fixed;left:12px;bottom:64px;z-index:35;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid #ffffff55;border-radius:9px;background:#10212de8;color:white;font:12px/1.5 system-ui;pointer-events:auto}#inspection-tools output{display:block;white-space:pre-line;font-family:monospace}#inspection-tools button{font:inherit;min-height:36px;margin:6px 6px 4px 0;padding:4px 9px;background:#f8fafc;color:#10212d;border:0;border-radius:5px;cursor:pointer}#inspection-tools p{margin:0}#inspection-tools small{opacity:.8}@media(max-width:600px){#inspection-tools{bottom:150px;font-size:10px;max-width:calc(100vw - 24px)}}';document.head.append(style);document.body.append(root);
    const status=root.querySelector('[role=status]');let expires=0;
    async function copy(){const text=JSON.stringify(inspectionReport(g),null,2);let copied=false;try{await navigator.clipboard.writeText(text);copied=true;}catch{const area=document.createElement('textarea');area.value=text;area.setAttribute('aria-label','Bug report to copy');root.append(area);area.select();try{copied=document.execCommand('copy');}catch{}if(copied)area.remove();}status.textContent=copied?'Location report copied.':'Select the report text and copy it.';expires=performance.now()+5000;}
    async function places(){document.exitPointerLock?.();if(g.explore?.drone?.active)g.explore.drone.abort();await g.explore?.roam();}
    root.querySelector('[data-inspect=copy]').addEventListener('click',copy);
    root.querySelector('[data-inspect=places]').addEventListener('click',places);
    root.querySelector('[data-inspect=drone]').addEventListener('click',async()=>{if(g.state==='drive')g.exitCar();const d=g.explore?.drone;if(d?.active)d.land();else if(d&&!d.deploy()){status.textContent=d.canDeploy().reason;expires=performance.now()+5000;}});
    const key=e=>{if(e.code==='F8'&&!e.repeat){e.preventDefault();copy();}};addEventListener('keydown',key);
    const tick=()=>{const r=inspectionReport(g),p=r.position;root.hidden=!p||g.state==='menu';if(!p)return;root.querySelector('output').textContent=`${r.visit||r.district||r.scene} · ${r.drone?'drone':r.mode}\n${r.geographic?`${r.geographic.lat.toFixed(7)}, ${r.geographic.lon.toFixed(7)}`:'Interior local coordinates'}\nx ${p.x}  y ${p.y}  z ${p.z}`;if(expires&&performance.now()>expires){status.textContent='';expires=0;}};
    const timer=setInterval(tick,250);tick();return {copy,report:()=>inspectionReport(g),dispose(){clearInterval(timer);removeEventListener('keydown',key);root.remove();style.remove();}};
}
