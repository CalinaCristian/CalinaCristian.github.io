import * as THREE from '../../vendor/three.module.min.js';
import {Painter,groundMaterial} from './ground.js';
import {canvasTexture,polyBox} from './kit.js';
import {onGround,isMotorRoad,roadWidth,COL} from './osm.js';
import {parseMeasure} from '../building-roofs.js';
import {sourceFaceHeightAt} from './source-water-faces.js';
const boxOfPoints=pts=>polyBox(pts);
const overlaps=(a,b)=>a.x0<=b.x1&&a.x1>=b.x0&&a.z0<=b.z1&&a.z1>=b.z0;
export function nativeContextInner(ctx){
    const W=Object.values(ctx.data.spots).flatMap(s=>s.extent?.polygon||[]),b=polyBox(W),m=v=>Math.round(v/8)*8;
    return{x0:m(b.x0-60),z0:m(b.z0-60),x1:m(b.x1+60),z1:m(b.z1+60)};
}
function contextOps(data){
    const p=new Painter();
    for(const a of data.areas){if(!onGround(a))continue;const t=a.rawTags;let color,mask='grass';
        if(t.natural==='water'||t.water)continue; // real flat water is a separate sourced surface
        if(['park','garden','recreation_ground','pitch','golf_course','dog_park','flowerbed'].includes(t.leisure)||['grass','meadow','forest','recreation_ground','village_green','allotments','flowerbed','greenery','shrubs','cemetery'].includes(t.landuse)||['wood','scrub','grassland'].includes(t.natural))color=COL.grass;
        else if(t.natural==='beach'){color=COL.sand;mask='dirt';}
        else if(t.amenity==='parking'||['railway','industrial','commercial','retail','garages'].includes(t.landuse)){color=COL.asphalt;mask='asphalt';}
        else if(t.man_made==='pier'||t.man_made==='quay'){color=COL.deck;mask='wood';}
        else if(t['area:highway']||t.place==='square'||t.highway==='pedestrian'){color=COL.pavers;mask='slab';}
        if(color)p.poly(a.poly,color,mask,a.holes);
    }
    for(const b of data.buildings)if(!b.part)p.poly(b.poly,COL.building,'none',b.holes);
    const ways=data.ways.filter(onGround);
    for(const w of ways){if(!isMotorRoad(w.k)||w.area==='yes')continue;const literal=parseMeasure(w.rawTags.width),width=literal>0?literal:roadWidth(w);
        // Sidewalks exist here only when explicitly mapped/tagged. Their width
        // is an estimate; a literal carriageway dimension is never expanded.
        const side=w.rawTags.sidewalk;if(side&&side!=='no'&&side!=='none'&&side!=='separate')p.line(w.pts,width+5.2,COL.sidewalk,'slab');
        p.line(w.pts,width,/brick|sett|cobble/.test(w.surface||'')?COL.brick:COL.asphalt,/brick|sett|cobble/.test(w.surface||'')?'brick':'asphalt');
    }
    for(const w of ways){if(isMotorRoad(w.k)||!['footway','path','cycleway','pedestrian','steps','track'].includes(w.k))continue;
        const literal=parseMeasure(w.rawTags.width),width=literal>0?literal:({footway:2.2,path:1.6,cycleway:2.6,pedestrian:5,steps:2.4,track:3}[w.k]);
        if(w.area==='yes')p.poly(w.pts,COL.pavers,'slab');else p.line(w.pts,width,/gravel|dirt|ground/.test(w.surface||'')?COL.gravel:COL.sidewalk,/gravel|dirt|ground/.test(w.surface||'')?'dirt':'slab');
    }
    for(const o of p.ops){const b=boxOfPoints(o.pts||o.poly);const width=o.t==='line'?o.w/2:0;o.sourceBounds={x0:b.x0-width,z0:b.z0-width,x1:b.x1+width,z1:b.z1+width};}
    return p.ops;
}
export function paintSourceContext(ctx,data){
    const ops=contextOps(data),inner=nativeContextInner(ctx),near={x0:inner.x0-420,z0:inner.z0-420,x1:inner.x1+420,z1:inner.z1+420};
    ctx.painter.ops.push(...ops.filter(o=>overlaps(o.sourceBounds,near)));
    ctx.extras.sourceContext.surfaceOps=ops;ctx.extras.sourceContext.nativeInner=inner;
    ctx.extras.sourceContext.surfaceBase={color:'#75816b',mask:'grass',basis:'Unclassified exterior ground colour/low vegetation is a material estimate; mapped areas, paving and roads override it. No inferred tree scattering.'};
}
const locate=(a,v)=>{let lo=0,hi=a.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(a[m]<=v)lo=m;else hi=m;}return Math.min(a.length-2,lo);};
/** Exact seam vertices with the native 2m patch; all other cells keep the
 * measured surround. Only boundary cells use a fan, retaining every edge sample. */
export function buildSourceContextGround(ctx,{box={x0:-4000,z0:-3600,x1:4000,z1:3600},step=40,tileM=2000,pixels=1024}={}){
    const state=ctx.extras.sourceContext,hole=state.nativeInner,ground=ctx.ground;
    const axis=(lo,hi,a,b)=>[...new Set([lo,hi,a,b,...Array.from({length:Math.ceil((hi-lo)/step)+1},(_,i)=>Math.min(hi,lo+i*step))])].filter(v=>v>=lo&&v<=hi).sort((a,b)=>a-b);
    const xs=axis(box.x0,box.x1,hole.x0,hole.x1),zs=axis(box.z0,box.z1,hole.z0,hole.z1),tiles=new Map(),cells=new Map(),nativeStep=ctx.terrainOpts.innerStep||2;
    const nativeNX=Math.round((hole.x1-hole.x0)/nativeStep),nativeNZ=Math.round((hole.z1-hole.z0)/nativeStep);
    const edgeXs=Array.from({length:nativeNX+1},(_,i)=>hole.x0+i*(hole.x1-hole.x0)/nativeNX),edgeZs=Array.from({length:nativeNZ+1},(_,i)=>hole.z0+i*(hole.z1-hole.z0)/nativeNZ);
    const height=(x,z)=>ground.heightAt(x,z);
    const triangle=(tile,cell,a,b,c)=>{const points=[a,b,c].map(([x,z])=>[Math.fround(x),Math.fround(height(x,z)),Math.fround(z)]),faces=state.water.compiled.cut([points[0],points[2],points[1]]);
        for(const face of faces){const k=tile.pos.length/3;for(const p of face)tile.pos.push(...p);tile.index.push(k,k+1,k+2);cell.push(face);}};
    for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
        const a=xs[i],b=xs[i+1],c=zs[j],d=zs[j+1],cx=(a+b)/2,cz=(c+d)/2;if(cx>hole.x0&&cx<hole.x1&&cz>hole.z0&&cz<hole.z1)continue;
        const key=`${Math.floor((cx-box.x0)/tileM)},${Math.floor((cz-box.z0)/tileM)}`,tile=tiles.get(key)||{pos:[],index:[]};tiles.set(key,tile);const cell=[];cells.set(j*xs.length+i,cell);
        const corners=[[a,c],[b,c],[b,d],[a,d]],poly=[];
        for(let e=0;e<4;e++){
            const p=corners[e],q=corners[(e+1)%4];poly.push(p);
            if(p[1]===q[1]&&(p[1]===hole.z0||p[1]===hole.z1)&&a>=hole.x0&&b<=hole.x1){const edge=edgeXs.filter(x=>x>Math.min(p[0],q[0])&&x<Math.max(p[0],q[0]));if(q[0]<p[0])edge.reverse();for(const x of edge)poly.push([x,p[1]]);}
            if(p[0]===q[0]&&(p[0]===hole.x0||p[0]===hole.x1)&&c>=hole.z0&&d<=hole.z1){const edge=edgeZs.filter(z=>z>Math.min(p[1],q[1])&&z<Math.max(p[1],q[1]));if(q[1]<p[1])edge.reverse();for(const z of edge)poly.push([p[0],z]);}
        }
        if(poly.length===4){triangle(tile,cell,poly[0],poly[1],poly[2]);triangle(tile,cell,poly[0],poly[2],poly[3]);}
        else for(let e=0;e<poly.length;e++)triangle(tile,cell,[cx,cz],poly[e],poly[(e+1)%poly.length]);
    }
    const group=new THREE.Group();group.name='source-context-ground';group.userData.noFloor=true;const materials=[]; // Ground's exact emitted-face query already owns this floor.
    for(const[key,tile]of tiles){
        const[ix,iz]=key.split(',').map(Number),x0=box.x0+ix*tileM,z0=box.z0+iz*tileM,W=Math.min(tileM,box.x1-x0),H=Math.min(tileM,box.z1-z0),painter=new Painter();
        const bounds={x0,z0,x1:x0+W,z1:z0+H};painter.ops=state.surfaceOps.filter(o=>overlaps(o.sourceBounds,bounds));
        const[color,mask]=painter.render(x0,z0,W,H,pixels,pixels,state.surfaceBase.color,state.surfaceBase.mask),material=groundMaterial(canvasTexture(color),canvasTexture(mask,{srgb:false}));materials.push(material);
        const g=new THREE.BufferGeometry(),uv=[];for(let i=0;i<tile.pos.length;i+=3)uv.push((tile.pos[i]-x0)/W,1-(tile.pos[i+2]-z0)/H);
        g.setAttribute('position',new THREE.Float32BufferAttribute(tile.pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(tile.index);g.computeVertexNormals();g.computeBoundingSphere();
        const m=new THREE.Mesh(g,material);m.name=`source-context-ground:${key}`;m.receiveShadow=false;group.add(m);
    }
    ctx.add(group);ctx.extras.sourceGroundMaterials=materials;
    const physical=(x,z)=>{
        if(x<box.x0||x>box.x1||z<box.z0||z>box.z1||x>hole.x0&&x<hole.x1&&z>hole.z0&&z<hole.z1)return null;
        const i=locate(xs,x),j=locate(zs,z),triangles=cells.get(j*xs.length+i);if(!triangles)return null;
        return sourceFaceHeightAt(triangles,x,z)??-Infinity;
    };
    ground.sourceTerrain.renderedHeightAt=physical;state.ground={box,step,tileM,nativeInner:hole,physical,group,triangles:[...cells.values()].reduce((n,c)=>n+c.length,0),seamBasis:'Every native inner-edge source sample retained with matching Float32 position/height'};
    return state.ground;
}
