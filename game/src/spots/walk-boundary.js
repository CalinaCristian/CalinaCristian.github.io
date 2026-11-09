// A game visit boundary, independent of real source buildings/streets.
// The host calls constrain immediately after native walking/crowd collision.
import { inPoly, distPolyline, GeoBatch } from './kit.js';

export function walkBoundary(regions, { radius = .31 } = {}) {
    let lastHint = -100;
    const inside = (x,z) => regions().some(p => inPoly(x,z,p) && distPolyline(x,z,[...p,p[0]]).d >= radius);
    return {
        inside,
        constrain(ctl, before, session) {
            if(ctl.active===false || !inside(before.x,before.z))return false;
            const ox=before.x,oz=before.z,tx=ctl.x,tz=ctl.z,dx=tx-ox,dz=tz-oz,L=Math.hypot(dx,dz);
            if(L<1e-9)return false;
            // Test the complete swept movement, including a concave focus corner.
            const n=Math.max(1,Math.ceil(L/.12));let good=0,bad=null;
            for(let i=1;i<=n;i++){const t=i/n;if(!inside(ox+dx*t,oz+dz*t)){bad=t;break;}good=t;}
            if(bad===null)return false;
            for(let i=0;i<16;i++){const t=(good+bad)/2;if(inside(ox+dx*t,oz+dz*t))good=t;else bad=t;}
            ctl.x=ox+dx*good;ctl.z=oz+dz*good;ctl.vx=ctl.vz=0;ctl.vel=0;ctl.place?.();
            if(session && session.t-lastHint>5){lastHint=session.t;session.ui.toast('Edge of the Old Town visit','Follow the marked lanes back to the clubs and Carusel.');}
            return true;
        },
    };
}

/** Subtle, explicitly game-coloured dashed line only where a source public way exits. */
export function markVisitExits(ctx, polygon) {
    const batch=new GeoBatch(), exits=[];
    for(const way of ctx.data.ways.filter(w=>['pedestrian','footway','living_street'].includes(w.k)))for(let i=1;i<way.pts.length;i++){
        const a=way.pts[i-1],b=way.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(!L)continue;
        for(let j=0;j<polygon.length;j++){const c=polygon[j],d=polygon[(j+1)%polygon.length],ex=d[0]-c[0],ez=d[1]-c[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-8)continue;
            const t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/den;if(t<0||t>1||u<0||u>1)continue;
            const x=a[0]+dx*t,z=a[1]+dz*t;if(exits.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;
            exits.push({x,z,source:way.id});for(let k=-3;k<=3;k++){const px=x+dz/L*k*.7,pz=z-dx/L*k*.7;batch.box(px,ctx.ground.heightAt(px,pz)+.025,pz,.32,.012,.055,'#d4b359','paint',Math.atan2(dz,-dx));}
        }
    }
    ctx.add(batch.build('game-visit-edge-marks',{castShadow:false}));return exits;
}
