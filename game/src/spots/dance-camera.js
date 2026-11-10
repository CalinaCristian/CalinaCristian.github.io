// Frame a real activity avatar in the part of the viewport left by its panel.
// The caller changes its actual activity camera; player/guest bodies never move.
export function danceViewFit({width,height,panel,position,avatar,target,fov=72}){
    const focal=height/(2*Math.tan(fov*Math.PI/360)),D=Math.hypot(target.x-position.x,target.z-position.z),fx=(target.x-position.x)/D,fz=(target.z-position.z)/D,rightX=-fz,rightZ=fx;
    const beside=width>height*1.2&&width-panel.right>220,top=beside?14:panel.bottom+12,bottom=height-20,desiredX=beside?(panel.right+12+width-16)/2:width/2;
    const points=[];for(const x of [-.4,.4])for(const z of [-.4,.4])for(const y of [-.08,avatar.upper??2.32])points.push({x:avatar.x+x,y:avatar.y+y,z:avatar.z+z});
    let result=null;
    for(let step=0;step<=10;step++){const cy=position.y+step*.1;let delta=beside?Math.atan((desiredX-width/2)/focal):0,pitch=0,bounds;
        for(let pass=0;pass<4;pass++){const ax=fx*Math.cos(delta)-rightX*Math.sin(delta),az=fz*Math.cos(delta)-rightZ*Math.sin(delta),rx=-az,rz=ax;
            const alpha=Math.max(...points.map(p=>Math.atan2(p.y-cy,(p.x-position.x)*ax+(p.z-position.z)*az)));pitch=alpha-Math.atan((height/2-top)/focal);
            const cp=Math.cos(pitch),sp=Math.sin(pitch),projected=points.map(p=>{const dx=p.x-position.x,dz=p.z-position.z,dy=p.y-cy,depthH=dx*ax+dz*az,depth=depthH*cp+dy*sp;return{x:width/2+focal*(dx*rx+dz*rz)/depth,y:height/2-focal*(dy*cp-depthH*sp)/depth};});
            bounds={left:Math.min(...projected.map(p=>p.x)),right:Math.max(...projected.map(p=>p.x)),top:Math.min(...projected.map(p=>p.y)),bottom:Math.max(...projected.map(p=>p.y))};
            if(beside&&pass<3)delta+=Math.atan((desiredX-(bounds.left+bounds.right)/2)/focal)*.8;
        }
        const ax=fx*Math.cos(delta)-rightX*Math.sin(delta),az=fz*Math.cos(delta)-rightZ*Math.sin(delta),limited=bounds.bottom>bottom+.1||bounds.top<top-.1||bounds.left<(beside?panel.right+8:4)||bounds.right>width-4;
        result={positionY:cy,look:{x:position.x+ax*D,y:cy+Math.tan(pitch)*D,z:position.z+az*D},beside,limited,bounds,panelBottom:panel.bottom};
        if(!limited)break;
    }
    return result;
}
