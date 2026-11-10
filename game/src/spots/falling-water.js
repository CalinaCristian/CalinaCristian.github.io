import * as THREE from '../../vendor/three.module.min.js';
import { canvas, canvasTexture, rng, alongPolyline, polylineLength } from './kit.js';

// Original procedural water; no reference image pixels. The caller owns the
// surveyed plan line and explicitly estimated upper/lower water datums.
export function fallingWater(ctx, {line, top, bottom, seed = 73}) {
    const length = polylineLength(line), random = rng(seed), drop = top - bottom;
    const texture = canvas(512, 256), paint = texture.getContext('2d');
    paint.clearRect(0, 0, 512, 256);
    // Broken thin rivulets leave the wet retaining wall visible between them.
    for (let i = 0; i < 150; i++) {
        const x = random() * 512, width = .5 + random() * 3.2;
        const gradient = paint.createLinearGradient(0, 0, 0, 256);
        const alpha = .15 + random() * .55;
        gradient.addColorStop(0, `rgba(220,232,220,${alpha})`);
        gradient.addColorStop(.35, `rgba(246,249,241,${alpha * .5})`);
        gradient.addColorStop(.72, `rgba(208,224,218,${alpha})`);
        gradient.addColorStop(1, `rgba(220,232,220,${alpha})`);
        paint.fillStyle = gradient; paint.fillRect(x, 0, width, 256);
    }
    const map = canvasTexture(texture, {repeat:true}); map.repeat.set(length / 2.4, 1);
    const material = new THREE.MeshStandardMaterial({map, color:'#e5eee7', transparent:true,
        opacity:.9, roughness:.22, metalness:.05, side:THREE.DoubleSide, depthWrite:false});
    const positions=[],uv=[],indices=[],columns=Math.max(2,Math.ceil(length/.65)),rows=8;
    for(let i=0;i<=columns;i++) {
        const s=length*i/columns, p=alongPolyline(line,s), nx=-p.tz,nz=p.tx;
        for(let j=0;j<=rows;j++) {
            const t=j/rows, outward=.035+.26*t*t;
            positions.push(p.x+nx*outward,top-drop*t,p.z+nz*outward);
            uv.push(i/columns,1-t);
            if(i&&j){const a=(i-1)*(rows+1)+j-1,b=i*(rows+1)+j-1;indices.push(a,b,b+1,a,b+1,a+1);}
        }
    }
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const fall=new THREE.Mesh(geometry,material);fall.name='waterfall-rivulets';fall.renderOrder=2;fall.userData.noFloor=true;ctx.add(fall);
    // Narrow irregular impact foam, rather than a solid white paved strip.
    const foamCanvas=canvas(256,128),f=foamCanvas.getContext('2d'),pixels=f.createImageData(256,128);
    for(let y=0;y<128;y++)for(let x=0;x<256;x++) {
        const k=(y*256+x)*4,edge=Math.sin(Math.PI*y/127),cloud=.5+.25*Math.sin(x*.19+y*.09)+.25*Math.sin(x*.07-y*.24);
        pixels.data[k]=237;pixels.data[k+1]=242;pixels.data[k+2]=233;pixels.data[k+3]=Math.round(140*edge*edge*Math.max(0,cloud));
    }
    f.putImageData(pixels,0,0);const foamMap=canvasTexture(foamCanvas,{repeat:true});foamMap.repeat.set(length/3,1);
    const fp=[],fu=[],fi=[];
    for(let i=0;i<=columns;i++) {
        const p=alongPolyline(line,length*i/columns),nx=-p.tz,nz=p.tx,width=.5+.14*Math.sin(i*1.7);
        fp.push(p.x+nx*.18,bottom+.04,p.z+nz*.18,p.x+nx*(.18+width),bottom+.04,p.z+nz*(.18+width));fu.push(i/columns,0,i/columns,1);
        if(i){const a=(i-1)*2;fi.push(a,a+2,a+3,a,a+3,a+1);}
    }
    const foamGeometry=new THREE.BufferGeometry();foamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));foamGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(fu,2));foamGeometry.setIndex(fi);foamGeometry.computeVertexNormals();
    const foam=new THREE.Mesh(foamGeometry,new THREE.MeshStandardMaterial({map:foamMap,transparent:true,opacity:.75,roughness:.8,depthWrite:false,side:THREE.DoubleSide}));foam.name='waterfall-impact-foam';foam.renderOrder=3;foam.userData.noFloor=true;ctx.add(foam);
    ctx.onUpdate(dt=>{map.offset.y=(map.offset.y+dt*.8)%1;foamMap.offset.x=(foamMap.offset.x+dt*.025)%1;});
    return {length,estimatedDropM:drop,triangles:geometry.index.count/3+foamGeometry.index.count/3,drawCalls:2,sourceLine:line.map(p=>[...p])};
}
