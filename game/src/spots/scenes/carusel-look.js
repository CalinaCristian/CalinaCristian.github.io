import * as THREE from '../../../vendor/three.module.min.js';
import {canvas,canvasTexture,rng} from '../kit.js';

/** Procedural book bindings at real shelf scale; no reference-photo texture. */
export function caruselBooks(){
    const c=canvas(1024,1024),g=c.getContext('2d'),r=rng(82),palette=['#d9d3c5','#bdb7a6','#586568','#8d715c','#87938c','#b3a489','#4b5862','#e7dfce','#776861','#a8aaa0','#485052','#b49f85'];
    g.fillStyle='#dfdbd0';g.fillRect(0,0,1024,1024);
    for(let row=0;row<6;row++){const y=(row+1)*1024/6-6;g.fillStyle='#8e8b7e';g.fillRect(0,y,1024,6);g.fillStyle='#f1eee5';g.fillRect(0,y+3,1024,5);
        for(let x=8;x<1015;){const w=21+r()*39,h=94+r()*48;g.fillStyle=palette[Math.floor(r()*palette.length)];g.fillRect(x,y-h,w-2,h);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x,y-h,2,h);g.fillStyle='rgba(255,250,230,.5)';g.fillRect(x+3,y-h+2,w-8,2);
            g.fillStyle=r()>.5?'#ddd4be':'#49514d';for(let j=0;j<2+Math.floor(r()*3);j++)g.fillRect(x+5,y-h+13+j*7,Math.max(4,w-13),1.5);
            if(r()>.75){g.fillStyle='#b0a58c';g.fillRect(x+3,y-15,w-8,3);}x+=w+1+r()*3;
        }
    }
    const map=canvasTexture(c,{repeat:true});map.anisotropy=8;
    return new THREE.MeshStandardMaterial({map,roughness:.9,emissive:'#fff4df',emissiveMap:map,emissiveIntensity:.07});
}
