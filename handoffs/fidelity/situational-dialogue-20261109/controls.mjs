import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate as turn} from 'node:timers/promises';
import {SITUATIONAL_DIALOGUE,situationalDialogueCoverage} from '../../../game/src/situational-dialogue-library.js';
import {createSituationalDialogue,situationalDialogueCandidates,SITUATIONAL_DIALOGUE_LIMITS} from '../../../game/src/situational-dialogue.js';
import {Traffic} from '../../../game/src/traffic.js';
import {makeRng} from '../../../game/src/util.js';
const checks=[],check=(name,fn)=>{fn();checks.push(name);};
const byId=new Map(SITUATIONAL_DIALOGUE.map(l=>[l.id,l]));
function request({now=100,eventId='horn-1',kind='player-honk',sourceId='player',targetId=null,role='driver',relation='witness',speakerId='driver-1',city='bucharest',district='romana',facts={},context={},event={}}={}){
 return {nowMs:now,event:{id:eventId,kind,sourceId,targetId,atMs:now,confirmed:true,facts,...event},speaker:{id:speakerId,role,relation,eligible:true},context:{city,district,...context}};
}
const candidates=r=>situationalDialogueCandidates(r),ids=r=>candidates(r).map(l=>l.id),has=(r,prefix)=>ids(r).some(id=>id.startsWith(prefix));
const accept=(g,r)=>{const p=g.offer(r);if(p)assert.equal(g.settle(p.token,true,r.nowMs),true);return p;};
check('315 original lines have stable unique IDs/text within each locale, immutable rules and complete Romanian glosses',()=>{
 const coverage=situationalDialogueCoverage();assert.equal(coverage.total,315);assert.deepEqual(Object.fromEntries(Object.entries(coverage.locales).map(([k,v])=>[k,v.lines])),{bucharest:119,seattle:96,bellevue:100});assert.equal(byId.size,315);
 const seen=new Set();for(const l of SITUATIONAL_DIALOGUE){assert.ok(Object.isFrozen(l)&&Object.isFrozen(l.kinds)&&Object.isFrozen(l.roles)&&Object.isFrozen(l.relations));assert.ok(l.t.length<200&&l.t.length>4);if(l.locale==='bucharest')assert.ok(l.en.length>4&&l.en!==l.t);assert.ok(!seen.has(l.locale+':'+l.t));seen.add(l.locale+':'+l.t);}
 assert.deepEqual(coverage.wiredEvents,[]);assert.deepEqual(coverage.nativeProvedEvents,[]);
});
check('unconfirmed/ineligible/unknown-city/invalid-identity requests never offer or earn cooldowns',()=>{
 const g=createSituationalDialogue();for(const mutate of[r=>r.event.confirmed=false,r=>r.event.atMs=-1,r=>r.speaker.eligible=false,r=>r.context.city='unknown',r=>r.event.sourceId='',r=>r.speaker.id='x'.repeat(97),r=>r.speaker.role='unknown',r=>r.context.placeIds=Array(17).fill('carusel')]){const r=request();mutate(r);assert.equal(g.offer(r),null);}assert.equal(g.diagnostics.offered,0);assert.equal(g.diagnostics.events,0);
});
check('preventative overlap/proximity without confirmed contact cannot select any crash dialogue',()=>{
 for(const collisionType of['vehicle','pedestrian','static','unknown']){const r=request({kind:'collision',targetId:'driver-1',relation:'participant',facts:{contact:false,collisionType}});assert.deepEqual(candidates(r),[]);}assert.deepEqual(candidates(request({kind:'collision',targetId:'driver-1',relation:'participant',facts:{contact:true,collisionType:'unknown'}})),[]);
});
check('NPC horn source/recipient/witness identities are distinct and unknown recipients receive no targeted role',()=>{
 const source=request({kind:'npc-honk',sourceId:'npc-1',speakerId:'npc-1',relation:'source'});assert.ok(candidates(source).length>=8);assert.ok(ids(source).every(id=>id.startsWith('buc.npc.source')));
 assert.deepEqual(candidates({...source,speaker:{...source.speaker,id:'npc-2'}}),[]);
 const recipient=request({kind:'npc-honk',sourceId:'npc-1',speakerId:'npc-2',relation:'recipient'});assert.deepEqual(candidates(recipient),[]);recipient.event.targetId='npc-2';assert.ok(candidates(recipient).length>0);recipient.speaker.relation='witness';assert.deepEqual(candidates(recipient),[]);
 const noRecipient=request({kind:'npc-honk',sourceId:'npc-1',speakerId:'npc-2'});assert.ok(ids(noRecipient).every(id=>id.startsWith('buc.horn.witness')));
});
check('all3locales strictly separate driver/pedestrian/contact contexts and Bobiță requires proven player causality',()=>{
 for(const[city,district,locale]of[['bucharest','unirii','bucharest'],['seattle','pike','seattle'],['seattle','bellevue','bellevue']]){
  const r=request({city,district,kind:'collision',targetId:'driver-1',relation:'participant',facts:{contact:true,collisionType:'vehicle'}});assert.ok(candidates(r).length>=8);assert.ok(candidates(r).every(l=>l.locale===locale&&l.facts?.collisionType==='vehicle'));assert.ok(!has(r,'buc.crash.bobita'));
  const p=request({city,district,kind:'collision',role:'pedestrian',speakerId:'witness',facts:{contact:true,collisionType:'pedestrian'}});assert.equal(candidates(p).length,4);assert.ok(candidates(p).every(l=>l.id.includes('.crash.person.')));assert.ok(candidates(p).every(l=>!/fine|okay|unhurt|got up|bumper|Bobiță/i.test(l.t+' '+l.en)));
 }
 const b=request({kind:'collision',targetId:'driver-1',relation:'participant',facts:{contact:true,collisionType:'vehicle',playerCausedContact:true}});assert.ok(has(b,'buc.crash.bobita'));const line=candidates(b).find(l=>l.id.startsWith('buc.crash.bobita'));assert.equal(line.t,'Ce-ai făcut, Bobiță?');assert.equal(line.en,'What have you done, Bobiță?');
});
check('actual place tags gate allCarusel/Freddo/Arc/Pike/Center/Bellevue park lines without cross-city fallback',()=>{
 const buc=request({kind:'ambient',sourceId:'driver-1',relation:'source'});assert.ok(candidates(buc).every(l=>!l.places));for(const place of['carusel','freddo','arc-de-triumf','cismigiu','old-town','pipera','romana']){const r={...buc,context:{...buc.context,placeIds:[place]}};assert.ok(candidates(r).some(l=>l.places?.includes(place)));assert.ok(candidates(r).every(l=>!l.places||l.places.includes(place)));}
 const sea=request({kind:'ambient',sourceId:'driver-1',relation:'source',city:'seattle',district:'downtown',context:{placeIds:['pike-place','seattle-center']}});assert.ok(has(sea,'sea.pike')&&has(sea,'sea.center'));assert.ok(candidates(sea).every(l=>l.locale==='seattle'));
 const bel={...sea,context:{...sea.context,district:'bellevue',placeIds:['downtown-park','meydenbauer-bay','pike-place']}};assert.ok(has(bel,'bel.downtownpark')&&has(bel,'bel.meydenbauer'));assert.ok(!has(bel,'sea.'));assert.ok(candidates(bel).every(l=>l.locale==='bellevue'));
});
check('unknown weather/temperature never implies rain/snow/heat/cold and actual weather facts filter independently',()=>{
 const base=request({kind:'ambient',sourceId:'driver-1',relation:'source'});assert.ok(candidates(base).every(l=>!l.weather&&l.minTemperatureC==null&&l.maxTemperatureC==null));
 for(const[weather,prefix]of[['rain','buc.rain'],['snow','buc.snow']]){const r={...base,context:{...base.context,weatherKind:weather,weatherObserved:false}};assert.ok(!has(r,prefix));r.context.weatherObserved=true;assert.ok(has(r,prefix));assert.ok(candidates(r).every(l=>!l.weather||l.weather===weather));assert.ok(!has(r,'buc.hot')&&!has(r,'buc.cold'));}
 const hot={...base,context:{...base.context,weatherObserved:true,temperatureC:30}};assert.ok(has(hot,'buc.hot')&&!has(hot,'buc.cold'));const cold={...base,context:{...base.context,weatherObserved:true,temperatureC:-1}};assert.ok(has(cold,'buc.cold')&&!has(cold,'buc.hot'));hot.context.weatherObserved=false;assert.ok(!has(hot,'buc.hot'));
});
check('local-hour boundaries handle midnight without guessing clock or season from missing values',()=>{
 const base=request({kind:'ambient',sourceId:'driver-1',relation:'source'});assert.ok(candidates(base).every(l=>!l.hours));for(const[h,morning,night]of[[0,false,true],[4.999,false,true],[5,true,false],[10.999,true,false],[11,false,false],[21.999,false,false],[22,false,true],[24,false,false],[-1,false,false]]){const r={...base,context:{...base.context,localHour:h}};assert.equal(has(r,'buc.morning'),morning);assert.equal(has(r,'buc.night'),night);}
});
check('signal/walk claims require the exact speaker signal; no light phase or right of way is inferred from honks',()=>{
 const r=request({kind:'waiting',sourceId:'driver-1',relation:'source',facts:{queued:true}});assert.ok(!has(r,'buc.signal'));r.event.facts.speakerSignal='green';assert.ok(has(r,'buc.signal.green')&&!has(r,'buc.signal.red'));r.event.facts.speakerSignal='red';assert.ok(has(r,'buc.signal.red')&&!has(r,'buc.signal.green'));
 const p=request({role:'pedestrian'});assert.ok(!has(p,'buc.walk.signal'));p.event.facts.speakerWalkSignal='walk';assert.ok(has(p,'buc.walk.signal'));delete p.event.facts.speakerWalkSignal;p.event.facts.playerSignal='green';assert.ok(!has(p,'buc.walk.signal'));
});
check('calendar lines require exact supplied local dates and never invent a festival/parade or use a season proxy',()=>{
 const b=request({kind:'ambient',sourceId:'driver-1',relation:'source'});assert.ok(!has(b,'buc.martisor')&&!has(b,'buc.december'));b.context.calendar={month:3,day:1};assert.ok(has(b,'buc.martisor')&&!has(b,'buc.december'));b.context.calendar={month:12,day:1};assert.ok(has(b,'buc.december')&&!has(b,'buc.martisor'));b.context.calendar={month:2,day:30};assert.ok(candidates(b).every(l=>!l.calendar));
 const s=request({kind:'ambient',sourceId:'driver-1',relation:'source',city:'seattle',district:'bellevue',context:{calendar:{month:7,day:4}}});assert.ok(has(s,'bel.july'));s.context.calendar.day=5;assert.ok(!has(s,'bel.july'));
});
const oldRandom=Math.random,oldTimeout=globalThis.setTimeout,oldInterval=globalThis.setInterval;Math.random=()=>{throw Error('Dialogue consumed global randomness');};globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('Dialogue scheduled a timer');};
try{
check('seeded event selection is deterministic and interleaving it leaves the actualTraffic makeRng stream unchanged',()=>{
 const a=createSituationalDialogue({seed:'independent-42'}),b=createSituationalDialogue({seed:'independent-42'}),c=createSituationalDialogue({seed:'another-seed'}),left=[],right=[],other=[],base=makeRng(741),withDialogue=makeRng(741),actual=[],expected=[];
 for(let i=0;i<100;i++){const r=request({now:100+i*13000,eventId:'emitted-horn-'+i,speakerId:'speaker-'+i});expected.push(base());actual.push(withDialogue());left.push(accept(a,r)?.line.id);right.push(accept(b,r)?.line.id);other.push(accept(c,r)?.line.id);}assert.deepEqual(left,right);assert.deepEqual(actual,expected);assert.ok(left.filter((x,i)=>x!==other[i]).length>30);assert.ok(new Set(left).size>=12);
});
check('rejectedHUD presentation consumes neither event/speaker/pair nor line variety; reoffer is deterministic',()=>{
 const g=createSituationalDialogue(),r=request(),p=g.offer(r);assert.ok(p);assert.equal(g.settle(p.token,false,r.nowMs),false);assert.deepEqual([g.diagnostics.events,g.diagnostics.pairs,g.diagnostics.speakers,g.diagnostics.recentLines],[0,0,0,0]);const next=g.offer(r);assert.equal(next.line.id,p.line.id);assert.notEqual(next.token,p.token);assert.equal(g.settle(p.token,true,r.nowMs),false);assert.equal(g.settle(next.token,true,r.nowMs),true);
});
check('accepted speech enforces distinct speaker/pair/line cooldowns and per-event cap/identity deduplication',()=>{
 const g=createSituationalDialogue(),r=request(),first=accept(g,r);assert.ok(first);assert.equal(g.offer({...r,event:{...r.event,id:'second'},nowMs:101}),null);assert.equal(g.lastReason,'speaker-cooldown');
 assert.equal(g.offer(request({now:7100,eventId:'third'})),null);assert.equal(g.lastReason,'pair-cooldown');const later=accept(g,request({now:13100,eventId:'fourth'}));assert.ok(later&&later.line.id!==first.line.id);
 const e=createSituationalDialogue(),a=request({eventId:'one-real-event',speakerId:'a'}),b=request({eventId:'one-real-event',speakerId:'b'}),c=request({eventId:'one-real-event',speakerId:'c'});assert.ok(accept(e,a)&&accept(e,b));assert.equal(e.offer(c),null);assert.equal(e.lastReason,'event-cap');const changed=request({eventId:'one-real-event',kind:'npc-honk',sourceId:'npc',speakerId:'new'});assert.equal(e.offer(changed),null);assert.equal(e.lastReason,'event-id-reused');
});
check('reservations, stale/future timestamps and reversed clocks cannot emit delayed or duplicate event speech',()=>{
 const g=createSituationalDialogue({limits:{maxPending:2}}),a=g.offer(request({speakerId:'a'}));assert.ok(a);assert.equal(g.offer(request({speakerId:'a'})),null);const b=g.offer(request({eventId:'other',speakerId:'b'}));assert.ok(b);assert.equal(g.offer(request({eventId:'third',speakerId:'c'})),null);assert.equal(g.lastReason,'pending-cap');assert.equal(g.settle(a.token,true,1300),false);assert.equal(g.diagnostics.pending,0);assert.equal(g.diagnostics.expired,2);
 assert.equal(g.offer(request({now:1400,event:{atMs:1401}})),null);assert.equal(g.lastReason,'stale-or-future-event');assert.equal(g.offer(request({now:5000,event:{atMs:0}})),null);assert.equal(g.offer(request({now:4000})),null);assert.equal(g.lastReason,'invalid-monotonic-time');assert.equal(g.diagnostics.accepted,0);
});
check('a5000event storm keeps every cache/pending table within hard bounds and rejects unbounded configuration',()=>{
 const limits={maxRecentLines:8,maxEvents:5,maxPairs:6,maxSpeakers:7,maxPending:3,lineCooldownMs:0,speakerCooldownMs:60000,pairCooldownMs:60000},g=createSituationalDialogue({limits});
 for(let i=0;i<5000;i++){assert.ok(accept(g,request({now:100+i,eventId:'storm-'+i,speakerId:'speaker-'+i})));const s=g.diagnostics;assert.ok(s.recentLines<=8&&s.events<=5&&s.pairs<=6&&s.speakers<=7&&s.pending<=3&&s.queue===0);}assert.equal(g.diagnostics.accepted,5000);
 for(const bad of[{maxEvents:100000},{maxPending:9},{lineRetentionMs:1},{eventRetentionMs:1},{sourceActor:{}},{pendingTtlMs:0}])assert.throws(()=>createSituationalDialogue({limits:bad}));
});
check('bounded recent-variety export/import preserves valid line ages only, with no actor/event/position data',()=>{
 const g=createSituationalDialogue({seed:'save'});for(let i=0;i<12;i++)accept(g,request({now:100+i*13000,eventId:'save-event-'+i,speakerId:'private-actor-'+i}));const save=g.exportRecent(143100);assert.ok(save.recent.length<=SITUATIONAL_DIALOGUE_LIMITS.maxRecentLines);assert.ok(!JSON.stringify(save).includes('private-actor')&&!JSON.stringify(save).includes('save-event'));
 const h=createSituationalDialogue({seed:'save'});assert.equal(h.importRecent(save,143100),true);const r=request({now:143100,eventId:'after-save',speakerId:'fresh'});assert.equal(g.offer(r).line.id,h.offer(r).line.id);
 const hostile={version:1,libraryVersion:1,recent:Array.from({length:10000},(_,i)=>({id:i%2?'unknown':SITUATIONAL_DIALOGUE[0].id,ageMs:i%3?-5:1}))};assert.equal(h.importRecent(hostile,143100),true);assert.ok(h.diagnostics.recentLines<=64);assert.equal(h.importRecent({version:999,recent:[]},143100),false);
});
check('actualTraffic.say distance/elevation/layout rejection leaves dialogue cooldowns untouched; accepted gloss is presented',()=>{
 const greeting=createSituationalDialogue().offer(request({kind:'greeting',relation:'conversant'}));assert.equal(greeting.priority,3);
 const g=createSituationalDialogue(),messages=[],receiver={player:{x:0,y:0,z:0},stats:{},placeBubble:t=>t,onSay:(target,text,sub)=>messages.push({text,sub})},r=request(),p=g.offer(r);assert.ok(p);
 assert.equal(Traffic.prototype.say.call(receiver,{x:80,y:0,z:0},p.line,'',p.priority),false);assert.equal(g.settle(p.token,false,r.nowMs),false);assert.equal(g.diagnostics.accepted,0);
 const upper=g.offer(r);assert.equal(Traffic.prototype.say.call(receiver,{x:2,y:4,z:0},upper.line,'',upper.priority),false);g.settle(upper.token,false,r.nowMs);
 receiver.placeBubble=()=>null;const busy=g.offer(r);assert.equal(Traffic.prototype.say.call(receiver,{x:2,y:0,z:0},busy.line,'',busy.priority),false);g.settle(busy.token,false,r.nowMs);
 receiver.placeBubble=t=>t;const good=g.offer(r),accepted=Traffic.prototype.say.call(receiver,{x:2,y:0,z:0},good.line,'',good.priority);assert.equal(accepted,true);assert.equal(g.settle(good.token,accepted,r.nowMs),true);assert.equal(messages.length,1);assert.equal(messages[0].sub,good.line.en);
});
check('dispose is idempotent, empties all owned state and makes late offers/settles/imports harmless',()=>{
 const g=createSituationalDialogue();const p=accept(g,request());assert.ok(p);g.offer(request({eventId:'pending',speakerId:'another'}));g.dispose();g.dispose();assert.equal(g.disposed,true);const s=g.diagnostics;assert.deepEqual([s.pending,s.queue,s.events,s.pairs,s.speakers,s.recentLines],[0,0,0,0,0,0]);assert.equal(g.offer(request()),null);assert.equal(g.settle(p.token,true,100),false);assert.equal(g.exportRecent(100),null);assert.equal(g.importRecent({},100),false);
});
}finally{Math.random=oldRandom;globalThis.setTimeout=oldTimeout;globalThis.setInterval=oldInterval;}
assert.equal(typeof globalThis.gc,'function','Run with --expose-gc for actor/context ownership controls');
const owner=createSituationalDialogue();
function transient(){const actor={marker:'actor-ref-must-not-be-retained',large:new Uint8Array(100000)},context={marker:'context-ref-must-not-be-retained',large:new Uint8Array(100000)},r=request();r.speaker.actor=actor;r.context.privateObject=context;assert.ok(owner.offer(r));return[new WeakRef(actor),new WeakRef(context)];}
const weak=transient(),strong={marker:'positive-strong-reference'},control=new WeakRef(strong);
for(let i=0;i<8;i++){await turn();globalThis.gc();await turn();if(weak.every(ref=>ref.deref()===undefined))break;}
assert.ok(weak.every(ref=>ref.deref()===undefined),'actor/context objects should collect while a primitive pending offer remains');assert.equal(control.deref(),strong);owner.dispose();checks.push('actualNode WeakRefs collect transient actor/context objects while a pending reservation exists; retained-reference control stays alive');
const testedFiles=Object.fromEntries(['game/src/situational-dialogue-library.js','game/src/situational-dialogue.js','game/src/traffic.js','game/src/util.js'].map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../../'+p,import.meta.url))).digest('hex')]));
console.log(JSON.stringify({scope:'CPU-only library/filter/governor and actualTraffic.say method fixtures; no Main/Traffic wiring, actual event emission, browser, HUD pixels or native proof',passed:true,checks,testedFiles,coverage:situationalDialogueCoverage(),stormEvents:5000,randomOrTimerCalls:0},null,2));
