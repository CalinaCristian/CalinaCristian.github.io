import test from 'node:test';
import assert from 'node:assert/strict';
import {Pedestrians} from '../src/traffic.js';
import {EdgeIndex} from '../src/nav.js';
import {relocationPeerQuery} from '../src/pedestrian-relocation-peers.js';

function edge(id,x,z,angle,len=80){
    const dx=Math.cos(angle),dz=Math.sin(angle),a={x,z,edges:[]},b={x:x+dx*len,z:z+dz*len,edges:[]};
    const e={id,a,b,len,dirx:dx,dirz:dz,nx:-dz,nz:dx,wR:3,wL:3,halfW:3,sidewalk:3,type:'residential',ya:0,yb:0};a.edges=[e];b.edges=[e];return e;
}
function rng(seed=12345){let s=seed,calls=0;const f=()=>{calls++;s=s*16807%2147483647;return s/2147483647;};f.range=(a,b)=>a+(b-a)*f();f.state=()=>[s,calls];return f;}
class ScanReference extends Pedestrians {
    spaceLoad(e,side,except){return super.spaceLoad(e,side,except);}
    freePersonalSpace(p){return super.freePersonalSpace(p);}
}
function walkers(Impl,edges,people){
    const c=Object.create(Impl.prototype);
    Object.assign(c,{list:people,rng:rng(),crowd:{reach:i=>.3+(i%4)*.03},stops:[],_walkSpace:new Map(),_side:new Map(),crossCount:new Map(),stats:{},grid:{cell:8,query(){}},obsGrid:{query(){}},obs:[],_fr:0,
        t:{player:{x:0,z:0,fx:0,fz:1},world:{district:true,buildings:[],walkTop:()=>.13},nearEdges:()=>edges,index:new EdgeIndex(edges),grid:{items:null}}});
    c.inView=()=>false;return c;
}
test('rotated sidewalk loads retain remote reservations, hidden rules and duplicate rows',()=>{
    const e=edge(1,-12,17,.71),space={lo:2,hi:71,w:3,sw:2.7};
    const point=(s,u)=>({x:e.a.x+e.dirx*s+e.nx*u,z:e.a.z+e.dirz*s+e.nz*u});
    const except={i:0,...point(20,4),state:'walk'},both={i:1,...point(30,4),state:'legs',next:{e,side:1}},remote={i:2,x:800,z:900,state:'wait',next:{e,side:1}};
    const hidden={i:3,...point(40,4),state:'stand',hidden:true},people=[except,both,remote,hidden,both];
    const c=walkers(Pedestrians,[e],people);c.walkSpace=()=>space;
    const q=relocationPeerQuery(people,except,()=>.3);
    assert.equal(q.spaceLoad(e,1,space,.3),c.spaceLoad(e,1,except));
    assert.equal(q.spaceLoad(e,1,space,.3),3,'body plus inbound is a union; duplicate list entries still count');
    assert.equal(q.standingCount(hidden.x,hidden.z,4),1,'the existing stop-capacity predicate counts hidden standers');
    except.x=10000;except.z=10000;except.next={e,side:1};
    assert.equal(q.spaceLoad(e,1,space,.3),3,'candidate movement never becomes peer occupancy');
});
test('spatial bounds preserve exact corridor and carried-body boundary predicates',()=>{
    const random=rng(91),people=Array.from({length:560},(_,i)=>({i,x:random.range(-300,300),z:random.range(-300,300),state:i%5?'walk':'stand',hidden:i%23===0}));
    const except=people[0],edges=Array.from({length:120},(_,i)=>edge(i,random.range(-250,250),random.range(-250,250),random()*6.28,random.range(4,180)));
    for(let i=7;i<people.length;i+=7){people[i].state='legs';people[i].next={e:edges[i%edges.length],side:i%2?1:-1};}
    const c=walkers(Pedestrians,edges,people),q=relocationPeerQuery(people,except,o=>c.reach(o));
    for(const e of edges)for(const side of[-1,1]){
        const space={lo:1.1,hi:e.len-1.1,w:3,sw:2.7};c.walkSpace=()=>space;
        assert.equal(q.spaceLoad(e,side,space,.3),c.spaceLoad(e,side,except));
    }
    for(let i=0;i<200;i++){
        except.x=random.range(-300,300);except.z=random.range(-300,300);
        assert.equal(q.freePersonalSpace(except,c.reach(except),.35),c.freePersonalSpace(except));
    }
    const basis=edge(999,0,0,0);basis.dirx=0;basis.dirz=0;basis.nx=0;basis.nz=0;
    const malformed={lo:-1,hi:1,w:0,sw:0};c.walkSpace=()=>malformed;
    assert.equal(q.spaceLoad(basis,1,malformed,.3),c.spaceLoad(basis,1,except),'unbounded/degenerate basis falls back to exact full scan');
});
test('actual relocation choices, failures and RNG sequence agree with full scans at560 people',()=>{
    const edges=Array.from({length:10},(_,i)=>edge(i,-160+i*31,-70+i*13,i*.31,100));
    const random=rng(875),people=Array.from({length:560},(_,i)=>({i,x:random.range(-300,300),z:random.range(-300,300),e:edges[i%10],side:i%2?1:-1,s:20,dir:1,state:'walk',legs:[],live:false,heading:0,scale:1}));
    const copy=()=>people.map(p=>({...p,legs:[]})),a=walkers(Pedestrians,edges,copy()),b=walkers(ScanReference,edges,copy());
    const pose=p=>({x:p.x,z:p.z,e:p.e?.id,s:p.s,side:p.side,dir:p.dir,state:p.state,walkOff:p.walkOff,heading:p.heading});
    for(let k=0;k<20;k++){
        const i=k*27;a.relocate(a.list[i],0,210,false);b.relocate(b.list[i],0,210,false);
        assert.deepEqual(pose(a.list[i]),pose(b.list[i]));assert.deepEqual(a.rng.state(),b.rng.state());
    }
    a.freeWalkPoint=b.freeWalkPoint=()=>false;
    a.relocate(a.list[550],0,210,false);b.relocate(b.list[550],0,210,false);
    assert.deepEqual(pose(a.list[550]),pose(b.list[550]));assert.deepEqual(a.rng.state(),b.rng.state());
    assert.equal(a.list.length,560);assert.equal(b.list.length,560);assert.ok(a.list.every((p,i)=>p.i===i&&!p.hidden));
});
