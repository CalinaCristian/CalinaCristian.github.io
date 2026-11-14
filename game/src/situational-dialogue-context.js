// Source identities are retained OSM building/area IDs, never name guesses.
// The original source arrays/actors are not modified or rescaled.
const DIALOGUE_PLACE_SOURCES=Object.freeze([
 {tag:'carusel',ids:['w658009149'],margin:18},
 {tag:'freddo',ids:['w657568283'],margin:18},
 {tag:'arc-de-triumf',ids:['w1190798203','w217851530'],margin:30},
 {tag:'hermes',ids:['w533147567','w231123137','r6774709'],margin:20},
 {tag:'bob-tower',ids:['w55450549'],margin:20},
 {tag:'lincoln-square',ids:['w604028609','w161929514'],margin:18},
 {tag:'seattle-center',ids:['w12903132'],margin:35},
 {tag:'pike-place',ids:['w363400641'],margin:12},
 {tag:'cismigiu',ids:['w16291869'],margin:8},
 {tag:'downtown-park',ids:['w24547844'],margin:8},
 {tag:'meydenbauer-bay',ids:['w57883263'],margin:8},
].map(r=>Object.freeze({...r,ids:Object.freeze(r.ids)})));
const inside=(x,z,ring)=>{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
function nearRing(x,z,ring,r){for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<=r)return true;}return false;}
/** Compile only the few known native source rings once, not per actor/frame. */
export function compileDialoguePlaces(world){
 const wanted=new Map(DIALOGUE_PLACE_SOURCES.flatMap(r=>r.ids.map(id=>[id,r]))),entries=[];
 const add=(id,outer,holes=[])=>{const binding=wanted.get(id);if(!binding||!Array.isArray(outer)||outer.length<3||!outer.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return;entries.push({tag:binding.tag,sourceId:id,margin:binding.margin,outer:outer.map(p=>[...p]),holes:holes.map(r=>r.map(p=>[...p]))});};
 for(const area of world?.areas||[])add(area?.sourceId,area?.outer,area?.holes||[]);
 const d=world?.data;
 for(let i=0;i<(d?.buildingIds?.length||0);i++)if(wanted.has(d.buildingIds[i]))add(d.buildingIds[i],d.buildingFootprints?.[i],d.buildingHoleFootprints?.[i]||[]);
 return{get count(){return entries.length;},at(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return[];const tags=[...new Set(entries.filter(e=>!e.holes.some(h=>inside(x,z,h))&&(inside(x,z,e.outer)||nearRing(x,z,e.outer,e.margin))).map(e=>e.tag))];if(tags.includes('carusel')||tags.includes('freddo'))tags.push('old-town');return tags;},dispose(){entries.length=0;wanted.clear();}};
}
/** Positively known SIMULATION condition, including explicit game overrides. */
function knownDialogueWeather(host){
 const w=host?.weather;if(!w||typeof w!=='object')return{weatherObserved:false};
 const code=w.code,override=host.weatherOverride,label=String(w.kind||w.label||'').toLowerCase();let kind=null;
 if(override==='snow'||(typeof code==='number'&&((code>=71&&code<=77)||code===85||code===86))||(/snow|blizzard|flurr/.test(label)&&!/ground|cover/.test(label)))kind='snow';
 else if(['rain','drizzle'].includes(override)||(typeof code==='number'&&((code>=51&&code<=67)||(code>=80&&code<=82)))||/rain|drizzle|shower/.test(label)||(w.precipMm??0)>.1)kind='rain';
 else if(override==='clear'||code===0||code===1||label==='clear')kind='clear';
 else if(override==='cloudy'||(typeof code==='number'&&[2,3].includes(code))||/cloud|overcast/.test(label))kind='cloud';
 else if(override==='fog'||[45,48].includes(code)||/fog|mist/.test(label))kind='fog';
 const temperatureC=Number.isFinite(w.tempC)?w.tempC:null;
 return{weatherObserved:kind!==null||temperatureC!==null,weatherKind:kind,...(temperatureC!==null?{temperatureC}:{})};
}
export function currentDialogueContext(host,places,actor){
 const context={city:host?.city?.id,district:host?.district,placeIds:places.at(actor.x,actor.z),...knownDialogueWeather(host)};
 try{const h=Number.isFinite(host.clock?.hours)?host.clock.hours:host.cityHours?.();if(Number.isFinite(h)&&h>=0&&h<24)context.localHour=h;}catch{}
 try{const date=host.nowDate(),tz=host.clock?.timeZone;if(date instanceof Date&&Number.isFinite(date.getTime())&&typeof tz==='string'){const parts=new Intl.DateTimeFormat('en',{timeZone:tz,month:'numeric',day:'numeric'}).formatToParts(date),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));context.calendar={month:+v.month,day:+v.day};}}catch{}
 return context;
}
/** Use actual displayed feet, not a guessed streetY for a bridge/underpass. */
export function dialogueActorY(actor,role,world){
 if(!actor)return null;
 if(role==='driver'||role==='player')return Number.isFinite(actor.y)?actor.y:Number.isFinite(actor.surfY)?actor.surfY:null;
 if(Number.isFinite(actor._fy)&&Number.isFinite(actor._fyx)&&Math.abs(actor.x-actor._fyx)+Math.abs(actor.z-actor._fyz)<=.5)return actor._fy;
 if(typeof world?.walkTop==='function'){try{const y=world.walkTop(actor.x,actor.z);return Number.isFinite(y)?y+.01:null;}catch{return null;}}
 return null;
}
