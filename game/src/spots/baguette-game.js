// Three deliberate toss/catch inputs; idle time or cancelling never wins.
export function createBaguetteGame() {
    let state='held',time=0,streak=0,misses=0;
    const drop=()=>{state='dropped';time=0;streak=0;misses++;};
    return {
        action(){
            if(state==='held'){state='flight';time=0;return'toss';}
            if(state==='flight'){
                if(time>=.78&&time<=1.02){state='caught';time=0;streak++;return'catch';}
                drop();return'miss';
            }
            if(state==='dropped'&&time>=.55){state='recovering';time=0;return'recover';}
            return null;
        },
        tick(dt){
            if(!Number.isFinite(dt)||dt<0||dt>.101)throw Error('Invalid activity step');
            if(['won','cancelled','held'].includes(state))return;
            time+=dt;
            if(state==='flight'&&time>1.18)drop();
            else if(state==='caught'&&time>=.6){state=streak===3?'won':'held';time=0;}
            else if(state==='recovering'&&time>=.7){state='held';time=0;}
        },
        cancel(){if(state!=='won')state='cancelled';},
        snapshot(){return{state,time,streak,misses,catchNow:state==='flight'&&time>=.78&&time<=1.02};},
    };
}
