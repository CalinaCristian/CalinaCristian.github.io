// Bucharest Old Town heroes for scenes/buc-old-town.js (split out by spec 22): Cărturești Carusel, Hanul lui Manuc,
// the Curtea Veche ruins and Stavropoleos, plus the outline / wall-collider helpers the scene shares with them.
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, rng, polyBox, inPoly, offsetPolyline, distPolyline, canvas, canvasTexture, fitDraw, obb, polyArea } from '../kit.js';
import { classicFacade, classicWalls, palisade, osmPoly, signAtlas, bucActivity } from '../buc.js';
import { wallGeometry } from '../osm.js';
import { onActivityCancel } from '../participation.js';
import { buildCaruselInterior } from './carusel-interior.js';
import { declareInterior } from '../precip-shelter.js';

function simplify(pts, tol) { if (pts.length < 4) return pts; const dist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; }; let md = 0, mi = 0; for (let i = 1; i < pts.length - 1; i++) { const dd = dist(pts[i], pts[0], pts[pts.length - 1]); if (dd > md) { md = dd; mi = i; } } if (md <= tol) return [pts[0], pts[pts.length - 1]]; return [...simplify(pts.slice(0, mi + 1), tol).slice(0, -1), ...simplify(pts.slice(mi), tol)]; }
const simplifyRing = (p, tol) => { const s2 = simplify([...p, p[0]], tol); s2.pop(); return s2.length >= 3 ? s2 : p; };
function grow(poly, d) { const cw = polyArea(poly) > 0; const o = offsetPolyline([...poly, poly[0], poly[1]], cw ? -d : d); return o.slice(1, poly.length + 1); }
const wallSeg = (ctx, ax, az, bx, bz, y0, y1) => ctx.collider({ wall: true, ax, az, bx, bz, y0a: y0, y1a: y1, y0b: y0, y1b: y1, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 0.5 });
/** walls of a closed ring as wall colliders, leaving `gaps` [{x, z, w}] open */
function ringWalls(ctx, poly, y0, y1, gaps = []) {
    for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        let segs = [[0, 1]];
        for (const g of gaps) { const t = ((g.x - ax) * (bx - ax) + (g.z - az) * (bz - az)) / (L * L), dd = Math.abs((g.x - ax) * (bz - az) - (g.z - az) * (bx - ax)) / L; if (t < 0 || t > 1 || dd > 2) continue; const h = g.w / 2 / L; segs = segs.flatMap(([s, e]) => (t + h <= s || t - h >= e ? [[s, e]] : [[s, Math.max(s, t - h)], [Math.min(e, t + h), e]].filter(([p, q]) => q - p > 0.02))); }
        for (const [s, e] of segs) wallSeg(ctx, ax + (bx - ax) * s, az + (bz - az) * s, ax + (bx - ax) * e, az + (bz - az) * e, y0, y1);
    }
}

// ---------------------------------------------------------------------------- Cărturești Carusel (Lipscani 55)
// OSM way 658009149: 27.4 × 13.4 m, the narrow front faces Lipscani (south). Street front: rusticated white stucco, a giant
// arch over two storeys filled with a three-light arched window, the "cărturești" band over the shop window, an attic
// aedicule with urn finials and the glass mansard roof. Inside: six white levels round an oval atrium with undulating
// balustrades, bookshelves on every wall, the bistro on the top floor (levels reached by walking the modeled stair).
function buildCarusel(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'w658009149'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const p = bd.poly, o = obb(p), y0 = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) + 0.05;
    // front edge = the edge facing Lipscani (largest z)
    let fi = 0, fz = -1e9; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length], mz = (p[i][1] + q[1]) / 2; if (mz > fz && Math.hypot(q[0] - p[i][0], q[1] - p[i][1]) > 8) { fz = mz; fi = i; } }
    const A = p[fi], B = p[(fi + 1) % p.length], fx = (A[0] + B[0]) / 2, fzz = (A[1] + B[1]) / 2, FW = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / FW, uz = (B[1] - A[1]) / FW; let nx = uz, nz = -ux; if (nz < 0) { nx = -nx; nz = -nz; } // outward normal (toward the street)
    const yaw = Math.atan2(nx, nz), H = 19.5, b = new GeoBatch(), WH = '#e9e2d2';
    const fac = classicFacade('carusel-side', [{ t: 'blank', rustic: true }, { t: 'rect', w: 0.3 }, { t: 'rect', w: 0.3 }, { t: 'small', w: 0.26 }], { bay: 3.4, floor: 4.9, lit: 0.5 });
    // The custom front elevation owns this exact face. Keep the other source
    // faces in the shell, so an opaque duplicate cannot cover the open door.
    const sides=wallGeometry(p,y0,y0+H,fac.S,y0,WH), vertices=sides.attributes.position, kept=[];
    for(let i=0;i<sides.index.count;i+=3){const tri=[sides.index.getX(i),sides.index.getX(i+1),sides.index.getX(i+2)];
        if(tri.every(j=>Math.abs((vertices.getX(j)-fx)*nx+(vertices.getZ(j)-fzz)*nz)<.01))continue;kept.push(...tri);}
    sides.setIndex(kept);b.add(sides,fac.key,null,WH);sides.dispose();
    // the street front: a canvas elevation (no photo): rustication, giant arch with 3 arched lights, sign band, door
    const fc = canvas(512, 768), x = fc.getContext('2d'), S = 512 / FW, PX = (m) => m * S, PY = (m) => 768 - m * (768 / (H + 0.5));
    x.fillStyle = '#ebe5d8'; x.fillRect(0, 0, 512, 768);
    x.fillStyle = 'rgba(80,70,55,0.18)'; for (let yy = PY(H); yy < 768; yy += 9) x.fillRect(0, yy, 512, 1.6); // rustication
    // giant arch (2 storeys), moulded archivolt with beads
    const ax0 = PX(1.6), ax1 = PX(FW - 1.6), aTop = PY(14.2), aw = ax1 - ax0;
    x.fillStyle = '#e2dccd'; x.beginPath(); x.moveTo(ax0 - 18, PY(0.4)); x.lineTo(ax0 - 18, aTop + aw / 2 * 0.62); x.quadraticCurveTo(256, aTop - 46, ax1 + 18, aTop + aw / 2 * 0.62); x.lineTo(ax1 + 18, PY(0.4)); x.fill();
    x.strokeStyle = 'rgba(120,108,88,0.6)'; x.lineWidth = 3; x.stroke();
    for (let i = 0; i < 26; i++) { const t = i / 25, px = ax0 - 9 + (aw + 18) * t, py = aTop + aw / 2 * 0.62 - Math.sin(t * Math.PI) * (aw * 0.31 + 23); x.fillStyle = '#d6cfbf'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    x.fillStyle = '#b9b29f'; x.fillRect(ax0, aTop + 30, aw, PY(0.4) - aTop - 30); // grey frame
    const gl = (gx, gy, gw, gh) => { const gr = x.createLinearGradient(0, gy, 0, gy + gh); gr.addColorStop(0, '#9fb3bf'); gr.addColorStop(1, '#46525a'); x.fillStyle = gr; x.beginPath(); x.moveTo(gx, gy + gh); x.lineTo(gx, gy + gw / 2); x.arc(gx + gw / 2, gy + gw / 2, gw / 2, Math.PI, 0); x.lineTo(gx + gw, gy + gh); x.fill(); x.fillStyle = 'rgba(70,72,70,0.9)'; x.fillRect(gx, gy + gh * 0.55, gw, 3); };
    gl(ax0 + aw * 0.05, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6)); gl(ax0 + aw * 0.44, PY(12.0), aw * 0.12, PY(6.4) - PY(12.0)); gl(ax0 + aw * 0.59, PY(12.6), aw * 0.36, PY(6.4) - PY(12.6));
    x.fillStyle = '#f7f6f2'; x.fillRect(ax0 + aw * 0.02, PY(6.3), aw * 0.96, PY(5.0) - PY(6.3)); // sign band
    fitDraw(x, 'cărturești', ax0 + aw * 0.06, PY(6.25), aw * 0.6, (PY(5.45) - PY(6.25)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#2f6b3a', align: 'left' });
    fitDraw(x, 'carte, ceai, muzică, dichis', ax0 + aw * 0.06, PY(5.5), aw * 0.6, (PY(5.05) - PY(5.5)), { font: (q) => `500 ${q}px "Courier New", monospace`, color: '#333', align: 'left' });
    x.fillStyle = '#3d8b3d'; x.fillRect(ax0 + aw * 0.78, PY(6.2), aw * 0.1, PY(5.1) - PY(6.2));
    gl(ax0 + aw * 0.04, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9)); gl(ax0 + aw * 0.6, PY(4.9), aw * 0.36, PY(0.5) - PY(4.9));
    x.fillStyle = '#2a2a28'; x.fillRect(ax0 + aw * 0.44, PY(4.0), aw * 0.12, PY(0.4) - PY(4.0)); // door
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(256, aTop - 4, 22, 0, 7); x.fill(); x.fillStyle = '#8a3a2a'; x.fillRect(244, aTop - 2, 24, 8); // cartouche
    x.fillStyle = 'rgba(90,80,65,0.5)'; x.fillRect(0, PY(H - 0.4), 512, 6); // cornice shadow
    // Match the existing physical entrance gap with a visibly open central
    // doorway. Its detailed size is an estimate, not a surveyed portal plan.
    x.clearRect(PX(FW/2-1.15),PY(3.1),PX(2.3),PY(0)-PY(3.1)+2);
    // The two ground-floor shop windows transmit the modeled interior; only
    // these existing glazed openings lose opaque paint, not the source piers.
    x.globalCompositeOperation='destination-out';
    for(const start of [.04,.6]){const gx=ax0+aw*start,gy=PY(4.9),gw=aw*.36,gh=PY(.5)-PY(4.9);x.beginPath();x.moveTo(gx,gy+gh);x.lineTo(gx,gy+gw/2);x.arc(gx+gw/2,gy+gw/2,gw/2,Math.PI,0);x.lineTo(gx+gw,gy+gh);x.closePath();x.fill();}
    x.globalCompositeOperation='source-over';
    const ft = canvasTexture(fc);
    const fm = new THREE.MeshStandardMaterial({ map: ft, alphaTest:.5, side:THREE.FrontSide, roughness: 0.75, emissive: new THREE.Color('#ffe7c2'), emissiveMap: ft, emissiveIntensity: 0 }); fm.userData.dayGlow = 0; fm.userData.nightGlow = 0.45;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(FW, H + 0.5), fm); front.position.set(fx + nx * 0.06, y0 + (H + 0.5) / 2, fzz + nz * 0.06); front.rotation.y = yaw; front.name = 'carusel-front'; ctx.add(front);
    // The interior sees plain plaster, never the exterior shop sign backwards.
    // Reuse only our procedural elevation's alpha silhouette so the exact
    // doorway/window openings still transmit the real modeled room.
    const backCanvas=canvas(512,768),backPaint=backCanvas.getContext('2d');backPaint.drawImage(fc,0,0);backPaint.globalCompositeOperation='source-in';backPaint.fillStyle='#f4f2eb';backPaint.fillRect(0,0,512,768);
    const frontBack=new THREE.Mesh(new THREE.PlaneGeometry(FW,H+.5),new THREE.MeshStandardMaterial({map:canvasTexture(backCanvas),alphaTest:.5,side:THREE.BackSide,roughness:.88}));frontBack.name='carusel-front-inward-plaster';frontBack.position.copy(front.position).add(new THREE.Vector3(-nx*.025,0,-nz*.025));frontBack.rotation.y=yaw;ctx.add(frontBack);
    const glazing=new GeoBatch(),glassMat=new THREE.MeshStandardMaterial({color:'#a4c3c8',transparent:true,opacity:.13,roughness:.16,metalness:.04,depthWrite:false,side:THREE.DoubleSide});
    for(const start of [.04,.6]){const centre=(1.6+((FW-3.2)*start)+(FW-3.2)*.18)-FW/2,px=fx+ux*centre+nx*.025,pz=fzz+uz*centre+nz*.025,w=(FW-3.2)*.36;
        glazing.quad([px-ux*w/2,y0+.5,pz-uz*w/2],[px+ux*w/2,y0+.5,pz+uz*w/2],[px+ux*w/2,y0+4.9,pz+uz*w/2],[px-ux*w/2,y0+4.9,pz-uz*w/2],'#ffffff','caruselGlass');}
    ctx.add(glazing.build('carusel-source-front-glazing',{castShadow:false,matOverrides:{caruselGlass:glassMat}}));
    for(const side of [-1,1])b.box(fx+ux*side*1.2,y0,fzz+uz*side*1.2,.1,3.15,.15,'#34332d','wood',yaw);
    b.box(fx,y0+3.1,fzz,2.5,.12,.15,'#34332d','wood',yaw);
    ctx.extras.caruselDoor={x:fx,z:fzz,y:y0,nx,nz,width:2.3,estimatedPortal:true};
    // cornice, attic aedicule with urns, glass mansard
    b.box(fx + nx * 0.3, y0 + H - 0.2, fzz + nz * 0.3, 0.9, 0.9, FW + 0.6, '#f1ece2', 'stone', yaw + Math.PI / 2);
    b.box(fx - nx * 0.6, y0 + H + 0.7, fzz - nz * 0.6, 1.2, 5.6, 4.2, WH, 'stone', yaw + Math.PI / 2);
    b.add(new THREE.ConeGeometry(2.9, 1.6, 3), 'stone', M(fx - nx * 0.2, y0 + H + 7.1, fzz - nz * 0.2, 0, yaw, Math.PI / 2, 1, 1, 0.45), '#f1ece2');
    for (const s of [-1, 1]) { const qx = fx + ux * s * (FW / 2 - 0.6), qz = fzz + uz * s * (FW / 2 - 0.6); b.box(qx, y0 + H + 0.7, qz, 1, 1.4, 1, WH, 'stone'); b.sphere(qx, y0 + H + 2.6, qz, 0.5, 0.7, 0.5, '#efe9dc', 'stone', 10, 8); }
    b.sphere(fx - nx * 0.3, y0 + H + 8.3, fzz - nz * 0.3, 0.45, 0.6, 0.45, '#efe9dc', 'stone', 10, 8);
    const roofP = grow(p, -0.3), oc = o;
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.7, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4), 'darkglass', M(oc.cx, y0 + H + 2.3, oc.cz, 0, -oc.angle, 0, oc.len - 0.6, 4.6, oc.wid - 0.6), '#3b4148');
    const roofPoint=(u,v,y)=>[oc.cx+oc.ux*u+oc.uz*v,y,oc.cz+oc.uz*u-oc.ux*v];
    for(const su of [-1,1])for(const sv of [-1,1])b.rod(roofPoint(su*(oc.len-.6)/2,sv*(oc.wid-.6)/2,y0+H+.02),roofPoint(su*(oc.len-.6)*.35,sv*(oc.wid-.6)*.35,y0+H+4.62),.03,'#59605a','metal',5);
    void roofP;
    // The source outline and the existing2.3m door stay physically exact.
    ringWalls(ctx,p,y0-1,y0+H+6,[{x:fx,z:fzz,w:2.3}]);
    // roofed (glass mansard): no rain or snow inside, standing in it or looking in from Lipscani
    declareInterior(ctx,{poly:p,y0:y0-1,y1:y0+H+4.7,name:'carusel'});
    ctx.extras.caruselFloor=()=>ctx.painter.poly(p,'#9b8062','wood');
    const roofGlass=new THREE.MeshStandardMaterial({color:'#b9ced0',transparent:true,opacity:.2,roughness:.16,metalness:.06,depthWrite:false,side:THREE.DoubleSide});roofGlass.name='carusel-skylight-glass';
    const shell=b.build('carusel',{matOverrides:{[fac.key]:fac.mat,darkglass:roofGlass}}),insideMaterials=new Map(),plaster=new THREE.Group();plaster.name='carusel-white-interior-walls';
    const plasterMat=new THREE.MeshStandardMaterial({color:'#ece8de',side:THREE.BackSide,roughness:.88,emissive:'#fff4df',emissiveIntensity:.025});
    shell.traverse(o=>{if(!o.isMesh)return;if(o.material===fac.mat){const finish=o.geometry.clone(),pos=finish.attributes.position,normal=finish.attributes.normal;
            for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)-normal.getX(i)*.025,pos.getY(i),pos.getZ(i)-normal.getZ(i)*.025);finish.computeBoundingSphere();
            const wall=new THREE.Mesh(finish,plasterMat);wall.name='carusel-inward-plaster';wall.receiveShadow=true;plaster.add(wall);}
        const inward=m=>{if(m===roofGlass)return m;if(!insideMaterials.has(m)){const copy=m.clone();copy.side=m===fac.mat?THREE.FrontSide:THREE.DoubleSide;copy.userData={...m.userData,shared:true};insideMaterials.set(m,copy);}return insideMaterials.get(m);};o.material=Array.isArray(o.material)?o.material.map(inward):inward(o.material);});ctx.add(shell);ctx.add(plaster);
    (ctx.extras.sceneCleanups||=[]).push(()=>{for(const m of insideMaterials.values())m.dispose();});
    const result={front:{x:fx,z:fzz,nx,nz,yaw},y0,sourceDatum:y0,ecx:oc.cx,ecz:oc.cz,along:Math.atan2(oc.ux,oc.uz),poly:p};
    // The backdrop settles untouched lots onto final street levels. Construct
    // only the interior afterwards, leaving every exterior/collider datum above
    // exactly where it was placed from the original source boundary.
    result.finishInterior=()=>{
        if(result.interior)return result;
        const interior=buildCaruselInterior(ctx,{poly:p,o:oc,front:result.front,datum:y0,height:H});
        const floorY=interior.floorY,LV=interior.levels,stairPath=interior.path;
        ctx.extras.caruselDoor.y=floorY;
        const climb={previous:null,distance:0,ascent:0,done:false};
        onActivityCancel(ctx,()=>{climb.previous=null;climb.distance=0;climb.ascent=0;});
        ctx.onUpdate((dt,s,pl)=>{if(!pl||climb.done)return;const previous=climb.previous;climb.previous={x:pl.x,y:pl.y,z:pl.z};if(!previous)return;
            const d=Math.hypot(pl.x-previous.x,pl.z-previous.z),dy=pl.y-previous.y;
            if(!s.ctl.active||d>Math.max(.8,dt*6)||Math.abs(dy)>.75){climb.distance=0;climb.ascent=0;return;}
            if(!inPoly(pl.x,pl.z,p)){climb.distance=0;climb.ascent=0;return;}
            climb.distance+=d;climb.ascent+=Math.max(0,dy);
            if(pl.y>=floorY+LV.at(-1)-.15&&climb.distance>=18&&climb.ascent>=LV.at(-1)*.86){climb.done=true;bucActivity(s,'old-town-lipscani','carusel','📚 Carusel stair climb','Top gallery reached. Enjoy the view down into the bookshop atrium.');}
        });
        ctx.interactables.push({kind:'stairs',x:stairPath[0].x,z:stairPath[0].z,y:floorY,r:2.2,tourAvailable:()=>false,label:'Walk the visible stairs to the top gallery',use:s=>s.ui.toast('📚 Walk up the stairs','Follow the visible treads and galleries to the top. Keep climbing to complete the stair walk.')});
        ctx.extras.caruselStairs={path:stairPath,climb,landings:interior.landings,holes:interior.holes,gallerySurfaces:interior.gallerySurfaces,estimatedLayout:true};
        Object.assign(result,{y0:floorY,LV,stair:stairPath[0],interior});return result;
    };
    return result;
}

// ---------------------------------------------------------------------------- Hanul lui Manuc
function buildManuc(ctx) {
    const d = ctx.data, g = ctx.ground, bd = d.buildings.find((x) => x.id === 'r19803024'); if (!bd) return null;
    ctx.skipBuildings.add(bd.id);
    const outer = bd.poly, hole = bd.holes?.[0] || null, y0 = Math.min(...outer.map(([x, z]) => g.heightAt(x, z))) - 0.2, H = 9.2;
    const fac = classicFacade('manuc', [{ t: 'rect', w: 0.28, top: 0.3, bottom: 0.2, cornice: false }, { t: 'rect', w: 0.3, top: 0.22, cornice: false }, { t: 'rect', w: 0.28, cornice: false }, { t: 'rect', w: 0.3, cornice: false }], { bay: 3.4, floor: 4.6, lit: 0.6 });
    const b = new GeoBatch(), WALL = '#f2efe7', WOOD = '#3b2a1e';
    classicWalls(b, fac, outer, y0, y0 + H, WALL, y0);
    if (hole) classicWalls(b, fac, [...hole].reverse(), y0, y0 + H, WALL, y0);
    // deep dark timber eave + roof (ring roof: two slopes to a ridge between the outer wall and the courtyard)
    const eo = grow(outer, 1.3); b.prism(eo, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true, bottom: true });
    if (hole) { const ei = grow(hole, -1.3); b.prism(hole, y0 + H - 0.1, y0 + H + 0.35, WOOD, 'wood', { noTop: true }); void ei; }
    const so = simplifyRing(outer, 2.5), eoS = grow(so, 1.3), roofCol = '#5b4c40';
    // (r2) a fixed 5.8 m inward offset crossed itself at the short edges of the rounded corners (spikes over the gate): each
    // ridge point now sits half-way to the opposite wall of the wing
    const mid = (ring, other, fallback) => other ? ring.map(([x, z]) => { const q = distPolyline(x, z, [...other, other[0]]); return [(x + q.cx) / 2, (z + q.cz) / 2]; }) : fallback();
    const ridgeO = mid(so, hole, () => grow(so, -5.8));
    const strip = (A, Bp, ya, yb) => { for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; b.quad([A[i][0], ya, A[i][1]], [A[j][0], ya, A[j][1]], [Bp[j][0], yb, Bp[j][1]], [Bp[i][0], yb, Bp[i][1]], roofCol, 'roofs'); b.quad([A[j][0], ya, A[j][1]], [A[i][0], ya, A[i][1]], [Bp[i][0], yb, Bp[i][1]], [Bp[j][0], yb, Bp[j][1]], roofCol, 'roofs'); } };
    strip(eoS, ridgeO, y0 + H + 0.35, y0 + H + 4.2);
    if (hole) { const sh = simplifyRing(hole, 2.5), hi = grow(sh, -1.4), ridgeI = mid(sh, outer, () => grow(sh, 5.8)); strip(hi, ridgeI, y0 + H + 0.35, y0 + H + 4.2); }
    // courtyard galleries: wooden posts + upper balustrade round the courtyard
    if (hole) { const gi = grow(hole, -2.2); for (let i = 0; i < gi.length; i++) { const [ax, az] = gi[i], [bx, bz] = gi[(i + 1) % gi.length], L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 2.8)); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; b.box(x, y0, z, 0.24, H, 0.24, WOOD, 'wood'); ctx.circle(x, z, 0.16, 3); } b.rod([ax, y0 + 4.6 + 1.0, az], [bx, y0 + 4.6 + 1.0, bz], 0.06, WOOD, 'wood', 4); b.rod([ax, y0 + 4.6, az], [bx, y0 + 4.6, bz], 0.18, WOOD, 'wood', 4); for (let k = 0; k <= n * 4; k++) { const t = k / (n * 4); b.box(ax + (bx - ax) * t, y0 + 4.6, az + (bz - az) * t, 0.05, 1.0, 0.05, WOOD, 'wood'); } } }
    // the gate on Str. Franceză (north wing) + "HANUL MANUC" letters
    // the gate: on the outer wall edge nearest Str. Franceză at x ≈ 200 (north wing), passage straight through to the courtyard
    let gate = { x: 199.5, z: 167.5 }, gn = { x: 0, z: -1 }, bestD = 1e9;
    for (let i = 0; i < outer.length; i++) { const [ax, az] = outer[i], [bx, bz] = outer[(i + 1) % outer.length], L = Math.hypot(bx - ax, bz - az); if (L < 4) continue; const t = Math.max(0.1, Math.min(0.9, ((200 - ax) * (bx - ax) + (150 - az) * (bz - az)) / (L * L))), px = ax + (bx - ax) * t, pz = az + (bz - az) * t, dd = Math.hypot(px - 200, pz - 150); if (dd < bestD) { bestD = dd; gate = { x: px, z: pz }; gn = { x: (bz - az) / L, z: -(bx - ax) / L }; if (gn.z > 0) { gn.x = -gn.x; gn.z = -gn.z; } } }
    const gate2 = { x: gate.x - gn.x * 17, z: gate.z - gn.z * 17 }, gyaw = Math.atan2(gn.x, gn.z);
    { // the arched gateway (dark passage), timber doors folded back
        const gc = canvas(256, 256), gx = gc.getContext('2d'); gx.fillStyle = '#f2efe7'; gx.fillRect(0, 0, 256, 256); gx.fillStyle = '#d9d2c2'; gx.beginPath(); gx.moveTo(40, 256); gx.lineTo(40, 90); gx.arc(128, 90, 88, Math.PI, 0); gx.lineTo(216, 256); gx.fill(); gx.fillStyle = '#1e1813'; gx.beginPath(); gx.moveTo(56, 256); gx.lineTo(56, 96); gx.arc(128, 96, 72, Math.PI, 0); gx.lineTo(200, 256); gx.fill();
        const gm = new THREE.MeshStandardMaterial({ map: canvasTexture(gc), roughness: 0.8 }), gp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), gm); gp.position.set(gate.x + gn.x * 0.05, y0 + 2.3, gate.z + gn.z * 0.05); gp.rotation.y = gyaw; gp.name = 'manuc-gate'; ctx.add(gp);
    }
    const sg = signAtlas([{ x: gate.x + gn.x * 0.1, y: y0 + 5.4, z: gate.z + gn.z * 0.1, yaw: gyaw, w: 5.4, h: 0.8, text: 'HANUL MANUC', bg: '#f2efe7', fg: '#3b2a1e', border: false, font: (q) => `700 ${q}px Georgia, serif` }], { name: 'manuc-sign', night: 0.6 });
    if (sg) ctx.add(sg);
    // collisions: outer + inner ring walls with the gate passage open
    ringWalls(ctx, outer, y0 - 1, y0 + H + 4, [{ x: gate.x, z: gate.z, w: 3.6 }]);
    if (hole) ringWalls(ctx, hole, y0 - 1, y0 + H + 4, [{ x: gate2.x, z: gate2.z, w: 3.6 }]);
    for (const s of [-1, 1]) wallSeg(ctx, gate.x - gn.z * s * 1.8, gate.z + gn.x * s * 1.8, gate2.x - gn.z * s * 1.8, gate2.z + gn.x * s * 1.8, y0 - 1, y0 + H);
    ctx.add(b.build('manuc', { matOverrides: { [fac.key]: fac.mat } }));
    // courtyard: stone pavers, terrace tables under umbrellas
    if (hole) { ctx.painter.poly(hole, '#9a9286', 'cobble'); const t = new GeoBatch(), r = rng(4), bb = polyBox(hole); for (let i = 0; i < 16; i++) { const x = bb.x0 + 5 + r() * (bb.x1 - bb.x0 - 10), z = bb.z0 + 5 + r() * (bb.z1 - bb.z0 - 10); if (!inPoly(x, z, grow(hole, -3))) continue; t.cyl(x, y0 + 0.2, z, 0.05, 0.75, '#2a2a2a', 'metal', 6); t.cyl(x, y0 + 0.95, z, 0.45, 0.04, '#6b4a32', 'wood', 10); t.cyl(x, y0 + 0.2, z, 0.035, 2.4, '#d8d0c0', 'wood', 5); t.add(new THREE.ConeGeometry(1.5, 0.6, 8), 'fabric', M(x, y0 + 2.75, z), r.pick(['#efe7d4', '#7a2230', '#2f5a3a'])); ctx.circle(x, z, 0.8, 1); } ctx.add(t.build('manuc-yard')); }
    return { gate, gn, y0, hole };
}

// ---------------------------------------------------------------------------- Curtea Veche: ruins, bust, 1559 church
function buildCurteaVeche(ctx) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const ru = osmPoly(d, 'w658220894');let ruinsGround=null;
    if (ru) { ctx.skipBuildings.add('w658220894'); const y = Math.min(...ru.map(([x, z]) => g.heightAt(x, z)));ruinsGround=y;
        // excavated brick walls (low, ragged) on the outline + cross walls, a grassy pit, iron railing round it
        for (let i = 0; i < ru.length; i++) { const [ax, az] = ru[i], [bx, bz] = ru[(i + 1) % ru.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; const n = Math.ceil(L / 2); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, h = 1.1 + Math.abs(Math.sin(i * 3.1 + k * 1.7)) * 1.6; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2; b.box(cx, y - 1.4 - ((i + k) % 3) * 0.03, cz, 1.0 - (k % 2) * 0.06, h + 1.4, L / n + 0.05, '#a65a3a', 'brick', Math.atan2(bx - ax, bz - az)); } }
        const o = obb(ru); for (let k = -2; k <= 2; k++) { const cx = o.cx + o.ux * k * o.len * 0.18, cz = o.cz + o.uz * k * o.len * 0.18; b.box(cx, y - 1.5, cz, 0.9, 1.9 + (k % 2 ? 0.8 : 0), o.wid * 0.8, '#9e5536', 'brick', Math.atan2(o.ux, o.uz) + Math.PI / 2); }
        g.mod((x, z, h) => (inPoly(x, z, ru) ? h - 1.4 : h)); ctx.painter.poly(ru, '#6f7d48', 'grass');
        const mats = palisade(ctx, b, [...grow(ru, 1.2), grow(ru, 1.2)[0]], { h: 1.1, post: 2.4 });
        ctx.extras.ruinMats = mats;
    }
    // Vlad Țepeș bust (OSM n6164270296): bronze bust on a stone plinth
    const vb = d.pois.find((p) => p.id === 'n6164270296') || { x: 135.8, z: 152.1 };
    { const y = g.heightAt(vb.x, vb.z); b.box(vb.x, y, vb.z, 1.3, 1.6, 1.0, '#c9c2b4', 'stone'); b.box(vb.x, y + 1.6, vb.z, 1.1, 0.2, 0.85, '#d6cfc0', 'stone'); b.sphere(vb.x, y + 2.25, vb.z, 0.55, 0.38, 0.4, '#3d3426', 'bronze', 12, 8); b.sphere(vb.x, y + 2.75, vb.z, 0.24, 0.3, 0.27, '#3d3426', 'bronze', 12, 9); b.cyl(vb.x, y + 2.95, vb.z, 0.26, 0.2, '#3a3122', 'bronze', 10, 0.8); b.box(vb.x, y + 2.62, vb.z + 0.24, 0.3, 0.12, 0.08, '#3a3122', 'bronze'); ctx.circle(vb.x, vb.z, 0.75, 2); }
    // the church (Buna Vestire / Sf. Anton, 1559): bands of red brick and white plaster, blind arcades, grey tower roof
    const ch = d.buildings.find((x) => x.id === 'w150803286');
    let church = null;
    if (ch) { ctx.skipBuildings.add(ch.id);
        const p = ch.poly, y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.2, o = obb(p);
        const fac = classicFacade('curtea-veche-church-r2', [{ t: 'arch', w: 0.2, top: 0.36, cornice: false }, { t: 'niches', n: 3, top: 0.2, bottom: 0.3 }, { t: 'blank', cornice: false }, { t: 'blank' }], { bay: 2.6, floor: 3.4, stripes: { brick: '#a8553a', band: '#e6dccb', period: 16 }, lit: 0.2 });
        classicWalls(b, fac, p, y, y + 8.6, '#ffffff', y);
        b.prism(grow(p, 0.5), y + 8.4, y + 8.8, '#ede6d6', 'stone', { noTop: true });
        b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.25, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'metal', M(o.cx, y + 10.2, o.cz, 0, -o.angle, 0, o.len + 1, 2.8, o.wid + 1), '#5c5f60');
        const tx = o.cx - o.ux * o.len * 0.12, tz = o.cz - o.uz * o.len * 0.12, tw = 4.4;
        b.add(wallGeometry([[tx - tw / 2, tz - tw / 2], [tx + tw / 2, tz - tw / 2], [tx + tw / 2, tz + tw / 2], [tx - tw / 2, tz + tw / 2]], y + 8.8, y + 15, fac.S, y, '#ffffff'), fac.key, null, '#ffffff');
        b.add(new THREE.ConeGeometry(tw * 0.78, 6.5, 8), 'metal', M(tx, y + 18.2, tz), '#5c5f60'); b.box(tx, y + 21.4, tz, 0.15, 1.8, 0.15, '#c9a24e', 'bronze'); b.box(tx, y + 22.6, tz, 0.9, 0.12, 0.12, '#c9a24e', 'bronze');
        ctx.poly(p, { y0: y - 1, y1: y + 22 });
        church = { x: o.cx, z: o.cz, fac, tower:{x:tx,z:tz,y:y+18.2} };
    }
    ctx.add(b.build('curtea-veche', { matOverrides: { ...(church ? { [church.fac.key]: church.fac.mat } : {}), ...(ctx.extras.ruinMats || {}) } }));
    return { bust: vb, church, ruinsGround };
}

// ---------------------------------------------------------------------------- Stavropoleos (1724)
function friezeTexture() {
    const c = canvas(1024, 128), x = c.getContext('2d'), r = rng(17);
    x.fillStyle = '#c99a4e'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#2b4a6b'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 118, 1024, 10);
    for (let i = 0; i < 8; i++) { const cx = 64 + i * 128; x.fillStyle = '#e8d7a8'; x.beginPath(); x.arc(cx, 64, 50, 0, 7); x.fill(); x.fillStyle = '#7a2f22'; x.beginPath(); x.arc(cx, 64, 45, 0, 7); x.fill(); x.fillStyle = '#2d4c6e'; x.beginPath(); x.arc(cx, 64, 40, 0, 7); x.fill();
        x.fillStyle = '#e5c364'; x.beginPath(); x.arc(cx, 50, 16, 0, 7); x.fill(); x.fillStyle = '#d9b48c'; x.beginPath(); x.arc(cx, 52, 10, 0, 7); x.fill(); // halo + face
        x.fillStyle = r() < 0.5 ? '#8a3324' : '#3f5f3a'; x.beginPath(); x.moveTo(cx - 22, 104); x.quadraticCurveTo(cx, 54, cx + 22, 104); x.fill();
        x.strokeStyle = '#6d4a20'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(cx + 54 + k * 2, 14); x.lineTo(cx + 54 + k * 2, 114); x.stroke(); }
        x.fillStyle = '#e8d7a8'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + 64, 20 + k * 22, 4, 0, 7); x.fill(); } }
    return canvasTexture(c, { repeat: true });
}
function porchTexture() { // the carved stone porch: five lobed (trefoil) arches on carved columns, foliate spandrels
    const c = canvas(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#d8c7a2'; x.fillRect(0, 0, 1024, 512);
    const n = 5, w = 1024 / n;
    for (let i = 0; i < n; i++) { const cx = i * w + w / 2, top = 120, bot = 512, aw = w * 0.74;
        x.fillStyle = '#2f2a24'; x.beginPath(); x.moveTo(cx - aw / 2, bot); x.lineTo(cx - aw / 2, top + 70); x.arc(cx - aw / 4, top + 70, aw / 4, Math.PI, Math.PI * 1.5); x.arc(cx, top + 30, aw / 4.2, Math.PI * 1.15, Math.PI * 1.85); x.arc(cx + aw / 4, top + 70, aw / 4, Math.PI * 1.5, 0); x.lineTo(cx + aw / 2, bot); x.fill();
        x.strokeStyle = '#a8895a'; x.lineWidth = 6; x.stroke();
        for (let k = 0; k < 7; k++) { x.fillStyle = 'rgba(120,90,50,0.35)'; x.beginPath(); x.arc(i * w + 6 + (k % 2) * 6, 30 + k * 14, 8, 0, 7); x.fill(); } }
    x.fillStyle = '#b8955a'; x.fillRect(0, 0, 1024, 18);
    return canvasTexture(c);
}
function buildStavropoleos(ctx) {
    const d = ctx.data, g = ctx.ground, ch = d.buildings.find((x) => x.id === 'w78444014'); if (!ch) return null;
    ctx.skipBuildings.add(ch.id);
    const p = ch.poly, o = obb(p), y = Math.min(...p.map(([x, z]) => g.heightAt(x, z))) - 0.1, b = new GeoBatch();
    const fac = classicFacade('stavropoleos', [{ t: 'arch', w: 0.24, top: 0.3, bottom: 0.18, cornice: false }, { t: 'niches', n: 2, cornice: false }, { t: 'blank' }, { t: 'blank' }], { bay: 2.8, floor: 2.9, lit: 0.25 });
    const WALL = '#d9c59c', SHINGLE = '#4d3b2e'; // (r2) Street View: ochre plaster, dark timber-shingle roofs, not red tile
    classicWalls(b, fac, p, y, y + 5.6, WALL, y);
    // painted frieze of saint medallions all round under the eaves
    const fm = new THREE.MeshStandardMaterial({ map: friezeTexture(), roughness: 0.8 }); fm.map.repeat.set(1, 1);
    const fz = new GeoBatch(); fz.add(wallGeometry(p, y + 5.6, y + 7.1, { bay: 1.5 / 4 * 8 / 4 * 2, floor: 1.5 / 4 }, y + 5.6, '#ffffff'), 'frieze', null, '#ffffff');
    // deep eaves + red clay-tile hipped roof
    b.prism(grow(p, 1.2), y + 7.1, y + 7.45, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.35, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), 'roofs', M(o.cx, y + 7.45 + 1.1, o.cz, 0, -o.angle, 0, o.len + 2.4, 2.2, o.wid + 2.4), SHINGLE);
    // tower over the nave: octagonal drum with painted panels, tiled helmet roof, cross
    const tx = o.cx + o.ux * o.len * 0.05, tz = o.cz + o.uz * o.len * 0.05;
    const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; oct.push([tx + Math.cos(a) * 2.6, tz + Math.sin(a) * 2.6]); }
    classicWalls(b, fac, oct, y + 8.2, y + 11.0, WALL, y + 8.2);
    fz.add(wallGeometry(oct, y + 11.0, y + 12.2, { bay: 0.3, floor: 0.3 }, y + 11, '#ffffff'), 'frieze', null, '#ffffff');
    b.prism(grow(oct, 0.8), y + 12.2, y + 12.5, '#5a3a24', 'wood', { noTop: true, bottom: true });
    b.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'roofs', M(tx, y + 12.5, tz, 0, 0, 0, 3.0, 2.4, 3.0), SHINGLE);
    b.cyl(tx, y + 14.9, tz, 0.3, 0.6, SHINGLE, 'roofs', 8, 0.6); b.box(tx, y + 15.4, tz, 0.12, 1.8, 0.12, '#c9a24e', 'bronze'); b.box(tx, y + 16.5, tz, 0.9, 0.1, 0.1, '#c9a24e', 'bronze');
    // the porch (west end): open, five lobed arches on carved columns — a carved canvas on the west face + real columns
    const wx = o.cx - o.ux * o.len / 2, wz = o.cz - o.uz * o.len / 2, wyaw = Math.atan2(-o.ux, -o.uz);
    const pm = new THREE.MeshStandardMaterial({ map: porchTexture(), roughness: 0.75 });
    const porch = new THREE.Mesh(new THREE.PlaneGeometry(o.wid * 0.98, 5.6), pm); porch.position.set(wx - o.ux * 0.08, y + 2.8, wz - o.uz * 0.08); porch.rotation.y = wyaw; ctx.add(porch);
    for (let i = 0; i <= 5; i++) { const t = -0.5 + i / 5, cx = wx - o.ux * 0.35 + (-o.uz) * t * o.wid * 0.94, cz = wz - o.uz * 0.35 + o.ux * t * o.wid * 0.94; b.cyl(cx, y, cz, 0.24, 0.5, '#cdb68a', 'stone', 8); b.cyl(cx, y + 0.5, cz, 0.17, 3.0, '#d8c7a2', 'stone', 10); b.cyl(cx, y + 3.5, cz, 0.3, 0.45, '#cdb68a', 'stone', 8, 1.4); }
    ctx.poly(p, { y0: y - 1, y1: y + 18 });
    ctx.add(fz.build('stavropoleos-frieze', { matOverrides: { frieze: fm } }));
    // (round 4, r3-buc-spots-ot-1) The churchyard boundary is OSM's: plinths and piers (w657432484, w1181448687–698) and
    // fences on them (w1181448722–730, min_height 0.5, height 1.8) on the street and west sides only, drawn by osmBarriers
    // with the scene's other mapped barriers. The invented closed 4.5 m ring wall is gone; the yard stays paved.
    const yard = grow(p, 4.5);
    ctx.painter.poly(yard, '#a9a49a', 'slab');
    ctx.add(b.build('stavropoleos', { matOverrides: { [fac.key]: fac.mat } }));
    return { x: o.cx, z: o.cz, y, west: { x: wx, z: wz }, yard, o };
}
export { grow, buildCarusel, buildManuc, buildCurteaVeche, buildStavropoleos, simplifyRing };
