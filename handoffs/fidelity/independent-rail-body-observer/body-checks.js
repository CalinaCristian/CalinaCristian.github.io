// Independent proof mathematics. No production support, model, path or
// certificate imports. All physical witnesses use emitted triangle geometry.
import {buildIndependentModelProfiles} from './model-provenance.js';
const finite = Number.isFinite, EPS = 1e-7;
export const IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const add = (a,b) => a.map((v,i)=>v+b[i]), sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const xyz = p => Array.isArray(p)&&p.length===3&&p.every(finite);
export function transform(m,p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; }
export function inverseAffine(m) {
    if(!Array.isArray(m)||m.length!==16||!m.every(finite)||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)return null;
    const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],d=dot(a,cross(b,c));if(Math.abs(d)<1e-15)return null;
    const r0=cross(b,c).map(v=>v/d),r1=cross(c,a).map(v=>v/d),r2=cross(a,b).map(v=>v/d),t=m.slice(12,15);
    return [r0[0],r1[0],r2[0],0,r0[1],r1[1],r2[1],0,r0[2],r1[2],r2[2],0,-dot(r0,t),-dot(r1,t),-dot(r2,t),1];
}
const box = ps => ({min:[0,1,2].map(i=>Math.min(...ps.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...ps.map(p=>p[i])))});
const boxesMeet = (a,b) => a.min.every((v,i)=>v<=b.max[i]&&a.max[i]>=b.min[i]);
function clip(poly, value) {
    const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=value(p),b=value(q);if(a>=0)out.push(p);if((a>=0)!==(b>=0))out.push(mix(p,q,a/(a-b)));}return out;
}
function projectedClip(triangle, polygon, axes=[0,2]) {
    let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a[axes[0]]*b[axes[1]]-b[axes[0]]*a[axes[1]];}
    if(!area)return [];
    let result=triangle;const sign=Math.sign(area);
    for(let i=0;i<polygon.length&&result.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];result=clip(result,p=>sign*((b[axes[0]]-a[axes[0]])*(p[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(p[axes[0]]-a[axes[0]])));}return result;
}
function triangleY(triangle,p) {
    const [a,b,c]=triangle,n=cross(sub(b,a),sub(c,a));return Math.abs(n[1])>1e-15?a[1]-(n[0]*(p[0]-a[0])+n[2]*(p[2]-a[2]))/n[1]:null;
}
/** Exact surface intersection, including coplanar triangles and long edges
 * crossing a narrow solid with no actor vertex inside it. */
export function triangleContact(a,b) {
    if(!boxesMeet(box(a),box(b)))return null;
    const ea=[sub(a[1],a[0]),sub(a[2],a[1]),sub(a[0],a[2])],eb=[sub(b[1],b[0]),sub(b[2],b[1]),sub(b[0],b[2])],na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
    for(const axis of [na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y)))]){const len=Math.hypot(...axis);if(len<1e-14)continue;const A=a.map(p=>dot(p,axis)/len),B=b.map(p=>dot(p,axis)/len);if(Math.max(...A)<Math.min(...B)-1e-10||Math.max(...B)<Math.min(...A)-1e-10)return null;}
    if(Math.hypot(...cross(na,nb))<1e-12*Math.hypot(...na)*Math.hypot(...nb)){
        const drop=na.map(Math.abs).indexOf(Math.max(...na.map(Math.abs))),axes=[0,1,2].filter(i=>i!==drop),p=projectedClip(a,b,axes);return p.length?{point:p[0],coplanar:true}:null;
    }
    for(const [edges,target]of [[a,b],[b,a]])for(let i=0;i<3;i++){
        const p=edges[i],q=edges[(i+1)%3],d=sub(q,p),u=sub(target[1],target[0]),v=sub(target[2],target[0]),n=cross(u,v),den=dot(n,d);if(Math.abs(den)<1e-14)continue;
        const t=dot(n,sub(target[0],p))/den;if(t<0||t>1)continue;const hit=add(p,d.map(x=>x*t)),r=sub(hit,target[0]),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),ru=dot(r,u),rv=dot(r,v),D=uu*vv-uv*uv;
        if(!(D>0))continue;const s=(ru*vv-rv*uv)/D,w=(rv*uu-ru*uv)/D;if(s>=-1e-10&&w>=-1e-10&&s+w<=1+1e-10)return{point:hit,coplanar:false};
    }return null;
}

/** Geometry may be cached; matrices/draw range are current immutable snapshots.
 * The caller decodes typed buffers losslessly before passing them here. */
export function emittedTriangles(parts,{frameMatrix=IDENTITY}={}) {
    const inverse=inverseAffine(frameMatrix);if(!inverse)return{known:false,reason:'unsupported-scene-frame-matrix'};
    const triangles=[];
    for(const part of parts||[]){
        const P=part.positions,I=part.indices||P?.map((_,i)=>i),M=part.matrixWorld;
        if(!Array.isArray(P)||!P.length||!P.every(xyz)||!Array.isArray(I)||I.length%3||!I.every(i=>Number.isInteger(i)&&i>=0&&i<P.length)||!inverseAffine(M))return{known:false,reason:'malformed-emitted-geometry-or-transform',part:part.id};
        const start=part.drawRange?.start??0,count=part.drawRange?.count??I.length;
        if(!Number.isInteger(start)||start%3||!Number.isInteger(count)||count<0||count%3||start+count>I.length)return{known:false,reason:'unsupported-emitted-draw-range',part:part.id};
        const points=P.map(p=>transform(inverse,transform(M,p)));
        for(let i=start;i<start+count;i+=3)triangles.push({id:part.id,triangle:i/3,points:I.slice(i,i+3).map(j=>points[j])});
    }
    return triangles.length?{known:true,triangles}:{known:false,reason:'missing-emitted-body-geometry'};
}

function polynomial(piece,u){const[A,B,C]=piece.topProfile.coefficients;return(A*u+B)*u+C;}
const fraction=(piece,p)=>{const dx=piece.b[0]-piece.a[0],dz=piece.b[1]-piece.a[1];return((p[0]-piece.a[0])*dx+(p[2]-piece.a[1])*dz)/(dx*dx+dz*dz);};
const modelWays = m => new Set([...(m.bridgeWays||[]),...(m.paths||[]).flatMap(p=>(p.ways||[]).map(w=>w[0])),...(m.sourceWayIds||[])]);

/** Validate identities/raw geometry and direct native samples independently of
 * a producer's passed field or body certificate. Only reviewed model inputs
 * supplied by the proof runner admit a modeled source association. */
export function auditSupportCatalogue({data,pieces,reviewedModels,nativeMotorEdges=[]}) {
    const reconstructed=buildIndependentModelProfiles({data,reviewedModels,nativeMotorEdges});
    const issues=[...reconstructed.issues],validated=[],models=new Map((reviewedModels||[]).map(m=>[m.id,m])),seen=new Set();
    const ways=new Map((data?.tramSourceWays||[]).map(w=>[w.sourceId,w]));
    for(const piece of pieces||[]){
        const fail=(reason,extra={})=>issues.push({reason,pieceId:piece.id,sourceId:piece.sourceId,modelId:piece.modelId,...extra});
        const model=models.get(piece.modelId),source=ways.get(piece.sourceId),profile=piece.topProfile;
        if(!piece.id||seen.has(piece.id)){fail('missing-or-duplicate-support-piece-id');continue;}seen.add(piece.id);
        if(!model||!modelWays(model).has(piece.sourceId)||!model.basis||!source){fail('unreviewed-or-foreign-source-support-model');continue;}
        if(source.tags?.railway!=='tram'||source.tags?.ele!=null||source.tags?.incline!=null||source.nodeIds.some(n=>data.tramSourceNodeTags?.[n]?.ele!=null||data.tramSourceNodeTags?.[n]?.incline!=null)){fail('unsupported-raw-source-model-constraints');continue;}
        if(model.bridgeWays?.includes(piece.sourceId)&&(!/^(yes|true|1)$/.test(String(source.tags?.bridge))||Number(source.tags?.layer)!==model.sourceLayer)){fail('reviewed-bridge-source-identity-or-grade-tags-changed');continue;}
        if(model.id==='victoria-tram-underpass'&&model.paths.some(p=>p.tunnelWay===piece.sourceId)&&!/^(yes|true|1)$/.test(String(source.tags?.tunnel))){fail('reviewed-tunnel-source-tag-missing');continue;}
        const segment=piece.sourceSegment,refs=source.nodeIds;
        if(!Number.isInteger(segment)||segment<0||segment>=refs.length-1||piece.sourceNodeIds?.some((n,i)=>String(n)!==String(refs[segment+i]))){fail('unknown-or-wrong-original-source-support-segment');continue;}
        if(!profile||profile.basis!=='quadratic-local-u'||profile.domain?.[0]!==0||profile.domain?.[1]!==1||profile.coefficients?.length!==3||!profile.coefficients.every(finite)||!(profile.thicknessM>0)||!Array.isArray(piece.a)||!Array.isArray(piece.b)||piece.a.length!==2||piece.b.length!==2||![...piece.a,...piece.b].every(finite)||Math.hypot(piece.b[0]-piece.a[0],piece.b[1]-piece.a[1])<1e-8||piece.top?.length!==4||!piece.top.every(xyz)){fail('unsupported-or-malformed-support-profile');continue;}
        if(Math.abs(profile.thicknessM-model.thicknessM)>EPS){fail('support-thickness-differs-from-reviewed-model');continue;}
        let x=0,z=0;const raw=[];for(let i=0;i<(source.points||[]).length;i+=2){x+=source.points[i];z+=source.points[i+1];raw.push([x/data.q,z/data.q]);}
        if(raw.length!==refs.length){fail('missing-literal-source-support-coordinates');continue;}
        const A=raw[segment],B=raw[segment+1],dx=B[0]-A[0],dz=B[1]-A[1],l2=dx*dx+dz*dz;
        if(![piece.a,piece.b].every(p=>{const t=((p[0]-A[0])*dx+(p[1]-A[1])*dz)/l2;return t>=-EPS&&t<=1+EPS&&Math.hypot(p[0]-A[0]-dx*t,p[1]-A[1]-dz*t)<=EPS;})){fail('support-piece-shifted-off-literal-source-centre');continue;}
        const expected=reconstructed.profiles.get(piece.sourceId+':'+segment);
        if(!expected||expected.modelId!==piece.modelId||![0,.137,.389,.613,.877,1].every(u=>{const p=[piece.a[0]+(piece.b[0]-piece.a[0])*u,piece.a[1]+(piece.b[1]-piece.a[1])*u],t=((p[0]-A[0])*dx+(p[1]-A[1])*dz)/l2;return Math.abs(polynomial(piece,u)-(.2+expected.heightAt(t)))<=1e-5;})){fail('support-profile-disagrees-with-independent-reviewed-source-model');continue;}
        if(!Array.isArray(piece.bandSamples)||![0,.137,.389,.613,.877,1].every(u=>piece.bandSamples.some(s=>s.u===u&&finite(s.top)&&finite(s.bottom)&&Math.abs(polynomial(piece,u)-s.top)<=1e-8&&Math.abs(s.top-s.bottom-profile.thicknessM)<=1e-8))){fail('continuous-profile-not-independently-covered-by-native-samples');continue;}
        // Renderer quad order is a+,b+,b-,a-. Miter offsets may have a
        // longitudinal component: authored end heights are station0/1, while
        // the continuous band at the same lateral corner has a different u.
        // Both constraints remain independently checked against the body.
        if(piece.top.some((p,i)=>Math.abs(p[1]-polynomial(piece,i===0||i===3?0:1))>EPS)){fail('rendered-top-endpoints-disagree-with-authored-source-stations');continue;}
        if(!piece.renderedTopTriangles?.length||piece.renderedTopTriangles.some(t=>t.length!==3||!t.every(xyz))){fail('missing-actual-emitted-support-top-triangles');continue;}
        // Float32 coordinate representation is checked separately from the
        // physical contact tolerance: every emitted corner must correspond to
        // this very source slab's authored vertex, never a foreign low plane.
        const emittedCorners=piece.renderedTopTriangles.flat();
        const sameCorner=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=Math.abs(Math.fround(b[i])-b[i])+1e-10);
        if(emittedCorners.some(p=>!piece.top.some(q=>sameCorner(p,q)))||piece.top.some(p=>!emittedCorners.some(q=>sameCorner(q,p)))){fail('actual-rendered-top-is-not-this-source-support-piece');continue;}
        validated.push(piece);
    }
    return{passed:!issues.length,issues,pieces:validated};
}

/** Maximum profile minus a triangle edge: exact quadratic derivative, split
 * at projected endpoint clamps. This does not call a producer fitter. */
function continuousDeficit(piece,a,b){
    const u0=fraction(piece,a),du=fraction(piece,b)-u0,stops=[0,1];if(du)for(const u of[0,1]){const t=(u-u0)/du;if(t>0&&t<1)stops.push(t);}stops.sort((a,b)=>a-b);
    let best={value:-Infinity,point:null};const[A,B,C]=piece.topProfile.coefficients;
    for(let i=1;i<stops.length;i++){
        const lo=stops[i-1],hi=stops[i],p=mix(a,b,lo),q=mix(a,b,hi),s=Math.max(0,Math.min(1,u0+du*lo)),d=Math.max(0,Math.min(1,u0+du*hi))-s;
        const aa=A*d*d,bb=(2*A*s+B)*d-(q[1]-p[1]),cc=(A*s+B)*s+C-p[1],ts=[0,1];if(aa<0){const t=-bb/(2*aa);if(t>0&&t<1)ts.push(t);}
        for(const t of ts){const value=(aa*t+bb)*t+cc;if(value>best.value)best={value,point:mix(p,q,t)};}
    }return best;
}
function ownSlabTriangle(triangle,pieces,allowed){
    const same=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=Math.abs(Math.fround(b[i])-b[i])+1e-10);
    for(const p of pieces)if(allowed.has(p.modelId)){
        const top=p.top,bottom=top.map(q=>[q[0],q[1]-p.topProfile.thicknessM,q[2]]),faces=[top,bottom,...[0,1,2,3].map(i=>[top[i],top[(i+1)%4],bottom[(i+1)%4],bottom[i]])];
        if(faces.some(face=>triangle.every(v=>face.some(q=>same(v,q)))))return true;
    }return false;
}

export function auditTramBody(S,{samplePath,expectedHeading=S.actor?.heading}={}) {
    const issues=[],coverageGaps=[],actor=S.actor||{},frame=S.frameMatrix||IDENTITY,root=actor.matrixWorld,expected=transform(frame,[actor.x,actor.y,actor.z]);
    if(!inverseAffine(root)||!expected.every(finite)||Math.hypot(...sub(transform(root,[0,0,0]),expected))>EPS)issues.push({reason:'cold-or-mismatched-current-body-pose'});
    const emitted=emittedTriangles(S.parts,{frameMatrix:frame});if(!emitted.known)return{passed:false,issues,coverageGaps:[{reason:emitted.reason}],witnesses:[]};
    if(!S.sourceSpanKnown)coverageGaps.push({reason:'unresolved-source-connected-whole-body-span'});
    const catalogue=auditSupportCatalogue(S);coverageGaps.push(...catalogue.issues);
    const body=emitted.triangles.map(t=>({...t,bounds:box(t.points)})),bounds=box(body.flatMap(t=>t.points)),witnesses=[];
    const contactCounters={continuousViolatingEdgeConstraints:0,renderedViolatingClipVertices:0,worldTriangleContactPairs:0};
    let testedSupportEdges=0,minimumClearanceM=Infinity,ownPieces=0;
    const allowed=new Set(S.expectedModelIds||[]);
    let rigidPose=null;
    if(typeof samplePath!=='function')coverageGaps.push({reason:'missing-independent-source-body-sampler'});
    else {
        const invRoot=inverseAffine(root),invFrame=inverseAffine(frame);
        if(invRoot&&invFrame){
            const local=body.flatMap(t=>t.points.map(p=>transform(invRoot,transform(frame,p)))),minY=Math.min(...local.map(p=>p[1])),wheel=local.filter(p=>p[1]-minY<=1e-10),frontZ=Math.min(...wheel.map(p=>p[2])),rearZ=Math.max(...wheel.map(p=>p[2]));
            const origin=transform(invFrame,transform(root,[0,0,0])),basis=[0,1,2].map(i=>sub(transform(invFrame,transform(root,[i===0?1:0,i===1?1:0,i===2?1:0])),origin)),scale=basis.map(v=>Math.hypot(...v));
            const span=Math.max(actor.length/2,...local.map(p=>Math.abs(p[2])*scale[2])),C=samplePath(0),F=samplePath(-frontZ*scale[2]),R=samplePath(-rearZ*scale[2]),endpoints=[samplePath(span),samplePath(-span)];
            if(!(rearZ>frontZ)||scale.some(v=>!(v>0))||dot(basis[0],cross(basis[1],basis[2]))<=0)coverageGaps.push({reason:'unsupported-actual-rigid-body-support-geometry-or-scale'});
            else if(!C||!F||!R||endpoints.some(p=>!p))coverageGaps.push({reason:'unresolved-actual-wheel-or-whole-emitted-source-span'});
            else{
                const pitch=Math.atan2(F.y-R.y,Math.hypot(F.x-R.x,F.z-R.z)),baseline=C.y+.24,weight=rearZ/(rearZ-frontZ),chord=R.y+(F.y-R.y)*weight+.24,anchor=Math.max(baseline,chord),cp=Math.cos(pitch),sp=Math.sin(pitch),ch=Math.cos(expectedHeading),sh=Math.sin(expectedHeading);
                const posePoint=(p,y)=>{const x=p[0]*scale[0],yy=p[1]*scale[1],z=p[2]*scale[2],yp=cp*yy-sp*z,zp=sp*yy+cp*z;return[actor.x+ch*x+sh*zp,y+yp,actor.z-sh*x+ch*zp];};
                let needed=0;
                const proposed=local.map(p=>posePoint(p,anchor)),proposedBox=box(proposed),fitPieces=catalogue.pieces.filter(p=>{if(!allowed.has(p.modelId))return false;const b=box(p.top);return proposedBox.min[0]<=b.max[0]&&proposedBox.max[0]>=b.min[0]&&proposedBox.min[2]<=b.max[2]&&proposedBox.max[2]>=b.min[2];});
                for(let i=0;i<proposed.length;i+=3){const tri=proposed.slice(i,i+3);for(const piece of fitPieces){
                    const clipped=projectedClip(tri,piece.top);for(let k=0;k<clipped.length;k++)needed=Math.max(needed,continuousDeficit(piece,clipped[k],clipped[(k+1)%clipped.length]).value);
                    for(const top of piece.renderedTopTriangles){const cut=projectedClip(tri,top);for(const p of cut){const h=triangleY(top,p);if(h!==null)needed=Math.max(needed,h-p[1]);}}
                }}
                const y=anchor+needed,expectedBasis=[posePoint([1,0,0],0),posePoint([0,1,0],0),posePoint([0,0,1],0)].map(p=>[p[0]-actor.x,p[1],p[2]-actor.z]);
                const orientationError=Math.max(...basis.flatMap((v,i)=>v.map((n,j)=>Math.abs(n-expectedBasis[i][j]))));
                rigidPose={expectedY:y,expectedPitch:pitch,baselineY:baseline,bogieChordY:chord,independentLiftM:needed,actualSupportMinY:minY,actualWheelFrontZ:frontZ,actualWheelRearZ:rearZ,yErrorM:Math.abs(actor.y-y),orientationMatrixError:orientationError};
                if(rigidPose.yErrorM>1e-5||orientationError>1e-5)issues.push({reason:'actual-rigid-body-pose-differs-from-independent-minimum-support-fit',...rigidPose});
            }
        }
    }
    for(const piece of catalogue.pieces){
        const pbox=box(piece.top),near=bounds.min[0]<=pbox.max[0]&&bounds.max[0]>=pbox.min[0]&&bounds.min[2]<=pbox.max[2]&&bounds.max[2]>=pbox.min[2];if(!near)continue;
        if(!allowed.has(piece.modelId))continue;ownPieces++;
        for(const triangle of body){
            if(triangle.bounds.min[0]>pbox.max[0]||triangle.bounds.max[0]<pbox.min[0]||triangle.bounds.min[2]>pbox.max[2]||triangle.bounds.max[2]<pbox.min[2])continue;
            const clipped=projectedClip(triangle.points,piece.top);if(!clipped.length)continue;
            for(let i=0;i<clipped.length;i++){
                const p=clipped[i],q=clipped[(i+1)%clipped.length],need=continuousDeficit(piece,p,q);testedSupportEdges++;minimumClearanceM=Math.min(minimumClearanceM,-need.value);
                if(need.value>EPS){contactCounters.continuousViolatingEdgeConstraints++;if(witnesses.length<30)witnesses.push({reason:'emitted-body-below-continuous-own-slab',bodyPart:triangle.id,bodyTriangle:triangle.triangle,pieceId:piece.id,modelId:piece.modelId,sourceId:piece.sourceId,penetrationM:need.value,point:need.point});}
                for(const top of piece.renderedTopTriangles){const cut=projectedClip(triangle.points,top);for(const p of cut){const y=triangleY(top,p);if(y!==null&&y-p[1]>EPS){contactCounters.renderedViolatingClipVertices++;if(witnesses.length<30)witnesses.push({reason:'emitted-body-below-actual-rendered-own-slab',bodyPart:triangle.id,bodyTriangle:triangle.triangle,pieceId:piece.id,penetrationM:y-p[1],point:p});}}}
            }
        }
    }
    if(allowed.size&&(!ownPieces||!testedSupportEdges))coverageGaps.push({reason:'missing-same-model-whole-body-support-overlap'});
    const expectedSolids=S.staticCoverage?.expectedSolidIds,actualSolids=(S.solids||[]).map(s=>s.id);
    if(!S.staticCoverageComplete||!Array.isArray(expectedSolids)||new Set(expectedSolids).size!==expectedSolids.length||expectedSolids.length!==actualSolids.length||expectedSolids.some(id=>!actualSolids.includes(id))||S.staticCoverage?.unclassifiedIds?.length)coverageGaps.push({reason:'incomplete-actual-world-solid-geometry-coverage'});
    for(const solid of S.solids||[]){
        if(!solid.triangles?.length||solid.triangles.some(t=>t.length!==3||!t.every(xyz))){coverageGaps.push({reason:'malformed-or-unsupported-world-solid',solidId:solid.id});continue;}
        // Same-model slabs are checked above only after an independently valid
        // identity/profile/geometry match; roofs/posts/foreign slabs never skip.
        if(solid.kind==='support-slab'&&allowed.has(solid.modelId)&&catalogue.pieces.some(p=>p.id===solid.supportPieceId))continue;
        for(let i=0;i<solid.triangles.length;i++){const tri=solid.triangles[i],b=box(tri);if(!boxesMeet(bounds,b))continue;if(solid.kind==='native-world-mixed-batch'&&ownSlabTriangle(tri,catalogue.pieces,allowed))continue;for(const a of body){if(!boxesMeet(a.bounds,b))continue;const hit=triangleContact(a.points,tri);if(hit){contactCounters.worldTriangleContactPairs++;if(witnesses.length<30)witnesses.push({reason:'actual-emitted-body-world-solid-contact',solidId:solid.id,solidName:solid.name,kind:solid.kind,sourceId:solid.sourceId,modelId:solid.modelId,bodyPart:a.id,bodyTriangle:a.triangle,solidTriangle:solid.nativeTriangleIds?.[i]??i,point:hit.point,coplanar:hit.coplanar,bodyVertices:a.points,solidVertices:tri});}}}
    }
    if(witnesses.length)issues.push({reason:'actual-emitted-tram-geometry-contact',witnesses:witnesses.length});
    return{passed:!issues.length&&!coverageGaps.length,issues,coverageGaps,witnesses,contactCounters,rigidPose,bodyTriangles:body.length,testedSupportEdges,minimumClearanceM:finite(minimumClearanceM)?minimumClearanceM:null,bounds,producerCertificateAccepted:false};
}

/** Grade from independently checked same-source support, with explicit flat
 * local ground fallback only. No native motor-road deck search. */
export function sourceSupportHeight(S,way,a,b,t){
    return makeSourceSupportLookup(S).heightAt(way,a,b,t);
}
export function makeSourceSupportLookup(S){
    const catalogue=auditSupportCatalogue(S);
    return{catalogue,heightAt(way,a,b,t){
    const point=[a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t],values=[];
    for(const p of catalogue.pieces)if(p.sourceId===way.sourceId){const u=fraction(p,point);if(u>=-EPS&&u<=1+EPS&&Math.abs((point[0]-p.a[0])*(p.b[1]-p.a[1])-(point[2]-p.a[1])*(p.b[0]-p.a[0]))<=EPS*Math.hypot(p.b[0]-p.a[0],p.b[1]-p.a[1]))values.push({y:polynomial(p,Math.max(0,Math.min(1,u)))-.2,modelId:p.modelId,basis:'independent-native-sampled-source-support-profile'});}
    if(values.length)return Math.max(...values.map(v=>v.y))-Math.min(...values.map(v=>v.y))<=1e-5?values[0]:null;
    const tags=way.tags||{},no=v=>v==null||/^(no|false|0)$/.test(String(v));
    return no(tags.bridge)&&no(tags.tunnel)&&(tags.layer==null||Number(tags.layer)===0)&&(tags.level==null||Number(tags.level)===0)&&tags.ele==null&&tags.incline==null?{y:0,basis:'explicit-unsurveyed-flat-local-source-datum'}:null;
    }};
}
