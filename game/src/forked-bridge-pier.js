import {bridgePrismCollider} from './basarab-structure.js';

/** Photo-informed concrete fork, not a surveyed pier section. The caller owns
 * source association, existing station, deck height and complete road/rail clearance. */
export function forkedBridgePier({x,z,height,along,headHalfWidth}) {
    if (![x,z,height,...(along||[]),headHalfWidth].every(Number.isFinite) || along?.length!==2 ||
        Math.abs(Math.hypot(...along)-1)>1e-6 || height<4.8 || headHalfWidth<1.8 || headHalfWidth>4) return null;
    const transverse=[-along[1],along[0]],members=[];
    const point=(t,y)=>[x+transverse[0]*t,y,z+transverse[1]*t];
    function add(a,b,width,depth,kind) {
        const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),u=d.map(v=>v/length),n=[along[0],0,along[1]],m=[u[1]*n[2]-u[2]*n[1],u[2]*n[0]-u[0]*n[2],u[0]*n[1]-u[1]*n[0]];
        const ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>p.map((v,i)=>v+s*n[i]*depth/2+t*m[i]*width/2));
        const A=ring(a),B=ring(b),center=a.map((v,i)=>(v+b[i])/2),collider=bridgePrismCollider(center,[u,n,m],[length/2,depth/2,width/2],kind);
        members.push({A,B,u,centerA:a,collider,kind});
    }
    const neck=height*.44,shoulder=height-.95;
    add(point(0,0),point(0,neck+.3),1.3,1.8,'basarab-pier-stem');
    for(const sign of [-1,1]) {
        // A six-chord quadratic gives the outward-curving branches in the
        // construction photograph, with a finite open throat below the head.
        const at=t=>{const q=t*t;return point(sign*(headHalfWidth-.6)*q,neck+(shoulder-neck)*t);};
        for(let i=0;i<6;i++)add(at(i/6),at((i+1)/6),1.15,1.8,'basarab-pier-fork');
        add(point(sign*(headHalfWidth-.6),height-.35),point(sign*(headHalfWidth-.6),height),.85,1.5,'basarab-pier-bearing');
    }
    add(point(-headHalfWidth+.3,height-.65),point(headHalfWidth-.3,height-.65),.6,2.1,'basarab-pier-crosshead');
    return {estimated:true,x,z,height,headHalfWidth,members,colliders:members.map(m=>m.collider),
        basis:'Existing inferred station and source deck; photo-informed curved fork, crosshead and bearings. Section dimensions are MODEL estimates.'};
}

export function emitForkedBridgePier(builder,plan,concrete,bearing) {
    for(const {A,B,u,centerA,kind}of plan.members) {
        const color=kind==='basarab-pier-bearing'?bearing:concrete;
        for(let i=0;i<4;i++){const j=(i+1)%4;builder.face4(A[i],B[i],B[j],A[j],color,A[i].map((v,k)=>(v+A[j][k])/2-centerA[k]));}
        builder.face4(...A,color,u.map(v=>-v));builder.face4(...B,color,u);
    }
}
