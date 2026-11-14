import {SITUATIONAL_DIALOGUE,SITUATIONAL_DIALOGUE_KINDS,SITUATIONAL_DIALOGUE_VERSION} from './situational-dialogue-library.js';

const byId=new Map(SITUATIONAL_DIALOGUE.map(l=>[l.id,l])), index=new Map();
for(const line of SITUATIONAL_DIALOGUE)for(const kind of line.kinds){const key=`${line.locale}:${kind}`;if(!index.has(key))index.set(key,[]);index.get(key).push(line);}
const ROLES=new Set(['driver','pedestrian','staff']), RELATIONS=new Set(['source','recipient','witness','participant','conversant']);
const KINDS=new Set(SITUATIONAL_DIALOGUE_KINDS), COLLISIONS=new Set(['vehicle','pedestrian','static']);
const WEATHER=new Set(['rain','snow','clear','cloud','fog']);
const SITUATIONAL_DIALOGUE_LIMITS=Object.freeze({maxRecentLines:64,maxEvents:96,maxPairs:128,maxSpeakers:96,maxPending:4,maxResponsesPerEvent:2,lineCooldownMs:45000,lineRetentionMs:120000,eventRetentionMs:30000,pairCooldownMs:12000,speakerCooldownMs:6500,pendingTtlMs:1200,eventMaxAgeMs:2500});
const id=value=>typeof value==='string'&&value.length>0&&value.length<=96?value:null;
function hash(parts){let h=2166136261;const text=JSON.stringify(parts);for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);return(h^(h>>>16))>>>0;}
function normalize(request){
 const e=request?.event,s=request?.speaker,c=request?.context;
 if(!e||!s||!c||e.confirmed!==true||s.eligible!==true||!KINDS.has(e.kind)||!id(e.id)||!id(e.sourceId)||!id(s.id)||!ROLES.has(s.role)||!RELATIONS.has(s.relation)||(!Number.isFinite(e.atMs)||e.atMs<0))return null;
 if(e.targetId!=null&&!id(e.targetId))return null;
 const targetId=e.targetId??null,physical=e.kind==='player-honk'||e.kind==='npc-honk'||e.kind==='collision';
 if(s.relation==='source'&&s.id!==e.sourceId)return null;
 if(s.relation==='recipient'&&s.id!==targetId)return null;
 if(s.relation==='participant'&&(e.kind!=='collision'||(s.id!==e.sourceId&&s.id!==targetId)))return null;
 if(physical&&s.relation==='witness'&&(s.id===e.sourceId||s.id===targetId))return null;
 if(s.relation==='conversant'&&e.kind!=='greeting')return null;
 const f=e.facts||{};
 if(e.kind==='collision'&&(f.contact!==true||!COLLISIONS.has(f.collisionType)))return null;
 if(e.kind==='waiting'&&f.queued!==true)return null;
 const locale=c.city==='bucharest'?'bucharest':c.city==='seattle'?(c.district==='bellevue'?'bellevue':'seattle'):null;
 if(!locale)return null;
 if(c.placeIds!=null&&(!Array.isArray(c.placeIds)||c.placeIds.length>16||c.placeIds.some(p=>typeof p!=='string'||p.length>64)))return null;
 const facts={};for(const key of ['contact','collisionType','playerCausedContact','queued','speakerSignal','speakerWalkSignal'])if(Object.hasOwn(f,key))facts[key]=f[key];
 const calendar=c.calendar,validCalendar=calendar&&Number.isInteger(calendar.month)&&calendar.month>=1&&calendar.month<=12&&Number.isInteger(calendar.day)&&calendar.day>=1&&calendar.day<=[31,29,31,30,31,30,31,31,30,31,30,31][calendar.month-1];
 return {eventId:e.id,kind:e.kind,sourceId:e.sourceId,targetId,atMs:e.atMs,speakerId:s.id,role:s.role,relation:s.relation,locale,places:c.placeIds||[],facts,
  localHour:Number.isFinite(c.localHour)&&c.localHour>=0&&c.localHour<24?c.localHour:null,
  weather:c.weatherObserved===true&&WEATHER.has(c.weatherKind)?c.weatherKind:null,
  temperatureC:c.weatherObserved===true&&Number.isFinite(c.temperatureC)?c.temperatureC:null,
  calendar:validCalendar?{month:calendar.month,day:calendar.day}:null,
 };
}
function fits(line,r){
 if(!line.roles.includes(r.role)||!line.relations.includes(r.relation))return false;
 if(line.places&&!line.places.some(p=>r.places.includes(p)))return false;
 if(line.hours){if(r.localHour===null)return false;const[a,b]=line.hours;if(a<b?!(r.localHour>=a&&r.localHour<b):!(r.localHour>=a||r.localHour<b))return false;}
 if(line.weather&&line.weather!==r.weather)return false;
 if(line.minTemperatureC!=null&&(r.temperatureC===null||r.temperatureC<line.minTemperatureC))return false;
 if(line.maxTemperatureC!=null&&(r.temperatureC===null||r.temperatureC>line.maxTemperatureC))return false;
 if(line.calendar&&(!r.calendar||line.calendar.month!==r.calendar.month||line.calendar.day!==r.calendar.day))return false;
 if(line.facts)for(const[key,value]of Object.entries(line.facts))if(r.facts[key]!==value)return false;
 return true;
}
/** Pure coverage/filter inspection; not an event trigger or actor query. */
function situationalDialogueCandidates(request){const r=normalize(request);return r?(index.get(`${r.locale}:${r.kind}`)||[]).filter(l=>fits(l,r)):[];}
function settings(options){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!Object.hasOwn(SITUATIONAL_DIALOGUE_LIMITS,k)))throw new TypeError('Only known numeric dialogue limits are accepted');
 const s={...SITUATIONAL_DIALOGUE_LIMITS,...options};
 for(const[key,cap]of Object.entries({maxRecentLines:128,maxEvents:256,maxPairs:256,maxSpeakers:256,maxPending:8,maxResponsesPerEvent:3}))if(!Number.isInteger(s[key])||s[key]<1||s[key]>cap)throw new RangeError(`Invalid bounded dialogue limit: ${key}`);
 for(const[key,cap]of Object.entries({lineCooldownMs:120000,lineRetentionMs:300000,eventRetentionMs:120000,pairCooldownMs:60000,speakerCooldownMs:60000,pendingTtlMs:3000,eventMaxAgeMs:5000}))if(!Number.isFinite(s[key])||s[key]<0||s[key]>cap)throw new RangeError(`Invalid dialogue duration: ${key}`);
 if(s.pendingTtlMs===0||s.eventMaxAgeMs===0||s.lineRetentionMs<s.lineCooldownMs||s.eventRetentionMs<s.eventMaxAgeMs+s.pendingTtlMs)throw new RangeError('Dialogue retention must cover active cooldown/event windows');
 return Object.freeze(s);
}
function boundedSet(map,key,value,cap){map.delete(key);map.set(key,value);while(map.size>cap)map.delete(map.keys().next().value);}
const signature=r=>JSON.stringify([r.kind,r.sourceId,r.targetId]);
function pairKey(r){const other=r.speakerId===r.sourceId?(r.targetId||r.sourceId):r.speakerId;return JSON.stringify([r.kind,...[r.sourceId,other].sort()]);}
function specificity(l){return(l.places?2:0)+(l.hours?1:0)+(l.weather?1:0)+(l.calendar?2:0)+(l.minTemperatureC!=null||l.maxTemperatureC!=null?1:0)+(l.facts?Object.keys(l.facts).length:0);}

/**
 * Event-driven, deterministic offer/settle governor. Owns only bounded primitive
 * metadata: no actor/context/renderer/DOM/callback references, timers or RNG.
 * There is no event queue (capacity zero); at most maxPending short reservations.
 * Root alone confirms events, chooses nearby same-level eligible speakers and
 * presents through Traffic.say/HUD. Only accepted presentation earns cooldowns.
 */
export function createSituationalDialogue({seed='situational-dialogue-v1',limits={}}={}){
 if(typeof seed!=='string'||!seed.length||seed.length>128)throw new TypeError('Use a stable independent dialogue seed up to 128 characters');
 const cfg=settings(limits);limits=null;const recent=new Map(),events=new Map(),pairs=new Map(),speakers=new Map(),pending=new Map();
 let disposed=false,lastNow=-Infinity,serial=0,lastReason='',offered=0,acceptedCount=0,rejected=0,expired=0;
 const reject=reason=>{lastReason=reason;rejected++;return null;};
 function time(now){if(disposed){lastReason='disposed';return false;}if(!Number.isFinite(now)||now<0||now<lastNow){lastReason='invalid-monotonic-time';return false;}lastNow=now;return true;}
 function prune(now){
  for(const[k,v]of recent)if(now-v>=cfg.lineRetentionMs)recent.delete(k);
  for(const[k,v]of events)if(now-v.at>=cfg.eventRetentionMs)events.delete(k);
  for(const[k,v]of pairs)if(now>=v)pairs.delete(k);
  for(const[k,v]of speakers)if(now>=v)speakers.delete(k);
  for(const[k,v]of pending)if(now>=v.expires){pending.delete(k);expired++;}
 }
 return {
  get disposed(){return disposed;},get lastReason(){return lastReason;},
  get diagnostics(){return{offered,accepted:acceptedCount,rejected,expired,queue:0,recentLines:recent.size,events:events.size,pairs:pairs.size,speakers:speakers.size,pending:pending.size};},
  offer(request){
   const now=request?.nowMs;if(!time(now))return null;prune(now);const r=normalize(request);
   if(!r)return reject('ineligible-or-unconfirmed');
   if(r.atMs>now||now-r.atMs>cfg.eventMaxAgeMs)return reject('stale-or-future-event');
   const sig=signature(r),ev=events.get(r.eventId),reservations=[...pending.values()].filter(v=>v.eventId===r.eventId);
   if((ev&&ev.signature!==sig)||reservations.some(v=>v.signature!==sig))return reject('event-id-reused');
   if((ev?.count||0)+reservations.length>=cfg.maxResponsesPerEvent)return reject('event-cap');
   if(ev?.speakerIds.includes(r.speakerId)||reservations.some(v=>v.speakerId===r.speakerId))return reject('event-speaker-repeat');
   if(speakers.has(r.speakerId)||[...pending.values()].some(v=>v.speakerId===r.speakerId))return reject('speaker-cooldown');
   const pair=pairKey(r);if(pairs.has(pair)||[...pending.values()].some(v=>v.pair===pair))return reject('pair-cooldown');
   if(pending.size>=cfg.maxPending)return reject('pending-cap');
   const all=(index.get(`${r.locale}:${r.kind}`)||[]).filter(l=>fits(l,r));
   if(!all.length)return reject('no-context-line');
   const reserved=new Set([...pending.values()].map(v=>v.lineId)),fresh=all.filter(l=>!reserved.has(l.id)&&(!recent.has(l.id)||now-recent.get(l.id)>=cfg.lineCooldownMs));
   if(!fresh.length)return reject('line-cooldown');
   let line=null,best=Infinity;
   for(const l of fresh){const score=(hash([seed,r.eventId,r.speakerId,l.id])+1)/(1+specificity(l)*2);if(score<best||(score===best&&l.id<line.id)){best=score;line=l;}}
   serial=serial>=Number.MAX_SAFE_INTEGER?1:serial+1;const token=`${hash([seed,r.eventId,r.speakerId,line.id,now]).toString(36)}-${serial}`;
   pending.set(token,{eventId:r.eventId,signature:sig,speakerId:r.speakerId,pair,lineId:line.id,expires:now+cfg.pendingTtlMs});offered++;lastReason='offered';
   return Object.freeze({token,line:Object.freeze({id:line.id,t:line.t,en:line.en}),priority:r.kind==='greeting'?3:r.kind==='collision'?2:1,cls:r.kind==='collision'?'angry':'',expiresAtMs:now+cfg.pendingTtlMs});
  },
  settle(token,accepted,now){
   if(!time(now))return false;prune(now);const p=pending.get(token);if(!p){lastReason='unknown-or-expired-offer';return false;}pending.delete(token);
   if(accepted!==true){lastReason='presentation-rejected';return false;}
   const ev=events.get(p.eventId);if(ev&&ev.count>=cfg.maxResponsesPerEvent){lastReason='event-cap';return false;}
   boundedSet(recent,p.lineId,now,cfg.maxRecentLines);
   boundedSet(events,p.eventId,{signature:p.signature,at:now,count:(ev?.count||0)+1,speakerIds:[...(ev?.speakerIds||[]),p.speakerId]},cfg.maxEvents);
   boundedSet(pairs,p.pair,now+cfg.pairCooldownMs,cfg.maxPairs);boundedSet(speakers,p.speakerId,now+cfg.speakerCooldownMs,cfg.maxSpeakers);acceptedCount++;lastReason='accepted';return true;
  },
  exportRecent(now){if(!time(now))return null;prune(now);return{version:1,libraryVersion:SITUATIONAL_DIALOGUE_VERSION,recent:[...recent].map(([id,at])=>({id,ageMs:now-at}))};},
  importRecent(snapshot,now){
   if(!time(now))return false;prune(now);if(snapshot?.version!==1||snapshot.libraryVersion!==SITUATIONAL_DIALOGUE_VERSION||!Array.isArray(snapshot.recent))return false;
   for(const value of snapshot.recent.slice(-cfg.maxRecentLines))if(byId.has(value?.id)&&Number.isFinite(value.ageMs)&&value.ageMs>=0&&value.ageMs<cfg.lineRetentionMs)boundedSet(recent,value.id,now-value.ageMs,cfg.maxRecentLines);
   return true;
  },
  dispose(){if(disposed)return;disposed=true;recent.clear();events.clear();pairs.clear();speakers.clear();pending.clear();seed='';lastReason='disposed';},
 };
}
