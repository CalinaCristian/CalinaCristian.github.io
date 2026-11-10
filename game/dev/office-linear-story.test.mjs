import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Office} from '../src/office.js';
import {STOPS as stops} from '../src/data.js';
// Exercise actual production methods, with only renderer construction bypassed.
const events=[];globalThis.window={addEventListener(){},removeEventListener(){},dispatchEvent(e){events.push(e.detail);}};
const key=(o,code,repeat=false)=>o.onKey({code,repeat,preventDefault(){},stopPropagation(){}});
const make=stop=>{const o=Object.create(Office.prototype);Object.assign(o,{stop,npc:{persona:'manager',title:'Host'},read:new Set(),part:{},stations:stop.stations.map((data,index)=>({data,index})),audio:{blip(){}},input:{flush(){}},hud:{panel(){},closePanel(){},toast(){}},convFrame:()=>({}),seen:[]});o.show=function(text){this.seen.push(text);this.opts=this.options();};return o;};
let sections=0;
for(const stop of stops){
 const o=make(stop),start=events.length;o.talk();assert.equal(o.cur,0);
 for(const code of ['KeyA','KeyB','KeyC','KeyD','Digit1','Digit2','Digit3','Digit4'])key(o,code);
 assert.equal(o.cur,0,'Old answer keys cannot skip the story');assert.equal(o.opts.length,1);
 const seenBeforeRepeat=o.seen.length;key(o,'Enter',true);assert.equal(o.seen.length,seenBeforeRepeat);
 key(o,'Escape');assert.equal(o.talking,false);assert(!o.conversationComplete);assert(!o.done);
 o.talk();let n=0;while(o.talking&&n++<30){assert.equal(o.opts.length,1);key(o,n%2?'Enter':'Space');}
 assert(n<30);assert.equal(o.conversationComplete,true);assert.equal(o.done,true);assert.equal(o.read.size,stop.stations.length);
 const heard=o.seen.join(' '),escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const station of stop.stations)for(const text of station.lines||station.chips||[])assert(heard.includes(escape(text)),stop.id+': missing CV content '+text);
 const unique=new Set(events.slice(start).filter(e=>e.first).map(e=>e.index));assert.equal(unique.size,stop.stations.length);sections+=unique.size;
}
const split=make({id:'split',period:'2000',role:'Engineer',stations:[{title:'Work',lines:['One.','Two.','Three.']}]});
split.talk();assert.equal(split.read.size,0,'Partial section earns no topic credit');key(split,'Enter');assert.equal(split.read.size,1);assert(!split.conversationComplete);key(split,'Escape');split.talk();assert.equal(split.cur,0);assert(!split.conversationComplete);key(split,'Enter');key(split,'Enter');assert(split.conversationComplete);
console.log(JSON.stringify({stops:stops.length,completeSections:sections,contentRetained:true,linearKeys:true,pause:true,partialCreditRejected:true}));
