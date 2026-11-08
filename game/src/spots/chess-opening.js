import * as THREE from '../../vendor/three.module.min.js';
import { GeoBatch, M } from './kit.js';
import { activityFlow } from './participation.js';

// A short legal opening on a scene-owned table: e4, ...e5, Nf3.
export function chessOpening(ctx,{x,y,z,source,onDone}) {
    const flow=activityFlow(ctx),root=new THREE.Group();root.name='visitor-chess';root.userData.noFloor=true;ctx.add(root);
    const pieces=[],pools=new Map(),square=(file,rank)=>({x:x+(file-3.5)*.075,y,z:z+(rank-3.5)*.075});
    for(const kind of['pawn','rook','knight','bishop','queen','king']){
        const b=new GeoBatch();b.cyl(0,0,0,.025,.012,'#fff','paint',10);b.cyl(0,.012,0,.013,kind==='pawn'?.035:.05,'#fff','paint',8);
        if(kind==='rook')b.cyl(0,.06,0,.023,.018,'#fff','paint',8);
        else if(kind==='knight'){b.box(.006,.055,0,.026,.04,.024,'#fff','paint',0,0,-.35);b.box(.014,.084,0,.035,.018,.024,'#fff','paint');}
        else{const h=kind==='pawn'?.06:kind==='bishop'?.08:.095;b.sphere(0,h,0,.02,.022,.02,'#fff','paint',8,6);if(kind==='king'){b.box(0,h+.018,0,.008,.025,.008,'#fff','paint');b.box(0,h+.029,0,.023,.007,.008,'#fff','paint');}}
        const g=b.build('chess-piece').children[0],n=kind==='pawn'?16:kind==='queen'||kind==='king'?2:4,im=new THREE.InstancedMesh(g.geometry,g.material,n);im.castShadow=true;root.add(im);pools.set(kind,{im,next:0});
    }
    for(const color of['white','black'])for(let file=0;file<8;file++)for(const major of[false,true]){
        const rank=color==='white'?(major?0:1):(major?7:6),kind=major?['rook','knight','bishop','queen','king','bishop','knight','rook'][file]:'pawn',pool=pools.get(kind),i=pool.next++,p={kind,color,file,rank,home:square(file,rank),pool,i};pieces.push(p);pool.im.setColorAt(i,new THREE.Color(color==='white'?'#f1e6cd':'#332e2a'));
    }
    const place=(p,v)=>{p.pool.im.setMatrixAt(p.i,M(v.x,v.y,v.z));p.pool.im.instanceMatrix.needsUpdate=true;},reset=()=>{for(const p of pieces)place(p,p.home);};reset();
    const moves=[{piece:pieces.find(p=>p.color==='white'&&p.file===4&&p.rank===1),to:square(4,3),label:'White: e2–e4'},{piece:pieces.find(p=>p.color==='black'&&p.file===4&&p.rank===6),to:square(4,4),label:'Black: e7–e5'},{piece:pieces.find(p=>p.color==='white'&&p.file===6&&p.rank===0),to:square(5,2),label:'White: Ng1–f3'}];
    ctx.extras.chessOpening={source,moves:()=>moves.map(m=>({label:m.label,position:(()=>{const a=new THREE.Matrix4();m.piece.pool.im.getMatrixAt(m.piece.i,a);return new THREE.Vector3().setFromMatrixPosition(a).toArray();})()}))};
    ctx.interactables.push({kind:'chess',source,x,z:z+1.3,r:1.8,label:'Play a chess opening at La Șahiști',use:s=>flow.begin(s,{
        title:'Chess at La Șahiști',focus:{x,y,z},action:moves[0].label,help:'Try three moves of a legal opening. Each button moves a piece on the board; Leave or Esc resets the demonstration.',
        started(s,r){reset();r.step=0;r.status.textContent='The king pawn opening';},
        actioned(s,r){r.busy=true;r.t=0;r.from=moves[r.step].piece.home;},
        update(dt,s,r){if(!r.busy)return;r.t+=dt;const t=Math.min(1,r.t/1.2),m=moves[r.step];place(m.piece,{x:r.from.x+(m.to.x-r.from.x)*t,y:y+Math.sin(t*Math.PI)*.13,z:r.from.z+(m.to.z-r.from.z)*t});r.progress.value=(r.step+t)/3;if(t===1){r.step++;if(r.step===moves.length){flow.complete();return;}r.busy=false;r.button.textContent=moves[r.step].label;r.status.textContent=r.step===1?'Black answers in the centre':'Develop the knight toward the centre';}},
        cancel:reset,complete(s){onDone(s);},
    })});
    return root;
}
