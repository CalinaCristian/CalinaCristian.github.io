import {createSituationalDialogue} from './situational-dialogue.js';
import {compileDialoguePlaces,currentDialogueContext,dialogueActorY} from './situational-dialogue-context.js';
const SITUATIONAL_DIALOGUE_INTEGRATION=Object.freeze({wiredEvents:Object.freeze(['player-honk','npc-honk','collision','ambient','greeting']),nativeProvedEvents:Object.freeze([]),collisionAuthority:'Player.hit→Main.onCollide and retained actual NPC body contacts after overlap rollback',mode:'existing city traffic in drive/foot'});
let sceneSequence=0;
/** Owns one bounded governor and a 3-slot legacy admission ledger. It never
 * chooses/moves actors, rolls traffic RNG, fabricates impacts or renders a world. */
export class TrafficDialogue {
 constructor(traffic,host){
  this.traffic=traffic;this.host=host;this.sceneId=`dialogue:${traffic.city.id}:${traffic.world?.district?.id||'city'}:${++sceneSequence}`;this.sequence=0;this.disposed=false;
  this.governor=createSituationalDialogue({seed:`dialogue-v1:${traffic.city.id}:${traffic.world?.district?.id||'city'}`});this.places=compileDialoguePlaces(traffic.world);
  this.layout={_bub:[],hud:{bubbles:[]}};this.emitted=new WeakSet();
 }
 actorId(actor,role){if(role==='player')return'player';const n=role==='driver'?actor?.id:actor?.i;return(Number.isSafeInteger(n)||typeof n==='string')?`${role}:${n}`:null;}
 event(kind,source,{sourceRole='player',target=null,targetRole='driver',facts={}}={}){
  if(this.disposed)return null;const y=dialogueActorY(source,sourceRole,this.traffic.world),sourceId=this.actorId(source,sourceRole);if(!sourceId||!Number.isFinite(source?.x)||!Number.isFinite(source?.z)||y===null)return null;
  const targetId=target?this.actorId(target,targetRole):null;
  const knownFacts={};for(const key of ['contact','collisionType','playerCausedContact','queued','speakerSignal','speakerWalkSignal'])if(['boolean','string'].includes(typeof facts[key]))knownFacts[key]=facts[key];
  return Object.freeze({id:`${this.sceneId}:${++this.sequence}`,kind,confirmed:true,atMs:performance.now(),sourceId,targetId,x:source.x,z:source.z,y,facts:Object.freeze(knownFacts)});
 }
 /** Replay production say/placeBubble admission only. Never emit legacy text.
  * The return is used solely by old RNG/said/reacted branches, not governor credit. */
 legacyAdmission(target,line,cls,priority){return !this.disposed&&this.traffic.say(target,line,cls,priority,{legacyAdmission:this.layout});}
 hudFrame(now=performance.now()){
  if(this.disposed)return;this.layout.hud.bubbles=this.layout.hud.bubbles.filter(b=>!(now>b.until));this.layout._bub=this.layout._bub.filter(b=>b.until>now&&this.layout.hud.bubbles.some(h=>h.v===b.anchor));
 }
 markEmitted(anchor){this.emitted?.add(anchor);}
 present(event,actor,role,{relation=null,priority=null}={}){
  if(this.disposed||event?.confirmed!==true||![event.x,event.z,event.y,event.atMs].every(Number.isFinite)||!['drive','foot'].includes(this.host?.state))return false;
  const t=this.traffic,id=this.actorId(actor,role),y=dialogueActorY(actor,role,t.world);
  if(!id||actor.hidden||actor.inactive||actor.state==='down'||!Number.isFinite(actor.x)||!Number.isFinite(actor.z)||y===null||Math.abs(y-event.y)>2.5||Math.hypot(actor.x-event.x,actor.z-event.z)>32)return false;
  relation??=event.kind==='greeting'?'conversant':event.kind==='collision'&&(id===event.sourceId||id===event.targetId)?'participant':id===event.sourceId?'source':event.targetId===id?'recipient':'witness';
  const now=performance.now(),offer=this.governor.offer({nowMs:now,event,speaker:{id,role,relation,eligible:true},context:currentDialogueContext(this.host,this.places,actor)});
  if(!offer)return false;let accepted=false;
  const anchor={get x(){return actor.x;},get z(){return actor.z;},get y(){return dialogueActorY(actor,role,t.world)??y;},get bubbleY(){return(dialogueActorY(actor,role,t.world)??y)+(role==='pedestrian'?.25+1.75*(actor.scale||1):2.4);}}; // (owner 2026-11-11: "chat bubble shows up too high": a pedestrian's bubble sits just above the head, not 2.4 m over the feet)
  try{accepted=t.say(anchor,offer.line,offer.cls,priority??offer.priority,{actual:true})===true;return accepted;}
  finally{this.governor.settle(offer.token,accepted,performance.now());}
 }
 dispatch(event,{participant=null,participantRole='driver'}={}){
  if(this.disposed||event?.confirmed!==true||![event.x,event.z,event.y].every(Number.isFinite))return 0;let accepted=0;
  if(participant&&this.present(event,participant,participantRole))accepted++;
  const t=this.traffic,candidates=[];
  if(event.kind==='npc-honk'){
   // The source horn is known, its recipient usually is not.
   const source=t.near(event.x,event.z,1).find(a=>this.actorId(a,'driver')===event.sourceId);
   if(source&&source!==participant&&this.present(event,source,'driver'))accepted++;
  }
  for(const a of t.near(event.x,event.z,28))if(a!==participant&&this.actorId(a,'driver')!==event.sourceId)candidates.push({actor:a,role:'driver',d:Math.hypot(a.x-event.x,a.z-event.z)});
  for(const a of t.nearPeds(event.x,event.z,18)||[])if(a!==participant)candidates.push({actor:a,role:'pedestrian',d:Math.hypot(a.x-event.x,a.z-event.z)});
  candidates.sort((a,b)=>a.d-b.d||String(this.actorId(a.actor,a.role)).localeCompare(String(this.actorId(b.actor,b.role))));
  // A bounded event-time candidate query, never a per-frame crowd scan.
  for(const c of candidates.slice(0,12)){if(accepted>=2)break;if(this.present(event,c.actor,c.role))accepted++;}
  return accepted;
 }
 get diagnostics(){return{...this.governor.diagnostics,legacyLayout:this.layout._bub.length,legacyHud:this.layout.hud.bubbles.length,sourcePlaces:this.places.count};}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.governor.dispose();this.places.dispose();this.layout._bub.length=0;this.layout.hud.bubbles.length=0;this.layout._bv=null;
  const hud=this.host?.hud;if(hud?.bubbles)hud.bubbles=hud.bubbles.filter(b=>{if(!this.emitted.has(b.v))return true;b.el?.remove?.();return false;});
  this.emitted=null;this.traffic=null;this.host=null;
 }
}
