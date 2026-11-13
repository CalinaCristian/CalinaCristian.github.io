// Pure rules of "table", backgammon as played in Romania. +1 moves 24→1, -1 moves 1→24. Points are zero-based;
// positive/negative counts belong to the two players. Every public transition
// returns a new frozen position. Dice are supplied by the activity, never here.
// Romanian practice (game/research/bucharest-spots.md, "Table (Romanian backgammon)"): no doubling cube; each player throws one die to open, a tie
// is thrown again and the winner then throws both dice for the first move (`opening: 'reroll'`, the default;
// 'use' plays the two opening dice as in international rules); a win is a "linie" (1), a "marț" (2) when the loser
// has borne off nothing, a "marț tehnic" (3) when the loser also still has a checker on the bar or in the winner's home.
const side = player => player === 1 ? 0 : 1;
const clone = s => ({...s,points:[...s.points],bar:[...s.bar],off:[...s.off],dice:[...s.dice],remaining:[...s.remaining],openingDice:[...s.openingDice]});
const freeze = s => {for(const k of ['points','bar','off','dice','remaining','openingDice'])Object.freeze(s[k]);return Object.freeze(s);};
const key = m => `${m.from}:${m.to}:${m.die}`;
const validDie = d => Number.isInteger(d) && d >= 1 && d <= 6;

export function createGame({opening='reroll'}={}) {
    const points=Array(24).fill(0);
    for(const [i,n] of [[23,2],[12,5],[7,3],[5,5],[0,-2],[11,-5],[16,-3],[18,-5]])points[i]=n;
    return freeze({points,bar:[0,0],off:[0,0],turn:1,phase:'opening',dice:[],remaining:[],openingDice:[],winner:0,turnNumber:0,opening:opening==='use'?'use':'reroll'});
}

export function validatePosition(s) {
    if(!s||!Array.isArray(s.points)||s.points.length!==24||![1,-1].includes(s.turn))throw new Error('Invalid backgammon position');
    if(!['opening','roll','move','finished'].includes(s.phase))throw new Error('Invalid game phase');
    for(const n of s.points)if(!Number.isInteger(n)||Math.abs(n)>15)throw new Error('Invalid point count');
    for(const p of [1,-1]){
        const i=side(p);if(!Number.isInteger(s.bar[i])||s.bar[i]<0||!Number.isInteger(s.off[i])||s.off[i]<0)throw new Error('Invalid checker count');
        if(s.points.reduce((n,v)=>n+Math.max(0,v*p),0)+s.bar[i]+s.off[i]!==15)throw new Error('Each player must have fifteen checkers');
    }
    if(!Array.isArray(s.remaining)||s.remaining.length>4||!s.remaining.every(validDie)||!Array.isArray(s.dice)||![0,2].includes(s.dice.length)||!s.dice.every(validDie))throw new Error('Invalid dice');
    const pool=s.dice.length?(s.dice[0]===s.dice[1]?Array(4).fill(s.dice[0]):[...s.dice]):[];
    for(const d of s.remaining){const i=pool.indexOf(d);if(i<0)throw new Error('Remaining dice exceed the roll');pool.splice(i,1);}
    if(['opening','roll'].includes(s.phase)&&(s.dice.length||s.remaining.length))throw new Error('Dice are not active in this phase');
    if(s.off[0]===15&&s.off[1]===15)throw new Error('Both players cannot win');
    const winner=s.off[0]===15?1:s.off[1]===15?-1:0;
    if(s.winner!==winner||(s.phase==='finished')!==!!winner)throw new Error('Invalid winner');
    return true;
}

export function rollDice(s,a,b) {
    validatePosition(s);
    if(!['opening','roll'].includes(s.phase)||!validDie(a)||!validDie(b))throw new Error('Dice cannot be rolled now');
    const n=clone(s);
    if(s.phase==='opening'){
        n.openingDice=[a,b];
        if(a===b)return freeze(n); // one die each, tied opening rerolls
        n.turn=a>b?1:-1;
        if(s.opening!=='use'){n.phase='roll';return freeze(n);} // the winner throws both dice for the first move
    }
    else n.openingDice=[];
    n.dice=[a,b];n.remaining=a===b?[a,a,a,a]:[a,b];n.phase='move';
    return freeze(n);
}

const allHome = (s,p) => !s.bar[side(p)] && !s.points.some((n,i)=>n*p>0 && (p===1?i>5:i<18));

function singleMoves(s,die) {
    const p=s.turn,i=side(p),out=[];
    const land=(from,to)=>{
        if(s.points[to]*p<=-2)return;
        out.push({from,to,die,hit:s.points[to]*p===-1});
    };
    if(s.bar[i]){land('bar',p===1?24-die:die-1);return out;}
    const home=allHome(s,p);
    for(let from=0;from<24;from++){
        if(s.points[from]*p<=0)continue;
        const to=from-p*die;
        if(to>=0&&to<24){land(from,to);continue;}
        if(!home)continue;
        const distance=p===1?from+1:24-from;
        const farther=s.points.some((n,j)=>n*p>0&&(p===1?j>from:j<from));
        if(die===distance||(die>distance&&!farther))out.push({from,to:'off',die,hit:false});
    }
    return out;
}

function moveUnchecked(s,m) {
    const n=clone(s),p=s.turn,i=side(p);
    if(m.from==='bar')n.bar[i]--;else n.points[m.from]-=p;
    if(m.to==='off')n.off[i]++;
    else{
        if(n.points[m.to]*p===-1){n.points[m.to]=0;n.bar[1-i]++;}
        n.points[m.to]+=p;
    }
    n.remaining.splice(n.remaining.indexOf(m.die),1);
    if(n.off[i]===15){n.winner=p;n.phase='finished';}
    return n;
}

export function legalTurns(s) {
    validatePosition(s);
    if(s.phase!=='move')return [];
    const memo=new Map();
    const walk=position=>{
        if(!position.remaining.length||position.winner)return [[]];
        const cacheKey=position.points.join(',')+'|'+position.bar.join(',')+'|'+position.off.join(',')+'|'+[...position.remaining].sort().join(',');
        if(memo.has(cacheKey))return memo.get(cacheKey);
        const turns=[];
        for(const die of new Set(position.remaining))for(const m of singleMoves(position,die))for(const tail of walk(moveUnchecked(position,m)))turns.push([m,...tail]);
        const result=turns.length?turns:[[]];memo.set(cacheKey,result);return result;
    };
    let turns=walk(s),maximum=Math.max(...turns.map(t=>t.length));
    turns=turns.filter(t=>t.length===maximum);
    // When only one of two unequal dice can be used, the higher playable die
    // is compulsory. Filtering whole turns also rules out a tempting first
    // move that would prevent using the maximum number of dice.
    if(maximum===1&&s.remaining.length===2&&s.remaining[0]!==s.remaining[1]){
        const high=Math.max(...turns.map(t=>t[0].die));turns=turns.filter(t=>t[0].die===high);
    }
    const seen=new Set();return turns.filter(t=>{const k=t.map(key).join('|');if(seen.has(k))return false;seen.add(k);return true;});
}

export function legalMoves(s) {
    const seen=new Set();return legalTurns(s).flatMap(t=>t.length?[t[0]]:[]).filter(m=>{const k=key(m);if(seen.has(k))return false;seen.add(k);return true;});
}

export function applyMove(s,requested) {
    const legal=legalMoves(s).find(m=>m.from===requested.from&&m.to===requested.to&&m.die===requested.die);
    if(!legal)throw new Error('That move does not satisfy the current dice and compulsory-move rules');
    const n=freeze(moveUnchecked(s,legal));validatePosition(n);return n;
}

export function confirmTurn(s) {
    validatePosition(s);
    if(s.phase==='finished')return s;
    if(s.phase!=='move'||legalMoves(s).length)throw new Error('Play every compulsory move before confirming');
    const n=clone(s);n.turn=-s.turn;n.phase='roll';n.dice=[];n.remaining=[];n.openingDice=[];n.turnNumber++;
    return freeze(n);
}

export function pipCount(s,p) {
    return s.bar[side(p)]*25+s.points.reduce((sum,n,i)=>sum+Math.max(0,n*p)*(p===1?i+1:24-i),0);
}

export function gameResult(s) {
    if(!s.winner)return null;
    const p=s.winner,loser=-p,i=side(loser);
    const trapped=s.bar[i]>0||s.points.some((n,j)=>n*loser>0&&(p===1?j<=5:j>=18));
    const points=s.off[i]>0?1:trapped?3:2;
    return {winner:p,points,kind:points===3?'backgammon':points===2?'gammon':'single',name:points===3?'marț tehnic':points===2?'marț':'linie'};
}

/** Where the checker on `from` can go this turn: every destination reachable by playing one or more of the remaining
 * dice with that same checker, as the start of a legal turn. → [{to, moves:[…], hit}] (one route per destination: the
 * fewest dice, then a route that hits nothing on the way). */
export function checkerRoutes(s,from) {
    const best=new Map();
    for(const turn of legalTurns(s)){
        if(!turn.length||turn[0].from!==from)continue;
        for(let k=1;k<=turn.length;k++){
            if(k>1&&turn[k-1].from!==turn[k-2].to)break;
            const moves=turn.slice(0,k),to=moves[k-1].to,passing=moves.slice(0,-1).filter(m=>m.hit).length,old=best.get(to);
            if(!old||k<old.moves.length||(k===old.moves.length&&passing<old.passing))best.set(to,{to,moves:moves.map(m=>({...m})),hit:moves[k-1].hit,passing});
            if(to==='off')break;
        }
    }
    return [...best.values()].map(({passing,...r})=>r);
}

/** How good the roll just thrown is for the player on move, against all 36 throws from the same position: the best
 * position each throw can reach, scored by the opponent heuristic. → {value, mean, sd, pct} (pct 0 … 1: the share of
 * throws that are worse; 0.5 = an average roll). `s` is the position right after rollDice. */
export function rollLuck(s) {
    validatePosition(s);
    if(s.phase!=='move'||s.dice.length!==2)return null;
    const p=s.turn,best=(a,b)=>{
        const n=clone(s);n.dice=[a,b];n.remaining=a===b?[a,a,a,a]:[a,b];
        let top=-Infinity;for(const turn of legalTurns(freeze(n))){let q=n;for(const m of turn)q=moveUnchecked(q,m);const v=evaluate(q,p);if(v>top)top=v;}
        return top;
    };
    const mine=best(s.dice[0],s.dice[1]);let sum=0,sq=0,worse=0,same=0;
    for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){const v=b<a?null:best(a,b),w=a===b?1:2;if(v===null)continue;const c=Math.min(v,1e6);sum+=c*w;sq+=c*c*w;if(v<mine-1e-9)worse+=w;else if(Math.abs(v-mine)<=1e-9)same+=w;}
    const mean=sum/36,sd=Math.sqrt(Math.max(0,sq/36-mean*mean));
    return {value:Math.min(mine,1e6),mean,sd,pct:(worse+same/2)/36};
}

function evaluate(s,p) {
    if(s.winner===p)return 1e9;
    const i=side(p);let score=pipCount(s,-p)-pipCount(s,p)+s.off[i]*22+s.bar[1-i]*13-s.bar[i]*20,run=0,prime=0;
    for(let j=0;j<24;j++){
        const n=s.points[j]*p;
        if(n>=2){const home=p===1?j<=5:j>=18;score+=home?5.5:2;run++;prime=Math.max(prime,run);}
        else run=0;
        if(n!==1)continue;
        // A heuristic only: legality is always decided by the exact engine.
        // Avoid exposed singles that the opponent can reach in one roll.
        let risk=0;
        const threats=[];if(s.bar[1-i])threats.push(p===1?-1:24);
        else for(let k=0;k<24;k++)if(s.points[k]*p<0)threats.push(k);
        for(const from of threats){const d=(j-from)*p;if(d>0&&d<=12)risk=Math.max(risk,d<=6?.31:.17);}
        score-=risk*(p===1?25-j:j+2)*1.4;
    }
    return score+prime*prime*1.2;
}

// A friendly, deterministic opponent. It plays an entire legal turn, values
// bearing off, made points and primes, and avoids vulnerable isolated pieces.
export function chooseTurn(s) {
    const turns=legalTurns(s);if(!turns.length)return [];
    let best=turns[0],bestScore=-Infinity;
    for(const turn of turns){let n=s;for(const m of turn)n=moveUnchecked(n,m);const score=evaluate(n,s.turn);if(score>bestScore+1e-9){best=turn;bestScore=score;}}
    return best.map(m=>({...m}));
}
