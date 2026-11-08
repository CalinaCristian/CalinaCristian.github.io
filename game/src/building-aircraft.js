// Low-detail treatment of explicitly mapped aircraft exhibits. The planform is
// source geometry; fuselage, fin and ground clearance are documented estimates.
export function aircraftBody(ring, heightM) {
    let best = null;
    for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
        const d = Math.hypot(ring[j][0] - ring[i][0], ring[j][1] - ring[i][1]);
        if (!best || d > best.d) best = { d, a: ring[i], b: ring[j] };
    }
    if (!best || best.d < .1) return null;
    const u = [(best.b[0] - best.a[0]) / best.d, (best.b[1] - best.a[1]) / best.d], v = [-u[1], u[0]];
    const c = ring.reduce((s,p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0,0]);
    const local = ring.map(p => [(p[0]-c[0])*u[0]+(p[1]-c[1])*u[1], (p[0]-c[0])*v[0]+(p[1]-c[1])*v[1]]);
    const lo = Math.min(...local.map(p=>p[0])), hi = Math.max(...local.map(p=>p[0]));
    const span = Math.max(...local.map(p=>p[1])) - Math.min(...local.map(p=>p[1]));
    const at = (t, q, y) => [c[0]+u[0]*t+v[0]*q,y,c[1]+u[1]*t+v[1]*q];
    const sections = [];
    for (const fraction of [.015,.08,.22,.4,.6,.78,.92,.985]) {
        const t = lo + (hi-lo)*fraction, xs=[];
        for (let i=0;i<local.length;i++) { const a=local[i],b=local[(i+1)%local.length]; if ((a[0]>t)!==(b[0]>t)) xs.push(a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0])); }
        xs.sort((a,b)=>a-b);
        let interval=null;
        for(let i=0;i+1<xs.length;i+=2) if(!interval||Math.abs((xs[i]+xs[i+1])/2)<Math.abs((interval[0]+interval[1])/2)) interval=[xs[i],xs[i+1]];
        if (!interval) continue;
        const q=(interval[0]+interval[1])/2, radius=Math.max(.015,Math.min((interval[1]-interval[0])*.46,span*.075));
        const taper=Math.min(1,Math.sin(fraction*Math.PI)*2), y=heightM*.36, ry=heightM*.22*taper;
        const points=Array.from({length:8},(_,k)=>{const a=k*Math.PI/4;return at(t,q+Math.cos(a)*radius,y+Math.sin(a)*ry);});
        sections.push({t,q,radius,points});
    }
    const faces=[];
    for(let i=1;i<sections.length;i++) for(let k=0;k<8;k++) { const j=(k+1)%8,a=sections[i-1].points,b=sections[i].points;faces.push([a[k],b[k],b[j]],[a[k],b[j],a[j]]); }
    if(sections.length<2)return null;
    const footprint=[...sections.map(s=>at(s.t,s.q-s.radius,0)),...sections.slice().reverse().map(s=>at(s.t,s.q+s.radius,0))].map(p=>[p[0],p[2]]);
    const widest=sections.reduce((a,b)=>a.radius>b.radius?a:b), tailAt=widest.t-lo<hi-widest.t?sections[1]:sections.at(-2);
    const ta=tailAt.t-(hi-lo)*.06,tb=tailAt.t+(hi-lo)*.06;
    const tail=[at(ta,tailAt.q,heightM*.48),at(tb,tailAt.q,heightM*.48),at(tailAt.t,tailAt.q,heightM)];
    const tailFootprint=[at(ta,tailAt.q-.025,0),at(tb,tailAt.q-.025,0),at(tb,tailAt.q+.025,0),at(ta,tailAt.q+.025,0)].map(p=>[p[0],p[2]]);
    const main=sections[Math.floor(sections.length*.6)],front=sections[1];
    const gear=[at(main.t,main.q-main.radius*.6,0),at(main.t,main.q+main.radius*.6,0),at(front.t,front.q,0)].map(p=>[p[0],p[2]]);
    return {faces,footprint,tail,tailFootprint,gear,axis:u,wingBaseM:heightM*.32,wingTopM:heightM*.37,bodyBaseM:heightM*.12,bodyTopM:heightM*.59};
}
