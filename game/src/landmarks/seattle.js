// ============================================================================
//  Landmarks — Seattle landmarks: Space Needle, downtown towers, T-Mobile Park, Great Wheel, Spheres, Mt Baker tunnel, Murrow bridge, Sea-Tac airport, mountains.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { SEATAC_AIRCRAFT } from '../landmark-seatac-aircraft.js';
import { DEPARTURES_CURB, GARAGE_STRUCTURE, structureCollider, boundaryBand, garagePosts, coveredCurbCells, coveredCurbPosts, emitGarageSkybridges, terminalBridgeEntries, emitTerminalLowerStructure } from '../landmark-seatac-structure.js';
import { US_FOOTPRINTS as U, US_SOURCE_TAGS as UT } from '../landmark-us-source.js';
import { emitUSLandmarkTerrain } from '../landmark-us-terrain.js';
import { sourceProfile, sourceSlope, sourceSurfaceText } from '../landmark-us-geometry.js';
import { pts, rect, ellipse, roundRect, signedArea, bbox, offset, zAt, M } from './kit.js';
import { airliner, atcTower } from './parts.js';

// ===========================================================================
//  SEATTLE / BELLEVUE — authored in real metres
// ===========================================================================

// Space Needle (1962) — 184 m (605 ft). The same sources and proportions as the walk-in model (spots/space-needle.js):
// OSM way 12903132 and its building parts (core, 100 ft level = a truncated triangle with three 16.4 x 7.8 m wings,
// 200 ft ring, fin ring r 16.7 m, glazed rings r 15.5 m at 152.4 m and r 13.7 m at 158.1 m, roof parts to 170.3 m,
// base footprint r 18.9 m); Street View from Space Needle Loop (Aug 2025) for the twin-beam legs that merge at the
// waist and fork under the top house, the open core and the halo. Beam sections and rung spacing are estimates.
// Src: https://en.wikipedia.org/wiki/Space_Needle (605 ft / 184 m; observation 520 ft; top house Ø 138 ft) ; OSM way 12903132
export function bSpaceNeedle(b) {
    const W = '#f3f3ef', GL = '#71899a', CREAM = '#e7dfc8', D = Math.PI / 180, legs = [90, 210, 330].map(d => d * D), lifts = [30, 150, 270].map(d => d * D);
    const at = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const pose = (y) => {
        if (y <= 113) { const u = 1 - y / 113, R = 4.4 + 9.8 * u ** 1.45, d = 0.6 + 1.15 * u ** 1.2; return { r: Math.hypot(R, d), phi: Math.atan2(d, R), R }; }
        const t = Math.min(1, (y - 113) / 33.7), r0 = Math.hypot(4.4, 0.6), p0 = Math.atan2(0.6, 4.4), r = r0 + (9.9 - r0) * t ** 1.55, phi = p0 + (30 * D - p0) * t ** 1.3;
        return { r, phi, R: r * Math.cos(phi) };
    };
    for (const a of legs) {
        for (const side of [-1, 1]) {
            const line = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 146.7, p = pose(y); line.push(at(p.r, a + side * p.phi, y)); }
            b.tube(line, 0.62, W, { seg: 30, radial: 4 });
            const p0 = pose(0), f = at(p0.r, a + side * p0.phi, 0); b.col(f[0], f[2], 1, 1, 0, { y0: 0, y1: 8 }); b.box(f[0], -0.3, f[2], 2.4, 1.1, 2.4, '#cfcfca');
        }
        for (const y of [8.5, 17, 25.5, 44, 52.5, 70.5, 79, 87.5, 95]) { const p = pose(y); b.strut(at(p.r, a - p.phi, y), at(p.r, a + p.phi, y), 0.7, 1.5, W); }
        for (let y = 104; y <= 122; y += 3) { const p = pose(y); b.strut(at(p.r, a - p.phi, y), at(p.r, a + p.phi, y), 0.3, 3.05, W); } // the plate through the waist
        b.strut(at(3.1, a, 62.5), at(pose(62).R + 0.5, a, 62.5), 4.6, 3.0, W); // 200 ft platform
    }
    // open hexagonal core round the glazed stair, ring beams every 20 ft; three gold elevator cars
    for (let k = 0; k < 6; k++) { const v = at(3.3, k * 60 * D, 0); b.box(v[0], 0, v[2], 0.4, 148.6, 0.4, '#e4e6e1'); }
    for (let y = 6.1; y < 148; y += 6.1) for (let k = 0; k < 6; k++) b.strut(at(3.3, k * 60 * D, y), at(3.3, (k + 1) * 60 * D, y), 0.22, 0.3, '#e4e6e1');
    b.cyl(0, 0, 0, 2.5, 2.5, 148.6, '#566067', 6);
    lifts.forEach((e, k) => { const c = at(4.25, e, 0); b.box(c[0], [22, 74, 128][k], c[2], 2.0, 3.4, 2.0, '#d6ad52'); });
    // base pavilion: storefront ring on the mapped footprint, a taller glazed drum round the core
    const foot = ellipse(0, 0, 18.9, 18.9, 32); b.prism(foot, 0, 4.6, '#3f5f5b', { mat: 'g' }); b.cornice(foot, 4.6, 0.5, 0.5, '#cfd2d0'); b.colPolygon(foot, { y1: 5.2 });
    b.cyl(0, 5.1, 0, 8.35, 9.4, 5.5, GL, 24, { mat: 'g', open: true }); b.cyl(0, 10.6, 0, 8.6, 8.6, 0.55, W, 24);
    // 100 ft level: truncated triangle + a wing over each elevator side (window band under a white roof, stepped hull)
    const hex = [], P = (e, u, v) => [Math.cos(e) * v - Math.sin(e) * u, Math.sin(e) * v + Math.cos(e) * u];
    for (const e of lifts) hex.push(P(e, -8.2, 6.6), P(e, 8.2, 6.6));
    b.prism(hex, 30.48, 33.9, W); b.prism(hex, 33.9, 36.1, GL, { mat: 'g' }); b.prism(hex, 36.1, 36.576, W);
    for (const e of lifts) {
        const q = (v0, v1, g = 0) => [P(e, -8.2 - g, v0), P(e, 8.2 + g, v0), P(e, 8.2 + g, v1 + g), P(e, -8.2 - g, v1 + g)];
        b.prism(q(6.6, 9.2), 30.6, 31.3, CREAM); b.prism(q(6.6, 11.8), 31.3, 32.0, CREAM); b.prism(q(6.6, 14.4), 32.0, 33.9, W);
        b.prism(q(6.6, 14.4), 33.9, 36.1, GL, { mat: 'g' }); b.prism(q(6.7, 14.4, 0.35), 36.1, 36.576, W);
    }
    // top house: ring beam and drum, 24 fins under the glass floor, the two glazed rings, halo, roof, spire
    b.cyl(0, 146.0, 0, 10.45, 10.45, 1.4, W, 32, { open: true }); b.cyl(0, 147.4, 0, 10.0, 10.0, 4.8, W, 32, { open: true }); b.cyl(0, 147.4, 0, 5.6, 9.35, 2.1, '#2b3034', 24, { open: true });
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.strut(at(10.0, a, 149.9), at(16.7, a, 151.6), 0.2, 1.5, W); }
    b.cyl(0, 152.0, 0, 16.7, 10.0, 0.12, '#33444f', 32); b.cyl(0, 152.15, 0, 16.7, 16.7, 0.25, W, 32, { open: true });
    b.cyl(0, 152.4, 0, 15.95, 15.5, 3.5, GL, 32, { mat: 'g', open: true });
    b.cyl(0, 155.9, 0, 16.7, 15.95, 0.4, W, 32, { open: true }); b.cyl(0, 156.3, 0, 16.7, 16.7, 2.2, W, 32);
    b.cyl(0, 157.32, 0, 20.9, 20.9, 0.07, '#f4f5f1', 40); b.cyl(0, 157.15, 0, 21, 21, 0.42, '#e0dccb', 40, { open: true });
    b.cyl(0, 158.5, 0, 13.7, 13.7, 2.8, GL, 32, { mat: 'g', open: true });
    b.cyl(0, 161.3, 0, 15.36, 15.3, 0.42, W, 32); b.cyl(0, 161.72, 0, 10.2, 15.36, 2.48, W, 32, { open: true }); b.cyl(0, 164.2, 0, 7.75, 10.2, 2.3, W, 32, { open: true });
    b.cyl(0, 166.5, 0, 7.75, 7.75, 0.9, GL, 24, { mat: 'g', open: true }); b.cyl(0, 167.4, 0, 7.95, 7.95, 0.18, W, 24);
    b.cyl(0, 167.58, 0, 5.4, 7.95, 0.87, W, 24, { open: true }); b.cyl(0, 168.45, 0, 2.7, 5.4, 0.5, W, 24, { open: true }); b.cyl(0, 168.95, 0, 1.9, 1.9, 1.35, W, 12); b.cyl(0, 170.3, 0, 2.45, 2.45, 0.12, W, 12);
    b.cone(0, 170.42, 0, 0.95, 10.6, W, 12); b.cyl(0, 181, 0, 0.09, 0.09, 3, '#cfcfcf', 6); // (to 184 m exactly: the rod ended at 184.4 and failed us-source-check behind an earlier failure)
}

// Columbia Center (Chester Lindsey, 1985) — 937 ft / 286 m, 76 floors (en.wikipedia "Columbia Center"),
// black granite base and dark glass in three stepped, concave-sided towers. Footprints & heights straight from
// OSM rel 4648083 (parts 160 / 223 / 226 / 280 / 286 m); vertical mullion fins + floor lines every 4 floors,
// Sky View Observatory level (73) as a lighter band.
// Src: https://en.wikipedia.org/wiki/Columbia_Center ; OSM rel 4648083
export function bColumbia(b) {
    const ps = ['w107124288','w418132525','w418132517','w418132520','w418132515','w331293871'].map(id=>U[id]), H = [16, 280, 286, 223, 226, 160];
    ps.forEach((p, i) => {
        b.prism(p, 0, H[i], i ? '#262b31' : '#2c2a2a', { mat: 'g', topCol: '#3a4047' });
        if (!i) return;
        b.bands(p, 20, H[i] - 2, 14.8, '#3e464e', { frac: 0.12, off: 0.15, mat: 'g', wall: false });
        b.pilasters(p, 16, H[i] - 0.5, 4.5, 0.25, 0.25, '#3a4148', {});
        b.cornice(p, H[i] - 1.5, 1.5, 0.3, '#4a525a');
    });
    b.cornice(ps[2], 270, 3, 0.2, '#6f7a84');                                                  // observatory glazing
    b.colPolygon(ps[0], { y1: 16 }); for (let i=1;i<ps.length;i++) b.colPolygon(ps[i], { y1: H[i] });
}
// Smith Tower (1914, Gaggin & Gaggin) — 484 ft / 148 m to the tip, 38 floors (en.wikipedia "Smith Tower").
// White glazed terra-cotta 21-storey base (OSM way 52781661, height 75) with a window grid in paired bays,
// tower shaft to the Chinese Room (35th floor) with an arcaded balcony, pyramidal cap with dormers and the
// glass globe (lit blue/white at night).
export function bSmith(b) {
    // Exact source part: shaft eaves 141 - 27 = 114 m; roof to 141 m,
    // small copper lantern and separate pyramidal tip to 148 m. No invented dormers.
    const p=U.w52781661,t=U.w418140386,W='#d2cfd2',TR='#e2dbc9',WIN='#4f555c'; b.wall=W;
    b.prism(p,0,75,W,{topCol:'#7a7869'}); b.windows(p,0,75,3.55,WIN,{bay:2.3,wf:0.5,hf:0.6,start:4.5,minL:3});
    b.pilasters(p,0,75,6.9,0.5,0.25,TR,{}); b.cornice(p,4,0.8,0.5,TR); b.cornice(p,74,1.2,0.8,TR);
    b.prism(t,75,114,W); b.windows(t,75,114,3.5,WIN,{bay:2.25,wf:0.5,hf:0.6,start:0.8,minL:3});
    b.pilasters(t,75,114,4.5,0.5,0.25,TR,{ends:true}); b.cornice(t,112.8,1.2,0.6,TR);
    const box=bbox([t]); b.hip((box.x0+box.x1)/2,114,(box.z0+box.z1)/2,box.x1-box.x0,box.z1-box.z0,27,'#9c907a');
    const lantern=U.w418140384,lb=bbox([lantern]),cx=(lb.x0+lb.x1)/2,cz=(lb.z0+lb.z1)/2;
    b.prism(lantern,138.7,141.1,'#637660',{mat:'g'});
    const tip=U.w418140385,tb=bbox([tip]); b.prism(tip,141.1,142,W);b.hip((tb.x0+tb.x1)/2,142,(tb.z0+tb.z1)/2,tb.x1-tb.x0,tb.z1-tb.z0,6,W);
    b.colPolygon(p,{y1:75}); b.colPolygon(t,{y0:75,y1:141});
}

// Lumen Field (2002, Ellerbe Becket / LMN; structure MKA) — 68,740 seats. MKA project page: roof carried by
// dual steel tied arches spanning 720 ft (219.5 m) on four towers with friction-pendulum dampers; roof covers
// ≈ 70% of seats, open north end. Field from OSM pitch way 163840038 (52.6 x 112.7 m, centre -2, +4.5).
// Commons "Aerial CenturyLink Field November 2011": navy roof membranes with white lettering, white arches,
// red-brick base. Roof lettering per lumenfield.com signage release: "LUMEN" 305 ft (93 m) and "FIELD" 131 ft (40 m) long.
// Bowl extents fitted inside the surrounding OSM streets (Occidental Ave S on the west).
// Src: https://www.mka.com/projects/lumen-field/ ; https://en.wikipedia.org/wiki/Lumen_Field ; OSM pitch 163840038
export function bLumen(b) {
    const CON = '#c9c6bf', BRK = '#8a4c3c', SEAT = '#2f5a78', FX = -2, FZ = 4.5, SPAN = 219.5;
    b.prism(U.w163840038,0,0.25,'#3f8a3a');
    b.box(FX, 0.25, FZ, 1, 0.05, 110, '#e8e8e8');
    const t1o = roundRect(FX, FZ, 136, 196, 30), t1i = roundRect(FX, FZ, 76, 128, 8);
    b.prism(t1o, 0, 11, BRK, { holes: [t1i], topCol: SEAT });
    const t2o = roundRect(FX, FZ + 4, 178, 232, 40), t2i = roundRect(FX, FZ, 134, 194, 28);
    b.prism(t2o, 0, 11, BRK, { holes: [t2i], top: false });
    b.prism(t2o, 11, 22, CON, { holes: [t2i], topCol: SEAT });
    b.bands(t2o, 0, 22, 5.5, '#3a3f45', { frac: 0.32, wall: false });                     // open concourse levels
    b.pilasters(t2o, 0, 22, 9, 1.2, 0.5, '#cfcdc7', {});
    for (const s of [-1, 1]) {                                              // upper sideline decks
        const o = rect(FX + s * 68, FZ - 100, FX + s * 104, FZ + 100);
        b.prism(o, 22, 26, CON, { topCol: SEAT });
        b.bands(o, 22, 26, 4, '#3a3f45', { frac: 0.3, wall: false });
        // roof canopy, tied arch (span 219.5 m) on two towers, hangers
        const roof=U[s<0?'w458208106':'w458208107'],roofY=sourceSlope(roof,0,26,10,true);
        sourceProfile(b,roof,roofY,'#e7e6e1');
        // OSM's complete round canopy contours and 36 m tagged roof top.
        for(let i=0;i<roof.length;i++){const a=roof[i],c=roof[(i+1)%roof.length];b.quad([a[0],roofY(...a)-.7,a[1]],[c[0],roofY(...c)-.7,c[1]],[c[0],roofY(...c),c[1]],[a[0],roofY(...a),a[1]],'#d1d3d3','m');}                    // navy roof membrane
        const arch = []; for (let i = 0; i <= 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; arch.push([FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz]); }
        b.tube(arch, 1.5, '#f0f0ee', { seg: 24, radial: 6 });
        b.box(FX + s * 106, 44.6, FZ, 2, 1.6, SPAN, '#e6e6e3');                // tie
        for (let i = 1; i < 12; i++) { const t = i / 12, zz = FZ - SPAN / 2 + t * SPAN; b.tube([[FX + s * 106, 44 + 22 * Math.sin(Math.PI * t), zz], [FX + s * 72, roofY(FX+s*72,zz), zz]], 0.35, '#e6e6e3', { seg: 2, radial: 4 }); }
        for (const e of [-1, 1]) { b.box(FX + s * 106, 0, FZ + e * SPAN / 2, 5, 44, 5, CON); b.box(FX + s * 106, 44, FZ + e * SPAN / 2, 6.5, 2.4, 6.5, '#9aa0a5'); }
    }
    // Curved canopy lettering follows the actual surface instead of floating above it.
    for (const side of [-1, 1]) {
        const roof = U[side < 0 ? 'w458208106' : 'w458208107'];
        const roofY = sourceSlope(roof, 0, 26, 10, true), angle = -side * Math.PI / 2;
        sourceSurfaceText(b, 'LUMEN', FX + side * 80, FZ, angle, 22.45, '#ffffff', roofY);
        sourceSurfaceText(b, 'FIELD', FX + side * 96, FZ, angle, 9.65, '#94bdd6', roofY);
    }
    // south end: video board above the end-zone deck; north end open "Hawks Nest" bleachers
    b.prism(rect(FX - 60, FZ + 100, FX + 60, FZ + 118), 22, 32, CON, { topCol: SEAT });
    b.box(FX, 34, FZ + 108, 64, 16, 3, '#1e2227'); b.box(FX, 35, FZ + 106.4, 58, 13, 0.2, '#2d5d88');
    b.prism(rect(FX - 50, FZ - 114, FX + 50, FZ - 98), 0, 14, CON, { topCol: SEAT });
    const northBoard=U.w458208112; b.prism(northBoard,42,60,'#263843');b.colPolygon(northBoard,{y0:42,y1:60});
    b.colPolygon(t1o, { holes: [t1i], y1: 11 }); b.colPolygon(t2o, { holes: [t2i], y1: 22 });
    for (const side of [-1,1]) b.colPolygon(rect(FX+side*68,FZ-100,FX+side*104,FZ+100), { y0: 22, y1: 26 });
}

// T-Mobile Park (1999, NBBJ) — retractable three-panel roof that parks over the east side. All massing from
// the OSM building:parts of the ballpark: grandstand ring 38 m (way 1451834523), lower-bowl stands 20 m with
// skillion rakes (1451834513-20), north upper deck 15-32 m (1451834512), parked roof 46-66 m with a round top
// (1451834522) on runway trusses at 46 m (1451834510/11); infield from OSM 158755976. Brick base + green steel.
const TMB_FIELD = [86.5, -14.5, 76.5, 37.5, 71, 54.5, 56, 69, 13.5, 80, -36, 81, -64, 73, -74.5, 63.5, -83.5, 51, -87, 40.5, -87.5, 30.5, -83, -5, -78, -28.5, -61, -68.5, -43.5, -83.5, 52, -83.5, 63, -39, 74, -13.5];
const TMB_DIRT = [-30.5, 28.5, -32.5, 31.5, -36.5, 32.5, -40.5, 30, -41, 27, -40, 24, -36, 22, -34, -10.5, -27.5, -13, -20, -13.5, -9.5, -11, -3, -7.5, 4, 1, 7.5, 11, 6.5, 22, 2, 32];
// Src: https://en.wikipedia.org/wiki/T-Mobile_Park ; OSM rel 18550612 + parts 1451834508-23
export function bTMobile(b) {
    const ring = U.w1451834523, field = pts(TMB_FIELD), dirt = pts(TMB_DIRT), BR = '#86463a', ST = '#3f6863', SEAT = '#1c4a63';
    b.prism(field, 0, 0.2, '#3f8a3a', { topCol: '#3f8a3a' });
    b.prism(dirt, 0.2, 0.3, '#b48a5a');
    b.prism(rect(-20, 4, -12, 12), 0.3, 0.35, '#5a9a4a');                              // infield grass square
    // grandstand: brick base with arched openings, green steel above, seating on top
    b.prism(ring, 0, 22, BR, { topCol: SEAT });
    b.windows(ring, 0, 9, 9, '#3a2a25', { bay: 7, wf: 0.55, hf: 0.7, start: 0.5, arch: true, minL: 10, edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] });
    b.prism(ring, 22, 38, ST, { topCol: SEAT });
    b.bands(ring, 9, 38, 6.5, '#2f3a3d', { frac: 0.35, wall: false });
    b.cornice(ring, 9, 0.8, 0.4, '#d8d3c8');
    // Every mapped lower deck uses its own footprint, tagged 20 m height,
    // skillion direction and rise (15–17 m). The previous two low blocks reached only 9 m.
    for(const id of ['w1451834508','w1451834509',...Array.from({length:8},(_,i)=>'w'+(1451834513+i))]){
        const q=U[id],t=UT[id],top=+t.height,rise=+t['roof:height'],base=top-rise;
        b.prism(q,0,base,'#c3bfb6',{top:false});
        sourceProfile(b,q,sourceSlope(q,+t['roof:direction'],base,rise),SEAT,'m',1);
        b.colPolygon(q,{y1:top});
    }
    const upper=U.w1451834512;b.prism(upper,15,20,ST,{top:false});sourceProfile(b,upper,sourceSlope(upper,180,20,12),SEAT,'m',1);b.colPolygon(upper,{y0:15,y1:32});
    b.box(6,32,-97,40,12,2,'#1e2227');
    // Actual runway contours at 46 m. The entire three-panel roof's curved
    // footprint follows the mapped 46–66 m round roof, including its tapered east edge.
    for(const id of ['w1451834510','w1451834511']){const q=U[id];b.prism(q,42,46,'#7f8f92');const bb=bbox([q]);for(const x of [bb.x0+2,(bb.x0+bb.x1)/2,bb.x1-2])b.box(x,0,(bb.z0+bb.z1)/2,3.5,42,3.5,'#7f8f92');}
    const roof=U.w1451834522,roofY=sourceSlope(roof,7,46,20,true);sourceProfile(b,roof,roofY,'#c8cdca');
    for(let i=0;i<roof.length;i++){const a=roof[i],c=roof[(i+1)%roof.length];b.strut([a[0],roofY(...a),a[1]],[c[0],roofY(...c),c[1]],.8,.8,'#7f8f92');}
    // Longitudinal panel seams use the same curve as the membrane.
    for(const x of [92,122,152])for(let j=0;j<16;j++){const z=-96+j*12.5,nz=z+12.5;b.strut([x,roofY(x,z)+.3,z],[x,roofY(x,nz)+.3,nz],.3,.3,'#778386');}
    b.text('T-MOBILE PARK', -78, 13, 93.6, 0.32, 2.4, '#e20074');
    b.colPolygon(ring, { y1: 38 }); b.col(116, -98, 56, 3); b.col(116, 103, 56, 3);
}

// Seattle Great Wheel (2012) — 53 m tall, 42 gondolas, end of Pier 57 (OSM ticket booth way
// 429553385). Built at true size in its own plane (not squashed) so it stays a circle.
// Src: https://en.wikipedia.org/wiki/Seattle_Great_Wheel (53 m, 42 gondolas)
export function bGreatWheel(b) {
    const hs = b.hs; b.hs = 1;                                             // keep the wheel round (true size)
    const R = 23.5, Y = 26.5; // complete envelope ≈ 53 m, as surveyed OSM n1809238334
    for (const z of [-1.8, 1.8]) b.geo(new THREE.TorusGeometry(R, 0.55, 6, 56), '#f2f2f2', M(0, Y, z));
    for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2; b.box(Math.cos(a) * R / 2, Y + Math.sin(a) * R / 2, 0, R, 0.3, 0.3, '#e6e6e6', { rz: a }); }
    b.geo(new THREE.CylinderGeometry(1.6, 1.6, 4.4, 12), '#cfcfcf', M(0, Y, 0, 0, 1, 1, 1, Math.PI / 2, 0));
    for (let i = 0; i < 42; i++) {
        const a = i / 42 * Math.PI * 2, x = Math.cos(a) * (R + 1.6), y = Y + Math.sin(a) * (R + 1.6) - 1.5;
        const frame = i === 0 ? '#25292d' : '#e9edf0'; // one VIP gondola, 41 white enclosed cabins
        b.box(x, y, 0, 2.4, 0.3, 2.6, frame); b.box(x, y + 2.55, 0, 2.4, 0.25, 2.6, frame);
        b.box(x, y + 0.3, 0, 2.18, 2.25, 2.38, '#7c9eaf', { mat: 'g' });
        for (const dx of [-1.1,1.1]) for (const dz of [-1.2,1.2]) b.box(x + dx,y + .3,dz,.12,2.25,.12,frame);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([[sx * 13, 0, sz * 7], [0, Y, sz * 2.2]], 0.7, '#e2e2e2', { seg: 2, radial: 6 });
    b.box(0, 0, 0, 34, 1, 18, '#8a8173');
    b.hs = hs;
    b.col(0, 0, 17 / hs, 9 / hs);                                          // collision in true metres too
}

// Amazon Spheres (2018) — three glass spheres (pentagonal hexecontahedra), 24-29 m tall,
// largest Ø ~40 m (OSM way 868099742).
// Src: https://en.wikipedia.org/wiki/The_Spheres ; OSM way 868099742
export function bSpheres(b) {
    // Individual OSM dome parts, not three intersecting complete balls. Heights
    // 19 / 15.5 / 27.5 m and spring lines = height - roof:height.
    const hs=b.hs;b.hs=1; const k=hs, GL='#9fb5ae', FRAME='#d5deda';
    const parts=['w398816077','w491817110','w491817111'].map(id=>{const p=U[id],bb=bbox([p]),x=(bb.x0+bb.x1)/2,z=(bb.z0+bb.z1)/2,h=+UT[id].height,rh=+UT[id]['roof:height'];return{id,p,x,z,h,y0:h-rh,rx:(bb.x1-bb.x0)/2,rz:(bb.z1-bb.z0)/2,rh};});
    for (const q of parts) {
        // Full tagged footprint and an ellipsoidal dome; frame triangles follow
        // that surface. Panel arrangement is a bounded approximation of the
        // pentagonal hexecontahedron, never claimed as a surveyed panel layout.
        b.prism(q.p.map(([x,z])=>[x*k,z*k]),0,q.y0*k,GL,{mat:'g'});
        const N=24,J=8,at=(i,j)=>{const ph=j/J*Math.PI/2,a=(i+j%2*.5)/N*Math.PI*2;return[(q.x+Math.cos(a)*q.rx*Math.cos(ph))*k,(q.y0+q.rh*Math.sin(ph))*k,(q.z+Math.sin(a)*q.rz*Math.cos(ph))*k];};
        for(let j=0;j<J;j++)for(let i=0;i<N;i++){const a=at(i,j),c=at(i+1,j),d=at(i+1,j+1),e=at(i,j+1);b.quad(a,c,d,e,GL,'g',[a[0]-q.x*k,10,a[2]-q.z*k]);if(j<J-1){b.strut(a,d,0.075*k,0.075*k,FRAME);b.strut(a,e,0.075*k,0.075*k,FRAME);}b.strut(a,c,0.075*k,0.075*k,FRAME);}
    }
    b.hs=hs;b.colPolygon(U.w868099742,{y1:5.3});
}

// Mount Baker Ridge Tunnel east portals. Anchor and three road-mouth centres are
// the mapped tunnel highway endpoints (ways 4712861, 123889282, 481403971), not the
// eastern vertex of the historic tunnel-lid footprint, which ends 330 m inland.
// Only the facade is modelled. Concrete/Art Deco details and wall height remain
// estimates; the historic underground polygon and nearby houses are not replaced.
// Src: https://en.wikipedia.org/wiki/Mount_Baker_Tunnel (1989 bore Ø 63 ft / 19.2 m)
export function bMtBaker(b) {
    const CON = '#cfcabe';
    const openings = [{ x: -23.1, w: 11, h: 10.5 }, { x: -4.1, w: 11, h: 10.5 }, { x: 35.9, w: 19.2, h: 19.2 }];
    b.archWall(100, 26.5, 3, openings, CON, M(0, 0, 0, Math.PI / 2));
    // World z = -archWall local x. Exact pier intervals leave all mapped road mouths open.
    const gaps = openings.map(q => [-q.x - q.w / 2, -q.x + q.w / 2]).sort((a,c) => a[0] - c[0]);
    let start = -50;
    for (const [a,z] of [...gaps,[50,50]]) {
        if (a > start) { const centre = (start + a) / 2, width = a - start;
            b.col(0, centre, 2, width / 2, 0, { y0: 0, y1: 26.5 });
            b.box(0.5, 0, centre, 4, 27.5, Math.min(3,width), '#dcd7cb');
        }
        start = z;
    }
    b.box(0, 26.5, 0, 4.5, 1.2, 102, '#e2ddd2');
    // A short procedural retaining embankment suggests the ridge without a solid
    // ground-level extrusion over the bore approaches.
    b.geo((() => { const s = new THREE.Shape([new THREE.Vector2(0, 27.7), new THREE.Vector2(-60, 40), new THREE.Vector2(-90, 42), new THREE.Vector2(-90, 27.7)]); const g = new THREE.ExtrudeGeometry(s, { depth: 100, bevelEnabled: false }); g.translate(0, 0, -50); return g; })(), '#4d6b3c', M(-1.5, 0, 0));
    for (const side of [-1, 1]) b.box(10, 0, side * 52, 24, 12, 2, CON, { ry: side * 0.25 });
    b.box(2.8, 11.4, 13.6, 0.4, 1.9, 27, '#c5c1b6');
    b.text('SEATTLE  PORTAL TO THE PACIFIC', 3.0, 11.85, 13.6, Math.PI / 2, 0.95, '#8f8b80');
    b.box(1.75, 2, 36.5, 0.5, 9, 5, '#b3afa3'); b.box(2.05, 4, 36.5, 0.3, 2.2, 2.6, '#a7a397'); b.box(2.05, 7.5, 35.8, 0.3, 1.2, 3.4, '#a7a397');
}

// Seattle-Tacoma International Airport — main terminal & concourses A-D (OSM way 23772634, 2 levels), the
// South Satellite (OSM 23772637, 2 levels) and the International Arrivals Facility (opened 2022, OSM 734002404)
// with its aerial walkway (OSM 869951038: 25.9 -> 33.5 m, i.e. 85 ft over the taxiway, ≈ 240 m / 780 ft long)
// linking the IAF to the South Satellite. Control tower (71 m, OSM 1199936807) is modelled separately.
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport ; OSM 23772634 / 23772637 / 734002404 / 869951038
export function bSeaTac(b) {
    const p=U.w23772634,iaf=U.w734002404,ss=U.w23772637, GL = '#5b7d92', WH = '#e9ebec';
    // The source polygon is the roof projection, including the covered public curb.
    // Preserve all of it below/above the bounded mapped-road opening; no terminal lift.
    const curb=coveredCurbCells(p),lo=DEPARTURES_CURB.modelVoidBottomLocalM,hi=DEPARTURES_CURB.modelSoffitLocalM;
    emitTerminalLowerStructure(b,p,lo,'#d7dadb');b.prism(p,hi,17,'#d7dadb',{topCol:'#c4c8ca',bottom:true});
    for(const q of curb.solid)b.prism(q,lo,hi,'#d7dadb',{top:false});
    coveredCurbPosts(b,p,'#d7dadb');
    // The mapped curved frontage is split into short edges (including 7.66 m).
    // Keep the existing estimated glass bands on those edges; sub-2 m returns,
    // the inter-storey wall and roof edge remain plain. Official curbside context:
    // https://www.portseattle.org/projects/sea-gateway-project (Arrivals Drive accessible door portals).
    b.windows(p, 0, 17, 8.5, GL, { bay: 12, wf: 0.92, hf: 0.55, start: 2.5, mat: 'g', minL: 2,
        skip:(i,j,f,k)=>{const a=p[i],c=p[(i+1)%p.length],t=(j+.5)/k,x=a[0]+(c[0]-a[0])*t,z=a[1]+(c[1]-a[1])*t;return f===1?curb.contains(x,z):terminalBridgeEntries(p).contains(x,z);} });
    b.cornice(p, 16.4, 1.2, 1.2, WH);
    b.prism(offset(p, -6), 17, 19.5, WH);
    b.text('SEATTLE-TACOMA INTERNATIONAL AIRPORT', -120, 11, zAt([p], -120)[0] - 1.25, Math.PI, 3.2, '#1f3550');
    // South Satellite (1973, rebuilt)
    b.prism(ss, 0, 14, '#d7dadb', { topCol: '#c4c8ca' }); b.windows(ss, 0, 14, 7, GL, { bay: 6, wf: 0.85, hf: 0.55, start: 2, mat: 'g', minL: 10 });
    b.cornice(ss, 13.6, 1, 1, WH);
    // International Arrivals Facility: tall glazed hall with a deep white roof plate
    b.prism(iaf, 0, 34, '#7f9db1', { mat: 'g', topCol: '#d9dcde' });
    b.pilasters(iaf, 0, 34, 9, 0.4, 0.5, '#f0f2f3', {});
    for (const y of [9, 18, 26]) b.cornice(iaf, y, 0.5, 0.35, '#f0f2f3');
    b.prism(offset(iaf, 3), 34, 36.5, WH, { topCol: '#e3e6e8', bottom: true });
    // aerial walkway: glazed tube on a white truss, piers clear of the taxiway
    const wx = 386, z0 = -186, z1 = 55, L = z1 - z0, zc = (z0 + z1) / 2;
    b.box(wx, 25.9, zc, 15, 1.4, L, '#f2f3f4');
    b.box(wx, 27.3, zc, 14, 5.3, L, '#8fb0c4', { mat: 'g' });
    b.box(wx, 32.6, zc, 15.6, 0.9, L + 1, '#f2f3f4');
    for (let k = 0; k <= 16; k++) { const z = z0 + k / 16 * L; b.box(wx, 22.4, z, 15.2, 3.5, 0.35, '#e6e8ea'); if (k < 16) b.box(wx, 22.4 + 1.6, z + L / 32, 15.2, 0.35, L / 16 * 1.1, '#e6e8ea', { rx: k % 2 ? 0.3 : -0.3 }); } // 17 verticals, 16 diagonal panels (a 17th diagonal hung past the South Satellite end)
    b.box(wx, 22, zc, 15.4, 0.5, L, '#e6e8ea');
    for (const z of [-150, 22]) for (const e of [-1, 1]) for (const sx of [-5, 5]) b.box(wx + sx, 0, z + e * 5.5, 2, 23.5, 2, '#eef0f1', { rx: e * 0.45 });   // V-struts (Commons "IAF Pedestrian Walkway.jpg")
    b.text('WELCOME TO SEATTLE', wx - 7.65, 28.6, zc, -Math.PI / 2, 2.2, '#ffffff');
    // Actual airside apron poses measured independently; never distribute aircraft around a terminal perimeter.
    // Keep the existing generic mesh while matching measured fuselage axes and wing spans. Vertical shape remains estimated.
    for (const a of SEATAC_AIRCRAFT) {
        const nominalSpan = 36.4 * a.lengthM / 38;
        b.push(M(a.x, 0, a.z, a.heading, 1, 1, a.spanM / nominalSpan));
        airliner(b, 0, 0, 0, a.livery, a.lengthM);
        b.pop();
    }
    structureCollider(b,p,[],hi,19.5,'w23772634','terminal-above-covered-curb');
    for(const q of curb.solid)structureCollider(b,q,[],lo,hi,'w23772634','terminal-solid-beside-covered-curb');
    b.colPolygon(iaf, { y1: 36.5 }); b.colPolygon(ss, { y1: 14.6 });
    for (const z of [-150, 22]) b.col(wx, z, 7, 1.6);
}

// SeaTac Air Traffic Control Tower (2004) — 71 m (233 ft) overall, OSM way 1199936807.
// Src: https://en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport (tower 233 ft) ; game/research/seattle-seatac.json landmarks[sea-control-tower] ; OSM way 1199936807
export function bSeaTower(b) {
    // (r2-landmarks-b-2, panorama 47.4535, -122.3005 h 20, round 2b) the base building is beige concrete (was white with navy
    // bands); its window strips read as dark glass
    const p=U.w1199936806; b.prism(p,0,9,'#cbbb9c');b.bands(p,0,9,4.5,'#3f464a',{frac:0.36});
    // Tagged 71 m is the complete tower height, not an invented 71 m cab floor.
    atcTower(b,0,0,65.7,{r:3.6,col:'#dedcd5'});
    b.colPolygon(p,{y1:9});b.col(0,0,3.6,3.6,0,{y0:0,y1:71});
}

// Mount Rainier — 4,392 m stratovolcano, summit 46.8529 N 121.7604 W (~90 km SE of downtown).
// Public-domain USGS 3DEP grid, decimated to a bounded terrain mesh; `backdrop: true`
// means the world may move it closer and pass ctx.backdropScale = distance / realDistance.
// Src: https://en.wikipedia.org/wiki/Mount_Rainier (4,392 m, 46.8529 N 121.7604 W)
export function bRainier(b) {
    emitUSLandmarkTerrain(b,'rainier',46.8529,-121.7604);
}

// Olympic Mountains — silhouette ridge west of Puget Sound (The Brothers 2,092 m, Mt Constance
// 2,371 m, Mt Olympus 2,432 m further west). ~80 km long backdrop band, same backdrop rules.
// Src: https://en.wikipedia.org/wiki/Olympic_Mountains (Olympus 2,432 m, Constance 2,371 m, The Brothers 2,092 m)
export function bOlympics(b) {
    emitUSLandmarkTerrain(b,'olympics',47.70,-123.15);
}

// Lacey V. Murrow Memorial Bridge (1940 / rebuilt 1993) — the "high-rise" through-arch spans at both ends of the
// floating bridge that the I-90 eastbound lanes drive through: cream-white concrete arch ribs on each side that lean in
// and are tied at the crown by flattened elliptical ring braces, ~8 dark steel hangers per side. Colour #c9c0ae.
// The bridge deck itself is the world's road; this is only the arch structure, anchored on the carriageway centreline
// (world edge "I-90 — Lacey V. Murrow Memorial Bridge", 4 lanes, 14.8 m) and rotated to the road heading.
// Src: game/research/seattle-bellevue.json landmarks[murrow-high-rise-arches] ; en.wikipedia.org/wiki/Lacey_V._Murrow_Memorial_Bridge ;
//      refs/bellevue/I-90_headed_east_from_Seattle_-_west_high-rise.jpg, ..._east_high-rise.jpg, Interstate_90_bridge_over_Lake_Washington_-_east_highrise_from_the_west.jpg
export function bMurrow(b) {
    const CR = '#d6cdb9', HG = '#3b3f43', L = 68, H = 13.5;                                  // research #c9c0ae (sunlit photo #b8a68b) — lifted for the flat shading
    const zb = 11.4, zt = 9.4;                                                              // rib lateral offset at deck / at crown (lean in)
    for (const s of [-1, 1]) {
        const prof = [[-L / 2, 0, zb], [-L / 2 + 7, 9.5, zb - 1.3], [-L / 2 + 12.5, H, zt], [L / 2 - 12.5, H, zt], [L / 2 - 7, 9.5, zb - 1.3], [L / 2, 0, zb]];
        for (let i = 0; i + 1 < prof.length; i++) { const a = prof[i], c = prof[i + 1]; b.strut([a[0], a[1], s * a[2]], [c[0], c[1], s * c[2]], 1.5, 1.9, CR); }
        b.box(-L / 2, -1.5, s * zb, 4, 2.3, 3.2, '#b9b2a2'); b.box(L / 2, -1.5, s * zb, 4, 2.3, 3.2, '#b9b2a2');   // rib seats on the pontoon
        for (let k = 0; k < 8; k++) { const x = -L / 2 + 12.5 + (k + 0.5) * (L - 25) / 8; b.strut([x, 0.6, s * (zt + 0.4)], [x, H - 0.8, s * zt], 0.35, 0.35, HG); }
        for (const x of [-L / 2 + 9.5, L / 2 - 9.5]) b.strut([x, 0.6, s * (zb - 0.6)], [x, 10.6, s * (zb - 1.6)], 0.35, 0.35, HG);
    }
    // Six crown openings per span, counted on independent georeferenced aerials.
    // The approximately 68 m longitudinal extent is an aerial estimate (±3 m); height remains estimated.
    const ringGeo = (() => {
        const sh = new THREE.Shape(), hole = new THREE.Path(), W = zt + 1, D = 3.4, w2 = W - 2.4, d2 = 1.6;
        sh.absellipse(0, 0, W, D, 0, Math.PI * 2, false, 0); hole.absellipse(0, 0, w2, d2, 0, Math.PI * 2, true, 0); sh.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false, curveSegments: 14 }); g.rotateX(Math.PI / 2); return g;
    })();
    for (const x of [-20, -12, -4, 4, 12, 20]) b.geo(ringGeo, CR, M(x, H + 0.9, 0, Math.PI / 2));
    for (const s of [-1, 1]) for (const x of [-L / 2, L / 2]) b.col(x, s * zb, 2.2, 1.6);
}

// Sea-Tac Airport parking garage (Port of Seattle, OSM rel 15763840: 7 levels, multi-storey, covered) — 12,100 spaces,
// "North America's largest parking structure under one roof". Precast decks with light-grey spandrel bands #a9a8a2 and
// open sides; eight round light wells / helices (OSM inner rings). Level 4 connects to the terminal by the six enclosed
// Skybridges 1-6 over Arrivals / Departures Drive (OSM w37017724-29, level 4, ~33-40 m) and to the Link station.
// Individual deck datums remain estimates; mapped source road-floor datums are unresolved.
// Src: game/research/seattle-seatac.json landmarks[sea-garage] ; en.wikipedia.org/wiki/Seattle–Tacoma_International_Airport ;
//      OSM rel 15763840, w37017724-w37017729 ; Commons "SeaTacAerial.jpg" (Bernstea, CC BY-SA 4.0, reference only)
// a ring of wall bands left open where a mapped road passes at its level (ctx.roadAt; whole ring when unavailable)
function ringOpen(b, p, y0, y1, col, o, ctx) {
    if (!ctx?.roadAt) return b.ring(p, y0, y1, col, o);
    const s = (signedArea(p) > 0 ? 1 : -1) * (o?.inward ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
        const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.5)), hint = [s * (bz - az), 0, -s * (bx - ax)];
        for (let k = 0; k < n; k++) {
            const t0 = k / n, t1 = (k + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
            if (ctx.roadAt((x0 + x1) / 2, (z0 + z1) / 2, y0, y1)) continue;
            b.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], col, o?.mat || 'm', hint);
        }
    }
}
export function bSeaGarage(b, ctx = {}) {
    const source=U.r15763840, outer=source.find(q=>q.role==='outer').poly, holes=source.filter(q=>q.role==='inner').map(q=>q.poly), G1 = '#a9a8a2', IN = '#4a4c4f', FH = 3.05;
    // Official Port records/photos and mapped aisles establish open parking decks.
    // Keep exact source outer/eight holes and complete roof; explicit deck datums support the source Level4 connection.
    // Datums/thickness/spandrel/post dimensions remain explicit estimates, bounded by the
    // garage's official6ft10in entrance limit; no source layer is converted to metres.
    const profile=GARAGE_STRUCTURE;
    for(let k=0;k<=7;k++){
        const y=profile.floorDatumsM[k],y0=Math.max(0,y-profile.deckThicknessM),y1=y+.05;
        b.prism(outer,y0,y1,IN,{holes,topCol:k===7?'#8d8c88':G1,bottom:true});
        structureCollider(b,outer,holes,y0,y1,'r15763840','garage-deck');
        const sp0=Math.max(0,y-(k<=3?profile.lowerSpandrelDepthM:profile.spandrelDepthM));
        ringOpen(b,offset(outer,.12),sp0,y1,G1,{},ctx);boundaryBand(b,outer,sp0,y1,.3,'r15763840','garage-edge-spandrel');
        for(const h of holes){ringOpen(b,offset(h,-.1),sp0,y1,'#9d9c97',{inward:true},ctx);boundaryBand(b,h,sp0,y1,.2,'r15763840','garage-inner-spandrel');} // (#59 / #60: open where a mapped ramp passes at that level)
    }
    b.ring(offset(outer, 0.12), 7 * FH + 0.05, 7 * FH + 1.1, '#b5b4ae');                       // roof parapet
    boundaryBand(b,outer,7*FH+.05,7*FH+1.1,.3,'r15763840','garage-roof-parapet');
    garagePosts(b,outer,7*FH,'#b2b1ab');
    for (const [x, z] of [[-40, -120], [30, -150], [-100, -60], [80, 130], [10, 90]]) {
        b.box(x,7*FH,z,9,3.2,7,'#9fa09c');
        structureCollider(b,[[x-4.5,z-3.5],[x+4.5,z-3.5],[x+4.5,z+3.5],[x-4.5,z+3.5]],[],7*FH,7*FH+3.2,'r15763840','garage-existing-roof-core');
    }
    // Exact mapped Skybridges1–6 connect the estimated Level4 deck to the terminal,
    // beneath the actual upper-road underside; source XY and the garage envelope stay fixed.
    emitGarageSkybridges(b);
}

// SeaTac/Airport Link light-rail station (Sound Transit 1 Line, opened 2009-12-19) — island platform elevated 60 ft
// (18 m) under a white steel-truss roof with a flight theme (David Hewitt); concourse below; west pedestrian bridge to
// garage level 4 (then the 1,200 ft covered walkway to the terminal) and an east bridge over the Airport Expressway to
// International Blvd (OSM w54139652). Footprint OSM w54139654, platform w226892390. Piers on the centreline (clear of
// the expressway ramps that run under the station). The west bridge is not in the OSM extract: approximate, from the
// photo "SeaTac Airport station from airport parking garage" (SounderBruce, CC BY-SA 4.0, reference only).
// Src: game/research/seattle-seatac.json landmarks[seatac-airport-station] ; en.wikipedia.org/wiki/SeaTac/Airport_station ; OSM w54139654 / w226892390 / w54139652
export function bSeaLink(b) {
    const CON = '#cdcac3', WH = '#f1f2f2', GL = '#6f8796';
    const z0 = -74, z1 = 74, W = 19, yP = 18; // Sound Transit / research: platform elevated 60 ft
    b.push(M(6, 0, 0, Math.atan2(7, 148)));                                                   // guideway axis (platform w226892390 runs 2.7° off north)
    for (let z = z0 + 6; z <= z1 - 6; z += 18.5) { b.box(0, 0, z, 2.2, yP - 1.2, 3.2, CON); b.box(0, yP - 1.6, z, 14, 1.4, 3.4, CON); }
    b.box(0, yP - 1.2, 0, W, 1.2, z1 - z0, CON);                                              // platform / guideway deck
    b.box(0, yP, 0, 8, 1.0, z1 - z0 - 4, '#bdb9b1');                                          // island platform
    for (const s of [-1, 1]) b.box(s * 8.6, yP, 0, 0.3, 1.1, z1 - z0, '#9aa0a4');          // parapets
    b.box(-5, 8.6, -6, 15, 4.8, 44, GL, { mat: 'g' }); b.box(-5, 8.2, -6, 15.6, 0.5, 44.6, CON); b.box(-5, 13.4, -6, 15.6, 0.4, 44.6, CON);   // concourse
    // flight-theme roof: translucent canopy on a row of white V-trusses
    b.box(0, yP + 7.8, 0, W + 4, 0.35, z1 - z0 - 10, '#dfe7eb', { mat: 'g' });
    for (let z = z0 + 6; z <= z1 - 6; z += 9.25) {
        for (const s of [-1, 1]) { b.strut([s * 1.2, yP + 1, z], [s * 11.5, yP + 9.2, z], 0.35, 0.35, WH); b.strut([s * 11.5, yP + 9.2, z], [0, yP + 11.5, z], 0.3, 0.3, WH); }
        b.strut([0, yP + 1, z], [0, yP + 11.5, z], 0.3, 0.3, WH);
    }
    for (const x of [-11.5, 0, 11.5]) b.strut([x, yP + 9.2 + (x === 0 ? 2.3 : 0), z0 + 6], [x, yP + 9.2 + (x === 0 ? 2.3 : 0), z1 - 6], 0.3, 0.3, WH);   // chords
    b.box(0, yP + 2.6, z1 - 4.1, 13, 1.9, 0.3, '#1d4f91');
    for (const x of [-5.5, 5.5]) b.box(x, yP + 1, z1 - 4.1, 0.22, 1.65, 0.22, '#9aa0a4'); // (owner register #61: the name board stood on nothing: two posts to the platform)
    b.pop();
    { const r = Math.atan2(7, 148); b.text('SEATAC/AIRPORT', 6 + 70.05 * Math.sin(r), yP + 3, 70.05 * Math.cos(r), r, 1.1, '#ffffff'); }
    // bridges at concourse level (9 m): east over the Airport Expressway (OSM w54139652), west to the garage (approx.)
    const br = (a, c) => { b.strut([a[0], 10.6, a[1]], [c[0], 10.6, c[1]], 5.5, 3.6, '#8aa5b5', 'g'); b.strut([a[0], 8.5, a[1]], [c[0], 8.5, c[1]], 6, 0.7, CON); b.strut([a[0], 12.7, a[1]], [c[0], 12.7, c[1]], 6.4, 0.5, WH); };
    // East bridge over International Blvd (OSM footway bridge w54139652, outline w469766790 `bridge:structure=beam`): a glazed
    // walkway inside an open white steel truss (verticals + alternating diagonals, thin flat roof), not a closed box. It lands
    // on the stair / lift tower OSM w469766788 (dark steel frame, open stair flights, flat roof, glazed lift shaft under the
    // bridge end, one round column). Character checked against street-level imagery 2026-11-12 (reference only).
    {
        const a = [13, -55], c = [73.4, -58.3], dx = c[0] - a[0], dz = c[1] - a[1], Lb = Math.hypot(dx, dz), nx = -dz / Lb, nz = dx / Lb;
        const yD = 8.5, yR = 12.6, hw = 2.6, N = 9, ST = '#3d4247';
        b.strut([a[0], yD, a[1]], [c[0], yD, c[1]], 5.6, 0.6, CON);                                  // deck
        b.strut([a[0], yR + 0.15, a[1]], [c[0], yR + 0.15, c[1]], 6.2, 0.3, WH);                     // flat roof
        b.strut([a[0], yD + 2.2, a[1]], [c[0], yD + 2.2, c[1]], 4.6, 3.3, '#a9bcc6', 'g');           // glazing behind the truss
        for (const s of [-1, 1]) {
            const Q = (t, y) => [a[0] + dx * t + nx * hw * s, y, a[1] + dz * t + nz * hw * s], y0 = yD + 0.45, y1 = yR - 0.2;
            b.strut(Q(0, y0), Q(1, y0), 0.3, 0.35, WH); b.strut(Q(0, y1), Q(1, y1), 0.3, 0.35, WH);  // chords
            for (let i = 0; i <= N; i++) b.strut(Q(i / N, y0), Q(i / N, y1), 0.26, 0.26, WH);        // verticals
            for (let i = 0; i < N; i++) b.strut(Q((i + (i & 1)) / N, y0), Q((i + 1 - (i & 1)) / N, y1), 0.2, 0.2, WH); // diagonals
        }
        b.cyl(68.6, 0, -58, 0.55, 0.55, yD - 0.3, CON, 10); b.col(68.6, -58, 0.6, 0.6, 0);         // round column at the east end
        // lift shaft + landing under the bridge end (south leg of w469766788)
        b.box(72.4, 0, -57.4, 5.6, 3.0, 8.8, CON); b.box(72.4, 3.0, -57.4, 5.2, yR - 3.0, 8.4, '#52626c', { mat: 'g' }); b.box(72.4, yR, -57.4, 6.2, 0.3, 9.4, ST);
        b.col(72.4, -57.4, 2.9, 4.5, 0);
        // open stair tower (north leg of w469766788): steel posts, landings, flights, flat roof
        const sx0 = 71.4, sx1 = 86.6, sz0 = -68.1, sz1 = -62.2, yT = 14.6;
        for (const x of [sx0, (sx0 + sx1) / 2, sx1]) for (const z of [sz0, sz1]) b.box(x, 0, z, 0.35, yT, 0.35, ST);
        b.box((sx0 + sx1) / 2, yT, (sz0 + sz1) / 2, sx1 - sx0 + 1.6, 0.35, sz1 - sz0 + 1.6, ST);
        b.box((sx0 + sx1) / 2, 0, (sz0 + sz1) / 2, sx1 - sx0, 1.1, sz1 - sz0, CON);                  // base wall
        for (let k = 0; k < 4; k++) {                                                                // flights between end landings
            const yA = 1.1 + k * 2.47, yB = yA + 2.47, fwd = k % 2 === 0, zf = fwd ? sz0 + 1.4 : sz1 - 1.4;
            b.strut([fwd ? sx0 + 2.4 : sx1 - 2.4, yA, zf], [fwd ? sx1 - 2.4 : sx0 + 2.4, yB, zf], 2.2, 0.28, ST);
            b.box(fwd ? sx1 - 1.2 : sx0 + 1.2, yB - 0.14, (sz0 + sz1) / 2, 2.4, 0.28, sz1 - sz0, ST);
        }
        for (const y of [yD + 1.1, yD + 4.2]) for (const z of [sz0, sz1]) b.strut([sx0, y, z], [sx1, y, z], 0.12, 0.12, ST); // ties
        b.col((sx0 + sx1) / 2, (sz0 + sz1) / 2, (sx1 - sx0) / 2, (sz1 - sz0) / 2, 0);
    }
    // (owner register #57 / #58: "skybridge / connector connected to nothing") the approximate west bridge stopped 30.6 m short of
    // the garage, over a 5.8 m building: it now runs on to the garage's level-4 edge (OSM r15763840 outline, measured in the
    // district world), on two columns
    br([-3.5, -10], [-66.1, 31.9]);
    for (const t of [.38, .72]) { const x = -3.5 + (-66.1 + 3.5) * t, z = -10 + (31.9 + 10) * t; b.box(x, 0, z, 1.1, 8.1, 1.1, CON); b.col(x, z, .7, .7, 0); }
    for (let z = z0 + 6; z <= z1 - 6; z += 18.5) b.col(6 + z * 7 / 148, z, 1.4, 1.8, Math.atan2(7, 148));
}
